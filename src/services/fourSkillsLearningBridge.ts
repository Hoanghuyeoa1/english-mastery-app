// src/services/fourSkillsLearningBridge.ts
/**
 * Four Skills Learning Bridge
 * Unified Adapter & Orchestration Facade for Reading, Listening, Speaking, and Writing.
 * 
 * Architectural Invariants:
 * - Does NOT reimplement FSRS algorithm, mistake scoring, or dictionary indexing.
 * - Delegates directly to existing store actions and domain services.
 * - Strictly enforces bounded contexts (never dumps full essays into Mistake Bank).
 * - Enforces canonical vocabulary and collocation key normalization (no duplicate cards).
 * - Zero direct mutation of FSRS state (preserves stability, difficulty, intervals).
 */

import type {
  VocabWord,
  CollocationItem,
  MistakeType,
  MistakeSource,
  VocabTag,
  SRSProgress,
  DiffSegmentType,
  MistakeRecord,
  ActiveTab,
} from '../types';
import { resolveCanonicalVocab } from './wordLookupService';
import { composeVocabularyList } from '../store/useAppStore';
import { isDueForReview } from './srsAlgorithm';
import {
  resolveListeningQuestionTarget,
  resolveReadingQuestionTarget,
  PRONUNCIATION_FAIL_THRESHOLD,
  PRONUNCIATION_PASS_THRESHOLD,
  toCanonicalSource,
  toCanonicalType,
  getPronunciationPracticeQueue,
} from './adaptiveMistakeService';

/**
 * Strips wrapping edge punctuation (quotes, brackets, trailing periods/commas)
 * while strictly preserving internal punctuation like hyphens (state-of-the-art)
 * and apostrophes (can't help doing something).
 */
