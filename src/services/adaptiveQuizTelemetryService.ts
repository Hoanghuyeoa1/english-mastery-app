// src/services/adaptiveQuizTelemetryService.ts
/**
 * Adaptive Quiz Arena Telemetry & Persistence Service (Phase 3)
 * 
 * Responsible for:
 * 1. Bounded telemetry recording (Max 100 recent events in ring buffer).
 * 2. Aggregated metrics calculation (by Category, Difficulty, and Mode).
 * 3. Safe rehydration and serialization with zero NaN / zero undefined.
 * 4. Safe merge logic for cloud sync / backup restore without duplicate explosion.
 * 5. 100% offline, zero network dependencies, pure and deterministic.
 */

import type {
  AdaptiveQuizCategory,
  AdaptiveDifficultyTier,
  ArcadeMode,
  AdaptiveQuizTelemetryItem,
  AdaptiveQuizAggregateStats,
  AdaptiveQuizTelemetryState,
  CategoryTelemetryBreakdown,
  DifficultyTelemetryBreakdown,
  ModeTelemetryBreakdown,
} from '../types';

export const MAX_TELEMETRY_EVENTS = 100;

const DEFAULT_CATEGORY_BREAKDOWN: Record<AdaptiveQuizCategory, CategoryTelemetryBreakdown> = {
  weak: { answered: 0, correct: 0 },
  due: { answered: 0, correct: 0 },
  new: { answered: 0, correct: 0 },
  mastered: { answered: 0, correct: 0 },
};

const DEFAULT_DIFFICULTY_BREAKDOWN: Record<AdaptiveDifficultyTier, DifficultyTelemetryBreakdown> = {
  easy: { answered: 0, correct: 0 },
  normal: { answered: 0, correct: 0 },
  hard: { answered: 0, correct: 0 },
  advanced: { answered: 0, correct: 0 },
};

const DEFAULT_MODE_BREAKDOWN: Record<ArcadeMode, ModeTelemetryBreakdown> = {
  speed_match: { answered: 0, correct: 0 },
  word_scramble: { answered: 0, correct: 0 },
  dictation: { answered: 0, correct: 0 },
  classic_quiz: { answered: 0, correct: 0 },
};

/**
 * Creates fresh, safe default telemetry state.
 */
export function createDefaultAdaptiveQuizTelemetryState(): AdaptiveQuizTelemetryState {
  return {
    recentEvents: [],
    aggregate: {
      totalAnswered: 0,
      totalCorrect: 0,
      totalIncorrect: 0,
      byCategory: {
        weak: { answered: 0, correct: 0 },
        due: { answered: 0, correct: 0 },
        new: { answered: 0, correct: 0 },
        mastered: { answered: 0, correct: 0 },
      },
      byDifficulty: {
        easy: { answered: 0, correct: 0 },
        normal: { answered: 0, correct: 0 },
        hard: { answered: 0, correct: 0 },
        advanced: { answered: 0, correct: 0 },
      },
      byMode: {
        speed_match: { answered: 0, correct: 0 },
        word_scramble: { answered: 0, correct: 0 },
        dictation: { answered: 0, correct: 0 },
        classic_quiz: { answered: 0, correct: 0 },
      },
      lastSessionAt: undefined,
    },
  };
}

/**
 * Pure sanitizer ensuring robust rehydration even from corrupted, partial, or legacy storage.
 * Eliminates all NaNs, infinities, undefined fields, and oversized arrays.
 */
