import type {
  AppStoreState,
  FourSkillsScores,
  FourSkillsCompletionProgress,
  PersistedLevelCertification,
  CertificationEvaluationResult,
  CheckpointHistoryEntry,
} from '../../types';
import type {
  CompetencyEvidence,
  CompetencyEvidenceInput,
  FourSkillsEvidenceStore,
} from '../../types/competencyEvidence';
import {
  EMPTY_FOUR_SKILLS_EVIDENCE,
  createCompetencyEvidence,
  deduplicateEvidence,
  boundEvidenceHistory,
  sanitizeEvidenceStore,
} from '../../services/competencyEvidenceService';
import {
  sanitizeFourSkillsScores,
  sanitizeStringIds,
  DEFAULT_FOUR_SKILLS_COMPLETION_PROGRESS,
  sanitizePersistedLevelCertification,
  sanitizeCheckpointHistoryEntry,
  sanitizeLevelCertifications,
  isCefrLevel,
} from '../fourSkillsSanitizers';
import {
  createCheckpointHistoryEntry,
  appendCheckpointHistory,
  preserveHighestCertificationOnRetake,
  CENTRAL_CERTIFICATION_POLICY,
} from '../../services/levelCertificationService';
import { CEFR_SKILLS_LIST } from '../../types/levelCertification';
import { scheduleCloudSync } from '../../services/cloudSyncService';

export interface FourSkillsSlice {
  setActiveFourSkill: (skill: 'listening' | 'reading' | 'speaking' | 'writing') => void;
  recordSkillScore: (skill: 'listening' | 'reading' | 'speaking' | 'writing', score: number) => void;
  recordSkillEvidence: (input: CompetencyEvidenceInput) => void;
  setFourSkillsScores: (scores: FourSkillsScores) => void;
  setFourSkillsEvidence: (evidence: FourSkillsEvidenceStore) => void;
  markListeningLessonCompleted: (lessonId: string) => void;
  setCompletedListeningLessonIds: (ids: string[]) => void;
  markFourSkillsLessonCompleted: (
    skill: 'listening' | 'reading' | 'speaking' | 'writing',
    lessonId: string
  ) => void;
  setFourSkillsCompletionProgress: (progress: Partial<FourSkillsCompletionProgress>) => void;
  setHasLearnedNightOwl: (learned: boolean) => void;
  saveLevelCertification: (cert: PersistedLevelCertification) => void;
  recordCheckpointAttemptResult: (evaluation: CertificationEvaluationResult) => void;
}

type SetState = (
  partial: Partial<AppStoreState> | ((state: AppStoreState) => Partial<AppStoreState>),
  replace?: boolean
) => void;
type GetState = () => AppStoreState;