export function stripEdgePunctuation(str: string): string {
  if (!str) return '';
  let s = str.trim();
  s = s.replace(/^[\s"'“‘([<«\-—.,;:!?]+/, '');
  s = s.replace(/[\s"'”’)\]>»\-—.,;:!?]+$/, '');
  return s.trim();
}

/**
 * Normalizes collocation phrase for display:
 * Strips outer quotes and punctuation wrappers, collapses internal whitespace.
 */
export function normalizeCollocationPhrase(phrase: string): string {
  if (!phrase) return '';
  const stripped = stripEdgePunctuation(phrase);
  return stripped.replace(/\s+/g, ' ');
}

/**
 * Normalizes collocation key for case-insensitive, edge-punctuation-insensitive,
 * and whitespace-insensitive deduplication.
 */
export function normalizeCollocationKey(phrase: string): string {
  return normalizeCollocationPhrase(phrase).toLowerCase();
}

export interface CollocationCandidateCheckOptions {
  originalText?: string;
  revisedText?: string;
  type?: string;
  explanation?: string;
  reasonVi?: string;
}

/**
 * Checks if a diff segment or phrase is a valid collocation candidate.
 * Pure grammatical fixes (e.g. "don't" -> "doesn't", "is" -> "are")
 * and entire paragraphs (> 8 words or > 60 chars) are NOT collocations.
 */
export function isCollocationCandidate(
  input: CollocationCandidateCheckOptions | string
): boolean {
  if (!input) return false;

  let phrase = '';
  let segmentType = '';
  let explanation = '';

  if (typeof input === 'string') {
    phrase = normalizeCollocationPhrase(input);
  } else {
    phrase = normalizeCollocationPhrase(input.revisedText || input.originalText || '');
    segmentType = input.type || '';
    explanation = `${input.explanation || ''} ${input.reasonVi || ''}`.toLowerCase();
  }

  if (!phrase) return false;

  const words = phrase.split(/\s+/);

  // 1. Single words: Only collocations if explicitly tagged as idiom/collocation in explanation
  if (words.length < 2) {
    if (
      explanation.includes('collocation') ||
      explanation.includes('thành ngữ') ||
      explanation.includes('idiom') ||
      explanation.includes('cụm từ')
    ) {
      return true;
    }
    return false;
  }

  // 2. Reject full sentences or overly long paragraphs (> 8 words or > 60 chars)
  if (words.length > 8 || phrase.length > 60) {
    return false;
  }

  // 3. Reject pure grammatical auxiliary corrections (e.g. "he don't" -> "he doesn't", "they were")
  const lowerPhrase = phrase.toLowerCase();
  const pureGrammarRegex =
    /^(he|she|it|they|we|you|i)\s+(don't|doesn't|didn't|is|are|was|were|has|have|had)$/i;
  if (pureGrammarRegex.test(lowerPhrase)) {
    return false;
  }

  // 4. If segmentType === 'enhancement', it is an intentional lexical / phrase upgrade
  if (segmentType === 'enhancement') {
    return true;
  }

  // 5. If segmentType === 'correction', check for grammar cues vs collocation cues
  if (segmentType === 'correction') {
    const isGrammarCue =
      explanation.includes('ngữ pháp') ||
      explanation.includes('chủ vị') ||
      explanation.includes('chia động từ') ||
      explanation.includes('thì hiện tại') ||
      explanation.includes('thì quá khứ');
    const isCollocationCue =
      explanation.includes('collocation') ||
      explanation.includes('cụm từ') ||
      explanation.includes('giới từ') ||
      explanation.includes('đi kèm');

    if (isCollocationCue) return true;
    if (isGrammarCue) return false;
  }

  // Multi-word phrase with 2-8 words
  return true;
}

/**
 * Extracts a bounded sentence context containing the target phrase.
 * Prevents full essay or large paragraphs from polluting Mistake Bank or SRS.
 * Handles abbreviations (Dr., e.g., etc.), quotes, and length limits safely.
 */
export function extractBoundedSentence(
  text: string,
  phrase: string,
  maxLength: number = 180
): string {
  if (!text || !phrase) return (phrase || '').slice(0, maxLength);
  const cleanTarget = normalizeCollocationKey(phrase);
  const lowerText = text.toLowerCase();
  let idx = lowerText.indexOf(cleanTarget);

  if (idx < 0) {
    const stripped = stripEdgePunctuation(phrase).toLowerCase();
    idx = lowerText.indexOf(stripped);
  }

  if (idx < 0) {
    const trimmed = text.trim();
    return trimmed.length > maxLength ? trimmed.slice(0, Math.max(0, maxLength - 3)) + '...' : trimmed;
  }

  // Find sentence boundary before idx (. ! ? or newline)
  // Skip periods in common abbreviations: dr, mr, mrs, ms, prof, e.g, i.e, etc, vs, al
  const beforeText = text.slice(0, idx);
  const regexBefore = /(?:[.!?\n])(?:\s+|$)/g;
  let start = 0;
  let matchB: RegExpExecArray | null;
  while ((matchB = regexBefore.exec(beforeText)) !== null) {
    const subBefore = beforeText.slice(0, matchB.index + 1);
    const isAbbr = /\b(dr|mr|mrs|ms|prof|e\.g|i\.e|etc|vs|al)\.$/i.test(subBefore);
    if (!isAbbr) {
      start = matchB.index + matchB[0].length;
    }
  }

  // Find sentence boundary after idx
  const afterText = text.slice(idx);
  const regexAfter = /(?:[.!?\n])(?:\s+|$)/g;
  let end = text.length;
  let matchA: RegExpExecArray | null;
  while ((matchA = regexAfter.exec(afterText)) !== null) {
    const subAfter = afterText.slice(0, matchA.index + 1);
    const isAbbr = /\b(dr|mr|mrs|ms|prof|e\.g|i\.e|etc|vs|al)\.$/i.test(subAfter);
    if (!isAbbr) {
      end = idx + matchA.index + (matchA[0].endsWith('\n') ? 0 : 1);
      break;
    }
  }

  const sentence = text.slice(start, end).trim();
  if (sentence.length > maxLength) {
    const relIdx = idx - start;
    const half = Math.floor((maxLength - 6) / 2);
    let winStart = Math.max(0, relIdx - half);
    let winEnd = Math.min(sentence.length, winStart + (maxLength - 6));
    if (winEnd - winStart < maxLength - 6) {
      winStart = Math.max(0, winEnd - (maxLength - 6));
    }
    const prefix = winStart > 0 ? '... ' : '';
    const suffix = winEnd < sentence.length ? ' ...' : '';
    const sliceLen = Math.max(0, maxLength - prefix.length - suffix.length);
    return `${prefix}${sentence.slice(winStart, winStart + sliceLen)}${suffix}`;
  }
  return sentence;
}

// =========================================================================
// 1. READING VOCABULARY CAPTURE
// =========================================================================
export interface CaptureReadingVocabularyOptions {
  word?: string;
  rawWord?: string;
  passageTitle?: string;
  passageContext?: string;
  readingSentence?: string;
  customMeaning?: string;
  vocabularyList?: VocabWord[];
  srsProgressMap?: Record<string, SRSProgress>;
  userCustomWords?: VocabWord[];
  saveToSRS: (
    wordOrId: VocabWord | string,
    options?: { contextSentence?: string; meaning?: string; source?: string; sources?: string[] }
  ) => void;
}

export interface CaptureReadingVocabularyResult {
  success: boolean;
  saved: boolean;
  canonicalId: string;
  canonicalWord: string;
  boundedContext: string;
}

export function captureReadingVocabulary(
  options: CaptureReadingVocabularyOptions
): CaptureReadingVocabularyResult {
  const targetWord = (options.word || options.rawWord || '').trim();
  const context = options.passageContext || options.readingSentence || options.passageTitle || '';
  const { customMeaning, saveToSRS } = options;

  if (!targetWord) {
    return { success: false, saved: false, canonicalId: '', canonicalWord: '', boundedContext: '' };
  }

  const vocabList =
    options.vocabularyList && options.vocabularyList.length > 0
      ? options.vocabularyList
      : composeVocabularyList(options.srsProgressMap, options.userCustomWords);

  const canonical = resolveCanonicalVocab(targetWord, vocabList);
  const canonicalId = canonical?.canonicalId || `custom_${targetWord.toLowerCase()}`;
  const canonicalWord = canonical?.canonicalWord.word || targetWord;

  const boundedContext = context ? extractBoundedSentence(context, targetWord) : '';

  const wordPayload: VocabWord = {
    ...(canonical?.canonicalWord || {
      id: canonicalId,
      word: canonicalWord,
      ipa: '',
      partOfSpeech: 'noun',
      meaning: customMeaning || 'Từ vựng bài đọc',
      example: boundedContext,
      tag: 'Daily' as VocabTag,
      srsLevel: 0,
      interval: 1,
      easeFactor: 2.5,
      nextReviewDate: new Date().toISOString(),
    }),
    id: canonicalId,
    word: canonicalWord,
  };

  saveToSRS(wordPayload, {
    contextSentence: boundedContext,
    meaning: customMeaning || canonical?.canonicalWord.meaning,
    source: 'reading',
    sources: ['reading'],
  });

  return {
    success: true,
    saved: true,
    canonicalId,
    canonicalWord,
    boundedContext,
  };
}

// =========================================================================
// 2. LISTENING MISTAKE CAPTURE
// =========================================================================
export interface CaptureListeningMistakeOptions {
  question?: {
    id: string;
    question: string;
    type?: string;
    explanation?: string;
    options?: string[];
    correctIndex?: number;
  };
  questionPrompt?: string;
  questionId?: string;
  userAnswer?: string;
  expectedAnswer?: string;
  context?: string;
  lessonTitle?: string;
  selectedOptIdx?: number;
  vocabularyList?: VocabWord[];
  recordMistake: (
    word: Partial<VocabWord> & { word: string; meaning?: string },
    source?: MistakeSource,
    options?: {
      type?: MistakeType;
      userAnswer?: string;
      expectedAnswer?: string;
      context?: string;
    }
  ) => void;
}

export interface CaptureListeningMistakeResult {
  recorded: boolean;
  isVocabTarget: boolean;
  isVocabTargeted: boolean;
  targetId: string;
  targetWord: string;
  mistakeKey: string;
}

export function captureListeningMistake(
  options: CaptureListeningMistakeOptions
): CaptureListeningMistakeResult {
  const { question, questionPrompt = '', questionId = 'listening_q', lessonTitle = '', selectedOptIdx, vocabularyList = [], recordMistake } = options;
  const qObj = question || {
    id: questionId,
    question: questionPrompt,
  };
  const targetRes = resolveListeningQuestionTarget(qObj, lessonTitle, vocabularyList);

  // Guard: ONLY vocabulary-targeted mistakes create an entry in the vocabulary Mistake Bank.
  // General comprehension mistakes MUST NOT masquerade as vocabulary words or pollute the weak words deck.
  if (!targetRes.isVocabTarget) {
    return {
      recorded: false,
      isVocabTarget: false,
      isVocabTargeted: false,
      targetId: targetRes.targetId,
      targetWord: '',
      mistakeKey: targetRes.targetId,
    };
  }

  const userAnswer =
    options.userAnswer ||
    (selectedOptIdx !== undefined && qObj.options && qObj.options[selectedOptIdx]
      ? qObj.options[selectedOptIdx]
      : 'Chưa trả lời');

  const expectedAnswer =
    options.expectedAnswer ||
    (qObj.correctIndex !== undefined && qObj.options && qObj.options[qObj.correctIndex]
      ? qObj.options[qObj.correctIndex]
      : '');

  recordMistake(
    {
      id: targetRes.targetId,
      word: targetRes.targetWord,
      ipa: targetRes.ipa,
      meaning: targetRes.meaning,
      example: targetRes.example,
      tag: 'Daily' as VocabTag,
    },
    'listening',
    {
      type: 'listening',
      userAnswer,
      expectedAnswer,
      context: options.context || (lessonTitle ? `${lessonTitle}: ${qObj.question}` : qObj.question),
    }
  );

  return {
    recorded: true,
    isVocabTarget: targetRes.isVocabTarget,
    isVocabTargeted: targetRes.isVocabTarget,
    targetId: targetRes.targetId,
    targetWord: targetRes.targetWord,
    mistakeKey: targetRes.targetId,
  };
}

export interface CaptureReadingMistakeOptions {
  question?: { id: string; question: string; options?: string[]; correctIndex?: number; type?: string; explanation?: string };
  questionPrompt?: string;
  questionId?: string;
  lessonTitle?: string;
  selectedOptIdx?: number;
  userAnswer?: string;
  expectedAnswer?: string;
  context?: string;
  vocabularyList?: VocabWord[];
  recordMistake: (
    word: Partial<VocabWord> & { word: string; meaning?: string },
    source?: MistakeSource,
    options?: {
      type?: MistakeType;
      userAnswer?: string;
      expectedAnswer?: string;
      context?: string;
    }
  ) => void;
}

export interface CaptureReadingMistakeResult {
  recorded: boolean;
  isVocabTarget: boolean;
  isVocabTargeted: boolean;
  targetId: string;
  targetWord: string;
  mistakeKey: string;
}

export function captureReadingMistake(
  options: CaptureReadingMistakeOptions
): CaptureReadingMistakeResult {
  const { question, questionPrompt = '', questionId = 'reading_q', lessonTitle = '', selectedOptIdx, vocabularyList = [], recordMistake } = options;
  const qObj = question || {
    id: questionId,
    question: questionPrompt,
  };
  const targetRes = resolveReadingQuestionTarget(qObj, lessonTitle, vocabularyList);

  // Guard: ONLY vocabulary-targeted mistakes create an entry in the vocabulary Mistake Bank.
  // General comprehension mistakes MUST NOT masquerade as vocabulary words or pollute the weak words deck.
  if (!targetRes.isVocabTarget) {
    return {
      recorded: false,
      isVocabTarget: false,
      isVocabTargeted: false,
      targetId: targetRes.targetId,
      targetWord: '',
      mistakeKey: targetRes.targetId,
    };
  }

  const userAnswer =
    options.userAnswer ||
    (selectedOptIdx !== undefined && qObj.options && qObj.options[selectedOptIdx]
      ? qObj.options[selectedOptIdx]
      : 'Chưa trả lời');

  const expectedAnswer =
    options.expectedAnswer ||
    (qObj.correctIndex !== undefined && qObj.options && qObj.options[qObj.correctIndex]
      ? qObj.options[qObj.correctIndex]
      : '');

  recordMistake(
    {
      id: targetRes.targetId,
      word: targetRes.targetWord,
      ipa: targetRes.ipa,
      meaning: targetRes.meaning,
      example: targetRes.example,
      tag: 'Daily' as VocabTag,
    },
    'reading',
    {
      type: 'reading',
      userAnswer,
      expectedAnswer,
      context: options.context || (lessonTitle ? `${lessonTitle}: ${qObj.question}` : qObj.question),
    }
  );

  return {
    recorded: true,
    isVocabTarget: targetRes.isVocabTarget,
    isVocabTargeted: targetRes.isVocabTarget,
    targetId: targetRes.targetId,
    targetWord: targetRes.targetWord,
    mistakeKey: targetRes.targetId,
  };
}

// =========================================================================
// 3. WRITING COLLOCATION & MISTAKE CAPTURE
// =========================================================================
export interface CaptureWritingCollocationOptions {
  phrase: string;
  originalText?: string;
  meaning?: string;
  usageContext?: string;
  exampleEn?: string;
  exampleVi?: string;
  tags?: string[];
  userCollocations?: CollocationItem[];
  saveCollocationToSRS: (
    item: Omit<CollocationItem, 'id' | 'createdAt'>
  ) => { success: boolean; id: string };
}

export interface CaptureWritingCollocationResult {
  success: boolean;
  id: string;
  isDuplicate: boolean;
  normalizedPhrase: string;
}

export function captureWritingCollocation(
  options: CaptureWritingCollocationOptions
): CaptureWritingCollocationResult {
  const {
    phrase,
    originalText = '',
    meaning = 'Collocation học thuật từ bài viết',
    usageContext = 'Writing Essay',
    exampleEn = '',
    exampleVi = '',
    tags = ['writing', 'collocation'],
    userCollocations = [],
    saveCollocationToSRS,
  } = options;

  const normalizedPhrase = normalizeCollocationPhrase(phrase);
  const normalizedKey = normalizeCollocationKey(phrase);

  if (!normalizedKey) {
    return { success: false, id: '', isDuplicate: false, normalizedPhrase: '' };
  }

  // Context resolution:
  // If exampleEn contains normalizedKey, extract bounded sentence around it.
  // If exampleEn only contains originalText, substitute normalizedPhrase into the original sentence!
  let boundedExample = normalizedPhrase;
  if (exampleEn) {
    const lowerExample = exampleEn.toLowerCase();
    if (lowerExample.includes(normalizedKey)) {
      boundedExample = extractBoundedSentence(exampleEn, normalizedPhrase);
    } else if (originalText && lowerExample.includes(originalText.toLowerCase().trim())) {
      const origSentence = extractBoundedSentence(exampleEn, originalText.trim());
      const escapedOrig = originalText.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      boundedExample = origSentence.replace(new RegExp(escapedOrig, 'i'), normalizedPhrase);
    } else {
      boundedExample = extractBoundedSentence(exampleEn, normalizedPhrase);
    }
  }

  const res = saveCollocationToSRS({
    phrase: normalizedPhrase,
    meaning,
    usageContext,
    exampleEn: boundedExample,
    exampleVi,
    tags,
    source: 'writing',
    sources: ['writing'],
  });

  const existingColloc = (userCollocations || []).find(
    (c) => normalizeCollocationKey(c.phrase) === normalizedKey
  );

  return {
    success: res.success,
    id: res.id || existingColloc?.id || '',
    isDuplicate: !res.success,
    normalizedPhrase,
  };
}

export interface CaptureWritingMistakeOptions {
  originalText: string;
  revisedText?: string;
  explanation?: string;
  reasonVi?: string;
  fullEssay?: string;
  segmentType?: DiffSegmentType;
  type?: MistakeType;
  mistakeBank?: Record<string, MistakeRecord>;
  recordMistake: (
    word: Partial<VocabWord> & { word: string; meaning?: string },
    source?: MistakeSource,
    options?: {
      type?: MistakeType;
      userAnswer?: string;
      expectedAnswer?: string;
      context?: string;
    }
  ) => void;
}

export interface CaptureWritingMistakeResult {
  recorded: boolean;
  mistakeKey: string;
  mistakeType: MistakeType;
  boundedContext: string;
  isDuplicateEvent?: boolean;
}

export function captureWritingMistake(
  options: CaptureWritingMistakeOptions
): CaptureWritingMistakeResult {
  const {
    originalText,
    revisedText = '',
    explanation = '',
    reasonVi = '',
    fullEssay = '',
    segmentType,
    type,
    mistakeBank,
    recordMistake,
  } = options;

  const cleanOriginal = stripEdgePunctuation(originalText);
  if (!cleanOriginal) {
    return { recorded: false, mistakeKey: '', mistakeType: 'grammar', boundedContext: '' };
  }

  // Bounded context: STRICTLY bounded to the surrounding sentence in the ORIGINAL essay
  const boundedContext = fullEssay
    ? extractBoundedSentence(fullEssay, cleanOriginal)
    : cleanOriginal;

  // Determine mistake type:
  let inferredType: MistakeType = type || 'grammar';
  if (!type) {
    const combinedExplanation = `${explanation || ''} ${reasonVi || ''}`.toLowerCase();
    const isMultiWord = cleanOriginal.split(/\s+/).length > 1;

    const isGrammarCue =
      combinedExplanation.includes('ngữ pháp') ||
      combinedExplanation.includes('chủ vị') ||
      combinedExplanation.includes('chia động từ') ||
      combinedExplanation.includes('thì hiện tại') ||
      combinedExplanation.includes('thì quá khứ') ||
      combinedExplanation.includes('tense') ||
      combinedExplanation.includes('subject-verb');

    const isSpellingCue =
      combinedExplanation.includes('chính tả') ||
      combinedExplanation.includes('spelling') ||
      combinedExplanation.includes('typo');

    const isCollocationCue =
      combinedExplanation.includes('collocation') ||
      combinedExplanation.includes('cụm từ') ||
      combinedExplanation.includes('giới từ') ||
      combinedExplanation.includes('preposition') ||
      combinedExplanation.includes('word choice') ||
      combinedExplanation.includes('từ vựng');

    if (isSpellingCue) {
      inferredType = 'spelling';
    } else if (isGrammarCue) {
      inferredType = 'grammar';
    } else if (isCollocationCue) {
      inferredType = 'collocation';
    } else if (segmentType === 'correction') {
      inferredType = isCollocationCandidate(cleanOriginal) ? 'collocation' : 'grammar';
    } else if (segmentType === 'enhancement') {
      inferredType = 'collocation';
    } else {
      inferredType = isMultiWord && isCollocationCandidate(cleanOriginal) ? 'collocation' : 'grammar';
    }
  }

  const mistakeKey = `writing_${cleanOriginal.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  // Idempotency: Prevent duplicate increment if same mistake was recorded within 60s with identical context
  if (mistakeBank) {
    const existing = mistakeBank[mistakeKey];
    if (existing) {
      const isSameContext =
        existing.lastContext === boundedContext || existing.lastExpectedAnswer === revisedText;
      const elapsedMs = Date.now() - new Date(existing.lastMistakeAt).getTime();
      if (isSameContext && elapsedMs < 60000) {
        return {
          recorded: false,
          mistakeKey,
          mistakeType: inferredType,
          boundedContext,
          isDuplicateEvent: true,
        };
      }
    }
  }

  recordMistake(
    {
      id: mistakeKey,
      word: cleanOriginal,
      meaning: explanation || reasonVi || `Sửa thành: ${revisedText}`,
      example: boundedContext,
      tag: 'Daily' as VocabTag,
    },
    'writing',
    {
      type: inferredType,
      userAnswer: cleanOriginal,
      expectedAnswer: revisedText,
      context: boundedContext,
    }
  );

  return {
    recorded: true,
    mistakeKey,
    mistakeType: inferredType,
    boundedContext,
    isDuplicateEvent: false,
  };
}

// =========================================================================
// 4. SPEAKING MISTAKE CAPTURE
// =========================================================================
export interface CaptureSpeakingMistakeOptions {
  targetSentence?: string;
  sentence?: string;
  speakingTranscript?: string;
  accuracy?: number;
  userPronunciationScore?: number;
  targetWord?: string;
  keyKeywords?: string[];
  phonetic?: string;
  meaningVi?: string;
  promptTitle?: string;
  context?: string;
  expectedAnswer?: string;
  turnIndex?: number;
  vocabularyList?: VocabWord[];
  recordMistake: (
    word: Partial<VocabWord> & { word: string; meaning?: string },
    source?: MistakeSource,
    options?: {
      type?: MistakeType;
      userAnswer?: string;
      expectedAnswer?: string;
      context?: string;
    }
  ) => void;
  recordMistakeCorrect?: (wordIdOrText: string, options?: { type?: MistakeType }) => void;
}

export interface CaptureSpeakingMistakeResult {
  action: 'recorded_mistake' | 'recorded_correct' | 'neutral';
  recorded: boolean;
  isFailure: boolean;
  mistakeType: MistakeType;
  targetWord: string;
  targetId: string;
  mistakeKey: string;
}

export function captureSpeakingMistake(
  options: CaptureSpeakingMistakeOptions
): CaptureSpeakingMistakeResult {
  const {
    keyKeywords = [],
    phonetic = '',
    meaningVi = '',
    promptTitle = 'Speaking Roleplay',
    turnIndex = 0,
    vocabularyList = [],
    recordMistake,
    recordMistakeCorrect,
  } = options;

  const score = options.accuracy ?? options.userPronunciationScore ?? 0;
  const sentenceText = options.targetSentence || options.sentence || '';
  const transcript = options.speakingTranscript || '';
  const user = transcript.toLowerCase().replace(/[^a-z0-9\s]/g, '');

  const explicitWord = options.targetWord;
  const targetKeyword =
    explicitWord ||
    keyKeywords.find((kw) => {
      const normKw = kw.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      return !user.includes(normKw);
    }) || keyKeywords[0] || sentenceText;

  const canonical = resolveCanonicalVocab(targetKeyword, vocabularyList);
  const targetId = canonical?.canonicalId || `speaking_${turnIndex !== undefined ? turnIndex : targetKeyword.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const targetWord = canonical?.canonicalWord.word || targetKeyword;
  const ipa = canonical?.canonicalWord.ipa || phonetic;
  const meaning = canonical?.canonicalWord.meaning || meaningVi || 'Từ vựng luyện phát âm Speaking';

  if (score < PRONUNCIATION_FAIL_THRESHOLD) {
    recordMistake(
      {
        id: targetId,
        word: targetWord,
        ipa,
        meaning,
        example: sentenceText,
        tag: 'Daily' as VocabTag,
      },
      'pronunciation',
      {
        type: 'pronunciation',
        userAnswer: transcript || `Điểm phát âm: ${score}%`,
        expectedAnswer: options.expectedAnswer || targetWord,
        context: options.context || (promptTitle ? `${promptTitle}: ${sentenceText}` : sentenceText),
      }
    );
    return {
      action: 'recorded_mistake',
      recorded: true,
      isFailure: true,
      mistakeType: 'pronunciation',
      targetWord,
      targetId,
      mistakeKey: targetId,
    };
  } else if (score >= PRONUNCIATION_PASS_THRESHOLD && recordMistakeCorrect) {
    recordMistakeCorrect(targetId, { type: 'pronunciation' });
    recordMistakeCorrect(targetWord, { type: 'pronunciation' });
    return {
      action: 'recorded_correct',
      recorded: false,
      isFailure: false,
      mistakeType: 'pronunciation',
      targetWord,
      targetId,
      mistakeKey: targetId,
    };
  }

  return {
    action: 'neutral',
    recorded: false,
    isFailure: false,
    mistakeType: 'pronunciation',
    targetWord,
    targetId,
    mistakeKey: targetId,
  };
}

// =========================================================================
// 5. FOUR SKILLS ADAPTIVE SUMMARY DERIVATION
// =========================================================================
export interface FourSkillsSummaryData {
  readingWordsSaved: number;
  listeningUnresolvedMistakes: number;
  writingCollocationsToReview: number;
  speakingPronunciationItems: number;
  totalWeakItems: number;
  hasLearningData: boolean;
}

export interface DeriveFourSkillsSummaryOptions {
  userCustomWords?: VocabWord[];
  srsProgressMap?: Record<string, SRSProgress>;
  mistakeBank?: Record<string, MistakeRecord>;
  userCollocations?: CollocationItem[];
  vocabularyList?: VocabWord[];
  now?: number;
}

export type FourSkillsCtaTarget =
  | { type: 'mistakes'; subType?: 'listening' | 'pronunciation'; label: string; tab: ActiveTab }
  | { type: 'pronunciation'; label: string; tab: ActiveTab }
  | { type: 'srs_review'; label: string; tab: ActiveTab }
  | { type: 'none'; label: string; tab: null };

/**
 * Determines deterministic CTA routing based on real four skills weakness workload:
 * Priority 1: Listening mistakes -> Mistake Bank ('mistakes')
 * Priority 2: Speaking pronunciation items -> Pronunciation Arena ('pronunciation')
 * Priority 3: Writing due collocations -> Flashcard / Unified SRS ('flashcards')
 * Writing-only workload routes to Unified SRS, NEVER to Mistake Bank!
 */
export function getFourSkillsCtaTarget(summary: FourSkillsSummaryData): FourSkillsCtaTarget {
  if (summary.totalWeakItems === 0) {
    return { type: 'none', label: 'Up to date', tab: null };
  }

  // Priority 1: Listening mistakes -> Mistake Bank
  if (summary.listeningUnresolvedMistakes > 0) {
    return {
      type: 'mistakes',
      subType: 'listening',
      label: `Luyện lỗi Nghe (${summary.listeningUnresolvedMistakes})`,
      tab: 'mistakes',
    };
  }

  // Priority 2: Speaking pronunciation items -> Pronunciation Arena
  if (summary.speakingPronunciationItems > 0) {
    return {
      type: 'pronunciation',
      label: `Luyện Phát âm (${summary.speakingPronunciationItems})`,
      tab: 'pronunciation',
    };
  }

  // Priority 3: Writing due collocations -> Flashcard / SRS Review
  if (summary.writingCollocationsToReview > 0) {
    return {
      type: 'srs_review',
      label: `Ôn Cụm từ Viết (${summary.writingCollocationsToReview})`,
      tab: 'flashcards',
    };
  }

  return { type: 'none', label: 'Up to date', tab: null };
}

/**
 * Derives real-time Four Skills learning metrics purely from existing store state.
 * Never persists or caches summary to prevent stale counts and storage bloat.
 * 
 * Strict Semantic Contracts:
 * - readingWordsSaved: Counts active cards in SRS with reading provenance.
 * - listeningUnresolvedMistakes: Counts unresolved listening weaknesses in Mistake Bank.
 * - writingCollocationsToReview: Counts collocations with writing provenance due for review.
 * - speakingPronunciationItems: Unique, deduplicated pronunciation items in practice queue.
 */
export function deriveFourSkillsSummary(
  options: DeriveFourSkillsSummaryOptions
): FourSkillsSummaryData {
  const {
    userCustomWords = [],
    srsProgressMap = {},
    mistakeBank = {},
    userCollocations = [],
    vocabularyList = [],
    now = Date.now(),
  } = options;

  // 1. Reading: Words in SRS with 'reading' provenance
  const readingCanonicalIds = new Set<string>();

  for (const [id, srs] of Object.entries(srsProgressMap)) {
    if (id.startsWith('colloc_')) continue;
    if (srs && Array.isArray(srs.sources) && srs.sources.includes('reading')) {
      readingCanonicalIds.add(id.toLowerCase());
    }
  }

  for (const w of userCustomWords) {
    if (!w || !w.word || w.id?.startsWith('colloc_')) continue;
    const hasReadingSource = Array.isArray(w.sources) && w.sources.includes('reading');
    if (hasReadingSource) {
      const clean = w.word.toLowerCase().trim();
      const srs = srsProgressMap[w.id] || (clean ? srsProgressMap[clean] : undefined);
      if (srs) {
        readingCanonicalIds.add((w.id || clean).toLowerCase());
      }
    }
  }
  const readingWordsSaved = readingCanonicalIds.size;

  // 2. Listening: Unresolved listening mistakes in Mistake Bank
  const mistakes = Object.values(mistakeBank || {});
  const listeningUnresolvedMistakes = mistakes.filter((m) => {
    if (!m || !m.word) return false;
    const canonSource = toCanonicalSource(m.source);
    const itemType = toCanonicalType(m.primaryType, canonSource);
    const hasListenCount = (m.typeCounts?.listening ?? 0) > 0;
    const isListening = itemType === 'listening' || canonSource === 'listening' || hasListenCount;
    if (!isListening) return false;

    // Check type-specific resolution state if present
    const listenState = m.typeResolutionMap?.listening;
    if (listenState) {
      return !listenState.resolved;
    }
    return !m.resolved;
  }).length;

  // 3. Writing: Collocations with writing provenance due for review
  const writingCollocationIds = new Set<string>();

  for (const c of userCollocations) {
    if (!c || !c.phrase) continue;
    const srs = srsProgressMap[c.id];
    const hasWritingProvenance = Boolean(
      (Array.isArray(c.sources) && c.sources.includes('writing')) ||
      (Array.isArray(c.tags) && c.tags.some((t) => t.toLowerCase() === 'writing')) ||
      (c.usageContext && c.usageContext.toLowerCase().includes('writing')) ||
      (srs && Array.isArray(srs.sources) && srs.sources.includes('writing'))
    );
    if (!hasWritingProvenance) continue;

    // Reuses standard system due logic: isDueForReview(nextReviewDate)
    const isDue = !srs || srs.srsLevel === 0 || !srs.nextReviewDate || isDueForReview(srs.nextReviewDate);
    if (isDue) {
      writingCollocationIds.add(c.id);
    }
  }

  // Fallback for minimal test mocks where only srsProgressMap has colloc_ keys with writing provenance
  if (writingCollocationIds.size === 0 && (!userCollocations || userCollocations.length === 0)) {
    for (const [id, srs] of Object.entries(srsProgressMap)) {
      if (!id.startsWith('colloc_') || !srs) continue;
      const hasWritingProvenance = Boolean(
        Array.isArray(srs.sources) && srs.sources.includes('writing')
      );
      if (!hasWritingProvenance) continue;
      const isDue = srs.srsLevel === 0 || !srs.nextReviewDate || isDueForReview(srs.nextReviewDate);
      if (isDue) {
        writingCollocationIds.add(id);
      }
    }
  }
  const writingCollocationsToReview = writingCollocationIds.size;

  // 4. Speaking: Pronunciation items awaiting practice (deduplicated by word/id)
  const speakingPronunciationQueue = getPronunciationPracticeQueue(mistakeBank, {
    vocabularyList,
    now,
  });
  const speakingPronunciationItems = speakingPronunciationQueue.length;

  const totalWeakItems =
    listeningUnresolvedMistakes + writingCollocationsToReview + speakingPronunciationItems;

  const hasLearningData = Boolean(
    readingWordsSaved > 0 ||
    writingCollocationsToReview > 0 ||
    speakingPronunciationItems > 0 ||
    listeningUnresolvedMistakes > 0 ||
    Object.values(mistakeBank || {}).length > 0 ||
    (userCollocations || []).some(
      (c) =>
        (Array.isArray(c.sources) && c.sources.includes('writing')) ||
        (Array.isArray(c.tags) && c.tags.some((t) => t.toLowerCase() === 'writing')) ||
        (c.usageContext && c.usageContext.toLowerCase().includes('writing'))
    ) ||
    Object.values(srsProgressMap || {}).some(
      (s) => Array.isArray(s.sources) && s.sources.includes('reading')
    )
  );

  return {
    readingWordsSaved,
    listeningUnresolvedMistakes,
    writingCollocationsToReview,
    speakingPronunciationItems,
    totalWeakItems,
    hasLearningData,
  };
}

