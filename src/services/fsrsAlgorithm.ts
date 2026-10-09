import {
  FSRSCalculationResult,
  FSRSMemoryState,
  FSRSRating,
  FSRSSettings,
  FSRSState,
} from '../types';

/**
 * Default 17 weights for FSRS-4.5 (Free Spaced Repetition Scheduler v4.5)
 * Source: open-spaced-repetition/awesome-fsrs & ts-fsrs
 */
export const DEFAULT_FSRS_PARAMETERS: number[] = [
  0.4872, // w0: S0(Again)
  1.4003, // w1: S0(Hard)
  3.7145, // w2: S0(Good)
  13.8206, // w3: S0(Easy)
  5.1618, // w4: D0(Good) / Initial difficulty baseline
  1.2298, // w5: D0 grade factor
  0.8975, // w6: Next difficulty delta factor
  0.031, // w7: Next difficulty mean reversion factor
  1.6474, // w8: Recall stability multiplier
  0.1367, // w9: Recall stability S exponent
  1.0461, // w10: Recall stability (1-R) factor
  2.1072, // w11: Forget stability multiplier
  0.0793, // w12: Forget stability D exponent
  0.3246, // w13: Forget stability S exponent
  1.587, // w14: Forget stability (1-R) factor
  0.2272, // w15: Hard penalty multiplier
  2.8755, // w16: Easy bonus multiplier
];

/**
 * FSRS-4.5 Power Law Forgetting Curve constants:
 * R(t, S) = (1 + FACTOR * (t / S))^DECAY
 * With DECAY = -0.5 and FACTOR = 19 / 81, R(S, S) = 0.90 exactly.
 */
export const FSRS_DECAY = -0.5;
export const FSRS_FACTOR = 19 / 81; // ~0.2345679

export const DEFAULT_FSRS_SETTINGS: FSRSSettings = {
  desiredRetention: 0.9,
  maximumInterval: 36500, // 100 years
  w: DEFAULT_FSRS_PARAMETERS,
};

/**
 * Calculates Retrievability R(t, S) after t days since last review with stability S.
 * Formula: R(t, S) = (1 + (19/81) * (t / S))^(-0.5)
 * Returns a value in [0.0, 1.0].
 */
export function calculateRetrievability(elapsedDays: number, stability: number): number {
  if (elapsedDays <= 0) return 1.0;
  if (stability <= 0) return 0.0;

  const r = Math.pow(1 + FSRS_FACTOR * (elapsedDays / stability), FSRS_DECAY);
  return Math.min(1.0, Math.max(0.0, r));
}

/**
 * Calculates the next interval (in integer days) to achieve the desired retention rate r.
 * Formula: I(r, S) = (S / FACTOR) * (r^(-2) - 1)
 * Clamped to [1, maximumInterval].
 */
export function calculateInterval(
  desiredRetention: number,
  stability: number,
  maximumInterval: number = DEFAULT_FSRS_SETTINGS.maximumInterval
): number {
  if (stability <= 0) return 1;

  // Clamp desired retention to safe boundary [0.70, 0.98]
  const dr = Math.min(0.98, Math.max(0.7, desiredRetention || DEFAULT_FSRS_SETTINGS.desiredRetention));
  const rawInterval = (stability / FSRS_FACTOR) * (Math.pow(dr, 1 / FSRS_DECAY) - 1);

  const rounded = Math.round(rawInterval);
  return Math.max(1, Math.min(maximumInterval, rounded));
}

/**
 * Calculates initial stability S0(G) for a new card rated G in {1, 2, 3, 4}.
 * Formula: S0(G) = w[G - 1]
 */
export function initStability(rating: FSRSRating, w: number[] = DEFAULT_FSRS_PARAMETERS): number {
  const index = Math.min(3, Math.max(0, rating - 1));
  return Math.max(0.1, w[index]);
}

/**
 * Calculates initial difficulty D0(G) for a new card rated G in {1, 2, 3, 4}.
 * Formula: D0(G) = w4 - (G - 3) * w5, clamped to [1.0, 10.0].
 */
