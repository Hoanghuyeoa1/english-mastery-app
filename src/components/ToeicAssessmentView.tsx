import React, { useState, useEffect, useMemo } from 'react';
import { 
  Award, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Play, 
  Volume2, 
  RotateCcw, 
  Sparkles, 
  BookOpen, 
  Mic, 
  MicOff, 
  ShieldCheck, 
  BarChart3, 
  ChevronRight, 
  Calendar,
  PlusCircle,
  Check,
  Image as ImageIcon,
  PenTool,
  HelpCircle,
  Headphones
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAppStore } from '../store/useAppStore';
import { speakWord, createSpeechRecognizer } from '../services/speechService';
import { TOEIC_QUESTION_BANK } from '../data/toeicQuestionsData';
import { calculateToeicScores, ToeicScoreEvaluation } from '../services/toeicScoring';
import { ToeicQuestion, ToeicTestSession } from '../types';

type ExamViewStage = 'lobby' | 'testing' | 'report';
type ExamMode = '2skills_mini' | '2skills_full' | '4skills';

export const ToeicAssessmentView: React.FC = () => {
  const { 
    addCustomWord, 
    vocabularyList, 
    gainXP, 
    audioVoice, 
    audioSpeed, 
    profile 
  } = useAppStore();

  const [stage, setStage] = useState<ExamViewStage>('lobby');
  const [examMode, setExamMode] = useState<ExamMode>('2skills_mini');
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(15 * 60); // giây
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Speaking & Writing States
  const [isRecording, setIsRecording] = useState(false);
  const [speakingTranscript, setSpeakingTranscript] = useState('');
  const [writingInput, setWritingInput] = useState('');

  // Results & History
  const [scoreResult, setScoreResult] = useState<ToeicScoreEvaluation | null>(null);
  const [testHistory, setTestHistory] = useState<ToeicTestSession[]>(() => {
    try {
      const saved = localStorage.getItem('english_mastery_toeic_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [savedVocabNotice, setSavedVocabNotice] = useState<string | null>(null);

  // Lọc câu hỏi theo chế độ thi
  const examQuestions = useMemo(() => {
    if (examMode === '2skills_mini') {
      return TOEIC_QUESTION_BANK.filter((q) => q.skill === 'listening' || q.skill === 'reading').slice(0, 10);
    } else if (examMode === '2skills_full') {
      return TOEIC_QUESTION_BANK.filter((q) => q.skill === 'listening' || q.skill === 'reading');
    } else {
      return TOEIC_QUESTION_BANK;
    }
  }, [examMode]);

  const currentQ: ToeicQuestion | undefined = examQuestions[currentQuestionIdx];

  // Bắt đầu làm bài thi
  const handleStartExam = (mode: ExamMode) => {
    setExamMode(mode);
    setCurrentQuestionIdx(0);
    setUserAnswers({});
    setSpeakingTranscript('');
    setWritingInput('');
    setSavedVocabNotice(null);

    const duration = mode === '2skills_mini' ? 15 * 60 : mode === '2skills_full' ? 30 * 60 : 35 * 60;
    setTimeLeft(duration);
    setIsTimerRunning(true);
    setStage('testing');
  };

  // Đếm ngược thời gian làm bài
  useEffect(() => {
    if (!isTimerRunning || stage !== 'testing') return;

    if (timeLeft <= 0) {
      handleSubmitExam();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isTimerRunning, timeLeft, stage]);

  // Chọn đáp án A, B, C, D
  const handleSelectAnswer = (choiceLetter: string) => {
    if (!currentQ) return;
    setUserAnswers((prev) => ({
      ...prev,
      [currentQ.id]: choiceLetter,
    }));
  };

  // Thu âm phần Speaking qua Micro
  const handleToggleSpeakingRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const recognizer = createSpeechRecognizer(
      (text, isFinal) => {
        setSpeakingTranscript(text);
        if (isFinal) {
          setIsRecording(false);
          if (currentQ) {
            setUserAnswers((prev) => ({ ...prev, [currentQ.id]: text }));
          }
        }
      },
      (err) => {
        console.warn('Speaking error:', err);
        setIsRecording(false);
      }
    );

    if (recognizer) {
      setIsRecording(true);
    }
  };

  // Nộp bài & Đánh giá điểm số chuẩn ETS
  const handleSubmitExam = () => {
    setIsTimerRunning(false);

    const evaluated = calculateToeicScores({
      mode: examMode,
      questions: examQuestions,
      userAnswers,
      speakingTranscript: speakingTranscript.trim(),
      writingText: writingInput.trim(),
    });

    setScoreResult(evaluated);

    // Lưu vào lịch sử thi
    const newSession: ToeicTestSession = {
      id: `toeic_test_${Date.now()}`,
      mode: examMode,
      title: examMode === '2skills_mini' 
        ? 'TOEIC 2 Kỹ Năng (Mini-Test)' 
        : examMode === '2skills_full' 
        ? 'TOEIC 2 Kỹ Năng (Standard)' 
        : 'TOEIC 4 Kỹ Năng Toàn Diện',
      date: new Date().toISOString(),
      totalQuestions: examQuestions.length,
      durationMinutes: examMode === '2skills_mini' ? 15 : examMode === '2skills_full' ? 30 : 35,
      userAnswers,
      speakingTranscript,
      writingText: writingInput,
      listeningScore: evaluated.listeningScore,
      readingScore: evaluated.readingScore,
      speakingScore: evaluated.speakingScore,
      writingScore: evaluated.writingScore,
      totalScore: evaluated.totalScore,
      cefrLevel: evaluated.cefrLevel,
    };

    const updatedHistory = [newSession, ...testHistory].slice(0, 15);
    setTestHistory(updatedHistory);
    try {
      localStorage.setItem('english_mastery_toeic_history', JSON.stringify(updatedHistory));
    } catch {}

    // Thưởng XP theo kết quả
    const earnedXP = Math.round(evaluated.totalScore / 10);
    gainXP(earnedXP);

    setStage('report');
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  };

  // Lưu nhanh tất cả từ vựng trong đề vào Flashcard SRS
  const handleSaveAllKeyVocabToSRS = () => {
    let addedCount = 0;
    const existingMap = new Set(vocabularyList.map((w) => w.word.toLowerCase().trim()));

    examQuestions.forEach((q) => {
      if (q.keyVocabulary) {
        q.keyVocabulary.forEach((v) => {
          if (!existingMap.has(v.word.toLowerCase().trim())) {
            addCustomWord({
              word: v.word,
              ipa: v.ipa,
              partOfSpeech: 'noun',
              meaning: v.meaning,
              definitionEn: `Essential TOEIC Vocabulary in ${q.part}: ${v.word}.`,
              example: q.audioScript || q.questionText,
              exampleMeaning: q.vietnameseTranslation,
              tag: 'TOEIC',
            });
            existingMap.add(v.word.toLowerCase().trim());
            addedCount++;
          }
        });
      }
    });

    setSavedVocabNotice(`Đã lưu thành công +${addedCount} từ vựng bài thi vào kho Flashcard SRS!`);
    setTimeout(() => setSavedVocabNotice(null), 3500);
  };

  // Format giây thành MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      
      {/* 1. MÀN HÌNH SẢNH CHỜ (EXAM LOBBY) */}
      {stage === 'lobby' && (
        <div className="space-y-6">
          
          {/* Header Banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-widest">
              <Award className="w-4 h-4" />
              <span>Hệ Thống Đánh Giá & Dự Đoán Điểm Số Chuẩn ETS</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Khảo Sát Năng Lực TOEIC 2 & 4 Kỹ Năng
            </h1>

            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              Thi thử mô phỏng format đề thi TOEIC chuẩn ETS, dự đoán thang điểm <strong>10 – 990 (LR)</strong> và <strong>0 – 400 (SW)</strong>, phân tích chi tiết lỗi sai và quy đổi sang khung năng lực Châu Âu <strong>CEFR (A1 - C1)</strong>.
            </p>
          </div>

          {/* 2 Chế độ thi chính */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Mode 1: TOEIC 2 Kỹ Năng */}
            <div className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col justify-between space-y-6 transition-all group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <BookOpen className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="text-xl font-black text-white group-hover:text-amber-400 transition-colors">
                    TOEIC 2 Kỹ Năng (Listening & Reading)
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
                    Kiểm tra toàn diện <strong>Listening (Part 1 - 4)</strong> và <strong>Reading (Part 5 - 7)</strong>. Thang điểm chuẩn 10 - 990 điểm.
                  </p>
                </div>

                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Part 1 Photographs với ảnh trực quan & ẩn văn bản chuẩn ETS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Đầy đủ audio giọng đọc bản xứ US / UK</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
                <button
                  onClick={() => handleStartExam('2skills_mini')}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl shadow-lg shadow-amber-500/20 transition-all text-xs sm:text-sm flex items-center justify-center gap-1.5"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>Mini-Test (15 Phút)</span>
                </button>

                <button
                  onClick={() => handleStartExam('2skills_full')}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-2xl border border-slate-700 transition-all text-xs sm:text-sm"
                >
                  <span>Standard (30 Phút)</span>
                </button>
              </div>
            </div>

            {/* Mode 2: TOEIC 4 Kỹ Năng */}
            <div className="bg-slate-900 border border-slate-800 hover:border-cyan-500/40 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col justify-between space-y-6 transition-all group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Mic className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="text-xl font-black text-white group-hover:text-cyan-400 transition-colors">
                    TOEIC 4 Kỹ Năng Toàn Diện
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
                    Bao gồm trọn bộ <strong>Listening & Reading (990)</strong> + <strong>Speaking & Writing (400)</strong>.
                  </p>
                </div>

                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                    <span>Thu âm phát âm Speaking & Chấm điểm theo độ chuẩn</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                    <span>Viết Email công sở & Đánh giá độ dài, cấu trúc</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <button
                  onClick={() => handleStartExam('4skills')}
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-black rounded-2xl shadow-lg shadow-cyan-500/20 transition-all text-xs sm:text-sm flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Bắt Đầu Thi 4 Kỹ Năng (35 Phút)</span>
                </button>
              </div>
            </div>

          </div>

          {/* Lịch sử các lần thi thử */}
          {testHistory.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-400" />
                <span>Lịch Sử Thi Thử Gần Đây</span>
              </h3>

              <div className="space-y-2.5">
                {testHistory.map((sess) => (
                  <div 
                    key={sess.id}
                    className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-300">{sess.title}</span>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{new Date(sess.date).toLocaleDateString('vi-VN')}</span>
                        <span>•</span>
                        <span>{sess.totalQuestions} câu</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-[11px] text-slate-500 block">Listening + Reading</span>
                        <strong className="text-lg font-black text-amber-400">{sess.totalScore} / 990</strong>
                      </div>

                      {sess.speakingScore !== undefined && sess.writingScore !== undefined && (
                        <div className="text-right border-l border-slate-800 pl-4">
                          <span className="text-[11px] text-slate-500 block">Speaking + Writing</span>
                          <strong className="text-lg font-black text-cyan-400">{sess.speakingScore + sess.writingScore} / 400</strong>
                        </div>
                      )}

                      <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold">
                        CEFR {sess.cefrLevel}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MÀN HÌNH LÀM BÀI THI (TESTING INTERFACE)                                */}
      {/* ========================================================================= */}
      {stage === 'testing' && currentQ && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          {/* Top Status Bar: Part Badge, Progress, Timer & Submit Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-xs font-black uppercase">
                {currentQ.part.toUpperCase()}
              </span>
              <span className="text-xs text-slate-400">
                Câu hỏi <strong className="text-white font-bold">{currentQuestionIdx + 1}</strong> / {examQuestions.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Countdown Timer */}
              <div className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-mono font-bold text-sm border ${
                timeLeft < 120 ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse' : 'bg-slate-800 border-slate-750 text-emerald-400'
              }`}>
                <Clock className="w-4 h-4" />
                <span>{formatTimer(timeLeft)}</span>
              </div>

              {/* Submit Button */}
              <button
                onClick={() => {
                  if (confirm('Bạn có chắc muốn nộp bài và chấm điểm ngay bây giờ?')) {
                    handleSubmitExam();
                  }
                }}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all"
              >
                Nộp Bài
              </button>
            </div>
          </div>

          {/* Question Palette Grid */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {examQuestions.map((q, idx) => {
              const isAnswered = !!userAnswers[q.id];
              const isCurrent = idx === currentQuestionIdx;
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIdx(idx)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all shrink-0 ${
                    isCurrent
                      ? 'bg-amber-500 text-slate-950 font-black ring-2 ring-amber-400/50'
                      : isAnswered
                      ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-300'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-750'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Listening Audio Section (If Skill is Listening) */}
          {currentQ.skill === 'listening' && currentQ.audioScript && (
            <div className="p-4 bg-slate-850 border border-slate-750 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">
                    Đoạn Audio Nghe ({currentQ.part === 'part1_photos' ? 'Part 1: Nghe 4 phương án A, B, C, D' : currentQ.part})
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Bấm nút để nghe phát âm bài thi
                  </span>
                </div>
              </div>

              <button
                onClick={() => speakWord(currentQ.audioScript || '', audioVoice, audioSpeed)}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-105"
              >
                <Play className="w-3.5 h-3.5 fill-slate-950" />
                <span>Phát Audio</span>
              </button>
            </div>
          )}

          {/* Reading Passage Section (If Part 6 or 7) */}
          {currentQ.passage && (
            <div className="p-5 bg-slate-850/80 border border-slate-750 rounded-2xl space-y-2 text-xs sm:text-sm text-slate-200 font-serif leading-relaxed whitespace-pre-line max-h-56 overflow-y-auto">
              {currentQ.passage}
            </div>
          )}

          {/* ========================================================================= */}
          {/* SPECIAL RENDER FOR PART 1: PHOTOGRAPHS (IMAGE + 4 HIDDEN-TEXT CHOICES)   */}
          {/* ========================================================================= */}
          {currentQ.part === 'part1_photos' ? (
            <div className="space-y-6">
              
              {/* Question Title Instruction */}
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                  {currentQ.questionText}
                </h3>
                <p className="text-xs text-amber-400/90 font-medium">
                  💡 Format TOEIC chuẩn: Hãy nghe đoạn Audio và click chọn phương án đúng tương ứng (A, B, C, D).
                </p>
              </div>

              {/* 1. Display Photograph */}
              {currentQ.imageUrl ? (
                <div className="relative rounded-3xl overflow-hidden border-2 border-slate-750 bg-slate-950 shadow-2xl max-h-[380px] flex items-center justify-center group">
                  <img
                    src={currentQ.imageUrl}
                    alt="TOEIC Part 1 Photograph"
                    className="w-full h-auto max-h-[380px] object-cover rounded-2xl transition-transform duration-500 group-hover:scale-[1.02]"
                    loading="eager"
                  />
                  <div className="absolute top-3 left-3 px-3 py-1 bg-slate-950/80 backdrop-blur-md border border-slate-700/80 rounded-xl text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                    <span>Hình ảnh câu hỏi số {currentQuestionIdx + 1}</span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-56 rounded-3xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 text-xs">
                  <ImageIcon className="w-8 h-8 mr-2 opacity-40" />
                  <span>Ảnh minh họa đề bài đang được tải...</span>
                </div>
              )}

              {/* 2. 4 Clean Choice Buttons (A), (B), (C), (D) without displaying text during test */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Chọn phương án bạn nghe được:
                </span>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  {['A', 'B', 'C', 'D'].map((choiceLetter) => {
                    const isSelected = userAnswers[currentQ.id] === choiceLetter;

                    return (
                      <button
                        key={choiceLetter}
                        onClick={() => handleSelectAnswer(choiceLetter)}
                        className={`py-4 sm:py-5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 shadow-md ${
                          isSelected
                            ? 'bg-gradient-to-br from-amber-500 to-orange-500 border-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/25 scale-105 ring-2 ring-amber-400'
                            : 'bg-slate-850 hover:bg-slate-800 border-slate-750 text-white hover:border-slate-600'
                        }`}
                      >
                        <span className={`text-xl sm:text-2xl font-black ${isSelected ? 'text-slate-950' : 'text-amber-400'}`}>
                          ({choiceLetter})
                        </span>
                        <span className={`text-[11px] font-bold ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>
                          {isSelected ? 'Đã Chọn' : 'Bấm để chọn'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          ) : (
            /* Standard Multiple Choice Options for Part 2 - 7 */
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                  {currentQ.questionText}
                </h3>
              </div>

              {currentQ.options && (
                <div className="grid grid-cols-1 gap-2.5">
                  {currentQ.options.map((option, idx) => {
                    const choiceLetter = ['A', 'B', 'C', 'D'][idx];
                    const isSelected = userAnswers[currentQ.id] === choiceLetter;

                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectAnswer(choiceLetter)}
                        className={`p-4 rounded-2xl border text-left text-xs sm:text-sm font-medium transition-all flex items-center gap-3 ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-400 text-amber-300 font-bold shadow-md shadow-amber-500/10'
                            : 'bg-slate-850 hover:bg-slate-800 border-slate-750 text-slate-300'
                        }`}
                      >
                        <span className={`w-7 h-7 rounded-lg border flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {choiceLetter}
                        </span>
                        <span className="flex-1 leading-snug">{option}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Speaking Mic Interface (If Skill is Speaking) */}
          {currentQ.skill === 'speaking' && (
            <div className="p-6 bg-slate-850 border border-slate-750 rounded-2xl text-center space-y-4">
              <p className="text-xs text-slate-300">
                Nhấn Micro và đọc to đoạn văn trên:
              </p>

              <button
                onClick={handleToggleSpeakingRecord}
                className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto transition-all shadow-xl ${
                  isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gradient-to-tr from-cyan-500 to-teal-400 text-slate-950'
                }`}
              >
                {isRecording ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
              </button>

              {speakingTranscript ? (
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200">
                  Đã thu âm: <strong className="text-cyan-400">"{speakingTranscript}"</strong>
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 italic">
                  (Nếu bạn bấm câu tiếp mà không thu âm, câu hỏi này sẽ được tính 0 điểm)
                </div>
              )}
            </div>
          )}

          {/* Writing Email Interface (If Skill is Writing) */}
          {currentQ.skill === 'writing' && (
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-400">Soạn thảo email trả lời:</span>
              <textarea
                value={writingInput}
                onChange={(e) => {
                  setWritingInput(e.target.value);
                  setUserAnswers((prev) => ({ ...prev, [currentQ.id]: e.target.value }));
                }}
                rows={6}
                placeholder="Dear Mr. Davis, Thank you for contacting our support team..."
                className="w-full bg-slate-950 border border-slate-750 focus:border-cyan-500 rounded-2xl p-4 text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none leading-relaxed"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Số từ: <strong className="text-white">{writingInput.trim().split(/\s+/).filter(Boolean).length}</strong> từ</span>
                <span>(Bỏ trống = 0 điểm)</span>
              </div>
            </div>
          )}

          {/* Navigation Controls: Previous / Next Question */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              disabled={currentQuestionIdx === 0}
              onClick={() => setCurrentQuestionIdx((prev) => prev - 1)}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-750 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 font-bold rounded-xl text-xs transition-all"
            >
              Câu Trước
            </button>

            {currentQuestionIdx + 1 < examQuestions.length ? (
              <button
                onClick={() => setCurrentQuestionIdx((prev) => prev + 1)}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5"
              >
                <span>Câu Tiếp</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmitExam}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all"
              >
                Nộp Bài & Chấm Điểm
              </button>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MÀN HÌNH BÁO CÁO KẾT QUẢ & REVIEW CHI TIẾT (SCORE REPORT)              */}
      {/* ========================================================================= */}
      {stage === 'report' && scoreResult && (
        <div className="space-y-6">
          
          {/* Phiếu Điểm TOEIC Mô Phỏng ETS */}
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-10 shadow-2xl text-center space-y-6">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-amber-400">
                Official Score Report • TOEIC Assessment Center
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white">
                Chứng Nhận Năng Lực Tiếng Anh TOEIC
              </h2>
              <p className="text-xs text-slate-400">
                Học viên: <strong className="text-white">{profile.name}</strong> • Ngày đánh giá: {new Date().toLocaleDateString('vi-VN')}
              </p>
            </div>

            {/* ========================================================================= */}
            {/* SCORE DISPLAY: SEPARATE 2-SKILLS (990) VS 4-SKILLS (990 + 400)           */}
            {/* ========================================================================= */}
            {!scoreResult.is4Skills ? (
              /* TOEIC 2 Kỹ Năng LR (Thang 990 duy nhất) */
              <div className="space-y-6">
                <div className="py-2">
                  <div className="inline-block p-6 sm:p-8 bg-slate-950/80 border border-amber-500/40 rounded-3xl shadow-xl">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      Tổng Điểm TOEIC (Listening + Reading)
                    </span>
                    <span className="text-5xl sm:text-6xl font-black bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
                      {scoreResult.totalScore}
                    </span>
                    <span className="text-xs text-slate-400 block mt-1">/ 990 thang điểm chuẩn ETS</span>
                  </div>
                </div>

                {/* 2 Kỹ Năng Component Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3 text-left">
                      <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                        <Headphones className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 font-semibold block">Listening (Nghe Hiểu)</span>
                        <span className="text-[11px] text-slate-500">Đúng {scoreResult.listeningCorrect}/{scoreResult.listeningTotal} câu</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <strong className="text-2xl font-black text-white">{scoreResult.listeningScore}</strong>
                      <span className="text-[10px] text-slate-500 block">/ 495</span>
                    </div>
                  </div>

                  <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3 text-left">
                      <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 font-semibold block">Reading (Đọc Hiểu)</span>
                        <span className="text-[11px] text-slate-500">Đúng {scoreResult.readingCorrect}/{scoreResult.readingTotal} câu</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <strong className="text-2xl font-black text-white">{scoreResult.readingScore}</strong>
                      <span className="text-[10px] text-slate-500 block">/ 495</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* TOEIC 4 Kỹ Năng: Hiển thị song song 2 bảng LR (990) và SW (400) */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                
                {/* Certificate 1: TOEIC Listening & Reading (990) */}
                <div className="p-6 bg-slate-950/90 border border-amber-500/30 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-xs font-bold text-amber-400 block uppercase">Chứng Chỉ 1</span>
                      <h4 className="text-base font-black text-white">TOEIC Listening & Reading</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-amber-400">{scoreResult.totalScore}</span>
                      <span className="text-[10px] text-slate-500 block">/ 990</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Listening</span>
                      <strong className="text-lg font-black text-white">{scoreResult.listeningScore}</strong>
                      <span className="text-slate-500 text-[10px] block">Đúng {scoreResult.listeningCorrect}/{scoreResult.listeningTotal}</span>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Reading</span>
                      <strong className="text-lg font-black text-white">{scoreResult.readingScore}</strong>
                      <span className="text-slate-500 text-[10px] block">Đúng {scoreResult.readingCorrect}/{scoreResult.readingTotal}</span>
                    </div>
                  </div>
                </div>

                {/* Certificate 2: TOEIC Speaking & Writing (400) */}
                <div className="p-6 bg-slate-950/90 border border-cyan-500/30 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-xs font-bold text-cyan-400 block uppercase">Chứng Chỉ 2</span>
                      <h4 className="text-base font-black text-white">TOEIC Speaking & Writing</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-cyan-400">{scoreResult.totalSWScore || 0}</span>
                      <span className="text-[10px] text-slate-500 block">/ 400</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Speaking (Mic)</span>
                      <strong className={`text-lg font-black ${scoreResult.speakingScore ? 'text-cyan-300' : 'text-slate-500'}`}>
                        {scoreResult.speakingScore || 0}
                      </strong>
                      <span className="text-slate-500 text-[10px] block">/ 200 điểm</span>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Writing (Email)</span>
                      <strong className={`text-lg font-black ${scoreResult.writingScore ? 'text-cyan-300' : 'text-slate-500'}`}>
                        {scoreResult.writingScore || 0}
                      </strong>
                      <span className="text-slate-500 text-[10px] block">{scoreResult.writingWordCount || 0} từ / 200 điểm</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 space-y-1 pt-1">
                    {scoreResult.speakingFeedback && <p>🎙️ <strong>Nói:</strong> {scoreResult.speakingFeedback}</p>}
                    {scoreResult.writingFeedback && <p>✍️ <strong>Viết:</strong> {scoreResult.writingFeedback}</p>}
                  </div>
                </div>

              </div>
            )}

            {/* CEFR Level & Roadmap */}
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-left space-y-1.5 text-xs text-slate-200">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <ShieldCheck className="w-4 h-4" />
                <span>Quy Đổi Trình Độ: CEFR Level {scoreResult.cefrLevel}</span>
              </div>
              <p className="leading-relaxed">{scoreResult.cefrDescription}</p>
              <p className="text-slate-400 italic">💡 Lời khuyên: {scoreResult.recommendation}</p>
            </div>

            {/* 1-Click Action: Lưu từ vựng bài test vào Flashcard SRS */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={handleSaveAllKeyVocabToSRS}
                className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-2xl shadow-xl shadow-emerald-500/20 transition-all text-xs sm:text-sm flex items-center justify-center gap-2 transform hover:scale-105"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Lưu Tất Cả Từ Vựng Bài Thi Vào Flashcard SRS</span>
              </button>

              <button
                onClick={() => setStage('lobby')}
                className="w-full sm:w-auto px-6 py-3.5 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-2xl border border-slate-700 transition-all text-xs sm:text-sm flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Thi Bài Mới</span>
              </button>
            </div>

            {savedVocabNotice && (
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 animate-bounce">
                <Check className="w-4 h-4" />
                <span>{savedVocabNotice}</span>
              </div>
            )}
          </div>

          {/* Phân tích chi tiết từng câu trong bài thi */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-400" />
              <span>Phân Tích Chi Tiết & Lời Giải Thích Từng Câu</span>
            </h3>

            <div className="space-y-6 divide-y divide-slate-800">
              {examQuestions.map((q, idx) => {
                const userChoice = userAnswers[q.id];
                const isSkipped = !userChoice || userChoice.trim() === '' || userChoice === 'SKIPPED';
                const isCorrect = !isSkipped && userChoice === q.correctAnswer;
                const isSpeakingQuestion = q.skill === 'speaking';
                const isWritingQuestion = q.skill === 'writing';

                return (
                  <div key={q.id} className="pt-6 space-y-4">
                    
                    {/* Header Question Review */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-amber-400">Câu {idx + 1} ({q.part.toUpperCase()})</span>
                          <span className="text-xs text-slate-500">•</span>
                          
                          {/* Badge Status */}
                          {isSpeakingQuestion ? (
                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${
                              speakingTranscript ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                              {speakingTranscript ? `🎙️ Đã thu âm (${scoreResult.speakingScore}/200đ)` : '⚪ Chưa thu âm (0đ)'}
                            </span>
                          ) : isWritingQuestion ? (
                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${
                              writingInput ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                              {writingInput ? `✍️ Đã viết email (${scoreResult.writingScore}/200đ)` : '⚪ Chưa viết (0đ)'}
                            </span>
                          ) : isSkipped ? (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg border bg-slate-800 text-slate-400 border-slate-700">
                              ⚪ Chưa làm / Bỏ qua (0đ)
                            </span>
                          ) : isCorrect ? (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                              ✓ Chính xác
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg border bg-red-500/20 text-red-400 border-red-500/30">
                              ✗ Chưa chính xác
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-white">{q.questionText}</p>
                      </div>
                    </div>

                    {/* If Part 1: Display Photograph Thumbnail */}
                    {q.part === 'part1_photos' && q.imageUrl && (
                      <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 max-w-sm">
                        <img
                          src={q.imageUrl}
                          alt="Part 1 Question Photo"
                          className="w-full h-48 object-cover"
                        />
                      </div>
                    )}

                    {/* Full Transcript of Options (Revealed during Review) */}
                    {q.options && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Transcript 4 Phương Án (A, B, C, D):
                        </span>
                        <div className="grid grid-cols-1 gap-2">
                          {q.options.map((opt, optIdx) => {
                            const letter = ['A', 'B', 'C', 'D'][optIdx];
                            const isCorrectOpt = letter === q.correctAnswer;
                            const isUserChosen = letter === userChoice;

                            return (
                              <div
                                key={optIdx}
                                className={`p-3 rounded-xl border text-xs leading-relaxed flex items-start justify-between gap-3 ${
                                  isCorrectOpt
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold ring-1 ring-emerald-500/30'
                                    : isUserChosen
                                    ? 'bg-red-500/15 border-red-500/40 text-red-300 font-medium'
                                    : 'bg-slate-950 border-slate-850 text-slate-400'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[11px] ${
                                    isCorrectOpt ? 'bg-emerald-500 text-slate-950' : isUserChosen ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400'
                                  }`}>
                                    {letter}
                                  </span>
                                  <span>{opt}</span>
                                </div>

                                <div className="shrink-0 text-[11px]">
                                  {isCorrectOpt && <span className="text-emerald-400 font-extrabold">✓ Đáp Án Đúng</span>}
                                  {isUserChosen && !isCorrectOpt && <span className="text-red-400 font-bold">✗ Bạn đã chọn</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Speaking / Writing User Input Display */}
                    {isSpeakingQuestion && (
                      <div className="p-3.5 bg-slate-850 border border-slate-800 rounded-xl text-xs text-slate-300 space-y-1">
                        <span className="text-[11px] font-bold text-slate-400 block">Bản ghi âm giọng nói của bạn:</span>
                        <p className={speakingTranscript ? 'text-cyan-300 font-mono italic' : 'text-slate-500 italic'}>
                          {speakingTranscript ? `"${speakingTranscript}"` : 'Bạn đã bỏ qua phần thu âm (0/200 điểm).'}
                        </p>
                      </div>
                    )}

                    {isWritingQuestion && (
                      <div className="p-3.5 bg-slate-850 border border-slate-800 rounded-xl text-xs text-slate-300 space-y-1">
                        <span className="text-[11px] font-bold text-slate-400 block">Nội dung email bạn đã soạn thảo:</span>
                        <p className={writingInput ? 'text-white whitespace-pre-line' : 'text-slate-500 italic'}>
                          {writingInput || 'Bạn đã bỏ qua phần viết email (0/200 điểm).'}
                        </p>
                      </div>
                    )}

                    {/* Result Explanation & Vietnamese Translation */}
                    <div className="p-4 bg-slate-850 border border-slate-800 rounded-2xl space-y-2 text-xs text-slate-300">
                      <p className="text-amber-300/90 leading-relaxed font-medium">
                        💡 <strong>Giải thích chi tiết:</strong> {q.explanation}
                      </p>
                      <p className="text-slate-400 italic">
                        🌐 <strong>Bản dịch tiếng Việt:</strong> {q.vietnameseTranslation}
                      </p>
                    </div>

                    {/* Key Vocabulary Pills */}
                    {q.keyVocabulary && q.keyVocabulary.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Từ vựng then chốt:</span>
                        {q.keyVocabulary.map((v, vIdx) => (
                          <span key={vIdx} className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-teal-300 rounded-lg text-xs font-mono">
                            {v.word} ({v.ipa}): <strong className="text-white">{v.meaning}</strong>
                          </span>
                        ))}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
