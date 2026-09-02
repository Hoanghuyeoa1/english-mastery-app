import React, { useState, useRef, useEffect } from 'react';
import { 
  Flame, 
  Star, 
  Heart, 
  Volume2, 
  ShieldCheck, 
  Award, 
  PlusCircle, 
  Target,
  ChevronDown,
  LayoutDashboard,
  Layers,
  Gamepad2,
  Bot,
  Brain,
  BookOpen,
  Search,
  Zap,
  Mic,
  Languages,
  ShieldAlert,
  Headphones,
  PenTool,
  Cloud,
  CloudCheck,
  RefreshCw,
  WifiOff,
  RotateCcw,
  BookmarkCheck,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useCloudSyncStore } from '../services/cloudSyncService';
import { useIsAdmin } from '../utils/adminAuth';
import { ActiveTab } from '../types';
import { UserAvatar, UserRankBadge } from './UserProfileBadge';
import { getUserRankInfo, getXpLevelProgress } from '../utils/userRank';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenProfile: () => void;
  onOpenBackup: () => void;
  onOpenAchievements: () => void;
  onOpenAddWord: () => void;
  onOpenDailySettings: () => void;
  onOpenAuthSync: () => void;
  onOpenReviewModal?: () => void;
  onOpenMyVocabBank?: () => void;
}

