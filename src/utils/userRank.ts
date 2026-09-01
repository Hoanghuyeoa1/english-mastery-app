export type UserRankTier = 'novice' | 'vip' | 'master' | 'mythic';

export interface UserRankInfo {
  tier: UserRankTier;
  title: string;
  shortTitle: string;
  minLevel: number;
  maxLevel: number | null;
  description: string;
  
  // Badge styling
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  badgeGlow: string;
  badgeExtraClass: string;
  
  // Avatar styling
  avatarWrapperClass: string;
  avatarGlowClass: string;
  avatarRingClass: string;
  avatarInnerBg: string;
  isRotatingBorder: boolean;
  
  // Level badge on avatar corner
  levelBadgeClass: string;
  
  // Name styling
  nameClass: string;
  nameDropShadow: string;
}

export function getUserRankInfo(level: number): UserRankInfo {
  const lvl = Math.max(1, level || 1);

  // LEVEL 50+: MYTHIC LEGEND
  if (lvl >= 50) {
    return {
      tier: 'mythic',
      title: 'MYTHIC LEGEND',
      shortTitle: 'MYTHIC',
      minLevel: 50,
      maxLevel: null,
      description: 'Huyền thoại Anh ngữ tối thượng, tinh hoa vô song',
      
      badgeBg: 'bg-gradient-to-r from-fuchsia-600 via-rose-500 to-amber-400',
      badgeBorder: 'border-rose-300/80',
      badgeText: 'text-white font-black drop-shadow-md',
      badgeGlow: 'shadow-[0_0_20px_rgba(244,63,94,0.65)]',
      badgeExtraClass: 'shimmer-mythic animate-mythic-glow',
      
      avatarWrapperClass: 'relative p-[3px] rounded-2xl bg-gradient-to-tr from-fuchsia-600 via-rose-500 to-amber-400 shadow-[0_0_25px_rgba(244,63,94,0.65)]',
      avatarGlowClass: 'animate-mythic-glow',
      avatarRingClass: 'ring-2 ring-offset-2 ring-rose-400 ring-offset-slate-950',
      avatarInnerBg: 'bg-slate-950',
      isRotatingBorder: true,
      
      levelBadgeClass: 'bg-gradient-to-r from-rose-600 via-fuchsia-600 to-amber-500 text-white font-black border border-rose-200/90 shadow-[0_0_10px_rgba(244,63,94,0.8)]',
      
      nameClass: 'bg-gradient-to-r from-fuchsia-200 via-rose-100 to-amber-200 bg-clip-text text-transparent font-black tracking-wide',
      nameDropShadow: 'drop-shadow-[0_2px_12px_rgba(244,63,94,0.55)]',
    };
  }

  // LEVEL 25 - 49: MASTER PRO
  if (lvl >= 25) {
    return {
      tier: 'master',
      title: 'MASTER PRO',
      shortTitle: 'MASTER',
      minLevel: 25,
      maxLevel: 49,
      description: 'Bậc thầy ngôn ngữ xuất sắc, vương giả hoàng gia',
      
      badgeBg: 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600',
      badgeBorder: 'border-yellow-200',
      badgeText: 'text-slate-950 font-black drop-shadow-sm',
      badgeGlow: 'shadow-[0_0_18px_rgba(251,191,36,0.55)]',
      badgeExtraClass: 'shimmer-gold',
      
      avatarWrapperClass: 'relative p-[2.5px] rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.5)]',
      avatarGlowClass: 'shadow-[0_0_20px_rgba(245,158,11,0.45)]',
      avatarRingClass: 'ring-2 ring-offset-2 ring-amber-400 ring-offset-slate-950',
      avatarInnerBg: 'bg-slate-950',
      isRotatingBorder: false,
      
      levelBadgeClass: 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black border border-yellow-100 shadow-[0_0_8px_rgba(251,191,36,0.6)]',
      
      nameClass: 'bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 bg-clip-text text-transparent font-black',
      nameDropShadow: 'drop-shadow-[0_2px_8px_rgba(251,191,36,0.38)]',
    };
  }

  // LEVEL 10 - 24: VIP PRO
  if (lvl >= 10) {
    return {
      tier: 'vip',
      title: 'VIP PRO',
      shortTitle: 'VIP PRO',
      minLevel: 10,
      maxLevel: 24,
      description: 'Thành viên chuyên nghiệp, tốc độ tiến bộ vượt bậc',
      
      badgeBg: 'bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600',
      badgeBorder: 'border-cyan-300/70',
      badgeText: 'text-white font-black drop-shadow-sm',
      badgeGlow: 'shadow-[0_0_14px_rgba(6,182,212,0.45)]',
      badgeExtraClass: 'animate-vip-glow',
      
      avatarWrapperClass: 'relative p-[2px] rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 shadow-[0_0_16px_rgba(6,182,212,0.4)]',
      avatarGlowClass: 'animate-vip-glow',
      avatarRingClass: 'ring-2 ring-offset-2 ring-cyan-400 ring-offset-slate-950',
      avatarInnerBg: 'bg-slate-950',
      isRotatingBorder: false,
      
      levelBadgeClass: 'bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 text-white font-mono font-black border border-cyan-300/60 shadow-[0_0_8px_rgba(6,182,212,0.5)]',
      
      nameClass: 'bg-gradient-to-r from-cyan-200 via-white to-purple-200 bg-clip-text text-transparent font-extrabold',
      nameDropShadow: 'drop-shadow-[0_2px_6px_rgba(6,182,212,0.3)]',
    };
  }

  // LEVEL 1 - 9: TÂN THỦ
  return {
    tier: 'novice',
    title: 'TÂN THỦ',
    shortTitle: 'TÂN THỦ',
    minLevel: 1,
    maxLevel: 9,
    description: 'Hành trình vạn dặm khởi đầu từ những bước chân đầu tiên',
    
    badgeBg: 'bg-gradient-to-r from-slate-800 to-emerald-950/80',
    badgeBorder: 'border-emerald-500/30',
    badgeText: 'text-emerald-400 font-bold',
    badgeGlow: 'shadow-sm',
    badgeExtraClass: '',
    
    avatarWrapperClass: 'relative p-[1.5px] rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 shadow-md shadow-emerald-500/10',
    avatarGlowClass: 'shadow-md shadow-emerald-500/20',
    avatarRingClass: 'ring-2 ring-offset-2 ring-emerald-500/40 ring-offset-slate-950',
    avatarInnerBg: 'bg-slate-950',
    isRotatingBorder: false,
    
    levelBadgeClass: 'bg-slate-900 text-emerald-400 font-mono font-bold border border-slate-700 shadow-sm',
    
    nameClass: 'text-white font-bold hover:text-emerald-300 transition-colors',
    nameDropShadow: '',
  };
}

