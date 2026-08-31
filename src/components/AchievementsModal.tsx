import React from 'react';
import { X, Award, Flame, Brain, Star, Target, CheckCircle2, Lock } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface AchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({ isOpen, onClose }) => {
  const { achievements } = useAppStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto">
        
        <div className="flex justify-between items-center pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white">Huy Hiệu & Thành Tựu</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of achievements */}
        <div className="space-y-3">
          {achievements.map((ach) => {
            const isUnlocked = Boolean(ach.unlockedAt);
            const progressPercent = Math.min(100, Math.round((ach.progress / ach.target) * 100));

            return (
              <div 
                key={ach.id}
                className={`p-4 rounded-2xl border transition-all flex items-center gap-4 ${
                  isUnlocked 
                    ? 'bg-amber-500/10 border-amber-500/30' 
                    : 'bg-slate-850 border-slate-800 opacity-60'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                  isUnlocked ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-500'
                }`}>
                  {isUnlocked ? <Award className="w-6 h-6 text-amber-400" /> : <Lock className="w-5 h-5 text-slate-500" />}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-white">{ach.title}</h4>
                    {isUnlocked && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Đã mở khóa
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{ach.description}</p>
                  
                  {/* Progress bar if locked */}
                  {!isUnlocked && (
                    <div className="pt-1.5 space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>Tiến độ</span>
                        <span>{ach.progress} / {ach.target}</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-amber-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
