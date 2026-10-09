// src/services/leaderboardLearningMetrics.ts
/**
 * Leaderboard Learning Metrics Engine (Phase 2)
 * 
 * Pure metric derivation, evidence validation, and aggregation for:
 * 1. Vocabulary Mastery (FSRS & SM-2, Canonical Lemma Dedup, Weekly Transition)
 * 2. Review Consistency (Normalized Due/Expected Ratio, No-Due Day Fairness, Heavy-day Chunking)
 * 
 * Architectural Invariants:
 * 1. Pure Derivation Layer: Zero mutation of Zustand store, FSRS memory states, or SM-2 intervals.
 * 2. Strict Semantic Isolation: FSRS requires valid stability/reps/state; SM-2 requires repetitions/interval;
 *    never fakes FSRS fields for SM-2 cards.
 * 3. Canonical Deduplication: Dedupes morphological variants (runs, running, ran) and duplicate cards into canonical lemmas.
 * 4. Idempotency: Processing the same event, card, or day multiple times yields the exact same metric output.
 * 5. Bounded Performance: Only inspects active user state (srsProgressMap, userCollocations, recentReviewEvents, dailyHistory).
 *    Never scans the entire 10,000+ word dictionary array.
 * 6. Vietnam Business Timezone: Week and day boundaries strictly adhere to Asia/Ho_Chi_Minh (UTC+7).
 */

import type {
  CollocationItem,
  DailyProgress,
  FSRSMemoryState,
  SRSAlgorithmType,
  SRSProgress,
  SRSReviewEvent,
  VocabWord,
} from '../types';
import { cleanWordToken, resolveCanonicalVocab, lookupContextWord, getStemCandidates } from './wordLookupService';
import { getDictionaryWord } from './dictionaryIndex';
import { 
  getVietnamWeekStart, 
  getVietnamWeekEnd, 
  getVietnamWeekId, 
  getCurrentVietnamWeekDates,
  LEADERBOARD_UTC_OFFSET_HOURS,
  getAuthoritativeVietnamWeekId,
  getAuthoritativeServerNow,
  calculateWeeklyXpFromHistory,
  syncWeeklyLearningMetricsToServer,
  type SyncWeeklyLearningMetricsResponse,
  type SyncWeeklyLearningMetricsPayload,
} from './leaderboardService';
import { isDueForReview } from './srsAlgorithm';
import {
  deriveActiveLearningMinutes,
  type ActiveSessionRecord,
} from './activeLearningTimeService';
import { loadToeicHistory } from './toeicPersistenceService';
import {
  useCloudSyncStore,
  getCloudSyncStoreState,
} from './cloudSyncService';

// ============================================================================
// TYPES & DATA CONTRACTS
// ============================================================================

export interface VocabularyMasteryItem {
  canonicalLemma: string;
  sourceCardId: string;
  algorithm: SRSAlgorithmType;
  srsLevel?: number;
  interval?: number;
  stability?: number;
  reps?: number;
  lastReviewedDate?: string;
  isCollocation: boolean;
}

export interface VocabularyMasterySummary {
  totalMasteredCount: number;
  uniqueCanonicalLemmas: string[];
  byAlgorithm: {
    fsrs: number;
    sm2: number;
  };
  supportingEvidenceCount: number;
}

export interface WeeklyMasteryTransition {
  canonicalLemma: string;
  sourceCardId: string;
  transitionedAt: string;
  algorithm: SRSAlgorithmType;
  eventId?: string;
}

export interface WeeklyMasteryResult {
  newlyMasteredCount: number;
  transitions: WeeklyMasteryTransition[];
  supportingEvidenceCount: number;
}

export interface ReviewConsistencyDayBreakdown {
  date: string; // YYYY-MM-DD in Asia/Ho_Chi_Minh
  expectedDue: number;
  completedDue: number;
  isNoDueDay: boolean;
  isHeavyDay: boolean;
  dayRatio: number; // 0.0 to 1.0 (or null if no-due day)
  isCompleted: boolean;
}

export interface ReviewConsistencyResult {
  consistencyScore: number; // 0 to 100
  consistencyRatio: number; // 0.0 to 1.0
  eligibleReviewDays: number; // Days with scheduled cards (0 to 7)
  completedReviewDays: number; // Days with dayRatio >= 1.0
  expectedScheduledReviews: number;
  completedScheduledReviews: number;
  isEligibleForRanking: boolean; // Minimum activity threshold
  dayBreakdowns: ReviewConsistencyDayBreakdown[];
}

export interface TieBreakMetadata {
  score: number;
  evidenceCount: number;
  lastActiveAt: string;
  userId: string;
}

export interface WeeklyLearningMetricsAggregate {
  userId: string;
  weekId: string;
  weekStart: string;
  weekEnd: string;
  vocabMastery: {
    lifetimeCount: number;
    newlyMasteredThisWeek: number;
    supportingEvidenceCount: number;
  };
  reviewConsistency: ReviewConsistencyResult;
  derivedAt: string;
}

// ============================================================================
// DATE & TIMEZONE HELPERS (Asia/Ho_Chi_Minh UTC+7)
// ============================================================================

export { getVietnamDateString } from '../utils/dateUtils';

// ============================================================================
// CANONICAL DEDUPLICATION (Canonical Lemma Resolution)
// ============================================================================

const IRREGULAR_LEMMAS: Record<string, string> = {
  ran: 'run',
  went: 'go',
  gone: 'go',
  came: 'come',
  seen: 'see',
  saw: 'see',
  took: 'take',
  taken: 'take',
  got: 'get',
  gotten: 'get',
  made: 'make',
  did: 'do',
  done: 'do',
  said: 'say',
  spoke: 'speak',
  spoken: 'speak',
  wrote: 'write',
  written: 'write',
  ate: 'eat',
  eaten: 'eat',
  fell: 'fall',
  fallen: 'fall',
  knew: 'know',
  known: 'know',
  thought: 'think',
  brought: 'bring',
  bought: 'buy',
  taught: 'teach',
  caught: 'catch',
  found: 'find',
  left: 'leave',
  kept: 'keep',
  felt: 'feel',
  built: 'build',
  lost: 'lose',
  sent: 'send',
  met: 'meet',
  understood: 'understand',
};

/**
 * Resolves a card ID or word token to its canonical dictionary lemma key.
 * Guarantees:
 * - Morphological variants ('runs', 'running', 'ran') map to 'run'.
 * - Collocations/phrases map to normalized lowercase phrase.
 * - 'vocab_run' and 'run' map to the same lemma 'run'.
 * - Case-insensitive and strips punctuation.
 */
