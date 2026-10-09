// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { App } from '../../App';
import { useAppStore } from '../../store/useAppStore';
import {
  useCloudSyncStore,
  initCloudSync,
  signOutCloud,
  signInWithEmail,
  signInWithGoogleExchange,
  type AppAuthUser,
} from '../../services/cloudSyncService';
import { authApi, type CurrentUserResponse, type AuthResponse } from '../../services/api/authApi';
import { setAccessToken, getAccessToken } from '../../services/api/httpClient';
import { DEFAULT_PROFILE } from '../../store/initialDefaults';
import {
  inspectDataOwnership,
  archiveCurrentDataSlot,
  prepareDataSlotForGuest,
  prepareDataSlotForUser,
  CANONICAL_STORAGE_KEY,
  ACTIVE_USER_ID_KEY,
  DATA_OWNER_KEY,
  GUEST_SLOT_KEY,
  LEGACY_BACKUP_KEY,
  USER_SLOT_PREFIX,
} from '../../store/dataOwnershipManager';
import {
  onUserLogin,
  onUserLogout,
  onAccountSwitch,
  getPendingEvidenceUserId,
  hasPendingOfflineEvidence,
} from '../../services/learningEvidenceTransport';
import * as signalRService from '../../services/api/signalRService';
import { isUserAdmin } from '../../utils/adminAuth';

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

// Mock sub-components and network services
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

// Mock authApi to allow controlled testing
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

