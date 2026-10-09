// @vitest-environment happy-dom
// src/components/__tests__/leaderboardCurrentUserIdentityPhase7.test.tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { supabase } from '../../lib/supabaseClient';
import { LeaderboardView } from '../LeaderboardView';
import {
  deriveLeaderboardIdentity,
  isCurrentLeaderboardUser,
  resolveCurrentUserEntry,
  sanitizeEntriesForIdentity,
} from '../../services/leaderboardIdentityService';
import {
  getMyLeaderboardRank,
  fetchLeaderboardWithStatus,
} from '../../services/leaderboardService';
import * as leaderboardService from '../../services/leaderboardService';
import { useAppStore } from '../../store/useAppStore';
import {
  useCloudSyncStore,
  setActiveSyncedUserId,
  registerCloudSyncStoreGetter,
  clearSyncCoordinatorForTesting,
} from '../../services/cloudSyncService';
import type { LeaderboardEntry } from '../../types';

// Mock framer-motion to avoid Happy-DOM animation cancellation warnings
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
    button: ({ children, className, ...props }: any) => (
      <button className={className} {...props}>
        {children}
      </button>
    ),
    span: ({ children, className, ...props }: any) => (
      <span className={className} {...props}>
        {children}
      </span>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('PHASE 7 — Authenticated Current-User Row & Sticky Rank Identity Fix', () => {
  const CLOUD_USER_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const CLOUD_USER_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  let mockStoreState: any = null;

  beforeEach(() => {
    vi.clearAllMocks();
    clearSyncCoordinatorForTesting();
    localStorage.clear();

    mockStoreState = {
      profile: {
        name: 'Hoang',
        xp: 700,
        level: 3,
        streak: 5,
        equippedFrame: null,
      },
      dailyHistory: {
        '2026-10-08': { date: '2026-10-08', xpGained: 700 },
      },
      srsProgressMap: {},
      userCollocations: [],
      recentReviewEvents: [],
      fourSkillsScores: {},
    };

    registerCloudSyncStoreGetter(() => mockStoreState);

    useCloudSyncStore.setState({
      isOnline: true,
      userId: null,
      user: null,
      status: 'idle',
      userEmail: null,
    });
    setActiveSyncedUserId(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearSyncCoordinatorForTesting();
    localStorage.clear();
  });

  // ==========================================================================
  // TEST 1: USERNAME COLLISION (The Core Bug Fix)
  // ==========================================================================
  describe('1. Username Collision Isolation', () => {
    it('GUEST: Local user named "Hoang" (700 XP) NEVER matches Cloud User A named "Hoang" (0 XP)', () => {
      const guestIdentity = deriveLeaderboardIdentity({ userId: null, status: 'idle' });

      const cloudUserA: LeaderboardEntry = {
        userId: CLOUD_USER_A_ID,
        rank: 1,
        displayName: 'Hoang',
        level: 1,
        rankTitle: 'Tập Sự',
        score: 0,
        isCurrentUser: false,
      };

      // 1. isCurrentLeaderboardUser must return false for Guest regardless of identical name
      expect(isCurrentLeaderboardUser(cloudUserA, guestIdentity)).toBe(false);

      // 2. resolveCurrentUserEntry must return null (Guest has no online rank)
      const resolved = resolveCurrentUserEntry([cloudUserA], null, guestIdentity);
      expect(resolved).toBeNull();
    });

    it('ACCOUNT B LOGIN: Matches ONLY Account B UUID regardless of identical name with Cloud User A', () => {
      // User logs in as Account B (even if also named "Hoang")
      const accountBIdentity = deriveLeaderboardIdentity({
        userId: CLOUD_USER_B_ID,
        status: 'synced',
      });

      const cloudUserA: LeaderboardEntry = {
        userId: CLOUD_USER_A_ID,
        rank: 1,
        displayName: 'Hoang',
        level: 1,
        rankTitle: 'Tập Sự',
        score: 0,
        isCurrentUser: false,
      };

      const cloudUserB: LeaderboardEntry = {
        userId: CLOUD_USER_B_ID,
        rank: 2,
        displayName: 'Hoang',
        level: 5,
        rankTitle: 'Chuyên Gia',
        score: 700,
        isCurrentUser: false,
      };

      const entries = [cloudUserA, cloudUserB];

      // Cloud User A is NOT current user
      expect(isCurrentLeaderboardUser(cloudUserA, accountBIdentity)).toBe(false);

      // Cloud User B IS current user
      expect(isCurrentLeaderboardUser(cloudUserB, accountBIdentity)).toBe(true);

      // Resolved current user entry matches Account B strictly by UUID
      const resolved = resolveCurrentUserEntry(entries, null, accountBIdentity);
      expect(resolved).not.toBeNull();
      expect(resolved?.userId).toBe(CLOUD_USER_B_ID);
      expect(resolved?.rank).toBe(2);
      expect(resolved?.score).toBe(700);
      expect(resolved?.isCurrentUser).toBe(true);
    });
  });

  // ==========================================================================
  // TEST 2: AUTHENTICATED USER_ID STRICT MATCHING
  // ==========================================================================
  describe('2. Authenticated user_id Match Strictness', () => {
    it('strictly matches only when row.userId === authUser.id (zero nickname/avatar fallback)', () => {
      const authIdentity = deriveLeaderboardIdentity({
        userId: CLOUD_USER_A_ID,
        status: 'synced',
      });

      const rowWithSameNameOtherId: LeaderboardEntry = {
        userId: 'some-other-uuid-9999-999999999999',
        rank: 1,
        displayName: 'Hoang',
        avatarUrl: 'https://avatar.com/test.png',
        level: 10,
        rankTitle: 'Master',
        score: 1500,
        isCurrentUser: false,
      };

      const rowWithMatchingId: LeaderboardEntry = {
        userId: CLOUD_USER_A_ID,
        rank: 2,
        displayName: 'Hoang Different Nickname',
        avatarUrl: undefined,
        level: 2,
        rankTitle: 'Novice',
        score: 300,
        isCurrentUser: false,
      };

      expect(isCurrentLeaderboardUser(rowWithSameNameOtherId, authIdentity)).toBe(false);
      expect(isCurrentLeaderboardUser(rowWithMatchingId, authIdentity)).toBe(true);
    });
  });

  // ==========================================================================
  // TEST 3: GUEST NO CURRENT CLOUD ROW
  // ==========================================================================
  describe('3. Guest Zero Current Cloud Row Invariant', () => {
    it('always discards any remote or cached currentUserEntry when guest visits leaderboard', () => {
      const guestIdentity = deriveLeaderboardIdentity({ userId: null, status: 'idle' });

      const staleCachedCurrentUser: LeaderboardEntry = {
        userId: CLOUD_USER_A_ID,
        rank: 5,
        displayName: 'Previous User',
        level: 8,
        rankTitle: 'Pro',
        score: 900,
        isCurrentUser: true,
      };

      // Even if stale cache has a currentUserEntry, resolver MUST reject it for guest
      const result = resolveCurrentUserEntry([], staleCachedCurrentUser, guestIdentity);
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // TEST 4: GET_MY_LEADERBOARD_RANK GUEST & AUTHENTICATED BEHAVIOR
  // ==========================================================================
  describe('4. getMyLeaderboardRank Guarding & Integrity', () => {
    it('returns null immediately for guest without making any Supabase RPC calls', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc');

      // 1. undefined userId
      const resUndefined = await getMyLeaderboardRank('weekly_xp', undefined);
      expect(resUndefined).toBeNull();

      // 2. empty string
      const resEmpty = await getMyLeaderboardRank('weekly_xp', '');
      expect(resEmpty).toBeNull();

      // 3. invalid UUID (e.g. display name string)
      const resUsername = await getMyLeaderboardRank('weekly_xp', 'Hoang Nguyen');
      expect(resUsername).toBeNull();

      // Ensure no RPC call was dispatched
      expect(rpcSpy).not.toHaveBeenCalled();
    });

    it('rejects RPC result if returned user_id does not match requested canonical user_id', async () => {
      // Mock RPC returning a spoofed or mismatched user_id
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          found: true,
          entry: {
            user_id: 'mismatched-uuid-9999-999999999999',
            rank: 1,
            display_name: 'Imposter',
            score: 9999,
            level: 10,
          },
        },
        error: null,
      } as any);

      const result = await getMyLeaderboardRank('weekly_xp', CLOUD_USER_A_ID);
      // Hardened check rejects mismatch
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // TEST 5: MAIN LIST vs STICKY CONSISTENCY (Same score, same category)
  // ==========================================================================
  describe('5. Main List vs Sticky Consistency', () => {
    it('prioritizes fresh entry from current view list over stale apiCurrentUserEntry (no 500 XP vs 0 XP discrepancy)', () => {
      const authIdentity = deriveLeaderboardIdentity({
        userId: CLOUD_USER_A_ID,
        status: 'synced',
      });

      // Stale server response having score = 0
      const staleApiCurrentUserEntry: LeaderboardEntry = {
        userId: CLOUD_USER_A_ID,
        rank: 99,
        displayName: 'Hoang',
        score: 0,
        level: 1,
        rankTitle: 'Tập Sự',
        isCurrentUser: true,
      };

      // Current view entries freshly fetched having score = 500
      const currentViewEntries: LeaderboardEntry[] = [
        {
          userId: 'other-user',
          rank: 1,
          displayName: 'Top 1',
          score: 800,
          level: 5,
          rankTitle: 'VIP',
          isCurrentUser: false,
        },
        {
          userId: CLOUD_USER_A_ID,
          rank: 2,
          displayName: 'Hoang',
          score: 500,
          level: 3,
          rankTitle: 'Chiến Binh',
          isCurrentUser: false,
        },
      ];

      const resolved = resolveCurrentUserEntry(
        currentViewEntries,
        staleApiCurrentUserEntry,
        authIdentity
      );

      // Must take the fresh score (500 XP, rank 2) from currentViewEntries
      expect(resolved).not.toBeNull();
      expect(resolved?.score).toBe(500);
      expect(resolved?.rank).toBe(2);
      expect(resolved?.userId).toBe(CLOUD_USER_A_ID);
    });
  });

  // ==========================================================================
  // TEST 6: LOGOUT HIGHLIGHT CLEANUP (Public row remains, "BẠN" highlight removed)
  // ==========================================================================
  describe('6. Logout Highlight Cleanup', () => {
    it('cleans up isCurrentUser: true across all entries after logout, leaving public rows unhighlighted', () => {
      const authIdentity = deriveLeaderboardIdentity({
        userId: CLOUD_USER_A_ID,
        status: 'synced',
      });

      const initialEntries: LeaderboardEntry[] = [
        {
          userId: CLOUD_USER_A_ID,
          rank: 1,
          displayName: 'Hoang',
          score: 700,
          level: 3,
          rankTitle: 'Chiến Binh',
          isCurrentUser: true,
        },
        {
          userId: 'other-uuid',
          rank: 2,
          displayName: 'Bob',
          score: 500,
          level: 2,
          rankTitle: 'Tập Sự',
          isCurrentUser: false,
        },
      ];

      // While authenticated, User A is highlighted
      const sanitizedAuth = sanitizeEntriesForIdentity(initialEntries, authIdentity);
      expect(sanitizedAuth[0].isCurrentUser).toBe(true);
      expect(sanitizedAuth[1].isCurrentUser).toBe(false);

      // User logs out -> identity becomes local_only
      const logoutIdentity = deriveLeaderboardIdentity({ userId: null, status: 'idle' });

      // Sanitized after logout -> ZERO entries have isCurrentUser: true
      const sanitizedLogout = sanitizeEntriesForIdentity(initialEntries, logoutIdentity);
      expect(sanitizedLogout[0].isCurrentUser).toBe(false);
      expect(sanitizedLogout[1].isCurrentUser).toBe(false);

      // Public data (displayName, score, rank) remains 100% visible
      expect(sanitizedLogout[0].displayName).toBe('Hoang');
      expect(sanitizedLogout[0].score).toBe(700);
    });
  });

  // ==========================================================================
  // TEST 7: COMPONENT INTEGRATION IN LEADERBOARDVIEW
  // ==========================================================================
  describe('7. LeaderboardView Component Integration', () => {
    it('renders public podium and local sticky bar for guest without highlighting cloud user having identical name', async () => {
      // Guest state: local name 'Hoang', 700 local XP
      useCloudSyncStore.setState({
        isOnline: true,
        userId: null,
        user: null,
        status: 'idle',
      });

      useAppStore.setState({
        profile: {
          name: 'Hoang',
          xp: 700,
          level: 3,
          streak: 5,
        } as any,
        dailyHistory: {
          '2026-10-08': {
            date: '2026-10-08',
            xpGained: 700,
            wordsReviewed: 0,
            newWordsLearned: 0,
            quizzesCompleted: 0,
            pronunciationsMastered: 0,
          },
        },
      });

      // Mock remote leaderboard returning Cloud User A with name 'Hoang' and 0 XP
      vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
        entries: [
          {
            userId: CLOUD_USER_A_ID,
            rank: 1,
            displayName: 'Hoang',
            score: 0,
            level: 1,
            rankTitle: 'Tập Sự',
            isCurrentUser: false,
          },
        ],
        totalCount: 1,
        currentUserEntry: null,
        status: 'SUCCESS',
        error: null,
      });

      render(<LeaderboardView />);

      // Wait for podium to load
      await waitFor(() => {
        expect(screen.getByText('Hoang')).toBeDefined();
      });

      // 1. Podium has user "Hoang", but must NOT have "BẠN" badge
      const banBadges = screen.queryAllByText('BẠN');
      expect(banBadges.length).toBe(0);

      // 2. Bottom sticky bar shows guest local presentation
      expect(screen.getByText('Bạn đang dùng chế độ cục bộ')).toBeDefined();
      expect(screen.getByText('700 XP')).toBeDefined();
      expect(screen.getByText('Đăng nhập để đồng bộ & tham gia bảng xếp hạng')).toBeDefined();

      // 3. Online sticky rank `#1` is NOT displayed for guest
      expect(screen.queryByText('#1')).toBeNull();
    });
  });
});
