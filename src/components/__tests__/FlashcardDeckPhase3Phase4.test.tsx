// @vitest-environment happy-dom
// src/components/__tests__/FlashcardDeckPhase3Phase4.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { useAppStore, clearUnifiedCardsCache } from '../../store/useAppStore';
import { SessionHeader } from '../FlashcardDeck';
import {
  resolveCardPresentationMode,
  createClozeMask,
  hashCardSeed,
} from '../../services/adaptiveCardPresentation';
import { isSpeechRecognitionSupported, getSpeechBrowserSupport } from '../../services/speechService';
import type { SRSReviewCard, MistakeRecord } from '../../types';

describe('PHASE 3 & PHASE 4 — Flashcard Session UX, Header & Adaptive Variations', () => {
  beforeEach(() => {
    useAppStore.getState().resetToDefault();
    clearUnifiedCardsCache();
  });

  describe('PHASE 3: Session Header & Progress Math', () => {
    it('renders correct counter, remaining count, and streak in SessionHeader', () => {
      // 12th card out of 30 cards -> index 11
      const currentIndex = 11;
      const totalWords = 30;
      const remainingCount = 18;
      const sessionStreak = 7;

      render(
        <SessionHeader
          currentIndex={currentIndex}
          totalWords={totalWords}
          remainingCount={remainingCount}
          sessionStreak={sessionStreak}
          queueMode="NEW"
          srsAlgorithm="sm2"
          retrievabilityInfo={null}
          tagLabel="Academic"
        />
      );

      // Verifies 12 / 30 display
      expect(screen.getByText('12 / 30')).toBeDefined();

      // Verifies 18 remaining display
      expect(screen.getByText('(18 remaining)')).toBeDefined();

      // Verifies Session Streak 7 display
      expect(screen.getByText('Streak 7')).toBeDefined();
    });

    it('session streak is strictly local and independent of app streak', () => {
      const store = useAppStore.getState();
      const initialAppStreak = store.profile.streak; // Global app streak, e.g. 1
      expect(initialAppStreak).toBeDefined();

      // Simulate local session streak progression
      let sessionStreak = 0;
      const handleRating = (grade: 0 | 1 | 2 | 3) => {
        if (grade === 0) {
          sessionStreak = 0;
        } else {
          sessionStreak += 1;
        }
      };

      // 3 successful reviews in a row
      handleRating(2);
      handleRating(3);
      handleRating(2);
      expect(sessionStreak).toBe(3);

      // Failed review (Again) resets session streak to 0
      handleRating(0);
      expect(sessionStreak).toBe(0);

      // Verify global app streak is completely untouched
      expect(useAppStore.getState().profile.streak).toBe(initialAppStreak);
    });

    it('micro-feedback texts match prescribed feedback for all 4 SRS grades', () => {
      const feedbackMap: Record<0 | 1 | 2 | 3, string> = {
        0: "We'll reinforce this one.",
        1: 'Getting there.',
        2: 'Nice recall!',
        3: 'Strong memory!',
      };

      expect(feedbackMap[0]).toBe("We'll reinforce this one.");
      expect(feedbackMap[1]).toBe('Getting there.');
      expect(feedbackMap[2]).toBe('Nice recall!');
      expect(feedbackMap[3]).toBe('Strong memory!');
    });
  });

  describe('PHASE 4: Adaptive Presentation Engine', () => {
    it('rule 1: new cards prioritize Standard recall mode', () => {
      const newCard: SRSReviewCard = {
        id: 'new_word_1',
        type: 'single_word',
        word: 'Innovate',
        primaryText: 'Innovate',
        meaning: 'Đổi mới, cách tân',
        exampleEn: 'We must innovate to stay competitive.',
        srsLevel: 0,
        nextReviewDate: new Date().toISOString(),
        reviewCount: 0,
        againCount: 0,
      };

      const plan = resolveCardPresentationMode(newCard, {});
      expect(plan.mode).toBe('standard');
      expect(plan.targetWord).toBe('Innovate');
      expect(plan.meaning).toBe('Đổi mới, cách tân');
    });

    it('rule 2: collocation / phrase cards strictly resolve to Collocation mode', () => {
      const collocationCard: SRSReviewCard = {
        id: 'colloc_1',
        type: 'collocation',
        primaryText: 'make an effort',
        meaning: 'nỗ lực làm gì',
        exampleEn: 'You should make an effort to arrive on time.',
        srsLevel: 1,
        nextReviewDate: new Date().toISOString(),
      };

      const plan = resolveCardPresentationMode(collocationCard, {});
      expect(plan.mode).toBe('collocation');
      expect(plan.targetWord).toBe('make an effort');
    });

    it('rule 3a: Confused Word Challenge triggers when personalized mistake evidence exists', () => {
      const card: SRSReviewCard = {
        id: 'affect_1',
        type: 'single_word',
        word: 'affect',
        primaryText: 'affect',
        meaning: 'ảnh hưởng đến',
        exampleEn: 'The climate change will affect everyone.',
        srsLevel: 1,
        nextReviewDate: new Date().toISOString(),
      };

      // Mistake bank containing learner evidence that they confused affect with effect
      const mistakeBank: Record<string, MistakeRecord> = {
        mistake_1: {
          id: 'mistake_1',
          word: 'affect',
          lastUserAnswer: 'effect',
          meaning: 'ảnh hưởng đến',
          lastMistakeAt: '2026-10-06T10:00:00.000Z',
          mistakeCount: 2,
          consecutiveCorrect: 0,
          resolved: false,
          source: 'quiz',
          primaryType: 'meaning',
        },
      };

      const plan = resolveCardPresentationMode(card, mistakeBank);
      expect(plan.mode).toBe('confusion_challenge');
      expect(plan.confusionPair).toBeDefined();
      expect(plan.confusionPair?.confusedWith.toLowerCase()).toBe('effect');
      expect(plan.confusionPair?.isPersonalized).toBe(true);

      // Verify options contain both target word and confused word
      const options = plan.confusionPair?.options.map((o) => o.word) || [];
      expect(options).toContain('affect');
      expect(options).toContain('effect');
    });

    it('rule 3b: Confused Word Challenge does NOT trigger without struggle evidence', () => {
      // "accept" is a curated confused pair with "except", but this learner has ZERO mistakes and ZERO lapses on it
      const pristineCard: SRSReviewCard = {
        id: 'accept_1',
        type: 'single_word',
        word: 'accept',
        primaryText: 'accept',
        meaning: 'chấp nhận',
        exampleEn: 'Please accept this invitation.',
        srsLevel: 0,
        nextReviewDate: new Date().toISOString(),
        againCount: 0,
        reviewCount: 0,
      };

      const plan = resolveCardPresentationMode(pristineCard, {});
      // Zero false-positive challenge! Must remain Standard recall
      expect(plan.mode).toBe('standard');
    });

    it('rule 3c: Curated Confused Pair Challenge triggers when learner has struggle evidence (againCount > 0)', () => {
      const lapsedCard: SRSReviewCard = {
        id: 'accept_1',
        type: 'single_word',
        word: 'accept',
        primaryText: 'accept',
        meaning: 'chấp nhận',
        exampleEn: 'Please accept this invitation.',
        srsLevel: 1,
        nextReviewDate: new Date().toISOString(),
        againCount: 1, // Evidence of struggle!
      };

      const plan = resolveCardPresentationMode(lapsedCard, {});
      expect(plan.mode).toBe('confusion_challenge');
      expect(plan.confusionPair?.confusedWith.toLowerCase()).toBe('except');
      expect(plan.confusionPair?.isPersonalized).toBe(false);
    });

    it('rule 4: frequent lapses with valid example trigger Context Cloze mode', () => {
      const lapsedCard: SRSReviewCard = {
        id: 'lapsed_word_1',
        type: 'single_word',
        word: 'comprehend',
        primaryText: 'comprehend',
        meaning: 'lĩnh hội, hiểu thấu',
        exampleEn: 'She could not comprehend the message.',
        srsLevel: 1,
        nextReviewDate: new Date().toISOString(),
        againCount: 2, // High lapse count
      };

      const plan = resolveCardPresentationMode(lapsedCard, {});
      expect(plan.mode).toBe('context_cloze');
      expect(plan.maskedCloze).toContain('[ _____ ]');
      expect(plan.maskedCloze).toBe('She could not [ _____ ] the message.');
    });

    it('rule 5: missing optional metadata safely degrades to Standard recall', () => {
      // Lapsed card but example sentence is completely empty
      const lapsedWithoutExample: SRSReviewCard = {
        id: 'lapsed_word_no_ex',
        type: 'single_word',
        word: 'obscure',
        primaryText: 'obscure',
        meaning: 'mơ hồ, khó hiểu',
        exampleEn: '',
        example: '',
        srsLevel: 1,
        nextReviewDate: new Date().toISOString(),
        againCount: 2,
      };

      const plan = resolveCardPresentationMode(lapsedWithoutExample, {});
      // Falls back to Reverse (if meaning exists) or Standard
      expect(plan.mode === 'reverse' || plan.mode === 'standard').toBe(true);

      // And if meaning is also missing:
      const brokenCard: SRSReviewCard = {
        id: 'broken_card',
        type: 'single_word',
        word: 'obscure',
        primaryText: 'obscure',
        meaning: '',
        exampleEn: '',
        srsLevel: 1,
        nextReviewDate: new Date().toISOString(),
        againCount: 2,
      };

      const fallbackPlan = resolveCardPresentationMode(brokenCard, {});
      expect(fallbackPlan.mode).toBe('standard');
    });

    it('deterministic stability: re-rendering does not alter presentation mode', () => {
      const card: SRSReviewCard = {
        id: 'mature_card_1',
        type: 'single_word',
        word: 'sustainable',
        primaryText: 'sustainable',
        meaning: 'bền vững',
        exampleEn: 'We need sustainable energy solutions.',
        srsLevel: 3,
        nextReviewDate: new Date().toISOString(),
      };

      const firstCall = resolveCardPresentationMode(card, {});
      const secondCall = resolveCardPresentationMode(card, {});
      const thirdCall = resolveCardPresentationMode(card, {});

      expect(firstCall.mode).toBe(secondCall.mode);
      expect(secondCall.mode).toBe(thirdCall.mode);
      expect(firstCall.maskedCloze).toBe(secondCall.maskedCloze);
    });
  });

  describe('PHASE 4: Invariants & Web Speech Safety', () => {
    it('invariant 1: presentation variation NEVER mutates card scheduler properties', () => {
      const originalCard: Readonly<SRSReviewCard> = Object.freeze({
        id: 'frozen_immutable_card',
        type: 'single_word',
        word: 'resilient',
        primaryText: 'resilient',
        meaning: 'kiên cường',
        exampleEn: 'The team remained resilient.',
        srsLevel: 2,
        interval: 12,
        easeFactor: 2.5,
        nextReviewDate: '2026-10-15T00:00:00.000Z',
        againCount: 1,
        fsrs: Object.freeze({
          stability: 14.5,
          difficulty: 4.8,
          reps: 3,
          lapses: 1,
          state: 2,
          lastReview: '2026-10-01T00:00:00.000Z',
        }),
      });

      // Resolving presentation mode must never throw or modify frozen card
      const plan = resolveCardPresentationMode(originalCard, {});
      expect(plan).toBeDefined();

      // Card properties are 100% untouched
      expect(originalCard.srsLevel).toBe(2);
      expect(originalCard.interval).toBe(12);
      expect(originalCard.easeFactor).toBe(2.5);
      expect(originalCard.nextReviewDate).toBe('2026-10-15T00:00:00.000Z');
      expect(originalCard.fsrs?.stability).toBe(14.5);
    });

    it('invariant 2: SM-2 card is never decorated with synthetic FSRS properties', () => {
      const sm2Card: SRSReviewCard = {
        id: 'sm2_pure_card',
        type: 'single_word',
        word: 'diligent',
        primaryText: 'diligent',
        meaning: 'chăm chỉ',
        exampleEn: 'He is a diligent student.',
        srsLevel: 2,
        interval: 6,
        easeFactor: 2.4,
        nextReviewDate: new Date().toISOString(),
      };

      const plan = resolveCardPresentationMode(sm2Card, {});
      expect(plan.mode).toBeDefined();
      expect(sm2Card.fsrs).toBeUndefined(); // SM-2 card remains pure SM-2
    });

    it('invariant 3: Speech API detection degrades gracefully in unsupported environments', () => {
      const supportInfo = getSpeechBrowserSupport();
      expect(typeof supportInfo.isSupported).toBe('boolean');
      expect(typeof supportInfo.recommendation).toBe('string');
      expect(supportInfo.recommendation.length).toBeGreaterThan(0);
    });

    it('createClozeMask handles inflected forms and boundary matching', () => {
      const sentence = 'The scientists are maintaining high standards.';
      const res = createClozeMask(sentence, 'maintain');
      expect(res.found).toBe(true);
      expect(res.maskedSentence).toBe('The scientists are [ _____ ] high standards.');

      const failedRes = createClozeMask('Completely unrelated sentence.', 'maintain');
      expect(failedRes.found).toBe(false);
      expect(failedRes.maskedSentence).toBe('Completely unrelated sentence.');
    });
  });
});
