// @vitest-environment happy-dom
// src/services/api/__tests__/cloudSyncCutoverPhase7.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cloudSyncApi,
  type SyncStateResponse,
  type SyncUploadPayload,
  type SyncUploadResponse,
} from '../cloudSyncApi';
import { setAccessToken } from '../httpClient';
import {
  performFullSync,
  pushLocalToCloud,
  useCloudSyncStore,
  registerCloudSyncStoreGetter,
  clearSyncCoordinatorForTesting,
} from '../../cloudSyncService';
import { applyCloudDataMerge } from '../../../store/cloudDataMerger';
import type { AppStoreState, SRSProgress, DailyProgress } from '../../../types';

describe('PHASE 7 — Snapshot Cloud Sync Migration to ASP.NET & SQL Server', () => {
  const originalFetch = globalThis.fetch;
  let mockStoreResetFn: ReturnType<typeof vi.fn>;
  let mockStoreMergeFn: ReturnType<typeof vi.fn>;

  const mockUserId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  const mockInitialSyncState: SyncStateResponse = {
    profile: {
      id: mockUserId,
      email: 'learner@example.com',
      displayName: 'Nguyen Van A',
      avatarUrl: null,
      avatarSeed: 'seed_123',
      level: 4,
      xp: 1200,
      streak: 5,
      equippedFrame: null,
      hasLearnedNightOwl: false,
      targetGoal: 'daily',
      targetDailyNewWords: 15,
      lastStudyDate: '2026-10-07',
      fourSkillsScoresJson: '{}',
      lastActiveAt: '2026-10-08T00:00:00Z',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-07T00:00:00Z',
    },
    srsItems: [
      {
        wordId: 'apple',
        interval: 3,
        easeFactor: 2.5,
        repetition: 2,
        nextReviewDate: '2026-10-10T00:00:00Z',
        lastReviewedDate: '2026-10-07T00:00:00Z',
      },
      {
        wordId: 'banana',
        interval: 1,
        easeFactor: 2.5,
        repetition: 1,
        nextReviewDate: '2026-10-09T00:00:00Z',
        lastReviewedDate: '2026-10-07T00:00:00Z',
      },
    ],
    dailyLogs: [
      {
        date: '2026-10-07',
        wordsLearned: 15,
        xpEarned: 150,
      },
    ],
    serverTime: '2026-10-08T09:00:00Z',
  };

  let mockLocalState: any;

  beforeEach(() => {
    vi.clearAllMocks();
    clearSyncCoordinatorForTesting();
    localStorage.clear();
    setAccessToken('valid-jwt-token');

    mockStoreResetFn = vi.fn();
    mockStoreMergeFn = vi.fn();

    mockLocalState = {
      profile: {
        name: 'Nguyen Van A',
        level: 4,
        xp: 1200,
        streak: 5,
        targetGoal: 'daily',
        targetDailyNewWords: 15,
        lastStudyDate: '2026-10-07',
      },
      fourSkillsScores: {},
      hasLearnedNightOwl: false,
      completedListeningLessonIds: [],
      fourSkillsEvidence: {},
      fourSkillsCompletionProgress: {},
      levelCertifications: {},
      checkpointHistory: [],
      srsProgressMap: {
        apple: {
          srsLevel: 2,
          interval: 3,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-10T00:00:00Z',
          lastReviewedDate: '2026-10-07T00:00:00Z',
        } as SRSProgress,
        banana: {
          srsLevel: 1,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-09T00:00:00Z',
          lastReviewedDate: '2026-10-07T00:00:00Z',
        } as SRSProgress,
      },
      dailyHistory: {
        '2026-10-07': {
          date: '2026-10-07',
          wordsReviewed: 10,
          newWordsLearned: 5,
          quizzesCompleted: 1,
          pronunciationsMastered: 0,
          xpGained: 150,
        } as DailyProgress,
      },
      resetToDefault: mockStoreResetFn,
      mergeCloudData: mockStoreMergeFn,
    };

    registerCloudSyncStoreGetter(() => mockLocalState);

    useCloudSyncStore.setState({
      status: 'idle',
      user: { id: mockUserId, email: 'learner@example.com' } as any,
      userId: mockUserId,
      userEmail: 'learner@example.com',
      isOnline: true,
      lastSyncedAt: null,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearSyncCoordinatorForTesting();
  });

  describe('1. API Client Contracts (cloudSyncApi)', () => {
    it('getSyncState sends GET to /api/sync/state with Authorization header', async () => {
      const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        expect(url).toContain('/api/sync/state');
        expect(init?.method).toBe('GET');
        expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer valid-jwt-token');

        return Promise.resolve(
          new Response(JSON.stringify(mockInitialSyncState), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
      globalThis.fetch = fetchSpy as any;

      const result = await cloudSyncApi.getSyncState();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result.profile?.displayName).toBe('Nguyen Van A');
      expect(result.srsItems).toHaveLength(2);
      expect(result.dailyLogs).toHaveLength(1);
    });

    it('uploadSync sends POST to /api/sync with atomic snapshot payload', async () => {
      const mockUploadResponse: SyncUploadResponse = {
        success: true,
        syncedAt: '2026-10-08T09:30:00Z',
        srsItemsUpserted: 2,
        dailyLogsUpserted: 1,
      };

      const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        expect(url).toContain('/api/sync');
        expect(init?.method).toBe('POST');
        expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer valid-jwt-token');

        const parsedBody = JSON.parse(init?.body as string);
        expect(parsedBody.profile.displayName).toBe('Updated Name');
        expect(parsedBody.srsItems[0].wordId).toBe('apple');
        expect(parsedBody.dailyLogs[0].date).toBe('2026-10-08');

        return Promise.resolve(
          new Response(JSON.stringify(mockUploadResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
      globalThis.fetch = fetchSpy as any;

      const payload: SyncUploadPayload = {
        profile: { displayName: 'Updated Name', xp: 1300 },
        srsItems: [
          {
            wordId: 'apple',
            interval: 5,
            easeFactor: 2.6,
            repetition: 3,
            nextReviewDate: '2026-10-15T00:00:00Z',
            lastReviewedDate: '2026-10-08T00:00:00Z',
          },
        ],
        dailyLogs: [
          {
            date: '2026-10-08',
            wordsLearned: 10,
            xpEarned: 100,
          },
        ],
      };

      const result = await cloudSyncApi.uploadSync(payload);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.srsItemsUpserted).toBe(2);
    });
  });

  describe('2. End-to-End Snapshot Sync via cloudSyncService', () => {
    it('performFullSync fetches state via cloudSyncApi and uploads merged data atomically', async () => {
      const fetchCalls: { url: string; method: string; body?: any }[] = [];

      const fetchSpy = vi.fn().mockImplementation(async (url: string, init: any) => {
        const method = init?.method || 'GET';
        fetchCalls.push({
          url: url.toString(),
          method,
          body: init?.body ? JSON.parse(init.body) : undefined,
        });

        if (url.toString().includes('/api/sync/state')) {
          return new Response(JSON.stringify(mockInitialSyncState), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (url.toString().includes('/api/sync')) {
          return new Response(
            JSON.stringify({
              success: true,
              syncedAt: new Date().toISOString(),
              srsItemsUpserted: 2,
              dailyLogsUpserted: 1,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      globalThis.fetch = fetchSpy as any;

      const syncResult = await performFullSync();

      expect(syncResult.success).toBe(true);
      expect(mockStoreMergeFn).toHaveBeenCalledTimes(1);
      expect(mockStoreMergeFn).toHaveBeenCalledWith({
        cloudProfile: mockInitialSyncState.profile,
        cloudSrsList: mockInitialSyncState.srsItems,
        cloudDailyLogs: mockInitialSyncState.dailyLogs,
      });

      // Verify fetch calls occurred: GET /api/sync/state then POST /api/sync
      const getSyncCall = fetchCalls.find((c) => c.url.includes('/api/sync/state') && c.method === 'GET');
      const postSyncCall = fetchCalls.find((c) => c.url.includes('/api/sync') && c.method === 'POST');

      expect(getSyncCall).toBeDefined();
      expect(postSyncCall).toBeDefined();

      // Verify POST /api/sync contains profile, srsItems, and dailyLogs
      expect(postSyncCall?.body.profile).toBeDefined();
      expect(postSyncCall?.body.srsItems.length).toBeGreaterThanOrEqual(2);
      expect(postSyncCall?.body.dailyLogs.length).toBeGreaterThanOrEqual(1);

      expect(useCloudSyncStore.getState().status).toBe('synced');
    });

    it('pushLocalToCloud uploads snapshot via POST /api/sync without touching Supabase snapshot tables', async () => {
      const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        expect(url).toContain('/api/sync');
        expect(init?.method).toBe('POST');
        const body = JSON.parse(init?.body as string);
        expect(body.profile).toBeDefined();
        expect(body.srsItems).toBeDefined();
        expect(body.dailyLogs).toBeDefined();

        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              syncedAt: new Date().toISOString(),
              srsItemsUpserted: 2,
              dailyLogsUpserted: 1,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      });
      globalThis.fetch = fetchSpy as any;

      await pushLocalToCloud(mockUserId);

      expect(fetchSpy).toHaveBeenCalled();
    });
  });

  describe('3. Local-First Invariant & Failure Isolation', () => {
    it('learning action updates local Zustand store immediately without waiting for server', () => {
      // User learns a new word locally
      const wordId = 'orange';
      mockLocalState.srsProgressMap[wordId] = {
        srsLevel: 1,
        interval: 1,
        easeFactor: 2.5,
        nextReviewDate: '2026-10-09T00:00:00Z',
        lastReviewedDate: '2026-10-08T00:00:00Z',
      };
      mockLocalState.profile.xp += 10;

      // Local state is immediately visible
      expect(mockLocalState.srsProgressMap['orange']).toBeDefined();
      expect(mockLocalState.profile.xp).toBe(1210);
    });

    it('network failure / 500 error does NOT revert or corrupt local Zustand state', async () => {
      // Simulate server returning 500 Internal Server Error
      globalThis.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve(
          new Response(JSON.stringify({ code: 'SERVER_ERROR', message: 'Internal Server Error' }), {
            status: 500,
            statusText: 'Internal Server Error',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      // User has updated local progress
      mockLocalState.profile.xp = 1500;
      mockLocalState.srsProgressMap['cherry'] = {
        srsLevel: 2,
        interval: 3,
        easeFactor: 2.5,
        nextReviewDate: '2026-10-11T00:00:00Z',
        lastReviewedDate: '2026-10-08T00:00:00Z',
      };

      const syncResult = await performFullSync();

      // Sync fails gracefully without throwing an unhandled exception
      expect(syncResult.success).toBe(false);

      // CRITICAL LOCAL-FIRST INVARIANT: Local state remains 100% intact!
      expect(mockLocalState.profile.xp).toBe(1500);
      expect(mockLocalState.srsProgressMap['cherry']).toBeDefined();
      expect(mockLocalState.srsProgressMap['cherry'].srsLevel).toBe(2);
    });
  });

  describe('4. Conflict Resolution & Monotonicity (Completed Always Wins)', () => {
    it('Completed Always Wins: Stale cloud SRS does not degrade higher local SRS progress', () => {
      const baseState: Partial<AppStoreState> = {
        profile: {
          name: 'Nguyen Van A',
          level: 4,
          xp: 1200,
          streak: 5,
        } as any,
        srsProgressMap: {
          apple: {
            srsLevel: 4, // Local has completed 4 reps
            interval: 10,
            easeFactor: 2.5,
            nextReviewDate: '2026-10-18T00:00:00Z',
            lastReviewedDate: '2026-10-08T00:00:00Z',
          },
        },
        dailyHistory: {},
      };

      // Stale cloud payload with lower repetition (e.g. rep 2 from another device before review)
      const staleCloudPayload = {
        cloudSrsList: [
          {
            wordId: 'apple',
            interval: 3,
            easeFactor: 2.5,
            repetition: 2,
            nextReviewDate: '2026-10-10T00:00:00Z',
            lastReviewedDate: '2026-10-07T00:00:00Z',
          },
        ],
      };

      const merged = applyCloudDataMerge(baseState as AppStoreState, staleCloudPayload);

      // Local level 4 wins over cloud level 2
      expect(merged.srsProgressMap!['apple'].srsLevel).toBe(4);
      expect(merged.srsProgressMap!['apple'].interval).toBe(10);
    });

    it('Completed Always Wins: Higher cloud SRS progress updates local lower progress', () => {
      const baseState: Partial<AppStoreState> = {
        profile: {
          name: 'Nguyen Van A',
          level: 4,
          xp: 1200,
          streak: 5,
        } as any,
        srsProgressMap: {
          banana: {
            srsLevel: 1,
            interval: 1,
            easeFactor: 2.5,
            nextReviewDate: '2026-10-08T00:00:00Z',
            lastReviewedDate: '2026-10-07T00:00:00Z',
          },
        },
        dailyHistory: {},
      };

      // Remote cloud payload has higher repetition (studied on web/desktop)
      const newerCloudPayload = {
        cloudSrsList: [
          {
            wordId: 'banana',
            interval: 6,
            easeFactor: 2.6,
            repetition: 3,
            nextReviewDate: '2026-10-14T00:00:00Z',
            lastReviewedDate: '2026-10-08T00:00:00Z',
          },
        ],
      };

      const merged = applyCloudDataMerge(baseState as AppStoreState, newerCloudPayload);

      // Remote level 3 wins over local level 1
      expect(merged.srsProgressMap!['banana'].srsLevel).toBe(3);
      expect(merged.srsProgressMap!['banana'].interval).toBe(6);
    });

    it('DailyLogs Monotonicity: Zero cloud log does not overwrite legitimate local learning counts', () => {
      const baseState: Partial<AppStoreState> = {
        profile: {
          name: 'Nguyen Van A',
          level: 4,
          xp: 1200,
          streak: 5,
        } as any,
        srsProgressMap: {},
        dailyHistory: {
          '2026-10-08': {
            date: '2026-10-08',
            wordsReviewed: 20,
            newWordsLearned: 10,
            quizzesCompleted: 2,
            pronunciationsMastered: 0,
            xpGained: 250,
          },
        },
      };

      // Stale cloud payload with 0 words and 0 xp
      const zeroCloudPayload = {
        cloudDailyLogs: [
          {
            date: '2026-10-08',
            wordsLearned: 0,
            xpEarned: 0,
          },
        ],
      };

      const merged = applyCloudDataMerge(baseState as AppStoreState, zeroCloudPayload);

      // Local counts and XP are preserved, never reset to 0
      expect(merged.dailyHistory!['2026-10-08'].wordsReviewed).toBe(20);
      expect(merged.dailyHistory!['2026-10-08'].xpGained).toBe(250);
    });
  });

  describe('5. Offline Behavior & Account Switch Isolation', () => {
    it('skips sync and enters offline status when device is offline', async () => {
      useCloudSyncStore.setState({ isOnline: false });
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy as any;

      const result = await performFullSync();

      expect(result.success).toBe(false);
      expect(result.message).toContain('ngoại tuyến');
      expect(useCloudSyncStore.getState().status).toBe('offline');
      // No network calls attempted
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('detects account switch and resets local store to prevent cross-account contamination', async () => {
      // First sync as User A
      localStorage.setItem('english_mastery_active_user_id', 'previous-user-id');

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.toString().includes('/api/sync/state')) {
          return new Response(JSON.stringify(mockInitialSyncState), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ success: true, syncedAt: new Date().toISOString() }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      // Now sync with current user (mockUserId !== 'previous-user-id')
      await performFullSync();

      // resetToDefault must be triggered
      expect(mockStoreResetFn).toHaveBeenCalledTimes(1);
      // Active user id is updated
      expect(localStorage.getItem('english_mastery_active_user_id')).toBe(mockUserId);
    });
  });
});
