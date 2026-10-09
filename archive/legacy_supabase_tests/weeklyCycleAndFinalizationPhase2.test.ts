// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getUtcWeekStart,
  getUtcWeekEnd,
  getNextUtcWeekReset,
  getUtcWeekId,
  getCurrentUtcWeekDates,
  calculateWeeklyCountdown,
  calculateWeeklyXpFromHistory,
} from '../leaderboardService';
import {
  getPreviousUtcWeekId,
  getUtcWeekRangeById,
  isWeekFinalizable,
  finalizeWeeklyLeaderboardOnServer,
  fetchWeeklySnapshots,
  fetchFinalizedWeeks,
} from '../weeklyFinalizationService';
import { supabase } from '../../lib/supabaseClient';

describe('PHASE 2 — Chuẩn Hóa Weekly Cycle & Server-Authoritative Finalization Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Fixed-Time Boundary Tests (Sunday 23:59:59 VN vs Monday 00:00:00 VN vs Monday 00:00:01 VN)', () => {
    it('Sunday 23:59:59.000 VN (16:59:59 UTC) thuộc tuần cũ, còn đúng 1 giây đếm ngược, chưa được phép chốt tuần', () => {
      // 2026-10-11 là Chủ Nhật tuần 2026-W41 theo lịch Việt Nam
      const sundayTime = new Date('2026-10-11T16:59:59.000Z');

      expect(getUtcWeekId(sundayTime)).toBe('2026-W41');
      expect(getUtcWeekStart(sundayTime).toISOString()).toBe('2026-10-04T17:00:00.000Z');
      expect(getUtcWeekEnd(sundayTime).toISOString()).toBe('2026-10-11T17:00:00.000Z');
      expect(getNextUtcWeekReset(sundayTime).toISOString()).toBe('2026-10-11T17:00:00.000Z');

      // Countdown còn đúng 1 giây
      const countdown = calculateWeeklyCountdown(sundayTime);
      expect(countdown).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 1 });

      // Server check: chưa được chốt tuần vì chưa chạm mốc kết thúc tuần (2026-10-11T17:00:00.000Z)
      const weekEnd = getUtcWeekEnd(sundayTime);
      expect(isWeekFinalizable(weekEnd, sundayTime)).toBe(false);
    });

    it('Sunday 23:59:59.999 VN (16:59:59.999 UTC) thuộc tuần cũ, miligiây cuối cùng trước giao thời', () => {
      const sundayLastMs = new Date('2026-10-11T16:59:59.999Z');

      expect(getUtcWeekId(sundayLastMs)).toBe('2026-W41');
      const weekEnd = getUtcWeekEnd(sundayLastMs);
      expect(isWeekFinalizable(weekEnd, sundayLastMs)).toBe(false);

      const countdown = calculateWeeklyCountdown(sundayLastMs);
      expect(countdown).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    });

    it('Monday 00:00:00.000 VN (17:00:00.000 UTC) chính thức bắt đầu tuần mới, tuần cũ sẵn sàng được chốt', () => {
      // 2026-10-12 00:00:00 VN = 2026-10-11 17:00:00 UTC (Thứ Hai tuần 2026-W42)
      const mondayMidnight = new Date('2026-10-11T17:00:00.000Z');

      expect(getUtcWeekId(mondayMidnight)).toBe('2026-W42');
      expect(getUtcWeekStart(mondayMidnight).toISOString()).toBe('2026-10-11T17:00:00.000Z');
      expect(getUtcWeekEnd(mondayMidnight).toISOString()).toBe('2026-10-18T17:00:00.000Z');
      expect(getNextUtcWeekReset(mondayMidnight).toISOString()).toBe('2026-10-18T17:00:00.000Z');

      // Countdown reset đủ 7 ngày cho chu kỳ tuần mới
      const countdown = calculateWeeklyCountdown(mondayMidnight);
      expect(countdown).toEqual({ days: 7, hours: 0, minutes: 0, seconds: 0 });

      // Tuần cũ (2026-W41) có mốc kết thúc là 2026-10-11T17:00:00.000Z -> ĐÃ ĐỦ ĐIỀU KIỆN CHỐT
      const { weekEnd: oldWeekEnd } = getUtcWeekRangeById('2026-W41');
      expect(isWeekFinalizable(oldWeekEnd, mondayMidnight)).toBe(true);

      // Tuần trước của thời điểm này là 2026-W41
      expect(getPreviousUtcWeekId(mondayMidnight)).toBe('2026-W41');
    });

    it('Monday 00:00:01.000 VN (17:00:01.000 UTC) tuần mới tiếp diễn bình thường', () => {
      const monday1s = new Date('2026-10-11T17:00:01.000Z');

      expect(getUtcWeekId(monday1s)).toBe('2026-W42');
      const countdown = calculateWeeklyCountdown(monday1s);
      expect(countdown).toEqual({ days: 6, hours: 23, minutes: 59, seconds: 59 });

      const { weekEnd: oldWeekEnd } = getUtcWeekRangeById('2026-W41');
      expect(isWeekFinalizable(oldWeekEnd, monday1s)).toBe(true);
    });
  });

  describe('2. Month Boundary & Year Boundary & ISO Week 52 / 53 Tests', () => {
    it('Month Boundary: Chuyển giao tháng giữa tuần (Tháng 9 sang Tháng 10 năm 2026 theo giờ VN)', () => {
      // Tuần 2026-W40 bắt đầu từ Thứ Hai 2026-09-28 đến Thứ Hai 2026-10-05 theo giờ VN
      const wednesdaySep30 = new Date('2026-09-30T14:00:00.000Z');
      const thursdayOct01 = new Date('2026-10-01T08:00:00.000Z');

      expect(getUtcWeekId(wednesdaySep30)).toBe('2026-W40');
      expect(getUtcWeekId(thursdayOct01)).toBe('2026-W40');

      expect(getUtcWeekStart(wednesdaySep30).toISOString()).toBe('2026-09-27T17:00:00.000Z');
      expect(getUtcWeekStart(thursdayOct01).toISOString()).toBe('2026-09-27T17:00:00.000Z');

      const dates = getCurrentUtcWeekDates(wednesdaySep30);
      expect(dates).toEqual([
        '2026-09-28',
        '2026-09-29',
        '2026-09-30',
        '2026-10-01',
        '2026-10-02',
        '2026-10-03',
        '2026-10-04',
      ]);
    });

    it('Year Boundary (Năm 53 tuần - Năm 2020 leap year): 2020-W53 kéo dài sang đầu tháng 1/2021', () => {
      // 2020 có 53 tuần ISO vì 31/12/2020 rơi vào Thứ Năm
      const dec31 = new Date('2020-12-31T05:00:00.000Z');
      const jan01 = new Date('2021-01-01T05:00:00.000Z');
      const jan03 = new Date('2021-01-03T16:00:00.000Z');
      const jan04 = new Date('2021-01-03T17:00:00.000Z'); // Thứ Hai 00:00:00 VN của 2021-W01

      expect(getUtcWeekId(dec31)).toBe('2020-W53');
      expect(getUtcWeekId(jan01)).toBe('2020-W53');
      expect(getUtcWeekId(jan03)).toBe('2020-W53');
      expect(getUtcWeekId(jan04)).toBe('2021-W01');

      const range53 = getUtcWeekRangeById('2020-W53');
      expect(range53.weekStart.toISOString()).toBe('2020-12-27T17:00:00.000Z');
      expect(range53.weekEnd.toISOString()).toBe('2021-01-03T17:00:00.000Z');

      const range01 = getUtcWeekRangeById('2021-W01');
      expect(range01.weekStart.toISOString()).toBe('2021-01-03T17:00:00.000Z');
      expect(range01.weekEnd.toISOString()).toBe('2021-01-10T17:00:00.000Z');
    });

    it('Year Boundary (Năm 2026 - 53 tuần): Chuyển giao năm 2026 sang 2027', () => {
      // 31/12/2026 rơi vào Thứ Năm -> Năm 2026 có 53 tuần ISO
      const dec28 = new Date('2026-12-28T00:00:00.000Z');
      const jan01 = new Date('2027-01-01T05:00:00.000Z');
      const jan03 = new Date('2027-01-03T16:59:59.000Z');
      const jan04 = new Date('2027-01-03T17:00:00.000Z'); // Thứ Hai 00:00:00 VN

      expect(getUtcWeekId(dec28)).toBe('2026-W53');
      expect(getUtcWeekId(jan01)).toBe('2026-W53');
      expect(getUtcWeekId(jan03)).toBe('2026-W53');
      expect(getUtcWeekId(jan04)).toBe('2027-W01');

      const range2026W53 = getUtcWeekRangeById('2026-W53');
      expect(range2026W53.weekStart.toISOString()).toBe('2026-12-27T17:00:00.000Z');
      expect(range2026W53.weekEnd.toISOString()).toBe('2027-01-03T17:00:00.000Z');
    });

    it('Year Boundary (Năm 52 tuần - Năm 2025): 29/12/2025 là Thứ Hai thuộc tuần 2026-W01', () => {
      // 2025 chỉ có 52 tuần. Ngày 29/12/2025 (Thứ Hai VN) chứa ngày 01/01/2026 (Thứ Năm VN) -> 2026-W01
      const dec28 = new Date('2025-12-28T16:59:59.000Z'); // Chủ Nhật 23:59:59 VN
      const dec29 = new Date('2025-12-28T17:00:00.000Z'); // Thứ Hai 00:00:00 VN

      expect(getUtcWeekId(dec28)).toBe('2025-W52');
      expect(getUtcWeekId(dec29)).toBe('2026-W01');

      const range2025W52 = getUtcWeekRangeById('2025-W52');
      expect(range2025W52.weekStart.toISOString()).toBe('2025-12-21T17:00:00.000Z');
      expect(range2025W52.weekEnd.toISOString()).toBe('2025-12-28T17:00:00.000Z');
    });
  });

  describe('3. Timezone Boundary Tests (UTC vs Asia/Ho_Chi_Minh - Canonical GMT+7)', () => {
    it('Giờ Việt Nam (UTC+7): Chủ Nhật 23:59:59 VN (16:59:59 UTC) thuộc tuần cũ, chưa được chốt', () => {
      const vnSundayNight = new Date('2026-10-11T16:59:59.000Z');

      expect(getUtcWeekId(vnSundayNight)).toBe('2026-W41');
      const weekEnd = getUtcWeekEnd(vnSundayNight);
      expect(isWeekFinalizable(weekEnd, vnSundayNight)).toBe(false);
    });

    it('Giờ Việt Nam (UTC+7): Thứ Hai 00:00:00 VN (17:00:00 UTC) sang tuần mới, tuần cũ đủ điều kiện chốt', () => {
      const vnMondayReset = new Date('2026-10-11T17:00:00.000Z');

      expect(getUtcWeekId(vnMondayReset)).toBe('2026-W42');
      const { weekEnd: oldWeekEnd } = getUtcWeekRangeById('2026-W41');
      expect(isWeekFinalizable(oldWeekEnd, vnMondayReset)).toBe(true);
    });

    it('Giữa ngày Chủ Nhật: 12:00:00 UTC (19:00:00 VN) vẫn thuộc tuần cũ, 18:00:00 UTC (01:00:00 Thứ Hai VN) thuộc tuần mới', () => {
      const sundayMiddayUtc = new Date('2026-10-11T12:00:00.000Z'); // 19:00:00 VN
      const sundayEveningUtc = new Date('2026-10-11T18:00:00.000Z'); // 01:00:00 Thứ Hai VN

      expect(getUtcWeekId(sundayMiddayUtc)).toBe('2026-W41');
      expect(getUtcWeekId(sundayEveningUtc)).toBe('2026-W42');
    });
  });

  describe('4. Server-Authoritative Finalization Flow & Idempotency', () => {
    it('Lần gọi đầu tiên chốt tuần thành công (FINALIZED_SUCCESS), lần gọi thứ hai trả về ALREADY_FINALIZED không duplicate', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc')
        .mockResolvedValueOnce({
          data: {
            success: true,
            code: 'FINALIZED_SUCCESS',
            week_id: '2026-W41',
            week_start: '2026-10-05T00:00:00.000Z',
            week_end: '2026-10-12T00:00:00.000Z',
            finalized_at: '2026-10-12T00:00:02.000Z',
            total_participants: 55,
            snapshots_created: { weekly_xp: 3, streak: 3 },
            frames_granted: 3,
            is_idempotent: false,
          },
          error: null,
        } as any)
        .mockResolvedValueOnce({
          data: {
            success: true,
            code: 'ALREADY_FINALIZED',
            message: 'Tuần 2026-W41 đã được chốt trước đó.',
            week_id: '2026-W41',
            is_idempotent: true,
          },
          error: null,
        } as any);

      // Gọi lần 1
      const call1 = await finalizeWeeklyLeaderboardOnServer('2026-W41');
      expect(call1.success).toBe(true);
      expect(call1.code).toBe('FINALIZED_SUCCESS');
      expect(call1.snapshotsCreated?.weekly_xp).toBe(3);

      // Gọi lần 2 (cùng tuần)
      const call2 = await finalizeWeeklyLeaderboardOnServer('2026-W41');
      expect(call2.success).toBe(true);
      expect(call2.code).toBe('ALREADY_FINALIZED');
      expect(call2.isIdempotent).toBe(true);

      expect(rpcSpy).toHaveBeenCalledTimes(2);
    });

    it('Từ chối chốt tuần đang diễn ra (WEEK_STILL_ACTIVE)', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: false,
          code: 'WEEK_STILL_ACTIVE',
          message: 'Tuần 2026-W42 vẫn đang diễn ra. Chỉ được chốt tuần sau khi tuần đã kết thúc theo giờ máy chủ UTC.',
          server_now: '2026-10-14T10:00:00.000Z',
          week_end: '2026-10-19T00:00:00.000Z',
        },
        error: null,
      } as any);

      const res = await finalizeWeeklyLeaderboardOnServer('2026-W42');
      expect(res.success).toBe(false);
      expect(res.code).toBe('WEEK_STILL_ACTIVE');
      expect(res.message).toContain('vẫn đang diễn ra');
    });
  });

  describe('5. Concurrent Finalization Protection (Advisory Lock & Single Outcome)', () => {
    it('Khi nhiều client cùng gọi finalize đồng thời tại Thứ Hai 00:00:00, chỉ 1 transaction tạo snapshot', async () => {
      // Giả lập 3 request song song tới server Postgres với pg_advisory_xact_lock
      vi.spyOn(supabase, 'rpc')
        .mockResolvedValueOnce({
          data: {
            success: true,
            code: 'FINALIZED_SUCCESS',
            week_id: '2026-W41',
            snapshots_created: { weekly_xp: 3, streak: 3 },
          },
          error: null,
        } as any)
        .mockResolvedValueOnce({
          data: {
            success: true,
            code: 'ALREADY_FINALIZED',
            week_id: '2026-W41',
            is_idempotent: true,
          },
          error: null,
        } as any)
        .mockResolvedValueOnce({
          data: {
            success: true,
            code: 'ALREADY_FINALIZED',
            week_id: '2026-W41',
            is_idempotent: true,
          },
          error: null,
        } as any);

      const [res1, res2, res3] = await Promise.all([
        finalizeWeeklyLeaderboardOnServer('2026-W41'),
        finalizeWeeklyLeaderboardOnServer('2026-W41'),
        finalizeWeeklyLeaderboardOnServer('2026-W41'),
      ]);

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
      expect(res3.success).toBe(true);

      const codes = [res1.code, res2.code, res3.code];
      const successCount = codes.filter((c) => c === 'FINALIZED_SUCCESS').length;
      const alreadyFinalizedCount = codes.filter((c) => c === 'ALREADY_FINALIZED').length;

      expect(successCount).toBe(1);
      expect(alreadyFinalizedCount).toBe(2);
    });
  });

  describe('6. XP Isolation Invariant (weekly_xp = 0, total_xp / lifetime XP giữ nguyên)', () => {
    it('calculateWeeklyXpFromHistory chỉ tính điểm của các ngày trong tuần hiện tại, cách ly hoàn toàn với tuần cũ', () => {
      const dailyHistory = {
        // Tuần 41 (Chủ Nhật 2026-10-11)
        '2026-10-11': { date: '2026-10-11', xpGained: 450 },
        // Tuần 42 (Thứ Hai 2026-10-12)
        '2026-10-12': { date: '2026-10-12', xpGained: 80 },
        // Tuần 42 (Thứ Ba 2026-10-13)
        '2026-10-13': { date: '2026-10-13', xpGained: 120 },
      };

      // Tại thời điểm trong Tuần 41 (Chủ Nhật 11/10/2026 lúc 19:00 VN)
      const weeklyXpWeek41 = calculateWeeklyXpFromHistory(
        dailyHistory,
        new Date('2026-10-11T12:00:00.000Z')
      );
      expect(weeklyXpWeek41).toBe(450);

      // Tại thời điểm trong Tuần 42 (Thứ Ba 13/10/2026): điểm tuần 41 tự động bị loại khỏi weekly XP tuần mới
      const weeklyXpWeek42 = calculateWeeklyXpFromHistory(
        dailyHistory,
        new Date('2026-10-13T12:00:00.000Z')
      );
      expect(weeklyXpWeek42).toBe(200); // 80 + 120, KHÔNG cộng 450 của tuần cũ
    });
  });

  describe('7. Historical Snapshot Preservation & Query', () => {
    it('fetchWeeklySnapshots đọc đúng ảnh chụp tuần cũ từ bảng weekly_leaderboard_snapshots, không dựa vào leaderboard_profiles hiện tại', async () => {
      const mockHistoricalSnapshots = [
        {
          id: 'snap-gold',
          week_id: '2026-W41',
          category: 'weekly_xp',
          user_id: 'user-winner-1',
          display_name: 'Học viên Quán Quân',
          avatar_url: 'https://avatar.test/gold.png',
          level: 25,
          rank: 1,
          score: 2200,
          secondary_score: 18,
          finalized_at: '2026-10-12T00:00:05.000Z',
        },
        {
          id: 'snap-silver',
          week_id: '2026-W41',
          category: 'weekly_xp',
          user_id: 'user-runner-2',
          display_name: 'Học viên Á Quân',
          avatar_url: null,
          level: 20,
          rank: 2,
          score: 1800,
          secondary_score: 12,
          finalized_at: '2026-10-12T00:00:05.000Z',
        },
      ];

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockHistoricalSnapshots,
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      const snapshots = await fetchWeeklySnapshots('2026-W41', 'weekly_xp');

      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].rank).toBe(1);
      expect(snapshots[0].displayName).toBe('Học viên Quán Quân');
      expect(snapshots[0].score).toBe(2200);
      expect(snapshots[1].rank).toBe(2);
      expect(snapshots[1].score).toBe(1800);
    });

    it('fetchFinalizedWeeks trả về lịch sử tuần đã chốt phục vụ modal vinh danh', async () => {
      const mockFinalizedList = [
        {
          week_id: '2026-W41',
          week_start: '2026-10-05T00:00:00.000Z',
          week_end: '2026-10-12T00:00:00.000Z',
          finalized_at: '2026-10-12T00:00:05.000Z',
          total_participants: 60,
          is_finalized: true,
        },
      ];

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockFinalizedList,
              error: null,
            }),
          }),
        }),
      } as any);

      const weeks = await fetchFinalizedWeeks(5);
      expect(weeks).toHaveLength(1);
      expect(weeks[0].weekId).toBe('2026-W41');
      expect(weeks[0].isFinalized).toBe(true);
    });
  });
});
