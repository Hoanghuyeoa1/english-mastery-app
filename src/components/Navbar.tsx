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
  Languages
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { ActiveTab } from '../types';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenProfile: () => void;
  onOpenBackup: () => void;
  onOpenAchievements: () => void;
  onOpenAddWord: () => void;
  onOpenDailySettings: () => void;
}

interface DropdownGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  activeTabs: ActiveTab[];
  items: {
    id: ActiveTab;
    label: string;
    desc: string;
    icon: React.ReactNode;
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
}) => {
  const { profile, refillHearts, audioVoice, setAudioVoice } = useAppStore();

  const xpCurrentLevel = profile.xp % 100;
  const xpToNextLevel = 100 - xpCurrentLevel;

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
      icon: <Layers className="w-4 h-4" />,
      activeTabs: ['flashcards', 'vocabulary', 'dictionary'],
      items: [
        {
          id: 'flashcards',
          label: 'Thẻ SRS SM-2',
          desc: 'Ôn tập lặp lại ngắt quãng thông minh',
          icon: <Brain className="w-4 h-4 text-emerald-400" />,
        },
        {
          id: 'vocabulary',
          label: 'Kho Từ Vựng',
          desc: 'Quản lý, thêm từ mới & import',
          icon: <BookOpen className="w-4 h-4 text-cyan-400" />,
        },
        {
          id: 'dictionary',
          label: 'Từ Điển Live 10.000+',
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
    <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Header: Identity & Gamification */}
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo & User Identity */}
          <div 
            onClick={onOpenProfile}
            title="Nhấp để chỉnh sửa hồ sơ & sao lưu"
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div 
              className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform"
            >
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-black text-emerald-400 text-base group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
                {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5 group-hover:text-emerald-400 transition-colors">
                  {profile.name || 'Học viên'}
                  <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                    VIP Pro
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-semibold text-emerald-400">Cấp {profile.level}</span>
                <span>•</span>
                <span className="hidden xs:inline">Còn {xpToNextLevel} XP lên Cấp {profile.level + 1}</span>
              </div>
            </div>
          </div>

          {/* Gamification Counters: Streak 🔥, XP ⭐, Hearts ❤️ */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Daily Streak */}
            <div 
              title="Chuỗi ngày học liên tục"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-orange-400 font-bold text-xs sm:text-sm shadow-sm"
            >
              <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400 fill-orange-400/30 animate-pulse" />
              <span>{profile.streak} <span className="hidden md:inline font-medium text-xs">ngày</span></span>
            </div>

            {/* Total XP & Level Bar */}
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

            {/* Hearts ❤️ */}
            <div 
              onClick={() => {
                if (profile.hearts < profile.maxHearts) {
                  refillHearts();
                }
              }}
              title={profile.hearts < profile.maxHearts ? 'Nhấp để hồi phục full 5 tim' : 'Trái tim đầy đủ'}
              className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-2xl text-rose-400 font-bold text-xs sm:text-sm transition-all"
            >
              <Heart className={`w-4 h-4 sm:w-5 sm:h-5 fill-rose-500 ${profile.hearts === 0 ? 'text-slate-600 fill-slate-700' : 'text-rose-500'}`} />
              <span>{profile.hearts}/{profile.maxHearts}</span>
            </div>

            {/* TTS Voice Accent Switcher */}
            <button
              onClick={() => setAudioVoice(audioVoice === 'en-US' ? 'en-GB' : 'en-US')}
              title={`Giọng phát âm hiện tại: ${audioVoice === 'en-US' ? 'Anh - Mỹ (US)' : 'Anh - Anh (UK)'}`}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl text-xs font-semibold text-slate-300 transition-all"
            >
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span>{audioVoice === 'en-US' ? '🇺🇸 US' : '🇬🇧 UK'}</span>
            </button>

            {/* Add Custom Word button */}
            <button
              onClick={onOpenAddWord}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-2xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Thêm từ</span>
            </button>

            {/* Daily Target Settings */}
            <button
              onClick={onOpenDailySettings}
              title={`Cài đặt Mục tiêu Ngày (${profile.targetDailyNewWords || 15} từ/ngày)`}
              className="p-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-emerald-400 rounded-2xl transition-all"
            >
              <Target className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Achievements & Backup Modals */}
            <button
              onClick={onOpenAchievements}
              title="Danh hiệu & Thành tựu"
              className="p-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-amber-400 rounded-2xl transition-all"
            >
              <Award className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <button
              onClick={onOpenBackup}
              title="Sao lưu & Khôi phục Dữ liệu"
              className="p-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-emerald-400 rounded-2xl transition-all"
            >
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RESTRUCTURED NAVBAR: COMPACT DROPDOWN GROUPS (FITS 1 CLEAN ROW)          */}
        {/* ========================================================================= */}
        <nav className="flex items-center space-x-1.5 sm:space-x-2 py-2 border-t border-slate-850/80">
          
          {/* 1. Dashboard Direct Tab */}
          <button
            onClick={() => {
              setActiveTab('dashboard');
              setOpenDropdown(null);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'dashboard'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-900/80'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Tổng Quan</span>
          </button>

          {/* 2. Dropdown Navigation Groups */}
          {dropdownGroups.map((group) => {
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
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 border ${
                    isGroupActive
                      ? 'bg-emerald-500/15 border-emerald-400/60 text-emerald-300 shadow-sm'
                      : isOpen
                      ? 'bg-slate-850 border-slate-700 text-white'
                      : 'border-transparent text-slate-300 hover:text-white hover:bg-slate-900/80'
                  }`}
                >
                  <span>{group.icon}</span>
                  <span>{group.label}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-400' : 'text-slate-400'}`} />
                </button>

                {/* Dropdown Card */}
                {isOpen && (
                  <div className="absolute left-0 mt-1.5 w-72 sm:w-80 bg-slate-900/95 backdrop-blur-2xl border border-slate-750 rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-1">
                    {group.items.map((item) => {
                      const isItemActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id);
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

        </nav>
      </div>
    </header>
  );
};
