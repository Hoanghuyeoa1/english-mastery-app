// src/services/streakReconciliationService.ts
/**
 * Historical Streak Reconciliation & Metrics Consistency Service (Phase 4)
 * 
 * Invariants:
 * 1. Evidence-Based Ground Truth: Reconciles streak ONLY from verified learning evidence
 *    (wordsReviewed > 0, newWordsLearned > 0, quizzesCompleted > 0, pronunciationsMastered > 0,
 *    or valid SRSReviewEvent records).
 * 2. Non-Qualifying Isolation: Days with only non-learning XP (Daily Chest, Quests, Achievements, manual imports)
 *    NEVER count towards streak.
 * 3. Idempotency: Multiple runs against the same state yield identical results (modified: false).
 * 4. Preservation of Longest Streak: Longest Streak is an all-time personal best; it NEVER decreases.
 * 5. Streak Hold Policy: Studying yesterday holds the streak until 23:59:59 GMT+7 today.
 * 6. Local-First & Zero Side-Effects: Pure calculation; does not fabricate XP, duplicate daily history,
 *    or fire reward events.
 */

import type { AppStoreState, DailyProgress, SRSReviewEvent, UserProfile } from '../types';
import { getVietnamDateString, getCalendarDayDiff } from '../utils/dateUtils';

export interface StreakReconciliationResult {
  modified: boolean;
  previousStreak: number;
  reconciledStreak: number;
  previousLongestStreak: number;
  reconciledLongestStreak: number;
  previousLastStudyDate: string | null;
  reconciledLastStudyDate: string | null;
  qualifyingDatesCount: number;
  reason: string;
}

export interface ReconcileStreakOptions {
  referenceDate?: Date | string | number;
}

/**
 * Checks whether a daily progress record contains real learning evidence.
 */
export function isQualifyingDailyProgress(progress?: DailyProgress | null): boolean {
  if (!progress) return false;
  return (
    (progress.wordsReviewed || 0) > 0 ||
    (progress.newWordsLearned || 0) > 0 ||
    (progress.quizzesCompleted || 0) > 0 ||
    (progress.pronunciationsMastered || 0) > 0
  );
}

/**
 * Audits and derives the canonical streak and longest streak from historical learning evidence.
 */
