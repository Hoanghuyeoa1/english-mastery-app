import React, { useState } from 'react';
import { 
  Sparkles, 
  Rocket, 
  Award, 
  Code, 
  Briefcase, 
  Coffee, 
  GraduationCap, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAppStore } from '../store/useAppStore';

interface OnboardingModalProps {
  isOpen: boolean;
}

type GoalOption = 'tech' | 'business' | 'toeic' | 'ielts' | 'daily';

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen }) => {
  const { setProfileName, syncVocab5000 } = useAppStore();
  const [userName, setUserName] = useState('');
  const [selectedGoal, setSelectedGoal] = useState<GoalOption>('daily');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = userName.trim();
    if (!clean) return;

    setIsSubmitting(true);
    setProfileName(clean, selectedGoal);
    syncVocab5000();

    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.5 },
    });

    setIsSubmitting(false);
  };

  const goals: Array<{ id: GoalOption; title: string; desc: string; icon: React.ReactNode }> = [
    {
      id: 'tech',
      title: '💻 Tiếng Anh Công Nghệ & IT',
      desc: 'Dành cho Developers, Data, Cloud & Kỹ sư phần mềm',
      icon: <Code className="w-5 h-5 text-teal-400" />
    },
    {
      id: 'business',
      title: '💼 Công Sở & Doanh Nghiệp',
      desc: 'Viết email, họp thuyết trình và đàm phán quốc tế',
      icon: <Briefcase className="w-5 h-5 text-blue-400" />
    },
    {
      id: 'toeic',
      title: '🎯 Luyện Thi TOEIC 750+',
      desc: 'Trắc nghiệm nghe đọc & chứng chỉ ETS công sở',
      icon: <Award className="w-5 h-5 text-amber-400" />
    },
    {
      id: 'ielts',
      title: '🎓 Luyện Thi IELTS 7.0+',
      desc: 'Từ vựng học thuật C1-C2 & tư duy phản biện',
      icon: <GraduationCap className="w-5 h-5 text-purple-400" />
    },
    {
      id: 'daily',
      title: '☕ Giao Tiếp Đời Thường',
      desc: 'Phản xạ tự nhiên, du lịch & văn hóa thường nhật',
      icon: <Coffee className="w-5 h-5 text-emerald-400" />
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border-2 border-emerald-500/40 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 overflow-hidden">
        
        {/* Glow Background Gradient */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="text-center space-y-2 relative z-10">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <Rocket className="w-8 h-8" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Chào mừng bạn đến với English Master! 🚀
          </h2>

          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Hãy cho chúng mình biết tên của bạn để thiết lập không gian học tập Spaced Repetition cá nhân hóa nhé.
          </p>
        </div>

        {/* Onboarding Form */}
        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          
          {/* Input Name */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
              Tên hoặc Biệt danh của bạn:
            </label>
            <input
              type="text"
              required
              autoFocus
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="VD: Alex, Minh Anh, Hoàng, Sophie..."
              className="w-full bg-slate-950 border border-slate-750 focus:border-emerald-500 rounded-2xl px-5 py-3.5 text-base font-bold text-white placeholder-slate-600 focus:outline-none transition-colors"
            />
          </div>

          {/* Goal Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
              Mục tiêu học tập ưu tiên của bạn:
            </label>

            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1 no-scrollbar">
              {goals.map((g) => {
                const isSelected = selectedGoal === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGoal(g.id)}
                    className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300 shadow-md ring-1 ring-emerald-400/40'
                        : 'bg-slate-950/80 hover:bg-slate-850 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-750 flex items-center justify-center shrink-0">
                      {g.icon}
                    </div>
                    <div className="flex-1">
                      <span className="text-xs font-extrabold text-white block leading-tight">{g.title}</span>
                      <span className="text-[11px] text-slate-400 block">{g.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Privacy Note */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 justify-center">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Toàn bộ dữ liệu được lưu cục bộ an toàn trong trình duyệt của bạn.</span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!userName.trim() || isSubmitting}
            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-2xl shadow-xl shadow-emerald-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm sm:text-base flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Bắt Đầu Hành Trình Học Tập ✨</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
};
