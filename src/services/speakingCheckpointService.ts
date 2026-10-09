// src/services/speakingCheckpointService.ts
/**
 * CEFR Speaking Certification Assessment Service (Phase 7)
 *
 * Dedicated Speaking Assessment Engine for CEFR Level Checkpoints.
 *
 * Invariants:
 * 1. Evidence Truthfulness & Trust Boundary:
 *    Speaking score must come exclusively from:
 *    real spoken speech -> Web Speech API -> alignment with targetSentence -> deterministic grading.
 *    Any failure case MUST yield `insufficient_evidence`:
 *      - Unsupported Web Speech API
 *      - Microphone permission denied
 *      - Recognition error
 *      - Empty transcript
 *      - Invalid / untrusted evidence
 *    NEVER fallback 85%, random score, simulated result, or mock confidence!
 * 2. Mic Safety:
 *    - Never auto-start microphone on mount, resume, or section transition.
 *    - Microphone starts ONLY upon explicit user action.
 * 3. Attempt Integrity:
 *    - First valid submission wins (idempotent submission registry).
 *    - Duplicate recognition callbacks ignored for the same turn.
 *    - In-session turn retries locked if allowInSessionRetry === false.
 *    - Reload / resume safe without losing completed turn transcripts.
 * 4. Mistake Bank Deduplication:
 *    - Pronunciation failures (< PRONUNCIATION_FAIL_THRESHOLD) recorded into existing Mistake Bank.
 *    - Deduplicated per attempt per turn. Zero second certification mistake store.
 */

import type { CefrLevel } from '../types/levelCertification';
import { CENTRAL_CERTIFICATION_POLICY, CentralCertificationPolicyConfig } from './levelCertificationService';
import type { SpeakingPrompt, SpeakingTurn } from '../data/fourSkillsData';
import type { AssessmentModePolicy } from '../types/checkpointAssessment';
import type { VocabWord, MistakeSource, MistakeType, ShadowingWordResult } from '../types';
import { isSpeechRecognitionSupported, getSpeechBrowserSupport, SpeechErrorCode } from './speechService';
import { alignSpokenWords } from './textAlignmentService';
import { captureSpeakingMistake } from './fourSkillsLearningBridge';

// =========================================================================
// 1. TYPES & DATA CONTRACTS
// =========================================================================

export type SpeakingAssessmentStatus =
  | 'evaluated'
  | 'insufficient_evidence';

export type SpeakingEvidenceFailureReason =
  | 'unsupported_browser'
  | 'permission_denied'
  | 'recognition_error'
  | 'empty_transcript'
  | 'invalid_evidence'
  | 'missing_prompt'
  | 'empty_turns'
  | 'uncompleted_turns';

export interface SpeakingTurnEvaluation {
  turnIndex: number;
  partnerPrompt: string;
  targetSentence: string;
  spokenTranscript: string;
  accuracyScore: number; // 0 - 100 derived from alignSpokenWords
  fluencyScore: number;  // 0 - 100 derived from alignSpokenWords
  completedWords: number;
  totalWords: number;
  passedTurn: boolean;   // accuracyScore >= requiredFloor
  trustedEvidence: boolean;
  wordResults: ShadowingWordResult[];
  errorMessage?: string;
}

export interface SpeakingSectionEvaluationResult {
  attemptId: string;
  level: CefrLevel;
  status: SpeakingAssessmentStatus;
  score: number | null; // null if insufficient_evidence (NO FAKE SCORES!)
  passedFloor: boolean;
  requiredFloor: number;
  evaluatedTurnsCount: number;
  totalTurnsCount: number;
  hasSufficientEvidence: boolean;
  turnEvaluations: SpeakingTurnEvaluation[];
  reason?: SpeakingEvidenceFailureReason;
  evaluatedAt: number;
}

export interface TurnEvidenceMetadata {
  isTrusted?: boolean;
  error?: SpeechErrorCode | string;
  recordedAt?: number;
}

export interface GradeSpeakingSectionParams {
  attemptId: string;
  level: CefrLevel;
  prompt?: SpeakingPrompt | null;
  turns?: SpeakingTurn[] | null;
  spokenTranscripts: Record<number, string>; // turnIndex -> recognized transcript
  turnMetadata?: Record<number, TurnEvidenceMetadata>;
  isBrowserSupported?: boolean; // If omitted, probed automatically via isSpeechRecognitionSupported()
  policy?: AssessmentModePolicy;
  policyConfig?: CentralCertificationPolicyConfig;
  nowMs?: number;
}

// =========================================================================
// 2. IDEMPOTENT SUBMISSION REGISTRY (FIRST SUBMISSION WINS)
// =========================================================================

const finalizedSpeakingAttempts = new Map<string, SpeakingSectionEvaluationResult>();
const processedSpeakingMistakeKeys = new Set<string>();

/**
 * Checks whether the speaking section for this attempt has already been submitted.
 */
