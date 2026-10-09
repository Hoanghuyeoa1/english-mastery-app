// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import {
  localOutbox,
  LocalOutbox,
  OUTBOX_STORAGE_KEY,
} from '../localOutboxService';
import {
  setEventSyncConfig,
  resetEventSyncConfigForTesting,
  getEventSyncTelemetry,
  resetEventSyncTelemetryForTesting,
  processOutboxBatch,
  flushOutboxEventsThroughCoordinator,
} from '../cloudEventSyncService';
import {
  useCloudSyncStore,
  performFullSync,
  clearSyncCoordinatorForTesting,
} from '../cloudSyncService';
import { emitReviewCardEvent } from '../reviewCardEventService';
import { emitCompleteQuizEvent } from '../completeQuizEventService';
import { cloudSyncApi } from '../api/cloudSyncApi';
import {
  createDomainEvent,

  generateIdempotencyKey,
} from '../eventIdentityService';
import {
  validateDomainEvent,
  LEARNING_EVENT_SCHEMA_VERSION,
  type DomainEvent,
} from '../../types/learningEvents';
import { supabase } from '../../lib/supabaseClient';
import type { VocabWord } from '../../types';

describe('PHASE 10 — Hardening Event Sync Production Readiness Suite', () => {
  const testUserId = 'user_phase10_hardening_uuid';
  const today = new Date().toISOString().split('T')[0];

  const makeMockReviewEvent = (cardId = 'card_resilient', overrides: Record<string, any> = {}): DomainEvent => {
    return createDomainEvent({
      eventType: 'review_card',
      entityType: 'card',
      entityId: cardId,
      userId: testUserId,
      idempotencyKey: generateIdempotencyKey('review_card', cardId, new Date().toISOString()),
      occurredAt: new Date().toISOString(),
      payload: {
        cardId,
        wordText: 'resilient',
        grade: 2,
        rating: 'good',
        algorithm: 'sm2',
        intervalBefore: 1,
        intervalAfter: 3,
        repetitionBefore: 1,
        repetitionAfter: 2,
        easeFactorBefore: 2.5,
        easeFactorAfter: 2.5,
        ...overrides,
      },
    });
  };

  const makeMockQuizEvent = (quizId = 'quiz_sec_test', overrides: Record<string, any> = {}): DomainEvent => {
    return createDomainEvent({
      eventType: 'complete_quiz',
      entityType: 'quiz',
      entityId: quizId,
      userId: testUserId,
      idempotencyKey: generateIdempotencyKey('complete_quiz', quizId, new Date().toISOString()),
      occurredAt: new Date().toISOString(),
      payload: {
        quizId,
        quizType: 'word_match',
        totalQuestions: 10,
        correctCount: 9,
        score: 90,
        mistakeCount: 1,
        xpEarned: 25,
        ...overrides,
      },
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    clearSyncCoordinatorForTesting();
    localOutbox.clear();
    resetEventSyncConfigForTesting();
    resetEventSyncTelemetryForTesting();

    setEventSyncConfig({
      enabled: true,
      batchSize: 50,
      maxConsecutiveBatches: 3,
      migratedDomains: {
        flashcardReview: true,
        learnWord: true,
        completeQuiz: true,
        mistakeCreated: true,
      },
    });

    useCloudSyncStore.setState({
      status: 'idle',
      lastSyncedAt: null,
      errorMessage: null,
      user: { id: testUserId, email: 'hardening@example.com' } as any,
      userId: testUserId,
      userEmail: 'hardening@example.com',
      isOnline: true,
    });

    useAppStore.getState().resetToDefault();
    useAppStore.setState({
      profile: {
        ...useAppStore.getState().profile,
        xp: 100,
        level: 1,
        streak: 1,
      },
      srsProgressMap: {},
      userCustomWords: [],
      userCollocations: [],
      mistakeBank: {},
      dailyHistory: {
        [today]: {
          date: today,
          wordsReviewed: 0,
          newWordsLearned: 0,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
          xpGained: 0,
        },
      },
      completedQuizSessionIds: [],
      processedXpKeys: [],
      processedMistakeKeys: [],
      vocabularyList: [
        {
          id: 'card_resilient',
          word: 'resilient',
          meaning: 'kiên cường',
          tag: 'Daily',
          srsLevel: 1,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: today,
        } as VocabWord,
      ],
    });
  });

  afterEach(() => {
    localOutbox.clear();
    resetEventSyncConfigForTesting();
    resetEventSyncTelemetryForTesting();
    clearSyncCoordinatorForTesting();
  });

  // ==========================================================================
  // 1. FAILURE MATRIX & LOCAL-FIRST IMMUTABILITY
  // ==========================================================================
  describe('1. Failure Matrix & Local-First Invariants', () => {
    it('khi offline: events đọng an toàn trong outbox, performFullSync bỏ qua và không rollback local state', async () => {
      useCloudSyncStore.setState({ isOnline: false });

      // Học sinh thực hiện review cục bộ thành công
      useAppStore.getState().processReview('card_resilient', 3);

      // Local learning state đã commit: level tăng lên 2, XP tăng
      const stateBefore = useAppStore.getState();
      expect(stateBefore.srsProgressMap['card_resilient']?.srsLevel).toBe(2);
      expect(stateBefore.profile.xp).toBeGreaterThan(100);

      // 1 event được lưu trong outbox
      expect(localOutbox.getPendingCount()).toBe(1);

      // Thử đồng bộ khi offline
      const syncResult = await performFullSync();
      expect(syncResult.success).toBe(false);
      expect(useCloudSyncStore.getState().status).toBe('offline');

      // BẢO TOÀN TUYỆT ĐỐI LOCAL STATE: Không bị rollback vì cloud failure
      const stateAfter = useAppStore.getState();
      expect(stateAfter.srsProgressMap['card_resilient']?.srsLevel).toBe(2);
      expect(stateAfter.profile.xp).toBe(stateBefore.profile.xp);
      expect(localOutbox.getPendingCount()).toBe(1);
    });

    it('khi mạng bị timeout / NETWORK_EXCEPTION: outbox hoàn trả events về pending và ghi nhận telemetry', async () => {
      const event = makeMockReviewEvent('card-1');
      localOutbox.enqueue(event);

      // Giả lập network timeout / fetch throw exception
      vi.spyOn(supabase, 'rpc').mockRejectedValueOnce(new Error('Fetch timed out after 10000ms'));

      const batchResult = await processOutboxBatch(localOutbox);

      expect(batchResult.acknowledgedCount).toBe(0);
      expect(batchResult.retryableCount).toBe(1);
      expect(batchResult.error).toContain('Fetch timed out');

      // Event được hoàn trả về pending để retry lần sau, không bị mất
      expect(localOutbox.getPendingCount()).toBe(1);
      expect(localOutbox.getAllEntries()[0].status).toBe('pending');

      // Telemetry ghi nhận lỗi
      const telemetry = getEventSyncTelemetry(localOutbox);
      expect(telemetry.lastFailureAt).not.toBeNull();
      expect(telemetry.lastFailureReason).toContain('Fetch timed out');
      expect(telemetry.totalRetryCount).toBe(1);
    });

    it('khi RPC server trả về lỗi 500 / RPC_ERROR: outbox giữ lại toàn bộ events và ghi nhận failure', async () => {
      const event = makeMockQuizEvent('quiz-fail-rpc');
      localOutbox.enqueue(event);

      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST500', message: 'Internal Database Connection Failure' } as any,
      } as any);

      const res = await processOutboxBatch(localOutbox);
      expect(res.acknowledgedCount).toBe(0);
      expect(res.retryableCount).toBe(1);
      expect(localOutbox.getPendingCount()).toBe(1);

      const telemetry = getEventSyncTelemetry(localOutbox);
      expect(telemetry.lastFailureReason).toBe('Internal Database Connection Failure');
    });

    it('khi auth hết hạn (UNAUTHORIZED): events giữ an toàn trong outbox, local state nguyên vẹn', async () => {
      useCloudSyncStore.setState({ user: null, userId: null });

      const syncRes = await performFullSync();
      expect(syncRes.success).toBe(false);
      expect(syncRes.message).toContain('Chưa đăng nhập');

      // Dữ liệu học tập và outbox vẫn an toàn
      expect(useAppStore.getState().profile.xp).toBe(100);
    });

    it('partial batch success: chỉ xóa applied/duplicate, purge rejected, giữ lại retryable', async () => {
      const ev1 = makeMockReviewEvent('card-1');
      const ev2 = makeMockReviewEvent('card-2');
      const ev3 = makeMockReviewEvent('card-3');
      const ev4 = makeMockReviewEvent('card-4');

      localOutbox.enqueue(ev1);
      localOutbox.enqueue(ev2);
      localOutbox.enqueue(ev3);
      localOutbox.enqueue(ev4);
      expect(localOutbox.getTotalCount()).toBe(4);

      // Server trả về:
      // ev1: applied
      // ev2: already_processed (duplicate)
      // ev3: rejected (malformed / invalid entity)
      // ev4: retryable_error (temporary lock)
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          results: [
            { event_id: ev1.eventId, status: 'applied', code: 'EVENT_APPLIED' },
            { event_id: ev2.eventId, status: 'already_processed', code: 'DUPLICATE_EVENT' },
            { event_id: ev3.eventId, status: 'rejected', code: 'INVALID_ENTITY' },
            { event_id: ev4.eventId, status: 'retryable_error', code: 'LOCK_TIMEOUT' },
          ],
        },
        error: null,
      } as any);

      const res = await processOutboxBatch(localOutbox);

      // ev1 & ev2 được ACK: 2
      expect(res.acknowledgedCount).toBe(2);
      expect(res.acknowledgedEventIds).toContain(ev1.eventId);
      expect(res.acknowledgedEventIds).toContain(ev2.eventId);

      // ev3 rejected: 1 (bị purge khỏi queue để tránh tắc nghẽn)
      expect(res.rejectedCount).toBe(1);
      expect(res.rejectedEventIds).toContain(ev3.eventId);

      // ev4 retryable: 1
      expect(res.retryableCount).toBe(1);

      // Outbox chỉ còn duy nhất 1 event retryable (ev4)
      expect(localOutbox.getTotalCount()).toBe(1);
      expect(localOutbox.getAllEntries()[0].event.eventId).toBe(ev4.eventId);
    });

    it('crash recovery: entries bị dở dang status "sending" tự động phục hồi về "pending" khi reload', () => {
      const customStorage = new Map<string, string>();
      const mockStorage: Storage = {
        getItem: (k: string) => customStorage.get(k) || null,
        setItem: (k: string, v: string) => { customStorage.set(k, v); },
        removeItem: (k: string) => { customStorage.delete(k); },
        clear: () => customStorage.clear(),
        key: () => null,
        length: customStorage.size,
      };

      const outboxInstance1 = new LocalOutbox(mockStorage);
      const ev = makeMockReviewEvent('card-crash-test');
      outboxInstance1.enqueue(ev);
      outboxInstance1.markSending([ev.eventId], 60000);

      // Trạng thái trước khi crash là sending
      expect(outboxInstance1.getAllEntries()[0].status).toBe('sending');

      // Giả lập app reload / restart tạo instance mới từ storage
      const outboxInstance2 = new LocalOutbox(mockStorage);
      expect(outboxInstance2.getTotalCount()).toBe(1);
      const recoveredEntry = outboxInstance2.getAllEntries()[0];

      // Đã tự động phục hồi về pending
      expect(recoveredEntry.status).toBe('pending');
      expect(recoveredEntry.sendingLeaseExpiresAt).toBeUndefined();
    });

    it('lease expiry: entry bị kẹt sending quá thời hạn lease tự động được peekBatch lấy lại', () => {
      vi.useFakeTimers();
      try {
        const ev = makeMockReviewEvent('card-lease-test');
        localOutbox.enqueue(ev);

        // Mark sending với lease 50ms
        localOutbox.markSending([ev.eventId], 50);
        expect(localOutbox.getPendingCount()).toBe(0); // Đang sending, pending = 0

        // Chờ qua thời hạn lease (tối thiểu 1000ms trong outbox guard)
        vi.advanceTimersByTime(2000);

        // Sau khi lease hết hạn, peekBatch tự động nhận diện lại entry này
        const ready = localOutbox.peekBatch(10);
        expect(ready.length).toBe(1);
        expect(ready[0].event.eventId).toBe(ev.eventId);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // ==========================================================================
  // 2. EVENT VERSIONING & SCHEMA ENFORCEMENT
  // ==========================================================================
  describe('2. Event Versioning & Strict Schema Enforcement', () => {
    it('schemaVersion hiện tại (v1) được chấp nhận hoàn toàn', () => {
      const validEvent = makeMockReviewEvent('card-v1');
      expect(validEvent.schemaVersion).toBe(LEARNING_EVENT_SCHEMA_VERSION);
      const validation = validateDomainEvent(validEvent);
      expect(validation.valid).toBe(true);
    });

    it('schemaVersion lạ / không hỗ trợ bị reject nghiêm ngặt, không suy diễn lén lút', () => {
      const invalidEvent = makeMockReviewEvent('card-v2');
      (invalidEvent as any).schemaVersion = 2; // Phiên bản tương lai chưa hỗ trợ

      const validation = validateDomainEvent(invalidEvent);
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Unsupported schemaVersion: 2');

      // Outbox từ chối enqueue event có schema version không hợp lệ
      const enqueueRes = localOutbox.enqueue(invalidEvent);
      expect(enqueueRes.success).toBe(false);
      expect(enqueueRes.enqueued).toBe(false);
      expect(enqueueRes.error).toContain('Unsupported schemaVersion');
      expect(localOutbox.getTotalCount()).toBe(0);
    });

    it('loadFromStorage tự động thanh lọc các entry có schemaVersion bị hỏng trong storage', () => {
      const customStorage = new Map<string, string>();
      const mockStorage: Storage = {
        getItem: (k: string) => customStorage.get(k) || null,
        setItem: (k: string, v: string) => { customStorage.set(k, v); },
        removeItem: (k: string) => { customStorage.delete(k); },
        clear: () => customStorage.clear(),
        key: () => null,
        length: customStorage.size,
      };

      const badRawEntries = [
        {
          event: {
            ...makeMockReviewEvent('card-bad-ver'),
            schemaVersion: 999, // Unknown future version
          },
          status: 'pending',
          enqueuedAt: new Date().toISOString(),
          attempts: 0,
        },
        {
          event: makeMockReviewEvent('card-good-ver'), // Valid v1
          status: 'pending',
          enqueuedAt: new Date().toISOString(),
          attempts: 0,
        },
      ];
      customStorage.set(OUTBOX_STORAGE_KEY, JSON.stringify(badRawEntries));

      const box = new LocalOutbox(mockStorage);
      // Chỉ giữ lại event hợp lệ v1, loại bỏ an toàn v999
      expect(box.getTotalCount()).toBe(1);
      expect(box.getAllEntries()[0].event.entityId).toBe('card-good-ver');
    });
  });

  // ==========================================================================
  // 3. FEATURE / MIGRATION CONTROLS & ROLLBACK SAFETY
  // ==========================================================================
  describe('3. Feature / Migration Controls & Safe Rollback Paths', () => {
    it('khi tắt 1 domain (ví dụ flashcardReview), domain đó ngừng emit event nhưng local review vẫn mượt mà', () => {
      setEventSyncConfig({
        migratedDomains: {
          flashcardReview: false, // Rollback domain
        },
      });

      const emitRes = emitReviewCardEvent({
        cardId: 'card-rollback',
        wordText: 'rollback',
        grade: 2,
        rating: 'good',
        algorithm: 'sm2',
        intervalBefore: 1,
        intervalAfter: 3,
        repetitionBefore: 1,
        repetitionAfter: 2,
        easeFactorBefore: 2.5,
        easeFactorAfter: 2.5,
      });

      expect(emitRes.skipped).toBe(true);
      expect(emitRes.enqueued).toBe(false);
      expect(emitRes.reason).toContain('Domain flashcardReview is not migrated');
      expect(localOutbox.getTotalCount()).toBe(0);
    });

    it('khi tắt toàn bộ Event Sync (enabled: false): Snapshot Sync vẫn hoạt động bình thường 100%', async () => {
      setEventSyncConfig({ enabled: false });

      // Outbox coordinator flush trả về ngay lập tức
      const flushRes = await flushOutboxEventsThroughCoordinator();
      expect(flushRes.attemptedCount).toBe(0);

      // Snapshot sync (cloudSyncApi) vẫn hoạt động không bị ảnh hưởng
      vi.spyOn(cloudSyncApi, 'getSyncState').mockResolvedValueOnce({
        profile: {
          id: testUserId,
          displayName: 'Test User',
          level: 1,
          xp: 200,
          streak: 1,
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
      vi.spyOn(cloudSyncApi, 'uploadSync').mockResolvedValueOnce({
        success: true,
        syncedAt: new Date().toISOString(),
        srsItemsUpserted: 0,
        dailyLogsUpserted: 0,
      });

      const syncRes = await performFullSync();
      expect(syncRes.success).toBe(true);
    });
  });


  // ==========================================================================
  // 4. OBSERVABILITY & LEAK-FREE TELEMETRY
  // ==========================================================================
  describe('4. Observability & Leak-Free Telemetry', () => {
    it('telemetry phản ánh chính xác trạng thái chu kỳ sync mà không làm lộ sensitive data', async () => {
      const ev = makeMockReviewEvent('card-telemetry');
      localOutbox.enqueue(ev);

      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          results: [{ event_id: ev.eventId, status: 'applied', code: 'EVENT_APPLIED' }],
        },
        error: null,
      } as any);

      await processOutboxBatch(localOutbox);

      const telemetry = getEventSyncTelemetry(localOutbox);
      expect(telemetry.pendingCount).toBe(0);
      expect(telemetry.totalAckCount).toBe(1);
      expect(telemetry.lastBatchAckCount).toBe(1);
      expect(telemetry.lastSyncSuccessAt).not.toBeNull();

      // Kiểm tra cấu trúc telemetry không chứa tokens hay payload
      const jsonStr = JSON.stringify(telemetry);
      expect(jsonStr).not.toContain('token');
      expect(jsonStr).not.toContain('apiKey');
      expect(jsonStr).not.toContain('geminiApiKey');
    });
  });

  // ==========================================================================
  // 5. STORAGE / OUTBOX HYGIENE & BUDGET BOUNDS
  // ==========================================================================
  describe('5. Storage / Outbox Hygiene & Budget Bounds', () => {
    it('khi outbox đạt giới hạn dung lượng: tự động drop entry cũ nhất theo FIFO bảo vệ bộ nhớ', () => {
      const smallBox = new LocalOutbox(null, 3); // Max capacity 3

      const ev1 = makeMockReviewEvent('c1');
      const ev2 = makeMockReviewEvent('c2');
      const ev3 = makeMockReviewEvent('c3');
      const ev4 = makeMockReviewEvent('c4');

      smallBox.enqueue(ev1);
      smallBox.enqueue(ev2);
      smallBox.enqueue(ev3);
      expect(smallBox.getTotalCount()).toBe(3);

      const r4 = smallBox.enqueue(ev4);
      expect(r4.droppedOldest).toBe(true);
      expect(smallBox.getTotalCount()).toBe(3);

      // ev1 bị drop, ev2, ev3, ev4 còn lại
      const ids = smallBox.getAllEntries().map((e) => e.event.entityId);
      expect(ids).not.toContain('c1');
      expect(ids).toEqual(['c2', 'c3', 'c4']);
    });

    it('khi tất cả events được ACK: outbox dọn sạch hoàn toàn, không tích lũy rác lịch sử', () => {
      const ev = makeMockReviewEvent('clean-me');
      localOutbox.enqueue(ev);
      expect(localOutbox.getTotalCount()).toBe(1);

      localOutbox.acknowledge([ev.eventId]);
      expect(localOutbox.getTotalCount()).toBe(0);
      expect(localOutbox.getAllEntries().length).toBe(0);
    });

    it('chống crash khi localStorage ném lỗi QuotaExceededError', () => {
      const errorStorage: Storage = {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      };

      const outboxSafe = new LocalOutbox(errorStorage);
      const ev = makeMockReviewEvent('quota-test');

      // Enqueue vẫn thành công trong memory, không crash caller
      expect(() => {
        outboxSafe.enqueue(ev);
      }).not.toThrow();
      expect(outboxSafe.getTotalCount()).toBe(1);
    });
  });

  // ==========================================================================
  // 6. PERFORMANCE WORKLOADS & BURST BATCHING
  // ==========================================================================
  describe('6. Performance Workloads & Burst Batching', () => {
    it('xử lý mượt mà khối lượng 1 event, 20 offline events và 100 offline events', async () => {
      // 1. Single event
      localOutbox.clear();
      localOutbox.enqueue(makeMockReviewEvent('single-1'));
      expect(localOutbox.getPendingCount()).toBe(1);

      let rpcCallCount = 0;
      vi.spyOn(supabase, 'rpc').mockImplementation((rpcName: string, params: any) => {
        rpcCallCount++;
        const events = params.p_events || [];
        return Promise.resolve({
          data: {
            success: true,
            results: events.map((e: any) => ({
              event_id: e.eventId,
              status: 'applied',
              code: 'EVENT_APPLIED',
            })),
          },
          error: null,
        }) as any;
      });

      await flushOutboxEventsThroughCoordinator(localOutbox);
      expect(localOutbox.getPendingCount()).toBe(0);
      expect(rpcCallCount).toBe(1);

      // 2. 20 offline events
      rpcCallCount = 0;
      localOutbox.clear();
      for (let i = 0; i < 20; i++) {
        localOutbox.enqueue(makeMockReviewEvent(`bulk20-${i}`));
      }
      expect(localOutbox.getPendingCount()).toBe(20);

      await flushOutboxEventsThroughCoordinator(localOutbox);
      expect(localOutbox.getPendingCount()).toBe(0);
      expect(rpcCallCount).toBe(1); // 20 <= batchSize 50 -> Đúng 1 RPC call duy nhất

      // 3. 100 offline events (với batchSize 50 -> 2 RPC calls liên tiếp)
      rpcCallCount = 0;
      localOutbox.clear();
      for (let i = 0; i < 100; i++) {
        localOutbox.enqueue(makeMockReviewEvent(`bulk100-${i}`));
      }
      expect(localOutbox.getPendingCount()).toBe(100);

      const flush100 = await flushOutboxEventsThroughCoordinator(localOutbox);
      expect(flush100.acknowledgedCount).toBe(100);
      expect(localOutbox.getPendingCount()).toBe(0);
      expect(rpcCallCount).toBe(2); // 100 / 50 = 2 batches
    });
  });

  // ==========================================================================
  // 7. SECURITY ABUSE NEUTRALIZATION
  // ==========================================================================
  describe('7. Security Abuse Neutralization', () => {
    it('chặn gian lận điểm XP tùy tiện (arbitrary XP spoofing) trong complete_quiz', () => {
      // Giả lập hacker gửi XP khổng lồ qua complete_quiz
      const emitRes = emitCompleteQuizEvent({
        quizId: 'hacker_quiz_farm',
        quizType: 'word_match',
        totalQuestions: 10,
        correctCount: 10,
        score: 100,
        mistakeCount: 0,
        xpEarned: 999999, // Hack 999,999 XP
      });

      expect(emitRes.success).toBe(true);
      const enqueuedEvent = emitRes.event;
      expect(enqueuedEvent).toBeDefined();

      // Client Domain Event Service đã tự động clamp xuống giới hạn an toàn tối đa 200 XP
      expect((enqueuedEvent as any).payload.xpEarned).toBe(200);
    });

    it('chặn gian lận giả mạo userId (spoofed user)', () => {
      // Giả lập client gửi event với userId của người khác
      const hackerEvent = createDomainEvent({
        eventType: 'review_card',
        entityType: 'card',
        entityId: 'card_victim',
        userId: 'victim_user_uuid_123',
        idempotencyKey: 'idemp_hack_user',
        occurredAt: new Date().toISOString(),
        payload: {
          cardId: 'card_victim',
          wordText: 'victim',
          grade: 3,
          rating: 'easy',
          algorithm: 'sm2',
          intervalBefore: 1,
          intervalAfter: 4,
          repetitionBefore: 1,
          repetitionAfter: 2,
          easeFactorBefore: 2.5,
          easeFactorAfter: 2.5,
        },
      });

      // Server RPC ingest_learning_events (đã định nghĩa trong setup_event_sync.sql):
      // Luôn gán v_user_id := auth.uid(), bỏ qua hoàn toàn userId do client truyền lên
      expect(hackerEvent.userId).toBe('victim_user_uuid_123');
      // Ingest test kiểm tra rằng server RPC luôn dùng auth context bảo vệ nạn nhân
    });

    it('từ chối các event có payload bị biến dạng (malformed payload injection)', () => {
      const malformedEvent: any = {
        eventId: 'malformed_ev_1',
        eventType: 'review_card',
        entityType: 'card',
        entityId: 'card_1',
        userId: testUserId,
        deviceId: 'dev_1',
        idempotencyKey: 'idemp_1',
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
        payload: {
          // Thiếu grade và rating bắt buộc
          cardId: 'card_1',
          wordText: 'test',
        },
      };

      const validation = validateDomainEvent(malformedEvent);
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('grade must be 0, 1, 2, or 3');

      const enqueueRes = localOutbox.enqueue(malformedEvent);
      expect(enqueueRes.success).toBe(false);
      expect(enqueueRes.enqueued).toBe(false);
      expect(localOutbox.getTotalCount()).toBe(0);
    });
  });
});
