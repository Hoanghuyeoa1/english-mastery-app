import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserProfile, VocabWord, DailyProgress, SRSGrade, Achievement, VocabTag, MistakeRecord } from '../types';
import { calculateSM2 } from '../services/srsAlgorithm';
import { VOCAB_10000_BANK } from '../data/defaultVocab';
import { calculateLevelFromXp } from '../utils/userRank';

export interface SRSProgress {
  srsLevel: number;
  nextReviewDate: string;
  interval: number;
  easeFactor: number;
  lastReviewedDate?: string;
  isFavorite?: boolean;
}

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

// Hàm kết hợp RAM static bank 10.600 từ + custom words + srsProgressMap
function composeVocabularyList(
  srsMap: Record<string, SRSProgress> = {},
  customWords: VocabWord[] = []
): VocabWord[] {
  const combined = [...customWords, ...VOCAB_10000_BANK];
  const uniqueMap = new Map<string, VocabWord>();

  for (let i = 0; i < combined.length; i++) {
    const w = combined[i];
    const key = w.word.toLowerCase().trim();
    if (!uniqueMap.has(key)) {
      const progress = srsMap[w.id] || srsMap[key];
      if (progress) {
        uniqueMap.set(key, {
          ...w,
          srsLevel: progress.srsLevel ?? w.srsLevel ?? 0,
          nextReviewDate: progress.nextReviewDate || w.nextReviewDate || new Date().toISOString(),
          interval: progress.interval ?? w.interval ?? 0,
          easeFactor: progress.easeFactor ?? w.easeFactor ?? 2.5,
          lastReviewedDate: progress.lastReviewedDate || w.lastReviewedDate,
          isFavorite: progress.isFavorite ?? w.isFavorite ?? false,
        });
      } else {
        uniqueMap.set(key, w);
      }
    }
  }

  return Array.from(uniqueMap.values());
}

interface AppStoreState {
  profile: UserProfile;
  userCustomWords: VocabWord[];
  srsProgressMap: Record<string, SRSProgress>;
  vocabularyList: VocabWord[]; // In-memory unified bank
  mistakeBank: Record<string, MistakeRecord>; // Sổ tay bẫy lỗi sai
  dailyHistory: Record<string, DailyProgress>;
  achievements: Achievement[];
  audioVoice: 'en-US' | 'en-GB';
  audioSpeed: number;
  autoPlayAudio: boolean;
  isMaskExample: boolean;
  geminiApiKey: string;
  activeFourSkill: 'listening' | 'reading' | 'speaking' | 'writing';

  // Actions
  setActiveFourSkill: (skill: 'listening' | 'reading' | 'speaking' | 'writing') => void;
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
  recordMistake: (
    word: Partial<VocabWord> & { word: string; meaning?: string },
    source?: MistakeRecord['source']
  ) => void;
  recordMistakeCorrect: (wordIdOrText: string) => void;
  removeMistake: (wordIdOrText: string) => void;
  clearResolvedMistakes: () => void;
  clearAllMistakes: () => void;
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
  resetVocabularyProgress: () => void;
  resetToDefault: () => void;
}

