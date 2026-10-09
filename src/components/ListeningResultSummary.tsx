import React, { useState } from 'react';
import {
  CheckCircle2,
  Trophy,
  Award,
  AlertCircle,
  RotateCcw,
  BookOpen,
  ArrowLeft,
  Check,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Volume2,
  Filter,
  Layers,
  HelpCircle,
} from 'lucide-react';
import type { ListeningResultModel, QuestionBreakdown } from '../services/listeningResultService';

export interface ListeningResultSummaryProps {
  result: ListeningResultModel;
  onReviewQuestions: () => void;
  onRetry: () => void;
  onBackToCatalog?: () => void;
  onReplayAudio?: () => void;
  onNavigateToTodayHub?: () => void;
  className?: string;
  isQuestionInSRS?: (questionId: string) => boolean;
  onSaveQuestionToSRS?: (question: QuestionBreakdown) => void;
}

export const ListeningResultSummary: React.FC<ListeningResultSummaryProps> = ({
  result,
  onReviewQuestions,
  onRetry,
  onBackToCatalog,
  onReplayAudio,
  onNavigateToTodayHub,
  className = '',
  isQuestionInSRS,
  onSaveQuestionToSRS,
}) => {
  const isExcellent = result.classification === 'Excellent';
  const isGood = result.classification === 'Good';

  // Question review filtering: 'all' vs 'mistakes-only'
  const [filterMode, setFilterMode] = useState<'all' | 'mistakes-only'>('all');

  // Track which question cards are expanded
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<Set<string>>(new Set());

  // Global toggle for all questions
  const areAllExpanded =
    result.questionBreakdowns.length > 0 &&
    result.questionBreakdowns.every((q) => expandedQuestionIds.has(q.id));

  const toggleAllExpanded = () => {
    if (areAllExpanded) {
      setExpandedQuestionIds(new Set());
    } else {
      setExpandedQuestionIds(new Set(result.questionBreakdowns.map((q) => q.id)));
    }
  };

  const toggleQuestionExpand = (id: string) => {
    setExpandedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandSpecificQuestion = (id: string) => {
    setExpandedQuestionIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // Filtered list of questions to display
  const displayedQuestions =
    filterMode === 'mistakes-only'
      ? result.questionBreakdowns.filter((q) => !q.isCorrect)
      : result.questionBreakdowns;

  return (
    <div
      className={`p-6 sm:p-8 bg-slate-900/95 border border-slate-800 rounded-3xl shadow-2xl relative overflow-hidden backdrop-blur-md space-y-7 animate-fadeIn ${className}`}
      data-testid="listening-result-summary"
    >
      {/* Background ambient lighting */}
      <div className="absolute -top-12 -right-12 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-56 h-56 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* =========================================================================
          1. RESULT: HEADER, TITLE, CEFR LEVEL & RULE-BASED FEEDBACK
          ========================================================================= */}
      <div className="space-y-4 relative z-10 border-b border-slate-800/80 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Đã hoàn thành kiểm tra độ hiểu bài!</span>
              </span>

              <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-black uppercase tracking-wider">
                CEFR {result.cefrLevel}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight pt-1">
              {result.lessonTitle}
            </h2>
          </div>

          {/* Classification Badge */}
          <div
            className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border text-xs sm:text-sm font-black shadow-md ${
              isExcellent
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-emerald-500/10'
                : isGood
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-cyan-500/10'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-amber-500/10'
            }`}
            data-testid="summary-classification-badge"
          >
            {isExcellent ? (
              <>
                <Trophy className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Xuất Sắc (Excellent)</span>
              </>
            ) : isGood ? (
              <>
                <Award className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Tốt (Good)</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Cần Luyện Thêm (Needs Practice)</span>
              </>
            )}
          </div>
        </div>

        {/* Rule-Based Feedback Banner (Deterministic, No Gemini API) */}
        {result.feedback && (
          <div
            className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
              isExcellent
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                : isGood
                ? 'bg-cyan-950/30 border-cyan-500/30 text-cyan-200'
                : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
            }`}
            data-testid="rule-based-feedback-banner"
          >
            <Sparkles className="w-5 h-5 shrink-0 mt-0.5 text-cyan-400" />
            <div className="space-y-1 text-xs sm:text-sm">
              <p className="font-bold text-white flex items-center gap-2">
                <span>{result.feedback.title}</span>
              </p>
              <p className="text-slate-300 leading-relaxed">{result.feedback.message}</p>
              {result.feedback.actionHint && (
                <p className="text-cyan-300 font-semibold text-xs pt-1 flex items-center gap-1.5">
                  <span>💡 Lời khuyên:</span>
                  <span>{result.feedback.actionHint}</span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          2. SCORE / ACCURACY: PRIMARY 4-METRIC GRID
          ========================================================================= */}
      <div className="space-y-2 relative z-10">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Chỉ số hiệu suất làm bài (Score & Accuracy)
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Accuracy & Score */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Độ Chính Xác</span>
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div
              className="text-2xl sm:text-3xl font-black text-cyan-300 font-mono tracking-tight"
              data-testid="summary-accuracy"
            >
              {result.accuracy}%
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-400 to-teal-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${result.accuracy}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400">Điểm số: {result.score}/100</p>
          </div>

          {/* Correct Answers */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Câu Trả Lời Đúng</span>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div
              className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight"
              data-testid="summary-correct"
            >
              {result.correctCount} / {result.totalQuestions}
            </div>
            <p className="text-[11px] text-slate-400">Chính xác tuyệt đối</p>
          </div>

          {/* Incorrect Answers */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Câu Trả Lời Sai</span>
              <X className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div
              className="text-2xl sm:text-3xl font-black text-rose-400 font-mono tracking-tight"
              data-testid="summary-incorrect"
            >
              {result.incorrectCount} / {result.totalQuestions}
            </div>
            <p className="text-[11px] text-slate-400">Đã lưu Mistake Bank</p>
          </div>

          {/* Total Questions */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Tổng Số Câu</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div
              className="text-2xl sm:text-3xl font-black text-slate-200 font-mono tracking-tight"
              data-testid="summary-total"
            >
              {result.totalQuestions}
            </div>
            <p className="text-[11px] text-slate-400">Độ hiểu bài nghe</p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. PERFORMANCE BREAKDOWN: QUESTION OUTCOME STRIP
          ========================================================================= */}
      {result.questionBreakdowns.length > 0 && (
        <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl space-y-3 relative z-10">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Phân bố kết quả ({result.questionBreakdowns.length} câu)</span>
            </h4>
            <span className="text-[11px] text-slate-500">Bấm câu hỏi để mở chi tiết bên dưới</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {result.questionBreakdowns.map((q) => (
              <button
                type="button"
                key={q.id}
                onClick={() => expandSpecificQuestion(q.id)}
                className={`flex items-center justify-between p-2.5 rounded-xl text-xs transition-all border text-left ${
                  q.isCorrect
                    ? 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50'
                    : 'bg-rose-500/10 border-rose-500/30 hover:border-rose-500/50'
                }`}
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="font-bold text-slate-200 shrink-0">Câu {q.questionIndex + 1}:</span>
                  <span className="text-slate-400 truncate">{q.questionText}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {q.type && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      {q.type}
                    </span>
                  )}
                  {q.isCorrect ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-[11px] border border-emerald-500/30">
                      <Check className="w-3 h-3 text-emerald-400" /> Đúng
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[11px] border border-rose-500/30">
                      <X className="w-3 h-3 text-rose-400" /> Sai
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          4. NEEDS REVIEW: MISTAKE HIGHLIGHT OR 100% PERFECT STATE
          ========================================================================= */}
      <div className="relative z-10" data-testid="needs-review-section">
        {result.incorrectCount > 0 ? (
          <div className="p-4 sm:p-5 bg-rose-950/20 border border-rose-500/30 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-rose-200">
                    Cần Ôn Tập (Needs Review): {result.incorrectCount} câu chưa chính xác
                  </h4>
                  <p className="text-xs text-rose-300/80">
                    Các câu cần xem lại:{' '}
                    <span className="font-bold text-rose-200">
                      {result.wrongQuestionIndexes.map((idx) => `Câu ${idx + 1}`).join(', ')}
                    </span>
                  </p>
                </div>
              </div>

              {/* Shortcut buttons to filter or jump */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setFilterMode('mistakes-only')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                    filterMode === 'mistakes-only'
                      ? 'bg-rose-500 text-white border-rose-400 shadow-md'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25'
                  }`}
                  data-testid="btn-filter-mistakes"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Chỉ xem câu sai ({result.incorrectCount})</span>
                </button>
                {filterMode === 'mistakes-only' && (
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className="px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all"
                  >
                    Xem tất cả ({result.totalQuestions})
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-emerald-300">
                Không có câu sai cần ôn tập! (No mistakes to review)
              </h4>
              <p className="text-xs text-emerald-400/80">
                Hoàn hảo! Bạn đã trả lời chính xác tất cả {result.totalQuestions} câu hỏi của bài nghe này.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          5. QUESTION REVIEW: ACCESSIBLE & COLLAPSIBLE QUESTION CARDS
          ========================================================================= */}
      {result.questionBreakdowns.length > 0 && (
        <div className="space-y-4 relative z-10 pt-2" data-testid="question-review-section">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-black text-white">
                Chi Tiết Từng Câu Hỏi & Giải Thích ({displayedQuestions.length} câu)
              </h3>
              {filterMode === 'mistakes-only' && (
                <span className="text-[11px] px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg font-semibold">
                  Đang lọc câu sai
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleAllExpanded}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700"
                data-testid="btn-toggle-all-explanations"
              >
                {areAllExpanded ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Thu gọn tất cả</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Mở rộng tất cả</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Question List */}
          <div className="space-y-3">
            {displayedQuestions.map((q) => {
              const isExpanded = expandedQuestionIds.has(q.id);

              return (
                <div
                  key={q.id}
                  className={`bg-slate-950/80 border rounded-2xl transition-all overflow-hidden ${
                    q.isCorrect ? 'border-slate-800 hover:border-slate-700' : 'border-rose-900/40 hover:border-rose-800/60'
                  }`}
                  data-testid={`question-card-${q.id}`}
                >
                  {/* Card Header: Clickable to toggle expand */}
                  <button
                    type="button"
                    onClick={() => toggleQuestionExpand(q.id)}
                    aria-expanded={isExpanded}
                    className="w-full p-4 flex items-start sm:items-center justify-between gap-3 text-left hover:bg-slate-900/40 transition-colors"
                  >
                    <div className="space-y-1.5 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-400">
                          Câu {q.questionIndex + 1}
                        </span>

                        {/* Accessible badge with icon & text */}
                        {q.isCorrect ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/30"
                            data-testid={`badge-correct-${q.id}`}
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Chính xác (Correct)</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-xs border border-rose-500/30"
                            data-testid={`badge-incorrect-${q.id}`}
                          >
                            <X className="w-3.5 h-3.5 text-rose-400" />
                            <span>Chưa đúng (Incorrect)</span>
                          </span>
                        )}

                        {q.type && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                            {q.type}
                          </span>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm font-bold text-white leading-snug">
                        {q.questionText}
                      </p>
                    </div>

                    <div className="shrink-0 p-1 rounded-lg bg-slate-900 text-slate-400">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Collapsible Content */}
                  {isExpanded && (
                    <div className="p-4 pt-2 border-t border-slate-900 space-y-3 bg-slate-900/30 animate-fadeIn">
                      {/* Your Answer */}
                      <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-400">Đáp án của bạn:</span>
                          {q.isCorrect ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Đúng
                            </span>
                          ) : (
                            <span className="text-rose-400 font-bold flex items-center gap-1">
                              <X className="w-3.5 h-3.5" /> Sai
                            </span>
                          )}
                        </div>
                        <p
                          className={`font-semibold ${
                            q.isCorrect ? 'text-emerald-300 font-bold' : 'text-rose-300'
                          }`}
                        >
                          {q.selectedOptionText ? q.selectedOptionText : '(Chưa chọn câu trả lời)'}
                        </p>
                      </div>

                      {/* Correct Answer (if different or for reference) */}
                      <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-400">Đáp án đúng:</span>
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Chuẩn
                          </span>
                        </div>
                        <p className="font-semibold text-emerald-300">
                          {q.correctOptionText || '(Không có thông tin)'}
                        </p>
                      </div>

                      {/* Explanation (Zero-crash safe fallback) */}
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1 text-xs">
                        <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                          <span>💡 Giải thích chi tiết:</span>
                        </span>
                        <p className="text-slate-300 leading-relaxed">
                          {q.explanation || 'Không có giải thích chi tiết cho câu hỏi này.'}
                        </p>
                      </div>

                      {/* SRS Actions if provided */}
                      {onSaveQuestionToSRS && isQuestionInSRS && (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs text-slate-400">Thêm vào bộ ôn tập Flashcard:</span>
                          {isQuestionInSRS(q.id) ? (
                            <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Đã có trong SRS
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSaveQuestionToSRS(q)}
                              className="text-xs font-bold text-cyan-300 hover:text-white flex items-center gap-1 bg-cyan-500/15 hover:bg-cyan-500/25 px-2.5 py-1 rounded-lg border border-cyan-500/30 transition-all"
                            >
                              <span>+ Lưu vào SRS</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          6. ACTIONS: REVIEW MISTAKES, LISTEN AGAIN, BACK TO LESSONS, REPLAY AUDIO
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 relative z-10 border-t border-slate-800/80">
        <div className="flex flex-wrap items-center gap-3">
          {/* Deep Question Review Button */}
          <button
            type="button"
            onClick={onReviewQuestions}
            className="px-6 py-3 bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-lg shadow-cyan-400/20 hover:scale-105 transition-all flex items-center justify-center gap-2"
            data-testid="btn-review-questions"
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>Xem Lại Chi Tiết & Giải Thích</span>
          </button>

          {/* Listen Again (Retry) Button */}
          <button
            type="button"
            onClick={onRetry}
            className="px-5 py-3 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 transition-all shadow-md"
            data-testid="btn-retry-quiz"
          >
            <RotateCcw className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Làm Lại Bài Kiểm Tra (Listen Again)</span>
          </button>

          {/* Replay Transcript Audio (Optional) */}
          {onReplayAudio && (
            <button
              type="button"
              onClick={onReplayAudio}
              className="px-4 py-3 bg-slate-800/60 hover:bg-slate-750 text-cyan-300 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700/60 transition-all"
              data-testid="btn-replay-audio"
            >
              <Volume2 className="w-4 h-4 shrink-0" />
              <span>Phát Lại Từ Đầu</span>
            </button>
          )}

          {/* Next Action to Today Hub */}
          {onNavigateToTodayHub && (
            <button
              type="button"
              onClick={onNavigateToTodayHub}
              className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all flex items-center justify-center gap-2 cursor-pointer"
              data-testid="btn-next-action-today-hub"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>Tiếp Tục Kế Hoạch Hôm Nay</span>
            </button>
          )}
        </div>

        {/* Back to Catalog */}
        {onBackToCatalog && (
          <button
            type="button"
            onClick={onBackToCatalog}
            className="text-xs text-slate-400 hover:text-white font-semibold flex items-center justify-center gap-1.5 transition-all py-2"
            data-testid="btn-back-to-catalog"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại kho bài nghe</span>
          </button>
        )}
      </div>
    </div>
  );
};
