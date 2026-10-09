import React, { useState } from 'react';
import {
  LogOut,
  User as UserIcon,
  X,
  AlertCircle,
  CheckCircle2,
  WifiOff,
} from 'lucide-react';
import {
  useCloudSyncStore,
  signOutCloud,
} from '../services/cloudSyncService';
import { useAppStore } from '../store/useAppStore';
import { AuthForm } from './auth/AuthForm';

interface AuthSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthSyncModal: React.FC<AuthSyncModalProps> = ({ isOpen, onClose }) => {
  const { user, userEmail, isOnline } = useCloudSyncStore();
  const { profile, srsProgressMap, dailyHistory } = useAppStore();

  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const totalSrsWords = Object.values(srsProgressMap || {}).filter(
    (s) => (s.srsLevel && s.srsLevel > 0) || (s.interval && s.interval > 0) || s.lastReviewedDate
  ).length;

  const totalDaysLogged = Object.keys(dailyHistory || {}).length;

  const handleSignOut = async () => {
    if (window.confirm('Bạn có chắc chắn muốn đăng xuất tài khoản? (Tiến độ học tập hiện tại vẫn được lưu an toàn trên máy này)')) {
      setIsLoading(true);
      await signOutCloud();
      setIsLoading(false);
      setFeedback(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900/95 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-950/40 text-slate-100 overflow-hidden">
        
        {/* Glow ambient decoration */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-full transition-colors"
          title="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-2xl text-emerald-400 shadow-inner">
            <UserIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Tài khoản học viên</span>
            </h3>
            <p className="text-xs text-slate-400">
              Đăng nhập để tham gia bảng xếp hạng và lưu danh thành tích học tập
            </p>
          </div>
        </div>

        {/* Feedback Alert for Modal Actions (Signout / Errors) */}
        {feedback && (
          <div
            className={`mb-5 p-3.5 rounded-2xl text-xs font-semibold flex items-start gap-2.5 border ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Offline Warning */}
        {!isOnline && (
          <div className="mb-5 p-3.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-2xl text-xs font-medium flex items-center gap-2.5">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Đang offline. Ứng dụng tự động lưu vào LocalStorage và sẽ đồng bộ khi có mạng.</span>
          </div>
        )}

        {/* LOGGED IN STATE */}
        {user ? (
          <div className="space-y-6">
            {/* Account Card */}
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold text-sm">
                    {(userEmail || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{userEmail}</div>
                    <div className="text-[11px] text-slate-400">ID: {user.id.slice(0, 8)}...</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-slate-900 border-emerald-500/30 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Đã đăng nhập</span>
                </div>
              </div>

              {/* Data Summary Pill Grid */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center">
                <div className="p-2 bg-slate-900/80 rounded-xl">
                  <div className="text-xs text-slate-400 font-medium">Level / XP</div>
                  <div className="text-sm font-black text-amber-400">
                    Cấp {profile.level} • {profile.xp} XP
                  </div>
                </div>
                <div className="p-2 bg-slate-900/80 rounded-xl">
                  <div className="text-xs text-slate-400 font-medium">SRS Tiến độ</div>
                  <div className="text-sm font-black text-emerald-400">
                    {totalSrsWords} từ vựng
                  </div>
                </div>
                <div className="p-2 bg-slate-900/80 rounded-xl">
                  <div className="text-xs text-slate-400 font-medium">Chuỗi Streak</div>
                  <div className="text-sm font-black text-orange-400">
                    {profile.streak} ngày 🔥
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 text-left">
                <span>Nhật ký học: {totalDaysLogged} ngày hoạt động</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-rose-400 font-bold rounded-2xl transition-all border border-slate-700/80 flex items-center justify-center gap-2 text-sm"
              >
                <LogOut className="w-4 h-4" />
                <span>Đăng xuất tài khoản</span>
              </button>
            </div>
          </div>
        ) : (
          /* GUEST / AUTHENTICATION STATE: Reusing AuthForm */
          <AuthForm includeConfirmPassword={false} />
        )}
      </div>
    </div>
  );
};

export default AuthSyncModal;
