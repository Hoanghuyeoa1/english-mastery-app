// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import { localOutbox, LocalOutbox, OUTBOX_STORAGE_KEY } from '../localOutboxService';
import {
  setEventSyncConfig,
  resetEventSyncConfigForTesting,
  useCloudSyncStore,
  clearSyncCoordinatorForTesting,
  flushOutboxEventsThroughCoordinator,
  pushLocalToCloud,
} from '../cloudSyncService';
import { emitLearnWordEvent } from '../learnWordEventService';
import { resolveCanonicalVocab } from '../wordLookupService';
import { generateIdempotencyKey } from '../eventIdentityService';
import { supabase } from '../../lib/supabaseClient';
import { cloudSyncApi } from '../api/cloudSyncApi';
import type { LearnWordEvent } from '../../types/learningEvents';


describe('PHASE 6 — Domain Migration: learn_word Event Emission & Sync Suite', () => {
  const testUserId = 'user_phase6_learner_uuid';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    clearSyncCoordinatorForTesting();
    localOutbox.clear();
    resetEventSyncConfigForTesting();

    // Enable Event Sync for both flashcardReview and learnWord in Phase 6
    setEventSyncConfig({
      enabled: true,
      batchSize: 50,
      maxConsecutiveBatches: 3,
      migratedDomains: {
        flashcardReview: true,
        learnWord: true,
        completeQuiz: false,
        mistakeCreated: false,
      },
    });

    // Cloud Sync Store setup
    useCloudSyncStore.setState({
      status: 'idle',
      lastSyncedAt: null,
      errorMessage: null,
      user: { id: testUserId, email: 'learner@example.com' } as any,
      userId: testUserId,
      userEmail: 'learner@example.com',
      isOnline: true,
    });

    // App Store reset to default
    useAppStore.getState().resetToDefault();
    useAppStore.setState({
      srsAlgorithm: 'sm2',
      vocabularyList: [],
      srsProgressMap: {},
      userCustomWords: [],
      profile: {
        ...useAppStore.getState().profile,
        xp: 50,
        level: 1,
      },
    });
  });

  afterEach(() => {
    localOutbox.clear();
    resetEventSyncConfigForTesting();
    clearSyncCoordinatorForTesting();
  });

  // ==========================================================================
  // 1. LOCAL-FIRST EMISSION: saveToSRS
  // ==========================================================================
  describe('1. Local-First saveToSRS Event Emission', () => {
    it('thêm từ mới qua saveToSRS commit local trước và phát đúng 1 learn_word event', () => {
      expect(localOutbox.getTotalCount()).toBe(0);

      // User lưu từ "meticulous" từ từ điển
      useAppStore.getState().saveToSRS('meticulous', {
        meaning: 'Tỉ mỉ, cẩn thận',
        contextSentence: 'She was meticulous about keeping records.',
        source: 'dictionary',
      });

      const canonicalId = resolveCanonicalVocab('meticulous', useAppStore.getState().vocabularyList)!.canonicalId;

      // 1. Kiểm tra local SRS state đã commit thành công
      const srsMap = useAppStore.getState().srsProgressMap;
      expect(srsMap[canonicalId]).toBeDefined();
      expect(srsMap[canonicalId].srsLevel).toBe(0);
      expect(srsMap[canonicalId].interval).toBe(1);
      expect(srsMap[canonicalId].easeFactor).toBe(2.5);

      // 2. Kiểm tra Local Outbox chứa đúng 1 event
      const entries = localOutbox.getAllEntries();
      expect(entries.length).toBe(1);

      const event = entries[0].event as LearnWordEvent;
      expect(event.eventType).toBe('learn_word');
      expect(event.entityType).toBe('word');
      expect(event.entityId).toBe(canonicalId);
      expect(event.userId).toBe(testUserId);
      expect(event.schemaVersion).toBe(1);
      expect(event.idempotencyKey).toBe(generateIdempotencyKey('learn_word', canonicalId, 'canonical'));

      // 3. Payload tối thiểu đúng chuẩn evidence
      expect(event.payload.wordId).toBe(canonicalId);
      expect(event.payload.word.toLowerCase()).toBe('meticulous');
      expect(event.payload.meaning).toBe('Tỉ mỉ, cẩn thận');
      expect(event.payload.contextSentence).toBe('She was meticulous about keeping records.');
      expect(event.payload.source).toBe('dictionary');
      expect(event.payload.isCustom).toBe(false);
    });
  });

  // ==========================================================================
  // 2. CANONICALIZATION & NORMALIZATION (Case & Punctuation)
  // ==========================================================================
  describe('2. Canonical Identity & Word Normalization', () => {
    it('cùng một từ với hoa/thường hoặc dấu câu đều chuẩn hóa về cùng canonicalId và idempotencyKey', () => {
      // Input bẩn: khoảng trắng dư thừa, dấu ngoặc kép, dấu chấm than
      useAppStore.getState().saveToSRS('  "APPLE"!..  ', {
        source: 'reading',
      });

      const canonicalId = resolveCanonicalVocab('apple', useAppStore.getState().vocabularyList)!.canonicalId;

      const entries = localOutbox.getAllEntries();
      expect(entries.length).toBe(1);

      const event = entries[0].event as LearnWordEvent;
      expect(event.entityId).toBe(canonicalId);
      expect(event.payload.word.toLowerCase()).toBe('apple');
      expect(event.idempotencyKey).toBe(generateIdempotencyKey('learn_word', canonicalId, 'canonical'));

      // Thử gọi saveToSRS lần 2 với chữ thường sạch "apple"
      useAppStore.getState().saveToSRS('apple');

      // Không tạo duplicate event trong outbox
      expect(localOutbox.getTotalCount()).toBe(1);

      // srsProgressMap chỉ có đúng 1 bản ghi cho từ apple
      const srsKeys = Object.keys(useAppStore.getState().srsProgressMap);
      expect(srsKeys.filter((k) => k === canonicalId).length).toBe(1);
    });
  });

  // ==========================================================================
  // 3. CUSTOM WORD LEARNING: addCustomWord
  // ==========================================================================
  describe('3. Custom Word Learning (addCustomWord)', () => {
    it('thêm từ tự tạo phát learn_word event với isCustom = true và canonicalId custom_*', () => {
      useAppStore.getState().addCustomWord({
        word: 'quantumflux',
        ipa: '/ˈkwɑːn.təm flʌks/',
        meaning: 'dòng lượng tử',
        example: 'Quantum flux is hard to measure.',
        partOfSpeech: 'noun',
        tag: 'Tech',
      });

      const customWords = useAppStore.getState().userCustomWords;
      expect(customWords.some((w) => w.word === 'quantumflux')).toBe(true);

      const entries = localOutbox.getAllEntries();
      expect(entries.length).toBe(1);

      const event = entries[0].event as LearnWordEvent;
      expect(event.eventType).toBe('learn_word');
      expect(event.entityType).toBe('word');
      expect(event.entityId).toBe('custom_quantumflux');
      expect(event.payload.isCustom).toBe(true);
      expect(event.payload.word).toBe('quantumflux');
      expect(event.payload.meaning).toBe('dòng lượng tử');
      expect(event.idempotencyKey).toBe('idemp_learn_word_custom_quantumflux_canonical');
    });
  });

  // ==========================================================================
  // 4. IDEMPOTENCY: RETRY & DUPLICATE PREVENTION
  // ==========================================================================
  describe('4. Idempotency & Duplicate Prevention', () => {
    it('gọi emitLearnWordEvent nhiều lần cho cùng 1 từ không tạo duplicate trong Outbox', () => {
      const res1 = emitLearnWordEvent({
        wordId: 'vocab_resilient',
        word: 'resilient',
        meaning: 'kiên cường',
        source: 'dictionary',
      });
      expect(res1.success).toBe(true);
      expect(res1.enqueued).toBe(true);

      // Emit lần 2 cho cùng từ
      const res2 = emitLearnWordEvent({
        wordId: 'vocab_resilient',
        word: 'resilient',
        meaning: 'kiên cường',
        source: 'dictionary',
      });
      expect(res2.success).toBe(true);
      expect(res2.enqueued).toBe(false); // Bị deduplicate do trùng idempotencyKey
      expect(res2.skipped).toBe(true);

      expect(localOutbox.getTotalCount()).toBe(1);
    });

    it('nếu từ đã có trong SRS, saveToSRS cập nhật ngữ cảnh/nguồn nhưng không tạo duplicate SRS card', () => {
      // Lần 1: thêm từ
      useAppStore.getState().saveToSRS('resilient', {
        contextSentence: 'Context 1',
        source: 'reading',
      });
      const canonicalId = resolveCanonicalVocab('resilient', useAppStore.getState().vocabularyList)!.canonicalId;
      expect(localOutbox.getTotalCount()).toBe(1);

      // Giả lập outbox đã flush và clear
      localOutbox.clear();

      // Lần 2: thêm cùng từ với ngữ cảnh mới
      useAppStore.getState().saveToSRS('resilient', {
        contextSentence: 'Context 2',
        source: 'translator',
      });

      // srsProgressMap vẫn chỉ có 1 card duy nhất
      const srsKeys = Object.keys(useAppStore.getState().srsProgressMap);
      expect(srsKeys.filter((k) => k === canonicalId).length).toBe(1);
    });
  });

  // ==========================================================================
  // 5. MULTI-DEVICE SIMULATION (Device A & Device B cùng thêm 1 từ)
  // ==========================================================================
  describe('5. Multi-Device Conflict Resolution & Deduplication', () => {
    it('hai thiết bị cùng add một từ sinh cùng idempotencyKey, server trả already_processed cho thiết bị thứ hai', async () => {
      const canonicalId = resolveCanonicalVocab('epiphany', useAppStore.getState().vocabularyList)!.canonicalId;

      // Giả lập Device A thêm từ "epiphany"
      const deviceAEventResult = emitLearnWordEvent({
        wordId: canonicalId,
        word: 'epiphany',
        meaning: 'sự giác ngộ',
        source: 'reading',
        userId: testUserId,
      });
      expect(deviceAEventResult.enqueued).toBe(true);
      const eventA = deviceAEventResult.event!;

      // Giả lập Device B trên môi trường khác cũng thêm từ "epiphany"
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
      const deviceBEventResult = emitLearnWordEvent(
        {
          wordId: canonicalId,
          word: 'epiphany',
          meaning: 'sự giác ngộ',
          source: 'dictionary',
          userId: testUserId,
        },
        outboxB
      );
      expect(deviceBEventResult.enqueued).toBe(true);
      const eventB = deviceBEventResult.event!;

      // Cả hai thiết bị sinh ra đúng cùng một Idempotency Key
      expect(eventA.idempotencyKey).toBe(eventB.idempotencyKey);
      expect(eventA.idempotencyKey).toBe(generateIdempotencyKey('learn_word', canonicalId, 'canonical'));

      // Giả lập Server RPC response cho Device A: applied
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          received_count: 1,
          applied_count: 1,
          duplicate_count: 0,
          rejected_count: 0,
          results: [
            { event_id: eventA.eventId, status: 'applied', code: 'EVENT_APPLIED' },
          ],
        },
        error: null,
      } as any);

      const flushResultA = await flushOutboxEventsThroughCoordinator(localOutbox);
      expect(flushResultA.acknowledgedCount).toBe(1);
      expect(localOutbox.getTotalCount()).toBe(0);

      // Giả lập Server RPC response cho Device B: already_processed (do server đã thấy idempotency_key)
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          received_count: 1,
          applied_count: 0,
          duplicate_count: 1,
          rejected_count: 0,
          results: [
            { event_id: eventB.eventId, status: 'already_processed', code: 'DUPLICATE_EVENT' },
          ],
        },
        error: null,
      } as any);

      const flushResultB = await flushOutboxEventsThroughCoordinator(outboxB);
      // already_processed được tính là ACK thành công (idempotent success)
      expect(flushResultB.acknowledgedCount).toBe(1);
      expect(outboxB.getTotalCount()).toBe(0);
    });
  });

  // ==========================================================================
  // 6. SNAPSHOT + EVENT DEDUPLICATION (Safety Net & Non-destructive)
  // ==========================================================================
  describe('6. Snapshot + Event Reconciliation & Safety', () => {
    it('mergeCloudData bảo toàn tiến trình SRS cao hơn và không bị learn_word ghi đè', () => {
      const canonicalId = resolveCanonicalVocab('serendipity', useAppStore.getState().vocabularyList)!.canonicalId;

      // User đã có từ "serendipity" với tiến độ cao trên cloud (srsLevel: 3, interval: 15)
      useAppStore.getState().mergeCloudData({
        cloudSrsList: [
          {
            word_id: canonicalId,
            repetition: 3,
            interval: 15,
            ease_factor: 2.6,
            next_review_date: '2026-11-01T00:00:00.000Z',
          },
        ],
      });

      const srsBefore = useAppStore.getState().srsProgressMap[canonicalId];
      expect(srsBefore.srsLevel).toBe(3);
      expect(srsBefore.interval).toBe(15);

      // Thao tác saveToSRS cục bộ cho từ "serendipity"
      useAppStore.getState().saveToSRS('serendipity');

      // Tiến trình SRS không bị reset về 0/1
      const srsAfter = useAppStore.getState().srsProgressMap[canonicalId];
      expect(srsAfter.srsLevel).toBe(3);
      expect(srsAfter.interval).toBe(15);
    });
  });

  // ==========================================================================
  // 7. OFFLINE PERSISTENCE & RELOAD BEHAVIOR
  // ==========================================================================
  describe('7. Offline Persistence & Browser Reload Resilience', () => {
    it('lưu từ khi offline được persist an toàn vào storage và khôi phục sau khi reload', () => {
      // Tạo mock storage riêng để theo dõi
      const mockStorageData: Record<string, string> = {};
      const testStorage: Storage = {
        getItem: (k: string) => mockStorageData[k] || null,
        setItem: (k: string, v: string) => { mockStorageData[k] = v; },
        removeItem: (k: string) => { delete mockStorageData[k]; },
        clear: () => { Object.keys(mockStorageData).forEach((k) => delete mockStorageData[k]); },
        key: () => null,
        length: 0,
      };

      const customOutbox = new LocalOutbox(testStorage);

      // Emit event offline
      const emitRes = emitLearnWordEvent(
        {
          wordId: 'vocab_tenacious',
          word: 'tenacious',
          meaning: 'kiên trì, ngoan cường',
          source: 'dictionary',
          userId: testUserId,
        },
        customOutbox
      );
      expect(emitRes.enqueued).toBe(true);

      // Dữ liệu đã được ghi vào storage
      expect(mockStorageData[OUTBOX_STORAGE_KEY]).toBeDefined();

      // Giả lập browser reload: tạo instance mới với cùng storage
      const reloadedOutbox = new LocalOutbox(testStorage);
      const restoredEntries = reloadedOutbox.getAllEntries();
      expect(restoredEntries.length).toBe(1);
      expect(restoredEntries[0].event.entityId).toBe('vocab_tenacious');
      expect((restoredEntries[0].event as LearnWordEvent).payload.word).toBe('tenacious');
    });
  });

  // ==========================================================================
  // 8. FEATURE FLAG & FALLBACK SAFE-GUARD
  // ==========================================================================
  describe('8. Feature Flag & Fallback Safeguards', () => {
    it('khi learnWord domain bị disable, saveToSRS vẫn hoạt động local bình thường nhưng không emit event', () => {
      // Tắt feature flag learnWord
      setEventSyncConfig({
        migratedDomains: {
          flashcardReview: true,
          learnWord: false, // DISABLED
        },
      });

      useAppStore.getState().saveToSRS('lucid', { meaning: 'rõ ràng, minh bạch' });

      const canonicalId = resolveCanonicalVocab('lucid', useAppStore.getState().vocabularyList)!.canonicalId;

      // Local SRS vẫn tạo thành công
      const srsMap = useAppStore.getState().srsProgressMap;
      expect(srsMap[canonicalId]).toBeDefined();

      // Nhưng outbox KHÔNG có event
      expect(localOutbox.getTotalCount()).toBe(0);

      // Snapshot sync (pushLocalToCloud) vẫn đẩy dữ liệu an toàn qua cloudSyncApi
      let snapshotPushed = false;
      vi.spyOn(cloudSyncApi, 'uploadSync').mockImplementation(async () => {
        snapshotPushed = true;
        return { success: true, syncedAt: new Date().toISOString(), srsItemsUpserted: 1, dailyLogsUpserted: 0 };
      });

      return pushLocalToCloud(testUserId).then(() => {
        expect(snapshotPushed).toBe(true);
      });
    });
  });


  // ==========================================================================
  // 9. SECURITY & DATA INTEGRITY INVARIANT
  // ==========================================================================
  describe('9. Security & Integrity Invariants', () => {
    it('learn_word event không tự tiện gán XP, level hay fake mastery FSRS', () => {
      const emitRes = emitLearnWordEvent({
        wordId: 'vocab_eloquent',
        word: 'eloquent',
        meaning: 'hùng biện',
        source: 'dictionary',
      });

      const payload = (emitRes.event as LearnWordEvent).payload as any;
      expect(payload.xp).toBeUndefined();
      expect(payload.mastery).toBeUndefined();
      expect(payload.fsrsState).toBeUndefined();
      expect(payload.srsLevel).toBeUndefined();
    });
  });
});
