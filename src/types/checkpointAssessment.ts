// src/types/checkpointAssessment.ts
/**
 * CEFR Checkpoint Assessment Contracts (Phase 3)
 *
 * Dedicated data foundation for CEFR Checkpoint Assessments (A1 -> C2).
 *
 * Invariants:
 * - Semantics independence: Checkpoint data is strictly separate from Lesson Completion.
 * - Assessment context: Evidence is generated in an official assessment session with strict rules.
 * - Assessment-mode restrictions: Policy flags control disabling hints, answer reveals, retries, etc.
 * - Integrity: Fail-safe behavior against missing IDs, broken references, or level mismatches.
 * - Zero `any`: 100% type-safe with discriminated unions and explicit models.
 * - Zero dataset duplication: References existing quality content by ID without persisting raw banks in store.
 */

import type { CefrLevel, CefrSkill } from './levelCertification';
export type { CefrLevel, CefrSkill };
import type {
  ListeningLesson,
  ReadingLesson,
  SpeakingPrompt,
  WritingPrompt,
} from './fourSkills';

export const CHECKPOINT_DATA_SCHEMA_VERSION = 1;
export const CHECKPOINT_CONTENT_VERSION = '2026.1';

/**
 * Strict rules and restrictions enforced during an assessment session.
 */
export interface AssessmentModePolicy {
  /** If false, learner cannot view vocabulary hints or grammar clues */
  allowHints: boolean;
  /** If false, correct answers are hidden until the exam is finalized */
  allowAnswerReveal: boolean;
  /** If false, questions and turns cannot be retried in-session */
  allowInSessionRetry: boolean;
  /** If false, dictionary click-to-lookup popover is disabled */
  allowDictionaryLookup: boolean;
  /** If false, transcript is strictly hidden during audio playback & answering */
  allowTranscript: boolean;
  /** If true, only the first valid submission counts towards assessment scoring */
  requireFirstSubmission: boolean;
  /** Maximum times the audio can be played in the listening section */
  maxAudioPlays: number;
  /** Total maximum time allowed for the entire checkpoint (in minutes) */
  timeLimitMinutes: number;
}

/**
 * Default rigorous assessment restrictions for CEFR Level Checkpoints.
 */
export const DEFAULT_ASSESSMENT_POLICY: AssessmentModePolicy = {
  allowHints: false,
  allowAnswerReveal: false,
  allowInSessionRetry: false,
  allowDictionaryLookup: false,
  allowTranscript: false,
  requireFirstSubmission: true,
  maxAudioPlays: 2,
  timeLimitMinutes: 45,
};

// =========================================================================
// SECTION DEFINITIONS
// =========================================================================

export interface BaseSectionDefinition {
  sectionId: string;
  skill: CefrSkill;
  level: CefrLevel;
  title: string;
  instructions: string;
  timeLimitMinutes: number;
  weightPercent: number; // e.g. 25 for equal 4-skill weighting
}

export interface ListeningSectionDefinition extends BaseSectionDefinition {
  skill: 'listening';
  sourceLessonId: string;
  selectedQuestionIds?: string[]; // If omitted, all questions in the lesson are included
  maxAudioPlays: number;
}

export interface ReadingSectionDefinition extends BaseSectionDefinition {
  skill: 'reading';
  sourceLessonId: string;
  selectedQuestionIds?: string[]; // If omitted, all questions in the lesson are included
}

export interface SpeakingSectionDefinition extends BaseSectionDefinition {
  skill: 'speaking';
  sourcePromptId: string;
  targetTurnIndices?: number[]; // If omitted, all turns in the prompt are included
}

export interface WritingSectionDefinition extends BaseSectionDefinition {
  skill: 'writing';
  sourcePromptId: string;
  minWords: number;
  maxWords?: number;
}

/**
 * Definition of a CEFR Checkpoint across all 4 skills for a specific level.
 */
export interface CheckpointDefinition {
  level: CefrLevel;
  checkpointId: string; // e.g. "checkpoint_a1"
  title: string;
  description: string;
  version: string;
  schemaVersion: number;
  totalTimeMinutes: number;
  policy: AssessmentModePolicy;
  sections: {
    listening: ListeningSectionDefinition;
    reading: ReadingSectionDefinition;
    speaking: SpeakingSectionDefinition;
    writing: WritingSectionDefinition;
  };
}

// =========================================================================
// RESOLVED ASSESSMENT MODELS (FOR RUNTIME SESSION EXECUTION)
// =========================================================================

export interface ResolvedListeningSection {
  definition: ListeningSectionDefinition;
  lesson: ListeningLesson;
  questions: ListeningLesson['questions'];
}

export interface ResolvedReadingSection {
  definition: ReadingSectionDefinition;
  lesson: ReadingLesson;
  questions: ReadingLesson['questions'];
}

export interface ResolvedSpeakingSection {
  definition: SpeakingSectionDefinition;
  prompt: SpeakingPrompt;
  turns: SpeakingPrompt['turns'];
}

export interface ResolvedWritingSection {
  definition: WritingSectionDefinition;
  prompt: WritingPrompt;
}

/**
 * Fully resolved and verified Checkpoint ready for session execution.
 */
export interface ResolvedCheckpointAssessment {
  definition: CheckpointDefinition;
  level: CefrLevel;
  sections: {
    listening: ResolvedListeningSection;
    reading: ResolvedReadingSection;
    speaking: ResolvedSpeakingSection;
    writing: ResolvedWritingSection;
  };
  totalQuestions: number;
  allQuestionIds: string[];
}

// =========================================================================
// INTEGRITY & VALIDATION MODELS
// =========================================================================

export type CheckpointValidationErrorCode =
  | 'MISSING_LESSON_REFERENCE'
  | 'CEFR_LEVEL_MISMATCH'
  | 'EMPTY_QUESTIONS_SECTION'
  | 'MALFORMED_QUESTION'
  | 'MISSING_AUDIO_REFERENCE'
  | 'EMPTY_PASSAGE'
  | 'EMPTY_SPEAKING_TURNS'
  | 'MALFORMED_SPEAKING_TURN'
  | 'EMPTY_WRITING_PROMPT'
  | 'INVALID_WORD_LIMITS'
  | 'DUPLICATE_ITEM_ID'
  | 'INVALID_POLICY_TIME';

export interface CheckpointValidationIssue {
  code: CheckpointValidationErrorCode;
  skill?: CefrSkill;
  field: string;
  message: string;
}

export interface CheckpointValidationResult {
  level: CefrLevel;
  isValid: boolean;
  issues: CheckpointValidationIssue[];
}