export function getCanonicalLemmaKey(
  rawTokenOrId: string,
  vocabularyList: VocabWord[] = []
): string {
  if (!rawTokenOrId || typeof rawTokenOrId !== 'string') return '';
  
  // Strip common persistence prefixes if present
  const unquoted = rawTokenOrId.trim();
  const strippedId = unquoted.replace(/^(vocab_|ext_|custom_|colloc_)/i, '');
  // Normalize underscores into spaces for multi-word phrases and IDs (e.g. 'truncate_test' -> 'truncate test')
  const spaceNormalized = strippedId.replace(/_/g, ' ');
  const clean = cleanWordToken(spaceNormalized || unquoted);
  if (!clean) return '';

  // 1. Phrasal items or collocations with spaces: keep normalized phrase
  if (clean.includes(' ')) {
    return clean;
  }

  // 2. Irregular inflections
  if (IRREGULAR_LEMMAS[clean]) {
    return IRREGULAR_LEMMAS[clean];
  }

  // 3. Morphological stem candidates: if an inflected form has a root candidate in dictionary, prefer root
  const stemCandidates = getStemCandidates(clean);
  for (const cand of stemCandidates) {
    const dictWord = getDictionaryWord(cand);
    if (dictWord?.word) {
      return cleanWordToken(dictWord.word);
    }
  }

  // 4. Try canonical vocabulary resolution via Oxford/CEFR static bank and stemmer
  try {
    const resolved = resolveCanonicalVocab(clean, vocabularyList);
    if (resolved?.isExistingInBank && resolved.canonicalWord?.word) {
      return cleanWordToken(resolved.canonicalWord.word);
    }
  } catch {
    // Graceful fallback to context stemming
  }

  // 5. Fallback to morphological stem lookup
  try {
    const stemmed = lookupContextWord(clean);
    if (stemmed?.word) {
      return cleanWordToken(stemmed.word);
    }
  } catch {
    // Graceful fallback
  }

  return clean;
}

// ============================================================================
// VOCABULARY MASTERY EVALUATORS
// ============================================================================

export const FSRS_MASTERY_MIN_STABILITY_DAYS = 21.0;
export const FSRS_MASTERY_MIN_REPS = 2;
export const SM2_MASTERY_MIN_REPETITIONS = 5;
export const SM2_MASTERY_MIN_INTERVAL_DAYS = 21;

/**
 * Evaluates whether an FSRS memory state qualifies as Mastered:
 * 1. Must be in Review state (State 2).
 *    Strictly excludes: State 0 (New), State 1 (Learning), State 3 (Relearning).
 * 2. Stability S >= 21.0 days.
 * 3. Repetitions >= 2 (Must have undergone at least 2 successful reviews;
 *    prevents a single 'Easy' click on a new card from claiming mastery).
 */
export function isFsrsCardMastered(
  fsrsState?: FSRSMemoryState | null,
  reviewCount?: number
): boolean {
  if (!fsrsState || typeof fsrsState !== 'object') return false;

  // Rule 1: State must strictly be Review (2). Exclude New (0), Learning (1), Relearning (3)
  if (fsrsState.state !== 2) return false;

  // Rule 2: Stability must be at least 21 days
  if (typeof fsrsState.stability !== 'number' || fsrsState.stability < FSRS_MASTERY_MIN_STABILITY_DAYS) {
    return false;
  }

  // Rule 3: Insufficient evidence guard: reps >= 2 or reviewCount >= 2
  const reps = fsrsState.reps ?? reviewCount ?? 0;
  if (reps < FSRS_MASTERY_MIN_REPS) return false;

  return true;
}

/**
 * Evaluates whether an SM-2 progress record qualifies as Mastered:
 * 1. Repetitions (or srsLevel) >= 5 OR interval >= 21 days.
 * 2. Must have study evidence (reviewCount >= 2 or firstLearnedAt/lastReviewedDate exists).
 * 3. Never checks or fakes FSRS fields.
 */
export function isSm2CardMastered(
  progress?: {
    srsLevel?: number;
    interval?: number;
    reviewCount?: number;
    firstLearnedAt?: string;
    lastReviewedDate?: string;
  } | null
): boolean {
  if (!progress || typeof progress !== 'object') return false;

  const srsLevel = progress.srsLevel ?? 0;
  const interval = progress.interval ?? 0;

  const isLevelOrIntervalQualified = srsLevel >= SM2_MASTERY_MIN_REPETITIONS || interval >= SM2_MASTERY_MIN_INTERVAL_DAYS;
  if (!isLevelOrIntervalQualified) return false;

  // Evidence guard: Must have actual study history
  const hasStudyEvidence = 
    (typeof progress.reviewCount === 'number' && progress.reviewCount >= 2) ||
    Boolean(progress.firstLearnedAt) ||
    Boolean(progress.lastReviewedDate);

  return hasStudyEvidence;
}

/**
 * Unified card mastery evaluator adhering to strict semantic isolation.
 */
export function isCardMastered(
  card: SRSProgress | VocabWord,
  algorithmPreference?: SRSAlgorithmType
): boolean {
  if (!card) return false;

  const hasFsrs = Boolean(card.fsrs && typeof card.fsrs.stability === 'number');
  if (hasFsrs && algorithmPreference !== 'sm2') {
    return isFsrsCardMastered(card.fsrs, card.reviewCount);
  }

  return isSm2CardMastered({
    srsLevel: card.srsLevel,
    interval: card.interval,
    reviewCount: card.reviewCount,
    firstLearnedAt: card.firstLearnedAt,
    lastReviewedDate: card.lastReviewedDate,
  });
}

// ============================================================================
// VOCABULARY MASTERY DERIVATIONS
// ============================================================================

export interface VocabularyMasteryInput {
  srsProgressMap?: Record<string, SRSProgress>;
  userCollocations?: CollocationItem[];
  vocabularyList?: VocabWord[];
  algorithmPreference?: SRSAlgorithmType;
}

/**
 * Derives Lifetime Vocabulary Mastery:
 * - Scans all active tracked cards in srsProgressMap and userCollocations.
 * - Deduplicates by canonical lemma key (e.g. 'runs', 'running' -> 'run').
 * - Preserves FSRS vs SM-2 strict isolation.
 * - Returns unique count of mastered canonical lemmas.
 */
