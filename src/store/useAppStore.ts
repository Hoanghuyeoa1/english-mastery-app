import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserProfile, VocabWord, DailyProgress, SRSGrade, Achievement, VocabTag, MistakeRecord } from '../types';
import { calculateSM2 } from '../services/srsAlgorithm';
import { VOCAB_10000_BANK } from '../data/defaultVocab';
import { calculateLevelFromXp } from '../utils/userRank';
import { scheduleCloudSync } from '../services/cloudSyncService';

export interface SRSProgress {
  srsLevel: number;
  nextReviewDate: string;
  interval: number;
  easeFactor: number;
  lastReviewedDate?: string;
  firstLearnedAt?: string;
  todayNewReviewedAt?: string;
  todayPoolReviewedAt?: string;
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
          firstLearnedAt: progress.firstLearnedAt || w.firstLearnedAt,
          todayNewReviewedAt: progress.todayNewReviewedAt || w.todayNewReviewedAt,
          todayPoolReviewedAt: progress.todayPoolReviewedAt || w.todayPoolReviewedAt,
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
  processReview: (
    wordId: string, 
    grade: SRSGrade, 
    reviewMode?: 'due_today' | 'today_learned' | 'all_learned' | boolean
  ) => void;
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
  mergeCloudData: (payload: {
    cloudProfile: {
      id: string;
      display_name?: string;
      level?: number;
      xp?: number;
      streak?: number;
      updated_at?: string;
    } | null;
    cloudSrsList: Array<{
      word_id: string;
      repetition?: number;
      interval?: number;
      ease_factor?: number;
      next_review_date?: string;
    }>;
    cloudDailyLogs: Array<{
      date: string;
      words_learned?: number;
      xp_earned?: number;
    }>;
  }) => void;
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
        scheduleCloudSync(500);
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
          scheduleCloudSync(2000);
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
          scheduleCloudSync(2000);
          return;
        }

        const prev = new Date(lastActiveDate);
        const curr = new Date(today);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 3600 * 24));

        if (diffDays === 1) {
          set((state) => ({
            profile: { ...state.profile, streak: streak + 1, lastActiveDate: today, lastStudyDate: today },
          }));
          scheduleCloudSync(2000);
        } else if (diffDays > 1) {
          set((state) => ({
            profile: { ...state.profile, streak: 1, lastActiveDate: today, lastStudyDate: today },
          }));
          scheduleCloudSync(2000);
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
        scheduleCloudSync(1500);
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

      processReview: (
        wordId: string, 
        grade: SRSGrade, 
        reviewMode?: 'due_today' | 'today_learned' | 'all_learned' | boolean
      ) => {
        const state = get();
        const word = state.vocabularyList.find((v) => v.id === wordId);
        if (!word) return;

        const isReviewSession = !!reviewMode;
        const existingProgress = state.srsProgressMap[wordId];
        const hasBeenLearnedBefore = (word.srsLevel && word.srsLevel > 0) || !!word.lastReviewedDate || !!word.firstLearnedAt || !!existingProgress;
        const isActuallyNewWord = !isReviewSession && !hasBeenLearnedBefore;

        const nowIso = new Date().toISOString();

        // XÁC ĐỊNH firstLearnedAt (CHỈ GHI 1 LẦN DUY NHẤT, KHÔNG ĐÈ KHI ÔN):
        let firstLearnedAt = word.firstLearnedAt || existingProgress?.firstLearnedAt;
        if (!firstLearnedAt) {
          if (isActuallyNewWord) {
            firstLearnedAt = nowIso;
          } else {
            // Từ cũ nhưng chưa có trường firstLearnedAt -> lấy mốc quá khứ
            firstLearnedAt = word.lastReviewedDate || existingProgress?.lastReviewedDate || '2026-08-01T00:00:00.000Z';
          }
        }

        const sm2 = calculateSM2(grade, word.interval || 0, word.srsLevel || 0, word.easeFactor || 2.5);
        
        // CÁC TRƯỜNG ĐÁNH DẤU CHO TỪNG CHẾ ĐỘ:
        let todayNewReviewedAt = word.todayNewReviewedAt || existingProgress?.todayNewReviewedAt;
        let todayPoolReviewedAt = word.todayPoolReviewedAt || existingProgress?.todayPoolReviewedAt;
        let nextReviewDate = sm2.nextReviewDate;

        if (reviewMode === 'today_learned') {
          // Ôn ở Chế độ 2 (Từ mới học hôm nay):
          // Khi bấm Khó (1), Tốt (2), hoặc Dễ (3) -> đánh dấu hoàn thành ôn củng cố hôm nay -> trừ khỏi Chế độ 2
          if (grade >= 1) {
            todayNewReviewedAt = nowIso;
          }
          nextReviewDate = sm2.nextReviewDate;
        } else if (reviewMode === 'all_learned') {
          // Ôn ở Chế độ 3 (Toàn bộ kho từ):
          // Khi bấm Khó (1), Tốt (2), hoặc Dễ (3) -> đánh dấu hoàn thành luyện kho hôm nay -> trừ khỏi Chế độ 3
          if (grade >= 1) {
            todayPoolReviewedAt = nowIso;
          }
          // THEO YÊU CẦU CỦA USER: "Không làm giảm số lượng ở mục Đến hạn ôn hôm nay"
          // Ta GIỮ NGUYÊN nextReviewDate của từ đó, không làm thay đổi trạng thái đến hạn của Chế độ 1!
          nextReviewDate = word.nextReviewDate;
        } else {
          // Chế độ 1 ('due_today') hoặc học thông thường:
          // SM-2 cập nhật nextReviewDate -> từ đó không còn đến hạn -> trừ khỏi Chế độ 1!
          nextReviewDate = sm2.nextReviewDate;
        }

        const newProgress: SRSProgress = {
          srsLevel: sm2.srsLevel,
          nextReviewDate,
          interval: sm2.interval,
          easeFactor: sm2.easeFactor,
          firstLearnedAt,
          lastReviewedDate: nowIso,
          todayNewReviewedAt,
          todayPoolReviewedAt,
          isFavorite: word.isFavorite || false,
        };

        const updatedWord: VocabWord = {
          ...word,
          ...newProgress,
        };

        const today = nowIso.split('T')[0];
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
              wordsReviewed: isActuallyNewWord ? currentDaily.wordsReviewed : currentDaily.wordsReviewed + 1,
              newWordsLearned: isActuallyNewWord ? currentDaily.newWordsLearned + 1 : currentDaily.newWordsLearned,
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
            level: 1,
            xp: 0,
            streak: 0,
            equippedTitle: 'Tân thủ',
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

      mergeCloudData: ({ cloudProfile, cloudSrsList, cloudDailyLogs }) => {
        set((state) => {
          let nextProfile = { ...state.profile };
          if (cloudProfile) {
            const mergedXp = Math.max(state.profile.xp || 0, cloudProfile.xp || 0);
            const calculatedLevel = calculateLevelFromXp(mergedXp);
            const mergedLevel = Math.max(
              calculatedLevel,
              cloudProfile.level || 1,
              state.profile.level || 1
            );
            const mergedStreak = Math.max(state.profile.streak || 1, cloudProfile.streak || 1);
            const mergedName = state.profile.name || cloudProfile.display_name || '';

            nextProfile = {
              ...nextProfile,
              name: mergedName,
              xp: mergedXp,
              level: mergedLevel,
              streak: mergedStreak,
              isOnboarded: !!mergedName || nextProfile.isOnboarded,
            };
          }

          // Merge SRS Progress
          const nextSrsMap = { ...state.srsProgressMap };
          if (Array.isArray(cloudSrsList)) {
            for (const item of cloudSrsList) {
              if (!item || !item.word_id) continue;
              const existing = nextSrsMap[item.word_id];
              const cloudRep = item.repetition ?? 0;
              const existingRep = existing?.srsLevel ?? 0;

              if (!existing || cloudRep >= existingRep) {
                nextSrsMap[item.word_id] = {
                  srsLevel: Math.max(cloudRep, existingRep),
                  interval: item.interval ?? existing?.interval ?? 0,
                  easeFactor: item.ease_factor ?? existing?.easeFactor ?? 2.5,
                  nextReviewDate: item.next_review_date || existing?.nextReviewDate || new Date().toISOString(),
                  lastReviewedDate: existing?.lastReviewedDate || new Date().toISOString(),
                  isFavorite: existing?.isFavorite ?? false,
                };
              }
            }
          }

          // Merge Daily History with safety validation (chống lỗi cộng dồn số lượng từ trong kho từ điển)
          const nextDailyHistory = { ...state.dailyHistory };
          if (Array.isArray(cloudDailyLogs)) {
            for (const log of cloudDailyLogs) {
              if (!log || !log.date) continue;
              const existing = nextDailyHistory[log.date];
              // Không cộng dồn lặp lại: words_learned trên cloud đã bao gồm cả newWords và wordsReviewed
              const rawLearned = log.words_learned || 0;
              const safeLearned = rawLearned > 100 ? 0 : Math.max(0, rawLearned);

              if (!existing) {
                nextDailyHistory[log.date] = {
                  date: log.date,
                  wordsReviewed: safeLearned,
                  newWordsLearned: 0,
                  quizzesCompleted: 0,
                  pronunciationsMastered: 0,
                  xpGained: Math.max(0, log.xp_earned || 0),
                };
              } else {
                const localTotal = (existing.wordsReviewed || 0) + (existing.newWordsLearned || 0);
                const wordsDelta = Math.max(0, safeLearned - localTotal);
                nextDailyHistory[log.date] = {
                  ...existing,
                  wordsReviewed: (existing.wordsReviewed || 0) + wordsDelta,
                  xpGained: Math.max(existing.xpGained || 0, log.xp_earned || 0),
                };
              }
            }
          }

          const nextVocabList = composeVocabularyList(nextSrsMap, state.userCustomWords);

          return {
            profile: nextProfile,
            srsProgressMap: nextSrsMap,
            dailyHistory: nextDailyHistory,
            vocabularyList: nextVocabList,
          };
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
          // Đối chiếu làm sạch dữ liệu dựa trên ground truth srsProgressMap
          if (state.dailyHistory) {
            const cleaned: Record<string, DailyProgress> = {};
            const srsEntries = Object.values(state.srsProgressMap || {});
            const realReviewsByDate: Record<string, number> = {};
            for (const item of srsEntries) {
              if (item.lastReviewedDate) {
                const dStr = item.lastReviewedDate.split('T')[0];
                realReviewsByDate[dStr] = (realReviewsByDate[dStr] || 0) + 1;
              }
            }

            for (const [date, val] of Object.entries(state.dailyHistory)) {
              if (!val) continue;
              const realReviews = realReviewsByDate[date] || 0;
              // Nếu giá trị lưu trữ vượt xa số từ thực tế có trong srsProgressMap, clamp về đúng số từ thực tế
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
      },
    }
  )
);
