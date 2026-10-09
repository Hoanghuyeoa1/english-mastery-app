import React, { useRef, useState } from 'react';
import { 
  X, 
  Download, 
  Upload, 
  Copy, 
  Check, 
  RotateCcw, 
  ShieldCheck 
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { FourSkillsScores } from '../types';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose }) => {
  const { 
    exportBackupData, 
    importBackupData, 
    resetToDefault, 
    profile,
    fourSkillsScores,
    hasLearnedNightOwl,
    setFourSkillsScores,
    setHasLearnedNightOwl 
  } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);

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

  // Helper đảm bảo schema object xuất ra đầy đủ các trường mới nhất
  const getPreparedBackupJson = (): string => {
    let jsonStr = exportBackupData();
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed.fourSkillsScores) {
        parsed.fourSkillsScores = fourSkillsScores;
      }
      if (parsed.hasLearnedNightOwl === undefined) {
        parsed.hasLearnedNightOwl = hasLearnedNightOwl;
      }
      jsonStr = JSON.stringify(parsed, null, 2);
    } catch (e) {
      console.warn('[BackupModal] Error preparing backup json schema:', e);
    }
    return jsonStr;
  };

  const handleExportDownload = () => {
    const jsonStr = getPreparedBackupJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EnglishMastery_${profile.name || 'User'}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setStatusMsg({ text: 'Đã xuất file sao lưu JSON thành công!', isError: false });
  };

  const handleCopyClipboard = () => {
    const jsonStr = getPreparedBackupJson();
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        const parsed = JSON.parse(content);
        if (!parsed || typeof parsed !== 'object') {
          setStatusMsg({ text: 'File không đúng định dạng JSON hợp lệ.', isError: true });
          return;
        }

        // Validate cấu trúc cơ bản của file backup
        if (!parsed.profile && !parsed.vocabularyList && !parsed.srsProgressMap && !parsed.userCustomWords) {
          setStatusMsg({ text: 'File JSON không phải bản sao lưu hợp lệ của ứng dụng.', isError: true });
          return;
        }

        // Fallback an toàn cho fourSkillsScores nếu backup là bản cũ
        const fallbackSkills: FourSkillsScores = {
          listening: [],
          reading: [],
          speaking: [],
          writing: [],
        };

        const validatedSkills: FourSkillsScores = parsed.fourSkillsScores && typeof parsed.fourSkillsScores === 'object'
          ? {
              listening: Array.isArray(parsed.fourSkillsScores.listening)
                ? parsed.fourSkillsScores.listening.filter((n: unknown): n is number => typeof n === 'number' && !isNaN(n)).slice(-50)
                : [],
              reading: Array.isArray(parsed.fourSkillsScores.reading)
                ? parsed.fourSkillsScores.reading.filter((n: unknown): n is number => typeof n === 'number' && !isNaN(n)).slice(-50)
                : [],
              speaking: Array.isArray(parsed.fourSkillsScores.speaking)
                ? parsed.fourSkillsScores.speaking.filter((n: unknown): n is number => typeof n === 'number' && !isNaN(n)).slice(-50)
                : [],
              writing: Array.isArray(parsed.fourSkillsScores.writing)
                ? parsed.fourSkillsScores.writing.filter((n: unknown): n is number => typeof n === 'number' && !isNaN(n)).slice(-50)
                : [],
            }
          : fallbackSkills;

        // Fallback an toàn cho hasLearnedNightOwl
        const validatedNightOwl: boolean = Boolean(parsed.hasLearnedNightOwl);

        // Nạp vào store qua importBackupData
        const res = importBackupData(content);

        if (res.success) {
          // Ghi nhận trực tiếp fourSkillsScores và hasLearnedNightOwl vào store
          setFourSkillsScores(validatedSkills);
          setHasLearnedNightOwl(validatedNightOwl);
        }

        setStatusMsg({ text: res.message, isError: !res.success });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'File JSON không hợp lệ';
        setStatusMsg({ text: `Lỗi đọc file: ${msg}`, isError: true });
      }
    };
    reader.readAsText(file);
    // Reset file input để có thể chọn lại cùng file
    e.target.value = '';
  };

  const handleReset = () => {
    if (confirm('CẢNH BÁO: Hành động này sẽ đặt lại dữ liệu học tập về mặc định ban đầu. Bạn có muốn tiếp tục?')) {
      resetToDefault();
      setStatusMsg({ text: 'Đã khôi phục toàn bộ dữ liệu về mặc định!', isError: false });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn motion-reduce:animate-none">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-modal-title"
        className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 animate-scaleIn motion-reduce:animate-none"
      >
        
        <div className="flex justify-between items-center pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 id="backup-modal-title" className="text-xl font-bold text-white">Sao Lưu & Khôi Phục Dữ Liệu</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs sm:text-sm text-slate-400">
          Toàn bộ tiến độ học của <strong>{profile.name || 'bạn'}</strong> (từ vựng, XP, Daily Streak, lịch sử ôn tập SRS) được lưu trữ trực tiếp trong trình duyệt. Hãy sao lưu định kỳ để tránh mất mát khi dọn dẹp bộ nhớ cache.
        </p>

        {/* Status alert message */}
        {statusMsg && (
          <div className={`p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 ${
            statusMsg.isError 
              ? 'bg-red-500/10 border border-red-500/20 text-red-400' 
              : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
          }`}>
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div className="space-y-3">
          
          {/* Export JSON Download */}
          <div className="p-4 bg-slate-850 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-sm font-bold text-white flex items-center gap-1.5">
                <Download className="w-4 h-4 text-emerald-400" />
                Xuất file sao lưu (JSON)
              </span>
              <p className="text-xs text-slate-400">Tải file .json lưu về máy tính/điện thoại</p>
            </div>
            <button
              onClick={handleExportDownload}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none shadow-md shadow-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              Tải về
            </button>
          </div>

          {/* Copy JSON to Clipboard */}
          <div className="p-4 bg-slate-850 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-sm font-bold text-white flex items-center gap-1.5">
                <Copy className="w-4 h-4 text-cyan-400" />
                Sao chép dữ liệu JSON
              </span>
              <p className="text-xs text-slate-400">Copy toàn bộ chuỗi JSON vào Clipboard</p>
            </div>
            <button
              onClick={handleCopyClipboard}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
              <span>{copied ? 'Đã sao chép!' : 'Copy'}</span>
            </button>
          </div>

          {/* Import JSON file */}
          <div className="p-4 bg-slate-850 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-sm font-bold text-white flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-amber-400" />
                Khôi phục từ file JSON
              </span>
              <p className="text-xs text-slate-400">Nạp lại tiến độ học từ file đã sao lưu trước đó</p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none shadow-md shadow-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              Chọn file
            </button>
          </div>

        </div>

        {/* Danger Zone: Reset */}
        <div className="pt-4 border-t border-slate-800/80 flex justify-between items-center">
          <button
            onClick={handleReset}
            className="text-xs text-red-400/80 hover:text-red-400 flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Khôi phục về cài đặt gốc</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