export interface LevelProgress {
  level: number;
  currentLevelXp: number;
  nextLevelXpRequired: number;
  percentage: number;
  totalXp: number;
}

/**
 * RPG Progressive Level Calculation:
 * - Level L needs: 100 + (L - 1) * 50 XP to advance to L + 1
 * - Level 1: 100 XP
 * - Level 2: 150 XP
 * - Level 3: 200 XP
 * ...
 */
export function getXpLevelProgress(totalXp: number): LevelProgress {
  const xp = Math.max(0, totalXp || 0);
  let level = 1;
  let accumulated = 0;

  while (true) {
    const neededForThisLevel = 100 + (level - 1) * 50;
    if (xp < accumulated + neededForThisLevel) {
      const currentLevelXp = xp - accumulated;
      const percentage = Math.min(100, Math.max(0, Math.round((currentLevelXp / neededForThisLevel) * 100)));
      return {
        level,
        currentLevelXp,
        nextLevelXpRequired: neededForThisLevel,
        percentage,
        totalXp: xp,
      };
    }
    accumulated += neededForThisLevel;
    level++;
    if (level >= 999) {
      break;
    }
  }

  return {
    level,
    currentLevelXp: 0,
    nextLevelXpRequired: 100 + (level - 1) * 50,
    percentage: 100,
    totalXp: xp,
  };
}

export function calculateLevelFromXp(totalXp: number): number {
  return getXpLevelProgress(totalXp).level;
}
