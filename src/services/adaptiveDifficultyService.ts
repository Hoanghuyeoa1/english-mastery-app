// src/services/adaptiveDifficultyService.ts
/**
 * Adaptive Difficulty Engine for Quiz Arena (Phase 2)
 * 
 * Pure, deterministic service responsible for:
 * 1. Sliding window accuracy tracking (5-10 recent answers, default 8).
 * 2. Hysteresis-based, anti-oscillation state transitions (step-by-step clamping: +/- 1 tier max).
 * 3. CEFR-aware difficulty bounding (e.g. B1 learners are not challenged with C2 words).
 * 4. Mode-specific difficulty parameter generation for all 4 arcade modes:
 *    - Classic Quiz: distractor similarity, personalized confusion prioritization, CEFR match.
 *    - Dictation: hint masking, speech speed, replay assistance.
 *    - Word Scramble: distractor letter count, solvability preservation, first-letter hint.
 *    - Speed Match: time limit (75s / 60s / 50s / 45s), active pairs count.
 * 5. Zero ML, 100% offline, zero NaN/Infinity invariants.
 */

import type {
  CEFRLevel,
  AdaptiveDifficultyTier,
  RecentAnswerRecord,
  ModeDifficultyParams,
  AdaptiveDifficultyEvaluation,
  DifficultyEngineInput,
} from '../types';

export const ADAPTIVE_DIFFICULTY_TIERS: readonly AdaptiveDifficultyTier[] = [
  'easy',
  'normal',
  'hard',
  'advanced',
] as const;

export const DIFFICULTY_DEFAULTS = {
  WINDOW_SIZE: 8,
  MIN_WINDOW_SIZE: 5,
  MAX_WINDOW_SIZE: 10,
  MIN_EVIDENCE_ANSWERS: 3,
  UP_ACCURACY_THRESHOLD: 0.85,
  DOWN_ACCURACY_THRESHOLD: 0.55,
  UP_STREAK_REQUIREMENT: 2,
  DOWN_STREAK_REQUIREMENT: -1,
} as const;

const CEFR_ORDER: Record<string, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

/**
 * Returns baseline difficulty tier from observed or target CEFR level.
 */
export function getBaselineTierFromCefr(cefr?: CEFRLevel | null): AdaptiveDifficultyTier {
  if (!cefr) return 'normal';
  const cleanCefr = cefr.toUpperCase().trim();
  switch (cleanCefr) {
    case 'A1':
      return 'easy';
    case 'A2':
    case 'B1':
      return 'normal';
    case 'B2':
      return 'hard';
    case 'C1':
    case 'C2':
      return 'advanced';
    default:
      return 'normal';
  }
}

/**
 * Determines CEFR upper and lower bounds for difficulty to protect learners
 * from unreasonably difficult or condescendingly easy content.
 */
export function getCefrTierBoundaries(learnerCefr?: CEFRLevel | null): {
  minTierIndex: number;
  maxTierIndex: number;
} {
  if (!learnerCefr) {
    return { minTierIndex: 0, maxTierIndex: 3 };
  }

  const rank = CEFR_ORDER[learnerCefr.toUpperCase().trim()] ?? 3;

  if (rank <= 1) {
    // A1: easy to normal (cannot jump to hard or advanced)
    return { minTierIndex: 0, maxTierIndex: 1 };
  }
  if (rank === 2) {
    // A2: easy to hard
    return { minTierIndex: 0, maxTierIndex: 2 };
  }
  if (rank === 3) {
    // B1: easy to hard (advanced only under exceptional evidence)
    return { minTierIndex: 0, maxTierIndex: 2 };
  }
  if (rank === 4) {
    // B2: normal to advanced
    return { minTierIndex: 1, maxTierIndex: 3 };
  }
  // C1/C2: normal to advanced
  return { minTierIndex: 1, maxTierIndex: 3 };
}

/**
 * Generates deterministic parameters for each of the 4 arcade modes
 * based on the active difficulty tier.
 */
