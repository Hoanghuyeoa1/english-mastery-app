// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { LeaderboardView } from '../LeaderboardView';
import { WeeklyAwardCeremonyModal } from '../WeeklyAwardCeremonyModal';
import { WeeklyResultsModal } from '../WeeklyResultsModal';
import * as leaderboardService from '../../services/leaderboardService';
import * as weeklyCeremonyService from '../../services/weeklyCeremonyService';
import * as weeklyFinalizationService from '../../services/weeklyFinalizationService';
import * as frameRewardService from '../../services/frameRewardService';
import { useCloudSyncStore } from '../../services/cloudSyncService';
import { useAppStore } from '../../store/useAppStore';

// Mock framer-motion to avoid Happy-DOM animation issues
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

// Mock confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('PHASE 4: Weekly Results UI, Ceremony & Frame Presentation Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    weeklyCeremonyService.clearAcknowledgedCeremoniesForTesting();
    leaderboardService.clearCachedLeaderboardForTesting();

    vi.spyOn(leaderboardService, 'syncUserScoreToLeaderboard').mockResolvedValue();

    useCloudSyncStore.setState({
      isOnline: true,
      user: { id: 'test_winner_uid', email: 'winner@example.com' } as any,
      userId: 'test_winner_uid',
    });

    useAppStore.setState({
      profile: {
        name: 'Chiến Thần Học Tập',
        level: 15,
        xp: 3500,
        streak: 14,
        avatarSeed: 'winner123',
        lastActiveDate: '2026-10-05',
        lastStudyDate: '2026-10-05',
        hearts: 5,
        maxHearts: 5,
        targetDailyWords: 20,
        targetDailyNewWords: 15,
        extraNewWordsBonus: 0,
        equippedFrame: null,
        unlockedFrames: [],
      },
      dailyHistory: {
        '2026-10-05': {
          date: '2026-10-05',
          wordsReviewed: 20,
          newWordsLearned: 15,
          quizzesCompleted: 5,
          pronunciationsMastered: 3,
          xpGained: 500,
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    weeklyCeremonyService.clearAcknowledgedCeremoniesForTesting();
    leaderboardService.clearCachedLeaderboardForTesting();
  });

  describe('1. Leaderboard UI, Empty State & Partial Real Users', () => {
    it('hiển thị thông báo empty state khi 0 users trên bảng xếp hạng', async () => {
      vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
        entries: [],
        error: null,
      });

      render(<LeaderboardView />);

      await waitFor(() => {
        expect(screen.queryByText(/Đang tải bảng xếp hạng/i)).toBeNull();
      });

      expect(
        screen.getByText('Chưa có học viên nào trên bảng xếp hạng.')
      ).toBeDefined();
    });

    it('hiển thị đúng 2 học viên thật trên bục vinh danh và không tạo phantom user thứ 3', async () => {
      vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
        entries: [
          {
            userId: 'user_1',
            rank: 1,
            displayName: 'Trần Top 1',
            level: 20,
            rankTitle: 'Master Scholar',
            score: 1200,
            isCurrentUser: false,
          },
          {
            userId: 'user_2',
            rank: 2,
            displayName: 'Lê Top 2',
            level: 18,
            rankTitle: 'VIP Learner',
            score: 950,
            isCurrentUser: false,
          },
        ],
        error: null,
      });

      render(<LeaderboardView />);

      await waitFor(() => {
        expect(screen.queryByText(/Đang tải bảng xếp hạng/i)).toBeNull();
      });

      expect(screen.getByText('Trần Top 1')).toBeDefined();
      expect(screen.getByText('Lê Top 2')).toBeDefined();
      // Báo toàn bộ học viên đã được vinh danh trên bục
      expect(screen.getByText(/Toàn bộ học viên hiện có đã được vinh danh/i)).toBeDefined();
    });
  });

  describe('2. Offline State & Real-User Cache Fallback', () => {
    it('sử dụng dữ liệu real cache an toàn kèm timestamp khi ngoại tuyến, không fake users', async () => {
      // Lưu trước một bản ghi thật vào cache
      leaderboardService.setCachedLeaderboard('weekly_xp', [
        {
          userId: 'cached_user_1',
          rank: 1,
          displayName: 'Học Viên Real Cache',
          level: 8,
          rankTitle: 'Novice',
          score: 450,
          isCurrentUser: false,
        },
      ]);

      useCloudSyncStore.setState({ isOnline: false });

      render(<LeaderboardView />);

      await waitFor(() => {
        expect(screen.queryByText(/Đang tải bảng xếp hạng/i)).toBeNull();
      });

      // Hiển thị banner ngoại tuyến với dữ liệu thật đã lưu
      expect(screen.getByText(/Thiết bị ngoại tuyến — Đang hiển thị bản sao thực tế lưu lúc/i)).toBeDefined();
      expect(screen.getByText('Học Viên Real Cache')).toBeDefined();
      // Không có người dùng giả
      expect(screen.queryByText('Alex Kim')).toBeNull();
    });
  });

  describe('3. Weekly Results (Lịch sử tuần trước & Snapshot Rendering)', () => {
    it('mở modal Weekly Results và hiển thị snapshot Top 1/2/3 cùng khung avatar phần thưởng', async () => {
      vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
        entries: [],
        error: null,
      });

      vi.spyOn(weeklyFinalizationService, 'fetchFinalizedWeeks').mockResolvedValue([
        {
          weekId: '2026-W40',
          weekStart: '2026-09-28T00:00:00Z',
          weekEnd: '2026-10-04T23:59:59Z',
          finalizedAt: '2026-10-05T00:00:05Z',
          totalParticipants: 42,
          isFinalized: true,
        },
      ]);

      vi.spyOn(weeklyFinalizationService, 'fetchWeeklySnapshots').mockResolvedValue([
        {
          weekId: '2026-W40',
          category: 'weekly_xp',
          userId: 'user-champion',
          displayName: 'Quán Quân Tuần 40',
          level: 25,
          rank: 1,
          score: 4200,
          secondaryScore: 14,
          finalizedAt: '2026-10-05T00:00:05Z',
        },
        {
          weekId: '2026-W40',
          category: 'weekly_xp',
          userId: 'user-elite',
          displayName: 'Á Quân Tinh Anh',
          level: 20,
          rank: 2,
          score: 3800,
          secondaryScore: 10,
          finalizedAt: '2026-10-05T00:00:05Z',
        },
        {
          weekId: '2026-W40',
          category: 'weekly_xp',
          userId: 'user-prestige',
          displayName: 'Hoàng Gia Đồng',
          level: 16,
          rank: 3,
          score: 3100,
          secondaryScore: 7,
          finalizedAt: '2026-10-05T00:00:05Z',
        },
      ]);

      render(<LeaderboardView />);

      await waitFor(() => {
        expect(screen.queryByText(/Đang tải bảng xếp hạng/i)).toBeNull();
      });

      // Nhấp nút Kết Quả Tuần Trước
      const historyBtn = screen.getByTitle('Xem kết quả & vinh danh tuần trước');
      fireEvent.click(historyBtn);

      await waitFor(() => {
        expect(screen.getByText('Kết Quả Mùa Giải Tuần Trước')).toBeDefined();
      });

      await waitFor(() => {
        expect(screen.getByText('Quán Quân Tuần 40')).toBeDefined();
        expect(screen.getByText(/Thưởng: Champion Frame/i)).toBeDefined();
        expect(screen.getByText('Á Quân Tinh Anh')).toBeDefined();
        expect(screen.getByText(/Thưởng: Elite Frame/i)).toBeDefined();
        expect(screen.getByText('Hoàng Gia Đồng')).toBeDefined();
        expect(screen.getByText(/Thưởng: Prestige Frame/i)).toBeDefined();
      });
    });
  });

  describe('4. Award Ceremony & Acknowledgement Lifecycle', () => {
    it('hiển thị ceremony congratulations modal cho học viên đạt Top 2 tuần trước', async () => {
      vi.spyOn(weeklyCeremonyService, 'checkPendingCeremony').mockResolvedValue({
        weekId: '2026-W40',
        rank: 2,
        frameId: 'elite_frame',
        score: 3500,
        displayName: 'Chiến Thần Học Tập',
        finalizedAt: '2026-10-05T00:00:05Z',
      });

      vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
        entries: [],
        error: null,
      });

      render(<LeaderboardView />);

      await waitFor(() => {
        expect(screen.getByText('Chúc mừng Chiến Thần Học Tập!')).toBeDefined();
      });

      expect(screen.getAllByText(/Top 2/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Elite Frame/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /Trang bị ngay/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Để sau/i })).toBeDefined();
    });

    it('không hiển thị lại ceremony modal nếu tuần đó đã được acknowledged (chống lặp khi refresh)', async () => {
      // Đánh dấu tuần 2026-W40 đã được xác nhận
      weeklyCeremonyService.acknowledgeCeremony('2026-W40');

      vi.spyOn(weeklyFinalizationService, 'fetchFinalizedWeeks').mockResolvedValue([
        {
          weekId: '2026-W40',
          weekStart: '2026-09-28T00:00:00Z',
          weekEnd: '2026-10-04T23:59:59Z',
          finalizedAt: '2026-10-05T00:00:05Z',
          totalParticipants: 20,
          isFinalized: true,
        },
      ]);

      const ceremony = await weeklyCeremonyService.checkPendingCeremony('test_winner_uid', 'Chiến Thần Học Tập');
      expect(ceremony).toBeNull();
    });

    it('bấm "Để sau" ghi nhận acknowledgement nhưng KHÔNG xóa quyền sở hữu (entitlement)', async () => {
      const onEquipMock = vi.fn();
      const onCloseMock = vi.fn();

      render(
        <WeeklyAwardCeremonyModal
          isOpen={true}
          ceremony={{
            weekId: '2026-W40',
            rank: 1,
            frameId: 'champion_frame',
            score: 5000,
            displayName: 'Chiến Thần Học Tập',
            finalizedAt: '2026-10-05T00:00:05Z',
          }}
          onClose={onCloseMock}
          onEquip={onEquipMock}
          userLevel={15}
        />
      );

      const laterBtn = screen.getByRole('button', { name: /Để sau/i });
      fireEvent.click(laterBtn);

      expect(onCloseMock).toHaveBeenCalled();
      expect(onEquipMock).not.toHaveBeenCalled();
    });

    it('bấm "Trang bị ngay" gọi handler trang bị và đóng modal', async () => {
      const onEquipMock = vi.fn().mockResolvedValue(undefined);
      const onCloseMock = vi.fn();

      render(
        <WeeklyAwardCeremonyModal
          isOpen={true}
          ceremony={{
            weekId: '2026-W40',
            rank: 1,
            frameId: 'champion_frame',
            score: 5000,
            displayName: 'Chiến Thần Học Tập',
            finalizedAt: '2026-10-05T00:00:05Z',
          }}
          onClose={onCloseMock}
          onEquip={onEquipMock}
          userLevel={15}
        />
      );

      const equipBtn = screen.getByRole('button', { name: /Trang bị ngay/i });
      fireEvent.click(equipBtn);

      await waitFor(() => {
        expect(onEquipMock).toHaveBeenCalledWith('champion_frame');
        expect(onCloseMock).toHaveBeenCalled();
      });
    });
  });

  describe('5. Frame Presentation & Accessibility Basics', () => {
    it('hiển thị badge khung vinh danh đã trang bị trên sticky bar của người dùng hiện tại', async () => {
      useAppStore.setState({
        profile: {
          ...useAppStore.getState().profile,
          equippedFrame: 'champion_frame',
        },
      });

      vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
        entries: [
          {
            userId: 'test_winner_uid',
            rank: 5,
            displayName: 'Chiến Thần Học Tập',
            level: 15,
            rankTitle: 'VIP Learner',
            score: 300,
            isCurrentUser: true,
            equippedFrame: 'champion_frame',
          },
        ],
        error: null,
      });

      render(<LeaderboardView />);

      await waitFor(() => {
        expect(screen.getAllByText('TOP 1 QUÁN QUÂN').length).toBeGreaterThan(0);
      });
    });

    it('hỗ trợ accessibility: Đóng ceremony modal khi nhấn phím Escape', () => {
      const onCloseMock = vi.fn();

      render(
        <WeeklyAwardCeremonyModal
          isOpen={true}
          ceremony={{
            weekId: '2026-W40',
            rank: 3,
            frameId: 'prestige_frame',
            score: 2500,
            displayName: 'Chiến Thần Học Tập',
            finalizedAt: '2026-10-05T00:00:05Z',
          }}
          onClose={onCloseMock}
          onEquip={vi.fn()}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onCloseMock).toHaveBeenCalled();
    });
  });
});
