import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Sparkles, RefreshCw, X, HardDrive } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';
import { useCloudSyncStore } from '../services/cloudSyncService';

export const PWANotificationBanner: React.FC = () => {
  const { isOffline, needRefresh, updateServiceWorker, closePrompt } = usePWA();
  const { isOnline } = useCloudSyncStore();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await updateServiceWorker(true);
    } catch (err) {
      console.error('[PWA] Failed to update service worker:', err);
      setIsUpdating(false);
    }
  };

  return (
    <>
      {/* 1. CONNECTIVITY OFFLINE BANNER */}
      <AnimatePresence mode="wait">
        {(!isOnline || isOffline) && (
          <motion.div
            key="offline-banner"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 font-medium shadow-md border-b border-amber-400/40 relative z-50 overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2 font-semibold">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-950/20 text-slate-950">
                  <WifiOff className="w-3.5 h-3.5" />
                </span>
                <span>
                  Bạn đang học ngoại tuyến. Tiến độ được bảo lưu an toàn trên thiết bị.
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] bg-slate-950/20 px-2 py-0.5 rounded-full font-mono">
                <HardDrive className="w-3 h-3" />
                <span>Lưu an toàn trên thiết bị</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. NEW VERSION UPDATE TOAST / BANNER */}
      <AnimatePresence>
        {needRefresh && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-5 right-4 sm:right-6 max-w-sm sm:max-w-md w-[calc(100vw-2rem)] z-50 bg-slate-900/95 backdrop-blur-md border border-emerald-500/40 rounded-2xl shadow-2xl shadow-emerald-950/50 p-4 text-slate-100"
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>Phiên bản mới đã sẵn sàng!</span>
                  </h4>
                  <button
                    onClick={closePrompt}
                    title="Để sau"
                    className="text-slate-400 hover:text-slate-200 transition-colors p-1 -mr-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Ứng dụng có bản cập nhật mới giúp tăng hiệu năng, bổ sung tính năng và hoàn thiện bộ từ vựng.
                </p>

                <div className="flex items-center gap-2 mt-3 pt-1">
                  <button
                    onClick={handleUpdate}
                    disabled={isUpdating}
                    className="flex-1 py-1.5 px-3 bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/25"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                    <span>{isUpdating ? 'Đang cập nhật...' : 'Cập Nhật Ngay'}</span>
                  </button>

                  <button
                    onClick={closePrompt}
                    className="py-1.5 px-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold rounded-xl text-xs transition-all border border-slate-750"
                  >
                    Để Sau
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