export function getModeDifficultyParams(tier: AdaptiveDifficultyTier): ModeDifficultyParams {
  switch (tier) {
    case 'easy':
      return {
        classicQuiz: {
          distractorCount: 3,
          prioritizeConfusion: false,
          prioritizeSamePos: false,
          maxSimilarityTarget: 0.35,
          explanationDetail: 'detailed',
        },
        dictation: {
          maskHintType: 'first_letter_and_length',
          speechSpeed: 0.8,
          allowSlowReplay: true,
        },
        wordScramble: {
          distractorLettersCount: 1,
          revealFirstLetter: true,
          maxWordLengthCap: 8,
        },
        speedMatch: {
          timeLimitSeconds: 75,
          pairCount: 5,
        },
      };

    case 'hard':
      return {
        classicQuiz: {
          distractorCount: 3,
          prioritizeConfusion: true,
          prioritizeSamePos: true,
          maxSimilarityTarget: 0.8,
          explanationDetail: 'concise',
        },
        dictation: {
          maskHintType: 'none',
          speechSpeed: 0.95,
          allowSlowReplay: true,
        },
        wordScramble: {
          distractorLettersCount: 3,
          revealFirstLetter: false,
        },
        speedMatch: {
          timeLimitSeconds: 50,
          pairCount: 6,
        },
      };

    case 'advanced':
      return {
        classicQuiz: {
          distractorCount: 3,
          prioritizeConfusion: true,
          prioritizeSamePos: true,
          maxSimilarityTarget: 0.95,
          explanationDetail: 'concise',
        },
        dictation: {
          maskHintType: 'none',
          speechSpeed: 1.0,
          allowSlowReplay: true,
        },
        wordScramble: {
          distractorLettersCount: 4,
          revealFirstLetter: false,
        },
        speedMatch: {
          timeLimitSeconds: 45,
          pairCount: 6,
        },
      };

    case 'normal':
    default:
      return {
        classicQuiz: {
          distractorCount: 3,
          prioritizeConfusion: true,
          prioritizeSamePos: true,
          maxSimilarityTarget: 0.55,
          explanationDetail: 'concise',
        },
        dictation: {
          maskHintType: 'word_length',
          speechSpeed: 0.85,
          allowSlowReplay: true,
        },
        wordScramble: {
          distractorLettersCount: 2,
          revealFirstLetter: false,
          maxWordLengthCap: 10,
        },
        speedMatch: {
          timeLimitSeconds: 60,
          pairCount: 6,
        },
      };
  }
}

/**
 * Pure helper to extract boolean correctness from answers.
 */
function extractCorrectness(item: RecentAnswerRecord | boolean): boolean {
  if (typeof item === 'boolean') return item;
  if (typeof item === 'object' && item !== null) {
    return Boolean(item.isCorrect);
  }
  return false;
}

/**
 * Primary Service Entry Point:
 * Evaluates adaptive difficulty based on recent answers within a sliding window,
 * anti-oscillation hysteresis, and CEFR boundary protections.
 * 
 * Strict Invariants:
 * 1. Pure function: Zero side effects or mutations.
 * 2. Anti-oscillation: Step-by-step clamping (maximum 1 tier change per evaluation).
 * 3. Minimum evidence guard: Requires at least 3 answers before allowing any tier change.
 * 4. Zero NaN/Infinity: All metrics safely bounded [0.0, 1.0].
 */
