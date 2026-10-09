// src/services/__tests__/retentionRecommendation.test.ts
import { describe, it, expect } from 'vitest';
import { 
  generateRetentionRecommendation, 
  getRetentionRecommendationFromMetrics,
  RETENTION_RECOMMENDATION_RULES 
} from '../retentionRecommendation';

describe('PHASE 5: Retention Recommendation Engine Audit', () => {
  describe('1. Algorithm Semantics Guard (FSRS Only vs SM-2)', () => {
    it('returns isApplicable: false and preserves currentRetention when algorithm is SM-2', () => {
      const result = generateRetentionRecommendation(
        0.70, // actual
        0.90, // current
        100,  // totalReviews
        0.30, // againRate
        40,   // overdueCount
        'sm2' // algorithm
      );

      expect(result.isApplicable).toBe(false);
      expect(result.algorithm).toBe('sm2');
      expect(result.recommendedRetention).toBe(0.90);
      expect(result.confidence).toBe('low');
      expect(result.reasons[0]).toContain('Thuật toán SM-2');
      expect(result.estimatedWorkloadChangePercent).toBe(0);
    });

    it('guard applies through getRetentionRecommendationFromMetrics helper for SM-2', () => {
      const metrics = {
        totalReviews: 120,
        actualRetention: 0.95,
        ratingDistribution: { again: 5, hard: 10, good: 70, easy: 35 },
      };

      const result = getRetentionRecommendationFromMetrics(metrics, 0.90, 5, 'sm2');

      expect(result.isApplicable).toBe(false);
      expect(result.algorithm).toBe('sm2');
      expect(result.recommendedRetention).toBe(0.90);
    });

    it('processes recommendation normally when algorithm is FSRS', () => {
      const result = generateRetentionRecommendation(0.70, 0.90, 100, 0.30, 40, 'fsrs');
      expect(result.isApplicable).toBe(true);
      expect(result.algorithm).toBe('fsrs');
      expect(result.recommendedRetention).toBe(0.87);
    });
  });

  describe('2. Insufficient Data Guard (< 20 reviews)', () => {
    it('returns confidence: "low" and preserves currentRetention when totalReviews < 20', () => {
      const result = generateRetentionRecommendation(0.80, 0.90, 15, 0.20, 5, 'fsrs');

      expect(result.recommendedRetention).toBe(0.90);
      expect(result.currentRetention).toBe(0.90);
      expect(result.confidence).toBe('low');
      expect(result.reasons[0]).toContain(`cần tối thiểu ${RETENTION_RECOMMENDATION_RULES.minReviews} lượt review`);
      expect(result.estimatedWorkloadChangePercent).toBe(0);
      expect(result.isApplicable).toBe(true);
    });

    it('handles 0 reviews gracefully without throwing runtime errors', () => {
      const result = generateRetentionRecommendation(0, 0.90, 0, 0, 0, 'fsrs');

      expect(result.recommendedRetention).toBe(0.90);
      expect(result.confidence).toBe('low');
    });
  });

  describe('3. Confidence Scaling (Medium vs High)', () => {
    it('assigns confidence: "medium" when 20 <= totalReviews <= 80', () => {
      const result = generateRetentionRecommendation(0.90, 0.90, 50, 0.10, 5, 'fsrs');
      expect(result.confidence).toBe('medium');
    });

    it('assigns confidence: "high" when totalReviews > 80', () => {
      const result = generateRetentionRecommendation(0.90, 0.90, 120, 0.10, 5, 'fsrs');
      expect(result.confidence).toBe('high');
    });
  });

  describe('4. Overload Scenario (againRate > 25% or overdueCount > 30)', () => {
    it('recommends lowering target retention safely by 0.03 when currentRetention > 0.85', () => {
      const result = generateRetentionRecommendation(0.72, 0.90, 100, 0.28, 10, 'fsrs');

      // 0.90 - 0.03 = 0.87
      expect(result.recommendedRetention).toBe(0.87);
      expect(result.confidence).toBe('high');
      expect(result.reasons.some((r) => r.includes('Tỷ lệ nhấn "Again" cao'))).toBe(true);
      expect(result.estimatedWorkloadChangePercent).toBeLessThan(0);
      expect(result.estimatedWorkloadChangePercent).toBe(-27);
    });

    it('triggers overload recommendation when overdueCount > 30 even with moderate againRate', () => {
      const result = generateRetentionRecommendation(0.86, 0.90, 100, 0.14, 35, 'fsrs');

      expect(result.recommendedRetention).toBe(0.87);
      expect(result.reasons[0]).toContain('số thẻ tồn đọng lớn');
    });

    it('strictly clamps lowering at min 0.82 to prevent sub-optimal retention degradation', () => {
      const result = generateRetentionRecommendation(0.70, 0.86, 100, 0.30, 40, 'fsrs');

      expect(result.recommendedRetention).toBe(0.83);
      expect(result.recommendedRetention).toBeGreaterThanOrEqual(RETENTION_RECOMMENDATION_RULES.minRecommendedRetention);
      expect(result.recommendedRetention).toBeLessThanOrEqual(RETENTION_RECOMMENDATION_RULES.maxRecommendedRetention);
    });

    it('advises keeping current retention when user is already at conservative retention (<= 0.85)', () => {
      const result = generateRetentionRecommendation(0.75, 0.82, 100, 0.30, 40, 'fsrs');

      expect(result.recommendedRetention).toBe(0.82);
      expect(result.reasons[0]).toContain('duy trì retention vừa phải');
      expect(result.estimatedWorkloadChangePercent).toBe(0);
    });
  });

  describe('5. Superior Memory Retention Scenario (actual >= target + 5% & againRate < 10%)', () => {
    it('recommends increasing target retention by 0.02 when currentRetention < 0.93', () => {
      const result = generateRetentionRecommendation(0.95, 0.88, 100, 0.05, 2, 'fsrs');

      // 0.88 + 0.02 = 0.90
      expect(result.recommendedRetention).toBe(0.90);
      expect(result.reasons[0]).toContain('nâng nhẹ mục tiêu để duy trì độ nhớ sâu hơn');
      expect(result.estimatedWorkloadChangePercent).toBeGreaterThan(0);
    });

    it('recommends maintaining ideal retention when user is already at >= 0.93', () => {
      const result = generateRetentionRecommendation(0.99, 0.94, 100, 0.02, 0, 'fsrs');

      expect(result.recommendedRetention).toBe(0.94);
      expect(result.reasons[0]).toContain('mức lý tưởng (>=93%)');
    });

    it('clamps upward recommendation to maximum 0.95', () => {
      const result = generateRetentionRecommendation(0.99, 0.94, 100, 0.02, 0, 'fsrs');
      expect(result.recommendedRetention).toBeLessThanOrEqual(RETENTION_RECOMMENDATION_RULES.maxRecommendedRetention);
    });
  });

  describe('6. Balanced Scenario', () => {
    it('recommends maintaining current retention when performance is well balanced', () => {
      const result = generateRetentionRecommendation(0.90, 0.90, 60, 0.10, 5, 'fsrs');

      expect(result.recommendedRetention).toBe(0.90);
      expect(result.reasons[0]).toContain('cân bằng tốt');
      expect(result.estimatedWorkloadChangePercent).toBe(0);
    });
  });

  describe('7. Robust Input Sanitization & Bounds Invariants', () => {
    it('sanitizes non-finite or extreme retention inputs cleanly', () => {
      const resultNaN = generateRetentionRecommendation(NaN, NaN, 100, NaN, NaN, 'fsrs');
      expect(resultNaN.currentRetention).toBe(0.90);
      expect(resultNaN.recommendedRetention).toBeGreaterThanOrEqual(RETENTION_RECOMMENDATION_RULES.minRecommendedRetention);

      const resultNegative = generateRetentionRecommendation(-0.5, 0.5, -10, -0.2, -5, 'fsrs');
      expect(resultNegative.currentRetention).toBe(0.70);
      expect(resultNegative.confidence).toBe('low');
    });

    it('recommendation function never mutates its parameters', () => {
      const current = 0.90;
      const actual = 0.70;
      const reviews = 100;
      const againRate = 0.30;
      const overdue = 50;

      const result = generateRetentionRecommendation(actual, current, reviews, againRate, overdue, 'fsrs');

      expect(current).toBe(0.90);
      expect(actual).toBe(0.70);
      expect(reviews).toBe(100);
      expect(againRate).toBe(0.30);
      expect(overdue).toBe(50);
      expect(result.recommendedRetention).toBe(0.87);
    });
  });
});
