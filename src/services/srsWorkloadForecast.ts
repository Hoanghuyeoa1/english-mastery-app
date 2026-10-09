// src/services/srsWorkloadForecast.ts
// Pure service for SRS workload forecasting and mathematical candidate retention impact simulation.
// Built with strict calendar-day bucketing, mathematically accurate FSRS interval scaling,
// and non-mutating per-card simulation logic. Zero external dependencies.

import { SRSCardState } from '../types';
import { calculateInterval } from './fsrsAlgorithm';

export interface CardDueReference {
  id: string;
  due: number; // Unix timestamp in ms
  state?: SRSCardState;
  stability?: number;
  lastReview?: number; // Unix timestamp in ms of last review (if available)
}

export interface WorkloadForecastResult {
  today: number;
  tomorrow: number;
  next7Days: number;
  dailyCounts: { [dateStr: string]: number };
}

export type WorkloadImpactLevel = 'low' | 'moderate' | 'high';

export interface RetentionWorkloadImpact {
  candidateEstimatedLoad: number;
  percentChange: number;
  impactLevel: WorkloadImpactLevel;
  isHighWorkloadWarning: boolean; // true when percentChange > 40% (high impact)
}

/**
 * Calculates calendar day difference between two timestamps (target - base).
 * Uses local calendar date boundaries (year, month, day) to prevent time-of-day edge cases
 * (e.g., late-night 23:50 vs next morning 00:10).
 */
export function getCalendarDayDiff(targetMs: number, baseMs: number): number {
  const targetDate = new Date(targetMs);
  const baseDate = new Date(baseMs);

  const targetDayStart = Date.UTC(
    targetDate.getUTCFullYear(),
    targetDate.getUTCMonth(),
    targetDate.getUTCDate()
  );

  const baseDayStart = Date.UTC(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth(),
    baseDate.getUTCDate()
  );

  return Math.round((targetDayStart - baseDayStart) / 86400000);
}

/**
 * Forecasts review workload across the upcoming time horizon (today, tomorrow, next 7 days).
 * Employs calendar-day bucketing so cards due tomorrow morning are never grouped into today.
 * Overdue cards (calendar diff <= 0) are grouped cleanly into "today" and the 7-day total.
 *
 * @param cards Array of card due references
 * @param days Horizon in calendar days (default: 7)
 * @param now Current timestamp in ms (defaults to Date.now())
 */
export function forecastSRSWorkload(
  cards: CardDueReference[],
  days: number = 7,
  now: number = Date.now()
): WorkloadForecastResult {
  const msInDay = 86400000;
  const nowDate = new Date(now);
  const startOfToday = Date.UTC(
    nowDate.getUTCFullYear(),
    nowDate.getUTCMonth(),
    nowDate.getUTCDate()
  );

  let todayCount = 0;
  let tomorrowCount = 0;
  let next7DaysCount = 0;
  const dailyCounts: { [dateStr: string]: number } = {};

  // Pre-populate daily counts for each calendar day in the window
  for (let i = 0; i < days; i++) {
    const d = new Date(startOfToday + i * msInDay).toISOString().split('T')[0];
    dailyCounts[d] = 0;
  }

  const todayKey = new Date(startOfToday).toISOString().split('T')[0];

  for (const card of cards) {
    if (!card.due || Number.isNaN(card.due)) continue;

    // Use calendar-day difference
    const diffDays = getCalendarDayDiff(card.due, now);

    if (diffDays <= 0) {
      // Overdue (diffDays < 0) or due today (diffDays === 0)
      todayCount++;
      next7DaysCount++;
      if (dailyCounts[todayKey] !== undefined) {
        dailyCounts[todayKey]++;
      }
    } else if (diffDays < days) {
      if (diffDays === 1) {
        tomorrowCount++;
      }
      next7DaysCount++;
      const targetKey = new Date(startOfToday + diffDays * msInDay).toISOString().split('T')[0];
      if (dailyCounts[targetKey] !== undefined) {
        dailyCounts[targetKey]++;
      }
    }
  }

  return {
    today: todayCount,
    tomorrow: tomorrowCount,
    next7Days: next7DaysCount,
    dailyCounts,
  };
}

/**
 * Mathematically exact FSRS review frequency / workload scaling factor:
 * For FSRS interval I(r, S) = (S / (19/81)) * (r^(-2) - 1) = (S / c) * ((1 - r^2) / r^2).
 * Since review frequency Workload ~ 1 / Interval, we have:
 * Workload(r) proportional to r^2 / (1 - r^2).
 */
