import React from 'react';
import {
  Award,
  Sparkles,
  Brain,
  RotateCw,
  Check,
  Pencil,
  Rocket,
  ArrowRight,
  Gamepad2,
} from 'lucide-react';
import type { ActiveTab, SRSReviewCard } from '../../types';

export interface SessionSummaryProps {
  totalWords: number;
  reviewedCount: number;
  ratingCounts: { again: number; hard: number; good: number; easy: number };
  observedRetention: number | null;
  hardestCards: SRSReviewCard[];
  srsAlgorithm: 'sm2' | 'fsrs';
  fsrsDesiredRetention: number;
  streak: number;
  newWordsLearnedCount: number;
  dailyNewLimit: number;
  selectedBatchSize: number;
  setSelectedBatchSize: (size: number) => void;
  isCustomBatchOpen: boolean;
  setIsCustomBatchOpen: (open: boolean) => void;
  customBatchInput: string;
  setCustomBatchInput: (val: string) => void;
  handleAddMoreWords: (count: number) => void;
  handleRestartSession: () => void;
  handleReviewDifficultCards: () => void;
  handleFinishSession: () => void;
  onNavigate?: (tab: ActiveTab) => void;
}

export const SessionSummary: React.FC<SessionSummaryProps> = React.memo(({
  totalWords,
  reviewedCount,
  ratingCounts,
  observedRetention,
  hardestCards,
  srsAlgorithm,
  fsrsDesiredRetention,
  streak,
  newWordsLearnedCount,
  dailyNewLimit,
  selectedBatchSize,
  setSelectedBatchSize,
  isCustomBatchOpen,
  setIsCustomBatchOpen,
  customBatchInput,
  setCustomBatchInput,
  handleAddMoreWords,
  handleRestartSession,
  handleReviewDifficultCards,
  handleFinishSession,
  onNavigate,
}) => {
  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-10 text-center shadow-2xl space-y-6 animate-fadeIn">
      {/* Icon + Header */}
      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 text-slate-950 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20 animate-bounce">
        <Award className="w-8 h-8 sm:w-10 sm:h-10 stroke-[2.5]" />
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-black uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Session Complete</span>
        </div>
        
        <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
          Tuyệt Vời! Bạn Đã Hoàn Thành Phiên Học!
        </h3>

        <p className="text-slate-400 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
          Tổng kết kết quả ghi nhớ và mức độ thành thạo của phiên vừa xong.
        </p>
      </div>

      {/* Primary Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 max-w-3xl mx-auto py-2">
        {/* Total Reviewed */}
        <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl">
          <span className="text-[11px] text-slate-400 block font-medium">Đã ôn luyện</span>
          <strong className="text-lg sm:text-xl font-black text-white">{reviewedCount} thẻ</strong>
        </div>

        {/* Again */}
        <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-2xl">
          <span className="text-[11px] text-rose-300 block font-medium">Again</span>
          <strong className="text-lg sm:text-xl font-black text-rose-400">{ratingCounts.again}</strong>
        </div>

        {/* Hard */}
        <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-2xl">
          <span className="text-[11px] text-amber-300 block font-medium">Hard</span>
          <strong className="text-lg sm:text-xl font-black text-amber-400">{ratingCounts.hard}</strong>
        </div>

        {/* Good */}
        <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl">
          <span className="text-[11px] text-emerald-300 block font-medium">Good</span>
          <strong className="text-lg sm:text-xl font-black text-emerald-400">{ratingCounts.good}</strong>
        </div>

        {/* Easy */}
        <div className="p-3 bg-cyan-950/30 border border-cyan-500/30 rounded-2xl col-span-2 sm:col-span-1">
          <span className="text-[11px] text-cyan-300 block font-medium">Easy</span>
          <strong className="text-lg sm:text-xl font-black text-cyan-400">{ratingCounts.easy}</strong>
        </div>
      </div>

      {/* Retention Rate & Algorithm Meta */}
      <div className="max-w-md mx-auto p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-300 font-semibold">Retention:</span>
          <span className="font-black text-sm text-emerald-400">
            {observedRetention !== null ? `${observedRetention}%` : '—'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {srsAlgorithm === 'fsrs' ? (
            <span className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg text-[11px] font-bold">
              FSRS (Mục tiêu: {Math.round(fsrsDesiredRetention * 100)}%)
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-[11px] font-bold">
              SM-2 Chuẩn
            </span>
          )}
        </div>
      </div>

      {/* Hardest Words Section */}
      <div className="max-w-2xl mx-auto text-left space-y-2.5 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs sm:text-sm font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <span>Hardest words</span>
            <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full text-[10px] text-slate-300 font-mono">
              {hardestCards.length}
            </span>
          </h4>
          <span className="text-[11px] text-slate-400">
            {hardestCards.length > 0 ? 'Dựa trên đánh giá Again / Hard' : 'Ghi nhớ hoàn hảo'}
          </span>
        </div>

        {hardestCards.length > 0 ? (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
            {hardestCards.map((card) => {
              const cardFsrs = card.fsrs;
              const title = card.primaryText || card.word || '';
              return (
                <div
                  key={card.id}
                  className="p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span className="font-black text-slate-200 truncate">{title}</span>
                    {card.partOfSpeech && (
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">({card.partOfSpeech})</span>
                    )}
                    <span className="text-slate-400 text-xs truncate max-w-[200px] sm:max-w-xs">{card.meaning}</span>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5">
                    {/* FSRS vs SM-2 Semantics: FSRS displays S / retrievability if present; SM-2 NEVER fakes them */}
                    {srsAlgorithm === 'fsrs' && cardFsrs ? (
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-900 border border-cyan-500/30 text-cyan-400 rounded font-mono font-bold">
                        S: {Math.round((cardFsrs.stability || 0) * 10) / 10}d
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-900 border border-slate-700 text-slate-400 rounded font-mono">
                        {card.tag || 'Từ vựng'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl text-center text-xs text-emerald-300 font-semibold">
            🌟 Không có từ khó trong phiên này! Bạn đã nhớ rất tốt tất cả các thẻ!
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-xl mx-auto w-full">
        {onNavigate && (
          <button
            type="button"
            data-testid="btn-next-action-today-hub"
            onClick={() => onNavigate('dashboard')}
            className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-xl shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 fill-slate-950" />
            <span>Tiếp tục nhiệm vụ Today Hub</span>
          </button>
        )}

        <button
          onClick={handleReviewDifficultCards}
          disabled={hardestCards.length === 0}
          className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
            hardestCards.length > 0
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 active:scale-95'
              : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-60'
          }`}
        >
          <RotateCw className="w-4 h-4" />
          <span>Review difficult cards</span>
        </button>

        <button
          onClick={handleFinishSession}
          className="w-full sm:w-auto px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>Finish</span>
        </button>
      </div>

      {/* Secondary Controls (Nạp thêm từ mới + Khác) */}
      <div className="pt-4 border-t border-slate-800/80 flex flex-col items-center gap-4 max-w-xl mx-auto w-full">
        {/* Bộ chọn số lượng nạp thêm */}
        <div className="flex items-center flex-wrap justify-center gap-2 p-1.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
          <span className="text-xs font-bold text-slate-400 pl-2 pr-1">Nạp thêm:</span>
          {[15, 30, 50].map((count) => {
            const isSelected = selectedBatchSize === count && !isCustomBatchOpen;
            return (
              <button
                key={count}
                onClick={() => {
                  setSelectedBatchSize(count);
                  setIsCustomBatchOpen(false);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                    : 'bg-slate-850 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-750'
                }`}
              >
                +{count} từ
              </button>
            );
          })}

          <button
            onClick={() => setIsCustomBatchOpen(true)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              isCustomBatchOpen
                ? 'bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                : 'bg-slate-850 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-750'
            }`}
          >
            <Pencil className="w-3 h-3" />
            <span>Tùy chỉnh</span>
          </button>

          {isCustomBatchOpen && (
            <div className="flex items-center gap-1 bg-slate-900 border border-cyan-500/50 rounded-xl px-2 py-0.5 animate-fadeIn">
              <input
                type="number"
                min="5"
                max="100"
                value={customBatchInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomBatchInput(val);
                  const num = parseInt(val, 10);
                  if (!isNaN(num) && num > 0) {
                    setSelectedBatchSize(Math.min(100, Math.max(1, num)));
                  }
                }}
                className="w-12 bg-transparent text-cyan-300 font-black text-center text-xs focus:outline-none"
                placeholder="25"
                autoFocus
              />
              <span className="text-[11px] text-slate-400">từ</span>
            </div>
          )}
        </div>

        {/* Nút nạp to */}
        <button
          onClick={() => handleAddMoreWords(selectedBatchSize)}
          className="w-full sm:w-auto min-w-[260px] px-7 py-3.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-xl shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-95"
        >
          <Rocket className="w-4 h-4 fill-slate-950" />
          <span>Nạp ngay +{selectedBatchSize} từ mới</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Hàng nút phụ */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            data-testid="btn-restart-session"
            onClick={handleRestartSession}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-bold rounded-xl border border-slate-700 transition-all text-xs flex items-center gap-2"
          >
            <RotateCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Ôn lại toàn bộ phiên</span>
          </button>

          {onNavigate && (
            <button
              onClick={() => onNavigate('arcade')}
              className="px-4 py-2.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 font-bold rounded-xl transition-all text-xs flex items-center gap-2"
            >
              <Gamepad2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Đấu Trường Arcade</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

SessionSummary.displayName = 'SessionSummary';
