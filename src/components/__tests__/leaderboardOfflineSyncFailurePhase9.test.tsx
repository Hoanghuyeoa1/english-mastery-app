// @vitest-environment happy-dom
// src/components/__tests__/leaderboardOfflineSyncFailurePhase9.test.tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { LeaderboardView } from '../LeaderboardView';
import { useAppStore } from '../../store/useAppStore';
import { useCloudSyncStore, clearSyncCoordinatorForTesting } from '../../services/cloudSyncService';
import * as cloudSyncService from '../../services/cloudSyncService';
import * as leaderboardService from '../../services/leaderboardService';

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

describe('PHASE 9 — Leaderboard Offline, Sync Failure & Reconnect UI', () => {
  const TEST_USER_ID = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
    clearSyncCoordinatorForTesting();
    localStorage.clear();

    useAppStore.setState({
      profile: {
        name: 'Hoang Learner',
        avatarSeed: 'seed-hoang',
        level: 3,
        xp: 900,
        streak: 5,
        hearts: 5,
        equippedFrame: null,
      } as any,
      dailyHistory: {
        '2026-10-07': {
          date: '2026-10-07',
          xpGained: 900,
          wordsReviewed: 20,
          newWordsLearned: 10,
          quizzesCompleted: 2,
          pronunciationsMastered: 3,
        },
      },
      srsProgressMap: {},
      userCollocations: [],
      recentReviewEvents: [],
      mistakeBank: {},
    });

    useCloudSyncStore.getState().setSession(null);
    useCloudSyncStore.getState().setIsOnline(true);
    useCloudSyncStore.getState().setStatus('idle');

    // Default mock for fetchLeaderboardWithStatus
    vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
      entries: [],
      totalCount: 0,
      currentUserEntry: null,
      status: 'SUCCESS',
      error: null,
    });
  });

  afterEach(() => {
    clearSyncCoordinatorForTesting();
  });

  it('1. Guest Offline UI: displays local preview, offline notice, and disabled network CTA', async () => {
    useCloudSyncStore.getState().setSession(null);
    useCloudSyncStore.getState().setIsOnline(false);

    render(<LeaderboardView isOnline={false} />);

    // 1. Guest local card title
    await waitFor(() => {
      expect(screen.getByText('Bạn đang dùng chế độ cục bộ')).toBeDefined();
    });

    // 2. Offline subtext notice
    expect(screen.getByText('Thiết bị đang ngoại tuyến • Chưa tham gia bảng xếp hạng')).toBeDefined();

    // 3. Local score displayed without rollback
    expect(screen.getByText('Điểm trên thiết bị')).toBeDefined();
    expect(screen.getByText('900 XP')).toBeDefined();

    // 4. CTA shows "Cần kết nối mạng" and is disabled
    const ctaButton = screen.getByRole('button', { name: /Cần kết nối mạng để đăng nhập/i }) as HTMLButtonElement;
    expect(ctaButton).toBeDefined();
    expect(ctaButton.disabled).toBe(true);
    expect(screen.getByText('Cần kết nối mạng để đăng nhập')).toBeDefined();
  });

  it('2. Authenticated Offline UI: displays "Điểm online sẽ cập nhật khi có mạng" and local score', async () => {
    useCloudSyncStore.getState().setSession({
      user: { id: TEST_USER_ID, email: 'hoang@example.com' } as any,
    } as any);
    useCloudSyncStore.getState().setIsOnline(false);

    render(<LeaderboardView isOnline={false} />);

    // Subtext indicates online score will update once reconnected
    await waitFor(() => {
      expect(screen.getByText('Điểm online sẽ cập nhật khi có mạng')).toBeDefined();
    });

    // Local score displayed
    expect(screen.getByText('900 XP')).toBeDefined();
    expect(screen.queryByText('Bạn đang dùng chế độ cục bộ')).toBeNull();
  });

  it('3. Sync Failure UI: displays "Cloud sync: Chưa đồng bộ được" and retry button calls canonical sync', async () => {
    useCloudSyncStore.getState().setSession({
      user: { id: TEST_USER_ID, email: 'hoang@example.com' } as any,
    } as any);
    useCloudSyncStore.getState().setIsOnline(true);
    useCloudSyncStore.getState().setStatus('error', 'Lỗi kết nối máy chủ');

    const performFullSyncSpy = vi.spyOn(cloudSyncService, 'performFullSync').mockResolvedValue({
      success: true,
    });

    render(<LeaderboardView isOnline={true} />);

    // Error status displayed
    await waitFor(() => {
      expect(screen.getByText('Cloud sync:')).toBeDefined();
    });
    expect(screen.getByText('Chưa đồng bộ được')).toBeDefined();
    expect(screen.getByText(/Điểm trên thiết bị: 900 XP/i)).toBeDefined();

    // Retry button present
    const retryButton = screen.getByRole('button', { name: /Thử lại đồng bộ Cloud/i });
    expect(retryButton).toBeDefined();

    // Clicking retry triggers performFullSync({ isRetry: true })
    fireEvent.click(retryButton);
    expect(performFullSyncSpy).toHaveBeenCalledWith({ isRetry: true });
  });

  it('4. Reconnect Trigger: when isOnline turns from false to true, automatically reloads data', async () => {
    const fetchSpy = vi.spyOn(leaderboardService, 'fetchLeaderboardWithStatus').mockResolvedValue({
      entries: [],
      totalCount: 0,
      currentUserEntry: null,
      status: 'SUCCESS',
      error: null,
    });

    const { rerender } = render(<LeaderboardView isOnline={false} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Thiết bị đang ngoại tuyến/i).length).toBeGreaterThanOrEqual(1);
    });

    fetchSpy.mockClear();

    // Reconnect: isOnline becomes true
    rerender(<LeaderboardView isOnline={true} />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
  });
});