export function evaluateAdaptiveDifficulty(
  input: DifficultyEngineInput
): AdaptiveDifficultyEvaluation {
  const rawWindowSize = input.windowSize ?? DIFFICULTY_DEFAULTS.WINDOW_SIZE;
  const windowSize = Math.max(
    DIFFICULTY_DEFAULTS.MIN_WINDOW_SIZE,
    Math.min(DIFFICULTY_DEFAULTS.MAX_WINDOW_SIZE, rawWindowSize)
  );

  const baselineTier = getBaselineTierFromCefr(input.learnerCefr);
  const currentTier = input.currentTier || baselineTier;
  const currentIdx = Math.max(0, ADAPTIVE_DIFFICULTY_TIERS.indexOf(currentTier));

  const answers = Array.isArray(input.recentAnswers) ? input.recentAnswers : [];
  const windowAnswers = answers.slice(-windowSize);
  const sampleCount = windowAnswers.length;

  const { minTierIndex, maxTierIndex } = getCefrTierBoundaries(input.learnerCefr);

  // 1. Zero / Low Data Early Exit (Preserve Current Tier Safely)
  if (sampleCount === 0) {
    const safeTier = ADAPTIVE_DIFFICULTY_TIERS[Math.max(minTierIndex, Math.min(maxTierIndex, currentIdx))];
    return {
      tier: safeTier,
      numericScore: 0.5,
      accuracyInWindow: 0.5,
      windowSizeObserved: 0,
      confidence: 0.0,
      isTransitionApplied: false,
      transitionReason: 'no_samples_available',
      modeParams: getModeDifficultyParams(safeTier),
    };
  }

  // 2. Compute Window Metrics
  let correctCount = 0;
  for (const a of windowAnswers) {
    if (extractCorrectness(a)) {
      correctCount += 1;
    }
  }

  const accuracy = Math.round((correctCount / sampleCount) * 1000) / 1000;
  const confidence = Math.min(1.0, Math.round((sampleCount / windowSize) * 100) / 100);
  const streak = typeof input.consecutiveStreak === 'number' ? input.consecutiveStreak : 0;

  // 3. Minimum Evidence Guard
  // Never change difficulty after only 1 or 2 answers!
  if (sampleCount < DIFFICULTY_DEFAULTS.MIN_EVIDENCE_ANSWERS) {
    const safeTier = ADAPTIVE_DIFFICULTY_TIERS[Math.max(minTierIndex, Math.min(maxTierIndex, currentIdx))];
    return {
      tier: safeTier,
      numericScore: Math.max(0.0, Math.min(1.0, 0.25 * currentIdx + accuracy * 0.25)),
      accuracyInWindow: accuracy,
      windowSizeObserved: sampleCount,
      confidence,
      isTransitionApplied: false,
      transitionReason: 'insufficient_evidence_for_shift',
      modeParams: getModeDifficultyParams(safeTier),
    };
  }

  // 4. Hysteresis & Anti-Oscillation Transition Decision
  let candidateIdx = currentIdx;
  let transitionReason = 'stable_within_hysteresis_band';

  const canStepUp = currentIdx < maxTierIndex;
  const canStepDown = currentIdx > minTierIndex;

  // Level Up Criteria:
  // - High accuracy >= 85% with positive streak >= 2
  // - OR overwhelming accuracy >= 90% across at least 6 samples
  const isEligibleForStepUp =
    canStepUp &&
    ((accuracy >= DIFFICULTY_DEFAULTS.UP_ACCURACY_THRESHOLD && streak >= DIFFICULTY_DEFAULTS.UP_STREAK_REQUIREMENT) ||
      (sampleCount >= 6 && accuracy >= 0.90));

  // Level Down Criteria:
  // - Low accuracy <= 55% with negative streak <= -1
  // - OR severely degraded accuracy < 40%
  const isEligibleForStepDown =
    canStepDown &&
    ((accuracy <= DIFFICULTY_DEFAULTS.DOWN_ACCURACY_THRESHOLD && streak <= DIFFICULTY_DEFAULTS.DOWN_STREAK_REQUIREMENT) ||
      accuracy < 0.40);

  if (isEligibleForStepUp) {
    candidateIdx = currentIdx + 1;
    transitionReason = 'accuracy_above_threshold_with_streak';
  } else if (isEligibleForStepDown) {
    candidateIdx = currentIdx - 1;
    transitionReason = 'accuracy_below_threshold_with_mistakes';
  }

  // Step Clamping: Never allow a jump of more than 1 tier in a single evaluation
  const clampedIdx = Math.max(
    currentIdx - 1,
    Math.min(currentIdx + 1, candidateIdx)
  );

  // Apply CEFR boundary clamping
  const finalIdx = Math.max(minTierIndex, Math.min(maxTierIndex, clampedIdx));
  const finalTier = ADAPTIVE_DIFFICULTY_TIERS[finalIdx];
  const isTransitionApplied = finalIdx !== currentIdx;

  // Bounded numeric score [0.0, 1.0]
  // base tier (0..0.75) + accuracy delta adjustment
  const tierBaseScore = finalIdx * 0.25;
  const deltaBonus = (accuracy - 0.5) * 0.2;
  const numericScore = Math.max(0.0, Math.min(1.0, Math.round((tierBaseScore + deltaBonus) * 1000) / 1000));

  return {
    tier: finalTier,
    numericScore,
    accuracyInWindow: accuracy,
    windowSizeObserved: sampleCount,
    confidence,
    isTransitionApplied,
    transitionReason,
    modeParams: getModeDifficultyParams(finalTier),
  };
}
