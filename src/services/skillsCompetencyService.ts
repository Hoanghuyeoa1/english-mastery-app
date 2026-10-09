import { useAppStore } from '../store/useAppStore';
import type {
  CompetencySkill,
  CompetencyEvidence,
  CompetencyEvidenceInput,
  FourSkillsEvidenceStore,
} from '../types/competencyEvidence';
import {
  EMPTY_FOUR_SKILLS_EVIDENCE,
  adaptLegacyScoresToEvidence,
} from './competencyEvidenceService';
import {
  evaluateSkillCompetencyV2,
  type CompetencyEvaluationV2,
  type EvaluateCompetencyOptions,
} from './competencyCalculationEngine';

export * from './competencyEvidenceService';
export * from './competencyCalculationEngine';

/**
 * Service tính toán Năng Lực 4 Kỹ Năng (CEFR) & Kho Từ Vựng Tích Lũy
 * Single Source of Truth: Lấy dữ liệu điểm thực tế từ bài tập của học viên trong Zustand store,
 * không dùng mock data hay gán cứng.
 */

import type { SkillCompetency } from '../types';
export type { SkillCompetency };

export interface FourSkillsCompetency {
  listening: SkillCompetency;
  reading: SkillCompetency;
  speaking: SkillCompetency;
  writing: SkillCompetency;
  accumulatedCoreWords: number;
}

/**
 * Lấy danh sách điểm số gần nhất của một kỹ năng từ Zustand store
 */
export function getSkillScores(skill: 'listening' | 'reading' | 'speaking' | 'writing'): number[] {
  return useAppStore.getState().fourSkillsScores?.[skill] || [];
}

/**
 * Lấy danh sách bằng chứng năng lực (evidence history) của một kỹ năng từ Zustand store
 */
export function getSkillEvidence(skill: CompetencySkill): CompetencyEvidence[] {
  return useAppStore.getState().fourSkillsEvidence?.[skill] || [];
}

/**
 * Lấy toàn bộ store bằng chứng năng lực 4 kỹ năng từ Zustand store
 */
export function getFourSkillsEvidenceStore(): FourSkillsEvidenceStore {
  return useAppStore.getState().fourSkillsEvidence || EMPTY_FOUR_SKILLS_EVIDENCE;
}

/**
 * Ghi nhận bằng chứng năng lực mới (v2) vào Zustand store (kèm dual-write sang fourSkillsScores)
 */
export function recordSkillEvidence(input: CompetencyEvidenceInput): void {
  useAppStore.getState().recordSkillEvidence(input);
}

/**
 * Ghi nhận điểm số của một bài luyện tập kỹ năng vào Zustand store (Legacy API)
 */
export function recordSkillScore(
  skill: 'listening' | 'reading' | 'speaking' | 'writing',
  score: number
): void {
  if (typeof score !== 'number' || Number.isNaN(score) || !Number.isFinite(score)) {
    console.warn(`[skillsCompetencyService] Ignored invalid score for ${skill}:`, score);
    return;
  }
  useAppStore.getState().recordSkillScore(skill, score);
}

/**
 * Lấy báo cáo năng lực 4 kỹ năng thực tế của người dùng từ Zustand store
 */
