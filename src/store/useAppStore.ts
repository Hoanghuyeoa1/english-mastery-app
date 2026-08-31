import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserProfile, VocabWord, DailyProgress, SRSGrade, Achievement, VocabTag } from '../types';
import { calculateSM2 } from '../services/srsAlgorithm';
import { INITIAL_VOCABULARY } from '../data/defaultVocab';

const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'streak_3',
    title: 'Ngọn Lửa Bùng Cháy 🔥',
    description: 'Duy trì chuỗi học liên tục trong 3 ngày',
    icon: 'Flame',
    unlockedAt: null,
    category: 'streak',
    target: 3,
    progress: 0,
  },
  {
    id: 'streak_7',
    title: 'Chiến Binh Kỷ Luật 🛡️',
    description: 'Duy trì chuỗi học liên tục trong 7 ngày',
    icon: 'Award',
    unlockedAt: null,
    category: 'streak',
    target: 7,
    progress: 0,
  },
  {
    id: 'vocab_10',
    title: 'Nhập Môn Từ Vựng 📚',
    description: 'Ôn tập và tích lũy ít nhất 10 từ vựng',
    icon: 'BookOpen',
    unlockedAt: null,
    category: 'vocab',
    target: 10,
    progress: 0,
  },
  {
    id: 'vocab_25',
    title: 'Bậc Thầy Trí Nhớ 🧠',
    description: 'Ôn tập thành công 25 lượt từ vựng qua SRS',
    icon: 'Brain',
    unlockedAt: null,
    category: 'vocab',
    target: 25,
    progress: 0,
  },
  {
    id: 'xp_500',
    title: 'Thợ Săn Điểm Thưởng ⭐',
    description: 'Đạt mốc 500 XP kinh nghiệm',
    icon: 'Star',
    unlockedAt: null,
    category: 'xp',
    target: 500,
    progress: 0,
  },
  {
    id: 'quiz_10',
    title: 'Chiến Tướng Trắc Nghiệm 🎯',
    description: 'Hoàn thành 10 bài luyện tập hoàn hảo',
    icon: 'Target',
    unlockedAt: null,
    category: 'quiz',
    target: 10,
    progress: 0,
  }
];

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  level: 1,
  xp: 0,
  streak: 1,
  lastActiveDate: new Date().toISOString().split('T')[0],
  lastStudyDate: new Date().toISOString().split('T')[0],
  hearts: 5,
  maxHearts: 5,
  avatarSeed: 'Learner',
  targetDailyWords: 15,
  targetDailyNewWords: 15,
  extraNewWordsBonus: 0,
  isOnboarded: false,
  targetGoal: 'daily',
};

interface AppStoreState {
  profile: UserProfile;
  vocabularyList: VocabWord[];
  dailyHistory: Record<string, DailyProgress>;
  achievements: Achievement[];
  audioVoice: 'en-US' | 'en-GB';
  audioSpeed: number;
  autoPlayAudio: boolean;
  isMaskExample: boolean;
  geminiApiKey: string;

  // Actions
  setProfileName: (name: string, targetGoal?: UserProfile['targetGoal']) => void;
  setAudioVoice: (voice: 'en-US' | 'en-GB') => void;
  setAudioSpeed: (speed: number) => void;
  setAutoPlayAudio: (enabled: boolean) => void;
  setIsMaskExample: (enabled: boolean) => void;
  setGeminiApiKey: (key: string) => void;
  toggleFavorite: (wordId: string) => void;
  gainXP: (amount: number) => { leveledUp: boolean; newLevel: number };
  consumeHeart: () => boolean;
  refillHearts: () => void;
  checkAndUpdateStreak: () => void;
  checkDailyReset: () => void;
  setDailyNewWordsLimit: (limit: number) => void;
  addExtraNewWords: (count: number) => void;
  processReview: (wordId: string, grade: SRSGrade) => void;
  recordQuizCompleted: (xpEarned: number, isPerfect: boolean) => void;
  recordPronunciationMastered: (xpEarned: number) => void;
  addCustomWord: (word: Omit<VocabWord, 'id' | 'srsLevel' | 'interval' | 'easeFactor' | 'nextReviewDate'>) => void;
  addBatchWords: (words: Array<Omit<VocabWord, 'id' | 'srsLevel' | 'interval' | 'easeFactor' | 'nextReviewDate'>>) => number;
  syncVocab5000: () => number;
  syncVocab1000: () => number;
  deleteWord: (wordId: string) => void;
  updateWord: (word: VocabWord) => void;
  checkAchievements: () => void;
  exportBackupData: () => string;
  importBackupData: (jsonData: string) => { success: boolean; message: string };
  resetToDefault: () => void;
}