export const createFourSkillsSlice = (set: SetState, _get: GetState): FourSkillsSlice => ({
  setActiveFourSkill: (skill) => set({ activeFourSkill: skill }),

  recordSkillScore: (skill, score) => {
    if (typeof score !== 'number' || Number.isNaN(score) || !Number.isFinite(score)) return;
    const validScore = Math.max(0, Math.min(100, Math.round(score)));
    const now = Date.now();
    const legacyEvidence: CompetencyEvidence = {
      id: `legacy_${skill}_${now}_${validScore}`,
      skill,
      score: validScore,
      source: 'legacy',
      createdAt: now,
      quality: 1.0,
    };
    set((state) => {
      const currentList = state.fourSkillsScores?.[skill] || [];
      const updated = [...currentList, validScore].slice(-50);

      const currentEvidence = state.fourSkillsEvidence?.[skill] || [];
      const updatedEvidence = boundEvidenceHistory(deduplicateEvidence([...currentEvidence, legacyEvidence]));

      return {
        fourSkillsScores: {
          ...state.fourSkillsScores,
          [skill]: updated,
        },
        fourSkillsEvidence: {
          ...(state.fourSkillsEvidence || EMPTY_FOUR_SKILLS_EVIDENCE),
          [skill]: updatedEvidence,
        },
      };
    });
    scheduleCloudSync(2000);
  },

  recordSkillEvidence: (input: CompetencyEvidenceInput) => {
    const evidence = createCompetencyEvidence(input);
    if (!evidence) {
      console.warn('[useAppStore] recordSkillEvidence ignored invalid evidence input:', input);
      return;
    }
    set((state) => {
      const currentEvidence = state.fourSkillsEvidence?.[evidence.skill] || [];
      const updatedEvidence = boundEvidenceHistory(deduplicateEvidence([...currentEvidence, evidence]));

      const currentScores = state.fourSkillsScores?.[evidence.skill] || [];
      const updatedScores = [...currentScores, evidence.score].slice(-50);

      return {
        fourSkillsEvidence: {
          ...(state.fourSkillsEvidence || EMPTY_FOUR_SKILLS_EVIDENCE),
          [evidence.skill]: updatedEvidence,
        },
        fourSkillsScores: {
          ...state.fourSkillsScores,
          [evidence.skill]: updatedScores,
        },
      };
    });
    scheduleCloudSync(2000);
  },

  setFourSkillsScores: (scores) => {
    set({
      fourSkillsScores: sanitizeFourSkillsScores(scores),
    });
    scheduleCloudSync(2000);
  },

  setFourSkillsEvidence: (evidence) => {
    set({
      fourSkillsEvidence: sanitizeEvidenceStore(evidence),
    });
    scheduleCloudSync(2000);
  },

  markListeningLessonCompleted: (lessonId) => {
    if (!lessonId || typeof lessonId !== 'string') return;
    const cleanId = lessonId.trim();
    if (!cleanId) return;
    set((state) => {
      const current = state.completedListeningLessonIds || [];
      if (current.includes(cleanId)) return state;
      return {
        completedListeningLessonIds: [...current, cleanId],
      };
    });
    scheduleCloudSync(2000);
  },

  setCompletedListeningLessonIds: (ids) => {
    const sanitized = sanitizeStringIds(ids);
    set({ completedListeningLessonIds: sanitized });
    scheduleCloudSync(2000);
  },

  markFourSkillsLessonCompleted: (skill, lessonId) => {
    if (!lessonId || typeof lessonId !== 'string') return;
    const cleanId = lessonId.trim();
    if (!cleanId) return;

    if (skill === 'listening') {
      set((state) => {
        const current = state.completedListeningLessonIds || [];
        if (current.includes(cleanId)) return state;
        return {
          completedListeningLessonIds: [...current, cleanId],
        };
      });
      scheduleCloudSync(2000);
      return;
    }

    if (skill === 'reading' || skill === 'speaking' || skill === 'writing') {
      set((state) => {
        const currentObj = state.fourSkillsCompletionProgress || DEFAULT_FOUR_SKILLS_COMPLETION_PROGRESS;
        const currentList = currentObj[skill] || [];
        if (currentList.includes(cleanId)) return state;
        return {
          fourSkillsCompletionProgress: {
            ...currentObj,
            [skill]: [...currentList, cleanId],
          },
        };
      });
      scheduleCloudSync(2000);
    }
  },

  setFourSkillsCompletionProgress: (progress) => {
    set((state) => {
      const current = state.fourSkillsCompletionProgress || DEFAULT_FOUR_SKILLS_COMPLETION_PROGRESS;
      return {
        fourSkillsCompletionProgress: {
          reading: progress.reading ? sanitizeStringIds(progress.reading) : current.reading,
          speaking: progress.speaking ? sanitizeStringIds(progress.speaking) : current.speaking,
          writing: progress.writing ? sanitizeStringIds(progress.writing) : current.writing,
        },
      };
    });
    scheduleCloudSync(2000);
  },

  setHasLearnedNightOwl: (learned) => {
    set({ hasLearnedNightOwl: learned });
    scheduleCloudSync(2000);
  },

  saveLevelCertification: (cert: PersistedLevelCertification) => {
    const validCert = sanitizePersistedLevelCertification(cert);
    if (!validCert) return;

    const policy = CENTRAL_CERTIFICATION_POLICY.levels[validCert.level];
    if (validCert.overallScore < policy.overallPassThreshold) return;
    const hasFloorFailure = CEFR_SKILLS_LIST.some(
      (s) => validCert.skillScores[s] < policy.perSkillFloorThreshold
    );
    if (hasFloorFailure) return;

    set((state) => ({
      levelCertifications: {
        ...(state.levelCertifications || {}),
        [validCert.level]: validCert,
      },
    }));
  },

  recordCheckpointAttemptResult: (evaluation: CertificationEvaluationResult) => {
    if (!evaluation || !evaluation.attemptId || !isCefrLevel(evaluation.level)) return;
    set((state) => {
      // Idempotency check: attempt already finalized
      if (state.checkpointHistory?.some((h) => h.attemptId === evaluation.attemptId)) {
        return state;
      }
      const historyEntry = createCheckpointHistoryEntry(evaluation);
      const sanitizedEntry = sanitizeCheckpointHistoryEntry(historyEntry);
      if (!sanitizedEntry) return state;

      const updatedHistory = appendCheckpointHistory(state.checkpointHistory || [], sanitizedEntry);
      const updatedCerts = preserveHighestCertificationOnRetake(state.levelCertifications || {}, evaluation);

      return {
        checkpointHistory: updatedHistory,
        levelCertifications: sanitizeLevelCertifications(updatedCerts),
      };
    });
    scheduleCloudSync(2000);
  },
});
