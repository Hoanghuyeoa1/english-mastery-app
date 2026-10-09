// src/components/ToeicAnalyticsDashboard.tsx

import React, { useMemo, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  HelpCircle,
  Clock,
  BookOpen,
  Headphones,
  Mic,
  PenTool,
  ArrowRight,
  Info,
  Layers,
  Sparkles,
  BarChart2,
  Calendar,
  Check,
} from 'lucide-react';
import {
  ToeicWeaknessProfile,
  ToeicRecommendation,
  ToeicRecommendationAction,
  ToeicAttemptAnalytics,
  ToeicConfidenceLevel,
  ToeicTrendDirection,
  ToeicEvidenceStrength,
  ToeicPerformanceStability,
  ToeicWeaknessLifecycle,
  ToeicStrengthLifecycle,
  ToeicWeaknessSeverity,
} from '../types/toeic';
import { generateToeicRecommendations } from '../services/toeicRecommendationService';

export interface ToeicAnalyticsDashboardProps {
  profile: ToeicWeaknessProfile;
  currentAttempt?: ToeicAttemptAnalytics | null;
  onExecuteAction?: (action: ToeicRecommendationAction) => void;
  className?: string;
}

/**
 * Format nhãn hiển thị cho Độ tin cậy (Confidence Level)
 */
function renderConfidenceBadge(conf: ToeicConfidenceLevel) {
  switch (conf) {
    case 'high':
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
          aria-label="Độ tin cậy cao"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Độ tin cậy: Cao</span>
        </span>
      );
    case 'medium':
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30"
          aria-label="Độ tin cậy trung bình"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span>Độ tin cậy: Trung bình</span>
        </span>
      );
    case 'low':
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700"
          aria-label="Độ tin cậy thấp"
        >
          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          <span>Độ tin cậy: Thấp</span>
        </span>
      );
    case 'insufficient':
    default:
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-850 text-slate-400 border border-slate-800"
          aria-label="Chưa đủ dữ liệu"
        >
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>Chưa đủ dữ liệu</span>
        </span>
      );
  }
}

/**
 * Format nhãn hiển thị cho Bậc bằng chứng (Evidence Strength)
 */
function renderEvidenceStrengthBadge(strength?: ToeicEvidenceStrength) {
  if (!strength) return null;
  switch (strength) {
    case 'established':
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
          title="Bằng chứng vững chắc (≥ 10 câu hỏi)"
        >
          <span>Vững chắc (≥10 câu)</span>
        </span>
      );
    case 'likely':
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30"
          title="Bằng chứng đáng tin cậy (5-9 câu hỏi)"
        >
          <span>Đáng tin cậy (5–9 câu)</span>
        </span>
      );
    case 'emerging':
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30"
          title="Tín hiệu mới xuất hiện (3-4 câu hỏi - cần thêm dữ liệu để khẳng định)"
        >
          <span>Tín hiệu mới (3–4 câu)</span>
        </span>
      );
    default:
      return null;
  }
}

/**
 * Format nhãn hiển thị cho Độ ổn định phong độ (Stability)
 */
function renderStabilityBadge(stability?: ToeicPerformanceStability) {
  if (!stability || stability === 'insufficient_data') return null;
  if (stability === 'volatile') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30"
        title="Phong độ dao động lớn giữa các bài thi gần đây"
      >
        <span>Biến động phong độ</span>
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30"
      title="Phong độ đồng đều, ít biến động"
    >
      <span>Phong độ đều</span>
    </span>
  );
}

/**
 * Format nhãn hiển thị cho Vòng đời điểm yếu (Weakness Lifecycle)
 */
function renderWeaknessLifecycleBadge(lifecycle?: ToeicWeaknessLifecycle) {
  if (!lifecycle) return null;
  switch (lifecycle) {
    case 'resolved':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>Đã khắc phục 🎉</span>
        </span>
      );
    case 'improving':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
          <TrendingUp className="w-3 h-3 text-cyan-400" />
          <span>Đang tiến bộ</span>
        </span>
      );
    case 'emerging':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <span>Mới xuất hiện</span>
        </span>
      );
    case 'active':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
          <span>Cần can thiệp</span>
        </span>
      );
  }
}

/**
 * Format nhãn hiển thị cho Vòng đời điểm mạnh (Strength Lifecycle)
 */
