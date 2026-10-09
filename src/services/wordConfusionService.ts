// src/services/wordConfusionService.ts
/**
 * Word Confusion Service
 * 
 * Manages static commonly confused word pairs (language-wide knowledge)
 * and evidence-based personalized confusion derived from learner mistakes.
 * 
 * Strict Invariants (Hardened):
 * 1. Semantic distinction: Synonyms are NEVER automatically treated as confused words.
 * 2. Evidence boundary: Personalized confusion is derived ONLY from actual semantic/lexical
 *    mistake evidence (Mistake Bank lastUserAnswer, quiz distractor, writing correction, AI Tutor).
 * 3. Non-semantic exclusion: Grammar errors, pronunciation transcripts, and multi-word sentences
 *    never create personalized confusion entries.
 * 4. Pair-specific counts: Target-level mistakeCount is NOT pair-specific frequency. Without explicit
 *    pair-tracking stats, each distinct mistake record with a matching wrong answer represents
 *    1 observed pair evidence event.
 * 5. Deduplication & Symmetric safety: Relationships like `maintain ↔ sustain` are symmetric.
 *    The same underlying MistakeRecord is never double-counted when scanning direct and symmetric paths.
 * 6. Static vs Personal isolation: Static "Commonly confused" pairs are strictly separated
 *    from personalized "You often confuse this with" history.
 * 7. Pure Read-Only: Zero side effects or mutations on store or input parameters.
 */

import type { MistakeRecord } from '../types';
import { cleanWordToken } from './wordLookupService';

export interface PersonalizedConfusionItem {
  word: string;
  count: number;
  lastOccurredAt: string | null;
  source: string;
  evidenceReason?: string;
}

export interface WordConfusionTelemetry {
  commonlyConfused: string[];
  personalizedConfusedWith: PersonalizedConfusionItem[];
}

/**
 * Curated high-confidence offline dictionary of commonly confused word pairs in English.
 * Bidirectional: querying either word in a pair returns the other.
 */
const COMMONLY_CONFUSED_DICTIONARY: Record<string, string[]> = {
  // Homophones & near-homophones
  accept: ['except'],
  except: ['accept'],
  affect: ['effect'],
  effect: ['affect'],
  allude: ['elude'],
  elude: ['allude'],
  aloud: ['allowed'],
  allowed: ['aloud'],
  bare: ['bear'],
  bear: ['bare'],
  breath: ['breathe'],
  breathe: ['breath'],
  capital: ['capitol'],
  capitol: ['capital'],
  censor: ['sensor'],
  sensor: ['censor'],
  cite: ['site', 'sight'],
  site: ['cite', 'sight'],
  sight: ['cite', 'site'],
  coarse: ['course'],
  course: ['coarse'],
  complement: ['compliment'],
  compliment: ['complement'],
  council: ['counsel'],
  counsel: ['council'],
  desert: ['dessert'],
  dessert: ['desert'],
  device: ['devise'],
  devise: ['device'],
  discreet: ['discrete'],
  discrete: ['discreet'],
  elicit: ['illicit'],
  illicit: ['elicit'],
  eminent: ['imminent'],
  imminent: ['eminent'],
  ensure: ['insure', 'assure'],
  insure: ['ensure', 'assure'],
  assure: ['ensure', 'insure'],
  farther: ['further'],
  further: ['farther'],
  lead: ['led'],
  led: ['lead'],
  lose: ['loose'],
  loose: ['lose'],
  peace: ['piece'],
  piece: ['peace'],
  practice: ['practise'],
  practise: ['practice'],
  precede: ['proceed'],
  proceed: ['precede'],
  principal: ['principle'],
  principle: ['principal'],
  stationary: ['stationery'],
  stationery: ['stationary'],
  than: ['then'],
  then: ['than'],
  there: ['their', "they're"],
  their: ['there', "they're"],
  weather: ['whether'],
  whether: ['weather'],

  // Semantic confusion / easily mixed academic words
  adverse: ['averse'],
  averse: ['adverse'],
  advice: ['advise'],
  advise: ['advice'],
  continuous: ['continual'],
  continual: ['continuous'],
  disinterested: ['uninterested'],
  uninterested: ['disinterested'],
  economic: ['economical'],
  economical: ['economic'],
  emigrate: ['immigrate'],
  immigrate: ['emigrate'],
  explicit: ['implicit'],
  implicit: ['explicit'],
  historic: ['historical'],
  historical: ['historic'],
  imply: ['infer'],
  infer: ['imply'],
  ingenious: ['ingenuous'],
  ingenuous: ['ingenious'],
  lay: ['lie'],
  lie: ['lay'],
  moral: ['morale'],
  morale: ['moral'],
  persecute: ['prosecute'],
  prosecute: ['persecute'],
  sensible: ['sensitive'],
  sensitive: ['sensible'],
  waive: ['wave'],
  wave: ['waive'],
  wander: ['wonder'],
  wonder: ['wander'],
};

