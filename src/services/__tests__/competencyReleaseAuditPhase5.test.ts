// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateAndNormalizeEvidence,
  createCompetencyEvidence,
  adaptLegacyScoresToEvidence,
  deduplicateEvidence,
  boundEvidenceHistory,
  mergeEvidenceArrays,
  sanitizeEvidenceStore,
} from '../competencyEvidenceService';
import {
  evaluateSkillCompetencyV2,
  evaluateFourSkillsCompetencyV2,
  interpretEvidenceCompetency,
  calculateRecencyWeight,
  calculateSourceQualityWeight,
  isCefrAtLeast,
} from '../skillsCompetencyService';
import { useAppStore } from '../../store/useAppStore';
import { deriveTutorLearningContext } from '../tutorLearningContext';
import type { CompetencyEvidence, CompetencyEvidenceInput } from '../../types/competencyEvidence';

describe('PHASE 5 — Full Regression, Verification & Release Audit Suite', () => {
  const fixedNow = 1_700_000_000_000;

  beforeEach(() => {
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
    });
    localStorage.clear();
  });

  // =========================================================================
  // 1. END-TO-END TRACE FOR EACH OF THE 4 SKILLS
  // =========================================================================
  describe('1. End-to-End Tracing across All 4 Skills', () => {
    it('traces Listening: Four Skills comprehension + TOEIC Listening evidence pipeline', () => {
      // Listening quiz on B2 lesson with 80% score
      useAppStore.getState().recordSkillEvidence({
        skill: 'listening',
        score: 80,
        source: 'four-skills',
        cefrDifficulty: 'B2',
      });

      // TOEIC listening assessment with 85% score
      useAppStore.getState().recordSkillEvidence({
        skill: 'listening',
        score: 85,
        source: 'toeic',
        quality: 1.0,
      });

      const evidenceList = useAppStore.getState().fourSkillsEvidence?.listening || [];
      expect(evidenceList.length).toBe(2);

      const evaluation = evaluateSkillCompetencyV2('listening', evidenceList);
      expect(evaluation.isAssessed).toBe(true);
      expect(evaluation.score).toBeGreaterThanOrEqual(80);
      expect(evaluation.level).toBe('B2');
      expect(evaluation.confidence).toBeGreaterThan(0.25);
    });

    it('traces Reading: Four Skills passage comprehension + TOEIC Reading pipeline', () => {
      // Reading passage B1 quiz: 90%
      useAppStore.getState().recordSkillEvidence({
        skill: 'reading',
        score: 90,
        source: 'four-skills',
        cefrDifficulty: 'B1',
      });

      // TOEIC reading test: 75%
      useAppStore.getState().recordSkillEvidence({
        skill: 'reading',
        score: 75,
        source: 'toeic',
      });

      const evidenceList = useAppStore.getState().fourSkillsEvidence?.reading || [];
      expect(evidenceList.length).toBe(2);

      const evaluation = evaluateSkillCompetencyV2('reading', evidenceList);
      expect(evaluation.isAssessed).toBe(true);
      expect(evaluation.score).toBeGreaterThanOrEqual(70);
      expect(evaluation.level).toBe('B2');
    });

    it('traces Speaking: Smart Shadowing partial repetition (0.65) + interactive roleplay (0.85) pipeline', () => {
      // Smart Shadowing session (pronunciation repetition only - partial quality 0.65)
      useAppStore.getState().recordSkillEvidence({
        skill: 'speaking',
        score: 90,
        source: 'shadowing',
        cefrDifficulty: 'B1',
        quality: 0.65,
      });

      // Four Skills interactive speaking prompt (quality 0.85)
      useAppStore.getState().recordSkillEvidence({
        skill: 'speaking',
        score: 80,
        source: 'four-skills',
        cefrDifficulty: 'B1',
        quality: 0.85,
      });

      const evidenceList = useAppStore.getState().fourSkillsEvidence?.speaking || [];
      expect(evidenceList.length).toBe(2);

      const evaluation = evaluateSkillCompetencyV2('speaking', evidenceList);
      expect(evaluation.isAssessed).toBe(true);
      expect(evaluation.score).toBeGreaterThan(60);
      expect(evaluation.level).toBe('B1');
    });

    it('traces Writing: Writing Studio AI rubric (1.0) + offline fallback (0.65) pipeline', () => {
      // AI-evaluated writing prompt with 4-criteria rubric
      useAppStore.getState().recordSkillEvidence({
        skill: 'writing',
        score: 85,
        source: 'writing-ai',
        cefrDifficulty: 'B2',
        quality: 1.0,
      });

      // Offline heuristic fallback evaluation
      useAppStore.getState().recordSkillEvidence({
        skill: 'writing',
        score: 70,
        source: 'writing-offline',
        cefrDifficulty: 'B2',
        quality: 0.65,
      });

      const evidenceList = useAppStore.getState().fourSkillsEvidence?.writing || [];
      expect(evidenceList.length).toBe(2);

      const evaluation = evaluateSkillCompetencyV2('writing', evidenceList);
      expect(evaluation.isAssessed).toBe(true);
      expect(evaluation.score).toBeGreaterThanOrEqual(75);
      expect(evaluation.level).toBe('B2');
    });
  });

  // =========================================================================
  // 2. EXHAUSTIVE EDGE CASES (ZERO-CRASH CONTRACT)
  // =========================================================================
  describe('2. Exhaustive Edge Cases & Fault Tolerance', () => {
    it('handles 0 and 100 boundaries cleanly', () => {
      const evZero = validateAndNormalizeEvidence({ skill: 'reading', score: 0, source: 'four-skills' });
      const ev100 = validateAndNormalizeEvidence({ skill: 'reading', score: 100, source: 'four-skills' });

      expect(evZero?.score).toBe(0);
      expect(ev100?.score).toBe(100);

      const evalZero = evaluateSkillCompetencyV2('reading', [evZero!]);
      const eval100 = evaluateSkillCompetencyV2('reading', [ev100!]);

      expect(evalZero.score).toBe(0);
      expect(evalZero.level).toBe('A1');
      expect(eval100.score).toBe(100);
    });

    it('sanitizes NaN, Infinity, negative, and >100 without throwing', () => {
      // NaN and Infinity must be rejected (return null)
      expect(validateAndNormalizeEvidence({ skill: 'listening', score: NaN, source: 'toeic' })).toBeNull();
      expect(validateAndNormalizeEvidence({ skill: 'listening', score: Infinity, source: 'toeic' })).toBeNull();
      expect(validateAndNormalizeEvidence({ skill: 'listening', score: -Infinity, source: 'toeic' })).toBeNull();

      // Negative clamped to 0
      const evNeg = validateAndNormalizeEvidence({ skill: 'listening', score: -25, source: 'toeic' });
      expect(evNeg?.score).toBe(0);

      // >100 clamped to 100
      const evOver = validateAndNormalizeEvidence({ skill: 'listening', score: 145, source: 'toeic' });
      expect(evOver?.score).toBe(100);
    });

    it('evaluates empty history safely without NaN or crashes', () => {
      const result = evaluateSkillCompetencyV2('speaking', []);
      expect(result.isAssessed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.level).toBe('A1');
      expect(result.confidence).toBe(0);
      expect(result.stabilityScore).toBe(1.0);
      expect(Number.isNaN(result.score)).toBe(false);
      expect(Number.isNaN(result.confidence)).toBe(false);
    });

    it('evaluates exactly 1 evidence item without division by zero', () => {
      const single = [
        createCompetencyEvidence({ skill: 'reading', score: 75, source: 'four-skills' })!,
      ];
      const result = evaluateSkillCompetencyV2('reading', single);
      expect(result.isAssessed).toBe(true);
      expect(result.score).toBe(75);
      expect(result.evidenceCount).toBe(1);
      expect(result.stabilityScore).toBe(0.8);
      expect(result.confidence).toBeLessThan(0.40);
    });

    it('evaluates 50 evidence items stably within performance budget', () => {
      const fiftyItems = Array.from({ length: 50 }, (_, i) =>
        createCompetencyEvidence({
          skill: 'listening',
          score: 80 + (i % 10),
          source: 'toeic',
          createdAt: fixedNow - i * 3600_000,
        })!
      );

      const startTime = performance.now();
      const result = evaluateSkillCompetencyV2('listening', fiftyItems, { now: fixedNow });
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(50); // Fast deterministic calculation < 50ms
      expect(result.evidenceCount).toBe(50);
      expect(result.confidence).toBeGreaterThan(0.70);
    });

    it('handles legacy evidence without cefrDifficulty cleanly', () => {
      const legacy = adaptLegacyScoresToEvidence('speaking', [70, 75, 80]);
      expect(legacy.length).toBe(3);
      expect(legacy[0].source).toBe('legacy');
      expect(legacy[0].cefrDifficulty).toBeUndefined();

      const evalLegacy = evaluateSkillCompetencyV2('speaking', legacy, { now: fixedNow });
      expect(evalLegacy.isAssessed).toBe(true);
      expect(evalLegacy.score).toBe(75);
    });

    it('deduplicates duplicate evidence IDs and bounds history to 50 items', () => {
      const duplicateItems: CompetencyEvidence[] = [
        { id: 'dup_1', skill: 'reading', score: 80, source: 'four-skills', createdAt: fixedNow },
        { id: 'dup_1', skill: 'reading', score: 80, source: 'four-skills', createdAt: fixedNow },
        { id: 'dup_2', skill: 'reading', score: 85, source: 'four-skills', createdAt: fixedNow },
      ];

      const deduped = deduplicateEvidence(duplicateItems);
      expect(deduped.length).toBe(2);

      const sixtyItems: CompetencyEvidence[] = Array.from({ length: 60 }, (_, i) => ({
        id: `item_${i}`,
        skill: 'reading',
        score: 75,
        source: 'four-skills',
        createdAt: fixedNow + i,
      }));

      const bounded = boundEvidenceHistory(sixtyItems, 50);
      expect(bounded.length).toBe(50);
      expect(bounded[49].id).toBe('item_59'); // Preserves most recent
    });

    it('handles future timestamp and invalid timestamp gracefully', () => {
      // Future timestamp > now + 60s clamped to now
      const evFuture = validateAndNormalizeEvidence(
        { skill: 'writing', score: 80, source: 'writing-ai', createdAt: fixedNow + 999_999 },
        { now: fixedNow }
      );
      expect(evFuture?.createdAt).toBe(fixedNow);

      // Invalid timestamp (negative or string) replaced with now
      const evInvalid = validateAndNormalizeEvidence(
        { skill: 'writing', score: 80, source: 'writing-ai', createdAt: -500 },
        { now: fixedNow }
      );
      expect(evInvalid?.createdAt).toBe(fixedNow);
    });

    it('handles unknown source and unknown CEFR level safely', () => {
      // Unknown source is rejected
      const evUnknownSource = validateAndNormalizeEvidence({
        skill: 'writing',
        score: 80,
        source: 'hacked_source' as any,
      });
      expect(evUnknownSource).toBeNull();

      // Unknown CEFR level is sanitized to undefined (not rejected, not inventing fake CEFR)
      const evUnknownCefr = validateAndNormalizeEvidence({
        skill: 'writing',
        score: 80,
        source: 'writing-ai',
        cefrDifficulty: 'B3_UNKNOWN' as any,
      });
      expect(evUnknownCefr).not.toBeNull();
      expect(evUnknownCefr?.cefrDifficulty).toBeUndefined();
    });

    it('cloud merge conflict resolution is idempotent and bounded', () => {
      const localEvidence: CompetencyEvidence[] = [
        { id: 'ev_shared_1', skill: 'listening', score: 80, source: 'toeic', createdAt: fixedNow },
        { id: 'ev_local_only', skill: 'listening', score: 85, source: 'toeic', createdAt: fixedNow + 1000 },
      ];

      const cloudEvidence: CompetencyEvidence[] = [
        { id: 'ev_shared_1', skill: 'listening', score: 80, source: 'toeic', createdAt: fixedNow },
        { id: 'ev_cloud_only', skill: 'listening', score: 90, source: 'toeic', createdAt: fixedNow + 2000 },
      ];

      const merged = mergeEvidenceArrays(localEvidence, cloudEvidence, 50);
      expect(merged.length).toBe(3);
      expect(merged.map((e) => e.id)).toEqual(['ev_shared_1', 'ev_local_only', 'ev_cloud_only']);
    });
  });

  // =========================================================================
  // 3. REQUIRED BEHAVIORAL CASES (A, B, C)
  // =========================================================================
  describe('3. Required Behavioral Cases (A, B, C)', () => {
    it('Case A: A1 quiz 100% -> score 29, level A1, confidence low (never jumps to A2/C1/C2)', () => {
      const a1Quiz100: CompetencyEvidence = {
        id: 'case_a_a1_100',
        skill: 'reading',
        score: 100,
        source: 'four-skills',
        cefrDifficulty: 'A1',
        createdAt: fixedNow,
        quality: 1.0,
      };

      const result = evaluateSkillCompetencyV2('reading', [a1Quiz100], { now: fixedNow });

      // Anchor A1 is [0, 29]. 100% maps to 29 (the true ceiling of A1 [0, 29]).
      expect(result.score).toBe(29);
      // 29 is within A1 range [0, 29]
      expect(result.level).toBe('A1');
      // Confidence with 1 sample must be low (< 0.40)
      expect(result.confidence).toBeLessThan(0.40);
      expect(result.confidence).toBeGreaterThan(0.15);
      // Invariant: MUST NOT jump to A2, C1 or C2
      expect(result.level).not.toBe('A2');
      expect(result.level).not.toBe('C1');
      expect(result.level).not.toBe('C2');
    });

    it('Case B: Multiple B2 quizzes 75-85% consistent -> stable competency ~82, level B2, confidence medium/high', () => {
      const b2Scores = [75, 80, 85, 78, 82];
      const consistentB2History: CompetencyEvidence[] = b2Scores.map((s, idx) => ({
        id: `case_b_b2_${idx}`,
        skill: 'listening',
        score: s,
        source: 'four-skills',
        cefrDifficulty: 'B2',
        createdAt: fixedNow - idx * 3600_000,
        quality: 1.0,
      }));

      const result = evaluateSkillCompetencyV2('listening', consistentB2History, { now: fixedNow });

      // Effective scores on B2 anchor [60, 88] average to ~82
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.score).toBeLessThanOrEqual(85);
      // Consistent performance unlocks B2
      expect(result.level).toBe('B2');
      // Confidence is >= 0.50 (sample size 5 and high stability)
      expect(result.confidence).toBeGreaterThanOrEqual(0.50);
      expect(result.stabilityScore).toBeGreaterThan(0.90);
      expect(result.debugExplanation.promotionCapped).toBe(false);
    });

    it('Case C: 1 C1 quiz 95% -> score 95, but CEFR is strictly capped at B1 due to promotion gates', () => {
      const singleHighC1: CompetencyEvidence = {
        id: 'case_c_single_c1_95',
        skill: 'reading',
        score: 95,
        source: 'four-skills',
        cefrDifficulty: 'C1',
        createdAt: fixedNow,
        quality: 1.0,
      };

      const result = evaluateSkillCompetencyV2('reading', [singleHighC1], { now: fixedNow });

      // Raw C1 anchor [75, 96] effective score is 95
      expect(result.score).toBe(95);
      // With N=1, confidence is low (< 0.30), promotion gates B2, C1, C2 prevent premature promotion
      // Gate B2 requires >= 2 attempts and confidence >= 0.30 -> capped to B1!
      expect(result.level).toBe('B1');
      expect(result.confidence).toBeLessThan(0.30);
      expect(result.debugExplanation.promotionCapped).toBe(true);
      expect(result.debugExplanation.promotionCapReason).toBeDefined();

      // Invariant: MUST NOT jump to C1 or C2
      expect(result.level).not.toBe('C1');
      expect(result.level).not.toBe('C2');
    });
  });

  // =========================================================================
  // 4. EXPLICIT AUDIT REGRESSION CATEGORIES
  // =========================================================================
  describe('4. Explicit Audit Regression Categories', () => {
    it('stale evidence respects exponential decay with 0.35 minimum safety floor', () => {
      const ninetyDaysAgo = fixedNow - 90 * 86_400_000;
      const staleEvidence: CompetencyEvidence[] = [
        { id: 'stale_1', skill: 'reading', score: 90, source: 'four-skills', createdAt: ninetyDaysAgo },
      ];
      const recentEvidence: CompetencyEvidence[] = [
        { id: 'recent_1', skill: 'reading', score: 70, source: 'four-skills', createdAt: fixedNow },
      ];

      const combined = [...staleEvidence, ...recentEvidence];
      const result = evaluateSkillCompetencyV2('reading', combined, { now: fixedNow });

      // Stale weight should decay close to floor 0.35
      const staleWeight = calculateRecencyWeight(ninetyDaysAgo, fixedNow);
      expect(staleWeight).toBeGreaterThanOrEqual(0.35);
      expect(staleWeight).toBeLessThan(0.37);

      // Result is strongly pulled towards recent score (70) rather than simple average (80)
      expect(result.score).toBeLessThan(80);
      expect(result.score).toBeCloseTo(75, 1);
    });

    it('mixed difficulty correctly interpolates effective scores across CEFR levels', () => {
      const mixedEvidence: CompetencyEvidence[] = [
        { id: 'm_a2', skill: 'reading', score: 100, source: 'four-skills', cefrDifficulty: 'A2', createdAt: fixedNow }, // 20 + 1.0 * 35 = 55
        { id: 'm_b1', skill: 'reading', score: 100, source: 'four-skills', cefrDifficulty: 'B1', createdAt: fixedNow }, // 40 + 1.0 * 35 = 75
        { id: 'm_b2', skill: 'reading', score: 100, source: 'four-skills', cefrDifficulty: 'B2', createdAt: fixedNow }, // 60 + 1.0 * 28 = 88
      ];

      const result = evaluateSkillCompetencyV2('reading', mixedEvidence, { now: fixedNow });
      expect(result.evidenceCount).toBe(3);
      expect(result.strongestEvidenceLevel).toBe('B2');
      // Average of [55, 75, 88] is ~72.7 -> 73
      expect(result.score).toBe(73);
      expect(result.level).toBe('B2');
    });

    it('mixed source quality appropriately balances standardized (1.0) vs partial (0.65) sources', () => {
      const itemHighQuality: CompetencyEvidence = {
        id: 'ev_toeic',
        skill: 'speaking',
        score: 80,
        source: 'toeic', // weight 1.0
        createdAt: fixedNow,
        quality: 1.0,
      };

      const itemLowQuality: CompetencyEvidence = {
        id: 'ev_shadowing',
        skill: 'speaking',
        score: 60,
        source: 'shadowing', // weight 0.65
        createdAt: fixedNow,
        quality: 0.65,
      };

      const weightHigh = calculateSourceQualityWeight(itemHighQuality);
      const weightLow = calculateSourceQualityWeight(itemLowQuality);

      expect(weightHigh).toBe(1.0);
      expect(weightLow).toBeCloseTo(0.65 * 0.65, 2); // 0.42

      const result = evaluateSkillCompetencyV2('speaking', [itemHighQuality, itemLowQuality], { now: fixedNow });
      // Weighted score should be pulled much closer to 80 (high quality) than 60 (low quality)
      expect(result.score).toBeGreaterThan(70);
    });

    it('legacy scores backfill correctly into valid CompetencyEvidence without corrupting state', () => {
      const legacyScores = [80, 85, 90];
      const backfilled = adaptLegacyScoresToEvidence('listening', legacyScores);

      expect(backfilled.length).toBe(3);
      backfilled.forEach((item, index) => {
        expect(item.source).toBe('legacy');
        expect(item.createdAt).toBe(0);
        expect(item.cefrDifficulty).toBeUndefined();
        expect(item.score).toBe(legacyScores[index]);
      });

      const evalResult = evaluateSkillCompetencyV2('listening', backfilled, { now: fixedNow });
      expect(evalResult.isAssessed).toBe(true);
      expect(evalResult.score).toBe(85);
    });

    it('promotion gates systematically prevent premature advancement for B2, C1, and C2', () => {
      // 1 single attempt with raw score 95 on C2 task
      const singleC2: CompetencyEvidence[] = [
        { id: 'c2_single', skill: 'reading', score: 95, source: 'four-skills', cefrDifficulty: 'C2', createdAt: fixedNow },
      ];

      const resSingle = evaluateSkillCompetencyV2('reading', singleC2, { now: fixedNow });
      // Gated because N=1 < 2 for B2 -> capped at B1
      expect(resSingle.level).toBe('B1');
      expect(resSingle.debugExplanation.promotionCapped).toBe(true);

      // 2 attempts of 95 on C2 task: unlocks B2 (N>=2, conf>=0.30), but C1 requires N>=3
      const twoC2: CompetencyEvidence[] = [
        ...singleC2,
        { id: 'c2_two', skill: 'reading', score: 95, source: 'four-skills', cefrDifficulty: 'C2', createdAt: fixedNow },
      ];
      const resTwo = evaluateSkillCompetencyV2('reading', twoC2, { now: fixedNow });
      expect(resTwo.level).toBe('B2');
      expect(resTwo.debugExplanation.promotionCapped).toBe(true);

      // 3 attempts of 95 on C2 task: unlocks C1 (N>=3, conf>=0.45), but C2 requires N>=5
      const threeC2: CompetencyEvidence[] = [
        ...twoC2,
        { id: 'c2_three', skill: 'reading', score: 95, source: 'four-skills', cefrDifficulty: 'C2', createdAt: fixedNow },
      ];
      const resThree = evaluateSkillCompetencyV2('reading', threeC2, { now: fixedNow });
      expect(resThree.level).toBe('C1');
      expect(resThree.debugExplanation.promotionCapped).toBe(true);
    });

    it('Speaking safeguard: Shadowing repetition alone is capped at C1 and CANNOT achieve C2 Speaking', () => {
      // 10 perfect 100% scores on Shadowing repetition (C2 difficulty)
      const tenShadowingSessions: CompetencyEvidence[] = Array.from({ length: 10 }, (_, i) => ({
        id: `shadow_c2_${i}`,
        skill: 'speaking',
        score: 100,
        source: 'shadowing',
        cefrDifficulty: 'C2',
        createdAt: fixedNow - i * 3600_000,
        quality: 0.65,
      }));

      const evaluation = evaluateSkillCompetencyV2('speaking', tenShadowingSessions, { now: fixedNow });

      // Invariant: Speaking level is strictly capped at C1
      expect(evaluation.level).toBe('C1');
      expect(evaluation.level).not.toBe('C2');
      expect(evaluation.debugExplanation.promotionCapped).toBe(true);
      expect(evaluation.debugExplanation.promotionCapReason).toContain(
        'C2 Speaking requires interactive or standardized spoken evidence'
      );

      // Adding 1 interactive TOEIC Speaking assessment unlocks C2!
      const withStandardizedSpoken: CompetencyEvidence[] = [
        ...tenShadowingSessions,
        {
          id: 'toeic_speaking_1',
          skill: 'speaking',
          score: 100,
          source: 'toeic',
          cefrDifficulty: 'C2',
          createdAt: fixedNow,
          quality: 1.0,
        },
      ];

      const evalUnlocked = evaluateSkillCompetencyV2('speaking', withStandardizedSpoken, { now: fixedNow });
      expect(evalUnlocked.level).toBe('C2');
    });
  });

  // =========================================================================
  // 5. NON-REGRESSION OF EXTERNAL SUBSYSTEMS
  // =========================================================================
  describe('5. Non-Regression of External Subsystems', () => {
    it('AI Tutor reads competency without modifying store state (strictly read-only)', () => {
      useAppStore.getState().recordSkillEvidence({
        skill: 'listening',
        score: 85,
        source: 'toeic',
        cefrDifficulty: 'B2',
      });

      const currentStore = useAppStore.getState();
      const initialEvidenceCount = currentStore.fourSkillsEvidence?.listening?.length ?? 0;
      const initialScoreCount = currentStore.fourSkillsScores?.listening?.length ?? 0;

      const tutorContext = deriveTutorLearningContext({
        fourSkillsScores: currentStore.fourSkillsScores,
        fourSkillsEvidence: currentStore.fourSkillsEvidence,
      });

      expect(tutorContext.competency.listening.isAssessed).toBe(true);

      // Assert store was NOT mutated
      const afterStore = useAppStore.getState();
      expect(afterStore.fourSkillsEvidence?.listening?.length).toBe(initialEvidenceCount);
      expect(afterStore.fourSkillsScores?.listening?.length).toBe(initialScoreCount);
    });

    it('evaluateFourSkillsCompetencyV2 evaluates all 4 skills concurrently', () => {
      const store = useAppStore.getState();
      store.recordSkillEvidence({ skill: 'listening', score: 85, source: 'toeic' });
      store.recordSkillEvidence({ skill: 'reading', score: 80, source: 'four-skills', cefrDifficulty: 'B2' });
      store.recordSkillEvidence({ skill: 'speaking', score: 75, source: 'shadowing', quality: 0.65 });
      store.recordSkillEvidence({ skill: 'writing', score: 90, source: 'writing-ai', cefrDifficulty: 'C1' });

      const evaluation = evaluateFourSkillsCompetencyV2(store.srsProgressMap || {});

      expect(evaluation.listening.isAssessed).toBe(true);
      expect(evaluation.reading.isAssessed).toBe(true);
      expect(evaluation.speaking.isAssessed).toBe(true);
      expect(evaluation.writing.isAssessed).toBe(true);
      expect(typeof evaluation.accumulatedCoreWords).toBe('number');
    });
  });
});
