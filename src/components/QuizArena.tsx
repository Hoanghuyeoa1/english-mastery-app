import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, 
  Timer, 
  RotateCcw, 
  Volume2, 
  CheckCircle2, 
  XCircle, 
  Trophy, 
  Flame, 
  Shuffle, 
  Lightbulb, 
  Check, 
  ArrowRight,
  Headphones
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAppStore } from '../store/useAppStore';
import { speakWord } from '../services/speechService';
import { getFullDictionaryBank } from '../services/dictionaryIndex';
import { 
  cleanWordString, 
  sanitizeExampleSentence, 
  maskTargetWordInSentence 
} from '../services/textSanitizer';
import { VocabWord, VocabTag } from '../types';

type ArcadeMode = 'speed_match' | 'word_scramble' | 'dictation' | 'classic_quiz';

interface MatchTile {
  id: string;
  wordId: string;
  type: 'en' | 'vi';
  text: string;
  isMatched: boolean;
}

export const QuizArena: React.FC = () => {
  const { 
    vocabularyList, 
    gainXP, 
    consumeHeart, 
    audioVoice, 
    audioSpeed 
  } = useAppStore();

  const [activeMode, setActiveMode] = useState<ArcadeMode>('speed_match');
  const [selectedTag, setSelectedTag] = useState<VocabTag | 'ALL'>('ALL');
  const [streakCount, setStreakCount] = useState(0);
  const [totalXpSession, setTotalXpSession] = useState(0);

  // Kho từ vựng 10.000+ từ đã được làm sạch rác (Set ...)
  const masterVocabBank = useMemo(() => {
    const fullBank = getFullDictionaryBank();
    const combined = [...vocabularyList, ...fullBank];
    const uniqueMap = new Map<string, VocabWord>();
    
    combined.forEach((w) => {
      if (w.word && w.meaning) {
        const cleanW = cleanWordString(w.word);
        const cleanMeaning = cleanWordString(w.meaning);
        const key = cleanW.toLowerCase().trim();
        if (key.length >= 2 && !uniqueMap.has(key)) {
          uniqueMap.set(key, {
            ...w,
            word: cleanW,
            meaning: cleanMeaning,
            example: sanitizeExampleSentence(w.example, cleanW),
          });
        }
      }
    });
    return Array.from(uniqueMap.values());
  }, [vocabularyList]);

  // Bộ từ lọc theo tag
  const filteredVocab = useMemo(() => {
    if (selectedTag === 'ALL') return masterVocabBank;
    return masterVocabBank.filter((w) => w.tag === selectedTag);
  }, [masterVocabBank, selectedTag]);

  // ==========================================
  // 1. SPEED MATCH (NỐI TỪ PHẢN XẠ) STATE
  // ==========================================
  const [matchTiles, setMatchTiles] = useState<MatchTile[]>([]);
  const [selectedTile, setSelectedTile] = useState<MatchTile | null>(null);
  const [wrongTileIds, setWrongTileIds] = useState<string[]>([]);
  const [matchTimeLeft, setMatchTimeLeft] = useState(60);
  const [isMatchRunning, setIsMatchRunning] = useState(false);
  const [isMatchOver, setIsMatchOver] = useState(false);
  const [matchScore, setMatchScore] = useState(0);
  const [matchCombo, setMatchCombo] = useState(0);
  const [maxMatchCombo, setMaxMatchCombo] = useState(0);

  const startSpeedMatch = useCallback(() => {
    const pool = filteredVocab.length >= 8 ? filteredVocab : masterVocabBank;
    const shuffledPool = [...pool].sort(() => 0.5 - Math.random());
    const selectedWords = shuffledPool.slice(0, 6); // 6 cặp từ = 12 thẻ

    const tiles: MatchTile[] = [];
    selectedWords.forEach((w, idx) => {
      const cleanW = cleanWordString(w.word);
      const cleanMeaning = cleanWordString(w.meaning).split(/[:;,]/)[0].trim().slice(0, 35);
      tiles.push({
        id: `en_${idx}_${cleanW}`,
        wordId: cleanW.toLowerCase(),
        type: 'en',
        text: cleanW,
        isMatched: false,
      });
      tiles.push({
        id: `vi_${idx}_${cleanW}`,
        wordId: cleanW.toLowerCase(),
        type: 'vi',
        text: cleanMeaning,
        isMatched: false,
      });
    });

    setMatchTiles(tiles.sort(() => 0.5 - Math.random()));
    setSelectedTile(null);
    setWrongTileIds([]);
    setMatchTimeLeft(60);
    setMatchScore(0);
    setMatchCombo(0);
    setMaxMatchCombo(0);
    setIsMatchRunning(true);
    setIsMatchOver(false);
  }, [filteredVocab, masterVocabBank]);

  // Timer cho Speed Match
  useEffect(() => {
    if (!isMatchRunning || matchTimeLeft <= 0) return;
    const timer = setInterval(() => {
      setMatchTimeLeft((prev) => {
        if (prev <= 1) {
          setIsMatchRunning(false);
          setIsMatchOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isMatchRunning, matchTimeLeft]);

  // Xử lý bấm chọn thẻ Speed Match
  const handleTileClick = (tile: MatchTile) => {
    if (tile.isMatched || !isMatchRunning) return;

    if (!selectedTile) {
      setSelectedTile(tile);
      if (tile.type === 'en') {
        speakWord(tile.text, audioVoice, audioSpeed);
      }
      return;
    }

    if (selectedTile.id === tile.id) {
      setSelectedTile(null);
      return;
    }

    // Kiểm tra nếu 1 thẻ EN và 1 thẻ VI khớp nhau
    if (selectedTile.type !== tile.type && selectedTile.wordId === tile.wordId) {
      // ĐÚNG CẶP!
      const wordText = selectedTile.type === 'en' ? selectedTile.text : tile.text;
      speakWord(wordText, audioVoice, audioSpeed);

      const nextCombo = matchCombo + 1;
      setMatchCombo(nextCombo);
      if (nextCombo > maxMatchCombo) setMaxMatchCombo(nextCombo);

      const earnedXP = 15 + nextCombo * 5;
      gainXP(earnedXP);
      setTotalXpSession((prev) => prev + earnedXP);
      setMatchScore((prev) => prev + earnedXP * 10);

      setMatchTiles((prev) =>
        prev.map((t) =>
          t.wordId === tile.wordId ? { ...t, isMatched: true } : t
        )
      );
      setSelectedTile(null);

      // Kiểm tra nếu đã giải xong hết cả bàn
      const remaining = matchTiles.filter(
        (t) => !t.isMatched && t.wordId !== tile.wordId
      );
      if (remaining.length === 0) {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
        setTimeout(() => {
          startSpeedMatch();
        }, 600);
      }
    } else {
      // SAI CẶP!
      setWrongTileIds([selectedTile.id, tile.id]);
      setMatchCombo(0);
      setTimeout(() => {
        setWrongTileIds([]);
        setSelectedTile(null);
      }, 500);
    }
  };

  // ==========================================
  // 2. WORD SCRAMBLE (GHÉP CHỮ CHÍNH TẢ) STATE
  // ==========================================
  const [scrambleWord, setScrambleWord] = useState<VocabWord | null>(null);
  const [scrambledLetters, setScrambledLetters] = useState<{ char: string; originalIdx: number; isUsed: boolean }[]>([]);
  const [assembledLetters, setAssembledLetters] = useState<{ char: string; letterId: number }[]>([]);
  const [scrambleSuccess, setScrambleSuccess] = useState(false);
  const [scrambleError, setScrambleError] = useState(false);

  const initScrambleRound = useCallback((wordObj?: VocabWord) => {
    const pool = filteredVocab.length > 0 ? filteredVocab : masterVocabBank;
    const word = wordObj || pool[Math.floor(Math.random() * pool.length)];
    if (!word) return;

    const cleanWord = cleanWordString(word.word);
    setScrambleWord({ ...word, word: cleanWord });
    setScrambleSuccess(false);
    setScrambleError(false);
    setAssembledLetters([]);

    const chars = cleanWord.split('').map((char, idx) => ({
      char,
      originalIdx: idx,
      isUsed: false,
    }));

    // Xáo trộn chữ cái
    const shuffled = [...chars].sort(() => 0.5 - Math.random());
    setScrambledLetters(shuffled);
  }, [filteredVocab, masterVocabBank]);

  useEffect(() => {
    if (activeMode === 'word_scramble' && !scrambleWord) {
      initScrambleRound();
    }
  }, [activeMode, scrambleWord, initScrambleRound]);

  const handlePickLetter = (letterItem: { char: string; originalIdx: number; isUsed: boolean }, indexInScrambled: number) => {
    if (letterItem.isUsed || scrambleSuccess) return;

    const newAssembled = [...assembledLetters, { char: letterItem.char, letterId: letterItem.originalIdx }];
    setAssembledLetters(newAssembled);

    setScrambledLetters((prev) =>
      prev.map((item, idx) => (idx === indexInScrambled ? { ...item, isUsed: true } : item))
    );

    // Kiểm tra nếu đã xếp đủ số ký tự
    if (scrambleWord && newAssembled.length === scrambleWord.word.length) {
      const spelled = newAssembled.map((i) => i.char).join('');
      if (spelled.toLowerCase() === scrambleWord.word.toLowerCase()) {
        // ĐÚNG CHÍNH TẢ!
        setScrambleSuccess(true);
        speakWord(scrambleWord.word, audioVoice, audioSpeed);
        gainXP(20);
        setTotalXpSession((prev) => prev + 20);
        setStreakCount((prev) => prev + 1);
        confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });

        setTimeout(() => {
          initScrambleRound();
        }, 1200);
      } else {
        // SAI!
        setScrambleError(true);
        setTimeout(() => setScrambleError(false), 600);
      }
    }
  };

  const handleRemoveAssembled = (indexInAssembled: number) => {
    if (scrambleSuccess) return;
    const removedItem = assembledLetters[indexInAssembled];
    const newAssembled = assembledLetters.filter((_, idx) => idx !== indexInAssembled);
    setAssembledLetters(newAssembled);

    setScrambledLetters((prev) =>
      prev.map((item) =>
        item.originalIdx === removedItem.letterId ? { ...item, isUsed: false } : item
      )
    );
  };

  const handleScrambleHint = () => {
    if (!scrambleWord || scrambleSuccess) return;
    const nextCharNeeded = scrambleWord.word[assembledLetters.length];
    if (!nextCharNeeded) return;

    const availableIdx = scrambledLetters.findIndex(
      (item) => !item.isUsed && item.char.toLowerCase() === nextCharNeeded.toLowerCase()
    );
    if (availableIdx !== -1) {
      handlePickLetter(scrambledLetters[availableIdx], availableIdx);
    }
  };

  // ==========================================
  // 3. DICTATION MODE (NGHE CHÉP ĐIỀN TỪ) STATE
  // ==========================================
  const [dictationWord, setDictationWord] = useState<VocabWord | null>(null);
  const [dictationCleanAudioSentence, setDictationCleanAudioSentence] = useState('');
  const [dictationMaskedDisplaySentence, setDictationMaskedDisplaySentence] = useState('');
  const [dictationTargetClean, setDictationTargetClean] = useState('');
  const [dictationInput, setDictationInput] = useState('');
  const [dictationFeedback, setDictationFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [dictationSlow, setDictationSlow] = useState(false);

  const initDictationRound = useCallback(() => {
    const pool = (filteredVocab.length > 0 ? filteredVocab : masterVocabBank);
    const word = pool[Math.floor(Math.random() * pool.length)];
    if (!word) return;

    const cleanW = cleanWordString(word.word);
    const { maskedSentence, cleanFullSentence, targetWordClean } = maskTargetWordInSentence(
      word.example || `The team must ${cleanW} for optimal performance.`,
      cleanW
    );

    setDictationWord({
      ...word,
      word: cleanW,
      meaning: cleanWordString(word.meaning),
      example: cleanFullSentence,
    });
    setDictationCleanAudioSentence(cleanFullSentence);
    setDictationMaskedDisplaySentence(maskedSentence);
    setDictationTargetClean(targetWordClean);
    setDictationInput('');
    setDictationFeedback(null);
    setDictationSlow(false);

    // Tự động phát âm trọn vẹn câu hoàn chỉnh sau 300ms
    setTimeout(() => {
      speakWord(cleanFullSentence, audioVoice, audioSpeed);
    }, 300);
  }, [filteredVocab, masterVocabBank, audioVoice, audioSpeed]);

  useEffect(() => {
    if (activeMode === 'dictation' && !dictationWord) {
      initDictationRound();
    }
  }, [activeMode, dictationWord, initDictationRound]);

  const handleCheckDictation = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!dictationTargetClean || !dictationInput.trim() || dictationFeedback === 'correct') return;

    const cleanInput = dictationInput.trim().toLowerCase();
    const targetWord = dictationTargetClean.toLowerCase();

    if (cleanInput === targetWord) {
      setDictationFeedback('correct');
      speakWord(dictationTargetClean, audioVoice, audioSpeed);
      gainXP(25);
      setTotalXpSession((prev) => prev + 25);
      setStreakCount((prev) => prev + 1);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });

      setTimeout(() => {
        initDictationRound();
      }, 1600);
    } else {
      setDictationFeedback('wrong');
      consumeHeart();
      setStreakCount(0);
    }
  };

  // ==========================================
  // 4. CLASSIC QUIZ (TRẮC NGHIỆM 4 ĐÁP ÁN) STATE
  // ==========================================
  const [quizIdx, setQuizIdx] = useState(0);
  const [selectedQuizOption, setSelectedQuizOption] = useState<string | null>(null);
  const [isQuizAnswered, setIsQuizAnswered] = useState(false);

  const currentQuizWord = filteredVocab[quizIdx % filteredVocab.length] || masterVocabBank[0];

  const quizOptions = useMemo(() => {
    if (!currentQuizWord) return [];
    const correctMeaning = cleanWordString(currentQuizWord.meaning).split(/[:;,]/)[0].trim();
    const wrongList = masterVocabBank
      .filter((w) => cleanWordString(w.word).toLowerCase() !== cleanWordString(currentQuizWord.word).toLowerCase())
      .map((w) => cleanWordString(w.meaning).split(/[:;,]/)[0].trim())
      .filter((m) => m && m !== correctMeaning);

    const shuffledWrongs = [...new Set(wrongList)].sort(() => 0.5 - Math.random()).slice(0, 3);
    return [correctMeaning, ...shuffledWrongs].sort(() => 0.5 - Math.random());
  }, [currentQuizWord, masterVocabBank]);

  const handleSelectQuizOption = (opt: string) => {
    if (isQuizAnswered || !currentQuizWord) return;
    setSelectedQuizOption(opt);
    setIsQuizAnswered(true);

    const correctMeaning = cleanWordString(currentQuizWord.meaning).split(/[:;,]/)[0].trim();
    if (opt === correctMeaning) {
      gainXP(15);
      setTotalXpSession((prev) => prev + 15);
      setStreakCount((prev) => prev + 1);
      speakWord(cleanWordString(currentQuizWord.word), audioVoice, audioSpeed);
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
    } else {
      consumeHeart();
      setStreakCount(0);
    }
  };

  const handleNextQuiz = () => {
    setSelectedQuizOption(null);
    setIsQuizAnswered(false);
    setQuizIdx((prev) => prev + 1);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      
      {/* 1. Header Banner & Mode Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
              <span className="p-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-2xl">
                <Zap className="w-6 h-6" />
              </span>
              <span>Đấu Trường Học Tập Đa Dạng (Study Arcade)</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Phản xạ nối từ • Rèn chính tả ghép chữ • Nghe chép điền từ • Dữ liệu chuẩn sạch
            </p>
          </div>

          {/* Gamification Session Stats */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/30 rounded-2xl text-orange-400 font-extrabold text-xs sm:text-sm">
              <Flame className="w-4 h-4 animate-pulse" />
              <span>Chuỗi: {streakCount}</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 font-extrabold text-xs sm:text-sm">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>+{totalXpSession} XP</span>
            </div>
          </div>
        </div>

        {/* 4 Arcade Game Mode Selectors */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {[
            { id: 'speed_match', title: '⚡ Speed Match', desc: 'Nối từ phản xạ 60s' },
            { id: 'word_scramble', title: '🔤 Word Scramble', desc: 'Ghép chữ rèn chính tả' },
            { id: 'dictation', title: '🎧 Dictation Mode', desc: 'Nghe chép điền từ' },
            { id: 'classic_quiz', title: '🎯 Classic Quiz', desc: 'Trắc nghiệm 4 đáp án' },
          ].map((mode) => {
            const isSelected = activeMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => {
                  setActiveMode(mode.id as ArcadeMode);
                  if (mode.id === 'speed_match' && !isMatchRunning) startSpeedMatch();
                  if (mode.id === 'word_scramble') initScrambleRound();
                  if (mode.id === 'dictation') initDictationRound();
                }}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/10 border-amber-400 text-amber-300 shadow-lg shadow-amber-500/15 ring-1 ring-amber-400/40'
                    : 'bg-slate-850 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="text-xs sm:text-sm font-black block text-white">{mode.title}</span>
                <span className="text-[11px] text-slate-400 block mt-1">{mode.desc}</span>
              </button>
            );
          })}
        </div>

        {/* Tag Domain Filter Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 shrink-0">
            Chủ đề:
          </span>
          {[
            { id: 'ALL', label: 'Tất cả (10.000+ từ)' },
            { id: 'Tech', label: '💻 Tech / IT' },
            { id: 'Business', label: '💼 Business' },
            { id: 'IELTS', label: '🎓 IELTS' },
            { id: 'TOEIC', label: '🎯 TOEIC' },
            { id: 'Daily', label: '☕ Daily' },
          ].map((tag) => {
            const isSelected = selectedTag === tag.id;
            return (
              <button
                key={tag.id}
                onClick={() => {
                  setSelectedTag(tag.id as any);
                  if (activeMode === 'speed_match') setTimeout(startSpeedMatch, 100);
                  if (activeMode === 'word_scramble') setTimeout(initScrambleRound, 100);
                  if (activeMode === 'dictation') setTimeout(initDictationRound, 100);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300'
                    : 'bg-slate-850 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. GAME AREA 1: SPEED MATCH (NỐI TỪ PHẢN XẠ)                              */}
      {/* ========================================================================= */}
      {activeMode === 'speed_match' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          {/* Game Top Bar: Timer, Score & Reset */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 border font-mono font-black text-base ${
                matchTimeLeft <= 10 
                  ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse' 
                  : 'bg-slate-850 border-slate-800 text-amber-400'
              }`}>
                <Timer className="w-5 h-5" />
                <span>{matchTimeLeft}s</span>
              </div>

              {matchCombo > 1 && (
                <span className="px-3 py-1.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-xl text-xs font-black animate-bounce">
                  🔥 {matchCombo}x Combo!
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm font-black text-white">
                Điểm: <strong className="text-amber-400">{matchScore}</strong>
              </span>

              <button
                onClick={startSpeedMatch}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all border border-slate-700"
                title="Chơi lại bàn mới"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Match Cards Grid */}
          {!isMatchOver ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 min-h-[320px]">
              {matchTiles.map((tile) => {
                const isSelected = selectedTile?.id === tile.id;
                const isWrong = wrongTileIds.includes(tile.id);

                if (tile.isMatched) {
                  return (
                    <div
                      key={tile.id}
                      className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 opacity-20 pointer-events-none flex items-center justify-center text-center"
                    >
                      <Check className="w-6 h-6 text-emerald-400" />
                    </div>
                  );
                }

                return (
                  <motion.button
                    key={tile.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleTileClick(tile)}
                    className={`p-4 rounded-2xl border font-bold text-xs sm:text-sm text-center flex items-center justify-center transition-all min-h-[90px] select-none shadow-md ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 ring-2 ring-cyan-400/50 scale-105'
                        : isWrong
                        ? 'bg-red-500/20 border-red-500 text-red-300 animate-shake'
                        : tile.type === 'en'
                        ? 'bg-slate-850 hover:bg-slate-800 border-slate-750 text-white font-extrabold'
                        : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'
                    }`}
                  >
                    <span>{tile.text}</span>
                  </motion.button>
                );
              })}
            </div>
          ) : (
            /* Game Over Screen */
            <div className="text-center py-12 space-y-4">
              <Trophy className="w-16 h-16 text-amber-400 mx-auto animate-bounce" />
              <h3 className="text-2xl font-black text-white">Hết Giờ! Hoàn Thành Thử Thách!</h3>
              <p className="text-slate-400 text-sm">
                Bạn đã đạt <strong className="text-amber-400">{matchScore} điểm</strong> với chuỗi Combo cao nhất là <strong className="text-orange-400">{maxMatchCombo}x</strong>!
              </p>
              <button
                onClick={startSpeedMatch}
                className="px-8 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-2xl shadow-xl hover:scale-105 transition-all text-sm"
              >
                Chơi Ván Mới Ngay
              </button>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. GAME AREA 2: WORD SCRAMBLE (GHÉP CHỮ RÈN CHÍNH TẢ)                    */}
      {/* ========================================================================= */}
      {activeMode === 'word_scramble' && scrambleWord && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          {/* Top Bar: Word Meaning & Audio */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Nghĩa tiếng Việt ({scrambleWord.partOfSpeech}):
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-emerald-400">
                {scrambleWord.meaning}
              </h3>
              {scrambleWord.ipa && (
                <span className="text-xs text-slate-400 font-mono block">
                  {scrambleWord.ipa}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => speakWord(scrambleWord.word, audioVoice, audioSpeed)}
                className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-teal-400 rounded-2xl transition-colors"
                title="Nghe phát âm"
              >
                <Volume2 className="w-5 h-5" />
              </button>

              <button
                onClick={() => initScrambleRound()}
                className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl transition-colors"
                title="Bỏ qua từ này"
              >
                <Shuffle className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Assembled Word Slot Boxes */}
          <div className="flex flex-wrap items-center justify-center gap-2 py-4 min-h-[90px]">
            {Array.from({ length: scrambleWord.word.length }).map((_, idx) => {
              const letter = assembledLetters[idx];
              return (
                <motion.button
                  key={idx}
                  onClick={() => letter && handleRemoveAssembled(idx)}
                  whileHover={letter ? { scale: 1.08 } : {}}
                  whileTap={letter ? { scale: 0.95 } : {}}
                  className={`w-12 h-14 sm:w-14 sm:h-16 rounded-2xl font-black text-xl sm:text-2xl flex items-center justify-center transition-all border ${
                    letter
                      ? scrambleSuccess
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 ring-2 ring-emerald-400/40 shadow-lg shadow-emerald-500/20'
                        : scrambleError
                        ? 'bg-red-500/20 border-red-400 text-red-300 animate-shake'
                        : 'bg-slate-800 border-slate-750 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 border-dashed text-transparent'
                  }`}
                >
                  {letter?.char || ''}
                </motion.button>
              );
            })}
          </div>

          {/* Scrambled Available Letter Tiles */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-500 block text-center uppercase tracking-wider">
              Bấm chọn chữ cái bên dưới để ghép đúng:
            </span>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {scrambledLetters.map((item, idx) => (
                <motion.button
                  key={idx}
                  disabled={item.isUsed || scrambleSuccess}
                  whileHover={!item.isUsed ? { scale: 1.1 } : {}}
                  whileTap={!item.isUsed ? { scale: 0.9 } : {}}
                  onClick={() => handlePickLetter(item, idx)}
                  className={`w-11 h-13 sm:w-13 sm:h-14 rounded-2xl font-black text-lg sm:text-xl flex items-center justify-center transition-all border select-none ${
                    item.isUsed
                      ? 'bg-slate-950 border-slate-850 text-slate-700 opacity-20 pointer-events-none'
                      : 'bg-gradient-to-b from-slate-800 to-slate-850 hover:from-teal-600 hover:to-teal-500 text-white hover:text-slate-950 border-slate-700 shadow-lg hover:shadow-teal-500/25'
                  }`}
                >
                  {item.char}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Action Bar: Hint & Clear */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              onClick={handleScrambleHint}
              disabled={scrambleSuccess || assembledLetters.length >= scrambleWord.word.length}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold rounded-xl text-xs transition-all disabled:opacity-30"
            >
              <Lightbulb className="w-4 h-4" />
              <span>Gợi ý 1 chữ (+1 Hint)</span>
            </button>

            <button
              onClick={() => {
                setAssembledLetters([]);
                setScrambledLetters((prev) => prev.map((item) => ({ ...item, isUsed: false })));
              }}
              disabled={assembledLetters.length === 0 || scrambleSuccess}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all disabled:opacity-30"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Xóa làm lại</span>
            </button>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. GAME AREA 3: DICTATION MODE (NGHE CHÉP CHÍNH TẢ ĐIỀN TỪ)               */}
      {/* ========================================================================= */}
      {activeMode === 'dictation' && dictationWord && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          {/* Top Bar */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Headphones className="w-3.5 h-3.5 text-cyan-400" />
                <span>Thử Thách Luyện Nghe & Điền Từ (Dictation Arena)</span>
              </span>
              <h3 className="text-lg sm:text-xl font-black text-white mt-0.5">
                Lắng nghe câu audio và gõ chính xác từ vựng còn thiếu
              </h3>
            </div>

            <button
              onClick={initDictationRound}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all border border-slate-700"
              title="Đổi câu khác"
            >
              <Shuffle className="w-4 h-4" />
            </button>
          </div>

          {/* Audio Play Center */}
          <div className="p-6 bg-slate-950 border border-slate-800 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  speakWord(dictationCleanAudioSentence, audioVoice, audioSpeed);
                }}
                className="p-4 bg-gradient-to-tr from-cyan-500 to-teal-400 text-slate-950 rounded-2xl shadow-xl shadow-cyan-500/25 hover:scale-105 transition-all shrink-0"
                title="Phát lại toàn bộ câu hoàn chỉnh"
              >
                <Volume2 className="w-6 h-6" />
              </button>

              <div>
                <span className="text-xs font-bold text-cyan-400 block">Bấm để nghe toàn bộ câu</span>
                <span className="text-xs text-slate-400">
                  Gợi ý nghĩa từ vựng cần điền: <strong className="text-emerald-400 font-semibold">{dictationWord.meaning}</strong>
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setDictationSlow(!dictationSlow);
                speakWord(dictationCleanAudioSentence, audioVoice, 0.75);
              }}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-cyan-300 border border-slate-800 rounded-xl text-xs font-bold transition-all shrink-0"
            >
              🐢 Phát âm câu tốc độ chậm (0.75x)
            </button>
          </div>

          {/* Sentence Masked Display with Target Word Hidden */}
          <form onSubmit={handleCheckDictation} className="space-y-4">
            <div className="p-6 bg-slate-850 rounded-2xl border border-slate-800 text-sm sm:text-base leading-relaxed text-slate-200">
              <span className="font-medium text-slate-300">
                {dictationMaskedDisplaySentence.split(/(\[\s*_{2,}\s*\])/g).map((part, idx) => {
                  if (/\[\s*_{2,}\s*\]/.test(part)) {
                    return (
                      <span 
                        key={idx} 
                        className="inline-flex items-center justify-center px-4 py-1 mx-1.5 bg-cyan-500/20 text-cyan-300 font-mono font-black border-2 border-dashed border-cyan-400 rounded-xl shadow-inner shadow-cyan-500/10 animate-pulse"
                      >
                        [ ? ? ? ? ? ]
                      </span>
                    );
                  }
                  return <span key={idx}>{part}</span>;
                })}
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={dictationInput}
                onChange={(e) => setDictationInput(e.target.value)}
                placeholder="Gõ từ tiếng Anh bạn nghe được vào đây..."
                autoFocus
                className="flex-1 bg-slate-950 border border-slate-750 focus:border-cyan-400 rounded-2xl px-5 py-3.5 text-sm sm:text-base text-white placeholder-slate-600 focus:outline-none transition-colors"
              />

              <button
                type="submit"
                disabled={!dictationInput.trim()}
                className="px-6 py-3.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-black rounded-2xl shadow-lg shadow-cyan-500/25 transition-all text-sm"
              >
                Kiểm Tra
              </button>
            </div>
          </form>

          {/* Result Feedback Toast */}
          {dictationFeedback === 'correct' && (
            <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-between animate-bounce">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Chính xác tuyệt đối! Đáp án là <strong>"{dictationTargetClean}"</strong> (+25 XP)</span>
              </div>
            </div>
          )}

          {dictationFeedback === 'wrong' && (
            <div className="p-4 bg-red-500/20 border border-red-500/40 text-red-300 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />
                <span>Chưa chính xác. Hãy nghe lại audio tốc độ chậm và thử lại! (-1 ❤️)</span>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. GAME AREA 4: CLASSIC QUIZ (TRẮC NGHIỆM 4 ĐÁP ÁN)                       */}
      {/* ========================================================================= */}
      {activeMode === 'classic_quiz' && currentQuizWord && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          {/* Question Top Bar */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Chọn nghĩa tiếng Việt đúng:
            </span>

            <button
              onClick={() => speakWord(cleanWordString(currentQuizWord.word), audioVoice, audioSpeed)}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-teal-400 rounded-xl transition-colors"
              title="Phát âm"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>

          {/* Word Display Banner */}
          <div className="text-center py-4 space-y-1">
            <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {cleanWordString(currentQuizWord.word)}
            </h3>
            {currentQuizWord.ipa && (
              <span className="text-xs text-slate-400 font-mono">
                {currentQuizWord.ipa} • ({currentQuizWord.partOfSpeech})
              </span>
            )}
          </div>

          {/* 4 Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quizOptions.map((opt, idx) => {
              const correctMeaning = cleanWordString(currentQuizWord.meaning).split(/[:;,]/)[0].trim();
              const isSelected = selectedQuizOption === opt;
              const isCorrect = opt === correctMeaning;

              let btnStyle = 'bg-slate-850 hover:bg-slate-800 border-slate-800 text-slate-200';
              if (isQuizAnswered) {
                if (isCorrect) {
                  btnStyle = 'bg-emerald-500/20 border-emerald-400 text-emerald-300 ring-1 ring-emerald-400';
                } else if (isSelected) {
                  btnStyle = 'bg-red-500/20 border-red-400 text-red-300';
                } else {
                  btnStyle = 'bg-slate-900 border-slate-850 text-slate-600 opacity-40';
                }
              }

              return (
                <button
                  key={idx}
                  disabled={isQuizAnswered}
                  onClick={() => handleSelectQuizOption(opt)}
                  className={`p-4 rounded-2xl border text-left font-bold text-xs sm:text-sm transition-all flex items-center justify-between ${btnStyle}`}
                >
                  <span>{opt}</span>
                  {isQuizAnswered && isCorrect && <Check className="w-4 h-4 text-emerald-400" />}
                </button>
              );
            })}
          </div>

          {/* Next Button */}
          {isQuizAnswered && (
            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={handleNextQuiz}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl shadow-lg shadow-emerald-500/20 transition-all"
              >
                <span>Câu Tiếp Theo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