function renderStrengthLifecycleBadge(lifecycle?: ToeicStrengthLifecycle) {
  if (!lifecycle) return null;
  switch (lifecycle) {
    case 'declining_strength':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <TrendingDown className="w-3 h-3 text-amber-400" />
          <span>Dấu hiệu suy giảm</span>
        </span>
      );
    case 'stable_strength':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
          <Check className="w-3 h-3 text-emerald-400" />
          <span>Điểm mạnh vững</span>
        </span>
      );
    case 'emerging_strength':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30">
          <span>Điểm mạnh mới</span>
        </span>
      );
  }
}

/**
 * Format nhãn mức độ nghiêm trọng (Severity Level)
 */
function renderSeverityBadge(severity?: ToeicWeaknessSeverity) {
  if (!severity) return null;
  switch (severity) {
    case 'critical':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
          <span>Nghiêm trọng (&lt;35%)</span>
        </span>
      );
    case 'moderate':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <span>Đáng chú ý (35–50%)</span>
        </span>
      );
    case 'mild':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">
          <span>Nhẹ (50–55%)</span>
        </span>
      );
  }
}

/**
 * Format nhãn hiển thị cho Xu hướng (Trend)
 */
function renderTrendBadge(trend?: ToeicTrendDirection) {
  if (!trend || trend === 'insufficient_data') {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400"
        aria-label="Chưa đủ dữ liệu xu hướng"
      >
        <Info className="w-3 h-3 text-slate-500" />
        <span>Chưa đủ dữ liệu (cần ≥ 3 bài)</span>
      </span>
    );
  }

  if (trend === 'improving') {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400"
        aria-label="Xu hướng đang tiến bộ"
      >
        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
        <span>Đang tiến bộ (+10%)</span>
      </span>
    );
  }

  if (trend === 'declining') {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400"
        aria-label="Xu hướng đang sụt giảm"
      >
        <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
        <span>Đang sụt giảm (-10%)</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400"
      aria-label="Phong độ ổn định"
    >
      <Minus className="w-3.5 h-3.5 text-blue-400" />
      <span>Phong độ ổn định</span>
    </span>
  );
}

