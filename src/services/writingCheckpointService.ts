// src/services/writingCheckpointService.ts
/**
 * CEFR Writing Certification Assessment Service (Phase 8)
 *
 * Dedicated Writing Assessment Engine with Trusted AI Boundary for CEFR Level Checkpoints.
 *
 * Invariants & Strict Trust Rules:
 * 1. Evidence Truthfulness & Zero Fabricated Scores:
 *    - Writing certification score is valid ONLY when:
 *      grading result is valid AND trusted AND !fallback (genuine Gemini AI evaluation).
 *    - All failure conditions (offline, timeout, network error, HTTP error, parse failure,
 *      demo/mock data, fallback result) MUST return score: null and status: 'insufficient_evidence'
 *      or status: 'pending'.
 *    - NEVER use mock fallback data or fabricated scores as certification evidence!
 * 2. Attempt Integrity & Stale Response Protection:
 *    - First valid submission wins (cached in finalizedWritingAttempts).
 *    - Double-submit protection: in-flight lock returns the existing Promise.
 *    - Token guard: supersedes delayed/stale responses from older retries or previous attempts.
 * 3. Offline Safety:
 *    - Keeps local essay draft completely intact without rolling back section.
 *    - Allows clean retry when online.
 * 4. Mistake Bank Pipeline & Deduplication:
 *    - Only trusted grading can generate grammar/spelling mistake records.
 *    - AI fallback data is strictly blocked from entering the Mistake Bank.
 *    - Deduplicated per attemptId.
 */

import type { CefrLevel } from '../types/levelCertification';
import { CENTRAL_CERTIFICATION_POLICY, CentralCertificationPolicyConfig } from './levelCertificationService';
import type { WritingPrompt } from '../types/fourSkills';
import type {
  EssayGradingResult,
  GradeEssayOptions,
  VocabWord,
  MistakeSource,
  MistakeType,
} from '../types';
import { calculateOverallScore, gradeEssay } from './essayGradingService';
import { captureWritingMistake } from './fourSkillsLearningBridge';

// =========================================================================
// 1. DATA CONTRACTS & TYPES
// =========================================================================

export type WritingEvidenceFailureReason =
  | 'missing_prompt'
  | 'empty_essay'
  | 'word_count_insufficient'
  | 'offline'
  | 'timeout'
  | 'ai_fallback_untrusted'
  | 'malformed_result'
  | 'network_error'
  | 'invalid_evidence';

export type WritingAssessmentStatus =
  | 'evaluated'
  | 'insufficient_evidence'
  | 'pending';

export interface WritingSectionEvaluationResult {
  attemptId: string;
  level: CefrLevel;
  status: WritingAssessmentStatus;
  score: number | null; // strictly null if insufficient_evidence or pending
  passedFloor: boolean;
  requiredFloor: number;
  wordCount: number;
  minWordsRequired: number;
  maxWordsAllowed?: number;
  hasSufficientEvidence: boolean;
  isTrusted: boolean;
  isFallback: boolean;
  gradingResult?: EssayGradingResult | null;
  reason?: WritingEvidenceFailureReason;
  evaluatedAt: number;
}

export interface EvaluateWritingSectionParams {
  attemptId: string;
  level: CefrLevel;
  prompt?: WritingPrompt | null;
  essay: string;
  gradingResult?: EssayGradingResult | null;
  policyConfig?: CentralCertificationPolicyConfig;
  nowMs?: number;
  isOffline?: boolean;
}

export interface SubmitWritingSectionParams {
  attemptId: string;
  level: CefrLevel;
  prompt?: WritingPrompt | null;
  essay: string;
  apiKey?: string;
  policyConfig?: CentralCertificationPolicyConfig;
  nowMs?: number;
  timeoutMs?: number;
  isOffline?: boolean;
  gradeFn?: (options: GradeEssayOptions) => Promise<EssayGradingResult>;
}

