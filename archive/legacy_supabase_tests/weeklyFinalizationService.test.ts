import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getPreviousUtcWeekId,
  getUtcWeekRangeById,
  isWeekFinalizable,
  finalizeWeeklyLeaderboardOnServer,
  fetchWeeklySnapshots,
  fetchFinalizedWeeks,
} from '../weeklyFinalizationService';
import { supabase } from '../../lib/supabaseClient';

describe('weeklyFinalizationService (Server-Authoritative Weekly Finalization & Snapshots)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Deterministic Week Identity & Week Range', () => {
    it('getPreviousUtcWeekId trả về đúng week ID của tuần trước đó', () => {
      // Ngày 2026-10-07 (tuần 2026-W41)
      const testDate = new Date('2026-10-07T12:00:00Z');
      expect(getPreviousUtcWeekId(testDate)).toBe('2026-W40');

      // Ngày 2026-01-05 (tuần 2026-W02) -> tuần trước là 2026-W01
      const janDate = new Date('2026-01-05T12:00:00Z');
      expect(getPreviousUtcWeekId(janDate)).toBe('2026-W01');
    });

    it('getUtcWeekRangeById phân giải chính xác mốc weekStart và weekEnd theo chuẩn ISO', () => {
      const { weekStart, weekEnd } = getUtcWeekRangeById('2026-W41');

      // 2026-W41 tại VN: bắt đầu Thứ Hai 2026-10-05 00:00:00 VN = Chủ Nhật 2026-10-04 17:00:00 UTC
      // kết thúc Thứ Hai 2026-10-12 00:00:00 VN = Chủ Nhật 2026-10-11 17:00:00 UTC
      expect(weekStart.toISOString()).toBe('2026-10-04T17:00:00.000Z');
      expect(weekEnd.toISOString()).toBe('2026-10-11T17:00:00.000Z');
    });

    it('getUtcWeekRangeById ném lỗi với định dạng weekId không hợp lệ', () => {
      expect(() => getUtcWeekRangeById('2026-41')).toThrow(/Định dạng weekId không hợp lệ/);
      expect(() => getUtcWeekRangeById('invalid-week')).toThrow(/Định dạng weekId không hợp lệ/);
    });
  });

  describe('2. Server Time Check & Server-Authoritative Guard', () => {
    it('isWeekFinalizable từ chối khi serverTime vẫn chưa vượt qua weekEnd', () => {
      const { weekEnd } = getUtcWeekRangeById('2026-W41'); // 2026-10-11T17:00:00.000Z

      // Thời điểm vẫn còn trong tuần (Chủ Nhật 23:00:00 VN = 16:00:00 UTC)
      const currentActiveTime = new Date('2026-10-11T16:00:00Z');
      expect(isWeekFinalizable(weekEnd, currentActiveTime)).toBe(false);

      // Chủ Nhật 23:59:59.999 VN (16:59:59.999 UTC): vẫn là tuần cũ, chưa được chốt
      const sundayLastMs = new Date('2026-10-11T16:59:59.999Z');
      expect(isWeekFinalizable(weekEnd, sundayLastMs)).toBe(false);
    });

    it('isWeekFinalizable chấp thuận khi serverTime đã bước sang tuần mới (Thứ Hai 00:00:00 VN = 17:00:00 UTC)', () => {
      const { weekEnd } = getUtcWeekRangeById('2026-W41');

      // Đúng thời điểm kết thúc tuần cũ / bắt đầu tuần mới (Thứ Hai 00:00:00 VN = 17:00:00 UTC)
      expect(isWeekFinalizable(weekEnd, weekEnd)).toBe(true);

      // Thời điểm Thứ Hai 00:00:01 VN (17:00:01 UTC) của tuần kế tiếp
      const closedTime = new Date('2026-10-11T17:00:01Z');
      expect(isWeekFinalizable(weekEnd, closedTime)).toBe(true);
    });

    it('finalizeWeeklyLeaderboardOnServer báo lỗi WEEK_STILL_ACTIVE nếu server xác định tuần chưa kết thúc', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: false,
          code: 'WEEK_STILL_ACTIVE',
          message: 'Tuần 2026-W41 vẫn đang diễn ra.',
          server_now: '2026-10-10T12:00:00Z',
          week_end: '2026-10-11T23:59:59.999Z',
        },
        error: null,
      } as any);

      const res = await finalizeWeeklyLeaderboardOnServer('2026-W41');

      expect(res.success).toBe(false);
      expect(res.code).toBe('WEEK_STILL_ACTIVE');
      expect(res.message).toContain('vẫn đang diễn ra');
    });
  });

  describe('3. Flow chốt tuần (Finalize Flow: week closes → snapshot Top 3 → week finalized)', () => {
    it('chốt tuần thành công và trả về metadata đầy đủ', async () => {
      const mockRpcResponse = {
        success: true,
        code: 'FINALIZED_SUCCESS',
        week_id: '2026-W40',
        week_start: '2026-09-28T00:00:00.000Z',
        week_end: '2026-10-04T23:59:59.999Z',
        finalized_at: '2026-10-05T00:01:00.000Z',
        total_participants: 42,
        snapshots_created: {
          weekly_xp: 3,
          streak: 3,
        },
      };

      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: mockRpcResponse,
        error: null,
      } as any);

      const res = await finalizeWeeklyLeaderboardOnServer('2026-W40');

      expect(supabase.rpc).toHaveBeenCalledWith('finalize_weekly_leaderboard', {
        p_week_id: '2026-W40',
        p_top_limit: 3,
      });

      expect(res.success).toBe(true);
      expect(res.code).toBe('FINALIZED_SUCCESS');
      expect(res.weekId).toBe('2026-W40');
      expect(res.totalParticipants).toBe(42);
      expect(res.snapshotsCreated?.weekly_xp).toBe(3);
    });

    it('fetchWeeklySnapshots tải đúng ảnh chụp Top 3 đã được chốt và sắp xếp theo rank', async () => {
      const mockSnapshots = [
        {
          id: 'snap-1',
          week_id: '2026-W40',
          category: 'weekly_xp',
          user_id: 'u-gold',
          display_name: 'Quán Quân Tuần',
          avatar_url: 'https://avatar.test/gold.png',
          level: 20,
          rank: 1,
          score: 1500,
          secondary_score: 14,
          finalized_at: '2026-10-05T00:01:00Z',
        },
        {
          id: 'snap-2',
          week_id: '2026-W40',
          category: 'weekly_xp',
          user_id: 'u-silver',
          display_name: 'Á Quân 1',
          avatar_url: null,
          level: 18,
          rank: 2,
          score: 1200,
          secondary_score: 21,
          finalized_at: '2026-10-05T00:01:00Z',
        },
        {
          id: 'snap-3',
          week_id: '2026-W40',
          category: 'weekly_xp',
          user_id: 'u-bronze',
          display_name: 'Á Quân 2',
          avatar_url: null,
          level: 15,
          rank: 3,
          score: 950,
          secondary_score: 9,
          finalized_at: '2026-10-05T00:01:00Z',
        },
      ];

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockSnapshots,
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      const snapshots = await fetchWeeklySnapshots('2026-W40', 'weekly_xp');

      expect(snapshots).toHaveLength(3);
      expect(snapshots[0].rank).toBe(1);
      expect(snapshots[0].displayName).toBe('Quán Quân Tuần');
      expect(snapshots[0].score).toBe(1500);

      expect(snapshots[1].rank).toBe(2);
      expect(snapshots[1].displayName).toBe('Á Quân 1');

      expect(snapshots[2].rank).toBe(3);
      expect(snapshots[2].displayName).toBe('Á Quân 2');
    });
  });

  describe('4. Idempotency (Finalize cùng tuần nhiều lần → cùng một kết quả)', () => {
    it('lần gọi thứ hai trả về ALREADY_FINALIZED và isIdempotent: true mà không duplicate dữ liệu', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc')
        // Lần gọi 1: thành công tạo mới
        .mockResolvedValueOnce({
          data: {
            success: true,
            code: 'FINALIZED_SUCCESS',
            week_id: '2026-W40',
            is_idempotent: false,
          },
          error: null,
        } as any)
        // Lần gọi 2: đã chốt trước đó
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

      const res1 = await finalizeWeeklyLeaderboardOnServer('2026-W40');
      expect(res1.success).toBe(true);
      expect(res1.code).toBe('FINALIZED_SUCCESS');

      const res2 = await finalizeWeeklyLeaderboardOnServer('2026-W40');
      expect(res2.success).toBe(true);
      expect(res2.code).toBe('ALREADY_FINALIZED');
      expect(res2.isIdempotent).toBe(true);

      expect(rpcSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('5. Concurrent Finalize Protection (Bảo vệ tranh chấp đồng thời)', () => {
    it('khi request A và request B chạy đồng thời, chỉ tạo duy nhất 1 bộ kết quả tuần', async () => {
      // Giả lập transaction/advisory lock của PostgreSQL: request A được xử lý trước, request B nhận kết quả idempotent
      vi.spyOn(supabase, 'rpc')
        .mockResolvedValueOnce({
          data: {
            success: true,
            code: 'FINALIZED_SUCCESS',
            week_id: '2026-W40',
            total_participants: 15,
            snapshots_created: { weekly_xp: 3, streak: 3 },
          },
          error: null,
        } as any)
        .mockResolvedValueOnce({
          data: {
            success: true,
            code: 'ALREADY_FINALIZED',
            week_id: '2026-W40',
            is_idempotent: true,
          },
          error: null,
        } as any);

      const [resultA, resultB] = await Promise.all([
        finalizeWeeklyLeaderboardOnServer('2026-W40'),
        finalizeWeeklyLeaderboardOnServer('2026-W40'),
      ]);

      // Cả hai request đều hoàn thành an toàn
      expect(resultA.success).toBe(true);
      expect(resultB.success).toBe(true);

      // Một trong hai là finalized thành công, cái còn lại nhận diện đã finalize (idempotent)
      const codes = [resultA.code, resultB.code];
      expect(codes).toContain('FINALIZED_SUCCESS');
      expect(codes).toContain('ALREADY_FINALIZED');
    });
  });

  describe('6. Weekly Reset Strategy (Bảo toàn Lifetime XP & Streak & Lịch sử)', () => {
    it('fetchFinalizedWeeks trả về lịch sử tuần đã chốt với thông tin nguyên vẹn', async () => {
      const mockHistory = [
        {
          week_id: '2026-W40',
          week_start: '2026-09-28T00:00:00Z',
          week_end: '2026-10-04T23:59:59.999Z',
          finalized_at: '2026-10-05T00:00:05Z',
          total_participants: 30,
          is_finalized: true,
          metadata: { finalized_by: 'server_rpc' },
        },
        {
          week_id: '2026-W39',
          week_start: '2026-09-21T00:00:00Z',
          week_end: '2026-09-27T23:59:59.999Z',
          finalized_at: '2026-09-28T00:00:05Z',
          total_participants: 28,
          is_finalized: true,
        },
      ];

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockHistory,
              error: null,
            }),
          }),
        }),
      } as any);

      const history = await fetchFinalizedWeeks();

      expect(history).toHaveLength(2);
      expect(history[0].weekId).toBe('2026-W40');
      expect(history[0].totalParticipants).toBe(30);
      expect(history[1].weekId).toBe('2026-W39');
      expect(history[1].isFinalized).toBe(true);
    });
  });
});