/**
 * Retrieves curated static language-wide commonly confused words.
 * Returns empty array if none are known.
 */
export function getCommonlyConfusedWords(rawWord: string): string[] {
  const clean = cleanWordToken(rawWord);
  if (!clean) return [];
  const list = COMMONLY_CONFUSED_DICTIONARY[clean];
  return list ? [...list] : [];
}

/**
 * Normalizes a pair relation key deterministically (e.g. `['maintain', 'sustain']` -> `'maintain:::sustain'`)
 * to prevent duplicate entries and order-dependent inconsistencies.
 */
export function normalizeConfusionPairKey(wordA: string, wordB: string): string {
  const a = cleanWordToken(wordA);
  const b = cleanWordToken(wordB);
  return [a, b].sort().join(':::');
}

/**
 * Evaluates whether a MistakeRecord qualifies as eligible semantic/lexical confusion evidence.
 * Excludes grammar errors, pronunciation attempts, and free-text sentence answers.
 */
function isSemanticConfusionEligible(record: MistakeRecord): boolean {
  if (!record) return false;

  // Reject explicit grammar or pronunciation mistakes
  if (record.primaryType === 'grammar' || record.primaryType === 'pronunciation') {
    return false;
  }

  // Eligible types: meaning, vocabulary, collocation, or other non-grammar
  if (record.primaryType === 'meaning' || record.primaryType === 'collocation') return true;
  if (record.typeCounts?.meaning && record.typeCounts.meaning > 0) return true;

  // Eligible sources: quiz distractor, flashcard meaning error, speed match
  if (
    record.source === 'classic_quiz' ||
    record.source === 'quiz' ||
    record.source === 'flashcard' ||
    record.source === 'speed_match'
  ) {
    return true;
  }

  // Lexical Writing corrections or AI Tutor word corrections
  if (record.source === 'writing' || record.source === 'ai_tutor' || record.source === 'collocation') {
    return true;
  }

  // If neither primaryType nor source is specified (e.g. legacy MistakeRecord or minimal vocab test entry),
  // default to eligible as long as it wasn't explicitly grammar/pronunciation
  if (!record.primaryType && !record.source) {
    return true;
  }

  return false;
}

/**
 * Validates whether an answer string represents a valid single lexical word token.
 * Rejects multi-word phrases, sentences, punctuation soup, or pure numbers.
 */
function isValidConfusedWordToken(rawAnswer: string, targetKey: string): boolean {
  if (!rawAnswer || typeof rawAnswer !== 'string') return false;
  const clean = cleanWordToken(rawAnswer);
  if (
    !clean ||
    clean.length < 2 ||
    clean.length > 30 ||
    clean.includes(' ') ||
    clean.includes('\n') ||
    clean.includes('\t') ||
    /^\d+$/.test(clean) ||
    clean === targetKey
  ) {
    return false;
  }
  return true;
}

/**
 * Derives personalized confused words for a target word from actual learner evidence.
 * 
 * Invariants Enforced:
 * 1. Pair-Specific Count: Target-level `mistakeCount` is NOT assigned wholesale to `lastUserAnswer`.
 *    Each distinct MistakeRecord with an eligible wrong answer provides 1 observed pair evidence event.
 * 2. Record Identity Dedup: Records are tracked by unique record ID to prevent double-counting
 *    across direct and symmetric scanning.
 * 3. Semantic Filter: Rejects grammar, pronunciation, or free-text answers.
 * 4. Bounded: Returns top `maxResults` (default 10) sorted by frequency then recency.
 */
