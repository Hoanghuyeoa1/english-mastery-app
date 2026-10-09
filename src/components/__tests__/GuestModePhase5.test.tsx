// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App } from '../../App';
import { useAppStore } from '../../store/useAppStore';
import {
  useCloudSyncStore,
  signOutCloud,
  signInWithEmail,
  setActiveSyncedUserId,
} from '../../services/cloudSyncService';
import { getAccessToken, setAccessToken } from '../../services/api/httpClient';

// Mock canvas-confetti to prevent happy-dom canvas error
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// Mock framer-motion to reduce motion
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

// Mock authApi
vi.mock('../../services/api/authApi', () => ({
  authApi: {
    getMe: vi.fn().mockRejectedValue(new Error('no session in test')),
    refresh: vi.fn().mockRejectedValue(new Error('no refresh in test')),
    login: vi.fn().mockResolvedValue({
      accessToken: 'jwt-valid-token-123',
      user: { id: 'usr-online-1', email: 'online@mastery.com', displayName: 'Online Star' },
    }),
    register: vi.fn(),
    logout: vi.fn().mockResolvedValue({}),
  },
}));

// Mock sub-components
vi.mock('../../components/PWANotificationBanner', () => ({
  PWANotificationBanner: () => <div data-testid="pwa-banner" />,
}));

vi.mock('../../services/adminVocabService', () => ({
  syncCloudVocabulariesToStore: vi.fn(),
}));

const { mockSyncUserScore } = vi.hoisted(() => ({
  mockSyncUserScore: vi.fn(),
}));

vi.mock('../../services/leaderboardService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/leaderboardService')>();
  return {
    ...actual,
    syncUserScoreToLeaderboard: mockSyncUserScore,
    calculateWeeklyXpFromHistory: vi.fn(() => 0),
  };
});

