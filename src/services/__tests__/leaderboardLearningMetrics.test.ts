import { describe, it, expect } from 'vitest';
import {
  isFsrsCardMastered,
  isSm2CardMastered,
  isCardMastered,
  getCanonicalLemmaKey,
  deriveLifetimeVocabularyMastery,
  deriveWeeklyMasteryTransitions,
  deriveReviewConsistency,
  deriveWeeklyLearningMetrics,
  getVietnamDateString,
} from '../leaderboardLearningMetrics';
import type {
  SRSProgress,
  SRSReviewEvent,
  DailyProgress,
  CollocationItem,
  FSRSMemoryState,
} from '../../types';

// ============================================================================
// TYPE-SAFE MOCK HELPERS
// ============================================================================

function mockFsrs(overrides: Partial<FSRSMemoryState> = {}): FSRSMemoryState {
  return {
    stability: 25.0,
    difficulty: 4.0,
    state: 2,
    reps: 3,
    lapses: 0,
    lastReview: new Date().toISOString(),
    ...overrides,
  };
}

function mockProgress(overrides: Partial<SRSProgress> = {}): SRSProgress {
  return {
    srsLevel: 1,
    interval: 1,
    easeFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    ...overrides,
  };
}

function mockDaily(date: string, wordsReviewed: number): DailyProgress {
  return {
    date,
    wordsReviewed,
    newWordsLearned: 5,
    quizzesCompleted: 1,
    pronunciationsMastered: 0,
    xpGained: 50,
  };
}

