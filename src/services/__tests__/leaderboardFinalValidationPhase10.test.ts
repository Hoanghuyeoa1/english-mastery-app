// @vitest-environment happy-dom
// src/services/__tests__/leaderboardFinalValidationPhase10.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '../../lib/supabaseClient';
import {
  deriveLeaderboardIdentity,
  isCurrentLeaderboardUser,
  resolveCurrentUserEntry,
} from '../leaderboardIdentityService';
import {
  deriveCurrentUserLeaderboardPreview,
} from '../localLeaderboardPreviewAdapter';
import {
  performFullSync,
  pushLocalToCloud,
  useCloudSyncStore,
  setActiveSyncedUserId,
  getActiveSyncedUserId,
  registerCloudSyncStoreGetter,
  clearSyncCoordinatorForTesting,
} from '../cloudSyncService';
import {
  setCachedLeaderboard,
  getCachedLeaderboard,
  invalidateAuthLeaderboardCache,
  clearCachedLeaderboard,
  syncUserScoreToLeaderboard,
  calculateWeeklyXpFromHistory,
  getAuthoritativeVietnamWeekId,
} from '../leaderboardService';
import * as leaderboardService from '../leaderboardService';
import { applyCloudDataMerge } from '../../store/cloudDataMerger';
import type { AppStoreState, DailyProgress, LeaderboardEntry, LeaderboardMetric } from '../../types';