describe('PHASE 5: Guest Mode, Onboarding & Local-First Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAccessToken(null);
    setActiveSyncedUserId(null);

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

  it('1. First-time Guest → Clicks CTA on Welcome, does not create fake JWT, triggers OnboardingModal', () => {
    render(<App />);

    // Starts on Welcome Landing
    expect(screen.getByRole('region', { name: /Welcome and Authentication Landing/i })).toBeDefined();

    // Click Guest CTA button
    const guestBtn = screen.getByRole('button', { name: /Tiếp tục học mà không cần tài khoản/i });
    fireEvent.click(guestBtn);

    // Guest Mode flag is set
    expect(useAppStore.getState().isGuestMode).toBe(true);

    // No fake online credentials created
    expect(getAccessToken()).toBeNull();
    expect(useCloudSyncStore.getState().user).toBeNull();

    // OnboardingModal is now active
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Chào mừng bạn đến với English Master! 🚀')).toBeDefined();

    // Fill in Guest name and complete onboarding
    const nameInput = screen.getByPlaceholderText(/VD: Alex, Minh Anh/i);
    fireEvent.change(nameInput, { target: { value: 'Minh Anh' } });

    const submitBtn = screen.getByRole('button', { name: /Bắt Đầu Hành Trình Học Tập/i });
    fireEvent.click(submitBtn);

    // Profile is now onboarded locally
    const profile = useAppStore.getState().profile;
    expect(profile.isOnboarded).toBe(true);
    expect(profile.name).toBe('Minh Anh');
  });

  it('2. Returning Guest persistence → Reloading keeps Guest mode and enters Dashboard directly', () => {
    useAppStore.setState({
      isHydrated: true,
      isGuestMode: true,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Minh Anh',
        isOnboarded: true,
      },
    });

    render(<App />);

    // Should NOT show Welcome landing or Onboarding modal
    expect(screen.queryByRole('region', { name: /Welcome and Authentication Landing/i })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();

    // Dashboard is displayed with user's name in UI
    expect(screen.getByText('Tổng Quan')).toBeDefined();
    expect(screen.getAllByText((content) => content.includes('Minh Anh')).length).toBeGreaterThanOrEqual(1);
  });

  it('3. Guest does not push scores to online Leaderboard API', () => {
    useAppStore.setState({
      isHydrated: true,
      isGuestMode: true,
      profile: {
        ...useAppStore.getState().profile,
        name: 'GuestHero',
        isOnboarded: true,
        xp: 350,
        streak: 5,
      },
    });

    render(<App />);

    // syncUserScoreToLeaderboard must NOT have been called because user is not authenticated
    expect(mockSyncUserScore).not.toHaveBeenCalled();
  });

  it('4. Offline Guest → Retains full functionality when backend is unreachable or navigator is offline', () => {
    useCloudSyncStore.setState({ isOnline: false });
    useAppStore.setState({
      isHydrated: true,
      isGuestMode: true,
      profile: {
        ...useAppStore.getState().profile,
        name: 'OfflineStudent',
        isOnboarded: true,
        xp: 100,
      },
      srsProgressMap: {
        'offline-word-1': { srsLevel: 2, interval: 3, easeFactor: 2.5, nextReviewDate: '2026-10-10' },
      },
    });

    render(<App />);

    // Enters Dashboard smoothly even offline
    expect(screen.getByText('Tổng Quan')).toBeDefined();
    expect(useAppStore.getState().srsProgressMap['offline-word-1'].srsLevel).toBe(2);
  });

  it('5. Guest → Login transition preserves local SRS vocabulary & study progress', async () => {
    // Guest with 2 SRS words and mistake records
    useAppStore.setState({
      isHydrated: true,
      isGuestMode: true,
      profile: {
        ...useAppStore.getState().profile,
        name: 'LocalGuest',
        isOnboarded: true,
        xp: 250,
      },
      srsProgressMap: {
        'vocab-1': { srsLevel: 4, interval: 10, easeFactor: 2.6, nextReviewDate: '2026-10-15' },
        'vocab-2': { srsLevel: 1, interval: 1, easeFactor: 2.4, nextReviewDate: '2026-10-09' },
      },
      mistakeBank: {
        'mis-1': { id: 'mis-1', word: 'eloquent', meaning: 'hùng biện', mistakeCount: 1, lastMistakeAt: '2026-10-08', consecutiveCorrect: 0, resolved: false },
      },
    });

    // Guest logs in with email
    await act(async () => {
      const res = await signInWithEmail('online@mastery.com', 'SecurePass123');
      expect(res.error).toBeNull();
    });

    // Local-First Safety Invariant: local vocabulary and mistake bank are intact!
    const storeAfterLogin = useAppStore.getState();
    expect(storeAfterLogin.srsProgressMap['vocab-1'].srsLevel).toBe(4);
    expect(storeAfterLogin.srsProgressMap['vocab-2'].srsLevel).toBe(1);
    expect(storeAfterLogin.mistakeBank['mis-1']).toBeDefined();

    // Online identity is set
    expect(useCloudSyncStore.getState().user?.email).toBe('online@mastery.com');
  });

  it('6. Logout does not wipe local learning progress', async () => {
    // Authenticated user with study progress
    useCloudSyncStore.setState({
      user: { id: 'usr-online-1', email: 'online@mastery.com' },
      isAuthInitialized: true,
    });
    setAccessToken('jwt-valid-token-123');

    useAppStore.setState({
      isHydrated: true,
      profile: {
        ...useAppStore.getState().profile,
        name: 'Online Learner',
        isOnboarded: true,
        xp: 500,
      },
      srsProgressMap: {
        'vocab-safe': { srsLevel: 5, interval: 15, easeFactor: 2.7, nextReviewDate: '2026-10-23' },
      },
    });

    // Perform sign out
    await act(async () => {
      await signOutCloud();
    });

    // Credentials cleared
    expect(getAccessToken()).toBeNull();
    expect(useCloudSyncStore.getState().user).toBeNull();

    // Local data is NOT wiped
    const store = useAppStore.getState();
    expect(store.srsProgressMap['vocab-safe']).toBeDefined();
    expect(store.srsProgressMap['vocab-safe'].srsLevel).toBe(5);
  });
});
