// src/services/retentionRecommendation.ts
// Pure service for optimal target retention recommendation.
// Balances learning workload against long-term memory retrievability.
// Transparent, explainable, and strictly non-invasive (never auto-overwrites user settings).
// Designed specifically for FSRS (Free Spaced Repetition Scheduler); guarded against SM-2.

import { SRSAlgorithmType } from '../types';

export const RETENTION_RECOMMENDATION_RULES = {
  minReviews: 20,
  highConfidenceReviews: 80,

  overloadAgainRate: 0.25,
  overloadOverdueCards: 30,

  decreaseStep: 0.03,
  increaseStep: 0.02,

  minRecommendedRetention: 0.82,
  maxRecommendedRetention: 0.95,

  superiorRetentionMargin: 0.05,
  lowAgainRate: 0.10,
} as const;

export interface RetentionRecommendation {
  recommendedRetention: number;
  currentRetention: number;
  confidence: 'low' | 'medium' | 'high';
  reasons: string[];
  estimatedWorkloadChangePercent?: number;
  isApplicable: boolean;
  algorithm?: SRSAlgorithmType;
}

/**
 * Generates an optimal target retention recommendation based on learning telemetry.
 *
 * Rules:
 * 1. Algorithm compatibility: FSRS only. If algorithm is SM-2, returns isApplicable: false.
 * 2. Data sufficiency: If totalReviewsInWindow < 20, returns confidence: 'low' and keeps currentRetention.
 * 3. Overload detection: If againRate > 0.25 (25%) or overdueCount > 30:
 *    - If currentRetention > 0.85: recommends lowering by 0.03 (clamped at min 0.82) to reduce review debt.
 *    - Otherwise: advises maintaining current conservative retention.
 * 4. Superior retention: If actualRetention >= currentRetention + 0.05 and againRate < 0.10:
 *    - If currentRetention < 0.93: recommends raising by 0.02 (clamped at max 0.95) for deeper retention.
 *    - Otherwise: advises maintaining ideal high retention.
 * 5. Balanced: Otherwise recommends keeping current target.
 *
 * @param actualRetention Actual observed retention rate in window [0.0, 1.0]
 * @param currentRetention User's currently configured target retention [0.70, 0.98]
 * @param totalReviewsInWindow Total number of reviews evaluated in window
 * @param againRate Fraction of reviews graded 'again' (lapse rate) [0.0, 1.0]
 * @param overdueCount Current count of overdue/backlogged review cards
 * @param algorithm SRS Algorithm currently active ('fsrs' | 'sm2')
 */
