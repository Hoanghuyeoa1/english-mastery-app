// src/services/readingCheckpointService.ts
/**
 * CEFR Reading Certification Assessment Service (Phase 6)
 *
 * Dedicated Reading Assessment Engine for CEFR Level Checkpoints.
 *
 * Invariants:
 * 1. Evidence Truthfulness:
 *    Reading score must come exclusively from:
 *    real reading passage -> comprehension questions -> submitted answers -> deterministic grading.
 *    NEVER from readingEncounters, lesson completion, exposure count, or fake fallback scores.
 *    `readingEncounters` is strictly exposure/readiness evidence, NEVER certification evidence.
 * 2. Certification Mode Restrictions:
 *    - Dictionary lookup disabled (allowDictionaryLookup: false).
 *    - Key vocabulary hints disabled (allowHints: false).
 *    - Answer reveals disabled (allowAnswerReveal: false).
 *    - Question explanations disabled in-session.
 *    - In-session question retries disabled (allowInSessionRetry: false).
 *    - First valid submission wins (requireFirstSubmission: true).
 * 3. Failure Handling & Integrity:
 *    - Missing or empty passage -> insufficient_evidence (reason: 'missing_passage').
 *    - Empty questions or no valid questions -> insufficient_evidence (reason: 'empty_questions' | 'invalid_questions').
 *    - No answers submitted -> insufficient_evidence (reason: 'no_answers_submitted').
 *    - Duplicate submission -> idempotent (first valid submission wins).
 * 4. Mistake Bank Deduplication:
 *    - Vocabulary-targeted mistakes recorded into Mistake Bank deduplicated per attempt per question.
 *    - Reuses existing mistake pipeline; zero separate certification mistake store.
 */

import type { CefrLevel } from '../types/levelCertification';
import { CENTRAL_CERTIFICATION_POLICY, CentralCertificationPolicyConfig } from './levelCertificationService';
import type { ReadingLesson } from '../data/fourSkillsData';
import type { AssessmentModePolicy } from '../types/checkpointAssessment';
import type { VocabWord, MistakeSource, MistakeType } from '../types';
import { captureReadingMistake } from './fourSkillsLearningBridge';

export type ReadingQuestion = ReadingLesson['questions'][number];

// =========================================================================
// 1. TYPES & DATA CONTRACTS
// =========================================================================

export type ReadingAssessmentStatus =
  | 'evaluated'
  | 'insufficient_evidence';

export interface ReadingQuestionEvaluation {
  questionId: string;
  questionText: string;
  selectedOptionIndex?: number;
  correctIndex: number;
  isCorrect: boolean;
  type?: string;
  explanation: string;
}

export interface ReadingSectionEvaluationResult {
  attemptId: string;
  level: CefrLevel;
  status: ReadingAssessmentStatus;
  score: number | null; // null if insufficient_evidence
  passedFloor: boolean;
  requiredFloor: number;
  correctCount: number;
  totalQuestions: number;
  answeredCount: number;
  hasSufficientEvidence: boolean;
  questionEvaluations: ReadingQuestionEvaluation[];
  reason?: string;
  evaluatedAt: number;
}

export interface GradeReadingSectionParams {
  attemptId: string;
  level: CefrLevel;
  lesson?: ReadingLesson | null;
  questions?: ReadingQuestion[] | null;
  userAnswers: Record<string, number>;
  policy?: AssessmentModePolicy;
  policyConfig?: CentralCertificationPolicyConfig;
  readingEncounters?: number; // Permitted as metadata/readiness, but strictly ignored during scoring
  nowMs?: number;
}

// =========================================================================
// 2. IDEMPOTENT SUBMISSION REGISTRY (FIRST SUBMISSION WINS)
// =========================================================================

const finalizedReadingAttempts = new Map<string, ReadingSectionEvaluationResult>();
const processedReadingMistakeKeys = new Set<string>();

/**
 * Checks whether the reading section for this attempt has already been submitted.
 */