export const ToeicAnalyticsDashboard: React.FC<ToeicAnalyticsDashboardProps> = ({
  profile,
  currentAttempt,
  onExecuteAction,
  className = '',
}) => {
  // Toggle chế độ xem: Toàn diện dài hạn (Long-term) vs Hiệu suất gần đây (Recent window)
  const [viewMode, setViewMode] = useState<'long_term' | 'recent'>('long_term');

  // Memoize danh sách khuyến nghị để tránh tính lại trên mỗi render
  const recommendations: ToeicRecommendation[] = useMemo(() => {
    if (profile.recommendations && profile.recommendations.length > 0) {
      return profile.recommendations;
    }
    return generateToeicRecommendations(profile.priorities || []);
  }, [profile.recommendations, profile.priorities]);

  // Kiểm tra trạng thái ít dữ liệu (Low-data state)
  const isLowData =
    profile.isLowData ??
    (profile.confidence === 'insufficient' ||
      profile.evidenceSummary.objectiveEvaluated < 15 ||
      profile.evidenceSummary.totalAttempts < 2);

  // Lọc danh sách Part 1-7 chuẩn từ aggregates
  const partList = useMemo(() => {
    const defaultParts = [
      'part1_photos',
      'part2_qna',
      'part3_conv',
      'part4_talks',
      'part5_grammar',
      'part6_text',
      'part7_reading',
    ] as const;

    return defaultParts.map((partKey) => {
      const partAgg = profile.aggregates.byPart[partKey];
      const partInsight = profile.weaknesses
        .concat(profile.strengths, profile.neutralOrInsufficient)
        .find((i) => i.type === 'part' && i.key === partKey);

      return {
        key: partKey,
        name: partAgg?.partName || partKey.toUpperCase(),
        evidenceCount: partAgg?.evidenceCount || 0,
        accuracy: partAgg?.accuracy ?? null,
        confidence: partInsight?.confidence || 'insufficient',
        trend: partInsight?.trend,
        evidenceStrength: partInsight?.evidenceStrength,
      };
    });
  }, [profile.aggregates.byPart, profile.weaknesses, profile.strengths, profile.neutralOrInsufficient]);

  return (
    <div
      className={`space-y-8 bg-slate-950 text-slate-100 rounded-3xl p-4 sm:p-8 border border-slate-800 shadow-2xl ${className}`}
      role="region"
      aria-label="Bảng phân tích năng lực và điểm yếu TOEIC"
    >
      {/* ========================================================================= */}
      {/* 1. OVERALL PROFILE HEADER & VIEW TOGGLE                                     */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4" />
                <span>TOEIC Mastery Intelligence</span>
              </span>
              {renderConfidenceBadge(profile.confidence)}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Hồ Sơ Năng Lực &amp; Điểm Yếu TOEIC
            </h2>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-slate-400 block font-medium">Tổng bằng chứng thu thập</span>
            <strong className="text-2xl sm:text-3xl font-black text-white">
              {profile.evidenceSummary.totalQuestionsEvaluated}
            </strong>
            <span className="text-xs text-slate-500 block">
              câu hỏi qua {profile.evidenceSummary.totalAttempts} bài thi
            </span>
          </div>
        </div>

        {/* View Switcher: Long-term vs Recent Performance */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="inline-flex p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('long_term')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'long_term'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Hồ Sơ Toàn Diện (Dài Hạn)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('recent')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'recent'
                  ? 'bg-blue-500 text-slate-950 shadow-md shadow-blue-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Hiệu Suất Gần Đây (3–5 bài)</span>
            </button>
          </div>

          <span className="text-xs text-slate-400">
            {viewMode === 'long_term'
              ? 'Tổng hợp toàn bộ lịch sử thi + lưu trữ dài hạn'
              : 'Cửa sổ quan sát 3–5 bài thi gần nhất để phát hiện biến động'}
          </span>
        </div>

        {/* Source Breakdown (Diagnostic / Practice / Mock) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-bold">Mock Test (Strict)</span>
              <span className="text-xs text-slate-500">Trọng số ảnh hưởng: 1.5x</span>
            </div>
            <span className="text-lg font-black text-blue-400">
              {profile.evidenceSummary.modeBreakdown.mock} bài
            </span>
          </div>

          <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-bold">Diagnostic (CAT)</span>
              <span className="text-xs text-slate-500">Trọng số ảnh hưởng: 1.2x</span>
            </div>
            <span className="text-lg font-black text-amber-400">
              {profile.evidenceSummary.modeBreakdown.diagnostic} bài
            </span>
          </div>

          <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-bold">Practice (Tự do)</span>
              <span className="text-xs text-slate-500">Trọng số lần đầu: 1.0x</span>
            </div>
            <span className="text-lg font-black text-emerald-400">
              {profile.evidenceSummary.modeBreakdown.practice} bài
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. LOW-DATA STATE CALLOUT                                                  */}
      {/* ========================================================================= */}
      {isLowData && (
        <div
          className="p-5 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl space-y-3 text-left"
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-center gap-2.5 text-amber-400 font-bold text-sm">
            <Info className="w-5 h-5 shrink-0" />
            <span>{profile.lowDataMessage || 'Cần thêm dữ liệu để xác định điểm yếu ổn định.'}</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Hệ thống phân tích của English Mastery Hub áp dụng nguyên tắc sư phạm thận trọng:
            cần tối thiểu <strong>2–3 bài thi hoàn thành</strong> và từ <strong>5–10 câu hỏi</strong> trong cùng chủ điểm
            để xác định chắc chắn điểm yếu. Tránh kết luận sai lệch khi học viên chỉ mới làm vài câu khởi động.
            Các kết luận dưới 5 câu được gắn nhãn{' '}
            <strong className="text-amber-300">Tín hiệu mới</strong> và giảm ưu tiên để không gây hoang mang.
          </p>

          {/* Current Attempt Observations */}
          {currentAttempt && (
            <div className="mt-3 p-4 bg-slate-900/90 border border-amber-500/20 rounded-xl space-y-2">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wide block">
                Quan sát từ lượt thi hiện tại (Current attempt observations):
              </span>
              <div className="flex flex-wrap gap-4 text-xs text-slate-300">
                <span>
                  Độ chính xác lượt này: <strong>{currentAttempt.overall.accuracy}%</strong> (
                  {currentAttempt.overall.correctCount}/{currentAttempt.overall.objectiveCount} câu)
                </span>
                <span>
                  Thời gian làm bài: <strong>{Math.round(currentAttempt.overall.timeSpentSeconds / 60)} phút</strong>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 italic">
                * Đây là kết quả tức thời của bài thi vừa nộp, chưa bị gán ngay thành điểm yếu cố hữu lâu dài.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. RECENT PERFORMANCE WINDOW (NẾU ĐANG CHỌN VIEW RECENT)                   */}
      {/* ========================================================================= */}
      {viewMode === 'recent' && profile.recentPerformance && (
        <div className="p-5 bg-slate-900/95 border-2 border-blue-500/30 rounded-2xl space-y-4 text-left shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-blue-400 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Hiệu Suất Gần Đây ({profile.recentPerformance.attemptsConsidered} Bài Thi Gần Nhất)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cửa sổ trượt giúp theo dõi sự tiến bộ hoặc dấu hiệu sụt giảm tức thì mà không xóa nhòa phong độ lịch sử.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block font-medium">Độ chính xác trung bình gần đây</span>
              <strong className="text-2xl font-black text-white">
                {profile.recentPerformance.averageAccuracy}%
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span>Xu hướng chung gần đây:</span>
            {renderTrendBadge(profile.recentPerformance.trend)}
          </div>

          {profile.recentPerformance.topWeaknesses && profile.recentPerformance.topWeaknesses.length > 0 && (
            <div className="space-y-2 pt-1">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                Các điểm cần lưu ý trong các bài gần nhất:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {profile.recentPerformance.topWeaknesses.map((w, idx) => (
                  <div
                    key={`rec_w_${w.key}_${idx}`}
                    className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-white block">{w.displayName}</span>
                      <span className="text-[11px] text-slate-400">{w.evidenceCount} câu gần đây</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-rose-400">
                        {w.accuracy !== null ? `${w.accuracy}%` : 'Cần cải thiện'}
                      </span>
                      {renderEvidenceStrengthBadge(w.evidenceStrength)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SKILLS OVERVIEW                                                         */}
      {/* ========================================================================= */}
      <div className="space-y-4 text-left">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>Tổng Quan 4 Kỹ Năng (Skills Overview)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Listening */}
          <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span className="flex items-center gap-1.5 text-amber-400">
                <Headphones className="w-4 h-4" /> Listening
              </span>
              <span>{profile.aggregates.bySkill.listening.evidenceCount} câu</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-white">
                {profile.aggregates.bySkill.listening.evidenceCount > 0
                  ? `${profile.aggregates.bySkill.listening.accuracy}%`
                  : 'N/A'}
              </span>
              {typeof profile.aggregates.bySkill.listening.scaledScoreAvg === 'number' && (
                <span className="text-xs text-slate-400">
                  Ước lượng: ~{profile.aggregates.bySkill.listening.scaledScoreAvg}/495
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-500 block">
              Đúng {profile.aggregates.bySkill.listening.totalCorrect}/
              {profile.aggregates.bySkill.listening.totalSeen} câu nghe
            </span>
          </div>

          {/* Reading */}
          <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <BookOpen className="w-4 h-4" /> Reading
              </span>
              <span>{profile.aggregates.bySkill.reading.evidenceCount} câu</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-white">
                {profile.aggregates.bySkill.reading.evidenceCount > 0
                  ? `${profile.aggregates.bySkill.reading.accuracy}%`
                  : 'N/A'}
              </span>
              {typeof profile.aggregates.bySkill.reading.scaledScoreAvg === 'number' && (
                <span className="text-xs text-slate-400">
                  Ước lượng: ~{profile.aggregates.bySkill.reading.scaledScoreAvg}/495
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-500 block">
              Đúng {profile.aggregates.bySkill.reading.totalCorrect}/
              {profile.aggregates.bySkill.reading.totalSeen} câu đọc
            </span>
          </div>

          {/* Speaking - Open-Ended: Không fake accuracy */}
          <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Mic className="w-4 h-4" /> Speaking
              </span>
              <span>{profile.aggregates.bySkill.speaking.evidenceCount} bài</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-white">
                {typeof profile.aggregates.bySkill.speaking.averageScore === 'number'
                  ? `${profile.aggregates.bySkill.speaking.averageScore}/200`
                  : 'Chưa thi'}
              </span>
              <span className="text-[10px] text-cyan-400 font-bold uppercase">Tự luận mở</span>
            </div>
            <span className="text-[11px] text-slate-500 block">
              {profile.aggregates.bySkill.speaking.averageWordCount
                ? `TB ~${profile.aggregates.bySkill.speaking.averageWordCount} từ/bài nói`
                : 'Đánh giá phát âm & phản xạ'}
            </span>
          </div>

          {/* Writing - Open-Ended: Không fake accuracy */}
          <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span className="flex items-center gap-1.5 text-purple-400">
                <PenTool className="w-4 h-4" /> Writing
              </span>
              <span>{profile.aggregates.bySkill.writing.evidenceCount} bài</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-white">
                {typeof profile.aggregates.bySkill.writing.averageScore === 'number'
                  ? `${profile.aggregates.bySkill.writing.averageScore}/200`
                  : 'Chưa thi'}
              </span>
              <span className="text-[10px] text-purple-400 font-bold uppercase">Tự luận mở</span>
            </div>
            <span className="text-[11px] text-slate-500 block">
              {profile.aggregates.bySkill.writing.averageWordCount
                ? `TB ~${profile.aggregates.bySkill.writing.averageWordCount} từ/bài viết`
                : 'Đánh giá ngữ pháp & từ vựng'}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. PART BREAKDOWN (PART 1–7)                                               */}
      {/* ========================================================================= */}
      <div className="space-y-4 text-left">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <span>Chi Tiết Từng Phần (Part 1–7 Breakdown)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {partList.map((p) => {
            const hasSufficient = p.evidenceCount >= 3 && p.accuracy !== null;

            return (
              <div
                key={p.key}
                className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2"
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">{p.name}</span>
                  {hasSufficient ? (
                    <span
                      className={`font-black ${
                        p.accuracy! >= 80
                          ? 'text-emerald-400'
                          : p.accuracy! >= 55
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {p.accuracy}%
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium">Chưa đủ dữ liệu</span>
                  )}
                </div>

                {/* Progress bar */}
                <div
                  className="w-full bg-slate-800 h-2 rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={hasSufficient ? p.accuracy! : 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  {hasSufficient ? (
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        p.accuracy! >= 80
                          ? 'bg-emerald-500'
                          : p.accuracy! >= 55
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${p.accuracy}%` }}
                    />
                  ) : (
                    <div className="h-full bg-slate-700 w-full opacity-40" />
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                  <div className="flex items-center gap-1">
                    <span>{p.evidenceCount} câu hỏi</span>
                    {renderEvidenceStrengthBadge(p.evidenceStrength)}
                  </div>
                  {renderTrendBadge(p.trend)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. TOP PRIORITIES (ƯU TIÊN CAN THIỆP)                                      */}
      {/* ========================================================================= */}
      {profile.priorities && profile.priorities.length > 0 && (
        <div className="space-y-4 text-left">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Điểm Ưu Tiên Cần Can Thiệp (Top Priorities)</span>
            </h3>
            <span className="text-xs text-slate-400">
              Được lọc và xếp hạng theo: Mức độ nghiêm trọng × Bậc bằng chứng
            </span>
          </div>

          <div className="space-y-3">
            {profile.priorities.map((item, index) => {
              const rec = recommendations.find((r) => r.insightKey === item.key);
              const acc = item.weightedAccuracy ?? item.accuracy;

              return (
                <div
                  key={`priority_${item.key}_${index}`}
                  className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-700 transition-all"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-black flex items-center justify-center border border-amber-500/30">
                        #{index + 1}
                      </span>
                      <h4 className="text-sm font-bold text-white">{item.displayName}</h4>
                      <span className="text-[11px] font-bold text-rose-400 px-2 py-0.5 rounded-lg bg-rose-500/15 border border-rose-500/20">
                        {acc !== null ? `${acc}% Chính xác` : 'Cần cải thiện'}
                      </span>
                      {renderEvidenceStrengthBadge(item.evidenceStrength)}
                      {renderSeverityBadge(item.severityLevel)}
                      {renderWeaknessLifecycleBadge(item.weaknessLifecycle)}
                      {renderStabilityBadge(item.stability)}
                      {renderConfidenceBadge(item.confidence)}
                      {renderTrendBadge(item.trend)}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {item.recommendation || `Đã làm ${item.evidenceCount} câu hỏi trong các bài thi gần đây.`}
                    </p>
                  </div>

                  {rec && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onExecuteAction?.(rec.primaryAction)}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                      >
                        <span>{rec.primaryAction.label}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. RESOLVED WEAKNESSES (ĐIỂM YẾU ĐÃ KHẮC PHỤC)                              */}
      {/* ========================================================================= */}
      {profile.resolvedWeaknesses && profile.resolvedWeaknesses.length > 0 && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-3 text-left">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>Điểm Yếu Đã Khắc Phục Thành Công ({profile.resolvedWeaknesses.length})</span>
          </div>
          <p className="text-xs text-slate-300">
            Học viên đã cải thiện độ chính xác lên mức an toàn (≥ 65%) với ít nhất 6 câu trả lời đúng gần đây:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {profile.resolvedWeaknesses.map((rw) => (
              <div
                key={`res_${rw.key}`}
                className="p-3 bg-slate-900 rounded-xl border border-emerald-500/20 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-white block">{rw.displayName}</span>
                  <span className="text-[11px] text-slate-400">{rw.evidenceCount} câu hỏi</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-emerald-400">{rw.accuracy}%</span>
                  {renderWeaknessLifecycleBadge('resolved')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. WEAKNESSES & STRENGTHS CARDS                                            */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
        {/* Điểm Yếu (Weaknesses) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="text-sm font-bold text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span>Điểm Yếu Đã Xác Nhận ({profile.weaknesses.length})</span>
            </h4>
            <span className="text-[11px] text-slate-500">Chính xác ≤ 55%</span>
          </div>

          {profile.weaknesses.length === 0 ? (
            <p className="text-xs text-slate-400 italic p-4 bg-slate-900 rounded-xl">
              Không có điểm yếu cố hữu nào đang tồn tại. Phong độ rất vững vàng!
            </p>
          ) : (
            <div className="space-y-2.5">
              {profile.weaknesses.slice(0, 5).map((w) => {
                const acc = w.weightedAccuracy ?? w.accuracy;
                const rec = recommendations.find((r) => r.insightKey === w.key);

                return (
                  <div
                    key={`w_${w.key}`}
                    className="p-3 bg-slate-900 rounded-xl border border-rose-500/20 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200">{w.displayName}</span>
                      <span className="font-bold text-rose-400">{acc !== null ? `${acc}%` : 'Cần rèn luyện'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-1">
                      <div className="flex items-center gap-1.5">
                        <span>{w.evidenceCount} câu hỏi</span>
                        {renderEvidenceStrengthBadge(w.evidenceStrength)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {renderWeaknessLifecycleBadge(w.weaknessLifecycle)}
                        {renderTrendBadge(w.trend)}
                      </div>
                    </div>
                    {rec && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => onExecuteAction?.(rec.primaryAction)}
                          className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold rounded-lg text-center transition-colors flex items-center justify-center gap-1"
                        >
                          <span>{rec.primaryAction.label}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Điểm Mạnh (Strengths) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Điểm Mạnh Vững Vàng ({profile.strengths.length})</span>
            </h4>
            <span className="text-[11px] text-slate-500">Chính xác ≥ 80% &amp; Phong độ đều</span>
          </div>

          {profile.strengths.length === 0 ? (
            <p className="text-xs text-slate-400 italic p-4 bg-slate-900 rounded-xl">
              Chưa có chủ điểm nào đạt ngưỡng điểm mạnh ổn định (≥ 80%). Hãy tiếp tục rèn luyện!
            </p>
          ) : (
            <div className="space-y-2.5">
              {profile.strengths.slice(0, 5).map((s) => {
                const acc = s.weightedAccuracy ?? s.accuracy;

                return (
                  <div
                    key={`s_${s.key}`}
                    className="p-3 bg-slate-900 rounded-xl border border-emerald-500/20 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200">{s.displayName}</span>
                      <span className="font-bold text-emerald-400">{acc !== null ? `${acc}%` : 'Vững chắc'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-1">
                      <div className="flex items-center gap-1.5">
                        <span>{s.evidenceCount} câu hỏi</span>
                        {renderEvidenceStrengthBadge(s.evidenceStrength)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {renderStrengthLifecycleBadge(s.strengthLifecycle)}
                        {renderConfidenceBadge(s.confidence)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 9. RECOMMENDED ACTIONS                                                     */}
      {/* ========================================================================= */}
      {recommendations.length > 0 && (
        <div className="space-y-4 text-left">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Kế Hoạch Hành Động Khuyến Nghị (Actionable Plan)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.slice(0, 4).map((rec) => (
              <div
                key={rec.id}
                className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 flex flex-col justify-between hover:border-slate-700 transition-all"
              >
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-white">{rec.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{rec.reason}</p>
                </div>

                <div className="pt-2 flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onExecuteAction?.(rec.primaryAction)}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all flex items-center gap-1 shadow-sm"
                  >
                    <span>{rec.primaryAction.label}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  {rec.secondaryAction && (
                    <button
                      type="button"
                      onClick={() => onExecuteAction?.(rec.secondaryAction!)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition-all"
                    >
                      <span>{rec.secondaryAction.label}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
