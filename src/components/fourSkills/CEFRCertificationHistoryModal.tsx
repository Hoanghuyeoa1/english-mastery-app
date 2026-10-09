// src/components/fourSkills/CEFRCertificationHistoryModal.tsx
import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  History,
  Award,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Calendar,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import type { CEFRLevel } from '../../types';
import type { CheckpointHistoryEntry, CefrSkill } from '../../types/levelCertification';
import { CEFR_LEVELS_ORDER, CEFR_SKILLS_LIST } from '../../types/levelCertification';
import { CENTRAL_CERTIFICATION_POLICY } from '../../services/levelCertificationService';
import { useAppStore } from '../../store/useAppStore';

export interface CEFRCertificationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history?: CheckpointHistoryEntry[];
  initialLevelFilter?: CEFRLevel | 'ALL';
  onSelectRetake?: (level: CEFRLevel) => void;
}

interface AttemptWithDeltas {
  entry: CheckpointHistoryEntry;
  overallDelta: number | null; // null if first attempt for this level
  skillDeltas: Record<CefrSkill, number | null>;
  attemptNumberForLevel: number;
}

const SKILL_LABELS: Record<CefrSkill, { vi: string; icon: string }> = {
  listening: { vi: 'Nghe hiểu', icon: '🎧' },
  reading: { vi: 'Đọc hiểu', icon: '📖' },
  speaking: { vi: 'Nói phản xạ', icon: '🗣️' },
  writing: { vi: 'Viết luận', icon: '✍️' },
};

