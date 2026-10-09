/**
 * Text Quiz Generator Service (Phase 3)
 * 
 * Generates interactive personalized quizzes directly from the Translator's source text,
 * validated linguistic analysis result, and current learner memory state.
 * 
 * Invariants:
 * 1. Zero Hallucination: Questions are generated strictly from items with real evidence in the text.
 * 2. Bounded Count: Never invents fake questions to satisfy a quota (if 4 valid items exist, generates <= 4 questions).
 * 3. Learning Priority: Unknown > Learning > Mistakes > B2+ > Phrasal Verbs > Idioms > IT/Academic.
 * 4. Plausible Distractors: Same part of speech (POS) where possible, unique options, single correct answer.
 * 5. Isolation: Does not modify FSRS/SM-2 intervals directly.
 */

import type {
  CEFRLevel,
  VocabWord,
  SRSProgress,
  MistakeRecord,
  WordLearningStatsMap,
  WordLearnerSemantic,
  TextQuizQuestion,
  TextQuizQuestionType,
  TextQuizOption,
  TextQuizSession,
} from '../types';
import type {
  TextAnalysisResult,
  AnalyzedSpan,
  TextToken,
} from './textAnalysisService';
import { getDictionaryWord, getFullDictionaryBank } from './dictionaryIndex';
import { deriveLearnerSemantic } from './learningDictionaryService';
import { cleanWordToken } from './wordLookupService';
import { cleanMeaningForScramble, cleanWordString, maskTargetWordInSentence } from './textSanitizer';
import { getDistractorMeanings } from './quizDistractorEngine';

export interface QuizGenerationContext {
  srsProgressMap?: Record<string, SRSProgress>;
  mistakeBank?: Record<string, MistakeRecord>;
  wordLearningStats?: WordLearningStatsMap;
  vocabularyList?: VocabWord[];
}

export interface QuizGenerationOptions {
  maxQuestions?: number;
  preferredTypes?: TextQuizQuestionType[];
}

interface InternalCandidate {
  id: string;
  targetItem: string;
  canonicalLemma: string;
  category: string;
  cefr?: CEFRLevel;
  partOfSpeech?: string;
  meaning?: string;
  patternType?: string;
  contextSentence: string;
  semantic: WordLearnerSemantic;
  hasOpenMistake: boolean;
  priorityScore: number;
}

/**
 * Extracts the single clean sentence enclosing a specific text span range.
 */
export function extractSentenceForRange(sourceText: string, start: number, end: number): string {
  if (!sourceText || start < 0 || end > sourceText.length) {
    return sourceText ? sourceText.slice(0, 150).trim() : '';
  }

  // Find sentence start (previous '.', '!', '?', or '\n')
  let sStart = start;
  while (sStart > 0 && !/[.!?\n]/.test(sourceText[sStart - 1])) {
    sStart--;
  }

  // Find sentence end (next '.', '!', '?', or '\n')
  let sEnd = end;
  while (sEnd < sourceText.length && !/[.!?\n]/.test(sourceText[sEnd])) {
    sEnd++;
  }
  if (sEnd < sourceText.length && /[.!?]/.test(sourceText[sEnd])) {
    sEnd++; // include terminal punctuation
  }

  const sentence = sourceText.slice(sStart, sEnd).replace(/\s+/g, ' ').trim();
  return sentence.length > 5 ? sentence : sourceText.trim();
}

/**
 * Shuffles an array immutably.
 */
function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Common grammar pattern labels and explanations.
 */
