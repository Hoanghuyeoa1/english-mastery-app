import React, { useState } from 'react';
import { Download, CheckCircle2 } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';

interface PWAInstallButtonProps {
  className?: string;
  compact?: boolean;
  showText?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  compact = false,
  showText = true,
}) => {
  const { isInstallable, installApp } = usePWA();
  const [isInstalling, setIsInstalling] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  if (!isInstallable && !installedSuccess) {
    return null;
  }

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      const accepted = await installApp();
      if (accepted) {
        setInstalledSuccess(true);
        setTimeout(() => setInstalledSuccess(false), 3000);
      }
    } finally {
      setIsInstalling(false);
    }
  };

  if (installedSuccess) {
    return (
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs sm:text-sm font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 ${className}`}>
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        {showText && <span>Đã cài đặt</span>}
      </div>
    );
  }

  return (
    <button
      onClick={handleInstall}
      disabled={isInstalling}
      title="Cài đặt English Mastery Hub làm ứng dụng PWA trên máy tính / điện thoại"
      className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-2xl text-xs sm:text-sm font-bold border transition-all bg-gradient-to-r from-emerald-600/20 to-teal-600/20 hover:from-emerald-600/30 hover:to-teal-600/30 border-emerald-500/40 text-emerald-300 hover:text-emerald-200 active:scale-95 shadow-sm shadow-emerald-500/10 ${className}`}
    >
      <Download className={`w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-400 ${isInstalling ? 'animate-bounce' : ''}`} />
      {!compact && showText && (
        <span className="font-semibold tracking-wide">Cài đặt ứng dụng</span>
      )}
    </button>
  );
};
