import { ReadingLesson } from '../types';
import { CEFRLevel } from '../../../types';
import { a1ReadingLessons } from './a1';
import { a2ReadingLessons } from './a2';
import { b1ReadingLessons } from './b1';
import { b2ReadingLessons } from './b2';
import { c1ReadingLessons } from './c1';
import { c2ReadingLessons } from './c2';

export { a1ReadingLessons } from './a1';
export { a2ReadingLessons } from './a2';
export { b1ReadingLessons } from './b1';
export { b2ReadingLessons } from './b2';
export { c1ReadingLessons } from './c1';
export { c2ReadingLessons } from './c2';
export * from './validation';

/**
 * Complete standardized dataset of Reading Comprehension lessons across CEFR bands (A1–C2).
 * Exactly 24 lessons: 4 lessons per CEFR band.
 */
export const READING_LESSONS: ReadingLesson[] = [
  ...a1ReadingLessons,
  ...a2ReadingLessons,
  ...b1ReadingLessons,
  ...b2ReadingLessons,
  ...c1ReadingLessons,
  ...c2ReadingLessons,
];

/**
 * Pure helper to retrieve all reading lessons matching a specific CEFR level.
 */
export function findReadingLessonsByCefr(level: CEFRLevel): ReadingLesson[] {
  return READING_LESSONS.filter((l) => l.level === level);
}
