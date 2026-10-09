// src/components/fourSkills/LearningJourneyProgressionMap.tsx
import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Play,
  Flame,
  ArrowRight,
  Headphones,
  BookOpen,
  Mic,
  PenTool,
  Compass,
  Lightbulb,
  Award,
  RotateCcw,
  History,
  AlertTriangle,
} from 'lucide-react';
import type { CEFRLevel } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import {
  deriveFourSkillsLearningJourney,
  CEFR_LEVELS_ORDER,
  SkillType,
  JourneyLevelNode,
} from '../../services/learningJourneyService';
import {
  findListeningLessonsByCefr,
  findReadingLessonsByCefr,
  findSpeakingLessonsByCefr,
  findWritingLessonsByCefr,
  ListeningLesson,
  ReadingLesson,
  SpeakingPrompt,
  WritingPrompt,
} from '../../data/fourSkillsData';
import { deriveSkillGapInsights } from '../../services/personalizedInsightService';
import { getFourSkillsCompetency } from '../../services/skillsCompetencyService';
import { CEFRCheckpointSessionModal } from './CEFRCheckpointSessionModal';
import { CEFRCertificationHistoryModal } from './CEFRCertificationHistoryModal';

export const CEFR_LEVEL_METADATA: Record<
  CEFRLevel,
  { nameVi: string; nameEn: string; shortDesc: string }
> = {
  A1: { nameVi: 'Khởi đầu', nameEn: 'Beginner', shortDesc: 'Giao tiếp cơ bản, từ vựng quen thuộc' },
  A2: { nameVi: 'Sơ cấp', nameEn: 'Elementary', shortDesc: 'Hội thoại hàng ngày, diễn đạt đơn giản' },
  B1: { nameVi: 'Trung cấp', nameEn: 'Intermediate', shortDesc: 'Giao tiếp tự tin, xử lý tình huống thực tế' },
  B2: { nameVi: 'Trung cấp cao', nameEn: 'Upper Intermediate', shortDesc: 'Lưu loát công sở & học thuật' },
  C1: { nameVi: 'Cao cấp', nameEn: 'Advanced', shortDesc: 'Diễn đạt tinh tế, phân tích chuyên sâu' },
  C2: { nameVi: 'Thành thạo', nameEn: 'Proficiency', shortDesc: 'Làm chủ toàn diện như người bản xứ' },
};

export interface LearningJourneyProgressionMapProps {
  onSelectLesson: (skill: SkillType, lessonId: string) => void;
  selectedMilestoneLevel?: CEFRLevel;
  onSelectMilestoneLevel?: (level: CEFRLevel) => void;
  className?: string;
  onStartCheckpoint?: (level: CEFRLevel) => void;
}

