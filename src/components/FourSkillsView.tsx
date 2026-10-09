import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Headphones, 
  BookOpen, 
  Mic, 
  PenTool, 
  Play, 
  Pause, 
  Volume2, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Award, 
  PlusCircle, 
  Check, 
  Flame, 
  Eye, 
  EyeOff, 
  FileText, 
  MessageSquare, 
  HelpCircle, 
  Layers, 
  RotateCcw,
  Trophy,
  X,
  AlertCircle,
  Loader2,
  Edit3,
  Plus
} from 'lucide-react';
import { triggerCelebration } from '../utils/confettiPolicy';
import { useAppStore } from '../store/useAppStore';
import { 
  speakWord,
  isSpeechRecognitionSupported
} from '../services/speechService';
import { recordSkillEvidence, getFourSkillsCompetency, VALID_CEFR_LEVELS } from '../services/skillsCompetencyService';
import { lookupContextWord } from '../services/wordLookupService';
import { 
  getPronunciationPracticeQueue,
  resolveListeningQuestionTarget
} from '../services/adaptiveMistakeService';
import {
  captureListeningMistake,
  captureSpeakingMistake,
} from '../services/fourSkillsLearningBridge';
import { VOCAB_10000_BANK } from '../data/defaultVocab';
import { 
  LISTENING_LESSONS, 
  READING_LESSONS, 
  SPEAKING_PROMPTS, 
  WRITING_PROMPTS,
  ListeningLesson,
  ReadingLesson,
  SpeakingPrompt,
  WritingPrompt,
  resolveCanonicalWritingCefrLevel
} from '../data/fourSkillsData';
import { ActiveTab, EssayGradingResult, CEFRLevel } from '../types';
import { SmartShadowingView } from './SmartShadowingView';
import { InteractiveReadingPassage } from './InteractiveReadingPassage';
import { WritingEvaluationReport } from './WritingEvaluationReport';
import { FourSkillsAdaptiveSummary } from './FourSkillsAdaptiveSummary';
import { ListeningSeekBar } from './ListeningSeekBar';
import { ListeningResultSummary } from './ListeningResultSummary';
import { gradeEssay } from '../services/essayGradingService';
import { computeTextHash } from '../services/wordUsageTelemetry';
import { 
  HighlightState, 
  HighlightMode, 
  ListeningSyncController, 
  buildLessonSyncMap, 
  tokenizeSentence,
  buildTranscriptBlocks
} from '../services/listeningSyncService';
import { 
  ListeningAttemptState,
  calculateListeningResult,
} from '../services/listeningResultService';
import { isActivityStale } from '../services/learningContinuityService';
import {
  SessionIntro,
  SessionProgressHeader,
  SessionMicroFeedback,
  SessionCompleteSummary,
  NextActionPanel,
} from './session';
import { formatSessionDurationBucket } from '../services/sessionExperienceAdapter';
import type { SessionSourceContext } from '../types/sessionExperience';
import { resolveNextBestActions } from '../services/nextActionResolver';
import { deriveTodayLearningPlanFromStore } from '../services/todayLearningPlanService';
import { isCollocationCandidate } from '../services/fourSkillsLearningBridge';
import { LearningJourneyProgressionMap } from './fourSkills/LearningJourneyProgressionMap';

interface FourSkillsViewProps {
  onNavigate?: (tab: ActiveTab) => void;
  onOpenAddWord?: (word?: string) => void;
}

type SkillType = 'listening' | 'reading' | 'speaking' | 'writing';

const EMPTY_STRING_ARRAY: string[] = [];

