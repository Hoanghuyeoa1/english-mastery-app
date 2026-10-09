// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchLeaderboard,
  fetchLeaderboardWithStatus,
  calculateWeeklyCountdown,
  calculateWeeklyXpFromHistory,
  getRankTitle,
  getUtcWeekStart,
  getUtcWeekEnd,
  getUtcWeekId,
  getCurrentUtcWeekDates,
  isLeaderboardEligible,
  sanitizePublicDisplayName,
  compareLeaderboardWeeklyXp,
  compareLeaderboardStreak,
  subscribeToLeaderboard,
  syncUserScoreToLeaderboard,
  classifyLeaderboardError,
  setCachedLeaderboard,
  clearCachedLeaderboardForTesting,
  resetLeaderboardSubscriptionForTesting,
  type RawLeaderboardProfile,
} from '../leaderboardService';
import * as supabaseClientModule from '../../lib/supabaseClient';
import { supabase } from '../../lib/supabaseClient';
import * as signalRServiceModule from '../api/signalRService';

describe('leaderboardService (Real-User Realtime Leaderboard & Zero-Mock Foundation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    clearCachedLeaderboardForTesting();
    (supabase as any)._isLegacySupabaseMock = true;
    if (supabase?.from) (supabase.from as any)._isLegacySupabaseMock = true;
    if (supabase?.rpc) (supabase.rpc as any)._isLegacySupabaseMock = true;
  });

  afterEach(() => {
    delete (supabase as any)._isLegacySupabaseMock;
    if (supabase?.from) delete (supabase.from as any)._isLegacySupabaseMock;
    if (supabase?.rpc) delete (supabase.rpc as any)._isLegacySupabaseMock;
    vi.restoreAllMocks();
    clearCachedLeaderboardForTesting();
  });

  describe('1. Cấp bậc danh hiệu (getRankTitle)', () => {
    it('ánh xạ chính xác danh hiệu theo cấp độ học viên', () => {
      expect(getRankTitle(1)).toBe('Novice');
      expect(getRankTitle(9)).toBe('Novice');
      expect(getRankTitle(10)).toBe('VIP Learner');
      expect(getRankTitle(24)).toBe('VIP Learner');
      expect(getRankTitle(25)).toBe('Master Scholar');
      expect(getRankTitle(49)).toBe('Master Scholar');
      expect(getRankTitle(50)).toBe('Mythic Legend');
      expect(getRankTitle(75)).toBe('Mythic Legend');
    });
  });

  describe('2. Real-User Eligibility & An toàn dữ liệu công khai (Public Data Safety)', () => {
    it('isLeaderboardEligible chỉ chấp nhận người dùng hợp lệ', () => {
      expect(isLeaderboardEligible({ id: 'uuid-123', level: 1 })).toBe(true);
      expect(isLeaderboardEligible({ id: 'uuid-456', level: 25 })).toBe(true);

      // Loại bỏ tài khoản bị cấm hoặc bị xóa
      expect(isLeaderboardEligible({ id: 'uuid-789', is_deleted: true })).toBe(false);
      expect(isLeaderboardEligible({ id: 'uuid-101', is_banned: true })).toBe(false);

      // Loại bỏ bản ghi không có ID hoặc level không hợp lệ
      expect(isLeaderboardEligible({ id: '', level: 5 })).toBe(false);
      expect(isLeaderboardEligible({ id: '   ', level: 5 })).toBe(false);
      expect(isLeaderboardEligible({ id: 'uuid-202', level: 0 })).toBe(false);
      expect(isLeaderboardEligible(null as any)).toBe(false);
    });

    it('sanitizePublicDisplayName không làm lộ email của người dùng', () => {
      expect(sanitizePublicDisplayName('hoang.dev@gmail.com')).toBe('hoang.dev');
      expect(sanitizePublicDisplayName('user_12345@domain.org')).toBe('user_12345');
      expect(sanitizePublicDisplayName('Nguyễn Văn A')).toBe('Nguyễn Văn A');
      expect(sanitizePublicDisplayName('')).toBe('Học viên ẩn danh');
      expect(sanitizePublicDisplayName(null)).toBe('Học viên ẩn danh');
    });
  });

  describe('3. Chuẩn hóa Weekly XP và Ranh giới tuần UTC (Week Boundary & Deterministic ID)', () => {
    it('xác định chính xác mốc bắt đầu tuần (Thứ Hai 00:00:00 VN = Chủ Nhật 17:00:00 UTC) và kết thúc tuần (Thứ Hai 00:00:00 VN kế tiếp)', () => {
      // 2026-10-07 là Thứ Tư
      const refDate = new Date('2026-10-07T14:30:00Z');
      const start = getUtcWeekStart(refDate);
      const end = getUtcWeekEnd(refDate);

      expect(start.toISOString()).toBe('2026-10-04T17:00:00.000Z');
      expect(end.toISOString()).toBe('2026-10-11T17:00:00.000Z');
    });

    it('trả về đúng 7 ngày trong tuần lịch Việt Nam hiện tại', () => {
      const dates = getCurrentUtcWeekDates(new Date('2026-10-08T10:00:00Z'));
      expect(dates).toEqual([
        '2026-10-05',
        '2026-10-06',
        '2026-10-07',
        '2026-10-08',
        '2026-10-09',
        '2026-10-10',
        '2026-10-11',
      ]);
    });

    it('sinh deterministic ISO week ID chính xác', () => {
      expect(getUtcWeekId(new Date('2026-10-05T00:00:00Z'))).toBe('2026-W41');
      expect(getUtcWeekId(new Date('2026-10-11T16:59:59Z'))).toBe('2026-W41'); // Chủ Nhật 23:59:59 VN
      expect(getUtcWeekId(new Date('2026-10-11T17:00:00Z'))).toBe('2026-W42'); // Thứ Hai 00:00:00 VN
    });

    it('calculateWeeklyXpFromHistory chỉ tính XP trong tuần hiện tại (lifetimeXp != weeklyXp)', () => {
      const dailyHistory = {
        // Tuần trước (Chủ Nhật 2026-10-04)
        '2026-10-04': { date: '2026-10-04', xpGained: 500 },
        // Tuần này (2026-10-05 đến 2026-10-11)
        '2026-10-05': { date: '2026-10-05', xpGained: 150 },
        '2026-10-06': { date: '2026-10-06', xpGained: 250 },
        '2026-10-07': { date: '2026-10-07', xpGained: 100 },
      };

      const refDate = new Date('2026-10-07T12:00:00Z');
      const weeklyXp = calculateWeeklyXpFromHistory(dailyHistory as any, refDate);

      // Chỉ tính 150 + 250 + 100 = 500 XP của tuần này, không tính 500 XP tuần trước
      expect(weeklyXp).toBe(500);
    });
  });

  describe('4. Sắp xếp thứ hạng tất định (Deterministic Tie-break)', () => {
    it('Top Weekly XP: ưu tiên weekly_xp DESC, tie-break streak DESC, last_active_at ASC, id ASC', () => {
      const user1: RawLeaderboardProfile = {
        id: 'user_b',
        display_name: 'User B',
        level: 10,
        total_xp: 5000,
        weekly_xp: 500,
        streak: 5,
        last_active_at: '2026-10-07T10:30:00Z',
      };
      const user2: RawLeaderboardProfile = {
        id: 'user_a',
        display_name: 'User A',
        level: 10,
        total_xp: 4000,
        weekly_xp: 500,
        streak: 5,
        last_active_at: '2026-10-07T10:00:00Z', // Đạt trước user B
      };
      const user3: RawLeaderboardProfile = {
        id: 'user_c',
        display_name: 'User C',
        level: 12,
        total_xp: 6000,
        weekly_xp: 500,
        streak: 10, // Streak cao hơn user A và B
        last_active_at: '2026-10-07T11:00:00Z',
      };

      const list = [user1, user2, user3];
      list.sort(compareLeaderboardWeeklyXp);

      // Thứ tự kỳ vọng: user C (streak 10) -> user A (streak 5, active lúc 10:00) -> user B (streak 5, active lúc 10:30)
      expect(list[0].id).toBe('user_c');
      expect(list[1].id).toBe('user_a');
      expect(list[2].id).toBe('user_b');
    });

    it('Top Streak: ưu tiên streak DESC, tie-break weekly_xp DESC, last_active_at ASC, id ASC', () => {
      const user1: RawLeaderboardProfile = {
        id: 'user_1',
        display_name: 'User 1',
        level: 10,
        total_xp: 2000,
        weekly_xp: 300,
        streak: 20,
        last_active_at: '2026-10-07T10:00:00Z',
      };
      const user2: RawLeaderboardProfile = {
        id: 'user_2',
        display_name: 'User 2',
        level: 15,
        total_xp: 4000,
        weekly_xp: 800, // XP cao hơn
        streak: 20,
        last_active_at: '2026-10-07T10:00:00Z',
      };

      const list = [user1, user2];
      list.sort(compareLeaderboardStreak);

      expect(list[0].id).toBe('user_2');
      expect(list[1].id).toBe('user_1');
    });
  });

  describe('5. Truy vấn Real-User & Loại bỏ hoàn toàn Mock Users', () => {
    function setupMockQuery(data: any, error: any = null) {
      const mockQueryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data, error }),
      };
      vi.spyOn(supabase, 'from').mockReturnValue(mockQueryBuilder);
      return mockQueryBuilder;
    }

    it('3 real users → leaderboard = 3', async () => {
      const mockUsers = [
        {
          id: 'u1',
          display_name: 'Real User 1',
          level: 10,
          total_xp: 1000,
          weekly_xp: 500,
          streak: 5,
          last_active_at: new Date().toISOString(),
        },
        {
          id: 'u2',
          display_name: 'Real User 2',
          level: 20,
          total_xp: 2000,
          weekly_xp: 800,
          streak: 10,
          last_active_at: new Date().toISOString(),
        },
        {
          id: 'u3',
          display_name: 'Real User 3',
          level: 30,
          total_xp: 3000,
          weekly_xp: 600,
          streak: 7,
          last_active_at: new Date().toISOString(),
        },
      ];

      setupMockQuery(mockUsers);

      const entries = await fetchLeaderboard('weekly_xp');

      expect(entries).toHaveLength(3);
      expect(entries[0].userId).toBe('u2');
      expect(entries[0].rank).toBe(1);
      expect(entries[1].userId).toBe('u3');
      expect(entries[1].rank).toBe(2);
      expect(entries[2].userId).toBe('u1');
      expect(entries[2].rank).toBe(3);
    });

    it('Weekly XP ordering: A=500, B=800, C=600 → B, C, A', async () => {
      const nowIso = new Date().toISOString();
      const mockUsers = [
        { id: 'user_A', display_name: 'A', level: 5, weekly_xp: 500, streak: 3, last_active_at: nowIso },
        { id: 'user_B', display_name: 'B', level: 8, weekly_xp: 800, streak: 4, last_active_at: nowIso },
        { id: 'user_C', display_name: 'C', level: 6, weekly_xp: 600, streak: 2, last_active_at: nowIso },
      ];

      setupMockQuery(mockUsers);

      const entries = await fetchLeaderboard('weekly_xp');

      expect(entries.map((e) => e.userId)).toEqual(['user_B', 'user_C', 'user_A']);
      expect(entries.map((e) => e.score)).toEqual([800, 600, 500]);
    });

    it('0 users → empty state (danh sách rỗng, không bù fake users)', async () => {
      setupMockQuery([]);

      const entries = await fetchLeaderboard('weekly_xp');

      expect(entries).toEqual([]);
      expect(entries).toHaveLength(0);
    });

    it('offline / error → no mock users (tuyệt đối không trả về 12 fake users)', async () => {
      // 1. Khi Supabase trả về lỗi query
      setupMockQuery(null, { message: 'Network offline / connection refused' });
      const resQueryError = await fetchLeaderboard('weekly_xp');
      expect(resQueryError).toEqual([]);

      // 2. Khi Supabase ném ngoại lệ Runtime
      vi.spyOn(supabase, 'from').mockImplementation(() => {
        throw new Error('Fatal socket error');
      });
      const resException = await fetchLeaderboard('streak');
      expect(resException).toEqual([]);

      // 3. fetchLeaderboardWithStatus báo lỗi rõ ràng để UI hiển thị trạng thái Connection Error
      const statusRes = await fetchLeaderboardWithStatus('weekly_xp');
      expect(statusRes.entries).toEqual([]);
      expect(statusRes.error).toBeDefined();
    });

    it('không để lộ thông tin nhạy cảm (Public data safety)', async () => {
      const mockUserWithPrivateData = [
        {
          id: 'u_safe',
          display_name: 'learner@secret.com',
          avatar_url: 'https://avatar.test/pic.png',
          level: 15,
          total_xp: 2500,
          weekly_xp: 450,
          streak: 12,
          last_active_at: new Date().toISOString(),
          // Các trường nhạy cảm giả lập có thể có trong DB
          email: 'admin@system.com',
          gemini_api_key: 'AIzaSyPrivate...',
          token: 'jwt.token.secret',
        },
      ];

      setupMockQuery(mockUserWithPrivateData);

      const entries = await fetchLeaderboard('weekly_xp');

      expect(entries).toHaveLength(1);
      const entry = entries[0] as any;
      expect(entry.userId).toBe('u_safe');
      expect(entry.displayName).toBe('learner'); // Đã sanitize, không còn domain email
      expect(entry.score).toBe(450);
      expect(entry.email).toBeUndefined();
      expect(entry.gemini_api_key).toBeUndefined();
      expect(entry.token).toBeUndefined();
    });
  });

  describe('6. Tính toán thời gian đếm ngược tuần (calculateWeeklyCountdown)', () => {
    it('tính chính xác khi thời điểm là Thứ Bảy 20:30:15 VN (13:30:15 UTC)', () => {
      // 2026-10-10 là Thứ Bảy (13:30:15 UTC = 20:30:15 VN)
      const testDate = new Date(Date.UTC(2026, 9, 10, 13, 30, 15, 0));
      const countdown = calculateWeeklyCountdown(testDate);

      // Từ Thứ Bảy 20:30:15 VN đến Thứ Hai 00:00:00 VN là 1 ngày, 3 giờ, 29 phút, 45 giây
      expect(countdown.days).toBe(1);
      expect(countdown.hours).toBe(3);
      expect(countdown.minutes).toBe(29);
      expect(countdown.seconds).toBe(45);
    });

    it('tính chính xác khi thời điểm là Chủ Nhật 22:00:00 VN (15:00:00 UTC)', () => {
      // 15:00:00 UTC = 22:00:00 VN
      const testDate = new Date(Date.UTC(2026, 9, 11, 15, 0, 0, 0));
      const countdown = calculateWeeklyCountdown(testDate);

      // Từ Chủ Nhật 22:00:00 VN đến Thứ Hai 00:00:00 VN là đúng 2 giờ
      expect(countdown.days).toBe(0);
      expect(countdown.hours).toBe(2);
      expect(countdown.minutes).toBe(0);
      expect(countdown.seconds).toBe(0);
    });

    it('tính chính xác khi thời điểm là đúng Chủ Nhật 23:59:59 VN (16:59:59 UTC)', () => {
      // 16:59:59.000 UTC = 23:59:59.000 VN: còn đúng 1 giây đến Thứ Hai 00:00:00 VN
      const testDate1s = new Date(Date.UTC(2026, 9, 11, 16, 59, 59, 0));
      const countdown1s = calculateWeeklyCountdown(testDate1s);
      expect(countdown1s.days).toBe(0);
      expect(countdown1s.hours).toBe(0);
      expect(countdown1s.minutes).toBe(0);
      expect(countdown1s.seconds).toBe(1);

      // 16:59:59.500 UTC = 23:59:59.500 VN: còn < 1s
      const testDate = new Date(Date.UTC(2026, 9, 11, 16, 59, 59, 500));
      const countdown = calculateWeeklyCountdown(testDate);

      expect(countdown.days).toBe(0);
      expect(countdown.hours).toBe(0);
      expect(countdown.minutes).toBe(0);
      expect(countdown.seconds).toBe(0);
    });

    it('tính chính xác khi thời điểm là Thứ Hai 00:00:00 VN (17:00:00 UTC Chủ Nhật)', () => {
      // 17:00:00 UTC = Thứ Hai 00:00:00 VN
      const testDate = new Date(Date.UTC(2026, 9, 11, 17, 0, 0, 0));
      const countdown = calculateWeeklyCountdown(testDate);

      // Mốc bắt đầu tuần mới: reset đếm ngược 7 ngày đến Thứ Hai kế tiếp
      expect(countdown.days).toBe(7);
      expect(countdown.hours).toBe(0);
      expect(countdown.minutes).toBe(0);
      expect(countdown.seconds).toBe(0);

      // 1 giây sau khi tuần mới bắt đầu (Thứ Hai 00:00:01 VN = 17:00:01 UTC)
      const testDate1s = new Date(Date.UTC(2026, 9, 11, 17, 0, 1, 0));
      const countdown1s = calculateWeeklyCountdown(testDate1s);
      expect(countdown1s.days).toBe(6);
      expect(countdown1s.hours).toBe(23);
      expect(countdown1s.minutes).toBe(59);
      expect(countdown1s.seconds).toBe(59);
    });
  });

  describe('7. Realtime Subscription & Upsert Safety', () => {
    it('subscribeToLeaderboard đăng ký kênh realtime SignalR và trả về hàm cleanup an toàn', () => {
      resetLeaderboardSubscriptionForTesting();
      const mockCleanup = vi.fn();
      const registerSpy = vi.spyOn(signalRServiceModule, 'registerSignalRSubscriber').mockReturnValue(mockCleanup);

      const onUpdate = vi.fn();
      const unsubscribe = subscribeToLeaderboard(onUpdate);

      expect(registerSpy).toHaveBeenCalled();

      // Kiểm tra hàm cleanup
      unsubscribe();
      expect(mockCleanup).toHaveBeenCalled();
      resetLeaderboardSubscriptionForTesting();
    });

    it('syncUserScoreToLeaderboard thực hiện an toàn và không ném ngoại lệ khi chưa đăng nhập', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: null },
        error: null,
      } as any);

      await expect(syncUserScoreToLeaderboard({ totalXp: 150 })).resolves.toBeUndefined();
    });

    it('syncUserScoreToLeaderboard gửi đúng payload phân biệt weeklyXp và totalXp', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      vi.spyOn(supabase, 'from').mockReturnValue({
        upsert: mockUpsert,
      } as any);

      await syncUserScoreToLeaderboard({
        userId: 'auth_user_123',
        displayName: 'hoang_scholar',
        level: 15,
        totalXp: 8500, // lifetime XP
        weeklyXp: 450, // weekly XP
        streak: 22,
      });

      expect(supabase.from).toHaveBeenCalledWith('leaderboard_profiles');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'auth_user_123',
          display_name: 'hoang_scholar',
          level: 15,
          total_xp: 8500,
          weekly_xp: 450,
          streak: 22,
        }),
        { onConflict: 'id' }
      );
    });
  });

  describe('7. PHASE 1 — Root Cause, Error Taxonomy & Initial Fetch Resilience Suite', () => {
    function setupMockQuery(data: any, error: any = null) {
      const mockQueryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data, error }),
      };
      vi.spyOn(supabase, 'from').mockReturnValue(mockQueryBuilder);
      return mockQueryBuilder;
    }

    beforeEach(() => {
      clearCachedLeaderboardForTesting();
    });

    it('1. valid Supabase → real leaderboard với status SUCCESS', async () => {
      const nowIso = new Date().toISOString();
      setupMockQuery([
        {
          id: 'user_real_1',
          display_name: 'Minh Tuấn',
          avatar_url: null,
          level: 12,
          total_xp: 2400,
          weekly_xp: 500,
          streak: 14,
          last_active_at: nowIso,
          equipped_frame: 'champion_frame',
        },
      ]);

      const res = await fetchLeaderboardWithStatus('weekly_xp');
      expect(res.status).toBe('SUCCESS');
      expect(res.error).toBeNull();
      expect(res.entries).toHaveLength(1);
      expect(res.entries[0].userId).toBe('user_real_1');
      expect(res.entries[0].equippedFrame).toBe('champion_frame');
    });

    it('2. missing config → CONFIG_ERROR (không ném uncaught exception)', async () => {
      vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(false);
      // Giả lập client không bị mock bởi test
      const originalFrom = supabase.from;
      (supabase as any).from = undefined;

      try {
        const res = await fetchLeaderboardWithStatus('weekly_xp');
        expect(res.status).toBe('CONFIG_ERROR');
        expect(res.error).toBeDefined();
        expect(res.errorInfo?.code).toBe('CONFIG_ERROR');
        expect(res.entries).toEqual([]);
      } finally {
        supabase.from = originalFrom;
      }
    });

    it('3. network failure (fetch failed / ENOTFOUND) → NETWORK_ERROR hoặc OFFLINE_CACHE', async () => {
      // 3.1. Chưa có cache: trả về NETWORK_ERROR
      setupMockQuery(null, {
        message: 'TypeError: fetch failed (ENOTFOUND pgkpqvsuxbcrcpazwqiq.supabase.co)',
      });

      const resNoCache = await fetchLeaderboardWithStatus('weekly_xp');
      expect(resNoCache.status).toBe('NETWORK_ERROR');
      expect(resNoCache.entries).toHaveLength(0);
      expect(resNoCache.errorInfo?.code).toBe('NETWORK_ERROR');

      // 3.2. Có cache thực tế: an toàn phục hồi OFFLINE_CACHE
      setCachedLeaderboard('weekly_xp', [
        {
          userId: 'cached_user_1',
          rank: 1,
          displayName: 'Cached Real User',
          level: 10,
          rankTitle: 'VIP Learner',
          score: 300,
          isCurrentUser: false,
        },
      ]);

      const resWithCache = await fetchLeaderboardWithStatus('weekly_xp');
      expect(resWithCache.status).toBe('OFFLINE_CACHE');
      expect(resWithCache.error).toBe('offline');
      expect(resWithCache.entries).toHaveLength(1);
      expect(resWithCache.entries[0].displayName).toBe('Cached Real User');
    });

    it('4. RLS denied / permission error (42501) → PERMISSION_ERROR', async () => {
      setupMockQuery(null, {
        code: '42501',
        message: 'permission denied for table leaderboard_profiles (violates row-level security policy)',
      });

      const res = await fetchLeaderboardWithStatus('weekly_xp');
      expect(res.status).toBe('PERMISSION_ERROR');
      expect(res.errorInfo?.code).toBe('PERMISSION_ERROR');
      expect(res.entries).toEqual([]);
    });

    it('5. query/schema error (42P01 table does not exist) → QUERY_ERROR', async () => {
      setupMockQuery(null, {
        code: '42P01',
        message: 'relation "public.leaderboard_profiles" does not exist',
      });

      const res = await fetchLeaderboardWithStatus('weekly_xp');
      expect(res.status).toBe('QUERY_ERROR');
      expect(res.errorInfo?.code).toBe('QUERY_ERROR');
      expect(res.entries).toEqual([]);
    });

    it('6. schema column mismatch (42703 equipped_frame) → fallback truy vấn thành công', async () => {
      const nowIso = new Date().toISOString();
      const mockQueryBuilder: any = {
        select: vi.fn().mockImplementation((fields: string) => {
          return {
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockImplementation(() => {
              if (fields.includes('equipped_frame')) {
                return Promise.resolve({
                  data: null,
                  error: { code: '42703', message: 'column leaderboard_profiles.equipped_frame does not exist' },
                });
              }
              return Promise.resolve({
                data: [
                  {
                    id: 'u_legacy_schema',
                    display_name: 'Legacy Learner',
                    level: 5,
                    total_xp: 1000,
                    weekly_xp: 250,
                    streak: 3,
                    last_active_at: nowIso,
                  },
                ],
                error: null,
              });
            }),
          };
        }),
      };
      vi.spyOn(supabase, 'from').mockReturnValue(mockQueryBuilder);

      const res = await fetchLeaderboardWithStatus('weekly_xp');
      expect(res.status).toBe('SUCCESS');
      expect(res.error).toBeNull();
      expect(res.entries).toHaveLength(1);
      expect(res.entries[0].displayName).toBe('Legacy Learner');
      expect(res.entries[0].equippedFrame).toBeUndefined();
    });

    it('7. timeout (> 3000ms) → TIMEOUT', async () => {
      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation(() => new Promise(() => {})), // never resolves
      } as any);

      // Chạy với timeout giả lập
      vi.useFakeTimers();
      const fetchPromise = fetchLeaderboardWithStatus('weekly_xp');
      vi.advanceTimersByTime(3100);
      const res = await fetchPromise;
      vi.useRealTimers();

      expect(res.status).toBe('TIMEOUT');
      expect(res.errorInfo?.code).toBe('TIMEOUT');
      expect(res.entries).toEqual([]);
    });

    it('8. classifyLeaderboardError chuẩn hóa chính xác mọi mã lỗi taxonomy', () => {
      expect(classifyLeaderboardError({ message: 'query timeout sau 3000ms' }).status).toBe('TIMEOUT');
      expect(classifyLeaderboardError({ code: '42501', message: 'permission denied' }).status).toBe('PERMISSION_ERROR');
      expect(classifyLeaderboardError({ code: '401', message: 'JWT expired' }).status).toBe('AUTH_ERROR');
      expect(classifyLeaderboardError({ message: 'VITE_SUPABASE_URL chưa được cấu hình' }).status).toBe('CONFIG_ERROR');
      expect(classifyLeaderboardError(new TypeError('fetch failed')).status).toBe('NETWORK_ERROR');
      expect(classifyLeaderboardError({ code: '42P01', message: 'relation does not exist' }).status).toBe('QUERY_ERROR');
    });

    it('9. zero mock accounts: tuyệt đối không bù fake accounts trong bất kỳ trạng thái lỗi nào', async () => {
      // Khi rỗng
      setupMockQuery([]);
      const emptyRes = await fetchLeaderboardWithStatus('weekly_xp');
      expect(emptyRes.entries).toEqual([]);

      // Khi lỗi mạng
      setupMockQuery(null, { message: 'connection refused' });
      const netRes = await fetchLeaderboardWithStatus('weekly_xp');
      expect(netRes.entries).toEqual([]);

      // Khi lỗi phân quyền
      setupMockQuery(null, { code: '42501', message: 'permission denied' });
      const rlsRes = await fetchLeaderboardWithStatus('weekly_xp');
      expect(rlsRes.entries).toEqual([]);
    });
  });
});

