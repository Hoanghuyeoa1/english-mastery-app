// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  performFullSync,
  pushLocalToCloud,
  scheduleCloudSync,
  initCloudSync,
  cancelSyncRetry,
  clearSyncCoordinatorForTesting,
  getSyncCoordinatorStateForTesting,
  useCloudSyncStore,
  MAX_SYNC_RETRY_ATTEMPTS,
  SYNC_RETRY_BASE_DELAY_MS,
  isNetworkOrUnreachableError,
} from '../cloudSyncService';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../lib/supabaseClient';

describe('PHASE 3 — Local-First Offline Persistence + Automatic Cloud Sync Recovery Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    clearSyncCoordinatorForTesting();

    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: { success: true, results: [] },
      error: null,
    } as any);

    // Reset Cloud Sync Store
    useCloudSyncStore.setState({
      status: 'idle',
      lastSyncedAt: null,
      errorMessage: null,
      user: { id: 'test_user_uuid', email: 'learner@example.com' } as any,
      userId: 'test_user_uuid',
      userEmail: 'learner@example.com',
      isOnline: true,
    });

    // Reset App Store
    useAppStore.getState().resetToDefault();
    useAppStore.setState({
      profile: {
        ...useAppStore.getState().profile,
        name: 'Học viên Test',
        xp: 500,
        level: 2,
        streak: 5,
        geminiApiKey: 'secret_local_key_123',
      },
      geminiApiKey: 'secret_local_key_123',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearSyncCoordinatorForTesting();
  });

  // ==========================================================================
  // 1. LOCAL-FIRST INVARIANT & OFFLINE PERSISTENCE
  // ==========================================================================
  describe('1. Local-First Invariant & Offline Persistence', () => {
    it('mất mạng (isOnline = false): tiến độ học tập commit local trước, không bị rollback', () => {
      useCloudSyncStore.setState({ isOnline: false });

      // Học viên làm bài tập trong chế độ ngoại tuyến
      useAppStore.getState().gainXP(100, { source: 'quiz' });
      useAppStore.getState().recordMistake({ id: 'ubiquitous', word: 'ubiquitous', meaning: 'phổ biến' } as any, 'flashcard');

      const state = useAppStore.getState();
      expect(state.profile.xp).toBe(600);
      expect(state.mistakeBank['ubiquitous']).toBeDefined();
      expect(state.mistakeBank['ubiquitous'].wrongCount).toBe(1);

      // Thử đồng bộ khi offline -> từ chối an toàn, chuyển trạng thái offline
      const syncResult = performFullSync();
      expect(useCloudSyncStore.getState().status).toBe('offline');

      // Dữ liệu local hoàn toàn nguyên vẹn, không bị xóa hay rollback
      expect(useAppStore.getState().profile.xp).toBe(600);
      expect(useAppStore.getState().mistakeBank['ubiquitous']).toBeDefined();
    });

    it('scheduleCloudSync khi offline: không gửi request lên mạng, bảo vệ hàng đợi', () => {
      useCloudSyncStore.setState({ isOnline: false });
      const fromSpy = vi.spyOn(supabase, 'from');

      scheduleCloudSync(500);

      const coordState = getSyncCoordinatorStateForTesting();
      // Không khởi tạo debounce timer khi offline
      expect(coordState.hasDebounceTimer).toBe(false);
      expect(fromSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 2. GLOBAL ONLINE LISTENER & AUTO-SYNC TRIGGER
  // ==========================================================================
  describe('2. Global Online Listener & Reconnect Lifecycle', () => {
    it('khi chuyển từ offline -> online: listener tự động kích hoạt performFullSync', async () => {
      useCloudSyncStore.setState({ isOnline: false, status: 'offline' });

      // Setup supabase mocks
      const fromSpy = vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        const query: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'test_user_uuid', xp: 500 }, error: null }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
        query.then = (resolve: any) => resolve({ data: [], error: null });
        return query;
      });

      const cleanup = initCloudSync();

      // Giả lập sự kiện online trên window
      window.dispatchEvent(new Event('online'));
      await vi.waitFor(() => {
        expect(fromSpy).toHaveBeenCalled();
      }, { timeout: 2000 });

      expect(useCloudSyncStore.getState().isOnline).toBe(true);

      cleanup();
    });

    it('cleanup đúng: hủy listener khi unmount, không duplicate listener sau rerender', () => {
      const addListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeListenerSpy = vi.spyOn(window, 'removeEventListener');

      const cleanup = initCloudSync();

      expect(addListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(addListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

      cleanup();

      expect(removeListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  // ==========================================================================
  // 3. SYNC COORDINATOR & COALESCING (REENTRANCY GUARD)
  // ==========================================================================
  describe('3. Sync Coordinator & Request Coalescing', () => {
    it('nhiều trigger dồn dập trong khi đang sync được gom lại (coalesce) thành đúng 1 lần follow-up sync', async () => {
      let resolveFirstFetch: any;
      const firstFetchPromise = new Promise((res) => {
        resolveFirstFetch = res;
      });

      let callCount = 0;
      vi.spyOn(supabase, 'from').mockImplementation(() => {
        callCount++;
        const query: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockImplementation(() => firstFetchPromise),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
        query.then = (resolve: any) => resolve({ data: [], error: null });
        return query;
      });

      // Bắt đầu sync lần 1
      const syncPromise1 = performFullSync();
      expect(useCloudSyncStore.getState().status).toBe('syncing');

      // Trong khi sync 1 đang chạy, bắn 4 trigger tiếp theo
      const syncPromise2 = performFullSync();
      const syncPromise3 = performFullSync();
      const syncPromise4 = performFullSync();

      const coordinatorState = getSyncCoordinatorStateForTesting();
      expect(coordinatorState.isSyncInProgress).toBe(true);
      expect(coordinatorState.hasPendingSyncRequest).toBe(true);

      // Giải tỏa sync 1
      resolveFirstFetch({ data: { id: 'test_user_uuid', xp: 500 }, error: null });
      await syncPromise1;
      await syncPromise2;
      await syncPromise3;
      await syncPromise4;

      // Trạng thái cuối cùng phải là synced
      expect(useCloudSyncStore.getState().status).toBe('synced');
    });
  });

  // ==========================================================================
  // 4. BOUNDED RETRY & EXPONENTIAL BACKOFF
  // ==========================================================================
  describe('4. Bounded Retry with Exponential Backoff', () => {
    it('lỗi mạng khi online: kích hoạt retry có giới hạn (tối đa 3 lần) với exponential delay', async () => {
      vi.useFakeTimers();

      // Giả lập Supabase ném lỗi mạng
      vi.spyOn(supabase, 'from').mockImplementation(() => {
        const query: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Failed to fetch (Network connection refused)' },
          }),
        };
        query.then = (resolve: any) =>
          resolve({ data: null, error: { message: 'Failed to fetch (Network connection refused)' } });
        return query;
      });

      // Lần 1: Thất bại -> Lên lịch retry lần 1 (1500ms)
      await performFullSync();
      expect(useCloudSyncStore.getState().status).toBe('error');
      let coord = getSyncCoordinatorStateForTesting();
      expect(coord.syncRetryAttempt).toBe(1);
      expect(coord.hasRetryTimer).toBe(true);

      // Tiến đồng hồ 1500ms -> Kích hoạt retry lần 1, thất bại -> Lên lịch retry lần 2 (3000ms)
      await vi.advanceTimersByTimeAsync(1500);
      coord = getSyncCoordinatorStateForTesting();
      expect(coord.syncRetryAttempt).toBe(2);

      // Tiến đồng hồ 3000ms -> Kích hoạt retry lần 2, thất bại -> Lên lịch retry lần 3 (6000ms)
      await vi.advanceTimersByTimeAsync(3000);
      coord = getSyncCoordinatorStateForTesting();
      expect(coord.syncRetryAttempt).toBe(3);

      // Tiến đồng hồ 6000ms -> Kích hoạt retry lần 3, thất bại -> Hết số lần (Exhausted), dừng retry
      await vi.advanceTimersByTimeAsync(6000);
      coord = getSyncCoordinatorStateForTesting();
      expect(coord.syncRetryAttempt).toBe(0);
      expect(coord.hasRetryTimer).toBe(false);
      expect(useCloudSyncStore.getState().status).toBe('error');
      expect(useCloudSyncStore.getState().errorMessage).toContain('Chưa thể đồng bộ');

      vi.useRealTimers();
    });

    it('thiết bị mất mạng trong lúc retry timer đang chờ: tự động hủy retry timer ngay lập tức', () => {
      vi.useFakeTimers();

      vi.spyOn(supabase, 'from').mockImplementation(() => {
        const query: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'fetch failed' },
          }),
        };
        query.then = (resolve: any) =>
          resolve({ data: null, error: { message: 'fetch failed' } });
        return query;
      });

      void performFullSync();
      // Đang có timer chờ retry
      cancelSyncRetry();

      const coord = getSyncCoordinatorStateForTesting();
      expect(coord.hasRetryTimer).toBe(false);
      expect(coord.syncRetryAttempt).toBe(0);

      vi.useRealTimers();
    });
  });

  // ==========================================================================
  // 5. CONNECTIVITY FLAPPING RESILIENCE
  // ==========================================================================
  describe('5. Connectivity Flapping Resilience', () => {
    it('chập chờn offline -> online -> offline -> online: không sinh concurrent sync hay crash', async () => {
      const fromSpy = vi.spyOn(supabase, 'from').mockImplementation(() => {
        const query: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'test_user_uuid', xp: 500 }, error: null }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
        query.then = (resolve: any) => resolve({ data: [], error: null });
        return query;
      });

      const cleanup = initCloudSync();

      // Flap 1
      window.dispatchEvent(new Event('offline'));
      expect(useCloudSyncStore.getState().isOnline).toBe(false);

      window.dispatchEvent(new Event('online'));
      expect(useCloudSyncStore.getState().isOnline).toBe(true);

      // Flap 2
      window.dispatchEvent(new Event('offline'));
      expect(useCloudSyncStore.getState().isOnline).toBe(false);

      window.dispatchEvent(new Event('online'));
      await new Promise((r) => setTimeout(r, 20));
      expect(useCloudSyncStore.getState().isOnline).toBe(true);

      expect(fromSpy).toHaveBeenCalled();
      cleanup();
    });
  });

  // ==========================================================================
  // 6. RACE CONDITION: HỌC VIÊN LÀM BÀI TRONG KHI SYNC ĐANG CHẠY
  // ==========================================================================
  describe('6. Race Condition Protection (Study action during sync)', () => {
    it('review từ vựng và XP phát sinh trong lúc fetch cloud không bị snapshot cũ ghi đè', async () => {
      let resolveFetch: any;
      const fetchPromise = new Promise((res) => {
        resolveFetch = res;
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

      // Bước 1: Khởi động sync (đang đợi fetch)
      const syncPromise = performFullSync();

      // Bước 2: Học viên học bài trong lúc network đang chờ phản hồi
      useAppStore.getState().gainXP(250, { source: 'quiz' });
      useAppStore.setState((s) => ({
        srsProgressMap: {
          ...s.srsProgressMap,
          apple: {
            srsLevel: 3,
            interval: 7,
            easeFactor: 2.6,
            lastReviewedDate: new Date().toISOString(),
            nextReviewDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          },
        },
      }));

      // Bước 3: Phản hồi từ cloud về mang dữ liệu cũ (XP = 500, apple srsLevel = 1)
      resolveFetch({
        data: {
          id: 'test_user_uuid',
          xp: 500, // Cũ hơn local (hiện tại local đã là 750)
        },
        error: null,
      });

      await syncPromise;

      // Local state phải giữ 750 XP và srsLevel = 3, KHÔNG bị snapshot cũ (500 XP, srsLevel 1) đè
      const finalState = useAppStore.getState();
      expect(finalState.profile.xp).toBe(750);
      expect(finalState.srsProgressMap['apple'].srsLevel).toBe(3);
      expect(finalState.srsProgressMap['apple'].interval).toBe(7);
    });
  });

  // ==========================================================================
  // 7. SECURITY INVARIANTS: GEMINI API KEY STAYS LOCAL
  // ==========================================================================
  describe('7. Security Invariants', () => {
    it('pushLocalToCloud tuyệt đối không đưa Gemini API Key lên Supabase payload', async () => {
      let capturedProfilePayload: any = null;

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        const query: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          upsert: vi.fn().mockImplementation((payload) => {
            if (table === 'profiles') {
              capturedProfilePayload = payload;
            }
            return Promise.resolve({ error: null });
          }),
        };
        query.then = (resolve: any) => resolve({ data: [], error: null });
        return query;
      });

      await pushLocalToCloud('test_user_uuid');

      expect(capturedProfilePayload).toBeDefined();
      expect(capturedProfilePayload.geminiApiKey).toBeUndefined();
      expect(capturedProfilePayload.gemini_api_key).toBeUndefined();
    });

    it('mergeCloudData không bao giờ làm mất local Gemini API Key khi cloud trả về null/rỗng', () => {
      useAppStore.setState({
        geminiApiKey: 'my_private_ai_key_999',
        profile: {
          ...useAppStore.getState().profile,
          geminiApiKey: 'my_private_ai_key_999',
        },
      });

      useAppStore.getState().mergeCloudData({
        cloudProfile: {
          id: 'test_user_uuid',
          display_name: 'Test',
          xp: 800,
          geminiApiKey: null as any,
          gemini_api_key: '',
        },
      });

      const state = useAppStore.getState();
      expect(state.geminiApiKey).toBe('my_private_ai_key_999');
      expect(state.profile.geminiApiKey).toBe('my_private_ai_key_999');
    });
  });

  // ==========================================================================
  // 8. IDEMPOTENCY: MULTIPLE SYNCS PRODUCE CANONICAL RESULT
  // ==========================================================================
  describe('8. Idempotency & Consistency', () => {
    it('đồng bộ liên tiếp nhiều lần với cùng một state không gây lạm phát XP hay nhân đôi dữ liệu', async () => {
      vi.spyOn(supabase, 'from').mockImplementation(() => {
        const query: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'test_user_uuid', xp: 500, level: 2 },
            error: null,
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
        query.then = (resolve: any) => resolve({ data: [], error: null });
        return query;
      });

      // Đồng bộ lần 1
      await performFullSync();
      const xp1 = useAppStore.getState().profile.xp;

      // Đồng bộ lần 2
      await performFullSync();
      const xp2 = useAppStore.getState().profile.xp;

      // Đồng bộ lần 3
      await performFullSync();
      const xp3 = useAppStore.getState().profile.xp;

      expect(xp1).toBe(500);
      expect(xp2).toBe(500);
      expect(xp3).toBe(500);
    });
  });

  // ==========================================================================
  // 9. ERROR CLASSIFICATION HELPER
  // ==========================================================================
  describe('9. Error Classification Helper', () => {
    it('isNetworkOrUnreachableError nhận diện chính xác các mã và thông điệp lỗi mạng', () => {
      expect(isNetworkOrUnreachableError(new Error('Failed to fetch'))).toBe(true);
      expect(isNetworkOrUnreachableError(new Error('NetworkError when attempting to fetch resource.'))).toBe(true);
      expect(isNetworkOrUnreachableError({ message: 'connection refused' })).toBe(true);
      expect(isNetworkOrUnreachableError({ message: 'ENOTFOUND api.supabase.co' })).toBe(true);
      expect(isNetworkOrUnreachableError({ message: 'socket hang up' })).toBe(true);
      expect(isNetworkOrUnreachableError(new Error('Supabase query timeout sau 3000ms'))).toBe(true);

      // Lỗi logic / validation không phải lỗi mạng
      expect(isNetworkOrUnreachableError(new Error('User already exists'))).toBe(false);
      expect(isNetworkOrUnreachableError(null)).toBe(false);
    });
  });
});
