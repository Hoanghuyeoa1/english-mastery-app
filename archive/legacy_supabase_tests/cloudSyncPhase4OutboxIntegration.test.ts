// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  performFullSync,
  initCloudSync,
  clearSyncCoordinatorForTesting,
  useCloudSyncStore,
  flushOutboxEventsThroughCoordinator,
  isEventSyncEnabled,
  getEventSyncTelemetry,
  resetEventSyncTelemetryForTesting,
  setEventSyncConfig,
} from '../cloudSyncService';
import { localOutbox } from '../localOutboxService';
import { createDomainEvent } from '../eventIdentityService';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../lib/supabaseClient';
import { cloudSyncApi } from '../api/cloudSyncApi';

describe('PHASE 4 — Cloud Sync Coordinator & Local Outbox Integration Suite', () => {
  const testUserId = 'user_coord_phase4_test';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Clear coordinator state
    clearSyncCoordinatorForTesting();

    // Reset telemetry
    resetEventSyncTelemetryForTesting();

    // Default mock for cloudSyncApi snapshot endpoints to prevent network calls
    vi.spyOn(cloudSyncApi, 'getSyncState').mockResolvedValue({
      profile: {
        id: testUserId,
        displayName: 'Test User',
        level: 1,
        xp: 0,
        streak: 0,
        targetGoal: 'daily',
        targetDailyNewWords: 15,
        fourSkillsScoresJson: '{}',
        hasLearnedNightOwl: false,
        lastActiveAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      srsItems: [],
      dailyLogs: [],
      serverTime: new Date().toISOString(),
    });

    vi.spyOn(cloudSyncApi, 'uploadSync').mockResolvedValue({
      success: true,
      syncedAt: new Date().toISOString(),
      srsItemsUpserted: 0,
      dailyLogsUpserted: 0,
    });

    // Clear local outbox and reset feature gate
    localOutbox.clear();
    setEventSyncConfig({
      enabled: true,
      batchSize: 50,
      maxConsecutiveBatches: 3,
    });

    // Reset cloud sync store
    useCloudSyncStore.setState({
      status: 'idle',
      lastSyncedAt: null,
      errorMessage: null,
      user: { id: testUserId, email: 'learner4@example.com' } as any,
      userId: testUserId,
      userEmail: 'learner4@example.com',
      isOnline: true,
    });

    // Reset app store
    useAppStore.getState().resetToDefault();
  });


  afterEach(() => {
    vi.restoreAllMocks();
    clearSyncCoordinatorForTesting();
    localOutbox.clear();
  });

  // Helper to create valid review events
  function makeReviewEvent(cardId: string, rating: 'again' | 'hard' | 'good' | 'easy' = 'good') {
    return createDomainEvent({
      eventType: 'review_card',
      entityType: 'card',
      entityId: cardId,
      userId: testUserId,
      payload: {
        cardId,
        wordText: 'apple',
        grade: rating === 'easy' ? 3 : rating === 'good' ? 2 : rating === 'hard' ? 1 : 0,
        rating,
        algorithm: 'fsrs',
        reviewMode: 'due_today',
        intervalBefore: 1,
        intervalAfter: 4,
        repetitionBefore: 1,
        repetitionAfter: 2,
        easeFactorBefore: 2.5,
        easeFactorAfter: 2.6,
        stability: 4.2,
        difficulty: 3.1,
        retrievability: 0.95,
        durationMs: 1200,
      },
    });
  }

  // ==========================================================================
  // 1. OFFLINE GUARD & EXPIRING AUTH SAFEGUARDS
  // ==========================================================================
  describe('1. Offline Guard & Auth Boundaries', () => {
    it('khi thiết bị offline (isOnline = false): outbox không gửi event, coordinator trả status offline an toàn', async () => {
      useCloudSyncStore.setState({ isOnline: false });
      const rpcSpy = vi.spyOn(supabase, 'rpc');

      // Enqueue 3 events vào outbox
      localOutbox.enqueue(makeReviewEvent('card-1'));
      localOutbox.enqueue(makeReviewEvent('card-2'));
      localOutbox.enqueue(makeReviewEvent('card-3'));
      expect(localOutbox.getPendingCount()).toBe(3);

      const res = await performFullSync();

      expect(res.success).toBe(false);
      expect(useCloudSyncStore.getState().status).toBe('offline');
      // Không có bất kỳ RPC nào được gọi
      expect(rpcSpy).not.toHaveBeenCalled();
      // Toàn bộ 3 events vẫn nằm an toàn trong outbox
      expect(localOutbox.getPendingCount()).toBe(3);
    });

    it('khi user chưa đăng nhập hoặc auth hết hạn (user = null): không flush outbox, đặt status idle', async () => {
      useCloudSyncStore.setState({ user: null, userId: null });
      const rpcSpy = vi.spyOn(supabase, 'rpc');

      localOutbox.enqueue(makeReviewEvent('card-1'));

      const res = await performFullSync();

      expect(res.success).toBe(false);
      expect(useCloudSyncStore.getState().status).toBe('idle');
      expect(rpcSpy).not.toHaveBeenCalled();
      expect(localOutbox.getPendingCount()).toBe(1);
    });
  });

  // ==========================================================================
  // 2. HYBRID SYNC ORDER & STATE RECONCILIATION
  // ==========================================================================
  describe('2. Hybrid Sync Execution Order (Outbox Flush Before Snapshot Fetch)', () => {
    it('thực hiện outbox flush TRƯỚC KHI fetch snapshot từ server để tránh stale snapshot overwrite', async () => {
      const callSequence: string[] = [];

      // Mock RPC ingest
      (vi.spyOn(supabase, 'rpc') as any).mockImplementation(async (fnName: string) => {
        callSequence.push(`rpc:${fnName}`);
        return {
          data: {
            success: true,
            results: [{ event_id: 'ev-1', status: 'applied', message: 'OK' }],
            server_now: new Date().toISOString(),
          },
          error: null,
        };
      });

      // Mock fetch snapshot via cloudSyncApi
      vi.spyOn(cloudSyncApi, 'getSyncState').mockImplementation(async () => {
        callSequence.push('api:getSyncState');
        return {
          profile: { id: testUserId, displayName: 'Test', level: 1, xp: 50, streak: 0, targetGoal: 'daily', targetDailyNewWords: 15, fourSkillsScoresJson: '{}', hasLearnedNightOwl: false, lastActiveAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          srsItems: [],
          dailyLogs: [],
          serverTime: new Date().toISOString(),
        };
      });

      const event = makeReviewEvent('card-1');
      event.eventId = 'ev-1';
      localOutbox.enqueue(event);
      expect(localOutbox.getPendingCount()).toBe(1);

      const syncResult = await performFullSync();

      expect(syncResult.success).toBe(true);
      // RPC outbox flush phải diễn ra trước khi gọi snapshot API (getSyncState)
      expect(callSequence[0]).toBe('rpc:ingest_learning_events');
      expect(callSequence).toContain('api:getSyncState');
      // Event đã được ACK và xóa khỏi outbox
      expect(localOutbox.getPendingCount()).toBe(0);

    });

    it('nếu outbox flush gặp lỗi mạng tạm thời, snapshot sync vẫn chạy được (non-blocking fallback)', async () => {
      vi.spyOn(supabase, 'rpc').mockRejectedValueOnce(new Error('Network RPC Timeout'));

      vi.spyOn(supabase, 'from').mockImplementation(() => {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: testUserId, xp: 100 }, error: null }),
              data: [],
              error: null,
            }),
          }),
          upsert: async () => ({ error: null }),
        } as any;
      });

      const event = makeReviewEvent('card-1');
      localOutbox.enqueue(event);

      const syncResult = await performFullSync();

      // Snapshot sync vẫn thành công
      expect(syncResult.success).toBe(true);
      // Event chưa ACK nên vẫn được giữ lại trong outbox để retry lần sau
      expect(localOutbox.getPendingCount()).toBe(1);
      // Telemetry ghi nhận failure
      const telemetry = getEventSyncTelemetry();
      expect(telemetry.totalRetryCount).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 3. BOUNDED BATCHING & MULTI-BATCH DRAINING
  // ==========================================================================
  describe('3. Bounded Batching Through Coordinator', () => {
    it('chia nhỏ thành các batch có giới hạn (batchSize=2, maxConsecutiveBatches=3) và drain tuần tự', async () => {
      setEventSyncConfig({
        enabled: true,
        batchSize: 2,
        maxConsecutiveBatches: 3,
      });

      const rpcBatches: any[] = [];
      (vi.spyOn(supabase, 'rpc') as any).mockImplementation(async (_fn: string, args: any) => {
        rpcBatches.push(args.p_events);
        const results = (args.p_events || []).map((e: any) => ({
          event_id: e.event_id || e.eventId,
          status: 'applied',
        }));
        return {
          data: { success: true, results, server_now: new Date().toISOString() },
          error: null,
        };
      });

      // Thêm 5 events vào outbox
      for (let i = 1; i <= 5; i++) {
        localOutbox.enqueue(makeReviewEvent(`card-${i}`));
      }
      expect(localOutbox.getPendingCount()).toBe(5);

      const flushResult = await flushOutboxEventsThroughCoordinator();

      // Với batchSize=2, maxConsecutiveBatches=3:
      // Batch 1: 2 events
      // Batch 2: 2 events
      // Batch 3: 1 event (< batchSize => loop dừng)
      expect(rpcBatches.length).toBe(3);
      expect(rpcBatches[0].length).toBe(2);
      expect(rpcBatches[1].length).toBe(2);
      expect(rpcBatches[2].length).toBe(1);

      expect(flushResult.attemptedCount).toBe(5);
      expect(flushResult.acknowledgedCount).toBe(5);
      expect(localOutbox.getPendingCount()).toBe(0);
    });
  });

  // ==========================================================================
  // 4. PARTIAL SUCCESS & GRANULAR ACKNOWLEDGMENT
  // ==========================================================================
  describe('4. Partial Success & Granular ACK', () => {
    it('batch 5 events: 3 applied, 1 already_processed, 1 retryable_error -> xóa đúng 4, giữ đúng 1', async () => {
      const e1 = makeReviewEvent('c-1');
      const e2 = makeReviewEvent('c-2');
      const e3 = makeReviewEvent('c-3');
      const e4 = makeReviewEvent('c-4');
      const e5 = makeReviewEvent('c-5');

      localOutbox.enqueue(e1);
      localOutbox.enqueue(e2);
      localOutbox.enqueue(e3);
      localOutbox.enqueue(e4);
      localOutbox.enqueue(e5);

      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          results: [
            { event_id: e1.eventId, status: 'applied' },
            { event_id: e2.eventId, status: 'applied' },
            { event_id: e3.eventId, status: 'applied' },
            { event_id: e4.eventId, status: 'already_processed' }, // Idempotency
            { event_id: e5.eventId, status: 'retryable_error', message: 'Lock conflict' },
          ],
          server_now: new Date().toISOString(),
        },
        error: null,
      } as any);

      const result = await flushOutboxEventsThroughCoordinator();

      expect(result.attemptedCount).toBe(5);
      expect(result.acknowledgedCount).toBe(4);
      expect(result.retryableCount).toBe(1);

      // Đã xóa 4 events (3 applied + 1 already_processed)
      expect(localOutbox.getPendingCount()).toBe(1);
      const remaining = localOutbox.getAllEntries();
      expect(remaining.length).toBe(1);
      expect(remaining[0].event.eventId).toBe(e5.eventId);
      expect(remaining[0].status).toBe('pending'); // Reverted to pending for next cycle
    });

    it('rejected events (invalid payload/unsupported schema) bị xóa khỏi outbox để tránh poison pill loop', async () => {
      const validEvent = makeReviewEvent('valid-card');
      const badEvent = makeReviewEvent('bad-card');

      localOutbox.enqueue(validEvent);
      localOutbox.enqueue(badEvent);

      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          results: [
            { event_id: validEvent.eventId, status: 'applied' },
            { event_id: badEvent.eventId, status: 'rejected', message: 'Schema version 99 not supported' },
          ],
          server_now: new Date().toISOString(),
        },
        error: null,
      } as any);

      const result = await flushOutboxEventsThroughCoordinator();

      expect(result.attemptedCount).toBe(2);
      expect(result.acknowledgedCount).toBe(1);
      expect(result.rejectedCount).toBe(1);

      // Cả 2 đều bị loại khỏi hàng đợi: 1 ACK + 1 Purged rejected
      expect(localOutbox.getPendingCount()).toBe(0);

      const telemetry = getEventSyncTelemetry();
      expect(telemetry.totalRejectedCount).toBe(1);
      expect(telemetry.totalAckCount).toBe(1);
    });
  });

  // ==========================================================================
  // 5. IN-FLIGHT CRASH RECOVERY & LEASE TIMEOUT
  // ==========================================================================
  describe('5. Lease Timeout & In-flight Crash Recovery', () => {
    it('event bị kẹt ở trạng thái sending được tự động thu hồi về pending khi hết hạn lease', () => {
      const event = makeReviewEvent('stuck-card');
      localOutbox.enqueue(event);

      const baseNow = 1000000;
      vi.spyOn(Date, 'now').mockReturnValue(baseNow);

      // Giả lập worker đã markSending với lease 1000ms
      localOutbox.markSending([event.eventId], 1000);
      expect(localOutbox.peekBatch(10).length).toBe(0); // Đang leased, peek không thấy

      // Giả lập thời gian trôi qua quá 1000ms lease
      vi.spyOn(Date, 'now').mockReturnValue(baseNow + 2500);

      // Peek lại -> lease hết hạn -> tự động cho phép retry
      const ready = localOutbox.peekBatch(10);
      expect(ready.length).toBe(1);
      expect(ready[0].event.eventId).toBe(event.eventId);
    });
  });

  // ==========================================================================
  // 6. REQUEST COALESCING & CONCURRENT TRIGGERS
  // ==========================================================================
  describe('6. Request Coalescing Under Concurrent Triggers', () => {
    it('gọi performFullSync dồn dập nhiều lần cùng lúc chỉ chạy 1 active sync + 1 follow-up', async () => {
      let rpcCallCount = 0;
      (vi.spyOn(supabase, 'rpc') as any).mockImplementation(async () => {
        rpcCallCount++;
        await new Promise((r) => setTimeout(r, 50));
        return {
          data: { success: true, results: [], server_now: new Date().toISOString() },
          error: null,
        };
      });

      vi.spyOn(supabase, 'from').mockImplementation(() => {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
              data: [],
              error: null,
            }),
          }),
          upsert: async () => ({ error: null }),
        } as any;
      });

      localOutbox.enqueue(makeReviewEvent('coalesce-card'));

      // Kích hoạt đồng thời 3 cuộc gọi performFullSync
      const [res1, res2, res3] = await Promise.all([
        performFullSync(),
        performFullSync(),
        performFullSync(),
      ]);

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
      expect(res3.success).toBe(true);

      // Coordinator đã coalesce: tối đa 2 lần executeSync (1 active + 1 chained)
      expect(rpcCallCount).toBeLessThanOrEqual(2);
    });
  });

  // ==========================================================================
  // 7. GLOBAL RECONNECT EVENT INTEGRATION
  // ==========================================================================
  describe('7. Global Reconnect Online Listener Integration', () => {
    it('khi mạng reconnect (online event): listener toàn cục gọi performFullSync và flush outbox', async () => {
      useCloudSyncStore.setState({ isOnline: false, status: 'offline' });

      let flushed = false;
      (vi.spyOn(supabase, 'rpc') as any).mockImplementation(async () => {
        flushed = true;
        return {
          data: {
            success: true,
            results: [{ event_id: 'reconnect-ev', status: 'applied' }],
            server_now: new Date().toISOString(),
          },
          error: null,
        };
      });

      vi.spyOn(supabase, 'from').mockImplementation(() => {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
              data: [],
              error: null,
            }),
          }),
          upsert: async () => ({ error: null }),
        } as any;
      });

      const cleanup = initCloudSync();

      const event = makeReviewEvent('c-recon');
      event.eventId = 'reconnect-ev';
      localOutbox.enqueue(event);
      expect(localOutbox.getPendingCount()).toBe(1);

      // Phát sự kiện online
      window.dispatchEvent(new Event('online'));

      // Đợi coordinator hoàn tất
      await new Promise((r) => setTimeout(r, 100));

      expect(useCloudSyncStore.getState().isOnline).toBe(true);
      expect(flushed).toBe(true);
      expect(localOutbox.getPendingCount()).toBe(0);

      cleanup();
    });
  });

  // ==========================================================================
  // 8. FEATURE GATE TOGGLE
  // ==========================================================================
  describe('8. Feature Gate Boundary & Safe Rollback', () => {
    it('khi feature gate disabled: outbox không flush, nhưng snapshot sync vẫn chạy bình thường', async () => {
      setEventSyncConfig({ enabled: false });
      expect(isEventSyncEnabled()).toBe(false);

      const rpcSpy = vi.spyOn(supabase, 'rpc');
      let snapshotFetched = false;

      vi.spyOn(cloudSyncApi, 'getSyncState').mockImplementation(async () => {
        snapshotFetched = true;
        return {
          profile: { id: testUserId, displayName: 'Test', level: 1, xp: 0, streak: 0, targetGoal: 'daily', targetDailyNewWords: 15, fourSkillsScoresJson: '{}', hasLearnedNightOwl: false, lastActiveAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          srsItems: [],
          dailyLogs: [],
          serverTime: new Date().toISOString(),
        };
      });

      localOutbox.enqueue(makeReviewEvent('gated-card'));

      expect(localOutbox.getPendingCount()).toBe(1);

      const res = await performFullSync();

      expect(res.success).toBe(true);
      // RPC event ingestion không bị gọi
      expect(rpcSpy).not.toHaveBeenCalled();
      // Snapshot sync vẫn chạy
      expect(snapshotFetched).toBe(true);
      // Event trong outbox vẫn được giữ nguyên
      expect(localOutbox.getPendingCount()).toBe(1);

      // Bật lại feature gate -> sync tiếp theo sẽ flush
      setEventSyncConfig({ enabled: true });
      expect(isEventSyncEnabled()).toBe(true);
    });
  });

  // ==========================================================================
  // 9. DEVELOPER-SAFE INTERNAL OBSERVABILITY
  // ==========================================================================
  describe('9. Developer-Safe Observability Telemetry', () => {
    it('telemetry cập nhật chính xác các số liệu và không làm lộ token hoặc sensitive payload', async () => {
      const e1 = makeReviewEvent('telemetry-1');
      localOutbox.enqueue(e1);

      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          results: [{ event_id: e1.eventId, status: 'applied' }],
          server_now: '2026-10-07T12:00:00Z',
        },
        error: null,
      } as any);

      await flushOutboxEventsThroughCoordinator();

      const telemetry = getEventSyncTelemetry();
      expect(telemetry.pendingCount).toBe(0);
      expect(telemetry.totalAckCount).toBeGreaterThan(0);
      expect(telemetry.lastSyncSuccessAt).toBeDefined();
      expect(telemetry.lastSyncSuccessAt).not.toBeNull();

      // Kiểm tra tính an toàn: telemetry không chứa API keys, token, password, email
      const telemetryStr = JSON.stringify(telemetry);
      expect(telemetryStr).not.toContain('geminiApiKey');
      expect(telemetryStr).not.toContain('secret');
      expect(telemetryStr).not.toContain('password');
      expect(telemetryStr).not.toContain('learner4@example.com');
    });
  });
});