export function deriveLifetimeVocabularyMastery(
  input: VocabularyMasteryInput
): VocabularyMasterySummary {
  const { srsProgressMap = {}, userCollocations = [], vocabularyList = [], algorithmPreference } = input;
  const masteredLemmas = new Set<string>();
  const processedCardIds = new Set<string>();
  let fsrsCount = 0;
  let sm2Count = 0;
  let supportingEvidenceCount = 0;

  // Build quick map for collocations by ID
  const collocationPhraseMap = new Map<string, string>();
  for (const colloc of userCollocations) {
    if (colloc?.id) {
      collocationPhraseMap.set(colloc.id, colloc.phrase || colloc.id);
    }
  }

  // Helper to process a card
  const processCard = (cardId: string, cardProgress: SRSProgress | VocabWord, phraseOverride?: string) => {
    if (!cardProgress) return;
    const isMastered = isCardMastered(cardProgress, algorithmPreference);
    if (!isMastered) return;

    const lookupToken = phraseOverride || collocationPhraseMap.get(cardId) || cardId;
    const canonicalKey = getCanonicalLemmaKey(lookupToken, vocabularyList);
    if (!canonicalKey) return;

    supportingEvidenceCount++;
    if (!masteredLemmas.has(canonicalKey)) {
      masteredLemmas.add(canonicalKey);
      if (cardProgress.fsrs && algorithmPreference !== 'sm2') {
        fsrsCount++;
      } else {
        sm2Count++;
      }
    }
  };

  // 1. Process srsProgressMap
  for (const [cardId, progress] of Object.entries(srsProgressMap)) {
    processCard(cardId, progress);
    processedCardIds.add(cardId);
  }

  // 2. Process userCollocations that were not already processed
  for (const colloc of userCollocations) {
    if (!colloc || !colloc.id || processedCardIds.has(colloc.id)) continue;
    const progress = srsProgressMap[colloc.id];
    if (progress) {
      processCard(colloc.id, progress, colloc.phrase);
      processedCardIds.add(colloc.id);
    }
  }

  // 3. Process vocabularyList for words with progress not already processed
  for (const word of vocabularyList) {
    if (!word || !word.id || processedCardIds.has(word.id)) continue;
    if ((word.srsLevel && word.srsLevel > 0) || (word.interval && word.interval > 0) || word.fsrs || word.lastReviewedDate) {
      processCard(word.id, word, word.word);
      processedCardIds.add(word.id);
    }
  }

  return {
    totalMasteredCount: masteredLemmas.size,
    uniqueCanonicalLemmas: Array.from(masteredLemmas).sort(),
    byAlgorithm: {
      fsrs: fsrsCount,
      sm2: sm2Count,
    },
    supportingEvidenceCount,
  };
}

/**
 * Derives Weekly Mastery Transitions:
 * - Inspects review events in recentReviewEvents that occurred in [weekStart, weekEnd).
 * - Identifies transitions where card moved from not-mastered -> mastered.
 * - Filters out cards that were ALREADY mastered prior to weekStart.
 * - Deduplicates by canonical lemma (each lemma transitions at most ONCE per week).
 * - 100% idempotent.
 */
export function deriveWeeklyMasteryTransitions(
  srsProgressMap: Record<string, SRSProgress> = {},
  recentReviewEvents: SRSReviewEvent[] = [],
  weekStart: Date = getVietnamWeekStart(),
  weekEnd: Date = getVietnamWeekEnd(),
  vocabularyList: VocabWord[] = []
): WeeklyMasteryResult {
  const weekStartMs = weekStart.getTime();
  const weekEndMs = weekEnd.getTime();

  // 1. Identify cards already mastered prior to weekStart
  const alreadyMasteredBeforeWeek = new Set<string>();

  // From historical review events prior to weekStart
  for (const ev of recentReviewEvents) {
    if (!ev || !ev.timestamp) continue;
    const evTimeMs = Date.parse(ev.timestamp);
    if (evTimeMs < weekStartMs) {
      const isEvMastered = 
        (ev.algorithm === 'fsrs' && (ev.stability ?? 0) >= FSRS_MASTERY_MIN_STABILITY_DAYS && (ev.stateAfter === 'review' || (ev.stateAfter as any) === 'mastered')) ||
        (ev.algorithm === 'sm2' && ((ev.interval ?? 0) >= SM2_MASTERY_MIN_INTERVAL_DAYS || (ev.stateAfter as any) === 'mastered'));
      
      if (isEvMastered) {
        const lemma = getCanonicalLemmaKey(ev.cardId, vocabularyList);
        if (lemma) alreadyMasteredBeforeWeek.add(lemma);
      }
    }
  }

  // From srsProgressMap cards whose lastReviewedDate is prior to weekStart and are already mastered
  for (const [cardId, progress] of Object.entries(srsProgressMap)) {
    if (progress.lastReviewedDate) {
      const lastReviewMs = Date.parse(progress.lastReviewedDate);
      if (lastReviewMs < weekStartMs && isCardMastered(progress)) {
        const lemma = getCanonicalLemmaKey(cardId, vocabularyList);
        if (lemma) alreadyMasteredBeforeWeek.add(lemma);
      }
    }
  }

  // 2. Scan events within the target week chronologically
  const weeklyEvents = recentReviewEvents
    .filter((ev) => {
      if (!ev || !ev.timestamp) return false;
      const ms = Date.parse(ev.timestamp);
      return ms >= weekStartMs && ms < weekEndMs;
    })
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  const masteredThisWeek = new Map<string, WeeklyMasteryTransition>();

  for (const ev of weeklyEvents) {
    const lemma = getCanonicalLemmaKey(ev.cardId, vocabularyList);
    if (!lemma) continue;

    // Skip if card was already mastered before the week started
    if (alreadyMasteredBeforeWeek.has(lemma)) continue;

    // Skip if already recorded a transition for this lemma in the current week
    if (masteredThisWeek.has(lemma)) continue;

    // Check if this event represents a mastery transition
    const isMasteredNow = 
      (ev.algorithm === 'fsrs' && (ev.stability ?? 0) >= FSRS_MASTERY_MIN_STABILITY_DAYS && (ev.stateAfter === 'review' || (ev.stateAfter as any) === 'mastered')) ||
      (ev.algorithm === 'sm2' && ((ev.interval ?? 0) >= SM2_MASTERY_MIN_INTERVAL_DAYS || (ev.stateAfter as any) === 'mastered'));

    const wasMasteredBefore = (ev.stateBefore as any) === 'mastered';

    if (isMasteredNow && !wasMasteredBefore) {
      masteredThisWeek.set(lemma, {
        canonicalLemma: lemma,
        sourceCardId: ev.cardId,
        transitionedAt: ev.timestamp,
        algorithm: ev.algorithm,
        eventId: ev.id,
      });
    }
  }

  // Fallback for cards currently mastered with lastReviewedDate in week, even if ring buffer truncated
  for (const [cardId, progress] of Object.entries(srsProgressMap)) {
    if (progress.lastReviewedDate) {
      const reviewMs = Date.parse(progress.lastReviewedDate);
      if (reviewMs >= weekStartMs && reviewMs < weekEndMs && isCardMastered(progress)) {
        const lemma = getCanonicalLemmaKey(cardId, vocabularyList);
        if (lemma && !alreadyMasteredBeforeWeek.has(lemma) && !masteredThisWeek.has(lemma)) {
          masteredThisWeek.set(lemma, {
            canonicalLemma: lemma,
            sourceCardId: cardId,
            transitionedAt: progress.lastReviewedDate,
            algorithm: progress.fsrs ? 'fsrs' : 'sm2',
          });
        }
      }
    }
  }

  const transitions = Array.from(masteredThisWeek.values());

  return {
    newlyMasteredCount: transitions.length,
    transitions,
    supportingEvidenceCount: transitions.length,
  };
}

