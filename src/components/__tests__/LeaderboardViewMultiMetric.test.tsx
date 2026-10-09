// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  LeaderboardView,
  formatMetricScore,
  formatSecondaryScore,
  formatGapScore,
  LEADERBOARD_CATEGORIES,
} from '../LeaderboardView';
import * as leaderboardService from '../../services/leaderboardService';
import { useCloudSyncStore } from '../../services/cloudSyncService';
import { useAppStore } from '../../store/useAppStore';

// Mock framer-motion to avoid animation delays/cancellation in happy-dom
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

describe('LeaderboardView Multi-Metric UI (Phase 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(leaderboardService, 'syncUserScoreToLeaderboard').mockResolvedValue();
    useCloudSyncStore.setState({
      isOnline: true,
      user: { id: 'usr_me', email: 'me@example.com' } as any,
      userId: 'usr_me',
      status: 'idle',
      lastSyncedAt: '2026-10-08T00:00:00Z',
    });
    useAppStore.setState({
      profile: {
        name: 'Chiến Thần Học Tập',
        level: 10,
        xp: 3500,
        streak: 15,
        avatarSeed: 'seed999',
        lastActiveDate: '2026-10-06',
        lastStudyDate: '2026-10-06',
        hearts: 5,
        maxHearts: 5,
        targetDailyWords: 20,
        targetDailyNewWords: 15,
        extraNewWordsBonus: 0,
      },
      dailyHistory: {
        '2026-10-06': {
          date: '2026-10-06',
          wordsReviewed: 25,
          newWordsLearned: 10,
          quizzesCompleted: 3,
          pronunciationsMastered: 4,
          xpGained: 300,
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Pure Metric & Secondary Score Formatting Helpers', () => {
    it('formatMetricScore formats correctly for all 7 metrics', () => {
      expect(formatMetricScore(1500, 'weekly_xp')).toBe('1,500 XP');
      expect(formatMetricScore(12, 'streak')).toBe('12 ngày');
      expect(formatMetricScore(45, 'vocab_mastered')).toBe('45 từ');
      expect(formatMetricScore(98.54, 'review_consistency')).toBe('98.5%');
      expect(formatMetricScore(180, 'active_minutes')).toBe('180 phút');
      expect(formatMetricScore(7.24, 'pronunciation_gain')).toBe('+7.2 điểm');
      expect(formatMetricScore(-1.5, 'pronunciation_gain')).toBe('-1.5 điểm');
      expect(formatMetricScore(120, 'toeic_gain')).toBe('+120 LR');
    });

    it('formatSecondaryScore provides informative secondary details', () => {
      expect(formatSecondaryScore(7, 'weekly_xp')).toBe('7 ngày streak');
      expect(formatSecondaryScore(1200, 'streak')).toBe('1,200 XP tuần');
      expect(formatSecondaryScore(15, 'vocab_mastered')).toBe('15 từ chuyển giao');
      expect(formatSecondaryScore(5, 'review_consistency')).toBe('5 ngày ôn');
      expect(formatSecondaryScore(8, 'active_minutes')).toBe('8 phiên học');
      expect(formatSecondaryScore(24, 'pronunciation_gain')).toBe('24 lượt mẫu');
      expect(formatSecondaryScore(3, 'toeic_gain')).toBe('3 bài mock');
      expect(formatSecondaryScore(undefined, 'weekly_xp')).toBeNull();
      expect(formatSecondaryScore(0, 'vocab_mastered')).toBeNull();
    });

    it('formatGapScore formats rank distances accurately', () => {
      expect(formatGapScore(250, 'weekly_xp')).toBe('+250 XP');
      expect(formatGapScore(3, 'streak')).toBe('+3 ngày');
      expect(formatGapScore(5, 'vocab_mastered')).toBe('+5 từ');
      expect(formatGapScore(2.4, 'review_consistency')).toBe('+2.4%');
      expect(formatGapScore(30, 'active_minutes')).toBe('+30 phút');
      expect(formatGapScore(4.5, 'pronunciation_gain')).toBe('+4.5 điểm');
      expect(formatGapScore(50, 'toeic_gain')).toBe('+50 LR');
    });
  });

  describe('2. Multi-Metric Tabs & Keyboard Navigation', () => {
    it('renders all 7 category tabs with proper ARIA attributes', async () => {
      vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
        entries: [],
        error: null,
      });

      render(<LeaderboardView />);

      await waitFor(() => {
        expect(screen.queryByText(/Đang tải bảng xếp hạng/i)).toBeNull();
      });

      const tabList = screen.getByRole('tablist', { name: /Danh mục bảng xếp hạng/i });
      expect(tabList).toBeDefined();

      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBe(7);

      expect(screen.getByRole('tab', { name: /Top XP Tuần/i }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByRole('tab', { name: /Từ Vựng Bền Vững/i }).getAttribute('aria-selected')).toBe('false');
      expect(screen.getByRole('tab', { name: /Kỷ Luật Ôn Tập/i }).getAttribute('aria-selected')).toBe('false');
      expect(screen.getByRole('tab', { name: /Thời Gian Học/i }).getAttribute('aria-selected')).toBe('false');
      expect(screen.getByRole('tab', { name: /Tiến Bộ Phát Âm/i }).getAttribute('aria-selected')).toBe('false');
      expect(screen.getByRole('tab', { name: /Tăng Trưởng TOEIC/i }).getAttribute('aria-selected')).toBe('false');
      expect(screen.getByRole('tab', { name: /Top Chuỗi Streak/i }).getAttribute('aria-selected')).toBe('false');
    });

    it('switches categories and fetches server-authoritative leaderboard on tab click', async () => {
      const fetchSpy = vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
        entries: [
          {
            userId: 'u_vocab_1',
            rank: 1,
            displayName: 'Trần Đại Từ',
            level: 14,
            rankTitle: 'VIP Learner',
            score: 52,
            secondaryScore: 18,
            isCurrentUser: false,
          },
        ],
        error: null,
      });

      render(<LeaderboardView />);

      await waitFor(() => {
        expect(screen.queryByText(/Đang tải bảng xếp hạng/i)).toBeNull();
      });

      // Switch to Từ Vựng Bền Vững
      const vocabTab = screen.getByRole('tab', { name: /Từ Vựng Bền Vững/i });
      fireEvent.click(vocabTab);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith('vocab_mastered', 'usr_me', 50);
      });

      expect(vocabTab.getAttribute('aria-selected')).toBe('true');
      expect(screen.getByText('Trần Đại Từ')).toBeDefined();
      expect(screen.getAllByText('52 từ').length).toBeGreaterThan(0);
      expect(screen.getAllByText('18 từ chuyển giao').length).toBeGreaterThan(0);
    });

    it('supports ArrowRight and ArrowLeft keyboard navigation across tabs', async () => {
      const fetchSpy = vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
        entries: [],
        error: null,
      });

      render(<LeaderboardView />);

      await waitFor(() => {
        expect(screen.queryByText(/Đang tải bảng xếp hạng/i)).toBeNull();
      });

      const currentTab = screen.getByRole('tab', { name: /Top XP Tuần/i });
      fireEvent.keyDown(currentTab, { key: 'ArrowRight' });

      await waitFor(() => {
        // ArrowRight from index 0 should switch to index 1 (vocab_mastered)
        expect(fetchSpy).toHaveBeenCalledWith('vocab_mastered', 'usr_me', 50);
      });

      const newTab = screen.getByRole('tab', { name: /Từ Vựng Bền Vững/i });
      fireEvent.keyDown(newTab, { key: 'ArrowLeft' });

      await waitFor(() => {
        // ArrowLeft from index 1 should switch back to index 0 (weekly_xp)
        expect(fetchSpy).toHaveBeenCalledWith('weekly_xp', 'usr_me', 50);
      });
    });
  });

  describe('3. Explanation Callouts & Ineligibility Guidance UX', () => {
    it('displays active category explanation and ineligibility hint in callout', async () => {
      vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
        entries: [],
        error: null,
      });

      render(<LeaderboardView />);

      await waitFor(() => {
        expect(screen.queryByText(/Đang tải bảng xếp hạng/i)).toBeNull();
      });

      // Switch to Tiến Bộ Phát Âm
      fireEvent.click(screen.getByRole('tab', { name: /Tiến Bộ Phát Âm/i }));

      await waitFor(() => {
        expect(screen.getByText(/Mức độ cải thiện điểm phát âm/i)).toBeDefined();
      });

      expect(screen.getAllByText(/Cần hoàn thành tối thiểu 10 lượt phát âm/i).length).toBeGreaterThan(0);
    });

    it('shows ineligible hint on empty category state', async () => {
      vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
        entries: [],
        error: null,
      });

      render(<LeaderboardView />);

      await waitFor(() => {
        expect(screen.queryByText(/Đang tải bảng xếp hạng/i)).toBeNull();
      });

      // Switch to Tăng Trưởng TOEIC
      fireEvent.click(screen.getByRole('tab', { name: /Tăng Trưởng TOEIC/i }));

      await waitFor(() => {
        expect(screen.getByText('Chưa có học viên nào trên bảng xếp hạng.')).toBeDefined();
      });

      expect(screen.getByText(/Yêu cầu tối thiểu: Cần hoàn thành tối thiểu 2 bài thi mock test/i)).toBeDefined();
    });

    it('shows ineligibility guidance in sticky bottom bar when current user is unranked', async () => {
      vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
        entries: [
          {
            userId: 'other_user',
            rank: 1,
            displayName: 'Phát Âm Chuẩn',
            level: 12,
            rankTitle: 'VIP Learner',
            score: 14.5,
            secondaryScore: 28,
            isCurrentUser: false,
          },
        ],
        error: null,
      });

      render(<LeaderboardView />);

      await waitFor(() => {
        expect(screen.queryByText(/Đang tải bảng xếp hạng/i)).toBeNull();
      });

      // Switch to Phát Âm
      fireEvent.click(screen.getByRole('tab', { name: /Tiến Bộ Phát Âm/i }));

      await waitFor(() => {
        expect(screen.getByText('Phát Âm Chuẩn')).toBeDefined();
      });

      // Current user is not in the list (ineligible / not ranked)
      expect(screen.getByText('Chưa xếp hạng')).toBeDefined();
      expect(screen.getByText(/Chưa đủ điều kiện: Cần (?:hoàn thành )?tối thiểu 10 lượt phát âm/i)).toBeDefined();
      expect(screen.getByText(/Chưa đủ dữ liệu|--/)).toBeDefined();
    });
  });

  describe('4. Continuous Improvement & Full Podiums', () => {
    it('displays podium with positive gains and formatted units for Pronunciation', async () => {
      vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
        entries: [
          {
            userId: 'p1',
            rank: 1,
            displayName: 'Vocal King',
            level: 20,
            rankTitle: 'VIP Learner',
            score: 18.2,
            secondaryScore: 40,
            isCurrentUser: false,
          },
          {
            userId: 'usr_me',
            rank: 2,
            displayName: 'Chiến Thần Học Tập',
            level: 10,
            rankTitle: 'VIP Learner',
            score: 12.0,
            secondaryScore: 25,
            isCurrentUser: true,
          },
        ],
        error: null,
      });

      render(<LeaderboardView />);

      await waitFor(() => {
        expect(screen.queryByText(/Đang tải bảng xếp hạng/i)).toBeNull();
      });

      fireEvent.click(screen.getByRole('tab', { name: /Tiến Bộ Phát Âm/i }));

      await waitFor(() => {
        expect(screen.getByText('Vocal King')).toBeDefined();
      });

      expect(screen.getAllByText('+18.2 điểm').length).toBeGreaterThan(0);
      expect(screen.getAllByText('40 lượt mẫu').length).toBeGreaterThan(0);
      expect(screen.getAllByText('+12.0 điểm').length).toBeGreaterThan(0);
      expect(screen.getAllByText('25 lượt mẫu').length).toBeGreaterThan(0);

      // Current user is rank 2, gap to rank 1 is 18.2 - 12.0 = 6.2
      expect(screen.getByText(/Cách hạng trên: \+6\.2 điểm/i)).toBeDefined();
    });

    it('NEVER passes profile.name "Huy Hoàng" as currentUserId when user is not logged in (user: null)', async () => {
      // Thiết lập trạng thái người dùng chưa đăng nhập (user: null, userId: null), nhưng có profile.name là "Huy Hoàng"
      useCloudSyncStore.setState({
        isOnline: true,
        user: null,
        userId: null,
      });
      useAppStore.setState({
        profile: {
          name: 'Huy Hoàng',
          level: 1,
          xp: 0,
          streak: 0,
          avatarSeed: 'seed_huyhoang',
          lastActiveDate: '2026-10-07',
          lastStudyDate: '2026-10-07',
          hearts: 5,
          maxHearts: 5,
          targetDailyWords: 20,
          targetDailyNewWords: 15,
          extraNewWordsBonus: 0,
        },
      });

      const fetchSpy = vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
        entries: [],
        error: null,
      });

      render(<LeaderboardView />);

      await waitFor(() => {
        expect(screen.queryByText(/Đang tải bảng xếp hạng/i)).toBeNull();
      });

      // Kiểm tra lần gọi ban đầu (Top XP Tuần)
      expect(fetchSpy).toHaveBeenCalledWith('weekly_xp', undefined, 50);

      // Chuyển sang tab Từ Vựng Bền Vững (Multi-Metric)
      fireEvent.click(screen.getByRole('tab', { name: /Từ Vựng Bền Vững/i }));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith('vocab_mastered', undefined, 50);
      });

      // Đảm bảo "Huy Hoàng" KHÔNG BAO GIỜ xuất hiện trong bất kỳ lần gọi fetchLeaderboardWithStatus nào
      for (const call of fetchSpy.mock.calls) {
        expect(call[1]).not.toBe('Huy Hoàng');
      }
    });
  });
});
