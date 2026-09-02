import React, { useMemo } from 'react';
import { X, Award, CheckCircle2, Lock } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { evaluateUserAchievements, SystemAchievement } from '../services/achievementService';

interface AchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({ isOpen, onClose }) => {
  const { profile, srsProgressMap, dailyHistory } = useAppStore();

  const achievements = useMemo(() => {
    return evaluateUserAchievements({
      profile,
      srsProgressMap,
      dailyHistory,
    });
  }, [profile, srsProgressMap, dailyHistory]);

  const unlockedCount = achievements.filter((a) => a.isUnlocked).length;
  const totalCount = achievements.length;
  const percent = Math.round((unlockedCount / totalCount) * 100);

  // Group achievements by category
  const categories = useMemo(() => {
    const groups: { name: string; icon: string; items: SystemAchievement[] }[] = [
      {
        name: 'Khởi Đầu & Chuyên Cần',
        icon: '🔥',
        items: achievements.filter((a) => a.category === 'streak'),
      },
      {
        name: 'Bậc Thầy Từ Vựng & SRS',
        icon: '📚',
        items: achievements.filter((a) => a.category === 'vocab'),
      },
      {
        name: 'Đột Phá 4 Kỹ Năng (CEFR)',
        icon: '🎯',
        items: achievements.filter((a) => a.category === 'skills'),
      },
    ];
    return groups;
  }, [achievements]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[88vh] overflow-y-auto flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <span>Huy Hiệu & Thành Tựu</span>
                <span className="text-xs px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full font-mono font-bold">
                  {unlockedCount} / {totalCount} ({percent}%)
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Chinh phục các mốc học tập để nhận danh hiệu vinh danh và tích lũy điểm thưởng XP
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Progress Bar */}
        <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-slate-300">Tổng tiến độ chinh phục danh hiệu</span>
            <span className="text-amber-400 font-mono">{unlockedCount} / {totalCount} danh hiệu</span>
          </div>
          <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Categories & Achievements List */}
        <div className="space-y-6 flex-1">
          {categories.map((cat) => (
            <div key={cat.name} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-black text-slate-200 border-b border-slate-800/80 pb-2">
                <span className="text-base">{cat.icon}</span>
                <span>{cat.name}</span>
                <span className="text-xs text-slate-500 font-normal font-mono">
                  ({cat.items.filter((i) => i.isUnlocked).length}/{cat.items.length})
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cat.items.map((ach) => {
                  const progressPercent = Math.min(
                    100,
                    Math.round((ach.progress / ach.target) * 100)
                  );

                  return (
                    <div
                      key={ach.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                        ach.isUnlocked
                          ? 'bg-gradient-to-br from-amber-500/15 via-slate-900 to-slate-950 border-amber-500/40 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800 opacity-75'
                      }`}
                    >
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${
                          ach.isUnlocked
                            ? 'bg-amber-500/20 border border-amber-500/30'
                            : 'bg-slate-900 border border-slate-800 grayscale'
                        }`}
                      >
                        {ach.icon}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs sm:text-sm font-black text-white truncate">
                            {ach.title}
                          </h4>
                          {ach.isUnlocked ? (
                            <span className="text-[9px] font-black px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full flex items-center gap-0.5 shrink-0">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>Đã mở</span>
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-slate-500 flex items-center gap-0.5 shrink-0">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Chưa mở</span>
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                          {ach.description}
                        </p>

                        {/* Progress Bar & Reward */}
                        <div className="pt-1 space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-mono">
                            <span className="text-slate-500">
                              {ach.progress} / {ach.target}
                            </span>
                            <span className="text-amber-400 font-bold">
                              +{ach.xpReward} XP
                            </span>
                          </div>
                          {!ach.isUnlocked && (
                            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
                              <div
                                className="bg-amber-500/70 h-full rounded-full transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
