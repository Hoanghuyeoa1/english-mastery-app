import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Award, 
  Target, 
  Layers, 
  BookOpen, 
  ShieldCheck, 
  Sparkles, 
  TrendingUp, 
  Check, 
  Bookmark, 
  BookmarkCheck,
  Plus,
  ArrowRight,
  RotateCcw, 
  FileText
} from 'lucide-react';
import { triggerCelebration } from '../utils/confettiPolicy';
import type { EssayGradingResult, CEFRLevel, DiffSegment } from '../types';
import { AIStatusBadge } from './AIStatusBadge';
import { GeminiKeyModal } from './GeminiKeyModal';
import { EssayDiffViewer } from './EssayDiffViewer';
import { recordSkillEvidence } from '../services/skillsCompetencyService';
import { useAppStore } from '../store/useAppStore';
import {
  captureWritingCollocation,
  captureWritingMistake,
  normalizeCollocationKey,
  isCollocationCandidate,
} from '../services/fourSkillsLearningBridge';

export interface WritingEvaluationReportProps {
  result: EssayGradingResult;
  originalEssay?: string;
  topic?: string;
  onRetake?: () => void;
  onSaveScore?: (score: number, result?: EssayGradingResult) => void;
  className?: string;
}

// Hàm hỗ trợ màu sắc badge CEFR
function getCEFRBadgeStyle(level: CEFRLevel): {
  bg: string;
  text: string;
  border: string;
  gradient: string;
} {
  switch (level) {
    case 'C2':
      return {
        bg: 'bg-fuchsia-500/10 dark:bg-fuchsia-950/40',
        text: 'text-fuchsia-700 dark:text-fuchsia-300',
        border: 'border-fuchsia-300 dark:border-fuchsia-800',
        gradient: 'from-fuchsia-500 to-purple-600',
      };
    case 'C1':
      return {
        bg: 'bg-indigo-500/10 dark:bg-indigo-950/40',
        text: 'text-indigo-700 dark:text-indigo-300',
        border: 'border-indigo-300 dark:border-indigo-800',
        gradient: 'from-indigo-500 to-violet-600',
      };
    case 'B2':
      return {
        bg: 'bg-emerald-500/10 dark:bg-emerald-950/40',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-300 dark:border-emerald-800',
        gradient: 'from-emerald-500 to-teal-600',
      };
    case 'B1':
      return {
        bg: 'bg-blue-500/10 dark:bg-blue-950/40',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-300 dark:border-blue-800',
        gradient: 'from-blue-500 to-cyan-600',
      };
    case 'A2':
      return {
        bg: 'bg-amber-500/10 dark:bg-amber-950/40',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-300 dark:border-amber-800',
        gradient: 'from-amber-500 to-orange-500',
      };
    case 'A1':
    default:
      return {
        bg: 'bg-rose-500/10 dark:bg-rose-950/40',
        text: 'text-rose-700 dark:text-rose-300',
        border: 'border-rose-300 dark:border-rose-800',
        gradient: 'from-rose-500 to-pink-600',
      };
  }
}

