// src/components/session/SessionCompleteSummary.tsx
/**
 * Reusable Session Complete Summary Primitive (After UX)
 * 
 * Composable card / modal for session completion:
 * - Highlights celebratory award icon, title, subtitle.
 * - Displays primary metrics: XP earned, items completed, accuracy/retention rate, score.
 * - Supports custom slots: breakdownSlot, reviewSlot, and custom children.
 * - Integrates NextActionPanel for clear next learning steps.
 */

import React from 'react';
import { Award, Sparkles, Trophy, CheckCircle2 } from 'lucide-react';
import type { SessionActionDescriptor } from '../../types/sessionExperience';
import { NextActionPanel } from './NextActionPanel';

export interface SessionCompleteSummaryProps {
  title?: string;
  subtitle?: string;
  scoreText?: string;
  scoreSubtext?: string;
  xpEarned?: number;
  itemsCompletedCount?: number;
  itemsCompletedLabel?: string;
  accuracyRate?: number | null;
  accuracyLabel?: string;
  breakdownSlot?: React.ReactNode;
  reviewSlot?: React.ReactNode;
  children?: React.ReactNode;
  actions?: SessionActionDescriptor[];
  className?: string;
}

export const SessionCompleteSummary: React.FC<SessionCompleteSummaryProps> = React.memo(({
  title = 'Tuyệt Vời! Bạn Đã Hoàn Thành Phiên Học!',
  subtitle = 'Tổng kết kết quả ghi nhớ và mức độ thành thạo của phiên vừa xong.',
  scoreText,
  scoreSubtext,
  xpEarned,
  itemsCompletedCount,
  itemsCompletedLabel = 'Đã hoàn thành',
  accuracyRate,
  accuracyLabel = 'Tỷ lệ chính xác',
  breakdownSlot,
  reviewSlot,
  children,
  actions = [],
  className = '',
}) => {
  return (
    <div
      data-testid="session-complete-summary"
      role="region"
      aria-label="Tổng kết phiên học"
      className={`bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border-2 border-emerald-500/50 rounded-3xl p-5 sm:p-8 md:p-10 text-center shadow-2xl space-y-6 animate-fadeIn motion-reduce:animate-none ${className}`}
    >
      {/* Icon + Header */}
      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 text-slate-950 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
        <Award className="w-8 h-8 sm:w-10 sm:h-10 stroke-[2.5]" />
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-black uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Phiên học hoàn thành</span>
        </div>

        <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight break-words">
          {title}
        </h3>

        {subtitle && (
          <p className="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed break-words">
            {subtitle}
          </p>
        )}
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-3xl mx-auto py-2">
        {/* Items Completed */}
        {typeof itemsCompletedCount === 'number' && (
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
            <span className="text-[11px] text-slate-400 block font-medium">
              {itemsCompletedLabel}
            </span>
            <strong className="text-lg sm:text-xl font-black text-white">
              {itemsCompletedCount} mục
            </strong>
          </div>
        )}

        {/* Score Text */}
        {scoreText && (
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
            <span className="text-[11px] text-slate-400 block font-medium">
              {scoreSubtext || 'Điểm số'}
            </span>
            <strong className="text-lg sm:text-xl font-black text-emerald-400">
              {scoreText}
            </strong>
          </div>
        )}

        {/* Accuracy Rate / Retention */}
        {typeof accuracyRate === 'number' && Number.isFinite(accuracyRate) && (
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
            <span className="text-[11px] text-slate-400 block font-medium">
              {accuracyLabel}
            </span>
            <strong className="text-lg sm:text-xl font-black text-teal-300">
              {Math.round(accuracyRate)}%
            </strong>
          </div>
        )}

        {/* XP Earned */}
        {typeof xpEarned === 'number' && xpEarned > 0 && (
          <div className="p-3.5 bg-amber-950/30 border border-amber-500/30 rounded-2xl">
            <span className="text-[11px] text-amber-300 block font-medium">
              Kinh nghiệm nhận được
            </span>
            <strong className="text-lg sm:text-xl font-black text-amber-400 font-mono">
              +{xpEarned} XP
            </strong>
          </div>
        )}
      </div>

      {/* Optional Breakdown Slot (e.g. Again/Hard/Good/Easy or CEFR breakdown) */}
      {breakdownSlot && (
        <div data-testid="session-breakdown-slot" className="max-w-3xl mx-auto text-left">
          {breakdownSlot}
        </div>
      )}

      {/* Optional Review Slot (e.g. hardest cards list, mistake bank review) */}
      {reviewSlot && (
        <div data-testid="session-review-slot" className="max-w-3xl mx-auto text-left">
          {reviewSlot}
        </div>
      )}

      {/* Custom children extension */}
      {children && (
        <div data-testid="session-summary-custom-content" className="max-w-3xl mx-auto">
          {children}
        </div>
      )}

      {/* Next Actions */}
      {actions.length > 0 && (
        <div className="pt-4 border-t border-slate-800/80 max-w-xl mx-auto">
          <NextActionPanel actions={actions} />
        </div>
      )}
    </div>
  );
});

SessionCompleteSummary.displayName = 'SessionCompleteSummary';
