import {
  DailyProgress,
  FSRSMemoryState,
  FSRSRating,
  FSRSState,
  RatingCountStats,
  SRSAlgorithmType,
  SRSCardState,
  SRSGrade,
  SRSProgress,
  SRSReviewCard,
  SRSReviewRating,
} from '../types';
import { calculateFSRS, DEFAULT_FSRS_SETTINGS } from './fsrsAlgorithm';
import { calculateSM2 } from './srsAlgorithm';

export type { SRSReviewRating, SRSCardState };

export interface UnifiedReviewResult {
  nextReview: string;
  intervalDays: number;
  algorithm: SRSAlgorithmType;
  retrievability?: number;
  stateBefore: SRSCardState;
  stateAfter: SRSCardState;
  stringRating: SRSReviewRating;
  sm2Grade: SRSGrade;
  updatedSm2Progress?: SRSProgress;
  updatedFsrsState?: FSRSMemoryState;
}

export interface SchedulerSettings {
  algorithm: SRSAlgorithmType;
  desiredRetention: number;
}

/**
 * Converts FSRS numeric state enum (0..3) to unified SRSCardState string literal.
 */
export function fsrsStateToCardState(fsrsState?: FSRSState): SRSCardState {
  switch (fsrsState) {
    case 0:
      return 'new';
    case 1:
      return 'learning';
    case 2:
      return 'review';
    case 3:
      return 'relearning';
    default:
      return 'new';
  }
}

/**
 * Converts unified SRSCardState string literal to FSRS numeric state enum.
 */
export function cardStateToFsrsState(cardState: SRSCardState): FSRSState {
  switch (cardState) {
    case 'new':
      return 0;
    case 'learning':
      return 1;
    case 'review':
      return 2;
    case 'relearning':
      return 3;
    default:
      return 0;
  }
}

/**
 * Single Source of Truth helper for card lifecycle state:
 * - If FSRS memory state exists: uses fsrs.state directly (0..3 -> SRSCardState).
 * - For SM-2 / legacy cards: infers state safely based on review history and repetitions.
 * Zero state duplication: state is computed dynamically without persisting redundant fields.
 */
export function getCardUnifiedState(card: {
  srsLevel?: number;
  interval?: number;
  lastReviewedDate?: string;
  firstLearnedAt?: string;
  fsrs?: FSRSMemoryState;
}): SRSCardState {
  if (card.fsrs && typeof card.fsrs.state === 'number') {
    return fsrsStateToCardState(card.fsrs.state);
  }

  const reps = card.srsLevel ?? 0;
  const interval = card.interval ?? 0;
  const hasBeenStudied = Boolean(card.lastReviewedDate || card.firstLearnedAt || reps > 0);

  // Thẻ mới chưa từng học: không có mốc ôn tập và reps = 0, interval = 0
  if (!hasBeenStudied || (reps === 0 && interval === 0)) {
    return 'new';
  }

  // Thẻ đã ổn định vào chu kỳ ôn tập chuẩn
  if (reps >= 2 && interval >= 3) {
    return 'review';
  }

  // Thẻ đã từng học nhưng vừa bị lapse (Again reset srsLevel = 0)
  if (reps === 0 && hasBeenStudied) {
    return 'relearning';
  }

  // Thẻ đang nạp củng cố ban đầu (reps < 2 hoặc interval < 3 ngày)
  return 'learning';
}

/**
 * Infers SM-2 stateAfter directly from previous state context and the updated SM-2 progress.
 * Guarantees zero divergence between SM-2 progress fields and telemetry stateAfter.
 */
export function inferSm2StateAfter(
  stateBefore: SRSCardState,
  updatedProgress: { srsLevel: number; interval: number; lastReviewedDate?: string },
  grade: SRSGrade
): SRSCardState {
  // If user failed (Again: grade 0), SM-2 resets srsLevel = 0, interval = 1
  if (grade === 0) {
    return stateBefore === 'review' ? 'relearning' : 'learning';
  }

  // If card was in relearning and user passes (grade >= 2), graduate to review
  if (stateBefore === 'relearning') {
    return grade >= 2 ? 'review' : 'relearning';
  }

  // Otherwise, derive directly from the updated progress metrics:
  if (updatedProgress.srsLevel >= 2 && updatedProgress.interval >= 3) {
    return 'review';
  }

  // Good/Easy on a new card graduates to review
  if (stateBefore === 'new' && grade >= 2) {
    return 'review';
  }

  return 'learning';
}

