// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { supabase } from '../../lib/supabaseClient';
import {
  useCloudSyncStore,
  pushLocalToCloud,
  setActiveSyncedUserId,
} from '../cloudSyncService';
import {
  startActiveSession,
  recordInteraction,
  pauseActiveSession,
  resumeActiveSession,
  endActiveSession,
  checkpointActiveSession,
  getActiveSessionStatus,
  deriveActiveLearningMinutes,
  getAllActiveSessions,
  getStoredActiveSessions,
  isWhitelistedModule,
  tabToActiveLearningModule,
  resetActiveSessionForTesting,
  MAX_CONTINUOUS_CHUNK_SECONDS,
  type ActiveSessionRecord,
} from '../activeLearningTimeService';
import {
  deriveLeaderboardLearningMetrics,
  syncDerivedLearningMetrics,
} from '../leaderboardLearningMetrics';
import {
  getAuthoritativeVietnamWeekId,
  getVietnamWeekStart,
  getVietnamWeekEnd,
} from '../leaderboardService';
import { useAppStore } from '../../store/useAppStore';

describe('PHASE 7 — Active Learning Minutes Leaderboard Pipeline', () => {
  const testUserId = '77777777-7777-4777-8777-777777777777';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetActiveSessionForTesting();
    setActiveSyncedUserId(null);
    useAppStore.getState().resetToDefault();
    useCloudSyncStore.setState({
      user: { id: testUserId, email: 'active_time@example.com' } as any,
      userId: testUserId,
      userEmail: 'active_time@example.com',
      session: null,
      isOnline: true,
      status: 'idle',
      errorMessage: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to simulate steady active interactions within a session
  function simulateActiveMinutes(nowStart: number, minutes: number): number {
    let t = nowStart;
    const ticks = Math.round((minutes * 60) / 20); // Interaction every 20 seconds
    for (let i = 0; i < ticks; i++) {
      t += 20_000;
      recordInteraction(t);
    }
    return t;
  }

  // ==========================================================================
  // 1. ACTIVE LEARNING CHUNKS & METRIC DERIVATION
  // ==========================================================================
  describe('1. Active Learning Chunk & Metric Derivation', () => {
    it('Active learning chunk in whitelisted module increases active_minutes', () => {
      const startTime = Date.now();
      const sessionId = startActiveSession('flashcard', 'test_chunk_1', startTime);
      expect(sessionId).toBe('test_chunk_1');

      // User interacts every 20 seconds for 15 minutes (900 seconds)
      const endTime = simulateActiveMinutes(startTime, 15);

      const record = endActiveSession(endTime);
      expect(record).not.toBeNull();
      expect(record!.activeSeconds).toBe(900); // 15 mins

      const result = deriveActiveLearningMinutes();
      expect(result.totalActiveMinutes).toBe(15);
      expect(result.byModule.flashcard).toBe(15);
      expect(result.isEligible).toBe(true);
    });

    it('Live ongoing session is included in deriveActiveLearningMinutes without waiting for endActiveSession', () => {
      const startTime = Date.now();
      startActiveSession('toeic', 'live_ongoing_session', startTime);

      // 10 minutes of active interaction
      const currentTime = simulateActiveMinutes(startTime, 10);

      // Session is still active (not ended)
      const status = getActiveSessionStatus(currentTime);
      expect(status.isActive).toBe(true);

      // getAllActiveSessions includes ongoing session snapshot
      const all = getAllActiveSessions(currentTime);
      expect(all.some((s) => s.sessionId === 'live_ongoing_session')).toBe(true);

      const result = deriveActiveLearningMinutes(all);
      expect(result.totalActiveMinutes).toBe(10);
      expect(result.byModule.toeic).toBe(10);
    });

    it('Strictly bounds continuous chunk at maximum 30 minutes (1800s)', () => {
      const startTime = Date.now();
      startActiveSession('four_skills', 'test_cap_session', startTime);

      // Simulate 2 hours of continuous interaction (ticks every 30s)
      let currentTime = startTime;
      for (let i = 0; i < 240; i++) {
        currentTime += 30_000;
        recordInteraction(currentTime);
      }

      const record = endActiveSession(currentTime);
      expect(record).not.toBeNull();
      expect(record!.activeSeconds).toBe(MAX_CONTINUOUS_CHUNK_SECONDS); // 1800s = 30 mins
    });
  });

  // ==========================================================================
  // 2. ANTI-IDLE & VISIBILITY/FOCUS SAFEGUARDS
  // ==========================================================================
  describe('2. Anti-Idle, Hidden Tab, and Blur Safeguards', () => {
    it('Idle tab: pauses active timer after 60s of inactivity and does NOT accumulate time', () => {
      const startTime = Date.now();
      startActiveSession('quiz', 'idle_session', startTime);

      // User interacts at 0s, 10s, 20s (total 20s active)
      recordInteraction(startTime + 10_000);
      recordInteraction(startTime + 20_000);

      // Then walks away: 10 minutes pass with zero interaction
      const idleTime = startTime + 620_000;
      const status = getActiveSessionStatus(idleTime);

      expect(status.isPaused).toBe(true);
      // Active time accumulated must be capped to <= 60s, NOT 10 minutes!
      expect(status.activeSeconds).toBeLessThanOrEqual(60);
    });

    it('Hidden tab & blur: instantly pauses timer when tab is hidden or window is blurred', () => {
      const startTime = Date.now();
      startActiveSession('ai_tutor', 'hidden_tab_session', startTime);

      // 30 seconds active
      recordInteraction(startTime + 30_000);

      // Tab hidden / blurred
      pauseActiveSession(startTime + 30_000);
      expect(getActiveSessionStatus(startTime + 30_000).isPaused).toBe(true);

      // 30 minutes pass in background
      const afterBackgroundTime = startTime + 1_830_000;
      const pausedStatus = getActiveSessionStatus(afterBackgroundTime);
      expect(pausedStatus.activeSeconds).toBe(30); // Unchanged

      // Returns to foreground and interacts
      resumeActiveSession(afterBackgroundTime);
      recordInteraction(afterBackgroundTime + 15_000);

      const resumedStatus = getActiveSessionStatus(afterBackgroundTime + 15_000);
      expect(resumedStatus.activeSeconds).toBe(45);
    });

    it('Unsupported and untracked modules (dashboard, settings, etc.) are strictly rejected', () => {
      expect(isWhitelistedModule('dashboard')).toBe(false);
      expect(isWhitelistedModule('settings')).toBe(false);
      expect(isWhitelistedModule('leaderboard')).toBe(false);
      expect(isWhitelistedModule('admin')).toBe(false);

      const rejectedSessionId = startActiveSession('dashboard' as any);
      expect(rejectedSessionId).toBe('');
      expect(getActiveSessionStatus().isActive).toBe(false);
    });
  });

  // ==========================================================================
  // 3. TAB NAVIGATION INTEGRATION
  // ==========================================================================
  describe('3. Tab Navigation Mapping', () => {
    it('tabToActiveLearningModule correctly maps application tabs and rejects non-learning tabs', () => {
      expect(tabToActiveLearningModule('flashcards')).toBe('flashcard');
      expect(tabToActiveLearningModule('four_skills')).toBe('four_skills');
      expect(tabToActiveLearningModule('toeic')).toBe('toeic');
      expect(tabToActiveLearningModule('quiz')).toBe('quiz');
      expect(tabToActiveLearningModule('arcade')).toBe('quiz');
      expect(tabToActiveLearningModule('pronunciation')).toBe('pronunciation');
      expect(tabToActiveLearningModule('tutor')).toBe('ai_tutor');

      // Non-learning tabs map to null
      expect(tabToActiveLearningModule('dashboard')).toBeNull();
      expect(tabToActiveLearningModule('leaderboard')).toBeNull();
      expect(tabToActiveLearningModule('vocabulary')).toBeNull();
      expect(tabToActiveLearningModule('dictionary')).toBeNull();
      expect(tabToActiveLearningModule('translator')).toBeNull();
      expect(tabToActiveLearningModule('admin')).toBeNull();
    });

    it('Switching between learning modules closes previous session and starts new module', () => {
      const t1 = Date.now();
      startActiveSession('flashcard', 's_flash', t1);
      recordInteraction(t1 + 20_000);

      // Switching to toeic closes flashcard session and starts toeic
      const t2 = t1 + 30_000;
      const newId = startActiveSession('toeic', 's_toeic', t2);

      expect(newId).toBe('s_toeic');
      const stored = getStoredActiveSessions();
      expect(stored.some((s) => s.sessionId === 's_flash')).toBe(true);

      const status = getActiveSessionStatus(t2);
      expect(status.module).toBe('toeic');
    });
  });

  // ==========================================================================
  // 4. CLOUD PERSISTENCE & RECONNECT SYNCHRONIZATION
  // ==========================================================================
  describe('4. Cloud Persistence & Reconnect Synchronization', () => {
    it('syncDerivedLearningMetrics sends derived activeMinutes and evidence.active_sessions to server', async () => {
      let rpcParams: any = null;
      vi.spyOn(supabase, 'rpc').mockImplementation(((name: string, params: any) => {
        if (name === 'sync_weekly_learning_metrics') {
          rpcParams = params;
          return Promise.resolve({
            data: { success: true, code: 'SYNCED_SUCCESS' },
            error: null,
          });
        }
        return Promise.resolve({ data: {}, error: null });
      }) as any);

      // Simulate a completed 20-minute active session
      const now = Date.now();
      startActiveSession('toeic', 'test_sync_sess', now);
      const endTime = simulateActiveMinutes(now, 20);
      endActiveSession(endTime);

      const res = await syncDerivedLearningMetrics(testUserId);

      expect(res.success).toBe(true);
      expect(rpcParams).toBeDefined();
      expect(rpcParams.p_active_minutes).toBe(20);
      expect(rpcParams.p_evidence.active_sessions).toBe(1);
    });

    it('Offline activity: stores sessions locally and reconnect sync pushes updated active minutes to cloud', async () => {
      // 1. Device is offline
      useCloudSyncStore.setState({ isOnline: false });

      const now = Date.now();
      startActiveSession('four_skills', 'offline_session', now);
      const endTime = simulateActiveMinutes(now, 15);
      endActiveSession(endTime);

      // Offline sync returns OFFLINE status safely
      const offlineRes = await syncDerivedLearningMetrics(testUserId);
      expect(offlineRes.success).toBe(false);
      expect(offlineRes.code).toBe('OFFLINE');

      // Sessions are safely preserved in LocalStorage
      const stored = getStoredActiveSessions();
      expect(stored.some((s) => s.sessionId === 'offline_session')).toBe(true);

      // 2. Device reconnects online
      useCloudSyncStore.setState({ isOnline: true });

      let pushedMinutes = 0;
      vi.spyOn(supabase, 'rpc').mockImplementation(((name: string, params: any) => {
        if (name === 'sync_weekly_learning_metrics') {
          pushedMinutes = params.p_active_minutes;
          return Promise.resolve({
            data: { success: true, code: 'SYNCED_SUCCESS' },
            error: null,
          });
        }
        return Promise.resolve({ data: {}, error: null });
      }) as any);

      // Trigger full push after reconnect
      await pushLocalToCloud(testUserId);

      expect(pushedMinutes).toBe(15);
    });

    it('Reload resilience: reload reads stored sessions and derives identical metrics without loss', () => {
      const now = Date.now();
      startActiveSession('pronunciation', 'reload_test_sess', now);
      const endTime = simulateActiveMinutes(now, 10);
      endActiveSession(endTime);

      const derivedBefore = deriveActiveLearningMinutes();

      // Simulate reload by deriving freshly from stored sessions
      const stored = getStoredActiveSessions();
      const derivedAfter = deriveActiveLearningMinutes(stored);

      expect(derivedAfter.totalActiveMinutes).toBe(derivedBefore.totalActiveMinutes);
      expect(derivedAfter.sessionCount).toBe(derivedBefore.sessionCount);
    });

    it('Week rollover: sessions from a prior week do not contaminate the current week active minutes', () => {
      const currentWeekStart = getVietnamWeekStart();
      const currentWeekEnd = getVietnamWeekEnd();

      // Session from 2 weeks ago
      const oldStartTime = new Date(currentWeekStart.getTime() - 14 * 86400 * 1000).toISOString();
      const oldEndTime = new Date(currentWeekStart.getTime() - 14 * 86400 * 1000 + 1200 * 1000).toISOString();

      const oldSession: ActiveSessionRecord = {
        sessionId: 'old_week_session',
        module: 'flashcard',
        startTime: oldStartTime,
        endTime: oldEndTime,
        activeSeconds: 1200, // 20 mins in past week
        interactionCount: 30,
        date: '2026-09-01',
      };

      // Current week session
      const currentSession: ActiveSessionRecord = {
        sessionId: 'current_week_session',
        module: 'flashcard',
        startTime: new Date(currentWeekStart.getTime() + 3600 * 1000).toISOString(),
        endTime: new Date(currentWeekStart.getTime() + 4200 * 1000).toISOString(),
        activeSeconds: 600, // 10 mins in current week
        interactionCount: 15,
        date: '2026-10-07',
      };

      const result = deriveActiveLearningMinutes([oldSession, currentSession], currentWeekStart, currentWeekEnd);

      // Only current week session (10 mins) should be counted!
      expect(result.totalActiveMinutes).toBe(10);
      expect(result.sessionCount).toBe(1);
    });
  });
});
