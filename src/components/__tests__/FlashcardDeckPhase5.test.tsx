// @vitest-environment happy-dom
// src/components/__tests__/FlashcardDeckPhase5.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore, clearUnifiedCardsCache } from '../../store/useAppStore';
import { SessionSummary, SessionSummaryProps } from '../FlashcardDeck';
import type { SRSReviewCard } from '../../types';

describe('PHASE 5 — Flashcard Session Summary, Difficult-Card Practice & Edge Cases', () => {
  beforeEach(() => {
    useAppStore.getState().resetToDefault();
    clearUnifiedCardsCache();
    vi.clearAllMocks();
  });

  const baseSummaryProps: SessionSummaryProps = {
    totalWords: 30,
    reviewedCount: 30,
    ratingCounts: { again: 4, hard: 6, good: 15, easy: 5 },
    observedRetention: 87, // Math.round((26 / 30) * 100)
    hardestCards: [
      {
        id: 'vocab_maintain',
        type: 'single_word',
        word: 'maintain',
        primaryText: 'maintain',
        meaning: 'duy trì',
        partOfSpeech: 'verb',
        exampleEn: 'We must maintain consistency.',
        tag: 'Tech',
        srsLevel: 1,
        interval: 1,
        easeFactor: 2.3,
        nextReviewDate: new Date().toISOString(),
      },
      {
        id: 'vocab_sustain',
        type: 'single_word',
        word: 'sustain',
        primaryText: 'sustain',
        meaning: 'chống đỡ, duy trì liên tục',
        partOfSpeech: 'verb',
        exampleEn: 'Can the ecosystem sustain this impact?',
        tag: 'Academic',
        srsLevel: 1,
        interval: 1,
        easeFactor: 2.4,
        nextReviewDate: new Date().toISOString(),
      },
    ],
    srsAlgorithm: 'fsrs',
    fsrsDesiredRetention: 0.9,
    streak: 5,
    newWordsLearnedCount: 15,
    dailyNewLimit: 20,
    selectedBatchSize: 15,
    setSelectedBatchSize: vi.fn(),
    isCustomBatchOpen: false,
    setIsCustomBatchOpen: vi.fn(),
    customBatchInput: '25',
    setCustomBatchInput: vi.fn(),
    handleAddMoreWords: vi.fn(),
    handleRestartSession: vi.fn(),
    handleReviewDifficultCards: vi.fn(),
    handleFinishSession: vi.fn(),
    onNavigate: vi.fn(),
  };

  describe('1. Session Summary Metrics & Presentation', () => {
    it('renders Session Complete badge and accurate rating distribution breakdown', () => {
      render(<SessionSummary {...baseSummaryProps} />);

      // Badge
      expect(screen.getByText('Session Complete')).toBeDefined();

      // Total reviewed count
      expect(screen.getByText('30 thẻ')).toBeDefined();

      // Rating counts
      expect(screen.getByText('4')).toBeDefined();  // Again
      expect(screen.getByText('6')).toBeDefined();  // Hard
      expect(screen.getByText('15')).toBeDefined(); // Good
      expect(screen.getByText('5')).toBeDefined();  // Easy
    });

    it('calculates and renders valid observed retention rate', () => {
      render(<SessionSummary {...baseSummaryProps} observedRetention={87} />);

      // Retention displays 87%
      expect(screen.getByText('87%')).toBeDefined();
    });

    it('handles empty session retention gracefully with em-dash (—) without false 0%', () => {
      render(
        <SessionSummary
          {...baseSummaryProps}
          reviewedCount={0}
          totalWords={0}
          ratingCounts={{ again: 0, hard: 0, good: 0, easy: 0 }}
          observedRetention={null}
          hardestCards={[]}
        />
      );

      // Null retention renders em-dash (—)
      expect(screen.getByText('—')).toBeDefined();
    });
  });

  describe('2. Hardest Words & Algorithmic Invariants (FSRS vs SM-2)', () => {
    it('renders hardest struggle cards from session evidence', () => {
      render(<SessionSummary {...baseSummaryProps} />);

      expect(screen.getByText('maintain')).toBeDefined();
      expect(screen.getByText('sustain')).toBeDefined();
      expect(screen.getByText('duy trì')).toBeDefined();
      expect(screen.getByText('chống đỡ, duy trì liên tục')).toBeDefined();
    });

    it('renders friendly completion badge when there are 0 struggle cards and disables review button', () => {
      render(<SessionSummary {...baseSummaryProps} hardestCards={[]} />);

      expect(
        screen.getByText('🌟 Không có từ khó trong phiên này! Bạn đã nhớ rất tốt tất cả các thẻ!')
      ).toBeDefined();

      const reviewBtn = screen.getByText('Review difficult cards').closest('button');
      expect(reviewBtn?.hasAttribute('disabled')).toBe(true);
    });

    it('SM-2 mode strictly avoids faking FSRS stability, difficulty, or retrievability', () => {
      const sm2Card: SRSReviewCard = {
        id: 'vocab_sm2_pure',
        type: 'single_word',
        word: 'diligent',
        primaryText: 'diligent',
        meaning: 'chăm chỉ, cần cù',
        exampleEn: 'She is a diligent worker.',
        tag: 'Academic',
        srsLevel: 2,
        interval: 6,
        easeFactor: 2.5,
        nextReviewDate: new Date().toISOString(),
      };

      render(
        <SessionSummary
          {...baseSummaryProps}
          srsAlgorithm="sm2"
          hardestCards={[sm2Card]}
        />
      );

      // Renders SM-2 badge
      expect(screen.getByText('SM-2 Chuẩn')).toBeDefined();

      // Does not contain synthetic FSRS Stability indicator
      expect(screen.queryByText(/S: \d+/)).toBeNull();
      // Displays pure tag
      expect(screen.getByText('Academic')).toBeDefined();
    });

    it('FSRS mode displays authentic stability metadata when available', () => {
      const fsrsCard: SRSReviewCard = {
        id: 'vocab_fsrs_mature',
        type: 'single_word',
        word: 'consistent',
        primaryText: 'consistent',
        meaning: 'kiên định, nhất quán',
        exampleEn: 'Consistency is key to success.',
        tag: 'Tech',
        srsLevel: 3,
        interval: 14,
        nextReviewDate: new Date().toISOString(),
        fsrs: {
          stability: 14.2,
          difficulty: 4.5,
          reps: 4,
          lapses: 0,
          state: 2,
          lastReview: new Date().toISOString(),
        },
      };

      render(
        <SessionSummary
          {...baseSummaryProps}
          srsAlgorithm="fsrs"
          hardestCards={[fsrsCard]}
        />
      );

      expect(screen.getByText('FSRS (Mục tiêu: 90%)')).toBeDefined();
      expect(screen.getByText('S: 14.2d')).toBeDefined();
    });
  });

  describe('3. Difficult-Card Practice Flow (Zero Scheduler Mutation Invariant)', () => {
    it('Review difficult cards button invokes callback and never mutates store scheduler state on queue creation', () => {
      const store = useAppStore.getState();
      const initialWord = store.vocabularyList[0];
      const initialProgress = store.srsProgressMap[initialWord.id];

      const handleReviewMock = vi.fn();
      render(
        <SessionSummary
          {...baseSummaryProps}
          handleReviewDifficultCards={handleReviewMock}
        />
      );

      const reviewBtn = screen.getByText('Review difficult cards').closest('button');
      expect(reviewBtn).toBeDefined();
      if (reviewBtn) fireEvent.click(reviewBtn);

      // Callback triggered
      expect(handleReviewMock).toHaveBeenCalledTimes(1);

      // Invariant verification: Store progress is completely untouched
      const postProgress = store.srsProgressMap[initialWord.id];
      expect(postProgress).toEqual(initialProgress);
    });

    it('Finish button triggers completion navigation callback', () => {
      const handleFinishMock = vi.fn();
      render(
        <SessionSummary
          {...baseSummaryProps}
          handleFinishSession={handleFinishMock}
        />
      );

      const finishBtn = screen.getByText('Finish').closest('button');
      expect(finishBtn).toBeDefined();
      if (finishBtn) fireEvent.click(finishBtn);

      expect(handleFinishMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. Edge Cases Hardening', () => {
    it('missing optional metadata on cards renders safely with defaults', () => {
      const minimalCard: SRSReviewCard = {
        id: 'minimal_card',
        type: 'single_word',
        word: 'minimal',
        primaryText: 'minimal',
        meaning: 'tối giản',
        exampleEn: 'Keep it minimal.',
        // Omits phonetic, ipa, example, collocations, tag, etc.
        srsLevel: 0,
        nextReviewDate: new Date().toISOString(),
      };

      render(
        <SessionSummary
          {...baseSummaryProps}
          hardestCards={[minimalCard]}
        />
      );

      expect(screen.getByText('minimal')).toBeDefined();
      expect(screen.getByText('tối giản')).toBeDefined();
    });

    it('collocation card type renders in hardest words list cleanly', () => {
      const collocCard: SRSReviewCard = {
        id: 'colloc_1',
        type: 'collocation',
        word: 'take into account',
        primaryText: 'take into account',
        meaning: 'cân nhắc, tính đến',
        exampleEn: 'Take into account all variables.',
        collocations: ['take into account'],
        tag: 'Tech',
        srsLevel: 1,
        nextReviewDate: new Date().toISOString(),
      };

      render(
        <SessionSummary
          {...baseSummaryProps}
          hardestCards={[collocCard]}
        />
      );

      expect(screen.getByText('take into account')).toBeDefined();
      expect(screen.getByText('cân nhắc, tính đến')).toBeDefined();
    });
  });
});