const GRAMMAR_PATTERN_LABELS: Record<string, { label: string; explanation: string }> = {
  passive_voice: {
    label: 'Thể bị động (Passive Voice)',
    explanation: 'Cấu trúc [be + V3/ed] dùng để nhấn mạnh hành động hoặc đối tượng chịu tác động thay vì chủ thể thực hiện.',
  },
  conditional: {
    label: 'Câu điều kiện (Conditional Sentence)',
    explanation: 'Cấu trúc mệnh đề điều kiện diễn đạt giả định, kết quả xảy ra trong tương lai hoặc trái với thực tế.',
  },
  relative_clause: {
    label: 'Mệnh đề quan hệ (Relative Clause)',
    explanation: 'Mệnh đề phụ bắt đầu bằng đại từ quan hệ (who, which, that) dùng để bổ nghĩa cho danh từ đứng trước.',
  },
  perfect_aspect: {
    label: 'Thì hoàn thành (Perfect Aspect)',
    explanation: 'Cấu trúc [have/has/had + V3/ed] diễn tả hành động đã hoàn tất hoặc có liên hệ tới một thời điểm mốc.',
  },
  gerund_infinitive: {
    label: 'Danh động từ / Động từ nguyên mẫu (Gerund / Infinitive)',
    explanation: 'Cấu trúc dùng V-ing hoặc to-V làm tân ngữ hoặc bổ ngữ chỉ mục đích và thói quen.',
  },
};

const COMMON_PHRASAL_VERB_DISTRACTORS = [
  'carry out', 'bring about', 'take over', 'break down', 'call off',
  'give up', 'set up', 'look into', 'put forward', 'come across',
  'point out', 'turn down', 'hold on', 'figure out', 'stand out'
];

/**
 * Generates plausible distractors for Cloze / Word Fill-in matching Part of Speech.
 */
function generateClozeDistractors(
  targetLemma: string,
  targetPos: string | undefined,
  dictionaryBank: VocabWord[],
  count: number = 3
): string[] {
  const cleanTarget = cleanWordToken(targetLemma).toLowerCase();
  const distractors = new Set<string>();

  // 1. Try matching same POS from dictionary bank
  if (targetPos) {
    const posFiltered = dictionaryBank.filter(
      (w) =>
        w.word &&
        cleanWordToken(w.word).toLowerCase() !== cleanTarget &&
        (w.pos?.toLowerCase() === targetPos.toLowerCase() ||
         w.partOfSpeech?.toLowerCase() === targetPos.toLowerCase())
    );

    const shuffled = shuffleArray(posFiltered);
    for (const item of shuffled) {
      const clean = cleanWordToken(item.word).toLowerCase();
      if (clean && clean !== cleanTarget && !distractors.has(clean) && Math.abs(clean.length - cleanTarget.length) <= 5) {
        distractors.add(clean);
        if (distractors.size >= count) break;
      }
    }
  }

  // 2. Fallback to similar-length words from dictionary if not enough
  if (distractors.size < count) {
    const shuffledBank = shuffleArray(dictionaryBank);
    for (const item of shuffledBank) {
      if (!item.word) continue;
      const clean = cleanWordToken(item.word).toLowerCase();
      if (clean && clean !== cleanTarget && clean.length >= 3 && !distractors.has(clean)) {
        distractors.add(clean);
        if (distractors.size >= count) break;
      }
    }
  }

  return Array.from(distractors).slice(0, count);
}

/**
 * Extracts and prioritizes valid quiz candidate items from analysis.
 */
