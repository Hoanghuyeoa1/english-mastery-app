// src/services/mistakeCreatedEventService.ts

import { localOutbox, LocalOutbox } from './localOutboxService';
import { createDomainEvent, generateIdempotencyKey } from './eventIdentityService';
import { isDomainMigratedToEvents } from './cloudEventSyncService';
import { useCloudSyncStore } from './cloudSyncService';
import { toCanonicalSource, toCanonicalType } from './adaptiveMistakeService';
import type { MistakeCreatedPayload, DomainEvent } from '../types/learningEvents';
import type { MistakeSource, MistakeType } from '../types';

export interface EmitMistakeCreatedEventParams {
  mistakeId: string;
  wordId?: string;
  word: string;
  source?: MistakeSource | string;
  mistakeType?: MistakeType | string;
  userAnswer?: string;
  expectedAnswer?: string;
  context?: string;
  occurredAt?: string;
  idempotencyKey?: string;
  userId?: string | null;
}

export interface EmitMistakeCreatedEventResult {
  success: boolean;
  event?: DomainEvent;
  enqueued: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

/**
 * Creates and enqueues a domain event for mistake_created into the persistent local outbox.
 * 
 * Invariants:
 * 1. Only called AFTER existing local Mistake Bank SSOT logic has safely created or updated
 *    the mistake record in local state.
 * 2. Emits minimal diagnostic evidence (word, source, type, context), never whole state (< 1 KB).
 * 3. Does not create a second Mistake Bank or scoring/classification engine.
 * 4. Deterministic idempotency: retry, network reconnect, or duplicate delivery of the SAME
 *    mistake event resolves cleanly without incrementing mistake count again.
 * 5. Distinction: a genuine new mistake instance in a separate learning activity creates a
 *    distinct event that is properly recorded and never incorrectly suppressed.
 * 6. Respects feature flag `isDomainMigratedToEvents('mistakeCreated')`.
 * 7. Safe and non-blocking: any failure returns a structured result without throwing.
 */
export function emitMistakeCreatedEvent(
  params: EmitMistakeCreatedEventParams,
  outbox: LocalOutbox = localOutbox
): EmitMistakeCreatedEventResult {
  try {
    // 1. Feature Gate check
    if (!isDomainMigratedToEvents('mistakeCreated')) {
      return {
        success: true,
        enqueued: false,
        skipped: true,
        reason: 'Domain mistakeCreated is not migrated or event sync is disabled',
      };
    }

    // 2. Validation
    if (!params.mistakeId || typeof params.mistakeId !== 'string' || !params.mistakeId.trim()) {
      return {
        success: false,
        enqueued: false,
        error: 'Missing canonical mistakeId',
      };
    }

    if (!params.word || typeof params.word !== 'string' || !params.word.trim()) {
      return {
        success: false,
        enqueued: false,
        error: 'Missing canonical word text',
      };
    }

    const cleanMistakeId = params.mistakeId.trim();
    const cleanWordId = (params.wordId && typeof params.wordId === 'string' && params.wordId.trim()) || cleanMistakeId;
    const cleanWord = params.word.trim();
    const canonicalSource = toCanonicalSource(params.source || 'custom');
    const canonicalType = toCanonicalType(params.mistakeType as MistakeType, canonicalSource);

    const occurredAt = params.occurredAt || new Date().toISOString();
    const resolvedUserId = params.userId !== undefined ? params.userId : useCloudSyncStore.getState().userId;
    const idempotencyKey = params.idempotencyKey || generateIdempotencyKey('mistake_created', cleanMistakeId);

    const payload: MistakeCreatedPayload = {
      mistakeId: cleanMistakeId,
      wordId: cleanWordId,
      word: cleanWord,
      source: canonicalSource,
      mistakeType: canonicalType,
      userAnswer: params.userAnswer ? params.userAnswer.slice(0, 150) : undefined,
      expectedAnswer: params.expectedAnswer ? params.expectedAnswer.slice(0, 150) : undefined,
      context: params.context ? params.context.slice(0, 200) : undefined,
    };

    // 3. Construct domain event
    const event = createDomainEvent({
      eventType: 'mistake_created',
      entityType: 'mistake',
      entityId: cleanMistakeId,
      userId: resolvedUserId,
      idempotencyKey,
      occurredAt,
      payload,
    });

    // 4. Enqueue into local outbox
    const enqueueResult = outbox.enqueue(event);

    return {
      success: enqueueResult.success,
      event,
      enqueued: enqueueResult.enqueued,
      skipped: !enqueueResult.enqueued,
      reason: enqueueResult.enqueued ? undefined : 'Duplicate event or queue rejection',
      error: enqueueResult.error,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown mistake_created event emission error';
    console.warn('[MistakeCreatedEventService] Failed to emit mistake_created event:', errorMsg);
    return {
      success: false,
      enqueued: false,
      error: errorMsg,
    };
  }
}