describe('leaderboardLearningMetrics (Phase 2 Metric Engine)', () => {
  // ==========================================================================
  // 1. VOCABULARY MASTERY: FSRS EVALUATION
  // ==========================================================================
  describe('1. Vocabulary Mastery - FSRS Rules', () => {
    it('FSRS valid mastery: state=2 (Review), stability >= 21.0, reps >= 2', () => {
      const fsrsMastered = mockFsrs({
        stability: 25.4,
        difficulty: 4.2,
        state: 2, // Review
        reps: 3,
        lapses: 0,
      });

      expect(isFsrsCardMastered(fsrsMastered)).toBe(true);
    });

    it('FSRS insufficient stability: stability < 21.0 days is NOT mastered', () => {
      const fsrsLowStability = mockFsrs({
        stability: 18.5,
        difficulty: 5.0,
        state: 2,
        reps: 4,
        lapses: 0,
      });

      expect(isFsrsCardMastered(fsrsLowStability)).toBe(false);
    });

    it('FSRS single Easy on new card: reps < 2 is NOT mastered despite initial stability', () => {
      // First Easy on a new card gives initial stability ~13.82, but even if stability were 22.0,
      // reps < 2 prevents single-click false mastery claim.
      const fsrsSingleEasy = mockFsrs({
        stability: 22.0,
        difficulty: 3.0,
        state: 2,
        reps: 1, // Only 1 review
        lapses: 0,
      });

      expect(isFsrsCardMastered(fsrsSingleEasy)).toBe(false);
    });

    it('FSRS initial learning states excluded: State 0 (New) and State 1 (Learning) are NOT mastered', () => {
      const newState = mockFsrs({
        stability: 30.0,
        difficulty: 5.0,
        state: 0, // New
        reps: 0,
      });
      const learningState = mockFsrs({
        stability: 30.0,
        difficulty: 5.0,
        state: 1, // Learning
        reps: 2,
      });

      expect(isFsrsCardMastered(newState)).toBe(false);
      expect(isFsrsCardMastered(learningState)).toBe(false);
    });

    it('FSRS Relearning excluded: State 3 (Relearning) is strictly NOT mastered even if stability was high', () => {
      const relearningState = mockFsrs({
        stability: 35.0, // Historical stability was high
        difficulty: 7.2,
        state: 3, // Relearning after a lapse!
        reps: 5,
        lapses: 1,
      });

      expect(isFsrsCardMastered(relearningState)).toBe(false);
    });

    it('handles null / undefined / corrupted FSRS state gracefully without throwing', () => {
      expect(isFsrsCardMastered(null)).toBe(false);
      expect(isFsrsCardMastered(undefined)).toBe(false);
      expect(isFsrsCardMastered({} as any)).toBe(false);
      expect(isFsrsCardMastered({ state: 2 } as any)).toBe(false);
    });
  });

  // ==========================================================================
  // 2. VOCABULARY MASTERY: SM-2 EVALUATION & SEMANTIC ISOLATION
  // ==========================================================================
  describe('2. Vocabulary Mastery - SM-2 Rules & Semantic Isolation', () => {
    it('SM-2 valid mastery via srsLevel >= 5 with verified study history', () => {
      const sm2Progress = mockProgress({
        srsLevel: 5,
        interval: 18,
        reviewCount: 5,
        lastReviewedDate: '2026-10-01T08:00:00Z',
      });

      expect(isSm2CardMastered(sm2Progress)).toBe(true);
    });

    it('SM-2 valid mastery via interval >= 21 days with verified study history', () => {
      const sm2Progress = mockProgress({
        srsLevel: 3,
        interval: 25,
        firstLearnedAt: '2026-09-10T08:00:00Z',
        lastReviewedDate: '2026-10-01T08:00:00Z',
      });

      expect(isSm2CardMastered(sm2Progress)).toBe(true);
    });

    it('SM-2 insufficient progress: srsLevel < 5 AND interval < 21 is NOT mastered', () => {
      const sm2Early = mockProgress({
        srsLevel: 4,
        interval: 14,
        reviewCount: 4,
        lastReviewedDate: '2026-10-01T08:00:00Z',
      });

      expect(isSm2CardMastered(sm2Early)).toBe(false);
    });

    it('SM-2 unstudied / fake card: high level but zero review evidence is NOT mastered', () => {
      const unstudiedFake = mockProgress({
        srsLevel: 6,
        interval: 30,
        reviewCount: 0,
        // No firstLearnedAt and no lastReviewedDate
      });

      expect(isSm2CardMastered(unstudiedFake)).toBe(false);
    });

    it('SM-2 Semantic Isolation: Never inspects or fabricates FSRS stability/retrievability', () => {
      const pureSm2Card = mockProgress({
        srsLevel: 5,
        interval: 28,
        reviewCount: 6,
        lastReviewedDate: '2026-10-01T08:00:00Z',
      });

      // Ensure evaluation succeeds without any FSRS fields present
      expect(isSm2CardMastered(pureSm2Card)).toBe(true);
      expect((pureSm2Card as any).stability).toBeUndefined();
      expect((pureSm2Card as any).retrievability).toBeUndefined();
    });

    it('Unified isCardMastered respects algorithmPreference', () => {
      const hybridCard = {
        id: 'hybrid_1',
        word: 'persist',
        srsLevel: 5,
        interval: 30,
        reviewCount: 5,
        easeFactor: 2.5,
        nextReviewDate: '2026-10-25T00:00:00Z',
        lastReviewedDate: '2026-10-01T08:00:00Z',
        fsrs: mockFsrs({
          stability: 10.0, // FSRS not yet 21 days
          difficulty: 5.0,
          state: 2,
          reps: 2,
          lapses: 0,
        }),
      };

      // With FSRS preference (default when fsrs exists): false because stability 10 < 21
      expect(isCardMastered(hybridCard, 'fsrs')).toBe(false);
      // With explicit SM-2 preference: true because srsLevel = 5, interval = 30
      expect(isCardMastered(hybridCard, 'sm2')).toBe(true);
    });
  });

  // ==========================================================================
  // 3. CANONICAL DEDUPLICATION
  // ==========================================================================
  describe('3. Canonical Deduplication (Lemma Resolution)', () => {
    it('deduplicates persistence prefixes (vocab_, ext_, custom_, colloc_)', () => {
      expect(getCanonicalLemmaKey('vocab_technology')).toBe('technology');
      expect(getCanonicalLemmaKey('ext_technology')).toBe('technology');
      expect(getCanonicalLemmaKey('custom_technology')).toBe('technology');
      expect(getCanonicalLemmaKey('technology')).toBe('technology');
    });

    it('deduplicates morphological inflection variants to canonical root lemma', () => {
      expect(getCanonicalLemmaKey('running')).toBe('run');
      expect(getCanonicalLemmaKey('runs')).toBe('run');
      expect(getCanonicalLemmaKey('ran')).toBe('run');
      expect(getCanonicalLemmaKey('studied')).toBe('study');
      expect(getCanonicalLemmaKey('studies')).toBe('study');
      expect(getCanonicalLemmaKey('working')).toBe('work');
      expect(getCanonicalLemmaKey('worked')).toBe('work');
    });

    it('preserves multi-word collocations and phrasal items with spaces', () => {
      expect(getCanonicalLemmaKey('pay attention')).toBe('pay attention');
      expect(getCanonicalLemmaKey('take into account')).toBe('take into account');
    });

    it('cleans leading/trailing punctuation and casing', () => {
      expect(getCanonicalLemmaKey('"(Running)!"')).toBe('run');
      expect(getCanonicalLemmaKey('  TECHNOLOGY  ')).toBe('technology');
    });

    it('handles empty or malformed inputs safely', () => {
      expect(getCanonicalLemmaKey('')).toBe('');
      expect(getCanonicalLemmaKey('   ')).toBe('');
      expect(getCanonicalLemmaKey(null as any)).toBe('');
      expect(getCanonicalLemmaKey(undefined as any)).toBe('');
    });
  });

  // ==========================================================================
  // 4. LIFETIME VOCABULARY MASTERY DERIVATION
  // ==========================================================================
  describe('4. Lifetime Vocabulary Mastery Derivation', () => {
    it('deduplicates multiple cards with different inflection forms into a single canonical lemma', () => {
      const srsProgressMap: Record<string, SRSProgress> = {
        'vocab_running': mockProgress({
          srsLevel: 5,
          interval: 25,
          reviewCount: 5,
          lastReviewedDate: '2026-10-01T00:00:00Z',
          fsrs: mockFsrs({
            state: 2,
            stability: 25.0,
            reps: 3,
            difficulty: 4.0,
            lapses: 0,
          }),
        }),
        'vocab_runs': mockProgress({
          srsLevel: 5,
          interval: 28,
          reviewCount: 6,
          lastReviewedDate: '2026-10-01T00:00:00Z',
          fsrs: mockFsrs({
            state: 2,
            stability: 28.0,
            reps: 4,
            difficulty: 3.5,
            lapses: 0,
          }),
        }),
        'run': mockProgress({
          srsLevel: 5,
          interval: 30,
          reviewCount: 7,
          lastReviewedDate: '2026-10-01T00:00:00Z',
          fsrs: mockFsrs({
            state: 2,
            stability: 30.0,
            reps: 5,
            difficulty: 3.0,
            lapses: 0,
          }),
        }),
      };

      const result = deriveLifetimeVocabularyMastery({ srsProgressMap });

      // Even though 3 cards are mastered, they all collapse to the single canonical lemma 'run'
      expect(result.totalMasteredCount).toBe(1);
      expect(result.uniqueCanonicalLemmas).toEqual(['run']);
      expect(result.supportingEvidenceCount).toBe(3);
      expect(result.byAlgorithm.fsrs).toBe(1);
    });

    it('correctly incorporates mastered user collocations', () => {
      const srsProgressMap: Record<string, SRSProgress> = {
        'colloc_pay_attention': mockProgress({
          srsLevel: 5,
          interval: 25,
          reviewCount: 4,
          lastReviewedDate: '2026-10-01T00:00:00Z',
        }),
      };

      const userCollocations: CollocationItem[] = [
        {
          id: 'colloc_pay_attention',
          phrase: 'pay attention',
          meaning: 'chú ý',
          exampleEn: 'Pay attention to the rules',
          exampleVi: 'Chú ý vào các quy tắc',
          createdAt: '2026-09-01T00:00:00Z',
        },
      ];

      const result = deriveLifetimeVocabularyMastery({
        srsProgressMap,
        userCollocations,
      });

      expect(result.totalMasteredCount).toBe(1);
      expect(result.uniqueCanonicalLemmas).toContain('pay attention');
      expect(result.byAlgorithm.sm2).toBe(1);
    });

    it('does not count unmastered cards towards totalMasteredCount', () => {
      const srsProgressMap: Record<string, SRSProgress> = {
        'card_mastered': mockProgress({
          srsLevel: 5,
          interval: 25,
          reviewCount: 3,
          lastReviewedDate: '2026-10-01T00:00:00Z',
        }),
        'card_unmastered': mockProgress({
          srsLevel: 1,
          interval: 1,
          reviewCount: 1,
          lastReviewedDate: '2026-10-01T00:00:00Z',
        }),
      };

      const result = deriveLifetimeVocabularyMastery({ srsProgressMap });
      expect(result.totalMasteredCount).toBe(1);
    });
  });

  // ==========================================================================
  // 5. WEEKLY MASTERY TRANSITIONS
  // ==========================================================================
  describe('5. Weekly Mastery Transitions', () => {
    const weekStart = new Date('2026-10-05T00:00:00+07:00'); // Monday 00:00 VN
    const weekEnd = new Date('2026-10-12T00:00:00+07:00');   // Next Monday 00:00 VN

    it('detects genuine not-mastered -> mastered transitions during current week', () => {
      const reviewEvents: SRSReviewEvent[] = [
        {
          id: 'rev_1',
          cardId: 'technology',
          rating: 'good',
          grade: 2,
          algorithm: 'fsrs',
          timestamp: '2026-10-06T10:00:00+07:00', // Inside week
          stateBefore: 'learning',
          stateAfter: 'review',
          interval: 25,
          stability: 25.0, // >= 21.0
        },
      ];

      const result = deriveWeeklyMasteryTransitions(
        {},
        reviewEvents,
        weekStart,
        weekEnd
      );

      expect(result.newlyMasteredCount).toBe(1);
      expect(result.transitions[0].canonicalLemma).toBe('technology');
      expect(result.transitions[0].algorithm).toBe('fsrs');
    });

    it('excludes cards that were ALREADY mastered prior to week start', () => {
      const reviewEvents: SRSReviewEvent[] = [
        // Event before week start establishes pre-existing mastery
        {
          id: 'rev_prior',
          cardId: 'persist',
          rating: 'good',
          grade: 2,
          algorithm: 'fsrs',
          timestamp: '2026-10-02T10:00:00+07:00', // Prior week
          stateBefore: 'learning',
          stateAfter: 'review',
          interval: 25,
          stability: 26.0,
        },
        // Review event inside current week for the already mastered card
        {
          id: 'rev_in_week',
          cardId: 'persist',
          rating: 'easy',
          grade: 3,
          algorithm: 'fsrs',
          timestamp: '2026-10-06T10:00:00+07:00', // Inside current week
          stateBefore: 'review',
          stateAfter: 'review',
          interval: 40,
          stability: 35.0,
        },
      ];

      const result = deriveWeeklyMasteryTransitions(
        {},
        reviewEvents,
        weekStart,
        weekEnd
      );

      // Must be 0 because card was already mastered before current week started
      expect(result.newlyMasteredCount).toBe(0);
      expect(result.transitions).toHaveLength(0);
    });

    it('idempotency per lemma: multiple reviews of the same word within week produce only 1 transition', () => {
      const reviewEvents: SRSReviewEvent[] = [
        {
          id: 'rev_1',
          cardId: 'innovate',
          rating: 'good',
          grade: 2,
          algorithm: 'fsrs',
          timestamp: '2026-10-06T10:00:00+07:00',
          stateBefore: 'learning',
          stateAfter: 'review',
          interval: 22,
          stability: 22.0,
        },
        {
          id: 'rev_2',
          cardId: 'innovate',
          rating: 'good',
          grade: 2,
          algorithm: 'fsrs',
          timestamp: '2026-10-08T10:00:00+07:00',
          stateBefore: 'review',
          stateAfter: 'review',
          interval: 28,
          stability: 28.0,
        },
      ];

      const result = deriveWeeklyMasteryTransitions(
        {},
        reviewEvents,
        weekStart,
        weekEnd
      );

      expect(result.newlyMasteredCount).toBe(1);
      expect(result.transitions).toHaveLength(1);
    });

    it('ring-buffer truncation resilience: detects mastered card with lastReviewedDate in week even if events cleared', () => {
      const srsProgressMap: Record<string, SRSProgress> = {
        'vocab_truncate_test': mockProgress({
          srsLevel: 5,
          interval: 25,
          reviewCount: 3,
          lastReviewedDate: '2026-10-07T12:00:00+07:00', // Inside week
          fsrs: mockFsrs({
            state: 2,
            stability: 24.0,
            reps: 3,
            difficulty: 4.0,
            lapses: 0,
            lastReview: '2026-10-07T12:00:00+07:00',
          }),
        }),
      };

      // Empty recentReviewEvents buffer
      const result = deriveWeeklyMasteryTransitions(
        srsProgressMap,
        [],
        weekStart,
        weekEnd
      );

      expect(result.newlyMasteredCount).toBe(1);
      expect(result.transitions[0].canonicalLemma).toBe('truncate test');
    });
  });

  // ==========================================================================
  // 6. REVIEW CONSISTENCY DERIVATION
  // ==========================================================================
  describe('6. Review Consistency Derivation', () => {
    const refDate = new Date('2026-10-08T12:00:00+07:00'); // Thursday VN

    it('100% perfect week: learner completed all scheduled reviews on all eligible days', () => {
      // 7 days in week, each has 10 reviews expected and 10 completed
      const dailyHistory: Record<string, DailyProgress> = {
        '2026-10-05': mockDaily('2026-10-05', 10),
        '2026-10-06': mockDaily('2026-10-06', 10),
        '2026-10-07': mockDaily('2026-10-07', 10),
        '2026-10-08': mockDaily('2026-10-08', 10),
        '2026-10-09': mockDaily('2026-10-09', 10),
        '2026-10-10': mockDaily('2026-10-10', 10),
        '2026-10-11': mockDaily('2026-10-11', 10),
      };

      const result = deriveReviewConsistency({ dailyHistory, refDate });

      expect(result.consistencyScore).toBe(100);
      expect(result.consistencyRatio).toBe(1.0);
      expect(result.eligibleReviewDays).toBe(7);
      expect(result.completedReviewDays).toBe(7);
      expect(result.isEligibleForRanking).toBe(true);
    });

    it('partial completion: learner completed half of expected due workload', () => {
      // 4 days with expected 20, completed only 10 (dayRatio 0.5 each)
      const dailyHistory: Record<string, DailyProgress> = {
        '2026-10-05': mockDaily('2026-10-05', 10),
        '2026-10-06': mockDaily('2026-10-06', 10),
        '2026-10-07': mockDaily('2026-10-07', 10),
        '2026-10-08': mockDaily('2026-10-08', 10),
      };

      // 10 overdue cards remaining each day, making expectedDue = 20
      const srsProgressMap: Record<string, SRSProgress> = {};
      for (let i = 0; i < 10; i++) {
        srsProgressMap[`overdue_${i}`] = mockProgress({
          srsLevel: 2,
          interval: 2,
          nextReviewDate: '2026-10-04T00:00:00+07:00', // Overdue since Oct 4
        });
      }

      const result = deriveReviewConsistency({
        dailyHistory,
        srsProgressMap,
        refDate,
      });

      // Days with 10 completed out of 20 expected -> 0.5 ratio
      expect(result.consistencyScore).toBe(50);
      expect(result.consistencyRatio).toBe(0.5);
      expect(result.isEligibleForRanking).toBe(true);
    });

    it('No-Due Day Fairness: days with 0 expected and 0 completed are excluded from denominator', () => {
      // User studied on 3 days (10/10 each), and 4 days had 0 scheduled cards
      const dailyHistory: Record<string, DailyProgress> = {
        '2026-10-05': mockDaily('2026-10-05', 10),
        '2026-10-06': mockDaily('2026-10-06', 10),
        '2026-10-07': mockDaily('2026-10-07', 10),
      };

      const result = deriveReviewConsistency({ dailyHistory, refDate });

      // 3 eligible days out of 7, all 3 completed at 100% -> score 100
      expect(result.eligibleReviewDays).toBe(3);
      expect(result.completedReviewDays).toBe(3);
      expect(result.consistencyScore).toBe(100);
      expect(result.isEligibleForRanking).toBe(true);
    });

    it('Zero-activity / Dormant learner: 0 eligible days receives score 0 and is NOT eligible for ranking', () => {
      // Account with no reviews and no due cards all week
      const result = deriveReviewConsistency({
        dailyHistory: {},
        srsProgressMap: {},
        refDate,
      });

      // Must NOT receive 100% free score!
      expect(result.consistencyScore).toBe(0);
      expect(result.consistencyRatio).toBe(0);
      expect(result.eligibleReviewDays).toBe(0);
      expect(result.isEligibleForRanking).toBe(false);
    });

    it('Heavy-Day Chunking: massive backlog >= 40 is capped to actionable daily chunk budget (60 cards)', () => {
      // 120 cards overdue
      const srsProgressMap: Record<string, SRSProgress> = {};
      for (let i = 0; i < 120; i++) {
        srsProgressMap[`backlog_${i}`] = mockProgress({
          srsLevel: 2,
          interval: 2,
          nextReviewDate: '2026-10-01T00:00:00+07:00',
        });
      }

      // Learner tackles 60 cards today (2 full chunks of 30)
      const dailyHistory: Record<string, DailyProgress> = {
        '2026-10-05': mockDaily('2026-10-05', 60),
      };

      const result = deriveReviewConsistency({
        dailyHistory,
        srsProgressMap,
        refDate,
      });

      const day5 = result.dayBreakdowns.find((d) => d.date === '2026-10-05');
      expect(day5).toBeDefined();
      expect(day5?.isHeavyDay).toBe(true);
      // Denominator capped to 60 rather than penalizing against 120
      expect(day5?.expectedDue).toBe(60);
      expect(day5?.dayRatio).toBe(1.0);
      expect(day5?.isCompleted).toBe(true);
    });

    it('Non-scheduled drills and reinforcements do NOT inflate scheduled review completions', () => {
      const recentReviewEvents: SRSReviewEvent[] = [
        // 1 official scheduled review
        {
          id: 'rev_official',
          cardId: 'card_official',
          rating: 'good',
          grade: 2,
          algorithm: 'fsrs',
          timestamp: '2026-10-05T08:00:00+07:00',
          stateBefore: 'review',
          stateAfter: 'review',
          interval: 5,
        },
        // Reinforcement drill marked with isReinforcement
        {
          id: 'rev_reinf',
          cardId: 'card_reinf',
          rating: 'good',
          grade: 2,
          algorithm: 'fsrs',
          timestamp: '2026-10-05T09:00:00+07:00',
          stateBefore: 'review',
          stateAfter: 'review',
          interval: 5,
          ...({ isReinforcement: true } as any),
        },
        // Cramming / drill marked in stateBefore
        {
          id: 'rev_cram',
          cardId: 'card_cram',
          rating: 'good',
          grade: 2,
          algorithm: 'fsrs',
          timestamp: '2026-10-05T10:00:00+07:00',
          stateBefore: 'cramming' as any,
          stateAfter: 'review',
          interval: 5,
        },
        // Initial study of brand new card
        {
          id: 'rev_new',
          cardId: 'card_new',
          rating: 'good',
          grade: 2,
          algorithm: 'fsrs',
          timestamp: '2026-10-05T11:00:00+07:00',
          stateBefore: 'new',
          stateAfter: 'learning',
          interval: 1,
        },
      ];

      const result = deriveReviewConsistency({
        recentReviewEvents,
        refDate,
      });

      const day5 = result.dayBreakdowns.find((d) => d.date === '2026-10-05');
      // Only 1 event is official scheduled review!
      expect(day5?.completedDue).toBe(1);
    });

    it('Duplicate review event clicks on same card and day are deduplicated', () => {
      const recentReviewEvents: SRSReviewEvent[] = [
        {
          id: 'rev_dup_1',
          cardId: 'same_card',
          rating: 'good',
          grade: 2,
          algorithm: 'fsrs',
          timestamp: '2026-10-05T08:00:00+07:00',
          stateBefore: 'review',
          stateAfter: 'review',
          interval: 5,
        },
        {
          id: 'rev_dup_2',
          cardId: 'same_card', // Same card reviewed again on same day
          rating: 'easy',
          grade: 3,
          algorithm: 'fsrs',
          timestamp: '2026-10-05T08:05:00+07:00',
          stateBefore: 'review',
          stateAfter: 'review',
          interval: 10,
        },
      ];

      const result = deriveReviewConsistency({
        recentReviewEvents,
        refDate,
      });

      const day5 = result.dayBreakdowns.find((d) => d.date === '2026-10-05');
      expect(day5?.completedDue).toBe(1);
    });
  });

  // ==========================================================================
  // 7. TIMEZONE & MIDNIGHT BOUNDARY (Asia/Ho_Chi_Minh UTC+7)
  // ==========================================================================
  describe('7. Vietnam Timezone & Midnight Boundary', () => {
    it('accurately binds UTC timestamps to Asia/Ho_Chi_Minh dates', () => {
      // 16:59:59 UTC = 23:59:59 UTC+7 (Same date Oct 5 in VN)
      expect(getVietnamDateString('2026-10-05T16:59:59.000Z')).toBe('2026-10-05');

      // 17:00:01 UTC = 00:00:01 UTC+7 (Next date Oct 6 in VN)
      expect(getVietnamDateString('2026-10-05T17:00:01.000Z')).toBe('2026-10-06');
    });

    it('handles review events spanning midnight correctly into subsequent day', () => {
      const lateNightEvent: SRSReviewEvent = {
        id: 'rev_late',
        cardId: 'night_owl',
        rating: 'good',
        grade: 2,
        algorithm: 'fsrs',
        timestamp: '2026-10-05T17:30:00.000Z', // 00:30 AM Oct 6 VN
        stateBefore: 'review',
        stateAfter: 'review',
        interval: 5,
      };

      const result = deriveReviewConsistency({
        recentReviewEvents: [lateNightEvent],
        refDate: new Date('2026-10-08T12:00:00+07:00'),
      });

      const day5 = result.dayBreakdowns.find((d) => d.date === '2026-10-05');
      const day6 = result.dayBreakdowns.find((d) => d.date === '2026-10-06');

      expect(day5?.completedDue).toBe(0);
      expect(day6?.completedDue).toBe(1);
    });
  });

  // ==========================================================================
  // 8. WEEKLY LEARNING METRICS AGGREGATE & TIE-BREAK METADATA
  // ==========================================================================
  describe('8. Combined Weekly Learning Metrics Aggregate', () => {
    it('derives pure weekly aggregate with deterministic tie-break fields', () => {
      const srsProgressMap: Record<string, SRSProgress> = {
        'vocab_aggregate_test': mockProgress({
          srsLevel: 5,
          interval: 25,
          nextReviewDate: '2026-10-31T00:00:00Z',
          reviewCount: 3,
          lastReviewedDate: '2026-10-06T12:00:00+07:00',
          fsrs: mockFsrs({
            state: 2,
            stability: 25.0,
            reps: 3,
            difficulty: 4.0,
            lapses: 0,
            lastReview: '2026-10-06T12:00:00+07:00',
          }),
        }),
      };

      const dailyHistory: Record<string, DailyProgress> = {
        '2026-10-05': mockDaily('2026-10-05', 10),
        '2026-10-06': mockDaily('2026-10-06', 10),
      };

      const aggregate = deriveWeeklyLearningMetrics({
        userId: 'user_vietnam_001',
        srsProgressMap,
        dailyHistory,
        refDate: new Date('2026-10-08T12:00:00+07:00'),
      });

      expect(aggregate.userId).toBe('user_vietnam_001');
      expect(aggregate.weekId).toBeDefined();
      expect(aggregate.vocabMastery.lifetimeCount).toBe(1);
      expect(aggregate.vocabMastery.newlyMasteredThisWeek).toBe(1);
      expect(aggregate.vocabMastery.supportingEvidenceCount).toBe(1);
      expect(aggregate.reviewConsistency.consistencyScore).toBe(100);
      expect(aggregate.reviewConsistency.isEligibleForRanking).toBe(true);
    });

    it('deterministic output: repeated executions with identical inputs return identical results', () => {
      const input = {
        userId: 'user_test',
        dailyHistory: {
          '2026-10-05': mockDaily('2026-10-05', 15),
        },
        refDate: new Date('2026-10-08T12:00:00+07:00'),
      };

      const run1 = deriveWeeklyLearningMetrics(input);
      const run2 = deriveWeeklyLearningMetrics(input);

      expect(run1.vocabMastery).toEqual(run2.vocabMastery);
      expect(run1.reviewConsistency.consistencyScore).toBe(run2.reviewConsistency.consistencyScore);
      expect(run1.reviewConsistency.consistencyRatio).toBe(run2.reviewConsistency.consistencyRatio);
      expect(run1.weekId).toBe(run2.weekId);
    });
  });

  // ==========================================================================
  // 9. ARCHITECTURAL INVARIANTS & ZERO MUTATION
  // ==========================================================================
  describe('9. Invariant Preservation & Zero Mutation', () => {
    it('never mutates input objects (srsProgressMap, dailyHistory, reviewEvents)', () => {
      const originalFsrs = mockFsrs({
        state: 2,
        stability: 25.0,
        difficulty: 4.0,
        reps: 3,
        lapses: 1,
        lastReview: '2026-10-06T12:00:00+07:00',
      });
      const srsProgress: SRSProgress = mockProgress({
        srsLevel: 5,
        interval: 25,
        reviewCount: 3,
        fsrs: originalFsrs,
      });
      const srsProgressMap = { 'card_1': srsProgress };
      const deepSnapshot = JSON.stringify(srsProgressMap);

      deriveLifetimeVocabularyMastery({ srsProgressMap });
      deriveWeeklyMasteryTransitions(srsProgressMap, []);
      deriveReviewConsistency({ srsProgressMap });

      // Invariant check: input is strictly unmodified
      expect(JSON.stringify(srsProgressMap)).toBe(deepSnapshot);
      // Lapses !== againCount invariant intact
      expect(srsProgress.fsrs?.lapses).toBe(1);
      expect(srsProgress.reviewCount).toBe(3);
    });
  });
});
