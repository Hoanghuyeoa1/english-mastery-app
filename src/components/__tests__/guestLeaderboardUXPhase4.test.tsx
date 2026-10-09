// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { LeaderboardView } from '../LeaderboardView';
import * as leaderboardService from '../../services/leaderboardService';
import { useCloudSyncStore } from '../../services/cloudSyncService';
import { useAppStore } from '../../store/useAppStore';
import type { DailyProgress, LeaderboardEntry } from '../../types';

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

describe('Phase 4 — Guest Leaderboard UX', () => {
  const mockPublicEntries: LeaderboardEntry[] = [
    {
      userId: 'cloud_user_1',
      rank: 1,
      displayName: 'Top 1 Champion',
      level: 15,
      rankTitle: 'Mythic Legend',
      score: 5000,
      isCurrentUser: false,
    },
    {
      userId: 'cloud_user_2',
      rank: 2,
      displayName: 'Top 2 Master',
      level: 12,
      rankTitle: 'Master Scholar',
      score: 4200,
      isCurrentUser: false,
    },
    {
      userId: 'cloud_user_3',
      rank: 3,
      displayName: 'Top 3 Scholar',
      level: 10,
      rankTitle: 'VIP Learner',
      score: 3800,
      isCurrentUser: false,
    },
    {
      userId: 'cloud_user_4',
      rank: 4,
      // Đặt tên trùng với GuestUser để kiểm thử name collision
      displayName: 'GuestUser',
      level: 8,
      rankTitle: 'VIP Learner',
      score: 2900,
      isCurrentUser: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(leaderboardService, 'syncUserScoreToLeaderboard').mockResolvedValue();

    // Thiết lập trạng thái GUEST: Không có Supabase user hay auth session
    useCloudSyncStore.setState({
      isOnline: true,
      user: null,
      userId: null,
      status: 'idle',
      errorMessage: null,
    });

    // Dữ liệu học tập cục bộ của Guest trên máy
    const dailyHistory: Record<string, DailyProgress> = {
      '2026-10-06': {
        date: '2026-10-06',
        xpGained: 350,
        newWordsLearned: 8,
        wordsReviewed: 20,
        quizzesCompleted: 0,
        pronunciationsMastered: 0,
      },
    };

    useAppStore.setState({
      profile: {
        name: 'GuestUser',
        level: 3,
        xp: 99999, // Lifetime XP lớn
        streak: 5,
        avatarSeed: 'guest_seed',
        lastActiveDate: '2026-10-06',
        lastStudyDate: '2026-10-06',
        hearts: 5,
      } as any,
      dailyHistory,
      srsAlgorithm: 'sm2',
      srsProgressMap: {
        w1: {
          srsLevel: 4,
          easeFactor: 2.5,
          interval: 25,
          reviewCount: 3,
          lastReviewedDate: '2026-10-06T00:00:00.000Z',
          nextReviewDate: '2026-10-25T00:00:00.000Z',
        },
      },
    });

    vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
      entries: mockPublicEntries,
      totalCount: 4,
      currentUserEntry: null,
      status: 'SUCCESS',
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Guest vẫn xem được public ranking đầy đủ (top users, podium, scores, ranks) mà không bị block', async () => {
    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.getByText('Top 1 Champion')).toBeDefined();
    });

    // Xem được cả 3 bục vinh danh và user ở danh sách
    expect(screen.getByText('Top 2 Master')).toBeDefined();
    expect(screen.getByText('Top 3 Scholar')).toBeDefined();
    expect(screen.getByText('GuestUser')).toBeDefined(); // Cloud user có cùng username

    // Không có popup ép login chặn màn hình
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('2. Guest thấy metric local của chính họ trong thanh trạng thái cố định ở dưới', async () => {
    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.getByText('Top 1 Champion')).toBeDefined();
    });

    // Hiển thị rõ chế độ cục bộ
    expect(screen.getByText('Bạn đang dùng chế độ cục bộ')).toBeDefined();
    expect(screen.getByText('Điểm trên thiết bị')).toBeDefined();
    expect(screen.getByText('Trạng thái online: Chưa tham gia bảng xếp hạng')).toBeDefined();

    // Điểm trên thiết bị tính chuẩn từ dailyHistory (350 XP), không lấy profile.xp (99999)
    expect(screen.getByText('350 XP')).toBeDefined();
    expect(screen.queryByText('99,999 XP')).toBeNull();

    // Có secondary display: 5 ngày streak
    expect(screen.getByText('5 ngày streak')).toBeDefined();
  });

  it('3. Tuyệt đối KHÔNG có fake online sticky row (#--, 0 XP, Hạng #) và KHÔNG gắn tag "BẠN" vào cloud user cùng tên', async () => {
    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.getByText('Top 1 Champion')).toBeDefined();
    });

    // KHÔNG hiển thị rank giả "#--"
    expect(screen.queryByText('#--')).toBeNull();

    // KHÔNG hiển thị "Hạng #" trong khu vực người dùng
    expect(screen.queryByText(/Hạng #/)).toBeNull();

    // Dù cloud_user_4 có displayName là 'GuestUser' (trùng với profile.name của Guest),
    // Guest tuyệt đối KHÔNG bị nhận nhầm và KHÔNG có tag "BẠN" nào trên danh sách
    expect(screen.queryByText('BẠN')).toBeNull();
  });

  it('4. Chuyển đổi Category: Local preview tự động cập nhật theo từng tab', async () => {
    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.getByText('Top 1 Champion')).toBeDefined();
    });

    // Tab 1: weekly_xp -> 350 XP
    expect(screen.getByText('350 XP')).toBeDefined();

    // Chuyển sang Tab 2: Từ Vựng Bền Vững (vocab_mastered)
    const vocabTab = screen.getByRole('tab', { name: /Từ Vựng/i });
    fireEvent.click(vocabTab);

    await waitFor(() => {
      // Local preview cập nhật hiển thị số từ đã thành thạo (1 từ từ srsProgressMap)
      expect(screen.getByText('1 từ')).toBeDefined();
    });

    // Chuyển sang Tab 7: Top Chuỗi Streak (streak)
    const streakTab = screen.getByRole('tab', { name: /Chuỗi/i });
    fireEvent.click(streakTab);

    await waitFor(() => {
      // Local preview cập nhật hiển thị chuỗi ngày (5 ngày)
      expect(screen.getByText('5 ngày')).toBeDefined();
    });
  });

  it('5. Phân biệt rõ ràng điều kiện tham gia (không fake 0 hay 0% khi thiếu bằng chứng)', async () => {
    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.getByText('Top 1 Champion')).toBeDefined();
    });

    // Chuyển sang tab Tiến Bộ Phát Âm (pronunciation_gain) khi Guest chưa ghi âm
    const pronTab = screen.getByRole('tab', { name: /Phát Âm/i });
    fireEvent.click(pronTab);

    await waitFor(() => {
      // Hiển thị trung thực "Chưa đủ dữ liệu", KHÔNG fake "0 điểm" hay "+0.0"
      expect(screen.getByText('Chưa đủ dữ liệu')).toBeDefined();
      expect(screen.queryByText('+0.0 điểm')).toBeNull();
      // Hiển thị gợi ý điều kiện
      expect(screen.getByText(/Chưa đủ điều kiện: Cần tối thiểu 10 lượt phát âm/)).toBeDefined();
    });
  });

  it('6. Public pagination vẫn hoạt động bình thường khi là Guest', async () => {
    const page1Entries = Array.from({ length: 50 }, (_, i) => ({
      userId: `u_${i + 1}`,
      rank: i + 1,
      displayName: `User ${i + 1}`,
      level: 10,
      rankTitle: 'VIP Learner',
      score: 1000 - i * 10,
      isCurrentUser: false,
    }));

    const page2Entries = Array.from({ length: 10 }, (_, i) => ({
      userId: `u_${i + 51}`,
      rank: i + 51,
      displayName: `User ${i + 51}`,
      level: 8,
      rankTitle: 'VIP Learner',
      score: 400 - i * 10,
      isCurrentUser: false,
    }));

    const fetchSpy = vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockImplementation(
      async (_metric, _uid, _limit, offset = 0) => {
        return {
          entries: offset === 50 ? page2Entries : page1Entries,
          totalCount: 60,
          status: 'SUCCESS',
          error: null,
        };
      }
    );

    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.getByText('User 1')).toBeDefined();
    });

    // Guest bấm nút Trang sau
    const nextBtn = screen.getByRole('button', { name: /Trang sau/i });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('weekly_xp', undefined, 50, 50);
      expect(screen.getByText('User 51')).toBeDefined();
    });
  });

  it('7. Nút CTA [Đăng nhập & Sync Cloud] gọi callback kích hoạt modal xác thực', async () => {
    const onOpenAuthSyncMock = vi.fn();
    render(<LeaderboardView onOpenAuthSync={onOpenAuthSyncMock} />);

    await waitFor(() => {
      expect(screen.getByText('Top 1 Champion')).toBeDefined();
    });

    // Bấm nút CTA
    const ctaBtn = screen.getByRole('button', { name: /Đăng nhập/i });
    fireEvent.click(ctaBtn);

    expect(onOpenAuthSyncMock).toHaveBeenCalledTimes(1);
  });
});
