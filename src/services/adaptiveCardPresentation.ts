// src/services/adaptiveCardPresentation.ts
/**
 * Adaptive Card Presentation Engine
 * 
 * Determines presentation mode (Standard, Reverse, Context Cloze, Collocation, Confusion Challenge)
 * deterministically based on card characteristics and learner history without mutating scheduler state.
 * 
 * Strict Invariants:
 * 1. Zero Scheduler Mutation: Presentation variation NEVER touches FSRS stability, difficulty,
 *    retrievability, intervals, or due dates.
 * 2. Zero State Side-Effects: Pure function without mutations to store, card objects, or Mistake Bank.
 * 3. Evidence-Only Confusion: Confusion Challenge is strictly gated by genuine mistake evidence.
 * 4. Deterministic Stability: Re-renders never flicker or swap modes arbitrarily.
 * 5. Robust Fallback: Missing metadata safely degrades to Standard recall.
 */

import type { SRSReviewCard, MistakeRecord } from '../types';
import { cleanWordToken } from './wordLookupService';
import { derivePersonalizedConfusions, getCommonlyConfusedWords } from './wordConfusionService';

export type AdaptivePresentationMode =
  | 'standard'
  | 'reverse'
  | 'context_cloze'
  | 'collocation'
  | 'confusion_challenge';

export interface ConfusedWordOption {
  word: string;
  isCorrect: boolean;
}

export interface CardPresentationPlan {
  mode: AdaptivePresentationMode;
  targetWord: string;
  ipa?: string;
  meaning: string;
  partOfSpeech?: string;
  level?: string;
  topic?: string;
  exampleEn?: string;
  exampleVi?: string;
  collocations?: string[];
  maskedCloze?: string;
  clozeHint?: string;
  confusionPair?: {
    confusedWith: string;
    options: ConfusedWordOption[];
    distractorExplanation?: string;
    isPersonalized: boolean;
  };
}

/**
 * Deterministic hash helper to ensure card presentation mode is 100% stable across re-renders.
 */