export function getFourSkillsCompetency(
  srsProgressMap: Record<string, any> = {}
): FourSkillsCompetency {
  const scoresState = useAppStore.getState().fourSkillsScores;
  const evidenceStore = useAppStore.getState().fourSkillsEvidence;

  const getSkill = (skill: 'listening' | 'reading' | 'speaking' | 'writing'): SkillCompetency => {
    const rawScores = scoresState?.[skill] || [];
    const scores = Array.isArray(rawScores)
      ? rawScores.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && !Number.isNaN(n))
      : [];

    const evidenceList = evidenceStore?.[skill] || [];

    if (scores.length === 0 && evidenceList.length === 0) {
      return {
        score: 0,
        level: 'A1',
        totalAttempts: 0,
        isAssessed: false,
        confidence: 'low',
        confidenceScore: 0,
      };
    }

    if (evidenceList.length > 0) {
      const v2Eval = evaluateSkillCompetencyV2(skill, evidenceList);
      const confidenceScore = v2Eval.confidence;
      const confidence = confidenceScore >= 0.70 ? 'high' : confidenceScore >= 0.40 ? 'medium' : 'low';
      return {
        score: v2Eval.score,
        level: v2Eval.level,
        totalAttempts: v2Eval.evidenceCount,
        isAssessed: true,
        confidence,
        confidenceScore,
      };
    }

    // Fallback if only legacy scores exist
    const legacyEvidence = adaptLegacyScoresToEvidence(skill, scores);
    if (legacyEvidence.length > 0) {
      const v2Eval = evaluateSkillCompetencyV2(skill, legacyEvidence);
      const confidenceScore = v2Eval.confidence;
      const confidence = confidenceScore >= 0.70 ? 'high' : confidenceScore >= 0.40 ? 'medium' : 'low';
      return {
        score: v2Eval.score,
        level: v2Eval.level,
        totalAttempts: v2Eval.evidenceCount,
        isAssessed: true,
        confidence,
        confidenceScore,
      };
    }

    return {
      score: 0,
      level: 'A1',
      totalAttempts: 0,
      isAssessed: false,
      confidence: 'low',
      confidenceScore: 0,
    };
  };

  // Đếm chính xác số lượng bản ghi thực tế của user trong SRS Progress
  // Chỉ đếm những từ đã từng học (srsLevel > 0 hoặc đã có lastReviewedDate hoặc firstLearnedAt)
  const coreWordsCount = Object.values(srsProgressMap || {}).filter(
    (p: any) =>
      (p.srsLevel && p.srsLevel > 0) ||
      (p.interval && p.interval > 0) ||
      Boolean(p.lastReviewedDate) ||
      Boolean(p.firstLearnedAt)
  ).length;

  return {
    listening: getSkill('listening'),
    reading: getSkill('reading'),
    speaking: getSkill('speaking'),
    writing: getSkill('writing'),
    accumulatedCoreWords: coreWordsCount,
  };
}

export interface FourSkillsEvaluationV2Result {
  listening: CompetencyEvaluationV2;
  reading: CompetencyEvaluationV2;
  speaking: CompetencyEvaluationV2;
  writing: CompetencyEvaluationV2;
  accumulatedCoreWords: number;
}

/**
 * Đánh giá năng lực 4 kỹ năng theo Four Skills Competency Model v2 (Anchor calibration, Recency decay, Confidence)
 */
export function evaluateFourSkillsCompetencyV2(
  srsProgressMap: Record<string, any> = {},
  options?: EvaluateCompetencyOptions
): FourSkillsEvaluationV2Result {
  const store = getFourSkillsEvidenceStore();

  const coreWordsCount = Object.values(srsProgressMap || {}).filter(
    (p: any) =>
      (p.srsLevel && p.srsLevel > 0) ||
      (p.interval && p.interval > 0) ||
      Boolean(p.lastReviewedDate) ||
      Boolean(p.firstLearnedAt)
  ).length;

  return {
    listening: evaluateSkillCompetencyV2('listening', store.listening, options),
    reading: evaluateSkillCompetencyV2('reading', store.reading, options),
    speaking: evaluateSkillCompetencyV2('speaking', store.speaking, options),
    writing: evaluateSkillCompetencyV2('writing', store.writing, options),
    accumulatedCoreWords: coreWordsCount,
  };
}

/**
 * Xóa sạch toàn bộ dữ liệu lịch sử và điểm số của 4 kỹ năng
 */
export function clearAllSkillsData(): void {
  const keys = [
    'completed_listening_lessons',
    'completed_reading_lessons',
    'completed_speaking_prompts',
    'completed_writing_prompts',
  ];
  keys.forEach((k) => localStorage.removeItem(k));
  useAppStore.getState().setFourSkillsScores({
    listening: [],
    reading: [],
    speaking: [],
    writing: [],
  });
  useAppStore.getState().setFourSkillsEvidence(EMPTY_FOUR_SKILLS_EVIDENCE);
  useAppStore.getState().setCompletedListeningLessonIds([]);
  useAppStore.getState().setFourSkillsCompletionProgress({
    reading: [],
    speaking: [],
    writing: [],
  });
}

