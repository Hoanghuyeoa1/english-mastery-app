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
  pushLocalToCloud,
} from '../cloudSyncService';
import { emitReviewCardEvent } from '../reviewCardEventService';
import { supabase } from '../../lib/supabaseClient';
import { cloudSyncApi } from '../api/cloudSyncApi';
import type { ReviewCardEvent } from '../../types/learningEvents';


describe('PHASE 5 — Domain Migration: review_card Event Emission & Sync Suite', () => {
  const testUserId = 'user_phase5_reviewer_uuid';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    clearSyncCoordinatorForTesting();
    localOutbox.clear();
    resetEventSyncConfigForTesting();

    // Enable Event Sync for flashcardReview in Phase 5
    setEventSyncConfig({
      enabled: true,
      batchSize: 50,
      maxConsecutiveBatches: 3,
      migratedDomains: {
        flashcardReview: true,
        learnWord: false,
        completeQuiz: false,
        mistakeCreated: false,
      },
    });

    // Cloud Sync Store
    useCloudSyncStore.setState({
      status: 'idle',
      lastSyncedAt: null,
      errorMessage: null,
      user: { id: testUserId, email: 'reviewer@example.com' } as any,
      userId: testUserId,
      userEmail: 'reviewer@example.com',
      isOnline: true,
    });

    // App Store with test vocabulary
    useAppStore.getState().resetToDefault();
    useAppStore.setState({
      srsAlgorithm: 'sm2',
      vocabularyList: [
        {
          id: 'card_resilient',
          word: 'resilient',
          meaning: 'kiên cường, bền bỉ',
          example: 'She is a resilient person.',
          ipa: '/rɪˈzɪliənt/',
          partOfSpeech: 'adj',
          tag: 'daily',
          srsLevel: 0,
          interval: 0,
          easeFactor: 2.5,
          nextReviewDate: new Date().toISOString(),
        } as any,
        {
          id: 'card_serendipity',
          word: 'serendipity',
          meaning: 'sự may mắn tình cờ',
          example: 'A pure serendipity.',
          ipa: '/ˌserənˈdɪpəti/',
          partOfSpeech: 'noun',
          tag: 'daily',
          srsLevel: 1,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: new Date().toISOString(),
        } as any,
      ],
      srsProgressMap: {
        card_serendipity: {
          srsLevel: 1,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: new Date().toISOString(),
          lastReviewedDate: '2026-10-01T00:00:00.000Z',
        },
      },
      profile: {
        ...useAppStore.getState().profile,
        xp: 100,
        level: 1,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearSyncCoordinatorForTesting();
    localOutbox.clear();
  });

  // ==========================================================================
  // 1. ONE VALID REVIEW -> EXACTLY ONE DOMAIN EVENT
  // ==========================================================================
  describe('1. One Valid Review -> Exactly One Event Emission', () => {
    it('thực hiện 1 lượt review hợp lệ tạo đúng 1 review_card event trong local outbox với đầy đủ metadata tối thiểu', () => {
      expect(localOutbox.getPendingCount()).toBe(0);

      // Học viên đánh giá thẻ 'resilient' mức Good (grade 2)
      useAppStore.getState().processReview('card_resilient', 2);

      // Local state đã commit
      const state = useAppStore.getState();
      const updatedProg = state.srsProgressMap['card_resilient'];
      expect(updatedProg).toBeDefined();
      expect(updatedProg.srsLevel).toBeGreaterThan(0);

      // Local Outbox nhận đúng 1 event
      expect(localOutbox.getPendingCount()).toBe(1);
      const entries = localOutbox.getAllEntries();
      expect(entries.length).toBe(1);

      const domainEvent = entries[0].event as ReviewCardEvent;
      expect(domainEvent.eventType).toBe('review_card');
      expect(domainEvent.entityType).toBe('card');
      expect(domainEvent.entityId).toBe('card_resilient');
      expect(domainEvent.schemaVersion).toBe(1);
      expect(domainEvent.deviceId).toBeDefined();
      expect(domainEvent.idempotencyKey).toBeDefined();

      // Payload metadata tối thiểu
      expect(domainEvent.payload.cardId).toBe('card_resilient');
      expect(domainEvent.payload.wordText).toBe('resilient');
      expect(domainEvent.payload.grade).toBe(2);
      expect(domainEvent.payload.rating).toBe('good');
      expect(domainEvent.payload.algorithm).toBe('sm2');
      expect(domainEvent.payload.intervalBefore).toBe(0);
      expect(domainEvent.payload.intervalAfter).toBeGreaterThan(0);
      expect(domainEvent.payload.repetitionBefore).toBe(0);
      expect(domainEvent.payload.repetitionAfter).toBe(1);
    });

    it('không serialize toàn bộ store / card deck vào payload event', () => {
      useAppStore.getState().processReview('card_resilient', 3);

      const entries = localOutbox.getAllEntries();
      const event = entries[0].event;
      const rawPayload = JSON.stringify(event.payload);

      // Kích thước payload cực kỳ gọn gàng (< 1 KB)
      expect(rawPayload.length).toBeLessThan(1024);
      // Không chứa profile, danh sách từ vựng khác hay API key
      expect(rawPayload).not.toContain('geminiApiKey');
      expect(rawPayload).not.toContain('card_serendipity');
      expect(rawPayload).not.toContain('dailyHistory');
    });

    it('từ vựng không tồn tại trong từ điển không tạo event rác (guard check)', () => {
      useAppStore.getState().processReview('non_existent_card_id', 2);

      // Không commit local, không enqueue event
      expect(localOutbox.getPendingCount()).toBe(0);
    });
  });

  // ==========================================================================
  // 2. IDEMPOTENCY & DOUBLE-CLICK PROTECTION
  // ==========================================================================
  describe('2. Idempotency & Deduplication Guard', () => {
    it('gọi emitReviewCardEvent 2 lần với cùng một review idempotencyKey chỉ giữ đúng 1 event trong outbox', () => {
      const stableReviewKey = 'rev_stable_uuid_123';

      const res1 = emitReviewCardEvent({
        cardId: 'card_resilient',
        wordText: 'resilient',
        grade: 2,
        rating: 'good',
        algorithm: 'sm2',
        intervalBefore: 0,
        intervalAfter: 1,
        repetitionBefore: 0,
        repetitionAfter: 1,
        easeFactorBefore: 2.5,
        easeFactorAfter: 2.5,
        idempotencyKey: stableReviewKey,
      });

      const res2 = emitReviewCardEvent({
        cardId: 'card_resilient',
        wordText: 'resilient',
        grade: 2,
        rating: 'good',
        algorithm: 'sm2',
        intervalBefore: 0,
        intervalAfter: 1,
        repetitionBefore: 0,
        repetitionAfter: 1,
        easeFactorBefore: 2.5,
        easeFactorAfter: 2.5,
        idempotencyKey: stableReviewKey,
      });

      expect(res1.enqueued).toBe(true);
      expect(res2.enqueued).toBe(false); // Second click deduplicated!
      expect(res2.skipped).toBe(true);
      expect(localOutbox.getPendingCount()).toBe(1);
    });
  });

  // ==========================================================================
  // 3. SERVER RETRY / REPLAY IDEMPOTENCY
  // ==========================================================================
  describe('3. Cloud Ingestion & Idempotent Replay Handling', () => {
    it('gửi event lên Cloud thành công, retry cùng event nhận already_processed và không duplicate', async () => {
      // Review card và enqueue event
      useAppStore.getState().processReview('card_resilient', 3);
      expect(localOutbox.getPendingCount()).toBe(1);

      const serverDatabaseEvents = new Set<string>();

      // Mock server RPC phản ánh đúng logic setup_event_sync.sql
      (vi.spyOn(supabase, 'rpc') as any).mockImplementation(async (_fn: string, args: any) => {
        const events = args.p_events || [];
        const results = events.map((e: any) => {
          const key = e.idempotency_key || e.idempotencyKey;
          if (serverDatabaseEvents.has(key)) {
            return { event_id: e.event_id || e.eventId, status: 'already_processed', code: 'DUPLICATE_EVENT' };
          }
          serverDatabaseEvents.add(key);
          return { event_id: e.event_id || e.eventId, status: 'applied', code: 'EVENT_APPLIED' };
        });
        return {
          data: { success: true, results, server_now: new Date().toISOString() },
          error: null,
        };
      });

      // Lấy chính xác idempotencyKey của event được sinh ra
      const originalEntries = localOutbox.getAllEntries();
      const actualIdempKey = originalEntries[0].event.idempotencyKey;

      // Lần flush 1: event được gửi và server ghi nhận applied
      const flushResult1 = await flushOutboxEventsThroughCoordinator();
      expect(flushResult1.acknowledgedCount).toBe(1);
      expect(localOutbox.getPendingCount()).toBe(0);

      // Nếu client gửi lại event cũ (idempotency key trùng lặp)
      const res = await (supabase.rpc as any)('ingest_learning_events', {
        p_events: [{ event_id: 'replayed_id', idempotency_key: actualIdempKey, event_type: 'review_card' }],
      });
      // Server trả về already_processed
      expect(res.data.results[0].status).toBe('already_processed');
    });
  });

  // ==========================================================================
  // 4. PERSISTENCE ACROSS RELOAD
  // ==========================================================================
  describe('4. Persistence Across Reload / Restart', () => {
    it('event review_card chưa được sync lên cloud được bảo toàn nguyên vẹn qua reload', () => {
      useAppStore.getState().processReview('card_resilient', 2);
      expect(localOutbox.getPendingCount()).toBe(1);

      const originalEntries = localOutbox.getAllEntries();
      const originalEvent = originalEntries[0].event;

      // Giả lập đóng tab / reload trình duyệt: khởi tạo new LocalOutbox đọc từ storage
      const reloadedOutbox = new LocalOutbox(window.localStorage);

      expect(reloadedOutbox.getPendingCount()).toBe(1);
      const reloadedEntry = reloadedOutbox.getAllEntries()[0];
      expect(reloadedEntry.event.eventId).toBe(originalEvent.eventId);
      expect(reloadedEntry.event.payload).toEqual(originalEvent.payload);
      expect(reloadedEntry.status).toBe('pending');
    });
  });

  // ==========================================================================
  // 5. RESUME SESSION DOES NOT RESURRECT DOUBLE REVIEWS
  // ==========================================================================
  describe('5. Resume Session Safeguard', () => {
    it('tiếp tục phiên học đã tạm dừng chỉ review các thẻ còn lại, không duplicate review cho thẻ đã xong', () => {
      // Ôn thẻ 1 trong phiên học
      useAppStore.getState().processReview('card_resilient', 2);
      expect(localOutbox.getPendingCount()).toBe(1);

      // Checkpoint phiên học đã hoàn thành 'card_resilient'
      const reviewedCardIds = ['card_resilient'];
      const sessionCardIds = ['card_resilient', 'card_serendipity'];

      // Thuật toán Resume lọc thẻ đã hoàn thành (như trong FlashcardDeck.tsx)
      const remainingIds = sessionCardIds.filter((id) => !reviewedCardIds.includes(id));
      expect(remainingIds).toEqual(['card_serendipity']);

      // Khi người dùng tiếp tục phiên, chỉ ôn tiếp 'card_serendipity'
      useAppStore.getState().processReview('card_serendipity', 2);

      // Tổng số event trong outbox đúng bằng 2 (1 cho card_resilient, 1 cho card_serendipity)
      expect(localOutbox.getPendingCount()).toBe(2);
      const outboxCards = localOutbox.getAllEntries().map((e) => (e.event as ReviewCardEvent).payload.cardId);
      expect(outboxCards).toEqual(['card_resilient', 'card_serendipity']);
    });
  });

  // ==========================================================================
  // 6. FSRS ALGORITHM SEMANTICS UNCHANGED
  // ==========================================================================
  describe('6. FSRS Scheduler Semantics Unchanged', () => {
    it('khi bật thuật toán FSRS: calculation tính toán chính xác stability, difficulty mà không bị event layer can thiệp', () => {
      useAppStore.setState({ srsAlgorithm: 'fsrs' });

      // Review FSRS grade Good (2)
      useAppStore.getState().processReview('card_resilient', 2);

      const prog = useAppStore.getState().srsProgressMap['card_resilient'];
      expect(prog.fsrs).toBeDefined();
      expect(prog.fsrs!.stability).toBeGreaterThan(0);
      expect(prog.fsrs!.difficulty).toBeGreaterThan(0);

      // Event capture phản ánh chính xác trạng thái FSRS đó
      const entry = localOutbox.getAllEntries()[0];
      const payload = (entry.event as ReviewCardEvent).payload;
      expect(payload.algorithm).toBe('fsrs');
      expect(payload.stability).toBe(prog.fsrs!.stability);
      expect(payload.difficulty).toBe(prog.fsrs!.difficulty);
      expect(payload.retrievability).toBeDefined();
    });
  });

  // ==========================================================================
  // 7. SM-2 ALGORITHM SEMANTICS UNCHANGED
  // ==========================================================================
  describe('7. SM-2 Scheduler Semantics Unchanged', () => {
    it('khi dùng SM-2: interval và ease factor tuân thủ nguyên vẹn quy tắc SuperMemo-2', () => {
      useAppStore.setState({ srsAlgorithm: 'sm2' });

      // Review Easy (grade 3): interval=1 ngày, EF tăng từ 2.5 -> 2.6
      useAppStore.getState().processReview('card_resilient', 3);

      const prog = useAppStore.getState().srsProgressMap['card_resilient'];
      expect(prog.srsLevel).toBe(1);
      expect(prog.interval).toBe(1);
      expect(prog.easeFactor).toBeGreaterThan(2.5);

      const payload = (localOutbox.getAllEntries()[0].event as ReviewCardEvent).payload;
      expect(payload.algorithm).toBe('sm2');
      expect(payload.intervalAfter).toBe(1);
      expect(payload.easeFactorAfter).toBe(prog.easeFactor);
    });
  });

  // ==========================================================================
  // 8. FEATURE GATE ROLLBACK & SNAPSHOT SYNC FALLBACK
  // ==========================================================================
  describe('8. Feature Gate Boundary & Snapshot Sync Fallback', () => {
    it('khi tắt domain flashcardReview (rollback): không phát event vào outbox, snapshot sync vẫn chạy bình thường', async () => {
      setEventSyncConfig({
        migratedDomains: {
          flashcardReview: false, // Disabled
        },
      });

      // Review card khi feature gate tắt
      useAppStore.getState().processReview('card_resilient', 2);

      // Local state vẫn cập nhật bình thường
      const prog = useAppStore.getState().srsProgressMap['card_resilient'];
      expect(prog).toBeDefined();
      expect(prog.srsLevel).toBe(1);

      // Không có event nào phát vào outbox
      expect(localOutbox.getPendingCount()).toBe(0);

      // Snapshot sync (pushLocalToCloud) vẫn đẩy dữ liệu bình thường qua cloudSyncApi
      let snapshotPushed = false;
      vi.spyOn(cloudSyncApi, 'uploadSync').mockImplementation(async () => {
        snapshotPushed = true;
        return { success: true, syncedAt: new Date().toISOString(), srsItemsUpserted: 1, dailyLogsUpserted: 0 };
      });

      await pushLocalToCloud(testUserId);
      expect(snapshotPushed).toBe(true);
    });
  });


  // ==========================================================================
  // 9. XP / LEADERBOARD INVARIANT
  // ==========================================================================
  describe('9. XP & Leaderboard Rules Invariant', () => {
    it('review event không tự ý gán hay thay đổi điểm thưởng XP ngoài quy tắc của app', () => {
      const initialXP = useAppStore.getState().profile.xp;

      // Grade 2 (Good) -> chuẩn app thưởng 10 XP
      useAppStore.getState().processReview('card_resilient', 2);

      const finalXP = useAppStore.getState().profile.xp;
      expect(finalXP).toBe(initialXP + 10);

      // Payload event chỉ chứa bằng chứng học tập (evidence), không có quyền tự quyết định cấp độ hay rank
      const payload = (localOutbox.getAllEntries()[0].event as ReviewCardEvent).payload as any;
      expect(payload.xpEarned).toBeUndefined();
      expect(payload.rank).toBeUndefined();
    });
  });
});
