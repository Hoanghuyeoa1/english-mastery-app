import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Headphones,
  Globe,
  PartyPopper,
  ArrowRight,
  Clock,
  Sparkles,
  X
} from 'lucide-react';
import { triggerCelebration } from '../utils/confettiPolicy';
import { useAppStore } from '../store/useAppStore';
import { speakWord } from '../services/speechService';
import { getFullDictionaryBank } from '../services/dictionaryIndex';
import { 
  cleanWordString, 
  cleanMeaningForScramble,
  sanitizeExampleSentence, 
  maskTargetWordInSentence 
} from '../services/textSanitizer';
import { getDistractorMeanings } from '../services/quizDistractorEngine';
import { WordScramble } from './WordScramble';
import { SessionProgressHeader, NextActionPanel } from './session';
import { deriveQuizSessionModel, clampProgressPercent } from '../services/sessionExperienceAdapter';
import type { SessionProgressMetric, SessionSourceContext } from '../types/sessionExperience';
import { selectAdaptiveQuizItems } from '../services/adaptiveQuizService';
import { evaluateAdaptiveDifficulty } from '../services/adaptiveDifficultyService';
import { deriveLearnerCefrLevel } from '../services/learningDictionaryService';
import { 
  VocabWord, 
  VocabTag, 
  QuizSourceMode, 
  ActiveTab, 
  MistakeResolutionEvent, 
  LearnerQuizContext,
  RecentAnswerRecord,
  AdaptiveQuizCategory,
  AdaptiveDifficultyTier,
  ArcadeMode,
} from '../types';

interface MatchTile {
  id: string;
  wordId: string;
  type: 'en' | 'vi';
  text: string;
  isMatched: boolean;
}

interface FloatingBadge {
  id: string;
  word: string;
  xp: number;
}

interface MistakeSessionRecord {
  wordId: string;
  word: string;
  meaning?: string;
  consecutiveCorrect: number;
  resolved: boolean;
  newlyResolved: boolean;
  lastAnswer: 'correct' | 'wrong';
}

interface QuizArenaProps {
  defaultCategory?: string;
  onNavigate?: (tab: ActiveTab) => void;
}

