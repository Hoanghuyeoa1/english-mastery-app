import React, { useMemo } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Brain,
  ShieldAlert,
  Target,
  Mic,
  TrendingUp,
  Headphones,
  BookOpen,
  Sparkles,
  ArrowRight,
  Layers,
  Sparkle,
  Award,
} from 'lucide-react';
import { ActiveTab, ActivePracticeConfig, TodayLearningPlan, LearningPlanItem, LearningPlanTaskType } from '../types';
import { executeLearningPlanAction } from '../services/todayLearningPlanService';

interface TodayLearningPlanWidgetProps {
  plan: TodayLearningPlan;
  onNavigate: (tab: ActiveTab) => void;
  onStartAdaptivePractice?: (config: ActivePracticeConfig) => void;
  setActiveFourSkill?: (skill: 'listening' | 'reading' | 'speaking' | 'writing') => void;
  userName?: string;
  isHydrated?: boolean;
  className?: string;
}

const getTaskIcon = (type: LearningPlanTaskType) => {
  switch (type) {
    case 'srs_overdue':
      return <AlertTriangle className="w-4 h-4 text-rose-400" aria-hidden="true" />;
    case 'srs_relearning':
      return <RefreshCw className="w-4 h-4 text-amber-400" aria-hidden="true" />;
    case 'srs_due':
      return <Brain className="w-4 h-4 text-emerald-400" aria-hidden="true" />;
    case 'leech_recovery':
      return <ShieldAlert className="w-4 h-4 text-rose-400" aria-hidden="true" />;
    case 'mistake_practice':
      return <Target className="w-4 h-4 text-amber-400" aria-hidden="true" />;
    case 'pronunciation_practice':
      return <Mic className="w-4 h-4 text-purple-400" aria-hidden="true" />;
    case 'weak_skill_practice':
      return <TrendingUp className="w-4 h-4 text-cyan-400" aria-hidden="true" />;
    case 'curriculum_lesson':
      return <Headphones className="w-4 h-4 text-indigo-400" aria-hidden="true" />;
    case 'daily_new_words':
      return <Sparkles className="w-4 h-4 text-yellow-400" aria-hidden="true" />;
    case 'checkpoint_reinforcement':
      return <Target className="w-4 h-4 text-rose-400" aria-hidden="true" />;
    case 'checkpoint_readiness':
      return <Award className="w-4 h-4 text-emerald-400" aria-hidden="true" />;
    default:
      return <BookOpen className="w-4 h-4 text-slate-400" aria-hidden="true" />;
  }
};

const getTierBadge = (tier: LearningPlanItem['tier']) => {
  switch (tier) {
    case 'essential':
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-300 border border-rose-500/30">
          Ưu tiên cao
        </span>
      );
    case 'recommended':
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
          Khuyến nghị
        </span>
      );
    case 'optional':
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
          Mở rộng
        </span>
      );
  }
};

const getLocalGreeting = (name?: string): string => {
  const hour = new Date().getHours();
  let greeting = 'Chào buổi sáng';
  if (hour >= 12 && hour < 18) {
    greeting = 'Chào buổi chiều';
  } else if (hour >= 18 || hour < 5) {
    greeting = 'Chào buổi tối';
  }
  return name ? `${greeting}, ${name}` : greeting;
};

