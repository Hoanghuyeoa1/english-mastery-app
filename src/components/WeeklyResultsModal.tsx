import React, { useState, useEffect } from 'react';
import { Trophy, Crown, Medal, X, Calendar, RefreshCw, Zap, ShieldAlert, Sparkles } from 'lucide-react';
import { 
  fetchFinalizedWeeks, 
  fetchWeeklySnapshots 
} from '../services/weeklyFinalizationService';
import { LEADERBOARD_FRAMES, getPodiumFrameByRank } from '../services/frameRewardService';
import { WeeklyFinalizationRecord, WeeklySnapshotEntry } from '../types';
import { UserAvatar } from './UserProfileBadge';

interface WeeklyResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WeeklyResultsModal: React.FC<WeeklyResultsModalProps> = ({ isOpen, onClose }) => {
  const [weeks, setWeeks] = useState<WeeklyFinalizationRecord[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string>('');
  const [snapshots, setSnapshots] = useState<WeeklySnapshotEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Tải danh sách các tuần đã chốt
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadWeeks() {
      setLoading(true);
      const list = await fetchFinalizedWeeks(8);
      if (!isMounted) return;
      setWeeks(list);
      if (list.length > 0) {
        setSelectedWeekId(list[0].weekId);
      }
      setLoading(false);
    }

    void loadWeeks();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Tải snapshot Top 3 của tuần được chọn
  useEffect(() => {
    if (!selectedWeekId) {
      setSnapshots([]);
      return;
    }

    let isMounted = true;
    async function loadSnapshots() {
      setLoading(true);
      const data = await fetchWeeklySnapshots(selectedWeekId, 'weekly_xp');
      if (!isMounted) return;
      setSnapshots(data);
      setLoading(false);
    }

    void loadSnapshots();
    return () => {
      isMounted = false;
    };
  }, [selectedWeekId]);

  if (!isOpen) return null;

  const selectedWeekRecord = weeks.find((w) => w.weekId === selectedWeekId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekly-results-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 id="weekly-results-title" className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Kết Quả Mùa Giải Tuần Trước</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Bảng vinh danh Top 3 & Phần thưởng khung avatar được chốt từ máy chủ
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Đóng bảng kết quả tuần"
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="overflow-y-auto py-4 space-y-4 pr-1">
          {/* Week Selector */}
          {weeks.length > 0 && (
            <div className="flex items-center justify-between flex-wrap gap-2 bg-slate-950/80 p-3 rounded-2xl border border-slate-800/80">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>Chọn Tuần:</span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {weeks.map((w) => (
                  <button
                    key={w.weekId}
                    type="button"
                    onClick={() => setSelectedWeekId(w.weekId)}
                    className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
                      selectedWeekId === w.weekId
                        ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                        : 'bg-slate-900 hover:bg-slate-850 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {w.weekId}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Snapshot metadata banner */}
          {selectedWeekRecord && (
            <div className="text-[11px] text-slate-400 flex items-center justify-between px-2">
              <span>
                Thời gian chốt:{' '}
                <span className="font-mono text-slate-300">
                  {selectedWeekRecord.finalizedAt ? new Date(selectedWeekRecord.finalizedAt).toLocaleString('vi-VN') : '---'}
                </span>
              </span>
              <span>
                Tổng số học viên:{' '}
                <span className="font-bold text-white">{selectedWeekRecord.totalParticipants}</span>
              </span>
            </div>
          )}

          {/* Snapshot Top 3 list */}
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <span className="text-xs">Đang tải kết quả tuần từ máy chủ...</span>
            </div>
          ) : snapshots.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400 text-center">
              <div className="p-3 rounded-2xl bg-slate-800/80 text-slate-400 border border-slate-700/60">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <span className="text-sm font-bold text-slate-300">
                Chưa có dữ liệu chốt tuần trước.
              </span>
              <p className="text-xs text-slate-500 max-w-sm">
                Bảng vinh danh sẽ tự động được hệ thống máy chủ chốt và lưu lại vào cuối mỗi tuần thi đấu.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {snapshots.map((item) => {
                const frameId = getPodiumFrameByRank(item.rank);
                const frameDef = frameId ? LEADERBOARD_FRAMES[frameId] : null;

                const getCardTheme = () => {
                  switch (item.rank) {
                    case 1:
                      return {
                        border: 'border-amber-400/70 shadow-amber-500/10',
                        bg: 'bg-amber-500/10',
                        badge: 'bg-amber-400 text-slate-950',
                        icon: <Crown className="w-5 h-5 text-amber-400" />,
                        title: 'QUÁN QUÂN TOP 1',
                      };
                    case 2:
                      return {
                        border: 'border-slate-300/70 shadow-slate-400/10',
                        bg: 'bg-slate-400/10',
                        badge: 'bg-slate-300 text-slate-950',
                        icon: <Medal className="w-5 h-5 text-slate-300" />,
                        title: 'Á QUÂN 1 TOP 2',
                      };
                    case 3:
                    default:
                      return {
                        border: 'border-amber-700/70 shadow-amber-800/10',
                        bg: 'bg-amber-700/10',
                        badge: 'bg-amber-700 text-white',
                        icon: <Medal className="w-5 h-5 text-amber-600" />,
                        title: 'Á QUÂN 2 TOP 3',
                      };
                  }
                };

                const cardTheme = getCardTheme();

                return (
                  <div
                    key={item.userId}
                    className={`p-4 rounded-2xl border ${cardTheme.border} ${cardTheme.bg} flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="shrink-0 flex items-center justify-center">
                        <UserAvatar
                          name={item.displayName}
                          level={item.level}
                          size="md"
                          showLevelBadge={true}
                          equippedFrame={frameId}
                        />
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cardTheme.badge}`}>
                            {cardTheme.title}
                          </span>
                          <span className="font-extrabold text-sm text-white truncate">
                            {item.displayName}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>Cấp {item.level}</span>
                          {frameDef && (
                            <>
                              <span>•</span>
                              <span className="text-amber-300 font-semibold flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-amber-400" />
                                <span>Thưởng: {frameDef.name}</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center sm:flex-col sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800 shrink-0">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                        XP Tuần
                      </span>
                      <div className="flex items-center gap-1 font-black text-amber-400 text-sm sm:text-base">
                        <Zap className="w-4 h-4 fill-amber-400" />
                        <span>{item.score.toLocaleString()} XP</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
