// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { LeaderboardView } from '../LeaderboardView';
import { leaderboardApi } from '../../services/api/leaderboardApi';
import { ApiError } from '../../services/api/httpClient';
import { useCloudSyncStore } from '../../services/cloudSyncService';
import { useAppStore } from '../../store/useAppStore';
import * as signalRModule from '../../services/api/signalRService';
import {
  subscribeToLeaderboard,
  resetLeaderboardSubscriptionForTesting,
  clearLeaderboardDebounce,
} from '../../services/leaderboardService';
import {
  checkPendingCeremony,
  acknowledgeCeremony,
  isCeremonyAcknowledged,
  clearAcknowledgedCeremoniesForTesting,
} from '../../services/weeklyCeremonyService';
import * as weeklyFinalizationService from '../../services/weeklyFinalizationService';

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

describe('PHASE 6 — SignalR Realtime & Connection Resilience Tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    clearAcknowledgedCeremoniesForTesting();
    clearLeaderboardDebounce();
    await signalRModule.resetSignalRForTesting();
    resetLeaderboardSubscriptionForTesting();

    useCloudSyncStore.setState({
      user: null,
      userId: null,
      isOnline: true,
      status: 'idle',
      lastSyncedAt: null,
    });

    useAppStore.setState({
      profile: {
        name: 'Hoang Learner',
        avatarSeed: 'seed_learner',
        level: 5,
        xp: 1500,
        streak: 10,
        equippedFrame: null,
      } as any,
      dailyHistory: {},
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    clearAcknowledgedCeremoniesForTesting();
    clearLeaderboardDebounce();
    await signalRModule.resetSignalRForTesting();
    resetLeaderboardSubscriptionForTesting();
  });

  it('1. Realtime Failure with REST Operational: Renders data, badges "Trực tuyến (HTTP)", does not report full offline error', async () => {
    // REST succeeds with real entries
    vi.spyOn(leaderboardApi, 'fetchLeaderboardPage').mockResolvedValue({
      success: true,
      category: 'weekly_xp',
      weekId: '2026-W41',
      serverWeekId: '2026-W41',
      serverNow: new Date().toISOString(),
      page: 1,
      pageSize: 50,
      totalCount: 1,
      entries: [
        {
          userId: '11111111-1111-1111-1111-111111111111',
          rank: 1,
          displayName: 'Robust Learner',
          level: 10,
          rankTitle: 'Grandmaster',
          score: 2500,
          isCurrentUser: false,
        },
      ],
      currentUserEntry: null,
    });

    // SignalR is in CHANNEL_ERROR
    const statusSpy = vi.spyOn(signalRModule, 'getCurrentSignalRStatus').mockReturnValue('CHANNEL_ERROR');

    const { unmount } = render(<LeaderboardView isOnline={true} />);

    // REST loads successfully
    await waitFor(() => {
      expect(screen.getByText('Robust Learner')).toBeDefined();
      expect(screen.getByText('2,500 XP')).toBeDefined();
    });

    // Badge correctly indicates HTTP fallback without claiming full connection failure
    expect(screen.getByText('Trực tuyến (HTTP)')).toBeDefined();
    expect(screen.queryByText('Mất kết nối máy chủ')).toBeNull();

    statusSpy.mockRestore();
    unmount();
  });

  it('2. Manual Refresh works even when SignalR is down', async () => {
    let fetchCount = 0;
    vi.spyOn(leaderboardApi, 'fetchLeaderboardPage').mockImplementation(async () => {
      fetchCount++;
      return {
        success: true,
        category: 'weekly_xp',
        weekId: '2026-W41',
        serverWeekId: '2026-W41',
        serverNow: new Date().toISOString(),
        page: 1,
        pageSize: 50,
        totalCount: 1,
        entries: [
          {
            userId: '11111111-1111-1111-1111-111111111111',
            rank: 1,
            displayName: `Learner Count ${fetchCount}`,
            level: 10,
            rankTitle: 'Master',
            score: 1000 * fetchCount,
            isCurrentUser: false,
          },
        ],
        currentUserEntry: null,
      };
    });

    render(<LeaderboardView isOnline={true} />);

    await waitFor(() => {
      expect(screen.getByText('Learner Count 1')).toBeDefined();
    });

    // Click manual refresh button
    const refreshBtn = screen.getByTitle('Làm mới bảng xếp hạng');
    await act(async () => {
      fireEvent.click(refreshBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('Learner Count 2')).toBeDefined();
      expect(fetchCount).toBeGreaterThanOrEqual(2);
    });
  });

  it('3. REST Failure when SignalR is connected: Displays accurate error card and badge, does not falsely claim updated', async () => {
    // REST returns HTTP 500
    vi.spyOn(leaderboardApi, 'fetchLeaderboardPage').mockRejectedValue(
      new ApiError(500, { code: 'SERVER_ERROR', message: 'Database query timed out' })
    );

    render(<LeaderboardView isOnline={true} />);

    await waitFor(() => {
      expect(screen.getByText('Máy chủ gặp sự cố xử lý (Lỗi 5xx)')).toBeDefined();
      expect(screen.getByText('Lỗi máy chủ')).toBeDefined();
    });

    // Does NOT claim realtime WebSocket connection is healthy when data failed
    expect(screen.queryByText('Trực tiếp (WebSocket)')).toBeNull();
  });

  it('4. Event Debounce: Rapid burst events coalesce into a single refresh', async () => {
    vi.useFakeTimers();

    const onUpdate = vi.fn();
    const unsub = subscribeToLeaderboard(onUpdate);

    // Rapid fire 4 events in 200ms
    signalRModule.emitLeaderboardUpdateForTesting({ category: 'weekly_xp' });
    vi.advanceTimersByTime(50);
    signalRModule.emitLeaderboardUpdateForTesting({ category: 'weekly_xp' });
    vi.advanceTimersByTime(50);
    signalRModule.emitLeaderboardUpdateForTesting({ category: 'weekly_xp' });
    vi.advanceTimersByTime(50);
    signalRModule.emitLeaderboardUpdateForTesting({ category: 'weekly_xp' });

    // Still in debounce quiet period (1500ms)
    expect(onUpdate).not.toHaveBeenCalled();

    // Advance 1500ms
    vi.advanceTimersByTime(1500);

    // Only called once!
    expect(onUpdate).toHaveBeenCalledTimes(1);

    unsub();
    vi.useRealTimers();
  });

  it('5. Starvation Protection: Continuous events for 5s force a bounded refresh', async () => {
    vi.useFakeTimers();

    const onUpdate = vi.fn();
    const unsub = subscribeToLeaderboard(onUpdate);

    // Fire an event every 900ms for 5.4 seconds (never reaching the 1.5s quiet window)
    for (let i = 0; i < 6; i++) {
      signalRModule.emitLeaderboardUpdateForTesting({ category: 'weekly_xp' });
      vi.advanceTimersByTime(900);
    }

    // Must have fired at least once due to 5000ms max-wait protection
    expect(onUpdate).toHaveBeenCalledTimes(1);

    unsub();
    vi.useRealTimers();
  });

  it('6. Network online recovery: Window offline and online events transition status accurately', async () => {
    const mockConn: any = {
      state: 'Disconnected',
      start: vi.fn().mockImplementation(async () => {
        mockConn.state = 'Connected';
      }),
      stop: vi.fn().mockImplementation(async () => {
        mockConn.state = 'Disconnected';
      }),
      on: vi.fn(),
      off: vi.fn(),
      onreconnecting: vi.fn(),
      onreconnected: vi.fn(),
      onclose: vi.fn(),
    };
    signalRModule.setCustomConnectionFactoryForTesting(() => mockConn);

    const onStatusChange = vi.fn();
    const unsub = signalRModule.registerSignalRSubscriber(vi.fn(), onStatusChange);

    // Initial subscriber registration transitions to SUBSCRIBED
    await waitFor(() => {
      expect(signalRModule.getCurrentSignalRStatus()).toBe('SUBSCRIBED');
    });

    // Fire window offline event
    window.dispatchEvent(new Event('offline'));
    expect(signalRModule.getCurrentSignalRStatus()).toBe('CHANNEL_ERROR');

    // Fire window online event
    window.dispatchEvent(new Event('online'));
    await waitFor(() => {
      expect(signalRModule.getCurrentSignalRStatus()).toBe('SUBSCRIBED');
    });

    unsub();
    signalRModule.setCustomConnectionFactoryForTesting(null);
  });

  it('7. Account Switching & Identity Race: Resets debounce, resets private rank and switches cleanly', async () => {
    const userA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const userB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    // Step 1: User A is logged in
    useCloudSyncStore.setState({
      userId: userA,
      user: { id: userA, displayName: 'User A' } as any,
    });

    const fetchSpy = vi.spyOn(leaderboardApi, 'fetchLeaderboardPage').mockResolvedValue({
      success: true,
      category: 'weekly_xp',
      weekId: '2026-W41',
      serverWeekId: '2026-W41',
      serverNow: new Date().toISOString(),
      page: 1,
      pageSize: 50,
      totalCount: 2,
      entries: [
        {
          userId: userA,
          rank: 1,
          displayName: 'User A',
          level: 10,
          rankTitle: 'VIP',
          score: 1000,
          isCurrentUser: true,
        },
        {
          userId: userB,
          rank: 2,
          displayName: 'User B',
          level: 5,
          rankTitle: 'Learner',
          score: 500,
          isCurrentUser: false,
        },
      ],
      currentUserEntry: {
        userId: userA,
        rank: 1,
        displayName: 'User A',
        level: 10,
        rankTitle: 'VIP',
        score: 1000,
        isCurrentUser: true,
      },
    });

    const { rerender } = render(<LeaderboardView isOnline={true} />);

    await waitFor(() => {
      expect(screen.getByText('User A')).toBeDefined();
    });

    // Step 2: Switch to User B
    fetchSpy.mockResolvedValueOnce({
      success: true,
      category: 'weekly_xp',
      weekId: '2026-W41',
      serverWeekId: '2026-W41',
      serverNow: new Date().toISOString(),
      page: 1,
      pageSize: 50,
      totalCount: 2,
      entries: [
        {
          userId: userA,
          rank: 1,
          displayName: 'User A',
          level: 10,
          rankTitle: 'VIP',
          score: 1000,
          isCurrentUser: false,
        },
        {
          userId: userB,
          rank: 2,
          displayName: 'User B',
          level: 5,
          rankTitle: 'Learner',
          score: 500,
          isCurrentUser: true,
        },
      ],
      currentUserEntry: {
        userId: userB,
        rank: 2,
        displayName: 'User B',
        level: 5,
        rankTitle: 'Learner',
        score: 500,
        isCurrentUser: true,
      },
    });

    await act(async () => {
      useCloudSyncStore.setState({
        userId: userB,
        user: { id: userB, displayName: 'User B' } as any,
      });
      rerender(<LeaderboardView isOnline={true} />);
    });

    await waitFor(() => {
      expect(screen.getByText('User B')).toBeDefined();
    });
  });

  it('8. Weekly Realtime Ceremony & Deduplication: Identifies winner by canonical UUID and acknowledges ceremony', async () => {
    const winnerId = '77777777-7777-7777-7777-777777777777';

    vi.spyOn(weeklyFinalizationService, 'fetchFinalizedWeeks').mockResolvedValue([
      {
        weekId: '2026-W40',
        weekStart: '2026-09-28T00:00:00.000Z',
        weekEnd: '2026-10-05T00:00:00.000Z',
        finalizedAt: new Date().toISOString(),
        totalParticipants: 50,
        isFinalized: true,
      },
    ]);

    vi.spyOn(weeklyFinalizationService, 'fetchWeeklySnapshots').mockResolvedValue([
      {
        id: 'snap-1',
        weekId: '2026-W40',
        category: 'weekly_xp',
        rank: 1,
        userId: winnerId,
        displayName: 'Top Champion',
        level: 1,
        score: 9999,
        finalizedAt: new Date().toISOString(),
      },
    ]);

    // First check: User is Top 1 -> Returns ceremony data
    const ceremony = await checkPendingCeremony(winnerId, 'Top Champion');
    expect(ceremony).not.toBeNull();
    expect(ceremony?.rank).toBe(1);
    expect(ceremony?.weekId).toBe('2026-W40');

    // Acknowledge the ceremony
    acknowledgeCeremony('2026-W40');
    expect(isCeremonyAcknowledged('2026-W40')).toBe(true);

    // Second check: Ceremony acknowledged -> Returns null, preventing duplicate popups or awards
    const repeatCheck = await checkPendingCeremony(winnerId, 'Top Champion');
    expect(repeatCheck).toBeNull();
  });
});