export function initDifficulty(rating: FSRSRating, w: number[] = DEFAULT_FSRS_PARAMETERS): number {
  const rawD = w[4] - (rating - 3) * w[5];
  return Math.min(10.0, Math.max(1.0, rawD));
}

/**
 * Calculates next difficulty D'(D, G) after review with grade G.
 * Linear damping with mean reversion towards w4.
 * Clamped to [1.0, 10.0].
 */
export function nextDifficulty(
  currentDifficulty: number,
  rating: FSRSRating,
  w: number[] = DEFAULT_FSRS_PARAMETERS
): number {
  const d = Math.min(10.0, Math.max(1.0, currentDifficulty));
  const deltaD = -w[6] * (rating - 3);
  const rawNextD = d + (deltaD * (10.0 - d)) / 9.0;
  // Mean reversion towards initial baseline w4
  const nextD = w[7] * w[4] + (1 - w[7]) * rawNextD;
  return Math.min(10.0, Math.max(1.0, nextD));
}

/**
 * Calculates next stability after successful recall (Grade in {2: Hard, 3: Good, 4: Easy}).
 * S'_r = S * (1 + exp(w8) * (11 - D) * S^(-w9) * (exp((1 - R) * w10) - 1) * hardPenalty * easyBonus)
 */
export function nextRecallStability(
  difficulty: number,
  stability: number,
  retrievability: number,
  rating: FSRSRating,
  w: number[] = DEFAULT_FSRS_PARAMETERS
): number {
  const d = Math.min(10.0, Math.max(1.0, difficulty));
  const s = Math.max(0.1, stability);
  const r = Math.min(1.0, Math.max(0.0, retrievability));

  const hardPenalty = rating === 2 ? w[15] : 1.0;
  const easyBonus = rating === 4 ? w[16] : 1.0;

  const sInc =
    Math.exp(w[8]) *
    (11.0 - d) *
    Math.pow(s, -w[9]) *
    (Math.exp((1.0 - r) * w[10]) - 1.0) *
    hardPenalty *
    easyBonus;

  const newStability = s * (1.0 + sInc);
  return Math.max(0.1, newStability);
}

/**
 * Calculates next stability after memory lapse (Grade = 1: Again).
 * S'_f = w11 * D^(-w12) * ((S + 1)^w13 - 1) * exp((1 - R) * w14)
 * Clamped to upper bound S and lower bound 0.1.
 */
export function nextForgetStability(
  difficulty: number,
  stability: number,
  retrievability: number,
  w: number[] = DEFAULT_FSRS_PARAMETERS
): number {
  const d = Math.min(10.0, Math.max(1.0, difficulty));
  const s = Math.max(0.1, stability);
  const r = Math.min(1.0, Math.max(0.0, retrievability));

  const rawSf =
    w[11] *
    Math.pow(d, -w[12]) *
    (Math.pow(s + 1.0, w[13]) - 1.0) *
    Math.exp((1.0 - r) * w[14]);

  // Cannot exceed current stability, minimum floor of 0.1
  return Math.max(0.1, Math.min(s, rawSf));
}

/**
 * State transition for FSRS items:
 * 0: New -> Again/Hard => 1 (Learning), Good/Easy => 2 (Review)
 * 1: Learning -> Again/Hard => 1 (Learning), Good/Easy => 2 (Review)
 * 2: Review -> Again => 3 (Relearning), Hard/Good/Easy => 2 (Review)
 * 3: Relearning -> Again/Hard => 3 (Relearning), Good/Easy => 2 (Review)
 */
export function nextState(currentState: FSRSState, rating: FSRSRating): FSRSState {
  if (currentState === 0 || currentState === 1) {
    return rating >= 3 ? 2 : 1;
  }
  if (currentState === 2) {
    return rating === 1 ? 3 : 2;
  }
  if (currentState === 3) {
    return rating >= 3 ? 2 : 3;
  }
  return 2;
}

