// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { App } from '../../App';
import { useAppStore } from '../../store/useAppStore';
import {
  useCloudSyncStore,
  signOutCloud,
  initCloudSync,
  signInWithGoogleExchange,
  getAuthVerificationGeneration,
} from '../../services/cloudSyncService';
import { authApi, type CurrentUserResponse, type AuthResponse } from '../../services/api/authApi';
import { ApiError, getAccessToken, setAccessToken } from '../../services/api/httpClient';
import { DEFAULT_PROFILE } from '../../store/initialDefaults';
import { isUserAdmin } from '../../utils/adminAuth';

// Mock framer-motion to reduce motion
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    useReducedMotion: () => true,
  };
});

// Mock virtual:pwa-register/react for Navbar
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));

// Mock sub-components and heavy services
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

vi.mock('../../services/api/leaderboardApi', () => ({
  leaderboardApi: {
    fetchServerTime: vi.fn().mockResolvedValue({ serverTime: '2026-10-09T00:00:00Z', weekId: '2026-W41' }),
    fetchCurrentUserRank: vi.fn().mockResolvedValue(null),
    fetchLeaderboardPage: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    syncScore: vi.fn().mockResolvedValue({ success: true }),
    syncWeeklyMetrics: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../services/learningEvidenceTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/learningEvidenceTransport')>();
  return {
    ...actual,
    scheduleLearningEvidenceSubmission: vi.fn(),
  };
});

// Mock authApi to allow per-test control
vi.mock('../../services/api/authApi', () => ({
  authApi: {
    getMe: vi.fn(),
    refresh: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn().mockResolvedValue({}),
    exchangeGoogleCode: vi.fn(),
    directGoogleCallback: vi.fn(),
    getGoogleAuthUrl: vi.fn(),
  },
}));

describe('PHASE 4: Verified Auth Session & OAuth Lifecycle Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAccessToken(null);

    // Default rejecting promises for authApi to prevent undefined errors
    vi.mocked(authApi.getMe).mockRejectedValue(new Error('no session in test'));
    vi.mocked(authApi.refresh).mockRejectedValue(new Error('no refresh in test'));

    // Clean cloud sync state
    useCloudSyncStore.setState({
      user: null,
      userEmail: null,
      session: null,
      isOnline: true,
      status: 'idle',
      isAuthInitialized: false,
      isAuthUnavailable: false,
    });

    // Clean app store state
    useAppStore.setState({
      isHydrated: true,
      isGuestMode: false,
      isLoggedOut: false,
      pendingNavigationTab: null,
      profile: {
        ...DEFAULT_PROFILE,
        name: 'Hoàng Learner',
        isOnboarded: true,
      },
    });
  });

  it('1. Verified session → Authenticated with canonical internal UserId and roles', async () => {
    setAccessToken('valid-bearer-token');

    const mockMeResponse: CurrentUserResponse = {
      id: 'usr-guid-1234',
      email: 'verified.learner@example.com',
      displayName: 'Teacher Hoàng',
      roles: ['USER'],
      level: 5,
      xp: 1250,
      streak: 14,
      createdAt: '2026-01-01',
    };
    vi.mocked(authApi.getMe).mockResolvedValue(mockMeResponse);

    const { unmount } = render(<App />);

    // Wait microtask for getMe resolution in App's initCloudSync
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useCloudSyncStore.getState().user).toEqual({
      id: 'usr-guid-1234',
      email: 'verified.learner@example.com',
      displayName: 'Teacher Hoàng',
      roles: ['USER'],
    });
    expect(useCloudSyncStore.getState().isAuthInitialized).toBe(true);
    expect(useCloudSyncStore.getState().isAuthUnavailable).toBe(false);

    // Renders Dashboard with authenticated user info, not Welcome
    expect(screen.getByRole('button', { name: /tổng quan/i })).toBeDefined();
    expect(screen.queryByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeNull();
    expect(screen.getByTitle(/tài khoản: Teacher Hoàng/i)).toBeDefined();

    unmount();
  });

  it('2. No session (no token, no refresh cookie) → Lands on Welcome, never auto-Guest', async () => {
    setAccessToken(null);
    vi.mocked(authApi.refresh).mockRejectedValue(
      new ApiError(401, { code: 'UNAUTHORIZED', message: 'No refresh token' })
    );

    const { unmount } = render(<App />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useCloudSyncStore.getState().user).toBeNull();
    expect(useCloudSyncStore.getState().isAuthInitialized).toBe(true);
    expect(useAppStore.getState().isGuestMode).toBe(false);

    // Must be on Welcome view
    expect(screen.getByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /tổng quan/i })).toBeNull();

    unmount();
  });

  it('3. Expired token → Automatic refresh succeeds and maintains authenticated session', async () => {
    setAccessToken('expired-access-token');

    // getMe throws 401 Unauthorized
    vi.mocked(authApi.getMe).mockRejectedValue(
      new ApiError(401, { code: 'UNAUTHORIZED', message: 'Access token expired' })
    );

    // refresh succeeds with new access token
    const mockRefreshResponse: AuthResponse = {
      accessToken: 'brand-new-access-token',
      expiresInSeconds: 3600,
      user: {
        id: 'usr-refreshed-999',
        email: 'refreshed.user@example.com',
        displayName: 'Minh Anh',
        roles: ['USER'],
      },
    };
    vi.mocked(authApi.refresh).mockResolvedValue(mockRefreshResponse);

    const { unmount } = render(<App />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getAccessToken()).toBe('brand-new-access-token');
    expect(useCloudSyncStore.getState().user?.id).toBe('usr-refreshed-999');
    expect(useCloudSyncStore.getState().isAuthInitialized).toBe(true);
    expect(screen.getByRole('button', { name: /tổng quan/i })).toBeDefined();

    unmount();
  });

  it('4. Expired token with refresh failure (401) → Clears credentials, returns to Welcome', async () => {
    setAccessToken('invalid-token');

    // Both getMe and refresh fail with 401
    vi.mocked(authApi.getMe).mockRejectedValue(
      new ApiError(401, { code: 'UNAUTHORIZED', message: 'Token invalid' })
    );
    vi.mocked(authApi.refresh).mockRejectedValue(
      new ApiError(401, { code: 'UNAUTHORIZED', message: 'Refresh token expired or revoked' })
    );

    const { unmount } = render(<App />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Token must be removed, user cleared
    expect(getAccessToken()).toBeNull();
    expect(useCloudSyncStore.getState().user).toBeNull();
    expect(useCloudSyncStore.getState().isAuthInitialized).toBe(true);

    expect(screen.getByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /tổng quan/i })).toBeNull();

    unmount();
  });

  it('5. Backend timeout / server down (503) → Distinguishes temporary error from 401, shows safe retry gate', async () => {
    setAccessToken('existing-valid-token');

    // Server unreachable error (503 Service Unavailable)
    vi.mocked(authApi.getMe).mockRejectedValue(
      new ApiError(503, { code: 'DATABASE_ERROR', message: 'Server temporarily unavailable' })
    );

    const { unmount } = render(<App />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Existing token must NOT be deleted
    expect(getAccessToken()).toBe('existing-valid-token');
    expect(useCloudSyncStore.getState().isAuthUnavailable).toBe(true);
    expect(useCloudSyncStore.getState().isAuthInitialized).toBe(true);

    // Safe error screen with Retry and Guest buttons
    expect(screen.getByRole('alert', { name: /xác thực tạm thời không khả dụng/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /thử kết nối lại/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /tiếp tục học với vai trò khách/i })).toBeDefined();

    unmount();
  });

  it('6. Async Race Protection: Logout during pending auth verification → Stale response discarded', async () => {
    setAccessToken('slow-token');

    let resolveSlowMe!: (val: CurrentUserResponse) => void;
    const slowMePromise = new Promise<CurrentUserResponse>((resolve) => {
      resolveSlowMe = resolve;
    });
    vi.mocked(authApi.getMe).mockReturnValue(slowMePromise);

    const cleanup = initCloudSync();

    // While request is pending, user explicitly logs out
    await act(async () => {
      await signOutCloud();
    });

    expect(useCloudSyncStore.getState().user).toBeNull();
    expect(useAppStore.getState().isLoggedOut).toBe(true);

    // Now slow response resolves
    await act(async () => {
      resolveSlowMe({
        id: 'usr-stale-1',
        email: 'stale@example.com',
        displayName: 'Stale User',
        roles: ['USER'],
        level: 1,
        xp: 0,
        streak: 0,
        createdAt: '2026-01-01',
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    // Stale response must be discarded by generation guard!
    expect(useCloudSyncStore.getState().user).toBeNull();
    expect(useAppStore.getState().isLoggedOut).toBe(true);

    cleanup();
  });

  it('7. Async Race Protection: Guest selection during pending verification → Respects guest mode choice', async () => {
    setAccessToken('slow-token');

    let resolveSlowMe!: (val: CurrentUserResponse) => void;
    const slowMePromise = new Promise<CurrentUserResponse>((resolve) => {
      resolveSlowMe = resolve;
    });
    vi.mocked(authApi.getMe).mockReturnValue(slowMePromise);

    const cleanup = initCloudSync();

    // User chooses Guest mode while verification is running
    act(() => {
      useAppStore.getState().setGuestMode?.(true);
    });
    expect(useAppStore.getState().isGuestMode).toBe(true);

    // Slow auth response resolves later
    await act(async () => {
      resolveSlowMe({
        id: 'usr-stale-guest',
        email: 'guest.override@example.com',
        displayName: 'Should Not Override',
        roles: ['USER'],
        level: 1,
        xp: 0,
        streak: 0,
        createdAt: '2026-01-01',
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    // Must NOT override Guest mode!
    expect(useAppStore.getState().isGuestMode).toBe(true);
    expect(useCloudSyncStore.getState().user).toBeNull();

    cleanup();
  });

  it('8. Google OAuth callback: Child popup relay posts exchange code to opener and closes', async () => {
    const mockPostMessage = vi.fn();
    const mockClose = vi.fn();

    // Simulate popup child window
    const originalOpener = window.opener;
    Object.defineProperty(window, 'opener', {
      value: { postMessage: mockPostMessage },
      writable: true,
      configurable: true,
    });
    window.close = mockClose;

    // Set search params in URL
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      search: '?oauth_exchange_code=g-exc-test-777',
      origin: 'http://localhost:5173',
    } as any;

    const { unmount } = render(<App />);

    expect(mockPostMessage).toHaveBeenCalledWith(
      { type: 'GOOGLE_AUTH_EXCHANGE', code: 'g-exc-test-777' },
      'http://localhost:5173'
    );
    expect(mockClose).toHaveBeenCalled();

    // Restore window
    Object.defineProperty(window, 'opener', { value: originalOpener, configurable: true });
    (window as any).location = originalLocation;
    unmount();
  });

  it('9. Google OAuth code exchange: Valid exchangeCode establishes session with verified roles', async () => {
    const mockGoogleExchangeRes: AuthResponse = {
      accessToken: 'google-verified-jwt',
      expiresInSeconds: 3600,
      user: {
        id: 'usr-google-444',
        email: 'google.student@gmail.com',
        displayName: 'Google Student',
        roles: ['USER'],
      },
    };
    vi.mocked(authApi.exchangeGoogleCode).mockResolvedValue(mockGoogleExchangeRes);

    const result = await signInWithGoogleExchange('valid-code-123');

    expect(result.error).toBeNull();
    expect(result.data.user?.id).toBe('usr-google-444');
    expect(useCloudSyncStore.getState().user?.email).toBe('google.student@gmail.com');
    expect(getAccessToken()).toBe('google-verified-jwt');
    expect(useAppStore.getState().isGuestMode).toBe(false);
  });

  it('10. StrictMode double invocation: Invalidation guard discards first effect execution', async () => {
    setAccessToken('token-strict');

    let resolve1!: (val: CurrentUserResponse) => void;
    const promise1 = new Promise<CurrentUserResponse>((r) => { resolve1 = r; });

    let resolve2!: (val: CurrentUserResponse) => void;
    const promise2 = new Promise<CurrentUserResponse>((r) => { resolve2 = r; });

    vi.mocked(authApi.getMe)
      .mockReturnValueOnce(promise1)
      .mockReturnValueOnce(promise2);

    const initialGen = getAuthVerificationGeneration();

    // 1st mount
    const cleanup1 = initCloudSync();
    expect(getAuthVerificationGeneration()).toBe(initialGen + 1);

    // StrictMode unmount
    cleanup1();
    expect(getAuthVerificationGeneration()).toBe(initialGen + 2);

    // 2nd mount
    const cleanup2 = initCloudSync();
    expect(getAuthVerificationGeneration()).toBe(initialGen + 3);

    // Resolve 1st promise (from unmounted instance)
    await act(async () => {
      resolve1({
        id: 'usr-first-call',
        email: 'first@example.com',
        displayName: 'First Call',
        roles: ['USER'],
        level: 1,
        xp: 0,
        streak: 0,
        createdAt: '2026-01-01',
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    // 1st call MUST be discarded
    expect(useCloudSyncStore.getState().user).toBeNull();

    // Resolve 2nd promise
    await act(async () => {
      resolve2({
        id: 'usr-second-call',
        email: 'second@example.com',
        displayName: 'Second Call',
        roles: ['USER'],
        level: 1,
        xp: 0,
        streak: 0,
        createdAt: '2026-01-01',
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    // Only 2nd call takes effect
    expect(useCloudSyncStore.getState().user?.id).toBe('usr-second-call');

    cleanup2();
  });

  it('11. Role Integrity: USER role is expelled from Admin view; ADMIN role grants access', async () => {
    // Case 11A: User role is USER
    const regularUser: CurrentUserResponse = {
      id: 'usr-regular',
      email: 'regular@example.com',
      displayName: 'Regular User',
      roles: ['USER'],
      level: 1,
      xp: 0,
      streak: 0,
      createdAt: '2026-01-01',
    };
    expect(isUserAdmin(regularUser)).toBe(false);

    setAccessToken('user-regular-token');
    vi.mocked(authApi.getMe).mockResolvedValue(regularUser);
    useAppStore.setState({ pendingNavigationTab: 'admin' });

    const { unmount: unmount1 } = render(<App />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Regular user is automatically expelled from admin tab and admin nav button is not rendered
    expect(screen.queryByText(/quản trị 🛡️/i)).toBeNull();
    unmount1();

    // Case 11B: User role is ADMIN
    const adminUser: CurrentUserResponse = {
      id: 'usr-admin',
      email: 'admin@example.com',
      displayName: 'System Admin',
      roles: ['ADMIN'],
      level: 1,
      xp: 0,
      streak: 0,
      createdAt: '2026-01-01',
    };
    expect(isUserAdmin(adminUser)).toBe(true);

    setAccessToken('admin-token');
    vi.mocked(authApi.getMe).mockResolvedValue(adminUser);
    useAppStore.setState({ pendingNavigationTab: 'admin' });

    const { unmount: unmount2 } = render(<App />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Admin nav button is present and active
    expect(screen.getAllByText(/quản trị/i).length).toBeGreaterThan(0);
    unmount2();
  });
});
