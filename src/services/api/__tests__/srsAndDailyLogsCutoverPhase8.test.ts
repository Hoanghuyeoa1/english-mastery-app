// @vitest-environment happy-dom
// src/services/api/__tests__/srsAndDailyLogsCutoverPhase8.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { srsApi, type SrsProgressItemDto } from '../srsApi';
import { dailyLogApi, type DailyLogDto } from '../dailyLogApi';
import { setAccessToken } from '../httpClient';
import {
  pushLocalToCloud,
  useCloudSyncStore,
  registerCloudSyncStoreGetter,
  clearSyncCoordinatorForTesting,
} from '../../cloudSyncService';
import {
  resetAllUsersProgress,
  resetTargetUsersProgress,
} from '../../adminVocabService';
import type { SRSProgress, DailyProgress } from '../../../types';

describe('PHASE 8 — SRS Progress & Daily Logs Backend Migration', () => {
  const originalFetch = globalThis.fetch;
  const mockUserId = '11111111-2222-3333-4444-555555555555';

  beforeEach(() => {
    vi.clearAllMocks();
    clearSyncCoordinatorForTesting();
    localStorage.clear();
    setAccessToken('valid-jwt-token');

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

  describe('1. SRS API Client (srsApi)', () => {
    it('getSrsProgressList requests /api/srs with query params and Authorization header', async () => {
      const mockList: SrsProgressItemDto[] = [
        {
          wordId: 'resilience',
          interval: 5,
          easeFactor: 2.5,
          repetition: 3,
          algorithm: 'fsrs',
          stability: 5.2,
          difficulty: 3.1,
          state: 2,
          reps: 3,
          lapses: 0,
        },
      ];

      const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        expect(url).toContain('/api/srs?algorithm=fsrs&dueBefore=2026-10-15');
        expect(init?.method).toBe('GET');
        expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer valid-jwt-token');

        return Promise.resolve(
          new Response(JSON.stringify(mockList), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
      globalThis.fetch = fetchSpy as any;

      const result = await srsApi.getSrsProgressList({ algorithm: 'fsrs', dueBefore: '2026-10-15' });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0].wordId).toBe('resilience');
      expect(result[0].algorithm).toBe('fsrs');
      expect(result[0].stability).toBe(5.2);
    });

    it('getWordSrsProgress requests /api/srs/{wordId}', async () => {
      const mockItem: SrsProgressItemDto = {
        wordId: 'ephemeral',
        interval: 2,
        easeFactor: 2.36,
        repetition: 2,
        algorithm: 'sm2',
      };

      const fetchSpy = vi.fn().mockImplementation((url: string) => {
        expect(url).toContain('/api/srs/ephemeral');
        return Promise.resolve(
          new Response(JSON.stringify(mockItem), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
      globalThis.fetch = fetchSpy as any;

      const result = await srsApi.getWordSrsProgress('ephemeral');
      expect(result.wordId).toBe('ephemeral');
      expect(result.algorithm).toBe('sm2');
      expect(result.stability).toBeUndefined();
    });

    it('batchUpsertSrs posts batch items to /api/srs/batch', async () => {
      const items: SrsProgressItemDto[] = [
        { wordId: 'word1', interval: 1, easeFactor: 2.5, repetition: 1, algorithm: 'sm2' },
        { wordId: 'word2', interval: 4, easeFactor: 2.5, repetition: 2, algorithm: 'fsrs', stability: 4.0 },
      ];

      const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        expect(url).toContain('/api/srs/batch');
        expect(init?.method).toBe('POST');
        const body = JSON.parse(init?.body as string);
        expect(body.items).toHaveLength(2);

        return Promise.resolve(
          new Response(JSON.stringify({ success: true, upsertedCount: 2, processedAt: new Date().toISOString() }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
      globalThis.fetch = fetchSpy as any;

      const res = await srsApi.batchUpsertSrs(items);
      expect(res.success).toBe(true);
      expect(res.upsertedCount).toBe(2);
    });

    it('resetUserSrsProgress sends DELETE to /api/srs/user-progress', async () => {
      const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        expect(url).toContain('/api/srs/user-progress');
        expect(init?.method).toBe('DELETE');

        return Promise.resolve(
          new Response(JSON.stringify({ success: true, message: 'Reset ok' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
      globalThis.fetch = fetchSpy as any;

      const res = await srsApi.resetUserSrsProgress();
      expect(res.success).toBe(true);
    });

    it('adminResetUsersSrs posts target user IDs to /api/srs/admin-reset', async () => {
      const targetIds = ['user-1', 'user-2'];
      const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        expect(url).toContain('/api/srs/admin-reset');
        expect(init?.method).toBe('POST');
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual(targetIds);

        return Promise.resolve(
          new Response(JSON.stringify({ success: true, message: 'Admin reset ok' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
      globalThis.fetch = fetchSpy as any;

      const res = await srsApi.adminResetUsersSrs(targetIds);
      expect(res.success).toBe(true);
    });
  });

  describe('2. DailyLogs API Client (dailyLogApi)', () => {
    it('getDailyLogs requests /api/dailylogs with fromDate/toDate filters', async () => {
      const mockLogs: DailyLogDto[] = [
        { date: '2026-10-05', wordsLearned: 10, xpEarned: 100, wordsReviewed: 15, quizzesCompleted: 2 },
      ];

      const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        expect(url).toContain('/api/dailylogs?fromDate=2026-10-01&toDate=2026-10-08');
        expect(init?.method).toBe('GET');

        return Promise.resolve(
          new Response(JSON.stringify(mockLogs), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
      globalThis.fetch = fetchSpy as any;

      const result = await dailyLogApi.getDailyLogs({ fromDate: '2026-10-01', toDate: '2026-10-08' });
      expect(result).toHaveLength(1);
      expect(result[0].wordsReviewed).toBe(15);
      expect(result[0].quizzesCompleted).toBe(2);
    });

    it('batchUpsertDailyLogs posts daily logs to /api/dailylogs/batch', async () => {
      const logs: DailyLogDto[] = [
        { date: '2026-10-08', wordsLearned: 5, xpEarned: 50, wordsReviewed: 10, quizzesCompleted: 1 },
      ];

      const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        expect(url).toContain('/api/dailylogs/batch');
        expect(init?.method).toBe('POST');
        const body = JSON.parse(init?.body as string);
        expect(body.logs[0].wordsReviewed).toBe(10);
        expect(body.logs[0].quizzesCompleted).toBe(1);

        return Promise.resolve(
          new Response(JSON.stringify({ success: true, upsertedCount: 1, processedAt: new Date().toISOString() }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
      globalThis.fetch = fetchSpy as any;

      const res = await dailyLogApi.batchUpsertDailyLogs(logs);
      expect(res.success).toBe(true);
      expect(res.upsertedCount).toBe(1);
    });

    it('resetUserDailyLogs sends DELETE to /api/dailylogs/user-history', async () => {
      const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        expect(url).toContain('/api/dailylogs/user-history');
        expect(init?.method).toBe('DELETE');

        return Promise.resolve(
          new Response(JSON.stringify({ success: true, message: 'Reset history ok' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
      globalThis.fetch = fetchSpy as any;

      const res = await dailyLogApi.resetUserDailyLogs();
      expect(res.success).toBe(true);
    });

    it('adminResetUsersDailyLogs posts target user IDs to /api/dailylogs/admin-reset', async () => {
      const targetIds = ['user-3'];
      const fetchSpy = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        expect(url).toContain('/api/dailylogs/admin-reset');
        expect(init?.method).toBe('POST');

        return Promise.resolve(
          new Response(JSON.stringify({ success: true, message: 'Admin reset daily ok' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
      globalThis.fetch = fetchSpy as any;

      const res = await dailyLogApi.adminResetUsersDailyLogs(targetIds);
      expect(res.success).toBe(true);
    });
  });

  describe('3. Cloud Sync Integration: FSRS != SM-2 & Rich Daily Logs Mapping', () => {
    it('pushLocalToCloud serializes FSRS and SM-2 differently without faking FSRS properties for SM-2', async () => {
      const mockState = {
        profile: { name: 'Learner', level: 2, xp: 500, streak: 3 },
        srsProgressMap: {
          sm2_card: {
            srsLevel: 3,
            interval: 6,
            easeFactor: 2.5,
            nextReviewDate: '2026-10-14T00:00:00Z',
            lastReviewedDate: '2026-10-08T00:00:00Z',
            // No FSRS property
          } as SRSProgress,
          fsrs_card: {
            srsLevel: 2,
            interval: 8,
            easeFactor: 2.5,
            nextReviewDate: '2026-10-16T00:00:00Z',
            lastReviewedDate: '2026-10-08T00:00:00Z',
            fsrs: {
              stability: 7.8,
              difficulty: 4.2,
              state: 2,
              reps: 3,
              lapses: 0,
              lastReview: '2026-10-08T00:00:00Z',
            },
          } as SRSProgress,
        },
        dailyHistory: {
          '2026-10-08': {
            date: '2026-10-08',
            wordsReviewed: 18,
            newWordsLearned: 5,
            quizzesCompleted: 3,
            pronunciationsMastered: 2,
            xpGained: 160,
          } as DailyProgress,
        },
      };

      registerCloudSyncStoreGetter(() => mockState);

      let capturedUploadBody: any = null;
      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes('/api/sync')) {
          capturedUploadBody = JSON.parse(init?.body as string);
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
        }
        return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
      });

      await pushLocalToCloud(mockUserId);

      expect(capturedUploadBody).toBeDefined();
      const srsItems: SrsProgressItemDto[] = capturedUploadBody.srsItems;
      expect(srsItems).toHaveLength(2);

      // Verify SM-2 item: algorithm = "sm2", stability and difficulty are NOT faked
      const sm2Item = srsItems.find((x) => x.wordId === 'sm2_card')!;
      expect(sm2Item.algorithm).toBe('sm2');
      expect(sm2Item.stability).toBeUndefined();
      expect(sm2Item.difficulty).toBeUndefined();
      expect(sm2Item.state).toBeUndefined();

      // Verify FSRS item: algorithm = "fsrs", rich memory state preserved
      const fsrsItem = srsItems.find((x) => x.wordId === 'fsrs_card')!;
      expect(fsrsItem.algorithm).toBe('fsrs');
      expect(fsrsItem.stability).toBe(7.8);
      expect(fsrsItem.difficulty).toBe(4.2);
      expect(fsrsItem.state).toBe(2);
      expect(fsrsItem.reps).toBe(3);

      // Verify Daily Log item: wordsReviewed and quizzesCompleted mapped accurately
      const dailyLogs: DailyLogDto[] = capturedUploadBody.dailyLogs;
      expect(dailyLogs).toHaveLength(1);
      expect(dailyLogs[0].wordsReviewed).toBe(18);
      expect(dailyLogs[0].quizzesCompleted).toBe(3);
      expect(dailyLogs[0].wordsLearned).toBe(23); // (18 reviewed + 5 new)
      expect(dailyLogs[0].xpEarned).toBe(160);
    });
  });

  describe('4. Admin Vocab Service Cutover: Zero Supabase Dependency for SRS & DailyLogs', () => {
    it('resetAllUsersProgress calls backend API and does NOT query Supabase for user_srs_progress or daily_logs', async () => {
      let srsDeleteCalled = false;
      let logsDeleteCalled = false;
      let supabaseSrsCalled = false;
      let supabaseLogsCalled = false;

      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes('/api/srs/user-progress') && init?.method === 'DELETE') {
          srsDeleteCalled = true;
          return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
        }

        if (url.includes('/api/dailylogs/user-history') && init?.method === 'DELETE') {
          logsDeleteCalled = true;
          return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
        }

        if (url.includes('supabase.co')) {
          if (url.includes('user_srs_progress')) supabaseSrsCalled = true;
          if (url.includes('daily_logs')) supabaseLogsCalled = true;
        }

        return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
      });

      const result = await resetAllUsersProgress();

      expect(result.success).toBe(true);
      expect(srsDeleteCalled).toBe(true);
      expect(logsDeleteCalled).toBe(true);
      // STRICT CUTOVER VERIFICATION
      expect(supabaseSrsCalled).toBe(false);
      expect(supabaseLogsCalled).toBe(false);
    });

    it('resetTargetUsersProgress calls admin backend endpoints without Supabase dependency', async () => {
      let srsAdminResetCalled = false;
      let logsAdminResetCalled = false;
      let supabaseSrsCalled = false;
      let supabaseLogsCalled = false;

      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes('/api/srs/admin-reset') && init?.method === 'POST') {
          srsAdminResetCalled = true;
          return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
        }

        if (url.includes('/api/dailylogs/admin-reset') && init?.method === 'POST') {
          logsAdminResetCalled = true;
          return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
        }

        if (url.includes('supabase.co')) {
          if (url.includes('user_srs_progress')) supabaseSrsCalled = true;
          if (url.includes('daily_logs')) supabaseLogsCalled = true;
        }

        return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
      });

      const result = await resetTargetUsersProgress(['target-user-1', 'target-user-2']);

      expect(result.success).toBe(true);
      expect(srsAdminResetCalled).toBe(true);
      expect(logsAdminResetCalled).toBe(true);
      // ZERO SUPABASE DEPENDENCY
      expect(supabaseSrsCalled).toBe(false);
      expect(supabaseLogsCalled).toBe(false);
    });
  });
});
