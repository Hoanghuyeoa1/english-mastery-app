import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Volume2, 
  Trash2, 
  BookOpen, 
  Sparkles,
  Layers,
  Star,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { speakWord } from '../services/speechService';
import { VocabTag } from '../types';

interface WordManagerProps {
  onOpenAddWord: () => void;
  onOpenBulkImport: () => void;
}

type ManagerFilterTag = 'ALL' | 'FAVORITE' | VocabTag;

const ITEMS_PER_PAGE = 30;

export const WordManager: React.FC<WordManagerProps> = ({ onOpenAddWord, onOpenBulkImport }) => {
  const { 
    vocabularyList, 
    deleteWord, 
    syncVocab5000, 
    audioVoice, 
    audioSpeed, 
    toggleFavorite 
  } = useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<ManagerFilterTag>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Lọc danh sách từ vựng theo từ khóa và Tag
  const filteredWords = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return vocabularyList.filter((word) => {
      const matchSearch = 
        !term ||
        word.word.toLowerCase().includes(term) ||
        (word.meaning && word.meaning.toLowerCase().includes(term)) ||
        (word.ipa && word.ipa.toLowerCase().includes(term));

      const matchTag = 
        selectedTag === 'ALL' 
          ? true 
          : selectedTag === 'FAVORITE' 
          ? !!word.isFavorite 
          : word.tag === selectedTag;

      return matchSearch && matchTag;
    });
  }, [vocabularyList, searchTerm, selectedTag]);

  // Reset về trang 1 khi lọc hoặc tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedTag]);

  // Tính toán Pagination
  const totalPages = Math.max(1, Math.ceil(filteredWords.length / ITEMS_PER_PAGE));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const displayedWords = useMemo(() => {
    const start = (validCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredWords.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredWords, validCurrentPage]);

  const handleManualSync = () => {
    const count = syncVocab5000();
    setSyncNotice(count > 0 ? `Đã đồng bộ thêm ${count} từ mới vào kho!` : `Kho từ vựng đã có đủ ${vocabularyList.length} từ!`);
    setTimeout(() => setSyncNotice(null), 3500);
  };

  const tags: ManagerFilterTag[] = ['ALL', 'FAVORITE', 'Tech', 'IELTS', 'TOEIC', 'Business', 'Academic', 'Daily', 'Idioms'];
  const favoriteCount = vocabularyList.filter((w) => w.isFavorite).length;

  // Tạo dải số trang hiển thị thông minh
  const paginationRange = useMemo(() => {
    const range: (number | string)[] = [];
    const delta = 2;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= validCurrentPage - delta && i <= validCurrentPage + delta)) {
        range.push(i);
      } else if (range[range.length - 1] !== '...') {
        range.push('...');
      }
    }

    return range;
  }, [totalPages, validCurrentPage]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      
      {/* Top Header & Action Buttons */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
            <BookOpen className="w-7 h-7 text-emerald-400" />
            <span>Kho Từ Vựng Toàn Diện ({vocabularyList.length} từ)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Siêu kho từ vựng chuẩn Oxford 5000, IELTS, TOEIC, Tech & Business • {favoriteCount} từ gắn sao ⭐
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 w-full sm:w-auto">
          <button
            onClick={handleManualSync}
            title="Đồng bộ nạp đầy đủ 5.000 từ vựng cốt lõi"
            className="flex items-center gap-1.5 px-3.5 py-3 bg-slate-800 hover:bg-slate-750 text-cyan-400 border border-slate-700 font-bold rounded-2xl transition-all text-xs sm:text-sm whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" />
            <span>Nạp 5.000 từ</span>
          </button>

          <button
            onClick={onOpenBulkImport}
            className="flex items-center gap-1.5 px-3.5 py-3 bg-slate-800 hover:bg-slate-750 text-emerald-400 border border-slate-700 font-bold rounded-2xl transition-all text-xs sm:text-sm whitespace-nowrap"
          >
            <Layers className="w-4 h-4" />
            <span>Nhập CSV</span>
          </button>

          <button
            onClick={onOpenAddWord}
            className="flex items-center gap-1.5 px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl shadow-lg shadow-emerald-500/20 transition-all text-xs sm:text-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Từ Mới</span>
          </button>
        </div>
      </div>

      {syncNotice && (
        <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>{syncNotice}</span>
        </div>
      )}

      {/* Search & Tag Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm siêu tốc trong 5.000 từ vựng theo từ, nghĩa, IPA..."
            className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTag(t)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                selectedTag === t
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {t === 'FAVORITE' && <Star className={`w-3.5 h-3.5 ${selectedTag === t ? 'fill-slate-950 text-slate-950' : 'text-amber-400 fill-amber-400'}`} />}
              <span>{t === 'ALL' ? 'Tất cả' : t === 'FAVORITE' ? `Yêu thích (${favoriteCount})` : t}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filter Status Bar */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-2">
        <span>
          Tìm thấy <strong className="text-emerald-400 font-bold">{filteredWords.length}</strong> từ vựng
          {selectedTag !== 'ALL' && <span> trong danh mục <strong>{selectedTag}</strong></span>}
        </span>
        <span>
          Trang <strong className="text-white">{validCurrentPage}</strong> / {totalPages} (30 từ/trang)
        </span>
      </div>

      {/* Vocabulary Grid Cards (Paginated) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedWords.map((word) => {
          const srsBadgeColor = 
            word.srsLevel >= 3 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : word.srsLevel > 0 
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
              : 'bg-blue-500/10 text-blue-400 border-blue-500/20';

          const srsText = 
            word.srsLevel >= 3 
              ? 'Đã thành thạo' 
              : word.srsLevel > 0 
              ? `Cấp ${word.srsLevel}` 
              : 'Từ mới';

          return (
            <div 
              key={word.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-lg flex flex-col justify-between space-y-4 transition-all"
            >
              <div className="space-y-2.5">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 bg-slate-800 text-teal-300 rounded-full border border-slate-700">
                      {word.tag}
                    </span>
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${srsBadgeColor}`}>
                      {srsText}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Star toggle button */}
                    <button
                      onClick={() => toggleFavorite(word.id)}
                      title={word.isFavorite ? 'Bỏ gắn sao' : 'Gắn sao yêu thích'}
                      className={`p-1.5 rounded-xl transition-all ${
                        word.isFavorite
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400'
                      }`}
                    >
                      <Star className={`w-4 h-4 ${word.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>

                    <button
                      onClick={() => speakWord(word.word, audioVoice, audioSpeed)}
                      title="Nghe phát âm"
                      className="p-1.5 bg-slate-800 hover:bg-emerald-500 text-slate-300 hover:text-slate-950 rounded-xl transition-all"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Bạn có chắc muốn xóa từ "${word.word}" không?`)) {
                          deleteWord(word.id);
                        }
                      }}
                      title="Xóa từ"
                      className="p-1.5 bg-slate-800 hover:bg-red-500 text-slate-400 hover:text-white rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <span>{word.word}</span>
                    {word.isFavorite && (
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0" />
                    )}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono text-emerald-400">{word.ipa}</span>
                    <span className="text-xs text-slate-500 italic">({word.partOfSpeech})</span>
                  </div>
                </div>

                <p className="text-sm font-semibold text-slate-200">
                  {word.meaning}
                </p>

                <div className="bg-slate-850 p-3 rounded-2xl border border-slate-800/80 space-y-1">
                  <p className="text-xs text-slate-300 italic">"{word.example}"</p>
                  <p className="text-[11px] text-slate-500">{word.exampleMeaning}</p>
                </div>
              </div>

              {/* Footer SRS stats */}
              <div className="flex justify-between items-center text-[11px] text-slate-500 pt-2 border-t border-slate-850">
                <span>Khoảng cách: {word.interval} ngày</span>
                <span>Hệ số Ease: {word.easeFactor}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {/* First Page */}
            <button
              onClick={() => setCurrentPage(1)}
              disabled={validCurrentPage === 1}
              className="p-2 bg-slate-800 hover:bg-slate-750 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 rounded-xl transition-all"
              title="Về trang đầu"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            {/* Prev Page */}
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={validCurrentPage === 1}
              className="p-2 bg-slate-800 hover:bg-slate-750 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 rounded-xl transition-all"
              title="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Page numbers */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
            {paginationRange.map((page, idx) => {
              if (page === '...') {
                return (
                  <span key={`ellipsis_${idx}`} className="px-2 py-1 text-slate-600 text-xs font-bold select-none">
                    ...
                  </span>
                );
              }

              const isCurrent = page === validCurrentPage;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page as number)}
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                    isCurrent
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
                      : 'bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white'
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Next Page */}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={validCurrentPage === totalPages}
              className="p-2 bg-slate-800 hover:bg-slate-750 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 rounded-xl transition-all"
              title="Trang sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Last Page */}
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={validCurrentPage === totalPages}
              className="p-2 bg-slate-800 hover:bg-slate-750 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 rounded-xl transition-all"
              title="Đến trang cuối"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