export function generateRetentionRecommendation(
  actualRetention: number,
  currentRetention: number,
  totalReviewsInWindow: number,
  againRate: number,
  overdueCount: number,
  algorithm: SRSAlgorithmType = 'fsrs'
): RetentionRecommendation {
  // Input sanitization against invalid / corrupted values
  const safeCurrent = Number.isFinite(currentRetention)
    ? Math.min(0.98, Math.max(0.70, currentRetention))
    : 0.90;
  const safeActual = Number.isFinite(actualRetention)
    ? Math.min(1.0, Math.max(0.0, actualRetention))
    : 0.0;
  const safeReviews = Number.isFinite(totalReviewsInWindow)
    ? Math.max(0, Math.floor(totalReviewsInWindow))
    : 0;
  const safeAgainRate = Number.isFinite(againRate)
    ? Math.min(1.0, Math.max(0.0, againRate))
    : 0.0;
  const safeOverdue = Number.isFinite(overdueCount)
    ? Math.max(0, Math.floor(overdueCount))
    : 0;

  // 1. Guard against SM-2: Target retention is only a scheduling parameter in FSRS
  if (algorithm !== 'fsrs') {
    return {
      recommendedRetention: safeCurrent,
      currentRetention: safeCurrent,
      confidence: 'low',
      reasons: [
        'Thuật toán SM-2 sử dụng hệ số nhân dễ (Ease Factor) cố định và không dùng tham số Desired Retention để tính toán khoảng cách ôn tập. Vui lòng chuyển sang FSRS để nhận đề xuất tối ưu.',
      ],
      estimatedWorkloadChangePercent: 0,
      isApplicable: false,
      algorithm: 'sm2',
    };
  }

  const reasons: string[] = [];

  // 2. Data sufficiency check
  if (safeReviews < RETENTION_RECOMMENDATION_RULES.minReviews) {
    return {
      recommendedRetention: safeCurrent,
      currentRetention: safeCurrent,
      confidence: 'low',
      reasons: [
        `Chưa đủ lịch sử ôn tập (cần tối thiểu ${RETENTION_RECOMMENDATION_RULES.minReviews} lượt review) để đưa ra đề xuất chính xác.`,
      ],
      estimatedWorkloadChangePercent: 0,
      isApplicable: true,
      algorithm: 'fsrs',
    };
  }

  let recommended = safeCurrent;
  const confidence: 'low' | 'medium' | 'high' =
    safeReviews > RETENTION_RECOMMENDATION_RULES.highConfidenceReviews ? 'high' : 'medium';

  // 3. Overload detection: High Again rate (>25%) or heavy overdue backlog (>30 cards)
  if (
    safeAgainRate > RETENTION_RECOMMENDATION_RULES.overloadAgainRate ||
    safeOverdue > RETENTION_RECOMMENDATION_RULES.overloadOverdueCards
  ) {
    if (safeCurrent > 0.85) {
      recommended = Math.max(
        RETENTION_RECOMMENDATION_RULES.minRecommendedRetention,
        safeCurrent - RETENTION_RECOMMENDATION_RULES.decreaseStep
      );
      reasons.push(
        'Tỷ lệ nhấn "Again" cao hoặc số thẻ tồn đọng lớn. Giảm nhẹ mục tiêu giúp giảm tải và lấy lại nhịp học.'
      );
    } else {
      reasons.push(
        'Khối lượng học hiện tại khá nặng, nên duy trì retention vừa phải để tránh áp lực nản chí.'
      );
    }
  }
  // 4. Superior memory retention: actual >= target + 5% and low again rate (<10%)
  else if (
    safeActual >= safeCurrent + RETENTION_RECOMMENDATION_RULES.superiorRetentionMargin &&
    safeAgainRate < RETENTION_RECOMMENDATION_RULES.lowAgainRate
  ) {
    if (safeCurrent < 0.93) {
      recommended = Math.min(
        RETENTION_RECOMMENDATION_RULES.maxRecommendedRetention,
        safeCurrent + RETENTION_RECOMMENDATION_RULES.increaseStep
      );
      reasons.push(
        'Khả năng ghi nhớ thực tế rất tốt với tỷ lệ quên thấp. Bạn có thể nâng nhẹ mục tiêu để duy trì độ nhớ sâu hơn.'
      );
    } else {
      reasons.push('Bạn đang duy trì mục tiêu retention ở mức lý tưởng (>=93%).');
    }
  } else {
    reasons.push('Mục tiêu hiện tại cân bằng tốt giữa thời gian ôn tập và khả năng ghi nhớ.');
  }

  recommended = Math.round(recommended * 100) / 100;

  // Calculate estimated workload impact using FSRS mathematical scaling: W(r) ~ r^2 / (1 - r^2)
  let estimatedWorkloadChangePercent: number | undefined = 0;
  if (
    recommended !== safeCurrent &&
    safeCurrent > 0 &&
    safeCurrent < 1 &&
    recommended > 0 &&
    recommended < 1
  ) {
    const rCurr2 = safeCurrent * safeCurrent;
    const rRec2 = recommended * recommended;
    const wCurr = rCurr2 / (1.0 - rCurr2);
    const wRec = rRec2 / (1.0 - rRec2);
    if (wCurr > 0) {
      estimatedWorkloadChangePercent = Math.round(((wRec / wCurr) - 1.0) * 100);
    }
  }

  return {
    recommendedRetention: recommended,
    currentRetention: safeCurrent,
    confidence,
    reasons,
    estimatedWorkloadChangePercent,
    isApplicable: true,
    algorithm: 'fsrs',
  };
}

/**
 * Helper to generate retention recommendation directly from aggregate window metrics.
 * Safely guards algorithm compatibility when passed currentAlgorithm.
 */
export function getRetentionRecommendationFromMetrics(
  metrics: {
    totalReviews: number;
    actualRetention: number | null;
    ratingDistribution: { again: number; hard: number; good: number; easy: number };
  },
  currentRetention: number,
  overdueCount: number = 0,
  algorithm: SRSAlgorithmType = 'fsrs'
): RetentionRecommendation {
  const safeActual = metrics.actualRetention ?? 0;
  const againRate =
    metrics.totalReviews > 0 ? metrics.ratingDistribution.again / metrics.totalReviews : 0;

  return generateRetentionRecommendation(
    safeActual,
    currentRetention,
    metrics.totalReviews,
    againRate,
    overdueCount,
    algorithm
  );
}