export function sanitizeAdaptiveQuizTelemetryState(
  raw?: unknown
): AdaptiveQuizTelemetryState {
  const fallback = createDefaultAdaptiveQuizTelemetryState();
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const rawObj = raw as Partial<AdaptiveQuizTelemetryState>;
  const rawEvents = Array.isArray(rawObj.recentEvents) ? rawObj.recentEvents : [];

  // 1. Sanitize Events Buffer
  const validEvents: AdaptiveQuizTelemetryItem[] = [];
  for (const item of rawEvents) {
    if (!item || typeof item !== 'object') continue;
    const wordId = typeof item.wordId === 'string' ? item.wordId.trim() : '';
    const word = typeof item.word === 'string' ? item.word.trim() : '';
    if (!wordId && !word) continue;

    const validCategory: AdaptiveQuizCategory =
      item.category === 'weak' || item.category === 'due' || item.category === 'new' || item.category === 'mastered'
        ? item.category
        : 'weak';

    const validDifficulty: AdaptiveDifficultyTier =
      item.difficulty === 'easy' || item.difficulty === 'normal' || item.difficulty === 'hard' || item.difficulty === 'advanced'
        ? item.difficulty
        : 'normal';

    const validMode: ArcadeMode =
      item.mode === 'speed_match' || item.mode === 'word_scramble' || item.mode === 'dictation' || item.mode === 'classic_quiz'
        ? item.mode
        : 'classic_quiz';

    const rawTimestamp = Number(item.timestamp);
    const validTimestamp = Number.isFinite(rawTimestamp) && rawTimestamp > 0 ? rawTimestamp : Date.now();
    const validId = typeof item.id === 'string' && item.id.length > 0 ? item.id : `evt_${validTimestamp}_${Math.random().toString(36).slice(2, 7)}`;

    validEvents.push({
      id: validId,
      wordId: wordId || word,
      word: word || wordId,
      isCorrect: Boolean(item.isCorrect),
      category: validCategory,
      difficulty: validDifficulty,
      mode: validMode,
      timestamp: validTimestamp,
    });
  }

  // Ring buffer: Cap to MAX_TELEMETRY_EVENTS
  const boundedEvents = validEvents.slice(-MAX_TELEMETRY_EVENTS);

  // 2. Sanitize Aggregates
  const rawAgg = (rawObj.aggregate && typeof rawObj.aggregate === 'object' ? rawObj.aggregate : {}) as any;

  const safeNum = (val: unknown): number => {
    const num = Number(val);
    return Number.isFinite(num) && num >= 0 ? Math.floor(num) : 0;
  };

  const aggregate: AdaptiveQuizAggregateStats = {
    totalAnswered: safeNum(rawAgg.totalAnswered),
    totalCorrect: safeNum(rawAgg.totalCorrect),
    totalIncorrect: safeNum(rawAgg.totalIncorrect),
    byCategory: {
      weak: {
        answered: safeNum(rawAgg.byCategory?.weak?.answered),
        correct: safeNum(rawAgg.byCategory?.weak?.correct),
      },
      due: {
        answered: safeNum(rawAgg.byCategory?.due?.answered),
        correct: safeNum(rawAgg.byCategory?.due?.correct),
      },
      new: {
        answered: safeNum(rawAgg.byCategory?.new?.answered),
        correct: safeNum(rawAgg.byCategory?.new?.correct),
      },
      mastered: {
        answered: safeNum(rawAgg.byCategory?.mastered?.answered),
        correct: safeNum(rawAgg.byCategory?.mastered?.correct),
      },
    },
    byDifficulty: {
      easy: {
        answered: safeNum(rawAgg.byDifficulty?.easy?.answered),
        correct: safeNum(rawAgg.byDifficulty?.easy?.correct),
      },
      normal: {
        answered: safeNum(rawAgg.byDifficulty?.normal?.answered),
        correct: safeNum(rawAgg.byDifficulty?.normal?.correct),
      },
      hard: {
        answered: safeNum(rawAgg.byDifficulty?.hard?.answered),
        correct: safeNum(rawAgg.byDifficulty?.hard?.correct),
      },
      advanced: {
        answered: safeNum(rawAgg.byDifficulty?.advanced?.answered),
        correct: safeNum(rawAgg.byDifficulty?.advanced?.correct),
      },
    },
    byMode: {
      speed_match: {
        answered: safeNum(rawAgg.byMode?.speed_match?.answered),
        correct: safeNum(rawAgg.byMode?.speed_match?.correct),
      },
      word_scramble: {
        answered: safeNum(rawAgg.byMode?.word_scramble?.answered),
        correct: safeNum(rawAgg.byMode?.word_scramble?.correct),
      },
      dictation: {
        answered: safeNum(rawAgg.byMode?.dictation?.answered),
        correct: safeNum(rawAgg.byMode?.dictation?.correct),
      },
      classic_quiz: {
        answered: safeNum(rawAgg.byMode?.classic_quiz?.answered),
        correct: safeNum(rawAgg.byMode?.classic_quiz?.correct),
      },
    },
    lastSessionAt: Number.isFinite(Number(rawAgg.lastSessionAt)) ? Number(rawAgg.lastSessionAt) : undefined,
  };

  // Reconciliation: If aggregate numbers were 0 or missing but events exist, recalculate
  if (aggregate.totalAnswered === 0 && boundedEvents.length > 0) {
    for (const evt of boundedEvents) {
      aggregate.totalAnswered += 1;
      if (evt.isCorrect) {
        aggregate.totalCorrect += 1;
        aggregate.byCategory[evt.category].correct += 1;
        aggregate.byDifficulty[evt.difficulty].correct += 1;
        aggregate.byMode[evt.mode].correct += 1;
      } else {
        aggregate.totalIncorrect += 1;
      }
      aggregate.byCategory[evt.category].answered += 1;
      aggregate.byDifficulty[evt.difficulty].answered += 1;
      aggregate.byMode[evt.mode].answered += 1;
    }
  }

  return {
    recentEvents: boundedEvents,
    aggregate,
  };
}

