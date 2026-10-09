// src/components/SRSAnalyticsModal.tsx
// Modal hiển thị bảng điều khiển phân tích SRS toàn diện (SRSAnalyticsPanel).
// Kết nối với retention chart, phân bổ rating và khuyến nghị Target Retention.

import React from 'react';
import { X, BarChart3 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { SRSAnalyticsPanel } from './SRSAnalyticsPanel';

export interface SRSAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SRSAnalyticsModal: React.FC<SRSAnalyticsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { dailyHistory, recentReviewEvents, fsrsSettings } = useAppStore();

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn motion-reduce:animate-none"
    >
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="analytics-modal-title"
        className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scaleIn motion-reduce:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="analytics-modal-title" className="text-lg font-black text-white">
                Phân Tích Thích Ứng SRS (Adaptive Analytics)
              </h2>
              <p className="text-xs text-slate-400">
                Theo dõi hiệu quả ghi nhớ thực tế (Actual vs Target Retention) và phân bổ đánh giá.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            aria-label="Đóng bảng phân tích"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto no-scrollbar space-y-6">
          <SRSAnalyticsPanel
            dailyHistory={dailyHistory}
            history={recentReviewEvents || []}
            desiredRetention={fsrsSettings?.desiredRetention ?? 0.90}
          />
        </div>
      </div>
    </div>
  );
};
