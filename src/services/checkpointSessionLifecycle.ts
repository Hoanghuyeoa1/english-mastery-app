// src/services/checkpointSessionLifecycle.ts
/**
 * CEFR Checkpoint Session Lifecycle Engine (Phase 4)
 *
 * Framework for running official CEFR Level Checkpoint assessment sessions.
 *
 * Invariants:
 * 1. Attempt Identity:
 *    - Stable unique format: `cefr:<level>:chk_<timestamp>_<entropy>`
 *    - Strictly idempotent finalization: an attempt can only be evaluated/finalized once.
 *    - Double-click, duplicate callback, refresh, and resume protected.
 * 2. Lifecycle Stages:
 *    `intro` -> `listening` -> `reading` -> `speaking` -> `writing` -> `evaluation` -> `result`
 * 3. Minimal Clean Persistence:
 *    - Only persists pure state (answers, completed sections, scores, timestamps).
 *    - NEVER persists DOM elements, Audio objects, MediaStream, or SpeechRecognition instances.
 * 4. Continuity & Resume:
 *    - In-progress attempts can be saved & resumed.
 *    - Completed Always Wins: finalized attempts immediately supersede stale resume activities.
 *    - Finalized attempts never resurrect in Continue Learning.
 * 5. Truthful Progress:
 *    - Reflects discrete section progress (e.g. 2 / 4 sections completed).
 *    - Zero fake progress percentages.
 */

import type {
  CefrLevel,
  CefrSkill,
  CertificationEvaluationResult,
  PersistedLevelCertification,
} from '../types/levelCertification';
import {
  CEFR_LEVELS_ORDER,
  CEFR_SKILLS_LIST,
} from '../types/levelCertification';
import type {
  CheckpointResumableActivity,
  ResumableActivity,
} from '../types/learningContinuity';
import { CONTINUITY_SCHEMA_VERSION } from '../types/learningContinuity';
import type { SessionProgressMetric } from '../types/sessionExperience';
import {
  evaluateCheckpointCertification,
  generateCertificateId,
  CENTRAL_CERTIFICATION_POLICY,
  CentralCertificationPolicyConfig,
  sanitizeScore,
} from './levelCertificationService';
import { isActivityStale } from './learningContinuityService';

// =========================================================================
// 1. LIFECYCLE TYPES & CONSTANTS
// =========================================================================

export type CheckpointSessionStage =
  | 'intro'
  | 'listening'
  | 'reading'
  | 'speaking'
  | 'writing'
  | 'evaluation'
  | 'result';

export const CHECKPOINT_SKILL_SEQUENCE: readonly CefrSkill[] = [
  'listening',
  'reading',
  'speaking',
  'writing',
] as const;

/**
 * Safe serializable user answers.
 * Zero references to DOM, Audio, MediaStream, or SpeechRecognition.
 */
export interface CheckpointSectionAnswers {
  listening: Record<string, number>; // questionId -> selectedOptionIndex
  reading: Record<string, number>;    // questionId -> selectedOptionIndex
  speaking: Record<number, string>;    // turnIndex -> user transcript
  writing: string;                     // draft essay text
}

/**
 * Pure session state for an active Checkpoint attempt.
 */
export interface CheckpointSessionState {
  attemptId: string;
  level: CefrLevel;
  stage: CheckpointSessionStage;
  currentSection: CefrSkill;
  completedSections: CefrSkill[];
  answers: CheckpointSectionAnswers;
  sectionScores: Partial<Record<CefrSkill, number>>;
  evaluationResult?: CertificationEvaluationResult;
  startedAt: number;
  lastActiveAt: number;
  completedAt?: number;
  isPaused: boolean;
  timeLeftSeconds?: number;
  listeningAudioPlayCount?: number;
}

/**
 * Result of finalizing a checkpoint attempt.
 */
export interface CheckpointFinalizeResult {
  success: boolean;
  alreadyFinalized?: boolean;
  state: CheckpointSessionState;
  evaluation: CertificationEvaluationResult;
  certificate?: PersistedLevelCertification;
  error?: string;
}