export function isSpeakingAttemptSubmitted(attemptId: string): boolean {
  if (!attemptId) return false;
  return finalizedSpeakingAttempts.has(attemptId);
}

/**
 * Retrieves the cached evaluation result for a previously submitted attempt.
 */
export function getSpeakingAttemptResult(attemptId: string): SpeakingSectionEvaluationResult | null {
  if (!attemptId) return null;
  return finalizedSpeakingAttempts.get(attemptId) || null;
}

/**
 * Resets the in-memory submission registry (for tests and session resets).
 */
export function resetSpeakingAssessments(): void {
  finalizedSpeakingAttempts.clear();
  processedSpeakingMistakeKeys.clear();
}

// =========================================================================
// 3. DETERMINISTIC GRADING ENGINE & TRUST BOUNDARY
// =========================================================================

/**
 * Evaluates Speaking Checkpoint deterministically using ONLY trusted speech evidence.
 *
 * Invariants enforced:
 * - Unsupported browser -> insufficient_evidence (score: null)
 * - Mic permission denied -> insufficient_evidence (score: null)
 * - Recognition error -> insufficient_evidence (score: null)
 * - Empty transcript -> insufficient_evidence (score: null)
 * - Missing / uncompleted turns -> insufficient_evidence (score: null)
 * - NO fallback 85%, random score, simulated result, or mock confidence!
 */
export function gradeSpeakingCheckpointSection(
  params: GradeSpeakingSectionParams
): SpeakingSectionEvaluationResult {
  const {
    attemptId,
    level,
    prompt,
    turns,
    spokenTranscripts = {},
    turnMetadata = {},
    policyConfig = CENTRAL_CERTIFICATION_POLICY,
    nowMs = Date.now(),
  } = params;

  const levelPolicy = policyConfig.levels[level] || policyConfig.levels.A1;
  const requiredFloor = levelPolicy.perSkillFloorThreshold;

  // 1. Browser & Web Speech API Support Boundary
  const supported =
    typeof params.isBrowserSupported === 'boolean'
      ? params.isBrowserSupported
      : isSpeechRecognitionSupported();

  if (!supported) {
    return {
      attemptId,
      level,
      status: 'insufficient_evidence',
      score: null,
      passedFloor: false,
      requiredFloor,
      evaluatedTurnsCount: 0,
      totalTurnsCount: turns?.length || 0,
      hasSufficientEvidence: false,
      turnEvaluations: [],
      reason: 'unsupported_browser',
      evaluatedAt: nowMs,
    };
  }

  // 2. Prompt & Turns Integrity
  if (!prompt) {
    return {
      attemptId,
      level,
      status: 'insufficient_evidence',
      score: null,
      passedFloor: false,
      requiredFloor,
      evaluatedTurnsCount: 0,
      totalTurnsCount: 0,
      hasSufficientEvidence: false,
      turnEvaluations: [],
      reason: 'missing_prompt',
      evaluatedAt: nowMs,
    };
  }

  const validTurns = (turns || prompt.turns || []).filter(
    (t) =>
      t &&
      typeof t.turnIndex === 'number' &&
      typeof t.targetSentence === 'string' &&
      t.targetSentence.trim().length > 0
  );

  if (validTurns.length === 0) {
    return {
      attemptId,
      level,
      status: 'insufficient_evidence',
      score: null,
      passedFloor: false,
      requiredFloor,
      evaluatedTurnsCount: 0,
      totalTurnsCount: 0,
      hasSufficientEvidence: false,
      turnEvaluations: [],
      reason: 'empty_turns',
      evaluatedAt: nowMs,
    };
  }

  // 3. Inspect Turn Evidences & Trust Boundary
  const turnEvaluations: SpeakingTurnEvaluation[] = [];
  let totalScoreSum = 0;

  for (const turn of validTurns) {
    const transcript = spokenTranscripts[turn.turnIndex];
    const meta = turnMetadata[turn.turnIndex];

    // Check for explicit speech recognition errors
    if (meta?.error) {
      const isPermissionDenied =
        meta.error === 'permission-denied' ||
        meta.error === 'not-allowed' ||
        meta.error === 'service-not-allowed';

      return {
        attemptId,
        level,
        status: 'insufficient_evidence',
        score: null,
        passedFloor: false,
        requiredFloor,
        evaluatedTurnsCount: turnEvaluations.length,
        totalTurnsCount: validTurns.length,
        hasSufficientEvidence: false,
        turnEvaluations,
        reason: isPermissionDenied ? 'permission_denied' : 'recognition_error',
        evaluatedAt: nowMs,
      };
    }

    // Check for untrusted evidence flag
    if (meta?.isTrusted === false) {
      return {
        attemptId,
        level,
        status: 'insufficient_evidence',
        score: null,
        passedFloor: false,
        requiredFloor,
        evaluatedTurnsCount: turnEvaluations.length,
        totalTurnsCount: validTurns.length,
        hasSufficientEvidence: false,
        turnEvaluations,
        reason: 'invalid_evidence',
        evaluatedAt: nowMs,
      };
    }

    // Check for missing or empty transcript
    if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
      return {
        attemptId,
        level,
        status: 'insufficient_evidence',
        score: null,
        passedFloor: false,
        requiredFloor,
        evaluatedTurnsCount: turnEvaluations.length,
        totalTurnsCount: validTurns.length,
        hasSufficientEvidence: false,
        turnEvaluations,
        reason: 'empty_transcript',
        evaluatedAt: nowMs,
      };
    }

    // 4. Deterministic Alignment via existing alignSpokenWords
    const feedback = alignSpokenWords(turn.targetSentence, transcript.trim());
    const turnAccuracy = Math.max(0, Math.min(100, Math.round(feedback.accuracyScore)));
    const passedTurn = turnAccuracy >= requiredFloor;

    turnEvaluations.push({
      turnIndex: turn.turnIndex,
      partnerPrompt: turn.partnerPrompt,
      targetSentence: turn.targetSentence,
      spokenTranscript: transcript.trim(),
      accuracyScore: turnAccuracy,
      fluencyScore: Math.round(feedback.fluencyScore),
      completedWords: feedback.completedWords,
      totalWords: feedback.totalWords,
      passedTurn,
      trustedEvidence: true,
      wordResults: feedback.wordResults,
    });

    totalScoreSum += turnAccuracy;
  }

  // 5. Compute Final Speaking Section Score
  const normalizedScore = Math.round(totalScoreSum / validTurns.length);
  const passedFloor = normalizedScore >= requiredFloor;

  return {
    attemptId,
    level,
    status: 'evaluated',
    score: normalizedScore,
    passedFloor,
    requiredFloor,
    evaluatedTurnsCount: validTurns.length,
    totalTurnsCount: validTurns.length,
    hasSufficientEvidence: true,
    turnEvaluations,
    evaluatedAt: nowMs,
  };
}

