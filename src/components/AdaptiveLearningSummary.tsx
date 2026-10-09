// src/components/AdaptiveLearningSummary.tsx
// Component tóm tắt Học Thích Ứng (Adaptive Learning) tích hợp trên Dashboard.
// Hiển thị 4 chỉ số cốt lõi: Ghi nhớ thực tế, Tải ôn tập (Hôm nay / 7 ngày),
// Số từ khó (Leech), và Đề xuất Target Retention (FSRS).
// Hỗ trợ chế độ tối/sáng hài hòa và bảo vệ toàn diện chống giá trị null/rỗng.

import React from 'react';
import { RetentionWindowMetrics } from '../services/srsAnalytics';
import { WorkloadForecastResult } from '../services/srsWorkloadForecast';
import { RetentionRecommendation } from '../services/retentionRecommendation';
import { Brain, ArrowRight } from 'lucide-react';

interface Props {
  metrics: RetentionWindowMetrics;
  forecast: WorkloadForecastResult;
  leechCount: number;
  recommendation: RetentionRecommendation;
  onOpenDetails: () => void;
}

export const AdaptiveLearningSummary: React.FC<Props> = ({
  metrics,
  forecast,
  leechCount,
  recommendation,
  onOpenDetails,
}) => {
  // Safe retention displays
  const actualRetentionDisplay =
    metrics.actualRetention !== null && Number.isFinite(metrics.actualRetention)
      ? `${Math.round(metrics.actualRetention * 100)}%`
      : 'Chưa có';

  const targetRetentionDisplay =
    Number.isFinite(metrics.desiredRetention)
      ? `${Math.round(metrics.desiredRetention * 100)}%`
      : '90%';

  const isFsrsApplicable = recommendation.isApplicable !== false;
  const recommendedRetentionDisplay = isFsrsApplicable
    ? `${Math.round(recommendation.recommendedRetention * 100)}%`
    : 'Cố định';

  return (
    <div 
      data-testid="adaptive-learning-summary"
      className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800 p-5 sm:p-6 mb-6 transition-all"
    >
      <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-white text-base">
              Học Thích Ứng (Adaptive Learning)
            </h3>
            <span className="text-[11px] text-gray-500 dark:text-slate-400 hidden sm:inline">
              Tối ưu hóa ghi nhớ dài hạn & điều phối khối lượng học
            </span>
          </div>
        </div>

        <button
          onClick={onOpenDetails}
          className="text-xs text-blue-600 dark:text-cyan-400 hover:text-blue-800 dark:hover:text-cyan-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>Chi tiết analytics</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-center">
        {/* 1. Ghi nhớ thực tế */}
        <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-100/60 dark:border-blue-500/20 rounded-2xl flex flex-col justify-between">
          <div className="text-xs text-gray-500 dark:text-slate-400 mb-1 font-medium">Ghi nhớ thực tế</div>
          <div className="text-xl sm:text-2xl font-black text-blue-700 dark:text-blue-400 font-mono">
            {actualRetentionDisplay}
          </div>
          <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
            Mục tiêu: {targetRetentionDisplay}
          </div>
        </div>

        {/* 2. Dự báo tải ôn tập */}
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-100/60 dark:border-amber-500/20 rounded-2xl flex flex-col justify-between">
          <div className="text-xs text-gray-500 dark:text-slate-400 mb-1 font-medium">Hôm nay / 7 ngày</div>
          <div className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-400 font-mono">
            {forecast.today} <span className="text-xs font-normal text-gray-500 dark:text-slate-400">/ {forecast.next7Days}</span>
          </div>
          <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
            Thẻ đến hạn
          </div>
        </div>

        {/* 3. Từ khó hay quên (Leech) */}
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-100/60 dark:border-rose-500/20 rounded-2xl flex flex-col justify-between">
          <div className="text-xs text-gray-500 dark:text-slate-400 mb-1 font-medium">Từ hay quên (Leech)</div>
          <div className="text-xl sm:text-2xl font-black text-rose-700 dark:text-rose-400 font-mono">
            {leechCount}
          </div>
          <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
            Cần chú ý ôn kỹ
          </div>
        </div>

        {/* 4. Đề xuất Target Retention */}
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100/60 dark:border-emerald-500/20 rounded-2xl flex flex-col justify-between">
          <div className="text-xs text-gray-500 dark:text-slate-400 mb-1 font-medium">Đề xuất Retention</div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
            {recommendedRetentionDisplay}
          </div>
          <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
            {isFsrsApplicable
              ? `Độ tin cậy: ${recommendation.confidence}`
              : 'SM-2 dùng Ease Factor'}
          </div>
        </div>
      </div>
    </div>
  );
};
