import { useMemo } from 'react';
import type {
  LeaderboardMetric,
  LocalMetricEligibilityStatus,
  LocalLeaderboardMetricPreview,
  LocalLeaderboardPreviewMap,
  AppStoreState,
} from '../types';
import {
  deriveLeaderboardLearningMetrics,
  type DeriveLeaderboardMetricsOptions,
} from './leaderboardLearningMetrics';
import { useAppStore } from '../store/useAppStore';
import { getAuthoritativeServerNow } from './leaderboardService';

export interface DeriveLeaderboardPreviewOptions extends DeriveLeaderboardMetricsOptions {
  refDate?: Date;
}

/**
 * Pure Adapter: Chuyển hóa số liệu học tập cục bộ thành bản xem trước (Local Preview)
 * cho toàn bộ 7 hạng mục trên Leaderboard mà không tạo thứ hạng online và không biến
 * điểm local thành online cloud rank.
 *
 * BẤT BIẾN THIẾT KẾ:
 * 1. Read-only: Tuyệt đối không mutate store, không sync lên Cloud, không award XP.
 * 2. Reuse Canonical Derivation: Tái sử dụng 100% engine deriveLeaderboardLearningMetrics.
 * 3. Bounded Performance: Không scan toàn bộ từ điển 10,000+ từ; chỉ xử lý srsProgressMap và logs hiện hữu.
 * 4. Semantic Distinction: Phân biệt tuyệt đối giữa 0 điểm vs Chưa đủ điều kiện (not_eligible) vs Chưa đủ dữ liệu mẫu (insufficient_evidence).
 */
export function deriveCurrentUserLeaderboardPreview(
  state?: Partial<AppStoreState> | null,
  options?: DeriveLeaderboardPreviewOptions
): LocalLeaderboardPreviewMap {
  const refDate = options?.refDate || getAuthoritativeServerNow();

  // 1. Lấy dữ liệu thuần từ domain state truyền vào hoặc fallback từ store hiện tại
  const effectiveState = state || (typeof window !== 'undefined' ? useAppStore.getState() : ({} as any));
  const streak = typeof effectiveState?.profile?.streak === 'number' ? effectiveState.profile.streak : 0;

  // 2. Tái sử dụng engine tính toán chất lượng học tập 6 hạng mục
  const metrics = deriveLeaderboardLearningMetrics(effectiveState, {
    refDate,
    pronunciationAttempts: options?.pronunciationAttempts,
    toeicSessions: options?.toeicSessions,
    activeSessions: options?.activeSessions,
  });

  // 3. Chuẩn hóa bản xem trước cho từng hạng mục

  // 3.1. Top XP Tuần (weekly_xp): Canonical Weekly XP (KHÔNG dùng lifetime XP)
  const weeklyXp = Math.max(0, metrics.weeklyXp || 0);
  const weeklyXpPreview: LocalLeaderboardMetricPreview = {
    category: 'weekly_xp',
    value: weeklyXp,
    displayValue: `${weeklyXp.toLocaleString()} XP`,
    secondaryScore: streak,
    secondaryDisplay: streak > 0 ? `${streak} ngày streak` : null,
    status: 'eligible',
    isEligible: true,
    hasLocalActivity: weeklyXp > 0,
  };

  // 3.2. Từ Vựng Bền Vững (vocab_mastered): Canonical Vocabulary Mastery
  const vocabMastered = Math.max(0, metrics.vocabMastered || 0);
  const vocabTransitions = metrics.evidence?.vocab_transitions || 0;
  const vocabPreview: LocalLeaderboardMetricPreview = {
    category: 'vocab_mastered',
    value: vocabMastered,
    displayValue: `${vocabMastered.toLocaleString()} từ`,
    secondaryScore: vocabTransitions,
    secondaryDisplay: vocabTransitions > 0 ? `${vocabTransitions} từ chuyển giao` : null,
    status: 'eligible',
    isEligible: true,
    hasLocalActivity: vocabMastered > 0,
  };

  // 3.3. Độ Bền Bỉ Ôn Tập (review_consistency): Normalized Ratio
  const isConsistencyEligible = Boolean(metrics.eligibility?.consistency && metrics.reviewConsistency !== null);
  const consistencyDays = typeof metrics.evidence?.consistency_days === 'number' ? metrics.evidence.consistency_days : 0;
  const consistencyPreview: LocalLeaderboardMetricPreview = {
    category: 'review_consistency',
    value: isConsistencyEligible ? metrics.reviewConsistency : null,
    displayValue: isConsistencyEligible ? `${metrics.reviewConsistency!.toFixed(1)}%` : 'Chưa đủ dữ liệu',
    secondaryScore: consistencyDays,
    secondaryDisplay: consistencyDays > 0 ? `${consistencyDays} ngày ôn` : null,
    status: isConsistencyEligible ? 'eligible' : 'insufficient_evidence',
    isEligible: isConsistencyEligible,
    ineligibleHint: isConsistencyEligible
      ? undefined
      : 'Cần có ít nhất 1 ngày có lịch ôn tập đến hạn trong tuần để tính độ bền bỉ.',
    hasLocalActivity: consistencyDays > 0,
  };

  // 3.4. Thời Gian Học Tập (active_minutes): Anti-Idle Tracked Time
  const activeMinutes = Math.max(0, metrics.activeMinutes || 0);
  const activeSessions = typeof metrics.evidence?.active_sessions === 'number' ? metrics.evidence.active_sessions : 0;
  const isMinutesEligible = activeMinutes >= 15;
  const minutesPreview: LocalLeaderboardMetricPreview = {
    category: 'active_minutes',
    value: activeMinutes,
    displayValue: `${activeMinutes.toLocaleString()} phút`,
    secondaryScore: activeSessions,
    secondaryDisplay: activeSessions > 0 ? `${activeSessions} phiên học` : null,
    status: isMinutesEligible ? 'eligible' : activeMinutes > 0 ? 'not_eligible' : 'insufficient_evidence',
    isEligible: isMinutesEligible,
    ineligibleHint: isMinutesEligible
      ? undefined
      : 'Cần tích lũy tối thiểu 15 phút học thực tế trong tuần để được xếp hạng.',
    hasLocalActivity: activeMinutes > 0 || activeSessions > 0,
  };

  // 3.5. Tiến Bộ Phát Âm (pronunciation_gain): Recent vs Baseline
  const isPronEligible = Boolean(metrics.eligibility?.pronunciation && metrics.pronunciationGain !== null);
  const pronSamples = typeof metrics.evidence?.pronunciation_samples === 'number' ? metrics.evidence.pronunciation_samples : 0;
  const pronPreview: LocalLeaderboardMetricPreview = {
    category: 'pronunciation_gain',
    value: isPronEligible ? metrics.pronunciationGain : null,
    displayValue: isPronEligible
      ? `${metrics.pronunciationGain! > 0 ? '+' : ''}${metrics.pronunciationGain!.toFixed(1)} điểm`
      : 'Chưa đủ dữ liệu',
    secondaryScore: pronSamples,
    secondaryDisplay: pronSamples > 0 ? `${pronSamples} lượt mẫu` : null,
    status: isPronEligible ? 'eligible' : 'insufficient_evidence',
    isEligible: isPronEligible,
    ineligibleHint: isPronEligible
      ? undefined
      : 'Cần tối thiểu 10 lượt phát âm qua ít nhất 2 ngày trong tuần để được xếp hạng.',
    hasLocalActivity: pronSamples > 0,
  };

  // 3.6. Tăng Trưởng TOEIC (toeic_gain): Normalized Diagnostic Difference
  const isToeicEligible = Boolean(metrics.eligibility?.toeic && metrics.toeicGain !== null);
  const toeicAttempts = typeof metrics.evidence?.toeic_attempts === 'number' ? metrics.evidence.toeic_attempts : 0;
  const toeicPreview: LocalLeaderboardMetricPreview = {
    category: 'toeic_gain',
    value: isToeicEligible ? metrics.toeicGain : null,
    displayValue: isToeicEligible
      ? `${metrics.toeicGain! > 0 ? '+' : ''}${metrics.toeicGain!} LR`
      : 'Chưa đủ điều kiện',
    secondaryScore: toeicAttempts,
    secondaryDisplay: toeicAttempts > 0 ? `${toeicAttempts} bài mock` : null,
    status: isToeicEligible ? 'eligible' : 'insufficient_evidence',
    isEligible: isToeicEligible,
    ineligibleHint: isToeicEligible
      ? undefined
      : 'Cần hoàn thành tối thiểu 2 bài thi mock test đầy đủ trong tuần để được xếp hạng.',
    hasLocalActivity: toeicAttempts > 0,
  };

  // 3.7. Top Chuỗi Streak (streak): Daily Consecutive Study Days
  const streakPreview: LocalLeaderboardMetricPreview = {
    category: 'streak',
    value: streak,
    displayValue: `${streak.toLocaleString()} ngày`,
    secondaryScore: weeklyXp,
    secondaryDisplay: weeklyXp > 0 ? `${weeklyXp.toLocaleString()} XP tuần` : null,
    status: 'eligible',
    isEligible: true,
    hasLocalActivity: streak > 0,
  };

  return {
    weekly_xp: weeklyXpPreview,
    vocab_mastered: vocabPreview,
    review_consistency: consistencyPreview,
    active_minutes: minutesPreview,
    pronunciation_gain: pronPreview,
    toeic_gain: toeicPreview,
    streak: streakPreview,
  };
}

