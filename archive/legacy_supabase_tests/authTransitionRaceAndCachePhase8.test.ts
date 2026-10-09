// @vitest-environment happy-dom
// src/services/__tests__/authTransitionRaceAndCachePhase8.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '../../lib/supabaseClient';
import {
  deriveLeaderboardIdentity,
  isCurrentLeaderboardUser,
  resolveCurrentUserEntry,
} from '../leaderboardIdentityService';
import {
  setCachedLeaderboard,
  getCachedLeaderboard,
  invalidateAuthLeaderboardCache,
  clearCachedLeaderboard,
  CACHE_KEY_PREFIX,
} from '../leaderboardService';
import * as leaderboardService from '../leaderboardService';
import {
  performFullSync,
  pushLocalToCloud,
  useCloudSyncStore,
  setActiveSyncedUserId,
  getActiveSyncedUserId,
  registerCloudSyncStoreGetter,
  clearSyncCoordinatorForTesting,
} from '../cloudSyncService';
import type { AppStoreState, DailyProgress, LeaderboardEntry } from '../../types';

describe('PHASE 8 — Auth Transition Race, Account Switching & Cache Hardening', () => {
  const USER_A_ID = 'aaaaaaaa-1111-4aaa-8aaa-111111111111';
  const USER_B_ID = 'bbbbbbbb-2222-4bbb-8bbb-222222222222';

  let mockStoreState: any = null;

  beforeEach(() => {
    vi.clearAllMocks();
    clearSyncCoordinatorForTesting();
    localStorage.clear();

    mockStoreState = {
      profile: {
        name: 'Alex',
        xp: 0,
        level: 1,
        streak: 0,
      },
      dailyHistory: {} as Record<string, DailyProgress>,
      srsProgressMap: {},
      userCollocations: [],
      recentReviewEvents: [],
      resetToDefault: vi.fn(() => {
        mockStoreState.profile = { name: 'Alex', xp: 0, level: 1, streak: 0 };
        mockStoreState.dailyHistory = {};
        mockStoreState.srsProgressMap = {};
        mockStoreState.userCollocations = [];
        mockStoreState.recentReviewEvents = [];
      }),
      mergeCloudData: vi.fn(),
    };

    registerCloudSyncStoreGetter(() => mockStoreState);

    useCloudSyncStore.setState({
      isOnline: true,
      userId: null,
      user: null,
      status: 'idle',
      lastSyncedAt: null,
    });
    setActiveSyncedUserId(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearSyncCoordinatorForTesting();
    localStorage.clear();
  });

  // ==========================================================================
  // TEST 1: LOGOUT TRANSITION & LOCAL STATE SEMANTICS
  // ==========================================================================
  describe('1. Logout Transition', () => {
    it('cleanses auth-specific current-user state on logout while keeping guest local semantics', () => {
      // User A was authenticated with a cached sticky entry
      const initialEntries: LeaderboardEntry[] = [
        {
          userId: USER_A_ID,
          rank: 3,
          displayName: 'Alex',
          score: 600,
          level: 4,
          rankTitle: 'VIP Learner',
          isCurrentUser: true,
        },
      ];
      setCachedLeaderboard('weekly_xp', initialEntries, '2026-W41', initialEntries[0], 1);

      // Verify cached entry has User A as current user
      const cachedBefore = getCachedLeaderboard('weekly_xp');
      expect(cachedBefore?.currentUserEntry?.userId).toBe(USER_A_ID);

      // Perform logout: invalidate auth cache
      invalidateAuthLeaderboardCache(null);
      setActiveSyncedUserId(null);
      const guestIdentity = deriveLeaderboardIdentity({ userId: null, status: 'idle' });

      // Cached entry now has currentUserEntry stripped
      const cachedAfter = getCachedLeaderboard('weekly_xp');
      expect(cachedAfter?.currentUserEntry).toBeNull();
      expect(cachedAfter?.entries[0].isCurrentUser).toBe(false);

      // Identity is local-only
      expect(guestIdentity.state).toBe('local_only');
      expect(isCurrentLeaderboardUser(cachedAfter?.entries[0], guestIdentity)).toBe(false);

      // Resolving current user for guest returns null (no sticky cloud row)
      const resolved = resolveCurrentUserEntry(cachedAfter?.entries, cachedAfter?.currentUserEntry, guestIdentity);
      expect(resolved).toBeNull();
    });
  });

  // ==========================================================================
  // TEST 2: ACCOUNT SWITCH (A -> Logout -> B)
  // ==========================================================================
  describe('2. Account Switch Isolation', () => {
    it('prevents User B from inheriting User A sticky row, rank cache, or online score (even with same username)', () => {
      // 1. User A logs in and has 900 XP in cache
      setActiveSyncedUserId(USER_A_ID);
      const userAEntry: LeaderboardEntry = {
        userId: USER_A_ID,
        rank: 1,
        displayName: 'Alex',
        score: 900,
        level: 5,
        rankTitle: 'VIP Learner',
        isCurrentUser: true,
      };
      setCachedLeaderboard('weekly_xp', [userAEntry], '2026-W41', userAEntry, 1);

      // 2. User A logs out -> invalidate auth cache
      invalidateAuthLeaderboardCache(null);
      setActiveSyncedUserId(null);

      // 3. User B logs in (also named 'Alex', but only 150 XP)
      setActiveSyncedUserId(USER_B_ID);
      invalidateAuthLeaderboardCache(USER_B_ID);

      const userBIdentity = deriveLeaderboardIdentity({
        userId: USER_B_ID,
        status: 'synced',
      });

      // User B checks cache before new fetch
      const cached = getCachedLeaderboard('weekly_xp');

      // The cached currentUserEntry (belonging to User A) is completely gone
      expect(cached?.currentUserEntry).toBeNull();

      // User A entry in public list is NOT matched as current user for User B
      expect(isCurrentLeaderboardUser(cached?.entries[0], userBIdentity)).toBe(false);

      // Resolving current user for User B returns null until User B data is fetched
      const resolved = resolveCurrentUserEntry(cached?.entries, cached?.currentUserEntry, userBIdentity);
      expect(resolved).toBeNull();
    });
  });

  // ==========================================================================
  // TEST 3: CACHE INVALIDATION WITHOUT PUBLIC WIPEOUT
  // ==========================================================================
  describe('3. Selective Cache Invalidation', () => {
    it('invalidates current-user rank and sticky row while preserving valid public ranking entries', () => {
      const publicTopUsers: LeaderboardEntry[] = [
        { userId: 'top-1', rank: 1, displayName: 'Champion', score: 1000, level: 10, isCurrentUser: false, rankTitle: 'VIP' },
        { userId: USER_A_ID, rank: 2, displayName: 'Alex', score: 850, level: 8, isCurrentUser: true, rankTitle: 'VIP' },
        { userId: 'top-3', rank: 3, displayName: 'Bronze', score: 700, level: 6, isCurrentUser: false, rankTitle: 'VIP' },
      ];

      setCachedLeaderboard('weekly_xp', publicTopUsers, '2026-W41', publicTopUsers[1], 3);

      // Invalidate for guest/logout
      invalidateAuthLeaderboardCache(null);

      const cached = getCachedLeaderboard('weekly_xp');
      expect(cached).not.toBeNull();
      // Public list is intact (3 entries preserved)
      expect(cached?.entries.length).toBe(3);
      expect(cached?.entries[0].displayName).toBe('Champion');
      expect(cached?.entries[2].displayName).toBe('Bronze');

      // Auth-specific fields are wiped
      expect(cached?.currentUserEntry).toBeNull();
      expect(cached?.entries[1].isCurrentUser).toBe(false);
    });
  });

  // ==========================================================================
  // TEST 4: AUTH / SYNC / FETCH RACE RESOLUTION
  // ==========================================================================
  describe('4. Auth / Sync / Fetch Race Resolution', () => {
    it('observes sync completion and allows follow-up refresh to replace initial 0 XP with fresh 250 XP', async () => {
      // User logs in and has 250 local XP
      mockStoreState.profile.xp = 250;
      mockStoreState.dailyHistory['2026-10-08'] = { date: '2026-10-08', xpGained: 250 };

      // Step 1: Sync begins (status: 'syncing')
      useCloudSyncStore.setState({
        userId: USER_A_ID,
        user: { id: USER_A_ID, email: 'alex@example.com' } as any,
        status: 'syncing',
        lastSyncedAt: null,
      });

      const syncingIdentity = deriveLeaderboardIdentity({
        userId: USER_A_ID,
        status: 'syncing',
      });
      expect(syncingIdentity.state).toBe('authenticated_syncing');

      // Step 2: Sync completes successfully with new timestamp
      const syncCompletedTimestamp = new Date().toISOString();
      useCloudSyncStore.setState({
        status: 'synced',
        lastSyncedAt: syncCompletedTimestamp,
      });

      const syncedIdentity = deriveLeaderboardIdentity({
        userId: USER_A_ID,
        status: 'synced',
        lastSyncedAt: syncCompletedTimestamp,
      });
      expect(syncedIdentity.state).toBe('authenticated_synced');
      expect(syncedIdentity.isAuthenticatedSynced).toBe(true);

      // Server now has 250 XP from pushLocalToCloud
      const updatedEntries: LeaderboardEntry[] = [
        {
          userId: USER_A_ID,
          rank: 1,
          displayName: 'Alex',
          score: 250,
          level: 2,
          isCurrentUser: true,
          rankTitle: 'VIP',
        },
      ];

      const resolved = resolveCurrentUserEntry(updatedEntries, null, syncedIdentity);
      expect(resolved?.score).toBe(250);
      expect(resolved?.userId).toBe(USER_A_ID);
    });
  });

  // ==========================================================================
  // TEST 5: PRE-STUDY TO NAVBAR LOGIN FLOW
  // ==========================================================================
  describe('5. Pre-study & Navbar Login Flow', () => {
    it('guarantees pushLocalToCloud prepares full local 350 XP payload on login without requiring extra study action', async () => {
      // Guest studied offline before logging in (350 XP)
      mockStoreState.profile.xp = 350;
      mockStoreState.profile.streak = 3;
      mockStoreState.dailyHistory['2026-10-08'] = {
        date: '2026-10-08',
        xpGained: 350,
      };

      // Mock Supabase upserts
      const upsertSpy = vi.fn().mockResolvedValue({ error: null });
      vi.spyOn(supabase, 'from').mockReturnValue({
        upsert: upsertSpy,
      } as any);

      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: null, error: null } as any);

      // Navbar login triggers pushLocalToCloud
      await pushLocalToCloud(USER_A_ID);

      // Verify profile upsert received 350 XP
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: USER_A_ID,
          xp: 350,
          streak: 3,
        }),
        expect.anything()
      );

      // Verify leaderboard score sync received 350 XP
      expect(rpcSpy).toHaveBeenCalledWith(
        'sync_leaderboard_progress',
        expect.objectContaining({
          p_weekly_xp: 350,
          p_streak: 3,
          p_total_xp: 350,
        })
      );
    });
  });

  // ==========================================================================
  // TEST 6: SAME USERNAME ACROSS ACCOUNTS (Strict Isolation)
  // ==========================================================================
  describe('6. Same Username Across Accounts', () => {
    it('differentiates two distinct accounts having the identical username "Hero"', () => {
      const accountAIdentity = deriveLeaderboardIdentity({ userId: USER_A_ID, status: 'synced' });
      const accountBIdentity = deriveLeaderboardIdentity({ userId: USER_B_ID, status: 'synced' });

      const rowA: LeaderboardEntry = {
        userId: USER_A_ID,
        rank: 1,
        displayName: 'Hero',
        score: 1200,
        level: 10,
        rankTitle: 'VIP',
        isCurrentUser: false,
      };

      const rowB: LeaderboardEntry = {
        userId: USER_B_ID,
        rank: 10,
        displayName: 'Hero',
        score: 400,
        level: 4,
        rankTitle: 'Tập Sự',
        isCurrentUser: false,
      };

      // When Account B is authenticated:
      expect(isCurrentLeaderboardUser(rowA, accountBIdentity)).toBe(false);
      expect(isCurrentLeaderboardUser(rowB, accountBIdentity)).toBe(true);

      const resolvedForB = resolveCurrentUserEntry([rowA, rowB], null, accountBIdentity);
      expect(resolvedForB?.userId).toBe(USER_B_ID);
      expect(resolvedForB?.rank).toBe(10);
      expect(resolvedForB?.score).toBe(400);

      // When Account A is authenticated:
      expect(isCurrentLeaderboardUser(rowA, accountAIdentity)).toBe(true);
      expect(isCurrentLeaderboardUser(rowB, accountAIdentity)).toBe(false);

      const resolvedForA = resolveCurrentUserEntry([rowA, rowB], null, accountAIdentity);
      expect(resolvedForA?.userId).toBe(USER_A_ID);
      expect(resolvedForA?.rank).toBe(1);
      expect(resolvedForA?.score).toBe(1200);
    });
  });
});
