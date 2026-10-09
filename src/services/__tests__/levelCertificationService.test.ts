// src/services/__tests__/levelCertificationService.test.ts
import { describe, it, expect } from 'vitest';
import {
  CENTRAL_CERTIFICATION_POLICY,
  evaluateLevelReadiness,
  evaluateAllLevelsReadiness,
  evaluateCheckpointCertification,
  deriveHighestCertifiedLevel,
  deriveCertificationStatus,
  deriveEvidenceCompleteness,
  createPersistedCertificationRecord,
  sanitizeScore,
  sanitizeConfidence,
} from '../levelCertificationService';
import type {
  CefrLevel,
  LevelCertificationStore,
  PersistedLevelCertification,
} from '../../types/levelCertification';
import type { FourSkillsEvidenceStore } from '../../types';

describe('Level Certification Service (Phase 2)', () => {
  // =========================================================================
  // 1. CENTRAL POLICY INVARIANTS
  // =========================================================================
  describe('Central Certification Policy', () => {
    it('defines non-empty policy thresholds for all 6 CEFR bands (A1 - C2)', () => {
      const levels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      expect(CENTRAL_CERTIFICATION_POLICY.policyVersion).toBeDefined();

      for (const lvl of levels) {
        const policy = CENTRAL_CERTIFICATION_POLICY.levels[lvl];
        expect(policy).toBeDefined();
        expect(policy.overallPassThreshold).toBeGreaterThanOrEqual(70);
        expect(policy.perSkillFloorThreshold).toBeGreaterThanOrEqual(50);
        expect(policy.perSkillFloorThreshold).toBeLessThanOrEqual(policy.overallPassThreshold);
        expect(policy.minEvidenceCountPerSkill).toBeGreaterThanOrEqual(1);
        expect(policy.minConfidenceScore).toBeGreaterThan(0);
        expect(policy.retakeCooldownMs).toBeGreaterThan(0);
      }
    });

    it('enforces that higher CEFR bands have strictly equal or higher thresholds', () => {
      const a1 = CENTRAL_CERTIFICATION_POLICY.levels.A1;
      const b1 = CENTRAL_CERTIFICATION_POLICY.levels.B1;
      const c1 = CENTRAL_CERTIFICATION_POLICY.levels.C1;
      const c2 = CENTRAL_CERTIFICATION_POLICY.levels.C2;

      expect(b1.overallPassThreshold).toBeGreaterThanOrEqual(a1.overallPassThreshold);
      expect(c1.overallPassThreshold).toBeGreaterThanOrEqual(b1.overallPassThreshold);
      expect(c2.overallPassThreshold).toBeGreaterThanOrEqual(c1.overallPassThreshold);

      expect(b1.perSkillFloorThreshold).toBeGreaterThanOrEqual(a1.perSkillFloorThreshold);
      expect(c1.perSkillFloorThreshold).toBeGreaterThanOrEqual(b1.perSkillFloorThreshold);
      expect(c2.perSkillFloorThreshold).toBeGreaterThanOrEqual(c1.perSkillFloorThreshold);
    });
  });

  // =========================================================================
  // 2. NEW USER / NO EVIDENCE
  // =========================================================================
  describe('New User / No Evidence Behavior', () => {
    it('returns not_ready for a new user with empty state', () => {
      const readiness = evaluateLevelReadiness('A1', {});
      expect(readiness.level).toBe('A1');
      expect(readiness.status).toBe('not_ready');
      expect(readiness.isReadyForCheckpoint).toBe(false);
      expect(readiness.alreadyCertified).toBe(false);
      expect(readiness.certificationRecord).toBeNull();
      expect(readiness.blockingReasons.length).toBeGreaterThan(0);
    });

    it('returns null for highest certified level when no certifications exist', () => {
      expect(deriveHighestCertifiedLevel(null)).toBeNull();
      expect(deriveHighestCertifiedLevel(undefined)).toBeNull();
      expect(deriveHighestCertifiedLevel({})).toBeNull();
    });

    it('derives unattempted certification status when learner has no attempt or cert', () => {
      const status = deriveCertificationStatus('A1', {}, null, null);
      expect(status).toBe('unattempted');
    });
  });

  // =========================================================================
  // 3. ONE SKILL MISSING
  // =========================================================================
  describe('One Skill Missing Behavior', () => {
    it('blocks readiness when one skill lacks evidence, even if other 3 skills are strong', () => {
      const mockEvidenceStore: FourSkillsEvidenceStore = {
        listening: [
          { id: 'l1', skill: 'listening', score: 85, source: 'four-skills', cefrDifficulty: 'A1', createdAt: Date.now() },
        ],
        reading: [
          { id: 'r1', skill: 'reading', score: 90, source: 'four-skills', cefrDifficulty: 'A1', createdAt: Date.now() },
        ],
        writing: [
          { id: 'w1', skill: 'writing', score: 80, source: 'writing-ai', cefrDifficulty: 'A1', createdAt: Date.now() },
        ],
        speaking: [], // Speaking has ZERO evidence
      };

      const readiness = evaluateLevelReadiness('A1', {
        competencyEvidenceStore: mockEvidenceStore,
        completedLessonIdsBySkill: {
          listening: ['lis_1', 'lis_2'],
          reading: ['read_1', 'read_2'],
          writing: ['writ_1'],
          speaking: [], // Speaking 0 completed lessons
        },
        skillCompetencies: {
          listening: { score: 85, level: 'A1', totalAttempts: 1, isAssessed: true, confidence: 'medium', confidenceScore: 0.5 },
          reading: { score: 90, level: 'A1', totalAttempts: 1, isAssessed: true, confidence: 'high', confidenceScore: 0.6 },
          writing: { score: 80, level: 'A1', totalAttempts: 1, isAssessed: true, confidence: 'medium', confidenceScore: 0.5 },
          speaking: { score: 0, level: 'A1', totalAttempts: 0, isAssessed: false, confidence: 'low', confidenceScore: 0 },
        },
      });

      expect(readiness.isReadyForCheckpoint).toBe(false);
      expect(readiness.status).toBe('not_ready');
      expect(readiness.skills.speaking.isReady).toBe(false);
      expect(readiness.skills.speaking.missingReasons.length).toBeGreaterThan(0);
      expect(readiness.blockingReasons.some((r) => r.includes('Nói'))).toBe(true);
    });

    it('fails checkpoint evaluation immediately if one skill is missing or undefined', () => {
      const evalResult = evaluateCheckpointCertification({
        level: 'A1',
        skillScores: {
          listening: 85,
          reading: 90,
          writing: 80,
          speaking: undefined as any, // Missing speaking
        },
      });

      expect(evalResult.isPassed).toBe(false);
      if (!evalResult.isPassed) {
        expect(evalResult.failingReasons.some((r) => r.includes('Nói') || r.includes('speaking'))).toBe(true);
      }
    });
  });

  // =========================================================================
  // 4. LOW CONFIDENCE
  // =========================================================================
  describe('Low Confidence Handling', () => {
    it('blocks readiness when a skill has low confidence score below policy threshold', () => {
      const mockEvidenceStore: FourSkillsEvidenceStore = {
        listening: [{ id: 'l1', skill: 'listening', score: 75, source: 'legacy', createdAt: 0 }],
        reading: [{ id: 'r1', skill: 'reading', score: 75, source: 'legacy', createdAt: 0 }],
        speaking: [{ id: 's1', skill: 'speaking', score: 75, source: 'legacy', createdAt: 0 }],
        writing: [{ id: 'w1', skill: 'writing', score: 75, source: 'legacy', createdAt: 0 }],
      };

      const readiness = evaluateLevelReadiness('A1', {
        competencyEvidenceStore: mockEvidenceStore,
        completedLessonIdsBySkill: {
          listening: ['l1', 'l2'],
          reading: ['r1', 'r2'],
          speaking: ['s1'],
          writing: ['w1'],
        },
        skillCompetencies: {
          listening: { score: 75, level: 'A1', totalAttempts: 1, isAssessed: true, confidence: 'low', confidenceScore: 0.10 }, // Below A1 min 0.20
          reading: { score: 75, level: 'A1', totalAttempts: 1, isAssessed: true, confidence: 'medium', confidenceScore: 0.5 },
          speaking: { score: 75, level: 'A1', totalAttempts: 1, isAssessed: true, confidence: 'medium', confidenceScore: 0.5 },
          writing: { score: 75, level: 'A1', totalAttempts: 1, isAssessed: true, confidence: 'medium', confidenceScore: 0.5 },
        },
      });

      expect(readiness.isReadyForCheckpoint).toBe(false);
      expect(readiness.skills.listening.hasSufficientConfidence).toBe(false);
      expect(readiness.blockingReasons.some((r) => r.includes('Độ tin cậy kỹ năng Nghe'))).toBe(true);
    });
  });

  // =========================================================================
  // 5. ALL LESSONS COMPLETE NHƯNG KHÔNG CERTIFICATE
  // =========================================================================
  describe('Invariant: Lesson Completion != CEFR Certification', () => {
    it('does not assume certification merely because all lessons in the level are completed', () => {
      // Learner has completed 100% of lessons in A1 (e.g. 52 lessons)
      const completedListen = Array.from({ length: 20 }, (_, i) => `lis_${i}`);
      const completedRead = Array.from({ length: 24 }, (_, i) => `read_${i}`);
      const completedSpeak = Array.from({ length: 4 }, (_, i) => `spk_${i}`);
      const completedWrite = Array.from({ length: 4 }, (_, i) => `wri_${i}`);

      const storeWithoutCert: LevelCertificationStore = {};

      const readiness = evaluateLevelReadiness('A1', {
        certifications: storeWithoutCert,
        completedLessonIdsBySkill: {
          listening: completedListen,
          reading: completedRead,
          speaking: completedSpeak,
          writing: completedWrite,
        },
        totalLessonsBySkill: {
          listening: 20,
          reading: 24,
          speaking: 4,
          writing: 4,
        },
      });

      // Crucial invariant: 100% completion does NOT mean already certified!
      expect(readiness.alreadyCertified).toBe(false);
      expect(readiness.status).not.toBe('already_certified');
      expect(readiness.certificationRecord).toBeNull();

      expect(deriveHighestCertifiedLevel(storeWithoutCert)).toBeNull();
    });
  });

  // =========================================================================
  // 6. INCOMPLETE LESSONS NHƯNG ĐỦ READINESS
  // =========================================================================
  describe('Incomplete Lessons But Sufficient Readiness', () => {
    it('declares ready_for_checkpoint when evidence is sufficient even if only 20% of lessons are done', () => {
      // Only 6 lessons completed out of 52 available (incomplete), but all 4 skills have evidence & confidence
      const mockEvidenceStore: FourSkillsEvidenceStore = {
        listening: [
          { id: 'l1', skill: 'listening', score: 80, source: 'four-skills', cefrDifficulty: 'A1', createdAt: Date.now() },
        ],
        reading: [
          { id: 'r1', skill: 'reading', score: 85, source: 'four-skills', cefrDifficulty: 'A1', createdAt: Date.now() },
        ],
        speaking: [
          { id: 's1', skill: 'speaking', score: 75, source: 'four-skills', cefrDifficulty: 'A1', createdAt: Date.now() },
        ],
        writing: [
          { id: 'w1', skill: 'writing', score: 78, source: 'writing-ai', cefrDifficulty: 'A1', createdAt: Date.now() },
        ],
      };

      const readiness = evaluateLevelReadiness('A1', {
        competencyEvidenceStore: mockEvidenceStore,
        completedLessonIdsBySkill: {
          listening: ['lis_1', 'lis_2'],
          reading: ['read_1', 'read_2'],
          speaking: ['spk_1'],
          writing: ['wri_1'],
        },
        totalLessonsBySkill: {
          listening: 20,
          reading: 24,
          speaking: 4,
          writing: 4,
        },
        skillCompetencies: {
          listening: { score: 80, level: 'A1', totalAttempts: 1, isAssessed: true, confidence: 'medium', confidenceScore: 0.4 },
          reading: { score: 85, level: 'A1', totalAttempts: 1, isAssessed: true, confidence: 'medium', confidenceScore: 0.4 },
          speaking: { score: 75, level: 'A1', totalAttempts: 1, isAssessed: true, confidence: 'medium', confidenceScore: 0.4 },
          writing: { score: 78, level: 'A1', totalAttempts: 1, isAssessed: true, confidence: 'medium', confidenceScore: 0.4 },
        },
      });

      expect(readiness.isReadyForCheckpoint).toBe(true);
      expect(readiness.status).toBe('ready_for_checkpoint');
      expect(readiness.overallReadinessPercent).toBe(100);
      expect(readiness.blockingReasons).toHaveLength(0);
    });
  });

  // =========================================================================
  // 7. PER-SKILL FLOOR INVARIANT
  // =========================================================================
  describe('Skill Floor Invariant (No strong skill compensates weak skill below floor)', () => {
    it('fails evaluation when one skill is below floor despite high overall score', () => {
      // Level A1 policy: overallPassThreshold = 70, perSkillFloorThreshold = 55
      // Learner scores: Listening 100, Reading 95, Writing 90, Speaking 50
      // Overall = (100 + 95 + 90 + 50) / 4 = 83.75 -> 84 (well above 70!)
      // BUT Speaking 50 is strictly below floor 55.
      const evalResult = evaluateCheckpointCertification({
        level: 'A1',
        skillScores: {
          listening: 100,
          reading: 95,
          writing: 90,
          speaking: 50, // Below floor 55!
        },
      });

      expect(evalResult.isPassed).toBe(false);
      expect(evalResult.overallScore).toBe(84);
      if (!evalResult.isPassed) {
        expect(evalResult.skillResults.speaking.passedFloor).toBe(false);
        expect(evalResult.failingReasons.some((r) => r.includes('Nói') && r.includes('50%'))).toBe(true);
      }
    });

    it('passes evaluation when overall meets threshold AND all 4 skills pass floor', () => {
      const evalResult = evaluateCheckpointCertification({
        level: 'A1',
        skillScores: {
          listening: 70,
          reading: 75,
          speaking: 65,
          writing: 70,
        },
      });

      expect(evalResult.isPassed).toBe(true);
      expect(evalResult.overallScore).toBe(70);
      if (evalResult.isPassed) {
        expect(evalResult.certificateId).toMatch(/^CERT-A1-\d{4}-/);
        expect(evalResult.reason).toContain('Đạt toàn diện');
      }
    });
  });

  // =========================================================================
  // 8. NAN / INFINITY / INVALID SCORE PROTECTION
  // =========================================================================
  describe('Zero-Crash & Boundary Score Sanitization', () => {
    it('safely sanitizes scores with NaN, Infinity, negative, and out-of-bound numbers', () => {
      expect(sanitizeScore(NaN)).toBe(0);
      expect(sanitizeScore(Infinity)).toBe(0);
      expect(sanitizeScore(-50)).toBe(0);
      expect(sanitizeScore(150)).toBe(100);
      expect(sanitizeScore(74.6)).toBe(75);
      expect(sanitizeScore('invalid' as any)).toBe(0);

      expect(sanitizeConfidence(NaN)).toBe(0);
      expect(sanitizeConfidence(Infinity)).toBe(0);
      expect(sanitizeConfidence(1.5)).toBe(1.0);
      expect(sanitizeConfidence(-0.2)).toBe(0);
    });

    it('handles NaN/Infinity in checkpoint evaluation without crashing and rejects passing', () => {
      const evalResult = evaluateCheckpointCertification({
        level: 'A1',
        skillScores: {
          listening: NaN,
          reading: Infinity,
          speaking: -20,
          writing: 85,
        },
      });

      expect(evalResult.isPassed).toBe(false);
      if (!evalResult.isPassed) {
        expect(evalResult.failingReasons.length).toBeGreaterThan(0);
      }
    });
  });

  // =========================================================================
  // 9. HIGHER LEVEL CERTIFIED NHƯNG LOWER LEVEL CHƯA ASSESSED
  // =========================================================================
  describe('Non-Contiguous Certification Derivation', () => {
    it('correctly derives highest certified level even if lower levels were not assessed', () => {
      // User directly placed into or certified at B2
      const certStore: LevelCertificationStore = {
        B2: {
          level: 'B2',
          certificateId: 'CERT-B2-2026-X1Y2',
          certifiedAt: Date.now(),
          overallScore: 82,
          skillScores: { listening: 85, reading: 85, speaking: 75, writing: 82 },
          attemptId: 'attempt_b2_1',
          verifiedVersion: '2026.1',
          criteriaSummary: {
            overallRequired: 75,
            overallAchieved: 82,
            floorRequired: 60,
            minSkillAchieved: 75,
            verifiedVersion: '2026.1',
          },
        },
      };

      const highest = deriveHighestCertifiedLevel(certStore);
      expect(highest).toBe('B2');

      // Check readiness for B2
      const b2Readiness = evaluateLevelReadiness('B2', { certifications: certStore });
      expect(b2Readiness.status).toBe('already_certified');
      expect(b2Readiness.alreadyCertified).toBe(true);

      // Check readiness for A1 (not certified, still evaluates cleanly)
      const a1Readiness = evaluateLevelReadiness('A1', { certifications: certStore });
      expect(a1Readiness.alreadyCertified).toBe(false);
    });
  });

  // =========================================================================
  // 10. RETAKE COOLDOWN ELIGIBILITY
  // =========================================================================
  describe('Retake Cooldown Handling', () => {
    it('restricts retake eligibility if cooldown has not elapsed after a failed attempt', () => {
      const now = 1_700_000_000_000;
      const lastFailedAt = now - 2 * 60 * 60 * 1000; // Failed 2 hours ago (cooldown for A1 is 12h)

      const evalResult = evaluateCheckpointCertification({
        level: 'A1',
        skillScores: { listening: 50, reading: 50, speaking: 50, writing: 50 },
        lastFailedAttemptAt: lastFailedAt,
        nowMs: now,
      });

      expect(evalResult.isPassed).toBe(false);
      if (!evalResult.isPassed) {
        expect(evalResult.canRetake).toBe(false);
        expect(evalResult.retakeAvailableAt).toBe(lastFailedAt + 12 * 60 * 60 * 1000);
      }
    });

    it('allows retake eligibility once cooldown period has passed', () => {
      const now = 1_700_000_000_000;
      const lastFailedAt = now - 14 * 60 * 60 * 1000; // Failed 14 hours ago (cooldown 12h)

      const evalResult = evaluateCheckpointCertification({
        level: 'A1',
        skillScores: { listening: 50, reading: 50, speaking: 50, writing: 50 },
        lastFailedAttemptAt: lastFailedAt,
        nowMs: now,
      });

      expect(evalResult.isPassed).toBe(false);
      if (!evalResult.isPassed) {
        expect(evalResult.canRetake).toBe(true);
      }
    });
  });

  // =========================================================================
  // 11. DERIVED EVIDENCE COMPLETENESS & STORE PERSISTENCE
  // =========================================================================
  describe('Evidence Completeness & Record Persistence Helpers', () => {
    it('inspects completeness across all 4 skills correctly', () => {
      const partialEvidence: FourSkillsEvidenceStore = {
        listening: [{ id: '1', skill: 'listening', score: 80, source: 'four-skills', cefrDifficulty: 'A1', createdAt: Date.now() }],
        reading: [{ id: '2', skill: 'reading', score: 85, source: 'four-skills', cefrDifficulty: 'A1', createdAt: Date.now() }],
        speaking: [],
        writing: [],
      };

      const report = deriveEvidenceCompleteness('A1', partialEvidence);
      expect(report.level).toBe('A1');
      expect(report.totalSkillsAssessed).toBe(2);
      expect(report.isFullyCovered).toBe(false);
      expect(report.missingSkills).toEqual(['speaking', 'writing']);
    });

    it('creates persisted certification record with criteria summary upon passed exam', () => {
      const evalPassed = evaluateCheckpointCertification({
        level: 'A1',
        skillScores: { listening: 80, reading: 85, speaking: 70, writing: 75 },
      });

      expect(evalPassed.isPassed).toBe(true);
      if (!evalPassed.isPassed) return;

      const persisted = createPersistedCertificationRecord(evalPassed, 'attempt_123');
      expect(persisted).not.toBeNull();
      if (persisted) {
        expect(persisted.level).toBe('A1');
        expect(persisted.attemptId).toBe('attempt_123');
        expect(persisted.certificateId).toBe(evalPassed.certificateId);
        expect(persisted.overallScore).toBe(78);
        expect(persisted.criteriaSummary.floorRequired).toBe(55);
        expect(persisted.criteriaSummary.minSkillAchieved).toBe(70);
      }
    });
  });

  // =========================================================================
  // 12. EVALUATE ALL LEVELS
  // =========================================================================
  describe('evaluateAllLevelsReadiness', () => {
    it('evaluates all 6 levels concurrently and returns records for A1-C2', () => {
      const allReadiness = evaluateAllLevelsReadiness({});
      const keys = Object.keys(allReadiness);
      expect(keys).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
      expect(allReadiness.A1.level).toBe('A1');
      expect(allReadiness.C2.level).toBe('C2');
    });
  });
});
