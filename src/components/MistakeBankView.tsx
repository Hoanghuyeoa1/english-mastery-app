import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Volume2, 
  Mic, 
  Trash2, 
  RotateCcw, 
  Brain, 
  Sparkles, 
  Gamepad2, 
  Search, 
  ShieldAlert,
  Flame,
  Check,
  Filter,
  Layers,
  ArrowRight,
  TrendingDown
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { speakWord } from '../services/speechService';
import { MistakeRecord, ActiveTab } from '../types';
import { VoicePronunciationModal } from './VoicePronunciationModal';

interface MistakeBankViewProps {
  onNavigate?: (tab: ActiveTab) => void;
}

type FilterStatus = 'ALL' | 'UNRESOLVED' | 'RESOLVED';

export const MistakeBankView: React.FC<MistakeBankViewProps> = ({ onNavigate }) => {
  const { 
    mistakeBank, 
    removeMistake, 
    clearResolvedMistakes, 
    clearAllMistakes,
    recordMistakeCorrect,
    audioVoice, 
    audioSpeed 
  } = useAppStore();

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('UNRESOLVED');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWordForVoice, setSelectedWordForVoice] = useState<MistakeRecord | null>(null);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  const mistakeList = useMemo(() => {
    return Object.values(mistakeBank);
  }, [mistakeBank]);

  const unresolvedList = useMemo(() => {
    return mistakeList.filter((m) => !m.resolved);
  }, [mistakeList]);

  const resolvedList = useMemo(() => {
    return mistakeList.filter((m) => m.resolved);
  }, [mistakeList]);

  // Lọc theo từ khóa tìm kiếm và trạng thái
  const filteredList = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return mistakeList
      .filter((item) => {
        const matchesSearch = 
          !term || 
          item.word.toLowerCase().includes(term) || 
          (item.meaning && item.meaning.toLowerCase().includes(term));

        if (!matchesSearch) return false;

        if (filterStatus === 'UNRESOLVED') return !item.resolved;
        if (filterStatus === 'RESOLVED') return item.resolved;
        return true;
      })
      .sort((a, b) => {
        // Sắp xếp từ sai nhiều nhất lên trước
        if (b.mistakeCount !== a.mistakeCount) {
          return b.mistakeCount - a.mistakeCount;
        }
        return new Date(b.lastMistakeAt).getTime() - new Date(a.lastMistakeAt).getTime();
      });
  }, [mistakeList, searchTerm, filterStatus]);

  const handlePlayAudio = (text: string) => {
    speakWord(text, audioVoice, audioSpeed);
  };

  const getSourceLabel = (source?: MistakeRecord['source']) => {
    switch (source) {
      case 'srs_again':
        return { label: 'Flashcard SRS', color: 'text-red-400 bg-red-500/10 border-red-500/30' };
      case 'speed_match':
        return { label: 'Speed Match', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
      case 'scramble':
        return { label: 'Word Scramble', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' };
      case 'dictation':
        return { label: 'Dictation Mode', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' };
      case 'quiz':
        return { label: 'Classic Quiz', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
      case 'pronunciation':
        return { label: 'Phát Âm Mic', color: 'text-teal-400 bg-teal-500/10 border-teal-500/30' };
      default:
        return { label: 'Tự ghi nhận', color: 'text-slate-400 bg-slate-500/10 border-slate-500/30' };
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-fadeIn">
      
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-rose-950/30 to-slate-950 border border-rose-500/30 p-6 sm:p-8 shadow-2xl space-y-4">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-500/15 border border-rose-500/30 text-rose-400 rounded-full text-xs font-bold uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4" />
              <span>Sổ Tay Bẫy Lỗi Sai • Weak Words Deck</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              Kho Bẫy Lỗi & Từ Vựng Cần Cứu Hộ
            </h1>

            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Tự động lưu trữ các từ bạn bấm "Quên / Again" hoặc trả lời sai trong minigame. Trả lời đúng 2 lần liên tiếp để tự động giải cứu từ khỏi bẫy lỗi!
            </p>
          </div>

          {/* Quick Action Group */}
          <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
            {onNavigate && (
              <button
                onClick={() => onNavigate('flashcards')}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-xl shadow-rose-500/20 transition-all transform hover:scale-105"
              >
                <Brain className="w-4 h-4" />
                <span>Ôn Thẻ SRS Bộ Từ Sai</span>
              </button>
            )}

            {onNavigate && (
              <button
                onClick={() => onNavigate('arcade')}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold rounded-2xl text-xs transition-all"
              >
                <Gamepad2 className="w-4 h-4 text-amber-400" />
                <span>Luyện Đấu Trường Arcade</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80">
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
            <span className="text-[11px] text-slate-400 block font-medium">Tổng số từ ghi nhận</span>
            <strong className="text-xl sm:text-2xl font-black text-white">{mistakeList.length} từ</strong>
          </div>

          <div className="p-3.5 bg-slate-950/80 border border-rose-500/30 rounded-2xl">
            <span className="text-[11px] text-rose-300 block font-medium flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Đang cần khắc phục</span>
            </span>
            <strong className="text-xl sm:text-2xl font-black text-rose-400">{unresolvedList.length} từ</strong>
          </div>

          <div className="p-3.5 bg-slate-950/80 border border-emerald-500/30 rounded-2xl">
            <span className="text-[11px] text-emerald-300 block font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Đã khắc phục xong</span>
            </span>
            <strong className="text-xl sm:text-2xl font-black text-emerald-400">{resolvedList.length} từ</strong>
          </div>

          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
            <span className="text-[11px] text-slate-400 block font-medium">Tỷ lệ cứu hộ thành công</span>
            <strong className="text-xl sm:text-2xl font-black text-amber-400">
              {mistakeList.length > 0 ? Math.round((resolvedList.length / mistakeList.length) * 100) : 100}%
            </strong>
          </div>
        </div>
      </div>

      {/* 2. Filter Bar & Search */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Status Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {[
              { id: 'UNRESOLVED', label: `🚨 Cần khắc phục (${unresolvedList.length})` },
              { id: 'ALL', label: `📚 Tất cả (${mistakeList.length})` },
              { id: 'RESOLVED', label: `🎉 Đã sửa xong (${resolvedList.length})` },
            ].map((tab) => {
              const isSelected = filterStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id as FilterStatus)}
                  className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all border ${
                    isSelected
                      ? tab.id === 'UNRESOLVED'
                        ? 'bg-rose-500/20 border-rose-500/60 text-rose-300 shadow-md ring-1 ring-rose-500/30'
                        : tab.id === 'RESOLVED'
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-md ring-1 ring-emerald-500/30'
                        : 'bg-slate-800 border-slate-700 text-white shadow-md'
                      : 'bg-slate-850 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm từ vựng bẫy lỗi..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/60 transition-colors"
            />
          </div>
        </div>

        {/* Clean-up Actions */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800 flex-wrap gap-2">
          <span>
            Đang hiển thị <strong>{filteredList.length}</strong> từ bẫy lỗi
          </span>

          <div className="flex items-center gap-2">
            {resolvedList.length > 0 && (
              <button
                onClick={clearResolvedMistakes}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl font-semibold transition-all flex items-center gap-1 border border-slate-700"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Dọn dẹp từ đã sửa ({resolvedList.length})</span>
              </button>
            )}

            {mistakeList.length > 0 && (
              <button
                onClick={() => setIsConfirmClearOpen(true)}
                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-xl font-semibold transition-all flex items-center gap-1 border border-rose-500/30"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Xóa toàn bộ</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Mistakes Word Grid */}
      {filteredList.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center shadow-xl space-y-4">
          <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto border border-emerald-500/20">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-xl sm:text-2xl font-black text-white">
              {filterStatus === 'UNRESOLVED' 
                ? 'Tuyệt Vời! Không Có Từ Nào Đang Bị Lỗi 🎉' 
                : 'Không tìm thấy từ vựng nào trong danh mục này'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
              {filterStatus === 'UNRESOLVED' 
                ? 'Bạn đã giải cứu thành công mọi từ khó! Khi bạn bấm Quên hoặc làm sai minigame, các từ đó sẽ tự động xuất hiện tại đây.'
                : 'Thử tìm kiếm với từ khóa khác hoặc chuyển trạng thái lọc.'}
            </p>
          </div>

          {onNavigate && (
            <div className="pt-2">
              <button
                onClick={() => onNavigate('flashcards')}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold rounded-2xl text-xs sm:text-sm shadow-lg hover:scale-105 transition-all inline-flex items-center gap-2"
              >
                <Brain className="w-4 h-4" />
                <span>Tiếp Tục Học Từ Mới</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredList.map((item) => {
            const sourceInfo = getSourceLabel(item.source);
            const isResolved = !!item.resolved;

            return (
              <motion.div
                key={item.id || item.word}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`p-5 rounded-3xl border transition-all space-y-3.5 ${
                  isResolved
                    ? 'bg-slate-900/60 border-slate-800 opacity-75 hover:opacity-100'
                    : 'bg-slate-900 border-slate-800 hover:border-rose-500/50 shadow-xl'
                }`}
              >
                {/* Card Top: Word & Badges */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                        {item.word}
                      </h3>

                      {item.ipa && (
                        <span className="text-xs text-emerald-400 font-mono px-2 py-0.5 bg-slate-800 rounded-lg border border-slate-750">
                          {item.ipa}
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-semibold text-slate-200">
                      {item.meaning}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handlePlayAudio(item.word)}
                      title="Phát âm từ này"
                      className="p-2 bg-slate-800 hover:bg-emerald-500 text-slate-300 hover:text-slate-950 rounded-xl transition-all"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setSelectedWordForVoice(item)}
                      title="Kiểm tra phát âm qua Micro AI"
                      className="p-2 bg-slate-800 hover:bg-teal-500 text-slate-300 hover:text-slate-950 rounded-xl transition-all"
                    >
                      <Mic className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => removeMistake(item.id || item.word)}
                      title="Xóa khỏi sổ tay bẫy lỗi"
                      className="p-2 bg-slate-850 hover:bg-rose-500 text-slate-400 hover:text-white rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Example sentence if available */}
                {item.example && (
                  <p className="text-xs text-slate-400 italic bg-slate-950/60 p-3 rounded-2xl border border-slate-850">
                    "{item.example}"
                  </p>
                )}

                {/* Card Bottom: Progress & Stats */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                  
                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-rose-400" />
                      <span>Sai {item.mistakeCount} lần</span>
                    </span>

                    <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border ${sourceInfo.color}`}>
                      {sourceInfo.label}
                    </span>
                  </div>

                  {/* Mastery Indicator */}
                  <div className="flex items-center gap-2">
                    {isResolved ? (
                      <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-xl text-xs font-black flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Đã khắc phục 🎉</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => recordMistakeCorrect(item.id || item.word)}
                        title="Bấm để ghi nhận 1 lần ôn đúng"
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                      >
                        <span>Đúng: <strong>{item.consecutiveCorrect || 0}/2 lần</strong></span>
                      </button>
                    )}
                  </div>

                </div>

              </motion.div>
            );
          })}
        </div>
      )}

      {/* Voice Pronunciation Modal */}
      {selectedWordForVoice && (
        <VoicePronunciationModal
          isOpen={!!selectedWordForVoice}
          onClose={() => setSelectedWordForVoice(null)}
          targetText={selectedWordForVoice.word}
          ipa={selectedWordForVoice.ipa}
          meaning={selectedWordForVoice.meaning}
          example={selectedWordForVoice.example}
        />
      )}

      {/* Confirm Clear All Modal */}
      {isConfirmClearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-xl font-black text-white">Xác nhận xóa toàn bộ sổ tay?</h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Hành động này sẽ làm sạch danh sách tất cả các từ trong Sổ Tay Bẫy Lỗi. Bạn có chắc chắn không?
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setIsConfirmClearOpen(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-2xl text-xs transition-all"
              >
                Hủy bỏ
              </button>

              <button
                onClick={() => {
                  clearAllMistakes();
                  setIsConfirmClearOpen(false);
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl text-xs shadow-lg transition-all"
              >
                Xác nhận xóa sạch
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
