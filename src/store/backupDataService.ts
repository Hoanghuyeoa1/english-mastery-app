import type {
  AppStoreState,
  VocabWord,
  CollocationItem,
  SRSProgress,
  MistakeRecord,
  MistakeType,
  CanonicalMistakeSource,
  FourSkillsScores,
  FourSkillsEvidenceStore,
  FourSkillsCompletionProgress,
  SRSAlgorithmType,
  FSRSSettings,
  SRSReviewEvent,
} from '../types';
import {
  sanitizeResumeActivitiesMap,
} from '../services/learningContinuityService';
import {
  toCanonicalSource,
  toCanonicalType,
  canonicalizeSourceCounts,
} from '../services/adaptiveMistakeService';
import { DEFAULT_FSRS_SETTINGS } from '../services/fsrsAlgorithm';
import { sanitizeWordLearningStats } from '../services/wordUsageTelemetry';
import {
  sanitizeAdaptiveQuizTelemetryState,
} from '../services/adaptiveQuizTelemetryService';
import {
  adaptLegacyFourSkillsScores,
  sanitizeEvidenceStore,
} from '../services/competencyEvidenceService';
import {
  DEFAULT_FOUR_SKILLS_COMPLETION_PROGRESS,
  sanitizeFourSkillsScores,
  sanitizeStringIds,
  sanitizeFourSkillsCompletionProgress,
  sanitizeLevelCertifications,
  sanitizeCheckpointHistory,
  pruneFinalizedCheckpointResumes,
} from './fourSkillsSanitizers';
import { DEFAULT_PROFILE, INITIAL_ACHIEVEMENTS } from './initialDefaults';
import { composeVocabularyList } from './vocabularyComposer';

export function exportStoreBackup(state: AppStoreState): string {
  const exportObject = {
    app: 'EnglishMasteryHub',
    owner: state.profile.name || 'Học viên',
    exportedAt: new Date().toISOString(),
    version: '2.1.0',
    profile: state.profile,
    userCustomWords: state.userCustomWords,
    userCollocations: state.userCollocations,
    srsProgressMap: state.srsProgressMap,
    mistakeBank: state.mistakeBank,
    dailyHistory: state.dailyHistory,
    achievements: state.achievements,
    claimedAchievementIds: state.claimedAchievementIds || [],
    fourSkillsScores: state.fourSkillsScores,
    fourSkillsEvidence: state.fourSkillsEvidence,
    completedListeningLessonIds: state.completedListeningLessonIds || [],
    fourSkillsCompletionProgress: state.fourSkillsCompletionProgress || DEFAULT_FOUR_SKILLS_COMPLETION_PROGRESS,
    hasLearnedNightOwl: state.hasLearnedNightOwl,
    srsAlgorithm: state.srsAlgorithm,
    fsrsSettings: state.fsrsSettings,
    recentReviewEvents: state.recentReviewEvents || [],
    wordLearningStats: state.wordLearningStats || {},
    resumeActivities: sanitizeResumeActivitiesMap(state.resumeActivities),
    levelCertifications: sanitizeLevelCertifications(state.levelCertifications),
    checkpointHistory: sanitizeCheckpointHistory(state.checkpointHistory),
  };
  return JSON.stringify(exportObject, null, 2);
}

