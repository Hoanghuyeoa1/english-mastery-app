import React, { useState, useCallback, useMemo, useRef } from 'react';
import type { VocabWord } from '../types';
import { cleanWordToken, lookupContextWord, extractSentenceContext } from '../services/wordLookupService';
import { WordLookupPopover } from './WordLookupPopover';

export interface InteractiveReadingPassageProps {
  content: string;
  className?: string;
  onWordClick?: (word: string, vocabWord: VocabWord | null, rect: DOMRect) => void;
  /** When false (e.g. Assessment Mode), disables word clicking and popover lookup */
  allowDictionaryLookup?: boolean;
}

interface ActiveLookupState {
  token: string;
  tokenIndex: number;
  wordData: VocabWord;
  rect: DOMRect;
}

interface WordTokenProps {
  rawToken: string;
  tokenIndex: number;
  isSelected: boolean;
  onWordSelect: (token: string, rect: DOMRect, index: number) => void;
}

// Sub-component tối ưu hóa bằng React.memo: Chỉ re-render từ được chọn, không re-render toàn bộ đoạn văn
const WordTokenSpan = React.memo<WordTokenProps>(({
  rawToken,
  tokenIndex,
  isSelected,
  onWordSelect,
}) => {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const clean = cleanWordToken(rawToken);
  const isWord = clean.length > 0;

  const triggerSelect = (target: HTMLElement) => {
    if (!isWord) return;
    const rect = target.getBoundingClientRect();
    onWordSelect(rawToken, rect, tokenIndex);
  };

  // Xử lý Touch Events trên Smartphone tránh lỗi kích hoạt khi cuộn trang
  const handleTouchStart = (e: React.TouchEvent<HTMLSpanElement>) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLSpanElement>) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = Math.abs(touch.clientX - touchStartRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartRef.current.y);
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    // Chỉ coi là Tap nếu di chuyển < 8px và thời gian chạm < 350ms
    if (dx < 8 && dy < 8 && dt < 350) {
      e.preventDefault();
      triggerSelect(e.currentTarget);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    triggerSelect(e.currentTarget);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerSelect(e.currentTarget);
    }
  };

  if (!isWord) {
    return <span>{rawToken}</span>;
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      className={`inline-block transition-colors duration-150 cursor-pointer select-text focus:outline-hidden ${
        isSelected
          ? 'bg-amber-200/90 dark:bg-amber-600/50 text-amber-950 dark:text-amber-100 rounded-sm px-1 -mx-0.5 font-medium shadow-xs ring-2 ring-amber-400/50 dark:ring-amber-500/60'
          : 'text-slate-800 dark:text-slate-200 rounded-sm px-0.5 -mx-0.5 hover:bg-amber-100/90 dark:hover:bg-amber-900/40 hover:text-amber-900 dark:hover:text-amber-200'
      }`}
    >
      {rawToken}
    </span>
  );
});

WordTokenSpan.displayName = 'WordTokenSpan';

export const InteractiveReadingPassage: React.FC<InteractiveReadingPassageProps> = ({
  content,
  className = '',
  onWordClick,
  allowDictionaryLookup = true,
}) => {
  const [activeLookup, setActiveLookup] = useState<ActiveLookupState | null>(null);

  // Tách văn bản thành tokens (giữ nguyên khoảng trắng và ký tự xuống dòng \n)
  const tokens = useMemo(() => {
    if (!content) return [];
    // Phân tách bởi chuỗi khoảng trắng hoặc ký tự xuống dòng liên tiếp
    return content.split(/(\s+)/);
  }, [content]);

  // Callback chọn từ tối ưu với useCallback
  const handleWordSelect = useCallback((rawToken: string, rect: DOMRect, index: number) => {
    const clean = cleanWordToken(rawToken);
    if (!clean) return;

    const sentenceContext = extractSentenceContext(tokens, index);
    const vocabWord = lookupContextWord(rawToken);

    if (vocabWord) {
      const enrichedWord: VocabWord = {
        ...vocabWord,
        example: sentenceContext || vocabWord.example,
        exampleEn: sentenceContext || vocabWord.exampleEn || vocabWord.example,
        example_en: sentenceContext || vocabWord.example_en || vocabWord.example,
      };
      setActiveLookup({
        token: rawToken,
        tokenIndex: index,
        wordData: enrichedWord,
        rect,
      });
      onWordClick?.(rawToken, enrichedWord, rect);
    } else {
      // Cho phép tra cứu và lưu vào SRS ngay cả với từ chưa có trong từ điển tĩnh kèm ngữ cảnh câu đọc
      const fallbackWord: VocabWord = {
        id: `vocab_${clean}`,
        word: clean,
        ipa: `/${clean}/`,
        phonetic: `/${clean}/`,
        partOfSpeech: 'word',
        pos: 'word',
        meaning: `Từ trong bài đọc: "${clean}"`,
        example: sentenceContext || rawToken,
        exampleEn: sentenceContext || rawToken,
        example_en: sentenceContext || rawToken,
        tag: 'Daily',
        srsLevel: 0,
        interval: 0,
        easeFactor: 2.5,
        nextReviewDate: new Date().toISOString(),
      };
      setActiveLookup({
        token: rawToken,
        tokenIndex: index,
        wordData: fallbackWord,
        rect,
      });
      onWordClick?.(rawToken, fallbackWord, rect);
    }
  }, [tokens, onWordClick]);

  const handleClosePopover = useCallback(() => {
    setActiveLookup(null);
  }, []);

  // If dictionary lookup is disabled in Assessment Mode, render clean, non-assisted text
  if (!allowDictionaryLookup) {
    return (
      <div
        data-testid="reading-passage-assessment-mode"
        className={`relative whitespace-pre-wrap leading-relaxed font-sans text-base sm:text-lg select-text ${className}`}
      >
        {content}
      </div>
    );
  }

  return (
    <div className={`relative whitespace-pre-wrap leading-relaxed font-sans text-base sm:text-lg select-text ${className}`}>
      {tokens.map((token, idx) => {
        // Nếu là khoảng trắng thuần túy hoặc xuống dòng thì render text node thông thường
        if (/^\s+$/.test(token)) {
          return <React.Fragment key={idx}>{token}</React.Fragment>;
        }

        const isSelected = activeLookup?.tokenIndex === idx;

        return (
          <WordTokenSpan
            key={idx}
            rawToken={token}
            tokenIndex={idx}
            isSelected={isSelected}
            onWordSelect={handleWordSelect}
          />
        );
      })}

      {/* Popover hiển thị tra cứu nổi viewport-aware */}
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
