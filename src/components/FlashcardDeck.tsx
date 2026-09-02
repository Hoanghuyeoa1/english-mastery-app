import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Gamepad2,
  Check,
  Mic,
  AlertTriangle,
  ShieldAlert,
  X,
  Rocket,
  Pencil
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAppStore } from '../store/useAppStore';
import { isDueForReview, formatIntervalPreview } from '../services/srsAlgorithm';
import { speakWord } from '../services/speechService';
import { SRSGrade, VocabTag, VocabWord, ActiveTab } from '../types';
import { DailySettingsModal } from './DailySettingsModal';
import { VoicePronunciationModal } from './VoicePronunciationModal';

type QueueMode = 'DUE' | 'NEW';
type FilterTag = 'ALL' | 'FAVORITE' | 'MISTAKES' | 'SAVED_SENTENCES' | VocabTag;
type FilterLevel = 'ALL' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

interface FlashcardDeckProps {
  onNavigate?: (tab: ActiveTab) => void;
}

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

export const FlashcardDeck: React.FC<FlashcardDeckProps> = ({ onNavigate }) => {
  const { 
    vocabularyList, 
    mistakeBank,
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
    addExtraNewWords,
    resetVocabularyProgress
  } = useAppStore();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<FilterTag>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<FilterLevel>('ALL');
  const [queueMode, setQueueMode] = useState<QueueMode>('NEW');
  
  // 1. CỐ ĐỊNH DANH SÁCH PHIÊN HỌC (FROZEN SESSION QUEUE)
  // Không bị re-filter khi store cập nhật tiến độ
  const [sessionWords, setSessionWords] = useState<VocabWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isExampleRevealed, setIsExampleRevealed] = useState(false);
  const [isSessionCompleted, setIsSessionCompleted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bộ chọn số lượng từ muốn nạp vào phiên (+15, +30, +50, Custom)
  const [selectedBatchSize, setSelectedBatchSize] = useState<number>(15);
  const [isCustomBatchOpen, setIsCustomBatchOpen] = useState<boolean>(false);
  const [customBatchInput, setCustomBatchInput] = useState<string>('25');

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  }, []);

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

  // Thống kê toàn cục
  const totalDueReviewCount = useMemo(() => {
    return vocabularyList.filter((w) => isDueForReview(w.nextReviewDate) && (w.srsLevel > 0 || !!w.lastReviewedDate)).length;
  }, [vocabularyList]);

  const savedSentencesCount = useMemo(() => {
    return vocabularyList.filter((w) => isSentenceItem(w)).length;
  }, [vocabularyList]);

  const favoriteCount = useMemo(() => {
    return vocabularyList.filter((w) => w.isFavorite).length;
  }, [vocabularyList]);

  const unresolvedMistakesCount = useMemo(() => {
    return Object.values(mistakeBank || {}).filter((m) => !m.resolved).length;
  }, [mistakeBank]);

  // Đếm số lượng từ mới chưa học theo từng tag và level
  const getUnlearnedCountByTag = useCallback((tag: FilterTag, level?: FilterLevel) => {
    const targetLevel = level || selectedLevel;
    return vocabularyList.filter((w) => {
      const isUnlearned = w.srsLevel === 0 && !w.lastReviewedDate;
      if (!isUnlearned) return false;
      const isSentence = isSentenceItem(w);
      if (tag === 'SAVED_SENTENCES') return isSentence;
      if (tag === 'MISTAKES') return false;

      const matchLevel = targetLevel === 'ALL' || w.level === targetLevel;
      if (!matchLevel) return false;

      if (tag === 'FAVORITE') return !isSentence && !!w.isFavorite;
      if (tag === 'ALL') return !isSentence;
      return !isSentence && w.tag === tag;
    }).length;
  }, [vocabularyList, selectedLevel]);

  // Đếm số từ đến hạn ôn theo từng tag và level
  const getDueCountByTag = useCallback((tag: FilterTag, level?: FilterLevel) => {
    const targetLevel = level || selectedLevel;
    return vocabularyList.filter((w) => {
      const isDue = isDueForReview(w.nextReviewDate);
      const isAlreadyLearned = w.srsLevel > 0 || !!w.lastReviewedDate;
      if (!isDue || !isAlreadyLearned) return false;
      const isSentence = isSentenceItem(w);
      if (tag === 'SAVED_SENTENCES') return isSentence;
      if (tag === 'MISTAKES') return false;

      const matchLevel = targetLevel === 'ALL' || w.level === targetLevel;
      if (!matchLevel) return false;

      if (tag === 'FAVORITE') return !isSentence && !!w.isFavorite;
      if (tag === 'ALL') return !isSentence;
      return !isSentence && w.tag === tag;
    }).length;
  }, [vocabularyList, selectedLevel]);

  // Hàm nạp chính xác danh sách từ cho phiên học (Exact Batch Slicing)
  const loadSessionQueue = useCallback((mode: QueueMode, tag: FilterTag, level?: FilterLevel, customBatchSize?: number) => {
    const list = vocabularyList;
    const targetLevel = level || selectedLevel;
    let words: VocabWord[] = [];

    if (tag === 'MISTAKES') {
      // Nạp các từ trong Sổ Tay Bẫy Lỗi
      const weakRecords = Object.values(mistakeBank || {}).filter((m) => !m.resolved);
      words = weakRecords.map((m) => {
        const found = list.find((v) => v.id === m.id || v.word.toLowerCase() === m.word.toLowerCase());
        if (found) return found;
        return {
          id: m.id || `mistake_${m.word.toLowerCase()}`,
          word: m.word,
          ipa: m.ipa || '',
          partOfSpeech: 'noun',
          meaning: m.meaning || '',
          example: m.example || `Practice using the word "${m.word}" properly.`,
          tag: m.tag || 'Daily',
          srsLevel: 0,
          nextReviewDate: new Date().toISOString(),
          interval: 0,
          easeFactor: 2.5,
        };
      });

      setSessionWords(words);
      setCurrentIndex(0);
      setIsSessionCompleted(false);
      setIsFlipped(false);
      setIsExampleRevealed(false);
      return;
    }

    if (mode === 'DUE') {
      // Lọc danh sách từ đến hạn ôn tập
      words = list.filter((w) => {
        const isDue = isDueForReview(w.nextReviewDate);
        const isAlreadyLearned = w.srsLevel > 0 || !!w.lastReviewedDate;
        if (!isDue || !isAlreadyLearned) return false;

        const isSentence = isSentenceItem(w);
        if (tag === 'SAVED_SENTENCES') return isSentence;
        
        const matchLevel = targetLevel === 'ALL' || w.level === targetLevel;
        if (!matchLevel) return false;

        if (tag === 'FAVORITE') return !isSentence && !!w.isFavorite;
        if (tag === 'ALL') return !isSentence;
        return !isSentence && w.tag === tag;
      });
    } else {
      // Lọc danh sách từ chưa học (New Words)
      const unlearned = list.filter((w) => {
        const isUnlearned = w.srsLevel === 0 && !w.lastReviewedDate;
        if (!isUnlearned) return false;

        const isSentence = isSentenceItem(w);
        if (tag === 'SAVED_SENTENCES') return isSentence;

        const matchLevel = targetLevel === 'ALL' || w.level === targetLevel;
        if (!matchLevel) return false;

        if (tag === 'FAVORITE') return !isSentence && !!w.isFavorite;
        if (tag === 'ALL') return !isSentence;
        return !isSentence && w.tag === tag;
      });

      const batchSize = customBatchSize || profile.targetDailyNewWords || 15;
      words = unlearned.slice(0, batchSize);
    }

    setSessionWords(words);
    setCurrentIndex(0);
    setIsSessionCompleted(false);
    setIsFlipped(false);
    setIsExampleRevealed(false);
  }, [vocabularyList, mistakeBank, profile.targetDailyNewWords, selectedLevel]);

  // Tự động tải phiên học ban đầu và khi chuyển đổi Tab lọc / Queue Mode / Cấp độ CEFR
  useEffect(() => {
    loadSessionQueue(queueMode, selectedTag, selectedLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueMode, selectedTag, selectedLevel]);

  // Kích thước mảng và vị trí thẻ hiện tại
  const totalWords = sessionWords.length;
  const safeIndex = totalWords > 0 ? Math.min(currentIndex, totalWords - 1) : 0;
  const currentWord: VocabWord | undefined = sessionWords[safeIndex];
  const isLastCard = totalWords > 0 && safeIndex === totalWords - 1;

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
    if (autoPlayAudio && currentWord && !isSessionCompleted) {
      const timer = setTimeout(() => {
        handlePlayAudio(currentWord.word);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [currentWord?.id, autoPlayAudio, handlePlayAudio, isSessionCompleted]);

  const fireSuccessConfetti = useCallback(() => {
    confetti({
      particleCount: 100,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'],
    });
  }, []);

  const handlePrev = useCallback(() => {
    if (safeIndex > 0) {
      setIsFlipped(false);
      setIsExampleRevealed(false);
      setCurrentIndex((prev) => Math.max(0, prev - 1));
    }
  }, [safeIndex]);

  // Next / Phím D / Bỏ qua -> Tự động tính là đã học xong từ hiện tại & tăng tiến độ
  const handleNext = useCallback(() => {
    if (!currentWord || totalWords === 0) return;

    // Tự động ghi nhận từ hiện tại đã học (Grade 2 - Tốt / Đã hiểu)
    processReview(currentWord.id, 2);
    setIsFlipped(false);
    setIsExampleRevealed(false);

    if (safeIndex >= totalWords - 1) {
      // Đã đến thẻ cuối cùng -> Kích hoạt Hoàn thành phiên và KHÔNG tăng index vượt quá mảng
      fireSuccessConfetti();
      setIsSessionCompleted(true);
    } else {
      setCurrentIndex((prev) => Math.min(prev + 1, totalWords - 1));
    }
  }, [currentWord, safeIndex, totalWords, processReview, fireSuccessConfetti]);

  // Đánh giá mức độ ghi nhớ SM-2 (1, 2, 3, 4)
  const handleGrade = useCallback((grade: SRSGrade) => {
    if (!currentWord || totalWords === 0) return;

    processReview(currentWord.id, grade);
    setIsFlipped(false);
    setIsExampleRevealed(false);

    if (safeIndex >= totalWords - 1) {
      // Đã đánh giá thẻ cuối cùng -> Kích hoạt Hoàn thành phiên
      fireSuccessConfetti();
      setIsSessionCompleted(true);
    } else {
      setCurrentIndex((prev) => Math.min(prev + 1, totalWords - 1));
    }
  }, [currentWord, safeIndex, totalWords, processReview, fireSuccessConfetti]);

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

      if (isSessionCompleted) return;

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

      // Phím V hoặc P: Mở chấm điểm phát âm qua Micro
      if (e.code === 'KeyV' || e.code === 'KeyP') {
        e.preventDefault();
        setIsVoiceModalOpen(true);
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
  }, [currentWord, handleGrade, handlePlayAudio, handlePrev, handleNext, handleToggleFavorite, isMaskExample, setIsMaskExample, handleCycleAudioSpeed, isSessionCompleted]);

  // Nạp thêm từ mới chính xác (Exact Batch Slicing, Auto Fallback & Smart Infinite Review)
  const handleAddMoreWords = useCallback((count = 15, targetTag?: FilterTag) => {
    const desiredTag = targetTag || selectedTag;
    setQueueMode('NEW');

    // 1. Lọc từ mới chưa học thuộc chủ đề mong muốn
    const unlearnedInTag = vocabularyList.filter((w) => {
      const isUnlearned = w.srsLevel === 0 && !w.lastReviewedDate;
      if (!isUnlearned) return false;
      const isSentence = isSentenceItem(w);
      if (desiredTag === 'SAVED_SENTENCES') return isSentence;
      if (desiredTag === 'FAVORITE') return !isSentence && !!w.isFavorite;
      if (desiredTag === 'MISTAKES') return false;
      if (desiredTag === 'ALL') return !isSentence;
      return !isSentence && w.tag === desiredTag;
    });

    // 2. Nếu chủ đề còn từ mới -> Nạp ngay và lập tức mở thẻ đầu tiên để học
    if (unlearnedInTag.length > 0) {
      const wordsToLoad = unlearnedInTag.slice(0, count);
      addExtraNewWords(wordsToLoad.length);
      if (targetTag && targetTag !== selectedTag) {
        setSelectedTag(targetTag);
      }
      setSessionWords(wordsToLoad);
      setCurrentIndex(0);
      setIsSessionCompleted(false);
      setIsFlipped(false);
      setIsExampleRevealed(false);
      showToast(`✨ Đã nạp thành công +${wordsToLoad.length} từ mới chủ đề "${desiredTag === 'ALL' ? 'Tất cả' : desiredTag}"! Bắt đầu học ngay.`);
      fireSuccessConfetti();
      return;
    }

    // 3. Nếu chủ đề hiện tại đã hết từ mới -> Tự động chuyển sang kho ALL
    const allUnlearned = vocabularyList.filter((w) => {
      const isUnlearned = w.srsLevel === 0 && !w.lastReviewedDate;
      const isSentence = isSentenceItem(w);
      return isUnlearned && !isSentence;
    });

    if (allUnlearned.length > 0) {
      const wordsToLoad = allUnlearned.slice(0, count);
      addExtraNewWords(wordsToLoad.length);
      setSelectedTag('ALL');
      setSessionWords(wordsToLoad);
      setCurrentIndex(0);
      setIsSessionCompleted(false);
      setIsFlipped(false);
      setIsExampleRevealed(false);
      showToast(`📢 Chủ đề "${desiredTag}" đã học hết từ mới! Đang chuyển sang kho Từ Vựng Tổng Hợp (+${wordsToLoad.length} từ)...`);
      fireSuccessConfetti();
      return;
    }

    // 4. Nếu toàn bộ kho đã học hết từ mới -> Tự động nạp các từ đã học ra để ôn tập củng cố (SM-2 Review Fallback)
    const learnedWords = vocabularyList.filter((w) => {
      const isSentence = isSentenceItem(w);
      if (desiredTag === 'SAVED_SENTENCES') return isSentence;
      if (desiredTag === 'FAVORITE') return !isSentence && !!w.isFavorite;
      if (desiredTag === 'MISTAKES') return false;
      if (desiredTag === 'ALL') return !isSentence;
      return !isSentence && w.tag === desiredTag;
    });

    const candidatePool = learnedWords.length > 0 ? learnedWords : vocabularyList.filter((w) => !isSentenceItem(w));

    if (candidatePool.length > 0) {
      // Ưu tiên nạp các từ cần củng cố (SRS level thấp hoặc nextReviewDate gần nhất)
      const sorted = [...candidatePool].sort((a, b) => {
        const dateA = new Date(a.nextReviewDate || 0).getTime();
        const dateB = new Date(b.nextReviewDate || 0).getTime();
        return dateA - dateB;
      });

      const wordsToLoad = sorted.slice(0, count);
      setSessionWords(wordsToLoad);
      setCurrentIndex(0);
      setIsSessionCompleted(false);
      setIsFlipped(false);
      setIsExampleRevealed(false);
      showToast(`🔄 Bạn đã học toàn bộ từ mới! Đang mở chế độ Ôn Tập Củng Cố (+${wordsToLoad.length} từ) theo thuật toán SRS SM-2.`);
      fireSuccessConfetti();
      return;
    }

    // 5. Nếu không còn từ nào
    showToast(`🎉 Toàn bộ từ vựng đã được học! Bạn có thể khởi tạo lại kho từ vựng gốc bất cứ lúc nào.`);
  }, [selectedTag, vocabularyList, addExtraNewWords, showToast, fireSuccessConfetti]);

  // Khởi tạo lại trạng thái kho từ vựng gốc (Reset SRS progress để học lại từ đầu)
  const handleResetVocabulary = useCallback(() => {
    resetVocabularyProgress();
    setTimeout(() => {
      loadSessionQueue('NEW', 'ALL', 'ALL', 15);
      showToast('🎉 Đã khởi tạo lại trạng thái kho từ vựng! Toàn bộ 1.000+ từ vựng đã sẵn sàng để học lại từ đầu.');
      fireSuccessConfetti();
    }, 150);
  }, [resetVocabularyProgress, loadSessionQueue, showToast, fireSuccessConfetti]);

  // Ôn lại danh sách vừa xong
  const handleRestartSession = () => {
    setCurrentIndex(0);
    setIsSessionCompleted(false);
    setIsFlipped(false);
    setIsExampleRevealed(false);
  };

  const tagsList: FilterTag[] = [
    'ALL', 
    'FAVORITE', 
    'MISTAKES',
    'SAVED_SENTENCES', 
    'Tech', 
    'IELTS', 
    'TOEIC', 
    'Business', 
    'Academic', 
    'Daily', 
    'Travel',
    'Emotions',
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
                {totalDueReviewCount > 0 && (
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
            <div className={`text-2xl font-black ${totalDueReviewCount > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
              {totalDueReviewCount}
            </div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Từ cần ôn</span>
          </div>
        </button>

        {/* Tab 2: Học Từ Mới (New Words) */}
        <button
          onClick={() => {
            setQueueMode('NEW');
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
              <strong className="text-emerald-400">{totalDueReviewCount} mục</strong>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded-xl font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">Từ mới hôm nay:</span>
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

      {/* 2.5. TOAST NOTIFICATION BANNER */}
      {toastMessage && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 animate-bounce" />
            <span>{toastMessage}</span>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-emerald-500/20 rounded-lg text-emerald-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. MULTI-LEVEL FILTER CONTROLS: CEFR & TOPICS */}
      <div className="space-y-2 bg-slate-900/60 border border-slate-800/80 p-3 rounded-2xl">
        {/* Level CEFR Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap pl-1 mr-1">
            Cấp độ CEFR:
          </span>
          {(['ALL', 'A1', 'A2', 'B1', 'B2', 'C1'] as FilterLevel[]).map((lvl) => {
            const isSelected = selectedLevel === lvl;
            const levelColor = 
              lvl === 'A1' || lvl === 'A2'
                ? 'text-emerald-400'
                : lvl === 'B1' || lvl === 'B2'
                ? 'text-sky-400'
                : lvl === 'C1'
                ? 'text-purple-400'
                : 'text-slate-300';

            return (
              <button
                key={lvl}
                onClick={() => setSelectedLevel(lvl)}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                    : `bg-slate-800/80 hover:bg-slate-750 border border-slate-750 ${levelColor}`
                }`}
              >
                {lvl === 'ALL' ? 'Tất cả Level' : `Level ${lvl}`}
              </button>
            );
          })}
        </div>

        {/* Tags / Topics Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-slate-800/80">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap pl-1 mr-1">
            Chủ đề & Thẻ:
          </span>
          {tagsList.map((tag) => {
            const isSelected = selectedTag === tag;
            const unlearnedInThisTag = getUnlearnedCountByTag(tag);
            const dueInThisTag = getDueCountByTag(tag);

            let label: string = tag;
            if (tag === 'ALL') {
              label = queueMode === 'NEW' 
                ? `📚 Tất Cả (${unlearnedInThisTag})`
                : `📚 Tất Cả (${dueInThisTag})`;
            } else if (tag === 'FAVORITE') {
              label = `⭐ Yêu Thích (${favoriteCount})`;
            } else if (tag === 'MISTAKES') {
              label = `🚨 Bẫy Lỗi (${unresolvedMistakesCount})`;
            } else if (tag === 'SAVED_SENTENCES') {
              label = `📝 Đoạn Dịch (${savedSentencesCount})`;
            } else {
              label = queueMode === 'NEW' 
                ? `${tag} (${unlearnedInThisTag})` 
                : `${tag} (${dueInThisTag})`;
            }

            return (
              <button
                key={tag}
                onClick={() => {
                  setSelectedTag(tag);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? tag === 'MISTAKES'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 font-bold shadow-sm'
                      : tag === 'SAVED_SENTENCES'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold shadow-sm'
                      : tag === 'FAVORITE'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold shadow-sm'
                      : 'bg-slate-700 text-emerald-400 border border-emerald-500/40 font-bold shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {tag === 'FAVORITE' && <Star className={`w-3 h-3 ${isSelected ? 'fill-amber-400 text-amber-400' : 'text-amber-400'}`} />}
                {tag === 'MISTAKES' && <AlertTriangle className="w-3 h-3 text-rose-400" />}
                {tag === 'SAVED_SENTENCES' && <FileText className="w-3 h-3 text-cyan-400" />}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MÀN HÌNH HOÀN THÀNH PHIÊN HỌC & NẠP THÊM TỪ (COMPLETION VIEW)           */}
      {/* ========================================================================= */}
      {isSessionCompleted ? (
        <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border-2 border-emerald-500/50 rounded-3xl p-8 sm:p-12 text-center shadow-2xl space-y-6 animate-fadeIn">
          
          <div className="w-20 h-20 bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 text-slate-950 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20 animate-bounce">
            <Award className="w-10 h-10 stroke-[2.5]" />
          </div>

          <div className="space-y-2">
            <div className="inline-block px-3.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-black uppercase tracking-wider">
              Phiên Học Hoàn Tất 🎉
            </div>
            
            <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Tuyệt Vời! Bạn Đã Hoàn Thành Mục Tiêu Học!
            </h3>

            <p className="text-slate-400 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
              Bạn đã ôn luyện trọn vẹn danh sách từ trong phiên này. Hãy chọn nạp thêm từ mới hoặc thử thách bản thân trong Đấu Trường!
            </p>
          </div>

          {/* Quick Statistics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto py-2">
            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
              <span className="text-[11px] text-slate-400 block">Đã học xong</span>
              <strong className="text-xl font-black text-white">{totalWords} mục</strong>
            </div>

            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
              <span className="text-[11px] text-slate-400 block">Hôm nay</span>
              <strong className="text-xl font-black text-cyan-400">{newWordsLearnedCount}/{dailyNewLimit}</strong>
            </div>

            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
              <span className="text-[11px] text-slate-400 block">Kinh nghiệm</span>
              <strong className="text-xl font-black text-amber-400">+{Math.max(10, totalWords * 10)} XP</strong>
            </div>

            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
              <span className="text-[11px] text-slate-400 block">Chuỗi Streak</span>
              <strong className="text-xl font-black text-orange-400 flex items-center justify-center gap-1">
                <Flame className="w-4 h-4 fill-orange-400" />
                <span>{profile.streak || 1} ngày</span>
              </strong>
            </div>
          </div>

          {/* HÀNG 1: BỘ CHỌN SỐ LƯỢNG TỪ LINH HOẠT & NÚT NẠP CHÍNH */}
          <div className="pt-2 flex flex-col items-center gap-4 max-w-xl mx-auto w-full">
            {/* Cụm chọn số lượng: +15, +30, +50, Tùy chỉnh */}
            <div className="flex items-center flex-wrap justify-center gap-2 p-1.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
              <span className="text-xs font-bold text-slate-400 pl-2 pr-1">Số lượng:</span>
              {[15, 30, 50].map((count) => {
                const isSelected = selectedBatchSize === count && !isCustomBatchOpen;
                return (
                  <button
                    key={count}
                    onClick={() => {
                      setSelectedBatchSize(count);
                      setIsCustomBatchOpen(false);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                        : 'bg-slate-850 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-750'
                    }`}
                  >
                    +{count} từ
                  </button>
                );
              })}

              <button
                onClick={() => setIsCustomBatchOpen(true)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isCustomBatchOpen
                    ? 'bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                    : 'bg-slate-855 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-750'
                }`}
              >
                <Pencil className="w-3 h-3" />
                <span>Tùy chỉnh</span>
              </button>

              {isCustomBatchOpen && (
                <div className="flex items-center gap-1 bg-slate-900 border border-cyan-500/50 rounded-xl px-2 py-0.5 animate-fadeIn">
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={customBatchInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomBatchInput(val);
                      const num = parseInt(val, 10);
                      if (!isNaN(num) && num > 0) {
                        setSelectedBatchSize(Math.min(100, Math.max(1, num)));
                      }
                    }}
                    className="w-12 bg-transparent text-cyan-300 font-black text-center text-xs focus:outline-none"
                    placeholder="25"
                    autoFocus
                  />
                  <span className="text-[11px] text-slate-400">từ</span>
                </div>
              )}
            </div>

            {/* Nút nạp to nổi bật */}
            <button
              onClick={() => handleAddMoreWords(selectedBatchSize)}
              className="w-full sm:w-auto min-w-[280px] px-8 py-4 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black rounded-2xl text-sm sm:text-base shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center gap-2.5 transform hover:scale-[1.03] active:scale-95"
            >
              <Rocket className="w-5 h-5 fill-slate-950" />
              <span>Nạp ngay +{selectedBatchSize} từ mới</span>
              <ArrowRight className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* HÀNG 2: HÀNH ĐỘNG PHỤ (CÂN ĐỐI, TINH GỌN) */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleRestartSession}
              className="px-5 py-3 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-2xl border border-slate-700 transition-all text-xs sm:text-sm flex items-center gap-2"
            >
              <RotateCw className="w-4 h-4 text-slate-400" />
              <span>Ôn lại danh sách vừa xong</span>
            </button>

            {onNavigate && (
              <button
                onClick={() => onNavigate('arcade')}
                className="px-5 py-3 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 font-bold rounded-2xl transition-all text-xs sm:text-sm flex items-center gap-2"
              >
                <Gamepad2 className="w-4 h-4 text-purple-400" />
                <span>Thử thách Đấu Trường Arcade</span>
              </button>
            )}
          </div>

        </div>
      ) : totalWords === 0 ? (
        /* HẾT TỪ TRONG HÀNG ĐỢI (SMART EMPTY STATE) */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center shadow-2xl space-y-6 animate-fadeIn">
          <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto border border-emerald-500/20">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-pulse" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-2xl sm:text-3xl font-black text-white">
              {queueMode === 'DUE'
                ? `Đã hoàn thành toàn bộ từ ôn tập của danh mục "${selectedTag === 'ALL' ? 'Tất cả' : selectedTag}" 🎉`
                : getUnlearnedCountByTag(selectedTag) === 0 && selectedTag !== 'ALL'
                ? `Chủ đề "${selectedTag}" đã nạp hết từ vựng trong kho! 🎉`
                : `Sẵn sàng nạp thêm từ mới vào phiên học 🎉`}
            </h3>
            <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">
              {queueMode === 'DUE'
                ? `Không còn từ nào đến hạn ôn tập hôm nay trong nhóm này. Hãy bấm nạp thêm từ mới để tiếp tục nâng cao vốn từ vựng!`
                : `Chọn số lượng từ mong muốn và bấm Nạp ngay để tiếp tục lộ trình học thông minh SM-2!`}
            </p>
          </div>

          {/* HÀNG 1: BỘ CHỌN SỐ LƯỢNG TỪ LINH HOẠT & NÚT NẠP CHÍNH */}
          <div className="pt-2 flex flex-col items-center gap-4 max-w-xl mx-auto w-full">
            {/* Cụm chọn số lượng: +15, +30, +50, Tùy chỉnh */}
            <div className="flex items-center flex-wrap justify-center gap-2 p-1.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
              <span className="text-xs font-bold text-slate-400 pl-2 pr-1">Số lượng:</span>
              {[15, 30, 50].map((count) => {
                const isSelected = selectedBatchSize === count && !isCustomBatchOpen;
                return (
                  <button
                    key={count}
                    onClick={() => {
                      setSelectedBatchSize(count);
                      setIsCustomBatchOpen(false);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                        : 'bg-slate-850 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-750'
                    }`}
                  >
                    +{count} từ
                  </button>
                );
              })}

              <button
                onClick={() => setIsCustomBatchOpen(true)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isCustomBatchOpen
                    ? 'bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                    : 'bg-slate-850 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-750'
                }`}
              >
                <Pencil className="w-3 h-3" />
                <span>Tùy chỉnh</span>
              </button>

              {isCustomBatchOpen && (
                <div className="flex items-center gap-1 bg-slate-900 border border-cyan-500/50 rounded-xl px-2 py-0.5 animate-fadeIn">
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={customBatchInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomBatchInput(val);
                      const num = parseInt(val, 10);
                      if (!isNaN(num) && num > 0) {
                        setSelectedBatchSize(Math.min(100, Math.max(1, num)));
                      }
                    }}
                    className="w-12 bg-transparent text-cyan-300 font-black text-center text-xs focus:outline-none"
                    placeholder="25"
                    autoFocus
                  />
                  <span className="text-[11px] text-slate-400">từ</span>
                </div>
              )}
            </div>

            {/* Nút nạp to nổi bật */}
            <button
              onClick={() => handleAddMoreWords(selectedBatchSize)}
              className="w-full sm:w-auto min-w-[280px] px-8 py-4 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black rounded-2xl text-sm sm:text-base shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center gap-2.5 transform hover:scale-[1.03] active:scale-95"
            >
              <Rocket className="w-5 h-5 fill-slate-950" />
              <span>Nạp ngay +{selectedBatchSize} từ mới</span>
              <ArrowRight className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Suggest other available tags */}
          <div className="pt-4 border-t border-slate-800/80">
            <span className="text-xs text-slate-500 block mb-3 font-semibold uppercase tracking-wider">
              Hoặc chọn nhanh chủ đề khác:
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {(['Tech', 'IELTS', 'TOEIC', 'Business', 'Academic', 'Daily', 'Idioms'] as FilterTag[]).map((t) => {
                const count = getUnlearnedCountByTag(t);
                return (
                  <button
                    key={t}
                    onClick={() => {
                      setSelectedTag(t);
                      setQueueMode('NEW');
                      handleAddMoreWords(selectedBatchSize, t);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                      count > 0
                        ? 'bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border-slate-700 hover:border-emerald-500/40'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{t}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      count > 0 ? 'bg-slate-700 text-emerald-400' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {count > 0 ? `${count} mới` : 'Ôn tập'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      ) : (
        /* ACTIVE FLASHCARD LEARNING VIEW */
        <>
          {/* Top Session Progress Bar (CỐ ĐỊNH TỔNG SỐ TỪ TRONG SUỐT PHIÊN) */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-400 px-1">
              <span>
                {queueMode === 'DUE' ? '🔄 Đang ôn tập:' : '✨ Đang học từ mới:'}{' '}
                <strong className="text-white">
                  {safeIndex + 1} / {totalWords}
                </strong>
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
                style={{ width: `${((safeIndex + 1) / totalWords) * 100}%` }}
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
                  <div className="flex items-center flex-wrap gap-1.5">
                    {isCurrentSentence ? (
                      <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-full border border-cyan-500/20 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Đoạn dịch / Sentence</span>
                      </span>
                    ) : (
                      <>
                        {currentWord?.level && (
                          <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
                            currentWord.level === 'A1' || currentWord.level === 'A2'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : currentWord.level === 'B1' || currentWord.level === 'B2'
                              ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                              : 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                          }`}>
                            {currentWord.level}
                          </span>
                        )}
                        {currentWord?.topic && (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 bg-cyan-950/60 text-cyan-300 rounded-full border border-cyan-800/60">
                            {currentWord.topic}
                          </span>
                        )}
                        <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 bg-slate-800 text-slate-300 rounded-full border border-slate-700">
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

                    {/* Voice Pronunciation Checker Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsVoiceModalOpen(true);
                      }}
                      title="Chấm điểm phát âm qua Micro (Phím V hoặc P)"
                      className="p-3 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-full transition-all shadow-lg shadow-teal-500/20 hover:scale-110"
                    >
                      <Mic className="w-5 h-5" />
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
                          setIsVoiceModalOpen(true);
                        }}
                        title="Chấm điểm phát âm qua Micro (Phím V hoặc P)"
                        className="p-2 bg-slate-800 hover:bg-teal-500 text-teal-400 hover:text-slate-950 rounded-full text-xs flex items-center gap-1.5 transition-all"
                      >
                        <Mic className="w-4 h-4" />
                        <span>Luyện đọc Mic</span>
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

                  {/* Example Context (Hỗ trợ exampleEn và exampleVi) */}
                  {(() => {
                    const exEn = currentWord?.exampleEn || currentWord?.example || '';
                    const exVi = currentWord?.exampleVi || currentWord?.exampleMeaning || '';
                    if (!exEn || exEn.trim() === currentWord?.word?.trim()) return null;

                    return (
                      <div className="bg-slate-850/80 border border-slate-700/60 rounded-2xl p-4 space-y-1.5">
                        <p className="text-sm sm:text-base text-slate-200 font-medium leading-relaxed">
                          {renderMaskedExample(exEn, currentWord?.word || '')}
                        </p>
                        {exVi && (
                          <p className="text-xs sm:text-sm text-slate-400">
                            → {exVi}
                          </p>
                        )}
                      </div>
                    );
                  })()}

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
          {/* BOTTOM CONTROLS: 3-COLUMN ERGONOMIC LAYOUT (BOUNDARY-CHECKED NEXT/FINISH) */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-3 pt-2">
            
            {/* Cột 1: Nút Từ Trước */}
            <button
              onClick={handlePrev}
              disabled={safeIndex === 0}
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

            {/* Cột 3: Nút Từ Tiếp Theo / Hoàn Thành Phiên */}
            <button
              onClick={handleNext}
              title={isLastCard ? 'Hoàn thành phiên học (Phím D)' : 'Từ tiếp theo (Phím D hoặc mũi tên →)'}
              className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl transition-all text-xs sm:text-sm font-black shadow-lg ${
                isLastCard
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-emerald-500/30 ring-2 ring-emerald-400/50 transform hover:scale-[1.02]'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 border border-emerald-400/50 text-slate-950 shadow-emerald-500/20'
              }`}
            >
              <span>{isLastCard ? '🎉 Hoàn thành phiên' : 'Từ tiếp theo ▶'}</span>
              <kbd className="hidden md:inline px-1.5 py-0.5 bg-slate-950/40 border border-slate-900/50 rounded text-slate-900 text-[10px]">D</kbd>
              <ChevronRight className="w-4 h-4 text-slate-950 shrink-0" />
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
              <span>Trước / Tiếp (Tự động ghi nhận)</span>
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
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-teal-400">V / P</kbd>
              <span>Chấm phát âm Mic 🎙️</span>
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

      {/* Voice Pronunciation Modal */}
      {currentWord && (
        <VoicePronunciationModal
          isOpen={isVoiceModalOpen}
          onClose={() => setIsVoiceModalOpen(false)}
          targetText={currentWord.word}
          ipa={currentWord.ipa}
          meaning={currentWord.meaning}
          example={currentWord.example}
        />
      )}

      {/* Daily Settings Modal */}
      <DailySettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

    </div>
  );
};
