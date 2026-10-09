import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { 
  AppStore,
  AppStoreState,
  SRSProgress,
  SRSAlgorithmType,
  SRSReviewEvent,
  ActiveTargetedPracticeConfig,
  ActiveTab,
  WordLearningStatsMap,
  ResumableActivity,
  LevelCertificationStore,
  CheckpointHistoryEntry,
} from '../types';
import { DEFAULT_FSRS_SETTINGS } from '../services/fsrsAlgorithm';
import { syncToeicCloudHistory } from '../services/toeicPersistenceService';
import { createDefaultAdaptiveQuizTelemetryState } from '../services/adaptiveQuizTelemetryService';
import { EMPTY_FOUR_SKILLS_EVIDENCE } from '../services/competencyEvidenceService';
import { applyCloudDataMerge } from './cloudDataMerger';
import { safeStorage } from './safeStorage';
import { exportStoreBackup, importStoreBackup } from './backupDataService';
import { partializeAppStore, handleStoreRehydration } from './storeRehydration';
import { registerCloudSyncStoreGetter } from '../services/cloudSyncService';
import { isGuestSessionActive, setGuestSessionActive } from './guestSessionStorage';

// Slices
import { createTelemetrySlice } from './slices/createTelemetrySlice';
import { createSrsSlice } from './slices/createSrsSlice';
import { createFourSkillsSlice } from './slices/createFourSkillsSlice';
import { createProfileSlice } from './slices/createProfileSlice';
import { createMistakeSlice } from './slices/createMistakeSlice';
import { createVocabularySlice } from './slices/createVocabularySlice';
import { createContinuitySlice } from './slices/createContinuitySlice';

// Re-exports for public API stability across consumers
export type { SRSProgress, AppStore, AppStoreState };

import {
  DEFAULT_FOUR_SKILLS_SCORES,
  sanitizeScoreArray,
  sanitizeFourSkillsScores,
  sanitizeStringIds,
  DEFAULT_FOUR_SKILLS_COMPLETION_PROGRESS,
  sanitizeFourSkillsCompletionProgress,
  mergeCompletionProgressIds,
  mergeFourSkillsCompletionProgress,
  mergeSkillScores,
  mergeLevelCertifications,
  mergeCheckpointHistory,
  sanitizeLevelCertifications,
  sanitizeCheckpointHistory,
  pruneFinalizedCheckpointResumes,
} from './fourSkillsSanitizers';

export {
  DEFAULT_FOUR_SKILLS_SCORES,
  sanitizeScoreArray,
  sanitizeFourSkillsScores,
  sanitizeStringIds,
  DEFAULT_FOUR_SKILLS_COMPLETION_PROGRESS,
  sanitizeFourSkillsCompletionProgress,
  mergeCompletionProgressIds,
  mergeFourSkillsCompletionProgress,
  mergeSkillScores,
  mergeLevelCertifications,
  mergeCheckpointHistory,
  sanitizeLevelCertifications,
  sanitizeCheckpointHistory,
  pruneFinalizedCheckpointResumes,
};

import { INITIAL_ACHIEVEMENTS, DEFAULT_PROFILE } from './initialDefaults';
export {
  INITIAL_ACHIEVEMENTS,
  DEFAULT_PROFILE,
};

import {
  composeVocabularyList,
  buildUnifiedSRSCards,
  clearUnifiedCardsCache,
} from './vocabularyComposer';

export {
  composeVocabularyList,
  buildUnifiedSRSCards,
  clearUnifiedCardsCache,
};

