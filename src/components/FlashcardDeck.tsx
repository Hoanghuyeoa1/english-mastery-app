import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Volume2, 
  VolumeX,
  RotateCw, 
  Sparkles, 
  Keyboard,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Brain,
  PlusCircle,
  Settings,
  Flame,
  ArrowRight,
  RefreshCw,
  Award,
  Star,
  Eye,
  EyeOff,
  FileText,
  Bookmark
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAppStore } from '../store/useAppStore';
import { isDueForReview, formatIntervalPreview } from '../services/srsAlgorithm';
import { speakWord } from '../services/speechService';
import { SRSGrade, VocabTag, VocabWord } from '../types';
import { DailySettingsModal } from './DailySettingsModal';

type QueueMode = 'DUE' | 'NEW';
type FilterTag = 'ALL' | 'FAVORITE' | 'SAVED_SENTENCES' | VocabTag;

const AUDIO_SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25];

// Helper phân biệt từ vựng đơn/cụm ngắn vs câu dịch/đoạn văn dài
export const isSentenceItem = (w: VocabWord): boolean => {
  if (!w.word) return false;
  const wordCount = w.word.trim().split(/\s+/).length;
  return (
    wordCount > 4 || 
    w.word.trim().length > 35 || 
    (w.tag as string) === 'Sentence' || 
    (w.partOfSpeech as string) === 'sentence'
  );
};

