// src/services/tutorFeedbackBridge.ts
/**
 * AI Tutor Feedback Bridge
 * 
 * Bridges trusted learning telemetry from AI Tutor back into the core learning system:
 * - Mistake Bank (vocabulary, grammar, pronunciation mistakes)
 * - Collocation SRS (collocation misuse & native lexical phrases)
 * - Weak Vocabulary & Adaptive Mistake scoring
 * 
 * Invariants:
 * 1. ZERO write on untrusted telemetry (isTrusted !== true).
 * 2. Deduplication & canonical normalization:
 *    - Equivalent grammar patterns normalize to single canonical pattern keys (e.g. although-vs-despite).
 *    - Collocations deduplicate by normalized phrase and merge provenance sources.
 *    - Repeated mistakes in multiple messages increment frequency/recency rather than appending duplicates.
 * 3. Does not invent artificial learning items or record arbitrary conversation chatter.
 * 4. Backward compatible with existing Mistake Bank and SRS stores.
 */

import { useAppStore } from '../store/useAppStore';
import type {
  AppStore,
  TutorLearningTelemetry,
  DetectedMistakeDetail,
  ChatFeedback,
  MistakeType,
  VocabWord,
  MistakeRecord,
} from '../types';
import { toCanonicalType } from './adaptiveMistakeService';
import {
  stripEdgePunctuation,
  normalizeCollocationPhrase,
  normalizeCollocationKey,
  isCollocationCandidate,
} from './fourSkillsLearningBridge';
import { resolveCanonicalVocab } from './wordLookupService';
import { isValidVocabularyTarget } from './tutorLearningContext';

export interface NormalizedGrammarPattern {
  patternKey: string;
  patternDisplay: string;
}

export interface IngestTutorFeedbackOptions {
  telemetry?: TutorLearningTelemetry | null;
  userMessage: string;
  feedback?: ChatFeedback | null;
  store?: AppStore;
  turnId?: string;
  responseId?: string;
  sessionId?: string;
  userId?: string;
  candidateTargets?: string[];
  currentTarget?: string;
  hasSpeechEvidence?: boolean;
  autoEnrollCollocationSRS?: boolean;
}

export interface IngestTutorFeedbackResult {
  ingested: boolean;
  reason?: string;
  mistakesRecorded: number;
  mistakesResolved?: number;
  collocationsSaved: number;
  wordsSaved: number;
  collocationSuggestions?: string[];
  details: {
    grammarPatterns: string[];
    collocations: string[];
    collocationSuggestions?: string[];
    vocabularyWords: string[];
    pronunciationWords: string[];
    resolvedMistakes?: string[];
  };
}

// Bounded in-memory cache to ensure idempotency across duplicate calls for the same turn
const ingestedTurnKeys = new Set<string>();
const MAX_INGESTED_KEYS = 200;

/**
 * Resets the in-memory ingestion cache (primarily for unit tests).
 */
export function clearIngestionHistory(): void {
  ingestedTurnKeys.clear();
}

/**
 * Computes a deterministic identity for a turn to prevent double ingestion.
 * Composite key: userId + sessionId + turnId to avoid cross-session or cross-scenario collision.
 */
function computeTurnIngestionKey(options: IngestTutorFeedbackOptions): string {
  const parts: string[] = [];

  if (options.userId && options.userId.trim().length > 0) {
    parts.push(`u:${options.userId.trim()}`);
  }
  if (options.sessionId && options.sessionId.trim().length > 0) {
    parts.push(`sess:${options.sessionId.trim()}`);
  }

  if (options.turnId && options.turnId.trim().length > 0) {
    parts.push(`turn:${options.turnId.trim()}`);
    return parts.join('::');
  }
  if (options.responseId && options.responseId.trim().length > 0) {
    parts.push(`resp:${options.responseId.trim()}`);
    return parts.join('::');
  }
  const mistakesSig = (options.telemetry?.detectedMistakes || [])
    .map((m) => `${m?.target || ''}:${m?.type || ''}:${m?.correction || ''}`)
    .sort()
    .join('|');
  parts.push(`sig:${(options.userMessage || '').trim().toLowerCase()}:::${mistakesSig}`);
  return parts.join('::');
}

