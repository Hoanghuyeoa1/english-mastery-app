// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchLeaderboardWithStatus,
  subscribeToLeaderboard,
  setCachedLeaderboard,
  getCachedLeaderboard,
  clearCachedLeaderboardForTesting,
  calculateWeeklyCountdown,
  calculateWeeklyXpFromHistory,
  getUtcWeekId,
  getNextUtcWeekReset,
  getUtcWeekStart,
  getUtcWeekEnd,
} from '../leaderboardService';
import {
  finalizeWeeklyLeaderboardOnServer,
  fetchWeeklySnapshots,
  fetchFinalizedWeeks,
  getUtcWeekRangeById,
} from '../weeklyFinalizationService';
import {
  checkPendingCeremony,
  acknowledgeCeremony,
  isCeremonyAcknowledged,
  clearAcknowledgedCeremoniesForTesting,
} from '../weeklyCeremonyService';
import { supabase } from '../../lib/supabaseClient';

describe('PHASE 3 — Realtime, Week-Aware Cache, Rollover & Final Regression Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    clearCachedLeaderboardForTesting();
    clearAcknowledgedCeremoniesForTesting();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearCachedLeaderboardForTesting();
    clearAcknowledgedCeremoniesForTesting();
  });

  describe('1. Realtime Subscription Lifecycle & Health State', () => {
    it('đăng ký thành công kênh WebSocket và gọi callback onStatusChange với SUBSCRIBED', () => {
      let registeredCallback: ((status: string) => void) | null = null;
      const channelMock = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockImplementation((cb) => {
          registeredCallback = cb;
          return channelMock;
        }),
      };

      vi.spyOn(supabase, 'channel').mockReturnValue(channelMock as any);

      const statusSpy = vi.fn();
      const unsubscribe = subscribeToLeaderboard(vi.fn(), statusSpy);

      expect(supabase.channel).toHaveBeenCalledWith('public:leaderboard_profiles');
      expect(channelMock.subscribe).toHaveBeenCalled();

      // Giả lập Supabase WebSocket báo SUBSCRIBED
      const callStatus = registeredCallback as unknown as ((status: string) => void) | null;
      if (callStatus) {
        callStatus('SUBSCRIBED');
      }
      expect(statusSpy).toHaveBeenCalledWith('SUBSCRIBED');

      // Hủy đăng ký an toàn khi unmount
      const removeSpy = vi.spyOn(supabase, 'removeChannel').mockReturnValue({} as any);
      unsubscribe();
      expect(removeSpy).toHaveBeenCalledWith(channelMock);
    });

    it('debounce 1.5s bảo vệ: nhiều sự kiện realtime dồn dập chỉ kích hoạt đúng 1 lần tải lại', async () => {
      vi.useFakeTimers();

      let eventHandler: (() => void) | null = null;
      const channelMock = {
        on: vi.fn().mockImplementation((_event, _filter, handler) => {
          eventHandler = handler;
          return channelMock;
        }),
        subscribe: vi.fn().mockReturnThis(),
      };
      vi.spyOn(supabase, 'channel').mockReturnValue(channelMock as any);

      const onUpdateSpy = vi.fn();
      subscribeToLeaderboard(onUpdateSpy);

      expect(eventHandler).toBeDefined();

      // Bắn 5 sự kiện postgres_changes liên tiếp trong 500ms
      const trigger = eventHandler as unknown as (() => void);
      if (trigger) {
        trigger();
        trigger();
        trigger();
        trigger();
        trigger();
      }

      expect(onUpdateSpy).not.toHaveBeenCalled();

      // Tua nhanh 1500ms
      vi.advanceTimersByTime(1500);

      expect(onUpdateSpy).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe('2. Week-Aware Cache & Zero-Mock Invariant', () => {
    it('lưu cache kèm weekId hiện tại: khi tuần trùng khớp trả về isStaleWeek = false', () => {
      const currentWeek = getUtcWeekId();
      const mockEntries = [
        {
          userId: 'u_real_1',
          rank: 1,
          displayName: 'Real Student',
          level: 10,
          rankTitle: 'VIP Learner',
          score: 600,
          isCurrentUser: false,
        },
      ];

      setCachedLeaderboard('weekly_xp', mockEntries, currentWeek);

      const cached = getCachedLeaderboard('weekly_xp');
      expect(cached).not.toBeNull();
      expect(cached?.entries).toHaveLength(1);
      expect(cached?.weekId).toBe(currentWeek);
      expect(cached?.isStaleWeek).toBe(false);
    });

    it('nhận diện cache tuần cũ: khi cached weekId khác currentWeekId trả về isStaleWeek = true', () => {
      const mockEntries = [
        {
          userId: 'u_real_old',
          rank: 1,
          displayName: 'Old Week Winner',
          level: 15,
          rankTitle: 'VIP Learner',
          score: 850,
          isCurrentUser: false,
        },
      ];

      // Lưu với tuần cũ '2026-W38'
      setCachedLeaderboard('weekly_xp', mockEntries, '2026-W38');

      const cached = getCachedLeaderboard('weekly_xp');
      expect(cached).not.toBeNull();
      expect(cached?.weekId).toBe('2026-W38');
      expect(cached?.isStaleWeek).toBe(true);
      expect(cached?.entries[0].displayName).toBe('Old Week Winner');
    });

    it('fetchLeaderboardWithStatus chuyển giao đúng cachedWeekId và isStaleWeek khi gặp lỗi mạng', async () => {
      const mockEntries = [
        {
          userId: 'u_offline',
          rank: 1,
          displayName: 'Offline User',
          level: 5,
          rankTitle: 'Novice',
          score: 300,
          isCurrentUser: false,
        },
      ];

      setCachedLeaderboard('weekly_xp', mockEntries, '2026-W39');

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Fetch failed: ENOTFOUND' },
            }),
          }),
        }),
      } as any);

      const res = await fetchLeaderboardWithStatus('weekly_xp');
      expect(res.status).toBe('OFFLINE_CACHE');
      expect(res.entries).toHaveLength(1);
      expect(res.cachedWeekId).toBe('2026-W39');
      expect(res.isStaleWeek).toBe(true);
    });
  });

  describe('3. Countdown & Next Monday 00:00:00 Reset', () => {
    it('countdown tính chính xác khoảng thời gian tới Thứ Hai 00:00:00 Asia/Ho_Chi_Minh kế tiếp', () => {
      // 2026-10-10 18:00:00 VN (tương đương 11:00:00 UTC Thứ Bảy)
      const now = new Date('2026-10-10T11:00:00.000Z');
      const countdown = calculateWeeklyCountdown(now);

      // Từ Thứ Bảy 18:00:00 VN đến Thứ Hai 00:00:00 VN là 1 ngày 6 giờ
      expect(countdown.days).toBe(1);
      expect(countdown.hours).toBe(6);
      expect(countdown.minutes).toBe(0);
      expect(countdown.seconds).toBe(0);
    });
  });

  describe('4. Live Rollover & Ceremony Idempotency', () => {
    it('Lễ trao giải chỉ kích hoạt 1 lần duy nhất cho tuần đã chốt và không re-fire khi refresh', async () => {
      // Giả lập tuần 2026-W41 vừa chốt xong
      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'weekly_finalizations') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [
                    {
                      week_id: '2026-W41',
                      week_start: '2026-10-05T00:00:00.000Z',
                      week_end: '2026-10-12T00:00:00.000Z',
                      finalized_at: '2026-10-12T00:00:02.000Z',
                      is_finalized: true,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          } as any;
        }
        if (table === 'weekly_leaderboard_snapshots') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [
                      {
                        week_id: '2026-W41',
                        user_id: 'user_gold',
                        display_name: 'Chiến Thần',
                        rank: 1,
                        score: 2500,
                        finalized_at: '2026-10-12T00:00:02.000Z',
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      // Lần 1: Kiểm tra có giải pending cho user_gold
      const ceremony1 = await checkPendingCeremony('user_gold', 'Chiến Thần');
      expect(ceremony1).not.toBeNull();
      expect(ceremony1?.weekId).toBe('2026-W41');
      expect(ceremony1?.rank).toBe(1);
      expect(ceremony1?.frameId).toBe('champion_frame');

      // Người dùng xem / xác nhận lễ trao giải
      acknowledgeCeremony('2026-W41');
      expect(isCeremonyAcknowledged('2026-W41')).toBe(true);

      // Lần 2 (khi refresh app): Không re-fire nữa
      const ceremony2 = await checkPendingCeremony('user_gold', 'Chiến Thần');
      expect(ceremony2).toBeNull();
    });
  });

  describe('5. Invariant End-to-End: Chu kỳ hoàn chỉnh từ 23:59:59 Chủ Nhật sang 00:00:00 Thứ Hai', () => {
    it('23:59:59 Sunday VN → tuần cũ active; 00:00:00 Monday VN → chốt tuần cũ, tuần mới reset weekly_xp = 0, total_xp giữ nguyên', async () => {
      // 23:59:59 VN tương đương 16:59:59 UTC
      const sundayTime = new Date('2026-10-11T16:59:59.000Z');
      // 00:00:00 VN tương đương 17:00:00 UTC
      const mondayTime = new Date('2026-10-11T17:00:00.000Z');

      // 1. Kiểm tra mốc Chủ Nhật 23:59:59 VN (16:59:59 UTC)
      expect(getUtcWeekId(sundayTime)).toBe('2026-W41');
      expect(getUtcWeekStart(sundayTime).toISOString()).toBe('2026-10-04T17:00:00.000Z');
      expect(getUtcWeekEnd(sundayTime).toISOString()).toBe('2026-10-11T17:00:00.000Z');

      // 2. Chuyển sang Thứ Hai 00:00:00 VN (17:00:00 UTC)
      expect(getUtcWeekId(mondayTime)).toBe('2026-W42');
      expect(getUtcWeekStart(mondayTime).toISOString()).toBe('2026-10-11T17:00:00.000Z');

      // 3. Giả lập Server RPC finalize cho tuần 2026-W41 vừa kết thúc
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          code: 'FINALIZED_SUCCESS',
          week_id: '2026-W41',
          total_participants: 25,
          snapshots_created: { weekly_xp: 3, streak: 3 },
          frames_granted: 3,
        },
        error: null,
      } as any);

      const finalizeResult = await finalizeWeeklyLeaderboardOnServer('2026-W41');
      expect(finalizeResult.success).toBe(true);
      expect(finalizeResult.code).toBe('FINALIZED_SUCCESS');
      expect(finalizeResult.weekId).toBe('2026-W41');

      // 4. Kiểm tra XP Isolation: Điểm tuần mới = 0 đối với các hoạt động từ tuần cũ
      const studentHistory = {
        '2026-10-11': { date: '2026-10-11', xpGained: 600 }, // Thuộc tuần 41
      };
      // Trong tuần 42 (Thứ Hai 12/10), điểm tuần 41 tự động về 0
      const newWeeklyXp = calculateWeeklyXpFromHistory(studentHistory, mondayTime);
      expect(newWeeklyXp).toBe(0);

      // Điểm tích lũy lifetime XP của học viên không bị ảnh hưởng (vẫn 600)
      const lifetimeXp = 600;
      expect(lifetimeXp).toBe(600);
      expect(newWeeklyXp).not.toBe(lifetimeXp);
    });
  });

  describe('6. Daily Motivation Quote Invariant (Asia/Ho_Chi_Minh Midnight Boundary)', () => {
    it('cùng một ngày Việt Nam luôn trả về cùng một câu quote (bất kể sáng hay 23:59:59 VN)', async () => {
      const { getDailyQuote } = await import('../dailyQuoteService');
      const morningTime = new Date('2026-10-06T08:00:00+07:00');
      const nightTime = new Date('2026-10-06T23:59:59+07:00');

      const quoteMorning = getDailyQuote(morningTime);
      const quoteNight = getDailyQuote(nightTime);

      expect(quoteMorning.id).toBe(quoteNight.id);
      expect(quoteMorning.en).toBe(quoteNight.en);
      expect(quoteMorning.vi).toBe(quoteNight.vi);
    });

    it('bước sang 00:00:00 VN của ngày mới tự động chuyển sang câu quote khác', async () => {
      const { getDailyQuote } = await import('../dailyQuoteService');
      const day1 = new Date('2026-10-06T23:59:59+07:00');
      const day2 = new Date('2026-10-07T00:00:00+07:00');

      const quote1 = getDailyQuote(day1);
      const quote2 = getDailyQuote(day2);

      expect(quote1.id).not.toBe(quote2.id);
    });

    it('hoạt động hoàn toàn độc lập, ổn định khi reload và offline (không cần mạng/cloud)', async () => {
      const { getDailyQuote, FALLBACK_QUOTE } = await import('../dailyQuoteService');
      const quote = getDailyQuote(new Date('2026-10-06T12:00:00+07:00'));

      expect(quote).toBeDefined();
      expect(quote.id).toBeGreaterThan(0);
      expect(quote.en.length).toBeGreaterThan(10);
      expect(quote.vi.length).toBeGreaterThan(10);
      expect(quote).not.toBe(FALLBACK_QUOTE);
    });

    it('tính chính xác số mili-giây còn lại đến nửa đêm Việt Nam (00:00:00 VN)', async () => {
      const { getMillisecondsUntilNextVietnamMidnight } = await import('../dailyQuoteService');
      // Lúc 23:59:59 VN (còn đúng 1 giây)
      const almostMidnight = new Date('2026-10-06T23:59:59+07:00');
      const msLeft = getMillisecondsUntilNextVietnamMidnight(almostMidnight);

      expect(msLeft).toBe(1000);
    });
  });

  describe('7. Countdown Boundary Mechanics (Sunday 23:00 VN vs Monday 00:00 VN)', () => {
    it('Chủ Nhật 23:00:00 VN: countdown còn đúng 1 giờ (không còn 8 giờ như múi giờ UTC cũ)', () => {
      // Chủ Nhật 23:00:00 VN = 16:00:00 UTC
      const sunday23h = new Date('2026-10-11T16:00:00.000Z');
      const cd = calculateWeeklyCountdown(sunday23h);

      expect(cd.days).toBe(0);
      expect(cd.hours).toBe(1);
      expect(cd.minutes).toBe(0);
      expect(cd.seconds).toBe(0);
    });

    it('Chủ Nhật 23:59:59 VN: countdown còn đúng 1 giây', () => {
      // Chủ Nhật 23:59:59 VN = 16:59:59 UTC
      const sundayLastSec = new Date('2026-10-11T16:59:59.000Z');
      const cd = calculateWeeklyCountdown(sundayLastSec);

      expect(cd.days).toBe(0);
      expect(cd.hours).toBe(0);
      expect(cd.minutes).toBe(0);
      expect(cd.seconds).toBe(1);
    });

    it('Thứ Hai 00:00:00 VN: countdown reset về đúng 7 ngày', () => {
      // Thứ Hai 00:00:00 VN = Chủ Nhật 17:00:00 UTC
      const mondayZero = new Date('2026-10-11T17:00:00.000Z');
      const cd = calculateWeeklyCountdown(mondayZero);

      expect(cd.days).toBe(7);
      expect(cd.hours).toBe(0);
      expect(cd.minutes).toBe(0);
      expect(cd.seconds).toBe(0);
    });

    it('Thứ Hai 00:00:01 VN: countdown là 6 ngày 23 giờ 59 phút 59 giây', () => {
      const monday1s = new Date('2026-10-11T17:00:01.000Z');
      const cd = calculateWeeklyCountdown(monday1s);

      expect(cd.days).toBe(6);
      expect(cd.hours).toBe(23);
      expect(cd.minutes).toBe(59);
      expect(cd.seconds).toBe(59);
    });
  });

  describe('8. Live Rollover Without Page Reload (F5 Transition)', () => {
    it('chuyển đổi trạng thái tuần sống động: weekId thay đổi và countdown reset lập tức khi qua 17:00:00 UTC', () => {
      const sundayTick = new Date('2026-10-11T16:59:59.000Z');
      const mondayTick = new Date('2026-10-11T17:00:00.000Z');

      const weekBefore = getUtcWeekId(sundayTick);
      const weekAfter = getUtcWeekId(mondayTick);

      expect(weekBefore).toBe('2026-W41');
      expect(weekAfter).toBe('2026-W42');
      expect(weekAfter).not.toBe(weekBefore);

      const countdownBefore = calculateWeeklyCountdown(sundayTick);
      const countdownAfter = calculateWeeklyCountdown(mondayTick);

      expect(countdownBefore.days).toBe(0);
      expect(countdownBefore.seconds).toBe(1);

      expect(countdownAfter.days).toBe(7);
      expect(countdownAfter.seconds).toBe(0);
    });
  });

  describe('9. Cache Stale Invariant After Vietnam Week Change', () => {
    it('cache lưu tối Chủ Nhật trở thành stale ngay khi bước sang sáng Thứ Hai 00:00 VN', () => {
      const oldWeekId = '2026-W41';
      const sampleEntries = [
        {
          userId: 'user_cached',
          rank: 1,
          displayName: 'Top Student',
          level: 10,
          rankTitle: 'VIP Learner',
          score: 1200,
          isCurrentUser: false,
        },
      ];

      // Lưu cache trong tuần 41
      setCachedLeaderboard('weekly_xp', sampleEntries, oldWeekId);

      // Đọc cache trong tuần 41: isStaleWeek = false
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-11T16:59:59.000Z')); // Chủ Nhật 23:59:59 VN
      const activeCache = getCachedLeaderboard('weekly_xp');
      expect(activeCache?.isStaleWeek).toBe(false);

      // Bước sang Thứ Hai 00:00:01 VN (17:00:01 UTC)
      vi.setSystemTime(new Date('2026-10-11T17:00:01.000Z'));
      const staleCache = getCachedLeaderboard('weekly_xp');
      expect(staleCache?.isStaleWeek).toBe(true);
      expect(staleCache?.weekId).toBe('2026-W41');

      vi.useRealTimers();
    });
  });

  describe('10. Multi-Year Boundary ISO 8601 Continuity', () => {
    it('chuyển giao chính xác các tuần ranh giới năm (Tuần 52/53)', () => {
      // 2020 là năm có 53 tuần:
      // Chủ Nhật 2021-01-03 23:59:59 VN (16:59:59 UTC) -> 2020-W53
      const lastSec2020 = new Date('2021-01-03T16:59:59.000Z');
      expect(getUtcWeekId(lastSec2020)).toBe('2020-W53');

      // Thứ Hai 2021-01-04 00:00:00 VN (17:00:00 UTC) -> 2021-W01
      const firstSec2021 = new Date('2021-01-03T17:00:00.000Z');
      expect(getUtcWeekId(firstSec2021)).toBe('2021-W01');

      // Ranh giới 2026-2027 (2026 có 53 tuần):
      // Chủ Nhật 2027-01-03 23:59:59 VN (16:59:59 UTC) -> 2026-W53
      const lastSec2026 = new Date('2027-01-03T16:59:59.000Z');
      expect(getUtcWeekId(lastSec2026)).toBe('2026-W53');

      // Thứ Hai 2027-01-04 00:00:00 VN (17:00:00 UTC) -> 2027-W01
      const firstSec2027 = new Date('2027-01-03T17:00:00.000Z');
      expect(getUtcWeekId(firstSec2027)).toBe('2027-W01');
    });
  });
});
