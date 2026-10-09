import {
  WRITING_PROMPTS,
  findWritingLessonsByCefr,
  a1WritingLessons,
  a2WritingLessons,
  b1WritingLessons,
  b2WritingLessons,
  c1WritingLessons,
  c2WritingLessons,
} from './writing/index';

export {
  WRITING_PROMPTS,
  findWritingLessonsByCefr,
  a1WritingLessons,
  a2WritingLessons,
  b1WritingLessons,
  b2WritingLessons,
  c1WritingLessons,
  c2WritingLessons,
};

export {
  validateWritingDataset,
  validateWritingPrompt,
  validateWritingDistribution,
  countWords,
  resolveCanonicalCefrLevel as resolveCanonicalWritingCefrLevel,
  WRITING_WORD_COUNT_TARGETS,
  VALID_WRITING_TASK_TYPES,
  VALID_WRITING_CATEGORIES,
} from './writing/validation';

export type {
  ValidateWritingOptions,
  ValidationIssue as WritingValidationIssue,
  ValidationResult as WritingValidationResult,
  DistributionValidationResult as WritingDistributionValidationResult,
  WritingWordCountTarget,
} from './writing/validation';
