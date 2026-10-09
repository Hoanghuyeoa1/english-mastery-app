// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchLeaderboardWithStatus,
  subscribeToLeaderboard,
  getMyLeaderboardRank,
  getCachedLeaderboard,
  setCachedLeaderboard,
  clearCachedLeaderboardForTesting,
  clearLeaderboardDebounceForTesting,
  getUtcWeekId,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  REALTIME_DEBOUNCE_WAIT_MS,
  REALTIME_MAX_WAIT_MS,
} from '../leaderboardService';
import { supabase } from '../../lib/supabaseClient';

describe('PHASE 2 — Realtime Leaderboard Scalability & Backend Pagination Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: null, error: null } as any);
    clearCachedLeaderboardForTesting();
    clearLeaderboardDebounceForTesting();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearCachedLeaderboardForTesting();
    clearLeaderboardDebounceForTesting();
  });

  function setupMockTableQuery(data: any = [], error: any = null) {
    const mockQueryBuilder: any = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
    };
    mockQueryBuilder.then = (resolve: any) => resolve({ data, error });
    vi.spyOn(supabase, 'from').mockReturnValue(mockQueryBuilder);
    return mockQueryBuilder;
  }

  // ==========================================================================
  // 1. REALTIME DEBOUNCE & SUBSCRIPTION LIFECYCLE
  // ==========================================================================
  describe('1. Realtime Debounce & Subscription Lifecycle', () => {
    it('10 sự kiện liên tiếp (burst) gom lại thành đúng 1 bounded refresh sau ~1.5s', async () => {
      vi.useFakeTimers();

      let eventHandler: (() => void) | null = null;
      const channelMock = {
        on: vi.fn().mockImplementation((_event, _filter, handler) => {
          eventHandler = handler;
          return channelMock;
        }),
        subscribe: vi.fn().mockReturnThis(),
        unsubscribe: vi.fn().mockResolvedValue('ok'),
      };
      vi.spyOn(supabase, 'channel').mockReturnValue(channelMock as any);

      const onUpdateSpy = vi.fn();
      const unsubscribe = subscribeToLeaderboard(onUpdateSpy);

      expect(supabase.channel).toHaveBeenCalledWith('public:leaderboard_profiles');
      expect(eventHandler).toBeDefined();

      const trigger = eventHandler as unknown as () => void;

      // Giả lập 10 rapid events bắn dồn dập trong 300ms
      for (let i = 0; i < 10; i++) {
        trigger();
        vi.advanceTimersByTime(30);
      }

      // Chưa đủ 1500ms kể từ sự kiện cuối cùng: không được refresh
      expect(onUpdateSpy).not.toHaveBeenCalled();

      // Tiến đồng hồ thêm 1500ms
      vi.advanceTimersByTime(1500);

      // Đúng 1 lần refresh duy nhất cho toàn bộ 10 sự kiện burst
      expect(onUpdateSpy).toHaveBeenCalledTimes(1);

      unsubscribe();
      vi.useRealTimers();
    });

    it('debounce timer cleanup hoạt động chuẩn khi unmount và không rò rỉ timer', async () => {
      vi.useFakeTimers();

      let eventHandler: (() => void) | null = null;
      const channelMock = {
        on: vi.fn().mockImplementation((_event, _filter, handler) => {
          eventHandler = handler;
          return channelMock;
        }),
        subscribe: vi.fn().mockReturnThis(),
        unsubscribe: vi.fn().mockResolvedValue('ok'),
      };
      vi.spyOn(supabase, 'channel').mockReturnValue(channelMock as any);
      const removeSpy = vi.spyOn(supabase, 'removeChannel').mockReturnValue({} as any);

      const onUpdateSpy = vi.fn();
      const unsubscribe = subscribeToLeaderboard(onUpdateSpy);

      const trigger = eventHandler as unknown as () => void;
      trigger(); // Kích hoạt timer

      // Unsubscribe ngay lập tức trước khi timer 1.5s kích hoạt
      unsubscribe();
      expect(removeSpy).toHaveBeenCalledWith(channelMock);

      // Tiến thời gian qua 2000ms
      vi.advanceTimersByTime(2000);

      // onUpdate tuyệt đối không được gọi vì timer đã được dọn dẹp sạch
      expect(onUpdateSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('không recreate duplicate subscription: nhiều subscriber chia sẻ chung 1 channel duy nhất', () => {
      const channelMock = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
        unsubscribe: vi.fn().mockResolvedValue('ok'),
      };
      const channelSpy = vi.spyOn(supabase, 'channel').mockReturnValue(channelMock as any);
      const removeSpy = vi.spyOn(supabase, 'removeChannel').mockReturnValue({} as any);

      const sub1Spy = vi.fn();
      const sub2Spy = vi.fn();
      const sub3Spy = vi.fn();

      const unsub1 = subscribeToLeaderboard(sub1Spy);
      const unsub2 = subscribeToLeaderboard(sub2Spy);
      const unsub3 = subscribeToLeaderboard(sub3Spy);

      // Chỉ tạo đúng 1 channel duy nhất cho 3 subscriber
      expect(channelSpy).toHaveBeenCalledTimes(1);

      // Hủy sub1 và sub2 -> channel vẫn tồn tại vì còn sub3
      unsub1();
      unsub2();
      expect(removeSpy).not.toHaveBeenCalled();

      // Hủy sub3 cuối cùng -> giải phóng channel hoàn toàn
      unsub3();
      expect(removeSpy).toHaveBeenCalledTimes(1);
    });

    it('chống đói tín hiệu (Starvation Protection): chuỗi sự kiện liên tục buộc giải tỏa bounded refresh tại mốc Max-Wait 5s', async () => {
      vi.useFakeTimers();

      let eventHandler: (() => void) | null = null;
      const channelMock = {
        on: vi.fn().mockImplementation((_event, _filter, handler) => {
          eventHandler = handler;
          return channelMock;
        }),
        subscribe: vi.fn().mockReturnThis(),
        unsubscribe: vi.fn().mockResolvedValue('ok'),
      };
      vi.spyOn(supabase, 'channel').mockReturnValue(channelMock as any);

      const onUpdateSpy = vi.fn();
      const unsubscribe = subscribeToLeaderboard(onUpdateSpy);
      const trigger = eventHandler as unknown as () => void;

      // Bắn sự kiện mỗi 600ms liên tục (nhỏ hơn 1500ms debounce interval)
      // Nếu không có max-wait, debounce sẽ bị reset liên tục và gây starvation vô hạn
      for (let t = 0; t < 5400; t += 600) {
        trigger();
        vi.advanceTimersByTime(600);
      }

      // Tại mốc >= 5000ms (REALTIME_MAX_WAIT_MS), buộc phải giải tỏa ít nhất 1 lần refresh
      expect(onUpdateSpy).toHaveBeenCalled();
      const callCount = onUpdateSpy.mock.calls.length;
      expect(callCount).toBeGreaterThanOrEqual(1);

      unsubscribe();
      vi.useRealTimers();
    });

    it('xử lý mất kết nối realtime an toàn, không crash và báo trạng thái CHANNEL_ERROR / TIMED_OUT', () => {
      let registeredStatusCallback: ((status: string) => void) | null = null;
      const channelMock = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockImplementation((cb) => {
          registeredStatusCallback = cb;
          return channelMock;
        }),
        unsubscribe: vi.fn().mockResolvedValue('ok'),
      };
      vi.spyOn(supabase, 'channel').mockReturnValue(channelMock as any);

      const statusSpy = vi.fn();
      const unsubscribe = subscribeToLeaderboard(vi.fn(), statusSpy);

      expect(registeredStatusCallback).toBeDefined();
      registeredStatusCallback!('CHANNEL_ERROR');
      expect(statusSpy).toHaveBeenCalledWith('CHANNEL_ERROR');

      registeredStatusCallback!('TIMED_OUT');
      expect(statusSpy).toHaveBeenCalledWith('TIMED_OUT');

      unsubscribe();
    });
  });

  // ==========================================================================
  // 2. BACKEND PAGINATION & CLAMP SEMANTICS
  // ==========================================================================
  describe('2. Backend Pagination & Clamp Semantics', () => {
    it('p_limit = 10 -> giới hạn truy vấn <= 10', async () => {
      const mockQuery = setupMockTableQuery([]);

      const res = await fetchLeaderboardWithStatus('weekly_xp', 'my-id', 10, 0);
      expect(res.limit).toBe(10);
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
    });

    it('p_limit = 50 -> giới hạn truy vấn đúng 50 (chuẩn UI và hard cap)', async () => {
      const mockQuery = setupMockTableQuery([]);

      const res = await fetchLeaderboardWithStatus('weekly_xp', 'my-id', 50, 0);
      expect(res.limit).toBe(50);
      expect(mockQuery.limit).toHaveBeenCalledWith(50);
    });

    it('p_limit = 51 -> bị clamp cứng về 50 (Hard Cap Backend Protection)', async () => {
      const mockQuery = setupMockTableQuery([]);

      const res = await fetchLeaderboardWithStatus('weekly_xp', 'my-id', 51, 0);
      expect(res.limit).toBe(50);
      expect(mockQuery.limit).toHaveBeenCalledWith(50);
    });

    it('p_limit = 100000 -> client gửi số cực lớn, backend và service vẫn clamp về <= 50', async () => {
      const mockQuery = setupMockTableQuery([]);

      const res = await fetchLeaderboardWithStatus('weekly_xp', 'my-id', 100000, 0);
      expect(res.limit).toBe(50);
      expect(mockQuery.limit).toHaveBeenCalledWith(50);
    });

    it('p_limit = 0 -> an toàn fallback về giá trị mặc định 50', async () => {
      const mockQuery = setupMockTableQuery([]);

      const res = await fetchLeaderboardWithStatus('weekly_xp', 'my-id', 0, 0);
      expect(res.limit).toBe(50);
      expect(mockQuery.limit).toHaveBeenCalledWith(50);
    });

    it('p_limit số âm (-15) -> an toàn fallback về giá trị mặc định 50', async () => {
      const mockQuery = setupMockTableQuery([]);

      const res = await fetchLeaderboardWithStatus('weekly_xp', 'my-id', -15, 0);
      expect(res.limit).toBe(50);
      expect(mockQuery.limit).toHaveBeenCalledWith(50);
    });

    it('phân trang theo offset / page boundary chuẩn xác: range(50, 99) và đánh số rank 51..100', async () => {
      const nowIso = new Date().toISOString();
      const mockRows = Array.from({ length: 50 }, (_, i) => ({
        id: `user-${i + 51}`,
        display_name: `Học viên ${i + 51}`,
        level: 10,
        weekly_xp: 5000 - i * 10,
        streak: 15,
        last_active_at: nowIso,
      }));

      const mockQuery = setupMockTableQuery(mockRows);

      const res = await fetchLeaderboardWithStatus('weekly_xp', 'my-id', 50, 50);

      // Kiểm tra range(50, 99) cho page 2
      expect(mockQuery.range).toHaveBeenCalledWith(50, 99);
      expect(res.offset).toBe(50);
      expect(res.entries.length).toBe(50);

      // Phần tử đầu tiên của trang 2 phải có rank = 51
      expect(res.entries[0].rank).toBe(51);
      // Phần tử cuối cùng của trang 2 phải có rank = 100
      expect(res.entries[49].rank).toBe(100);
    });

    it('RPC multi-metric categories clamp p_limit và truyền p_offset chính xác', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          limit: 50,
          offset: 25,
          total_count: 85,
          top_entries: [
            {
              user_id: 'user-26',
              rank: 26,
              display_name: 'Lan Anh',
              score: 120,
              level: 8,
            },
          ],
          current_user_entry: {
            user_id: 'my-user',
            rank: 42,
            display_name: 'Tôi',
            score: 95,
            level: 5,
          },
        },
        error: null,
      } as any);

      const res = await fetchLeaderboardWithStatus('vocab_mastered', 'my-user', 9999, 25);

      expect(rpcSpy).toHaveBeenCalledWith(
        'get_leaderboard_category_rankings',
        expect.objectContaining({
          p_category: 'vocab_mastered',
          p_limit: 50, // Clamped from 9999 to 50
          p_offset: 25,
          p_current_user_id: 'my-user',
        })
      );

      expect(res.entries[0].rank).toBe(26);
      expect(res.totalCount).toBe(85);
      expect(res.currentUserEntry?.rank).toBe(42);
    });
  });

  // ==========================================================================
  // 3. QUERY EFFICIENCY & STICKY CURRENT-USER RANK
  // ==========================================================================
  describe('3. Query Efficiency & Sticky Current-User Rank', () => {
    it('truy vấn bảng xếp hạng chỉ SELECT đúng các trường cần thiết, không SELECT *', async () => {
      const mockQuery = setupMockTableQuery([]);

      await fetchLeaderboardWithStatus('weekly_xp', 'my-id', 20, 0);

      expect(mockQuery.select).toHaveBeenCalledWith(
        expect.stringContaining('id, display_name, avatar_url, level, total_xp, weekly_xp, streak, last_active_at')
      );
    });

    it('thứ hạng cá nhân sticky current-user hoạt động kể cả khi user không nằm trong trang hiện tại', async () => {
      const nowIso = new Date().toISOString();
      // Giả lập Page 1 (Ranks 1..50) nhưng user hiện tại đang xếp thứ 73
      const page1Rows = Array.from({ length: 50 }, (_, i) => ({
        id: `other-user-${i + 1}`,
        display_name: `Học viên ${i + 1}`,
        level: 10,
        weekly_xp: 5000 - i * 10,
        streak: 15,
        last_active_at: nowIso,
      }));

      setupMockTableQuery(page1Rows);

      // Lightweight RPC get_my_leaderboard_rank trả về rank #73 mà không cần fetch 73 bản ghi
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          found: true,
          entry: {
            user_id: 'my-user-id',
            display_name: 'Người Học Hiện Tại',
            rank: 73,
            level: 6,
            score: 1450,
            secondary_score: 5,
            equipped_frame: 'elite_frame',
          },
        },
        error: null,
      } as any);

      const res = await fetchLeaderboardWithStatus('weekly_xp', 'my-user-id', 50, 0);

      // Danh sách trả về chỉ chứa 50 người của Page 1
      expect(res.entries.length).toBe(50);
      expect(res.entries.some((e) => e.userId === 'my-user-id')).toBe(false);

      // Sticky Current-User entry vẫn có dữ liệu chuẩn xác của rank #73
      expect(res.currentUserEntry).toBeDefined();
      expect(res.currentUserEntry?.userId).toBe('my-user-id');
      expect(res.currentUserEntry?.rank).toBe(73);
      expect(res.currentUserEntry?.score).toBe(1450);
      expect(res.currentUserEntry?.equippedFrame).toBe('elite_frame');
    });

    it('getMyLeaderboardRank RPC độc lập truy vấn thứ hạng nhanh không kéo toàn bộ bảng', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          found: true,
          entry: {
            user_id: 'user-999',
            rank: 24,
            display_name: 'Minh Tuấn',
            level: 15,
            score: 3200,
          },
        },
        error: null,
      } as any);

      const myRank = await getMyLeaderboardRank('weekly_xp', 'user-999');

      expect(rpcSpy).toHaveBeenCalledWith('get_my_leaderboard_rank', expect.objectContaining({
        p_category: 'weekly_xp',
        p_user_id: 'user-999',
      }));
      expect(myRank?.rank).toBe(24);
      expect(myRank?.displayName).toBe('Minh Tuấn');
    });
  });

  // ==========================================================================
  // 4. OFFLINE CACHE & STALE-WEEK RESILIENCE
  // ==========================================================================
  describe('4. Offline Cache & Stale-Week Resilience', () => {
    it('bảo toàn chỉ real users trong cache, không có mock user', () => {
      const realEntries = [
        {
          userId: 'real-1',
          rank: 1,
          displayName: 'Thật 1',
          level: 10,
          rankTitle: 'VIP Learner',
          score: 1000,
          isCurrentUser: false,
        },
        {
          userId: 'real-2',
          rank: 2,
          displayName: 'Thật 2',
          level: 5,
          rankTitle: 'Novice',
          score: 800,
          isCurrentUser: true,
        },
      ];

      setCachedLeaderboard('weekly_xp', realEntries, getUtcWeekId(), realEntries[1], 2);

      const cached = getCachedLeaderboard('weekly_xp');
      expect(cached).not.toBeNull();
      expect(cached?.entries.length).toBe(2);
      expect(cached?.entries[0].displayName).toBe('Thật 1');
      expect(cached?.currentUserEntry?.userId).toBe('real-2');
      expect(cached?.totalCount).toBe(2);
      expect(cached?.isStaleWeek).toBe(false);
    });

    it('phát hiện chính xác tuần cũ (isStaleWeek: true) khi weekId trong cache khác tuần hiện tại', () => {
      const oldEntries = [
        {
          userId: 'old-1',
          rank: 1,
          displayName: 'Cũ 1',
          level: 10,
          rankTitle: 'VIP Learner',
          score: 500,
          isCurrentUser: false,
        },
      ];

      // Ghi cache với tuần trước
      setCachedLeaderboard('weekly_xp', oldEntries, '2025-W01', oldEntries[0], 1);

      const cached = getCachedLeaderboard('weekly_xp');
      expect(cached).not.toBeNull();
      expect(cached?.isStaleWeek).toBe(true);
      expect(cached?.weekId).toBe('2025-W01');
    });

    it('khi thiết bị ngoại tuyến (navigator.onLine === false), trả về OFFLINE_CACHE từ real users đã lưu', async () => {
      const realEntries = [
        {
          userId: 'real-offline-1',
          rank: 1,
          displayName: 'Offline Hero',
          level: 12,
          rankTitle: 'VIP Learner',
          score: 1500,
          isCurrentUser: true,
        },
      ];
      setCachedLeaderboard('weekly_xp', realEntries, getUtcWeekId(), realEntries[0], 1);

      // Giả lập offline
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const res = await fetchLeaderboardWithStatus('weekly_xp', 'real-offline-1');

      expect(res.status).toBe('OFFLINE_CACHE');
      expect(res.entries.length).toBe(1);
      expect(res.entries[0].displayName).toBe('Offline Hero');
      expect(res.currentUserEntry?.userId).toBe('real-offline-1');

      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    });
  });
});
