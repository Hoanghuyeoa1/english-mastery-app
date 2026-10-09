// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  interpretEvidenceCompetency,
  calculateRecencyWeight,
  evaluateSkillCompetencyV2,
  isCefrAtLeast,
} from '../competencyCalculationEngine';
import type { CompetencyEvidence } from '../../types/competencyEvidence';

describe('PHASE 2 — Four Skills Competency Model v2 Pure Calculation Engine Suite', () => {
  const fixedNow = 1_700_000_000_000; // Reference timestamp in ms

  // =========================================================================
  // 1. DIFFICULTY-AWARE COMPETENCY (100% A1 ≠ 100% C1)
  // =========================================================================
  describe('1. Difficulty-Aware Interpretation', () => {
    it('100% on A1 task does NOT jump to C1/C2 (100% A1 ≠ 100% C1)', () => {
      const a1Mastery: CompetencyEvidence = {
        id: 'ev_a1',
        skill: 'reading',
        score: 100,
        source: 'four-skills',
        cefrDifficulty: 'A1',
        createdAt: fixedNow,
      };

      const c1Mastery: CompetencyEvidence = {
        id: 'ev_c1',
        skill: 'reading',
        score: 100,
        source: 'four-skills',
        cefrDifficulty: 'C1',
        createdAt: fixedNow,
      };

      const effectiveA1 = interpretEvidenceCompetency(a1Mastery);
      const effectiveC1 = interpretEvidenceCompetency(c1Mastery);

      // A1 100% is anchored at max 29 (A1 ceiling within [0, 29] range)
      expect(effectiveA1).toBe(29);
      // C1 100% is anchored at 96 (C1/C2 master)
      expect(effectiveC1).toBe(96);
      expect(effectiveA1).not.toBe(effectiveC1);
    });

    it('retains 1:1 score for legacy/unrated evidence without fake CEFR anchoring', () => {
      const unrated: CompetencyEvidence = {
        id: 'ev_legacy',
        skill: 'writing',
        score: 82,
        source: 'legacy',
        cefrDifficulty: undefined,
        createdAt: 0,
      };

      expect(interpretEvidenceCompetency(unrated)).toBe(82);
    });

    it('smoothly scales partial scores within the difficulty anchor range', () => {
      const b2Fifty: CompetencyEvidence = {
        id: 'ev_b2_50',
        skill: 'listening',
        score: 50,
        source: 'four-skills',
        cefrDifficulty: 'B2',
        createdAt: fixedNow,
      };

      // B2 anchor: [60, 88]. 50% = 60 + 0.5 * 28 = 74
      expect(interpretEvidenceCompetency(b2Fifty)).toBe(74);
    });
  });

  // =========================================================================
  // 2. RECENCY WEIGHTING & TIME DECAY
  // =========================================================================
  describe('2. Recency Weighting & Time Decay', () => {
    it('recent performance weighs significantly more than old low performance', () => {
      const oneDayMs = 86_400_000;
      const sixtyDaysAgo = fixedNow - 60 * oneDayMs;

      // Old poor scores (60 days ago) vs recent high scores (today)
      const evidenceList: CompetencyEvidence[] = [
        { id: 'old_1', skill: 'reading', score: 40, source: 'four-skills', createdAt: sixtyDaysAgo },
        { id: 'old_2', skill: 'reading', score: 45, source: 'four-skills', createdAt: sixtyDaysAgo },
        { id: 'rec_1', skill: 'reading', score: 80, source: 'four-skills', createdAt: fixedNow },
        { id: 'rec_2', skill: 'reading', score: 82, source: 'four-skills', createdAt: fixedNow },
        { id: 'rec_3', skill: 'reading', score: 85, source: 'four-skills', createdAt: fixedNow },
      ];

      const result = evaluateSkillCompetencyV2('reading', evidenceList, { now: fixedNow });
      const rawAvg = (40 + 45 + 80 + 82 + 85) / 5; // 66.4 -> 66

      // Weighted score should be pulled strongly towards recent 80-85, higher than rawAvg
      expect(result.score).toBeGreaterThan(rawAvg);
      expect(result.score).toBeGreaterThanOrEqual(72);
      expect(result.debugExplanation.rawAverage).toBe(66);
    });

    it('old evidence never completely vanishes (respects safety floor)', () => {
      const veryOldTime = fixedNow - 365 * 86_400_000; // 1 year ago
      const weight = calculateRecencyWeight(veryOldTime, fixedNow);

      expect(weight).toBeGreaterThanOrEqual(0.35); // Bounded at floor
      expect(weight).toBeLessThan(0.40);
    });
  });

  // =========================================================================
  // 3. SAMPLE SIZE + CONFIDENCE (1 x 90 vs 20 x 90)
  // =========================================================================
  describe('3. Sample Size + Confidence', () => {
    it('1 x 90 vs 20 x 90 results in near-identical competency but vastly different confidence', () => {
      const singleAttempt: CompetencyEvidence[] = [
        { id: 'ev_1', skill: 'listening', score: 90, source: 'four-skills', createdAt: fixedNow },
      ];

      const twentyAttempts: CompetencyEvidence[] = Array.from({ length: 20 }, (_, i) => ({
        id: `ev_${i}`,
        skill: 'listening',
        score: 90,
        source: 'four-skills',
        createdAt: fixedNow - i * 3600_000,
      }));

      const res1 = evaluateSkillCompetencyV2('listening', singleAttempt, { now: fixedNow });
      const res20 = evaluateSkillCompetencyV2('listening', twentyAttempts, { now: fixedNow });

      // Competency scores should both be 90
      expect(res1.score).toBe(90);
      expect(res20.score).toBe(90);

      // Confidence of 1 attempt must be low (< 0.40)
      expect(res1.confidence).toBeLessThan(0.40);
      // Confidence of 20 attempts must be high (> 0.85)
      expect(res20.confidence).toBeGreaterThan(0.85);
      expect(res20.confidence).toBeGreaterThan(res1.confidence * 2);
    });
  });

  // =========================================================================
  // 4. VARIANCE & STABILITY (STABLE VS VOLATILE)
  // =========================================================================
  describe('4. Variance & Stability', () => {
    it('stable scores yield higher stability and confidence than volatile scores', () => {
      // Stable series: [82, 84, 80, 83, 81] (mean = 82)
      const stableSeries: CompetencyEvidence[] = [82, 84, 80, 83, 81].map((s, i) => ({
        id: `stable_${i}`,
        skill: 'writing',
        score: s,
        source: 'writing-ai',
        createdAt: fixedNow,
      }));

      // Volatile series: [90, 40, 95, 35, 88] (mean ~ 69.6, high variance)
      const volatileSeries: CompetencyEvidence[] = [90, 40, 95, 35, 88].map((s, i) => ({
        id: `vol_${i}`,
        skill: 'writing',
        score: s,
        source: 'writing-ai',
        createdAt: fixedNow,
      }));

      const evalStable = evaluateSkillCompetencyV2('writing', stableSeries, { now: fixedNow });
      const evalVolatile = evaluateSkillCompetencyV2('writing', volatileSeries, { now: fixedNow });

      expect(evalStable.stabilityScore).toBeGreaterThan(evalVolatile.stabilityScore);
      expect(evalStable.confidence).toBeGreaterThan(evalVolatile.confidence);
      expect(evalStable.debugExplanation.standardDeviation).toBeLessThan(5);
      expect(evalVolatile.debugExplanation.standardDeviation).toBeGreaterThan(20);
    });
  });

  // =========================================================================
  // 5. CONSERVATIVE CEFR PROMOTION
  // =========================================================================
  describe('5. Conservative CEFR Promotion', () => {
    it('single 95% on C1 task does NOT immediately jump to C1/C2 due to sample size requirement', () => {
      const singleHighC1: CompetencyEvidence[] = [
        { id: 'single_c1', skill: 'reading', score: 95, source: 'four-skills', cefrDifficulty: 'C1', createdAt: fixedNow },
      ];

      const result = evaluateSkillCompetencyV2('reading', singleHighC1, { now: fixedNow });
      // Score is high, but level promotion is capped at B1/B2 because N=1 < gate.minAttempts
      expect(result.level).not.toBe('C1');
      expect(result.level).not.toBe('C2');
      expect(result.debugExplanation.promotionCapped).toBe(true);
    });

    it('promotes smoothly to C1 when multiple consistent strong attempts are demonstrated', () => {
      // 4 consistent high scores of 90 on C1 tasks (effective score ~94 -> C1)
      const consistentC1: CompetencyEvidence[] = Array.from({ length: 4 }, (_, i) => ({
        id: `c1_${i}`,
        skill: 'reading',
        score: 90,
        source: 'four-skills',
        cefrDifficulty: 'C1',
        createdAt: fixedNow - i * 86_400_000,
      }));

      const result = evaluateSkillCompetencyV2('reading', consistentC1, { now: fixedNow });
      expect(result.level).toBe('C1');
      expect(result.debugExplanation.promotionCapped).toBe(false);
    });

    it('requires at least 5 attempts to unlock C2 even if score is 95+', () => {
      // 4 attempts of 95 on C1 tasks reaches score 95, but capped at C1
      const fourC2Attempts: CompetencyEvidence[] = Array.from({ length: 4 }, (_, i) => ({
        id: `c2_cand_${i}`,
        skill: 'reading',
        score: 95,
        source: 'four-skills',
        cefrDifficulty: 'C1',
        createdAt: fixedNow - i * 86_400_000,
      }));

      const res4 = evaluateSkillCompetencyV2('reading', fourC2Attempts, { now: fixedNow });
      expect(res4.level).toBe('C1'); // Capped at C1 because N=4 < 5
      expect(res4.debugExplanation.promotionCapped).toBe(true);

      // Adding 5th attempt unlocks C2
      const fiveC2Attempts = [
        ...fourC2Attempts,
        { id: 'c2_cand_4', skill: 'reading' as const, score: 95, source: 'four-skills' as const, cefrDifficulty: 'C1' as const, createdAt: fixedNow },
      ];
      const res5 = evaluateSkillCompetencyV2('reading', fiveC2Attempts, { now: fixedNow });
      expect(res5.level).toBe('C2');
      expect(res5.debugExplanation.promotionCapped).toBe(false);
    });
  });

  // =========================================================================
  // 6. NO-DATA & BOUNDARIES
  // =========================================================================
  describe('6. No-Data & Boundary Cases', () => {
    it('empty evidence list returns isAssessed: false, score: 0, level: A1, confidence: 0', () => {
      const result = evaluateSkillCompetencyV2('speaking', [], { now: fixedNow });

      expect(result.isAssessed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.level).toBe('A1');
      expect(result.confidence).toBe(0);
      expect(result.evidenceCount).toBe(0);
      expect(result.recentEvidenceCount).toBe(0);
    });

    it('isCefrAtLeast helper accurately compares standard CEFR ordering', () => {
      expect(isCefrAtLeast('B2', 'B1')).toBe(true);
      expect(isCefrAtLeast('B2', 'B2')).toBe(true);
      expect(isCefrAtLeast('B1', 'B2')).toBe(false);
      expect(isCefrAtLeast('C2', 'A1')).toBe(true);
      expect(isCefrAtLeast(undefined, 'A1')).toBe(false);
    });
  });
});
