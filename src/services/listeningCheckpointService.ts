// src/services/listeningCheckpointService.ts
/**
 * CEFR Listening Certification Assessment Service (Phase 5)
 *
 * Dedicated Listening Assessment Engine for CEFR Level Checkpoints.
 *
 * Invariants:
 * 1. Evidence Truthfulness:
 *    Listening score must come exclusively from:
 *    real audio -> comprehension questions -> submitted answers -> deterministic grading.
 *    NEVER from lesson completion, exposure count, or fake fallback scores.
 * 2. Certification Mode Restrictions:
 *    - Transcripts hidden (allowTranscript: false).
 *    - Hints disabled (allowHints: false).
 *    - Answer reveals disabled (allowAnswerReveal: false).
 *    - In-session question retries disabled (allowInSessionRetry: false).
 *    - Strict audio play limit (e.g. maxAudioPlays: 2).
 *    - First valid submission wins (requireFirstSubmission: true).
 * 3. Failure Handling & Integrity:
 *    - Missing audio -> insufficient_evidence (no fake 0 pass/fail).
 *    - Empty questions or no answers submitted -> insufficient_evidence.
 *    - Playback failure -> safe error state and retry without losing answers.
 *    - Duplicate submission -> idempotent (first submission wins).
 * 4. Memory & Media Lifecycle:
 *    - Zero persistent Audio/DOM references.
 *    - Safe cancel/cleanup on component unmount or interruption.
 * 5. Mistake Bank Deduplication:
 *    - Vocabulary-targeted mistakes recorded only once per attempt per question.
 */

import type { CefrLevel } from '../types/levelCertification';
import { CENTRAL_CERTIFICATION_POLICY, CentralCertificationPolicyConfig } from './levelCertificationService';
import type { ListeningLesson, ListeningQuestion } from '../data/fourSkillsData';
import type { AssessmentModePolicy } from '../types/checkpointAssessment';
import { DEFAULT_ASSESSMENT_POLICY } from '../types/checkpointAssessment';
import type { VocabWord, MistakeSource, MistakeType } from '../types';
import { captureListeningMistake } from './fourSkillsLearningBridge';

// =========================================================================
// 1. TYPES & DATA CONTRACTS
// =========================================================================

export type ListeningAssessmentStatus =
  | 'evaluated'
  | 'insufficient_evidence';

export interface ListeningQuestionEvaluation {
  questionId: string;
  questionText: string;
  selectedOptionIndex?: number;
  correctIndex: number;
  isCorrect: boolean;
  type?: string;
  explanation: string;
}

export interface ListeningSectionEvaluationResult {
  attemptId: string;
  level: CefrLevel;
  status: ListeningAssessmentStatus;
  score: number | null; // null if insufficient_evidence
  passedFloor: boolean;
  requiredFloor: number;
  correctCount: number;
  totalQuestions: number;
  answeredCount: number;
  hasSufficientEvidence: boolean;
  questionEvaluations: ListeningQuestionEvaluation[];
  reason?: string;
  evaluatedAt: number;
}

export interface GradeListeningSectionParams {
  attemptId: string;
  level: CefrLevel;
  lesson?: ListeningLesson | null;
  questions?: ListeningQuestion[] | null;
  userAnswers: Record<string, number>;
  policy?: AssessmentModePolicy;
  policyConfig?: CentralCertificationPolicyConfig;
  nowMs?: number;
}

// =========================================================================
// 2. IDEMPOTENT SUBMISSION REGISTRY (FIRST SUBMISSION WINS)
// =========================================================================

const finalizedListeningAttempts = new Map<string, ListeningSectionEvaluationResult>();
const processedMistakeKeys = new Set<string>();

/**
 * Checks whether the listening section for this attempt has already been submitted.
 */
export function isListeningAttemptSubmitted(attemptId: string): boolean {
  if (!attemptId) return false;
  return finalizedListeningAttempts.has(attemptId);
}

/**
 * Retrieves the cached evaluation result for a previously submitted attempt.
 */