// =========================================================================
// 2. ATTEMPT IDENTITY & IDEMPOTENCY GUARD
// =========================================================================

/**
 * In-memory registry of finalized attempt IDs to enforce strict idempotency.
 * Prevents double evaluation from repeated button clicks, callbacks, or cloud replay.
 */
const finalizedCheckpointAttempts = new Map<string, CertificationEvaluationResult>();

/**
 * Generates a stable unique Attempt ID adhering to pattern:
 * `cefr:<level>:chk_<timestamp>_<entropy>`
 */
export function createCheckpointAttemptId(
  level: CefrLevel,
  now = Date.now(),
  entropy?: string
): string {
  const safeEntropy = (entropy && entropy.trim()) || Math.random().toString(36).substring(2, 8);
  return `cefr:${level}:chk_${now}_${safeEntropy}`;
}

/**
 * Validates and parses a Checkpoint Attempt ID.
 */
export function parseCheckpointAttemptId(attemptId: string): { level: CefrLevel; timestamp: number } | null {
  if (!attemptId || typeof attemptId !== 'string') return null;
  const parts = attemptId.split(':');
  if (parts.length !== 3 || parts[0] !== 'cefr') return null;

  const levelCandidate = parts[1] as CefrLevel;
  if (!CEFR_LEVELS_ORDER.includes(levelCandidate)) return null;

  const chkPart = parts[2];
  if (!chkPart.startsWith('chk_')) return null;

  const subParts = chkPart.split('_');
  if (subParts.length < 3) return null;

  const timestamp = Number(subParts[1]);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;

  return {
    level: levelCandidate,
    timestamp,
  };
}

/**
 * Checks whether an attempt ID has already been finalized.
 */
export function isAttemptFinalized(attemptId: string): boolean {
  if (!attemptId) return false;
  return finalizedCheckpointAttempts.has(attemptId);
}

/**
 * Marks an attempt as finalized in the in-memory registry.
 */
export function markAttemptFinalized(
  attemptId: string,
  evaluation: CertificationEvaluationResult
): void {
  if (!attemptId) return;
  finalizedCheckpointAttempts.set(attemptId, evaluation);
}

/**
 * Retrieves the cached evaluation result for a finalized attempt.
 */
export function getFinalizedEvaluation(attemptId: string): CertificationEvaluationResult | null {
  if (!attemptId) return null;
  return finalizedCheckpointAttempts.get(attemptId) || null;
}

/**
 * Resets the finalized registry (useful for testing and session resets).
 */
export function resetFinalizedAttempts(): void {
  finalizedCheckpointAttempts.clear();
}

// =========================================================================
// 3. PURE LIFECYCLE STATE FACTORY & TRANSITIONS
// =========================================================================

/**
 * Creates the initial clean state for a new Checkpoint Attempt.
 */
export function createInitialCheckpointState(
  level: CefrLevel,
  now = Date.now(),
  entropy?: string
): CheckpointSessionState {
  return {
    attemptId: createCheckpointAttemptId(level, now, entropy),
    level,
    stage: 'intro',
    currentSection: 'listening',
    completedSections: [],
    answers: {
      listening: {},
      reading: {},
      speaking: {},
      writing: '',
    },
    sectionScores: {},
    startedAt: now,
    lastActiveAt: now,
    isPaused: false,
    listeningAudioPlayCount: 0,
  };
}

/**
 * Transitions from 'intro' to the active exam session.
 */
export function startCheckpointSession(
  state: CheckpointSessionState,
  now = Date.now()
): CheckpointSessionState {
  if (state.stage !== 'intro') {
    return state;
  }

  // Determine starting section based on what has already been completed
  const nextSection = CHECKPOINT_SKILL_SEQUENCE.find(
    (skill) => !state.completedSections.includes(skill)
  ) || 'listening';

  return {
    ...state,
    stage: nextSection as CheckpointSessionStage,
    currentSection: nextSection,
    lastActiveAt: now,
  };
}

