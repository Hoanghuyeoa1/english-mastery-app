import React, { useMemo } from 'react';
import { 
  Sparkles, 
  BookOpen, 
  Headphones, 
  PenTool, 
  Mic, 
  ArrowRight, 
  ShieldCheck, 
  AlertTriangle 
} from 'lucide-react';
import type { ActiveTab } from '../types';
import { useAppStore } from '../store/useAppStore';
import { 
  deriveFourSkillsSummary, 
  getFourSkillsCtaTarget 
} from '../services/fourSkillsLearningBridge';
import { 
  deriveSkillGapInsights, 
  SkillGapInsight 
} from '../services/personalizedInsightService';

export interface FourSkillsAdaptiveSummaryProps {
  onNavigate?: (tab: ActiveTab) => void;
  className?: string;
  compact?: boolean;
}

export const FourSkillsAdaptiveSummary: React.FC<FourSkillsAdaptiveSummaryProps> = ({
  onNavigate,
  className = '',
  compact = false,
}) => {
  const {
    userCustomWords,
    srsProgressMap,
    mistakeBank,
    userCollocations,
    vocabularyList,
    fourSkillsEvidence,
    fourSkillsScores,
    setActiveFourSkill,
  } = useAppStore();

  // Derived real-time summary directly from active store data (never cached or persisted)
  const summary = useMemo(() => {
    return deriveFourSkillsSummary({
      userCustomWords,
      srsProgressMap,
      mistakeBank,
      userCollocations,
      vocabularyList,
    });
  }, [userCustomWords, srsProgressMap, mistakeBank, userCollocations, vocabularyList]);

  const ctaTarget = useMemo(() => getFourSkillsCtaTarget(summary), [summary]);

  const skillInsight: SkillGapInsight | null = useMemo(() => {
    const raw = deriveSkillGapInsights(fourSkillsEvidence, fourSkillsScores);
    return raw.length > 0 ? raw[0] : null;
  }, [fourSkillsEvidence, fourSkillsScores]);

  const handlePracticeSkill = (skill: string) => {
    const valid = ['listening', 'reading', 'speaking', 'writing'] as const;
    if (valid.includes(skill as any) && setActiveFourSkill) {
      setActiveFourSkill(skill as any);
    }
    if (onNavigate) {
      onNavigate('four_skills');
    }
  };

  const handleReviewWeakItems = () => {
    if (ctaTarget.tab && onNavigate) {
      onNavigate(ctaTarget.tab);
    }
  };

  return (
    <div
      className={`bg-slate-900/80 dark:bg-slate-900/90 border border-slate-800 rounded-3xl ${compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6'} shadow-xl backdrop-blur-md relative overflow-hidden transition-all ${className}`}
      data-testid="four-skills-adaptive-summary"
    >
      {/* Background ambient lighting */}
      <div className="absolute -top-10 -right-10 w-44 h-44 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 relative z-10">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 uppercase tracking-wider mb-1">
            <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>Learning from Four Skills</span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
            Tổng Hợp Tiến Độ 4 Kỹ Năng
          </h2>
        </div>

        {/* Status Pill */}
        {summary.totalWeakItems > 0 ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{summary.totalWeakItems} điểm cần củng cố</span>
          </span>
        ) : summary.hasLearningData ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Đã cập nhật đầy đủ</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800/60 border border-slate-700/60 text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Chưa có dữ liệu học tập</span>
          </span>
        )}
      </div>

      {/* 4 Skill Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 relative z-10 mb-5">
        {/* 1. READING */}
        <div
          className="p-3.5 sm:p-4 rounded-2xl border bg-slate-950/60 border-slate-800/80 hover:border-emerald-500/40 transition-all flex flex-col justify-between"
          data-testid="summary-reading"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reading</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              {summary.readingWordsSaved}
            </div>
            <div className="text-xs font-semibold text-emerald-400 mt-0.5">
              words saved
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Từ vựng đã lưu
            </div>
          </div>
        </div>

        {/* 2. LISTENING */}
        <div
          className="p-3.5 sm:p-4 rounded-2xl border bg-slate-950/60 border-slate-800/80 hover:border-cyan-500/40 transition-all flex flex-col justify-between"
          data-testid="summary-listening"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Listening</span>
            <div className="w-7 h-7 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
              <Headphones className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              {summary.listeningUnresolvedMistakes}
            </div>
            <div className="text-xs font-semibold text-cyan-400 mt-0.5">
              unresolved mistakes
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Lỗi nghe cần ôn
            </div>
          </div>
        </div>

        {/* 3. WRITING */}
        <div
          className="p-3.5 sm:p-4 rounded-2xl border bg-slate-950/60 border-slate-800/80 hover:border-indigo-500/40 transition-all flex flex-col justify-between"
          data-testid="summary-writing"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Writing</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
              <PenTool className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              {summary.writingCollocationsToReview}
            </div>
            <div className="text-xs font-semibold text-indigo-400 mt-0.5">
              collocations to review
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Cụm từ đến hạn ôn
            </div>
          </div>
        </div>

        {/* 4. SPEAKING */}
        <div
          className="p-3.5 sm:p-4 rounded-2xl border bg-slate-950/60 border-slate-800/80 hover:border-rose-500/40 transition-all flex flex-col justify-between"
          data-testid="summary-speaking"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Speaking</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center">
              <Mic className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              {summary.speakingPronunciationItems}
            </div>
            <div className="text-xs font-semibold text-rose-400 mt-0.5">
              pronunciation items
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Từ cần sửa phát âm
            </div>
          </div>
        </div>
      </div>

      {/* Personalized Skill Gap / Balanced Data Insight Strip */}
      {skillInsight && (
        <div
          className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10 mb-4 ${
            skillInsight.hasSufficientData
              ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
              : 'bg-cyan-950/20 border-cyan-500/30 text-cyan-200'
          }`}
          data-testid="four-skills-insight-strip"
        >
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 p-1.5 rounded-lg bg-slate-950/60 border border-slate-800 text-cyan-400 shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>{skillInsight.title}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                  {skillInsight.hasSufficientData ? 'Chênh lệch năng lực' : 'Đề xuất cân bằng'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                {skillInsight.message}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handlePracticeSkill(skillInsight.skill)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 border border-slate-750 text-white shrink-0 self-end sm:self-auto transition-colors cursor-pointer"
            data-testid="btn-practice-skill-insight"
          >
            <span>Luyện {skillInsight.skill}</span>
            <ArrowRight className="w-3 h-3 text-slate-400" />
          </button>
        </div>
      )}

      {/* CTA Footer Bar */}
      <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 relative z-10">
        <p className="text-xs text-slate-400 leading-relaxed">
          {summary.totalWeakItems > 0
            ? 'Hệ thống tự động đồng bộ điểm yếu từ 4 kỹ năng vào hàng đợi ôn tập thích ứng.'
            : summary.hasLearningData
            ? 'Toàn bộ từ vựng và bài tập 4 kỹ năng đang ở trạng thái tối ưu.'
            : 'Chưa có dữ liệu học tập từ 4 kỹ năng. Hãy bắt đầu luyện tập để hệ thống tổng hợp.'}
        </p>

        {summary.totalWeakItems > 0 && ctaTarget.tab && onNavigate ? (
          <button
            type="button"
            onClick={handleReviewWeakItems}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
            data-testid="btn-review-weak-items"
          >
            <span>{ctaTarget.label || 'Review weak items'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : summary.hasLearningData ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Up to Date</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 bg-slate-800/40 border border-slate-700/40">
            <Sparkles className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>No Four Skills learning signals yet</span>
          </div>
        )}
      </div>
    </div>
  );
};