export function getListeningAttemptResult(attemptId: string): ListeningSectionEvaluationResult | null {
  if (!attemptId) return null;
  return finalizedListeningAttempts.get(attemptId) || null;
}

/**
 * Resets the in-memory submission registry (for tests and session resets).
 */
export function resetListeningAssessments(): void {
  finalizedListeningAttempts.clear();
  processedMistakeKeys.clear();
}

// =========================================================================
// 3. DETERMINISTIC GRADING ENGINE & VALIDATION
// =========================================================================

/**
 * Grades a Checkpoint Listening Section deterministically with strict integrity checks.
 *
 * Invariants:
 * - Missing audio -> insufficient_evidence
 * - Malformed / empty questions -> insufficient_evidence
 * - No user answers submitted -> insufficient_evidence
 * - Pure calculation: 100% deterministic (correct / total * 100)
 */
export function gradeListeningCheckpointSection(
  params: GradeListeningSectionParams
): ListeningSectionEvaluationResult {
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

  // 1. Audio Integrity Check
  if (!lesson || !lesson.audioText || typeof lesson.audioText !== 'string' || lesson.audioText.trim().length < 10) {
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
      reason: 'missing_audio',
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

  // 4. Deterministic Evaluation
  let correctCount = 0;
  const questionEvaluations: ListeningQuestionEvaluation[] = validQuestions.map((q) => {
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
 * Submits the listening section for an attempt.
 *
 * Invariant: First Submission Wins!
 * If the attempt has already been evaluated, immediately returns the cached first submission.
 */
export function submitListeningSection(
  params: GradeListeningSectionParams
): ListeningSectionEvaluationResult {
  if (isListeningAttemptSubmitted(params.attemptId)) {
    return getListeningAttemptResult(params.attemptId)!;
  }

  const result = gradeListeningCheckpointSection(params);

  // Cache only if successfully evaluated to prevent caching ephemeral faults
  if (result.status === 'evaluated') {
    finalizedListeningAttempts.set(params.attemptId, result);
  }

  return result;
}

// =========================================================================
// 4. MISTAKE BANK DEDUPLICATION PIPELINE
// =========================================================================

export interface ProcessListeningMistakesOptions {
  attemptId: string;
  lessonTitle: string;
  evaluation: ListeningSectionEvaluationResult;
  questions: ListeningQuestion[];
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
 * Deduplicated recording of vocabulary mistakes from incorrect listening questions.
 * Enforces:
 * 1. Only incorrect questions are considered.
 * 2. Only questions with vocabulary targets enter Mistake Bank.
 * 3. Never records duplicate entries for the same attempt and question.
 */
export function processListeningMistakes(options: ProcessListeningMistakesOptions): number {
  const { attemptId, lessonTitle, evaluation, questions, vocabularyList, recordMistake } = options;
  if (!recordMistake || evaluation.status !== 'evaluated') return 0;

  const questionMap = new Map<string, ListeningQuestion>();
  for (const q of questions) {
    if (q && q.id) questionMap.set(q.id, q);
  }

  let recordedCount = 0;

  for (const qEval of evaluation.questionEvaluations) {
    if (qEval.isCorrect) continue;

    const dedupeKey = `${attemptId}:${qEval.questionId}`;
    if (processedMistakeKeys.has(dedupeKey)) continue;

    const originalQuestion = questionMap.get(qEval.questionId);
    if (!originalQuestion) continue;

    const captureRes = captureListeningMistake({
      question: originalQuestion,
      lessonTitle,
      selectedOptIdx: qEval.selectedOptionIndex,
      vocabularyList,
      recordMistake,
    });

    if (captureRes.recorded) {
      processedMistakeKeys.add(dedupeKey);
      recordedCount++;
    }
  }

  return recordedCount;
}

// =========================================================================
// 5. CLIENT-SIDE AUDIO CONTROLLER (ASSESSMENT PLAY LIMIT & LIFECYCLE)
// =========================================================================

// Global Set to prevent GC of SpeechSynthesisUtterance on Chrome/Safari
const activeAssessmentUtterances = new Set<SpeechSynthesisUtterance>();

export interface ListeningAudioControllerState {
  playCount: number;
  maxPlays: number;
  isPlaying: boolean;
  status: 'idle' | 'playing' | 'ended' | 'error';
  errorMessage?: string;
}

export interface ListeningAudioControllerOptions {
  text: string;
  maxPlays?: number;
  initialPlayCount?: number;
  rate?: number;
  lang?: string;
  onPlayCountChange?: (count: number) => void;
  onStatusChange?: (status: ListeningAudioControllerState) => void;
}

/**
 * Lightweight, memory-safe audio controller for Assessment Mode.
 *
 * Invariants:
 * - Enforces maxAudioPlays constraint.
 * - Stops and disconnects on unmount or cancellation.
 * - Free of AudioContext memory leaks.
 */
export class ListeningAudioController {
  private text: string;
  private maxPlays: number;
  private playCount: number;
  private rate: number;
  private lang: string;
  private isPlaying = false;
  private status: 'idle' | 'playing' | 'ended' | 'error' = 'idle';
  private errorMessage?: string;
  private onPlayCountChange?: (count: number) => void;
  private onStatusChange?: (status: ListeningAudioControllerState) => void;

  constructor(options: ListeningAudioControllerOptions) {
    this.text = options.text || '';
    this.maxPlays = options.maxPlays ?? DEFAULT_ASSESSMENT_POLICY.maxAudioPlays;
    this.playCount = options.initialPlayCount ?? 0;
    this.rate = options.rate ?? 0.9;
    this.lang = options.lang ?? 'en-US';
    this.onPlayCountChange = options.onPlayCountChange;
    this.onStatusChange = options.onStatusChange;
  }

  public getRemainingPlays(): number {
    return Math.max(0, this.maxPlays - this.playCount);
  }

  public canPlay(): boolean {
    return this.playCount < this.maxPlays && !this.isPlaying;
  }

  public getState(): ListeningAudioControllerState {
    return {
      playCount: this.playCount,
      maxPlays: this.maxPlays,
      isPlaying: this.isPlaying,
      status: this.status,
      errorMessage: this.errorMessage,
    };
  }

  public play(): boolean {
    if (!this.canPlay()) {
      return false;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.status = 'error';
      this.errorMessage = 'Trình duyệt không hỗ trợ Web Speech Synthesis API.';
      this.notifyStatus();
      return false;
    }

    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }

    let utterance: SpeechSynthesisUtterance;
    try {
      utterance = new SpeechSynthesisUtterance(this.text);
    } catch (err: any) {
      this.status = 'error';
      this.errorMessage = err?.message || 'Không thể khởi tạo âm thanh.';
      this.notifyStatus();
      return false;
    }

    utterance.lang = this.lang;
    utterance.rate = this.rate;

    this.playCount++;
    this.isPlaying = true;
    this.status = 'playing';
    this.errorMessage = undefined;

    this.onPlayCountChange?.(this.playCount);
    this.notifyStatus();

    activeAssessmentUtterances.add(utterance);

    utterance.onend = () => {
      activeAssessmentUtterances.delete(utterance);
      this.isPlaying = false;
      this.status = 'ended';
      this.notifyStatus();
    };

    utterance.onerror = (e) => {
      activeAssessmentUtterances.delete(utterance);
      this.isPlaying = false;
      this.status = 'error';
      this.errorMessage = 'Có lỗi xảy ra khi phát âm thanh.';
      this.notifyStatus();
    };

    try {
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (err: any) {
      activeAssessmentUtterances.delete(utterance);
      this.isPlaying = false;
      this.status = 'error';
      this.errorMessage = err?.message || 'Không thể phát âm thanh.';
      this.notifyStatus();
      return false;
    }
  }

  public stop(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    this.isPlaying = false;
    if (this.status === 'playing') {
      this.status = 'idle';
    }
    this.notifyStatus();
  }

  private notifyStatus(): void {
    this.onStatusChange?.(this.getState());
  }
}
