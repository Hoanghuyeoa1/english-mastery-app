// src/services/learningDictionaryService.ts
/**
 * Learning Dictionary Service (Single Source of Truth)
 * 
 * Provides unified, dynamic derivation of learner state for any canonical word or token:
 * Combines Static Dictionary Data + SRS/FSRS + Mistake Bank + Collocations + Leech Detection + CEFR Calibration.
 * 
 * Strict Invariants:
 * 1. Dictionary Static Entry != User Learning State: Never mutates the 10,000+ static word database.
 * 2. Zero State Duplication: Never duplicates static dictionary entries inside Zustand.
 * 3. Dynamic State Derivation: Computes card lifecycle state and retrievability on-the-fly.
 * 4. Safe Empty States: Unreviewed / unknown words yield safe nulls (never NaN, Invalid Date, or fake 0% retrievability).
 * 5. Robust Canonicalization: Normalizes inflections ("maintains", "maintained") to their base lexical lemma.
 * 6. Honest Telemetry: Distinguishes Again button count from FSRS lapses and Mistake Bank counts.
 */

import type {
  AppStore,
  CEFRLevel,
  FourSkillsScores,
  FSRSMemoryState,
  LearningDictionaryProfile,
  LearningDictionaryStatus,
  LearningStatusMeta,
  MistakeRecord,
  MistakeSource,
  MistakeType,
  SRSAlgorithmType,
  SRSCardState,
  SRSProgress,
  SRSReviewEvent,
  SRSReviewRating,
  VocabWord,
  WordAssociatedCollocation,
  WordCefrCalibration,
  WordContextUsageTelemetry,
  WordLeechSummary,
  WordMemoryTelemetry,
  WordMistakeSummary,
  WordRatingBreakdown,
  WordConfusionTelemetry,
  PersonalizedConfusionItem,
  WordFamilyInfo,
  WordFamilyMember,
  WordLearnerSemantic,
} from '../types';

import { getDictionaryWord } from './dictionaryIndex';
import { cleanWordToken, lookupContextWord, resolveCanonicalVocab } from './wordLookupService';
import { getCardUnifiedState } from './srsScheduler';
import { calculateRetrievability } from './fsrsAlgorithm';
import { analyzeCardLeechStatus } from './leechDetector';
import { getCefrLevelFromScore } from './skillsCompetencyService';
import { isDueForReview } from './srsAlgorithm';
import { useAppStore } from '../store/useAppStore';
import { getWordContextUsageTelemetry } from './wordUsageTelemetry';
import { getWordConfusionTelemetry } from './wordConfusionService';
import { deriveWordFamily } from './wordFamilyService';

export type {
  LearningDictionaryProfile,
  LearningDictionaryStatus,
  LearningStatusMeta,
  WordMistakeSummary,
  WordLeechSummary,
  WordAssociatedCollocation,
  WordCefrCalibration,
  WordContextUsageTelemetry,
  WordMemoryTelemetry,
  WordRatingBreakdown,
  WordConfusionTelemetry,
  PersonalizedConfusionItem,
  WordFamilyInfo,
  WordFamilyMember,
};

export interface LearningDictionaryOptions {
  now?: number;
  storeState?: Partial<AppStore>;
}

const CEFR_ORDER: Record<string, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

const DEFAULT_SCORES: FourSkillsScores = {
  listening: [],
  reading: [],
  speaking: [],
  writing: [],
};

/**
 * Derives the learner's overall CEFR level based on fourSkillsScores.
 * Returns null if the learner has 0 attempts across all skills (unobserved).
 */
export function deriveLearnerCefrLevel(scoresState?: FourSkillsScores | null): {
  learnerLevel: CEFRLevel | null;
  isObserved: boolean;
} {
  if (!scoresState) {
    return { learnerLevel: null, isObserved: false };
  }

  const getAvg = (skillScores?: number[]): number | null => {
    if (!Array.isArray(skillScores) || skillScores.length === 0) return null;
    const valid = skillScores.filter((s) => typeof s === 'number' && Number.isFinite(s) && s >= 0);
    if (valid.length === 0) return null;
    return Math.round(valid.reduce((acc, v) => acc + v, 0) / valid.length);
  };

  const activeAverages: number[] = [];
  const skills: Array<'listening' | 'reading' | 'speaking' | 'writing'> = ['listening', 'reading', 'speaking', 'writing'];
  for (const s of skills) {
    const avg = getAvg(scoresState[s]);
    if (avg !== null) {
      activeAverages.push(avg);
    }
  }

  if (activeAverages.length === 0) {
    return { learnerLevel: null, isObserved: false };
  }

  const overallScore = Math.round(activeAverages.reduce((a, b) => a + b, 0) / activeAverages.length);
  return {
    learnerLevel: getCefrLevelFromScore(overallScore),
    isObserved: true,
  };
}

/**
 * Calibrates the word's CEFR level against the learner's current CEFR level.
 * Never invents progression or claims above/below when learner level is unobserved.
 */
function calibrateCefr(
  rawWordLevel: string | undefined,
  learnerInfo: { learnerLevel: CEFRLevel | null; isObserved: boolean }
): WordCefrCalibration {
  const normalizedWordLevel = rawWordLevel ? rawWordLevel.trim().toUpperCase() : undefined;
  const wordRank = normalizedWordLevel ? CEFR_ORDER[normalizedWordLevel] : undefined;

  if (!learnerInfo.isObserved || !learnerInfo.learnerLevel) {
    return {
      wordLevel: normalizedWordLevel,
      learnerLevel: null,
      isObservedLearnerLevel: false,
      difficultyComparison: 'unknown',
      comparisonLabel: 'Level not calibrated',
    };
  }

  const learnerRank = CEFR_ORDER[learnerInfo.learnerLevel] ?? 1;

  let difficultyComparison: 'below' | 'at_level' | 'above' | 'unknown' = 'unknown';
  let comparisonLabel = 'Level not calibrated';

  if (typeof wordRank === 'number') {
    if (wordRank > learnerRank) {
      difficultyComparison = 'above';
      comparisonLabel = 'Above your current level';
    } else if (wordRank < learnerRank) {
      difficultyComparison = 'below';
      comparisonLabel = 'Expected vocabulary';
    } else {
      difficultyComparison = 'at_level';
      comparisonLabel = 'At your current level';
    }
  }

  return {
    wordLevel: normalizedWordLevel,
    learnerLevel: learnerInfo.learnerLevel,
    isObservedLearnerLevel: true,
    difficultyComparison,
    comparisonLabel,
  };
}

