// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { supabase } from '../../lib/supabaseClient';
import {
  useCloudSyncStore,
  pushLocalToCloud,
  setActiveSyncedUserId,
} from '../cloudSyncService';
import {
  deriveLifetimeVocabularyMastery,
  deriveWeeklyMasteryTransitions,
  deriveReviewConsistency,
  deriveLeaderboardLearningMetrics,
  syncDerivedLearningMetrics,
  isFsrsCardMastered,
  isSm2CardMastered,
  isCardMastered,
  getCanonicalLemmaKey,
} from '../leaderboardLearningMetrics';
import {
  getAuthoritativeVietnamWeekId,
  getVietnamWeekStart,
  getVietnamWeekEnd,
} from '../leaderboardService';
import { useAppStore } from '../../store/useAppStore';
import type { SRSProgress, SRSReviewEvent, DailyProgress, VocabWord } from '../../types';

describe('PHASE 6 — Vocabulary Mastery & Review Consistency Leaderboard Metrics', () => {
  const testUserId = '66666666-6666-4666-8666-666666666666';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setActiveSyncedUserId(null);
    useAppStore.getState().resetToDefault();
    useCloudSyncStore.setState({
      user: { id: testUserId, email: 'phase6@example.com' } as any,
      userId: testUserId,
      userEmail: 'phase6@example.com',
      session: null,
      isOnline: true,
      status: 'idle',
      errorMessage: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // SECTION A: VOCAB_MASTERED PIPELINE
  // ==========================================================================
  describe('A. VOCAB_MASTERED — Semantic Isolation & Canonical Lemma Deduplication', () => {
    it('FSRS truly mastered: requires state=2 (review), stability >= 21.0, reps >= 2', () => {
      // 1. Truly mastered FSRS card
      const masteredFsrs = {
        state: 2 as const, // Review
        stability: 25.5,
        difficulty: 4.2,
        reps: 3,
        lapses: 0,
        lastReview: '2026-10-06T10:00:00Z',
      };
      expect(isFsrsCardMastered(masteredFsrs)).toBe(true);

      // 2. State 1 (Learning) is NOT mastered despite high stability
      const learningFsrs = { ...masteredFsrs, state: 1 as const };
      expect(isFsrsCardMastered(learningFsrs)).toBe(false);

      // 3. Low stability (< 21.0) is NOT mastered
      const lowStabilityFsrs = { ...masteredFsrs, stability: 18.0 };
      expect(isFsrsCardMastered(lowStabilityFsrs)).toBe(false);

      // 4. reps < 2 (single Easy click on new card) is NOT mastered
      const singleClickFsrs = { ...masteredFsrs, reps: 1 };
      expect(isFsrsCardMastered(singleClickFsrs)).toBe(false);
    });

    it('SM-2 truly mastered: requires srsLevel >= 5 or interval >= 21 with study evidence, never fakes FSRS', () => {
      // 1. Mastered via srsLevel >= 5 with review history
      const sm2ByLevel = {
        srsLevel: 5,
        interval: 15,
        reviewCount: 3,
        lastReviewedDate: '2026-10-05T08:00:00Z',
      };
      expect(isSm2CardMastered(sm2ByLevel)).toBe(true);

      // 2. Mastered via interval >= 21 with study history
      const sm2ByInterval = {
        srsLevel: 3,
        interval: 24,
        reviewCount: 2,
        firstLearnedAt: '2026-09-10T08:00:00Z',
      };
      expect(isSm2CardMastered(sm2ByInterval)).toBe(true);

      // 3. Unstudied / zero-evidence card with fake level is NOT mastered
      const fakeCard = {
        srsLevel: 5,
        interval: 30,
        reviewCount: 0,
      };
      expect(isSm2CardMastered(fakeCard)).toBe(false);

      // 4. Strict isolation: card without FSRS fields evaluates purely on SM-2
      const pureSm2Card: SRSProgress = {
        srsLevel: 5,
        interval: 25,
        easeFactor: 2.5,
        nextReviewDate: '2026-10-15T00:00:00Z',
        reviewCount: 4,
        lastReviewedDate: '2026-10-05T00:00:00Z',
      };
      expect(isCardMastered(pureSm2Card, 'sm2')).toBe(true);
      expect((pureSm2Card as any).fsrs).toBeUndefined(); // Zero faking of FSRS
    });

    it('Algorithm preference isolation: user preference for SM-2 ignores FSRS properties', () => {
      const hybridCard: SRSProgress = {
        srsLevel: 1, // SM-2 not mastered (< 5)
        interval: 2,
        easeFactor: 2.5,
        nextReviewDate: '2026-10-07T00:00:00Z',
        reviewCount: 3,
        lastReviewedDate: '2026-10-05T00:00:00Z',
        fsrs: {
          state: 2,
          stability: 30.0, // FSRS would be mastered
          difficulty: 4.0,
          reps: 3,
          lapses: 0,
          lastReview: '2026-10-05T00:00:00Z',
        },
      };

      // Under default/FSRS preference: qualifies via FSRS
      expect(isCardMastered(hybridCard, 'fsrs')).toBe(true);

      // Under explicit SM-2 preference: strictly evaluated against SM-2 rules, fails because srsLevel=1
      expect(isCardMastered(hybridCard, 'sm2')).toBe(false);
    });

    it('Canonical lemma deduplication: "run", "running", "runs" collapse into single mastered lemma', () => {
      const srsProgressMap: Record<string, SRSProgress> = {
        vocab_run: {
          srsLevel: 5,
          interval: 25,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-15T00:00:00Z',
          reviewCount: 3,
          lastReviewedDate: '2026-10-05T00:00:00Z',
        },
        vocab_running: {
          srsLevel: 5,
          interval: 22,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-15T00:00:00Z',
          reviewCount: 4,
          lastReviewedDate: '2026-10-05T00:00:00Z',
        },
        vocab_runs: {
          srsLevel: 5,
          interval: 28,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-15T00:00:00Z',
          reviewCount: 3,
          lastReviewedDate: '2026-10-05T00:00:00Z',
        },
      };

      const result = deriveLifetimeVocabularyMastery({ srsProgressMap });

      // All 3 cards collapse into 1 canonical lemma: 'run'
      expect(result.totalMasteredCount).toBe(1);
      expect(result.uniqueCanonicalLemmas).toEqual(['run']);
      expect(result.supportingEvidenceCount).toBe(3);
    });

    it('Current week transition tracking: newly mastered cards in week window increment transitions', () => {
      const weekStart = new Date('2026-10-05T00:00:00+07:00');
      const weekEnd = new Date('2026-10-12T00:00:00+07:00');

      const recentReviewEvents: SRSReviewEvent[] = [
        // Card was already mastered before current week: should NOT count as newly mastered transition
        {
          id: 'rev_past',
          cardId: 'card_legacy',
          rating: 'good',
          grade: 2,
          algorithm: 'sm2',
          timestamp: '2026-10-02T10:00:00+07:00', // Prior to weekStart
          stateBefore: 'learning',
          stateAfter: 'review',
          interval: 25,
        },
        // Card transitioned to mastered during current week: SHOULD count
        {
          id: 'rev_current',
          cardId: 'card_fresh',
          rating: 'good',
          grade: 2,
          algorithm: 'sm2',
          timestamp: '2026-10-06T10:00:00+07:00', // Inside current week
          stateBefore: 'learning',
          stateAfter: 'review',
          interval: 25,
        },
      ];

      const srsProgressMap: Record<string, SRSProgress> = {
        card_legacy: {
          srsLevel: 5,
          interval: 25,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-20T10:00:00+07:00',
          lastReviewedDate: '2026-10-02T10:00:00+07:00',
        },
        card_fresh: {
          srsLevel: 5,
          interval: 25,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-20T10:00:00+07:00',
          lastReviewedDate: '2026-10-06T10:00:00+07:00',
        },
      };

      const result = deriveWeeklyMasteryTransitions(
        srsProgressMap,
        recentReviewEvents,
        weekStart,
        weekEnd
      );

      expect(result.newlyMasteredCount).toBe(1);
      expect(result.transitions[0].sourceCardId).toBe('card_fresh');
    });

    it('Cloud synchronization sends canonical vocab_mastered and evidence.vocab_transitions', async () => {
      let rpcParams: any = null;
      vi.spyOn(supabase, 'rpc').mockImplementation(((name: string, params: any) => {
        if (name === 'sync_weekly_learning_metrics') {
          rpcParams = params;
          return Promise.resolve({
            data: { success: true, code: 'SYNCED_SUCCESS' },
            error: null,
          });
        }
        return Promise.resolve({ data: {}, error: null });
      }) as any);

      const today = new Date().toISOString().split('T')[0];
      useAppStore.setState((s) => ({
        ...s,
        srsProgressMap: {
          vocab_innovate: { srsLevel: 5, interval: 25, easeFactor: 2.5, reviewCount: 3, lastReviewedDate: today, nextReviewDate: today },
          vocab_perseverance: { srsLevel: 5, interval: 30, easeFactor: 2.5, reviewCount: 4, lastReviewedDate: '2026-08-01T00:00:00Z', nextReviewDate: '2026-08-31T00:00:00Z' },
        },
        recentReviewEvents: [
          {
            id: 'rev_innovate',
            cardId: 'vocab_innovate',
            rating: 'good',
            grade: 2,
            algorithm: 'sm2',
            timestamp: new Date().toISOString(),
            stateBefore: 'learning',
            stateAfter: 'review',
            interval: 25,
          },
        ],
      }));

      const res = await syncDerivedLearningMetrics(testUserId);

      expect(res.success).toBe(true);
      expect(rpcParams).toBeDefined();
      expect(rpcParams.p_vocab_mastered).toBe(2);
      expect(rpcParams.p_evidence.vocab_transitions).toBe(1);
    });
  });

  // ==========================================================================
  // SECTION B: REVIEW_CONSISTENCY PIPELINE
  // ==========================================================================
  describe('B. REVIEW_CONSISTENCY — Scheduled Due vs Non-Due Filter & Ineligible Handling', () => {
    const refDate = new Date('2026-10-08T12:00:00+07:00'); // Thursday VN

    it('Scheduled due completion: completing expected cards elevates consistencyScore', () => {
      const dailyHistory: Record<string, DailyProgress> = {
        '2026-10-05': { date: '2026-10-05', wordsReviewed: 10, newWordsLearned: 0, quizzesCompleted: 0, pronunciationsMastered: 0, xpGained: 20 },
        '2026-10-06': { date: '2026-10-06', wordsReviewed: 10, newWordsLearned: 0, quizzesCompleted: 0, pronunciationsMastered: 0, xpGained: 20 },
      };

      const result = deriveReviewConsistency({ dailyHistory, refDate });

      expect(result.consistencyScore).toBe(100);
      expect(result.eligibleReviewDays).toBe(2);
      expect(result.completedReviewDays).toBe(2);
      expect(result.isEligibleForRanking).toBe(true);
    });

    it('Non-due reinforcement and drills are strictly excluded from completed scheduled reviews', () => {
      const recentReviewEvents: SRSReviewEvent[] = [
        // 1 official scheduled due review
        {
          id: 'rev_due_1',
          cardId: 'word_due',
          rating: 'good',
          grade: 2,
          algorithm: 'fsrs',
          timestamp: '2026-10-05T08:00:00+07:00',
          stateBefore: 'review',
          stateAfter: 'review',
          interval: 5,
        },
        // Reinforcement drill (today_learned): must be EXCLUDED
        {
          id: 'rev_reinf_1',
          cardId: 'word_reinf',
          rating: 'good',
          grade: 2,
          algorithm: 'fsrs',
          timestamp: '2026-10-05T09:00:00+07:00',
          stateBefore: 'review',
          stateAfter: 'review',
          interval: 5,
          reviewMode: 'today_learned',
          isReinforcement: true,
        },
        // Pool drill / cramming (all_learned): must be EXCLUDED
        {
          id: 'rev_drill_1',
          cardId: 'word_drill',
          rating: 'good',
          grade: 2,
          algorithm: 'fsrs',
          timestamp: '2026-10-05T10:00:00+07:00',
          stateBefore: 'review',
          stateAfter: 'review',
          interval: 5,
          reviewMode: 'all_learned',
          isDrill: true,
        },
      ];

      // dailyHistory logged 3 wordsReviewed because 3 reviews happened in total
      const dailyHistory: Record<string, DailyProgress> = {
        '2026-10-05': { date: '2026-10-05', wordsReviewed: 3, newWordsLearned: 0, quizzesCompleted: 0, pronunciationsMastered: 0, xpGained: 30 },
      };

      const result = deriveReviewConsistency({
        dailyHistory,
        recentReviewEvents,
        refDate,
      });

      const day5 = result.dayBreakdowns.find((d) => d.date === '2026-10-05');
      // Only the 1 official scheduled review is counted as completedDue!
      expect(day5?.completedDue).toBe(1);
    });

    it('Difficult-card retry: reviewing the same card multiple times on same day counts at most ONCE', () => {
      const recentReviewEvents: SRSReviewEvent[] = [
        {
          id: 'rev_again_1',
          cardId: 'difficult_card',
          rating: 'again',
          grade: 0,
          algorithm: 'sm2',
          timestamp: '2026-10-05T08:00:00+07:00',
          stateBefore: 'review',
          stateAfter: 'review',
          interval: 1,
        },
        {
          id: 'rev_retry_2',
          cardId: 'difficult_card', // SAME CARD reviewed again 10 minutes later
          rating: 'good',
          grade: 2,
          algorithm: 'sm2',
          timestamp: '2026-10-05T08:10:00+07:00',
          stateBefore: 'review',
          stateAfter: 'review',
          interval: 3,
        },
      ];

      const result = deriveReviewConsistency({
        recentReviewEvents,
        refDate,
      });

      const day5 = result.dayBreakdowns.find((d) => d.date === '2026-10-05');
      // Deduplicated to 1 completed card
      expect(day5?.completedDue).toBe(1);
    });

    it('Zero-due neutral fairness: days with 0 due reviews do not penalize consistency ratio', () => {
      // User has scheduled reviews on Mon, Tue (completed 100% of both). Wed-Sun had 0 scheduled reviews.
      const dailyHistory: Record<string, DailyProgress> = {
        '2026-10-05': { date: '2026-10-05', wordsReviewed: 10, newWordsLearned: 0, quizzesCompleted: 0, pronunciationsMastered: 0, xpGained: 20 },
        '2026-10-06': { date: '2026-10-06', wordsReviewed: 10, newWordsLearned: 0, quizzesCompleted: 0, pronunciationsMastered: 0, xpGained: 20 },
      };

      const result = deriveReviewConsistency({ dailyHistory, refDate });

      // Denominator evaluates only the 2 eligible days -> 100%
      expect(result.eligibleReviewDays).toBe(2);
      expect(result.completedReviewDays).toBe(2);
      expect(result.consistencyScore).toBe(100);
    });

    it('Ineligible learner handling: user with 0 eligible days retains reviewConsistency: null (not 0)', () => {
      // Dormant user with no study activity and no cards due
      const derived = deriveLeaderboardLearningMetrics(useAppStore.getState(), { userId: testUserId });

      expect(derived.eligibility.consistency).toBe(false);
      expect(derived.reviewConsistency).toBeNull(); // Strictly NULL, not 0
    });

    it('Cloud synchronization sends reviewConsistency and evidence.consistency_days', async () => {
      let rpcParams: any = null;
      vi.spyOn(supabase, 'rpc').mockImplementation(((name: string, params: any) => {
        if (name === 'sync_weekly_learning_metrics') {
          rpcParams = params;
          return Promise.resolve({
            data: { success: true, code: 'SYNCED_SUCCESS' },
            error: null,
          });
        }
        return Promise.resolve({ data: {}, error: null });
      }) as any);

      const today = new Date().toISOString().split('T')[0];
      useAppStore.setState((s) => ({
        ...s,
        dailyHistory: {
          [today]: {
            date: today,
            wordsReviewed: 10,
            newWordsLearned: 0,
            quizzesCompleted: 0,
            pronunciationsMastered: 0,
            xpGained: 30,
          },
        },
      }));

      const res = await syncDerivedLearningMetrics(testUserId);

      expect(res.success).toBe(true);
      expect(rpcParams).toBeDefined();
      expect(rpcParams.p_review_consistency).toBe(100);
      expect(rpcParams.p_evidence.consistency_days).toBe(1);
      expect(rpcParams.p_evidence.eligible_review_days).toBe(1);
    });
  });

  // ==========================================================================
  // SECTION C: ROBUSTNESS & INTEGRATION TESTS
  // ==========================================================================
  describe('C. Robustness & End-to-End Integration', () => {
    it('Retry sync is completely idempotent and does not create duplicate entries', async () => {
      let syncCount = 0;
      vi.spyOn(supabase, 'rpc').mockImplementation((() => {
        syncCount++;
        return Promise.resolve({
          data: { success: true, code: 'SYNCED_SUCCESS' },
          error: null,
        });
      }) as any);

      // Call sync multiple times in succession
      await syncDerivedLearningMetrics(testUserId);
      await syncDerivedLearningMetrics(testUserId);
      await syncDerivedLearningMetrics(testUserId);

      expect(syncCount).toBe(3);
    });

    it('Wrong week error recovery: catches WEEK_MISMATCH and gracefully recovers without crashing', async () => {
      let mismatchHandled = false;
      vi.spyOn(supabase, 'rpc').mockImplementation(((name: string) => {
        if (name === 'sync_weekly_learning_metrics') {
          mismatchHandled = true;
          return Promise.resolve({
            data: null,
            error: { code: 'WEEK_MISMATCH', message: 'Week ID does not match server authoritative week' },
          });
        }
        return Promise.resolve({ data: {}, error: null });
      }) as any);

      const res = await syncDerivedLearningMetrics(testUserId);

      expect(mismatchHandled).toBe(true);
      expect(res.success).toBe(false);
      expect(res.code).toBe('WEEK_MISMATCH');
    });

    it('SRS processReview integration: grading review attaches reviewMode and schedules sync', () => {
      const store = useAppStore.getState();

      // Add a test vocab word
      store.saveToSRS({
        id: 'test_phase6_word',
        word: 'test_phase6_word',
        meaning: 'từ kiểm thử',
      } as any);

      // Perform a review in due_today mode
      store.processReview('test_phase6_word', 2, 'due_today');

      const updatedStore = useAppStore.getState();
      const lastEvent = updatedStore.recentReviewEvents[0];

      expect(lastEvent).toBeDefined();
      expect(lastEvent.cardId).toBe('test_phase6_word');
      expect(lastEvent.reviewMode).toBe('due_today');
      expect(lastEvent.isReinforcement).toBe(false);
      expect(lastEvent.isDrill).toBe(false);
    });
  });
});