export function calculateFSRSWorkloadFactor(retention: number): number {
  if (retention <= 0 || retention >= 1) return 0;
  const r2 = retention * retention;
  return r2 / (1.0 - r2);
}

/**
 * Simulates workload impact using the exact FSRS interval scaling formula:
 * Ratio = (r_candidate^2 / (1 - r_candidate^2)) / (r_current^2 / (1 - r_current^2)).
 *
 * Provides a 3-tier severity classification:
 * - <= 15%: 'low' (Ảnh hưởng nhỏ)
 * - 15% - 40%: 'moderate' (Tải ôn tăng đáng kể)
 * - > 40%: 'high' (Cảnh báo tải cao)
 *
 * @param currentRetention Currently configured desired retention (e.g., 0.90)
 * @param candidateRetention Candidate retention to simulate (e.g., 0.95)
 * @param current7DayLoad Current estimated 7-day scheduled cards
 */
export function estimateRetentionWorkloadImpact(
  currentRetention: number,
  candidateRetention: number,
  current7DayLoad: number
): RetentionWorkloadImpact {
  if (
    currentRetention <= 0 ||
    currentRetention >= 1 ||
    candidateRetention <= 0 ||
    candidateRetention >= 1 ||
    current7DayLoad <= 0
  ) {
    return {
      candidateEstimatedLoad: Math.max(0, current7DayLoad),
      percentChange: 0,
      impactLevel: 'low',
      isHighWorkloadWarning: false,
    };
  }

  const currentFactor = calculateFSRSWorkloadFactor(currentRetention);
  const candidateFactor = calculateFSRSWorkloadFactor(candidateRetention);

  if (currentFactor <= 0) {
    return {
      candidateEstimatedLoad: current7DayLoad,
      percentChange: 0,
      impactLevel: 'low',
      isHighWorkloadWarning: false,
    };
  }

  const ratio = candidateFactor / currentFactor;
  const candidateEstimatedLoad = Math.round(current7DayLoad * ratio);
  const percentChange = Math.round((ratio - 1) * 100);

  const impactLevel: WorkloadImpactLevel =
    percentChange > 40 ? 'high' : percentChange > 15 ? 'moderate' : 'low';

  return {
    candidateEstimatedLoad,
    percentChange,
    impactLevel,
    isHighWorkloadWarning: percentChange > 40,
  };
}

/**
 * Simulates future candidate workload on a per-card basis using each card's actual FSRS stability.
 * Completely non-mutating: does not alter card objects or store state.
 *
 * @param cards Array of card due references
 * @param candidateRetention Candidate retention rate to simulate
 * @param days Horizon in days (default: 7)
 * @param now Current timestamp in ms (defaults to Date.now())
 */
export function simulateFSRSCandidateWorkload(
  cards: CardDueReference[],
  candidateRetention: number,
  days: number = 7,
  now: number = Date.now()
): WorkloadForecastResult {
  const simulatedCards: CardDueReference[] = cards.map((card) => {
    // If card has FSRS stability and lastReview timestamp, calculate exact candidate due date
    if (card.stability && card.stability > 0 && card.lastReview) {
      const candidateInterval = calculateInterval(candidateRetention, card.stability);
      const simulatedDue = card.lastReview + candidateInterval * 86400000;
      return {
        ...card,
        due: simulatedDue,
      };
    }
    return card;
  });

  return forecastSRSWorkload(simulatedCards, days, now);
}

/**
 * Extracts CardDueReference array from srsProgressMap without modifying store state.
 * Captures stability and lastReview when available for high-fidelity per-card simulation.
 */
export function extractCardDueReferences(
  srsProgressMap: Record<string, {
    nextReviewDate?: string;
    srsLevel?: number;
    fsrs?: { stability?: number; lastReview?: string };
  }>
): CardDueReference[] {
  const refs: CardDueReference[] = [];
  for (const [id, progress] of Object.entries(srsProgressMap)) {
    if (progress?.nextReviewDate) {
      const due = Date.parse(progress.nextReviewDate);
      if (!Number.isNaN(due)) {
        const lastReview = progress.fsrs?.lastReview
          ? Date.parse(progress.fsrs.lastReview)
          : undefined;

        refs.push({
          id,
          due,
          stability: progress.fsrs?.stability,
          lastReview: !Number.isNaN(lastReview) ? lastReview : undefined,
        });
      }
    }
  }
  return refs;
}
