// src/components/session/SessionProgressHeader.tsx
/**
 * Reusable Session Progress Header Primitive (During UX)
 * 
 * Truthful, slot-based session progress header:
 * - Adapts cleanly to all 5 progress metric kinds (discrete, target words, timer, turns, unbounded).
 * - Never renders fake % progress when not applicable.
 * - Supports streak badge, custom right slot (FSRS pill, tags), and pause / exit actions.
 */

import React from 'react';
import { Flame, Pause, Play, X, Clock, Bot, Sparkles } from 'lucide-react';
import type { SessionProgressMetric } from '../../types/sessionExperience';
import { formatSessionTimeLeft } from '../../services/sessionExperienceAdapter';

export interface SessionProgressHeaderProps {
  title?: string;
  subtitle?: string;
  badgeLabel?: string;
  metric: SessionProgressMetric;
  streakCount?: number;
  rightSlot?: React.ReactNode;
  onPause?: () => void;
  onExit?: () => void;
  isPaused?: boolean;
  className?: string;
}

export const SessionProgressHeader: React.FC<SessionProgressHeaderProps> = React.memo(({
  title,
  subtitle,
  badgeLabel,
  metric,
  streakCount,
  rightSlot,
  onPause,
  onExit,
  isPaused = false,
  className = '',
}) => {
  return (
    <div
      data-testid="session-progress-header"
      className={`bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-2.5 shadow-sm min-h-[72px] tabular-nums select-none ${className}`}
    >
      {/* Top Row: Metric Counter + Status Badges + Actions */}
      <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
        
        {/* Metric Counter Representation */}
        <div className="flex items-center gap-2 font-bold min-w-0">
          {metric.kind === 'discrete_items' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-white text-sm sm:text-base tracking-tight font-black">
                {metric.totalItems > 0
                  ? metric.counterFormat === 'answered'
                    ? `${metric.answeredCount} / ${metric.totalItems}`
                    : `${metric.currentIndex + 1} / ${metric.totalItems}`
                  : '0 / 0'}
              </span>
              <span className="text-slate-400 font-medium text-[11px] sm:text-xs">
                ({metric.remainingCount} remaining)
              </span>
            </div>
          )}

          {metric.kind === 'target_words' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-white text-sm sm:text-base tracking-tight font-black">
                {metric.currentWordCount} / {metric.minWords} từ
              </span>
              {metric.targetRange && (
                <span className="text-slate-400 font-medium text-[11px] sm:text-xs">
                  (Khung: {metric.targetRange})
                </span>
              )}
            </div>
          )}

          {metric.kind === 'stage_pipeline' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {metric.stages.map((stage, idx) => {
                const isCurrent = stage.id === metric.currentStageId;
                const currentIdx = metric.stages.findIndex((s) => s.id === metric.currentStageId);
                const isDone = currentIdx > idx;
                return (
                  <React.Fragment key={stage.id}>
                    {idx > 0 && <span className="text-slate-600 text-[10px]">→</span>}
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors ${
                        isCurrent
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : isDone
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {stage.label}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {metric.kind === 'timed_countdown' && (
            <div className="flex items-center gap-2">
              <div
                role="timer"
                aria-label={`Thời gian còn lại: ${formatSessionTimeLeft(metric.timeLeftSeconds)}`}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-mono text-xs sm:text-sm font-black border ${
                  metric.timeLeftSeconds < 120
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 animate-pulse motion-reduce:animate-none'
                    : 'bg-slate-800 text-amber-300 border-amber-500/30'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{formatSessionTimeLeft(metric.timeLeftSeconds)}</span>
              </div>
              {metric.isPaused && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Tạm dừng
                </span>
              )}
            </div>
          )}

          {metric.kind === 'open_turns' && (
            <div className="flex items-center gap-1.5 text-indigo-300 font-bold">
              <Bot className="w-4 h-4 text-indigo-400" />
              <span>{metric.turnCount} lượt hội thoại</span>
            </div>
          )}

          {metric.kind === 'unbounded' && (
            <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>{metric.completedCount} đã hoàn thành</span>
            </div>
          )}

          {/* Optional inline badge */}
          {badgeLabel && (
            <span className="hidden md:inline px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
              {badgeLabel}
            </span>
          )}
        </div>

        {/* Right Area: Streak, Right Slot, Controls */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Custom rightSlot (e.g. FSRS retrievability, tag, audio speed) */}
          {rightSlot}

          {/* Session Streak Counter */}
          {typeof streakCount === 'number' && streakCount > 0 && (
            <div
              data-testid="session-streak-badge"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-black shadow-sm"
              title="Chuỗi phản hồi đúng liên tiếp trong phiên này"
            >
              <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>Streak {streakCount}</span>
            </div>
          )}

          {/* Optional Pause Button */}
          {onPause && (
            <button
              type="button"
              onClick={onPause}
              className="min-h-[36px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white border border-slate-700 transition-all motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              title={isPaused ? 'Tiếp tục bài làm' : 'Tạm dừng bài làm'}
              aria-label={isPaused ? 'Tiếp tục bài làm' : 'Tạm dừng bài làm'}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Optional Exit Button */}
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="min-h-[36px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center p-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 transition-all motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              title="Thoát phiên học"
              aria-label="Thoát phiên học"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Animated Progress Bar (only rendered if progressPercent is legitimately finite) */}
      {'progressPercent' in metric &&
        typeof metric.progressPercent === 'number' &&
        Number.isFinite(metric.progressPercent) && (() => {
          const clampedPercent = Math.min(100, Math.max(0, Math.round(metric.progressPercent)));
          return (
            <div
              role="progressbar"
              aria-valuenow={clampedPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuetext={`${clampedPercent}%`}
              aria-label="Tiến độ phiên học"
              className="w-full bg-slate-800 h-2 sm:h-2.5 rounded-full overflow-hidden"
            >
              <div
                className="h-full rounded-full transition-all duration-300 motion-reduce:transition-none bg-gradient-to-r from-emerald-500 to-teal-400"
                style={{ width: `${clampedPercent}%` }}
              />
            </div>
          );
        })()}
    </div>
  );
});

SessionProgressHeader.displayName = 'SessionProgressHeader';
