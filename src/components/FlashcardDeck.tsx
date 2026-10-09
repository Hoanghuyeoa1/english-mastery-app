import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { 
  Volume2, 
  RotateCw, 
  Sparkles, 
  Keyboard,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Settings,
  ArrowRight,
  Star,
  FileText,
  Mic,
  AlertTriangle,
  X,
  Rocket,
  Pencil,
  Play
} from 'lucide-react';
import { triggerCelebration } from '../utils/confettiPolicy';
import { useAppStore } from '../store/useAppStore';
import { isDueForReview, formatIntervalPreview } from '../services/srsAlgorithm';
import { calculateRetrievability } from '../services/fsrsAlgorithm';
import { previewCardIntervals } from '../services/srsScheduler';
import { speakWord, speakText, cancelSpeech, isSpeechRecognitionSupported } from '../services/speechService';
import { resolveCardPresentationMode, CardPresentationPlan, ConfusedWordOption } from '../services/adaptiveCardPresentation';
import { isActivityStale } from '../services/learningContinuityService';
import { FlashcardResumableActivity } from '../types/learningContinuity';
import { SRSGrade, VocabTag, VocabWord, ActiveTab, SRSReviewCard, VocabItemType, SRSProgress } from '../types';
import { DailySettingsModal } from './DailySettingsModal';
import { VoicePronunciationModal } from './VoicePronunciationModal';
import { SessionIntro } from './session/SessionIntro';
import { FlashcardQueueFilters } from './flashcard/FlashcardQueueFilters';
import { FlashcardPresentationBoundary } from './flashcard/FlashcardPresentationBoundary';

import { formatSessionDurationBucket } from '../services/sessionExperienceAdapter';
import { calculateTaskEstimatedMinutes } from '../services/todayLearningPlanService';
import type { SessionSourceContext } from '../types/sessionExperience';
import { useFlashcardKeyboardShortcuts } from '../hooks/useFlashcardKeyboardShortcuts';

import {
  type QueueMode,
  type CardTypeTab,
  type FilterTag,
  type FilterLevel,
  type FlashcardSessionKind,
  type FlashcardSessionSemantics,
  isSentenceItem,
  formatFSRSIntervalPreview,
  buildSessionQueue,
  deriveFlashcardSessionSemantics,
} from '../services/flashcardQueueService';

export {
  isSentenceItem,
  formatFSRSIntervalPreview,
  buildSessionQueue,
  deriveFlashcardSessionSemantics,
};
export type {
  QueueMode,
  CardTypeTab,
  FilterTag,
  FilterLevel,
  FlashcardSessionKind,
  FlashcardSessionSemantics,
};

interface FlashcardDeckProps {
  onNavigate?: (tab: ActiveTab) => void;
}

const AUDIO_SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25];


import {
  SessionHeader,
  type SessionHeaderProps,
} from './flashcard/FlashcardSessionHeader';
import {
  SessionSummary,
  type SessionSummaryProps,
} from './flashcard/FlashcardSessionSummary';

export {
  SessionHeader,
  SessionSummary,
};
export type {
  SessionHeaderProps,
  SessionSummaryProps,
};