interface DropdownGroup {
  id: string;
  label: string;
  badge?: string;
  icon: React.ReactNode;
  activeTabs: ActiveTab[];
  items: {
    id?: ActiveTab;
    label: string;
    desc: string;
    badge?: string;
    icon: React.ReactNode;
    onClick?: () => void;
  }[];
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenProfile,
  onOpenBackup,
  onOpenAchievements,
  onOpenAddWord,
  onOpenDailySettings,
  onOpenAuthSync,
  onOpenReviewModal,
  onOpenMyVocabBank,
}) => {
  const { profile, refillHearts, audioVoice, setAudioVoice, mistakeBank, setActiveFourSkill } = useAppStore();
  const { user, status, isOnline } = useCloudSyncStore();
  const isAdmin = useIsAdmin();

  const unresolvedMistakeCount = Object.values(mistakeBank || {}).filter((m) => !m.resolved).length;
  const xpProgress = getXpLevelProgress(profile.xp);
  const currentLevel = xpProgress.level;
  const userRank = getUserRankInfo(currentLevel);
  const xpCurrentLevel = xpProgress.percentage;
  const xpToNextLevel = xpProgress.nextLevelXpRequired - xpProgress.currentLevelXp;

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = (menuId: string) => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
    setOpenDropdown(menuId);
  };

  const handleMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setOpenDropdown(null);
    }, 180);
  };

  const dropdownGroups: DropdownGroup[] = [
    {
      id: 'vocab_group',
      label: 'Học Từ Vựng',
      badge: unresolvedMistakeCount > 0 ? `${unresolvedMistakeCount}` : undefined,
      icon: <Layers className="w-4 h-4" />,
      activeTabs: ['flashcards', 'mistakes', 'vocabulary', 'dictionary'],
      items: [
        {
          id: 'flashcards',
          label: 'Thẻ SRS SM-2',
          desc: 'Ôn tập lặp lại ngắt quãng thông minh',
          icon: <Brain className="w-4 h-4 text-emerald-400" />,
        },
        {
          label: 'Ôn Tập Từ Vựng',
          desc: 'Trung tâm ôn tập SRS: Đến hạn, từ mới & kho từ',
          icon: <RotateCcw className="w-4 h-4 text-emerald-400" />,
          onClick: onOpenReviewModal,
        },
        {
          label: 'Kho Từ Của Tôi',
          desc: 'Kho từ vựng tích lũy cá nhân qua SRS',
          icon: <BookmarkCheck className="w-4 h-4 text-cyan-400" />,
          onClick: onOpenMyVocabBank,
        },
        {
          id: 'mistakes',
          label: 'Sổ Bẫy Lỗi Sai',
          desc: 'Tự động bắt từ hay quên & ôn cứu hộ',
          badge: unresolvedMistakeCount > 0 ? `🔴 ${unresolvedMistakeCount} từ` : undefined,
          icon: <ShieldAlert className="w-4 h-4 text-rose-400" />,
        },
        {
          id: 'vocabulary',
          label: 'Kho Từ Vựng',
          desc: 'Quản lý, thêm từ mới & import',
          icon: <BookOpen className="w-4 h-4 text-cyan-400" />,
        },
        {
          id: 'dictionary',
          label: 'Từ Điển Live',
          desc: 'Tra cứu siêu tốc & ngữ nghĩa chuẩn',
          icon: <Search className="w-4 h-4 text-amber-400" />,
        },
      ],
    },
    {
      id: 'practice_group',
      label: 'Luyện Tập & Đấu Trường',
      icon: <Gamepad2 className="w-4 h-4" />,
      activeTabs: ['quiz', 'pronunciation', 'toeic'],
      items: [
        {
          id: 'quiz',
          label: 'Đấu Trường Arcade',
          desc: 'Speed Match, Scramble, Dictation 60s',
          icon: <Zap className="w-4 h-4 text-amber-400" />,
        },
        {
          id: 'pronunciation',
          label: 'Luyện Phát Âm AI',
          desc: 'Shadowing & Chấm điểm qua Mic AI',
          icon: <Mic className="w-4 h-4 text-teal-400" />,
        },
        {
          id: 'toeic',
          label: 'Đánh Giá TOEIC 4 Kỹ Năng',
          desc: 'Làm đề thi thử & dự đoán điểm số',
          icon: <Award className="w-4 h-4 text-rose-400" />,
        },
      ],
    },
    {
      id: 'ai_group',
      label: 'AI Trợ Lý',
      icon: <Bot className="w-4 h-4" />,
      activeTabs: ['tutor', 'translator'],
      items: [
        {
          id: 'tutor',
          label: 'AI Roleplay Hội Thoại',
          desc: 'Phỏng vấn Tech, Standup, Du lịch & Sửa lỗi',
          icon: <Bot className="w-4 h-4 text-cyan-400" />,
        },
        {
          id: 'translator',
          label: 'Trợ Lý Dịch Thuật Studio',
          desc: 'Dịch AI theo ngữ cảnh & 3 văn phong',
          icon: <Languages className="w-4 h-4 text-teal-400" />,
        },
      ],
    },
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 overflow-visible">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-visible">
        
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          <div 
            onClick={onOpenProfile}
            title={`Hồ sơ: ${profile.name || 'Học viên'} • Cấp ${profile.level} (${userRank.title}) • Nhấp để xem chi tiết`}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <UserAvatar 
              name={profile.name || 'U'}
              level={profile.level}
              size="md"
              showLevelBadge={true}
            />

            <div>
              <div className="flex items-center gap-2">
                <span className={`font-extrabold text-sm sm:text-base tracking-tight ${userRank.nameClass} ${userRank.nameDropShadow} flex items-center gap-1.5 transition-all`}>
                  {profile.name || 'Học viên'}
                </span>
                <div className="hidden sm:inline-flex">
                  <UserRankBadge level={profile.level} size="sm" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className={`font-bold ${
                  userRank.tier === 'mythic' ? 'text-rose-400' :
                  userRank.tier === 'master' ? 'text-amber-400' :
                  userRank.tier === 'vip' ? 'text-cyan-400' : 'text-emerald-400'
                }`}>
                  Cấp {profile.level}
                </span>
                <span>•</span>
                <span className="hidden xs:inline">Còn {xpToNextLevel} XP lên Cấp {profile.level + 1}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div 
              title="Chuỗi ngày học liên tục"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-orange-400 font-bold text-xs sm:text-sm shadow-sm"
            >
              <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400 fill-orange-400/30 animate-pulse" />
              <span>{profile.streak} <span className="hidden md:inline font-medium text-xs">ngày</span></span>
            </div>

            <div 
              title={`Tổng: ${profile.xp} XP - Tiến độ cấp ${profile.level}`}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300 font-bold text-xs sm:text-sm"
            >
              <Star className="w-4 h-4 text-amber-400 fill-amber-400/40" />
              <div className="flex flex-col">
                <span className="leading-none">{profile.xp} <span className="font-medium text-[11px] text-amber-400/80">XP</span></span>
                <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                  <div 
                    className="bg-amber-400 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${xpCurrentLevel}%` }}
                  />
                </div>
              </div>
            </div>

            <div 
              onClick={() => {
                if (profile.hearts < 5) refillHearts();
              }}
              title="Trái tim học tập (Click để nạp đầy)"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 font-bold text-xs sm:text-sm cursor-pointer hover:bg-rose-500/20 transition-all"
            >
              <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500 fill-rose-500" />
              <span>{profile.hearts}/5</span>
            </div>

            {/* Thêm từ mới thủ công: Chỉ hiển thị cho tài khoản Quản Trị Viên */}
            {isAdmin && (
              <button
                onClick={onOpenAddWord}
                title="Thêm từ vựng mới (Dành cho Quản trị viên)"
                className="p-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 rounded-2xl transition-all"
              >
                <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}

            <button
              onClick={onOpenAchievements}
              title="Huy hiệu & Thành Tựu"
              className="p-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-amber-400 rounded-2xl transition-all"
            >
              <Award className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Cloud Sync Status / Auth Button */}
            <button
              onClick={onOpenAuthSync}
              title={
                !user
                  ? 'Đồng bộ đám mây (Supabase) - Lưu trữ đa thiết bị'
                  : status === 'syncing'
                  ? 'Đang đồng bộ dữ liệu với Cloud...'
                  : !isOnline
                  ? 'Đang offline (Đã lưu tại LocalStorage)'
                  : 'Dữ liệu đã được lưu an toàn trên Cloud (Supabase)'
              }
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-2xl text-xs sm:text-sm font-bold border transition-all ${
                !user
                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400 hover:text-emerald-300 shadow-sm'
                  : status === 'syncing'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : !isOnline
                  ? 'bg-slate-900 border-slate-800 text-slate-400'
                  : 'bg-teal-500/10 hover:bg-teal-500/20 border-teal-500/30 text-teal-300'
              }`}
            >
              {!user ? (
                <>
                  <Cloud className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-400" />
                  <span className="hidden md:inline">Sync Cloud</span>
                </>
              ) : status === 'syncing' ? (
                <>
                  <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                  <span className="hidden md:inline">Đang lưu...</span>
                </>
              ) : !isOnline ? (
                <>
                  <WifiOff className="w-4 h-4 text-slate-400" />
                  <span className="hidden md:inline">Offline</span>
                </>
              ) : (
                <>
                  <CloudCheck className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-teal-400" />
                  <span className="hidden md:inline">Đã lưu</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RESTRUCTURED NAVBAR: COMPACT DROPDOWN GROUPS + STANDALONE 4-SKILLS TAB    */}
        {/* ========================================================================= */}
        <nav className="flex items-center space-x-1.5 sm:space-x-2 py-2 border-t border-slate-850/80 overflow-visible relative">
          
          <button
            onClick={() => {
              setActiveTab('dashboard');
              setOpenDropdown(null);
            }}
            className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'dashboard'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-900/80'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Tổng Quan</span>
          </button>

          {dropdownGroups.filter(g => g.id === 'vocab_group').map((group) => {
            const isGroupActive = group.activeTabs.includes(activeTab);
            const isOpen = openDropdown === group.id;

            return (
              <div
                key={group.id}
                className="relative"
                onMouseEnter={() => handleMouseEnter(group.id)}
                onMouseLeave={handleMouseLeave}
              >
                <button
                  onClick={() => setOpenDropdown(isOpen ? null : group.id)}
                  className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                    isGroupActive
                      ? 'bg-emerald-500/15 border-emerald-400/60 text-emerald-300 shadow-sm'
                      : isOpen
                      ? 'bg-slate-850 border-slate-700 text-white'
                      : 'border-transparent text-slate-300 hover:text-white hover:bg-slate-900/80'
                  }`}
                >
                  <span>{group.icon}</span>
                  <span>{group.label}</span>
                  {group.badge && (
                    <span className="px-1.5 py-0.2 text-[10px] font-black bg-rose-500 text-white rounded-full">
                      {group.badge}
                    </span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-400' : 'text-slate-400'}`} />
                </button>

                {isOpen && (
                  <div className="absolute top-full left-0 mt-2 w-72 sm:w-80 bg-slate-900/98 backdrop-blur-2xl border border-slate-700/80 rounded-2xl p-2 shadow-2xl z-[9999] animate-in fade-in slide-in-from-top-2 duration-150 space-y-1">
                    {group.items.map((item) => {
                      const isItemActive = activeTab === item.id;
                      return (
                        <button
                          key={item.label}
                          onClick={() => {
                            if (item.onClick) {
                              item.onClick();
                            } else if (item.id) {
                              setActiveTab(item.id as ActiveTab);
                            }
                            setOpenDropdown(null);
                          }}
                          className={`w-full p-2.5 rounded-xl text-left transition-all flex items-start gap-3 ${
                            isItemActive
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'hover:bg-slate-800/80 text-slate-200'
                          }`}
                        >
                          <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 shrink-0 mt-0.5">
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-extrabold text-xs sm:text-sm block text-white">
                                {item.label}
                              </span>
                              {item.badge && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5 truncate">
                              {item.desc}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {dropdownGroups.filter(g => g.id === 'practice_group').map((group) => {
            const isGroupActive = group.activeTabs.includes(activeTab);
            const isOpen = openDropdown === group.id;

            return (
              <div
                key={group.id}
                className="relative"
                onMouseEnter={() => handleMouseEnter(group.id)}
                onMouseLeave={handleMouseLeave}
              >
                <button
                  onClick={() => setOpenDropdown(isOpen ? null : group.id)}
                  className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                    isGroupActive
                      ? 'bg-amber-500/15 border-amber-400/60 text-amber-300 shadow-sm'
                      : isOpen
                      ? 'bg-slate-850 border-slate-700 text-white'
                      : 'border-transparent text-slate-300 hover:text-white hover:bg-slate-900/80'
                  }`}
                >
                  <span>{group.icon}</span>
                  <span>{group.label}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-amber-400' : 'text-slate-400'}`} />
                </button>

                {isOpen && (
                  <div className="absolute top-full left-0 mt-2 w-72 sm:w-80 bg-slate-900/98 backdrop-blur-2xl border border-slate-700/80 rounded-2xl p-2 shadow-2xl z-[9999] animate-in fade-in slide-in-from-top-2 duration-150 space-y-1">
                    {group.items.map((item) => {
                      const isItemActive = activeTab === item.id;
                      return (
                        <button
                          key={item.label}
                          onClick={() => {
                            if (item.onClick) {
                              item.onClick();
                            } else if (item.id) {
                              setActiveTab(item.id);
                            }
                            setOpenDropdown(null);
                          }}
                          className={`w-full p-2.5 rounded-xl text-left transition-all flex items-start gap-3 ${
                            isItemActive
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'hover:bg-slate-800/80 text-slate-200'
                          }`}
                        >
                          <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 shrink-0 mt-0.5">
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-extrabold text-xs sm:text-sm block text-white">
                              {item.label}
                            </span>
                            <span className="text-[11px] text-slate-400 block mt-0.5 truncate">
                              {item.desc}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* 4. Dropdown: 🎯 4 Kỹ Năng */}
          <div
            className="relative"
            onMouseEnter={() => handleMouseEnter('skills_group')}
            onMouseLeave={handleMouseLeave}
          >
            <button
              onClick={() => {
                setActiveTab('four_skills');
                setOpenDropdown(openDropdown === 'skills_group' ? null : 'skills_group');
              }}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                activeTab === 'four_skills'
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/20 font-black'
                  : openDropdown === 'skills_group'
                  ? 'bg-slate-850 border-slate-700 text-white'
                  : 'border-transparent text-slate-300 hover:text-white hover:bg-slate-900/80'
              }`}
            >
              <Headphones className="w-4 h-4 text-cyan-400" />
              <span>4 Kỹ Năng</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdown === 'skills_group' ? 'rotate-180 text-cyan-400' : 'text-slate-400'}`} />
            </button>

            {openDropdown === 'skills_group' && (
              <div className="absolute top-full left-0 mt-2 w-72 sm:w-80 bg-slate-900/98 backdrop-blur-2xl border border-slate-700/80 rounded-2xl p-2 shadow-2xl z-[9999] animate-in fade-in slide-in-from-top-2 duration-150 space-y-1">
                <button
                  onClick={() => {
                    setActiveTab('four_skills');
                    setActiveFourSkill('listening');
                    setOpenDropdown(null);
                  }}
                  className="w-full p-2.5 rounded-xl text-left transition-all flex items-start gap-3 hover:bg-slate-800/80 text-slate-200 group"
                >
                  <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 shrink-0 mt-0.5 text-cyan-400 group-hover:scale-110 transition-transform">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-extrabold text-xs sm:text-sm block text-white group-hover:text-cyan-300 transition-colors">
                      🎧 Luyện Nghe (Listening Lab)
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5 truncate">
                      Nghe hội thoại, podcast & tra từ 1-chạm
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('four_skills');
                    setActiveFourSkill('reading');
                    setOpenDropdown(null);
                  }}
                  className="w-full p-2.5 rounded-xl text-left transition-all flex items-start gap-3 hover:bg-slate-800/80 text-slate-200 group"
                >
                  <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 shrink-0 mt-0.5 text-emerald-400 group-hover:scale-110 transition-transform">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-extrabold text-xs sm:text-sm block text-white group-hover:text-emerald-300 transition-colors">
                      📖 Luyện Đọc (Reading Studio)
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5 truncate">
                      Bài đọc B1-C1 thực tế & trắc nghiệm đọc hiểu
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('four_skills');
                    setActiveFourSkill('speaking');
                    setOpenDropdown(null);
                  }}
                  className="w-full p-2.5 rounded-xl text-left transition-all flex items-start gap-3 hover:bg-slate-800/80 text-slate-200 group"
                >
                  <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 shrink-0 mt-0.5 text-purple-400 group-hover:scale-110 transition-transform">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-extrabold text-xs sm:text-sm block text-white group-hover:text-purple-300 transition-colors">
                      🗣️ Luyện Nói (Speaking AI)
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5 truncate">
                      Roleplay hội thoại & chấm điểm qua Mic AI
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('four_skills');
                    setActiveFourSkill('writing');
                    setOpenDropdown(null);
                  }}
                  className="w-full p-2.5 rounded-xl text-left transition-all flex items-start gap-3 hover:bg-slate-800/80 text-slate-200 group"
                >
                  <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 shrink-0 mt-0.5 text-amber-400 group-hover:scale-110 transition-transform">
                    <PenTool className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-extrabold text-xs sm:text-sm block text-white group-hover:text-amber-300 transition-colors">
                      ✍️ Luyện Viết (Writing Studio)
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5 truncate">
                      Viết email, báo cáo, bài luận & sửa bài AI
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {dropdownGroups.filter(g => g.id === 'ai_group').map((group) => {
            const isGroupActive = group.activeTabs.includes(activeTab);
            const isOpen = openDropdown === group.id;

            return (
              <div
                key={group.id}
                className="relative"
                onMouseEnter={() => handleMouseEnter(group.id)}
                onMouseLeave={handleMouseLeave}
              >
                <button
                  onClick={() => setOpenDropdown(isOpen ? null : group.id)}
                  className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                    isGroupActive
                      ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-300 shadow-sm'
                      : isOpen
                      ? 'bg-slate-850 border-slate-700 text-white'
                      : 'border-transparent text-slate-300 hover:text-white hover:bg-slate-900/80'
                  }`}
                >
                  <span>{group.icon}</span>
                  <span>{group.label}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-cyan-400' : 'text-slate-400'}`} />
                </button>

                {isOpen && (
                  <div className="absolute top-full right-0 sm:left-auto sm:right-0 mt-2 w-72 sm:w-80 bg-slate-900/98 backdrop-blur-2xl border border-slate-700/80 rounded-2xl p-2 shadow-2xl z-[9999] animate-in fade-in slide-in-from-top-2 duration-150 space-y-1">
                    {group.items.map((item) => {
                      const isItemActive = activeTab === item.id;
                      return (
                        <button
                          key={item.label}
                          onClick={() => {
                            if (item.onClick) {
                              item.onClick();
                            } else if (item.id) {
                              setActiveTab(item.id);
                            }
                            setOpenDropdown(null);
                          }}
                          className={`w-full p-2.5 rounded-xl text-left transition-all flex items-start gap-3 ${
                            isItemActive
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : 'hover:bg-slate-800/80 text-slate-200'
                          }`}
                        >
                          <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 shrink-0 mt-0.5">
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-extrabold text-xs sm:text-sm block text-white">
                              {item.label}
                            </span>
                            <span className="text-[11px] text-slate-400 block mt-0.5 truncate">
                              {item.desc}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Admin Tab - Chỉ hiển thị cho Quản trị viên hoang2003eoe@gmail.com */}
          {isAdmin && (
            <button
              onClick={() => {
                setActiveTab('admin');
                setOpenDropdown(null);
              }}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                activeTab === 'admin'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25 border-rose-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20 hover:text-white'
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Quản Trị 🛡️</span>
            </button>
          )}

        </nav>
      </div>
    </header>
  );
};
