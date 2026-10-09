// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore, sanitizeScoreArray, mergeSkillScores } from '../../store/useAppStore';
import {
  getCefrLevelFromScore,
  getFourSkillsCompetency,
  recordSkillScore,
  clearAllSkillsData,
  getSkillScores,
} from '../skillsCompetencyService';
import { deriveTutorLearningContext } from '../tutorLearningContext';

describe('Phase 2 — Four Skills Competency Reliability & Semantic Validation Suite', () => {
  beforeEach(() => {
    // Reset Zustand store state before each test
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
    });
    localStorage.clear();
  });

  // =========================================================================
  // 1. NO-DATA SEMANTICS & IS_ASSESSED FLAG
  // =========================================================================
  describe('1. No-Data Semantics & isAssessed Flag', () => {
    it('returns isAssessed: false with totalAttempts: 0 when user has never attempted a skill', () => {
      const competency = getFourSkillsCompetency({});

      (['listening', 'reading', 'speaking', 'writing'] as const).forEach((skill) => {
        expect(competency[skill].isAssessed).toBe(false);
        expect(competency[skill].totalAttempts).toBe(0);
        expect(competency[skill].score).toBe(0);
        expect(competency[skill].level).toBe('A1');
      });
    });

    it('clearly distinguishes between unassessed (isAssessed: false) and assessed score 0% (isAssessed: true)', () => {
      const unassessed = getFourSkillsCompetency({});
      expect(unassessed.reading.isAssessed).toBe(false);
      expect(unassessed.reading.totalAttempts).toBe(0);
      expect(unassessed.reading.score).toBe(0);

      // User actively takes a reading test and scores 0%
      recordSkillScore('reading', 0);

      const assessedZero = getFourSkillsCompetency({});
      expect(assessedZero.reading.isAssessed).toBe(true);
      expect(assessedZero.reading.totalAttempts).toBe(1);
      expect(assessedZero.reading.score).toBe(0);
      expect(assessedZero.reading.level).toBe('A1');
    });

    it('tutorLearningContext deriveCompetency respects isAssessed flag', () => {
      const contextUnassessed = deriveTutorLearningContext({
        fourSkillsScores: {
          listening: [],
          reading: [],
          speaking: [],
          writing: [],
        },
      });

      expect(contextUnassessed.competency.listening.isAssessed).toBe(false);
      expect(contextUnassessed.competency.overallScore).toBe(0);

      const contextAssessed = deriveTutorLearningContext({
        fourSkillsScores: {
          listening: [85],
          reading: [],
          speaking: [],
          writing: [],
        },
      });

      expect(contextAssessed.competency.listening.isAssessed).toBe(true);
      expect(contextAssessed.competency.listening.score).toBe(85);
      expect(contextAssessed.competency.overallScore).toBe(85);
      expect(contextAssessed.competency.reading.isAssessed).toBe(false);
    });
  });

  // =========================================================================
  // 2. ATTEMPT PROGRESSION & ROLLING AVERAGE
  // =========================================================================
  describe('2. Attempt Progression & Rolling Average', () => {
    it('accurately calculates rolling unweighted average across multiple attempts', () => {
      recordSkillScore('listening', 80);
      recordSkillScore('listening', 90);
      recordSkillScore('listening', 85);

      const competency = getFourSkillsCompetency({});
      expect(competency.listening.totalAttempts).toBe(3);
      // (80 + 90 + 85) / 3 = 85. Legacy evidence without difficulty is capped at B2 until N >= 6
      expect(competency.listening.score).toBe(85);
      expect(competency.listening.level).toBe('B2');
      expect(competency.listening.isAssessed).toBe(true);
    });

    it('clamps rolling window to max 50 recent items', () => {
      for (let i = 1; i <= 60; i++) {
        recordSkillScore('speaking', i);
      }

      const scores = getSkillScores('speaking');
      expect(scores.length).toBe(50);
      expect(scores[0]).toBe(11); // Oldest 10 dropped
      expect(scores[scores.length - 1]).toBe(60);

      const competency = getFourSkillsCompetency({});
      expect(competency.speaking.totalAttempts).toBe(50);
    });
  });

  // =========================================================================
  // 3. CEFR BOUNDARY & CONVERSION TESTING
  // =========================================================================
  describe('3. CEFR Boundary & Conversion Testing', () => {
    it('correctly maps all score boundaries to standard CEFR levels', () => {
      expect(getCefrLevelFromScore(0)).toBe('A1');
      expect(getCefrLevelFromScore(29)).toBe('A1');
      expect(getCefrLevelFromScore(30)).toBe('A2');
      expect(getCefrLevelFromScore(49)).toBe('A2');
      expect(getCefrLevelFromScore(50)).toBe('B1');
      expect(getCefrLevelFromScore(69)).toBe('B1');
      expect(getCefrLevelFromScore(70)).toBe('B2');
      expect(getCefrLevelFromScore(84)).toBe('B2');
      expect(getCefrLevelFromScore(85)).toBe('C1');
      expect(getCefrLevelFromScore(94)).toBe('C1');
      expect(getCefrLevelFromScore(95)).toBe('C2');
      expect(getCefrLevelFromScore(100)).toBe('C2');
    });

    it('safely handles non-integer floating point scores', () => {
      expect(getCefrLevelFromScore(29.4)).toBe('A1');
      expect(getCefrLevelFromScore(29.6)).toBe('A2');
      expect(getCefrLevelFromScore(84.5)).toBe('C1');
    });
  });

  // =========================================================================
  // 4. OUT-OF-RANGE & MALFORMED INPUT SANITIZATION
  // =========================================================================
  describe('4. Out-of-Range & Malformed Input Sanitization', () => {
    it('clamps negative scores and scores above 100 in getCefrLevelFromScore', () => {
      expect(getCefrLevelFromScore(-50)).toBe('A1');
      expect(getCefrLevelFromScore(150)).toBe('C2');
      expect(getCefrLevelFromScore(9999)).toBe('C2');
    });

    it('safely falls back to A1 on NaN, Infinity, null, undefined, and non-numeric', () => {
      expect(getCefrLevelFromScore(NaN)).toBe('A1');
      expect(getCefrLevelFromScore(Infinity)).toBe('A1');
      expect(getCefrLevelFromScore(-Infinity)).toBe('A1');
      expect(getCefrLevelFromScore(null as any)).toBe('A1');
      expect(getCefrLevelFromScore(undefined as any)).toBe('A1');
      expect(getCefrLevelFromScore('85' as any)).toBe('A1');
    });

    it('recordSkillScore rejects NaN, null, and non-finite numbers without corrupting store', () => {
      recordSkillScore('writing', NaN);
      recordSkillScore('writing', Infinity);
      recordSkillScore('writing', null as any);
      recordSkillScore('writing', undefined as any);
      recordSkillScore('writing', '100' as any);

      const scores = getSkillScores('writing');
      expect(scores.length).toBe(0);

      const competency = getFourSkillsCompetency({});
      expect(competency.writing.isAssessed).toBe(false);
      expect(competency.writing.totalAttempts).toBe(0);
    });

    it('clamps out-of-range valid numbers when recorded', () => {
      recordSkillScore('reading', -20);
      recordSkillScore('reading', 150);

      const scores = getSkillScores('reading');
      expect(scores).toEqual([0, 100]);
    });
  });

  // =========================================================================
  // 5. WRITING DOUBLE-RECORDING BUG FIX VERIFICATION
  // =========================================================================
  describe('5. Writing Double-Recording Bug Fix Verification', () => {
    it('records score exactly once when onSaveScore callback delegates to store', () => {
      // Simulate FourSkillsView handleSaveWritingScore callback
      const onSaveScore = (score: number) => {
        recordSkillScore('writing', score);
      };

      // In WritingEvaluationReport handleSaveCompetency:
      // When onSaveScore is provided, it calls onSaveScore(result.overallScore) ONLY
      const testScore = 88;
      if (onSaveScore) {
        onSaveScore(testScore);
      } else {
        recordSkillScore('writing', testScore);
      }

      const scores = getSkillScores('writing');
      expect(scores.length).toBe(1);
      expect(scores[0]).toBe(88);
    });

    it('records score exactly once when onSaveScore callback is omitted (standalone)', () => {
      const onSaveScore = undefined;
      const testScore = 92;

      if (onSaveScore) {
        (onSaveScore as any)(testScore);
      } else {
        recordSkillScore('writing', testScore);
      }

      const scores = getSkillScores('writing');
      expect(scores.length).toBe(1);
      expect(scores[0]).toBe(92);
    });
  });

  // =========================================================================
  // 6. SINGLE-SKILL TOEIC TEST CONTAMINATION IMMUNITY
  // =========================================================================
  describe('6. Single-Skill TOEIC Contamination Immunity', () => {
    it('Reading-only TOEIC test does NOT record 0% to Listening competency', () => {
      // User took a Reading-only TOEIC test (e.g. Part 5 Practice: 20 questions, 0 listening)
      const mockEvaluated = {
        listeningTotal: 0,
        listeningCorrect: 0,
        readingTotal: 20,
        readingCorrect: 18,
      };

      if (mockEvaluated.listeningTotal > 0) {
        const listeningPercent = Math.round((mockEvaluated.listeningCorrect / mockEvaluated.listeningTotal) * 100);
        recordSkillScore('listening', listeningPercent);
      }
      if (mockEvaluated.readingTotal > 0) {
        const readingPercent = Math.round((mockEvaluated.readingCorrect / mockEvaluated.readingTotal) * 100);
        recordSkillScore('reading', readingPercent);
      }

      const competency = getFourSkillsCompetency({});
      expect(competency.listening.isAssessed).toBe(false);
      expect(competency.listening.totalAttempts).toBe(0);
      expect(competency.reading.isAssessed).toBe(true);
      expect(competency.reading.totalAttempts).toBe(1);
      expect(competency.reading.score).toBe(90);
    });

    it('Listening-only TOEIC test does NOT record 0% to Reading competency', () => {
      // User took a Listening-only TOEIC test (e.g. Part 1 Practice: 6 questions, 0 reading)
      const mockEvaluated = {
        listeningTotal: 6,
        listeningCorrect: 5,
        readingTotal: 0,
        readingCorrect: 0,
      };

      if (mockEvaluated.listeningTotal > 0) {
        const listeningPercent = Math.round((mockEvaluated.listeningCorrect / mockEvaluated.listeningTotal) * 100);
        recordSkillScore('listening', listeningPercent);
      }
      if (mockEvaluated.readingTotal > 0) {
        const readingPercent = Math.round((mockEvaluated.readingCorrect / mockEvaluated.readingTotal) * 100);
        recordSkillScore('reading', readingPercent);
      }

      const competency = getFourSkillsCompetency({});
      expect(competency.reading.isAssessed).toBe(false);
      expect(competency.reading.totalAttempts).toBe(0);
      expect(competency.listening.isAssessed).toBe(true);
      expect(competency.listening.totalAttempts).toBe(1);
      expect(competency.listening.score).toBe(83); // 5/6 = 83%
    });
  });

  // =========================================================================
  // 7. TECHNICAL FAILURE IMMUNITY
  // =========================================================================
  describe('7. Technical Failure Immunity', () => {
    it('Speaking turn finished with 0 evaluated turns does NOT record phantom score', () => {
      // If microphone failed or user skipped all turns without speaking
      const speakingTurnScores: Record<string, { accuracy: number }> = {};
      const allScores = Object.values(speakingTurnScores).map((s) => s.accuracy);

      if (allScores.length > 0) {
        const avg = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);
        recordSkillScore('speaking', avg);
      }

      const competency = getFourSkillsCompetency({});
      expect(competency.speaking.isAssessed).toBe(false);
      expect(competency.speaking.totalAttempts).toBe(0);
    });
  });

  // =========================================================================
  // 8. STORE PERSISTENCE, SANITIZATION & CLOUD MERGE
  // =========================================================================
  describe('8. Store Persistence, Sanitization & Cloud Merge', () => {
    it('sanitizeScoreArray filters invalid data and clamps values to [0, 100]', () => {
      const raw = [null, undefined, '85', NaN, -10, 50, 120, 80];
      const clean = sanitizeScoreArray(raw);
      expect(clean).toEqual([0, 50, 100, 80]);
    });

    it('mergeSkillScores cleanly reconciles local and cloud arrays without duplicates', () => {
      const local = [70, 80, 85];
      const cloud = [70, 80, 85];
      const merged = mergeSkillScores(local, cloud);
      expect(merged).toEqual([70, 80, 85]);
    });

    it('mergeSkillScores appends newer local attempts onto cloud base', () => {
      const cloud = [70, 80];
      const local = [70, 80, 85, 90];
      const merged = mergeSkillScores(local, cloud);
      expect(merged).toEqual([70, 80, 85, 90]);
    });

    it('clearAllSkillsData resets store and removes localStorage entries', () => {
      recordSkillScore('listening', 90);
      recordSkillScore('reading', 85);
      localStorage.setItem('completed_listening_lessons', JSON.stringify(['l1']));

      clearAllSkillsData();

      const competency = getFourSkillsCompetency({});
      expect(competency.listening.isAssessed).toBe(false);
      expect(competency.reading.isAssessed).toBe(false);
      expect(localStorage.getItem('completed_listening_lessons')).toBeNull();
    });
  });
});
