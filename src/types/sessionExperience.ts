// src/types/sessionExperience.ts
/**
 * Shared Session Experience Foundation Types (Phase 2)
 * 
 * Invariants:
 * 1. Discriminated union across all 9 learning flows.
 * 2. Strictly serves presentation, orchestration, and derived session metadata.
 * 3. Never copies business state or duplicates persistent store records.
 * 4. Never creates fake progress percentages for open-ended or unbounded sessions.
 * 5. 100% type-safe without `any`.
 */

import type { CEFRLevel } from './cefr';
import type { ExamMode, ToeicExperienceMode } from './toeic';

export type PracticeModuleId =
  | 'flashcard'
  | 'classic_quiz'
  | 'word_scramble'
  | 'dictation'
  | 'listening'
  | 'speaking'
  | 'pronunciation'
  | 'shadowing'
  | 'collocation'
  | 'cloze'
  | 'reading'
  | 'writing'
  | 'toeic'
  | 'tutor';


/**
 * 9 learning flows supported in English Mastery Hub
 */
export type SessionFlowType =
  | 'flashcard'
  | 'reading'
  | 'listening'
  | 'speaking'
  | 'writing'
  | 'toeic'
  | 'quiz'
  | 'pronunciation'
  | 'tutor'
  | 'checkpoint';

/**
 * Lifecycle phase of a session
 */
export type SessionLifecyclePhase =
  | 'before'     // Lobby / catalog / queue setup
  | 'active'     // In-progress active session
  | 'paused'     // Temporarily halted / checkpoint saved
  | 'completed'  // Finished / summary available
  | 'abandoned'; // Discarded / cancelled / reset

/**
 * Truthful, non-coerced progress metric discriminated union.
 * Prevents faking percentage for open-ended or word-based sessions.
 */
export type SessionProgressMetric =
  | {
      kind: 'discrete_items';
      currentIndex: number;     // 0-indexed
      totalItems: number;       // e.g. 15 cards, 5 questions, 3 turns
      answeredCount: number;    // items answered so far
      remainingCount: number;   // totalItems - answeredCount
      progressPercent: number;  // 0-100 integer
      counterFormat?: 'answered' | 'index'; // 'answered' displays `${answeredCount} / ${totalItems}`
    }
  | {
      kind: 'target_words';
      currentWordCount: number;
      minWords: number;
      targetRange?: string;     // e.g. "150 - 200 từ"
      progressPercent: number;  // Math.min(100, Math.round((currentWordCount / minWords) * 100))
    }
  | {
      kind: 'stage_pipeline';
      currentStageId: string;
      stages: Array<{
        id: string;
        label: string;
      }>;
      progressPercent?: number; // optional stage completion percent
    }
  | {
      kind: 'timed_countdown';
      timeLeftSeconds: number;
      totalDurationSeconds: number;
      isPaused: boolean;
      progressPercent: number;  // Math.min(100, Math.round(((total - left) / total) * 100))
    }
  | {
      kind: 'open_turns';
      turnCount: number;
      lastInteractionSummary?: string;
      // Invariant: NO progressPercent here for open-ended conversations!
    }
  | {
      kind: 'unbounded';
      completedCount: number;
      streakCount?: number;
      // Invariant: NO totalItems or progressPercent here for arcade endless loop!
    };

/**
 * Presentation context originating from Today Learning Plan / Adaptive Router
 */
export interface SessionSourceContext {
  todayPlanTaskId?: string;
  sourceModule?: PracticeModuleId;
  targetLessonId?: string;
  targetItemIds?: string[];
  mistakeType?: string;
  recommendedCefr?: CEFRLevel;
  initiatedAt?: number;
}

/**
 * Base presentation contract shared across all session experiences
 */
export interface BaseSessionExperienceModel {
  flowType: SessionFlowType;
  phase: SessionLifecyclePhase;
  title: string;
  subtitle?: string;
  objective?: string;
  badgeLabel?: string;
  estimatedMinutes?: number;
  durationBucket?: string;
  sourceContext?: SessionSourceContext;
  hasResumeCheckpoint?: boolean;
}

/**
 * 1. Flashcard Session Model
 */
export interface FlashcardSessionExperienceModel extends BaseSessionExperienceModel {
  flowType: 'flashcard';
  queueMode: 'DUE' | 'NEW' | 'LEARNED' | 'ALL';
  srsAlgorithm: 'sm2' | 'fsrs';
  progressMetric: Extract<SessionProgressMetric, { kind: 'discrete_items' }>;
  sessionStreak: number;
  ratingCounts: {
    again: number;
    hard: number;
    good: number;
    easy: number;
  };
  observedRetention: number | null;
  tagLabel?: string;
}

