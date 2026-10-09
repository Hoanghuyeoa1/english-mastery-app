// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { App } from '../../App';
import { useAppStore } from '../../store/useAppStore';
import { useCloudSyncStore, signOutCloud } from '../../services/cloudSyncService';
import { setAccessToken } from '../../services/api/httpClient';
import { handleStoreRehydration } from '../../store/storeRehydration';
import { DEFAULT_PROFILE } from '../../store/initialDefaults';
import {
  GUEST_SESSION_STORAGE_KEY,
  isGuestSessionActive,
  setGuestSessionActive,
  clearGuestSession,
} from '../../store/guestSessionStorage';
import * as leaderboardService from '../../services/leaderboardService';

// Mock framer-motion to reduce motion and prevent unmount animation issues
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

describe('PHASE 3: Explicit Guest Session Lifecycle Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAccessToken(null);
    clearGuestSession();

    // Clean cloud sync store
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
        ...DEFAULT_PROFILE,
        name: '',
        isOnboarded: false,
      },
      userCustomWords: [],
      srsProgressMap: {},
      dailyHistory: {},
      mistakeBank: {},
    });
  });

  it('1. Guest button requires real click → App stays on Welcome until explicit user click', async () => {
    const { unmount } = render(<App />);

    // Must be on Welcome view
    expect(screen.getByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /tổng quan/i })).toBeNull();
    expect(useAppStore.getState().isGuestMode).toBe(false);
    expect(isGuestSessionActive()).toBe(false);

    // Find and click the explicit Guest CTA button
    const guestBtn = screen.getByRole('button', { name: /tiếp tục học mà không cần tài khoản/i });
    expect(guestBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(guestBtn);
    });

    // Guest mode is now activated and recorded in sessionStorage
    expect(useAppStore.getState().isGuestMode).toBe(true);
    expect(isGuestSessionActive()).toBe(true);
    expect(sessionStorage.getItem(GUEST_SESSION_STORAGE_KEY)).toBe('true');

    unmount();
  });

  it('2. Fresh Guest → Opens existing Onboarding modal for new unconfigured guest', async () => {
    // Empty profile (not onboarded, no name)
    useAppStore.setState({
      isGuestMode: true,
      profile: {
        ...useAppStore.getState().profile,
        name: '',
        isOnboarded: false,
      },
    });
    setGuestSessionActive(true);

    const { unmount } = render(<App />);

    // Onboarding modal must be visible
    expect(screen.getByRole('heading', { name: /chào mừng bạn đến với english master/i })).toBeDefined();
    expect(screen.getByPlaceholderText(/vd: alex, minh anh/i)).toBeDefined();

    unmount();
  });

  it('3. Existing eligible Guest → Directly renders Dashboard without onboarding modal', async () => {
    // Existing onboarded profile
    useAppStore.setState({
      isGuestMode: true,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Hoàng Learner',
        isOnboarded: true,
        xp: 450,
      },
    });
    setGuestSessionActive(true);

    const { unmount } = render(<App />);

    // Onboarding modal must NOT be open
    expect(screen.queryByText(/thiết lập hồ sơ học tập/i)).toBeNull();

    // Dashboard navigation and profile name must be rendered
    expect(screen.getByRole('button', { name: /tổng quan/i })).toBeDefined();
    expect(screen.getAllByText('Hoàng Learner').length).toBeGreaterThan(0);

    unmount();
  });

  it('4. Guest refresh in same tab session → Retains Guest mode from sessionStorage', async () => {
    // In active session, sessionStorage has guest flag set
    setGuestSessionActive(true);
    useAppStore.setState({
      isGuestMode: false, // simulate state before rehydration
      profile: {
        ...useAppStore.getState().profile,
        name: 'Guest User',
        isOnboarded: true,
      },
    });

    // Simulate Zustand rehydration on reload
    const currentState = useAppStore.getState();
    handleStoreRehydration(currentState, (patch) => {
      useAppStore.setState(patch);
    });

    expect(useAppStore.getState().isGuestMode).toBe(true);

    const { unmount } = render(<App />);
    expect(screen.getByRole('button', { name: /tổng quan/i })).toBeDefined();
    expect(screen.queryByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeNull();

    unmount();
  });

  it('5. Explicit return to Welcome → Clears Guest session, preserves local learning progress', async () => {
    useAppStore.setState({
      isGuestMode: true,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Lan Chi',
        isOnboarded: true,
        xp: 890,
        streak: 7,
      },
      srsProgressMap: {
        'word-1': { srsLevel: 3, nextReviewDate: '2026-10-15', interval: 4, easeFactor: 2.5 },
      },
    });
    setGuestSessionActive(true);

    const { unmount } = render(<App />);

    // Open profile modal by clicking the user header area
    const profileHeader = screen.getByTitle(/chế độ khách: lan chi/i);
    await act(async () => {
      fireEvent.click(profileHeader);
    });

    // Find "Rời chế độ Khách (Về trang Chào mừng)" button
    const exitGuestBtn = screen.getByRole('button', { name: /rời chế độ khách \(về trang chào mừng\)/i });
    expect(exitGuestBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(exitGuestBtn);
    });

    // Guest mode cleared from store and sessionStorage
    expect(useAppStore.getState().isGuestMode).toBe(false);
    expect(isGuestSessionActive()).toBe(false);
    expect(sessionStorage.getItem(GUEST_SESSION_STORAGE_KEY)).toBeNull();

    // App immediately renders Welcome
    expect(screen.getByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeDefined();

    // Local learning data is 100% preserved
    expect(useAppStore.getState().profile.xp).toBe(890);
    expect(useAppStore.getState().profile.streak).toBe(7);
    expect(useAppStore.getState().srsProgressMap['word-1'].srsLevel).toBe(3);

    unmount();
  });

  it('6. New browser session (no sessionStorage) → Lands on Welcome even with existing local profile', async () => {
    // User has local profile and XP saved in localStorage
    useAppStore.setState({
      isGuestMode: false,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Minh Tuấn',
        isOnboarded: true,
        xp: 1200,
        streak: 12,
      },
    });
    // sessionStorage is completely empty
    sessionStorage.clear();

    // Rehydrate
    handleStoreRehydration(useAppStore.getState(), (patch) => {
      useAppStore.setState(patch);
    });

    expect(useAppStore.getState().isGuestMode).toBe(false);

    const { unmount } = render(<App />);

    // Must show Welcome view, not Dashboard
    expect(screen.getByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /tổng quan/i })).toBeNull();

    unmount();
  });

  it('7. Multi-tab semantics: independent tab vs tab duplication', async () => {
    // 7A: Independent new tab has empty sessionStorage
    sessionStorage.clear();
    expect(isGuestSessionActive()).toBe(false);

    // 7B: Tab duplication copies sessionStorage according to browser spec
    sessionStorage.setItem(GUEST_SESSION_STORAGE_KEY, 'true');
    expect(isGuestSessionActive()).toBe(true);

    // 7C: Closing/clearing session wipes guest activation
    clearGuestSession();
    expect(isGuestSessionActive()).toBe(false);
  });

  it('8. Guest offline → Functions Local-First without network dependencies', async () => {
    useCloudSyncStore.setState({ isOnline: false });
    useAppStore.setState({
      isGuestMode: true,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Offline Learner',
        isOnboarded: true,
        xp: 300,
      },
    });
    setGuestSessionActive(true);

    const { unmount } = render(<App />);

    // App loads fine without crash
    expect(screen.getByRole('button', { name: /tổng quan/i })).toBeDefined();
    expect(screen.getAllByText('Offline Learner').length).toBeGreaterThan(0);

    unmount();
  });

  it('9. Guest Navbar identity UX → Displays distinct Guest badge and Login CTA', async () => {
    useAppStore.setState({
      isGuestMode: true,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Thu Hà',
        isOnboarded: true,
      },
    });
    setGuestSessionActive(true);

    const { unmount } = render(<App />);

    // Distinct "Khách" badge must be rendered
    const guestBadge = screen.getByTestId('guest-badge');
    expect(guestBadge).toBeDefined();
    expect(guestBadge.textContent).toBe('Khách');

    // Login CTA button must be present in Navbar
    const loginBtn = screen.getByRole('button', { name: /đăng nhập tài khoản/i });
    expect(loginBtn).toBeDefined();
    expect(loginBtn.textContent).toMatch(/đăng nhập/i);

    unmount();
  });

  it('10. Guest does NOT push online leaderboard evidence or create cloud account', async () => {
    const syncSpy = vi.spyOn(leaderboardService, 'syncUserScoreToLeaderboard');

    useAppStore.setState({
      isGuestMode: true,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Guest Ninja',
        isOnboarded: true,
        xp: 999,
        streak: 15,
      },
    });
    setGuestSessionActive(true);

    const { unmount } = render(<App />);

    // syncUserScoreToLeaderboard must NOT have been called because user is null
    expect(syncSpy).not.toHaveBeenCalled();

    unmount();
  });

  it('11. Local learning progress preserved across repeated Guest session toggles', async () => {
    // Initial local data
    useAppStore.setState({
      isGuestMode: false,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Persistent User',
        isOnboarded: true,
        xp: 1500,
      },
      mistakeBank: {
        'mistake-1': {
          id: 'mistake-1',
          word: 'ubiquitous',
          meaning: 'phổ biến',
          mistakeCount: 2,
          consecutiveCorrect: 0,
          lastMistakeAt: '2026-10-09',
          resolved: false,
        },
      },
    });

    // 1. Activate Guest
    act(() => {
      useAppStore.getState().setGuestMode?.(true);
    });
    expect(isGuestSessionActive()).toBe(true);

    // 2. Perform learning activity in Guest mode
    act(() => {
      useAppStore.setState((s) => ({
        profile: { ...s.profile, xp: s.profile.xp + 50 },
      }));
    });
    expect(useAppStore.getState().profile.xp).toBe(1550);

    // 3. Exit Guest to Welcome
    act(() => {
      useAppStore.getState().setGuestMode?.(false);
    });
    expect(isGuestSessionActive()).toBe(false);
    expect(useAppStore.getState().profile.xp).toBe(1550);
    expect(useAppStore.getState().mistakeBank['mistake-1'].word).toBe('ubiquitous');

    // 4. Re-enter Guest
    act(() => {
      useAppStore.getState().setGuestMode?.(true);
    });
    expect(useAppStore.getState().profile.xp).toBe(1550);
    expect(useAppStore.getState().mistakeBank['mistake-1'].mistakeCount).toBe(2);
  });

  it('12. No auto-activation of Guest after logout → Authenticated logout goes strictly to Welcome', async () => {
    // Start as authenticated user
    useCloudSyncStore.setState({
      user: {
        id: 'usr-123',
        email: 'user@example.com',
        role: 'user',
        createdAt: '2026-01-01',
      },
      isAuthInitialized: true,
    });
    useAppStore.setState({
      isGuestMode: false,
      isLoggedOut: false,
    });

    // Trigger signOutCloud
    await act(async () => {
      await signOutCloud();
    });

    expect(useCloudSyncStore.getState().user).toBeNull();
    expect(useAppStore.getState().isLoggedOut).toBe(true);
    expect(useAppStore.getState().isGuestMode).toBe(false);
    expect(isGuestSessionActive()).toBe(false);

    const { unmount } = render(<App />);

    // Must show Welcome view, never auto-Guest
    expect(screen.getByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /tổng quan/i })).toBeNull();

    unmount();
  });
});
