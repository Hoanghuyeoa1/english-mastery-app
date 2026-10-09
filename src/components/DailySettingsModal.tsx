import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Target, Check, Info, Brain, Sparkles, AlertTriangle, Calendar } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { SRSAlgorithmType } from '../types';
import { 
  forecastSRSWorkload, 
  estimateRetentionWorkloadImpact, 
  extractCardDueReferences 
} from '../services/srsWorkloadForecast';

interface DailySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DailySettingsModal: React.FC<DailySettingsModalProps> = ({ isOpen, onClose }) => {
  const { 
    profile, 
    setDailyNewWordsLimit,
    srsAlgorithm,
    fsrsSettings,
    srsProgressMap,
    setSRSAlgorithm,
    setFSRSSettings
  } = useAppStore();

  const currentLimit = profile.targetDailyNewWords || 15;
  const [selectedLimit, setSelectedLimit] = useState<number>(currentLimit);
  const [customValue, setCustomValue] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(![10, 15, 20, 30].includes(currentLimit));

  // State cho Thuật toán SRS và Retention
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<SRSAlgorithmType>(srsAlgorithm || 'fsrs');
  const [selectedRetention, setSelectedRetention] = useState<number>(
    Math.round((fsrsSettings?.desiredRetention || 0.9) * 100)
  );

  // Pure Workload Forecast & Candidate Retention Impact (Zero state mutations)
  const cardDueRefs = useMemo(() => {
    return extractCardDueReferences(srsProgressMap);
  }, [srsProgressMap]);

  const workloadForecast = useMemo(() => {
    return forecastSRSWorkload(cardDueRefs, 7);
  }, [cardDueRefs]);

  const currentDesiredRetention = fsrsSettings?.desiredRetention || 0.90;
  const candidateRetention = selectedRetention / 100;

  const workloadImpact = useMemo(() => {
    return estimateRetentionWorkloadImpact(
      currentDesiredRetention,
      candidateRetention,
      workloadForecast.next7Days
    );
  }, [currentDesiredRetention, candidateRetention, workloadForecast.next7Days]);

  const PRESET_LIMITS = [
    { value: 10, label: '10 từ/ngày', desc: 'Thong thả, bền bỉ', icon: '🌱' },
    { value: 15, label: '15 từ/ngày', desc: 'Chuẩn khuyến nghị (Tối ưu)', icon: '⭐', isRecommended: true },
    { value: 20, label: '20 từ/ngày', desc: 'Tập trung cao độ', icon: '🚀' },
    { value: 30, label: '30 từ/ngày', desc: 'Cấp tốc & đột phá', icon: '⚡' },
  ];

  const getRetentionInfo = (val: number) => {
    if (val < 80) {
      return {
        icon: '🍃',
        title: 'Mức độ thong thả (70% - 79%)',
        titleColor: 'text-cyan-400',
        colorClass: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
        text: 'Khoảng cách giữa các lượt ôn tập rất dài, giảm đáng kể gánh nặng bài tập hàng ngày nhưng xác suất quên từ cao hơn.',
      };
    }
    if (val < 88) {
      return {
        icon: '⚖️',
        title: 'Mức độ cân bằng nhẹ (80% - 87%)',
        titleColor: 'text-teal-400',
        colorClass: 'text-teal-400 bg-teal-500/15 border-teal-500/30',
        text: 'Giữ tần suất ôn tập ở mức dễ chịu, phù hợp cho người học có quỹ thời gian vừa phải.',
      };
    }
    if (val <= 92) {
      return {
        icon: '⭐',
        title: 'Mức độ tối ưu khuyến nghị (88% - 92%)',
        titleColor: 'text-emerald-400',
        colorClass: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40',
        text: 'Điểm cân bằng vàng giữa hiệu quả ghi nhớ và khối lượng ôn tập theo các nghiên cứu khoa học nhận thức.',
      };
    }
    if (val <= 95) {
      return {
        icon: '🔥',
        title: 'Mức độ khắt khe (93% - 95%)',
        titleColor: 'text-amber-400',
        colorClass: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
        text: 'Tần suất ôn tập tăng ~50% so với mức 90%. Chu kỳ ôn dày hơn để đảm bảo xác suất quên cực thấp.',
      };
    }
    return {
      icon: '⚡',
      title: 'Mức độ cực kỳ khắt khe (96% - 97%)',
      titleColor: 'text-rose-400',
      colorClass: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
      text: 'Số lượng bài ôn tập hàng ngày sẽ tăng gấp đôi. Chỉ khuyến nghị khi chuẩn bị thi cử cấp tốc trong thời gian ngắn.',
    };
  };