// Storage wrapper với auto-migration & quota safety
const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      const raw = localStorage.getItem(name);
      if (!raw) return null;

      // Kiểm tra nếu dữ liệu cũ chứa mảng 10.000 từ vựng (> 1.5MB), migrate trích xuất phần cần thiết
      if (raw.length > 1500000) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.state) {
            const s = parsed.state;
            const migratedSrsMap: Record<string, SRSProgress> = s.srsProgressMap || {};
            
            // Trích xuất trạng thái SRS từ vocabularyList cũ nếu có
            if (Array.isArray(s.vocabularyList)) {
              s.vocabularyList.forEach((w: VocabWord) => {
                if (w.srsLevel > 0 || w.isFavorite || w.lastReviewedDate) {
                  migratedSrsMap[w.id] = {
                    srsLevel: w.srsLevel,
                    nextReviewDate: w.nextReviewDate,
                    interval: w.interval,
                    easeFactor: w.easeFactor,
                    lastReviewedDate: w.lastReviewedDate,
                    isFavorite: w.isFavorite,
                  };
                }
              });
            }

            const cleanState = {
              state: {
                profile: s.profile || DEFAULT_PROFILE,
                userCustomWords: s.userCustomWords || [],
                srsProgressMap: migratedSrsMap,
                mistakeBank: s.mistakeBank || {},
                dailyHistory: s.dailyHistory || {},
                achievements: s.achievements || INITIAL_ACHIEVEMENTS,
                audioVoice: s.audioVoice || 'en-US',
                audioSpeed: s.audioSpeed || 0.85,
                autoPlayAudio: s.autoPlayAudio ?? true,
                isMaskExample: s.isMaskExample ?? false,
                geminiApiKey: s.geminiApiKey || '',
              },
              version: parsed.version || 0,
            };

            const cleanString = JSON.stringify(cleanState);
            localStorage.setItem(name, cleanString);
            return cleanString;
          }
        } catch (migErr) {
          console.warn('Auto-migrate error, clearing bloated storage:', migErr);
          localStorage.removeItem(name);
          return null;
        }
      }

      return raw;
    } catch (e) {
      console.warn('localStorage getItem error:', e);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      console.error('localStorage setItem QuotaExceededError:', e);
    }
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(name);
    } catch (e) {
      console.warn('localStorage removeItem error:', e);
    }
  },
};