/**
 * Helper lấy nhanh bản xem trước của một danh mục cụ thể từ preview map.
 */
export function getCategoryPreview(
  category: LeaderboardMetric,
  previewMap: LocalLeaderboardPreviewMap
): LocalLeaderboardMetricPreview {
  return previewMap[category] || previewMap.weekly_xp;
}

/**
 * React Hook: Cung cấp bản xem trước cục bộ của người dùng hiện tại được ghi nhớ (memoized)
 * theo đúng các slice thay đổi trong useAppStore để tránh re-render lãng phí.
 */
export function useLocalLeaderboardPreview(
  activeMetric: LeaderboardMetric = 'weekly_xp',
  options?: { refDate?: Date }
): {
  previews: LocalLeaderboardPreviewMap;
  currentPreview: LocalLeaderboardMetricPreview;
} {
  const dailyHistory = useAppStore((s) => s.dailyHistory);
  const srsProgressMap = useAppStore((s) => s.srsProgressMap);
  const userCollocations = useAppStore((s) => s.userCollocations);
  const streak = useAppStore((s) => s.profile?.streak || 0);
  const recentReviewEvents = useAppStore((s) => s.recentReviewEvents);
  const srsAlgorithm = useAppStore((s) => s.srsAlgorithm);

  const previews = useMemo(() => {
    return deriveCurrentUserLeaderboardPreview(
      {
        dailyHistory,
        srsProgressMap,
        userCollocations,
        profile: { streak } as any,
        recentReviewEvents,
        srsAlgorithm,
      },
      options
    );
  }, [dailyHistory, srsProgressMap, userCollocations, streak, recentReviewEvents, srsAlgorithm, options?.refDate]);

  const currentPreview = previews[activeMetric] || previews.weekly_xp;

  return {
    previews,
    currentPreview,
  };
}
