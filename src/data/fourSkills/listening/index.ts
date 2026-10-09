import { a1ListeningLessons } from './a1';
import { a2ListeningLessons } from './a2';
import { b1ListeningLessons } from './b1';
import { b2ListeningLessons } from './b2';
import { c1ListeningLessons } from './c1';
import { c2ListeningLessons } from './c2';
import { ListeningLesson } from '../types';
import { CEFRLevel } from '../../../types';

/**
 * Single source of truth for all Listening Lab lessons across A1-C2 CEFR bands.
 * Modularly organized by CEFR levels with backward compatibility for listen_1..listen_4.
 */
export const LISTENING_LESSONS: ListeningLesson[] = [
  ...a1ListeningLessons,
  ...a2ListeningLessons,
  ...b1ListeningLessons,
  ...b2ListeningLessons,
  ...c1ListeningLessons,
  ...c2ListeningLessons,
];

/**
 * Pure helper to retrieve all listening lessons matching a specific CEFR level.
 */
export function findListeningLessonsByCefr(level: CEFRLevel): ListeningLesson[] {
  return LISTENING_LESSONS.filter((l) => l.level === level);
}

export { a1ListeningLessons } from './a1';
export { a2ListeningLessons } from './a2';
export { b1ListeningLessons } from './b1';
export { b2ListeningLessons } from './b2';
export { c1ListeningLessons } from './c1';
export { c2ListeningLessons } from './c2';
export {
  validateListeningDataset,
  assertListeningDatasetValid,
  type ValidationIssue,
  type ValidationResult,
} from './validation';
