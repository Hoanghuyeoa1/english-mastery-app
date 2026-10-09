import React from 'react';
import {
  Brain,
  Sparkles,
  RefreshCw,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Settings,
  Star,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import type {
  CardTypeTab,
  QueueMode,
  FilterLevel,
  FilterTag,
} from '../../services/flashcardQueueService';

export interface FlashcardQueueFiltersProps {
  cardTypeTab: CardTypeTab;
  setCardTypeTab: (tab: CardTypeTab) => void;
  dueAllCount: number;
  dueSingleWordsCount: number;
  dueCollocationsCount: number;
  queueMode: QueueMode;
  setQueueMode: (mode: QueueMode) => void;
  totalDueReviewCount: number;
  srsAlgorithm: 'sm2' | 'fsrs';
  setSRSAlgorithm: (algo: 'sm2' | 'fsrs') => void;
  fsrsDesiredRetention: number;
  showToast: (msg: string) => void;
  newWordsLearnedCount: number;
  dailyNewLimit: number;
  isDailyNewGoalCompleted: boolean;
  handleCycleAudioSpeed: () => void;
  speedBadge: { label: string; icon: string; desc: string };
  autoPlayAudio: boolean;
  setAutoPlayAudio: (val: boolean) => void;
  isMaskExample: boolean;
  setIsMaskExample: (val: boolean) => void;
  setIsSettingsOpen: (open: boolean) => void;
  selectedLevel: FilterLevel;
  setSelectedLevel: (level: FilterLevel) => void;
  tagsList: FilterTag[];
  selectedTag: FilterTag;
  setSelectedTag: (tag: FilterTag) => void;
  getUnlearnedCountByTag: (tag: FilterTag) => number;
  getDueCountByTag: (tag: FilterTag) => number;
  favoriteCount: number;
  unresolvedMistakesCount: number;
  savedSentencesCount: number;
}

export const FlashcardQueueFilters: React.FC<FlashcardQueueFiltersProps> = React.memo(({
  cardTypeTab,
  setCardTypeTab,
  dueAllCount,
  dueSingleWordsCount,
  dueCollocationsCount,
  queueMode,
  setQueueMode,
  totalDueReviewCount,
  srsAlgorithm,
  setSRSAlgorithm,
  fsrsDesiredRetention,
  showToast,
  newWordsLearnedCount,
  dailyNewLimit,
  isDailyNewGoalCompleted,
  handleCycleAudioSpeed,
  speedBadge,
  autoPlayAudio,
  setAutoPlayAudio,
  isMaskExample,
  setIsMaskExample,
  setIsSettingsOpen,
  selectedLevel,
  setSelectedLevel,
  tagsList,
  selectedTag,
  setSelectedTag,
  getUnlearnedCountByTag,
  getDueCountByTag,
  favoriteCount,
  unresolvedMistakesCount,
  savedSentencesCount,
}) => {
  return (
    <>
      {/* 0. BỘ LỌC LOẠI THẺ (TABS FILTER): TẤT CẢ / TỪ ĐƠN / CỤM TỪ */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl overflow-x-auto no-scrollbar shadow-lg">
        <button
          onClick={() => setCardTypeTab('ALL')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all whitespace-nowrap cursor-pointer ${
            cardTypeTab === 'ALL'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>🌟</span>
          <span>Tất Cả Thẻ</span>
          {dueAllCount > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                cardTypeTab === 'ALL'
                  ? 'bg-slate-950/30 text-slate-950'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {dueAllCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setCardTypeTab('SINGLE_WORD')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all whitespace-nowrap cursor-pointer ${
            cardTypeTab === 'SINGLE_WORD'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>📖</span>
          <span>Từ Vựng Đơn</span>
          {dueSingleWordsCount > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                cardTypeTab === 'SINGLE_WORD'
                  ? 'bg-slate-950/30 text-slate-950'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {dueSingleWordsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setCardTypeTab('COLLOCATION')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all whitespace-nowrap cursor-pointer ${
            cardTypeTab === 'COLLOCATION'
              ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>🔗</span>
          <span>Cụm Từ & Thành Ngữ</span>
          {dueCollocationsCount > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                cardTypeTab === 'COLLOCATION'
                  ? 'bg-white/20 text-white'
                  : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
              }`}
            >
              {dueCollocationsCount} đến hạn
            </span>
          )}
        </button>
      </div>

      {/* 1. DUAL QUEUE SWITCHER: ÔN TẬP VS HỌC TỪ MỚI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Tab 1: Ôn Tập SRS (Due Review) */}
        <button
          onClick={() => {
            setQueueMode('DUE');
          }}
          className={`relative p-4 rounded-3xl border transition-all text-left flex items-center justify-between overflow-hidden ${
            queueMode === 'DUE'
              ? 'bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-slate-900 border-emerald-500 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/50'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850 opacity-80 hover:opacity-100'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                queueMode === 'DUE'
                  ? 'bg-emerald-400 text-slate-950 font-black shadow-lg shadow-emerald-400/30'
                  : 'bg-slate-800 text-emerald-400'
              }`}
            >
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-white">🔄 Hàng Đợi Ôn Tập</span>
                {totalDueReviewCount > 0 && (
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-bold animate-pulse">
                    Đến hạn
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Thuật toán lặp lại ngắt quãng {srsAlgorithm === 'fsrs' ? 'FSRS-4.5' : 'SM-2'}
              </p>
            </div>
          </div>

          <div className="text-right">
            <div
              className={`text-2xl font-black ${
                totalDueReviewCount > 0 ? 'text-emerald-400' : 'text-slate-500'
              }`}
            >
              {totalDueReviewCount}
            </div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Từ cần ôn
            </span>
          </div>
        </button>

        {/* Tab 2: Học Từ Mới (New Words) */}
        <button
          onClick={() => {
            setQueueMode('NEW');
          }}
          className={`relative p-4 rounded-3xl border transition-all text-left flex items-center justify-between overflow-hidden ${
            queueMode === 'NEW'
              ? 'bg-gradient-to-r from-teal-500/20 via-cyan-500/15 to-slate-900 border-cyan-500 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-500/50'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850 opacity-80 hover:opacity-100'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                queueMode === 'NEW'
                  ? 'bg-cyan-400 text-slate-950 font-black shadow-lg shadow-cyan-400/30'
                  : 'bg-slate-800 text-cyan-400'
              }`}
            >
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-white">✨ Học Từ Mới</span>
                {isDailyNewGoalCompleted && (
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-bold">
                    Đạt mục tiêu 🎉
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Hôm nay: {newWordsLearnedCount}/{dailyNewLimit} từ mới
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-black text-cyan-400">
              {newWordsLearnedCount}
              <span className="text-sm font-semibold text-slate-500">/{dailyNewLimit}</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Tiến độ ngày
            </span>
          </div>
        </button>
      </div>

      {/* 2. DAILY TARGET PROGRESS & ERGONOMIC TOGGLE TOOLBAR */}
      <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Daily Counters */}
          <div className="flex items-center gap-2.5 text-xs flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded-xl font-semibold">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">Cần ôn:</span>
              <strong className="text-emerald-400">{totalDueReviewCount} mục</strong>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded-xl font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">Từ mới hôm nay:</span>
              <strong className="text-cyan-400">
                {newWordsLearnedCount} / {dailyNewLimit}
              </strong>
            </div>
          </div>

          {/* Quick Ergonomic Toggles: Auto-play Audio & Mask Cloze & Settings */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* SRS Algorithm Indicator Pill & Toggle */}
            <button
              onClick={() => {
                const nextAlgo = srsAlgorithm === 'fsrs' ? 'sm2' : 'fsrs';
                setSRSAlgorithm(nextAlgo);
                showToast(
                  nextAlgo === 'fsrs'
                    ? `⚡ Đã kích hoạt thuật toán FSRS-4.5 (Mục tiêu nhớ: ${Math.round(
                        fsrsDesiredRetention * 100
                      )}%)`
                    : '🧠 Đã chuyển sang thuật toán SuperMemo SM-2 cổ điển'
                );
              }}
              title={`Thuật toán SRS hiện tại: ${
                srsAlgorithm === 'fsrs'
                  ? `FSRS-4.5 (Mục tiêu nhớ: ${Math.round(fsrsDesiredRetention * 100)}%)`
                  : 'SM-2 Cổ điển'
              }. Bấm để chuyển đổi nhanh.`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                srsAlgorithm === 'fsrs'
                  ? 'bg-gradient-to-r from-teal-500/20 to-emerald-500/20 border-teal-500/60 text-teal-300 shadow-sm hover:border-teal-400'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-teal-400" />
              <span>
                {srsAlgorithm === 'fsrs'
                  ? `⚡ FSRS ${Math.round(fsrsDesiredRetention * 100)}%`
                  : '🧠 SM-2 Classic'}
              </span>
            </button>

            {/* Audio Speed Selector Button */}
            <button
              onClick={handleCycleAudioSpeed}
              title={`Tốc độ đọc hiện tại: ${speedBadge.label} (${speedBadge.desc}). Bấm để đổi (Phím S).`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all border bg-slate-800 border-slate-700 text-amber-300 hover:border-amber-500/50 hover:bg-slate-750"
            >
              <span>{speedBadge.icon}</span>
              <span>Tốc độ: {speedBadge.label}</span>
            </button>

            {/* Auto-Play Audio Toggle */}
            <button
              onClick={() => setAutoPlayAudio(!autoPlayAudio)}
              title={`Tự động phát âm khi chuyển từ (${autoPlayAudio ? 'Đang BẬT' : 'Đang TẮT'})`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                autoPlayAudio
                  ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300 shadow-sm'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {autoPlayAudio ? (
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
              <span>Tự phát âm: {autoPlayAudio ? 'Bật' : 'Tắt'}</span>
            </button>

            {/* Masking Cloze Mode Toggle */}
            <button
              onClick={() => setIsMaskExample(!isMaskExample)}
              title={`Ẩn từ khóa trong câu ví dụ (${isMaskExample ? 'Đang BẬT' : 'Đang TẮT'}) - Phím tắt M`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                isMaskExample
                  ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 shadow-sm'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {isMaskExample ? (
                <EyeOff className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              <span>Che từ ví dụ</span>
            </button>

            {/* Daily Limit Settings */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              title="Thiết lập mục tiêu từ mới mỗi ngày"
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl transition-all"
            >
              <Settings className="w-3.5 h-3.5 text-emerald-400" />
            </button>
          </div>
        </div>

        {/* Dual Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[11px] text-slate-400 font-medium">
            <span>Tiến độ nạp từ mới hôm nay</span>
            <span className="font-bold text-white">
              {Math.min(100, Math.round((newWordsLearnedCount / Math.max(1, dailyNewLimit)) * 100))}%
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(
                  100,
                  (newWordsLearnedCount / Math.max(1, dailyNewLimit)) * 100
                )}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* 3. MULTI-LEVEL FILTER CONTROLS: CEFR & TOPICS */}
      <div className="space-y-2 bg-slate-900/60 border border-slate-800/80 p-3 rounded-2xl">
        {/* Level CEFR Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap pl-1 mr-1">
            Cấp độ CEFR:
          </span>
          {(['ALL', 'A1', 'A2', 'B1', 'B2', 'C1'] as FilterLevel[]).map((lvl) => {
            const isSelected = selectedLevel === lvl;
            const levelColor =
              lvl === 'A1' || lvl === 'A2'
                ? 'text-emerald-400'
                : lvl === 'B1' || lvl === 'B2'
                ? 'text-sky-400'
                : lvl === 'C1'
                ? 'text-purple-400'
                : 'text-slate-300';

            return (
              <button
                key={lvl}
                onClick={() => setSelectedLevel(lvl)}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                    : `bg-slate-800/80 hover:bg-slate-750 border border-slate-750 ${levelColor}`
                }`}
              >
                {lvl === 'ALL' ? 'Tất cả Level' : `Level ${lvl}`}
              </button>
            );
          })}
        </div>

        {/* Tags / Topics Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-slate-800/80">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap pl-1 mr-1">
            Chủ đề & Thẻ:
          </span>
          {tagsList.map((tag) => {
            const isSelected = selectedTag === tag;
            const unlearnedInThisTag = getUnlearnedCountByTag(tag);
            const dueInThisTag = getDueCountByTag(tag);

            let label: string = tag;
            if (tag === 'ALL') {
              label =
                queueMode === 'NEW'
                  ? `📚 Tất Cả (${unlearnedInThisTag})`
                  : `📚 Tất Cả (${dueInThisTag})`;
            } else if (tag === 'FAVORITE') {
              label = `⭐ Yêu Thích (${favoriteCount})`;
            } else if (tag === 'MISTAKES') {
              label = `🚨 Bẫy Lỗi (${unresolvedMistakesCount})`;
            } else if (tag === 'SAVED_SENTENCES') {
              label = `📝 Đoạn Dịch (${savedSentencesCount})`;
            } else {
              label =
                queueMode === 'NEW'
                  ? `${tag} (${unlearnedInThisTag})`
                  : `${tag} (${dueInThisTag})`;
            }

            return (
              <button
                key={tag}
                onClick={() => {
                  setSelectedTag(tag);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? tag === 'MISTAKES'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 font-bold shadow-sm'
                      : tag === 'SAVED_SENTENCES'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold shadow-sm'
                      : tag === 'FAVORITE'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold shadow-sm'
                      : 'bg-slate-700 text-emerald-400 border border-emerald-500/40 font-bold shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {tag === 'FAVORITE' && (
                  <Star
                    className={`w-3 h-3 ${
                      isSelected ? 'fill-amber-400 text-amber-400' : 'text-amber-400'
                    }`}
                  />
                )}
                {tag === 'MISTAKES' && <AlertTriangle className="w-3 h-3 text-rose-400" />}
                {tag === 'SAVED_SENTENCES' && <FileText className="w-3 h-3 text-cyan-400" />}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
});

FlashcardQueueFilters.displayName = 'FlashcardQueueFilters';
