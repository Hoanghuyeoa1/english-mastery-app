// src/components/SRSAnalyticsPanel.tsx
// Comprehensive Spaced Repetition Analytics Dashboard displaying Target vs. Actual Retention,
// 4-rating telemetry distribution, and retention gap trends across 7d, 30d, and recorded history windows.
// Distinguishes FSRS configurable target retention from SM-2 fixed scheduling semantics.

import React, { useState, useMemo } from 'react';
import { 
  Target, 
  Brain, 
  CheckCircle2, 
  AlertCircle, 
  Layers,
  Percent,
  Calendar,
  HelpCircle
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { 
  computeRetentionMetrics,
  computeRetentionMetricsFromDailyHistory,
  computeDailyRetentionTrend,
} from '../services/srsAnalytics';
import { RetentionChart } from './RetentionChart';
import { SRSReviewEvent, DailyProgress } from '../types';

export interface SRSAnalyticsPanelProps {
  history?: SRSReviewEvent[];
  desiredRetention?: number;
  dailyHistory?: Record<string, DailyProgress>;
  algorithm?: 'sm2' | 'fsrs';
  className?: string;
}

export function SRSAnalyticsPanel({
  history: propHistory,
  desiredRetention: propDesiredRetention,
  dailyHistory: propDailyHistory,
  algorithm: propAlgorithm,
  className = '',
}: SRSAnalyticsPanelProps): React.JSX.Element {
  const store = useAppStore();

  // Prefer props if provided (decoupled testing), fallback to Zustand store
  const history = propHistory ?? store.recentReviewEvents;
  const desiredRetention = propDesiredRetention ?? store.fsrsSettings.desiredRetention;
  const dailyHistory = propDailyHistory ?? store.dailyHistory;
  const algorithm = propAlgorithm ?? store.srsAlgorithm;

  // Window options: 7 days, 30 days, or recorded history (avoiding misleading "all-time" label)
  const [selectedWindow, setSelectedWindow] = useState<7 | 30 | 'all'>(7);
  const [nowTimestamp] = useState(() => Date.now());

  // ARCHITECTURAL SINGLE SOURCE OF TRUTH:
  // When dailyHistory is available, it is the primary aggregate source of truth.
  // When only raw event history is passed (e.g. standalone test), compute from events.
  const metrics = useMemo(() => {
    if (dailyHistory && Object.keys(dailyHistory).length > 0) {
      return computeRetentionMetricsFromDailyHistory(
        dailyHistory,
        desiredRetention,
        selectedWindow,
        nowTimestamp
      );
    }
    return computeRetentionMetrics(
      history,
      desiredRetention,
      selectedWindow,
      nowTimestamp
    );
  }, [dailyHistory, history, desiredRetention, selectedWindow, nowTimestamp]);

  // Generate daily trend data points for RetentionChart (7d or 30d)
  const trendData = useMemo(() => {
    const trendWindow = selectedWindow === 'all' ? 30 : selectedWindow;
    return computeDailyRetentionTrend(
      history,
      desiredRetention,
      trendWindow,
      nowTimestamp,
      dailyHistory
    );
  }, [history, desiredRetention, selectedWindow, nowTimestamp, dailyHistory]);

  const hasData = metrics.hasSufficientData && metrics.actualRetention !== null;
  const actualRetentionPct = hasData ? Math.round((metrics.actualRetention as number) * 100) : null;
  const targetRetentionPct = Math.round(metrics.desiredRetention * 100);
  const retentionGapPct = hasData && metrics.retentionGap !== null ? Math.round(metrics.retentionGap * 100) : null;
  const isTargetAchieved = hasData && metrics.retentionGap !== null && metrics.retentionGap >= 0;

  // Semantic check: Target Retention is only a schedule-governing parameter in FSRS
  const isFSRS = algorithm === 'fsrs';

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl space-y-6 ${className}`}>
      {/* Header & Window Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center font-bold">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white">
                Hiệu Suất Ghi Nhớ & Phản Xạ SRS
              </h2>
              <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full border ${
                isFSRS 
                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                  : 'border-slate-600 bg-slate-800 text-slate-300'
              }`}>
                {isFSRS ? 'FSRS v4.5' : 'SM-2 Standard'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isFSRS 
                ? 'Đo lường tỷ lệ nhớ thực tế (Observed) đối chiếu với Target Retention của FSRS'
                : 'Theo dõi phản xạ đánh giá SM-2 (Target Retention chỉ áp dụng khi bật FSRS)'}
            </p>
          </div>
        </div>

        {/* Time Window Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800 self-start sm:self-auto">
          {(
            [
              { id: 7, label: '7 ngày' },
              { id: 30, label: '30 ngày' },
              { id: 'all', label: 'Đã ghi nhận' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedWindow(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedWindow === tab.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Actual Retention */}
        <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Tỷ lệ nhớ thực tế</span>
            <Percent className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`font-mono font-black ${
              hasData ? 'text-2xl sm:text-3xl text-white' : 'text-base sm:text-lg text-slate-500'
            }`}>
              {hasData ? `${actualRetentionPct}%` : 'Chưa có dữ liệu'}
            </span>
            {hasData && retentionGapPct !== null && isFSRS && (
              <span
                className={`text-[11px] font-bold flex items-center gap-0.5 ${
                  isTargetAchieved ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {retentionGapPct >= 0 ? `+${retentionGapPct}%` : `${retentionGapPct}%`}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {hasData
              ? `${metrics.totalReviews - metrics.ratingDistribution.again}/${metrics.totalReviews} lượt nhớ lại`
              : 'Chưa có lượt ôn tập nào'}
          </p>
        </div>

        {/* Target Retention (FSRS Only) */}
        <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Mục tiêu thiết lập</span>
            <Target className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="mt-2">
            {isFSRS ? (
              <span className="text-2xl sm:text-3xl font-black text-indigo-400 font-mono">
                {targetRetentionPct}%
              </span>
            ) : (
              <span className="text-base sm:text-lg font-bold text-slate-500 font-mono">
                Không áp dụng
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {isFSRS
              ? 'FSRS Desired Retention'
              : 'SM-2 dùng khoảng cách cố định (không dùng Target)'}
          </p>
        </div>

        {/* Retention Gap & Status */}
        <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Độ lệch mục tiêu</span>
            {hasData && isFSRS ? (
              isTargetAchieved ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              )
            ) : (
              <HelpCircle className="w-3.5 h-3.5 text-slate-600" />
            )}
          </div>
          <div className="mt-2">
            <span
              className={`font-mono font-black ${
                !hasData || !isFSRS
                  ? 'text-base sm:text-lg text-slate-500'
                  : isTargetAchieved
                  ? 'text-2xl sm:text-3xl text-emerald-400'
                  : 'text-2xl sm:text-3xl text-amber-400'
              }`}
            >
              {!hasData
                ? '--'
                : !isFSRS
                ? 'N/A'
                : metrics.retentionGap !== null && metrics.retentionGap >= 0
                ? `+${metrics.retentionGap.toFixed(2)}`
                : metrics.retentionGap?.toFixed(2)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {!hasData
              ? 'Chưa đủ dữ liệu để đo'
              : !isFSRS
              ? 'Chỉ khả dụng trên FSRS'
              : isTargetAchieved
              ? 'Vượt kỳ vọng ghi nhớ'
              : 'Cần tăng tần suất ôn'}
          </p>
        </div>

        {/* Total Reviews Count */}
        <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Tổng lượt ôn tập</span>
            <Layers className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono">
              {metrics.totalReviews}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {selectedWindow === 'all'
              ? metrics.analyticsStartedAt
                ? `Ghi nhận từ ${metrics.analyticsStartedAt}`
                : 'Toàn bộ dữ liệu ghi nhận'
              : `Trong ${selectedWindow} ngày qua`}
          </p>
        </div>
      </div>

      {/* SVG Trend Chart */}
      <div className="bg-slate-950 border border-slate-850 p-5 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs sm:text-sm font-bold text-white">
              Đường Xu Hướng Tỷ Lệ Ghi Nhớ Theo Ngày
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            {selectedWindow === 'all' ? '30 ngày gần nhất' : `${selectedWindow} ngày gần nhất`}
          </span>
        </div>

        <RetentionChart data={trendData} />
      </div>

      {/* Rating Distribution Breakdown */}
      <div className="bg-slate-950 border border-slate-850 p-5 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-bold text-white">
            Phân Bổ Lựa Chọn Đánh Giá (Rating Distribution)
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">
            Tổng: {metrics.totalReviews} lượt
          </span>
        </div>

        {/* Multi-segment Stacked Progress Bar */}
        {metrics.totalReviews > 0 ? (
          <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden flex">
            {metrics.ratingPercentages.again > 0 && (
              <div
                style={{ width: `${metrics.ratingPercentages.again}%` }}
                className="bg-rose-500 h-full transition-all duration-300"
                title={`Quên: ${metrics.ratingDistribution.again} (${metrics.ratingPercentages.again}%)`}
              />
            )}
            {metrics.ratingPercentages.hard > 0 && (
              <div
                style={{ width: `${metrics.ratingPercentages.hard}%` }}
                className="bg-amber-500 h-full transition-all duration-300"
                title={`Khó: ${metrics.ratingDistribution.hard} (${metrics.ratingPercentages.hard}%)`}
              />
            )}
            {metrics.ratingPercentages.good > 0 && (
              <div
                style={{ width: `${metrics.ratingPercentages.good}%` }}
                className="bg-emerald-500 h-full transition-all duration-300"
                title={`Tốt: ${metrics.ratingDistribution.good} (${metrics.ratingPercentages.good}%)`}
              />
            )}
            {metrics.ratingPercentages.easy > 0 && (
              <div
                style={{ width: `${metrics.ratingPercentages.easy}%` }}
                className="bg-sky-500 h-full transition-all duration-300"
                title={`Dễ: ${metrics.ratingDistribution.easy} (${metrics.ratingPercentages.easy}%)`}
              />
            )}
          </div>
        ) : (
          <div className="w-full h-3 bg-slate-900 rounded-full" />
        )}

        {/* 4 Detail Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Again */}
          <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center justify-between text-xs font-semibold text-rose-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Quên (Again)</span>
              </span>
              <span className="font-mono">{metrics.ratingPercentages.again}%</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-base font-bold text-white font-mono">
                {metrics.ratingDistribution.again}
              </span>
              <span className="text-[10px] text-slate-500">lượt</span>
            </div>
          </div>

          {/* Hard */}
          <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Khó (Hard)</span>
              </span>
              <span className="font-mono">{metrics.ratingPercentages.hard}%</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-base font-bold text-white font-mono">
                {metrics.ratingDistribution.hard}
              </span>
              <span className="text-[10px] text-slate-500">lượt</span>
            </div>
          </div>

          {/* Good */}
          <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Tốt (Good)</span>
              </span>
              <span className="font-mono">{metrics.ratingPercentages.good}%</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-base font-bold text-white font-mono">
                {metrics.ratingDistribution.good}
              </span>
              <span className="text-[10px] text-slate-500">lượt</span>
            </div>
          </div>

          {/* Easy */}
          <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center justify-between text-xs font-semibold text-sky-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-500" />
                <span>Dễ (Easy)</span>
              </span>
              <span className="font-mono">{metrics.ratingPercentages.easy}%</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-base font-bold text-white font-mono">
                {metrics.ratingDistribution.easy}
              </span>
              <span className="text-[10px] text-slate-500">lượt</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