export const useAppStore = create<AppStoreState>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_PROFILE,
      vocabularyList: INITIAL_VOCABULARY,
      dailyHistory: {},
      achievements: INITIAL_ACHIEVEMENTS,
      audioVoice: 'en-US',
      audioSpeed: 0.85,
      autoPlayAudio: true,
      isMaskExample: false,
      geminiApiKey: '',

      setProfileName: (name, targetGoal = 'daily') => {
        const cleanName = name.trim();
        set((state) => ({
          profile: {
            ...state.profile,
            name: cleanName,
            avatarSeed: cleanName || 'Learner',
            isOnboarded: true,
            targetGoal,
          },
        }));
      },

      setAudioVoice: (voice) => set({ audioVoice: voice }),
      setAudioSpeed: (speed) => set({ audioSpeed: speed }),
      setAutoPlayAudio: (enabled) => set({ autoPlayAudio: enabled }),
      setIsMaskExample: (enabled) => set({ isMaskExample: enabled }),
      setGeminiApiKey: (key) => set({ geminiApiKey: key }),

      toggleFavorite: (wordId) => {
        set((state) => ({
          vocabularyList: state.vocabularyList.map((w) =>
            w.id === wordId ? { ...w, isFavorite: !w.isFavorite } : w
          ),
        }));
      },

      checkDailyReset: () => {
        const today = new Date().toISOString().split('T')[0];
        const { lastStudyDate } = get().profile;

        if (!lastStudyDate || lastStudyDate !== today) {
          set((state) => ({
            profile: {
              ...state.profile,
              lastStudyDate: today,
              extraNewWordsBonus: 0,
              targetDailyNewWords: state.profile.targetDailyNewWords || 15,
            },
          }));
        }

        // Tự động đồng bộ lên đủ 5.000 từ nếu kho từ vựng hiện tại chưa đủ
        if (get().vocabularyList.length < 5000) {
          get().syncVocab5000();
        }
      },

      setDailyNewWordsLimit: (limit: number) => {
        set((state) => ({
          profile: {
            ...state.profile,
            targetDailyNewWords: limit,
            targetDailyWords: limit,
          },
        }));
      },

      addExtraNewWords: (count: number) => {
        set((state) => ({
          profile: {
            ...state.profile,
            extraNewWordsBonus: (state.profile.extraNewWordsBonus || 0) + count,
          },
        }));
      },

      checkAndUpdateStreak: () => {
        const today = new Date().toISOString().split('T')[0];
        const { lastActiveDate, streak } = get().profile;

        if (lastActiveDate === today) return;

        if (!lastActiveDate) {
          set((state) => ({
            profile: { ...state.profile, streak: 1, lastActiveDate: today },
          }));
          return;
        }

        const prev = new Date(lastActiveDate);
        const curr = new Date(today);
        const diffTime = curr.getTime() - prev.getTime();
        const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

        if (diffDays === 1) {
          // Chuỗi ngày tiếp tục
          set((state) => ({
            profile: { ...state.profile, streak: streak + 1, lastActiveDate: today },
          }));
        } else if (diffDays > 1) {
          // Đứt chuỗi, bắt đầu lại 1
          set((state) => ({
            profile: { ...state.profile, streak: 1, lastActiveDate: today },
          }));
        }
      },

      gainXP: (amount: number) => {
        get().checkAndUpdateStreak();
        let leveledUp = false;
        let finalLevel = 1;

        set((state) => {
          const currentXP = state.profile.xp;
          const newXP = currentXP + amount;
          const oldLevel = state.profile.level;
          const newLevel = Math.floor(newXP / 100) + 1;

          if (newLevel > oldLevel) {
            leveledUp = true;
          }
          finalLevel = newLevel;

          const today = new Date().toISOString().split('T')[0];
          const todayProgress = state.dailyHistory[today] || {
            date: today,
            wordsReviewed: 0,
            newWordsLearned: 0,
            quizzesCompleted: 0,
            pronunciationsMastered: 0,
            xpGained: 0,
          };

          return {
            profile: {
              ...state.profile,
              xp: newXP,
              level: newLevel,
              hearts: leveledUp ? state.profile.maxHearts : state.profile.hearts, // Hồi đầy tim khi lên cấp
            },
            dailyHistory: {
              ...state.dailyHistory,
              [today]: {
                ...todayProgress,
                xpGained: todayProgress.xpGained + amount,
              },
            },
          };
        });

        get().checkAchievements();
        return { leveledUp, newLevel: finalLevel };
      },

      consumeHeart: () => {
        const currentHearts = get().profile.hearts;
        if (currentHearts <= 0) return false;
        set((state) => ({
          profile: { ...state.profile, hearts: Math.max(0, state.profile.hearts - 1) },
        }));
        return true;
      },

      refillHearts: () => {
        set((state) => ({
          profile: { ...state.profile, hearts: state.profile.maxHearts },
        }));
      },

      processReview: (wordId: string, grade: SRSGrade) => {
        const state = get();
        const word = state.vocabularyList.find((v) => v.id === wordId);
        if (!word) return;

        const wasNewWord = (word.srsLevel === 0 && !word.lastReviewedDate);
        const sm2 = calculateSM2(grade, word.interval, word.srsLevel, word.easeFactor);
        const updatedWord: VocabWord = {
          ...word,
          ...sm2,
          lastReviewedDate: new Date().toISOString(),
        };

        const today = new Date().toISOString().split('T')[0];
        const currentDaily = state.dailyHistory[today] || {
          date: today,
          wordsReviewed: 0,
          newWordsLearned: 0,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
          xpGained: 0,
        };

        set({
          vocabularyList: state.vocabularyList.map((v) => (v.id === wordId ? updatedWord : v)),
          dailyHistory: {
            ...state.dailyHistory,
            [today]: {
              ...currentDaily,
              wordsReviewed: wasNewWord ? currentDaily.wordsReviewed : currentDaily.wordsReviewed + 1,
              newWordsLearned: wasNewWord ? currentDaily.newWordsLearned + 1 : currentDaily.newWordsLearned,
            },
          },
        });

        // Thưởng XP theo mức độ nhớ
        const xpReward = grade === 3 ? 15 : grade === 2 ? 10 : grade === 1 ? 5 : 2;
        get().gainXP(xpReward);
      },

      recordQuizCompleted: (xpEarned: number, isPerfect: boolean) => {
        const today = new Date().toISOString().split('T')[0];
        const currentDaily = get().dailyHistory[today] || {
          date: today,
          wordsReviewed: 0,
          newWordsLearned: 0,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
          xpGained: 0,
        };

        set((state) => ({
          dailyHistory: {
            ...state.dailyHistory,
            [today]: {
              ...currentDaily,
              quizzesCompleted: currentDaily.quizzesCompleted + 1,
            },
          },
        }));

        get().gainXP(xpEarned + (isPerfect ? 10 : 0));
      },

      recordPronunciationMastered: (xpEarned: number) => {
        const today = new Date().toISOString().split('T')[0];
        const currentDaily = get().dailyHistory[today] || {
          date: today,
          wordsReviewed: 0,
          newWordsLearned: 0,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
          xpGained: 0,
        };

        set((state) => ({
          dailyHistory: {
            ...state.dailyHistory,
            [today]: {
              ...currentDaily,
              pronunciationsMastered: currentDaily.pronunciationsMastered + 1,
            },
          },
        }));

        get().gainXP(xpEarned);
      },

      addCustomWord: (wordData) => {
        const newWord: VocabWord = {
          ...wordData,
          id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          srsLevel: 0,
          interval: 0,
          easeFactor: 2.5,
          nextReviewDate: new Date().toISOString(),
        };

        set((state) => ({
          vocabularyList: [newWord, ...state.vocabularyList],
        }));
        get().gainXP(15);
      },

      addBatchWords: (wordsData) => {
        if (!wordsData.length) return 0;

        const newWords: VocabWord[] = wordsData.map((w, idx) => ({
          ...w,
          id: `bulk_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
          srsLevel: 0,
          interval: 0,
          easeFactor: 2.5,
          nextReviewDate: new Date().toISOString(),
        }));

        set((state) => ({
          vocabularyList: [...newWords, ...state.vocabularyList],
        }));

        const earnedXP = Math.min(200, wordsData.length * 10);
        get().gainXP(earnedXP);
        return newWords.length;
      },

      syncVocab5000: () => {
        const currentList = get().vocabularyList;
        const existingWordMap = new Set(currentList.map((w) => w.word.toLowerCase().trim()));
        
        // Lấy các từ mới trong bộ 5000 từ chưa có trong kho
        const missingWords = INITIAL_VOCABULARY.filter(
          (w) => !existingWordMap.has(w.word.toLowerCase().trim())
        );

        if (missingWords.length === 0) return 0;

        set({
          vocabularyList: [...currentList, ...missingWords],
        });

        return missingWords.length;
      },

      syncVocab1000: () => {
        return get().syncVocab5000();
      },

      deleteWord: (wordId: string) => {
        set((state) => ({
          vocabularyList: state.vocabularyList.filter((w) => w.id !== wordId),
        }));
      },

      updateWord: (updated) => {
        set((state) => ({
          vocabularyList: state.vocabularyList.map((w) => (w.id === updated.id ? updated : w)),
        }));
      },

      checkAchievements: () => {
        const { profile, vocabularyList, achievements, dailyHistory } = get();
        const totalReviews = Object.values(dailyHistory).reduce((acc, curr) => acc + curr.wordsReviewed, 0);
        const totalQuizzes = Object.values(dailyHistory).reduce((acc, curr) => acc + curr.quizzesCompleted, 0);

        const updatedAchievements = achievements.map((ach) => {
          if (ach.unlockedAt) return ach; // Already unlocked

          let currentProgress = 0;
          if (ach.category === 'streak') currentProgress = profile.streak;
          if (ach.category === 'xp') currentProgress = profile.xp;
          if (ach.category === 'vocab') currentProgress = Math.max(vocabularyList.length, totalReviews);
          if (ach.category === 'quiz') currentProgress = totalQuizzes;

          const isUnlocked = currentProgress >= ach.target;
          return {
            ...ach,
            progress: currentProgress,
            unlockedAt: isUnlocked ? new Date().toISOString() : null,
          };
        });

        set({ achievements: updatedAchievements });
      },

      exportBackupData: () => {
        const state = get();
        const exportObject = {
          app: 'EnglishMasteryHub',
          owner: state.profile.name || 'Học viên',
          exportedAt: new Date().toISOString(),
          version: '2.0.0',
          profile: state.profile,
          vocabularyList: state.vocabularyList,
          dailyHistory: state.dailyHistory,
          achievements: state.achievements,
        };
        return JSON.stringify(exportObject, null, 2);
      },

      importBackupData: (jsonData: string) => {
        try {
          const parsed = JSON.parse(jsonData);
          if (!parsed.profile || !parsed.vocabularyList || !Array.isArray(parsed.vocabularyList)) {
            return { success: false, message: 'Dữ liệu không đúng định dạng sao lưu của ứng dụng.' };
          }

          set({
            profile: {
              ...DEFAULT_PROFILE,
              ...parsed.profile,
              isOnboarded: true,
            },
            vocabularyList: parsed.vocabularyList,
            dailyHistory: parsed.dailyHistory || {},
            achievements: parsed.achievements || INITIAL_ACHIEVEMENTS,
          });

          return { success: true, message: 'Khôi phục dữ liệu học tập thành công!' };
        } catch (err: any) {
          return { success: false, message: `Lỗi đọc file: ${err?.message || 'File JSON không hợp lệ'}` };
        }
      },

      resetToDefault: () => {
        set({
          profile: {
            ...DEFAULT_PROFILE,
            name: '',
            isOnboarded: false,
          },
          vocabularyList: INITIAL_VOCABULARY,
          dailyHistory: {},
          achievements: INITIAL_ACHIEVEMENTS,
        });
      },
    }),
    {
      name: 'english_mastery_storage_v2',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
