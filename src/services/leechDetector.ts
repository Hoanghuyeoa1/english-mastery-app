// src/services/leechDetector.ts
// Pure service for SRS Leech Detection (hard / frequently forgotten words).
// Employs deterministic, explainable multi-factor scoring (lapses, again rate, FSRS difficulty).
// Compatible with both FSRS memory state and SM-2 lifetime counters. Zero external dependencies.

import { VocabWord, SRSProgress } from '../types';

export const LEECH_DETECTOR_RULES = {
  lapseThreshold: 4,
  lapseScoreWeight: 40,

  minRepsForRate: 6,
  againRateThreshold: 0.35,
  againRateScoreWeight: 35,

  highDifficultyThreshold: 8.5,
  difficultyScoreWeight: 25,

  leechCutoffScore: 50,
} as const;

export interface LeechAnalysis {
  isLeech: boolean;
  score: number;
  againCount: number;
  lapseCount: number;
  againRate: number;
  reasons: string[];
}

export interface LeechCardInput {
  id?: string;
  word?: string;
  reps?: number;
  lapses?: number;
  difficulty?: number;
  againCount?: number;
  reviewCount?: number;
  fsrs?: {
    reps?: number;
    lapses?: number;
    difficulty?: number;
  };
  // Explicitly note: srsLevel is NOT accepted as total lifetime reviews
  // because in SM-2, srsLevel resets back to 0 on lapse, making it an invalid denominator.
}

export interface LeechWordItem {
  id: string;
  word: string;
  meaning: string;
  ipa?: string;
  example?: string;
  tag?: string;
  analysis: LeechAnalysis;
}

/**
 * Evaluates whether a card exhibits "leech" behavior (frequently failed, draining study time).
 * Uses a transparent, multi-factor scoring model:
 * - Lapses >= 4: +40 points
 * - Reps >= 6 AND Again Rate >= 35%: +35 points
 * - FSRS Difficulty >= 8.5: +25 points
 *
 * Threshold: score >= 50 triggers isLeech = true.
 * This guarantees:
 * 1. Single factors alone (such as difficulty = 9.0 alone = 25 pts) cannot trigger a leech.
 * 2. New cards or normal mature forgetting cycles do not trigger false positives.
 * 3. Legacy SM-2 cards without reviewCount are handled conservatively.
 */
export function analyzeCardLeechStatus(card: LeechCardInput): LeechAnalysis {
  // Extract lifetime repetitions: FSRS reps, explicit reviewCount, or reps.
  // CRITICAL: NEVER fallback to srsLevel, because srsLevel resets to 0 on lapse!
  const rawReps = card.reps ?? card.fsrs?.reps ?? card.reviewCount;
  const safeReps = Number.isFinite(rawReps) ? Math.max(0, Math.floor(rawReps!)) : 0;

  const rawLapses = card.lapses ?? card.fsrs?.lapses ?? card.againCount ?? 0;
  const safeLapses = Number.isFinite(rawLapses) ? Math.max(0, Math.floor(rawLapses)) : 0;

  const rawAgain = card.againCount ?? card.fsrs?.lapses ?? card.lapses ?? 0;
  const safeAgain = Number.isFinite(rawAgain) ? Math.max(0, Math.floor(rawAgain)) : 0;

  const rawDifficulty = card.difficulty ?? card.fsrs?.difficulty ?? 5;
  const safeDifficulty = Number.isFinite(rawDifficulty)
    ? Math.min(10, Math.max(1, rawDifficulty))
    : 5;

  // Safe division: Prevent Division by Zero, NaN, or Infinity
  const againRate = safeReps > 0 ? Math.min(1.0, safeAgain / safeReps) : 0;
  const reasons: string[] = [];
  let score = 0;

  // Signal 1: Repeated Lapses
  if (safeLapses >= LEECH_DETECTOR_RULES.lapseThreshold) {
    score += LEECH_DETECTOR_RULES.lapseScoreWeight;
    reasons.push(`Đã quên (lapse) ${safeLapses} lần`);
  }

  // Signal 2: High Again Rate (only evaluated when sample is sufficient: safeReps >= 6)
  if (
    safeReps >= LEECH_DETECTOR_RULES.minRepsForRate &&
    againRate >= LEECH_DETECTOR_RULES.againRateThreshold
  ) {
    score += LEECH_DETECTOR_RULES.againRateScoreWeight;
    reasons.push(`Tỷ lệ bấm "Again" cao (${Math.round(againRate * 100)}%)`);
  }

  // Signal 3: Intrinsic FSRS Complexity / High Difficulty
  if (safeDifficulty >= LEECH_DETECTOR_RULES.highDifficultyThreshold) {
    score += LEECH_DETECTOR_RULES.difficultyScoreWeight;
    reasons.push(`Độ khó FSRS cao (${safeDifficulty.toFixed(1)}/10)`);
  }

  const isLeech = score >= LEECH_DETECTOR_RULES.leechCutoffScore;

  return {
    isLeech,
    score,
    againCount: safeAgain,
    lapseCount: safeLapses,
    againRate,
    reasons,
  };
}

/**
 * Scans an array of vocabulary words and identifies all leech cards.
 * Combines in-memory words with optional SRS progress state from the store.
 * Returns results sorted descending by leech score, then by lapse count.
 */
export function detectDeckLeeches(
  words: VocabWord[],
  srsProgressMap?: Record<string, SRSProgress>,
  maxResults: number = 20
): LeechWordItem[] {
  const leeches: LeechWordItem[] = [];

  for (const w of words) {
    const progress = srsProgressMap
      ? srsProgressMap[w.id] || srsProgressMap[w.word.toLowerCase().trim()]
      : undefined;

    // Quick filter: If word has never been reviewed, it cannot be a leech (O(1) skip)
    const hasReviews =
      (progress?.reviewCount ?? 0) > 0 ||
      (progress?.againCount ?? 0) > 0 ||
      (progress?.fsrs?.reps ?? 0) > 0 ||
      (w.reviewCount ?? 0) > 0 ||
      (w.againCount ?? 0) > 0 ||
      (w.fsrs?.reps ?? 0) > 0;

    if (!hasReviews) continue;

    const analysis = analyzeCardLeechStatus({
      reps: progress?.fsrs?.reps ?? progress?.reviewCount ?? w.fsrs?.reps ?? w.reviewCount,
      lapses: progress?.fsrs?.lapses ?? progress?.againCount ?? w.fsrs?.lapses ?? w.againCount,
      difficulty: progress?.fsrs?.difficulty ?? w.fsrs?.difficulty,
      againCount: progress?.againCount ?? w.againCount,
      reviewCount: progress?.reviewCount ?? w.reviewCount,
    });

    if (analysis.isLeech) {
      leeches.push({
        id: w.id,
        word: w.word,
        meaning: w.meaning,
        ipa: w.ipa || w.phonetic,
        example: w.example || w.exampleEn,
        tag: w.tag,
        analysis,
      });
    }
  }

  return leeches
    .sort(
      (a, b) =>
        b.analysis.score - a.analysis.score || b.analysis.lapseCount - a.analysis.lapseCount
    )
    .slice(0, maxResults);
}
