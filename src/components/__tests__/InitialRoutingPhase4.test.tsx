// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App } from '../../App';
import { useAppStore } from '../../store/useAppStore';
import { useCloudSyncStore, signOutCloud } from '../../services/cloudSyncService';

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

// Mock authApi to prevent real network calls to port 5000 during test
vi.mock('../../services/api/authApi', () => ({
  authApi: {
    getMe: vi.fn().mockRejectedValue(new Error('no session in test')),
    refresh: vi.fn().mockRejectedValue(new Error('no refresh in test')),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn().mockResolvedValue({}),
  },
}));

// Mock sub-components that are heavy or make network calls
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

describe('PHASE 4: Initial Routing & Auth Session Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default clean state
    useCloudSyncStore.setState({
      user: null,
      userEmail: null,
      session: null,
      isOnline: true,
      status: 'idle',
      isAuthInitialized: true,
    });

    useAppStore.setState({
      isHydrated: true,
      isGuestMode: false,
      isLoggedOut: false,
      profile: {
        name: '',
        level: 1,
        xp: 0,
        streak: 0,
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

  it('1. First visit (unauthenticated, non-guest, not onboarded) → Renders Welcome Landing, never pops OnboardingModal', () => {
    render(<App />);

    // Welcome Landing should be rendered
    expect(screen.getByRole('region', { name: /Welcome and Authentication Landing/i })).toBeDefined();
    expect(screen.getByText('English Mastery Hub')).toBeDefined();
    expect(screen.getByText('Khởi đầu hành trình học tập')).toBeDefined();

    // OnboardingModal should NOT be open
    expect(screen.queryByRole('dialog', { name: /onboarding/i })).toBeNull();
    expect(screen.queryByText('Chào mừng bạn đến với English Master! 🚀')).toBeNull();
  });

  it('2. Initializing/hydrating state (isHydrated=false or isAuthInitialized=false) → Renders neutral loader, no Welcome flicker', () => {
    useAppStore.setState({ isHydrated: false });
    useCloudSyncStore.setState({ isAuthInitialized: false });

    render(<App />);

    // Renders neutral loading screen with aria-label
    expect(screen.getByRole('status', { name: /Đang khởi tạo ứng dụng/i })).toBeDefined();
    expect(screen.getByText('Đang chuẩn bị không gian học tập...')).toBeDefined();

    // Does NOT render Welcome or Dashboard
    expect(screen.queryByRole('region', { name: /Welcome and Authentication Landing/i })).toBeNull();
    expect(screen.queryByText('Tổng Quan')).toBeNull();
  });

  it('3. Valid authenticated session with complete local profile → Bypasses Welcome and enters Dashboard', () => {
    useCloudSyncStore.setState({
      user: { id: 'usr-123', email: 'test@example.com', displayName: 'Alex' },
      isAuthInitialized: true,
    });
    useAppStore.setState({
      isHydrated: true,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Alex',
        isOnboarded: true,
      },
    });

    render(<App />);

    // Should NOT show Welcome landing
    expect(screen.queryByRole('region', { name: /Welcome and Authentication Landing/i })).toBeNull();

    // Should render Navbar and Dashboard
    expect(screen.getByText('Tổng Quan')).toBeDefined();
    expect(screen.getByTitle(/Tài khoản: Alex/i)).toBeDefined();
  });

  it('4. Valid authenticated session with incomplete local onboarding → Enters App with OnboardingModal open', () => {
    useCloudSyncStore.setState({
      user: { id: 'usr-123', email: 'newbie@example.com', displayName: 'Newbie' },
      isAuthInitialized: true,
    });
    useAppStore.setState({
      isHydrated: true,
      profile: {
        ...useAppStore.getState().profile,
        name: '',
        isOnboarded: false,
      },
    });

    render(<App />);

    // Should NOT show Welcome landing
    expect(screen.queryByRole('region', { name: /Welcome and Authentication Landing/i })).toBeNull();

    // OnboardingModal should be open
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Chào mừng bạn đến với English Master! 🚀')).toBeDefined();
  });

  it('5. Returning Guest with existing profile → Bypasses Welcome directly to Dashboard', () => {
    useAppStore.setState({
      isHydrated: true,
      isGuestMode: true,
      profile: {
        ...useAppStore.getState().profile,
        name: 'GuestLearner',
        isOnboarded: true,
      },
    });

    render(<App />);

    // Should NOT show Welcome landing
    expect(screen.queryByRole('region', { name: /Welcome and Authentication Landing/i })).toBeNull();

    // Dashboard is rendered
    expect(screen.getByText('Tổng Quan')).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('6. Guest CTA on Welcome Page → Sets isGuestMode and navigates to Onboarding for new guest', () => {
    render(<App />);

    const guestBtn = screen.getByRole('button', { name: /Tiếp tục học mà không cần tài khoản/i });
    fireEvent.click(guestBtn);

    // State is updated to guest mode
    expect(useAppStore.getState().isGuestMode).toBe(true);

    // Now OnboardingModal opens for the new guest to set their name
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Chào mừng bạn đến với English Master! 🚀')).toBeDefined();
  });

  it('7. Sign Out → Clears auth session, transitions to Welcome, preserves local learning progress', async () => {
    // Setup initial authenticated state with local vocabulary & mistake progress
    useCloudSyncStore.setState({
      user: { id: 'usr-999', email: 'learner@test.com' },
      isAuthInitialized: true,
    });
    useAppStore.setState({
      isHydrated: true,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Learner One',
        isOnboarded: true,
      },
      srsProgressMap: {
        'word-1': { srsLevel: 3, interval: 6, easeFactor: 2.5, nextReviewDate: '2026-10-10' },
      },
      mistakeBank: {
        'mis-1': { id: 'mis-1', word: 'resilience', meaning: 'kiên cường', mistakeCount: 1, lastMistakeAt: '2026-10-08', consecutiveCorrect: 0, resolved: false },
      },
    });

    const { unmount } = render(<App />);

    // User is in Dashboard
    expect(screen.getByText('Tổng Quan')).toBeDefined();

    // Perform sign out
    await act(async () => {
      await signOutCloud();
    });

    unmount();
    render(<App />);

    // Successfully transitioned back to Welcome landing
    expect(screen.getByRole('region', { name: /Welcome and Authentication Landing/i })).toBeDefined();

    // CRITICAL: Local learning progress was NOT wiped!
    const currentStore = useAppStore.getState();
    expect(currentStore.srsProgressMap['word-1']).toBeDefined();
    expect(currentStore.srsProgressMap['word-1'].srsLevel).toBe(3);
    expect(currentStore.mistakeBank['mis-1']).toBeDefined();
  });

  it('8. Switching from Welcome through successful AuthForm → Enters App correctly', () => {
    render(<App />);

    // Initially on Welcome page
    expect(screen.getByRole('region', { name: /Welcome and Authentication Landing/i })).toBeDefined();

    // Simulate login success via CloudSyncStore
    act(() => {
      useCloudSyncStore.setState({
        user: { id: 'auth-user-7', email: 'success@hub.com', displayName: 'Auth Hero' },
      });
      useAppStore.setState({
        profile: {
          ...useAppStore.getState().profile,
          name: 'Auth Hero',
          isOnboarded: true,
        },
      });
    });

    // Automatically transitions out of Welcome to Dashboard
    expect(screen.queryByRole('region', { name: /Welcome and Authentication Landing/i })).toBeNull();
    expect(screen.getByText('Tổng Quan')).toBeDefined();
  });
});
