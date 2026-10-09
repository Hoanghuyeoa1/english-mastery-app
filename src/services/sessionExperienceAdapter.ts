// src/services/sessionExperienceAdapter.ts
/**
 * Shared Session Experience Adapter (Phase 2)
 * 
 * Pure transformation and derivation functions:
 * - Standardizes presentation metrics across all 9 learning flows.
 * - Clamps progress percentages safely (0–100%, integer, NaN/Infinity proof).
 * - Formats duration buckets and time countdowns without crashes.
 * - Derives truthful view models from existing domain states without recomputing
 *   or duplicating business state.
 * - Zero React / Network / Storage mutations.
 */

import type {
  SessionFlowType,
  SessionLifecyclePhase,
  SessionProgressMetric,
  SessionSourceContext,
  FlashcardSessionExperienceModel,
  ReadingSessionExperienceModel,
  ListeningSessionExperienceModel,
  SpeakingSessionExperienceModel,
  WritingSessionExperienceModel,
  ToeicSessionExperienceModel,
  QuizSessionExperienceModel,
  PronunciationSessionExperienceModel,
  TutorSessionExperienceModel,
  SessionExperienceModel,
} from '../types/sessionExperience';
import type { CEFRLevel, ExamMode, ToeicExperienceMode } from '../types';

// =========================================================================
// 1. PURE MATH, CLAMPING & SANITIZATION UTILITIES
// =========================================================================

/**
 * Clamps an unknown numeric value into [min, max], returning fallback if invalid.
 */
export function clampNumber(val: unknown, min: number, max: number, fallback = min): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || Number.isNaN(val)) {
    return fallback;
  }
  if (val < min) return min;
  if (val > max) return max;
  return val;
}

/**
 * Safely computes integer percentage (0–100).
 * Guaranteed to never return NaN, Infinity, or negative numbers.
 */
export function clampProgressPercent(current: unknown, total: unknown): number {
  const safeCurrent = typeof current === 'number' && Number.isFinite(current) ? Math.max(0, current) : 0;
  const safeTotal = typeof total === 'number' && Number.isFinite(total) ? Math.max(0, total) : 0;

  if (safeTotal <= 0) return 0;
  const pct = Math.round((safeCurrent / safeTotal) * 100);
  return Math.min(100, Math.max(0, pct));
}

/**
 * Safely calculates remaining items count >= 0.
 */
export function calculateDiscreteRemaining(total: unknown, answeredOrCurrent: unknown): number {
  const safeTotal = typeof total === 'number' && Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  const safeAnswered = typeof answeredOrCurrent === 'number' && Number.isFinite(answeredOrCurrent)
    ? Math.max(0, Math.floor(answeredOrCurrent))
    : 0;

  return Math.max(0, safeTotal - safeAnswered);
}

/**
 * Performs division with fallback on division-by-zero, NaN, or non-finite inputs.
 */
export function safeDivide(numerator: unknown, denominator: unknown, fallback = 0): number {
  const num = typeof numerator === 'number' && Number.isFinite(numerator) ? numerator : 0;
  const den = typeof denominator === 'number' && Number.isFinite(denominator) ? denominator : 0;

  if (den === 0) return fallback;
  const res = num / den;
  return Number.isFinite(res) && !Number.isNaN(res) ? res : fallback;
}

// =========================================================================
// 2. TIME FORMATTING UTILITIES
// =========================================================================

/**
 * Formats estimated minutes into clean, human-friendly buckets (~5 phút, ~10 phút, ~20 phút).
 * Never yields NaN or Infinity.
 */
export function formatSessionDurationBucket(minutes: unknown, fallback = '~5 phút'): string {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) {
    return fallback;
  }
  const safe = Math.max(1, Math.round(minutes));
  if (safe <= 7) return '~5 phút';
  if (safe <= 12) return '~10 phút';
  if (safe <= 17) return '~15 phút';
  if (safe <= 22) return '~20 phút';
  if (safe <= 27) return '~25 phút';
  return `~${Math.round(safe / 5) * 5} phút`;
}

/**
 * Formats seconds into mm:ss format (e.g. 14:59, 00:00).
 */