export const FlashcardDeck: React.FC = () => {
  const { 
    vocabularyList, 
    processReview, 
    audioVoice, 
    audioSpeed, 
    setAudioSpeed,
    autoPlayAudio,
    setAutoPlayAudio,
    isMaskExample,
    setIsMaskExample,
    toggleFavorite,
    profile, 
    dailyHistory,
    addExtraNewWords
  } = useAppStore();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<FilterTag>('ALL');
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExampleRevealed, setIsExampleRevealed] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const todayProgress = dailyHistory[today] || {
    date: today,
    wordsReviewed: 0,
    newWordsLearned: 0,
    quizzesCompleted: 0,
    pronunciationsMastered: 0,
    xpGained: 0,
  };

  const dailyNewLimit = (profile.targetDailyNewWords || 15) + (profile.extraNewWordsBonus || 0);
  const newWordsLearnedCount = todayProgress.newWordsLearned || 0;
  const isDailyNewGoalCompleted = newWordsLearnedCount >= dailyNewLimit;

  // 1. Hàng đợi Ôn tập (Due Review Queue) - Đã phân tách từ vựng vs câu dịch
  const dueReviewWords = useMemo(() => {
    return vocabularyList.filter((w) => {
      const isDue = isDueForReview(w.nextReviewDate);
      const isAlreadyLearned = w.srsLevel > 0 || !!w.lastReviewedDate;
      if (!isDue || !isAlreadyLearned) return false;

      const isSentence = isSentenceItem(w);

      if (selectedTag === 'SAVED_SENTENCES') {
        return isSentence;
      }
      if (selectedTag === 'FAVORITE') {
        return !!w.isFavorite;
      }
      if (selectedTag === 'ALL') {
        // Mặc định tab Tất Cả: Chỉ nạp các từ vựng / cụm từ cốt lõi
        return !isSentence;
      }
      // Các chủ đề cụ thể (Tech, IELTS, TOEIC...): Chỉ lấy từ vựng thuộc tag đó
      return !isSentence && w.tag === selectedTag;
    });
  }, [vocabularyList, selectedTag]);

  // 2. Hàng đợi Từ mới (New Words Queue) - Đã phân tách từ vựng vs câu dịch
  const allUnlearnedWords = useMemo(() => {
    return vocabularyList.filter((w) => {
      const isUnlearned = w.srsLevel === 0 && !w.lastReviewedDate;
      if (!isUnlearned) return false;

      const isSentence = isSentenceItem(w);

      if (selectedTag === 'SAVED_SENTENCES') {
        return isSentence;
      }
      if (selectedTag === 'FAVORITE') {
        return !!w.isFavorite;
      }
      if (selectedTag === 'ALL') {
        // Mặc định tab Tất Cả: Chỉ nạp các từ vựng / cụm từ cốt lõi
        return !isSentence;
      }
      return !isSentence && w.tag === selectedTag;
    });
  }, [vocabularyList, selectedTag]);

  // Đếm số lượng câu dịch đã lưu & từ yêu thích
  const savedSentencesCount = useMemo(() => {
    return vocabularyList.filter((w) => isSentenceItem(w)).length;
  }, [vocabularyList]);

  const favoriteCount = useMemo(() => {
    return vocabularyList.filter((w) => w.isFavorite).length;
  }, [vocabularyList]);

  // Số lượng từ mới còn lại cần nạp hôm nay
  const remainingNewCount = Math.max(0, dailyNewLimit - newWordsLearnedCount);
  const currentNewQueueWords = useMemo(() => {
    return allUnlearnedWords.slice(0, remainingNewCount);
  }, [allUnlearnedWords, remainingNewCount]);

  // Mặc định chọn hàng đợi Ôn tập nếu có từ đến hạn
  const [queueMode, setQueueMode] = useState<QueueMode>(() => {
    const dueCount = vocabularyList.filter((w) => isDueForReview(w.nextReviewDate) && (w.srsLevel > 0 || !!w.lastReviewedDate) && !isSentenceItem(w)).length;
    return dueCount > 0 ? 'DUE' : 'NEW';
  });

  // Active items for current queue
  const activeWords = queueMode === 'DUE' ? dueReviewWords : currentNewQueueWords;
  const currentWord: VocabWord | undefined = activeWords[currentIndex];

  // Kiểm tra xem mục học hiện tại là câu dài (Sentence)
  const isCurrentSentence = useMemo(() => {
    return currentWord ? isSentenceItem(currentWord) : false;
  }, [currentWord]);

  // Bộ chọn tốc độ đọc phát âm linh hoạt (0.5x -> 0.75x -> 1.0x -> 1.25x)
  const handleCycleAudioSpeed = useCallback(() => {
    const currentIdx = AUDIO_SPEED_PRESETS.findIndex((s) => Math.abs(s - (audioSpeed || 1.0)) < 0.08);
    const nextIdx = currentIdx === -1 ? 1 : (currentIdx + 1) % AUDIO_SPEED_PRESETS.length;
    const nextSpeed = AUDIO_SPEED_PRESETS[nextIdx];
    setAudioSpeed(nextSpeed);
  }, [audioSpeed, setAudioSpeed]);

  const speedBadge = useMemo(() => {
    const speed = audioSpeed || 1.0;
    if (speed <= 0.6) return { label: '0.5x', icon: '🐢', desc: 'Rất chậm' };
    if (speed <= 0.85) return { label: '0.75x', icon: '🐢', desc: 'Chậm / Rõ âm' };
    if (speed <= 1.1) return { label: '1.0x', icon: '⚡', desc: 'Chuẩn bản xứ' };
    return { label: '1.25x', icon: '🚀', desc: 'Nhanh phản xạ' };
  }, [audioSpeed]);

  const handlePlayAudio = useCallback((text: string, customSpeed?: number) => {
    const rate = customSpeed !== undefined ? customSpeed : (audioSpeed || 1.0);
    speakWord(text, audioVoice, rate);
  }, [audioVoice, audioSpeed]);

  // Tự động phát âm khi chuyển thẻ từ vựng mới
  useEffect(() => {
    setIsExampleRevealed(false);
    if (autoPlayAudio && currentWord) {
      const timer = setTimeout(() => {
        handlePlayAudio(currentWord.word);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [currentWord?.id, autoPlayAudio, handlePlayAudio]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setIsExampleRevealed(false);
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < activeWords.length - 1) {
      setIsFlipped(false);
      setIsExampleRevealed(false);
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, activeWords.length]);

  const fireSuccessConfetti = useCallback(() => {
    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'],
    });
  }, []);

  // Đánh giá mức độ ghi nhớ SM-2
  const handleGrade = useCallback((grade: SRSGrade) => {
    if (!currentWord) return;

    processReview(currentWord.id, grade);
    setIsFlipped(false);
    setIsExampleRevealed(false);

    if (currentIndex >= activeWords.length - 1) {
      fireSuccessConfetti();
      setCurrentIndex(0);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentWord, currentIndex, activeWords.length, processReview, fireSuccessConfetti]);

  // Toggle Bookmark / Favorite
  const handleToggleFavorite = useCallback(() => {
    if (currentWord) {
      toggleFavorite(currentWord.id);
    }
  }, [currentWord, toggleFavorite]);

  // Bộ lắng nghe phím tắt
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
        return;
      }

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        handlePrev();
        return;
      }

      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        handleNext();
        return;
      }

      if (e.code === 'KeyR') {
        e.preventDefault();
        if (currentWord) handlePlayAudio(currentWord.word);
        return;
      }

      if (e.code === 'KeyS') {
        e.preventDefault();
        handleCycleAudioSpeed();
        return;
      }

      // Phím B hoặc F: Gắn/bỏ sao (Bookmark / Favorite)
      if (e.code === 'KeyB' || e.code === 'KeyF') {
        e.preventDefault();
        handleToggleFavorite();
        return;
      }

      // Phím M: Bật/Tắt che từ trong ví dụ (Mask mode)
      if (e.code === 'KeyM') {
        e.preventDefault();
        setIsMaskExample(!isMaskExample);
        return;
      }

      if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') {
        e.preventDefault();
        handleGrade(0);
      } else if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') {
        e.preventDefault();
        handleGrade(1);
      } else if (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3') {
        e.preventDefault();
        handleGrade(2);
      } else if (e.key === '4' || e.code === 'Digit4' || e.code === 'Numpad4') {
        e.preventDefault();
        handleGrade(3);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentWord, handleGrade, handlePlayAudio, handlePrev, handleNext, handleToggleFavorite, isMaskExample, setIsMaskExample, handleCycleAudioSpeed]);

  const handleAddMoreWords = (count: number) => {
    addExtraNewWords(count);
    fireSuccessConfetti();
  };

  const tagsList: FilterTag[] = [
    'ALL', 
    'FAVORITE', 
    'SAVED_SENTENCES', 
    'Tech', 
    'IELTS', 
    'TOEIC', 
    'Business', 
    'Academic', 
    'Daily', 
    'Idioms'
  ];

  // Masking Cloze Helper
  const renderMaskedExample = (example: string, targetWord: string) => {
    if (!isMaskExample || isExampleRevealed || !example) {
      return example;
    }

    const regex = new RegExp(`\\b${targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    if (!regex.test(example)) {
      return example;
    }

    const parts = example.split(regex);
    return (
      <span>
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            {part}
            {i < parts.length - 1 && (
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExampleRevealed(true);
                }}
                className="px-2 py-0.5 mx-1 bg-amber-500/20 text-amber-300 border border-dashed border-amber-500/50 rounded cursor-pointer font-bold select-none hover:bg-amber-500/30 transition-all text-xs"
                title="Bấm để hiển thị từ khóa bị che"
              >
                [ ? ? ? ]
              </span>
            )}
          </React.Fragment>
        ))}
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      
      {/* 1. DUAL QUEUE SWITCHER: ÔN TẬP VS HỌC TỪ MỚI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        {/* Tab 1: Ôn Tập SRS (Due Reviews) */}
        <button
          onClick={() => {
            setQueueMode('DUE');
            setCurrentIndex(0);
            setIsFlipped(false);
          }}
          className={`relative p-4 rounded-3xl border transition-all text-left flex items-center justify-between overflow-hidden ${
            queueMode === 'DUE'
              ? 'bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-slate-900 border-emerald-500 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/50'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850 opacity-80 hover:opacity-100'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              queueMode === 'DUE' 
                ? 'bg-emerald-400 text-slate-950 font-black shadow-lg shadow-emerald-400/30' 
                : 'bg-slate-800 text-emerald-400'
            }`}>
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-white">🔄 Hàng Đợi Ôn Tập</span>
                {dueReviewWords.length > 0 && (
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-bold animate-pulse">
                    Đến hạn
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Thuật toán lặp lại ngắt quãng SM-2
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className={`text-2xl font-black ${dueReviewWords.length > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
              {dueReviewWords.length}
            </div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Từ cần ôn</span>
          </div>
        </button>

        {/* Tab 2: Học Từ Mới (New Words) */}
        <button
          onClick={() => {
            setQueueMode('NEW');
            setCurrentIndex(0);
            setIsFlipped(false);
          }}
          className={`relative p-4 rounded-3xl border transition-all text-left flex items-center justify-between overflow-hidden ${
            queueMode === 'NEW'
              ? 'bg-gradient-to-r from-teal-500/20 via-cyan-500/15 to-slate-900 border-cyan-500 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-500/50'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850 opacity-80 hover:opacity-100'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              queueMode === 'NEW' 
                ? 'bg-cyan-400 text-slate-950 font-black shadow-lg shadow-cyan-400/30' 
                : 'bg-slate-800 text-cyan-400'
            }`}>
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-white">✨ Học Từ Mới</span>
                {isDailyNewGoalCompleted && (
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-bold">
                    Đạt mục tiêu 🎉
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Hôm nay: {newWordsLearnedCount}/{dailyNewLimit} từ mới
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-black text-cyan-400">
              {newWordsLearnedCount}<span className="text-sm font-semibold text-slate-500">/{dailyNewLimit}</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Tiến độ ngày</span>
          </div>
        </button>
      </div>

      {/* 2. DAILY TARGET PROGRESS & ERGONOMIC TOGGLE TOOLBAR */}
      <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Daily Counters */}
          <div className="flex items-center gap-2.5 text-xs flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded-xl font-semibold">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">Cần ôn:</span>
              <strong className="text-emerald-400">{dueReviewWords.length} mục</strong>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded-xl font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">Từ mới:</span>
              <strong className="text-cyan-400">{newWordsLearnedCount} / {dailyNewLimit}</strong>
            </div>
          </div>

          {/* Quick Ergonomic Toggles: Auto-play Audio & Mask Cloze & Settings */}
          <div className="flex items-center gap-2 flex-wrap">
            
            {/* Audio Speed Selector Button */}
            <button
              onClick={handleCycleAudioSpeed}
              title={`Tốc độ đọc hiện tại: ${speedBadge.label} (${speedBadge.desc}). Bấm để đổi (Phím S).`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all border bg-slate-800 border-slate-700 text-amber-300 hover:border-amber-500/50 hover:bg-slate-750"
            >
              <span>{speedBadge.icon}</span>
              <span>Tốc độ: {speedBadge.label}</span>
            </button>

            {/* Auto-Play Audio Toggle */}
            <button
              onClick={() => setAutoPlayAudio(!autoPlayAudio)}
              title={`Tự động phát âm khi chuyển từ (${autoPlayAudio ? 'Đang BẬT' : 'Đang TẮT'})`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                autoPlayAudio
                  ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300 shadow-sm'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {autoPlayAudio ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>Tự phát âm: {autoPlayAudio ? 'Bật' : 'Tắt'}</span>
            </button>

            {/* Masking Cloze Mode Toggle */}
            <button
              onClick={() => setIsMaskExample(!isMaskExample)}
              title={`Ẩn từ khóa trong câu ví dụ (${isMaskExample ? 'Đang BẬT' : 'Đang TẮT'}) - Phím tắt M`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                isMaskExample
                  ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 shadow-sm'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {isMaskExample ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
              <span>Che từ ví dụ</span>
            </button>

            {/* Daily Limit Settings */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              title="Thiết lập mục tiêu từ mới mỗi ngày"
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl transition-all"
            >
              <Settings className="w-3.5 h-3.5 text-emerald-400" />
            </button>
          </div>
        </div>

        {/* Dual Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[11px] text-slate-400 font-medium">
            <span>Tiến độ nạp từ mới hôm nay</span>
            <span className="font-bold text-white">
              {Math.min(100, Math.round((newWordsLearnedCount / Math.max(1, dailyNewLimit)) * 100))}%
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (newWordsLearnedCount / Math.max(1, dailyNewLimit)) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. TAG & FAVORITE FILTER BAR (ĐÃ TÁCH BIỆT TAB ĐOẠN DỊCH / ĐÃ LƯU) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap pl-1">
          Lọc theo:
        </span>
        {tagsList.map((tag) => {
          const isSelected = selectedTag === tag;
          let label: string = tag;
          if (tag === 'ALL') label = '📚 Từ Vựng Cốt Lõi';
          if (tag === 'FAVORITE') label = `⭐ Yêu Thích (${favoriteCount})`;
          if (tag === 'SAVED_SENTENCES') label = `📝 Đoạn Dịch / Đã Lưu (${savedSentencesCount})`;

          return (
            <button
              key={tag}
              onClick={() => {
                setSelectedTag(tag);
                setCurrentIndex(0);
                setIsFlipped(false);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isSelected
                  ? tag === 'SAVED_SENTENCES'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold shadow-sm'
                    : tag === 'FAVORITE'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold shadow-sm'
                    : 'bg-slate-700 text-emerald-400 border border-emerald-500/40 font-bold shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {tag === 'FAVORITE' && <Star className={`w-3.5 h-3.5 ${isSelected ? 'fill-amber-400 text-amber-400' : 'text-amber-400'}`} />}
              {tag === 'SAVED_SENTENCES' && <FileText className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. MAIN CONTENT AREA */}
      
      {/* CASE A: QUEUE ÔN TẬP - HẾT TỪ ĐẾN HẠN */}
      {queueMode === 'DUE' && dueReviewWords.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center shadow-2xl space-y-5">
          <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto border border-emerald-500/20">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-pulse" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-2xl sm:text-3xl font-black text-white">Tuyệt vời! Đã hoàn thành ôn tập hôm nay 🎉</h3>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              Không còn mục nào đến hạn ôn tập trong danh mục này theo thuật toán Spaced Repetition SM-2.
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => {
                setQueueMode('NEW');
                setCurrentIndex(0);
              }}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-extrabold rounded-2xl text-sm shadow-xl shadow-cyan-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Chuyển sang Học Từ Mới ({remainingNewCount} từ)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* CASE B: QUEUE TỪ MỚI - ĐÃ HOÀN THÀNH MỤC TIÊU NGÀY */}
      {queueMode === 'NEW' && isDailyNewGoalCompleted && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border-2 border-emerald-500/40 rounded-3xl p-8 sm:p-12 text-center shadow-2xl space-y-6">
          <div className="w-20 h-20 bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
            <Award className="w-10 h-10 stroke-[2.5]" />
          </div>

          <div className="space-y-2">
            <div className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-black uppercase tracking-wider">
              Mục Tiêu Đã Hoàn Thành
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white">
              Chúc Mừng! Bạn Đã Học Đủ {newWordsLearnedCount} Từ Mới Hôm Nay! 🎉
            </h3>
            <p className="text-slate-400 text-sm max-w-lg mx-auto">
              Bạn đã hoàn thành xuất sắc mục tiêu nạp từ mới hàng ngày. Hãy chọn học thêm nếu vẫn còn tràn đầy năng lượng!
            </p>
          </div>

          {/* Action Buttons to Add More Words */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => handleAddMoreWords(5)}
              className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Học thêm +5 từ mới</span>
            </button>
            <button
              onClick={() => handleAddMoreWords(10)}
              className="px-5 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Học thêm +10 từ mới</span>
            </button>
          </div>
        </div>
      )}

      {/* CASE C: ACTIVE FLASHCARD LEARNING VIEW */}
      {activeWords.length > 0 && (!isDailyNewGoalCompleted || queueMode === 'DUE') && (
        <>
          {/* Top Session Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-400 px-1">
              <span>
                {queueMode === 'DUE' ? '🔄 Đang ôn tập:' : '✨ Đang học từ mới:'}{' '}
                <strong className="text-white">{currentIndex + 1} / {activeWords.length}</strong>
              </span>
              
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-mono">
                  {queueMode === 'DUE' ? `SRS Level: ${currentWord?.srsLevel || 0}` : '🌟 Từ Mới'}
                </span>
                <span>•</span>
                <span className="text-slate-500">
                  {isCurrentSentence ? 'Đoạn Dịch' : currentWord?.tag}
                </span>
              </div>
            </div>

            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  queueMode === 'DUE' 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                    : 'bg-gradient-to-r from-teal-400 to-cyan-400'
                }`}
                style={{ width: `${((currentIndex + 1) / activeWords.length) * 100}%` }}
              />
            </div>
          </div>

          {/* 3D Flashcard Item */}
          <div 
            onClick={() => setIsFlipped(!isFlipped)}
            className="w-full min-h-[420px] perspective-1000 cursor-pointer select-none"
          >
            <motion.div
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
              className="w-full min-h-[420px] relative transform-style-3d"
            >
              
              {/* MẶT TRƯỚC (Front) */}
              <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border-2 border-slate-800 hover:border-emerald-500/50 rounded-3xl p-6 sm:p-8 flex flex-col justify-between backface-hidden shadow-2xl transition-colors">
                
                {/* Top Bar of Front */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {isCurrentSentence ? (
                      <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-full border border-cyan-500/20 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Đoạn dịch / Sentence</span>
                      </span>
                    ) : (
                      <>
                        <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                          {currentWord?.tag}
                        </span>
                        {currentWord?.partOfSpeech && (
                          <span className="text-xs text-slate-500 italic">
                            ({currentWord?.partOfSpeech})
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Star / Bookmark Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite();
                      }}
                      title={currentWord?.isFavorite ? 'Bỏ đánh dấu yêu thích (Phím B)' : 'Đánh dấu từ yêu thích (Phím B)'}
                      className={`p-2.5 rounded-full transition-all text-xs font-semibold flex items-center gap-1 ${
                        currentWord?.isFavorite
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-lg shadow-amber-500/20 scale-110'
                          : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-amber-400'
                      }`}
                    >
                      <Star className={`w-4 h-4 ${currentWord?.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>

                    {/* Speed Selector Toggle Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCycleAudioSpeed();
                      }}
                      title={`Tốc độ đọc hiện tại: ${speedBadge.label} (${speedBadge.desc}). Bấm để đổi tốc độ.`}
                      className="px-2.5 py-1.5 bg-slate-800/90 hover:bg-slate-750 border border-slate-700/80 text-amber-300 hover:text-amber-200 rounded-full transition-all text-xs font-bold font-mono flex items-center gap-1 shadow-sm active:scale-95"
                    >
                      <span>{speedBadge.icon}</span>
                      <span>{speedBadge.label}</span>
                    </button>

                    {/* Audio Play Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayAudio(currentWord?.word || '');
                      }}
                      title={`Phát âm với tốc độ ${speedBadge.label} (Phím R)`}
                      className="p-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-full transition-all shadow-lg shadow-emerald-500/20 hover:scale-110"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Center Core Word or Sentence */}
                <div className="text-center my-auto py-6 space-y-4">
                  {isCurrentSentence ? (
                    /* Dành cho câu dài / đoạn dịch */
                    <div className="space-y-3 max-w-2xl mx-auto">
                      <h2 className="text-lg sm:text-2xl font-bold text-white leading-relaxed tracking-normal">
                        "{currentWord?.word}"
                      </h2>
                    </div>
                  ) : (
                    /* Dành cho từ vựng đơn / cụm collocation ngắn */
                    <div className="space-y-3">
                      <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight flex items-center justify-center gap-2">
                        <span>{currentWord?.word}</span>
                        {currentWord?.isFavorite && (
                          <Star className="w-6 h-6 fill-amber-400 text-amber-400 inline shrink-0" />
                        )}
                      </h2>
                      
                      {/* Ẩn ô phiên âm nếu rỗng hoặc không có dữ liệu */}
                      {currentWord?.ipa && currentWord.ipa.trim().length > 0 && currentWord.ipa.trim() !== '//' && (
                        <div className="inline-block px-4 py-1.5 bg-slate-800/80 rounded-xl text-emerald-400 font-mono text-base sm:text-lg border border-slate-700/50">
                          {currentWord.ipa}
                        </div>
                      )}

                      {currentWord?.definitionEn && (
                        <p className="text-slate-400 text-sm sm:text-base max-w-md mx-auto pt-1 italic">
                          "{currentWord.definitionEn}"
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Flip Hint (Dynamic Label for Front) */}
                <div className="flex justify-center items-center gap-2 text-xs text-slate-400 pt-4 border-t border-slate-800/80">
                  <RotateCw className="w-4 h-4 text-emerald-400 animate-spin-slow" />
                  <span>Chạm vào thẻ hoặc nhấn <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-emerald-400 font-mono">Space</kbd> để xem nghĩa</span>
                </div>
              </div>

              {/* MẶT SAU (Back) */}
              <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 border-2 border-emerald-500/40 rounded-3xl p-6 sm:p-8 flex flex-col justify-between backface-hidden rotate-y-180 shadow-2xl">
                
                <div className="space-y-4">
                  {/* Top Bar of Back */}
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      {isCurrentSentence ? 'Bản Dịch Nghĩa Tiếng Việt' : 'Định nghĩa tiếng Việt'}
                    </span>
                    
                    <div className="flex items-center gap-2">
                      {/* Star Button on Back */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite();
                        }}
                        title={currentWord?.isFavorite ? 'Bỏ đánh dấu yêu thích' : 'Đánh dấu từ yêu thích'}
                        className={`p-1.5 rounded-full transition-all text-xs ${
                          currentWord?.isFavorite
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-amber-400'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${currentWord?.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>

                      {/* Speed Button on Back */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCycleAudioSpeed();
                        }}
                        title={`Tốc độ đọc: ${speedBadge.label}. Bấm để đổi.`}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-amber-300 rounded-full text-xs font-mono font-bold flex items-center gap-1"
                      >
                        <span>{speedBadge.icon}</span>
                        <span>{speedBadge.label}</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayAudio(currentWord?.example || currentWord?.word || '');
                        }}
                        title={`Nghe audio với tốc độ ${speedBadge.label}`}
                        className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-full text-xs flex items-center gap-1.5"
                      >
                        <Volume2 className="w-4 h-4 text-emerald-400" />
                        <span>Nghe audio</span>
                      </button>
                    </div>
                  </div>

                  {/* Vietnamese Meaning */}
                  <div>
                    <h3 className={`${isCurrentSentence ? 'text-lg sm:text-xl font-bold text-emerald-300 leading-relaxed' : 'text-2xl sm:text-3xl font-extrabold text-white leading-snug'}`}>
                      {currentWord?.meaning}
                    </h3>
                  </div>

                  {/* Example Context (Chỉ hiển thị nếu khác với từ khóa chính) */}
                  {currentWord?.example && currentWord.example.trim() !== currentWord.word.trim() && (
                    <div className="bg-slate-850/80 border border-slate-700/60 rounded-2xl p-4 space-y-1.5">
                      <p className="text-sm sm:text-base text-slate-200 font-medium leading-relaxed">
                        {renderMaskedExample(currentWord.example, currentWord.word)}
                      </p>
                      {currentWord?.exampleMeaning && (
                        <p className="text-xs sm:text-sm text-slate-400">
                          → {currentWord.exampleMeaning}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Collocations & Synonyms */}
                  {currentWord?.collocations && currentWord.collocations.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cụm từ hay gặp:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {currentWord.collocations.map((col, idx) => (
                          <span key={idx} className="px-2.5 py-0.5 bg-slate-800 text-teal-300 rounded-lg text-xs border border-slate-700/50">
                            {col}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* SRS Info Footer */}
                <div className="flex justify-between items-center text-[11px] text-slate-500 pt-3 border-t border-slate-800">
                  <span>Khoảng cách: <strong className="text-slate-300">{currentWord?.interval || 0} ngày</strong></span>
                  <span>Hệ số Ease: <strong className="text-slate-300">{currentWord?.easeFactor || 2.5}</strong></span>
                  <span>Độ thành thạo: <strong className="text-emerald-400">{currentWord?.srsLevel || 0}★</strong></span>
                </div>

              </div>

            </motion.div>
          </div>

          {/* ========================================================================= */}
          {/* BOTTOM CONTROLS: 3-COLUMN ERGONOMIC LAYOUT (DYNAMIC FLIP LABELS)          */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-3 pt-2">
            
            {/* Cột 1: Nút Từ Trước */}
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              title="Từ trước (Phím A hoặc mũi tên ←)"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-900 hover:bg-slate-850 disabled:opacity-30 disabled:hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-bold rounded-2xl transition-all text-xs sm:text-sm shadow-md"
            >
              <ChevronLeft className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>◀ Từ trước</span>
              <kbd className="hidden md:inline px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-400 text-[10px]">A</kbd>
            </button>

            {/* Cột 2: Nút Lật Thẻ / Đổi Mặt Động (Dynamic Label) */}
            <button
              onClick={() => setIsFlipped(!isFlipped)}
              title={isFlipped ? 'Quay lại mặt trước (Phím Space)' : 'Xem nghĩa & giải thích (Phím Space)'}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-850 hover:bg-slate-800 border border-slate-750 text-emerald-400 hover:text-emerald-300 font-bold rounded-2xl transition-all text-xs sm:text-sm shadow-md"
            >
              <RotateCw className={`w-4 h-4 text-emerald-400 ${isFlipped ? 'rotate-180' : ''} transition-transform duration-300`} />
              <span>{isFlipped ? '🔄 Xem mặt trước / Lật lại' : '🔄 Xem nghĩa / Lật thẻ'}</span>
              <kbd className="hidden md:inline px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-emerald-400 text-[10px]">Space</kbd>
            </button>

            {/* Cột 3: Nút Từ Tiếp Theo */}
            <button
              onClick={handleNext}
              disabled={currentIndex >= activeWords.length - 1}
              title="Từ tiếp theo (Phím D hoặc mũi tên →)"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-900 hover:bg-slate-850 disabled:opacity-30 disabled:hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-bold rounded-2xl transition-all text-xs sm:text-sm shadow-md"
            >
              <span>Từ tiếp theo ▶</span>
              <kbd className="hidden md:inline px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-400 text-[10px]">D</kbd>
              <ChevronRight className="w-4 h-4 text-emerald-400 shrink-0" />
            </button>
          </div>

          {/* 4 SRS Grading Buttons (Chỉ hiển thị khi đã lật sang mặt sau) */}
          <AnimatePresence>
            {isFlipped && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2"
              >
                {/* 1. Again */}
                <button
                  onClick={() => handleGrade(0)}
                  className="flex flex-col items-center justify-center p-3.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 rounded-2xl transition-all font-bold group shadow-lg relative"
                >
                  <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-900/60 text-red-300 font-mono">1</span>
                  <span className="text-sm">Quên (Again)</span>
                  <span className="text-[11px] font-normal opacity-80 mt-0.5">
                    {currentWord && formatIntervalPreview(0, currentWord.interval, currentWord.srsLevel, currentWord.easeFactor)}
                  </span>
                </button>

                {/* 2. Hard */}
                <button
                  onClick={() => handleGrade(1)}
                  className="flex flex-col items-center justify-center p-3.5 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-white border border-amber-500/30 rounded-2xl transition-all font-bold group shadow-lg relative"
                >
                  <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-900/60 text-amber-300 font-mono">2</span>
                  <span className="text-sm">Khó (Hard)</span>
                  <span className="text-[11px] font-normal opacity-80 mt-0.5">
                    {currentWord && formatIntervalPreview(1, currentWord.interval, currentWord.srsLevel, currentWord.easeFactor)}
                  </span>
                </button>

                {/* 3. Good */}
                <button
                  onClick={() => handleGrade(2)}
                  className="flex flex-col items-center justify-center p-3.5 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/30 rounded-2xl transition-all font-bold group shadow-lg relative"
                >
                  <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-900/60 text-blue-300 font-mono">3</span>
                  <span className="text-sm">Tốt (Good)</span>
                  <span className="text-[11px] font-normal opacity-80 mt-0.5">
                    {currentWord && formatIntervalPreview(2, currentWord.interval, currentWord.srsLevel, currentWord.easeFactor)}
                  </span>
                </button>

                {/* 4. Easy */}
                <button
                  onClick={() => handleGrade(3)}
                  className="flex flex-col items-center justify-center p-3.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-2xl transition-all font-bold group shadow-lg relative"
                >
                  <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-900/60 text-emerald-300 font-mono">4</span>
                  <span className="text-sm">Dễ (Easy)</span>
                  <span className="text-[11px] font-normal opacity-80 mt-0.5">
                    {currentWord && formatIntervalPreview(3, currentWord.interval, currentWord.srsLevel, currentWord.easeFactor)}
                  </span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Keyboard Shortcuts Helper Pill */}
          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 pt-2 flex-wrap">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-400">Space</kbd>
              <span>Lật thẻ</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-400">A / D</kbd>
              <span>Trước / Tiếp</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-400">1-4</kbd>
              <span>Đánh giá SRS</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-400">R</kbd>
              <span>Phát âm</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-400">S</kbd>
              <span>Đổi tốc độ ({speedBadge.label})</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-400">B</kbd>
              <span>Gắn sao ⭐</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-400">M</kbd>
              <span>Che từ ví dụ</span>
            </span>
          </div>

        </>
      )}

      {/* Daily Settings Modal */}
      <DailySettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

    </div>
  );
};