export function derivePersonalizedConfusions(
  targetWord: string,
  targetId: string,
  mistakeBank: Record<string, MistakeRecord> = {},
  maxResults: number = 10
): PersonalizedConfusionItem[] {
  const cleanTarget = cleanWordToken(targetWord);
  if (!cleanTarget) return [];

  const targetKey1 = cleanTarget;
  const targetKey2 = targetId ? targetId.toLowerCase().trim() : '';

  // Track unique underlying MistakeRecord IDs already counted to prevent double-counting
  const seenRecordIds = new Set<string>();

  // Aggregate map: confusedWord -> aggregation
  const aggMap = new Map<string, {
    count: number;
    lastOccurredAt: string | null;
    source: string;
    evidenceReason: string;
  }>();

  // Helper to safely register an evidence link
  const registerConfusionEvidence = (
    confusedWordRaw: string,
    record: MistakeRecord,
    reason: string
  ) => {
    // 1. Evidence eligibility check
    if (!isSemanticConfusionEligible(record)) return;

    // 2. Token validity check
    if (!isValidConfusedWordToken(confusedWordRaw, cleanTarget)) return;

    // 3. Prevent double-counting the SAME record
    const recordUniqueId = record.id || `${record.word}_${record.lastMistakeAt}`;
    if (seenRecordIds.has(recordUniqueId)) return;
    seenRecordIds.add(recordUniqueId);

    const cleanConfused = cleanWordToken(confusedWordRaw);
    const existing = aggMap.get(cleanConfused);

    // TRUTHFUL PAIR COUNT CONTRACT:
    // Without explicit pair-frequency tracking in MistakeRecord, each distinct MistakeRecord
    // with matching pair evidence contributes exactly 1 observed event.
    const pairEvidenceCount = 1;
    const recordTime = record.lastMistakeAt || null;
    const recordSource = record.source || 'other';

    if (!existing) {
      aggMap.set(cleanConfused, {
        count: pairEvidenceCount,
        lastOccurredAt: recordTime,
        source: recordSource,
        evidenceReason: reason,
      });
    } else {
      existing.count += pairEvidenceCount;
      if (recordTime) {
        if (!existing.lastOccurredAt || Date.parse(recordTime) > Date.parse(existing.lastOccurredAt)) {
          existing.lastOccurredAt = recordTime;
          existing.source = recordSource;
          existing.evidenceReason = reason;
        }
      }
    }
  };

  // 1. Direct evidence: mistakes on this target where user provided another word
  let directRecord =
    mistakeBank[targetKey1] ||
    (targetKey2 ? mistakeBank[targetKey2] : undefined) ||
    mistakeBank[`mistake_${targetKey1}`] ||
    mistakeBank[`vocab_${targetKey1}`];

  if (!directRecord) {
    for (const rec of Object.values(mistakeBank)) {
      if (!rec) continue;
      const recWord = cleanWordToken(rec.word);
      const recId = rec.id ? rec.id.toLowerCase().trim() : '';
      if (
        recWord === targetKey1 ||
        (targetKey2 && recId === targetKey2) ||
        recId === `mistake_${targetKey1}`
      ) {
        directRecord = rec;
        break;
      }
    }
  }

  if (directRecord && directRecord.lastUserAnswer) {
    registerConfusionEvidence(directRecord.lastUserAnswer, directRecord, 'direct_user_answer');
  }

  // 2. Symmetric evidence: check all other mistake records where user provided this target word as answer
  for (const [key, record] of Object.entries(mistakeBank)) {
    if (!record || key === targetKey1 || key === targetKey2) continue;

    if (record.lastUserAnswer) {
      const cleanAnswer = cleanWordToken(record.lastUserAnswer);
      if (cleanAnswer === cleanTarget) {
        // The user was tested on record.word, but answered cleanTarget!
        // This is symmetric evidence that they confuse record.word with cleanTarget.
        const otherWord = record.word || key;
        registerConfusionEvidence(otherWord, record, 'symmetric_user_answer');
      }
    }
  }

  // 3. Format and sort by count desc, then timestamp desc
  const results: PersonalizedConfusionItem[] = Array.from(aggMap.entries()).map(([word, data]) => ({
    word,
    count: data.count,
    lastOccurredAt: data.lastOccurredAt,
    source: data.source,
    evidenceReason: data.evidenceReason,
  }));

  results.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.lastOccurredAt && b.lastOccurredAt) {
      return Date.parse(b.lastOccurredAt) - Date.parse(a.lastOccurredAt);
    }
    return a.word.localeCompare(b.word);
  });

  return results.slice(0, maxResults);
}

/**
 * Builds the complete WordConfusionTelemetry combining both static knowledge
 * and personalized learner history.
 */
export function getWordConfusionTelemetry(
  targetWord: string,
  targetId: string,
  mistakeBank: Record<string, MistakeRecord> = {}
): WordConfusionTelemetry {
  const commonlyConfused = getCommonlyConfusedWords(targetWord);
  const personalizedConfusedWith = derivePersonalizedConfusions(targetWord, targetId, mistakeBank);

  return {
    commonlyConfused,
    personalizedConfusedWith,
  };
}
