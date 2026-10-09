import type {
  AppStoreState,
  UserProfile,
  DailyProgress,
} from '../../types';
import { calculateLevelFromXp } from '../../utils/userRank';
import { scheduleCloudSync } from '../../services/cloudSyncService';
import { evaluateAndRecordXpAward } from '../../services/xpAntiSpamService';
import { emitCompleteQuizEvent } from '../../services/completeQuizEventService';
import { getVietnamDateString, getCalendarDayDiff } from '../../utils/dateUtils';
import { reconcileHistoricalStreak, type StreakReconciliationResult } from '../../services/streakReconciliationService';

export interface ProfileSlice {
  setProfileName: (name: string, targetGoal?: UserProfile['targetGoal']) => void;
  setEquippedFrame: (frameId: string | null) => void;
  setUnlockedFrames: (frameIds: string[]) => void;
  setAudioVoice: (voice: 'en-US' | 'en-GB') => void;
  setAudioSpeed: (speed: number) => void;
  setAutoPlayAudio: (enabled: boolean) => void;
  setIsMaskExample: (enabled: boolean) => void;
  setGeminiApiKey: (key: string) => void;
  checkDailyReset: () => void;
  setDailyNewWordsLimit: (limit: number) => void;
  addExtraNewWords: (count: number) => void;
  checkAndUpdateStreak: () => void;
  reconcileStreakFromHistory: () => StreakReconciliationResult;
  gainXP: (
    amount: number,
    options?: {
      source?: 'flashcard' | 'ai_tutor' | 'pronunciation' | 'quiz' | 'toeic' | 'four_skills' | 'manual';
      idempotencyKey?: string;
      metadata?: {
        isDue?: boolean;
        isNew?: boolean;
        textLength?: number;
        wordId?: string;
        gameType?: string;
      };
    }
  ) => { leveledUp: boolean; newLevel: number };
  consumeHeart: () => boolean;
  refillHearts: () => void;
  recordQuizCompleted: (
    xpEarned: number,
    isPerfect?: boolean,
    options?: {
      quizId?: string;
      quizType?: 'word_match' | 'dictation' | 'fill_blank' | 'word_scramble' | 'comprehension' | 'standard';
      totalQuestions?: number;
      correctCount?: number;
      score?: number;
      durationSeconds?: number;
      mistakeCount?: number;
    }
  ) => { alreadyCompleted: boolean; xpGranted: number };
  recordPronunciationMastered: (xpEarned: number) => void;
  checkAchievements: () => void;
}

type SetState = (
  partial: Partial<AppStoreState> | ((state: AppStoreState) => Partial<AppStoreState>),
  replace?: boolean
) => void;
type GetState = () => AppStoreState;

