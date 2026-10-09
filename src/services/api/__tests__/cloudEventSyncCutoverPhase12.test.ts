// @vitest-environment happy-dom
// src/services/api/__tests__/cloudEventSyncCutoverPhase12.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cloudSyncApi, type IngestLearningEventsResponse } from '../cloudSyncApi';
import {
  processOutboxBatch,
  flushOutboxEventsThroughCoordinator,
  ingestEventsOnServer,
  resetEventSyncConfigForTesting,
  resetEventSyncTelemetryForTesting,
  getEventSyncTelemetry,
} from '../../cloudEventSyncService';
import { LocalOutbox } from '../../localOutboxService';
import { emitReviewCardEvent } from '../../reviewCardEventService';
import { emitLearnWordEvent } from '../../learnWordEventService';
import { emitCompleteQuizEvent } from '../../completeQuizEventService';
import { emitMistakeCreatedEvent } from '../../mistakeCreatedEventService';
import type { DomainEvent } from '../../../types/learningEvents';

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

describe('PHASE 12 — Event Sync Compatibility Boundary & ASP.NET Core Cutover', () => {
  const originalFetch = globalThis.fetch;
  let testOutbox: LocalOutbox;

  beforeEach(() => {
    vi.restoreAllMocks();
    resetEventSyncConfigForTesting();
    resetEventSyncTelemetryForTesting();

    const mockStorage = new MockStorage();
    testOutbox = new LocalOutbox(mockStorage);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('1. Transport Cutover to ASP.NET Core API (/api/sync/events)', () => {
    it('cloudSyncApi.ingestEvents transmits batch via POST /api/sync/events', async () => {
      let capturedUrl = '';
      let capturedMethod = '';
      let capturedBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        capturedUrl = url;
        capturedMethod = init?.method;
        capturedBody = JSON.parse(init?.body);

        const mockResponse: IngestLearningEventsResponse = {
          success: true,
          received_count: 1,
          applied_count: 1,
          duplicate_count: 0,
          rejected_count: 0,
          server_now: '2026-10-08T10:00:00Z',
          results: [
            {
              event_id: 'ev-test-1',
              status: 'applied',
              code: 'EVENT_APPLIED',
              message: 'Sự kiện đã được ghi nhận thành công.',
            },
          ],
        };

        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const sampleEvent: DomainEvent = {
        eventId: 'ev-test-1',
        eventType: 'review_card',
        entityType: 'card',
        entityId: 'word_ubiquitous',
        userId: 'user-123',
        deviceId: 'dev-web',
        idempotencyKey: 'idemp-1',
        schemaVersion: 1,
        occurredAt: '2026-10-08T09:00:00Z',
        payload: {
          cardId: 'c1',
          wordText: 'ubiquitous',
          grade: 2,
          rating: 'good',
          algorithm: 'sm2',
          intervalBefore: 1,
          intervalAfter: 6,
          repetitionBefore: 1,
          repetitionAfter: 2,
          easeFactorBefore: 2.5,
          easeFactorAfter: 2.6,
        },
      };

      const res = await cloudSyncApi.ingestEvents([sampleEvent]);

      expect(capturedUrl).toContain('/api/sync/events');
      expect(capturedMethod).toBe('POST');
      expect(capturedBody.events).toHaveLength(1);
      expect(capturedBody.events[0].eventId).toBe('ev-test-1');
      expect(res.success).toBe(true);
      expect(res.applied_count).toBe(1);
      expect(res.results?.[0].status).toBe('applied');
    });

    it('ingestEventsOnServer delegates directly to cloudSyncApi.ingestEvents', async () => {
      const ingestSpy = vi.spyOn(cloudSyncApi, 'ingestEvents').mockResolvedValueOnce({
        success: true,
        received_count: 1,
        applied_count: 1,
        duplicate_count: 0,
        rejected_count: 0,
        results: [{ event_id: 'ev-2', status: 'applied', code: 'EVENT_APPLIED' }],
      });

      const event: DomainEvent = {
        eventId: 'ev-2',
        eventType: 'learn_word',
        entityType: 'word',
        entityId: 'word_profound',
        userId: null,
        deviceId: 'dev-1',
        idempotencyKey: 'idemp-2',
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
        payload: {
          wordId: 'word_profound',
          word: 'profound',
          source: 'dictionary',
          isCustom: false,
        },
      };

      const response = await ingestEventsOnServer([event]);

      expect(ingestSpy).toHaveBeenCalledTimes(1);
      expect(response.success).toBe(true);
      expect(response.applied_count).toBe(1);
    });
  });

  describe('2. Local-First & Outbox Granular ACK Lifecycle', () => {
    it('processOutboxBatch acknowledges applied and already_processed events, purging them from outbox', async () => {
      const ev1: DomainEvent = {
        eventId: 'ev-batch-1',
        eventType: 'review_card',
        entityType: 'card',
        entityId: 'w1',
        userId: null,
        deviceId: 'd1',
        idempotencyKey: 'k1',
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
        payload: {
          cardId: 'c1',
          wordText: 'w1',
          grade: 1,
          rating: 'hard',
          algorithm: 'sm2',
          intervalBefore: 0,
          intervalAfter: 1,
          repetitionBefore: 0,
          repetitionAfter: 1,
          easeFactorBefore: 2.5,
          easeFactorAfter: 2.36,
        },
      };

      const ev2: DomainEvent = {
        eventId: 'ev-batch-2',
        eventType: 'complete_quiz',
        entityType: 'quiz',
        entityId: 'q1',
        userId: null,
        deviceId: 'd1',
        idempotencyKey: 'k2',
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
        payload: {
          quizId: 'q1',
          quizType: 'dictation',
          totalQuestions: 5,
          correctCount: 4,
          score: 80,
          mistakeCount: 1,
          xpEarned: 20,
        },
      };

      testOutbox.enqueue(ev1);
      testOutbox.enqueue(ev2);
      expect(testOutbox.getPendingCount()).toBe(2);

      vi.spyOn(cloudSyncApi, 'ingestEvents').mockResolvedValueOnce({
        success: true,
        received_count: 2,
        applied_count: 1,
        duplicate_count: 1,
        rejected_count: 0,
        results: [
          { event_id: 'ev-batch-1', status: 'applied', code: 'EVENT_APPLIED' },
          { event_id: 'ev-batch-2', status: 'already_processed', code: 'DUPLICATE_EVENT' },
        ],
      });

      const batchRes = await processOutboxBatch(testOutbox, 50);

      expect(batchRes.attemptedCount).toBe(2);
      expect(batchRes.acknowledgedCount).toBe(2);
      expect(batchRes.acknowledgedEventIds).toContain('ev-batch-1');
      expect(batchRes.acknowledgedEventIds).toContain('ev-batch-2');
      expect(testOutbox.getPendingCount()).toBe(0);
      expect(testOutbox.getTotalCount()).toBe(0);
    });

    it('network failure reverts in-flight sending lease to pending without rolling back local data', async () => {
      const ev: DomainEvent = {
        eventId: 'ev-fail-1',
        eventType: 'mistake_created',
        entityType: 'mistake',
        entityId: 'm1',
        userId: null,
        deviceId: 'd1',
        idempotencyKey: 'km1',
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
        payload: {
          mistakeId: 'm1',
          wordId: 'w1',
          word: 'spelling_error',
          source: 'quiz',
          mistakeType: 'spelling',
        },
      };

      testOutbox.enqueue(ev);
      expect(testOutbox.getPendingCount()).toBe(1);

      vi.spyOn(cloudSyncApi, 'ingestEvents').mockRejectedValueOnce(new Error('Network offline or ECONNREFUSED'));

      const batchRes = await processOutboxBatch(testOutbox, 50);

      expect(batchRes.attemptedCount).toBe(1);
      expect(batchRes.acknowledgedCount).toBe(0);
      expect(batchRes.retryableCount).toBe(1);
      expect(batchRes.retryableEventIds).toContain('ev-fail-1');
      // Local-first invariant: event remains safely queued for next retry
      expect(testOutbox.getPendingCount()).toBe(1);
      const telemetry = getEventSyncTelemetry(testOutbox);
      expect(telemetry.pendingCount).toBe(1);
    });

    it('rejected poison pill events are discarded from outbox to prevent blocking queue', async () => {
      const serverRejectedEv: DomainEvent = {
        eventId: 'ev-server-rejected',
        eventType: 'review_card',
        entityType: 'card',
        entityId: 'w1',
        userId: null,
        deviceId: 'd1',
        idempotencyKey: 'k-rej',
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
        payload: {
          cardId: 'c1',
          wordText: 'w1',
          grade: 1,
          rating: 'hard',
          algorithm: 'sm2',
          intervalBefore: 0,
          intervalAfter: 1,
          repetitionBefore: 0,
          repetitionAfter: 1,
          easeFactorBefore: 2.5,
          easeFactorAfter: 2.36,
        },
      };

      testOutbox.enqueue(serverRejectedEv);
      expect(testOutbox.getPendingCount()).toBe(1);

      vi.spyOn(cloudSyncApi, 'ingestEvents').mockResolvedValueOnce({
        success: true,
        received_count: 1,
        applied_count: 0,
        duplicate_count: 0,
        rejected_count: 1,
        results: [
          {
            event_id: 'ev-server-rejected',
            status: 'rejected',
            code: 'NON_RETRYABLE_BUSINESS_ERROR',
            message: 'Thẻ từ vựng đã bị xóa hoặc không hợp lệ trên máy chủ.',
          },
        ],
      });

      const batchRes = await processOutboxBatch(testOutbox, 50);

      expect(batchRes.rejectedCount).toBe(1);
      expect(batchRes.rejectedEventIds).toContain('ev-server-rejected');
      expect(testOutbox.getPendingCount()).toBe(0);
      expect(testOutbox.getTotalCount()).toBe(0);
    });

  });

  describe('3. Protection of All 4 Migrated Event Domains', () => {
    it('emits and enqueues domain events across all 4 learning domains into single outbox', () => {
      // 1. Domain: review_card
      const revRes = emitReviewCardEvent(
        {
          cardId: 'c-rev-1',
          wordText: 'tenacity',
          grade: 3,
          rating: 'easy',
          algorithm: 'sm2',
          intervalBefore: 3,
          intervalAfter: 7,
          repetitionBefore: 2,
          repetitionAfter: 3,
          easeFactorBefore: 2.5,
          easeFactorAfter: 2.6,
        },
        testOutbox
      );
      expect(revRes.success).toBe(true);
      expect(revRes.enqueued).toBe(true);
      expect(revRes.event?.eventType).toBe('review_card');

      // 2. Domain: learn_word
      const learnRes = emitLearnWordEvent(
        {
          wordId: 'w-learn-1',
          word: 'diligent',
          source: 'reading',
          isCustom: false,
        },
        testOutbox
      );
      expect(learnRes.success).toBe(true);
      expect(learnRes.enqueued).toBe(true);
      expect(learnRes.event?.eventType).toBe('learn_word');

      // 3. Domain: complete_quiz
      const quizRes = emitCompleteQuizEvent(
        {
          quizId: 'q-complete-1',
          quizType: 'word_match',
          totalQuestions: 10,
          correctCount: 9,
          score: 90,
          mistakeCount: 1,
          xpEarned: 25,
        },
        testOutbox
      );
      expect(quizRes.success).toBe(true);
      expect(quizRes.enqueued).toBe(true);
      expect(quizRes.event?.eventType).toBe('complete_quiz');

      // 4. Domain: mistake_created
      const mistakeRes = emitMistakeCreatedEvent(
        {
          mistakeId: 'm-created-1',
          wordId: 'w-learn-1',
          word: 'diligent',
          source: 'quiz',
          mistakeType: 'spelling',
          userAnswer: 'dilligent',
          expectedAnswer: 'diligent',
        },
        testOutbox
      );
      expect(mistakeRes.success).toBe(true);
      expect(mistakeRes.enqueued).toBe(true);
      expect(mistakeRes.event?.eventType).toBe('mistake_created');

      // Single outbox contains all 4 events - NO SECOND OUTBOX!
      expect(testOutbox.getPendingCount()).toBe(4);
      expect(testOutbox.getTotalCount()).toBe(4);
    });

    it('coordinator flush drains all 4 domain events through ASP.NET Core API', async () => {
      // Enqueue 4 events
      emitReviewCardEvent(
        {
          cardId: 'c1',
          wordText: 'w1',
          grade: 2,
          rating: 'good',
          algorithm: 'sm2',
          intervalBefore: 1,
          intervalAfter: 4,
          repetitionBefore: 1,
          repetitionAfter: 2,
          easeFactorBefore: 2.5,
          easeFactorAfter: 2.5,
        },
        testOutbox
      );
      emitLearnWordEvent(
        {
          wordId: 'w2',
          word: 'w2',
          source: 'dictionary',
          isCustom: false,
        },
        testOutbox
      );
      emitCompleteQuizEvent(
        {
          quizId: 'q1',
          quizType: 'dictation',
          totalQuestions: 5,
          correctCount: 5,
          score: 100,
          mistakeCount: 0,
          xpEarned: 20,
        },
        testOutbox
      );
      emitMistakeCreatedEvent(
        {
          mistakeId: 'm1',
          wordId: 'w2',
          word: 'w2',
          source: 'flashcard',
          mistakeType: 'meaning',
        },
        testOutbox
      );

      expect(testOutbox.getPendingCount()).toBe(4);

      const ingestSpy = vi.spyOn(cloudSyncApi, 'ingestEvents').mockResolvedValueOnce({
        success: true,
        received_count: 4,
        applied_count: 4,
        duplicate_count: 0,
        rejected_count: 0,
        results: [
          { event_id: testOutbox.peekBatch(10)[0].event.eventId, status: 'applied', code: 'EVENT_APPLIED' },
          { event_id: testOutbox.peekBatch(10)[1].event.eventId, status: 'applied', code: 'EVENT_APPLIED' },
          { event_id: testOutbox.peekBatch(10)[2].event.eventId, status: 'applied', code: 'EVENT_APPLIED' },
          { event_id: testOutbox.peekBatch(10)[3].event.eventId, status: 'applied', code: 'EVENT_APPLIED' },
        ],
      });

      const coordinatorRes = await flushOutboxEventsThroughCoordinator(testOutbox);

      expect(ingestSpy).toHaveBeenCalledTimes(1);
      expect(coordinatorRes.attemptedCount).toBe(4);
      expect(coordinatorRes.acknowledgedCount).toBe(4);
      expect(testOutbox.getPendingCount()).toBe(0);
    });
  });
});