export function isReadingAttemptSubmitted(attemptId: string): boolean {
  if (!attemptId) return false;
  return finalizedReadingAttempts.has(attemptId);
}

/**
 * Retrieves the cached evaluation result for a previously submitted attempt.
 */
export function getReadingAttemptResult(attemptId: string): ReadingSectionEvaluationResult | null {
  if (!attemptId) return null;
  return finalizedReadingAttempts.get(attemptId) || null;
}

/**
 * Resets the in-memory submission registry (for tests and session resets).
 */
export function resetReadingAssessments(): void {
  finalizedReadingAttempts.clear();
  processedReadingMistakeKeys.clear();
}

// =========================================================================
// 3. DETERMINISTIC GRADING ENGINE & VALIDATION
// =========================================================================

/**
 * Grades a Checkpoint Reading Section deterministically with strict integrity checks.
 *
 * Invariants:
 * - Missing passage -> insufficient_evidence
 * - Malformed / empty questions -> insufficient_evidence
 * - No user answers submitted -> insufficient_evidence
 * - readingEncounters is strictly ignored (cannot be used to pass checkpoint)
 * - Pure calculation: 100% deterministic (correct / total * 100)
 */
export function gradeReadingCheckpointSection(
  params: GradeReadingSectionParams
): ReadingSectionEvaluationResult {
  const {
    attemptId,
    level,
    lesson,
    questions,
    userAnswers = {},
    policyConfig = CENTRAL_CERTIFICATION_POLICY,
    nowMs = Date.now(),
  } = params;

  const levelPolicy = policyConfig.levels[level] || policyConfig.levels.A1;
  const requiredFloor = levelPolicy.perSkillFloorThreshold;

  // 1. Passage Content Integrity Check
  const contentArray = lesson?.content;
  const hasValidPassage =
    Boolean(lesson) &&
    Array.isArray(contentArray) &&
    contentArray.length > 0 &&
    contentArray.join(' ').trim().length >= 10;

  if (!hasValidPassage) {
    return {
      attemptId,
      level,
      status: 'insufficient_evidence',
      score: null,
      passedFloor: false,
      requiredFloor,
      correctCount: 0,
      totalQuestions: 0,
      answeredCount: 0,
      hasSufficientEvidence: false,
      questionEvaluations: [],
      reason: 'missing_passage',
      evaluatedAt: nowMs,
    };
  }

  // 2. Questions Integrity Check
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return {
      attemptId,
      level,
      status: 'insufficient_evidence',
      score: null,
      passedFloor: false,
      requiredFloor,
      correctCount: 0,
      totalQuestions: 0,
      answeredCount: 0,
      hasSufficientEvidence: false,
      questionEvaluations: [],
      reason: 'empty_questions',
      evaluatedAt: nowMs,
    };
  }

  // Filter out any malformed question items
  const validQuestions = questions.filter((q) => {
    return (
      q &&
      typeof q.id === 'string' &&
      q.id.trim().length > 0 &&
      Array.isArray(q.options) &&
      q.options.length >= 2 &&
      typeof q.correctIndex === 'number' &&
      Number.isInteger(q.correctIndex) &&
      q.correctIndex >= 0 &&
      q.correctIndex < q.options.length
    );
  });

  if (validQuestions.length === 0) {
    return {
      attemptId,
      level,
      status: 'insufficient_evidence',
      score: null,
      passedFloor: false,
      requiredFloor,
      correctCount: 0,
      totalQuestions: questions.length,
      answeredCount: 0,
      hasSufficientEvidence: false,
      questionEvaluations: [],
      reason: 'invalid_questions',
      evaluatedAt: nowMs,
    };
  }

  // 3. Submitted Answers Evidence Check
  let answeredCount = 0;
  for (const q of validQuestions) {
    const ans = userAnswers[q.id];
    if (typeof ans === 'number' && Number.isInteger(ans) && ans >= 0 && ans < q.options.length) {
      answeredCount++;
    }
  }

  if (answeredCount === 0) {
    return {
      attemptId,
      level,
      status: 'insufficient_evidence',
      score: null,
      passedFloor: false,
      requiredFloor,
      correctCount: 0,
      totalQuestions: validQuestions.length,
      answeredCount: 0,
      hasSufficientEvidence: false,
      questionEvaluations: [],
      reason: 'no_answers_submitted',
      evaluatedAt: nowMs,
    };
  }

  // 4. Deterministic Comprehension Evaluation (readingEncounters NEVER affects score)
  let correctCount = 0;
  const questionEvaluations: ReadingQuestionEvaluation[] = validQuestions.map((q) => {
    const selected = userAnswers[q.id];
    const isAnswered = typeof selected === 'number';
    const isCorrect = isAnswered && selected === q.correctIndex;

    if (isCorrect) {
      correctCount++;
    }

    return {
      questionId: q.id,
      questionText: q.question,
      selectedOptionIndex: isAnswered ? selected : undefined,
      correctIndex: q.correctIndex,
      isCorrect,
      type: q.type,
      explanation: q.explanation || '',
    };
  });

  const normalizedScore = Math.round((correctCount / validQuestions.length) * 100);
  const passedFloor = normalizedScore >= requiredFloor;

  return {
    attemptId,
    level,
    status: 'evaluated',
    score: normalizedScore,
    passedFloor,
    requiredFloor,
    correctCount,
    totalQuestions: validQuestions.length,
    answeredCount,
    hasSufficientEvidence: true,
    questionEvaluations,
    evaluatedAt: nowMs,
  };
}

