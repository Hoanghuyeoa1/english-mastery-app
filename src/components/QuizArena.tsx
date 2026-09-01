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
  Check, 
  Headphones
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAppStore } from '../store/useAppStore';
import { speakWord } from '../services/speechService';
import { getFullDictionaryBank } from '../services/dictionaryIndex';
import { 
  cleanWordString, 
  cleanMeaningForScramble,
  sanitizeExampleSentence, 
  maskTargetWordInSentence 
} from '../services/textSanitizer';
import { WordScramble } from './WordScramble';
import { VocabWord, VocabTag } from '../types';

type ArcadeMode = 'speed_match' | 'word_scramble' | 'dictation' | 'classic_quiz';

interface MatchTile {
  id: string;
  wordId: string;
  type: 'en' | 'vi';
  text: string;
  isMatched: boolean;
}

interface QuizArenaProps {
  defaultCategory?: string;
}

export const QuizArena: React.FC<QuizArenaProps> = ({ defaultCategory }) => {
  const { 
    vocabularyList, 
    gainXP, 
    consumeHeart, 
    audioVoice, 
    audioSpeed,
    recordMistake,
    recordMistakeCorrect
  } = useAppStore();

  const [activeMode, setActiveMode] = useState<ArcadeMode>(() => {
    if (defaultCategory === 'speed_match') return 'speed_match';
    if (defaultCategory === 'word_scramble') return 'word_scramble';
    if (defaultCategory === 'dictation') return 'dictation';
    if (defaultCategory === 'classic_quiz') return 'classic_quiz';
    return 'speed_match';
  });

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
      const cleanMeaning = cleanMeaningForScramble(w.meaning, cleanW);
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
      recordMistakeCorrect(tile.wordId);

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
      const enTile = selectedTile.type === 'en' ? selectedTile : tile.type === 'en' ? tile : null;
      if (enTile) {
        recordMistake({ word: enTile.text }, 'speed_match');
      }
      setWrongTileIds([selectedTile.id, tile.id]);
      setMatchCombo(0);
      setTimeout(() => {
        setWrongTileIds([]);
        setSelectedTile(null);
      }, 500);
    }
  };

  // ==========================================
  // 2. DICTATION MODE (NGHE CHÉP ĐIỀN TỪ) STATE
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

  const handleCheckDictation = () => {
    if (!dictationTargetClean || !dictationInput.trim()) return;

    const userInput = dictationInput.trim().toLowerCase();
    const target = dictationTargetClean.toLowerCase();

    if (userInput === target) {
      // ĐÚNG!
      setDictationFeedback('correct');
      if (dictationWord) recordMistakeCorrect(dictationWord.id || dictationWord.word);
      gainXP(25);
      setTotalXpSession((prev) => prev + 25);
      setStreakCount((prev) => prev + 1);
      confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });

      setTimeout(() => {
        initDictationRound();
      }, 1400);
    } else {
      // SAI!
      setDictationFeedback('wrong');
      if (dictationWord) recordMistake(dictationWord, 'dictation');
      consumeHeart();
      setTimeout(() => setDictationFeedback(null), 1200);
    }
  };

  // ==========================================
  // 3. CLASSIC QUIZ (TRẮC NGHIỆM 4 ĐÁP ÁN) STATE
  // ==========================================
  const [quizWord, setQuizWord] = useState<VocabWord | null>(null);
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<string | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<'correct' | 'wrong' | null>(null);

  const initClassicQuizRound = useCallback(() => {
    const pool = filteredVocab.length >= 4 ? filteredVocab : masterVocabBank;
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const target = shuffled[0];
    if (!target) return;

    const cleanTargetMeaning = cleanMeaningForScramble(target.meaning, target.word);
    const wrongOptions = shuffled
      .slice(1, 4)
      .map((w) => cleanMeaningForScramble(w.meaning, w.word))
      .filter((m) => m !== cleanTargetMeaning);

    // Bổ sung phương án nếu bị trùng
    while (wrongOptions.length < 3) {
      const randomW = pool[Math.floor(Math.random() * pool.length)];
      const randomM = cleanMeaningForScramble(randomW.meaning, randomW.word);
      if (randomM !== cleanTargetMeaning && !wrongOptions.includes(randomM)) {
        wrongOptions.push(randomM);
      }
    }

    const allOptions = [cleanTargetMeaning, ...wrongOptions].sort(() => 0.5 - Math.random());

    setQuizWord({ ...target, meaning: cleanTargetMeaning });
    setQuizOptions(allOptions);
    setSelectedQuizAnswer(null);
    setQuizFeedback(null);
  }, [filteredVocab, masterVocabBank]);

  const handleSelectQuizOption = (option: string) => {
    if (selectedQuizAnswer || !quizWord) return;
    setSelectedQuizAnswer(option);

    if (option === quizWord.meaning) {
      setQuizFeedback('correct');
      recordMistakeCorrect(quizWord.id || quizWord.word);
      speakWord(quizWord.word, audioVoice, audioSpeed);
      gainXP(15);
      setTotalXpSession((prev) => prev + 15);
      setStreakCount((prev) => prev + 1);
      confetti({ particleCount: 35, spread: 50, origin: { y: 0.7 } });

      setTimeout(() => {
        initClassicQuizRound();
      }, 1200);
    } else {
      setQuizFeedback('wrong');
      recordMistake(quizWord, 'quiz');
      consumeHeart();
      setTimeout(() => {
        initClassicQuizRound();
      }, 1400);
    }
  };

  // ==========================================
  // AUTO-INITIALIZER: TỰ ĐỘNG NẠP TRẬN ĐẤU KHI VỪA MỞ
  // ==========================================
  useEffect(() => {
    if (activeMode === 'speed_match') {
      if (matchTiles.length === 0 && !isMatchOver) {
        startSpeedMatch();
      }
    } else if (activeMode === 'dictation') {
      if (!dictationWord) {
        initDictationRound();
      }
    } else if (activeMode === 'classic_quiz') {
      if (!quizWord) {
        initClassicQuizRound();
      }
    }
  }, [
    activeMode, 
    matchTiles.length, 
    isMatchOver, 
    dictationWord, 
    quizWord, 
    startSpeedMatch, 
    initDictationRound, 
    initClassicQuizRound
  ]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      
      {/* 1. TOP HEADER & ARCADE MODE SWITCHER */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                <Zap className="w-5 h-5" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Đấu Trường Luyện Tập Arcade
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Các minigame phản xạ nhanh, rèn luyện chính tả và ngữ âm tiếng Anh đỉnh cao.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            {streakCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-2xl font-black text-xs">
                <Flame className="w-4 h-4 fill-orange-400 animate-pulse" />
                <span>Streak: {streakCount}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-2xl font-black text-xs font-mono">
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
                  if (mode.id === 'speed_match') startSpeedMatch();
                  if (mode.id === 'dictation') initDictationRound();
                  if (mode.id === 'classic_quiz') initClassicQuizRound();
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
                  if (activeMode === 'dictation') setTimeout(initDictationRound, 100);
                  if (activeMode === 'classic_quiz') setTimeout(initClassicQuizRound, 100);
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
      {/* 3. GAME AREA 2: WORD SCRAMBLE (GHÉP CHỮ RÈN CHÍNH TẢ - COMPONENT CHUYÊN BIỆT) */}
      {/* ========================================================================= */}
      {activeMode === 'word_scramble' && (
        <WordScramble
          vocabPool={filteredVocab.length > 0 ? filteredVocab : masterVocabBank}
          onGainXP={(xp) => {
            gainXP(xp);
            setTotalXpSession((prev) => prev + xp);
          }}
          onIncrementStreak={() => setStreakCount((prev) => prev + 1)}
          audioVoice={audioVoice}
          audioSpeed={audioSpeed}
        />
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
              <p className="text-xs text-slate-400 mt-0.5">
                Lắng nghe audio phát âm toàn bộ câu và gõ từ vựng còn thiếu vào ô trống.
              </p>
            </div>

            <button
              onClick={initDictationRound}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all border border-slate-700"
              title="Đổi câu khác"
            >
              <Shuffle className="w-4 h-4" />
            </button>
          </div>

          {/* Audio Player Controller */}
          <div className="bg-slate-850/80 border border-slate-750 rounded-2xl p-4 sm:p-6 text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => speakWord(dictationCleanAudioSentence, audioVoice, audioSpeed)}
                className="px-5 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black rounded-2xl shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 text-sm"
              >
                <Volume2 className="w-4 h-4" />
                <span>Phát Lại Câu (Tốc độ thường)</span>
              </button>

              <button
                onClick={() => {
                  setDictationSlow(!dictationSlow);
                  speakWord(dictationCleanAudioSentence, audioVoice, 0.7);
                }}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-amber-300 font-bold rounded-2xl transition-all text-xs flex items-center gap-1.5"
                title="Nghe tốc độ chậm 0.7x"
              >
                <span>🐢 Nghe Chậm (0.7x)</span>
              </button>
            </div>

            {/* Masked Sentence Display (ẨN TỪ MỤC TIÊU [ ________ ]) */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <p className="text-base sm:text-lg text-slate-200 font-medium leading-relaxed font-sans">
                "{dictationMaskedDisplaySentence}"
              </p>
              {dictationWord.meaning && (
                <p className="text-xs text-slate-400 mt-2">
                  💡 Gợi ý nghĩa: <strong className="text-emerald-400">{cleanMeaningForScramble(dictationWord.meaning, dictationWord.word)}</strong>
                </p>
              )}
            </div>
          </div>

          {/* User Input & Submit Form */}
          <div className="space-y-3 max-w-xl mx-auto">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={dictationInput}
                onChange={(e) => setDictationInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCheckDictation()}
                placeholder="Gõ từ còn thiếu vào đây..."
                autoFocus
                className={`flex-1 px-5 py-3.5 bg-slate-950 border-2 rounded-2xl text-white font-bold text-base focus:outline-none transition-all ${
                  dictationFeedback === 'correct'
                    ? 'border-emerald-500 ring-2 ring-emerald-500/40 bg-emerald-500/10'
                    : dictationFeedback === 'wrong'
                    ? 'border-red-500 ring-2 ring-red-500/40 bg-red-500/10'
                    : 'border-slate-750 focus:border-cyan-500'
                }`}
              />

              <button
                onClick={handleCheckDictation}
                disabled={!dictationInput.trim()}
                className="px-6 py-3.5 bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-black rounded-2xl text-sm shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Kiểm Tra
              </button>
            </div>

            {/* Feedback Message */}
            {dictationFeedback === 'correct' && (
              <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-bold animate-fadeIn">
                <CheckCircle2 className="w-4 h-4" />
                <span>Chính xác 100%! +25 XP</span>
              </div>
            )}

            {dictationFeedback === 'wrong' && (
              <div className="flex items-center justify-center gap-2 text-red-400 text-sm font-bold animate-shake">
                <XCircle className="w-4 h-4" />
                <span>Chưa chính xác! Hãy lắng nghe lại kỹ hơn nhé.</span>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. GAME AREA 4: CLASSIC QUIZ (TRẮC NGHIỆM 4 ĐÁP ÁN)                       */}
      {/* ========================================================================= */}
      {activeMode === 'classic_quiz' && quizWord && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Chọn nghĩa đúng của từ vựng sau:
            </span>

            <button
              onClick={initClassicQuizRound}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all border border-slate-700"
              title="Đổi câu hỏi khác"
            >
              <Shuffle className="w-4 h-4" />
            </button>
          </div>

          <div className="text-center py-6 space-y-3">
            <div className="inline-block px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-full text-xs font-bold border border-cyan-500/20">
              {quizWord.tag} {quizWord.partOfSpeech ? `• ${quizWord.partOfSpeech}` : ''}
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
              {quizWord.word}
            </h2>
            {quizWord.ipa && (
              <span className="text-sm font-mono text-slate-400 block">{quizWord.ipa}</span>
            )}
          </div>

          {/* 4 Choices */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {quizOptions.map((opt, idx) => {
              const isSelected = selectedQuizAnswer === opt;
              const isCorrect = opt === quizWord.meaning;
              let btnStyle = 'bg-slate-850 hover:bg-slate-800 border-slate-750 text-slate-200';

              if (selectedQuizAnswer) {
                if (isCorrect) {
                  btnStyle = 'bg-emerald-500/20 border-emerald-400 text-emerald-300 ring-2 ring-emerald-400/40';
                } else if (isSelected) {
                  btnStyle = 'bg-red-500/20 border-red-400 text-red-300 animate-shake';
                } else {
                  btnStyle = 'bg-slate-900 border-slate-850 text-slate-600 opacity-40';
                }
              }

              return (
                <button
                  key={idx}
                  disabled={!!selectedQuizAnswer}
                  onClick={() => handleSelectQuizOption(opt)}
                  className={`p-4 rounded-2xl border font-bold text-sm sm:text-base text-left transition-all flex items-center justify-between shadow-md ${btnStyle}`}
                >
                  <span>{opt}</span>
                  {selectedQuizAnswer && isCorrect && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

        </div>
      )}

    </div>
  );
};
