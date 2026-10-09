// src/services/learnWordEventService.ts

import { localOutbox, LocalOutbox } from './localOutboxService';
import { createDomainEvent, generateIdempotencyKey } from './eventIdentityService';
import { isDomainMigratedToEvents } from './cloudEventSyncService';
import { useCloudSyncStore } from './cloudSyncService';
import type { LearnWordPayload, DomainEvent } from '../types/learningEvents';

export interface EmitLearnWordEventParams {
  wordId: string;
  word: string;
  meaning?: string;
  contextSentence?: string;
  source?: string;
  sources?: string[];
  isCustom?: boolean;
  occurredAt?: string;
  idempotencyKey?: string;
  userId?: string | null;
}

export interface EmitLearnWordEventResult {
  success: boolean;
  event?: DomainEvent;
  enqueued: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

/**
 * Creates and enqueues a domain event for learn_word into the persistent local outbox.
 * 
 * Invariants:
 * 1. Only called AFTER local word learning / SRS creation has safely committed to Zustand store.
 * 2. Uses canonical dictionary / lemma identity (resolveCanonicalVocab / cleanWordToken).
 * 3. Does NOT fake FSRS mastery, review completion, or arbitrary XP.
 * 4. Deterministic idempotency key: same word on multiple devices or offline retries resolves
 *    to identical idempotency key and prevents duplicate learned cards.
 * 5. Respects feature flag `isDomainMigratedToEvents('learnWord')`.
 * 6. Safe and non-blocking: any failure returns a structured result without throwing.
 */
export function emitLearnWordEvent(
  params: EmitLearnWordEventParams,
  outbox: LocalOutbox = localOutbox
): EmitLearnWordEventResult {
  try {
    // 1. Feature Gate check
    if (!isDomainMigratedToEvents('learnWord')) {
      return {
        success: true,
        enqueued: false,
        skipped: true,
        reason: 'Domain learnWord is not migrated or event sync is disabled',
      };
    }

    // 2. Minimal validation
    if (!params.wordId || !params.word) {
      return {
        success: false,
        enqueued: false,
        error: 'Missing canonical wordId or word text',
      };
    }

    const occurredAt = params.occurredAt || new Date().toISOString();
    const resolvedUserId = params.userId !== undefined ? params.userId : useCloudSyncStore.getState().userId;
    const idempotencyKey = params.idempotencyKey || generateIdempotencyKey('learn_word', params.wordId, 'canonical');

    const primarySource = (params.source || (params.sources && params.sources[0]) || 'dictionary').toLowerCase().trim();
    const cleanSources = params.sources && params.sources.length > 0
      ? Array.from(new Set(params.sources.map((s) => s.toLowerCase().trim()).filter(Boolean)))
      : [primarySource];

    const payload: LearnWordPayload = {
      wordId: params.wordId,
      word: params.word.trim(),
      meaning: params.meaning?.trim() || undefined,
      contextSentence: params.contextSentence?.trim() || undefined,
      source: primarySource,
      sources: cleanSources,
      isCustom: Boolean(params.isCustom),
    };

    // 3. Construct domain event
    const event = createDomainEvent({
      eventType: 'learn_word',
      entityType: 'word',
      entityId: params.wordId,
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
    const errorMsg = err instanceof Error ? err.message : 'Unknown learn_word event emission error';
    console.warn('[LearnWordEventService] Failed to emit learn_word event:', errorMsg);
    return {
      success: false,
      enqueued: false,
      error: errorMsg,
    };
  }
}