/**
 * Submits the reading section for an attempt.
 *
 * Invariant: First Submission Wins!
 * If the attempt has already been evaluated, immediately returns the cached first submission.
 */
export function submitReadingSection(
  params: GradeReadingSectionParams
): ReadingSectionEvaluationResult {
  if (isReadingAttemptSubmitted(params.attemptId)) {
    return getReadingAttemptResult(params.attemptId)!;
  }

  const result = gradeReadingCheckpointSection(params);

  // Cache only if successfully evaluated to prevent caching ephemeral faults
  if (result.status === 'evaluated') {
    finalizedReadingAttempts.set(params.attemptId, result);
  }

  return result;
}

// =========================================================================
// 4. MISTAKE BANK DEDUPLICATION PIPELINE
// =========================================================================

export interface ProcessReadingMistakesOptions {
  attemptId: string;
  lessonTitle: string;
  evaluation: ReadingSectionEvaluationResult;
  questions: ReadingQuestion[];
  vocabularyList: VocabWord[];
  recordMistake?: (
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

/**
 * Deduplicated recording of vocabulary mistakes from incorrect reading questions.
 * Enforces:
 * 1. Only incorrect questions are considered.
 * 2. Only questions with vocabulary targets enter Mistake Bank.
 * 3. Never records duplicate entries for the same attempt and question.
 * 4. Reuses existing Mistake Bank; zero secondary certification mistake store.
 */
export function processReadingMistakes(options: ProcessReadingMistakesOptions): number {
  const { attemptId, lessonTitle, evaluation, questions, vocabularyList, recordMistake } = options;
  if (!recordMistake || evaluation.status !== 'evaluated') return 0;

  const questionMap = new Map<string, ReadingQuestion>();
  for (const q of questions) {
    if (q && q.id) questionMap.set(q.id, q);
  }

  let recordedCount = 0;

  for (const qEval of evaluation.questionEvaluations) {
    if (qEval.isCorrect) continue;

    const dedupeKey = `${attemptId}:${qEval.questionId}`;
    if (processedReadingMistakeKeys.has(dedupeKey)) continue;

    const originalQuestion = questionMap.get(qEval.questionId);
    if (!originalQuestion) continue;

    const captureRes = captureReadingMistake({
      question: originalQuestion,
      lessonTitle,
      selectedOptIdx: qEval.selectedOptionIndex,
      vocabularyList,
      recordMistake,
    });

    if (captureRes.recorded) {
      processedReadingMistakeKeys.add(dedupeKey);
      recordedCount++;
    }
  }

  return recordedCount;
}