export const useAppStore = create<AppStoreState>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_PROFILE,
      userCustomWords: [],
      srsProgressMap: {},
      vocabularyList: composeVocabularyList({}, []),
      mistakeBank: {},
      dailyHistory: {},
      achievements: INITIAL_ACHIEVEMENTS,
      audioVoice: 'en-US',
      audioSpeed: 0.85,
      autoPlayAudio: true,
      isMaskExample: false,
      geminiApiKey: '',
      activeFourSkill: 'listening',

      setActiveFourSkill: (skill) => set({ activeFourSkill: skill }),

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

      checkDailyReset: () => {
        const today = new Date().toISOString().split('T')[0];
        const { lastStudyDate, lastActiveDate, streak } = get().profile;

        if (!lastActiveDate || lastActiveDate !== today) {
          let updatedStreak = streak;
          if (lastActiveDate) {
            const prev = new Date(lastActiveDate);
            const curr = new Date(today);
            const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 3600 * 24));
            if (diffDays > 1) {
              // Missed >= 2 days, reset streak to 1
              updatedStreak = 1;
            }
          }

          set((state) => {
            const todayHistory = state.dailyHistory[today] || {
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
                lastActiveDate: today,
                lastStudyDate: today,
                streak: updatedStreak,
                extraNewWordsBonus: 0,
                targetDailyNewWords: state.profile.targetDailyNewWords || 15,
              },
              dailyHistory: {
                ...state.dailyHistory,
                [today]: todayHistory,
              },
            };
          });

          try {
            localStorage.setItem('english_mastery_last_active_date', today);
          } catch (e) {
            // ignore
          }
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
            profile: { ...state.profile, streak: 1, lastActiveDate: today, lastStudyDate: today },
          }));
          return;
        }

        const prev = new Date(lastActiveDate);
        const curr = new Date(today);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 3600 * 24));

        if (diffDays === 1) {
          set((state) => ({
            profile: { ...state.profile, streak: streak + 1, lastActiveDate: today, lastStudyDate: today },
          }));
        } else if (diffDays > 1) {
          set((state) => ({
            profile: { ...state.profile, streak: 1, lastActiveDate: today, lastStudyDate: today },
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
          const newLevel = calculateLevelFromXp(newXP);

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
              hearts: leveledUp ? state.profile.maxHearts : state.profile.hearts,
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
        
        const newProgress: SRSProgress = {
          srsLevel: sm2.srsLevel,
          nextReviewDate: sm2.nextReviewDate,
          interval: sm2.interval,
          easeFactor: sm2.easeFactor,
          lastReviewedDate: new Date().toISOString(),
          isFavorite: word.isFavorite || false,
        };

        const updatedWord: VocabWord = {
          ...word,
          ...newProgress,
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

        // TỰ ĐỘNG GHI NHẬN VÀO SỔ BẪY LỖI KHI BẤM AGAIN (0) HOẶC SỬA LỖI (2, 3)
        if (grade === 0) {
          get().recordMistake(word, 'srs_again');
        } else if (grade >= 2) {
          get().recordMistakeCorrect(word.id);
          get().recordMistakeCorrect(word.word);
        }

        set({
          srsProgressMap: {
            ...state.srsProgressMap,
            [wordId]: newProgress,
          },
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

        const xpReward = grade === 3 ? 15 : grade === 2 ? 10 : grade === 1 ? 5 : 2;
        get().gainXP(xpReward);
      },

      recordMistake: (wordItem, source = 'custom') => {
        const cleanWord = wordItem.word.trim();
        if (!cleanWord) return;
        const key = (wordItem.id || cleanWord).toLowerCase();

        set((state) => {
          const currentRecord = state.mistakeBank[key] || state.mistakeBank[cleanWord.toLowerCase()];
          const nowIso = new Date().toISOString();

          const updatedRecord: MistakeRecord = {
            id: wordItem.id || `mistake_${cleanWord.toLowerCase()}`,
            word: cleanWord,
            ipa: wordItem.ipa || currentRecord?.ipa,
            meaning: wordItem.meaning || currentRecord?.meaning || '',
            example: wordItem.example || currentRecord?.example,
            tag: (wordItem.tag as any) || currentRecord?.tag || 'Daily',
            mistakeCount: (currentRecord?.mistakeCount || 0) + 1,
            consecutiveCorrect: 0, // Reset chuỗi trả lời đúng về 0
            resolved: false,
            lastMistakeAt: nowIso,
            source: source || currentRecord?.source || 'custom',
          };

          return {
            mistakeBank: {
              ...state.mistakeBank,
              [key]: updatedRecord,
            },
          };
        });
      },

      recordMistakeCorrect: (wordIdOrText: string) => {
        if (!wordIdOrText) return;
        const key = wordIdOrText.trim().toLowerCase();

        set((state) => {
          // Tìm theo key hoặc word
          const matchedEntry = Object.entries(state.mistakeBank).find(
            ([k, item]) => k === key || item.id === wordIdOrText || item.word.toLowerCase() === key
          );

          if (!matchedEntry) return state;
          const [foundKey, currentRecord] = matchedEntry;

          const nextConsecutive = (currentRecord.consecutiveCorrect || 0) + 1;
          const isResolved = nextConsecutive >= 2;

          const updatedRecord: MistakeRecord = {
            ...currentRecord,
            consecutiveCorrect: nextConsecutive,
            resolved: isResolved,
          };

          return {
            mistakeBank: {
              ...state.mistakeBank,
              [foundKey]: updatedRecord,
            },
          };
        });
      },

      removeMistake: (wordIdOrText: string) => {
        if (!wordIdOrText) return;
        const key = wordIdOrText.trim().toLowerCase();

        set((state) => {
          const nextBank = { ...state.mistakeBank };
          Object.keys(nextBank).forEach((k) => {
            if (k === key || nextBank[k].id === wordIdOrText || nextBank[k].word.toLowerCase() === key) {
              delete nextBank[k];
            }
          });
          return { mistakeBank: nextBank };
        });
      },

      clearResolvedMistakes: () => {
        set((state) => {
          const nextBank: Record<string, MistakeRecord> = {};
          Object.entries(state.mistakeBank).forEach(([k, v]) => {
            if (!v.resolved) {
              nextBank[k] = v;
            }
          });
          return { mistakeBank: nextBank };
        });
      },

      clearAllMistakes: () => {
        set({ mistakeBank: {} });
      },

      recordQuizCompleted: (xpEarned: number, _isPerfect: boolean) => {
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

        get().gainXP(xpEarned);
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

        set((state) => {
          const updatedCustom = [newWord, ...state.userCustomWords];
          return {
            userCustomWords: updatedCustom,
            vocabularyList: [newWord, ...state.vocabularyList],
          };
        });

        get().gainXP(20);
      },

      addBatchWords: (wordsData) => {
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

      syncVocab5000: () => {
        return 0;
      },

      syncVocab1000: () => {
        return 0;
      },

      deleteWord: (wordId: string) => {
        set((state) => ({
          userCustomWords: state.userCustomWords.filter((w) => w.id !== wordId),
          vocabularyList: state.vocabularyList.filter((w) => w.id !== wordId),
        }));
      },

      updateWord: (updated) => {
        set((state) => ({
          userCustomWords: state.userCustomWords.map((w) => (w.id === updated.id ? updated : w)),
          vocabularyList: state.vocabularyList.map((w) => (w.id === updated.id ? updated : w)),
        }));
      },

      checkAchievements: () => {
        const { profile, vocabularyList, achievements, dailyHistory } = get();
        const totalReviews = Object.values(dailyHistory).reduce((acc, curr) => acc + curr.wordsReviewed, 0);
        const totalQuizzes = Object.values(dailyHistory).reduce((acc, curr) => acc + curr.quizzesCompleted, 0);

        const updatedAchievements = achievements.map((ach) => {
          if (ach.unlockedAt) return ach;

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
          version: '2.1.0',
          profile: state.profile,
          userCustomWords: state.userCustomWords,
          srsProgressMap: state.srsProgressMap,
          mistakeBank: state.mistakeBank,
          dailyHistory: state.dailyHistory,
          achievements: state.achievements,
        };
        return JSON.stringify(exportObject, null, 2);
      },

      importBackupData: (jsonData: string) => {
        try {
          const parsed = JSON.parse(jsonData);
          if (!parsed.profile) {
            return { success: false, message: 'Dữ liệu không đúng định dạng sao lưu của ứng dụng.' };
          }

          const customWords: VocabWord[] = parsed.userCustomWords || parsed.vocabularyList || [];
          const srsMap: Record<string, SRSProgress> = parsed.srsProgressMap || {};
          const mistakeBank: Record<string, MistakeRecord> = parsed.mistakeBank || {};

          set({
            profile: {
              ...DEFAULT_PROFILE,
              ...parsed.profile,
              isOnboarded: true,
            },
            userCustomWords: customWords,
            srsProgressMap: srsMap,
            mistakeBank: mistakeBank,
            vocabularyList: composeVocabularyList(srsMap, customWords),
            dailyHistory: parsed.dailyHistory || {},
            achievements: parsed.achievements || INITIAL_ACHIEVEMENTS,
          });

          return { success: true, message: 'Khôi phục dữ liệu học tập thành công!' };
        } catch (err: any) {
          return { success: false, message: `Lỗi đọc file: ${err?.message || 'File JSON không hợp lệ'}` };
        }
      },

      resetVocabularyProgress: () => {
        set((state) => ({
          srsProgressMap: {},
          vocabularyList: composeVocabularyList({}, state.userCustomWords),
        }));
      },

      resetToDefault: () => {
        set({
          profile: {
            ...DEFAULT_PROFILE,
            name: '',
            isOnboarded: false,
          },
          userCustomWords: [],
          srsProgressMap: {},
          mistakeBank: {},
          vocabularyList: composeVocabularyList({}, []),
          dailyHistory: {},
          achievements: INITIAL_ACHIEVEMENTS,
        });
      },
    }),
    {
      name: 'english_mastery_storage_v2',
      storage: createJSONStorage(() => safeStorage),
      // PARTIALIZE: CHỈ LƯU TRỮ DỮ LIỆU CÁ NHÂN (TIẾT KIỆM 99.5% DUNG LƯỢNG LOCALSTORAGE)
      partialize: (state) => ({
        profile: state.profile,
        userCustomWords: state.userCustomWords,
        srsProgressMap: state.srsProgressMap,
        mistakeBank: state.mistakeBank,
        dailyHistory: state.dailyHistory,
        achievements: state.achievements,
        audioVoice: state.audioVoice,
        audioSpeed: state.audioSpeed,
        autoPlayAudio: state.autoPlayAudio,
        isMaskExample: state.isMaskExample,
        geminiApiKey: state.geminiApiKey,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Khi nạp xong từ LocalStorage, đồng bộ ngay danh sách từ vựng RAM đầy đủ
          state.vocabularyList = composeVocabularyList(state.srsProgressMap, state.userCustomWords);
        }
      },
    }
  )
);