export function extractAndPrioritizeCandidates(
  sourceText: string,
  analysis: TextAnalysisResult,
  context: QuizGenerationContext
): InternalCandidate[] {
  if (!sourceText || !analysis) return [];

  const candidates: InternalCandidate[] = [];
  const seenCanonicalKeys = new Set<string>();

  const srsMap = context.srsProgressMap || {};
  const mistakeBank = context.mistakeBank || {};

  // Helper to check mistake presence
  const checkMistake = (word: string): boolean => {
    const clean = word.toLowerCase().trim();
    const entry = mistakeBank[clean] || mistakeBank[`vocab_${clean}`];
    return Boolean(entry && !entry.resolved);
  };

  // Helper to calculate priority score
  const calcPriority = (params: {
    semantic: WordLearnerSemantic;
    hasOpenMistake: boolean;
    category: string;
    cefr?: CEFRLevel;
  }): number => {
    let score = 0;
    if (params.hasOpenMistake) score += 50;
    if (params.semantic === 'unknown') score += 35;
    else if (params.semantic === 'learning') score += 25;
    else score += 5; // known

    if (params.category === 'phrasal_verb') score += 25;
    else if (params.category === 'idiom') score += 25;
    else if (params.category === 'it_term') score += 20;
    else if (params.category === 'academic') score += 18;
    else if (params.category === 'grammar_pattern') score += 15;
    else if (params.category === 'collocation') score += 15;

    if (params.cefr === 'C2') score += 20;
    else if (params.cefr === 'C1') score += 15;
    else if (params.cefr === 'B2') score += 12;
    else if (params.cefr === 'B1') score += 8;

    return score;
  };

  // 1. Process Multi-word Spans (Phrasal verbs, Idioms, IT terms, Academic, Grammar)
  const spansToProcess = analysis.spans.length > 0 ? analysis.spans : analysis.allCandidates;
  for (const span of spansToProcess) {
    const cleanCanonical = cleanWordString(span.canonical || span.surface).toLowerCase();
    if (!cleanCanonical || seenCanonicalKeys.has(cleanCanonical)) continue;
    seenCanonicalKeys.add(cleanCanonical);

    const hasCard = Boolean(srsMap[cleanCanonical] || (span.canonicalId && srsMap[span.canonicalId]));
    const semantic: WordLearnerSemantic = hasCard ? 'learning' : 'unknown';
    const hasOpenMistake = checkMistake(cleanCanonical) || checkMistake(span.surface);
    const contextSentence = extractSentenceForRange(sourceText, span.start, span.end);

    const score = calcPriority({
      semantic,
      hasOpenMistake,
      category: span.category,
      cefr: span.cefr,
    });

    candidates.push({
      id: span.id || `cand_${candidates.length}`,
      targetItem: span.surface,
      canonicalLemma: span.canonical,
      category: span.category,
      cefr: span.cefr,
      meaning: span.meaning,
      patternType: span.patternType,
      contextSentence,
      semantic,
      hasOpenMistake,
      priorityScore: score,
    });
  }

  // 2. Process Individual Meaningful Tokens (Nouns, Verbs, Adjectives, B2+, AWL, IT)
  for (const token of analysis.tokens) {
    if (token.isStopWord || token.clean.length < 3) continue;

    const cleanCanonical = cleanWordString(token.lemma || token.clean).toLowerCase();
    if (!cleanCanonical || seenCanonicalKeys.has(cleanCanonical)) continue;

    // Check if token has valid dictionary definition
    const dictWord = getDictionaryWord(cleanCanonical) || getDictionaryWord(token.clean);
    if (!dictWord && !token.cefr && !token.isAcademic && !token.isIT) {
      continue; // Skip noise tokens with zero linguistic metadata
    }

    seenCanonicalKeys.add(cleanCanonical);

    const hasCard = Boolean(srsMap[cleanCanonical] || (token.canonicalId && srsMap[token.canonicalId]));
    const srsEntry = srsMap[cleanCanonical] || (token.canonicalId ? srsMap[token.canonicalId] : undefined);
    const semantic: WordLearnerSemantic = deriveLearnerSemantic({
      learningStatus: srsEntry ? (srsEntry.srsLevel >= 5 ? 'mastered' : 'learning') : 'new',
      isInUserDeck: hasCard,
    });

    const hasOpenMistake = checkMistake(cleanCanonical) || checkMistake(token.clean);
    const contextSentence = extractSentenceForRange(sourceText, token.start, token.end);

    let cat = 'word';
    if (token.isIT) cat = 'it_term';
    else if (token.isAcademic) cat = 'academic';

    const score = calcPriority({
      semantic,
      hasOpenMistake,
      category: cat,
      cefr: token.cefr || dictWord?.level as CEFRLevel,
    });

    candidates.push({
      id: `token_${token.index}_${cleanCanonical}`,
      targetItem: token.raw,
      canonicalLemma: token.lemma || token.clean,
      category: cat,
      cefr: token.cefr || dictWord?.level as CEFRLevel,
      partOfSpeech: token.partOfSpeech || dictWord?.pos || dictWord?.partOfSpeech,
      meaning: dictWord?.meaning,
      contextSentence,
      semantic,
      hasOpenMistake,
      priorityScore: score,
    });
  }

  // Sort descending by priority score
  candidates.sort((a, b) => b.priorityScore - a.priorityScore);
  return candidates;
}

