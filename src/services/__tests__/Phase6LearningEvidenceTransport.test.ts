// @vitest-environment happy-dom
// src/services/__tests__/Phase6LearningEvidenceTransport.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  scheduleLearningEvidenceSubmission,
  flushLearningEvidence,
  onUserLogin,
  onUserLogout,
  onAccountSwitch,
  hasPendingOfflineEvidence,
  getPendingEvidenceUserId,
  setAuthenticatedUserId,
  getAuthenticatedUserId,
  resetEvidenceTransportStateForTesting,
  getEvidenceTransportStateForTesting,
} from '../learningEvidenceTransport';
import { setAccessToken } from '../api/httpClient';
import { leaderboardApi } from '../api/leaderboardApi';
import { cloudSyncApi } from '../api/cloudSyncApi';
import {
  registerCloudSyncStoreGetter,
  useCloudSyncStore,
  scheduleCloudSync,
} from '../cloudSyncService';

describe('PHASE 6 — Minimal Authenticated Learning Evidence Transport', () => {
  let mockStoreState: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    resetEvidenceTransportStateForTesting();
    setAccessToken(null);
    setAuthenticatedUserId(null);

    mockStoreState = {
      profile: {
        name: 'Learner One',
        level: 5,
        xp: 1200,
        streak: 7,
        avatarSeed: 'seed_1',
        equippedFrame: 'bronze_frame',
      },
      dailyHistory: {
        '2026-10-08': { xpGained: 150, wordsReviewed: 20 },
      },
      srsProgressMap: {
        card_1: { id: 'card_1', word: 'hello', stability: 25.0, repetitions: 5, srsLevel: 4 },
      },
      userCollocations: [],
      recentReviewEvents: [],
      activeSessions: [],
    };

    registerCloudSyncStoreGetter(() => mockStoreState);
    useCloudSyncStore.getState().setIsOnline(true);
    useCloudSyncStore.getState().setUser(null);
  });

  afterEach(() => {
    resetEvidenceTransportStateForTesting();
    setAccessToken(null);
    setAuthenticatedUserId(null);
  });

  it('1. Local learning offline / unauthenticated: never uploads or fakes online rank', async () => {
    const syncScoreSpy = vi.spyOn(leaderboardApi, 'syncScore');
    const syncMetricsSpy = vi.spyOn(leaderboardApi, 'syncWeeklyMetrics');

    // Unauthenticated user
    setAccessToken(null);
    setAuthenticatedUserId(null);

    const result = await flushLearningEvidence();

    expect(result.success).toBe(false);
    expect(result.code).toBe('UNAUTHENTICATED');
    expect(syncScoreSpy).not.toHaveBeenCalled();
    expect(syncMetricsSpy).not.toHaveBeenCalled();
    expect(hasPendingOfflineEvidence()).toBe(false);

    // Local state remains completely untouched
    expect(mockStoreState.profile.xp).toBe(1200);
  });

  it('2. Authenticated evidence submission: pushes only Leaderboard contracts and clears pending', async () => {
    const syncScoreSpy = vi.spyOn(leaderboardApi, 'syncScore').mockResolvedValue({
      success: true,
      code: 'SYNCED_SUCCESS',
      message: 'OK',
    });

    const syncMetricsSpy = vi.spyOn(leaderboardApi, 'syncWeeklyMetrics').mockResolvedValue({
      success: true,
      code: 'SYNCED_SUCCESS',
      message: 'OK',
      weekId: '2026-W41',
      serverWeekId: '2026-W41',
      weeklyXp: 150,
      vocabMastered: 1,
      reviewConsistency: 100,
      activeMinutes: 10,
    });

    setAccessToken('valid-jwt-token');
    setAuthenticatedUserId('user-123');

    const result = await flushLearningEvidence();

    expect(result.success).toBe(true);
    expect(result.code).toBe('SYNCED_SUCCESS');
    expect(syncScoreSpy).toHaveBeenCalledTimes(1);
    expect(syncMetricsSpy).toHaveBeenCalledTimes(1);

    // Verify payload sent to syncScore
    expect(syncScoreSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 5,
        totalXp: 1200,
        weeklyXp: 150,
        streak: 7,
      })
    );

    // Pending evidence flag must be cleared
    expect(hasPendingOfflineEvidence()).toBe(false);
    expect(getPendingEvidenceUserId()).toBeNull();
  });

  it('3. Duplicate event submission is safe and idempotent', async () => {
    vi.spyOn(leaderboardApi, 'syncScore').mockResolvedValue({
      success: true,
      code: 'SYNCED_SUCCESS',
      message: 'OK',
    });

    vi.spyOn(leaderboardApi, 'syncWeeklyMetrics').mockResolvedValue({
      success: true,
      code: 'SYNCED_SUCCESS',
      message: 'OK',
      weekId: '2026-W41',
      serverWeekId: '2026-W41',
      weeklyXp: 150,
      vocabMastered: 1,
    });

    setAccessToken('valid-jwt-token');
    setAuthenticatedUserId('user-123');

    // First submission
    const res1 = await flushLearningEvidence();
    expect(res1.success).toBe(true);

    // Second duplicate submission
    const res2 = await flushLearningEvidence();
    expect(res2.success).toBe(true);

    // Metrics remain exact same value
    expect(res1.weeklyXp).toBe(res2.weeklyXp);
    expect(mockStoreState.profile.xp).toBe(1200);
  });

  it('4. Login transition: calculates only current week XP from dailyHistory, never lifetime XP', async () => {
    const syncScoreSpy = vi.spyOn(leaderboardApi, 'syncScore').mockResolvedValue({
      success: true,
      code: 'SYNCED_SUCCESS',
      message: 'OK',
    });

    vi.spyOn(leaderboardApi, 'syncWeeklyMetrics').mockResolvedValue({
      success: true,
      code: 'SYNCED_SUCCESS',
      message: 'OK',
    });

    setAccessToken('new-user-token');

    // User has 10,000 lifetime XP, but only 150 gained this week
    mockStoreState.profile.xp = 10000;
    mockStoreState.dailyHistory = {
      '2026-10-08': { xpGained: 150 },
    };

    onUserLogin('user-login-456');
    expect(getAuthenticatedUserId()).toBe('user-login-456');

    await flushLearningEvidence();

    expect(syncScoreSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        totalXp: 10000,
        weeklyXp: 150, // NOT 10000! Strictly current week!
      })
    );
  });

  it('5. Account switching: purges pending queue to prevent cross-account evidence leakage', async () => {
    // User A had pending offline evidence
    setAccessToken('user-a-token');
    setAuthenticatedUserId('user-A');
    useCloudSyncStore.getState().setIsOnline(false);

    const offlineRes = await flushLearningEvidence();
    expect(offlineRes.code).toBe('OFFLINE');
    expect(hasPendingOfflineEvidence()).toBe(true);
    expect(getPendingEvidenceUserId()).toBe('user-A');

    // Account switch to User B occurs
    onAccountSwitch('user-B');

    // User A's pending evidence must be purged!
    expect(hasPendingOfflineEvidence()).toBe(false);
    expect(getPendingEvidenceUserId()).toBeNull();
    expect(getAuthenticatedUserId()).toBe('user-B');
  });

  it('6. Offline & Reconnect: holds pending evidence and automatically flushes upon online event', async () => {
    const syncMetricsSpy = vi.spyOn(leaderboardApi, 'syncWeeklyMetrics').mockResolvedValue({
      success: true,
      code: 'SYNCED_SUCCESS',
      message: 'OK',
    });

    vi.spyOn(leaderboardApi, 'syncScore').mockResolvedValue({
      success: true,
      code: 'SYNCED_SUCCESS',
      message: 'OK',
    });

    setAccessToken('valid-jwt-token');
    setAuthenticatedUserId('user-123');

    // Device goes offline
    useCloudSyncStore.getState().setIsOnline(false);

    const offlineRes = await flushLearningEvidence();
    expect(offlineRes.code).toBe('OFFLINE');
    expect(hasPendingOfflineEvidence()).toBe(true);
    expect(getPendingEvidenceUserId()).toBe('user-123');
    expect(syncMetricsSpy).not.toHaveBeenCalled();

    // Device comes back online
    useCloudSyncStore.getState().setIsOnline(true);
    window.dispatchEvent(new Event('online'));

    // Allow async flush triggered by online event to run
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(syncMetricsSpy).toHaveBeenCalled();
    expect(hasPendingOfflineEvidence()).toBe(false);
  });

  it('7. Backend failure: preserves local state without rollback and keeps pending to retry', async () => {
    vi.spyOn(leaderboardApi, 'syncScore').mockRejectedValue(new Error('Internal Server Error 500'));

    setAccessToken('valid-jwt-token');
    setAuthenticatedUserId('user-123');

    const result = await flushLearningEvidence();

    expect(result.success).toBe(false);
    expect(result.code).toBe('SUBMISSION_EXCEPTION');

    // Local state is NOT rolled back!
    expect(mockStoreState.profile.xp).toBe(1200);

    // Kept pending for future retry
    expect(hasPendingOfflineEvidence()).toBe(true);
    expect(getPendingEvidenceUserId()).toBe('user-123');
  });

  it('8. No full-state cloud restore or snapshot upload when domain actions trigger sync', async () => {
    const uploadSyncSpy = vi.spyOn(cloudSyncApi, 'uploadSync');
    const syncScoreSpy = vi.spyOn(leaderboardApi, 'syncScore').mockResolvedValue({
      success: true,
      code: 'SYNCED_SUCCESS',
      message: 'OK',
    });
    vi.spyOn(leaderboardApi, 'syncWeeklyMetrics').mockResolvedValue({
      success: true,
      code: 'SYNCED_SUCCESS',
      message: 'OK',
    });

    setAccessToken('valid-jwt-token');
    setAuthenticatedUserId('user-123');

    vi.useFakeTimers();

    // Call scheduleCloudSync (as done by SRS reviews, XP gain, etc.)
    scheduleCloudSync(500);

    expect(getEvidenceTransportStateForTesting().hasDebounceTimer).toBe(true);

    // Advance debounce timer
    vi.advanceTimersByTime(500);
    vi.useRealTimers();

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Must NOT call full-state uploadSync
    expect(uploadSyncSpy).not.toHaveBeenCalled();

    // Must call lightweight Leaderboard evidence endpoint
    expect(syncScoreSpy).toHaveBeenCalled();
  });

  it('9. User logout purges pending timers and credentials', () => {
    vi.useFakeTimers();

    setAccessToken('valid-jwt-token');
    setAuthenticatedUserId('user-123');

    scheduleLearningEvidenceSubmission(2000);
    expect(getEvidenceTransportStateForTesting().hasDebounceTimer).toBe(true);

    onUserLogout();

    expect(getEvidenceTransportStateForTesting().hasDebounceTimer).toBe(false);
    expect(getAuthenticatedUserId()).toBeNull();
    expect(hasPendingOfflineEvidence()).toBe(false);

    vi.useRealTimers();
  });
});
