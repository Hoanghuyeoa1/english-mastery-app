import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  Sparkles, 
  Brain, 
  Target, 
  Mic, 
  Zap, 
  ArrowRight, 
  Volume2,
  RefreshCw, 
  Bot, 
  Award,
  ShieldAlert,
  Headphones,
  BookOpen,
  PenTool,
  Gift,
  Trophy,
  CheckCircle2,
  Crown,
  Lock,
  ChevronRight,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAppStore } from '../store/useAppStore';
import { isDueForReview } from '../services/srsAlgorithm';
import { speakWord } from '../services/speechService';
import { ActiveTab } from '../types';
import { ActivityHeatmap } from './ActivityHeatmap';
import { UserAvatar, UserRankBadge } from './UserProfileBadge';
import { getUserRankInfo, getXpLevelProgress } from '../utils/userRank';
import { getDailyQuote } from '../data/dailyQuotes';

interface DashboardProps {
  onNavigate: (tab: ActiveTab) => void;
  onOpenAddWord: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { profile, vocabularyList, dailyHistory, mistakeBank, gainXP } = useAppStore();

  const today = new Date().toISOString().split('T')[0];
  const todayProgress = dailyHistory[today] || {
    date: today,
    wordsReviewed: 0,
    newWordsLearned: 0,
    quizzesCompleted: 0,
    pronunciationsMastered: 0,
    xpGained: 0,
  };

  const dueWords = vocabularyList.filter((w) => isDueForReview(w.nextReviewDate) && (w.srsLevel > 0 || !!w.lastReviewedDate));
  const masteredWords = vocabularyList.filter((w) => w.srsLevel >= 3);
  const learningWords = vocabularyList.filter((w) => w.srsLevel > 0 && w.srsLevel < 3);
  const newWords = vocabularyList.filter((w) => w.srsLevel === 0 && !w.lastReviewedDate);

  const unresolvedMistakes = Object.values(mistakeBank || {}).filter((m) => !m.resolved);
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

  // Daily Quote (seeded by Day of Year / Date)
  const currentQuote = getDailyQuote(today);

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
  // Quest 1: Listening / Reading Completed (from localStorage tracking or quizzes)
  const completedListeningCount = (() => {
    try {
      return JSON.parse(localStorage.getItem('completed_listening_lessons') || '[]').length;
    } catch {
      return 0;
    }
  })();
  const q1Progress = Math.min(1, (todayProgress.quizzesCompleted > 0 || completedListeningCount > 0 ? 1 : 0));

  // Quest 2: Speaking practice completed
  const completedSpeakingCount = (() => {
    try {
      return JSON.parse(localStorage.getItem('completed_speaking_prompts') || '[]').length;
    } catch {
      return 0;
    }
  })();
  const q2Progress = Math.min(1, (todayProgress.pronunciationsMastered > 0 || completedSpeakingCount > 0 ? 1 : 0));

  // Quest 3: 20 Flashcards reviewed
  const q3Progress = Math.min(20, todayProgress.wordsReviewed || 0);

  const isQuest1Done = q1Progress >= 1;
  const isQuest2Done = q2Progress >= 1;
  const isQuest3Done = q3Progress >= 20;

  const allQuestsCompleted = isQuest1Done && isQuest2Done && isQuest3Done;
  const isChestClaimedToday = chestClaimedDate === today;

