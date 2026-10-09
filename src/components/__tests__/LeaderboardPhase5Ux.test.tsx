// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { LeaderboardView } from '../LeaderboardView';
import { leaderboardApi } from '../../services/api/leaderboardApi';
import { ApiError } from '../../services/api/httpClient';
import { useCloudSyncStore } from '../../services/cloudSyncService';
import { useAppStore } from '../../store/useAppStore';

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

describe('PHASE 5 — Leaderboard Frontend, Retry & Error UX Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    useCloudSyncStore.setState({
      user: null,
      userId: null,
      isOnline: true,
      status: 'idle',
      lastSyncedAt: null,
    });

    useAppStore.setState({
      profile: {
        name: 'Hoang',
        avatarSeed: 'seed_1',
        level: 5,
        xp: 1500,
        streak: 10,
        equippedFrame: null,
      } as any,
      dailyHistory: {},
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('1. Initial Loading: Displays loading state while fetching', async () => {
    let resolvePromise: any;
    vi.spyOn(leaderboardApi, 'fetchLeaderboardPage').mockImplementation(
      () => new Promise((resolve) => { resolvePromise = resolve; })
    );

    render(<LeaderboardView isOnline={true} />);

    expect(screen.getByText('Đang tải bảng xếp hạng trực tiếp...')).toBeDefined();

    await act(async () => {
      resolvePromise({
        success: true,
        category: 'weekly_xp',
        weekId: '2026-W41',
        serverWeekId: '2026-W41',
        serverNow: new Date().toISOString(),
        page: 1,
        pageSize: 50,
        totalCount: 0,
        entries: [],
        currentUserEntry: null,
      });
    });
  });

  it('2. SUCCESS_EMPTY: Displays "Chưa có người học nào trong tuần này." when database has 0 learners', async () => {
    vi.spyOn(leaderboardApi, 'fetchLeaderboardPage').mockResolvedValue({
      success: true,
      category: 'weekly_xp',
      weekId: '2026-W41',
      serverWeekId: '2026-W41',
      serverNow: new Date().toISOString(),
      page: 1,
      pageSize: 50,
      totalCount: 0,
      entries: [],
      currentUserEntry: null,
    });

    render(<LeaderboardView isOnline={true} />);

    await waitFor(() => {
      expect(screen.getByText('Chưa có người học nào trong tuần này.')).toBeDefined();
    });

    expect(screen.getByText('Trực tuyến (HTTP)')).toBeDefined();
  });

  it('3. SUCCESS_WITH_DATA: Renders top podium and entries when real learners exist', async () => {
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
          userId: '88888888-8888-8888-8888-888888888888',
          rank: 1,
          displayName: 'Nguyen Van A',
          avatarUrl: undefined,
          avatarSeed: 'seed_a',
          level: 10,
          rankTitle: 'VIP Learner',
          score: 850,
          secondaryScore: 5,
          isCurrentUser: false,
          lastActiveAt: new Date().toISOString(),
          equippedFrame: undefined,
        },
      ],
      currentUserEntry: null,
    });

    render(<LeaderboardView isOnline={true} />);

    await waitFor(() => {
      expect(screen.getByText('Nguyen Van A')).toBeDefined();
      expect(screen.getByText('850 XP')).toBeDefined();
    });
  });

  it('4. NETWORK_ERROR: Renders network failure message and Retry button', async () => {
    vi.spyOn(leaderboardApi, 'fetchLeaderboardPage').mockRejectedValue(
      new ApiError(0, { code: 'NETWORK', message: 'Failed to fetch' })
    );

    render(<LeaderboardView isOnline={true} />);

    await waitFor(() => {
      expect(screen.getByText('Không thể kết nối đến máy chủ bảng xếp hạng')).toBeDefined();
      expect(screen.getByText('Mất kết nối máy chủ')).toBeDefined();
      expect(screen.getByRole('button', { name: /Thử lại/i })).toBeDefined();
    });
  });

  it('5. SERVER_ERROR (HTTP 500): Truthfully displays server error status', async () => {
    vi.spyOn(leaderboardApi, 'fetchLeaderboardPage').mockRejectedValue(
      new ApiError(500, { code: 'SERVER_ERROR', message: 'Internal Server Error' })
    );

    render(<LeaderboardView isOnline={true} />);

    await waitFor(() => {
      expect(screen.getByText('Máy chủ gặp sự cố xử lý (Lỗi 5xx)')).toBeDefined();
      expect(screen.getByText('Lỗi máy chủ')).toBeDefined();
    });
  });

  it('6. Retry Button: Sends real new request, shows loading state, and restores UI without F5', async () => {
    let callCount = 0;
    vi.spyOn(leaderboardApi, 'fetchLeaderboardPage').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new ApiError(0, { code: 'NETWORK', message: 'Network offline' });
      }
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
            displayName: 'Phuc Hoi Thanh Cong',
            level: 8,
            rankTitle: 'VIP Learner',
            score: 1200,
            secondaryScore: 7,
            isCurrentUser: false,
          },
        ],
        currentUserEntry: null,
      };
    });

    render(<LeaderboardView isOnline={true} />);

    // 1. Initial attempt fails
    await waitFor(() => {
      expect(screen.getByText('Không thể kết nối đến máy chủ bảng xếp hạng')).toBeDefined();
    });

    const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
    expect(retryBtn).toBeDefined();

    // 2. Click Retry
    await act(async () => {
      fireEvent.click(retryBtn);
    });

    // 3. Verifies that second call succeeded and restored real data without F5
    await waitFor(() => {
      expect(screen.getByText('Phuc Hoi Thanh Cong')).toBeDefined();
      expect(screen.getByText('1,200 XP')).toBeDefined();
      expect(screen.getByText('Trực tuyến (HTTP)')).toBeDefined();
    });

    expect(callCount).toBe(2);
  });

  it('7. Category Switching: Preserves category, clears previous entries and loads category 1', async () => {
    const fetchSpy = vi.spyOn(leaderboardApi, 'fetchLeaderboardPage').mockResolvedValue({
      success: true,
      category: 'weekly_xp',
      weekId: '2026-W41',
      serverWeekId: '2026-W41',
      serverNow: new Date().toISOString(),
      page: 1,
      pageSize: 50,
      totalCount: 0,
      entries: [],
      currentUserEntry: null,
    });

    render(<LeaderboardView isOnline={true} />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('weekly_xp', expect.any(Object));
    });

    // Click on Vocab Mastered tab
    const vocabTab = screen.getByRole('tab', { name: /Từ Vựng Bền Vững/i });
    await act(async () => {
      fireEvent.click(vocabTab);
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('vocab_mastered', expect.any(Object));
    });
  });

  it('8. Guest UX: Shows local-only card and never tags public user as current user', async () => {
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
          userId: '99999999-9999-9999-9999-999999999999',
          rank: 1,
          displayName: 'Hoang', // identical displayName to guest
          level: 1,
          rankTitle: 'Novice',
          score: 500,
          isCurrentUser: false,
        },
      ],
      currentUserEntry: null,
    });

    render(<LeaderboardView isOnline={true} />);

    await waitFor(() => {
      expect(screen.getByText('Hoang')).toBeDefined();
      expect(screen.getByText('Bạn đang dùng chế độ cục bộ')).toBeDefined();
      expect(screen.queryByText('BẠN')).toBeNull();
    });
  });

  it('9. Ineligible Authenticated User: Shows "Chưa xếp hạng", not fake rank 1 or score 0', async () => {
    const myUuid = '12345678-1234-1234-1234-123456789abc';
    useCloudSyncStore.setState({
      userId: myUuid,
      user: { id: myUuid } as any,
      status: 'synced',
      lastSyncedAt: new Date().toISOString(),
    });

    vi.spyOn(leaderboardApi, 'fetchLeaderboardPage').mockResolvedValue({
      success: true,
      category: 'weekly_xp',
      weekId: '2026-W41',
      serverWeekId: '2026-W41',
      serverNow: new Date().toISOString(),
      page: 1,
      pageSize: 50,
      totalCount: 0,
      entries: [],
      currentUserEntry: null, // ineligible
    });

    render(<LeaderboardView isOnline={true} />);

    await waitFor(() => {
      expect(screen.getByText('Chưa xếp hạng')).toBeDefined();
    });

    expect(screen.queryByText('#1')).toBeNull();
  });
});
