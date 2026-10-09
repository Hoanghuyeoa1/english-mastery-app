import { WritingPrompt } from '../types';
import { CEFRLevel } from '../../../types';
import { a1WritingLessons } from './a1';
import { a2WritingLessons } from './a2';
import { b1WritingLessons } from './b1';
import { b2WritingLessons } from './b2';
import { c1WritingLessons } from './c1';
import { c2WritingLessons } from './c2';
import { resolveCanonicalCefrLevel } from './validation';

export { a1WritingLessons } from './a1';
export { a2WritingLessons } from './a2';
export { b1WritingLessons } from './b1';
export { b2WritingLessons } from './b2';
export { c1WritingLessons } from './c1';
export { c2WritingLessons } from './c2';
export * from './validation';

/**
 * Master catalog of Writing Prompts across all 6 CEFR bands (A1–C2).
 * Exactly 24 lessons (4 per band), preserving legacy stable IDs:
 * wp_1 (B2), wp_2 (B1), wp_3 (B1), wp_4 (B2), wp_5 (C1).
 */
export const WRITING_PROMPTS: WritingPrompt[] = [
  ...a1WritingLessons,
  ...a2WritingLessons,
  ...b1WritingLessons,
  ...b2WritingLessons,
  ...c1WritingLessons,
  ...c2WritingLessons,
];

/**
 * Pure helper to retrieve all writing prompts matching a specific CEFR level.
 */
export function findWritingLessonsByCefr(level: CEFRLevel): WritingPrompt[] {
  return WRITING_PROMPTS.filter((p) => {
    if (p.level === level) return true;
    const canonical = resolveCanonicalCefrLevel(p.level);
    return canonical === level;
  });
}