/**
 * Backward compatibility alias for calculateSm2NextState
 */
export function calculateSm2NextState(
  currentState: SRSCardState,
  grade: SRSGrade,
  updatedProgress?: { srsLevel: number; interval: number; lastReviewedDate?: string }
): SRSCardState {
  if (updatedProgress) {
    return inferSm2StateAfter(currentState, updatedProgress, grade);
  }
  // Fallback if updatedProgress is not passed
  if (currentState === 'new') {
    return grade >= 2 ? 'review' : 'learning';
  }
  if (currentState === 'learning') {
    return grade >= 2 ? 'review' : 'learning';
  }
  if (currentState === 'review') {
    return grade === 0 ? 'relearning' : 'review';
  }
  if (currentState === 'relearning') {
    return grade >= 2 ? 'review' : 'relearning';
  }
  return 'review';
}

/**
 * Normalizes input ratings between string literals ('again' | 'hard' | 'good' | 'easy')
 * and numeric grades (0 | 1 | 2 | 3) for SM-2 and FSRS-4.5.
 */
export function normalizeRating(rating: SRSReviewRating | SRSGrade): {
  sm2Grade: SRSGrade;
  fsrsRating: FSRSRating;
  stringRating: SRSReviewRating;
} {
  if (typeof rating === 'number') {
    switch (rating) {
      case 0:
        return { sm2Grade: 0, fsrsRating: 1, stringRating: 'again' };
      case 1:
        return { sm2Grade: 1, fsrsRating: 2, stringRating: 'hard' };
      case 2:
        return { sm2Grade: 2, fsrsRating: 3, stringRating: 'good' };
      case 3:
      default:
        return { sm2Grade: 3, fsrsRating: 4, stringRating: 'easy' };
    }
  }

  switch (rating) {
    case 'again':
      return { sm2Grade: 0, fsrsRating: 1, stringRating: 'again' };
    case 'hard':
      return { sm2Grade: 1, fsrsRating: 2, stringRating: 'hard' };
    case 'good':
      return { sm2Grade: 2, fsrsRating: 3, stringRating: 'good' };
    case 'easy':
    default:
      return { sm2Grade: 3, fsrsRating: 4, stringRating: 'easy' };
  }
}

/**
 * Unified SRS Adapter: Processes a card review using either SM-2 or FSRS-4.5.
 * Maintains backwards compatibility by keeping updatedSm2Progress in sync.
 *
 * @param card Current SRSReviewCard
 * @param rating User grade ('again' | 'hard' | 'good' | 'easy' or numeric 0..3)
 * @param settings Scheduling configuration (algorithm, desiredRetention)
 * @param now Timestamp of review (defaults to current Date)
 * @returns UnifiedReviewResult with nextReview, intervalDays, algorithm, and updated states
 */