/**
 * Main Pure Engine Function: Calculates the next FSRS memory state and review interval.
 *
 * @param memory Current FSRS memory state (or null if new card)
 * @param rating User rating: 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
 * @param reviewDate Date of the review (defaults to new Date())
 * @param settings Optional custom FSRS settings (retention rate, max interval, weights)
 * @returns FSRSCalculationResult containing nextReview, intervalDays, memory, and retrievability
 */
export function calculateFSRS(
  memory: FSRSMemoryState | null,
  rating: FSRSRating,
  reviewDate: Date = new Date(),
  settings?: Partial<FSRSSettings>
): FSRSCalculationResult {
  const activeSettings: FSRSSettings = {
    ...DEFAULT_FSRS_SETTINGS,
    ...settings,
    w: settings?.w || DEFAULT_FSRS_PARAMETERS,
  };

  const { desiredRetention, maximumInterval, w } = activeSettings;

  let newStability: number;
  let newDifficulty: number;
  let newState: FSRSState;
  let reps: number;
  let lapses: number;
  let retrievability: number;

  const isNewCard = !memory || memory.state === 0 || !memory.lastReview;

  if (isNewCard) {
    // Initial card review
    newStability = initStability(rating, w);
    newDifficulty = initDifficulty(rating, w);
    newState = nextState(0, rating);
    reps = (memory?.reps ?? 0) + 1;
    lapses = (memory?.lapses ?? 0) + (rating === 1 ? 1 : 0);
    retrievability = 1.0;
  } else {
    // Existing card review
    const lastReviewMs = new Date(memory.lastReview).getTime();
    const currentReviewMs = reviewDate.getTime();
    const elapsedDays = Math.max(0, (currentReviewMs - lastReviewMs) / (1000 * 60 * 60 * 24));

    retrievability = calculateRetrievability(elapsedDays, memory.stability);
    newDifficulty = nextDifficulty(memory.difficulty, rating, w);

    if (rating === 1) {
      newStability = nextForgetStability(memory.difficulty, memory.stability, retrievability, w);
    } else {
      newStability = nextRecallStability(memory.difficulty, memory.stability, retrievability, rating, w);
    }

    newState = nextState(memory.state, rating);
    reps = memory.reps + 1;
    lapses = memory.lapses + (rating === 1 ? 1 : 0);
  }

  const intervalDays = calculateInterval(desiredRetention, newStability, maximumInterval);

  const nextDate = new Date(reviewDate.getTime());
  nextDate.setDate(nextDate.getDate() + intervalDays);

  const nextMemoryState: FSRSMemoryState = {
    stability: Number(newStability.toFixed(4)),
    difficulty: Number(newDifficulty.toFixed(4)),
    state: newState,
    reps,
    lapses,
    lastReview: reviewDate.toISOString(),
  };

  return {
    nextReview: nextDate.toISOString(),
    intervalDays,
    memory: nextMemoryState,
    retrievability: Number(retrievability.toFixed(4)),
  };
}

/** Alias for calculateFSRS conforming to scheduling conventions */
export const scheduleFSRSItem = calculateFSRS;

/** Alias for initStability conforming to specification */
export const calculateInitialStability = initStability;

/** Alias for initDifficulty conforming to specification */
export const calculateInitialDifficulty = initDifficulty;

/**
 * Previews next intervals and memory calculations for all 4 possible ratings.
 * Useful for UI buttons displaying upcoming interval lengths (e.g. "1d", "3d", "7d", "14d").
 */
export function previewNextIntervals(
  memory: FSRSMemoryState | null,
  reviewDate: Date = new Date(),
  settings?: Partial<FSRSSettings>
): Record<FSRSRating, FSRSCalculationResult> {
  return {
    1: calculateFSRS(memory, 1, reviewDate, settings),
    2: calculateFSRS(memory, 2, reviewDate, settings),
    3: calculateFSRS(memory, 3, reviewDate, settings),
    4: calculateFSRS(memory, 4, reviewDate, settings),
  };
}

