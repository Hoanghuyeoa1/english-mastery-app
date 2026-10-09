import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useAppStore,
  composeVocabularyList,
  buildUnifiedSRSCards,
  clearUnifiedCardsCache,
  sanitizeScoreArray,
  sanitizeFourSkillsScores,
  sanitizeStringIds,
  sanitizeFourSkillsCompletionProgress,
  mergeCompletionProgressIds,
  mergeFourSkillsCompletionProgress,
  mergeSkillScores,
  DEFAULT_FOUR_SKILLS_SCORES,
  DEFAULT_FOUR_SKILLS_COMPLETION_PROGRESS,
} from '../useAppStore';
import type { VocabWord, CollocationItem, SRSProgress } from '../../types';

describe('useAppStore — Characterization Test Suite (Safety Net)', () => {
  beforeEach(() => {
    clearUnifiedCardsCache();
    useAppStore.getState().resetToDefault();
  });

  describe('1. Public Exports & Pure Transformation Contracts', () => {
    it('sanitizes score arrays bounded to [0, 100] and max 50 items', () => {
      const input = [10, -5, 120, 'invalid', NaN, 85.6, null];
      const result = sanitizeScoreArray(input);
      expect(result).toEqual([10, 0, 100, 86]);
    });

    it('sanitizes four skills scores with default fallback', () => {
      expect(sanitizeFourSkillsScores(null)).toEqual(DEFAULT_FOUR_SKILLS_SCORES);
      const custom = {
        listening: [90],
        reading: [80],
        speaking: [-10],
        writing: [150],
      };
      const result = sanitizeFourSkillsScores(custom);
      expect(result.speaking).toEqual([0]);
      expect(result.writing).toEqual([100]);
    });

    it('sanitizes four skills completion progress ids immutably', () => {
      expect(sanitizeFourSkillsCompletionProgress(null)).toEqual(DEFAULT_FOUR_SKILLS_COMPLETION_PROGRESS);
      const res = sanitizeFourSkillsCompletionProgress({
        reading: ['r1', 'r2', 'r1', '', 123],
        speaking: ['s1'],
        writing: ['w1'],
      });
      expect(res.reading).toEqual(['r1', 'r2']);
      expect(res.speaking).toEqual(['s1']);
      expect(res.writing).toEqual(['w1']);
    });

    it('merges four skills completion progress with union semantics (never regressing)', () => {
      const base = {
        reading: ['r1', 'r2'],
        speaking: ['s1'],
        writing: [],
      };
      const incoming = {
        reading: ['r2', 'r3'],
        speaking: [],
        writing: ['w1'],
      };
      const merged = mergeFourSkillsCompletionProgress(base, incoming);
      expect(merged.reading).toEqual(['r1', 'r2', 'r3']);
      expect(merged.speaking).toEqual(['s1']);
      expect(merged.writing).toEqual(['w1']);
    });

    it('merges skill scores retaining historical timeline safely', () => {
      const merged = mergeSkillScores([50, 60], [60, 70]);
      expect(merged).toEqual([50, 60, 70]);
    });
  });

  describe('2. Performance & Cache Baseline: buildUnifiedSRSCards & composeVocabularyList', () => {
    it('preserves exact memoized reference when inputs do not change', () => {
      const mockVocab: VocabWord[] = [
        {
          id: 'v1',
          word: 'Resilient',
          meaning: 'Kiên cường',
          level: 'B2',
          tag: 'Daily',
          srsLevel: 0,
        } as any,
      ];
      const mockColloc: CollocationItem[] = [
        {
          id: 'c1',
          phrase: 'make a decision',
          meaning: 'đưa ra quyết định',
          createdAt: new Date().toISOString(),
        } as any,
      ];
      const mockSrsMap: Record<string, SRSProgress> = {};

      const cards1 = buildUnifiedSRSCards(mockVocab, mockColloc, mockSrsMap);
      const cards2 = buildUnifiedSRSCards(mockVocab, mockColloc, mockSrsMap);
      expect(cards1).toBe(cards2); // Identical reference
      expect(cards1.length).toBe(2);

      // Mutating reference recomputes
      const cards3 = buildUnifiedSRSCards([...mockVocab], mockColloc, mockSrsMap);
      expect(cards3).not.toBe(cards1);
      expect(cards3).toEqual(cards1);

      // clearUnifiedCardsCache forces recomputation
      clearUnifiedCardsCache();
      const cards4 = buildUnifiedSRSCards(mockVocab, mockColloc, mockSrsMap);
      expect(cards4).not.toBe(cards1);
      expect(cards4).toEqual(cards1);
    });

    it('composeVocabularyList combines 10,000+ static words with custom words and applies SRS progress', () => {
      const customWord: VocabWord = {
        id: 'custom_1',
        word: 'Ubiquitous',
        meaning: 'Có mặt khắp nơi',
        level: 'C1',
        tag: 'Academic',
        srsLevel: 0,
      } as any;
      const srsMap: Record<string, SRSProgress> = {
        custom_1: {
          srsLevel: 3,
          interval: 6,
          easeFactor: 2.6,
          nextReviewDate: '2026-10-15T00:00:00.000Z',
          isFavorite: true,
        },
      };

      const result = composeVocabularyList(srsMap, [customWord]);
      expect(result.length).toBeGreaterThan(10000); // 10.381 static words + custom words
      const found = result.find((w) => w.id === 'custom_1');
      expect(found).toBeDefined();
      expect(found?.srsLevel).toBe(3);
      expect(found?.interval).toBe(6);
      expect(found?.isFavorite).toBe(true);
    });
  });

  describe('3. SRS State Machine: FSRS vs SM-2 & Cross-Domain Invariants', () => {
    it('FSRS vs SM-2 Invariant: FSRS computes stability/difficulty while SM-2 computes easeFactor/interval', () => {
      // 1. SM-2 Review
      useAppStore.getState().setSRSAlgorithm('sm2');
      useAppStore.getState().addCustomWord({
        word: 'Serendipity',
        meaning: 'Sự tình cờ may mắn',
        level: 'C1',
        tag: 'Daily',
      } as any);
      const sm2Word = useAppStore.getState().userCustomWords[0];
      useAppStore.getState().processReview(sm2Word.id, 2); // Good
      const sm2Progress = useAppStore.getState().srsProgressMap[sm2Word.id];
      expect(sm2Progress.srsLevel).toBe(1);
      expect(sm2Progress.easeFactor).toBe(2.5);
      expect(sm2Progress.interval).toBe(1);
      expect(sm2Progress.fsrs).toBeUndefined(); // SM-2 does not set FSRS state

      // 2. FSRS Review
      useAppStore.getState().setSRSAlgorithm('fsrs');
      useAppStore.getState().addCustomWord({
        word: 'Ephemeral',
        meaning: 'Phù du',
        level: 'B2',
        tag: 'Academic',
      } as any);
      const fsrsWord = useAppStore.getState().userCustomWords[1];
      useAppStore.getState().processReview(fsrsWord.id, 2); // Good
      const fsrsProgress = useAppStore.getState().srsProgressMap[fsrsWord.id];
      expect(fsrsProgress.fsrs).toBeDefined();
      expect(fsrsProgress.fsrs?.stability).toBeGreaterThan(0);
      expect(fsrsProgress.fsrs?.difficulty).toBeGreaterThan(0);
    });

    it('Cross-Domain Flow: rating 0 (Again) registers mistake, rating >= 2 resolves mistake', () => {
      useAppStore.getState().addCustomWord({
        word: 'Meticulous',
        meaning: 'Tỉ mỉ, cẩn thận',
        level: 'C1',
        tag: 'Academic',
      } as any);
      const word = useAppStore.getState().userCustomWords[0];

      // 1. Fail review (Grade 0 -> Again)
      useAppStore.getState().processReview(word.id, 0);

      const mistakeRecord = useAppStore.getState().mistakeBank[word.id.toLowerCase()];
      expect(mistakeRecord).toBeDefined();
      expect(mistakeRecord.word.toLowerCase()).toBe('meticulous');
      expect(mistakeRecord.mistakeCount).toBe(1);
      expect(mistakeRecord.consecutiveCorrect).toBe(0);
      expect(mistakeRecord.resolved).toBe(false);

      // 2. Pass review with Grade 2 (Good) -> invokes recordMistakeCorrect
      useAppStore.getState().processReview(word.id, 2);
      const updatedMistake = useAppStore.getState().mistakeBank[word.id.toLowerCase()];
      // Calling processReview with grade 2 calls recordMistakeCorrect with id and word
      expect(updatedMistake.consecutiveCorrect).toBeGreaterThanOrEqual(1);
      expect(updatedMistake.resolved).toBe(true); // Resolved once consecutiveCorrect >= 2
    });
  });

  describe('4. Learning Continuity Invariant: Completed Always Wins', () => {
    it('preserves completed status even if updated with incomplete checkpoint', () => {
      // 1. Create a reading activity with a valid discriminated checkpoint and complete it
      useAppStore.getState().upsertResumeActivity({
        id: 'reading_a1_lesson1',
        type: 'reading',
        title: 'Daily Routine',
        startedAt: 1000,
        lastActiveAt: 2000,
        completed: true,
        completedAt: 2000,
        schemaVersion: 1,
        checkpoint: {
          lessonId: 'a1_lesson1',
          answers: { 'q1': 0 },
          totalQuestions: 5,
        },
      });

      const act = useAppStore.getState().resumeActivities['reading_a1_lesson1'];
      expect(act).toBeDefined();
      expect(act.completed).toBe(true);

      // 2. Trying to update checkpoint on completed activity does not regress completed status
      useAppStore.getState().updateResumeCheckpoint('reading_a1_lesson1', {
        answers: { 'q1': 1 },
      });
      expect(useAppStore.getState().resumeActivities['reading_a1_lesson1'].completed).toBe(true);

      // 3. Upserting non-completed update onto completed activity does not overwrite completed
      useAppStore.getState().upsertResumeActivity({
        id: 'reading_a1_lesson1',
        type: 'reading',
        title: 'Daily Routine',
        startedAt: 1000,
        lastActiveAt: 3000,
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          lessonId: 'a1_lesson1',
          answers: {},
          totalQuestions: 5,
        },
      });
      expect(useAppStore.getState().resumeActivities['reading_a1_lesson1'].completed).toBe(true);
    });
  });

  describe('5. Competency & Certification Invariant: completion != competency != certification', () => {
    it('completing lessons does not automatically award level certification', () => {
      // Mark lessons as completed
      useAppStore.getState().markFourSkillsLessonCompleted('reading', 'reading_lesson_1');
      useAppStore.getState().markFourSkillsLessonCompleted('reading', 'reading_lesson_2');

      const completedReading = useAppStore.getState().fourSkillsCompletionProgress.reading;
      expect(completedReading).toContain('reading_lesson_1');
      expect(completedReading).toContain('reading_lesson_2');

      // Check levelCertifications is still empty (completion != certification)
      const certifications = useAppStore.getState().levelCertifications || {};
      expect(Object.keys(certifications).length).toBe(0);

      // Explicit certification must be saved via saveLevelCertification with valid PersistedLevelCertification
      useAppStore.getState().saveLevelCertification?.({
        level: 'B1',
        certificateId: 'CERT-B1-2026-X7K9',
        certifiedAt: Date.now(),
        overallScore: 88,
        skillScores: {
          listening: 85,
          reading: 90,
          speaking: 85,
          writing: 92,
        },
        attemptId: 'att_001',
        verifiedVersion: '1.0',
        criteriaSummary: {
          overallRequired: 75,
          overallAchieved: 88,
          floorRequired: 70,
          minSkillAchieved: 85,
          verifiedVersion: '1.0',
        },
      });

      expect(useAppStore.getState().levelCertifications?.['B1']).toBeDefined();
      expect(useAppStore.getState().levelCertifications?.['B1']?.overallScore).toBe(88);
      expect(useAppStore.getState().levelCertifications?.['B1']?.certificateId).toBe('CERT-B1-2026-X7K9');
    });
  });

  describe('6. Anti-Spam & Idempotency Guards', () => {
    it('deduplicates rapid gainXP calls with identical idempotencyKey', () => {
      const initialXp = useAppStore.getState().profile.xp;
      const key = 'test_idemp_xp_123';

      useAppStore.getState().gainXP(50, { idempotencyKey: key, source: 'quiz' });
      const xpAfterFirst = useAppStore.getState().profile.xp;
      expect(xpAfterFirst).toBe(initialXp + 50);

      // Second call with same idempotencyKey must be dropped
      useAppStore.getState().gainXP(50, { idempotencyKey: key, source: 'quiz' });
      const xpAfterSecond = useAppStore.getState().profile.xp;
      expect(xpAfterSecond).toBe(xpAfterFirst); // No change
    });
  });
});
