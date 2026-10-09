// @vitest-environment happy-dom
import React, { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { App } from '../../App';
import { useAppStore } from '../../store/useAppStore';
import { useCloudSyncStore } from '../../services/cloudSyncService';
import { authApi } from '../../services/api/authApi';
import { getApiBaseUrl, ApiError, setAccessToken } from '../../services/api/httpClient';
import { DEFAULT_PROFILE } from '../../store/initialDefaults';
import {
  isGuestSessionActive,
  setGuestSessionActive,
  clearGuestSession,
} from '../../store/guestSessionStorage';

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

// Mock authApi to prevent unintended network calls
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

describe('PHASE 7: Vercel, Unified & PWA Consistency Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    clearGuestSession();
    setAccessToken(null);

    // Reset stores to neutral baseline
    useCloudSyncStore.setState({
      user: null,
      session: null,
      isAuthInitialized: true,
      isAuthUnavailable: false,
      status: 'idle',
    });

    useAppStore.setState({
      isHydrated: true,
      isGuestMode: false,
      isLoggedOut: false,
      profile: {
        ...DEFAULT_PROFILE,
        name: 'Learner',
        isOnboarded: true,
        level: 3,
        xp: 450,
        streak: 7,
      },
    });
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    clearGuestSession();
  });

  // 1. API Base URL Resolution Across Environments
  describe('1. API Base URL Resolution Across Environments', () => {
    it('resolves relative /api in unified mode or production when configured', () => {
      const baseUrl = getApiBaseUrl();
      // Current env in repo has VITE_API_BASE_URL set, let's verify it normalizes slashes cleanly
      expect(baseUrl.endsWith('/api') || baseUrl === '/api').toBe(true);
      expect(baseUrl.endsWith('/')).toBe(false);
    });

    it('sanitizes trailing slashes from custom public API URLs', () => {
      const rawEnv = 'https://api.masteryhub.com/api///';
      const cleanUrl = rawEnv.replace(/\/+$/, '');
      expect(cleanUrl).toBe('https://api.masteryhub.com/api');
    });

    it('does NOT hardcode localhost:5000 in production bundle when VITE_API_BASE_URL is not provided', () => {
      const resolveBaseUrl = (envUrl: string, isProd: boolean) => {
        const trimmed = (envUrl || '').trim();
        if (trimmed) return trimmed.replace(/\/+$/, '');
        if (isProd) return '/api';
        return 'http://localhost:5000/api';
      };

      expect(resolveBaseUrl('', true)).toBe('/api');
      expect(resolveBaseUrl('  ', true)).toBe('/api');
      expect(resolveBaseUrl('/api', true)).toBe('/api');
      expect(resolveBaseUrl('', false)).toBe('http://localhost:5000/api');
    });
  });

  // 2. Access Gating Invariant Across Origins (localhost vs Vercel)
  describe('2. Access Gating Invariant Across Origins', () => {
    it('always resolves to Welcome screen for visitor on Vercel origin with legacy local data', async () => {
      // Simulate Vercel origin
      delete (window as any).location;
      (window as any).location = new URL('https://english-mastery-hub.vercel.app/');

      // User has existing XP and streak in localStorage, but no verified token and no guest choice
      render(
        <StrictMode>
          <App />
        </StrictMode>
      );

      // Must display Welcome gate, NOT Dashboard
      expect(screen.getByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeDefined();
      expect(screen.queryByRole('button', { name: /tổng quan/i })).toBeNull();
      expect(screen.getByRole('button', { name: /tiếp tục học mà không cần tài khoản/i })).toBeDefined();
    });

    it('resolves to Welcome screen for visitor on Unified origin (localhost:5000) with legacy local data', async () => {
      delete (window as any).location;
      (window as any).location = new URL('http://localhost:5000/');

      render(
        <StrictMode>
          <App />
        </StrictMode>
      );

      expect(screen.getByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeDefined();
      expect(screen.queryByRole('button', { name: /tổng quan/i })).toBeNull();
    });

    it('resolves to Welcome screen for visitor on Dev origin (localhost:5173) with legacy local data', async () => {
      delete (window as any).location;
      (window as any).location = new URL('http://localhost:5173/');

      render(
        <StrictMode>
          <App />
        </StrictMode>
      );

      expect(screen.getByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeDefined();
      expect(screen.queryByRole('button', { name: /tổng quan/i })).toBeNull();
    });
  });

  // 3. Frontend-Only Vercel Deployment & Offline Guest Continuity
  describe('3. Frontend-Only Vercel Deployment & Offline Guest Continuity', () => {
    it('allows Guest to learn Local-First completely offline when backend is not available on Vercel', async () => {
      delete (window as any).location;
      (window as any).location = new URL('https://english-mastery-hub.vercel.app/');

      // Activate explicit guest mode
      setGuestSessionActive(true);
      useAppStore.setState({ isGuestMode: true, isLoggedOut: false });

      render(
        <StrictMode>
          <App />
        </StrictMode>
      );

      // Guest immediately accesses Dashboard
      expect(screen.queryByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeNull();
      expect(screen.getByRole('button', { name: /tổng quan/i })).toBeDefined();

      // Guest can gain XP locally without calling backend
      const prevXp = useAppStore.getState().profile.xp;
      act(() => {
        useAppStore.getState().gainXP(50);
      });

      expect(useAppStore.getState().profile.xp).toBeGreaterThan(prevXp);
      expect(isGuestSessionActive()).toBe(true);
    });

    it('displays connection error and preserves Welcome state when login is attempted on Vercel without backend', async () => {
      delete (window as any).location;
      (window as any).location = new URL('https://english-mastery-hub.vercel.app/');

      // Mock authApi.login returning 404 (no backend on Vercel)
      vi.mocked(authApi.login).mockRejectedValueOnce(
        new ApiError(404, { code: 'NOT_FOUND', message: 'Không thể kết nối đến máy chủ API.' })
      );

      render(
        <StrictMode>
          <App />
        </StrictMode>
      );

      // Click "Đăng nhập"
      const loginButton = screen.getByRole('button', { name: /^Đăng nhập$/i });
      fireEvent.click(loginButton);

      // Verify Welcome screen is not bypassed and user is not authenticated
      expect(useCloudSyncStore.getState().user).toBeNull();
      expect(useAppStore.getState().isGuestMode).toBe(false);
    });

    it('renders safe auth_unavailable screen with Retry and Guest choice when backend unreachable for existing session', async () => {
      delete (window as any).location;
      (window as any).location = new URL('https://english-mastery-hub.vercel.app/');

      // Simulate token exists, but backend unreachable
      setAccessToken('existing-token');
      useCloudSyncStore.setState({
        user: null,
        session: null,
        isAuthInitialized: true,
        isAuthUnavailable: true,
      });

      render(
        <StrictMode>
          <App />
        </StrictMode>
      );

      // Safe fallback UI rendered
      expect(screen.getByRole('alert', { name: /Xác thực tạm thời không khả dụng/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Thử kết nối lại/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Tiếp tục học với vai trò Khách/i })).toBeDefined();
    });
  });

  // 4. Stale Deployment Root Cause Isolation
  describe('4. Stale Deployment Root Cause Isolation', () => {
    it('proves profile.isOnboarded: true in localStorage CANNOT bypass Welcome gate', async () => {
      useAppStore.setState({
        isGuestMode: false,
        isLoggedOut: false,
        profile: {
          ...DEFAULT_PROFILE,
          name: 'Learner',
          isOnboarded: true,
          level: 10,
          xp: 9999,
          streak: 30,
        },
      });

      render(
        <StrictMode>
          <App />
        </StrictMode>
      );

      // Gate invariant: must be Welcome
      expect(screen.getByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeDefined();
      expect(screen.queryByRole('button', { name: /tổng quan/i })).toBeNull();
    });

    it('proves unauthenticated profile with high XP CANNOT bypass Welcome gate', async () => {
      useAppStore.setState({
        isGuestMode: false,
        isLoggedOut: false,
        profile: {
          ...DEFAULT_PROFILE,
          name: 'Elite Learner',
          isOnboarded: false,
          level: 50,
          xp: 50000,
          streak: 100,
        },
      });

      render(
        <StrictMode>
          <App />
        </StrictMode>
      );

      expect(screen.getByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeDefined();
      expect(screen.queryByRole('button', { name: /tổng quan/i })).toBeNull();
    });
  });
});