/**
 * Saves user progress / draft answers for the current active section.
 * Safe pure update: never touches DOM or audio streams.
 */
export function saveSectionDraft(
  state: CheckpointSessionState,
  updates: Partial<CheckpointSectionAnswers>,
  now = Date.now()
): CheckpointSessionState {
  return {
    ...state,
    answers: {
      listening: updates.listening ? { ...state.answers.listening, ...updates.listening } : state.answers.listening,
      reading: updates.reading ? { ...state.answers.reading, ...updates.reading } : state.answers.reading,
      speaking: updates.speaking ? { ...state.answers.speaking, ...updates.speaking } : state.answers.speaking,
      writing: typeof updates.writing === 'string' ? updates.writing : state.answers.writing,
    },
    lastActiveAt: now,
  };
}

/**
 * Completes the current section, records intermediate score if available,
 * and advances to the next section or to evaluation.
 */
export function advanceToNextSection(
  state: CheckpointSessionState,
  sectionScore?: number,
  now = Date.now()
): CheckpointSessionState {
  const currentSkill = state.currentSection;
  const completedSections = state.completedSections.includes(currentSkill)
    ? state.completedSections
    : [...state.completedSections, currentSkill];

  const sectionScores = { ...state.sectionScores };
  if (typeof sectionScore === 'number' && Number.isFinite(sectionScore)) {
    sectionScores[currentSkill] = sanitizeScore(sectionScore);
  }

  // Find next uncompleted skill in sequence
  const nextSkill = CHECKPOINT_SKILL_SEQUENCE.find(
    (skill) => !completedSections.includes(skill)
  );

  if (!nextSkill) {
    // All 4 sections completed -> move to evaluation stage
    return {
      ...state,
      stage: 'evaluation',
      completedSections,
      sectionScores,
      lastActiveAt: now,
    };
  }

  return {
    ...state,
    stage: nextSkill as CheckpointSessionStage,
    currentSection: nextSkill,
    completedSections,
    sectionScores,
    lastActiveAt: now,
  };
}

/**
 * Finalizes the checkpoint attempt and computes official CEFR Certification evaluation.
 *
 * Invariants enforced:
 * 1. Idempotency: Duplicate calls return the original evaluation without re-evaluating.
 * 2. Floor requirement: All 4 skills evaluated; weak skills cannot be masked.
 * 3. Completed state: transitions stage to 'result' and marks attempt finalized.
 */