export const createProfileSlice = (set: SetState, get: GetState): ProfileSlice => ({
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

  setEquippedFrame: (frameId) => {
    set((state) => ({
      profile: {
        ...state.profile,
        equippedFrame: frameId || null,
      },
    }));
    scheduleCloudSync(500);
  },

  setUnlockedFrames: (frameIds) => {
    set((state) => ({
      profile: {
        ...state.profile,
        unlockedFrames: Array.from(new Set([...(state.profile.unlockedFrames || []), ...frameIds])),
      },
    }));
  },

  setAudioVoice: (voice) => set({ audioVoice: voice }),
  setAudioSpeed: (speed) => set({ audioSpeed: speed }),
  setAutoPlayAudio: (enabled) => set({ autoPlayAudio: enabled }),
  setIsMaskExample: (enabled) => set({ isMaskExample: enabled }),
  setGeminiApiKey: (key) => set({ geminiApiKey: key }),

  checkDailyReset: () => {
    const today = getVietnamDateString();
    if (!today) return;
    const { lastActiveDate, lastStudyDate, streak, longestStreak } = get().profile;

    if (!lastActiveDate || lastActiveDate !== today) {
      let updatedStreak = streak;
      const prevDate = lastStudyDate || ((streak && streak > 0) ? lastActiveDate : null);
      if (prevDate) {
        const diffDays = getCalendarDayDiff(today, prevDate);
        if (diffDays === null || diffDays > 1) {
          // Missed >= 1 day of studying (yesterday was skipped), streak is broken
          updatedStreak = 0;
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
            // Invariant: KHÔNG ghi đè lastStudyDate tại thời điểm mở app!
            // lastStudyDate chỉ được ghi nhận khi có hoạt động học tập thực tế (Qualifying Activity)
            streak: updatedStreak,
            longestStreak: Math.max(longestStreak || 0, state.profile.streak || 0),
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
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('english_mastery_last_active_date', today);
        }
      } catch {
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
    const today = getVietnamDateString();
    if (!today) return;
    const { lastStudyDate, streak, longestStreak, lastActiveDate } = get().profile;

    // Idempotent: Nếu hôm nay đã có hoạt động học tập hợp lệ, không tăng chuỗi lặp lại
    if (lastStudyDate === today) return;

    const prevDate = lastStudyDate || ((streak && streak > 0) ? lastActiveDate : null);

    if (!prevDate) {
      // Ngày đầu tiên có hoạt động học tập hợp lệ (First Qualifying Day)
      const newStreak = Math.max(1, streak || 1);
      const newLongest = Math.max(longestStreak || 0, newStreak);
      set((state) => ({
        profile: {
          ...state.profile,
          streak: newStreak,
          longestStreak: newLongest,
          lastStudyDate: today,
          lastActiveDate: today,
        },
      }));
      get().checkAchievements();
      scheduleCloudSync(2000);
      return;
    }

    const diffDays = getCalendarDayDiff(today, prevDate);

    if (diffDays === 1) {
      // Ngày liên tiếp kế tiếp (Consecutive day)
      const newStreak = (streak || 0) + 1;
      const newLongest = Math.max(longestStreak || 0, newStreak);
      set((state) => ({
        profile: {
          ...state.profile,
          streak: newStreak,
          longestStreak: newLongest,
          lastStudyDate: today,
          lastActiveDate: today,
        },
      }));
      get().checkAchievements();
      scheduleCloudSync(2000);
    } else if (diffDays === null || diffDays > 1) {
      // Đứt chuỗi do bỏ lỡ >= 1 ngày học hoặc timestamp quá khứ không hợp lệ
      // Bắt đầu chuỗi mới từ 1, bảo lưu kỷ lục cao nhất (longestStreak)
      const newStreak = 1;
      const newLongest = Math.max(longestStreak || 0, 1);
      set((state) => ({
        profile: {
          ...state.profile,
          streak: newStreak,
          longestStreak: newLongest,
          lastStudyDate: today,
          lastActiveDate: today,
        },
      }));
      get().checkAchievements();
      scheduleCloudSync(2000);
    } else {
      // diffDays <= 0 (lệch giờ đồng hồ hoặc cùng ngày), an toàn cập nhật mốc ngày
      set((state) => ({
        profile: {
          ...state.profile,
          lastStudyDate: today,
          lastActiveDate: today,
        },
      }));
    }
  },

  reconcileStreakFromHistory: (): StreakReconciliationResult => {
    const state = get();
    const result = reconcileHistoricalStreak({
      profile: state.profile,
      dailyHistory: state.dailyHistory,
      recentReviewEvents: state.recentReviewEvents,
    });

    if (result.modified) {
      set((currentState) => ({
        profile: {
          ...currentState.profile,
          streak: result.reconciledStreak,
          longestStreak: result.reconciledLongestStreak,
          lastStudyDate: result.reconciledLastStudyDate || currentState.profile.lastStudyDate,
        },
      }));
      scheduleCloudSync(2000);
    }

    return result;
  },

  gainXP: (
    amount: number,
    options?: {
      source?: 'flashcard' | 'ai_tutor' | 'pronunciation' | 'quiz' | 'toeic' | 'four_skills' | 'manual';
      idempotencyKey?: string;
      metadata?: {
        isDue?: boolean;
        isNew?: boolean;
        textLength?: number;
        wordId?: string;
        gameType?: string;
      };
    }
  ) => {
    const state = get();
    if (options?.idempotencyKey && state.processedXpKeys?.includes(options.idempotencyKey)) {
      return { leveledUp: false, newLevel: state.profile.level };
    }

    let finalAmount = amount;
    if (options?.source) {
      const decision = evaluateAndRecordXpAward({
        source: options.source,
        rawAmount: amount,
        idempotencyKey: options.idempotencyKey,
        metadata: options.metadata,
      });
      if (!decision.allowed || decision.grantedXP <= 0) {
        return { leveledUp: false, newLevel: state.profile.level };
      }
      finalAmount = decision.grantedXP;
    }

    // Invariant: CHỈ kích hoạt Streak khi đây là hoạt động học tập thực tế (Qualifying Activity)
    // Không kích hoạt khi nhận thưởng rương (Chest), phần thưởng thành tựu, hoặc mở app
    const isQualifyingActivity = Boolean(
      options?.source &&
      [
        'flashcard',
        'ai_tutor',
        'pronunciation',
        'quiz',
        'toeic',
        'four_skills',
      ].includes(options.source)
    );

    if (isQualifyingActivity) {
      get().checkAndUpdateStreak();
    }
    let leveledUp = false;
    let finalLevel = 1;

    set((currentState) => {
      const currentXP = currentState.profile.xp;
      const newXP = currentXP + finalAmount;
      const oldLevel = currentState.profile.level;
      const newLevel = calculateLevelFromXp(newXP);

      if (newLevel > oldLevel) {
        leveledUp = true;
      }
      finalLevel = newLevel;

      // Chuẩn hóa theo ngày học Việt Nam (Asia/Ho_Chi_Minh), loại bỏ hoàn toàn UTC split T
      const today = getVietnamDateString();
      const todayProgress = currentState.dailyHistory[today] || {
        date: today,
        wordsReviewed: 0,
        newWordsLearned: 0,
        quizzesCompleted: 0,
        pronunciationsMastered: 0,
        xpGained: 0,
      };

      const nextProcessedKeys = options?.idempotencyKey
        ? [...(currentState.processedXpKeys || []), options.idempotencyKey].slice(-200)
        : (currentState.processedXpKeys || []);

      return {
        profile: {
          ...currentState.profile,
          xp: newXP,
          level: newLevel,
          hearts: leveledUp ? currentState.profile.maxHearts : currentState.profile.hearts,
        },
        dailyHistory: {
          ...currentState.dailyHistory,
          [today]: {
            ...todayProgress,
            xpGained: todayProgress.xpGained + finalAmount,
          },
        },
        processedXpKeys: nextProcessedKeys,
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

  recordQuizCompleted: (
    xpEarned: number,
    isPerfect: boolean = false,
    options?: {
      quizId?: string;
      quizType?: 'word_match' | 'dictation' | 'fill_blank' | 'word_scramble' | 'comprehension' | 'standard';
      totalQuestions?: number;
      correctCount?: number;
      score?: number;
      durationSeconds?: number;
      mistakeCount?: number;
    }
  ) => {
    const state = get();
    const quizId = options?.quizId || `quiz_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    // Invariant: Exactly-once completion per quiz session / quizId
    if (state.completedQuizSessionIds?.includes(quizId)) {
      return { alreadyCompleted: true, xpGranted: 0 };
    }

    const today = getVietnamDateString();
    const currentDaily = state.dailyHistory[today] || {
      date: today,
      wordsReviewed: 0,
      newWordsLearned: 0,
      quizzesCompleted: 0,
      pronunciationsMastered: 0,
      xpGained: 0,
    };

    const nextCompletedSessionIds = [...(state.completedQuizSessionIds || []), quizId].slice(-200);

    set((prevState) => ({
      completedQuizSessionIds: nextCompletedSessionIds,
      dailyHistory: {
        ...prevState.dailyHistory,
        [today]: {
          ...currentDaily,
          quizzesCompleted: currentDaily.quizzesCompleted + 1,
        },
      },
    }));

    // Cập nhật chuỗi Streak cho hoạt động Quiz hoàn thành hợp lệ
    get().checkAndUpdateStreak();

    // Idempotent XP award with stable idempotencyKey
    let xpGranted = 0;
    if (xpEarned > 0) {
      const xpRes = get().gainXP(xpEarned, {
        source: 'quiz',
        idempotencyKey: `xp_quiz_${quizId}`,
        metadata: {
          gameType: options?.quizType || 'standard',
        },
      });
      xpGranted = xpRes ? xpEarned : 0;
    }

    // Phase 7: Emit complete_quiz domain event
    // Executed only AFTER local completion has safely committed
    emitCompleteQuizEvent({
      quizId,
      quizType: options?.quizType || 'standard',
      totalQuestions: options?.totalQuestions ?? 1,
      correctCount: options?.correctCount ?? (isPerfect ? 1 : 0),
      score: options?.score ?? (isPerfect ? 100 : 80),
      durationSeconds: options?.durationSeconds,
      mistakeCount: options?.mistakeCount ?? 0,
      xpEarned,
      idempotencyKey: `idemp_complete_quiz_${quizId}_completion`,
    });

    scheduleCloudSync(2000);

    return { alreadyCompleted: false, xpGranted };
  },

  recordPronunciationMastered: (xpEarned: number) => {
    const today = getVietnamDateString();
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

    get().gainXP(xpEarned, { source: 'pronunciation' });
  },

  checkAchievements: () => {
    const state = get();
    const { profile, vocabularyList, achievements, dailyHistory, claimedAchievementIds = [] } = state;
    const totalReviews = Object.values(dailyHistory).reduce((acc, curr) => acc + curr.wordsReviewed, 0);
    const totalQuizzes = Object.values(dailyHistory).reduce((acc, curr) => acc + curr.quizzesCompleted, 0);

    let totalNewRewardXP = 0;
    const newClaimedIds = [...claimedAchievementIds];

    const updatedAchievements = achievements.map((ach) => {
      let currentProgress = 0;
      if (ach.category === 'streak') currentProgress = profile.streak;
      if (ach.category === 'xp') currentProgress = profile.xp;
      if (ach.category === 'vocab') currentProgress = Math.max(vocabularyList.length, totalReviews);
      if (ach.category === 'quiz') currentProgress = totalQuizzes;

      const isTargetReached = currentProgress >= ach.target;
      const wasAlreadyUnlocked = Boolean(ach.unlockedAt);
      const wasAlreadyClaimed = newClaimedIds.includes(ach.id);

      if (isTargetReached && !wasAlreadyUnlocked && !wasAlreadyClaimed) {
        const reward = ach.xpReward || (ach.id === 'streak_7' ? 150 : 0);
        if (reward > 0) {
          totalNewRewardXP += reward;
          newClaimedIds.push(ach.id);
        }
        return {
          ...ach,
          progress: currentProgress,
          unlockedAt: new Date().toISOString(),
        };
      }

      if (isTargetReached && wasAlreadyUnlocked) {
        if (!wasAlreadyClaimed) {
          newClaimedIds.push(ach.id);
        }
      }

      return {
        ...ach,
        progress: ach.unlockedAt ? ach.progress : currentProgress,
      };
    });

    set({
      achievements: updatedAchievements,
      claimedAchievementIds: newClaimedIds,
    });

    if (totalNewRewardXP > 0) {
      get().gainXP(totalNewRewardXP);
    }
  },
});
