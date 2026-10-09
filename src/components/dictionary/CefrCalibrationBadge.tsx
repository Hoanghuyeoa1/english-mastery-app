import React from 'react';
import { Award, User, Sparkles, ShieldCheck, Flame, HelpCircle } from 'lucide-react';
import { CEFRLevel } from '../../types';

export interface CefrCalibrationBadgeProps {
  wordLevel?: string;
  learnerLevel: CEFRLevel | null;
  comparisonLabel?: string;
  difficultyComparison: 'below' | 'at_level' | 'above' | 'unknown';
}

export const CefrCalibrationBadge: React.FC<CefrCalibrationBadgeProps> = ({
  wordLevel,
  learnerLevel,
  comparisonLabel,
  difficultyComparison,
}) => {
  const getComparisonVisuals = () => {
    switch (difficultyComparison) {
      case 'at_level':
        return {
          icon: <Sparkles className="w-3.5 h-3.5 text-emerald-400" />,
          bgColor: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
        };
      case 'below':
        return {
          icon: <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />,
          bgColor: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300',
        };
      case 'above':
        return {
          icon: <Flame className="w-3.5 h-3.5 text-amber-400" />,
          bgColor: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
        };
      case 'unknown':
      default:
        return {
          icon: <HelpCircle className="w-3.5 h-3.5 text-slate-400" />,
          bgColor: 'bg-slate-800/60 border-slate-700/60 text-slate-400',
        };
    }
  };

  const visuals = getComparisonVisuals();

  return (
    <div
      data-testid="cefr-calibration-badge"
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl"
    >
      <div className="flex items-center gap-3 flex-wrap">
        {/* Word Level Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-500/15 border border-violet-500/30 text-violet-300 rounded-xl text-xs font-semibold">
          <Award className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <span>Cấp độ từ:</span>
          <strong className="text-violet-200 font-bold uppercase">{wordLevel || 'N/A'}</strong>
        </div>

        {/* Learner Observed Level Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold">
          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Trình độ của bạn:</span>
          <strong className="text-white font-bold uppercase">
            {learnerLevel ? learnerLevel : 'Chưa đánh giá'}
          </strong>
        </div>
      </div>

      {/* Comparison Indicator */}
      <div
        className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-medium self-start sm:self-auto ${visuals.bgColor}`}
      >
        {visuals.icon}
        <span>{comparisonLabel || 'Chưa hiệu chuẩn'}</span>
      </div>
    </div>
  );
};