/**
 * Normalizes grammar mistakes into canonical ESL/CEFR patterns.
 * Groups equivalent variations into a single persistent record key.
 * Curated known reversible patterns normalize deterministically without
 * aggressively merging unrelated grammar topics.
 */
export function normalizeGrammarPattern(
  target: string,
  context?: { correction?: string; explanation?: string; userAnswer?: string }
): NormalizedGrammarPattern {
  const rawTarget = typeof target === 'string' ? target.toLowerCase().trim() : '';
  const rawExp = typeof context?.explanation === 'string' ? context.explanation.toLowerCase() : '';
  const rawCorr = typeof context?.correction === 'string' ? context.correction.toLowerCase() : '';
  const rawAns = typeof context?.userAnswer === 'string' ? context.userAnswer.toLowerCase() : '';
  const combined = `${rawTarget} ${rawExp} ${rawCorr} ${rawAns}`;

  // 1. Contrast clauses: although vs despite / in spite of
  const hasAlthough = combined.includes('although') || combined.includes('though');
  const hasDespite = combined.includes('despite') || combined.includes('in spite of');
  const isAlthoughVsDespite =
    (hasAlthough && hasDespite) ||
    rawTarget.includes('although vs despite') ||
    rawTarget.includes('despite vs although') ||
    rawTarget.includes('contrast clause') ||
    rawTarget.includes('mệnh đề tương phản');

  if (isAlthoughVsDespite) {
    return {
      patternKey: 'grammar_although_vs_despite',
      patternDisplay: 'although vs despite',
    };
  }

  // 2. Reason clauses: because vs because of / due to
  const isBecauseVsBecauseOf =
    rawTarget.includes('because vs because of') ||
    rawTarget.includes('because of vs because') ||
    rawTarget.includes('due to vs because') ||
    rawTarget.includes('because vs due to') ||
    rawTarget.includes('reason clause') ||
    rawTarget.includes('mệnh đề nguyên nhân') ||
    (rawTarget.includes('because') &&
      (rawExp.includes('because of') || rawExp.includes('due to') || rawExp.includes('owing to')));

  if (isBecauseVsBecauseOf) {
    return {
      patternKey: 'grammar_because_vs_because_of',
      patternDisplay: 'because vs because of',
    };
  }

  // 3. Conditionals (Type 1, 2, 3, Mixed)
  if (
    rawTarget.includes('third conditional') ||
    rawTarget.includes('điều kiện loại 3') ||
    rawTarget.includes('type 3 conditional') ||
    (rawTarget.includes('conditional') && combined.includes('loại 3'))
  ) {
    return {
      patternKey: 'grammar_conditionals_third',
      patternDisplay: 'third conditional',
    };
  }
  if (
    rawTarget.includes('second conditional') ||
    rawTarget.includes('điều kiện loại 2') ||
    rawTarget.includes('type 2 conditional') ||
    (rawTarget.includes('conditional') && combined.includes('loại 2'))
  ) {
    return {
      patternKey: 'grammar_conditionals_second',
      patternDisplay: 'second conditional',
    };
  }
  if (
    rawTarget.includes('first conditional') ||
    rawTarget.includes('điều kiện loại 1') ||
    rawTarget.includes('type 1 conditional') ||
    (rawTarget.includes('conditional') && combined.includes('loại 1'))
  ) {
    return {
      patternKey: 'grammar_conditionals_first',
      patternDisplay: 'first conditional',
    };
  }
  if (rawTarget.includes('conditional') || rawTarget.includes('câu điều kiện')) {
    return {
      patternKey: 'grammar_conditionals',
      patternDisplay: 'conditionals',
    };
  }

  // 4. Present perfect vs past simple
  if (
    rawTarget.includes('present perfect vs past simple') ||
    rawTarget.includes('past simple vs present perfect') ||
    (rawTarget.includes('present perfect') &&
      (rawExp.includes('past simple') || rawAns.includes('past simple')))
  ) {
    return {
      patternKey: 'grammar_present_perfect_vs_past_simple',
      patternDisplay: 'present perfect vs past simple',
    };
  }
  if (rawTarget.includes('present perfect') || rawTarget.includes('hiện tại hoàn thành')) {
    return {
      patternKey: 'grammar_present_perfect',
      patternDisplay: 'present perfect',
    };
  }
  if (rawTarget.includes('past continuous') || rawTarget.includes('quá khứ tiếp diễn')) {
    return {
      patternKey: 'grammar_past_continuous_vs_past_simple',
      patternDisplay: 'past continuous vs past simple',
    };
  }

  // 5. Subject-verb agreement
  if (
    rawTarget.includes('subject-verb') ||
    rawTarget.includes('subject verb') ||
    rawTarget.includes('chủ vị') ||
    rawTarget.includes('hòa hợp chủ ngữ') ||
    rawTarget.includes('chủ ngữ số ít')
  ) {
    return {
      patternKey: 'grammar_subject_verb_agreement',
      patternDisplay: 'subject-verb agreement',
    };
  }

  // 6. Gerund vs Infinitive
  if (
    rawTarget.includes('gerund vs infinitive') ||
    rawTarget.includes('infinitive vs gerund') ||
    rawTarget.includes('to v vs v-ing') ||
    rawTarget.includes('gerund') ||
    rawTarget.includes('infinitive') ||
    rawTarget.includes('danh động từ')
  ) {
    return {
      patternKey: 'grammar_gerund_vs_infinitive',
      patternDisplay: 'gerund vs infinitive',
    };
  }

  // 7. Passive voice
  if (rawTarget.includes('passive voice') || rawTarget.includes('câu bị động') || rawTarget.includes('bị động')) {
    return {
      patternKey: 'grammar_passive_voice',
      patternDisplay: 'passive voice',
    };
  }

  // 8. Relative clauses
  if (
    rawTarget.includes('relative clause') ||
    rawTarget.includes('mệnh đề quan hệ') ||
    rawTarget.includes('who vs whom') ||
    rawTarget.includes('which vs that')
  ) {
    return {
      patternKey: 'grammar_relative_clauses',
      patternDisplay: 'relative clauses',
    };
  }

  // 9. Articles (a, an, the)
  if (
    rawTarget.includes('article') ||
    rawTarget.includes('mạo từ') ||
    rawTarget.includes('a/an/the') ||
    rawTarget.includes('definite article')
  ) {
    return {
      patternKey: 'grammar_articles',
      patternDisplay: 'articles (a/an/the)',
    };
  }

  // 10. Prepositions
  if (rawTarget.includes('preposition') || rawTarget.includes('giới từ') || rawTarget.includes('in/on/at')) {
    return {
      patternKey: 'grammar_prepositions',
      patternDisplay: 'prepositions',
    };
  }

  // 11. Slugified Fallback for distinct novel grammar topics
  const slug = rawTarget
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 40);

  const cleanDisplay = stripEdgePunctuation(target || 'Ngữ pháp').slice(0, 45);

  return {
    patternKey: slug ? `grammar_${slug}` : 'grammar_general',
    patternDisplay: cleanDisplay || 'General grammar',
  };
}

