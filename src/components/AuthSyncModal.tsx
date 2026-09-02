import React, { useState } from 'react';
import {
  Cloud,
  CloudCheck,
  CloudUpload,
  RefreshCw,
  LogOut,
  Mail,
  Lock,
  User as UserIcon,
  X,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  WifiOff,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  useCloudSyncStore,
  signInWithEmail,
  signUpWithEmail,
  signInWithOtp,
  signOutCloud,
  performFullSync,
} from '../services/cloudSyncService';
import { useAppStore } from '../store/useAppStore';

interface AuthSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthSyncModal: React.FC<AuthSyncModalProps> = ({ isOpen, onClose }) => {
  const { user, userEmail, status, lastSyncedAt, isOnline, errorMessage } = useCloudSyncStore();
  const { profile, srsProgressMap, dailyHistory } = useAppStore();

  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'magic'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(profile.name || '');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const totalSrsWords = Object.values(srsProgressMap || {}).filter(
    (s) => (s.srsLevel && s.srsLevel > 0) || (s.interval && s.interval > 0) || s.lastReviewedDate
  ).length;

  const totalDaysLogged = Object.keys(dailyHistory || {}).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsLoading(true);

    try {
      if (authMode === 'signin') {
        const { error } = await signInWithEmail(email.trim(), password);
        if (error) throw error;
        setFeedback({ type: 'success', message: 'Đăng nhập thành công! Đang đồng bộ tiến độ...' });
        setTimeout(() => {
          setFeedback(null);
        }, 1500);
      } else if (authMode === 'signup') {
        const { error } = await signUpWithEmail(email.trim(), password, displayName.trim());
        if (error) throw error;
        setFeedback({
          type: 'success',
          message: 'Đăng ký thành công! Vui lòng kiểm tra email xác nhận (nếu được yêu cầu) hoặc bắt đầu học ngay.',
        });
      } else if (authMode === 'magic') {
        const { error } = await signInWithOtp(email.trim());
        if (error) throw error;
        setFeedback({
          type: 'success',
          message: 'Liên kết đăng nhập Magic Link đã được gửi đến email của bạn!',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đã có lỗi xảy ra';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSync = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const res = await performFullSync();
      if (res.success) {
        setFeedback({ type: 'success', message: 'Dữ liệu đã được đồng bộ 2 chiều an toàn với Cloud!' });
        setTimeout(() => setFeedback(null), 3000);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Lỗi đồng bộ' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi đồng bộ';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (window.confirm('Bạn có chắc chắn muốn đăng xuất tài khoản Cloud? (Tiến độ học tập hiện tại vẫn được lưu an toàn tại LocalStorage máy này)')) {
      setIsLoading(true);
      await signOutCloud();
      setIsLoading(false);
      setFeedback(null);
    }
  };

  const formattedLastSync = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Chưa có';

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
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Cloud Sync Supabase</span>
              <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-bold rounded-full border border-emerald-500/30">
                Dual-layer
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Lưu trữ song song LocalStorage + Cloud bảo vệ tiến độ học tập tuyệt đối
            </p>
          </div>
        </div>

        {/* Feedback Alert */}
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

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-slate-900">
                  {status === 'synced' && (
                    <>
                      <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Đã đồng bộ</span>
                    </>
                  )}
                  {status === 'syncing' && (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                      <span className="text-amber-400">Đang lưu...</span>
                    </>
                  )}
                  {status === 'error' && (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span className="text-rose-400">Lỗi lưu</span>
                    </>
                  )}
                  {status === 'offline' && (
                    <>
                      <WifiOff className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-400">Offline</span>
                    </>
                  )}
                  {status === 'idle' && (
                    <>
                      <Cloud className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-cyan-400">Sẵn sàng</span>
                    </>
                  )}
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

              <div className="text-[11px] text-slate-500 text-right flex items-center justify-between">
                <span>Nhật ký học: {totalDaysLogged} ngày</span>
                <span>Lần đồng bộ cuối: {formattedLastSync}</span>
              </div>
            </div>

            {/* Sync Now / Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleManualSync}
                disabled={isLoading || !isOnline}
                className="flex-1 py-3 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Đang đồng bộ...' : 'Đồng bộ ngay (Sync Now)'}</span>
              </button>

              <button
                onClick={handleSignOut}
                disabled={isLoading}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-rose-400 font-bold rounded-2xl transition-all border border-slate-750 flex items-center justify-center gap-2 text-sm"
              >
                <LogOut className="w-4 h-4" />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        ) : (
          /* GUEST / AUTHENTICATION STATE */
          <div className="space-y-5">
            {/* Tabs */}
            <div className="flex p-1 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setAuthMode('signin')}
                className={`flex-1 py-2 rounded-xl transition-all ${
                  authMode === 'signin'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('signup')}
                className={`flex-1 py-2 rounded-xl transition-all ${
                  authMode === 'signup'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Tạo tài khoản
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('magic')}
                className={`flex-1 py-2 rounded-xl transition-all ${
                  authMode === 'magic'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Magic Link
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tên hiển thị
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Ví dụ: Hoàng Anh"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                    required
                  />
                </div>
              </div>

              {authMode !== 'magic' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Mật khẩu</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-extrabold rounded-2xl transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 text-sm mt-2"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 fill-slate-950" />
                )}
                <span>
                  {authMode === 'signin'
                    ? 'Đăng nhập & Đồng bộ Cloud'
                    : authMode === 'signup'
                    ? 'Tạo tài khoản & Bắt đầu Sync'
                    : 'Gửi link đăng nhập tức thì'}
                </span>
              </button>
            </form>

            <div className="p-3.5 bg-slate-950/50 border border-slate-800/80 rounded-2xl flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-slate-400 leading-relaxed">
                <strong>Offline-First:</strong> Bạn có thể học bình thường không cần đăng nhập. Khi đăng nhập, hệ thống sẽ tự động ghép nối và bảo lưu tiến độ hiện tại lên máy chủ Supabase.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