export interface ProcessWritingMistakesParams {
  attemptId: string;
  promptTitle: string;
  evaluation: WritingSectionEvaluationResult;
  fullEssay: string;
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

// =========================================================================
// 2. HELPER UTILITIES
// =========================================================================

/**
 * Deterministic word count helper.
 * Splits on whitespace, trimming edge spaces, ignoring empty tokens.
 */
export function countWords(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

// =========================================================================
// 3. IDEMPOTENT ATTEMPT REGISTRY & IN-FLIGHT LOCKS
// =========================================================================

const finalizedWritingAttempts = new Map<string, WritingSectionEvaluationResult>();
const inFlightWritingRequests = new Map<string, Promise<WritingSectionEvaluationResult>>();
const activeAttemptTokens = new Map<string, number>();
const processedWritingMistakeAttempts = new Set<string>();

export function isWritingAttemptSubmitted(attemptId: string): boolean {
  return finalizedWritingAttempts.has(attemptId);
}

export function getWritingAttemptResult(attemptId: string): WritingSectionEvaluationResult | null {
  return finalizedWritingAttempts.get(attemptId) || null;
}

export function resetWritingAssessments(): void {
  finalizedWritingAttempts.clear();
  inFlightWritingRequests.clear();
  activeAttemptTokens.clear();
  processedWritingMistakeAttempts.clear();
}

// =========================================================================
// 4. PURE EVALUATION ENGINE & TRUST BOUNDARY AUDIT
// =========================================================================

/**
 * Evaluates Writing Certification evidence strictly against trust boundaries.
 * Enforces Zero Fake Score policy:
 * - offline, empty, insufficient words, fallback, malformed result -> score: null.
 */
export function evaluateWritingSectionResult(
  params: EvaluateWritingSectionParams
): WritingSectionEvaluationResult {
  const {
    attemptId,
    level,
    prompt,
    essay,
    gradingResult,
    policyConfig = CENTRAL_CERTIFICATION_POLICY,
    nowMs = Date.now(),
    isOffline = false,
  } = params;

  const levelPolicy = policyConfig.levels[level] || policyConfig.levels.A1;
  const requiredFloor = levelPolicy.perSkillFloorThreshold;

  const wordCount = countWords(essay);
  const minWords = prompt?.minWords ?? 40;
  const maxWords = prompt?.maxWords;

  // 1. Missing prompt check
  if (!prompt) {
    return {
      attemptId,
      level,
      status: 'insufficient_evidence',
      score: null,
      passedFloor: false,
      requiredFloor,
      wordCount,
      minWordsRequired: minWords,
      maxWordsAllowed: maxWords,
      hasSufficientEvidence: false,
      isTrusted: false,
      isFallback: false,
      reason: 'missing_prompt',
      evaluatedAt: nowMs,
    };
  }

  // 2. Empty essay check
  if (!essay || essay.trim().length === 0) {
    return {
      attemptId,
      level,
      status: 'insufficient_evidence',
      score: null,
      passedFloor: false,
      requiredFloor,
      wordCount: 0,
      minWordsRequired: minWords,
      maxWordsAllowed: maxWords,
      hasSufficientEvidence: false,
      isTrusted: false,
      isFallback: false,
      reason: 'empty_essay',
      evaluatedAt: nowMs,
    };
  }

  // 3. Word count threshold check
  if (wordCount < minWords) {
    return {
      attemptId,
      level,
      status: 'insufficient_evidence',
      score: null,
      passedFloor: false,
      requiredFloor,
      wordCount,
      minWordsRequired: minWords,
      maxWordsAllowed: maxWords,
      hasSufficientEvidence: false,
      isTrusted: false,
      isFallback: false,
      reason: 'word_count_insufficient',
      evaluatedAt: nowMs,
    };
  }

  // 4. Offline environment check -> pending status
  if (isOffline) {
    return {
      attemptId,
      level,
      status: 'pending',
      score: null,
      passedFloor: false,
      requiredFloor,
      wordCount,
      minWordsRequired: minWords,
      maxWordsAllowed: maxWords,
      hasSufficientEvidence: false,
      isTrusted: false,
      isFallback: false,
      reason: 'offline',
      evaluatedAt: nowMs,
    };
  }

  // 5. Missing grading result
  if (!gradingResult) {
    return {
      attemptId,
      level,
      status: 'insufficient_evidence',
      score: null,
      passedFloor: false,
      requiredFloor,
      wordCount,
      minWordsRequired: minWords,
      maxWordsAllowed: maxWords,
      hasSufficientEvidence: false,
      isTrusted: false,
      isFallback: false,
      reason: 'invalid_evidence',
      evaluatedAt: nowMs,
    };
  }

  // 6. STRICT TRUST RULE: !gradingResult.isFallback
  // NEVER use mock fallback data as certification evidence!
  if (gradingResult.isFallback === true) {
    return {
      attemptId,
      level,
      status: 'insufficient_evidence',
      score: null,
      passedFloor: false,
      requiredFloor,
      wordCount,
      minWordsRequired: minWords,
      maxWordsAllowed: maxWords,
      hasSufficientEvidence: false,
      isTrusted: false,
      isFallback: true,
      gradingResult,
      reason: 'ai_fallback_untrusted',
      evaluatedAt: nowMs,
    };
  }

  // 7. Validate criteria breakdown integrity
  const c = gradingResult.criteria;
  if (
    !c ||
    typeof c.taskAchievement?.score !== 'number' ||
    typeof c.coherenceCohesion?.score !== 'number' ||
    typeof c.lexicalResource?.score !== 'number' ||
    typeof c.grammaticalAccuracy?.score !== 'number' ||
    Number.isNaN(c.taskAchievement.score) ||
    Number.isNaN(c.coherenceCohesion.score) ||
    Number.isNaN(c.lexicalResource.score) ||
    Number.isNaN(c.grammaticalAccuracy.score)
  ) {
    return {
      attemptId,
      level,
      status: 'insufficient_evidence',
      score: null,
      passedFloor: false,
      requiredFloor,
      wordCount,
      minWordsRequired: minWords,
      maxWordsAllowed: maxWords,
      hasSufficientEvidence: false,
      isTrusted: false,
      isFallback: false,
      gradingResult,
      reason: 'malformed_result',
      evaluatedAt: nowMs,
    };
  }

  // 8. Deterministic CEFR Overall Score calculation
  const { overallScore } = calculateOverallScore(c);
  const passedFloor = overallScore >= requiredFloor;

  return {
    attemptId,
    level,
    status: 'evaluated',
    score: overallScore,
    passedFloor,
    requiredFloor,
    wordCount,
    minWordsRequired: minWords,
    maxWordsAllowed: maxWords,
    hasSufficientEvidence: true,
    isTrusted: true,
    isFallback: false,
    gradingResult,
    evaluatedAt: nowMs,
  };
}

// =========================================================================
// 5. ASYNC AI GRADING SUBMISSION WITH ATTEMPT INTEGRITY & RETRY
// =========================================================================

/**
 * Submits the Writing checkpoint section for AI grading.
 * Enforces:
 * - Double submit protection (in-flight promise lock + cached finalized result).
 * - Stale response protection via activeAttemptTokens.
 * - Timeout handling (default 25s).
 * - Offline detection.
 */
export async function submitWritingSection(
  params: SubmitWritingSectionParams
): Promise<WritingSectionEvaluationResult> {
  const {
    attemptId,
    essay,
    prompt,
    level,
    apiKey,
    timeoutMs = 25000,
    gradeFn = gradeEssay,
    nowMs = Date.now(),
  } = params;

  // 1. First valid submission wins: return cached result
  if (finalizedWritingAttempts.has(attemptId)) {
    return finalizedWritingAttempts.get(attemptId)!;
  }

  // 2. Double-submit guard: If request is in-flight for this attemptId, return existing promise
  if (inFlightWritingRequests.has(attemptId)) {
    return inFlightWritingRequests.get(attemptId)!;
  }

  // 3. Increment request token to invalidate delayed/stale responses from older retries
  const currentToken = (activeAttemptTokens.get(attemptId) || 0) + 1;
  activeAttemptTokens.set(attemptId, currentToken);

  // 4. Synchronous pre-checks (empty, missing prompt, insufficient word count)
  const minWords = prompt?.minWords ?? 40;
  const wordCount = countWords(essay);

  if (!prompt || !essay || essay.trim().length === 0 || wordCount < minWords) {
    return evaluateWritingSectionResult({
      attemptId,
      level,
      prompt,
      essay,
      gradingResult: null,
      policyConfig: params.policyConfig,
      nowMs,
    });
  }

  // 5. Offline environment check
  const isOffline =
    typeof params.isOffline === 'boolean'
      ? params.isOffline
      : typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
        ? !navigator.onLine
        : false;

  if (isOffline) {
    return evaluateWritingSectionResult({
      attemptId,
      level,
      prompt,
      essay,
      isOffline: true,
      policyConfig: params.policyConfig,
      nowMs,
    });
  }

  // 6. Launch AI evaluation with timeout race
  const gradingPromise = (async (): Promise<WritingSectionEvaluationResult> => {
    try {
      let timeoutId: any;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          const err: any = new Error('Writing AI grading timed out');
          err.code = 'TIMEOUT';
          reject(err);
        }, timeoutMs);
      });

      const actualGradingPromise = gradeFn({
        essay,
        topic: prompt.prompt || prompt.title,
        targetLevel: level,
        apiKey,
      });

      let gradingResult: EssayGradingResult;
      try {
        gradingResult = await Promise.race([actualGradingPromise, timeoutPromise]);
      } finally {
        clearTimeout(timeoutId);
      }

      // Stale response guard: check if active token was superseded during request
      if (activeAttemptTokens.get(attemptId) !== currentToken) {
        return {
          attemptId,
          level,
          status: 'pending',
          score: null,
          passedFloor: false,
          requiredFloor: 55,
          wordCount,
          minWordsRequired: minWords,
          hasSufficientEvidence: false,
          isTrusted: false,
          isFallback: false,
          reason: 'invalid_evidence',
          evaluatedAt: Date.now(),
        };
      }

      const evalResult = evaluateWritingSectionResult({
        attemptId,
        level,
        prompt,
        essay,
        gradingResult,
        policyConfig: params.policyConfig,
        nowMs: Date.now(),
      });

      // Cache strictly when evaluated with trusted AI evidence
      if (evalResult.status === 'evaluated') {
        finalizedWritingAttempts.set(attemptId, evalResult);
      }

      return evalResult;
    } catch (err: any) {
      // Stale response guard on catch as well
      if (activeAttemptTokens.get(attemptId) !== currentToken) {
        return {
          attemptId,
          level,
          status: 'pending',
          score: null,
          passedFloor: false,
          requiredFloor: 55,
          wordCount,
          minWordsRequired: minWords,
          hasSufficientEvidence: false,
          isTrusted: false,
          isFallback: false,
          reason: 'invalid_evidence',
          evaluatedAt: Date.now(),
        };
      }

      const isTimeout = err?.code === 'TIMEOUT' || err?.message?.includes('timed out');
      const isNetwork =
        !isTimeout &&
        (err?.message?.includes('Failed to fetch') ||
          err?.message?.includes('Network') ||
          err?.message?.includes('network'));

      return {
        attemptId,
        level,
        status: 'pending',
        score: null,
        passedFloor: false,
        requiredFloor: 55,
        wordCount,
        minWordsRequired: minWords,
        hasSufficientEvidence: false,
        isTrusted: false,
        isFallback: false,
        reason: isTimeout ? 'timeout' : isNetwork ? 'network_error' : 'malformed_result',
        evaluatedAt: Date.now(),
      };
    } finally {
      inFlightWritingRequests.delete(attemptId);
    }
  })();

  inFlightWritingRequests.set(attemptId, gradingPromise);
  return gradingPromise;
}

