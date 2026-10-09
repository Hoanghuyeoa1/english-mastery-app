// src/services/__tests__/adaptiveSessionBuilder.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildAdaptiveLearningSession,
  SESSION_HARD_LIMITS,
} from '../adaptiveSessionBuilder';
import {
  MistakeRecord,
  AdaptiveMistakeProfile,
  SRSReviewCard,
} from '../../types';
import { processCardReview } from '../srsScheduler';
import { useAppStore } from '../../store/useAppStore';

describe('Phase 5: Adaptive Session Builder & FSRS Integration Safety', () => {
  const now = new Date('2026-10-04T12:00:00.000Z').getTime();

  beforeEach(() => {
    useAppStore.setState({
      activePracticeConfig: null,
      pendingNavigationTab: null,
      mistakeBank: {},
    });
  });

  const createMockMistake = (
    word: string,
    overrides: Partial<MistakeRecord> = {}
  ): MistakeRecord => ({
    id: word.toLowerCase(),
    word,
    meaning: `Nghĩa của ${word}`,
    mistakeCount: 3,
    lastMistakeAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // 2 giờ trước
    consecutiveCorrect: 0,
    resolved: false,
    source: 'classic_quiz',
    primaryType: 'meaning',
    typeCounts: { meaning: 3 },
    reopenCount: 0,
    ...overrides,
  });

  describe('1. Priority Scoring & Candidate Selection', () => {
    it('prioritizes reopened, chronic, and recent items over older, single-mistake items', () => {
      const bank: Record<string, MistakeRecord> = {
        item_normal: createMockMistake('normal', {
          mistakeCount: 1,
          lastMistakeAt: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 ngày trước
          reopenCount: 0,
        }),
        item_reopened: createMockMistake('reopened', {
          mistakeCount: 4,
          lastMistakeAt: new Date(now - 1 * 60 * 60 * 1000).toISOString(), // 1 giờ trước
          reopenCount: 2, // Reopened bonus +15
        }),
        item_chronic: createMockMistake('chronic', {
          mistakeCount: 6, // Chronic recurrence level
          lastMistakeAt: new Date(now - 30 * 60 * 1000).toISOString(),
          reopenCount: 1,
        }),
      };

      const session = buildAdaptiveLearningSession(bank, { maxItems: 2, now });

      expect(session.exercises.length).toBe(2);
      const topWords = session.exercises.map((e) => e.word);
      // chronic và reopened phải đứng trước normal
      expect(topWords).toContain('chronic');
      expect(topWords).toContain('reopened');
      expect(topWords).not.toContain('normal');
    });

    it('excludes resolved items by default unless includeResolved is set', () => {
      const bank: Record<string, MistakeRecord> = {
        item_resolved: createMockMistake('resolved', {
          resolved: true,
          mistakeCount: 5,
        }),
        item_active: createMockMistake('active', {
          resolved: false,
          mistakeCount: 2,
        }),
      };

      const defaultSession = buildAdaptiveLearningSession(bank, { now });
      expect(defaultSession.exercises.map((e) => e.word)).toEqual(['active']);

      const includeResolvedSession = buildAdaptiveLearningSession(bank, {
        includeResolved: true,
        now,
      });
      const words = includeResolvedSession.exercises.map((e) => e.word);
      expect(words).toContain('resolved');
      expect(words).toContain('active');
    });
  });

  describe('2. Session Limits & Hard Bounds', () => {
    it('respects hard bounds and does not exceed MAX_ITEMS or MAX_MINUTES', () => {
      const bank: Record<string, MistakeRecord> = {};
      for (let i = 1; i <= 30; i++) {
        bank[`word_${i}`] = createMockMistake(`word_${i}`, {
          mistakeCount: i,
        });
      }

      // Requesting 50 items should be capped at SESSION_HARD_LIMITS.MAX_ITEMS (15)
      const session = buildAdaptiveLearningSession(bank, { maxItems: 50, now });
      expect(session.exercises.length).toBe(SESSION_HARD_LIMITS.MAX_ITEMS);
      expect(session.totalExercises).toBe(SESSION_HARD_LIMITS.MAX_ITEMS);
      expect(session.estimatedMinutes).toBeLessThanOrEqual(SESSION_HARD_LIMITS.MAX_MINUTES);
    });

    it('enforces minimum item bound (MIN_ITEMS: 1)', () => {
      const bank: Record<string, MistakeRecord> = {
        item_1: createMockMistake('apple'),
        item_2: createMockMistake('banana'),
      };

      const session = buildAdaptiveLearningSession(bank, { maxItems: 0, now });
      expect(session.exercises.length).toBe(SESSION_HARD_LIMITS.MIN_ITEMS);
    });
  });

  describe('3. Empty & Low-Data Guard', () => {
    it('returns a safe empty session when mistake bank is empty', () => {
      const session = buildAdaptiveLearningSession({}, { now });

      expect(session.exercises).toEqual([]);
      expect(session.totalExercises).toBe(0);
      expect(session.estimatedMinutes).toBe(0);
      expect(session.focusWeakness).toBeNull();
      expect(session.hasInsufficientData).toBe(true);
    });

    it('flags hasInsufficientData: true when fewer than 2 mistake items exist', () => {
      const singleItemBank = {
        item_1: createMockMistake('solitary'),
      };

      const session = buildAdaptiveLearningSession(singleItemBank, { now });
      expect(session.exercises.length).toBe(1);
      expect(session.hasInsufficientData).toBe(true);
    });

    it('flags hasInsufficientData: false when 2 or more items exist', () => {
      const bank = {
        item_1: createMockMistake('first'),
        item_2: createMockMistake('second'),
      };

      const session = buildAdaptiveLearningSession(bank, { now });
      expect(session.exercises.length).toBe(2);
      expect(session.hasInsufficientData).toBe(false);
    });
  });

  describe('4. Deduplication Guarantee', () => {
    it('never includes duplicate items in the same session even with duplicate input entries', () => {
      const duplicates: MistakeRecord[] = [
        createMockMistake('repeat', { id: 'dup_1' }),
        createMockMistake('Repeat', { id: 'dup_2' }), // Same word case-insensitive
        createMockMistake('unique_one', { id: 'u1' }),
        createMockMistake('unique_two', { id: 'u2' }),
      ];

      const session = buildAdaptiveLearningSession(duplicates, { maxItems: 10, now });
      const targetWords = session.exercises.map((e) => e.word.toLowerCase());
      const uniqueWords = new Set(targetWords);

      expect(targetWords.length).toBe(uniqueWords.size);
      expect(targetWords.filter((w) => w === 'repeat').length).toBe(1);
    });
  });

  describe('5. Balanced Category Distribution (Round-Robin)', () => {
    it('interleaves different mistake types rather than filling 100% with one category', () => {
      const bank: Record<string, MistakeRecord> = {
        // 3 spelling mistakes
        sp_1: createMockMistake('accommodate', {
          primaryType: 'spelling',
          typeCounts: { spelling: 5 },
          mistakeCount: 5,
        }),
        sp_2: createMockMistake('embarrass', {
          primaryType: 'spelling',
          typeCounts: { spelling: 4 },
          mistakeCount: 4,
        }),
        sp_3: createMockMistake('necessary', {
          primaryType: 'spelling',
          typeCounts: { spelling: 3 },
          mistakeCount: 3,
        }),

        // 2 listening mistakes
        ls_1: createMockMistake('schedule', {
          primaryType: 'listening',
          typeCounts: { listening: 5 },
          mistakeCount: 5,
        }),
        ls_2: createMockMistake('thorough', {
          primaryType: 'listening',
          typeCounts: { listening: 3 },
          mistakeCount: 3,
        }),

        // 2 pronunciation mistakes
        pr_1: createMockMistake('colonel', {
          primaryType: 'pronunciation',
          typeCounts: { pronunciation: 4 },
          mistakeCount: 4,
        }),
        pr_2: createMockMistake('subtle', {
          primaryType: 'pronunciation',
          typeCounts: { pronunciation: 3 },
          mistakeCount: 3,
        }),
      };

      const session = buildAdaptiveLearningSession(bank, { maxItems: 6, now });

      expect(session.exercises.length).toBe(6);

      const typesInSession = session.exercises.map((e) => e.mistakeType);
      const uniqueTypes = new Set(typesInSession);

      // Phải có sự cân đối ít nhất 2 loại bài tập khác nhau trong session
      expect(uniqueTypes.size).toBeGreaterThanOrEqual(2);
      expect(session.focusWeakness).toBeDefined();
    });
  });

  describe('6. Immutability Guarantee', () => {
    it('does not mutate input mistake records during session building', () => {
      const originalRecord = Object.freeze(
        createMockMistake('immutable', {
          mistakeCount: 4,
          consecutiveCorrect: 1,
        })
      );

      const bank = { immutable: originalRecord };

      expect(() => {
        buildAdaptiveLearningSession(bank, { now });
      }).not.toThrow();

      expect(originalRecord.mistakeCount).toBe(4);
      expect(originalRecord.consecutiveCorrect).toBe(1);
    });
  });

  describe('7. Filtering by Type and Module', () => {
    it('filters exercises strictly when filterType is specified', () => {
      const bank: Record<string, MistakeRecord> = {
        spelling_item: createMockMistake('spell', {
          primaryType: 'spelling',
          typeCounts: { spelling: 3 },
        }),
        meaning_item: createMockMistake('mean', {
          primaryType: 'meaning',
          typeCounts: { meaning: 3 },
        }),
      };

      const session = buildAdaptiveLearningSession(bank, {
        filterType: 'spelling',
        now,
      });

      expect(session.exercises.length).toBe(1);
      expect(session.exercises[0].mistakeType).toBe('spelling');
    });
  });

  describe('8. FSRS & SM-2 Scheduling Integrity', () => {
    const mockFsrsCard: SRSReviewCard = {
      id: 'fsrs_card_1',
      type: 'single_word',
      primaryText: 'Magnanimous',
      meaning: 'Hào hiệp',
      exampleEn: 'He was magnanimous in defeat.',
      srsLevel: 3,
      interval: 10,
      easeFactor: 2.5,
      nextReviewDate: '2026-10-04T00:00:00.000Z',
      fsrs: {
        stability: 10.5,
        difficulty: 4.2,
        state: 2, // Review
        reps: 4,
        lapses: 1,
        lastReview: '2026-09-24T00:00:00.000Z',
      },
    };

    it('pure session building does not touch FSRS memory state', () => {
      const initialStability = mockFsrsCard.fsrs!.stability;
      const initialDifficulty = mockFsrsCard.fsrs!.difficulty;
      const initialLapses = mockFsrsCard.fsrs!.lapses;
      const initialState = mockFsrsCard.fsrs!.state;

      // Session builder chỉ đọc mistake bank
      const bank = {
        magnanimous: createMockMistake('magnanimous'),
      };
      buildAdaptiveLearningSession(bank, { now });

      // Thẻ FSRS phải giữ nguyên 100%
      expect(mockFsrsCard.fsrs!.stability).toBe(initialStability);
      expect(mockFsrsCard.fsrs!.difficulty).toBe(initialDifficulty);
      expect(mockFsrsCard.fsrs!.lapses).toBe(initialLapses);
      expect(mockFsrsCard.fsrs!.state).toBe(initialState);
    });

    it('FSRS scheduler transitions card to Relearning (state 3) on rating Again (0)', () => {
      const baseDate = new Date('2026-10-04T07:00:00.000Z');
      const result = processCardReview(
        mockFsrsCard,
        'again',
        { algorithm: 'fsrs', desiredRetention: 0.9 },
        baseDate
      );

      expect(result.algorithm).toBe('fsrs');
      // State 3 là Relearning trong FSRS-4.5
      expect(result.updatedFsrsState?.state).toBe(3);
      // Lapses tăng +1
      expect(result.updatedFsrsState?.lapses).toBe(mockFsrsCard.fsrs!.lapses + 1);
      // Interval rơi mạnh sau khi lapse (tính toán bởi FSRS-4.5)
      expect(result.intervalDays).toBeLessThan(mockFsrsCard.interval!);
      expect(result.intervalDays).toBeGreaterThanOrEqual(1);
    });

    it('SM-2 mode resets repetition to 0 on rating Again (0) without breaking easeFactor', () => {
      const baseDate = new Date('2026-10-04T07:00:00.000Z');
      const sm2Card: SRSReviewCard = {
        ...mockFsrsCard,
        fsrs: undefined,
        srsLevel: 4,
        interval: 16,
        easeFactor: 2.4,
      };

      const result = processCardReview(
        sm2Card,
        'again',
        { algorithm: 'sm2', desiredRetention: 0.9 },
        baseDate
      );

      expect(result.algorithm).toBe('sm2');
      expect(result.updatedSm2Progress?.srsLevel).toBe(0);
      expect(result.intervalDays).toBe(1);
      // SM-2 formula: EF remains valid (>= 1.3)
      expect(result.updatedSm2Progress?.easeFactor).toBeGreaterThanOrEqual(1.3);
    });
  });
});
