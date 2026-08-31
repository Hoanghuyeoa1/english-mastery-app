import { SRSGrade } from '../types';

export interface SM2Result {
  interval: number;
  srsLevel: number;
  easeFactor: number;
  nextReviewDate: string;
}

/**
 * SuperMemo 2 (SM-2) algorithm adapted for 4-grade flashcard review
 * Grade 0: Again (Quên) -> Reset to 0 repetitions, interval 1 day
 * Grade 1: Hard (Khó) -> Slight increase, lower ease factor
 * Grade 2: Good (Tốt) -> Standard progression
 * Grade 3: Easy (Dễ) -> Bonus multiplier, higher ease factor
 */
export function calculateSM2(
  grade: SRSGrade,
  currentInterval: number,
  currentRepetition: number,
  currentEF: number
): SM2Result {
  let interval: number;
  let srsLevel: number;
  let easeFactor: number;

  // 1. Calculate new Ease Factor: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  // Map our grade (0..3) to standard SM-2 q (2..5)
  const q = grade + 2;
  easeFactor = currentEF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  // 2. Determine repetition count & interval (days)
  if (grade === 0) {
    // Again: reset
    srsLevel = 0;
    interval = 1;
  } else {
    if (currentRepetition === 0) {
      interval = 1;
    } else if (currentRepetition === 1) {
      interval = grade === 1 ? 3 : 6;
    } else {
      const modifier = grade === 1 ? 1.2 : grade === 3 ? 1.4 : 1.0;
      interval = Math.max(1, Math.round(currentInterval * easeFactor * modifier));
    }
    srsLevel = currentRepetition + 1;
  }

  // 3. Compute ISO Date for next review
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);

  return {
    interval,
    srsLevel,
    easeFactor: Number(easeFactor.toFixed(2)),
    nextReviewDate: nextDate.toISOString(),
  };
}

export function isDueForReview(nextReviewDate: string): boolean {
  if (!nextReviewDate) return true;
  const reviewTime = new Date(nextReviewDate).getTime();
  const now = new Date().getTime();
  return reviewTime <= now;
}

export function formatIntervalPreview(grade: SRSGrade, currentInterval: number, currentRep: number, ef: number): string {
  const result = calculateSM2(grade, currentInterval, currentRep, ef);
  if (result.interval === 1) return '1 ngày';
  if (result.interval < 30) return `${result.interval} ngày`;
  const months = Math.round(result.interval / 30);
  return `${months} tháng`;
}