export const FourSkillsView: React.FC<FourSkillsViewProps> = ({ onNavigate }) => {
  const { 
    gainXP, 
    saveToSRS,
    profile, 
    activeFourSkill, 
    setActiveFourSkill,
    geminiApiKey,
    srsProgressMap,
    recordMistake,
    recordMistakeCorrect,
    vocabularyList,
    mistakeBank,
    startAdaptivePractice,
    activePracticeConfig,
    clearAdaptivePractice,
    recordReadingEncounters,
    recordWritingUsages,
    completedListeningLessonIds,
    markListeningLessonCompleted,
    fourSkillsCompletionProgress,
    markFourSkillsLessonCompleted,
    resumeActivities,
    upsertResumeActivity,
    completeResumeActivity,
    removeResumeActivity,
  } = useAppStore();
  const [activeSkill, setActiveSkill] = useState<SkillType>(activeFourSkill || 'listening');
  const fourSkillsCompetency = getFourSkillsCompetency(srsProgressMap);

  // Sync with global store activeFourSkill when changed from Navbar
  useEffect(() => {
    if (activeFourSkill && activeFourSkill !== activeSkill) {
      setActiveSkill(activeFourSkill);
    }
  }, [activeFourSkill, activeSkill]);



  const handleSwitchSkill = (skill: SkillType) => {
    setActiveSkill(skill);
    setActiveFourSkill(skill);
  };

  // Popup Click-to-Translate State
  const [lookupWord, setLookupWord] = useState<{
    word: string;
    ipa: string;
    partOfSpeech: string;
    meaning: string;
    example?: string;
  } | null>(null);
  const [addedSuccessWord, setAddedSuccessWord] = useState<string | null>(null);

  // Completed Lessons Tracking (Zustand Store Persistence)
  const completedListenIds = completedListeningLessonIds ?? EMPTY_STRING_ARRAY;
  const completedReadIds = fourSkillsCompletionProgress?.reading ?? EMPTY_STRING_ARRAY;
  const completedSpeakingIds = fourSkillsCompletionProgress?.speaking ?? EMPTY_STRING_ARRAY;
  const completedWritingIds = fourSkillsCompletionProgress?.writing ?? EMPTY_STRING_ARRAY;

  // =========================================================================
  // 1. LISTENING LAB STATE & CATALOG
  // =========================================================================
  const [selectedListenLesson, setSelectedListenLesson] = useState<ListeningLesson | null>(null);
  const [listenCategoryFilter, setListenCategoryFilter] = useState<string>('ALL');
  const [listenLevelFilter, setListenLevelFilter] = useState<'ALL' | CEFRLevel>('ALL');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isAudioStarting, setIsAudioStarting] = useState(false);
  const [audioSpeed, setAudioSpeed] = useState<number>(1.0);
  const [highlightState, setHighlightState] = useState<HighlightState>({
    highlightMode: 'sentence',
    activeSentenceIndex: null,
    activeWordIndex: null,
  });
  const activeSentenceIndex = highlightState.activeSentenceIndex;
  const activeWordIndex = highlightState.activeWordIndex;
  const highlightMode = highlightState.highlightMode;

  const syncControllerRef = useRef<ListeningSyncController | null>(null);
  const activeSessionRef = useRef<number>(0);

  const syncMap = useMemo(() => {
    return selectedListenLesson ? buildLessonSyncMap(selectedListenLesson, audioSpeed) : null;
  }, [selectedListenLesson, audioSpeed]);

  const transcriptBlocks = useMemo(() => {
    return selectedListenLesson ? buildTranscriptBlocks(selectedListenLesson) : [];
  }, [selectedListenLesson]);

  const handleToggleHighlightMode = (mode: HighlightMode) => {
    syncControllerRef.current?.setHighlightMode(mode);
  };

  if (!syncControllerRef.current) {
    syncControllerRef.current = new ListeningSyncController({
      onHighlightChange: (state) => {
        setHighlightState(state);
      },
      onPlaybackEnd: () => {
        isAudioBusyRef.current = false;
        setIsAudioStarting(false);
        setIsPlayingAudio(false);
      },
    });
  }

  const [showListenVi, setShowListenVi] = useState<boolean>(true);
  const [listenDisplayMode, setListenDisplayMode] = useState<'paragraph' | 'dialogue'>('paragraph');
  const [listeningQuizAnswers, setListeningQuizAnswers] = useState<Record<string, number>>({});
  const [listeningQuizSubmitted, setListeningQuizSubmitted] = useState<boolean>(false);
  const [attemptState, setAttemptState] = useState<ListeningAttemptState>('in-progress');
  const finalizedAttemptsRef = useRef<Set<string>>(new Set());
  const currentAttemptIdRef = useRef<string>('initial_attempt');
  const [quizSubmitWarning, setQuizSubmitWarning] = useState<string | null>(null);
  const [savedListeningQuestionIds, setSavedListeningQuestionIds] = useState<Set<string>>(new Set());
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isAudioBusyRef = useRef<boolean>(false);

  // Today Hub & Session Experience Metadata
  const [todayPlanMeta, setTodayPlanMeta] = useState<{
    planItemId?: string;
    title?: string;
    objective?: string;
    estimatedMinutes?: number;
  } | null>(null);
  const [sourceContext, setSourceContext] = useState<SessionSourceContext | undefined>(undefined);

  // Listening Ephemeral Session State
  const [listeningSessionStreak, setListeningSessionStreak] = useState<number>(0);
  const [listeningMicroFeedback, setListeningMicroFeedback] = useState<{
    text: string;
    sentiment?: 'success' | 'warning' | 'info' | 'neutral';
  } | null>(null);
  const listeningFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const listeningResult = useMemo(() => {
    return calculateListeningResult(selectedListenLesson, listeningQuizAnswers);
  }, [selectedListenLesson, listeningQuizAnswers]);

  const handleRetryListeningQuiz = () => {
    // 1. Reset UI attempt state
    setListeningQuizSubmitted(false);
    setListeningQuizAnswers({});
    setQuizSubmitWarning(null);
    setAttemptState('in-progress');
    setListeningSessionStreak(0);
    setListeningMicroFeedback(null);

    // 2. Lifecycle attempt ID for the fresh session
    currentAttemptIdRef.current = `${selectedListenLesson?.id || 'lesson'}_${Date.now()}`;

    // 3. Reset playback position and highlights
    if (isPlayingAudio || isAudioStarting) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      setIsAudioStarting(false);
    }
    isAudioBusyRef.current = false;
    syncControllerRef.current?.seek(0);
    setHighlightState((prev) => ({
      ...prev,
      activeSentenceIndex: null,
      activeWordIndex: null,
    }));
  };

  // Consume activePracticeConfig when routed to listening module
  useEffect(() => {
    if (activePracticeConfig?.module === 'listening') {
      setActiveSkill('listening');
      setActiveFourSkill('listening');

      const rawIds = activePracticeConfig.itemIds || [];
      if (rawIds.length > 0) {
        let matchedLesson: ListeningLesson | null = null;

        for (const rawId of rawIds) {
          const cleanId = rawId.trim().toLowerCase();
          if (!cleanId) continue;

          // 1. Direct match by lesson id
          matchedLesson = LISTENING_LESSONS.find((l) => l.id.toLowerCase() === cleanId) || null;
          if (matchedLesson) break;

          // 2. Direct match by question id
          matchedLesson = LISTENING_LESSONS.find((l) =>
            l.questions.some((q) => q.id.toLowerCase() === cleanId)
          ) || null;
          if (matchedLesson) break;

          // 3. Match by question target resolution (vocab targetId or targetWord)
          matchedLesson = LISTENING_LESSONS.find((l) =>
            l.questions.some((q) => {
              const res = resolveListeningQuestionTarget(q, l.title, vocabularyList);
              return (
                res.targetId.toLowerCase() === cleanId ||
                (res.isVocabTarget && res.targetWord.toLowerCase() === cleanId)
              );
            })
          ) || null;
          if (matchedLesson) break;

          // 4. Fallback: match by vocabulary word appearance in audio text or title
          matchedLesson = LISTENING_LESSONS.find((l) => {
            const lowerAudio = l.audioText.toLowerCase();
            const lowerTitle = l.title.toLowerCase();
            return lowerAudio.includes(cleanId) || lowerTitle.includes(cleanId);
          }) || null;
          if (matchedLesson) break;

          // 5. Match by CEFR level if item is e.g. 'a1', 'b2', etc.
          const upperLevel = cleanId.toUpperCase();
          if (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(upperLevel)) {
            const candidates = LISTENING_LESSONS.filter((l) => l.level === upperLevel);
            if (candidates.length > 0) {
              const uncompleted = candidates.filter((l) => !completedListenIds.includes(l.id));
              matchedLesson = uncompleted.length > 0 ? uncompleted[0] : candidates[0];
              break;
            }
          }
        }

        if (matchedLesson) {
          setSelectedListenLesson(matchedLesson);
          setListeningQuizSubmitted(false);
          setAttemptState('in-progress');
          setListeningSessionStreak(0);
          currentAttemptIdRef.current = `${matchedLesson.id}_${Date.now()}`;
          setListeningQuizAnswers({});
          setQuizSubmitWarning(null);
          if (activePracticeConfig.planTitle || activePracticeConfig.planObjective || activePracticeConfig.estimatedMinutes) {
            setTodayPlanMeta({
              planItemId: activePracticeConfig.planItemId,
              title: activePracticeConfig.planTitle,
              objective: activePracticeConfig.planObjective,
              estimatedMinutes: activePracticeConfig.estimatedMinutes,
            });
          }
          if (activePracticeConfig.planItemId) {
            setSourceContext({
              todayPlanTaskId: activePracticeConfig.planItemId,
              sourceModule: 'listening',
              targetLessonId: matchedLesson.id,
              initiatedAt: Date.now(),
            });
          }
        } else {
          // Stale / invalid item: safe fallback to listening catalog
          setSelectedListenLesson(null);
          setAttemptState('in-progress');
        }
      } else {
        // No item IDs provided: safe fallback to catalog
        setSelectedListenLesson(null);
        setAttemptState('in-progress');
      }

      // Always clear the ephemeral config so normal navigation is preserved
      clearAdaptivePractice();
    }
  }, [activePracticeConfig, vocabularyList, completedListenIds, setActiveFourSkill, clearAdaptivePractice]);

  // =========================================================================
  // 2. READING COMPREHENSION STATE & CATALOG
  // =========================================================================
  const [selectedReadLesson, setSelectedReadLesson] = useState<ReadingLesson | null>(null);
  // Attempt-scoped ID: generated when user selects/opens a lesson (not based on lessonId alone).
  // Each new selection generates a fresh ID, so a legitimate second attempt of the same lesson
  // increments reading encounters again. Rapid double-submits within one attempt are blocked by
  // the 5-minute in-memory cooldown in wordUsageTelemetry.
  const [readingAttemptId, setReadingAttemptId] = useState<string>('');
  const [readCategoryFilter, setReadCategoryFilter] = useState<string>('ALL');
  const [readLevelFilter, setReadLevelFilter] = useState<'ALL' | CEFRLevel>('ALL');
  const [readingQuizAnswers, setReadingQuizAnswers] = useState<Record<string, number>>({});
  const [readingQuizSubmitted, setReadingQuizSubmitted] = useState<boolean>(false);

  // Reading Ephemeral Session State
  const [readingSessionStreak, setReadingSessionStreak] = useState<number>(0);
  const [readingMicroFeedback, setReadingMicroFeedback] = useState<{
    text: string;
    sentiment?: 'success' | 'warning' | 'info' | 'neutral';
  } | null>(null);
  const readingFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // =========================================================================
  // 3. MULTI-TURN SPEAKING STUDIO STATE & CATALOG
  // =========================================================================
  const [selectedSpeakingPrompt, setSelectedSpeakingPrompt] = useState<SpeakingPrompt | null>(null);
  const [speakingCategoryFilter, setSpeakingCategoryFilter] = useState<string>('ALL');
  const [speakingLevelFilter, setSpeakingLevelFilter] = useState<string>('ALL');
  const [currentSpeakingTurnIndex, setCurrentSpeakingTurnIndex] = useState<number>(0);
  const [speakingTurnScores, setSpeakingTurnScores] = useState<Record<number, { accuracy: number; transcript: string; feedback: string }>>({});
  const [isSpeakingFinished, setIsSpeakingFinished] = useState<boolean>(false);
  const [isRecordingSpeaking, setIsRecordingSpeaking] = useState<boolean>(false);
  const [speakingTranscript, setSpeakingTranscript] = useState<string>('');
  const [speakingScore, setSpeakingScore] = useState<number | null>(null);
  const [speakingFeedback, setSpeakingFeedback] = useState<string | null>(null);
  const [speakingPermissionDenied, setSpeakingPermissionDenied] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const lastEvaluatedSpeakingRef = useRef<string>('');
  const isSpeechSupported = isSpeechRecognitionSupported();
  const [speakingSubMode, setSpeakingSubMode] = useState<'shadowing' | 'roleplay'>('shadowing');

  const [speakingSessionStreak, setSpeakingSessionStreak] = useState<number>(0);
  const [speakingMicroFeedback, setSpeakingMicroFeedback] = useState<{
    text: string;
    sentiment?: 'success' | 'warning' | 'info' | 'neutral';
  } | null>(null);
  const speakingFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const availableSpeakingCategories = useMemo(() => {
    const cats = new Set(SPEAKING_PROMPTS.map((p) => p.category));
    return ['ALL', ...Array.from(cats)];
  }, []);

  // Cleanup speech recognition on unmount to prevent leaks and rogue background listeners
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
      if (readingFeedbackTimerRef.current) clearTimeout(readingFeedbackTimerRef.current);
      if (listeningFeedbackTimerRef.current) clearTimeout(listeningFeedbackTimerRef.current);
      if (speakingFeedbackTimerRef.current) clearTimeout(speakingFeedbackTimerRef.current);
      if (writingFeedbackTimerRef.current) clearTimeout(writingFeedbackTimerRef.current);
    };
  }, []);

  // Derived Pronunciation Practice Queue directly from Mistake Bank (Zero separate storage)
  const pronunciationQueue = useMemo(() => {
    return getPronunciationPracticeQueue(mistakeBank, { vocabularyList });
  }, [mistakeBank, vocabularyList]);

  // =========================================================================
  // 4. WRITING STUDIO STATE & CATALOG (AI ESSAY GRADING ENGINE)
  // =========================================================================
  const [selectedWritingPrompt, setSelectedWritingPrompt] = useState<WritingPrompt | null>(null);
  const [isCustomTopicMode, setIsCustomTopicMode] = useState<boolean>(false);
  const [writingTopic, setWritingTopic] = useState<string>('');
  const [writingCategoryFilter, setWritingCategoryFilter] = useState<string>('ALL');
  const [writingLevelFilter, setWritingLevelFilter] = useState<string>('ALL');
  const [writingContent, setWritingContent] = useState<string>('');
  // Attempt-scoped writing activity ID: combines promptId + per-attempt timestamp + content hash.
  // Timestamp component ensures a legitimate new submission (even of identical text) gets a fresh
  // ID. Content hash still prevents rapid double-clicks within the same grading call from counting
  // twice (the 5-minute cooldown in wordUsageTelemetry catches any gap the hash misses).
  const [writingAttemptId, setWritingAttemptId] = useState<string>('');
  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [gradingStatus, setGradingStatus] = useState<string>('Đang gửi bài viết...');
  const [gradingResult, setGradingResult] = useState<EssayGradingResult | null>(null);
  const [showModelAnswer, setShowModelAnswer] = useState<boolean>(false);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [writingMicroFeedback, setWritingMicroFeedback] = useState<{
    text: string;
    sentiment?: 'success' | 'warning' | 'info' | 'neutral';
  } | null>(null);
  const writingFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const availableWritingCategories = useMemo(() => {
    const cats = new Set(WRITING_PROMPTS.map((p) => p.category));
    return ['ALL', ...Array.from(cats)];
  }, []);

  // Consume activePracticeConfig when routed to reading, speaking, or writing module
  useEffect(() => {
    if (!activePracticeConfig) return;

    if (activePracticeConfig.module === 'reading') {
      setActiveSkill('reading');
      setActiveFourSkill('reading');
      const rawIds = activePracticeConfig.itemIds || [];
      if (rawIds.length > 0) {
        const targetId = rawIds[0].trim().toLowerCase();
        const matched = READING_LESSONS.find((l) => l.id.toLowerCase() === targetId) ||
          READING_LESSONS.find((l) => l.title.toLowerCase().includes(targetId)) || null;
        if (matched) {
          setSelectedReadLesson(matched);
          setReadingAttemptId(`read_${matched.id}_${Date.now()}`);
          setReadingQuizAnswers({});
          setReadingQuizSubmitted(false);
          setReadingSessionStreak(0);
          if (activePracticeConfig.planTitle || activePracticeConfig.planObjective || activePracticeConfig.estimatedMinutes) {
            setTodayPlanMeta({
              planItemId: activePracticeConfig.planItemId,
              title: activePracticeConfig.planTitle,
              objective: activePracticeConfig.planObjective,
              estimatedMinutes: activePracticeConfig.estimatedMinutes,
            });
          }
          if (activePracticeConfig.planItemId) {
            setSourceContext({
              todayPlanTaskId: activePracticeConfig.planItemId,
              sourceModule: 'reading',
              targetLessonId: matched.id,
              initiatedAt: Date.now(),
            });
          }
        }
      }
      clearAdaptivePractice();
    } else if (activePracticeConfig.module === 'speaking') {
      setActiveSkill('speaking');
      setActiveFourSkill('speaking');
      const rawIds = activePracticeConfig.itemIds || [];
      if (rawIds.length > 0) {
        const targetId = rawIds[0].trim().toLowerCase();
        const matched = SPEAKING_PROMPTS.find((p) => p.id.toLowerCase() === targetId) ||
          SPEAKING_PROMPTS.find((p) => p.title.toLowerCase().includes(targetId)) || null;
        if (matched) {
          setSelectedSpeakingPrompt(matched);
          setSpeakingSubMode('roleplay');
          setCurrentSpeakingTurnIndex(0);
          setSpeakingTurnScores({});
          setIsSpeakingFinished(false);
          setSpeakingScore(null);
          setSpeakingFeedback(null);
          setSpeakingSessionStreak(0);
          if (activePracticeConfig.planTitle || activePracticeConfig.planObjective || activePracticeConfig.estimatedMinutes) {
            setTodayPlanMeta({
              planItemId: activePracticeConfig.planItemId,
              title: activePracticeConfig.planTitle,
              objective: activePracticeConfig.planObjective,
              estimatedMinutes: activePracticeConfig.estimatedMinutes,
            });
          }
          if (activePracticeConfig.planItemId) {
            setSourceContext({
              todayPlanTaskId: activePracticeConfig.planItemId,
              sourceModule: 'speaking',
              targetLessonId: matched.id,
              initiatedAt: Date.now(),
            });
          }
        }
      }
      clearAdaptivePractice();
    } else if (activePracticeConfig.module === 'writing') {
      setActiveSkill('writing');
      setActiveFourSkill('writing');
      const rawIds = activePracticeConfig.itemIds || [];
      if (rawIds.length > 0) {
        const targetId = rawIds[0].trim().toLowerCase();
        const matched = WRITING_PROMPTS.find((p) => p.id.toLowerCase() === targetId) ||
          WRITING_PROMPTS.find((p) => p.title.toLowerCase().includes(targetId)) || null;
        if (matched) {
          setSelectedWritingPrompt(matched);
          setWritingContent('');
          setGradingResult(null);
          setShowModelAnswer(false);
          if (activePracticeConfig.planTitle || activePracticeConfig.planObjective || activePracticeConfig.estimatedMinutes) {
            setTodayPlanMeta({
              planItemId: activePracticeConfig.planItemId,
              title: activePracticeConfig.planTitle,
              objective: activePracticeConfig.planObjective,
              estimatedMinutes: activePracticeConfig.estimatedMinutes,
            });
          }
          if (activePracticeConfig.planItemId) {
            setSourceContext({
              todayPlanTaskId: activePracticeConfig.planItemId,
              sourceModule: 'writing',
              targetLessonId: matched.id,
              initiatedAt: Date.now(),
            });
          }
        }
      }
      clearAdaptivePractice();
    }
  }, [activePracticeConfig, setActiveFourSkill, clearAdaptivePractice]);

  // =========================================================================
  // 5. LEARNING CONTINUITY STATE & RESUME HANDLERS (PHASE 3)
  // =========================================================================
  const isLessonCurrentlyOpen = useMemo(() => {
    switch (activeSkill) {
      case 'listening':
        return selectedListenLesson !== null;
      case 'reading':
        return selectedReadLesson !== null;
      case 'speaking':
        return selectedSpeakingPrompt !== null;
      case 'writing':
        return selectedWritingPrompt !== null || isCustomTopicMode;
      default:
        return false;
    }
  }, [
    activeSkill,
    selectedListenLesson,
    selectedReadLesson,
    selectedSpeakingPrompt,
    selectedWritingPrompt,
    isCustomTopicMode,
  ]);

  const [currentActiveMilestoneLevel, setCurrentActiveMilestoneLevel] = useState<CEFRLevel | undefined>(undefined);

  const handleSelectMilestoneLevel = (level: CEFRLevel) => {
    setCurrentActiveMilestoneLevel(level);
    setListenLevelFilter(level);
    setReadLevelFilter(level);
    setSpeakingLevelFilter(level);
    setWritingLevelFilter(level);
  };

  const handleSelectJourneyLesson = (skill: SkillType, lessonId: string) => {
    handleSwitchSkill(skill);
    if (skill === 'listening') {
      const found = LISTENING_LESSONS.find((l) => l.id === lessonId);
      if (found) {
        const act = resumeActivities[`listening_${found.id}`];
        setSelectedListenLesson(found);
        setListeningQuizAnswers(
          act && !act.completed && !isActivityStale(act) && act.type === 'listening'
            ? act.checkpoint.answers || {}
            : {}
        );
        setListeningQuizSubmitted(false);
      }
    } else if (skill === 'reading') {
      const found = READING_LESSONS.find((r) => r.id === lessonId);
      if (found) {
        const act = resumeActivities[`reading_${found.id}`];
        setSelectedReadLesson(found);
        setReadingQuizAnswers(
          act && !act.completed && !isActivityStale(act) && act.type === 'reading'
            ? act.checkpoint.answers || {}
            : {}
        );
        setReadingQuizSubmitted(false);
        setReadingAttemptId(`reading_lesson_${found.id}_${Date.now()}`);
      }
    } else if (skill === 'speaking') {
      const found = SPEAKING_PROMPTS.find((s) => s.id === lessonId);
      if (found) {
        const act = resumeActivities[`speaking_${found.id}`];
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch {}
          recognitionRef.current = null;
        }
        setIsRecordingSpeaking(false);
        setSpeakingSubMode('roleplay');
        setSelectedSpeakingPrompt(found);
        setCurrentSpeakingTurnIndex(
          act && !act.completed && !isActivityStale(act) && act.type === 'speaking'
            ? act.checkpoint.currentTurnIndex || 0
            : 0
        );
        setSpeakingTurnScores({});
        setIsSpeakingFinished(false);
        setSpeakingTranscript('');
        setSpeakingScore(null);
        setSpeakingFeedback(null);
        setSpeakingPermissionDenied(false);
      }
    } else if (skill === 'writing') {
      const found = WRITING_PROMPTS.find((w) => w.id === lessonId);
      if (found) {
        const act = resumeActivities[`writing_${found.id}`];
        setSelectedWritingPrompt(found);
        setIsCustomTopicMode(false);
        setWritingTopic(found.prompt);
        setWritingContent(
          act && !act.completed && !isActivityStale(act) && act.type === 'writing'
            ? act.checkpoint.draft || ''
            : ''
        );
        setGradingResult(null);
        setShowModelAnswer(false);
        setWritingAttemptId(`writing_essay_${found.id}_${Date.now()}`);
      }
    }
  };

  const activeSkillResumeActivity = useMemo(() => {
    const activities = Object.values(resumeActivities || {}).filter(
      (act) => act.type === activeSkill && !act.completed && !isActivityStale(act)
    );
    if (activities.length === 0) return null;

    const sorted = [...activities].sort((a, b) => b.lastActiveAt - a.lastActiveAt);

    const valid = sorted.find((act) => {
      if (act.type === 'reading') {
        const lessonId = act.checkpoint.lessonId;
        if (!lessonId || completedReadIds.includes(lessonId)) return false;
        return READING_LESSONS.some((l) => l.id === lessonId);
      }
      if (act.type === 'speaking') {
        const promptId = act.checkpoint.promptId;
        if (!promptId || completedSpeakingIds.includes(promptId)) return false;
        return SPEAKING_PROMPTS.some((p) => p.id === promptId);
      }
      if (act.type === 'writing') {
        const promptId = act.checkpoint.promptId;
        if (promptId && promptId !== 'custom_writing') {
          if (completedWritingIds.includes(promptId)) return false;
          return WRITING_PROMPTS.some((p) => p.id === promptId);
        }
        return Boolean(act.checkpoint.customTopic || promptId === 'custom_writing');
      }
      if (act.type === 'listening') {
        const lessonId = act.checkpoint.lessonId;
        if (!lessonId || completedListenIds.includes(lessonId)) return false;
        return LISTENING_LESSONS.some((l) => l.id === lessonId);
      }
      return false;
    });

    return valid || null;
  }, [
    resumeActivities,
    activeSkill,
    completedReadIds,
    completedSpeakingIds,
    completedWritingIds,
    completedListenIds,
  ]);

  const handleResumeActiveSkillActivity = () => {
    if (!activeSkillResumeActivity) return;
    const act = activeSkillResumeActivity;

    if (act.type === 'reading') {
      const matched = READING_LESSONS.find((l) => l.id === act.checkpoint.lessonId);
      if (matched) {
        setSelectedReadLesson(matched);
        setReadingQuizAnswers(act.checkpoint.answers || {});
        setReadingQuizSubmitted(false);
        setReadingAttemptId(`reading_lesson_${matched.id}_${Date.now()}`);
      }
    } else if (act.type === 'speaking') {
      const matched = SPEAKING_PROMPTS.find((p) => p.id === act.checkpoint.promptId);
      if (matched) {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch {}
          recognitionRef.current = null;
        }
        setIsRecordingSpeaking(false);
        setSpeakingSubMode('roleplay');
        setSelectedSpeakingPrompt(matched);
        setCurrentSpeakingTurnIndex(act.checkpoint.currentTurnIndex || 0);
        setSpeakingTurnScores({});
        setIsSpeakingFinished(false);
        setSpeakingTranscript('');
        setSpeakingScore(null);
        setSpeakingFeedback(null);
        setSpeakingPermissionDenied(false);
      }
    } else if (act.type === 'writing') {
      if (act.checkpoint.promptId && act.checkpoint.promptId !== 'custom_writing') {
        const matched = WRITING_PROMPTS.find((p) => p.id === act.checkpoint.promptId);
        if (matched) {
          setSelectedWritingPrompt(matched);
          setIsCustomTopicMode(false);
          setWritingTopic(matched.prompt);
        }
      } else {
        setSelectedWritingPrompt(null);
        setIsCustomTopicMode(true);
        setWritingTopic(act.checkpoint.customTopic || '');
      }
      setWritingContent(act.checkpoint.draft || '');
      setGradingResult(null);
      setShowModelAnswer(false);
      setWritingAttemptId(`writing_essay_${act.checkpoint.promptId || 'custom'}_${Date.now()}`);
    } else if (act.type === 'listening') {
      const matched = LISTENING_LESSONS.find((l) => l.id === act.checkpoint.lessonId);
      if (matched) {
        setSelectedListenLesson(matched);
        setListeningQuizAnswers(act.checkpoint.answers || {});
        setListeningQuizSubmitted(false);
        setAttemptState('in-progress');
      }
    }
  };

  const handleDismissActiveSkillActivity = () => {
    if (activeSkillResumeActivity) {
      removeResumeActivity(activeSkillResumeActivity.id);
    }
  };

  // Debounced draft writing autosave (600ms)
  useEffect(() => {
    if (!selectedWritingPrompt && !isCustomTopicMode) return;
    if (isGrading || gradingResult) return;
    const trimmed = writingContent.trim();
    if (!trimmed) return;

    const timer = setTimeout(() => {
      const promptId = selectedWritingPrompt?.id || 'custom_writing';
      const words = trimmed.split(/\s+/).filter(Boolean);
      const minWords = selectedWritingPrompt?.minWords || 50;

      upsertResumeActivity({
        id: `writing_${promptId}`,
        type: 'writing',
        title: selectedWritingPrompt?.title || writingTopic || 'Bài viết tự do',
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          promptId,
          customTopic: isCustomTopicMode ? writingTopic : undefined,
          draft: writingContent,
          wordCount: words.length,
          progressPercent: Math.min(100, Math.round((words.length / minWords) * 100)),
        },
      });
    }, 600);

    return () => clearTimeout(timer);
  }, [writingContent, selectedWritingPrompt, isCustomTopicMode, writingTopic, upsertResumeActivity, isGrading, gradingResult]);

  // Confetti helper (Policy-guarded, disabled under reduced motion)
  const fireSuccessConfetti = () => {
    triggerCelebration('completion', {
      particleCount: 60,
      spread: 70,
      origin: { y: 0.7 },
    });
  };

  // Click-to-Translate Helper: Look up word in unified bank
  const handleWordClick = (rawWord: string) => {
    const clean = rawWord.toLowerCase().replace(/[^a-z0-9'-]/gi, '').trim();
    if (!clean || clean.length < 2) return;

    const found = lookupContextWord(rawWord) || VOCAB_10000_BANK.find((w) => w.word.toLowerCase().trim() === clean);
    if (found) {
      setLookupWord({
        word: found.word,
        ipa: found.ipa || found.phonetic || '',
        partOfSpeech: found.partOfSpeech || found.pos || 'noun',
        meaning: found.meaning || 'Từ vựng tiếng Anh',
        example: found.example || found.exampleEn,
      });
    } else {
      setLookupWord({
        word: rawWord.replace(/[^a-zA-Z]/g, ''),
        ipa: `/${clean}/`,
        partOfSpeech: 'word',
        meaning: `Đang tra cứu: "${rawWord.replace(/[^a-zA-Z]/g, '')}". Nhấp vào Thêm để đưa vào thẻ SRS!`,
        example: `Example with "${clean}".`,
      });
    }
  };

  const handleAddLookupToSRS = () => {
    if (!lookupWord) return;
    saveToSRS({
      id: `vocab_${lookupWord.word.toLowerCase().trim()}`,
      word: lookupWord.word,
      ipa: lookupWord.ipa,
      phonetic: lookupWord.ipa,
      partOfSpeech: lookupWord.partOfSpeech,
      pos: lookupWord.partOfSpeech,
      meaning: lookupWord.meaning,
      example: lookupWord.example || `I am studying the word "${lookupWord.word}".`,
      exampleEn: lookupWord.example || `I am studying the word "${lookupWord.word}".`,
      tag: 'Daily',
      srsLevel: 0,
      interval: 1,
      easeFactor: 2.5,
      nextReviewDate: new Date().toISOString(),
    });
    gainXP(15);
    setAddedSuccessWord(lookupWord.word);
    triggerCelebration('micro');
    setTimeout(() => {
      setAddedSuccessWord(null);
    }, 2500);
  };

  // Helper render Clickable Sentence Tokens with Word Highlight Support
  const renderSentenceTokens = (
    sent: { en: string; vi: string },
    sentenceIdx: number,
    isSentenceActive: boolean
  ) => {
    const tokens = syncMap?.sentences[sentenceIdx]?.tokens ?? tokenizeSentence(sent.en);

    return tokens.map((token, tIdx) => {
      if (!token.isWord) {
        return <span key={tIdx}>{token.text}</span>;
      }

      const isWordActive =
        isSentenceActive &&
        highlightMode === 'word' &&
        activeWordIndex !== null &&
        token.wordIndex === activeWordIndex;

      return (
        <span
          key={tIdx}
          data-word-index={token.wordIndex}
          onClick={(e) => {
            e.stopPropagation();
            handleWordClick(token.cleanWord || token.text);
          }}
          title="Nhấp để xem nghĩa tiếng Việt & Thêm vào Flashcard"
          className={`cursor-pointer transition-colors duration-150 rounded px-1 py-0.5 inline ${
            isWordActive
              ? 'bg-amber-400 text-slate-950 font-bold shadow-sm ring-1 ring-amber-300'
              : 'hover:text-cyan-400 hover:underline hover:bg-cyan-500/15'
          }`}
        >
          {token.text}
        </span>
      );
    });
  };

  // =========================================================================
  // AUDIO SYNTHESIS PLAYBACK ENGINE (LISTENING LAB)
  // =========================================================================
  const handlePlayListeningAudio = () => {
    if (!('speechSynthesis' in window)) {
      alert('Trình duyệt của bạn không hỗ trợ Web Speech API.');
      return;
    }

    if (isPlayingAudio) {
      activeSessionRef.current++;
      window.speechSynthesis.cancel();
      syncControllerRef.current?.stop();
      isAudioBusyRef.current = false;
      setIsAudioStarting(false);
      setIsPlayingAudio(false);
      return;
    }

    // Synchronous guard: prevent race conditions when spamming Play before onstart fires
    if (isAudioBusyRef.current) return;
    if (!selectedListenLesson) return;

    isAudioBusyRef.current = true;
    setIsAudioStarting(true);
    window.speechSynthesis.cancel();

    const currentSession = syncControllerRef.current?.start(selectedListenLesson, audioSpeed) ?? 0;
    activeSessionRef.current = currentSession;

    const textToSpeak = selectedListenLesson.audioText;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'en-US';
    utterance.rate = audioSpeed;

    utterance.onstart = () => {
      if (currentSession !== activeSessionRef.current) return;
      setIsAudioStarting(false);
      setIsPlayingAudio(true);
    };

    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (currentSession !== activeSessionRef.current) return;
      syncControllerRef.current?.onBoundary(event.charIndex, event.name, currentSession);
    };

    utterance.onend = () => {
      if (currentSession !== activeSessionRef.current) return;
      isAudioBusyRef.current = false;
      setIsAudioStarting(false);
      setIsPlayingAudio(false);
      syncControllerRef.current?.handleEnd(currentSession);
    };

    utterance.onerror = () => {
      if (currentSession !== activeSessionRef.current) return;
      isAudioBusyRef.current = false;
      setIsAudioStarting(false);
      setIsPlayingAudio(false);
      syncControllerRef.current?.handleEnd(currentSession);
    };

    utteranceRef.current = utterance;
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      isAudioBusyRef.current = false;
      setIsAudioStarting(false);
      setIsPlayingAudio(false);
      syncControllerRef.current?.stop();
    }
  };

  const handleSeek = (progress: number) => {
    if (!('speechSynthesis' in window) || !selectedListenLesson) return;

    lastScrolledSentenceRef.current = null;

    const request = syncControllerRef.current?.seekToProgress(progress);
    if (!request) return;

    activeSessionRef.current = request.sessionId;

    if (request.shouldPlay) {
      window.speechSynthesis.cancel();
      isAudioBusyRef.current = true;
      setIsAudioStarting(true);

      const utterance = new SpeechSynthesisUtterance(request.textToSpeak);
      utterance.lang = 'en-US';
      utterance.rate = audioSpeed;

      utterance.onstart = () => {
        if (request.sessionId !== activeSessionRef.current) return;
        setIsAudioStarting(false);
        setIsPlayingAudio(true);
      };

      utterance.onboundary = (event: SpeechSynthesisEvent) => {
        if (request.sessionId !== activeSessionRef.current) return;
        syncControllerRef.current?.onBoundary(event.charIndex, event.name, request.sessionId);
      };

      utterance.onend = () => {
        if (request.sessionId !== activeSessionRef.current) return;
        isAudioBusyRef.current = false;
        setIsAudioStarting(false);
        setIsPlayingAudio(false);
        syncControllerRef.current?.handleEnd(request.sessionId);
      };

      utterance.onerror = () => {
        if (request.sessionId !== activeSessionRef.current) return;
        isAudioBusyRef.current = false;
        setIsAudioStarting(false);
        setIsPlayingAudio(false);
        syncControllerRef.current?.handleEnd(request.sessionId);
      };

      utteranceRef.current = utterance;
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        isAudioBusyRef.current = false;
        setIsAudioStarting(false);
        setIsPlayingAudio(false);
        syncControllerRef.current?.stop();
      }
    } else {
      window.speechSynthesis.cancel();
      isAudioBusyRef.current = false;
      setIsAudioStarting(false);
      setIsPlayingAudio(false);
    }
  };

  // Cleanup audio on unmount or lesson change
  useEffect(() => {
    syncControllerRef.current?.setLesson(selectedListenLesson, audioSpeed);
    return () => {
      activeSessionRef.current++;
      isAudioBusyRef.current = false;
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      syncControllerRef.current?.stop();
    };
  }, [selectedListenLesson, activeSkill, audioSpeed]);

  useEffect(() => {
    return () => {
      syncControllerRef.current?.destroy();
    };
  }, []);

  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);
  const lastScrolledSentenceRef = useRef<number | null>(null);
  const isSeekingRef = useRef<boolean>(false);

  // Auto-scroll transcript: smoothly keeps the active reading span visible without jitter
  useEffect(() => {
    if (!isPlayingAudio || activeSentenceIndex === null) {
      lastScrolledSentenceRef.current = null;
      return;
    }

    // Do not auto-scroll while user is actively dragging the seek bar
    if (isSeekingRef.current) return;

    const container = transcriptContainerRef.current;
    if (!container) return;

    // Find active element: in word mode try the active word first, fallback to sentence
    let activeEl: HTMLElement | null = null;
    if (highlightMode === 'word' && activeWordIndex !== null) {
      activeEl = container.querySelector(
        `[data-sentence-index="${activeSentenceIndex}"] [data-word-index="${activeWordIndex}"]`
      );
    }
    if (!activeEl) {
      activeEl = container.querySelector(`[data-sentence-index="${activeSentenceIndex}"]`);
    }

    if (!activeEl || typeof activeEl.getBoundingClientRect !== 'function') return;

    // Only scroll if element is truly outside comfortable visible area
    const rect = activeEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const isOutOfView = rect.top < 80 || rect.bottom > viewportHeight - 80;

    if (isOutOfView) {
      if (typeof activeEl.scrollIntoView === 'function') {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
      }
      lastScrolledSentenceRef.current = activeSentenceIndex;
    }
  }, [isPlayingAudio, activeSentenceIndex, activeWordIndex, highlightMode]);

  // Submit Listening Quiz
  const handleSubmitListeningQuiz = () => {
    if (!selectedListenLesson || listeningQuizSubmitted || attemptState !== 'in-progress') return;

    // Guard: Validate that all questions have been answered before submitting
    const unansweredCount = selectedListenLesson.questions.filter(
      (q) => listeningQuizAnswers[q.id] === undefined
    ).length;

    if (unansweredCount > 0) {
      setQuizSubmitWarning(
        `Vui lòng hoàn thành tất cả câu hỏi trước khi nộp bài (còn ${unansweredCount} câu chưa chọn).`
      );
      return;
    }

    // Idempotency guard: prevent duplicate side-effect execution for this attempt session
    const attemptId = currentAttemptIdRef.current;
    if (finalizedAttemptsRef.current.has(attemptId)) {
      return;
    }
    finalizedAttemptsRef.current.add(attemptId);

    setQuizSubmitWarning(null);
    setListeningQuizSubmitted(true);
    setAttemptState('completed');
    let correctCount = 0;

    selectedListenLesson.questions.forEach((q) => {
      const selectedOptIdx = listeningQuizAnswers[q.id];
      const isCorrect = selectedOptIdx === q.correctIndex;

      const targetRes = resolveListeningQuestionTarget(q, selectedListenLesson.title, vocabularyList);

      if (isCorrect) {
        correctCount++;
        if (targetRes.isVocabTarget) {
          recordMistakeCorrect(targetRes.targetId, { type: 'listening' });
          recordMistakeCorrect(targetRes.targetWord, { type: 'listening' });
        }
      } else {
        if (targetRes.isVocabTarget) {
          captureListeningMistake({
            question: q,
            lessonTitle: selectedListenLesson.title,
            selectedOptIdx,
            vocabularyList,
            recordMistake,
          });
        }
      }
    });

    const totalQuestions = selectedListenLesson.questions.length || 1;
    const listeningPct = Math.round((correctCount / totalQuestions) * 100);
    recordSkillEvidence({
      skill: 'listening',
      score: listeningPct,
      source: 'four-skills',
      cefrDifficulty: selectedListenLesson?.level && VALID_CEFR_LEVELS.has(selectedListenLesson.level as CEFRLevel)
        ? (selectedListenLesson.level as CEFRLevel)
        : undefined,
      quality: 1.0,
      metadata: {
        lessonId: selectedListenLesson.id,
        lessonTitle: selectedListenLesson.title,
        correctCount,
        totalQuestions,
      },
    });

    if (correctCount > 0) {
      gainXP(correctCount * 15);
      fireSuccessConfetti();

      // Mark completed
      if (!completedListenIds.includes(selectedListenLesson.id)) {
        markListeningLessonCompleted(selectedListenLesson.id);
      }
    }
    setListeningSessionStreak(correctCount);
    if (listeningFeedbackTimerRef.current) clearTimeout(listeningFeedbackTimerRef.current);
    setListeningMicroFeedback({
      text: `${correctCount}/${totalQuestions} câu đúng!`,
      sentiment: correctCount > 0 ? 'success' : 'warning',
    });
    listeningFeedbackTimerRef.current = setTimeout(() => {
      setListeningMicroFeedback(null);
    }, 3000);
    completeResumeActivity(`listening_${selectedListenLesson.id}`);
  };

  const handleSaveListeningQuestionToSRS = (q: ListeningLesson['questions'][0]) => {
    if (!selectedListenLesson) return;
    const targetRes = resolveListeningQuestionTarget(q, selectedListenLesson.title, vocabularyList);
    // Hard guard: General comprehension questions have no target vocabulary and cannot be saved to SRS
    if (!targetRes.isVocabTarget) return;

    saveToSRS({
      id: targetRes.targetId,
      word: targetRes.targetWord,
      ipa: targetRes.ipa,
      meaning: targetRes.meaning,
      example: targetRes.example,
      tag: 'Daily',
      srsLevel: 0,
      interval: 1,
      easeFactor: 2.5,
      nextReviewDate: new Date().toISOString(),
      partOfSpeech: 'noun',
    }, { contextSentence: selectedListenLesson.title });
    setSavedListeningQuestionIds((prev) => new Set(prev).add(q.id));
    gainXP(10);
    fireSuccessConfetti();
  };

  const isQuestionInSRS = (q: ListeningLesson['questions'][0]) => {
    const targetRes = resolveListeningQuestionTarget(
      q,
      selectedListenLesson?.title || '',
      vocabularyList
    );
    if (!targetRes.isVocabTarget) return false;
    const targetId = targetRes.targetId;
    const targetWord = targetRes.targetWord.toLowerCase().trim();
    return Boolean(
      savedListeningQuestionIds.has(q.id) ||
      srsProgressMap[targetId] ||
      srsProgressMap[targetWord]
    );
  };

  // Submit Reading Quiz
  const handleSubmitReadingQuiz = () => {
    if (!selectedReadLesson) return;
    setReadingQuizSubmitted(true);
    let correctCount = 0;
    selectedReadLesson.questions.forEach((q) => {
      if (readingQuizAnswers[q.id] === q.correctIndex) {
        correctCount++;
      }
    });

    const totalQuestions = selectedReadLesson.questions.length || 1;
    const readingPct = Math.round((correctCount / totalQuestions) * 100);
    recordSkillEvidence({
      skill: 'reading',
      score: readingPct,
      source: 'four-skills',
      cefrDifficulty: selectedReadLesson?.level && VALID_CEFR_LEVELS.has(selectedReadLesson.level as CEFRLevel)
        ? (selectedReadLesson.level as CEFRLevel)
        : undefined,
      quality: 1.0,
      metadata: {
        lessonId: selectedReadLesson.id,
        lessonTitle: selectedReadLesson.title,
        correctCount,
        totalQuestions,
      },
    });

    if (correctCount > 0) {
      gainXP(correctCount * 15);
      fireSuccessConfetti();

      // Mark completed
      markFourSkillsLessonCompleted('reading', selectedReadLesson.id);
    }
    setReadingSessionStreak(correctCount);
    if (readingFeedbackTimerRef.current) clearTimeout(readingFeedbackTimerRef.current);
    setReadingMicroFeedback({
      text: `${correctCount}/${totalQuestions} câu đúng!`,
      sentiment: correctCount > 0 ? 'success' : 'warning',
    });
    readingFeedbackTimerRef.current = setTimeout(() => {
      setReadingMicroFeedback(null);
    }, 3000);
    completeResumeActivity(`reading_${selectedReadLesson.id}`);

    // Record Reading encounters for words in the completed reading lesson.
    // readingAttemptId is attempt-scoped (lessonId + timestamp set when lesson opened), so a
    // second genuine attempt of the same lesson still increments the encounter counter.
    // Fallback timestamp handles any edge case where state was not set (should not happen).
    const attemptId = readingAttemptId || `reading_lesson_${selectedReadLesson.id}_${Date.now()}`;
    recordReadingEncounters(
      selectedReadLesson.content.join(' '),
      attemptId
    );
  };

  // =========================================================================
  // MULTI-TURN SPEAKING ENGINE (WEB SPEECH RECOGNITION)
  // =========================================================================
  const handleSelectSpeakingPrompt = (prompt: SpeakingPrompt) => {
    // Abort and detach any active recognition session when switching lessons
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsRecordingSpeaking(false);
    setSelectedSpeakingPrompt(prompt);
    setCurrentSpeakingTurnIndex(0);
    setSpeakingTurnScores({});
    setIsSpeakingFinished(false);
    setSpeakingTranscript('');
    setSpeakingScore(null);
    setSpeakingFeedback(null);
    setSpeakingPermissionDenied(false);

    upsertResumeActivity({
      id: `speaking_${prompt.id}`,
      type: 'speaking',
      title: prompt.title,
      startedAt: Date.now(),
      lastActiveAt: Date.now(),
      completed: false,
      schemaVersion: 1,
      checkpoint: {
        promptId: prompt.id,
        currentTurnIndex: 0,
        totalTurns: prompt.turns.length,
        progressPercent: 0,
      },
    });
  };

  const handleToggleSpeakingRecord = () => {
    if (!isSpeechSupported) {
      return;
    }

    const win = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    if (isRecordingSpeaking) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
      setIsRecordingSpeaking(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsRecordingSpeaking(true);
        setSpeakingPermissionDenied(false);
        setSpeakingTranscript('');
        setSpeakingScore(null);
        setSpeakingFeedback(null);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setSpeakingTranscript(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        setIsRecordingSpeaking(false);
        recognitionRef.current = null;
        if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
          setSpeakingPermissionDenied(true);
        }
      };

      recognition.onend = () => {
        setIsRecordingSpeaking(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setIsRecordingSpeaking(false);
      recognitionRef.current = null;
      if (err?.name === 'NotAllowedError' || err?.message?.toLowerCase().includes('permission')) {
        setSpeakingPermissionDenied(true);
      }
    }
  };

  const handleRetrySpeakingTurn = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsRecordingSpeaking(false);
    setSpeakingTranscript('');
    setSpeakingScore(null);
    setSpeakingFeedback(null);
  };

  // Evaluate Current Speaking Turn
  useEffect(() => {
    if (!isRecordingSpeaking && speakingTranscript.trim().length > 0 && selectedSpeakingPrompt) {
      const currentTurn = selectedSpeakingPrompt.turns[currentSpeakingTurnIndex];
      if (!currentTurn) return;

      const attemptKey = `${selectedSpeakingPrompt.id}_turn_${currentSpeakingTurnIndex}_${speakingTranscript.trim()}`;
      if (lastEvaluatedSpeakingRef.current === attemptKey) return;
      lastEvaluatedSpeakingRef.current = attemptKey;

      const target = currentTurn.targetSentence.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      const user = speakingTranscript.toLowerCase().replace(/[^a-z0-9\s]/g, '');

      const targetWords = target.split(/\s+/).filter(Boolean);
      const userWords = user.split(/\s+/).filter(Boolean);

      let matchedWords = 0;
      targetWords.forEach((tw) => {
        if (userWords.includes(tw)) matchedWords++;
      });

      const accuracy = Math.min(100, Math.round((matchedWords / Math.max(1, targetWords.length)) * 100));
      setSpeakingScore(accuracy);

      let feedbackMsg = '';
      if (accuracy >= 80) {
        feedbackMsg = '🎉 Phát âm rất chuẩn xác và tự nhiên!';
        setSpeakingSessionStreak((prev) => prev + 1);
        if (speakingFeedbackTimerRef.current) clearTimeout(speakingFeedbackTimerRef.current);
        setSpeakingMicroFeedback({
          text: 'Chính xác! Giữ vững phong độ phát âm!',
          sentiment: 'success',
        });
        speakingFeedbackTimerRef.current = setTimeout(() => {
          setSpeakingMicroFeedback(null);
        }, 2500);
      } else if (accuracy >= 60) {
        feedbackMsg = '👍 Khá tốt! Cố gắng nhấn mạnh thêm các từ khóa chính.';
        setSpeakingSessionStreak(0);
        if (speakingFeedbackTimerRef.current) clearTimeout(speakingFeedbackTimerRef.current);
        setSpeakingMicroFeedback({
          text: 'Khá tốt! Luyện thêm nhịp điệu.',
          sentiment: 'info',
        });
        speakingFeedbackTimerRef.current = setTimeout(() => {
          setSpeakingMicroFeedback(null);
        }, 2500);
      } else {
        feedbackMsg = '💡 Cần luyện thêm. Hãy bấm nút Nghe Mẫu để bắt đúng nhịp điệu nhé!';
        setSpeakingSessionStreak(0);
        if (speakingFeedbackTimerRef.current) clearTimeout(speakingFeedbackTimerRef.current);
        setSpeakingMicroFeedback({
          text: 'Cần chú ý phát âm từ khóa chính.',
          sentiment: 'warning',
        });
        speakingFeedbackTimerRef.current = setTimeout(() => {
          setSpeakingMicroFeedback(null);
        }, 2500);
      }

      setSpeakingFeedback(feedbackMsg);

      // Record Turn Score
      setSpeakingTurnScores((prev) => ({
        ...prev,
        [currentSpeakingTurnIndex]: {
          accuracy,
          transcript: speakingTranscript,
          feedback: feedbackMsg,
        },
      }));

      // Delegate pronunciation evaluation & mistake recording to learning bridge
      captureSpeakingMistake({
        accuracy,
        targetSentence: currentTurn.targetSentence,
        speakingTranscript,
        turnIndex: currentSpeakingTurnIndex,
        promptTitle: selectedSpeakingPrompt.title,
        context: `${selectedSpeakingPrompt.title} (Turn ${currentSpeakingTurnIndex + 1})`,
        expectedAnswer: currentTurn.targetSentence,
        keyKeywords: currentTurn.keyKeywords,
        phonetic: currentTurn.phonetic,
        meaningVi: currentTurn.meaningVi,
        vocabularyList,
        recordMistake,
        recordMistakeCorrect,
      });
    }
  }, [isRecordingSpeaking, speakingTranscript, selectedSpeakingPrompt, currentSpeakingTurnIndex, vocabularyList, recordMistake, recordMistakeCorrect]);

  const handleNextSpeakingTurn = () => {
    if (!selectedSpeakingPrompt) return;

    if (currentSpeakingTurnIndex < selectedSpeakingPrompt.turns.length - 1) {
      const nextTurn = currentSpeakingTurnIndex + 1;
      setCurrentSpeakingTurnIndex(nextTurn);
      setSpeakingTranscript('');
      setSpeakingScore(null);
      setSpeakingFeedback(null);

      upsertResumeActivity({
        id: `speaking_${selectedSpeakingPrompt.id}`,
        type: 'speaking',
        title: selectedSpeakingPrompt.title,
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          promptId: selectedSpeakingPrompt.id,
          currentTurnIndex: nextTurn,
          totalTurns: selectedSpeakingPrompt.turns.length,
          progressPercent: Math.round((nextTurn / selectedSpeakingPrompt.turns.length) * 100),
        },
      });
    } else {
      // Finished all turns!
      setIsSpeakingFinished(true);
      gainXP(40);
      fireSuccessConfetti();
      completeResumeActivity(`speaking_${selectedSpeakingPrompt.id}`);

      // Check average score
      const allScores = Object.values(speakingTurnScores).map((s) => s.accuracy);
      if (allScores.length > 0) {
        const avg = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);
        recordSkillEvidence({
          skill: 'speaking',
          score: avg,
          source: 'four-skills',
          cefrDifficulty: selectedSpeakingPrompt?.level && VALID_CEFR_LEVELS.has(selectedSpeakingPrompt.level as CEFRLevel)
            ? (selectedSpeakingPrompt.level as CEFRLevel)
            : undefined,
          quality: 0.85,
          metadata: {
            promptId: selectedSpeakingPrompt.id,
            promptTitle: selectedSpeakingPrompt.title,
            turnCount: allScores.length,
          },
        });

        if (avg >= 60 && selectedSpeakingPrompt?.id) {
          markFourSkillsLessonCompleted('speaking', selectedSpeakingPrompt.id);
        }
      }
    }
  };

  const handlePracticeQueueItem = (targetId: string) => {
    startAdaptivePractice({ module: 'pronunciation', itemIds: [targetId] });
    if (onNavigate) {
      onNavigate('pronunciation');
    }
  };

  // =========================================================================
  // WRITING STUDIO ASSESSMENT & AI ESSAY GRADING ENGINE (GEMINI 1.5 FLASH)
  // =========================================================================
  const handleGradeWithAI = async () => {
    if (isGrading) return;
    const trimmedEssay = writingContent.trim();
    const words = trimmedEssay ? trimmedEssay.split(/\s+/).filter(Boolean) : [];
    const wordCount = words.length;

    if (wordCount < 10) {
      alert('Vui lòng viết tối thiểu một đoạn văn ngắn (ít nhất 10 từ) trước khi gửi chấm bài.');
      return;
    }

    // ── Writing telemetry: record BEFORE Gemini call ──────────────────────────
    // Invariant: a valid submitted essay (≥10 words) records usage even if Gemini
    // grading fails / API is unavailable.
    //
    // Activity ID = promptId + per-attempt timestamp + content hash:
    //   - Timestamp: each new "Grade" click generates a distinct ID, so identical text
    //     re-submitted in a later session increments the counter (not suppressed).
    //   - Content hash: rapid double-clicks on the same call get the same ID and are
    //     blocked by the 5-minute in-memory cooldown in wordUsageTelemetry.
    const essayHash = computeTextHash(trimmedEssay);
    const currentWritingAttemptId = writingAttemptId
      ? `${writingAttemptId}_${essayHash}`
      : `writing_essay_${selectedWritingPrompt?.id || 'custom'}_${Date.now()}_${essayHash}`;
    if (!writingAttemptId) {
      setWritingAttemptId(currentWritingAttemptId);
    }
    recordWritingUsages(trimmedEssay, currentWritingAttemptId);

    setIsGrading(true);
    setGradingStatus('Đang gửi bài viết...');

    const timer1 = setTimeout(() => {
      setGradingStatus('Đang phân tích 4 tiêu chí CEFR & cấu trúc ngữ pháp...');
    }, 1100);

    const timer2 = setTimeout(() => {
      setGradingStatus('Đang đối chiếu diff & hoàn thiện báo cáo...');
    }, 2200);

    try {
      const topic = writingTopic.trim() || selectedWritingPrompt?.prompt || 'General Academic Topic';
      const targetLevel: CEFRLevel =
        (selectedWritingPrompt && resolveCanonicalWritingCefrLevel(selectedWritingPrompt.level)) ||
        'B2';

      const result = await gradeEssay({
        essay: trimmedEssay,
        topic,
        targetLevel,
        apiKey: geminiApiKey,
      });

      setGradingResult(result);
      gainXP(30);
      if (writingFeedbackTimerRef.current) clearTimeout(writingFeedbackTimerRef.current);
      setWritingMicroFeedback({
        text: 'AI đã hoàn tất đánh giá bài viết!',
        sentiment: 'success',
      });
      writingFeedbackTimerRef.current = setTimeout(() => {
        setWritingMicroFeedback(null);
      }, 2500);

      // Tự động cuộn trang mượt mà (smooth scroll) xuống khối báo cáo
      setTimeout(() => {
        reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (err) {
      console.error('[FourSkillsView] Error in gradeEssay:', err);
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setIsGrading(false);
    }
  };

  const handleSaveWritingScore = (score: number, result?: EssayGradingResult) => {
    gainXP(20);
    if (writingFeedbackTimerRef.current) clearTimeout(writingFeedbackTimerRef.current);
    setWritingMicroFeedback({
      text: 'Đã lưu kết quả bài viết vào hồ sơ năng lực!',
      sentiment: 'success',
    });
    writingFeedbackTimerRef.current = setTimeout(() => {
      setWritingMicroFeedback(null);
    }, 2500);
    const evalRes = result || gradingResult;
    const isOffline = Boolean(evalRes?.isFallback);
    recordSkillEvidence({
      skill: 'writing',
      score,
      source: isOffline ? 'writing-offline' : 'writing-ai',
      cefrDifficulty: evalRes?.overallCEFR && VALID_CEFR_LEVELS.has(evalRes.overallCEFR)
        ? evalRes.overallCEFR
        : undefined,
      quality: isOffline ? 0.65 : 1.0,
      metadata: {
        promptId: selectedWritingPrompt?.id,
        promptTitle: selectedWritingPrompt?.title,
        wordCount: evalRes?.wordCount,
        isFallback: isOffline,
      },
    });
    if (selectedWritingPrompt?.id) {
      markFourSkillsLessonCompleted('writing', selectedWritingPrompt.id);
      completeResumeActivity(`writing_${selectedWritingPrompt.id}`);
    } else {
      completeResumeActivity('writing_custom_writing');
    }
  };

  // Derived Listening Categories
  const availableListeningCategories = useMemo(() => {
    const seen = new Set<string>();
    LISTENING_LESSONS.forEach((l) => {
      if (l.category) seen.add(l.category);
    });
    return ['ALL', ...Array.from(seen)];
  }, []);

  // Filtered Lists
  const filteredListeningLessons = LISTENING_LESSONS.filter((l) => {
    const matchesCategory =
      listenCategoryFilter === 'ALL' ||
      l.category.toLowerCase().includes(listenCategoryFilter.toLowerCase());
    const matchesLevel =
      listenLevelFilter === 'ALL' || l.level === listenLevelFilter;
    return matchesCategory && matchesLevel;
  });

  const filteredReadingLessons = useMemo(() => {
    return READING_LESSONS.filter((r) => {
      const matchesCategory =
        readCategoryFilter === 'ALL' ||
        r.category.toLowerCase().includes(readCategoryFilter.toLowerCase());
      const matchesLevel =
        readLevelFilter === 'ALL' || r.level === readLevelFilter;
      return matchesCategory && matchesLevel;
    });
  }, [readCategoryFilter, readLevelFilter]);

  const filteredSpeakingPrompts = useMemo(() => {
    return SPEAKING_PROMPTS.filter((s) => {
      const matchesCategory =
        speakingCategoryFilter === 'ALL' ||
        s.category.toLowerCase().includes(speakingCategoryFilter.toLowerCase());
      const matchesLevel =
        speakingLevelFilter === 'ALL' || s.level === speakingLevelFilter;
      return matchesCategory && matchesLevel;
    });
  }, [speakingCategoryFilter, speakingLevelFilter]);

  const filteredWritingPrompts = useMemo(() => {
    return WRITING_PROMPTS.filter((w) => {
      const matchesCategory =
        writingCategoryFilter === 'ALL' ||
        w.category.toLowerCase() === writingCategoryFilter.toLowerCase() ||
        w.type.toLowerCase().includes(writingCategoryFilter.toLowerCase());
      const matchesLevel =
        writingLevelFilter === 'ALL' ||
        resolveCanonicalWritingCefrLevel(w.level) === writingLevelFilter;
      return matchesCategory && matchesLevel;
    });
  }, [writingCategoryFilter, writingLevelFilter]);

  return (
    <div className="space-y-8 pb-16 animate-fadeIn select-none">
      
      {/* 1. TOP HERO HEADER & 4-SKILLS MASTER HUB DASHBOARD */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 rounded-full text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Phân Hệ Toàn Diện 4 Kỹ Năng</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              4-Skills Mastery Hub
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm max-w-xl leading-relaxed">
              Luyện trọn vẹn <strong className="text-cyan-300">Nghe • Đọc • Nói • Viết</strong> với tra từ 1-chạm, hội thoại đa lượt Roleplay AI và sửa bài viết thông minh.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 p-3 rounded-2xl">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-850 rounded-xl">
              <Flame className="w-4 h-4 text-orange-400 fill-orange-400" />
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Streak</span>
                <strong className="text-sm font-black text-white">{profile.streak ?? 0} ngày</strong>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-850 rounded-xl">
              <Award className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Level</span>
                <strong className="text-sm font-black text-amber-400">Lv.{profile.level}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* 4 INTERACTIVE SKILL TABS (ALWAYS VISIBLE AT TOP) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-6 relative z-10">
          
          {/* TAB 1: LISTENING */}
          <button
            onClick={() => handleSwitchSkill('listening')}
            className={`p-4 rounded-2xl border transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 text-left flex items-center justify-between ${
              activeSkill === 'listening'
                ? 'bg-gradient-to-r from-teal-500/20 via-cyan-500/15 to-slate-900 border-cyan-400 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-400/50'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850 opacity-80 hover:opacity-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                activeSkill === 'listening' ? 'bg-cyan-400 text-slate-950 font-black' : 'bg-slate-800 text-cyan-400'
              }`}>
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-xs sm:text-sm text-white block">🎧 Luyện Nghe</span>
                <span className="text-[11px] text-slate-400">
                  {fourSkillsCompetency.listening.isAssessed
                    ? `Band ${fourSkillsCompetency.listening.level} (${fourSkillsCompetency.listening.score}%) • ${LISTENING_LESSONS.length} bài`
                    : `Listening Lab (${LISTENING_LESSONS.length} bài)`}
                </span>
              </div>
            </div>
            {activeSkill === 'listening' && <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />}
          </button>

          {/* TAB 2: READING */}
          <button
            onClick={() => handleSwitchSkill('reading')}
            className={`p-4 rounded-2xl border transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 text-left flex items-center justify-between ${
              activeSkill === 'reading'
                ? 'bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-slate-900 border-emerald-400 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-400/50'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850 opacity-80 hover:opacity-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                activeSkill === 'reading' ? 'bg-emerald-400 text-slate-950 font-black' : 'bg-slate-800 text-emerald-400'
              }`}>
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-xs sm:text-sm text-white block">📖 Luyện Đọc</span>
                <span className="text-[11px] text-slate-400">
                  {fourSkillsCompetency.reading.isAssessed
                    ? `Band ${fourSkillsCompetency.reading.level} (${fourSkillsCompetency.reading.score}%) • ${READING_LESSONS.length} bài`
                    : `Reading Studio (${READING_LESSONS.length} bài)`}
                </span>
              </div>
            </div>
            {activeSkill === 'reading' && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
          </button>

          {/* TAB 3: SPEAKING */}
          <button
            onClick={() => handleSwitchSkill('speaking')}
            className={`p-4 rounded-2xl border transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 text-left flex items-center justify-between ${
              activeSkill === 'speaking'
                ? 'bg-gradient-to-r from-purple-500/20 via-pink-500/15 to-slate-900 border-purple-400 shadow-xl shadow-purple-500/10 ring-1 ring-purple-400/50'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850 opacity-80 hover:opacity-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                activeSkill === 'speaking' ? 'bg-purple-400 text-slate-950 font-black' : 'bg-slate-800 text-purple-400'
              }`}>
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-xs sm:text-sm text-white block">🗣️ Luyện Nói</span>
                <span className="text-[11px] text-slate-400">
                  {fourSkillsCompetency.speaking.isAssessed
                    ? `Band ${fourSkillsCompetency.speaking.level} (${fourSkillsCompetency.speaking.score}%) • ${SPEAKING_PROMPTS.length} chủ đề`
                    : `Roleplay AI (${SPEAKING_PROMPTS.length} chủ đề)`}
                </span>
              </div>
            </div>
            {activeSkill === 'speaking' && <div className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />}
          </button>

          {/* TAB 4: WRITING */}
          <button
            onClick={() => handleSwitchSkill('writing')}
            className={`p-4 rounded-2xl border transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 text-left flex items-center justify-between ${
              activeSkill === 'writing'
                ? 'bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-slate-900 border-amber-400 shadow-xl shadow-amber-500/10 ring-1 ring-amber-400/50'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850 opacity-80 hover:opacity-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                activeSkill === 'writing' ? 'bg-amber-400 text-slate-950 font-black' : 'bg-slate-800 text-amber-400'
              }`}>
                <PenTool className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-xs sm:text-sm text-white block">✍️ Luyện Viết</span>
                <span className="text-[11px] text-slate-400">
                  {fourSkillsCompetency.writing.isAssessed
                    ? `Band ${fourSkillsCompetency.writing.level} (${fourSkillsCompetency.writing.score}%) • ${WRITING_PROMPTS.length} đề bài`
                    : `Writing Studio (${WRITING_PROMPTS.length} đề bài)`}
                </span>
              </div>
            </div>
            {activeSkill === 'writing' && <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
          </button>

        </div>
      </div>

      {/* 2. FOUR SKILLS ADAPTIVE SUMMARY (DERIVED, REAL-TIME, NON-PERSISTED) */}
      <FourSkillsAdaptiveSummary onNavigate={onNavigate} />

      {/* ========================================================================= */}
      {/* 2. CLICK-TO-TRANSLATE FLOATING MODAL                                      */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {lookupWord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border-2 border-cyan-500/50 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-black text-white">{lookupWord.word}</h3>
                    <button
                      onClick={() => speakWord(lookupWord.word)}
                      title="Phát âm từ này"
                      className="p-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-xl"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-xs font-mono text-cyan-400 block mt-0.5">{lookupWord.ipa}</span>
                </div>

                <button
                  onClick={() => setLookupWord(null)}
                  className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs sm:text-sm">
                <span className="px-2 py-0.5 bg-slate-850 text-slate-400 rounded-md text-[10px] font-bold uppercase inline-block mb-1">
                  {lookupWord.partOfSpeech}
                </span>
                <p className="text-emerald-300 font-bold leading-relaxed">{lookupWord.meaning}</p>
                {lookupWord.example && (
                  <p className="text-slate-400 italic text-xs pt-1 border-t border-slate-850">
                    "{lookupWord.example}"
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleAddLookupToSRS}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {addedSuccessWord === lookupWord.word ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Đã Thêm Vào SRS!</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      <span>+ Thêm Vào Flashcard SRS</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setLookupWord(null)}
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-2xl text-xs"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 3. SKILL CONTENT PANELS                                                   */}
      {/* ========================================================================= */}

      {/* 2.5 RESUMABLE LEARNING ACTIVITY BANNER (UX CONTINUITY ENGINE) */}
      {activeSkillResumeActivity && !isLessonCurrentlyOpen && (
        <div
          data-testid="four-skills-resume-banner"
          className="bg-gradient-to-r from-cyan-950/70 via-slate-900 to-slate-950 border border-cyan-500/40 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xl relative overflow-hidden animate-fadeIn"
        >
          <div className="absolute top-0 right-0 w-64 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded-md border border-cyan-500/30">
                  Bài học dở dang
                </span>
                <span className="text-xs text-slate-400">
                  {activeSkillResumeActivity.checkpoint.progressPercent || 0}% hoàn thành
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white mt-1">
                Bạn đang học dở: {activeSkillResumeActivity.title}
              </h3>
              <p className="text-xs text-slate-400">
                Tiếp tục bài học đúng checkpoint đã lưu hoặc bắt đầu bài mới tùy chọn.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto relative z-10">
            <button
              type="button"
              data-testid="btn-resume-activity"
              onClick={handleResumeActiveSkillActivity}
              className="flex-1 sm:flex-none px-5 py-3 bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 hover:opacity-95 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer transform hover:scale-[1.02]"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Tiếp tục</span>
            </button>
            <button
              type="button"
              data-testid="btn-dismiss-resume"
              onClick={handleDismissActiveSkillActivity}
              className="px-4 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-2xl text-xs sm:text-sm font-bold transition-all border border-slate-700 cursor-pointer"
            >
              <span>Bắt đầu bài khác</span>
            </button>
          </div>
        </div>
      )}

      {/* 2.8 LEARNING JOURNEY PROGRESSION MAP (A1 -> C2 ROADMAP) */}
      {!isLessonCurrentlyOpen && (
        <LearningJourneyProgressionMap
          onSelectLesson={handleSelectJourneyLesson}
          selectedMilestoneLevel={currentActiveMilestoneLevel}
          onSelectMilestoneLevel={handleSelectMilestoneLevel}
        />
      )}

      {/* --- PANEL A: LISTENING LAB (CATALOG GRID & DETAIL VIEW) --- */}
      {activeSkill === 'listening' && (
        <div className="space-y-6">
          
          {/* A1. LESSON CATALOG GRID (When no lesson is selected) */}
          {!selectedListenLesson ? (
            <div className="space-y-6 animate-fadeIn">
              {/* Filter Tabs */}
              <div className="flex flex-col gap-3.5 bg-slate-900/90 border border-slate-800 p-4 sm:p-5 rounded-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-cyan-400" />
                    <h2 className="text-base sm:text-lg font-black text-white">
                      Kho Bài Nghe Thực Tế ({filteredListeningLessons.length} bài)
                    </h2>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                    {availableListeningCategories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setListenCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                          listenCategoryFilter === cat
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-black'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {cat === 'ALL' ? 'Tất cả' : cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CEFR Level Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-3 border-t border-slate-800/80">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                    Trình độ CEFR:
                  </span>
                  {(['ALL', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setListenLevelFilter(lvl)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold whitespace-nowrap transition-all border ${
                        listenLevelFilter === lvl
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-black shadow-sm'
                          : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {lvl === 'ALL' ? 'Tất cả' : lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Catalog Grid */}
              {filteredListeningLessons.length === 0 ? (
                <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-10 text-center space-y-3">
                  <Layers className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-slate-400 font-bold text-sm">Không tìm thấy bài nghe nào phù hợp với bộ lọc hiện tại.</p>
                  <button
                    onClick={() => {
                      setListenCategoryFilter('ALL');
                      setListenLevelFilter('ALL');
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-cyan-400 rounded-xl text-xs font-bold transition-colors"
                  >
                    Đặt lại bộ lọc
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredListeningLessons.map((lesson) => {
                    const isCompleted = completedListenIds.includes(lesson.id);
                    return (
                      <div
                        key={lesson.id}
                        onClick={() => {
                          setSelectedListenLesson(lesson);
                          setListeningQuizAnswers({});
                          setListeningQuizSubmitted(false);
                          setAttemptState('in-progress');
                          currentAttemptIdRef.current = `${lesson.id}_${Date.now()}`;
                          setQuizSubmitWarning(null);
                        }}
                        className="group cursor-pointer bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/40 rounded-3xl p-5 sm:p-6 transition-all duration-300 flex flex-col justify-between shadow-xl relative overflow-hidden"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 rounded-md text-[11px] font-bold">
                                {lesson.category}
                              </span>
                              <span className="px-2 py-0.5 bg-slate-800 rounded-md text-[10px] text-slate-300 font-mono font-bold">
                                {lesson.level}
                              </span>
                            </div>

                            {isCompleted ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Đã xong</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-500">
                                ⏱ {lesson.duration} • {lesson.questions.length} câu hỏi
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-extrabold text-white group-hover:text-cyan-300 transition-colors line-clamp-2">
                            {lesson.title}
                          </h3>

                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {lesson.description}
                          </p>
                        </div>

                        <div className="mt-5 pt-3 border-t border-slate-850 flex items-center justify-between text-xs font-bold text-cyan-400">
                          <span>Luyện nghe ngay</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* A2. LESSON DETAIL VIEW */
            <div className="space-y-6 animate-fadeIn">
              
              {/* Back to Catalog Button */}
              <button
                onClick={() => {
                  setSelectedListenLesson(null);
                  setQuizSubmitWarning(null);
                  setAttemptState('in-progress');
                  setListeningQuizAnswers({});
                  setListeningQuizSubmitted(false);
                  isAudioBusyRef.current = false;
                  if (isPlayingAudio || isAudioStarting) {
                    window.speechSynthesis.cancel();
                    setIsPlayingAudio(false);
                    setIsAudioStarting(false);
                  }
                  syncControllerRef.current?.stop();
                  setHighlightState((prev) => ({
                    ...prev,
                    activeSentenceIndex: null,
                    activeWordIndex: null,
                  }));
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-2xl text-xs font-bold flex items-center gap-2 transition-all shadow-md group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform text-cyan-400" />
                <span>⬅ Quay lại danh sách bài nghe</span>
              </button>

              {/* BEFORE SESSION: Listening Intro */}
              <SessionIntro
                title={todayPlanMeta?.title || selectedListenLesson.title}
                subtitle={`${selectedListenLesson.category} • CEFR ${selectedListenLesson.level}`}
                badgeLabel={`Listening ${selectedListenLesson.level}`}
                estimatedDuration={
                  todayPlanMeta?.estimatedMinutes
                    ? formatSessionDurationBucket(todayPlanMeta.estimatedMinutes)
                    : `${selectedListenLesson.duration} audio`
                }
                objective={
                  todayPlanMeta?.objective ||
                  selectedListenLesson.description ||
                  'Luyện nghe phản xạ với audio chuẩn bản ngữ và highlight đồng bộ.'
                }
                sourceContext={sourceContext}
                resumeBanner={
                  (() => {
                    const act = resumeActivities[`listening_${selectedListenLesson.id}`];
                    const answered = Object.keys(listeningQuizAnswers).length;
                    const total = selectedListenLesson.questions.length;
                    if (act && !act.completed && attemptState !== 'completed' && answered > 0) {
                      return (
                        <div data-testid="listening-resume-banner" className="flex items-center justify-between p-3.5 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-xs">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                            <div>
                              <span className="font-bold text-white block">Tiếp tục bài học</span>
                              <span className="text-slate-300">
                                Đã làm {answered} / {total} câu{total - answered > 0 && ` (${total - answered} còn lại)`}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()
                }
                primaryAction={{
                  label: Object.keys(listeningQuizAnswers).length > 0 ? 'Tiếp tục bài nghe' : 'Bắt đầu nghe audio',
                  onClick: () => {
                    const el = document.getElementById('listening-audio-controller');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  },
                }}
              >
                <div className="text-xs text-slate-400 font-medium">
                  • {selectedListenLesson.questions.length} câu hỏi trắc nghiệm
                </div>
              </SessionIntro>

              {/* DURING SESSION: Listening Progress Header */}
              <SessionProgressHeader
                badgeLabel={`Listening ${selectedListenLesson.level}`}
                metric={{
                  kind: 'discrete_items',
                  currentIndex: 0,
                  totalItems: selectedListenLesson.questions.length,
                  answeredCount: Object.keys(listeningQuizAnswers).length,
                  remainingCount: Math.max(0, selectedListenLesson.questions.length - Object.keys(listeningQuizAnswers).length),
                  progressPercent: Math.round(
                    (Object.keys(listeningQuizAnswers).length / Math.max(1, selectedListenLesson.questions.length)) * 100
                  ),
                  counterFormat: 'answered',
                }}
                streakCount={listeningSessionStreak}
                rightSlot={
                  listeningMicroFeedback ? (
                    <SessionMicroFeedback feedback={listeningMicroFeedback} />
                  ) : null
                }
                onExit={() => {
                  setSelectedListenLesson(null);
                  setTodayPlanMeta(null);
                  setSourceContext(undefined);
                  setQuizSubmitWarning(null);
                  setAttemptState('in-progress');
                  setListeningQuizAnswers({});
                  setListeningQuizSubmitted(false);
                  isAudioBusyRef.current = false;
                  if (isPlayingAudio || isAudioStarting) {
                    window.speechSynthesis.cancel();
                    setIsPlayingAudio(false);
                    setIsAudioStarting(false);
                  }
                  syncControllerRef.current?.stop();
                  setHighlightState((prev) => ({
                    ...prev,
                    activeSentenceIndex: null,
                    activeWordIndex: null,
                  }));
                }}
              />

              {/* Audio Player & Controller */}
              <div id="listening-audio-controller" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 rounded-md text-xs font-bold">
                        {selectedListenLesson.category}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-800 rounded-md text-[10px] text-slate-300 font-mono font-bold">
                        {selectedListenLesson.level}
                      </span>
                      <span className="text-xs text-slate-500">• Thời lượng: {selectedListenLesson.duration} ({selectedListenLesson.questions.length} câu hỏi)</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <Headphones className="w-5 h-5 text-cyan-400" />
                      <span>Trình phát Audio & Luyện Nghe</span>
                    </h3>
                  </div>

                  {/* Audio Controls */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {[0.75, 1.0, 1.25].map((speed) => (
                      <button
                        key={speed}
                        disabled={isPlayingAudio || isAudioStarting}
                        onClick={() => {
                          setAudioSpeed(speed);
                          syncControllerRef.current?.setSpeed(speed);
                        }}
                        title={isPlayingAudio || isAudioStarting ? 'Dừng phát để thay đổi tốc độ' : undefined}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${
                          audioSpeed === speed
                            ? 'bg-cyan-400 text-slate-950 border-cyan-400 font-black'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        } ${isPlayingAudio || isAudioStarting ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {speed}x
                      </button>
                    ))}

                    <button
                      onClick={handlePlayListeningAudio}
                      className={`px-6 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all transform hover:scale-105 ${
                        isPlayingAudio
                          ? 'bg-rose-500 text-white shadow-rose-500/30 animate-pulse'
                          : 'bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 shadow-cyan-400/25'
                      }`}
                    >
                      {isPlayingAudio ? (
                        <>
                          <Pause className="w-4 h-4 fill-white" />
                          <span>Dừng Nghe</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-slate-950" />
                          <span>Nghe Bài Đọc</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Unified Playback Seek Bar */}
                <ListeningSeekBar
                  controller={syncControllerRef.current}
                  isPlaying={isPlayingAudio}
                  durationMs={syncMap?.totalEstimatedMs}
                  onSeek={handleSeek}
                  onSeekingChange={(seeking) => {
                    isSeekingRef.current = seeking;
                  }}
                  disabled={!selectedListenLesson}
                />

                {/* Interactive Transcript with Click-to-Translate & Mode Switcher */}
                <div ref={transcriptContainerRef} className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
                    <span className="font-bold uppercase tracking-wider text-slate-500">
                      💡 Nhấp vào bất kỳ từ nào để tra nghĩa & thêm vào Flashcard:
                    </span>
                    
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Highlight Mode Switcher (Sentence vs Word) */}
                      <div 
                        role="group"
                        aria-label="Chế độ tô sáng khi nghe"
                        className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]"
                      >
                        <span className="text-[10px] text-slate-500 font-bold px-1.5 uppercase tracking-wider">Highlight:</span>
                        <button
                          type="button"
                          aria-pressed={highlightMode === 'sentence'}
                          onClick={() => handleToggleHighlightMode('sentence')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all focus:outline-none focus:ring-1 focus:ring-cyan-400 ${
                            highlightMode === 'sentence'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                              : 'text-slate-400 hover:text-white border border-transparent'
                          }`}
                        >
                          Câu (Sentence)
                        </button>
                        <button
                          type="button"
                          aria-pressed={highlightMode === 'word'}
                          onClick={() => handleToggleHighlightMode('word')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all focus:outline-none focus:ring-1 focus:ring-amber-400 ${
                            highlightMode === 'word'
                              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-sm'
                              : 'text-slate-400 hover:text-white border border-transparent'
                          }`}
                        >
                          Từng từ (Word)
                        </button>
                      </div>

                      {/* Display Mode Switcher */}
                      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
                        <button
                          onClick={() => setListenDisplayMode('paragraph')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                            listenDisplayMode === 'paragraph'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          📄 Đoạn văn liền mạch
                        </button>
                        <button
                          onClick={() => setListenDisplayMode('dialogue')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                            listenDisplayMode === 'dialogue'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          💬 Từng câu thoại
                        </button>
                      </div>

                      <button
                        onClick={() => setShowListenVi(!showListenVi)}
                        className="flex items-center gap-1.5 text-cyan-400 hover:underline font-semibold"
                      >
                        {showListenVi ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-cyan-400" />}
                        <span>{showListenVi ? 'Ẩn dịch' : 'Hiện dịch'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Mode A: Standard Continuous Paragraph Layout (Segmented into readable paragraphs) */}
                  {listenDisplayMode === 'paragraph' ? (
                    <div className="p-6 sm:p-7 bg-slate-950/90 border border-slate-800 rounded-3xl space-y-6 shadow-inner">
                      <div className="space-y-5">
                        {transcriptBlocks.map((block) => (
                          <div key={block.id} className="space-y-2">
                            {block.speaker && (
                              <span className="text-[11px] font-black text-cyan-400 uppercase tracking-wider inline-flex items-center gap-1.5 mb-1 bg-cyan-950/50 px-2.5 py-0.5 rounded-md border border-cyan-800/40">
                                <span>🗣️</span> {block.speaker}:
                              </span>
                            )}
                            <p className="text-base sm:text-lg text-slate-100 font-normal leading-loose tracking-wide select-text">
                              {block.sentences.map(({ sentence: sent, globalSentenceIndex: sIdx }) => {
                                const isCurrentActive = activeSentenceIndex === sIdx;
                                return (
                                  <span
                                    key={sIdx}
                                    data-sentence-index={sIdx}
                                    className={`transition-all duration-300 rounded px-1 py-0.5 mr-1.5 inline ${
                                      isCurrentActive
                                        ? highlightMode === 'word'
                                          ? 'bg-cyan-500/10 text-slate-100 ring-1 ring-cyan-500/30'
                                          : 'bg-cyan-500/25 text-cyan-200 font-semibold shadow-sm ring-1 ring-cyan-400/50'
                                        : 'text-slate-200'
                                    }`}
                                  >
                                    {renderSentenceTokens(sent, sIdx, isCurrentActive)}
                                  </span>
                                );
                              })}
                            </p>

                            {showListenVi && (
                              <div className="pt-1.5 pb-1 text-xs sm:text-sm text-slate-400 font-sans leading-relaxed border-l-2 border-cyan-500/40 pl-3.5 bg-slate-900/30 rounded-r-lg animate-fadeIn">
                                {block.sentences.map((s) => s.sentence.vi).join(' ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Mode B: Dialogue Turn-by-Turn Layout */
                    <div className="space-y-4 p-5 bg-slate-950/80 border border-slate-800 rounded-2xl">
                      {transcriptBlocks.map((block) => {
                        const isBlockActive = block.sentences.some((s) => s.globalSentenceIndex === activeSentenceIndex);
                        return (
                          <div 
                            key={block.id} 
                            className={`p-4 rounded-2xl transition-all border ${
                              isBlockActive
                                ? 'bg-slate-900/90 border-cyan-500/40 shadow-md ring-1 ring-cyan-500/20'
                                : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700/80'
                            }`}
                          >
                            {block.speaker && (
                              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-800/60">
                                <span className="text-[11px] font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <span className="text-xs">🗣️</span> {block.speaker}:
                                </span>
                              </div>
                            )}
                            <div className="space-y-2.5">
                              {block.sentences.map(({ sentence: sent, globalSentenceIndex: sIdx }) => {
                                const isCurrentActive = activeSentenceIndex === sIdx;
                                return (
                                  <div
                                    key={sIdx}
                                    data-sentence-index={sIdx}
                                    className={`p-3 rounded-xl transition-all ${
                                      isCurrentActive
                                        ? highlightMode === 'word'
                                          ? 'bg-cyan-500/10 border border-cyan-500/30 ring-1 ring-cyan-400/20'
                                          : 'bg-cyan-500/15 border border-cyan-500/30 ring-1 ring-cyan-400/40'
                                        : 'bg-slate-900/50 border border-transparent'
                                    }`}
                                  >
                                    <p className="text-sm sm:text-base text-slate-100 font-medium leading-relaxed">
                                      {renderSentenceTokens(sent, sIdx, isCurrentActive)}
                                    </p>
                                    {showListenVi && (
                                      <p className="text-xs text-slate-400 pt-1.5 border-t border-slate-850 mt-1.5 font-sans">
                                        {sent.vi}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Comprehension Quiz (4-5 Questions) */}
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  {attemptState === 'completed' ? (
                    <ListeningResultSummary
                      result={listeningResult}
                      onReviewQuestions={() => setAttemptState('reviewing')}
                      onRetry={handleRetryListeningQuiz}
                      onNavigateToTodayHub={() => onNavigate?.('dashboard')}
                      onBackToCatalog={() => {
                        setSelectedListenLesson(null);
                        setTodayPlanMeta(null);
                        setSourceContext(undefined);
                        setQuizSubmitWarning(null);
                        setAttemptState('in-progress');
                        setListeningQuizAnswers({});
                        setListeningQuizSubmitted(false);
                        isAudioBusyRef.current = false;
                        if (isPlayingAudio || isAudioStarting) {
                          window.speechSynthesis.cancel();
                          setIsPlayingAudio(false);
                          setIsAudioStarting(false);
                        }
                        syncControllerRef.current?.stop();
                        setHighlightState((prev) => ({
                          ...prev,
                          activeSentenceIndex: null,
                          activeWordIndex: null,
                        }));
                      }}
                      onReplayAudio={() => {
                        if (!selectedListenLesson) return;
                        syncControllerRef.current?.seek(0);
                        setHighlightState((prev) => ({
                          ...prev,
                          activeSentenceIndex: 0,
                          activeWordIndex: null,
                        }));
                        handlePlayListeningAudio();
                      }}
                    />
                  ) : (
                    <>
                      <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-cyan-400" />
                        <span>Kiểm Tra Độ Hiểu Bài ({selectedListenLesson.questions.length} câu trắc nghiệm)</span>
                      </h3>

                      {attemptState === 'reviewing' && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900/90 border border-cyan-500/40 rounded-2xl">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                            <span className="text-xs sm:text-sm font-bold text-white">
                              Đang xem lại bài làm & giải thích chi tiết
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAttemptState('completed')}
                            className="px-3.5 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto"
                            data-testid="btn-back-to-summary"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Quay lại Bảng Tổng Kết (Summary)</span>
                          </button>
                        </div>
                      )}

                      <div className="space-y-4">
                        {selectedListenLesson.questions.map((q, qIdx) => {
                          const selectedOpt = listeningQuizAnswers[q.id];
                          return (
                            <div key={q.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                              <p className="text-xs sm:text-sm font-bold text-white">
                                {qIdx + 1}. {q.question}
                              </p>

                              <div className="space-y-2">
                                {q.options.map((opt, optIdx) => {
                                  const isPicked = selectedOpt === optIdx;
                                  const isCorrect = q.correctIndex === optIdx;
                                  return (
                                    <button
                                      key={optIdx}
                                      disabled={listeningQuizSubmitted}
                                      onClick={() => {
                                        setQuizSubmitWarning(null);
                                        const nextAnswers = { ...listeningQuizAnswers, [q.id]: optIdx };
                                        setListeningQuizAnswers(nextAnswers);
                                        if (selectedListenLesson) {
                                          const total = selectedListenLesson.questions.length;
                                          const answered = Object.keys(nextAnswers).length;
                                          if (listeningFeedbackTimerRef.current) clearTimeout(listeningFeedbackTimerRef.current);
                                          setListeningMicroFeedback({
                                            text: `Đã chọn đáp án câu ${qIdx + 1} (${answered}/${total})`,
                                            sentiment: 'info',
                                          });
                                          listeningFeedbackTimerRef.current = setTimeout(() => {
                                            setListeningMicroFeedback(null);
                                          }, 2000);
                                          upsertResumeActivity({
                                            id: `listening_${selectedListenLesson.id}`,
                                            type: 'listening',
                                            title: selectedListenLesson.title,
                                            startedAt: Date.now(),
                                            lastActiveAt: Date.now(),
                                            completed: false,
                                            schemaVersion: 1,
                                            checkpoint: {
                                              lessonId: selectedListenLesson.id,
                                              answers: nextAnswers,
                                              totalQuestions: total,
                                              progressPercent: Math.round((answered / Math.max(1, total)) * 100),
                                            },
                                          });
                                        }
                                      }}
                                      className={`w-full p-3 rounded-xl text-left text-xs font-semibold transition-all flex items-center justify-between border ${
                                        listeningQuizSubmitted
                                          ? isCorrect
                                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                                            : isPicked
                                            ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                                            : 'bg-slate-900 border-slate-800 text-slate-500'
                                          : isPicked
                                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                                      }`}
                                    >
                                      <span>{opt}</span>
                                      {listeningQuizSubmitted && isCorrect && <Check className="w-4 h-4 text-emerald-400" />}
                                    </button>
                                  );
                                })}
                              </div>

                              {listeningQuizSubmitted && (
                                <div className="space-y-2">
                                  <p className="text-xs text-slate-400 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                    💡 <strong className="text-cyan-300">Giải thích:</strong> {q.explanation}
                                  </p>
                                  {selectedOpt !== q.correctIndex && (() => {
                                    const targetRes = resolveListeningQuestionTarget(q, selectedListenLesson.title, vocabularyList);
                                    if (!targetRes.isVocabTarget) return null;

                                    return (
                                      <div className="flex items-center justify-between p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl">
                                        <span className="text-xs text-slate-300">
                                          Thêm từ vựng mục tiêu <strong className="text-cyan-300">"{targetRes.targetWord}"</strong> vào SRS:
                                        </span>
                                        {isQuestionInSRS(q) ? (
                                          <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                                            <Check className="w-3.5 h-3.5" /> Đã có trong SRS
                                          </span>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleSaveListeningQuestionToSRS(q)}
                                            className="text-xs font-bold text-cyan-300 hover:text-white flex items-center gap-1 bg-cyan-500/15 hover:bg-cyan-500/25 px-2.5 py-1 rounded-lg border border-cyan-500/30 transition-all"
                                          >
                                            <Plus className="w-3.5 h-3.5" /> Lưu vào SRS
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {quizSubmitWarning && (
                        <div
                          role="alert"
                          className="p-3.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn"
                        >
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>{quizSubmitWarning}</span>
                        </div>
                      )}

                      {attemptState === 'reviewing' ? (
                        <div className="flex items-center gap-3 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setAttemptState('completed')}
                            className="px-5 py-2.5 bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 hover:opacity-90 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all shadow-md"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Quay lại Bảng Tổng Kết</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleRetryListeningQuiz}
                            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-2xl text-xs font-bold flex items-center gap-2 transition-all border border-slate-700 shadow-md"
                            data-testid="btn-review-retry-quiz"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Làm lại bài kiểm tra</span>
                          </button>
                        </div>
                      ) : !listeningQuizSubmitted ? (
                        <button
                          onClick={handleSubmitListeningQuiz}
                          className="px-6 py-3 bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-lg shadow-cyan-400/20 transition-all hover:scale-105"
                        >
                          Nộp Bài Kiểm Tra (+30 XP)
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Đã hoàn thành kiểm tra độ hiểu bài!</span>
                          </div>
                          <button
                            type="button"
                            onClick={handleRetryListeningQuiz}
                            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-2xl text-xs font-bold flex items-center gap-2 transition-all border border-slate-700 shadow-md"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Làm lại bài kiểm tra</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- PANEL B: READING COMPREHENSION (CATALOG GRID & DETAIL VIEW) --- */}
      {activeSkill === 'reading' && (
        <div className="space-y-6">
          
          {/* B1. READING CATALOG GRID (When no article is selected) */}
          {!selectedReadLesson ? (
            <div className="space-y-6 animate-fadeIn">
              {/* Filter Tabs */}
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-base sm:text-lg font-black text-white">
                      Kho Bài Đọc Chuyên Sâu ({filteredReadingLessons.length} bài)
                    </h2>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                    {['ALL', 'Daily Life', 'Education', 'Culture & Society', 'Environment', 'Workplace Culture', 'Science & Habit', 'Tech & AI', 'Career & Business'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setReadCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                          readCategoryFilter === cat
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-black'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {cat === 'ALL' ? 'Tất cả chủ đề' : cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CEFR Level Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-3 border-t border-slate-800/80">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                    Trình độ CEFR:
                  </span>
                  {(['ALL', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setReadLevelFilter(lvl)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold whitespace-nowrap transition-all border ${
                        readLevelFilter === lvl
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-black shadow-sm'
                          : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {lvl === 'ALL' ? 'Tất cả cấp độ' : lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Catalog Grid */}
              {filteredReadingLessons.length === 0 ? (
                <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-10 text-center space-y-3">
                  <Layers className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-slate-400 font-bold text-sm">Không tìm thấy bài đọc nào phù hợp với bộ lọc hiện tại.</p>
                  <button
                    onClick={() => {
                      setReadCategoryFilter('ALL');
                      setReadLevelFilter('ALL');
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-emerald-400 rounded-xl text-xs font-bold transition-colors"
                  >
                    Đặt lại bộ lọc
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredReadingLessons.map((article) => {
                  const isCompleted = completedReadIds.includes(article.id);
                  return (
                    <div
                      key={article.id}
                      onClick={() => {
                        setSelectedReadLesson(article);
                        // New attempt-scoped ID: lessonId + timestamp ensures each fresh open
                        // of the same lesson generates a distinct activityId for telemetry.
                        setReadingAttemptId(`reading_lesson_${article.id}_${Date.now()}`);
                        setReadingQuizAnswers({});
                        setReadingQuizSubmitted(false);
                        upsertResumeActivity({
                          id: `reading_${article.id}`,
                          type: 'reading',
                          title: article.title,
                          startedAt: Date.now(),
                          lastActiveAt: Date.now(),
                          completed: false,
                          schemaVersion: 1,
                          checkpoint: {
                            lessonId: article.id,
                            answers: {},
                            totalQuestions: article.questions.length,
                            progressPercent: 0,
                          },
                        });
                      }}
                      className="group cursor-pointer bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-5 sm:p-6 transition-all duration-300 flex flex-col justify-between shadow-xl relative overflow-hidden"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-md text-[11px] font-bold">
                              {article.category}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-800 rounded-md text-[10px] text-slate-300 font-mono font-bold">
                              {article.level}
                            </span>
                          </div>

                          {isCompleted ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Đã xong</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-500">
                              📖 {article.readTime} • {article.questions.length} câu hỏi
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors line-clamp-2">
                          {article.title}
                        </h3>

                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {article.summary}
                        </p>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-850 flex items-center justify-between text-xs font-bold text-emerald-400">
                        <span>Đọc bài & Tra từ</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          ) : (
            /* B2. ARTICLE DETAIL VIEW */
            <div className="space-y-6 animate-fadeIn">
              
              {/* Back to Catalog Button */}
              <button
                onClick={() => {
                  setSelectedReadLesson(null);
                  setTodayPlanMeta(null);
                  setSourceContext(undefined);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-2xl text-xs font-bold flex items-center gap-2 transition-all shadow-md group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform text-emerald-400" />
                <span>⬅ Quay lại danh sách bài đọc</span>
              </button>

              {/* BEFORE SESSION: Reading Intro */}
              <SessionIntro
                title={todayPlanMeta?.title || selectedReadLesson.title}
                subtitle={`${selectedReadLesson.category} • CEFR ${selectedReadLesson.level}`}
                badgeLabel={`Reading ${selectedReadLesson.level}`}
                estimatedDuration={
                  todayPlanMeta?.estimatedMinutes
                    ? formatSessionDurationBucket(todayPlanMeta.estimatedMinutes)
                    : selectedReadLesson.readTime
                }
                objective={
                  todayPlanMeta?.objective ||
                  selectedReadLesson.summary ||
                  'Đọc hiểu tương tác và trích xuất từ vựng theo ngữ cảnh.'
                }
                sourceContext={sourceContext}
                resumeBanner={
                  (() => {
                    const act = resumeActivities[`reading_${selectedReadLesson.id}`];
                    const answered = Object.keys(readingQuizAnswers).length;
                    const total = selectedReadLesson.questions.length;
                    if (act && !act.completed && !readingQuizSubmitted && answered > 0) {
                      return (
                        <div data-testid="reading-resume-banner" className="flex items-center justify-between p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div>
                              <span className="font-bold text-white block">Tiếp tục bài học</span>
                              <span className="text-slate-300">
                                Đã làm {answered} / {total} câu{total - answered > 0 && ` (${total - answered} còn lại)`}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()
                }
                primaryAction={{
                  label: Object.keys(readingQuizAnswers).length > 0 ? 'Tiếp tục bài đọc' : 'Bắt đầu đọc hiểu',
                  onClick: () => {
                    const el = document.getElementById('reading-passage-container');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  },
                }}
              >
                <div className="text-xs text-slate-400 font-medium">
                  • {selectedReadLesson.questions.length} câu trắc nghiệm ({selectedReadLesson.wordCount} từ)
                </div>
              </SessionIntro>

              {/* DURING SESSION: Reading Progress Header */}
              <SessionProgressHeader
                badgeLabel={`Reading ${selectedReadLesson.level}`}
                metric={{
                  kind: 'discrete_items',
                  currentIndex: 0,
                  totalItems: selectedReadLesson.questions.length,
                  answeredCount: Object.keys(readingQuizAnswers).length,
                  remainingCount: Math.max(0, selectedReadLesson.questions.length - Object.keys(readingQuizAnswers).length),
                  progressPercent: Math.round(
                    (Object.keys(readingQuizAnswers).length / Math.max(1, selectedReadLesson.questions.length)) * 100
                  ),
                  counterFormat: 'answered',
                }}
                streakCount={readingSessionStreak}
                rightSlot={
                  readingMicroFeedback ? (
                    <SessionMicroFeedback feedback={readingMicroFeedback} />
                  ) : null
                }
                onExit={() => {
                  setSelectedReadLesson(null);
                  setTodayPlanMeta(null);
                  setSourceContext(undefined);
                }}
              />

              <div id="reading-passage-container" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-emerald-400" />
                    <span>Nội Dung Bài Đọc</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    {selectedReadLesson.wordCount} từ
                  </span>
                </div>

                {/* Reading Article Body: Interactive Reading Passage with Click-to-Lookup Popover */}
                <div className="p-6 sm:p-8 bg-slate-950/90 border border-slate-800 rounded-3xl shadow-inner text-slate-100 space-y-4">
                  <div className="flex items-center gap-2.5 p-3.5 bg-emerald-950/50 border border-emerald-800/60 rounded-2xl text-emerald-300 text-xs sm:text-sm font-medium">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>💡 Chạm vào bất kỳ từ vựng nào để tra nghĩa tức thì và lưu vào Flashcard SRS</span>
                  </div>

                  <InteractiveReadingPassage
                    content={selectedReadLesson.content.join('\n\n')}
                    className="text-base sm:text-lg leading-loose tracking-wide text-slate-200"
                  />
                </div>

                {/* Key Vocabulary Highlights */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>Từ vựng trọng tâm trong bài:</span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedReadLesson.keyVocab.map((kv, idx) => (
                      <div 
                        key={idx}
                        onClick={() => handleWordClick(kv.word)}
                        className="p-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl cursor-pointer transition-all flex items-center justify-between"
                      >
                        <div>
                          <strong className="text-white text-xs block">{kv.word}</strong>
                          <span className="text-[11px] text-slate-400">{kv.meaning}</span>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-mono">{kv.ipa}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reading Quiz (4-5 Questions) */}
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-emerald-400" />
                    <span>Câu Hỏi Đọc Hiểu ({selectedReadLesson.questions.length} câu trắc nghiệm)</span>
                  </h3>

                  <div className="space-y-4">
                    {selectedReadLesson.questions.map((q, qIdx) => {
                      const selectedOpt = readingQuizAnswers[q.id];
                      return (
                        <div key={q.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                          <p className="text-xs sm:text-sm font-bold text-white">
                            {qIdx + 1}. {q.question}
                          </p>

                          <div className="space-y-2">
                            {q.options.map((opt, optIdx) => {
                              const isPicked = selectedOpt === optIdx;
                              const isCorrect = q.correctIndex === optIdx;
                              return (
                                <button
                                  key={optIdx}
                                  disabled={readingQuizSubmitted}
                                  onClick={() => {
                                    const nextAnswers = { ...readingQuizAnswers, [q.id]: optIdx };
                                    setReadingQuizAnswers(nextAnswers);
                                    if (selectedReadLesson) {
                                      const total = selectedReadLesson.questions.length;
                                      const answered = Object.keys(nextAnswers).length;
                                      if (readingFeedbackTimerRef.current) clearTimeout(readingFeedbackTimerRef.current);
                                      setReadingMicroFeedback({
                                        text: `Đã chọn đáp án câu ${qIdx + 1} (${answered}/${total})`,
                                        sentiment: 'info',
                                      });
                                      readingFeedbackTimerRef.current = setTimeout(() => {
                                        setReadingMicroFeedback(null);
                                      }, 2000);
                                      upsertResumeActivity({
                                        id: `reading_${selectedReadLesson.id}`,
                                        type: 'reading',
                                        title: selectedReadLesson.title,
                                        startedAt: Date.now(),
                                        lastActiveAt: Date.now(),
                                        completed: false,
                                        schemaVersion: 1,
                                        checkpoint: {
                                          lessonId: selectedReadLesson.id,
                                          answers: nextAnswers,
                                          totalQuestions: total,
                                          progressPercent: Math.round((answered / Math.max(1, total)) * 100),
                                        },
                                      });
                                    }
                                  }}
                                  className={`w-full p-3 rounded-xl text-left text-xs font-semibold transition-all flex items-center justify-between border ${
                                    readingQuizSubmitted
                                      ? isCorrect
                                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                                        : isPicked
                                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                                        : 'bg-slate-900 border-slate-800 text-slate-500'
                                      : isPicked
                                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                                  }`}
                                >
                                  <span>{opt}</span>
                                  {readingQuizSubmitted && isCorrect && <Check className="w-4 h-4 text-emerald-400" />}
                                </button>
                              );
                            })}
                          </div>

                          {readingQuizSubmitted && (
                            <p className="text-xs text-slate-400 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                              💡 <strong className="text-emerald-300">Giải thích:</strong> {q.explanation}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {!readingQuizSubmitted ? (
                    <button
                      onClick={handleSubmitReadingQuiz}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-lg shadow-emerald-400/20 transition-all hover:scale-105"
                    >
                      Nộp Bài Đọc Hiểu (+30 XP)
                    </button>
                  ) : (
                    <div className="space-y-6">
                      <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Bạn đã hoàn thành bài tập đọc hiểu xuất sắc!</span>
                      </div>

                      {/* AFTER SESSION: Reading Complete Summary */}
                      <SessionCompleteSummary
                        title={`Hoàn Thành: ${selectedReadLesson.title}`}
                        subtitle={`Chủ đề ${selectedReadLesson.category} • CEFR ${selectedReadLesson.level}`}
                        scoreText={`${Math.round(
                          (selectedReadLesson.questions.filter((q) => readingQuizAnswers[q.id] === q.correctIndex).length /
                            Math.max(1, selectedReadLesson.questions.length)) *
                            100
                        )}%`}
                        scoreSubtext={`Chính xác (${
                          selectedReadLesson.questions.filter((q) => readingQuizAnswers[q.id] === q.correctIndex).length
                        }/${selectedReadLesson.questions.length} câu)`}
                        xpEarned={
                          selectedReadLesson.questions.filter((q) => readingQuizAnswers[q.id] === q.correctIndex).length * 15
                        }
                        itemsCompletedCount={selectedReadLesson.questions.length}
                        itemsCompletedLabel="Số câu trắc nghiệm"
                        accuracyRate={Math.round(
                          (selectedReadLesson.questions.filter((q) => readingQuizAnswers[q.id] === q.correctIndex).length /
                            Math.max(1, selectedReadLesson.questions.length)) *
                            100
                        )}
                        breakdownSlot={
                          selectedReadLesson.keyVocab.length > 0 ? (
                            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs text-slate-300">
                              <span>Từ vựng trọng tâm trong bài: </span>
                              <strong className="text-emerald-400 font-bold">
                                {selectedReadLesson.keyVocab.length} từ
                              </strong>
                            </div>
                          ) : undefined
                        }
                        actions={(() => {
                          const incorrectCount = selectedReadLesson.questions.filter((q) => readingQuizAnswers[q.id] !== q.correctIndex).length;
                          const scorePercent = Math.round(
                            ((selectedReadLesson.questions.length - incorrectCount) /
                              Math.max(1, selectedReadLesson.questions.length)) *
                              100
                          );
                          const plan = deriveTodayLearningPlanFromStore(useAppStore.getState());
                          const resolved = resolveNextBestActions(
                            {
                              flowType: 'reading',
                              reading: {
                                lessonId: selectedReadLesson.id,
                                incorrectQuestionCount: incorrectCount,
                                scorePercent,
                              },
                              currentPlanItemId: todayPlanMeta?.planItemId,
                            },
                            {
                              navigateToTab: (tab) => (onNavigate ? onNavigate(tab) : useAppStore.getState().navigateToTab(tab)),
                              startAdaptivePractice,
                              setActiveFourSkill,
                              onCustomRetry: () => {
                                setReadingQuizSubmitted(false);
                                setReadingQuizAnswers({});
                                setReadingSessionStreak(0);
                                setReadingAttemptId(`read_${selectedReadLesson.id}_${Date.now()}`);
                              },
                              onCustomCatalog: () => {
                                setSelectedReadLesson(null);
                                setReadingQuizSubmitted(false);
                                setReadingQuizAnswers({});
                                setTodayPlanMeta(null);
                                setSourceContext(undefined);
                              },
                            },
                            plan
                          );
                          return [resolved.primaryAction, ...(resolved.secondaryAction ? [resolved.secondaryAction] : [])];
                        })()}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- PANEL C: MULTI-TURN SPEAKING STUDIO (SMART SHADOWING & ROLEPLAY) --- */}
      {activeSkill === 'speaking' && (
        <div className="space-y-6">
          {/* Speaking Sub-Mode Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-xl">
            <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setSpeakingSubMode('shadowing')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  speakingSubMode === 'shadowing'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4 text-purple-300" />
                <span>Smart Shadowing (Teleprompter AI)</span>
              </button>
              <button
                type="button"
                onClick={() => setSpeakingSubMode('roleplay')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  speakingSubMode === 'roleplay'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-4 h-4 text-purple-300" />
                <span>Hội Thoại Roleplay ({filteredSpeakingPrompts.length} chủ đề)</span>
              </button>
            </div>
            
            <div className="text-xs text-slate-400 px-3 font-medium">
              {speakingSubMode === 'shadowing' ? '🎯 So khớp từ vựng thời gian thực' : '💬 Đối đáp tình huống giao tiếp'}
            </div>
          </div>

          {/* PRONUNCIATION PRACTICE QUEUE (Derived directly from Mistake Bank) */}
          {pronunciationQueue.length > 0 && (
            <div className="p-5 bg-gradient-to-r from-purple-950/40 via-slate-900 to-indigo-950/40 border border-purple-500/30 rounded-3xl space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-500/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
                    <Mic className="w-4 h-4 text-purple-300" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                      <span>Hàng Đợi Luyện Phát Âm Cần Khắc Phục</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-purple-500/25 text-purple-300 border border-purple-500/40">
                        {pronunciationQueue.length} từ
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Tự động trích xuất từ các lỗi phát âm chưa đạt trong Mistake Bank. Ưu tiên từ sai nhiều lần.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pronunciationQueue.slice(0, 6).map((item) => {
                  const badgeColor =
                    item.recurrenceLevel === 'chronic'
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                      : item.recurrenceLevel === 'recurrent'
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300';
                  const badgeText =
                    item.recurrenceLevel === 'chronic'
                      ? 'Kinh niên'
                      : item.recurrenceLevel === 'recurrent'
                      ? 'Lặp lại'
                      : 'Mới phát sinh';

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 bg-slate-950/80 border border-slate-800 hover:border-purple-500/40 rounded-2xl flex flex-col justify-between gap-3 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-extrabold text-white">{item.word}</span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeColor}`}>
                            {badgeText} ({item.mistakeCount}x)
                          </span>
                        </div>
                        {item.ipa && <p className="text-xs font-mono text-purple-300">{item.ipa}</p>}
                        {item.meaning && <p className="text-xs text-slate-400 line-clamp-1">{item.meaning}</p>}
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePracticeQueueItem(item.id)}
                        className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-purple-600/20"
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>Practice now</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {speakingSubMode === 'shadowing' ? (
            <SmartShadowingView />
          ) : (
            <>
              {/* C1. SPEAKING TOPIC CATALOG GRID */}
              {!selectedSpeakingPrompt ? (
            <div className="space-y-6 animate-fadeIn">
              {/* Filter Tabs */}
              <div className="flex flex-col gap-3.5 bg-slate-900/90 border border-slate-800 p-4 sm:p-5 rounded-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-purple-400" />
                    <h2 className="text-base sm:text-lg font-black text-white">
                      Kho Hội Thoại Đa Lượt Roleplay ({filteredSpeakingPrompts.length} chủ đề)
                    </h2>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                    {availableSpeakingCategories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSpeakingCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                          speakingCategoryFilter === cat
                            ? 'bg-purple-500/20 border-purple-400 text-purple-300 font-black'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {cat === 'ALL' ? 'Tất cả' : cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CEFR Level Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-3 border-t border-slate-800/80">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                    Trình độ CEFR:
                  </span>
                  {(['ALL', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setSpeakingLevelFilter(lvl)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold whitespace-nowrap transition-all border ${
                        speakingLevelFilter === lvl
                          ? 'bg-purple-500/25 border-purple-400 text-purple-300 font-black shadow-sm'
                          : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {lvl === 'ALL' ? 'Tất cả' : lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Catalog Grid or Empty State */}
              {filteredSpeakingPrompts.length === 0 ? (
                <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-10 text-center space-y-3">
                  <Layers className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-slate-400 font-bold text-sm">Không tìm thấy bài nói nào phù hợp với bộ lọc hiện tại.</p>
                  <button
                    onClick={() => {
                      setSpeakingCategoryFilter('ALL');
                      setSpeakingLevelFilter('ALL');
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-purple-400 rounded-xl text-xs font-bold transition-colors"
                  >
                    Đặt lại bộ lọc
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSpeakingPrompts.map((prompt) => {
                  const isCompleted = completedSpeakingIds.includes(prompt.id);
                  return (
                    <div
                      key={prompt.id}
                      onClick={() => handleSelectSpeakingPrompt(prompt)}
                      className="group cursor-pointer bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-purple-500/40 rounded-3xl p-5 sm:p-6 transition-all duration-300 flex flex-col justify-between shadow-xl relative overflow-hidden"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 bg-purple-500/15 border border-purple-500/30 text-purple-400 rounded-md text-[11px] font-bold">
                              {prompt.category}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-800 rounded-md text-[10px] text-purple-300 font-mono font-bold">
                              {prompt.level}
                            </span>
                            {prompt.suggestedDuration && (
                              <span className="px-2 py-0.5 bg-purple-950/60 border border-purple-500/30 rounded-md text-[10px] text-purple-300 font-mono font-bold">
                                ⏱️ {prompt.suggestedDuration}
                              </span>
                            )}
                          </div>

                          {isCompleted ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Đã luyện</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                              💬 {prompt.turns.length} lượt đối thoại
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-extrabold text-white group-hover:text-purple-300 transition-colors line-clamp-2">
                          {prompt.title}
                        </h3>

                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {prompt.scenario}
                        </p>

                        <div className="p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-xl">
                          <span className="text-[10px] font-bold text-purple-400 uppercase block mb-0.5">Đối tác mở đầu:</span>
                          <p className="text-xs text-slate-300 italic line-clamp-1">"{prompt.turns[0]?.partnerPrompt}"</p>
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-850 flex items-center justify-between text-xs font-bold text-purple-400">
                        <span>Bắt đầu hội thoại</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          ) : (
            /* C2. MULTI-TURN SPEAKING PRACTICE / SUMMARY VIEW */
            <div className="space-y-6 animate-fadeIn">
              
              {/* Back to Catalog Button */}
              <button
                onClick={() => {
                  setSelectedSpeakingPrompt(null);
                  if (isRecordingSpeaking && recognitionRef.current) {
                    recognitionRef.current.stop();
                    setIsRecordingSpeaking(false);
                  }
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-2xl text-xs font-bold flex items-center gap-2 transition-all shadow-md group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform text-purple-400" />
                <span>⬅ Quay lại danh sách chủ đề nói</span>
              </button>

              {/* Browser Speech API Warning Banner */}
              {!isSpeechSupported && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 text-amber-300 text-xs sm:text-sm shadow-lg">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-left space-y-1">
                    <p className="font-bold">Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói.</p>
                    <p className="text-slate-300 leading-relaxed">
                      Để luyện nói và chấm điểm phát âm chính xác, vui lòng mở ứng dụng trên <strong>Google Chrome</strong> hoặc <strong>Microsoft Edge</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* Permission Denied Guide Banner */}
              {speakingPermissionDenied && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-2xl text-xs sm:text-sm text-left flex items-start gap-3 shadow-lg">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Quyền truy cập Microphone bị từ chối.</p>
                    <p className="text-slate-300 leading-relaxed">
                      Bấm vào <strong>biểu tượng ổ khóa 🔒 / quyền trang web</strong> trên thanh URL của trình duyệt để gạt bật lại Micro, sau đó tải lại trang hoặc bấm thử lại.
                    </p>
                  </div>
                </div>
              )}

              {/* BEFORE SESSION: Speaking Intro */}
              <SessionIntro
                title={todayPlanMeta?.title || selectedSpeakingPrompt.title}
                subtitle={`${selectedSpeakingPrompt.category} • CEFR ${selectedSpeakingPrompt.level}`}
                badgeLabel={`Speaking ${selectedSpeakingPrompt.level}`}
                estimatedDuration={
                  todayPlanMeta?.estimatedMinutes
                    ? formatSessionDurationBucket(todayPlanMeta.estimatedMinutes)
                    : selectedSpeakingPrompt.suggestedDuration
                }
                objective={
                  todayPlanMeta?.objective ||
                  (selectedSpeakingPrompt.talkingPoints?.length
                    ? `Luyện tập: ${selectedSpeakingPrompt.talkingPoints[0]}`
                    : 'Hội thoại nhập vai nhiều lượt phản xạ tự nhiên.')
                }
                sourceContext={sourceContext}
                resumeBanner={
                  (() => {
                    const act = resumeActivities[`speaking_${selectedSpeakingPrompt.id}`];
                    const currentTurn = currentSpeakingTurnIndex;
                    const totalTurns = selectedSpeakingPrompt.turns.length;
                    if (act && !act.completed && !isSpeakingFinished && currentTurn > 0) {
                      return (
                        <div data-testid="speaking-resume-banner" className="flex items-center justify-between p-3.5 bg-purple-500/10 border border-purple-500/30 rounded-2xl text-xs">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                            <div>
                              <span className="font-bold text-white block">Tiếp tục bài nói</span>
                              <span className="text-slate-300">
                                Đã hoàn thành {currentTurn} / {totalTurns} lượt ({totalTurns - currentTurn} lượt còn lại)
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()
                }
                primaryAction={{
                  label: currentSpeakingTurnIndex > 0 ? 'Tiếp tục bài nói' : 'Bắt đầu hội thoại',
                  onClick: () => {
                    const el = document.getElementById('speaking-turn-container');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  },
                }}
              >
                <div className="text-xs text-slate-400 font-medium">
                  • {selectedSpeakingPrompt.turns.length} lượt đối thoại ({selectedSpeakingPrompt.scenario})
                </div>
              </SessionIntro>

              {/* DURING SESSION: Speaking Progress Header */}
              {!isSpeakingFinished && (
                <SessionProgressHeader
                  badgeLabel={`Speaking ${selectedSpeakingPrompt.level}`}
                  metric={{
                    kind: 'discrete_items',
                    currentIndex: currentSpeakingTurnIndex,
                    totalItems: selectedSpeakingPrompt.turns.length,
                    answeredCount: currentSpeakingTurnIndex,
                    remainingCount: Math.max(0, selectedSpeakingPrompt.turns.length - currentSpeakingTurnIndex),
                    progressPercent: Math.round(
                      (currentSpeakingTurnIndex / Math.max(1, selectedSpeakingPrompt.turns.length)) * 100
                    ),
                    counterFormat: 'answered',
                  }}
                  streakCount={speakingSessionStreak}
                  rightSlot={
                    speakingMicroFeedback ? (
                      <SessionMicroFeedback feedback={speakingMicroFeedback} />
                    ) : null
                  }
                  onExit={() => {
                    setSelectedSpeakingPrompt(null);
                    setCurrentSpeakingTurnIndex(0);
                    setSpeakingTurnScores({});
                    setIsSpeakingFinished(false);
                    setTodayPlanMeta(null);
                    setSourceContext(undefined);
                    if (recognitionRef.current) {
                      try {
                        recognitionRef.current.abort();
                      } catch {}
                      recognitionRef.current = null;
                    }
                    setIsRecordingSpeaking(false);
                  }}
                />
              )}

              {/* View 1: ACTIVE DIALOGUE TURN IN PROGRESS */}
              {!isSpeakingFinished ? (
                <div id="speaking-turn-container" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                  
                  {/* Turn Progress Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 bg-purple-500/15 border border-purple-500/30 text-purple-400 rounded-md text-xs font-bold">
                          {selectedSpeakingPrompt.category}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-800 rounded-md text-[10px] text-purple-300 font-mono font-bold">
                          {selectedSpeakingPrompt.level}
                        </span>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-white">Lượt Đối Thoại Roleplay</h3>
                      <p className="text-xs sm:text-sm text-slate-400">{selectedSpeakingPrompt.scenario}</p>
                      {selectedSpeakingPrompt.talkingPoints && selectedSpeakingPrompt.talkingPoints.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-2">
                          <span className="text-[11px] font-bold text-purple-400">💡 Gợi ý thảo luận:</span>
                          {selectedSpeakingPrompt.talkingPoints.map((tp, tpIdx) => (
                            <span key={tpIdx} className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/25 text-purple-300 rounded-md text-[11px]">
                              • {tp}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Step Tracker Indicator */}
                    <div className="flex items-center gap-1.5 bg-slate-950 p-2 rounded-2xl border border-slate-800 shrink-0">
                      {selectedSpeakingPrompt.turns.map((t, idx) => {
                        const isDone = speakingTurnScores[idx] !== undefined;
                        const isCurrent = currentSpeakingTurnIndex === idx;
                        return (
                          <div
                            key={idx}
                            className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs transition-all ${
                              isCurrent
                                ? 'bg-purple-500 text-white shadow-md shadow-purple-500/40 ring-2 ring-purple-400'
                                : isDone
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : 'bg-slate-900 text-slate-500'
                            }`}
                          >
                            {idx + 1}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Partner Speech Bubble */}
                  {selectedSpeakingPrompt.turns[currentSpeakingTurnIndex] && (
                    <div className="p-4 sm:p-5 bg-slate-950 border border-slate-800 rounded-3xl flex items-start gap-3 shadow-inner">
                      <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[11px] font-black text-purple-400 uppercase tracking-wider">
                            Đối tác hội thoại (Partner) • Lượt {currentSpeakingTurnIndex + 1}/{selectedSpeakingPrompt.turns.length}:
                          </span>
                          <button
                            onClick={() => speakWord(selectedSpeakingPrompt.turns[currentSpeakingTurnIndex].partnerPrompt)}
                            title="Nghe đối tác nói"
                            className="p-1.5 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 rounded-xl transition-colors"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm sm:text-base font-semibold text-slate-100 leading-relaxed">
                          {selectedSpeakingPrompt.turns[currentSpeakingTurnIndex].partnerPrompt}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* User Target Response Box */}
                  {selectedSpeakingPrompt.turns[currentSpeakingTurnIndex] && (
                    <div className="p-6 bg-gradient-to-br from-purple-950/30 to-slate-950 border-2 border-purple-500/30 rounded-3xl space-y-3 text-center">
                      <span className="text-xs font-black text-purple-400 uppercase tracking-wider block">
                        🎯 Câu Bạn Cần Phản Hồi (Target Response):
                      </span>
                      <p className="text-base sm:text-xl font-black text-white leading-relaxed">
                        "{selectedSpeakingPrompt.turns[currentSpeakingTurnIndex].targetSentence}"
                      </p>
                      <p className="text-xs font-mono text-purple-300">
                        {selectedSpeakingPrompt.turns[currentSpeakingTurnIndex].phonetic}
                      </p>
                      <p className="text-xs text-slate-400 italic pt-1">
                        🇻🇳 Nghĩa: {selectedSpeakingPrompt.turns[currentSpeakingTurnIndex].meaningVi}
                      </p>

                      {/* Sample Audio Button */}
                      <div className="pt-2 flex justify-center">
                        <button
                          onClick={() => speakWord(selectedSpeakingPrompt.turns[currentSpeakingTurnIndex].sampleAudioText)}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                        >
                          <Volume2 className="w-4 h-4" />
                          <span>Nghe Phát Âm Mẫu</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Micro Recording Button & Feedback */}
                  <div className="pt-2 flex flex-col items-center gap-4 text-center">
                    <button
                      onClick={handleToggleSpeakingRecord}
                      disabled={!isSpeechSupported}
                      aria-label={
                        !isSpeechSupported
                          ? 'Trình duyệt chưa hỗ trợ nhận diện giọng nói'
                          : isRecordingSpeaking
                          ? 'Dừng ghi âm hội thoại'
                          : 'Bắt đầu ghi âm hội thoại'
                      }
                      title={!isSpeechSupported ? 'Trình duyệt chưa hỗ trợ nhận diện giọng nói' : undefined}
                      className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all ${
                        !isSpeechSupported
                          ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50 shadow-none'
                          : isRecordingSpeaking
                          ? 'bg-rose-500 text-white shadow-rose-500/50 animate-bounce transform hover:scale-110 active:scale-95'
                          : 'bg-gradient-to-tr from-purple-500 to-pink-500 text-white shadow-purple-500/30 transform hover:scale-110 active:scale-95'
                      }`}
                    >
                      <Mic className="w-8 h-8" />
                    </button>

                    <span 
                      aria-live="polite"
                      className="text-xs font-bold text-slate-400"
                    >
                      {!isSpeechSupported
                        ? '⚠️ Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói. Hãy mở trên Chrome hoặc Edge.'
                        : isRecordingSpeaking 
                        ? '🔴 Đang nghe bạn nói... (Bấm lại để dừng)' 
                        : 'Bấm micro và đọc to câu phản hồi'}
                    </span>

                    {/* Live Transcript & Feedback */}
                    {speakingTranscript && (
                      <div className="w-full max-w-xl p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 animate-fadeIn text-left max-h-60 overflow-y-auto break-words">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-400">Kết quả lượt này:</span>
                          {speakingScore !== null && (
                            <span className={`text-sm font-black px-3 py-1 rounded-full ${
                              speakingScore >= 80 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            }`}>
                              Độ chính xác: {speakingScore}%
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-medium text-white italic">
                          "{speakingTranscript}"
                        </p>

                        {speakingFeedback && (
                          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-xs text-purple-300 font-semibold">
                            {speakingFeedback}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Next Turn / Retry / Finish Button */}
                    {speakingTurnScores[currentSpeakingTurnIndex] !== undefined && (
                      <div className="pt-3 animate-fadeIn flex flex-wrap items-center justify-center gap-3">
                        <button
                          onClick={handleRetrySpeakingTurn}
                          className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded-2xl text-xs sm:text-sm transition-all flex items-center gap-2"
                        >
                          <RotateCcw className="w-4 h-4 text-purple-400" />
                          <span>Thử Lại Lượt Này</span>
                        </button>

                        <button
                          onClick={handleNextSpeakingTurn}
                          className="px-8 py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-black rounded-2xl text-xs sm:text-sm shadow-xl shadow-purple-500/25 transition-all flex items-center gap-2 transform hover:scale-105"
                        >
                          {currentSpeakingTurnIndex < selectedSpeakingPrompt.turns.length - 1 ? (
                            <>
                              <span>Chuyển Sang Lượt Tiếp Theo</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          ) : (
                            <>
                              <Trophy className="w-4 h-4 text-amber-300" />
                              <span>Xem Bảng Tổng Kết Đánh Giá</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                /* View 2: OVERALL EVALUATION SUMMARY REPORT SCREEN */
                <div className="bg-slate-900 border-2 border-purple-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-fadeIn">
                  
                  {/* Top Trophy Banner */}
                  <div className="text-center space-y-2 border-b border-slate-800 pb-6">
                    <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-purple-500 to-pink-500 text-white flex items-center justify-center mx-auto shadow-xl shadow-purple-500/30">
                      <Trophy className="w-8 h-8 text-amber-200" />
                    </div>
                    <h3 className="text-2xl font-black text-white">Tổng Kết Phiên Hội Thoại Roleplay</h3>
                    <p className="text-xs sm:text-sm text-slate-400">
                      Chủ đề: <strong className="text-purple-300">{selectedSpeakingPrompt.title}</strong>
                    </p>

                    {/* Overall Score Badge */}
                    {(() => {
                      const allScores = Object.values(speakingTurnScores).map((s) => s.accuracy);
                      const avg = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null;
                      return (
                        <div className="pt-2">
                          {avg !== null ? (
                            <span className={`inline-block px-5 py-2 rounded-2xl text-lg font-black border ${
                              avg >= 80 
                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' 
                                : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                            }`}>
                              Điểm Phát Âm Trung Bình: {avg}%
                            </span>
                          ) : (
                            <span className="inline-block px-5 py-2 rounded-2xl text-sm font-medium border bg-slate-800/60 border-slate-700 text-slate-400">
                              Chưa đủ dữ liệu để đánh giá
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Turn-by-Turn Breakdown List */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-purple-400 uppercase tracking-wider">
                      📋 Chi tiết từng lượt đối thoại:
                    </h4>

                    {selectedSpeakingPrompt.turns.map((turn, idx) => {
                      const turnScore = speakingTurnScores[idx];
                      return (
                        <div key={idx} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-400">
                              Lượt {idx + 1}:
                            </span>
                            {turnScore ? (
                              <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                                turnScore.accuracy >= 80
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}>
                                {turnScore.accuracy}%
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500">Chưa ghi nhận</span>
                            )}
                          </div>

                          <p className="text-xs text-slate-400 italic">
                            Đối tác: "{turn.partnerPrompt}"
                          </p>

                          <p className="text-xs font-bold text-white">
                            Mục tiêu: "{turn.targetSentence}"
                          </p>

                          {turnScore?.transcript && (
                            <p className="text-xs text-purple-300 font-mono pt-1 border-t border-slate-850">
                              Bạn đã nói: "{turnScore.transcript}"
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Next Action Panel */}
                  <div className="pt-4 border-t border-slate-800 space-y-3">
                    <NextActionPanel
                      actions={(() => {
                        const evaluatedTurns = Object.values(speakingTurnScores);
                        const hasValidAudioEvidence = isSpeechRecognitionSupported() && evaluatedTurns.length > 0;
                        const avgScore = evaluatedTurns.length > 0
                          ? Math.round(evaluatedTurns.reduce((acc, t) => acc + (t.accuracy || 0), 0) / evaluatedTurns.length)
                          : null;
                        const weakTurns = evaluatedTurns.filter((t) => t.accuracy < 75);
                        const weakWords = weakTurns
                          .flatMap((t) => (t.transcript ? t.transcript.split(/\s+/).filter((w) => w.length > 3) : []))
                          .slice(0, 5);

                        const plan = deriveTodayLearningPlanFromStore(useAppStore.getState());
                        const resolved = resolveNextBestActions(
                          {
                            flowType: 'speaking',
                            speaking: {
                              promptId: selectedSpeakingPrompt.id,
                              hasValidAudioEvidence: hasValidAudioEvidence && weakTurns.length > 0,
                              averageScore: avgScore,
                              weakWords: weakWords.length > 0 ? weakWords : undefined,
                            },
                            currentPlanItemId: todayPlanMeta?.planItemId,
                          },
                          {
                            navigateToTab: (tab) => (onNavigate ? onNavigate(tab) : useAppStore.getState().navigateToTab(tab)),
                            startAdaptivePractice,
                            setActiveFourSkill,
                            onCustomRetry: () => handleSelectSpeakingPrompt(selectedSpeakingPrompt),
                            onCustomCatalog: () => {
                              setSelectedSpeakingPrompt(null);
                              setCurrentSpeakingTurnIndex(0);
                              setSpeakingTurnScores({});
                              setIsSpeakingFinished(false);
                              setTodayPlanMeta(null);
                              setSourceContext(undefined);
                            },
                          },
                          plan
                        );
                        return [resolved.primaryAction, ...(resolved.secondaryAction ? [resolved.secondaryAction] : [])];
                      })()}
                    />
                  </div>

                </div>
              )}

            </div>
          )}
            </>
          )}
        </div>
      )}

      {/* --- PANEL D: WRITING STUDIO (CATALOG GRID & AI ESSAY GRADING DETAIL VIEW) --- */}
      {activeSkill === 'writing' && (
        <div className="space-y-6">
          
          {/* D1. WRITING PROMPTS CATALOG GRID (Khi chưa chọn đề bài và chưa bật chế độ tự do) */}
          {!selectedWritingPrompt && !isCustomTopicMode ? (
            <div className="space-y-6 animate-fadeIn">
              {/* Filter Tabs & Custom Topic Button */}
              <div className="flex flex-col gap-3.5 bg-slate-900/90 border border-slate-800 p-4 sm:p-5 rounded-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-amber-400" />
                    <h2 className="text-base sm:text-lg font-black text-white">
                      Kho Đề Bài Luyện Viết & Chấm AI ({filteredWritingPrompts.length} đề bài)
                    </h2>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {/* Nút Viết Chủ Đề Tự Do */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomTopicMode(true);
                        setSelectedWritingPrompt(null);
                        setWritingTopic('');
                        setWritingContent('');
                        setGradingResult(null);
                        setWritingAttemptId(`writing_essay_custom_${Date.now()}`);
                      }}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Tự Nhập Đề Bài Tự Do</span>
                    </button>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                      {availableWritingCategories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setWritingCategoryFilter(cat)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                            writingCategoryFilter === cat
                              ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-black'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {cat === 'ALL' ? 'Tất cả chủ đề' : cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* CEFR Level Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-3 border-t border-slate-800/80">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                    Trình độ CEFR:
                  </span>
                  {(['ALL', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setWritingLevelFilter(lvl)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold whitespace-nowrap transition-all border ${
                        writingLevelFilter === lvl
                          ? 'bg-amber-500/25 border-amber-400 text-amber-300 font-black shadow-sm'
                          : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {lvl === 'ALL' ? 'Tất cả' : lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Catalog Grid or Empty State */}
              {filteredWritingPrompts.length === 0 ? (
                <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-10 text-center space-y-3">
                  <Layers className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-slate-400 font-bold text-sm">Không tìm thấy bài viết nào phù hợp với bộ lọc hiện tại.</p>
                  <button
                    onClick={() => {
                      setWritingCategoryFilter('ALL');
                      setWritingLevelFilter('ALL');
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-amber-400 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Đặt lại bộ lọc
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredWritingPrompts.map((prompt) => {
                    const isCompleted = completedWritingIds.includes(prompt.id);
                    return (
                      <div
                        key={prompt.id}
                        onClick={() => {
                          setSelectedWritingPrompt(prompt);
                          setIsCustomTopicMode(false);
                          setWritingTopic(prompt.prompt);
                          setWritingContent('');
                          setGradingResult(null);
                          setShowModelAnswer(false);
                          setWritingAttemptId(`writing_essay_${prompt.id}_${Date.now()}`);
                        }}
                        className="group cursor-pointer bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 rounded-3xl p-5 sm:p-6 transition-all duration-300 flex flex-col justify-between shadow-xl relative overflow-hidden"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-md text-[11px] font-bold">
                                {prompt.type}
                              </span>
                              <span className="px-2 py-0.5 bg-slate-800 rounded-md text-[10px] text-amber-300 font-mono font-bold">
                                {prompt.level}
                              </span>
                            </div>

                            {isCompleted ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Đã chấm</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                🎯 {prompt.wordRange ? `${prompt.wordRange} từ` : `≥ ${prompt.minWords} từ`}
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-extrabold text-white group-hover:text-amber-300 transition-colors line-clamp-2">
                            {prompt.title}
                          </h3>

                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {prompt.prompt}
                          </p>

                          <div className="flex items-center gap-1.5 pt-1">
                            <span className="text-[10px] font-bold text-slate-500">Gợi ý từ vựng:</span>
                            <span className="px-2 py-0.5 bg-slate-950 rounded-md text-[10px] text-cyan-400 font-semibold border border-slate-800">
                              +{prompt.recommendedVocab.length} từ gợi ý
                            </span>
                          </div>
                        </div>

                        <div className="mt-5 pt-3 border-t border-slate-850 flex items-center justify-between text-xs font-bold text-amber-400">
                          <span>Viết bài & Chấm AI</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* D2. WRITING PRACTICE & AI ESSAY GRADING DETAIL VIEW */
            <div className="space-y-6 animate-fadeIn">
              
              {/* Back to Catalog Button */}
              <button
                type="button"
                onClick={() => {
                  setSelectedWritingPrompt(null);
                  setIsCustomTopicMode(false);
                  setGradingResult(null);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-2xl text-xs font-bold flex items-center gap-2 transition-all shadow-md group cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform text-amber-400" />
                <span>⬅ Quay lại danh sách đề bài viết</span>
              </button>

              {/* BEFORE SESSION: Writing Intro */}
              <SessionIntro
                title={todayPlanMeta?.title || (selectedWritingPrompt ? selectedWritingPrompt.title : (writingTopic || 'Luyện Viết Luận Tự Do'))}
                subtitle={selectedWritingPrompt ? `${selectedWritingPrompt.type} • CEFR ${selectedWritingPrompt.level}` : 'Đề Bài Tự Do (Free Topic)'}
                badgeLabel={selectedWritingPrompt ? `Writing ${selectedWritingPrompt.level}` : 'Writing Free'}
                estimatedDuration={
                  todayPlanMeta?.estimatedMinutes
                    ? formatSessionDurationBucket(todayPlanMeta.estimatedMinutes)
                    : undefined
                }
                objective={
                  todayPlanMeta?.objective ||
                  (selectedWritingPrompt
                    ? `Mục tiêu độ dài: ${selectedWritingPrompt.wordRange ? `${selectedWritingPrompt.wordRange} từ` : `≥ ${selectedWritingPrompt.minWords} từ`}`
                    : 'Mục tiêu tối thiểu: 50 từ')
                }
                sourceContext={sourceContext}
                resumeBanner={
                  (() => {
                    const promptId = selectedWritingPrompt?.id || (isCustomTopicMode ? 'custom_writing' : '');
                    const act = promptId ? resumeActivities[`writing_${promptId}`] : null;
                    const wordCount = writingContent.trim() ? writingContent.trim().split(/\s+/).filter(Boolean).length : 0;
                    if (act && !act.completed && !gradingResult && wordCount > 0) {
                      return (
                        <div data-testid="writing-resume-banner" className="flex items-center justify-between p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                            <div>
                              <span className="font-bold text-white block">Tiếp tục bài viết</span>
                              <span className="text-slate-300">
                                Bản nháp đã lưu ({wordCount} từ)
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()
                }
                primaryAction={{
                  label: writingContent.trim().length > 0 ? 'Tiếp tục bài viết' : 'Bắt đầu viết',
                  onClick: () => {
                    const el = document.getElementById('writing-editor-container');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  },
                }}
              >
                <div className="text-xs text-slate-400 font-medium">
                  {selectedWritingPrompt
                    ? `• Đề bài: ${selectedWritingPrompt.prompt}`
                    : '• Luyện viết tự do với chấm điểm 4 tiêu chí CEFR từ AI'}
                </div>
              </SessionIntro>

              {/* DURING SESSION: Writing Progress Header with stage_pipeline */}
              <SessionProgressHeader
                badgeLabel={selectedWritingPrompt ? `Writing ${selectedWritingPrompt.level}` : 'Writing Free'}
                metric={{
                  kind: 'stage_pipeline',
                  currentStageId: gradingResult ? 'evaluated' : isGrading ? 'submitted' : 'drafting',
                  stages: [
                    { id: 'drafting', label: 'Soạn thảo' },
                    { id: 'submitted', label: 'Đang chấm' },
                    { id: 'evaluated', label: 'Đã đánh giá' },
                  ],
                  progressPercent: gradingResult ? 100 : isGrading ? 66 : 33,
                }}
                rightSlot={
                  <div className="flex items-center gap-2">
                    {writingMicroFeedback && (
                      <SessionMicroFeedback feedback={writingMicroFeedback} />
                    )}
                    <span className="font-mono text-[11px] font-bold text-slate-400 px-2 py-0.5 bg-slate-950 border border-slate-800 rounded-lg">
                      {writingContent.trim() ? writingContent.trim().split(/\s+/).filter(Boolean).length : 0} từ
                    </span>
                  </div>
                }
                onExit={() => {
                  setSelectedWritingPrompt(null);
                  setIsCustomTopicMode(false);
                  setGradingResult(null);
                  setTodayPlanMeta(null);
                  setSourceContext(undefined);
                }}
              />

              <div id="writing-editor-container" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                
                {/* 1. Header Đề bài */}
                {selectedWritingPrompt ? (
                  <div className="border-b border-slate-800 pb-5 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-md text-xs font-bold">
                        {selectedWritingPrompt.type}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-800 rounded-md text-[10px] text-amber-300 font-mono font-bold">
                        {selectedWritingPrompt.level}
                      </span>
                      <span className="text-xs text-slate-400">
                        • Mục tiêu độ dài: {selectedWritingPrompt.wordRange ? `${selectedWritingPrompt.wordRange} từ` : `≥ ${selectedWritingPrompt.minWords} từ`}
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-white">Không Gian Viết Bài Luận</h3>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      📝 <strong className="text-amber-400">Đề bài:</strong> {selectedWritingPrompt.prompt}
                    </p>
                  </div>
                ) : (
                  /* Chế độ đề bài tự do (Custom Topic) */
                  <div className="border-b border-slate-800 pb-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-gradient-to-r from-amber-400/20 to-orange-400/20 border border-amber-400/30 text-amber-300 rounded-md text-xs font-bold">
                        Đề Bài Tự Do (Free Topic)
                      </span>
                      <span className="text-xs text-slate-500">• Mục tiêu tối thiểu: 50 từ</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-white">Không Gian Viết Bài Luận Tự Do</h3>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Chủ đề / Đề bài bài viết:</span>
                      </label>
                      <input
                        type="text"
                        value={writingTopic}
                        onChange={(e) => setWritingTopic(e.target.value)}
                        placeholder="Ví dụ: Some people believe that technology has made our lives more complicated. Do you agree or disagree?"
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl text-slate-100 text-sm focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                )}

                {/* 2. Gợi ý từ vựng & Dàn ý (Nếu có trong đề mẫu) */}
                {selectedWritingPrompt && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                      <span className="font-bold text-amber-400 uppercase tracking-wider block">
                        📌 Hướng dẫn lập dàn ý (Guidelines):
                      </span>
                      <ul className="space-y-1 text-slate-400 list-disc list-inside">
                        {selectedWritingPrompt.guidelines.map((g, idx) => (
                          <li key={idx}>{g}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                      <span className="font-bold text-cyan-400 uppercase tracking-wider block">
                        ✨ Từ vựng gợi ý nên dùng:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedWritingPrompt.recommendedVocab.map((rv, idx) => (
                          <span 
                            key={idx} 
                            title={rv.meaning}
                            className="px-2.5 py-1 bg-slate-900 border border-slate-700 text-cyan-300 rounded-lg text-xs font-semibold cursor-help"
                          >
                            {rv.word}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Khung Soạn Thảo Văn Bản & Bộ Đếm Từ Trực Tiếp */}
                {(() => {
                  const currentWordCount = writingContent.trim() ? writingContent.trim().split(/\s+/).filter(Boolean).length : 0;
                  const minWordsTarget = selectedWritingPrompt ? selectedWritingPrompt.minWords : 50;
                  const isEnoughWords = currentWordCount >= minWordsTarget;

                  return (
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap justify-between items-center gap-2 text-xs text-slate-400 px-1">
                        <span className="font-semibold text-slate-300">Nội dung bài viết:</span>
                        <span 
                          aria-live="polite"
                          className={`font-mono font-bold px-2.5 py-1 rounded-full border transition-all ${
                            isEnoughWords
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {isEnoughWords ? '✅' : '⚠️'} Đã viết: {currentWordCount} / {selectedWritingPrompt?.wordRange ? `${selectedWritingPrompt.wordRange} từ` : `≥ ${minWordsTarget} từ`}
                          {!isEnoughWords && currentWordCount > 0 && ` (Cần thêm tối thiểu ${Math.max(0, minWordsTarget - currentWordCount)} từ)`}
                        </span>
                      </div>

                      <textarea
                        value={writingContent}
                        onChange={(e) => setWritingContent(e.target.value)}
                        aria-label="Nội dung bài viết"
                        placeholder="Bắt đầu viết bài luận tiếng Anh của bạn tại đây... Hãy sử dụng từ nối linh hoạt, mở rộng vốn từ học thuật và diễn đạt luận điểm mạch lạc để được AI đánh giá Band cao."
                        rows={8}
                        className="w-full p-4 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl text-slate-100 text-sm focus:outline-none leading-relaxed transition-all resize-y font-sans selection:bg-amber-500/20"
                      />
                    </div>
                  );
                })()}

                {/* 4. Action Buttons Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isGrading || writingContent.trim().length === 0}
                    onClick={handleGradeWithAI}
                    className={`px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 shadow-xl cursor-pointer ${
                      isGrading
                        ? 'bg-amber-500/40 text-slate-900 cursor-wait'
                        : writingContent.trim().length === 0
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 hover:from-amber-300 hover:to-orange-300 text-slate-950 shadow-amber-500/20 active:scale-95'
                    }`}
                  >
                    {isGrading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>{gradingStatus}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Chấm Bài Với AI (Gemini 1.5 Flash) (+30 XP)</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    {selectedWritingPrompt && (
                      <button
                        type="button"
                        onClick={() => setShowModelAnswer(!showModelAnswer)}
                        className="px-4 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-bold rounded-2xl border border-slate-700 text-xs flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <FileText className="w-4 h-4 text-amber-400" />
                        <span>{showModelAnswer ? 'Ẩn bản mẫu' : 'Xem Bản Mẫu (Model Answer)'}</span>
                      </button>
                    )}

                    {writingContent.length > 0 && !isGrading && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Bạn có chắc muốn xóa nội dung bài viết hiện tại?')) {
                            setWritingContent('');
                            setGradingResult(null);
                          }
                        }}
                        className="px-3.5 py-3 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-rose-400 font-bold rounded-2xl border border-slate-800 text-xs transition-colors cursor-pointer"
                        title="Xóa làm lại"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 5. Bản Mẫu Tham Khảo (Model Answer) */}
                {showModelAnswer && selectedWritingPrompt && (
                  <div className="p-5 bg-gradient-to-br from-slate-950 to-slate-900 border border-amber-500/30 rounded-2xl space-y-2 animate-fadeIn">
                    <span className="text-xs font-black text-amber-400 uppercase tracking-wider block">
                      🌟 Bản Sửa Mẫu Chuyên Nghiệp (Model Answer):
                    </span>
                    <p className="text-xs sm:text-sm text-slate-200 whitespace-pre-line leading-relaxed font-sans">
                      {selectedWritingPrompt.modelAnswer}
                    </p>
                  </div>
                )}

                {/* 6. AI Writing Evaluation Report & Visual Diff Dashboard */}
                {gradingResult && (
                  <div ref={reportRef} className="pt-6 border-t border-slate-800 scroll-mt-6 animate-fadeIn space-y-4">
                    <WritingEvaluationReport
                      result={gradingResult}
                      originalEssay={writingContent}
                      topic={writingTopic || selectedWritingPrompt?.prompt || 'General Academic Topic'}
                      onRetake={() => {
                        setGradingResult(null);
                        setWritingAttemptId(`writing_essay_${selectedWritingPrompt?.id || 'custom'}_${Date.now()}`);
                      }}
                      onSaveScore={handleSaveWritingScore}
                    />

                    <div className="pt-4 border-t border-slate-800">
                      <NextActionPanel
                        actions={(() => {
                          const detectedCollocations = (gradingResult.diffSegments || [])
                            .filter((s) => s.type !== 'unchanged' && typeof s.revisedText === 'string' && isCollocationCandidate(s.revisedText))
                            .map((s) => s.revisedText!);
                          const detectedMistakes = (gradingResult.diffSegments || [])
                            .filter((s) => s.type !== 'unchanged' && Boolean(s.originalText))
                            .map((s) => s.originalText!);

                          const plan = deriveTodayLearningPlanFromStore(useAppStore.getState());
                          const resolved = resolveNextBestActions(
                            {
                              flowType: 'writing',
                              writing: {
                                promptId: selectedWritingPrompt?.id || 'custom',
                                gradingResult,
                                detectedCollocations,
                                detectedMistakes,
                                isFallback: gradingResult.isFallback,
                              },
                              currentPlanItemId: todayPlanMeta?.planItemId,
                            },
                            {
                              navigateToTab: (tab) => (onNavigate ? onNavigate(tab) : useAppStore.getState().navigateToTab(tab)),
                              startAdaptivePractice,
                              setActiveFourSkill,
                              onCustomRetry: () => {
                                setGradingResult(null);
                                setWritingAttemptId(`writing_essay_${selectedWritingPrompt?.id || 'custom'}_${Date.now()}`);
                              },
                              onCustomCatalog: () => {
                                setSelectedWritingPrompt(null);
                                setIsCustomTopicMode(false);
                                setGradingResult(null);
                                setTodayPlanMeta(null);
                                setSourceContext(undefined);
                              },
                            },
                            plan
                          );
                          return [resolved.primaryAction, ...(resolved.secondaryAction ? [resolved.secondaryAction] : [])];
                        })()}
                      />
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
