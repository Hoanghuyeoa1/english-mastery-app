// src/services/srsAnalytics.ts
// Pure analytics calculation service for Observed/Actual Retention and SRS Telemetry.
// Zero external dependencies. Enforces single source of truth and prevents double-counting.

import { SRSReviewEvent, HistoricalRatingAggregates, DailyProgress } from '../types';

export interface RetentionWindowMetrics {
  windowDays: number | 'all';
  totalReviews: number;
  actualRetention: number | null; // (hard + good + easy) / total, null when totalReviews === 0
  desiredRetention: number;
  retentionGap: number | null;    // actualRetention - desiredRetention, null when totalReviews === 0
  hasSufficientData: boolean;     // true if totalReviews > 0
  ratingDistribution: {
    again: number;
    hard: number;
    good: number;
    easy: number;
  };
  ratingPercentages: {
    again: number;
    hard: number;
    good: number;
    easy: number;
  };
  recordedDays?: number;
  analyticsStartedAt?: string;
}

export interface RetentionDataPoint {
  date: string;
  actual: number | null; // null if reviewCount === 0 on that date
  target: number;        // 0.0 to 1.0
  reviewCount: number;   // Sample size on that specific date
}

/**
 * Computes observed retention rate, retention gap, and rating distribution for a specified time window.
 * When totalReviews is 0, actualRetention and retentionGap are strictly null (not 0%) to prevent false negatives.
 *
 * @param history Recent SRS review events (detailed telemetry)
 * @param desiredRetention Target retention rate (configured in FSRS settings, e.g. 0.90)
 * @param windowDays Analysis window: 7 days, 30 days, or 'all'
 * @param now Current timestamp in ms (defaults to Date.now())
 * @param aggregates Optional historical aggregates for all-time stats (used as replacement, NEVER added to history)
 */
export function computeRetentionMetrics(
  history: SRSReviewEvent[],
  desiredRetention: number,
  windowDays: 7 | 30 | 'all' = 7,
  now = Date.now(),
  aggregates?: HistoricalRatingAggregates
): RetentionWindowMetrics {
  let relevantEvents = history;
  if (windowDays !== 'all') {
    const cutoff = now - windowDays * 24 * 60 * 60 * 1000;
    relevantEvents = history.filter((e) => {
      const time = Date.parse(e.timestamp);
      return !Number.isNaN(time) && time >= cutoff;
    });
  }

  const counts = { again: 0, hard: 0, good: 0, easy: 0 };

  // ARCHITECTURAL GUARD: When aggregates are supplied for 'all' and exceed ring buffer,
  // we replace the counts with aggregates directly. We NEVER add aggregates + history (prevent double-counting).
  if (windowDays === 'all' && aggregates && aggregates.totalReviews >= history.length) {
    counts.again = aggregates.again;
    counts.hard = aggregates.hard;
    counts.good = aggregates.good;
    counts.easy = aggregates.easy;
  } else {
    for (const ev of relevantEvents) {
      if (counts[ev.rating] !== undefined) {
        counts[ev.rating]++;
      }
    }
  }

  const totalReviews = counts.again + counts.hard + counts.good + counts.easy;
  const successfulReviews = counts.hard + counts.good + counts.easy;
  const hasSufficientData = totalReviews > 0;

  // Semantic correctness: When 0 reviews, retention is null (unknown), NOT 0%
  const actualRetention = hasSufficientData
    ? Math.round((successfulReviews / totalReviews) * 100) / 100
    : null;

  const retentionGap = hasSufficientData && actualRetention !== null
    ? Math.round((actualRetention - desiredRetention) * 100) / 100
    : null;

  const pct = (val: number) => (totalReviews > 0 ? Math.round((val / totalReviews) * 100) : 0);

  return {
    windowDays,
    totalReviews,
    actualRetention,
    desiredRetention,
    retentionGap,
    hasSufficientData,
    ratingDistribution: counts,
    ratingPercentages: {
      again: pct(counts.again),
      hard: pct(counts.hard),
      good: pct(counts.good),
      easy: pct(counts.easy),
    },
  };
}

/**
 * Computes metrics directly from dailyHistory, serving as the unbounded aggregate source of truth.
 * Legacy days without rating counters do not distort the denominator.
 */