export const QuizArena: React.FC<QuizArenaProps> = ({ defaultCategory, onNavigate }) => {
  const { 
    vocabularyList, 
    gainXP, 
    recordQuizCompleted,
    consumeHeart, 
    audioVoice, 
    audioSpeed, 
    getUnresolvedMistakeWords, 
    recordQuizMistakeResult, 
    mistakeBank,
    activePracticeConfig,
    clearAdaptivePractice,
    srsProgressMap,
    fourSkillsScores,
    wordLearningStats,
    recordAdaptiveQuizEvent,
  } = useAppStore();

  const recentQuizWordIdsRef = useRef<string[]>([]);

  const learnerContext: LearnerQuizContext = useMemo(() => ({
    srsProgressMap,
    mistakeBank,
    wordLearningStats,
    fourSkillsScores,
    recentWordIds: recentQuizWordIdsRef.current,
  }), [srsProgressMap, mistakeBank, wordLearningStats, fourSkillsScores]);

  // Source Switcher: 'all_vocab' (Toàn Bộ Từ Vựng) | 'mistake_bank' (Phục Thù Bẫy Lỗi)
  const [sourceMode, setSourceMode] = useState<QuizSourceMode>(() => {
    if (activePracticeConfig?.itemIds && activePracticeConfig.itemIds.length > 0) {
      return 'mistake_bank';
    }
    return 'all_vocab';
  });

  const [activeMode, setActiveMode] = useState<ArcadeMode>(() => {
    if (activePracticeConfig?.module === 'dictation') return 'dictation';
    if (activePracticeConfig?.module === 'word_scramble') return 'word_scramble';
    if (activePracticeConfig?.module === 'classic_quiz') return 'classic_quiz';
    if (defaultCategory === 'speed_match') return 'speed_match';
    if (defaultCategory === 'word_scramble') return 'word_scramble';
    if (defaultCategory === 'dictation') return 'dictation';
    if (defaultCategory === 'classic_quiz') return 'classic_quiz';
    return 'speed_match';
  });

  // Đồng bộ động nếu phiên Adaptive Practice được kích hoạt khi QuizArena đang hiển thị
  useEffect(() => {
    if (activePracticeConfig?.module) {
      const mod = activePracticeConfig.module;
      if (mod === 'dictation' || mod === 'word_scramble' || mod === 'classic_quiz') {
        setActiveMode(mod as ArcadeMode);
        setSourceMode('mistake_bank');
      }
    }
  }, [activePracticeConfig]);

  const [selectedTag, setSelectedTag] = useState<VocabTag | 'ALL'>('ALL');
  const [streakCount, setStreakCount] = useState(0);
  const [totalXpSession, setTotalXpSession] = useState(0);

  // Session Experience & Lifecycle Protection (Phase 7)
  const hasCompletedSessionRef = useRef(false);
  const currentQuizSessionIdRef = useRef<string>('quiz_session_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6));
  const [completedPlannedItemsCount, setCompletedPlannedItemsCount] = useState(0);

  const totalPlannedItems = useMemo(() => {
    return activePracticeConfig?.itemIds?.length || 0;
  }, [activePracticeConfig]);

  const sourceContext: SessionSourceContext | undefined = useMemo(() => {
    if (!activePracticeConfig) return undefined;
    return {
      todayPlanTaskId: activePracticeConfig.planItemId,
      sourceModule: activePracticeConfig.module,
      targetItemIds: activePracticeConfig.itemIds,
      mistakeType: activePracticeConfig.mistakeType,
    };
  }, [activePracticeConfig]);

  // Adaptive Difficulty State & Answer Recording (Phase 2 & 3)
  const [sessionRecentAnswers, setSessionRecentAnswers] = useState<RecentAnswerRecord[]>([]);
  const [sessionMixCounts, setSessionMixCounts] = useState<Record<AdaptiveQuizCategory, number>>({
    weak: 0,
    due: 0,
    new: 0,
    mastered: 0,
  });

  const initialDifficultyTierRef = useRef<AdaptiveDifficultyTier>('normal');
  const hasRecordedInitialTierRef = useRef(false);

  const wordCategoryMapRef = useRef<Map<string, AdaptiveQuizCategory>>(new Map());

  const registerWordCategory = useCallback((wordId?: string, wordText?: string, category: AdaptiveQuizCategory = 'new') => {
    if (wordId) wordCategoryMapRef.current.set(wordId.toLowerCase().trim(), category);
    if (wordText) wordCategoryMapRef.current.set(wordText.toLowerCase().trim(), category);
  }, []);

  const resolveWordCategory = useCallback((wordId?: string, wordText?: string): AdaptiveQuizCategory => {
    if (sourceMode === 'mistake_bank') return 'weak';
    const idKey = wordId?.toLowerCase().trim();
    if (idKey && wordCategoryMapRef.current.has(idKey)) {
      return wordCategoryMapRef.current.get(idKey)!;
    }
    const textKey = wordText?.toLowerCase().trim();
    if (textKey && wordCategoryMapRef.current.has(textKey)) {
      return wordCategoryMapRef.current.get(textKey)!;
    }
    const cleanKey = idKey || textKey;
    if (cleanKey && mistakeBank[cleanKey] && !mistakeBank[cleanKey].resolved && (mistakeBank[cleanKey].mistakeCount > 0)) {
      return 'weak';
    }
    return 'new';
  }, [sourceMode, mistakeBank]);

  const recordSessionAnswer = useCallback((
    isCorrect: boolean, 
    wordId?: string, 
    wordText?: string, 
    mode: ArcadeMode = activeMode
  ) => {
    const cleanWordId = wordId || wordText || 'unknown';
    const cleanWordText = wordText || wordId || 'unknown';

    setSessionRecentAnswers((prev) => {
      const next = [...prev, { isCorrect, wordId: cleanWordId, timestamp: Date.now() }];
      return next.length > 20 ? next.slice(-20) : next;
    });

    const category = resolveWordCategory(cleanWordId, cleanWordText);
    setSessionMixCounts((prev) => ({
      ...prev,
      [category]: prev[category] + 1,
    }));

    recordAdaptiveQuizEvent({
      wordId: cleanWordId,
      word: cleanWordText,
      isCorrect,
      category,
      difficulty: difficultyEvaluationRef.current.tier,
      mode,
    });

    if (totalPlannedItems > 0) {
      setCompletedPlannedItemsCount((prev) => {
        const next = Math.min(totalPlannedItems, prev + 1);
        if (next >= totalPlannedItems && !hasCompletedSessionRef.current) {
          hasCompletedSessionRef.current = true;
          setShowVictoryModal(true);
          recordQuizCompleted(0, streakCount > 5, {
            quizId: currentQuizSessionIdRef.current,
            quizType: activeMode === 'dictation' ? 'dictation' : activeMode === 'word_scramble' ? 'word_scramble' : 'standard',
            score: streakCount * 10,
            totalQuestions: totalPlannedItems,
            correctCount: completedPlannedItemsCount + 1,
            mistakeCount: sessionRecentAnswers.filter((a) => !a.isCorrect).length,
          });
        }
        return next;
      });
    }
  }, [activeMode, resolveWordCategory, recordAdaptiveQuizEvent, totalPlannedItems]);

  const learnerCefr = useMemo(() => {
    return deriveLearnerCefrLevel(fourSkillsScores).learnerLevel;
  }, [fourSkillsScores]);

  const difficultyEvaluation = useMemo(() => {
    return evaluateAdaptiveDifficulty({
      learnerCefr,
      recentAnswers: sessionRecentAnswers,
      consecutiveStreak: streakCount,
      windowSize: 8,
    });
  }, [learnerCefr, sessionRecentAnswers, streakCount]);

  const difficultyEvaluationRef = useRef(difficultyEvaluation);
  useEffect(() => {
    difficultyEvaluationRef.current = difficultyEvaluation;
    if (!hasRecordedInitialTierRef.current && difficultyEvaluation.tier) {
      initialDifficultyTierRef.current = difficultyEvaluation.tier;
      hasRecordedInitialTierRef.current = true;
    }
  }, [difficultyEvaluation]);

  // Floating Badges for newly resolved words
  const [floatingBadges, setFloatingBadges] = useState<FloatingBadge[]>([]);

  // Session Mistake Results for Victory Modal
  const [sessionMistakeResults, setSessionMistakeResults] = useState<Record<string, MistakeSessionRecord>>({});
  const [showVictoryModal, setShowVictoryModal] = useState(false);

  const triggerResolvedBadge = useCallback((word: string, xp = 25) => {
    const id = `badge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setFloatingBadges((prev) => [...prev, { id, word, xp }]);
    triggerCelebration('micro', {
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#10B981', '#F59E0B', '#3B82F6', '#EC4899'],
    });
    setTimeout(() => {
      setFloatingBadges((prev) => prev.filter((b) => b.id !== id));
    }, 3200);
  }, []);

  // Handler ghi nhận tiến trình bẫy lỗi và kích hoạt Floating Badge
  const handleMistakeResolution = useCallback((event: MistakeResolutionEvent, targetMeaning?: string) => {
    if (event.newlyResolved) {
      triggerResolvedBadge(event.word, 25);
    }

    setSessionMistakeResults((prev) => {
      const key = event.word.toLowerCase().trim();
      return {
        ...prev,
        [key]: {
          wordId: event.wordId,
          word: event.word,
          meaning: targetMeaning || prev[key]?.meaning || '',
          consecutiveCorrect: event.consecutiveCorrect,
          resolved: event.resolved,
          newlyResolved: event.newlyResolved || prev[key]?.newlyResolved || false,
          lastAnswer: event.consecutiveCorrect > 0 ? 'correct' : 'wrong',
        },
      };
    });
  }, [triggerResolvedBadge]);

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

  // Bộ từ lọc theo tag (cho chế độ Toàn bộ từ vựng)
  const filteredVocab = useMemo(() => {
    if (selectedTag === 'ALL') return masterVocabBank;
    return masterVocabBank.filter((w) => w.tag === selectedTag);
  }, [masterVocabBank, selectedTag]);

  // Danh sách từ bẫy lỗi chưa giải quyết (phản ứng theo mistakeBank & vocabularyList)
  const unresolvedMistakes = useMemo(() => {
    void mistakeBank;
    void vocabularyList;
    return getUnresolvedMistakeWords();
  }, [getUnresolvedMistakeWords, mistakeBank, vocabularyList]);

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
    let selectedWords: VocabWord[] = [];
    const speedParams = difficultyEvaluationRef.current.modeParams.speedMatch;
    const pairCount = speedParams.pairCount;

    if (sourceMode === 'mistake_bank') {
      if (unresolvedMistakes.length < 4) return;
      const adaptiveResult = selectAdaptiveQuizItems(unresolvedMistakes, learnerContext, {
        count: pairCount,
      });
      adaptiveResult.classifiedItems.forEach((c) => {
        registerWordCategory(c.word.id, c.word.word, c.category);
      });
      selectedWords = adaptiveResult.items;

      // Fallback Distractor Engine: Nếu có 4 hoặc 5 từ bẫy lỗi (< pairCount cặp), tự động lấy thêm từ kho tổng
      if (selectedWords.length < pairCount) {
        const selectedKeys = new Set(selectedWords.map(w => cleanWordString(w.word).toLowerCase()));
        const fillCandidates = masterVocabBank.filter(w => !selectedKeys.has(cleanWordString(w.word).toLowerCase()));
        const fillAdaptive = selectAdaptiveQuizItems(fillCandidates, learnerContext, {
          count: pairCount - selectedWords.length,
          excludeWordIds: selectedKeys,
        });
        fillAdaptive.classifiedItems.forEach((c) => {
          registerWordCategory(c.word.id, c.word.word, c.category);
        });
        selectedWords = [...selectedWords, ...fillAdaptive.items];
      }
    } else {
      const pool = filteredVocab.length >= 8 ? filteredVocab : masterVocabBank;
      const adaptiveResult = selectAdaptiveQuizItems(pool, learnerContext, {
        count: pairCount,
        tagFilter: selectedTag,
        excludeWordIds: recentQuizWordIdsRef.current,
      });
      adaptiveResult.classifiedItems.forEach((c) => {
        registerWordCategory(c.word.id, c.word.word, c.category);
      });
      selectedWords = adaptiveResult.items.length >= 4 ? adaptiveResult.items : pool.slice(0, pairCount);
    }

    selectedWords.forEach((w) => {
      recentQuizWordIdsRef.current.push(w.id || cleanWordString(w.word));
      if (recentQuizWordIdsRef.current.length > 20) {
        recentQuizWordIdsRef.current.shift();
      }
    });

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
    setMatchTimeLeft(speedParams.timeLimitSeconds);
    setMatchScore(0);
    setMatchCombo(0);
    setMaxMatchCombo(0);
    hasCompletedSessionRef.current = false;
    currentQuizSessionIdRef.current = 'quiz_match_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    setIsMatchRunning(true);
    setIsMatchOver(false);
  }, [sourceMode, unresolvedMistakes, filteredVocab, masterVocabBank, learnerContext, selectedTag, registerWordCategory]);

  // Timer cho Speed Match
  useEffect(() => {
    if (!isMatchRunning || matchTimeLeft <= 0) return;
    const timer = setInterval(() => {
      setMatchTimeLeft((prev) => {
        if (prev <= 1) {
          if (!hasCompletedSessionRef.current) {
            hasCompletedSessionRef.current = true;
            setIsMatchRunning(false);
            setIsMatchOver(true);
            setShowVictoryModal(true);
            triggerCelebration('completion', { particleCount: 60, spread: 70, origin: { y: 0.5 } });
            recordQuizCompleted(0, matchScore > 500, {
              quizId: currentQuizSessionIdRef.current,
              quizType: 'word_match',
              score: matchScore,
              totalQuestions: sessionRecentAnswers.length,
              correctCount: sessionRecentAnswers.filter((a) => a.isCorrect).length,
              mistakeCount: sessionRecentAnswers.filter((a) => !a.isCorrect).length,
            });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isMatchRunning, matchTimeLeft, matchScore, sessionRecentAnswers, recordQuizCompleted]);

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
      const meaningText = selectedTile.type === 'vi' ? selectedTile.text : tile.text;
      speakWord(wordText, audioVoice, audioSpeed);
      recordSessionAnswer(true, tile.wordId, wordText, 'speed_match');

      // Cập nhật kết quả bẫy lỗi và kích hoạt Floating Badge nếu newlyResolved
      const event = recordQuizMistakeResult(tile.wordId, true, {
        source: 'speed_match',
        type: 'meaning',
      });
      handleMistakeResolution(event, meaningText);

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
        triggerCelebration('completion', { particleCount: 50, spread: 60, origin: { y: 0.6 } });
        setTimeout(() => {
          startSpeedMatch();
        }, 600);
      }
    } else {
      // SAI CẶP!
      const enTile = selectedTile.type === 'en' ? selectedTile : tile.type === 'en' ? tile : null;
      const viTile = selectedTile.type === 'vi' ? selectedTile : tile.type === 'vi' ? tile : null;
      recordSessionAnswer(false, enTile?.wordId || tile.wordId, enTile?.text || tile.text, 'speed_match');
      if (enTile) {
        const vocabWord = vocabularyList.find(
          (w) => w.word.toLowerCase() === enTile.text.toLowerCase() || (enTile.wordId && w.id === enTile.wordId)
        );
        const event = recordQuizMistakeResult(enTile.wordId || enTile.text, false, {
          source: 'speed_match',
          type: 'meaning',
          userAnswer: viTile?.text,
          expectedAnswer: vocabWord?.meaning,
          context: vocabWord?.example || vocabWord?.example_en,
        });
        handleMistakeResolution(event);
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
    let pool: VocabWord[];
    const hasTargetedPractice = Boolean(activePracticeConfig?.itemIds && activePracticeConfig.itemIds.length > 0);

    if (sourceMode === 'mistake_bank') {
      if (unresolvedMistakes.length < 4 && !hasTargetedPractice) return;
      pool = unresolvedMistakes.length > 0 ? unresolvedMistakes : masterVocabBank;
    } else {
      pool = filteredVocab.length > 0 ? filteredVocab : masterVocabBank;
    }

    if (pool.length === 0) return;

    // Ưu tiên chọn từ mục tiêu từ phiên Adaptive Practice nếu có
    let targetedWord: VocabWord | undefined;
    if (hasTargetedPractice && activePracticeConfig) {
      for (const rawId of activePracticeConfig.itemIds) {
        const cleanTarget = rawId.trim().toLowerCase();
        // 1. Ưu tiên khớp chính xác theo targetId trước để chống collision
        targetedWord = pool.find((w) => w.id?.toLowerCase() === cleanTarget)
          || masterVocabBank.find((w) => w.id?.toLowerCase() === cleanTarget)
          || unresolvedMistakes.find((w) => w.id?.toLowerCase() === cleanTarget);

        // 2. Fallback sang khớp word text nếu không tìm thấy theo id
        if (!targetedWord) {
          targetedWord = pool.find((w) => w.word.toLowerCase() === cleanTarget)
            || masterVocabBank.find((w) => w.word.toLowerCase() === cleanTarget)
            || unresolvedMistakes.find((w) => w.word.toLowerCase() === cleanTarget);
        }
        if (targetedWord) break;
      }
      // Dọn dẹp config tạm thời ngay khi đã consume target để không rò rỉ sang lượt sau
      clearAdaptivePractice();
    }

    let word = targetedWord;
    if (!word) {
      const adaptiveResult = selectAdaptiveQuizItems(pool, learnerContext, {
        count: 1,
        tagFilter: sourceMode === 'all_vocab' ? selectedTag : 'ALL',
        excludeWordIds: recentQuizWordIdsRef.current,
      });
      adaptiveResult.classifiedItems.forEach((c) => {
        registerWordCategory(c.word.id, c.word.word, c.category);
      });
      word = adaptiveResult.items[0] || pool[Math.floor(Math.random() * pool.length)];
    } else {
      registerWordCategory(word.id, word.word, 'weak');
    }
    if (!word) return;

    recentQuizWordIdsRef.current.push(word.id || cleanWordString(word.word));
    if (recentQuizWordIdsRef.current.length > 20) {
      recentQuizWordIdsRef.current.shift();
    }

    const cleanW = cleanWordString(word.word);
    const { cleanFullSentence, targetWordClean } = maskTargetWordInSentence(
      word.example || `The team must ${cleanW} for optimal performance.`,
      cleanW
    );

    const currentDictationParams = difficultyEvaluationRef.current.modeParams.dictation;
    const maskHintType = currentDictationParams.maskHintType;
    let customMask = '[ ________ ]';
    if (maskHintType === 'first_letter_and_length') {
      const firstChar = targetWordClean[0]?.toUpperCase() || '';
      const underscores = Array(Math.max(1, targetWordClean.length - 1)).fill('_').join(' ');
      customMask = `[ ${firstChar} ${underscores} ]`;
    } else if (maskHintType === 'word_length') {
      const underscores = Array(targetWordClean.length).fill('_').join(' ');
      customMask = `[ ${underscores} ]`;
    }
    const escaped = targetWordClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordRegex = new RegExp(`\\b${escaped}(?:s|es|ed|d|ing|ly)?\\b`, 'gi');
    let adaptiveMaskedSentence = cleanFullSentence.replace(wordRegex, customMask);
    if (adaptiveMaskedSentence === cleanFullSentence) {
      adaptiveMaskedSentence = `Please listen and complete the sentence: "We need to ${customMask} for optimal results."`;
    }

    setDictationWord({
      ...word,
      word: cleanW,
      meaning: cleanWordString(word.meaning),
      example: cleanFullSentence,
    });
    setDictationCleanAudioSentence(cleanFullSentence);
    setDictationMaskedDisplaySentence(adaptiveMaskedSentence);
    setDictationTargetClean(targetWordClean);
    setDictationInput('');
    setDictationFeedback(null);
    setDictationSlow(false);

    // Tự động phát âm trọn vẹn câu hoàn chỉnh sau 300ms theo tốc độ thích ứng
    setTimeout(() => {
      speakWord(cleanFullSentence, audioVoice, currentDictationParams.speechSpeed);
    }, 300);
  }, [sourceMode, unresolvedMistakes, filteredVocab, masterVocabBank, audioVoice, activePracticeConfig, clearAdaptivePractice, learnerContext, selectedTag, registerWordCategory]);

  const handleCheckDictation = () => {
    if (!dictationTargetClean || !dictationInput.trim()) return;

    const userInput = dictationInput.trim().toLowerCase();
    const target = dictationTargetClean.toLowerCase();

    if (userInput === target) {
      // ĐÚNG!
      setDictationFeedback('correct');
      recordSessionAnswer(true, dictationWord?.id, dictationWord?.word, 'dictation');
      if (dictationWord) {
        const event = recordQuizMistakeResult(dictationWord.id || dictationWord.word, true, {
          source: 'dictation',
          type: 'spelling',
        });
        handleMistakeResolution(event, dictationWord.meaning);
      }
      gainXP(25);
      setTotalXpSession((prev) => prev + 25);
      setStreakCount((prev) => prev + 1);
      triggerCelebration('micro', { particleCount: 40, spread: 50, origin: { y: 0.7 } });

      setTimeout(() => {
        initDictationRound();
      }, 1400);
    } else {
      // SAI!
      setDictationFeedback('wrong');
      recordSessionAnswer(false, dictationWord?.id, dictationWord?.word, 'dictation');
      if (dictationWord) {
        const event = recordQuizMistakeResult(dictationWord.id || dictationWord.word, false, {
          source: 'dictation',
          type: 'spelling',
          userAnswer: userInput,
          expectedAnswer: target,
          context: dictationWord.example || dictationWord.example_en,
        });
        handleMistakeResolution(event, dictationWord.meaning);
      }
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
    let pool: VocabWord[];
    const hasTargetedPractice = Boolean(activePracticeConfig?.itemIds && activePracticeConfig.itemIds.length > 0);

    if (sourceMode === 'mistake_bank') {
      if (unresolvedMistakes.length < 4 && !hasTargetedPractice) return;
      pool = unresolvedMistakes.length >= 4 ? unresolvedMistakes : masterVocabBank;
    } else {
      pool = filteredVocab.length >= 4 ? filteredVocab : masterVocabBank;
    }

    if (pool.length === 0) return;

    let target: VocabWord | undefined;
    if (hasTargetedPractice && activePracticeConfig) {
      for (const rawId of activePracticeConfig.itemIds) {
        const cleanTarget = rawId.trim().toLowerCase();
        // 1. Ưu tiên khớp chính xác theo targetId trước để chống collision
        target = pool.find((w) => w.id?.toLowerCase() === cleanTarget)
          || masterVocabBank.find((w) => w.id?.toLowerCase() === cleanTarget);

        // 2. Fallback sang khớp word text nếu không tìm thấy theo id
        if (!target) {
          target = pool.find((w) => w.word.toLowerCase() === cleanTarget)
            || masterVocabBank.find((w) => w.word.toLowerCase() === cleanTarget);
        }
        if (target) break;
      }
      // Dọn dẹp config tạm thời ngay khi đã consume target để không rò rỉ sang câu sau
      clearAdaptivePractice();
    }

    if (!target) {
      const adaptiveResult = selectAdaptiveQuizItems(pool, learnerContext, {
        count: 1,
        tagFilter: sourceMode === 'all_vocab' ? selectedTag : 'ALL',
        excludeWordIds: recentQuizWordIdsRef.current,
      });
      adaptiveResult.classifiedItems.forEach((c) => {
        registerWordCategory(c.word.id, c.word.word, c.category);
      });
      target = adaptiveResult.items[0] || pool[Math.floor(Math.random() * pool.length)];
    } else {
      registerWordCategory(target.id, target.word, 'weak');
    }
    if (!target) return;

    recentQuizWordIdsRef.current.push(target.id || cleanWordString(target.word));
    if (recentQuizWordIdsRef.current.length > 20) {
      recentQuizWordIdsRef.current.shift();
    }

    const cleanTargetMeaning = cleanMeaningForScramble(target.meaning, target.word);

    // Sử dụng Fallback Distractor Engine với độ khó thích ứng và từ bẫy lỗi cá nhân hóa
    const wrongOptions = getDistractorMeanings(
      target,
      pool,
      masterVocabBank,
      3,
      {
        mistakeBank,
        difficultyTier: difficultyEvaluationRef.current.tier,
        preferredPos: target.partOfSpeech || target.pos,
        learnerCefr,
      }
    );

    const allOptions = [cleanTargetMeaning, ...wrongOptions].sort(() => 0.5 - Math.random());

    setQuizWord({ ...target, meaning: cleanTargetMeaning });
    setQuizOptions(allOptions);
    setSelectedQuizAnswer(null);
    setQuizFeedback(null);
  }, [sourceMode, unresolvedMistakes, filteredVocab, masterVocabBank, activePracticeConfig, clearAdaptivePractice, learnerContext, selectedTag, mistakeBank, learnerCefr, registerWordCategory]);

  const handleSelectQuizOption = (option: string) => {
    if (selectedQuizAnswer || !quizWord) return;
    setSelectedQuizAnswer(option);

    const isCorrect = option === quizWord.meaning;
    recordSessionAnswer(isCorrect, quizWord.id, quizWord.word, 'classic_quiz');
    const event = recordQuizMistakeResult(quizWord.id || quizWord.word, isCorrect, {
      source: 'classic_quiz',
      type: 'meaning',
      userAnswer: option,
      expectedAnswer: quizWord.meaning,
      context: quizWord.example || quizWord.example_en,
    });
    handleMistakeResolution(event, quizWord.meaning);

    if (isCorrect) {
      setQuizFeedback('correct');
      speakWord(quizWord.word, audioVoice, audioSpeed);
      gainXP(15);
      setTotalXpSession((prev) => prev + 15);
      setStreakCount((prev) => prev + 1);
      triggerCelebration('micro', { particleCount: 35, spread: 50, origin: { y: 0.7 } });

      setTimeout(() => {
        initClassicQuizRound();
      }, 1200);
    } else {
      setQuizFeedback('wrong');
      consumeHeart();
      setTimeout(() => {
        initClassicQuizRound();
      }, 1400);
    }
  };

  // Chuyển đổi tab nguồn từ vựng
  const handleSwitchSourceMode = (mode: QuizSourceMode) => {
    if (mode === sourceMode) return;
    setSourceMode(mode);
    setSelectedTile(null);
    setWrongTileIds([]);
    setMatchTiles([]);
    setDictationWord(null);
    setDictationInput('');
    setDictationFeedback(null);
    setQuizWord(null);
    setSelectedQuizAnswer(null);
    setQuizFeedback(null);

    // Kích hoạt ván mới cho chế độ đang chọn
    if (activeMode === 'speed_match') setTimeout(startSpeedMatch, 50);
    if (activeMode === 'dictation') setTimeout(initDictationRound, 50);
    if (activeMode === 'classic_quiz') setTimeout(initClassicQuizRound, 50);
  };

  // Khởi tạo vòng chơi đầu tiên khi component mount
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const timer = setTimeout(() => {
      if (activeMode === 'speed_match') {
        startSpeedMatch();
      } else if (activeMode === 'dictation') {
        initDictationRound();
      } else if (activeMode === 'classic_quiz') {
        initClassicQuizRound();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activeMode, startSpeedMatch, initDictationRound, initClassicQuizRound]);

  // Bộ từ dùng cho WordScramble
  const scramblePool = useMemo(() => {
    if (activePracticeConfig?.itemIds && activePracticeConfig.itemIds.length > 0) {
      const targetIds = new Set(activePracticeConfig.itemIds.map((id) => id.trim().toLowerCase()));
      // 1. Khớp theo ID trước để chống trùng từ khác nghĩa
      const targetedById = masterVocabBank.filter((w) => targetIds.has(w.id?.toLowerCase()));
      // 2. Khớp theo word nếu ID chưa lấy
      const targetedByWord = masterVocabBank.filter(
        (w) => !targetIds.has(w.id?.toLowerCase()) && targetIds.has(w.word.toLowerCase())
      );
      const targeted = [...targetedById, ...targetedByWord];
      if (targeted.length > 0) {
        const others = masterVocabBank.filter(
          (w) => !targetIds.has(w.id?.toLowerCase()) && !targetIds.has(w.word.toLowerCase())
        );
        return [...targeted, ...others];
      }
    }
    const rawPool = sourceMode === 'mistake_bank'
      ? (unresolvedMistakes.length > 0 ? unresolvedMistakes : masterVocabBank)
      : (filteredVocab.length > 0 ? filteredVocab : masterVocabBank);

    const adaptiveSelection = selectAdaptiveQuizItems(rawPool, learnerContext, {
      count: 30,
      tagFilter: sourceMode === 'all_vocab' ? selectedTag : 'ALL',
    });

    adaptiveSelection.classifiedItems.forEach((c) => {
      registerWordCategory(c.word.id, c.word.word, c.category);
    });

    return adaptiveSelection.items.length >= 4 ? adaptiveSelection.items : rawPool;
  }, [activePracticeConfig, sourceMode, unresolvedMistakes, filteredVocab, masterVocabBank, learnerContext, selectedTag, registerWordCategory]);

  // Thống kê phục thù cho Victory Modal
  const sessionList = useMemo(() => Object.values(sessionMistakeResults), [sessionMistakeResults]);
  const resolvedList = useMemo(() => sessionList.filter((item) => item.resolved), [sessionList]);
  const progressingList = useMemo(() => sessionList.filter((item) => !item.resolved && item.consecutiveCorrect === 1), [sessionList]);
  const failedList = useMemo(() => sessionList.filter((item) => !item.resolved && item.lastAnswer === 'wrong'), [sessionList]);

  const quizProgressMetric: SessionProgressMetric = useMemo(() => {
    if (activeMode === 'speed_match') {
      const timeLimit = difficultyEvaluationRef.current.modeParams.speedMatch.timeLimitSeconds || 60;
      return {
        kind: 'timed_countdown',
        timeLeftSeconds: matchTimeLeft,
        totalDurationSeconds: timeLimit,
        isPaused: !isMatchRunning && matchTimeLeft > 0 && matchTimeLeft < timeLimit,
        progressPercent: clampProgressPercent(timeLimit - matchTimeLeft, timeLimit),
      };
    }
    if (totalPlannedItems > 0) {
      return {
        kind: 'discrete_items',
        currentIndex: completedPlannedItemsCount,
        totalItems: totalPlannedItems,
        answeredCount: completedPlannedItemsCount,
        remainingCount: Math.max(0, totalPlannedItems - completedPlannedItemsCount),
        progressPercent: clampProgressPercent(completedPlannedItemsCount, totalPlannedItems),
        counterFormat: 'answered',
      };
    }
    return {
      kind: 'unbounded',
      completedCount: sessionRecentAnswers.length,
      streakCount,
    };
  }, [activeMode, matchTimeLeft, isMatchRunning, totalPlannedItems, completedPlannedItemsCount, sessionRecentAnswers.length, streakCount]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 relative">
      {/* SESSION PROGRESS HEADER (PHASE 7 DURING UX) */}
      <SessionProgressHeader
        title={
          activeMode === 'speed_match'
            ? '⚡ Speed Match: Nối Từ Phản Xạ'
            : activeMode === 'dictation'
            ? '🎧 Dictation: Nghe Chép Điền Từ'
            : activeMode === 'word_scramble'
            ? '🔤 Word Scramble: Ghép Chữ'
            : '🎯 Classic Quiz: Trắc Nghiệm 4 Đáp Án'
        }
        subtitle={sourceMode === 'mistake_bank' ? 'Chế độ: Phục Thù Bẫy Lỗi' : 'Chế độ: Toàn Bộ Kho Từ'}
        badgeLabel={`CẤP ĐỘ ${difficultyEvaluation.tier.toUpperCase()}`}
        metric={quizProgressMetric}
        streakCount={activeMode === 'speed_match' ? matchCombo : streakCount}
        rightSlot={
          <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl font-bold font-mono text-xs">
            +{totalXpSession} XP
          </span>
        }
        onExit={() => {
          if (onNavigate) onNavigate('dashboard');
          else useAppStore.getState().navigateToTab('dashboard');
        }}
      />
      
      {/* ========================================================================= */}
      {/* FLOATING RESOLVED BADGES (KHI CÂU HỎI ĐƯỢC GỠ BẪY LỖI THÀNH CÔNG)         */}
      {/* ========================================================================= */}
      <div className="fixed top-20 right-4 sm:right-8 z-50 flex flex-col gap-2.5 pointer-events-none">
        <AnimatePresence>
          {floatingBadges.map((badge) => (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, y: -25, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="px-4 py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 text-white rounded-2xl shadow-2xl shadow-emerald-500/40 border border-emerald-300/60 flex items-center gap-3 backdrop-blur-md"
            >
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-black text-amber-300 text-xs shadow-inner">
                +{badge.xp}
              </div>
              <div>
                <div className="text-[11px] font-black uppercase tracking-wider text-emerald-100 flex items-center gap-1">
                  <span>🎯 Phục Thù Thành Công!</span>
                </div>
                <div className="text-sm font-extrabold text-white">
                  Đã gỡ lỗi <span className="underline decoration-amber-300 font-mono text-amber-300 font-black">"{badge.word}"</span>!
                </div>
              </div>
              <span className="text-xl animate-bounce ml-1">🎉</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 1. TOP HEADER & SOURCE SWITCHER & ARCADE MODE SWITCHER */}
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
            <div className="flex items-center gap-2 mt-2 px-3 py-1 bg-slate-950/70 border border-slate-800/80 rounded-xl text-xs text-slate-400 max-w-fit">
              <span className="font-semibold text-cyan-400 flex items-center gap-1 shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
                Hôm nay tập trung:
              </span>
              <span className="truncate">
                <span className="text-rose-300 font-medium">Từ yếu (60%)</span> ·{' '}
                <span className="text-amber-300 font-medium">Từ đến hạn (20%)</span> ·{' '}
                <span className="text-blue-300 font-medium">Từ mới (10%)</span> ·{' '}
                <span className="text-emerald-300 font-medium">Duy trì trí nhớ (10%)</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
            {/* Adaptive Difficulty Tier Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl font-bold text-xs border transition-all ${
                difficultyEvaluation.tier === 'easy'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : difficultyEvaluation.tier === 'hard'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : difficultyEvaluation.tier === 'advanced'
                  ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                  : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
              }`}
              title={`Độ khó thích ứng: ${difficultyEvaluation.tier.toUpperCase()} | Độ chính xác gần đây: ${Math.round(difficultyEvaluation.accuracyInWindow * 100)}% (${difficultyEvaluation.windowSizeObserved} câu)`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {difficultyEvaluation.tier === 'easy' && 'Cơ bản (Easy)'}
                {difficultyEvaluation.tier === 'normal' && 'Tiêu chuẩn (Normal)'}
                {difficultyEvaluation.tier === 'hard' && 'Nâng cao (Hard)'}
                {difficultyEvaluation.tier === 'advanced' && 'Chuyên gia (Advanced)'}
              </span>
              <span className="text-[10px] font-mono opacity-80">
                {Math.round(difficultyEvaluation.accuracyInWindow * 100)}%
              </span>
            </div>

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

            {/* Nút Xem Tổng Kết Vòng Đấu */}
            <button
              onClick={() => setShowVictoryModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 text-amber-300 rounded-2xl font-black text-xs transition-all shadow-sm hover:scale-105 active:scale-95"
              title="Xem chiến tích và kết quả tổng kết vòng chơi"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>🏁 Tổng Kết</span>
              {resolvedList.length > 0 && (
                <span className="px-1.5 py-0.2 bg-emerald-500 text-slate-950 rounded-full text-[10px] font-black">
                  +{resolvedList.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SOURCE SWITCHER TOOLBAR: TOÀN BỘ TỪ VỰNG vs PHỤC THÙ BẪY LỖI              */}
        {/* ========================================================================= */}
        <div className="p-1.5 bg-slate-950/80 border border-slate-800/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5">
            {/* Tab: Toàn Bộ Từ Vựng */}
            <button
              onClick={() => handleSwitchSourceMode('all_vocab')}
              className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                sourceMode === 'all_vocab'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-850'
              }`}
            >
              <Globe className="w-4 h-4 shrink-0" />
              <span>Toàn Bộ Từ Vựng</span>
            </button>

            {/* Tab: Phục Thù Bẫy Lỗi */}
            <button
              onClick={() => handleSwitchSourceMode('mistake_bank')}
              className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all relative ${
                sourceMode === 'mistake_bank'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-md shadow-amber-500/20 ring-1 ring-amber-300'
                  : 'text-slate-400 hover:text-amber-400 hover:bg-slate-850'
              }`}
            >
              <Flame className={`w-4 h-4 shrink-0 ${sourceMode === 'mistake_bank' ? 'text-slate-950 fill-slate-950' : 'text-orange-400'}`} />
              <span>Phục Thù Bẫy Lỗi</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-black ${
                sourceMode === 'mistake_bank'
                  ? 'bg-slate-950/30 text-slate-950'
                  : unresolvedMistakes.length > 0
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-slate-800 text-slate-500'
              }`}>
                {unresolvedMistakes.length} từ cần xóa lỗi
              </span>
            </button>
          </div>

          {sourceMode === 'mistake_bank' && (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 font-semibold self-stretch sm:self-auto justify-center sm:justify-start">
              <span>🎯 Trả lời đúng 2 câu liên tiếp để gỡ nhãn bẫy lỗi!</span>
            </div>
          )}
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

        {/* Tag Domain Filter Selector (Chỉ hiện khi ở chế độ Toàn bộ từ vựng) */}
        {sourceMode === 'all_vocab' ? (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 shrink-0">
              Chủ đề:
            </span>
            {[
              { id: 'ALL', label: `Tất cả (${vocabularyList.length.toLocaleString()} từ)` },
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
        ) : (
          <div className="flex items-center justify-between text-xs text-amber-300/80 px-3 py-1.5 bg-amber-500/5 rounded-xl border border-amber-500/15">
            <span>💡 Đang tải câu hỏi từ <strong>Sổ Tay Bẫy Lỗi</strong> để phục thù và gỡ lỗi nhanh nhất!</span>
            <span className="font-mono font-bold text-amber-400">{unresolvedMistakes.length} từ tồn đọng</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* EMPTY STATE (< 4 TỪ BẪY LỖI KHI Ở CHẾ ĐỘ PHỤC THÙ BẪY LỖI)                  */}
      {/* ========================================================================= */}
      {sourceMode === 'mistake_bank' && unresolvedMistakes.length < 4 ? (
        <div className="bg-slate-900/95 border-2 border-dashed border-amber-500/30 rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-2xl relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-4 max-w-xl mx-auto">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/10">
              <PartyPopper className="w-10 h-10 text-amber-400 animate-bounce" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                🎉 Tuyệt vời! Sổ Bẫy Lỗi Sạch Sẽ
              </h3>
              <div className="inline-block px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs font-mono text-amber-300 font-bold">
                Số từ chưa giải quyết: {unresolvedMistakes.length} / 4 từ tối thiểu
              </div>
            </div>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-medium">
              🎉 Tuyệt vời! Bạn không có bẫy lỗi nào tồn đọng hoặc số từ chưa đủ để tạo ván đấu (&lt; 4 từ). Hãy học thêm từ mới trong Flashcard hoặc tiếp tục luyện tập ở chế độ Toàn Bộ Từ Vựng!
            </p>

            {/* Quick Action Navigation Buttons */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => handleSwitchSourceMode('all_vocab')}
                className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-2xl shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Globe className="w-4 h-4" />
                <span>Chuyển sang Toàn bộ từ vựng</span>
              </button>

              <button
                onClick={() => onNavigate?.('mistakes')}
                className="w-full sm:w-auto px-6 py-3.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white font-bold rounded-2xl border border-slate-700 hover:border-slate-600 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Flame className="w-4 h-4 text-orange-400" />
                <span>Mở Sổ Tay Bẫy Lỗi</span>
              </button>

              {onNavigate && (
                <button
                  onClick={() => onNavigate('flashcards')}
                  className="w-full sm:w-auto px-5 py-3.5 bg-slate-850 hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 font-bold rounded-2xl border border-cyan-500/20 hover:border-cyan-500/40 transition-all text-xs flex items-center justify-center gap-1.5"
                >
                  <span>📚 Học Flashcards</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* GAME ARENA CONTAINER (CÓ KHUNG VIỀN NỔI BẬT KHI Ở CHẾ ĐỘ BẪY LỖI)        */
        /* ========================================================================= */
        <div className={`space-y-4 rounded-3xl transition-all duration-300 ${
          sourceMode === 'mistake_bank'
            ? 'ring-2 ring-amber-500/50 shadow-amber-500/10'
            : ''
        }`}>
          {/* Banner Huy Hiệu Chế Độ Phục Thù */}
          {sourceMode === 'mistake_bank' && (
            <div className="p-3.5 sm:p-4 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-2 border-amber-500/40 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200 shadow-lg shadow-amber-500/10 animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <span className="text-xl">🎯</span>
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-black text-amber-300">
                    🎯 Chế độ Phục Thù - Trả lời đúng 2 câu liên tiếp để gỡ nhãn bẫy lỗi!
                  </div>
                  <p className="text-[11px] sm:text-xs text-amber-400/80 mt-0.5">
                    Mỗi từ giải quyết thành công sẽ được tự động gỡ khỏi bẫy lỗi và thưởng ngay <strong>+25 XP</strong>.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-mono font-black whitespace-nowrap">
                  🔥 {unresolvedMistakes.length} từ cần gỡ lỗi
                </span>
              </div>
            </div>
          )}

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
                    className="p-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl transition-all border border-slate-700"
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
                  <div className="pt-2 flex items-center justify-center gap-3">
                    <button
                      onClick={startSpeedMatch}
                      className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-2xl shadow-xl hover:scale-105 transition-all text-sm"
                    >
                      Chơi Ván Mới Ngay
                    </button>
                    <button
                      onClick={() => setShowVictoryModal(true)}
                      className="px-6 py-3 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-2xl border border-slate-700 transition-all text-sm flex items-center gap-2"
                    >
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span>Xem Chiến Tích</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. GAME AREA 2: WORD SCRAMBLE (GHÉP CHỮ RÈN CHÍNH TẢ)                     */}
          {/* ========================================================================= */}
          {activeMode === 'word_scramble' && (
            <WordScramble
              vocabPool={scramblePool}
              onGainXP={(xp) => {
                gainXP(xp);
                setTotalXpSession((prev) => prev + xp);
              }}
              onIncrementStreak={() => setStreakCount((prev) => prev + 1)}
              audioVoice={audioVoice}
              audioSpeed={audioSpeed}
              onMistakeResult={(event) => {
                handleMistakeResolution(event);
                recordSessionAnswer(event.consecutiveCorrect > 0, event.wordId, event.word, 'word_scramble');
              }}
              difficultyTier={difficultyEvaluation.tier}
              distractorLettersCount={difficultyEvaluation.modeParams.wordScramble.distractorLettersCount}
              revealFirstLetter={difficultyEvaluation.modeParams.wordScramble.revealFirstLetter}
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
                    onClick={() => speakWord(dictationCleanAudioSentence, audioVoice, difficultyEvaluation.modeParams.dictation.speechSpeed)}
                    className="px-5 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black rounded-2xl shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 text-sm"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Phát Lại Câu (Tốc độ {difficultyEvaluation.modeParams.dictation.speechSpeed}x)</span>
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
                  className="p-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl transition-all border border-slate-700"
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
                      className={`p-4 rounded-2xl border font-bold text-sm sm:text-base text-left transition-all duration-150 flex items-center justify-between shadow-md active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${btnStyle}`}
                    >
                      <span>{opt}</span>
                      {selectedQuizAnswer && isCorrect && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Feedback Message */}
              {quizFeedback === 'correct' && (
                <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-bold animate-fadeIn motion-reduce:animate-none pt-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Chính xác 100%! +15 XP</span>
                </div>
              )}

              {quizFeedback === 'wrong' && (
                <div className="flex items-center justify-center gap-2 text-red-400 text-sm font-bold animate-shake motion-reduce:animate-none pt-2">
                  <XCircle className="w-4 h-4" />
                  <span>Chưa chính xác! Chú ý ghi nhớ nghĩa của từ này nhé.</span>
                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* VICTORY MODAL: TỔNG KẾT VÒNG ĐẤU & CHIẾN TÍCH PHỤC THÙ BẪY LỖI              */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showVictoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-750 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar relative"
            >
              {/* Nút đóng modal */}
              <button
                onClick={() => setShowVictoryModal(false)}
                className="absolute top-5 right-5 p-2 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white rounded-xl transition-all"
                title="Đóng bảng tổng kết"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header Tổng Kết */}
              <div className="text-center space-y-2 pt-2">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/10">
                  <Trophy className="w-9 h-9 text-amber-400 animate-bounce" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  🏆 Tổng Kết Vòng Đấu Arcade
                </h3>
                <p className="text-xs sm:text-sm text-slate-400">
                  {sourceMode === 'mistake_bank'
                    ? 'Báo cáo chi tiết nỗ lực phục thù các từ vựng bẫy lỗi trong phiên này.'
                    : 'Thử thách phản xạ từ vựng và ngữ âm hoàn tất xuất sắc!'}
                </p>
              </div>

              {/* Thẻ Chỉ Số Phiên Chơi */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-850/80 border border-slate-750 rounded-2xl text-center">
                  <span className="text-xs text-slate-400 block font-bold">Kinh Nghiệm (XP)</span>
                  <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
                    +{totalXpSession} XP
                  </span>
                </div>
                <div className="p-3.5 bg-slate-850/80 border border-slate-750 rounded-2xl text-center">
                  <span className="text-xs text-slate-400 block font-bold">Chuỗi Đúng (Streak)</span>
                  <span className="text-xl sm:text-2xl font-black text-orange-400 font-mono">
                    {streakCount} 🔥
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1 p-3.5 bg-slate-850/80 border border-slate-750 rounded-2xl text-center">
                  <span className="text-xs text-slate-400 block font-bold">Chế Độ Nguồn</span>
                  <span className="text-xs sm:text-sm font-extrabold text-cyan-300 block mt-1">
                    {sourceMode === 'mistake_bank' ? '🔥 Bẫy Lỗi' : '🌐 Toàn Bộ Kho'}
                  </span>
                </div>
              </div>

              {/* Thống kê Phân bổ Thích ứng (Session Mix) & Chuyển dịch Độ khó */}
              <div className="p-4 bg-slate-850/90 border border-slate-750 rounded-2xl space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span className="flex items-center gap-1.5 text-cyan-400">
                    <Sparkles className="w-4 h-4" />
                    <span>Phân bổ thích ứng (Session Mix)</span>
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                    <span>Độ khó:</span>
                    <span className="capitalize px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {initialDifficultyTierRef.current}
                    </span>
                    <span>→</span>
                    <span className="capitalize px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                      {difficultyEvaluation.tier}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <span className="text-[11px] text-rose-300/80 block">Từ yếu (Weak)</span>
                    <span className="text-base font-black text-rose-300 font-mono">{sessionMixCounts.weak}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <span className="text-[11px] text-amber-300/80 block">Đến hạn (Due)</span>
                    <span className="text-base font-black text-amber-300 font-mono">{sessionMixCounts.due}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <span className="text-[11px] text-blue-300/80 block">Từ mới (New)</span>
                    <span className="text-base font-black text-blue-300 font-mono">{sessionMixCounts.new}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[11px] text-emerald-300/80 block">Đã vững (Mastered)</span>
                    <span className="text-base font-black text-emerald-300 font-mono">{sessionMixCounts.mastered}</span>
                  </div>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* KHU VỰC CHIẾN TÍCH PHỤC THÙ BẪY LỖI                                       */}
              {/* ========================================================================= */}
              {(sourceMode === 'mistake_bank' || sessionList.length > 0) && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-sm font-black text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Chiến Tích Phục Thù Bẫy Lỗi</span>
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      Đã tương tác {sessionList.length} từ
                    </span>
                  </div>

                  {/* 🟢 1. ĐÃ GỠ LỖI THÀNH CÔNG (Đúng 2 lần liên tiếp) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Đã gỡ lỗi thành công (Resolved):</span>
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full font-mono text-[11px]">
                        {resolvedList.length} từ
                      </span>
                    </div>

                    {resolvedList.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {resolvedList.map((item) => (
                          <div
                            key={item.wordId}
                            className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-2 shadow-sm"
                          >
                            <div className="min-w-0">
                              <span className="font-black text-sm text-white block truncate">
                                {item.word}
                              </span>
                              {item.meaning && (
                                <span className="text-xs text-emerald-300/80 block truncate">
                                  {item.meaning}
                                </span>
                              )}
                            </div>
                            <span className="shrink-0 px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl text-[11px] font-mono font-bold">
                              +25 XP ✓
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic pl-5">
                        Chưa có từ nào đạt mốc 2 câu đúng liên tiếp trong lượt này.
                      </p>
                    )}
                  </div>

                  {/* 🟡 2. ĐANG TIẾN BỘ (+1 LẦN ĐÚNG) */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Đang tiến bộ (+1 đúng - Cần thêm 1 câu đúng để gỡ):</span>
                      </span>
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full font-mono text-[11px]">
                        {progressingList.length} từ
                      </span>
                    </div>

                    {progressingList.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {progressingList.map((item) => (
                          <div
                            key={item.wordId}
                            className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-2 shadow-sm"
                          >
                            <div className="min-w-0">
                              <span className="font-black text-sm text-white block truncate">
                                {item.word}
                              </span>
                              {item.meaning && (
                                <span className="text-xs text-amber-300/80 block truncate">
                                  {item.meaning}
                                </span>
                              )}
                            </div>
                            <span className="shrink-0 px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-[11px] font-mono font-bold">
                              1/2 Đúng ⏳
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic pl-5">
                        Không có từ nào đang ở mốc 1/2.
                      </p>
                    )}
                  </div>

                  {/* 🔴 3. CHƯA VƯỢT QUA (TRẢ LỜI SAI - RESET CHUỖI) */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs font-bold text-rose-400">
                      <span className="flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Chưa vượt qua (Trả lời sai - Bị reset chuỗi):</span>
                      </span>
                      <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded-full font-mono text-[11px]">
                        {failedList.length} từ
                      </span>
                    </div>

                    {failedList.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {failedList.map((item) => (
                          <div
                            key={item.wordId}
                            className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between gap-2 shadow-sm"
                          >
                            <div className="min-w-0">
                              <span className="font-black text-sm text-white block truncate">
                                {item.word}
                              </span>
                              {item.meaning && (
                                <span className="text-xs text-rose-300/80 block truncate">
                                  {item.meaning}
                                </span>
                              )}
                            </div>
                            <span className="shrink-0 px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-xl text-[11px] font-mono font-bold">
                              0/2 Reset ✕
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic pl-5">
                        Không có từ nào trả lời sai trong lượt này!
                      </p>
                    )}
                  </div>

                </div>
              )}

              {/* Các Nút Hành Động Ở Cuối Victory Modal với NextActionPanel (Phase 7) */}
              <div className="pt-4 border-t border-slate-800">
                <NextActionPanel
                  actions={[
                    {
                      id: 'next-action-today-hub',
                      label: 'Về Kế Hoạch Hôm Nay',
                      isPrimary: true,
                      onClick: () => {
                        setShowVictoryModal(false);
                        if (onNavigate) {
                          onNavigate('dashboard');
                        } else {
                          useAppStore.getState().navigateToTab('dashboard');
                        }
                      },
                    },
                    {
                      id: 'retry-round',
                      label:
                        sourceMode === 'mistake_bank' && unresolvedMistakes.length >= 4
                          ? `Phục thù tiếp (${unresolvedMistakes.length} từ)`
                          : 'Chơi Ván Mới',
                      variant: 'secondary',
                      onClick: () => {
                        setShowVictoryModal(false);
                        setSessionMistakeResults({});
                        setSessionMixCounts({ weak: 0, due: 0, new: 0, mastered: 0 });
                        hasRecordedInitialTierRef.current = false;
                        if (activeMode === 'speed_match') startSpeedMatch();
                        if (activeMode === 'dictation') initDictationRound();
                        if (activeMode === 'classic_quiz') initClassicQuizRound();
                      },
                    },
                    {
                      id: 'open-mistakes',
                      label: '📖 Sổ Tay Bẫy Lỗi',
                      variant: 'outline',
                      onClick: () => {
                        setShowVictoryModal(false);
                        if (onNavigate) {
                          onNavigate('mistakes');
                        } else {
                          useAppStore.getState().navigateToTab('mistakes');
                        }
                      },
                    },
                  ]}
                />
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
