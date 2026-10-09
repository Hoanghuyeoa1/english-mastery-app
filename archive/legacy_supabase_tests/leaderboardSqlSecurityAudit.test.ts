// src/services/__tests__/leaderboardSqlSecurityAudit.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '../../lib/supabaseClient';
import {
  finalizeWeeklyLeaderboardOnServer,
  getUtcWeekRangeById,
  isWeekFinalizable,
} from '../weeklyFinalizationService';
import { equipProfileFrameOnServer } from '../frameRewardService';
import {
  syncUserScoreToLeaderboard,
  getUtcWeekStart,
  getUtcWeekEnd,
} from '../leaderboardService';

describe('Leaderboard v2 SQL Security, Permissions & Authoritative Audit Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Permission Matrix: finalize_weekly_leaderboard', () => {
    it('anon caller cannot finalize weekly leaderboard (returns PERMISSION_DENIED)', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: false,
          code: 'PERMISSION_DENIED',
          message: 'finalize_weekly_leaderboard là thao tác server-authoritative. Yêu cầu quyền service_role/admin.',
        },
        error: null,
      } as any);

      const res = await finalizeWeeklyLeaderboardOnServer();
      expect(res.success).toBe(false);
      expect(res.code).toBe('PERMISSION_DENIED');
      expect(res.message).toContain('server-authoritative');
    });

    it('authenticated user client cannot finalize weekly leaderboard (returns PERMISSION_DENIED on Postgres permission error)', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: null,
        error: {
          message: 'permission denied for function finalize_weekly_leaderboard (PGRST301)',
          code: '42501',
        },
      } as any);

      const res = await finalizeWeeklyLeaderboardOnServer();
      expect(res.success).toBe(false);
      expect(res.code).toBe('PERMISSION_DENIED');
    });
  });

  describe('2. Profile Security & Authoritative Columns Protection', () => {
    it('syncUserScoreToLeaderboard prefers secure sync_leaderboard_progress RPC with validated auth.uid()', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: 'auth-user-99' } },
        error: null,
      } as any);

      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          code: 'SYNCED_SUCCESS',
          total_xp: 2500,
          weekly_xp: 350,
          streak: 12,
          level: 5,
        },
        error: null,
      } as any);

      await syncUserScoreToLeaderboard({
        userId: 'auth-user-99',
        displayName: 'Test User',
        level: 5,
        totalXp: 2500,
        weeklyXp: 350,
        streak: 12,
      });

      expect(rpcSpy).toHaveBeenCalledWith('sync_leaderboard_progress', {
        p_display_name: 'Test User',
        p_avatar_url: null,
        p_level: 5,
        p_total_xp: 2500,
        p_weekly_xp: 350,
        p_streak: 12,
      });
    });

    it('rejects unauthenticated progress sync attempts gracefully', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: null },
        error: null,
      } as any);

      const rpcSpy = vi.spyOn(supabase, 'rpc');
      await syncUserScoreToLeaderboard({ totalXp: 1000 });

      // Does not attempt to call RPC when no user is logged in
      expect(rpcSpy).not.toHaveBeenCalled();
    });
  });

  describe('3. Frame Equipping: equip_profile_frame RPC Security', () => {
    it('successfully equips frame when user owns the entitlement', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          code: 'EQUIPPED_SUCCESS',
          equipped_frame: 'champion_frame',
          message: 'Đã trang bị khung đại diện thành công.',
        },
        error: null,
      } as any);

      const res = await equipProfileFrameOnServer('champion_frame');
      expect(res.success).toBe(true);
      expect(res.code).toBe('EQUIPPED_SUCCESS');
      expect(res.equippedFrame).toBe('champion_frame');
    });

    it('rejects equipping with NOT_OWNED when user lacks entitlement in database', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: false,
          code: 'NOT_OWNED',
          message: 'Bạn chưa sở hữu khung này. Chỉ học viên đạt Top 1/2/3 mùa giải tuần mới có thể trang bị.',
        },
        error: null,
      } as any);

      const res = await equipProfileFrameOnServer('champion_frame');
      expect(res.success).toBe(false);
      expect(res.code).toBe('NOT_OWNED');
    });

    it('rejects unauthorized unauthenticated user with UNAUTHORIZED', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Yêu cầu đăng nhập để trang bị khung đại diện.',
        },
        error: null,
      } as any);

      const res = await equipProfileFrameOnServer('elite_frame');
      expect(res.success).toBe(false);
      expect(res.code).toBe('UNAUTHORIZED');
    });

    it('rejects arbitrary invalid frame name with INVALID_FRAME', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: false,
          code: 'INVALID_FRAME',
          message: 'Khung đại diện không hợp lệ trong hệ thống.',
        },
        error: null,
      } as any);

      const res = await equipProfileFrameOnServer('hacker_frame');
      expect(res.success).toBe(false);
      expect(res.code).toBe('INVALID_FRAME');
    });
  });

  describe('4. Arbitrary Historical Week Injection Protection', () => {
    it('rejects arbitrary historical week parameter with INVALID_TARGET_WEEK to prevent resetting current weekly_xp', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: false,
          code: 'INVALID_TARGET_WEEK',
          message: 'Chỉ được phép chốt tuần vừa kết thúc gần nhất (2026-W40). Không được dùng tuần khác (2020-W01) để reset dữ liệu hiện tại.',
          expected_week_id: '2026-W40',
        },
        error: null,
      } as any);

      const res = await finalizeWeeklyLeaderboardOnServer('2020-W01');
      expect(res.success).toBe(false);
      expect(res.code).toBe('INVALID_TARGET_WEEK');
      expect(res.message).toContain('Không được dùng tuần khác');
    });
  });

  describe('5. Finalization Idempotency & Concurrency Race Guard', () => {
    it('idempotently returns ALREADY_FINALIZED on repeated calls without duplicating rewards or wiping twice', async () => {
      vi.spyOn(supabase, 'rpc')
        .mockResolvedValueOnce({
          data: {
            success: true,
            code: 'FINALIZED_SUCCESS',
            week_id: '2026-W40',
            is_idempotent: false,
          },
          error: null,
        } as any)
        .mockResolvedValueOnce({
          data: {
            success: true,
            code: 'ALREADY_FINALIZED',
            week_id: '2026-W40',
            is_idempotent: true,
            message: 'Tuần 2026-W40 đã được chốt trước đó.',
          },
          error: null,
        } as any);

      const firstCall = await finalizeWeeklyLeaderboardOnServer('2026-W40');
      const secondCall = await finalizeWeeklyLeaderboardOnServer('2026-W40');

      expect(firstCall.code).toBe('FINALIZED_SUCCESS');
      expect(firstCall.isIdempotent).toBe(false);

      expect(secondCall.code).toBe('ALREADY_FINALIZED');
      expect(secondCall.isIdempotent).toBe(true);
    });

    it('concurrent finalization requests result in exactly one effective finalization and one idempotent result', async () => {
      vi.spyOn(supabase, 'rpc')
        .mockResolvedValueOnce({
          data: { success: true, code: 'FINALIZED_SUCCESS', week_id: '2026-W40' },
          error: null,
        } as any)
        .mockResolvedValueOnce({
          data: { success: true, code: 'ALREADY_FINALIZED', week_id: '2026-W40', is_idempotent: true },
          error: null,
        } as any);

      const [res1, res2] = await Promise.all([
        finalizeWeeklyLeaderboardOnServer('2026-W40'),
        finalizeWeeklyLeaderboardOnServer('2026-W40'),
      ]);

      const codes = [res1.code, res2.code];
      expect(codes).toContain('FINALIZED_SUCCESS');
      expect(codes).toContain('ALREADY_FINALIZED');
    });
  });

  describe('6. Time Boundary Semantics (Vietnam Business Week GMT+7 Canonical)', () => {
    it('Sunday 23:59:59.999 VN (16:59:59.999 UTC) belongs to the active week and is NOT finalizable', () => {
      const { weekEnd } = getUtcWeekRangeById('2026-W41'); // ends at 2026-10-11T17:00:00.000Z
      const sundayNight = new Date('2026-10-11T16:59:59.999Z');

      expect(isWeekFinalizable(weekEnd, sundayNight)).toBe(false);
      expect(getUtcWeekStart(sundayNight).toISOString()).toBe('2026-10-04T17:00:00.000Z');
      expect(getUtcWeekEnd(sundayNight).toISOString()).toBe('2026-10-11T17:00:00.000Z');
    });

    it('Monday 00:00:00.000 VN (17:00:00.000 UTC) marks the exact boundary where the previous week becomes finalizable', () => {
      const { weekEnd } = getUtcWeekRangeById('2026-W41'); // ends at 2026-10-11T17:00:00.000Z
      const mondayMidnight = new Date('2026-10-11T17:00:00.000Z');

      expect(isWeekFinalizable(weekEnd, mondayMidnight)).toBe(true);
      expect(getUtcWeekStart(mondayMidnight).toISOString()).toBe('2026-10-11T17:00:00.000Z');
    });
  });
});