export function computeRetentionMetricsFromDailyHistory(
  dailyHistory: Record<string, DailyProgress>,
  desiredRetention: number,
  windowDays: 7 | 30 | 'all' = 7,
  now = Date.now()
): RetentionWindowMetrics {
  const counts = { again: 0, hard: 0, good: 0, easy: 0 };
  let recordedDays = 0;
  let analyticsStartedAt: string | undefined = undefined;

  const nowDateOnly = new Date(now).setHours(0, 0, 0, 0);

  for (const item of Object.values(dailyHistory)) {
    if (!item.date) continue;

    if (windowDays !== 'all') {
      const parts = item.date.split('-').map(Number);
      if (parts.length === 3) {
        const itemDateOnly = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
        const diffDays = Math.round((nowDateOnly - itemDateOnly) / (1000 * 60 * 60 * 24));
        if (diffDays < 0 || diffDays >= windowDays) {
          continue;
        }
      }
    }

    const hasAnyRatingData =
      item.againCount !== undefined ||
      item.hardCount !== undefined ||
      item.goodCount !== undefined ||
      item.easyCount !== undefined;

    if (hasAnyRatingData) {
      recordedDays++;
      if (!analyticsStartedAt || item.date < analyticsStartedAt) {
        analyticsStartedAt = item.date;
      }
      counts.again += item.againCount || 0;
      counts.hard += item.hardCount || 0;
      counts.good += item.goodCount || 0;
      counts.easy += item.easyCount || 0;
    }
  }

  const totalReviews = counts.again + counts.hard + counts.good + counts.easy;
  const successfulReviews = counts.hard + counts.good + counts.easy;
  const hasSufficientData = totalReviews > 0;

  const actualRetention = hasSufficientData
    ? Math.round((successfulReviews / totalReviews) * 100) / 100
    : null;

  const retentionGap = hasSufficientData && actualRetention !== null
    ? Math.round((actualRetention - desiredRetention) * 100) / 100
    : null;

  const pct = (val: number) => (totalReviews > 0 ? Math.round((val / totalReviews) * 100) : 0);

  return {
    windowDays,
    totalReviews,
    actualRetention,
    desiredRetention,
    retentionGap,
    hasSufficientData,
    ratingDistribution: counts,
    ratingPercentages: {
      again: pct(counts.again),
      hard: pct(counts.hard),
      good: pct(counts.good),
      easy: pct(counts.easy),
    },
    recordedDays,
    analyticsStartedAt,
  };
}

/**
 * Computes daily retention trend points over the specified window (e.g., 7 or 30 days).
 * Each point includes reviewCount for sample-size transparency.
 * If no reviews exist across the period, returns an empty array to trigger clean empty-state UI.
 */
export function computeDailyRetentionTrend(
  history: SRSReviewEvent[],
  desiredRetention: number,
  windowDays: 7 | 30 = 7,
  now = Date.now(),
  dailyHistory?: Record<string, DailyProgress>
): RetentionDataPoint[] {
  const points: RetentionDataPoint[] = [];
  const oneDayMs = 24 * 60 * 60 * 1000;
  let hasAnyReviews = false;

  for (let i = windowDays - 1; i >= 0; i--) {
    const dayTimestamp = now - i * oneDayMs;
    const dateObj = new Date(dayTimestamp);
    const dateIso = dateObj.toISOString().split('T')[0];
    const displayDate = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;

    let again = 0;
    let hard = 0;
    let good = 0;
    let easy = 0;

    if (dailyHistory && dailyHistory[dateIso]) {
      const day = dailyHistory[dateIso];
      again = day.againCount || 0;
      hard = day.hardCount || 0;
      good = day.goodCount || 0;
      easy = day.easyCount || 0;
    } else {
      const dayStart = new Date(dateIso + 'T00:00:00.000Z').getTime();
      const dayEnd = dayStart + oneDayMs;

      const dayEvents = history.filter((e) => {
        const time = Date.parse(e.timestamp);
        return !Number.isNaN(time) && time >= dayStart && time < dayEnd;
      });

      for (const e of dayEvents) {
        if (e.rating === 'again') again++;
        else if (e.rating === 'hard') hard++;
        else if (e.rating === 'good') good++;
        else if (e.rating === 'easy') easy++;
      }
    }

    const total = again + hard + good + easy;
    if (total > 0) {
      hasAnyReviews = true;
      const actual = Math.round(((hard + good + easy) / total) * 100) / 100;
      points.push({
        date: displayDate,
        actual,
        target: desiredRetention,
        reviewCount: total,
      });
    } else {
      points.push({
        date: displayDate,
        actual: null,
        target: desiredRetention,
        reviewCount: 0,
      });
    }
  }

  return hasAnyReviews ? points : [];
}

/**
 * Extracts lifetime aggregates from dailyHistory.
 */
export function extractHistoricalRatingAggregates(
  dailyHistory: Record<string, DailyProgress>
): HistoricalRatingAggregates {
  const result: HistoricalRatingAggregates = {
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
    totalReviews: 0,
  };

  for (const day of Object.values(dailyHistory)) {
    const again = day.againCount || 0;
    const hard = day.hardCount || 0;
    const good = day.goodCount || 0;
    const easy = day.easyCount || 0;

    result.again += again;
    result.hard += hard;
    result.good += good;
    result.easy += easy;
    result.totalReviews += again + hard + good + easy;
  }

  return result;
}
