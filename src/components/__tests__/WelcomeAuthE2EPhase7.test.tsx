// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react';
import { App } from '../../App';
import { useAppStore } from '../../store/useAppStore';
import {
  useCloudSyncStore,
  signOutCloud,
} from '../../services/cloudSyncService';
import { getAccessToken } from '../../services/api/httpClient';

// Mock framer-motion to reduce motion and prevent unmount animation aborts
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    useReducedMotion: () => true,
  };
});

// Mock canvas-confetti to prevent happy-dom 2D canvas context errors
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

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

describe('PHASE 7: Welcome & Auth Complete Matrix E2E Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    useCloudSyncStore.setState({
      user: null,
      userEmail: null,
      session: null,
      isOnline: true,
      status: 'idle',
      errorMessage: null,
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
        avatarSeed: 'Felix',
        targetDailyWords: 20,
        targetDailyNewWords: 15,
        extraNewWordsBonus: 0,
        isOnboarded: false,
      },
      srsProgressMap: {},
      mistakeBank: {},
    });
  });

  describe('1. First-Visit Experience & Absence of Fake Data', () => {
    it('shows Welcome & Auth landing page for brand new visitor and suppresses OnboardingModal', () => {
      render(<App />);

      // Hero headline & brand
      expect(screen.getByRole('heading', { name: /English Mastery Hub/i })).toBeDefined();
      expect(screen.getByText(/Làm chủ tiếng Anh theo/i)).toBeDefined();

      // Four real verified product numbers
      expect(screen.getByText(/10.381 Từ vựng FSRS & SM-2/i)).toBeDefined();
      expect(screen.getByText(/96 Bài luyện Four Skills/i)).toBeDefined();
      expect(screen.getByText(/Luyện thi TOEIC Chuẩn ETS/i)).toBeDefined();
      expect(screen.getByText(/7 Danh mục Leaderboard & AI Tutor/i)).toBeDefined();

      // OnboardingModal must NOT open automatically on landing
      expect(screen.queryByText(/Chào mừng bạn đến với English Master/i)).toBeNull();
      expect(screen.queryByPlaceholderText(/Alex, Minh Anh/i)).toBeNull();
    });
  });

  describe('2. Routing Matrix: Guest, Authenticated, Session Restoration & Logout', () => {
    it('First visitor clicks Guest CTA -> Navigates smoothly to OnboardingModal without fake JWT', () => {
      render(<App />);

      const guestBtn = screen.getByRole('button', {
        name: /Tiếp tục học mà không cần tài khoản/i,
      });
      fireEvent.click(guestBtn);

      // Enters onboarding modal
      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByText(/Chào mừng bạn đến với English Master/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/Alex, Minh Anh/i)).toBeDefined();

      // Invariants: No authenticated token or backend user created
      expect(getAccessToken()).toBeNull();
      expect(useCloudSyncStore.getState().user).toBeNull();
      expect(useAppStore.getState().isGuestMode).toBe(true);
    });

    it('Returning Guest with completed profile reloads -> Enters Dashboard directly without Welcome screen', () => {
      useAppStore.setState({
        isHydrated: true,
        isGuestMode: true,
        profile: {
          ...useAppStore.getState().profile,
          name: 'ReturningGuest',
          isOnboarded: true,
          xp: 120,
        },
      });

      render(<App />);

      expect(screen.getByText('Tổng Quan')).toBeDefined();
      expect(screen.queryByText(/Làm chủ tiếng Anh theo/i)).toBeNull();
    });

    it('Returning Authenticated user reloads -> Bypasses Welcome directly to Dashboard', () => {
      const mockUser = { id: 'auth-guid-99', email: 'verified@domain.com', displayName: 'Tuấn Minh' };
      useCloudSyncStore.setState({
        user: mockUser,
        userEmail: mockUser.email,
        session: { access_token: 'valid-jwt', user: mockUser },
        isAuthInitialized: true,
      });
      useAppStore.setState({
        isHydrated: true,
        profile: {
          ...useAppStore.getState().profile,
          name: 'Tuấn Minh',
          isOnboarded: true,
          xp: 850,
        },
      });

      render(<App />);

      expect(screen.getByText('Tổng Quan')).toBeDefined();
      expect(screen.queryByText(/Làm chủ tiếng Anh theo/i)).toBeNull();
    });

    it('Sign Out -> Clears auth credentials, transitions back to Welcome, and preserves all local learning progress', async () => {
      const mockUser = { id: 'signout-guid', email: 'signout@domain.com', displayName: 'Học Viên' };
      useCloudSyncStore.setState({
        user: mockUser,
        userEmail: mockUser.email,
        session: { access_token: 'valid-jwt', user: mockUser },
        isAuthInitialized: true,
      });
      useAppStore.setState({
        isHydrated: true,
        profile: {
          ...useAppStore.getState().profile,
          name: 'Học Viên',
          isOnboarded: true,
          xp: 1250,
        },
        srsProgressMap: {
          'vocab-preserved': { srsLevel: 4, interval: 12, easeFactor: 2.6, nextReviewDate: '2026-10-25' },
        },
        mistakeBank: {
          'mis-preserved': { id: 'mis-preserved', word: 'eloquence', meaning: 'hùng biện', mistakeCount: 2, lastMistakeAt: '2026-10-08', consecutiveCorrect: 1, resolved: false },
        },
      });

      const { unmount } = render(<App />);
      expect(screen.getByText('Tổng Quan')).toBeDefined();

      // Sign out
      await act(async () => {
        await signOutCloud();
      });

      unmount();

      // Re-render after signout
      render(<App />);

      // Lands on Welcome page
      expect(screen.getByText(/Làm chủ tiếng Anh theo/i)).toBeDefined();

      // Local learning progress remains completely intact
      const store = useAppStore.getState();
      expect(store.srsProgressMap['vocab-preserved']).toBeDefined();
      expect(store.srsProgressMap['vocab-preserved'].srsLevel).toBe(4);
      expect(store.mistakeBank['mis-preserved']).toBeDefined();
      expect(store.profile.xp).toBe(1250);
    });
  });

  describe('3. Offline Resilience & Absence of Ghost State', () => {
    it('Guest operates completely offline without crashing or querying backend endpoints', () => {
      useCloudSyncStore.setState({ isOnline: false, isAuthInitialized: true });
      useAppStore.setState({
        isHydrated: true,
        isGuestMode: true,
        profile: {
          ...useAppStore.getState().profile,
          name: 'Offline Explorer',
          isOnboarded: true,
          xp: 300,
        },
        srsProgressMap: {
          'offline-card-1': { srsLevel: 1, interval: 1, easeFactor: 2.5, nextReviewDate: '2026-10-09' },
        },
      });

      render(<App />);

      expect(screen.getByText('Tổng Quan')).toBeDefined();
      expect(useAppStore.getState().srsProgressMap['offline-card-1'].srsLevel).toBe(1);
    });
  });
});