/**
 * Checks if a phrase contains a target word on explicit token/word-boundary.
 * Prevents false substring positives (e.g. "art" in "start working").
 */
export function phraseContainsWordToken(
  phrase: string,
  targetLemma: string,
  targetToken: string
): boolean {
  if (!phrase || typeof phrase !== 'string') return false;
  const rawTokens = phrase.toLowerCase().split(/\s+/);
  for (const raw of rawTokens) {
    const cleaned = cleanWordToken(raw);
    if (cleaned === targetLemma || cleaned === targetToken) {
      return true;
    }
    // Handle hyphenated compound tokens like state-of-the-art
    if (raw.includes('-')) {
      const subParts = raw.split('-').map((p) => cleanWordToken(p));
      if (subParts.includes(targetLemma) || subParts.includes(targetToken)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Strictly verifies whether a mistake item represents a valid target for the word.
 * Filters out general comprehension questions, entire sentences, or reading passages.
 */
function isValidMistakeMatch(
  record: MistakeRecord | undefined,
  canonicalId: string,
  normalizedKey: string
): boolean {
  if (!record || typeof record !== 'object') return false;
  const recordWord = (record.word || '').trim().toLowerCase();
  const recordId = (record.id || '').trim().toLowerCase();

  // If word text contains multiple words or is unusually long, it's not a single word mistake
  if (recordWord.split(/\s+/).length > 3 || recordWord.length > 35) {
    return false;
  }

  if (recordId === canonicalId.toLowerCase()) return true;
  if (cleanWordToken(recordWord) === normalizedKey) return true;
  return false;
}

/**
 * Extracts and aggregates review telemetry from the system's bounded recentReviewEvents buffer.
 * Preserves lifetime againCount and reviewCount truth from SRSProgress when available.
 */
export function getCardRecentReviewTelemetry(
  canonicalId: string,
  normalizedKey: string,
  cleanToken: string,
  events: SRSReviewEvent[] = [],
  srsAgainCount: number | null = null,
  srsReviewCount: number = 0
): {
  ratingBreakdown: WordRatingBreakdown;
  lastReviewRating: SRSReviewRating | null;
} {
  let again = 0;
  let hard = 0;
  let good = 0;
  let easy = 0;
  let lastReviewRating: SRSReviewRating | null = null;
  let latestTimestamp = 0;

  if (Array.isArray(events)) {
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (!ev || !ev.cardId) continue;
      const cId = ev.cardId.toLowerCase().trim();
      const cIdWithoutCustom = cId.replace(/^custom_/, '');
      const canonicalWithoutCustom = canonicalId.toLowerCase().replace(/^custom_/, '');

      if (
        cId === canonicalId.toLowerCase() ||
        cId === normalizedKey ||
        cId === cleanToken ||
        cIdWithoutCustom === normalizedKey ||
        cIdWithoutCustom === cleanToken ||
        canonicalWithoutCustom === cId
      ) {
        const rating: SRSReviewRating | null = ev.rating || (
          ev.grade === 0 ? 'again' :
          ev.grade === 1 ? 'hard' :
          ev.grade === 2 ? 'good' :
          ev.grade === 3 ? 'easy' : null
        );

        if (rating === 'again') again++;
        else if (rating === 'hard') hard++;
        else if (rating === 'good') good++;
        else if (rating === 'easy') easy++;

        if (rating) {
          if (ev.timestamp) {
            const t = Date.parse(ev.timestamp);
            if (!Number.isNaN(t) && t > latestTimestamp) {
              latestTimestamp = t;
              lastReviewRating = rating;
            }
          } else if (!lastReviewRating) {
            lastReviewRating = rating;
          }
        }
      }
    }
  }

  // Lifetime again count takes precedence if tracked on SRSProgress
  if (typeof srsAgainCount === 'number' && Number.isFinite(srsAgainCount)) {
    again = Math.max(again, srsAgainCount);
  }

  const totalCalculated = again + hard + good + easy;
  const total = Math.max(totalCalculated, srsReviewCount);

  return {
    ratingBreakdown: { again, hard, good, easy, total },
    lastReviewRating,
  };
}

/**
 * Provides user-facing label and styling metadata for derived LearningDictionaryStatus.
 * Non-competing with the internal scheduler state machine.
 */
export function getLearningStatusMeta(status: LearningDictionaryStatus): LearningStatusMeta {
  switch (status) {
    case 'leech':
      return {
        status: 'leech',
        labelEn: 'Leech',
        labelVi: 'Từ khó / Bẫy quên',
        variant: 'danger',
        description: 'Từ vựng bị quên nhiều lần (lapse cao), cần phương pháp ghi nhớ đặc biệt.',
      };
    case 'relearning':
      return {
        status: 'relearning',
        labelEn: 'Relearning',
        labelVi: 'Đang củng cố lại',
        variant: 'warning',
        description: 'Vừa bị quên trong chu kỳ ôn tập gần nhất và đang được củng cố lại.',
      };
    case 'needs_practice':
      return {
        status: 'needs_practice',
        labelEn: 'Needs Practice',
        labelVi: 'Cần luyện tập',
        variant: 'warning',
        description: 'Có dữ liệu ghi nhận sai sót trong bài tập hoặc kỹ năng, cần luyện tập bổ sung.',
      };
    case 'review':
      return {
        status: 'review',
        labelEn: 'Review Due',
        labelVi: 'Đến hạn ôn tập',
        variant: 'primary',
        description: 'Đã đến thời điểm ôn tập định kỳ theo đường cong lãng quên.',
      };
    case 'mastered':
      return {
        status: 'mastered',
        labelEn: 'Strong / Mastered',
        labelVi: 'Nắm vững',
        variant: 'success',
        description: 'Đã ghi nhớ sâu sắc, chu kỳ ôn dài và xác suất nhớ lại cao.',
      };
    case 'learning':
      return {
        status: 'learning',
        labelEn: 'Learning',
        labelVi: 'Đang học',
        variant: 'info',
        description: 'Đang trong các bước củng cố ban đầu của lộ trình lặp lại ngắt quãng.',
      };
    case 'new':
    default:
      return {
        status: 'new',
        labelEn: 'New',
        labelVi: 'Từ mới',
        variant: 'default',
        description: 'Từ vựng chưa có tiến trình ôn tập trong hệ thống SRS.',
      };
  }
}

/**
 * Derives user-facing semantic classification (Known, Learning, Unknown)
 * strictly from LearningDictionaryProfile without duplicating scheduler or state.
 * 
 * Rules:
 * - Mastered mature cards -> 'known'
 * - In SRS deck (learning, review, relearning, leech, needs_practice) -> 'learning'
 * - New word not in deck -> 'unknown'
 * - Pure dictionary lookups NEVER automatically convert unknown to known.
 */
export function deriveLearnerSemantic(
  profileOrStatus: LearningDictionaryStatus | { learningStatus: LearningDictionaryStatus; isInUserDeck?: boolean }
): WordLearnerSemantic {
  const status = typeof profileOrStatus === 'string' ? profileOrStatus : profileOrStatus.learningStatus;
  const inDeck = typeof profileOrStatus === 'string' ? (status !== 'new') : Boolean(profileOrStatus.isInUserDeck);

  if (status === 'mastered') {
    return 'known';
  }
  if (status === 'new' || !inDeck) {
    return 'unknown';
  }
  return 'learning';
}

/**
 * Evaluates whether memory evidence supports the "mastered" label.
 * Requires card to be in stable review, not due/overdue, not leech, no open mistakes,
 * and meeting algorithm-specific maturity standards.
 */
function isCardMastered(params: {
  algorithm: SRSAlgorithmType;
  cardState: SRSCardState;
  isDue: boolean;
  interval: number;
  srsLevel: number;
  easeFactor: number;
  lapsesCount: number;
  isLeech: boolean;
  hasUnresolvedMistakes: boolean;
  fsrs?: FSRSMemoryState;
  retrievability: number | null;
}): boolean {
  // CRITICAL INVARIANT: A word must NOT be labelled mastered while currently due/overdue
  if (params.isDue) return false;
  if (params.isLeech) return false;
  if (params.hasUnresolvedMistakes) return false;
  if (params.cardState !== 'review') return false;

  if (params.algorithm === 'fsrs' && params.fsrs) {
    const stability = params.fsrs.stability;
    const reps = params.fsrs.reps;
    const r = params.retrievability;
    // FSRS Mastery Standards:
    // 1. Stability >= 21 days
    // 2. Reps >= 3
    // 3. Current retrievability >= 0.85
    // 4. Lapses <= 2
    return (
      typeof stability === 'number' &&
      Number.isFinite(stability) &&
      stability >= 21 &&
      typeof reps === 'number' &&
      reps >= 3 &&
      typeof r === 'number' &&
      r >= 0.85 &&
      params.lapsesCount <= 2
    );
  }

  // SM-2 Mastery Standards:
  // 1. Interval >= 21 days
  // 2. Repetitions (srsLevel) >= 4
  // 3. EaseFactor >= 2.0 (no chronic degradation)
  // 4. Lapses <= 2
  return (
    params.interval >= 21 &&
    params.srsLevel >= 4 &&
    params.easeFactor >= 2.0 &&
    params.lapsesCount <= 2
  );
}

/**
 * Safe fallback profile for empty, null, or unresolvable tokens.
 */
function createEmptyProfile(
  queriedToken: string,
  algorithm: SRSAlgorithmType,
  learnerInfo: { learnerLevel: CEFRLevel | null; isObserved: boolean }
): LearningDictionaryProfile {
  return {
    queriedToken,
    canonicalId: '',
    word: queriedToken,
    normalizedKey: '',
    isExistingInDictionary: false,
    isStemmedMatch: false,

    ipa: '',
    partOfSpeech: '',
    meaning: '',
    definitionEn: undefined,
    example: undefined,
    exampleEn: undefined,
    exampleVi: undefined,
    category: undefined,
    topic: undefined,
    level: undefined,
    synonyms: [],
    antonyms: [],
    collocations: [],
    commonCollocations: [],
    staticEntry: null,

    confusion: {
      commonlyConfused: [],
      personalizedConfusedWith: [],
    },
    wordFamily: {
      root: '',
      members: [],
    },

    isInUserDeck: false,
    isCustomWord: false,
    isFavorite: false,

    memory: {
      algorithm,
      cardState: 'new',
      srsLevel: 0,
      interval: 0,
      lapsesCount: 0,
      againCount: null,
      reviewCount: 0,
      easeFactor: 2.5,
      stability: null,
      difficulty: null,
      retrievability: null,
      isDue: false,
      daysUntilDue: null,
      elapsedDaysSinceReview: null,
      lastReviewedDate: null,
      nextReviewDate: null,
      firstLearnedAt: null,
      ratingBreakdown: { again: 0, hard: 0, good: 0, easy: 0, total: 0 },
      lastReviewRating: null,
    },

    mistakeSummary: {
      hasMistakeRecord: false,
      mistakeCount: 0,
      unresolved: false,
      resolved: false,
      consecutiveCorrect: 0,
      lastMistakeAt: null,
      primaryType: null,
      source: null,
      typeBreakdown: {},
      sourceBreakdown: {},
      confusedWith: [],
    },

    leechStatus: {
      isLeech: false,
      score: 0,
      reasons: [],
      againRate: 0,
      lapseCount: 0,
    },

    cefrCalibration: {
      wordLevel: undefined,
      learnerLevel: learnerInfo.learnerLevel,
      isObservedLearnerLevel: learnerInfo.isObserved,
      difficultyComparison: 'unknown',
      comparisonLabel: 'Level not calibrated',
    },

    associatedCollocations: [],
    weakCollocations: [],
    contextUsage: {
      readingEncounters: 0,
      lastReadingSeenAt: null,
      writingUsages: 0,
      lastWritingUsedAt: null,
    },
    learningStatus: 'new',
  };
}

/**
 * Primary Service Entry Point:
 * Derives a comprehensive, real-time LearningDictionaryProfile for any word or token.
 * 
 * Strict Invariant: Pure derivation. Never mutates input state or static data.
 * 
 * @param wordOrToken String token or partial VocabWord input
 * @param storeStateOrOptions Optional partial store state or options object containing now timestamp
 * @param legacyOptions Optional options object { now?: number }
 */
export function getLearningDictionaryProfile(
  wordOrToken: string | Partial<VocabWord>,
  storeStateOrOptions?: Partial<AppStore> | LearningDictionaryOptions,
  legacyOptions?: { now?: number }
): LearningDictionaryProfile {
  // 1. Resolve runtime options and store state snapshot safely
  let storeSnapshot: Partial<AppStore> | undefined;
  let customNow: number | undefined;

  if (storeStateOrOptions) {
    if ('storeState' in storeStateOrOptions && typeof storeStateOrOptions === 'object') {
      const opts = storeStateOrOptions as LearningDictionaryOptions;
      storeSnapshot = opts.storeState;
      customNow = opts.now;
    } else {
      storeSnapshot = storeStateOrOptions as Partial<AppStore>;
    }
  }

  if (typeof legacyOptions?.now === 'number') {
    customNow = legacyOptions.now;
  }

  const now = typeof customNow === 'number' && Number.isFinite(customNow) ? customNow : Date.now();

  // Try reading live store if no explicit snapshot was provided
  let liveStore: Partial<AppStore> = {};
  if (!storeSnapshot) {
    try {
      liveStore = useAppStore.getState() || {};
    } catch {
      // In headless test environments without Zustand initialized
    }
  }

  const effectiveStore = storeSnapshot || liveStore;

  const srsProgressMap = (effectiveStore.srsProgressMap && typeof effectiveStore.srsProgressMap === 'object')
    ? effectiveStore.srsProgressMap
    : {};
  const mistakeBank = (effectiveStore.mistakeBank && typeof effectiveStore.mistakeBank === 'object')
    ? effectiveStore.mistakeBank
    : {};
  const userCollocations = Array.isArray(effectiveStore.userCollocations)
    ? effectiveStore.userCollocations
    : [];
  const userCustomWords = Array.isArray(effectiveStore.userCustomWords)
    ? effectiveStore.userCustomWords
    : [];
  const vocabularyList = Array.isArray(effectiveStore.vocabularyList)
    ? effectiveStore.vocabularyList
    : [];
  const recentReviewEvents = Array.isArray(effectiveStore.recentReviewEvents)
    ? effectiveStore.recentReviewEvents
    : [];
  const wordLearningStats = (effectiveStore.wordLearningStats && typeof effectiveStore.wordLearningStats === 'object')
    ? effectiveStore.wordLearningStats
    : {};
  const fourSkillsScores = effectiveStore.fourSkillsScores || DEFAULT_SCORES;
  const srsAlgorithm: SRSAlgorithmType = effectiveStore.srsAlgorithm === 'sm2' ? 'sm2' : 'fsrs';

  const learnerCefrInfo = deriveLearnerCefrLevel(fourSkillsScores);

  // 2. Token Extraction & Sanitization
  if (!wordOrToken) {
    return createEmptyProfile('', srsAlgorithm, learnerCefrInfo);
  }

  const isStringInput = typeof wordOrToken === 'string';
  const rawInputToken = isStringInput
    ? wordOrToken
    : (wordOrToken.word || wordOrToken.id || '');

  const cleanToken = cleanWordToken(rawInputToken);
  if (!cleanToken) {
    return createEmptyProfile(rawInputToken.trim(), srsAlgorithm, learnerCefrInfo);
  }

  // 3. Static Dictionary Lookup & Stemming Resolution
  // PRECEDENCE:
  // Step 3a: Exact static match (Never stemmed into another entry unnecessarily)
  let staticWord: VocabWord | null = getDictionaryWord(cleanToken);
  let isStemmedMatch = false;

  // Step 3b: Morphological stemming heuristics (Only when no exact dictionary match)
  if (!staticWord) {
    const stemmedWord = lookupContextWord(cleanToken);
    if (stemmedWord) {
      staticWord = stemmedWord;
      isStemmedMatch = stemmedWord.word.toLowerCase().trim() !== cleanToken;
    }
  }

  // 4. In-Memory User Decks & Canonical Fallback
  const customWordMatch = userCustomWords.find(
    (w) => w.word.toLowerCase().trim() === cleanToken || w.id === cleanToken
  );
  const vocabListMatch = vocabularyList.find(
    (w) => w.word.toLowerCase().trim() === cleanToken || w.id === cleanToken
  );
  const localMatch = customWordMatch || vocabListMatch;

  let canonicalId: string;
  let canonicalWord: string;
  let isExistingInDictionary = false;
  let isCustomWord = false;

  if (staticWord) {
    canonicalId = staticWord.id;
    canonicalWord = staticWord.word;
    isExistingInDictionary = true;
    isCustomWord = false;
  } else if (localMatch) {
    canonicalId = localMatch.id;
    canonicalWord = localMatch.word;
    isExistingInDictionary = false;
    isCustomWord = true;
  } else {
    const canonicalRes = resolveCanonicalVocab(wordOrToken, vocabularyList);
    if (canonicalRes) {
      canonicalId = canonicalRes.canonicalId;
      canonicalWord = canonicalRes.canonicalWord.word;
      isExistingInDictionary = canonicalRes.isExistingInBank;
      isCustomWord = !canonicalRes.isExistingInBank;
    } else {
      canonicalId = `custom_${cleanToken}`;
      canonicalWord = cleanToken;
      isExistingInDictionary = false;
      isCustomWord = true;
    }
  }

  const normalizedKey = canonicalWord.toLowerCase().trim();

  // 5. Lexical Details (Dictionary metadata preserved immutably, respecting explicit caller object properties)
  const explicitInput = !isStringInput ? (wordOrToken as Partial<VocabWord>) : null;

  const ipa = explicitInput?.ipa || explicitInput?.phonetic || staticWord?.ipa || staticWord?.phonetic || localMatch?.ipa || `/${cleanToken}/`;
  const partOfSpeech = explicitInput?.partOfSpeech || explicitInput?.pos || staticWord?.partOfSpeech || staticWord?.pos || localMatch?.partOfSpeech || 'noun';
  const meaning = explicitInput?.meaning || staticWord?.meaning || localMatch?.meaning || 'Từ vựng tra cứu';
  const definitionEn = explicitInput?.definitionEn || staticWord?.definitionEn || localMatch?.definitionEn;
  const example = explicitInput?.example || staticWord?.example || localMatch?.example;
  const exampleEn = explicitInput?.exampleEn || staticWord?.exampleEn || localMatch?.exampleEn;
  const exampleVi = explicitInput?.exampleVi || staticWord?.exampleVi || localMatch?.exampleVi;
  const category = explicitInput?.category || staticWord?.category || localMatch?.category;
  const topic = explicitInput?.topic || staticWord?.topic || localMatch?.topic;
  const level = explicitInput?.level || explicitInput?.cefr || staticWord?.level || staticWord?.cefr || localMatch?.level;

  const synonyms = Array.isArray(explicitInput?.synonyms)
    ? [...explicitInput.synonyms]
    : (Array.isArray(staticWord?.synonyms) ? [...staticWord.synonyms] : (Array.isArray(localMatch?.synonyms) ? [...localMatch.synonyms] : []));

  const antonyms = Array.isArray(explicitInput?.antonyms)
    ? [...explicitInput.antonyms]
    : (Array.isArray(staticWord?.antonyms) ? [...staticWord.antonyms] : []);

  const collocations = Array.isArray(explicitInput?.collocations)
    ? [...explicitInput.collocations]
    : (Array.isArray(staticWord?.collocations) ? [...staticWord.collocations] : (Array.isArray(localMatch?.collocations) ? [...localMatch.collocations] : []));

  // 6. User SRS Progress Lookup
  const progress: SRSProgress | undefined =
    srsProgressMap[canonicalId] ||
    srsProgressMap[canonicalId.toLowerCase()] ||
    srsProgressMap[normalizedKey] ||
    srsProgressMap[cleanToken] ||
    (localMatch && (localMatch.srsLevel > 0 || localMatch.lastReviewedDate || localMatch.fsrs)
      ? {
          srsLevel: localMatch.srsLevel ?? 0,
          nextReviewDate: localMatch.nextReviewDate || new Date(now).toISOString(),
          interval: localMatch.interval ?? 0,
          easeFactor: localMatch.easeFactor ?? 2.5,
          lastReviewedDate: localMatch.lastReviewedDate,
          firstLearnedAt: localMatch.firstLearnedAt,
          isFavorite: localMatch.isFavorite,
          fsrs: localMatch.fsrs,
          againCount: localMatch.againCount,
          reviewCount: localMatch.reviewCount,
        }
      : undefined);

  const isInUserDeck = Boolean(progress);
  const isFavorite = Boolean(
    progress?.isFavorite ??
    (!isStringInput ? (wordOrToken as VocabWord).isFavorite : false)
  );

  // 7. Memory & SRS Telemetry Computation
  const cardState: SRSCardState = getCardUnifiedState({
    srsLevel: progress?.srsLevel,
    interval: progress?.interval,
    lastReviewedDate: progress?.lastReviewedDate,
    firstLearnedAt: progress?.firstLearnedAt,
    fsrs: progress?.fsrs,
  });

  const reps = progress?.srsLevel ?? 0;
  const interval = progress?.interval ?? 0;
  const easeFactor = progress?.easeFactor ?? 2.5;

  // TELEMETRY SEMANTICS:
  // - againCount: actual lifetime "Again" rating counter, if tracked
  // - lapsesCount: canonical scheduler lapses (fsrs.lapses if FSRS, againCount if SM-2)
  // - reviewCount: total lifetime review attempts
  const againCount = typeof progress?.againCount === 'number' && Number.isFinite(progress.againCount)
    ? Math.max(0, progress.againCount)
    : null;
  const lapsesCount = progress?.fsrs?.lapses ?? progress?.againCount ?? 0;
  const reviewCount = progress?.reviewCount ?? progress?.fsrs?.reps ?? 0;

  const lastReviewedDate = progress?.lastReviewedDate || null;
  const nextReviewDate = progress?.nextReviewDate || null;
  const firstLearnedAt = progress?.firstLearnedAt || null;

  const hasBeenStudied = Boolean(
    lastReviewedDate ||
    firstLearnedAt ||
    reps > 0 ||
    reviewCount > 0
  );

  // Safe elapsed days calculation
  let elapsedDaysSinceReview: number | null = null;
  if (lastReviewedDate && typeof lastReviewedDate === 'string') {
    const lastReviewedMs = Date.parse(lastReviewedDate);
    if (!Number.isNaN(lastReviewedMs) && lastReviewedMs <= now) {
      const diffMs = now - lastReviewedMs;
      elapsedDaysSinceReview = Math.max(0, Math.round((diffMs / (1000 * 60 * 60 * 24)) * 10) / 10);
    }
  }

  // Safe due date calculation using canonical scheduler due semantics
  let daysUntilDue: number | null = null;
  let isDue = false;
  if (nextReviewDate && typeof nextReviewDate === 'string') {
    const nextReviewMs = Date.parse(nextReviewDate);
    if (!Number.isNaN(nextReviewMs)) {
      const diffMs = nextReviewMs - now;
      daysUntilDue = Math.round((diffMs / (1000 * 60 * 60 * 24)) * 10) / 10;
      if (hasBeenStudied) {
        if (typeof customNow === 'number') {
          isDue = diffMs <= 0;
        } else {
          isDue = isDueForReview(nextReviewDate);
        }
      }
    }
  }

  // FSRS Metrics & Current-Time Retrievability
  let stability: number | null = null;
  let difficulty: number | null = null;
  let retrievability: number | null = null;

  // STRICT RULE: SM-2 cards NEVER compute fake FSRS retrievability
  if (srsAlgorithm === 'fsrs' && progress?.fsrs) {
    const rawStability = progress.fsrs.stability;
    const rawDifficulty = progress.fsrs.difficulty;

    if (typeof rawStability === 'number' && Number.isFinite(rawStability) && rawStability > 0) {
      stability = Math.round(rawStability * 100) / 100;
    }
    if (
      typeof rawDifficulty === 'number' &&
      Number.isFinite(rawDifficulty) &&
      rawDifficulty >= 1.0 &&
      rawDifficulty <= 10.0
    ) {
      difficulty = Math.round(rawDifficulty * 100) / 100;
    }

    // STRICT INVARIANTS FOR RETRIEVABILITY:
    // 1. Card must have been studied
    // 2. Stability must be positive and finite
    // 3. Must have a valid last review date string
    // 4. lastReview must NOT be in the future (lastReviewMs <= now)
    // 5. Memory state must not be corrupted
    const lastReviewDateStr = progress.fsrs.lastReview || progress.lastReviewedDate;
    if (
      hasBeenStudied &&
      typeof rawStability === 'number' &&
      Number.isFinite(rawStability) &&
      rawStability > 0 &&
      lastReviewDateStr &&
      typeof lastReviewDateStr === 'string'
    ) {
      const lastReviewMs = Date.parse(lastReviewDateStr);
      if (!Number.isNaN(lastReviewMs) && lastReviewMs <= now) {
        const elapsedDays = (now - lastReviewMs) / (1000 * 60 * 60 * 24);
        if (elapsedDays >= 0 && Number.isFinite(elapsedDays)) {
          const rawR = calculateRetrievability(elapsedDays, rawStability);
          if (Number.isFinite(rawR) && rawR >= 0 && rawR <= 1.0) {
            retrievability = Math.round(rawR * 10000) / 10000;
          }
        }
      }
    }
  }

  const reviewTelemetry = getCardRecentReviewTelemetry(
    canonicalId,
    normalizedKey,
    cleanToken,
    recentReviewEvents,
    againCount,
    reviewCount
  );

  const memory: WordMemoryTelemetry = {
    algorithm: srsAlgorithm,
    cardState,
    srsLevel: reps,
    interval,
    lapsesCount,
    againCount,
    reviewCount,
    easeFactor,
    stability,
    difficulty,
    retrievability,
    isDue,
    daysUntilDue,
    elapsedDaysSinceReview,
    lastReviewedDate,
    nextReviewDate,
    firstLearnedAt,
    fsrs: progress?.fsrs,
    ratingBreakdown: reviewTelemetry.ratingBreakdown,
    lastReviewRating: reviewTelemetry.lastReviewRating,
  };

  // 8. Mistake Bank Evaluation
  // STRICT RULE: Only associate mistake with word when canonical target evidence matches.
  // Never treat general comprehension, passage IDs, or sentence questions as word mistakes.
  let mistakeRecord: MistakeRecord | undefined;

  if (mistakeBank[canonicalId] && isValidMistakeMatch(mistakeBank[canonicalId], canonicalId, normalizedKey)) {
    mistakeRecord = mistakeBank[canonicalId];
  } else if (
    mistakeBank[canonicalId.toLowerCase()] &&
    isValidMistakeMatch(mistakeBank[canonicalId.toLowerCase()], canonicalId, normalizedKey)
  ) {
    mistakeRecord = mistakeBank[canonicalId.toLowerCase()];
  } else if (
    mistakeBank[normalizedKey] &&
    isValidMistakeMatch(mistakeBank[normalizedKey], canonicalId, normalizedKey)
  ) {
    mistakeRecord = mistakeBank[normalizedKey];
  } else if (
    mistakeBank[cleanToken] &&
    isValidMistakeMatch(mistakeBank[cleanToken], canonicalId, normalizedKey)
  ) {
    mistakeRecord = mistakeBank[cleanToken];
  } else {
    // Scan values by id or lowercase word
    const allMistakes = Object.values(mistakeBank);
    mistakeRecord = allMistakes.find((m) => isValidMistakeMatch(m, canonicalId, normalizedKey));
  }

  const hasMistakeRecord = Boolean(mistakeRecord);
  const mistakeCount = mistakeRecord
    ? (mistakeRecord.mistakeCount ?? mistakeRecord.wrongCount ?? 0)
    : 0;
  const isResolved = Boolean(mistakeRecord?.resolved);
  const isUnresolved = hasMistakeRecord && !isResolved;
  const consecutiveCorrect = mistakeRecord?.consecutiveCorrect ?? 0;
  const lastMistakeAt = mistakeRecord?.lastMistakeAt || null;
  const primaryType: MistakeType | null = mistakeRecord?.primaryType || null;
  const mistakeSource: MistakeSource | null = mistakeRecord?.source || null;

  // Extract dimensions (type & source breakdowns)
  const typeBreakdown: Partial<Record<MistakeType, number>> = {};
  if (mistakeRecord?.typeCounts && typeof mistakeRecord.typeCounts === 'object') {
    Object.assign(typeBreakdown, mistakeRecord.typeCounts);
  } else if (primaryType && mistakeCount > 0) {
    typeBreakdown[primaryType] = mistakeCount;
  }

  const sourceBreakdown: Partial<Record<MistakeSource, number>> = {};
  if (mistakeRecord?.sourceCounts && typeof mistakeRecord.sourceCounts === 'object') {
    Object.assign(sourceBreakdown, mistakeRecord.sourceCounts);
  } else if (mistakeSource && mistakeCount > 0) {
    sourceBreakdown[mistakeSource] = mistakeCount;
  }

  // 8. Confusion Telemetry & Derivation (Phase 4)
  // Strict distinction: static commonly confused vs personalized evidence
  const confusion = getWordConfusionTelemetry(canonicalWord, canonicalId, mistakeBank);
  // Maintain backward-compatible array for mistakeSummary.confusedWith
  const confusedWith: string[] = confusion.personalizedConfusedWith.map((item) => item.word);

  const mistakeSummary: WordMistakeSummary = {
    hasMistakeRecord,
    mistakeCount,
    unresolved: isUnresolved,
    resolved: isResolved,
    consecutiveCorrect,
    lastMistakeAt,
    primaryType,
    source: mistakeSource,
    typeBreakdown,
    sourceBreakdown,
    confusedWith,
  };

  // 9. Word Family (Phase 4 - Static & Offline)
  const wordFamily = deriveWordFamily(canonicalWord);

  // 10. Leech Detection
  const leechAnalysis = analyzeCardLeechStatus({
    id: canonicalId,
    word: canonicalWord,
    reps: progress?.fsrs?.reps ?? progress?.reviewCount,
    lapses: progress?.fsrs?.lapses ?? progress?.againCount,
    difficulty: progress?.fsrs?.difficulty,
    againCount: progress?.againCount,
    reviewCount: progress?.reviewCount,
    fsrs: progress?.fsrs,
  });

  const leechStatus: WordLeechSummary = {
    isLeech: leechAnalysis.isLeech,
    score: leechAnalysis.score,
    reasons: [...leechAnalysis.reasons],
    againRate: Math.round(leechAnalysis.againRate * 100) / 100,
    lapseCount: leechAnalysis.lapseCount,
  };

  // 11. CEFR Calibration
  const cefrCalibration = calibrateCefr(level, learnerCefrInfo);

  // 12. Collocation Connections & Weakness Evaluation (Phase 4)
  // Distinguishes: Common Collocations vs Your Weak Collocations
  // Weak collocation ONLY when there is actual evidence (mistake bank, AI Tutor, writing, SRS failure).
  // Invariant: Never mark weak simply because it is unlearned/unreviewed!
  const associatedCollocations: WordAssociatedCollocation[] = [];
  const seenCollocPhrases = new Set<string>();

  // Check static collocations
  for (const phrase of collocations) {
    if (!phrase || typeof phrase !== 'string') continue;
    const lowerPhrase = phrase.toLowerCase().trim();
    if (seenCollocPhrases.has(lowerPhrase)) continue;
    seenCollocPhrases.add(lowerPhrase);

    const isUserSaved = userCollocations.some((uc) => uc.phrase.toLowerCase().trim() === lowerPhrase);
    const collocProgress = srsProgressMap[lowerPhrase];
    const isInDeck = Boolean(collocProgress);
    const collocRecord = mistakeBank[lowerPhrase] || mistakeBank[`colloc_${lowerPhrase.replace(/\s+/g, '_')}`];
    const hasMistakes = Boolean(collocRecord && (collocRecord.mistakeCount || 0) > 0);

    // Assess current actionable weakness from evidence:
    // 1. Unresolved or reopened mistake in Mistake Bank (!collocRecord.resolved)
    // 2. Active SRS relearning state (collocProgress.fsrs?.state === 'relearning')
    // 3. Active unrecovered lapse (srsLevel === 0 && reviewCount > 0 && !collocRecord?.resolved)
    // Invariant: A historical resolved mistake (resolved === true) is NOT weak if no current SRS weakness.
    const lapseCount = collocProgress?.againCount || collocProgress?.fsrs?.lapses || 0;
    const isUnresolvedMistake = Boolean(collocRecord && (collocRecord.mistakeCount || 0) > 0 && !collocRecord.resolved);
    const isSrsRelearning = Boolean(
      collocProgress && (
        getCardUnifiedState(collocProgress) === 'relearning' ||
        (collocProgress.fsrs?.state as unknown) === 3 ||
        (collocProgress.fsrs?.state as unknown) === 'relearning'
      )
    );
    const isLapsedUnrecovered = Boolean(
      collocProgress &&
      collocProgress.srsLevel === 0 &&
      (collocProgress.reviewCount ?? 0) > 0 &&
      (!collocRecord || !collocRecord.resolved)
    );
    const isSrsActiveFailure = isSrsRelearning || isLapsedUnrecovered;

    let isWeak = false;
    let weaknessEvidence: 'mistake_bank' | 'srs_failure' | 'ai_tutor' | 'writing_correction' | null = null;

    if (isUnresolvedMistake) {
      isWeak = true;
      if (collocRecord?.source === 'ai_tutor') {
        weaknessEvidence = 'ai_tutor';
      } else if (collocRecord?.source === 'writing') {
        weaknessEvidence = 'writing_correction';
      } else {
        weaknessEvidence = 'mistake_bank';
      }
    } else if (isSrsActiveFailure) {
      isWeak = true;
      weaknessEvidence = 'srs_failure';
    }

    associatedCollocations.push({
      phrase,
      meaning: '',
      isUserSaved,
      isInDeck,
      hasMistakes,
      isWeak,
      weaknessEvidence,
      mistakeCount: collocRecord?.mistakeCount || 0,
      lapseCount,
    });
  }

  // Check user saved collocations containing this word on token/word boundary
  for (const uc of userCollocations) {
    if (!uc || !uc.phrase) continue;
    const lowerPhrase = uc.phrase.toLowerCase().trim();
    if (seenCollocPhrases.has(lowerPhrase)) {
      const existing = associatedCollocations.find((a) => a.phrase.toLowerCase().trim() === lowerPhrase);
      if (existing && !existing.meaning && uc.meaning) {
        existing.meaning = uc.meaning;
        existing.isUserSaved = true;
      }
      continue;
    }

    // STRICT TOKEN/WORD-BOUNDARY MATCH: Prevents "art" from matching "start working"
    if (phraseContainsWordToken(lowerPhrase, normalizedKey, cleanToken)) {
      seenCollocPhrases.add(lowerPhrase);
      const collocProgress = srsProgressMap[uc.id] || srsProgressMap[lowerPhrase] || srsProgressMap[`colloc_${lowerPhrase.replace(/\s+/g, '_')}`];
      const inDeck = Boolean(collocProgress);
      const collocRecord = mistakeBank[uc.id] || mistakeBank[lowerPhrase] || mistakeBank[`colloc_${lowerPhrase.replace(/\s+/g, '_')}`];
      const hasMistakes = Boolean(collocRecord && (collocRecord.mistakeCount || 0) > 0);

      const lapseCount = collocProgress?.againCount || collocProgress?.fsrs?.lapses || 0;
      const isUnresolvedMistake = Boolean(collocRecord && (collocRecord.mistakeCount || 0) > 0 && !collocRecord.resolved);
      const isSrsRelearning = Boolean(
        collocProgress && (
          getCardUnifiedState(collocProgress) === 'relearning' ||
          (collocProgress.fsrs?.state as unknown) === 3 ||
          (collocProgress.fsrs?.state as unknown) === 'relearning'
        )
      );
      const isLapsedUnrecovered = Boolean(
        collocProgress &&
        collocProgress.srsLevel === 0 &&
        (collocProgress.reviewCount ?? 0) > 0 &&
        (!collocRecord || !collocRecord.resolved)
      );
      const isSrsActiveFailure = isSrsRelearning || isLapsedUnrecovered;

      let isWeak = false;
      let weaknessEvidence: 'mistake_bank' | 'srs_failure' | 'ai_tutor' | 'writing_correction' | null = null;

      if (isUnresolvedMistake) {
        isWeak = true;
        if (collocRecord?.source === 'ai_tutor') {
          weaknessEvidence = 'ai_tutor';
        } else if (collocRecord?.source === 'writing') {
          weaknessEvidence = 'writing_correction';
        } else {
          weaknessEvidence = 'mistake_bank';
        }
      } else if (isSrsActiveFailure) {
        isWeak = true;
        weaknessEvidence = 'srs_failure';
      }

      associatedCollocations.push({
        phrase: uc.phrase,
        meaning: uc.meaning || '',
        isUserSaved: true,
        isInDeck: inDeck,
        hasMistakes,
        isWeak,
        weaknessEvidence,
        mistakeCount: collocRecord?.mistakeCount || 0,
        lapseCount,
      });
    }
  }

  const commonCollocations = collocations.length > 0 ? [...collocations] : [];
  const weakCollocations = associatedCollocations.filter((c) => c.isWeak);

  // 12. Dynamic Overall Learning Status Determination
  // Deterministic priority contract:
  // 1. leech (Active leech takes highest priority)
  // 2. relearning (Scheduler card in relearning state after lapse)
  // 3. review (Card is due/overdue in SRS queue)
  // 4. needs_practice (Strong weakness evidence like unresolved mistake, not due)
  // 5. mastered (Mature memory evidence, NOT due, NOT leech, NOT relearning, NOT needs_practice)
  // 6. review (Card in stable review state, not due today)
  // 7. learning (Card has started learning, not yet stable review)
  // 8. new (Word has no meaningful learning progress)
  let learningStatus: LearningDictionaryStatus = 'new';

  if (leechStatus.isLeech) {
    learningStatus = 'leech';
  } else if (cardState === 'relearning') {
    learningStatus = 'relearning';
  } else if (isDue) {
    learningStatus = 'review';
  } else if (isUnresolved) {
    learningStatus = 'needs_practice';
  } else if (
    isCardMastered({
      algorithm: srsAlgorithm,
      cardState,
      isDue,
      interval,
      srsLevel: reps,
      easeFactor,
      lapsesCount,
      isLeech: leechStatus.isLeech,
      hasUnresolvedMistakes: isUnresolved,
      fsrs: progress?.fsrs,
      retrievability,
    })
  ) {
    learningStatus = 'mastered';
  } else if (cardState === 'review') {
    learningStatus = 'review';
  } else if (cardState === 'learning') {
    learningStatus = 'learning';
  } else {
    learningStatus = 'new';
  }

  // 12. Context Usage & Encounter Telemetry (Reading Encounters & Writing Usages)
  const contextUsage = getWordContextUsageTelemetry(
    canonicalWord,
    canonicalId,
    cleanToken,
    wordLearningStats
  );

  return {
    queriedToken: rawInputToken.trim(),
    canonicalId,
    word: canonicalWord,
    normalizedKey,
    isExistingInDictionary,
    isStemmedMatch,

    ipa,
    partOfSpeech,
    meaning,
    definitionEn,
    example,
    exampleEn,
    exampleVi,
    category,
    topic,
    level,
    synonyms,
    antonyms,
    collocations,
    commonCollocations,
    staticEntry: staticWord,

    // Word Network & Relationships (Phase 4)
    confusion,
    wordFamily,

    isInUserDeck,
    isCustomWord,
    isFavorite,

    memory,
    mistakeSummary,
    leechStatus,
    cefrCalibration,
    associatedCollocations,
    weakCollocations,
    contextUsage,
    learningStatus,
  };
}

/**
 * Fast-path selector: derives and returns exclusively the WordMemoryTelemetry
 * for any word or token, matching canonical scheduler rules and review history.
 */
export function getWordMemoryTelemetry(
  wordOrToken: string | Partial<VocabWord>,
  storeStateOrOptions?: Partial<AppStore> | LearningDictionaryOptions,
  legacyOptions?: { now?: number }
): WordMemoryTelemetry {
  return getLearningDictionaryProfile(wordOrToken, storeStateOrOptions, legacyOptions).memory;
}
