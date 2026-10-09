// src/types/learningEvents.ts

/**
 * Schema version for learning domain events.
 * Used for forward and backward compatibility guards across client/server.
 */
export const LEARNING_EVENT_SCHEMA_VERSION = 1;

/**
 * Discriminated event types supported by the Event Sync layer.
 */
export type DomainEventType =
  | 'review_card'
  | 'learn_word'
  | 'complete_quiz'
  | 'mistake_created';

export type DomainEntityType = 'card' | 'word' | 'quiz' | 'mistake';

/**
 * 1. Payload: Review Card Event (Flashcard / SRS Review)
 * Contains minimal evidence metadata for SRS / FSRS recalculation/audit.
 * Does NOT clone full card, deck, or session state.
 */
export interface ReviewCardPayload {
  cardId: string;
  wordText: string;
  grade: 0 | 1 | 2 | 3; // SRSGrade: 0=Again, 1=Hard, 2=Good, 3=Easy
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
  durationMs?: number;
  nextReviewDate?: string;
  sessionId?: string;
}

/**
 * 2. Payload: Learn Word Event (Vocabulary Saved / Learned)
 * Minimal provenance metadata for word addition to personal vocabulary bank.
 */
export interface LearnWordPayload {
  wordId: string;
  word: string;
  meaning?: string;
  contextSentence?: string;
  source: string; // e.g., 'reading', 'dictionary', 'bulk_import', 'manual', 'ai_tutor'
  sources?: string[];
  isCustom: boolean;
}

/**
 * 3. Payload: Complete Quiz Event (Minigame / Assessment Completed)
 * Minimal evaluation evidence for quiz completion and scoring.
 */
export interface CompleteQuizPayload {
  quizId: string;
  quizType: 'word_match' | 'dictation' | 'fill_blank' | 'word_scramble' | 'comprehension' | 'standard';
  totalQuestions: number;
  correctCount: number;
  score: number;
  durationSeconds?: number;
  mistakeCount: number;
  xpEarned: number;
}

/**
 * 4. Payload: Mistake Created Event (Error captured into Mistake Bank)
 * Minimal diagnostic evidence for learning mistake tracking.
 */
export interface MistakeCreatedPayload {
  mistakeId: string;
  wordId: string;
  word: string;
  source: string; // 'flashcard' | 'quiz' | 'listening' | 'reading' | 'speaking' | 'writing' | 'custom'
  mistakeType: string; // 'meaning' | 'spelling' | 'pronunciation' | 'grammar' | 'collocation' | 'listening' | 'general'
  userAnswer?: string;
  expectedAnswer?: string;
  context?: string;
}

/**
 * Base envelope structure for all domain events.
 */
export interface BaseDomainEvent<TType extends DomainEventType, TEntityType extends DomainEntityType, TPayload> {
  eventId: string;
  eventType: TType;
  entityType: TEntityType;
  entityId: string;
  userId: string | null;
  deviceId: string;
  idempotencyKey: string;
  schemaVersion: number;
  occurredAt: string; // ISO 8601 string
  payload: TPayload;
}

export type ReviewCardEvent = BaseDomainEvent<'review_card', 'card', ReviewCardPayload>;
export type LearnWordEvent = BaseDomainEvent<'learn_word', 'word', LearnWordPayload>;
export type CompleteQuizEvent = BaseDomainEvent<'complete_quiz', 'quiz', CompleteQuizPayload>;
export type MistakeCreatedEvent = BaseDomainEvent<'mistake_created', 'mistake', MistakeCreatedPayload>;

/**
 * Exhaustive discriminated union for Domain Events.
 */
export type DomainEvent =
  | ReviewCardEvent
  | LearnWordEvent
  | CompleteQuizEvent
  | MistakeCreatedEvent;

export interface EventValidationResult {
  valid: boolean;
  event?: DomainEvent;
  error?: string;
}

/**
 * Validates whether an unknown value conforms to the DomainEvent specification.
 * Performs deep, type-safe structural checks without any type assertions.
 */
