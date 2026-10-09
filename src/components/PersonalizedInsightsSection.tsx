import React, { useMemo } from 'react';
import {
  Sparkles,
  Brain,
  Flame,
  Layers,
  BookOpen,
  TrendingUp,
  PenTool,
  AlertCircle,
  ShieldAlert,
  Mic,
  Award,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import {
  derivePersonalizedInsightsSummary,
  PersonalizedInsight,
  InsightType,
  InsightSeverity,
} from '../services/personalizedInsightService';
import { ActiveTab, PracticeModuleId, MistakeType } from '../types';

export interface PersonalizedInsightsSectionProps {
  onNavigate: (tab: ActiveTab) => void;
  onStartAdaptivePractice?: (params: {
    module: PracticeModuleId;
    itemIds: string[];
    mistakeType?: MistakeType;
  }) => void;
  setActiveFourSkill?: (skill: 'listening' | 'reading' | 'speaking' | 'writing') => void;
}

const TYPE_CONFIG: Record<
  InsightType,
  { label: string; icon: React.FC<{ className?: string }>; colorClass: string; badgeBg: string }
> = {
  confusion: {
    label: 'Nhầm lẫn từ vựng',
    icon: Layers,
    colorClass: 'text-purple-400 border-purple-500/30',
    badgeBg: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
  },
  forgetting_risk: {
    label: 'Nguy cơ quên từ',
    icon: Brain,
    colorClass: 'text-amber-400 border-amber-500/30',
    badgeBg: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  },
  leech: {
    label: 'Từ khó dai dẳng',
    icon: Flame,
    colorClass: 'text-rose-400 border-rose-500/30',
    badgeBg: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
  },
  weak_collocation: {
    label: 'Cụm từ cần củng cố',
    icon: BookOpen,
    colorClass: 'text-sky-400 border-sky-500/30',
    badgeBg: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  },
  skill_gap: {
    label: 'Cân bằng kỹ năng',
    icon: TrendingUp,
    colorClass: 'text-cyan-400 border-cyan-500/30',
    badgeBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
  },
  usage_gap: {
    label: 'Khoảng cách sử dụng',
    icon: PenTool,
    colorClass: 'text-indigo-400 border-indigo-500/30',
    badgeBg: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
  },
  mistake_pattern: {
    label: 'Quy luật lỗi sai',
    icon: AlertCircle,
    colorClass: 'text-orange-400 border-orange-500/30',
    badgeBg: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
  },
  retention: {
    label: 'Tỷ lệ ghi nhớ',
    icon: ShieldAlert,
    colorClass: 'text-violet-400 border-violet-500/30',
    badgeBg: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  },
  pronunciation: {
    label: 'Cần sửa phát âm',
    icon: Mic,
    colorClass: 'text-pink-400 border-pink-500/30',
    badgeBg: 'bg-pink-500/10 text-pink-300 border-pink-500/20',
  },
  improvement: {
    label: 'Tiến bộ nổi bật',
    icon: Award,
    colorClass: 'text-emerald-400 border-emerald-500/30',
    badgeBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  },
};

const SEVERITY_BORDER: Record<InsightSeverity, string> = {
  critical: 'border-rose-500/40 bg-gradient-to-b from-rose-950/20 to-slate-900/90 shadow-rose-950/10',
  warning: 'border-amber-500/35 bg-gradient-to-b from-amber-950/15 to-slate-900/90 shadow-amber-950/10',
  info: 'border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950/90 hover:border-slate-700',
  success: 'border-emerald-500/35 bg-gradient-to-b from-emerald-950/20 to-slate-900/90 shadow-emerald-950/10',
};

export const PersonalizedInsightsSection: React.FC<PersonalizedInsightsSectionProps> = ({
  onNavigate,
  onStartAdaptivePractice,
  setActiveFourSkill,
}) => {
  const {
    srsProgressMap,
    mistakeBank,
    userCollocations,
    userCustomWords,
    vocabularyList,
    fourSkillsScores,
    fourSkillsEvidence,
    wordLearningStats,
    recentReviewEvents,
    dailyHistory,
    srsAlgorithm,
    fsrsSettings,
    profile,
    checkpointHistory,
    levelCertifications,
  } = useAppStore();

  const summary = useMemo(() => {
    return derivePersonalizedInsightsSummary({
      srsProgressMap,
      mistakeBank,
      userCollocations,
      userCustomWords,
      vocabularyList,
      fourSkillsScores,
      fourSkillsEvidence,
      wordLearningStats,
      recentReviewEvents,
      dailyHistory,
      srsAlgorithm,
      fsrsSettings,
      profile,
      checkpointHistory,
      levelCertifications,
    });
  }, [
    srsProgressMap,
    mistakeBank,
    userCollocations,
    userCustomWords,
    vocabularyList,
    fourSkillsScores,
    fourSkillsEvidence,
    wordLearningStats,
    recentReviewEvents,
    dailyHistory,
    srsAlgorithm,
    fsrsSettings,
    profile,
    checkpointHistory,
    levelCertifications,
  ]);

  // Clean Empty State: Hide completely if new user or zero evidence
  if (summary.isNewUser || !summary.hasInsights || summary.insights.length === 0) {
    return null;
  }

  const handleAction = (insight: PersonalizedInsight) => {
    const act = insight.action;
    if (!act) return;

    if (act.practiceModule && onStartAdaptivePractice) {
      onStartAdaptivePractice({
        module: act.practiceModule,
        itemIds: act.targetItemIds || [],
        mistakeType: (insight as any).mistakeCategory,
      });
      onNavigate(act.targetTab);
      return;
    }

    if (act.targetTab === 'four_skills' && act.subTab && setActiveFourSkill) {
      const validSkills = ['listening', 'reading', 'speaking', 'writing'] as const;
      if (validSkills.includes(act.subTab as any)) {
        setActiveFourSkill(act.subTab as any);
      }
      onNavigate('four_skills');
      return;
    }

    onNavigate(act.targetTab);
  };

  return (
    <section
      aria-label="Personalized Learning Insights"
      className="space-y-4 animate-fadeIn"
      data-testid="personalized-insights-section"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-cyan-400">
                Insights For You
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                Dữ liệu cá nhân hóa
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-white">
              Gợi Ý & Nhận Định Học Tập
            </h2>
          </div>
        </div>

        {/* Counter Summary Badge */}
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-800">
          {summary.attentionCount > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{summary.attentionCount} cần chú ý</span>
            </span>
          )}
          {summary.attentionCount > 0 && summary.positiveCount > 0 && <span>•</span>}
          {summary.positiveCount > 0 && (
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{summary.positiveCount} tiến bộ</span>
            </span>
          )}
        </div>
      </div>

      {/* Insight Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {summary.insights.map((insight) => {
          const config = TYPE_CONFIG[insight.type];
          const Icon = config.icon;
          const borderStyle = SEVERITY_BORDER[insight.severity];

          return (
            <article
              key={insight.id}
              className={`rounded-2xl border p-4.5 flex flex-col justify-between transition-all duration-200 hover:translate-y-[-1px] active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none shadow-lg ${borderStyle}`}
              data-testid={`insight-card-${insight.type}`}
            >
              <div className="space-y-2.5">
                {/* Category & Confidence Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${config.badgeBg}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{config.label}</span>
                  </div>

                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider ${
                      insight.confidence === 'strong' ? 'text-cyan-400' : 'text-slate-400'
                    }`}
                  >
                    {insight.confidence === 'strong' ? 'Độ tin cậy cao' : 'Khuyến nghị'}
                  </span>
                </div>

                {/* Title & Message */}
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight leading-snug">
                    {insight.title}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed mt-1.5">
                    {insight.message}
                  </p>
                </div>

                {/* Explanatory Reason Note (Plain language, zero raw telemetry IDs) */}
                <div className="text-[11px] text-slate-400 leading-snug bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80">
                  <span className="text-slate-500 font-semibold mr-1">Căn cứ:</span>
                  <span>{insight.reason}</span>
                </div>
              </div>

              {/* Action Button */}
              {insight.action && (
                <div className="pt-3 mt-3 border-t border-slate-800/70 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => handleAction(insight)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-100 bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 active:scale-[0.97] transition-all duration-150 motion-reduce:transform-none motion-reduce:transition-none cursor-pointer shadow-sm group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    data-testid={`btn-insight-action-${insight.type}`}
                  >
                    <span>{insight.action.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};
