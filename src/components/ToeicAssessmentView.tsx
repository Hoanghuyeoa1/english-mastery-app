import React, { useState, useEffect, useMemo } from 'react';
import { 
  Award, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Play, 
  Volume2, 
  ArrowRight, 
  RotateCcw, 
  Sparkles, 
  BookOpen, 
  Mic, 
  MicOff, 
  FileText, 
  ShieldCheck, 
  BarChart3, 
  ChevronRight, 
  Calendar,
  AlertCircle,
  PlusCircle,
  Check
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
            setUserAnswers((prev) => ({ ...prev, [currentQ.id]: 'RECORDED' }));
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

  // Nộp bài thi và chấm điểm
  const handleSubmitExam = () => {
    setIsTimerRunning(false);
    
    // Tính điểm
    const evaluation = calculateToeicScores(examQuestions, userAnswers);
    setScoreResult(evaluation);

    // Lưu vào lịch sử
    const session: ToeicTestSession = {
      id: `toeic_session_${Date.now()}`,
      mode: examMode,
      title: examMode === '2skills_mini' ? 'Mini-Test Rút Gọn (15 phút)' : examMode === '2skills_full' ? 'Standard Test (30 phút)' : 'TOEIC 4 Kỹ Năng Toàn Diện',
      date: new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      totalQuestions: examQuestions.length,
      durationMinutes: Math.round((examMode === '2skills_mini' ? 15 : examMode === '2skills_full' ? 30 : 35) - timeLeft / 60),
      userAnswers,
      speakingTranscript,
      writingText: writingInput,
      listeningScore: evaluation.listeningScore,
      readingScore: evaluation.readingScore,
      speakingScore: evaluation.speakingScore,
      writingScore: evaluation.writingScore,
      totalScore: evaluation.totalScore,
      cefrLevel: evaluation.cefrLevel,
    };

    const updatedHistory = [session, ...testHistory].slice(0, 10);
    setTestHistory(updatedHistory);
    try {
      localStorage.setItem('english_mastery_toeic_history', JSON.stringify(updatedHistory));
    } catch (e) {
      console.warn('Lỗi lưu lịch sử TOEIC:', e);
    }

    gainXP(evaluation.totalScore > 500 ? 50 : 30);
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
    setStage('report');
  };

  // 1-Click lưu tất cả từ vựng trong bài thi vào Flashcard SRS
  const handleSaveAllKeyVocabToSRS = () => {
    let count = 0;
    examQuestions.forEach((q) => {
      if (q.keyVocabulary && q.keyVocabulary.length > 0) {
        q.keyVocabulary.forEach((v) => {
          const isExist = vocabularyList.some((w) => w.word.toLowerCase() === v.word.toLowerCase());
          if (!isExist) {
            addCustomWord({
              word: v.word,
              ipa: v.ipa,
              partOfSpeech: 'noun',
              meaning: v.meaning,
              definitionEn: `Core vocabulary from TOEIC Assessment: ${v.word}.`,
              example: `Mastering "${v.word}" is essential for achieving a high TOEIC score.`,
              exampleMeaning: `Thành thạo từ vựng "${v.word}" là yếu tố quan trọng để đạt điểm TOEIC cao.`,
              tag: 'TOEIC',
            });
            count++;
          }
        });
      }
    });

    setSavedVocabNotice(`Đã nạp thành công ${count > 0 ? count + ' từ vựng mới' : 'các từ vựng'} vào Flashcard SRS (+${count * 15} XP)!`);
    confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
    setTimeout(() => setSavedVocabNotice(null), 4000);
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      
      {/* 1. MÀN HÌNH LOBBY & CHỌN CHẾ ĐỘ THI */}
      {stage === 'lobby' && (
        <div className="space-y-6">
          
          {/* Header Banner */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-xs font-bold uppercase">
              <Award className="w-3.5 h-3.5" />
              <span>Chuẩn Đánh Giá Năng Lực Quốc Tế ETS</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Trung Tâm Đánh Giá Năng Lực TOEIC
            </h1>

            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              Thi thử mô phỏng format đề thi TOEIC chuẩn ETS, dự đoán thang điểm <strong>10 – 990</strong>, phân tích chi tiết lỗi sai và quy đổi sang khung năng lực Châu Âu <strong>CEFR (A1 - C1)</strong>.
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
                    TOEIC 2 Kỹ Năng (L&R)
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
                    Kiểm tra toàn diện <strong>Listening (Part 1 - 4)</strong> và <strong>Reading (Part 5 - 7)</strong>. Thang điểm chuẩn 10 - 990 điểm.
                  </p>
                </div>

                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Mini-Test Rút Gọn: <strong>10 - 15 câu / 15 phút</strong></span>
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
                    Bao gồm trọn bộ <strong>Nghe, Đọc, Nói (Speaking qua Mic)</strong> và <strong>Viết (Writing Email công sở)</strong>.
                  </p>
                </div>

                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                    <span>Thu âm phát âm Speaking & Phân tích văn phong</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                    <span>Viết Email công việc & Chấm điểm chuẩn hóa</span>
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
                <span>Lịch Sử Thi Thử & Tiến Bộ Điểm Số</span>
              </h3>

              <div className="divide-y divide-slate-800">
                {testHistory.map((item) => (
                  <div key={item.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-amber-400 shrink-0">
                        {item.totalScore}
                      </div>
                      <div>
                        <span className="font-bold text-white block">{item.title}</span>
                        <span className="text-slate-500 text-xs">{item.date} • {item.durationMinutes} phút làm bài</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg font-bold text-slate-300 text-xs">
                        Nghe: {item.listeningScore} | Đọc: {item.readingScore}
                      </span>
                      <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold rounded-lg text-xs">
                        CEFR: {item.cefrLevel}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* 2. MÀN HÌNH PHÒNG THI (EXAM ROOM) */}
      {stage === 'testing' && currentQ && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          {/* Top Bar: Timer, Question Count, Submit Button */}
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
                timeLeft < 120 ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse' : 'bg-slate-800 border-slate-700 text-emerald-400'
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
                  <span className="text-xs font-bold text-white block">Đoạn Audio Nghe ({currentQ.part})</span>
                  <span className="text-[11px] text-slate-400">Bấm nút để nghe phát âm đề bài</span>
                </div>
              </div>

              <button
                onClick={() => speakWord(currentQ.audioScript || '', audioVoice, audioSpeed)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all"
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

          {/* Question Text */}
          <div className="space-y-2">
            <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
              {currentQ.questionText}
            </h3>
          </div>

          {/* Standard Multiple Choice Options (A, B, C, D) */}
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

              {speakingTranscript && (
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200">
                  Đã thu âm: <strong className="text-cyan-400">"{speakingTranscript}"</strong>
                </div>
              )}
            </div>
          )}

          {/* Writing Input Interface (If Skill is Writing) */}
          {currentQ.skill === 'writing' && (
            <div className="space-y-2">
              <textarea
                value={writingInput}
                onChange={(e) => {
                  setWritingInput(e.target.value);
                  setUserAnswers((prev) => ({ ...prev, [currentQ.id]: e.target.value }));
                }}
                placeholder="Viết nội dung email phản hồi tại đây (50 - 100 từ)..."
                rows={5}
                className="w-full bg-slate-950 border border-slate-750 focus:border-cyan-500 rounded-2xl p-4 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
              />
              <div className="flex justify-end text-[11px] text-slate-500">
                <span>Số từ: {writingInput.trim() ? writingInput.trim().split(/\s+/).length : 0} từ</span>
              </div>
            </div>
          )}

          {/* Navigation Prev / Next Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => setCurrentQuestionIdx((prev) => Math.max(0, prev - 1))}
              disabled={currentQuestionIdx === 0}
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

      {/* 3. MÀN HÌNH BÁO CÁO KẾT QUẢ (SCORE REPORT) */}
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

            {/* Total Score Badge */}
            <div className="py-4">
              <div className="inline-block p-6 bg-slate-950/80 border border-amber-500/40 rounded-3xl shadow-xl">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Tổng Điểm TOEIC Đạt Được</span>
                <span className="text-5xl sm:text-6xl font-black bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
                  {scoreResult.totalScore}
                </span>
                <span className="text-xs text-slate-400 block mt-1">/ 990 thang điểm chuẩn</span>
              </div>
            </div>

            {/* Skill Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <span className="text-[11px] text-slate-400 block">Listening</span>
                <strong className="text-xl sm:text-2xl font-black text-white">{scoreResult.listeningScore}</strong>
                <span className="text-[10px] text-slate-500 block">/ 495 điểm</span>
              </div>

              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <span className="text-[11px] text-slate-400 block">Reading</span>
                <strong className="text-xl sm:text-2xl font-black text-white">{scoreResult.readingScore}</strong>
                <span className="text-[10px] text-slate-500 block">/ 495 điểm</span>
              </div>

              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <span className="text-[11px] text-slate-400 block">Speaking</span>
                <strong className="text-xl sm:text-2xl font-black text-cyan-400">{scoreResult.speakingScore || 160}</strong>
                <span className="text-[10px] text-slate-500 block">/ 200 điểm</span>
              </div>

              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <span className="text-[11px] text-slate-400 block">Writing</span>
                <strong className="text-xl sm:text-2xl font-black text-cyan-400">{scoreResult.writingScore || 150}</strong>
                <span className="text-[10px] text-slate-500 block">/ 200 điểm</span>
              </div>
            </div>

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

            <div className="space-y-4 divide-y divide-slate-800">
              {examQuestions.map((q, idx) => {
                const userChoice = userAnswers[q.id];
                const isCorrect = userChoice === q.correctAnswer;

                return (
                  <div key={q.id} className="pt-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-amber-400">Câu {idx + 1} ({q.part})</span>
                          <span className="text-xs text-slate-500">•</span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                            isCorrect ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {isCorrect ? 'Đúng' : 'Chưa đúng'}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-white">{q.questionText}</p>
                      </div>
                    </div>

                    {/* Result Choices Comparison */}
                    <div className="p-3 bg-slate-850 rounded-xl space-y-1.5 text-xs text-slate-300">
                      <p>
                        Đáp án của bạn: <strong className={isCorrect ? 'text-emerald-400' : 'text-red-400'}>{userChoice || 'Chưa chọn'}</strong>
                        {!isCorrect && q.correctAnswer && (
                          <span className="ml-3">
                            → Đáp án đúng: <strong className="text-emerald-400">{q.correctAnswer}</strong>
                          </span>
                        )}
                      </p>
                      <p className="text-slate-400 italic">💡 Giải thích: {q.explanation}</p>
                      <p className="text-[11px] text-slate-500">Bản dịch: {q.vietnameseTranslation}</p>
                    </div>

                    {/* Key Vocabulary Pills */}
                    {q.keyVocabulary && q.keyVocabulary.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Từ vựng quan trọng:</span>
                        {q.keyVocabulary.map((v, vIdx) => (
                          <span key={vIdx} className="px-2.5 py-0.5 bg-slate-800 border border-slate-700 text-teal-300 rounded-lg text-xs font-mono">
                            {v.word} ({v.ipa}) : {v.meaning}
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
