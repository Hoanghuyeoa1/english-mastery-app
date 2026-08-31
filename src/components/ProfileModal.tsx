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
  AlertTriangle 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAppStore } from '../store/useAppStore';

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
              <p className="text-xs text-slate-400">Quản lý tên hiển thị, mục tiêu ngày và sao lưu tiến trình</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Summary Stats Card */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black text-xl shadow-md">
              {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <h3 className="text-base font-black text-white">{profile.name || 'Học viên'}</h3>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span className="text-emerald-400 font-bold">Cấp {profile.level}</span>
                <span>•</span>
                <span>{profile.xp} XP</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl text-xs font-bold">
            <Flame className="w-4 h-4" />
            <span>{profile.streak} ngày</span>
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
