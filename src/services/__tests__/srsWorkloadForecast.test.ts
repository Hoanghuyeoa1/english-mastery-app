// src/services/__tests__/srsWorkloadForecast.test.ts
import { describe, it, expect } from 'vitest';
import { 
  forecastSRSWorkload, 
  estimateRetentionWorkloadImpact, 
  simulateFSRSCandidateWorkload,
  extractCardDueReferences, 
  getCalendarDayDiff,
  calculateFSRSWorkloadFactor,
  CardDueReference 
} from '../srsWorkloadForecast';
import { calculateInterval } from '../fsrsAlgorithm';

describe('PHASE 4: SRS Workload Forecast & Mathematical FSRS Impact Simulator', () => {
  const ONE_DAY_MS = 86400000;
  // Fixed timestamp: 2026-10-04 at 12:00:00 UTC
  const fixedNow = new Date('2026-10-04T12:00:00.000Z').getTime();

  describe('1. forecastSRSWorkload - Empty Deck', () => {
    it('returns 0 for all days when deck is empty', () => {
      const forecast = forecastSRSWorkload([], 7, fixedNow);

      expect(forecast.today).toBe(0);
      expect(forecast.tomorrow).toBe(0);
      expect(forecast.next7Days).toBe(0);

      const keys = Object.keys(forecast.dailyCounts);
      expect(keys.length).toBe(7);
      for (const key of keys) {
        expect(forecast.dailyCounts[key]).toBe(0);
      }
    });
  });

  describe('2. Calendar-Day Bucketing & Late-Night Boundary Audit', () => {
    it('accurately buckets 23:50 vs 00:10 into tomorrow rather than today', () => {
      // Late night: Oct 4 at 23:50
      const lateNightNow = new Date('2026-10-04T23:50:00.000Z').getTime();
      // Due 20 minutes later: Oct 5 at 00:10 (tomorrow morning)
      const earlyMorningDue = new Date('2026-10-05T00:10:00.000Z').getTime();

      expect(getCalendarDayDiff(earlyMorningDue, lateNightNow)).toBe(1);

      const cards: CardDueReference[] = [
        { id: 'card_tmr', due: earlyMorningDue },
      ];

      const forecast = forecastSRSWorkload(cards, 7, lateNightNow);

      // Must be counted in tomorrow, NOT today
      expect(forecast.today).toBe(0);
      expect(forecast.tomorrow).toBe(1);
      expect(forecast.next7Days).toBe(1);
    });

    it('accurately handles overdue cards and 7-day boundary (+6 included, +7 excluded)', () => {
      const nowDate = new Date('2026-10-04T12:00:00.000Z');
      const startOfToday = Date.UTC(
        nowDate.getUTCFullYear(),
        nowDate.getUTCMonth(),
        nowDate.getUTCDate()
      );

      const cards: CardDueReference[] = [
        // 2 days overdue
        { id: 'card_overdue', due: startOfToday - 2 * ONE_DAY_MS },
        // Due today
        { id: 'card_today', due: startOfToday + 4 * 3600000 },
        // Due tomorrow
        { id: 'card_tmr', due: startOfToday + 1 * ONE_DAY_MS + 3600000 },
        // Due exactly on Day +6 (7th day of the 7-day window) -> MUST be included
        { id: 'card_day6', due: startOfToday + 6 * ONE_DAY_MS + 3600000 },
        // Due on Day +7 -> MUST be excluded
        { id: 'card_day7', due: startOfToday + 7 * ONE_DAY_MS + 3600000 },
      ];

      const forecast = forecastSRSWorkload(cards, 7, fixedNow);

      // Overdue (1) + Today (1) = 2
      expect(forecast.today).toBe(2);
      // Tomorrow = 1
      expect(forecast.tomorrow).toBe(1);

      // Overdue (1) + Today (1) + Tomorrow (1) + Day +6 (1) = 4 cards
      // Day +7 is strictly excluded!
      expect(forecast.next7Days).toBe(4);

      // Sum of daily counts equals 4
      const sumDaily = Object.values(forecast.dailyCounts).reduce((a, b) => a + b, 0);
      expect(sumDaily).toBe(4);
    });
  });

  describe('3. Mathematical FSRS Scaling Formula Audit (r^2 / (1 - r^2))', () => {
    it('matches exact FSRS interval scaling: 90% -> 95% gives +117% increase (not +111%)', () => {
      // Analytical formula:
      // W(0.90) = 0.9^2 / (1 - 0.9^2) = 0.81 / 0.19 ≈ 4.263158
      // W(0.95) = 0.95^2 / (1 - 0.95^2) = 0.9025 / 0.0975 ≈ 9.256410
      // Expected Ratio = 9.256410 / 4.263158 ≈ 2.171257
      // Expected % change = +117%
      const factor90 = calculateFSRSWorkloadFactor(0.90);
      const factor95 = calculateFSRSWorkloadFactor(0.95);
      const expectedRatio = factor95 / factor90;
      expect(expectedRatio).toBeCloseTo(2.171, 3);

      const impact = estimateRetentionWorkloadImpact(0.90, 0.95, 100);
      expect(impact.candidateEstimatedLoad).toBe(217);
      expect(impact.percentChange).toBe(117);
      expect(impact.impactLevel).toBe('high');
      expect(impact.isHighWorkloadWarning).toBe(true);
    });

    it('demonstrates consistency with actual FSRS calculateInterval outputs', () => {
      const stability = 10;
      // FSRS intervals for S=10:
      const interval90 = calculateInterval(0.90, stability);
      const interval95 = calculateInterval(0.95, stability);

      // Workload is inversely proportional to interval:
      const empiricalRatio = interval90 / interval95;
      const analyticalRatio = calculateFSRSWorkloadFactor(0.95) / calculateFSRSWorkloadFactor(0.90);

      // Both should be close to ~2.1 - 2.2
      expect(empiricalRatio).toBeGreaterThan(1.8);
      expect(empiricalRatio).toBeLessThan(2.5);
      expect(analyticalRatio).toBeCloseTo(2.171, 2);
    });
  });

  describe('4. 3-Tier Severity Classification', () => {
    it('categorizes impact levels accurately: low (<=15%), moderate (15-40%), high (>40%)', () => {
      // 90% -> 91%: ~ +14% -> low
      const impact91 = estimateRetentionWorkloadImpact(0.90, 0.91, 100);
      expect(impact91.impactLevel).toBe('low');
      expect(impact91.isHighWorkloadWarning).toBe(false);

      // 90% -> 92%: ~ +29% -> moderate
      const impact92 = estimateRetentionWorkloadImpact(0.90, 0.92, 100);
      expect(impact92.impactLevel).toBe('moderate');
      expect(impact92.isHighWorkloadWarning).toBe(false);

      // 90% -> 93%: ~ +48% -> high
      const impact93 = estimateRetentionWorkloadImpact(0.90, 0.93, 100);
      expect(impact93.impactLevel).toBe('high');
      expect(impact93.isHighWorkloadWarning).toBe(true);
    });

    it('safely handles non-positive or boundary inputs', () => {
      expect(estimateRetentionWorkloadImpact(0.90, 0.90, 50)).toEqual({
        candidateEstimatedLoad: 50,
        percentChange: 0,
        impactLevel: 'low',
        isHighWorkloadWarning: false,
      });

      expect(estimateRetentionWorkloadImpact(0, 0.90, 50).percentChange).toBe(0);
      expect(estimateRetentionWorkloadImpact(0.90, 1.0, 50).percentChange).toBe(0);
      expect(estimateRetentionWorkloadImpact(0.90, 0.95, 0).candidateEstimatedLoad).toBe(0);
    });
  });

  describe('5. Per-Card Simulation (simulateFSRSCandidateWorkload)', () => {
    it('simulates candidate due dates per card without mutating original card objects', () => {
      const now = new Date('2026-10-04T12:00:00.000Z').getTime();
      const lastReview = now - 5 * ONE_DAY_MS;

      const originalCards: CardDueReference[] = [
        {
          id: 'card_1',
          due: now + 3 * ONE_DAY_MS,
          stability: 8.0,
          lastReview,
        },
        {
          id: 'card_2',
          due: now + 6 * ONE_DAY_MS,
          stability: 15.0,
          lastReview,
        },
      ];

      const cloneBefore = JSON.parse(JSON.stringify(originalCards));

      // Simulate with strict 95% retention (compresses intervals)
      const simulatedForecast = simulateFSRSCandidateWorkload(originalCards, 0.95, 7, now);

      // Verify forecast structure returned
      expect(simulatedForecast).toBeDefined();
      expect(typeof simulatedForecast.next7Days).toBe('number');

      // Crucial assertion: original cards were not mutated
      expect(originalCards).toEqual(cloneBefore);
      expect(originalCards[0].due).toBe(cloneBefore[0].due);
    });
  });

  describe('6. extractCardDueReferences Helper', () => {
    it('captures stability and lastReview when available', () => {
      const mockProgressMap = {
        w1: {
          nextReviewDate: '2026-10-05T00:00:00.000Z',
          srsLevel: 2,
          fsrs: { stability: 4.5, lastReview: '2026-10-01T00:00:00.000Z' },
        },
        w2: {
          nextReviewDate: '2026-10-06T12:00:00.000Z',
          srsLevel: 1,
        },
      };

      const refs = extractCardDueReferences(mockProgressMap);
      expect(refs.length).toBe(2);
      expect(refs[0].id).toBe('w1');
      expect(refs[0].stability).toBe(4.5);
      expect(refs[0].lastReview).toBeDefined();
      expect(refs[1].id).toBe('w2');
      expect(refs[1].lastReview).toBeUndefined();
    });
  });
});
