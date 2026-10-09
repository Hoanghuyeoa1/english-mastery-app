// @vitest-environment happy-dom
import React, { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { App } from '../../App';
import { useAppStore } from '../../store/useAppStore';
import { useCloudSyncStore, signOutCloud, initCloudSync } from '../../services/cloudSyncService';
import { authApi } from '../../services/api/authApi';
import { ApiError, setAccessToken } from '../../services/api/httpClient';

// Mock framer-motion to reduce motion and prevent unmount animation aborts
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    useReducedMotion: () => true,
  };
});

// Mock virtual:pwa-register/react for Navbar PWA button
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));

// Mock authApi to prevent real network calls
vi.mock('../../services/api/authApi', () => ({
  authApi: {
    getMe: vi.fn().mockRejectedValue(new Error('no session in test')),
    refresh: vi.fn().mockRejectedValue(new Error('no refresh in test')),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn().mockResolvedValue({}),
  },
}));

// Mock sub-components and network-heavy services
vi.mock('../../components/PWANotificationBanner', () => ({
  PWANotificationBanner: () => <div data-testid="pwa-banner" />,
}));

vi.mock('../../services/adminVocabService', () => ({
  syncCloudVocabulariesToStore: vi.fn(),
}));

vi.mock('../../services/leaderboardService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/leaderboardService')>();
  return {
    ...actual,
    syncUserScoreToLeaderboard: vi.fn(),
    calculateWeeklyXpFromHistory: vi.fn(() => 0),
  };
});

