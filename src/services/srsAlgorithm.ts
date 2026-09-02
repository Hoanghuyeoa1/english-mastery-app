import { SRSGrade, VocabWord } from '../types';

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

/**
 * NGUỒN DỮ LIỆU DUY NHẤT (Single Source of Truth) cho từ cần ôn hôm nay.
 * Điều kiện:
 * 1. Từ đã từng được học ít nhất 1 lần (srsLevel > 0 HOẶC có firstLearnedAt HOẶC có lastReviewedDate).
 * 2. Thời điểm nextReviewDate <= thời điểm hiện tại.
 */
export function getDueReviewWords(vocabularyList: VocabWord[]): VocabWord[] {
  return (vocabularyList || []).filter((w) => {
    const hasBeenStudied = (w.srsLevel && w.srsLevel > 0) || !!w.firstLearnedAt || !!w.lastReviewedDate;
    return hasBeenStudied && isDueForReview(w.nextReviewDate);
  });
}

/**
 * NGUỒN DỮ LIỆU DUY NHẤT cho Chế độ "Từ mới học hôm nay".
 * Điều kiện:
 * 1. Học lần đầu hôm nay (firstLearnedAt.startsWith(today)).
 * 2. Chưa hoàn thành lượt ôn củng cố hôm nay (!todayNewReviewedAt || !todayNewReviewedAt.startsWith(today)).
 * -> Khi bấm Tốt / Dễ, từ đó được ghi nhận và LẬP TỨC TRỪ KHỎI mục này!
 */
export function getTodayLearnedWords(vocabularyList: VocabWord[], targetDateStr?: string): VocabWord[] {
  const today = targetDateStr || new Date().toISOString().split('T')[0];
  return (vocabularyList || []).filter((w) => {
    const isNewToday = !!w.firstLearnedAt && w.firstLearnedAt.startsWith(today);
    const hasCompletedReviewToday = !!w.todayNewReviewedAt && w.todayNewReviewedAt.startsWith(today);
    return isNewToday && !hasCompletedReviewToday;
  });
}

/**
 * NGUỒN DỮ LIỆU DUY NHẤT cho Chế độ "Toàn bộ kho từ".
 * Điều kiện:
 * 1. Đã từng học trong kho (srsLevel > 0 || firstLearnedAt || lastReviewedDate).
 * 2. Chưa hoàn thành lượt luyện tập kho hôm nay (!todayPoolReviewedAt || !todayPoolReviewedAt.startsWith(today)).
 * -> Khi bấm Tốt / Dễ trong kho, từ đó được ghi nhận và LẬP TỨC TRỪ KHỎI mục này!
 */
export function getAllLearnedWords(vocabularyList: VocabWord[], targetDateStr?: string): VocabWord[] {
  const today = targetDateStr || new Date().toISOString().split('T')[0];
  return (vocabularyList || []).filter((w) => {
    const hasBeenStudied = (w.srsLevel && w.srsLevel > 0) || !!w.firstLearnedAt || !!w.lastReviewedDate;
    const hasPracticedToday = !!w.todayPoolReviewedAt && w.todayPoolReviewedAt.startsWith(today);
    return hasBeenStudied && !hasPracticedToday;
  });
}

export type SRSMasteryStatus = 'learning' | 'reviewing' | 'mastered';

export interface SRSMasteryInfo {
  status: SRSMasteryStatus;
  label: string;
  badgeColor: string;
  emoji: string;
  desc: string;
}

/**
 * Phân loại trạng thái ghi nhớ SRS (Mastery Status):
 * - "Đang học" (Learning): repetitions < 2 HOẶC interval < 3 ngày (từ mới nạp hoặc vừa bị bấm Quên).
 * - "Nhớ tạm thời" (Reviewing): repetitions từ 2 đến 4, HOẶC interval từ 3 đến dưới 21 ngày.
 * - "Đã khắc sâu" (Mastered): repetitions >= 5 HOẶC interval >= 21 ngày (đã ôn đúng liên tiếp nhiều chu kỳ).
 */
export function getSRSMasteryStatus(wordOrProgress: {
  repetitions?: number;
  srsLevel?: number;
  interval?: number;
}): SRSMasteryStatus {
  const reps = wordOrProgress.repetitions ?? wordOrProgress.srsLevel ?? 0;
  const interval = wordOrProgress.interval ?? 0;

  if (reps >= 5 || interval >= 21) {
    return 'mastered';
  }

  if ((reps >= 2 && reps <= 4) || (interval >= 3 && interval < 21)) {
    return 'reviewing';
  }

  return 'learning';
}

/**
 * Lấy thông tin hiển thị UI (nhãn, màu badge, emoji, mô tả) của trạng thái SRS
 */
export function getSRSMasteryInfo(status: SRSMasteryStatus): SRSMasteryInfo {
  switch (status) {
    case 'mastered':
      return {
        status: 'mastered',
        label: 'Đã khắc sâu',
        badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        emoji: '🟢',
        desc: 'Trí nhớ dài hạn vững chắc (≥ 5 chu kỳ ôn hoặc interval ≥ 21 ngày)',
      };
    case 'reviewing':
      return {
        status: 'reviewing',
        label: 'Nhớ tạm thời',
        badgeColor: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
        emoji: '🔵',
        desc: 'Đang củng cố trí nhớ (2 - 4 chu kỳ hoặc interval 3 - 20 ngày)',
      };
    case 'learning':
    default:
      return {
        status: 'learning',
        label: 'Đang học',
        badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        emoji: '🟡',
        desc: 'Từ mới bắt đầu nạp hoặc vừa cần ôn củng cố lại',
      };
  }
}