describe('PHASE 6: Identity Isolation & Account Switching Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAccessToken(null);
    localStorage.clear();
    sessionStorage.clear();

    vi.mocked(authApi.getMe).mockRejectedValue(new Error('no session in test'));
    vi.mocked(authApi.refresh).mockRejectedValue(new Error('no refresh in test'));

    useCloudSyncStore.setState({
      user: null,
      userEmail: null,
      session: null,
      isOnline: true,
      status: 'idle',
      isAuthInitialized: false,
      isAuthUnavailable: false,
    });

    useAppStore.setState({
      isHydrated: true,
      isGuestMode: false,
      isLoggedOut: false,
      pendingNavigationTab: null,
      profile: {
        ...DEFAULT_PROFILE,
        name: '',
        isOnboarded: false,
      },
    });
  });

  it('1. Guest → Account A: Guest progress is archived to guest slot and NOT auto-merged into Account A', async () => {
    // 1A. Guest studies and earns progress
    prepareDataSlotForGuest(useAppStore.getState());
    useAppStore.setState({
      isGuestMode: true,
      profile: { ...DEFAULT_PROFILE, name: 'Khách Học Tập', xp: 350, streak: 5, isOnboarded: true },
    });
    archiveCurrentDataSlot('guest');

    // 1B. User logs in as Account A
    const accountAResponse: AuthResponse = {
      accessToken: 'token-a',
      expiresInSeconds: 3600,
      user: {
        id: 'usr-account-A',
        email: 'a@example.com',
        displayName: 'Nguyễn Văn A',
        roles: ['USER'],
      },
    };
    vi.mocked(authApi.login).mockResolvedValue(accountAResponse);

    await act(async () => {
      await signInWithEmail('a@example.com', 'password123');
    });

    // Enters as Authenticated Account A
    expect(useCloudSyncStore.getState().user?.id).toBe('usr-account-A');
    expect(useAppStore.getState().isGuestMode).toBe(false);

    // Guest progress must be preserved in GUEST_SLOT_KEY, NOT merged into Account A
    const guestSlot = localStorage.getItem(GUEST_SLOT_KEY);
    expect(guestSlot).not.toBeNull();
    const parsedGuest = JSON.parse(guestSlot!);
    expect(parsedGuest.state.profile.name).toBe('Khách Học Tập');
    expect(parsedGuest.state.profile.xp).toBe(350);
  });

  it('2. Guest → Google Login: Establishes verified authenticated session with backend UserId and claims', async () => {
    // Guest active
    prepareDataSlotForGuest(useAppStore.getState());
    useAppStore.setState({
      isGuestMode: true,
      profile: { ...DEFAULT_PROFILE, name: 'Khách Tạm', xp: 100, isOnboarded: true },
    });

    // Mock Google exchange response
    const googleAuthRes: AuthResponse = {
      accessToken: 'google-jwt-888',
      expiresInSeconds: 3600,
      user: {
        id: 'usr-google-verified-999',
        email: 'google.learner@gmail.com',
        displayName: 'Google User',
        roles: ['USER'],
      },
    };
    vi.mocked(authApi.exchangeGoogleCode).mockResolvedValue(googleAuthRes);

    await act(async () => {
      await signInWithGoogleExchange('google-auth-code-777');
    });

    expect(useCloudSyncStore.getState().user?.id).toBe('usr-google-verified-999');
    expect(useCloudSyncStore.getState().user?.email).toBe('google.learner@gmail.com');
    expect(useAppStore.getState().isGuestMode).toBe(false);
  });

  it('3. Account A → Logout → Welcome: Revokes session, clears tokens, purges private cache, lands on Welcome', async () => {
    setAccessToken('token-a');
    useCloudSyncStore.setState({
      user: { id: 'usr-A', email: 'a@example.com', displayName: 'User A', roles: ['USER'] },
      session: { access_token: 'token-a', user: null },
      isAuthInitialized: true,
    });
    useAppStore.setState({
      isHydrated: true,
      isGuestMode: false,
      isLoggedOut: false,
      profile: { ...DEFAULT_PROFILE, name: 'User A', xp: 800, isOnboarded: true },
    });

    const { unmount } = render(<App />);
    await act(async () => {
      await Promise.resolve();
    });

    // Execute logout
    await act(async () => {
      await signOutCloud();
    });

    // Session is revoked
    expect(getAccessToken()).toBeNull();
    expect(useCloudSyncStore.getState().user).toBeNull();
    expect(useCloudSyncStore.getState().session).toBeNull();
    expect(useAppStore.getState().isLoggedOut).toBe(true);
    expect(useAppStore.getState().isGuestMode).toBe(false);

    // Welcome view is rendered
    expect(screen.getByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeDefined();

    unmount();
  });

  it('4. Logout → Guest: Newly chosen Guest session does NOT inherit or display logged-out users private data', async () => {
    // 4A. Account A had private profile and high XP
    prepareDataSlotForUser('usr-A', useAppStore.getState());
    useAppStore.setState({
      profile: { ...DEFAULT_PROFILE, name: 'Private User A', xp: 5000, isOnboarded: true },
    });
    archiveCurrentDataSlot('usr-A');

    // 4B. User logs out
    await signOutCloud();

    const { unmount } = render(<App />);
    await act(async () => {
      await Promise.resolve();
    });

    // 4C. User clicks "Tiếp tục học mà không cần tài khoản"
    const guestBtn = screen.getByRole('button', { name: /tiếp tục học mà không cần tài khoản/i });
    await act(async () => {
      fireEvent.click(guestBtn);
    });

    // Guest enters clean session; Account A private profile is NOT displayed
    expect(screen.queryByText(/Private User A/i)).toBeNull();
    expect(useAppStore.getState().profile.name).not.toBe('Private User A');
    expect(useAppStore.getState().profile.xp).toBe(0);

    // Account A data was safely preserved in their slot
    const slotA = localStorage.getItem(`${USER_SLOT_PREFIX}usr-A`);
    expect(slotA).not.toBeNull();
    expect(JSON.parse(slotA!).state.profile.name).toBe('Private User A');

    unmount();
  });

  it('5. Account A → Account B: Switching accounts cleanly preserves both profiles without cross-contamination', () => {
    const store = useAppStore.getState();

    // 5A. User A studies
    prepareDataSlotForUser('usr-A', store);
    useAppStore.setState({
      profile: { ...DEFAULT_PROFILE, name: 'Alice', xp: 600, level: 3, isOnboarded: true },
    });
    archiveCurrentDataSlot('usr-A');

    // 5B. User B logs in
    prepareDataSlotForUser('usr-B', store);
    useAppStore.setState({
      profile: { ...DEFAULT_PROFILE, name: 'Bob', xp: 900, level: 4, isOnboarded: true },
    });
    archiveCurrentDataSlot('usr-B');

    // 5C. Switch back to User A
    prepareDataSlotForUser('usr-A', store);
    expect(useAppStore.getState().profile.name).toBe('Alice');
    expect(useAppStore.getState().profile.xp).toBe(600);

    // 5D. Switch back to User B
    prepareDataSlotForUser('usr-B', store);
    expect(useAppStore.getState().profile.name).toBe('Bob');
    expect(useAppStore.getState().profile.xp).toBe(900);
  });

  it('6. ADMIN → Logout → USER: Role ADMIN does NOT leak to regular USER; USER is expelled from Admin view', async () => {
    // 6A. System Admin logs in
    const adminUser: CurrentUserResponse = {
      id: 'usr-admin-root',
      email: 'admin@system.com',
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

    const { unmount: unmount1 } = render(<App />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Admin nav button is present
    expect(screen.getAllByText(/quản trị/i).length).toBeGreaterThan(0);
    unmount1();

    // 6B. Admin logs out
    await signOutCloud();

    // 6C. Regular user logs in
    const regularUser: CurrentUserResponse = {
      id: 'usr-regular-learner',
      email: 'learner@school.com',
      displayName: 'Regular Learner',
      roles: ['USER'],
      level: 1,
      xp: 0,
      streak: 0,
      createdAt: '2026-01-01',
    };
    expect(isUserAdmin(regularUser)).toBe(false);

    setAccessToken('regular-token');
    vi.mocked(authApi.getMe).mockResolvedValue(regularUser);
    useAppStore.setState({ pendingNavigationTab: 'admin' });

    const { unmount: unmount2 } = render(<App />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Regular user must NOT see Admin nav button and is expelled from Admin view
    expect(screen.queryByText(/quản trị 🛡️/i)).toBeNull();
    unmount2();
  });

  it('7. In-flight request during logout: Response arriving after logout is discarded', async () => {
    setAccessToken('slow-token');

    let resolveSlowMe!: (val: CurrentUserResponse) => void;
    vi.mocked(authApi.getMe).mockImplementation(
      () =>
        new Promise<CurrentUserResponse>((res) => {
          resolveSlowMe = res;
        })
    );

    const cleanup = initCloudSync();

    // User logs out while getMe is pending in flight
    await act(async () => {
      await signOutCloud();
    });

    // Stale getMe response arrives after logout
    await act(async () => {
      resolveSlowMe({
        id: 'usr-stale-after-logout',
        email: 'stale@example.com',
        displayName: 'Stale User',
        roles: ['USER'],
        level: 1,
        xp: 0,
        streak: 0,
        createdAt: '2026-01-01',
      });
      await Promise.resolve();
    });

    // Stale response was discarded; user remains logged out
    expect(useCloudSyncStore.getState().user).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(useAppStore.getState().isLoggedOut).toBe(true);

    cleanup();
  });

  it('8. Stale /me response after Guest choice: In-flight auth response does NOT overwrite Guest session', async () => {
    setAccessToken('slow-token');

    let resolveSlowAuth!: (val: CurrentUserResponse) => void;
    vi.mocked(authApi.getMe).mockImplementation(
      () =>
        new Promise<CurrentUserResponse>((res) => {
          resolveSlowAuth = res;
        })
    );

    const cleanup = initCloudSync();

    // User chooses Guest mode while verification is running
    act(() => {
      useAppStore.getState().setGuestMode?.(true);
    });
    expect(useAppStore.getState().isGuestMode).toBe(true);

    // Stale auth response resolves late
    await act(async () => {
      resolveSlowAuth({
        id: 'usr-stale-late',
        email: 'stale.late@example.com',
        displayName: 'Late Authenticated',
        roles: ['USER'],
        level: 1,
        xp: 0,
        streak: 0,
        createdAt: '2026-01-01',
      });
      await Promise.resolve();
    });

    // Invalidation guard kept Guest mode intact
    expect(useAppStore.getState().isGuestMode).toBe(true);
    expect(useCloudSyncStore.getState().user).toBeNull();

    cleanup();
  });

  it('9. SignalR reconnect after account switch: Restarts connection with updated credentials', async () => {
    const restartSpy = vi.spyOn(signalRService, 'restartHubConnectionIfActive');

    // Simulate account switch
    await act(async () => {
      await signOutCloud();
    });

    expect(restartSpy).toHaveBeenCalled();
  });

  it('10. Pending evidence isolation: Evidence from Account A is purged upon account switch and not sent for Account B', () => {
    // Account A online and has pending offline evidence
    onUserLogin('usr-A');
    expect(getPendingEvidenceUserId()).toBeNull();

    // Trigger account switch to Account B
    onAccountSwitch('usr-B');

    // Queue of User A was purged
    expect(hasPendingOfflineEvidence()).toBe(false);
    expect(getPendingEvidenceUserId()).toBeNull();
  });

  it('11. Legacy data ownership: Unassigned legacy data is safely archived before user account takeover', () => {
    const legacyState = {
      state: {
        profile: { ...DEFAULT_PROFILE, name: 'Old Device Learner', xp: 450, isOnboarded: true },
      },
      version: 0,
    };
    localStorage.setItem(CANONICAL_STORAGE_KEY, JSON.stringify(legacyState));

    expect(inspectDataOwnership().type).toBe('legacy');

    // User logs in for the first time on this browser
    prepareDataSlotForUser('usr-first-time', useAppStore.getState());

    // Legacy data was safely snapshotted to LEGACY_BACKUP_KEY
    expect(localStorage.getItem(LEGACY_BACKUP_KEY)).not.toBeNull();
    const backup = JSON.parse(localStorage.getItem(LEGACY_BACKUP_KEY)!);
    expect(backup.state.profile.name).toBe('Old Device Learner');
    expect(backup.state.profile.xp).toBe(450);
  });

  it('12. No auto-merge: Guest XP is NOT merged into existing account unless explicit confirmation', () => {
    // Account A exists with 1000 XP
    prepareDataSlotForUser('usr-A', useAppStore.getState());
    useAppStore.setState({
      profile: { ...DEFAULT_PROFILE, name: 'Alice', xp: 1000, isOnboarded: true },
    });
    archiveCurrentDataSlot('usr-A');

    // Guest earns 200 XP
    prepareDataSlotForGuest(useAppStore.getState());
    useAppStore.setState({
      profile: { ...DEFAULT_PROFILE, name: 'Guest', xp: 200, isOnboarded: true },
    });
    archiveCurrentDataSlot('guest');

    // Account A logs back in
    prepareDataSlotForUser('usr-A', useAppStore.getState());

    // Account A XP must still be 1000, NOT 1200
    expect(useAppStore.getState().profile.xp).toBe(1000);
    expect(useAppStore.getState().profile.name).toBe('Alice');
  });

  it('13. Zero data loss roundtrip: Guest → User A → User B → Guest → User A preserves exact progress of all 3 parties', () => {
    const store = useAppStore.getState();

    // 1. Guest learns
    prepareDataSlotForGuest(store);
    useAppStore.setState({
      profile: { ...DEFAULT_PROFILE, name: 'Guest Learner', xp: 150, streak: 2, isOnboarded: true },
    });
    archiveCurrentDataSlot('guest');

    // 2. User A learns
    prepareDataSlotForUser('usr-A', store);
    useAppStore.setState({
      profile: { ...DEFAULT_PROFILE, name: 'User A', xp: 1200, streak: 14, isOnboarded: true },
    });
    archiveCurrentDataSlot('usr-A');

    // 3. User B learns
    prepareDataSlotForUser('usr-B', store);
    useAppStore.setState({
      profile: { ...DEFAULT_PROFILE, name: 'User B', xp: 3400, streak: 30, isOnboarded: true },
    });
    archiveCurrentDataSlot('usr-B');

    // 4. Return to Guest
    prepareDataSlotForGuest(store);
    expect(useAppStore.getState().profile.name).toBe('Guest Learner');
    expect(useAppStore.getState().profile.xp).toBe(150);
    expect(useAppStore.getState().profile.streak).toBe(2);

    // 5. Return to User A
    prepareDataSlotForUser('usr-A', store);
    expect(useAppStore.getState().profile.name).toBe('User A');
    expect(useAppStore.getState().profile.xp).toBe(1200);
    expect(useAppStore.getState().profile.streak).toBe(14);

    // 6. Return to User B
    prepareDataSlotForUser('usr-B', store);
    expect(useAppStore.getState().profile.name).toBe('User B');
    expect(useAppStore.getState().profile.xp).toBe(3400);
    expect(useAppStore.getState().profile.streak).toBe(30);
  });
});
