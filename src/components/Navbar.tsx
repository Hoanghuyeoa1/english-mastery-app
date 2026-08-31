import React from 'react';
import { Flame, Star, Heart, Volume2, ShieldCheck, Award, Sparkles, PlusCircle, Target } from 'lucide-react';
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

  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & User Identity */}
          <div 
            onClick={onOpenProfile}
            title="Nhấp để chỉnh sửa hồ sơ & sao lưu"
            className="flex items-center gap-3.5 cursor-pointer group"
          >
            <div 
              className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform"
            >
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-black text-emerald-400 text-base group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
                {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-white flex items-center gap-1.5 group-hover:text-emerald-400 transition-colors">
                  {profile.name || 'Học viên'}
                  <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
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
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-xs font-semibold text-slate-300 transition-all"
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
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-emerald-400 rounded-2xl transition-all"
            >
              <Target className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Achievements & Backup Modals */}
            <button
              onClick={onOpenAchievements}
              title="Danh hiệu & Thành tựu"
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-amber-400 rounded-2xl transition-all"
            >
              <Award className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <button
              onClick={onOpenBackup}
              title="Sao lưu & Khôi phục Dữ liệu"
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-emerald-400 rounded-2xl transition-all"
            >
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 sm:space-x-2 py-2 overflow-x-auto no-scrollbar border-t border-slate-850/60">
          {[
            { id: 'dashboard', label: '📊 Tổng quan' },
            { id: 'flashcards', label: '🎴 Thẻ SRS SM-2' },
            { id: 'toeic', label: '🎯 Đánh Giá TOEIC' },
            { id: 'quiz', label: '⚡ Đấu trường Quiz' },
            { id: 'pronunciation', label: '🎙️ Luyện Phát âm' },
            { id: 'tutor', label: '🤖 Hội Thoại AI' },
            { id: 'vocabulary', label: '📖 Kho từ vựng' },
            { id: 'dictionary', label: '📚 Từ điển Live' },
            { id: 'translator', label: '🌐 Dịch thuật Studio' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
