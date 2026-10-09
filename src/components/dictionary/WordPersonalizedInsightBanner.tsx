import React, { useMemo } from 'react';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Brain,
  ShieldCheck,
} from 'lucide-react';
import {
  deriveWordPersonalizedInsight,
  WordPersonalizedInsight,
} from '../../services/personalizedInsightService';
import type { LearningDictionaryProfile } from '../../types';

export interface WordPersonalizedInsightBannerProps {
  profile?: LearningDictionaryProfile | null;
  onPracticeMistake?: (word: string) => void;
  onPracticeCollocation?: (phrase?: string) => void;
  onReviewNow?: () => void;
}

export const WordPersonalizedInsightBanner: React.FC<WordPersonalizedInsightBannerProps> = ({
  profile,
  onPracticeMistake,
  onPracticeCollocation,
  onReviewNow,
}) => {
  // Pure single-word derivation — NEVER scans static dictionary entries
  const insight: WordPersonalizedInsight | null = useMemo(() => {
    return deriveWordPersonalizedInsight(profile);
  }, [profile]);

  if (!insight) {
    return null;
  }

  const isCritical = insight.severity === 'critical';
  const isWarning = insight.severity === 'warning';
  const isSuccess = insight.severity === 'success';

  const containerClasses = isCritical
    ? 'border-rose-500/40 bg-gradient-to-r from-rose-950/30 via-slate-900/90 to-slate-900/90 text-rose-200'
    : isWarning
    ? 'border-amber-500/40 bg-gradient-to-r from-amber-950/25 via-slate-900/90 to-slate-900/90 text-amber-200'
    : isSuccess
    ? 'border-emerald-500/40 bg-gradient-to-r from-emerald-950/30 via-slate-900/90 to-slate-900/90 text-emerald-200'
    : 'border-cyan-500/30 bg-gradient-to-r from-cyan-950/25 via-slate-900/90 to-slate-900/90 text-cyan-200';

  const handleAction = () => {
    const act = insight.suggestedAction;
    if (!act) return;

    if (act.type === 'mistake' && act.targetWord && onPracticeMistake) {
      onPracticeMistake(act.targetWord);
    } else if (act.type === 'collocation' && onPracticeCollocation) {
      onPracticeCollocation(act.targetPhrase);
    } else if (act.type === 'review' && onReviewNow) {
      onReviewNow();
    }
  };

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl border shadow-lg transition-all ${containerClasses}`}
      data-testid="word-personalized-insight-banner"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Header and Title */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-2 rounded-xl bg-slate-950/60 border border-slate-800 shrink-0">
            {isCritical && <AlertCircle className="w-4 h-4 text-rose-400" />}
            {isWarning && <AlertTriangle className="w-4 h-4 text-amber-400" />}
            {isSuccess && <ShieldCheck className="w-4 h-4 text-emerald-400" />}
            {!isCritical && !isWarning && !isSuccess && <Brain className="w-4 h-4 text-cyan-400" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Nhận định học tập cá nhân
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-950/80 border border-slate-800 text-white">
                <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                <span>Từ vựng của bạn</span>
              </span>
            </div>
            <h4 className="text-sm sm:text-base font-black text-white mt-0.5">
              {insight.headline}
            </h4>
          </div>
        </div>

        {/* Suggested Action CTA */}
        {insight.suggestedAction && (
          <button
            type="button"
            onClick={handleAction}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-950/90 hover:bg-slate-800 border border-slate-750 text-white shadow transition-all duration-200 cursor-pointer self-start sm:self-auto shrink-0 group"
            data-testid="btn-word-insight-action"
          >
            <span>{insight.suggestedAction.label}</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 group-hover:text-white transition-transform" />
          </button>
        )}
      </div>

      {/* Verified Evidence Bullets List */}
      <ul className="mt-3.5 space-y-1.5 pt-3 border-t border-slate-800/60">
        {insight.bullets.map((bullet, idx) => (
          <li key={idx} className="flex items-center gap-2 text-xs text-slate-200">
            {isSuccess ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            )}
            <span className="leading-snug">{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