export const useAppStore = create<AppStoreState>()(
  persist(
    (set, get) => ({
      // Base State
      profile: DEFAULT_PROFILE,
      userCustomWords: [],
      userCollocations: [],
      srsProgressMap: {},
      vocabularyList: composeVocabularyList({}, []),
      mistakeBank: {},
      dailyHistory: {},
      achievements: INITIAL_ACHIEVEMENTS,
      claimedAchievementIds: [],
      audioVoice: 'en-US',
      audioSpeed: 0.85,
      autoPlayAudio: true,
      isMaskExample: false,
      geminiApiKey: '',
      activeFourSkill: 'listening',
      fourSkillsScores: DEFAULT_FOUR_SKILLS_SCORES,
      fourSkillsEvidence: EMPTY_FOUR_SKILLS_EVIDENCE,
      completedListeningLessonIds: [],
      fourSkillsCompletionProgress: {
        reading: [],
        speaking: [],
        writing: [],
      },
      hasLearnedNightOwl: false,
      srsAlgorithm: 'sm2' as SRSAlgorithmType,
      fsrsSettings: DEFAULT_FSRS_SETTINGS,
      recentReviewEvents: [] as SRSReviewEvent[],
      activePracticeConfig: null as ActiveTargetedPracticeConfig | null,
      pendingNavigationTab: null as ActiveTab | null,
      wordLearningStats: {} as WordLearningStatsMap,
      adaptiveQuizTelemetry: createDefaultAdaptiveQuizTelemetryState(),
      resumeActivities: {} as Record<string, ResumableActivity>,
      levelCertifications: {} as LevelCertificationStore,
      checkpointHistory: [] as CheckpointHistoryEntry[],
      isHydrated: false,
      isGuestMode: isGuestSessionActive(),
      isLoggedOut: false,
      processedXpKeys: [] as string[],
      completedQuizSessionIds: [] as string[],
      processedMistakeKeys: [] as string[],

      // Routing / Guest Actions
      setGuestMode: (enabled: boolean) => {
        setGuestSessionActive(enabled);
        set({ isGuestMode: enabled });
      },
      setIsLoggedOut: (loggedOut: boolean) => {
        if (loggedOut) {
          setGuestSessionActive(false);
          set({ isLoggedOut: loggedOut, isGuestMode: false });
        } else {
          set({ isLoggedOut: loggedOut });
        }
      },

      // Domain Slices
      ...createTelemetrySlice(set as any, get as any),
      ...createSrsSlice(set as any, get as any),
      ...createFourSkillsSlice(set as any, get as any),
      ...createProfileSlice(set as any, get as any),
      ...createMistakeSlice(set as any, get as any),
      ...createVocabularySlice(set as any, get as any),
      ...createContinuitySlice(set as any, get as any),

      // Backup & Restore
      exportBackupData: () => exportStoreBackup(get()),
      importBackupData: (jsonData: string) => importStoreBackup(set as any, jsonData),

      // Reset Actions
      resetVocabularyProgress: () => {
        set((state) => ({
          srsProgressMap: {},
          vocabularyList: composeVocabularyList({}, state.userCustomWords || []),
        }));
      },

      resetToDefault: () => {
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('completed_listening_lessons');
          }
        } catch {}
        set({
          profile: {
            ...DEFAULT_PROFILE,
            name: '',
            isOnboarded: false,
          },
          userCustomWords: [],
          userCollocations: [],
          srsProgressMap: {},
          vocabularyList: composeVocabularyList({}, []),
          mistakeBank: {},
          dailyHistory: {},
          achievements: INITIAL_ACHIEVEMENTS,
          claimedAchievementIds: [],
          audioVoice: 'en-US',
          audioSpeed: 0.85,
          autoPlayAudio: true,
          isMaskExample: false,
          geminiApiKey: '',
          activeFourSkill: 'listening',
          fourSkillsScores: DEFAULT_FOUR_SKILLS_SCORES,
          fourSkillsEvidence: EMPTY_FOUR_SKILLS_EVIDENCE,
          completedListeningLessonIds: [],
          fourSkillsCompletionProgress: {
            reading: [],
            speaking: [],
            writing: [],
          },
          hasLearnedNightOwl: false,
          srsAlgorithm: 'sm2' as SRSAlgorithmType,
          fsrsSettings: DEFAULT_FSRS_SETTINGS,
          recentReviewEvents: [],
          activePracticeConfig: null,
          pendingNavigationTab: null,
          wordLearningStats: {},
          adaptiveQuizTelemetry: createDefaultAdaptiveQuizTelemetryState(),
          resumeActivities: {},
          levelCertifications: {},
          checkpointHistory: [],
          processedXpKeys: [],
          completedQuizSessionIds: [],
          processedMistakeKeys: [],
        });
      },

      // Cloud Sync Merge Action
      mergeCloudData: (payload: any) => {
        try {
          if (!payload || typeof payload !== 'object') {
            console.warn('[AppStore] mergeCloudData received empty or invalid payload, skipping.');
            return;
          }

          set((state) => applyCloudDataMerge(state, payload));

          // Merge TOEIC Exam History: Deterministic dedup by attemptId, bounded to storage budget
          const incomingToeicHistory = payload.cloudToeicHistory || payload.toeicHistory;
          if (Array.isArray(incomingToeicHistory) && incomingToeicHistory.length > 0) {
            syncToeicCloudHistory(incomingToeicHistory);
          }
        } catch (err: unknown) {
          console.warn('[AppStore] Exception during mergeCloudData:', err);
        }
      },
    }),
    {
      name: 'english_mastery_storage_v2',
      storage: createJSONStorage(() => safeStorage),
      partialize: partializeAppStore,
      onRehydrateStorage: () => (state) => {
        handleStoreRehydration(state, (patch) => {
          useAppStore.setState(patch);
        });
      },
    }
  )
);

// Register store getter for cloud sync service to maintain unidirectional dependency (Store -> Service)
registerCloudSyncStoreGetter(() => useAppStore.getState());