// =========================================================================
// 6. MISTAKE BANK INTEGRATION & DEDUPLICATION
// =========================================================================

/**
 * Captures grammar and spelling mistakes from trusted writing grading results.
 * Invariants:
 * - Only trusted grading (!isFallback) can record mistakes.
 * - AI fallback data is strictly ignored.
 * - Deduplicated per attemptId.
 */
export function processWritingMistakes(params: ProcessWritingMistakesParams): number {
  const { attemptId, evaluation, fullEssay, recordMistake } = params;

  // Deduplication guard
  if (processedWritingMistakeAttempts.has(attemptId)) {
    return 0;
  }

  // Strict Trust Rule: Only trusted evaluation can create Mistake Bank records
  if (
    evaluation.status !== 'evaluated' ||
    !evaluation.isTrusted ||
    evaluation.isFallback ||
    !evaluation.gradingResult ||
    !Array.isArray(evaluation.gradingResult.diffSegments)
  ) {
    return 0;
  }

  let recordedCount = 0;
  const segments = evaluation.gradingResult.diffSegments;

  for (const seg of segments) {
    if (seg.type === 'correction' && seg.originalText) {
      const res = captureWritingMistake({
        originalText: seg.originalText,
        revisedText: seg.revisedText,
        explanation: seg.explanation || seg.reasonVi,
        reasonVi: seg.reasonVi || seg.explanation,
        fullEssay,
        segmentType: seg.type,
        recordMistake,
      });
      if (res.recorded) {
        recordedCount++;
      }
    }
  }

  processedWritingMistakeAttempts.add(attemptId);
  return recordedCount;
}
