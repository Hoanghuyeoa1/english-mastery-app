import React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  Sparkles,
  Brain,
  Headphones,
  Award,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  Cpu,
  Trophy,
  CheckCircle2,
} from 'lucide-react';
import { AuthForm } from '../auth/AuthForm';
import type { AppAuthUser } from '../../services/cloudSyncService';

export interface WelcomeViewProps {
  /** Callback fired when user chooses Guest mode */
  onContinueAsGuest?: () => void;
  /** Callback fired when login or registration succeeds */
  onAuthSuccess?: (user: AppAuthUser) => void;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({
  onContinueAsGuest,
  onAuthSuccess,
}) => {
  const shouldReduceMotion = useReducedMotion();

  // Animation variants respecting user's motion preferences
  const fadeInVariant: Variants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: shouldReduceMotion ? 0 : 0.45, ease: 'easeOut' },
    },
  };

  const cefrLevels = [
    { code: 'A1', label: 'Cơ bản', active: true },
    { code: 'A2', label: 'Sơ cấp', active: true },
    { code: 'B1', label: 'Trung cấp', active: true },
    { code: 'B2', label: 'Trung cao', active: true },
    { code: 'C1', label: 'Cao cấp', active: true },
    { code: 'C2', label: 'Thành thạo', active: true },
  ];

  const verifiedHighlights = [
    {
      icon: <Brain className="w-4 h-4 text-emerald-400" />,
      title: '10.381 Từ vựng FSRS & SM-2',
      desc: 'Thuật toán lặp lại ngắt quãng tối ưu hóa trí nhớ dài hạn',
    },
    {
      icon: <Headphones className="w-4 h-4 text-cyan-400" />,
      title: '96 Bài luyện Four Skills',
      desc: 'Nghe, Nói phát âm AI, Đọc hiểu & Viết luận chuẩn A1–C2',
    },
    {
      icon: <Award className="w-4 h-4 text-amber-400" />,
      title: 'Luyện thi TOEIC Chuẩn ETS',
      desc: 'Đề thi chẩn đoán, phân tích điểm yếu và dự đoán thang điểm',
    },
    {
      icon: <Trophy className="w-4 h-4 text-purple-400" />,
      title: '7 Danh mục Leaderboard & AI Tutor',
      desc: 'Thi đua hàng tuần và đàm thoại phản xạ cùng gia sư thông minh',
    },
  ];

  return (
    <div
      role="region"
      aria-label="Welcome and Authentication Landing"
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-slate-950 relative overflow-x-hidden"
    >
      {/* Skip to Content Link for Keyboard / Screen Reader Navigation */}
      <a
        href="#welcome-auth-card"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-emerald-500 focus:text-slate-950 focus:font-extrabold focus:rounded-xl focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-white"
      >
        Chuyển đến phần Đăng nhập
      </a>

      {/* Background Ambient Glow Gradients */}
      <div className="absolute top-0 left-1/4 -translate-x-1/2 -mt-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 translate-x-1/2 -mb-32 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-10 w-72 h-72 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex flex-col justify-center relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* ========================================================================= */}
          {/* LEFT PANEL: BRAND, HERO, SVG ILLUSTRATIONS & VERIFIED HIGHLIGHTS (55%)     */}
          {/* ========================================================================= */}
          <motion.section
            aria-labelledby="welcome-hero-heading"
            initial="hidden"
            animate="visible"
            variants={fadeInVariant}
            className="lg:col-span-7 space-y-6 sm:space-y-8"
          >
            {/* Brand Logo & Pill */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-emerald-500/20 shrink-0">
                <Sparkles className="w-6 h-6 text-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    English Mastery Hub
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    Local-First
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  Nền tảng Học tiếng Anh Cá nhân hóa & Trợ lý AI
                </p>
              </div>
            </div>

            {/* Hero Headline */}
            <div className="space-y-3">
              <h2
                id="welcome-hero-heading"
                className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight sm:leading-tight"
              >
                Làm chủ tiếng Anh theo{' '}
                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                  cách của riêng bạn.
                </span>
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                Kết hợp sức mạnh của <strong>Trợ lý AI Tutor</strong>, thuật toán lặp lại ngắt quãng{' '}
                <strong>FSRS & SM-2</strong> và lộ trình chuẩn hóa <strong>Four Skills (A1–C2)</strong>.
                Bảo toàn 100% dữ liệu học tập an toàn trên thiết bị của bạn.
              </p>
            </div>

            {/* BRAND ILLUSTRATION: Floating Interactive Card & CEFR Progression */}
            <div
              aria-label="Minh họa phương pháp học FSRS và CEFR"
              className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5 backdrop-blur-sm"
            >
              {/* Illustration Top: Floating Vocabulary SRS Card */}
              <div className="p-4 bg-slate-950/90 border border-slate-750 rounded-2xl shadow-inner space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      B2 Vocabulary
                    </span>
                    <span className="text-xs text-slate-400 font-mono">/rɪˈzɪl.jəns/</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>FSRS: 98% Ghi nhớ</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white">resilience</h3>
                  <p className="text-xs sm:text-sm text-slate-300 italic">
                    (noun) Khả năng phục hồi, sự kiên cường vượt qua khó khăn.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 text-slate-300 font-medium">
                    <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
                    Khoảng cách ôn tập tiếp theo: <strong>4 ngày</strong>
                  </span>
                  <span className="text-slate-500 font-medium hidden sm:inline">
                    Độ khó: 0.32 • Độ ổn định: 4.8
                  </span>
                </div>
              </div>

              {/* Illustration Bottom: CEFR Progression Ladder */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                  <span className="flex items-center gap-1.5 text-white">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    Lộ trình 6 cấp độ CEFR chuẩn quốc tế
                  </span>
                  <span className="text-emerald-400 font-semibold text-[11px]">A1 đến C2</span>
                </div>

                <div className="grid grid-cols-6 gap-1 sm:gap-1.5">
                  {cefrLevels.map((lvl) => (
                    <div
                      key={lvl.code}
                      className="p-1.5 sm:p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-center flex flex-col items-center justify-center transition-transform hover:scale-105"
                    >
                      <span className="text-xs font-black text-emerald-300">{lvl.code}</span>
                      <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium hidden sm:inline">
                        {lvl.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* VERIFIED PRODUCT HIGHLIGHTS (4 key items) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
              {verifiedHighlights.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-900/50 hover:bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 transition-colors flex items-start gap-3"
                >
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                    {item.icon}
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-extrabold text-white leading-tight">
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-slate-400 leading-snug">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Local-First & PWA Offline Assurance */}
            <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Kiến trúc Local-First:</strong> Dữ liệu từ vựng, điểm số và bài làm luôn sẵn sàng ngoại tuyến (Offline PWA).
              </span>
            </div>
          </motion.section>

          {/* ========================================================================= */}
          {/* RIGHT PANEL: AUTHENTICATION CARD & GUEST CTA (45%)                        */}
          {/* ========================================================================= */}
          <motion.section
            id="welcome-auth-card"
            aria-labelledby="welcome-auth-heading"
            initial="hidden"
            animate="visible"
            variants={fadeInVariant}
            className="lg:col-span-5"
          >
            <div className="relative bg-slate-900/90 border-2 border-slate-750/90 rounded-3xl p-5 sm:p-8 shadow-2xl shadow-emerald-950/30 backdrop-blur-xl space-y-6">
              
              {/* Card Ambient Decoration */}
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

              {/* Card Header */}
              <div className="text-left space-y-1 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Không gian học viên
                  </span>
                </div>
                <h2 id="welcome-auth-heading" className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Khởi đầu hành trình học tập
                </h2>
                <p className="text-xs text-slate-400">
                  Đăng nhập để đồng bộ thành tích hoặc tạo tài khoản mới trong 30 giây.
                </p>
              </div>

              {/* Embedded Real AuthForm from Phase 2 */}
              <div className="relative z-10">
                <AuthForm
                  initialMode="signin"
                  includeConfirmPassword={true}
                  onSuccess={onAuthSuccess}
                />
              </div>

              {/* GUEST MODE CTA (Phase 3 & Phase 5) */}
              <div className="relative z-10 pt-4 border-t border-slate-800/80 space-y-3">
                <div className="text-center">
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-950 border border-slate-800 text-slate-400">
                    Hoặc học ngay không cần tài khoản
                  </span>
                </div>

                <button
                  type="button"
                  onClick={onContinueAsGuest}
                  aria-label="Tiếp tục học mà không cần tài khoản"
                  className="w-full min-h-[52px] py-3.5 px-4 bg-slate-950 hover:bg-slate-850 text-slate-200 hover:text-emerald-300 font-extrabold rounded-2xl transition-all border border-slate-750 hover:border-emerald-500/50 flex flex-col items-center justify-center gap-0.5 group shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span>Tiếp tục học mà không cần tài khoản</span>
                    <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <span className="text-[11px] text-slate-400 font-normal group-hover:text-slate-300">
                    Bạn vẫn có thể học và lưu tiến trình ngay trên thiết bị này.
                  </span>
                </button>
              </div>

            </div>
          </motion.section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500 relative z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>English Mastery Hub • Nền tảng Học tiếng Anh Local-First</span>
          <div className="flex items-center gap-3 text-[11px]">
            <span>10.381 Từ vựng</span>
            <span>•</span>
            <span>96 Bài Four Skills</span>
            <span>•</span>
            <span>CEFR A1–C2</span>
            <span>•</span>
            <span>PWA Offline</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default WelcomeView;
