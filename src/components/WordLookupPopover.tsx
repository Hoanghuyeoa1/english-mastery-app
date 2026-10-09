import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Plus, Check, BookmarkCheck, X, Sparkles } from 'lucide-react';
import type { VocabWord } from '../types';
import { useAppStore } from '../store/useAppStore';
import { speakText } from '../services/speechService';

export interface WordLookupPopoverProps {
  wordData: VocabWord;
  anchorRect: DOMRect;
  onClose: () => void;
}

export const WordLookupPopover: React.FC<WordLookupPopoverProps> = ({
  wordData,
  anchorRect,
  onClose,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const { srsProgressMap, saveToSRS } = useAppStore();

  // Kiểm tra từ đã có trong tiến trình SRS chưa
  const srsEntry = srsProgressMap[wordData.id] || srsProgressMap[wordData.word.toLowerCase()];
  const isInSRS = justSaved || !!srsEntry || (wordData.srsLevel !== undefined && wordData.srsLevel > 0);
  const currentLevel = srsEntry?.srsLevel ?? wordData.srsLevel ?? 0;

  // Tính toán vị trí và bảo vệ tràn màn hình (Collision & Overflow Protection Engine)
  const position = useMemo(() => {
    if (typeof window === 'undefined') {
      return { top: 0, left: 0, showAbove: false, arrowOffset: 16, width: 340 };
    }

    const POPOVER_WIDTH = 340;
    const MARGIN = 12;
    const GAP = 8;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const width = Math.min(POPOVER_WIDTH, viewportWidth - MARGIN * 2);

    // Xác định chiều hiển thị: Nếu từ nằm ở nửa dưới hoặc khoảng trống dưới không đủ -> lật lên trên
    const isBottomHalf = anchorRect.top > viewportHeight / 2;
    const spaceBelow = viewportHeight - anchorRect.bottom;
    const showAbove = isBottomHalf || (spaceBelow < 240 && anchorRect.top > 160);

    const top = showAbove ? anchorRect.top - GAP : anchorRect.bottom + GAP;

    // Căn giữa theo từ được bấm và clamp trong phạm vi viewport
    let left = anchorRect.left + anchorRect.width / 2 - width / 2;
    if (left < MARGIN) {
      left = MARGIN;
    } else if (left + width > viewportWidth - MARGIN) {
      left = viewportWidth - width - MARGIN;
    }

    // Tọa độ mũi tên chỉ vào tâm từ
    const rawArrowCenter = anchorRect.left + anchorRect.width / 2 - left;
    const arrowOffset = Math.max(16, Math.min(width - 16, rawArrowCenter));

    return { top, left, showAbove, arrowOffset, width };
  }, [anchorRect]);

  // Đóng khi click outside hoặc bấm Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Xử lý phát âm
  const handlePlayAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSpeaking(true);
    speakText(wordData.word, 'en-US');
    setTimeout(() => setIsSpeaking(false), 800);
  };

  // Xử lý 1-click lưu vào SRS
  const handleSaveToSRS = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInSRS) return;
    saveToSRS(wordData, {
      contextSentence: wordData.exampleEn || wordData.example,
      source: 'reading',
      sources: ['reading'],
    });
    setJustSaved(true);
  };

  // Badge màu sắc cho từng loại từ (Part of Speech)
  const getPosBadgeClass = (pos?: string) => {
    const p = (pos || '').toLowerCase();
    if (p.includes('noun')) return 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800';
    if (p.includes('verb')) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    if (p.includes('adj')) return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    if (p.includes('adv')) return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  };

  const cefrLevel = wordData.cefr || wordData.level || 'B1';
  const phoneticDisplay = wordData.phonetic || wordData.ipa;

  return (
    <AnimatePresence>
      <motion.div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Chi tiết từ vựng ${wordData.word}`}
        initial={{ opacity: 0, scale: 0.94, y: position.showAbove ? 8 : -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          width: position.width,
          transform: position.showAbove ? 'translateY(-100%)' : 'none',
          zIndex: 9999,
        }}
        className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-700/80 p-4 text-left select-text pointer-events-auto"
      >
        {/* Caret Pointer Arrow */}
        <div
          style={{ left: position.arrowOffset }}
          className={`absolute w-3 h-3 bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-700/80 transform -translate-x-1/2 rotate-45 pointer-events-none ${
            position.showAbove
              ? 'bottom-[-6px] border-r border-b'
              : 'top-[-6px] border-l border-t'
          }`}
        />

        {/* Header: Word, Speaker, Badges, Close */}
        <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white capitalize">
                {wordData.word}
              </h4>

              {/* Nút loa phát âm TTS */}
              <button
                type="button"
                onClick={handlePlayAudio}
                title="Phát âm chuẩn (en-US)"
                className={`p-1.5 rounded-full transition-all duration-200 ${
                  isSpeaking
                    ? 'bg-indigo-600 text-white scale-110 shadow-sm'
                    : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 active:scale-95'
                }`}
              >
                <Volume2 className="w-4 h-4 stroke-[2.2]" />
              </button>
            </div>

            {/* Phonetic IPA */}
            {phoneticDisplay && (
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tracking-wide mt-0.5 block">
                {phoneticDisplay.startsWith('/') ? phoneticDisplay : `/${phoneticDisplay}/`}
              </span>
            )}
          </div>

          {/* Badges & Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            {wordData.pos && (
              <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border uppercase tracking-wider ${getPosBadgeClass(wordData.pos)}`}>
                {wordData.pos}
              </span>
            )}

            {cefrLevel && (
              <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80">
                {cefrLevel}
              </span>
            )}

            <button
              type="button"
              onClick={onClose}
              title="Đóng (Escape)"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body: Meaning & Context Example */}
        <div className="py-2.5 space-y-2">
          {/* Nghĩa tiếng Việt súc tích */}
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug">
              {wordData.meaning}
            </p>
          </div>

          {/* Câu ví dụ ngữ cảnh (nếu có) */}
          {(wordData.example || wordData.example_en) && (
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs">
              <p className="text-slate-700 dark:text-slate-300 italic font-serif leading-relaxed">
                "{wordData.example || wordData.example_en}"
              </p>
              {wordData.example_vi && (
                <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1">
                  {wordData.example_vi}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer: 1-Click SRS Action Button */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          {isInSRS ? (
            <div className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                {justSaved ? (
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                ) : (
                  <BookmarkCheck className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                )}
                {justSaved ? (
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">✓ Đã lưu vào Ôn tập SRS</span>
                ) : (
                  <span>Đang ôn tập (Lv.{currentLevel})</span>
                )}
              </span>

              <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                SM-2 Active
              </span>
            </div>
          ) : (
            <button
              type="button"
              data-testid="save-to-srs-btn"
              aria-label="Save to SRS"
              onClick={handleSaveToSRS}
              className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-500/20 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              + Lưu vào SRS (Save to SRS)
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