export function finalizeCheckpointAttempt(
  state: CheckpointSessionState,
  policy: CentralCertificationPolicyConfig = CENTRAL_CERTIFICATION_POLICY,
  now = Date.now()
): CheckpointFinalizeResult {
  // 1. Idempotency Guard: Double click / duplicate callback protection
  if (isAttemptFinalized(state.attemptId)) {
    const cachedEval = getFinalizedEvaluation(state.attemptId)!;
    return {
      success: true,
      alreadyFinalized: true,
      state: {
        ...state,
        stage: 'result',
        evaluationResult: cachedEval,
        completedAt: state.completedAt || now,
        lastActiveAt: now,
      },
      evaluation: cachedEval,
      certificate: cachedEval.isPassed
        ? {
            level: state.level,
            certificateId: cachedEval.certificateId,
            certifiedAt: cachedEval.certifiedAt,
            overallScore: cachedEval.overallScore,
            skillScores: {
              listening: cachedEval.skillResults.listening.score,
              reading: cachedEval.skillResults.reading.score,
              speaking: cachedEval.skillResults.speaking.score,
              writing: cachedEval.skillResults.writing.score,
            },
            attemptId: state.attemptId,
            verifiedVersion: policy.policyVersion,
            criteriaSummary: {
              overallRequired: cachedEval.requiredOverall,
              overallAchieved: cachedEval.overallScore,
              floorRequired: policy.levels[state.level].perSkillFloorThreshold,
              minSkillAchieved: Math.min(
                ...CEFR_SKILLS_LIST.map((s) => cachedEval.skillResults[s].score)
              ),
              verifiedVersion: policy.policyVersion,
            },
          }
        : undefined,
    };
  }

  // 2. Prepare scores for all 4 skills
  const skillScores: Record<CefrSkill, number> = {
    listening: state.sectionScores.listening ?? 0,
    reading: state.sectionScores.reading ?? 0,
    speaking: state.sectionScores.speaking ?? 0,
    writing: state.sectionScores.writing ?? 0,
  };

  // 3. Evaluate official certification outcome
  const evaluation = evaluateCheckpointCertification(
    {
      level: state.level,
      skillScores,
      attemptId: state.attemptId,
      nowMs: now,
    },
    policy
  );

  // 4. Register finalization in idempotency cache
  markAttemptFinalized(state.attemptId, evaluation);

  // 5. Build Certificate if passed
  let certificate: PersistedLevelCertification | undefined = undefined;
  if (evaluation.isPassed) {
    certificate = {
      level: state.level,
      certificateId: evaluation.certificateId || generateCertificateId(state.level, now),
      certifiedAt: now,
      overallScore: evaluation.overallScore,
      skillScores,
      attemptId: state.attemptId,
      verifiedVersion: policy.policyVersion,
      criteriaSummary: {
        overallRequired: evaluation.requiredOverall,
        overallAchieved: evaluation.overallScore,
        floorRequired: policy.levels[state.level].perSkillFloorThreshold,
        minSkillAchieved: Math.min(
          ...CEFR_SKILLS_LIST.map((s) => evaluation.skillResults[s].score)
        ),
        verifiedVersion: policy.policyVersion,
      },
    };
  }

  const finalState: CheckpointSessionState = {
    ...state,
    stage: 'result',
    evaluationResult: evaluation,
    completedAt: now,
    lastActiveAt: now,
  };

  return {
    success: true,
    alreadyFinalized: false,
    state: finalState,
    evaluation,
    certificate,
  };
}

// =========================================================================
// 4. LEARNING CONTINUITY BRIDGE (RESUME & COMPLETED-ALWAYS-WINS)
// =========================================================================

/**
 * Transforms an active Checkpoint state into a valid ResumableActivity.
 * Safe serialization: contains only plain records, zero DOM or audio instances.
 */
export function checkpointStateToResumableActivity(
  state: CheckpointSessionState,
  title?: string,
  now = Date.now()
): CheckpointResumableActivity {
  const isCompleted = state.stage === 'result' || isAttemptFinalized(state.attemptId);

  return {
    id: state.attemptId,
    type: 'checkpoint',
    title: title || `CEFR ${state.level} Checkpoint Exam`,
    subtitle: `Tiến độ: ${state.completedSections.length}/4 kỹ năng đã hoàn thành`,
    startedAt: state.startedAt,
    lastActiveAt: now,
    completed: isCompleted,
    completedAt: isCompleted ? (state.completedAt || now) : undefined,
    schemaVersion: CONTINUITY_SCHEMA_VERSION,
    checkpoint: {
      attemptId: state.attemptId,
      level: state.level,
      currentSection: state.currentSection,
      completedSections: [...state.completedSections],
      listeningAnswers: { ...state.answers.listening },
      readingAnswers: { ...state.answers.reading },
      speakingTranscripts: { ...state.answers.speaking },
      writingDraft: state.answers.writing,
      sectionScores: { ...state.sectionScores },
      timeLeftSeconds: state.timeLeftSeconds,
      progressPercent: Math.round((state.completedSections.length / 4) * 100),
      listeningAudioPlayCount: state.listeningAudioPlayCount ?? 0,
    },
  };
}

/**
 * Restores a CheckpointSessionState from a stored ResumableActivity.
 *
 * Invariant: Completed Always Wins!
 * If the activity is completed, or already finalized, returns null.
 */
