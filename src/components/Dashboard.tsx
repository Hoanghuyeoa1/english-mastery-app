import React from 'react';
import { 
  Flame, 
  Sparkles, 
  Brain, 
  Target, 
  Mic, 
  Zap, 
  ArrowRight, 
  BookOpenCheck,
  RefreshCw,
  Bot,
  Award
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { isDueForReview } from '../services/srsAlgorithm';
import { ActiveTab } from '../types';
import { ActivityHeatmap } from './ActivityHeatmap';

interface DashboardProps {
  onNavigate: (tab: ActiveTab) => void;
  onOpenAddWord: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { profile, vocabularyList, dailyHistory } = useAppStore();

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

  const dailyNewLimit = (profile.targetDailyNewWords || 15) + (profile.extraNewWordsBonus || 0);
  const newWordsLearned = todayProgress.newWordsLearned || 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 border border-slate-800/80 p-6 sm:p-10 shadow-2xl">
        {/* Glow background accent */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Hệ thống Spaced Repetition SM-2 & AI Tutor</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Chào mừng, <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">{profile.name}</span>!
            </h1>

            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              Bạn đang ở <strong className="text-emerald-400 font-semibold">Cấp {profile.level}</strong> với chuỗi <strong className="text-orange-400 font-semibold">{profile.streak} ngày</strong> học tập bền bỉ. Hôm nay có <strong className="text-white font-bold">{dueWords.length} từ vựng</strong> cần ôn tập và mục tiêu <strong className="text-cyan-400 font-bold">{dailyNewLimit} từ mới</strong>.
            </p>
          </div>

          {/* Quick Start Action Box */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full lg:w-auto shrink-0">
            <button
              onClick={() => onNavigate('flashcards')}
              className="flex items-center justify-center gap-3 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold rounded-2xl shadow-xl shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-sm sm:text-base"
            >
              <Brain className="w-5 h-5" />
              <span>Học & Ôn Tập Flashcard</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => onNavigate('toeic')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-bold rounded-2xl transition-all text-xs"
              >
                <Award className="w-4 h-4 text-amber-400" />
                <span>Thi Thử TOEIC</span>
              </button>

              <button
                onClick={() => onNavigate('tutor')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-700 font-bold rounded-2xl transition-all text-xs"
              >
                <Bot className="w-4 h-4 text-cyan-400" />
                <span>Hội Thoại AI</span>
              </button>
            </div>
          </div>
        </div>

        {/* Daily Learning & Review Queue Tracker */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Due Review */}
          <div className="flex items-center gap-3 bg-slate-950/40 border border-slate-800/60 p-3.5 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Cần ôn hôm nay</div>
              <div className="text-base font-bold text-white">
                <span className="text-emerald-400">{dueWords.length}</span> từ <span className="text-xs text-slate-500 font-normal">(Đã ôn: {todayProgress.wordsReviewed})</span>
              </div>
            </div>
          </div>

          {/* Card 2: Daily New Words */}
          <div className="flex items-center gap-3 bg-slate-950/40 border border-slate-800/60 p-3.5 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Từ mới hôm nay</div>
              <div className="text-base font-bold text-white">
                <span className="text-cyan-400">{newWordsLearned}</span> <span className="text-xs text-slate-500">/ {dailyNewLimit} mục tiêu</span>
              </div>
            </div>
          </div>

          {/* Card 3: XP Gained */}
          <div className="flex items-center gap-3 bg-slate-950/40 border border-slate-800/60 p-3.5 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20 shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400">XP kiếm được hôm nay</div>
              <div className="text-base font-bold text-amber-300">+{todayProgress.xpGained} XP</div>
            </div>
          </div>

          {/* Card 4: Streak */}
          <div className="flex items-center gap-3 bg-slate-950/40 border border-slate-800/60 p-3.5 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 border border-orange-500/20 shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Trạng thái Streak</div>
              <div className="text-base font-bold text-orange-400">{profile.streak} ngày liên tục 🔥</div>
            </div>
          </div>

        </div>
      </div>

      {/* Activity Heatmap 60 Days */}
      <ActivityHeatmap />

      {/* Grid Features: SRS Breakdown & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SRS Status Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-emerald-400" />
              <span>Phân Bổ Trí Nhớ SRS</span>
            </h2>
            <span className="text-xs text-slate-400">{vocabularyList.length} tổng số từ</span>
          </div>

          <div className="space-y-4">
            {/* Mastered */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-emerald-400">Đã thành thạo (SRS ≥ 3)</span>
                <span className="text-white">{masteredWords.length} từ ({Math.round((masteredWords.length / Math.max(1, vocabularyList.length)) * 100)}%)</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-700"
                  style={{ width: `${(masteredWords.length / Math.max(1, vocabularyList.length)) * 100}%` }}
                />
              </div>
            </div>

            {/* In Progress */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-amber-400">Đang củng cố (SRS 1-2)</span>
                <span className="text-white">{learningWords.length} từ</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-700"
                  style={{ width: `${(learningWords.length / Math.max(1, vocabularyList.length)) * 100}%` }}
                />
              </div>
            </div>

            {/* New */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-cyan-400">Từ mới chưa học</span>
                <span className="text-white">{newWords.length} từ</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-cyan-500 h-full rounded-full transition-all duration-700"
                  style={{ width: `${(newWords.length / Math.max(1, vocabularyList.length)) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
            <span>Đến hạn hôm nay: <strong className="text-emerald-400 font-bold">{dueWords.length} từ</strong></span>
            <button
              onClick={() => onNavigate('flashcards')}
              className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
            >
              <span>Vào ôn ngay</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Interactive Modes Quick Links */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Card 1: SRS Flashcard */}
          <div 
            onClick={() => onNavigate('flashcards')}
            className="group cursor-pointer bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between shadow-xl"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all">
                <Brain className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                Hàng Đợi Học & Ôn Tập SRS
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Tách biệt 2 hàng đợi: <strong>Cần Ôn Tập</strong> và <strong>Học Từ Mới</strong> hàng ngày theo thuật toán SuperMemo SM-2.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-emerald-400">
              <span>Bắt đầu phiên học</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 2: Interactive Quiz */}
          <div 
            onClick={() => onNavigate('quiz')}
            className="group cursor-pointer bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between shadow-xl"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all">
                <Target className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                Đấu Trường Trắc Nghiệm & Ghép Thẻ
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Thử thách kiến thức qua bài tập trắc nghiệm 4 đáp án, điền từ vào câu và thử thách ghép thẻ 60 giây.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-amber-400">
              <span>Vào làm bài kiểm tra</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 3: Speech Pronunciation */}
          <div 
            onClick={() => onNavigate('pronunciation')}
            className="group cursor-pointer bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-teal-500/40 rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between shadow-xl"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-teal-500 group-hover:text-slate-950 transition-all">
                <Mic className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-teal-400 transition-colors">
                Luyện Phát Âm & Shadowing AI
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Đọc to từ vựng qua Mic AI, kỹ thuật Shadowing nhại theo câu mẫu bản xứ và chép chính tả Dictation.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-teal-400">
              <span>Bật Mic luyện nói</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 4: AI Tutor Roleplay */}
          <div 
            onClick={() => onNavigate('tutor')}
            className="group cursor-pointer bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/40 rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between shadow-xl"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-all">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">
                Luyện Hội Thoại AI (Tutor Roleplay)
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Nhập vai tình huống thực tế (Phỏng vấn Tech, Giao tiếp công sở, IELTS), AI phân tích sửa lỗi ngữ pháp từng câu.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-cyan-400">
              <span>Bắt đầu trò chuyện</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

        </div>

      </div>

      {/* Motivational Quote */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800/80 rounded-2xl p-6 text-center shadow-lg">
        <p className="text-sm sm:text-base italic text-slate-300 font-serif">
          "Success is the sum of small efforts, repeated day in and day out."
        </p>
        <p className="text-xs text-emerald-400 font-semibold mt-1">
          — Robert Collier • Spaced Repetition cùng {profile.name || 'Học viên'}
        </p>
      </div>

    </div>
  );
};
