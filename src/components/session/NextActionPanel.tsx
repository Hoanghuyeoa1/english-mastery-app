// src/components/session/NextActionPanel.tsx
/**
 * Reusable Next Action Panel Primitive
 * 
 * Composable action button panel for session completion, resume, or navigation CTA:
 * - Clean visual hierarchy (primary, secondary, outline, danger, ghost).
 * - Accessible with proper type="button" and disabled states.
 * - Supports flex row, flex column, or responsive grid layouts.
 */

import React from 'react';
import { ArrowRight, RotateCcw, Check, Sparkles } from 'lucide-react';
import type { SessionActionDescriptor } from '../../types/sessionExperience';

export interface NextActionPanelProps {
  actions: SessionActionDescriptor[];
  layout?: 'row' | 'column' | 'grid';
  className?: string;
}

export const NextActionPanel: React.FC<NextActionPanelProps> = React.memo(({
  actions,
  layout = 'row',
  className = '',
}) => {
  if (!actions || actions.length === 0) return null;

  const layoutClasses =
    layout === 'column'
      ? 'flex flex-col gap-2.5 w-full'
      : layout === 'grid'
      ? 'grid grid-cols-1 sm:grid-cols-2 gap-3 w-full'
      : 'flex flex-wrap items-center justify-center gap-3 w-full';

  return (
    <div
      data-testid="next-action-panel"
      role="group"
      aria-label="Hành động tiếp theo"
      className={`${layoutClasses} ${className}`}
    >
      {actions.map((act) => {
        const isPrimary = act.isPrimary || act.variant === 'primary';

        let buttonClasses =
          'min-h-[44px] px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all motion-reduce:transition-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900';

        if (isPrimary) {
          buttonClasses +=
            ' bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black shadow-lg shadow-emerald-500/20';
        } else if (act.variant === 'outline') {
          buttonClasses +=
            ' bg-transparent border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10';
        } else if (act.variant === 'danger') {
          buttonClasses +=
            ' bg-rose-950/40 border border-rose-500/40 text-rose-300 hover:bg-rose-900/40 focus-visible:ring-rose-400';
        } else if (act.variant === 'ghost') {
          buttonClasses +=
            ' bg-transparent text-slate-400 hover:text-white hover:bg-slate-800/50';
        } else {
          // Default secondary
          buttonClasses +=
            ' bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700';
        }

        return (
          <button
            key={act.id}
            type="button"
            disabled={act.disabled}
            onClick={act.onClick}
            className={buttonClasses}
            data-testid={`next-action-${act.id}`}
            title={act.description || act.label}
            aria-label={act.description ? `${act.label}: ${act.description}` : act.label}
          >
            <span>{act.label}</span>
            {isPrimary ? (
              <ArrowRight className="w-4 h-4 shrink-0" />
            ) : act.id.includes('retry') || act.id.includes('restart') ? (
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
});

NextActionPanel.displayName = 'NextActionPanel';
