// src/components/fourSkills/CEFRCheckpointSessionModal.tsx
/**
 * CEFR Checkpoint Assessment Session Modal (Phase 4)
 *
 * Dedicated Assessment Session View for CEFR Level Checkpoints (A1 -> C2).
 *
 * Invariants:
 * 1. Strictly reuses Session Experience primitives (SessionIntro, SessionProgressHeader, SessionCompleteSummary).
 * 2. Integrated with Learning Continuity (ResumableActivity, upsertResumeActivity, completeResumeActivity).
 * 3. Enforces "Completed Always Wins" — finalized attempts never resurrect in Continue Learning.
 * 4. Truthful progress metric (e.g. 2 / 4 sections completed).
 * 5. Minimal clean persistence — zero audio or DOM object leaks.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  X,
  Clock,
  ShieldCheck,
  Headphones,
  BookOpen,
  Mic,
  PenTool,
  CheckCircle2,
  AlertTriangle,
  Award,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Check,
  Play,
  Square,
  Volume2,
  Loader2,
} from 'lucide-react';
import {
  CEFR_SKILLS_LIST,
  type CefrLevel,
  type CefrSkill,
} from '../../types/levelCertification';
import {
  CheckpointSessionState,
  createInitialCheckpointState,
  startCheckpointSession,
  saveSectionDraft,
  advanceToNextSection,
  finalizeCheckpointAttempt,
  checkpointStateToResumableActivity,
  restoreCheckpointStateFromActivity,
  findResumableCheckpointForLevel,
  buildCheckpointProgressMetric,
  buildCheckpointStagePipelineMetric,
} from '../../services/checkpointSessionLifecycle';
import { resolveCheckpointAssessment } from '../../services/checkpointAssessmentService';
import { CENTRAL_CERTIFICATION_POLICY } from '../../services/levelCertificationService';
import { triggerCelebration } from '../../utils/confettiPolicy';
import {
  submitListeningSection,
  processListeningMistakes,
} from '../../services/listeningCheckpointService';
import {
  submitReadingSection,
  processReadingMistakes,
} from '../../services/readingCheckpointService';
import {
  submitSpeakingSection,
  processSpeakingMistakes,
} from '../../services/speakingCheckpointService';
import {
  submitWritingSection,
  processWritingMistakes,
  countWords,
} from '../../services/writingCheckpointService';
import {
  isSpeechRecognitionSupported,
  getSpeechBrowserSupport,
  startSpeechRecognition,
  type SpeechRecognizerHandle,
} from '../../services/speechService';
import { InteractiveReadingPassage } from '../InteractiveReadingPassage';
import { useAppStore } from '../../store/useAppStore';
import { SessionIntro } from '../session/SessionIntro';
import { SessionProgressHeader } from '../session/SessionProgressHeader';
import { SessionCompleteSummary } from '../session/SessionCompleteSummary';
import type { SessionActionDescriptor } from '../../types/sessionExperience';

export interface CEFRCheckpointSessionModalProps {
  level: CefrLevel;
  isOpen: boolean;
  onClose: () => void;
  onCertified?: (level: CefrLevel) => void;
}

export const CEFRCheckpointSessionModal: React.FC<CEFRCheckpointSessionModalProps> = React.memo(({
  level,
  isOpen,
  onClose,
  onCertified,
}) => {
  const resumeActivities = useAppStore((s) => s.resumeActivities);
  const upsertResumeActivity = useAppStore((s) => s.upsertResumeActivity);
  const completeResumeActivity = useAppStore((s) => s.completeResumeActivity);
  const saveLevelCertification = useAppStore((s) => s.saveLevelCertification);
  const recordMistake = useAppStore((s) => s.recordMistake);
  const vocabularyList = useAppStore((s) => s.vocabularyList);
  const recordCheckpointAttemptResult = useAppStore((s) => s.recordCheckpointAttemptResult);
  const setActiveFourSkill = useAppStore((s) => s.setActiveFourSkill);
  const geminiApiKey = useAppStore((s) => s.geminiApiKey);

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [listeningValidationIssue, setListeningValidationIssue] = useState<string | null>(null);
  const [readingValidationIssue, setReadingValidationIssue] = useState<string | null>(null);
  const [speakingValidationIssue, setSpeakingValidationIssue] = useState<string | null>(null);
  const [activeRecordingTurn, setActiveRecordingTurn] = useState<number | null>(null);
  const [turnEvidenceMeta, setTurnEvidenceMeta] = useState<Record<number, { isTrusted?: boolean; error?: string }>>({});
  const activeSpeechRecognizerRef = useRef<SpeechRecognizerHandle | null>(null);

  // Writing state (Phase 8: Trusted AI Boundary & Offline Retention)
  const [writingValidationIssue, setWritingValidationIssue] = useState<string | null>(null);
  const [isGradingWriting, setIsGradingWriting] = useState(false);
  const [writingGradingError, setWritingGradingError] = useState<string | null>(null);
  const [writingCanRetry, setWritingCanRetry] = useState(false);

  // Resolved assessment metadata for the target level
  const resolvedAssessment = useMemo(() => {
    try {
      return resolveCheckpointAssessment(level);
    } catch {
      return null;
    }
  }, [level]);

  // Check for any stored in-progress attempt for this level
  const storedResumeActivity = useMemo(() => {
    return findResumableCheckpointForLevel(resumeActivities, level);
  }, [resumeActivities, level]);

  // Session state
  const [sessionState, setSessionState] = useState<CheckpointSessionState>(() => {
    if (storedResumeActivity) {
      const restored = restoreCheckpointStateFromActivity(storedResumeActivity);
      if (restored) return restored;
    }
    return createInitialCheckpointState(level);
  });

  const prevIsOpenRef = useRef(false);
  const prevLevelRef = useRef(level);

  // Keep state synchronized only when modal is newly opened or level prop changes
  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    const levelChanged = level !== prevLevelRef.current;

    prevIsOpenRef.current = isOpen;
    prevLevelRef.current = level;

    if (justOpened || levelChanged) {
      const stored = findResumableCheckpointForLevel(useAppStore.getState().resumeActivities, level);
      if (stored) {
        const restored = restoreCheckpointStateFromActivity(stored);
        if (restored && restored.level === level) {
          setSessionState(restored);
          return;
        }
      }
      setSessionState(createInitialCheckpointState(level));
    }
  }, [isOpen, level]);

  // Auto-sync in-progress draft to store so refresh/re-mount never loses answers
  useEffect(() => {
    if (
      sessionState.stage === 'listening' ||
      sessionState.stage === 'reading' ||
      sessionState.stage === 'speaking' ||
      sessionState.stage === 'writing'
    ) {
      const act = checkpointStateToResumableActivity(
        sessionState,
        `CEFR ${sessionState.level} Checkpoint Exam`
      );
      upsertResumeActivity(act);
    }
  }, [sessionState, upsertResumeActivity]);

  // Handlers for intro stage
  const handleStartExam = useCallback(() => {
    setSessionState((prev) => startCheckpointSession(prev));
  }, []);

  const handleStartFresh = useCallback(() => {
    setSessionState(startCheckpointSession(createInitialCheckpointState(level)));
  }, [level]);

  // Section draft changes
  const handleListeningAnswer = useCallback(
    (questionId: string, optionIndex: number) => {
      setSessionState((prev) =>
        saveSectionDraft(prev, {
          listening: { [questionId]: optionIndex },
        })
      );
    },
    []
  );

  const handleReadingAnswer = useCallback(
    (questionId: string, optionIndex: number) => {
      setSessionState((prev) =>
        saveSectionDraft(prev, {
          reading: { [questionId]: optionIndex },
        })
      );
    },
    []
  );

  const handleSpeakingTurn = useCallback(
    (turnIndex: number, transcript: string) => {
      setSessionState((prev) =>
        saveSectionDraft(prev, {
          speaking: { [turnIndex]: transcript },
        })
      );
    },
    []
  );

  const handleWritingText = useCallback(
    (text: string) => {
      setWritingValidationIssue(null);
      setWritingGradingError(null);
      setSessionState((prev) =>
        saveSectionDraft(prev, {
          writing: text,
        })
      );
    },
    []
  );

  // Side-effect when checkpoint reaches result stage
  useEffect(() => {
    if (sessionState.stage === 'result' && sessionState.evaluationResult) {
      // Invariant: Completed Always Wins! Mark completed in continuity store
      completeResumeActivity(sessionState.attemptId);

      const evalRes = sessionState.evaluationResult;

      // Phase 9: Record atomic checkpoint history & preserve highest certification
      if (recordCheckpointAttemptResult) {
        recordCheckpointAttemptResult(evalRes);
      } else if (evalRes.isPassed && saveLevelCertification) {
        const cert = {
          level: sessionState.level,
          certificateId: evalRes.certificateId,
          certifiedAt: evalRes.certifiedAt || Date.now(),
          overallScore: evalRes.overallScore,
          skillScores: {
            listening: evalRes.skillResults.listening.score,
            reading: evalRes.skillResults.reading.score,
            speaking: evalRes.skillResults.speaking.score,
            writing: evalRes.skillResults.writing.score,
          },
          attemptId: sessionState.attemptId,
          verifiedVersion: CENTRAL_CERTIFICATION_POLICY.policyVersion,
          criteriaSummary: {
            overallRequired: evalRes.requiredOverall,
            overallAchieved: evalRes.overallScore,
            floorRequired: CENTRAL_CERTIFICATION_POLICY.levels[sessionState.level].perSkillFloorThreshold,
            minSkillAchieved: Math.min(
              ...CEFR_SKILLS_LIST.map((s) => evalRes.skillResults[s].score)
            ),
            verifiedVersion: CENTRAL_CERTIFICATION_POLICY.policyVersion,
          },
        };
        saveLevelCertification(cert);
      }

      if (evalRes.isPassed) {
        triggerCelebration('major_milestone');
        if (onCertified) {
          onCertified(sessionState.level);
        }
      }
    }
  }, [
    sessionState.stage,
    sessionState.evaluationResult,
    sessionState.attemptId,
    sessionState.level,
    completeResumeActivity,
    recordCheckpointAttemptResult,
    saveLevelCertification,
    onCertified,
  ]);

  // Audio playback controls for Assessment Mode
  const maxAudioPlays = resolvedAssessment?.sections.listening.definition.maxAudioPlays ?? 2;
  const currentAudioPlays = sessionState.listeningAudioPlayCount ?? 0;
  const remainingAudioPlays = Math.max(0, maxAudioPlays - currentAudioPlays);

  const handlePlayAudio = useCallback(() => {
    if (!resolvedAssessment?.sections.listening.lesson?.audioText) {
      setAudioError('Không tìm thấy nội dung audio.');
      return;
    }
    if (currentAudioPlays >= maxAudioPlays) {
      return;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setAudioError('Trình duyệt không hỗ trợ Web Speech Synthesis API.');
      return;
    }

    try {
      window.speechSynthesis.cancel();
    } catch {}

    const textToSpeak = resolvedAssessment.sections.listening.lesson.audioText;
    let utterance: SpeechSynthesisUtterance;
    try {
      utterance = new SpeechSynthesisUtterance(textToSpeak);
    } catch (err: any) {
      setAudioError(err?.message || 'Không thể khởi tạo âm thanh.');
      return;
    }

    utterance.lang = 'en-US';
    utterance.rate = 0.9;

    setIsPlayingAudio(true);
    setAudioError(null);

    // Increment play count
    setSessionState((prev) => ({
      ...prev,
      listeningAudioPlayCount: (prev.listeningAudioPlayCount ?? 0) + 1,
    }));

    utterance.onend = () => {
      setIsPlayingAudio(false);
    };

    utterance.onerror = () => {
      setIsPlayingAudio(false);
      setAudioError('Có lỗi xảy ra khi phát âm thanh.');
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (err: any) {
      setIsPlayingAudio(false);
      setAudioError(err?.message || 'Không thể phát âm thanh.');
    }
  }, [resolvedAssessment, currentAudioPlays, maxAudioPlays]);

  const handleStopAudio = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setIsPlayingAudio(false);
  }, []);

  // Cleanup audio & speech recognition on unmount or close
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
      if (activeSpeechRecognizerRef.current) {
        try {
          activeSpeechRecognizerRef.current.stop();
        } catch {}
        activeSpeechRecognizerRef.current = null;
      }
    };
  }, []);

  // Advancing sections
  const handleAdvanceSection = useCallback(
    (simulatedScore = 80) => {
      setSessionState((prev) => {
        const next = advanceToNextSection(prev, simulatedScore);

        if (next.stage === 'evaluation') {
          // Immediately trigger final evaluation
          const finalResult = finalizeCheckpointAttempt(next, CENTRAL_CERTIFICATION_POLICY);
          return finalResult.state;
        }

        return next;
      });
    },
    []
  );

  const handleCompleteListening = useCallback(() => {
    handleStopAudio();
    setListeningValidationIssue(null);

    const questions = resolvedAssessment?.sections.listening.questions || [];
    const lesson = resolvedAssessment?.sections.listening.lesson;

    const evalResult = submitListeningSection({
      attemptId: sessionState.attemptId,
      level,
      lesson,
      questions,
      userAnswers: sessionState.answers.listening,
    });

    if (evalResult.status === 'insufficient_evidence') {
      if (evalResult.reason === 'no_answers_submitted') {
        setListeningValidationIssue('Vui lòng chọn ít nhất một câu trả lời trước khi chuyển sang phần tiếp theo.');
      } else if (evalResult.reason === 'missing_audio') {
        setListeningValidationIssue('Nguồn âm thanh không hợp lệ hoặc bị thiếu.');
      } else {
        setListeningValidationIssue('Không đủ dữ liệu bằng chứng để đánh giá phần Nghe.');
      }
      return;
    }

    // Process mistakes into Mistake Bank (deduplicated)
    if (lesson) {
      processListeningMistakes({
        attemptId: sessionState.attemptId,
        lessonTitle: lesson.title,
        evaluation: evalResult,
        questions,
        vocabularyList,
        recordMistake,
      });
    }

    // Advance to next section with REAL deterministic score!
    handleAdvanceSection(evalResult.score!);
  }, [
    handleStopAudio,
    resolvedAssessment,
    sessionState.attemptId,
    sessionState.answers.listening,
    level,
    vocabularyList,
    recordMistake,
    handleAdvanceSection,
  ]);

  const handleCompleteReading = useCallback(() => {
    setReadingValidationIssue(null);

    const questions = resolvedAssessment?.sections.reading.questions || [];
    const lesson = resolvedAssessment?.sections.reading.lesson;

    const evalResult = submitReadingSection({
      attemptId: sessionState.attemptId,
      level,
      lesson,
      questions,
      userAnswers: sessionState.answers.reading,
    });

    if (evalResult.status === 'insufficient_evidence') {
      if (evalResult.reason === 'no_answers_submitted') {
        setReadingValidationIssue('Vui lòng chọn ít nhất một câu trả lời trước khi chuyển sang phần tiếp theo.');
      } else if (evalResult.reason === 'missing_passage') {
        setReadingValidationIssue('Nội dung bài đọc không hợp lệ hoặc bị thiếu.');
      } else {
        setReadingValidationIssue('Không đủ dữ liệu bằng chứng để đánh giá phần Đọc hiểu.');
      }
      return;
    }

    // Process mistakes into Mistake Bank (deduplicated)
    if (lesson) {
      processReadingMistakes({
        attemptId: sessionState.attemptId,
        lessonTitle: lesson.title,
        evaluation: evalResult,
        questions,
        vocabularyList,
        recordMistake,
      });
    }

    // Advance to next section with REAL deterministic score!
    handleAdvanceSection(evalResult.score!);
  }, [
    resolvedAssessment,
    sessionState.attemptId,
    sessionState.answers.reading,
    level,
    vocabularyList,
    recordMistake,
    handleAdvanceSection,
  ]);

  const handleStopSpeakingTurn = useCallback(() => {
    if (activeSpeechRecognizerRef.current) {
      try {
        activeSpeechRecognizerRef.current.stop();
      } catch {}
      activeSpeechRecognizerRef.current = null;
    }
    setActiveRecordingTurn(null);
  }, []);

  const handleStartSpeakingTurn = useCallback((turnIndex: number) => {
    // Mic Safety: Never auto-start. Triggered strictly on explicit user action
    if (activeSpeechRecognizerRef.current) {
      try {
        activeSpeechRecognizerRef.current.stop();
      } catch {}
      activeSpeechRecognizerRef.current = null;
    }

    setSpeakingValidationIssue(null);
    setActiveRecordingTurn(turnIndex);

    const handle = startSpeechRecognition({
      continuous: false,
      interimResults: true,
      lang: 'en-US',
      onResult: (transcript, _isFinal) => {
        if (transcript && transcript.trim().length > 0) {
          setSessionState((prev) =>
            saveSectionDraft(prev, {
              speaking: { [turnIndex]: transcript.trim() },
            })
          );
          setTurnEvidenceMeta((prev) => ({
            ...prev,
            [turnIndex]: { isTrusted: true, recordedAt: Date.now() },
          }));
        }
      },
      onError: (_msg, errDetail) => {
        setActiveRecordingTurn(null);
        if (errDetail?.code === 'permission-denied') {
          setSpeakingValidationIssue('Quyền truy cập Microphone bị từ chối. Vui lòng cấp quyền micro để làm bài thi Nói.');
          setTurnEvidenceMeta((prev) => ({
            ...prev,
            [turnIndex]: { isTrusted: false, error: 'permission-denied' },
          }));
        } else if (errDetail?.code === 'not-supported') {
          setSpeakingValidationIssue('Trình duyệt hiện tại chưa hỗ trợ Web Speech API. Vui lòng chuyển sang Chrome hoặc Edge.');
          setTurnEvidenceMeta((prev) => ({
            ...prev,
            [turnIndex]: { isTrusted: false, error: 'not-supported' },
          }));
        } else {
          setSpeakingValidationIssue('Lỗi thu âm: Không thể nhận diện giọng nói.');
          setTurnEvidenceMeta((prev) => ({
            ...prev,
            [turnIndex]: { isTrusted: false, error: errDetail?.code || 'recognition-error' },
          }));
        }
      },
      onEnd: () => {
        setActiveRecordingTurn(null);
      },
    });

    activeSpeechRecognizerRef.current = handle;
  }, []);

  const handleCompleteSpeaking = useCallback(() => {
    handleStopSpeakingTurn();
    setSpeakingValidationIssue(null);

    const turns = resolvedAssessment?.sections.speaking.turns || [];
    const prompt = resolvedAssessment?.sections.speaking.prompt;

    const evalResult = submitSpeakingSection({
      attemptId: sessionState.attemptId,
      level,
      prompt,
      turns,
      spokenTranscripts: sessionState.answers.speaking,
      turnMetadata: turnEvidenceMeta,
    });

    if (evalResult.status === 'insufficient_evidence') {
      if (evalResult.reason === 'unsupported_browser') {
        setSpeakingValidationIssue('Trình duyệt hiện tại chưa hỗ trợ Web Speech API. Vui lòng mở bài thi trên Google Chrome hoặc Microsoft Edge.');
      } else if (evalResult.reason === 'permission_denied') {
        setSpeakingValidationIssue('Quyền Microphone bị từ chối. Vui lòng cấp quyền micro để hoàn thành bài thi Nói.');
      } else if (evalResult.reason === 'empty_transcript' || evalResult.reason === 'uncompleted_turns') {
        setSpeakingValidationIssue('Vui lòng hoàn thành phản xạ giọng nói cho tất cả các lượt đối thoại.');
      } else {
        setSpeakingValidationIssue('Không đủ bằng chứng âm thanh tin cậy để đánh giá phần Nói.');
      }
      return;
    }

    // Process mistakes into Mistake Bank (deduplicated)
    if (prompt) {
      processSpeakingMistakes({
        attemptId: sessionState.attemptId,
        promptTitle: prompt.title,
        evaluation: evalResult,
        turns,
        vocabularyList,
        recordMistake,
      });
    }

    // Advance to next section with REAL deterministic score!
    handleAdvanceSection(evalResult.score!);
  }, [
    handleStopSpeakingTurn,
    resolvedAssessment,
    sessionState.attemptId,
    sessionState.answers.speaking,
    turnEvidenceMeta,
    level,
    vocabularyList,
    recordMistake,
    handleAdvanceSection,
  ]);

  const handleCompleteWriting = useCallback(async () => {
    setWritingValidationIssue(null);
    setWritingGradingError(null);

    const prompt = resolvedAssessment?.sections.writing.prompt;
    const minWords = resolvedAssessment?.sections.writing.definition.minWords || 40;
    const currentWordCount = countWords(sessionState.answers.writing);

    if (currentWordCount === 0) {
      setWritingValidationIssue('Vui lòng nhập bài viết của bạn trước khi nộp bài.');
      return;
    }

    if (currentWordCount < minWords) {
      setWritingValidationIssue(
        `Bài viết cần đạt tối thiểu ${minWords} từ (hiện tại: ${currentWordCount} từ). Vui lòng viết thêm để hoàn thành bài thi.`
      );
      return;
    }

    setIsGradingWriting(true);

    try {
      const evalResult = await submitWritingSection({
        attemptId: sessionState.attemptId,
        level,
        prompt,
        essay: sessionState.answers.writing,
        apiKey: geminiApiKey,
      });

      setIsGradingWriting(false);

      if (evalResult.status === 'insufficient_evidence' || evalResult.status === 'pending') {
        setWritingCanRetry(true);
        if (evalResult.reason === 'offline') {
          setWritingGradingError(
            'Thiết bị đang ngoại tuyến. Bài viết đã được lưu an toàn. Vui lòng kết nối mạng và bấm Thử lại để chấm điểm.'
          );
        } else if (evalResult.reason === 'timeout') {
          setWritingGradingError(
            'Quá trình chấm điểm bị quá thời gian (timeout). Bài viết đã được lưu. Vui lòng bấm Thử lại.'
          );
        } else if (evalResult.reason === 'ai_fallback_untrusted') {
          setWritingGradingError(
            'Không thể cấp chứng chỉ bằng dữ liệu chấm điểm giả lập. Vui lòng kiểm tra kết nối Google Gemini API và thử lại.'
          );
        } else if (evalResult.reason === 'network_error') {
          setWritingGradingError(
            'Lỗi kết nối mạng khi gửi bài viết. Vui lòng kiểm tra đường truyền và bấm Thử lại.'
          );
        } else if (evalResult.reason === 'word_count_insufficient') {
          setWritingValidationIssue(
            `Bài viết cần đạt tối thiểu ${minWords} từ (hiện tại: ${currentWordCount} từ). Vui lòng viết thêm để hoàn thành bài thi.`
          );
        } else {
          setWritingGradingError('Không đủ bằng chứng AI tin cậy để đánh giá bài viết.');
        }
        return;
      }

      // Process mistakes into Mistake Bank (deduplicated, trusted only)
      if (prompt) {
        processWritingMistakes({
          attemptId: sessionState.attemptId,
          promptTitle: prompt.title,
          evaluation: evalResult,
          fullEssay: sessionState.answers.writing,
          vocabularyList,
          recordMistake,
        });
      }

      // Advance to evaluation and result with REAL deterministic score!
      handleAdvanceSection(evalResult.score!);
    } catch (err: any) {
      setIsGradingWriting(false);
      setWritingCanRetry(true);
      setWritingGradingError(err?.message || 'Có lỗi xảy ra khi chấm điểm bài viết.');
    }
  }, [
    resolvedAssessment,
    sessionState.attemptId,
    sessionState.answers.writing,
    level,
    geminiApiKey,
    vocabularyList,
    recordMistake,
    handleAdvanceSection,
  ]);

  const handleExit = useCallback(() => {
    handleStopAudio();
    handleStopSpeakingTurn();
    onClose();
  }, [handleStopAudio, handleStopSpeakingTurn, onClose]);

  if (!isOpen) return null;

  const policy = CENTRAL_CERTIFICATION_POLICY.levels[level] || CENTRAL_CERTIFICATION_POLICY.levels.A1;
  const progressMetric = buildCheckpointProgressMetric(sessionState);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Bài thi CEFR ${level} Checkpoint`}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Close Button at Header */}
        <button
          type="button"
          onClick={handleExit}
          className="absolute top-4 right-4 z-20 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          aria-label="Đóng cửa sổ"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 1. STAGE: INTRO */}
        {sessionState.stage === 'intro' && (
          <div className="p-4 sm:p-6 md:p-8 overflow-y-auto space-y-6">
            <SessionIntro
              title={`Bài Thi Đánh Giá Chứng Chỉ CEFR ${level}`}
              subtitle={resolvedAssessment?.definition.description || 'Đánh giá toàn diện 4 kỹ năng theo khung CEFR quốc tế.'}
              badgeLabel={`CEFR ${level}`}
              objective={`Đạt điểm tổng >= ${policy.overallPassThreshold}% và tất cả 4 kỹ năng >= ${policy.perSkillFloorThreshold}% (điểm sàn) để nhận chứng nhận CEFR ${level}.`}
              estimatedDuration={`${resolvedAssessment?.definition.totalTimeMinutes || 45} phút`}
              icon={<ShieldCheck className="w-6 h-6 text-emerald-400" />}
              resumeBanner={
                storedResumeActivity ? (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-3 text-amber-300 text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>
                        Phát hiện bài làm dở dang (đã hoàn thành {storedResumeActivity.checkpoint.completedSections.length}/4 kỹ năng).
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleStartFresh}
                      className="text-xs text-amber-400 hover:text-amber-200 underline font-semibold"
                    >
                      Làm lại từ đầu
                    </button>
                  </div>
                ) : undefined
              }
              primaryAction={{
                label: storedResumeActivity ? 'Tiếp tục bài làm' : 'Bắt đầu bài thi',
                onClick: storedResumeActivity ? handleStartExam : handleStartExam,
              }}
              secondaryAction={{
                label: 'Hủy / Đóng',
                onClick: onClose,
              }}
            >
              {/* Rules and 4 skills overview */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Cấu trúc 4 phần thi
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-sky-400 font-bold text-xs">
                      <Headphones className="w-3.5 h-3.5" />
                      <span>1. Listening</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {resolvedAssessment?.sections.listening.questions.length || 3} câu hỏi nghe hiểu
                    </p>
                  </div>

                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>2. Reading</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {resolvedAssessment?.sections.reading.questions.length || 3} câu hỏi đọc hiểu
                    </p>
                  </div>

                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-violet-400 font-bold text-xs">
                      <Mic className="w-3.5 h-3.5" />
                      <span>3. Speaking</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {resolvedAssessment?.sections.speaking.turns.length || 2} lượt hội thoại tương tác
                    </p>
                  </div>

                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                      <PenTool className="w-3.5 h-3.5" />
                      <span>4. Writing</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Bài viết &gt;= {resolvedAssessment?.sections.writing.definition.minWords || 80} từ
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Quy chế đánh giá nghiêm ngặt</span>
                  </h4>
                  <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
                    <li>Không sử dụng tra từ điển hay xem trước đáp án trong khi làm bài.</li>
                    <li>Mỗi kỹ năng phải đạt tối thiểu {policy.perSkillFloorThreshold}% (không bù trừ kỹ năng dưới điểm sàn).</li>
                    <li>Điểm tổng 4 kỹ năng phải đạt tối thiểu {policy.overallPassThreshold}%.</li>
                    <li>Có thể tạm dừng và tiếp tục lại trong vòng 24 giờ mà không mất tiến trình.</li>
                  </ul>
                </div>
              </div>
            </SessionIntro>
          </div>
        )}

        {/* 2. STAGES: LISTENING / READING / SPEAKING / WRITING */}
        {(sessionState.stage === 'listening' ||
          sessionState.stage === 'reading' ||
          sessionState.stage === 'speaking' ||
          sessionState.stage === 'writing') && (
          <div className="flex flex-col flex-1 overflow-hidden p-4 sm:p-6 space-y-4">
            {/* Session Progress Header Primitive */}
            <SessionProgressHeader
              badgeLabel={`CEFR ${level}`}
              metric={progressMetric}
              onExit={handleExit}
              rightSlot={
                <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
                  Phần {sessionState.currentSection.toUpperCase()}
                </span>
              }
            />

            {/* Stage Body */}
            <div className="flex-1 overflow-y-auto bg-slate-950/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-6">
              {/* A. LISTENING SECTION */}
              {sessionState.stage === 'listening' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                      <Headphones className="w-5 h-5" />
                      <span>Phần 1: Listening Comprehension (CEFR {level})</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        data-testid="listening-plays-badge"
                        className={`px-2.5 py-1 rounded-xl font-mono font-bold border ${
                          remainingAudioPlays > 0
                            ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                            : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                        }`}
                      >
                        Lượt nghe: {currentAudioPlays}/{maxAudioPlays} (Còn {remainingAudioPlays} lượt)
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    {resolvedAssessment?.sections.listening.definition.instructions || 'Nghe đoạn audio và trả lời các câu hỏi trắc nghiệm bên dưới.'}
                  </p>

                  {/* Audio Control Panel */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <h5 className="font-bold text-slate-200 text-xs sm:text-sm">
                          {resolvedAssessment?.sections.listening.lesson.title || 'Checkpoint Audio'}
                        </h5>
                        <span className="text-[11px] text-slate-400">
                          Độ dài: {resolvedAssessment?.sections.listening.lesson.duration || '2:30'} • Chế độ: Thi Đánh Giá (Ẩn transcript & gợi ý)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isPlayingAudio ? (
                          <button
                            type="button"
                            data-testid="btn-stop-listening-audio"
                            onClick={handleStopAudio}
                            className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>Dừng nghe</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            data-testid="btn-play-listening-audio"
                            disabled={remainingAudioPlays <= 0}
                            onClick={handlePlayAudio}
                            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-sky-500/20"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>{currentAudioPlays > 0 ? 'Nghe lại audio' : 'Phát audio bài nghe'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {audioError && (
                      <div className="bg-rose-500/15 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{audioError}</span>
                      </div>
                    )}

                    {remainingAudioPlays <= 0 && !isPlayingAudio && (
                      <p className="text-[11px] text-amber-400 italic">
                        * Bạn đã sử dụng hết {maxAudioPlays} lượt nghe theo quy định của kỳ thi. Vui lòng hoàn thành các câu hỏi dựa trên nội dung đã nghe.
                      </p>
                    )}
                  </div>

                  {/* Validation Issue Alert */}
                  {listeningValidationIssue && (
                    <div
                      data-testid="listening-validation-alert"
                      className="bg-amber-500/15 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 flex items-center gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{listeningValidationIssue}</span>
                    </div>
                  )}

                  {/* Question items */}
                  <div className="space-y-3">
                    {resolvedAssessment?.sections.listening.questions.map((q, qIdx) => (
                      <div key={q.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs">
                        <div className="font-bold text-slate-200">
                          Câu {qIdx + 1}: {q.question}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options.map((opt, optIdx) => {
                            const isSelected = sessionState.answers.listening[q.id] === optIdx;
                            return (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() => handleListeningAnswer(q.id, optIdx)}
                                className={`p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-sky-500/20 border-sky-500/50 text-sky-300 font-bold'
                                    : 'bg-slate-850 border-slate-750 text-slate-300 hover:bg-slate-800'
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      data-testid="btn-complete-listening-section"
                      onClick={handleCompleteListening}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
                    >
                      <span>Hoàn thành Listening & Sang Reading</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* B. READING SECTION */}
              {sessionState.stage === 'reading' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                      <BookOpen className="w-5 h-5" />
                      <span>Phần 2: Reading Comprehension (CEFR {level})</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
                      Chế độ: Đánh Giá Năng Lực (Ẩn gợi ý & tra từ)
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">
                    {resolvedAssessment?.sections.reading.definition.instructions || 'Đọc đoạn văn và chọn đáp án chính xác nhất.'}
                  </p>

                  {/* Reading Passage Panel reusing InteractiveReadingPassage with assessment restrictions */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2">
                      <div>
                        <h5 className="font-bold text-slate-200 text-xs sm:text-sm">
                          {resolvedAssessment?.sections.reading.lesson.title || 'Reading Passage'}
                        </h5>
                        <span className="text-[11px] text-slate-400">
                          Thể loại: {resolvedAssessment?.sections.reading.lesson.category || 'Reading'} • Chế độ: Thi Đánh Giá (Vô hiệu hóa tra từ & gợi ý)
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {resolvedAssessment?.sections.reading.lesson.wordCount || 0} từ
                      </span>
                    </div>

                    <div className="max-h-60 overflow-y-auto pr-1">
                      <InteractiveReadingPassage
                        content={resolvedAssessment?.sections.reading.lesson.content?.join('\n\n') || ''}
                        allowDictionaryLookup={false}
                        className="text-xs sm:text-sm leading-relaxed text-slate-300"
                      />
                    </div>
                  </div>

                  {/* Validation Issue Alert */}
                  {readingValidationIssue && (
                    <div
                      data-testid="reading-validation-alert"
                      className="bg-amber-500/15 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 flex items-center gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{readingValidationIssue}</span>
                    </div>
                  )}

                  {/* Question items (No hints, no answer reveal, no explanations in assessment mode) */}
                  <div className="space-y-3">
                    {resolvedAssessment?.sections.reading.questions.map((q, qIdx) => (
                      <div key={q.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs">
                        <div className="font-bold text-slate-200">
                          Câu {qIdx + 1}: {q.question}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options.map((opt, optIdx) => {
                            const isSelected = sessionState.answers.reading[q.id] === optIdx;
                            return (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() => handleReadingAnswer(q.id, optIdx)}
                                className={`p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold'
                                    : 'bg-slate-850 border-slate-750 text-slate-300 hover:bg-slate-800'
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      data-testid="btn-complete-reading-section"
                      onClick={handleCompleteReading}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
                    >
                      <span>Hoàn thành Reading & Sang Speaking</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* C. SPEAKING SECTION */}
              {sessionState.stage === 'speaking' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-violet-400 font-bold text-sm">
                      <Mic className="w-5 h-5" />
                      <span>Phần 3: Speaking Assessment (CEFR {level})</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
                      Chế độ: Đánh Giá Bằng Chứng Giọng Nói Tin Cậy
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">
                    {resolvedAssessment?.sections.speaking.definition.instructions || 'Phản hồi tương tác với đối thoại ngữ cảnh.'}
                  </p>

                  {/* Browser Support Warning if SpeechRecognition is unavailable */}
                  {!isSpeechRecognitionSupported() && (
                    <div
                      data-testid="speaking-unsupported-alert"
                      className="bg-rose-500/15 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 flex items-center gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói. Vui lòng mở bài thi trên Google Chrome hoặc Microsoft Edge để kiểm định kỹ năng Nói.</span>
                    </div>
                  )}

                  {/* Validation Issue Alert */}
                  {speakingValidationIssue && (
                    <div
                      data-testid="speaking-validation-alert"
                      className="bg-amber-500/15 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 flex items-center gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{speakingValidationIssue}</span>
                    </div>
                  )}

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-2">
                    <div className="font-semibold text-slate-200 text-xs sm:text-sm">
                      Tình huống: {resolvedAssessment?.sections.speaking.prompt.scenario || 'Interactive Speaking Scenario'}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Bấm vào nút micro để bắt đầu phát âm phản xạ cho từng lượt. Hệ thống chỉ ghi nhận điểm từ bằng chứng giọng nói thực tế.
                    </p>
                  </div>

                  {/* Speaking turn items with trusted speech recording controls */}
                  <div className="space-y-3">
                    {resolvedAssessment?.sections.speaking.turns.map((t, tIdx) => {
                      const isRecordingThisTurn = activeRecordingTurn === tIdx;
                      const hasTranscript = Boolean(sessionState.answers.speaking[tIdx]);
                      const currentTranscript = sessionState.answers.speaking[tIdx] || '';

                      return (
                        <div key={tIdx} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 text-xs">
                          <div className="font-bold text-violet-300 flex items-center gap-2">
                            <span>Lượt {tIdx + 1}: &quot;{t.partnerPrompt}&quot;</span>
                          </div>

                          <div className="text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-850 space-y-1">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">Mục tiêu phản xạ:</span>
                            <p className="text-slate-200 font-medium">{t.targetSentence}</p>
                          </div>

                          {/* Spoken Transcript display */}
                          {hasTranscript ? (
                            <div
                              data-testid={`speaking-transcript-${tIdx}`}
                              className="bg-slate-950 border border-emerald-500/30 rounded-xl p-3 text-xs space-y-1"
                            >
                              <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold">Giọng nói đã nhận diện:</span>
                              <p className="text-emerald-300 font-mono text-xs">{currentTranscript}</p>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500 italic">
                              Chưa có bản ghi âm cho lượt này. Hãy bấm &quot;Bắt đầu nói&quot; bên dưới.
                            </div>
                          )}

                          {/* Recording Controls (Explicit user action required) */}
                          <div className="flex items-center gap-2 pt-1">
                            {isRecordingThisTurn ? (
                              <button
                                type="button"
                                data-testid={`btn-stop-speaking-turn-${tIdx}`}
                                onClick={handleStopSpeakingTurn}
                                className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer animate-pulse"
                              >
                                <Square className="w-3.5 h-3.5 fill-current" />
                                <span>Đang lắng nghe... (Bấm để hoàn tất)</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                data-testid={`btn-record-speaking-turn-${tIdx}`}
                                onClick={() => handleStartSpeakingTurn(tIdx)}
                                className="px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-violet-500/20"
                              >
                                <Mic className="w-3.5 h-3.5" />
                                <span>{hasTranscript ? 'Ghi âm lại lượt này' : 'Bắt đầu nói lượt này'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-end pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      data-testid="btn-complete-speaking-section"
                      onClick={handleCompleteSpeaking}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
                    >
                      <span>Hoàn thành Speaking & Sang Writing</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* D. WRITING SECTION */}
              {sessionState.stage === 'writing' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                      <PenTool className="w-5 h-5" />
                      <span>Phần 4: Writing Assessment (CEFR {level})</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
                      Chế độ: Đánh Giá Tiêu Chuẩn CEFR Bằng AI Tin Cậy
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">
                    {resolvedAssessment?.sections.writing.definition.instructions || 'Hoàn thành bài viết theo chủ đề.'}
                  </p>

                  {/* Validation Issue Alert */}
                  {writingValidationIssue && (
                    <div
                      data-testid="writing-validation-alert"
                      className="bg-amber-500/15 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 flex items-center gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{writingValidationIssue}</span>
                    </div>
                  )}

                  {/* Grading Error / Offline Alert */}
                  {writingGradingError && (
                    <div
                      data-testid="writing-grading-error-alert"
                      className="bg-rose-500/15 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{writingGradingError}</span>
                      </div>
                      {writingCanRetry && !isGradingWriting && (
                        <button
                          type="button"
                          data-testid="btn-retry-writing-grading"
                          onClick={handleCompleteWriting}
                          className="px-3 py-1 bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-[11px] rounded-lg cursor-pointer shrink-0 transition-colors"
                        >
                          Thử lại
                        </button>
                      )}
                    </div>
                  )}

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 text-xs text-slate-300 space-y-3">
                    <div className="font-semibold text-slate-200 text-xs sm:text-sm">
                      Đề bài: {resolvedAssessment?.sections.writing.prompt.prompt || 'Writing Task'}
                    </div>

                    {resolvedAssessment?.sections.writing.prompt.guidelines && resolvedAssessment.sections.writing.prompt.guidelines.length > 0 && (
                      <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 space-y-1">
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Gợi ý dàn ý:</span>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-400 text-[11px]">
                          {resolvedAssessment.sections.writing.prompt.guidelines.map((g, idx) => (
                            <li key={idx}>{g}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Word count progress indicator */}
                    {(() => {
                      const minWords = resolvedAssessment?.sections.writing.definition.minWords || 40;
                      const maxWords = resolvedAssessment?.sections.writing.definition.maxWords;
                      const curCount = countWords(sessionState.answers.writing);
                      const isCountValid = curCount >= minWords && (!maxWords || curCount <= maxWords);

                      return (
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800 text-[11px]">
                          <span className="text-slate-400">
                            Yêu cầu: tối thiểu <strong className="text-slate-200">{minWords}</strong> từ {maxWords ? `(tối đa ${maxWords} từ)` : ''}
                          </span>
                          <span
                            data-testid="writing-word-count-badge"
                            className={`px-2.5 py-0.5 rounded-lg font-mono font-bold ${
                              isCountValid
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {curCount} từ {curCount < minWords ? `(còn thiếu ${minWords - curCount} từ)` : '✓ Đủ từ'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  <textarea
                    rows={8}
                    placeholder="Viết bài văn của bạn tại đây bằng tiếng Anh..."
                    value={sessionState.answers.writing}
                    disabled={isGradingWriting}
                    onChange={(e) => handleWritingText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-amber-500 leading-relaxed font-mono disabled:opacity-60"
                  />

                  <div className="flex justify-end pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      data-testid="btn-complete-writing-section"
                      disabled={isGradingWriting}
                      onClick={handleCompleteWriting}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGradingWriting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Đang chấm điểm AI...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Nộp bài & Đánh giá kết quả</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. STAGE: RESULT */}
        {sessionState.stage === 'result' && sessionState.evaluationResult && (
          <div className="p-4 sm:p-6 md:p-8 overflow-y-auto space-y-6">
            <SessionCompleteSummary
              title={
                sessionState.evaluationResult.isPassed
                  ? `Chúc Mừng! Bạn Đã Đạt Chứng Chỉ CEFR ${level}!`
                  : `Kết Quả Bài Thi Checkpoint CEFR ${level}`
              }
              subtitle={
                sessionState.evaluationResult.isPassed
                  ? `${level} Mastery • Đạt chuẩn tại English Mastery Hub (Tất cả 4 kỹ năng đạt sàn)`
                  : 'Rất tiếc bài thi chưa đạt tiêu chuẩn cấp chứng chỉ kỳ này. Hãy tiếp tục ôn luyện các kỹ năng chưa đạt sàn để thi lại.'
              }
              scoreText={`${sessionState.evaluationResult.overallScore}%`}
              scoreSubtext="Điểm tổng kết CEFR"
              accuracyRate={sessionState.evaluationResult.overallScore}
              accuracyLabel="Mức độ đạt chuẩn"
              itemsCompletedCount={4}
              itemsCompletedLabel="Kỹ năng hoàn thành"
              breakdownSlot={
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Chi tiết điểm 4 kỹ năng vs Tiêu chuẩn sàn ({policy.perSkillFloorThreshold}%)</span>
                    </h4>
                    <span
                      data-testid="result-outcome-badge"
                      className={`text-xs font-black px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 w-fit ${
                        sessionState.evaluationResult.isPassed
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {sessionState.evaluationResult.isPassed
                        ? '✓ Đạt Chuẩn (Certified)'
                        : '✗ Cần Củng Cố (Needs Reinforcement)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                    {Object.values(sessionState.evaluationResult.skillResults).map((sk) => (
                      <div
                        key={sk.skill}
                        data-testid={`skill-result-${sk.skill}`}
                        className={`p-3 rounded-xl border ${
                          sk.passedFloor
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300 ring-1 ring-rose-500/40'
                        }`}
                      >
                        <span className="text-[11px] block font-bold capitalize text-slate-300">
                          {sk.skill}
                        </span>
                        <strong className="text-base font-black">
                          {sk.score}%
                        </strong>
                        <span className="text-[10px] block font-medium mt-0.5">
                          {sk.passedFloor ? '✓ Đạt sàn' : '✗ Dưới sàn (Cần củng cố)'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {sessionState.evaluationResult.isPassed && (
                    <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300 flex items-center justify-between">
                      <span>Mã xác thực đạt chuẩn English Mastery Hub:</span>
                      <span className="font-mono font-bold tracking-wider">
                        {sessionState.evaluationResult.certificateId}
                      </span>
                    </div>
                  )}

                  {!sessionState.evaluationResult.isPassed &&
                    sessionState.evaluationResult.failingReasons.length > 0 && (
                      <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 space-y-1">
                        <span className="font-bold block">Lý do chưa đạt:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                          {sessionState.evaluationResult.failingReasons.map((r, idx) => (
                            <li key={idx}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {!sessionState.evaluationResult.isPassed &&
                    sessionState.evaluationResult.reinforcementRoutes &&
                    sessionState.evaluationResult.reinforcementRoutes.length > 0 && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2 text-xs text-amber-200">
                        <span className="font-bold flex items-center gap-1.5 text-amber-300">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          Lộ trình củng cố đề xuất:
                        </span>
                        <div className="space-y-2">
                          {sessionState.evaluationResult.reinforcementRoutes.map((route) => (
                            <div
                              key={route.skill}
                              className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 border border-slate-800"
                            >
                              <div className="pr-2">
                                <strong className="block text-slate-200">{route.title}</strong>
                                <p className="text-[11px] text-slate-400">{route.description}</p>
                              </div>
                              <button
                                onClick={() => {
                                  setActiveFourSkill?.(route.activeSkill);
                                  onClose();
                                }}
                                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0"
                              >
                                Luyện Ngay
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              }
              actions={
                !sessionState.evaluationResult.isPassed &&
                sessionState.evaluationResult.reinforcementRoutes &&
                sessionState.evaluationResult.reinforcementRoutes.length > 0
                  ? [
                      {
                        id: 'reinforce',
                        label: sessionState.evaluationResult.reinforcementRoutes[0].title,
                        isPrimary: true,
                        onClick: () => {
                          const evalRes = sessionState.evaluationResult;
                          if (evalRes && !evalRes.isPassed && evalRes.reinforcementRoutes?.[0]) {
                            const firstRoute = evalRes.reinforcementRoutes[0];
                            setActiveFourSkill?.(firstRoute.activeSkill);
                          }
                          onClose();
                        },
                      },
                      {
                        id: 'close',
                        label: 'Đóng và Trở Về',
                        variant: 'secondary',
                        onClick: onClose,
                      },
                    ]
                  : [
                      {
                        id: 'close',
                        label: 'Đóng và Trở Về',
                        isPrimary: true,
                        onClick: onClose,
                      },
                    ]
              }
            />
          </div>
        )}
      </div>
    </div>
  );
});

CEFRCheckpointSessionModal.displayName = 'CEFRCheckpointSessionModal';
