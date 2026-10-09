import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Flame, 
  Sparkles, 
  Brain, 
  Mic, 
  Zap, 
  ArrowRight, 
  Volume2,
  Award,
  ShieldAlert,
  Headphones,
  BookOpen,
  PenTool,
  Gift,
  CheckCircle2,
  Crown,
  Lock,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  Play,
  Layers,
  Copy,
  Check
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getDueReviewWords } from '../services/srsAlgorithm';
import { speakWord } from '../services/speechService';
import { ActiveTab, MistakeType } from '../types';
import { triggerCelebration } from '../utils/confettiPolicy';
import { buildAdaptiveLearningSession } from '../services/adaptiveSessionBuilder';
import { getModuleNavigationTarget } from '../services/adaptivePracticeRouter';
import { ActivityHeatmap } from './ActivityHeatmap';
import { FourSkillsAdaptiveSummary } from './FourSkillsAdaptiveSummary';
import { getVietnamDateString } from '../utils/dateUtils';

const MISTAKE_TYPE_LABELS: Record<MistakeType, string> = {
  meaning: 'Ý nghĩa từ',
  spelling: 'Chính tả',
  listening: 'Nghe hiểu',
  pronunciation: 'Phát âm',
  collocation: 'Cụm từ',
  grammar: 'Ngữ pháp',
  reading: 'Đọc hiểu',
  writing: 'Viết luận',
  other: 'Khác',
};
import { UserAvatar, UserRankBadge } from './UserProfileBadge';
import { getUserRankInfo, getXpLevelProgress } from '../utils/userRank';
import { useDailyMotivationQuote } from '../services/dailyQuoteService';
import { ReviewModal } from './ReviewModal';
import { MyVocabBankModal } from './MyVocabBankModal';
import { AchievementsModal } from './AchievementsModal';
import { getFourSkillsCompetency } from '../services/skillsCompetencyService';
import { evaluateUserAchievements } from '../services/achievementService';
import { LeechWordsWidget } from './LeechWordsWidget';
import { AdaptiveLearningSummary } from './AdaptiveLearningSummary';
import { TodayLearningPlanWidget } from './TodayLearningPlanWidget';
import { ContinueLearningSection } from './ContinueLearningSection';
import { PersonalizedInsightsSection } from './PersonalizedInsightsSection';
import { generateTodayLearningPlan } from '../services/todayLearningPlanService';
import { SRSAnalyticsModal } from './SRSAnalyticsModal';
import { computeRetentionMetrics } from '../services/srsAnalytics';
import { extractCardDueReferences, forecastSRSWorkload } from '../services/srsWorkloadForecast';
import { detectDeckLeeches } from '../services/leechDetector';
import { getRetentionRecommendationFromMetrics } from '../services/retentionRecommendation';