/**
 * Builds a single well-structured TextQuizQuestion from an InternalCandidate.
 */
function buildQuestionFromCandidate(
  candidate: InternalCandidate,
  dictionaryBank: VocabWord[],
  allCandidates: InternalCandidate[]
): TextQuizQuestion | null {
  const { targetItem, canonicalLemma, category, contextSentence, cefr, semantic, priorityScore } = candidate;

  // Question Type 1: GRAMMAR PATTERN
  if (category === 'grammar_pattern' && candidate.patternType) {
    const patternInfo = GRAMMAR_PATTERN_LABELS[candidate.patternType] || {
      label: candidate.meaning || 'Mẫu ngữ pháp nâng cao',
      explanation: 'Cấu trúc ngữ pháp được dùng để làm rõ liên kết ý trong câu.',
    };

    const correctText = patternInfo.label;
    const allLabels = Object.values(GRAMMAR_PATTERN_LABELS).map((p) => p.label);
    const distractorLabels = allLabels.filter((l) => l !== correctText);
    const chosenDistractors = shuffleArray(distractorLabels).slice(0, 3);

    const options: TextQuizOption[] = shuffleArray([
      { id: 'opt_correct', text: correctText, isCorrect: true },
      ...chosenDistractors.map((d, i) => ({ id: `opt_dist_${i}`, text: d, isCorrect: false })),
    ]);

    return {
      id: `quiz_q_${candidate.id}`,
      type: 'grammar_pattern',
      prompt: `Xác định cấu trúc ngữ pháp nổi bật được sử dụng trong câu trên:`,
      contextSentence: `"${contextSentence}"`,
      targetItem,
      canonicalLemma,
      category: 'grammar_pattern',
      options,
      correctAnswerId: options.find((o) => o.isCorrect)!.id,
      explanation: `${patternInfo.explanation} Cụm diễn đạt: "${targetItem}".`,
      cefr,
      semantic,
      priorityScore,
    };
  }

  // Question Type 2: PHRASAL VERB or IDIOM
  if (category === 'phrasal_verb' || category === 'idiom') {
    const isPhrasal = category === 'phrasal_verb';
    const type: TextQuizQuestionType = isPhrasal ? 'phrasal_verb' : 'idiom';

    // 50% Cloze fill-in / 50% Meaning
    const makeCloze = Boolean(contextSentence && contextSentence.toLowerCase().includes(targetItem.toLowerCase()));

    if (makeCloze) {
      const masked = maskTargetWordInSentence(contextSentence, targetItem);
      // Generate distractors
      const candidateDistractors = allCandidates
        .filter((c) => c.category === category && c.canonicalLemma.toLowerCase() !== canonicalLemma.toLowerCase())
        .map((c) => c.targetItem);

      const fallbackPool = isPhrasal ? COMMON_PHRASAL_VERB_DISTRACTORS : ['at first glance', 'on the other hand', 'in terms of', 'by and large'];
      const rawDistractors = Array.from(new Set([...candidateDistractors, ...fallbackPool]))
        .filter((d) => d.toLowerCase() !== targetItem.toLowerCase() && d.toLowerCase() !== canonicalLemma.toLowerCase());

      const chosenDistractors = shuffleArray(rawDistractors).slice(0, 3);
      if (chosenDistractors.length < 3) {
        chosenDistractors.push('stand by', 'set out', 'take up');
      }

      const options: TextQuizOption[] = shuffleArray([
        { id: 'opt_correct', text: targetItem, isCorrect: true },
        ...chosenDistractors.slice(0, 3).map((d, i) => ({ id: `opt_dist_${i}`, text: d, isCorrect: false })),
      ]);

      return {
        id: `quiz_q_${candidate.id}`,
        type,
        prompt: `Chọn ${isPhrasal ? 'cụm động từ' : 'thành ngữ'} chính xác để hoàn thành câu:`,
        contextSentence: `"${masked.maskedSentence}"`,
        targetItem,
        canonicalLemma,
        category,
        options,
        correctAnswerId: options.find((o) => o.isCorrect)!.id,
        explanation: `Đáp án đúng là "${targetItem}" (${candidate.meaning || 'cụm từ chuẩn xác trong ngữ cảnh'}).`,
        cefr,
        semantic,
        priorityScore,
      };
    }
  }

  // Question Type 3: IT TERM or COLLOCATION
  if (category === 'it_term' || category === 'collocation') {
    const masked = maskTargetWordInSentence(contextSentence, targetItem);
    const dictWord = getDictionaryWord(canonicalLemma);

    // If multi-word, cloze or meaning
    const isMultiWord = targetItem.trim().includes(' ');
    if (isMultiWord && masked.maskedSentence.includes('[ ________ ]')) {
      const otherIT = allCandidates
        .filter((c) => (c.category === 'it_term' || c.category === 'collocation') && c.targetItem.toLowerCase() !== targetItem.toLowerCase())
        .map((c) => c.targetItem);

      const itPool = ['data pipeline', 'load balancer', 'system architecture', 'cloud infrastructure', 'event stream'];
      const combined = Array.from(new Set([...otherIT, ...itPool])).filter(
        (x) => x.toLowerCase() !== targetItem.toLowerCase()
      );
      const chosen = shuffleArray(combined).slice(0, 3);

      const options: TextQuizOption[] = shuffleArray([
        { id: 'opt_correct', text: targetItem, isCorrect: true },
        ...chosen.map((d, i) => ({ id: `opt_dist_${i}`, text: d, isCorrect: false })),
      ]);

      return {
        id: `quiz_q_${candidate.id}`,
        type: 'collocation',
        prompt: `Chọn thuật ngữ / cụm từ phù hợp nhất để hoàn chỉnh câu kỹ thuật:`,
        contextSentence: `"${masked.maskedSentence}"`,
        targetItem,
        canonicalLemma,
        category,
        options,
        correctAnswerId: options.find((o) => o.isCorrect)!.id,
        explanation: `Thuật ngữ "${targetItem}" mang nghĩa: ${candidate.meaning || dictWord?.meaning || 'khái niệm chuyên ngành phù hợp với ngữ cảnh'}.`,
        cefr,
        semantic,
        priorityScore,
      };
    }
  }

  // Question Type 4: CONTEXT VOCABULARY (CLOZE or MEANING MCQ)
  const dictWord = getDictionaryWord(canonicalLemma) || getDictionaryWord(targetItem);
  const meaning = candidate.meaning || dictWord?.meaning;

  // Decide between Cloze and Meaning MCQ based on sentence context
  const canCloze = Boolean(contextSentence && contextSentence.toLowerCase().includes(targetItem.toLowerCase()));

  if (canCloze) {
    const masked = maskTargetWordInSentence(contextSentence, targetItem);
    const distractors = generateClozeDistractors(
      targetItem,
      candidate.partOfSpeech,
      dictionaryBank,
      3
    );

    if (distractors.length >= 2) {
      const options: TextQuizOption[] = shuffleArray([
        { id: 'opt_correct', text: targetItem, isCorrect: true },
        ...distractors.map((d, i) => ({ id: `opt_dist_${i}`, text: d, isCorrect: false })),
      ]);

      return {
        id: `quiz_q_${candidate.id}`,
        type: 'cloze',
        prompt: `Chọn từ vựng chính xác để điền vào chỗ trống trong ngữ cảnh:`,
        contextSentence: `"${masked.maskedSentence}"`,
        targetItem,
        canonicalLemma,
        category: candidate.category || 'word',
        options,
        correctAnswerId: options.find((o) => o.isCorrect)!.id,
        explanation: `"${targetItem}" (gốc: ${canonicalLemma}): ${meaning ? cleanMeaningForScramble(meaning, targetItem) : 'Từ vựng phù hợp nhất với cú pháp và ngữ cảnh câu.'}`,
        cefr,
        semantic,
        priorityScore,
      };
    }
  }

  // Fallback: Meaning MCQ
  if (meaning) {
    const cleanCorrectMeaning = cleanMeaningForScramble(meaning, targetItem);
    const mockWord: VocabWord = {
      id: candidate.id,
      word: targetItem,
      meaning: cleanCorrectMeaning,
      ipa: '',
      example: contextSentence,
      tag: 'Academic',
      partOfSpeech: candidate.partOfSpeech || 'noun',
      srsLevel: 0,
      nextReviewDate: '',
      interval: 0,
      easeFactor: 2.5,
    };

    const distractorMeanings = getDistractorMeanings(mockWord, dictionaryBank.slice(0, 100), dictionaryBank, 3);
    if (distractorMeanings.length >= 2) {
      const options: TextQuizOption[] = shuffleArray([
        { id: 'opt_correct', text: cleanCorrectMeaning, isCorrect: true },
        ...distractorMeanings.map((m, i) => ({ id: `opt_dist_${i}`, text: m, isCorrect: false })),
      ]);

      return {
        id: `quiz_q_${candidate.id}`,
        type: 'meaning',
        prompt: `Nghĩa chính xác của từ "${targetItem}" trong câu trên là gì?`,
        contextSentence: `"${contextSentence}"`,
        targetItem,
        canonicalLemma,
        category: candidate.category || 'word',
        options,
        correctAnswerId: options.find((o) => o.isCorrect)!.id,
        explanation: `"${targetItem}" nghĩa là: ${cleanCorrectMeaning}.`,
        cefr,
        semantic,
        priorityScore,
      };
    }
  }

  return null;
}

