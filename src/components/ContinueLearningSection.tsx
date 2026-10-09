import React from 'react';
import {
  BookOpen,
  PenTool,
  Mic,
  Headphones,
  Award,
  Layers,
  Bot,
  Sparkles,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { ActiveTab, ResumableActivity } from '../types';
import { useAppStore } from '../store/useAppStore';
import { getRecentResumableActivities } from '../services/learningContinuityService';

interface ContinueLearningSectionProps {
  onNavigate: (tab: ActiveTab) => void;
  setActiveFourSkill?: (skill: 'listening' | 'reading' | 'speaking' | 'writing') => void;
  className?: string;
}

/**
 * Returns a human-friendly Vietnamese relative time string.
 */
export function formatRelativeTimeVi(timestampMs: number, now = Date.now()): string {
  const diffMs = Math.max(0, now - timestampMs);
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `Đã học ${diffMinutes} phút trước`;
  if (diffHours < 24) return `Đã học ${diffHours} giờ trước`;
  return `Đã học ${diffDays} ngày trước`;
}

/**
 * Derives a human-friendly progress label for each activity type.
 * Never fakes percentage completion for open-ended sessions.
 */
export function getProgressLabel(activity: ResumableActivity): string {
  const cp = activity.checkpoint;

  switch (activity.type) {
    case 'tutor': {
      const turnCount = (cp as any).turnCount || 0;
      return `${turnCount} lượt hội thoại`;
    }
    case 'flashcard': {
      const reviewed = (cp as any).reviewedCount || 0;
      const total = (cp as any).totalCards || 0;
      return total > 0 ? `${reviewed}/${total} thẻ đã học` : `${reviewed} thẻ đã học`;
    }
    case 'toeic': {
      const answered = (cp as any).answeredCount || 0;
      const total = (cp as any).totalQuestions || 0;
      return total > 0 ? `${answered}/${total} câu đã làm` : `${answered} câu đã làm`;
    }
    case 'reading':
    case 'listening':
    case 'speaking': {
      if (typeof cp.progressPercent === 'number' && cp.progressPercent > 0) {
        return `${cp.progressPercent}% hoàn thành`;
      }
      return 'Đang học dở';
    }
    case 'writing': {
      const wordCount = (cp as any).wordCount || 0;
      if (wordCount > 0) {
        return `${wordCount} từ đã soạn`;
      }
      return 'Bản thảo đang viết dở';
    }
    default:
      return 'Đang học dở';
  }
}

export const ContinueLearningSection: React.FC<ContinueLearningSectionProps> = ({
  onNavigate,
  setActiveFourSkill,
  className = '',
}) => {
  const { resumeActivities } = useAppStore();

  const recentActivities = React.useMemo(() => {
    return getRecentResumableActivities(resumeActivities, 3);
  }, [resumeActivities]);

  if (recentActivities.length === 0) {
    return null; // Strict Invariant: Never render an empty Continue Learning card!
  }

  const primaryActivity = recentActivities[0];
  const secondaryActivities = recentActivities.slice(1);

  const getActivityIcon = (type: ResumableActivity['type']) => {
    switch (type) {
      case 'reading':
        return <BookOpen className="w-5 h-5 text-emerald-400" aria-hidden="true" />;
      case 'writing':
        return <PenTool className="w-5 h-5 text-amber-400" aria-hidden="true" />;
      case 'speaking':
        return <Mic className="w-5 h-5 text-purple-400" aria-hidden="true" />;
      case 'listening':
        return <Headphones className="w-5 h-5 text-cyan-400" aria-hidden="true" />;
      case 'toeic':
        return <Award className="w-5 h-5 text-amber-300" aria-hidden="true" />;
      case 'flashcard':
        return <Layers className="w-5 h-5 text-teal-400" aria-hidden="true" />;
      case 'tutor':
        return <Bot className="w-5 h-5 text-indigo-400" aria-hidden="true" />;
      default:
        return <Sparkles className="w-5 h-5 text-slate-400" aria-hidden="true" />;
    }
  };

  const getModuleBadgeLabel = (type: ResumableActivity['type']) => {
    switch (type) {
      case 'reading':
        return 'Reading';
      case 'writing':
        return 'Writing';
      case 'speaking':
        return 'Speaking';
      case 'listening':
        return 'Listening';
      case 'toeic':
        return 'TOEIC Assessment';
      case 'flashcard':
        return 'Flashcards';
      case 'tutor':
        return 'AI Tutor';
      default:
        return 'Bài học';
    }
  };

  const handleResumeActivity = (act: ResumableActivity) => {
    if (
      act.type === 'reading' ||
      act.type === 'writing' ||
      act.type === 'speaking' ||
      act.type === 'listening'
    ) {
      setActiveFourSkill?.(act.type);
      onNavigate('four_skills');
    } else if (act.type === 'flashcard') {
      onNavigate('flashcards');
    } else if (act.type === 'toeic') {
      onNavigate('toeic');
    } else if (act.type === 'tutor') {
      onNavigate('tutor');
    }
  };

  return (
    <section
      data-testid="continue-learning-section"
      role="region"
      aria-label="Tiếp tục học"
      className={`space-y-3 animate-fadeIn ${className}`}
    >
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <h2 className="text-xs font-black uppercase tracking-wider text-emerald-400">
          TIẾP TỤC HỌC
        </h2>
      </div>

      {/* Primary Resumable Card */}
      <div
        data-testid="primary-continue-card"
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/40 hover:border-emerald-500/60 p-5 sm:p-6 shadow-xl shadow-emerald-500/5 transition-all duration-200 hover:translate-y-[-1px] motion-reduce:transform-none motion-reduce:transition-none"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
              {getActivityIcon(primaryActivity.type)}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {getModuleBadgeLabel(primaryActivity.type)}
                </span>
                <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>{formatRelativeTimeVi(primaryActivity.lastActiveAt)}</span>
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                {primaryActivity.title}
              </h3>

              {primaryActivity.subtitle && (
                <p className="text-xs sm:text-sm text-slate-300 font-medium truncate">
                  {primaryActivity.subtitle}
                </p>
              )}

              <p className="text-xs font-bold text-amber-300">
                {getProgressLabel(primaryActivity)}
              </p>
            </div>
          </div>

          <div className="self-end sm:self-auto shrink-0">
            <button
              type="button"
              data-testid="btn-continue-learning"
              onClick={() => handleResumeActivity(primaryActivity)}
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 transition-all shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] motion-reduce:transform-none flex items-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <span>Tiếp tục</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Resumable Cards (Max 2) */}
      {secondaryActivities.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {secondaryActivities.map((sec) => (
            <div
              key={sec.id}
              data-testid={`secondary-continue-card-${sec.id}`}
              className="rounded-2xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 p-3.5 sm:p-4 flex items-center justify-between gap-3 transition-all duration-200 hover:translate-y-[-1px] motion-reduce:transform-none motion-reduce:transition-none shadow-md"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                  {getActivityIcon(sec.type)}
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {getModuleBadgeLabel(sec.type)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      • {formatRelativeTimeVi(sec.lastActiveAt)}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white truncate">{sec.title}</h4>
                  <p className="text-[11px] text-slate-400 truncate">{getProgressLabel(sec)}</p>
                </div>
              </div>

              <button
                type="button"
                data-testid={`btn-continue-${sec.id}`}
                onClick={() => handleResumeActivity(sec)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-750 active:scale-[0.97] text-slate-200 hover:text-white border border-slate-700 transition-all motion-reduce:transform-none motion-reduce:transition-none flex items-center gap-1 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <span>Tiếp tục</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
