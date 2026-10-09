// src/services/__tests__/certificationDecisionEngine.test.ts
/**
 * CEFR Certification Decision Engine & Retake Policy Test Suite (Phase 9)
 *
 * Verifies:
 * 1. pass: all 4 skills >= floor and overall >= threshold -> certified.
 * 2. fail one skill: strong skills cannot compensate weak skill below floor.
 * 3. missing evidence: missing skill, insufficient evidence count, or low confidence.
 * 4. finalize twice: idempotent finalization & duplicate history append protection.
 * 5. retake: cooldown enforcement & fresh attempt identity.
 * 6. failed -> certified: failed attempt preserved in history, subsequent pass awards cert.
 * 7. certified -> later weak retake: earned certificate never revoked or downgraded.
 * 8. skip-level: level certifications strictly isolated; B1 does not grant A2.
 * 9. old user no attempts: robust handling of empty/legacy state without crashes.
 * 10. invalid/corrupt attempt: NaN, Infinity, and malformed inputs handled safely.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CENTRAL_CERTIFICATION_POLICY,
  evaluateCheckpointCertification,
  createCheckpointHistoryEntry,
  appendCheckpointHistory,
  getCheckpointHistoryForLevel,
  preserveHighestCertificationOnRetake,
  canRetakeCheckpointLevel,
  verifySkipLevelIsolation,
  deriveHighestCertifiedLevel,
  deriveCertificationStatus,
  sanitizeScore,
} from '../levelCertificationService';
import {
  createInitialCheckpointState,
  startCheckpointSession,
  advanceToNextSection,
  finalizeCheckpointAttempt,
  resetFinalizedAttempts,
  createCheckpointAttemptId,
} from '../checkpointSessionLifecycle';
import type {
  CefrLevel,
  LevelCertificationStore,
  CertificationEvaluationResult,
  CheckpointHistoryEntry,
} from '../../types/levelCertification';
import { CERTIFICATION_SCHEMA_VERSION } from '../../types/levelCertification';

describe('CEFR Certification Decision Engine & Retake Policy (Phase 9)', () => {
  beforeEach(() => {
    resetFinalizedAttempts();
  });

  // =========================================================================
  // 1. PASS SCENARIO
  // =========================================================================
  describe('1. Pass Scenario', () => {
    it('evaluates to certified when all 4 skills >= floor and overall >= pass threshold', () => {
      // Level B1: overallPassThreshold = 75, perSkillFloorThreshold = 60
      const now = 1712345678000;
      const evaluation = evaluateCheckpointCertification({
        level: 'B1',
        skillScores: {
          listening: 80,
          reading: 85,
          speaking: 75,
          writing: 80,
        },
        skillEvidenceCounts: {
          listening: 3,
          reading: 3,
          speaking: 3,
          writing: 3,
        },
        skillConfidences: {
          listening: 0.9,
          reading: 0.9,
          speaking: 0.85,
          writing: 0.85,
        },
        attemptId: 'cefr:B1:chk_test_pass',
        nowMs: now,
      });

      expect(evaluation.isPassed).toBe(true);
      expect(evaluation.result).toBe('certified');
      expect(evaluation.level).toBe('B1');
      expect(evaluation.overallScore).toBe(80); // (80 + 85 + 75 + 80) / 4 = 80 >= 75
      expect(evaluation.requiredOverall).toBe(75);
      expect(evaluation.attemptId).toBe('cefr:B1:chk_test_pass');
      expect(evaluation.policyVersion).toBe(CENTRAL_CERTIFICATION_POLICY.policyVersion);
      expect(evaluation.schemaVersion).toBe(CERTIFICATION_SCHEMA_VERSION);
      expect(evaluation.assessedAt).toBe(now);

      if (evaluation.isPassed) {
        expect(evaluation.certificateId).toMatch(/^CERT-B1-\d{4}-/);
        expect(evaluation.certifiedAt).toBe(now);
        expect(evaluation.reason).toContain('Đạt toàn diện');
        expect(evaluation.skillResults.listening.passedFloor).toBe(true);
        expect(evaluation.skillResults.reading.passedFloor).toBe(true);
        expect(evaluation.skillResults.speaking.passedFloor).toBe(true);
        expect(evaluation.skillResults.writing.passedFloor).toBe(true);
      }
    });
  });

  // =========================================================================
  // 2. FAIL ONE SKILL (ZERO FLOOR-COMPENSATION)
  // =========================================================================
  describe('2. Fail One Skill (Zero Floor-Compensation)', () => {
    it('rejects certification when Speaking is below floor despite high scores in Listening, Reading, and Writing', () => {
      // Level B1: overallPassThreshold = 75, perSkillFloorThreshold = 60
      // Listening: 100, Reading: 100, Writing: 95, Speaking: 50 (floor is 60)
      // Overall = (100 + 100 + 95 + 50) / 4 = 86.25 -> 86 (far above 75!)
      const evaluation = evaluateCheckpointCertification({
        level: 'B1',
        skillScores: {
          listening: 100,
          reading: 100,
          writing: 95,
          speaking: 50, // FAILS FLOOR (50 < 60)
        },
        attemptId: 'cefr:B1:chk_test_fail_one_skill',
      });

      expect(evaluation.isPassed).toBe(false);
      expect(evaluation.result).toBe('needs_reinforcement');
      expect(evaluation.overallScore).toBe(86);
      expect(evaluation.requiredOverall).toBe(75);

      if (!evaluation.isPassed) {
        expect(evaluation.skillResults.speaking.passedFloor).toBe(false);
        expect(evaluation.skillResults.listening.passedFloor).toBe(true);
        expect(evaluation.skillResults.reading.passedFloor).toBe(true);
        expect(evaluation.skillResults.writing.passedFloor).toBe(true);

        // Explains exact failing skill and threshold
        const hasSpeakingReason = evaluation.failingReasons.some(
          (reason) => reason.includes('Nói') && reason.includes('50%') && reason.includes('60%')
        );
        expect(hasSpeakingReason).toBe(true);
      }
    });
  });

  // =========================================================================
  // 3. MISSING EVIDENCE & INSUFFICIENT CONFIDENCE
  // =========================================================================
  describe('3. Missing Evidence & Insufficient Confidence', () => {
    it('fails when a skill has missing/undefined score', () => {
      const evaluation = evaluateCheckpointCertification({
        level: 'A2',
        skillScores: {
          listening: 80,
          reading: 80,
          writing: 80,
          // speaking is omitted / undefined
        } as any,
      });

      expect(evaluation.isPassed).toBe(false);
      expect(evaluation.result).toBe('needs_reinforcement');
      if (!evaluation.isPassed) {
        const hasMissingReason = evaluation.failingReasons.some((r) =>
          r.includes('Thiếu dữ liệu') && r.includes('Nói')
        );
        expect(hasMissingReason).toBe(true);
      }
    });

    it('fails when evidence count is below minEvidenceCountPerSkill', () => {
      // Level B2 requires minEvidenceCountPerSkill = 3
      const evaluation = evaluateCheckpointCertification({
        level: 'B2',
        skillScores: {
          listening: 85,
          reading: 85,
          speaking: 85,
          writing: 85,
        },
        skillEvidenceCounts: {
          listening: 3,
          reading: 3,
          speaking: 1, // Only 1 evidence count, required 3
          writing: 3,
        },
      });

      expect(evaluation.isPassed).toBe(false);
      expect(evaluation.result).toBe('needs_reinforcement');
      if (!evaluation.isPassed) {
        const hasEvidenceReason = evaluation.failingReasons.some((r) =>
          r.includes('chưa đủ số lượng bằng chứng') && r.includes('Nói')
        );
        expect(hasEvidenceReason).toBe(true);
      }
    });

    it('fails when confidence score is below minConfidenceScore', () => {
      // Level C1 requires minConfidenceScore = 0.55
      const evaluation = evaluateCheckpointCertification({
        level: 'C1',
        skillScores: {
          listening: 90,
          reading: 90,
          speaking: 90,
          writing: 90,
        },
        skillConfidences: {
          listening: 0.9,
          reading: 0.9,
          speaking: 0.9,
          writing: 0.3, // Below 0.55!
        },
      });

      expect(evaluation.isPassed).toBe(false);
      expect(evaluation.result).toBe('needs_reinforcement');
      if (!evaluation.isPassed) {
        const hasConfidenceReason = evaluation.failingReasons.some((r) =>
          r.includes('chưa đạt ngưỡng độ tin cậy') && r.includes('Viết')
        );
        expect(hasConfidenceReason).toBe(true);
      }
    });
  });

  // =========================================================================
  // 4. FINALIZE TWICE (IDEMPOTENCY PROTECTION)
  // =========================================================================
  describe('4. Finalize Twice (Idempotency Protection)', () => {
    it('returns identical cached evaluation without re-evaluating when finalized multiple times', () => {
      let state = createInitialCheckpointState('B1', 1000);
      state = startCheckpointSession(state);
      state = advanceToNextSection(state, 80);
      state = advanceToNextSection(state, 85);
      state = advanceToNextSection(state, 75);
      state = advanceToNextSection(state, 80);

      // Call 1
      const finalizeResult1 = finalizeCheckpointAttempt(state, undefined, 2000);
      expect(finalizeResult1.success).toBe(true);
      expect(finalizeResult1.alreadyFinalized).toBe(false);
      expect(finalizeResult1.evaluation.isPassed).toBe(true);

      // Call 2 on same attemptId
      const finalizeResult2 = finalizeCheckpointAttempt(state, undefined, 2100);
      expect(finalizeResult2.success).toBe(true);
      expect(finalizeResult2.alreadyFinalized).toBe(true);
      expect(finalizeResult2.evaluation).toEqual(finalizeResult1.evaluation);
    });

    it('appendCheckpointHistory deduplicates attempts with same attemptId', () => {
      const evaluation = evaluateCheckpointCertification({
        level: 'A1',
        skillScores: { listening: 80, reading: 80, speaking: 80, writing: 80 },
        attemptId: 'cefr:A1:chk_dedup_test',
        nowMs: 1000,
      });

      const entry = createCheckpointHistoryEntry(evaluation);
      const history1 = appendCheckpointHistory([], entry);
      expect(history1).toHaveLength(1);

      // Appending duplicate entry
      const history2 = appendCheckpointHistory(history1, entry);
      expect(history2).toHaveLength(1); // Still 1, not duplicated!
      expect(history2[0].attemptId).toBe('cefr:A1:chk_dedup_test');
    });
  });

  // =========================================================================
  // 5. RETAKE POLICY & COOLDOWN
  // =========================================================================
  describe('5. Retake Policy & Cooldown', () => {
    it('enforces cooldown after a failed checkpoint attempt', () => {
      const failedTime = 1000000;
      // B1 cooldown is 24 hours = 86,400,000 ms
      const cooldownMs = CENTRAL_CERTIFICATION_POLICY.levels.B1.retakeCooldownMs;

      const failedEntry: CheckpointHistoryEntry = {
        attemptId: 'cefr:B1:chk_failed_1',
        level: 'B1',
        date: failedTime,
        result: 'needs_reinforcement',
        isPassed: false,
        overallScore: 65,
        scores: { listening: 65, reading: 65, speaking: 65, writing: 65 },
        policyVersion: '2026.1',
        schemaVersion: 1,
      };

      const history = [failedEntry];

      // Immediately after failure: retake is blocked
      const immediateCheck = canRetakeCheckpointLevel('B1', history, failedTime + 1000);
      expect(immediateCheck.canRetake).toBe(false);
      expect(immediateCheck.remainingCooldownMs).toBe(cooldownMs - 1000);

      // During cooldown (e.g. 10 hours in): still blocked
      const midwayCheck = canRetakeCheckpointLevel('B1', history, failedTime + 10 * 3600 * 1000);
      expect(midwayCheck.canRetake).toBe(false);
      expect(midwayCheck.remainingCooldownMs).toBe(cooldownMs - 10 * 3600 * 1000);

      // After cooldown expires: retake is allowed
      const expiredCheck = canRetakeCheckpointLevel('B1', history, failedTime + cooldownMs + 1000);
      expect(expiredCheck.canRetake).toBe(true);
      expect(expiredCheck.remainingCooldownMs).toBe(0);
    });

    it('generates distinct new attemptId for each retake attempt', () => {
      const attempt1Id = createCheckpointAttemptId('B1', 1000, 'part1');
      const attempt2Id = createCheckpointAttemptId('B1', 2000, 'part2');

      expect(attempt1Id).not.toBe(attempt2Id);
      expect(attempt1Id).toContain('chk_1000');
      expect(attempt2Id).toContain('chk_2000');
    });
  });

  // =========================================================================
  // 6. FAILED -> CERTIFIED JOURNEY
  // =========================================================================
  describe('6. Failed -> Certified Journey', () => {
    it('preserves failed attempt in history and awards certificate on successful retake', () => {
      let storeHistory: CheckpointHistoryEntry[] = [];
      let storeCerts: LevelCertificationStore = {};

      // Attempt 1: Failed
      const failedEval = evaluateCheckpointCertification({
        level: 'A2',
        skillScores: { listening: 80, reading: 80, speaking: 45, writing: 75 }, // Speaking fails floor 55
        attemptId: 'cefr:A2:chk_attempt_1',
        nowMs: 1000,
      });
      expect(failedEval.isPassed).toBe(false);

      const failedHistoryEntry = createCheckpointHistoryEntry(failedEval);
      storeHistory = appendCheckpointHistory(storeHistory, failedHistoryEntry);
      storeCerts = preserveHighestCertificationOnRetake(storeCerts, failedEval);

      expect(storeHistory).toHaveLength(1);
      expect(storeHistory[0].isPassed).toBe(false);
      expect(storeCerts.A2).toBeUndefined(); // Not certified yet

      // Attempt 2: Learner practices and passes
      const passedEval = evaluateCheckpointCertification({
        level: 'A2',
        skillScores: { listening: 85, reading: 85, speaking: 75, writing: 80 }, // All pass floor 55
        attemptId: 'cefr:A2:chk_attempt_2',
        nowMs: 2000000,
      });
      expect(passedEval.isPassed).toBe(true);

      const passedHistoryEntry = createCheckpointHistoryEntry(passedEval);
      storeHistory = appendCheckpointHistory(storeHistory, passedHistoryEntry);
      storeCerts = preserveHighestCertificationOnRetake(storeCerts, passedEval);

      // Verify history contains both attempts
      expect(storeHistory).toHaveLength(2);
      expect(storeHistory[0].attemptId).toBe('cefr:A2:chk_attempt_2'); // Newest first
      expect(storeHistory[0].isPassed).toBe(true);
      expect(storeHistory[1].attemptId).toBe('cefr:A2:chk_attempt_1');
      expect(storeHistory[1].isPassed).toBe(false);

      // Verify certificate is now active
      expect(storeCerts.A2).toBeDefined();
      expect(storeCerts.A2?.level).toBe('A2');
      expect(storeCerts.A2?.overallScore).toBe(81); // (85 + 85 + 75 + 80) / 4 = 81.25 -> 81
      expect(storeCerts.A2?.attemptId).toBe('cefr:A2:chk_attempt_2');
    });
  });

  // =========================================================================
  // 7. CERTIFIED -> LATER WEAK RETAKE (PRESERVATION INVARIANT)
  // =========================================================================
  describe('7. Certified -> Later Weak Retake (Preservation Invariant)', () => {
    it('never revokes or downgrades an earned certificate if subsequent retake fails', () => {
      // Step 1: Initial pass at B1 with 85%
      const initialPass = evaluateCheckpointCertification({
        level: 'B1',
        skillScores: { listening: 85, reading: 85, speaking: 85, writing: 85 },
        attemptId: 'cefr:B1:chk_first_pass',
        nowMs: 1000,
      });
      expect(initialPass.isPassed).toBe(true);

      let storeCerts: LevelCertificationStore = {};
      storeCerts = preserveHighestCertificationOnRetake(storeCerts, initialPass);
      const originalCertId = storeCerts.B1!.certificateId;
      const originalCertifiedAt = storeCerts.B1!.certifiedAt;

      // Step 2: User retakes B1 later and performs poorly (score 40%, fails floor)
      const weakRetake = evaluateCheckpointCertification({
        level: 'B1',
        skillScores: { listening: 40, reading: 40, speaking: 40, writing: 40 },
        attemptId: 'cefr:B1:chk_weak_retake',
        nowMs: 5000,
      });
      expect(weakRetake.isPassed).toBe(false);

      // Update store with weak retake
      storeCerts = preserveHighestCertificationOnRetake(storeCerts, weakRetake);

      // INVARIANT CHECK: Certificate MUST remain intact!
      expect(storeCerts.B1).toBeDefined();
      expect(storeCerts.B1!.certificateId).toBe(originalCertId);
      expect(storeCerts.B1!.certifiedAt).toBe(originalCertifiedAt);
      expect(storeCerts.B1!.overallScore).toBe(85);
    });

    it('preserves higher score if retake passes but with lower score', () => {
      // Pass 1: 90%
      const pass1 = evaluateCheckpointCertification({
        level: 'B2',
        skillScores: { listening: 90, reading: 90, speaking: 90, writing: 90 },
        attemptId: 'cefr:B2:chk_high_score',
        nowMs: 1000,
      });

      let storeCerts = preserveHighestCertificationOnRetake({}, pass1);
      expect(storeCerts.B2!.overallScore).toBe(90);

      // Pass 2: 78% (passes threshold 75, but lower than 90%)
      const pass2 = evaluateCheckpointCertification({
        level: 'B2',
        skillScores: { listening: 78, reading: 78, speaking: 78, writing: 78 },
        attemptId: 'cefr:B2:chk_lower_score',
        nowMs: 2000,
      });

      storeCerts = preserveHighestCertificationOnRetake(storeCerts, pass2);

      // Keeps higher score 90%
      expect(storeCerts.B2!.overallScore).toBe(90);
      expect(storeCerts.B2!.attemptId).toBe('cefr:B2:chk_high_score');
    });
  });

  // =========================================================================
  // 8. SKIP-LEVEL ISOLATION
  // =========================================================================
  describe('8. Skip-Level Isolation', () => {
    it('does not auto-certify lower levels when certifying at a higher level', () => {
      // User directly certifies at B1
      const evalB1 = evaluateCheckpointCertification({
        level: 'B1',
        skillScores: { listening: 85, reading: 85, speaking: 85, writing: 85 },
        attemptId: 'cefr:B1:chk_direct_b1',
      });

      const certs = preserveHighestCertificationOnRetake({}, evalB1);

      expect(certs.B1).toBeDefined();
      expect(certs.A1).toBeUndefined();
      expect(certs.A2).toBeUndefined();

      // Highest certified level is B1
      expect(deriveHighestCertifiedLevel(certs)).toBe('B1');

      // Skip-level isolation verified
      expect(verifySkipLevelIsolation(certs, 'B1')).toBe(true);
    });

    it('detects violation if corrupted store shares same certificateId across levels', () => {
      const corruptCerts: LevelCertificationStore = {
        A1: {
          level: 'A1',
          certificateId: 'SHARED_ID_123',
          certifiedAt: 1000,
          overallScore: 80,
          skillScores: { listening: 80, reading: 80, speaking: 80, writing: 80 },
          attemptId: 'chk_1',
          verifiedVersion: '2026.1',
          criteriaSummary: {} as any,
        },
        B1: {
          level: 'B1',
          certificateId: 'SHARED_ID_123', // ILLEGAL DUPLICATE ID
          certifiedAt: 1000,
          overallScore: 80,
          skillScores: { listening: 80, reading: 80, speaking: 80, writing: 80 },
          attemptId: 'chk_2',
          verifiedVersion: '2026.1',
          criteriaSummary: {} as any,
        },
      };

      expect(verifySkipLevelIsolation(corruptCerts, 'B1')).toBe(false);
    });
  });

  // =========================================================================
  // 9. OLD USER / NO ATTEMPTS BEHAVIOR
  // =========================================================================
  describe('9. Old User / No Attempts Behavior', () => {
    it('safely handles empty/undefined history and certifications without errors', () => {
      // Empty store
      expect(deriveHighestCertifiedLevel(undefined)).toBeNull();
      expect(deriveHighestCertifiedLevel({})).toBeNull();

      expect(getCheckpointHistoryForLevel(undefined as any, 'A1')).toEqual([]);
      expect(getCheckpointHistoryForLevel([], 'B2')).toEqual([]);

      const retakeStatus = canRetakeCheckpointLevel('A1', []);
      expect(retakeStatus.canRetake).toBe(true);
      expect(retakeStatus.remainingCooldownMs).toBe(0);

      const status = deriveCertificationStatus('A1', undefined, null, null);
      expect(status).toBe('unattempted');
    });
  });

  // =========================================================================
  // 10. INVALID / CORRUPT ATTEMPT HANDLING
  // =========================================================================
  describe('10. Invalid / Corrupt Attempt Handling', () => {
    it('safely handles NaN, Infinity, negative, and invalid string inputs', () => {
      const evaluation = evaluateCheckpointCertification({
        level: 'B1',
        skillScores: {
          listening: NaN,
          reading: Infinity,
          speaking: -50,
          writing: 'not_a_number' as any,
        },
        attemptId: '',
      });

      expect(evaluation.isPassed).toBe(false);
      expect(evaluation.result).toBe('needs_reinforcement');
      expect(evaluation.overallScore).toBe(0);
      if (!evaluation.isPassed) {
        expect(evaluation.failingReasons.length).toBeGreaterThan(0);
      }

      // History creation does not throw on corrupt evaluation
      const historyEntry = createCheckpointHistoryEntry(evaluation);
      expect(historyEntry.attemptId).toBeDefined();
      expect(historyEntry.overallScore).toBe(0);
      expect(historyEntry.scores.listening).toBe(0);

      // Append handles empty or malformed entry gracefully
      const safeAppend = appendCheckpointHistory([], {} as any);
      expect(safeAppend).toEqual([]);
    });

    it('bounds history pruning to prevent unbounded localStorage growth', () => {
      let history: CheckpointHistoryEntry[] = [];
      for (let i = 0; i < 40; i++) {
        history = appendCheckpointHistory(history, {
          attemptId: `attempt_${i}`,
          level: 'A1',
          date: 1000 + i * 1000,
          result: 'needs_reinforcement',
          isPassed: false,
          overallScore: 50,
          scores: { listening: 50, reading: 50, speaking: 50, writing: 50 },
          policyVersion: '2026.1',
          schemaVersion: 1,
        });
      }

      // Per-level limit is 10, total limit is 30
      expect(history.length).toBeLessThanOrEqual(10);
      expect(history[0].attemptId).toBe('attempt_39'); // Newest first
    });
  });
});
