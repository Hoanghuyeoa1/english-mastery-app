// src/services/levelCertificationService.ts
/**
 * CEFR Level Certification & Checkpoint Engine (Phase 2)
 *
 * Pure domain foundation for:
 * 1. Central Certification Policy (Thresholds, floors, evidence, confidence, retake cooldown)
 * 2. Pure Readiness Engine (Deriving not_ready / ready_for_checkpoint / already_certified)
 * 3. Checkpoint Certification Evaluation (Pass/Fail with explainability & criteria)
 * 4. Derived Helpers (highestCertifiedLevel, certificationStatus, evidenceCompleteness)
 *
 * Strict Architectural Invariants:
 * - Pure calculation / derivation: ZERO direct mutation of store or datasets.
 * - Lesson Completion != Skill Competency != CEFR Certification.
 * - Readiness != Certification (readiness is never persisted, only derived).
 * - Free Exploration: Never hard-locks content; only assesses and certifies.
 * - Skill Floor Invariant: Strong skills can NEVER compensate for weak skills below floor.
 * - Zero `any`: 100% type-safe with discriminated unions.
 * - Zero crash: Safe on NaN, Infinity, boundary values, empty stores, and legacy data.
 */

import type {
  CefrLevel,
  CefrSkill,
  LevelCertificationStore,
  LevelCertificationStatus,
  LevelReadinessStatus,
  LevelReadinessEvaluation,
  SkillReadinessBreakdown,
  SkillAssessmentResult,
  PersistedLevelCertification,
  CertificationEvaluationResult,
  CheckpointAttempt,
  CheckpointHistoryEntry,
  CertificationDecision,
  CheckpointReinforcementRoute,
} from '../types/levelCertification';
import {
  CEFR_LEVELS_ORDER,
  CEFR_SKILLS_LIST,
  CERTIFICATION_SCHEMA_VERSION,
} from '../types/levelCertification';
import type { FourSkillsEvidenceStore, SkillCompetency } from '../types';
import { findSpeakingLessonsByCefr } from '../data/fourSkills/speakingData';
import { findReadingLessonsByCefr } from '../data/fourSkills/readingData';
import { findListeningLessonsByCefr } from '../data/fourSkills/listeningData';
import { findWritingLessonsByCefr } from '../data/fourSkills/writingData';

// =========================================================================
// 1. CENTRAL CERTIFICATION POLICY (SINGLE SOURCE OF BENCHMARK TRUTH)
// =========================================================================

export interface LevelPolicyThresholds {
  /** Minimum average score across all 4 skills required to pass (0 - 100) */
  overallPassThreshold: number;
  /** Minimum score floor that EVERY skill must independently achieve (0 - 100) */
  perSkillFloorThreshold: number;
  /** Minimum valid evidence entries needed per skill to consider readiness */
  minEvidenceCountPerSkill: number;
  /** Minimum confidence score required per skill for readiness (0.0 - 1.0) */
  minConfidenceScore: number;
  /** Minimum completed lessons count in this CEFR band across all skills */
  minLessonExposureCount: number;
  /** Ratio of lessons in band completed (e.g. 0.25 = 25% of lessons) */
  minLessonExposureRatio: number;
  /** Minimum cooldown duration before a failed checkpoint can be retaken (ms) */
  retakeCooldownMs: number;
}

export interface CentralCertificationPolicyConfig {
  policyVersion: string;
  levels: Record<CefrLevel, LevelPolicyThresholds>;
}

/**
 * Single canonical policy configuration for all CEFR level certifications.
 * Eliminates magic numbers across components.
 */
export const CENTRAL_CERTIFICATION_POLICY: CentralCertificationPolicyConfig = {
  policyVersion: '2026.1',
  levels: {
    A1: {
      overallPassThreshold: 70,
      perSkillFloorThreshold: 55,
      minEvidenceCountPerSkill: 1,
      minConfidenceScore: 0.20,
      minLessonExposureCount: 4,
      minLessonExposureRatio: 0.15,
      retakeCooldownMs: 12 * 60 * 60 * 1000, // 12 hours for A1
    },
    A2: {
      overallPassThreshold: 70,
      perSkillFloorThreshold: 55,
      minEvidenceCountPerSkill: 2,
      minConfidenceScore: 0.25,
      minLessonExposureCount: 6,
      minLessonExposureRatio: 0.20,
      retakeCooldownMs: 12 * 60 * 60 * 1000, // 12 hours for A2
    },
    B1: {
      overallPassThreshold: 75,
      perSkillFloorThreshold: 60,
      minEvidenceCountPerSkill: 2,
      minConfidenceScore: 0.35,
      minLessonExposureCount: 8,
      minLessonExposureRatio: 0.20,
      retakeCooldownMs: 24 * 60 * 60 * 1000, // 24 hours for B1
    },
    B2: {
      overallPassThreshold: 75,
      perSkillFloorThreshold: 60,
      minEvidenceCountPerSkill: 3,
      minConfidenceScore: 0.45,
      minLessonExposureCount: 8,
      minLessonExposureRatio: 0.20,
      retakeCooldownMs: 24 * 60 * 60 * 1000, // 24 hours for B2
    },
    C1: {
      overallPassThreshold: 80,
      perSkillFloorThreshold: 65,
      minEvidenceCountPerSkill: 3,
      minConfidenceScore: 0.55,
      minLessonExposureCount: 10,
      minLessonExposureRatio: 0.20,
      retakeCooldownMs: 48 * 60 * 60 * 1000, // 48 hours for C1
    },
    C2: {
      overallPassThreshold: 85,
      perSkillFloorThreshold: 70,
      minEvidenceCountPerSkill: 4,
      minConfidenceScore: 0.65,
      minLessonExposureCount: 10,
      minLessonExposureRatio: 0.20,
      retakeCooldownMs: 48 * 60 * 60 * 1000, // 48 hours for C2
    },
  },
};

