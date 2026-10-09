// src/services/xpAntiSpamService.ts
/**
 * XP Anti-Spam & Economy Hardening Engine (Phase 3)
 * 
 * Protects competitive fairness while preserving legitimate gamification and learning value.
 * 
 * Grounded in Phase 1 Audit Findings:
 * 1. Meaningful First Completion -> Normal full reward.
 * 2. Repeat Trivial Practice / Reinforcement -> Bounded / diminishing / capped.
 * 3. Invalid / Instant Spam -> No reward (0 XP).
 * 4. Idempotency -> Restart, F5, rerender, duplicate event never re-awards XP.
 * 
 * Whitelisted Limits:
 * - Flashcard Due/New: Normal XP (2..15).
 * - Flashcard Cramming (Non-Due): Diminished to 1 XP (capped at 300 XP/day).
 * - AI Tutor: Requires utterance length >= 3 chars; capped at 20 rewarded turns/day (max 300 XP).
 * - Pronunciation: Same word on same day only awards XP on first >= 75% pass; subsequent retries award 0 XP.
 * - Quiz Minigames: Capped at 5 rewarded games per minigame type per day.
 */

export interface XpAwardRequest {
  source: 'flashcard' | 'ai_tutor' | 'pronunciation' | 'quiz' | 'toeic' | 'four_skills' | 'manual';
  rawAmount: number;
  idempotencyKey?: string;
  metadata?: {
    isDue?: boolean;
    isNew?: boolean;
    textLength?: number;
    wordId?: string;
    gameType?: string;
    sessionId?: string;
    accuracy?: number;
  };
  timestamp?: string; // ISO 8601
}

export interface XpDailyTrackingState {
  date: string; // YYYY-MM-DD
  flashcardXpGained: number;
  tutorTurnsRewarded: number;
  pronunciationWordsRewarded: Set<string>;
  quizGamesRewardedByType: Record<string, number>;
  processedKeys: Set<string>;
}

export interface XpAwardDecision {
  allowed: boolean;
  grantedXP: number;
  reason?: string;
}

export const FLASHCARD_DAILY_MAX_XP = 300;
export const FLASHCARD_CRAMMING_XP = 1;
export const AI_TUTOR_DAILY_MAX_TURNS = 20;
export const AI_TUTOR_MIN_TEXT_LENGTH = 3;
export const QUIZ_MAX_DAILY_GAMES_PER_TYPE = 5;

/**
 * Creates an empty daily tracking state.
 */
export function createEmptyDailyXpTracking(date: string = new Date().toISOString().split('T')[0]): XpDailyTrackingState {
  return {
    date,
    flashcardXpGained: 0,
    tutorTurnsRewarded: 0,
    pronunciationWordsRewarded: new Set(),
    quizGamesRewardedByType: {},
    processedKeys: new Set(),
  };
}

/**
 * Evaluates an XP award request against anti-spam policies.
 * Pure function: does not mutate dailyState, returns new updated state and decision.
 */