describe('PHASE 2: Canonical Access State & Welcome Gate Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAccessToken(null);

    // Clean cloud sync state
    useCloudSyncStore.setState({
      user: null,
      userEmail: null,
      session: null,
      isOnline: true,
      status: 'idle',
      isAuthInitialized: true,
      isAuthUnavailable: false,
    });

    // Clean app store state
    useAppStore.setState({
      isHydrated: true,
      isGuestMode: false,
      isLoggedOut: false,
      profile: {
        name: '',
        level: 1,
        xp: 0,
        streak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        lastStudyDate: null,
        hearts: 5,
        maxHearts: 5,
        avatarSeed: 'Learner',
        targetDailyWords: 15,
        targetDailyNewWords: 15,
        extraNewWordsBonus: 0,
        isOnboarded: false,
        targetGoal: 'daily',
        geminiApiKey: '',
        equippedFrame: null,
        unlockedFrames: [],
      },
      srsProgressMap: {},
      mistakeBank: {},
      dailyHistory: {},
      vocabularyList: [],
    });
  });

  // 1. Fresh visitor → Welcome
  it('1. Fresh visitor (no session, no local profile, no guest) → Renders Welcome', () => {
    render(<App />);

    expect(screen.getByRole('region', { name: /Welcome and Authentication Landing/i })).toBeDefined();
    expect(screen.queryByText('Tổng Quan')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // 2. Legacy XP → Welcome
  it('2. Legacy XP in storage (no valid session, guest not chosen) → Renders Welcome, NEVER enters Dashboard', () => {
    useAppStore.setState({
      isHydrated: true,
      isGuestMode: false,
      isLoggedOut: false,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Học Viên Cũ',
        isOnboarded: true,
        xp: 2500,
        streak: 7,
      },
    });

    render(<App />);

    // Invariant: Learning Data != Guest Session
    expect(screen.getByRole('region', { name: /Welcome and Authentication Landing/i })).toBeDefined();
    expect(screen.queryByText('Tổng Quan')).toBeNull();
  });

  // 3. Existing onboarding profile → Welcome nếu chưa Login/chọn Guest
  it('3. Existing onboarding profile in local storage → Renders Welcome if not logged in and guest not chosen', () => {
    useAppStore.setState({
      isHydrated: true,
      isGuestMode: false,
      isLoggedOut: false,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Nguyễn Văn A',
        isOnboarded: true,
      },
    });

    render(<App />);

    expect(screen.getByRole('region', { name: /Welcome and Authentication Landing/i })).toBeDefined();
    expect(screen.queryByText('Tổng Quan')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // 4. Initializing → loading gate
  it('4. Initializing state (storage hydrating or auth verifying) → Renders neutral loading gate', () => {
    useAppStore.setState({ isHydrated: false });
    useCloudSyncStore.setState({ isAuthInitialized: false });

    render(<App />);

    expect(screen.getByRole('status', { name: /Đang khởi tạo ứng dụng/i })).toBeDefined();
    expect(screen.getByText('Đang chuẩn bị không gian học tập...')).toBeDefined();
    expect(screen.queryByRole('region', { name: /Welcome and Authentication Landing/i })).toBeNull();
    expect(screen.queryByText('Tổng Quan')).toBeNull();
  });

  // 5. Auth unavailable → không bypass
  it('5. Auth unavailable (token present but backend unreachable) → Renders safe gate with Retry/Guest choice, no bypass', () => {
    setAccessToken('stale_token_xyz');
    useCloudSyncStore.setState({
      user: null,
      isAuthInitialized: true,
      isAuthUnavailable: true, // Backend offline or network error
    });
    useAppStore.setState({
      isHydrated: true,
      isGuestMode: false,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Offline Learner',
        isOnboarded: true,
        xp: 800,
      },
    });

    render(<App />);

    // Invariant: Does not auto-grant authenticated and does not auto-grant guest
    expect(screen.getByRole('alert', { name: /Xác thực tạm thời không khả dụng/i })).toBeDefined();
    expect(screen.getByText('Không thể kết nối máy chủ xác thực')).toBeDefined();
    expect(screen.getByRole('button', { name: /Thử kết nối lại/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Tiếp tục học với vai trò Khách/i })).toBeDefined();
    expect(screen.queryByText('Tổng Quan')).toBeNull();
  });

  // 6. Explicit Guest → app
  it('6. Explicit Guest chosen → Renders Dashboard directly for onboarded guest', () => {
    useAppStore.setState({
      isHydrated: true,
      isGuestMode: true, // User clicked "Tiếp tục học mà không cần tài khoản"
      isLoggedOut: false,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Minh Tuấn',
        isOnboarded: true,
        xp: 350,
      },
    });

    render(<App />);

    expect(screen.queryByRole('region', { name: /Welcome and Authentication Landing/i })).toBeNull();
    expect(screen.getByText('Tổng Quan')).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // 7. Verified Auth → app
  it('7. Verified Auth session → Enters app with authenticated user in Navbar', () => {
    useCloudSyncStore.setState({
      user: { id: 'usr-gold-1', email: 'gold@mastery.edu', displayName: 'Gold Member' },
      isAuthInitialized: true,
    });
    useAppStore.setState({
      isHydrated: true,
      isGuestMode: false,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Gold Member',
        isOnboarded: true,
      },
    });

    render(<App />);

    expect(screen.queryByRole('region', { name: /Welcome and Authentication Landing/i })).toBeNull();
    expect(screen.getByText('Tổng Quan')).toBeDefined();
    expect(screen.getByTitle(/Tài khoản: Gold Member/i)).toBeDefined();
  });

  // 8. Logout → Welcome
  it('8. Logout → Clears session, resets guestMode, and returns to Welcome', async () => {
    useCloudSyncStore.setState({
      user: { id: 'usr-logout-test', email: 'logout@test.com' },
      isAuthInitialized: true,
    });
    useAppStore.setState({
      isHydrated: true,
      isGuestMode: false,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Logging Out User',
        isOnboarded: true,
      },
    });

    const { unmount } = render(<App />);
    expect(screen.getByText('Tổng Quan')).toBeDefined();

    await act(async () => {
      await signOutCloud();
    });

    unmount();
    render(<App />);

    // Invariant: Logout returns to Welcome, NEVER auto-enters Guest
    expect(screen.getByRole('region', { name: /Welcome and Authentication Landing/i })).toBeDefined();
    expect(useAppStore.getState().isGuestMode).toBe(false);
    expect(useCloudSyncStore.getState().user).toBeNull();
  });

  // 9. No redirect loop
  it('9. No redirect loop → Transitions from Welcome to Guest and Auth without loop', () => {
    const { rerender } = render(<App />);

    // Start on Welcome
    expect(screen.getByRole('region', { name: /Welcome and Authentication Landing/i })).toBeDefined();

    // Click Guest CTA
    const guestBtn = screen.getByRole('button', { name: /Tiếp tục học mà không cần tài khoản/i });
    fireEvent.click(guestBtn);

    // Moves deterministically to App shell
    expect(useAppStore.getState().isGuestMode).toBe(true);

    rerender(<App />);

    // Modal or Dashboard is rendered without flickering back to Welcome
    expect(screen.queryByRole('region', { name: /Welcome and Authentication Landing/i })).toBeNull();
  });

  // 10. No premature Dashboard render
  it('10. No premature Dashboard render → While auth is resolving, Dashboard is never mounted', () => {
    useAppStore.setState({ isHydrated: false });
    useCloudSyncStore.setState({ isAuthInitialized: false });

    render(<App />);

    expect(screen.queryByText('Tổng Quan')).toBeNull();
    expect(screen.queryByTestId('dashboard-root')).toBeNull();
  });

  // 11. Legacy persistence không bị sửa/xóa
  it('11. Legacy persistence data boundary → Local learning progress is preserved intact', () => {
    const initialSrs = {
      'word-resilience': { srsLevel: 4, interval: 10, easeFactor: 2.6, nextReviewDate: '2026-10-20' },
    };
    const initialMistakes = {
      'mis-101': { id: 'mis-101', word: 'ubiquitous', meaning: 'phổ biến', mistakeCount: 2, lastMistakeAt: '2026-10-08', consecutiveCorrect: 1, resolved: false },
    };

    useAppStore.setState({
      isHydrated: true,
      isGuestMode: false,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Preserved Learner',
        isOnboarded: true,
        xp: 4500,
        streak: 12,
      },
      srsProgressMap: initialSrs,
      mistakeBank: initialMistakes,
    });

    render(<App />);

    // User is on Welcome screen
    expect(screen.getByRole('region', { name: /Welcome and Authentication Landing/i })).toBeDefined();

    // Verify storage was NEVER wiped or mutated
    const storeAfter = useAppStore.getState();
    expect(storeAfter.profile.name).toBe('Preserved Learner');
    expect(storeAfter.profile.xp).toBe(4500);
    expect(storeAfter.profile.streak).toBe(12);
    expect(storeAfter.srsProgressMap['word-resilience'].srsLevel).toBe(4);
    expect(storeAfter.mistakeBank['mis-101'].mistakeCount).toBe(2);
  });
});
