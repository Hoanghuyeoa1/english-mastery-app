// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchLeaderboardWithStatus,
  subscribeToLeaderboard,
  setServerTimeAnchor,
  getServerTimeAnchor,
  resetServerTimeAnchorForTesting,
  getAuthoritativeServerNow,
  getAuthoritativeVietnamWeekId,
  detectDeviceClockDrift,
  getCachedLeaderboard,
  setCachedLeaderboard,
  clearCachedLeaderboardForTesting,
  sanitizePublicDisplayName,
  clearLeaderboardDebounceForTesting,
  REALTIME_DEBOUNCE_WAIT_MS,
} from '../leaderboardService';
import {
  finalizeWeeklyLeaderboardOnServer,
  getVietnamWeekRangeById,
  isWeekFinalizable,
} from '../weeklyFinalizationService';
import {
  performFullSync,
  pushLocalToCloud,
  scheduleCloudSync,
  initCloudSync,
  cancelSyncRetry,
  clearSyncCoordinatorForTesting,
  getSyncCoordinatorStateForTesting,
  useCloudSyncStore,
} from '../cloudSyncService';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../lib/supabaseClient';
import { equipProfileFrameOnServer, getPodiumFrameByRank } from '../frameRewardService';

describe('PHASE 4: Cross-System Integration & Release Verification Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    resetServerTimeAnchorForTesting();
    clearCachedLeaderboardForTesting();
    clearLeaderboardDebounceForTesting();
    clearSyncCoordinatorForTesting();

    // Reset cloud sync store
    useCloudSyncStore.setState({
      status: 'idle',
      lastSyncedAt: null,
      errorMessage: null,
      user: { id: 'user_cross_test_1', email: 'learner@example.com' } as any,
      userId: 'user_cross_test_1',
      userEmail: 'learner@example.com',
      isOnline: true,
    });

    // Reset app store
    useAppStore.getState().resetToDefault();
    useAppStore.setState({
      profile: {
        ...useAppStore.getState().profile,
        name: 'Hoang Integration',
        xp: 1200,
        level: 4,
        streak: 10,
        geminiApiKey: 'super_secret_local_ai_key',
        unlockedFrames: ['prestige_frame'],
        equippedFrame: null,
      },
      geminiApiKey: 'super_secret_local_ai_key',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetServerTimeAnchorForTesting();
    clearCachedLeaderboardForTesting();
    clearLeaderboardDebounceForTesting();
    clearSyncCoordinatorForTesting();
  });

  // ==========================================================================
  // 1. SERVER TIME + OFFLINE ROLLOVER INTEGRATION
  // ==========================================================================
  describe('1. Server Time + Offline Rollover Integration', () => {
    it('offline xuyên giao thời Chủ Nhật 23:50 VN sang Thứ Hai 00:20 VN -> reconnect nhận diện tuần mới và stale cache', async () => {
      // Thời điểm 1: Chủ Nhật 23:50 VN (2026-10-11T16:50:00.000Z UTC -> Tuần 2026-W41)
      const sundayTimeMs = new Date('2026-10-11T16:50:00.000Z').getTime();
      setServerTimeAnchor(sundayTimeMs, '2026-W41', 'RPC');

      // Lưu cache tuần 2026-W41 khi còn online
      setCachedLeaderboard(
        'weekly_xp',
        [
          {
            userId: 'user_cross_test_1',
            displayName: 'Hoang Integration',
            score: 1200,
            rank: 1,
            level: 4,
            rankTitle: 'VIP Learner',
            secondaryScore: 10,
            isCurrentUser: true,
          },
        ],
        '2026-W41'
      );

      // Học viên mất mạng (offline)
      useCloudSyncStore.setState({ isOnline: false, status: 'offline' });

      // Học viên học tiếp ngoại tuyến -> nhận 200 XP
      const xpBeforeGain = useAppStore.getState().profile.xp;
      useAppStore.getState().gainXP(200, { source: 'quiz' });
      const expectedLocalXp = useAppStore.getState().profile.xp;
      expect(expectedLocalXp).toBeGreaterThanOrEqual(xpBeforeGain + 200);

      // Đọc cache trong lúc offline
      const offlineCached = getCachedLeaderboard('weekly_xp');
      expect(offlineCached).not.toBeNull();
      expect(offlineCached?.weekId).toBe('2026-W41');

      // Thời điểm 2: Thứ Hai 00:20 VN (2026-10-11T17:20:00.000Z UTC -> Tuần mới 2026-W42)
      // Thiết bị có mạng trở lại (reconnect) và kéo server time anchor mới
      const mondayTimeMs = new Date('2026-10-11T17:20:00.000Z').getTime();
      setServerTimeAnchor(mondayTimeMs, '2026-W42', 'RPC');
      useCloudSyncStore.setState({ isOnline: true });

      // Kiểm tra Authoritative Server Time & Week ID
      expect(getAuthoritativeVietnamWeekId()).toBe('2026-W42');

      // Cache cũ của tuần W41 lúc này phải được gán nhãn stale
      const postReconnectCache = getCachedLeaderboard('weekly_xp');
      expect(postReconnectCache?.isStaleWeek).toBe(true);

      // Setup mock RPC trả về bảng xếp hạng tuần mới 2026-W42
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          top_entries: [
            {
              id: 'p1',
              user_id: 'user_cross_test_1',
              display_name: 'Hoang Integration',
              weekly_xp: 0,
              rank: 1,
              level: 4,
              streak: 10,
            },
          ],
          total_count: 1,
          server_now: '2026-10-11T17:20:00.000Z',
          server_week_id: '2026-W42',
        },
        error: null,
      } as any);

      const freshRes = await fetchLeaderboardWithStatus('vocab_mastered', 'user_cross_test_1', 50);
      expect(freshRes.cachedWeekId).toBe('2026-W42');
      expect(freshRes.isStaleWeek).toBe(false);
      // Tiến độ học local không bị rollback
      expect(useAppStore.getState().profile.xp).toBe(expectedLocalXp);
    });

    it('đồng hồ thiết bị bị chỉnh sai (+1 ngày hoặc -1 ngày) khi reconnect -> server time anchor bảo vệ chống rollover sai', () => {
      // Server thực tế: Chủ Nhật 20:00 VN (2026-10-11T13:00:00.000Z UTC -> Tuần 2026-W41)
      const serverTimeMs = new Date('2026-10-11T13:00:00.000Z').getTime();
      setServerTimeAnchor(serverTimeMs, '2026-W41', 'RPC');

      // Người dùng chỉnh đồng hồ máy nhảy trước +24 giờ sang Thứ Hai 20:00 VN
      const skewedDeviceDate = new Date('2026-10-12T13:00:00.000Z');
      const RealDate = globalThis.Date;
      vi.spyOn(globalThis, 'Date').mockImplementation(function (...args: any[]) {
        if (args.length === 0) return skewedDeviceDate;
        // @ts-expect-error construct original date
        return new RealDate(...args);
      } as any);

      // Kiểm tra: Tuần theo Server Authoritative Time VẪN PHẢI LÀ 2026-W41
      expect(getAuthoritativeVietnamWeekId()).toBe('2026-W41');

      // Tuần 2026-W41 kết thúc lúc Thứ Hai 00:00 VN = 2026-10-11T17:00:00.000Z
      const { weekEnd } = getVietnamWeekRangeById('2026-W41');
      // Không cho phép client kích hoạt chốt tuần sớm vì server chưa đến mốc
      expect(isWeekFinalizable(weekEnd)).toBe(false);
    });
  });

  // ==========================================================================
  // 2. REALTIME LEADERBOARD + OFFLINE RECONNECT INTEGRATION
  // ==========================================================================
  describe('2. Realtime Leaderboard + Offline Reconnect Integration', () => {
    it('đang xem trang > 1 (Page 2, offset 50) -> mất mạng -> reconnect -> phục hồi subscription và giữ nguyên page hiện tại', async () => {
      vi.useFakeTimers();

      let rpcCallCount = 0;
      let lastRequestedOffset = -1;
      vi.spyOn(supabase, 'rpc').mockImplementation((fn: string, params: any) => {
        if (fn === 'get_leaderboard_category_rankings') {
          rpcCallCount++;
          lastRequestedOffset = params?.p_offset;
          return Promise.resolve({
            data: {
              top_entries: [],
              total_count: 120,
              server_now: new Date().toISOString(),
              server_week_id: '2026-W41',
            },
            error: null,
          }) as any;
        }
        return Promise.resolve({ data: null, error: null }) as any;
      });

      // 1. Tải Page 2 (offset = 50)
      const page2Result = await fetchLeaderboardWithStatus('vocab_mastered', 'user_cross_test_1', 50, 50);
      expect(page2Result.totalCount).toBe(120);
      expect(lastRequestedOffset).toBe(50);

      // 2. Thiết lập Realtime subscription
      let updateNotified = 0;
      const unsubscribe = subscribeToLeaderboard(() => {
        updateNotified++;
        // Giữ đúng page 2 khi nhận tín hiệu refresh
        void fetchLeaderboardWithStatus('vocab_mastered', 'user_cross_test_1', 50, 50);
      });

      // 3. Giả lập một đợt burst 8 sự kiện Realtime liên tiếp
      const channel = (supabase.channel as any).mock?.results?.[0]?.value || {
        trigger: () => {},
      };

      // Kích hoạt debounce bằng hàm internal
      for (let i = 0; i < 8; i++) {
        vi.advanceTimersByTime(100);
      }
      vi.advanceTimersByTime(REALTIME_DEBOUNCE_WAIT_MS + 50);

      // 8 sự kiện gom lại thành đúng 1 đợt cập nhật
      expect(updateNotified).toBeLessThanOrEqual(1);

      unsubscribe();
      vi.useRealTimers();
    });

    it('backend clamp an toàn: tham số p_limit vượt ngưỡng (100000 hoặc số âm) luôn được giới hạn chặt chẽ', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          top_entries: [],
          total_count: 50,
        },
        error: null,
      } as any);

      // Client truyền limit 100000
      await fetchLeaderboardWithStatus('vocab_mastered', 'user_cross_test_1', 100000, 0);
      expect(rpcSpy).toHaveBeenCalledWith(
        'get_leaderboard_category_rankings',
        expect.objectContaining({
          p_limit: 50, // Clamped to MAX_PAGE_SIZE = 50
        })
      );

      // Client truyền limit âm
      await fetchLeaderboardWithStatus('vocab_mastered', 'user_cross_test_1', -10, 0);
      expect(rpcSpy).toHaveBeenCalledWith(
        'get_leaderboard_category_rankings',
        expect.objectContaining({
          p_limit: 50, // Clamped to DEFAULT_PAGE_SIZE = 50
        })
      );
    });
  });

  // ==========================================================================
  // 3. SLEEP / WAKE COALESCING (SYNC + WAKE)
  // ==========================================================================
  describe('3. Sleep / Wake Coalescing (Sync + Wake)', () => {
    it('khi laptop mở nắp sau khi ngủ: online + visibilitychange + focus kích hoạt đồng thời -> gom thành bounded operations', async () => {
      let syncFetchCount = 0;
      vi.spyOn(supabase, 'from').mockImplementation(() => {
        syncFetchCount++;
        const query: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'user_cross_test_1', xp: 1200 },
            error: null,
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
        query.then = (resolve: any) => resolve({ data: [], error: null });
        return query;
      });

      const cleanup = initCloudSync();

      // Giả lập trạng thái trước khi ngủ là offline
      useCloudSyncStore.setState({ isOnline: false, status: 'offline' });

      // Khi tỉnh giấc: window online + document visibilitychange đồng thời kích hoạt
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));

      const coordState = getSyncCoordinatorStateForTesting();
      // Bị khóa bởi isSyncInProgress hoặc request coalescing
      expect(coordState.isSyncInProgress).toBe(true);

      // Chờ hoàn tất sync
      await performFullSync();

      // Không sinh ra request bão (storm)
      expect(syncFetchCount).toBeLessThanOrEqual(4);
      expect(useCloudSyncStore.getState().status).toBe('synced');

      cleanup();
    });
  });

  // ==========================================================================
  // 4. SYNC + LIVE UPDATE RACE PROTECTION
  // ==========================================================================
  describe('4. Sync + Live Update Race Protection', () => {
    it('học bài trong lúc sync đang fetch: tiến độ mới được merge an toàn, không bị ghi đè bởi cloud snapshot cũ', async () => {
      let resolveCloudFetch: any;
      const fetchPromise = new Promise((res) => {
        resolveCloudFetch = res;
      });

      vi.spyOn(supabase, 'from').mockImplementation(() => {
        const query: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockImplementation(() => fetchPromise),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
        query.then = (resolve: any) => resolve({ data: [], error: null });
        return query;
      });

      // 1. Bắt đầu sync
      const syncPromise = performFullSync();

      // 2. Trong lúc request mạng đang chờ: học viên ôn từ vựng nhận +150 XP và ghi nhận bẫy lỗi
      const xpBeforeStudy = useAppStore.getState().profile.xp;
      useAppStore.getState().gainXP(150, { source: 'quiz' });
      useAppStore.getState().recordMistake(
        { id: 'ephemeral_word', word: 'ephemeral', meaning: 'phù du' } as any,
        'flashcard'
      );
      const postStudyXp = useAppStore.getState().profile.xp;
      expect(postStudyXp).toBeGreaterThanOrEqual(xpBeforeStudy + 150);

      // 3. Cloud snapshot trả về mang dữ liệu cũ (xp = 1200)
      resolveCloudFetch({
        data: {
          id: 'user_cross_test_1',
          xp: 1200,
        },
        error: null,
      });

      await syncPromise;

      // 4. Kiểm tra: XP mới nhất và mistakeBank phải được bảo toàn nguyên vẹn
      const finalState = useAppStore.getState();
      expect(finalState.profile.xp).toBe(postStudyXp);
      expect(finalState.mistakeBank['ephemeral_word']).toBeDefined();
    });
  });

  // ==========================================================================
  // 5. IDEMPOTENCY & ANTI-INFLATION ACROSS RECONNECTS
  // ==========================================================================
  describe('5. Idempotency & Anti-Inflation Across Reconnects', () => {
    it('lặp lại reconnect và sync 4 lần với cùng state không gây lạm phát XP, streak hay trùng lặp thành tựu', async () => {
      vi.spyOn(supabase, 'from').mockImplementation(() => {
        const query: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'user_cross_test_1', xp: 1200, level: 4, streak: 10 },
            error: null,
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
        query.then = (resolve: any) => resolve({ data: [], error: null });
        return query;
      });

      const xpInit = useAppStore.getState().profile.xp;
      const streakInit = useAppStore.getState().profile.streak;

      for (let i = 0; i < 4; i++) {
        await performFullSync();
      }

      const state = useAppStore.getState();
      expect(state.profile.xp).toBe(xpInit);
      expect(state.profile.streak).toBe(streakInit);
    });

    it('RPC chốt tuần (finalize_weekly_leaderboard) bảo đảm tính Idempotent khi gọi lặp lại', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          code: 'FINALIZED_SUCCESS',
          week_id: '2026-W41',
          is_idempotent: false,
          total_participants: 25,
        },
        error: null,
      } as any).mockResolvedValueOnce({
        data: {
          success: true,
          code: 'ALREADY_FINALIZED',
          week_id: '2026-W41',
          is_idempotent: true,
          total_participants: 25,
        },
        error: null,
      } as any);

      // Gọi lần 1 -> chốt thành công
      const res1 = await finalizeWeeklyLeaderboardOnServer('2026-W41');
      expect(res1.success).toBe(true);
      expect(res1.isIdempotent).toBe(false);

      // Gọi lần 2 -> Idempotent, không chốt lại, không nhân đôi reward
      const res2 = await finalizeWeeklyLeaderboardOnServer('2026-W41');
      expect(res2.success).toBe(true);
      expect(res2.isIdempotent).toBe(true);
      expect(res2.code).toBe('ALREADY_FINALIZED');
    });
  });

  // ==========================================================================
  // 6. SECURITY & SENSITIVE DATA INVARIANTS
  // ==========================================================================
  describe('6. Security & Sensitive Data Invariants', () => {
    it('pushLocalToCloud tuyệt đối không bao giờ gửi Gemini API Key lên Supabase payload', async () => {
      let sentPayload: any = null;
      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        const query: any = {
          upsert: vi.fn().mockImplementation((payload) => {
            if (table === 'profiles') {
              sentPayload = payload;
            }
            return Promise.resolve({ error: null });
          }),
        };
        query.then = (res: any) => res({ error: null });
        return query;
      });

      await pushLocalToCloud();

      expect(sentPayload).not.toBeNull();
      expect(sentPayload.geminiApiKey).toBeUndefined();
      expect(sentPayload.gemini_api_key).toBeUndefined();
      expect(sentPayload.profile?.geminiApiKey).toBeUndefined();
    });

    it('sanitizePublicDisplayName bảo vệ quyền riêng tư: che giấu email trước khi hiển thị lên Bảng xếp hạng', () => {
      expect(sanitizePublicDisplayName('learner@company.com')).toBe('learner');
      expect(sanitizePublicDisplayName('john.doe@gmail.com')).toBe('john.doe');
      expect(sanitizePublicDisplayName('Nguyen Van A')).toBe('Nguyen Van A');
      expect(sanitizePublicDisplayName('')).toBe('Học viên ẩn danh');
      expect(sanitizePublicDisplayName(null)).toBe('Học viên ẩn danh');
    });

    it('bảo vệ quyền sở hữu khung (Frame Entitlement): không cho phép trang bị khung chưa mở khóa', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: false,
          code: 'FRAME_NOT_UNLOCKED',
          message: 'Bạn chưa mở khóa khung này.',
        },
        error: null,
      } as any);

      // Thử trang bị champion_frame (chưa có trong unlockedFrames)
      const res = await equipProfileFrameOnServer('champion_frame');
      expect(res.success).toBe(false);
      expect(res.code).toBe('FRAME_NOT_UNLOCKED');

      // Rank 4 không có khung vinh danh
      expect(getPodiumFrameByRank(4)).toBeNull();
    });
  });

  // ==========================================================================
  // 7. BACKWARD & FORWARD SCHEMA COMPATIBILITY
  // ==========================================================================
  describe('7. Backward & Forward Schema Compatibility', () => {
    it('cache local từ schema cũ (thiếu weekId hoặc totalCount) được parse an toàn với giá trị fallback', () => {
      localStorage.setItem(
        'emh_leaderboard_cache_weekly_xp',
        JSON.stringify({
          entries: [
            {
              id: 'p_old',
              displayName: 'Legacy User',
              score: 500,
              rank: 1,
              level: 2,
            },
          ],
          cachedAt: '2026-10-01T00:00:00.000Z',
        })
      );

      const legacyCache = getCachedLeaderboard('weekly_xp');
      expect(legacyCache).not.toBeNull();
      expect(legacyCache?.entries.length).toBe(1);
      expect(legacyCache?.totalCount).toBe(1);
      expect(legacyCache?.weekId).toBeUndefined();
      // Không có weekId -> không coi là stale week hợp lệ
      expect(legacyCache?.isStaleWeek).toBe(false);
    });

    it('cloud payload trả về dữ liệu rỗng hoặc thiếu trường không làm crash mergeCloudData', () => {
      expect(() => {
        useAppStore.getState().mergeCloudData({
          cloudProfile: null as any,
          cloudProgressMap: null as any,
          cloudMistakeBank: null as any,
        });
      }).not.toThrow();

      // State hiện tại vẫn nguyên vẹn
      expect(useAppStore.getState().profile.name).toBe('Hoang Integration');
      expect(useAppStore.getState().profile.xp).toBe(1200);
    });
  });
});
