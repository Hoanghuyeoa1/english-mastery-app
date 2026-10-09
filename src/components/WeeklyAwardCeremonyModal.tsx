import React, { useEffect, useRef, useState } from 'react';
import { Crown, Medal, Sparkles, X, Check, ArrowRight } from 'lucide-react';
import { triggerCelebration } from '../utils/confettiPolicy';
import { LEADERBOARD_FRAMES, FrameId } from '../services/frameRewardService';
import { WeeklyCeremonyData } from '../services/weeklyCeremonyService';
import { UserAvatar } from './UserProfileBadge';

interface WeeklyAwardCeremonyModalProps {
  ceremony: WeeklyCeremonyData | null;
  isOpen: boolean;
  onClose: () => void;
  onEquip: (frameId: FrameId) => Promise<void>;
  userLevel?: number;
}

export const WeeklyAwardCeremonyModal: React.FC<WeeklyAwardCeremonyModalProps> = ({
  ceremony,
  isOpen,
  onClose,
  onEquip,
  userLevel = 1,
}) => {
  const [equipping, setEquipping] = useState(false);
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen || !ceremony) return;

    // Kích hoạt pháo hoa chúc mừng khi mở modal (Major Milestone)
    triggerCelebration('major_milestone', {
      particleCount: 70,
      spread: 70,
      origin: { y: 0.5 },
    });

    // Auto focus vào nút hành động chính
    const timer = setTimeout(() => {
      primaryButtonRef.current?.focus();
    }, 100);

    // Bắt phím Escape để đóng an toàn
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, ceremony, onClose]);

  if (!isOpen || !ceremony) return null;

  const frameDef = LEADERBOARD_FRAMES[ceremony.frameId];

  const handleEquipNow = async () => {
    try {
      setEquipping(true);
      await onEquip(ceremony.frameId);
      triggerCelebration('completion', {
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });
      onClose();
    } finally {
      setEquipping(false);
    }
  };

  const getRankTheme = () => {
    switch (ceremony.rank) {
      case 1:
        return {
          icon: <Crown className="w-8 h-8 text-amber-400 animate-bounce motion-reduce:animate-none" />,
          title: 'Quán Quân Bảng Xếp Hạng Tuần',
          pillBg: 'bg-amber-400 text-slate-950',
          borderClass: 'border-amber-400/80 shadow-amber-500/20',
          gradientBg: 'from-amber-500/20 via-yellow-500/10 to-transparent',
        };
      case 2:
        return {
          icon: <Medal className="w-8 h-8 text-slate-300" />,
          title: 'Á Quân 1 Bảng Xếp Hạng Tuần',
          pillBg: 'bg-slate-300 text-slate-950',
          borderClass: 'border-slate-300/80 shadow-slate-400/20',
          gradientBg: 'from-slate-400/20 via-slate-300/10 to-transparent',
        };
      case 3:
      default:
        return {
          icon: <Medal className="w-8 h-8 text-amber-600" />,
          title: 'Á Quân 2 Bảng Xếp Hạng Tuần',
          pillBg: 'bg-amber-700 text-white',
          borderClass: 'border-amber-700/80 shadow-amber-800/20',
          gradientBg: 'from-amber-700/20 via-amber-600/10 to-transparent',
        };
    }
  };

  const theme = getRankTheme();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ceremony-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn motion-reduce:animate-none"
    >
      <div
        className={`relative w-full max-w-lg bg-slate-900 border ${theme.borderClass} rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden animate-scaleIn motion-reduce:animate-none`}
      >
        {/* Ambient Top Glow */}
        <div className={`absolute -top-20 -left-20 w-64 h-64 bg-gradient-to-br ${theme.gradientBg} rounded-full blur-3xl pointer-events-none`} />
        
        {/* Nút Đóng Accessible */}
        <button
          onClick={onClose}
          aria-label="Đóng bảng vinh danh"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative z-10 flex flex-col items-center text-center space-y-4">
          
          {/* Badge & Crown Icon */}
          <div className="flex flex-col items-center space-y-2">
            <div className="p-3.5 rounded-3xl bg-slate-950/90 border border-slate-800 shadow-inner">
              {theme.icon}
            </div>
            <span className={`text-[11px] font-black tracking-wider uppercase px-3 py-1 rounded-full shadow-sm ${theme.pillBg}`}>
              TOP {ceremony.rank} • MÙA GIẢI {ceremony.weekId}
            </span>
          </div>

          {/* Heading */}
          <div className="space-y-1">
            <h2
              id="ceremony-modal-title"
              className="text-xl sm:text-2xl font-black text-white tracking-tight"
            >
              Chúc mừng {ceremony.displayName}!
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-sm mx-auto">
              Bạn đã thi đấu xuất sắc đạt <span className="font-extrabold text-white">Top {ceremony.rank}</span> với{' '}
              <span className="font-extrabold text-amber-400">{ceremony.score.toLocaleString()} XP</span> trong tuần vừa qua.
            </p>
          </div>

          {/* Reward Card: Preview Avatar with New Frame */}
          <div className="w-full bg-slate-950/90 p-4 sm:p-5 rounded-2xl border border-slate-800 flex items-center gap-4 text-left shadow-inner">
            <div className="relative shrink-0">
              <UserAvatar
                name={ceremony.displayName}
                level={userLevel}
                size="lg"
                showLevelBadge={true}
                equippedFrame={ceremony.frameId}
              />
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>PHẦN THƯỞNG ĐÃ MỞ KHÓA</span>
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-white truncate">
                {frameDef ? frameDef.name : ceremony.frameId}
              </h3>
              <p className="text-[11px] text-slate-400 leading-tight">
                {frameDef ? frameDef.description : 'Khung vinh danh độc quyền vĩnh viễn.'}
              </p>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 italic max-w-sm">
            💡 Phần thưởng đã được lưu vĩnh viễn vào tài khoản của bạn. Bạn có thể thay đổi hoặc gỡ bỏ bất cứ lúc nào trong mục Hồ sơ.
          </p>

          {/* Actions */}
          <div className="w-full pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              ref={primaryButtonRef}
              type="button"
              disabled={equipping}
              onClick={handleEquipNow}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] duration-150 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{equipping ? 'Đang trang bị...' : 'Trang bị ngay'}</span>
            </button>

            <button
              type="button"
              disabled={equipping}
              onClick={onClose}
              className="w-full py-3 bg-slate-800 hover:bg-slate-750 active:scale-[0.98] duration-150 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 text-slate-300 hover:text-white font-bold rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 border border-slate-700"
            >
              <span>Để sau</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