export const CEFRCertificationHistoryModal: React.FC<CEFRCertificationHistoryModalProps> = ({
  isOpen,
  onClose,
  history: propHistory,
  initialLevelFilter = 'ALL',
  onSelectRetake,
}) => {
  const storeHistory = useAppStore((s) => s.checkpointHistory);
  const rawHistory = propHistory ?? storeHistory ?? [];

  const [levelFilter, setLevelFilter] = useState<CEFRLevel | 'ALL'>(initialLevelFilter);

  // Sync initial level filter when changed from outside
  useEffect(() => {
    if (initialLevelFilter) {
      setLevelFilter(initialLevelFilter);
    }
  }, [initialLevelFilter]);

  // Keyboard navigation: Esc to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Compute attempts with improvement deltas (grouped chronologically per level)
  const computedAttempts: AttemptWithDeltas[] = useMemo(() => {
    // 1. Sort chronological ascending to compute deltas accurately
    const sortedAsc = [...rawHistory].sort((a, b) => a.date - b.date);

    // Group previous attempt by level
    const lastAttemptByLevel = new Map<CEFRLevel, CheckpointHistoryEntry>();
    const countByLevel = new Map<CEFRLevel, number>();
    const withDeltas: AttemptWithDeltas[] = [];

    for (const entry of sortedAsc) {
      const prev = lastAttemptByLevel.get(entry.level);
      const currentCount = (countByLevel.get(entry.level) ?? 0) + 1;
      countByLevel.set(entry.level, currentCount);

      let overallDelta: number | null = null;
      const skillDeltas: Record<CefrSkill, number | null> = {
        listening: null,
        reading: null,
        speaking: null,
        writing: null,
      };

      if (prev) {
        overallDelta = Math.round(entry.overallScore - prev.overallScore);
        for (const sk of CEFR_SKILLS_LIST) {
          const curSk = entry.scores?.[sk] ?? 0;
          const prevSk = prev.scores?.[sk] ?? 0;
          skillDeltas[sk] = Math.round(curSk - prevSk);
        }
      }

      withDeltas.push({
        entry,
        overallDelta,
        skillDeltas,
        attemptNumberForLevel: currentCount,
      });

      lastAttemptByLevel.set(entry.level, entry);
    }

    // 2. Return sorted descending by date for UI presentation (latest first)
    return withDeltas.sort((a, b) => b.entry.date - a.entry.date);
  }, [rawHistory]);

  const filteredAttempts = useMemo(() => {
    if (levelFilter === 'ALL') {
      return computedAttempts;
    }
    return computedAttempts.filter((a) => a.entry.level === levelFilter);
  }, [computedAttempts, levelFilter]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cert-history-modal-title"
      data-testid="certification-history-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="cert-history-modal-title"
                className="text-base sm:text-lg font-black text-white flex items-center gap-2"
              >
                <span>Lịch Sử Kiểm Định CEFR</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {rawHistory.length} lượt thi
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Lịch sử độc lập giữa các kỳ kiểm định • Không pha trộn điểm luyện tập thông thường
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="close-history-modal-btn"
            onClick={onClose}
            aria-label="Đóng lịch sử kiểm định"
            className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Level Filter Tabs */}
        <div
          role="tablist"
          aria-label="Bộ lọc cấp độ kiểm định"
          className="px-4 sm:px-6 py-3 border-b border-slate-800/80 bg-slate-950/40 flex items-center gap-2 overflow-x-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={levelFilter === 'ALL'}
            data-testid="filter-tab-ALL"
            onClick={() => setLevelFilter('ALL')}
            className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              levelFilter === 'ALL'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Tất cả các bậc ({rawHistory.length})
          </button>

          {CEFR_LEVELS_ORDER.map((lvl) => {
            const count = rawHistory.filter((h) => h.level === lvl).length;
            const isSelected = levelFilter === lvl;
            return (
              <button
                key={lvl}
                type="button"
                role="tab"
                aria-selected={isSelected}
                data-testid={`filter-tab-${lvl}`}
                onClick={() => setLevelFilter(lvl)}
                className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                Bậc {lvl} ({count})
              </button>
            );
          })}
        </div>

        {/* Attempt List Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {filteredAttempts.length === 0 ? (
            <div
              data-testid="history-empty-state"
              className="py-12 sm:py-16 text-center space-y-3 bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl"
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 mx-auto flex items-center justify-center text-slate-500">
                <History className="w-6 h-6" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Chưa có lượt thi kiểm định nào {levelFilter !== 'ALL' ? `ở bậc ${levelFilter}` : ''}
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Dữ liệu chỉ ghi nhận khi bạn thực hiện bài thi kiểm định 4 kỹ năng chính thức. Hãy hoàn thành các bài học và thử sức kiểm định khi đủ điều kiện!
              </p>
            </div>
          ) : (
            filteredAttempts.map(({ entry, overallDelta, skillDeltas, attemptNumberForLevel }) => {
              const dateStr = new Date(entry.date).toLocaleString('vi-VN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              const isPassed = entry.isPassed;
              const floor = CENTRAL_CERTIFICATION_POLICY.levels[entry.level]?.perSkillFloorThreshold ?? 55;

              return (
                <article
                  key={entry.attemptId}
                  data-testid={`history-entry-${entry.attemptId}`}
                  className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 hover:border-slate-700 transition-colors"
                >
                  {/* Top Row: Level + Result Badge + Date */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xl font-black text-white px-3 py-1 bg-slate-900 border border-slate-700 rounded-xl">
                        {entry.level}
                      </span>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          {isPassed ? (
                            <span
                              data-testid="badge-certified"
                              className="px-2.5 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-full text-xs font-black inline-flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>✓ Đạt chuẩn (Certified in English Mastery Hub)</span>
                            </span>
                          ) : (
                            <span
                              data-testid="badge-needs-reinforcement"
                              className="px-2.5 py-0.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-full text-xs font-black inline-flex items-center gap-1.5"
                            >
                              <XCircle className="w-3.5 h-3.5 text-rose-400" />
                              <span>Cần củng cố (Needs Reinforcement)</span>
                            </span>
                          )}
                          <span className="text-[11px] text-slate-500">
                            • Lần thi #{attemptNumberForLevel}
                          </span>
                        </div>
                        {entry.certificateId && (
                          <p className="text-[11px] font-mono text-emerald-400/90">
                            Mã xác thực: {entry.certificateId}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>{dateStr}</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        Policy {entry.policyVersion}
                      </span>
                    </div>
                  </div>

                  {/* Middle Row: Overall Score & Delta vs 4 Skills */}
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-850">
                    {/* Overall Score with Delta */}
                    <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col justify-between">
                      <span className="text-[11px] font-bold text-slate-400">Điểm tổng kết</span>
                      <div className="flex items-baseline gap-2 my-1">
                        <strong className="text-2xl font-black text-white">
                          {entry.overallScore}%
                        </strong>
                      </div>
                      {/* Overall Improvement Delta */}
                      <div className="text-[11px]">
                        {overallDelta === null ? (
                          <span className="text-slate-500 inline-flex items-center gap-1">
                            <Minus className="w-3 h-3" />
                            <span>Lần đầu tiên</span>
                          </span>
                        ) : overallDelta > 0 ? (
                          <span
                            data-testid="overall-delta-positive"
                            className="text-emerald-400 font-bold inline-flex items-center gap-0.5"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span>+{overallDelta}% cải thiện</span>
                          </span>
                        ) : overallDelta < 0 ? (
                          <span
                            data-testid="overall-delta-negative"
                            className="text-rose-400 font-bold inline-flex items-center gap-0.5"
                          >
                            <ArrowDownRight className="w-3.5 h-3.5" />
                            <span>{overallDelta}% so với trước</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium inline-flex items-center gap-0.5">
                            <Minus className="w-3 h-3" />
                            <span>0% không đổi</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 4 Skill Cards */}
                    {CEFR_SKILLS_LIST.map((sk) => {
                      const score = entry.scores?.[sk] ?? 0;
                      const passedFloor = score >= floor;
                      const delta = skillDeltas[sk];
                      const meta = SKILL_LABELS[sk];

                      return (
                        <div
                          key={sk}
                          className={`p-3 rounded-xl border flex flex-col justify-between ${
                            passedFloor
                              ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-300">
                              {meta.icon} {meta.vi}
                            </span>
                            <span className="text-[10px] font-mono">
                              {passedFloor ? '✓ Đạt' : `✗ < ${floor}%`}
                            </span>
                          </div>

                          <div className="my-1">
                            <strong className="text-lg font-black text-white">
                              {score}%
                            </strong>
                          </div>

                          {/* Skill Improvement Delta */}
                          <div className="text-[10px]">
                            {delta === null ? (
                              <span className="text-slate-500">Ban đầu</span>
                            ) : delta > 0 ? (
                              <span className="text-emerald-400 font-bold">
                                +{delta}%
                              </span>
                            ) : delta < 0 ? (
                              <span className="text-rose-400 font-bold">
                                {delta}%
                              </span>
                            ) : (
                              <span className="text-slate-500">0%</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Optional Retake Button for failed attempts */}
                  {!isPassed && onSelectRetake && (
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        data-testid={`retake-btn-${entry.attemptId}`}
                        onClick={() => {
                          onSelectRetake(entry.level);
                          onClose();
                        }}
                        className="min-h-[44px] px-4 py-2 bg-slate-800 hover:bg-slate-750 text-cyan-300 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Thử lại bài kiểm định {entry.level}</span>
                      </button>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Hệ thống đánh giá theo khung chuẩn CEFR độc lập tại English Mastery Hub.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2.5 bg-slate-800 hover:bg-slate-750 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