export function restoreCheckpointStateFromActivity(
  activity: ResumableActivity | null | undefined,
  now = Date.now()
): CheckpointSessionState | null {
  if (!activity || activity.type !== 'checkpoint') return null;

  // Invariant: Completed Always Wins!
  if (activity.completed || isAttemptFinalized(activity.checkpoint.attemptId)) {
    return null;
  }

  // Invariant: Stale Checkpoints should not be resumed
  if (isActivityStale(activity, now)) {
    return null;
  }

  const cp = activity.checkpoint;
  const levelCandidate = cp.level as CefrLevel;
  if (!CEFR_LEVELS_ORDER.includes(levelCandidate)) return null;

  const validSkills = new Set<CefrSkill>(['listening', 'reading', 'speaking', 'writing']);
  const completedSections = (cp.completedSections || []).filter((s): s is CefrSkill => validSkills.has(s as CefrSkill));

  // Determine stage based on completed sections
  let stage: CheckpointSessionStage;
  if (completedSections.length === 4) {
    stage = 'evaluation';
  } else if (validSkills.has(cp.currentSection as CefrSkill)) {
    stage = cp.currentSection as CheckpointSessionStage;
  } else {
    stage = 'listening';
  }

  return {
    attemptId: cp.attemptId,
    level: levelCandidate,
    stage,
    currentSection: (validSkills.has(cp.currentSection as CefrSkill) ? cp.currentSection : 'listening') as CefrSkill,
    completedSections,
    answers: {
      listening: cp.listeningAnswers ? { ...cp.listeningAnswers } : {},
      reading: cp.readingAnswers ? { ...cp.readingAnswers } : {},
      speaking: cp.speakingTranscripts ? { ...cp.speakingTranscripts } : {},
      writing: cp.writingDraft || '',
    },
    sectionScores: cp.sectionScores ? { ...cp.sectionScores } : {},
    startedAt: activity.startedAt,
    lastActiveAt: now,
    isPaused: false,
    timeLeftSeconds: cp.timeLeftSeconds,
    listeningAudioPlayCount: cp.listeningAudioPlayCount ?? 0,
  };
}

/**
 * Searches stored resume activities for an active in-progress checkpoint for a specific CEFR level.
 */
export function findResumableCheckpointForLevel(
  resumeActivities: Record<string, ResumableActivity> | undefined,
  level: CefrLevel,
  now = Date.now()
): CheckpointResumableActivity | null {
  if (!resumeActivities || typeof resumeActivities !== 'object') return null;

  for (const act of Object.values(resumeActivities)) {
    if (
      act &&
      act.type === 'checkpoint' &&
      act.checkpoint?.level === level &&
      !act.completed &&
      !isAttemptFinalized(act.checkpoint.attemptId) &&
      !isActivityStale(act, now)
    ) {
      return act;
    }
  }

  return null;
}

// =========================================================================
// 5. TRUTHFUL PROGRESS METRIC DERIVATION
// =========================================================================

/**
 * Derives a truthful discrete progress metric for SessionProgressHeader.
 * Invariant: Displays discrete `2 / 4 sections completed`, zero fake progress percentages.
 */
export function buildCheckpointProgressMetric(
  state: CheckpointSessionState
): SessionProgressMetric {
  const currentSkillIndex = Math.max(
    0,
    CHECKPOINT_SKILL_SEQUENCE.indexOf(state.currentSection)
  );

  return {
    kind: 'discrete_items',
    currentIndex: currentSkillIndex,
    totalItems: 4,
    answeredCount: state.completedSections.length,
    remainingCount: Math.max(0, 4 - state.completedSections.length),
    progressPercent: Math.round((state.completedSections.length / 4) * 100),
    counterFormat: 'answered',
  };
}

/**
 * Derives a stage pipeline progress metric for visual multi-step progress.
 */
export function buildCheckpointStagePipelineMetric(
  state: CheckpointSessionState
): SessionProgressMetric {
  return {
    kind: 'stage_pipeline',
    currentStageId: state.currentSection,
    stages: [
      { id: 'listening', label: 'Listening' },
      { id: 'reading', label: 'Reading' },
      { id: 'speaking', label: 'Speaking' },
      { id: 'writing', label: 'Writing' },
    ],
    progressPercent: Math.round((state.completedSections.length / 4) * 100),
  };
}