/**
 * Appends a new quiz telemetry event and updates aggregate metrics immutably.
 */
export function recordAdaptiveQuizTelemetryEvent(
  state: AdaptiveQuizTelemetryState,
  input: Omit<AdaptiveQuizTelemetryItem, 'id' | 'timestamp'> & {
    id?: string;
    timestamp?: number;
  }
): AdaptiveQuizTelemetryState {
  const current = sanitizeAdaptiveQuizTelemetryState(state);
  const now = input.timestamp ?? Date.now();
  const eventId = input.id ?? `evt_${now}_${Math.random().toString(36).slice(2, 7)}`;

  const newEvent: AdaptiveQuizTelemetryItem = {
    id: eventId,
    wordId: input.wordId,
    word: input.word,
    isCorrect: Boolean(input.isCorrect),
    category: input.category,
    difficulty: input.difficulty,
    mode: input.mode,
    timestamp: now,
  };

  const nextEvents = [...current.recentEvents, newEvent].slice(-MAX_TELEMETRY_EVENTS);

  const prevAgg = current.aggregate;
  const isCorrect = newEvent.isCorrect;

  const nextAggregate: AdaptiveQuizAggregateStats = {
    ...prevAgg,
    totalAnswered: prevAgg.totalAnswered + 1,
    totalCorrect: prevAgg.totalCorrect + (isCorrect ? 1 : 0),
    totalIncorrect: prevAgg.totalIncorrect + (isCorrect ? 0 : 1),
    byCategory: {
      ...prevAgg.byCategory,
      [newEvent.category]: {
        answered: prevAgg.byCategory[newEvent.category].answered + 1,
        correct: prevAgg.byCategory[newEvent.category].correct + (isCorrect ? 1 : 0),
      },
    },
    byDifficulty: {
      ...prevAgg.byDifficulty,
      [newEvent.difficulty]: {
        answered: prevAgg.byDifficulty[newEvent.difficulty].answered + 1,
        correct: prevAgg.byDifficulty[newEvent.difficulty].correct + (isCorrect ? 1 : 0),
      },
    },
    byMode: {
      ...prevAgg.byMode,
      [newEvent.mode]: {
        answered: prevAgg.byMode[newEvent.mode].answered + 1,
        correct: prevAgg.byMode[newEvent.mode].correct + (isCorrect ? 1 : 0),
      },
    },
    lastSessionAt: now,
  };

  return {
    recentEvents: nextEvents,
    aggregate: nextAggregate,
  };
}

/**
 * Safely merges incoming backup or cloud telemetry into local telemetry.
 * Prevents event duplication and keeps the ring buffer capped at MAX_TELEMETRY_EVENTS.
 */
