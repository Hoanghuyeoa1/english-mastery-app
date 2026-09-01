import React, { useState } from 'react';
import { 
  User, 
  X, 
  Save, 
  Download, 
  Upload, 
  RotateCcw, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  Award, 
  Flame, 
  AlertTriangle,
  Crown,
  Zap,
  Shield
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAppStore } from '../store/useAppStore';
import { UserAvatar, UserRankBadge } from './UserProfileBadge';
import { getUserRankInfo } from '../utils/userRank';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBackup: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, onOpenBackup }) => {
  const { 
    profile, 
    setProfileName, 
    setDailyNewWordsLimit, 
    exportBackupData, 
    importBackupData, 
    resetToDefault 
  } = useAppStore();

  const [newName, setNewName] = useState(profile.name || '');
  const [dailyLimit, setDailyLimit] = useState(profile.targetDailyNewWords || 15);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const userRank = getUserRankInfo(profile.level);

  if (!isOpen) return null;

  // Lưu thay đổi hồ sơ
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setProfileName(newName.trim(), profile.targetGoal);
    setDailyNewWordsLimit(dailyLimit);

    setSaveStatus('Đã cập nhật thông tin hồ sơ thành công!');
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  // Tải file JSON sao lưu
  const handleExportJSON = () => {
    const jsonStr = exportBackupData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `english_mastery_backup_${profile.name || 'user'}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Đặt lại toàn bộ tiến trình
  const handleConfirmReset = () => {
    resetToDefault();
    setShowConfirmReset(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 overflow-hidden max-h-[90vh] overflow-y-auto no-scrollbar">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white">Hồ Sơ & Cài Đặt Cá Nhân</h2>
              <p className="text-xs text-slate-400">Quản lý tên hiển thị, cấp độ danh hiệu và sao lưu</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Summary Stats Card with Tier Styling */}
        <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-inner">
          <div className="flex items-center gap-4">
            <UserAvatar 
              name={profile.name || 'U'}
              level={profile.level}
              size="lg"
              showLevelBadge={true}
            />
            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`text-lg sm:text-xl font-black ${userRank.nameClass} ${userRank.nameDropShadow}`}>
                  {profile.name || 'Học viên'}
                </h3>
              </div>
              <div>
                <UserRankBadge level={profile.level} size="sm" />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 pt-0.5">
                <span className="text-emerald-400 font-bold">Cấp {profile.level}</span>
                <span>•</span>
                <span>{profile.xp} XP</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-center">
            <div className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-2xl text-xs font-bold shadow-sm">
              <Flame className="w-4 h-4 fill-orange-400/30" />
              <span>{profile.streak} ngày liên tục</span>
            </div>
          </div>
        </div>

        {/* 4-Tier Rank System Roadmap Card */}
        <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Hệ Thống Bậc Danh Hiệu VIP & Cấp Độ:</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Novice */}
            <div className={`p-2.5 rounded-xl border text-center transition-all ${
              userRank.tier === 'novice'
                ? 'bg-emerald-500/15 border-emerald-500/50 shadow-md scale-105 ring-1 ring-emerald-400'
                : 'bg-slate-900/60 border-slate-800/60 opacity-60'
            }`}>
              <Shield className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
              <div className="text-[11px] font-bold text-emerald-300">TÂN THỦ</div>
              <div className="text-[10px] text-slate-400 font-mono">Lv. 1 - 9</div>
            </div>

            {/* VIP Pro */}
            <div className={`p-2.5 rounded-xl border text-center transition-all ${
              userRank.tier === 'vip'
                ? 'bg-cyan-500/20 border-cyan-400/60 shadow-md scale-105 ring-1 ring-cyan-400'
                : 'bg-slate-900/60 border-slate-800/60 opacity-60'
            }`}>
              <Zap className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
              <div className="text-[11px] font-bold text-cyan-300">VIP PRO</div>
              <div className="text-[10px] text-slate-400 font-mono">Lv. 10 - 24</div>
            </div>

            {/* Master Pro */}
            <div className={`p-2.5 rounded-xl border text-center transition-all ${
              userRank.tier === 'master'
                ? 'bg-amber-500/20 border-yellow-300/80 shadow-md scale-105 ring-1 ring-yellow-400'
                : 'bg-slate-900/60 border-slate-800/60 opacity-60'
            }`}>
              <Crown className="w-4 h-4 text-amber-400 mx-auto mb-1" />
              <div className="text-[11px] font-bold text-amber-300">MASTER PRO</div>
              <div className="text-[10px] text-slate-400 font-mono">Lv. 25 - 49</div>
            </div>

            {/* Mythic Legend */}
            <div className={`p-2.5 rounded-xl border text-center transition-all ${
              userRank.tier === 'mythic'
                ? 'bg-rose-500/20 border-rose-400/80 shadow-md scale-105 ring-1 ring-rose-400'
                : 'bg-slate-900/60 border-slate-800/60 opacity-60'
            }`}>
              <Sparkles className="w-4 h-4 text-rose-400 mx-auto mb-1" />
              <div className="text-[10px] font-black text-rose-300">MYTHIC LEGEND</div>
              <div className="text-[10px] text-slate-400 font-mono">Lv. 50+</div>
            </div>
          </div>
        </div>

        {/* Edit Profile Form */}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
              Tên / Biệt danh hiển thị:
            </label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-2xl px-4 py-3 text-sm text-white font-semibold focus:outline-none transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
              Mục tiêu học từ mới mỗi ngày:
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[10, 15, 20, 30].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setDailyLimit(num)}
                  className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                    dailyLimit === num
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-md'
                      : 'bg-slate-950 hover:bg-slate-850 border-slate-800 text-slate-400'
                  }`}
                >
                  {num} từ/ngày
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Lưu Thay Đổi</span>
          </button>
        </form>

        {saveStatus && (
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
            <Check className="w-4 h-4" />
            <span>{saveStatus}</span>
          </div>
        )}

        {/* Data Portability & Reset Area */}
        <div className="space-y-3 pt-4 border-t border-slate-800">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Dữ liệu & Chuyển đổi thiết bị:
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              onClick={handleExportJSON}
              className="p-3 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-2xl text-left transition-all flex items-center gap-2.5 group"
            >
              <Download className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <div>
                <span className="text-xs font-bold text-white block">Xuất File JSON</span>
                <span className="text-[10px] text-slate-500">Tải bản sao lưu về máy</span>
              </div>
            </button>

            <button
              onClick={() => {
                onClose();
                onOpenBackup();
              }}
              className="p-3 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-2xl text-left transition-all flex items-center gap-2.5 group"
            >
              <Upload className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
              <div>
                <span className="text-xs font-bold text-white block">Nhập File JSON</span>
                <span className="text-[10px] text-slate-500">Khôi phục từ máy khác</span>
              </div>
            </button>
          </div>

          {/* Reset progress */}
          {!showConfirmReset ? (
            <button
              onClick={() => setShowConfirmReset(true)}
              className="w-full py-2.5 text-xs text-red-400 hover:text-red-300 font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại toàn bộ dữ liệu học tập (Reset)</span>
            </button>
          ) : (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-xs font-bold text-red-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Bạn có chắc chắn muốn xóa toàn bộ tiến trình học và bắt đầu lại?</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleConfirmReset}
                  className="flex-1 py-2 bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl text-xs transition-all"
                >
                  Xác nhận xóa
                </button>
                <button
                  onClick={() => setShowConfirmReset(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl text-xs transition-all"
                >
                  Hủy
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
