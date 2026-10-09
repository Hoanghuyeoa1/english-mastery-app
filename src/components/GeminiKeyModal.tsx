import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Key, 
  X, 
  ShieldCheck, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle,
  Trash2,
  Sparkles
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { testGeminiApiKey } from '../services/geminiService';

interface GeminiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GeminiKeyModal: React.FC<GeminiKeyModalProps> = ({ isOpen, onClose }) => {
  const { geminiApiKey, setGeminiApiKey } = useAppStore();

  const [tempApiKey, setTempApiKey] = useState(geminiApiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveToast, setSaveToast] = useState(false);

  // Đồng bộ giá trị khi mở modal
  useEffect(() => {
    if (isOpen) {
      setTempApiKey(geminiApiKey || '');
      setTestResult(null);
      setShowKey(false);
      setSaveToast(false);
    }
  }, [isOpen, geminiApiKey]);

  useEffect(() => {
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

  const handleTestConnection = async () => {
    const trimmed = tempApiKey.trim();
    if (!trimmed) {
      setTestResult({
        success: false,
        message: 'Vui lòng nhập API Key trước khi kiểm tra kết nối.',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testGeminiApiKey(trimmed);
      setTestResult({
        success: res.success,
        message: res.message || (res.success ? 'Kết nối thành công!' : 'Kết nối thất bại.'),
      });
    } catch {
      setTestResult({
        success: false,
        message: 'Lỗi không xác định khi kết nối tới máy chủ Google Gemini.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const trimmed = tempApiKey.trim();
    setGeminiApiKey(trimmed);
    setSaveToast(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleClearKey = () => {
    setGeminiApiKey('');
    setTempApiKey('');
    setTestResult(null);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn motion-reduce:animate-none">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gemini-key-modal-title"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-100 relative max-h-[90vh] overflow-y-auto no-scrollbar motion-reduce:transform-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-sm shrink-0">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 id="gemini-key-modal-title" className="text-lg font-black text-white flex items-center gap-2">
                  <span>Cài Đặt Google Gemini API Key</span>
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                </h3>
                <p className="text-xs text-slate-400">Kết nối AI thế hệ mới để phản hồi hội thoại & dịch thuật thời gian thực</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              title="Đóng"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Security & Free Key Guide Banner */}
          <div className="p-4 bg-slate-850 border border-slate-800 rounded-2xl space-y-2.5 text-xs text-slate-300">
            <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>Bảo Mật Cục Bộ 100%</span>
            </div>
            <p className="leading-relaxed">
              API Key của bạn chỉ được lưu trữ an toàn trong <strong>LocalStorage</strong> trên thiết bị cá nhân và gửi trực tiếp tới máy chủ Google AI. Tuyệt đối không qua bất kỳ máy chủ trung gian nào.
            </p>
            <div className="pt-1 border-t border-slate-800/80">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-2 transition-colors"
              >
                <span>Lấy API key miễn phí tại Google AI Studio</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* API Key Form */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300">Nhập Gemini API Key:</label>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !tempApiKey.trim()}
                className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 disabled:opacity-40 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20"
              >
                {isTesting ? (
                  <>
                    <RotateCcw className="w-3 h-3 animate-spin text-cyan-400" />
                    <span>Đang kiểm tra...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3 h-3" />
                    <span>Kiểm tra kết nối</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={tempApiKey}
                onChange={(e) => {
                  setTempApiKey(e.target.value);
                  if (testResult) setTestResult(null);
                }}
                placeholder="AIzaSy..."
                className="w-full bg-slate-950 border border-slate-750 focus:border-cyan-500 rounded-2xl px-4 py-3 pr-11 text-sm text-white placeholder-slate-600 focus:outline-none font-mono tracking-wide transition-all"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                title={showKey ? 'Ẩn API Key' : 'Hiện API Key'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Test Result Message Banner */}
            {testResult && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-2xl text-xs flex items-start gap-2.5 border leading-relaxed ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </motion.div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-slate-800">
            {/* Delete button (if key exists) */}
            {geminiApiKey ? (
              <button
                type="button"
                onClick={handleClearKey}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-colors duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa Khóa</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 sm:flex-initial px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-black rounded-xl text-xs sm:text-sm shadow-lg shadow-cyan-500/20 transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 flex items-center justify-center gap-1.5"
              >
                {saveToast ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Đã lưu!</span>
                  </>
                ) : (
                  <span>Lưu Khóa API</span>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