  const fireGoldenConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#F59E0B', '#10B981', '#06B6D4', '#8B5CF6']
      });
    } catch {
      // fallback
    }
  };

  const handleClaimQuest = (questNumber: number, xpReward: number) => {
    gainXP(xpReward);
    fireGoldenConfetti();
    if (questNumber === 1) {
      setQuest1Claimed(true);
      localStorage.setItem(`quest_1_claimed_${today}`, 'true');
    } else if (questNumber === 2) {
      setQuest2Claimed(true);
      localStorage.setItem(`quest_2_claimed_${today}`, 'true');
    } else if (questNumber === 3) {
      setQuest3Claimed(true);
      localStorage.setItem(`quest_3_claimed_${today}`, 'true');
    }
  };

  const handleClaimChest = () => {
    if (!allQuestsCompleted || isChestClaimedToday) return;
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
                  <span className="text-slate-300 font-mono font-bold">
                    {currentLevelXp} / {nextLevelXpRequired} XP ({percentage}%)
                  </span>
                </div>

                <div className="w-full bg-slate-950/90 border border-slate-800 h-3 rounded-full overflow-hidden p-0.5 shadow-inner">
                  <div 
                    className="bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300 h-full rounded-full transition-all duration-700 shadow-md shadow-amber-500/50"
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
              <button
                onClick={() => speakWord(currentQuote.en)}
                title="Nghe phát âm câu châm ngôn"
                className="p-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-xl transition-colors"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs sm:text-sm font-semibold text-slate-100 italic leading-relaxed">
              "{currentQuote.en}"
            </p>

            <p className="text-xs text-slate-400 pt-1 border-t border-slate-850">
              🇻🇳 {currentQuote.vi} — <strong className="text-slate-300 font-semibold">{currentQuote.author}</strong>
            </p>
          </div>

        </div>

        {/* Quick Performance Counter Badges */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="flex items-center gap-3.5 bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-2xl">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 border border-emerald-500/30 shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Cần ôn hôm nay</div>
              <div className="text-base font-black text-white">
                <span className="text-emerald-400">{dueWords.length}</span> từ <span className="text-xs text-slate-500 font-normal">(Đã ôn: {todayProgress.wordsReviewed})</span>
              </div>
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
              <div className="text-xs text-slate-400">Chuỗi Streak</div>
              <div className="text-base font-black text-orange-400">{profile.streak} ngày liên tục 🔥</div>
            </div>
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2. HỆ THỐNG NHIỆM VỤ NGÀY & RƯƠNG BÁU (DAILY QUESTS & MYSTERY CHEST)       */}
      {/* ========================================================================= */}
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
                    className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-md"
                  >
                    Nhận +50 XP
                  </button>
                )
              ) : (
                <button
                  onClick={() => onNavigate('four_skills')}
                  className="text-xs font-bold text-cyan-400 hover:underline flex items-center gap-1"
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
                    className="px-3 py-1 bg-purple-500 hover:bg-purple-400 text-white font-black rounded-xl text-xs shadow-md"
                  >
                    Nhận +60 XP
                  </button>
                )
              ) : (
                <button
                  onClick={() => onNavigate('four_skills')}
                  className="text-xs font-bold text-purple-400 hover:underline flex items-center gap-1"
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
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-md"
                  >
                    Nhận +40 XP
                  </button>
                )
              ) : (
                <button
                  onClick={() => onNavigate('flashcards')}
                  className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1"
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
                  className="px-6 py-3 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-xl shadow-amber-500/30 transition-all transform hover:scale-105 flex items-center gap-2"
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

      {/* Sổ Bẫy Lỗi Alert Banner */}
      {unresolvedMistakes.length > 0 && (
        <div className="bg-gradient-to-r from-rose-950/40 via-slate-900 to-amber-950/30 border border-rose-500/40 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Sổ Tay Bẫy Lỗi: <span className="text-rose-400">{unresolvedMistakes.length} từ</span> cần khắc phục
                </h3>
                <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full text-[10px] font-bold uppercase">
                  Cần chú ý
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Các từ vựng bạn từng bấm "Quên" hoặc làm sai minigame. Ôn đúng 2 lần liên tiếp để tự động giải cứu!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              onClick={() => onNavigate('mistakes')}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Xem Sổ Bẫy Lỗi</span>
            </button>
            <button
              onClick={() => onNavigate('flashcards')}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5"
            >
              <Brain className="w-4 h-4 text-emerald-400" />
              <span>Ôn Thẻ SRS</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SKILL MASTERY RADAR / STATS & SMART NEXT STEP RECOMMENDATION           */}
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
              <div className="flex justify-between text-xs font-bold">
                <span className="text-cyan-400 flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5" />
                  <span>🎧 Luyện Nghe (Listening)</span>
                </span>
                <span className="text-slate-300 font-mono">Level B2 (75%)</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                <div className="bg-cyan-400 h-full rounded-full w-3/4 shadow-sm shadow-cyan-400/50" />
              </div>
            </div>

            {/* Reading */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>📖 Luyện Đọc (Reading)</span>
                </span>
                <span className="text-slate-300 font-mono">Level C1 (88%)</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-400 h-full rounded-full w-[88%] shadow-sm shadow-emerald-400/50" />
              </div>
            </div>

            {/* Speaking */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-purple-400 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5" />
                  <span>🗣️ Luyện Nói (Speaking)</span>
                </span>
                <span className="text-slate-300 font-mono">Level B1 (60%)</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                <div className="bg-purple-400 h-full rounded-full w-3/5 shadow-sm shadow-purple-400/50" />
              </div>
            </div>

            {/* Writing */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-amber-400 flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5" />
                  <span>✍️ Luyện Viết (Writing)</span>
                </span>
                <span className="text-slate-300 font-mono">Level B2 (70%)</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                <div className="bg-amber-400 h-full rounded-full w-[70%] shadow-sm shadow-amber-400/50" />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-850 flex items-center justify-between text-xs text-slate-400">
              <span>Kho từ vựng tích lũy:</span>
              <strong className="text-white font-mono">{vocabularyList.length} từ cốt lõi</strong>
            </div>
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
              className={`w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r ${recommendation.color} text-slate-950 font-black rounded-2xl shadow-xl transition-all transform hover:scale-105 flex items-center justify-center gap-2 text-xs sm:text-sm`}
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
                    Đã mở khóa: <strong className="text-amber-400 font-bold">{
                      [
                        vocabularyList.length >= 500,
                        profile.streak >= 7,
                        true,
                        true,
                        false,
                        profile.level >= 50,
                        true,
                        true
                      ].filter(Boolean).length
                    } / 8</strong> Huy hiệu
                  </span>
                </div>
              </div>

              <div className="w-16 bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className="bg-gradient-to-r from-amber-400 to-yellow-300 h-full rounded-full"
                  style={{
                    width: `${Math.round(([vocabularyList.length >= 500, profile.streak >= 7, true, true, false, profile.level >= 50, true, true].filter(Boolean).length / 8) * 100)}%`
                  }}
                />
              </div>
            </div>

            {/* Badges Grid (2 Columns) */}
            <div className="grid grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto no-scrollbar pr-0.5">
              
              {/* Badge 1: Vocab Titan */}
              <div
                title="Bậc Thầy Từ Vựng: Đã tích lũy ≥ 1.000 từ vựng cốt lõi (+200 XP)"
                className="p-3 bg-gradient-to-br from-amber-500/15 via-slate-950 to-slate-900 border border-amber-500/40 rounded-2xl flex flex-col justify-between group hover:scale-[1.02] transition-all cursor-pointer shadow-sm hover:shadow-amber-500/20"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xl">🌟</span>
                  <span className="text-[9px] font-black bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full uppercase">
                    Đã mở
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-black text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                    Bậc Thầy Từ Vựng
                  </h4>
                  <span className="text-[10px] text-amber-400/90 block font-mono">
                    Vocab Titan • +200 XP
                  </span>
                </div>
              </div>

              {/* Badge 2: Streak Master */}
              <div
                title={`Ngọn Lửa Bất Diệt: Duy trì chuỗi học liên tục 7 ngày (Tiến độ: ${profile.streak}/7 ngày)`}
                className={`p-3 rounded-2xl border flex flex-col justify-between group hover:scale-[1.02] transition-all cursor-pointer ${
                  profile.streak >= 7
                    ? 'bg-gradient-to-br from-orange-500/15 via-slate-950 to-slate-900 border-orange-500/40 shadow-sm'
                    : 'bg-slate-950/80 border-slate-800/80 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xl">🔥</span>
                  {profile.streak >= 7 ? (
                    <span className="text-[9px] font-black bg-orange-400 text-slate-950 px-1.5 py-0.2 rounded-full uppercase">
                      Đã mở
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold text-slate-500 flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" />
                      <span>{profile.streak}/7</span>
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-black text-white group-hover:text-orange-300 transition-colors line-clamp-1">
                    Ngọn Lửa Bất Diệt
                  </h4>
                  <span className="text-[10px] text-orange-400/90 block font-mono">
                    Streak Master • +150 XP
                  </span>
                </div>
              </div>

              {/* Badge 3: Native Accent */}
              <div
                title="Giọng Đọc Chuẩn Mỹ: Đạt điểm phát âm ≥ 90% trong bài Luyện Nói (+120 XP)"
                className="p-3 bg-gradient-to-br from-purple-500/15 via-slate-950 to-slate-900 border border-purple-500/40 rounded-2xl flex flex-col justify-between group hover:scale-[1.02] transition-all cursor-pointer shadow-sm hover:shadow-purple-500/20"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xl">🗣️</span>
                  <span className="text-[9px] font-black bg-purple-400 text-white px-1.5 py-0.2 rounded-full uppercase">
                    Đã mở
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-black text-white group-hover:text-purple-300 transition-colors line-clamp-1">
                    Giọng Đọc Chuẩn Mỹ
                  </h4>
                  <span className="text-[10px] text-purple-400/90 block font-mono">
                    Native Accent • +120 XP
                  </span>
                </div>
              </div>

              {/* Badge 4: Code & Report Master */}
              <div
                title="Cây Bút Chuyên Nghiệp: Hoàn thành bài viết đạt ≥ 95 điểm (+150 XP)"
                className="p-3 bg-gradient-to-br from-cyan-500/15 via-slate-950 to-slate-900 border border-cyan-500/40 rounded-2xl flex flex-col justify-between group hover:scale-[1.02] transition-all cursor-pointer shadow-sm hover:shadow-cyan-500/20"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xl">✍️</span>
                  <span className="text-[9px] font-black bg-cyan-400 text-slate-950 px-1.5 py-0.2 rounded-full uppercase">
                    Đã mở
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-black text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                    Cây Bút Chuyên Nghiệp
                  </h4>
                  <span className="text-[10px] text-cyan-400/90 block font-mono">
                    Writing Master • +150 XP
                  </span>
                </div>
              </div>

              {/* Badge 5: Mythic Hero */}
              <div
                title="Huyền Thoại Trở Lại: Đạt cấp độ Level 50+ (+500 XP)"
                className={`p-3 rounded-2xl border flex flex-col justify-between group hover:scale-[1.02] transition-all cursor-pointer ${
                  profile.level >= 50
                    ? 'bg-gradient-to-br from-rose-500/15 via-slate-950 to-slate-900 border-rose-500/40 shadow-sm shadow-rose-500/20'
                    : 'bg-slate-950/80 border-slate-800/80 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xl">👑</span>
                  {profile.level >= 50 ? (
                    <span className="text-[9px] font-black bg-rose-500 text-white px-1.5 py-0.2 rounded-full uppercase">
                      Đã mở
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold text-slate-500 flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Lv.50</span>
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-black text-white group-hover:text-rose-300 transition-colors line-clamp-1">
                    Huyền Thoại Mythic
                  </h4>
                  <span className="text-[10px] text-rose-400/90 block font-mono">
                    Mythic Hero • +500 XP
                  </span>
                </div>
              </div>

              {/* Badge 6: Speed Demon */}
              <div
                title="Tốc Độ Bàn Thờ: Vượt qua Đấu Trường Speed Match 100% không sai (+100 XP)"
                className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-2xl flex flex-col justify-between group hover:scale-[1.02] transition-all cursor-pointer opacity-75 hover:opacity-100"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xl">⚡</span>
                  <span className="text-[9px] font-bold text-slate-500 flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Chưa mở</span>
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-300 group-hover:text-amber-300 transition-colors line-clamp-1">
                    Tốc Độ Bàn Thờ
                  </h4>
                  <span className="text-[10px] text-slate-500 block font-mono">
                    Speed Demon • +100 XP
                  </span>
                </div>
              </div>

              {/* Badge 7: Mistake Slayer */}
              <div
                title="Thợ Săn Bẫy Lỗi: Giải cứu thành công ≥ 10 từ trong Sổ Bẫy Lỗi (+180 XP)"
                className="p-3 bg-gradient-to-br from-emerald-500/15 via-slate-950 to-slate-900 border border-emerald-500/40 rounded-2xl flex flex-col justify-between group hover:scale-[1.02] transition-all cursor-pointer shadow-sm hover:shadow-emerald-500/20"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xl">🎯</span>
                  <span className="text-[9px] font-black bg-emerald-400 text-slate-950 px-1.5 py-0.2 rounded-full uppercase">
                    Đã mở
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-black text-white group-hover:text-emerald-300 transition-colors line-clamp-1">
                    Thợ Săn Bẫy Lỗi
                  </h4>
                  <span className="text-[10px] text-emerald-400/90 block font-mono">
                    Mistake Slayer • +180 XP
                  </span>
                </div>
              </div>

              {/* Badge 8: Golden Ears */}
              <div
                title="Đôi Tai Vàng: Hoàn thành ≥ 5 bài Nghe đạt 100% trắc nghiệm (+140 XP)"
                className="p-3 bg-gradient-to-br from-teal-500/15 via-slate-950 to-slate-900 border border-teal-500/40 rounded-2xl flex flex-col justify-between group hover:scale-[1.02] transition-all cursor-pointer shadow-sm hover:shadow-teal-500/20"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xl">🎧</span>
                  <span className="text-[9px] font-black bg-teal-400 text-slate-950 px-1.5 py-0.2 rounded-full uppercase">
                    Đã mở
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-black text-white group-hover:text-teal-300 transition-colors line-clamp-1">
                    Đôi Tai Vàng
                  </h4>
                  <span className="text-[10px] text-teal-400/90 block font-mono">
                    Golden Ears • +140 XP
                  </span>
                </div>
              </div>

            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-800 text-center">
            <span className="text-[11px] text-slate-400 font-semibold">
              💡 Rê chuột vào từng huy hiệu để xem chi tiết & phần thưởng!
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};
