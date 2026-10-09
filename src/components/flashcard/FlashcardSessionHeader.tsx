import React from 'react';
import { Flame } from 'lucide-react';
import type { QueueMode } from '../../services/flashcardQueueService';

export interface SessionHeaderProps {
  currentIndex: number;
  totalWords: number;
  remainingCount: number;
  sessionStreak: number;
  queueMode: QueueMode;
  srsAlgorithm: 'sm2' | 'fsrs';
  retrievabilityInfo: any;
  tagLabel?: string;
}

export const SessionHeader: React.FC<SessionHeaderProps> = React.memo(({
  currentIndex,
  totalWords,
  remainingCount,
  sessionStreak,
  queueMode,
  srsAlgorithm,
  retrievabilityInfo,
  tagLabel,
}) => {
  const progressPercent = totalWords > 0 ? Math.min(100, Math.round(((currentIndex + 1) / totalWords) * 100)) : 0;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-2.5 shadow-sm min-h-[72px] tabular-nums select-none">
      <div className="flex items-center justify-between gap-2 text-xs">
        {/* Count: 12 / 30 */}
        <div className="flex items-center gap-2 font-bold">
          <span className="text-white text-sm sm:text-base tracking-tight">
            {currentIndex + 1} / {totalWords}
          </span>
          <span className="text-slate-400 font-medium text-[11px] sm:text-xs">
            ({remainingCount} remaining)
          </span>
        </div>

        {/* Status Pills / Streak */}
        <div className="flex items-center gap-2">
          {srsAlgorithm === 'fsrs' && retrievabilityInfo ? (
            <span
              className={`font-mono px-2 py-0.5 rounded-full border text-[11px] font-bold ${retrievabilityInfo.colorClass}`}
              title={retrievabilityInfo.label}
            >
              {retrievabilityInfo.label}
            </span>
          ) : tagLabel ? (
            <span className="text-slate-500 text-[11px] hidden sm:inline">
              {tagLabel}
            </span>
          ) : null}

          {/* Session Streak */}
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-black shadow-sm"
            title="Chuỗi nhớ đúng liên tiếp trong phiên học này (không thay thế app streak)"
          >
            <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>Streak {sessionStreak}</span>
          </div>
        </div>
      </div>

      {/* Animated Progress Bar */}
      <div className="w-full bg-slate-800 h-2 sm:h-2.5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            queueMode === 'DUE'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
              : 'bg-gradient-to-r from-teal-400 via-cyan-400 to-emerald-400'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
});

SessionHeader.displayName = 'SessionHeader';
