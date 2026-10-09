// src/services/adaptiveQuizService.ts
/**
 * Adaptive Question Selection Engine for Quiz Arena (Single Source of Truth)
 * 
 * Pure, decoupled service responsible for:
 * 1. Semantic Candidate Classification into 4 balanced pools:
 *    - Weak (~60%): Unresolved mistakes, high lapses, high againCount, leeches, low retrievability
 *    - Due Soon (~20%): Overdue > Due today > Due soon (read-only SRS inspection, zero mutation)
 *    - New (~10%): Unlearned, CEFR-calibrated for current learner level
 *    - Mastered (~10%): Stable memory, mature intervals, resolved mistakes (anti-forgetting maintenance)
 * 2. Deterministic Quota Rounding using Largest Remainder Method (Hare-Niemeyer).
 * 3. Waterfall Redistribution Cascade: Weak shortfall -> Due -> New -> Mastered.
 * 4. Honest New-User Fallback: If learner has 0 SRS/Mistake history, selects CEFR-balanced core vocabulary
 *    WITHOUT faking Weak/Due states.
 * 5. Bounded Priority Scoring (0..100) per category with anti-repeat recency penalty and
 *    deterministic Mulberry32 PRNG seed support.
 * 6. Zero React dependencies, 100% offline, zero Gemini/network calls.
 */

import type {
  VocabWord,
  VocabTag,
  CEFRLevel,
  SRSProgress,
  MistakeRecord,
  WordLearningStatsMap,
  FourSkillsScores,
  AdaptiveQuizCategory,
  LearnerQuizContext,
  AdaptiveCandidateEvidence,
  ClassifiedAdaptiveCandidate,
  AdaptiveQuizSelectionOptions,
  AdaptiveQuizSelectionResult,
} from '../types';

import { cleanWordToken } from './wordLookupService';
import { analyzeCardLeechStatus } from './leechDetector';
import { calculateRetrievability } from './fsrsAlgorithm';
import { isDueForReview } from './srsAlgorithm';
import { deriveLearnerCefrLevel } from './learningDictionaryService';

export const DEFAULT_ADAPTIVE_QUOTA_RATIOS: Record<AdaptiveQuizCategory, number> = {
  weak: 0.6,
  due: 0.2,
  new: 0.1,
  mastered: 0.1,
} as const;

export const CATEGORY_CASCADE_ORDER: readonly AdaptiveQuizCategory[] = [
  'weak',
  'due',
  'new',
  'mastered',
] as const;

const CEFR_NUMERIC_RANK: Record<string, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

/**
 * Deterministic 32-bit PRNG (Mulberry32).
 * Given the same numeric or string seed, produces an identical repeatable random stream [0, 1).
 */
