// src/services/__tests__/adaptiveDifficultyService.test.ts
import { describe, it, expect } from 'vitest';
import {
  evaluateAdaptiveDifficulty,
  getBaselineTierFromCefr,
  getCefrTierBoundaries,
  getModeDifficultyParams,
} from '../adaptiveDifficultyService';
import { getDistractorMeanings } from '../quizDistractorEngine';
import { selectAdaptiveQuizItems } from '../adaptiveQuizService';
import type {
  VocabWord,
  MistakeRecord,
  RecentAnswerRecord,
  LearnerQuizContext,
} from '../../types';

function createMockVocab(partial: Partial<VocabWord> & { id: string; word: string; meaning: string }): VocabWord {
  return {
    ipa: '/test/',
    partOfSpeech: 'verb',
    example: 'This is a test sentence.',
    tag: 'Daily',
    srsLevel: 0,
    interval: 1,
    easeFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    ...partial,
  };
}

function createMockMistake(partial: Partial<MistakeRecord> & { id: string; word: string }): MistakeRecord {
  return {
    meaning: 'mock meaning',
    mistakeCount: 1,
    lastMistakeAt: new Date().toISOString(),
    consecutiveCorrect: 0,
    resolved: false,
    ...partial,
  };
}

describe('Phase 2 - Adaptive Difficulty Engine & Mode Adaptation Tests', () => {
  describe('1. Baseline CEFR & Tier Boundaries', () => {
    it('determines appropriate baseline tier from learner CEFR level', () => {
      expect(getBaselineTierFromCefr('A1')).toBe('easy');
      expect(getBaselineTierFromCefr('A2')).toBe('normal');
      expect(getBaselineTierFromCefr('B1')).toBe('normal');
      expect(getBaselineTierFromCefr('B2')).toBe('hard');
      expect(getBaselineTierFromCefr('C1')).toBe('advanced');
      expect(getBaselineTierFromCefr('C2')).toBe('advanced');
      expect(getBaselineTierFromCefr(null)).toBe('normal');
      expect(getBaselineTierFromCefr(undefined)).toBe('normal');
    });

    it('enforces CEFR boundaries to prevent unreasonable difficulty extremes', () => {
      // A1 learner: capped between Easy (0) and Normal (1)
      const a1Bounds = getCefrTierBoundaries('A1');
      expect(a1Bounds.minTierIndex).toBe(0);
      expect(a1Bounds.maxTierIndex).toBe(1);

      // B1 learner: capped between Easy (0) and Hard (2), cannot jump to Advanced (3)
      const b1Bounds = getCefrTierBoundaries('B1');
      expect(b1Bounds.minTierIndex).toBe(0);
      expect(b1Bounds.maxTierIndex).toBe(2);

      // C1 learner: minimum Normal (1) to Advanced (3)
      const c1Bounds = getCefrTierBoundaries('C1');
      expect(c1Bounds.minTierIndex).toBe(1);
      expect(c1Bounds.maxTierIndex).toBe(3);
    });
  });

  describe('2. Minimum Evidence Guard', () => {
    it('preserves current tier with 0 answers (safe default state)', () => {
      const evalResult = evaluateAdaptiveDifficulty({
        currentTier: 'normal',
        recentAnswers: [],
        consecutiveStreak: 0,
      });

      expect(evalResult.tier).toBe('normal');
      expect(evalResult.isTransitionApplied).toBe(false);
      expect(evalResult.transitionReason).toBe('no_samples_available');
      expect(evalResult.confidence).toBe(0.0);
    });

    it('refuses to alter difficulty after only 1 or 2 answers (minimum evidence requirement = 3)', () => {
      // 2 consecutive correct answers - not enough evidence to jump to hard
      const evalResult = evaluateAdaptiveDifficulty({
        currentTier: 'normal',
        recentAnswers: [{ isCorrect: true }, { isCorrect: true }],
        consecutiveStreak: 2,
      });

      expect(evalResult.tier).toBe('normal');
      expect(evalResult.isTransitionApplied).toBe(false);
      expect(evalResult.transitionReason).toBe('insufficient_evidence_for_shift');
      expect(evalResult.windowSizeObserved).toBe(2);
    });
  });

  describe('3. Sliding Window Accuracy & Hysteresis Transitions', () => {
    it('promotes tier when accuracy >= 85% and positive streak >= 2 with at least 3 samples', () => {
      const answers: RecentAnswerRecord[] = [
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
      ];

      const evalResult = evaluateAdaptiveDifficulty({
        currentTier: 'normal',
        recentAnswers: answers,
        consecutiveStreak: 4,
      });

      expect(evalResult.tier).toBe('hard');
      expect(evalResult.isTransitionApplied).toBe(true);
      expect(evalResult.accuracyInWindow).toBe(1.0);
      expect(evalResult.transitionReason).toBe('accuracy_above_threshold_with_streak');
    });

    it('demotes tier when accuracy <= 55% and negative streak <= -1 with at least 3 samples', () => {
      const answers: RecentAnswerRecord[] = [
        { isCorrect: false },
        { isCorrect: false },
        { isCorrect: true },
        { isCorrect: false },
      ];

      const evalResult = evaluateAdaptiveDifficulty({
        currentTier: 'normal',
        recentAnswers: answers,
        consecutiveStreak: -1,
      });

      expect(evalResult.tier).toBe('easy');
      expect(evalResult.isTransitionApplied).toBe(true);
      expect(evalResult.accuracyInWindow).toBe(0.25);
      expect(evalResult.transitionReason).toBe('accuracy_below_threshold_with_mistakes');
    });

    it('anti-oscillation invariant: alternating answers stay rock-solid without tier flapping', () => {
      // 8 alternating answers: 50% accuracy, streak 0 or 1
      const answers: RecentAnswerRecord[] = [
        { isCorrect: true },
        { isCorrect: false },
        { isCorrect: true },
        { isCorrect: false },
        { isCorrect: true },
        { isCorrect: false },
        { isCorrect: true },
        { isCorrect: false },
      ];

      const evalResult = evaluateAdaptiveDifficulty({
        currentTier: 'normal',
        recentAnswers: answers,
        consecutiveStreak: 0,
      });

      expect(evalResult.tier).toBe('normal');
      expect(evalResult.isTransitionApplied).toBe(false);
      expect(evalResult.accuracyInWindow).toBe(0.5);
      expect(evalResult.transitionReason).toBe('stable_within_hysteresis_band');
    });

    it('step-clamping invariant: never allows a jump of more than 1 tier in a single evaluation', () => {
      // 10 perfect answers while at easy tier -> should step to normal, NOT straight to hard or advanced
      const answers: RecentAnswerRecord[] = Array(10).fill({ isCorrect: true });

      const evalResult = evaluateAdaptiveDifficulty({
        currentTier: 'easy',
        recentAnswers: answers,
        consecutiveStreak: 10,
      });

      expect(evalResult.tier).toBe('normal');
      expect(evalResult.isTransitionApplied).toBe(true);
    });

    it('respects CEFR boundary clamping: A1 learner is NEVER promoted past Normal even with 100% accuracy', () => {
      const answers: RecentAnswerRecord[] = Array(8).fill({ isCorrect: true });

      const evalResult = evaluateAdaptiveDifficulty({
        currentTier: 'normal',
        learnerCefr: 'A1',
        recentAnswers: answers,
        consecutiveStreak: 8,
      });

      // Capped at Normal by getCefrTierBoundaries('A1') -> maxTierIndex 1 ('normal')
      expect(evalResult.tier).toBe('normal');
      expect(evalResult.isTransitionApplied).toBe(false);
    });

    it('respects sliding window size bounding (5 to 10 answers)', () => {
      const answers: RecentAnswerRecord[] = [
        { isCorrect: false },
        { isCorrect: false },
        { isCorrect: false },
        { isCorrect: false },
        { isCorrect: false },
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
      ];

      // With window size 5, only the last 5 answers (all true) are observed
      const evalResult = evaluateAdaptiveDifficulty({
        currentTier: 'normal',
        recentAnswers: answers,
        consecutiveStreak: 5,
        windowSize: 5,
      });

      expect(evalResult.windowSizeObserved).toBe(5);
      expect(evalResult.accuracyInWindow).toBe(1.0);
    });
  });

  describe('4. Mode-Specific Parameter Generation', () => {
    it('generates correct parameters for all 4 arcade modes in Easy tier', () => {
      const params = getModeDifficultyParams('easy');

      // Classic Quiz
      expect(params.classicQuiz.distractorCount).toBe(3);
      expect(params.classicQuiz.prioritizeConfusion).toBe(false);

      // Dictation
      expect(params.dictation.maskHintType).toBe('first_letter_and_length');
      expect(params.dictation.speechSpeed).toBe(0.8);

      // Word Scramble
      expect(params.wordScramble.distractorLettersCount).toBe(1);
      expect(params.wordScramble.revealFirstLetter).toBe(true);

      // Speed Match
      expect(params.speedMatch.timeLimitSeconds).toBe(75);
      expect(params.speedMatch.pairCount).toBe(5);
    });

    it('generates correct parameters for Normal tier', () => {
      const params = getModeDifficultyParams('normal');

      expect(params.dictation.maskHintType).toBe('word_length');
      expect(params.dictation.speechSpeed).toBe(0.85);
      expect(params.wordScramble.distractorLettersCount).toBe(2);
      expect(params.wordScramble.revealFirstLetter).toBe(false);
      expect(params.speedMatch.timeLimitSeconds).toBe(60);
      expect(params.speedMatch.pairCount).toBe(6);
    });

    it('generates correct parameters for Hard tier', () => {
      const params = getModeDifficultyParams('hard');

      expect(params.classicQuiz.prioritizeConfusion).toBe(true);
      expect(params.classicQuiz.prioritizeSamePos).toBe(true);
      expect(params.dictation.maskHintType).toBe('none');
      expect(params.dictation.speechSpeed).toBe(0.95);
      expect(params.wordScramble.distractorLettersCount).toBe(3);
      expect(params.wordScramble.revealFirstLetter).toBe(false);
      expect(params.speedMatch.timeLimitSeconds).toBe(50);
      expect(params.speedMatch.pairCount).toBe(6);
    });

    it('generates correct parameters for Advanced tier', () => {
      const params = getModeDifficultyParams('advanced');

      expect(params.dictation.speechSpeed).toBe(1.0);
      expect(params.wordScramble.distractorLettersCount).toBe(4);
      expect(params.speedMatch.timeLimitSeconds).toBe(45);
      expect(params.speedMatch.pairCount).toBe(6);
    });
  });

  describe('5. Distractor Engine - Personalized Confusion & Invariants', () => {
    const targetWord = createMockVocab({
      id: 'target_adapt',
      word: 'adapt',
      meaning: 'thích nghi, điều chỉnh',
      partOfSpeech: 'verb',
      level: 'B2',
      tag: 'Academic',
    });

    const primaryPool: VocabWord[] = [
      createMockVocab({ id: 'p1', word: 'adopt', meaning: 'nhận nuôi, thông qua', partOfSpeech: 'verb', level: 'B2', tag: 'Academic' }),
      createMockVocab({ id: 'p2', word: 'adept', meaning: 'tinh thông, lão luyện', partOfSpeech: 'adjective', level: 'C1', tag: 'Academic' }),
      createMockVocab({ id: 'p3', word: 'modify', meaning: 'sửa đổi, điều chỉnh nhỏ', partOfSpeech: 'verb', level: 'B2', tag: 'Academic' }),
      createMockVocab({ id: 'p4', word: 'evolve', meaning: 'tiến hóa, phát triển', partOfSpeech: 'verb', level: 'B2', tag: 'Academic' }),
    ];

    const secondaryPool: VocabWord[] = [
      createMockVocab({ id: 's1', word: 'concentrate', meaning: 'tập trung cao độ', partOfSpeech: 'verb', level: 'B1', tag: 'Academic' }),
    ];

    it('single-correct invariant: target meaning is never in distractors', () => {
      const distractors = getDistractorMeanings(targetWord, primaryPool, secondaryPool, 3, {
        difficultyTier: 'hard',
      });

      expect(distractors.length).toBe(3);
      expect(distractors).not.toContain('thích nghi, điều chỉnh');
      const uniqueSet = new Set(distractors);
      expect(uniqueSet.size).toBe(distractors.length);
    });

    it('priority 1: prioritizes personalized confusion from Mistake Bank', () => {
      const mistakeBank: Record<string, MistakeRecord> = {
        'target_adapt': createMockMistake({
          id: 'target_adapt',
          word: 'adapt',
          meaning: 'thích nghi, điều chỉnh',
          mistakeCount: 3,
          source: 'quiz',
          primaryType: 'meaning',
          lastUserAnswer: 'adopt', // user previously confused with adopt
          lastContext: 'adopt',
        }),
      };

      const distractors = getDistractorMeanings(targetWord, primaryPool, secondaryPool, 3, {
        mistakeBank,
        difficultyTier: 'hard',
      });

      // 'nhận nuôi, thông qua' (adopt) MUST be included because learner confused it in Mistake Bank
      expect(distractors).toContain('nhận nuôi, thông qua');
    });
  });

  describe('6. Leech Capping Protection in Adaptive Question Selection', () => {
    it('caps leeches at <= 50% of weak quota when non-leech weak candidates exist', () => {
      // Create 10 candidates: 5 leeches, 5 normal weak mistake words
      const candidates: VocabWord[] = [];
      const mistakeBank: Record<string, MistakeRecord> = {};
      const srsProgressMap: Record<string, any> = {};

      for (let i = 0; i < 5; i++) {
        const id = `leech_${i}`;
        candidates.push(
          createMockVocab({
            id,
            word: `leechword${i}`,
            meaning: `meaning leech ${i}`,
            tag: 'Daily',
          })
        );
        mistakeBank[id] = createMockMistake({
          id,
          word: `leechword${i}`,
          mistakeCount: 8,
          source: 'quiz',
          primaryType: 'spelling',
        });
        // Leech requires multi-factor evidence: lapses >= 4 + difficulty >= 8.5
        srsProgressMap[id] = {
          fsrs: { reps: 10, lapses: 6, difficulty: 9.0, stability: 1.5, state: 1 },
          reviewCount: 10,
          againCount: 6,
        };
      }

      for (let i = 0; i < 5; i++) {
        const id = `normal_weak_${i}`;
        candidates.push(
          createMockVocab({
            id,
            word: `weakword${i}`,
            meaning: `meaning weak ${i}`,
            tag: 'Daily',
          })
        );
        mistakeBank[id] = createMockMistake({
          id,
          word: `weakword${i}`,
          mistakeCount: 2, // low lapses -> normal weak
          source: 'quiz',
          primaryType: 'spelling',
        });
      }

      const learnerContext: LearnerQuizContext = {
        mistakeBank,
        srsProgressMap,
        wordLearningStats: {},
        recentWordIds: [],
      };

      const result = selectAdaptiveQuizItems(candidates, learnerContext, {
        count: 6,
        seed: 42,
      });

      // Weak quota is ~60% of 6 = 4 items
      // Leeches must not occupy all 4 items; non-leech weak words must also be included
      const selectedIds = result.items.map((w) => w.id);
      const leechCount = selectedIds.filter((id) => id?.startsWith('leech_')).length;
      const normalWeakCount = selectedIds.filter((id) => id?.startsWith('normal_weak_')).length;

      expect(leechCount).toBeLessThanOrEqual(3);
      expect(normalWeakCount).toBeGreaterThan(0);
    });
  });
});