export function hashCardSeed(id: string): number {
  if (!id) return 0;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Creates a cloze mask in an English sentence for a target word.
 * Safely matches word boundaries and basic stem inflections.
 */
export function createClozeMask(sentence: string, targetWord: string): { maskedSentence: string; found: boolean } {
  if (!sentence || !targetWord) {
    return { maskedSentence: sentence || '', found: false };
  }

  const clean = cleanWordToken(targetWord);
  if (!clean) {
    return { maskedSentence: sentence, found: false };
  }

  try {
    const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 1. Exact whole word boundary match (case-insensitive)
    const exactRegex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (exactRegex.test(sentence)) {
      return { maskedSentence: sentence.replace(exactRegex, '[ _____ ]'), found: true };
    }

    // 2. Inflected forms (e.g. target "maintain" matching "maintains", "maintaining", "maintained")
    if (clean.length >= 4) {
      const stemRegex = new RegExp(`\\b${escaped}[a-z]*\\b`, 'i');
      if (stemRegex.test(sentence)) {
        return { maskedSentence: sentence.replace(stemRegex, '[ _____ ]'), found: true };
      }
    }

    // 3. Fallback substring match if safe
    const looseRegex = new RegExp(escaped, 'i');
    if (looseRegex.test(sentence)) {
      return { maskedSentence: sentence.replace(looseRegex, '[ _____ ]'), found: true };
    }
  } catch {
    // Return unfound on regex failure
  }

  return { maskedSentence: sentence, found: false };
}

/**
 * Resolves the presentation mode and prepared view data for an SRS card.
 * Pure function with zero mutations or scheduler calls.
 */
export function resolveCardPresentationMode(
  card: SRSReviewCard,
  mistakeBank: Record<string, MistakeRecord> = {},
  options?: {
    forcedMode?: AdaptivePresentationMode;
  }
): CardPresentationPlan {
  const target = card.primaryText || card.word || '';
  const cleanTarget = cleanWordToken(target);
  const exEn = card.exampleEn || card.example || '';
  const exVi = card.exampleVi || card.exampleMeaning || '';
  const meaning = card.meaning || '';

  // 1. Direct forced override (e.g. for testing / specific drills)
  if (options?.forcedMode) {
    return buildPlanForMode(options.forcedMode, card, target, exEn, exVi, meaning, null);
  }

  // 2. Multi-word phrase or collocation items always present as Collocation mode
  if (card.type && card.type !== 'single_word') {
    return buildPlanForMode('collocation', card, target, exEn, exVi, meaning, null);
  }

  // 3. Confused Word Challenge (Strictly Evidence-Based)
  // Check for personalized confusion history first
  const personalizedConfusions = derivePersonalizedConfusions(target, card.id, mistakeBank, 2);
  if (personalizedConfusions.length > 0 && personalizedConfusions[0]?.word) {
    const confusedWith = personalizedConfusions[0].word;
    const isTargetFirst = hashCardSeed(`${card.id}_${confusedWith}`) % 2 === 0;
    const challengeOptions: ConfusedWordOption[] = isTargetFirst
      ? [
          { word: target, isCorrect: true },
          { word: confusedWith, isCorrect: false },
        ]
      : [
          { word: confusedWith, isCorrect: false },
          { word: target, isCorrect: true },
        ];

    return buildPlanForMode('confusion_challenge', card, target, exEn, exVi, meaning, {
      confusedWith,
      options: challengeOptions,
      distractorExplanation: `Bạn từng nhầm từ "${target}" với "${confusedWith}".`,
      isPersonalized: true,
    });
  }

  // If no personalized confusion, check curated pairs ONLY if learner has actual struggle evidence on this card
  const hasStruggleEvidence =
    (card.againCount !== undefined && card.againCount > 0) ||
    (card.fsrs?.lapses !== undefined && card.fsrs.lapses > 0) ||
    Boolean(mistakeBank[card.id] && !mistakeBank[card.id].resolved);

  if (hasStruggleEvidence) {
    const curatedPairs = getCommonlyConfusedWords(target);
    if (curatedPairs.length > 0) {
      const confusedWith = curatedPairs[0];
      const isTargetFirst = hashCardSeed(`${card.id}_${confusedWith}`) % 2 === 0;
      const challengeOptions: ConfusedWordOption[] = isTargetFirst
        ? [
            { word: target, isCorrect: true },
            { word: confusedWith, isCorrect: false },
          ]
        : [
            { word: confusedWith, isCorrect: false },
            { word: target, isCorrect: true },
          ];

      return buildPlanForMode('confusion_challenge', card, target, exEn, exVi, meaning, {
        confusedWith,
        options: challengeOptions,
        distractorExplanation: `Cặp từ dễ nhầm lẫn trong tiếng Anh: "${target}" vs "${confusedWith}".`,
        isPersonalized: false,
      });
    }
  }

  // 4. Brand new words (srsLevel === 0, no reviews, no lapses) -> Prioritize Standard Recall
  const isNewCard =
    (card.srsLevel ?? 0) === 0 &&
    !card.lastReviewedDate &&
    (card.reviewCount ?? 0) === 0 &&
    (card.againCount ?? 0) === 0;

  if (isNewCard) {
    return buildPlanForMode('standard', card, target, exEn, exVi, meaning, null);
  }

  // 5. Frequent lapses or relearning (againCount >= 2 or FSRS lapses >= 1)
  // Provide varied retrieval angle: Context Cloze if valid example exists, otherwise Reverse Recall
  const hasMultipleLapses = (card.againCount ?? 0) >= 2 || (card.fsrs?.lapses ?? 0) >= 1;
  if (hasMultipleLapses) {
    const clozeRes = createClozeMask(exEn, cleanTarget);
    if (clozeRes.found) {
      return buildPlanForMode('context_cloze', card, target, exEn, exVi, meaning, null, clozeRes.maskedSentence);
    }
    if (meaning) {
      return buildPlanForMode('reverse', card, target, exEn, exVi, meaning, null);
    }
    return buildPlanForMode('standard', card, target, exEn, exVi, meaning, null);
  }

  // 6. Stable / Mature cards (srsLevel >= 3 or FSRS stability >= 14)
  // Vary presentation deterministically to prevent rote habituation
  const isMatureCard = (card.srsLevel ?? 0) >= 3 || (card.fsrs?.stability ?? 0) >= 14;
  if (isMatureCard) {
    const seed = hashCardSeed(card.id);
    const variantIndex = seed % 3;

    if (variantIndex === 0) {
      const clozeRes = createClozeMask(exEn, cleanTarget);
      if (clozeRes.found) {
        return buildPlanForMode('context_cloze', card, target, exEn, exVi, meaning, null, clozeRes.maskedSentence);
      }
      return buildPlanForMode('reverse', card, target, exEn, exVi, meaning, null);
    }

    if (variantIndex === 1 && meaning) {
      return buildPlanForMode('reverse', card, target, exEn, exVi, meaning, null);
    }

    return buildPlanForMode('standard', card, target, exEn, exVi, meaning, null);
  }

  // 7. Default standard recall
  return buildPlanForMode('standard', card, target, exEn, exVi, meaning, null);
}

/**
 * Builds the complete presentation plan object safely.
 */
function buildPlanForMode(
  mode: AdaptivePresentationMode,
  card: SRSReviewCard,
  target: string,
  exEn: string,
  exVi: string,
  meaning: string,
  confusionPair: CardPresentationPlan['confusionPair'] | null,
  providedMaskedCloze?: string
): CardPresentationPlan {
  // If context_cloze requested but no masked cloze provided, attempt to create it
  let maskedCloze = providedMaskedCloze;
  if (mode === 'context_cloze' && !maskedCloze) {
    const clozeRes = createClozeMask(exEn, card.word || target);
    if (clozeRes.found) {
      maskedCloze = clozeRes.maskedSentence;
    } else {
      // Degrade to standard if masking fails
      return buildPlanForMode('standard', card, target, exEn, exVi, meaning, null);
    }
  }

  // If reverse requested but meaning is missing, degrade to standard
  if (mode === 'reverse' && !meaning.trim()) {
    return buildPlanForMode('standard', card, target, exEn, exVi, meaning, null);
  }

  return {
    mode,
    targetWord: target,
    ipa: card.ipa || card.phonetic || '',
    meaning,
    partOfSpeech: card.partOfSpeech,
    level: card.level,
    topic: card.topic || card.tag,
    exampleEn: exEn,
    exampleVi: exVi,
    collocations: card.collocations,
    maskedCloze,
    clozeHint: card.partOfSpeech ? `Từ loại: ${card.partOfSpeech}` : undefined,
    confusionPair: confusionPair || undefined,
  };
}