interface DashboardProps {
  onNavigate: (tab: ActiveTab) => void;
  onOpenAddWord: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { 
    profile, 
    vocabularyList, 
    userCollocations,
    srsProgressMap, 
    dailyHistory, 
    mistakeBank, 
    gainXP,
    recentReviewEvents,
    completedListeningLessonIds,
    fourSkillsCompletionProgress,
    fourSkillsScores,
    fourSkillsEvidence,
    fsrsSettings,
    srsAlgorithm,
    startAdaptivePractice,
    setActiveFourSkill,
    isHydrated,
    resumeActivities,
    checkpointHistory,
    levelCertifications,
  } = useAppStore();
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isMyVocabBankOpen, setIsMyVocabBankOpen] = useState(false);
  const [isAchievementsModalOpen, setIsAchievementsModalOpen] = useState(false);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);

  // Memoized Today Learning Plan (Deterministic, Pure Orchestration)
  const todayPlan = useMemo(() => {
    return generateTodayLearningPlan({
      vocabularyList,
      userCollocations,
      srsProgressMap,
      mistakeBank,
      fourSkillsScores,
      fourSkillsEvidence,
      completedListeningLessonIds,
      fourSkillsCompletionProgress,
      completedReadingLessonIds: fourSkillsCompletionProgress?.reading,
      completedSpeakingPromptIds: fourSkillsCompletionProgress?.speaking,
      completedWritingPromptIds: fourSkillsCompletionProgress?.writing,
      dailyHistory,
      profile,
      srsAlgorithm,
      fsrsSettings,
      targetMinutes: 20,
      resumeActivities,
      checkpointHistory,
      levelCertifications,
    });
  }, [
    vocabularyList,
    userCollocations,
    srsProgressMap,
    mistakeBank,
    fourSkillsScores,
    fourSkillsEvidence,
    completedListeningLessonIds,
    fourSkillsCompletionProgress,
    dailyHistory,
    profile,
    srsAlgorithm,
    fsrsSettings,
    resumeActivities,
    checkpointHistory,
    levelCertifications,
  ]);

  // Memoized Adaptive Learning Metrics
  const metrics = useMemo(() => {
    return computeRetentionMetrics(
      recentReviewEvents || [],
      fsrsSettings?.desiredRetention ?? 0.90,
      30
    );
  }, [recentReviewEvents, fsrsSettings?.desiredRetention]);

  const cardRefs = useMemo(() => {
    return extractCardDueReferences(srsProgressMap);
  }, [srsProgressMap]);

  const forecast = useMemo(() => {
    return forecastSRSWorkload(cardRefs, 7);
  }, [cardRefs]);

  const leeches = useMemo(() => {
    return detectDeckLeeches(vocabularyList, srsProgressMap);
  }, [vocabularyList, srsProgressMap]);
  const leechCount = leeches.length;

  const adaptiveRecommendation = useMemo(() => {
    return getRetentionRecommendationFromMetrics(
      metrics,
      fsrsSettings?.desiredRetention ?? 0.90,
      forecast.today,
      srsAlgorithm
    );
  }, [metrics, fsrsSettings?.desiredRetention, forecast.today, srsAlgorithm]);

  const fourSkills = useMemo(() => getFourSkillsCompetency(srsProgressMap), [srsProgressMap]);
  const systemAchievements = useMemo(
    () =>
      evaluateUserAchievements({
        profile,
        srsProgressMap,
        dailyHistory,
      }),
    [profile, srsProgressMap, dailyHistory]
  );
  const unlockedBadgesCount = systemAchievements.filter((a) => a.isUnlocked).length;
  const totalBadgesCount = systemAchievements.length;
  const badgesProgressPercent = Math.round((unlockedBadgesCount / totalBadgesCount) * 100);

  const today = getVietnamDateString();
  const todayProgress = dailyHistory[today] || {
    date: today,
    wordsReviewed: 0,
    newWordsLearned: 0,
    quizzesCompleted: 0,
    pronunciationsMastered: 0,
    xpGained: 0,
  };

  const dueWords = useMemo(() => getDueReviewWords(vocabularyList), [vocabularyList]);

  const unresolvedMistakes = useMemo(
    () => Object.values(mistakeBank || {}).filter((m) => !m.resolved),
    [mistakeBank]
  );
  const recurringMistakes = useMemo(
    () => Object.values(mistakeBank || {}).filter((m) => !m.resolved && (m.reopenCount ?? 0) > 0),
    [mistakeBank]
  );

  const isNewUser = useMemo(() => {
    return (
      (metrics.totalReviews === 0 || metrics.windowDays === 0) &&
      Object.keys(srsProgressMap || {}).length === 0 &&
      Object.keys(mistakeBank || {}).length === 0
    );
  }, [metrics.totalReviews, metrics.windowDays, srsProgressMap, mistakeBank]);

  const adaptiveSession = useMemo(() => {
    return buildAdaptiveLearningSession(mistakeBank, { targetMinutes: 15 });
  }, [mistakeBank]);

  const handleStartAdaptiveSession = () => {
    if (adaptiveSession.exercises.length === 0) {
      onNavigate('mistakes');
      return;
    }
    const firstEx = adaptiveSession.exercises[0];
    const targetItemIds = adaptiveSession.exercises
      .filter((e) => e.recommendedModule === firstEx.recommendedModule)
      .map((e) => e.targetId);

    startAdaptivePractice({
      module: firstEx.recommendedModule,
      itemIds: targetItemIds.length > 0 ? targetItemIds : [firstEx.targetId],
      mistakeType: firstEx.mistakeType,
    });
    const target = getModuleNavigationTarget(firstEx.recommendedModule);
    onNavigate(target.tab);
  };

  const userRank = getUserRankInfo(profile.level);

  // Dynamic Time-Based Greeting
  const currentHour = new Date().getHours();
  let timeGreeting = 'Chào buổi sáng, Chiến binh';
  let timeIcon = '☀️';
  if (currentHour >= 12 && currentHour < 18) {
    timeGreeting = 'Chào buổi chiều đầy năng lượng, Chiến binh';
    timeIcon = '⚡';
  } else if (currentHour >= 18 || currentHour < 5) {
    timeGreeting = 'Chào buổi tối, Bậc thầy';
    timeIcon = '🌙';
  }

  // Daily Motivation Quote (Asia/Ho_Chi_Minh with automatic 00:00 rollover & wake recovery)
  const currentQuote = useDailyMotivationQuote();
  const [copiedQuote, setCopiedQuote] = useState(false);

  const handleCopyQuote = async () => {
    try {
      const quoteText = `"${currentQuote.en}"\n${currentQuote.vi}${currentQuote.author ? ` — ${currentQuote.author}` : ''}`;
      await navigator.clipboard.writeText(quoteText);
      setCopiedQuote(true);
      setTimeout(() => setCopiedQuote(false), 2000);
    } catch {
      // Fallback in case clipboard API is blocked
    }
  };

  // EXP Level Progression (RPG Scaling Formula)
  const xpProgress = getXpLevelProgress(profile.xp);
  const currentLevel = xpProgress.level;
  const currentLevelXp = xpProgress.currentLevelXp;
  const nextLevelXpRequired = xpProgress.nextLevelXpRequired;
  const percentage = xpProgress.percentage;

  // Daily Quests State (LocalStorage persistence)
  const [chestClaimedDate, setChestClaimedDate] = useState<string>(() => {
    return localStorage.getItem('daily_chest_claimed_date') || '';
  });

  const [quest1Claimed, setQuest1Claimed] = useState<boolean>(() => {
    return localStorage.getItem(`quest_1_claimed_${today}`) === 'true';
  });
  const [quest2Claimed, setQuest2Claimed] = useState<boolean>(() => {
    return localStorage.getItem(`quest_2_claimed_${today}`) === 'true';
  });
  const [quest3Claimed, setQuest3Claimed] = useState<boolean>(() => {
    return localStorage.getItem(`quest_3_claimed_${today}`) === 'true';
  });

  // Calculate Quest Progress
  // Quest 1: Listening / Reading Completed (from store tracking or quizzes)
  const completedListeningCount = completedListeningLessonIds?.length || 0;
  const q1Progress = Math.min(1, (todayProgress.quizzesCompleted > 0 || completedListeningCount > 0 ? 1 : 0));

  // Quest 2: Speaking practice completed
  const completedSpeakingCount = fourSkillsCompletionProgress?.speaking?.length || 0;
  const q2Progress = Math.min(1, (todayProgress.pronunciationsMastered > 0 || completedSpeakingCount > 0 ? 1 : 0));

  // Quest 3: 20 Flashcards reviewed
  const q3Progress = Math.min(20, todayProgress.wordsReviewed || 0);

  const isQuest1Done = q1Progress >= 1;
  const isQuest2Done = q2Progress >= 1;
  const isQuest3Done = q3Progress >= 20;

  const allQuestsCompleted = isQuest1Done && isQuest2Done && isQuest3Done;
  const isChestClaimedToday = chestClaimedDate === today;

  // Derived Transient XP Delta Feedback (Pure UI, zero store mutation, mount-guarded)
  const [xpDeltaNotice, setXpDeltaNotice] = useState<{ amount: number } | null>(null);
  const prevXpRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevXpRef.current === null) {
      prevXpRef.current = profile.xp;
      return;
    }
    const delta = profile.xp - prevXpRef.current;
    prevXpRef.current = profile.xp;
    if (delta > 0) {
      setXpDeltaNotice({ amount: delta });
      const timer = setTimeout(() => setXpDeltaNotice(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [profile.xp]);

  const fireGoldenConfetti = () => {
    triggerCelebration('completion', {
      particleCount: 80,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#F59E0B', '#10B981', '#06B6D4', '#8B5CF6'],
    });
  };

  const handleClaimQuest = (questNumber: number, xpReward: number) => {
    const claimKey = `quest_${questNumber}_claimed_${today}`;
    if (localStorage.getItem(claimKey) === 'true') {
      return;
    }
    gainXP(xpReward);
    fireGoldenConfetti();
    localStorage.setItem(claimKey, 'true');
    if (questNumber === 1) {
      setQuest1Claimed(true);
    } else if (questNumber === 2) {
      setQuest2Claimed(true);
    } else if (questNumber === 3) {
      setQuest3Claimed(true);
    }
  };

  const handleClaimChest = () => {
    if (!allQuestsCompleted || isChestClaimedToday) return;
    if (localStorage.getItem('daily_chest_claimed_date') === today) return;
    gainXP(100);
    fireGoldenConfetti();
    setChestClaimedDate(today);
    localStorage.setItem('daily_chest_claimed_date', today);
  };

  // Smart Recommendation: Find the best next action
  const getSmartRecommendation = () => {
    if (dueWords.length > 0) {
      return {
        title: `Ôn tập ${dueWords.length} thẻ Flashcard đến hạn`,
        desc: 'Thuật toán SRS đã căn giờ tối ưu để củng cố trí nhớ dài hạn của bạn.',
        tab: 'flashcards' as ActiveTab,
        icon: <Brain className="w-5 h-5 text-emerald-400" />,
        color: 'from-emerald-500 to-teal-500',
        badge: 'Cần ôn ngay'
      };
    }
    if (unresolvedMistakes.length > 0) {
      return {
        title: `Giải cứu ${unresolvedMistakes.length} từ trong Sổ Bẫy Lỗi`,
        desc: 'Ôn đúng 2 lần liên tiếp để xóa bỏ bẫy lỗi và lấy trọn điểm kinh nghiệm.',
        tab: 'mistakes' as ActiveTab,
        icon: <ShieldAlert className="w-5 h-5 text-rose-400" />,
        color: 'from-rose-500 to-amber-500',
        badge: 'Cần khắc phục'
      };
    }
    return {
      title: 'Luyện Hội Thoại Đa Lượt Roleplay AI',
      desc: 'Nâng cấp phản xạ giao tiếp tiếng Anh tự nhiên với phỏng vấn Tech & đời sống.',
      tab: 'four_skills' as ActiveTab,
      icon: <Mic className="w-5 h-5 text-purple-400" />,
      color: 'from-purple-500 to-pink-500',
      badge: 'Đề xuất hôm nay'
    };
  };

  const recommendation = getSmartRecommendation();

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 animate-fadeIn select-none">
      
      {/* ========================================================================= */}
      {/* 1. BANNER CHÀO MỪNG HOÀNG GIA (MYTHIC HERO BANNER)                         */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 shadow-2xl p-6 sm:p-10">
        
        {/* Glow Cosmic Background Accents */}
        <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -mb-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-0 -ml-20 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
          
          {/* Avatar & Character Identity */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 max-w-2xl">
            
            {/* Glowing Radiant Avatar */}
            <div className="relative group shrink-0">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 rounded-3xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt pointer-events-none" />
              <div className="relative">
                <UserAvatar 
                  name={profile.name || 'U'}
                  level={currentLevel}
                  size="lg"
                  showLevelBadge={true}
                  equippedFrame={profile.equippedFrame}
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <UserRankBadge level={currentLevel} size="sm" />
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-cyan-500/15 via-purple-500/15 to-pink-500/15 border border-cyan-400/60 text-cyan-300 rounded-full text-xs font-black tracking-wide uppercase shadow-sm shadow-cyan-500/20">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  <span>
                    {currentLevel >= 50
                      ? '⚔️ BẬC THẦY NGÔN NGỮ'
                      : currentLevel >= 25
                      ? '💻 TECH ARCHITECT'
                      : currentLevel >= 10
                      ? '⚡ CHIẾN BINH TINH ANH'
                      : '🌱 TÂN THỦ TIÊN PHONG'}
                  </span>
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
                {timeGreeting} <span className={`${userRank.nameClass} ${userRank.nameDropShadow}`}>{profile.name}</span>! {timeIcon}
              </h1>

              {/* EXP Level Up Progress Bar */}
              <div className="space-y-1.5 pt-1 max-w-md">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-amber-400 flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    <span>👑 Cấp {currentLevel} ➔ Cấp {currentLevel + 1}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    {xpDeltaNotice && (
                      <span
                        data-testid="xp-delta-badge"
                        className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-black bg-amber-400/20 text-amber-300 border border-amber-400/40 animate-fadeIn motion-reduce:animate-none"
                      >
                        +{xpDeltaNotice.amount} XP
                      </span>
                    )}
                    <span className="text-slate-300 font-mono font-bold">
                      {currentLevelXp} / {nextLevelXpRequired} XP ({percentage}%)
                    </span>
                  </div>
                </div>

                <div className="w-full bg-slate-950/90 border border-slate-800 h-3 rounded-full overflow-hidden p-0.5 shadow-inner">
                  <div 
                    className="bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300 h-full rounded-full transition-all duration-700 shadow-md shadow-amber-500/50 motion-reduce:transition-none"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Daily Motivation Quote Box */}
          <div className="w-full lg:w-96 p-4 sm:p-5 bg-slate-950/80 border border-slate-800/90 rounded-3xl space-y-2.5 shadow-xl relative backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Trích dẫn động lực ngày:</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopyQuote}
                  title={copiedQuote ? "Đã sao chép vào bộ nhớ tạm" : "Sao chép trích dẫn"}
                  aria-label="Sao chép trích dẫn"
                  className="p-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-xl transition-colors"
                >
                  {copiedQuote ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => speakWord(currentQuote.en)}
                  title="Nghe phát âm câu châm ngôn"
                  aria-label="Nghe phát âm câu châm ngôn"
                  className="p-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-xl transition-colors"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-xs sm:text-sm font-semibold text-slate-100 italic leading-relaxed">
              "{currentQuote.en}"
            </p>

            <p className="text-xs text-slate-400 pt-1 border-t border-slate-850">
              🇻🇳 {currentQuote.vi}{currentQuote.author ? <> — <strong className="text-slate-300 font-semibold">{currentQuote.author}</strong></> : null}
            </p>
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2. TODAY LEARNING HUB (CONTINUE LEARNING + TODAY LEARNING PLAN)           */}
      {/* ========================================================================= */}
      <ContinueLearningSection
        onNavigate={onNavigate}
        setActiveFourSkill={setActiveFourSkill}
      />

      <TodayLearningPlanWidget
        plan={todayPlan}
        onNavigate={onNavigate}
        onStartAdaptivePractice={startAdaptivePractice}
        setActiveFourSkill={setActiveFourSkill}
        userName={profile.name}
        isHydrated={isHydrated}
      />

      {/* 2.5 PERSONALIZED LEARNING INSIGHTS (DERIVED EVIDENCE LAYER) */}
      <PersonalizedInsightsSection
        onNavigate={onNavigate}
        onStartAdaptivePractice={startAdaptivePractice}
        setActiveFourSkill={setActiveFourSkill}
      />

      {/* ========================================================================= */}
      {/* 3. PROGRESS TODAY (TIẾN ĐỘ HÔM NAY: CHỈ SỐ NGÀY & NHIỆM VỤ RƯƠNG BÁU)     */}
      {/* ========================================================================= */}
      <div className="space-y-6">
        {/* Quick Performance Counter Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Nút Kích Hoạt Ôn Tập Từ Vựng - Interactive Card */}
          <div 
            onClick={() => setIsReviewModalOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsReviewModalOpen(true);
              }
            }}
            className="group relative flex items-center justify-between bg-slate-950/80 hover:bg-slate-900 border border-slate-800/80 hover:border-emerald-500/50 p-3.5 rounded-2xl cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none shadow-lg hover:shadow-emerald-500/10 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            title="Nhấp để bắt đầu phiên ôn tập từ vựng"
          >
            <div>
              <div className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
                <span>Cần ôn hôm nay</span>
                {dueWords.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
              </div>
              <div className="text-base font-black text-white mt-0.5">
                <span className="text-emerald-400">{dueWords.length}</span> từ <span className="text-xs text-slate-500 font-normal">(Đã ôn: {todayProgress.wordsReviewed})</span>
              </div>
            </div>

            <div className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/10 group-hover:bg-emerald-500 text-emerald-400 group-hover:text-slate-950 rounded-xl text-xs font-black border border-emerald-500/20 group-hover:border-emerald-500 transition-all shrink-0">
              <Play className="w-3 h-3 fill-current" />
              <span className="hidden sm:inline">Ôn ngay</span>
            </div>
          </div>

          <div className="flex items-center gap-3.5 bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-2xl">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/15 flex items-center justify-center text-cyan-400 border border-cyan-500/30 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Từ mới hôm nay</div>
              <div className="text-base font-black text-white">
                <span className="text-cyan-400">{todayProgress.newWordsLearned || 0}</span> <span className="text-xs text-slate-500">/ {profile.targetDailyNewWords || 15} mục tiêu</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-2xl">
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400 border border-amber-500/30 shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400">XP kiếm được hôm nay</div>
              <div className="text-base font-black text-amber-300">+{todayProgress.xpGained} XP</div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-2xl">
            <div className="w-11 h-11 rounded-xl bg-orange-500/15 flex items-center justify-center text-orange-400 border border-orange-500/30 shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Chuỗi Streak</span>
                {(profile.longestStreak ?? 0) > profile.streak && (
                  <span className="text-[10px] font-semibold text-amber-400/90 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    Kỷ lục: {profile.longestStreak}
                  </span>
                )}
              </div>
              <div className="text-base font-black text-orange-400">{profile.streak} ngày liên tục 🔥</div>
            </div>
          </div>

        </div>

        {/* Hệ Thống Nhiệm Vụ Ngày & Rương Báu Hoàng Gia */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white">Nhiệm Vụ Ngày & Rương Báu Hoàng Gia</h2>
              <p className="text-xs text-slate-400">Hoàn thành 3 nhiệm vụ để mở khóa Rương Báu và nhận bảo vệ chuỗi Streak!</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-amber-400 font-mono">
              Tiến độ: {[isQuest1Done, isQuest2Done, isQuest3Done].filter(Boolean).length} / 3 nhiệm vụ
            </span>
          </div>
        </div>

        {/* 3 Quests Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Quest 1 */}
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between ${
            isQuest1Done ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-slate-950 border-slate-800'
          }`}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400">Nhiệm vụ 1</span>
                <span className="text-[11px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                  +50 XP
                </span>
              </div>
              <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Headphones className="w-4 h-4 text-cyan-400" />
                <span>Hoàn thành 1 bài Nghe / Đọc</span>
              </h4>
              <p className="text-xs text-slate-400">Làm trắc nghiệm hiểu bài trong phân hệ 4 Kỹ Năng.</p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-850 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-400">{q1Progress}/1 bài</span>
              {isQuest1Done ? (
                quest1Claimed ? (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Đã nhận</span>
                  </span>
                ) : (
                  <button
                    onClick={() => handleClaimQuest(1, 50)}
                    className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.97] transition-all duration-150 motion-reduce:transform-none motion-reduce:transition-none text-slate-950 font-black rounded-xl text-xs shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    Nhận +50 XP
                  </button>
                )
              ) : (
                <button
                  onClick={() => onNavigate('four_skills')}
                  className="text-xs font-bold text-cyan-400 hover:underline active:scale-[0.97] transition-transform duration-150 motion-reduce:transform-none motion-reduce:transition-none flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded"
                >
                  <span>Luyện ngay</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Quest 2 */}
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between ${
            isQuest2Done ? 'bg-purple-950/20 border-purple-500/40' : 'bg-slate-950 border-slate-800'
          }`}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-400">Nhiệm vụ 2</span>
                <span className="text-[11px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                  +60 XP
                </span>
              </div>
              <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Mic className="w-4 h-4 text-purple-400" />
                <span>Luyện Nói phát âm ≥ 80%</span>
              </h4>
              <p className="text-xs text-slate-400">Thực hành hội thoại đa lượt qua Micro AI.</p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-850 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-400">{q2Progress}/1 bài</span>
              {isQuest2Done ? (
                quest2Claimed ? (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Đã nhận</span>
                  </span>
                ) : (
                  <button
                    onClick={() => handleClaimQuest(2, 60)}
                    className="px-3 py-1 bg-purple-500 hover:bg-purple-400 active:scale-[0.97] transition-all duration-150 motion-reduce:transform-none motion-reduce:transition-none text-white font-black rounded-xl text-xs shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                  >
                    Nhận +60 XP
                  </button>
                )
              ) : (
                <button
                  onClick={() => onNavigate('four_skills')}
                  className="text-xs font-bold text-purple-400 hover:underline active:scale-[0.97] transition-transform duration-150 motion-reduce:transform-none motion-reduce:transition-none flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded"
                >
                  <span>Luyện ngay</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Quest 3 */}
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between ${
            isQuest3Done ? 'bg-amber-950/20 border-amber-500/40' : 'bg-slate-950 border-slate-800'
          }`}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400">Nhiệm vụ 3</span>
                <span className="text-[11px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                  +40 XP
                </span>
              </div>
              <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-emerald-400" />
                <span>Ôn tập 20 thẻ SRS Flashcard</span>
              </h4>
              <p className="text-xs text-slate-400">Ôn luyện ngắt quãng để củng cố trí nhớ dài hạn.</p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-850 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-400">{q3Progress}/20 thẻ</span>
              {isQuest3Done ? (
                quest3Claimed ? (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Đã nhận</span>
                  </span>
                ) : (
                  <button
                    onClick={() => handleClaimQuest(3, 40)}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 active:scale-[0.97] transition-all duration-150 motion-reduce:transform-none motion-reduce:transition-none text-slate-950 font-black rounded-xl text-xs shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    Nhận +40 XP
                  </button>
                )
              ) : (
                <button
                  onClick={() => onNavigate('flashcards')}
                  className="text-xs font-bold text-emerald-400 hover:underline active:scale-[0.97] transition-transform duration-150 motion-reduce:transform-none motion-reduce:transition-none flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded"
                >
                  <span>Ôn ngay</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Mystery Chest Unlocker Bar */}
        <div className={`p-5 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
          allQuestsCompleted
            ? isChestClaimedToday
              ? 'bg-slate-950 border-slate-800 opacity-80'
              : 'bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-purple-500/20 border-amber-400 shadow-xl shadow-amber-500/10'
            : 'bg-slate-950 border-slate-800/80'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
              allQuestsCompleted && !isChestClaimedToday
                ? 'bg-gradient-to-tr from-amber-400 to-orange-400 text-slate-950 shadow-lg shadow-amber-500/40 animate-bounce'
                : 'bg-slate-800 text-slate-400'
            }`}>
              <Gift className="w-7 h-7" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Rương Báu Ngày: +100 XP & Khiên Bảo Vệ Streak 🛡️
                </h3>
                {allQuestsCompleted && !isChestClaimedToday && (
                  <span className="px-2 py-0.5 bg-amber-400 text-slate-950 rounded-full text-[10px] font-black uppercase animate-pulse">
                    Mở Khóa!
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {allQuestsCompleted 
                  ? isChestClaimedToday ? 'Bạn đã mở rương hôm nay. Hãy quay lại vào ngày mai!' : 'Chúc mừng! Bạn đã đủ điều kiện mở rương báu.'
                  : 'Hoàn thành đủ 3 nhiệm vụ ngày để mở rương báu.'}
              </p>
            </div>
          </div>

          <div className="self-end sm:self-auto shrink-0">
            {allQuestsCompleted ? (
              isChestClaimedToday ? (
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Đã nhận thưởng hôm nay</span>
                </div>
              ) : (
                <button
                  onClick={handleClaimChest}
                  className="px-6 py-3 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 active:scale-[0.97] text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-xl shadow-amber-500/30 transition-all duration-150 hover:scale-[1.02] motion-reduce:transform-none motion-reduce:transition-none flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <Gift className="w-4 h-4" />
                  <span>Mở Rương Báu (+100 XP)</span>
                </button>
              )
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-500 px-4 py-2 bg-slate-900 rounded-xl border border-slate-800">
                <Lock className="w-4 h-4" />
                <span>Chưa mở khóa</span>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>

      {/* ========================================================================= */}
      {/* 4. ADAPTIVE INSIGHT (PHIÊN LUYỆN THÍCH ỨNG & PHÂN TÍCH ĐIỂM YẾU)           */}
      {/* ========================================================================= */}
      {unresolvedMistakes.length > 0 && (
        <div className="bg-gradient-to-r from-rose-950/40 via-slate-900 to-amber-950/30 border border-rose-500/40 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-5 animate-fadeIn">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Phiên Luyện Thích Ứng: <span className="text-amber-400">~{adaptiveSession.estimatedMinutes} phút</span>
                </h3>
                <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full text-[10px] font-bold uppercase">
                  {unresolvedMistakes.length} từ bẫy lỗi
                </span>
                {recurringMistakes.length > 0 && (
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[10px] font-bold uppercase">
                    {recurringMistakes.length} từ tái diễn
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Tập trung khắc phục điểm yếu <strong>{adaptiveSession.focusWeakness ? (MISTAKE_TYPE_LABELS[adaptiveSession.focusWeakness] || adaptiveSession.focusWeakness) : 'tổng hợp'}</strong> qua {adaptiveSession.totalExercises} bài tập đề xuất từ bẫy lỗi.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end lg:self-auto shrink-0 flex-wrap">
            <button
              onClick={() => onNavigate('mistakes')}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 active:scale-[0.97] transition-all duration-150 motion-reduce:transform-none motion-reduce:transition-none text-slate-200 border border-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Xem Sổ Bẫy Lỗi</span>
            </button>
            <button
              onClick={handleStartAdaptiveSession}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-[0.97] text-slate-950 font-black rounded-xl text-xs transition-all duration-150 shadow-lg shadow-amber-500/20 hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Bắt Đầu Luyện Thích Ứng</span>
            </button>
          </div>
        </div>
      )}

      {/* KHU VỰC HỌC THÍCH ỨNG (UNIFIED ADAPTIVE LEARNING HUB) */}
      {!isNewUser && (
        <div className="space-y-4">
          <AdaptiveLearningSummary
            metrics={metrics}
            forecast={forecast}
            leechCount={leechCount}
            recommendation={adaptiveRecommendation}
            onOpenDetails={() => setIsAnalyticsModalOpen(true)}
          />

          <LeechWordsWidget
            vocabularyList={vocabularyList}
            srsProgressMap={srsProgressMap}
            onNavigate={onNavigate}
          />
        </div>
      )}

      {/* FOUR SKILLS ADAPTIVE SUMMARY */}
      <FourSkillsAdaptiveSummary onNavigate={onNavigate} />

      {/* ========================================================================= */}
      {/* 5. STATISTICS (NĂNG LỰC 4 KỸ NĂNG, HEATMAP, THÀNH TỰU - LOWER PROMINENCE) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Radar & Skill Proficiency Bars */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              <span>Năng Lực 4 Kỹ Năng</span>
            </h2>
            <span className="text-xs text-slate-400 font-mono">Tổng quan CEFR</span>
          </div>

          <div className="space-y-4">
            {/* Listening */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-cyan-400 flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5" />
                  <span>Luyện Nghe (Listening)</span>
                </span>
                {fourSkills.listening.isAssessed ? (
                  <span className="flex items-center gap-1.5 font-mono text-slate-300">
                    <span>Level {fourSkills.listening.level} · {fourSkills.listening.score}%</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                        fourSkills.listening.confidence === 'high'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : fourSkills.listening.confidence === 'medium'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                      title={`Độ tin cậy: ${
                        fourSkills.listening.confidence === 'high'
                          ? 'Cao'
                          : fourSkills.listening.confidence === 'medium'
                          ? 'Trung bình'
                          : 'Thấp'
                      }`}
                    >
                      {fourSkills.listening.confidence === 'high'
                        ? 'Confidence: High'
                        : fourSkills.listening.confidence === 'medium'
                        ? 'Confidence: Med'
                        : 'Confidence: Low'}
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-500 italic text-xs">Chưa đánh giá</span>
                )}
              </div>
              <div
                className="w-full bg-slate-950 h-2 rounded-full overflow-hidden"
                title={
                  fourSkills.listening.isAssessed
                    ? `Điểm năng lực tổng thể: ${fourSkills.listening.score}/100`
                    : 'Chưa có dữ liệu bài tập'
                }
              >
                <div
                  className="bg-cyan-400 h-full rounded-full shadow-sm shadow-cyan-400/50 transition-all duration-500"
                  style={{ width: fourSkills.listening.isAssessed ? `${Math.max(4, fourSkills.listening.score)}%` : '0%' }}
                />
              </div>
            </div>

            {/* Reading */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Luyện Đọc (Reading)</span>
                </span>
                {fourSkills.reading.isAssessed ? (
                  <span className="flex items-center gap-1.5 font-mono text-slate-300">
                    <span>Level {fourSkills.reading.level} · {fourSkills.reading.score}%</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                        fourSkills.reading.confidence === 'high'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : fourSkills.reading.confidence === 'medium'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                      title={`Độ tin cậy: ${
                        fourSkills.reading.confidence === 'high'
                          ? 'Cao'
                          : fourSkills.reading.confidence === 'medium'
                          ? 'Trung bình'
                          : 'Thấp'
                      }`}
                    >
                      {fourSkills.reading.confidence === 'high'
                        ? 'Confidence: High'
                        : fourSkills.reading.confidence === 'medium'
                        ? 'Confidence: Med'
                        : 'Confidence: Low'}
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-500 italic text-xs">Chưa đánh giá</span>
                )}
              </div>
              <div
                className="w-full bg-slate-950 h-2 rounded-full overflow-hidden"
                title={
                  fourSkills.reading.isAssessed
                    ? `Điểm năng lực tổng thể: ${fourSkills.reading.score}/100`
                    : 'Chưa có dữ liệu bài tập'
                }
              >
                <div
                  className="bg-emerald-400 h-full rounded-full shadow-sm shadow-emerald-400/50 transition-all duration-500"
                  style={{ width: fourSkills.reading.isAssessed ? `${Math.max(4, fourSkills.reading.score)}%` : '0%' }}
                />
              </div>
            </div>

            {/* Speaking */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-purple-400 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5" />
                  <span>Luyện Nói (Speaking)</span>
                </span>
                {fourSkills.speaking.isAssessed ? (
                  <span className="flex items-center gap-1.5 font-mono text-slate-300">
                    <span>Level {fourSkills.speaking.level} · {fourSkills.speaking.score}%</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                        fourSkills.speaking.confidence === 'high'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : fourSkills.speaking.confidence === 'medium'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                      title={`Độ tin cậy: ${
                        fourSkills.speaking.confidence === 'high'
                          ? 'Cao'
                          : fourSkills.speaking.confidence === 'medium'
                          ? 'Trung bình'
                          : 'Thấp'
                      }`}
                    >
                      {fourSkills.speaking.confidence === 'high'
                        ? 'Confidence: High'
                        : fourSkills.speaking.confidence === 'medium'
                        ? 'Confidence: Med'
                        : 'Confidence: Low'}
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-500 italic text-xs">Chưa đánh giá</span>
                )}
              </div>
              <div
                className="w-full bg-slate-950 h-2 rounded-full overflow-hidden"
                title={
                  fourSkills.speaking.isAssessed
                    ? `Điểm năng lực tổng thể: ${fourSkills.speaking.score}/100`
                    : 'Chưa có dữ liệu bài tập'
                }
              >
                <div
                  className="bg-purple-400 h-full rounded-full shadow-sm shadow-purple-400/50 transition-all duration-500"
                  style={{ width: fourSkills.speaking.isAssessed ? `${Math.max(4, fourSkills.speaking.score)}%` : '0%' }}
                />
              </div>
            </div>

            {/* Writing */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-amber-400 flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5" />
                  <span>Luyện Viết (Writing)</span>
                </span>
                {fourSkills.writing.isAssessed ? (
                  <span className="flex items-center gap-1.5 font-mono text-slate-300">
                    <span>Level {fourSkills.writing.level} · {fourSkills.writing.score}%</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                        fourSkills.writing.confidence === 'high'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : fourSkills.writing.confidence === 'medium'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                      title={`Độ tin cậy: ${
                        fourSkills.writing.confidence === 'high'
                          ? 'Cao'
                          : fourSkills.writing.confidence === 'medium'
                          ? 'Trung bình'
                          : 'Thấp'
                      }`}
                    >
                      {fourSkills.writing.confidence === 'high'
                        ? 'Confidence: High'
                        : fourSkills.writing.confidence === 'medium'
                        ? 'Confidence: Med'
                        : 'Confidence: Low'}
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-500 italic text-xs">Chưa đánh giá</span>
                )}
              </div>
              <div
                className="w-full bg-slate-950 h-2 rounded-full overflow-hidden"
                title={
                  fourSkills.writing.isAssessed
                    ? `Điểm năng lực tổng thể: ${fourSkills.writing.score}/100`
                    : 'Chưa có dữ liệu bài tập'
                }
              >
                <div
                  className="bg-amber-400 h-full rounded-full shadow-sm shadow-amber-400/50 transition-all duration-500"
                  style={{ width: fourSkills.writing.isAssessed ? `${Math.max(4, fourSkills.writing.score)}%` : '0%' }}
                />
              </div>
            </div>

            {/* Kho từ vựng tích lũy Button */}
            <button
              onClick={() => setIsMyVocabBankOpen(true)}
              className="w-full pt-3 border-t border-slate-850 flex items-center justify-between text-xs text-slate-400 hover:text-emerald-300 transition-colors group cursor-pointer text-left"
              title="Nhấp để xem danh sách toàn bộ từ vựng đã tích lũy trong SRS"
            >
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Kho từ vựng tích lũy:</span>
              </span>
              <span className="flex items-center gap-1.5">
                <strong className="text-white group-hover:text-emerald-300 font-mono font-bold">
                  {fourSkills.accumulatedCoreWords} từ cốt lõi
                </strong>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
              </span>
            </button>
          </div>
        </div>

        {/* Smart Next Step Recommendation Card */}
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-full text-xs font-black uppercase">
                {recommendation.badge}
              </span>
              <span className="text-xs text-slate-400">• Gợi ý tối ưu theo tiến trình học</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-3">
              {recommendation.icon}
              <span>{recommendation.title}</span>
            </h3>

            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              {recommendation.desc}
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400">
              💡 Bấm vào nút bên cạnh để bắt đầu bài học được hệ thống đề xuất:
            </div>

            <button
              onClick={() => onNavigate(recommendation.tab)}
              className={`w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r ${recommendation.color} text-slate-950 font-black rounded-2xl shadow-xl transition-all duration-150 active:scale-[0.97] hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none flex items-center justify-center gap-2 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400`}
            >
              <span>Tiếp Tục Chặng Học Tiếp Theo 🚀</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 4. BẢNG HOẠT ĐỘNG (HEATMAP) & BẢNG XẾP HẠNG (LEADERBOARD)                  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Activity Heatmap (2 Columns) */}
        <div className="lg:col-span-2">
          <ActivityHeatmap />
        </div>

        {/* Mini Achievements & Badges Showcase Widget (1 Column) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Thành Tựu & Danh Hiệu</h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Đã mở khóa: <strong className="text-amber-400 font-bold">{unlockedBadgesCount} / {totalBadgesCount}</strong> ({badgesProgressPercent}%)
                  </span>
                </div>
              </div>

              <div className="w-20 bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className="bg-gradient-to-r from-amber-400 to-yellow-300 h-full rounded-full transition-all duration-500"
                  style={{ width: `${badgesProgressPercent}%` }}
                />
              </div>
            </div>

            {/* Badges Grid (2 Columns) */}
            <div className="grid grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto no-scrollbar pr-0.5">
              {systemAchievements.map((ach) => (
                <div
                  key={ach.id}
                  onClick={() => setIsAchievementsModalOpen(true)}
                  title={`${ach.title}: ${ach.description} (Thưởng: +${ach.xpReward} XP)`}
                  className={`p-3 rounded-2xl flex flex-col justify-between group hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 motion-reduce:transform-none motion-reduce:transition-none cursor-pointer border ${
                    ach.isUnlocked
                      ? 'bg-gradient-to-br from-amber-500/15 via-slate-950 to-slate-900 border-amber-500/40 shadow-sm hover:shadow-amber-500/20'
                      : 'bg-slate-950/80 border-slate-800/80 opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xl">{ach.icon}</span>
                    {ach.isUnlocked ? (
                      <span className="text-[9px] font-black bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full uppercase">
                        Đã mở
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-slate-500 flex items-center gap-0.5 font-mono">
                        <Lock className="w-2.5 h-2.5" />
                        <span>{ach.progress}/{ach.target}</span>
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className={`text-xs font-black line-clamp-1 transition-colors ${
                      ach.isUnlocked ? 'text-white group-hover:text-amber-300' : 'text-slate-400 group-hover:text-slate-200'
                    }`}>
                      {ach.title}
                    </h4>
                    <span className={`text-[10px] block font-mono ${
                      ach.isUnlocked ? 'text-amber-400/90' : 'text-slate-500'
                    }`}>
                      {ach.categoryName} • +{ach.xpReward} XP
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-semibold">
              💡 Bấm vào để xem 12 danh hiệu
            </span>
            <button
              onClick={() => setIsAchievementsModalOpen(true)}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>Xem tất cả</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Modal Ôn Tập Từ Vựng SRS Toàn Diện */}
      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onNavigate={onNavigate}
      />

      {/* Modal Kho Từ Vựng Tích Lũy */}
      <MyVocabBankModal
        isOpen={isMyVocabBankOpen}
        onClose={() => setIsMyVocabBankOpen(false)}
        onNavigate={onNavigate}
      />

      {/* Modal Danh Hiệu & Thành Tựu Toàn Diện */}
      <AchievementsModal
        isOpen={isAchievementsModalOpen}
        onClose={() => setIsAchievementsModalOpen(false)}
      />

      {/* Modal Phân Tích Thích Ứng Toàn Diện (SRSAnalyticsModal) */}
      <SRSAnalyticsModal
        isOpen={isAnalyticsModalOpen}
        onClose={() => setIsAnalyticsModalOpen(false)}
      />

    </div>
  );
};
