import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Award, 
  Clock, 
  CheckCircle2, 
  Play, 
  Pause,
  Volume2, 
  RotateCcw, 
  Sparkles, 
  BookOpen, 
  Mic, 
  MicOff, 
  ShieldCheck, 
  BarChart3, 
  ChevronRight, 
  Calendar,
  PlusCircle,
  Check,
  Image as ImageIcon,
  Headphones,
  AlertTriangle,
  X,
  TrendingUp,
  Bookmark,
  Keyboard,
  Lightbulb,
  Eye,
  EyeOff,
} from 'lucide-react';
import { triggerCelebration } from '../utils/confettiPolicy';
import { useAppStore } from '../store/useAppStore';
import { createSpeechRecognizer, SpeechRecognizerHandle } from '../services/speechService';
import { getExamQuestionsByMode, TOEIC_QUESTION_GROUPS } from '../data/toeicQuestionsData';
import { useToeicAudio } from '../hooks/useToeicAudio';
import { ToeicPart1View } from './toeic/ToeicPart1View';
import { ToeicPart2View } from './toeic/ToeicPart2View';
import { ToeicListeningGroupView } from './toeic/ToeicListeningGroupView';
import { resolveNormalizedListeningGroup } from '../services/toeicListeningNormalizer';
import { useToeicListeningEngine } from '../hooks/useToeicListeningEngine';
import { createListeningPlaybackPolicyFromExperience } from '../types/toeicListening';
import { ToeicAudioAccent } from '../types/toeic';
import { calculateToeicScores, ToeicScoreEvaluation } from '../services/toeicScoring';
import { buildToeicAttemptAnalytics } from '../services/toeicAttemptAnalytics';
import { 
  ToeicQuestion, 
  ToeicTestSession, 
  ToeicExamSnapshot,
  ToeicExperienceMode,
  ToeicSkillScope,
  ExamExperienceConfig,
  getExperienceConfig,
  isCombinationSupported,
  resolveExperienceAndSkillScope,
  ToeicAdaptiveState,
  VocabWord,
} from '../types';
import { InteractiveReadingPassage } from './InteractiveReadingPassage';
import { WordLookupPopover } from './WordLookupPopover';
import { lookupContextWord, cleanWordToken } from '../services/wordLookupService';
import { recordSkillEvidence } from '../services/skillsCompetencyService';
import { isActivityStale } from '../services/learningContinuityService';
import { ToeicResumableActivity } from '../types/learningContinuity';
import {
  createNewAttemptSnapshot,
  restoreSnapshotFromMeta,
  getInProgressAttempt,
  saveInProgressAttempt,
  clearInProgressAttempt,
  recordAttemptQuestionsToHistory,
  ToeicAttemptSnapshotMeta,
  STORAGE_KEY_INPROGRESS,
} from '../services/toeicAttemptManager';
import {
  INITIAL_ADAPTIVE_STATE,
  evaluateAdaptiveAnswer,
  adaptUpcomingDiagnosticSlots,
} from '../services/toeicDiagnosticEngine';
import { ToeicAnalyticsDashboard } from './ToeicAnalyticsDashboard';
import { buildToeicWeaknessProfile } from '../services/toeicHistoricalAnalytics';
import { ToeicAttemptAnalytics, ToeicRecommendationAction } from '../types/toeic';
import {
  loadToeicHistory,
  saveToeicAttempt,
  extractAttemptAnalyticsList,
  loadToeicArchivedSummary,
} from '../services/toeicPersistenceService';
import { scheduleCloudSync } from '../services/cloudSyncService';
import { SessionIntro } from './session/SessionIntro';
import { SessionProgressHeader } from './session/SessionProgressHeader';
import { NextActionPanel } from './session/NextActionPanel';
import type { SessionProgressMetric, SessionSourceContext } from '../types/sessionExperience';

/**
 * Trích xuất gợi ý (Hint) thuần túy từ metadata Question Bank mà không tiết lộ đáp án.
 * Tuân thủ quy tắc: Không hallucinate, không gọi AI, trả về null nếu không có clues.
 */
export function getQuestionHint(q?: ToeicQuestion): string | null {
  if (!q) return null;
  if (q.hint && q.hint.trim()) {
    return q.hint.trim();
  }
  const clues: string[] = [];
  if (q.subSkill) {
    clues.push(`Dạng kỹ năng: ${q.subSkill.replace(/_/g, ' ')}`);
  }
  if (q.grammarTags && q.grammarTags.length > 0) {
    clues.push(`Chủ điểm ngữ pháp: ${q.grammarTags.join(', ')}`);
  }
  if (q.topic) {
    clues.push(`Ngữ cảnh chủ đề: ${q.topic}`);
  }
  if (clues.length > 0) {
    return clues.join(' • ');
  }
  return null;
}

type ExamViewStage = 'lobby' | 'testing' | 'report';
type ExamMode = '2skills_mini' | '2skills_full' | '4skills';
type ReviewFilter = 'all' | 'wrong' | 'correct' | 'unanswered';