const FlashcardDeckComponent: React.FC<FlashcardDeckProps> = ({ onNavigate }) => {
  const vocabularyList = useAppStore((s) => s.vocabularyList);
  const userCollocations = useAppStore((s) => s.userCollocations);
  const srsProgressMap = useAppStore((s) => s.srsProgressMap);
  const getUnifiedSRSCards = useAppStore((s) => s.getUnifiedSRSCards);
  const mistakeBank = useAppStore((s) => s.mistakeBank);
  const processReview = useAppStore((s) => s.processReview);
  const audioVoice = useAppStore((s) => s.audioVoice);
  const audioSpeed = useAppStore((s) => s.audioSpeed);
  const setAudioSpeed = useAppStore((s) => s.setAudioSpeed);
  const autoPlayAudio = useAppStore((s) => s.autoPlayAudio);
  const setAutoPlayAudio = useAppStore((s) => s.setAutoPlayAudio);
  const isMaskExample = useAppStore((s) => s.isMaskExample);
  const setIsMaskExample = useAppStore((s) => s.setIsMaskExample);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const targetDailyNewWords = useAppStore((s) => s.profile.targetDailyNewWords);
  const extraNewWordsBonus = useAppStore((s) => s.profile.extraNewWordsBonus);
  const addExtraNewWords = useAppStore((s) => s.addExtraNewWords);
  const resetVocabularyProgress = useAppStore((s) => s.resetVocabularyProgress);
  const srsAlgorithm = useAppStore((s) => s.srsAlgorithm);
  const fsrsDesiredRetention = useAppStore((s) => s.fsrsSettings.desiredRetention);
  const setSRSAlgorithm = useAppStore((s) => s.setSRSAlgorithm);
  const activePracticeConfig = useAppStore((s) => s.activePracticeConfig);
  const clearAdaptivePractice = useAppStore((s) => s.clearAdaptivePractice);
  const resumeActivities = useAppStore((s) => s.resumeActivities);
  const upsertResumeActivity = useAppStore((s) => s.upsertResumeActivity);
  const completeResumeActivity = useAppStore((s) => s.completeResumeActivity);
  const removeResumeActivity = useAppStore((s) => s.removeResumeActivity);
  const isHydrated = useAppStore((s) => s.isHydrated ?? true);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayNewWordsLearned = useAppStore((s) => s.dailyHistory[today]?.newWordsLearned || 0);
  const profileStreak = useAppStore((s) => s.profile.streak);
  const streak = profileStreak ?? 0;
  const newWordsLearnedCount = todayNewWordsLearned;

  const [cardTypeTab, setCardTypeTab] = useState<CardTypeTab>('ALL');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<FilterTag>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<FilterLevel>('ALL');
  const [queueMode, setQueueMode] = useState<QueueMode>('NEW');

  // Continuity tracking
  const reviewedCardIdsRef = useRef<Set<string>>(new Set());
  const activeFlashcardResume: FlashcardResumableActivity | null = useMemo(() => {
    const act = resumeActivities?.['flashcard_active_session'];
    return act && act.type === 'flashcard' ? act : null;
  }, [resumeActivities]);

  const hasResumableFlashcardSession = useMemo(() => {
    if (!isHydrated) return false;
    return Boolean(
      activeFlashcardResume &&
      !activeFlashcardResume.completed &&
      !isActivityStale(activeFlashcardResume) &&
      (activeFlashcardResume.checkpoint.orderedCardIds?.length || 0) > 0
    );
  }, [isHydrated, activeFlashcardResume]);
  
  // 1. CỐ ĐỊNH DANH SÁCH PHIÊN HỌC (FROZEN SESSION QUEUE)
  // Khởi tạo đồng bộ ngay từ first render -> zero-delay, không chớp trắng
  const [sessionWords, setSessionWords] = useState<SRSReviewCard[]>(() => {
    const all = getUnifiedSRSCards();
    return buildSessionQueue(
      all,
      'NEW',
      'ALL',
      'ALL',
      15,
      'ALL',
      mistakeBank,
      srsProgressMap,
      vocabularyList,
      targetDailyNewWords
    );
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isExampleRevealed, setIsExampleRevealed] = useState(false);
  const [isSessionCompleted, setIsSessionCompleted] = useState(false);
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const [sourceContext, setSourceContext] = useState<SessionSourceContext | undefined>(undefined);
  const [todayPlanMeta, setTodayPlanMeta] = useState<{
    planItemId?: string;
    planTitle?: string;
    planObjective?: string;
    estimatedMinutes?: number;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shouldReduceMotion = useReducedMotion();

  // Phase 3: Session State (Local, strictly in-memory for current study session)
  const [sessionStreak, setSessionStreak] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [ratingCounts, setRatingCounts] = useState<{ again: number; hard: number; good: number; easy: number }>({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });
  const [microFeedback, setMicroFeedback] = useState<{ text: string; grade: SRSGrade; timestamp: number } | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);

  // Phase 5: Session History (Ephemeral review records for session completion analytics)
  const [sessionHistory, setSessionHistory] = useState<{ card: SRSReviewCard; grade: SRSGrade; timestamp: number }[]>([]);

  // Phase 4: Local Confused Word Challenge Option State
  const [selectedConfusionAnswer, setSelectedConfusionAnswer] = useState<string | null>(null);

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

  const triggerMicroFeedback = useCallback((grade: SRSGrade) => {
    const feedbackMap: Record<SRSGrade, string> = {
      0: "We'll reinforce this one.",
      1: "Getting there.",
      2: "Nice recall!",
      3: "Strong memory!",
    };
    const text = feedbackMap[grade];
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setMicroFeedback({ text, grade, timestamp: Date.now() });
    feedbackTimerRef.current = setTimeout(() => {
      setMicroFeedback(null);
    }, 1200);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const dailyNewLimit = (targetDailyNewWords || 15) + (extraNewWordsBonus || 0);
  const isDailyNewGoalCompleted = todayNewWordsLearned >= dailyNewLimit;

  // Thống kê toàn cục & Phân loại Thẻ trong 1 Pass O(N) duy nhất
  const tagCounts = useMemo(() => {
    const unlearnedMap: Record<string, number> = {};
    const dueMap: Record<string, number> = {};
    let unlearnedAll = 0;
    let dueAll = 0;
    let savedSentences = 0;
    let favorites = 0;

    for (let i = 0; i < vocabularyList.length; i++) {
      const w = vocabularyList[i];
      const isSentence = isSentenceItem(w);
      if (w.isFavorite && !isSentence) favorites++;
      if (isSentence) {
        savedSentences++;
        continue;
      }

      const matchLevel = selectedLevel === 'ALL' || w.level === selectedLevel;
      if (!matchLevel) continue;

      const isUnlearned = (w.srsLevel ?? 0) === 0 && !w.lastReviewedDate && !srsProgressMap[w.id]?.lastReviewedDate;
      if (isUnlearned) {
        unlearnedAll++;
        if (w.tag) unlearnedMap[w.tag] = (unlearnedMap[w.tag] || 0) + 1;
      }

      const isDue = isDueForReview(w.nextReviewDate);
      const isAlreadyLearned = (w.srsLevel ?? 0) > 0 || !!w.lastReviewedDate || !!(srsProgressMap[w.id] && srsProgressMap[w.id].lastReviewedDate);
      if (isDue && isAlreadyLearned) {
        dueAll++;
        if (w.tag) dueMap[w.tag] = (dueMap[w.tag] || 0) + 1;
      }
    }

    return { unlearnedMap, dueMap, unlearnedAll, dueAll, savedSentences, favorites };
  }, [vocabularyList, selectedLevel, srsProgressMap]);

  const savedSentencesCount = tagCounts.savedSentences;
  const favoriteCount = tagCounts.favorites;

  const unresolvedMistakesCount = useMemo(() => {
    return Object.values(mistakeBank || {}).filter((m) => !m.resolved).length;
  }, [mistakeBank]);

  // Đếm số lượng từ mới chưa học theo từng tag và level (O(1) Instant Hash Lookup)
  const getUnlearnedCountByTag = useCallback((tag: FilterTag) => {
    if (tag === 'ALL') return tagCounts.unlearnedAll;
    if (tag === 'FAVORITE') return tagCounts.favorites;
    if (tag === 'SAVED_SENTENCES') return tagCounts.savedSentences;
    if (tag === 'MISTAKES') return 0;
    return tagCounts.unlearnedMap[tag] || 0;
  }, [tagCounts]);

  // Đếm số từ đến hạn ôn theo từng tag và level (O(1) Instant Hash Lookup)
  const getDueCountByTag = useCallback((tag: FilterTag) => {
    if (tag === 'ALL') return tagCounts.dueAll;
    if (tag === 'FAVORITE') return tagCounts.favorites;
    if (tag === 'SAVED_SENTENCES') return tagCounts.savedSentences;
    if (tag === 'MISTAKES') return 0;
    return tagCounts.dueMap[tag] || 0;
  }, [tagCounts]);

  // Thống kê toàn cục
  const unifiedCards = useMemo(() => getUnifiedSRSCards(), [getUnifiedSRSCards, vocabularyList, userCollocations, srsProgressMap]);

  const { dueSingleWordsCount, dueCollocationsCount, dueAllCount } = useMemo(() => {
    let single = 0;
    let colloc = 0;
    for (let i = 0; i < unifiedCards.length; i++) {
      const c = unifiedCards[i];
      const isLearned = (c.srsLevel ?? 0) > 0 || !!(srsProgressMap[c.id] && srsProgressMap[c.id].lastReviewedDate);
      if (isDueForReview(c.nextReviewDate) && isLearned) {
        if (c.type === 'single_word') single++;
        else colloc++;
      }
    }
    return { dueSingleWordsCount: single, dueCollocationsCount: colloc, dueAllCount: single + colloc };
  }, [unifiedCards, srsProgressMap]);

  const totalDueReviewCount = dueAllCount;

  // Hàm nạp chính xác danh sách từ cho phiên học (Exact Batch Slicing)
  const loadSessionQueue = useCallback((
    mode: QueueMode, 
    tag: FilterTag, 
    level: FilterLevel = selectedLevel, 
    customBatchSize?: number,
    cardType: CardTypeTab = cardTypeTab
  ) => {
    const allCards = getUnifiedSRSCards();
    const words = buildSessionQueue(
      allCards,
      mode,
      tag,
      level,
      customBatchSize,
      cardType,
      mistakeBank,
      srsProgressMap,
      vocabularyList,
      targetDailyNewWords
    );

    setSessionWords(words);
    setCurrentIndex(0);
    setIsSessionCompleted(false);
    setIsSessionStarted(false);
    setIsFlipped(false);
    setIsExampleRevealed(false);
    setSessionStreak(0);
    setReviewedCount(0);
    reviewedCardIdsRef.current.clear();
    setRatingCounts({ again: 0, hard: 0, good: 0, easy: 0 });
    setMicroFeedback(null);
    setSelectedConfusionAnswer(null);
    setSessionHistory([]);
  }, [getUnifiedSRSCards, cardTypeTab, vocabularyList, mistakeBank, targetDailyNewWords, selectedLevel, srsProgressMap]);

  // Tự động tải phiên học khi chuyển đổi Tab lọc / Queue Mode / Cấp độ CEFR / Card Type (Bỏ qua first mount vì đã nạp đồng bộ)
  const isInitialMountRef = useRef(true);
  const isConsumingAdaptivePracticeRef = useRef(false);
  const loadSessionQueueRef = useRef(loadSessionQueue);
  loadSessionQueueRef.current = loadSessionQueue;

  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (isConsumingAdaptivePracticeRef.current) {
      isConsumingAdaptivePracticeRef.current = false;
      return;
    }
    loadSessionQueueRef.current(queueMode, selectedTag, selectedLevel, undefined, cardTypeTab);
  }, [queueMode, selectedTag, selectedLevel, cardTypeTab]);

  // Synchronize queue once store hydration completes
  const prevHydratedRef = useRef(isHydrated);
  useEffect(() => {
    if (!prevHydratedRef.current && isHydrated) {
      if (!isSessionStarted && !isSessionCompleted) {
        loadSessionQueueRef.current(queueMode, selectedTag, selectedLevel, undefined, cardTypeTab);
      }
    }
    prevHydratedRef.current = isHydrated;
  }, [isHydrated, isSessionStarted, isSessionCompleted, queueMode, selectedTag, selectedLevel, cardTypeTab]);

  // Consume activePracticeConfig when routed to Flashcards (e.g. from Today Learning Plan DUE review)
  useEffect(() => {
    if (activePracticeConfig?.module === 'flashcard') {
      isConsumingAdaptivePracticeRef.current = true;
      const targetIds = activePracticeConfig.itemIds || [];
      const isCollocation = activePracticeConfig.mistakeType === 'collocation';
      if (isCollocation) {
        setCardTypeTab('COLLOCATION');
      }
      setQueueMode('DUE');
      setTodayPlanMeta({
        planItemId: activePracticeConfig.planItemId,
        planTitle: activePracticeConfig.planTitle,
        planObjective: activePracticeConfig.planObjective,
        estimatedMinutes: activePracticeConfig.estimatedMinutes,
      });
      setSourceContext({
        sourceModule: 'flashcard',
        todayPlanTaskId: activePracticeConfig.planItemId || 'srs_review',
      });
      setIsSessionStarted(false);

      if (targetIds.length > 0) {
        const allCards = getUnifiedSRSCards();
        const targetedCards = allCards.filter(
          (c) =>
            targetIds.includes(c.id) ||
            targetIds.includes((c.word || c.primaryText || '').toLowerCase())
        );
        if (targetedCards.length > 0) {
          setSessionWords(targetedCards);
          setCurrentIndex(0);
          setIsSessionCompleted(false);
          setIsSessionStarted(false);
          setIsFlipped(false);
          setIsExampleRevealed(false);
          setSessionStreak(0);
          setReviewedCount(0);
          setRatingCounts({ again: 0, hard: 0, good: 0, easy: 0 });
          setMicroFeedback(null);
          setSelectedConfusionAnswer(null);
          setSessionHistory([]);
          clearAdaptivePractice();
          return;
        }
      }
      loadSessionQueue('DUE', 'ALL', selectedLevel, undefined, isCollocation ? 'COLLOCATION' : 'ALL');
      clearAdaptivePractice();
    }
  }, [activePracticeConfig, loadSessionQueue, selectedLevel, clearAdaptivePractice, getUnifiedSRSCards]);

  // Kích thước mảng và vị trí thẻ hiện tại
  const totalWords = sessionWords.length;
  const safeIndex = totalWords > 0 ? Math.min(currentIndex, totalWords - 1) : 0;
  const currentWord: SRSReviewCard | undefined = sessionWords[safeIndex];
  const isLastCard = totalWords > 0 && safeIndex === totalWords - 1;

  // Pure Session Semantics Derivation based on real queue state & continuity
  const sessionSemantics = useMemo(() => {
    return deriveFlashcardSessionSemantics({
      queue: sessionWords,
      isHydrated,
      hasResumeActivity: Boolean(
        hasResumableFlashcardSession &&
        reviewedCardIdsRef.current.size === 0 &&
        !isSessionCompleted
      ),
      planTitle: todayPlanMeta?.planTitle,
      planObjective: todayPlanMeta?.planObjective,
      sourceContextTaskId: sourceContext?.todayPlanTaskId,
      srsProgressMap,
    });
  }, [
    sessionWords,
    isHydrated,
    hasResumableFlashcardSession,
    isSessionCompleted,
    todayPlanMeta?.planTitle,
    todayPlanMeta?.planObjective,
    sourceContext?.todayPlanTaskId,
    srsProgressMap,
  ]);

  // Phase 4: Adaptive Presentation Mode (Deterministic, stable per card ID/session)
  const presentationPlan: CardPresentationPlan | null = useMemo(() => {
    if (!currentWord) return null;
    return resolveCardPresentationMode(currentWord, mistakeBank);
  }, [currentWord, mistakeBank]);

  // Reset confusion selection when card changes
  useEffect(() => {
    setSelectedConfusionAnswer(null);
  }, [currentWord?.id]);

  // Tính toán Dynamic Interval Previews cho 4 nút đánh giá (Again, Hard, Good, Easy)
  const intervalPreviews = useMemo(() => {
    if (!currentWord) {
      return { again: '-', hard: '-', good: '-', easy: '-' };
    }

    if (srsAlgorithm === 'fsrs') {
      const previews = previewCardIntervals(currentWord, {
        algorithm: 'fsrs',
        desiredRetention: fsrsDesiredRetention,
      });
      return {
        again: formatFSRSIntervalPreview(previews.again.intervalDays),
        hard: formatFSRSIntervalPreview(previews.hard.intervalDays),
        good: formatFSRSIntervalPreview(previews.good.intervalDays),
        easy: formatFSRSIntervalPreview(previews.easy.intervalDays),
      };
    }

    // Chế độ SM-2 truyền thống
    const curInterval = currentWord.interval ?? 0;
    const curLevel = currentWord.srsLevel ?? 0;
    const curEF = currentWord.easeFactor ?? 2.5;

    return {
      again: formatIntervalPreview(0, curInterval, curLevel, curEF),
      hard: formatIntervalPreview(1, curInterval, curLevel, curEF),
      good: formatIntervalPreview(2, curInterval, curLevel, curEF),
      easy: formatIntervalPreview(3, curInterval, curLevel, curEF),
    };
  }, [currentWord, srsAlgorithm, fsrsDesiredRetention]);

  // Tính toán Retrievability Badge (R%) và trạng thái FSRS của thẻ hiện tại
  const retrievabilityInfo = useMemo(() => {
    if (!currentWord) return null;

    const cardFsrs = currentWord.fsrs || srsProgressMap[currentWord.id]?.fsrs;
    const hasHistory =
      (cardFsrs && cardFsrs.stability > 0 && cardFsrs.reps > 0) ||
      ((currentWord.srsLevel ?? 0) > 0 &&
        !!(currentWord.lastReviewedDate || srsProgressMap[currentWord.id]?.lastReviewedDate));

    if (!cardFsrs || !hasHistory) {
      return {
        isNew: true,
        retrievability: 1,
        retentionPercent: 100,
        label: '🌟 Mới (New)',
        colorClass: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
        stability: cardFsrs?.stability,
        difficulty: cardFsrs?.difficulty,
      };
    }

    const lastReviewStr =
      cardFsrs.lastReview ||
      currentWord.lastReviewedDate ||
      srsProgressMap[currentWord.id]?.lastReviewedDate;
    const elapsedDays = lastReviewStr
      ? Math.max(0, (Date.now() - new Date(lastReviewStr).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const r = calculateRetrievability(elapsedDays, cardFsrs.stability);
    const retentionPercent = Math.min(100, Math.max(0, Math.round(r * 100)));

    let colorClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (retentionPercent < 75) {
      colorClass = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    } else if (retentionPercent < 90) {
      colorClass = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    }

    return {
      isNew: false,
      retrievability: r,
      retentionPercent,
      label: `🧠 Khả năng nhớ: ${retentionPercent}%`,
      colorClass,
      stability: cardFsrs.stability,
      difficulty: cardFsrs.difficulty,
    };
  }, [currentWord, srsProgressMap]);

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

  // Ephemeral presentation readiness and auto-TTS tracking (strictly component/session-local, never persisted)
  const [isCardPresentationReady, setIsCardPresentationReady] = useState(false);
  const lastPronouncedCardIdRef = useRef<string | null>(null);

  // Phase 5: Cleanup speech on unmount, tab hidden, or view navigation
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        cancelSpeech();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      cancelSpeech();
    };
  }, []);

  // Reset example revealed & presentation readiness when current card changes
  useEffect(() => {
    setIsExampleRevealed(false);
    setIsCardPresentationReady(false);
  }, [currentWord?.id]);

  // Phase 4 & 5: Synchronized presentation callback (Zero arbitrary timeouts, hardened against stale/mid-session deletion)
  // Invariant: CURRENT CARD RESOLVED -> CARD RENDERED / PRESENTED IN DOM -> AUTO TTS ELIGIBLE.
  const handleCardPresented = useCallback((presentedCard: SRSReviewCard) => {
    // 1. Invariants: Session must be active, not completed, hydrated, and card identity must match currentWord
    if (
      !isHydrated ||
      !isSessionStarted ||
      isSessionCompleted ||
      !currentWord ||
      !presentedCard ||
      presentedCard.id !== currentWord.id
    ) {
      return;
    }

    // 2. Mark presentation ready (ephemeral, local only)
    setIsCardPresentationReady(true);

    // 3. Auto-pronunciation gate:
    // - Only speak if autoPlayAudio is enabled
    // - Strictly at most 1 automatic speech per card presentation cycle (hardened against StrictMode re-runs)
    if (autoPlayAudio) {
      if (lastPronouncedCardIdRef.current !== presentedCard.id) {
        lastPronouncedCardIdRef.current = presentedCard.id;
        const textToSpeak = presentedCard.primaryText || presentedCard.word || '';
        if (textToSpeak.trim()) {
          cancelSpeech();
          handlePlayAudio(textToSpeak);
        }
      }
    }
  }, [isHydrated, isSessionStarted, isSessionCompleted, currentWord, autoPlayAudio, handlePlayAudio]);

  const fireSuccessConfetti = useCallback(() => {
    triggerCelebration('completion', {
      particleCount: 100,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'],
    });
  }, []);

  const handlePrev = useCallback(() => {
    if (safeIndex > 0) {
      cancelSpeech();
      setIsFlipped(false);
      setIsExampleRevealed(false);
      setCurrentIndex((prev) => Math.max(0, prev - 1));
    }
  }, [safeIndex]);

  // Khóa giao dịch đánh giá nguyên tử (Atomic Review Transaction Lock)
  // Chặn hoàn toàn duplicate review khi double-click / spam phím
  const isReviewingRef = useRef(false);

  // Kích hoạt chấm điểm phát âm an toàn (Không tự động kích hoạt mic trên render, không tính là SRS review)
  const handlePracticePronunciation = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isSpeechRecognitionSupported()) {
      showToast('⚠️ Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói. Vui lòng sử dụng Google Chrome hoặc Microsoft Edge.');
      return;
    }
    setIsVoiceModalOpen(true);
  }, [showToast]);

  const handleResumeSession = useCallback(() => {
    if (!isHydrated || !activeFlashcardResume || activeFlashcardResume.completed) return;
    if (isActivityStale(activeFlashcardResume)) {
      removeResumeActivity('flashcard_active_session');
      return;
    }
    cancelSpeech();
    lastPronouncedCardIdRef.current = null;
    setIsCardPresentationReady(false);
    const cp = activeFlashcardResume.checkpoint;
    const allCards = getUnifiedSRSCards();
    const orderedIds: string[] = cp.orderedCardIds || [];
    const reviewedIds = new Set<string>(cp.reviewedCardIds || []);

    // 1. Filter out reviewed cards to strictly prevent duplicate review / double XP / double SRS mutation
    const remainingIds = orderedIds.filter((id: string) => !reviewedIds.has(id));

    // 2. Map to current cards, skipping deleted/missing cards
    const cardMap = new Map<string, SRSReviewCard>(allCards.map((c) => [c.id, c]));
    const remainingCards = remainingIds
      .map((id: string) => cardMap.get(id))
      .filter((c): c is SRSReviewCard => Boolean(c));

    if (remainingCards.length === 0) {
      completeResumeActivity('flashcard_active_session');
      setIsSessionCompleted(true);
      return;
    }

    setSessionWords(remainingCards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsExampleRevealed(false);
    setIsSessionCompleted(false);
    setReviewedCount(cp.reviewedCount || reviewedIds.size);
    reviewedCardIdsRef.current = new Set<string>(reviewedIds);
    if (cp.queueMode === 'DUE' || cp.queueMode === 'NEW') setQueueMode(cp.queueMode);
    if (cp.filterTag) setSelectedTag(cp.filterTag as FilterTag);
    if (cp.level) setSelectedLevel(cp.level as FilterLevel);
    setIsSessionStarted(true);
  }, [isHydrated, activeFlashcardResume, getUnifiedSRSCards, completeResumeActivity, removeResumeActivity]);

  const handleDismissSession = useCallback(() => {
    cancelSpeech();
    removeResumeActivity('flashcard_active_session');
    reviewedCardIdsRef.current.clear();
    setIsSessionStarted(false);
    loadSessionQueue(queueMode, selectedTag, selectedLevel, undefined, cardTypeTab);
  }, [removeResumeActivity, loadSessionQueue, queueMode, selectedTag, selectedLevel, cardTypeTab]);

  // Next / Phím D / Bỏ qua -> Tự động tính là đã học xong từ hiện tại & tăng tiến độ (Atomic)
  const handleNext = useCallback(() => {
    if (isReviewingRef.current) return;
    const card = sessionWords[safeIndex];
    if (!card || totalWords === 0 || isSessionCompleted) return;

    cancelSpeech();
    isReviewingRef.current = true;
    setIsReviewing(true);
    try {
      // Tự động ghi nhận từ hiện tại đã học (Grade 2 - Tốt / Đã hiểu)
      processReview(card.id, 2);
      setIsFlipped(false);
      setIsExampleRevealed(false);

      // Phase 3: Session progress updates
      setReviewedCount((prev) => prev + 1);
      setRatingCounts((prev) => ({ ...prev, good: prev.good + 1 }));
      setSessionStreak((prev) => prev + 1);
      triggerMicroFeedback(2);

      // Phase 5: Session history tracking
      setSessionHistory((prev) => [...prev, { card, grade: 2, timestamp: Date.now() }]);
      reviewedCardIdsRef.current.add(card.id);

      if (safeIndex >= totalWords - 1) {
        // Đã đến thẻ cuối cùng -> Kích hoạt Hoàn thành phiên và KHÔNG tăng index vượt quá mảng
        fireSuccessConfetti();
        setIsSessionCompleted(true);
        completeResumeActivity('flashcard_active_session');
      } else {
        setCurrentIndex((prev) => Math.min(prev + 1, totalWords - 1));
        upsertResumeActivity({
          id: 'flashcard_active_session',
          type: 'flashcard',
          title: 'Phiên Học Thẻ SRS',
          startedAt: Date.now(),
          lastActiveAt: Date.now(),
          completed: false,
          schemaVersion: 1,
          checkpoint: {
            queueMode,
            filterTag: selectedTag,
            cardType: cardTypeTab,
            level: selectedLevel,
            orderedCardIds: sessionWords.map((c) => c.id),
            currentIndex: safeIndex + 1,
            reviewedCardIds: Array.from(reviewedCardIdsRef.current),
            reviewedCount: reviewedCardIdsRef.current.size,
            totalCards: sessionWords.length,
            progressPercent: Math.round((reviewedCardIdsRef.current.size / Math.max(1, sessionWords.length)) * 100),
          },
        });
      }
    } finally {
      queueMicrotask(() => {
        isReviewingRef.current = false;
        setIsReviewing(false);
      });
    }
  }, [
    sessionWords,
    safeIndex,
    totalWords,
    isSessionCompleted,
    processReview,
    fireSuccessConfetti,
    triggerMicroFeedback,
    upsertResumeActivity,
    completeResumeActivity,
    queueMode,
    selectedTag,
    cardTypeTab,
    selectedLevel,
  ]);

  // Đánh giá mức độ ghi nhớ SM-2 / FSRS (1, 2, 3, 4) (Atomic)
  const handleGrade = useCallback((grade: SRSGrade) => {
    if (isReviewingRef.current) return;
    const card = sessionWords[safeIndex];
    if (!card || totalWords === 0 || isSessionCompleted) return;

    cancelSpeech();
    isReviewingRef.current = true;
    setIsReviewing(true);
    try {
      processReview(card.id, grade);
      setIsFlipped(false);
      setIsExampleRevealed(false);

      // Phase 3: Session progress updates
      setReviewedCount((prev) => prev + 1);
      setRatingCounts((prev) => {
        const keys: Record<SRSGrade, 'again' | 'hard' | 'good' | 'easy'> = {
          0: 'again',
          1: 'hard',
          2: 'good',
          3: 'easy',
        };
        const key = keys[grade];
        return { ...prev, [key]: prev[key] + 1 };
      });

      if (grade === 0) {
        setSessionStreak(0);
      } else {
        setSessionStreak((prev) => prev + 1);
      }

      triggerMicroFeedback(grade);

      // Phase 5: Session history tracking
      setSessionHistory((prev) => [...prev, { card, grade, timestamp: Date.now() }]);
      reviewedCardIdsRef.current.add(card.id);

      if (safeIndex >= totalWords - 1) {
        // Đã đánh giá thẻ cuối cùng -> Kích hoạt Hoàn thành phiên
        fireSuccessConfetti();
        setIsSessionCompleted(true);
        completeResumeActivity('flashcard_active_session');
      } else {
        setCurrentIndex((prev) => Math.min(prev + 1, totalWords - 1));
        upsertResumeActivity({
          id: 'flashcard_active_session',
          type: 'flashcard',
          title: 'Phiên Học Thẻ SRS',
          startedAt: Date.now(),
          lastActiveAt: Date.now(),
          completed: false,
          schemaVersion: 1,
          checkpoint: {
            queueMode,
            filterTag: selectedTag,
            cardType: cardTypeTab,
            level: selectedLevel,
            orderedCardIds: sessionWords.map((c) => c.id),
            currentIndex: safeIndex + 1,
            reviewedCardIds: Array.from(reviewedCardIdsRef.current),
            reviewedCount: reviewedCardIdsRef.current.size,
            totalCards: sessionWords.length,
            progressPercent: Math.round((reviewedCardIdsRef.current.size / Math.max(1, sessionWords.length)) * 100),
          },
        });
      }
    } finally {
      queueMicrotask(() => {
        isReviewingRef.current = false;
        setIsReviewing(false);
      });
    }
  }, [
    sessionWords,
    safeIndex,
    totalWords,
    isSessionCompleted,
    processReview,
    fireSuccessConfetti,
    triggerMicroFeedback,
    upsertResumeActivity,
    completeResumeActivity,
    queueMode,
    selectedTag,
    cardTypeTab,
    selectedLevel,
  ]);

  // Toggle Bookmark / Favorite
  const handleToggleFavorite = useCallback(() => {
    if (currentWord) {
      toggleFavorite(currentWord.id);
    }
  }, [currentWord, toggleFavorite]);

  // Hook lắng nghe và xử lý phím tắt
  useFlashcardKeyboardShortcuts({
    currentWord,
    handleGrade,
    handlePlayAudio,
    handlePracticePronunciation,
    handlePrev,
    handleNext,
    handleToggleFavorite,
    isMaskExample,
    setIsMaskExample,
    handleCycleAudioSpeed,
    isSessionCompleted,
    isSessionStarted,
    setIsFlipped,
    setIsVoiceModalOpen,
    isReviewingRef,
  });


  // Nạp thêm từ mới chính xác (Exact Batch Slicing, Auto Fallback & Smart Infinite Review)
  const handleAddMoreWords = useCallback((count = 15, targetTag?: FilterTag) => {
    cancelSpeech();
    lastPronouncedCardIdRef.current = null;
    setIsCardPresentationReady(false);
    const desiredTag = targetTag || selectedTag;
    setQueueMode('NEW');

    const allCards = getUnifiedSRSCards();
    let cards = allCards;
    if (cardTypeTab === 'SINGLE_WORD') {
      cards = cards.filter((c) => c.type === 'single_word');
    } else if (cardTypeTab === 'COLLOCATION') {
      cards = cards.filter((c) => c.type !== 'single_word');
    }

    // 1. Lọc từ mới chưa học thuộc chủ đề mong muốn
    const unlearnedInTag = cards.filter((w) => {
      const isUnlearned = w.srsLevel === 0 && !(srsProgressMap[w.id] && srsProgressMap[w.id].lastReviewedDate);
      if (!isUnlearned) return false;
      const isSentence = isSentenceItem(w);
      if (desiredTag === 'SAVED_SENTENCES') return isSentence;
      if (desiredTag === 'FAVORITE') return !isSentence && !!w.isFavorite;
      if (desiredTag === 'MISTAKES') return false;
      if (desiredTag === 'ALL') return !isSentence;
      return !isSentence && (w.tag === desiredTag || w.contextTag === desiredTag);
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
      setIsSessionStarted(true);
      setIsFlipped(false);
      setIsExampleRevealed(false);
      setSessionStreak(0);
      setReviewedCount(0);
      setRatingCounts({ again: 0, hard: 0, good: 0, easy: 0 });
      setMicroFeedback(null);
      setSelectedConfusionAnswer(null);
      setSessionHistory([]);
      showToast(`✨ Đã nạp thành công +${wordsToLoad.length} từ/cụm mới chủ đề "${desiredTag === 'ALL' ? 'Tất cả' : desiredTag}"! Bắt đầu học ngay.`);
      fireSuccessConfetti();
      return;
    }

    // 3. Nếu chủ đề hiện tại đã hết từ mới -> Tự động chuyển sang kho ALL
    const allUnlearned = cards.filter((w) => {
      const isUnlearned = w.srsLevel === 0 && !(srsProgressMap[w.id] && srsProgressMap[w.id].lastReviewedDate);
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
      setIsSessionStarted(true);
      setIsFlipped(false);
      setIsExampleRevealed(false);
      setSessionStreak(0);
      setReviewedCount(0);
      setRatingCounts({ again: 0, hard: 0, good: 0, easy: 0 });
      setMicroFeedback(null);
      setSelectedConfusionAnswer(null);
      setSessionHistory([]);
      showToast(`📢 Chủ đề "${desiredTag}" đã học hết từ mới! Đang chuyển sang kho Tổng Hợp (+${wordsToLoad.length} thẻ)...`);
      fireSuccessConfetti();
      return;
    }

    // 4. Nếu toàn bộ kho đã học hết từ mới -> Tự động nạp các từ đã học ra để ôn tập củng cố (SM-2 Review Fallback)
    const learnedWords = cards.filter((w) => {
      const isSentence = isSentenceItem(w);
      if (desiredTag === 'SAVED_SENTENCES') return isSentence;
      if (desiredTag === 'FAVORITE') return !isSentence && !!w.isFavorite;
      if (desiredTag === 'MISTAKES') return false;
      if (desiredTag === 'ALL') return !isSentence;
      return !isSentence && (w.tag === desiredTag || w.contextTag === desiredTag);
    });

    const candidatePool = learnedWords.length > 0 ? learnedWords : cards.filter((w) => !isSentenceItem(w));

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
      setIsSessionStarted(true);
      setIsFlipped(false);
      setIsExampleRevealed(false);
      setSessionStreak(0);
      setReviewedCount(0);
      setRatingCounts({ again: 0, hard: 0, good: 0, easy: 0 });
      setMicroFeedback(null);
      setSelectedConfusionAnswer(null);
      setSessionHistory([]);
      showToast(`🔄 Bạn đã học toàn bộ từ mới! Đang mở chế độ Ôn Tập Củng Cố (+${wordsToLoad.length} từ) theo thuật toán SRS ${srsAlgorithm === 'fsrs' ? 'FSRS-4.5' : 'SM-2'}.`);
      fireSuccessConfetti();
      return;
    }

    // 5. Nếu không còn từ nào
    showToast(`🎉 Toàn bộ từ vựng đã được học! Bạn có thể khởi tạo lại kho từ vựng gốc bất cứ lúc nào.`);
  }, [selectedTag, cardTypeTab, srsProgressMap, getUnifiedSRSCards, addExtraNewWords, showToast, fireSuccessConfetti, srsAlgorithm]);

  // Khởi tạo lại trạng thái kho từ vựng gốc (Reset SRS progress để học lại từ đầu)
  const _handleResetVocabulary = useCallback(() => {
    cancelSpeech();
    resetVocabularyProgress();
    setTimeout(() => {
      loadSessionQueue('NEW', 'ALL', 'ALL', 15);
      showToast('🎉 Đã khởi tạo lại trạng thái kho từ vựng! Toàn bộ 1.000+ từ vựng đã sẵn sàng để học lại từ đầu.');
      fireSuccessConfetti();
    }, 150);
  }, [resetVocabularyProgress, loadSessionQueue, showToast, fireSuccessConfetti]);

  // Ôn lại danh sách vừa xong
  const handleRestartSession = () => {
    if (sessionWords.length === 0) return;
    cancelSpeech();
    removeResumeActivity('flashcard_active_session');
    reviewedCardIdsRef.current.clear();
    lastPronouncedCardIdRef.current = null;
    setIsCardPresentationReady(false);
    setCurrentIndex(0);
    setIsSessionCompleted(false);
    setIsSessionStarted(true);
    setIsFlipped(false);
    setIsExampleRevealed(false);
    setSessionStreak(0);
    setReviewedCount(0);
    setRatingCounts({ again: 0, hard: 0, good: 0, easy: 0 });
    setMicroFeedback(null);
    setSelectedConfusionAnswer(null);
    setSessionHistory([]);
  };

  // Phase 5: Observed Session Retention & Hardest Cards Tracking
  const sessionTotalReviews = ratingCounts.again + ratingCounts.hard + ratingCounts.good + ratingCounts.easy;
  const sessionSuccessfulReviews = ratingCounts.hard + ratingCounts.good + ratingCounts.easy;
  const observedRetention = sessionTotalReviews > 0
    ? Math.round((sessionSuccessfulReviews / sessionTotalReviews) * 100)
    : null;

  const hardestCards = useMemo(() => {
    if (sessionHistory.length === 0) return [];

    const struggleMap = new Map<string, {
      card: SRSReviewCard;
      worstGrade: SRSGrade;
      againCount: number;
      hardCount: number;
      lastTimestamp: number;
    }>();

    for (const record of sessionHistory) {
      if (record.grade <= 1) { // 0 = Again, 1 = Hard
        const existing = struggleMap.get(record.card.id);
        if (!existing) {
          struggleMap.set(record.card.id, {
            card: record.card,
            worstGrade: record.grade,
            againCount: record.grade === 0 ? 1 : 0,
            hardCount: record.grade === 1 ? 1 : 0,
            lastTimestamp: record.timestamp,
          });
        } else {
          existing.worstGrade = Math.min(existing.worstGrade, record.grade) as SRSGrade;
          if (record.grade === 0) existing.againCount++;
          if (record.grade === 1) existing.hardCount++;
          existing.lastTimestamp = record.timestamp;
        }
      }
    }

    return Array.from(struggleMap.values())
      .sort((a, b) => {
        if (a.worstGrade !== b.worstGrade) return a.worstGrade - b.worstGrade;
        if (a.againCount !== b.againCount) return b.againCount - a.againCount;
        return b.lastTimestamp - a.lastTimestamp;
      })
      .map((item) => item.card);
  }, [sessionHistory]);

  // Phase 5: Create ephemeral practice queue for difficult cards (Zero scheduler mutation)
  const handleReviewDifficultCards = useCallback(() => {
    if (hardestCards.length === 0 || isReviewingRef.current) return;

    cancelSpeech();
    lastPronouncedCardIdRef.current = null;
    setIsCardPresentationReady(false);
    setSessionWords(hardestCards);
    setCurrentIndex(0);
    setIsSessionCompleted(false);
    setIsSessionStarted(true);
    setIsFlipped(false);
    setIsExampleRevealed(false);
    setSessionStreak(0);
    setReviewedCount(0);
    setRatingCounts({ again: 0, hard: 0, good: 0, easy: 0 });
    setSessionHistory([]);
    setMicroFeedback(null);
    setSelectedConfusionAnswer(null);
    showToast(`🎯 Bắt đầu ôn tập ${hardestCards.length} từ khó cần củng cố trong phiên!`);
  }, [hardestCards, showToast]);

  const isFinishingRef = useRef(false);
  const handleFinishSession = useCallback(() => {
    if (isFinishingRef.current) return;
    isFinishingRef.current = true;
    cancelSpeech();
    completeResumeActivity('flashcard_active_session');
    if (onNavigate) {
      onNavigate('vocabulary');
    } else {
      showToast('🎉 Hoàn thành phiên học!');
    }
    setTimeout(() => {
      isFinishingRef.current = false;
    }, 500);
  }, [onNavigate, showToast, completeResumeActivity]);

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

  // Helper tạo câu gợi ý có masked cụm từ cho mặt trước thẻ Collocation
  const getMaskedHint = (exampleEn: string, phrase: string): string => {
    if (!exampleEn || !phrase) return exampleEn;
    try {
      const escaped = phrase.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundaryRegex = new RegExp(`\\b${escaped}\\b`, 'gi');
      if (wordBoundaryRegex.test(exampleEn)) {
        return exampleEn.replace(wordBoundaryRegex, '[ _____ ]');
      }
      const looseRegex = new RegExp(escaped, 'gi');
      if (looseRegex.test(exampleEn)) {
        return exampleEn.replace(looseRegex, '[ _____ ]');
      }
    } catch {
      // fallback
    }
    return exampleEn;
  };

  // Helper tô đậm cụm từ trong câu ví dụ cho mặt sau thẻ Collocation
  const renderHighlightedExample = (exampleEn: string, phrase: string) => {
    if (!exampleEn || !phrase) return <span>{exampleEn}</span>;
    try {
      const escaped = phrase.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      const parts = exampleEn.split(regex);
      return (
        <span>
          {parts.map((part, i) =>
            regex.test(part) ? (
              <strong key={i} className="text-emerald-400 font-black underline decoration-emerald-500/40 underline-offset-2">
                {part}
              </strong>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </span>
      );
    } catch {
      return <span>{exampleEn}</span>;
    }
  };

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
      
      {/* RESUMABLE FLASHCARD SESSION BANNER (PHASE 4 CONTINUITY) */}
      {!sessionSemantics.isHydrating && hasResumableFlashcardSession && reviewedCardIdsRef.current.size === 0 && !isSessionCompleted && (
        <div
          data-testid="flashcard-resume-banner"
          className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-950 border border-emerald-500/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl animate-fadeIn"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-md border border-emerald-500/30">
                  Phiên học dở dang
                </span>
                <span className="text-xs text-slate-400">
                  Đã ôn {activeFlashcardResume?.checkpoint.reviewedCount || 0} / {activeFlashcardResume?.checkpoint.totalCards || activeFlashcardResume?.checkpoint.orderedCardIds?.length || 0} thẻ đã xử lý ({Math.max(0, (activeFlashcardResume?.checkpoint.totalCards || activeFlashcardResume?.checkpoint.orderedCardIds?.length || 0) - (activeFlashcardResume?.checkpoint.reviewedCount || 0))} còn lại)
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-black text-white mt-1">
                Tiếp tục phiên ôn
              </h4>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              data-testid="btn-resume-flashcards"
              onClick={handleResumeSession}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 hover:opacity-95 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-slate-950" />
              <span>Tiếp tục</span>
            </button>
            <button
              type="button"
              data-testid="btn-dismiss-flashcards"
              onClick={handleDismissSession}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer"
            >
              <span>Bắt đầu phiên mới</span>
            </button>
          </div>
        </div>
      )}

      <FlashcardQueueFilters
        cardTypeTab={cardTypeTab}
        setCardTypeTab={setCardTypeTab}
        dueAllCount={dueAllCount}
        dueSingleWordsCount={dueSingleWordsCount}
        dueCollocationsCount={dueCollocationsCount}
        queueMode={queueMode}
        setQueueMode={setQueueMode}
        totalDueReviewCount={totalDueReviewCount}
        srsAlgorithm={srsAlgorithm}
        setSRSAlgorithm={setSRSAlgorithm}
        fsrsDesiredRetention={fsrsDesiredRetention}
        showToast={showToast}
        newWordsLearnedCount={newWordsLearnedCount}
        dailyNewLimit={dailyNewLimit}
        isDailyNewGoalCompleted={isDailyNewGoalCompleted}
        handleCycleAudioSpeed={handleCycleAudioSpeed}
        speedBadge={speedBadge}
        autoPlayAudio={autoPlayAudio}
        setAutoPlayAudio={setAutoPlayAudio}
        isMaskExample={isMaskExample}
        setIsMaskExample={setIsMaskExample}
        setIsSettingsOpen={setIsSettingsOpen}
        selectedLevel={selectedLevel}
        setSelectedLevel={setSelectedLevel}
        tagsList={tagsList}
        selectedTag={selectedTag}
        setSelectedTag={setSelectedTag}
        getUnlearnedCountByTag={getUnlearnedCountByTag}
        getDueCountByTag={getDueCountByTag}
        favoriteCount={favoriteCount}
        unresolvedMistakesCount={unresolvedMistakesCount}
        savedSentencesCount={savedSentencesCount}
      />

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


      {/* ========================================================================= */}
      {/* 4. MÀN HÌNH HOÀN THÀNH PHIÊN HỌC & NẠP THÊM TỪ (COMPLETION VIEW)           */}
      {/* ========================================================================= */}
      {isSessionCompleted ? (
        <SessionSummary
          totalWords={totalWords}
          reviewedCount={reviewedCount}
          ratingCounts={ratingCounts}
          observedRetention={observedRetention}
          hardestCards={hardestCards}
          srsAlgorithm={srsAlgorithm}
          fsrsDesiredRetention={fsrsDesiredRetention}
          streak={streak}
          newWordsLearnedCount={newWordsLearnedCount}
          dailyNewLimit={dailyNewLimit}
          selectedBatchSize={selectedBatchSize}
          setSelectedBatchSize={setSelectedBatchSize}
          isCustomBatchOpen={isCustomBatchOpen}
          setIsCustomBatchOpen={setIsCustomBatchOpen}
          customBatchInput={customBatchInput}
          setCustomBatchInput={setCustomBatchInput}
          handleAddMoreWords={handleAddMoreWords}
          handleRestartSession={handleRestartSession}
          handleReviewDifficultCards={handleReviewDifficultCards}
          handleFinishSession={handleFinishSession}
          onNavigate={onNavigate}
        />
      ) : sessionSemantics.isHydrating ? (
        <div data-testid="flashcard-deck-hydrating" aria-busy="true" className="p-8 sm:p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl animate-pulse space-y-4">
          <div className="h-8 w-48 bg-slate-800 rounded-xl mx-auto" />
          <div className="h-4 w-72 bg-slate-800 rounded-md mx-auto" />
        </div>
      ) : totalWords === 0 || sessionSemantics.kind === 'empty' ? (
        /* HẾT TỪ TRONG HÀNG ĐỢI (SMART EMPTY STATE) */
        <div data-testid="flashcard-deck-empty" className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center shadow-2xl space-y-6 animate-fadeIn">
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
                : `Chọn số lượng từ mong muốn và bấm Nạp ngay để tiếp tục lộ trình học thông minh ${srsAlgorithm === 'fsrs' ? 'FSRS-4.5' : 'SM-2'}!`}
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
      ) : !isSessionStarted ? (
        /* BEFORE SESSION INTRO (PHASE 3 REFERENCE INTEGRATION) */
        <SessionIntro
          title={sessionSemantics.title}
          subtitle={
            todayPlanMeta?.planObjective
              ? todayPlanMeta.planObjective
              : selectedTag !== 'ALL'
              ? `Chủ đề: ${selectedTag} • ${totalWords} thẻ trong hàng đợi`
              : cardTypeTab === 'COLLOCATION'
              ? `Cụm từ & thành ngữ • ${totalWords} thẻ trong hàng đợi`
              : `Toàn bộ kho từ vựng • ${totalWords} thẻ trong hàng đợi`
          }
          badgeLabel={srsAlgorithm === 'fsrs' ? 'FSRS v4.5' : 'SM-2 Chuẩn'}
          estimatedDuration={formatSessionDurationBucket(
            todayPlanMeta?.estimatedMinutes ?? calculateTaskEstimatedMinutes('srs_review', totalWords)
          )}
          sourceContext={sourceContext}
          objective={sessionSemantics.objective}
          primaryAction={{
            label: sessionSemantics.actionLabel,
            disabled: !sessionSemantics.canStart,
            onClick: sessionSemantics.isResume
              ? handleResumeSession
              : () => {
                  if (sessionSemantics.canStart && sessionWords.length > 0) {
                    setIsSessionStarted(true);
                  }
                },
          }}
        />
      ) : !currentWord ? (
        null
      ) : (
        /* ACTIVE FLASHCARD LEARNING VIEW */
        <>
          {/* Phase 3: Session Header (Fixed-height, mobile-responsive, zero layout shift) */}
          <SessionHeader
            currentIndex={safeIndex}
            totalWords={totalWords}
            remainingCount={Math.max(0, totalWords - (safeIndex + 1))}
            sessionStreak={sessionStreak}
            queueMode={queueMode}
            srsAlgorithm={srsAlgorithm}
            retrievabilityInfo={retrievabilityInfo}
            tagLabel={isCurrentSentence ? 'Đoạn Dịch' : currentWord?.tag}
          />

          {/* Phase 3: Micro-feedback Floating Toast (Non-blocking, zero layout shift) */}
          <div className="relative min-h-[32px] flex items-center justify-center">
            <AnimatePresence>
              {microFeedback && (
                <motion.div
                  key={microFeedback.timestamp}
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                  className={`px-4 py-1.5 rounded-2xl text-xs sm:text-sm font-black shadow-xl backdrop-blur-md border flex items-center gap-2 pointer-events-none ${
                    microFeedback.grade === 0
                      ? 'bg-rose-950/90 border-rose-500/60 text-rose-200'
                      : microFeedback.grade === 1
                      ? 'bg-amber-950/90 border-amber-500/60 text-amber-200'
                      : microFeedback.grade === 2
                      ? 'bg-sky-950/90 border-sky-500/60 text-sky-200'
                      : 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>{microFeedback.text}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Phase 4: Synchronized Presentation Boundary */}
          <FlashcardPresentationBoundary
            card={currentWord}
            isReady={isCardPresentationReady}
            onPresented={handleCardPresented}
          >
            {/* 3D Flashcard Item */}
            <div 
              onClick={() => setIsFlipped(!isFlipped)}
              className="w-full min-h-[420px] perspective-1000 cursor-pointer select-none"
            >
            <motion.div
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.55, ease: [0.23, 1, 0.32, 1] }}
              className="w-full min-h-[420px] relative transform-style-3d"
            >
              
              {/* MẶT TRƯỚC (Front) */}
              <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border-2 border-slate-800 hover:border-emerald-500/50 rounded-3xl p-6 sm:p-8 flex flex-col justify-between backface-hidden shadow-2xl transition-colors">
                
                {/* Top Bar of Front */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center flex-wrap gap-1.5">
                    {/* Phase 4: Adaptive Presentation Mode Badge */}
                    {presentationPlan?.mode === 'reverse' ? (
                      <span className="text-xs font-black uppercase tracking-wider px-3 py-1 bg-amber-500/15 text-amber-300 rounded-full border border-amber-500/40 flex items-center gap-1.5 shadow-sm">
                        <span>🔄 Phản Xạ Ngược</span>
                      </span>
                    ) : presentationPlan?.mode === 'context_cloze' ? (
                      <span className="text-xs font-black uppercase tracking-wider px-3 py-1 bg-cyan-500/15 text-cyan-300 rounded-full border border-cyan-500/40 flex items-center gap-1.5 shadow-sm">
                        <span>📝 Điền Vào Câu</span>
                      </span>
                    ) : presentationPlan?.mode === 'confusion_challenge' ? (
                      <span className="text-xs font-black uppercase tracking-wider px-3 py-1 bg-rose-500/15 text-rose-300 rounded-full border border-rose-500/40 flex items-center gap-1.5 shadow-sm">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        <span>⚠️ Phân Biệt Từ</span>
                      </span>
                    ) : null}

                    {currentWord?.type !== 'single_word' ? (
                      <>
                        <span className="text-xs font-black uppercase tracking-wider px-3 py-1 bg-indigo-500/15 text-indigo-300 rounded-full border border-indigo-500/40 flex items-center gap-1.5 shadow-sm">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                          <span>
                            {currentWord?.type === 'idiom'
                              ? 'Idiom • Thành ngữ'
                              : currentWord?.type === 'phrasal_verb'
                              ? 'Phrasal Verb • Cụm động từ'
                              : 'Collocation • Cụm từ'}
                          </span>
                        </span>
                        {currentWord?.contextTag && (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 bg-slate-800 text-indigo-200 rounded-full border border-indigo-700/40">
                            {currentWord.contextTag}
                          </span>
                        )}
                      </>
                    ) : isCurrentSentence ? (
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
                        {srsAlgorithm === 'fsrs' && retrievabilityInfo && (
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${retrievabilityInfo.colorClass} flex items-center gap-1`}
                            title={
                              retrievabilityInfo.isNew
                                ? 'Từ mới chưa có lịch sử đánh giá FSRS'
                                : `Độ bền S: ${retrievabilityInfo.stability?.toFixed(1) || '?'} ngày | Độ khó D: ${retrievabilityInfo.difficulty?.toFixed(1) || '?'}`
                            }
                          >
                            {retrievabilityInfo.isNew ? '🌟 Mới' : `🧠 Nhớ: ${retrievabilityInfo.retentionPercent}%`}
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
                          : 'bg-slate-800/80 hover:bg-slate-750 text-slate-400 hover:text-amber-400'
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
                      onClick={handlePracticePronunciation}
                      title="Chấm điểm phát âm qua Micro (Phím V hoặc P)"
                      className="p-3 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-full transition-all shadow-lg shadow-teal-500/20 hover:scale-110"
                    >
                      <Mic className="w-5 h-5" />
                    </button>

                    {/* Audio Play Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayAudio(currentWord?.primaryText || currentWord?.word || '');
                      }}
                      title={`Phát âm với tốc độ ${speedBadge.label} (Phím R)`}
                      className="p-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-full transition-all shadow-lg shadow-emerald-500/20 hover:scale-110"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Center Core Word or Sentence (Phase 4 Adaptive Variations) */}
                <div className="text-center my-auto py-6 space-y-4">
                  {presentationPlan?.mode === 'reverse' ? (
                    /* Phase 4: Reverse Recall Front (Vietnamese Meaning -> Recall English) */
                    <div className="space-y-4 max-w-xl mx-auto">
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                          Nghĩa tiếng Việt cần chuyển sang tiếng Anh:
                        </span>
                        <h2 className="text-3xl sm:text-5xl font-black text-emerald-300 tracking-tight leading-snug">
                          {presentationPlan.meaning}
                        </h2>
                        {presentationPlan.partOfSpeech && (
                          <span className="text-xs text-slate-400 italic block">
                            ({presentationPlan.partOfSpeech})
                          </span>
                        )}
                        {presentationPlan.exampleVi && (
                          <p className="text-slate-400 text-sm sm:text-base max-w-md mx-auto pt-2 italic">
                            "{presentationPlan.exampleVi}"
                          </p>
                        )}
                      </div>
                    </div>
                  ) : presentationPlan?.mode === 'context_cloze' ? (
                    /* Phase 4: Context Cloze Front (Masked Sentence -> Recall Word) */
                    <div className="space-y-4 max-w-2xl mx-auto">
                      <div className="space-y-3">
                        <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">
                          Điền từ còn thiếu vào chỗ trống:
                        </span>
                        <p className="text-xl sm:text-2xl font-bold text-white leading-relaxed tracking-normal">
                          "{presentationPlan.maskedCloze}"
                        </p>
                        {presentationPlan.meaning && (
                          <div className="inline-block px-3 py-1 bg-slate-800/80 rounded-xl text-emerald-400 text-xs sm:text-sm font-semibold border border-slate-700/50">
                            Gợi ý nghĩa: {presentationPlan.meaning}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : presentationPlan?.mode === 'confusion_challenge' ? (
                    /* Phase 4: Confused Word Challenge Front (Strict Evidence-based Distractor Test) */
                    <div className="space-y-4 max-w-xl mx-auto">
                      <div className="space-y-3">
                        <p className="text-xs sm:text-sm font-bold text-rose-300">
                          {presentationPlan.confusionPair?.distractorExplanation || 'Chọn từ chính xác để hoàn thành ngữ cảnh:'}
                        </p>
                        {presentationPlan.maskedCloze && (
                          <p className="text-lg sm:text-xl font-bold text-white leading-relaxed italic">
                            "{presentationPlan.maskedCloze}"
                          </p>
                        )}
                        {/* Option Pills (Zero scheduler mutation on click) */}
                        <div className="flex items-center justify-center gap-3 pt-2">
                          {presentationPlan.confusionPair?.options.map((opt: ConfusedWordOption) => {
                            const isSelected = selectedConfusionAnswer === opt.word;
                            return (
                              <button
                                key={opt.word}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedConfusionAnswer(opt.word);
                                }}
                                className={`px-5 py-2.5 rounded-2xl text-sm font-black transition-all border ${
                                  isSelected
                                    ? opt.isCorrect
                                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/40'
                                      : 'bg-rose-500/20 border-rose-500 text-rose-300 ring-2 ring-rose-500/40'
                                    : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-white'
                                }`}
                              >
                                {opt.word}
                                {isSelected && (opt.isCorrect ? ' ✓' : ' ✗')}
                              </button>
                            );
                          })}
                        </div>
                        {selectedConfusionAnswer && (
                          <p className={`text-xs font-bold pt-1 ${
                            presentationPlan.confusionPair?.options.find((o: ConfusedWordOption) => o.word === selectedConfusionAnswer)?.isCorrect
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}>
                            {presentationPlan.confusionPair?.options.find((o: ConfusedWordOption) => o.word === selectedConfusionAnswer)?.isCorrect
                              ? '🎉 Chính xác! Lật thẻ để xem phân biệt chi tiết.'
                              : '⚠️ Chưa đúng! Lật thẻ để xem giải thích phân biệt.'}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : currentWord?.type !== 'single_word' ? (
                    /* Dành cho Collocation / Idiom */
                    <div className="space-y-4 max-w-2xl mx-auto">
                      <h2 data-testid="flashcard-front-word" className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-snug">
                        {currentWord?.primaryText || currentWord?.word}
                      </h2>
                      {currentWord?.exampleEn && (
                        <div className="bg-indigo-950/40 border border-indigo-800/40 rounded-2xl p-4 text-center space-y-1.5 shadow-inner">
                          <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block">
                            💡 Ngữ cảnh gợi ý (Điền vào chỗ trống):
                          </span>
                          <p className="text-sm sm:text-base text-slate-200 font-medium italic leading-relaxed">
                            "{getMaskedHint(currentWord.exampleEn, currentWord.primaryText || currentWord.word || '')}"
                          </p>
                        </div>
                      )}
                    </div>
                  ) : isCurrentSentence ? (
                    /* Dành cho câu dài / đoạn dịch */
                    <div className="space-y-3 max-w-2xl mx-auto">
                      <h2 data-testid="flashcard-front-word" className="text-lg sm:text-2xl font-bold text-white leading-relaxed tracking-normal">
                        "{currentWord?.word || currentWord?.primaryText}"
                      </h2>
                    </div>
                  ) : (
                    /* Dành cho từ vựng đơn (Standard Recall) */
                    <div className="space-y-3">
                      <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight flex items-center justify-center gap-2">
                        <span data-testid="flashcard-front-word">{currentWord?.word || currentWord?.primaryText}</span>
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

                      {/* Phase 4: Pronunciation Prompt Controls (Safe, non-intrusive) */}
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayAudio(currentWord?.primaryText || currentWord?.word || '');
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-700/60"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>🔊 Nghe mẫu</span>
                        </button>
                        <button
                          onClick={handlePracticePronunciation}
                          className="px-3 py-1.5 bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all border border-teal-500/40"
                        >
                          <Mic className="w-3.5 h-3.5 text-teal-400" />
                          <span>🎙 Luyện đọc</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Flip Hint (Dynamic Label for Front) */}
                <div className="flex justify-center items-center gap-2 text-xs text-slate-400 pt-4 border-t border-slate-800/80">
                  <RotateCw className="w-4 h-4 text-emerald-400 animate-spin-slow" />
                  <span>
                    {presentationPlan?.mode === 'reverse'
                      ? 'Chạm vào thẻ hoặc nhấn Space để kiểm tra từ tiếng Anh'
                      : presentationPlan?.mode === 'context_cloze'
                      ? 'Chạm vào thẻ hoặc nhấn Space để xem đáp án câu ví dụ'
                      : presentationPlan?.mode === 'confusion_challenge'
                      ? 'Chạm vào thẻ hoặc nhấn Space để xem phân biệt cặp từ'
                      : 'Chạm vào thẻ hoặc nhấn Space để xem nghĩa'}
                  </span>
                </div>
              </div>

              {/* MẶT SAU (Back) */}
              <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 border-2 border-emerald-500/40 rounded-3xl p-6 sm:p-8 flex flex-col justify-between backface-hidden rotate-y-180 shadow-2xl">
                
                <div className="space-y-4">
                  {/* Top Bar of Back */}
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      {presentationPlan?.mode === 'confusion_challenge'
                        ? 'Phân biệt cặp từ dễ lẫn'
                        : presentationPlan?.mode === 'reverse'
                        ? 'Đáp án tiếng Anh & Ví dụ'
                        : presentationPlan?.mode === 'context_cloze'
                        ? 'Đáp án câu ngữ cảnh'
                        : currentWord?.type !== 'single_word' 
                        ? 'Ý nghĩa cụm từ & Ghi chú' 
                        : isCurrentSentence 
                        ? 'Bản Dịch Nghĩa Tiếng Việt' 
                        : 'Định nghĩa tiếng Việt'}
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
                        onClick={handlePracticePronunciation}
                        title="Chấm điểm phát âm qua Micro (Phím V hoặc P)"
                        className="p-2 bg-slate-800 hover:bg-teal-500 text-teal-400 hover:text-slate-950 rounded-full text-xs flex items-center gap-1.5 transition-all"
                      >
                        <Mic className="w-4 h-4" />
                        <span>Luyện đọc Mic</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayAudio(currentWord?.exampleEn || currentWord?.example || currentWord?.primaryText || currentWord?.word || '');
                        }}
                        title={`Nghe audio với tốc độ ${speedBadge.label}`}
                        className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-full text-xs flex items-center gap-1.5"
                      >
                        <Volume2 className="w-4 h-4 text-emerald-400" />
                        <span>Nghe audio</span>
                      </button>
                    </div>
                  </div>

                  {/* Phase 4: Adaptive Back Content */}
                  {presentationPlan?.mode === 'confusion_challenge' ? (
                    /* Confusion Challenge Back: Side-by-side comparison */
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-1">
                          <span className="text-[11px] text-emerald-400 font-bold block uppercase tracking-wider">✓ Từ chính xác:</span>
                          <strong className="text-lg text-white font-black">{presentationPlan.targetWord}</strong>
                          {presentationPlan.ipa && <span className="text-xs text-slate-400 font-mono block">{presentationPlan.ipa}</span>}
                          <p className="text-xs text-slate-200">{presentationPlan.meaning}</p>
                        </div>
                        <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-2xl space-y-1">
                          <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider">Từ dễ nhầm:</span>
                          <strong className="text-lg text-slate-300 font-black">{presentationPlan.confusionPair?.confusedWith}</strong>
                          <p className="text-xs text-slate-400">Khác nghĩa hoặc ngữ cảnh sử dụng</p>
                        </div>
                      </div>
                      {presentationPlan.exampleEn && (
                        <div className="bg-slate-850/80 border border-slate-700/60 rounded-2xl p-3 text-left space-y-1">
                          <p className="text-xs sm:text-sm text-slate-200 font-medium">{presentationPlan.exampleEn}</p>
                          {presentationPlan.exampleVi && (
                            <p className="text-xs text-slate-400 italic">→ {presentationPlan.exampleVi}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : presentationPlan?.mode === 'reverse' || presentationPlan?.mode === 'context_cloze' ? (
                    /* Reverse / Context Cloze Back: Reveal Target Word Prominently */
                    <div className="space-y-3 text-center py-2">
                      <div className="space-y-1">
                        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                          {presentationPlan.targetWord}
                        </h2>
                        {presentationPlan.ipa && (
                          <div className="inline-block px-3 py-1 bg-slate-800/80 rounded-xl text-emerald-400 font-mono text-sm border border-slate-700/50">
                            {presentationPlan.ipa}
                          </div>
                        )}
                        <h3 className="text-lg sm:text-xl font-extrabold text-emerald-300 pt-1">
                          {presentationPlan.meaning}
                        </h3>
                      </div>
                      {presentationPlan.exampleEn && (
                        <div className="bg-slate-850/80 border border-slate-700/60 rounded-2xl p-3 text-left space-y-1">
                          <p className="text-xs sm:text-sm text-slate-200 font-medium">
                            {renderMaskedExample(presentationPlan.exampleEn, presentationPlan.targetWord)}
                          </p>
                          {presentationPlan.exampleVi && (
                            <p className="text-xs text-slate-400 italic">→ {presentationPlan.exampleVi}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Standard / Collocation Back */
                    <div>
                      <h3 className={`${currentWord?.type !== 'single_word' || isCurrentSentence ? 'text-xl sm:text-2xl font-extrabold text-emerald-300 leading-relaxed' : 'text-2xl sm:text-3xl font-extrabold text-white leading-snug'}`}>
                        {currentWord?.meaning}
                      </h3>

                      {/* Example Context (Hỗ trợ exampleEn và exampleVi) */}
                      {(() => {
                        const exEn = currentWord?.exampleEn || currentWord?.example || '';
                        const exVi = currentWord?.exampleVi || currentWord?.exampleMeaning || '';
                        const primary = currentWord?.primaryText || currentWord?.word || '';
                        if (!exEn || exEn.trim() === primary.trim()) return null;

                        return (
                          <div className="bg-slate-850/80 border border-slate-700/60 rounded-2xl p-4 space-y-2 mt-3">
                            <div className="text-sm sm:text-base text-slate-200 font-medium leading-relaxed">
                              {currentWord?.type !== 'single_word'
                                ? renderHighlightedExample(exEn, primary)
                                : renderMaskedExample(exEn, currentWord?.word || '')}
                            </div>
                            {exVi && (
                              <p className="text-xs sm:text-sm text-slate-400 italic">
                                → {exVi}
                              </p>
                            )}
                          </div>
                        );
                      })()}

                      {/* Context Tag for Collocations */}
                      {currentWord?.type !== 'single_word' && currentWord?.contextTag && (
                        <div className="flex items-center gap-2 pt-2">
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Ngữ cảnh:</span>
                          <span className="px-3 py-1 bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-bold">
                            {currentWord.contextTag}
                          </span>
                        </div>
                      )}

                      {/* Collocations & Synonyms for Single Words */}
                      {currentWord?.type === 'single_word' && currentWord?.collocations && currentWord.collocations.length > 0 && (
                        <div className="space-y-1 pt-2">
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cụm từ hay gặp:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {currentWord.collocations.map((col: string, idx: number) => (
                              <span key={idx} className="px-2.5 py-0.5 bg-slate-800 text-teal-300 rounded-lg text-xs border border-slate-700/50">
                                {col}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* SRS Info Footer */}
                {srsAlgorithm === 'fsrs' ? (
                  <div className="flex justify-between items-center text-[11px] text-slate-500 pt-3 border-t border-slate-800">
                    <span>Độ bền (S): <strong className="text-teal-300">{retrievabilityInfo?.stability !== undefined ? `${retrievabilityInfo.stability.toFixed(1)} ngày` : 'Mới'}</strong></span>
                    <span>Độ khó (D): <strong className="text-amber-300">{retrievabilityInfo?.difficulty !== undefined ? `${retrievabilityInfo.difficulty.toFixed(1)}/10` : 'Chưa định'}</strong></span>
                    <span>Xác suất nhớ (R): <strong className={retrievabilityInfo?.retentionPercent !== undefined && retrievabilityInfo.retentionPercent < 75 ? 'text-rose-400' : retrievabilityInfo?.retentionPercent !== undefined && retrievabilityInfo.retentionPercent < 90 ? 'text-amber-400' : 'text-emerald-400'}>{retrievabilityInfo ? `${retrievabilityInfo.retentionPercent}%` : '100%'}</strong></span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center text-[11px] text-slate-500 pt-3 border-t border-slate-800">
                    <span>Khoảng cách: <strong className="text-slate-300">{currentWord?.interval || 0} ngày</strong></span>
                    <span>Hệ số Ease: <strong className="text-slate-300">{currentWord?.easeFactor || 2.5}</strong></span>
                    <span>Độ thành thạo: <strong className="text-emerald-400">{currentWord?.srsLevel || 0}★</strong></span>
                  </div>
                )}

              </div>

            </motion.div>
          </div>
        </FlashcardPresentationBoundary>

          {/* ========================================================================= */}
          {/* BOTTOM CONTROLS: 3-COLUMN ERGONOMIC LAYOUT (BOUNDARY-CHECKED NEXT/FINISH) */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-3 pt-2">
            
            {/* Cột 1: Nút Từ Trước */}
            <button
              onClick={handlePrev}
              disabled={safeIndex === 0 || isReviewing}
              aria-disabled={safeIndex === 0 || isReviewing}
              title="Từ trước (Phím A hoặc mũi tên ←)"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-900 hover:bg-slate-850 active:scale-[0.98] duration-150 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-30 disabled:hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-bold rounded-2xl transition-all text-xs sm:text-sm shadow-md"
            >
              <ChevronLeft className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>◀ Từ trước</span>
              <kbd className="hidden md:inline px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-400 text-[10px]">A</kbd>
            </button>

            {/* Cột 2: Nút Lật Thẻ / Đổi Mặt Động (Dynamic Label) */}
            <button
              data-testid="btn-flip-card"
              onClick={() => setIsFlipped(!isFlipped)}
              disabled={isReviewing}
              aria-disabled={isReviewing}
              title={isFlipped ? 'Quay lại mặt trước (Phím Space)' : 'Xem nghĩa & giải thích (Phím Space)'}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-850 hover:bg-slate-800 active:scale-[0.98] duration-150 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 border border-slate-750 text-emerald-400 hover:text-emerald-300 font-bold rounded-2xl transition-all text-xs sm:text-sm shadow-md disabled:opacity-50"
            >
              <RotateCw className={`w-4 h-4 text-emerald-400 ${isFlipped ? 'rotate-180' : ''} transition-transform duration-300`} />
              <span>{isFlipped ? '🔄 Xem mặt trước / Lật lại' : '🔄 Xem nghĩa / Lật thẻ'}</span>
              <kbd className="hidden md:inline px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-emerald-400 text-[10px]">Space</kbd>
            </button>

            {/* Cột 3: Nút Từ Tiếp Theo / Hoàn Thành Phiên */}
            <button
              data-testid="btn-next-card"
              onClick={handleNext}
              disabled={isReviewing}
              aria-disabled={isReviewing}
              title={isLastCard ? 'Hoàn thành phiên học (Phím D)' : 'Từ tiếp theo (Phím D hoặc mũi tên →)'}
              className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 text-xs sm:text-sm font-black shadow-lg disabled:opacity-50 ${
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
                transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2"
              >
                {/* 1. Again */}
                <button
                  data-testid="btn-grade-again"
                  onClick={() => handleGrade(0)}
                  disabled={isReviewing}
                  aria-disabled={isReviewing}
                  className="flex flex-col items-center justify-center p-3.5 min-h-[76px] bg-red-500/10 hover:bg-red-500 active:scale-[0.97] transition-all duration-150 motion-reduce:transform-none motion-reduce:transition-none text-red-400 hover:text-white border border-red-500/30 rounded-2xl font-bold group shadow-lg relative disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-900/60 text-red-300 font-mono">1</span>
                  <span className="text-sm">Quên (Again)</span>
                  <span className="text-[11px] font-normal opacity-80 mt-0.5 min-w-[55px] text-center">
                    {intervalPreviews.again}
                  </span>
                </button>

                {/* 2. Hard */}
                <button
                  data-testid="btn-grade-hard"
                  onClick={() => handleGrade(1)}
                  disabled={isReviewing}
                  aria-disabled={isReviewing}
                  className="flex flex-col items-center justify-center p-3.5 min-h-[76px] bg-amber-500/10 hover:bg-amber-500 active:scale-[0.97] transition-all duration-150 motion-reduce:transform-none motion-reduce:transition-none text-amber-400 hover:text-white border border-amber-500/30 rounded-2xl font-bold group shadow-lg relative disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-900/60 text-amber-300 font-mono">2</span>
                  <span className="text-sm">Khó (Hard)</span>
                  <span className="text-[11px] font-normal opacity-80 mt-0.5 min-w-[55px] text-center">
                    {intervalPreviews.hard}
                  </span>
                </button>

                {/* 3. Good */}
                <button
                  data-testid="btn-grade-good"
                  onClick={() => handleGrade(2)}
                  disabled={isReviewing}
                  aria-disabled={isReviewing}
                  className="flex flex-col items-center justify-center p-3.5 min-h-[76px] bg-blue-500/10 hover:bg-blue-500 active:scale-[0.97] transition-all duration-150 motion-reduce:transform-none motion-reduce:transition-none text-blue-400 hover:text-white border border-blue-500/30 rounded-2xl font-bold group shadow-lg relative disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-900/60 text-blue-300 font-mono">3</span>
                  <span className="text-sm">Tốt (Good)</span>
                  <span className="text-[11px] font-normal opacity-80 mt-0.5 min-w-[55px] text-center">
                    {intervalPreviews.good}
                  </span>
                </button>

                {/* 4. Easy */}
                <button
                  data-testid="btn-grade-easy"
                  onClick={() => handleGrade(3)}
                  disabled={isReviewing}
                  aria-disabled={isReviewing}
                  className="flex flex-col items-center justify-center p-3.5 min-h-[76px] bg-emerald-500/10 hover:bg-emerald-500 active:scale-[0.97] transition-all duration-150 motion-reduce:transform-none motion-reduce:transition-none text-emerald-400 hover:text-white border border-emerald-500/30 rounded-2xl font-bold group shadow-lg relative disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-900/60 text-emerald-300 font-mono">4</span>
                  <span className="text-sm">Dễ (Easy)</span>
                  <span className="text-[11px] font-normal opacity-80 mt-0.5 min-w-[55px] text-center">
                    {intervalPreviews.easy}
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
          targetText={currentWord.primaryText || currentWord.word || ''}
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

export const FlashcardDeck = React.memo(FlashcardDeckComponent);
