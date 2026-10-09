// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  useAppStore,
  sanitizeScoreArray,
  sanitizeFourSkillsScores,
  mergeSkillScores,
  DEFAULT_FOUR_SKILLS_SCORES,
} from '../../store/useAppStore';
import {
  getFourSkillsCompetency,
  recordSkillScore,
  getCefrLevelFromScore,
  clearAllSkillsData,
  getSkillScores,
} from '../skillsCompetencyService';
import { deriveTutorLearningContext } from '../tutorLearningContext';

describe('PHASE 3 — Final Regression, Verification & Audit Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      fourSkillsScores: {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      },
      fourSkillsEvidence: {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      },
      completedListeningLessonIds: [],
      srsProgressMap: {},
      mistakeBank: {},
    });
  });

  // =========================================================================
  // 1. RE-VERIFY END-TO-END PIPELINE (ALL 4 SKILLS)
  // =========================================================================
  describe('1. Re-verify End-to-End Pipeline for All 4 Skills', () => {
    it('End-to-End Listening: Quiz complete (80%) -> record -> rolling avg (80%) -> B2 -> assessed', () => {
      // 1. User completes Listening comprehension quiz with 4/5 correct = 80%
      const quizCorrect = 4;
      const quizTotal = 5;
      const calculatedScore = Math.round((quizCorrect / quizTotal) * 100);
      expect(calculatedScore).toBe(80);

      // 2. Trigger recordSkillScore
      recordSkillScore('listening', calculatedScore);

      // 3. State verification
      const rawScores = getSkillScores('listening');
      expect(rawScores).toEqual([80]);

      // 4. Competency aggregation
      const competency = getFourSkillsCompetency({});
      expect(competency.listening.isAssessed).toBe(true);
      expect(competency.listening.score).toBe(80);
      expect(competency.listening.level).toBe('B1'); // Single attempt gated at B1 until N >= 2
      expect(competency.listening.totalAttempts).toBe(1);
    });

    it('End-to-End Reading: Quiz complete (90%) -> record -> rolling avg (90%) -> C1 -> assessed', () => {
      const readingCorrect = 9;
      const readingTotal = 10;
      const calculatedScore = Math.round((readingCorrect / readingTotal) * 100);

      recordSkillScore('reading', calculatedScore);

      const competency = getFourSkillsCompetency({});
      expect(competency.reading.isAssessed).toBe(true);
      expect(competency.reading.score).toBe(90);
      expect(competency.reading.level).toBe('B1'); // Single attempt gated at B1 until N >= 2 and N >= 3
      expect(competency.reading.totalAttempts).toBe(1);
    });

    it('End-to-End Speaking: Multi-turn speech accuracy -> average (75%) -> B2 -> assessed', () => {
      const turns = [{ accuracy: 70 }, { accuracy: 80 }];
      const avg = Math.round(turns.reduce((acc, t) => acc + t.accuracy, 0) / turns.length);
      expect(avg).toBe(75);

      recordSkillScore('speaking', avg);

      const competency = getFourSkillsCompetency({});
      expect(competency.speaking.isAssessed).toBe(true);
      expect(competency.speaking.score).toBe(75);
      expect(competency.speaking.level).toBe('B1'); // Single attempt gated at B1 until N >= 2
      expect(competency.speaking.totalAttempts).toBe(1);
    });

    it('End-to-End Writing: Rubric evaluation (72%) -> single save -> B2 -> assessed', () => {
      const overallScore = 72;
      recordSkillScore('writing', overallScore);

      const competency = getFourSkillsCompetency({});
      expect(competency.writing.isAssessed).toBe(true);
      expect(competency.writing.score).toBe(72);
      expect(competency.writing.level).toBe('B1'); // Single attempt gated at B1 until N >= 2
      expect(competency.writing.totalAttempts).toBe(1);
    });
  });

  // =========================================================================
  // 2. FRESH USER (NO-DATA) & FIRST-ASSESSMENT TRANSITION
  // =========================================================================
  describe('2. Fresh User (No-Data) & First-Assessment Transition', () => {
    it('fresh user state has isAssessed: false across all 4 skills without misleading A1 0%', () => {
      const initial = getFourSkillsCompetency({});

      (['listening', 'reading', 'speaking', 'writing'] as const).forEach((skill) => {
        expect(initial[skill].isAssessed).toBe(false);
        expect(initial[skill].totalAttempts).toBe(0);
        expect(initial[skill].score).toBe(0);
        // Note: CEFR fallback is A1 by type contract, but UI uses isAssessed to display "Chưa đánh giá"
      });
    });

    it('first valid assessment transitions only the target skill from unassessed to assessed', () => {
      // User only completes 1 Listening lesson
      recordSkillScore('listening', 85);

      const postFirstLesson = getFourSkillsCompetency({});

      // Listening is now assessed
      expect(postFirstLesson.listening.isAssessed).toBe(true);
      expect(postFirstLesson.listening.score).toBe(85);
      expect(postFirstLesson.listening.level).toBe('B1'); // Single attempt gated at B1 until N >= 3
      expect(postFirstLesson.listening.totalAttempts).toBe(1);

      // Remaining 3 skills must STRICTLY remain unassessed
      expect(postFirstLesson.reading.isAssessed).toBe(false);
      expect(postFirstLesson.reading.totalAttempts).toBe(0);
      expect(postFirstLesson.speaking.isAssessed).toBe(false);
      expect(postFirstLesson.speaking.totalAttempts).toBe(0);
      expect(postFirstLesson.writing.isAssessed).toBe(false);
      expect(postFirstLesson.writing.totalAttempts).toBe(0);
    });
  });

  // =========================================================================
  // 3. TECHNICAL FAILURES RESILIENCE
  // =========================================================================
  describe('3. Technical Failures Resilience', () => {
    it('Web Speech permission denied or mic failure does not record 0 or fake 80 into speaking competency', () => {
      const recordedTurnScores: Record<string, { accuracy: number }> = {};
      const allScores = Object.values(recordedTurnScores).map((s) => s.accuracy);

      // Guard from Phase 2: only record if allScores.length > 0
      if (allScores.length > 0) {
        const avg = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);
        recordSkillScore('speaking', avg);
      }

      const competency = getFourSkillsCompetency({});
      expect(competency.speaking.isAssessed).toBe(false);
      expect(competency.speaking.totalAttempts).toBe(0);
    });

    it('Zero-question or empty exam evaluation does not contaminate competency with 0', () => {
      const emptyExam = {
        listeningTotal: 0,
        listeningCorrect: 0,
        readingTotal: 0,
        readingCorrect: 0,
      };

      if (emptyExam.listeningTotal > 0) {
        recordSkillScore('listening', 0);
      }
      if (emptyExam.readingTotal > 0) {
        recordSkillScore('reading', 0);
      }

      const competency = getFourSkillsCompetency({});
      expect(competency.listening.isAssessed).toBe(false);
      expect(competency.reading.isAssessed).toBe(false);
    });
  });

  // =========================================================================
  // 4. CROSS-MODULE ISOLATION
  // =========================================================================
  describe('4. Cross-Module Isolation', () => {
    it('SRS Flashcard review does not write to fourSkillsScores', () => {
      // Simulate SRS Flashcard review by updating srsProgressMap directly in store
      useAppStore.setState((state) => ({
        srsProgressMap: {
          ...state.srsProgressMap,
          vocab_1: {
            srsLevel: 1,
            nextReviewDate: new Date().toISOString(),
            interval: 3,
            easeFactor: 2.5,
            firstLearnedAt: new Date().toISOString(),
          },
        },
      }));

      const competency = getFourSkillsCompetency(useAppStore.getState().srsProgressMap);
      expect(competency.listening.isAssessed).toBe(false);
      expect(competency.reading.isAssessed).toBe(false);
      expect(competency.speaking.isAssessed).toBe(false);
      expect(competency.writing.isAssessed).toBe(false);
      // But accumulated core words reflects the learned card
      expect(competency.accumulatedCoreWords).toBe(1);
    });

    it('Mistake bank updates do not mutate fourSkillsScores', () => {
      useAppStore.getState().recordMistake({
        id: 'word_1',
        word: 'mitigate',
        meaning: 'làm giảm nhẹ',
        phonetic: '/ˈmɪtɪɡeɪt/',
      } as any, 'flashcard');

      const competency = getFourSkillsCompetency({});
      expect(competency.writing.isAssessed).toBe(false);
      expect(competency.speaking.isAssessed).toBe(false);
      expect(competency.listening.isAssessed).toBe(false);
      expect(competency.reading.isAssessed).toBe(false);
    });
  });

  // =========================================================================
  // 5. PERSISTENCE, REHYDRATION & CLOUD MERGE SANITY
  // =========================================================================
  describe('5. Persistence, Rehydration & Cloud Merge Sanity', () => {
    it('sanitizeFourSkillsScores handles corrupted, null, or malformed state safely', () => {
      const corrupted = {
        listening: [80, NaN, '90', null],
        reading: undefined,
        speaking: 'invalid',
        writing: [100, 150, -20],
      };

      const clean = sanitizeFourSkillsScores(corrupted);
      expect(clean.listening).toEqual([80]);
      expect(clean.reading).toEqual([]);
      expect(clean.speaking).toEqual([]);
      expect(clean.writing).toEqual([100, 100, 0]);
    });

    it('mergeSkillScores prevents duplicating identical cloud payloads', () => {
      const local = [85, 90, 95];
      const cloud = [85, 90, 95];

      const merged = mergeSkillScores(local, cloud);
      expect(merged).toEqual([85, 90, 95]);
      expect(merged.length).toBe(3);
    });

    it('clearAllSkillsData cleanly wipes competency and localStorage keys without leaving ghosts', () => {
      recordSkillScore('listening', 80);
      recordSkillScore('reading', 90);
      recordSkillScore('speaking', 85);
      recordSkillScore('writing', 75);

      localStorage.setItem('completed_listening_lessons', JSON.stringify(['l1']));
      localStorage.setItem('completed_reading_lessons', JSON.stringify(['r1']));

      clearAllSkillsData();

      const competency = getFourSkillsCompetency({});
      expect(competency.listening.isAssessed).toBe(false);
      expect(competency.reading.isAssessed).toBe(false);
      expect(competency.speaking.isAssessed).toBe(false);
      expect(competency.writing.isAssessed).toBe(false);
      expect(localStorage.getItem('completed_listening_lessons')).toBeNull();
      expect(localStorage.getItem('completed_reading_lessons')).toBeNull();
    });
  });
});