export const ToeicAssessmentView: React.FC = () => {
  const { 
    saveToSRS, 
    vocabularyList, 
    gainXP, 
    audioVoice, 
    audioSpeed, 
    profile,
    navigateToTab,
    resumeActivities,
    upsertResumeActivity,
    completeResumeActivity,
    removeResumeActivity,
    activePracticeConfig,
  } = useAppStore();

  // Today Learning Hub metadata prioritization (Phase 6)
  const todayPlanMeta = useMemo(() => {
    if (activePracticeConfig && activePracticeConfig.module === 'toeic') {
      return {
        planItemId: activePracticeConfig.planItemId,
        planTitle: activePracticeConfig.planTitle,
        planObjective: activePracticeConfig.planObjective,
        estimatedMinutes: activePracticeConfig.estimatedMinutes,
      };
    }
    return null;
  }, [activePracticeConfig]);

  const sourceContext: SessionSourceContext | undefined = useMemo(() => {
    if (!todayPlanMeta) return undefined;
    return {
      todayPlanTaskId: todayPlanMeta.planItemId,
      sourceModule: 'toeic',
    };
  }, [todayPlanMeta]);

  const [stage, setStage] = useState<ExamViewStage>('lobby');
  const [examMode, setExamMode] = useState<ExamMode>('2skills_mini');
  const [selectedExperienceMode, setSelectedExperienceMode] = useState<ToeicExperienceMode>('diagnostic');
  const [selectedSkillScope, setSelectedSkillScope] = useState<ToeicSkillScope>('2-skills');
  const [adaptiveState, setAdaptiveState] = useState<ToeicAdaptiveState | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(15 * 60); // giây
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // In-progress session recovery
  const [hasIncompleteSession, setHasIncompleteSession] = useState<boolean>(() => {
    try {
      const saved = getInProgressAttempt();
      if (saved) {
        // Discard if > 24 hours old (stale)
        const isStale = saved.savedAt ? (Date.now() - saved.savedAt > 24 * 60 * 60 * 1000) : false;
        if (isStale) {
          clearInProgressAttempt();
          return false;
        }
        return Boolean(saved.stage === 'testing' && saved.timeLeft > 0);
      }
      // Check in resumeActivities if getInProgressAttempt wasn't populated
      const activities = Object.values(useAppStore.getState().resumeActivities || {});
      const activeToeic = activities.find(
        (a): a is ToeicResumableActivity => a.type === 'toeic' && !a.completed
      );
      if (activeToeic) {
        if (isActivityStale(activeToeic)) {
          useAppStore.getState().removeResumeActivity(activeToeic.id);
          return false;
        }
        return (activeToeic.checkpoint.timeLeftSeconds || 0) > 0;
      }
    } catch {}
    return false;
  });

  // Speaking & Writing States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [speakingTranscript, setSpeakingTranscript] = useState('');
  const [speakingError, setSpeakingError] = useState<string | null>(null);
  const [speechSupported] = useState<boolean>(() => {
    return typeof window !== 'undefined' && 
      ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  });
  const [writingInput, setWritingInput] = useState('');

  // Results & History
  const [scoreResult, setScoreResult] = useState<ToeicScoreEvaluation | null>(null);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [testHistory, setTestHistory] = useState<ToeicTestSession[]>(() => loadToeicHistory());
  const [savedVocabNotice, setSavedVocabNotice] = useState<string | null>(null);

  // Snapshot Engine & Attempt State (Phase 4)
  const [activeSnapshot, setActiveSnapshot] = useState<ToeicExamSnapshot | null>(null);
  const [activeAttemptMeta, setActiveAttemptMeta] = useState<ToeicAttemptSnapshotMeta | null>(null);
  const [bankVersionWarning, setBankVersionWarning] = useState<string | null>(null);
  const [imageErrorMap, setImageErrorMap] = useState<Record<string, boolean>>({});

  // Practice Test State (Phase 3)
  const [firstAttemptAnswers, setFirstAttemptAnswers] = useState<Record<string, string>>({});
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<Record<string, boolean>>({});
  const [retryCountMap, setRetryCountMap] = useState<Record<string, number>>({});
  const [masteredRetryMap, setMasteredRetryMap] = useState<Record<string, boolean>>({});
  const [revealedHints, setRevealedHints] = useState<Record<string, boolean>>({});
  const [revealedTranscripts, setRevealedTranscripts] = useState<Record<string, boolean>>({});
  const [lookupWordState, setLookupWordState] = useState<{ wordData: VocabWord; rect: DOMRect } | null>(null);

  // Mock Test State & Submission Guard (Phase 4)
  const isSubmittingRef = useRef(false);
  const [audioPlayedMap, setAudioPlayedMap] = useState<Record<string, boolean>>({});
  const [historyFilter, setHistoryFilter] = useState<'all' | 'mock' | 'diagnostic' | 'practice'>('all');

  // Analytics Dashboard & Weakness Profile States (Phase 4)
  const [lobbyView, setLobbyView] = useState<'exam' | 'analytics'>('exam');
  const [latestAttemptAnalytics, setLatestAttemptAnalytics] = useState<ToeicAttemptAnalytics | null>(null);
  const [showReportAnalytics, setShowReportAnalytics] = useState<boolean>(true);

  // Memoize Weakness Profile từ toàn bộ lịch sử thi đã lưu (Pure, No recompute on every render)
  const weaknessProfile = useMemo(() => {
    const attemptAnalyticsList = extractAttemptAnalyticsList(testHistory);
    const archivedSummary = loadToeicArchivedSummary();
    return buildToeicWeaknessProfile(attemptAnalyticsList, undefined, archivedSummary);
  }, [testHistory]);

  // Điều hướng thực thi hành động khuyến nghị (Deterministic Action Handler)
  const handleExecuteRecommendation = useCallback(
    (action: ToeicRecommendationAction) => {
      if (action.targetTab === 'toeic') {
        setStage('lobby');
        setLobbyView('exam');
        setSelectedExperienceMode('practice');
      } else {
        navigateToTab(action.targetTab);
      }
    },
    [navigateToTab]
  );

  // Experience Config derives centrally from active snapshot or user selection
  const experienceConfig: ExamExperienceConfig = useMemo(() => {
    if (activeSnapshot?.experienceConfig) {
      return activeSnapshot.experienceConfig;
    }
    return getExperienceConfig(selectedExperienceMode);
  }, [activeSnapshot, selectedExperienceMode]);

  // Speech Recognition ref for cleanup
  const recognizerRef = useRef<SpeechRecognizerHandle | null>(null);

  // Lọc câu hỏi theo snapshot của attempt hiện tại (Generate once per attempt)
  const examQuestions = useMemo(() => {
    if (activeSnapshot) {
      return activeSnapshot.questions;
    }
    return getExamQuestionsByMode(examMode);
  }, [activeSnapshot, examMode]);

  const currentQ: ToeicQuestion | undefined = examQuestions[currentQuestionIdx];

  // Group audio / metadata linking cho Part 3, 4, 6, 7
  const currentGroup = useMemo(() => {
    if (!currentQ?.groupId) return null;
    if (activeSnapshot?.groups) {
      const found = activeSnapshot.groups.find((g) => g.id === currentQ.groupId);
      if (found) return found;
    }
    return TOEIC_QUESTION_GROUPS.find((g) => g.id === currentQ.groupId) || null;
  }, [currentQ?.groupId, activeSnapshot?.groups]);

  // Nguồn audio input cho câu hỏi Listening hiện tại
  const currentAudioInput = useMemo(() => {
    if (!currentQ || currentQ.skill !== 'listening') return null;
    return currentQ;
  }, [currentQ]);

  const {
    state: audioState,
    play: playAudioEngine,
    pause: pauseAudioEngine,
    stop: stopAudioEngine,
  } = useToeicAudio(currentAudioInput, {
    parentGroup: currentGroup,
    resolverOptions: {
      preferredAccent: audioVoice as ToeicAudioAccent,
      speechRate: audioSpeed,
    },
  });

  // Listening Engine (Phase 3, 4 & 5) cho toàn bộ Listening Part 1 - 4
  const isListeningQuestion = Boolean(
    currentQ &&
      currentQ.skill === 'listening' &&
      (currentQ.part === 'part1_photos' ||
        currentQ.part === 'part2_qna' ||
        currentQ.part === 'part3_conv' ||
        currentQ.part === 'part4_talks')
  );

  const currentNormalizedGroup = useMemo(() => {
    if (!isListeningQuestion || !currentQ) return null;
    return resolveNormalizedListeningGroup(currentQ, currentGroup);
  }, [isListeningQuestion, currentQ, currentGroup]);

  // Điều hướng câu hỏi con trong nhóm (Part 3 Conversation & Part 4 Talk)
  const currentGroupChildQuestions = useMemo(() => {
    if (!currentQ) return [];
    if (currentQ.groupId) {
      const grouped = examQuestions.filter((q) => q.groupId === currentQ.groupId);
      if (grouped.length > 0) return grouped;
    }
    return [currentQ];
  }, [examQuestions, currentQ]);

  const questionIndexWithinGroup = useMemo(() => {
    if (!currentQ) return 0;
    const idx = currentGroupChildQuestions.findIndex((q) => q.id === currentQ.id);
    return idx >= 0 ? idx : 0;
  }, [currentGroupChildQuestions, currentQ]);

  const handleNavigateToChildQuestion = useCallback(
    (childIdx: number) => {
      const targetQ = currentGroupChildQuestions[childIdx];
      if (!targetQ) return;
      const targetGlobalIdx = examQuestions.findIndex((q) => q.id === targetQ.id);
      if (targetGlobalIdx >= 0) {
        setCurrentQuestionIdx(targetGlobalIdx);
      }
    },
    [currentGroupChildQuestions, examQuestions]
  );

  const listeningPlaybackPolicy = useMemo(() => {
    const currentExpMode = activeSnapshot?.experienceMode || selectedExperienceMode;
    return createListeningPlaybackPolicyFromExperience(experienceConfig, currentExpMode);
  }, [experienceConfig, activeSnapshot?.experienceMode, selectedExperienceMode]);

  // Tính toán số lần đã phát audio của nhóm hiện tại (hỗ trợ Resume & chống F5 replay exploit trong Mock mode)
  const currentGroupInitialPlayCount = useMemo(() => {
    if (!currentNormalizedGroup) return 0;
    const isAlreadyPlayed = Boolean(
      audioPlayedMap[currentNormalizedGroup.id] ||
        audioPlayedMap[currentNormalizedGroup.audioGroupId] ||
        (currentQ && audioPlayedMap[currentQ.id])
    );
    return isAlreadyPlayed ? 1 : 0;
  }, [currentNormalizedGroup, audioPlayedMap, currentQ]);

  const {
    state: listeningEngineState,
    play: playListeningEngine,
    pause: pauseListeningEngine,
    restart: restartListeningEngine,
    seek: seekListeningEngine,
    setPlaybackRate: setListeningPlaybackRate,
    stop: stopListeningEngine,
  } = useToeicListeningEngine(currentNormalizedGroup, {
    policy: listeningPlaybackPolicy,
    initialPlayCount: currentGroupInitialPlayCount,
  });

  // Đồng bộ trạng thái đã phát audio vào audioPlayedMap để chống F5 exploit & phục vụ resume
  useEffect(() => {
    if (currentNormalizedGroup && listeningEngineState.playCount > 0) {
      const gId = currentNormalizedGroup.id;
      const aId = currentNormalizedGroup.audioGroupId;
      const qId = currentQ?.id;
      setAudioPlayedMap((prev) => {
        if (prev[gId] && prev[aId] && (!qId || prev[qId])) return prev;
        return {
          ...prev,
          [gId]: true,
          [aId]: true,
          ...(qId ? { [qId]: true } : {}),
        };
      });
    }
  }, [currentNormalizedGroup, listeningEngineState.playCount, currentQ?.id]);

  // Tự động tạm dừng audio khi thí sinh Pause bài thi
  useEffect(() => {
    if (isPaused) {
      pauseAudioEngine();
      pauseListeningEngine();
    }
  }, [isPaused, pauseAudioEngine, pauseListeningEngine]);

  // Tự động dập tắt audio khi rời khỏi bài thi hoặc nộp bài
  useEffect(() => {
    if (stage !== 'testing') {
      stopAudioEngine();
      stopListeningEngine();
    }
  }, [stage, stopAudioEngine, stopListeningEngine]);

  // Tính số câu đã làm / chưa làm
  const answeredCount = useMemo(() => {
    return examQuestions.filter((q) => {
      const ans = userAnswers[q.id];
      return ans && ans.trim() !== '' && ans !== 'SKIPPED';
    }).length;
  }, [examQuestions, userAnswers]);

  const unansweredCount = examQuestions.length - answeredCount;

  // Session Experience Presentation Metric (Phase 6)
  const toeicProgressMetric: SessionProgressMetric = useMemo(() => ({
    kind: 'discrete_items',
    currentIndex: currentQuestionIdx,
    totalItems: examQuestions.length,
    answeredCount,
    remainingCount: unansweredCount,
    progressPercent: examQuestions.length > 0 ? Math.round((answeredCount / examQuestions.length) * 100) : 0,
    counterFormat: 'answered',
  }), [currentQuestionIdx, examQuestions.length, answeredCount, unansweredCount]);

  // Lưu tiến độ vào sessionStorage và zustand continuity store để chống mất bài khi reload ngoài ý muốn
  useEffect(() => {
    if (stage === 'testing') {
      const rawAttemptId = activeAttemptMeta?.attemptId || 'active';
      const resumeActivityId = rawAttemptId.startsWith('toeic_') ? rawAttemptId : `toeic_${rawAttemptId}`;
      const now = Date.now();
      const totalQ = examQuestions.length;
      const progressPct = totalQ > 0 ? Math.round((answeredCount / totalQ) * 100) : 0;
      const resolvedExp = activeSnapshot?.experienceMode || selectedExperienceMode;
      const resolvedScope = activeSnapshot?.skillScope || selectedSkillScope;

      saveInProgressAttempt({
        stage: 'testing',
        attemptId: activeAttemptMeta?.attemptId,
        snapshotMeta: activeAttemptMeta || undefined,
        examMode,
        experienceMode: resolvedExp,
        skillScope: resolvedScope,
        experienceConfig,
        currentQuestionIdx,
        userAnswers,
        firstAttemptAnswers,
        bookmarkedQuestions,
        retryCountMap,
        masteredRetryMap,
        speakingTranscript,
        writingInput,
        audioPlayedMap,
        timeLeft,
        savedAt: now,
        isPaused,
        adaptiveState: adaptiveState || undefined,
      });

      upsertResumeActivity({
        id: resumeActivityId,
        type: 'toeic',
        title: activeSnapshot?.title || `TOEIC Exam (${examMode})`,
        subtitle: `${answeredCount}/${totalQ} câu • Còn ${Math.round(timeLeft / 60)} phút`,
        startedAt: activeAttemptMeta?.generatedAt ? new Date(activeAttemptMeta.generatedAt).getTime() : now,
        lastActiveAt: now,
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          attemptId: rawAttemptId,
          examMode,
          experienceMode: resolvedExp,
          skillScope: resolvedScope,
          currentQuestionIdx,
          totalQuestions: totalQ,
          answeredCount,
          timeLeftSeconds: timeLeft,
          userAnswers,
          isPaused,
          deadline: experienceConfig?.timerMode !== 'none' && !isPaused ? now + timeLeft * 1000 : undefined,
          savedAt: now,
          progressPercent: progressPct,
        },
      });
    } else if (stage === 'report') {
      clearInProgressAttempt();
      const rawAttemptId = activeAttemptMeta?.attemptId || 'active';
      const resumeActivityId = rawAttemptId.startsWith('toeic_') ? rawAttemptId : `toeic_${rawAttemptId}`;
      completeResumeActivity(resumeActivityId);
    }
  }, [
    stage,
    activeAttemptMeta,
    activeSnapshot,
    selectedExperienceMode,
    selectedSkillScope,
    experienceConfig,
    examMode,
    currentQuestionIdx,
    userAnswers,
    firstAttemptAnswers,
    bookmarkedQuestions,
    retryCountMap,
    masteredRetryMap,
    speakingTranscript,
    writingInput,
    audioPlayedMap,
    timeLeft,
    isPaused,
    adaptiveState,
    answeredCount,
    examQuestions.length,
    upsertResumeActivity,
    completeResumeActivity,
  ]);

  // Cảnh báo người dùng khi reload hoặc đóng tab khi đang làm bài (Navigation guard phân tầng theo Mode)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (stage === 'testing') {
        const currentExp = activeSnapshot?.experienceMode || selectedExperienceMode;
        let warningMsg = 'Bài thi TOEIC đang diễn ra. Bạn có chắc muốn rời khỏi trang?';
        if (currentExp === 'mock') {
          warningMsg = '⚠️ CẢNH BÁO PHÒNG THI MOCK TEST ETS: Bạn đang trong bài thi thử chuẩn hóa có tính giờ nghiêm ngặt. Việc rời khỏi hoặc đóng trang có thể làm gián đoạn thời gian làm bài của bạn!';
        } else if (currentExp === 'diagnostic') {
          warningMsg = 'Bạn đang thực hiện bài Khảo Sát Thích Ứng (Diagnostic). Hãy hoàn thành để nhận được báo cáo đánh giá năng lực chính xác nhất.';
        } else {
          warningMsg = 'Bạn đang trong buổi Luyện Tập TOEIC. Tiến trình hiện tại đã được tự động lưu tạm.';
        }
        e.preventDefault();
        e.returnValue = warningMsg;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [stage, activeSnapshot?.experienceMode, selectedExperienceMode]);

  // Hủy audio speech synthesis khi unmount hoặc chuyển stage
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (recognizerRef.current) {
        recognizerRef.current.stop();
      }
    };
  }, []);

  // Bắt đầu bài thi mới (Generate exactly once per attempt với Experience Mode & Skill Scope)
  const handleStartExam = (
    mode: ExamMode,
    expMode?: ToeicExperienceMode,
    scope?: ToeicSkillScope
  ) => {
    let resolvedExp = expMode || (mode === '2skills_mini' ? 'diagnostic' : selectedExperienceMode);
    let resolvedScope = scope || (mode === '4skills' ? '4-skills' : '2-skills');

    // Nếu chọn 4 kỹ năng khi đang ở chế độ diagnostic, tự động chuyển sang mock test theo khuyến nghị
    if (resolvedExp === 'diagnostic' && resolvedScope === '4-skills') {
      resolvedExp = 'mock';
    }

    const combination = isCombinationSupported(resolvedExp, resolvedScope);
    if (!combination.supported) {
      alert(combination.reason || 'Tổ hợp này không được hỗ trợ.');
      return;
    }

    const { snapshot, meta } = createNewAttemptSnapshot({
      mode,
      experienceMode: resolvedExp,
      skillScope: resolvedScope,
    });
    setActiveSnapshot(snapshot);
    setActiveAttemptMeta(meta);

    // Ghi nhận vào recent history (bounded) ngay khi bắt đầu attempt
    recordAttemptQuestionsToHistory(meta.questionIds, meta.groupIds);

    const initialAdaptive: ToeicAdaptiveState | null =
      resolvedExp === 'diagnostic' ? { ...INITIAL_ADAPTIVE_STATE } : null;
    setAdaptiveState(initialAdaptive);

    setExamMode(mode);
    setSelectedExperienceMode(resolvedExp);
    setSelectedSkillScope(resolvedScope);
    setCurrentQuestionIdx(0);
    setUserAnswers({});
    setFirstAttemptAnswers({});
    setBookmarkedQuestions({});
    setRetryCountMap({});
    setMasteredRetryMap({});
    setRevealedHints({});
    setRevealedTranscripts({});
    setLookupWordState(null);
    setSpeakingTranscript('');
    setWritingInput('');
    setSavedVocabNotice(null);
    setReviewFilter('all');
    setSpeakingError(null);
    setIsSubmitting(false);
    isSubmittingRef.current = false;
    setAudioPlayedMap({});
    setShowConfirmModal(false);
    setIsPaused(false);

    const duration = snapshot.durationMinutes * 60;
    setTimeLeft(duration);
    setIsTimerRunning(snapshot.experienceConfig?.timerMode !== 'none');
    setStage('testing');

    saveInProgressAttempt({
      stage: 'testing',
      attemptId: meta.attemptId,
      snapshotMeta: meta,
      examMode: mode,
      experienceMode: resolvedExp,
      skillScope: resolvedScope,
      experienceConfig: snapshot.experienceConfig,
      currentQuestionIdx: 0,
      userAnswers: {},
      firstAttemptAnswers: {},
      bookmarkedQuestions: {},
      retryCountMap: {},
      masteredRetryMap: {},
      speakingTranscript: '',
      writingInput: '',
      audioPlayedMap: {},
      timeLeft: duration,
      savedAt: Date.now(),
      adaptiveState: initialAdaptive || undefined,
    });
    setHasIncompleteSession(false);
  };

  // Khôi phục bài thi dở dang (Reload/F5 recovery)
  const handleResumeIncompleteSession = () => {
    let saved = getInProgressAttempt();
    if (!saved) {
      // Fallback: check resumeActivities in store
      const activities = Object.values(useAppStore.getState().resumeActivities || {});
      const activeToeic = activities.find(
        (a): a is ToeicResumableActivity => a.type === 'toeic' && !a.completed
      );
      if (activeToeic) {
        saved = {
          stage: 'testing',
          attemptId: activeToeic.checkpoint.attemptId,
          examMode: (activeToeic.checkpoint.examMode as ExamMode) || '2skills_mini',
          experienceMode: activeToeic.checkpoint.experienceMode as ToeicExperienceMode | undefined,
          skillScope: activeToeic.checkpoint.skillScope as ToeicSkillScope | undefined,
          currentQuestionIdx: activeToeic.checkpoint.currentQuestionIdx || 0,
          userAnswers: activeToeic.checkpoint.userAnswers || {},
          timeLeft: activeToeic.checkpoint.timeLeftSeconds || 600,
          savedAt: activeToeic.checkpoint.savedAt || activeToeic.lastActiveAt,
          isPaused: activeToeic.checkpoint.isPaused,
        };
      }
    }

    if (saved) {
      // Check staleness: discard if > 24 hours old
      if (saved.savedAt && (Date.now() - saved.savedAt > 24 * 60 * 60 * 1000)) {
        handleDiscardIncompleteSession();
        return;
      }

      if (saved.snapshotMeta) {
        const { snapshot, isIncompatible, warnings } = restoreSnapshotFromMeta(saved.snapshotMeta);
        setActiveSnapshot(snapshot);
        setActiveAttemptMeta(saved.snapshotMeta);
        if (saved.snapshotMeta.experienceMode) {
          setSelectedExperienceMode(saved.snapshotMeta.experienceMode);
        }
        if (saved.snapshotMeta.skillScope) {
          setSelectedSkillScope(saved.snapshotMeta.skillScope);
        }
        if (isIncompatible) {
          setBankVersionWarning(
            'Lưu ý: Ngân hàng câu hỏi vừa được cập nhật phiên bản mới. Bài thi đã được điều chỉnh lại để bảo đảm tương thích và không phát sinh lỗi dữ liệu.'
          );
        } else if (warnings.length > 0) {
          setBankVersionWarning(warnings[0]);
        }
      } else {
        // Fallback backward-compatible cho session cũ chưa có snapshotMeta
        const resolved = resolveExperienceAndSkillScope({
          experienceMode: saved.experienceMode,
          skillScope: saved.skillScope,
          mode: saved.examMode,
        });
        setSelectedExperienceMode(resolved.experienceMode);
        setSelectedSkillScope(resolved.skillScope);

        const fallbackQuestions = getExamQuestionsByMode(saved.examMode as ExamMode);
        const fallbackSnapshot: ToeicExamSnapshot = {
          id: `legacy_${saved.savedAt || 1337}`,
          mode: saved.examMode,
          experienceMode: resolved.experienceMode,
          skillScope: resolved.skillScope,
          experienceConfig: resolved.experienceConfig,
          title: `TOEIC Exam (${saved.examMode})`,
          seed: 1337,
          totalQuestions: fallbackQuestions.length,
          durationMinutes: Math.round(saved.timeLeft / 60) || 15,
          questions: fallbackQuestions,
          groups: [],
          partCounts: {} as any,
          difficultyBreakdown: { easy: 0, medium: 0, hard: 0 },
          skillBreakdown: { listening: 0, reading: 0, speaking: 0, writing: 0 },
          diagnostics: { relaxedHistory: false, relaxedDifficulty: false, warnings: [], selectedGroupIds: [], selectedQuestionIds: [] },
          createdAt: new Date().toISOString(),
        };
        setActiveSnapshot(fallbackSnapshot);
      }

      // Khôi phục Adaptive State nếu có lưu trữ
      if (saved.adaptiveState) {
        setAdaptiveState(saved.adaptiveState);
      } else if (saved.snapshotMeta?.adaptiveState) {
        setAdaptiveState(saved.snapshotMeta.adaptiveState);
      } else if (saved.experienceMode === 'diagnostic') {
        setAdaptiveState({ ...INITIAL_ADAPTIVE_STATE });
      } else {
        setAdaptiveState(null);
      }

      setExamMode(saved.examMode as ExamMode);
      setCurrentQuestionIdx(saved.currentQuestionIdx || 0);
      setUserAnswers(saved.userAnswers || {});
      setFirstAttemptAnswers(saved.firstAttemptAnswers || {});
      setBookmarkedQuestions(saved.bookmarkedQuestions || {});
      setRetryCountMap(saved.retryCountMap || {});
      setMasteredRetryMap(saved.masteredRetryMap || {});
      setRevealedHints({});
      setRevealedTranscripts({});
      setLookupWordState(null);
      setSpeakingTranscript(saved.speakingTranscript || '');
      setWritingInput(saved.writingInput || '');
      setAudioPlayedMap(saved.audioPlayedMap || {});
      isSubmittingRef.current = false;

      // Timer derivation: deduct elapsed time unless paused
      let effectiveTimeLeft = saved.timeLeft;
      const isTimed = saved.experienceConfig?.timerMode !== 'none';
      const wasPaused = Boolean(saved.isPaused);

      if (isTimed && !wasPaused && saved.savedAt) {
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - saved.savedAt) / 1000));
        effectiveTimeLeft = Math.max(0, saved.timeLeft - elapsedSeconds);
      }

      setTimeLeft(effectiveTimeLeft);
      setIsTimerRunning(isTimed && effectiveTimeLeft > 0);
      setIsPaused(wasPaused);
      setStage('testing');
      setHasIncompleteSession(false);
    } else {
      handleDiscardIncompleteSession();
    }
  };

  const handleDiscardIncompleteSession = () => {
    const saved = getInProgressAttempt();
    const rawAttemptId = activeAttemptMeta?.attemptId || saved?.attemptId;
    if (rawAttemptId) {
      const resumeId = rawAttemptId.startsWith('toeic_') ? rawAttemptId : `toeic_${rawAttemptId}`;
      removeResumeActivity(resumeId);
    }
    const activities = Object.values(useAppStore.getState().resumeActivities || {});
    const activeToeic = activities.find((a) => a.type === 'toeic' && !a.completed);
    if (activeToeic) {
      removeResumeActivity(activeToeic.id);
    }

    clearInProgressAttempt();
    setActiveSnapshot(null);
    setActiveAttemptMeta(null);
    setAdaptiveState(null);
    setFirstAttemptAnswers({});
    setBookmarkedQuestions({});
    setRetryCountMap({});
    setMasteredRetryMap({});
    setRevealedHints({});
    setRevealedTranscripts({});
    setLookupWordState(null);
    setAudioPlayedMap({});
    isSubmittingRef.current = false;
    setHasIncompleteSession(false);
  };

  // Nộp bài & Đánh giá điểm số mô phỏng TOEIC
  const handleSubmitExam = useCallback(() => {
    if (isSubmittingRef.current || isSubmitting) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setIsTimerRunning(false);
    setIsPaused(false);
    setShowConfirmModal(false);

    if (recognizerRef.current) {
      recognizerRef.current.stop();
      setIsRecording(false);
    }

    const currentExpMode = activeSnapshot?.experienceMode || selectedExperienceMode;
    const currentScope = activeSnapshot?.skillScope || (examMode === '4skills' ? '4-skills' : '2-skills');
    const currentExpConfig = activeSnapshot?.experienceConfig || getExperienceConfig(currentExpMode);
    const testDurationMinutes = activeSnapshot?.durationMinutes || (examMode === '2skills_mini' ? 15 : examMode === '2skills_full' ? 30 : 35);
    const totalDurationSeconds = testDurationMinutes * 60;
    const timeSpentSeconds = Math.max(0, totalDurationSeconds - timeLeft);

    const evaluated = calculateToeicScores({
      mode: examMode,
      experienceMode: currentExpMode,
      skillScope: currentScope,
      questions: examQuestions,
      userAnswers,
      firstAttemptAnswers,
      speakingTranscript: speakingTranscript.trim(),
      writingText: writingInput.trim(),
      adaptiveState: adaptiveState || activeSnapshot?.adaptiveState || undefined,
      timeSpentSeconds,
    });

    setScoreResult(evaluated);

    // Tích hợp cập nhật Năng Lực 4 Kỹ Năng (Four Skills Competency v2 Dual-Write)
    if (evaluated.listeningTotal > 0) {
      const listeningPercent = Math.round((evaluated.listeningCorrect / evaluated.listeningTotal) * 100);
      recordSkillEvidence({
        skill: 'listening',
        score: listeningPercent,
        source: 'toeic',
        quality: 1.0,
        metadata: {
          experienceMode: currentExpMode,
          skillScope: currentScope,
          listeningCorrect: evaluated.listeningCorrect,
          listeningTotal: evaluated.listeningTotal,
        },
      });
    }
    if (evaluated.readingTotal > 0) {
      const readingPercent = Math.round((evaluated.readingCorrect / evaluated.readingTotal) * 100);
      recordSkillEvidence({
        skill: 'reading',
        score: readingPercent,
        source: 'toeic',
        quality: 1.0,
        metadata: {
          experienceMode: currentExpMode,
          skillScope: currentScope,
          readingCorrect: evaluated.readingCorrect,
          readingTotal: evaluated.readingTotal,
        },
      });
    }

    if (evaluated.hasSpeaking && evaluated.speakingScore !== undefined) {
      const speakingPercent = Math.round((evaluated.speakingScore / 200) * 100);
      recordSkillEvidence({
        skill: 'speaking',
        score: speakingPercent,
        source: 'toeic',
        quality: 1.0,
        metadata: {
          experienceMode: currentExpMode,
          rawScore: evaluated.speakingScore,
        },
      });
    }
    if (evaluated.hasWriting && evaluated.writingScore !== undefined) {
      const writingPercent = Math.round((evaluated.writingScore / 200) * 100);
      recordSkillEvidence({
        skill: 'writing',
        score: writingPercent,
        source: 'toeic',
        quality: 1.0,
        metadata: {
          experienceMode: currentExpMode,
          rawScore: evaluated.writingScore,
        },
      });
    }

    // Sinh Attempt Analytics snapshot chính xác 1 lần cho completed attempt
    const testSessionId = `toeic_test_${Date.now()}`;
    const attemptAnalytics = buildToeicAttemptAnalytics({
      attemptId: activeSnapshot?.id || activeAttemptMeta?.attemptId || testSessionId,
      experienceMode: currentExpMode,
      skillScope: currentScope,
      completedAt: Date.now(),
      questions: examQuestions,
      userAnswers,
      firstAttemptAnswers,
      timeSpentSeconds,
      durationMinutes: testDurationMinutes,
      scoreEvaluation: evaluated,
      speakingTranscript,
      writingText: writingInput,
    });

    // Lưu vào lịch sử thi
    const newSession: ToeicTestSession = {
      id: testSessionId,
      mode: examMode,
      experienceMode: currentExpMode,
      skillScope: currentScope,
      experienceConfig: currentExpConfig,
      adaptiveState: adaptiveState || activeSnapshot?.adaptiveState || undefined,
      diagnosticReport: evaluated.diagnosticReport,
      analytics: attemptAnalytics,
      title: activeSnapshot?.title || (examMode === '2skills_mini' 
        ? 'TOEIC 2 Kỹ Năng (Mini-Test 10 câu)' 
        : examMode === '2skills_full' 
        ? 'TOEIC 2 Kỹ Năng (Full 20 câu)' 
        : 'TOEIC 4 Kỹ Năng Toàn Diện (24 câu)'),
      date: new Date().toISOString(),
      totalQuestions: examQuestions.length,
      durationMinutes: testDurationMinutes,
      timeSpentSeconds,
      userAnswers,
      firstAttemptAnswers,
      practiceStats: evaluated.practiceStats,
      speakingTranscript,
      writingText: writingInput,
      listeningScore: evaluated.listeningScore,
      readingScore: evaluated.readingScore,
      speakingScore: evaluated.speakingScore,
      writingScore: evaluated.writingScore,
      totalScore: evaluated.totalScore,
      cefrLevel: evaluated.cefrLevel,
    };

    const updatedHistory = saveToeicAttempt(newSession, testHistory);
    setTestHistory(updatedHistory);
    scheduleCloudSync(2000);

    // Thưởng XP theo kết quả bài thi (Bảo toàn: tính dựa trên first attempt đã evaluate)
    const earnedXP = Math.round(evaluated.totalScore / 10);
    gainXP(earnedXP);

    clearInProgressAttempt();
    const rawAttemptId = activeAttemptMeta?.attemptId || activeSnapshot?.id;
    if (rawAttemptId) {
      const resumeId = rawAttemptId.startsWith('toeic_') ? rawAttemptId : `toeic_${rawAttemptId}`;
      completeResumeActivity(resumeId);
    }
    setLatestAttemptAnalytics(attemptAnalytics);
    setActiveSnapshot(null);
    setActiveAttemptMeta(null);
    setAdaptiveState(null);
    setStage('report');
    setIsSubmitting(false);
    triggerCelebration('completion', { particleCount: 80, spread: 70, origin: { y: 0.6 } });
  }, [
    isSubmitting,
    activeSnapshot?.id,
    activeSnapshot?.title,
    activeSnapshot?.durationMinutes,
    activeSnapshot?.experienceMode,
    activeSnapshot?.skillScope,
    activeSnapshot?.experienceConfig,
    activeSnapshot?.adaptiveState,
    activeAttemptMeta?.attemptId,
    adaptiveState,
    selectedExperienceMode,
    examMode,
    examQuestions,
    userAnswers,
    firstAttemptAnswers,
    speakingTranscript,
    writingInput,
    timeLeft,
    testHistory,
    gainXP,
    completeResumeActivity,
  ]);

  // Đếm ngược thời gian làm bài (tôn trọng timerMode và canPause)
  useEffect(() => {
    if (!isTimerRunning || stage !== 'testing' || isPaused) return;
    if (experienceConfig.timerMode === 'none') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (experienceConfig.timerMode === 'strict') {
            if (!isSubmittingRef.current) {
              setTimeout(() => {
                handleSubmitExam();
              }, 0);
            }
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isTimerRunning, stage, isPaused, experienceConfig.timerMode, handleSubmitExam]);

  // Timer ghi âm Speaking
  useEffect(() => {
    if (!isRecording || isPaused) return;
    const interval = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  // Chọn đáp án trắc nghiệm (kèm cơ chế CAT Adaptive cho Diagnostic & Practice First-Attempt Isolation)
  const handleSelectAnswer = useCallback((choiceLetter: string) => {
    if (!currentQ) return;
    const isFirstTimeAnswered = !firstAttemptAnswers[currentQ.id];
    const isCorrect = choiceLetter === currentQ.correctAnswer;
    const currentExpMode = activeSnapshot?.experienceMode || selectedExperienceMode;

    setUserAnswers((prev) => ({
      ...prev,
      [currentQ.id]: choiceLetter,
    }));

    // First-attempt isolation: Lưu vết câu trả lời đầu tiên (bất biến với mọi lần retry)
    if (isFirstTimeAnswered) {
      setFirstAttemptAnswers((prev) => ({
        ...prev,
        [currentQ.id]: choiceLetter,
      }));
    } else if (isCorrect) {
      // Ghi nhận làm chủ sau retry
      setMasteredRetryMap((prev) => ({
        ...prev,
        [currentQ.id]: true,
      }));
    }

    // Diagnostic Adaptive CAT Logic:
    // Tự động điều chỉnh độ khó khi ở chế độ Diagnostic và đây là câu mới làm lần đầu
    if (currentExpMode === 'diagnostic' && activeSnapshot && isFirstTimeAnswered) {
      const currentState = adaptiveState || INITIAL_ADAPTIVE_STATE;
      const nextState = evaluateAdaptiveAnswer(
        currentState,
        isCorrect,
        currentQ.id,
        currentQuestionIdx
      );
      setAdaptiveState(nextState);

      // Nếu độ khó có sự thay đổi sau streak (threshold = 2)
      if (nextState.currentDifficulty !== currentState.currentDifficulty) {
        const adapted = adaptUpcomingDiagnosticSlots({
          currentQuestions: activeSnapshot.questions,
          currentGroups: activeSnapshot.groups,
          userAnswers: { ...userAnswers, [currentQ.id]: choiceLetter },
          activeQuestionIndex: currentQuestionIdx,
          targetDifficulty: nextState.currentDifficulty,
          seed: activeSnapshot.seed || Date.now(),
        });

        if (adapted.hasAdapted) {
          const updatedSnapshot: ToeicExamSnapshot = {
            ...activeSnapshot,
            questions: adapted.questions,
            groups: adapted.groups,
            adaptiveState: nextState,
          };
          setActiveSnapshot(updatedSnapshot);
          if (activeAttemptMeta) {
            setActiveAttemptMeta({
              ...activeAttemptMeta,
              questionIds: adapted.questions.map((q) => q.id),
              groupIds: adapted.groups.map((g) => g.id),
              adaptiveState: nextState,
            });
          }
        }
      }
    }
  }, [
    currentQ,
    firstAttemptAnswers,
    userAnswers,
    activeSnapshot,
    selectedExperienceMode,
    adaptiveState,
    currentQuestionIdx,
    activeAttemptMeta,
  ]);

  // Thử lại câu hỏi trong chế độ Practice
  const handleRetryQuestion = useCallback((questionId: string) => {
    if (!experienceConfig.allowRetry) return;
    setUserAnswers((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    setRetryCountMap((prev) => ({
      ...prev,
      [questionId]: (prev[questionId] || 0) + 1,
    }));
  }, [experienceConfig.allowRetry]);

  // Đánh dấu câu hỏi cần xem lại
  const handleToggleBookmark = useCallback((questionId: string) => {
    setBookmarkedQuestions((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  }, []);

  // Bật/tắt gợi ý làm bài
  const handleToggleHint = useCallback((questionId: string) => {
    setRevealedHints((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  }, []);

  // Bật/tắt transcript audio
  const handleToggleTranscript = useCallback((questionId: string) => {
    setRevealedTranscripts((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  }, []);

  // Tra từ điển theo ngữ cảnh và hiển thị Popover
  const handleWordLookup = useCallback((word: string, event: React.MouseEvent<HTMLElement>) => {
    if (!experienceConfig.allowLookup) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const found = lookupContextWord(word);
    if (found) {
      setLookupWordState({ wordData: found, rect });
    } else {
      const clean = cleanWordToken(word);
      setLookupWordState({
        wordData: {
          id: `lookup_${clean}`,
          word: clean,
          ipa: '',
          meaning: 'Tra cứu nhanh từ vựng bài tập TOEIC',
          partOfSpeech: 'n',
          example: currentQ?.audioScript || currentQ?.questionText || '',
          exampleMeaning: '',
          topic: 'TOEIC',
          tag: 'Daily',
          srsLevel: 0,
          interval: 0,
          easeFactor: 2.5,
          nextReviewDate: new Date().toISOString(),
        },
        rect,
      });
    }
  }, [experienceConfig.allowLookup, currentQ?.audioScript, currentQ?.questionText]);

  // Phím tắt bàn phím tiện lợi (A, B, C, D hoặc 1, 2, 3, 4, Mũi tên trái/phải)
  useEffect(() => {
    if (stage !== 'testing' || !currentQ || showConfirmModal || isPaused) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Không bắt phím tắt nếu đang soạn thảo textarea của Writing hoặc input
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'textarea' || activeTag === 'input') return;

      const key = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(key)) {
        if (currentQ?.part === 'part2_qna' && key === 'D') return;
        e.preventDefault();
        handleSelectAnswer(key);
      } else if (['1', '2', '3', '4'].includes(key)) {
        if (currentQ?.part === 'part2_qna' && key === '4') return;
        e.preventDefault();
        const letterMap: Record<string, string> = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
        handleSelectAnswer(letterMap[key]);
      } else if (e.key === 'ArrowLeft' && currentQuestionIdx > 0) {
        e.preventDefault();
        setCurrentQuestionIdx((prev) => prev - 1);
      } else if (e.key === 'ArrowRight' && currentQuestionIdx + 1 < examQuestions.length) {
        e.preventDefault();
        setCurrentQuestionIdx((prev) => prev + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stage, currentQ, currentQuestionIdx, examQuestions.length, showConfirmModal, isPaused, handleSelectAnswer]);

  // Thu âm phần Speaking qua Micro
  const handleToggleSpeakingRecord = () => {
    setSpeakingError(null);

    if (isRecording) {
      if (recognizerRef.current) {
        recognizerRef.current.stop();
      }
      setIsRecording(false);
      setRecordingSeconds(0);
      return;
    }

    if (!speechSupported) {
      setSpeakingError('Trình duyệt hiện tại không hỗ trợ Web Speech API. Bạn có thể nhập văn bản câu trả lời bên dưới.');
      return;
    }

    try {
      const recognizer = createSpeechRecognizer(
        (text, isFinal) => {
          setSpeakingTranscript(text);
          if (currentQ) {
            setUserAnswers((prev) => ({ ...prev, [currentQ.id]: text }));
          }
          if (isFinal) {
            setIsRecording(false);
            setRecordingSeconds(0);
          }
        },
        (err) => {
          console.warn('Speaking error:', err);
          setIsRecording(false);
          setRecordingSeconds(0);
          setSpeakingError('Không thể truy cập Micro hoặc có lỗi nhận diện. Bạn có thể thử lại hoặc nhập câu trả lời trực tiếp.');
        }
      );

      if (recognizer) {
        recognizerRef.current = recognizer;
        setRecordingSeconds(0);
        setIsRecording(true);
      } else {
        setSpeakingError('Không thể khởi tạo bộ nhận diện giọng nói trên thiết bị này.');
      }
    } catch {
      setSpeakingError('Lỗi cấp quyền Micro. Vui lòng cho phép truy cập Micro trong cài đặt trình duyệt.');
      setIsRecording(false);
    }
  };

  // Lưu từ vựng của một câu hỏi cụ thể vào Flashcard SRS
  const handleSaveQuestionVocabToSRS = (q: ToeicQuestion) => {
    if (!q.keyVocabulary || q.keyVocabulary.length === 0) return;
    let added = 0;
    const existing = new Set(vocabularyList.map((w) => w.word.toLowerCase().trim()));

    q.keyVocabulary.forEach((v) => {
      saveToSRS(v.word, {
        meaning: v.meaning,
        contextSentence: q.audioScript || q.questionText,
      });
      if (!existing.has(v.word.toLowerCase().trim())) {
        existing.add(v.word.toLowerCase().trim());
        added++;
      }
    });

    setSavedVocabNotice(`Đã lưu +${added} từ vựng của câu hỏi vào Flashcard SRS!`);
    setTimeout(() => setSavedVocabNotice(null), 3000);
  };

  // Lưu nhanh tất cả từ vựng trong đề vào Flashcard SRS
  const handleSaveAllKeyVocabToSRS = () => {
    let addedCount = 0;
    const existingMap = new Set(vocabularyList.map((w) => w.word.toLowerCase().trim()));

    examQuestions.forEach((q) => {
      if (q.keyVocabulary) {
        q.keyVocabulary.forEach((v) => {
          saveToSRS(v.word, {
            meaning: v.meaning,
            contextSentence: q.audioScript || q.questionText,
          });
          if (!existingMap.has(v.word.toLowerCase().trim())) {
            existingMap.add(v.word.toLowerCase().trim());
            addedCount++;
          }
        });
      }
    });

    setSavedVocabNotice(`Đã lưu thành công +${addedCount} từ vựng bài thi vào kho Flashcard SRS!`);
    setTimeout(() => setSavedVocabNotice(null), 3500);
  };

  // Format giây thành MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Phát audio bài nghe (tuân thủ quy chế allowAudioReplay: trong Mock mode chỉ cho phát 1 lần)
  const handlePlayAudio = useCallback((qId: string, _script?: string) => {
    if (audioState.status === 'playing') {
      pauseAudioEngine();
      return;
    }
    if (!experienceConfig.allowAudioReplay && audioPlayedMap[qId]) return;
    playAudioEngine();
    setAudioPlayedMap((prev) => ({ ...prev, [qId]: true }));
  }, [experienceConfig.allowAudioReplay, audioPlayedMap, audioState.status, pauseAudioEngine, playAudioEngine]);

  // Lọc câu hỏi trong chế độ Review
  const filteredReviewQuestions = useMemo(() => {
    if (reviewFilter === 'all') return examQuestions;
    return examQuestions.filter((q) => {
      const userChoice = userAnswers[q.id];
      const isSkipped = !userChoice || userChoice.trim() === '' || userChoice === 'SKIPPED';
      const isCorrect = !isSkipped && userChoice === q.correctAnswer;

      if (reviewFilter === 'wrong') return !isCorrect && !isSkipped;
      if (reviewFilter === 'correct') return isCorrect;
      if (reviewFilter === 'unanswered') return isSkipped;
      return true;
    });
  }, [examQuestions, userAnswers, reviewFilter]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      
      {/* ========================================================================= */}
      {/* 1. MÀN HÌNH SẢNH CHỜ (EXAM LOBBY)                                         */}
      {/* ========================================================================= */}
      {stage === 'lobby' && (
        <div className="space-y-6">
          
          {/* Header Banner via SessionIntro (Phase 6 TOEIC Session Experience) */}
          <SessionIntro
            title={todayPlanMeta?.planTitle || 'Khảo Sát Năng Lực TOEIC 2 & 4 Kỹ Năng'}
            subtitle="Khảo thí mô phỏng cấu trúc đề thi TOEIC quốc tế. Dự đoán năng lực thang điểm 10 – 990 (LR) và 0 – 400 (SW), phân tích chuyên sâu từng Part và quy đổi tham chiếu khung năng lực Châu Âu CEFR (A1 - C1)."
            objective={todayPlanMeta?.planObjective || 'Đo lường năng lực chuẩn xác theo từng Part và định chuẩn thang điểm ETS.'}
            badgeLabel="Tiêu Chuẩn Đánh Giá ETS"
            estimatedDuration={todayPlanMeta?.estimatedMinutes ? `~${todayPlanMeta.estimatedMinutes} phút` : undefined}
            sourceContext={sourceContext}
            icon={<Award className="w-6 h-6 text-amber-400" />}
            resumeBanner={hasIncompleteSession ? (
              <div
                data-testid="toeic-resume-banner"
                className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-amber-300 block">Bạn có bài thi chưa hoàn thành</span>
                    <span className="text-[11px] text-slate-400">Hệ thống đã tự động lưu lại các câu trả lời gần nhất của bạn.</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    data-testid="btn-resume-toeic"
                    onClick={handleResumeIncompleteSession}
                    className="flex-1 sm:flex-none px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all"
                  >
                    Tiếp Tục Làm Bài
                  </button>
                  <button
                    data-testid="btn-discard-toeic"
                    onClick={handleDiscardIncompleteSession}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white font-medium rounded-xl text-xs transition-all"
                  >
                    Hủy Bỏ
                  </button>
                </div>
              </div>
            ) : undefined}
          />

          {/* Lobby Sub-View Navigation Switcher */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setLobbyView('exam')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
                lobbyView === 'exam'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/10'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>Làm Bài Thi Mới</span>
            </button>
            <button
              type="button"
              onClick={() => setLobbyView('analytics')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
                lobbyView === 'analytics'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/10'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>
                Hồ Sơ Năng Lực & Điểm Yếu (
                {weaknessProfile.confidence === 'high'
                  ? 'Tin cậy cao'
                  : weaknessProfile.confidence === 'medium'
                  ? 'Tin cậy trung bình'
                  : 'Khởi tạo'}
                )
              </span>
            </button>
          </div>

          {lobbyView === 'analytics' ? (
            <ToeicAnalyticsDashboard
              profile={weaknessProfile}
              onExecuteAction={handleExecuteRecommendation}
            />
          ) : (
            <>
              {/* ================================================================= */}
              {/* BƯỚC 1: BẢNG CHỌN CHẾ ĐỘ TRẢI NGHIỆM (EXPERIENCE MODE SELECTOR)    */}
              {/* ================================================================= */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                  Bước 1: Chọn Chế Độ Trải Nghiệm (Experience Mode)
                </span>
                <h3 className="text-lg font-black text-white">Mục Tiêu Khảo Thí Của Bạn</h3>
              </div>
              <span className="text-xs text-slate-400">
                Chế độ hiện tại: <strong className="text-white uppercase">{selectedExperienceMode}</strong>
              </span>
            </div>

            {/* 3 Tabs Trải Nghiệm */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Tab 1: Diagnostic */}
              <button
                type="button"
                onClick={() => setSelectedExperienceMode('diagnostic')}
                className={`p-4 rounded-2xl border text-left transition-all space-y-2.5 ${
                  selectedExperienceMode === 'diagnostic'
                    ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/40 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-black px-2.5 py-1 rounded-xl ${
                    selectedExperienceMode === 'diagnostic' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-amber-400'
                  }`}>
                    Diagnostic
                  </span>
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                </div>
                <h4 className="text-sm font-bold text-white">Khảo Sát Nhanh</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Đo lường năng lực nhanh gọn qua 10 câu tiêu biểu. Thời gian mềm (~15P), định chuẩn phân loại.
                </p>
              </button>

              {/* Tab 2: Practice */}
              <button
                type="button"
                onClick={() => setSelectedExperienceMode('practice')}
                className={`p-4 rounded-2xl border text-left transition-all space-y-2.5 ${
                  selectedExperienceMode === 'practice'
                    ? 'bg-emerald-500/15 border-emerald-400 ring-2 ring-emerald-400/40 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-black px-2.5 py-1 rounded-xl ${
                    selectedExperienceMode === 'practice' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-emerald-400'
                  }`}>
                    Practice
                  </span>
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                </div>
                <h4 className="text-sm font-bold text-white">Luyện Tập Tự Do</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Không áp lực thời gian, được tạm dừng, tra từ và lưu Flashcard SRS thoải mái.
                </p>
              </button>

              {/* Tab 3: Mock Test */}
              <button
                type="button"
                onClick={() => setSelectedExperienceMode('mock')}
                className={`p-4 rounded-2xl border text-left transition-all space-y-2.5 ${
                  selectedExperienceMode === 'mock'
                    ? 'bg-blue-500/15 border-blue-400 ring-2 ring-blue-400/40 shadow-lg shadow-blue-500/10'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-black px-2.5 py-1 rounded-xl ${
                    selectedExperienceMode === 'mock' ? 'bg-blue-500 text-slate-950' : 'bg-slate-800 text-blue-400'
                  }`}>
                    Mock Test
                  </span>
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                </div>
                <h4 className="text-sm font-bold text-white">Thi Thử Chuẩn ETS</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Môi trường phòng thi nghiêm ngặt, đếm ngược thời gian chuẩn, không trợ giúp hay tạm dừng.
                </p>
              </button>
            </div>

            {/* Permission Matrix Info Bar */}
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Thời gian:{' '}
                  <strong className="text-white">
                    {selectedExperienceMode === 'diagnostic'
                      ? 'Soft Timer (~15P)'
                      : selectedExperienceMode === 'practice'
                      ? 'Không giới hạn'
                      : 'Đếm ngược nghiêm ngặt'}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Play className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>
                  Tạm dừng:{' '}
                  <strong className="text-white">
                    {getExperienceConfig(selectedExperienceMode).canPause ? 'Cho phép' : 'Không'}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Bookmark className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  Tra cứu & Lưu từ:{' '}
                  <strong className="text-white">
                    {getExperienceConfig(selectedExperienceMode).allowSaveVocabulary
                      ? 'Cho phép'
                      : 'Chỉ sau khi nộp bài'}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* BƯỚC 2: CHỌN PHẠM VI KỸ NĂNG (SKILL SCOPE)                         */}
          {/* ================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Scope 1: TOEIC 2 Kỹ Năng */}
            <div className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col justify-between space-y-6 transition-all group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <BookOpen className="w-6 h-6" />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-[10px] font-black uppercase">
                      2-Skills Scope
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">Khả dụng cho mọi chế độ</span>
                  </div>
                  <h3 className="text-xl font-black text-white group-hover:text-amber-400 transition-colors">
                    TOEIC 2 Kỹ Năng (Listening & Reading)
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
                    Kiểm tra toàn diện <strong>Listening (Part 1 - 4)</strong> và <strong>Reading (Part 5 - 7)</strong>. Thang điểm chuẩn 10 - 990 điểm.
                  </p>
                </div>

                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Bao quát đầy đủ 7 Part: Ảnh, Hỏi-Đáp, Hội thoại, Đọc hiểu</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Hệ thống audio phát âm rõ nét bản xứ US/UK</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
                <button
                  onClick={() => handleStartExam('2skills_mini', selectedExperienceMode, '2-skills')}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl shadow-lg shadow-amber-500/20 transition-all text-xs sm:text-sm flex items-center justify-center gap-1.5"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>Mini-Test (10 câu • 15P)</span>
                </button>

                <button
                  onClick={() => handleStartExam('2skills_full', selectedExperienceMode, '2-skills')}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-2xl border border-slate-700 transition-all text-xs sm:text-sm"
                >
                  <span>Standard (20 câu • 30P)</span>
                </button>
              </div>
            </div>

            {/* Scope 2: TOEIC 4 Kỹ Năng */}
            {(() => {
              const comboSupport = isCombinationSupported(selectedExperienceMode, '4-skills');
              return (
                <div className={`bg-slate-900 border rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col justify-between space-y-6 transition-all group ${
                  comboSupport.supported
                    ? 'border-slate-800 hover:border-cyan-500/40'
                    : 'border-slate-800/80 opacity-90'
                }`}>
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Mic className="w-6 h-6" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-[10px] font-black uppercase">
                          4-Skills Scope
                        </span>
                        {!comboSupport.supported && (
                          <span className="text-[10px] text-amber-400 font-bold">Không hỗ trợ ở Diagnostic</span>
                        )}
                      </div>
                      <h3 className="text-xl font-black text-white group-hover:text-cyan-400 transition-colors">
                        TOEIC 4 Kỹ Năng Toàn Diện
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
                        Trọn bộ <strong>Listening & Reading (990)</strong> kết hợp <strong>Speaking & Writing (400)</strong>.
                      </p>
                    </div>

                    {!comboSupport.supported ? (
                      <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-1 text-xs">
                        <div className="flex items-center gap-2 text-amber-400 font-bold">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>Tự động chuyển Mock Test cho 4 Kỹ Năng</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          Speaking & Writing là bài tự luận mở cần rubric chấm điểm chi tiết, hệ thống sẽ thực hiện theo định dạng Thi Thử Chuẩn (Mock Test).
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs text-slate-300">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                          <span>Thu âm phát âm Speaking & đánh giá phản xạ</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                          <span>Viết Email công sở & chấm điểm bố cục, văn phong</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-800">
                    <button
                      onClick={() =>
                        handleStartExam(
                          '4skills',
                          selectedExperienceMode === 'diagnostic' ? 'mock' : selectedExperienceMode,
                          '4-skills'
                        )
                      }
                      className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-black rounded-2xl shadow-lg shadow-cyan-500/20 transition-all text-xs sm:text-sm flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Bắt Đầu Thi 4 Kỹ Năng (24 câu • 35P)</span>
                    </button>
                  </div>
                </div>
              );
            })()}

          </div>

          {/* Lịch sử các lần thi thử */}
          {testHistory.length > 0 && (() => {
            const mockHistoryCount = testHistory.filter((s) => s.experienceMode === 'mock').length;
            const diagHistoryCount = testHistory.filter((s) => s.experienceMode === 'diagnostic').length;
            const pracHistoryCount = testHistory.filter((s) => s.experienceMode === 'practice').length;

            const displayedHistory = historyFilter === 'all'
              ? testHistory
              : testHistory.filter((s) => s.experienceMode === historyFilter);

            return (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-amber-400" />
                    <span>Lịch Sử Thi Thử Gần Đây</span>
                  </h3>

                  {/* Filter Tabs phân tách rõ Mock / Diagnostic / Practice */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setHistoryFilter('all')}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        historyFilter === 'all'
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Tất cả ({testHistory.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryFilter('mock')}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        historyFilter === 'mock'
                          ? 'bg-blue-500 text-white font-black'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Thi Thử Chuẩn ({mockHistoryCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryFilter('diagnostic')}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        historyFilter === 'diagnostic'
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Khảo Sát ({diagHistoryCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryFilter('practice')}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        historyFilter === 'practice'
                          ? 'bg-emerald-500 text-slate-950 font-black'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Luyện Tập ({pracHistoryCount})
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {displayedHistory.length > 0 ? (
                    displayedHistory.map((sess) => (
                      <div 
                        key={sess.id}
                        className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                              sess.experienceMode === 'diagnostic'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : sess.experienceMode === 'practice'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            }`}>
                              {sess.experienceMode === 'diagnostic'
                                ? 'Diagnostic'
                                : sess.experienceMode === 'practice'
                                ? 'Practice'
                                : 'Mock Test'}
                            </span>
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                              {sess.skillScope === '4-skills' || sess.mode === '4skills' ? '4-Skills' : '2-Skills'}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-slate-300">{sess.title}</span>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{new Date(sess.date).toLocaleDateString('vi-VN')}</span>
                            <span>•</span>
                            <span>{sess.totalQuestions} câu</span>
                            {sess.timeSpentSeconds !== undefined && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-slate-400">
                                  <Clock className="w-3 h-3" />
                                  <span>{formatTimer(sess.timeSpentSeconds)}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="text-[11px] text-slate-500 block">Listening + Reading</span>
                            <strong className="text-lg font-black text-amber-400">{sess.totalScore} / 990</strong>
                          </div>

                          {sess.speakingScore !== undefined && sess.writingScore !== undefined && (
                            <div className="text-right border-l border-slate-800 pl-4">
                              <span className="text-[11px] text-slate-500 block">Speaking + Writing</span>
                              <strong className="text-lg font-black text-cyan-400">{sess.speakingScore + sess.writingScore} / 400</strong>
                            </div>
                          )}

                          <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold">
                            CEFR {sess.cefrLevel}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/50 rounded-2xl border border-slate-800/80">
                      Chưa có bài thi nào thuộc mục này trong lịch sử.
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
            </>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MÀN HÌNH LÀM BÀI THI (TESTING INTERFACE)                                */}
      {/* ========================================================================= */}
      {stage === 'testing' && currentQ && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          {/* Top Status Bar: SessionProgressHeader (Phase 6 TOEIC Session Experience) */}
          <SessionProgressHeader
            title={activeSnapshot?.title || `TOEIC Exam (${examMode})`}
            subtitle={currentQ ? `Part ${currentQ.part.toUpperCase()}${currentQ.subSkill ? ` • ${currentQ.subSkill.replace(/_/g, ' ')}` : ''}` : undefined}
            badgeLabel={(activeSnapshot?.experienceMode || selectedExperienceMode).toUpperCase()}
            metric={toeicProgressMetric}
            isPaused={isPaused}
            rightSlot={
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-2.5 py-1 bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold">
                  Câu hỏi <strong className="text-white font-bold">{currentQuestionIdx + 1}</strong> / {examQuestions.length}
                </span>

                {(activeSnapshot?.experienceMode || selectedExperienceMode) === 'diagnostic' && adaptiveState && (
                  <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Độ khó: <span className="capitalize">{adaptiveState.currentDifficulty}</span></span>
                  </span>
                )}

                {/* Timer Display governed by experienceConfig.timerMode */}
                {experienceConfig.timerMode === 'none' ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs bg-slate-800 border border-slate-700 text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Không giới hạn</span>
                  </div>
                ) : (
                  <div className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-mono font-bold text-sm border ${
                    timeLeft < 120 
                      ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse' 
                      : timeLeft < 300 
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' 
                      : 'bg-slate-800 border-slate-750 text-emerald-400'
                  }`}>
                    <Clock className="w-4 h-4" />
                    <span>{formatTimer(timeLeft)}</span>
                    {experienceConfig.timerMode === 'soft' && (
                      <span className="text-[10px] font-sans font-normal text-amber-300 ml-1">(Gợi ý)</span>
                    )}
                  </div>
                )}

                {/* Pause Button if permitted by experienceConfig */}
                {experienceConfig.canPause && (
                  <button
                    type="button"
                    onClick={() => setIsPaused((prev) => !prev)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-bold rounded-xl text-xs border border-slate-700 transition-all flex items-center gap-1.5"
                    title="Tạm dừng làm bài"
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
                    <span>{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
                  </button>
                )}

                {/* Submit Button */}
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all"
                >
                  Nộp Bài
                </button>
              </div>
            }
          />

          {/* Paused Overlay Modal */}
          {isPaused && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
                  <Pause className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-white">Bài Thi Đang Tạm Dừng</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Tiến độ và thời gian làm bài của bạn đang được giữ nguyên. Hãy bấm tiếp tục khi sẵn sàng.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPaused(false)}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>Tiếp Tục Làm Bài</span>
                </button>
              </div>
            </div>
          )}

          {/* Bank Version Incompatibility or Update Banner */}
          {bankVersionWarning && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-300">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{bankVersionWarning}</span>
              </div>
              <button
                type="button"
                onClick={() => setBankVersionWarning(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Question Palette Grid */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <Keyboard className="w-3.5 h-3.5" />
                <span>Phím tắt: Bấm <strong>A, B, C, D</strong> hoặc <strong>1, 2, 3, 4</strong> để chọn. Phím mũi tên để chuyển câu.</span>
              </span>
              <span>{unansweredCount > 0 ? `Còn ${unansweredCount} câu chưa chọn` : 'Đã chọn đủ câu'}</span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {examQuestions.map((q, idx) => {
                const isAnswered = !!userAnswers[q.id];
                const isCurrent = idx === currentQuestionIdx;
                const isBookmarked = !!bookmarkedQuestions[q.id];
                const isChoiceCorrect = userAnswers[q.id] === q.correctAnswer;

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIdx(idx)}
                    className={`relative w-8 h-8 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center justify-center ${
                      isCurrent
                        ? 'bg-amber-500 text-slate-950 font-black ring-2 ring-amber-400/50 scale-105'
                        : isAnswered
                        ? (experienceConfig.showImmediateFeedback
                            ? (isChoiceCorrect
                                ? 'bg-emerald-500/20 border border-emerald-500/60 text-emerald-300'
                                : 'bg-red-500/20 border border-red-500/60 text-red-300')
                            : 'bg-emerald-500/20 border border-emerald-500/60 text-emerald-300')
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-750'
                    }`}
                  >
                    {idx + 1}
                    {isBookmarked && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-slate-900 shadow-sm" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Tools & Quick Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 bg-slate-850/60 border border-slate-750 rounded-2xl text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Bookmark Toggle Button */}
              <button
                type="button"
                onClick={() => handleToggleBookmark(currentQ.id)}
                className={`px-3 py-1.5 rounded-xl font-bold border transition-all flex items-center gap-1.5 ${
                  bookmarkedQuestions[currentQ.id]
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
                }`}
                title="Đánh dấu câu hỏi để xem lại"
              >
                <Bookmark className={`w-3.5 h-3.5 ${bookmarkedQuestions[currentQ.id] ? 'fill-amber-400 text-amber-400' : ''}`} />
                <span>{bookmarkedQuestions[currentQ.id] ? 'Đã Đánh Dấu' : 'Đánh Dấu'}</span>
              </button>

              {/* Hint Toggle Button (governed by allowHints) */}
              {experienceConfig.allowHints && (() => {
                const hintText = getQuestionHint(currentQ);
                const hasHint = Boolean(hintText);
                const isHintOpen = Boolean(revealedHints[currentQ.id]);

                return (
                  <button
                    type="button"
                    disabled={!hasHint}
                    onClick={() => handleToggleHint(currentQ.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold border transition-all flex items-center gap-1.5 ${
                      !hasHint
                        ? 'bg-slate-800/40 text-slate-600 border-slate-800/60 cursor-not-allowed'
                        : isHintOpen
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10'
                        : 'bg-slate-800 text-amber-400 hover:bg-slate-750 border-slate-700'
                    }`}
                    title={hasHint ? 'Bấm để xem gợi ý làm bài' : 'Không có gợi ý khả dụng cho câu này'}
                  >
                    <Lightbulb className={`w-3.5 h-3.5 ${isHintOpen ? 'fill-amber-400 text-amber-400' : ''}`} />
                    <span>{isHintOpen ? 'Ẩn Gợi Ý' : 'Gợi Ý'}</span>
                  </button>
                );
              })()}

              {/* Transcript Toggle Button for Listening */}
              {experienceConfig.allowTranscript && (currentQ.audioScript || currentNormalizedGroup?.transcript?.fullText) && (
                <button
                  type="button"
                  onClick={() => {
                    handleToggleTranscript(currentQ.id);
                    if (currentNormalizedGroup) handleToggleTranscript(currentNormalizedGroup.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold border transition-all flex items-center gap-1.5 ${
                    revealedTranscripts[currentQ.id] || (currentNormalizedGroup && revealedTranscripts[currentNormalizedGroup.id])
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700'
                  }`}
                  title="Xem kịch bản nghe audio"
                >
                  {revealedTranscripts[currentQ.id] || (currentNormalizedGroup && revealedTranscripts[currentNormalizedGroup.id]) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{revealedTranscripts[currentQ.id] || (currentNormalizedGroup && revealedTranscripts[currentNormalizedGroup.id]) ? 'Ẩn Script' : 'Xem Script'}</span>
                </button>
              )}
            </div>

            {/* Quick exit to lobby when paused or allowed */}
            {experienceConfig.canPause && (
              <button
                type="button"
                onClick={() => setStage('lobby')}
                className="px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors font-medium text-[11px]"
                title="Lưu tiến trình vào bộ nhớ tạm và quay lại sảnh"
              >
                Lưu & Ra Sảnh
              </button>
            )}
          </div>

          {/* Hint Callout Box */}
          {revealedHints[currentQ.id] && (() => {
            const hintText = getQuestionHint(currentQ);
            return hintText ? (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 text-xs text-amber-200 animate-fade-in">
                <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 fill-amber-400" />
                <div className="space-y-0.5">
                  <span className="font-bold text-amber-300 block">💡 Gợi Ý Làm Bài (Không Lộ Đáp Án):</span>
                  <p className="leading-relaxed">{hintText}</p>
                </div>
              </div>
            ) : null;
          })()}

          {/* Transcript Box (Fallback cho các bài tập cũ ngoài Part 1-4) */}
          {!isListeningQuestion && experienceConfig.allowTranscript && (currentQ.audioScript || audioState.textToSpeak) && revealedTranscripts[currentQ.id] && (
            <div className="p-4 bg-cyan-950/30 border border-cyan-500/30 rounded-2xl text-xs text-cyan-200 space-y-1 animate-fade-in">
              <div className="flex items-center justify-between font-bold text-cyan-300">
                <span className="flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Kịch Bản Audio (Transcript):</span>
                </span>
                <span className="text-[10px] text-cyan-400/80 font-normal">Chế độ Luyện Tập</span>
              </div>
              {audioState.hasValidTiming && audioState.timingSegments && audioState.timingSegments.length > 0 ? (
                <div className="space-y-2 pt-1 font-serif text-slate-200">
                  {audioState.timingSegments.map((seg, sIdx) => {
                    const isActive = audioState.activeSegmentIndex === sIdx;
                    return (
                      <p
                        key={seg.id || `seg_${sIdx}`}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isActive ? 'bg-amber-500/10 border border-amber-500/20 text-white' : 'text-slate-300'
                        }`}
                      >
                        {seg.speaker && (
                          <span className="font-sans font-bold text-amber-400 mr-2 text-[11px] uppercase tracking-wider block sm:inline">
                            {seg.speaker}:
                          </span>
                        )}
                        {seg.tokens && seg.tokens.length > 0 ? (
                          seg.tokens.map((tok, tIdx) => {
                            const isTokActive =
                              isActive &&
                              audioState.activeToken &&
                              audioState.activeToken.startMs === tok.startMs &&
                              audioState.activeToken.endMs === tok.endMs;
                            return (
                              <span
                                key={`tok_${sIdx}_${tIdx}`}
                                className={`transition-all rounded px-0.5 ${
                                  isTokActive
                                    ? 'bg-amber-400 text-slate-950 font-bold shadow-sm ring-2 ring-amber-400'
                                    : ''
                                }`}
                              >
                                {tok.text}{' '}
                              </span>
                            );
                          })
                        ) : (
                          <span>{seg.text}</span>
                        )}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <p className="italic font-serif leading-relaxed text-slate-200 whitespace-pre-line pt-1">
                  "{currentQ.audioScript || audioState.textToSpeak}"
                </p>
              )}
            </div>
          )}

          {/* Listening Audio Section (Fallback cho các bài tập cũ ngoài Part 1-4) */}
          {!isListeningQuestion && currentQ.skill === 'listening' && (currentQ.audioScript || currentQ.audioMetadata || currentGroup?.audioMetadata || audioState.textToSpeak) && (() => {
            const isAudioPlayed = Boolean(audioPlayedMap[currentQ.id]);
            const isAudioDisabled = !experienceConfig.allowAudioReplay && isAudioPlayed && audioState.status !== 'playing';

            return (
              <div className="p-4 bg-slate-850 border border-slate-750 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isAudioDisabled ? 'bg-slate-800 text-slate-500' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white block">
                        Đoạn Audio Nghe ({currentQ.part === 'part1_photos' ? 'Part 1: Nghe 4 nhận định A, B, C, D' : currentQ.part})
                      </span>
                      {audioState.sourceType === 'mp3' && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Studio MP3
                        </span>
                      )}
                      {audioState.sourceType === 'tts' && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          {audioState.fallbackOccurred ? 'TTS Fallback' : 'Web Speech TTS'}
                        </span>
                      )}
                      {audioState.isInheritedFromGroup && (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          Hội thoại nhóm
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {!experienceConfig.allowAudioReplay 
                        ? 'Quy chế thi Mock Test ETS: Mỗi câu hỏi chỉ được nghe audio 1 lần duy nhất.'
                        : 'Luyện nghe không giới hạn số lần phát audio (US / UK)'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isAudioDisabled}
                    onClick={() => handlePlayAudio(currentQ.id, currentQ.audioScript || '')}
                    className={`px-5 py-2.5 font-black rounded-xl text-xs flex items-center gap-2 transition-all ${
                      isAudioDisabled
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-lg shadow-amber-500/20 hover:scale-105'
                    }`}
                    title={isAudioDisabled ? 'Bạn đã phát câu hỏi này theo quy chế phòng thi ETS' : 'Phát âm thanh bài nghe'}
                  >
                    {audioState.status === 'playing' ? (
                      <>
                        <Pause className="w-3.5 h-3.5 fill-slate-950" />
                        <span>Tạm dừng</span>
                      </>
                    ) : (
                      <>
                        <Play className={`w-3.5 h-3.5 ${isAudioDisabled ? 'fill-slate-500' : 'fill-slate-950'}`} />
                        <span>{isAudioDisabled ? 'Đã phát (1 lần)' : 'Phát Audio'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Reading Passage Section (If Part 6 or 7) */}
          {currentQ.passage && (
            <div className="p-5 bg-slate-850/80 border border-slate-750 rounded-2xl space-y-2 text-xs sm:text-sm text-slate-200 font-serif leading-relaxed whitespace-pre-line max-h-56 overflow-y-auto">
              {currentQ.passage}
            </div>
          )}

          {/* ========================================================================= */}
          {/* SPECIAL RENDER FOR PART 1 & PART 2 (PHASE 4 LISTENING ENGINE INTEGRATION) */}
          {/* ========================================================================= */}
          {currentQ.part === 'part1_photos' ? (
            <ToeicPart1View
              question={currentQ}
              questionNumber={currentQuestionIdx + 1}
              selectedAnswer={userAnswers[currentQ.id]}
              onSelectAnswer={handleSelectAnswer}
              policy={listeningPlaybackPolicy}
              engineState={listeningEngineState}
              onPlay={playListeningEngine}
              onPause={pauseListeningEngine}
              onRestart={restartListeningEngine}
              onSeek={seekListeningEngine}
              onSetSpeed={setListeningPlaybackRate}
              hasAnswered={Boolean(userAnswers[currentQ.id])}
              revealedTranscript={Boolean(revealedTranscripts[currentQ.id])}
              onToggleTranscript={() => handleToggleTranscript(currentQ.id)}
              isRetryAllowed={Boolean(experienceConfig.allowRetry)}
              onRetry={() => handleRetryQuestion(currentQ.id)}
            />
          ) : currentQ.part === 'part2_qna' ? (
            <ToeicPart2View
              question={currentQ}
              questionNumber={currentQuestionIdx + 1}
              selectedAnswer={userAnswers[currentQ.id]}
              onSelectAnswer={handleSelectAnswer}
              policy={listeningPlaybackPolicy}
              engineState={listeningEngineState}
              onPlay={playListeningEngine}
              onPause={pauseListeningEngine}
              onRestart={restartListeningEngine}
              onSetSpeed={setListeningPlaybackRate}
              hasAnswered={Boolean(userAnswers[currentQ.id])}
              revealedTranscript={Boolean(revealedTranscripts[currentQ.id])}
              onToggleTranscript={() => handleToggleTranscript(currentQ.id)}
            />
          ) : (currentQ.part === 'part3_conv' || currentQ.part === 'part4_talks') && currentNormalizedGroup ? (
            <ToeicListeningGroupView
              group={currentNormalizedGroup}
              currentQuestion={currentQ}
              childQuestions={currentGroupChildQuestions}
              questionIndexWithinGroup={questionIndexWithinGroup}
              globalQuestionNumber={currentQuestionIdx + 1}
              totalExamQuestions={examQuestions.length}
              userAnswers={userAnswers}
              onSelectAnswer={handleSelectAnswer}
              onNavigateToChildQuestion={handleNavigateToChildQuestion}
              policy={listeningPlaybackPolicy}
              engineState={listeningEngineState}
              onPlay={playListeningEngine}
              onPause={pauseListeningEngine}
              onRestart={restartListeningEngine}
              onSeek={seekListeningEngine}
              onSetSpeed={setListeningPlaybackRate}
              revealedTranscript={Boolean(
                revealedTranscripts[currentQ.id] ||
                  (currentNormalizedGroup && revealedTranscripts[currentNormalizedGroup.id])
              )}
              onToggleTranscript={() => {
                handleToggleTranscript(currentQ.id);
                if (currentNormalizedGroup) handleToggleTranscript(currentNormalizedGroup.id);
              }}
              isRetryAllowed={Boolean(experienceConfig.allowRetry)}
              onRetry={handleRetryQuestion}
            />
          ) : (
            /* Standard Multiple Choice Options for Part 5 - 7 (Reading) */
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                  {currentQ.questionText}
                </h3>
              </div>

              {currentQ.options && (
                <div className="grid grid-cols-1 gap-2.5">
                  {currentQ.options.map((option, idx) => {
                    const choiceLetter = ['A', 'B', 'C', 'D'][idx];
                    const isSelected = userAnswers[currentQ.id] === choiceLetter;

                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectAnswer(choiceLetter)}
                        className={`p-4 rounded-2xl border text-left text-xs sm:text-sm font-medium transition-all duration-150 flex items-center gap-3 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-400 text-amber-300 font-bold shadow-md shadow-amber-500/10'
                            : 'bg-slate-850 hover:bg-slate-800 border-slate-750 text-slate-300'
                        }`}
                      >
                        <span className={`w-7 h-7 rounded-lg border flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {choiceLetter}
                        </span>
                        <span className="flex-1 leading-snug">{option}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Immediate Feedback Card in Practice Mode */}
          {experienceConfig.showImmediateFeedback && !!userAnswers[currentQ.id] && (() => {
            const currentChoice = userAnswers[currentQ.id];
            const isChoiceCorrect = currentChoice === currentQ.correctAnswer;
            const isMasteredOnRetry = masteredRetryMap[currentQ.id];
            const retryCount = retryCountMap[currentQ.id] || 0;

            return (
              <div className="p-5 sm:p-6 bg-slate-850/90 border border-slate-750 rounded-3xl space-y-4 animate-fade-in shadow-xl">
                {/* Result Status Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                      isChoiceCorrect
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-red-500/20 text-red-400 border-red-500/40'
                    }`}>
                      {isChoiceCorrect ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`text-sm sm:text-base font-black ${isChoiceCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isChoiceCorrect ? 'Chính Xác!' : 'Chưa Chính Xác'}
                        </h4>
                        {isMasteredOnRetry && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            🎉 Đã làm chủ sau khi thử lại
                          </span>
                        )}
                        {retryCount > 0 && (
                          <span className="text-[10px] text-slate-500">
                            (Thử lại lần {retryCount})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Đáp án đúng: <strong className="text-emerald-400 font-bold">({currentQ.correctAnswer})</strong> • Lựa chọn hiện tại: <strong className={isChoiceCorrect ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>({currentChoice})</strong>
                      </p>
                    </div>
                  </div>

                  {/* Retry button if wrong and retry is allowed */}
                  {!isChoiceCorrect && experienceConfig.allowRetry && (
                    <button
                      type="button"
                      onClick={() => handleRetryQuestion(currentQ.id)}
                      className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all hover:scale-105 shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5 fill-slate-950" />
                      <span>Thử Lại Câu Này (Retry)</span>
                    </button>
                  )}
                </div>

                {/* Explanation & Translation */}
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2 text-xs">
                  <p className="text-amber-300/90 leading-relaxed font-medium">
                    💡 <strong>Giải thích chi tiết:</strong> {currentQ.explanation}
                  </p>
                  {currentQ.vietnameseTranslation && (
                    <p className="text-slate-400 italic">
                      🌐 <strong>Dịch nghĩa:</strong> {currentQ.vietnameseTranslation}
                    </p>
                  )}
                </div>

                {/* Grammar & Vocabulary Tags */}
                {((currentQ.grammarTags && currentQ.grammarTags.length > 0) || (currentQ.vocabularyTags && currentQ.vocabularyTags.length > 0)) && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Chủ điểm:</span>
                    {currentQ.grammarTags?.map((gt, idx) => (
                      <span key={`gt-${idx}`} className="px-2.5 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-mono text-[11px]">
                        📚 {gt}
                      </span>
                    ))}
                    {currentQ.vocabularyTags?.map((vt, idx) => (
                      <span key={`vt-${idx}`} className="px-2.5 py-0.5 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-300 font-mono text-[11px]">
                        🏷️ {vt}
                      </span>
                    ))}
                  </div>
                )}

                {/* Key Vocabulary Chips with SRS Save and Lookup */}
                {currentQ.keyVocabulary && currentQ.keyVocabulary.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Từ Vựng Then Chốt (Key Vocabulary)</span>
                      </span>
                      {experienceConfig.allowSaveVocabulary && (
                        <button
                          type="button"
                          onClick={() => handleSaveQuestionVocabToSRS(currentQ)}
                          className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Lưu tất cả vào SRS</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {currentQ.keyVocabulary.map((v, vIdx) => (
                        <div
                          key={vIdx}
                          className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-2 text-xs"
                        >
                          <div 
                            className="cursor-pointer hover:text-teal-300 transition-colors"
                            onClick={(e) => handleWordLookup(v.word, e)}
                            title="Nhấn để tra cứu chi tiết"
                          >
                            <strong className="text-teal-300 font-mono">{v.word}</strong>
                            {v.ipa && <span className="text-slate-400 text-[11px] ml-1">({v.ipa})</span>}
                            <span className="text-slate-300 block text-[11px] truncate max-w-[200px]">{v.meaning}</span>
                          </div>
                          {experienceConfig.allowSaveVocabulary && (
                            <button
                              type="button"
                              onClick={() => {
                                saveToSRS(v.word, {
                                  meaning: v.meaning,
                                  contextSentence: currentQ.audioScript || currentQ.questionText,
                                });
                                setSavedVocabNotice(`Đã lưu "${v.word}" vào Flashcard SRS!`);
                                setTimeout(() => setSavedVocabNotice(null), 2500);
                              }}
                              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                              title={`Lưu "${v.word}" vào Flashcard SRS`}
                            >
                              <PlusCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Safe practice explanation */}
                {!isChoiceCorrect && (
                  <p className="text-[11px] text-slate-500 italic pt-1">
                    💡 Thử lại giúp bạn ghi nhớ kiến thức tốt hơn. Thống kê điểm số và năng lực ban đầu vẫn được ghi nhận từ lần làm đầu tiên nhằm phản ánh trung thực năng lực.
                  </p>
                )}
              </div>
            );
          })()}

          {/* Speaking Mic Interface (If Skill is Speaking) */}
          {currentQ.skill === 'speaking' && (
            <div className="p-6 bg-slate-850 border border-slate-750 rounded-2xl text-center space-y-4">
              <p className="text-xs text-slate-300">
                Nhấn Micro để thu âm phát âm hoặc phát biểu quan điểm của bạn:
              </p>

              {speakingError && (
                <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-300 max-w-md mx-auto text-left">
                  {speakingError}
                </div>
              )}

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleToggleSpeakingRecord}
                  className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto transition-all shadow-xl ${
                    isRecording 
                      ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-500/40' 
                      : 'bg-gradient-to-tr from-cyan-500 to-teal-400 text-slate-950 hover:scale-105'
                  }`}
                  aria-label={isRecording ? 'Dừng thu âm' : 'Bắt đầu thu âm'}
                >
                  {isRecording ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                </button>
              </div>

              {isRecording && (
                <span className="text-xs text-red-400 font-mono font-bold block animate-pulse">
                  Đang thu âm... ({recordingSeconds}s)
                </span>
              )}

              {/* Fallback Text Input for Speaking if Mic unsupported or user prefers typing */}
              <div className="space-y-2 max-w-lg mx-auto text-left">
                <span className="text-[11px] text-slate-400 font-semibold block">
                  Bản ghi âm hoặc nhập văn bản câu nói của bạn:
                </span>
                <input
                  type="text"
                  value={speakingTranscript}
                  onChange={(e) => {
                    setSpeakingTranscript(e.target.value);
                    setUserAnswers((prev) => ({ ...prev, [currentQ.id]: e.target.value }));
                  }}
                  placeholder="Gõ hoặc nói câu trả lời của bạn tại đây..."
                  className="w-full bg-slate-950 border border-slate-750 focus:border-cyan-500 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Writing Email Interface (If Skill is Writing) */}
          {currentQ.skill === 'writing' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-400">Soạn thảo văn bản phản hồi:</span>
                <span className="text-cyan-400">💡 Khuyến nghị độ dài: 50 – 100 từ</span>
              </div>

              <textarea
                value={writingInput}
                onChange={(e) => {
                  setWritingInput(e.target.value);
                  setUserAnswers((prev) => ({ ...prev, [currentQ.id]: e.target.value }));
                }}
                rows={6}
                placeholder="Dear Mr. Davis, Thank you for contacting our support team..."
                className="w-full bg-slate-950 border border-slate-750 focus:border-cyan-500 rounded-2xl p-4 text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none leading-relaxed font-sans"
              />

              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Số từ hiện tại: <strong className="text-white">{writingInput.trim().split(/\s+/).filter(Boolean).length}</strong> từ</span>
                <span>(Bỏ trống sẽ nhận 0 điểm)</span>
              </div>
            </div>
          )}

          {/* Navigation Controls: Previous / Next Question */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              disabled={currentQuestionIdx === 0}
              onClick={() => setCurrentQuestionIdx((prev) => prev - 1)}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-750 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 font-bold rounded-xl text-xs transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              Câu Trước
            </button>

            {currentQuestionIdx + 1 < examQuestions.length ? (
              <button
                onClick={() => setCurrentQuestionIdx((prev) => prev + 1)}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-md shadow-amber-500/20 transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 flex items-center gap-1.5"
              >
                <span>Câu Tiếp</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setShowConfirmModal(true)}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                Hoàn Thành & Nộp Bài
              </button>
            )}
          </div>

          {/* Confirmation Modal Before Submission */}
          {showConfirmModal && (() => {
            const flaggedCount = Object.values(bookmarkedQuestions).filter(Boolean).length;
            return (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-modal-title"
                tabIndex={-1}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setShowConfirmModal(false);
                  }
                }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 text-amber-400">
                      <AlertTriangle className="w-5 h-5" />
                      <h4 id="confirm-modal-title" className="text-base font-black text-white">Xác Nhận Nộp Bài Thi</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowConfirmModal(false)}
                      className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800"
                      aria-label="Đóng bảng xác nhận"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs text-slate-300">
                    <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Tổng số câu hỏi:</span>
                        <strong className="text-white">{examQuestions.length} câu</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Đã trả lời (Answered):</span>
                        <strong className="text-emerald-400">{answeredCount} câu</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Chưa trả lời (Unanswered):</span>
                        <strong className={unansweredCount > 0 ? 'text-amber-400' : 'text-slate-400'}>
                          {unansweredCount} câu
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Đánh dấu xem lại (Flagged):</span>
                        <strong className={flaggedCount > 0 ? 'text-cyan-400' : 'text-slate-400'}>
                          {flaggedCount} câu
                        </strong>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-800/80">
                        <span className="text-slate-400">Thời gian còn lại:</span>
                        <strong className="text-amber-300 font-mono text-sm">{formatTimer(timeLeft)}</strong>
                      </div>
                    </div>

                    {unansweredCount > 0 ? (
                      <p className="text-amber-300/90 leading-relaxed">
                        ⚠️ Bạn vẫn còn <strong>{unansweredCount}</strong> câu chưa chọn phương án. Những câu bỏ qua sẽ bị tính 0 điểm.
                      </p>
                    ) : (
                      <p className="text-emerald-400 leading-relaxed">
                        ✓ Bạn đã hoàn thành tất cả các câu hỏi trong đề thi.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    {unansweredCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowConfirmModal(false);
                          const firstUnanswered = examQuestions.findIndex((q) => !userAnswers[q.id]);
                          if (firstUnanswered !== -1) {
                            setCurrentQuestionIdx(firstUnanswered);
                          }
                        }}
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-xl text-xs transition-all"
                      >
                        Xem Lại Câu Chưa Làm
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleSubmitExam}
                      disabled={isSubmitting}
                      aria-busy={isSubmitting}
                      className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 flex items-center justify-center gap-1.5"
                    >
                      <span>Xác Nhận Nộp Bài</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MÀN HÌNH BÁO CÁO KẾT QUẢ & REVIEW CHI TIẾT (SCORE REPORT)              */}
      {/* ========================================================================= */}
      {stage === 'report' && scoreResult && (
        <div className="space-y-6 animate-fadeIn motion-reduce:animate-none">
          
          {/* Phiếu Điểm TOEIC Mô Phỏng ETS */}
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-10 shadow-2xl text-center space-y-6">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-amber-400">
                Báo Cáo Đánh Giá Năng Lực Mô Phỏng TOEIC (Ước Lượng Thang Điểm ETS)
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white">
                Kết Quả Khảo Sát Năng Lực TOEIC
              </h2>
              <div className="flex items-center justify-center gap-2 pt-1">
                <span className={`px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                  scoreResult.experienceMode === 'diagnostic'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : scoreResult.experienceMode === 'practice'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}>
                  Chế độ {scoreResult.experienceMode || 'practice'}
                </span>
                <span className="px-2.5 py-1 bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold uppercase">
                  {scoreResult.skillScope || (scoreResult.is4Skills ? '4-skills' : '2-skills')}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Học viên: <strong className="text-white">{profile.name}</strong> • Ngày đánh giá: {new Date().toLocaleDateString('vi-VN')}
              </p>
            </div>

            {/* Score Display (Practice Learning Session vs Diagnostic CAT Report vs Generic 2-Skills / 4-Skills) */}
            {scoreResult.experienceMode === 'practice' ? (
              <div className="space-y-6">
                {/* Practice Learning Banner */}
                <div className="p-6 sm:p-8 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border-2 border-emerald-500/40 rounded-3xl text-left space-y-5 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <span className="px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 inline-block mb-2">
                        Practice Learning Summary
                      </span>
                      <h3 className="text-xl sm:text-2xl font-black text-white">
                        Tổng Kết Buổi Luyện Tập TOEIC
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Triết lý: <strong>Học trong khi làm</strong> • Nắm vững kiến thức qua từng câu hỏi
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-xs text-slate-400 uppercase font-bold block">Độ chính xác lần đầu</span>
                      <span className="text-3xl sm:text-4xl font-black text-emerald-400">
                        {scoreResult.practiceStats?.accuracy ?? scoreResult.overallAccuracy}%
                      </span>
                    </div>
                  </div>

                  {/* 4 Core Practice Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-slate-900/80 rounded-2xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">Đúng lần đầu (First Attempt)</span>
                      <strong className="text-xl font-black text-white">
                        {scoreResult.practiceStats?.firstAttemptCorrect ?? scoreResult.listeningCorrect + scoreResult.readingCorrect}
                      </strong>
                      <span className="text-[10px] text-slate-500 block">/ {examQuestions.length} câu</span>
                    </div>

                    <div className="p-3.5 bg-slate-900/80 rounded-2xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">Làm chủ sau sửa lỗi (Retry)</span>
                      <strong className="text-xl font-black text-cyan-400">
                        {scoreResult.practiceStats?.retryCorrect ?? 0}
                      </strong>
                      <span className="text-[10px] text-slate-500 block">câu sửa sai thành công</span>
                    </div>

                    <div className="p-3.5 bg-slate-900/80 rounded-2xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">Điểm quy đổi tham khảo</span>
                      <strong className="text-xl font-black text-amber-400">
                        {scoreResult.totalScore}
                      </strong>
                      <span className="text-[10px] text-slate-500 block">/ 990 điểm ETS</span>
                    </div>

                    <div className="p-3.5 bg-slate-900/80 rounded-2xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">Trình độ CEFR tương đương</span>
                      <strong className="text-xl font-black text-emerald-400">
                        {scoreResult.cefrLevel}
                      </strong>
                      <span className="text-[10px] text-slate-500 block">Khảo sát năng lực</span>
                    </div>
                  </div>

                  {/* Knowledge Covered Summary */}
                  {(() => {
                    const grammarSet = new Set<string>();
                    const vocabTagSet = new Set<string>();
                    examQuestions.forEach((q) => {
                      q.grammarTags?.forEach((g) => grammarSet.add(g));
                      q.vocabularyTags?.forEach((v) => vocabTagSet.add(v));
                    });
                    const grammarList = Array.from(grammarSet).slice(0, 8);
                    const vocabList = Array.from(vocabTagSet).slice(0, 8);

                    return (
                      <div className="space-y-3 pt-2 border-t border-slate-800 text-xs">
                        <span className="font-bold text-slate-300 block uppercase tracking-wider text-[11px]">
                          Kiến thức đã tiếp cận trong buổi học:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {grammarList.map((g, idx) => (
                            <span key={`g-${idx}`} className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 rounded-lg font-mono text-[11px]">
                              📚 {g}
                            </span>
                          ))}
                          {vocabList.map((v, idx) => (
                            <span key={`v-${idx}`} className="px-2.5 py-1 bg-teal-500/10 border border-teal-500/30 text-teal-300 rounded-lg font-mono text-[11px]">
                              🏷️ {v}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Safety Notice about First Attempt Invariant */}
                  <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Điểm số bài thi và XP thưởng được tính toán nghiêm ngặt dựa trên <strong>kết quả trả lời lần đầu tiên</strong>, bảo toàn tính trung thực và ngăn ngừa spam điểm khi thử lại.
                    </span>
                  </div>
                </div>
              </div>
            ) : scoreResult.diagnosticReport ? (
              <div className="space-y-6">
                {/* Banner Thông Báo Ước Lượng Thích Ứng (ETS Disclaimer & Confidence) */}
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-left space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      <span>Ước Tính Khoảng Điểm TOEIC (Diagnostic CAT Estimate)</span>
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                      scoreResult.diagnosticReport.confidence === 'High'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : scoreResult.diagnosticReport.confidence === 'Medium'
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    }`}>
                      Độ tin cậy: {scoreResult.diagnosticReport.confidence === 'High' ? 'Cao (High)' : scoreResult.diagnosticReport.confidence === 'Medium' ? 'Trung bình (Medium)' : 'Thấp (Low)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    ⚠️ Kết quả này là <strong>ước lượng khoảng điểm năng lực</strong> được suy luận qua thuật toán thích ứng (CAT), <strong>không phải chứng chỉ hoặc bảng điểm ETS chính thức</strong>. {scoreResult.diagnosticReport.confidenceReason}
                  </p>
                </div>

                {/* Score Range Display */}
                <div className="py-2">
                  <div className="inline-block p-6 sm:p-8 bg-slate-950/80 border border-amber-500/40 rounded-3xl shadow-xl">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      Ước Tính Khoảng Điểm TOEIC Dự Kiến
                    </span>
                    <span className="text-4xl sm:text-6xl font-black bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
                      {scoreResult.diagnosticReport.estimatedToeicRange.display}
                    </span>
                    <span className="text-xs text-amber-300/80 block mt-1 font-semibold">
                      Trình độ tương đương: {scoreResult.diagnosticReport.estimatedProficiency}
                    </span>
                  </div>
                </div>

                {/* Adaptive Progression Timeline */}
                <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl text-left space-y-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Tiến Trình Thích Ứng (Adaptive Progression)
                  </span>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="px-2.5 py-1 bg-slate-900 rounded-lg border border-slate-800">
                      Bắt đầu: <strong className="text-white capitalize">{scoreResult.diagnosticReport.adaptiveProgression.startDifficulty}</strong>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                    <span className="px-2.5 py-1 bg-slate-900 rounded-lg border border-slate-800">
                      Chạm mức cao nhất: <strong className="text-amber-400 capitalize">{scoreResult.diagnosticReport.adaptiveProgression.highestDifficultyReached}</strong>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                    <span className="px-2.5 py-1 bg-slate-900 rounded-lg border border-slate-800">
                      Kết thúc ở: <strong className="text-cyan-400 capitalize">{scoreResult.diagnosticReport.adaptiveProgression.finalDifficulty}</strong>
                    </span>
                    <span className="text-[11px] text-slate-500">
                      (Đã đánh giá qua {scoreResult.diagnosticReport.adaptiveProgression.questionsAnswered} câu hỏi)
                    </span>
                  </div>
                </div>

                {/* 2 Kỹ Năng Component Cards với Sub-range */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3 text-left">
                      <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                        <Headphones className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 font-semibold block">Listening (Nghe Hiểu)</span>
                        <span className="text-[11px] text-slate-500">
                          Đúng {scoreResult.diagnosticReport.listeningStrength.correctCount}/{scoreResult.diagnosticReport.listeningStrength.totalCount} câu ({scoreResult.diagnosticReport.listeningStrength.accuracyPercent}%)
                        </span>
                        <span className="text-[10px] text-amber-400/90 block mt-0.5 font-medium">
                          Năng lực: {scoreResult.diagnosticReport.listeningStrength.level}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <strong className="text-xl sm:text-2xl font-black text-white">
                        {scoreResult.diagnosticReport.listeningStrength.rangeDisplay}
                      </strong>
                      <span className="text-[10px] text-slate-500 block">/ 495</span>
                    </div>
                  </div>

                  <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3 text-left">
                      <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 font-semibold block">Reading (Đọc Hiểu)</span>
                        <span className="text-[11px] text-slate-500">
                          Đúng {scoreResult.diagnosticReport.readingStrength.correctCount}/{scoreResult.diagnosticReport.readingStrength.totalCount} câu ({scoreResult.diagnosticReport.readingStrength.accuracyPercent}%)
                        </span>
                        <span className="text-[10px] text-emerald-400/90 block mt-0.5 font-medium">
                          Năng lực: {scoreResult.diagnosticReport.readingStrength.level}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <strong className="text-xl sm:text-2xl font-black text-white">
                        {scoreResult.diagnosticReport.readingStrength.rangeDisplay}
                      </strong>
                      <span className="text-[10px] text-slate-500 block">/ 495</span>
                    </div>
                  </div>
                </div>

                {/* Strongest & Weakest Parts Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-2">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Phần Vượt Trội (Strongest Parts)</span>
                    </span>
                    {scoreResult.diagnosticReport.strongestParts.length > 0 ? (
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {scoreResult.diagnosticReport.strongestParts.map((sp) => (
                          <li key={sp.part} className="flex justify-between items-center bg-slate-900/60 p-2 rounded-xl border border-emerald-500/20">
                            <span>{sp.name}</span>
                            <span className="text-emerald-400 font-bold">{sp.correct}/{sp.total} ({sp.accuracy}%)</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Chưa ghi nhận phần nào vượt trội rõ rệt.</p>
                    )}
                  </div>

                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl space-y-2">
                    <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Phần Cần Cải Thiện (Weakest Parts)</span>
                    </span>
                    {scoreResult.diagnosticReport.weakestParts.length > 0 ? (
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {scoreResult.diagnosticReport.weakestParts.map((wp) => (
                          <li key={wp.part} className="flex justify-between items-center bg-slate-900/60 p-2 rounded-xl border border-red-500/20">
                            <span>{wp.name}</span>
                            <span className="text-red-400 font-bold">{wp.correct}/{wp.total} ({wp.accuracy}%)</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-emerald-400 font-semibold">Tất cả các phần khảo sát đều đạt độ chính xác 100%!</p>
                    )}
                  </div>
                </div>

                {/* Grammar & Vocabulary Weaknesses (Real Evidence Only) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                      Lỗ Hổng Ngữ Pháp (Grammar Weakness)
                    </span>
                    {scoreResult.diagnosticReport.grammarWeaknesses.length > 0 ? (
                      <ul className="space-y-1.5 text-xs">
                        {scoreResult.diagnosticReport.grammarWeaknesses.slice(0, 4).map((gw) => (
                          <li key={gw.tag} className="p-2 bg-slate-900 rounded-xl border border-slate-850 flex items-center justify-between">
                            <span className="font-semibold text-slate-200">{gw.tag}</span>
                            <span className="text-red-400 font-mono text-[11px]">Sai {gw.errorCount}/{gw.testedCount}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Không có lỗi sai ngữ pháp nào trong các câu đã trả lời.</p>
                    )}
                    <span className="text-[10px] text-slate-500 block">💡 Bằng chứng thu thập từ các câu sai thực tế.</span>
                  </div>

                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                    <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">
                      Lỗ Hổng Từ Vựng (Vocabulary Weakness)
                    </span>
                    {scoreResult.diagnosticReport.vocabularyWeaknesses.length > 0 ? (
                      <ul className="space-y-1.5 text-xs">
                        {scoreResult.diagnosticReport.vocabularyWeaknesses.slice(0, 4).map((vw) => (
                          <li key={vw.tag} className="p-2 bg-slate-900 rounded-xl border border-slate-850 flex items-center justify-between">
                            <span className="font-semibold text-slate-200">{vw.tag}</span>
                            <span className="text-red-400 font-mono text-[11px]">Sai {vw.errorCount}/{vw.testedCount}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Nhận diện tốt vốn từ vựng trong các câu đã hoàn thành.</p>
                    )}
                    <span className="text-[10px] text-slate-500 block">💡 Bằng chứng thu thập từ các câu sai thực tế.</span>
                  </div>
                </div>

                {/* Recommended Next Step Call-To-Action */}
                <div className="p-5 bg-gradient-to-r from-amber-500/20 via-cyan-500/10 to-teal-500/20 border border-amber-500/40 rounded-2xl text-left space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <Sparkles className="w-4 h-4" />
                    <span>Lộ Trình Khuyến Nghị Tiếp Theo</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">
                    {scoreResult.diagnosticReport.recommendedNextStep}
                  </p>
                  <p className="text-[11px] text-slate-400 italic">
                    💡 Để trải nghiệm đầy đủ áp lực phòng thi thật, hãy chọn chế độ <strong>Thi Thử Chuẩn (Mock Test)</strong> ở lần thi tiếp theo!
                  </p>
                </div>
              </div>
            ) : !scoreResult.is4Skills ? (
              <div className="space-y-6">
                <div className="py-2">
                  <div className="inline-block p-6 sm:p-8 bg-slate-950/80 border border-amber-500/40 rounded-3xl shadow-xl">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      Tổng Điểm TOEIC (Listening + Reading)
                    </span>
                    <span className="text-5xl sm:text-6xl font-black bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
                      {scoreResult.totalScore}
                    </span>
                    <span className="text-xs text-slate-400 block mt-1">/ 990 điểm (Độ chính xác: {scoreResult.overallAccuracy}%)</span>
                  </div>
                </div>

                {/* 2 Kỹ Năng Component Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3 text-left">
                      <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                        <Headphones className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 font-semibold block">Listening (Nghe Hiểu)</span>
                        <span className="text-[11px] text-slate-500">Đúng {scoreResult.listeningCorrect}/{scoreResult.listeningTotal} câu</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <strong className="text-2xl font-black text-white">{scoreResult.listeningScore}</strong>
                      <span className="text-[10px] text-slate-500 block">/ 495</span>
                    </div>
                  </div>

                  <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3 text-left">
                      <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 font-semibold block">Reading (Đọc Hiểu)</span>
                        <span className="text-[11px] text-slate-500">Đúng {scoreResult.readingCorrect}/{scoreResult.readingTotal} câu</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <strong className="text-2xl font-black text-white">{scoreResult.readingScore}</strong>
                      <span className="text-[10px] text-slate-500 block">/ 495</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                {/* Certificate 1: TOEIC Listening & Reading (990) */}
                <div className="p-6 bg-slate-950/90 border border-amber-500/30 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-xs font-bold text-amber-400 block uppercase">Phần 1: Khảo Thí LR</span>
                      <h4 className="text-base font-black text-white">TOEIC Listening & Reading</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-amber-400">{scoreResult.totalScore}</span>
                      <span className="text-[10px] text-slate-500 block">/ 990 (Độ chính xác: {scoreResult.overallAccuracy}%)</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Listening</span>
                      <strong className="text-lg font-black text-white">{scoreResult.listeningScore}</strong>
                      <span className="text-slate-500 text-[10px] block">Đúng {scoreResult.listeningCorrect}/{scoreResult.listeningTotal}</span>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Reading</span>
                      <strong className="text-lg font-black text-white">{scoreResult.readingScore}</strong>
                      <span className="text-slate-500 text-[10px] block">Đúng {scoreResult.readingCorrect}/{scoreResult.readingTotal}</span>
                    </div>
                  </div>
                </div>

                {/* Certificate 2: TOEIC Speaking & Writing (400) */}
                <div className="p-6 bg-slate-950/90 border border-cyan-500/30 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-xs font-bold text-cyan-400 block uppercase">Phần 2: Khảo Thí SW</span>
                      <h4 className="text-base font-black text-white">TOEIC Speaking & Writing</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-cyan-400">{scoreResult.totalSWScore || 0}</span>
                      <span className="text-[10px] text-slate-500 block">/ 400</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Speaking (Nói)</span>
                      <strong className={`text-lg font-black ${scoreResult.speakingScore ? 'text-cyan-300' : 'text-slate-500'}`}>
                        {scoreResult.speakingScore || 0}
                      </strong>
                      <span className="text-slate-500 text-[10px] block">/ 200 điểm</span>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Writing (Viết)</span>
                      <strong className={`text-lg font-black ${scoreResult.writingScore ? 'text-cyan-300' : 'text-slate-500'}`}>
                        {scoreResult.writingScore || 0}
                      </strong>
                      <span className="text-slate-500 text-[10px] block">{scoreResult.writingWordCount || 0} từ / 200 điểm</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 space-y-1 pt-1">
                    {scoreResult.speakingFeedback && <p>🎙️ <strong>Nhận xét Nói:</strong> {scoreResult.speakingFeedback}</p>}
                    {scoreResult.writingFeedback && <p>✍️ <strong>Nhận xét Viết:</strong> {scoreResult.writingFeedback}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Time Usage & Exam Pacing Report for Mock Mode (Phase 4) */}
            {scoreResult.experienceMode === 'mock' && (
              <div className="p-5 bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-950 border border-blue-500/30 rounded-2xl text-left space-y-3 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <span className="text-xs font-black uppercase text-blue-400 flex items-center gap-1.5 tracking-wider">
                    <Clock className="w-4 h-4" />
                    <span>Báo Cáo Thời Gian Làm Bài & Phân Phối Tốc Độ (Time Usage & Pacing)</span>
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    Quy chế thi ETS: Strict Timer
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">Thời gian làm bài</span>
                    <strong className="text-lg font-black text-white">
                      {formatTimer(scoreResult.timeSpentSeconds || 0)}
                    </strong>
                    <span className="text-[10px] text-slate-500 block">
                      / {formatTimer((activeSnapshot?.durationMinutes || (examMode === '2skills_mini' ? 15 : examMode === '2skills_full' ? 30 : 35)) * 60)} quy định
                    </span>
                  </div>

                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">Tốc độ trung bình</span>
                    <strong className="text-lg font-black text-cyan-400">
                      ~{Math.round((scoreResult.timeSpentSeconds || 0) / Math.max(1, scoreResult.totalQuestions))}s
                    </strong>
                    <span className="text-[10px] text-slate-500 block">mỗi câu hỏi</span>
                  </div>

                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">Tình trạng nộp bài</span>
                    <strong className="text-xs font-black text-emerald-400 block truncate">
                      {scoreResult.timeSpentSeconds && scoreResult.timeSpentSeconds >= ((activeSnapshot?.durationMinutes || 15) * 60 - 2)
                        ? 'Hết giờ (Auto-submit)'
                        : 'Chủ động nộp bài'}
                    </strong>
                    <span className="text-[10px] text-slate-500 block">Bảo toàn kết quả</span>
                  </div>

                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">Quy đổi CEFR</span>
                    <strong className="text-lg font-black text-amber-400">
                      Level {scoreResult.cefrLevel}
                    </strong>
                    <span className="text-[10px] text-slate-500 block">Mô phỏng ETS</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>
                    <strong>Mở khóa toàn bộ:</strong> Toàn bộ đáp án chính thức, lời giải chi tiết (Explanations), bản dịch tiếng Việt và tính năng lưu từ vựng Flashcard SRS hiện đã được mở khóa để bạn tra cứu và rà soát bài làm bên dưới.
                  </span>
                </div>
              </div>
            )}

            {/* Performance Breakdown by Part */}
            {scoreResult.partBreakdown && scoreResult.partBreakdown.length > 0 && (
              <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-2xl text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    <span>Phân Tích Chi Tiết Từng Phần (Part Breakdown)</span>
                  </span>
                  <span className="text-[11px] text-slate-400">Độ chính xác theo Part</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {scoreResult.partBreakdown.map((p) => (
                    <div key={p.part} className="p-3 bg-slate-900 rounded-xl border border-slate-850 space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-300">{p.partName}</span>
                        <span className={`font-bold ${p.accuracy >= 75 ? 'text-emerald-400' : p.accuracy >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                          {p.correct}/{p.total} ({p.accuracy}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            p.accuracy >= 75 ? 'bg-emerald-500' : p.accuracy >= 50 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${p.accuracy}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strengths & Areas to Improve Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Điểm Mạnh Của Bạn (Strengths)</span>
                </span>
                <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                  {scoreResult.strengths.map((str, idx) => (
                    <li key={idx} className="leading-relaxed">{str}</li>
                  ))}
                </ul>
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Điểm Cần Cải Thiện (Areas to Improve)</span>
                </span>
                <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                  {scoreResult.areasToImprove.map((area, idx) => (
                    <li key={idx} className="leading-relaxed">{area}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* CEFR Level & Roadmap */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-left space-y-1.5 text-xs text-slate-200">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <ShieldCheck className="w-4 h-4" />
                <span>Quy Đổi Trình Độ Tương Đương: CEFR Level {scoreResult.cefrLevel}</span>
              </div>
              <p className="leading-relaxed">{scoreResult.cefrDescription}</p>
              <p className="text-slate-400 italic">💡 Lộ trình khuyến nghị: {scoreResult.recommendation}</p>
            </div>

            {/* Action Buttons via NextActionPanel (Phase 6 TOEIC Session Experience) */}
            <div className="pt-2 flex flex-col items-center justify-center gap-3">
              <NextActionPanel
                actions={[
                  {
                    id: 'next-action-today-hub',
                    label: 'Về Kế Hoạch Hôm Nay',
                    variant: 'primary',
                    onClick: () => navigateToTab('dashboard'),
                  },
                  {
                    id: 'save-vocab-srs',
                    label: 'Lưu Tất Cả Từ Vựng Bài Thi Vào Flashcard SRS',
                    variant: 'secondary',
                    onClick: handleSaveAllKeyVocabToSRS,
                  },
                  {
                    id: 'new-exam',
                    label: 'Thi Bài Mới',
                    variant: 'secondary',
                    onClick: () => setStage('lobby'),
                  },
                ]}
              />
            </div>

            {savedVocabNotice && (
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 animate-bounce">
                <Check className="w-4 h-4" />
                <span>{savedVocabNotice}</span>
              </div>
            )}
          </div>

          {/* Dashboard Phân Tích Chuyên Sâu & Hồ Sơ Điểm Yếu (Phase 4) */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowReportAnalytics((prev) => !prev)}
              className="w-full py-3.5 px-5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl flex items-center justify-between text-xs font-bold text-amber-400 transition-colors shadow-lg"
            >
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-4 h-4 text-amber-400" />
                <span>Hồ Sơ Năng Lực Dài Hạn & Kế Hoạch Can Thiệp (Analytics Dashboard)</span>
              </div>
              <span className="text-[11px] text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
                {showReportAnalytics ? 'Thu gọn ▲' : 'Mở rộng ▼'}
              </span>
            </button>

            {showReportAnalytics && (
              <ToeicAnalyticsDashboard
                profile={weaknessProfile}
                currentAttempt={latestAttemptAnalytics}
                onExecuteAction={handleExecuteRecommendation}
              />
            )}
          </div>

          {/* Phân tích chi tiết từng câu trong bài thi kèm bộ lọc review */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <span>Phân Tích Chi Tiết & Lời Giải Thích Từng Câu</span>
              </h3>

              {/* Bộ lọc Review Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setReviewFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    reviewFilter === 'all'
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Tất cả ({examQuestions.length})
                </button>
                <button
                  onClick={() => setReviewFilter('wrong')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    reviewFilter === 'wrong'
                      ? 'bg-red-500 text-white font-black'
                      : 'bg-slate-800 text-slate-400 hover:text-red-400'
                  }`}
                >
                  Chỉ câu sai ({examQuestions.filter((q) => userAnswers[q.id] && userAnswers[q.id] !== q.correctAnswer).length})
                </button>
                <button
                  onClick={() => setReviewFilter('correct')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    reviewFilter === 'correct'
                      ? 'bg-emerald-500 text-slate-950 font-black'
                      : 'bg-slate-800 text-slate-400 hover:text-emerald-400'
                  }`}
                >
                  Câu đúng ({scoreResult.listeningCorrect + scoreResult.readingCorrect})
                </button>
                <button
                  onClick={() => setReviewFilter('unanswered')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    reviewFilter === 'unanswered'
                      ? 'bg-slate-700 text-white font-black'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Chưa làm ({examQuestions.filter((q) => !userAnswers[q.id] || userAnswers[q.id] === 'SKIPPED').length})
                </button>
              </div>
            </div>

            {filteredReviewQuestions.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Không có câu hỏi nào khớp với bộ lọc đã chọn.
              </div>
            ) : (
              <div className="space-y-6 divide-y divide-slate-800">
                {filteredReviewQuestions.map((q) => {
                  const originalIndex = examQuestions.findIndex((item) => item.id === q.id);
                  const userChoice = userAnswers[q.id];
                  const isSkipped = !userChoice || userChoice.trim() === '' || userChoice === 'SKIPPED';
                  const isCorrect = !isSkipped && userChoice === q.correctAnswer;
                  const isSpeakingQuestion = q.skill === 'speaking';
                  const isWritingQuestion = q.skill === 'writing';

                  return (
                    <div key={q.id} className="pt-6 space-y-4">
                      
                      {/* Header Question Review */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-amber-400">Câu {originalIndex + 1} ({q.part.toUpperCase()})</span>
                            <span className="text-xs text-slate-500">•</span>
                            
                            {/* Badge Status */}
                            {isSpeakingQuestion ? (
                              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${
                                speakingTranscript ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}>
                                {speakingTranscript ? `🎙️ Đã thu âm (${scoreResult.speakingScore}/200đ)` : '⚪ Chưa thu âm (0đ)'}
                              </span>
                            ) : isWritingQuestion ? (
                              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${
                                writingInput ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}>
                                {writingInput ? `✍️ Đã viết (${scoreResult.writingScore}/200đ)` : '⚪ Chưa viết (0đ)'}
                              </span>
                            ) : isSkipped ? (
                              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg border bg-slate-800 text-slate-400 border-slate-700">
                                ⚪ Chưa làm / Bỏ qua (0đ)
                              </span>
                            ) : isCorrect ? (
                              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                ✓ Chính xác
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg border bg-red-500/20 text-red-400 border-red-500/30">
                                ✗ Chưa chính xác
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm font-bold text-white">{q.questionText}</p>
                        </div>

                        {/* Nút lưu nhanh từ vựng của riêng câu này */}
                        {q.keyVocabulary && q.keyVocabulary.length > 0 && (
                          <button
                            onClick={() => handleSaveQuestionVocabToSRS(q)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-emerald-400 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all shrink-0"
                            title="Lưu từ vựng của câu này vào SRS"
                          >
                            <Bookmark className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Lưu Từ Vựng</span>
                          </button>
                        )}
                      </div>

                      {/* If Part 1: Display Photograph Thumbnail */}
                      {q.part === 'part1_photos' && q.imageUrl && (
                        imageErrorMap[q.id] ? (
                          <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-2xl text-xs text-amber-300 flex items-center gap-2 max-w-sm">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                            <span>Ảnh ngoại tuyến. {q.vietnameseTranslation ? `Mô tả: ${q.vietnameseTranslation}` : ''}</span>
                          </div>
                        ) : (
                          <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 max-w-sm">
                            <img
                              src={q.imageUrl}
                              alt="Part 1 Question Photo"
                              className="w-full h-48 object-cover"
                              onError={() => setImageErrorMap((prev) => ({ ...prev, [q.id]: true }))}
                            />
                          </div>
                        )
                      )}

                      {/* Part 6 & Part 7 Reading Passage with Interactive Lookup during Review Mode */}
                      {q.passage && (
                        <div className="p-4 sm:p-5 bg-slate-950/90 border border-slate-800 rounded-2xl space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs text-amber-400 font-semibold pb-2 border-b border-slate-850">
                            <span className="flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                              <span>Đoạn văn bài đọc ({q.part === 'part6_text' ? 'Part 6: Text Completion' : 'Part 7: Reading Comprehension'}):</span>
                            </span>
                            <span className="text-[11px] text-slate-400 font-normal">
                              💡 Chạm vào bất kỳ từ vựng nào để tra nghĩa & lưu Flashcard SRS
                            </span>
                          </div>
                          <InteractiveReadingPassage
                            content={q.passage}
                            className="text-xs sm:text-sm text-slate-200 font-serif leading-relaxed"
                          />
                        </div>
                      )}

                      {/* Full Transcript of Options */}
                      {q.options && (
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                            Transcript 4 Phương Án (A, B, C, D):
                          </span>
                          <div className="grid grid-cols-1 gap-2">
                            {q.options.map((opt, optIdx) => {
                              const letter = ['A', 'B', 'C', 'D'][optIdx];
                              const isCorrectOpt = letter === q.correctAnswer;
                              const isUserChosen = letter === userChoice;

                              return (
                                <div
                                  key={optIdx}
                                  className={`p-3 rounded-xl border text-xs leading-relaxed flex items-start justify-between gap-3 ${
                                    isCorrectOpt
                                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold ring-1 ring-emerald-500/30'
                                      : isUserChosen
                                      ? 'bg-red-500/15 border-red-500/40 text-red-300 font-medium'
                                      : 'bg-slate-950 border-slate-850 text-slate-400'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[11px] ${
                                      isCorrectOpt ? 'bg-emerald-500 text-slate-950' : isUserChosen ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400'
                                    }`}>
                                      {letter}
                                    </span>
                                    <span>{opt}</span>
                                  </div>

                                  <div className="shrink-0 text-[11px]">
                                    {isCorrectOpt && <span className="text-emerald-400 font-extrabold">✓ Đáp Án Đúng</span>}
                                    {isUserChosen && !isCorrectOpt && <span className="text-red-400 font-bold">✗ Bạn đã chọn</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Speaking / Writing User Input Display */}
                      {isSpeakingQuestion && (
                        <div className="p-3.5 bg-slate-850 border border-slate-800 rounded-xl text-xs text-slate-300 space-y-1">
                          <span className="text-[11px] font-bold text-slate-400 block">Bản ghi âm giọng nói của bạn:</span>
                          <p className={speakingTranscript ? 'text-cyan-300 font-mono italic' : 'text-slate-500 italic'}>
                            {speakingTranscript ? `"${speakingTranscript}"` : 'Bạn đã bỏ qua phần thu âm (0/200 điểm).'}
                          </p>
                        </div>
                      )}

                      {isWritingQuestion && (
                        <div className="p-3.5 bg-slate-850 border border-slate-800 rounded-xl text-xs text-slate-300 space-y-1">
                          <span className="text-[11px] font-bold text-slate-400 block">Nội dung văn bản bạn đã soạn thảo:</span>
                          <p className={writingInput ? 'text-white whitespace-pre-line' : 'text-slate-500 italic'}>
                            {writingInput || 'Bạn đã bỏ qua phần viết (0/200 điểm).'}
                          </p>
                        </div>
                      )}

                      {/* Result Explanation & Vietnamese Translation */}
                      <div className="p-4 bg-slate-850 border border-slate-800 rounded-2xl space-y-2 text-xs text-slate-300">
                        <p className="text-amber-300/90 leading-relaxed font-medium">
                          💡 <strong>Giải thích chi tiết:</strong> {q.explanation}
                        </p>
                        <p className="text-slate-400 italic">
                          🌐 <strong>Bản dịch tiếng Việt:</strong> {q.vietnameseTranslation}
                        </p>
                      </div>

                      {/* Key Vocabulary Pills */}
                      {q.keyVocabulary && q.keyVocabulary.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="text-[10px] text-slate-500 uppercase font-bold">Từ vựng then chốt:</span>
                          {q.keyVocabulary.map((v, vIdx) => (
                            <span key={vIdx} className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-teal-300 rounded-lg text-xs font-mono">
                              {v.word} ({v.ipa}): <strong className="text-white">{v.meaning}</strong>
                            </span>
                          ))}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Popover tra cứu từ vựng nổi theo ngữ cảnh (Contextual Dictionary Lookup) */}
      {lookupWordState && (
        <WordLookupPopover
          wordData={lookupWordState.wordData}
          anchorRect={lookupWordState.rect}
          onClose={() => setLookupWordState(null)}
        />
      )}

    </div>
  );
};