export function importStoreBackup(
  set: (stateUpdate: Partial<AppStoreState>) => void,
  jsonData: string
): { success: boolean; message: string } {
  try {
    const parsed = JSON.parse(jsonData);
    if (!parsed.profile) {
      return { success: false, message: 'Dữ liệu không đúng định dạng sao lưu của ứng dụng.' };
    }

    const customWords: VocabWord[] = parsed.userCustomWords || parsed.vocabularyList || [];
    const userCollocs: CollocationItem[] = Array.isArray(parsed.userCollocations) ? parsed.userCollocations : [];
    const srsMap: Record<string, SRSProgress> = parsed.srsProgressMap || {};
    const rawMistakeBank = parsed.mistakeBank || {};
    const migratedMistakeBank: Record<string, MistakeRecord> = {};
    if (rawMistakeBank && typeof rawMistakeBank === 'object') {
      for (const [key, item] of Object.entries(rawMistakeBank)) {
        if (!item || typeof item !== 'object' || !(item as any).word) continue;
        const rawItem = item as any;
        const canonicalSource = toCanonicalSource(rawItem.source || 'custom');
        const canonicalType = toCanonicalType(rawItem.primaryType, canonicalSource);
        const count = rawItem.mistakeCount ?? rawItem.wrongCount ?? 1;

        const typeCounts: Partial<Record<MistakeType, number>> =
          rawItem.typeCounts && typeof rawItem.typeCounts === 'object'
            ? { ...rawItem.typeCounts }
            : { [canonicalType]: count };

        const sourceCounts: Partial<Record<CanonicalMistakeSource, number>> =
          canonicalizeSourceCounts(rawItem.sourceCounts || { [canonicalSource]: count });

        migratedMistakeBank[key] = {
          id: rawItem.id || `mistake_${rawItem.word.toLowerCase()}`,
          word: rawItem.word,
          ipa: rawItem.ipa,
          meaning: rawItem.meaning || '',
          example: rawItem.example,
          tag: rawItem.tag || 'Daily',
          mistakeCount: count,
          wrongCount: rawItem.wrongCount ?? count,
          lastMistakeAt: rawItem.lastMistakeAt || new Date().toISOString(),
          consecutiveCorrect: rawItem.consecutiveCorrect ?? 0,
          resolved: Boolean(rawItem.resolved),
          resolvedDate: rawItem.resolvedDate,
          source: canonicalSource,
          primaryType: rawItem.primaryType || canonicalType,
          typeCounts,
          sourceCounts,
          reopenCount: rawItem.reopenCount ?? 0,
          firstSeenAt: rawItem.firstSeenAt,
          lastCorrectAt: rawItem.lastCorrectAt,
          lastUserAnswer: rawItem.lastUserAnswer,
          lastExpectedAnswer: rawItem.lastExpectedAnswer,
          lastContext: rawItem.lastContext,
          typeResolutionMap: rawItem.typeResolutionMap,
        };
      }
    }
    const fourSkillsScores: FourSkillsScores = sanitizeFourSkillsScores(parsed.fourSkillsScores);
    const fourSkillsEvidence: FourSkillsEvidenceStore = parsed.fourSkillsEvidence
      ? sanitizeEvidenceStore(parsed.fourSkillsEvidence)
      : adaptLegacyFourSkillsScores(fourSkillsScores);
    const completedListeningLessonIds: string[] = sanitizeStringIds(
      parsed.completedListeningLessonIds || parsed.completed_listening_lessons || []
    );
    const fourSkillsCompletionProgress: FourSkillsCompletionProgress =
      sanitizeFourSkillsCompletionProgress(
        parsed.fourSkillsCompletionProgress || {
          reading: parsed.completed_reading_lessons || parsed.completedReadingLessonIds || [],
          speaking: parsed.completed_speaking_prompts || parsed.completedSpeakingPromptIds || [],
          writing: parsed.completed_writing_prompts || parsed.completedWritingPromptIds || [],
        }
      );
    const hasLearnedNightOwl: boolean = Boolean(parsed.hasLearnedNightOwl);
    const srsAlgorithm: SRSAlgorithmType =
      parsed.srsAlgorithm === 'fsrs' || parsed.srsAlgorithm === 'sm2'
        ? parsed.srsAlgorithm
        : 'sm2';
    const fsrsSettings: FSRSSettings = {
      ...DEFAULT_FSRS_SETTINGS,
      ...(parsed.fsrsSettings && typeof parsed.fsrsSettings === 'object' ? parsed.fsrsSettings : {}),
    };
    const recentReviewEvents: SRSReviewEvent[] = Array.isArray(parsed.recentReviewEvents)
      ? parsed.recentReviewEvents.slice(0, 200)
      : [];
    const wordLearningStats = sanitizeWordLearningStats(parsed.wordLearningStats);
    const adaptiveQuizTelemetry = sanitizeAdaptiveQuizTelemetryState(parsed.adaptiveQuizTelemetry);
    const rawResumeActivities = sanitizeResumeActivitiesMap(parsed.resumeActivities);
    const levelCertifications = sanitizeLevelCertifications(parsed.levelCertifications);
    const checkpointHistory = sanitizeCheckpointHistory(parsed.checkpointHistory);
    const resumeActivities = pruneFinalizedCheckpointResumes(rawResumeActivities, checkpointHistory);

    set({
      profile: {
        ...DEFAULT_PROFILE,
        ...parsed.profile,
        isOnboarded: true,
      },
      userCustomWords: customWords,
      userCollocations: userCollocs,
      srsProgressMap: srsMap,
      mistakeBank: migratedMistakeBank,
      vocabularyList: composeVocabularyList(srsMap, customWords),
      dailyHistory: parsed.dailyHistory || {},
      achievements: parsed.achievements || INITIAL_ACHIEVEMENTS,
      claimedAchievementIds: Array.isArray(parsed.claimedAchievementIds) ? parsed.claimedAchievementIds : [],
      fourSkillsScores,
      fourSkillsEvidence,
      completedListeningLessonIds,
      fourSkillsCompletionProgress,
      hasLearnedNightOwl,
      srsAlgorithm,
      fsrsSettings,
      recentReviewEvents,
      wordLearningStats,
      adaptiveQuizTelemetry,
      resumeActivities,
      levelCertifications,
      checkpointHistory,
    });

    return { success: true, message: 'Khôi phục dữ liệu học tập thành công!' };
  } catch (err: any) {
    return { success: false, message: `Lỗi đọc file: ${err?.message || 'File JSON không hợp lệ'}` };
  }
}