// ============================================================================
// REVIEW CONSISTENCY DERIVATIONS
// ============================================================================

export interface ReviewConsistencyInput {
  dailyHistory?: Record<string, DailyProgress>;
  srsProgressMap?: Record<string, SRSProgress>;
  recentReviewEvents?: SRSReviewEvent[];
  refDate?: Date;
  heavyWorkloadThreshold?: number; // Default 40
  targetDailyWords?: number; // Default 15
}

export const DEFAULT_HEAVY_WORKLOAD_SRS_THRESHOLD = 40;
export const DEFAULT_SESSION_SRS_CHUNK_SIZE = 30;
export const MINIMUM_CONSISTENCY_ELIGIBLE_DAYS = 1;
export const MINIMUM_CONSISTENCY_EXPECTED_REVIEWS = 5;

/**
 * Derives Normalized Review Consistency for the current Vietnam business week:
 * 
 * Rules:
 * 1. Normalized Ratio: Evaluates completed due reviews / expected due reviews per day.
 * 2. No-Due Day Fairness: Days with 0 expected due cards are marked neutral/excluded
 *    from the denominator. Prevents free 100% for dormant users while not penalizing active users.
 * 3. Heavy-Day Chunking: Days with >= 40 due cards chunk the daily target so learners
 *    completing actionable chunks are evaluated fairly against daily capacity.
 * 4. Non-Scheduled Exclusion: Difficult-card reinforcement and non-due drills do not inflate
 *    scheduled due completed counts.
 * 5. Timezone Alignment: All timestamps and dates are bound strictly to Asia/Ho_Chi_Minh.
 */
export function deriveReviewConsistency(
  input: ReviewConsistencyInput = {}
): ReviewConsistencyResult {
  const {
    dailyHistory = {},
    srsProgressMap = {},
    recentReviewEvents = [],
    refDate = new Date(),
    heavyWorkloadThreshold = DEFAULT_HEAVY_WORKLOAD_SRS_THRESHOLD,
  } = input;

  const weekDates = getCurrentVietnamWeekDates(refDate);
  const dayBreakdowns: ReviewConsistencyDayBreakdown[] = [];

  let totalEligibleDays = 0;
  let totalCompletedDays = 0;
  let sumDayRatios = 0;
  let totalExpected = 0;
  let totalCompleted = 0;

  // Build a map of verified scheduled review events per Vietnam date
  // (Filter out non-due reinforcements, drills, and cramming)
  const scheduledReviewsByDate = new Map<string, Set<string>>();
  const allRecordedDatesWithEvents = new Set<string>();

  for (const ev of recentReviewEvents) {
    if (!ev || !ev.timestamp) continue;
    const vnDate = getVietnamDateString(ev.timestamp);
    if (!vnDate) continue;

    allRecordedDatesWithEvents.add(vnDate);

    // An official scheduled review is one where the card was due, in review, or in relearning/learning.
    // Difficult-card reinforcement and non-due drills are explicitly excluded.
    const isDrillOrReinforcement = 
      Boolean((ev as any).isReinforcement) || 
      Boolean((ev as any).isDrill) || 
      (ev as any).reviewMode === 'all_learned' ||
      (ev as any).reviewMode === 'today_learned' ||
      (ev.stateBefore as any) === 'drill' || 
      (ev.stateBefore as any) === 'cramming' ||
      ev.stateBefore === 'new';

    const isOfficialReview = 
      !isDrillOrReinforcement &&
      (ev.stateBefore === 'review' || 
       ev.stateBefore === 'learning' || 
       ev.stateBefore === 'relearning' ||
       (ev.stateBefore as any) === 'due');

    if (isOfficialReview) {
      if (!scheduledReviewsByDate.has(vnDate)) {
        scheduledReviewsByDate.set(vnDate, new Set());
      }
      scheduledReviewsByDate.get(vnDate)!.add(ev.cardId);
    }
  }

  const refVnDate = getVietnamDateString(refDate);

  for (const dateStr of weekDates) {
    const dayLog = dailyHistory[dateStr];
    const reportedWordsReviewed = dayLog && typeof dayLog.wordsReviewed === 'number'
      ? Math.max(0, dayLog.wordsReviewed)
      : 0;

    // Use verified scheduled review events if available.
    // If recentReviewEvents recorded activity on this date, use the strictly filtered count
    // (so drills/reinforcements are NEVER inflated by falling back to reportedWordsReviewed).
    // Only fall back to reportedWordsReviewed if no granular events exist in the buffer for this date.
    const hasGranularEvents = allRecordedDatesWithEvents.has(dateStr);
    const verifiedEventCount = scheduledReviewsByDate.get(dateStr)?.size ?? 0;
    const completedDue = hasGranularEvents 
      ? verifiedEventCount 
      : reportedWordsReviewed;

    // Check if date is in future relative to refDate with no activity recorded yet
    const isFutureDay = Boolean(refVnDate && dateStr > refVnDate && completedDue === 0);

    // Calculate overdue backlog that had accumulated up to this date
    let overdueCountOnDay = 0;
    if (!isFutureDay) {
      for (const progress of Object.values(srsProgressMap)) {
        if (progress.nextReviewDate) {
          const nextReviewVnDate = getVietnamDateString(progress.nextReviewDate);
          if (nextReviewVnDate && nextReviewVnDate <= dateStr) {
            overdueCountOnDay++;
          }
        }
      }
    }

    // Expected scheduled due reviews:
    // Total due on day = cards completed + cards still remaining overdue
    const rawExpectedDue = isFutureDay 
      ? 0 
      : (completedDue + overdueCountOnDay);

    const isNoDueDay = isFutureDay || (rawExpectedDue === 0 && completedDue === 0);
    const isHeavyDay = rawExpectedDue >= heavyWorkloadThreshold;

    // Handle heavy day target: Cap the daily denominator to an actionable daily budget
    // e.g. 60 cards (2 chunks) rather than penalizing an immense 200 card backlog infinitely
    const effectiveExpected = isHeavyDay
      ? Math.max(DEFAULT_SESSION_SRS_CHUNK_SIZE * 2, Math.min(rawExpectedDue, 60))
      : rawExpectedDue;

    let dayRatio = 0;
    let isCompleted = false;

    if (!isNoDueDay && effectiveExpected > 0) {
      dayRatio = Math.min(1.0, completedDue / effectiveExpected);
      isCompleted = dayRatio >= 1.0;

      totalEligibleDays++;
      sumDayRatios += dayRatio;
      totalExpected += effectiveExpected;
      totalCompleted += Math.min(completedDue, effectiveExpected);

      if (isCompleted) {
        totalCompletedDays++;
      }
    }

    dayBreakdowns.push({
      date: dateStr,
      expectedDue: effectiveExpected,
      completedDue,
      isNoDueDay,
      isHeavyDay,
      dayRatio: isNoDueDay ? 1.0 : dayRatio,
      isCompleted,
    });
  }

  // Calculate consistency ratio
  // Conservative neutral rule: If 0 eligible days in week, consistency is 0%
  const consistencyRatio = totalEligibleDays > 0
    ? sumDayRatios / totalEligibleDays
    : 0.0;

  const consistencyScore = Math.min(100, Math.max(0, Math.round(consistencyRatio * 100)));

  // Eligibility check: Learner must have at least 1 eligible day and 5 expected cards
  const isEligibleForRanking = 
    totalEligibleDays >= MINIMUM_CONSISTENCY_ELIGIBLE_DAYS &&
    totalExpected >= MINIMUM_CONSISTENCY_EXPECTED_REVIEWS;

  return {
    consistencyScore,
    consistencyRatio,
    eligibleReviewDays: totalEligibleDays,
    completedReviewDays: totalCompletedDays,
    expectedScheduledReviews: totalExpected,
    completedScheduledReviews: totalCompleted,
    isEligibleForRanking,
    dayBreakdowns,
  };
}

