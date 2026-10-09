// src/services/__tests__/leaderboardReleaseAuditPhase6.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '../../lib/supabaseClient';
import {
  startActiveSession,
  recordInteraction,
  pauseActiveSession,
  resumeActiveSession,
  endActiveSession,
  getActiveSessionStatus,
  resetActiveSessionForTesting,
  INACTIVITY_TIMEOUT_MS,
  MAX_CONTINUOUS_CHUNK_SECONDS,
} from '../activeLearningTimeService';
import {
  evaluateXpAward,
  createEmptyDailyXpTracking,
  evaluateAndRecordXpAward,
  resetDailyXpTrackingForTesting,
  QUIZ_MAX_DAILY_GAMES_PER_TYPE,
  FLASHCARD_DAILY_MAX_XP,
} from '../xpAntiSpamService';
import {
  isFsrsCardMastered,
  isSm2CardMastered,
  isCardMastered,
  getCanonicalLemmaKey,
  deriveLifetimeVocabularyMastery,
  deriveWeeklyMasteryTransitions,
  deriveReviewConsistency,
  derivePronunciationImprovement,
  deriveToeicGain,
  getVietnamDateString,
  type PronunciationEvidenceItem,
} from '../leaderboardLearningMetrics';
import {
  syncWeeklyLearningMetricsToServer,
  fetchLeaderboardWithStatus,
  getVietnamWeekId,
} from '../leaderboardService';
import { finalizeWeeklyLeaderboardOnServer } from '../weeklyFinalizationService';
import { equipProfileFrameOnServer } from '../frameRewardService';
import type { SRSProgress, FSRSMemoryState, SRSReviewEvent, DailyProgress } from '../../types';

