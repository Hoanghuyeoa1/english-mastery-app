// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as httpClient from '../httpClient';
import * as weeklyFinalizationApi from '../weeklyFinalizationApi';
import * as frameRewardApi from '../frameRewardApi';
import * as weeklyFinalizationService from '../../weeklyFinalizationService';
import * as frameRewardService from '../../frameRewardService';
import * as weeklyCeremonyService from '../../weeklyCeremonyService';

describe('Phase 10: Weekly Finalization, Snapshots & Frame Rewards Cutover to ASP.NET API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. weeklyFinalizationApi Client', () => {
    it('finalizeWeeklyLeaderboard sends POST to /api/leaderboard/finalization/finalize', async () => {
      const fetchSpy = vi.spyOn(httpClient, 'fetchApi').mockResolvedValue({
        success: true,
        code: 'FINALIZED_SUCCESS',
        message: 'Chốt tuần thành công',
        weekId: '2026-W40',
        weekStart: '2026-10-05T00:00:00Z',
        weekEnd: '2026-10-12T00:00:00Z',
        finalizedAt: '2026-10-12T00:01:00Z',
        totalParticipants: 42,
        isIdempotent: false,
        serverNow: '2026-10-12T00:01:00Z',
        snapshotsCreated: [],
      });

      const res = await weeklyFinalizationApi.finalizeWeeklyLeaderboard('2026-W40', 3);

      expect(fetchSpy).toHaveBeenCalledWith('/leaderboard/finalization/finalize', {
        method: 'POST',
        body: JSON.stringify({ weekId: '2026-W40', topLimit: 3 }),
      });
      expect(res.success).toBe(true);
      expect(res.code).toBe('FINALIZED_SUCCESS');
      expect(res.weekId).toBe('2026-W40');
    });

    it('finalizeWeeklyLeaderboard handles 403 Forbidden with PERMISSION_DENIED code', async () => {
      vi.spyOn(httpClient, 'fetchApi').mockRejectedValue({
        status: 403,
        code: 'PERMISSION_DENIED',
        message: 'Chỉ quản trị viên mới được chốt tuần.',
      });

      const res = await weeklyFinalizationApi.finalizeWeeklyLeaderboard('2026-W40');
      expect(res.success).toBe(false);
      expect(res.code).toBe('PERMISSION_DENIED');
      expect(res.message).toContain('quản trị viên');
    });

    it('fetchWeeklySnapshots sends GET with encoded parameters', async () => {
      const fetchSpy = vi.spyOn(httpClient, 'fetchApi').mockResolvedValue([
        {
          id: 'snap-1',
          weekId: '2026-W40',
          category: 'weekly_xp',
          userId: 'user-winner-1',
          displayName: 'Quán Quân Tuần',
          level: 10,
          rank: 1,
          score: 1500,
          secondaryScore: 5000,
          frameAwarded: 'champion_frame',
          finalizedAt: '2026-10-12T00:00:00Z',
        },
      ]);

      const snapshots = await weeklyFinalizationApi.fetchWeeklySnapshots('2026-W40', 'weekly_xp');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/leaderboard/finalization/results?weekId=2026-W40&category=weekly_xp',
        { method: 'GET' }
      );
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].frameAwarded).toBe('champion_frame');
    });

    it('fetchFinalizedWeeks sends GET with limit parameter', async () => {
      const fetchSpy = vi.spyOn(httpClient, 'fetchApi').mockResolvedValue([
        {
          weekId: '2026-W40',
          weekStart: '2026-10-05T00:00:00Z',
          weekEnd: '2026-10-12T00:00:00Z',
          finalizedAt: '2026-10-12T00:00:00Z',
          totalParticipants: 50,
          isFinalized: true,
          metadataJson: '{"topWinners":[]}',
        },
      ]);

      const history = await weeklyFinalizationApi.fetchFinalizedWeeks(5);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/leaderboard/finalization/history?limit=5',
        { method: 'GET' }
      );
      expect(history).toHaveLength(1);
      expect(history[0].weekId).toBe('2026-W40');
    });

    it('fetchPendingCeremony queries /leaderboard/ceremony/pending', async () => {
      const fetchSpy = vi.spyOn(httpClient, 'fetchApi').mockResolvedValue({
        hasPending: true,
        ceremony: {
          weekId: '2026-W40',
          rank: 1,
          frameId: 'champion_frame',
          score: 1500,
          displayName: 'Winner',
          finalizedAt: '2026-10-12T00:00:00Z',
        },
      });

      const res = await weeklyFinalizationApi.fetchPendingCeremony('2026-W40');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/leaderboard/ceremony/pending?weekId=2026-W40',
        { method: 'GET' }
      );
      expect(res.hasPending).toBe(true);
      expect(res.ceremony?.frameId).toBe('champion_frame');
    });
  });

  describe('2. frameRewardApi Client', () => {
    it('fetchMyFrameEntitlements sends GET to /frames/my-entitlements', async () => {
      const fetchSpy = vi.spyOn(httpClient, 'fetchApi').mockResolvedValue([
        {
          id: 'ent-1',
          userId: 'user-123',
          frameId: 'champion_frame',
          source: 'weekly_xp_podium',
          weekId: '2026-W40',
          timesWon: 2,
          unlockedAt: '2026-10-12T00:00:00Z',
        },
      ]);

      const list = await frameRewardApi.fetchMyFrameEntitlements();

      expect(fetchSpy).toHaveBeenCalledWith('/frames/my-entitlements', {
        method: 'GET',
      });
      expect(list).toHaveLength(1);
      expect(list[0].frameId).toBe('champion_frame');
    });

    it('equipProfileFrame sends POST to /frames/equip and equips owned frame', async () => {
      const fetchSpy = vi.spyOn(httpClient, 'fetchApi').mockResolvedValue({
        success: true,
        code: 'EQUIPPED_SUCCESS',
        message: 'Trang bị khung thành công.',
        equippedFrame: 'champion_frame',
      });

      const res = await frameRewardApi.equipProfileFrame('champion_frame');

      expect(fetchSpy).toHaveBeenCalledWith('/frames/equip', {
        method: 'POST',
        body: JSON.stringify({ frameId: 'champion_frame' }),
      });
      expect(res.success).toBe(true);
      expect(res.equippedFrame).toBe('champion_frame');
    });

    it('equipProfileFrame handles unowned frame error (FRAME_NOT_OWNED)', async () => {
      vi.spyOn(httpClient, 'fetchApi').mockRejectedValue({
        status: 400,
        code: 'FRAME_NOT_OWNED',
        message: 'Bạn chưa sở hữu khung avatar này!',
      });

      const res = await frameRewardApi.equipProfileFrame('champion_frame');

      expect(res.success).toBe(false);
      expect(res.code).toBe('FRAME_NOT_OWNED');
    });

    it('equipProfileFrame allows unequipping frame with null', async () => {
      const fetchSpy = vi.spyOn(httpClient, 'fetchApi').mockResolvedValue({
        success: true,
        code: 'UNEQUIPPED_SUCCESS',
        message: 'Đã gỡ bỏ khung.',
        equippedFrame: null,
      });

      const res = await frameRewardApi.equipProfileFrame(null);

      expect(fetchSpy).toHaveBeenCalledWith('/frames/equip', {
        method: 'POST',
        body: JSON.stringify({ frameId: null }),
      });
      expect(res.success).toBe(true);
      expect(res.code).toBe('UNEQUIPPED_SUCCESS');
    });
  });

  describe('3. weeklyFinalizationService Cutover Integration', () => {
    it('finalizeWeeklyLeaderboardOnServer calls backend API and maps response', async () => {
      vi.spyOn(weeklyFinalizationApi, 'finalizeWeeklyLeaderboard').mockResolvedValue({
        success: true,
        code: 'FINALIZED_SUCCESS',
        message: 'Thành công',
        weekId: '2026-W40',
        totalParticipants: 30,
        serverNow: '2026-10-12T00:00:00Z',
      });

      const res = await weeklyFinalizationService.finalizeWeeklyLeaderboardOnServer('2026-W40', 3);

      expect(res.success).toBe(true);
      expect(res.code).toBe('FINALIZED_SUCCESS');
      expect(res.weekId).toBe('2026-W40');
    });

    it('fetchWeeklySnapshots calls backend API and returns formatted snapshots', async () => {
      vi.spyOn(weeklyFinalizationApi, 'fetchWeeklySnapshots').mockResolvedValue([
        {
          id: 'snap-1',
          weekId: '2026-W40',
          category: 'weekly_xp',
          userId: 'u-1',
          displayName: 'Học viên A',
          level: 3,
          rank: 1,
          score: 1000,
          secondaryScore: 2500,
          finalizedAt: '2026-10-12T00:00:00Z',
        },
      ]);

      const snapshots = await weeklyFinalizationService.fetchWeeklySnapshots('2026-W40', 'weekly_xp');

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].userId).toBe('u-1');
      expect(snapshots[0].score).toBe(1000);
    });

    it('fetchFinalizedWeeks parses metadataJson safely', async () => {
      vi.spyOn(weeklyFinalizationApi, 'fetchFinalizedWeeks').mockResolvedValue([
        {
          weekId: '2026-W40',
          weekStart: '2026-10-05T00:00:00Z',
          weekEnd: '2026-10-12T00:00:00Z',
          finalizedAt: '2026-10-12T00:00:00Z',
          totalParticipants: 25,
          isFinalized: true,
          metadataJson: '{"note":"chốt tuần tự động"}',
        },
      ]);

      const history = await weeklyFinalizationService.fetchFinalizedWeeks(5);

      expect(history).toHaveLength(1);
      expect(history[0].totalParticipants).toBe(25);
      expect(history[0].metadata).toEqual({ note: 'chốt tuần tự động' });
    });
  });

  describe('4. frameRewardService Cutover Integration', () => {
    it('getUserUnlockedFrames extracts unique frameIds from entitlements', async () => {
      vi.spyOn(frameRewardApi, 'fetchMyFrameEntitlements').mockResolvedValue([
        {
          id: '1',
          userId: 'u1',
          frameId: 'champion_frame',
          source: 'podium',
          weekId: '2026-W39',
          timesWon: 1,
          unlockedAt: '2026-10-05T00:00:00Z',
        },
        {
          id: '2',
          userId: 'u1',
          frameId: 'champion_frame',
          source: 'podium',
          weekId: '2026-W40',
          timesWon: 2,
          unlockedAt: '2026-10-12T00:00:00Z',
        },
        {
          id: '3',
          userId: 'u1',
          frameId: 'elite_frame',
          source: 'podium',
          weekId: '2026-W38',
          timesWon: 1,
          unlockedAt: '2026-09-28T00:00:00Z',
        },
      ]);

      const unlocked = await frameRewardService.getUserUnlockedFrames();

      expect(unlocked).toHaveLength(2);
      expect(unlocked).toContain('champion_frame');
      expect(unlocked).toContain('elite_frame');
    });

    it('equipProfileFrameOnServer passes call to backend API', async () => {
      vi.spyOn(frameRewardApi, 'equipProfileFrame').mockResolvedValue({
        success: true,
        code: 'EQUIPPED_SUCCESS',
        message: 'Trang bị thành công',
        equippedFrame: 'elite_frame',
      });

      const res = await frameRewardService.equipProfileFrameOnServer('elite_frame');

      expect(res.success).toBe(true);
      expect(res.equippedFrame).toBe('elite_frame');
    });
  });

  describe('5. weeklyCeremonyService Integration with Backend Finalization', () => {
    const VALID_UUID = '11111111-2222-3333-4444-555555555555';

    it('checkPendingCeremony surfaces ceremony data for podium winner and respects acknowledgement', async () => {
      vi.spyOn(weeklyFinalizationService, 'fetchFinalizedWeeks').mockResolvedValue([
        {
          weekId: '2026-W40',
          weekStart: '2026-10-05T00:00:00Z',
          weekEnd: '2026-10-12T00:00:00Z',
          finalizedAt: '2026-10-12T00:00:00Z',
          totalParticipants: 50,
          isFinalized: true,
        },
      ]);

      vi.spyOn(weeklyFinalizationService, 'fetchWeeklySnapshots').mockResolvedValue([
        {
          id: 'snap-1',
          weekId: '2026-W40',
          category: 'weekly_xp',
          userId: VALID_UUID,
          displayName: 'Top Scholar',
          level: 15,
          rank: 1,
          score: 2500,
          secondaryScore: 6000,
          finalizedAt: '2026-10-12T00:00:00Z',
        },
      ]);

      // First check: should return ceremony
      const ceremony = await weeklyCeremonyService.checkPendingCeremony(VALID_UUID);

      expect(ceremony).not.toBeNull();
      expect(ceremony?.weekId).toBe('2026-W40');
      expect(ceremony?.rank).toBe(1);
      expect(ceremony?.frameId).toBe('champion_frame');
      expect(ceremony?.score).toBe(2500);

      // Acknowledge ceremony
      weeklyCeremonyService.acknowledgeCeremony('2026-W40');

      // Second check: should return null because already acknowledged
      const recheck = await weeklyCeremonyService.checkPendingCeremony(VALID_UUID);
      expect(recheck).toBeNull();
    });

    it('checkPendingCeremony returns null for guest or non-UUID userId', async () => {
      const res = await weeklyCeremonyService.checkPendingCeremony('guest-user-123');
      expect(res).toBeNull();
    });
  });
});