export function mergeAdaptiveQuizTelemetryState(
  localState: AdaptiveQuizTelemetryState,
  incomingState?: unknown
): AdaptiveQuizTelemetryState {
  const local = sanitizeAdaptiveQuizTelemetryState(localState);
  if (!incomingState) return local;

  const incoming = sanitizeAdaptiveQuizTelemetryState(incomingState);

  // Combine and deduplicate events by id
  const seenIds = new Set<string>();
  const mergedEvents: AdaptiveQuizTelemetryItem[] = [];

  for (const evt of local.recentEvents) {
    if (!seenIds.has(evt.id)) {
      seenIds.add(evt.id);
      mergedEvents.push(evt);
    }
  }

  for (const evt of incoming.recentEvents) {
    if (!seenIds.has(evt.id)) {
      seenIds.add(evt.id);
      mergedEvents.push(evt);
    }
  }

  // Sort chronologically and cap to MAX_TELEMETRY_EVENTS
  mergedEvents.sort((a, b) => a.timestamp - b.timestamp);
  const boundedEvents = mergedEvents.slice(-MAX_TELEMETRY_EVENTS);

  // Take the highest aggregate counters to avoid loss
  const aggregate: AdaptiveQuizAggregateStats = {
    totalAnswered: Math.max(local.aggregate.totalAnswered, incoming.aggregate.totalAnswered),
    totalCorrect: Math.max(local.aggregate.totalCorrect, incoming.aggregate.totalCorrect),
    totalIncorrect: Math.max(local.aggregate.totalIncorrect, incoming.aggregate.totalIncorrect),
    byCategory: {
      weak: {
        answered: Math.max(local.aggregate.byCategory.weak.answered, incoming.aggregate.byCategory.weak.answered),
        correct: Math.max(local.aggregate.byCategory.weak.correct, incoming.aggregate.byCategory.weak.correct),
      },
      due: {
        answered: Math.max(local.aggregate.byCategory.due.answered, incoming.aggregate.byCategory.due.answered),
        correct: Math.max(local.aggregate.byCategory.due.correct, incoming.aggregate.byCategory.due.correct),
      },
      new: {
        answered: Math.max(local.aggregate.byCategory.new.answered, incoming.aggregate.byCategory.new.answered),
        correct: Math.max(local.aggregate.byCategory.new.correct, incoming.aggregate.byCategory.new.correct),
      },
      mastered: {
        answered: Math.max(local.aggregate.byCategory.mastered.answered, incoming.aggregate.byCategory.mastered.answered),
        correct: Math.max(local.aggregate.byCategory.mastered.correct, incoming.aggregate.byCategory.mastered.correct),
      },
    },
    byDifficulty: {
      easy: {
        answered: Math.max(local.aggregate.byDifficulty.easy.answered, incoming.aggregate.byDifficulty.easy.answered),
        correct: Math.max(local.aggregate.byDifficulty.easy.correct, incoming.aggregate.byDifficulty.easy.correct),
      },
      normal: {
        answered: Math.max(local.aggregate.byDifficulty.normal.answered, incoming.aggregate.byDifficulty.normal.answered),
        correct: Math.max(local.aggregate.byDifficulty.normal.correct, incoming.aggregate.byDifficulty.normal.correct),
      },
      hard: {
        answered: Math.max(local.aggregate.byDifficulty.hard.answered, incoming.aggregate.byDifficulty.hard.answered),
        correct: Math.max(local.aggregate.byDifficulty.hard.correct, incoming.aggregate.byDifficulty.hard.correct),
      },
      advanced: {
        answered: Math.max(local.aggregate.byDifficulty.advanced.answered, incoming.aggregate.byDifficulty.advanced.answered),
        correct: Math.max(local.aggregate.byDifficulty.advanced.correct, incoming.aggregate.byDifficulty.advanced.correct),
      },
    },
    byMode: {
      speed_match: {
        answered: Math.max(local.aggregate.byMode.speed_match.answered, incoming.aggregate.byMode.speed_match.answered),
        correct: Math.max(local.aggregate.byMode.speed_match.correct, incoming.aggregate.byMode.speed_match.correct),
      },
      word_scramble: {
        answered: Math.max(local.aggregate.byMode.word_scramble.answered, incoming.aggregate.byMode.word_scramble.answered),
        correct: Math.max(local.aggregate.byMode.word_scramble.correct, incoming.aggregate.byMode.word_scramble.correct),
      },
      dictation: {
        answered: Math.max(local.aggregate.byMode.dictation.answered, incoming.aggregate.byMode.dictation.answered),
        correct: Math.max(local.aggregate.byMode.dictation.correct, incoming.aggregate.byMode.dictation.correct),
      },
      classic_quiz: {
        answered: Math.max(local.aggregate.byMode.classic_quiz.answered, incoming.aggregate.byMode.classic_quiz.answered),
        correct: Math.max(local.aggregate.byMode.classic_quiz.correct, incoming.aggregate.byMode.classic_quiz.correct),
      },
    },
    lastSessionAt: Math.max(
      local.aggregate.lastSessionAt || 0,
      incoming.aggregate.lastSessionAt || 0
    ) || undefined,
  };

  return {
    recentEvents: boundedEvents,
    aggregate,
  };
}
