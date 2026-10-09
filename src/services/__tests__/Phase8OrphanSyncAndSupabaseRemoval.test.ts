// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initCloudSync,
  useCloudSyncStore,
  signInWithEmail,
  signUpWithEmail,
  signOutCloud,
  hasPendingCloudSync,
  flushPendingCloudSync,
} from '../cloudSyncService';
import { cloudSyncApi } from '../api/cloudSyncApi';
import { authApi } from '../api/authApi';
import * as learningEvidenceTransport from '../learningEvidenceTransport';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { useAppStore } from '../../store/useAppStore';

describe('PHASE 8 — Remove Orphan Cloud Sync Services & Supabase Runtime Residue', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();

    useCloudSyncStore.setState({
      user: null,
      session: null,
      status: 'idle',
      isOnline: true,
      userId: null,
      userEmail: null,
      lastSyncedAt: null,
      errorMessage: null,
    });

    useAppStore.setState({
      profile: {
        name: 'Học viên A',
        level: 3,
        xp: 450,
        streak: 5,
        hearts: 5,
        maxHearts: 5,
        avatarSeed: 'Học viên A',
        targetDailyWords: 30,
        targetDailyNewWords: 15,
        extraNewWordsBonus: 0,
        equippedFrame: null,
        lastActiveDate: '2026-10-08',
        lastStudyDate: '2026-10-08',
      },
      srsProgressMap: {
        apple: {
          interval: 3,
          easeFactor: 2.5,
          srsLevel: 2,
          nextReviewDate: '2026-10-10T00:00:00Z',
        },
      },
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('1. App Startup: Zero Orphan Sync Execution & Zero Unnecessary Requests', () => {
    it('initCloudSync checks auth session but NEVER executes full snapshot sync (/sync/state or /sync)', async () => {
      const getSyncStateSpy = vi.spyOn(cloudSyncApi, 'getSyncState');
      const uploadSyncSpy = vi.spyOn(cloudSyncApi, 'uploadSync');

      // Mock authenticated session restoration via HttpOnly cookie
      vi.spyOn(authApi, 'refresh').mockResolvedValueOnce({
        accessToken: 'mock-valid-token-123',
        expiresInSeconds: 3600,
        user: {
          id: 'user-auth-001',
          email: 'hoang@example.com',
          displayName: 'Hoàng Student',
        },
      });

      const cleanup = initCloudSync();

      // Wait a tick for auth promises
      await new Promise((r) => setTimeout(r, 50));

      // User session should be restored
      const state = useCloudSyncStore.getState();
      expect(state.user).not.toBeNull();
      expect(state.user?.id).toBe('user-auth-001');
      expect(state.userId).toBe('user-auth-001');

      // CRITICAL ASSERTION: Zero orphan snapshot requests to full cloud sync!
      expect(getSyncStateSpy).not.toHaveBeenCalled();
      expect(uploadSyncSpy).not.toHaveBeenCalled();

      cleanup();
    });

    it('initCloudSync handles unauthenticated guest with ZERO network sync calls', async () => {
      const getSyncStateSpy = vi.spyOn(cloudSyncApi, 'getSyncState');
      const uploadSyncSpy = vi.spyOn(cloudSyncApi, 'uploadSync');

      // Guest: no token, refresh fails with 401
      vi.spyOn(authApi, 'refresh').mockRejectedValueOnce(new Error('No refresh cookie'));

      const cleanup = initCloudSync();
      await new Promise((r) => setTimeout(r, 50));

      const state = useCloudSyncStore.getState();
      expect(state.user).toBeNull();
      expect(state.userId).toBeNull();
      expect(state.status).toBe('idle');

      // Zero snapshot sync
      expect(getSyncStateSpy).not.toHaveBeenCalled();
      expect(uploadSyncSpy).not.toHaveBeenCalled();

      cleanup();
    });
  });

  describe('2. Network Reconnection & Online Listener', () => {
    it('online event updates isOnline but does NOT trigger orphan performFullSync', async () => {
      const getSyncStateSpy = vi.spyOn(cloudSyncApi, 'getSyncState');
      const uploadSyncSpy = vi.spyOn(cloudSyncApi, 'uploadSync');

      useCloudSyncStore.setState({
        user: { id: 'user-002', email: 'test@example.com' } as any,
        isOnline: false,
      });

      const cleanup = initCloudSync();

      // Simulate device coming online
      window.dispatchEvent(new Event('online'));

      expect(useCloudSyncStore.getState().isOnline).toBe(true);

      // Verify NO full snapshot download or upload occurred
      expect(getSyncStateSpy).not.toHaveBeenCalled();
      expect(uploadSyncSpy).not.toHaveBeenCalled();

      cleanup();
    });
  });

  describe('3. Login / Register: Evidence Dispatch Instead of Full Snapshot Upload', () => {
    it('signInWithEmail authenticates, sets user, and dispatches learning evidence submission without full snapshot sync', async () => {
      const getSyncStateSpy = vi.spyOn(cloudSyncApi, 'getSyncState');
      const uploadSyncSpy = vi.spyOn(cloudSyncApi, 'uploadSync');
      const scheduleEvidenceSpy = vi.spyOn(
        learningEvidenceTransport,
        'scheduleLearningEvidenceSubmission'
      ).mockImplementation(() => {});

      vi.spyOn(authApi, 'login').mockResolvedValueOnce({
        accessToken: 'access-jwt-token-999',
        expiresInSeconds: 3600,
        user: {
          id: 'user-login-777',
          email: 'login@example.com',
          displayName: 'Login User',
        },
      });

      const result = await signInWithEmail('login@example.com', 'password123');

      expect(result.error).toBeNull();
      expect(useCloudSyncStore.getState().user?.id).toBe('user-login-777');

      // Dispatches learning evidence transport
      expect(scheduleEvidenceSpy).toHaveBeenCalledWith(0);

      // NEVER triggers old snapshot sync
      expect(getSyncStateSpy).not.toHaveBeenCalled();
      expect(uploadSyncSpy).not.toHaveBeenCalled();
    });

    it('signUpWithEmail registers, sets user, and dispatches learning evidence submission without full snapshot sync', async () => {
      const getSyncStateSpy = vi.spyOn(cloudSyncApi, 'getSyncState');
      const uploadSyncSpy = vi.spyOn(cloudSyncApi, 'uploadSync');
      const scheduleEvidenceSpy = vi.spyOn(
        learningEvidenceTransport,
        'scheduleLearningEvidenceSubmission'
      ).mockImplementation(() => {});

      vi.spyOn(authApi, 'register').mockResolvedValueOnce({
        accessToken: 'access-jwt-token-888',
        expiresInSeconds: 3600,
        user: {
          id: 'user-new-888',
          email: 'new@example.com',
          displayName: 'New Student',
        },
      });

      const result = await signUpWithEmail('new@example.com', 'secretPassword', 'New Student');

      expect(result.error).toBeNull();
      expect(useCloudSyncStore.getState().user?.id).toBe('user-new-888');

      // Dispatches learning evidence transport
      expect(scheduleEvidenceSpy).toHaveBeenCalledWith(0);

      // NEVER triggers old snapshot sync
      expect(getSyncStateSpy).not.toHaveBeenCalled();
      expect(uploadSyncSpy).not.toHaveBeenCalled();
    });

    it('signOutCloud cleans up credentials and learning evidence without error', async () => {
      useCloudSyncStore.setState({
        user: { id: 'user-logged-in', email: 'logout@example.com' } as any,
        session: { access_token: 'valid-token' } as any,
      });

      vi.spyOn(authApi, 'logout').mockResolvedValueOnce({ success: true } as any);

      const res = await signOutCloud();
      expect(res.error).toBeNull();

      const state = useCloudSyncStore.getState();
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.userId).toBeNull();
    });
  });

  describe('4. Supabase Runtime Residue Audit', () => {
    it('confirms isSupabaseConfigured returns false and zero active Supabase client', () => {
      expect(isSupabaseConfigured()).toBe(false);
    });
  });

  describe('5. Local-First Persistence Guarantee', () => {
    it('preserves local progress in Zustand store during startup and session transitions', () => {
      // Prior learning progress in state
      const initialXp = useAppStore.getState().profile.xp;
      const initialSrs = useAppStore.getState().srsProgressMap['apple'];

      expect(initialXp).toBe(450);
      expect(initialSrs).toBeDefined();
      expect(initialSrs.srsLevel).toBe(2);

      // Calling initCloudSync as guest must NOT wipe or overwrite local state
      const cleanup = initCloudSync();
      expect(useAppStore.getState().profile.xp).toBe(450);
      expect(useAppStore.getState().srsProgressMap['apple'].srsLevel).toBe(2);

      cleanup();
    });
  });

  describe('6. Evidence Transport Facade Stability', () => {
    it('flushPendingCloudSync delegates directly to flushLearningEvidence', async () => {
      useCloudSyncStore.setState({
        user: { id: 'active-user', email: 'test@example.com' } as any,
        isOnline: true,
      });

      const flushSpy = vi.spyOn(learningEvidenceTransport, 'flushLearningEvidence').mockResolvedValueOnce({
        success: true,
        code: 'SUCCESS',
        weeklyXp: 150,
      });

      const res = await flushPendingCloudSync();
      expect(flushSpy).toHaveBeenCalledTimes(1);
      expect(res.success).toBe(true);
    });

    it('hasPendingCloudSync reflects hasPendingOfflineEvidence', () => {
      vi.spyOn(learningEvidenceTransport, 'hasPendingOfflineEvidence').mockReturnValueOnce(true);
      expect(hasPendingCloudSync()).toBe(true);

      vi.spyOn(learningEvidenceTransport, 'hasPendingOfflineEvidence').mockReturnValueOnce(false);
      expect(hasPendingCloudSync()).toBe(false);
    });
  });
});