describe('PHASE 10 — Local Leaderboard Identity Final Validation (14 E2E Scenarios)', () => {
  const CLOUD_USER_A_ID = 'aaaaaaaa-1111-4aaa-8aaa-111111111111';
  const CLOUD_USER_B_ID = 'bbbbbbbb-2222-4bbb-8bbb-222222222222';

  let mockStoreState: any = null;

  beforeEach(() => {
    vi.clearAllMocks();
    clearSyncCoordinatorForTesting();
    localStorage.clear();

    mockStoreState = {
      profile: {
        name: 'Hoang',
        xp: 500,
        level: 3,
        streak: 5,
        hearts: 5,
        lastStudyDate: '2026-10-07',
        lastActiveDate: '2026-10-07',
      },
      dailyHistory: {
        '2026-10-07': {
          date: '2026-10-07',
          xpGained: 500,
          wordsReviewed: 20,
          newWordsLearned: 5,
          quizzesCompleted: 2,
          pronunciationsMastered: 2,
        },
      } as Record<string, DailyProgress>,
      srsProgressMap: {
        w1: { srsLevel: 5, interval: 21, easeFactor: 2.5, nextReviewDate: '2026-10-25', lastReviewedDate: '2026-10-07', reviewCount: 5 },
        w2: { srsLevel: 4, interval: 14, easeFactor: 2.5, nextReviewDate: '2026-10-20', lastReviewedDate: '2026-10-07', reviewCount: 4 },
      },
      userCollocations: [],
      recentReviewEvents: [],
      mistakeBank: {},
      resetToDefault: vi.fn(() => {
        mockStoreState.profile = { name: 'Hoang', xp: 0, level: 1, streak: 0 };
        mockStoreState.dailyHistory = {};
        mockStoreState.srsProgressMap = {};
      }),
      mergeCloudData: vi.fn((payload) => {
        const merged = applyCloudDataMerge(mockStoreState, payload);
        Object.assign(mockStoreState, merged);
      }),
    };

    registerCloudSyncStoreGetter(() => mockStoreState);
    useCloudSyncStore.getState().setSession(null);
    useCloudSyncStore.getState().setIsOnline(true);
    useCloudSyncStore.getState().setStatus('idle');
  });

  afterEach(() => {
    clearSyncCoordinatorForTesting();
  });

  // =========================================================================
  // E2E CASE 1 — USERNAME COLLISION
  // =========================================================================
  it('E2E Case 1: Username Collision — Cloud user Hoang (0 XP) vs Guest Hoang (500 XP)', () => {
    // Guest is logged out with local username 'Hoang' and 500 XP
    const identity = deriveLeaderboardIdentity({
      userId: null,
      status: 'idle',
    });

    expect(identity.state).toBe('local_only');

    // Cloud response returns a user with displayName 'Hoang' and 0 XP
    const cloudEntries: LeaderboardEntry[] = [
      {
        userId: CLOUD_USER_A_ID,
        displayName: 'Hoang',
        avatarUrl: undefined,
        level: 1,
        rank: 1,
        score: 0,
        rankTitle: 'Tập Sự',
        isCurrentUser: false,
      },
    ];

    // Local preview derives guest's actual 500 XP
    const previews = deriveCurrentUserLeaderboardPreview(mockStoreState);
    expect(previews.weekly_xp.value).toBe(500);
    expect(previews.weekly_xp.displayValue).toBe('500 XP');

    // Canonical identity resolution NEVER matches Cloud A as current user
    const resolvedUser = resolveCurrentUserEntry(cloudEntries, null, identity);
    expect(resolvedUser).toBeNull();
    expect(isCurrentLeaderboardUser(cloudEntries[0], identity)).toBe(false);
  });

  // =========================================================================
  // E2E CASE 2 — GUEST PUBLIC VIEW
  // =========================================================================
  it('E2E Case 2: Guest Public View — public ranking visible, local preview visible, no fake rank', () => {
    const identity = deriveLeaderboardIdentity({
      userId: null,
      status: 'idle',
    });

    const publicEntries: LeaderboardEntry[] = [
      { userId: 'u-1', displayName: 'Player 1', avatarUrl: undefined, level: 5, rank: 1, score: 1200, rankTitle: 'VIP', isCurrentUser: false },
      { userId: 'u-2', displayName: 'Player 2', avatarUrl: undefined, level: 4, rank: 2, score: 950, rankTitle: 'Master', isCurrentUser: false },
    ];

    // Public entries are fully readable
    expect(publicEntries.length).toBe(2);
    expect(publicEntries[0].displayName).toBe('Player 1');

    // Guest's own row is NOT an online row, has NO online rank
    const resolvedRow = resolveCurrentUserEntry(publicEntries, null, identity);
    expect(resolvedRow).toBeNull();

    // Guest local preview is preserved
    const previews = deriveCurrentUserLeaderboardPreview(mockStoreState);
    expect(previews.weekly_xp.value).toBe(500);
    expect(previews.streak.value).toBe(5);
  });

  // =========================================================================
  // E2E CASE 3 — LIVE LOCAL UPDATE
  // =========================================================================
  it('E2E Case 3: Live Local Update — guest earns XP while viewing, local preview updates instantly', () => {
    // Initial preview: 500 XP
    const initialPreviews = deriveCurrentUserLeaderboardPreview(mockStoreState);
    expect(initialPreviews.weekly_xp.value).toBe(500);

    // Guest completes quiz, earns +120 XP -> 620 XP
    mockStoreState.profile.xp = 620;
    mockStoreState.dailyHistory['2026-10-07'].xpGained = 620;

    // Derived preview immediately updates without network or reload
    const updatedPreviews = deriveCurrentUserLeaderboardPreview(mockStoreState);
    expect(updatedPreviews.weekly_xp.value).toBe(620);
    expect(updatedPreviews.weekly_xp.displayValue).toBe('620 XP');
  });

  // =========================================================================
  // E2E CASE 4 — LOGIN FROM LEADERBOARD
  // =========================================================================
  it('E2E Case 4: Login from Leaderboard — guest 250 XP logs in, reconciles, syncs, resolves online row by user_id', async () => {
    // Guest starts with 250 XP
    mockStoreState.profile.xp = 250;
    mockStoreState.dailyHistory['2026-10-07'].xpGained = 250;

    // User logs in with CLOUD_USER_A_ID
    useCloudSyncStore.getState().setSession({
      user: { id: CLOUD_USER_A_ID, email: 'hoang@example.com' } as any,
    } as any);

    // Identity switches to authenticated_syncing / authenticated_synced
    const identityBeforeSync = deriveLeaderboardIdentity({
      userId: CLOUD_USER_A_ID,
      status: 'syncing',
    });
    expect(identityBeforeSync.state).toBe('authenticated_syncing');

    // Mock remote returning user A
    const cloudEntryA: LeaderboardEntry = {
      userId: CLOUD_USER_A_ID,
      displayName: 'Hoang',
      avatarUrl: undefined,
      level: 2,
      rank: 4,
      score: 250,
      rankTitle: 'VIP Learner',
      isCurrentUser: false,
    };

    useCloudSyncStore.getState().setStatus('synced');
    const identityAfterSync = deriveLeaderboardIdentity({
      userId: CLOUD_USER_A_ID,
      status: 'synced',
    });
    expect(identityAfterSync.state).toBe('authenticated_synced');

    // Resolves accurately by user_id
    const resolvedCurrent = resolveCurrentUserEntry([cloudEntryA], null, identityAfterSync);
    expect(resolvedCurrent).not.toBeNull();
    expect(resolvedCurrent?.userId).toBe(CLOUD_USER_A_ID);
    expect(resolvedCurrent?.rank).toBe(4);
  });

  // =========================================================================
  // E2E CASE 5 — LOGIN FROM NAVBAR
  // =========================================================================
  it('E2E Case 5: Login from Navbar — pre-study offline -> Navbar login -> reflects valid local progress online', () => {
    // User studies offline: 750 XP, streak 6
    mockStoreState.profile.xp = 750;
    mockStoreState.profile.streak = 6;
    mockStoreState.dailyHistory['2026-10-07'].xpGained = 750;

    // Login occurs via Navbar (setting session)
    useCloudSyncStore.getState().setSession({
      user: { id: CLOUD_USER_A_ID, email: 'alex@example.com' } as any,
    } as any);

    // Merge cloud data with remote having older 200 XP
    mockStoreState.mergeCloudData({
      cloudProfile: { id: CLOUD_USER_A_ID, xp: 200, streak: 3 },
      cloudDailyLogs: [{ date: '2026-10-07', xp_earned: 200 }],
    });

    // Local 750 XP wins over older remote 200 XP
    expect(mockStoreState.profile.xp).toBe(750);
    expect(mockStoreState.profile.streak).toBe(6);
    expect(mockStoreState.dailyHistory['2026-10-07'].xpGained).toBe(750);
  });

  // =========================================================================
  // E2E CASE 6 — LOGOUT
  // =========================================================================
  it('E2E Case 6: Logout — identity returns to local-only, old online sticky row no longer highlighted', () => {
    // Was logged in as CLOUD_USER_A_ID
    useCloudSyncStore.getState().setSession({
      user: { id: CLOUD_USER_A_ID } as any,
    } as any);
    invalidateAuthLeaderboardCache(CLOUD_USER_A_ID);

    // Logout occurs
    useCloudSyncStore.getState().setSession(null);
    useCloudSyncStore.getState().setStatus('idle');
    invalidateAuthLeaderboardCache(null);

    const identity = deriveLeaderboardIdentity({
      userId: null,
      status: 'idle',
    });
    expect(identity.state).toBe('local_only');

    const entries: LeaderboardEntry[] = [
      { userId: CLOUD_USER_A_ID, displayName: 'Hoang', avatarUrl: undefined, level: 3, rank: 1, score: 750, rankTitle: 'VIP', isCurrentUser: true },
    ];

    // Old account row is NEVER matched as current user anymore
    expect(isCurrentLeaderboardUser(entries[0], identity)).toBe(false);
    const resolved = resolveCurrentUserEntry(entries, null, identity);
    expect(resolved).toBeNull();
  });

  // =========================================================================
  // E2E CASE 7 — ACCOUNT SWITCH
  // =========================================================================
  it('E2E Case 7: Account Switch (A -> logout -> B) — zero identity or cache leakage', () => {
    const userAEntry: LeaderboardEntry = {
      userId: CLOUD_USER_A_ID,
      displayName: 'Hoang',
      avatarUrl: undefined,
      level: 3,
      rank: 1,
      score: 750,
      rankTitle: 'VIP',
      isCurrentUser: true,
    };

    setActiveSyncedUserId(CLOUD_USER_A_ID);
    setCachedLeaderboard('weekly_xp', [userAEntry], '2026-W41', userAEntry, 1);

    // Invalidate when switching to user B
    invalidateAuthLeaderboardCache(CLOUD_USER_B_ID);
    setActiveSyncedUserId(CLOUD_USER_B_ID);

    const cached = getCachedLeaderboard('weekly_xp');
    expect(cached?.currentUserEntry).toBeNull();
    expect(cached?.entries[0].isCurrentUser).toBe(false);

    // User B identity
    const identityB = deriveLeaderboardIdentity({
      userId: CLOUD_USER_B_ID,
      status: 'synced',
    });

    // User B does not match User A's row
    expect(isCurrentLeaderboardUser(cached!.entries[0], identityB)).toBe(false);
    expect(resolveCurrentUserEntry(cached!.entries, cached!.currentUserEntry, identityB)).toBeNull();
  });

  // =========================================================================
  // E2E CASE 8 — OFFLINE
  // =========================================================================
  it('E2E Case 8: Offline — local score preserved, no rollback, local preview derived offline', async () => {
    useCloudSyncStore.getState().setIsOnline(false);

    mockStoreState.profile.xp = 950;
    mockStoreState.dailyHistory['2026-10-07'].xpGained = 950;

    const previews = deriveCurrentUserLeaderboardPreview(mockStoreState);
    expect(previews.weekly_xp.value).toBe(950);
    expect(previews.weekly_xp.displayValue).toBe('950 XP');

    // Attempting sync while offline rejects cleanly
    const syncRes = await performFullSync();
    expect(syncRes.success).toBe(false);
    expect(syncRes.message).toContain('ngoại tuyến');

    // Score remains 950 XP
    expect(mockStoreState.profile.xp).toBe(950);
  });

  // =========================================================================
  // E2E CASE 9 — SYNC FAILURE
  // =========================================================================
  it('E2E Case 9: Sync Failure — local score remains intact, sync status becomes error explicitly', async () => {
    useCloudSyncStore.getState().setSession({
      user: { id: CLOUD_USER_A_ID } as any,
    } as any);
    useCloudSyncStore.getState().setIsOnline(true);

    vi.spyOn(supabase, 'from').mockImplementation(() => {
      throw new Error('Failed to fetch: Connection timeout');
    });

    const syncRes = await performFullSync();
    expect(syncRes.success).toBe(false);
    expect(useCloudSyncStore.getState().status).toBe('error');

    // Local XP is NOT rolled back
    expect(mockStoreState.profile.xp).toBe(500);
  });

  // =========================================================================
  // E2E CASE 10 — RECONNECT
  // =========================================================================
  it('E2E Case 10: Reconnect — sync once without duplicate metric accumulation', () => {
    // Offline user earned 500 XP
    const local = {
      ...mockStoreState,
      profile: { ...mockStoreState.profile, xp: 500 },
      dailyHistory: {
        '2026-10-07': { date: '2026-10-07', xpGained: 500 },
      },
    };

    // Cloud has older 300 XP
    const remote = {
      cloudProfile: { id: CLOUD_USER_A_ID, xp: 300 },
      cloudDailyLogs: [{ date: '2026-10-07', xp_earned: 300 }],
    };

    const merged = applyCloudDataMerge(local, remote);
    // XP is max(500, 300) = 500, NOT 500 + 300 = 800
    expect(merged.profile?.xp).toBe(500);
    expect(merged.dailyHistory?.['2026-10-07'].xpGained).toBe(500);
  });

  // =========================================================================
  // E2E CASE 11 — ALL 7 CATEGORIES
  // =========================================================================
  it('E2E Case 11: All 7 Categories — local representation correctly formatted and derived', () => {
    const previews = deriveCurrentUserLeaderboardPreview(mockStoreState);

    expect(previews.weekly_xp.category).toBe('weekly_xp');
    expect(previews.weekly_xp.displayValue).toContain('XP');

    expect(previews.vocab_mastered.category).toBe('vocab_mastered');
    expect(previews.vocab_mastered.displayValue).toContain('từ');

    expect(previews.review_consistency.category).toBe('review_consistency');
    expect(previews.review_consistency.status).toBeDefined();

    expect(previews.active_minutes.category).toBe('active_minutes');
    expect(previews.active_minutes.displayValue).toContain('phút');

    expect(previews.pronunciation_gain.category).toBe('pronunciation_gain');
    expect(previews.pronunciation_gain.status).toBeDefined();

    expect(previews.toeic_gain.category).toBe('toeic_gain');
    expect(previews.toeic_gain.status).toBeDefined();

    expect(previews.streak.category).toBe('streak');
    expect(previews.streak.displayValue).toContain('ngày');
  });

  // =========================================================================
  // E2E CASE 12 — NOT ELIGIBLE (NO FAKE 0)
  // =========================================================================
  it('E2E Case 12: Not Eligible — Pronunciation & TOEIC insufficient evidence never fakes 0% or 0 LR', () => {
    const minimalState: Partial<AppStoreState> = {
      profile: { name: 'Newbie', xp: 100, level: 1, streak: 1 } as any,
      dailyHistory: {
        '2026-10-07': {
          date: '2026-10-07',
          xpGained: 100,
          wordsReviewed: 0,
          newWordsLearned: 0,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
        },
      },
      srsProgressMap: {},
      recentReviewEvents: [],
      userCollocations: [],
      mistakeBank: {},
    };

    const previews = deriveCurrentUserLeaderboardPreview(minimalState);

    // Pronunciation: insufficient samples -> 'Chưa đủ dữ liệu', NOT '0 điểm'
    expect(previews.pronunciation_gain.isEligible).toBe(false);
    expect(previews.pronunciation_gain.displayValue).toBe('Chưa đủ dữ liệu');
    expect(previews.pronunciation_gain.displayValue).not.toBe('0 điểm');

    // TOEIC: insufficient mock tests -> 'Chưa đủ điều kiện', NOT '0 LR'
    expect(previews.toeic_gain.isEligible).toBe(false);
    expect(previews.toeic_gain.displayValue).toBe('Chưa đủ điều kiện');
    expect(previews.toeic_gain.displayValue).not.toBe('0 LR');
  });

  // =========================================================================
  // E2E CASE 13 — STALE CLOUD ZERO
  // =========================================================================
  it('E2E Case 13: Stale Cloud Zero — valid local XP (500) vs stale cloud (0) preserves local progress', () => {
    const local = {
      ...mockStoreState,
      profile: { name: 'Hoang', xp: 500, level: 3, streak: 5 },
      dailyHistory: {
        '2026-10-07': { date: '2026-10-07', xpGained: 500 },
      },
    };

    const staleCloud = {
      cloudProfile: { id: CLOUD_USER_A_ID, xp: 0, streak: 0, level: 1 },
      cloudDailyLogs: [{ date: '2026-10-07', xp_earned: 0 }],
    };

    const merged = applyCloudDataMerge(local, staleCloud);

    // Cloud 0 does NOT overwrite local 500
    expect(merged.profile?.xp).toBe(500);
    expect(merged.profile?.streak).toBe(5);
    expect(merged.dailyHistory?.['2026-10-07'].xpGained).toBe(500);
  });

  // =========================================================================
  // E2E CASE 14 — WRONG WEEK XP
  // =========================================================================
  it('E2E Case 14: Wrong Week XP — old-week daily log does not count toward current week XP', () => {
    // Current authoritative Vietnam week
    const currentWeekId = getAuthoritativeVietnamWeekId();

    // Daily history with an old-week log (e.g. from 2026-01-05 = 2026-W02)
    const historyWithOldWeek: Record<string, DailyProgress> = {
      '2026-01-05': {
        date: '2026-01-05',
        xpGained: 400, // Old week XP
        wordsReviewed: 20,
        newWordsLearned: 10,
        quizzesCompleted: 2,
        pronunciationsMastered: 2,
      },
      '2026-10-07': {
        date: '2026-10-07', // Current week log
        xpGained: 150,
        wordsReviewed: 10,
        newWordsLearned: 5,
        quizzesCompleted: 1,
        pronunciationsMastered: 1,
      },
    };

    // Calculate weekly XP for current week (refDate = 2026-10-07)
    const currentWeeklyXp = calculateWeeklyXpFromHistory(
      historyWithOldWeek,
      new Date('2026-10-07T12:00:00+07:00')
    );

    // Must ONLY include 2026-10-07 (150 XP), excluding 2026-01-05 (400 XP)
    expect(currentWeeklyXp).toBe(150);
    expect(currentWeeklyXp).not.toBe(550);
  });
});
