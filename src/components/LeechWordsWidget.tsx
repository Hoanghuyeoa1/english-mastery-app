// src/components/LeechWordsWidget.tsx
// Widget hiển thị danh sách từ khó / hay quên (Leech Detection) trên Dashboard.
// Minh bạch, trực quan với giải thích chi tiết điểm số và nguyên nhân gắn cờ.

import React, { useMemo, useState } from 'react';
import { 
  AlertTriangle, 
  Volume2, 
  Brain, 
  ShieldAlert, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Flame 
} from 'lucide-react';
import { VocabWord, SRSProgress, ActiveTab } from '../types';
import { detectDeckLeeches, LeechWordItem } from '../services/leechDetector';
import { speakWord } from '../services/speechService';

export interface LeechWordsWidgetProps {
  vocabularyList: VocabWord[];
  srsProgressMap?: Record<string, SRSProgress>;
  onNavigate: (tab: ActiveTab) => void;
}

export const LeechWordsWidget: React.FC<LeechWordsWidgetProps> = ({
  vocabularyList,
  srsProgressMap,
  onNavigate,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [playingWordId, setPlayingWordId] = useState<string | null>(null);

  // Scan and identify top leech words
  const leeches: LeechWordItem[] = useMemo(() => {
    return detectDeckLeeches(vocabularyList, srsProgressMap, 10);
  }, [vocabularyList, srsProgressMap]);

  const handleSpeak = (wordText: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPlayingWordId(id);
    speakWord(wordText);
    setTimeout(() => {
      setPlayingWordId(null);
    }, 1200);
  };

  // If no leeches found in the deck
  if (leeches.length === 0) {
    return (
      <div 
        data-testid="leech-widget-empty"
        className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 shadow-lg flex items-center justify-between gap-4 transition-all"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white">
                Trí nhớ vững vàng: Không có từ khó (Leech)
              </h3>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-bold uppercase">
                Tối ưu
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Hệ thống chưa phát hiện từ vựng nào bị lặp lại lỗi nhiều lần. Thuật toán SRS đang vận hành hiệu quả!
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('flashcards')}
          className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 shrink-0 transition-colors"
        >
          <Brain className="w-3.5 h-3.5 text-emerald-400" />
          <span>Ôn Flashcard</span>
        </button>
      </div>
    );
  }

  const displayedLeeches = isExpanded ? leeches : leeches.slice(0, 3);

  return (
    <div 
      data-testid="leech-widget"
      className="bg-gradient-to-r from-amber-950/30 via-slate-900 to-rose-950/30 border border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 animate-fadeIn"
    >
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-white">
                Phát hiện từ khó hay quên (Leech Cards)
              </h3>
              <span className="px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-full text-xs font-extrabold font-mono">
                {leeches.length} từ
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Những từ vựng có tỷ lệ quên cao hoặc độ khó lớn. Hãy tạo ghi nhớ liên tưởng hoặc phân tách câu mẫu để phá vỡ bế tắc!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            onClick={() => onNavigate('mistakes')}
            className="px-3.5 py-2 bg-rose-600/90 hover:bg-rose-500 text-white font-bold rounded-xl text-xs shadow transition-all flex items-center gap-1.5"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Sổ Bẫy Lỗi</span>
          </button>
          <button
            onClick={() => onNavigate('flashcards')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5"
          >
            <Brain className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ôn Tập Ngay</span>
          </button>
        </div>
      </div>

      {/* Leech Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {displayedLeeches.map((item) => (
          <div
            key={item.id}
            className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-amber-500/40 transition-all space-y-3"
          >
            <div>
              {/* Word Title & Pronunciation */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-extrabold text-white">
                      {item.word}
                    </h4>
                    {item.tag && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                        {item.tag}
                      </span>
                    )}
                  </div>
                  {item.ipa && (
                    <span className="text-xs text-amber-400/90 font-mono">
                      /{item.ipa}/
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleSpeak(item.word, item.id, e)}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      playingWordId === item.id
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
                    }`}
                    title="Phát âm từ vựng"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                  <span 
                    title={`Điểm Leech: ${item.analysis.score}/100`}
                    className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono"
                  >
                    {item.analysis.score} pts
                  </span>
                </div>
              </div>

              {/* Meaning */}
              <p className="text-xs text-slate-300 font-medium mt-1 line-clamp-1">
                {item.meaning}
              </p>
            </div>

            {/* Explainable Diagnostic Reasons */}
            <div className="space-y-1 pt-2 border-t border-slate-850">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>Nguyên nhân cảnh báo:</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {item.analysis.reasons.map((reason, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-medium bg-slate-900 text-slate-300 px-2 py-0.5 rounded-md border border-slate-800"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Expand / Collapse Control if more than 3 leeches */}
      {leeches.length > 3 && (
        <div className="flex justify-center pt-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors py-1 px-3 rounded-lg hover:bg-amber-500/10"
          >
            <span>{isExpanded ? 'Thu gọn danh sách' : `Xem thêm ${leeches.length - 3} từ khó khác`}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
};