export const LearningJourneyProgressionMap: React.FC<LearningJourneyProgressionMapProps> = ({
  onSelectLesson,
  selectedMilestoneLevel: controlledSelectedLevel,
  onSelectMilestoneLevel,
  className = '',
  onStartCheckpoint,
}) => {
  const {
    completedListeningLessonIds,
    fourSkillsCompletionProgress,
    resumeActivities,
    fourSkillsEvidence,
    fourSkillsScores,
    srsProgressMap,
    levelCertifications,
    checkpointHistory,
  } = useAppStore();

  // 1. Pure derivation of Learning Journey (with Level Certification status)
  const journey = useMemo(() => {
    return deriveFourSkillsLearningJourney({
      completedListeningLessonIds,
      fourSkillsCompletionProgress,
      resumeActivities,
      levelCertifications,
      checkpointHistory,
      fourSkillsEvidence,
      fourSkillsScores,
    });
  }, [
    completedListeningLessonIds,
    fourSkillsCompletionProgress,
    resumeActivities,
    levelCertifications,
    checkpointHistory,
    fourSkillsEvidence,
    fourSkillsScores,
  ]);

  // Checkpoint Session & History Modal state
  const [activeCheckpointLevel, setActiveCheckpointLevel] = useState<CEFRLevel | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyModalLevel, setHistoryModalLevel] = useState<CEFRLevel | 'ALL'>('ALL');

  // 2. Active milestone selection (Uncontrolled fallback to journey's currentLevel)
  const [internalSelectedLevel, setInternalSelectedLevel] = useState<CEFRLevel>(
    journey.summary.currentLevel
  );
  const [expandedMilestoneLevel, setExpandedMilestoneLevel] = useState<CEFRLevel | null>(null);

  const activeSelectedLevel = controlledSelectedLevel ?? internalSelectedLevel;

  const handleSelectLevel = (level: CEFRLevel) => {
    if (onSelectMilestoneLevel) {
      onSelectMilestoneLevel(level);
    } else {
      setInternalSelectedLevel(level);
    }
    // Toggle milestone expansion
    setExpandedMilestoneLevel((prev) => (prev === level ? null : level));
  };

  const displayLevel = expandedMilestoneLevel ?? activeSelectedLevel;
  const selectedNode: JourneyLevelNode =
    journey.levels[displayLevel] || journey.levels.A1;
  const selectedMeta = CEFR_LEVEL_METADATA[displayLevel];

  // 3. Competency metadata (Completion != Competency)
  const competency = useMemo(() => {
    return getFourSkillsCompetency(srsProgressMap);
  }, [srsProgressMap]);

  // 4. Personalized Insight tip (Max 1 insight for Current Journey)
  const skillGapTip = useMemo(() => {
    const raw = deriveSkillGapInsights(fourSkillsEvidence, fourSkillsScores);
    return raw.length > 0 ? raw[0] : null;
  }, [fourSkillsEvidence, fourSkillsScores]);

  // 5. Lessons for the selected milestone level
  const listeningLessons: ListeningLesson[] = useMemo(() => {
    return findListeningLessonsByCefr(displayLevel);
  }, [displayLevel]);

  const readingLessons: ReadingLesson[] = useMemo(() => {
    return findReadingLessonsByCefr(displayLevel);
  }, [displayLevel]);

  const speakingPrompts: SpeakingPrompt[] = useMemo(() => {
    return findSpeakingLessonsByCefr(displayLevel);
  }, [displayLevel]);

  const writingPrompts: WritingPrompt[] = useMemo(() => {
    return findWritingLessonsByCefr(displayLevel);
  }, [displayLevel]);

  const { isNewUser, activeResumeLesson, nextRecommendedLesson, currentLevel } =
    journey.summary;

  return (
    <div
      data-testid="learning-journey-progression-map"
      className={`space-y-6 sm:space-y-8 ${className}`}
    >
      {/* ========================================================================= */}
      {/* 1. CURRENT JOURNEY & CALLOUT BANNER                                       */}
      {/* ========================================================================= */}
      <section
        data-testid="current-journey-section"
        className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 rounded-full text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Lộ Trình Học Tập A1 → C2</span>
              </span>
              <span className="text-xs text-slate-400">
                • {journey.summary.completedLessons} / {journey.summary.totalLessons} bài ({journey.summary.overallProgressPercent}%)
              </span>
            </div>

            {/* Level Semantics Row: currentlyLearningLevel vs highestCertifiedLevel */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                data-testid="currently-learning-level-indicator"
                className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl font-bold inline-flex items-center gap-1"
              >
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <span>Đang học: <strong className="text-cyan-300 font-mono">{journey.summary.currentlyLearningLevel}</strong></span>
              </span>

              <span
                data-testid="highest-certified-level-indicator"
                className={`px-2.5 py-1 rounded-xl font-bold inline-flex items-center gap-1 border ${
                  journey.summary.highestCertifiedLevel
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  Đạt chuẩn cao nhất:{' '}
                  <strong className="font-mono">
                    {journey.summary.highestCertifiedLevel
                      ? `${journey.summary.highestCertifiedLevel} Mastery`
                      : 'Chưa có'}
                  </strong>
                </span>
              </span>

              <button
                type="button"
                data-testid="btn-open-certification-history-header"
                onClick={() => {
                  setHistoryModalLevel('ALL');
                  setIsHistoryModalOpen(true);
                }}
                className="min-h-[36px] px-3 py-1 bg-slate-800 hover:bg-slate-750 text-cyan-300 hover:text-white border border-slate-700 rounded-xl font-bold transition-colors inline-flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <History className="w-3.5 h-3.5" />
                <span>Lịch sử ({checkpointHistory?.length ?? 0})</span>
              </button>
            </div>
          </div>

          {/* Condition 1: New User Onboarding State */}
          {isNewUser ? (
            <div
              data-testid="new-user-journey-card"
              className="bg-slate-950/80 border border-cyan-500/30 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md text-[10px] font-black uppercase">
                    Khởi Đầu
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    Hành Trình Chinh Phục 4 Kỹ Năng Tiếng Anh
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Bắt đầu từ cấp độ <strong className="text-cyan-300">A1 (Khởi đầu)</strong> để xây dựng nền tảng vững vàng qua các bài nghe, đọc, nói và viết được thiết kế chuẩn CEFR quốc tế.
                </p>
                <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
                  <span>🎧 Nghe hiểu</span>
                  <span>•</span>
                  <span>📖 Đọc hiểu</span>
                  <span>•</span>
                  <span>🗣️ Nói phản xạ</span>
                  <span>•</span>
                  <span>✍️ Viết luận</span>
                </div>
              </div>

              {nextRecommendedLesson && (
                <button
                  type="button"
                  data-testid="journey-start-btn"
                  onClick={() => onSelectLesson(nextRecommendedLesson.skill, nextRecommendedLesson.id)}
                  className="min-h-[44px] px-6 py-3 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:opacity-95 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <span>Bắt đầu hành trình</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : activeResumeLesson ? (
            /* Condition 2: Active Resumable Lesson Banner */
            <div
              data-testid="journey-resume-card"
              className="bg-slate-950/80 border border-cyan-500/40 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-md text-[10px] font-black uppercase flex items-center gap-1">
                    <Play className="w-3 h-3 fill-cyan-300" />
                    <span>Bài học dở dang</span>
                  </span>
                  <span className="text-xs text-slate-400">
                    CEFR {activeResumeLesson.level} • {activeResumeLesson.progressPercent ?? 0}% hoàn thành
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  Đang học dở: {activeResumeLesson.title}
                </h3>
                <p className="text-xs text-slate-400">
                  Tiếp tục phiên học dở dang tại phân hệ {activeResumeLesson.skill === 'listening' ? 'Luyện Nghe' : activeResumeLesson.skill === 'reading' ? 'Luyện Đọc' : activeResumeLesson.skill === 'speaking' ? 'Luyện Nói' : 'Luyện Viết'}.
                </p>
              </div>

              <button
                type="button"
                data-testid="journey-resume-btn"
                onClick={() => onSelectLesson(activeResumeLesson.skill, activeResumeLesson.id)}
                className="min-h-[44px] px-6 py-3 bg-gradient-to-r from-cyan-400 to-teal-400 hover:opacity-95 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Tiếp tục bài học</span>
              </button>
            </div>
          ) : (
            /* Condition 3: Normal In-Progress Journey Status */
            <div
              data-testid="current-journey-card"
              className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md text-[10px] font-black uppercase">
                    Cấp độ hiện tại: {currentLevel}
                  </span>
                  <span className="text-xs text-slate-400">
                    {CEFR_LEVEL_METADATA[currentLevel].nameVi} ({CEFR_LEVEL_METADATA[currentLevel].nameEn})
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  {nextRecommendedLesson
                    ? `Bài tiếp theo: ${nextRecommendedLesson.title}`
                    : `Bạn đã hoàn tất toàn bộ các bài học trong lộ trình!`}
                </h3>
                <p className="text-xs text-slate-400">
                  {journey.levels[currentLevel].completedLessons} / {journey.levels[currentLevel].totalLessons} bài học thuộc bậc {currentLevel} đã hoàn thành ({journey.levels[currentLevel].progressPercent}%).
                </p>
              </div>

              {nextRecommendedLesson && (
                <button
                  type="button"
                  data-testid="journey-next-btn"
                  onClick={() => onSelectLesson(nextRecommendedLesson.skill, nextRecommendedLesson.id)}
                  className="min-h-[44px] px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <span>Học tiếp bài này</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Subtle 1-line Personalized Insight (Guidance only) */}
          {skillGapTip && (
            <div
              data-testid="journey-insight-strip"
              className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-950/60 border border-cyan-500/20 rounded-xl text-xs text-slate-300"
            >
              <Lightbulb className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="leading-snug">{skillGapTip.message}</span>
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. PROGRESSION MAP MILESTONE TRACK (A1 -> C2)                             */}
      {/* ========================================================================= */}
      <section className="space-y-4" aria-label="Lộ trình học tập 6 bậc CEFR">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
              Bản Đồ Cấp Độ CEFR (A1 → C2)
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">
            Tự do khám phá mọi cấp độ • Khuyến nghị học tuần tự
          </span>
        </div>

        {/* Milestone Grid / Track */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {journey.orderedLevels.map((node) => {
            const isSelected = node.level === activeSelectedLevel;
            const meta = CEFR_LEVEL_METADATA[node.level];
            const isCurrent = node.isCurrentLevel;

            // Status styling & icons
            const isDone = node.status === 'completed';
            const isInProgress = node.status === 'in_progress';

            // Certification status
            const certStatus = node.certificationStatus;
            const isCertified = certStatus === 'certified';
            const isReadyForCert = certStatus === 'ready';
            const isCertInProgress = certStatus === 'in_progress';
            const isNeedsReinforcement = certStatus === 'needs_reinforcement';

            const statusLabel = isCertified
              ? 'Đã đạt chuẩn'
              : isDone
              ? 'Đã hoàn thành'
              : isReadyForCert
              ? 'Sẵn sàng kiểm định'
              : isCertInProgress
              ? 'Đang kiểm định'
              : isNeedsReinforcement
              ? 'Cần củng cố'
              : isInProgress
              ? 'Đang học'
              : 'Chưa bắt đầu';

            return (
              <button
                key={node.level}
                type="button"
                data-testid={`journey-milestone-${node.level}`}
                aria-pressed={isSelected}
                aria-label={`Trình độ ${node.level}: ${meta.nameVi}, trạng thái ${statusLabel}, ${node.completedLessons} trên ${node.totalLessons} bài hoàn thành`}
                onClick={() => handleSelectLevel(node.level)}
                className={`min-h-[44px] relative text-left p-4 rounded-2xl border transition-all duration-200 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none cursor-pointer flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                  isSelected
                    ? 'bg-slate-900 border-cyan-400 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-400/50'
                    : isCertified
                    ? 'bg-slate-900/90 border-emerald-500/40 hover:border-emerald-500/70 hover:bg-slate-850'
                    : isReadyForCert
                    ? 'bg-slate-900/90 border-cyan-500/40 hover:border-cyan-500/70 hover:bg-slate-850'
                    : isNeedsReinforcement
                    ? 'bg-slate-900/90 border-rose-500/40 hover:border-rose-500/70 hover:bg-slate-850'
                    : isDone
                    ? 'bg-slate-900/90 border-emerald-500/20 hover:border-emerald-500/40 hover:bg-slate-850'
                    : isInProgress
                    ? 'bg-slate-900/90 border-amber-500/30 hover:border-amber-500/60 hover:bg-slate-850'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900 opacity-90'
                }`}
              >
                {/* Active Resumable Activity Indicator */}
                {node.activeLesson && (
                  <span
                    title="Có bài học dở dang"
                    className="absolute -top-2 -right-2 px-2 py-0.5 bg-cyan-400 text-slate-950 font-black text-[9px] rounded-full shadow-md uppercase tracking-wider motion-reduce:animate-none animate-pulse"
                  >
                    Đang dở
                  </span>
                )}

                {/* Level Identifier & Current Badge */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-mono text-xl sm:text-2xl font-black ${
                        isDone
                          ? 'text-emerald-400'
                          : isCurrent
                          ? 'text-cyan-400'
                          : isInProgress
                          ? 'text-amber-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {node.level}
                    </span>

                    {/* Status Icon */}
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                    ) : isInProgress ? (
                      <Flame className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                    ) : (
                      <Compass className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <h3 className="text-xs font-bold text-white truncate">{meta.nameVi}</h3>
                    <p className="text-[10px] text-slate-400 truncate">{meta.nameEn}</p>
                  </div>
                </div>

                {/* Certification Status Badge */}
                <div className="mt-2">
                  {isCertified ? (
                    <span
                      data-testid={`cert-badge-${node.level}`}
                      className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1 w-fit"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>✓ Certified</span>
                    </span>
                  ) : isCertInProgress ? (
                    <span
                      data-testid={`cert-badge-${node.level}`}
                      className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1 w-fit animate-pulse"
                    >
                      <span>Đang thi</span>
                    </span>
                  ) : isReadyForCert ? (
                    <span
                      data-testid={`cert-badge-${node.level}`}
                      className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 inline-flex items-center gap-1 w-fit"
                    >
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span>Sẵn sàng thi</span>
                    </span>
                  ) : isNeedsReinforcement ? (
                    <span
                      data-testid={`cert-badge-${node.level}`}
                      className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-flex items-center gap-1 w-fit"
                    >
                      <span>Cần củng cố</span>
                    </span>
                  ) : (
                    <span
                      data-testid={`cert-badge-${node.level}`}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium text-slate-500 border border-slate-800 w-fit"
                    >
                      {node.completedLessons === 0 ? 'Chưa bắt đầu' : 'Đang học'}
                    </span>
                  )}
                </div>

                {/* Level Progress */}
                <div className="mt-3 space-y-1.5 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-300">
                      {node.completedLessons}/{node.totalLessons} bài
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        isDone
                          ? 'text-emerald-400'
                          : isInProgress
                          ? 'text-amber-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {node.progressPercent}%
                    </span>
                  </div>

                  {/* Progress Bar with A11y */}
                  <div
                    role="progressbar"
                    aria-label={`Tiến độ hoàn thành trình độ ${node.level}`}
                    aria-valuenow={node.progressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden"
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-500 motion-reduce:transition-none ${
                        isDone
                          ? 'bg-emerald-400'
                          : isCurrent
                          ? 'bg-cyan-400'
                          : isInProgress
                          ? 'bg-amber-400'
                          : 'bg-slate-600'
                      }`}
                      style={{ width: `${node.progressPercent}%` }}
                    />
                  </div>

                  {/* Mini Skill Breakdown Counters */}
                  <div className="grid grid-cols-4 gap-1 text-[9px] font-mono text-center pt-1 text-slate-400">
                    <span title="Listening">🎧{node.skills.listening.completedLessons}/{node.skills.listening.totalLessons}</span>
                    <span title="Reading">📖{node.skills.reading.completedLessons}/{node.skills.reading.totalLessons}</span>
                    <span title="Speaking">🗣️{node.skills.speaking.completedLessons}/{node.skills.speaking.totalLessons}</span>
                    <span title="Writing">✍️{node.skills.writing.completedLessons}/{node.skills.writing.totalLessons}</span>
                  </div>

                  <span className="text-[10px] font-bold text-center block pt-1 text-cyan-400">
                    {expandedMilestoneLevel === node.level ? 'Đóng ▲' : 'Xem bài học ▼'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. LEVEL DETAIL (LESSON BREAKDOWN BY 4 SKILLS)                            */}
      {/* ========================================================================= */}
      {expandedMilestoneLevel && (
        <section
          data-testid={`level-detail-section-${expandedMilestoneLevel}`}
          className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-7 space-y-6 shadow-xl animate-fadeIn"
          aria-label={`Chi tiết bài học cấp độ ${expandedMilestoneLevel}`}
        >
          {/* Level Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xl sm:text-2xl font-black text-cyan-400">
                  {expandedMilestoneLevel}
                </span>
                <h3 className="text-base sm:text-lg font-black text-white">
                  {CEFR_LEVEL_METADATA[expandedMilestoneLevel].nameVi} • {CEFR_LEVEL_METADATA[expandedMilestoneLevel].nameEn}
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-800 text-slate-300">
                  {journey.levels[expandedMilestoneLevel].completedLessons} / {journey.levels[expandedMilestoneLevel].totalLessons} bài hoàn tất
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{CEFR_LEVEL_METADATA[expandedMilestoneLevel].shortDesc}</p>
            </div>

            <div className="flex items-center gap-3">
              {/* Competency Metadata Badge (Separate from Completion) */}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Award className="w-4 h-4 text-amber-400" />
                <span>
                  {competency.accumulatedCoreWords > 0
                    ? `Tích lũy ${competency.accumulatedCoreWords} từ cốt lõi`
                    : `Lộ trình luyện tập toàn diện`}
                </span>
              </div>

              <button
                type="button"
                data-testid="close-level-detail-btn"
                onClick={() => setExpandedMilestoneLevel(null)}
                aria-label="Đóng chi tiết cấp độ"
                className="px-3 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-700"
              >
                ✕ Đóng
              </button>
            </div>
          </div>

          {/* Level Certification Banner & Actions */}
          <div
            data-testid={`level-certification-card-${expandedMilestoneLevel}`}
            className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Kiểm Định Năng Lực {expandedMilestoneLevel}
                </span>
                {selectedNode.certificationStatus === 'certified' ? (
                  <span
                    data-testid={`detail-cert-badge-${expandedMilestoneLevel}`}
                    className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 inline-flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>✓ Certified in English Mastery Hub</span>
                  </span>
                ) : selectedNode.certificationStatus === 'ready' ? (
                  <span
                    data-testid={`detail-cert-badge-${expandedMilestoneLevel}`}
                    className="px-2.5 py-0.5 rounded-full text-xs font-black bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Sẵn sàng kiểm định</span>
                  </span>
                ) : selectedNode.certificationStatus === 'needs_reinforcement' ? (
                  <span
                    data-testid={`detail-cert-badge-${expandedMilestoneLevel}`}
                    className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500/15 border border-rose-500/30 text-rose-300 inline-flex items-center gap-1"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Cần củng cố</span>
                  </span>
                ) : (
                  <span
                    data-testid={`detail-cert-badge-${expandedMilestoneLevel}`}
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-850 border border-slate-800 text-slate-400"
                  >
                    Chưa đủ điều kiện
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-300">
                {selectedNode.certificationStatus === 'certified'
                  ? `Đã đạt chuẩn ${expandedMilestoneLevel} Mastery tại English Mastery Hub (Mã: ${selectedNode.certificationRecord?.certificateId || 'N/A'} • Điểm: ${selectedNode.certificationRecord?.overallScore ?? 0}%).`
                  : selectedNode.certificationStatus === 'ready'
                  ? `Bạn đã tích lũy đủ bài học và dữ liệu năng lực. Sẵn sàng tham gia bài kiểm định 4 kỹ năng chính thức!`
                  : selectedNode.certificationStatus === 'needs_reinforcement'
                  ? `Lần thi gần nhất chưa đạt chuẩn sàn 4 kỹ năng. Hãy củng cố các kỹ năng yếu trước khi thử lại.`
                  : `Cần tích lũy thêm bài học và bằng chứng năng lực trước khi mở bài thi kiểm định.`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {/* Checkpoint CTA Button */}
              {selectedNode.certificationStatus === 'ready' ? (
                <button
                  type="button"
                  data-testid="btn-start-checkpoint"
                  onClick={() => {
                    if (onStartCheckpoint) onStartCheckpoint(expandedMilestoneLevel);
                    setActiveCheckpointLevel(expandedMilestoneLevel);
                  }}
                  className="min-h-[44px] px-5 py-2.5 bg-gradient-to-r from-cyan-400 to-teal-400 hover:opacity-95 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <Sparkles className="w-4 h-4 fill-slate-950" />
                  <span>Làm bài kiểm định {expandedMilestoneLevel}</span>
                </button>
              ) : selectedNode.certificationStatus === 'needs_reinforcement' ? (
                <button
                  type="button"
                  data-testid="btn-retry-checkpoint"
                  onClick={() => {
                    if (onStartCheckpoint) onStartCheckpoint(expandedMilestoneLevel);
                    setActiveCheckpointLevel(expandedMilestoneLevel);
                  }}
                  className="min-h-[44px] px-5 py-2.5 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Thử lại kiểm định {expandedMilestoneLevel}</span>
                </button>
              ) : selectedNode.certificationStatus === 'certified' ? (
                <button
                  type="button"
                  data-testid="btn-retake-checkpoint"
                  onClick={() => {
                    if (onStartCheckpoint) onStartCheckpoint(expandedMilestoneLevel);
                    setActiveCheckpointLevel(expandedMilestoneLevel);
                  }}
                  className="min-h-[44px] px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Thi lại nâng điểm</span>
                </button>
              ) : null}

              {/* View History CTA */}
              <button
                type="button"
                data-testid="btn-view-checkpoint-history"
                onClick={() => {
                  setHistoryModalLevel(expandedMilestoneLevel);
                  setIsHistoryModalOpen(true);
                }}
                className="min-h-[44px] px-3.5 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <History className="w-4 h-4" />
                <span>Lịch sử</span>
              </button>
            </div>
          </div>

        {/* 4 Skills Columns / Groups */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* GROUP 1: LISTENING */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Headphones className="w-4 h-4" />
                </div>
                <h4 className="text-xs sm:text-sm font-extrabold text-white">
                  🎧 Luyện Nghe ({selectedNode.skills.listening.completedLessons}/{selectedNode.skills.listening.totalLessons})
                </h4>
              </div>
              <span className="text-[11px] font-mono text-cyan-400 font-bold">
                {selectedNode.skills.listening.progressPercent}%
              </span>
            </div>

            <div className="space-y-2">
              {listeningLessons.map((lesson) => {
                const isCompleted = selectedNode.skills.listening.completedLessonIds.includes(lesson.id);
                const isActive = selectedNode.skills.listening.activeLesson?.id === lesson.id;

                return (
                  <button
                    key={lesson.id}
                    type="button"
                    data-testid={`journey-lesson-${lesson.id}`}
                    onClick={() => onSelectLesson('listening', lesson.id)}
                    className={`w-full min-h-[44px] text-left p-3.5 rounded-xl border transition-all duration-150 active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none cursor-pointer flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                      isCompleted
                        ? 'bg-slate-950/60 border-emerald-500/30 hover:border-emerald-500/60'
                        : isActive
                        ? 'bg-cyan-950/30 border-cyan-400 shadow-sm'
                        : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-850/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate block">
                          {lesson.title}
                        </span>
                        {isActive && (
                          <span className="px-1.5 py-0.2 text-[9px] font-black uppercase bg-cyan-400 text-slate-950 rounded">
                            Đang dở
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {lesson.category} • {lesson.duration} • {lesson.questions.length} câu hỏi
                      </span>
                    </div>

                    <div className="shrink-0">
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : isActive ? (
                        <Play className="w-4 h-4 text-cyan-400 fill-cyan-400" />
                      ) : (
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-cyan-400">
                          Bắt đầu
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* GROUP 2: READING */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h4 className="text-xs sm:text-sm font-extrabold text-white">
                  📖 Luyện Đọc ({selectedNode.skills.reading.completedLessons}/{selectedNode.skills.reading.totalLessons})
                </h4>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                {selectedNode.skills.reading.progressPercent}%
              </span>
            </div>

            <div className="space-y-2">
              {readingLessons.map((lesson) => {
                const isCompleted = selectedNode.skills.reading.completedLessonIds.includes(lesson.id);
                const isActive = selectedNode.skills.reading.activeLesson?.id === lesson.id;

                return (
                  <button
                    key={lesson.id}
                    type="button"
                    data-testid={`journey-lesson-${lesson.id}`}
                    onClick={() => onSelectLesson('reading', lesson.id)}
                    className={`w-full min-h-[44px] text-left p-3.5 rounded-xl border transition-all duration-150 active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none cursor-pointer flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      isCompleted
                        ? 'bg-slate-950/60 border-emerald-500/30 hover:border-emerald-500/60'
                        : isActive
                        ? 'bg-emerald-950/30 border-emerald-400 shadow-sm'
                        : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-850/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate block">
                          {lesson.title}
                        </span>
                        {isActive && (
                          <span className="px-1.5 py-0.2 text-[9px] font-black uppercase bg-emerald-400 text-slate-950 rounded">
                            Đang dở
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {lesson.category} • ~{lesson.wordCount} từ • {lesson.questions.length} câu hỏi
                      </span>
                    </div>

                    <div className="shrink-0">
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : isActive ? (
                        <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                      ) : (
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-emerald-400">
                          Bắt đầu
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* GROUP 3: SPEAKING */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Mic className="w-4 h-4" />
                </div>
                <h4 className="text-xs sm:text-sm font-extrabold text-white">
                  🗣️ Luyện Nói ({selectedNode.skills.speaking.completedLessons}/{selectedNode.skills.speaking.totalLessons})
                </h4>
              </div>
              <span className="text-[11px] font-mono text-purple-400 font-bold">
                {selectedNode.skills.speaking.progressPercent}%
              </span>
            </div>

            <div className="space-y-2">
              {speakingPrompts.map((prompt) => {
                const isCompleted = selectedNode.skills.speaking.completedLessonIds.includes(prompt.id);
                const isActive = selectedNode.skills.speaking.activeLesson?.id === prompt.id;

                return (
                  <button
                    key={prompt.id}
                    type="button"
                    data-testid={`journey-lesson-${prompt.id}`}
                    onClick={() => onSelectLesson('speaking', prompt.id)}
                    className={`w-full min-h-[44px] text-left p-3.5 rounded-xl border transition-all duration-150 active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none cursor-pointer flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
                      isCompleted
                        ? 'bg-slate-950/60 border-emerald-500/30 hover:border-emerald-500/60'
                        : isActive
                        ? 'bg-purple-950/30 border-purple-400 shadow-sm'
                        : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-850/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate block">
                          {prompt.title}
                        </span>
                        {isActive && (
                          <span className="px-1.5 py-0.2 text-[9px] font-black uppercase bg-purple-400 text-slate-950 rounded">
                            Đang dở
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {prompt.category} • {prompt.turns.length} lượt đối thoại
                      </span>
                    </div>

                    <div className="shrink-0">
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : isActive ? (
                        <Play className="w-4 h-4 text-purple-400 fill-purple-400" />
                      ) : (
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-purple-400">
                          Bắt đầu
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* GROUP 4: WRITING */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <PenTool className="w-4 h-4" />
                </div>
                <h4 className="text-xs sm:text-sm font-extrabold text-white">
                  ✍️ Luyện Viết ({selectedNode.skills.writing.completedLessons}/{selectedNode.skills.writing.totalLessons})
                </h4>
              </div>
              <span className="text-[11px] font-mono text-amber-400 font-bold">
                {selectedNode.skills.writing.progressPercent}%
              </span>
            </div>

            <div className="space-y-2">
              {writingPrompts.map((prompt) => {
                const isCompleted = selectedNode.skills.writing.completedLessonIds.includes(prompt.id);
                const isActive = selectedNode.skills.writing.activeLesson?.id === prompt.id;

                return (
                  <button
                    key={prompt.id}
                    type="button"
                    data-testid={`journey-lesson-${prompt.id}`}
                    onClick={() => onSelectLesson('writing', prompt.id)}
                    className={`w-full min-h-[44px] text-left p-3.5 rounded-xl border transition-all duration-150 active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none cursor-pointer flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                      isCompleted
                        ? 'bg-slate-950/60 border-emerald-500/30 hover:border-emerald-500/60'
                        : isActive
                        ? 'bg-amber-950/30 border-amber-400 shadow-sm'
                        : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-850/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate block">
                          {prompt.title}
                        </span>
                        {isActive && (
                          <span className="px-1.5 py-0.2 text-[9px] font-black uppercase bg-amber-400 text-slate-950 rounded">
                            Đang dở
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {prompt.type} • {prompt.minWords}–{prompt.maxWords || 300} từ
                      </span>
                    </div>

                    <div className="shrink-0">
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : isActive ? (
                        <Play className="w-4 h-4 text-amber-400 fill-amber-400" />
                      ) : (
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-amber-400">
                          Bắt đầu
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* 4. MODALS: CHECKPOINT SESSION & CERTIFICATION HISTORY */}
      {activeCheckpointLevel && (
        <CEFRCheckpointSessionModal
          level={activeCheckpointLevel}
          isOpen={true}
          onClose={() => setActiveCheckpointLevel(null)}
          onCertified={(lvl) => {
            // Level is automatically certified in store
          }}
        />
      )}

      <CEFRCertificationHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        initialLevelFilter={historyModalLevel}
        onSelectRetake={(lvl) => {
          setActiveCheckpointLevel(lvl);
        }}
      />
    </div>
  );
};
