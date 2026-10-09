// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import { localOutbox, LocalOutbox } from '../localOutboxService';
import {
  setEventSyncConfig,
  resetEventSyncConfigForTesting,
  useCloudSyncStore,
  clearSyncCoordinatorForTesting,
  flushOutboxEventsThroughCoordinator,
} from '../cloudSyncService';
import { emitMistakeCreatedEvent } from '../mistakeCreatedEventService';
import { ingestTutorFeedback } from '../tutorFeedbackBridge';
import { supabase } from '../../lib/supabaseClient';
import type { MistakeCreatedEvent } from '../../types/learningEvents';

describe('PHASE 8 — Domain Migration: mistake_created Event Emission & SSOT Suite', () => {
  const testUserId = 'user_phase8_tester_uuid';
  const today = new Date().toISOString().split('T')[0];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    clearSyncCoordinatorForTesting();
    localOutbox.clear();
    resetEventSyncConfigForTesting();

    // Enable mistakeCreated domain in Event Sync
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

    // Cloud Sync Store setup
    useCloudSyncStore.setState({
      status: 'idle',
      lastSyncedAt: null,
      errorMessage: null,
      user: { id: testUserId, email: 'tester@example.com' } as any,
      userId: testUserId,
      userEmail: 'tester@example.com',
      isOnline: true,
    });

    // App Store reset
    useAppStore.getState().resetToDefault();
    useAppStore.setState({
      mistakeBank: {},
      processedMistakeKeys: [],
      vocabularyList: [
        {
          id: 'vocab_resilient',
          word: 'resilient',
          meaning: 'kiên cường',
          example: 'She is a resilient person.',
          tag: 'Daily',
          srsLevel: 1,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: today,
        } as any,
      ],
    });
  });

  afterEach(() => {
    localOutbox.clear();
    resetEventSyncConfigForTesting();
    clearSyncCoordinatorForTesting();
  });

  // ==========================================================================
  // 1. LOCAL-FIRST EMISSION: recordMistake
  // ==========================================================================
  describe('1. Local-First recordMistake Event Emission', () => {
    it('recordMistake commit local Mistake Bank trước và phát đúng 1 mistake_created event vào Local Outbox', () => {
      expect(localOutbox.getTotalCount()).toBe(0);

      const word = {
        id: 'vocab_resilient',
        word: 'resilient',
        meaning: 'kiên cường',
        example: 'She is a resilient person.',
      };

      useAppStore.getState().recordMistake(word, 'flashcard', {
        type: 'meaning',
        userAnswer: 'yếu ớt',
        expectedAnswer: 'kiên cường',
        context: 'She is a resilient person.',
        idempotencyKey: 'idemp_mistake_test_101',
      });

      // 1. Kiểm tra local state đã commit trong Mistake Bank
      const bank = useAppStore.getState().mistakeBank;
      const mistake = bank['vocab_resilient'];
      expect(mistake).toBeDefined();
      expect(mistake.word).toBe('resilient');
      expect(mistake.mistakeCount).toBe(1);
      expect(mistake.wrongCount).toBe(1);
      expect(mistake.resolved).toBe(false);
      expect(mistake.primaryType).toBe('meaning');
      expect(mistake.source).toBe('flashcard');

      // 2. Kiểm tra Local Outbox chứa đúng 1 event
      expect(localOutbox.getPendingCount()).toBe(1);
      const entries = localOutbox.getAllEntries();
      expect(entries.length).toBe(1);

      const event = entries[0].event as MistakeCreatedEvent;
      expect(event.eventType).toBe('mistake_created');
      expect(event.entityType).toBe('mistake');
      expect(event.entityId).toBe('vocab_resilient');
      expect(event.schemaVersion).toBe(1);
      expect(event.deviceId).toBeDefined();
      expect(event.idempotencyKey).toBe('idemp_mistake_test_101');

      // Payload metadata
      expect(event.payload.mistakeId).toBe('vocab_resilient');
      expect(event.payload.wordId).toBe('vocab_resilient');
      expect(event.payload.word).toBe('resilient');
      expect(event.payload.source).toBe('flashcard');
      expect(event.payload.mistakeType).toBe('meaning');
      expect(event.payload.userAnswer).toBe('yếu ớt');
      expect(event.payload.expectedAnswer).toBe('kiên cường');
      expect(event.payload.context).toBe('She is a resilient person.');
    });

    it('không serialize toàn bộ store / profile vào event payload (< 1 KB)', () => {
      useAppStore.getState().recordMistake(
        { id: 'vocab_resilient', word: 'resilient', meaning: 'kiên cường' },
        'classic_quiz'
      );

      const entries = localOutbox.getAllEntries();
      const rawPayload = JSON.stringify(entries[0].event.payload);

      expect(rawPayload.length).toBeLessThan(1024);
      expect(rawPayload).not.toContain('geminiApiKey');
      expect(rawPayload).not.toContain('vocabularyList');
      expect(rawPayload).not.toContain('dailyHistory');
    });
  });

  // ==========================================================================
  // 2. QUIZ FAILURE EMISSION: recordQuizMistakeResult
  // ==========================================================================
  describe('2. Quiz Failure Emission via recordQuizMistakeResult', () => {
    it('khi trả lời sai (!isCorrect), recordQuizMistakeResult commit mistakeBank và phát 1 event', () => {
      const eventRes = useAppStore.getState().recordQuizMistakeResult('epiphany', false, {
        source: 'classic_quiz',
        type: 'meaning',
        userAnswer: 'sự buồn bã',
        expectedAnswer: 'sự giác ngộ',
        context: 'He had an epiphany.',
        idempotencyKey: 'idemp_quiz_mistake_epiphany',
      });

      expect(eventRes.resolved).toBe(false);
      expect(useAppStore.getState().mistakeBank['epiphany']).toBeDefined();
      expect(useAppStore.getState().mistakeBank['epiphany'].mistakeCount).toBe(1);

      expect(localOutbox.getPendingCount()).toBe(1);
      const event = localOutbox.getAllEntries()[0].event as MistakeCreatedEvent;
      expect(event.eventType).toBe('mistake_created');
      expect(event.payload.word).toBe('epiphany');
      expect(event.payload.mistakeType).toBe('meaning');
      expect(event.idempotencyKey).toBe('idemp_quiz_mistake_epiphany');
    });

    it('khi trả lời đúng (isCorrect = true), recordQuizMistakeResult phục thù và KHÔNG phát mistake_created event', () => {
      // Trước tiên tạo 1 lỗi
      useAppStore.getState().recordQuizMistakeResult('epiphany', false, { source: 'classic_quiz' });
      expect(localOutbox.getPendingCount()).toBe(1);
      localOutbox.clear(); // Dọn dẹp outbox để kiểm tra lần trả lời đúng

      // Trả lời đúng lần 1
      const res1 = useAppStore.getState().recordQuizMistakeResult('epiphany', true, { source: 'classic_quiz' });
      expect(res1.consecutiveCorrect).toBe(1);
      // KHÔNG phát mistake_created
      expect(localOutbox.getTotalCount()).toBe(0);

      // Trả lời đúng lần 2 -> Resolved!
      const res2 = useAppStore.getState().recordQuizMistakeResult('epiphany', true, { source: 'classic_quiz' });
      expect(res2.consecutiveCorrect).toBe(2);
      expect(res2.resolved).toBe(true);
      // Vẫn KHÔNG phát mistake_created
      expect(localOutbox.getTotalCount()).toBe(0);
    });
  });

  // ==========================================================================
  // 3. FLASHCARD REVIEW FAILURE EMISSION
  // ==========================================================================
  describe('3. Flashcard Review Failure Integration', () => {
    it('bấm Again (grade = 0) trong processReview ghi nhận mistake và phát mistake_created event với review idempotency key', () => {
      useAppStore.getState().processReview('vocab_resilient', 0);

      // Local mistake bank có lỗi
      const mistake = useAppStore.getState().mistakeBank['vocab_resilient'];
      expect(mistake).toBeDefined();
      expect(mistake.source).toBe('flashcard');
      expect(mistake.mistakeCount).toBe(1);

      // Outbox có cả 2 event: 1 cho review_card và 1 cho mistake_created
      const entries = localOutbox.getAllEntries();
      const eventTypes = entries.map((e) => e.event.eventType);
      expect(eventTypes).toContain('review_card');
      expect(eventTypes).toContain('mistake_created');

      const mistakeEvent = entries.find((e) => e.event.eventType === 'mistake_created')?.event as MistakeCreatedEvent;
      expect(mistakeEvent.entityId).toBe('vocab_resilient');
      expect(mistakeEvent.payload.source).toBe('flashcard');
      expect(mistakeEvent.idempotencyKey).toMatch(/^idemp_mistake_review_/);
    });
  });

  // ==========================================================================
  // 4. IDEMPOTENCY: REPLAY & RETRY GUARD
  // ==========================================================================
  describe('4. Idempotency: Replay & Retry Guard', () => {
    it('gọi recordMistake 2 lần với cùng idempotencyKey không làm tăng mistakeCount lần 2 và không tạo event thừa', () => {
      const stableKey = 'idemp_mistake_double_call_check';
      const word = { id: 'vocab_resilient', word: 'resilient', meaning: 'kiên cường' };

      // Lần 1
      useAppStore.getState().recordMistake(word, 'flashcard', { idempotencyKey: stableKey });
      expect(useAppStore.getState().mistakeBank['vocab_resilient'].mistakeCount).toBe(1);
      expect(localOutbox.getPendingCount()).toBe(1);

      // Lần 2 (double click / replay / re-render)
      useAppStore.getState().recordMistake(word, 'flashcard', { idempotencyKey: stableKey });
      // mistakeCount VẪN LÀ 1 (không bị tăng lặp)
      expect(useAppStore.getState().mistakeBank['vocab_resilient'].mistakeCount).toBe(1);
      // Local Outbox VẪN CHỈ CÓ 1 event
      expect(localOutbox.getPendingCount()).toBe(1);
    });

    it('gọi emitMistakeCreatedEvent 2 lần với cùng idempotencyKey được outbox deduplicate an toàn', () => {
      const res1 = emitMistakeCreatedEvent({
        mistakeId: 'mistake_direct_dedupe',
        word: 'dedupe',
        source: 'quiz',
        mistakeType: 'meaning',
        idempotencyKey: 'idemp_direct_dedupe_key',
      });
      expect(res1.success).toBe(true);
      expect(res1.enqueued).toBe(true);

      const res2 = emitMistakeCreatedEvent({
        mistakeId: 'mistake_direct_dedupe',
        word: 'dedupe',
        source: 'quiz',
        mistakeType: 'meaning',
        idempotencyKey: 'idemp_direct_dedupe_key',
      });
      expect(res2.success).toBe(true);
      expect(res2.enqueued).toBe(false);
      expect(res2.skipped).toBe(true);

      expect(localOutbox.getTotalCount()).toBe(1);
    });
  });

  // ==========================================================================
  // 5. DISTINCTION: GENUINE SUBSEQUENT MISTAKE IS PRESERVED
  // ==========================================================================
  describe('5. Genuine Subsequent Mistake is Preserved (No Over-Deduplication)', () => {
    it('người học mắc lỗi thật sự ở 2 bài học khác nhau đều được ghi nhận (mistakeCount tăng 2 và 2 event độc lập)', () => {
      const word = { id: 'vocab_resilient', word: 'resilient', meaning: 'kiên cường' };

      // Lần mắc lỗi 1 trong Quiz A
      useAppStore.getState().recordMistake(word, 'classic_quiz', {
        idempotencyKey: 'idemp_quiz_A_resilient',
      });
      expect(useAppStore.getState().mistakeBank['vocab_resilient'].mistakeCount).toBe(1);
      expect(localOutbox.getPendingCount()).toBe(1);

      // Lần mắc lỗi 2 trong Quiz B (hành động người học thực tế khác)
      useAppStore.getState().recordMistake(word, 'dictation', {
        type: 'spelling',
        idempotencyKey: 'idemp_quiz_B_resilient',
      });
      // mistakeCount tăng lên 2 bình thường
      expect(useAppStore.getState().mistakeBank['vocab_resilient'].mistakeCount).toBe(2);
      expect(useAppStore.getState().mistakeBank['vocab_resilient']?.typeCounts?.meaning).toBe(1);
      expect(useAppStore.getState().mistakeBank['vocab_resilient']?.typeCounts?.spelling).toBe(1);

      // Cả 2 event được xếp hàng độc lập trong outbox
      expect(localOutbox.getPendingCount()).toBe(2);
      const entries = localOutbox.getAllEntries().map((e) => (e.event as MistakeCreatedEvent).idempotencyKey);
      expect(entries).toEqual(['idemp_quiz_A_resilient', 'idemp_quiz_B_resilient']);
    });
  });

  // ==========================================================================
  // 6. UNTRUSTED TELEMETRY & AI FALLBACK GUARD
  // ==========================================================================
  describe('6. Untrusted Telemetry & AI Fallback Guard', () => {
    it('telemetry không đáng tin cậy (isTrusted !== true) bị chặn và KHÔNG ghi nhận mistakeBank hay phát event', () => {
      const mockStore = useAppStore.getState();

      const result = ingestTutorFeedback({
        telemetry: {
          isTrusted: false, // Fallback/synthetic mock telemetry
          detectedMistakes: [
            {
              target: 'although',
              type: 'grammar',
              explanation: 'Lỗi mệnh đề đối lập',
              correction: 'although he was tired',
            },
          ],
        } as any,
        userMessage: 'Although he was tired, he kept going.',
        store: mockStore,
      });

      expect(result.ingested).toBe(false);
      expect(result.reason).toBe('untrusted_or_empty_telemetry');
      expect(result.mistakesRecorded).toBe(0);

      // Mistake bank không bị nhiễm dữ liệu giả mạo
      expect(Object.keys(useAppStore.getState().mistakeBank).length).toBe(0);
      // Local outbox không có event
      expect(localOutbox.getTotalCount()).toBe(0);
    });
  });

  // ==========================================================================
  // 7. MULTI-DEVICE CONFLICT RESOLUTION
  // ==========================================================================
  describe('7. Multi-Device Simulation & Idempotent Server Processing', () => {
    it('hai thiết bị cùng nộp event cho cùng một mistake evidence, server trả already_processed cho thiết bị thứ hai', async () => {
      const mistakeId = 'vocab_serendipity';

      // Device A ghi nhận lỗi
      const devAResult = emitMistakeCreatedEvent({
        mistakeId,
        word: 'serendipity',
        source: 'dictation',
        mistakeType: 'spelling',
        idempotencyKey: 'idemp_mistake_shared_session_word',
        userId: testUserId,
      });
      expect(devAResult.enqueued).toBe(true);
      const eventA = devAResult.event!;

      // Device B trên browser khác cũng nhận cùng evidence
      const storageB: Record<string, string> = {};
      const mockStorageB: Storage = {
        getItem: (k: string) => storageB[k] || null,
        setItem: (k: string, v: string) => { storageB[k] = v; },
        removeItem: (k: string) => { delete storageB[k]; },
        clear: () => { Object.keys(storageB).forEach((k) => delete storageB[k]); },
        key: () => null,
        length: 0,
      };
      const outboxB = new LocalOutbox(mockStorageB);
      const devBResult = emitMistakeCreatedEvent(
        {
          mistakeId,
          word: 'serendipity',
          source: 'dictation',
          mistakeType: 'spelling',
          idempotencyKey: 'idemp_mistake_shared_session_word',
          userId: testUserId,
        },
        outboxB
      );
      expect(devBResult.enqueued).toBe(true);
      const eventB = devBResult.event!;

      expect(eventA.idempotencyKey).toBe(eventB.idempotencyKey);

      // Device A gửi trước: Server RPC applied
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          received_count: 1,
          applied_count: 1,
          duplicate_count: 0,
          rejected_count: 0,
          results: [{ event_id: eventA.eventId, status: 'applied', code: 'EVENT_APPLIED' }],
        },
        error: null,
      } as any);

      const flushA = await flushOutboxEventsThroughCoordinator(localOutbox);
      expect(flushA.acknowledgedCount).toBe(1);
      expect(localOutbox.getTotalCount()).toBe(0);

      // Device B gửi sau: Server trả already_processed do idempotency_key đã tồn tại
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          received_count: 1,
          applied_count: 0,
          duplicate_count: 1,
          rejected_count: 0,
          results: [{ event_id: eventB.eventId, status: 'already_processed', code: 'DUPLICATE_EVENT' }],
        },
        error: null,
      } as any);

      const flushB = await flushOutboxEventsThroughCoordinator(outboxB);
      expect(flushB.acknowledgedCount).toBe(1);
      expect(outboxB.getTotalCount()).toBe(0);
    });
  });

  // ==========================================================================
  // 8. RESOLVED MISTAKE NOT RESURRECTED BY STALE CLOUD SNAPSHOT
  // ==========================================================================
  describe('8. Resolved Mistake Protection Against Stale Cloud Resurrection', () => {
    it('lỗi đã resolved cục bộ không bị snapshot cloud cũ hồi sinh thành unresolved', () => {
      const nowIso = new Date().toISOString();
      const earlierIso = new Date(Date.now() - 3600000).toISOString();

      // Thiết lập local: từ "resilient" đã được giải quyết lúc nowIso
      useAppStore.setState({
        mistakeBank: {
          vocab_resilient: {
            id: 'vocab_resilient',
            word: 'resilient',
            meaning: 'kiên cường',
            mistakeCount: 3,
            wrongCount: 3,
            consecutiveCorrect: 2,
            resolved: true,
            resolvedDate: nowIso,
            lastMistakeAt: earlierIso,
            source: 'flashcard',
            primaryType: 'meaning',
            reopenCount: 0,
          } as any,
        },
      });

      // Giả lập Cloud Snapshot cũ trả về bản ghi lỗi từ quá khứ (vẫn chưa resolved)
      useAppStore.getState().mergeCloudData({
        cloudMistakes: [
          {
            id: 'vocab_resilient',
            word: 'resilient',
            meaning: 'kiên cường',
            mistakeCount: 2,
            wrongCount: 2,
            consecutiveCorrect: 0,
            resolved: false, // Stale state
            lastMistakeAt: earlierIso,
            reopenCount: 0,
          },
        ],
      });

      // Invariant: Lỗi vẫn giữ trạng thái resolved: true (không bị stale cloud resurrection)
      const current = useAppStore.getState().mistakeBank['vocab_resilient'];
      expect(current.resolved).toBe(true);
      expect(current.resolvedDate).toBe(nowIso);
    });
  });

  // ==========================================================================
  // 9. PERSISTENCE ACROSS RELOAD
  // ==========================================================================
  describe('9. Persistence Across Reload / Browser Restart', () => {
    it('processedMistakeKeys được duy trì để chặn double submit sau reload', () => {
      const idempKey = 'idemp_mistake_reload_test';
      const word = { id: 'vocab_resilient', word: 'resilient', meaning: 'kiên cường' };

      // Ghi nhận lỗi với key
      useAppStore.getState().recordMistake(word, 'flashcard', { idempotencyKey: idempKey });
      expect(useAppStore.getState().processedMistakeKeys).toContain(idempKey);

      // Giả lập browser reload / restore state
      const restoredKeys = [...(useAppStore.getState().processedMistakeKeys || [])];
      useAppStore.setState({ processedMistakeKeys: restoredKeys });

      // Gọi lại với cùng key sau reload
      useAppStore.getState().recordMistake(word, 'flashcard', { idempotencyKey: idempKey });
      // mistakeCount vẫn giữ nguyên là 1
      expect(useAppStore.getState().mistakeBank['vocab_resilient'].mistakeCount).toBe(1);
    });

    it('event mistake_created chưa ACK được bảo toàn trong LocalOutbox qua browser restart', () => {
      useAppStore.getState().recordMistake(
        { id: 'vocab_resilient', word: 'resilient', meaning: 'kiên cường' },
        'speed_match'
      );
      expect(localOutbox.getPendingCount()).toBe(1);

      const originalEvent = localOutbox.getAllEntries()[0].event;

      // Khởi tạo new LocalOutbox đọc từ storage
      const reloadedOutbox = new LocalOutbox(window.localStorage);
      expect(reloadedOutbox.getPendingCount()).toBe(1);

      const reloadedEntry = reloadedOutbox.getAllEntries()[0];
      expect(reloadedEntry.event.eventId).toBe(originalEvent.eventId);
      expect(reloadedEntry.event.payload).toEqual(originalEvent.payload);
      expect(reloadedEntry.status).toBe('pending');
    });
  });

  // ==========================================================================
  // 10. FEATURE FLAG DISABLED FALLBACK
  // ==========================================================================
  describe('10. Feature Flag Disabled Fallback', () => {
    it('khi mistakeCreated = false, mistakeBank vẫn hoạt động local bình thường nhưng không phát event vào outbox', () => {
      setEventSyncConfig({
        migratedDomains: {
          flashcardReview: true,
          learnWord: true,
          completeQuiz: true,
          mistakeCreated: false, // OFF
        },
      });

      useAppStore.getState().recordMistake(
        { id: 'vocab_resilient', word: 'resilient', meaning: 'kiên cường' },
        'flashcard'
      );

      // Local mistakeBank vẫn cập nhật
      expect(useAppStore.getState().mistakeBank['vocab_resilient']).toBeDefined();
      expect(useAppStore.getState().mistakeBank['vocab_resilient'].mistakeCount).toBe(1);

      // KHÔNG có event nào trong Outbox
      expect(localOutbox.getTotalCount()).toBe(0);
    });
  });
});
