import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Target, Check, Info } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface DailySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DailySettingsModal: React.FC<DailySettingsModalProps> = ({ isOpen, onClose }) => {
  const { profile, setDailyNewWordsLimit } = useAppStore();
  const currentLimit = profile.targetDailyNewWords || 15;
  const [selectedLimit, setSelectedLimit] = useState<number>(currentLimit);
  const [customValue, setCustomValue] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(![10, 15, 20, 30].includes(currentLimit));

  const PRESET_LIMITS = [
    { value: 10, label: '10 từ/ngày', desc: 'Thong thả, bền bỉ', icon: '🌱' },
    { value: 15, label: '15 từ/ngày', desc: 'Chuẩn khuyến nghị (Tối ưu)', icon: '⭐', isRecommended: true },
    { value: 20, label: '20 từ/ngày', desc: 'Tập trung cao độ', icon: '🚀' },
    { value: 30, label: '30 từ/ngày', desc: 'Cấp tốc & đột phá', icon: '⚡' },
  ];

  const handleSave = () => {
    let limitToSave = selectedLimit;
    if (isCustom) {
      const parsed = parseInt(customValue, 10);
      if (!isNaN(parsed) && parsed >= 5 && parsed <= 100) {
        limitToSave = parsed;
      } else {
        limitToSave = 15;
      }
    }
    setDailyNewWordsLimit(limitToSave);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 overflow-hidden"
        >
          {/* Background Glow */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Mục Tiêu Từ Mới Hàng Ngày</h3>
                <p className="text-xs text-slate-400">Thiết lập số lượng từ mới nạp vào mỗi ngày theo SRS</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Explanation banner */}
          <div className="p-3.5 bg-slate-850/80 border border-slate-800 rounded-2xl flex items-start gap-3 text-xs text-slate-300">
            <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Theo nguyên lý <strong>Spaced Repetition (SRS)</strong>, học đều đặn từ <strong>10 – 20 từ mới mỗi ngày</strong> kết hợp ôn tập đúng hạn sẽ giúp từ vựng ghi sâu vào trí nhớ dài hạn (Long-term Memory) mà không bị quá tải.
            </span>
          </div>

          {/* Preset Selection Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PRESET_LIMITS.map((preset) => {
              const isSelected = !isCustom && selectedLimit === preset.value;
              return (
                <div
                  key={preset.value}
                  onClick={() => {
                    setSelectedLimit(preset.value);
                    setIsCustom(false);
                  }}
                  className={`cursor-pointer relative p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-500/80 shadow-lg shadow-emerald-500/10'
                      : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800'
                  }`}
                >
                  {preset.isRecommended && (
                    <span className="absolute -top-2.5 right-3 px-2 py-0.5 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-[10px] rounded-full uppercase tracking-wider shadow">
                      Đề xuất
                    </span>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{preset.icon}</span>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  <div className="mt-3">
                    <h4 className="font-bold text-white text-sm">{preset.label}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">{preset.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom Input */}
          <div className="pt-2">
            <div
              onClick={() => setIsCustom(true)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                isCustom
                  ? 'bg-emerald-500/15 border-emerald-500/80'
                  : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-200">Tự nhập số từ mới/ngày:</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="5"
                  max="100"
                  placeholder={String(selectedLimit)}
                  value={isCustom ? customValue : ''}
                  onFocus={() => setIsCustom(true)}
                  onChange={(e) => {
                    setIsCustom(true);
                    setCustomValue(e.target.value);
                  }}
                  className="w-20 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-center text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                />
                <span className="text-xs text-slate-400">từ</span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-400 hover:text-white transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
            >
              Lưu Thiết Lập
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
