import { SpeakingPrompt } from '../types';
import { CEFRLevel } from '../../../types';
import { a1SpeakingLessons } from './a1';
import { a2SpeakingLessons } from './a2';
import { b1SpeakingLessons } from './b1';
import { b2SpeakingLessons } from './b2';
import { c1SpeakingLessons } from './c1';
import { c2SpeakingLessons } from './c2';
import { resolveCanonicalCefrLevel } from './validation';

export { a1SpeakingLessons } from './a1';
export { a2SpeakingLessons } from './a2';
export { b1SpeakingLessons } from './b1';
export { b2SpeakingLessons } from './b2';
export { c1SpeakingLessons } from './c1';
export { c2SpeakingLessons } from './c2';
export * from './validation';

/**
 * Master catalog of Speaking Prompts across CEFR bands.
 * Preserves stable IDs (sp_1, sp_2, sp_3, sp_4) and deterministic new IDs.
 */
export const SPEAKING_PROMPTS: SpeakingPrompt[] = [
  ...a1SpeakingLessons,
  ...a2SpeakingLessons,
  ...b1SpeakingLessons,
  ...b2SpeakingLessons,
  ...c1SpeakingLessons,
  ...c2SpeakingLessons,
];

/**
 * Pure helper to retrieve all speaking prompts matching a specific CEFR level.
 */
export function findSpeakingLessonsByCefr(level: CEFRLevel): SpeakingPrompt[] {
  return SPEAKING_PROMPTS.filter((p) => {
    if (p.level === level) return true;
    const canonical = resolveCanonicalCefrLevel(p.level);
    return canonical === level;
  });
}