export function formatSessionTimeLeft(seconds: unknown): string {
  const safe = typeof seconds === 'number' && Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  const mm = mins.toString().padStart(2, '0');
  const ss = secs.toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

// =========================================================================
// 3. TYPE GUARDS FOR PROGRESS METRICS
// =========================================================================

export function isDiscreteProgressMetric(
  metric: SessionProgressMetric
): metric is Extract<SessionProgressMetric, { kind: 'discrete_items' }> {
  return metric.kind === 'discrete_items';
}

export function isTargetWordsProgressMetric(
  metric: SessionProgressMetric
): metric is Extract<SessionProgressMetric, { kind: 'target_words' }> {
  return metric.kind === 'target_words';
}

export function isTimedProgressMetric(
  metric: SessionProgressMetric
): metric is Extract<SessionProgressMetric, { kind: 'timed_countdown' }> {
  return metric.kind === 'timed_countdown';
}

export function isOpenTurnsProgressMetric(
  metric: SessionProgressMetric
): metric is Extract<SessionProgressMetric, { kind: 'open_turns' }> {
  return metric.kind === 'open_turns';
}

export function isUnboundedProgressMetric(
  metric: SessionProgressMetric
): metric is Extract<SessionProgressMetric, { kind: 'unbounded' }> {
  return metric.kind === 'unbounded';
}

// =========================================================================
// 4. PURE DERIVATION FUNCTIONS FOR THE 9 FLOWS
// =========================================================================

/**
 * 1. Flashcard Flow Model Builder
 */
export function deriveFlashcardSessionModel(input: {
  phase?: SessionLifecyclePhase;
  queueMode: 'DUE' | 'NEW' | 'LEARNED' | 'ALL';
  srsAlgorithm?: 'sm2' | 'fsrs';
  currentIndex: number;
  totalWords: number;
  reviewedCount: number;
  sessionStreak?: number;
  ratingCounts?: { again: number; hard: number; good: number; easy: number };
  observedRetention?: number | null;
  tagLabel?: string;
  sourceContext?: SessionSourceContext;
  hasResumeCheckpoint?: boolean;
}): FlashcardSessionExperienceModel {
  const total = Math.max(0, input.totalWords);
  const reviewed = clampNumber(input.reviewedCount, 0, total);
  const currentIndex = clampNumber(input.currentIndex, 0, Math.max(0, total - 1));
  const remaining = calculateDiscreteRemaining(total, reviewed);
  const progressPercent = clampProgressPercent(reviewed, total);
  const estMins = Math.max(1, Math.round((total * 20) / 60));

  return {
    flowType: 'flashcard',
    phase: input.phase ?? (reviewed >= total && total > 0 ? 'completed' : 'active'),
    title: 'Phiên Học Thẻ SRS',
    subtitle: input.tagLabel ? `Bộ lọc: ${input.tagLabel}` : `Chế độ: ${input.queueMode}`,
    objective: 'Ghi nhớ từ vựng thông minh theo chu kỳ giãn cách khoa học.',
    badgeLabel: input.srsAlgorithm === 'fsrs' ? 'FSRS v4' : 'SM-2',
    estimatedMinutes: estMins,
    durationBucket: formatSessionDurationBucket(estMins),
    queueMode: input.queueMode,
    srsAlgorithm: input.srsAlgorithm ?? 'sm2',
    progressMetric: {
      kind: 'discrete_items',
      currentIndex,
      totalItems: total,
      answeredCount: reviewed,
      remainingCount: remaining,
      progressPercent,
    },
    sessionStreak: Math.max(0, input.sessionStreak ?? 0),
    ratingCounts: input.ratingCounts ?? { again: 0, hard: 0, good: 0, easy: 0 },
    observedRetention: input.observedRetention !== undefined ? input.observedRetention : null,
    tagLabel: input.tagLabel,
    sourceContext: input.sourceContext,
    hasResumeCheckpoint: Boolean(input.hasResumeCheckpoint),
  };
}

/**
 * 2. Reading Flow Model Builder
 */
export function deriveReadingSessionModel(input: {
  phase?: SessionLifecyclePhase;
  lessonId: string;
  title: string;
  cefrLevel: CEFRLevel;
  category?: string;
  readTimeStr?: string;
  currentQuestionIndex?: number;
  totalQuestions: number;
  answeredCount: number;
  correctCount?: number;
  sourceContext?: SessionSourceContext;
  hasResumeCheckpoint?: boolean;
}): ReadingSessionExperienceModel {
  const total = Math.max(0, input.totalQuestions);
  const answered = clampNumber(input.answeredCount, 0, total);
  const currIdx = clampNumber(input.currentQuestionIndex ?? 0, 0, Math.max(0, total - 1));
  const remaining = calculateDiscreteRemaining(total, answered);
  const progressPercent = clampProgressPercent(answered, total);

  let estMins = 8;
  if (input.readTimeStr) {
    const match = input.readTimeStr.match(/(\d+)/);
    if (match) {
      estMins = Math.max(1, parseInt(match[1], 10) + 3);
    }
  }

  const scorePct = input.correctCount !== undefined && total > 0
    ? clampProgressPercent(input.correctCount, total)
    : undefined;

  return {
    flowType: 'reading',
    phase: input.phase ?? 'active',
    title: input.title,
    subtitle: input.category ? `${input.cefrLevel} • ${input.category}` : input.cefrLevel,
    objective: 'Đọc hiểu tương tác và trích xuất từ vựng theo ngữ cảnh.',
    badgeLabel: `Reading ${input.cefrLevel}`,
    estimatedMinutes: estMins,
    durationBucket: formatSessionDurationBucket(estMins),
    lessonId: input.lessonId,
    cefrLevel: input.cefrLevel,
    category: input.category,
    progressMetric: {
      kind: 'discrete_items',
      currentIndex: currIdx,
      totalItems: total,
      answeredCount: answered,
      remainingCount: remaining,
      progressPercent,
    },
    correctCount: input.correctCount,
    scorePercent: scorePct,
    sourceContext: input.sourceContext,
    hasResumeCheckpoint: Boolean(input.hasResumeCheckpoint),
  };
}

/**
 * 3. Listening Flow Model Builder
 */
export function deriveListeningSessionModel(input: {
  phase?: SessionLifecyclePhase;
  lessonId: string;
  title: string;
  cefrLevel: CEFRLevel;
  category?: string;
  durationStr?: string;
  currentQuestionIndex?: number;
  totalQuestions: number;
  answeredCount: number;
  correctCount?: number;
  playbackState?: {
    isPlaying: boolean;
    activeSentenceIndex: number | null;
    audioSpeed: number;
  };
  sourceContext?: SessionSourceContext;
  hasResumeCheckpoint?: boolean;
}): ListeningSessionExperienceModel {
  const total = Math.max(0, input.totalQuestions);
  const answered = clampNumber(input.answeredCount, 0, total);
  const currIdx = clampNumber(input.currentQuestionIndex ?? 0, 0, Math.max(0, total - 1));
  const remaining = calculateDiscreteRemaining(total, answered);
  const progressPercent = clampProgressPercent(answered, total);

  let estMins = 7;
  if (input.durationStr) {
    const mmss = input.durationStr.match(/^(\d+):(\d+)$/);
    if (mmss) {
      estMins = Math.max(1, Math.round(parseInt(mmss[1], 10) + parseInt(mmss[2], 10) / 60 + 3));
    }
  }

  const scorePct = input.correctCount !== undefined && total > 0
    ? clampProgressPercent(input.correctCount, total)
    : undefined;

  return {
    flowType: 'listening',
    phase: input.phase ?? 'active',
    title: input.title,
    subtitle: input.category ? `${input.cefrLevel} • ${input.category}` : input.cefrLevel,
    objective: 'Luyện nghe phản xạ với audio chuẩn bản ngữ và highlight đồng bộ.',
    badgeLabel: `Listening ${input.cefrLevel}`,
    estimatedMinutes: estMins,
    durationBucket: formatSessionDurationBucket(estMins),
    lessonId: input.lessonId,
    cefrLevel: input.cefrLevel,
    category: input.category,
    progressMetric: {
      kind: 'discrete_items',
      currentIndex: currIdx,
      totalItems: total,
      answeredCount: answered,
      remainingCount: remaining,
      progressPercent,
    },
    playbackState: input.playbackState,
    correctCount: input.correctCount,
    scorePercent: scorePct,
    sourceContext: input.sourceContext,
    hasResumeCheckpoint: Boolean(input.hasResumeCheckpoint),
  };
}

/**
 * 4. Speaking Flow Model Builder
 */
export function deriveSpeakingSessionModel(input: {
  phase?: SessionLifecyclePhase;
  promptId: string;
  title: string;
  cefrLevel: CEFRLevel;
  scenario?: string;
  currentTurnIndex: number;
  totalTurns: number;
  currentTurnAccuracy?: number;
  averageAccuracy?: number;
  sourceContext?: SessionSourceContext;
  hasResumeCheckpoint?: boolean;
}): SpeakingSessionExperienceModel {
  const total = Math.max(1, input.totalTurns);
  const currIdx = clampNumber(input.currentTurnIndex, 0, total - 1);
  const remaining = Math.max(0, total - currIdx - 1);
  const progressPercent = clampProgressPercent(currIdx, total);

  return {
    flowType: 'speaking',
    phase: input.phase ?? 'active',
    title: input.title,
    subtitle: input.scenario ?? `${input.cefrLevel} • Đối đáp AI`,
    objective: 'Hội thoại nhập vai nhiều lượt phản xạ tự nhiên.',
    badgeLabel: `Speaking ${input.cefrLevel}`,
    estimatedMinutes: 6,
    durationBucket: '~5 phút',
    promptId: input.promptId,
    cefrLevel: input.cefrLevel,
    scenario: input.scenario,
    progressMetric: {
      kind: 'discrete_items',
      currentIndex: currIdx,
      totalItems: total,
      answeredCount: currIdx,
      remainingCount: remaining,
      progressPercent,
    },
    currentTurnAccuracy: input.currentTurnAccuracy,
    averageAccuracy: input.averageAccuracy,
    sourceContext: input.sourceContext,
    hasResumeCheckpoint: Boolean(input.hasResumeCheckpoint),
  };
}

/**
 * 5. Writing Flow Model Builder
 */
export function deriveWritingSessionModel(input: {
  phase?: SessionLifecyclePhase;
  promptId?: string;
  title?: string;
  isCustomTopic: boolean;
  cefrLevel: CEFRLevel;
  currentWordCount: number;
  minWords: number;
  targetRange?: string;
  isGrading?: boolean;
  overallCefrScore?: number;
  hasAiFeedback?: boolean;
  sourceContext?: SessionSourceContext;
  hasResumeCheckpoint?: boolean;
}): WritingSessionExperienceModel {
  const words = Math.max(0, input.currentWordCount);
  const targetMin = Math.max(10, input.minWords);
  const progressPercent = clampProgressPercent(words, targetMin);

  return {
    flowType: 'writing',
    phase: input.phase ?? (input.overallCefrScore !== undefined ? 'completed' : 'active'),
    title: input.title || (input.isCustomTopic ? 'Viết tự do' : 'Viết luận học thuật'),
    subtitle: `${input.cefrLevel} • Mục tiêu tối thiểu ${targetMin} từ`,
    objective: 'Soạn thảo văn bản và nhận đánh giá 4 tiêu chí CEFR từ AI.',
    badgeLabel: `Writing ${input.cefrLevel}`,
    estimatedMinutes: 15,
    durationBucket: '~15 phút',
    promptId: input.promptId,
    isCustomTopic: input.isCustomTopic,
    cefrLevel: input.cefrLevel,
    progressMetric: {
      kind: 'target_words',
      currentWordCount: words,
      minWords: targetMin,
      targetRange: input.targetRange,
      progressPercent,
    },
    isGrading: Boolean(input.isGrading),
    overallCefrScore: input.overallCefrScore,
    hasAiFeedback: Boolean(input.hasAiFeedback),
    sourceContext: input.sourceContext,
    hasResumeCheckpoint: Boolean(input.hasResumeCheckpoint),
  };
}

/**
 * 6. TOEIC Flow Model Builder
 */
export function deriveToeicSessionModel(input: {
  phase?: SessionLifecyclePhase;
  attemptId: string;
  title?: string;
  examMode: ExamMode;
  experienceMode: ToeicExperienceMode;
  currentQuestionIndex: number;
  totalQuestions: number;
  answeredCount: number;
  timeLeftSeconds: number;
  totalDurationMinutes: number;
  isPaused: boolean;
  scaledScore?: number;
  sourceContext?: SessionSourceContext;
  hasResumeCheckpoint?: boolean;
}): ToeicSessionExperienceModel {
  const total = Math.max(1, input.totalQuestions);
  const answered = clampNumber(input.answeredCount, 0, total);
  const currIdx = clampNumber(input.currentQuestionIndex, 0, total - 1);
  const remaining = calculateDiscreteRemaining(total, answered);
  const progressPercent = clampProgressPercent(answered, total);

  const durationSecs = Math.max(60, input.totalDurationMinutes * 60);
  const timeLeftSecs = clampNumber(input.timeLeftSeconds, 0, durationSecs);
  const timerPercent = clampProgressPercent(durationSecs - timeLeftSecs, durationSecs);

  return {
    flowType: 'toeic',
    phase: input.phase ?? (input.isPaused ? 'paused' : 'active'),
    title: input.title || `TOEIC Exam (${input.examMode})`,
    subtitle: `${input.experienceMode.toUpperCase()} • ${input.totalDurationMinutes} phút`,
    objective: 'Phòng thi chuẩn hoá ETS với tính giờ nghiêm ngặt và đánh giá năng lực.',
    badgeLabel: `TOEIC ${input.experienceMode}`,
    estimatedMinutes: input.totalDurationMinutes,
    durationBucket: `~${input.totalDurationMinutes} phút`,
    attemptId: input.attemptId,
    examMode: input.examMode,
    experienceMode: input.experienceMode,
    itemsMetric: {
      kind: 'discrete_items',
      currentIndex: currIdx,
      totalItems: total,
      answeredCount: answered,
      remainingCount: remaining,
      progressPercent,
      counterFormat: 'answered',
    },
    timerMetric: {
      kind: 'timed_countdown',
      timeLeftSeconds: timeLeftSecs,
      totalDurationSeconds: durationSecs,
      isPaused: input.isPaused,
      progressPercent: timerPercent,
    },
    isPaused: input.isPaused,
    scaledScore: input.scaledScore,
    sourceContext: input.sourceContext,
    hasResumeCheckpoint: Boolean(input.hasResumeCheckpoint),
  };
}

/**
 * 7. Quiz Flow Model Builder
 */
export function deriveQuizSessionModel(input: {
  phase?: SessionLifecyclePhase;
  arcadeMode: 'speed_match' | 'classic_quiz' | 'word_scramble' | 'dictation';
  sourceMode: 'all_vocab' | 'mistake_bank';
  streakCount: number;
  totalXpSession: number;
  completedAnswersCount?: number;
  totalPlannedItems?: number;
  timeLeftSeconds?: number;
  sourceContext?: SessionSourceContext;
}): QuizSessionExperienceModel {
  const isSpeedMatch = input.arcadeMode === 'speed_match';
  let progressMetric: QuizSessionExperienceModel['progressMetric'];

  if (typeof input.totalPlannedItems === 'number' && input.totalPlannedItems > 0) {
    const total = input.totalPlannedItems;
    const answered = clampNumber(input.completedAnswersCount ?? 0, 0, total);
    progressMetric = {
      kind: 'discrete_items',
      currentIndex: answered,
      totalItems: total,
      answeredCount: answered,
      remainingCount: Math.max(0, total - answered),
      progressPercent: clampProgressPercent(answered, total),
      counterFormat: 'answered',
    };
  } else if (isSpeedMatch) {
    progressMetric = {
      kind: 'timed_countdown',
      timeLeftSeconds: clampNumber(input.timeLeftSeconds ?? 60, 0, 60),
      totalDurationSeconds: 60,
      isPaused: false,
      progressPercent: clampProgressPercent(60 - clampNumber(input.timeLeftSeconds ?? 60, 0, 60), 60),
    };
  } else {
    progressMetric = {
      kind: 'unbounded',
      completedCount: Math.max(0, input.completedAnswersCount ?? 0),
      streakCount: Math.max(0, input.streakCount),
    };
  }

  const modeLabels: Record<QuizSessionExperienceModel['arcadeMode'], string> = {
    speed_match: 'Speed Match (Nối từ)',
    classic_quiz: 'Classic Quiz (Trắc nghiệm)',
    word_scramble: 'Word Scramble (Xếp chữ)',
    dictation: 'Dictation (Nghe chép)',
  };

  return {
    flowType: 'quiz',
    phase: input.phase ?? 'active',
    title: `Đấu Trường Arcade: ${modeLabels[input.arcadeMode]}`,
    subtitle: input.sourceMode === 'mistake_bank' ? 'Nguồn: Sổ bẫy lỗi' : 'Nguồn: Toàn bộ từ vựng',
    objective: 'Rèn luyện phản xạ ngôn ngữ và củng cố trí nhớ nhanh.',
    badgeLabel: 'Arcade Arena',
    estimatedMinutes: isSpeedMatch ? 1 : 5,
    durationBucket: isSpeedMatch ? '~1 phút' : '~5 phút',
    arcadeMode: input.arcadeMode,
    sourceMode: input.sourceMode,
    streakCount: Math.max(0, input.streakCount),
    totalXpSession: Math.max(0, input.totalXpSession),
    progressMetric,
    sourceContext: input.sourceContext,
    hasResumeCheckpoint: false,
  };
}

/**
 * 8. Pronunciation Flow Model Builder
 */
export function derivePronunciationSessionModel(input: {
  phase?: SessionLifecyclePhase;
  currentWord: string;
  ipa?: string;
  subMode: 'ai_speech' | 'shadowing' | 'dictation';
  completedWordsCount?: number;
  totalBatchSize?: number;
  lastAccuracyScore?: number | null;
  sourceContext?: SessionSourceContext;
}): PronunciationSessionExperienceModel {
  const progressMetric: PronunciationSessionExperienceModel['progressMetric'] =
    typeof input.totalBatchSize === 'number' && input.totalBatchSize > 0
      ? {
          kind: 'discrete_items',
          currentIndex: Math.max(0, (input.completedWordsCount ?? 0)),
          totalItems: input.totalBatchSize,
          answeredCount: Math.max(0, input.completedWordsCount ?? 0),
          remainingCount: Math.max(0, input.totalBatchSize - (input.completedWordsCount ?? 0)),
          progressPercent: clampProgressPercent(input.completedWordsCount ?? 0, input.totalBatchSize),
          counterFormat: 'answered',
        }
      : {
          kind: 'unbounded',
          completedCount: Math.max(0, input.completedWordsCount ?? 0),
        };

  return {
    flowType: 'pronunciation',
    phase: input.phase ?? 'active',
    title: 'Luyện Phát Âm Chuẩn Bản Xứ',
    subtitle: `Từ vựng: ${input.currentWord}${input.ipa ? ` • /${input.ipa}/` : ''}`,
    objective: 'Nhận diện giọng nói AI và phân tích độ chính xác phát âm âm vị.',
    badgeLabel: 'AI Speech',
    estimatedMinutes: 5,
    durationBucket: '~5 phút',
    currentWord: input.currentWord,
    ipa: input.ipa,
    subMode: input.subMode,
    progressMetric,
    lastAccuracyScore: input.lastAccuracyScore,
    sourceContext: input.sourceContext,
    hasResumeCheckpoint: false,
  };
}

/**
 * 9. AI Tutor Flow Model Builder
 */
export function deriveTutorSessionModel(input: {
  phase?: SessionLifecyclePhase;
  scenarioId: string;
  scenarioTitle: string;
  turnCount: number;
  lastInteractionSummary?: string;
  isAiResponding?: boolean;
  sourceContext?: SessionSourceContext;
  hasResumeCheckpoint?: boolean;
}): TutorSessionExperienceModel {
  const turns = Math.max(0, input.turnCount);

  return {
    flowType: 'tutor',
    phase: input.phase ?? 'active',
    title: `AI Tutor: ${input.scenarioTitle}`,
    subtitle: `${turns} lượt hội thoại`,
    objective: 'Hội thoại tương tác mở với trợ lý Gemini và thu thập telemetry học tập.',
    badgeLabel: 'Gemini AI Tutor',
    estimatedMinutes: 10,
    durationBucket: '~10 phút',
    scenarioId: input.scenarioId,
    progressMetric: {
      kind: 'open_turns',
      turnCount: turns,
      lastInteractionSummary: input.lastInteractionSummary,
    },
    isAiResponding: Boolean(input.isAiResponding),
    sourceContext: input.sourceContext,
    hasResumeCheckpoint: Boolean(input.hasResumeCheckpoint),
  };
}
