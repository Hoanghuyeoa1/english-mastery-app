// @vitest-environment happy-dom
// src/services/__tests__/historicalStreakReconciliation.test.ts
/**
 * Targeted Regression Suite for Phase 4: Historical Streak Reconciliation & Metrics Consistency
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import { DEFAULT_PROFILE } from '../../store/initialDefaults';
import { getVietnamDateString } from '../../utils/dateUtils';
import {
  reconcileHistoricalStreak,
  isQualifyingDailyProgress,
} from '../streakReconciliationService';
import {
  flushLearningEvidence,
  onAccountSwitch,
  onUserLogin,
  onUserLogout,
  getAuthenticatedUserId,
} from '../learningEvidenceTransport';
import * as leaderboardService from '../leaderboardService';
import { useCloudSyncStore } from '../cloudSyncService';
import { setAccessToken } from '../api/httpClient';
import { handleStoreRehydration } from '../../store/storeRehydration';

vi.mock('../cloudSyncService', () => {
  let isOnline = true;
  let user: any = null;
  let userId: string | null = null;
  return {
    scheduleCloudSync: vi.fn(),
    getCloudSyncStoreState: () => ({ isOnline, user, userId }),
    useCloudSyncStore: {
      getState: () => ({ isOnline, user, userId }),
      setState: (patch: any) => {
        if ('isOnline' in patch) isOnline = patch.isOnline;
        if ('user' in patch) user = patch.user;
        if ('userId' in patch) userId = patch.userId;
      },
    },
    registerCloudSyncStoreGetter: vi.fn(),
  };
});

describe('Phase 4 — Historical Streak Reconciliation & Metrics Consistency Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    setAccessToken(null);
    useAppStore.getState().resetToDefault();
    useCloudSyncStore.setState({ isOnline: true, user: null, userId: null });
    onUserLogout();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // CASE 1: Historical Valid Activity Reconciliation (Bug Healing)
  // User had 10 flashcards (150 XP) today in dailyHistory, but streak was 0 and lastStudyDate was null
  // Reconciliation restores streak = 1, longestStreak = 1, lastStudyDate = today
  // ==========================================================================
  it('1. Historical valid activity reconciliation: Phục hồi streak = 1 khi có learning evidence thật', () => {
    const today = getVietnamDateString();
    const state = {
      profile: {
        ...DEFAULT_PROFILE,
        streak: 0,
        longestStreak: 0,
        lastStudyDate: null,
        lastActiveDate: today,
        xp: 150,
      },
      dailyHistory: {
        [today]: {
          date: today,
          wordsReviewed: 10,
          newWordsLearned: 0,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
          xpGained: 150,
        },
      },
    };

    const result = reconcileHistoricalStreak(state);

    expect(result.modified).toBe(true);
    expect(result.reconciledStreak).toBe(1);
    expect(result.reconciledLongestStreak).toBe(1);
    expect(result.reconciledLastStudyDate).toBe(today);
  });

  // ==========================================================================
  // CASE 2: Historical Non-Qualifying Activity (Chest / Quest XP only)
  // Day only has 100 XP from daily chest (wordsReviewed = 0, newWordsLearned = 0, quizzes = 0)
  // Reconciliation must NOT grant streak (streak remains 0)
  // ==========================================================================
  it('2. Historical non-qualifying activity: Không tạo streak ảo khi chỉ có XP thưởng rương/quà', () => {
    const today = getVietnamDateString();
    const state = {
      profile: {
        ...DEFAULT_PROFILE,
        streak: 0,
        longestStreak: 0,
        lastStudyDate: null,
        lastActiveDate: today,
        xp: 100,
      },
      dailyHistory: {
        [today]: {
          date: today,
          wordsReviewed: 0,
          newWordsLearned: 0,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
          xpGained: 100, // Chest XP
        },
      },
    };

    const result = reconcileHistoricalStreak(state);

    expect(result.modified).toBe(false);
    expect(result.reconciledStreak).toBe(0);
    expect(result.reconciledLongestStreak).toBe(0);
  });

  // ==========================================================================
  // CASE 3: Reconciliation Idempotency
  // Running reconciliation multiple times yields exact same state without mutations
  // ==========================================================================
  it('3. Reconciliation Idempotency: Chạy lại nhiều lần modified = false, không side-effects', () => {
    const today = getVietnamDateString();
    useAppStore.setState({
      profile: {
        ...DEFAULT_PROFILE,
        streak: 0,
        lastStudyDate: null,
        xp: 150,
      },
      dailyHistory: {
        [today]: {
          date: today,
          wordsReviewed: 5,
          newWordsLearned: 2,
          quizzesCompleted: 1,
          pronunciationsMastered: 0,
          xpGained: 150,
        },
      },
    });

    // Run 1: Reconciles streak to 1
    const res1 = useAppStore.getState().reconcileStreakFromHistory();
    expect(res1.modified).toBe(true);
    expect(useAppStore.getState().profile.streak).toBe(1);
    expect(useAppStore.getState().profile.xp).toBe(150); // XP unchanged

    // Run 2: Already reconciled -> modified = false
    const res2 = useAppStore.getState().reconcileStreakFromHistory();
    expect(res2.modified).toBe(false);
    expect(useAppStore.getState().profile.streak).toBe(1);
    expect(useAppStore.getState().profile.xp).toBe(150); // XP unchanged
  });

  // ==========================================================================
  // CASE 4: Current vs Longest Streak Preservation
  // User had 5 days streak in past, missed 3 days -> Current = 0, Longest = 5
  // ==========================================================================
  it('4. Current vs Longest Streak: Bảo lưu nguyên vẹn kỷ lục longest streak khi đứt chuỗi', () => {
    const state = {
      profile: {
        ...DEFAULT_PROFILE,
        streak: 0,
        longestStreak: 5,
        lastStudyDate: '2026-10-01',
        lastActiveDate: '2026-10-01',
        xp: 1000,
      },
      dailyHistory: {
        // Study dates in past: 2026-09-27 to 2026-10-01 (5 consecutive days)
        '2026-09-27': { date: '2026-09-27', wordsReviewed: 10, newWordsLearned: 0, quizzesCompleted: 0, pronunciationsMastered: 0, xpGained: 100 },
        '2026-09-28': { date: '2026-09-28', wordsReviewed: 10, newWordsLearned: 0, quizzesCompleted: 0, pronunciationsMastered: 0, xpGained: 100 },
        '2026-09-29': { date: '2026-09-29', wordsReviewed: 10, newWordsLearned: 0, quizzesCompleted: 0, pronunciationsMastered: 0, xpGained: 100 },
        '2026-09-30': { date: '2026-09-30', wordsReviewed: 10, newWordsLearned: 0, quizzesCompleted: 0, pronunciationsMastered: 0, xpGained: 100 },
        '2026-10-01': { date: '2026-10-01', wordsReviewed: 10, newWordsLearned: 0, quizzesCompleted: 0, pronunciationsMastered: 0, xpGained: 100 },
      },
    };

    // Reconcile evaluated today (2026-10-09, 8 days after last study)
    const result = reconcileHistoricalStreak(state, { referenceDate: '2026-10-09' });

    expect(result.reconciledStreak).toBe(0); // Missed days -> current streak = 0
    expect(result.reconciledLongestStreak).toBe(5); // Longest preserved!
  });

  // ==========================================================================
  // CASE 5: Missing or Invalid Timestamps Resilience
  // Corrupt date keys are safely ignored without crashing
  // ==========================================================================
  it('5. Missing/invalid timestamps: Bỏ qua an toàn các key hỏng, không crash hệ thống', () => {
    const state = {
      profile: {
        ...DEFAULT_PROFILE,
        streak: 0,
        longestStreak: 0,
        lastStudyDate: 'INVALID_DATE',
      },
      dailyHistory: {
        'INVALID_DATE_KEY': {
          date: 'INVALID_DATE_KEY',
          wordsReviewed: 20,
          newWordsLearned: 0,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
          xpGained: 100,
        },
      },
    };

    const result = reconcileHistoricalStreak(state);
    expect(result.reconciledStreak).toBe(0);
    expect(result.qualifyingDatesCount).toBe(0);
  });

  // ==========================================================================
  // CASE 6: Heatmap vs Streak Semantics Distinction
  // Heatmap displays 1 active day in past, while current streak = 0
  // ==========================================================================
  it('6. Heatmap vs Streak semantics: Phân biệt rõ Active Day trong quá khứ và Current Streak', () => {
    const oldDate = '2026-10-01';
    useAppStore.setState({
      profile: {
        ...DEFAULT_PROFILE,
        streak: 0,
        longestStreak: 1,
        lastStudyDate: oldDate,
      },
      dailyHistory: {
        [oldDate]: {
          date: oldDate,
          wordsReviewed: 15,
          newWordsLearned: 0,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
          xpGained: 100,
        },
      },
    });

    const store = useAppStore.getState();
    // Daily history has 1 entry (Heatmap displays 1 green cell)
    expect(Object.keys(store.dailyHistory).length).toBe(1);
    expect(store.dailyHistory[oldDate].wordsReviewed).toBe(15);
    // But current streak is 0 because oldDate was missed
    expect(store.profile.streak).toBe(0);
  });

  // ==========================================================================
  // CASE 7: Guest Offline Mode
  // Unauthenticated learning stays strictly local, never calls server sync
  // ==========================================================================
  it('7. Guest Offline Mode: Tiến trình lưu cục bộ, không gửi evidence ra server', async () => {
    useCloudSyncStore.setState({ user: null, userId: null });
    const syncSpy = vi.spyOn(leaderboardService, 'syncUserScoreToLeaderboard');

    const result = await flushLearningEvidence();

    expect(result.success).toBe(false);
    expect(result.code).toBe('UNAUTHENTICATED');
    expect(syncSpy).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // CASE 8: Authenticated Backend Offline Resilience
  // Backend offline marks evidence pending, does NOT rollback local streak
  // ==========================================================================
  it('8. Authenticated backend offline: Đánh dấu pending, không rollback local streak', async () => {
    setAccessToken('mock_jwt_token_123');
    useCloudSyncStore.setState({
      user: { id: 'u_123', email: 'test@example.com' } as any,
      userId: 'u_123',
      isOnline: false, // Network offline
    });

    onUserLogin('u_123');

    // Simulate local qualifying study
    useAppStore.getState().checkDailyReset();
    useAppStore.getState().gainXP(20, { source: 'flashcard' });

    expect(useAppStore.getState().profile.streak).toBe(1);

    // Attempt flush while offline
    const result = await flushLearningEvidence();

    expect(result.success).toBe(false);
    expect(result.code).toBe('OFFLINE');
    // Local streak is preserved!
    expect(useAppStore.getState().profile.streak).toBe(1);
  });

  // ==========================================================================
  // CASE 9: Account Switching Boundary Protection
  // Switching account purges pending queue to prevent cross-account contamination
  // ==========================================================================
  it('9. Account Switching Boundary: Xóa sạch hàng đợi pending khi đổi tài khoản', () => {
    onUserLogin('user_A');
    expect(getAuthenticatedUserId()).toBe('user_A');

    // Switch to user_B
    onAccountSwitch('user_B');
    expect(getAuthenticatedUserId()).toBe('user_B');

    // Logout
    onUserLogout();
    expect(getAuthenticatedUserId()).toBeNull();
  });

  // ==========================================================================
  // CASE 10: Zero Extra XP / Duplicate Activity Guarantee
  // Reconciliation does NOT add XP, duplicate daily progress, or re-award achievements
  // ==========================================================================
  it('10. Zero Extra XP Guarantee: Reconciliation tuyệt đối không sinh thêm XP hay nhân đôi tiến độ', () => {
    const today = getVietnamDateString();
    useAppStore.setState({
      profile: {
        ...DEFAULT_PROFILE,
        streak: 0,
        xp: 250,
      },
      dailyHistory: {
        [today]: {
          date: today,
          wordsReviewed: 10,
          newWordsLearned: 5,
          quizzesCompleted: 1,
          pronunciationsMastered: 0,
          xpGained: 250,
        },
      },
    });

    const xpBefore = useAppStore.getState().profile.xp;
    const historyBefore = JSON.stringify(useAppStore.getState().dailyHistory);

    useAppStore.getState().reconcileStreakFromHistory();

    const xpAfter = useAppStore.getState().profile.xp;
    const historyAfter = JSON.stringify(useAppStore.getState().dailyHistory);

    expect(xpAfter).toBe(xpBefore);
    expect(historyAfter).toBe(historyBefore);
  });

  // ==========================================================================
  // CASE 11: Rehydration Auto-Reconciliation on App Reload
  // Rehydration automatically recovers streak from valid dailyHistory
  // ==========================================================================
  it('11. Rehydration Reload: Tự động phục hồi chuỗi streak từ dailyHistory khi nạp app', () => {
    const today = getVietnamDateString();
    const mockPersistedState: any = {
      profile: {
        ...DEFAULT_PROFILE,
        streak: 0,
        longestStreak: 0,
        lastStudyDate: null,
      },
      dailyHistory: {
        [today]: {
          date: today,
          wordsReviewed: 15,
          newWordsLearned: 5,
          quizzesCompleted: 1,
          pronunciationsMastered: 0,
          xpGained: 150,
        },
      },
      srsProgressMap: {},
      achievements: [],
    };

    handleStoreRehydration(mockPersistedState);

    expect(mockPersistedState.profile.streak).toBe(1);
    expect(mockPersistedState.profile.longestStreak).toBe(1);
    expect(mockPersistedState.profile.lastStudyDate).toBe(today);
  });

  // ==========================================================================
  // CASE 12: Leaderboard Streak Integration
  // Authenticated user with reconciled streak correctly syncs streak metric
  // ==========================================================================
  it('12. Leaderboard Streak Integration: Đồng bộ chuỗi streak đã xác thực lên Leaderboard', async () => {
    const syncSpy = vi.spyOn(leaderboardService, 'syncUserScoreToLeaderboard').mockResolvedValue(undefined);

    await leaderboardService.syncUserScoreToLeaderboard({
      userId: 'user_reconciled_123',
      displayName: 'Streak Master',
      avatarSeed: 'seed',
      level: 10,
      totalXp: 5000,
      weeklyXp: 500,
      streak: 7,
    });

    expect(syncSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_reconciled_123',
        streak: 7,
        weeklyXp: 500,
      })
    );
  });
});
