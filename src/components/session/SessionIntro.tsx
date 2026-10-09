// src/components/session/SessionIntro.tsx
/**
 * Reusable Session Intro Primitive (Before UX)
 * 
 * Composable banner / card for session preparation:
 * - Displays title, subtitle, objective, estimated duration bucket.
 * - Displays source context tag if routed from Today Learning Plan.
 * - Supports custom children for module-specific configurations (filters, batch size, mode).
 * - Slot for start / resume / cancel actions.
 */

import React from 'react';
import { Clock, Sparkles, Target, ArrowRight, Play } from 'lucide-react';
import type { SessionSourceContext } from '../../types/sessionExperience';

export interface SessionIntroProps {
  title: string;
  subtitle?: string;
  badgeLabel?: string;
  objective?: string;
  estimatedDuration?: string;
  sourceContext?: SessionSourceContext;
  icon?: React.ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  resumeBanner?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const SessionIntro: React.FC<SessionIntroProps> = React.memo(({
  title,
  subtitle,
  badgeLabel,
  objective,
  estimatedDuration,
  sourceContext,
  icon,
  primaryAction,
  secondaryAction,
  resumeBanner,
  children,
  className = '',
}) => {
  return (
    <div
      data-testid="session-intro"
      role="region"
      aria-label="Thông tin chuẩn bị phiên học"
      className={`bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8 space-y-6 shadow-xl ${className}`}
    >
      {/* Optional Resumable Banner at Top */}
      {resumeBanner && (
        <div data-testid="session-intro-resume-slot" className="pb-2">
          {resumeBanner}
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {icon ? (
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
              {icon}
            </div>
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
              <Sparkles className="w-6 h-6" />
            </div>
          )}

          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {badgeLabel && (
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {badgeLabel}
                </span>
              )}
              {estimatedDuration && (
                <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>{estimatedDuration}</span>
                </span>
              )}
              {sourceContext?.todayPlanTaskId && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Kế hoạch hôm nay
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight break-words">
              {title}
            </h2>

            {subtitle && (
              <p className="text-xs sm:text-sm text-slate-400 font-medium">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Objective statement */}
      {objective && (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex items-start gap-3">
          <Target className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {objective}
          </p>
        </div>
      )}

      {/* Module-specific slots (e.g. batch size selector, filters, topics) */}
      {children && (
        <div data-testid="session-intro-custom-content" className="pt-1">
          {children}
        </div>
      )}

      {/* Action CTA buttons */}
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-800/80">
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-xs sm:text-sm font-bold text-slate-300 hover:text-white transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              {secondaryAction.label}
            </button>
          )}

          {primaryAction && (
            <button
              type="button"
              data-testid="btn-start-session"
              aria-label={primaryAction.label}
              disabled={primaryAction.disabled || primaryAction.loading}
              onClick={primaryAction.onClick}
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all motion-reduce:transition-none flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              <span>{primaryAction.label}</span>
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>
          )}
        </div>
      )}
    </div>
  );
});

SessionIntro.displayName = 'SessionIntro';
