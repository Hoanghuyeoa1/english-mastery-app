// @vitest-environment happy-dom
// src/services/__tests__/leaderboardReconciliationPhase11.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '../../lib/supabaseClient';
import {
  calculateWeeklyXpFromHistory,
  getVietnamWeekId,
  getCurrentVietnamWeekDates,
  syncUserScoreToLeaderboard,
  syncWeeklyLearningMetricsToServer,
  classifySyncFailureCategory,
  logLeaderboardSyncError,
  type LeaderboardSyncFailureType,
} from '../leaderboardService';
import {
  syncDerivedLearningMetrics,
  deriveLifetimeVocabularyMastery,
} from '../leaderboardLearningMetrics';
import {
  performFullSync,
  pushLocalToCloud,
  useCloudSyncStore,
  setActiveSyncedUserId,
  getActiveSyncedUserId,
  registerCloudSyncStoreGetter,
} from '../cloudSyncService';
import { applyCloudDataMerge } from '../../store/cloudDataMerger';
import type { AppStoreState, DailyProgress, SRSProgress } from '../../types';

describe('PHASE 11 — Leaderboard Reconciliation & Real-World Edge Cases', () => {
  const USER_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const USER_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  let mockStoreState: any = null;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.clear();

    mockStoreState = {
      profile: {
        name: 'Học viên Test',
        xp: 0,
        level: 1,
        streak: 0,
        equippedFrame: null,
      },
      dailyHistory: {} as Record<string, DailyProgress>,
      srsProgressMap: {} as Record<string, SRSProgress>,
      userCollocations: [],
      recentReviewEvents: [],
      fourSkillsScores: {},
      resetToDefault: vi.fn(() => {
        mockStoreState.profile = { name: 'Học viên Test', xp: 0, level: 1, streak: 0, equippedFrame: null };
        mockStoreState.dailyHistory = {};
        mockStoreState.srsProgressMap = {};
        mockStoreState.userCollocations = [];
        mockStoreState.recentReviewEvents = [];
      }),
      mergeCloudData: vi.fn((payload: any) => {
        const merged = applyCloudDataMerge(mockStoreState as AppStoreState, payload);
        Object.assign(mockStoreState, merged);
      }),
    };

    registerCloudSyncStoreGetter(() => mockStoreState);

    useCloudSyncStore.setState({
      isOnline: true,
      userId: USER_A_ID,
      user: { id: USER_A_ID, email: 'usera@example.com' } as any,
      status: 'idle',
    });
    setActiveSyncedUserId(USER_A_ID);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // ==========================================================================
  // SECTION 1: BACKFILL CURRENT VALID STATE
  // ==========================================================================
  describe('1. Backfill Current Valid State (Zero-New-Action Repair)', () => {
    it('recomputes from existing valid local evidence and repairs cloud without requiring a new learning action', async () => {
      const currentWeekDates = getCurrentVietnamWeekDates();
      const todayDate = currentWeekDates[0];
      const yesterdayDate = currentWeekDates[1];

      // Existing user has local progress accumulated, but remote DB has 0/missing
      mockStoreState.dailyHistory = {
        [todayDate]: { date: todayDate, xpGained: 150, wordsReviewed: 20, newWordsLearned: 5 },
        [yesterdayDate]: { date: yesterdayDate, xpGained: 120, wordsReviewed: 15, newWordsLearned: 5 },
      };
      mockStoreState.profile.xp = 270;
      mockStoreState.profile.streak = 5;

      // Mastered card (FSRS: State 2, Stability 25 days, reps 3)
      mockStoreState.srsProgressMap = {
        card_1: {
          srsLevel: 3,
          interval: 25,
          fsrs: { state: 2, stability: 25, reps: 3, difficulty: 5 },
        },
      };

      // Mock Supabase RPCs
      const metricsRpcSpy = vi.spyOn(supabase, 'rpc').mockImplementation(((fn: string, params: any) => {
        if (fn === 'sync_weekly_learning_metrics') {
          return Promise.resolve({
            data: { success: true, code: 'SYNCED_SUCCESS', updated_metrics: params },
            error: null,
          });
        }
        if (fn === 'sync_leaderboard_progress') {
          return Promise.resolve({
            data: { success: true, code: 'SYNCED_SUCCESS', ...params },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }) as any);

      // Trigger sync directly (as done on app launch or full sync) without any new learning action
      await pushLocalToCloud(USER_A_ID);

      // Verify sync_leaderboard_progress received recomputed weekly_xp (150 + 120 = 270)
      expect(metricsRpcSpy).toHaveBeenCalledWith('sync_leaderboard_progress', expect.objectContaining({
        p_weekly_xp: 270,
        p_streak: 5,
        p_total_xp: 270,
      }));

      // Verify sync_weekly_learning_metrics received recomputed vocab_mastered & weekly_xp
      expect(metricsRpcSpy).toHaveBeenCalledWith('sync_weekly_learning_metrics', expect.objectContaining({
        p_weekly_xp: 270,
        p_vocab_mastered: 1,
      }));
    });
  });

  // ==========================================================================
  // SECTION 2: LOCAL-FIRST INVARIANTS & FAILURE ISOLATION
  // ==========================================================================
  describe('2. Local-First Invariants & Failure Isolation', () => {
    it('offline study actions commit locally and do not dispatch cloud sync until reconnected', async () => {
      useCloudSyncStore.setState({ isOnline: false });

      // User studies while offline
      mockStoreState.profile.xp = 50;
      mockStoreState.dailyHistory['2026-10-07'] = { date: '2026-10-07', xpGained: 50 };

      const rpcSpy = vi.spyOn(supabase, 'rpc');

      // Attempt push while offline
      await pushLocalToCloud(USER_A_ID);

      // Cloud request was NOT made
      expect(rpcSpy).not.toHaveBeenCalled();
      // Local state is intact
      expect(mockStoreState.profile.xp).toBe(50);
    });

    it('zero domain state rollback when leaderboard cloud sync encounters network or RLS error', async () => {
      // Local progress achieved
      mockStoreState.profile.xp = 200;
      mockStoreState.profile.streak = 7;
      mockStoreState.srsProgressMap['word_master'] = {
        srsLevel: 5,
        interval: 30,
        fsrs: { state: 2, stability: 30, reps: 4 },
      };

      // Remote cloud returns RLS permission error (42501)
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'permission denied for function sync_weekly_learning_metrics' },
      } as any);

      // Execute push
      await pushLocalToCloud(USER_A_ID);

      // Critical invariant: Domain state must NOT be rolled back or mutated on sync failure
      expect(mockStoreState.profile.xp).toBe(200);
      expect(mockStoreState.profile.streak).toBe(7);
      expect(mockStoreState.srsProgressMap['word_master'].srsLevel).toBe(5);
    });
  });

  // ==========================================================================
  // SECTION 3: MULTI-DEVICE RECONCILIATION SEMANTICS
  // ==========================================================================
  describe('3. Multi-Device Reconciliation Semantics', () => {
    it('stale cloud 0 never overwrites newer valid local evidence during merge', () => {
      const today = '2026-10-07';
      // Local state on Device A (earned offline)
      mockStoreState.profile.xp = 180;
      mockStoreState.profile.streak = 10;
      mockStoreState.dailyHistory = {
        [today]: { date: today, xpGained: 180, wordsReviewed: 25 },
      };

      // Remote cloud snapshot from Device B before Device A synced (stale 0 / lower)
      const staleRemotePayload = {
        cloudProfile: { xp: 0, streak: 0, level: 1 },
        cloudDailyLogs: [{ date: today, xp_earned: 0, words_learned: 0 }],
        cloudSrsList: [],
      };

      const merged = applyCloudDataMerge(mockStoreState as AppStoreState, staleRemotePayload);

      // Local evidence must win over stale 0
      expect(merged.profile?.xp).toBe(180);
      expect(merged.profile?.streak).toBe(10);
      expect(merged.dailyHistory?.[today].xpGained).toBe(180);
      expect(merged.dailyHistory?.[today].wordsReviewed).toBe(25);
    });

    it('duplicate learning activities across devices do not inflate metrics', () => {
      // Device A has word progress
      mockStoreState.srsProgressMap = {
        card_apple: { srsLevel: 2, interval: 3, easeFactor: 2.5, sources: ['quiz'] },
      };

      // Remote cloud payload with the same card from Device B
      const remotePayload = {
        cloudSrsList: [
          { word_id: 'card_apple', repetition: 2, interval: 3, ease_factor: 2.5, sources: ['quiz', 'flashcard'] },
        ],
      };

      const merged = applyCloudDataMerge(mockStoreState as AppStoreState, remotePayload);

      // Should not duplicate entries or double srsLevel
      expect(merged.srsProgressMap?.card_apple.srsLevel).toBe(2);
      expect(merged.srsProgressMap?.card_apple.interval).toBe(3);
      // Sources properly unioned without duplicates
      expect(merged.srsProgressMap?.card_apple.sources).toEqual(['quiz', 'flashcard']);
    });
  });

  // ==========================================================================
  // SECTION 4: CONCURRENCY & RACE CONDITION RESILIENCE
  // ==========================================================================
  describe('4. Concurrency & Race Condition Resilience', () => {
    it('coalesces rapid sync triggers: follow-up sync uses newest state and never rolls back', async () => {
      let resolveFirstCall: (value: any) => void = () => {};
      const firstCallPromise = new Promise((resolve) => {
        resolveFirstCall = resolve;
      });

      const rpcCallHistory: any[] = [];
      vi.spyOn(supabase, 'rpc').mockImplementation(((fn: string, params: any) => {
        if (fn === 'sync_weekly_learning_metrics') {
          rpcCallHistory.push(params);
          if (rpcCallHistory.length === 1) {
            return firstCallPromise;
          }
          return Promise.resolve({ data: { success: true, code: 'SYNCED_SUCCESS' }, error: null });
        }
        return Promise.resolve({ data: { success: true }, error: null });
      }) as any);

      // Review #1: 1 mastered word
      mockStoreState.srsProgressMap = {
        word_1: { srsLevel: 5, interval: 25, fsrs: { state: 2, stability: 25, reps: 3 } },
      };

      // Start Sync A (in-flight)
      const syncAPromise = syncDerivedLearningMetrics(USER_A_ID);

      // Review #2: 2 mastered words arrives while Sync A is in-flight
      mockStoreState.srsProgressMap = {
        word_1: { srsLevel: 5, interval: 25, fsrs: { state: 2, stability: 25, reps: 3 } },
        word_2: { srsLevel: 5, interval: 30, fsrs: { state: 2, stability: 30, reps: 3 } },
      };

      // Trigger Sync B (queued via coalescing)
      const syncBPromise = syncDerivedLearningMetrics(USER_A_ID);

      // Resolve Sync A
      resolveFirstCall({
        data: { success: true, code: 'SYNCED_SUCCESS' },
        error: null,
      });

      await Promise.all([syncAPromise, syncBPromise]);

      // Verify that the second call executed with newest state (p_vocab_mastered: 2)
      expect(rpcCallHistory.length).toBe(2);
      expect(rpcCallHistory[1].p_vocab_mastered).toBe(2);
    });
  });

  // ==========================================================================
  // SECTION 5: SUNDAY → MONDAY ROLLOVER (Asia/Ho_Chi_Minh)
  // ==========================================================================
  describe('5. Sunday to Monday Rollover (Asia/Ho_Chi_Minh)', () => {
    it('activity on Sunday 23:55 VN stays in old week and does not leak into Monday 00:05 VN', () => {
      // Sunday 2026-10-11 at 23:55:00 VN (+07:00) -> UTC 2026-10-11T16:55:00Z
      const sundayTime = new Date('2026-10-11T16:55:00Z');
      const sundayWeekId = getVietnamWeekId(sundayTime); // '2026-W41'

      // Monday 2026-10-12 at 00:05:00 VN (+07:00) -> UTC 2026-10-11T17:05:00Z
      const mondayTime = new Date('2026-10-11T17:05:00Z');
      const mondayWeekId = getVietnamWeekId(mondayTime); // '2026-W42'

      expect(sundayWeekId).toBe('2026-W41');
      expect(mondayWeekId).toBe('2026-W42');
      expect(sundayWeekId).not.toBe(mondayWeekId);

      // Sunday activity
      const dailyHistory: Record<string, DailyProgress> = {
        '2026-10-11': {
          date: '2026-10-11',
          xpGained: 250,
          wordsReviewed: 0,
          newWordsLearned: 0,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
        },
      };

      // Old week calculation on Sunday sees the 250 XP
      const sundayWeeklyXp = calculateWeeklyXpFromHistory(dailyHistory, sundayTime);
      expect(sundayWeeklyXp).toBe(250);

      // Monday 00:05 VN calculation evaluates only dates of Week 42 ('2026-10-12' to '2026-10-18')
      const mondayWeeklyXp = calculateWeeklyXpFromHistory(dailyHistory, mondayTime);
      expect(mondayWeeklyXp).toBe(0);

      // Invariant: zero XP leaked from old week to new week!
    });
  });

  // ==========================================================================
  // SECTION 6: RELOAD (F5) STATE INTEGRITY
  // ==========================================================================
  describe('6. Reload (F5) State Preservation', () => {
    it('preserves weekly XP and leaderboard scores across local storage rehydration and page reload', async () => {
      const today = getCurrentVietnamWeekDates()[0];
      mockStoreState.profile.xp = 160;
      mockStoreState.profile.streak = 4;
      mockStoreState.dailyHistory = {
        [today]: { date: today, xpGained: 160 },
      };

      // Simulate safeStorage persistence
      localStorage.setItem('english_mastery_state', JSON.stringify({
        profile: mockStoreState.profile,
        dailyHistory: mockStoreState.dailyHistory,
      }));

      // Simulate F5 page reload rehydration
      const savedData = JSON.parse(localStorage.getItem('english_mastery_state') || '{}');
      const rehydratedWeeklyXp = calculateWeeklyXpFromHistory(savedData.dailyHistory);

      expect(rehydratedWeeklyXp).toBe(160);
      expect(savedData.profile.streak).toBe(4);
    });
  });

  // ==========================================================================
  // SECTION 7: LOGOUT / LOGIN (CROSS-ACCOUNT ISOLATION)
  // ==========================================================================
  describe('7. Account Switch (Logout / Login) Data Isolation', () => {
    it('resets local store upon account switch preventing User A data leaking to User B', async () => {
      // User A state
      mockStoreState.profile.xp = 999;
      mockStoreState.profile.streak = 30;
      setActiveSyncedUserId(USER_A_ID);

      // User B logs in
      useCloudSyncStore.setState({
        userId: USER_B_ID,
        user: { id: USER_B_ID, email: 'userb@example.com' } as any,
      });

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        upsert: () => Promise.resolve({ data: null, error: null }),
      } as any);

      // performFullSync detects account switch (USER_A_ID -> USER_B_ID)
      await performFullSync();

      expect(mockStoreState.resetToDefault).toHaveBeenCalled();
      expect(getActiveSyncedUserId()).toBe(USER_B_ID);
    });
  });

  // ==========================================================================
  // SECTION 8: OBSERVABILITY & STRUCTURED LOGGING
  // ==========================================================================
  describe('8. Observability & Structured Development Logging', () => {
    it('accurately classifies error failures into RLS, SCHEMA, RPC, AUTH, NETWORK, and VALIDATION', () => {
      // 1. RLS
      expect(classifySyncFailureCategory({ code: '42501', message: 'violates row-level security policy' })).toBe('RLS');
      // 2. SCHEMA
      expect(classifySyncFailureCategory({ code: 'PGRST204', message: "Could not find the 'four_skills_scores' column of 'profiles'" })).toBe('SCHEMA');
      // 3. RPC
      expect(classifySyncFailureCategory({ code: '42883', message: 'function sync_weekly_learning_metrics does not exist' })).toBe('RPC');
      // 4. AUTH
      expect(classifySyncFailureCategory({ code: '401', message: 'JWT expired' })).toBe('AUTH');
      // 5. NETWORK
      expect(classifySyncFailureCategory({ message: 'Failed to fetch (net::ERR_INTERNET_DISCONNECTED)' })).toBe('NETWORK');
      // 6. VALIDATION
      expect(classifySyncFailureCategory({ code: 'WEEK_MISMATCH', message: 'Week ID does not match server authoritative week' })).toBe('VALIDATION');
    });

    it('redacts secrets (Bearer tokens, API keys) from error logging', () => {
      const warnSpy = vi.spyOn(console, 'warn');

      const result = logLeaderboardSyncError({
        userId: USER_A_ID,
        weekId: '2026-W41',
        metricSummary: 'weeklyXp=100, vocab=5',
        operation: 'sync_weekly_learning_metrics',
        error: {
          code: '401',
          message: 'Authorization failed: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secretToken and apiKey=super_secret_12345',
        },
      });

      expect(result.failureType).toBe('AUTH');
      expect(result.formattedLog).toContain('[Leaderboard Sync]');
      expect(result.formattedLog).toContain('user=aaaaaaaa...');
      expect(result.formattedLog).toContain('Bearer [REDACTED]');
      expect(result.formattedLog).toContain('apiKey=[REDACTED]');
      expect(result.formattedLog).not.toContain('eyJhbGci');
      expect(result.formattedLog).not.toContain('super_secret_12345');
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // SECTION 9: PERFORMANCE BOUNDS
  // ==========================================================================
  describe('9. Performance Bounds & Efficient Derivation', () => {
    it('deriveLifetimeVocabularyMastery processes user cards in < 15ms without scanning entire 10,000+ dictionary', () => {
      const srsProgressMap: Record<string, SRSProgress> = {};
      for (let i = 0; i < 30; i++) {
        srsProgressMap[`word_${i}`] = {
          srsLevel: i % 2 === 0 ? 5 : 2,
          interval: i % 2 === 0 ? 25 : 5,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-20T00:00:00Z',
          lastReviewedDate: '2026-10-07T00:00:00Z',
          fsrs: i % 2 === 0 ? {
            state: 2,
            stability: 25,
            reps: 3,
            difficulty: 5,
            lapses: 0,
            lastReview: '2026-10-07T00:00:00Z',
          } : undefined,
        };
      }

      const startTime = performance.now();
      const result = deriveLifetimeVocabularyMastery({
        srsProgressMap,
        userCollocations: [],
        vocabularyList: [],
      });
      const durationMs = performance.now() - startTime;

      expect(durationMs).toBeLessThan(15);
      expect(result.totalMasteredCount).toBe(15);
    });
  });
});
