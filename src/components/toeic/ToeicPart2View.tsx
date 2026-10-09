// src/components/toeic/ToeicPart2View.tsx
import React from 'react';
import {
  Volume2,
  Headphones,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { ToeicQuestion } from '../../types/toeic';
import {
  ToeicListeningEngineState,
  ListeningPlaybackPolicy,
} from '../../types/toeicListening';
import { ToeicListeningBar } from './ToeicListeningBar';

export interface ToeicPart2ViewProps {
  question: ToeicQuestion;
  questionNumber: number;
  selectedAnswer?: string;
  onSelectAnswer: (choice: string) => void;
  policy: ListeningPlaybackPolicy;
  engineState: ToeicListeningEngineState;
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
  onSetSpeed: (speed: number) => void;
  hasAnswered: boolean;
  revealedTranscript: boolean;
  onToggleTranscript: () => void;
}

export const ToeicPart2View: React.FC<ToeicPart2ViewProps> = ({
  question,
  questionNumber,
  selectedAnswer,
  onSelectAnswer,
  policy,
  engineState,
  onPlay,
  onPause,
  onRestart,
  onSetSpeed,
  hasAnswered,
  revealedTranscript,
  onToggleTranscript,
}) => {
  const isPracticeMode = policy.mode === 'practice';
  // CHỈ TIẾT LỘ NỘI DUNG VĂN BẢN (QUESTION & 3 OPTIONS) SAU KHI ĐÃ TRẢ LỜI TRONG PRACTICE MODE
  const canRevealSpokenText = isPracticeMode && hasAnswered;

  // Lấy danh sách 3 phương án A, B, C
  const choices = ['A', 'B', 'C'];

  // Trích xuất text cho từng phương án nếu có trong options
  const getOptionText = (choiceLetter: string, idx: number) => {
    if (!question.options || !question.options[idx]) return '';
    const raw = question.options[idx];
    return raw.replace(/^[A-C]\.\s*|^\([A-C]\)\s*/i, '').trim();
  };

  // Trích xuất câu hỏi nghe (được giấu trước khi trả lời)
  const getPromptSpokenText = () => {
    if (question.audioScript) {
      const match = question.audioScript.match(/(.*?)(?:\(A\)|A\.)/i);
      if (match && match[1].trim()) return match[1].trim();
    }
    return question.questionText || '';
  };

  return (
    <div className="space-y-6">
      {/* Header Prompt: Trong Mock/chưa trả lời, KHÔNG hiển thị văn bản câu hỏi nghe */}
      <div className="space-y-1">
        <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
          Part 2: Question & Response (Câu hỏi số {questionNumber})
        </h3>
        
        {canRevealSpokenText ? (
          <div className="p-3.5 bg-slate-850 border border-slate-750 rounded-2xl animate-fade-in space-y-1">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
              Văn bản câu hỏi đã nghe:
            </span>
            <p className="text-sm font-semibold text-white">
              "{getPromptSpokenText()}"
            </p>
          </div>
        ) : (
          <p className="text-xs text-amber-400/90 font-medium">
            💡 Format TOEIC chuẩn: Hãy lắng nghe câu hỏi và 3 câu phản hồi (A, B, C), sau đó click chọn phương án trả lời đúng nhất.
          </p>
        )}
      </div>

      {/* Shared Listening Control Bar */}
      <ToeicListeningBar
        engineState={engineState}
        policy={policy}
        onPlay={onPlay}
        onPause={onPause}
        onRestart={onRestart}
        onSetSpeed={onSetSpeed}
        onToggleTranscript={onToggleTranscript}
        isTranscriptVisible={revealedTranscript}
        partLabel="Part 2: Question & Response"
        hasAnswered={hasAnswered}
      />

      {/* Transcript Box (Chỉ hiện khi policy.showTranscript === true và bật xem) */}
      {policy.showTranscript && revealedTranscript && (
        <div className="p-4 bg-cyan-950/30 border border-cyan-500/30 rounded-2xl text-xs text-cyan-200 space-y-2 animate-fade-in shadow-inner">
          <div className="flex items-center justify-between font-bold text-cyan-300">
            <span className="flex items-center gap-1.5">
              <Headphones className="w-3.5 h-3.5 text-cyan-400" />
              <span>Kịch Bản Audio (Transcript):</span>
            </span>
            <span className="text-[10px] text-cyan-400/80 font-normal">Chế độ Luyện Tập</span>
          </div>

          <p className="italic font-serif leading-relaxed text-slate-200 whitespace-pre-line">
            "{question.audioScript || ''}"
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PART 2 CONTROLS: EXACTLY 3 CHOICES (A, B, C)                             */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
          Chọn phương án bạn nghe được (A, B hoặc C):
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {choices.map((choiceLetter, idx) => {
            const isSelected = selectedAnswer === choiceLetter;
            const spokenText = getOptionText(choiceLetter, idx);

            return (
              <button
                key={choiceLetter}
                type="button"
                onClick={() => onSelectAnswer(choiceLetter)}
                className={`min-h-[58px] p-4 rounded-2xl border text-center transition-all duration-150 flex flex-col items-center justify-center gap-1.5 shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 select-none ${
                  isSelected
                    ? 'bg-gradient-to-br from-amber-500 to-orange-500 border-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/25 scale-[1.02] ring-2 ring-amber-400'
                    : 'bg-slate-850 hover:bg-slate-800 border-slate-750 text-white hover:border-slate-600'
                }`}
                aria-label={`Phương án ${choiceLetter}${canRevealSpokenText && spokenText ? `: ${spokenText}` : ''}`}
                aria-pressed={isSelected}
              >
                <span className={`text-xl sm:text-2xl font-black ${isSelected ? 'text-slate-950' : 'text-amber-400'}`}>
                  ({choiceLetter})
                </span>

                <span className={`text-[11px] font-bold ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>
                  {isSelected ? 'Đã Chọn' : 'Bấm để chọn'}
                </span>

                {/* PRACTICE REVEAL: Chỉ hiện text sau khi người học đã chọn đáp án */}
                {canRevealSpokenText && spokenText && (
                  <span className={`text-xs leading-snug px-1 text-center font-normal mt-1 border-t pt-1.5 w-full ${
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
