// src/services/adaptiveMistakeService.ts
// Pure service for Adaptive Mistake & Practice Engine.
// Provides canonical taxonomy normalization, cause classification (typos vs semantic confusion),
// profile derivation, weakness analytics, and deterministic adaptive scoring.
// Zero external dependencies.

import {
  MistakeRecord,
  MistakeType,
  MistakeSource,
  CanonicalMistakeSource,
  MistakeCauseAnalysis,
  MistakeEvent,
  AdaptiveMistakeProfile,
  WeaknessSummary,
  MistakeRecurrenceLevel,
  TypeResolutionState,
  TypeWeaknessDetail,
  ItemWeaknessRank,
  WeaknessDiagnosticInsight,
  DetailedWeaknessReport,
  VocabWord,
} from '../types';
import { cleanWordToken, resolveCanonicalVocab } from './wordLookupService';

export const VALID_MISTAKE_TYPES: readonly MistakeType[] = [
  'meaning',
  'spelling',
  'listening',
  'pronunciation',
  'collocation',
  'grammar',
  'reading',
  'writing',
  'other',
] as const;

export const VALID_CANONICAL_SOURCES: readonly CanonicalMistakeSource[] = [
  'flashcard',
  'classic_quiz',
  'word_scramble',
  'dictation',
  'speed_match',
  'pronunciation',
  'listening',
  'reading',
  'writing',
  'collocation',
  'translator',
  'four_skills',
  'ai_tutor',
  'custom',
  'other',
] as const;

/**
 * Standard system thresholds for pronunciation evaluation in Four Skills / Pronunciation Arena:
 * - Accuracy strictly < 60: Failure -> records pronunciation mistake into Mistake Bank.
 * - Accuracy between 60 and 74 (inclusive): Neutral -> does not trigger new mistake, does not resolve.
 * - Accuracy >= 75: Mastery / Pass -> advances resolution and marks pronunciation correct.
 */
export const PRONUNCIATION_FAIL_THRESHOLD = 60;
export const PRONUNCIATION_PASS_THRESHOLD = 75;

/**
 * Standard mapping from learning sources to default mistake types.
 * Used when a caller does not provide an explicit MistakeType.
 */
export const SOURCE_TO_DEFAULT_TYPE_MAP: Record<string, MistakeType> = {
  flashcard: 'meaning',
  srs_again: 'meaning',
  classic_quiz: 'meaning',
  quiz: 'meaning',
  speed_match: 'meaning',
  word_scramble: 'spelling',
  scramble: 'spelling',
  dictation: 'spelling',
  pronunciation: 'pronunciation',
  listening: 'listening',
  reading: 'reading',
  writing: 'writing',
  collocation: 'collocation',
  translator: 'other',
  four_skills: 'other',
  ai_tutor: 'other',
  tutor: 'other',
  custom: 'other',
  other: 'other',
};

export interface ListeningTargetResolution {
  isVocabTarget: boolean;
  targetId: string;
  targetWord: string;
  meaning: string;
  example: string;
  ipa: string;
}

/**
 * Pure helper: Resolve listening question target semantics (Vocabulary-targeted vs General comprehension).
 * Distinguishes explicit vocabulary questions from general passage comprehension.
 */
