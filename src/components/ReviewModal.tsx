import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  X, 
  RotateCw, 
  Volume2, 
  Sparkles, 
  Layers, 
  Brain, 
  ArrowRight, 
  Trophy, 
  Flame, 
  Play,
  AlertCircle,
  Clock,
  CheckCircle2,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAppStore } from '../store/useAppStore';
import { speakWord } from '../services/speechService';
import { 
  getDueReviewWords, 
  getTodayLearnedWords, 
  getAllLearnedWords 
} from '../services/srsAlgorithm';
import type { VocabWord, SRSGrade, ActiveTab } from '../types';

type ReviewStep = 'mode_selection' | 'reviewing' | 'completed';
export type ReviewMode = 'due_today' | 'today_learned' | 'all_learned';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (tab: ActiveTab) => void;
  defaultMode?: ReviewMode;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  defaultMode = 'due_today',
}) => {
  const { vocabularyList, processReview, audioVoice, audioSpeed } = useAppStore();

  const [step, setStep] = useState<ReviewStep>('mode_selection');
  const [selectedMode, setSelectedMode] = useState<ReviewMode>(defaultMode);
  const [batchLimit, setBatchLimit] = useState<number>(20); // 10, 20, or 0 (all)
  
  // Dynamic Review Queue
  const [activeQueue, setActiveQueue] = useState<VocabWord[]>([]);
  const [initialTotalCount, setInitialTotalCount] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionToast, setSessionToast] = useState<string | null>(null);

  const [sessionStats, setSessionStats] = useState({
    reviewedCount: 0,
    goodCount: 0,
    againCount: 0,
    xpEarned: 0,
  });

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // =========================================================================
  // SINGLE SOURCE OF TRUTH FILTERS (Đồng bộ tuyệt đối với Dashboard)
  // =========================================================================
  // 1. Chế độ Đến Hạn Ôn Hôm Nay (khớp 100% với widget Cần ôn hôm nay ngoài Dashboard)
  const dueReviewWords = useMemo(() => {
    return getDueReviewWords(vocabularyList);
  }, [vocabularyList]);

  // 2. Chế độ Từ Mới Học Hôm Nay
  const todayLearnedWords = useMemo(() => {
    return getTodayLearnedWords(vocabularyList, todayStr);
  }, [vocabularyList, todayStr]);

  // 3. Chế độ Toàn Bộ Kho Từ Cá Nhân Đã Học
  const allLearnedWords = useMemo(() => {
    return getAllLearnedWords(vocabularyList);
  }, [vocabularyList]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('mode_selection');
      setSelectedMode(defaultMode);
      setActiveQueue([]);
      setInitialTotalCount(0);
      setIsFlipped(false);
      setSessionToast(null);
      setSessionStats({
        reviewedCount: 0,
        goodCount: 0,
        againCount: 0,
        xpEarned: 0,
      });
    }
  }, [isOpen, defaultMode]);

  // Handle start session
  const handleStartReview = (mode: ReviewMode) => {
    setSelectedMode(mode);
    let pool: VocabWord[] = [];

    if (mode === 'due_today') {
      pool = [...dueReviewWords];
    } else if (mode === 'today_learned') {
      pool = [...todayLearnedWords];
    } else {
      pool = [...allLearnedWords];
    }

    if (pool.length === 0) {
      setActiveQueue([]);
      setInitialTotalCount(0);
      setIsFlipped(false);
      setSessionToast(null);
      setSessionStats({
        reviewedCount: 0,
        goodCount: 0,
        againCount: 0,
        xpEarned: 0,
      });
      setStep('reviewing');
      return;
    }

    // Sắp xếp ưu tiên: từ có interval ngắn hoặc srsLevel thấp ôn trước
    pool.sort((a, b) => (a.srsLevel || 0) - (b.srsLevel || 0));

    if (mode === 'all_learned' && batchLimit > 0) {
      pool = pool.slice(0, batchLimit);
    }

    setActiveQueue(pool);
    setInitialTotalCount(pool.length);
    setIsFlipped(false);
    setSessionToast(null);
    setSessionStats({
      reviewedCount: 0,
      goodCount: 0,
      againCount: 0,
      xpEarned: 0,
    });
    setStep('reviewing');
  };

  const currentWord = activeQueue[0];

  // Audio speech
  const handlePlayAudio = useCallback((text?: string) => {
    const wordToSpeak = text || currentWord?.word;
    if (wordToSpeak) {
      speakWord(wordToSpeak, audioVoice || 'en-US', audioSpeed || 1.0);
    }
  }, [currentWord, audioVoice, audioSpeed]);

  // Auto-play audio when card loads
  useEffect(() => {
    if (step === 'reviewing' && currentWord && !isFlipped) {
      const timer = setTimeout(() => {
        handlePlayAudio(currentWord.word);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [step, currentWord, isFlipped, handlePlayAudio]);

  // Grade action
  const handleGrade = useCallback((grade: SRSGrade) => {
    setActiveQueue((prevQueue) => {
      if (prevQueue.length === 0) return prevQueue;
      const current = prevQueue[0];

      // QUY TẮC CỐT LÕI:
      // Truyền selectedMode ('due_today' | 'today_learned' | 'all_learned') để xử lý độc lập từng chế độ
      processReview(current.id, grade, selectedMode);

      const isGood = grade >= 2;
      const earnedXp = grade === 3 ? 15 : grade === 2 ? 10 : grade === 1 ? 5 : 2;

      setSessionStats((prev) => ({
        ...prev,
        reviewedCount: prev.reviewedCount + 1,
        goodCount: isGood ? prev.goodCount + 1 : prev.goodCount,
        againCount: !isGood ? prev.againCount + 1 : prev.againCount,
        xpEarned: prev.xpEarned + earnedXp,
      }));

      setIsFlipped(false);

      if (grade === 0) {
        // Khi chọn "Quên" (grade 0):
        // Đẩy từ này về cuối hàng đợi activeQueue để người dùng ôn lại cho đến khi thuộc
        setSessionToast('Đã đưa từ về cuối lượt để bạn ôn lại!');
        setTimeout(() => setSessionToast(null), 2000);
        if (prevQueue.length <= 1) return prevQueue;
        const [first, ...rest] = prevQueue;
        return [...rest, first];
      } else {
        // Khi chọn "Khó" (1), "Tốt" (2), hoặc "Dễ" (3):
        // TỪ ĐÓ PHẢI ĐƯỢC XÓA NGAY KHỎI DANH SÁCH ĐANG ÔN, CHUYỂN SANG TỪ TIẾP THEO
        setSessionToast(null);
        const remaining = prevQueue.slice(1);

        if (remaining.length === 0) {
          // Hoàn thành toàn bộ thẻ trong phiên ôn!
          try {
            confetti({
              particleCount: 90,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#10B981', '#06B6D4', '#F59E0B', '#8B5CF6'],
            });
          } catch {
            // ignore
          }
          setStep('completed');
          return [];
        }

        return remaining;
      }
    });
  }, [processReview, selectedMode]);

  // Keyboard shortcut listener
  useEffect(() => {
    if (!isOpen || step !== 'reviewing') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.key === '1') {
        e.preventDefault();
        handleGrade(0); // Quên
      } else if (e.key === '2') {
        e.preventDefault();
        handleGrade(1); // Khó
      } else if (e.key === '3') {
        e.preventDefault();
        handleGrade(2); // Tốt
      } else if (e.key === '4') {
        e.preventDefault();
        handleGrade(3); // Dễ
      } else if (e.key === 'a' || e.key === 'A' || e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handlePlayAudio();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step, handleGrade, handlePlayAudio]);

  if (!isOpen) return null;

  // Tính số thứ tự tiến trình hiện tại
  const completedCount = initialTotalCount > 0 ? Math.max(0, initialTotalCount - activeQueue.length) : 0;
  const currentProgressPercent = initialTotalCount > 0 ? Math.round((completedCount / initialTotalCount) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Modal Container */}
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-slate-800/80 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Trung Tâm Ôn Tập</span>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-500/15 text-emerald-300 font-bold rounded-full border border-emerald-500/30">
                  SRS Spaced Repetition
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                {step === 'mode_selection' && 'Chọn chế độ ôn tập phù hợp với mục tiêu học tập'}
                {step === 'reviewing' && (
                  selectedMode === 'due_today'
                    ? 'Đang ôn: Từ đến hạn hôm nay (SRS Due)'
                    : selectedMode === 'today_learned'
                    ? 'Đang ôn: Từ mới học hôm nay'
                    : 'Đang ôn: Toàn bộ kho từ cá nhân'
                )}
                {step === 'completed' && 'Hoàn thành xuất sắc phiên ôn tập!'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl border border-slate-700/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
          
          {/* ========================================================================= */}
          {/* 1. MÀN HÌNH CHỌN 3 CHẾ ĐỘ ÔN TẬP (Chuẩn hóa Single Source of Truth)        */}
          {/* ========================================================================= */}
          {step === 'mode_selection' && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Chế độ 1: Cần ôn hôm nay (SRS Due Words - Khớp 100% với Dashboard widget) */}
                <div
                  onClick={() => handleStartReview('due_today')}
                  className="group relative p-4 sm:p-5 rounded-3xl border transition-all duration-200 flex flex-col justify-between bg-slate-950/70 border-emerald-500/40 hover:border-emerald-400 hover:bg-slate-950 hover:shadow-xl hover:shadow-emerald-500/10 cursor-pointer ring-1 ring-emerald-500/20"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
                        <Clock className="w-5 h-5" />
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-black rounded-xl">
                        {dueReviewWords.length} từ
                      </span>
                    </div>

                    <h3 className="text-base font-black text-white group-hover:text-emerald-300 transition-colors flex items-center gap-1.5">
                      <span>Đến hạn ôn hôm nay</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Các từ đã học trước đây mà thuật toán SRS SM-2 tính toán đã đến lúc cần nhắc lại.
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-800/80">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartReview('due_today');
                      }}
                      className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl shadow-lg shadow-emerald-500/20 text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Play className="w-3.5 h-3.5 fill-slate-950" />
                      <span>Ôn ngay {dueReviewWords.length > 0 ? `(${dueReviewWords.length} từ)` : ''}</span>
                    </button>
                  </div>
                </div>

                {/* Chế độ 2: Từ mới học hôm nay */}
                <div
                  onClick={() => todayLearnedWords.length > 0 && handleStartReview('today_learned')}
                  className={`group relative p-4 sm:p-5 rounded-3xl border transition-all duration-200 flex flex-col justify-between ${
                    todayLearnedWords.length > 0
                      ? 'bg-slate-950/70 border-cyan-500/30 hover:border-cyan-400 hover:bg-slate-950 hover:shadow-xl hover:shadow-cyan-500/10 cursor-pointer'
                      : 'bg-slate-950/40 border-slate-800 opacity-80'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <span className="px-2.5 py-1 bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 text-xs font-black rounded-xl">
                        {todayLearnedWords.length} từ
                      </span>
                    </div>

                    <h3 className="text-base font-black text-white group-hover:text-cyan-300 transition-colors">
                      Từ mới học hôm nay
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Củng cố tức thì những từ vừa nạp lần đầu trong ngày hôm nay để chuyển vào trí nhớ dài hạn.
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-800/80">
                    {todayLearnedWords.length > 0 ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartReview('today_learned');
                        }}
                        className="w-full py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl shadow-lg shadow-cyan-500/20 text-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-slate-950" />
                        <span>Ôn {todayLearnedWords.length} từ hôm nay</span>
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-[11px] text-amber-400/90 flex items-center gap-1.5 font-medium">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Hôm nay chưa học từ mới nào</span>
                        </div>
                        {onNavigate && (
                          <button
                            onClick={() => {
                              onClose();
                              onNavigate('flashcards');
                            }}
                            className="w-full py-1.5 px-3 bg-slate-800 hover:bg-slate-750 text-cyan-400 font-bold rounded-xl text-[11px] flex items-center justify-center gap-1 transition-colors"
                          >
                            <span>Học từ mới ngay</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Chế độ 3: Toàn bộ kho từ cá nhân đã học */}
                <div
                  onClick={() => allLearnedWords.length > 0 && handleStartReview('all_learned')}
                  className={`group relative p-4 sm:p-5 rounded-3xl border transition-all duration-200 flex flex-col justify-between ${
                    allLearnedWords.length > 0
                      ? 'bg-slate-950/70 border-purple-500/30 hover:border-purple-400 hover:bg-slate-950 hover:shadow-xl hover:shadow-purple-500/10 cursor-pointer'
                      : 'bg-slate-950/40 border-slate-800 opacity-80'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold">
                        <Layers className="w-5 h-5" />
                      </div>
                      <span className="px-2.5 py-1 bg-purple-500/15 text-purple-400 border border-purple-500/30 text-xs font-black rounded-xl">
                        {allLearnedWords.length} từ
                      </span>
                    </div>

                    <h3 className="text-base font-black text-white group-hover:text-purple-300 transition-colors">
                      Toàn bộ kho từ cá nhân
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Luyện tập ngẫu nhiên toàn bộ kho từ vựng bạn đã từng học để kiểm tra độ nhạy phản xạ.
                    </p>

                    {/* Batch Limit Selector */}
                    {allLearnedWords.length > 0 && (
                      <div className="mt-3 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[10px] text-slate-400 font-medium">Lượng:</span>
                        {[10, 20, 0].map((num) => (
                          <button
                            key={num}
                            onClick={() => setBatchLimit(num)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all ${
                              batchLimit === num
                                ? 'bg-purple-500 text-slate-950 border-purple-400'
                                : 'bg-slate-850 text-slate-400 border-slate-750 hover:text-white'
                            }`}
                          >
                            {num === 0 ? 'Tất cả' : `${num}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-800/80">
                    {allLearnedWords.length > 0 ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartReview('all_learned');
                        }}
                        className="w-full py-2.5 px-4 bg-purple-500 hover:bg-purple-400 text-slate-950 font-black rounded-xl shadow-lg shadow-purple-500/20 text-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-slate-950" />
                        <span>Bắt đầu ({batchLimit === 0 ? allLearnedWords.length : Math.min(batchLimit, allLearnedWords.length)} từ)</span>
                      </button>
                    ) : (
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 py-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Chưa có từ nào trong kho</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Thông tin giải thích thuật toán SRS */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-start gap-3 text-xs text-slate-400">
                <div className="p-1.5 bg-emerald-500/15 text-emerald-400 rounded-lg shrink-0 mt-0.5">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-slate-200">Quy tắc Spaced Repetition (SM-2):</strong> Khi bạn ấn <strong>"Tốt"</strong> hoặc <strong>"Dễ"</strong>, từ đó sẽ được đẩy lịch ôn sang các ngày sau (giảm ngay 1 từ cần ôn ở Dashboard và tăng 1 lượt Đã ôn). Nếu ấn <strong>"Quên"</strong>, từ sẽ được xếp về cuối lượt để bạn củng cố lại ngay trong phiên.
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. MÀN HÌNH ĐANG ÔN TẬP (FLASHCARD REVIEW FLOW CÓ HÀNG ĐỢI ĐỘNG)           */}
          {/* ========================================================================= */}
          {step === 'reviewing' && currentWord && (
            <div className="space-y-5">
              
              {/* Progress & Header Controls */}
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">
                    Còn lại: <span className="text-emerald-400 font-black text-sm">{activeQueue.length}</span> từ
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400 text-[11px]">
                    Đã ôn: <strong className="text-cyan-400">{completedCount}</strong> / {initialTotalCount}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePlayAudio(currentWord.word)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-xs flex items-center gap-1 transition-colors"
                    title="Phát âm (Phím A hoặc R)"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] font-bold">Phát âm</span>
                  </button>
                  <button
                    onClick={() => setIsFlipped((prev) => !prev)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-xs flex items-center gap-1 transition-colors"
                    title="Lật thẻ (Phím Space)"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] font-bold">Lật thẻ</span>
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-300 rounded-full"
                  style={{ width: `${currentProgressPercent}%` }}
                />
              </div>

              {/* Toast thông báo nếu ấn Quên */}
              {sessionToast && (
                <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-center text-xs font-bold text-rose-300 animate-in fade-in slide-in-from-top-1 duration-150">
                  {sessionToast}
                </div>
              )}

              {/* The Interactive Flashcard */}
              <div
                onClick={() => setIsFlipped((prev) => !prev)}
                className="relative min-h-[260px] sm:min-h-[290px] bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-3xl p-6 sm:p-8 flex flex-col justify-between cursor-pointer transition-all shadow-xl group select-none"
              >
                {/* Card Header Info */}
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold rounded-xl">
                      {currentWord.tag || 'Daily'}
                    </span>
                    {currentWord.level && (
                      <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[10px] font-bold rounded-lg">
                        {currentWord.level}
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-500 group-hover:text-slate-400 flex items-center gap-1 transition-colors">
                    <RotateCw className="w-3 h-3" />
                    <span>{isFlipped ? 'Mặt sau' : 'Mặt trước (Nhấp để lật)'}</span>
                  </span>
                </div>

                {/* Card Main Content */}
                <div className="py-4 text-center my-auto space-y-3">
                  {/* Front Side: English word + IPA */}
                  <div>
                    <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                      {currentWord.word}
                    </h3>
                    {(currentWord.ipa || currentWord.phonetic) && (
                      <div className="text-sm font-mono text-cyan-400 mt-1.5">
                        {currentWord.ipa || currentWord.phonetic}
                      </div>
                    )}
                  </div>

                  {/* Back Side: Meaning & Contextual Example */}
                  {isFlipped ? (
                    <div className="space-y-3 pt-2 animate-in fade-in zoom-in-95 duration-150">
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                        <div className="text-base sm:text-lg font-bold text-emerald-300">
                          {currentWord.meaning}
                        </div>
                      </div>

                      {currentWord.example && (
                        <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-2xl text-xs text-slate-300 text-left">
                          <span className="text-slate-500 font-bold block mb-1">Ví dụ:</span>
                          <p className="italic">"{currentWord.example}"</p>
                          {(currentWord.exampleVi || currentWord.exampleMeaning) && (
                            <p className="text-slate-400 text-[11px] mt-1 border-t border-slate-800 pt-1">
                              👉 {currentWord.exampleVi || currentWord.exampleMeaning}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">
                      (Bấm phím Space hoặc nhấp vào thẻ để xem nghĩa tiếng Việt & ví dụ)
                    </p>
                  )}
                </div>

                {/* Card Footer Hint */}
                <div className="text-center text-[11px] text-slate-500 pt-2 border-t border-slate-900">
                  SRS Interval hiện tại: <strong className="text-slate-400">{currentWord.interval || 0} ngày</strong> • Lần ôn: <strong className="text-slate-400">{currentWord.srsLevel || 0}</strong>
                </div>
              </div>

              {/* 4 SRS Grading Buttons */}
              <div className="space-y-2">
                <div className="text-[11px] text-slate-400 text-center font-medium">
                  Đánh giá mức độ nhớ của bạn sau khi xem thẻ:
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Again (Quên) */}
                  <button
                    onClick={() => handleGrade(0)}
                    className="p-3 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 hover:border-rose-500/60 text-rose-400 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 group"
                  >
                    <span className="text-xs font-black">Quên</span>
                    <span className="text-[10px] text-rose-400/70 font-mono">Phím 1 • Ôn lại cuối lượt</span>
                  </button>

                  {/* Hard (Khó) */}
                  <button
                    onClick={() => handleGrade(1)}
                    className="p-3 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 hover:border-amber-500/60 text-amber-400 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 group"
                  >
                    <span className="text-xs font-black">Khó</span>
                    <span className="text-[10px] text-amber-400/70 font-mono">Phím 2 • 1 ngày</span>
                  </button>

                  {/* Good (Tốt) */}
                  <button
                    onClick={() => handleGrade(2)}
                    className="p-3 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 group"
                  >
                    <span className="text-xs font-black">Tốt</span>
                    <span className="text-[10px] text-emerald-400/70 font-mono">Phím 3 • Tăng hạn</span>
                  </button>

                  {/* Easy (Dễ) */}
                  <button
                    onClick={() => handleGrade(3)}
                    className="p-3 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 hover:border-cyan-500/60 text-cyan-400 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 group"
                  >
                    <span className="text-xs font-black">Dễ</span>
                    <span className="text-[10px] text-cyan-400/70 font-mono">Phím 4 • Nhớ sâu</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* 2B. TRẠNG THÁI TRỐNG KHI KHÔNG CÓ TỪ NÀO CẦN ÔN (EMPTY STATE)             */}
          {/* ========================================================================= */}
          {step === 'reviewing' && !currentWord && (
            <div className="text-center py-12 px-4 space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  Tuyệt vời!
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Bạn không có từ nào cần ôn hôm nay. Hãy quay lại vào ngày mai hoặc ôn lại từ trong kho từ vựng!
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
                <button
                  onClick={() => setStep('mode_selection')}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-2xl border border-slate-700 text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span>Chọn chế độ khác</span>
                </button>

                {allLearnedWords.length > 0 && (
                  <button
                    onClick={() => handleStartReview('all_learned')}
                    className="w-full sm:w-auto px-5 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Ôn lại từ trong kho ({allLearnedWords.length})</span>
                  </button>
                )}

                <button
                  onClick={onClose}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl shadow-lg shadow-emerald-500/20 text-xs transition-all"
                >
                  Quay lại
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. MÀN HÌNH TỔNG KẾT SAU KHI HOÀN THÀNH PHIÊN ÔN                         */}
          {/* ========================================================================= */}
          {step === 'completed' && (
            <div className="text-center py-4 space-y-6 animate-in fade-in zoom-in-95 duration-200">
              
              <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-slate-950 shadow-xl shadow-emerald-500/20">
                <Trophy className="w-8 h-8 fill-slate-950" />
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  Hoàn Thành Phiên Ôn Tập!
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Bạn đã củng cố thành công <strong className="text-emerald-400">{sessionStats.reviewedCount} lượt từ vựng</strong>. Tiến độ đã được lưu vào hệ thống và cập nhật trực tiếp vào chỉ số "Đã ôn" hôm nay!
                </p>
              </div>

              {/* Stats Card Grid */}
              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto text-xs">
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl">
                  <div className="text-slate-400 text-[11px]">Đã ôn xong</div>
                  <div className="text-lg font-black text-emerald-400 mt-0.5">
                    {sessionStats.reviewedCount} <span className="text-xs font-normal">lượt</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl">
                  <div className="text-slate-400 text-[11px]">Nhớ tốt</div>
                  <div className="text-lg font-black text-cyan-400 mt-0.5">
                    {sessionStats.goodCount} <span className="text-xs font-normal">từ</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl">
                  <div className="text-slate-400 text-[11px]">XP nhận được</div>
                  <div className="text-lg font-black text-amber-400 mt-0.5">
                    +{sessionStats.xpEarned} <span className="text-xs font-normal">XP</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setStep('mode_selection')}
                  className="w-full sm:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-2xl border border-slate-700 text-xs transition-colors"
                >
                  Ôn tiếp chế độ khác
                </button>

                <button
                  onClick={onClose}
                  className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl shadow-lg shadow-emerald-500/20 text-xs transition-all"
                >
                  Về Trang Chủ (Dashboard)
                </button>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
};
