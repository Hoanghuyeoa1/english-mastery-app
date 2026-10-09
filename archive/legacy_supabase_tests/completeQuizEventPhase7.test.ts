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
import { emitCompleteQuizEvent } from '../completeQuizEventService';
import { generateIdempotencyKey } from '../eventIdentityService';
import { supabase } from '../../lib/supabaseClient';
import type { CompleteQuizEvent } from '../../types/learningEvents';

describe('PHASE 7 — Domain Migration: complete_quiz Event Emission & Idempotency Suite', () => {
  const testUserId = 'user_phase7_quizzer_uuid';
  const today = new Date().toISOString().split('T')[0];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    clearSyncCoordinatorForTesting();
    localOutbox.clear();
    resetEventSyncConfigForTesting();

    // Enable completeQuiz domain in Event Sync
    setEventSyncConfig({
      enabled: true,
      batchSize: 50,
      maxConsecutiveBatches: 3,
      migratedDomains: {
        flashcardReview: true,
        learnWord: true,
        completeQuiz: true,
        mistakeCreated: false,
      },
    });

    // Setup Cloud Sync Store
    useCloudSyncStore.setState({
      status: 'idle',
      lastSyncedAt: null,
      errorMessage: null,
      user: { id: testUserId, email: 'quizzer@example.com' } as any,
      userId: testUserId,
      userEmail: 'quizzer@example.com',
      isOnline: true,
    });

    // Reset App Store
    useAppStore.getState().resetToDefault();
    useAppStore.setState({
      completedQuizSessionIds: [],
      processedXpKeys: [],
      profile: {
        ...useAppStore.getState().profile,
        xp: 100,
        level: 1,
      },
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
    });
  });

  afterEach(() => {
    localOutbox.clear();
    resetEventSyncConfigForTesting();
    clearSyncCoordinatorForTesting();
  });

  // ==========================================================================
  // 1. LOCAL-FIRST EMISSION: recordQuizCompleted
  // ==========================================================================
  describe('1. Local-First recordQuizCompleted Event Emission', () => {
    it('hoàn thành quiz commit local trước và phát đúng 1 complete_quiz event vào Local Outbox', () => {
      expect(localOutbox.getTotalCount()).toBe(0);

      const quizId = 'quiz_session_vocab_101';
      const result = useAppStore.getState().recordQuizCompleted(20, true, {
        quizId,
        quizType: 'comprehension',
        totalQuestions: 5,
        correctCount: 5,
        score: 100,
        mistakeCount: 0,
        durationSeconds: 45,
      });

      // 1. Kiểm tra local state đã commit
      expect(result).toBeDefined();
      expect((result as any).alreadyCompleted).toBeFalsy();
      const state = useAppStore.getState();
      expect(state.completedQuizSessionIds).toContain(quizId);
      expect(state.dailyHistory[today]?.quizzesCompleted).toBe(1);

      // 2. Kiểm tra Local Outbox chứa đúng 1 event
      expect(localOutbox.getPendingCount()).toBe(1);
      const entries = localOutbox.getAllEntries();
      expect(entries.length).toBe(1);

      const event = entries[0].event as CompleteQuizEvent;
      expect(event.eventType).toBe('complete_quiz');
      expect(event.entityType).toBe('quiz');
      expect(event.entityId).toBe(quizId);
      expect(event.schemaVersion).toBe(1);
      expect(event.deviceId).toBeDefined();
      expect(event.idempotencyKey).toBe(`idemp_complete_quiz_${quizId}_completion`);

      // Payload metadata
      expect(event.payload.quizId).toBe(quizId);
      expect(event.payload.quizType).toBe('comprehension');
      expect(event.payload.totalQuestions).toBe(5);
      expect(event.payload.correctCount).toBe(5);
      expect(event.payload.score).toBe(100);
      expect(event.payload.mistakeCount).toBe(0);
      expect(event.payload.durationSeconds).toBe(45);
      expect(event.payload.xpEarned).toBe(20);
    });

    it('không serialize toàn bộ store / profile vào event payload (< 1 KB)', () => {
      useAppStore.getState().recordQuizCompleted(15, false, {
        quizId: 'quiz_mini_payload',
        quizType: 'word_match',
        totalQuestions: 10,
        correctCount: 8,
        score: 80,
      });

      const entries = localOutbox.getAllEntries();
      const rawPayload = JSON.stringify(entries[0].event.payload);

      expect(rawPayload.length).toBeLessThan(1024);
      expect(rawPayload).not.toContain('geminiApiKey');
      expect(rawPayload).not.toContain('vocabularyList');
      expect(rawPayload).not.toContain('dailyHistory');
    });

    it('tự sinh quizId an toàn nếu options không cung cấp quizId', () => {
      useAppStore.getState().recordQuizCompleted(10, true);

      expect(localOutbox.getPendingCount()).toBe(1);
      const event = localOutbox.getAllEntries()[0].event as CompleteQuizEvent;
      expect(event.entityId).toMatch(/^quiz_/);
      expect(event.payload.quizId).toMatch(/^quiz_/);
      expect(useAppStore.getState().completedQuizSessionIds?.length).toBe(1);
    });
  });

  // ==========================================================================
  // 2. IDEMPOTENCY & DOUBLE SUBMIT PREVENTION (Max 1 Completion)
  // ==========================================================================
  describe('2. Idempotency & Double Submit Prevention (Max 1 Completion)', () => {
    it('gọi recordQuizCompleted 2 lần với cùng quizId thì lần 2 bị chặn và không tạo event thứ 2', () => {
      const stableQuizId = 'quiz_duplicate_test_999';

      // Submit lần 1
      const res1 = useAppStore.getState().recordQuizCompleted(25, true, {
        quizId: stableQuizId,
        quizType: 'dictation',
        totalQuestions: 4,
        correctCount: 4,
        score: 100,
      });
      expect((res1 as any).alreadyCompleted).toBeFalsy();
      expect(useAppStore.getState().dailyHistory[today]?.quizzesCompleted).toBe(1);
      expect(localOutbox.getPendingCount()).toBe(1);

      // Submit lần 2 (double click / replay / re-entry)
      const res2 = useAppStore.getState().recordQuizCompleted(25, true, {
        quizId: stableQuizId,
        quizType: 'dictation',
        totalQuestions: 4,
        correctCount: 4,
        score: 100,
      });
      expect((res2 as any).alreadyCompleted).toBe(true);
      expect((res2 as any).xpGranted).toBe(0);

      // Quizzes completed KHÔNG tăng lần 2
      expect(useAppStore.getState().dailyHistory[today]?.quizzesCompleted).toBe(1);
      // Local Outbox KHÔNG có event thứ 2
      expect(localOutbox.getPendingCount()).toBe(1);
    });

    it('gọi emitCompleteQuizEvent 2 lần với cùng quizId/idempotencyKey được outbox deduplicate an toàn', () => {
      const quizId = 'quiz_idemp_direct_check';

      const res1 = emitCompleteQuizEvent({
        quizId,
        quizType: 'standard',
        totalQuestions: 5,
        correctCount: 5,
        score: 100,
      });
      expect(res1.success).toBe(true);
      expect(res1.enqueued).toBe(true);

      const res2 = emitCompleteQuizEvent({
        quizId,
        quizType: 'standard',
        totalQuestions: 5,
        correctCount: 5,
        score: 100,
      });
      expect(res2.success).toBe(true);
      expect(res2.enqueued).toBe(false);
      expect(res2.skipped).toBe(true);

      expect(localOutbox.getTotalCount()).toBe(1);
    });
  });

  // ==========================================================================
  // 3. MAX 1 XP AWARD & ANTI-CHEAT INVARIANT
  // ==========================================================================
  describe('3. Max 1 XP Award & Anti-Cheat Invariant', () => {
    it('XP chỉ được cấp đúng một lần và replay không cộng dồn XP', () => {
      const initialXP = useAppStore.getState().profile.xp;
      const quizId = 'quiz_xp_farming_check';

      // Hoàn thành quiz nhận 30 XP
      useAppStore.getState().recordQuizCompleted(30, true, {
        quizId,
        quizType: 'word_match',
        totalQuestions: 6,
        correctCount: 6,
        score: 100,
      });

      const xpAfterFirst = useAppStore.getState().profile.xp;
      expect(xpAfterFirst).toBe(initialXP + 30);
      expect(useAppStore.getState().processedXpKeys).toContain(`xp_quiz_${quizId}`);

      // Cố tình gọi lại recordQuizCompleted với cùng quizId và 30 XP
      const replayRes = useAppStore.getState().recordQuizCompleted(30, true, {
        quizId,
        quizType: 'word_match',
        totalQuestions: 6,
        correctCount: 6,
        score: 100,
      });

      expect((replayRes as any).alreadyCompleted).toBe(true);
      expect((replayRes as any).xpGranted).toBe(0);
      // XP vẫn giữ nguyên, không bị farm
      expect(useAppStore.getState().profile.xp).toBe(xpAfterFirst);
    });

    it('event payload tự động giới hạn trần XP hợp lý (capped at 200 XP)', () => {
      const res = emitCompleteQuizEvent({
        quizId: 'quiz_oversized_xp',
        quizType: 'standard',
        totalQuestions: 5,
        correctCount: 5,
        score: 100,
        xpEarned: 99999, // Malicious or bogus client XP
      });

      expect(res.success).toBe(true);
      expect((res.event as CompleteQuizEvent).payload.xpEarned).toBe(200);
    });
  });

  // ==========================================================================
  // 4. MULTI-DEVICE SIMULATION & SERVER ACK
  // ==========================================================================
  describe('4. Multi-Device Simulation & Idempotent Server Processing', () => {
    it('hai thiết bị cùng nộp event cho cùng một quiz completion, server trả already_processed cho thiết bị sau', async () => {
      const quizId = 'quiz_multi_device_shared_session';

      // Device A hoàn thành quiz
      const devAResult = emitCompleteQuizEvent({
        quizId,
        quizType: 'comprehension',
        totalQuestions: 5,
        correctCount: 5,
        score: 100,
        userId: testUserId,
      });
      expect(devAResult.enqueued).toBe(true);
      const eventA = devAResult.event!;

      // Device B trên browser khác cũng hoàn thành cùng session quizId đó
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
      const devBResult = emitCompleteQuizEvent(
        {
          quizId,
          quizType: 'comprehension',
          totalQuestions: 5,
          correctCount: 5,
          score: 100,
          userId: testUserId,
        },
        outboxB
      );
      expect(devBResult.enqueued).toBe(true);
      const eventB = devBResult.event!;

      // Cả 2 thiết bị sinh cùng một idempotency key cho cùng completion
      expect(eventA.idempotencyKey).toBe(eventB.idempotencyKey);
      expect(eventA.idempotencyKey).toBe(generateIdempotencyKey('complete_quiz', quizId, 'completion'));

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

      // Device B gửi sau: Server nhận diện idempotency_key đã tồn tại -> already_processed
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
      // already_processed được tính là ACK thành công mà không báo lỗi
      expect(flushB.acknowledgedCount).toBe(1);
      expect(outboxB.getTotalCount()).toBe(0);
    });
  });

  // ==========================================================================
  // 5. PERSISTENCE ACROSS RELOAD
  // ==========================================================================
  describe('5. Persistence Across Reload / Browser Restart', () => {
    it('completedQuizSessionIds được duy trì để chặn double submit sau reload', () => {
      const quizId = 'quiz_reload_persisted';

      // 1. Hoàn thành quiz và đưa quizId vào completedQuizSessionIds
      useAppStore.getState().recordQuizCompleted(10, true, { quizId });
      expect(useAppStore.getState().completedQuizSessionIds).toContain(quizId);

      // 2. Giả lập khởi động lại với state đã khôi phục từ persist
      const restoredSessionIds = [...(useAppStore.getState().completedQuizSessionIds || [])];
      useAppStore.setState({ completedQuizSessionIds: restoredSessionIds });

      // 3. Thử hoàn thành lại quiz cũ sau khi reload
      const resAfterReload = useAppStore.getState().recordQuizCompleted(10, true, { quizId });
      expect((resAfterReload as any).alreadyCompleted).toBe(true);
      expect((resAfterReload as any).xpGranted).toBe(0);
    });

    it('event complete_quiz chưa ACK được bảo toàn trong LocalOutbox qua browser restart', () => {
      useAppStore.getState().recordQuizCompleted(20, false, {
        quizId: 'quiz_offline_stored',
        quizType: 'word_scramble',
        totalQuestions: 5,
        correctCount: 4,
        score: 80,
      });
      expect(localOutbox.getPendingCount()).toBe(1);

      const originalEntries = localOutbox.getAllEntries();
      const originalEvent = originalEntries[0].event;

      // Khởi tạo new LocalOutbox đọc từ storage hiện tại
      const reloadedOutbox = new LocalOutbox(window.localStorage);
      expect(reloadedOutbox.getPendingCount()).toBe(1);

      const reloadedEntry = reloadedOutbox.getAllEntries()[0];
      expect(reloadedEntry.event.eventId).toBe(originalEvent.eventId);
      expect(reloadedEntry.event.payload).toEqual(originalEvent.payload);
      expect(reloadedEntry.status).toBe('pending');
    });
  });

  // ==========================================================================
  // 6. SNAPSHOT + EVENT RECONCILIATION & SAFETY NET
  // ==========================================================================
  describe('6. Hybrid Snapshot Reconciliation', () => {
    it('mergeCloudData dùng Math.max để không nhân đôi số quizzes completed khi cả snapshot và event cùng tồn tại', () => {
      // Local hiện có 2 bài quiz hoàn thành hôm nay
      useAppStore.setState({
        dailyHistory: {
          [today]: {
            date: today,
            wordsReviewed: 0,
            newWordsLearned: 0,
            quizzesCompleted: 2,
            pronunciationsMastered: 0,
            xpGained: 40,
          },
        },
      });

      // Cloud snapshot trả về 3 bài quiz hoàn thành
      useAppStore.getState().mergeCloudData({
        dailyLog: {
          quizzes_completed: 3,
          words_learned: 5,
          xp_gained: 60,
        },
      });

      // Kết quả phải là Math.max(2, 3) = 3 (không phải 2 + 3 = 5)
      expect(useAppStore.getState().dailyHistory[today]?.quizzesCompleted).toBe(3);

      // Nếu snapshot trả về số nhỏ hơn local (ví dụ snapshot cũ là 1)
      useAppStore.getState().mergeCloudData({
        dailyLog: {
          quizzes_completed: 1,
        },
      });

      // Local vẫn giữ giá trị cao hơn là 3
      expect(useAppStore.getState().dailyHistory[today]?.quizzesCompleted).toBe(3);
    });
  });

  // ==========================================================================
  // 7. FEATURE FLAG DISABLED FALLBACK
  // ==========================================================================
  describe('7. Feature Flag Disabled Fallback', () => {
    it('khi completeQuiz = false, quiz vẫn hoàn thành local nhưng không phát event vào outbox', () => {
      setEventSyncConfig({
        migratedDomains: {
          flashcardReview: true,
          learnWord: true,
          completeQuiz: false, // OFF
          mistakeCreated: false,
        },
      });

      useAppStore.getState().recordQuizCompleted(20, true, {
        quizId: 'quiz_flag_disabled',
      });

      // Local state vẫn được ghi nhận đầy đủ
      expect(useAppStore.getState().completedQuizSessionIds).toContain('quiz_flag_disabled');
      expect(useAppStore.getState().dailyHistory[today]?.quizzesCompleted).toBe(1);

      // KHÔNG có event nào được enqueue vào Outbox
      expect(localOutbox.getTotalCount()).toBe(0);
    });
  });
});