export const TodayLearningPlanWidget: React.FC<TodayLearningPlanWidgetProps> = ({
  plan,
  onNavigate,
  onStartAdaptivePractice,
  setActiveFourSkill,
  userName,
  isHydrated = true,
  className = '',
}) => {
  const formattedDate = useMemo(() => {
    try {
      const parts = plan.date.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString('vi-VN', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });
      }
      return plan.date;
    } catch {
      return plan.date;
    }
  }, [plan.date]);

  const remainingEstimatedMinutes = useMemo(() => {
    return plan.items
      .filter((it) => !it.completed)
      .reduce((sum, it) => sum + (it.estimatedMinutes || 0), 0);
  }, [plan.items]);

  const allCompleted = plan.totalTasks > 0 && plan.completedTasks >= plan.totalTasks;

  const handleAction = (item: LearningPlanItem) => {
    executeLearningPlanAction(item.action, {
      navigateToTab: onNavigate,
      startAdaptivePractice: onStartAdaptivePractice
        ? (cfg) =>
            onStartAdaptivePractice({
              module: cfg.module,
              itemIds: cfg.itemIds,
              mistakeType: cfg.mistakeType,
              startedAt: Date.now(),
              planItemId: item.id,
              planTitle: item.title,
              planObjective: item.description || item.reason,
              estimatedMinutes: item.estimatedMinutes,
            })
        : undefined,
      setActiveFourSkill: setActiveFourSkill,
    });
  };

  // 1. Hydration Guard: render subtle skeleton to prevent flash of 0 -> N due
  if (!isHydrated) {
    return (
      <section
        data-testid="today-hub-skeleton"
        aria-busy="true"
        aria-label="Đang nạp kế hoạch học tập..."
        className={`relative overflow-hidden rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-8 space-y-6 animate-pulse ${className}`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-2">
            <div className="h-4 w-32 bg-slate-800 rounded-full" />
            <div className="h-7 w-56 bg-slate-800 rounded-xl" />
          </div>
          <div className="w-full md:w-64 space-y-2">
            <div className="h-4 w-24 bg-slate-800 rounded ml-auto" />
            <div className="h-2.5 w-full bg-slate-800 rounded-full" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-28 bg-slate-800/60 rounded-2xl border border-slate-800" />
          <div className="h-20 bg-slate-800/40 rounded-2xl border border-slate-800" />
        </div>
      </section>
    );
  }

  const primaryItem = plan.items[0];
  const secondaryItems = plan.items.slice(1, 4);

  return (
    <section
      aria-labelledby="today-learning-plan-heading"
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 ${className}`}
    >
      {/* Background Glow Accents */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header: Title, Date, Estimate, Greeting & Progress */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <Sparkle className="w-3 h-3 fill-current animate-pulse" />
              <span>Kế Hoạch Hôm Nay</span>
            </span>
            <span className="text-xs text-slate-400 font-medium">
              • {getLocalGreeting(userName)}
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1 ml-auto sm:ml-0">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span className="capitalize">{formattedDate}</span>
            </span>
          </div>

          <h2
            id="today-learning-plan-heading"
            className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2"
          >
            <span>Trọng Tâm Học Tập Ngày</span>
            {plan.totalEstimatedMinutes > 0 && (
              <span className="text-xs sm:text-sm font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-xl border border-amber-500/20 inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>~{plan.totalEstimatedMinutes} phút</span>
              </span>
            )}
          </h2>
          {plan.stateMessage && (
            <p className="text-xs text-slate-400 font-medium">{plan.stateMessage}</p>
          )}
        </div>

        {/* Progress Display */}
        <div className="w-full md:w-64 space-y-2 shrink-0">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-300">
              <span className="text-emerald-400 font-mono text-sm">{plan.completedTasks}</span> /{' '}
              <span className="font-mono text-sm">{plan.totalTasks}</span> hoàn thành
            </span>
            <span className="text-slate-400 font-mono">
              {remainingEstimatedMinutes > 0 ? `Còn ~${remainingEstimatedMinutes}p` : `${plan.progress}%`}
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={plan.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Tiến độ học tập hôm nay"
            className="w-full bg-slate-950 border border-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 shadow-inner"
          >
            <div
              className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 h-full rounded-full transition-all duration-500 motion-reduce:transition-none shadow-sm shadow-emerald-500/40"
              style={{ width: `${Math.min(100, Math.max(0, plan.progress))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Heavy Day Notification (Session Chunking UX) */}
      {plan.isHeavyDay && plan.sessionChunkCount && (
        <div
          role="status"
          className="relative z-10 bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3.5"
        >
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
            <Layers className="w-4 h-4" />
          </div>
          <div className="text-xs space-y-1">
            <div className="font-black text-amber-300 flex items-center gap-2 flex-wrap">
              <span>Khối lượng ôn tập hôm nay lớn ({plan.totalDueCount} thẻ đến hạn)</span>
              <span className="px-2 py-0.5 bg-amber-400 text-slate-950 font-black rounded-full text-[10px] uppercase">
                Chia nhỏ phiên
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Hệ thống đã tự động chia nhỏ thành phiên ưu tiên{' '}
              <strong className="text-amber-200">{plan.sessionChunkCount} thẻ</strong> (~
              {Math.max(1, Math.round((plan.sessionChunkCount * 20) / 60))} phút). Còn{' '}
              <strong className="text-slate-200">{plan.remainingDueCount} thẻ</strong> trong hàng đợi để bạn ôn dãn
              cách khoa học, bảo toàn trí nhớ mà không bị áp lực.
            </p>
          </div>
        </div>
      )}

      {/* All Tasks Completed Banner */}
      {allCompleted ? (
        <div
          data-testid="today-hub-completed"
          className="relative z-10 bg-gradient-to-r from-emerald-950/30 via-slate-900 to-teal-950/30 border border-emerald-500/40 rounded-2xl p-6 text-center space-y-4 animate-fadeIn"
        >
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 mb-1">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base sm:text-lg font-black text-white">
            Bạn đã hoàn thành các mục quan trọng hôm nay 🎉
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
            Tuyệt vời! Bạn đã hoàn thành toàn bộ nhiệm vụ cốt lõi hôm nay. Bạn có thể nghỉ ngơi để não bộ củng cố trí
            nhớ dài hạn hoặc khám phá các chủ đề nâng cao trong thư viện 4 Kỹ Năng.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('four_skills')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-200 font-bold rounded-xl text-xs transition-all border border-slate-700 flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-slate-400 motion-reduce:transform-none motion-reduce:transition-none cursor-pointer"
            >
              <Headphones className="w-3.5 h-3.5 text-cyan-400" />
              <span>Luyện 4 Kỹ Năng mở rộng</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('flashcards')}
              className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 active:scale-[0.98] text-emerald-300 font-bold rounded-xl text-xs transition-all border border-emerald-500/30 flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-emerald-400 motion-reduce:transform-none motion-reduce:transition-none cursor-pointer"
            >
              <Brain className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ôn tập tự do Flashcard</span>
            </button>
          </div>
        </div>
      ) : plan.items.length === 0 ? (
        /* Empty State (New User / Fresh Day with 0 Tasks) */
        <div
          data-testid="today-hub-empty"
          className="relative z-10 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 text-center space-y-3 animate-fadeIn"
        >
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-500/15 text-cyan-400 mb-1">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base sm:text-lg font-black text-white">Chào mừng bạn đến với ngày học mới!</h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Chưa có thẻ đến hạn hay bẫy lỗi cần xử lý. Hãy bắt đầu học từ mới hoặc trải nghiệm các bài học chuẩn CEFR
            để khởi động chu kỳ ghi nhớ!
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('flashcards')}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-bold rounded-xl text-xs shadow-md transition-all focus-visible:ring-2 focus-visible:ring-emerald-400 motion-reduce:transform-none motion-reduce:transition-none cursor-pointer"
            >
              Học từ mới ngay
            </button>
            <button
              type="button"
              onClick={() => onNavigate('four_skills')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-200 font-bold rounded-xl text-xs transition-all focus-visible:ring-2 focus-visible:ring-slate-400 motion-reduce:transform-none motion-reduce:transition-none cursor-pointer"
            >
              Khám phá 4 Kỹ Năng
            </button>
          </div>
        </div>
      ) : (
        /* List of Action Cards: Primary (larger) + Secondary (compact), max 4 cards */
        <div className="relative z-10 space-y-3">
          {/* Primary Action Card (Item 0) */}
          {primaryItem && (
            <article
              key={primaryItem.id}
              data-testid="primary-action-card"
              className={`group relative rounded-2xl border transition-all duration-300 motion-reduce:transition-none p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                primaryItem.completed
                  ? 'bg-slate-950/40 border-slate-800/60 opacity-80'
                  : 'bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30 border-emerald-500/40 hover:border-emerald-500/60 shadow-lg shadow-emerald-500/5 hover:translate-y-[-1px] motion-reduce:transform-none'
              }`}
            >
              {/* Left details */}
              <div className="flex items-start gap-4 min-w-0">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 border shadow-sm ${
                    primaryItem.completed
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  }`}
                >
                  {primaryItem.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    getTaskIcon(primaryItem.type)
                  )}
                </div>

                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      ⭐ Trọng tâm #1
                    </span>
                    <h3
                      className={`text-base font-black tracking-tight truncate ${
                        primaryItem.completed
                          ? 'text-slate-400 line-through decoration-slate-600'
                          : 'text-white'
                      }`}
                    >
                      {primaryItem.title}
                    </h3>
                    {getTierBadge(primaryItem.tier)}
                    {primaryItem.estimatedMinutes ? (
                      <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{primaryItem.timeBucket || `~${primaryItem.estimatedMinutes}p`}</span>
                      </span>
                    ) : null}
                  </div>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{primaryItem.description}</p>

                  {primaryItem.reason && (
                    <p className="text-xs text-amber-300/90 font-medium">
                      💡 {primaryItem.reason}
                    </p>
                  )}
                </div>
              </div>

              {/* Right CTA */}
              <div className="self-end sm:self-auto shrink-0 flex items-center gap-2">
                {primaryItem.completed ? (
                  <button
                    type="button"
                    onClick={() => handleAction(primaryItem)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-850 active:scale-[0.98] text-slate-400 hover:text-slate-200 border border-slate-800 transition-all motion-reduce:transform-none motion-reduce:transition-none flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-emerald-500/50 outline-none cursor-pointer"
                    aria-label={`Xem lại nhiệm vụ ${primaryItem.title}`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Xem lại</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAction(primaryItem)}
                    className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 transition-all shadow-lg shadow-emerald-500/25 hover:scale-[1.02] active:scale-[0.98] motion-reduce:transform-none flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-emerald-400 outline-none cursor-pointer"
                    aria-label={`Bắt đầu nhiệm vụ ${primaryItem.title}`}
                  >
                    <span>Bắt đầu</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </article>
          )}

          {/* Secondary Action Cards (Items 1..3, max 3 secondary cards) */}
          {secondaryItems.map((item) => {
            const isCompleted = item.completed;
            return (
              <article
                key={item.id}
                data-testid="secondary-action-card"
                className={`group relative rounded-2xl border transition-all duration-200 motion-reduce:transition-none p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 ${
                  isCompleted
                    ? 'bg-slate-950/40 border-slate-800/60 opacity-80'
                    : 'bg-slate-950/80 hover:bg-slate-900/90 border-slate-800 hover:border-slate-700 shadow-md hover:translate-y-[-1px] motion-reduce:transform-none'
                }`}
              >
                {/* Left: Icon, Details, Reason */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                      isCompleted
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-slate-900 border-slate-800 text-slate-300 group-hover:border-slate-700'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : getTaskIcon(item.type)}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className={`text-sm font-extrabold tracking-tight truncate ${
                          isCompleted ? 'text-slate-400 line-through decoration-slate-600' : 'text-white'
                        }`}
                      >
                        {item.title}
                      </h3>
                      {getTierBadge(item.tier)}
                      {item.estimatedMinutes ? (
                        <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{item.timeBucket || `~${item.estimatedMinutes}p`}</span>
                        </span>
                      ) : null}
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-1 leading-relaxed">{item.description}</p>

                    {item.reason && (
                      <p className="text-[11px] text-slate-400 italic line-clamp-1">
                        💡 {item.reason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: CTA Button */}
                <div className="self-end sm:self-auto shrink-0 flex items-center gap-2">
                  {isCompleted ? (
                    <button
                      type="button"
                      onClick={() => handleAction(item)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-850 active:scale-[0.98] text-slate-400 hover:text-slate-200 border border-slate-800 transition-all motion-reduce:transform-none motion-reduce:transition-none flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-emerald-500/50 outline-none cursor-pointer"
                      aria-label={`Xem lại nhiệm vụ ${item.title}`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Xem lại</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAction(item)}
                      className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 transition-all shadow-md shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] motion-reduce:transform-none flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-emerald-400 outline-none cursor-pointer"
                      aria-label={`Bắt đầu nhiệm vụ ${item.title}`}
                    >
                      <span>Bắt đầu</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
