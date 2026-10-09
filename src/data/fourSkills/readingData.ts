import { ReadingLesson } from './types';
import {
  READING_LESSONS,
  findReadingLessonsByCefr,
  a1ReadingLessons,
  a2ReadingLessons,
  b1ReadingLessons,
  b2ReadingLessons,
  c1ReadingLessons,
  c2ReadingLessons,
} from './reading/index';

/**
 * Preserved legacy alias for existing references (read_1, read_2, read_3).
 */
export const legacyReadingLessons: ReadingLesson[] = [
  b2ReadingLessons[0], // read_1
  b2ReadingLessons[1], // read_2
  c1ReadingLessons[0], // read_3
];

export {
  READING_LESSONS,
  findReadingLessonsByCefr,
  a1ReadingLessons,
  a2ReadingLessons,
  b1ReadingLessons,
  b2ReadingLessons,
  c1ReadingLessons,
  c2ReadingLessons,
};

export {
  validateReadingDataset,
  assertReadingDatasetValid,
  validateReadingDistribution,
  countPassageWords,
  READING_WORD_COUNT_TARGETS,
  VALID_CEFR_LEVELS,
} from './reading/validation';

export type {
  ValidateReadingOptions,
  ValidationIssue as ReadingValidationIssue,
  ValidationResult as ReadingValidationResult,
} from './reading/validation';
