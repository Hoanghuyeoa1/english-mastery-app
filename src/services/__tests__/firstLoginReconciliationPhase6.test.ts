// @vitest-environment happy-dom
// src/services/__tests__/firstLoginReconciliationPhase6.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '../../lib/supabaseClient';
import {
  calculateWeeklyXpFromHistory,
  getCurrentVietnamWeekDates,
  getAuthoritativeVietnamWeekId,
  syncUserScoreToLeaderboard,
  syncWeeklyLearningMetricsToServer,
} from '../leaderboardService';
import {
  deriveLeaderboardLearningMetrics,
  syncDerivedLearningMetrics,
  getVietnamDateString,
} from '../leaderboardLearningMetrics';
import {
  performFullSync,
  pushLocalToCloud,
  useCloudSyncStore,
  setActiveSyncedUserId,
  getActiveSyncedUserId,
  registerCloudSyncStoreGetter,
  clearSyncCoordinatorForTesting,
} from '../cloudSyncService';
import { applyCloudDataMerge } from '../../store/cloudDataMerger';
import type { AppStoreState, DailyProgress, SRSProgress, VocabWord, CollocationItem, SRSReviewEvent } from '../../types';

describe('PHASE 6 — First Login Local-to-Cloud Reconciliation & Invariants', () => {
  const TEST_USER_ID = '98765432-1111-4aaa-8bbb-123456789abc';

  let mockStoreState: AppStoreState;

  beforeEach(() => {
    vi.clearAllMocks();
    clearSyncCoordinatorForTesting();
    localStorage.clear();

    mockStoreState = {
      profile: {
        name: 'Học viên Local',
        xp: 0,
        level: 1,
        streak: 0,
        equippedFrame: null,
        unlockedFrames: [],
        lastStudyDate: null,
        lastActiveDate: null,
      },
      dailyHistory: {} as Record<string, DailyProgress>,
      srsProgressMap: {} as Record<string, SRSProgress>,
      userCustomWords: [] as VocabWord[],
      userCollocations: [] as CollocationItem[],
      recentReviewEvents: [] as SRSReviewEvent[],
      mistakeBank: {},
      fourSkillsScores: {},
      completedListeningLessonIds: [],
      fourSkillsCompletionProgress: { reading: [], speaking: [], writing: [] },
      hasLearnedNightOwl: false,
      srsAlgorithm: 'sm2',
      fsrsSettings: undefined,
      resetToDefault: vi.fn(() => {
        mockStoreState.profile = {
          name: 'Học viên Local',
          xp: 0,
          level: 1,
          streak: 0,
          equippedFrame: null,
          unlockedFrames: [],
          lastStudyDate: null,
          lastActiveDate: null,
        } as any;
        mockStoreState.dailyHistory = {};
        mockStoreState.srsProgressMap = {};
        mockStoreState.userCustomWords = [];
        mockStoreState.userCollocations = [];
        mockStoreState.recentReviewEvents = [];
        mockStoreState.mistakeBank = {};
      }),
      mergeCloudData: vi.fn((payload: any) => {
        const merged = applyCloudDataMerge(mockStoreState, payload);
        Object.assign(mockStoreState, merged);
      }),
    } as unknown as AppStoreState;

    registerCloudSyncStoreGetter(() => mockStoreState);

    useCloudSyncStore.setState({
      isOnline: true,
      userId: TEST_USER_ID,
      user: { id: TEST_USER_ID, email: 'learner@example.com' } as any,
      status: 'idle',
      userEmail: 'learner@example.com',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearSyncCoordinatorForTesting();
    localStorage.clear();
  });

  // ============================================================================
  // TEST 1: CASE A — Local newer than stale cloud snapshot
  // ============================================================================
  it('Case A: preserves valid local progress when cloud returns a stale snapshot (xp: 0, streak: 0)', () => {
    const weekDates = getCurrentVietnamWeekDates();
    const today = weekDates[0];

    // Local user accumulated substantial offline progress
    mockStoreState.profile.xp = 850;
    mockStoreState.profile.streak = 6;
    mockStoreState.dailyHistory[today] = {
      date: today,
      xpGained: 850,
      wordsReviewed: 25,
      newWordsLearned: 10,
      quizzesCompleted: 0,
      pronunciationsMastered: 0,
    };

    // 120 mastered words in local SRS
    for (let i = 1; i <= 120; i++) {
      mockStoreState.srsProgressMap[`word_${i}`] = {
        srsLevel: 4,
        interval: 21,
        easeFactor: 2.5,
        nextReviewDate: '2026-10-20T00:00:00.000Z',
        lastReviewedDate: '2026-10-08T00:00:00.000Z',
      };
    }

    // Cloud returns an old/empty snapshot from another inactive device
    const staleCloudPayload = {
      cloudProfile: {
        id: TEST_USER_ID,
        xp: 0,
        streak: 0,
        level: 1,
        display_name: 'Stale Cloud User',
      },
      cloudSrsList: [],
      cloudDailyLogs: [
        {
          date: today,
          words_learned: 0,
          xp_earned: 0,
        },
      ],
    };

    // Execute merge
    const mergedPatch = applyCloudDataMerge(mockStoreState, staleCloudPayload);
    Object.assign(mockStoreState, mergedPatch);

    // Assert: Local progress is 100% intact, cloud 0 does NOT overwrite local
    expect(mockStoreState.profile.xp).toBe(850);
    expect(mockStoreState.profile.streak).toBe(6);
    expect(mockStoreState.dailyHistory[today].xpGained).toBe(850);
    expect(Object.keys(mockStoreState.srsProgressMap).length).toBe(120);

    // Derived weekly XP stays 850
    const derivedWeeklyXp = calculateWeeklyXpFromHistory(mockStoreState.dailyHistory);
    expect(derivedWeeklyXp).toBe(850);
  });

  // ============================================================================
  // TEST 2: CASE B — Cloud valid > Local (Cross-device remote progress wins)
  // ============================================================================
  it('Case B: reconciles cloud progress when remote has valid higher activity (xp: 800 > local 300)', () => {
    const weekDates = getCurrentVietnamWeekDates();
    const today = weekDates[0];

    // Local user only studied a little bit today on this device (300 XP)
    mockStoreState.profile.xp = 300;
    mockStoreState.profile.streak = 2;
    mockStoreState.dailyHistory[today] = {
      date: today,
      xpGained: 300,
      wordsReviewed: 5,
      newWordsLearned: 2,
      quizzesCompleted: 0,
      pronunciationsMastered: 0,
    };
    mockStoreState.srsProgressMap['apple'] = {
      srsLevel: 1,
      interval: 1,
      easeFactor: 2.5,
      nextReviewDate: '2026-10-10',
    };

    // Remote account has higher legitimate progress from another device today (800 XP)
    const validCloudPayload = {
      cloudProfile: {
        id: TEST_USER_ID,
        xp: 800,
        streak: 5,
        level: 3,
        display_name: 'Learner Multi-device',
      },
      cloudSrsList: [
        {
          word_id: 'apple',
          repetition: 3,
          interval: 7,
          ease_factor: 2.6,
        },
      ],
      cloudDailyLogs: [
        {
          date: today,
          words_learned: 20,
          xp_earned: 800,
        },
      ],
    };

    const mergedPatch = applyCloudDataMerge(mockStoreState, validCloudPayload);
    Object.assign(mockStoreState, mergedPatch);

    // Assert: Remote valid higher stats win deterministically
    expect(mockStoreState.profile.xp).toBe(800);
    expect(mockStoreState.profile.streak).toBe(5);
    expect(mockStoreState.dailyHistory[today].xpGained).toBe(800);
    expect(mockStoreState.srsProgressMap['apple'].srsLevel).toBe(3);
    expect(mockStoreState.srsProgressMap['apple'].interval).toBe(7);

    // Derived weekly XP reflects 800
    const derivedWeeklyXp = calculateWeeklyXpFromHistory(mockStoreState.dailyHistory);
    expect(derivedWeeklyXp).toBe(800);
  });

  // ============================================================================
  // TEST 3: Week Identity Invariant — Old-week local XP never leaks to current week
  // ============================================================================
  it('Week Identity Invariant: old-week local XP remains in history but is not counted towards current weekly XP', () => {
    const currentWeekDates = getCurrentVietnamWeekDates();
    const today = currentWeekDates[0];

    // 5000 XP logged in previous weeks (e.g., 14 days ago)
    const pastDate = '2026-09-20'; // A date outside the current Vietnam week
    mockStoreState.dailyHistory[pastDate] = {
      date: pastDate,
      xpGained: 5000,
      wordsReviewed: 150,
      newWordsLearned: 30,
      quizzesCompleted: 0,
      pronunciationsMastered: 0,
    };

    // Current week has only 80 XP logged today
    mockStoreState.dailyHistory[today] = {
      date: today,
      xpGained: 80,
      wordsReviewed: 5,
      newWordsLearned: 1,
      quizzesCompleted: 0,
      pronunciationsMastered: 0,
    };

    mockStoreState.profile.xp = 5080;

    // calculateWeeklyXpFromHistory strictly restricts to getCurrentVietnamWeekDates()
    const currentWeekXp = calculateWeeklyXpFromHistory(mockStoreState.dailyHistory);
    expect(currentWeekXp).toBe(80);
    expect(currentWeekXp).not.toBe(5080);

    // Past daily history entry is securely retained for lifetime analytics
    expect(mockStoreState.dailyHistory[pastDate].xpGained).toBe(5000);
  });

  // ============================================================================
  // TEST 4: First login with missing cloud row (Empty cloud profile)
  // ============================================================================
  it('First login: handles missing cloud row (empty DB) without resetting local guest state', () => {
    // Guest has never logged in before (active user id is null)
    expect(getActiveSyncedUserId()).toBeNull();

    mockStoreState.profile.name = 'Khách Tự Học';
    mockStoreState.profile.xp = 420;
    mockStoreState.profile.streak = 4;
    mockStoreState.userCustomWords = [
      { id: 'w1', word: 'resilience', meaning: 'sự kiên cường' } as VocabWord,
    ];
    mockStoreState.srsProgressMap['w1'] = {
      srsLevel: 2,
      interval: 3,
      easeFactor: 2.5,
      nextReviewDate: '2026-10-12',
    };

    // Remote database returns null profile and empty collections for fresh account
    const emptyCloudPayload = {
      cloudProfile: null,
      cloudSrsList: [],
      cloudDailyLogs: [],
      cloudCustomWords: [],
    };

    const mergedPatch = applyCloudDataMerge(mockStoreState, emptyCloudPayload);
    Object.assign(mockStoreState, mergedPatch);

    // Assert: Zero data loss for first-time login
    expect(mockStoreState.profile.name).toBe('Khách Tự Học');
    expect(mockStoreState.profile.xp).toBe(420);
    expect(mockStoreState.profile.streak).toBe(4);
    expect(mockStoreState.userCustomWords.length).toBe(1);
    expect(mockStoreState.srsProgressMap['w1'].srsLevel).toBe(2);
  });

  // ============================================================================
  // TEST 5: Existing cloud row reconciliation (Union of distinct learning entities)
  // ============================================================================
  it('reconciles existing cloud row by taking the union of distinct words, collocations, and dates', () => {
    // Local unique entities
    mockStoreState.userCustomWords = [
      { id: 'custom_local_1', word: 'serendipity', meaning: 'sự tình cờ may mắn' } as VocabWord,
    ];
    mockStoreState.userCollocations = [
      { id: 'colloc_local_1', phrase: 'take advantage of', meaning: 'tận dụng' } as CollocationItem,
    ];
    mockStoreState.dailyHistory['2026-10-06'] = {
      date: '2026-10-06',
      xpGained: 150,
      wordsReviewed: 10,
      newWordsLearned: 5,
      quizzesCompleted: 0,
      pronunciationsMastered: 0,
    };

    // Cloud has different unique entities
    const cloudPayload = {
      cloudProfile: { id: TEST_USER_ID, xp: 350 },
      cloudCustomWords: [
        { id: 'custom_cloud_2', word: 'ephemeral', meaning: 'phù du' },
      ],
      cloudCollocations: [
        { id: 'colloc_cloud_2', phrase: 'bear in mind', meaning: 'ghi nhớ' },
      ],
      cloudDailyLogs: [
        { date: '2026-10-07', words_learned: 15, xp_earned: 200 },
      ],
    };

    const mergedPatch = applyCloudDataMerge(mockStoreState, cloudPayload);
    Object.assign(mockStoreState, mergedPatch);

    // Both words are preserved
    expect(mockStoreState.userCustomWords.map((w) => w.word)).toContain('serendipity');
    expect(mockStoreState.userCustomWords.map((w) => w.word)).toContain('ephemeral');

    // Both collocations are preserved
    expect(mockStoreState.userCollocations.map((c) => c.phrase)).toContain('take advantage of');
    expect(mockStoreState.userCollocations.map((c) => c.phrase)).toContain('bear in mind');

    // Both days are in dailyHistory
    expect(mockStoreState.dailyHistory['2026-10-06'].xpGained).toBe(150);
    expect(mockStoreState.dailyHistory['2026-10-07'].xpGained).toBe(200);
  });

  // ============================================================================
  // TEST 6: Login after long local-only usage (Offline accumulation preservation)
  // ============================================================================
  it('preserves full offline history after 14 days of local-only usage when logging in', () => {
    // Simulate 14 distinct days in dailyHistory
    for (let d = 1; d <= 14; d++) {
      const dayStr = `2026-09-${d.toString().padStart(2, '0')}`;
      mockStoreState.dailyHistory[dayStr] = {
        date: dayStr,
        xpGained: 50 * d,
        wordsReviewed: d * 5,
        newWordsLearned: 5,
        quizzesCompleted: 0,
        pronunciationsMastered: 0,
      };
    }

    // Cloud has 1 old log from 2 months ago
    const cloudPayload = {
      cloudProfile: { id: TEST_USER_ID, xp: 50 },
      cloudDailyLogs: [
        { date: '2026-08-01', words_learned: 5, xp_earned: 50 },
      ],
    };

    const mergedPatch = applyCloudDataMerge(mockStoreState, cloudPayload);
    Object.assign(mockStoreState, mergedPatch);

    // 14 offline days + 1 cloud day = 15 total days
    const allDates = Object.keys(mockStoreState.dailyHistory);
    expect(allDates.length).toBe(15);
    expect(allDates).toContain('2026-08-01');
    expect(allDates).toContain('2026-09-14');
    expect(mockStoreState.dailyHistory['2026-09-14'].xpGained).toBe(700);
  });

  // ============================================================================
  // TEST 7: Local-First Invariant — Sync failure does NOT rollback local progress
  // ============================================================================
  it('Local-First Invariant: network failure during performFullSync preserves local progress without rollback', async () => {
    mockStoreState.profile.xp = 1200;
    mockStoreState.profile.streak = 10;
    mockStoreState.srsProgressMap['vital_card'] = {
      srsLevel: 5,
      interval: 35,
      easeFactor: 2.5,
      nextReviewDate: '2026-10-30',
    };

    // Simulate Supabase network outage on select
    vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Failed to fetch: Connection refused (Offline)'),
      }),
    } as any);

    const result = await performFullSync();

    // Sync reported failure gracefully
    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();

    // Local Zustand state did NOT roll back
    expect(mockStoreState.profile.xp).toBe(1200);
    expect(mockStoreState.profile.streak).toBe(10);
    expect(mockStoreState.srsProgressMap['vital_card'].srsLevel).toBe(5);
  });

  // ============================================================================
  // TEST 8: Fresh quality metrics derivation after reconciliation
  // ============================================================================
  it('recomputes quality metrics from fresh state after merge without using stale cached projection', () => {
    // Reconcile brings in 3 mastered cards with legitimate study evidence
    mockStoreState.srsProgressMap['word_a'] = {
      srsLevel: 4,
      interval: 21,
      easeFactor: 2.5,
      nextReviewDate: '2026-10-25',
      lastReviewedDate: '2026-10-08T00:00:00.000Z',
    };
    mockStoreState.srsProgressMap['word_b'] = {
      srsLevel: 4,
      interval: 25,
      easeFactor: 2.5,
      nextReviewDate: '2026-10-25',
      lastReviewedDate: '2026-10-08T00:00:00.000Z',
    };
    mockStoreState.srsProgressMap['word_c'] = {
      srsLevel: 5,
      interval: 60,
      easeFactor: 2.5,
      nextReviewDate: '2026-10-25',
      lastReviewedDate: '2026-10-08T00:00:00.000Z',
    };

    const today = getVietnamDateString();
    mockStoreState.dailyHistory[today] = {
      date: today,
      xpGained: 120,
      wordsReviewed: 0,
      newWordsLearned: 0,
      quizzesCompleted: 0,
      pronunciationsMastered: 0,
    };

    // deriveLeaderboardLearningMetrics directly queries the freshly merged store state
    const derived = deriveLeaderboardLearningMetrics(mockStoreState, {
      userId: TEST_USER_ID,
    });

    expect(derived.vocabMastered).toBe(3);
    expect(derived.weeklyXp).toBe(120);
    expect(derived.weekId).toBe(getAuthoritativeVietnamWeekId());
    expect(derived.eligibility.vocab).toBe(true);
  });
});
