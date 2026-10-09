// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../../lib/supabaseClient';
import { createDomainEvent } from '../eventIdentityService';
import { LocalOutbox } from '../localOutboxService';
import {
  ingestEventsOnServer,
  processOutboxBatch,
} from '../cloudEventSyncService';

class MockStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] || null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

/**
 * Server Ingestion Simulator that faithfully reflects the PL/pgSQL RPC
 * defined in `scripts/setup_event_sync.sql`.
 */
class ServerIngestionSimulator {
  public databaseEvents: Map<string, any> = new Map(); // key = `${user_id}:${event_id}` or `${user_id}:${idempotency_key}`
  public currentUser: { id: string } | null = { id: 'auth_user_123' };

  public async rpc(
    name: string,
    params: { p_events: any[] }
  ): Promise<{ data: any; error: any }> {
    if (name !== 'ingest_learning_events') {
      return { data: null, error: { message: `Unknown RPC ${name}`, code: 'NOT_FOUND' } };
    }

    // 1. Auth Check
    if (!this.currentUser) {
      return {
        data: {
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Yêu cầu đăng nhập để đồng bộ sự kiện học tập.',
        },
        error: null,
      };
    }

    const userId = this.currentUser.id;
    const events = params.p_events;

    if (!Array.isArray(events)) {
      return {
        data: {
          success: false,
          code: 'INVALID_PAYLOAD',
          message: 'p_events phải là một mảng JSON.',
        },
        error: null,
      };
    }

    if (events.length > 100) {
      return {
        data: {
          success: false,
          code: 'BATCH_SIZE_EXCEEDED',
          message: 'Kích thước lô vượt quá giới hạn tối đa (100 events).',
        },
        error: null,
      };
    }

    const serverNow = new Date().toISOString();
    let appliedCount = 0;
    let duplicateCount = 0;
    let rejectedCount = 0;
    const results: any[] = [];

    for (const item of events) {
      const eventId = String(item?.eventId || item?.event_id || '').trim();
      const eventType = String(item?.eventType || item?.event_type || '').trim();
      const entityType = String(item?.entityType || item?.entity_type || '').trim();
      const entityId = String(item?.entityId || item?.entity_id || '').trim();
      const schemaVersion = item?.schemaVersion ?? item?.schema_version;
      const deviceId = String(item?.deviceId || item?.device_id || '').trim();
      const idempotencyKey = String(item?.idempotencyKey || item?.idempotency_key || '').trim();
      const payload = item?.payload;

      // 1. Envelope validations
      if (!eventId) {
        rejectedCount++;
        results.push({ event_id: eventId, status: 'rejected', code: 'MISSING_EVENT_ID' });
        continue;
      }

      if (!['review_card', 'learn_word', 'complete_quiz', 'mistake_created'].includes(eventType)) {
        rejectedCount++;
        results.push({ event_id: eventId, status: 'rejected', code: 'INVALID_EVENT_TYPE' });
        continue;
      }

      if (schemaVersion !== 1) {
        rejectedCount++;
        results.push({ event_id: eventId, status: 'rejected', code: 'UNSUPPORTED_SCHEMA_VERSION' });
        continue;
      }

      if (!['card', 'word', 'quiz', 'mistake'].includes(entityType)) {
        rejectedCount++;
        results.push({ event_id: eventId, status: 'rejected', code: 'INVALID_ENTITY_TYPE' });
        continue;
      }

      if (!entityId || !deviceId || !idempotencyKey) {
        rejectedCount++;
        results.push({ event_id: eventId, status: 'rejected', code: 'MISSING_REQUIRED_ENVELOPE' });
        continue;
      }

      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        rejectedCount++;
        results.push({ event_id: eventId, status: 'rejected', code: 'INVALID_PAYLOAD_SHAPE' });
        continue;
      }

      if (JSON.stringify(payload).length > 32768) {
        rejectedCount++;
        results.push({ event_id: eventId, status: 'rejected', code: 'PAYLOAD_OVERSIZED' });
        continue;
      }

      // 2. Domain-specific payload validation
      if (eventType === 'review_card') {
        if (!payload.cardId || !payload.wordText || payload.grade === undefined) {
          rejectedCount++;
          results.push({ event_id: eventId, status: 'rejected', code: 'MALFORMED_REVIEW_CARD_PAYLOAD' });
          continue;
        }
      }

      // 3. Idempotency Check (server-authoritative by userId + eventId or userId + idempotencyKey)
      const eventKey = `${userId}:${eventId}`;
      const idempKey = `${userId}:${idempotencyKey}`;

      if (this.databaseEvents.has(eventKey) || this.databaseEvents.has(idempKey)) {
        duplicateCount++;
        results.push({
          event_id: eventId,
          status: 'already_processed',
          code: 'DUPLICATE_EVENT',
          message: 'Sự kiện đã được ghi nhận trước đó.',
        });
        continue;
      }

      // 4. Ingest and record into database
      // Anti-spoofing Invariant: Server ALWAYS stores `userId = currentUser.id`
      const row = {
        id: `row_${Date.now()}_${Math.random()}`,
        user_id: userId,
        event_id: eventId,
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        payload,
        schema_version: schemaVersion,
        device_id: deviceId,
        idempotency_key: idempotencyKey,
        occurred_at: item.occurredAt,
        received_at: serverNow,
        processing_status: 'applied',
      };

      this.databaseEvents.set(eventKey, row);
      this.databaseEvents.set(idempKey, row);
      appliedCount++;
      results.push({
        event_id: eventId,
        status: 'applied',
        code: 'EVENT_APPLIED',
        message: 'Sự kiện đã được ghi nhận thành công.',
      });
    }