// ============================================================================
// COMBINED WEEKLY LEARNING METRICS AGGREGATE
// ============================================================================

export interface WeeklyLearningMetricsInput {
  userId?: string;
  srsProgressMap?: Record<string, SRSProgress>;
  userCollocations?: CollocationItem[];
  vocabularyList?: VocabWord[];
  dailyHistory?: Record<string, DailyProgress>;
  recentReviewEvents?: SRSReviewEvent[];
  refDate?: Date;
  algorithmPreference?: SRSAlgorithmType;
}

/**
 * Derives full Weekly Learning Metrics Aggregate for leaderboard sync and presentation:
 * - Vocabulary Mastery (Lifetime & Weekly Transitions)
 * - Review Consistency (Normalized 0..100)
 * - Deterministic Tie-break Metadata
 */
export function deriveWeeklyLearningMetrics(
  input: WeeklyLearningMetricsInput = {}
): WeeklyLearningMetricsAggregate {
  const {
    userId = 'anonymous',
    srsProgressMap = {},
    userCollocations = [],
    vocabularyList = [],
    dailyHistory = {},
    recentReviewEvents = [],
    refDate = new Date(),
    algorithmPreference,
  } = input;

  const weekId = getVietnamWeekId(refDate);
  const weekStart = getVietnamWeekStart(refDate);
  const weekEnd = getVietnamWeekEnd(refDate);

  // 1. Vocabulary Mastery
  const lifetimeMastery = deriveLifetimeVocabularyMastery({
    srsProgressMap,
    userCollocations,
    vocabularyList,
    algorithmPreference,
  });

  const weeklyTransitions = deriveWeeklyMasteryTransitions(
    srsProgressMap,
    recentReviewEvents,
    weekStart,
    weekEnd,
    vocabularyList
  );

  // 2. Review Consistency
  const reviewConsistency = deriveReviewConsistency({
    dailyHistory,
    srsProgressMap,
    recentReviewEvents,
    refDate,
  });

  return {
    userId,
    weekId,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    vocabMastery: {
      lifetimeCount: lifetimeMastery.totalMasteredCount,
      newlyMasteredThisWeek: weeklyTransitions.newlyMasteredCount,
      supportingEvidenceCount: lifetimeMastery.supportingEvidenceCount,
    },
    reviewConsistency,
    derivedAt: new Date().toISOString(),
  };
}

// ============================================================================
// PRONUNCIATION IMPROVEMENT (Trusted Speech Evidence & Windowing)
// ============================================================================

export interface PronunciationEvidenceItem {
  id: string; // Unique attempt ID
  word: string;
  score: number; // 0..100
  timestamp: string; // ISO 8601
  isTrusted?: boolean; // Must be true (Web Speech API recognition)
  isFallback?: boolean; // Must be false (rejects fake fallback scores)
  recognizedText?: string; // Must not be empty
}

export interface PronunciationImprovementInput {
  attempts?: PronunciationEvidenceItem[];
  weekStart?: Date;
  weekEnd?: Date;
  minTotalSamples?: number; // Default 10
  minWindowSamples?: number; // Default 4
  minDays?: number; // Default 2
}

export interface PronunciationImprovementResult {
  gainScore: number | null; // e.g. +12.4 (null if ineligible)
  baselineAvg: number | null;
  recentAvg: number | null;
  validSampleCount: number;
  distinctDays: number;
  isEligible: boolean;
  sampleWindowBreakdown: {
    baselineCount: number;
    recentCount: number;
  };
}

export const MIN_PRONUNCIATION_TOTAL_SAMPLES = 10;
export const MIN_PRONUNCIATION_WINDOW_SAMPLES = 4;
export const MIN_PRONUNCIATION_DISTINCT_DAYS = 2;

/**
 * Derives Pronunciation Improvement:
 * - Uses trusted valid speech evidence only (excludes unsupported, fallbacks, empty transcripts).
 * - Implements chronological baseline vs recent windowing.
 * - Enforces minimum sample criteria (>= 10 total samples, >= 4 baseline, >= 4 recent, >= 2 days).
 * - Returns isEligible: false (with gainScore: null) rather than 0 when evidence is insufficient.
 * - 100% idempotent and deterministic.
 */
