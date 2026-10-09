import { describe, expect, it } from 'vitest';
import {
  calculateFSRS,
  calculateInterval,
  calculateRetrievability,
  DEFAULT_FSRS_PARAMETERS,
  DEFAULT_FSRS_SETTINGS,
  FSRS_DECAY,
  FSRS_FACTOR,
  initDifficulty,
  initStability,
  nextDifficulty,
  nextForgetStability,
  nextRecallStability,
  nextState,
  previewNextIntervals,
  calculateInitialStability,
  calculateInitialDifficulty,
  scheduleFSRSItem,
} from '../fsrsAlgorithm';
import { FSRSMemoryState } from '../../types';

describe('FSRS-4.5 Core Mathematical Engine', () => {
  describe('Constants & Parameter Configuration', () => {
    it('has exactly 17 default parameters conforming to FSRS-4.5 specification', () => {
      expect(DEFAULT_FSRS_PARAMETERS).toHaveLength(17);
      expect(DEFAULT_FSRS_PARAMETERS[0]).toBeCloseTo(0.4872, 4); // S0(Again)
      expect(DEFAULT_FSRS_PARAMETERS[1]).toBeCloseTo(1.4003, 4); // S0(Hard)
      expect(DEFAULT_FSRS_PARAMETERS[2]).toBeCloseTo(3.7145, 4); // S0(Good)
      expect(DEFAULT_FSRS_PARAMETERS[3]).toBeCloseTo(13.8206, 4); // S0(Easy)
      expect(DEFAULT_FSRS_PARAMETERS[4]).toBeCloseTo(5.1618, 4); // D0 baseline
      expect(DEFAULT_FSRS_PARAMETERS[15]).toBeCloseTo(0.2272, 4); // Hard penalty
      expect(DEFAULT_FSRS_PARAMETERS[16]).toBeCloseTo(2.8755, 4); // Easy bonus
    });

    it('has correct power forgetting curve decay and factor', () => {
      expect(FSRS_DECAY).toBe(-0.5);
      expect(FSRS_FACTOR).toBeCloseTo(19 / 81, 6);
    });

    it('has sensible default settings', () => {
      expect(DEFAULT_FSRS_SETTINGS.desiredRetention).toBe(0.9);
      expect(DEFAULT_FSRS_SETTINGS.maximumInterval).toBe(36500);
      expect(DEFAULT_FSRS_SETTINGS.w).toEqual(DEFAULT_FSRS_PARAMETERS);
    });
  });

  describe('Retrievability Power Curve: calculateRetrievability', () => {
    it('returns R = 1.0 when elapsed time t = 0', () => {
      expect(calculateRetrievability(0, 10)).toBe(1.0);
      expect(calculateRetrievability(-1, 10)).toBe(1.0);
    });

    it('returns exactly R = 0.90 when elapsed time t equals Stability S', () => {
      const stability = 10;
      const r = calculateRetrievability(stability, stability);
      // Theoretical: (1 + 19/81)^(-0.5) = (100/81)^(-0.5) = 9/10 = 0.90
      expect(r).toBeCloseTo(0.9, 5);
    });

    it('decreases monotonically as elapsed days increase', () => {
      const stability = 7;
      const r1 = calculateRetrievability(1, stability);
      const r3 = calculateRetrievability(3, stability);
      const r7 = calculateRetrievability(7, stability);
      const r14 = calculateRetrievability(14, stability);

      expect(r1).toBeGreaterThan(r3);
      expect(r3).toBeGreaterThan(r7);
      expect(r7).toBeGreaterThan(r14);
      expect(r14).toBeGreaterThan(0);
    });

    it('handles edge case of zero or negative stability safely', () => {
      expect(calculateRetrievability(5, 0)).toBe(0.0);
      expect(calculateRetrievability(5, -2)).toBe(0.0);
    });

    it('is strictly bounded within [0.0, 1.0]', () => {
      expect(calculateRetrievability(1000, 1)).toBeGreaterThanOrEqual(0.0);
      expect(calculateRetrievability(1000, 1)).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Interval Calculation: calculateInterval', () => {
    it('computes Interval = Stability when desired retention is 0.90', () => {
      // When r = 0.90, I(0.90, S) = S
      expect(calculateInterval(0.9, 10)).toBe(10);
      expect(calculateInterval(0.9, 30)).toBe(30);
      expect(calculateInterval(0.9, 3.7145)).toBe(4); // Math.round(3.7145) = 4
    });

    it('scales interval up when desired retention is lower (e.g. 0.80)', () => {
      const s = 10;
      const interval90 = calculateInterval(0.9, s);
      const interval80 = calculateInterval(0.8, s);

      expect(interval80).toBeGreaterThan(interval90);
    });

    it('scales interval down when desired retention is higher (e.g. 0.95)', () => {
      const s = 10;
      const interval90 = calculateInterval(0.9, s);
      const interval95 = calculateInterval(0.95, s);

      expect(interval95).toBeLessThan(interval90);
    });

    it('caps interval to maximumInterval', () => {
      const maxInterval = 30;
      const interval = calculateInterval(0.9, 100, maxInterval);
      expect(interval).toBe(30);
    });

    it('ensures minimum interval is at least 1 day', () => {
      const interval = calculateInterval(0.9, 0.2);
      expect(interval).toBe(1);
    });
  });

  describe('Initial Item Setup: initStability & initDifficulty', () => {
    it('calculates initial stability monotonically increasing with rating', () => {
      const sAgain = initStability(1);
      const sHard = initStability(2);
      const sGood = initStability(3);
      const sEasy = initStability(4);

      expect(sAgain).toBeCloseTo(0.4872, 4);
      expect(sHard).toBeCloseTo(1.4003, 4);
      expect(sGood).toBeCloseTo(3.7145, 4);
      expect(sEasy).toBeCloseTo(13.8206, 4);

      expect(sAgain).toBeLessThan(sHard);
      expect(sHard).toBeLessThan(sGood);
      expect(sGood).toBeLessThan(sEasy);
    });

    it('calculates initial difficulty monotonically decreasing with rating', () => {
      const dAgain = initDifficulty(1);
      const dHard = initDifficulty(2);
      const dGood = initDifficulty(3);
      const dEasy = initDifficulty(4);

      // Rating 1: w4 + 2 * w5 = 5.1618 + 2.4596 = 7.6214
      expect(dAgain).toBeCloseTo(7.6214, 4);
      // Rating 2: w4 + w5 = 5.1618 + 1.2298 = 6.3916
      expect(dHard).toBeCloseTo(6.3916, 4);
      // Rating 3: w4 = 5.1618
      expect(dGood).toBeCloseTo(5.1618, 4);
      // Rating 4: w4 - w5 = 5.1618 - 1.2298 = 3.9320
      expect(dEasy).toBeCloseTo(3.932, 4);

      expect(dAgain).toBeGreaterThan(dHard);
      expect(dHard).toBeGreaterThan(dGood);
      expect(dGood).toBeGreaterThan(dEasy);

      // Verify specification aliases
      expect(calculateInitialStability(3)).toBe(initStability(3));
      expect(calculateInitialDifficulty(3)).toBe(initDifficulty(3));
    });

    it('clamps initial difficulty strictly within [1.0, 10.0]', () => {
      const extremeWeights = [...DEFAULT_FSRS_PARAMETERS];
      extremeWeights[4] = 12.0; // extreme baseline
      extremeWeights[5] = 5.0;
      expect(initDifficulty(1, extremeWeights)).toBe(10.0);
      expect(initDifficulty(4, extremeWeights)).toBeGreaterThanOrEqual(1.0);
    });
  });

  describe('Difficulty Updating: nextDifficulty', () => {
    it('increases difficulty for ratings Again (1) and Hard (2)', () => {
      const initialD = 5.0;
      const dAfterAgain = nextDifficulty(initialD, 1);
      const dAfterHard = nextDifficulty(initialD, 2);

      expect(dAfterAgain).toBeGreaterThan(initialD);
      expect(dAfterHard).toBeGreaterThan(initialD);
      expect(dAfterAgain).toBeGreaterThan(dAfterHard);
    });

    it('decreases difficulty for rating Easy (4)', () => {
      const initialD = 5.0;
      const dAfterEasy = nextDifficulty(initialD, 4);

      expect(dAfterEasy).toBeLessThan(initialD);
    });

    it('applies mean reversion towards w4 for repeated Good ratings', () => {
      let d = 9.0;
      for (let i = 0; i < 50; i++) {
        d = nextDifficulty(d, 3);
      }
      expect(d).toBeLessThan(9.0); // Has moved towards w4

      for (let i = 0; i < 150; i++) {
        d = nextDifficulty(d, 3);
      }
      expect(d).toBeCloseTo(DEFAULT_FSRS_PARAMETERS[4], 1);
    });

    it('clamps next difficulty strictly within [1.0, 10.0]', () => {
      let d = 10.0;
      for (let i = 0; i < 10; i++) {
        d = nextDifficulty(d, 1);
      }
      expect(d).toBeLessThanOrEqual(10.0);

      d = 1.0;
      for (let i = 0; i < 10; i++) {
        d = nextDifficulty(d, 4);
      }
      expect(d).toBeGreaterThanOrEqual(1.0);
    });
  });

  describe('Recall Stability: nextRecallStability', () => {
    it('increases stability upon successful recall (Good: 3)', () => {
      const currentS = 5.0;
      const d = 4.0;
      const r = 0.9;
      const nextS = nextRecallStability(d, currentS, r, 3);

      expect(nextS).toBeGreaterThan(currentS);
    });

    it('applies easy bonus multiplier for rating Easy (4)', () => {
      const currentS = 5.0;
      const d = 4.0;
      const r = 0.9;
      const sGood = nextRecallStability(d, currentS, r, 3);
      const sEasy = nextRecallStability(d, currentS, r, 4);

      expect(sEasy).toBeGreaterThan(sGood);
    });

    it('applies hard penalty multiplier for rating Hard (2)', () => {
      const currentS = 5.0;
      const d = 4.0;
      const r = 0.9;
      const sGood = nextRecallStability(d, currentS, r, 3);
      const sHard = nextRecallStability(d, currentS, r, 2);

      expect(sHard).toBeLessThan(sGood);
      expect(sHard).toBeGreaterThan(currentS); // Still increases or maintains stability
    });

    it('rewards harder recall (lower R) with higher stability increase (desirable difficulty)', () => {
      const currentS = 10.0;
      const d = 5.0;
      // Retrievability at prompt time: overdue (R=0.7) vs on-time (R=0.9)
      const sOverdueRecall = nextRecallStability(d, currentS, 0.7, 3);
      const sOnTimeRecall = nextRecallStability(d, currentS, 0.9, 3);

      expect(sOverdueRecall).toBeGreaterThan(sOnTimeRecall);
    });
  });

  describe('Forget / Lapse Stability: nextForgetStability', () => {
    it('reduces stability significantly upon lapse (Again: 1)', () => {
      const currentS = 20.0;
      const d = 5.0;
      const r = 0.5;
      const nextS = nextForgetStability(d, currentS, r);

      expect(nextS).toBeLessThan(currentS);
      expect(nextS).toBeGreaterThanOrEqual(0.1);
    });

    it('never exceeds current stability and stays above 0.1 floor', () => {
      const currentS = 0.5;
      const d = 2.0;
      const r = 0.9;
      const nextS = nextForgetStability(d, currentS, r);

      expect(nextS).toBeLessThanOrEqual(currentS);
      expect(nextS).toBeGreaterThanOrEqual(0.1);
    });
  });

  describe('State Machine: nextState', () => {
    it('transitions New (0) cards correctly', () => {
      expect(nextState(0, 1)).toBe(1); // Again -> Learning
      expect(nextState(0, 2)).toBe(1); // Hard -> Learning
      expect(nextState(0, 3)).toBe(2); // Good -> Review
      expect(nextState(0, 4)).toBe(2); // Easy -> Review
    });

    it('transitions Learning (1) cards correctly', () => {
      expect(nextState(1, 1)).toBe(1); // Again -> Learning
      expect(nextState(1, 2)).toBe(1); // Hard -> Learning
      expect(nextState(1, 3)).toBe(2); // Good -> Review
      expect(nextState(1, 4)).toBe(2); // Easy -> Review
    });

    it('transitions Review (2) cards into Relearning (3) on lapse', () => {
      expect(nextState(2, 1)).toBe(3); // Again -> Relearning
      expect(nextState(2, 2)).toBe(2); // Hard -> Review
      expect(nextState(2, 3)).toBe(2); // Good -> Review
      expect(nextState(2, 4)).toBe(2); // Easy -> Review
    });

    it('transitions Relearning (3) cards back to Review (2) upon graduation', () => {
      expect(nextState(3, 1)).toBe(3); // Again -> Relearning
      expect(nextState(3, 2)).toBe(3); // Hard -> Relearning
      expect(nextState(3, 3)).toBe(2); // Good -> Review
      expect(nextState(3, 4)).toBe(2); // Easy -> Review
    });
  });

  describe('End-to-End Engine: calculateFSRS & scheduleFSRSItem', () => {
    const baseDate = new Date('2026-10-04T07:00:00.000Z');

    it('initializes a brand new card (memory = null) with rating Good (3)', () => {
      const result = calculateFSRS(null, 3, baseDate);

      expect(result.memory.state).toBe(2); // Review state
      expect(result.memory.reps).toBe(1);
      expect(result.memory.lapses).toBe(0);
      expect(result.memory.stability).toBeCloseTo(3.7145, 2);
      expect(result.memory.difficulty).toBeCloseTo(5.1618, 2);
      expect(result.intervalDays).toBe(4); // Math.round(3.7145) = 4
      expect(result.retrievability).toBe(1.0);

      const expectedNext = new Date(baseDate);
      expectedNext.setDate(expectedNext.getDate() + 4);
      expect(result.nextReview).toBe(expectedNext.toISOString());
    });

    it('initializes a brand new card with rating Again (1)', () => {
      const result = scheduleFSRSItem(null, 1, baseDate);

      expect(result.memory.state).toBe(1); // Learning state
      expect(result.memory.reps).toBe(1);
      expect(result.memory.lapses).toBe(1);
      expect(result.memory.stability).toBeCloseTo(0.4872, 2);
      expect(result.intervalDays).toBe(1); // Clamped to 1 day minimum
    });

    it('schedules subsequent review after elapsed days with rating Good (3)', () => {
      const initialMemory: FSRSMemoryState = {
        stability: 4.0,
        difficulty: 5.0,
        state: 2,
        reps: 1,
        lapses: 0,
        lastReview: baseDate.toISOString(),
      };

      // Review exactly 4 days later (R ≈ 0.90)
      const reviewDate = new Date(baseDate);
      reviewDate.setDate(reviewDate.getDate() + 4);

      const result = calculateFSRS(initialMemory, 3, reviewDate);

      expect(result.memory.reps).toBe(2);
      expect(result.memory.lapses).toBe(0);
      expect(result.memory.state).toBe(2); // Stays in Review
      expect(result.memory.stability).toBeGreaterThan(4.0); // Stability expanded
      expect(result.intervalDays).toBeGreaterThan(4); // Interval expanded
      expect(result.retrievability).toBeCloseTo(0.9, 1);
    });

    it('handles review lapse: increments lapses, resets state to Relearning (3)', () => {
      const initialMemory: FSRSMemoryState = {
        stability: 15.0,
        difficulty: 4.5,
        state: 2,
        reps: 4,
        lapses: 0,
        lastReview: baseDate.toISOString(),
      };

      // Review 15 days later, forgot the card (Again: 1)
      const reviewDate = new Date(baseDate);
      reviewDate.setDate(reviewDate.getDate() + 15);

      const result = calculateFSRS(initialMemory, 1, reviewDate);

      expect(result.memory.reps).toBe(5);
      expect(result.memory.lapses).toBe(1);
      expect(result.memory.state).toBe(3); // Relearning
      expect(result.memory.stability).toBeLessThan(15.0); // Stability reduced
      expect(result.memory.difficulty).toBeGreaterThan(4.5); // Difficulty increased
      expect(result.intervalDays).toBeLessThanOrEqual(initialMemory.stability);
    });

    it('respects custom settings (retention & max interval)', () => {
      const result = calculateFSRS(null, 4, baseDate, {
        desiredRetention: 0.8,
        maximumInterval: 7,
      });

      // Easy S0 is 13.82 days, but maximumInterval caps it to 7
      expect(result.intervalDays).toBe(7);
    });

    it('previews next intervals correctly across all 4 ratings simultaneously', () => {
      const previews = previewNextIntervals(null, baseDate);

      expect(previews[1].intervalDays).toBe(1);
      expect(previews[2].intervalDays).toBe(1); // S0(Hard)=1.4d -> round(1.4)=1
      expect(previews[3].intervalDays).toBe(4); // S0(Good)=3.7d -> round(3.7)=4
      expect(previews[4].intervalDays).toBe(14); // S0(Easy)=13.8d -> round(13.8)=14

      expect(previews[1].memory.state).toBe(1);
      expect(previews[2].memory.state).toBe(1);
      expect(previews[3].memory.state).toBe(2);
      expect(previews[4].memory.state).toBe(2);
    });
  });
});