    return {
      data: {
        success: true,
        received_count: events.length,
        applied_count: appliedCount,
        duplicate_count: duplicateCount,
        rejected_count: rejectedCount,
        server_now: serverNow,
        results,
      },
      error: null,
    };
  }
}

describe('PHASE 3 — Backend Supabase Event Sync & Idempotent Ingestion Suite', () => {
  let serverSim: ServerIngestionSimulator;

  beforeEach(() => {
    vi.clearAllMocks();
    serverSim = new ServerIngestionSimulator();

    // Hook supabase.rpc to ServerIngestionSimulator
    vi.spyOn(supabase, 'rpc').mockImplementation((name: string, params: any) => {
      return serverSim.rpc(name, params) as any;
    });
  });

  // ==========================================================================
  // 1. AUTHENTICATION & SECURITY BOUNDARY
  // ==========================================================================
  describe('1. Authentication Boundary & Spoofed User Prevention', () => {
    it('chặn người dùng chưa đăng nhập (unauthenticated access rejection)', async () => {
      serverSim.currentUser = null;

      const event = createDomainEvent({
        eventType: 'learn_word',
        entityType: 'word',
        entityId: 'w1',
        payload: { wordId: 'w1', word: 'apple', source: 'manual', isCustom: false },
      });

      const res = await ingestEventsOnServer([event]);
      expect(res.success).toBe(false);
      expect(res.code).toBe('UNAUTHORIZED');
    });

    it('bảo vệ chống giả mạo user_id: máy chủ chỉ ghi nhận user_id từ auth context', async () => {
      serverSim.currentUser = { id: 'legitimate_user_uuid' };

      // Client cố tình chèn userId giả mạo vào phong bì event
      const spoofedEvent = createDomainEvent({
        eventType: 'learn_word',
        entityType: 'word',
        entityId: 'w1',
        userId: 'victim_user_uuid', // Malicious attempt to spoof victim's id
        payload: { wordId: 'w1', word: 'apple', source: 'manual', isCustom: false },
      });

      const res = await ingestEventsOnServer([spoofedEvent]);
      expect(res.success).toBe(true);
      expect(res.applied_count).toBe(1);

      // Kiểm tra trong database của máy chủ: dòng dữ liệu ĐƯỢC LƯU DƯỚI ID CỦA legitimate_user_uuid
      const storedKey = `legitimate_user_uuid:${spoofedEvent.eventId}`;
      const storedRow = serverSim.databaseEvents.get(storedKey);
      expect(storedRow).toBeDefined();
      expect(storedRow.user_id).toBe('legitimate_user_uuid');
      expect(storedRow.user_id).not.toBe('victim_user_uuid');
    });
  });

  // ==========================================================================
  // 2. IDEMPOTENCY & DUPLICATE INSERT GUARDS
  // ==========================================================================
  describe('2. Idempotency & Duplicate Event Protection', () => {
    it('trả về already_processed khi gửi lại cùng event_id (idempotent apply)', async () => {
      const event = createDomainEvent({
        eventType: 'review_card',
        entityType: 'card',
        entityId: 'c1',
        payload: {
          cardId: 'c1',
          wordText: 'apple',
          grade: 2,
          rating: 'good',
          algorithm: 'sm2',
          intervalBefore: 1,
          intervalAfter: 2,
          repetitionBefore: 1,
          repetitionAfter: 2,
          easeFactorBefore: 2.5,
          easeFactorAfter: 2.5,
        },
      });

      // Lần 1: Gửi thành công
      const res1 = await ingestEventsOnServer([event]);
      expect(res1.applied_count).toBe(1);
      expect(res1.results![0].status).toBe('applied');

      // Lần 2: Client gửi lại sự kiện y hệt (Retry)
      const res2 = await ingestEventsOnServer([event]);
      expect(res2.applied_count).toBe(0);
      expect(res2.duplicate_count).toBe(1);
      expect(res2.results![0].status).toBe('already_processed');
      expect(res2.results![0].code).toBe('DUPLICATE_EVENT');
    });

    it('trả về already_processed khi trùng idempotencyKey dù event_id khác', async () => {
      const sharedIdempKey = 'idemp_shared_transaction_key_123';

      const ev1 = createDomainEvent({
        eventType: 'learn_word',
        entityType: 'word',
        entityId: 'w1',
        idempotencyKey: sharedIdempKey,
        payload: { wordId: 'w1', word: 'apple', source: 'manual', isCustom: false },
      });

      const ev2 = createDomainEvent({
        eventType: 'learn_word',
        entityType: 'word',
        entityId: 'w1',
        idempotencyKey: sharedIdempKey, // Cùng idempotencyKey
        payload: { wordId: 'w1', word: 'apple', source: 'manual', isCustom: false },
      });

      const res1 = await ingestEventsOnServer([ev1]);
      expect(res1.applied_count).toBe(1);

      const res2 = await ingestEventsOnServer([ev2]);
      expect(res2.applied_count).toBe(0);
      expect(res2.duplicate_count).toBe(1);
      expect(res2.results![0].status).toBe('already_processed');
    });
  });

  // ==========================================================================
  // 3. MALFORMED, UNSUPPORTED SCHEMA & OVERSIZED PAYLOAD GUARDS
  // ==========================================================================
  describe('3. Validation, Unsupported Schema & Payload Boundary', () => {
    it('từ chối sự kiện có event_type không hợp lệ (status: rejected)', async () => {
      const invalidEvent = {
        eventId: 'evt_invalid_1',
        eventType: 'hack_xp' as any,
        entityType: 'card',
        entityId: 'c1',
        deviceId: 'dev_1',
        idempotencyKey: 'k1',
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
        payload: { hacked: true },
      } as any;

      const res = await ingestEventsOnServer([invalidEvent]);
      expect(res.rejected_count).toBe(1);
      expect(res.results![0].status).toBe('rejected');
      expect(res.results![0].code).toBe('INVALID_EVENT_TYPE');
    });

    it('từ chối sự kiện có schemaVersion không được hỗ trợ (schemaVersion: 99)', async () => {
      const unsupportedSchemaEvent = {
        eventId: 'evt_schema_1',
        eventType: 'learn_word',
        entityType: 'word',
        entityId: 'w1',
        deviceId: 'dev_1',
        idempotencyKey: 'k1',
        schemaVersion: 99,
        occurredAt: new Date().toISOString(),
        payload: { wordId: 'w1', word: 'test', source: 'manual', isCustom: false },
      } as any;

      const res = await ingestEventsOnServer([unsupportedSchemaEvent]);
      expect(res.rejected_count).toBe(1);
      expect(res.results![0].code).toBe('UNSUPPORTED_SCHEMA_VERSION');
    });

    it('từ chối payload vượt quá kích thước 32 KB (oversized payload guard)', async () => {
      const hugeString = 'A'.repeat(35000); // 35 KB
      const oversizedEvent = createDomainEvent({
        eventType: 'learn_word',
        entityType: 'word',
        entityId: 'w1',
        payload: { wordId: 'w1', word: 'test', source: 'manual', isCustom: false, meaning: hugeString },
      });

      const res = await ingestEventsOnServer([oversizedEvent]);
      expect(res.rejected_count).toBe(1);
      expect(res.results![0].code).toBe('PAYLOAD_OVERSIZED');
    });

    it('từ chối payload thiếu trường bắt buộc của review_card', async () => {
      const malformedEvent = {
        eventId: 'evt_rev_bad',
        eventType: 'review_card',
        entityType: 'card',
        entityId: 'c1',
        deviceId: 'dev_1',
        idempotencyKey: 'k1',
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
        payload: { cardId: 'c1' }, // Missing grade & wordText
      } as any;

      const res = await ingestEventsOnServer([malformedEvent]);
      expect(res.rejected_count).toBe(1);
      expect(res.results![0].code).toBe('MALFORMED_REVIEW_CARD_PAYLOAD');
    });
  });

  // ==========================================================================
  // 4. RETRY AFTER SERVER COMMIT & CLIENT OUTBOX ACK INTEGRATION
  // ==========================================================================
  describe('4. Retry after Server Commit & Granular Outbox ACK Integration', () => {
    it('kịch bản Network Timeout: Server đã commit, client timeout và retry -> outbox vẫn xóa sạch an toàn', async () => {
      const storage = new MockStorage();
      const outbox = new LocalOutbox(storage, 10);

      const ev1 = createDomainEvent({
        eventType: 'learn_word',
        entityType: 'word',
        entityId: 'w1',
        payload: { wordId: 'w1', word: 'serendipity', source: 'dictionary', isCustom: false },
      });

      outbox.enqueue(ev1);
      expect(outbox.getTotalCount()).toBe(1);

      // BƯỚC 1: Lần thử đầu tiên gửi lên server và server đã lưu vào DB
      // Nhưng do mạng chập chờn, response bị drop giữa đường (Client timeout)
      const directRes = await ingestEventsOnServer([ev1]);
      expect(directRes.applied_count).toBe(1);
      expect(serverSim.databaseEvents.size).toBeGreaterThan(0);

      // Trên client: outbox vẫn giữ ev1 ở trạng thái 'pending' vì client chưa nhận được ACK
      outbox.revertSending();
      expect(outbox.getPendingCount()).toBe(1);

      // BƯỚC 2: Coordinator retry tự động qua processOutboxBatch
      const batchRes = await processOutboxBatch(outbox, 10);

      // Server trả về already_processed
      expect(batchRes.acknowledgedCount).toBe(1);
      expect(batchRes.acknowledgedEventIds).toContain(ev1.eventId);

      // Outbox trên client nhận diện trạng thái already_processed là thành công và XÓA SẠCH
      expect(outbox.getTotalCount()).toBe(0);
      expect(outbox.getPendingCount()).toBe(0);
    });

    it('processOutboxBatch dọn sạch event rejected để không làm kẹt hàng đợi', async () => {
      const storage = new MockStorage();
      const outbox = new LocalOutbox(storage, 10);

      const validEvent = createDomainEvent({
        eventType: 'learn_word',
        entityType: 'word',
        entityId: 'w_valid',
        payload: { wordId: 'w_valid', word: 'valid', source: 'dictionary', isCustom: false },
      });

      outbox.enqueue(validEvent);

      // Giả lập server trả về: event bị rejected
      vi.spyOn(serverSim, 'rpc').mockResolvedValueOnce({
        data: {
          success: true,
          received_count: 1,
          applied_count: 0,
          duplicate_count: 0,
          rejected_count: 1,
          server_now: new Date().toISOString(),
          results: [
            { event_id: validEvent.eventId, status: 'rejected', code: 'SCHEMA_VIOLATION' },
          ],
        },
        error: null,
      });

      const batchRes = await processOutboxBatch(outbox, 10);
      expect(batchRes.rejectedCount).toBe(1);
      expect(batchRes.rejectedEventIds).toContain(validEvent.eventId);

      // Event rejected phải được xóa khỏi outbox để không lặp vô hạn
      expect(outbox.getTotalCount()).toBe(0);
    });

    it('processOutboxBatch hoàn trả về pending khi gặp lỗi mạng kết nối (network failure recovery)', async () => {
      const storage = new MockStorage();
      const outbox = new LocalOutbox(storage, 10);

      const ev1 = createDomainEvent({
        eventType: 'learn_word',
        entityType: 'word',
        entityId: 'w1',
        payload: { wordId: 'w1', word: 'resilient', source: 'manual', isCustom: false },
      });

      outbox.enqueue(ev1);

      // Giả lập lỗi mạng rớt kết nối
      vi.spyOn(supabase, 'rpc').mockRejectedValueOnce(new Error('Failed to fetch (offline)'));

      const batchRes = await processOutboxBatch(outbox, 10);
      expect(batchRes.retryableCount).toBe(1);
      expect(batchRes.acknowledgedCount).toBe(0);

      // Event được an toàn revert về 'pending' để sẵn sàng cho lần sync tiếp theo
      expect(outbox.getTotalCount()).toBe(1);
      expect(outbox.getPendingCount()).toBe(1);
      expect(outbox.getAllEntries()[0].status).toBe('pending');
    });
  });
});