/**
 * Validates whether a candidate string is a viable collocation from mistake telemetry.
 */
export function extractCollocationFromMistake(mistake: DetectedMistakeDetail): string | null {
  const exp = mistake.explanation || '';

  // 1. Check if explanation quotes or explicitly mentions the recommended collocation phrase
  const quotedMatch = exp.match(/["'“‘]([^"'”’]+)["'”’]/);
  if (quotedMatch) {
    const candidate = normalizeCollocationPhrase(quotedMatch[1]);
    const words = candidate.split(/\s+/);
    if (words.length >= 2 && words.length <= 5 && isCollocationCandidate(candidate)) {
      return candidate;
    }
  }

  // Check if explanation has pattern "Dùng: <phrase>" or ": <phrase>"
  const colonMatch = exp.match(/:\s*([a-zA-Z\s'-]+)[.,;!?]?/);
  if (colonMatch) {
    const candidate = normalizeCollocationPhrase(colonMatch[1]);
    const words = candidate.split(/\s+/);
    if (words.length >= 2 && words.length <= 5 && isCollocationCandidate(candidate)) {
      return candidate;
    }
  }

  // 2. Check mistake.target (if it is a concise 2-5 word collocation phrase)
  if (mistake.target) {
    const targetPhrase = normalizeCollocationPhrase(mistake.target);
    const words = targetPhrase.split(/\s+/);
    if (words.length >= 2 && words.length <= 5 && isCollocationCandidate(targetPhrase)) {
      return targetPhrase;
    }
  }

  // 3. Check mistake.correction (only if concise 2-5 word phrase, not a full sentence)
  if (mistake.correction) {
    const corrPhrase = normalizeCollocationPhrase(mistake.correction);
    const words = corrPhrase.split(/\s+/);
    if (words.length >= 2 && words.length <= 5 && isCollocationCandidate(corrPhrase)) {
      return corrPhrase;
    }
  }

  return null;
}

/**
 * Validates a detected mistake against local evidence to prevent hallucinated weaknesses.
 * Requires either:
 * - Match against current focused target or candidate session targets
 * - Direct appearance of the target in the user's actual utterance
 * - Verifiable grammar signal or structured span present in user's utterance
 */
export function isMistakeEvidentInUserTurn(
  mistake: DetectedMistakeDetail,
  userMessage: string,
  options?: { candidateTargets?: string[]; currentTarget?: string }
): boolean {
  if (!mistake || typeof mistake !== 'object') return false;

  const rawTarget = typeof mistake.target === 'string' ? mistake.target.toLowerCase().trim() : '';
  const rawAns = typeof mistake.userAnswer === 'string' ? mistake.userAnswer.toLowerCase().trim() : '';
  const cleanMsg = (userMessage || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  const msgTokens = new Set(cleanMsg.split(/\s+/).filter(Boolean));

  // 1. Check if target explicitly matches current focused target or candidate targets
  if (options?.currentTarget) {
    const curNorm = options.currentTarget.toLowerCase().trim();
    if (curNorm && (rawTarget.includes(curNorm) || curNorm.includes(rawTarget))) {
      return true;
    }
  }
  if (Array.isArray(options?.candidateTargets) && options.candidateTargets.length > 0) {
    const isTargetInCandidates = options.candidateTargets.some((ct) => {
      const norm = (ct || '').toLowerCase().trim();
      return norm && (rawTarget.includes(norm) || norm.includes(rawTarget));
    });
    if (isTargetInCandidates) return true;
  }

  // 2. Direct lexical presence: target or its significant words appear in user utterance
  if (rawTarget.length > 0) {
    const targetClean = rawTarget.replace(/[^a-z0-9\s]/g, ' ').trim();
    if (cleanMsg.includes(targetClean)) return true;
    if (msgTokens.has(targetClean)) return true;
    const targetWords = targetClean.split(/\s+/).filter((w) => w.length > 2);
    if (targetWords.length >= 2 && targetWords.some((w) => msgTokens.has(w))) {
      return true;
    }
  }

  // 3. User answer span verification: model-reported userAnswer actually exists in userMessage
  if (rawAns.length >= 3) {
    const ansClean = rawAns.replace(/[^a-z0-9\s]/g, ' ').trim();
    if (cleanMsg.includes(ansClean)) return true;
    const ansWords = ansClean.split(/\s+/).filter((w) => w.length > 2);
    if (ansWords.length >= 2 && ansWords.some((w) => msgTokens.has(w))) {
      return true;
    }
  }

  // 4. Grammar patterns keyword evidence in user utterance
  const type = mistake.type?.toLowerCase();
  if (type === 'grammar' || rawTarget.includes('grammar') || rawTarget.includes('clause') || rawTarget.includes('conditional')) {
    // Contrast clauses
    if (rawTarget.includes('although') || rawTarget.includes('despite') || rawTarget.includes('contrast')) {
      if (msgTokens.has('although') || msgTokens.has('though') || msgTokens.has('despite') || cleanMsg.includes('in spite of')) {
        return true;
      }
    }
    // Conditionals
    if (rawTarget.includes('conditional') || rawTarget.includes('điều kiện')) {
      if (
        msgTokens.has('if') ||
        msgTokens.has('unless') ||
        msgTokens.has('had') ||
        msgTokens.has('would') ||
        msgTokens.has('could') ||
        msgTokens.has('were')
      ) {
        return true;
      }
    }
    // Reason clauses
    if (rawTarget.includes('because') || rawTarget.includes('due to')) {
      if (msgTokens.has('because') || cleanMsg.includes('due to') || cleanMsg.includes('owing to')) {
        return true;
      }
    }
    // Gerund / infinitive
    if (rawTarget.includes('gerund') || rawTarget.includes('infinitive') || rawTarget.includes('to v') || rawTarget.includes('v-ing')) {
      if (msgTokens.has('to') || Array.from(msgTokens).some((t) => t.endsWith('ing'))) {
        return true;
      }
    }
    // Present perfect vs past simple
    if (rawTarget.includes('present perfect') || rawTarget.includes('past simple')) {
      if (
        msgTokens.has('have') ||
        msgTokens.has('has') ||
        msgTokens.has('had') ||
        msgTokens.has('did') ||
        Array.from(msgTokens).some((t) => t.endsWith('ed'))
      ) {
        return true;
      }
    }
    // Passive voice
    if (rawTarget.includes('passive') || rawTarget.includes('bị động')) {
      if (msgTokens.has('was') || msgTokens.has('were') || msgTokens.has('been') || msgTokens.has('by')) {
        return true;
      }
    }
    // Relative clauses
    if (rawTarget.includes('relative') || rawTarget.includes('who') || rawTarget.includes('which') || rawTarget.includes('that')) {
      if (
        msgTokens.has('who') ||
        msgTokens.has('whom') ||
        msgTokens.has('which') ||
        msgTokens.has('that') ||
        msgTokens.has('whose')
      ) {
        return true;
      }
    }
    // Articles
    if (rawTarget.includes('article') || rawTarget.includes('mạo từ')) {
      if (msgTokens.has('a') || msgTokens.has('an') || msgTokens.has('the')) {
        return true;
      }
    }
  }

  // 5. Collocation target keywords in utterance
  if (type === 'collocation' && mistake.correction) {
    const corrClean = mistake.correction.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    const corrWords = corrClean.split(/\s+/).filter((w) => w.length > 2);
    if (corrWords.some((w) => msgTokens.has(w))) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether telemetry is reliable enough for learning system ingestion.
 */
export function isReliableTutorTelemetry(
  telemetry?: TutorLearningTelemetry | null
): boolean {
  if (!telemetry || typeof telemetry !== 'object') return false;
  // Rule 1: Must be explicitly trusted (live model output, not fallback/synthetic)
  if (telemetry.isTrusted !== true) return false;
  // Rule 2: Must have at least one detected mistake or practiced target
  const hasMistakes = Array.isArray(telemetry.detectedMistakes) && telemetry.detectedMistakes.length > 0;
  const hasPracticed = Array.isArray(telemetry.practicedTargets) && telemetry.practicedTargets.length > 0;
  return hasMistakes || hasPracticed;
}

/**
 * Explicit helper to enroll a recommended collocation from AI Tutor into Collocation SRS.
 * Enforces EXPLICIT USER SAVE ONLY policy.
 */
export function enrollTutorCollocationToSRS(
  phrase: string,
  options?: {
    meaning?: string;
    exampleEn?: string;
    exampleVi?: string;
    store?: AppStore;
  }
): { success: boolean; id: string; isDuplicate?: boolean } {
  const activeStore = options?.store || useAppStore.getState();
  return activeStore.saveCollocationToSRS({
    phrase,
    meaning: options?.meaning || 'Cụm từ tiếng Anh tự nhiên',
    exampleEn: options?.exampleEn || phrase,
    exampleVi: options?.exampleVi || 'Lưu từ gợi ý AI Tutor',
    source: 'ai_tutor',
    sources: ['ai_tutor'],
  });
}

/**
 * Ingests trusted AI Tutor telemetry into the core learning system.
 * Deduplicates and updates frequency/recency on existing records.
 */
export function ingestTutorFeedback(
  options: IngestTutorFeedbackOptions
): IngestTutorFeedbackResult {
  const {
    telemetry,
    userMessage,
    store,
    candidateTargets,
    currentTarget,
    hasSpeechEvidence = false,
    autoEnrollCollocationSRS = false,
  } = options;

  const result: IngestTutorFeedbackResult = {
    ingested: false,
    mistakesRecorded: 0,
    collocationsSaved: 0,
    wordsSaved: 0,
    collocationSuggestions: [],
    details: {
      grammarPatterns: [],
      collocations: [],
      collocationSuggestions: [],
      vocabularyWords: [],
      pronunciationWords: [],
    },
  };

  // Guard 1: Only trusted model output is allowed to update learning records
  if (!isReliableTutorTelemetry(telemetry)) {
    result.reason = 'untrusted_or_empty_telemetry';
    return result;
  }

  // Guard 2: Idempotency across duplicate calls for the exact same turn / AI response
  const turnKey = computeTurnIngestionKey(options);
  if (ingestedTurnKeys.has(turnKey)) {
    result.reason = 'duplicate_turn_ingestion';
    return result;
  }

  const rawMistakes = Array.isArray(telemetry?.detectedMistakes) ? telemetry.detectedMistakes : [];
  const hasMasterySignal = telemetry?.masteryDemonstrated === true;

  if (rawMistakes.length === 0 && !hasMasterySignal) {
    result.reason = 'no_detected_mistakes_or_mastery';
    return result;
  }

  const activeStore = store || useAppStore.getState();
  const currentVocabList = activeStore.vocabularyList || [];
  const wordMap = new Map<string, VocabWord>();
  for (const w of currentVocabList) {
    if (w && w.word) {
      wordMap.set(w.word.toLowerCase().trim(), w);
    }
  }

  // Prevent duplicate execution of identical mistakes within the same message turn
  const turnSeenKeys = new Set<string>();

  // Authoritative user answer derived from the actual local utterance, not model echo
  const authoritativeUserAnswer = (userMessage || '').slice(0, 150);
  const authoritativeContext = userMessage || '';

  for (const mistake of rawMistakes) {
    if (!mistake || typeof mistake !== 'object') continue;

    // Validate mistake against local evidence to prevent hallucinated weaknesses
    const isEvident = isMistakeEvidentInUserTurn(mistake, userMessage, {
      candidateTargets,
      currentTarget,
    });
    if (!isEvident) {
      // Reject unverifiable / hallucinated targets
      continue;
    }

    const rawTarget = typeof mistake.target === 'string' ? mistake.target.trim() : '';
    const rawType: MistakeType = toCanonicalType(mistake.type, 'ai_tutor');
    const explanation = typeof mistake.explanation === 'string' ? mistake.explanation.slice(0, 200) : '';
    const correction = typeof mistake.correction === 'string' ? mistake.correction.slice(0, 150) : '';

    // =========================================================================
    // 1. Grammar Mistakes -> Normalized Pattern
    // =========================================================================
    if (rawType === 'grammar') {
      const { patternKey, patternDisplay } = normalizeGrammarPattern(rawTarget, {
        correction,
        explanation,
        userAnswer: authoritativeUserAnswer,
      });

      if (turnSeenKeys.has(patternKey)) continue;
      turnSeenKeys.add(patternKey);

      activeStore.recordMistake(
        {
          id: patternKey,
          word: patternDisplay,
          meaning: explanation || 'Quy tắc ngữ pháp',
          example: correction || userMessage,
        },
        'ai_tutor',
        {
          type: 'grammar',
          userAnswer: authoritativeUserAnswer,
          expectedAnswer: correction,
          context: authoritativeContext,
        }
      );

      result.mistakesRecorded++;
      result.details.grammarPatterns.push(patternDisplay);
      continue;
    }

    // =========================================================================
    // 2. Collocation Mistakes -> Collocation SRS (Explicit Only) + Mistake Bank
    // =========================================================================
    if (rawType === 'collocation') {
      const collocPhrase = extractCollocationFromMistake(mistake);

      if (collocPhrase) {
        const collocKey = normalizeCollocationKey(collocPhrase);
        const collocId = `colloc_${collocKey.replace(/\s+/g, '_')}`;
        if (turnSeenKeys.has(collocId)) continue;
        turnSeenKeys.add(collocId);

        // A. Record in Mistake Bank for adaptive repetition / weakness diagnosis
        activeStore.recordMistake(
          {
            id: collocId,
            word: collocPhrase,
            meaning: explanation || 'Cụm từ kết hợp tự nhiên',
            example: correction || authoritativeUserAnswer,
          },
          'ai_tutor',
          {
            type: 'collocation',
            userAnswer: authoritativeUserAnswer,
            expectedAnswer: correction || collocPhrase,
            context: authoritativeContext,
          }
        );
        result.mistakesRecorded++;
        result.details.collocations.push(collocPhrase);

        if (!result.collocationSuggestions) result.collocationSuggestions = [];
        result.collocationSuggestions.push(collocPhrase);
        if (result.details.collocationSuggestions) {
          result.details.collocationSuggestions.push(collocPhrase);
        }

        // B. EXPLICIT USER SAVE ONLY: Save to SRS only if explicitly requested
        if (autoEnrollCollocationSRS === true) {
          activeStore.saveCollocationToSRS({
            phrase: collocPhrase,
            meaning: explanation || 'Cụm từ tiếng Anh tự nhiên',
            exampleEn: correction || authoritativeUserAnswer,
            exampleVi: explanation || 'Ví dụ giao tiếp cùng AI Tutor',
            source: 'ai_tutor',
            sources: ['ai_tutor'],
          });
          result.collocationsSaved++;
        }
        continue;
      }
    }

    // =========================================================================
    // 3. Pronunciation Mistakes -> Requires Speech Evidence
    // =========================================================================
    if (rawType === 'pronunciation') {
      // Invariant: Do not persist pronunciation weakness without physical speech evidence
      if (hasSpeechEvidence !== true) {
        continue;
      }

      const cleanWord = stripEdgePunctuation(rawTarget).toLowerCase();
      if (cleanWord && cleanWord.length >= 2 && !/\s/.test(cleanWord)) {
        const pronKey = `pron_${cleanWord}`;
        if (turnSeenKeys.has(pronKey)) continue;
        turnSeenKeys.add(pronKey);

        activeStore.recordMistake(
          {
            id: pronKey,
            word: cleanWord,
            meaning: explanation || 'Lỗi phát âm trong hội thoại',
            example: userMessage,
          },
          'ai_tutor',
          {
            type: 'pronunciation',
            userAnswer: authoritativeUserAnswer,
            expectedAnswer: correction || cleanWord,
            context: authoritativeContext,
          }
        );

        result.mistakesRecorded++;
        result.details.pronunciationWords.push(cleanWord);
        continue;
      }
    }

    // =========================================================================
    // 4. Vocabulary / Spelling / Meaning Mistakes
    // =========================================================================
    if (
      rawType === 'meaning' ||
      rawType === 'spelling' ||
      rawType === 'reading' ||
      rawType === 'writing' ||
      rawType === 'other'
    ) {
      const cleanWord = stripEdgePunctuation(rawTarget);
      if (isValidVocabularyTarget(cleanWord, rawType, wordMap)) {
        const resolved = resolveCanonicalVocab(cleanWord, currentVocabList);
        const canonWord = resolved?.canonicalWord.word || cleanWord;
        const canonKey = (resolved?.canonicalId || cleanWord).toLowerCase();

        if (turnSeenKeys.has(canonKey)) continue;
        turnSeenKeys.add(canonKey);

        activeStore.recordMistake(
          {
            id: resolved?.canonicalId || `vocab_${canonKey}`,
            word: canonWord,
            ipa: resolved?.canonicalWord.ipa,
            meaning: explanation || resolved?.canonicalWord.meaning || 'Từ vựng cần củng cố',
            example: correction || authoritativeUserAnswer,
          },
          'ai_tutor',
          {
            type: rawType,
            userAnswer: authoritativeUserAnswer,
            expectedAnswer: correction,
            context: authoritativeContext,
          }
        );

        result.mistakesRecorded++;
        result.details.vocabularyWords.push(canonWord);
        continue;
      }
    }
  }

  // =========================================================================
  // 5. Mastery Demonstrated -> Mistake Bank Resolution (ZERO mutation of SRS)
  // Invariant: Success/mastery MAY update Mistake Bank consecutiveCorrect and
  // resolve weakness, but MUST NOT directly mutate official FSRS/SM-2 scheduling.
  // =========================================================================
  if (hasMasterySignal) {
    const candidateMasteryTargets = new Set<string>();
    if (currentTarget) {
      candidateMasteryTargets.add(currentTarget);
    }
    if (Array.isArray(telemetry?.practicedTargets)) {
      for (const pt of telemetry.practicedTargets) {
        if (typeof pt === 'string' && pt.trim()) {
          candidateMasteryTargets.add(pt.trim());
        }
      }
    }
    if (Array.isArray(candidateTargets)) {
      for (const ct of candidateTargets) {
        if (typeof ct === 'string' && ct.trim()) {
          candidateMasteryTargets.add(ct.trim());
        }
      }
    }

    const cleanMsg = (userMessage || '').toLowerCase();
    for (const rawTarget of candidateMasteryTargets) {
      const lowerTarget = rawTarget.toLowerCase().trim();
      if (!lowerTarget) continue;

      // Ensure no mistake occurred on this target in this turn
      if (turnSeenKeys.has(lowerTarget)) continue;

      // Conservative local evidence: target must be the current focused target,
      // or its key words must appear in user message
      const targetWords = lowerTarget.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
      const isEvident =
        (currentTarget && lowerTarget === currentTarget.toLowerCase().trim()) ||
        cleanMsg.includes(lowerTarget) ||
        (targetWords.length > 0 && targetWords.some((w) => cleanMsg.includes(w)));

      if (!isEvident) continue;

      // Find matching entry in Mistake Bank
      const mb = activeStore.mistakeBank;
      const normalizedGrammar = normalizeGrammarPattern(lowerTarget);
      const collocKey = `colloc_${normalizeCollocationKey(lowerTarget).replace(/\s+/g, '_')}`;

      let matchedKey: string | undefined;
      let matchedRecord: MistakeRecord | undefined;

      // 1. Direct key match
      if (mb[lowerTarget]) {
        matchedKey = lowerTarget;
        matchedRecord = mb[lowerTarget];
      } else if (mb[normalizedGrammar.patternKey]) {
        matchedKey = normalizedGrammar.patternKey;
        matchedRecord = mb[normalizedGrammar.patternKey];
      } else if (mb[collocKey]) {
        matchedKey = collocKey;
        matchedRecord = mb[collocKey];
      } else if (mb[`vocab_${lowerTarget}`]) {
        matchedKey = `vocab_${lowerTarget}`;
        matchedRecord = mb[`vocab_${lowerTarget}`];
      } else {
        // 2. Scan by word property or id
        for (const [key, record] of Object.entries(mb)) {
          if (!record) continue;
          const recWord = (record.word || '').toLowerCase().trim();
          const recId = (record.id || '').toLowerCase().trim();
          if (
            recWord === lowerTarget ||
            recWord === normalizedGrammar.patternDisplay ||
            recId === normalizedGrammar.patternKey ||
            recId === collocKey ||
            (targetWords.length >= 2 && targetWords.every((w) => recWord.includes(w)))
          ) {
            matchedKey = key;
            matchedRecord = record;
            break;
          }
        }
      }

      if (matchedKey && matchedRecord) {
        // Record correct usage in Mistake Bank (increments consecutiveCorrect, resolves if >= 2)
        activeStore.recordMistakeCorrect(matchedKey, { type: matchedRecord.primaryType });
        result.mistakesResolved = (result.mistakesResolved || 0) + 1;
        if (!result.details.resolvedMistakes) {
          result.details.resolvedMistakes = [];
        }
        result.details.resolvedMistakes.push(matchedRecord.word || matchedKey);
      }
    }
  }

  result.ingested =
    result.mistakesRecorded > 0 ||
    result.collocationsSaved > 0 ||
    (result.mistakesResolved || 0) > 0;

  if (result.ingested) {
    ingestedTurnKeys.add(turnKey);
    if (ingestedTurnKeys.size > MAX_INGESTED_KEYS) {
      const first = ingestedTurnKeys.values().next().value;
      if (first) ingestedTurnKeys.delete(first);
    }
  }

  return result;
}