/**
 * Submits the speaking section for an attempt.
 *
 * Invariant: First Submission Wins!
 * If the attempt has already been evaluated, immediately returns the cached first submission.
 */
export function submitSpeakingSection(
  params: GradeSpeakingSectionParams
): SpeakingSectionEvaluationResult {
  if (isSpeakingAttemptSubmitted(params.attemptId)) {
    return getSpeakingAttemptResult(params.attemptId)!;
  }

  const result = gradeSpeakingCheckpointSection(params);

  // Cache only if successfully evaluated to prevent caching ephemeral faults
  if (result.status === 'evaluated') {
    finalizedSpeakingAttempts.set(params.attemptId, result);
  }

  return result;
}

// =========================================================================
// 4. MISTAKE BANK DEDUPLICATION PIPELINE
// =========================================================================

export interface ProcessSpeakingMistakesOptions {
  attemptId: string;
  promptTitle: string;
  evaluation: SpeakingSectionEvaluationResult;
  turns: SpeakingTurn[];
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
 * Deduplicated recording of pronunciation mistakes from turns scoring below PRONUNCIATION_FAIL_THRESHOLD.
 * Enforces:
 * 1. Only turns scoring < PRONUNCIATION_FAIL_THRESHOLD (60%) are considered.
 * 2. Deduplicated per attempt per turn.
 * 3. Reuses existing Mistake Bank; zero secondary certification mistake store.
 */
export function processSpeakingMistakes(options: ProcessSpeakingMistakesOptions): number {
  const { attemptId, promptTitle, evaluation, turns, vocabularyList, recordMistake } = options;
  if (!recordMistake || evaluation.status !== 'evaluated') return 0;

  const turnMap = new Map<number, SpeakingTurn>();
  for (const t of turns) {
    if (t && typeof t.turnIndex === 'number') turnMap.set(t.turnIndex, t);
  }

  let recordedCount = 0;

  for (const turnEval of evaluation.turnEvaluations) {
    // Only capture if below standard pronunciation fail threshold
    if (turnEval.accuracyScore >= 60) continue;

    const dedupeKey = `${attemptId}:turn_${turnEval.turnIndex}`;
    if (processedSpeakingMistakeKeys.has(dedupeKey)) continue;

    const originalTurn = turnMap.get(turnEval.turnIndex);
    if (!originalTurn) continue;

    const captureRes = captureSpeakingMistake({
      accuracy: turnEval.accuracyScore,
      targetSentence: originalTurn.targetSentence,
      speakingTranscript: turnEval.spokenTranscript,
      keyKeywords: originalTurn.keyKeywords,
      phonetic: originalTurn.phonetic,
      meaningVi: originalTurn.meaningVi,
      promptTitle,
      turnIndex: originalTurn.turnIndex,
      vocabularyList,
      recordMistake,
    });

    if (captureRes.recorded) {
      processedSpeakingMistakeKeys.add(dedupeKey);
      recordedCount++;
    }
  }

  return recordedCount;
}
