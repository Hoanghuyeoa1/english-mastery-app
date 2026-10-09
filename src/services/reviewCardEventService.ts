// src/services/reviewCardEventService.ts

import { localOutbox, LocalOutbox } from './localOutboxService';
import { createDomainEvent, generateIdempotencyKey } from './eventIdentityService';
import { isDomainMigratedToEvents } from './cloudEventSyncService';
import { useCloudSyncStore } from './cloudSyncService';
import type { ReviewCardPayload, DomainEvent } from '../types/learningEvents';
import type { SRSGrade } from '../types';

export interface EmitReviewCardEventParams {
  cardId: string;
  wordText: string;
  grade: SRSGrade;
  rating: 'again' | 'hard' | 'good' | 'easy';
  algorithm: 'fsrs' | 'sm2';
  reviewMode?: 'due_today' | 'today_learned' | 'all_learned' | 'standard';
  intervalBefore: number;
  intervalAfter: number;
  repetitionBefore: number;
  repetitionAfter: number;
  easeFactorBefore: number;
  easeFactorAfter: number;
  stability?: number;
  difficulty?: number;
  retrievability?: number;
  nextReviewDate?: string;
  durationMs?: number;
  occurredAt?: string;
  idempotencyKey?: string;
  sessionId?: string;
  userId?: string | null;
}

export interface EmitReviewCardEventResult {
  success: boolean;
  event?: DomainEvent;
  enqueued: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

/**
 * Creates and enqueues a domain event for review_card into the persistent local outbox.
 * 
 * Invariants:
 * 1. Only called AFTER local review logic (FSRS/SM-2, XP, Mistake Bank) has safely committed.
 * 2. Does NOT re-calculate or mutate any learning scheduler state.
 * 3. Idempotent: duplicate emissions with same idempotencyKey or eventId are safely ignored.
 * 4. Respects feature flag `isDomainMigratedToEvents('flashcardReview')`.
 * 5. Safe and non-blocking: any failure returns a structured result without throwing.
 */
export function emitReviewCardEvent(
  params: EmitReviewCardEventParams,
  outbox: LocalOutbox = localOutbox
): EmitReviewCardEventResult {
  try {
    // 1. Feature Gate check
    if (!isDomainMigratedToEvents('flashcardReview')) {
      return {
        success: true,
        enqueued: false,
        skipped: true,
        reason: 'Domain flashcardReview is not migrated or event sync is disabled',
      };
    }

    // 2. Minimal validation
    if (!params.cardId || !params.wordText) {
      return {
        success: false,
        enqueued: false,
        error: 'Missing canonical cardId or wordText',
      };
    }

    const occurredAt = params.occurredAt || new Date().toISOString();
    const resolvedUserId = params.userId !== undefined ? params.userId : useCloudSyncStore.getState().userId;
    const idempotencyKey = params.idempotencyKey || generateIdempotencyKey('review_card', params.cardId, occurredAt);

    const payload: ReviewCardPayload = {
      cardId: params.cardId,
      wordText: params.wordText,
      grade: params.grade,
      rating: params.rating,
      algorithm: params.algorithm,
      reviewMode: params.reviewMode,
      intervalBefore: params.intervalBefore,
      intervalAfter: params.intervalAfter,
      repetitionBefore: params.repetitionBefore,
      repetitionAfter: params.repetitionAfter,
      easeFactorBefore: params.easeFactorBefore,
      easeFactorAfter: params.easeFactorAfter,
      stability: params.stability,
      difficulty: params.difficulty,
      retrievability: params.retrievability,
      nextReviewDate: params.nextReviewDate,
      durationMs: params.durationMs,
      sessionId: params.sessionId,
    };

    // 3. Construct domain event
    const event = createDomainEvent({
      eventType: 'review_card',
      entityType: 'card',
      entityId: params.cardId,
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
    const errorMsg = err instanceof Error ? err.message : 'Unknown event emission error';
    console.warn('[ReviewCardEventService] Failed to emit review_card event:', errorMsg);
    return {
      success: false,
      enqueued: false,
      error: errorMsg,
    };
  }
}