/**
 * Main Entry Point: Creates a complete personalized TextQuizSession.
 * 
 * Strict Invariants:
 * 1. Zero fabrication: If text only has 4 items with evidence, at most 4 questions returned.
 * 2. Unambiguous: Exactly 1 correct option per question.
 * 3. Does NOT alter FSRS intervals.
 */
export function createQuizFromText(
  sourceText: string,
  analysis: TextAnalysisResult,
  context: QuizGenerationContext = {},
  options: QuizGenerationOptions = {}
): TextQuizSession {
  const sessionId = `text_quiz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = new Date().toISOString();

  if (!sourceText || !sourceText.trim() || !analysis) {
    return {
      id: sessionId,
      sourceText: sourceText || '',
      questions: [],
      totalQuestions: 0,
      availableItemCount: 0,
      createdAt: nowIso,
    };
  }

  const dictionaryBank = getFullDictionaryBank();
  const candidates = extractAndPrioritizeCandidates(sourceText, analysis, context);

  const maxQuota = Math.max(1, options.maxQuestions ?? 5);
  const questions: TextQuizQuestion[] = [];
  const seenTargets = new Set<string>();

  for (const candidate of candidates) {
    if (questions.length >= maxQuota) break;

    const key = candidate.canonicalLemma.toLowerCase().trim();
    if (seenTargets.has(key)) continue;

    const question = buildQuestionFromCandidate(candidate, dictionaryBank, candidates);
    if (question && question.options.length >= 3) {
      seenTargets.add(key);
      questions.push(question);
    }
  }

  return {
    id: sessionId,
    sourceText,
    questions,
    totalQuestions: questions.length,
    availableItemCount: candidates.length,
    createdAt: nowIso,
  };
}
