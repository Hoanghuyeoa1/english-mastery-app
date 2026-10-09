// src/services/__tests__/srsAnalytics.test.ts
import { describe, it, expect } from 'vitest';
import { 
  computeRetentionMetrics, 
  computeRetentionMetricsFromDailyHistory,
  computeDailyRetentionTrend, 
  extractHistoricalRatingAggregates 
} from '../srsAnalytics';
import { SRSReviewEvent, DailyProgress } from '../../types';

describe('PHASE 3: SRS Analytics Engine & Metric Calculations (Semantic Invariants Audit)', () => {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const fixedNow = new Date('2026-10-04T12:00:00.000Z').getTime();

  const createMockEvent = (
    id: string,
    rating: 'again' | 'hard' | 'good' | 'easy',
    daysAgo: number
  ): SRSReviewEvent => {
    const eventTime = fixedNow - daysAgo * ONE_DAY_MS;
    return {
      id: `rev_${id}`,
      cardId: `card_${id}`,
      rating,
      grade: rating === 'again' ? 0 : rating === 'hard' ? 1 : rating === 'good' ? 2 : 3,
      algorithm: 'fsrs',
      timestamp: new Date(eventTime).toISOString(), // Single source of truth (ISO string)
      stateBefore: 'review',
      stateAfter: rating === 'again' ? 'relearning' : 'review',
      interval: 5,
    };
  };

  describe('1. Semantic Correctness on Empty History', () => {
    it('returns null for actualRetention and retentionGap when totalReviews === 0 (not 0% or -90%)', () => {
      const metrics = computeRetentionMetrics([], 0.90, 7, fixedNow);

      expect(metrics.totalReviews).toBe(0);
      expect(metrics.hasSufficientData).toBe(false);
      expect(metrics.actualRetention).toBeNull();
      expect(metrics.retentionGap).toBeNull();
      expect(metrics.desiredRetention).toBe(0.90);
      expect(metrics.ratingDistribution).toEqual({
        again: 0,
        hard: 0,
        good: 0,
        easy: 0,
      });
      expect(metrics.ratingPercentages).toEqual({
        again: 0,
        hard: 0,
        good: 0,
        easy: 0,
      });
    });

    it('returns null retention when dailyHistory has zero recorded reviews', () => {
      const metrics = computeRetentionMetricsFromDailyHistory({}, 0.90, 7, fixedNow);

      expect(metrics.totalReviews).toBe(0);
      expect(metrics.hasSufficientData).toBe(false);
      expect(metrics.actualRetention).toBeNull();
      expect(metrics.retentionGap).toBeNull();
    });
  });

  describe('2. Single Source of Truth for Timestamp', () => {
    it('relies solely on ISO timestamp without requiring duplicate epoch fields', () => {
      const isoTime = new Date(fixedNow - 2 * ONE_DAY_MS).toISOString();
      const event: SRSReviewEvent = {
        id: 'rev_clean',
        cardId: 'c1',
        rating: 'good',
        grade: 2,
        algorithm: 'fsrs',
        timestamp: isoTime,
        stateBefore: 'learning',
        stateAfter: 'review',
        interval: 3,
      };

      const metrics = computeRetentionMetrics([event], 0.90, 7, fixedNow);
      expect(metrics.totalReviews).toBe(1);
      expect(metrics.hasSufficientData).toBe(true);
      expect(metrics.actualRetention).toBe(1.0);
      expect(metrics.ratingDistribution.good).toBe(1);
    });
  });

  describe('3. Double-Counting Invariant: Aggregates vs. Ring Buffer Events', () => {
    it('ensures dailyHistory + recentReviewEvents never double-counts overlapping reviews (100 daily + 20 recent -> 100, NOT 120)', () => {
      // dailyHistory has 100 lifetime reviews
      const mockDailyHistory: Record<string, DailyProgress> = {
        '2026-10-01': {
          date: '2026-10-01',
          wordsReviewed: 50,
          newWordsLearned: 0,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
          xpGained: 250,
          againCount: 5,
          hardCount: 10,
          goodCount: 30,
          easyCount: 5, // 50 reviews
        },
        '2026-10-04': {
          date: '2026-10-04',
          wordsReviewed: 50,
          newWordsLearned: 0,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
          xpGained: 250,
          againCount: 5,
          hardCount: 10,
          goodCount: 30,
          easyCount: 5, // 50 reviews
        },
      };

      // Ring buffer holds 20 of the latest events (which occurred on 2026-10-04 and are already in dailyHistory)
      const ringBufferEvents: SRSReviewEvent[] = Array.from({ length: 20 }, (_, i) =>
        createMockEvent(`recent_${i}`, 'good', 0)
      );

      const aggregates = extractHistoricalRatingAggregates(mockDailyHistory);
      expect(aggregates.totalReviews).toBe(100);

      // When computeRetentionMetrics is called with aggregates, it uses aggregates directly
      const metricsAll = computeRetentionMetrics(
        ringBufferEvents,
        0.90,
        'all',
        fixedNow,
        aggregates
      );

      // Crucial assertion: Total reviews is 100, NEVER 120 (no double count)
      expect(metricsAll.totalReviews).toBe(100);
      expect(metricsAll.ratingDistribution.good).toBe(60); // 30 + 30

      // When computed via computeRetentionMetricsFromDailyHistory
      const metricsDaily = computeRetentionMetricsFromDailyHistory(
        mockDailyHistory,
        0.90,
        'all',
        fixedNow
      );
      expect(metricsDaily.totalReviews).toBe(100);
    });
  });

  describe('4. Window Filtering (7d, 30d, Recorded History)', () => {
    it('filters events strictly based on 7-day, 30-day, and all-time timestamp cutoffs', () => {
      const history: SRSReviewEvent[] = [
        createMockEvent('1', 'good', 1),
        createMockEvent('2', 'easy', 3),
        createMockEvent('3', 'again', 6),
        createMockEvent('4', 'hard', 15),
        createMockEvent('5', 'good', 25),
        createMockEvent('6', 'easy', 45),
      ];

      // 7-day window
      const metrics7d = computeRetentionMetrics(history, 0.90, 7, fixedNow);
      expect(metrics7d.totalReviews).toBe(3);
      expect(metrics7d.actualRetention).toBe(0.67);
      expect(metrics7d.retentionGap).toBe(-0.23);

      // 30-day window
      const metrics30d = computeRetentionMetrics(history, 0.90, 30, fixedNow);
      expect(metrics30d.totalReviews).toBe(5);
      expect(metrics30d.actualRetention).toBe(0.80);
      expect(metrics30d.retentionGap).toBe(-0.10);

      // All-time window
      const metricsAll = computeRetentionMetrics(history, 0.90, 'all', fixedNow);
      expect(metricsAll.totalReviews).toBe(6);
      expect(metricsAll.actualRetention).toBe(0.83);
    });
  });

  describe('5. Rating Percentages Distribution', () => {
    it('ensures rating percentages sum up to approximately 100%', () => {
      const history: SRSReviewEvent[] = [
        createMockEvent('1', 'again', 1),
        createMockEvent('2', 'hard', 1),
        createMockEvent('3', 'hard', 1),
        createMockEvent('4', 'good', 1),
        createMockEvent('5', 'good', 1),
        createMockEvent('6', 'good', 1),
        createMockEvent('7', 'good', 1),
        createMockEvent('8', 'easy', 1),
        createMockEvent('9', 'easy', 1),
        createMockEvent('10', 'easy', 1),
      ];

      const metrics = computeRetentionMetrics(history, 0.90, 7, fixedNow);
      expect(metrics.totalReviews).toBe(10);
      expect(metrics.ratingPercentages.again).toBe(10);
      expect(metrics.ratingPercentages.hard).toBe(20);
      expect(metrics.ratingPercentages.good).toBe(40);
      expect(metrics.ratingPercentages.easy).toBe(30);

      const sum =
        metrics.ratingPercentages.again +
        metrics.ratingPercentages.hard +
        metrics.ratingPercentages.good +
        metrics.ratingPercentages.easy;
      expect(sum).toBe(100);
    });
  });

  describe('6. Sample Size in Trend Points (RetentionDataPoint.reviewCount)', () => {
    it('includes reviewCount in every data point and returns null actual on empty days', () => {
      const history: SRSReviewEvent[] = [
        createMockEvent('1', 'good', 0), // Today: 1 review
        createMockEvent('2', 'again', 1), // Yesterday: 2 reviews
        createMockEvent('3', 'good', 1),
      ];

      const trend = computeDailyRetentionTrend(history, 0.90, 7, fixedNow);
      expect(trend.length).toBe(7);

      // 2 days ago: 0 reviews -> actual is null, reviewCount is 0
      const twoDaysAgo = trend[4];
      expect(twoDaysAgo.actual).toBeNull();
      expect(twoDaysAgo.reviewCount).toBe(0);
      expect(twoDaysAgo.target).toBe(0.90);

      // Yesterday: 2 reviews, 1 good + 1 again -> 50%
      const yesterday = trend[5];
      expect(yesterday.actual).toBe(0.50);
      expect(yesterday.reviewCount).toBe(2);

      // Today: 1 review, 1 good -> 100%
      const today = trend[6];
      expect(today.actual).toBe(1.0);
      expect(today.reviewCount).toBe(1);
    });
  });
});