export function reconcileHistoricalStreak(
  state: {
    profile: UserProfile;
    dailyHistory?: Record<string, DailyProgress>;
    recentReviewEvents?: SRSReviewEvent[];
  },
  options?: ReconcileStreakOptions
): StreakReconciliationResult {
  const { profile, dailyHistory = {}, recentReviewEvents = [] } = state;
  const today = getVietnamDateString(options?.referenceDate);

  const prevStreak = profile.streak ?? 0;
  const prevLongest = profile.longestStreak ?? prevStreak;
  const prevLastStudy = profile.lastStudyDate ?? null;

  if (!today) {
    return {
      modified: false,
      previousStreak: prevStreak,
      reconciledStreak: prevStreak,
      previousLongestStreak: prevLongest,
      reconciledLongestStreak: prevLongest,
      previousLastStudyDate: prevLastStudy,
      reconciledLastStudyDate: prevLastStudy,
      qualifyingDatesCount: 0,
      reason: 'Invalid reference date',
    };
  }

  // 1. Collect all distinct qualifying learning calendar dates (Asia/Ho_Chi_Minh)
  const qualifyingDateSet = new Set<string>();

  // Check Daily History
  for (const [dateStr, progress] of Object.entries(dailyHistory)) {
    if (!dateStr || typeof dateStr !== 'string') continue;
    const vnDate = getVietnamDateString(dateStr);
    if (!vnDate || vnDate !== dateStr) continue;

    if (isQualifyingDailyProgress(progress)) {
      qualifyingDateSet.add(vnDate);
    }
  }

  // Check Recent Review Events
  for (const event of recentReviewEvents) {
    if (event && event.timestamp) {
      const vnDate = getVietnamDateString(event.timestamp);
      if (vnDate) {
        qualifyingDateSet.add(vnDate);
      }
    }
  }

  const sortedDates = Array.from(qualifyingDateSet).sort();

  // 2. Case: Zero qualifying learning evidence in history
  if (sortedDates.length === 0) {
    let targetStreak = prevStreak;
    let targetLongest = Math.max(prevLongest, prevStreak);
    let targetLastStudy = prevLastStudy;

    // If profile had a recorded study date in the past, verify if it was missed
    if (prevLastStudy) {
      const diff = getCalendarDayDiff(today, prevLastStudy);
      if (diff !== null && diff > 1) {
        targetStreak = 0;
      }
    }

    const modified = (
      targetStreak !== prevStreak ||
      targetLongest !== prevLongest ||
      targetLastStudy !== prevLastStudy
    );

    return {
      modified,
      previousStreak: prevStreak,
      reconciledStreak: targetStreak,
      previousLongestStreak: prevLongest,
      reconciledLongestStreak: targetLongest,
      previousLastStudyDate: prevLastStudy,
      reconciledLastStudyDate: targetLastStudy,
      qualifyingDatesCount: 0,
      reason: modified ? 'Missed historical streak reset' : 'No qualifying activity found; state unchanged',
    };
  }

  // 3. Compute continuous streak chains across sorted qualifying dates
  let runningStreak = 1;
  let maxHistoricalStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const diff = getCalendarDayDiff(sortedDates[i], sortedDates[i - 1]);
    if (diff === 1) {
      runningStreak += 1;
      maxHistoricalStreak = Math.max(maxHistoricalStreak, runningStreak);
    } else if (diff !== null && diff > 1) {
      runningStreak = 1;
    }
  }

  const lastQualifyingDate = sortedDates[sortedDates.length - 1];
  const diffFromToday = getCalendarDayDiff(today, lastQualifyingDate);

  let derivedCurrentStreak = 0;
  let derivedLastStudyDate: string | null = lastQualifyingDate;

  if (diffFromToday === 0 || diffFromToday === 1) {
    // Studied today (0) or yesterday (1, Streak Hold Policy)
    derivedCurrentStreak = runningStreak;
  } else {
    // Missed 1 or more days (diff >= 2)
    derivedCurrentStreak = 0;
  }

  // Longest streak never degrades
  const targetLongestStreak = Math.max(prevLongest, prevStreak, maxHistoricalStreak);

  let targetCurrentStreak = prevStreak;
  let targetLastStudyDate = prevLastStudy;

  // Reconciliation Decision Matrix:
  if (prevStreak === 0 && derivedCurrentStreak > 0) {
    // BUG HEALING: User had legitimate learning evidence but streak was stuck at 0
    targetCurrentStreak = derivedCurrentStreak;
    targetLastStudyDate = derivedLastStudyDate;
  } else if (prevStreak > 0) {
    if (diffFromToday !== null && diffFromToday > 1) {
      // Both evidence and profile dates indicate missed study days
      const profileDiff = getCalendarDayDiff(today, prevLastStudy);
      if (profileDiff === null || profileDiff > 1) {
        targetCurrentStreak = 0;
      }
    } else if (derivedCurrentStreak > prevStreak) {
      // Historical evidence proves higher consecutive streak
      targetCurrentStreak = derivedCurrentStreak;
      targetLastStudyDate = derivedLastStudyDate;
    } else {
      // Existing streak is already consistent or higher (accumulated from older history)
      targetCurrentStreak = prevStreak;
      targetLastStudyDate = prevLastStudy || derivedLastStudyDate;
    }
  } else {
    targetCurrentStreak = 0;
    targetLastStudyDate = prevLastStudy || derivedLastStudyDate;
  }

  const modified = (
    targetCurrentStreak !== prevStreak ||
    targetLongestStreak !== prevLongest ||
    (targetLastStudyDate !== prevLastStudy && targetLastStudyDate !== null)
  );

  return {
    modified,
    previousStreak: prevStreak,
    reconciledStreak: targetCurrentStreak,
    previousLongestStreak: prevLongest,
    reconciledLongestStreak: targetLongestStreak,
    previousLastStudyDate: prevLastStudy,
    reconciledLastStudyDate: targetLastStudyDate,
    qualifyingDatesCount: sortedDates.length,
    reason: modified
      ? (prevStreak === 0 && targetCurrentStreak > 0
          ? 'Restored valid streak from learning evidence'
          : 'Reconciled streak continuity and longest streak')
      : 'State is already consistent with learning evidence',
  };
}
