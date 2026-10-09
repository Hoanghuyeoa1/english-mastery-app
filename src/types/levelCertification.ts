// src/types/levelCertification.ts
/**
 * CEFR Level Certification & Checkpoint Contracts (Phase 2)
 *
 * Invariants:
 * - Pure domain contracts: NO React or UI dependencies.
 * - Discriminated unions prioritized for all result & status models.
 * - Strict type safety: ZERO `any` or loose `Record<string, any>`.
 * - Separation of concerns:
 *     journeyStatus ('available' | 'in_progress' | 'completed')
 *     != certificationStatus ('unattempted' | 'in_progress' | 'ready' | 'certified' | 'failed')
 *     != readinessStatus ('not_ready' | 'ready_for_checkpoint' | 'already_certified')
 * - Free Exploration: A learner who is not certified at A1 can still explore A2-C2.
 * - Readiness != Certification: Readiness only indicates eligibility to attempt the checkpoint.
 */

import type { CEFRLevel } from './cefr';
import type { CompetencySkill } from './competencyEvidence';

export type CefrLevel = CEFRLevel;
export type CefrSkill = CompetencySkill;

export const CEFR_LEVELS_ORDER: readonly CefrLevel[] = [
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
] as const;

export const CEFR_SKILLS_LIST: readonly CefrSkill[] = [
  'listening',
  'reading',
  'speaking',
  'writing',
] as const;

/**
 * Lifecycle status of an individual CEFR level certification.
 * Strictly separate from JourneyLevelStatus ('available' | 'in_progress' | 'completed').
 */
export type LevelCertificationStatus =
  | 'unattempted' // Never attempted checkpoint for this level
  | 'in_progress' // Checkpoint exam currently in progress
  | 'ready' // Eligible & ready to take checkpoint exam
  | 'certified' // Successfully certified with verified evidence
  | 'failed'; // Attempted but did not meet criteria (can retake after cooldown)

/**
 * Derived readiness status for taking a Level Checkpoint Exam.
 * Readiness != Certification!
 */
export type LevelReadinessStatus =
  | 'not_ready'
  | 'ready_for_checkpoint'
  | 'already_certified';

/**
 * Status of a specific checkpoint exam attempt session.
 */
export type CheckpointAttemptStatus =
  | 'in_progress'
  | 'submitted'
  | 'evaluated'
  | 'abandoned'
  | 'expired';

/**
 * Skill assessment outcome within a checkpoint attempt or competency evaluation.
 */
export interface SkillAssessmentResult {
  skill: CefrSkill;
  score: number; // 0 - 100 normalized score
  passedFloor: boolean;
  requiredFloor: number;
  rawEvidenceCount: number;
  confidence: number; // 0.0 - 1.0
  feedback?: string;
}

/**
 * Checkpoint attempt snapshot metadata.
 */
export interface CheckpointAttempt {
  id: string; // e.g. "chk_a1_1712345678_abcd"
  level: CefrLevel;
  startedAt: number; // Unix epoch ms
  completedAt?: number;
  status: CheckpointAttemptStatus;
  skillResults?: Partial<Record<CefrSkill, SkillAssessmentResult>>;
  overallScore?: number;
  isPassed?: boolean;
}

/**
 * Criteria verification summary embedded into permanent certificate records.
 */
export interface CertificateCriteriaSummary {
  overallRequired: number;
  overallAchieved: number;
  floorRequired: number;
  minSkillAchieved: number;
  verifiedVersion: string;
}

/**
 * Persisted CEFR Level Certification Record.
 * Permanent evidence that a learner has officially passed the checkpoint.
 */
export interface PersistedLevelCertification {
  level: CefrLevel;
  certificateId: string; // e.g. "CERT-A1-2026-X7K9"
  certifiedAt: number; // Unix epoch ms
  overallScore: number; // 0 - 100
  skillScores: Record<CefrSkill, number>;
  attemptId: string;
  verifiedVersion: string;
  criteriaSummary: CertificateCriteriaSummary;
}

/**
 * Zustand store representation of persisted certifications.
 * Keyed by CEFR Level.
 */
export type LevelCertificationStore = Partial<Record<CefrLevel, PersistedLevelCertification>>;

export const CERTIFICATION_SCHEMA_VERSION = 1;

export type CertificationDecision = 'certified' | 'needs_reinforcement';

export interface CertificationEvaluationBase {
  level: CefrLevel;
  attemptId: string;
  overallScore: number;
  requiredOverall: number;
  skillResults: Record<CefrSkill, SkillAssessmentResult>;
  policyVersion: string;
  schemaVersion: number;
  assessedAt: number;
}

/**
 * Discriminated union for Checkpoint Certification evaluation result.
 */
export interface CertificationEvaluationPassed extends CertificationEvaluationBase {
  result: 'certified';
  isPassed: true;
  certificateId: string;
  certifiedAt: number;
  reason: string;
}

export interface CheckpointReinforcementRoute {
  skill: CefrSkill;
  level: CefrLevel;
  routeTab: 'four_skills';
  activeSkill: CefrSkill;
  title: string;
  description: string;
  reason: string;
  sampleLessonOrPromptId?: string;
  currentScore: number;
  requiredFloor: number;
}

export interface CertificationEvaluationFailed extends CertificationEvaluationBase {
  result: 'needs_reinforcement';
  isPassed: false;
  failingReasons: string[];
  canRetake: boolean;
  retakeAvailableAt?: number;
  reinforcementRoutes?: CheckpointReinforcementRoute[];
}

export type CertificationEvaluationResult =
  | CertificationEvaluationPassed
  | CertificationEvaluationFailed;

/**
 * Storage-efficient immutable history record for a completed Checkpoint Attempt.
 * Bounded to prevent localStorage bloat.
 */
export interface CheckpointHistoryEntry {
  attemptId: string;
  level: CefrLevel;
  date: number; // Unix epoch ms (assessedAt)
  result: CertificationDecision;
  isPassed: boolean;
  overallScore: number;
  scores: Record<CefrSkill, number>;
  policyVersion: string;
  schemaVersion: number;
  certificateId?: string;
}

/**
 * Readiness breakdown for a single skill within a CEFR level.
 */
export interface SkillReadinessBreakdown {
  skill: CefrSkill;
  isReady: boolean;
  hasSufficientEvidence: boolean;
  hasSufficientConfidence: boolean;
  hasSufficientExposure: boolean;
  evidenceCount: number;
  requiredEvidenceCount: number;
  completedLessonCount: number;
  requiredLessonCount: number;
  currentScore: number;
  confidence: number;
  missingReasons: string[];
}

/**
 * Overall readiness evaluation for a CEFR level.
 */
export interface LevelReadinessEvaluation {
  level: CefrLevel;
  status: LevelReadinessStatus;
  isReadyForCheckpoint: boolean;
  overallReadinessPercent: number; // 0 - 100 integer
  skills: Record<CefrSkill, SkillReadinessBreakdown>;
  blockingReasons: string[];
  actionableAdvice: string;
  alreadyCertified: boolean;
  certificationRecord?: PersistedLevelCertification | null;
}