export const WritingEvaluationReport: React.FC<WritingEvaluationReportProps> = ({
  result,
  originalEssay,
  topic,
  onRetake,
  onSaveScore,
  className = '',
}) => {
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const { userCollocations, saveCollocationToSRS, recordMistake, mistakeBank } = useAppStore();

  const isCollocationSaved = (phrase?: string) => {
    if (!phrase) return false;
    const key = normalizeCollocationKey(phrase);
    return userCollocations?.some((c) => normalizeCollocationKey(c.phrase) === key) ?? false;
  };

  const isMistakeSaved = (originalText?: string) => {
    if (!originalText) return false;
    const mistakeKey = `writing_${originalText.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    return !!mistakeBank?.[mistakeKey];
  };

  const actionableSegments = useMemo(() => {
    return (result.diffSegments || []).filter(
      (s) => s.type !== 'unchanged' && Boolean(s.revisedText || s.originalText)
    );
  }, [result.diffSegments]);

  const handleSaveCollocation = (segment: DiffSegment) => {
    if (!segment.revisedText) return;
    if (isCollocationSaved(segment.revisedText)) return;
    captureWritingCollocation({
      phrase: segment.revisedText,
      originalText: segment.originalText,
      meaning: segment.reasonVi || segment.explanation || `Collocation chuẩn thay cho "${segment.originalText}"`,
      usageContext: 'Writing Essay',
      exampleEn: result.fullRevisedEssay || originalEssay,
      userCollocations,
      saveCollocationToSRS,
    });
  };

  const handleSaveMistake = (segment: DiffSegment) => {
    if (!segment.originalText) return;
    if (isMistakeSaved(segment.originalText)) return;
    captureWritingMistake({
      originalText: segment.originalText,
      revisedText: segment.revisedText,
      explanation: segment.explanation,
      reasonVi: segment.reasonVi,
      segmentType: segment.type,
      fullEssay: originalEssay,
      mistakeBank,
      recordMistake,
    });
  };

  const cefrStyle = getCEFRBadgeStyle(result.overallCEFR);

  // Xử lý lưu điểm năng lực vào Store & Skills Competency
  const handleSaveCompetency = () => {
    try {
      if (onSaveScore) {
        onSaveScore(result.overallScore, result);
      } else {
        const isOffline = Boolean(result.isFallback);
        recordSkillEvidence({
          skill: 'writing',
          score: result.overallScore,
          source: isOffline ? 'writing-offline' : 'writing-ai',
          cefrDifficulty: result.overallCEFR,
          quality: isOffline ? 0.65 : 1.0,
          metadata: {
            wordCount: result.wordCount,
            isFallback: isOffline,
          },
        });
      }
      setIsSaved(true);
      triggerCelebration('completion');
    } catch (e) {
      console.error('Failed to save writing competency score:', e);
    }
  };

  // Cấu hình 4 tiêu chí CEFR
  const criteriaList = [
    {
      id: 'taskAchievement',
      title: 'Hoàn thành Đề bài',
      sub: 'Task Achievement',
      icon: Target,
      score: result.criteria.taskAchievement.score,
      cefr: result.criteria.taskAchievement.cefrLevel,
      feedback: result.criteria.taskAchievement.feedback,
      color: 'blue',
      barColor: 'bg-blue-500',
      trackColor: 'bg-blue-100 dark:bg-blue-950/50',
      borderStyle: 'border-blue-200 dark:border-blue-900/60',
      badgeBg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
    },
    {
      id: 'coherenceCohesion',
      title: 'Tính Mạch Lạc & Liên Kết',
      sub: 'Coherence & Cohesion',
      icon: Layers,
      score: result.criteria.coherenceCohesion.score,
      cefr: result.criteria.coherenceCohesion.cefrLevel,
      feedback: result.criteria.coherenceCohesion.feedback,
      color: 'purple',
      barColor: 'bg-purple-500',
      trackColor: 'bg-purple-100 dark:bg-purple-950/50',
      borderStyle: 'border-purple-200 dark:border-purple-900/60',
      badgeBg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300',
    },
    {
      id: 'lexicalResource',
      title: 'Vốn Từ Vựng Học Thuật',
      sub: 'Lexical Resource',
      icon: BookOpen,
      score: result.criteria.lexicalResource.score,
      cefr: result.criteria.lexicalResource.cefrLevel,
      feedback: result.criteria.lexicalResource.feedback,
      color: 'amber',
      barColor: 'bg-amber-500',
      trackColor: 'bg-amber-100 dark:bg-amber-950/50',
      borderStyle: 'border-amber-200 dark:border-amber-900/60',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
    },
    {
      id: 'grammaticalAccuracy',
      title: 'Độ Chính Xác Ngữ Pháp',
      sub: 'Grammatical Accuracy',
      icon: ShieldCheck,
      score: result.criteria.grammaticalAccuracy.score,
      cefr: result.criteria.grammaticalAccuracy.cefrLevel,
      feedback: result.criteria.grammaticalAccuracy.feedback,
      color: 'emerald',
      barColor: 'bg-emerald-500',
      trackColor: 'bg-emerald-100 dark:bg-emerald-950/50',
      borderStyle: 'border-emerald-200 dark:border-emerald-900/60',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
    },
  ];

  return (
    <div className={`space-y-6 w-full ${className}`}>
      {/* 1. HERO HEADER DASHBOARD */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-white via-slate-50 to-indigo-50/30 dark:from-slate-900 dark:via-slate-900/90 dark:to-indigo-950/20 border border-slate-200/80 dark:border-slate-800 shadow-md">
        {/* Glow hiệu ứng trang trí */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 rounded-full bg-indigo-500/10 dark:bg-indigo-500/5 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Cột trái: Điểm số tròn & Cấp độ CEFR */}
          <div className="flex items-center gap-5">
            {/* Vòng tròn điểm số */}
            <div className="relative flex items-center justify-center shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-indigo-500/20">
                <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex flex-col items-center justify-center">
                  <span className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                    {result.overallScore}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    / 100 điểm
                  </span>
                </div>
              </div>
            </div>

            {/* Thông tin danh vị CEFR & Tiêu đề */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-sm ${cefrStyle.bg} ${cefrStyle.text} ${cefrStyle.border}`}>
                  Trình độ CEFR: {result.overallCEFR}
                </span>

                <AIStatusBadge
                  isFallback={result.isFallback}
                  onOpenModal={() => setIsKeyModalOpen(true)}
                />
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Báo Cáo Đánh Giá Bài Luận
              </h2>

              {topic && (
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                  Đề tài: <span className="font-semibold text-slate-700 dark:text-slate-200">"{topic}"</span>
                </p>
              )}

              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                <span className="inline-flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <strong>{result.wordCount}</strong> từ
                </span>
                <span>•</span>
                <span>4 tiêu chí Cambridge / CEFR</span>
              </div>
            </div>
          </div>

          {/* Cột phải: Các nút hành động */}
          <div className="flex items-center gap-2.5 sm:self-center flex-wrap">
            <button
              type="button"
              onClick={handleSaveCompetency}
              disabled={isSaved}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md active:scale-95 cursor-pointer ${
                isSaved
                  ? 'bg-emerald-500 text-white cursor-default shadow-emerald-500/20'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 hover:shadow-indigo-600/30'
              }`}
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Đã Lưu Vào Năng Lực</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-4 h-4" />
                  <span>Lưu Điểm Năng Lực</span>
                </>
              )}
            </button>

            {onRetake && (
              <button
                type="button"
                onClick={onRetake}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Viết Bài Khác</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. GRID 4 TIÊU CHÍ CEFR */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-indigo-500" />
            Chi Tiết 4 Tiêu Chí Chấm Điểm
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">Thang điểm 0 - 100</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {criteriaList.map((crit) => {
            const Icon = crit.icon;
            return (
              <motion.div
                key={crit.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border ${crit.borderStyle} shadow-sm flex flex-col justify-between`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-xl ${crit.badgeBg}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                          {crit.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{crit.sub}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-black text-slate-900 dark:text-white">
                        {crit.score}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">/100</span>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        Band {crit.cefr}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 rounded-full overflow-hidden mb-3 bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${crit.barColor}`}
                      style={{ width: `${Math.max(5, Math.min(100, crit.score))}%` }}
                    />
                  </div>

                  {/* Commentary */}
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {crit.feedback}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 3. ĐIỂM SÁNG & ĐIỂM CẦN CẢI THIỆN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Điểm sáng (Strengths) */}
        <div className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm mb-3">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Điểm Sáng Trong Bài Viết</span>
          </div>
          <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
            {result.strengths.map((s, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Điểm cần cải thiện (Improvements) */}
        <div className="p-5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 shadow-sm">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm mb-3">
            <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Đề Xuất Nâng Cấp & Cải Thiện</span>
          </div>
          <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
            {result.improvements.map((imp, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                <span>{imp}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 4. VISUAL INLINE DIFF VIEWER */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" />
            So Sánh Đối Chiếu & Đề Xuất Sửa Đổi
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">Chi tiết từng từ & câu</span>
        </div>

        <EssayDiffViewer
          diffSegments={result.diffSegments}
          originalEssay={originalEssay}
          fullRevisedEssay={result.fullRevisedEssay}
        />
      </div>

      {/* 5. ACTIONABLE COLLOCATIONS & CORRECTIONS LIST */}
      {actionableSegments.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Kho Cụm Từ & Điểm Cần Chú Ý ({actionableSegments.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Lưu nhanh các collocation học thuật vào Unified SRS hoặc ghi nhận bẫy lỗi sai
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {actionableSegments.map((seg, idx) => {
              const isCollocSaved = isCollocationSaved(seg.revisedText);
              const isErrSaved = isMistakeSaved(seg.originalText);

              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {seg.type === 'correction' ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300">
                          Sửa lỗi ngữ pháp
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                          Nâng cấp C1/C2
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 text-xs font-mono">
                        <span className="line-through text-rose-600 dark:text-rose-400 font-medium">
                          {seg.originalText}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {seg.revisedText || '(bỏ)'}
                        </span>
                      </div>
                    </div>
                    {(seg.reasonVi || seg.explanation) && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {seg.reasonVi || seg.explanation}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {seg.revisedText && isCollocationCandidate(seg) && (
                      <button
                        type="button"
                        onClick={() => handleSaveCollocation(seg)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isCollocSaved
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm active:scale-95'
                        }`}
                        title="Lưu cụm từ đề xuất vào Collocation SRS"
                      >
                        {isCollocSaved ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Đã trong SRS</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Collocation SRS</span>
                          </>
                        )}
                      </button>
                    )}

                    {seg.originalText && (
                      <button
                        type="button"
                        onClick={() => handleSaveMistake(seg)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isErrSaved
                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                            : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm active:scale-95'
                        }`}
                        title="Ghi nhận lỗi vào Mistake Bank"
                      >
                        {isErrSaved ? (
                          <>
                            <BookmarkCheck className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                            <span>Đã lưu Mistake Bank</span>
                          </>
                        ) : (
                          <>
                            <Bookmark className="w-3.5 h-3.5" />
                            <span>+ Mistake Bank</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GEMINI KEY CONFIG MODAL */}
      <GeminiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
      />
    </div>
  );
};
