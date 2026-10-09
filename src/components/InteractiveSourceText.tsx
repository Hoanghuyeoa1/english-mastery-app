// src/components/InteractiveSourceText.tsx
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Search, 
  BookmarkPlus, 
  Eye, 
  EyeOff, 
  Info,
  Check,
  X
} from 'lucide-react';
import type { CEFRLevel, VocabWord } from '../types';
import { 
  type TextAnalysisResult, 
  type TextToken, 
  type AnalyzedSpan, 
  type PhraseCategory 
} from '../services/textAnalysisService';
import { lookupContextWord, extractSentenceContext, cleanWordToken } from '../services/wordLookupService';
import { WordLookupPopover } from './WordLookupPopover';

export interface InteractiveSourceTextProps {
  sourceText: string;
  analysis: TextAnalysisResult;
  showCefrHighlight: boolean;
  onToggleCefrHighlight?: () => void;
  onSavePhraseToSRS?: (phrase: string, meaning?: string, note?: string) => void;
  className?: string;
}

interface ActiveLookupState {
  wordData: VocabWord;
  rect: DOMRect;
  span?: AnalyzedSpan;
}

interface SelectionToolbarState {
  text: string;
  rect: DOMRect;
}

// Subtle, accessible CEFR color tokens (dark-mode first, non-rainbow, layout-stable)
const CEFR_STYLE_MAP: Record<CEFRLevel, { bg: string; text: string; border: string; badge: string }> = {
  A1: {
    bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
    text: 'text-emerald-300',
    border: 'border-b-2 border-emerald-500/50',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  A2: {
    bg: 'bg-teal-500/10 hover:bg-teal-500/20',
    text: 'text-teal-300',
    border: 'border-b-2 border-teal-500/50',
    badge: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
  },
  B1: {
    bg: 'bg-sky-500/10 hover:bg-sky-500/20',
    text: 'text-sky-300',
    border: 'border-b-2 border-sky-500/50',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  B2: {
    bg: 'bg-indigo-500/10 hover:bg-indigo-500/20',
    text: 'text-indigo-300',
    border: 'border-b-2 border-indigo-500/50',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  },
  C1: {
    bg: 'bg-purple-500/10 hover:bg-purple-500/20',
    text: 'text-purple-300',
    border: 'border-b-2 border-purple-500/50',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
  C2: {
    bg: 'bg-rose-500/10 hover:bg-rose-500/20',
    text: 'text-rose-300',
    border: 'border-b-2 border-rose-500/50',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
};

const CATEGORY_STYLE_MAP: Record<PhraseCategory, { border: string; bg: string; text: string; label: string }> = {
  phrasal_verb: {
    border: 'border-b-2 border-amber-400/70',
    bg: 'bg-amber-500/15 hover:bg-amber-500/25',
    text: 'text-amber-200',
    label: 'Cụm động từ (Phrasal Verb)',
  },
  idiom: {
    border: 'border-b-2 border-pink-400/70',
    bg: 'bg-pink-500/15 hover:bg-pink-500/25',
    text: 'text-pink-200',
    label: 'Thành ngữ (Idiom)',
  },
  it_term: {
    border: 'border-b-2 border-cyan-400/70',
    bg: 'bg-cyan-500/15 hover:bg-cyan-500/25',
    text: 'text-cyan-200',
    label: 'Thuật ngữ IT / Tech',
  },
  academic: {
    border: 'border-b-2 border-emerald-400/70',
    bg: 'bg-emerald-500/15 hover:bg-emerald-500/25',
    text: 'text-emerald-200',
    label: 'Từ vựng học thuật (AWL)',
  },
  grammar_pattern: {
    border: 'border-b-2 border-dashed border-violet-400/80',
    bg: 'bg-violet-500/15 hover:bg-violet-500/25',
    text: 'text-violet-200',
    label: 'Mẫu ngữ pháp',
  },
  collocation: {
    border: 'border-b-2 border-teal-400/70',
    bg: 'bg-teal-500/15 hover:bg-teal-500/25',
    text: 'text-teal-200',
    label: 'Cụm từ liên kết (Collocation)',
  },
};

interface RenderSegment {
  type: 'plain' | 'token' | 'span';
  text: string;
  token?: TextToken;
  span?: AnalyzedSpan;
  start: number;
  end: number;
}

export const InteractiveSourceText: React.FC<InteractiveSourceTextProps> = ({
  sourceText,
  analysis,
  showCefrHighlight,
  onToggleCefrHighlight,
  onSavePhraseToSRS,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeLookup, setActiveLookup] = useState<ActiveLookupState | null>(null);
  const [selectionToolbar, setSelectionToolbar] = useState<SelectionToolbarState | null>(null);
  const [analyzedPhraseModal, setAnalyzedPhraseModal] = useState<AnalyzedSpan | null>(null);

  // Segment partitioning: Combine non-overlapping spans and un-spanned tokens sequentially
  const segments = useMemo<RenderSegment[]>(() => {
    if (!sourceText) return [];

    const spans = analysis.spans || [];
    const tokens = analysis.tokens || [];

    // Find tokens that do not overlap with any multi-word span
    const independentTokens = tokens.filter((tok) => {
      return !spans.some((sp) => Math.max(tok.start, sp.start) < Math.min(tok.end, sp.end));
    });

    // Unify all interactive entities
    type Entity = { type: 'span'; span: AnalyzedSpan; start: number; end: number } |
                  { type: 'token'; token: TextToken; start: number; end: number };

    const entities: Entity[] = [
      ...spans.map((span) => ({ type: 'span' as const, span, start: span.start, end: span.end })),
      ...independentTokens.map((token) => ({ type: 'token' as const, token, start: token.start, end: token.end })),
    ];

    entities.sort((a, b) => a.start - b.start);

    const result: RenderSegment[] = [];
    let cursor = 0;

    for (const ent of entities) {
      if (ent.start > cursor) {
        result.push({
          type: 'plain',
          text: sourceText.slice(cursor, ent.start),
          start: cursor,
          end: ent.start,
        });
      }

      if (ent.type === 'span') {
        result.push({
          type: 'span',
          text: sourceText.slice(ent.start, ent.end),
          span: ent.span,
          start: ent.start,
          end: ent.end,
        });
      } else {
        result.push({
          type: 'token',
          text: sourceText.slice(ent.start, ent.end),
          token: ent.token,
          start: ent.start,
          end: ent.end,
        });
      }

      cursor = ent.end;
    }

    if (cursor < sourceText.length) {
      result.push({
        type: 'plain',
        text: sourceText.slice(cursor),
        start: cursor,
        end: sourceText.length,
      });
    }

    return result;
  }, [sourceText, analysis.spans, analysis.tokens]);

  // Handle Token Click
  const handleTokenClick = useCallback((token: TextToken, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const clean = token.clean;
    if (!clean) return;

    const sentenceContext = extractSentenceContext(sourceText, token.raw);
    const existing = lookupContextWord(clean);

    if (existing) {
      const enriched: VocabWord = {
        ...existing,
        example: sentenceContext || existing.example,
        exampleEn: sentenceContext || existing.exampleEn || existing.example,
        example_en: sentenceContext || existing.example_en || existing.example,
      };
      setActiveLookup({ wordData: enriched, rect });
    } else {
      const fallback: VocabWord = {
        id: token.canonicalId || `vocab_${clean}`,
        word: token.lemma || clean,
        ipa: `/${clean}/`,
        phonetic: `/${clean}/`,
        partOfSpeech: token.partOfSpeech || 'word',
        pos: token.partOfSpeech || 'word',
        meaning: `Từ trong bản gốc: "${clean}"`,
        example: sentenceContext || token.raw,
        exampleEn: sentenceContext || token.raw,
        example_en: sentenceContext || token.raw,
        tag: token.isIT ? 'Tech' : (token.isAcademic ? 'Academic' : 'Daily'),
        level: token.cefr || undefined,
        srsLevel: 0,
        interval: 0,
        easeFactor: 2.5,
        nextReviewDate: new Date().toISOString(),
      };
      setActiveLookup({ wordData: fallback, rect });
    }
  }, [sourceText]);

  // Handle Multi-word Span Click
  const handleSpanClick = useCallback((span: AnalyzedSpan, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const clean = cleanWordToken(span.surface);
    const sentenceContext = extractSentenceContext(sourceText, span.surface);

    const spanWord: VocabWord = {
      id: `span_${clean.replace(/\s+/g, '_')}`,
      word: span.surface,
      ipa: `/${clean}/`,
      phonetic: `/${clean}/`,
      partOfSpeech: span.category,
      pos: span.category,
      meaning: span.meaning || `${CATEGORY_STYLE_MAP[span.category]?.label}: ${span.canonical}`,
      example: sentenceContext || sourceText,
      exampleEn: sentenceContext || sourceText,
      example_en: sentenceContext || sourceText,
      tag: span.category === 'it_term' ? 'Tech' : (span.category === 'academic' ? 'Academic' : 'Idioms'),
      level: span.cefr,
      srsLevel: 0,
      interval: 0,
      easeFactor: 2.5,
      nextReviewDate: new Date().toISOString(),
    };

    setActiveLookup({ wordData: spanWord, rect, span });
  }, [sourceText]);

  // Handle Text Selection (Mouseup / Touchend)
  const handleSelectionCheck = useCallback(() => {
    if (typeof window === 'undefined') return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setSelectionToolbar(null);
      return;
    }

    const text = sel.toString().trim();
    if (text.length < 2) {
      setSelectionToolbar(null);
      return;
    }

    // Verify selection is within container
    if (containerRef.current && containerRef.current.contains(sel.anchorNode)) {
      try {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          setSelectionToolbar({ text, rect });
        }
      } catch {
        // Safe fallback
      }
    }
  }, []);

  // Close Popover
  const handleClosePopover = useCallback(() => {
    setActiveLookup(null);
  }, []);

  // Quick Action: Tra cụm từ
  const handleToolbarLookup = useCallback(() => {
    if (!selectionToolbar) return;
    const clean = cleanWordToken(selectionToolbar.text);
    const sentenceContext = extractSentenceContext(sourceText, selectionToolbar.text);

    const customWord: VocabWord = {
      id: `sel_${clean.replace(/\s+/g, '_')}`,
      word: selectionToolbar.text,
      ipa: `/${clean}/`,
      phonetic: `/${clean}/`,
      partOfSpeech: 'phrase',
      pos: 'phrase',
      meaning: `Cụm từ đã chọn: "${selectionToolbar.text}"`,
      example: sentenceContext || sourceText,
      exampleEn: sentenceContext || sourceText,
      example_en: sentenceContext || sourceText,
      tag: 'Daily',
      srsLevel: 0,
      interval: 0,
      easeFactor: 2.5,
      nextReviewDate: new Date().toISOString(),
    };

    setActiveLookup({ wordData: customWord, rect: selectionToolbar.rect });
    setSelectionToolbar(null);
  }, [selectionToolbar, sourceText]);

  // Quick Action: Phân tích cụm từ
  const handleToolbarAnalyze = useCallback(() => {
    if (!selectionToolbar) return;
    const textLower = selectionToolbar.text.toLowerCase();
    
    // Check if matches any existing span in analysis
    const matchedSpan = analysis.allCandidates.find(
      (c) => c.surface.toLowerCase().includes(textLower) || textLower.includes(c.surface.toLowerCase())
    );

    if (matchedSpan) {
      setAnalyzedPhraseModal(matchedSpan);
    } else {
      setAnalyzedPhraseModal({
        id: `custom_${Date.now()}`,
        surface: selectionToolbar.text,
        canonical: selectionToolbar.text,
        start: 0,
        end: selectionToolbar.text.length,
        category: 'collocation',
        meaning: `Cụm từ liên kết trong câu: "${selectionToolbar.text}"`,
        note: 'Cụm từ được chọn thủ công bởi người học để phân tích và ghi nhớ.',
      });
    }
    setSelectionToolbar(null);
  }, [selectionToolbar, analysis.allCandidates]);

  // Quick Action: Lưu cụm từ vào Flashcard SRS
  const handleToolbarSave = useCallback(() => {
    if (!selectionToolbar) return;
    onSavePhraseToSRS?.(
      selectionToolbar.text,
      `Cụm từ trong bản dịch: "${selectionToolbar.text}"`,
      `Ngữ cảnh: "${sourceText.slice(0, 100)}..."`
    );
    setSelectionToolbar(null);
  }, [selectionToolbar, onSavePhraseToSRS, sourceText]);

  // Keyboard navigation & accessibility
  const handleKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>, callback: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      callback();
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 1. Header Toolbar with CEFR Toggle and Metric Chips */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-400">CHẾ ĐỘ TƯƠNG TÁC (INTERACTIVE)</span>

          {/* CEFR Level Color Toggle */}
          {onToggleCefrHighlight && (
            <button
              type="button"
              onClick={onToggleCefrHighlight}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-bold transition-all border cursor-pointer ${
                showCefrHighlight
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 shadow-xs'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title="Bật/Tắt tô màu các cấp độ CEFR (A1–C2)"
            >
              {showCefrHighlight ? <Eye className="w-3.5 h-3.5 text-teal-400" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>Tô màu CEFR</span>
            </button>
          )}
        </div>

        {/* Linguistic Summary Chips */}
        <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-400">
          <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800">
            {analysis.wordCount} từ
          </span>
          {analysis.phrasalVerbs.length > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 font-medium">
              {analysis.phrasalVerbs.length} cụm ĐT
            </span>
          )}
          {analysis.itVocabulary.length > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-medium">
              {analysis.itVocabulary.length} IT/Tech
            </span>
          )}
          {analysis.grammarPatterns.length > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/30 text-violet-300 font-medium">
              {analysis.grammarPatterns.length} ngữ pháp
            </span>
          )}
        </div>
      </div>

      {/* 2. Main Interactive Passage Container */}
      <div
        ref={containerRef}
        onMouseUp={handleSelectionCheck}
        onTouchEnd={handleSelectionCheck}
        className="relative whitespace-pre-wrap leading-relaxed font-sans text-sm sm:text-base text-slate-100 select-text min-h-[160px] p-2 rounded-2xl bg-slate-950/60 border border-slate-850"
      >
        {segments.map((seg, idx) => {
          if (seg.type === 'plain') {
            return <React.Fragment key={idx}>{seg.text}</React.Fragment>;
          }

          if (seg.type === 'span' && seg.span) {
            const span = seg.span;
            const style = CATEGORY_STYLE_MAP[span.category] || CATEGORY_STYLE_MAP.collocation;

            return (
              <span
                key={idx}
                role="button"
                tabIndex={0}
                onClick={(e) => handleSpanClick(span, e.currentTarget)}
                onKeyDown={(e) => handleKeyDown(e, () => handleSpanClick(span, e.currentTarget))}
                title={`${style.label}: ${span.meaning || span.canonical}`}
                className={`inline-block px-1 -mx-0.5 rounded-sm transition-all duration-150 cursor-pointer font-medium ${style.bg} ${style.text} ${style.border}`}
              >
                {seg.text}
              </span>
            );
          }

          if (seg.type === 'token' && seg.token) {
            const tok = seg.token;
            const cefr = tok.cefr;
            const cefrStyle = cefr && showCefrHighlight ? CEFR_STYLE_MAP[cefr] : null;

            return (
              <span
                key={idx}
                role="button"
                tabIndex={0}
                onClick={(e) => handleTokenClick(tok, e.currentTarget)}
                onKeyDown={(e) => handleKeyDown(e, () => handleTokenClick(tok, e.currentTarget))}
                title={cefr ? `CEFR ${cefr}: ${tok.lemma}` : `Tra từ: ${tok.clean}`}
                className={`inline-block rounded-sm transition-all duration-150 cursor-pointer ${
                  cefrStyle
                    ? `px-0.5 -mx-0.25 ${cefrStyle.bg} ${cefrStyle.text} ${cefrStyle.border} font-medium`
                    : 'text-slate-100 hover:text-teal-300 hover:bg-slate-800/80 px-0.5 -mx-0.5'
                }`}
              >
                {seg.text}
              </span>
            );
          }

          return null;
        })}
      </div>

      {/* 3. Floating Action Bar on Multi-word Selection */}
      {selectionToolbar && (
        <div
          role="toolbar"
          aria-label="Thanh công cụ xử lý cụm từ"
          style={{
            position: 'fixed',
            top: Math.max(12, selectionToolbar.rect.top - 46),
            left: Math.max(12, Math.min(window.innerWidth - 300, selectionToolbar.rect.left + selectionToolbar.rect.width / 2 - 140)),
            zIndex: 9998,
          }}
          className="bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl p-1.5 flex items-center gap-1 text-xs text-white backdrop-blur-md animate-fade-in"
        >
          <button
            type="button"
            onClick={handleToolbarLookup}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-slate-800 text-teal-300 font-bold transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Tra cứu</span>
          </button>

          <button
            type="button"
            onClick={handleToolbarAnalyze}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-slate-800 text-amber-300 font-bold transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Phân tích</span>
          </button>

          <button
            type="button"
            onClick={handleToolbarSave}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 font-bold border border-teal-500/40 transition-colors cursor-pointer"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>Lưu Flashcard</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectionToolbar(null)}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 ml-0.5 cursor-pointer"
            title="Đóng"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4. Analyzed Phrase Modal */}
      {analyzedPhraseModal && (
        <div 
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-left">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <span className="text-[11px] font-bold text-teal-400 uppercase tracking-wider block">
                  {CATEGORY_STYLE_MAP[analyzedPhraseModal.category]?.label || 'Phân Tích Cụm Từ'}
                </span>
                <h4 className="text-lg font-black text-white mt-0.5">
                  "{analyzedPhraseModal.surface}"
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setAnalyzedPhraseModal(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div>
                <span className="font-bold text-slate-400 block mb-0.5">Ý nghĩa / Chức năng:</span>
                <p className="text-sm font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
                  {analyzedPhraseModal.meaning || 'Chưa có chú thích nghĩa.'}
                </p>
              </div>

              {analyzedPhraseModal.note && (
                <div>
                  <span className="font-bold text-slate-400 block mb-0.5">Ghi chú ngữ cảnh:</span>
                  <p className="text-slate-300 italic bg-slate-850 p-2.5 rounded-xl border border-slate-800">
                    {analyzedPhraseModal.note}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  onSavePhraseToSRS?.(
                    analyzedPhraseModal.surface,
                    analyzedPhraseModal.meaning,
                    analyzedPhraseModal.note
                  );
                  setAnalyzedPhraseModal(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <BookmarkPlus className="w-4 h-4" />
                <span>+ Lưu vào Flashcard SRS (+15 XP)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Quick Word / Phrase Lookup Popover */}
      {activeLookup && (
        <WordLookupPopover
          wordData={activeLookup.wordData}
          anchorRect={activeLookup.rect}
          onClose={handleClosePopover}
        />
      )}
    </div>
  );
};
