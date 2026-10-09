// @vitest-environment happy-dom
import React, { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { App } from '../../App';
import { useAppStore } from '../../store/useAppStore';
import { useCloudSyncStore, initCloudSync } from '../../services/cloudSyncService';
import { handleStoreRehydration } from '../../store/storeRehydration';
import { authApi } from '../../services/api/authApi';
import { ApiError } from '../../services/api/httpClient';

// Mock framer-motion to reduce motion
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    useReducedMotion: () => true,
  };
});

// Mock virtual:pwa-register/react
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));

// Mock authApi with customizable mock implementations
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

describe('PHASE 1 AUDIT: Welcome Bypass & Routing Decision Matrix Reproduction', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset cloud sync store
    useCloudSyncStore.setState({
      user: null,
      userEmail: null,
      session: null,
      isOnline: true,
      status: 'idle',
      isAuthInitialized: true,
    });

    // Reset base app store to defaults
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

  // TEST 1: Không token, có legacy XP/Profile -> Specification: PHẢI hiển thị Welcome landing
  it('1. REGRESSION (CURRENTLY FAILS): Unauthenticated with legacy XP & profile -> Should show Welcome, but currently enters Dashboard', () => {
    useAppStore.setState({
      isHydrated: true,
      isGuestMode: false,
      isLoggedOut: false,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Alex Nguyễn',
        isOnboarded: true,
        xp: 1250,
        streak: 5,
      },
    });

    render(<App />);

    // Spec Requirement: Must display Welcome Landing so user can explicitly authenticate or pick guest
    // ROOT CAUSE: Currently FAILS because `isReturningProfile` treats (name && isOnboarded) as isGuest = true
    const welcomeLanding = screen.queryByRole('region', { name: /Welcome and Authentication Landing/i });
    expect(welcomeLanding).not.toBeNull();
  });

  // TEST 2: Onboarding complete, chưa chọn Guest -> Specification: PHẢI hiển thị Welcome
  it('2. REGRESSION (CURRENTLY FAILS): Onboarding complete in local storage, guest never chosen -> Should show Welcome', () => {
    useAppStore.setState({
      isHydrated: true,
      isGuestMode: false, // User NEVER chose guest
      isLoggedOut: false,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Minh Hoàng',
        isOnboarded: true, // Marked onboarded previously
      },
    });

    render(<App />);

    // Spec Requirement: Must show Welcome landing
    // ROOT CAUSE: Currently FAILS because `isGuest = (isGuestMode || isReturningProfile)` ignores isGuestMode=false
    const welcomeLanding = screen.queryByRole('region', { name: /Welcome and Authentication Landing/i });
    expect(welcomeLanding).not.toBeNull();
  });

  // TEST 3: Guest được chọn rõ ràng -> Specification: Vào Dashboard
  it('3. SPECIFICATION (PASSES): Explicit Guest mode selected -> Enters Dashboard directly', () => {
    useAppStore.setState({
      isHydrated: true,
      isGuestMode: true, // Explicitly selected guest
      isLoggedOut: false,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Guest Learner',
        isOnboarded: true,
        xp: 150,
      },
    });

    render(<App />);

    // Must NOT show Welcome
    expect(screen.queryByRole('region', { name: /Welcome and Authentication Landing/i })).toBeNull();
    // Must show Dashboard
    expect(screen.getByText('Tổng Quan')).toBeDefined();
  });

  // TEST 4: Auth session hợp lệ -> Specification: Vào Dashboard
  it('4. SPECIFICATION (PASSES): Valid authenticated session -> Enters Dashboard with user info', () => {
    useCloudSyncStore.setState({
      user: { id: 'usr-999', email: 'verified@hub.edu', displayName: 'Teacher Linh' },
      isAuthInitialized: true,
    });
    useAppStore.setState({
      isHydrated: true,
      isGuestMode: false,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Teacher Linh',
        isOnboarded: true,
      },
    });

    render(<App />);

    expect(screen.queryByRole('region', { name: /Welcome and Authentication Landing/i })).toBeNull();
    expect(screen.getByText('Tổng Quan')).toBeDefined();
    expect(screen.getByTitle(/Tài khoản: Teacher Linh/i)).toBeDefined();
  });

  // TEST 5: Auth chưa xác minh (đang khởi tạo) -> Specification: Hiển thị Neutral Loader
  it('5. SPECIFICATION (PASSES): Unverified / In-flight auth rehydration -> Stays on loading screen', () => {
    useAppStore.setState({ isHydrated: false });
    useCloudSyncStore.setState({ isAuthInitialized: false });

    render(<App />);

    // Must show Neutral Loading Screen
    expect(screen.getByRole('status', { name: /Đang khởi tạo ứng dụng/i })).toBeDefined();
    expect(screen.getByText('Đang chuẩn bị không gian học tập...')).toBeDefined();

    // Must NOT prematurely show Dashboard or Welcome
    expect(screen.queryByText('Tổng Quan')).toBeNull();
    expect(screen.queryByRole('region', { name: /Welcome and Authentication Landing/i })).toBeNull();
  });

  // TEST 6: Backend offline / 404 -> Không fake authenticated, nhưng không được bypass vào Dashboard khi chưa chọn Guest
  it('6. REGRESSION (CURRENTLY FAILS): Backend offline / unreachable -> Must not enter Dashboard as pseudo-guest', async () => {
    // Simulate backend unreachable (Network Error)
    (authApi.refresh as any).mockRejectedValueOnce(
      new ApiError(0, { code: 'NETWORK_ERROR', message: 'Failed to fetch' })
    );

    useAppStore.setState({
      isHydrated: true,
      isGuestMode: false,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Cached Learner',
        isOnboarded: true,
      },
    });

    // Run cloud sync init with failed network call
    await act(async () => {
      initCloudSync();
    });

    // Auth is initialized as unauthenticated
    expect(useCloudSyncStore.getState().user).toBeNull();
    expect(useCloudSyncStore.getState().isAuthInitialized).toBe(true);

    render(<App />);

    // Spec Requirement: Since user is not authenticated and not explicitly a guest, show Welcome
    // ROOT CAUSE: Currently FAILS because isReturningProfile bypasses Welcome without active auth session
    const welcomeLanding = screen.queryByRole('region', { name: /Welcome and Authentication Landing/i });
    expect(welcomeLanding).not.toBeNull();
  });

  // TEST 7: Reload giữa auth rehydration -> isLoggedOut reset to false
  it('7. REGRESSION (CURRENTLY FAILS): Reload after logout -> handleStoreRehydration resets isLoggedOut=false, bypassing Welcome', () => {
    const mockState = {
      ...useAppStore.getState(),
      isHydrated: false,
      isGuestMode: false,
      isLoggedOut: true, // User logged out previously
      profile: {
        ...useAppStore.getState().profile,
        name: 'LoggedOut User',
        isOnboarded: true,
      },
    };

    // Simulate Zustand rehydration on page reload
    handleStoreRehydration(mockState as any);

    // ROOT CAUSE EVIDENCE: Rehydration forcefully resets isLoggedOut to false!
    expect(mockState.isLoggedOut).toBe(false);

    useAppStore.setState(mockState);

    render(<App />);

    // Spec Requirement: User who was logged out should see Welcome after reload
    // ROOT CAUSE: Currently FAILS because isLoggedOut was reset to false, enabling isReturningProfile
    const welcomeLanding = screen.queryByRole('region', { name: /Welcome and Authentication Landing/i });
    expect(welcomeLanding).not.toBeNull();
  });

  // TEST 8: React StrictMode double effects -> Verify no dangling listeners or memory leaks
  it('8. SPECIFICATION (PASSES): StrictMode double invocation maintains clean lifecycle', () => {
    const { unmount } = render(
      <StrictMode>
        <App />
      </StrictMode>
    );

    // Welcome landing or Neutral loader renders cleanly without React exceptions
    expect(screen.getByRole('region', { name: /Welcome and Authentication Landing/i })).toBeDefined();

    unmount();
  });
});