/**
 * 2. Reading Session Model
 */
export interface ReadingSessionExperienceModel extends BaseSessionExperienceModel {
  flowType: 'reading';
  lessonId: string;
  cefrLevel: CEFRLevel;
  category?: string;
  progressMetric: Extract<SessionProgressMetric, { kind: 'discrete_items' }>;
  correctCount?: number;
  scorePercent?: number;
}

/**
 * 3. Listening Session Model
 */
export interface ListeningSessionExperienceModel extends BaseSessionExperienceModel {
  flowType: 'listening';
  lessonId: string;
  cefrLevel: CEFRLevel;
  category?: string;
  progressMetric: Extract<SessionProgressMetric, { kind: 'discrete_items' }>;
  playbackState?: {
    isPlaying: boolean;
    activeSentenceIndex: number | null;
    audioSpeed: number;
  };
  correctCount?: number;
  scorePercent?: number;
}

/**
 * 4. Speaking Session Model
 */
export interface SpeakingSessionExperienceModel extends BaseSessionExperienceModel {
  flowType: 'speaking';
  promptId: string;
  cefrLevel: CEFRLevel;
  scenario?: string;
  progressMetric: Extract<SessionProgressMetric, { kind: 'discrete_items' }>;
  currentTurnAccuracy?: number;
  averageAccuracy?: number;
}

/**
 * 5. Writing Session Model
 */
export interface WritingSessionExperienceModel extends BaseSessionExperienceModel {
  flowType: 'writing';
  promptId?: string;
  isCustomTopic: boolean;
  cefrLevel: CEFRLevel;
  progressMetric: Extract<SessionProgressMetric, { kind: 'target_words' | 'stage_pipeline' }>;
  isGrading?: boolean;
  overallCefrScore?: number;
  hasAiFeedback?: boolean;
}

/**
 * 6. TOEIC Session Model
 */
export interface ToeicSessionExperienceModel extends BaseSessionExperienceModel {
  flowType: 'toeic';
  attemptId: string;
  examMode: ExamMode;
  experienceMode: ToeicExperienceMode;
  itemsMetric: Extract<SessionProgressMetric, { kind: 'discrete_items' }>;
  timerMetric?: Extract<SessionProgressMetric, { kind: 'timed_countdown' }>;
  isPaused: boolean;
  scaledScore?: number;
}

/**
 * 7. Quiz Session Model
 */
export interface QuizSessionExperienceModel extends BaseSessionExperienceModel {
  flowType: 'quiz';
  arcadeMode: 'speed_match' | 'classic_quiz' | 'word_scramble' | 'dictation';
  sourceMode: 'all_vocab' | 'mistake_bank';
  streakCount: number;
  totalXpSession: number;
  progressMetric: Extract<SessionProgressMetric, { kind: 'timed_countdown' } | { kind: 'unbounded' } | { kind: 'discrete_items' }>;
}

/**
 * 8. Pronunciation Session Model
 */
export interface PronunciationSessionExperienceModel extends BaseSessionExperienceModel {
  flowType: 'pronunciation';
  currentWord: string;
  ipa?: string;
  subMode: 'ai_speech' | 'shadowing' | 'dictation';
  progressMetric: Extract<SessionProgressMetric, { kind: 'unbounded' } | { kind: 'discrete_items' }>;
  lastAccuracyScore?: number | null;
}

/**
 * 9. AI Tutor Session Model (Open-ended conversation)
 */
export interface TutorSessionExperienceModel extends BaseSessionExperienceModel {
  flowType: 'tutor';
  scenarioId: string;
  progressMetric: Extract<SessionProgressMetric, { kind: 'open_turns' }>;
  isAiResponding?: boolean;
}

/**
 * Full discriminated union of all Session Experience Models
 */
export type SessionExperienceModel =
  | FlashcardSessionExperienceModel
  | ReadingSessionExperienceModel
  | ListeningSessionExperienceModel
  | SpeakingSessionExperienceModel
  | WritingSessionExperienceModel
  | ToeicSessionExperienceModel
  | QuizSessionExperienceModel
  | PronunciationSessionExperienceModel
  | TutorSessionExperienceModel;

/**
 * Generic action button descriptor for session navigation / next actions
 */
export interface SessionActionDescriptor {
  id: string;
  label: string;
  description?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  icon?: string;
  isPrimary?: boolean;
  disabled?: boolean;
  onClick: () => void;
}
