// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { App } from '../../App';
import { useAppStore } from '../../store/useAppStore';
import { useCloudSyncStore, initCloudSync, signOutCloud } from '../../services/cloudSyncService';
import { authApi } from '../../services/api/authApi';
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
import { exportStoreBackup, importStoreBackup } from '../../store/backupDataService';

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

vi.mock('../../services/learningEvidenceTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/learningEvidenceTransport')>();
  return {
    ...actual,
    scheduleLearningEvidenceSubmission: vi.fn(),
  };
});

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

describe('PHASE 5: Legacy Learning Data Preservation Test Suite', () => {
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

  it('1. Legacy XP and learning history exist safely in storage after Welcome view mounts', async () => {
    // Populate realistic legacy learning data in english_mastery_storage_v2 before app mounts
    const legacyState = {
      state: {
        profile: {
          ...DEFAULT_PROFILE,
          name: 'Học viên Kì Cựu',
          level: 4,
          xp: 850,
          streak: 12,
          isOnboarded: true,
        },
        srsProgressMap: {
          w_01: { srsLevel: 3, interval: 6, easeFactor: 2.5, nextReviewDate: '2026-10-15T00:00:00.000Z' },
        },
        dailyHistory: {
          '2026-10-08': { wordsReviewed: 15, newWordsLearned: 5, quizzesCompleted: 2, pronunciationsMastered: 1, xpGained: 120, date: '2026-10-08' },
        },
      },
      version: 0,
    };
    localStorage.setItem(CANONICAL_STORAGE_KEY, JSON.stringify(legacyState));

    useAppStore.setState({
      profile: legacyState.state.profile,
      srsProgressMap: legacyState.state.srsProgressMap,
      dailyHistory: legacyState.state.dailyHistory,
    });

    const { unmount } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    // App is on Welcome view because no active auth session or guest choice
    expect(screen.getByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeDefined();

    // Verify: Canonical storage was NOT deleted, cleared, or overwritten with empty default!
    const persistedRaw = localStorage.getItem(CANONICAL_STORAGE_KEY);
    expect(persistedRaw).not.toBeNull();
    const parsed = JSON.parse(persistedRaw!);
    expect(parsed.state.profile.xp).toBe(850);
    expect(parsed.state.profile.streak).toBe(12);
    expect(parsed.state.srsProgressMap.w_01.srsLevel).toBe(3);

    unmount();
  });

  it('2. Legacy data does NOT automatically bypass Welcome gate to Dashboard', async () => {
    // Legacy user with significant XP and completed onboarding
    useAppStore.setState({
      isHydrated: true,
      isGuestMode: false,
      isLoggedOut: false,
      profile: {
        ...DEFAULT_PROFILE,
        name: 'Nguyễn Văn An',
        level: 5,
        xp: 1500,
        streak: 20,
        isOnboarded: true,
      },
    });

    const { unmount } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    // Must be gated on Welcome; Dashboard button/view must NOT appear
    expect(screen.getByRole('heading', { name: /khởi đầu hành trình học tập/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /tổng quan/i })).toBeNull();

    unmount();
  });

  it('3. Guest uses safely identified legacy data after explicit user click', async () => {
    // Unassigned legacy data (no account was ever logged in on this browser)
    const legacyState = {
      state: {
        profile: {
          ...DEFAULT_PROFILE,
          name: 'Lan Hương',
          level: 3,
          xp: 450,
          streak: 7,
          isOnboarded: true,
        },
        srsProgressMap: {
          w_hello: { srsLevel: 2, interval: 3, easeFactor: 2.5, nextReviewDate: '2026-10-12T00:00:00.000Z' },
        },
      },
      version: 0,
    };
    localStorage.setItem(CANONICAL_STORAGE_KEY, JSON.stringify(legacyState));

    useAppStore.setState({
      profile: legacyState.state.profile,
      srsProgressMap: legacyState.state.srsProgressMap,
    });

    expect(inspectDataOwnership().type).toBe('legacy');

    const { unmount } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    // User explicitly clicks Guest button
    const guestBtn = screen.getByRole('button', { name: /tiếp tục học mà không cần tài khoản/i });
    await act(async () => {
      fireEvent.click(guestBtn);
    });

    // Enters Dashboard with legacy data intact and safely scoped to Guest
    expect(screen.getByRole('button', { name: /tổng quan/i })).toBeDefined();
    expect(screen.getAllByText(/Lan Hương/i).length).toBeGreaterThan(0);
    expect(inspectDataOwnership().type).toBe('guest');

    // Legacy backup was archived safely
    expect(localStorage.getItem(LEGACY_BACKUP_KEY)).not.toBeNull();

    unmount();
  });

  it('4. Account-specific data is strictly isolated and NEVER leaked to Guest', async () => {
    // Account A was logged in
    const accountAData = {
      state: {
        profile: {
          ...DEFAULT_PROFILE,
          name: 'Teacher Hoàng (Private Account)',
          level: 10,
          xp: 9999,
          streak: 50,
          isOnboarded: true,
        },
        mistakeBank: {
          mistake_secret: { word: 'confidential', mistakeCount: 3, wrongCount: 3 },
        },
      },
      version: 0,
    };
    localStorage.setItem(CANONICAL_STORAGE_KEY, JSON.stringify(accountAData));
    localStorage.setItem(ACTIVE_USER_ID_KEY, 'usr-account-A');
    localStorage.setItem(DATA_OWNER_KEY, 'usr-account-A');

    useAppStore.setState({
      profile: accountAData.state.profile,
      mistakeBank: accountAData.state.mistakeBank as any,
    });

    expect(inspectDataOwnership().type).toBe('authenticated');
    expect(inspectDataOwnership().ownerId).toBe('usr-account-A');

    const { unmount } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    // User is on Welcome. Now clicks "Tiếp tục học mà không cần tài khoản"
    const guestBtn = screen.getByRole('button', { name: /tiếp tục học mà không cần tài khoản/i });
    await act(async () => {
      fireEvent.click(guestBtn);
    });

    // Guest enters clean onboarding (not Account A's private dashboard)
    expect(screen.queryByText(/Teacher Hoàng \(Private Account\)/i)).toBeNull();
    expect(useAppStore.getState().profile.name).not.toBe('Teacher Hoàng (Private Account)');
    expect(useAppStore.getState().profile.xp).toBe(0);

    // Account A's data was preserved in its user slot!
    const accountASlot = localStorage.getItem(`${USER_SLOT_PREFIX}usr-account-A`);
    expect(accountASlot).not.toBeNull();
    const parsedA = JSON.parse(accountASlot!);
    expect(parsedA.state.profile.name).toBe('Teacher Hoàng (Private Account)');
    expect(parsedA.state.profile.xp).toBe(9999);

    unmount();
  });

  it('5. Account Switch: Preserves both users data across switches without loss', async () => {
    // Prepare Account A
    prepareDataSlotForUser('usr-A', useAppStore.getState());
    useAppStore.setState({
      profile: { ...DEFAULT_PROFILE, name: 'Alice', xp: 500, isOnboarded: true },
    });
    archiveCurrentDataSlot('usr-A');

    // Prepare Account B
    prepareDataSlotForUser('usr-B', useAppStore.getState());
    useAppStore.setState({
      profile: { ...DEFAULT_PROFILE, name: 'Bob', xp: 800, isOnboarded: true },
    });
    archiveCurrentDataSlot('usr-B');

    // Switch back to Account A
    prepareDataSlotForUser('usr-A', useAppStore.getState());
    expect(useAppStore.getState().profile.name).toBe('Alice');
    expect(useAppStore.getState().profile.xp).toBe(500);

    // Switch back to Account B
    prepareDataSlotForUser('usr-B', useAppStore.getState());
    expect(useAppStore.getState().profile.name).toBe('Bob');
    expect(useAppStore.getState().profile.xp).toBe(800);
  });

  it('6. Invalid / Missing ownership does not auto-merge with new account', async () => {
    // Ambiguous legacy data
    const ambiguousData = {
      state: {
        profile: { ...DEFAULT_PROFILE, name: 'Unknown Learner', xp: 300, isOnboarded: true },
      },
      version: 0,
    };
    localStorage.setItem(CANONICAL_STORAGE_KEY, JSON.stringify(ambiguousData));

    // When User C logs in, legacy data is archived first, not destructively overwritten
    prepareDataSlotForUser('usr-C', useAppStore.getState());

    expect(localStorage.getItem(LEGACY_BACKUP_KEY)).not.toBeNull();
    const legacyBackup = JSON.parse(localStorage.getItem(LEGACY_BACKUP_KEY)!);
    expect(legacyBackup.state.profile.name).toBe('Unknown Learner');
    expect(useAppStore.getState().profile.name).not.toBe('Unknown Learner');
  });

  it('7. Rehydration safety: Network failure does not wipe local progress', async () => {
    useAppStore.setState({
      profile: { ...DEFAULT_PROFILE, name: 'Offline Hero', xp: 1200, streak: 15, isOnboarded: true },
      isHydrated: true,
      isGuestMode: true,
    });

    // Simulate backend network outage (503)
    vi.mocked(authApi.getMe).mockRejectedValue(new Error('Network error 503'));

    const cleanup = initCloudSync();

    await act(async () => {
      await Promise.resolve();
    });

    // Local data remains 100% intact
    expect(useAppStore.getState().profile.name).toBe('Offline Hero');
    expect(useAppStore.getState().profile.xp).toBe(1200);
    expect(useAppStore.getState().profile.streak).toBe(15);

    cleanup();
  });

  it('8. Idempotent slot archiving: Repeated archiving does not duplicate or corrupt data', () => {
    const rawState = {
      state: {
        profile: { ...DEFAULT_PROFILE, name: 'Test Learner', xp: 200, isOnboarded: true },
        recentReviewEvents: [{ id: 'evt-1', rating: 'good', timestamp: '2026-10-09' }],
      },
      version: 0,
    };
    localStorage.setItem(CANONICAL_STORAGE_KEY, JSON.stringify(rawState));

    // Archive 3 times in succession
    archiveCurrentDataSlot('usr-test');
    archiveCurrentDataSlot('usr-test');
    archiveCurrentDataSlot('usr-test');

    const slot = localStorage.getItem(`${USER_SLOT_PREFIX}usr-test`);
    expect(slot).not.toBeNull();
    const parsed = JSON.parse(slot!);
    expect(parsed.state.profile.xp).toBe(200);
    expect(parsed.state.recentReviewEvents.length).toBe(1);
  });

  it('9. No duplicate XP, FSRS, or reviews during save and restore', () => {
    const store = useAppStore.getState();
    const initialReview = { id: 'rev-01', rating: 'easy', timestamp: '2026-10-09' };

    useAppStore.setState({
      profile: { ...DEFAULT_PROFILE, xp: 400, level: 2, isOnboarded: true },
      recentReviewEvents: [initialReview as any],
    });

    archiveCurrentDataSlot('guest');

    // Clear and restore
    prepareDataSlotForGuest(useAppStore.getState());

    expect(useAppStore.getState().profile.xp).toBe(400);
    expect(useAppStore.getState().recentReviewEvents.length).toBe(1);
  });

  it('10. Backup & Restore integrity: Export contains NO tokens, Import restores verified domain models', () => {
    setAccessToken('sensitive-jwt-token-should-never-be-exported');

    const testState = {
      ...useAppStore.getState(),
      profile: { ...DEFAULT_PROFILE, name: 'Export Test', xp: 650, isOnboarded: true },
      userCustomWords: [
        { id: 'cw-1', word: 'serendipity', meaning: 'may mắn bất ngờ', tag: 'Academic' as any, srsLevel: 1, nextReviewDate: '2026-10-10', interval: 1, easeFactor: 2.5, ipa: '' },
      ],
    };

    const exportedJson = exportStoreBackup(testState as any);

    // Security verify: JSON backup MUST NOT contain tokens
    expect(exportedJson).not.toContain('sensitive-jwt-token-should-never-be-exported');
    expect(exportedJson).not.toContain('access_token');
    expect(exportedJson).not.toContain('refreshToken');

    // Import verify
    const result = importStoreBackup(useAppStore.setState as any, exportedJson);
    expect(result.success).toBe(true);
    expect(useAppStore.getState().profile.name).toBe('Export Test');
    expect(useAppStore.getState().profile.xp).toBe(650);
    expect(useAppStore.getState().userCustomWords.length).toBe(1);
    expect(useAppStore.getState().userCustomWords[0].word).toBe('serendipity');
  });

  it('11. Reload and offline resilience: LocalStorage retains valid data across app unmount and remount', async () => {
    useAppStore.setState({
      profile: { ...DEFAULT_PROFILE, name: 'Persistent Learner', xp: 950, streak: 14, isOnboarded: true },
      isHydrated: true,
      isGuestMode: true,
    });

    const { unmount } = render(<App />);
    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    // Re-mount app
    const { unmount: remount } = render(<App />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(useAppStore.getState().profile.xp).toBe(950);
    expect(useAppStore.getState().profile.streak).toBe(14);

    remount();
  });

  it('12. Cross-origin awareness: Backup JSON enables seamless transport between origins without data loss', () => {
    // State created on origin A (e.g. localhost:5173)
    const originAState = {
      ...useAppStore.getState(),
      profile: { ...DEFAULT_PROFILE, name: 'Cross Origin Learner', xp: 1400, level: 5, isOnboarded: true },
      fourSkillsScores: {
        listening: [80, 85, 90],
        reading: [75, 80],
        speaking: [70],
        writing: [65],
      },
    };

    const portableBackup = exportStoreBackup(originAState as any);

    // Simulate switching to fresh origin B (e.g. localhost:5000 with empty localStorage)
    localStorage.clear();
    useAppStore.getState().resetToDefault();
    expect(useAppStore.getState().profile.xp).toBe(0);

    // Restore on origin B
    const restoreResult = importStoreBackup(useAppStore.setState as any, portableBackup);
    expect(restoreResult.success).toBe(true);
    expect(useAppStore.getState().profile.name).toBe('Cross Origin Learner');
    expect(useAppStore.getState().profile.xp).toBe(1400);
    expect(useAppStore.getState().fourSkillsScores.listening).toEqual([80, 85, 90]);
  });
});
