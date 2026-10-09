import type {
  AppStoreState,
  DailyProgress,
  FourSkillsScores,
  FourSkillsCompletionProgress,
} from '../types';
import { DEFAULT_FSRS_SETTINGS } from '../services/fsrsAlgorithm';
import { sanitizeWordLearningStats } from '../services/wordUsageTelemetry';
import { sanitizeAdaptiveQuizTelemetryState } from '../services/adaptiveQuizTelemetryService';
import {
  adaptLegacyFourSkillsScores,
  sanitizeEvidenceStore,
} from '../services/competencyEvidenceService';
import { sanitizeResumeActivitiesMap } from '../services/learningContinuityService';
import {
  sanitizeFourSkillsScores,
  sanitizeFourSkillsCompletionProgress,
  sanitizeStringIds,
  sanitizeLevelCertifications,
  sanitizeCheckpointHistory,
  pruneFinalizedCheckpointResumes,
} from './fourSkillsSanitizers';
import { composeVocabularyList } from './vocabularyComposer';
import { getVietnamDateString } from '../utils/dateUtils';

export function partializeAppStore(state: AppStoreState) {
  return {
    profile: state.profile,
    userCustomWords: state.userCustomWords,
    userCollocations: state.userCollocations,
    srsProgressMap: state.srsProgressMap,
    mistakeBank: state.mistakeBank,
    dailyHistory: state.dailyHistory,
    achievements: state.achievements,
    claimedAchievementIds: state.claimedAchievementIds || [],
    audioVoice: state.audioVoice,
    audioSpeed: state.audioSpeed,
    autoPlayAudio: state.autoPlayAudio,
    isMaskExample: state.isMaskExample,
    geminiApiKey: state.geminiApiKey,
    fourSkillsScores: state.fourSkillsScores,
    fourSkillsEvidence: state.fourSkillsEvidence,
    completedListeningLessonIds: state.completedListeningLessonIds || [],
    fourSkillsCompletionProgress: sanitizeFourSkillsCompletionProgress(state.fourSkillsCompletionProgress),
    hasLearnedNightOwl: state.hasLearnedNightOwl,
    srsAlgorithm: state.srsAlgorithm,
    fsrsSettings: state.fsrsSettings,
    recentReviewEvents: (state.recentReviewEvents || []).slice(0, 200),
    wordLearningStats: state.wordLearningStats || {},
    adaptiveQuizTelemetry: sanitizeAdaptiveQuizTelemetryState(state.adaptiveQuizTelemetry),
    resumeActivities: sanitizeResumeActivitiesMap(state.resumeActivities),
    completedQuizSessionIds: (state.completedQuizSessionIds || []).slice(-200),
    processedXpKeys: (state.processedXpKeys || []).slice(-200),
    processedMistakeKeys: (state.processedMistakeKeys || []).slice(-200),
    levelCertifications: sanitizeLevelCertifications(state.levelCertifications),
    checkpointHistory: sanitizeCheckpointHistory(state.checkpointHistory),
    isGuestMode: state.isGuestMode ?? false,
  };
}

