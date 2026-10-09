import {
  SPEAKING_PROMPTS,
  findSpeakingLessonsByCefr,
  a1SpeakingLessons,
  a2SpeakingLessons,
  b1SpeakingLessons,
  b2SpeakingLessons,
  c1SpeakingLessons,
  c2SpeakingLessons,
} from './speaking/index';

export {
  SPEAKING_PROMPTS,
  findSpeakingLessonsByCefr,
  a1SpeakingLessons,
  a2SpeakingLessons,
  b1SpeakingLessons,
  b2SpeakingLessons,
  c1SpeakingLessons,
  c2SpeakingLessons,
};

export {
  validateSpeakingDataset,
  assertSpeakingDatasetValid,
  validateSpeakingPrompt,
  validateSpeakingDistribution,
  parseSpeakingDurationToSeconds,
  estimateSpeakingPromptDuration,
  resolveCanonicalCefrLevel,
  SPEAKING_DURATION_TARGETS,
} from './speaking/validation';

export type {
  ValidateSpeakingOptions,
  ValidationIssue as SpeakingValidationIssue,
  ValidationResult as SpeakingValidationResult,
  DistributionValidationResult as SpeakingDistributionValidationResult,
} from './speaking/validation';