export function processCardReview(
  card: SRSReviewCard,
  rating: SRSReviewRating | SRSGrade,
  settings: SchedulerSettings = {
    algorithm: 'sm2',
    desiredRetention: DEFAULT_FSRS_SETTINGS.desiredRetention,
  },
  now: Date = new Date()
): UnifiedReviewResult {
  const { sm2Grade, fsrsRating, stringRating } = normalizeRating(rating);
  const reviewTimeIso = now.toISOString();
  const stateBefore = getCardUnifiedState(card);

  if (settings.algorithm === 'fsrs') {
    const fsrsResult = calculateFSRS(card.fsrs || null, fsrsRating, now, {
      desiredRetention: settings.desiredRetention,
    });

    const updatedFsrsState: FSRSMemoryState = fsrsResult.memory;
    const stateAfter = fsrsStateToCardState(updatedFsrsState.state);

    const updatedSm2Progress: SRSProgress = {
      srsLevel: fsrsResult.memory.reps,
      interval: fsrsResult.intervalDays,
      easeFactor: card.easeFactor ?? 2.5,
      nextReviewDate: fsrsResult.nextReview,
      lastReviewedDate: reviewTimeIso,
      isFavorite: card.isFavorite ?? false,
      fsrs: updatedFsrsState,
      againCount: (card.againCount || 0) + (stringRating === 'again' ? 1 : 0),
      reviewCount: (card.reviewCount || 0) + 1,
    };

    return {
      nextReview: fsrsResult.nextReview,
      intervalDays: fsrsResult.intervalDays,
      algorithm: 'fsrs',
      retrievability: fsrsResult.retrievability,
      stateBefore,
      stateAfter,
      stringRating,
      sm2Grade,
      updatedSm2Progress,
      updatedFsrsState,
    };
  }

  // SM-2 Algorithm Mode
  const currentInterval = card.interval ?? 0;
  const currentRepetition = card.srsLevel ?? 0;
  const currentEF = card.easeFactor ?? 2.5;

  const sm2Result = calculateSM2(sm2Grade, currentInterval, currentRepetition, currentEF);

  const updatedSm2Progress: SRSProgress = {
    srsLevel: sm2Result.srsLevel,
    interval: sm2Result.interval,
    easeFactor: sm2Result.easeFactor,
    nextReviewDate: sm2Result.nextReviewDate,
    lastReviewedDate: reviewTimeIso,
    isFavorite: card.isFavorite ?? false,
    fsrs: card.fsrs,
    againCount: (card.againCount || 0) + (stringRating === 'again' ? 1 : 0),
    reviewCount: (card.reviewCount || 0) + 1,
  };

  const stateAfter = inferSm2StateAfter(stateBefore, updatedSm2Progress, sm2Grade);

  return {
    nextReview: sm2Result.nextReviewDate,
    intervalDays: sm2Result.interval,
    algorithm: 'sm2',
    stateBefore,
    stateAfter,
    stringRating,
    sm2Grade,
    updatedSm2Progress,
    updatedFsrsState: card.fsrs,
  };
}

/**
 * Previews next intervals for all 4 rating choices under the selected algorithm.
 */
export function previewCardIntervals(
  card: SRSReviewCard,
  settings: SchedulerSettings,
  now: Date = new Date()
): Record<SRSReviewRating, UnifiedReviewResult> {
  return {
    again: processCardReview(card, 'again', settings, now),
    hard: processCardReview(card, 'hard', settings, now),
    good: processCardReview(card, 'good', settings, now),
    easy: processCardReview(card, 'easy', settings, now),
  };
}

/**
 * Derives aggregate rating counts (Again, Hard, Good, Easy) for 7 days, 30 days, or all time.
 * Pure computation over dailyHistory without persisting redundant counters.
 * Safely ignores legacy history days that lack rating counters to prevent inflating denominators.
 */
export function getRatingCounters(
  dailyHistory: Record<string, DailyProgress>,
  days: 7 | 30 | 'all' = 'all',
  now: Date = new Date()
): RatingCountStats {
  let again = 0;
  let hard = 0;
  let good = 0;
  let easy = 0;
  let recordedDays = 0;
  let analyticsStartedAt: string | undefined = undefined;

  const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const entries = Object.values(dailyHistory || {});

  for (const item of entries) {
    if (!item || !item.date) continue;

    if (days !== 'all') {
      const parts = item.date.split('-');
      if (parts.length === 3) {
        const itemDateOnly = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
        const diffDays = Math.round((nowDateOnly - itemDateOnly) / (1000 * 60 * 60 * 24));
        if (diffDays < 0 || diffDays >= days) {
          continue;
        }
      }
    }

    const hasAnyRatingData =
      item.againCount !== undefined ||
      item.hardCount !== undefined ||
      item.goodCount !== undefined ||
      item.easyCount !== undefined;

    if (hasAnyRatingData) {
      recordedDays++;
      if (!analyticsStartedAt || item.date < analyticsStartedAt) {
        analyticsStartedAt = item.date;
      }
      again += item.againCount || 0;
      hard += item.hardCount || 0;
      good += item.goodCount || 0;
      easy += item.easyCount || 0;
    }
  }

  const total = again + hard + good + easy;
  const retentionRate = total > 0 ? Number(((hard + good + easy) / total).toFixed(4)) : 1.0;

  return {
    again,
    hard,
    good,
    easy,
    total,
    retentionRate,
    recordedDays,
    analyticsStartedAt,
  };
}
