import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Volume2,
  Brain,
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { speakWord } from '../services/speechService';
import { getSRSMasteryStatus, getSRSMasteryInfo, type SRSMasteryStatus } from '../services/srsAlgorithm';
import type { VocabWord, ActiveTab } from '../types';

interface MyVocabBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (tab: ActiveTab) => void;
}

type MemoryTier = 'all' | SRSMasteryStatus;

export const MyVocabBankModal: React.FC<MyVocabBankModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const { vocabularyList, audioVoice, audioSpeed } = useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTier, setSelectedTier] = useState<MemoryTier>('all');
  const [playingWord, setPlayingWord] = useState<string | null>(null);

  // Lấy toàn bộ từ người dùng đã từng nạp vào SRS (Single source of truth)
  const learnedWords = useMemo(() => {
    return vocabularyList.filter(
      (w) => (w.srsLevel && w.srsLevel > 0) || Boolean(w.lastReviewedDate) || Boolean(w.firstLearnedAt)
    );
  }, [vocabularyList]);

  // Phân loại mức độ ghi nhớ theo chuẩn hệ thống:
  // - "Đang học" (Learning): repetitions < 2 HOẶC interval < 3 ngày
  // - "Nhớ tạm thời" (Reviewing): repetitions từ 2 đến 4, HOẶC interval từ 3 đến dưới 21 ngày
  // - "Đã khắc sâu" (Mastered): repetitions >= 5 HOẶC interval >= 21 ngày
  const getMemoryTier = (w: VocabWord): SRSMasteryStatus => {
    return getSRSMasteryStatus({
      repetitions: w.srsLevel,
      srsLevel: w.srsLevel,
      interval: w.interval,
    });
  };

  // Thống kê số lượng từng nhóm
  const counts = useMemo(() => {
    let learning = 0;
    let reviewing = 0;
    let mastered = 0;
    learnedWords.forEach((w) => {
      const tier = getMemoryTier(w);
      if (tier === 'mastered') mastered++;
      else if (tier === 'reviewing') reviewing++;
      else learning++;
    });
    return { all: learnedWords.length, learning, reviewing, mastered };
  }, [learnedWords]);

  // Danh sách sau khi lọc và tìm kiếm
  const filteredWords = useMemo(() => {
    return learnedWords.filter((w) => {
      const matchTier =
        selectedTier === 'all' || getMemoryTier(w) === selectedTier;

      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        !q ||
        w.word.toLowerCase().includes(q) ||
        w.meaning.toLowerCase().includes(q) ||
        (w.phonetic && w.phonetic.toLowerCase().includes(q));

      return matchTier && matchSearch;
    });
  }, [learnedWords, selectedTier, searchTerm]);

  const handlePlayAudio = (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    setPlayingWord(word);
    speakWord(word, audioVoice, audioSpeed);
    setTimeout(() => {
      setPlayingWord(null);
    }, 1200);
  };

  const formatReviewDate = (isoDate?: string) => {
    if (!isoDate) return 'Chưa có lịch';
    const d = new Date(isoDate);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) return 'Hôm nay';
    if (d < now) return 'Đã đến hạn';

    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <span>Kho Từ Vựng Tích Lũy</span>
                <span className="text-xs px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-mono font-bold">
                  {counts.all} từ cốt lõi
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Toàn bộ vốn từ bạn đã nạp vào hệ thống Spaced Repetition (SRS)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Search & Filter Tabs */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm từ tiếng Anh hoặc nghĩa..."
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 outline-none transition-colors"
            />
          </div>

          {/* Tier Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedTier('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedTier === 'all'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              Tất cả ({counts.all})
            </button>

            <button
              onClick={() => setSelectedTier('learning')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                selectedTier === 'learning'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-800/80 text-amber-400/80 hover:text-amber-300'
              }`}
            >
              <span>Đang học</span>
              <span className="text-[10px] opacity-80 font-mono">({counts.learning})</span>
            </button>

            <button
              onClick={() => setSelectedTier('reviewing')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                selectedTier === 'reviewing'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'bg-slate-800/80 text-cyan-400/80 hover:text-cyan-300'
              }`}
            >
              <span>Nhớ tạm thời</span>
              <span className="text-[10px] opacity-80 font-mono">({counts.reviewing})</span>
            </button>

            <button
              onClick={() => setSelectedTier('mastered')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                selectedTier === 'mastered'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'bg-slate-800/80 text-emerald-400/80 hover:text-emerald-300'
              }`}
            >
              <span>Đã khắc sâu</span>
              <span className="text-[10px] opacity-80 font-mono">({counts.mastered})</span>
            </button>
          </div>

        </div>

        {/* Word List Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
          {learnedWords.length === 0 ? (
            // Empty State: Chưa có từ nào được nạp vào SRS
            <div className="py-16 text-center space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
                <Brain className="w-8 h-8 text-emerald-400/60" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Kho Từ Vựng Đang Trống
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Bạn chưa có từ vựng nào trong kho tích lũy. Hãy bắt đầu học với Thẻ SRS SM-2 để đưa những từ vựng đầu tiên vào bộ nhớ dài hạn!
                </p>
              </div>

              {onNavigate && (
                <button
                  onClick={() => {
                    onClose();
                    onNavigate('flashcards');
                  }}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl shadow-lg shadow-emerald-500/20 text-xs sm:text-sm transition-all inline-flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Bắt Đầu Học Thẻ SRS Ngay</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : filteredWords.length === 0 ? (
            // Empty filter result
            <div className="py-12 text-center text-slate-500 text-sm">
              Không tìm thấy từ vựng nào phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            // Grid / List of words
            filteredWords.map((w) => {
              const tier = getMemoryTier(w);
              const isPlaying = playingWord === w.word;

              return (
                <div
                  key={w.id}
                  className="p-3.5 sm:p-4 bg-slate-950/70 hover:bg-slate-850/60 border border-slate-800 hover:border-slate-700 rounded-2xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  {/* Word & Meaning */}
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      onClick={(e) => handlePlayAudio(e, w.word)}
                      className={`p-2.5 rounded-xl border transition-all shrink-0 mt-0.5 ${
                        isPlaying
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 scale-105'
                          : 'bg-slate-900 border-slate-800 text-slate-400 group-hover:text-emerald-400 group-hover:border-emerald-500/30'
                      }`}
                      title="Nghe phát âm"
                    >
                      <Volume2 className={`w-4 h-4 ${isPlaying ? 'animate-bounce' : ''}`} />
                    </button>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base sm:text-lg font-black text-white tracking-wide">
                          {w.word}
                        </span>
                        {w.phonetic && (
                          <span className="text-xs text-slate-400 font-mono">
                            /{w.phonetic.replace(/^\/|\/$/g, '')}/
                          </span>
                        )}
                        {w.level && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded border border-slate-700">
                            {w.level}
                          </span>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm text-slate-300 font-medium line-clamp-2">
                        {w.meaning}
                      </p>
                    </div>
                  </div>

                  {/* SRS Status Badges & Review Schedule */}
                  <div className="flex items-center gap-2 sm:gap-4 shrink-0 justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-850">
                    
                    {/* Memory Tier Badge */}
                    {(() => {
                      const info = getSRSMasteryInfo(tier);
                      return (
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border flex items-center gap-1 ${info.badgeColor}`}>
                          <span>{info.emoji}</span>
                          <span>{info.label}</span>
                        </span>
                      );
                    })()}

                    {/* Next review schedule */}
                    <div className="text-right text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{formatReviewDate(w.nextReviewDate)}</span>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>
            Hiển thị <strong className="text-white">{filteredWords.length}</strong> / {learnedWords.length} từ đã học
          </span>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
