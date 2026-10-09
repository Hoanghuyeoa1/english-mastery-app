import type { VocabWord, SRSProgress, AppStoreState } from '../../types';
import { cleanWordToken, resolveCanonicalVocab } from '../../services/wordLookupService';
import { emitLearnWordEvent } from '../../services/learnWordEventService';
import { clearUnifiedCardsCache, composeVocabularyList } from '../vocabularyComposer';
import { clearAllTutorSessions } from '../../services/tutorSessionStorage';
import { DEFAULT_PROFILE, INITIAL_ACHIEVEMENTS } from '../initialDefaults';
import { DEFAULT_FOUR_SKILLS_SCORES } from '../fourSkillsSanitizers';
import { EMPTY_FOUR_SKILLS_EVIDENCE } from '../../services/competencyEvidenceService';
import { DEFAULT_FSRS_SETTINGS } from '../../services/fsrsAlgorithm';
import { createDefaultAdaptiveQuizTelemetryState } from '../../services/adaptiveQuizTelemetryService';

type SetState = (
  partial: Partial<AppStoreState> | ((state: AppStoreState) => Partial<AppStoreState>),
  replace?: boolean
) => void;
type GetState = () => AppStoreState;

export const createVocabularySlice = (
  set: SetState,
  get: GetState
) => ({
  toggleFavorite: (wordId: string) => {
    set((state) => {
      const currentWord = state.vocabularyList.find((w) => w.id === wordId);
      const currentProg = state.srsProgressMap[wordId] || {
        srsLevel: currentWord?.srsLevel || 0,
        nextReviewDate: currentWord?.nextReviewDate || new Date().toISOString(),
        interval: currentWord?.interval || 0,
        easeFactor: currentWord?.easeFactor || 2.5,
        lastReviewedDate: currentWord?.lastReviewedDate,
        isFavorite: false,
      };

      const newProg: SRSProgress = {
        ...currentProg,
        isFavorite: !currentProg.isFavorite,
      };

      const newSrsMap = {
        ...state.srsProgressMap,
        [wordId]: newProg,
      };

      return {
        srsProgressMap: newSrsMap,
        vocabularyList: state.vocabularyList.map((w) =>
          w.id === wordId ? { ...w, isFavorite: newProg.isFavorite } : w
        ),
      };
    });
  },

  addCustomWord: (
    wordData: Omit<VocabWord, 'id' | 'srsLevel' | 'nextReviewDate' | 'interval' | 'easeFactor'>
  ) => {
    const state = get();
    const resolution = resolveCanonicalVocab(wordData, state.vocabularyList);
    const cleanWord = cleanWordToken(wordData.word || '');
    const canonicalId = resolution?.canonicalId || (cleanWord ? `custom_${cleanWord}` : `custom_${Date.now()}`);

    const existingProgress = state.srsProgressMap[canonicalId] || (cleanWord ? state.srsProgressMap[cleanWord] : undefined);

    const incomingSources: string[] = [];
    if (Array.isArray(wordData.sources)) {
      incomingSources.push(...wordData.sources);
    } else if ((wordData as any).source && typeof (wordData as any).source === 'string') {
      incomingSources.push((wordData as any).source);
    } else {
      incomingSources.push('dictionary');
    }
    const cleanIncomingSources = Array.from(new Set(incomingSources.map((s) => s.toLowerCase().trim()).filter(Boolean)));
    const mergedSources = Array.from(new Set([...(existingProgress?.sources || []), ...cleanIncomingSources]));

    const newWord: VocabWord = {
      ...wordData,
      id: canonicalId,
      srsLevel: existingProgress?.srsLevel ?? 0,
      interval: existingProgress?.interval ?? 0,
      easeFactor: existingProgress?.easeFactor ?? 2.5,
      nextReviewDate: existingProgress?.nextReviewDate || new Date().toISOString(),
      lastReviewedDate: existingProgress?.lastReviewedDate,
      firstLearnedAt: existingProgress?.firstLearnedAt,
      sources: mergedSources,
    };

    set((prevState) => {
      const existsInCustom = prevState.userCustomWords.some(
        (w) => w.id === canonicalId || (cleanWord && w.word.toLowerCase().trim() === cleanWord)
      );

      const nextCustomWords = existsInCustom
        ? prevState.userCustomWords.map((w) =>
            w.id === canonicalId || (cleanWord && w.word.toLowerCase().trim() === cleanWord)
              ? { ...w, ...newWord }
              : w
          )
        : [newWord, ...prevState.userCustomWords];

      let foundInList = false;
      const nextVocabList = prevState.vocabularyList.map((w) => {
        if (w.id === canonicalId || (cleanWord && w.word.toLowerCase().trim() === cleanWord)) {
          foundInList = true;
          return { ...w, ...newWord };
        }
        return w;
      });
      if (!foundInList) {
        nextVocabList.unshift(newWord);
      }

      const updatedSrsMap = { ...prevState.srsProgressMap };
      if (existingProgress) {
        updatedSrsMap[canonicalId] = {
          ...existingProgress,
          sources: mergedSources,
        };
      }

      return {
        srsProgressMap: updatedSrsMap,
        userCustomWords: nextCustomWords,
        vocabularyList: nextVocabList,
      };
    });

    get().gainXP(20);

    // Phase 6: Emit Domain Event for learn_word
    // Executed only AFTER local commit and XP reward have safely committed.
    emitLearnWordEvent({
      wordId: canonicalId,
      word: wordData.word.trim(),
      meaning: wordData.meaning,
      contextSentence: wordData.example,
      source: (wordData as any).source || 'manual',
      sources: cleanIncomingSources.length > 0 ? cleanIncomingSources : ['manual'],
      isCustom: true,
    });
  },

  addBatchWords: (
    wordsData: Omit<VocabWord, 'id' | 'srsLevel' | 'nextReviewDate' | 'interval' | 'easeFactor'>[]
  ) => {
    const newWords: VocabWord[] = wordsData.map((w, idx) => ({
      ...w,
      id: `bulk_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      srsLevel: 0,
      interval: 0,
      easeFactor: 2.5,
      nextReviewDate: new Date().toISOString(),
    }));

    set((state) => {
      const updatedCustom = [...newWords, ...state.userCustomWords];
      return {
        userCustomWords: updatedCustom,
        vocabularyList: [...newWords, ...state.vocabularyList],
      };
    });

    const earnedXP = Math.min(200, wordsData.length * 10);
    get().gainXP(earnedXP);
    return newWords.length;
  },

  deleteWord: (wordId: string) => {
    set((state) => ({
      userCustomWords: state.userCustomWords.filter((w) => w.id !== wordId),
      vocabularyList: state.vocabularyList.filter((w) => w.id !== wordId),
    }));
  },

  updateWord: (updated: VocabWord) => {
    set((state) => ({
      userCustomWords: state.userCustomWords.map((w) => (w.id === updated.id ? updated : w)),
      vocabularyList: state.vocabularyList.map((w) => (w.id === updated.id ? updated : w)),
    }));
  },

  resetVocabularyProgress: () => {
    set((state) => ({
      srsProgressMap: {},
      wordLearningStats: {},
      vocabularyList: composeVocabularyList({}, state.userCustomWords),
    }));
  },

  resetToDefault: () => {
    clearUnifiedCardsCache();
    clearAllTutorSessions();
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const legacySkillKeys = [
          'completed_listening_lessons',
          'completed_reading_lessons',
          'completed_speaking_prompts',
          'completed_writing_prompts',
        ];
        legacySkillKeys.forEach((k) => localStorage.removeItem(k));
      } catch {
        // ignore
      }
    }
    set({
      profile: {
        ...DEFAULT_PROFILE,
        name: '',
        level: 1,
        xp: 0,
        streak: 0,
        equippedTitle: 'Tân thủ',
        isOnboarded: false,
      },
      userCustomWords: [],
      userCollocations: [],
      srsProgressMap: {},
      mistakeBank: {},
      vocabularyList: composeVocabularyList({}, []),
      dailyHistory: {},
      achievements: INITIAL_ACHIEVEMENTS,
      claimedAchievementIds: [],
      fourSkillsScores: DEFAULT_FOUR_SKILLS_SCORES,
      fourSkillsEvidence: EMPTY_FOUR_SKILLS_EVIDENCE,
      completedListeningLessonIds: [],
      fourSkillsCompletionProgress: {
        reading: [],
        speaking: [],
        writing: [],
      },
      hasLearnedNightOwl: false,
      wordLearningStats: {},
      adaptiveQuizTelemetry: createDefaultAdaptiveQuizTelemetryState(),
      srsAlgorithm: 'sm2',
      fsrsSettings: DEFAULT_FSRS_SETTINGS,
      recentReviewEvents: [],
      resumeActivities: {},
      completedQuizSessionIds: [],
      processedXpKeys: [],
      processedMistakeKeys: [],
      levelCertifications: {},
      checkpointHistory: [],
    });
  },
});
