// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Navbar } from '../Navbar';
import { LeaderboardView } from '../LeaderboardView';
import { AuthSyncModal } from '../AuthSyncModal';
import { PWANotificationBanner } from '../PWANotificationBanner';
import { useAppStore } from '../../store/useAppStore';
import { useCloudSyncStore } from '../../services/cloudSyncService';

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
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('../../services/api/signalRService', () => ({
  startHubConnection: vi.fn().mockResolvedValue(true),
  stopHubConnection: vi.fn().mockResolvedValue(true),
  onLeaderboardUpdated: vi.fn().mockReturnValue(() => {}),
  onUserScoreUpdated: vi.fn().mockReturnValue(() => {}),
  registerSignalRSubscriber: vi.fn().mockReturnValue(() => {}),
  invokeScoreUpdate: vi.fn().mockResolvedValue(true),
  getConnectionState: vi.fn().mockReturnValue('Connected'),
}));

vi.mock('../../hooks/usePWA', () => ({
  usePWA: vi.fn().mockReturnValue({
    isOffline: false,
    needRefresh: false,
    updateServiceWorker: vi.fn(),
    closePrompt: vi.fn(),
  }),
}));

describe('PHASE 7: Manual Sync Cloud UI Removal & Authentication UX Preservation', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      profile: {
        name: 'Hoàng Learner',
        level: 5,
        xp: 1250,
        streak: 7,
        hearts: 5,
        maxHearts: 5,
        avatarSeed: 'Hoàng Learner',
        targetDailyWords: 30,
        targetDailyNewWords: 15,
        extraNewWordsBonus: 0,
        equippedFrame: null,
        lastActiveDate: '2026-10-08',
        lastStudyDate: '2026-10-08',
      },
      dailyHistory: {
        '2026-10-08': {
          xpGained: 150,
          wordsReviewed: 10,
          newWordsLearned: 5,
          quizzesCompleted: 2,
          pronunciationsMastered: 0,
          date: '2026-10-08',
        },
      },
    });

    useCloudSyncStore.setState({
      user: null,
      session: null,
      status: 'idle',
      isOnline: true,
      lastSyncedAt: null,
      errorMessage: null,
    });
  });

  describe('1. Navbar UI', () => {
    it('renders [Đăng nhập] button when user is a guest, and NEVER renders [Sync Cloud]', () => {
      const onOpenAuthSync = vi.fn();

      render(
        <Navbar
          activeTab="dashboard"
          setActiveTab={vi.fn()}
          onOpenProfile={vi.fn()}
          onOpenBackup={vi.fn()}
          onOpenAchievements={vi.fn()}
          onOpenAddWord={vi.fn()}
          onOpenDailySettings={vi.fn()}
          onOpenAuthSync={onOpenAuthSync}
        />
      );

      // Verify NO "Sync Cloud" or "Cloud Sync" button
      expect(screen.queryByText(/Sync Cloud/i)).toBeNull();
      expect(screen.queryByText(/Cloud Sync/i)).toBeNull();

      // Verify guest [Đăng nhập] button is present
      const loginButton = screen.getByRole('button', { name: /Đăng nhập tài khoản/i });
      expect(loginButton).toBeDefined();
      expect(loginButton.textContent).toContain('Đăng nhập');

      // Clicking login button opens auth modal
      fireEvent.click(loginButton);
      expect(onOpenAuthSync).toHaveBeenCalledTimes(1);
    });

    it('renders [Tài khoản] button with display name when user is authenticated, and NEVER renders [Sync Cloud]', () => {
      useCloudSyncStore.setState({
        user: {
          id: 'auth-user-123',
          email: 'student@example.com',
          displayName: 'Minh Student',
        } as any,
      });

      const onOpenAuthSync = vi.fn();

      render(
        <Navbar
          activeTab="dashboard"
          setActiveTab={vi.fn()}
          onOpenProfile={vi.fn()}
          onOpenBackup={vi.fn()}
          onOpenAchievements={vi.fn()}
          onOpenAddWord={vi.fn()}
          onOpenDailySettings={vi.fn()}
          onOpenAuthSync={onOpenAuthSync}
        />
      );

      // Verify NO "Sync Cloud" or "Cloud Sync" button
      expect(screen.queryByText(/Sync Cloud/i)).toBeNull();
      expect(screen.queryByText(/Cloud Sync/i)).toBeNull();

      // Verify authenticated account button is present
      const accountButton = screen.getByRole('button', { name: /Quản lý tài khoản/i });
      expect(accountButton).toBeDefined();
      expect(accountButton.textContent).toContain('Minh Student');

      // Clicking account button opens auth modal
      fireEvent.click(accountButton);
      expect(onOpenAuthSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Leaderboard Guest UX & CTA', () => {
    it('displays truthful local guest state and [Đăng nhập để tham gia bảng xếp hạng] CTA without "Sync Cloud" wording', async () => {
      const onOpenAuthSync = vi.fn();

      render(<LeaderboardView onOpenAuthSync={onOpenAuthSync} isOnline={true} />);

      // Truthful guest state callouts
      await waitFor(() => {
        expect(screen.getByText('Bạn đang dùng chế độ cục bộ')).toBeDefined();
      });
      expect(screen.getByText(/Điểm trên thiết bị/i)).toBeDefined();

      // Clean CTA without "Sync Cloud"
      const ctaButton = screen.getByRole('button', {
        name: /Đăng nhập để tham gia bảng xếp hạng/i,
      });
      expect(ctaButton).toBeDefined();
      expect(ctaButton.textContent).not.toContain('Sync Cloud');
      expect(ctaButton.textContent).toContain('Đăng nhập để tham gia bảng xếp hạng');

      // Clicking CTA calls onOpenAuthSync
      fireEvent.click(ctaButton);
      expect(onOpenAuthSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. AuthSyncModal UX', () => {
    it('renders rebrand "Tài khoản học viên" and NEVER renders manual sync button "Đồng bộ ngay bây giờ"', () => {
      render(<AuthSyncModal isOpen={true} onClose={vi.fn()} />);

      // Header is rebranded to student account
      expect(screen.getByText('Tài khoản học viên')).toBeDefined();
      expect(screen.queryByText(/Cloud Sync \(Dual-layer\)/i)).toBeNull();

      // Manual sync button is completely removed
      expect(screen.queryByText(/Đồng bộ ngay bây giờ/i)).toBeNull();
      expect(screen.queryByText(/Sync Now/i)).toBeNull();

      // Clear authentication submit/tab button
      const loginButtons = screen.getAllByRole('button', { name: /^Đăng nhập$/i });
      expect(loginButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('4. PWANotificationBanner', () => {
    it('does NOT render cloud syncing/synced banners or manual retry sync buttons', () => {
      useCloudSyncStore.setState({
        status: 'syncing',
        isOnline: true,
      });

      render(<PWANotificationBanner />);

      // No cloud syncing banner
      expect(screen.queryByText(/Đang đồng bộ dữ liệu/i)).toBeNull();
      expect(screen.queryByText(/Cloud Sync/i)).toBeNull();
      expect(screen.queryByText(/Thử lại/i)).toBeNull();
    });
  });
});
