import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Volume2, Shuffle, Lightbulb, RotateCcw, CheckCircle2, Flame } from 'lucide-react';
import confetti from 'canvas-confetti';
import { speakWord } from '../services/speechService';
import { cleanMeaningForScramble } from '../services/textSanitizer';
import { VocabWord } from '../types';
import { useAppStore } from '../store/useAppStore';

export interface LetterItem {
  id: string;
  char: string;
  originalIndex: number;
  isUsed: boolean;
  isDistractor?: boolean;
}

interface WordScrambleProps {
  vocabPool: VocabWord[];
  onGainXP: (xp: number) => void;
  onIncrementStreak?: () => void;
  audioVoice?: 'en-US' | 'en-GB';
  audioSpeed: number;
}

export const WordScramble: React.FC<WordScrambleProps> = ({
  vocabPool,
  onGainXP,
  onIncrementStreak,
  audioVoice,
  audioSpeed,
}) => {
  const { recordMistake, recordMistakeCorrect } = useAppStore();
  const [currentVocab, setCurrentVocab] = useState<VocabWord | null>(null);
  const [targetWord, setTargetWord] = useState<string>('');
  const [availableLetters, setAvailableLetters] = useState<LetterItem[]>([]);
  const [userSlots, setUserSlots] = useState<(LetterItem | null)[]>([]);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [streak, setStreak] = useState<number>(0);

  // 1. QUY TRÌNH NẠP TỪ MỚI ĐỒNG BỘ TUYỆT ĐỐI (100% FULL TARGET LETTERS + DISTRACTORS)
  const loadNewWord = useCallback((vocabOverride?: VocabWord) => {
    // Lấy các từ đơn tiếng Anh (chỉ chứa chữ cái A-Z, độ dài từ 3 đến 12 ký tự)
    const validSingleWords = vocabPool.filter((w) => {
      const pureLetters = w.word.replace(/[^a-zA-Z]/g, '').trim();
      return pureLetters.length >= 3 && pureLetters.length <= 12 && !w.word.includes(' ');
    });

    const candidatePool = validSingleWords.length > 0 ? validSingleWords : vocabPool;
    if (candidatePool.length === 0) return;

    const selectedVocab = vocabOverride || candidatePool[Math.floor(Math.random() * candidatePool.length)];
    if (!selectedVocab) return;

    // 1. LẤY TRỌN VẸN 100% TỪ MỤC TIÊU (Giữ nguyên vẹn toàn bộ các ký tự như RESILIENCE, JUSTIFY, YIELD)
    const cleanWord = selectedVocab.word.replace(/[^a-zA-Z]/g, '').trim().toUpperCase();
    const cleanMeaning = cleanMeaningForScramble(selectedVocab.meaning, cleanWord);

    // 2. Tạo 100% các chữ cái của từ mục tiêu (đảm bảo đầy đủ từng chữ, ví dụ RESILIENCE có đủ 10 chữ)
    const targetLetters: LetterItem[] = cleanWord.split('').map((char, index) => ({
      id: `target_${char}_${index}_${Math.random().toString(36).substring(2, 7)}`,
      char: char.toUpperCase(),
      originalIndex: index,
      isUsed: false,
      isDistractor: false,
    }));

    // 3. Thêm từ 2 - 3 chữ cái ngẫu nhiên làm nhiễu (Distractors)
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const distractorCount = Math.min(3, Math.max(2, Math.floor(cleanWord.length / 4)));
    const distractorLetters: LetterItem[] = [];
    for (let i = 0; i < distractorCount; i++) {
      const randomChar = alphabet[Math.floor(Math.random() * alphabet.length)];
      distractorLetters.push({
        id: `distractor_${randomChar}_${i}_${Math.random().toString(36).substring(2, 7)}`,
        char: randomChar,
        originalIndex: -1,
        isUsed: false,
        isDistractor: true,
      });
    }

    // 4. Xáo trộn toàn bộ mảng chữ cái gồm (100% chữ cái mục tiêu + chữ cái nhiễu)
    const allLetters = [...targetLetters, ...distractorLetters];
    let shuffled = [...allLetters].sort(() => Math.random() - 0.5);

    // 5. CẬP NHẬT ĐỒNG THỜI TOÀN BỘ STATE TRONG 1 LẦN DUY NHẤT
    setCurrentVocab({ ...selectedVocab, word: cleanWord, meaning: cleanMeaning });
    setTargetWord(cleanWord);
    setAvailableLetters(shuffled);
    setUserSlots(new Array(cleanWord.length).fill(null)); // Số ô vuông phía trên BẮT BUỘC bằng đúng targetWord.length
    setIsSuccess(false);
    setIsError(false);
  }, [vocabPool]);

  // Khởi tạo ván chơi ngay khi component mount hoặc khi vocabPool thay đổi
  useEffect(() => {
    if (!currentVocab && vocabPool.length > 0) {
      loadNewWord();
    }
  }, [currentVocab, vocabPool, loadNewWord]);

  // 2. CHỌN CHỮ CÁI (PICK LETTER)
  const handlePickLetter = useCallback((letterItem: LetterItem) => {
    if (letterItem.isUsed || isSuccess || !targetWord) return;

    // Tìm ô trống đầu tiên trong phạm vi targetWord.length
    const firstEmptyIndex = userSlots.findIndex((slot) => slot === null);
    if (firstEmptyIndex === -1 || firstEmptyIndex >= targetWord.length) return;

    // Cập nhật slot với letter đã chọn
    const nextSlots = [...userSlots];
    nextSlots[firstEmptyIndex] = letterItem;
    setUserSlots(nextSlots);

    // Đánh dấu letter đã được dùng trong availableLetters
    setAvailableLetters((prev) =>
      prev.map((l) => (l.id === letterItem.id ? { ...l, isUsed: true } : l))
    );

    // Kiểm tra nếu đã điền đầy đủ tất cả các ô của từ mục tiêu (targetWord.length)
    if (nextSlots.length === targetWord.length && nextSlots.every((slot) => slot !== null)) {
      const spelledWord = nextSlots.map((slot) => slot?.char).join('');
      
      if (spelledWord === targetWord) {
        // ĐÚNG CHÍNH TẢ!
        setIsSuccess(true);
        if (currentVocab) {
          recordMistakeCorrect(currentVocab.id || currentVocab.word);
        }
        speakWord(targetWord, audioVoice, audioSpeed);
        onGainXP(20);
        onIncrementStreak?.();
        setStreak((prev) => prev + 1);
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });

        setTimeout(() => {
          loadNewWord();
        }, 1200);
      } else {
        // SAI CHÍNH TẢ!
        setIsError(true);
        if (currentVocab) {
          recordMistake(currentVocab, 'scramble');
        }
        setTimeout(() => {
          setIsError(false);
        }, 650);
      }
    }
  }, [userSlots, targetWord, isSuccess, currentVocab, audioVoice, audioSpeed, onGainXP, onIncrementStreak, recordMistake, recordMistakeCorrect, loadNewWord]);

  // 3. GỠ CHỮ CÁI KHỎI Ô TRỐNG (REMOVE LETTER FROM SLOT)
  const handleRemoveSlot = useCallback((slotIndex: number) => {
    if (isSuccess) return;
    const itemInSlot = userSlots[slotIndex];
    if (!itemInSlot) return;

    // Làm trống ô slot
    const nextSlots = [...userSlots];
    nextSlots[slotIndex] = null;
    setUserSlots(nextSlots);

    // Trả lại trạng thái isUsed = false cho letter
    setAvailableLetters((prev) =>
      prev.map((l) => (l.id === itemInSlot.id ? { ...l, isUsed: false } : l))
    );
  }, [userSlots, isSuccess]);

  // 4. GỢI Ý 1 CHỮ CÁI CHÍNH XÁC (HINT)
  const handleHint = useCallback(() => {
    if (isSuccess || !targetWord) return;

    // Tìm ô trống đầu tiên
    const firstEmptyIndex = userSlots.findIndex((slot) => slot === null);
    if (firstEmptyIndex === -1 || firstEmptyIndex >= targetWord.length) return;

    // Chữ cái đúng tại vị trí đó
    const correctChar = targetWord[firstEmptyIndex];
    
    // Tìm thẻ chưa dùng trong availableLetters có char khớp (ưu tiên thẻ gốc không phải distractor)
    const availableMatch = availableLetters.find(
      (l) => !l.isUsed && l.char === correctChar && !l.isDistractor
    ) || availableLetters.find(
      (l) => !l.isUsed && l.char === correctChar
    );

    if (availableMatch) {
      handlePickLetter(availableMatch);
    }
  }, [userSlots, targetWord, availableLetters, isSuccess, handlePickLetter]);

  // 5. XÓA TOÀN BỘ ĐỂ LÀM LẠI (RESET CURRENT SLOTS)
  const handleResetSlots = useCallback(() => {
    if (isSuccess || !targetWord) return;
    setUserSlots(new Array(targetWord.length).fill(null));
    setAvailableLetters((prev) => prev.map((l) => ({ ...l, isUsed: false })));
  }, [targetWord, isSuccess]);

  // 6. LẮNG NGHE BÀN PHÍM (KEYBOARD TYPING SUPPORT)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (isSuccess) return;

      // Phím Backspace: Gỡ chữ cái ở ô đã điền cuối cùng
      if (e.key === 'Backspace') {
        e.preventDefault();
        const lastFilledIdx = [...userSlots].reverse().findIndex((s) => s !== null);
        if (lastFilledIdx !== -1) {
          const actualIdx = userSlots.length - 1 - lastFilledIdx;
          handleRemoveSlot(actualIdx);
        }
        return;
      }

      // Phím chữ cái (A-Z): Tự động bấm letter tương ứng
      const keyUpper = e.key.toUpperCase();
      if (/^[A-Z]$/.test(keyUpper)) {
        const availableMatch = availableLetters.find(
          (l) => !l.isUsed && l.char === keyUpper
        );
        if (availableMatch) {
          e.preventDefault();
          handlePickLetter(availableMatch);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [userSlots, availableLetters, isSuccess, handlePickLetter, handleRemoveSlot]);

  if (!currentVocab || !targetWord) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center shadow-2xl space-y-4">
        <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-400 text-sm">Đang tải thử thách Xếp Chữ...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
      
      {/* Top Header: Nghĩa tiếng Việt chuẩn xác, Phiên âm, Audio & Streak */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Nghĩa tiếng Việt {currentVocab.partOfSpeech ? `(${currentVocab.partOfSpeech})` : ''}:
            </span>
            {streak > 1 && (
              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg text-[10px] font-black flex items-center gap-1">
                <Flame className="w-3 h-3 fill-orange-400" />
                <span>{streak} liên tiếp</span>
              </span>
            )}
          </div>

          {/* Nghĩa tiếng Việt cụ thể chuẩn xác */}
          <h3 className="text-xl sm:text-2xl font-black text-emerald-400 leading-snug">
            {currentVocab.meaning}
          </h3>

          {currentVocab.ipa && currentVocab.ipa !== `/${currentVocab.word.toLowerCase()}/` && (
            <span className="text-xs text-slate-400 font-mono block">
              {currentVocab.ipa}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={() => speakWord(targetWord, audioVoice, audioSpeed)}
            className="p-3 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-teal-400 rounded-2xl transition-colors border border-slate-700/60 shadow-sm"
            title="Nghe phát âm từ vựng"
          >
            <Volume2 className="w-5 h-5" />
          </button>

          <button
            onClick={() => loadNewWord()}
            className="p-3 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-2xl transition-colors border border-slate-700/60 shadow-sm"
            title="Đổi từ khác (Bỏ qua)"
          >
            <Shuffle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Assembled Word Slot Boxes (CHÍNH XÁC targetWord.length Ô VUÔNG PHÍA TRÊN) */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-2 py-4 min-h-[90px]">
          {Array.from({ length: targetWord.length }).map((_, idx) => {
            const slotItem = userSlots[idx];
            const hasLetter = slotItem !== null && slotItem !== undefined;
            return (
              <motion.button
                key={`slot_${idx}`}
                onClick={() => hasLetter && handleRemoveSlot(idx)}
                whileHover={hasLetter ? { scale: 1.08 } : {}}
                whileTap={hasLetter ? { scale: 0.95 } : {}}
                className={`w-12 h-14 sm:w-14 sm:h-16 rounded-2xl font-black text-xl sm:text-2xl flex items-center justify-center transition-all border select-none ${
                  hasLetter
                    ? isSuccess
                      ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 ring-2 ring-emerald-400/50 shadow-lg shadow-emerald-500/25'
                      : isError
                      ? 'bg-red-500/25 border-red-500 text-red-300 animate-shake'
                      : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-white shadow-md'
                    : 'bg-slate-950/80 border-slate-800 border-dashed text-transparent'
                }`}
                title={hasLetter ? 'Click để gỡ chữ này' : `Vị trí ký tự ${idx + 1}/${targetWord.length}`}
              >
                {slotItem?.char || ''}
              </motion.button>
            );
          })}
        </div>

        {/* Status Feedback */}
        {isSuccess && (
          <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm animate-fadeIn">
            <CheckCircle2 className="w-4 h-4" />
            <span>Ghép chính xác "{targetWord}"! +20 XP</span>
          </div>
        )}
        {isError && (
          <div className="flex items-center justify-center gap-2 text-red-400 font-bold text-sm animate-shake">
            <span>Chính tả chưa đúng, hãy thử sắp xếp lại nhé!</span>
          </div>
        )}
      </div>

      {/* Available Scrambled Letter Tiles (100% CHỮ CÁI MỤC TIÊU + 2-3 CHỮ CÁI NHIỄU) */}
      <div className="space-y-3 pt-2">
        <span className="text-xs font-bold text-slate-500 block text-center uppercase tracking-wider">
          Click hoặc gõ phím để chọn chữ cái ({availableLetters.length} chữ cái):
        </span>

        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {availableLetters.map((item) => (
            <motion.button
              key={item.id}
              disabled={item.isUsed || isSuccess}
              whileHover={!item.isUsed ? { scale: 1.12 } : {}}
              whileTap={!item.isUsed ? { scale: 0.92 } : {}}
              onClick={() => handlePickLetter(item)}
              className={`w-11 h-13 sm:w-13 sm:h-14 rounded-2xl font-black text-lg sm:text-xl flex items-center justify-center transition-all border select-none ${
                item.isUsed
                  ? 'bg-slate-950 border-slate-850 text-slate-700 opacity-20 pointer-events-none'
                  : 'bg-gradient-to-b from-slate-800 to-slate-850 hover:from-teal-500 hover:to-emerald-500 text-white hover:text-slate-950 border-slate-700 shadow-lg hover:shadow-teal-500/30'
              }`}
            >
              {item.char}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Action Bar: Hint & Reset */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        <button
          onClick={handleHint}
          disabled={isSuccess || userSlots.slice(0, targetWord.length).every((s) => s !== null && s !== undefined)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold rounded-xl text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
          title="Tự động điền 1 chữ cái đúng"
        >
          <Lightbulb className="w-4 h-4" />
          <span>Gợi ý 1 chữ (+1 Hint)</span>
        </button>

        <button
          onClick={handleResetSlots}
          disabled={userSlots.slice(0, targetWord.length).every((s) => s === null) || isSuccess}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700/60 shadow-sm"
          title="Gỡ toàn bộ các ô để xếp lại từ đầu"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Xóa làm lại</span>
        </button>
      </div>

    </div>
  );
};
