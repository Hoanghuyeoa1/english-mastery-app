import React from 'react';
import { Shield, Zap, Crown, Sparkles, Flame } from 'lucide-react';
import { getUserRankInfo, UserRankTier } from '../utils/userRank';

interface UserAvatarProps {
  name: string;
  level: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLevelBadge?: boolean;
  className?: string;
  onClick?: () => void;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  level,
  size = 'md',
  showLevelBadge = true,
  className = '',
  onClick,
}) => {
  const rank = getUserRankInfo(level);
  const initial = name ? name.charAt(0).toUpperCase() : 'U';

  const sizeClasses = {
    sm: {
      outer: 'w-8 h-8 rounded-xl',
      inner: 'rounded-[10px] text-xs font-black',
      badge: 'text-[9px] px-1 py-0 -bottom-1 -right-1 min-w-[16px] h-4',
    },
    md: {
      outer: 'w-10 h-10 sm:w-11 sm:h-11 rounded-2xl',
      inner: 'rounded-[14px] text-sm sm:text-base font-black',
      badge: 'text-[10px] px-1.5 py-0.2 -bottom-1.5 -right-1.5 min-w-[20px] h-5',
    },
    lg: {
      outer: 'w-14 h-14 sm:w-16 sm:h-16 rounded-3xl',
      inner: 'rounded-[22px] text-xl font-black',
      badge: 'text-xs px-2 py-0.5 -bottom-1 -right-1 min-w-[24px] h-6',
    },
    xl: {
      outer: 'w-20 h-20 sm:w-24 sm:h-24 rounded-3xl',
      inner: 'rounded-[24px] text-3xl font-black',
      badge: 'text-sm px-2.5 py-0.5 -bottom-1 -right-1 min-w-[28px] h-7',
    },
  }[size];

  return (
    <div 
      onClick={onClick}
      className={`relative inline-flex items-center justify-center shrink-0 cursor-pointer select-none group ${className}`}
    >
      {/* Outer Glow Halo for Mythic / Master / VIP */}
      <div 
        className={`absolute -inset-1 rounded-2xl opacity-60 blur-sm transition-opacity group-hover:opacity-100 ${
          rank.tier === 'mythic'
            ? 'bg-gradient-to-r from-fuchsia-600 via-rose-500 to-amber-400 animate-pulse'
            : rank.tier === 'master'
            ? 'bg-gradient-to-r from-amber-500 to-yellow-300'
            : rank.tier === 'vip'
            ? 'bg-gradient-to-r from-cyan-500 to-purple-600'
            : 'bg-emerald-500/30'
        }`} 
      />

      {/* Main Avatar Container */}
      <div 
        className={`relative ${sizeClasses.outer} ${rank.avatarWrapperClass} ${rank.avatarRingClass} flex items-center justify-center transition-all duration-300 group-hover:scale-105`}
      >
        {/* Rotating border effect for Mythic 50+ */}
        {rank.isRotatingBorder && (
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-rose-500 to-amber-400 animate-spin-reverse opacity-90 pointer-events-none" />
        )}

        {/* Inner Avatar Box */}
        <div 
          className={`relative z-10 w-full h-full ${rank.avatarInnerBg} ${sizeClasses.inner} flex items-center justify-center transition-colors`}
        >
          <span 
            className={`transition-transform duration-200 group-hover:scale-110 ${
              rank.tier === 'mythic'
                ? 'bg-gradient-to-tr from-fuchsia-300 via-rose-200 to-amber-200 bg-clip-text text-transparent drop-shadow-md'
                : rank.tier === 'master'
                ? 'bg-gradient-to-tr from-amber-200 via-yellow-100 to-amber-400 bg-clip-text text-transparent'
                : rank.tier === 'vip'
                ? 'bg-gradient-to-tr from-cyan-300 via-white to-purple-300 bg-clip-text text-transparent'
                : 'text-emerald-400'
            }`}
          >
            {initial}
          </span>
        </div>

        {/* Level Pill Badge at bottom right corner */}
        {showLevelBadge && (
          <div 
            title={`Cấp độ ${level} (${rank.title})`}
            className={`absolute z-20 ${sizeClasses.badge} ${rank.levelBadgeClass} rounded-full flex items-center justify-center font-bold tracking-tight shadow-md`}
          >
            <span className="leading-none">{level}</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface UserRankBadgeProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export const UserRankBadge: React.FC<UserRankBadgeProps> = ({
  level,
  size = 'md',
  showIcon = true,
  className = '',
}) => {
  const rank = getUserRankInfo(level);

  const getIcon = (tier: UserRankTier) => {
    switch (tier) {
      case 'mythic':
        return <Sparkles className="w-3.5 h-3.5 fill-amber-300 text-amber-200 animate-pulse shrink-0" />;
      case 'master':
        return <Crown className="w-3.5 h-3.5 fill-amber-950 text-amber-950 shrink-0" />;
      case 'vip':
        return <Zap className="w-3.5 h-3.5 fill-cyan-200 text-cyan-200 shrink-0" />;
      case 'novice':
      default:
        return <Shield className="w-3 h-3 text-emerald-400 shrink-0" />;
    }
  };

  const sizePadding = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-[11px]',
    lg: 'px-3.5 py-1.5 text-xs',
  }[size];

  return (
    <div 
      title={`Bậc danh hiệu: ${rank.title} (Level ${rank.minLevel}${rank.maxLevel ? ` - ${rank.maxLevel}` : '+'})`}
      className={`inline-flex items-center gap-1.5 ${sizePadding} ${rank.badgeBg} ${rank.badgeBorder} ${rank.badgeText} ${rank.badgeGlow} ${rank.badgeExtraClass} border rounded-full font-black tracking-wider uppercase shadow-sm select-none transition-all ${className}`}
    >
      {showIcon && getIcon(rank.tier)}
      <span>{rank.title}</span>
    </div>
  );
};

interface UserNameDisplayProps {
  name: string;
  level: number;
  showBadge?: boolean;
  badgeSize?: 'sm' | 'md';
  className?: string;
}

export const UserNameDisplay: React.FC<UserNameDisplayProps> = ({
  name,
  level,
  showBadge = true,
  badgeSize = 'sm',
  className = '',
}) => {
  const rank = getUserRankInfo(level);

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`${rank.nameClass} ${rank.nameDropShadow} truncate`}>
        {name || 'Học viên'}
      </span>
      {showBadge && (
        <UserRankBadge level={level} size={badgeSize} />
      )}
    </div>
  );
};
