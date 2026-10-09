// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  deriveLeaderboardIdentity,
  isCurrentLeaderboardUser,
  resolveCurrentUserEntry,
  sanitizeEntriesForIdentity,
  getLeaderboardIdentity,
} from '../leaderboardIdentityService';
import { useCloudSyncStore, signOutCloud } from '../cloudSyncService';
import { setCachedLeaderboard, getCachedLeaderboard } from '../leaderboardService';
import { checkPendingCeremony } from '../weeklyCeremonyService';
import * as weeklyFinalizationService from '../weeklyFinalizationService';
import type { LeaderboardEntry } from '../../types';

describe('PHASE 2 — Canonical Leaderboard Identity State Model', () => {
  const VALID_UUID_1 = '550e8400-e29b-41d4-a716-446655440000';
  const VALID_UUID_2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

  beforeEach(() => {
    localStorage.clear();
    useCloudSyncStore.setState({
      user: null,
      userId: null,
      userEmail: null,
      session: null,
      status: 'idle',
      lastSyncedAt: null,
      isOnline: true,
    });
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. State Derivation Semantics (deriveLeaderboardIdentity)', () => {
    it('A. LOCAL_ONLY: derives local_only when userId is missing, empty, or non-UUID', () => {
      // Guest không có userId
      const guestEmpty = deriveLeaderboardIdentity({ userId: null, status: 'idle' });
      expect(guestEmpty.state).toBe('local_only');
      expect(guestEmpty.userId).toBeNull();
      expect(guestEmpty.isLocalOnly).toBe(true);
      expect(guestEmpty.isAuthenticatedSyncing).toBe(false);
      expect(guestEmpty.isAuthenticatedSynced).toBe(false);
      expect(guestEmpty.canHaveCloudRank).toBe(false);

      // Guest truyền display name "Huy Hoàng" thay vì UUID -> vẫn phải là local_only
      const guestName = deriveLeaderboardIdentity({ userId: 'Huy Hoàng', status: 'idle' });
      expect(guestName.state).toBe('local_only');
      expect(guestName.userId).toBeNull();
      expect(guestName.isLocalOnly).toBe(true);
      expect(guestName.canHaveCloudRank).toBe(false);
    });

    it('B. AUTHENTICATED_SYNCING: derives authenticated_syncing when syncing or reconciling', () => {
      // 1. Trạng thái status === 'syncing'
      const syncing = deriveLeaderboardIdentity({
        userId: VALID_UUID_1,
        status: 'syncing',
        lastSyncedAt: '2026-10-07T12:00:00Z',
      });
      expect(syncing.state).toBe('authenticated_syncing');
      expect(syncing.userId).toBe(VALID_UUID_1);
      expect(syncing.isLocalOnly).toBe(false);
      expect(syncing.isAuthenticatedSyncing).toBe(true);
      expect(syncing.isAuthenticatedSynced).toBe(false);
      expect(syncing.canHaveCloudRank).toBe(true);

      // 2. Trạng thái có pending sync request
      const pendingSync = deriveLeaderboardIdentity({
        userId: VALID_UUID_1,
        status: 'idle',
        hasPendingSync: true,
        lastSyncedAt: '2026-10-07T12:00:00Z',
      });
      expect(pendingSync.state).toBe('authenticated_syncing');
      expect(pendingSync.isAuthenticatedSyncing).toBe(true);

      // 3. Mới đăng nhập, status là idle nhưng chưa từng sync (lastSyncedAt = null)
      const freshLogin = deriveLeaderboardIdentity({
        userId: VALID_UUID_1,
        status: 'idle',
        lastSyncedAt: null,
      });
      expect(freshLogin.state).toBe('authenticated_syncing');
      expect(freshLogin.isAuthenticatedSyncing).toBe(true);
    });

    it('C. AUTHENTICATED_SYNCED: derives authenticated_synced when sync is completed', () => {
      const synced = deriveLeaderboardIdentity({
        userId: VALID_UUID_1,
        status: 'synced',
        lastSyncedAt: '2026-10-08T05:00:00Z',
      });
      expect(synced.state).toBe('authenticated_synced');
      expect(synced.userId).toBe(VALID_UUID_1);
      expect(synced.isLocalOnly).toBe(false);
      expect(synced.isAuthenticatedSyncing).toBe(false);
      expect(synced.isAuthenticatedSynced).toBe(true);
      expect(synced.canHaveCloudRank).toBe(true);
    });
  });

  describe('2. Canonical Identity Matching (isCurrentLeaderboardUser)', () => {
    const cloudEntry: LeaderboardEntry = {
      userId: VALID_UUID_1,
      rank: 2,
      displayName: 'Chiến Thần Học Tập',
      level: 10,
      rankTitle: 'VIP Learner',
      score: 500,
      isCurrentUser: false,
    };

    it('GUEST: NEVER matches any cloud row even if displayName is identical', () => {
      const guestIdentity = deriveLeaderboardIdentity({ userId: null, status: 'idle' });

      // Cùng tên hiển thị "Chiến Thần Học Tập"
      const match = isCurrentLeaderboardUser(cloudEntry, guestIdentity);
      expect(match).toBe(false);
    });

    it('GUEST: NEVER matches any cloud row even if stale row has isCurrentUser: true', () => {
      const guestIdentity = deriveLeaderboardIdentity({ userId: null, status: 'idle' });
      const staleRow: LeaderboardEntry = { ...cloudEntry, isCurrentUser: true };

      const match = isCurrentLeaderboardUser(staleRow, guestIdentity);
      expect(match).toBe(false);
    });

    it('AUTHENTICATED: matches ONLY when row.userId === authUser.id', () => {
      const authIdentity = deriveLeaderboardIdentity({ userId: VALID_UUID_1, status: 'synced' });

      // Match chính xác UUID
      expect(isCurrentLeaderboardUser(cloudEntry, authIdentity)).toBe(true);

      // Khác UUID (dù cùng tên hay khác tên) -> KHÔNG match
      const otherUserRow: LeaderboardEntry = {
        ...cloudEntry,
        userId: VALID_UUID_2,
        displayName: 'Chiến Thần Học Tập', // Giả sử cùng tên hiển thị
      };
      expect(isCurrentLeaderboardUser(otherUserRow, authIdentity)).toBe(false);
    });
  });

  describe('3. Current User Entry Resolution (resolveCurrentUserEntry)', () => {
    const entries: LeaderboardEntry[] = [
      {
        userId: 'other_user_uuid',
        rank: 1,
        displayName: 'Admin User',
        level: 20,
        rankTitle: 'Mythic Legend',
        score: 1000,
        isCurrentUser: false,
      },
      {
        userId: VALID_UUID_1,
        rank: 2,
        displayName: 'Chiến Thần Học Tập',
        level: 10,
        rankTitle: 'VIP Learner',
        score: 500,
        isCurrentUser: false,
      },
    ];

    it('GUEST: ALWAYS returns null and refuses any displayName matching', () => {
      const guestIdentity = deriveLeaderboardIdentity({ userId: null, status: 'idle' });

      // Dù trong entries có người tên "Chiến Thần Học Tập"
      const result = resolveCurrentUserEntry(entries, null, guestIdentity);
      expect(result).toBeNull();
    });

    it('GUEST: ALWAYS rejects stale apiCurrentUserEntry from previous user session', () => {
      const guestIdentity = deriveLeaderboardIdentity({ userId: null, status: 'idle' });
      const staleApiEntry: LeaderboardEntry = {
        userId: VALID_UUID_1,
        rank: 2,
        displayName: 'Old Auth User',
        level: 10,
        rankTitle: 'VIP Learner',
        score: 500,
        isCurrentUser: true,
      };

      const result = resolveCurrentUserEntry(entries, staleApiEntry, guestIdentity);
      expect(result).toBeNull();
    });

    it('AUTHENTICATED: maps entry strictly by canonical userId', () => {
      const authIdentity = deriveLeaderboardIdentity({ userId: VALID_UUID_1, status: 'synced' });

      const result = resolveCurrentUserEntry(entries, null, authIdentity);
      expect(result).not.toBeNull();
      expect(result?.userId).toBe(VALID_UUID_1);
      expect(result?.rank).toBe(2);
      expect(result?.isCurrentUser).toBe(true);
    });

    it('AUTHENTICATED: returns null if user is unranked and not in list (zero name fallback)', () => {
      const unrankedIdentity = deriveLeaderboardIdentity({ userId: VALID_UUID_2, status: 'synced' });

      // VALID_UUID_2 không có trong list, dù có entry khác trùng tên hiển thị
      const result = resolveCurrentUserEntry(entries, null, unrankedIdentity);
      expect(result).toBeNull();
    });
  });

  describe('4. Cache Sanitization & Multi-User Transitions', () => {
    it('sanitizes entries: sets isCurrentUser: false for guest across all rows', () => {
      const rawRows: LeaderboardEntry[] = [
        {
          userId: VALID_UUID_1,
          rank: 1,
          displayName: 'User 1',
          level: 5,
          rankTitle: 'Novice',
          score: 100,
          isCurrentUser: true, // Cờ rò rỉ từ cache cũ
        },
      ];

      const guestIdentity = deriveLeaderboardIdentity({ userId: null, status: 'idle' });
      const sanitized = sanitizeEntriesForIdentity(rawRows, guestIdentity);

      expect(sanitized[0].isCurrentUser).toBe(false);
    });

    it('auth identity change: switches matching smoothly from User 1 to User 2', () => {
      const row1: LeaderboardEntry = {
        userId: VALID_UUID_1,
        rank: 1,
        displayName: 'User A',
        level: 5,
        rankTitle: 'Novice',
        score: 100,
        isCurrentUser: false,
      };
      const row2: LeaderboardEntry = {
        userId: VALID_UUID_2,
        rank: 2,
        displayName: 'User B',
        level: 5,
        rankTitle: 'Novice',
        score: 80,
        isCurrentUser: false,
      };

      // 1. User 1 đăng nhập
      const identity1 = deriveLeaderboardIdentity({ userId: VALID_UUID_1, status: 'synced' });
      expect(isCurrentLeaderboardUser(row1, identity1)).toBe(true);
      expect(isCurrentLeaderboardUser(row2, identity1)).toBe(false);

      // 2. Chuyển sang User 2
      const identity2 = deriveLeaderboardIdentity({ userId: VALID_UUID_2, status: 'synced' });
      expect(isCurrentLeaderboardUser(row1, identity2)).toBe(false);
      expect(isCurrentLeaderboardUser(row2, identity2)).toBe(true);
    });

    it('logout transition: clears cached leaderboard and transitions to local_only', async () => {
      // 1. User 1 đăng nhập và lưu cache
      useCloudSyncStore.setState({
        user: { id: VALID_UUID_1, email: 'u1@example.com' } as any,
        userId: VALID_UUID_1,
        status: 'synced',
      });

      setCachedLeaderboard('weekly_xp', [
        {
          userId: VALID_UUID_1,
          rank: 1,
          displayName: 'U1',
          level: 5,
          rankTitle: 'Novice',
          score: 100,
          isCurrentUser: true,
        },
      ]);

      expect(getCachedLeaderboard('weekly_xp')).not.toBeNull();
      expect(getLeaderboardIdentity().state).toBe('authenticated_synced');

      // 2. Đăng xuất
      await signOutCloud();

      // Cache bảng xếp hạng phải bị xóa sạch
      expect(getCachedLeaderboard('weekly_xp')).toBeNull();

      // Identity phải chuyển thành local_only
      const afterLogoutIdentity = getLeaderboardIdentity();
      expect(afterLogoutIdentity.state).toBe('local_only');
      expect(afterLogoutIdentity.userId).toBeNull();
      expect(afterLogoutIdentity.isLocalOnly).toBe(true);
    });
  });

  describe('5. Weekly Award Ceremony Canonical Isolation', () => {
    beforeEach(() => {
      vi.spyOn(weeklyFinalizationService, 'fetchFinalizedWeeks').mockResolvedValue([
        {
          weekId: '2026-W40',
          weekStart: '2026-09-28T00:00:00Z',
          weekEnd: '2026-10-04T23:59:59Z',
          finalizedAt: '2026-10-05T00:00:00Z',
          totalParticipants: 50,
          isFinalized: true,
        },
      ]);

      vi.spyOn(weeklyFinalizationService, 'fetchWeeklySnapshots').mockResolvedValue([
        {
          id: 'snap-1',
          weekId: '2026-W40',
          category: 'weekly_xp',
          userId: VALID_UUID_1,
          displayName: 'Chiến Thần Hoàng Kim',
          level: 15,
          rank: 1,
          score: 2500,
          finalizedAt: '2026-10-05T00:00:00Z',
        },
      ]);
    });

    it('GUEST: returns null even if guest has the same displayName as the winner', async () => {
      // Guest tên "Chiến Thần Hoàng Kim" nhưng không có userId
      const ceremony = await checkPendingCeremony(undefined, 'Chiến Thần Hoàng Kim');
      expect(ceremony).toBeNull();
    });

    it('AUTHENTICATED: grants ceremony award ONLY when userId matches winner snapshot', async () => {
      // 1. Đúng UUID của winner
      const winnerCeremony = await checkPendingCeremony(VALID_UUID_1, 'Tên Bất Kỳ');
      expect(winnerCeremony).not.toBeNull();
      expect(winnerCeremony?.rank).toBe(1);
      expect(winnerCeremony?.frameId).toBe('champion_frame');

      // 2. User khác có cùng displayName nhưng sai UUID
      const imposterCeremony = await checkPendingCeremony(VALID_UUID_2, 'Chiến Thần Hoàng Kim');
      expect(imposterCeremony).toBeNull();
    });
  });
});
