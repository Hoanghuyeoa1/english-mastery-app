// src/types/learningContinuity.ts

export type ResumableActivityType =
  | 'reading'
  | 'writing'
  | 'speaking'
  | 'listening'
  | 'toeic'
  | 'flashcard'
  | 'tutor'
  | 'checkpoint';

export const CONTINUITY_SCHEMA_VERSION = 1;

export interface BaseResumableActivity {
  id: string;
  type: ResumableActivityType;
  title: string;
  subtitle?: string;
  startedAt: number; // Unix timestamp ms
  lastActiveAt: number; // Unix timestamp ms
  completed: boolean;
  completedAt?: number;
  schemaVersion: number;
}

export interface ReadingResumeCheckpoint {
  lessonId: string;
  answers: Record<string, number>;
  totalQuestions: number;
  activeSection?: 'passage' | 'quiz';
  progressPercent?: number;
}

export interface ReadingResumableActivity extends BaseResumableActivity {
  type: 'reading';
  checkpoint: ReadingResumeCheckpoint;
}

export interface WritingResumeCheckpoint {
  promptId: string;
  customTopic?: string;
  draft: string;
  wordCount: number;
  progressPercent?: number;
}

export interface WritingResumableActivity extends BaseResumableActivity {
  type: 'writing';
  checkpoint: WritingResumeCheckpoint;
}

export interface SpeakingResumeCheckpoint {
  promptId: string;
  currentTurnIndex: number;
  totalTurns: number;
  progressPercent?: number;
}

export interface SpeakingResumableActivity extends BaseResumableActivity {
  type: 'speaking';
  checkpoint: SpeakingResumeCheckpoint;
}

export interface ListeningResumeCheckpoint {
  lessonId: string;
  answers: Record<string, number>;
  totalQuestions: number;
  progressPercent?: number;
}

export interface ListeningResumableActivity extends BaseResumableActivity {
  type: 'listening';
  checkpoint: ListeningResumeCheckpoint;
}

export interface ToeicResumeCheckpoint {
  attemptId: string;
  examMode: string;
  experienceMode?: string;
  skillScope?: string;
  currentQuestionIdx: number;
  totalQuestions: number;
  answeredCount: number;
  timeLeftSeconds: number;
  userAnswers?: Record<string, string>;
  isPaused?: boolean;
  deadline?: number;
  savedAt?: number;
  progressPercent?: number;
}

export interface ToeicResumableActivity extends BaseResumableActivity {
  type: 'toeic';
  checkpoint: ToeicResumeCheckpoint;
}

export interface FlashcardResumeCheckpoint {
  sessionId?: string;
  queueMode: 'DUE' | 'NEW' | 'LEARNED' | 'ALL';
  filterTag?: string;
  cardType?: string;
  level?: string;
  orderedCardIds?: string[];
  currentIndex?: number;
  reviewedCardIds?: string[];
  reviewedCount: number;
  totalDue?: number;
  totalCards?: number;
  progressPercent?: number;
}

export interface FlashcardResumableActivity extends BaseResumableActivity {
  type: 'flashcard';
  checkpoint: FlashcardResumeCheckpoint;
}

export interface TutorResumeCheckpoint {
  sessionId: string;
  scenarioId: string;
  turnCount: number;
  lastMessageSummary?: string;
  progressPercent?: number;
}

export interface TutorResumableActivity extends BaseResumableActivity {
  type: 'tutor';
  checkpoint: TutorResumeCheckpoint;
}

export interface CheckpointResumeCheckpoint {
  attemptId: string;
  level: string; // CEFR Level ('A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2')
  currentSection: 'listening' | 'reading' | 'speaking' | 'writing';
  completedSections: Array<'listening' | 'reading' | 'speaking' | 'writing'>;
  listeningAnswers: Record<string, number>;
  readingAnswers: Record<string, number>;
  speakingTranscripts: Record<number, string>;
  writingDraft: string;
  sectionScores?: Partial<Record<'listening' | 'reading' | 'speaking' | 'writing', number>>;
  timeLeftSeconds?: number;
  progressPercent?: number;
  listeningAudioPlayCount?: number;
}

export interface CheckpointResumableActivity extends BaseResumableActivity {
  type: 'checkpoint';
  checkpoint: CheckpointResumeCheckpoint;
}

export type ResumableActivity =
  | ReadingResumableActivity
  | WritingResumableActivity
  | SpeakingResumableActivity
  | ListeningResumableActivity
  | ToeicResumableActivity
  | FlashcardResumableActivity
  | TutorResumableActivity
  | CheckpointResumableActivity;

export type ResumableCheckpoint = ResumableActivity['checkpoint'];

