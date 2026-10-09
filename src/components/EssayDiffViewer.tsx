import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GitCompare, 
  FileCheck, 
  FileText, 
  AlertCircle, 
  Sparkles, 
  Copy, 
  Check, 
  X,
  ArrowRight,
  Info,
  Plus,
  Bookmark,
  BookmarkCheck
} from 'lucide-react';
import type { DiffSegment } from '../types';
import { reconstructOriginalText, reconstructRevisedText } from '../services/essayGradingService';
import { useAppStore } from '../store/useAppStore';
import {
  captureWritingCollocation,
  captureWritingMistake,
  normalizeCollocationKey,
  isCollocationCandidate,
} from '../services/fourSkillsLearningBridge';

export type DiffViewMode = 'interactive' | 'revised' | 'original';

export interface EssayDiffViewerProps {
  diffSegments: DiffSegment[];
  originalEssay?: string;
  fullRevisedEssay?: string;
  className?: string;
}

export const EssayDiffViewer: React.FC<EssayDiffViewerProps> = ({
  diffSegments,
  originalEssay,
  fullRevisedEssay,
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<DiffViewMode>('interactive');
  const [copied, setCopied] = useState(false);
  const [activeSegmentData, setActiveSegmentData] = useState<{
    segment: DiffSegment;
    rect: DOMRect;
  } | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);
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

  // Khôi phục đầy đủ văn bản theo 2 trạng thái
  const rawOriginal = useMemo(() => {
    return originalEssay || reconstructOriginalText(diffSegments);
  }, [originalEssay, diffSegments]);

  const rawRevised = useMemo(() => {
    return fullRevisedEssay || reconstructRevisedText(diffSegments);
  }, [fullRevisedEssay, diffSegments]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    let corrections = 0;
    let enhancements = 0;
    for (const seg of diffSegments) {
      if (seg.type === 'correction') corrections++;
      if (seg.type === 'enhancement') enhancements++;
    }
    const words = rawOriginal.trim() ? rawOriginal.trim().split(/\s+/).filter(Boolean).length : 0;
    return { corrections, enhancements, words };
  }, [diffSegments, rawOriginal]);

  // Xử lý sao chép
  const handleCopy = async () => {
    const textToCopy =
      viewMode === 'original'
        ? rawOriginal
        : rawRevised;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback nếu clipboard API bị hạn chế
      const el = document.createElement('textarea');
      el.value = textToCopy;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveCollocation = (segment: DiffSegment) => {
    if (!segment.revisedText) return;
    if (isCollocationSaved(segment.revisedText)) return;
    captureWritingCollocation({
      phrase: segment.revisedText,
      originalText: segment.originalText,
      meaning: segment.reasonVi || segment.explanation || `Collocation chuẩn thay cho "${segment.originalText}"`,
      usageContext: 'Writing Essay',
      exampleEn: rawRevised || rawOriginal,
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
      fullEssay: rawOriginal,
      mistakeBank,
      recordMistake,
    });
  };

  // Đóng Popover khi click ra ngoài hoặc cuộn trang
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActiveSegmentData(null);
      }
    };

    const handleScroll = () => {
      if (activeSegmentData) {
        setActiveSegmentData(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [activeSegmentData]);

  // Tính vị trí Popover bảo vệ tràn màn hình (Viewport Overflow Protection)
  const popoverPos = useMemo(() => {
    if (!activeSegmentData || typeof window === 'undefined') return null;

    const { rect } = activeSegmentData;
    const POPOVER_WIDTH = 340;
    const MARGIN = 12;
    const GAP = 10;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const width = Math.min(POPOVER_WIDTH, viewportWidth - MARGIN * 2);

    const isBottomHalf = rect.top > viewportHeight / 2;
    const spaceBelow = viewportHeight - rect.bottom;
    const showAbove = isBottomHalf || (spaceBelow < 220 && rect.top > 180);

    const top = showAbove
      ? Math.max(MARGIN, rect.top - GAP)
      : Math.min(viewportHeight - 200, rect.bottom + GAP);

    let left = rect.left + rect.width / 2 - width / 2;
    if (left < MARGIN) {
      left = MARGIN;
    } else if (left + width > viewportWidth - MARGIN) {
      left = viewportWidth - width - MARGIN;
    }

    return { top, left, width, showAbove };
  }, [activeSegmentData]);

  return (
    <div className={`w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col ${className}`}>
      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
        {/* 3 Chế độ xem */}
        <div className="inline-flex items-center p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setViewMode('interactive');
              setActiveSegmentData(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'interactive'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Interactive Diff</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setViewMode('revised');
              setActiveSegmentData(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'revised'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Clean Revised</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setViewMode('original');
              setActiveSegmentData(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'original'
                ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Original</span>
          </button>
        </div>

        {/* Quick Stats Pills & Copy Button */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Correction Pill */}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40">
            <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
            <span>{stats.corrections} lỗi cần sửa</span>
          </span>

          {/* Enhancement Pill */}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-900/40">
            <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
            <span>{stats.enhancements} điểm nâng cấp</span>
          </span>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            title="Sao chép văn bản bài viết"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-all cursor-pointer active:scale-95 shadow-sm"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Đã chép</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Sao chép</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* BODY CONTENT */}
      <div className="p-5 sm:p-6 min-h-[260px] text-base leading-relaxed">
        {/* Hướng dẫn ngắn cho Interactive Mode */}
        {viewMode === 'interactive' && (
          <div className="mb-4 flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
            <Info className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>
              💡 <strong>Mẹo:</strong> Nhấp hoặc rê chuột vào các đoạn <span className="text-rose-600 dark:text-rose-400 font-semibold underline decoration-rose-300">gạch đỏ</span> hoặc <span className="text-emerald-600 dark:text-emerald-400 font-semibold underline decoration-emerald-300">chữ xanh</span> để xem phân tích quy tắc ngữ pháp và từ vựng học thuật.
            </span>
          </div>
        )}

        {/* 1. INTERACTIVE DIFF MODE */}
        {viewMode === 'interactive' && (
          <div className="whitespace-pre-wrap font-sans text-slate-800 dark:text-slate-200 selection:bg-indigo-100 dark:selection:bg-indigo-950/60">
            {diffSegments.map((segment, idx) => {
              if (segment.type === 'unchanged') {
                return <span key={idx}>{segment.originalText}</span>;
              }

              const isCorrection = segment.type === 'correction';
              const isSelected = activeSegmentData?.segment === segment;

              return (
                <span
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setActiveSegmentData({ segment, rect });
                  }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setActiveSegmentData({ segment, rect });
                  }}
                  className={`inline-block my-0.5 mx-0.5 rounded-md transition-all cursor-pointer select-text border ${
                    isSelected ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900' : ''
                  } ${
                    isCorrection
                      ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50'
                      : 'border-emerald-300 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                  }`}
                >
                  {/* Chữ ban đầu bị gạch ngang */}
                  <span
                    className={`line-through px-1.5 py-0.5 rounded ${
                      isCorrection
                        ? 'text-rose-600 dark:text-rose-400 bg-rose-100/60 dark:bg-rose-900/40'
                        : 'text-amber-700 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-900/40'
                    }`}
                  >
                    {segment.originalText}
                  </span>

                  {/* Chữ đề xuất sửa đổi */}
                  {segment.revisedText && (
                    <span
                      className={`font-semibold px-1.5 py-0.5 rounded ml-0.5 ${
                        isCorrection
                          ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/50'
                          : 'text-indigo-700 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-900/50'
                      }`}
                    >
                      {segment.revisedText}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        )}

        {/* 2. CLEAN REVISED MODE */}
        {viewMode === 'revised' && (
          <div className="whitespace-pre-wrap font-sans text-slate-800 dark:text-slate-100 leading-relaxed">
            {rawRevised}
          </div>
        )}

        {/* 3. ORIGINAL MODE */}
        {viewMode === 'original' && (
          <div className="whitespace-pre-wrap font-sans text-slate-700 dark:text-slate-300 leading-relaxed">
            {rawOriginal}
          </div>
        )}
      </div>

      {/* FOOTER INFO BAR */}
      <div className="px-5 py-2.5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/40 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>Tổng số từ: <strong>{stats.words}</strong> từ</span>
        <span>
          Đang xem: <strong>{viewMode === 'interactive' ? 'Bản đối chiếu trực quan' : viewMode === 'revised' ? 'Bản hoàn thiện đề xuất' : 'Bản thảo gốc'}</strong>
        </span>
      </div>

      {/* INTERACTIVE POPOVER / TOOLTIP */}
      <AnimatePresence>
        {activeSegmentData && popoverPos && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: popoverPos.showAbove ? 8 : -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              top: popoverPos.top,
              left: popoverPos.left,
              width: popoverPos.width,
              transform: popoverPos.showAbove ? 'translateY(-100%)' : 'none',
              zIndex: 60,
            }}
            className="p-4 rounded-xl shadow-2xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 select-text"
          >
            {/* Header Tooltip */}
            <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                {activeSegmentData.segment.type === 'correction' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300">
                    <AlertCircle className="w-3 h-3 text-rose-500" />
                    Sửa lỗi ngữ pháp & chính tả
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300">
                    <Sparkles className="w-3 h-3 text-indigo-500" />
                    Nâng cấp từ vựng học thuật C1/C2
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setActiveSegmentData(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Đóng tooltip"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Before & After Comparison */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs mb-2.5 font-mono">
              <span className="line-through text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded font-medium">
                {activeSegmentData.segment.originalText}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                {activeSegmentData.segment.revisedText || '(bỏ đoạn này)'}
              </span>
            </div>

            {/* Explanation in Vietnamese */}
            <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 bg-indigo-50/50 dark:bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-100/60 dark:border-indigo-900/30">
              <p className="font-semibold text-indigo-900 dark:text-indigo-300 mb-0.5">Giải thích chi tiết:</p>
              <p>{activeSegmentData.segment.reasonVi || activeSegmentData.segment.explanation || 'Đề xuất cải thiện để câu văn tự nhiên và đạt chuẩn học thuật hơn.'}</p>
            </div>

            {/* Action buttons: Save Collocation & Record Mistake */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
              {activeSegmentData.segment.revisedText && isCollocationCandidate(activeSegmentData.segment) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveCollocation(activeSegmentData.segment);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isCollocationSaved(activeSegmentData.segment.revisedText)
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm active:scale-95'
                  }`}
                  title="Lưu cụm từ này vào Unified SRS để luyện tập định kỳ"
                >
                  {isCollocationSaved(activeSegmentData.segment.revisedText) ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Đã lưu Collocation SRS</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Collocation SRS</span>
                    </>
                  )}
                </button>
              )}

              {activeSegmentData.segment.originalText && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveMistake(activeSegmentData.segment);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isMistakeSaved(activeSegmentData.segment.originalText)
                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 active:scale-95'
                  }`}
                  title="Ghi nhận lỗi diễn đạt vào Mistake Bank để phân tích điểm yếu"
                >
                  {isMistakeSaved(activeSegmentData.segment.originalText) ? (
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
