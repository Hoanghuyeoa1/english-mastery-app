import React, { useState } from 'react';
import { 
  Brain, 
  Layers, 
  Clock, 
  Calendar, 
  BookOpen, 
  PenTool, 
  RotateCcw, 
  TrendingUp, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { LearningDictionaryProfile } from '../../types';
import { getLearningStatusMeta } from '../../services/learningDictionaryService';

export interface YourLearningSectionProps {
  profile: LearningDictionaryProfile;
  onSaveToDeck?: () => void;
}

function formatFriendlyDate(dateStr?: string | null): string {
  if (!dateStr) return 'Chưa có';
  try {
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) return 'Chưa có';
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (Math.abs(diffMs) < 60 * 1000) return 'Vừa xong';
    if (diffDays === 0) return 'Hôm nay';
    if (diffDays === 1) return 'Ngày mai';
    if (diffDays === -1) return 'Hôm qua';
    if (diffDays > 1 && diffDays <= 7) return `Sau ${diffDays} ngày`;
    if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} ngày trước`;

    return target.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return 'Chưa có';
  }
}

export const YourLearningSection: React.FC<YourLearningSectionProps> = ({
  profile,
  onSaveToDeck,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const statusMeta = getLearningStatusMeta(profile.learningStatus);
  const { memory, contextUsage } = profile;
  const isNewWord = profile.learningStatus === 'new';

  const getStatusBadgeStyle = () => {
    switch (statusMeta.variant) {
      case 'success':
        return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300';
      case 'warning':
        return 'bg-amber-500/15 border-amber-500/30 text-amber-300';
      case 'danger':
        return 'bg-rose-500/15 border-rose-500/30 text-rose-300';
      case 'info':
        return 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300';
      case 'primary':
        return 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300';
      case 'default':
      default:
        return 'bg-slate-800 border-slate-700 text-slate-300';
    }
  };

  return (
    <div
      data-testid="your-learning-section"
      className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>Tiến Độ Học Tập & Ghi Nhớ</span>
              <span className="text-xs text-slate-400 font-normal hidden sm:inline">(Your Learning)</span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <span
            data-testid="learning-status-badge"
            className={`px-3 py-1 rounded-xl border text-xs font-bold uppercase tracking-wider ${getStatusBadgeStyle()}`}
          >
            {statusMeta.labelVi}
          </span>

          {/* Collapsible Toggle */}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
            aria-label="Toggle Your Learning details"
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Status Description */}
      <p className="text-xs text-slate-400 leading-relaxed">
        {statusMeta.description}
      </p>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="pt-2 space-y-4">
          {isNewWord ? (
            /* Empty State for New Unseen Words */
            <div
              data-testid="new-word-learning-state"
              className="p-4 bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Từ mới chưa đưa vào chu kỳ ôn tập</span>
                </div>
                <p className="text-xs text-slate-400">
                  Lưu từ vào Flashcard để kích hoạt thuật toán ghi nhớ thông minh (FSRS/SM-2).
                </p>
              </div>

              {onSaveToDeck && (
                <button
                  type="button"
                  onClick={onSaveToDeck}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow transition-all shrink-0"
                >
                  + Thêm vào Flashcard
                </button>
              )}
            </div>
          ) : (
            /* Active Learning Metrics Grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {/* Algorithm */}
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1">
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-cyan-400" />
                  <span>Thuật toán SRS:</span>
                </span>
                <p className="text-sm font-bold text-white">
                  {memory.algorithm === 'fsrs' ? 'FSRS-4.5' : 'SM-2'}
                </p>
              </div>

              {/* Retrievability (Only if FSRS and metric exists) */}
              {memory.algorithm === 'fsrs' && memory.retrievability !== null && (
                <div
                  data-testid="fsrs-retrievability"
                  className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1"
                >
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                    <span>Khả năng nhớ (R):</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-emerald-300">
                      {Math.round(memory.retrievability * 100)}%
                    </p>
                    <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full"
                        style={{ width: `${Math.min(100, Math.max(0, memory.retrievability * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Difficulty (Only if FSRS and metric exists) */}
              {memory.algorithm === 'fsrs' && memory.difficulty !== null && (
                <div
                  data-testid="fsrs-difficulty"
                  className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1"
                >
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-400" />
                    <span>Độ khó (D):</span>
                  </span>
                  <p className="text-sm font-bold text-amber-300">
                    {memory.difficulty.toFixed(1)} / 10
                  </p>
                </div>
              )}

              {/* SM-2 Repetition Level (Only if SM-2) */}
              {memory.algorithm === 'sm2' && (
                <div
                  data-testid="sm2-repetitions"
                  className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1"
                >
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                    <span>Lần nhớ liên tiếp:</span>
                  </span>
                  <p className="text-sm font-bold text-white">
                    {memory.srsLevel} lượt
                  </p>
                </div>
              )}

              {/* Canonical Lapses (FSRS or SM-2 failures/resets) */}
              {memory.lapsesCount > 0 ? (
                <div
                  data-testid="memory-lapses"
                  className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1"
                >
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                    <RotateCcw className="w-3 h-3 text-rose-400" />
                    <span>Lapses / Lần quên:</span>
                  </span>
                  <p className="text-sm font-bold text-rose-300">
                    {memory.lapsesCount} lần
                  </p>
                </div>
              ) : null}

              {/* Actual Lifetime "Again" Rating Count */}
              {memory.againCount !== null && memory.againCount > 0 ? (
                <div
                  data-testid="memory-again-count"
                  className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1"
                >
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                    <RotateCcw className="w-3 h-3 text-amber-400" />
                    <span>Đánh giá Again:</span>
                  </span>
                  <p className="text-sm font-bold text-amber-300">
                    {memory.againCount} lần
                  </p>
                </div>
              ) : null}

              {/* Last Review */}
              {memory.lastReviewedDate && (
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Ôn tập lần cuối:</span>
                  </span>
                  <p className="text-sm font-bold text-slate-200">
                    {formatFriendlyDate(memory.lastReviewedDate)}
                  </p>
                </div>
              )}

              {/* Next Review */}
              {memory.nextReviewDate && (
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-indigo-400" />
                    <span>Lần ôn tiếp theo:</span>
                  </span>
                  <p className={`text-sm font-bold ${memory.isDue ? 'text-amber-300' : 'text-slate-200'}`}>
                    {memory.isDue ? 'Hôm nay (Đến hạn)' : formatFriendlyDate(memory.nextReviewDate)}
                  </p>
                </div>
              )}

              {/* Reading Encounters */}
              {contextUsage.readingEncounters > 0 && (
                <div
                  data-testid="reading-encounters-count"
                  className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1"
                >
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-emerald-400" />
                    <span>Gặp trong bài đọc:</span>
                  </span>
                  <p className="text-sm font-bold text-emerald-300">
                    {contextUsage.readingEncounters} bài đọc
                  </p>
                </div>
              )}

              {/* Writing Usages */}
              {contextUsage.writingUsages > 0 && (
                <div
                  data-testid="writing-usages-count"
                  className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1"
                >
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                    <PenTool className="w-3 h-3 text-teal-400" />
                    <span>Dùng trong bài viết:</span>
                  </span>
                  <p className="text-sm font-bold text-teal-300">
                    {contextUsage.writingUsages} bài viết
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