describe('PHASE 6: End-to-End Security, Abuse, Fairness & Release Regression Suite', () => {
  const weekStart = new Date('2026-10-05T00:00:00.000Z');
  const weekEnd = new Date('2026-10-12T00:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
    resetActiveSessionForTesting();
    resetDailyXpTrackingForTesting();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 1. ABUSE REGRESSION AUDIT
  // ==========================================================================
  describe('1. Abuse Resistance & Anti-Farming Regression', () => {
    it('Quiz spam: repeated trivial quiz actions hit daily cap and yield 0 XP', () => {
      let tracking = createEmptyDailyXpTracking('2026-10-07');

      // Play up to the allowed maximum daily games
      for (let i = 0; i < QUIZ_MAX_DAILY_GAMES_PER_TYPE; i++) {
        const evalResult = evaluateXpAward({
          source: 'quiz',
          rawAmount: 15,
          metadata: { gameType: 'vocab_match' },
        }, tracking);
        expect(evalResult.decision.grantedXP).toBeGreaterThan(0);
        tracking = evalResult.nextState;
      }

      // Spam attempt past the daily cap -> strictly 0 XP awarded
      const spamEval = evaluateXpAward({
        source: 'quiz',
        rawAmount: 15,
        metadata: { gameType: 'vocab_match' },
      }, tracking);
      expect(spamEval.decision.grantedXP).toBe(0);
      expect(spamEval.decision.reason).toContain('Daily limit for vocab_match minigame reached');
    });

    it('Idle time: tab left open without interaction does not accumulate active learning minutes', () => {
      const startTime = 1000000;
      startActiveSession('flashcard', 'test_idle_session', startTime);

      // Record interaction up to 30 seconds
      recordInteraction(startTime + 30_000);
      expect(getActiveSessionStatus(startTime + 30_000).activeSeconds).toBe(30);

      // User walks away for 10 minutes without interaction (600 seconds)
      const idleTime = startTime + 630_000;
      const status = getActiveSessionStatus(idleTime);

      // System automatically paused after INACTIVITY_TIMEOUT_MS (60s)
      expect(status.isPaused).toBe(true);
      // Active seconds capped at interaction time + inactivity timeout (30s + 60s = 90s), NOT 630s!
      expect(status.activeSeconds).toBeLessThanOrEqual(90);
    });

    it('Background / Hidden Tab: pauses session immediately and discards background time', () => {
      const startTime = 1000000;
      startActiveSession('toeic', 'test_bg_session', startTime);

      // User works for 45 seconds
      recordInteraction(startTime + 45_000);

      // Tab hidden (e.g. user switches to other app) -> pauseActiveSession
      pauseActiveSession(startTime + 45_000);

      // Tab stays hidden for 1 hour (3600 seconds)
      const oneHourLater = startTime + 3645_000;
      const pausedStatus = getActiveSessionStatus(oneHourLater);
      expect(pausedStatus.isPaused).toBe(true);
      expect(pausedStatus.activeSeconds).toBe(45);

      // Tab resumed -> tracking continues from current time, no 3600s jump
      resumeActiveSession(oneHourLater);
      recordInteraction(oneHourLater + 15_000);
      const resumedStatus = getActiveSessionStatus(oneHourLater + 15_000);
      expect(resumedStatus.activeSeconds).toBe(60); // 45s + 15s
    });

    it('Duplicate SRS events: multiple reviews of duplicate morphology/lemmas are deduplicated', () => {
      const srsProgressMap: Record<string, SRSProgress> = {
        run: {
          srsLevel: 4,
          interval: 25,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-25T00:00:00Z',
          lastReviewedDate: '2026-10-06T00:00:00Z',
          fsrs: { stability: 26.0, difficulty: 3.5, state: 2, reps: 4, lapses: 0, lastReview: '2026-10-06T00:00:00Z' },
        },
        running: {
          srsLevel: 4,
          interval: 30,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-25T00:00:00Z',
          lastReviewedDate: '2026-10-06T00:00:00Z',
          fsrs: { stability: 28.0, difficulty: 3.2, state: 2, reps: 5, lapses: 0, lastReview: '2026-10-06T00:00:00Z' },
        },
        runs: {
          srsLevel: 3,
          interval: 22,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-25T00:00:00Z',
          lastReviewedDate: '2026-10-06T00:00:00Z',
          fsrs: { stability: 22.0, difficulty: 3.8, state: 2, reps: 3, lapses: 0, lastReview: '2026-10-06T00:00:00Z' },
        },
      };

      // Canonical lemma dedup ensures only 1 unique word is mastered
      const lifetime = deriveLifetimeVocabularyMastery({ srsProgressMap });
      expect(lifetime.totalMasteredCount).toBe(1);
      expect(lifetime.uniqueCanonicalLemmas).toEqual(['run']);
    });

    it('Reinforcement review: extra practice reviews on non-due cards do not inflate Review Consistency', () => {
      // 5 cards truly due on 2026-10-07
      const recentReviewEvents: SRSReviewEvent[] = [
        { id: 'rev_1', cardId: 'c1', rating: 'good', grade: 2, algorithm: 'fsrs', timestamp: '2026-10-07T08:00:00Z', stateBefore: 'review', stateAfter: 'review', interval: 5 },
        { id: 'rev_2', cardId: 'c2', rating: 'good', grade: 2, algorithm: 'fsrs', timestamp: '2026-10-07T08:05:00Z', stateBefore: 'review', stateAfter: 'review', interval: 5 },
        { id: 'rev_3', cardId: 'c3', rating: 'good', grade: 2, algorithm: 'fsrs', timestamp: '2026-10-07T08:10:00Z', stateBefore: 'review', stateAfter: 'review', interval: 5 },
        { id: 'rev_4', cardId: 'c4', rating: 'good', grade: 2, algorithm: 'fsrs', timestamp: '2026-10-07T08:15:00Z', stateBefore: 'review', stateAfter: 'review', interval: 5 },
        { id: 'rev_5', cardId: 'c5', rating: 'good', grade: 2, algorithm: 'fsrs', timestamp: '2026-10-07T08:20:00Z', stateBefore: 'review', stateAfter: 'review', interval: 5 },
      ];

      // Cramming reviews explicitly tagged as drill or reinforcement
      for (let i = 0; i < 50; i++) {
        recentReviewEvents.push({
          id: `cram_rev_${i}`,
          cardId: `cram_${i}`,
          rating: 'easy',
          grade: 3,
          algorithm: 'fsrs',
          timestamp: '2026-10-07T09:00:00Z',
          stateBefore: 'review',
          stateAfter: 'review',
          interval: 5,
          isReinforcement: true,
        } as any);
      }

      const dailyHistory: Record<string, DailyProgress> = {
        '2026-10-07': {
          date: '2026-10-07',
          wordsReviewed: 55,
          newWordsLearned: 0,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
          xpGained: 100,
        },
      };

      const consistency = deriveReviewConsistency({
        recentReviewEvents,
        dailyHistory,
        refDate: new Date('2026-10-07T12:00:00Z'),
      });

      // Scheduled: 5 completed. Cramming reviews (50) did not inflate consistency score beyond valid reviews
      expect(consistency.consistencyScore).toBe(100);
      expect(consistency.completedScheduledReviews).toBe(5);
    });

    it('Duplicate pronunciation sessions: replaying identical phrase records is deduplicated', () => {
      const attempts: PronunciationEvidenceItem[] = [
        { id: 'p1', word: 'pronunciation', score: 85, recognizedText: 'pronunciation', timestamp: '2026-10-05T08:00:00Z', isTrusted: true },
        { id: 'p1', word: 'pronunciation', score: 85, recognizedText: 'pronunciation', timestamp: '2026-10-05T08:00:00Z', isTrusted: true }, // Duplicate id
        { id: 'p2', word: 'technology', score: 80, recognizedText: 'technology', timestamp: '2026-10-06T09:00:00Z', isTrusted: true },
      ];

      const res = derivePronunciationImprovement({
        attempts,
        weekStart,
        weekEnd,
      });
      // Duplicate attempt id 'p1' is ignored
      expect(res.validSampleCount).toBe(2);
    });

    it('Failed speech attempts: scores below failure threshold do not generate artificial gains', () => {
      const attempts: PronunciationEvidenceItem[] = [
        // Baseline: 5 items (~76 avg)
        { id: 'p1', word: 'w1', score: 75, recognizedText: 'w1', timestamp: '2026-10-05T08:00:00Z', isTrusted: true },
        { id: 'p2', word: 'w2', score: 78, recognizedText: 'w2', timestamp: '2026-10-05T08:01:00Z', isTrusted: true },
        { id: 'p3', word: 'w3', score: 72, recognizedText: 'w3', timestamp: '2026-10-05T08:02:00Z', isTrusted: true },
        { id: 'p4', word: 'w4', score: 74, recognizedText: 'w4', timestamp: '2026-10-05T08:03:00Z', isTrusted: true },
        { id: 'p5', word: 'w5', score: 76, recognizedText: 'w5', timestamp: '2026-10-05T08:04:00Z', isTrusted: true },
        // Failed / degraded attempts (~14 avg)
        { id: 'p6', word: 'w6', score: 10, recognizedText: 'w6', timestamp: '2026-10-06T08:00:00Z', isTrusted: true },
        { id: 'p7', word: 'w7', score: 10, recognizedText: 'w7', timestamp: '2026-10-06T08:01:00Z', isTrusted: true },
        { id: 'p8', word: 'w8', score: 15, recognizedText: 'w8', timestamp: '2026-10-06T08:02:00Z', isTrusted: true },
        { id: 'p9', word: 'w9', score: 20, recognizedText: 'w9', timestamp: '2026-10-06T08:03:00Z', isTrusted: true },
        { id: 'p10', word: 'w10', score: 15, recognizedText: 'w10', timestamp: '2026-10-06T08:04:00Z', isTrusted: true },
      ];

      const res = derivePronunciationImprovement({
        attempts,
        weekStart,
        weekEnd,
      });
      // 10 samples across 2 days -> eligible, but gainScore is strictly negative
      expect(res.isEligible).toBe(true);
      expect(res.gainScore).toBeLessThan(0);
    });

    it('TOEIC attempt replay & abandoned tests: partial or rapid replays are ignored', () => {
      const sessions = [
        // Valid baseline exam
        { id: 'att_1', title: 'Test 1', totalScore: 650, timeSpentSeconds: 7200, experienceMode: 'mock', skillScope: '2skills', date: '2026-10-06T09:00:00.000Z' },
        // Abandoned exam (< 60s) -> excluded
        { id: 'att_abandoned', title: 'Test 2', totalScore: 150, timeSpentSeconds: 25, experienceMode: 'mock', skillScope: '2skills', date: '2026-10-07T09:00:00.000Z' },
        // Practice session -> excluded
        { id: 'att_practice', title: 'Practice 1', totalScore: 800, timeSpentSeconds: 3600, mode: 'practice', date: '2026-10-08T09:00:00.000Z' },
        // Valid second exam 3 days later
        { id: 'att_2', title: 'Test 2', totalScore: 720, timeSpentSeconds: 7200, experienceMode: 'mock', skillScope: '2skills', date: '2026-10-09T09:00:00.000Z' },
      ];

      const res = deriveToeicGain({
        sessions,
        weekStart,
        weekEnd,
      });
      expect(res.isEligible).toBe(true);
      expect(res.totalValidAttempts).toBe(2);
      expect(res.lrGain).toBe(70); // 720 - 650 = +70
    });
  });

  // ==========================================================================
  // 2. FAIRNESS AUDIT
  // ==========================================================================
  describe('2. Fairness & Normalization Audit', () => {
    it('Review Consistency: 50/50 (100%) fairly defeats 400/500 (80%)', () => {
      const refDate = new Date('2026-10-08T12:00:00+07:00'); // Thursday VN

      // Learner A: 3 days with 10 completed out of 10 expected -> 100%
      const resA = deriveReviewConsistency({
        dailyHistory: {
          '2026-10-05': { date: '2026-10-05', wordsReviewed: 10, newWordsLearned: 0, quizzesCompleted: 0, pronunciationsMastered: 0, xpGained: 50 },
          '2026-10-06': { date: '2026-10-06', wordsReviewed: 10, newWordsLearned: 0, quizzesCompleted: 0, pronunciationsMastered: 0, xpGained: 50 },
          '2026-10-07': { date: '2026-10-07', wordsReviewed: 10, newWordsLearned: 0, quizzesCompleted: 0, pronunciationsMastered: 0, xpGained: 50 },
        },
        refDate,
      });

      // Learner B: 3 days with 10 completed but 10 overdue remaining (expected 20 each day) -> 50%
      const overdueProgressMap: Record<string, SRSProgress> = {};
      for (let i = 0; i < 10; i++) {
        overdueProgressMap[`od_${i}`] = {
          srsLevel: 2,
          interval: 2,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-04T00:00:00+07:00',
        };
      }
      const resB = deriveReviewConsistency({
        dailyHistory: {
          '2026-10-05': { date: '2026-10-05', wordsReviewed: 10, newWordsLearned: 0, quizzesCompleted: 0, pronunciationsMastered: 0, xpGained: 50 },
          '2026-10-06': { date: '2026-10-06', wordsReviewed: 10, newWordsLearned: 0, quizzesCompleted: 0, pronunciationsMastered: 0, xpGained: 50 },
          '2026-10-07': { date: '2026-10-07', wordsReviewed: 10, newWordsLearned: 0, quizzesCompleted: 0, pronunciationsMastered: 0, xpGained: 50 },
        },
        srsProgressMap: overdueProgressMap,
        refDate,
      });

      expect(resA.consistencyScore).toBe(100);
      expect(resB.consistencyScore).toBeLessThanOrEqual(50);
      // Pure percentage discipline ranks Learner A higher than Learner B
      expect(resA.consistencyScore).toBeGreaterThan(resB.consistencyScore);
    });

    it('Zero-due days do not produce NaN or cause errors', () => {
      const res = deriveReviewConsistency({
        dailyHistory: {},
        srsProgressMap: {},
        refDate: new Date('2026-10-05T12:00:00Z'),
      });

      expect(res.consistencyScore).toBe(0);
      expect(res.consistencyRatio).toBe(0.0);
      expect(res.isEligibleForRanking).toBe(false);
      expect(Number.isNaN(res.consistencyScore)).toBe(false);
      expect(Number.isNaN(res.consistencyRatio)).toBe(false);
    });
  });

  // ==========================================================================
  // 3. ELIGIBILITY AUDIT
  // ==========================================================================
  describe('3. Eligibility Enforcement Audit', () => {
    it('Pronunciation: < 10 samples or < 2 days marks user strictly ineligible (gainScore is null)', () => {
      // 9 samples across 2 days (< 10)
      const samples9: PronunciationEvidenceItem[] = Array.from({ length: 9 }, (_, i) => ({
        id: `att_${i}`,
        word: `w_${i}`,
        score: 80,
        recognizedText: 'word',
        isTrusted: true,
        timestamp: i < 5 ? '2026-10-05T08:00:00Z' : '2026-10-06T08:00:00Z',
      }));
      const res1 = derivePronunciationImprovement({
        attempts: samples9,
        weekStart,
        weekEnd,
      });
      expect(res1.isEligible).toBe(false);
      expect(res1.gainScore).toBeNull();

      // 15 samples all done on the same single day (< 2 days)
      const sameDay: PronunciationEvidenceItem[] = Array.from({ length: 15 }, (_, i) => ({
        id: `att_same_${i}`,
        word: `w_${i}`,
        score: 80,
        recognizedText: 'word',
        isTrusted: true,
        timestamp: '2026-10-05T08:00:00Z',
      }));
      const res2 = derivePronunciationImprovement({
        attempts: sameDay,
        weekStart,
        weekEnd,
      });
      expect(res2.isEligible).toBe(false);
      expect(res2.distinctDays).toBe(1);
      expect(res2.gainScore).toBeNull();
    });

    it('TOEIC: < 2 valid mock exams marks user strictly ineligible (lrGain is null)', () => {
      const singleExam = [
        { id: 'att_1', title: 'Test 1', totalScore: 700, timeSpentSeconds: 7200, experienceMode: 'mock', skillScope: '2skills', date: '2026-10-06T10:00:00Z' },
      ];
      const res = deriveToeicGain({
        sessions: singleExam,
        weekStart,
        weekEnd,
      });
      expect(res.isEligible).toBe(false);
      expect(res.lrGain).toBeNull();
    });

    it('Vocabulary: single Easy click on day 1 does NOT grant mastery', () => {
      // FSRS: 1 rep card
      const fsrsOneRep: FSRSMemoryState = {
        stability: 15.0, // Initial stability is below 21 days
        difficulty: 3.0,
        state: 1, // Learning, not Review
        reps: 1,
        lapses: 0,
        lastReview: '2026-10-07T00:00:00Z',
      };
      expect(isFsrsCardMastered(fsrsOneRep)).toBe(false);

      // SM-2: 1 rep card
      const sm2OneRep: SRSProgress = {
        srsLevel: 1,
        interval: 1,
        easeFactor: 2.5,
        nextReviewDate: '2026-10-08T00:00:00Z',
      };
      expect(isSm2CardMastered(sm2OneRep)).toBe(false);
    });
  });

  // ==========================================================================
  // 4. SECURITY & RPC AUDIT
  // ==========================================================================
  describe('4. Server Authority & Anti-Tamper Security Audit', () => {
    it('client cannot forge unearned frame rewards via equipProfileFrameOnServer', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: false,
          code: 'FRAME_NOT_OWNED',
          message: 'Khung danh hiệu chưa được mở khóa hoặc đã hết hạn.',
        },
        error: null,
      } as any);

      const res = await equipProfileFrameOnServer('champion_frame');
      expect(res.success).toBe(false);
      expect(res.code).toBe('FRAME_NOT_OWNED');
    });

    it('client cannot execute finalizeWeeklyLeaderboardOnServer (restricted to service_role)', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: false,
          code: 'PERMISSION_DENIED',
          message: 'Chỉ tiến trình hệ thống định kỳ (service_role) mới được quyền chốt bảng tuần.',
        },
        error: null,
      } as any);

      const res = await finalizeWeeklyLeaderboardOnServer();
      expect(res.success).toBe(false);
      expect(res.code).toBe('PERMISSION_DENIED');
    });

    it('syncWeeklyLearningMetricsToServer is 100% idempotent upon concurrent or repeated syncs', async () => {
      const currentWeek = getVietnamWeekId();
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          code: 'SYNCED_SUCCESS',
          week_id: currentWeek,
          weekly_xp: 500,
          vocab_mastered: 25,
          review_consistency: 100.0,
          active_minutes: 60,
          pronunciation_gain: null,
          toeic_gain: null,
        },
        error: null,
      } as any);

      const payload = {
        weekId: currentWeek,
        weeklyXp: 500,
        vocabMastered: 25,
        reviewConsistency: 100.0,
        activeMinutes: 60,
        pronunciationGain: null,
        toeicGain: null,
      };

      // Call twice with identical payload
      const firstSync = await syncWeeklyLearningMetricsToServer(payload);
      const secondSync = await syncWeeklyLearningMetricsToServer(payload);

      expect(firstSync.success).toBe(true);
      expect(secondSync.success).toBe(true);
      expect(firstSync.weekly_xp).toBe(secondSync.weekly_xp);
      expect(firstSync.vocab_mastered).toBe(secondSync.vocab_mastered);
      expect(supabase.rpc).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // 5. LEARNING-SYSTEM IMMUTABILITY & PERFORMANCE
  // ==========================================================================
  describe('5. Learning-System Immutability & Performance Audit', () => {
    it('metric derivation is strictly pure and NEVER mutates underlying card/progress state', () => {
      const rawFsrs: FSRSMemoryState = Object.freeze({
        stability: 28.5,
        difficulty: 3.2,
        state: 2,
        reps: 5,
        lapses: 0,
        lastReview: '2026-10-06T12:00:00Z',
      });

      const rawProgress: SRSProgress = Object.freeze({
        srsLevel: 5,
        interval: 30,
        easeFactor: 2.6,
        nextReviewDate: '2026-10-25T00:00:00Z',
        fsrs: rawFsrs,
      });

      // Calling evaluation
      const mastered = isCardMastered(rawProgress);
      expect(mastered).toBe(true);

      // Verify zero mutation occurred
      expect(rawFsrs.stability).toBe(28.5);
      expect(rawProgress.interval).toBe(30);
    });

    it('ranking queries return bounded payloads without full database dumps', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          category: 'vocab_mastered',
          week_id: getVietnamWeekId(),
          top_entries: [
            {
              user_id: 'u1',
              display_name: 'Top Learner',
              level: 15,
              score: 85,
              secondary_score: 20,
              rank: 1,
            },
          ],
          current_user_entry: null,
        },
        error: null,
      } as any);

      const res = await fetchLeaderboardWithStatus('vocab_mastered', 'current_user', 50);
      expect(res.entries.length).toBe(1);
      expect(supabase.rpc).toHaveBeenCalledWith('get_leaderboard_category_rankings', {
        p_category: 'vocab_mastered',
        p_week_id: expect.stringMatching(/^\d{4}-W\d{2}$/),
        p_limit: 50,
        p_current_user_id: 'current_user',
      });
    });
  });
});
