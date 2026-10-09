// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { LeaderboardView } from '../LeaderboardView';
import * as leaderboardService from '../../services/leaderboardService';
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

describe('LeaderboardView Component (Real-User States & Zero-Mock UI)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(leaderboardService, 'syncUserScoreToLeaderboard').mockResolvedValue();
    useCloudSyncStore.setState({
      isOnline: true,
      user: { id: 'test_current_user', email: 'test@example.com' } as any,
      userId: 'test_current_user',
    });
    useAppStore.setState({
      profile: {
        name: 'Học viên Test',
        level: 5,
        xp: 1200,
        streak: 7,
        avatarSeed: 'seed123',
        lastActiveDate: '2026-10-05',
        lastStudyDate: '2026-10-05',
        hearts: 5,
        maxHearts: 5,
        targetDailyWords: 20,
        targetDailyNewWords: 15,
        extraNewWordsBonus: 0,
      },
      dailyHistory: {
        '2026-10-05': {
          date: '2026-10-05',
          wordsReviewed: 10,
          newWordsLearned: 5,
          quizzesCompleted: 2,
          pronunciationsMastered: 1,
          xpGained: 150,
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Hiển thị đúng 3 học viên thật và bục vinh danh khi có 3 users', async () => {
    vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
      entries: [
        {
          userId: 'u1',
          rank: 1,
          displayName: 'Nguyễn Văn A',
          level: 15,
          rankTitle: 'VIP Learner',
          score: 800,
          isCurrentUser: false,
        },
        {
          userId: 'u2',
          rank: 2,
          displayName: 'Trần Thị B',
          level: 12,
          rankTitle: 'VIP Learner',
          score: 650,
          isCurrentUser: false,
        },
        {
          userId: 'test_current_user',
          rank: 3,
          displayName: 'Học viên Test',
          level: 5,
          rankTitle: 'Novice',
          score: 150,
          isCurrentUser: true,
        },
      ],
      error: null,
    });

    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.queryByText(/Đang tải bảng xếp hạng/i)).toBeNull();
    });

    expect(screen.getByText('Nguyễn Văn A')).toBeDefined();
    expect(screen.getByText('Trần Thị B')).toBeDefined();
    expect(screen.getAllByText('Học viên Test').length).toBeGreaterThan(0);
    // Không có người dùng giả nào
    expect(screen.queryByText('Alex Kim')).toBeNull();
    expect(screen.queryByText('Mai Lan')).toBeNull();
  });

  it('2. Hiển thị Empty State khi 0 users (không bù tài khoản giả)', async () => {
    vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
      entries: [],
      error: null,
    });

    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.queryByText(/Đang tải bảng xếp hạng/i)).toBeNull();
    });

    expect(
      screen.getByText('Chưa có người học nào trong tuần này.')
    ).toBeDefined();
    // Bục vinh danh không hiển thị
    expect(screen.queryByText('Alex Kim')).toBeNull();
  });

  it('3. Hiển thị Offline State khi thiết bị mất mạng', async () => {
    useCloudSyncStore.setState({ isOnline: false });

    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.queryByText(/Đang tải bảng xếp hạng/i)).toBeNull();
    });

    expect(screen.getAllByText(/Thiết bị đang ngoại tuyến/i).length).toBeGreaterThan(0);
    expect(screen.queryByText('Alex Kim')).toBeNull();
  });

  it('4. Hiển thị Connection Error State khi Supabase gặp sự cố kết nối', async () => {
    vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
      entries: [],
      error: 'Network connection failed',
    });

    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.queryByText(/Đang tải bảng xếp hạng/i)).toBeNull();
    });

    expect(
      screen.getByText('Không thể kết nối đến máy chủ bảng xếp hạng')
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /Thử lại/i })).toBeDefined();
    expect(screen.queryByText('Alex Kim')).toBeNull();
  });

  it('5. Hiển thị đúng 1 user duy nhất khi chỉ có 1 người trên bảng xếp hạng', async () => {
    vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
      entries: [
        {
          userId: 'test_current_user',
          rank: 1,
          displayName: 'Solo Champion',
          level: 10,
          rankTitle: 'VIP Learner',
          score: 300,
          isCurrentUser: true,
        },
      ],
      error: null,
    });

    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.queryByText(/Đang tải bảng xếp hạng/i)).toBeNull();
    });

    expect(screen.getByText('Solo Champion')).toBeDefined();
    // Danh sách còn lại báo đã vinh danh trên bục Top 3
    expect(
      screen.getByText(/Toàn bộ học viên hiện có đã được vinh danh trên bục Top 3/i)
    ).toBeDefined();
    // Không có tài khoản giả thứ 2 hoặc 3
    expect(screen.queryByText('Alex Kim')).toBeNull();
    expect(screen.queryByText('Mai Lan')).toBeNull();
  });

  it('6. Chuyển đổi qua lại giữa Top XP Tuần và Top Chuỗi Streak', async () => {
    const fetchSpy = vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
      entries: [],
      error: null,
    });

    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.queryByText(/Đang tải bảng xếp hạng/i)).toBeNull();
    });

    const streakTab = screen.getByRole('tab', { name: /Top Chuỗi Streak/i });
    fireEvent.click(streakTab);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('streak', 'test_current_user', 50);
    });
  });

  it('7. Retry sau failure: bấm Thử lại gọi fetch mới thật và cập nhật danh sách thành công', async () => {
    let callCount = 0;
    vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          entries: [],
          status: 'NETWORK_ERROR',
          error: 'Connection timed out',
        };
      }
      return {
        entries: [
          {
            userId: 'recovered_user',
            rank: 1,
            displayName: 'User Recovered',
            level: 8,
            rankTitle: 'VIP Learner',
            score: 550,
            isCurrentUser: false,
          },
        ],
        status: 'SUCCESS',
        error: null,
      };
    });

    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.getByText('Không thể kết nối đến máy chủ bảng xếp hạng')).toBeDefined();
    });

    const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('User Recovered')).toBeDefined();
    });
    expect(screen.queryByText('Không thể kết nối đến máy chủ bảng xếp hạng')).toBeNull();
  });

  it('8. Initial fetch fail + websocket online: không hiển thị Trực tiếp (WebSocket), hiển thị Mất kết nối máy chủ', async () => {
    useCloudSyncStore.setState({ isOnline: true });
    vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
      entries: [],
      status: 'CONFIG_ERROR',
      error: 'Máy chủ chưa được cấu hình',
    });

    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.queryByText(/Đang tải bảng xếp hạng/i)).toBeNull();
    });

    // Tuyệt đối không hiển thị badge "Trực tiếp (WebSocket)" khi initial fetch thất bại
    expect(screen.queryByText('Trực tiếp (WebSocket)')).toBeNull();
    // Hiển thị badge trạng thái lỗi trung thực
    expect(screen.getByText('Mất kết nối máy chủ')).toBeDefined();
  });

  it('9. Week-aware cache: hiển thị rõ nhãn tuần cũ khi dữ liệu lưu thuộc tuần trước', async () => {
    useCloudSyncStore.setState({ isOnline: false });
    vi.spyOn(leaderboardService, 'getCachedLeaderboard').mockReturnValue({
      entries: [
        {
          userId: 'u_past',
          rank: 1,
          displayName: 'Past Winner',
          level: 10,
          rankTitle: 'VIP Learner',
          score: 500,
          isCurrentUser: false,
        },
      ],
      cachedAt: '2026-10-04T20:00:00.000Z',
      weekId: '2026-W40',
      isStaleWeek: true,
    });

    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.getByText('Past Winner')).toBeDefined();
    });

    // Hiển thị nhãn tuần cũ rõ ràng, không giả mạo là tuần hiện tại
    expect(screen.getByText(/Ngoại tuyến \(2026-W40\)/)).toBeDefined();
  });

  it('10. Subscription Cleanup: hủy đăng ký WebSocket an toàn khi unmount', () => {
    const unsubscribeMock = vi.fn();
    vi.spyOn(leaderboardService, 'subscribeToLeaderboard').mockReturnValue(unsubscribeMock);

    const { unmount } = render(<LeaderboardView />);
    expect(leaderboardService.subscribeToLeaderboard).toHaveBeenCalled();

    unmount();
    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it('11. Pagination & Realtime: chuyển sang trang 2 và sự kiện realtime không reset về trang 1', async () => {
    let realtimeCallback: (() => void) | null = null;
    vi.spyOn(leaderboardService, 'subscribeToLeaderboard').mockImplementation((onUpdate) => {
      realtimeCallback = onUpdate;
      return () => {};
    });

    const page1Entries = Array.from({ length: 50 }, (_, i) => ({
      userId: `u_${i + 1}`,
      rank: i + 1,
      displayName: `User ${i + 1}`,
      level: 10,
      rankTitle: 'VIP Learner',
      score: 1000 - i * 10,
      isCurrentUser: false,
    }));

    const page2Entries = Array.from({ length: 30 }, (_, i) => ({
      userId: `u_${i + 51}`,
      rank: i + 51,
      displayName: `User ${i + 51}`,
      level: 8,
      rankTitle: 'VIP Learner',
      score: 500 - i * 10,
      isCurrentUser: false,
    }));

    const fetchSpy = vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockImplementation(
      async (_metric, _uid, _limit, offset = 0) => {
        if (offset === 50) {
          return {
            entries: page2Entries,
            totalCount: 80,
            status: 'SUCCESS',
            error: null,
          };
        }
        return {
          entries: page1Entries,
          totalCount: 80,
          status: 'SUCCESS',
          error: null,
        };
      }
    );

    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.getByText('User 1')).toBeDefined();
    });

    // Bấm nút Trang sau
    const nextBtn = screen.getByRole('button', { name: /Trang sau/i });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('weekly_xp', 'test_current_user', 50, 50);
      expect(screen.getByText('User 51')).toBeDefined();
    });

    // Giả lập sự kiện Realtime gửi về khi đang ở trang 2
    expect(realtimeCallback).toBeDefined();
    realtimeCallback!();

    await waitFor(() => {
      // Bounded refresh phải giữ nguyên trang 2 (offset 50), KHÔNG được reset về trang 1 (offset 0)!
      const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
      expect(lastCall[0]).toBe('weekly_xp');
      expect(lastCall[2]).toBe(50);
      expect(lastCall[3]).toBe(50);
    });
  });

  it('12. Sticky current-user bar hiển thị chính xác vị trí khi user không nằm trong trang hiện tại', async () => {
    const page1Entries = Array.from({ length: 50 }, (_, i) => ({
      userId: `other_user_${i + 1}`,
      rank: i + 1,
      displayName: `Other ${i + 1}`,
      level: 10,
      rankTitle: 'VIP Learner',
      score: 1000 - i * 10,
      isCurrentUser: false,
    }));

    vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
      entries: page1Entries,
      totalCount: 95,
      currentUserEntry: {
        userId: 'test_current_user',
        rank: 82,
        displayName: 'Học viên Test',
        level: 5,
        rankTitle: 'Novice',
        score: 180,
        isCurrentUser: true,
      },
      status: 'SUCCESS',
      error: null,
    });

    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.getByText('Other 1')).toBeDefined();
    });

    // User không nằm trong top 50 của page 1
    expect(page1Entries.some((e) => e.userId === 'test_current_user')).toBe(false);

    // Thanh ghim Sticky bar ở dưới vẫn hiển thị đúng hạng #82
    expect(screen.getByText('#82')).toBeDefined();
    expect(screen.getByText('Hạng #82')).toBeDefined();
  });
});