export function createMulberry32(seed: number | string): () => number {
  let s = typeof seed === 'string'
    ? Array.from(seed).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 123456789)
    : (seed >>> 0);

  return function mulberry32(): number {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Largest Remainder Method (Hare-Niemeyer Algorithm) for deterministic integer quota rounding.
 * Guarantees that the sum of allocated category quotas exactly equals the requested count N.
 */
export function calculateHareNiemeyerQuotas(
  totalCount: number,
  customRatios?: Partial<Record<AdaptiveQuizCategory, number>>
): Record<AdaptiveQuizCategory, number> {
  const count = Math.max(0, Math.floor(totalCount));
  if (count === 0) {
    return { weak: 0, due: 0, new: 0, mastered: 0 };
  }

  const ratios: Record<AdaptiveQuizCategory, number> = {
    weak: customRatios?.weak ?? DEFAULT_ADAPTIVE_QUOTA_RATIOS.weak,
    due: customRatios?.due ?? DEFAULT_ADAPTIVE_QUOTA_RATIOS.due,
    new: customRatios?.new ?? DEFAULT_ADAPTIVE_QUOTA_RATIOS.new,
    mastered: customRatios?.mastered ?? DEFAULT_ADAPTIVE_QUOTA_RATIOS.mastered,
  };

  const ratioSum = ratios.weak + ratios.due + ratios.new + ratios.mastered;
  const normalizedRatios: Record<AdaptiveQuizCategory, number> = ratioSum > 0
    ? {
        weak: ratios.weak / ratioSum,
        due: ratios.due / ratioSum,
        new: ratios.new / ratioSum,
        mastered: ratios.mastered / ratioSum,
      }
    : { ...DEFAULT_ADAPTIVE_QUOTA_RATIOS };

  const categories: AdaptiveQuizCategory[] = ['weak', 'due', 'new', 'mastered'];
  const baseAllocation: Record<AdaptiveQuizCategory, number> = {
    weak: 0,
    due: 0,
    new: 0,
    mastered: 0,
  };
  const remainders: Array<{ category: AdaptiveQuizCategory; remainder: number }> = [];

  let allocatedSum = 0;

  for (const cat of categories) {
    const rawExact = count * normalizedRatios[cat];
    const base = Math.floor(rawExact);
    baseAllocation[cat] = base;
    allocatedSum += base;
    remainders.push({
      category: cat,
      remainder: rawExact - base,
    });
  }

  let deficit = count - allocatedSum;

  // Sắp xếp các phần dư giảm dần, nếu bằng nhau thì ưu tiên theo CATEGORY_CASCADE_ORDER
  remainders.sort((a, b) => {
    if (Math.abs(b.remainder - a.remainder) > 1e-9) {
      return b.remainder - a.remainder;
    }
    return CATEGORY_CASCADE_ORDER.indexOf(a.category) - CATEGORY_CASCADE_ORDER.indexOf(b.category);
  });

  for (let i = 0; i < remainders.length && deficit > 0; i++) {
    baseAllocation[remainders[i].category] += 1;
    deficit -= 1;
  }

  return baseAllocation;
}

/**
 * Pure Candidate Classification & Bounded Priority Scoring (0..100)
 */
export function classifyAdaptiveCandidate(
  word: VocabWord,
  context: LearnerQuizContext,
  now: number = Date.now(),
  rng: () => number = Math.random
): ClassifiedAdaptiveCandidate {
  const canonicalLemma = cleanWordToken(word.word);
  const wordId = (word.id || '').trim();
  const lowerId = wordId.toLowerCase();

  // 1. Resolve Mistake Record
  const mistakeBank = context.mistakeBank || {};
  const mistake: MistakeRecord | undefined =
    mistakeBank[wordId] ||
    mistakeBank[lowerId] ||
    mistakeBank[canonicalLemma];

  const hasMistakeRecord = Boolean(mistake);
  const mistakeCount = mistake
    ? (mistake.mistakeCount ?? mistake.wrongCount ?? 0)
    : 0;
  const isResolvedMistake = Boolean(mistake?.resolved);
  const isUnresolvedMistake = hasMistakeRecord && !isResolvedMistake && mistakeCount > 0;

  // 2. Resolve SRS Progress
  const srsProgressMap = context.srsProgressMap || {};
  const progress: SRSProgress | undefined =
    srsProgressMap[wordId] ||
    srsProgressMap[lowerId] ||
    srsProgressMap[canonicalLemma];

  const reps = progress?.srsLevel ?? word.srsLevel ?? 0;
  const interval = progress?.interval ?? word.interval ?? 0;
  const easeFactor = progress?.easeFactor ?? word.easeFactor ?? 2.5;
  const lastReviewedDate = progress?.lastReviewedDate || word.lastReviewedDate || null;
  const nextReviewDate = progress?.nextReviewDate || word.nextReviewDate || null;
  const firstLearnedAt = progress?.firstLearnedAt || word.firstLearnedAt || null;

  const hasBeenStudied = Boolean(
    lastReviewedDate ||
    firstLearnedAt ||
    reps > 0 ||
    (progress?.reviewCount && progress.reviewCount > 0) ||
    (word.reviewCount && word.reviewCount > 0)
  );

  const lapsesCount = progress?.fsrs?.lapses ?? progress?.againCount ?? word.fsrs?.lapses ?? word.againCount ?? 0;
  const againCount = typeof progress?.againCount === 'number'
    ? progress.againCount
    : (typeof word.againCount === 'number' ? word.againCount : null);
  const reviewCount = progress?.reviewCount ?? progress?.fsrs?.reps ?? word.reviewCount ?? word.fsrs?.reps ?? 0;

  // 3. Leech Analysis
  const leechAnalysis = analyzeCardLeechStatus({
    id: wordId || canonicalLemma,
    word: word.word,
    reps: reviewCount || reps,
    lapses: lapsesCount,
    difficulty: progress?.fsrs?.difficulty ?? word.fsrs?.difficulty,
    againCount: againCount ?? undefined,
    reviewCount,
    fsrs: progress?.fsrs ?? word.fsrs,
  });
  const isLeech = leechAnalysis.isLeech;

  // 4. Retrievability (FSRS)
  let retrievability: number | null = null;
  const fsrsState = progress?.fsrs ?? word.fsrs;
  if (fsrsState && hasBeenStudied && fsrsState.stability > 0) {
    const lastDateStr = fsrsState.lastReview || lastReviewedDate;
    if (lastDateStr) {
      const lastMs = Date.parse(lastDateStr);
      if (!Number.isNaN(lastMs) && lastMs <= now) {
        const elapsedDays = (now - lastMs) / (1000 * 60 * 60 * 24);
        const r = calculateRetrievability(elapsedDays, fsrsState.stability);
        if (Number.isFinite(r) && r >= 0 && r <= 1.0) {
          retrievability = Math.round(r * 10000) / 10000;
        }
      }
    }
  }

  // 5. Due & Overdue Evaluation
  let isDue = false;
  let daysUntilDue: number | null = null;
  let overdueDays = 0;

  if (nextReviewDate && hasBeenStudied) {
    const nextMs = Date.parse(nextReviewDate);
    if (!Number.isNaN(nextMs)) {
      const diffMs = nextMs - now;
      daysUntilDue = Math.round((diffMs / (1000 * 60 * 60 * 24)) * 10) / 10;
      if (diffMs <= 0) {
        isDue = true;
        overdueDays = Math.max(0, Math.round((-diffMs / (1000 * 60 * 60 * 24)) * 10) / 10);
      } else {
        isDue = isDueForReview(nextReviewDate, now);
      }
    }
  }

  const isOverdue = hasBeenStudied && isDue && overdueDays > 0;
  const isDueToday = hasBeenStudied && isDue && !isOverdue;
  const isDueSoon = hasBeenStudied && !isDue && daysUntilDue !== null && daysUntilDue <= 2.0;

  // 6. Mastered Evaluation
  let isMastered = false;
  if (hasBeenStudied && !isDue && !isLeech && !isUnresolvedMistake) {
    if (fsrsState) {
      isMastered =
        (fsrsState.stability >= 21) &&
        (fsrsState.reps >= 3) &&
        (retrievability === null || retrievability >= 0.85) &&
        lapsesCount <= 2;
    } else {
      isMastered =
        interval >= 21 &&
        reps >= 4 &&
        easeFactor >= 2.0 &&
        lapsesCount <= 2;
    }
    // Also reward resolved mistakes that have reached stability without new errors
    if (!isMastered && isResolvedMistake && reps >= 2 && interval >= 7) {
      isMastered = true;
    }
  }

  // 7. Anti-Repeat Recency Check
  const recentIds = context.recentWordIds || [];
  const isRecent = recentIds.some(
    (id) => id.toLowerCase() === lowerId || id.toLowerCase() === canonicalLemma
  );

  // 8. Pool Category Classification
  let category: AdaptiveQuizCategory;

  const isWeak =
    isUnresolvedMistake ||
    isLeech ||
    (retrievability !== null && retrievability < 0.70) ||
    lapsesCount >= 3 ||
    (againCount !== null && againCount >= 3) ||
    (fsrsState && (fsrsState.state === 3 || (fsrsState.state as unknown) === 'relearning'));

  if (isWeak) {
    category = 'weak';
  } else if (hasBeenStudied && (isOverdue || isDueToday || isDueSoon)) {
    category = 'due';
  } else if (isMastered) {
    category = 'mastered';
  } else {
    // Unlearned or beginning card
    category = 'new';
  }

  // 9. Bounded Priority Score Computation (0..100)
  let rawScore = 50;

  if (category === 'weak') {
    // Priority: Unresolved mistake (+40) + Leech (+20) + low retrievability (+15) + lapse (+10)
    let score = 40;
    if (isUnresolvedMistake) {
      score += 25 + Math.min(15, (mistakeCount - 1) * 3);
    }
    if (isLeech) {
      score += 20;
    }
    if (retrievability !== null && retrievability < 0.70) {
      score += Math.min(15, Math.round((0.70 - retrievability) * 50));
    }
    if (lapsesCount >= 3 || (againCount !== null && againCount >= 3)) {
      score += 10;
    }
    if (isRecent) {
      score -= 25;
    }
    rawScore = Math.max(10, Math.min(100, score));
  } else if (category === 'due') {
    // Priority: Overdue (65..95) > Due Today (55) > Due Soon (30..50)
    let score = 30;
    if (isOverdue) {
      score = 65 + Math.min(30, Math.round(overdueDays * 5));
    } else if (isDueToday) {
      score = 55;
    } else {
      score = 30 + Math.max(0, Math.round((2 - Math.max(0, daysUntilDue ?? 0)) * 10));
    }
    if (isRecent) {
      score -= 25;
    }
    rawScore = Math.max(5, Math.min(100, score));
  } else if (category === 'new') {
    // Priority: Learner CEFR alignment (up to 50) + Core/High-frequency tag (up to 30)
    let score = 20;
    const effectiveLearnerCefr = context.learnerCefr ||
      deriveLearnerCefrLevel(context.fourSkillsScores).learnerLevel ||
      'B1';

    const wordLevel = (word.level || word.cefr || 'B1').toUpperCase().trim();
    const learnerRank = CEFR_NUMERIC_RANK[effectiveLearnerCefr] ?? 3;
    const wordRank = CEFR_NUMERIC_RANK[wordLevel] ?? 3;
    const diff = Math.abs(wordRank - learnerRank);

    let cefrMatch: 'exact' | 'close' | 'distant' | 'unknown' = 'unknown';
    if (diff === 0) {
      score += 50;
      cefrMatch = 'exact';
    } else if (diff === 1) {
      score += 35;
      cefrMatch = 'close';
    } else if (diff === 2) {
      score += 15;
      cefrMatch = 'distant';
    } else {
      score += 5;
      cefrMatch = 'distant';
    }

    // Tag Relevance bonus
    const highValueTags: VocabTag[] = ['Daily', 'Business', 'Academic', 'TOEIC', 'IELTS'];
    if (word.tag && highValueTags.includes(word.tag)) {
      score += 20;
    }

    if (word.category && (word.category.includes('Core') || word.category.includes('Oxford'))) {
      score += 10;
    }

    if (isRecent) {
      score -= 25;
    }
    rawScore = Math.max(5, Math.min(100, score));
  } else {
    // category === 'mastered': Anti-forgetting maintenance
    let score = 40;
    if (lastReviewedDate) {
      const lastMs = Date.parse(lastReviewedDate);
      if (!Number.isNaN(lastMs)) {
        const daysSince = Math.max(0, (now - lastMs) / (1000 * 60 * 60 * 24));
        score += Math.min(45, Math.round(daysSince * 1.5));
      }
    }
    if (isRecent) {
      score -= 25;
    }
    rawScore = Math.max(5, Math.min(100, score));
  }

  // PRNG micro-jitter for deterministic tie breaking among items with identical scores
  const deterministicScore = Math.round(rawScore * 100) / 100 + rng() * 0.001;

  const evidence: AdaptiveCandidateEvidence = {
    unresolvedMistake: isUnresolvedMistake,
    mistakeCount: isUnresolvedMistake ? mistakeCount : undefined,
    isLeech,
    isDue,
    daysUntilDue,
    overdueDays: overdueDays > 0 ? overdueDays : undefined,
    retrievability,
    lapsesCount: lapsesCount > 0 ? lapsesCount : undefined,
    againCount,
    isUnlearned: !hasBeenStudied,
    isMastered,
    recentPenaltyApplied: isRecent,
    rawScore,
  };

  return {
    word,
    canonicalLemma,
    category,
    priorityScore: deterministicScore,
    evidence,
  };
}

/**
 * Primary Engine Entry Point:
 * Selects an adaptively balanced subset of vocabulary words for a Quiz Arena session.
 * 
 * Strict Invariants:
 * 1. Deterministic & Pure: Zero side effects or mutations on store, SRS, or Mistake Bank.
 * 2. Distinct Lemmas: Exactly 1 item per canonical lemma per session (no duplicate words).
 * 3. Quota Integrity: Uses Hare-Niemeyer rounding and cascade redistribution.
 * 4. Honest Fallback: Never labels unlearned words as fake Weak/Due for new users.
 */
export function selectAdaptiveQuizItems(
  candidates: VocabWord[],
  context: LearnerQuizContext = {},
  options: AdaptiveQuizSelectionOptions = {}
): AdaptiveQuizSelectionResult {
  const count = options.count ?? 20;
  const now = context.now ?? Date.now();
  const rng = options.seed !== undefined ? createMulberry32(options.seed) : Math.random;

  // 1. Initial Candidate Sanitization & Tag Filter
  let candidatePool = Array.isArray(candidates) ? [...candidates] : [];

  if (options.tagFilter && options.tagFilter !== 'ALL') {
    candidatePool = candidatePool.filter((w) => w.tag === options.tagFilter);
  }

  const excludedSet = new Set<string>();
  if (options.excludeWordIds) {
    if (options.excludeWordIds instanceof Set) {
      options.excludeWordIds.forEach((id) => excludedSet.add(id.toLowerCase()));
    } else if (Array.isArray(options.excludeWordIds)) {
      options.excludeWordIds.forEach((id) => excludedSet.add(id.toLowerCase()));
    }
  }

  // Pre-filter valid words
  const validCandidates: VocabWord[] = [];
  const seenInitialLemmas = new Set<string>();

  for (const c of candidatePool) {
    if (!c || !c.word || typeof c.word !== 'string') continue;
    const lemma = cleanWordToken(c.word);
    if (lemma.length < 2) continue;
    if (c.id && excludedSet.has(c.id.toLowerCase())) continue;
    if (excludedSet.has(lemma)) continue;

    // Deduplicate duplicate entries in candidate input upfront by canonical lemma
    if (!seenInitialLemmas.has(lemma)) {
      seenInitialLemmas.add(lemma);
      validCandidates.push(c);
    }
  }

  // Low-Data Early Exit
  if (validCandidates.length === 0) {
    return {
      items: [],
      classifiedItems: [],
      quotaSummary: {
        requested: count,
        allocated: { weak: 0, due: 0, new: 0, mastered: 0 },
        actual: { weak: 0, due: 0, new: 0, mastered: 0 },
        shortfalls: { weak: 0, due: 0, new: 0, mastered: 0 },
        surplusRedistributed: 0,
      },
      isNewUserFallback: false,
    };
  }

  // 2. Classify all candidates into 4 category pools
  const classifiedMap: Record<AdaptiveQuizCategory, ClassifiedAdaptiveCandidate[]> = {
    weak: [],
    due: [],
    new: [],
    mastered: [],
  };

  for (const item of validCandidates) {
    const classified = classifyAdaptiveCandidate(item, context, now, rng);
    classifiedMap[classified.category].push(classified);
  }

  // Sort each pool descending by priorityScore (highest priority first)
  for (const cat of CATEGORY_CASCADE_ORDER) {
    classifiedMap[cat].sort((a, b) => b.priorityScore - a.priorityScore);
  }

  // 3. Detect New-User Fallback
  // If the user has zero weak, due, or mastered items, fallback to CEFR-balanced core vocabulary
  const hasLearningHistory =
    classifiedMap.weak.length > 0 ||
    classifiedMap.due.length > 0 ||
    classifiedMap.mastered.length > 0;

  const isNewUserFallback = !hasLearningHistory;

  // 4. Calculate Quotas
  let allocatedQuotas: Record<AdaptiveQuizCategory, number>;

  if (isNewUserFallback) {
    // For new users: 100% of allocation is drawn from the New pool
    allocatedQuotas = {
      weak: 0,
      due: 0,
      new: count,
      mastered: 0,
    };
  } else {
    allocatedQuotas = calculateHareNiemeyerQuotas(count, options.targetQuotas);
  }

  // 5. Quota Redistribution Cascade (Weak shortfall -> Due -> New -> Mastered)
  const availableCounts: Record<AdaptiveQuizCategory, number> = {
    weak: classifiedMap.weak.length,
    due: classifiedMap.due.length,
    new: classifiedMap.new.length,
    mastered: classifiedMap.mastered.length,
  };

  const actualAllocations: Record<AdaptiveQuizCategory, number> = {
    weak: Math.min(allocatedQuotas.weak, availableCounts.weak),
    due: Math.min(allocatedQuotas.due, availableCounts.due),
    new: Math.min(allocatedQuotas.new, availableCounts.new),
    mastered: Math.min(allocatedQuotas.mastered, availableCounts.mastered),
  };

  const shortfalls: Record<AdaptiveQuizCategory, number> = {
    weak: allocatedQuotas.weak - actualAllocations.weak,
    due: allocatedQuotas.due - actualAllocations.due,
    new: allocatedQuotas.new - actualAllocations.new,
    mastered: allocatedQuotas.mastered - actualAllocations.mastered,
  };

  let totalSurplusToRedistribute =
    shortfalls.weak + shortfalls.due + shortfalls.new + shortfalls.mastered;

  // Cascade surplus to categories with remaining capacity
  if (totalSurplusToRedistribute > 0) {
    for (const cat of CATEGORY_CASCADE_ORDER) {
      if (totalSurplusToRedistribute <= 0) break;
      const capacity = availableCounts[cat] - actualAllocations[cat];
      if (capacity > 0) {
        const extra = Math.min(totalSurplusToRedistribute, capacity);
        actualAllocations[cat] += extra;
        totalSurplusToRedistribute -= extra;
      }
    }
  }

  // 6. Assemble Final Selected Items
  const selectedClassified: ClassifiedAdaptiveCandidate[] = [];
  const selectedLemmas = new Set<string>();

  // Pick items in cascade order (Weak -> Due -> New -> Mastered)
  for (const cat of CATEGORY_CASCADE_ORDER) {
    const quota = actualAllocations[cat];
    const pool = classifiedMap[cat];
    let picked = 0;

    if (cat === 'weak') {
      // Leech Protection (Phase 2): Leech cards have high priority, but cannot monopolize 100% of Weak pool
      // when non-leech weak candidates exist. Cap initial leech pick to 50% of weak quota.
      const maxLeechAllowed = Math.max(1, Math.ceil(quota * 0.5));
      let leechPicked = 0;
      const deferredLeeches: ClassifiedAdaptiveCandidate[] = [];

      for (const candidate of pool) {
        if (picked >= quota) break;
        if (selectedLemmas.has(candidate.canonicalLemma)) continue;

        if (candidate.evidence.isLeech) {
          if (leechPicked < maxLeechAllowed) {
            selectedLemmas.add(candidate.canonicalLemma);
            selectedClassified.push(candidate);
            picked += 1;
            leechPicked += 1;
          } else {
            deferredLeeches.push(candidate);
          }
        } else {
          selectedLemmas.add(candidate.canonicalLemma);
          selectedClassified.push(candidate);
          picked += 1;
        }
      }

      // If quota is still not met and we have deferred leeches, fill remaining slots
      for (const candidate of deferredLeeches) {
        if (picked >= quota) break;
        if (!selectedLemmas.has(candidate.canonicalLemma)) {
          selectedLemmas.add(candidate.canonicalLemma);
          selectedClassified.push(candidate);
          picked += 1;
        }
      }
    } else {
      for (const candidate of pool) {
        if (picked >= quota) break;
        if (!selectedLemmas.has(candidate.canonicalLemma)) {
          selectedLemmas.add(candidate.canonicalLemma);
          selectedClassified.push(candidate);
          picked += 1;
        }
      }
    }
  }

  // 7. Extract raw VocabWords
  const selectedItems = selectedClassified.map((c) => c.word);

  return {
    items: selectedItems,
    classifiedItems: selectedClassified,
    quotaSummary: {
      requested: count,
      allocated: allocatedQuotas,
      actual: {
        weak: selectedClassified.filter((c) => c.category === 'weak').length,
        due: selectedClassified.filter((c) => c.category === 'due').length,
        new: selectedClassified.filter((c) => c.category === 'new').length,
        mastered: selectedClassified.filter((c) => c.category === 'mastered').length,
      },
      shortfalls,
      surplusRedistributed:
        shortfalls.weak + shortfalls.due + shortfalls.new + shortfalls.mastered - totalSurplusToRedistribute,
    },
    isNewUserFallback,
  };
}

/**
 * High-level helper for QuizArena:
 * Formats a clean adaptive pool tailored for session initialization.
 */
export function buildAdaptiveQuizPool(
  candidates: VocabWord[],
  context: LearnerQuizContext,
  count: number,
  options?: Omit<AdaptiveQuizSelectionOptions, 'count'>
): VocabWord[] {
  const result = selectAdaptiveQuizItems(candidates, context, {
    ...options,
    count,
  });
  return result.items;
}