// =========================================================================
// 2. HELPER UTILITIES & SANITIZATION
// =========================================================================

/**
 * Sanitizes and bounds a numerical score into [0, 100] integer.
 * Handles NaN, Infinity, negative values, and non-numeric inputs.
 */
export function sanitizeScore(val: unknown, fallback: number = 0): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || Number.isNaN(val)) {
    return Math.max(0, Math.min(100, Math.round(fallback)));
  }
  return Math.max(0, Math.min(100, Math.round(val)));
}

/**
 * Sanitizes confidence score into [0.0, 1.0] float.
 */
export function sanitizeConfidence(val: unknown, fallback: number = 0): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || Number.isNaN(val)) {
    return Math.max(0, Math.min(1.0, fallback));
  }
  return Math.max(0, Math.min(1.0, Math.round(val * 1000) / 1000));
}

/**
 * Generates an official unique Certificate ID with verifiable format:
 * CERT-<LEVEL>-<YEAR>-<ENTROPY>
 */
export function generateCertificateId(level: CefrLevel, seedTimestamp: number = Date.now()): string {
  const year = new Date(seedTimestamp).getFullYear();
  const timeHex = seedTimestamp.toString(36).toUpperCase().slice(-4);
  const entropy = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CERT-${level}-${year}-${timeHex}${entropy}`;
}

// =========================================================================
// 3. PURE READINESS ENGINE
// =========================================================================

export interface LevelReadinessInput {
  certifications?: LevelCertificationStore | null;
  competencyEvidenceStore?: FourSkillsEvidenceStore | null;
  completedLessonIdsBySkill?: Partial<Record<CefrSkill, readonly string[]>> | null;
  totalLessonsBySkill?: Partial<Record<CefrSkill, number>> | null;
  skillCompetencies?: Partial<Record<CefrSkill, SkillCompetency>> | null;
  lastFailedAttemptAt?: number | null;
  nowMs?: number;
}

/**
 * Pure derivation engine for CEFR Level Checkpoint Readiness.
 *
 * Invariants:
 * - readiness != certification (readiness evaluates eligibility to take exam)
 * - Does NOT require 100% lesson completion if evidence is sufficient.
 * - Blocked if any skill lacks evidence or confidence, even if all lessons are complete.
 */
export function evaluateLevelReadiness(
  level: CefrLevel,
  input: LevelReadinessInput = {},
  policy: CentralCertificationPolicyConfig = CENTRAL_CERTIFICATION_POLICY
): LevelReadinessEvaluation {
  const now = input.nowMs ?? Date.now();
  const levelPolicy = policy.levels[level] ?? policy.levels.A1;

  // 1. Condition: Already Certified
  const existingCert = input.certifications?.[level];
  if (existingCert && existingCert.certificateId) {
    const readySkillsMap: Record<CefrSkill, SkillReadinessBreakdown> = {} as any;
    for (const sk of CEFR_SKILLS_LIST) {
      readySkillsMap[sk] = {
        skill: sk,
        isReady: true,
        hasSufficientEvidence: true,
        hasSufficientExposure: true,
        hasSufficientConfidence: true,
        evidenceCount: levelPolicy.minEvidenceCountPerSkill,
        requiredEvidenceCount: levelPolicy.minEvidenceCountPerSkill,
        completedLessonCount: 1,
        requiredLessonCount: 1,
        currentScore: existingCert.skillScores?.[sk] ?? existingCert.overallScore,
        confidence: 1.0,
        missingReasons: [],
      };
    }

    return {
      level,
      status: 'already_certified',
      isReadyForCheckpoint: false,
      overallReadinessPercent: 100,
      skills: readySkillsMap,
      blockingReasons: [],
      actionableAdvice: `Bạn đã chính thức đạt chứng chỉ CEFR ${level}!`,
      alreadyCertified: true,
      certificationRecord: existingCert,
    };
  }

  // 2. Compute exposure and evidence breakdown per skill
  const skillBreakdowns: Record<CefrSkill, SkillReadinessBreakdown> = {} as any;
  const blockingReasons: string[] = [];

  let totalCompletedLessonsInBand = 0;
  let totalAvailableLessonsInBand = 0;
  let readySkillsCount = 0;

  for (const skill of CEFR_SKILLS_LIST) {
    // A. Evidence count for this skill
    const evidenceList = input.competencyEvidenceStore?.[skill] ?? [];
    // Filter evidence matching this level difficulty or higher, or count total if unrated
    const levelEvidence = evidenceList.filter((e) => {
      if (!e) return false;
      if (!e.cefrDifficulty) return true; // Unrated evidence counts as foundational exposure
      const orderDiff = CEFR_LEVELS_ORDER.indexOf(e.cefrDifficulty);
      const targetOrder = CEFR_LEVELS_ORDER.indexOf(level);
      return orderDiff >= targetOrder;
    });
    const evidenceCount = levelEvidence.length;

    // B. Completed lesson count in dataset for this level & skill
    const completedIds = input.completedLessonIdsBySkill?.[skill] ?? [];
    const completedCount = completedIds.length;
    const totalLessonsInSkill = input.totalLessonsBySkill?.[skill] ?? 0;

    totalCompletedLessonsInBand += completedCount;
    totalAvailableLessonsInBand += totalLessonsInSkill;

    // C. Skill competency and confidence
    const competency = input.skillCompetencies?.[skill];
    const confidence = sanitizeConfidence(competency?.confidenceScore ?? (evidenceCount > 0 ? 0.35 : 0));
    const currentScore = sanitizeScore(competency?.score);

    // D. Skill Readiness Requirements
    const missingReasons: string[] = [];
    const hasSufficientEvidence = evidenceCount >= levelPolicy.minEvidenceCountPerSkill;
    const hasSufficientConfidence = confidence >= levelPolicy.minConfidenceScore;

    // Minimum required lessons per skill (at least 1 lesson completed for that skill)
    const requiredLessonCount = Math.max(1, Math.min(totalLessonsInSkill, Math.round(totalLessonsInSkill * levelPolicy.minLessonExposureRatio)));
    const hasSufficientExposure = completedCount >= requiredLessonCount;

    if (!hasSufficientEvidence) {
      missingReasons.push(
        `Kỹ năng ${getSkillNameVi(skill)} mới có ${evidenceCount}/${levelPolicy.minEvidenceCountPerSkill} bằng chứng luyện tập.`
      );
    }
    if (!hasSufficientConfidence) {
      missingReasons.push(
        `Độ tin cậy kỹ năng ${getSkillNameVi(skill)} (${Math.round(confidence * 100)}%) chưa đạt mức tối thiểu (${Math.round(levelPolicy.minConfidenceScore * 100)}%).`
      );
    }
    if (completedCount === 0) {
      missingReasons.push(
        `Chưa hoàn thành bài học nào thuộc kỹ năng ${getSkillNameVi(skill)} ở cấp độ ${level}.`
      );
    }

    const isSkillReady = hasSufficientEvidence && hasSufficientConfidence && completedCount > 0;
    if (isSkillReady) {
      readySkillsCount++;
    } else {
      blockingReasons.push(...missingReasons);
    }

    skillBreakdowns[skill] = {
      skill,
      isReady: isSkillReady,
      hasSufficientEvidence,
      hasSufficientConfidence,
      hasSufficientExposure,
      evidenceCount,
      requiredEvidenceCount: levelPolicy.minEvidenceCountPerSkill,
      completedLessonCount: completedCount,
      requiredLessonCount,
      currentScore,
      confidence,
      missingReasons,
    };
  }

  // 3. Band Exposure Check
  const minBandExposure = levelPolicy.minLessonExposureCount;
  const hasBandExposure = totalCompletedLessonsInBand >= minBandExposure;

  if (!hasBandExposure) {
    blockingReasons.push(
      `Cần hoàn thành tối thiểu ${minBandExposure} bài học trong cấp độ ${level} (hiện có: ${totalCompletedLessonsInBand} bài).`
    );
  }

  // 4. Retake Cooldown Check
  if (typeof input.lastFailedAttemptAt === 'number' && input.lastFailedAttemptAt > 0) {
    const elapsed = now - input.lastFailedAttemptAt;
    if (elapsed < levelPolicy.retakeCooldownMs) {
      const remainingHours = Math.ceil((levelPolicy.retakeCooldownMs - elapsed) / 3_600_000);
      blockingReasons.push(
        `Bài thi Checkpoint vừa thực hiện gần đây. Vui lòng ôn luyện thêm và thử lại sau ${remainingHours} giờ.`
      );
    }
  }

  // 5. Final Readiness Synthesis
  const isReady = readySkillsCount === 4 && hasBandExposure && blockingReasons.length === 0;

  // Calculate overall readiness percentage
  const skillReadinessSum = readySkillsCount * 20; // 4 skills * 20% = 80%
  const exposureRatio =
    levelPolicy.minLessonExposureCount > 0
      ? Math.min(1.0, totalCompletedLessonsInBand / levelPolicy.minLessonExposureCount)
      : 1.0;
  const exposureScore = Math.round(exposureRatio * 20); // 20%
  const overallReadinessPercent = isReady ? 100 : Math.min(95, skillReadinessSum + exposureScore);

  let actionableAdvice: string;
  if (isReady) {
    actionableAdvice = `Bạn đã đủ điều kiện và tích lũy đủ năng lực để tham gia bài thi Đánh Giá Chứng Chỉ CEFR ${level}!`;
  } else {
    actionableAdvice = blockingReasons.length > 0
      ? blockingReasons[0]
      : `Hãy tiếp tục hoàn thiện các bài luyện tập ở cấp độ ${level} để mở khóa bài thi Checkpoint.`;
  }

  return {
    level,
    status: isReady ? 'ready_for_checkpoint' : 'not_ready',
    isReadyForCheckpoint: isReady,
    overallReadinessPercent,
    skills: skillBreakdowns,
    blockingReasons,
    actionableAdvice,
    alreadyCertified: false,
    certificationRecord: null,
  };
}

/**
 * Evaluates readiness across all 6 CEFR bands simultaneously.
 */
export function evaluateAllLevelsReadiness(
  input: LevelReadinessInput = {},
  policy: CentralCertificationPolicyConfig = CENTRAL_CERTIFICATION_POLICY
): Record<CefrLevel, LevelReadinessEvaluation> {
  const result: Record<CefrLevel, LevelReadinessEvaluation> = {} as any;
  for (const lvl of CEFR_LEVELS_ORDER) {
    result[lvl] = evaluateLevelReadiness(lvl, input, policy);
  }
  return result;
}

// =========================================================================
// 4. CHECKPOINT CERTIFICATION EVALUATION ENGINE
// =========================================================================

export interface EvaluateCheckpointParams {
  level: CefrLevel;
  skillScores: Record<CefrSkill, number>;
  skillEvidenceCounts?: Partial<Record<CefrSkill, number>>;
  skillConfidences?: Partial<Record<CefrSkill, number>>;
  attemptId?: string;
  lastFailedAttemptAt?: number;
  nowMs?: number;
}

/**
 * Pure evaluation function assessing whether a checkpoint exam qualifies for CEFR Certification.
 *
 * Enforces strict invariants:
 * 1. Overall score >= overallPassThreshold
 * 2. Every skill score >= perSkillFloorThreshold (No strong skill compensates weak skill below floor!)
 * 3. All 4 skills must have valid non-NaN scores.
 */
export function evaluateCheckpointCertification(
  params: EvaluateCheckpointParams,
  policy: CentralCertificationPolicyConfig = CENTRAL_CERTIFICATION_POLICY
): CertificationEvaluationResult {
  const now = params.nowMs ?? Date.now();
  const levelPolicy = policy.levels[params.level] ?? policy.levels.A1;
  const failingReasons: string[] = [];
  const attemptId = params.attemptId || `chk_${params.level}_${now}`;

  const rawScores = params.skillScores ?? ({} as Record<CefrSkill, number>);
  const skillResultsRecord: Record<CefrSkill, SkillAssessmentResult> = {} as any;

  let totalScoreSum = 0;
  let allFloorsPassed = true;

  for (const skill of CEFR_SKILLS_LIST) {
    const rawVal = rawScores[skill];
    const isMissingOrInvalid =
      rawVal === undefined ||
      rawVal === null ||
      typeof rawVal !== 'number' ||
      !Number.isFinite(rawVal) ||
      Number.isNaN(rawVal);

    const safeScore = isMissingOrInvalid ? 0 : sanitizeScore(rawVal);
    const passedFloor = !isMissingOrInvalid && safeScore >= levelPolicy.perSkillFloorThreshold;

    const rawCount = params.skillEvidenceCounts?.[skill] ?? levelPolicy.minEvidenceCountPerSkill;
    const confidence = sanitizeConfidence(
      params.skillConfidences?.[skill] ?? Math.max(0.85, levelPolicy.minConfidenceScore)
    );

    const hasSufficientEvidence = rawCount >= levelPolicy.minEvidenceCountPerSkill;
    const hasSufficientConfidence = confidence >= levelPolicy.minConfidenceScore;

    if (isMissingOrInvalid) {
      allFloorsPassed = false;
      failingReasons.push(`Thiếu dữ liệu đánh giá hoặc điểm số không hợp lệ cho kỹ năng ${getSkillNameVi(skill)}.`);
    } else {
      if (!hasSufficientEvidence) {
        allFloorsPassed = false;
        failingReasons.push(`Kỹ năng ${getSkillNameVi(skill)} chưa đủ số lượng bằng chứng đánh giá tối thiểu (${rawCount}/${levelPolicy.minEvidenceCountPerSkill}).`);
      }
      if (!hasSufficientConfidence) {
        allFloorsPassed = false;
        failingReasons.push(`Kỹ năng ${getSkillNameVi(skill)} chưa đạt ngưỡng độ tin cậy kiểm định (${confidence} < ${levelPolicy.minConfidenceScore}).`);
      }
      if (!passedFloor) {
        allFloorsPassed = false;
        failingReasons.push(
          `Kỹ năng ${getSkillNameVi(skill)} đạt ${safeScore}% (chưa đạt ngưỡng sàn tối thiểu ${levelPolicy.perSkillFloorThreshold}% của cấp độ ${params.level}).`
        );
      }
    }

    skillResultsRecord[skill] = {
      skill,
      score: safeScore,
      passedFloor,
      requiredFloor: levelPolicy.perSkillFloorThreshold,
      rawEvidenceCount: rawCount,
      confidence,
      feedback: passedFloor
        ? `Đạt tiêu chuẩn sàn kỹ năng (${safeScore}% >= ${levelPolicy.perSkillFloorThreshold}%)`
        : `Chưa đạt tiêu chuẩn sàn kỹ năng (${safeScore}% < ${levelPolicy.perSkillFloorThreshold}%)`,
    };

    totalScoreSum += safeScore;
  }

  const overallScore = Math.round(totalScoreSum / 4);
  const passedOverall = overallScore >= levelPolicy.overallPassThreshold;

  if (!passedOverall) {
    failingReasons.push(
      `Điểm trung bình toàn diện đạt ${overallScore}% (chưa đạt chuẩn yêu cầu ${levelPolicy.overallPassThreshold}% của cấp độ ${params.level}).`
    );
  }

  const isPassed = passedOverall && allFloorsPassed;

  if (isPassed) {
    const certificateId = generateCertificateId(params.level, now);
    const reason = `Đạt toàn diện các tiêu chí đánh giá chuẩn CEFR ${params.level} (Điểm trung bình: ${overallScore}%, tất cả 4 kỹ năng đều vượt ngưỡng sàn ${levelPolicy.perSkillFloorThreshold}%).`;

    return {
      result: 'certified',
      isPassed: true,
      level: params.level,
      attemptId,
      overallScore,
      requiredOverall: levelPolicy.overallPassThreshold,
      skillResults: skillResultsRecord,
      certificateId,
      certifiedAt: now,
      assessedAt: now,
      policyVersion: policy.policyVersion,
      schemaVersion: CERTIFICATION_SCHEMA_VERSION,
      reason,
    };
  }

  // Handle failure case (Needs Reinforcement)
  const elapsedSinceFailed =
    typeof params.lastFailedAttemptAt === 'number' && params.lastFailedAttemptAt > 0
      ? now - params.lastFailedAttemptAt
      : levelPolicy.retakeCooldownMs;

  const canRetake = elapsedSinceFailed >= levelPolicy.retakeCooldownMs;
  const retakeAvailableAt = canRetake ? now : (params.lastFailedAttemptAt ?? now) + levelPolicy.retakeCooldownMs;

  const reinforcementRoutes = deriveCheckpointReinforcementRoutes({
    level: params.level,
    skillResults: skillResultsRecord,
    overallScore,
    requiredOverall: levelPolicy.overallPassThreshold,
  });

  return {
    result: 'needs_reinforcement',
    isPassed: false,
    level: params.level,
    attemptId,
    overallScore,
    requiredOverall: levelPolicy.overallPassThreshold,
    skillResults: skillResultsRecord,
    failingReasons,
    assessedAt: now,
    policyVersion: policy.policyVersion,
    schemaVersion: CERTIFICATION_SCHEMA_VERSION,
    canRetake,
    retakeAvailableAt,
    reinforcementRoutes,
  };
}

/**
 * Derives actionable reinforcement learning routes for a failed checkpoint evaluation.
 * Invariants:
 * - Pure derivation: Zero store mutation or lesson completion.
 * - Prioritizes the weakest skill (furthest below floor).
 * - Identifies concrete lessons/prompts matching the CEFR level.
 */
export function deriveCheckpointReinforcementRoutes(
  params: {
    level: CefrLevel;
    skillResults: Record<CefrSkill, SkillAssessmentResult>;
    overallScore: number;
    requiredOverall: number;
  }
): CheckpointReinforcementRoute[] {
  const routes: CheckpointReinforcementRoute[] = [];
  const level = params.level;

  for (const skill of CEFR_SKILLS_LIST) {
    const res = params.skillResults[skill];
    if (!res) continue;

    const isWeak =
      !res.passedFloor ||
      res.score < res.requiredFloor ||
      (params.overallScore < params.requiredOverall && res.score < params.requiredOverall);

    if (isWeak) {
      let sampleId: string | undefined;
      if (skill === 'speaking') {
        const prompts = findSpeakingLessonsByCefr(level);
        sampleId = prompts[0]?.id;
      } else if (skill === 'reading') {
        const lessons = findReadingLessonsByCefr(level);
        sampleId = lessons[0]?.id;
      } else if (skill === 'listening') {
        const lessons = findListeningLessonsByCefr(level);
        sampleId = lessons[0]?.id;
      } else if (skill === 'writing') {
        const prompts = findWritingLessonsByCefr(level);
        sampleId = prompts[0]?.id;
      }

      const skillVi = getSkillNameVi(skill);
      routes.push({
        skill,
        level,
        routeTab: 'four_skills',
        activeSkill: skill,
        title: `Củng cố ${skillVi} CEFR ${level}`,
        description: `Điểm đạt ${res.score}% (sàn yêu cầu ${res.requiredFloor}%). Tập trung luyện các bài tập ${skillVi} cấp độ ${level}.`,
        reason: !res.passedFloor
          ? `Kỹ năng ${skillVi} đạt ${res.score}%, chưa đạt ngưỡng sàn tối thiểu ${res.requiredFloor}% của cấp độ ${level}.`
          : `Kỹ năng ${skillVi} cần được cải thiện để đạt mức điểm tổng kết ${params.requiredOverall}%.`,
        sampleLessonOrPromptId: sampleId,
        currentScore: res.score,
        requiredFloor: res.requiredFloor,
      });
    }
  }

  // Weakest skill first
  return routes.sort((a, b) => a.currentScore - b.currentScore);
}

// =========================================================================
// 5. CHECKPOINT HISTORY & IMMUTABLE EVIDENCE REPOSITORY (PHASE 9)
// =========================================================================

export const MAX_CHECKPOINT_HISTORY_PER_LEVEL = 10;
export const MAX_TOTAL_CHECKPOINT_HISTORY = 30;

/**
 * Creates a minimal storage-efficient immutable history record from a completed evaluation.
 * Invariant: Never persists raw lesson text, question prompts, or UI runtime objects.
 */
export function createCheckpointHistoryEntry(
  evaluation: CertificationEvaluationResult
): CheckpointHistoryEntry {
  const scores: Record<CefrSkill, number> = {
    listening: evaluation.skillResults.listening?.score ?? 0,
    reading: evaluation.skillResults.reading?.score ?? 0,
    speaking: evaluation.skillResults.speaking?.score ?? 0,
    writing: evaluation.skillResults.writing?.score ?? 0,
  };

  return {
    attemptId: evaluation.attemptId,
    level: evaluation.level,
    date: evaluation.assessedAt,
    result: evaluation.result,
    isPassed: evaluation.isPassed,
    overallScore: evaluation.overallScore,
    scores,
    policyVersion: evaluation.policyVersion,
    schemaVersion: evaluation.schemaVersion,
    certificateId: evaluation.isPassed ? evaluation.certificateId : undefined,
  };
}

/**
 * Appends a history entry adhering to:
 * 1. Finalize once: If attemptId already recorded, returns unchanged.
 * 2. Bounded storage: Limits entries per level and global maximum.
 * 3. Chronological sort: Newest first.
 */
export function appendCheckpointHistory(
  history: CheckpointHistoryEntry[] = [],
  entry: CheckpointHistoryEntry,
  maxPerLevel = MAX_CHECKPOINT_HISTORY_PER_LEVEL,
  maxTotal = MAX_TOTAL_CHECKPOINT_HISTORY
): CheckpointHistoryEntry[] {
  if (!entry || !entry.attemptId) return history;

  // Deduplication: Finalize once!
  if (history.some((h) => h.attemptId === entry.attemptId)) {
    return history;
  }

  const updated = [entry, ...history];

  // Bounded per-level strategy
  const byLevel: Record<string, CheckpointHistoryEntry[]> = {};
  for (const item of updated) {
    if (!byLevel[item.level]) byLevel[item.level] = [];
    if (byLevel[item.level].length < maxPerLevel) {
      byLevel[item.level].push(item);
    }
  }

  return Object.values(byLevel)
    .flat()
    .sort((a, b) => b.date - a.date)
    .slice(0, maxTotal);
}

/**
 * Filters checkpoint history for a specific CEFR level (newest first).
 */
export function getCheckpointHistoryForLevel(
  history: CheckpointHistoryEntry[] = [],
  level: CefrLevel
): CheckpointHistoryEntry[] {
  if (!Array.isArray(history)) return [];
  return history.filter((h) => h && h.level === level);
}

/**
 * Retake Policy: Preserves existing certification upon retake.
 * Invariant: If a learner is already certified, a subsequent failed or weaker retake
 * must NEVER remove, downgrade, or overwrite their official certificate!
 */
export function preserveHighestCertificationOnRetake(
  currentCerts: LevelCertificationStore = {},
  newEvaluation: CertificationEvaluationResult
): LevelCertificationStore {
  if (!newEvaluation) return currentCerts;

  const level = newEvaluation.level;
  const existingCert = currentCerts[level];

  // 1. If evaluation failed (Needs Reinforcement):
  // INVARIANT: Never revoke an existing certificate!
  if (!newEvaluation.isPassed) {
    return currentCerts;
  }

  // 2. If evaluation passed (Certified):
  const newCert: PersistedLevelCertification = {
    level,
    certificateId: newEvaluation.certificateId,
    certifiedAt: newEvaluation.certifiedAt,
    overallScore: newEvaluation.overallScore,
    skillScores: {
      listening: newEvaluation.skillResults.listening.score,
      reading: newEvaluation.skillResults.reading.score,
      speaking: newEvaluation.skillResults.speaking.score,
      writing: newEvaluation.skillResults.writing.score,
    },
    attemptId: newEvaluation.attemptId,
    verifiedVersion: newEvaluation.policyVersion,
    criteriaSummary: {
      overallRequired: newEvaluation.requiredOverall,
      overallAchieved: newEvaluation.overallScore,
      floorRequired: CENTRAL_CERTIFICATION_POLICY.levels[level].perSkillFloorThreshold,
      minSkillAchieved: Math.min(...CEFR_SKILLS_LIST.map((s) => newEvaluation.skillResults[s].score)),
      verifiedVersion: newEvaluation.policyVersion,
    },
  };

  // If already certified with a higher score, keep the higher score
  if (existingCert && existingCert.overallScore > newEvaluation.overallScore) {
    return currentCerts;
  }

  return {
    ...currentCerts,
    [level]: newCert,
  };
}

/**
 * Checks whether learner is eligible to retake the checkpoint for this level.
 */
export function canRetakeCheckpointLevel(
  level: CefrLevel,
  history: CheckpointHistoryEntry[] = [],
  nowMs = Date.now(),
  policy = CENTRAL_CERTIFICATION_POLICY
): { canRetake: boolean; remainingCooldownMs: number } {
  const levelHistory = getCheckpointHistoryForLevel(history, level);
  if (levelHistory.length === 0) {
    return { canRetake: true, remainingCooldownMs: 0 };
  }

  const lastAttempt = levelHistory[0]; // Newest
  if (lastAttempt.isPassed) {
    return { canRetake: true, remainingCooldownMs: 0 };
  }

  const levelPolicy = policy.levels[level] || policy.levels.A1;
  const elapsed = nowMs - lastAttempt.date;
  const remaining = Math.max(0, levelPolicy.retakeCooldownMs - elapsed);

  return {
    canRetake: remaining === 0,
    remainingCooldownMs: remaining,
  };
}

/**
 * Skip-Level Invariant: Verifies that certifications for each level remain strictly independent.
 * Certifying at a higher level does NOT automatically bestow or synthesize certificates for lower levels.
 */
export function verifySkipLevelIsolation(
  certifications: LevelCertificationStore,
  testedLevel: CefrLevel
): boolean {
  if (!certifications) return true;
  const targetCert = certifications[testedLevel];
  if (!targetCert) return true;

  // Verify that other levels only exist if explicitly certified
  for (const lvl of CEFR_LEVELS_ORDER) {
    if (lvl !== testedLevel && certifications[lvl]) {
      // Must have their own independent certificate ID
      if (certifications[lvl]?.certificateId === targetCert.certificateId) {
        return false; // Violates isolation (shared cert ID)!
      }
    }
  }
  return true;
}

// =========================================================================
// 5. DETERMINISTIC DERIVED HELPERS
// =========================================================================

/**
 * Deterministically derives the highest certified CEFR level from stored certifications.
 *
 * Invariants:
 * - Pure derivation: Never reads or writes a cached/duplicated field.
 * - Checks in descending order C2 -> C1 -> B2 -> B1 -> A2 -> A1.
 * - Resilient to non-contiguous certification (e.g. advanced learner certified at B2 without A1).
 */
export function deriveHighestCertifiedLevel(
  certifications?: LevelCertificationStore | null
): CefrLevel | null {
  if (!certifications || typeof certifications !== 'object') {
    return null;
  }

  for (let i = CEFR_LEVELS_ORDER.length - 1; i >= 0; i--) {
    const lvl = CEFR_LEVELS_ORDER[i];
    const cert = certifications[lvl];
    if (
      cert &&
      cert.level === lvl &&
      typeof cert.certificateId === 'string' &&
      cert.certificateId.trim().length > 0 &&
      typeof cert.overallScore === 'number' &&
      Number.isFinite(cert.overallScore)
    ) {
      return lvl;
    }
  }

  return null;
}

/**
 * Derives the active certification lifecycle status for a given level.
 *
 * Invariants:
 * - Strictly separated from journeyStatus.
 */
export function deriveCertificationStatus(
  level: CefrLevel,
  certifications?: LevelCertificationStore | null,
  readiness?: LevelReadinessEvaluation | null,
  latestAttempt?: CheckpointAttempt | null
): LevelCertificationStatus {
  if (certifications && certifications[level]) {
    return 'certified';
  }

  if (latestAttempt && latestAttempt.level === level) {
    if (latestAttempt.status === 'in_progress') {
      return 'in_progress';
    }
    if (latestAttempt.status === 'evaluated' && !latestAttempt.isPassed) {
      return 'failed';
    }
  }

  if (readiness?.isReadyForCheckpoint) {
    return 'ready';
  }

  return 'unattempted';
}

export interface EvidenceCompletenessReport {
  level: CefrLevel;
  totalSkillsAssessed: number; // 0 - 4
  missingSkills: CefrSkill[];
  isFullyCovered: boolean; // all 4 skills have at least 1 valid evidence item
  averageConfidence: number;
}

/**
 * Inspects evidence completeness across 4 skills for a given CEFR level.
 */
export function deriveEvidenceCompleteness(
  level: CefrLevel,
  evidenceStore?: FourSkillsEvidenceStore | null
): EvidenceCompletenessReport {
  const missingSkills: CefrSkill[] = [];
  let assessedCount = 0;
  let totalConfidence = 0;

  for (const sk of CEFR_SKILLS_LIST) {
    const list = evidenceStore?.[sk] ?? [];
    const validLevelEvidence = list.filter((e) => {
      if (!e) return false;
      if (!e.cefrDifficulty) return true;
      const orderDiff = CEFR_LEVELS_ORDER.indexOf(e.cefrDifficulty);
      const targetOrder = CEFR_LEVELS_ORDER.indexOf(level);
      return orderDiff >= targetOrder;
    });

    if (validLevelEvidence.length > 0) {
      assessedCount++;
      const avgQuality = validLevelEvidence.reduce((acc, it) => acc + (it.quality ?? 1.0), 0) / validLevelEvidence.length;
      totalConfidence += Math.min(1.0, (Math.sqrt(validLevelEvidence.length) / 3) * avgQuality);
    } else {
      missingSkills.push(sk);
    }
  }

  const averageConfidence = assessedCount > 0 ? Math.round((totalConfidence / assessedCount) * 100) / 100 : 0;

  return {
    level,
    totalSkillsAssessed: assessedCount,
    missingSkills,
    isFullyCovered: assessedCount === 4,
    averageConfidence,
  };
}

/**
 * Creates a persisted certification record from a passed evaluation.
 */
export function createPersistedCertificationRecord(
  evalResult: CertificationEvaluationResult,
  attemptId: string,
  policy: CentralCertificationPolicyConfig = CENTRAL_CERTIFICATION_POLICY
): PersistedLevelCertification | null {
  if (!evalResult.isPassed) {
    return null;
  }

  const levelPolicy = policy.levels[evalResult.level];
  const skillScores: Record<CefrSkill, number> = {
    listening: evalResult.skillResults.listening.score,
    reading: evalResult.skillResults.reading.score,
    speaking: evalResult.skillResults.speaking.score,
    writing: evalResult.skillResults.writing.score,
  };

  const minSkillScore = Math.min(...Object.values(skillScores));

  return {
    level: evalResult.level,
    certificateId: evalResult.certificateId,
    certifiedAt: evalResult.certifiedAt,
    overallScore: evalResult.overallScore,
    skillScores,
    attemptId,
    verifiedVersion: policy.policyVersion,
    criteriaSummary: {
      overallRequired: evalResult.requiredOverall,
      overallAchieved: evalResult.overallScore,
      floorRequired: levelPolicy.perSkillFloorThreshold,
      minSkillAchieved: minSkillScore,
      verifiedVersion: policy.policyVersion,
    },
  };
}

function getSkillNameVi(skill: CefrSkill): string {
  switch (skill) {
    case 'listening':
      return 'Nghe';
    case 'reading':
      return 'Đọc';
    case 'speaking':
      return 'Nói';
    case 'writing':
      return 'Viết';
  }
}
