// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LEARNING_EVENT_SCHEMA_VERSION,
  validateDomainEvent,
  isDomainEvent,
  ReviewCardEvent,
  LearnWordEvent,
  CompleteQuizEvent,
  MistakeCreatedEvent,
} from '../../types/learningEvents';
import {
  getOrCreateDeviceId,
  resetCachedDeviceIdForTesting,
  generateEventId,
  generateIdempotencyKey,
  createDomainEvent,
  DEVICE_ID_STORAGE_KEY,
} from '../eventIdentityService';
import {
  LocalOutbox,
  OUTBOX_STORAGE_KEY,
} from '../localOutboxService';

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

describe('PHASE 2 — Domain Event Contract & Local Outbox Suite', () => {
  beforeEach(() => {
    resetCachedDeviceIdForTesting();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // 1. DOMAIN EVENT CONTRACT TYPE & VALIDATION
  // ==========================================================================
  describe('1. Domain Event Contract Type & Validation', () => {
    it('validates a well-formed review_card event', () => {
      const event: ReviewCardEvent = {
        eventId: 'evt_rev_123',
        eventType: 'review_card',
        entityType: 'card',
        entityId: 'card_apple',
        userId: 'user_uuid_1',
        deviceId: 'dev_test_device',
        idempotencyKey: 'idemp_rev_apple_1',
        schemaVersion: LEARNING_EVENT_SCHEMA_VERSION,
        occurredAt: new Date().toISOString(),
        payload: {
          cardId: 'card_apple',
          wordText: 'apple',
          grade: 3,
          rating: 'easy',
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
        },
      };

      const result = validateDomainEvent(event);
      expect(result.valid).toBe(true);
      expect(isDomainEvent(event)).toBe(true);
      expect(result.event).toBeDefined();
    });

    it('validates a well-formed learn_word event', () => {
      const event: LearnWordEvent = {
        eventId: 'evt_word_456',
        eventType: 'learn_word',
        entityType: 'word',
        entityId: 'word_serendipity',
        userId: null,
        deviceId: 'dev_test_device',
        idempotencyKey: 'idemp_word_serendipity',
        schemaVersion: LEARNING_EVENT_SCHEMA_VERSION,
        occurredAt: new Date().toISOString(),
        payload: {
          wordId: 'word_serendipity',
          word: 'serendipity',
          meaning: 'sự tình cờ may mắn',
          contextSentence: 'A fortunate serendipity.',
          source: 'reading',
          sources: ['reading', 'dictionary'],
          isCustom: true,
        },
      };

      const result = validateDomainEvent(event);
      expect(result.valid).toBe(true);
      expect(isDomainEvent(event)).toBe(true);
    });

    it('validates a well-formed complete_quiz event', () => {
      const event: CompleteQuizEvent = {
        eventId: 'evt_quiz_789',
        eventType: 'complete_quiz',
        entityType: 'quiz',
        entityId: 'quiz_session_101',
        userId: 'user_uuid_1',
        deviceId: 'dev_test_device',
        idempotencyKey: 'idemp_quiz_101',
        schemaVersion: LEARNING_EVENT_SCHEMA_VERSION,
        occurredAt: new Date().toISOString(),
        payload: {
          quizId: 'quiz_session_101',
          quizType: 'word_match',
          totalQuestions: 10,
          correctCount: 9,
          score: 90,
          durationSeconds: 45,
          mistakeCount: 1,
          xpEarned: 25,
        },
      };

      const result = validateDomainEvent(event);
      expect(result.valid).toBe(true);
      expect(isDomainEvent(event)).toBe(true);
    });

    it('validates a well-formed mistake_created event', () => {
      const event: MistakeCreatedEvent = {
        eventId: 'evt_mistake_999',
        eventType: 'mistake_created',
        entityType: 'mistake',
        entityId: 'mistake_diligent',
        userId: 'user_uuid_1',
        deviceId: 'dev_test_device',
        idempotencyKey: 'idemp_mistake_diligent',
        schemaVersion: LEARNING_EVENT_SCHEMA_VERSION,
        occurredAt: new Date().toISOString(),
        payload: {
          mistakeId: 'mistake_diligent',
          wordId: 'diligent',
          word: 'diligent',
          source: 'flashcard',
          mistakeType: 'meaning',
          userAnswer: 'lười biếng',
          expectedAnswer: 'chăm chỉ',
        },
      };

      const result = validateDomainEvent(event);
      expect(result.valid).toBe(true);
      expect(isDomainEvent(event)).toBe(true);
    });

    it('rejects unsupported schemaVersion', () => {
      const invalidEvent = {
        eventId: 'evt_future_1',
        eventType: 'learn_word',
        entityType: 'word',
        entityId: 'w1',
        userId: null,
        deviceId: 'dev_1',
        idempotencyKey: 'idemp_1',
        schemaVersion: 99, // unsupported
        occurredAt: new Date().toISOString(),
        payload: { wordId: 'w1', word: 'hi', source: 'manual', isCustom: false },
      };

      const result = validateDomainEvent(invalidEvent);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported schemaVersion');
      expect(isDomainEvent(invalidEvent)).toBe(false);
    });

    it('rejects malformed payloads with missing or invalid fields', () => {
      // 1. Missing eventId
      expect(validateDomainEvent({ eventType: 'review_card' }).valid).toBe(false);

      // 2. Invalid occurredAt date
      expect(
        validateDomainEvent({
          eventId: 'e1',
          eventType: 'learn_word',
          entityType: 'word',
          entityId: 'w1',
          deviceId: 'd1',
          idempotencyKey: 'k1',
          schemaVersion: LEARNING_EVENT_SCHEMA_VERSION,
          occurredAt: 'not-a-date',
          payload: {},
        }).valid
      ).toBe(false);

      // 3. Mismatched entityType for review_card (expected 'card', given 'quiz')
      expect(
        validateDomainEvent({
          eventId: 'e1',
          eventType: 'review_card',
          entityType: 'quiz',
          entityId: 'c1',
          deviceId: 'd1',
          idempotencyKey: 'k1',
          schemaVersion: LEARNING_EVENT_SCHEMA_VERSION,
          occurredAt: new Date().toISOString(),
          payload: {
            cardId: 'c1',
            wordText: 'test',
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
        }).valid
      ).toBe(false);

      // 4. Invalid grade (e.g. grade 4 instead of 0..3)
      expect(
        validateDomainEvent({
          eventId: 'e1',
          eventType: 'review_card',
          entityType: 'card',
          entityId: 'c1',
          deviceId: 'd1',
          idempotencyKey: 'k1',
          schemaVersion: LEARNING_EVENT_SCHEMA_VERSION,
          occurredAt: new Date().toISOString(),
          payload: {
            cardId: 'c1',
            wordText: 'test',
            grade: 4 as any,
            rating: 'good',
            algorithm: 'sm2',
            intervalBefore: 1,
            intervalAfter: 2,
            repetitionBefore: 1,
            repetitionAfter: 2,
            easeFactorBefore: 2.5,
            easeFactorAfter: 2.5,
          },
        }).valid
      ).toBe(false);
    });
  });

  // ==========================================================================
  // 2. EVENT IDENTITY & PERSISTENT DEVICE ID
  // ==========================================================================
  describe('2. Event Identity & Persistent Device ID', () => {
    it('persists stable deviceId in storage across calls', () => {
      const storage = new MockStorage();

      const deviceId1 = getOrCreateDeviceId(storage);
      expect(deviceId1).toBeTruthy();
      expect(deviceId1.startsWith('dev_')).toBe(true);

      // Verify stored in storage key
      expect(storage.getItem(DEVICE_ID_STORAGE_KEY)).toBe(deviceId1);

      // Subsequent call from the same instance
      const deviceId2 = getOrCreateDeviceId(storage);
      expect(deviceId2).toBe(deviceId1);

      // Simulate browser reload by clearing in-memory cache and re-reading from storage
      resetCachedDeviceIdForTesting();
      const deviceId3 = getOrCreateDeviceId(storage);
      expect(deviceId3).toBe(deviceId1);
    });

    it('generates collision-resistant unique event IDs', () => {
      const id1 = generateEventId('review_card', 'card_1');
      const id2 = generateEventId('review_card', 'card_1');

      expect(id1).not.toBe(id2);
      expect(id1).toContain('review_card');
      expect(id1).toContain('card_1');
    });

    it('generates reproducible idempotency key when qualifier provided, unique entropy when omitted', () => {
      // Deterministic when qualifier provided
      const key1 = generateIdempotencyKey('review_card', 'word_apple', 'review_session_1');
      const key2 = generateIdempotencyKey('review_card', 'word_apple', 'review_session_1');
      expect(key1).toBe(key2);

      // Non-deterministic entropy when qualifier omitted
      const keyRandom1 = generateIdempotencyKey('review_card', 'word_apple');
      const keyRandom2 = generateIdempotencyKey('review_card', 'word_apple');
      expect(keyRandom1).not.toBe(keyRandom2);
    });

    it('createDomainEvent helper constructs a valid canonical domain event', () => {
      const storage = new MockStorage();
      const deviceId = getOrCreateDeviceId(storage);

      const event = createDomainEvent({
        eventType: 'learn_word',
        entityType: 'word',
        entityId: 'word_ubiquitous',
        userId: 'user_xyz',
        deviceId,
        payload: {
          wordId: 'word_ubiquitous',
          word: 'ubiquitous',
          source: 'dictionary',
          isCustom: false,
        },
      });

      expect(event.eventId.startsWith('evt_learn_word_')).toBe(true);
      expect(event.schemaVersion).toBe(LEARNING_EVENT_SCHEMA_VERSION);
      expect(event.deviceId).toBe(deviceId);
      expect(event.userId).toBe('user_xyz');
      expect(event.idempotencyKey).toBeTruthy();
      expect(isDomainEvent(event)).toBe(true);
    });
  });

  // ==========================================================================
  // 3. LOCAL OUTBOX ENQUEUE & PERSISTENCE
  // ==========================================================================
  describe('3. Local Outbox Enqueue, Idempotency & Persistence', () => {
    it('enqueues valid events into pending state and persists to storage', () => {
      const storage = new MockStorage();
      const outbox = new LocalOutbox(storage, 10);

      const event = createDomainEvent({
        eventType: 'learn_word',
        entityType: 'word',
        entityId: 'w1',
        payload: { wordId: 'w1', word: 'test', source: 'reading', isCustom: true },
      });

      const res = outbox.enqueue(event);
      expect(res.success).toBe(true);
      expect(res.enqueued).toBe(true);
      expect(outbox.getTotalCount()).toBe(1);
      expect(outbox.getPendingCount()).toBe(1);

      // Verify persistent storage key
      const storedRaw = storage.getItem(OUTBOX_STORAGE_KEY);
      expect(storedRaw).toBeTruthy();
      const storedArray = JSON.parse(storedRaw!);
      expect(storedArray.length).toBe(1);
      expect(storedArray[0].event.eventId).toBe(event.eventId);
      expect(storedArray[0].status).toBe('pending');
    });

    it('rejects malformed events from entering outbox', () => {
      const storage = new MockStorage();
      const outbox = new LocalOutbox(storage, 10);

      const malformedEvent = {
        eventId: '',
        eventType: 'unknown_type' as any,
      } as any;

      const res = outbox.enqueue(malformedEvent);
      expect(res.success).toBe(false);
      expect(res.enqueued).toBe(false);
      expect(outbox.getTotalCount()).toBe(0);
    });

    it('enforces idempotency: ignores duplicate eventId without duplicate queuing', () => {
      const storage = new MockStorage();
      const outbox = new LocalOutbox(storage, 10);

      const event = createDomainEvent({
        eventType: 'learn_word',
        entityType: 'word',
        entityId: 'w1',
        payload: { wordId: 'w1', word: 'test', source: 'reading', isCustom: true },
      });

      const res1 = outbox.enqueue(event);
      expect(res1.enqueued).toBe(true);

      // Re-enqueuing exact same event
      const res2 = outbox.enqueue(event);
      expect(res2.success).toBe(true);
      expect(res2.enqueued).toBe(false); // Idempotently ignored
      expect(outbox.getTotalCount()).toBe(1);
    });

    it('preserves pending events across reload simulation', () => {
      const storage = new MockStorage();
      const outbox1 = new LocalOutbox(storage, 10);

      const ev1 = createDomainEvent({
        eventType: 'learn_word',
        entityType: 'word',
        entityId: 'w1',
        payload: { wordId: 'w1', word: 'word1', source: 'manual', isCustom: false },
      });
      const ev2 = createDomainEvent({
        eventType: 'learn_word',
        entityType: 'word',
        entityId: 'w2',
        payload: { wordId: 'w2', word: 'word2', source: 'manual', isCustom: false },
      });

      outbox1.enqueue(ev1);
      outbox1.enqueue(ev2);
      expect(outbox1.getTotalCount()).toBe(2);

      // Reload simulation: create a new outbox instance with the same storage
      const outboxReloaded = new LocalOutbox(storage, 10);
      expect(outboxReloaded.getTotalCount()).toBe(2);
      expect(outboxReloaded.getPendingCount()).toBe(2);

      const entries = outboxReloaded.getAllEntries();
      expect(entries[0].event.eventId).toBe(ev1.eventId);
      expect(entries[1].event.eventId).toBe(ev2.eventId);
    });
  });

  // ==========================================================================
  // 4. BOUNDED SIZE & FIFO DROP
  // ==========================================================================
  describe('4. Bounded Size & FIFO Eviction', () => {
    it('evicts oldest event when capacity limit is reached', () => {
      const storage = new MockStorage();
      const maxCapacity = 3;
      const outbox = new LocalOutbox(storage, maxCapacity);

      const ev1 = createDomainEvent({ eventType: 'learn_word', entityType: 'word', entityId: 'w1', payload: { wordId: 'w1', word: 'one', source: 'm', isCustom: false } });
      const ev2 = createDomainEvent({ eventType: 'learn_word', entityType: 'word', entityId: 'w2', payload: { wordId: 'w2', word: 'two', source: 'm', isCustom: false } });
      const ev3 = createDomainEvent({ eventType: 'learn_word', entityType: 'word', entityId: 'w3', payload: { wordId: 'w3', word: 'three', source: 'm', isCustom: false } });
      const ev4 = createDomainEvent({ eventType: 'learn_word', entityType: 'word', entityId: 'w4', payload: { wordId: 'w4', word: 'four', source: 'm', isCustom: false } });

      outbox.enqueue(ev1);
      outbox.enqueue(ev2);
      outbox.enqueue(ev3);
      expect(outbox.getTotalCount()).toBe(3);

      // Enqueue 4th item -> should evict ev1 (FIFO)
      const res4 = outbox.enqueue(ev4);
      expect(res4.droppedOldest).toBe(true);
      expect(outbox.getTotalCount()).toBe(3);

      const currentEntries = outbox.getAllEntries();
      const ids = currentEntries.map((e) => e.event.entityId);
      expect(ids).toEqual(['w2', 'w3', 'w4']);
      expect(ids).not.toContain('w1');
    });
  });

  // ==========================================================================
  // 5. TRANSACTIONAL SENDING LIFECYCLE & CRASH RECOVERY
  // ==========================================================================
  describe('5. Transactional Sending Lifecycle & Crash Recovery', () => {
    it('marks pending events as sending with a lease', () => {
      const storage = new MockStorage();
      const outbox = new LocalOutbox(storage, 10);

      const ev1 = createDomainEvent({ eventType: 'learn_word', entityType: 'word', entityId: 'w1', payload: { wordId: 'w1', word: 'one', source: 'm', isCustom: false } });
      outbox.enqueue(ev1);

      const batch = outbox.peekBatch(10);
      expect(batch.length).toBe(1);

      outbox.markSending([ev1.eventId], 5000);

      // It is now 'sending' -> getPendingCount() should be 0
      expect(outbox.getPendingCount()).toBe(0);
      expect(outbox.getAllEntries()[0].status).toBe('sending');
      expect(outbox.getAllEntries()[0].attempts).toBe(1);
    });

    it('automatically recovers in-flight "sending" events to "pending" on crash/reload', () => {
      const storage = new MockStorage();
      const outbox1 = new LocalOutbox(storage, 10);

      const ev1 = createDomainEvent({ eventType: 'learn_word', entityType: 'word', entityId: 'w1', payload: { wordId: 'w1', word: 'one', source: 'm', isCustom: false } });
      outbox1.enqueue(ev1);
      outbox1.markSending([ev1.eventId]);

      expect(outbox1.getPendingCount()).toBe(0);
      expect(outbox1.getAllEntries()[0].status).toBe('sending');

      // CRASH / RELOAD SIMULATION:
      // The browser crashed or reloaded while sending was in-flight.
      // New outbox instance initializes from storage.
      const outboxRecovered = new LocalOutbox(storage, 10);

      // Must be safely recovered back to 'pending' to prevent permanently stuck events
      expect(outboxRecovered.getTotalCount()).toBe(1);
      expect(outboxRecovered.getPendingCount()).toBe(1);
      expect(outboxRecovered.getAllEntries()[0].status).toBe('pending');
    });

    it('allows explicit revert of sending events back to pending on network failure', () => {
      const storage = new MockStorage();
      const outbox = new LocalOutbox(storage, 10);

      const ev1 = createDomainEvent({ eventType: 'learn_word', entityType: 'word', entityId: 'w1', payload: { wordId: 'w1', word: 'one', source: 'm', isCustom: false } });
      outbox.enqueue(ev1);
      outbox.markSending([ev1.eventId]);

      expect(outbox.getPendingCount()).toBe(0);

      outbox.revertSending([ev1.eventId]);
      expect(outbox.getPendingCount()).toBe(1);
      expect(outbox.getAllEntries()[0].status).toBe('pending');
    });

    it('treats expired lease as eligible in peekBatch', () => {
      const storage = new MockStorage();
      const outbox = new LocalOutbox(storage, 10, 100); // 100ms short lease

      const ev1 = createDomainEvent({ eventType: 'learn_word', entityType: 'word', entityId: 'w1', payload: { wordId: 'w1', word: 'one', source: 'm', isCustom: false } });
      outbox.enqueue(ev1);
      outbox.markSending([ev1.eventId], 50); // 50ms lease

      expect(outbox.peekBatch(10).length).toBe(0);

      // Manually simulate time passing beyond lease
      const entry = outbox.getAllEntries()[0];
      entry.sendingLeaseExpiresAt = Date.now() - 1000;

      // Now peekBatch treats it as eligible again
      expect(outbox.peekBatch(10).length).toBe(1);
    });
  });

  // ==========================================================================
  // 6. GRANULAR ACK & CLEANUP (RETENTION POLICY)
  // ==========================================================================
  describe('6. Granular ACK & Retention Cleanup', () => {
    it('acknowledges and removes only specified events immediately', () => {
      const storage = new MockStorage();
      const outbox = new LocalOutbox(storage, 10);

      const ev1 = createDomainEvent({ eventType: 'learn_word', entityType: 'word', entityId: 'w1', payload: { wordId: 'w1', word: 'one', source: 'm', isCustom: false } });
      const ev2 = createDomainEvent({ eventType: 'learn_word', entityType: 'word', entityId: 'w2', payload: { wordId: 'w2', word: 'two', source: 'm', isCustom: false } });
      outbox.enqueue(ev1);
      outbox.enqueue(ev2);

      expect(outbox.getTotalCount()).toBe(2);

      const ackResult = outbox.acknowledge([ev1.eventId]);
      expect(ackResult.removedCount).toBe(1);
      expect(ackResult.remainingCount).toBe(1);

      // Only ev2 remains
      const remaining = outbox.getAllEntries();
      expect(remaining.length).toBe(1);
      expect(remaining[0].event.eventId).toBe(ev2.eventId);

      // Storage also contains only ev2
      const storedArray = JSON.parse(storage.getItem(OUTBOX_STORAGE_KEY)!);
      expect(storedArray.length).toBe(1);
      expect(storedArray[0].event.eventId).toBe(ev2.eventId);
    });

    it('clears storage entry completely when all events are acknowledged', () => {
      const storage = new MockStorage();
      const outbox = new LocalOutbox(storage, 10);

      const ev1 = createDomainEvent({ eventType: 'learn_word', entityType: 'word', entityId: 'w1', payload: { wordId: 'w1', word: 'one', source: 'm', isCustom: false } });
      outbox.enqueue(ev1);

      outbox.acknowledge([ev1.eventId]);
      expect(outbox.getTotalCount()).toBe(0);

      // Storage key must be completely removed (no unnecessary storage footprint)
      expect(storage.getItem(OUTBOX_STORAGE_KEY)).toBeNull();
    });
  });

  // ==========================================================================
  // 7. INVARIANTS & ERROR RESILIENCE
  // ==========================================================================
  describe('7. Invariants & Storage Error Resilience', () => {
    it('gracefully handles storage setItem throwing QuotaExceededError without crashing caller', () => {
      const failingStorage = new MockStorage();
      vi.spyOn(failingStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const outbox = new LocalOutbox(failingStorage, 10);
      const ev1 = createDomainEvent({ eventType: 'learn_word', entityType: 'word', entityId: 'w1', payload: { wordId: 'w1', word: 'one', source: 'm', isCustom: false } });

      // Enqueue must not throw!
      expect(() => {
        const res = outbox.enqueue(ev1);
        expect(res.success).toBe(true);
      }).not.toThrow();

      // State is preserved in memory
      expect(outbox.getTotalCount()).toBe(1);
    });

    it('drops corrupted storage entries safely during load', () => {
      const corruptedStorage = new MockStorage();
      corruptedStorage.setItem(
        OUTBOX_STORAGE_KEY,
        JSON.stringify([
          { event: { broken: 'malformed_event' }, status: 'pending' },
          { not_even_an_event: true },
        ])
      );

      const outbox = new LocalOutbox(corruptedStorage, 10);
      expect(outbox.getTotalCount()).toBe(0);
    });
  });
});
