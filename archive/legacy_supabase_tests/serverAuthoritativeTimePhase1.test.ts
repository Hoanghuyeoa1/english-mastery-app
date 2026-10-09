// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setServerTimeAnchor,
  getServerTimeAnchor,
  resetServerTimeAnchorForTesting,
  getAuthoritativeServerNow,
  getAuthoritativeVietnamWeekId,
  detectDeviceClockDrift,
  fetchServerTimeAnchor,
  getVietnamWeekId,
  getVietnamWeekStart,
  getVietnamWeekEnd,
  calculateWeeklyCountdown,
  calculateWeeklyXpFromHistory,
  fetchLeaderboardWithStatus,
  syncWeeklyLearningMetricsToServer,
} from '../leaderboardService';
import {
  isWeekFinalizable,
  getVietnamWeekRangeById,
  finalizeWeeklyLeaderboardOnServer,
} from '../weeklyFinalizationService';
import { supabase } from '../../lib/supabaseClient';

describe('PHASE 1: Server-Authoritative Time Hardening & Timezone Boundary Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    resetServerTimeAnchorForTesting();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetServerTimeAnchorForTesting();
  });

  describe('1. Scenario: Client 1 day slow (Device clock lags behind server)', () => {
    it('khi máy chủ đã sang Thứ Hai (tuần mới) nhưng client còn ở Chủ Nhật (tuần cũ), client tự động chuyển theo server', async () => {
      // Giả lập: Server đã là Thứ Hai 00:05:00 VN (2026-10-11T17:05:00.000Z -> tuần 2026-W42)
      const serverTimeMs = new Date('2026-10-11T17:05:00.000Z').getTime();
      setServerTimeAnchor(serverTimeMs, '2026-W42', 'RPC');

      // Giả lập client Date.now() bị chậm 1 ngày (đang là Chủ Nhật 2026-10-11T00:05:00Z -> tuần 2026-W41)
      const slowClientDate = new Date('2026-10-11T00:05:00.000Z');
      const RealDate = globalThis.Date;
      vi.spyOn(globalThis, 'Date').mockImplementation(function (...args: any[]) {
        if (args.length === 0) return slowClientDate;
        // @ts-expect-error construct original date
        return new RealDate(...args);
      } as any);

      // 1. Client clock thuần túy cho ra tuần cũ
      expect(getVietnamWeekId(slowClientDate)).toBe('2026-W41');

      // 2. Authoritative server time và authoritative week ID phải nhận diện chính xác tuần 2026-W42 của server
      expect(Math.abs(getAuthoritativeServerNow().getTime() - serverTimeMs)).toBeLessThan(50);
      expect(getAuthoritativeVietnamWeekId()).toBe('2026-W42');

      // 3. Truy vấn category leaderboard phải gửi week_id của server (2026-W42), không gửi tuần cũ của thiết bị
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          top_entries: [],
          server_now: '2026-10-11T17:05:00.000Z',
          server_week_id: '2026-W42',
        },
        error: null,
      } as any);

      await fetchLeaderboardWithStatus('vocab_mastered', undefined, 10);
      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_leaderboard_category_rankings',
        expect.objectContaining({
          p_week_id: '2026-W42',
        })
      );
    });

    it('syncWeeklyLearningMetricsToServer tự động sử dụng tuần của server thay vì tuần chậm của thiết bị', async () => {
      const serverTimeMs = new Date('2026-10-11T17:15:00.000Z').getTime();
      setServerTimeAnchor(serverTimeMs, '2026-W42', 'RPC');

      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          code: 'SYNCED_SUCCESS',
          week_id: '2026-W42',
          server_now: '2026-10-11T17:15:00.000Z',
          server_week_id: '2026-W42',
        },
        error: null,
      } as any);

      // Client không truyền weekId -> tự động lấy getAuthoritativeVietnamWeekId()
      const res = await syncWeeklyLearningMetricsToServer({
        vocabMastered: 15,
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'sync_weekly_learning_metrics',
        expect.objectContaining({
          p_week_id: '2026-W42',
          p_vocab_mastered: 15,
        })
      );
      expect(res.success).toBe(true);
    });
  });

  describe('2. Scenario: Client 1 day fast (Device clock jumps ahead of server)', () => {
    it('khi client chỉnh đồng hồ vượt trước sang tuần mới nhưng server vẫn ở tuần cũ, isWeekFinalizable từ chối chốt tuần', () => {
      // Tuần 2026-W41 kết thúc tại Thứ Hai 00:00:00 VN = 2026-10-11T17:00:00.000Z UTC
      const { weekEnd } = getVietnamWeekRangeById('2026-W41');

      // Server thực tế đang ở Chủ Nhật 12:00:00 VN (2026-10-11T05:00:00.000Z UTC)
      const serverTime = new Date('2026-10-11T05:00:00.000Z');
      setServerTimeAnchor(serverTime.getTime(), '2026-W41', 'RPC');

      // Client chạy trước sang Thứ Hai 12:00:00 VN (2026-10-12T05:00:00.000Z UTC)
      // Khi isWeekFinalizable gọi với default serverTime, nó lấy getAuthoritativeServerNow()
      expect(isWeekFinalizable(weekEnd)).toBe(false);
    });

    it('khi client gửi yêu cầu chốt tuần sớm, server RPC trả về WEEK_STILL_ACTIVE và không cho phép chốt', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: false,
          code: 'WEEK_STILL_ACTIVE',
          message: 'Tuần 2026-W41 vẫn đang diễn ra.',
          server_now: '2026-10-11T05:00:00.000Z',
          week_end: '2026-10-11T17:00:00.000Z',
        },
        error: null,
      } as any);

      const res = await finalizeWeeklyLeaderboardOnServer('2026-W41');
      expect(res.success).toBe(false);
      expect(res.code).toBe('WEEK_STILL_ACTIVE');
    });

    it('khi client gửi nhầm week_id tương lai, server trả về WEEK_MISMATCH và client tự động re-fetch server time anchor', async () => {
      (vi.spyOn(supabase, 'rpc') as any).mockImplementation(async (fnName: string) => {
        if (fnName === 'sync_weekly_learning_metrics') {
          return {
            data: null,
            error: {
              code: 'WEEK_MISMATCH',
              message: 'WEEK_MISMATCH: Client tuần 2026-W43 không khớp tuần máy chủ 2026-W41.',
            },
          } as any;
        }
        if (fnName === 'get_leaderboard_server_time') {
          return {
            data: {
              success: true,
              server_now: '2026-10-11T05:00:00.000Z',
              week_id: '2026-W41',
            },
            error: null,
          } as any;
        }
        return { data: null, error: null } as any;
      });

      const syncRes = await syncWeeklyLearningMetricsToServer({
        weekId: '2026-W43', // Gửi tuần tương lai do đồng hồ client nhảy cóc
        weeklyXp: 100,
      });

      expect(syncRes.success).toBe(false);
      expect(syncRes.code).toBe('WEEK_MISMATCH');
      // Server time anchor được kích hoạt re-fetch
      expect(supabase.rpc).toHaveBeenCalledWith('get_leaderboard_server_time');
    });
  });

  describe('3. Scenario: Client Timezone Independence (Vietnam Canonical Boundaries)', () => {
    it('mốc chuyển giao tuần diễn ra tuyệt đối đúng tại Chủ Nhật 17:00:00.000 UTC (= Thứ Hai 00:00:00 VN) bất kể múi giờ client', () => {
      // 1 mili-giây trước giao thời: Chủ Nhật 16:59:59.999 UTC
      const beforeReset = new Date('2026-10-11T16:59:59.999Z');
      expect(getVietnamWeekId(beforeReset)).toBe('2026-W41');

      // Đúng thời điểm giao thời: Chủ Nhật 17:00:00.000 UTC
      const exactReset = new Date('2026-10-11T17:00:00.000Z');
      expect(getVietnamWeekId(exactReset)).toBe('2026-W42');

      // 1 giây sau giao thời: Chủ Nhật 17:00:01.000 UTC
      const afterReset = new Date('2026-10-11T17:00:01.000Z');
      expect(getVietnamWeekId(afterReset)).toBe('2026-W42');
    });

    it('weekStart và weekEnd luôn cố định theo múi giờ Việt Nam khi chuyển đổi qua UTC', () => {
      const { weekStart, weekEnd } = getVietnamWeekRangeById('2026-W41');
      // Bắt đầu: Thứ Hai 2026-10-05 00:00:00 VN = Chủ Nhật 2026-10-04 17:00:00 UTC
      expect(weekStart.toISOString()).toBe('2026-10-04T17:00:00.000Z');
      // Kết thúc: Thứ Hai 2026-10-12 00:00:00 VN = Chủ Nhật 2026-10-11 17:00:00 UTC
      expect(weekEnd.toISOString()).toBe('2026-10-11T17:00:00.000Z');
    });

    it('calculateWeeklyXpFromHistory chỉ tính điểm rơi vào đúng 7 ngày trong tuần lịch Việt Nam', () => {
      // Giả lập tuần 2026-W41 (Từ 2026-10-05 đến 2026-10-11 VN)
      const refDate = new Date('2026-10-07T10:00:00Z');
      const dailyHistory = {
        '2026-10-04': { xpGained: 100 }, // Chủ Nhật tuần trước (không tính)
        '2026-10-05': { xpGained: 50 },  // Thứ Hai tuần này (tính)
        '2026-10-06': { xpGained: 80 },  // Thứ Ba tuần này (tính)
        '2026-10-11': { xpGained: 120 }, // Chủ Nhật tuần này (tính)
        '2026-10-12': { xpGained: 200 }, // Thứ Hai tuần sau (không tính)
      };

      const weeklyXp = calculateWeeklyXpFromHistory(dailyHistory, refDate);
      expect(weeklyXp).toBe(50 + 80 + 120); // = 250 XP
    });
  });

  describe('4. Scenario: Runtime Device Clock Tampering & Monotonic Protection', () => {
    it('việc người dùng thay đổi đồng hồ hệ điều hành (Date.now) không làm lệch thời gian authoritative khi đang chạy', () => {
      const initialServerMs = new Date('2026-10-07T10:00:00.000Z').getTime();

      let mockPerfNow = 1000;
      vi.spyOn(performance, 'now').mockImplementation(() => mockPerfNow);

      let mockDateNow = 1760000000000;
      vi.spyOn(Date, 'now').mockImplementation(() => mockDateNow);

      // Thiết lập anchor ban đầu
      setServerTimeAnchor(initialServerMs, '2026-W41', 'RPC');

      // Thời gian trôi qua thực tế trên monotonic clock là 2000ms
      mockPerfNow += 2000;

      // Nhưng người dùng chỉnh đồng hồ OS nhảy vọt 3 giờ (+10,800,000ms)
      mockDateNow += 10800000;

      // Authoritative Server Now CHỈ tăng đúng 2000ms, hoàn toàn miễn nhiễm trước 3 giờ nhảy vọt
      const authoritativeNow = getAuthoritativeServerNow();
      expect(authoritativeNow.getTime()).toBe(initialServerMs + 2000);

      // detectDeviceClockDrift phát hiện sự chênh lệch bất thường giữa Date.now và performance.now
      expect(detectDeviceClockDrift(5000)).toBe(true);
    });

    it('calculateWeeklyCountdown giữ nguyên tính đơn điệu và không bị gián đoạn hay nhảy ngày khi OS clock thay đổi', () => {
      const serverTimeMs = new Date('2026-10-11T16:50:00.000Z').getTime(); // Còn đúng 10 phút đến reset
      let mockPerf = 5000;
      vi.spyOn(performance, 'now').mockImplementation(() => mockPerf);

      setServerTimeAnchor(serverTimeMs, '2026-W41', 'RPC');

      const cd1 = calculateWeeklyCountdown(getAuthoritativeServerNow());
      expect(cd1.days).toBe(0);
      expect(cd1.hours).toBe(0);
      expect(cd1.minutes).toBe(10);
      expect(cd1.seconds).toBe(0);

      // Monotonic trôi qua 30 giây
      mockPerf += 30000;

      const cd2 = calculateWeeklyCountdown(getAuthoritativeServerNow());
      expect(cd2.days).toBe(0);
      expect(cd2.hours).toBe(0);
      expect(cd2.minutes).toBe(9);
      expect(cd2.seconds).toBe(30);
    });
  });

  describe('5. Scenario: Finalization Idempotency, Concurrency & Security', () => {
    it('chốt tuần lần 2 trả về is_idempotent: true và không sinh snapshot trùng', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          code: 'ALREADY_FINALIZED',
          message: 'Tuần 2026-W41 đã được chốt trước đó.',
          week_id: '2026-W41',
          is_idempotent: true,
          server_now: '2026-10-11T17:05:00.000Z',
        },
        error: null,
      } as any);

      const res = await finalizeWeeklyLeaderboardOnServer('2026-W41');
      expect(res.success).toBe(true);
      expect(res.code).toBe('ALREADY_FINALIZED');
      expect(res.isIdempotent).toBe(true);
      expect(res.weekId).toBe('2026-W41');
    });

    it('từ chối thực thi khi gọi bởi unauthorized user (RLS / Permission Denied)', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message: 'permission denied for function finalize_weekly_leaderboard',
        },
      } as any);

      const res = await finalizeWeeklyLeaderboardOnServer('2026-W41');
      expect(res.success).toBe(false);
      expect(res.code).toBe('PERMISSION_DENIED');
      expect(res.message).toContain('permission denied');
    });

    it('fetchServerTimeAnchor cập nhật chính xác anchor từ get_leaderboard_server_time RPC', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          server_now: '2026-10-11T17:30:00.000Z',
          week_id: '2026-W42',
          week_start: '2026-10-11T17:00:00.000Z',
          week_end: '2026-10-18T17:00:00.000Z',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        error: null,
      } as any);

      const anchor = await fetchServerTimeAnchor();
      expect(anchor).not.toBeNull();
      expect(anchor?.serverWeekId).toBe('2026-W42');
      expect(anchor?.source).toBe('RPC');
      expect(getAuthoritativeVietnamWeekId()).toBe('2026-W42');
    });
  });
});
