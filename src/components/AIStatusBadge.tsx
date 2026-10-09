import React from 'react';
import { Sparkles, Key } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface AIStatusBadgeProps {
  isFallback?: boolean;
  onOpenModal: () => void;
  className?: string;
}

export const AIStatusBadge: React.FC<AIStatusBadgeProps> = ({
  isFallback = false,
  onOpenModal,
  className = '',
}) => {
  const { geminiApiKey } = useAppStore();
  const hasValidKey = Boolean(geminiApiKey && geminiApiKey.trim().length > 10);
  const isLive = hasValidKey && !isFallback;

  return (
    <button
      type="button"
      onClick={onOpenModal}
      title={
        isLive
          ? 'Gemini Live: Đã kết nối API Key trực tiếp. Bấm để quản lý hoặc đổi khóa.'
          : 'Demo Mode: Đang sử dụng kịch bản mẫu dự phòng. Bấm để thêm Gemini API Key phản hồi thời gian thực.'
      }
      className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border shadow-sm cursor-pointer select-none active:scale-95 ${
        isLive
          ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:border-emerald-500/50 shadow-emerald-500/5'
          : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30 hover:border-amber-500/50 shadow-amber-500/5'
      } ${className}`}
    >
      {/* Status Dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        {isLive && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            isLive ? 'bg-emerald-400' : 'bg-amber-400'
          }`}
        />
      </span>

      {/* Label */}
      <div className="flex items-center gap-1.5">
        {isLive ? (
          <>
            <span className="font-extrabold tracking-wide">Gemini Live</span>
            <Sparkles className="w-3 h-3 text-emerald-400 opacity-80 group-hover:scale-110 transition-transform" />
          </>
        ) : (
          <>
            <span className="font-extrabold tracking-wide hidden sm:inline">Demo Mode (Kịch bản mẫu)</span>
            <span className="font-extrabold tracking-wide sm:hidden">Demo Mode</span>
            <Key className="w-3 h-3 text-amber-400 opacity-80 group-hover:rotate-12 transition-transform" />
          </>
        )}
      </div>
    </button>
  );
};