export function derivePronunciationImprovement(
  input: PronunciationImprovementInput = {}
): PronunciationImprovementResult {
  const {
    attempts = [],
    weekStart = getVietnamWeekStart(),
    weekEnd = getVietnamWeekEnd(),
    minTotalSamples = MIN_PRONUNCIATION_TOTAL_SAMPLES,
    minWindowSamples = MIN_PRONUNCIATION_WINDOW_SAMPLES,
    minDays = MIN_PRONUNCIATION_DISTINCT_DAYS,
  } = input;

  const weekStartMs = weekStart.getTime();
  const weekEndMs = weekEnd.getTime();

  const processedIds = new Set<string>();
  const validAttempts: PronunciationEvidenceItem[] = [];
  const distinctDates = new Set<string>();

  for (const item of attempts) {
    if (!item || !item.id || processedIds.has(item.id)) continue;
    processedIds.add(item.id);

    // Filter 1: Valid speech evidence only
    if (item.isTrusted === false || item.isFallback === true) continue;
    if (typeof item.score !== 'number' || Number.isNaN(item.score) || item.score < 0 || item.score > 100) continue;
    if (!item.recognizedText || item.recognizedText.trim().length === 0) continue;

    // Filter 2: Timestamp in week window
    const ts = Date.parse(item.timestamp);
    if (Number.isNaN(ts) || ts < weekStartMs || ts >= weekEndMs) continue;

    validAttempts.push(item);
    const vnDate = getVietnamDateString(ts);
    if (vnDate) distinctDates.add(vnDate);
  }

  // Sort chronologically
  validAttempts.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  const totalCount = validAttempts.length;
  const distinctDays = distinctDates.size;

  // Eligibility check: require enough samples and at least minDays
  if (totalCount < minTotalSamples || distinctDays < minDays) {
    return {
      gainScore: null,
      baselineAvg: null,
      recentAvg: null,
      validSampleCount: totalCount,
      distinctDays,
      isEligible: false,
      sampleWindowBreakdown: { baselineCount: 0, recentCount: 0 },
    };
  }

  // Split into baseline (first half) and recent (second half)
  const midpoint = Math.floor(totalCount / 2);
  const baselineSlice = validAttempts.slice(0, midpoint);
  const recentSlice = validAttempts.slice(midpoint);

  if (baselineSlice.length < minWindowSamples || recentSlice.length < minWindowSamples) {
    return {
      gainScore: null,
      baselineAvg: null,
      recentAvg: null,
      validSampleCount: totalCount,
      distinctDays,
      isEligible: false,
      sampleWindowBreakdown: {
        baselineCount: baselineSlice.length,
        recentCount: recentSlice.length,
      },
    };
  }

  const baselineSum = baselineSlice.reduce((sum, item) => sum + item.score, 0);
  const recentSum = recentSlice.reduce((sum, item) => sum + item.score, 0);

  const baselineAvg = Math.round((baselineSum / baselineSlice.length) * 10) / 10;
  const recentAvg = Math.round((recentSum / recentSlice.length) * 10) / 10;
  const gainScore = Math.round((recentAvg - baselineAvg) * 10) / 10;

  return {
    gainScore,
    baselineAvg,
    recentAvg,
    validSampleCount: totalCount,
    distinctDays,
    isEligible: true,
    sampleWindowBreakdown: {
      baselineCount: baselineSlice.length,
      recentCount: recentSlice.length,
    },
  };
}

// ============================================================================
// TOEIC GAIN (Valid Assessment History & LR/SW Category Isolation)
// ============================================================================

export interface ToeicGainInput {
  sessions?: any[];
  weekStart?: Date;
  weekEnd?: Date;
  minAttemptDurationSeconds?: number;
  antiAbuseCooldownHours?: number;
}

export interface ToeicGainResult {
  lrGain: number | null; // Scale 10..990
  swGain: number | null; // Scale 0..400
  normalizedGainPct: number | null; // 0..100%
  isEligible: boolean; // Requires >= 2 valid attempts
  totalValidAttempts: number;
  baselineAttempt?: {
    id: string;
    date: string;
    skillScope: string;
    totalScore: number;
  };
  latestAttempt?: {
    id: string;
    date: string;
    skillScope: string;
    totalScore: number;
  };
}

export const MIN_TOEIC_ATTEMPT_DURATION_SECONDS = 60;
export const TOEIC_REPEATED_TEST_COOLDOWN_HOURS = 48;

/**
 * Derives TOEIC Gain:
 * - Uses completed, valid assessments only.
 * - Excludes previews, abandons, instant submissions (< 60s), practice modes with retries.
 * - Isolates LR (990) and SW (400) without ever adding 990 + 400 directly.
 * - Implements Repeated-test anti-abuse: identical test repeated within 48h is excluded from Gain.
 * - Enforces minimum 2 valid attempts for eligibility (returns isEligible: false when < 2).
 */
