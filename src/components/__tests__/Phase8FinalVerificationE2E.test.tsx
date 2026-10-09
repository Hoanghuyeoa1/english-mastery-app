// @vitest-environment happy-dom
import React, { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { App } from '../../App';
import { useAppStore } from '../../store/useAppStore';
import { useCloudSyncStore, signOutCloud, initCloudSync } from '../../services/cloudSyncService';
import { authApi } from '../../services/api/authApi';
import { ApiError, setAccessToken } from '../../services/api/httpClient';
import { DEFAULT_PROFILE } from '../../store/initialDefaults';
import {
  isGuestSessionActive,
  setGuestSessionActive,
  clearGuestSession,
} from '../../store/guestSessionStorage';
import {
  prepareDataSlotForUser,
  prepareDataSlotForGuest,
  archiveCurrentDataSlot,
  inspectDataOwnership,
} from '../../store/dataOwnershipManager';

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

describe('PHASE 8: Welcome/Auth Critical Fix Final Verification E2E Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    clearGuestSession();
    setAccessToken(null);

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

  // 1. Comprehensive Access State E2E Matrix
  describe('1. Comprehensive Access State E2E Matrix', () => {
    it('E2E-1: Fresh visitor with no session/guest choice renders Welcome', async () => {
      useAppStore.setState({
        profile: { ...DEFAULT_PROFILE, name: '', isOnboarded: false, xp: 0, streak: 0 },
      });

      render(
        <StrictMode>
          <App />
        </StrictMode>
      );

      expect(screen.getByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeDefined();
      expect(screen.queryByRole('button', { name: /tổng quan/i })).toBeNull();
    });

    it('E2E-2: Legacy local data (XP=9999, streak=45) without auth or guest choice MUST stay on Welcome', async () => {
      useAppStore.setState({
        profile: { ...DEFAULT_PROFILE, name: 'Senior Master', isOnboarded: true, xp: 9999, streak: 45 },
      });

      render(
        <StrictMode>
          <App />
        </StrictMode>
      );

      // Must be Welcome gate, NEVER Dashboard
      expect(screen.getByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeDefined();
      expect(screen.queryByRole('button', { name: /tổng quan/i })).toBeNull();
    });

    it('E2E-3: Explicit Guest choice immediately accesses Dashboard for configured profile', async () => {
      render(
        <StrictMode>
          <App />
        </StrictMode>
      );

      const guestBtn = screen.getByRole('button', { name: /tiếp tục học mà không cần tài khoản/i });
      await act(async () => {
        fireEvent.click(guestBtn);
      });

      expect(isGuestSessionActive()).toBe(true);
      expect(useAppStore.getState().isGuestMode).toBe(true);
      expect(screen.getByRole('button', { name: /tổng quan/i })).toBeDefined();
      expect(screen.queryByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeNull();
    });

    it('E2E-4: Returning Guest in same session (sessionStorage active) retains Guest mode across reloads', async () => {
      setGuestSessionActive(true);
      useAppStore.setState({ isGuestMode: true, isLoggedOut: false });

      render(
        <StrictMode>
          <App />
        </StrictMode>
      );

      expect(screen.getByRole('button', { name: /tổng quan/i })).toBeDefined();
      expect(screen.queryByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeNull();
    });

    it('E2E-5: Verified Authenticated user renders Dashboard with user email and verified status', async () => {
      useCloudSyncStore.setState({
        user: { id: 'usr-888-verified', email: 'verified@user.com', displayName: 'Verified User', roles: ['USER'] },
        isAuthInitialized: true,
      });

      render(
        <StrictMode>
          <App />
        </StrictMode>
      );

      expect(screen.getByRole('button', { name: /tổng quan/i })).toBeDefined();
      expect(screen.queryByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeNull();
      expect(screen.getByText('Verified User')).toBeDefined();
      expect(screen.queryByTestId('guest-badge')).toBeNull();
    });

    it('E2E-6: Backend offline during auth check renders safe auth_unavailable fallback UI with Retry', async () => {
      setAccessToken('some-old-token');
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

      expect(screen.getByRole('alert', { name: /xác thực tạm thời không khả dụng/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /thử kết nối lại/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /tiếp tục học với vai trò khách/i })).toBeDefined();
    });

    it('E2E-7: Logout transitions cleanly to Welcome, clearing tokens and not auto-entering Guest', async () => {
      useCloudSyncStore.setState({
        user: { id: 'usr-logout-test', email: 'logout@test.com', displayName: 'Logout Tester', roles: ['USER'] },
        isAuthInitialized: true,
      });
      setAccessToken('token-to-be-cleared');

      render(
        <StrictMode>
          <App />
        </StrictMode>
      );

      expect(screen.getByText('Logout Tester')).toBeDefined();

      // Trigger logout
      await act(async () => {
        await signOutCloud();
      });

      // Must be Welcome gate
      expect(useCloudSyncStore.getState().user).toBeNull();
      expect(useAppStore.getState().isGuestMode).toBe(false);
      expect(useAppStore.getState().isLoggedOut).toBe(true);
      expect(screen.getByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeDefined();
      expect(screen.queryByRole('button', { name: /tổng quan/i })).toBeNull();
    });
  });

  // 2. Identity Isolation & Role-Based Access Control (RBAC)
  describe('2. Identity Isolation & Role-Based Access Control (RBAC)', () => {
    it('RBAC-1: Non-admin user cannot access admin screen', async () => {
      useCloudSyncStore.setState({
        user: { id: 'usr-regular', email: 'regular@user.com', displayName: 'Regular User', roles: ['USER'] },
        isAuthInitialized: true,
      });

      render(
        <StrictMode>
          <App />
        </StrictMode>
      );

      // Verify admin button is not rendered in navigation for regular user
      expect(screen.queryByRole('button', { name: /quản trị/i })).toBeNull();
    });

    it('RBAC-2: Admin user has access to Admin screen and tab', async () => {
      useCloudSyncStore.setState({
        user: { id: 'admin-1', email: 'admin@system.com', displayName: 'System Admin', roles: ['ADMIN'] },
        isAuthInitialized: true,
      });

      render(
        <StrictMode>
          <App />
        </StrictMode>
      );

      expect(screen.getAllByRole('button', { name: /quản trị/i }).length).toBeGreaterThan(0);
    });
  });

  // 3. Multi-Identity Data Slotting & Zero Data Loss
  describe('3. Multi-Identity Data Slotting & Zero Data Loss', () => {
    it('SLOT-1: Seamlessly preserves distinct state between Guest, Account A, and Account B', () => {
      // Step 1: Guest records 300 XP
      useAppStore.setState({
        isGuestMode: true,
        profile: { ...DEFAULT_PROFILE, name: 'Guest Learner', xp: 300, level: 2 },
      });
      archiveCurrentDataSlot('guest');

      // Step 2: User A logs in and records 1200 XP
      prepareDataSlotForUser('user-a-guid', useAppStore.getState());
      useAppStore.setState({
        profile: { ...DEFAULT_PROFILE, name: 'Alice', xp: 1200, level: 5 },
      });
      archiveCurrentDataSlot('user-a-guid');

      // Step 3: User B logs in and records 50 XP
      prepareDataSlotForUser('user-b-guid', useAppStore.getState());
      useAppStore.setState({
        profile: { ...DEFAULT_PROFILE, name: 'Bob', xp: 50, level: 1 },
      });
      archiveCurrentDataSlot('user-b-guid');

      // Step 4: Switch back to User A -> Alice's 1200 XP restored exactly
      prepareDataSlotForUser('user-a-guid', useAppStore.getState());
      expect(useAppStore.getState().profile.name).toBe('Alice');
      expect(useAppStore.getState().profile.xp).toBe(1200);

      // Step 5: Switch back to Guest -> Guest's 300 XP restored exactly
      prepareDataSlotForGuest(useAppStore.getState());
      expect(useAppStore.getState().profile.name).toBe('Guest Learner');
      expect(useAppStore.getState().profile.xp).toBe(300);

      // Step 6: Switch back to User B -> Bob's 50 XP restored exactly
      prepareDataSlotForUser('user-b-guid', useAppStore.getState());
      expect(useAppStore.getState().profile.name).toBe('Bob');
      expect(useAppStore.getState().profile.xp).toBe(50);
    });
  });
});
