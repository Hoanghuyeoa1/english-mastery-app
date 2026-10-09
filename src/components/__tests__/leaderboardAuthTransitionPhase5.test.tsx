// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { LeaderboardView } from '../LeaderboardView';
import * as leaderboardService from '../../services/leaderboardService';
import { useCloudSyncStore } from '../../services/cloudSyncService';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../lib/supabaseClient';
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

describe('Phase 5 — Leaderboard Sync Cloud CTA & Authentication Transition', () => {
  const CANONICAL_USER_ID = '11111111-1111-4111-a111-111111111111';

  const mockPublicEntries: LeaderboardEntry[] = [
    {
      userId: '22222222-2222-4222-a222-222222222222',
      rank: 1,
      displayName: 'Top 1 Champion',
      level: 15,
      rankTitle: 'Mythic Legend',
      score: 5000,
      isCurrentUser: false,
    },
    {
      userId: '33333333-3333-4333-a333-333333333333',
      rank: 2,
      displayName: 'Top 2 Master',
      level: 12,
      rankTitle: 'Master Scholar',
      score: 4200,
      isCurrentUser: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(leaderboardService, 'syncUserScoreToLeaderboard').mockResolvedValue();

    // 1. Ban đầu là Guest: Chưa đăng nhập, userId null
    useCloudSyncStore.setState({
      isOnline: true,
      user: null,
      userId: null,
      status: 'idle',
      errorMessage: null,
    });

    const dailyHistory: Record<string, DailyProgress> = {
      '2026-10-06': {
        date: '2026-10-06',
        xpGained: 250,
        newWordsLearned: 5,
        wordsReviewed: 15,
        quizzesCompleted: 0,
        pronunciationsMastered: 0,
      },
    };

    useAppStore.setState({
      profile: {
        name: 'Learner Guest',
        level: 2,
        xp: 12500,
        streak: 4,
        avatarSeed: 'learner_seed',
        lastActiveDate: '2026-10-06',
        lastStudyDate: '2026-10-06',
        hearts: 5,
      } as any,
      dailyHistory,
      srsProgressMap: {},
    });

    vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockImplementation(
      async (_metric, uid) => {
        if (uid === CANONICAL_USER_ID) {
          // Trạng thái sau khi login: user có rank #3 trên cloud
          const onlineUserEntry: LeaderboardEntry = {
            userId: CANONICAL_USER_ID,
            rank: 3,
            displayName: 'Learner Guest',
            level: 2,
            rankTitle: 'Novice',
            score: 250,
            isCurrentUser: true,
          };
          return {
            entries: [...mockPublicEntries, onlineUserEntry],
            totalCount: 3,
            currentUserEntry: onlineUserEntry,
            status: 'SUCCESS',
            error: null,
          };
        }
        return {
          entries: mockPublicEntries,
          totalCount: 2,
          currentUserEntry: null,
          status: 'SUCCESS',
          error: null,
        };
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. CTA trong Leaderboard kích hoạt canonical auth flow (qua prop và custom event)', async () => {
    // 1A. Gọi qua prop onOpenAuthSync
    const onOpenAuthSyncMock = vi.fn();
    const { unmount } = render(<LeaderboardView onOpenAuthSync={onOpenAuthSyncMock} />);

    await waitFor(() => {
      expect(screen.getByText('Top 1 Champion')).toBeDefined();
    });

    const ctaBtn = screen.getByRole('button', { name: /Đăng nhập/i });
    fireEvent.click(ctaBtn);

    expect(onOpenAuthSyncMock).toHaveBeenCalledTimes(1);
    unmount();

    // 1B. Khi không truyền prop: dispatch canonical custom event 'emh_open_auth_sync'
    const eventListener = vi.fn();
    window.addEventListener('emh_open_auth_sync', eventListener);

    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.getByText('Top 1 Champion')).toBeDefined();
    });

    const ctaBtnFallback = screen.getByRole('button', { name: /Đăng nhập/i });
    fireEvent.click(ctaBtnFallback);

    expect(eventListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('emh_open_auth_sync', eventListener);
  });

  it('2. Auth Success Transition: Chuyển đổi mượt mà từ Guest sang Authenticated Rank mà không cần F5/reload', async () => {
    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.getByText('Top 1 Champion')).toBeDefined();
    });

    // Lúc chưa login: hiển thị thẻ cục bộ
    expect(screen.getByText('Bạn đang dùng chế độ cục bộ')).toBeDefined();
    expect(screen.getByText('250 XP')).toBeDefined();
    expect(screen.queryByText(/Hạng #/)).toBeNull();

    // Giả lập luồng: AUTH SUCCESS -> session set -> status = synced
    act(() => {
      useCloudSyncStore.setState({
        user: { id: CANONICAL_USER_ID, email: 'learner@example.com' } as any,
        userId: CANONICAL_USER_ID,
        status: 'synced',
      });
    });

    // Reactive update: Leaderboard tự động nạp lại và hiển thị rank của user mà không cần reload
    await waitFor(() => {
      expect(screen.getByText('#3')).toBeDefined();
      expect(screen.getByText('Hạng #3')).toBeDefined();
    });

    // Thẻ local-only "Bạn đang dùng chế độ cục bộ" biến mất, thay bằng thanh thứ hạng online
    expect(screen.queryByText('Bạn đang dùng chế độ cục bộ')).toBeNull();
  });

  it('3. Auth Failure: Giữ nguyên tiến độ học tập cục bộ và không biến metric thành 0', async () => {
    render(<LeaderboardView />);

    await waitFor(() => {
      expect(screen.getByText('Top 1 Champion')).toBeDefined();
    });

    expect(screen.getByText('250 XP')).toBeDefined();

    // Giả lập luồng: Đăng nhập thất bại (sai pass / network error)
    act(() => {
      useCloudSyncStore.setState({
        user: null,
        userId: null,
        status: 'error',
        errorMessage: 'Invalid login credentials',
      });
    });

    // Điểm số cục bộ vẫn được bảo toàn nguyên vẹn, không biến thành 0
    await waitFor(() => {
      expect(screen.getByText('250 XP')).toBeDefined();
      expect(screen.getByText('4 ngày streak')).toBeDefined();
      expect(screen.getByText('Bạn đang dùng chế độ cục bộ')).toBeDefined();
      expect(screen.queryByText('0 XP')).toBeNull();
    });
  });

  it('4. Không tạo duplicate onAuthStateChange trong LeaderboardView', () => {
    const onAuthStateChangeSpy = vi.spyOn(supabase.auth, 'onAuthStateChange');

    render(<LeaderboardView />);

    // LeaderboardView chỉ observe canonical auth state qua Zustand store,
    // TUYỆT ĐỐI không gọi supabase.auth.onAuthStateChange lần thứ hai
    expect(onAuthStateChangeSpy).not.toHaveBeenCalled();
  });
});
