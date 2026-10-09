// src/services/completeQuizEventService.ts

import { localOutbox, LocalOutbox } from './localOutboxService';
import { createDomainEvent, generateIdempotencyKey } from './eventIdentityService';
import { isDomainMigratedToEvents } from './cloudEventSyncService';
import { useCloudSyncStore } from './cloudSyncService';
import type { CompleteQuizPayload, DomainEvent } from '../types/learningEvents';

export interface EmitCompleteQuizEventParams {
  quizId: string;
  quizType: 'word_match' | 'dictation' | 'fill_blank' | 'word_scramble' | 'comprehension' | 'standard';
  totalQuestions: number;
  correctCount: number;
  score: number;
  durationSeconds?: number;
  mistakeCount?: number;
  xpEarned?: number;
  occurredAt?: string;
  idempotencyKey?: string;
  userId?: string | null;
}

export interface EmitCompleteQuizEventResult {
  success: boolean;
  event?: DomainEvent;
  enqueued: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

/**
 * Creates and enqueues a domain event for complete_quiz into the persistent local outbox.
 * 
 * Invariants:
 * 1. Only called AFTER local quiz completion (quizzesCompleted, XP, Mistake Bank) has safely committed.
 * 2. Uses stable quizSessionId / completion identity.
 * 3. Does NOT treat client as trusted authority for arbitrary XP/leaderboard manipulation.
 * 4. Deterministic idempotency key: same quiz completion on multiple devices or retry
 *    resolves to identical idempotency key and prevents duplicate completions or XP farming.
 * 5. Respects feature flag `isDomainMigratedToEvents('completeQuiz')`.
 * 6. Safe and non-blocking: any failure returns a structured result without throwing.
 */
export function emitCompleteQuizEvent(
  params: EmitCompleteQuizEventParams,
  outbox: LocalOutbox = localOutbox
): EmitCompleteQuizEventResult {
  try {
    // 1. Feature Gate check
    if (!isDomainMigratedToEvents('completeQuiz')) {
      return {
        success: true,
        enqueued: false,
        skipped: true,
        reason: 'Domain completeQuiz is not migrated or event sync is disabled',
      };
    }

    // 2. Validation
    if (!params.quizId || typeof params.quizId !== 'string' || !params.quizId.trim()) {
      return {
        success: false,
        enqueued: false,
        error: 'Missing canonical quizId',
      };
    }

    const cleanQuizId = params.quizId.trim();
    const cleanTotal = Math.max(0, Number(params.totalQuestions) || 0);
    const cleanCorrect = Math.max(0, Math.min(cleanTotal, Number(params.correctCount) || 0));
    const cleanScore = Math.max(0, Number(params.score) || 0);
    const cleanMistakes = Math.max(0, Number(params.mistakeCount) || 0);
    
    // Bounds guard: Client XP is evidence-only, capped to prevent absurdity
    const cleanXpEarned = Math.max(0, Math.min(200, Number(params.xpEarned) || 0));

    const occurredAt = params.occurredAt || new Date().toISOString();
    const resolvedUserId = params.userId !== undefined ? params.userId : useCloudSyncStore.getState().userId;
    const idempotencyKey = params.idempotencyKey || generateIdempotencyKey('complete_quiz', cleanQuizId, 'completion');

    const payload: CompleteQuizPayload = {
      quizId: cleanQuizId,
      quizType: params.quizType || 'standard',
      totalQuestions: cleanTotal,
      correctCount: cleanCorrect,
      score: cleanScore,
      durationSeconds: params.durationSeconds !== undefined ? Math.max(0, Number(params.durationSeconds)) : undefined,
      mistakeCount: cleanMistakes,
      xpEarned: cleanXpEarned,
    };

    // 3. Construct domain event
    const event = createDomainEvent({
      eventType: 'complete_quiz',
      entityType: 'quiz',
      entityId: cleanQuizId,
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
    const errorMsg = err instanceof Error ? err.message : 'Unknown complete_quiz event emission error';
    console.warn('[CompleteQuizEventService] Failed to emit complete_quiz event:', errorMsg);
    return {
      success: false,
      enqueued: false,
      error: errorMsg,
    };
  }
}