export function deriveToeicGain(input: ToeicGainInput = {}): ToeicGainResult {
  const {
    sessions = [],
    weekStart = getVietnamWeekStart(),
    weekEnd = getVietnamWeekEnd(),
    minAttemptDurationSeconds = MIN_TOEIC_ATTEMPT_DURATION_SECONDS,
    antiAbuseCooldownHours = TOEIC_REPEATED_TEST_COOLDOWN_HOURS,
  } = input;

  const weekStartMs = weekStart.getTime();
  const weekEndMs = weekEnd.getTime();
  const cooldownMs = antiAbuseCooldownHours * 3600 * 1000;

  const processedIds = new Set<string>();
  const lastAttemptByExamKey = new Map<string, number>();
  const validSessions: any[] = [];

  // Sort all sessions chronologically first
  const sorted = [...sessions].sort((a, b) => Date.parse(a.date || '') - Date.parse(b.date || ''));

  for (const s of sorted) {
    if (!s || !s.id || processedIds.has(s.id)) continue;
    processedIds.add(s.id);

    // Rule 1: Completed, valid scoring structure
    const totalScore = typeof s.totalScore === 'number' ? s.totalScore : 0;
    if (totalScore <= 0) continue;

    // Rule 2: Duration check (exclude previews / instant abandons)
    const timeSpent = typeof s.timeSpentSeconds === 'number'
      ? s.timeSpentSeconds
      : typeof s.analytics?.overall?.timeSpentSeconds === 'number'
      ? s.analytics.overall.timeSpentSeconds
      : typeof s.analytics?.overall?.durationSeconds === 'number'
      ? s.analytics.overall.durationSeconds
      : 0;
    if (timeSpent < minAttemptDurationSeconds) continue;

    // Rule 3: Must be formal mock/diagnostic test (exclude practice mode)
    const isPractice = s.experienceMode === 'practice' || (typeof s.mode === 'string' && s.mode.includes('practice'));
    if (isPractice) continue;

    const isMock = s.experienceMode === 'mock' || 
                   s.experienceMode === 'diagnostic' ||
                   (typeof s.mode === 'string' && s.mode.includes('mock')) ||
                   (s.totalQuestions >= 30);
    if (!isMock) continue;

    // Rule 4: Repeated-test anti-abuse:
    // If the exact same exam is repeated within cooldown window, exclude from competitive gain
    const examKey = [
      (s.title || '').trim().toLowerCase(),
      (s.experienceConfig?.selectedExamId || s.mode || '').trim().toLowerCase()
    ].filter(Boolean).join('_') || 'default_exam';
    const attemptMs = Date.parse(s.date || '');
    if (Number.isNaN(attemptMs)) continue;

    const lastSeenMs = lastAttemptByExamKey.get(examKey);
    if (lastSeenMs !== undefined && attemptMs - lastSeenMs < cooldownMs) {
      continue; // Skip repeated attempt within cooldown
    }
    lastAttemptByExamKey.set(examKey, attemptMs);

    validSessions.push(s);
  }

  // Filter valid sessions in target week window
  const weeklySessions = validSessions.filter((s) => {
    const ms = Date.parse(s.date || '');
    return ms >= weekStartMs && ms < weekEndMs;
  });

  // Separate LR and SW sessions cleanly to prevent overlap
  const isSwSession = (s: any) =>
    s.skillScope === '4-skills' ||
    s.skillScope === '4skills' ||
    s.mode === '4skills' ||
    (typeof s.speakingScore === 'number' && typeof s.writingScore === 'number' && typeof s.listeningScore !== 'number');

  const lrSessions = weeklySessions.filter((s) => !isSwSession(s) && s.totalScore <= 990);
  const swSessions = weeklySessions.filter((s) => isSwSession(s) && s.totalScore <= 400);

  let lrGain: number | null = null;
  let swGain: number | null = null;
  let normalizedGainPct: number | null = null;
  let baselineAttempt: any;
  let latestAttempt: any;

  if (lrSessions.length >= 2) {
    const baseline = lrSessions[0];
    const latest = lrSessions[lrSessions.length - 1];
    lrGain = Math.round(latest.totalScore - baseline.totalScore);
    baselineAttempt = { id: baseline.id, date: baseline.date, skillScope: '2-skills', totalScore: baseline.totalScore };
    latestAttempt = { id: latest.id, date: latest.date, skillScope: '2-skills', totalScore: latest.totalScore };
    normalizedGainPct = Math.round((lrGain / 990) * 100 * 10) / 10;
  }

  if (swSessions.length >= 2) {
    const baseline = swSessions[0];
    const latest = swSessions[swSessions.length - 1];
    swGain = Math.round(latest.totalScore - baseline.totalScore);
    if (!baselineAttempt) {
      baselineAttempt = { id: baseline.id, date: baseline.date, skillScope: '4-skills', totalScore: baseline.totalScore };
      latestAttempt = { id: latest.id, date: latest.date, skillScope: '4-skills', totalScore: latest.totalScore };
    }
    const swNorm = Math.round((swGain / 400) * 100 * 10) / 10;
    normalizedGainPct = normalizedGainPct !== null ? Math.round(((normalizedGainPct + swNorm) / 2) * 10) / 10 : swNorm;
  }

  const isEligible = lrGain !== null || swGain !== null;

  return {
    lrGain,
    swGain,
    normalizedGainPct,
    isEligible,
    totalValidAttempts: weeklySessions.length,
    baselineAttempt,
    latestAttempt,
  };
}

// ============================================================================
// PRONUNCIATION EVIDENCE LOCAL PERSISTENCE
// ============================================================================

export const STORAGE_KEY_PRONUNCIATION_ATTEMPTS = 'english_mastery_pronunciation_attempts';

export function savePronunciationAttempt(attempt: PronunciationEvidenceItem): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const existing = loadPronunciationAttempts();
    const updated = [attempt, ...existing.filter((a) => a.id !== attempt.id)].slice(0, 300);
    localStorage.setItem(STORAGE_KEY_PRONUNCIATION_ATTEMPTS, JSON.stringify(updated));
  } catch (err) {
    console.warn('[PronunciationStorage] Không thể lưu mẫu phát âm:', err);
  }
}

export function loadPronunciationAttempts(): PronunciationEvidenceItem[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY_PRONUNCIATION_ATTEMPTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearPronunciationAttemptsForTesting(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_PRONUNCIATION_ATTEMPTS);
    }
  } catch {
    // ignore
  }
}

// ============================================================================
// SHARED QUALITY-METRIC DERIVATION & CLOUD SYNCHRONIZATION FOUNDATION (PHASE 5)
// ============================================================================

export interface DeriveLeaderboardMetricsOptions {
  userId?: string;
  refDate?: Date;
  pronunciationAttempts?: PronunciationEvidenceItem[];
  toeicSessions?: any[];
  activeSessions?: ActiveSessionRecord[];
}

export interface SharedWeeklyMetricsDerivationResult {
  weekId: string;
  weeklyXp: number;
  vocabMastered: number;
  reviewConsistency: number | null;
  activeMinutes: number;
  pronunciationGain: number | null;
  toeicGain: number | null;
  evidence: {
    vocab_transitions: number;
    active_sessions: number;
    pronunciation_samples: number;
    pronunciation_days: number;
    toeic_attempts: number;
    eligible_review_days?: number;
    completed_review_days?: number;
    [key: string]: unknown;
  };
  eligibility: {
    vocab: boolean;
    consistency: boolean;
    minutes: boolean;
    pronunciation: boolean;
    toeic: boolean;
  };
}

/**
 * Pure derivation engine for all 5 Leaderboard Quality Metrics + Weekly XP:
 * - vocab_mastered
 * - review_consistency
 * - active_minutes
 * - pronunciation_gain
 * - toeic_gain
 * 
 * Invariants:
 * 1. Pure derivation: Zero store mutations.
 * 2. Fresh state: Always inspects fresh domain evidence.
 * 3. Eligibility normalization: Preserves null semantics for ineligible metrics rather than faking 0.
 * 4. Canonical week & day boundaries strictly adhere to Asia/Ho_Chi_Minh (UTC+7).
 */
