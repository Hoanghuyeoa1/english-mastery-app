// @vitest-environment happy-dom
// src/services/api/__tests__/leaderboardCutoverPhase9.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  leaderboardApi,
  type LeaderboardPageResponse,
  type CurrentUserRankResponse,
  type ServerTimeResponse,
  type SyncScoreResponse,
  type SyncWeeklyMetricsResponse,
} from '../leaderboardApi';
import {
  fetchLeaderboardWithStatus,
  getMyLeaderboardRank,
  syncUserScoreToLeaderboard,
  syncWeeklyLearningMetricsToServer,
  clearCachedLeaderboardForTesting,
} from '../../leaderboardService';
import { setAccessToken } from '../httpClient';
import { supabase } from '../../../lib/supabaseClient';

describe('PHASE 9 — SQL Server Leaderboard & 7-Category API Cutover', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    clearCachedLeaderboardForTesting();
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearCachedLeaderboardForTesting();
  });

  describe('1. Leaderboard API Client Foundation', () => {
    it('fetchServerTime calls GET /api/leaderboard/server-time without auth header', async () => {
      const mockRes: ServerTimeResponse = {
        success: true,
        serverNow: '2026-10-08T02:00:00Z',
        weekId: '2026-W41',
        weekStart: '2026-10-04T17:00:00Z',
        weekEnd: '2026-10-11T17:00:00Z',
        nextReset: '2026-10-11T17:00:00Z',
        timezone: 'Asia/Ho_Chi_Minh',
      };

      let capturedUrl = '';
      let capturedHeaders: Headers | undefined;

      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        capturedUrl = url;
        capturedHeaders = init?.headers as Headers;
        return Promise.resolve(
          new Response(JSON.stringify(mockRes), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      const res = await leaderboardApi.fetchServerTime();

      expect(res.success).toBe(true);
      expect(res.weekId).toBe('2026-W41');
      expect(capturedUrl).toContain('/api/leaderboard/server-time');
      expect(capturedHeaders?.get('Authorization')).toBeNull();
    });

    it('fetchLeaderboardPage calls GET /api/leaderboard/{category} with pagination parameters', async () => {
      const mockPage: LeaderboardPageResponse = {
        success: true,
        category: 'weekly_xp',
        weekId: '2026-W41',
        serverWeekId: '2026-W41',
        serverNow: '2026-10-08T02:00:00Z',
        page: 2,
        pageSize: 20,
        totalCount: 35,
        entries: [
          {
            userId: '11111111-2222-3333-4444-555555555555',
            rank: 21,
            displayName: 'Top Learner',
            avatarUrl: 'https://example.com/top.png',
            level: 15,
            rankTitle: 'VIP Learner',
            score: 750,
            secondaryScore: 10,
            isCurrentUser: false,
          },
        ],
        currentUserEntry: null,
      };

      let capturedUrl = '';
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        capturedUrl = url;
        return Promise.resolve(
          new Response(JSON.stringify(mockPage), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      const res = await leaderboardApi.fetchLeaderboardPage('weekly_xp', {
        weekId: '2026-W41',
        page: 2,
        pageSize: 20,
      });

      expect(res.success).toBe(true);
      expect(res.entries).toHaveLength(1);
      expect(res.entries[0].rank).toBe(21);
      expect(capturedUrl).toContain('/api/leaderboard/weekly_xp?weekId=2026-W41&page=2&pageSize=20');
    });

    it('fetchCurrentUserRank calls GET /api/leaderboard/{category}/me', async () => {
      const mockRank: CurrentUserRankResponse = {
        success: true,
        found: true,
        category: 'streak',
        weekId: '2026-W41',
        entry: {
          userId: 'user-my-id',
          rank: 5,
          displayName: 'Me Learner',
          level: 25,
          rankTitle: 'Master Scholar',
          score: 18,
          secondaryScore: 400,
          isCurrentUser: true,
        },
      };

      let capturedUrl = '';
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        capturedUrl = url;
        return Promise.resolve(
          new Response(JSON.stringify(mockRank), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      const res = await leaderboardApi.fetchCurrentUserRank('streak', '2026-W41');

      expect(res.found).toBe(true);
      expect(res.entry?.rank).toBe(5);
      expect(capturedUrl).toContain('/api/leaderboard/streak/me?weekId=2026-W41');
    });

    it('syncScore calls POST /api/leaderboard/sync-score', async () => {
      const mockRes: SyncScoreResponse = {
        success: true,
        code: 'SYNCED_SUCCESS',
        message: 'Đồng bộ điểm số thành công.',
      };

      let capturedUrl = '';
      let capturedBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        capturedUrl = url;
        capturedBody = JSON.parse(init?.body as string);
        return Promise.resolve(
          new Response(JSON.stringify(mockRes), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      const res = await leaderboardApi.syncScore({
        displayName: 'Test User',
        level: 5,
        totalXp: 1200,
        weeklyXp: 300,
        streak: 7,
      });

      expect(res.success).toBe(true);
      expect(capturedUrl).toContain('/api/leaderboard/sync-score');
      expect(capturedBody.displayName).toBe('Test User');
      expect(capturedBody.weeklyXp).toBe(300);
    });

    it('syncWeeklyMetrics calls POST /api/leaderboard/sync-metrics with evidence', async () => {
      const mockRes: SyncWeeklyMetricsResponse = {
        success: true,
        code: 'SYNCED_SUCCESS',
        message: 'Đồng bộ chỉ số học tập thành công.',
        weekId: '2026-W41',
        weeklyXp: 450,
        vocabMastered: 30,
        reviewConsistency: 95.0,
        activeMinutes: 80,
      };

      let capturedUrl = '';
      let capturedBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        capturedUrl = url;
        capturedBody = JSON.parse(init?.body as string);
        return Promise.resolve(
          new Response(JSON.stringify(mockRes), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      const res = await leaderboardApi.syncWeeklyMetrics({
        weekId: '2026-W41',
        weeklyXp: 450,
        vocabMastered: 30,
        reviewConsistency: 95.0,
        activeMinutes: 80,
        evidence: { vocab_transitions: 8 },
      });

      expect(res.success).toBe(true);
      expect(capturedUrl).toContain('/api/leaderboard/sync-metrics');
      expect(capturedBody.evidence?.vocab_transitions).toBe(8);
    });
  });

  describe('2. Cutover Integration via leaderboardService', () => {
    it('fetchLeaderboardWithStatus routes to ASP.NET and sets cache with zero Supabase call', async () => {
      const supabaseRpcSpy = vi.spyOn(supabase, 'rpc');
      const supabaseFromSpy = vi.spyOn(supabase, 'from');

      const mockPage: LeaderboardPageResponse = {
        success: true,
        category: 'weekly_xp',
        weekId: '2026-W41',
        serverWeekId: '2026-W41',
        serverNow: '2026-10-08T05:00:00Z',
        page: 1,
        pageSize: 50,
        totalCount: 1,
        entries: [
          {
            userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            rank: 1,
            displayName: 'Top Star',
            level: 50,
            rankTitle: 'Mythic Legend',
            score: 1500,
            secondaryScore: 30,
            isCurrentUser: true,
          },
        ],
        currentUserEntry: {
          userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          rank: 1,
          displayName: 'Top Star',
          level: 50,
          rankTitle: 'Mythic Legend',
          score: 1500,
          secondaryScore: 30,
          isCurrentUser: true,
        },
      };

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/leaderboard/weekly_xp')) {
          return Promise.resolve(
            new Response(JSON.stringify(mockPage), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const res = await fetchLeaderboardWithStatus(
        'weekly_xp',
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        50,
        0
      );

      expect(res.status).toBe('SUCCESS');
      expect(res.entries).toHaveLength(1);
      expect(res.entries[0].displayName).toBe('Top Star');
      expect(res.currentUserEntry?.rank).toBe(1);

      // Verify ZERO calls to Supabase
      expect(supabaseRpcSpy).not.toHaveBeenCalled();
      expect(supabaseFromSpy).not.toHaveBeenCalled();
    });

    it('getMyLeaderboardRank calls ASP.NET endpoint with zero Supabase call', async () => {
      const supabaseRpcSpy = vi.spyOn(supabase, 'rpc');
      const supabaseFromSpy = vi.spyOn(supabase, 'from');

      const mockRank: CurrentUserRankResponse = {
        success: true,
        found: true,
        category: 'vocab_mastered',
        weekId: '2026-W41',
        entry: {
          userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          rank: 3,
          displayName: 'Vocab Master',
          level: 26,
          rankTitle: 'Master Scholar',
          score: 85,
          secondaryScore: 12,
          isCurrentUser: true,
        },
      };

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/leaderboard/vocab_mastered/me')) {
          return Promise.resolve(
            new Response(JSON.stringify(mockRank), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const rankEntry = await getMyLeaderboardRank(
        'vocab_mastered',
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        '2026-W41'
      );

      expect(rankEntry).not.toBeNull();
      expect(rankEntry?.rank).toBe(3);
      expect(rankEntry?.score).toBe(85);
      expect(rankEntry?.rankTitle).toBe('Master Scholar');

      // Verify ZERO calls to Supabase
      expect(supabaseRpcSpy).not.toHaveBeenCalled();
      expect(supabaseFromSpy).not.toHaveBeenCalled();
    });

    it('syncWeeklyLearningMetricsToServer routes to ASP.NET with zero Supabase call', async () => {
      const supabaseRpcSpy = vi.spyOn(supabase, 'rpc');
      const supabaseFromSpy = vi.spyOn(supabase, 'from');

      const mockRes: SyncWeeklyMetricsResponse = {
        success: true,
        code: 'SYNCED_SUCCESS',
        message: 'Đồng bộ chỉ số học tập thành công.',
        weekId: '2026-W41',
        weeklyXp: 500,
        vocabMastered: 40,
        reviewConsistency: 92.0,
        activeMinutes: 100,
        pronunciationGain: 15.0,
        toeicGain: 45,
      };

      let capturedBody: any = null;
      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes('/api/leaderboard/sync-metrics')) {
          capturedBody = JSON.parse(init?.body as string);
          return Promise.resolve(
            new Response(JSON.stringify(mockRes), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const result = await syncWeeklyLearningMetricsToServer({
        userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        weekId: '2026-W41',
        weeklyXp: 500,
        vocabMastered: 40,
        reviewConsistency: 92.0,
        activeMinutes: 100,
        pronunciationGain: 15.0,
        toeicGain: 45,
        evidence: { pronunciation_samples: 15, pronunciation_days: 3 },
      });

      expect(result.success).toBe(true);
      expect(result.code).toBe('SYNCED_SUCCESS');
      expect(result.weekly_xp).toBe(500);
      expect(capturedBody.evidence?.pronunciation_samples).toBe(15);

      // Verify ZERO calls to Supabase
      expect(supabaseRpcSpy).not.toHaveBeenCalled();
      expect(supabaseFromSpy).not.toHaveBeenCalled();
    });

    it('syncUserScoreToLeaderboard routes to ASP.NET with zero Supabase call', async () => {
      const supabaseRpcSpy = vi.spyOn(supabase, 'rpc');
      const supabaseFromSpy = vi.spyOn(supabase, 'from');

      const mockRes: SyncScoreResponse = {
        success: true,
        code: 'SYNCED_SUCCESS',
        message: 'Đồng bộ điểm số thành công.',
      };

      let capturedBody: any = null;
      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes('/api/leaderboard/sync-score')) {
          capturedBody = JSON.parse(init?.body as string);
          return Promise.resolve(
            new Response(JSON.stringify(mockRes), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      await syncUserScoreToLeaderboard({
        userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        displayName: 'Hero Learner',
        level: 10,
        totalXp: 3000,
        weeklyXp: 450,
        streak: 12,
        equippedFrame: 'ruby_frame',
      });

      expect(capturedBody.displayName).toBe('Hero Learner');
      expect(capturedBody.weeklyXp).toBe(450);
      expect(capturedBody.equippedFrame).toBe('ruby_frame');

      // Verify ZERO calls to Supabase
      expect(supabaseRpcSpy).not.toHaveBeenCalled();
      expect(supabaseFromSpy).not.toHaveBeenCalled();
    });
  });
});
