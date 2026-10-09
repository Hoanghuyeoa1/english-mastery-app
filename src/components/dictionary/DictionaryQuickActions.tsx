import React from 'react';
import { 
  Volume2, 
  Mic, 
  PlusCircle, 
  Check, 
  Layers, 
  AlertTriangle, 
  BookMarked, 
  Copy, 
  CheckCheck 
} from 'lucide-react';

export interface DictionaryQuickActionsProps {
  word: string;
  isInDeck: boolean;
  isDue: boolean;
  hasUnresolvedMistakes: boolean;
  hasWeakCollocations: boolean;
  onSaveToDeck: () => void;
  onReviewNow?: () => void;
  onPracticeMistake?: () => void;
  onPracticeCollocation?: () => void;
  onSpeak: () => void;
  onCheckVoice: () => void;
  onCopy: () => void;
  isCopied: boolean;
}

export const DictionaryQuickActions: React.FC<DictionaryQuickActionsProps> = ({
  word,
  isInDeck,
  isDue,
  hasUnresolvedMistakes,
  hasWeakCollocations,
  onSaveToDeck,
  onReviewNow,
  onPracticeMistake,
  onPracticeCollocation,
  onSpeak,
  onCheckVoice,
  onCopy,
  isCopied,
}) => {
  const isSpeechSynthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const isSpeechRecognitionSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  return (
    <div
      data-testid="dictionary-quick-actions"
      className="flex items-center gap-2 flex-wrap"
    >
      {/* 1. Audio Pronounce */}
      <button
        type="button"
        onClick={() => {
          if (isSpeechSynthesisSupported) onSpeak();
        }}
        disabled={!isSpeechSynthesisSupported}
        aria-disabled={!isSpeechSynthesisSupported}
        aria-label="Phát âm từ vựng"
        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
          isSpeechSynthesisSupported
            ? 'bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border-slate-700'
            : 'bg-slate-800/40 text-slate-500 border-slate-800 cursor-not-allowed opacity-60'
        }`}
        title={isSpeechSynthesisSupported ? 'Phát âm tiếng Anh chuẩn' : 'Trình duyệt không hỗ trợ phát âm'}
      >
        <Volume2 className={`w-3.5 h-3.5 ${isSpeechSynthesisSupported ? 'text-emerald-400' : 'text-slate-500'}`} />
        <span>Phát âm</span>
      </button>

      {/* 2. Voice Mic Pronunciation Evaluation */}
      <button
        type="button"
        onClick={() => {
          if (isSpeechRecognitionSupported) onCheckVoice();
        }}
        disabled={!isSpeechRecognitionSupported}
        aria-disabled={!isSpeechRecognitionSupported}
        aria-label="Chấm điểm phát âm qua Micro"
        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
          isSpeechRecognitionSupported
            ? 'bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/40'
            : 'bg-slate-800/40 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
        }`}
        title={isSpeechRecognitionSupported ? 'Chấm điểm phát âm qua Micro' : 'Trình duyệt không hỗ trợ nhận diện Micro'}
      >
        <Mic className={`w-3.5 h-3.5 ${isSpeechRecognitionSupported ? 'text-teal-400' : 'text-slate-500'}`} />
        <span>Chấm mic</span>
      </button>

      {/* 3. Add to SRS / In SRS Deck State */}
      {isInDeck ? (
        <div
          data-testid="in-srs-deck-indicator"
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold"
          title={`Từ "${word}" đã có trong Flashcard SRS`}
          role="status"
          aria-label="Từ đã có trong Flashcard SRS"
        >
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>Đã có trong Deck</span>
        </div>
      ) : (
        <button
          type="button"
          data-testid="add-to-srs-button"
          onClick={onSaveToDeck}
          aria-label="Thêm từ vào Flashcard SRS"
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>+ Thêm Flashcard</span>
        </button>
      )}

      {/* 4. Review Now (If Due or In Active Relearning) */}
      {isInDeck && isDue && onReviewNow && (
        <button
          type="button"
          data-testid="review-now-button"
          onClick={onReviewNow}
          aria-label="Ôn tập thẻ này ngay bây giờ"
          className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          title="Ôn tập thẻ này ngay bây giờ"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Ôn tập ngay</span>
        </button>
      )}

      {/* 5. Practice Mistake (If Unresolved Mistake Exists) */}
      {hasUnresolvedMistakes && onPracticeMistake && (
        <button
          type="button"
          data-testid="practice-mistake-quick-button"
          onClick={onPracticeMistake}
          aria-label="Luyện bài tập sửa lỗi sai"
          className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          title="Luyện bài tập sửa lỗi sai cho từ này"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span>Luyện lỗi sai</span>
        </button>
      )}

      {/* 6. Practice Collocation (If Weak Collocations Exist) */}
      {hasWeakCollocations && onPracticeCollocation && (
        <button
          type="button"
          data-testid="practice-collocation-quick-button"
          onClick={onPracticeCollocation}
          aria-label="Luyện tập cụm từ liên kết yếu"
          className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          title="Luyện tập các cụm từ liên kết yếu"
        >
          <BookMarked className="w-3.5 h-3.5 text-rose-400" />
          <span>Luyện Collocation</span>
        </button>
      )}

      {/* 7. Copy Word & Definition to Clipboard */}
      <button
        type="button"
        data-testid="copy-dictionary-word-button"
        onClick={onCopy}
        className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        title="Sao chép từ và định nghĩa"
        aria-label="Sao chép từ và định nghĩa vào bộ nhớ tạm"
      >
        {isCopied ? (
          <CheckCheck className="w-4 h-4 text-emerald-400" />
        ) : (
          <Copy className="w-4 h-4 text-slate-400" />
        )}
      </button>
    </div>
  );
};