export function deriveLeaderboardLearningMetrics(
  state?: any,
  options?: DeriveLeaderboardMetricsOptions
): SharedWeeklyMetricsDerivationResult {
  const effectiveState = state || (getCloudSyncStoreState ? getCloudSyncStoreState() : null) || {};
  const refDate = options?.refDate || getAuthoritativeServerNow();
  const weekId = getAuthoritativeVietnamWeekId(refDate);
  const weekStart = getVietnamWeekStart(refDate);
  const weekEnd = getVietnamWeekEnd(refDate);

  // 1. Weekly XP (0..50000)
  const weeklyXp = calculateWeeklyXpFromHistory(effectiveState.dailyHistory || {}, refDate);

  // 2. Vocabulary Mastery
  const lifetimeMastery = deriveLifetimeVocabularyMastery({
    srsProgressMap: effectiveState.srsProgressMap || {},
    userCollocations: effectiveState.userCollocations || [],
    vocabularyList: effectiveState.vocabularyList || [],
    algorithmPreference: effectiveState.srsAlgorithm,
  });

  const weeklyTransitions = deriveWeeklyMasteryTransitions(
    effectiveState.srsProgressMap || {},
    effectiveState.recentReviewEvents || [],
    weekStart,
    weekEnd,
    effectiveState.vocabularyList || []
  );

  const vocabMastered = lifetimeMastery.totalMasteredCount;

  // 3. Review Consistency (0..100)
  const consistencyResult = deriveReviewConsistency({
    dailyHistory: effectiveState.dailyHistory || {},
    srsProgressMap: effectiveState.srsProgressMap || {},
    recentReviewEvents: effectiveState.recentReviewEvents || [],
    refDate,
  });

  const reviewConsistency = consistencyResult.isEligibleForRanking
    ? Math.round(consistencyResult.consistencyScore * 100) / 100
    : null;

  // 4. Active Minutes (0..10080)
  const activeSessions = options?.activeSessions;
  const activeResult = deriveActiveLearningMinutes(activeSessions, weekStart, weekEnd);
  const activeMinutes = activeResult.totalActiveMinutes;

  // 5. Pronunciation Gain (-100..100)
  const pronAttempts = options?.pronunciationAttempts ?? loadPronunciationAttempts();
  const pronResult = derivePronunciationImprovement({
    attempts: pronAttempts,
    weekStart,
    weekEnd,
  });
  const pronunciationGain = pronResult.isEligible ? pronResult.gainScore : null;

  // 6. TOEIC Gain (-990..990)
  const toeicSessions = options?.toeicSessions ?? loadToeicHistory();
  const toeicResult = deriveToeicGain({
    sessions: toeicSessions,
    weekStart,
    weekEnd,
  });

  let toeicGain: number | null = null;
  if (toeicResult.isEligible) {
    if (toeicResult.lrGain !== null) {
      toeicGain = Math.round(toeicResult.lrGain);
    } else if (toeicResult.swGain !== null) {
      toeicGain = Math.round(toeicResult.swGain);
    }
  }

  // Supporting Evidence
  const evidence = {
    vocab_transitions: weeklyTransitions.newlyMasteredCount,
    active_sessions: activeResult.sessionCount,
    pronunciation_samples: pronResult.validSampleCount,
    pronunciation_days: pronResult.distinctDays,
    toeic_attempts: toeicResult.totalValidAttempts,
    consistency_days: consistencyResult.completedReviewDays,
    eligible_review_days: consistencyResult.eligibleReviewDays,
    completed_review_days: consistencyResult.completedReviewDays,
  };

  const eligibility = {
    vocab: vocabMastered > 0,
    consistency: consistencyResult.isEligibleForRanking,
    minutes: activeMinutes >= 15,
    pronunciation: pronResult.isEligible,
    toeic: toeicResult.isEligible,
  };

  return {
    weekId,
    weeklyXp,
    vocabMastered,
    reviewConsistency,
    activeMinutes,
    pronunciationGain,
    toeicGain,
    evidence,
    eligibility,
  };
}

let activeDerivedSyncPromise: Promise<SyncWeeklyLearningMetricsResponse> | null = null;
let pendingDerivedSync = false;

/**
 * Shared Cloud Synchronization Coordinator for Weekly Learning Metrics.
 * Reusable across all learning activities (Phase 6–8) without creating duplicated sync engines.
 */
export async function syncDerivedLearningMetrics(
  userId?: string,
  options?: DeriveLeaderboardMetricsOptions
): Promise<SyncWeeklyLearningMetricsResponse> {
  const syncState = useCloudSyncStore.getState();
  const targetUserId = userId || syncState.userId;
  if (!targetUserId) {
    return {
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Yêu cầu đăng nhập để đồng bộ chỉ số học tập.',
    };
  }

  if (!syncState.isOnline) {
    return {
      success: false,
      code: 'OFFLINE',
      message: 'Thiết bị đang ngoại tuyến. Dữ liệu học tập được bảo lưu cục bộ.',
    };
  }

  // Concurrency coalescing: If a sync is already running, queue follow-up to guarantee fresh state
  if (activeDerivedSyncPromise) {
    pendingDerivedSync = true;
    const res = await activeDerivedSyncPromise;
    if (pendingDerivedSync) {
      pendingDerivedSync = false;
      return syncDerivedLearningMetrics(targetUserId, options);
    }
    return res;
  }

  activeDerivedSyncPromise = (async () => {
    try {
      // 1. Fresh state guaranteed right before sync
      const freshStore = getCloudSyncStoreState ? getCloudSyncStoreState() : null;

      // 2. Pure derivation across all 5 quality metrics + weekly XP
      const derived = deriveLeaderboardLearningMetrics(freshStore, {
        userId: targetUserId,
        refDate: options?.refDate,
        pronunciationAttempts: options?.pronunciationAttempts,
        toeicSessions: options?.toeicSessions,
        activeSessions: options?.activeSessions,
      });

      // 3. Dispatch to server-authoritative weekly_learning_metrics table via canonical RPC/upsert
      return await syncWeeklyLearningMetricsToServer({
        userId: targetUserId,
        weekId: derived.weekId,
        weeklyXp: derived.weeklyXp,
        vocabMastered: derived.vocabMastered,
        reviewConsistency: derived.reviewConsistency,
        activeMinutes: derived.activeMinutes,
        pronunciationGain: derived.pronunciationGain,
        toeicGain: derived.toeicGain,
        evidence: derived.evidence,
      });
    } finally {
      activeDerivedSyncPromise = null;
    }
  })();

  return await activeDerivedSyncPromise;
}

