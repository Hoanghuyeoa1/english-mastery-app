// src/components/toeic/ToeicPart1View.tsx
import React, { useState } from 'react';
import {
  ImageIcon,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Headphones,
} from 'lucide-react';
import { ToeicQuestion } from '../../types/toeic';
import {
  ToeicListeningEngineState,
  ListeningPlaybackPolicy,
} from '../../types/toeicListening';
import { ToeicListeningBar } from './ToeicListeningBar';

export interface ToeicPart1ViewProps {
  question: ToeicQuestion;
  questionNumber: number;
  selectedAnswer?: string;
  onSelectAnswer: (choice: string) => void;
  policy: ListeningPlaybackPolicy;
  engineState: ToeicListeningEngineState;
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
  onSeek: (ms: number) => void;
  onSetSpeed: (speed: number) => void;
  hasAnswered: boolean;
  revealedTranscript: boolean;
  onToggleTranscript: () => void;
  isRetryAllowed?: boolean;
  onRetry?: () => void;
}

export const ToeicPart1View: React.FC<ToeicPart1ViewProps> = ({
  question,
  questionNumber,
  selectedAnswer,
  onSelectAnswer,
  policy,
  engineState,
  onPlay,
  onPause,
  onRestart,
  onSeek,
  onSetSpeed,
  hasAnswered,
  revealedTranscript,
  onToggleTranscript,
  isRetryAllowed = false,
  onRetry,
}) => {
  const [imageError, setImageError] = useState(false);

  // Parse option texts from question.options if available
  // Options usually are ['A. ...', 'B. ...', 'C. ...', 'D. ...']
  const getOptionSpokenText = (letter: string, index: number) => {
    if (!question.options || !question.options[index]) return '';
    const raw = question.options[index];
    // Remove leading 'A. ' or '(A) ' if present
    return raw.replace(/^[A-D]\.\s*|^\([A-D]\)\s*/i, '').trim();
  };

  const choiceLetters = ['A', 'B', 'C', 'D'];
  const isPracticeMode = policy.mode === 'practice';
  // Chỉ tiết lộ văn bản các câu nghe trong Practice sau khi thí sinh đã chốt câu trả lời
  const canRevealSpokenChoices = isPracticeMode && hasAnswered;

  return (
    <div className="space-y-6">
      {/* Header Prompt */}
      <div className="space-y-1">
        <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
          Part 1: Photographs (Câu hỏi số {questionNumber})
        </h3>
        <p className="text-xs text-amber-400/90 font-medium">
          💡 Format TOEIC chuẩn: Quan sát bức ảnh, lắng nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất.
        </p>
      </div>

      {/* Shared Listening Control Bar */}
      <ToeicListeningBar
        engineState={engineState}
        policy={policy}
        onPlay={onPlay}
        onPause={onPause}
        onRestart={onRestart}
        onSeek={onSeek}
        onSetSpeed={onSetSpeed}
        onToggleTranscript={onToggleTranscript}
        isTranscriptVisible={revealedTranscript}
        partLabel="Part 1: Photographs"
        hasAnswered={hasAnswered}
      />

      {/* Transcript Box (Chỉ hiện khi policy.showTranscript === true và người dùng bật xem) */}
      {policy.showTranscript && revealedTranscript && (
        <div className="p-4 bg-cyan-950/30 border border-cyan-500/30 rounded-2xl text-xs text-cyan-200 space-y-2 animate-fade-in shadow-inner">
          <div className="flex items-center justify-between font-bold text-cyan-300">
            <span className="flex items-center gap-1.5">
              <Headphones className="w-3.5 h-3.5 text-cyan-400" />
              <span>Kịch Bản Audio (Transcript):</span>
            </span>
            <span className="text-[10px] text-cyan-400/80 font-normal">Chế độ Luyện Tập</span>
          </div>

          {/* Hiển thị phân đoạn có highlight nếu có timing */}
          {engineState.activeSegment ? (
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-white font-medium">
              <span className="text-[10px] font-bold text-amber-400 block uppercase tracking-wider mb-0.5">
                Đang phát:
              </span>
              <p>{engineState.activeSegment.text}</p>
            </div>
          ) : (
            <p className="italic font-serif leading-relaxed text-slate-200 whitespace-pre-line">
              "{question.audioScript || ''}"
            </p>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* PART 1 IMAGE (RESPONSIVE & ACCESSIBILITY GUARDED)                         */}
      {/* ========================================================================= */}
      {question.imageUrl ? (
        imageError ? (
          <div className="p-6 rounded-3xl border-2 border-dashed border-amber-500/40 bg-amber-950/20 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-200">
                Không thể tải ảnh minh họa trực tuyến (đang ngoại tuyến hoặc mạng chặn)
              </p>
              {/* BẢO MẬT PHÒNG THI: KHÔNG leak vietnameseTranslation trong Mock Exam trước khi trả lời */}
              {isPracticeMode && hasAnswered && question.vietnameseTranslation && (
                <p className="text-xs text-slate-300 italic max-w-md mx-auto">
                  Dịch nghĩa bức ảnh: "{question.vietnameseTranslation}"
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setImageError(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold rounded-xl border border-amber-500/30 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Thử tải lại ảnh</span>
            </button>
          </div>
        ) : (
          <div className="relative rounded-3xl overflow-hidden border-2 border-slate-750 bg-slate-950 shadow-2xl max-h-[380px] flex items-center justify-center group">
            {/*
              ACCESSIBILITY INVARIANT:
              Alt text KHÔNG ĐƯỢC CHỨA đáp án hoặc kịch bản nghe để tránh leak dữ liệu cho Screen Reader
            */}
            <img
              src={question.imageUrl}
              alt={`Hình ảnh câu hỏi số ${questionNumber} phần thi TOEIC Part 1 Photographs`}
              className="w-full h-auto max-h-[380px] object-contain rounded-2xl transition-transform duration-500 group-hover:scale-[1.02]"
              loading="eager"
              onError={() => setImageError(true)}
            />
            <div className="absolute top-3 left-3 px-3 py-1 bg-slate-950/80 backdrop-blur-md border border-slate-700/80 rounded-xl text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>Hình ảnh câu hỏi {questionNumber}</span>
            </div>
          </div>
        )
      ) : (
        <div className="w-full h-56 rounded-3xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 text-xs">
          <ImageIcon className="w-8 h-8 mr-2 opacity-40" />
          <span>Ảnh minh họa đề bài đang được tải...</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4 CHOICES (A, B, C, D) - TAP FRIENDLY & ACCESSIBLE                        */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
          Chọn phương án bạn nghe được:
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {choiceLetters.map((choiceLetter, idx) => {
            const isSelected = selectedAnswer === choiceLetter;
            const spokenText = getOptionSpokenText(choiceLetter, idx);

            return (
              <button
                key={choiceLetter}
                type="button"
                onClick={() => onSelectAnswer(choiceLetter)}
                className={`min-h-[56px] py-4 px-3 sm:py-5 rounded-2xl border text-center transition-all duration-150 flex flex-col items-center justify-center gap-1.5 shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 select-none ${
                  isSelected
                    ? 'bg-gradient-to-br from-amber-500 to-orange-500 border-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/25 scale-[1.02] ring-2 ring-amber-400'
                    : 'bg-slate-850 hover:bg-slate-800 border-slate-750 text-white hover:border-slate-600'
                }`}
                aria-label={`Phương án ${choiceLetter}${canRevealSpokenChoices && spokenText ? `: ${spokenText}` : ''}`}
                aria-pressed={isSelected}
              >
                <span className={`text-xl sm:text-2xl font-black ${isSelected ? 'text-slate-950' : 'text-amber-400'}`}>
                  ({choiceLetter})
                </span>

                <span className={`text-[11px] font-bold ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>
                  {isSelected ? 'Đã Chọn' : 'Bấm để chọn'}
                </span>

                {/* PRACTICE REVEAL: Chỉ hiện text sau khi người học đã chọn đáp án */}
                {canRevealSpokenChoices && spokenText && (
                  <span className={`text-[11px] leading-snug px-1 text-center font-normal mt-1 border-t pt-1 ${
                    isSelected ? 'text-slate-950 border-slate-950/20 font-medium' : 'text-slate-300 border-slate-750'
                  }`}>
                    {spokenText}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