export function validateDomainEvent(raw: unknown): EventValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Raw event must be a non-null object' };
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.eventId !== 'string' || !obj.eventId.trim()) {
    return { valid: false, error: 'Invalid or missing eventId' };
  }

  if (typeof obj.schemaVersion !== 'number' || obj.schemaVersion !== LEARNING_EVENT_SCHEMA_VERSION) {
    return { valid: false, error: `Unsupported schemaVersion: ${String(obj.schemaVersion)} (expected ${LEARNING_EVENT_SCHEMA_VERSION})` };
  }

  if (typeof obj.deviceId !== 'string' || !obj.deviceId.trim()) {
    return { valid: false, error: 'Invalid or missing deviceId' };
  }

  if (typeof obj.idempotencyKey !== 'string' || !obj.idempotencyKey.trim()) {
    return { valid: false, error: 'Invalid or missing idempotencyKey' };
  }

  if (typeof obj.occurredAt !== 'string' || Number.isNaN(Date.parse(obj.occurredAt))) {
    return { valid: false, error: 'Invalid or missing occurredAt ISO date' };
  }

  if (obj.userId !== null && typeof obj.userId !== 'string') {
    return { valid: false, error: 'userId must be a string or null' };
  }

  if (typeof obj.entityId !== 'string' || !obj.entityId.trim()) {
    return { valid: false, error: 'Invalid or missing entityId' };
  }

  const eventType = obj.eventType;
  const entityType = obj.entityType;
  const payload = obj.payload;

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, error: 'payload must be a non-null object' };
  }

  const p = payload as Record<string, unknown>;

  switch (eventType) {
    case 'review_card': {
      if (entityType !== 'card') {
        return { valid: false, error: `entityType must be 'card' for review_card, got '${String(entityType)}'` };
      }
      if (typeof p.cardId !== 'string' || !p.cardId.trim()) {
        return { valid: false, error: 'ReviewCardPayload: invalid cardId' };
      }
      if (typeof p.wordText !== 'string' || !p.wordText.trim()) {
        return { valid: false, error: 'ReviewCardPayload: invalid wordText' };
      }
      if (p.grade !== 0 && p.grade !== 1 && p.grade !== 2 && p.grade !== 3) {
        return { valid: false, error: 'ReviewCardPayload: grade must be 0, 1, 2, or 3' };
      }
      if (p.rating !== 'again' && p.rating !== 'hard' && p.rating !== 'good' && p.rating !== 'easy') {
        return { valid: false, error: 'ReviewCardPayload: rating must be again, hard, good, or easy' };
      }
      if (p.algorithm !== 'fsrs' && p.algorithm !== 'sm2') {
        return { valid: false, error: 'ReviewCardPayload: algorithm must be fsrs or sm2' };
      }
      if (
        typeof p.intervalBefore !== 'number' ||
        typeof p.intervalAfter !== 'number' ||
        typeof p.repetitionBefore !== 'number' ||
        typeof p.repetitionAfter !== 'number' ||
        typeof p.easeFactorBefore !== 'number' ||
        typeof p.easeFactorAfter !== 'number'
      ) {
        return { valid: false, error: 'ReviewCardPayload: SRS state fields must be numbers' };
      }
      return { valid: true, event: raw as ReviewCardEvent };
    }

    case 'learn_word': {
      if (entityType !== 'word') {
        return { valid: false, error: `entityType must be 'word' for learn_word, got '${String(entityType)}'` };
      }
      if (typeof p.wordId !== 'string' || !p.wordId.trim()) {
        return { valid: false, error: 'LearnWordPayload: invalid wordId' };
      }
      if (typeof p.word !== 'string' || !p.word.trim()) {
        return { valid: false, error: 'LearnWordPayload: invalid word' };
      }
      if (typeof p.source !== 'string' || !p.source.trim()) {
        return { valid: false, error: 'LearnWordPayload: invalid source' };
      }
      if (typeof p.isCustom !== 'boolean') {
        return { valid: false, error: 'LearnWordPayload: isCustom must be boolean' };
      }
      return { valid: true, event: raw as LearnWordEvent };
    }

    case 'complete_quiz': {
      if (entityType !== 'quiz') {
        return { valid: false, error: `entityType must be 'quiz' for complete_quiz, got '${String(entityType)}'` };
      }
      if (typeof p.quizId !== 'string' || !p.quizId.trim()) {
        return { valid: false, error: 'CompleteQuizPayload: invalid quizId' };
      }
      if (
        p.quizType !== 'word_match' &&
        p.quizType !== 'dictation' &&
        p.quizType !== 'fill_blank' &&
        p.quizType !== 'word_scramble' &&
        p.quizType !== 'comprehension' &&
        p.quizType !== 'standard'
      ) {
        return { valid: false, error: 'CompleteQuizPayload: invalid quizType' };
      }
      if (typeof p.totalQuestions !== 'number' || p.totalQuestions < 0) {
        return { valid: false, error: 'CompleteQuizPayload: totalQuestions must be a non-negative number' };
      }
      if (typeof p.correctCount !== 'number' || p.correctCount < 0) {
        return { valid: false, error: 'CompleteQuizPayload: correctCount must be a non-negative number' };
      }
      if (typeof p.score !== 'number' || p.score < 0) {
        return { valid: false, error: 'CompleteQuizPayload: score must be a non-negative number' };
      }
      if (typeof p.xpEarned !== 'number' || p.xpEarned < 0) {
        return { valid: false, error: 'CompleteQuizPayload: xpEarned must be a non-negative number' };
      }
      return { valid: true, event: raw as CompleteQuizEvent };
    }

    case 'mistake_created': {
      if (entityType !== 'mistake') {
        return { valid: false, error: `entityType must be 'mistake' for mistake_created, got '${String(entityType)}'` };
      }
      if (typeof p.mistakeId !== 'string' || !p.mistakeId.trim()) {
        return { valid: false, error: 'MistakeCreatedPayload: invalid mistakeId' };
      }
      if (typeof p.wordId !== 'string' || !p.wordId.trim()) {
        return { valid: false, error: 'MistakeCreatedPayload: invalid wordId' };
      }
      if (typeof p.word !== 'string' || !p.word.trim()) {
        return { valid: false, error: 'MistakeCreatedPayload: invalid word' };
      }
      if (typeof p.source !== 'string' || !p.source.trim()) {
        return { valid: false, error: 'MistakeCreatedPayload: invalid source' };
      }
      if (typeof p.mistakeType !== 'string' || !p.mistakeType.trim()) {
        return { valid: false, error: 'MistakeCreatedPayload: invalid mistakeType' };
      }
      return { valid: true, event: raw as MistakeCreatedEvent };
    }

    default:
      return { valid: false, error: `Unknown eventType: '${String(eventType)}'` };
  }
}

/**
 * Type guard for DomainEvent.
 */
export function isDomainEvent(raw: unknown): raw is DomainEvent {
  return validateDomainEvent(raw).valid;
}