export function resolveListeningQuestionTarget(
  q: { id: string; question: string; type?: string; explanation?: string },
  lessonTitle: string = '',
  vocabularyList: VocabWord[] = []
): ListeningTargetResolution {
  const quotedMatch = q.question.match(/["“]([^"”]+)["”]/) || q.question.match(/'([^']+)'/);
  const candidate = quotedMatch ? quotedMatch[1].trim() : '';

  const isVocabType = q.type === 'vocab_context';
  const canonicalCandidate = candidate ? resolveCanonicalVocab(candidate, vocabularyList) : null;
  const isCandidateValidVocab = Boolean(
    candidate &&
    candidate.split(/\s+/).length <= 4 &&
    (canonicalCandidate?.isExistingInBank || isVocabType)
  );

  if (isVocabType || isCandidateValidVocab) {
    const rawTarget = candidate || q.question;
    const canonical = canonicalCandidate || resolveCanonicalVocab(rawTarget, vocabularyList);
    const targetId = canonical?.canonicalId || `vocab_${rawTarget.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const targetWord = canonical?.canonicalWord.word || rawTarget;
    const meaning = canonical?.canonicalWord.meaning || q.explanation || `Từ vựng bài nghe: ${lessonTitle}`;
    const example = canonical?.canonicalWord.example || lessonTitle;
    const ipa = canonical?.canonicalWord.ipa || '';

    return {
      isVocabTarget: true,
      targetId,
      targetWord,
      meaning,
      example,
      ipa,
    };
  }

  // General comprehension question: no fake vocabulary created, never save long question into word
  return {
    isVocabTarget: false,
    targetId: q.id,
    targetWord: '',
    meaning: q.explanation || `Câu hỏi bài nghe: ${lessonTitle}`,
    example: lessonTitle,
    ipa: '',
  };
}

export interface ReadingTargetResolution {
  isVocabTarget: boolean;
  targetId: string;
  targetWord: string;
  meaning: string;
  example: string;
  ipa: string;
}

/**
 * Pure helper: Resolve reading question target semantics (Vocabulary-targeted vs General comprehension).
 * Distinguishes explicit vocabulary questions from general passage comprehension.
 */
export function resolveReadingQuestionTarget(
  q: { id: string; question: string; type?: string; explanation?: string },
  lessonTitle: string = '',
  vocabularyList: VocabWord[] = []
): ReadingTargetResolution {
  const quotedMatch = q.question.match(/["“]([^"”]+)["”]/) || q.question.match(/'([^']+)'/);
  const candidate = quotedMatch ? quotedMatch[1].trim() : '';

  const isVocabType = q.type === 'vocab_context';
  const canonicalCandidate = candidate ? resolveCanonicalVocab(candidate, vocabularyList) : null;
  const isCandidateValidVocab = Boolean(
    candidate &&
    candidate.split(/\s+/).length <= 4 &&
    (canonicalCandidate?.isExistingInBank || isVocabType)
  );

  if (isVocabType || isCandidateValidVocab) {
    const rawTarget = candidate || q.question;
    const canonical = canonicalCandidate || resolveCanonicalVocab(rawTarget, vocabularyList);
    const targetId = canonical?.canonicalId || `vocab_${rawTarget.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const targetWord = canonical?.canonicalWord.word || rawTarget;
    const meaning = canonical?.canonicalWord.meaning || q.explanation || `Từ vựng bài đọc: ${lessonTitle}`;
    const example = canonical?.canonicalWord.example || lessonTitle;
    const ipa = canonical?.canonicalWord.ipa || '';

    return {
      isVocabTarget: true,
      targetId,
      targetWord,
      meaning,
      example,
      ipa,
    };
  }

  // General comprehension question: no fake vocabulary created, never save long question into word
  return {
    isVocabTarget: false,
    targetId: q.id,
    targetWord: '',
    meaning: q.explanation || `Câu hỏi bài đọc: ${lessonTitle}`,
    example: lessonTitle,
    ipa: '',
  };
}

/**
 * Normalizes any legacy or alias source to its canonical representation.
 * Guarantees that analytics never suffer from bifurcated counters (e.g. srs_again vs flashcard).
 */
export function toCanonicalSource(source?: string | null): CanonicalMistakeSource {
  if (!source) return 'other';
  const clean = source.trim().toLowerCase();
  switch (clean) {
    case 'srs_again':
    case 'flashcard':
      return 'flashcard';
    case 'quiz':
    case 'classic_quiz':
      return 'classic_quiz';
    case 'scramble':
    case 'word_scramble':
      return 'word_scramble';
    case 'speed_match':
      return 'speed_match';
    case 'dictation':
      return 'dictation';
    case 'pronunciation':
    case 'speaking':
      return 'pronunciation';
    case 'listening':
      return 'listening';
    case 'reading':
      return 'reading';
    case 'writing':
      return 'writing';
    case 'collocation':
      return 'collocation';
    case 'translator':
      return 'translator';
    case 'four_skills':
      return 'four_skills';
    case 'ai_tutor':
    case 'tutor':
      return 'ai_tutor';
    case 'custom':
      return 'custom';
    default:
      return 'other';
  }
}

// Retain normalizeMistakeSource as a backward-compatible alias
export const normalizeMistakeSource = toCanonicalSource;

/**
 * Canonicalizes an explicit or inferred mistake type.
 */
export function toCanonicalType(
  type?: string | null,
  source?: string | null
): MistakeType {
  if (type) {
    const cleanType = type.trim().toLowerCase();
    if ((VALID_MISTAKE_TYPES as readonly string[]).includes(cleanType)) {
      return cleanType as MistakeType;
    }
  }
  return inferMistakeType(source || undefined);
}

/**
 * Infers the mistake type based on the source module and an optional explicit override.
 */
export function inferMistakeType(
  source?: MistakeSource | string,
  explicitType?: MistakeType
): MistakeType {
  if (explicitType && (VALID_MISTAKE_TYPES as readonly string[]).includes(explicitType)) {
    return explicitType;
  }
  if (!source) {
    return 'other';
  }
  const cleanSource = source.trim().toLowerCase();
  return SOURCE_TO_DEFAULT_TYPE_MAP[cleanSource] || 'other';
}

/**
 * Reconciles and merges legacy source counts into canonical keys.
 * Example: `{ srs_again: 2, flashcard: 1 }` -> `{ flashcard: 3 }`
 */
export function canonicalizeSourceCounts(
  rawCounts?: Record<string, number | undefined> | null
): Partial<Record<CanonicalMistakeSource, number>> {
  const result: Partial<Record<CanonicalMistakeSource, number>> = {};
  if (!rawCounts) return result;

  for (const [key, count] of Object.entries(rawCounts)) {
    if (typeof count !== 'number' || count <= 0) continue;
    const canon = toCanonicalSource(key);
    result[canon] = (result[canon] || 0) + count;
  }
  return result;
}

/**
 * Computes deterministic Levenshtein distance between two strings.
 */
export function calculateLevenshteinDistance(a: string, b: string): number {
  const s1 = a.trim().toLowerCase();
  const s2 = b.trim().toLowerCase();
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;

  const dp: number[] = Array.from({ length: s2.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s1.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= s2.length; j++) {
      const temp = dp[j];
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[s2.length];
}

/**
 * Classifies the root cause and sub-reason of a mistake deterministically.
 */
export function classifyMistakeCause(options: {
  source?: string;
  type?: MistakeType;
  userAnswer?: string;
  expectedAnswer?: string;
}): MistakeCauseAnalysis {
  const canonicalSource = toCanonicalSource(options.source);
  const primaryType = toCanonicalType(options.type, canonicalSource);
  const user = options.userAnswer?.trim();
  const expected = options.expectedAnswer?.trim();

  let isTypo = false;
  let levenshteinDistance: number | undefined;
  let subReason: MistakeCauseAnalysis['subReason'] = 'general_recall_failure';

  if (primaryType === 'spelling') {
    if (user && expected) {
      levenshteinDistance = calculateLevenshteinDistance(user, expected);
      const maxLen = Math.max(user.length, expected.length);
      // Typo rule:
      // - Từ <= 3 ký tự không coi là typo (tránh false positive như cat -> car, it -> is)
      // - Khoảng cách 1 ký tự đối với từ có độ dài >= 4
      // - Khoảng cách 2 ký tự đối với từ dài >= 6
      const isMinorTypo = levenshteinDistance > 0 && (
        (levenshteinDistance === 1 && maxLen >= 4) ||
        (levenshteinDistance === 2 && maxLen >= 6)
      );

      if (isMinorTypo) {
        isTypo = true;
        subReason = 'minor_typo';
      } else {
        subReason = 'spelling_gap';
      }
    } else {
      subReason = 'spelling_gap';
    }
  } else if (primaryType === 'meaning') {
    subReason = 'semantic_confusion';
  } else if (primaryType === 'pronunciation') {
    subReason = 'phonetic_divergence';
  } else if (primaryType === 'collocation') {
    subReason = 'collocation_mismatch';
  } else if (primaryType === 'grammar') {
    subReason = 'grammar_error';
  }

  return {
    primaryType,
    canonicalSource,
    subReason,
    isTypo,
    levenshteinDistance,
  };
}

/**
 * Factory for a discrete MistakeEvent.
 */
export function createMistakeEvent(input: {
  id?: string;
  itemId?: string;
  word?: string;
  phrase?: string;
  type?: MistakeType;
  source?: MistakeSource | string;
  userAnswer?: string;
  expectedAnswer?: string;
  context?: string;
  occurredAt?: number;
}): MistakeEvent {
  const normSource = toCanonicalSource(input.source);
  const inferredType = toCanonicalType(input.type, normSource);
  const analysis = classifyMistakeCause({
    source: normSource,
    type: inferredType,
    userAnswer: input.userAnswer,
    expectedAnswer: input.expectedAnswer,
  });

  return {
    id: input.id || `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    itemId: input.itemId,
    word: input.word?.trim(),
    phrase: input.phrase?.trim(),
    type: inferredType,
    source: normSource,
    occurredAt: input.occurredAt ?? Date.now(),
    userAnswer: input.userAnswer?.trim(),
    expectedAnswer: input.expectedAnswer?.trim(),
    context: input.context?.trim(),
    analysis,
  };
}

/**
 * Calculates a deterministic priority / adaptive score (0 to 100) for a mistake record.
 * Factors:
 * - Frequency: mistakeCount
 * - Recency decay: how recently the mistake occurred
 * - Reopen penalty: whether it was resolved and subsequently failed again
 * - Status: resolved items receive a steep reduction (x0.15)
 */
export function calculateAdaptiveScore(
  record: MistakeRecord | AdaptiveMistakeProfile,
  options?: { now?: number }
): number {
  const now = options?.now ?? Date.now();
  const mistakeCount = 'totalMistakes' in record ? record.totalMistakes : (record.mistakeCount || record.wrongCount || 1);
  const consecutiveCorrect = record.consecutiveCorrect || 0;
  const isResolved = Boolean(record.resolved);
  const reopenCount = 'reopenCount' in record ? (record.reopenCount || 0) : ('recurrenceCount' in record ? (record.recurrenceCount || 0) : 0);

  // Parse lastMistakeAt timestamp
  let lastMistakeMs: number;
  if ('lastMistakeAt' in record) {
    if (typeof record.lastMistakeAt === 'number') {
      lastMistakeMs = record.lastMistakeAt;
    } else {
      const parsed = Date.parse(record.lastMistakeAt);
      lastMistakeMs = Number.isNaN(parsed) ? now : parsed;
    }
  } else {
    lastMistakeMs = now;
  }

  // 1. Base frequency score (up to 45 pts)
  const frequencyScore = Math.min(45, mistakeCount * 12);

  // 2. Reopen / recurrence penalty (up to 25 pts)
  const recurrencePenalty = Math.min(25, reopenCount * 15);

  // 3. Consecutive correct credit (reduces score if moving towards resolution, up to 15 pts discount)
  const masteryDiscount = Math.min(15, consecutiveCorrect * 8);

  // 4. Recency factor [0.4 .. 1.0]
  const elapsedDays = Math.max(0, (now - lastMistakeMs) / (1000 * 60 * 60 * 24));
  let recencyMultiplier = 1.0;
  if (elapsedDays > 14) {
    recencyMultiplier = 0.4;
  } else if (elapsedDays > 7) {
    recencyMultiplier = 0.6;
  } else if (elapsedDays > 3) {
    recencyMultiplier = 0.8;
  } else if (elapsedDays > 1) {
    recencyMultiplier = 0.95;
  }

  // Combine raw score (min 5, max 100)
  const baseRaw = Math.max(5, (frequencyScore + recurrencePenalty + 15 - masteryDiscount));
  const timeAdjusted = baseRaw * recencyMultiplier;

  // 5. Resolved damping: resolved mistakes are discounted by 85%
  const finalScore = isResolved ? timeAdjusted * 0.15 : timeAdjusted;

  return Math.round(Math.min(100, Math.max(0, finalScore)) * 10) / 10;
}

/**
 * Determines the recurrence level of a mistake:
 * - 'stabilized': currently resolved, or has consecutiveCorrect >= 2.
 * - 'chronic': active failure with high recurrence (totalMistakes >= 4 OR reopenCount >= 2).
 * - 'recurrent': active failure repeated across sessions (totalMistakes >= 2 OR reopenCount >= 1).
 * - 'emerging': active failure seen only once with no history of reopening.
 */
export function getMistakeRecurrenceLevel(
  record: MistakeRecord | AdaptiveMistakeProfile
): MistakeRecurrenceLevel {
  const isResolved = Boolean(record.resolved);
  const consecutiveCorrect = record.consecutiveCorrect || 0;
  if (isResolved || consecutiveCorrect >= 2) {
    return 'stabilized';
  }

  const mistakes = 'totalMistakes' in record
    ? record.totalMistakes
    : (record.mistakeCount || record.wrongCount || 1);
  const reopens = 'reopenCount' in record
    ? (record.reopenCount || 0)
    : ('recurrenceCount' in record ? (record.recurrenceCount || 0) : 0);

  if (mistakes >= 4 || reopens >= 2) {
    return 'chronic';
  }
  if (mistakes >= 2 || reopens >= 1) {
    return 'recurrent';
  }
  return 'emerging';
}

/**
 * Transforms any MistakeRecord (legacy or modern) into a normalized AdaptiveMistakeProfile.
 * Strictly derived on the fly without persistence duplication.
 */
export function toAdaptiveProfile(record: MistakeRecord, now?: number): AdaptiveMistakeProfile {
  const normSource = toCanonicalSource(record.source);
  const primaryType = toCanonicalType(record.primaryType, normSource);
  const totalMistakes = record.mistakeCount || record.wrongCount || 1;

  // Build canonical type breakdown
  const typeCounts: Partial<Record<MistakeType, number>> = {};
  if (record.typeCounts && Object.keys(record.typeCounts).length > 0) {
    for (const [t, c] of Object.entries(record.typeCounts)) {
      const canonType = toCanonicalType(t);
      typeCounts[canonType] = (typeCounts[canonType] || 0) + (c || 0);
    }
  } else {
    typeCounts[primaryType] = totalMistakes;
  }

  // Build canonical source breakdown (consolidates legacy aliases)
  const sourceCounts = canonicalizeSourceCounts(record.sourceCounts);
  if (Object.keys(sourceCounts).length === 0) {
    sourceCounts[normSource] = totalMistakes;
  }

  const lastMistakeMs = record.lastMistakeAt ? (Date.parse(record.lastMistakeAt) || Date.now()) : Date.now();
  const firstSeenMs = record.firstSeenAt
    ? (Date.parse(record.firstSeenAt) || lastMistakeMs)
    : lastMistakeMs;
  const lastCorrectMs = record.lastCorrectAt ? (Date.parse(record.lastCorrectAt) || undefined) : undefined;

  const profile: AdaptiveMistakeProfile = {
    id: record.id,
    word: record.word,
    totalMistakes,
    typeCounts,
    sourceCounts,
    consecutiveCorrect: record.consecutiveCorrect || 0,
    resolved: Boolean(record.resolved),
    firstSeenAt: firstSeenMs,
    lastMistakeAt: lastMistakeMs,
    lastCorrectAt: lastCorrectMs,
    recurrenceCount: record.reopenCount || 0,
    primaryType,
    typeResolutionMap: record.typeResolutionMap,
  };

  profile.recurrenceLevel = getMistakeRecurrenceLevel(profile);
  profile.adaptiveScore = calculateAdaptiveScore(profile, { now });
  return profile;
}

/**
 * Aggregates all mistake records to produce a high-level WeaknessSummary.
 * Ensures that all source and type categories are canonicalized.
 */
export function calculateWeaknessSummary(
  mistakes: Record<string, MistakeRecord> | MistakeRecord[]
): WeaknessSummary {
  const list = Array.isArray(mistakes) ? mistakes : Object.values(mistakes || {});
  
  let totalMistakes = 0;
  let unresolvedCount = 0;
  let resolvedCount = 0;
  let recurrentMistakeCount = 0;
  let totalConsecutive = 0;

  const typeBreakdown: Partial<Record<MistakeType, number>> = {};
  const sourceBreakdown: Partial<Record<CanonicalMistakeSource, number>> = {};
  const unresolvedTypeBreakdown: Partial<Record<MistakeType, number>> = {};

  for (const item of list) {
    if (!item || !item.word) continue;
    const count = item.mistakeCount || item.wrongCount || 1;
    totalMistakes += count;
    totalConsecutive += item.consecutiveCorrect || 0;

    if (item.resolved) {
      resolvedCount++;
    } else {
      unresolvedCount++;
    }

    if ((item.reopenCount || 0) > 0) {
      recurrentMistakeCount++;
    }

    const itemSource = toCanonicalSource(item.source);
    const itemType = toCanonicalType(item.primaryType, itemSource);

    // Sum types
    if (item.typeCounts && Object.keys(item.typeCounts).length > 0) {
      for (const [t, c] of Object.entries(item.typeCounts)) {
        const typeKey = toCanonicalType(t);
        typeBreakdown[typeKey] = (typeBreakdown[typeKey] || 0) + (c || 0);
        if (!item.resolved) {
          unresolvedTypeBreakdown[typeKey] = (unresolvedTypeBreakdown[typeKey] || 0) + (c || 0);
        }
      }
    } else {
      typeBreakdown[itemType] = (typeBreakdown[itemType] || 0) + count;
      if (!item.resolved) {
        unresolvedTypeBreakdown[itemType] = (unresolvedTypeBreakdown[itemType] || 0) + count;
      }
    }

    // Sum sources with canonical normalization (prevent bifurcated counters!)
    if (item.sourceCounts && Object.keys(item.sourceCounts).length > 0) {
      const canonicalCounts = canonicalizeSourceCounts(item.sourceCounts);
      for (const [s, c] of Object.entries(canonicalCounts)) {
        const srcKey = s as CanonicalMistakeSource;
        sourceBreakdown[srcKey] = (sourceBreakdown[srcKey] || 0) + (c || 0);
      }
    } else {
      sourceBreakdown[itemSource] = (sourceBreakdown[itemSource] || 0) + count;
    }
  }

  // Find primary weakness type (priority to unresolved mistakes)
  let primaryWeaknessType: MistakeType | null = null;
  let maxCount = 0;
  const targetTypePool = unresolvedCount > 0 ? unresolvedTypeBreakdown : typeBreakdown;

  for (const [t, c] of Object.entries(targetTypePool)) {
    if ((c || 0) > maxCount) {
      maxCount = c || 0;
      primaryWeaknessType = t as MistakeType;
    }
  }

  const averageConsecutiveCorrect = list.length > 0
    ? Math.round((totalConsecutive / list.length) * 10) / 10
    : 0;

  return {
    totalMistakes,
    unresolvedCount,
    resolvedCount,
    typeBreakdown,
    sourceBreakdown,
    primaryWeaknessType,
    recurrentMistakeCount,
    averageConsecutiveCorrect,
  };
}

/**
 * Detects and returns mistake records filtered by recurrence level.
 * By default returns all unresolved recurrent and chronic mistakes sorted by adaptive score descending.
 */
export function detectRecurrentMistakes(
  mistakes: Record<string, MistakeRecord> | MistakeRecord[],
  options?: {
    levels?: MistakeRecurrenceLevel[];
    now?: number;
    includeResolved?: boolean;
  }
): MistakeRecord[] {
  const list = Array.isArray(mistakes) ? mistakes : Object.values(mistakes || {});
  const targetLevels = options?.levels ?? ['chronic', 'recurrent'];
  const includeResolved = Boolean(options?.includeResolved);
  const now = options?.now ?? Date.now();

  return list
    .filter((item) => {
      if (!item || !item.word) return false;
      if (!includeResolved && item.resolved) return false;
      const level = getMistakeRecurrenceLevel(item);
      return targetLevels.includes(level);
    })
    .sort((a, b) => {
      const scoreA = calculateAdaptiveScore(a, { now });
      const scoreB = calculateAdaptiveScore(b, { now });
      return scoreB - scoreA;
    });
}

/**
 * Pure helper to update a record's typeResolutionMap when a new mistake occurs for a specific type.
 * Tracks mistake count, resets consecutive correct, marks unresolved, and detects reopening per type.
 */
export function updateTypeResolutionOnMistake(
  currentMap: Partial<Record<MistakeType, TypeResolutionState>> | undefined,
  type: MistakeType,
  nowIso: string = new Date().toISOString()
): Partial<Record<MistakeType, TypeResolutionState>> {
  const nextMap: Partial<Record<MistakeType, TypeResolutionState>> = { ...(currentMap || {}) };
  const prev = nextMap[type];

  const wasResolved = Boolean(prev?.resolved);
  const reopenCount = (prev?.reopenCount || 0) + (wasResolved ? 1 : 0);
  const mistakeCount = (prev?.mistakeCount || 0) + 1;

  nextMap[type] = {
    mistakeCount,
    consecutiveCorrect: 0,
    resolved: false,
    lastMistakeAt: nowIso,
    reopenCount,
  };

  return nextMap;
}

export interface TypeResolutionCorrectResult {
  updatedMap: Partial<Record<MistakeType, TypeResolutionState>>;
  allResolved: boolean;
  newlyResolvedTypes: MistakeType[];
}

/**
 * Pure helper to advance resolution progress in typeResolutionMap when a word is answered correctly.
 * If a specific type is targeted, advances only that type.
 * If no specific type is provided (e.g. general review), advances all active unresolved types in the map.
 * When consecutiveCorrect reaches threshold (default 2), marks type as resolved.
 */
export function updateTypeResolutionOnCorrect(
  currentMap: Partial<Record<MistakeType, TypeResolutionState>> | undefined,
  type?: MistakeType,
  options?: {
    threshold?: number;
    nowIso?: string;
  }
): TypeResolutionCorrectResult {
  const threshold = options?.threshold ?? 2;
  const nowIso = options?.nowIso ?? new Date().toISOString();
  const nextMap: Partial<Record<MistakeType, TypeResolutionState>> = { ...(currentMap || {}) };
  const newlyResolvedTypes: MistakeType[] = [];

  if (type) {
    const prev = nextMap[type] || {
      mistakeCount: 1,
      consecutiveCorrect: 0,
      resolved: false,
      reopenCount: 0,
    };
    const nextConsecutive = (prev.consecutiveCorrect || 0) + 1;
    const isNowResolved = nextConsecutive >= threshold || Boolean(prev.resolved);
    if (isNowResolved && !prev.resolved) {
      newlyResolvedTypes.push(type);
    }
    nextMap[type] = {
      ...prev,
      consecutiveCorrect: nextConsecutive,
      resolved: isNowResolved,
      resolvedAt: isNowResolved ? (prev.resolvedAt || nowIso) : undefined,
    };
  } else {
    // General review: advance all active unresolved types
    for (const [tKey, state] of Object.entries(nextMap)) {
      if (!state) continue;
      const mType = tKey as MistakeType;
      if (!state.resolved) {
        const nextConsecutive = (state.consecutiveCorrect || 0) + 1;
        const isNowResolved = nextConsecutive >= threshold;
        if (isNowResolved) {
          newlyResolvedTypes.push(mType);
        }
        nextMap[mType] = {
          ...state,
          consecutiveCorrect: nextConsecutive,
          resolved: isNowResolved,
          resolvedAt: isNowResolved ? (state.resolvedAt || nowIso) : undefined,
        };
      }
    }
  }

  const entries = Object.values(nextMap).filter(Boolean) as TypeResolutionState[];
  const allResolved = entries.length > 0 && entries.every((s) => s.resolved);

  return {
    updatedMap: nextMap,
    allResolved,
    newlyResolvedTypes,
  };
}

/**
 * Generates an in-depth, deterministic Weakness & Recurrence Report.
 * Groups mistakes by type, evaluates chronic/recurrent clusters, ranks top struggling items,
 * and produces actionable diagnostic insights without any external API calls.
 */
export function generateDetailedWeaknessReport(
  mistakes: Record<string, MistakeRecord> | MistakeRecord[],
  options?: { now?: number; maxStrugglingItems?: number }
): DetailedWeaknessReport {
  const now = options?.now ?? Date.now();
  const maxStruggling = options?.maxStrugglingItems ?? 10;
  const list = Array.isArray(mistakes) ? mistakes : Object.values(mistakes || {});
  const summary = calculateWeaknessSummary(list);

  const recurrenceCounts = {
    chronic: 0,
    recurrent: 0,
    emerging: 0,
    stabilized: 0,
  };

  const typeDetailsMap: Partial<Record<MistakeType, {
    totalCount: number;
    unresolvedCount: number;
    resolvedCount: number;
    chronicCount: number;
    recurrentCount: number;
    sources: Partial<Record<CanonicalMistakeSource, number>>;
  }>> = {};

  const profiles: AdaptiveMistakeProfile[] = [];

  for (const item of list) {
    if (!item || !item.word) continue;
    const profile = toAdaptiveProfile(item, now);
    profiles.push(profile);

    const level = getMistakeRecurrenceLevel(profile);
    recurrenceCounts[level]++;

    const canonSource = toCanonicalSource(item.source);
    const itemType = toCanonicalType(item.primaryType, canonSource);

    // Track per-type breakdown
    const typeKeys = item.typeCounts && Object.keys(item.typeCounts).length > 0
      ? (Object.keys(item.typeCounts) as MistakeType[])
      : [itemType];

    for (const t of typeKeys) {
      const canonT = toCanonicalType(t);
      if (!typeDetailsMap[canonT]) {
        typeDetailsMap[canonT] = {
          totalCount: 0,
          unresolvedCount: 0,
          resolvedCount: 0,
          chronicCount: 0,
          recurrentCount: 0,
          sources: {},
        };
      }
      const entry = typeDetailsMap[canonT]!;
      const countForType = item.typeCounts?.[canonT] ?? (item.mistakeCount || item.wrongCount || 1);
      entry.totalCount += countForType;

      if (item.resolved) {
        entry.resolvedCount++;
      } else {
        entry.unresolvedCount++;
        if (level === 'chronic') entry.chronicCount++;
        if (level === 'recurrent') entry.recurrentCount++;
      }

      entry.sources[canonSource] = (entry.sources[canonSource] || 0) + countForType;
    }
  }

  // Build typeDetails array
  const typeDetails: TypeWeaknessDetail[] = [];
  for (const t of VALID_MISTAKE_TYPES) {
    const data = typeDetailsMap[t];
    if (!data || data.totalCount === 0) continue;

    let dominantSource: CanonicalMistakeSource | undefined;
    let maxSourceCount = 0;
    for (const [src, sCount] of Object.entries(data.sources)) {
      if ((sCount || 0) > maxSourceCount) {
        maxSourceCount = sCount || 0;
        dominantSource = src as CanonicalMistakeSource;
      }
    }

    const pct = summary.totalMistakes > 0
      ? Math.round((data.totalCount / summary.totalMistakes) * 1000) / 10
      : 0;

    typeDetails.push({
      type: t,
      totalCount: data.totalCount,
      unresolvedCount: data.unresolvedCount,
      resolvedCount: data.resolvedCount,
      chronicCount: data.chronicCount,
      recurrentCount: data.recurrentCount,
      percentage: pct,
      dominantSource,
    });
  }

  // Sort typeDetails by totalCount descending
  typeDetails.sort((a, b) => b.totalCount - a.totalCount);

  // Top struggling items (unresolved prioritized by adaptiveScore descending)
  const topStrugglingItems: ItemWeaknessRank[] = profiles
    .filter((p) => !p.resolved)
    .sort((a, b) => (b.adaptiveScore || 0) - (a.adaptiveScore || 0))
    .slice(0, maxStruggling)
    .map((p) => ({
      id: p.id,
      word: p.word || p.id,
      totalMistakes: p.totalMistakes,
      primaryType: p.primaryType || 'meaning',
      recurrenceLevel: p.recurrenceLevel || getMistakeRecurrenceLevel(p),
      reopenCount: p.recurrenceCount || 0,
      resolved: p.resolved,
      adaptiveScore: p.adaptiveScore || 0,
      lastMistakeAt: new Date(p.lastMistakeAt).toISOString(),
    }));

  // Dominant weakness & source
  const dominantWeaknessType = summary.primaryWeaknessType;
  const dominantWeaknessCount = dominantWeaknessType ? (summary.typeBreakdown[dominantWeaknessType] || 0) : 0;
  const dominantWeaknessPercentage = summary.totalMistakes > 0
    ? Math.round((dominantWeaknessCount / summary.totalMistakes) * 1000) / 10
    : 0;

  let dominantErrorSource: CanonicalMistakeSource | null = null;
  let maxSourceTotal = 0;
  for (const [s, c] of Object.entries(summary.sourceBreakdown)) {
    if ((c || 0) > maxSourceTotal) {
      maxSourceTotal = c || 0;
      dominantErrorSource = s as CanonicalMistakeSource;
    }
  }

  // Diagnostic insights (Deterministic rules)
  const insights: WeaknessDiagnosticInsight[] = [];

  if (recurrenceCounts.chronic >= 3) {
    insights.push({
      code: 'CHRONIC_MISTAKE_ALERT',
      level: 'critical',
      title: 'Tồn đọng lỗi kinh niên',
      description: `Bạn có ${recurrenceCounts.chronic} từ vựng bị sai nhiều lần (từ 4 lượt trở lên hoặc liên tục mở lại). Cần ưu tiên làm sạch các từ này trong phiên ôn tập tới.`,
      suggestedAction: 'Ôn tập tập trung Mistake Bank với chế độ ôn lỗi kinh niên.',
    });
  }

  // Chỉ sinh các chẩn đoán điểm yếu mạnh khi có đủ cỡ mẫu (tối thiểu 5 lỗi ghi nhận)
  if (summary.totalMistakes >= 5) {
    if (dominantWeaknessType === 'spelling' && dominantWeaknessPercentage >= 35) {
      insights.push({
        code: 'SPELLING_VULNERABILITY',
        level: 'warning',
        title: 'Điểm yếu chính tả & ghi nhớ chữ cái',
        description: `Lỗi chính tả chiếm ${dominantWeaknessPercentage}% tổng số lỗi. Người học thường gặp khó khăn trong việc nhớ mặt chữ chính xác.`,
        suggestedAction: 'Luyện tập qua Word Scramble và Dictation (nghe chính tả).',
      });
    } else if (dominantWeaknessType === 'pronunciation' && dominantWeaknessPercentage >= 30) {
      insights.push({
        code: 'PRONUNCIATION_GAP',
        level: 'warning',
        title: 'Điểm yếu ngữ âm & phát âm',
        description: `Lỗi phát âm chiếm ${dominantWeaknessPercentage}% tổng số lỗi sai đã ghi nhận.`,
        suggestedAction: 'Luyện phát âm qua Pronunciation Arena hoặc Smart Shadowing.',
      });
    } else if (dominantWeaknessType === 'listening' && dominantWeaknessPercentage >= 30) {
      insights.push({
        code: 'LISTENING_COMPREHENSION_GAP',
        level: 'warning',
        title: 'Điểm yếu nghe hiểu & nhận diện âm',
        description: `Lỗi nghe hiểu chiếm ${dominantWeaknessPercentage}% tổng số lỗi sai đã ghi nhận.`,
        suggestedAction: 'Tăng cường luyện nghe qua Four Skills Listening và Dictation.',
      });
    } else if (dominantWeaknessType === 'meaning' && dominantWeaknessPercentage >= 40) {
      insights.push({
        code: 'SEMANTIC_RECALL_GAP',
        level: 'info',
        title: 'Trở ngại nhớ nghĩa & ngữ cảnh từ',
        description: `Lỗi nhớ nghĩa chiếm ${dominantWeaknessPercentage}% tổng số lỗi.`,
        suggestedAction: 'Ôn tập thẻ Flashcard và Classic Quiz để củng cố liên tưởng từ - nghĩa.',
      });
    }
  }

  if (summary.unresolvedCount === 0 && summary.totalMistakes > 0) {
    insights.push({
      code: 'ALL_MISTAKES_CLEARED',
      level: 'info',
      title: 'Đã giải quyết sạch bẫy lỗi!',
      description: 'Tất cả các từ trong Sổ tay bẫy lỗi hiện đã được ôn luyện và hóa giải thành công.',
      suggestedAction: 'Tiếp tục học thêm từ mới hoặc ôn định kỳ SRS.',
    });
  } else if (summary.averageConsecutiveCorrect < 1.0 && summary.unresolvedCount >= 5) {
    insights.push({
      code: 'LOW_RECOVERY_RATE',
      level: 'warning',
      title: 'Tỷ lệ giải quyết lỗi còn chậm',
      description: 'Số lần trả lời đúng liên tiếp trung bình dưới 1.0. Các lỗi sai có xu hướng bị lặp lại trước khi đạt mốc 2 lần đúng.',
      suggestedAction: 'Rút ngắn khoảng cách giữa các lần ôn lỗi để tăng hiệu quả ghi nhớ.',
    });
  }

  return {
    summary,
    recurrenceCounts,
    dominantWeaknessType,
    dominantWeaknessPercentage,
    dominantErrorSource,
    typeDetails,
    topStrugglingItems,
    insights,
    generatedAt: now,
  };
}

export interface PronunciationQueueItem {
  id: string; // Canonical system or custom ID
  word: string;
  ipa?: string;
  meaning?: string;
  example?: string;
  mistakeCount: number;
  consecutiveCorrect: number;
  adaptiveScore: number;
  recurrenceLevel: MistakeRecurrenceLevel;
  lastMistakeAt: string;
  source: CanonicalMistakeSource;
  reopenCount: number;
}

/**
 * Pure function: Derives an urgent, deduplicated Pronunciation Practice Queue directly from Mistake Bank.
 * Does not mutate inputs or persist separate storage.
 * Deduplicates by normalized word & preserves canonical system IDs.
 * Prioritizes chronic/recurrent and high adaptive score items.
 */
export function getPronunciationPracticeQueue(
  mistakes: Record<string, MistakeRecord> | MistakeRecord[],
  options?: {
    now?: number;
    vocabularyList?: VocabWord[];
    limit?: number;
  }
): PronunciationQueueItem[] {
  const now = options?.now ?? Date.now();
  const list = Array.isArray(mistakes) ? mistakes : Object.values(mistakes || {});

  // 1. Filter: Unresolved pronunciation mistakes
  const pronunciationMistakes = list.filter((m) => {
    if (!m || !m.word || !m.word.trim()) return false;
    if (m.resolved) return false;

    // Check type-specific resolution state if present
    const pronState = m.typeResolutionMap?.pronunciation;
    if (pronState) {
      // If pronunciation was tracked and marked resolved, exclude it from pronunciation queue
      if (pronState.resolved) return false;
      return true;
    }

    const canonSource = toCanonicalSource(m.source);
    const itemType = toCanonicalType(m.primaryType, canonSource);
    const hasPronunciationCount = (m.typeCounts?.pronunciation ?? 0) > 0;

    return itemType === 'pronunciation' || hasPronunciationCount;
  });

  // 2. Deduplicate by canonical identity and normalized word
  const queueMap = new Map<string, PronunciationQueueItem>();

  for (const m of pronunciationMistakes) {
    const rawWord = m.word.trim();
    const cleanWord = cleanWordToken(rawWord);
    if (!cleanWord) continue;

    // Resolve canonical identity (prefer system canonicalId vocab_... from dictionary/list)
    let canonicalId = m.id;
    let canonicalWord = rawWord;
    let ipa = m.ipa;
    let meaning = m.meaning;
    let example = m.example;

    const canonical = resolveCanonicalVocab(rawWord, options?.vocabularyList);
    if (canonical) {
      canonicalId = canonical.canonicalId;
      canonicalWord = canonical.canonicalWord.word;
      ipa = canonical.canonicalWord.ipa || ipa;
      meaning = canonical.canonicalWord.meaning || meaning;
      example = canonical.canonicalWord.example || example;
    }

    const dedupKey = canonicalId.toLowerCase();
    const existing = queueMap.get(dedupKey) || queueMap.get(cleanWord);

    const score = calculateAdaptiveScore(m, { now });
    const level = getMistakeRecurrenceLevel(m);
    const mCount = m.mistakeCount || m.wrongCount || 1;
    const canonSource = toCanonicalSource(m.source);

    if (existing) {
      // Merge: keep highest mistakeCount, highest adaptiveScore, latest lastMistakeAt
      existing.mistakeCount = Math.max(existing.mistakeCount, mCount);
      existing.adaptiveScore = Math.max(existing.adaptiveScore, score);
      existing.consecutiveCorrect = Math.min(existing.consecutiveCorrect, m.consecutiveCorrect || 0);
      existing.reopenCount = Math.max(existing.reopenCount, m.reopenCount || 0);
      if (m.lastMistakeAt && (!existing.lastMistakeAt || m.lastMistakeAt > existing.lastMistakeAt)) {
        existing.lastMistakeAt = m.lastMistakeAt;
      }
      if (level === 'chronic' || (level === 'recurrent' && existing.recurrenceLevel !== 'chronic')) {
        existing.recurrenceLevel = level;
      }
      if (!existing.ipa && ipa) existing.ipa = ipa;
      if (!existing.meaning && meaning) existing.meaning = meaning;
      if (!existing.example && example) existing.example = example;
    } else {
      const item: PronunciationQueueItem = {
        id: canonicalId,
        word: canonicalWord,
        ipa,
        meaning,
        example,
        mistakeCount: mCount,
        consecutiveCorrect: m.consecutiveCorrect || 0,
        adaptiveScore: score,
        recurrenceLevel: level,
        lastMistakeAt: m.lastMistakeAt || new Date(now).toISOString(),
        source: canonSource,
        reopenCount: m.reopenCount || 0,
      };
      queueMap.set(dedupKey, item);
      queueMap.set(cleanWord, item);
    }
  }

  // Deduplicate map values
  const uniqueItems = Array.from(new Set(queueMap.values()));

  // 3. Sort by urgency (adaptiveScore descending, then lastMistakeAt descending)
  uniqueItems.sort((a, b) => {
    if (b.adaptiveScore !== a.adaptiveScore) {
      return b.adaptiveScore - a.adaptiveScore;
    }
    return (b.lastMistakeAt || '').localeCompare(a.lastMistakeAt || '');
  });

  if (options?.limit && options.limit > 0) {
    return uniqueItems.slice(0, options.limit);
  }

  return uniqueItems;
}