  const retentionInfo = getRetentionInfo(selectedRetention);

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
    setSRSAlgorithm(selectedAlgorithm);
    if (selectedAlgorithm === 'fsrs') {
      setFSRSSettings({ desiredRetention: selectedRetention / 100 });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-settings-modal-title"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 overflow-hidden max-h-[90vh] overflow-y-auto"
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
                <h3 id="daily-settings-modal-title" className="text-xl font-black text-white">Thiết Lập Học Tập & SRS</h3>
                <p className="text-xs text-slate-400">Điều chỉnh mục tiêu từ mới và cấu hình thuật toán lặp lại ngắt quãng</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Section 1: Daily New Words Limit */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Mục Tiêu Từ Mới Hàng Ngày
              </h4>
              <span className="text-xs text-slate-400 font-mono">
                {isCustom ? `${customValue || selectedLimit} từ/ngày` : `${selectedLimit} từ/ngày`}
              </span>
            </div>

            {/* Explanation banner */}
            <div className="p-3 bg-slate-850/80 border border-slate-800 rounded-2xl flex items-start gap-2.5 text-xs text-slate-300">
              <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Học đều đặn <strong>10 – 20 từ mới mỗi ngày</strong> kết hợp ôn tập đúng hạn sẽ giúp từ vựng ghi sâu vào trí nhớ dài hạn mà không bị quá tải.
              </span>
            </div>

            {/* Preset Selection Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {PRESET_LIMITS.map((preset) => {
                const isSelected = !isCustom && selectedLimit === preset.value;
                return (
                  <div
                    key={preset.value}
                    onClick={() => {
                      setSelectedLimit(preset.value);
                      setIsCustom(false);
                    }}
                    className={`cursor-pointer relative p-3 rounded-2xl border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/80 shadow-md shadow-emerald-500/10'
                        : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl">{preset.icon}</span>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    <div className="mt-2">
                      <h5 className="font-bold text-white text-xs">{preset.label}</h5>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">{preset.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom Input */}
            <div
              onClick={() => setIsCustom(true)}
              className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                isCustom
                  ? 'bg-emerald-500/15 border-emerald-500/80'
                  : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
              }`}
            >
              <span className="text-xs font-semibold text-slate-200">Tùy chỉnh số lượng (5 - 100 từ):</span>
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
                  className="w-16 px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-xl text-center text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                />
                <span className="text-xs text-slate-400">từ/ngày</span>
              </div>
            </div>
          </div>

          {/* Section 2: SRS Algorithm Selector */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-teal-400" />
                Thuật Toán Lặp Lại Ngắt Quãng (SRS Engine)
              </h4>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                {selectedAlgorithm === 'fsrs' ? 'FSRS v4.5' : 'SuperMemo 2'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: FSRS-4.5 */}
              <div
                onClick={() => setSelectedAlgorithm('fsrs')}
                className={`cursor-pointer relative p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                  selectedAlgorithm === 'fsrs'
                    ? 'bg-gradient-to-br from-teal-500/15 via-emerald-500/10 to-slate-900 border-teal-500/80 shadow-lg shadow-teal-500/10 ring-1 ring-teal-500/40'
                    : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800'
                }`}
              >
                <span className="absolute -top-2.5 right-3 px-2 py-0.5 bg-gradient-to-r from-teal-400 to-emerald-400 text-slate-950 font-black text-[10px] rounded-full uppercase tracking-wider shadow">
                  Hiện đại • Khuyên dùng
                </span>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⚡</span>
                    <strong className="text-white text-sm font-bold">FSRS-4.5</strong>
                  </div>
                  {selectedAlgorithm === 'fsrs' && (
                    <div className="w-5 h-5 rounded-full bg-teal-400 text-slate-950 flex items-center justify-center">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-slate-300 mt-2.5 leading-relaxed">
                  Mô hình nhận thức toán học tiên tiến dựa trên Độ bền ($S$), Độ khó ($D$) và Xác suất nhớ ($R$). Tiết kiệm ~30% số lượt ôn tập mà vẫn duy trì mục tiêu ghi nhớ.
                </p>
              </div>

              {/* Option 2: SM-2 Classic */}
              <div
                onClick={() => setSelectedAlgorithm('sm2')}
                className={`cursor-pointer relative p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                  selectedAlgorithm === 'sm2'
                    ? 'bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-slate-900 border-emerald-500/80 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/40'
                    : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800'
                }`}
              >
                <span className="absolute -top-2.5 right-3 px-2 py-0.5 bg-slate-700 text-slate-300 font-bold text-[10px] rounded-full uppercase tracking-wider">
                  Cổ điển
                </span>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🧠</span>
                    <strong className="text-white text-sm font-bold">SuperMemo SM-2</strong>
                  </div>
                  {selectedAlgorithm === 'sm2' && (
                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
                  Thuật toán kinh điển phân bổ chu kỳ theo cấp số nhân và hệ số Ease Factor ($EF$). Đơn giản, ổn định, phổ biến từ năm 1987.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Desired Retention Slider (Only when FSRS is selected) */}
          <AnimatePresence>
            {selectedAlgorithm === 'fsrs' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 pt-3 border-t border-slate-800 overflow-hidden"
              >
                <div className="p-4 bg-slate-850/90 border border-slate-750 rounded-2xl space-y-3 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-teal-400" />
                        <h4 className="text-sm font-bold text-white">Mục Tiêu Ghi Nhớ (Desired Retention)</h4>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Xác suất bạn còn nhớ từ vựng tại thời điểm đến hạn ôn tập
                      </p>
                    </div>

                    <div className="text-right">
                      <span className={`px-2.5 py-1 rounded-xl font-mono font-black text-sm border ${retentionInfo.colorClass}`}>
                        {selectedRetention}%
                      </span>
                    </div>
                  </div>

                  {/* Range Slider (70% - 97%) */}
                  <div className="space-y-1.5">
                    <input
                      type="range"
                      min="70"
                      max="97"
                      step="1"
                      value={selectedRetention}
                      onChange={(e) => setSelectedRetention(parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-slate-400 px-0.5">
                      <span>70% (Thong thả)</span>
                      <span className="text-teal-400 font-bold">90% (Khuyến nghị)</span>
                      <span>97% (Khắt khe)</span>
                    </div>
                  </div>

                  {/* Dynamic Descriptive Banner */}
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-start gap-2.5 text-xs">
                    <span className="text-base shrink-0 mt-0.5">{retentionInfo.icon}</span>
                    <div>
                      <strong className={`block ${retentionInfo.titleColor}`}>
                        {retentionInfo.title}
                      </strong>
                      <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                        {retentionInfo.text}
                      </p>
                    </div>
                  </div>

                  {/* Workload Forecast & Retention Impact Simulation */}
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-teal-400" />
                        <span>Dự báo 7 ngày tới (gồm hôm nay):</span>
                      </span>
                      <span className="font-mono font-bold text-white">
                        {workloadForecast.next7Days} thẻ đến hạn
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-400 font-mono">
                      <span>Hôm nay: <strong className="text-emerald-400">{workloadForecast.today} thẻ</strong></span>
                      <span>Ngày mai: <strong className="text-cyan-400">{workloadForecast.tomorrow} thẻ</strong></span>
                      {selectedRetention !== Math.round(currentDesiredRetention * 100) && (
                        <span>
                          Dự kiến:{' '}
                          <strong className={
                            workloadImpact.impactLevel === 'high'
                              ? 'text-amber-400'
                              : workloadImpact.impactLevel === 'moderate'
                              ? 'text-cyan-400'
                              : 'text-teal-400'
                          }>
                            ~{workloadImpact.candidateEstimatedLoad} thẻ ({workloadImpact.percentChange >= 0 ? `+${workloadImpact.percentChange}%` : `${workloadImpact.percentChange}%`})
                          </strong>
                        </span>
                      )}
                    </div>

                    {/* 3-Tier Workload Impact Badge */}
                    {selectedRetention !== Math.round(currentDesiredRetention * 100) && (
                      <>
                        {workloadImpact.impactLevel === 'high' && (
                          <div className="mt-1 p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-start gap-2 text-xs text-amber-300">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <strong className="block font-bold text-amber-200">
                                Cảnh báo tải học tập tăng cao (+{workloadImpact.percentChange}%)
                              </strong>
                              <p className="text-[11px] text-amber-300/90 mt-0.5 leading-relaxed">
                                Mức mục tiêu {selectedRetention}% làm chu kỳ ôn tập ngắn lại đáng kể (+{workloadImpact.percentChange}% số thẻ cần ôn). Hãy chắc chắn bạn có đủ thời gian mỗi ngày để tránh dồn ứ thẻ quá hạn.
                              </p>
                            </div>
                          </div>
                        )}
                        {workloadImpact.impactLevel === 'moderate' && (
                          <div className="mt-1 p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center gap-2 text-[11px] text-cyan-300">
                            <span>⚖️</span>
                            <span>
                              Tải ôn tập tăng đáng kể (<strong>+{workloadImpact.percentChange}%</strong> thẻ đến hạn), chu kỳ ôn tập sẽ rút ngắn vừa phải.
                            </span>
                          </div>
                        )}
                        {workloadImpact.impactLevel === 'low' && workloadImpact.percentChange < 0 && (
                          <div className="mt-1 p-2 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center gap-2 text-[11px] text-teal-300">
                            <span>🍃</span>
                            <span>
                              Giảm <strong>{Math.abs(workloadImpact.percentChange)}%</strong> số thẻ đến hạn trong 7 ngày tới, khoảng cách ôn sẽ giãn dài hơn.
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-400 hover:text-white transition-colors duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-extrabold rounded-xl text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              Lưu Thiết Lập
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