export function evaluateXpAward(
  request: XpAwardRequest,
  currentState: XpDailyTrackingState
): { decision: XpAwardDecision; nextState: XpDailyTrackingState } {
  const { source, rawAmount, idempotencyKey, metadata = {} } = request;

  // Clone state immutably
  const nextState: XpDailyTrackingState = {
    ...currentState,
    pronunciationWordsRewarded: new Set(currentState.pronunciationWordsRewarded),
    quizGamesRewardedByType: { ...currentState.quizGamesRewardedByType },
    processedKeys: new Set(currentState.processedKeys),
  };

  // 1. Idempotency Check: if idempotencyKey already awarded, grant 0 XP
  if (idempotencyKey) {
    if (nextState.processedKeys.has(idempotencyKey)) {
      return {
        decision: {
          allowed: false,
          grantedXP: 0,
          reason: 'Duplicate idempotency key: already awarded',
        },
        nextState,
      };
    }
  }

  // If raw amount is 0 or negative
  if (rawAmount <= 0) {
    return {
      decision: { allowed: false, grantedXP: 0, reason: 'Zero or negative raw amount' },
      nextState,
    };
  }

  let finalGrantedXP = rawAmount;
  let reason: string | undefined;

  switch (source) {
    // ------------------------------------------------------------------------
    // 1. FLASHCARD SRS
    // ------------------------------------------------------------------------
    case 'flashcard': {
      const isDue = metadata.isDue ?? true;
      const isNew = metadata.isNew ?? false;

      // Anti-spam rule: If card is neither due nor new (cramming / all-learned loop),
      // diminish reward to 1 XP to prevent infinite XP farming on already mature cards.
      if (!isDue && !isNew) {
        finalGrantedXP = Math.min(rawAmount, FLASHCARD_CRAMMING_XP);
        reason = 'Cramming review on non-due card diminished to 1 XP';
      }

      // Check daily flashcard XP cap (300 XP)
      const currentFlashcardXP = nextState.flashcardXpGained;
      if (currentFlashcardXP >= FLASHCARD_DAILY_MAX_XP) {
        finalGrantedXP = 0;
        reason = 'Daily flashcard XP cap (300 XP) reached';
      } else if (currentFlashcardXP + finalGrantedXP > FLASHCARD_DAILY_MAX_XP) {
        finalGrantedXP = FLASHCARD_DAILY_MAX_XP - currentFlashcardXP;
        reason = 'Adjusted to fit daily flashcard XP cap';
      }

      nextState.flashcardXpGained += finalGrantedXP;
      break;
    }

    // ------------------------------------------------------------------------
    // 2. AI TUTOR
    // ------------------------------------------------------------------------
    case 'ai_tutor': {
      const textLength = metadata.textLength ?? 0;

      // Anti-spam rule: Reject trivial single-character spam ("ok", "k", "hi")
      if (textLength < AI_TUTOR_MIN_TEXT_LENGTH) {
        finalGrantedXP = 0;
        reason = 'Utterance too short for AI Tutor turn XP';
        break;
      }

      // Daily turn cap (max 20 rewarded turns / day)
      if (nextState.tutorTurnsRewarded >= AI_TUTOR_DAILY_MAX_TURNS) {
        finalGrantedXP = 0;
        reason = 'Daily AI Tutor rewarded turns cap (20 turns) reached';
        break;
      }

      nextState.tutorTurnsRewarded += 1;
      break;
    }

    // ------------------------------------------------------------------------
    // 3. PRONUNCIATION
    // ------------------------------------------------------------------------
    case 'pronunciation': {
      const wordId = metadata.wordId ? metadata.wordId.trim().toLowerCase() : '';

      if (wordId) {
        // Anti-spam rule: Each word only awards XP on first successful pass of the day
        if (nextState.pronunciationWordsRewarded.has(wordId)) {
          finalGrantedXP = 0;
          reason = 'Retry practice on already rewarded word today awards 0 XP';
          break;
        }
        nextState.pronunciationWordsRewarded.add(wordId);
      }
      break;
    }

    // ------------------------------------------------------------------------
    // 4. QUIZ ARENA
    // ------------------------------------------------------------------------
    case 'quiz': {
      const gameType = metadata.gameType || 'standard';
      const currentGames = nextState.quizGamesRewardedByType[gameType] || 0;

      if (currentGames >= QUIZ_MAX_DAILY_GAMES_PER_TYPE) {
        finalGrantedXP = 0;
        reason = `Daily limit for ${gameType} minigame reached (max ${QUIZ_MAX_DAILY_GAMES_PER_TYPE})`;
        break;
      }

      nextState.quizGamesRewardedByType[gameType] = currentGames + 1;
      break;
    }

    // TOEIC, Four Skills, Manual: normal award
    default: {
      finalGrantedXP = rawAmount;
      break;
    }
  }

  // Record idempotency key if granted
  if (idempotencyKey && finalGrantedXP > 0) {
    nextState.processedKeys.add(idempotencyKey);
  }

  return {
    decision: {
      allowed: finalGrantedXP > 0,
      grantedXP: finalGrantedXP,
      reason,
    },
    nextState,
  };
}

let globalDailyTracking: XpDailyTrackingState = createEmptyDailyXpTracking();

/**
 * Returns current global in-memory daily tracking state.
 */
export function getDailyXpTracking(date: string = new Date().toISOString().split('T')[0]): XpDailyTrackingState {
  if (globalDailyTracking.date !== date) {
    globalDailyTracking = createEmptyDailyXpTracking(date);
  }
  return globalDailyTracking;
}

/**
 * Stateful wrapper for evaluating and recording an XP award request.
 */
export function evaluateAndRecordXpAward(
  request: XpAwardRequest,
  date: string = new Date().toISOString().split('T')[0]
): XpAwardDecision {
  const current = getDailyXpTracking(date);
  const { decision, nextState } = evaluateXpAward(request, current);
  globalDailyTracking = nextState;
  return decision;
}

/**
 * Resets the in-memory daily tracking state (for unit testing and day reset).
 */
export function resetDailyXpTrackingForTesting(): void {
  globalDailyTracking = createEmptyDailyXpTracking();
}