export function handleStoreRehydration(
  state: AppStoreState | undefined,
  asyncUpdater?: (patch: Partial<AppStoreState>) => void
): void {
  if (!state) return;

  state.isHydrated = true;
  if (typeof state.isGuestMode !== 'boolean') {
    state.isGuestMode = false;
  }
  state.isLoggedOut = false;
  if (asyncUpdater && typeof queueMicrotask !== 'undefined') {
    queueMicrotask(() => {
      asyncUpdater({ isHydrated: true, isGuestMode: state.isGuestMode, isLoggedOut: false });
    });
  }

  state.levelCertifications = sanitizeLevelCertifications(state.levelCertifications);
  state.checkpointHistory = sanitizeCheckpointHistory(state.checkpointHistory);

  if (state.profile) {
    if (typeof state.profile.streak !== 'number' || state.profile.streak < 0 || Number.isNaN(state.profile.streak)) {
      state.profile.streak = 0;
    }
    if (typeof state.profile.longestStreak !== 'number' || state.profile.longestStreak < 0 || Number.isNaN(state.profile.longestStreak)) {
      state.profile.longestStreak = state.profile.streak || 0;
    } else {
      state.profile.longestStreak = Math.max(state.profile.longestStreak, state.profile.streak || 0);
    }
  }

  // Rehydration Hardening: Fallback defaults for legacy persisted storage
  if (!Array.isArray(state.claimedAchievementIds)) {
    state.claimedAchievementIds = [];
  }
  if (Array.isArray(state.achievements)) {
    for (const ach of state.achievements) {
      if (ach.unlockedAt && !state.claimedAchievementIds.includes(ach.id)) {
        state.claimedAchievementIds.push(ach.id);
      }
    }
  }
  if (!Array.isArray(state.recentReviewEvents)) {
    state.recentReviewEvents = [];
  }
  if (state.srsAlgorithm !== 'fsrs' && state.srsAlgorithm !== 'sm2') {
    state.srsAlgorithm = 'sm2';
  }
  if (!state.fsrsSettings) {
    state.fsrsSettings = { ...DEFAULT_FSRS_SETTINGS };
  }
  if (!state.wordLearningStats || typeof state.wordLearningStats !== 'object') {
    state.wordLearningStats = {};
  } else {
    state.wordLearningStats = sanitizeWordLearningStats(state.wordLearningStats);
  }

  state.adaptiveQuizTelemetry = sanitizeAdaptiveQuizTelemetryState(state.adaptiveQuizTelemetry);
  state.fourSkillsScores = sanitizeFourSkillsScores(state.fourSkillsScores);
  state.fourSkillsEvidence = sanitizeEvidenceStore(state.fourSkillsEvidence);
  state.fourSkillsCompletionProgress = sanitizeFourSkillsCompletionProgress(state.fourSkillsCompletionProgress);
  state.resumeActivities = pruneFinalizedCheckpointResumes(
    sanitizeResumeActivitiesMap(state.resumeActivities),
    state.checkpointHistory
  );

  // Auto backfill if evidence is empty but legacy scores exist
  const hasEvidence = Object.values(state.fourSkillsEvidence).some((arr) => arr.length > 0);
  const hasScores = Object.values(state.fourSkillsScores).some((arr) => arr.length > 0);
  if (!hasEvidence && hasScores) {
    state.fourSkillsEvidence = adaptLegacyFourSkillsScores(state.fourSkillsScores);
  }

  // Backward-compatible one-time migration for completed listening lessons from legacy localStorage key
  let legacyCompletedMigrated = false;
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const rawLegacyCompleted = localStorage.getItem('completed_listening_lessons');
      if (rawLegacyCompleted !== null) {
        try {
          const parsed = JSON.parse(rawLegacyCompleted);
          if (Array.isArray(parsed)) {
            const legacyIds = sanitizeStringIds(parsed);
            const currentIds = sanitizeStringIds(state.completedListeningLessonIds);
            state.completedListeningLessonIds = Array.from(new Set([...currentIds, ...legacyIds]));
            legacyCompletedMigrated = true;
          }
        } catch (parseErr) {
          console.warn('[Store Migration] Lỗi parse dữ liệu cũ completed_listening_lessons:', parseErr);
        }
        localStorage.removeItem('completed_listening_lessons');
      } else {
        state.completedListeningLessonIds = sanitizeStringIds(state.completedListeningLessonIds);
      }
    } else {
      state.completedListeningLessonIds = sanitizeStringIds(state.completedListeningLessonIds);
    }
  } catch {
    state.completedListeningLessonIds = sanitizeStringIds(state.completedListeningLessonIds);
  }

  if (legacyCompletedMigrated && asyncUpdater && typeof queueMicrotask !== 'undefined') {
    const migratedIds = state.completedListeningLessonIds;
    queueMicrotask(() => {
      asyncUpdater({ completedListeningLessonIds: migratedIds });
    });
  }

  // Backward-compatible one-time migration for completed reading, speaking, and writing lessons
  let legacyThreeSkillsMigrated = false;
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const legacyThreeSkillKeys: Array<{
        key: string;
        skill: keyof FourSkillsCompletionProgress;
      }> = [
        { key: 'completed_reading_lessons', skill: 'reading' },
        { key: 'completed_speaking_prompts', skill: 'speaking' },
        { key: 'completed_writing_prompts', skill: 'writing' },
      ];

      const currentProgress: FourSkillsCompletionProgress = {
        reading: sanitizeStringIds(state.fourSkillsCompletionProgress?.reading),
        speaking: sanitizeStringIds(state.fourSkillsCompletionProgress?.speaking),
        writing: sanitizeStringIds(state.fourSkillsCompletionProgress?.writing),
      };

      for (const { key, skill } of legacyThreeSkillKeys) {
        const rawLegacy = localStorage.getItem(key);
        if (rawLegacy !== null) {
          try {
            const parsed = JSON.parse(rawLegacy);
            if (Array.isArray(parsed)) {
              const legacyIds = sanitizeStringIds(parsed);
              currentProgress[skill] = Array.from(
                new Set([...currentProgress[skill], ...legacyIds])
              );
              legacyThreeSkillsMigrated = true;
              localStorage.removeItem(key);
            }
          } catch (parseErr) {
            console.warn(`[Store Migration] Lỗi parse dữ liệu cũ ${key}:`, parseErr);
          }
        }
      }

      state.fourSkillsCompletionProgress = currentProgress;
    } else {
      state.fourSkillsCompletionProgress = sanitizeFourSkillsCompletionProgress(state.fourSkillsCompletionProgress);
    }
  } catch (migErr) {
    console.warn('[Store Migration] Lỗi trong quá trình di chuyển 3 kỹ năng cũ:', migErr);
    state.fourSkillsCompletionProgress = sanitizeFourSkillsCompletionProgress(state.fourSkillsCompletionProgress);
  }

  if (legacyThreeSkillsMigrated && asyncUpdater && typeof queueMicrotask !== 'undefined') {
    const migratedProgress = state.fourSkillsCompletionProgress;
    queueMicrotask(() => {
      asyncUpdater({ fourSkillsCompletionProgress: migratedProgress });
    });
  }

  // ONE-TIME MIGRATION: Di chuyển các key rời rạc cũ vào Zustand store
  try {
    const skillKeyMap: Array<{ key: string; skill: 'listening' | 'reading' | 'speaking' | 'writing' }> = [
      { key: 'four_skills_listening_scores', skill: 'listening' },
      { key: 'four_skills_reading_scores', skill: 'reading' },
      { key: 'four_skills_speaking_scores', skill: 'speaking' },
      { key: 'four_skills_writing_scores', skill: 'writing' },
    ];

    const currentScores: FourSkillsScores = {
      listening: [...(state.fourSkillsScores?.listening || [])],
      reading: [...(state.fourSkillsScores?.reading || [])],
      speaking: [...(state.fourSkillsScores?.speaking || [])],
      writing: [...(state.fourSkillsScores?.writing || [])],
    };
    let scoresChanged = false;

    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      for (const { key, skill } of skillKeyMap) {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const validNumbers = parsed.filter(
                (item): item is number => typeof item === 'number' && !isNaN(item)
              );
              if (validNumbers.length > 0) {
                const existing = currentScores[skill];
                currentScores[skill] = [...existing, ...validNumbers].slice(-50);
                scoresChanged = true;
              }
            }
          } catch (parseErr) {
            console.warn(`[Store Migration] Lỗi parse dữ liệu cũ ${key}:`, parseErr);
          }
          localStorage.removeItem(key);
        }
      }

      const rawNightOwl = localStorage.getItem('learned_night_owl');
      if (rawNightOwl !== null) {
        try {
          if (rawNightOwl === 'true' || rawNightOwl === '1') {
            state.hasLearnedNightOwl = true;
          }
        } catch (parseErr) {
          console.warn('[Store Migration] Lỗi parse dữ liệu cũ learned_night_owl:', parseErr);
        }
        localStorage.removeItem('learned_night_owl');
      }
    }

    if (scoresChanged) {
      state.fourSkillsScores = currentScores;
    }
  } catch (migErr) {
    console.warn('[Store Migration] Quá trình migration dữ liệu rời rạc gặp lỗi:', migErr);
  }

  // Đối chiếu làm sạch dữ liệu dựa trên ground truth srsProgressMap
  if (state.dailyHistory) {
    const cleaned: Record<string, DailyProgress> = {};
    const srsEntries = Object.values(state.srsProgressMap || {});
    const realReviewsByDate: Record<string, number> = {};
    for (const item of srsEntries) {
      if (item.lastReviewedDate) {
        const dStr = getVietnamDateString(item.lastReviewedDate);
        if (dStr) {
          realReviewsByDate[dStr] = (realReviewsByDate[dStr] || 0) + 1;
        }
      }
    }

    for (const [date, val] of Object.entries(state.dailyHistory)) {
      if (!val) continue;
      const realReviews = realReviewsByDate[date] || 0;
      const safeReviewed = (val.wordsReviewed || 0) > Math.max(10, realReviews * 2)
        ? realReviews
        : Math.max(0, val.wordsReviewed || 0);
      const safeNew = (val.newWordsLearned || 0) > 50
        ? Math.min(realReviews, 15)
        : Math.max(0, val.newWordsLearned || 0);

      cleaned[date] = {
        ...val,
        wordsReviewed: safeReviewed,
        newWordsLearned: safeNew,
        xpGained: Math.min(2000, Math.max(0, val.xpGained || 0)),
      };
    }
    state.dailyHistory = cleaned;
  }

  // Đảm bảo mọi từ đã có trong srsProgressMap đều có firstLearnedAt lịch sử
  if (state.srsProgressMap) {
    for (const prog of Object.values(state.srsProgressMap)) {
      if (prog && !prog.firstLearnedAt) {
        prog.firstLearnedAt = prog.lastReviewedDate || '2026-08-01T00:00:00.000Z';
      }
    }
  }

  // Khi nạp xong từ LocalStorage, đồng bộ ngay danh sách từ vựng RAM đầy đủ
  state.vocabularyList = composeVocabularyList(state.srsProgressMap, state.userCustomWords);
}
