import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Target, 
  CheckCircle2, 
  XCircle, 
  Volume2, 
  ArrowRight, 
  Keyboard,
  Timer,
  Zap,
  Sparkles,
  Trophy,
  RotateCcw,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAppStore } from '../store/useAppStore';
import { speakWord } from '../services/speechService';
import { VocabWord } from '../types';

type QuizSubTab = 'multiple_choice' | 'cloze' | 'speed_match';

// Kiểm tra nghĩa có sạch không
function isValidCleanMeaning(meaning: string): boolean {
  if (!meaning || typeof meaning !== 'string') return false;
  const trimmed = meaning.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return false;
  if (/^(từ vựng|từ mới|vocabulary|lesson|unit|level)/i.test(trimmed)) return false;
  if (/[#\{\}\[\]\<\>]/i.test(trimmed)) return false;
  if (/trình độ\s+[A-Z0-9]/i.test(trimmed)) return false;
  if (/thông dụng:/i.test(trimmed)) return false;
  if (/^ví dụ:/i.test(trimmed)) return false;
  return true;
}

// Chuẩn hóa nghĩa sạch
function getSanitizedMeaning(word: VocabWord): string {
  if (!word || !word.meaning) return '';
  const text = word.meaning.trim();
  if (isValidCleanMeaning(text)) return text;
  const match = text.match(/:\s*["“']?([^"”']+)["”']?/);
  if (match && match[1] && match[1].trim().length > 1) {
    return match[1].trim();
  }
  return text;
}

interface MatchCard {
  id: string;
  wordId: string;
  type: 'word' | 'meaning';
  content: string;
  isMatched: boolean;
}

export const QuizArena: React.FC = () => {
  const { 
    vocabularyList, 
    gainXP, 
    consumeHeart, 
    recordQuizCompleted, 
    audioVoice, 
    audioSpeed 
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<QuizSubTab>('multiple_choice');
  const [currentIdx, setCurrentIdx] = useState(0);

  // 1. Multiple Choice State
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [scoreCount, setScoreCount] = useState(0);

  // 2. Cloze State
  const [clozeInput, setClozeInput] = useState('');
  const [clozeFeedback, setClozeFeedback] = useState<'correct' | 'wrong' | null>(null);

  // 3. Speed Match State
  const [matchCards, setMatchCards] = useState<MatchCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [matchScore, setMatchScore] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);

  // Pool từ vựng sạch
  const cleanVocabPool = useMemo(() => {
    const filtered = vocabularyList.filter((w) => isValidCleanMeaning(w.meaning));
    return filtered.length >= 10 ? filtered : vocabularyList;
  }, [vocabularyList]);

  const currentWord: VocabWord | undefined = cleanVocabPool[currentIdx % cleanVocabPool.length];
  const currentCleanMeaning = currentWord ? getSanitizedMeaning(currentWord) : '';

  // Sinh 4 options cho trắc nghiệm
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    if (!currentWord || !currentCleanMeaning) return;

    const candidateWords = cleanVocabPool.filter((w) => 
      w.id !== currentWord.id && 
      getSanitizedMeaning(w).toLowerCase() !== currentCleanMeaning.toLowerCase() &&
      isValidCleanMeaning(w.meaning)
    );

    const shuffledCandidates = [...candidateWords].sort(() => 0.5 - Math.random());
    const distractors: string[] = [];
    const seen = new Set<string>([currentCleanMeaning.toLowerCase()]);

    for (const item of shuffledCandidates) {
      const m = getSanitizedMeaning(item);
      if (!seen.has(m.toLowerCase())) {
        seen.add(m.toLowerCase());
        distractors.push(m);
        if (distractors.length >= 3) break;
      }
    }

    const backupPool = [
      'Phát triển bền vững, duy trì lâu dài',
      'Thành tựu đáng kể, kết quả xuất sắc',
      'Khả năng thích ứng với môi trường mới',
      'Phân tích chi tiết và đánh giá dữ liệu',
      'Tăng cường hiệu suất và năng suất làm việc',
    ];
    for (const fb of backupPool) {
      if (distractors.length >= 3) break;
      if (!seen.has(fb.toLowerCase())) {
        seen.add(fb.toLowerCase());
        distractors.push(fb);
      }
    }

    const candidateOptions = [currentCleanMeaning, ...distractors].sort(() => 0.5 - Math.random());
    setOptions(candidateOptions);

    setSelectedOption(null);
    setIsAnswered(false);
    setClozeInput('');
    setClozeFeedback(null);
  }, [currentIdx, cleanVocabPool, currentWord, currentCleanMeaning]);

  // Xử lý chọn đáp án Multiple Choice
  const handleSelectOption = useCallback((option: string) => {
    if (isAnswered || !currentWord || !currentCleanMeaning) return;

    setSelectedOption(option);
    setIsAnswered(true);

    const isCorrect = option === currentCleanMeaning;
    if (isCorrect) {
      setScoreCount((prev) => prev + 1);
      gainXP(15);
    } else {
      consumeHeart();
    }
  }, [isAnswered, currentWord, currentCleanMeaning, gainXP, consumeHeart]);

  const handleNextQuestion = useCallback(() => {
    if (currentIdx + 1 >= 5 && activeTab === 'multiple_choice') {
      recordQuizCompleted(scoreCount * 15, scoreCount >= 5);
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
    }
    setCurrentIdx((prev) => prev + 1);
  }, [currentIdx, activeTab, recordQuizCompleted, scoreCount]);

  // Lắng nghe phím tắt cho Multiple Choice
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (activeTab !== 'multiple_choice') return;

      if (isAnswered) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleNextQuestion();
          return;
        }
      }

      if (!isAnswered && options.length === 4) {
        if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1' || e.code === 'KeyA') {
          e.preventDefault();
          handleSelectOption(options[0]);
        } else if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2' || e.code === 'KeyB') {
          e.preventDefault();
          handleSelectOption(options[1]);
        } else if (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3' || e.code === 'KeyC') {
          e.preventDefault();
          handleSelectOption(options[2]);
        } else if (e.key === '4' || e.code === 'Digit4' || e.code === 'Numpad4' || e.code === 'KeyD') {
          e.preventDefault();
          handleSelectOption(options[3]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, isAnswered, options, handleSelectOption, handleNextQuestion]);

  // Xử lý nộp bài điền từ (Cloze)
  const handleSubmitCloze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWord || clozeFeedback !== null) return;

    const isMatch = clozeInput.trim().toLowerCase() === currentWord.word.trim().toLowerCase();
    if (isMatch) {
      setClozeFeedback('correct');
      gainXP(20);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    } else {
      setClozeFeedback('wrong');
      consumeHeart();
    }
  };

  // 3. Khởi tạo & Logic Game Ghép Thẻ Tốc Độ (Speed Match)
  const startSpeedMatchGame = useCallback(() => {
    const sampleWords = [...cleanVocabPool].sort(() => 0.5 - Math.random()).slice(0, 6);
    const cards: MatchCard[] = [];

    sampleWords.forEach((w) => {
      cards.push({
        id: `word_${w.id}`,
        wordId: w.id,
        type: 'word',
        content: w.word,
        isMatched: false,
      });
      cards.push({
        id: `meaning_${w.id}`,
        wordId: w.id,
        type: 'meaning',
        content: getSanitizedMeaning(w),
        isMatched: false,
      });
    });

    setMatchCards(cards.sort(() => 0.5 - Math.random()));
    setSelectedCardId(null);
    setMatchScore(0);
    setComboCount(0);
    setTimeLeft(60);
    setIsGameOver(false);
    setIsGameRunning(true);
  }, [cleanVocabPool]);

  // Đếm ngược thời gian Speed Match
  useEffect(() => {
    if (!isGameRunning || timeLeft <= 0) {
      if (isGameRunning && timeLeft <= 0) {
        setIsGameRunning(false);
        setIsGameOver(true);
        gainXP(matchScore * 5);
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isGameRunning, timeLeft, matchScore, gainXP]);

  // Xử lý click chọn thẻ ghép
  const handleCardClick = (card: MatchCard) => {
    if (!isGameRunning || card.isMatched) return;

    if (!selectedCardId) {
      setSelectedCardId(card.id);
      return;
    }

    if (selectedCardId === card.id) {
      setSelectedCardId(null);
      return;
    }

    const firstCard = matchCards.find((c) => c.id === selectedCardId);
    if (!firstCard) {
      setSelectedCardId(card.id);
      return;
    }

    // Kiểm tra khớp từ tiếng Anh với nghĩa tiếng Việt
    if (firstCard.wordId === card.wordId && firstCard.type !== card.type) {
      // Ghép đúng!
      const newCombo = comboCount + 1;
      setComboCount(newCombo);
      setMatchScore((prev) => prev + 10 * Math.min(newCombo, 3));
      
      setMatchCards((prev) =>
        prev.map((c) => (c.wordId === card.wordId ? { ...c, isMatched: true } : c))
      );
      setSelectedCardId(null);

      // Nếu đã ghép hết các cặp, nạp thêm đợt thẻ mới!
      const remainingUnmatched = matchCards.filter(
        (c) => !c.isMatched && c.wordId !== card.wordId
      );
      if (remainingUnmatched.length === 0) {
        const nextWords = [...cleanVocabPool].sort(() => 0.5 - Math.random()).slice(0, 6);
        const nextCards: MatchCard[] = [];
        nextWords.forEach((w) => {
          nextCards.push({
            id: `word_${w.id}_${Date.now()}`,
            wordId: w.id,
            type: 'word',
            content: w.word,
            isMatched: false,
          });
          nextCards.push({
            id: `meaning_${w.id}_${Date.now()}`,
            wordId: w.id,
            type: 'meaning',
            content: getSanitizedMeaning(w),
            isMatched: false,
          });
        });
        setMatchCards(nextCards.sort(() => 0.5 - Math.random()));
      }
    } else {
      // Ghép sai
      setComboCount(0);
      setSelectedCardId(null);
    }
  };

  const choiceLabels = ['A', 'B', 'C', 'D'];
  const clozeSentence = currentWord?.example?.replace(
    new RegExp(currentWord.word, 'gi'),
    '____________'
  ) || '...';

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      
      {/* Header & Sub-Tabs */}
      <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-2xl shadow-xl">
        <button
          onClick={() => setActiveTab('multiple_choice')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
            activeTab === 'multiple_choice'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Trắc Nghiệm 4 Đáp Án</span>
        </button>

        <button
          onClick={() => setActiveTab('cloze')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
            activeTab === 'cloze'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Keyboard className="w-4 h-4" />
          <span>Điền Từ Vào Câu</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('speed_match');
            if (!isGameRunning && !isGameOver) {
              startSpeedMatchGame();
            }
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
            activeTab === 'speed_match'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Ghép Thẻ Tốc Độ</span>
        </button>
      </div>

      {/* SUB-TAB 1: TRẮC NGHIỆM 4 ĐÁP ÁN */}
      {activeTab === 'multiple_choice' && currentWord && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                Câu hỏi #{currentIdx + 1}
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-400">Đúng: <strong className="text-emerald-400">{scoreCount}</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => speakWord(currentWord.word, audioVoice, audioSpeed)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full transition-all"
                title="Phát âm từ vựng"
              >
                <Volume2 className="w-4 h-4 text-emerald-400" />
              </button>
              <span className="text-xs font-semibold px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                +15 XP
              </span>
            </div>
          </div>

          {/* Question Word */}
          <div className="text-center py-4 space-y-2">
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Từ vựng này có nghĩa là gì?</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">{currentWord.word}</h2>
            <p className="text-emerald-400 font-mono text-sm">{currentWord.ipa}</p>
          </div>

          {/* 4 Choices */}
          <div className="grid grid-cols-1 gap-3">
            {options.map((option, idx) => {
              const isSelected = selectedOption === option;
              const isCorrect = option === currentCleanMeaning;
              const label = choiceLabels[idx] || `${idx + 1}`;
              
              let containerStyle = "bg-slate-850 hover:bg-slate-800 text-slate-200 border-slate-750 hover:border-slate-600";
              let badgeStyle = "bg-slate-800 text-slate-300 border-slate-700";

              if (isAnswered) {
                if (isCorrect) {
                  containerStyle = "bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-lg shadow-emerald-500/10";
                  badgeStyle = "bg-emerald-500 text-slate-950 font-black border-emerald-400";
                } else if (isSelected && !isCorrect) {
                  containerStyle = "bg-red-500/20 border-red-500 text-red-300 font-bold shadow-lg shadow-red-500/10";
                  badgeStyle = "bg-red-500 text-white font-black border-red-400";
                } else {
                  containerStyle = "opacity-40 border-slate-800 bg-slate-900";
                  badgeStyle = "bg-slate-900 text-slate-600 border-slate-800";
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(option)}
                  disabled={isAnswered}
                  className={`p-4 rounded-2xl border text-left text-sm sm:text-base font-medium transition-all flex items-center justify-between gap-3 group ${containerStyle}`}
                >
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <span className={`w-8 h-8 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0 transition-all ${badgeStyle}`}>
                      {label}
                    </span>
                    <span className="leading-snug break-words">{option}</span>
                  </div>

                  {isAnswered && isCorrect && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 animate-bounce" />
                  )}
                  {isAnswered && isSelected && !isCorrect && (
                    <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Action Button & Shortcuts */}
          {isAnswered ? (
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                Nhấn <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-emerald-400 font-mono font-bold">Enter</kbd> hoặc <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-emerald-400 font-mono font-bold">Space</kbd> để sang câu tiếp theo
              </span>

              <button
                onClick={handleNextQuestion}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl shadow-xl shadow-emerald-500/25 transition-all transform hover:scale-105 text-sm"
              >
                <span>Câu tiếp theo (Enter)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="pt-3 border-t border-slate-850 flex items-center justify-center gap-2 text-xs text-slate-500">
              <Keyboard className="w-3.5 h-3.5 text-emerald-400" />
              <span>Phím tắt: Bấm <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300 font-mono">1, 2, 3, 4</kbd> hoặc <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300 font-mono">A, B, C, D</kbd> để chọn nhanh</span>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: ĐIỀN TỪ VÀO CÂU */}
      {activeTab === 'cloze' && currentWord && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Điền Từ Vào Câu Ngữ Cảnh
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
              +20 XP
            </span>
          </div>

          <div className="bg-slate-850 border border-slate-750 p-6 rounded-2xl space-y-3">
            <p className="text-base sm:text-lg text-slate-100 font-medium leading-relaxed">
              "{clozeSentence}"
            </p>
            <p className="text-xs sm:text-sm text-slate-400">
              → Gợi ý nghĩa: <strong className="text-emerald-400">{currentCleanMeaning}</strong> ({currentWord.partOfSpeech})
            </p>
          </div>

          <form onSubmit={handleSubmitCloze} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={clozeInput}
                onChange={(e) => setClozeInput(e.target.value)}
                disabled={clozeFeedback !== null}
                placeholder={`Gợi ý: bắt đầu bằng '${currentWord.word[0]}...'`}
                className="w-full bg-slate-950 border-2 border-slate-700 focus:border-emerald-500 rounded-2xl px-5 py-4 text-lg text-white placeholder-slate-500 focus:outline-none transition-colors"
                autoFocus
              />
            </div>

            {clozeFeedback === null ? (
              <button
                type="submit"
                disabled={!clozeInput.trim()}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20"
              >
                Kiểm tra đáp án
              </button>
            ) : (
              <div className="space-y-4">
                <div className={`p-4 rounded-2xl flex items-center justify-between ${
                  clozeFeedback === 'correct' 
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' 
                    : 'bg-red-500/20 border border-red-500/40 text-red-300'
                }`}>
                  <div className="flex items-center gap-2">
                    {clozeFeedback === 'correct' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    <span className="font-bold">
                      {clozeFeedback === 'correct' ? 'Chính xác (+20 XP)!' : `Chưa đúng! Đáp án đúng là: ${currentWord.word}`}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                  <span>Từ tiếp theo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* SUB-TAB 3: THỬ THÁCH TỐC ĐỘ / GHÉP THẺ */}
      {activeTab === 'speed_match' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          {/* Top Bar: Timer, Score & Combo */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-mono font-bold text-sm ${
                timeLeft <= 10 ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse' : 'bg-slate-800 text-emerald-400 border border-slate-700'
              }`}>
                <Timer className="w-4 h-4" />
                <span>{timeLeft}s</span>
              </div>

              {comboCount > 1 && (
                <div className="flex items-center gap-1 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-black animate-bounce">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Combo x{comboCount}</span>
                </div>
              )}
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-400 font-semibold">Điểm số: </span>
              <strong className="text-lg font-black text-white">{matchScore}</strong>
            </div>
          </div>

          {/* Game Over Screen */}
          {isGameOver ? (
            <div className="py-8 text-center space-y-5">
              <div className="w-20 h-20 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-3xl flex items-center justify-center mx-auto shadow-xl">
                <Trophy className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl sm:text-3xl font-black text-white">Hết Giờ! Hoàn Thành Thử Thách 🎉</h3>
                <p className="text-slate-400 text-sm">
                  Bạn đã đạt được <strong className="text-amber-400 font-black text-lg">{matchScore} điểm</strong> và nhận thưởng <strong className="text-emerald-400 font-bold">+{matchScore * 5} XP</strong>!
                </p>
              </div>

              <button
                onClick={startSpeedMatchGame}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 mx-auto"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Chơi lại ván mới</span>
              </button>
            </div>
          ) : (
            /* Cards Grid */
            <div className="space-y-4">
              <p className="text-xs text-slate-400 text-center">
                👉 Nhấp 1 thẻ <strong className="text-emerald-400">Từ tiếng Anh</strong> và 1 thẻ <strong className="text-cyan-400">Nghĩa tiếng Việt</strong> tương ứng để ghép cặp!
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {matchCards.map((card) => {
                  const isSelected = selectedCardId === card.id;
                  
                  if (card.isMatched) {
                    return (
                      <div
                        key={card.id}
                        className="p-4 rounded-2xl bg-slate-950/40 border border-slate-850 text-slate-600 flex items-center justify-center text-xs font-semibold select-none opacity-30"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        <span>Đã ghép</span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={card.id}
                      onClick={() => handleCardClick(card)}
                      className={`p-4 rounded-2xl border text-center text-xs sm:text-sm font-bold transition-all transform active:scale-95 shadow-md flex items-center justify-center min-h-[75px] ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-400/50 scale-105'
                          : card.type === 'word'
                          ? 'bg-slate-850 hover:bg-slate-800 border-slate-700 text-white hover:border-emerald-500/50'
                          : 'bg-slate-850 hover:bg-slate-800 border-slate-700 text-cyan-300 hover:border-cyan-500/50'
                      }`}
                    >
                      <span>{card.content}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
