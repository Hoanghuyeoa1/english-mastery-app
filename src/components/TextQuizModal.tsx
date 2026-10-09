import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  X,
  Volume2,
  CheckCircle2,
  XCircle,
  Trophy,
  ArrowRight,
  RotateCcw,
  Sparkles,
  BookOpen,
  HelpCircle,
  Layers,
  Award,
  BookmarkPlus
} from 'lucide-react';
import { triggerCelebration } from '../utils/confettiPolicy';
import { useAppStore } from '../store/useAppStore';
import { speakWord } from '../services/speechService';
import type {
  TextQuizQuestion,
  TextQuizSession,
  TextQuizAttemptResult,
} from '../types';
import type { TextAnalysisResult } from '../services/textAnalysisService';
import { createQuizFromText } from '../services/textQuizGeneratorService';

interface TextQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceText: string;
  analysis: TextAnalysisResult | null;
}

export const TextQuizModal: React.FC<TextQuizModalProps> = ({
  isOpen,
  onClose,
  sourceText,
  analysis,
}) => {
  const {
    srsProgressMap,
    mistakeBank,
    wordLearningStats,
    vocabularyList,
    gainXP,
    recordQuizCompleted,
    recordQuizMistakeResult,
    saveToSRS,
    saveCollocationToSRS,
    audioVoice,
    audioSpeed,
  } = useAppStore();

  // Step state: 'config' | 'playing' | 'results'
  const [step, setStep] = useState<'config' | 'playing' | 'results'>('config');
  const [desiredCount, setDesiredCount] = useState<number>(5);

  // Active quiz session
  const [session, setSession] = useState<TextQuizSession | null>(null);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState<boolean>(false);
  const [attempts, setAttempts] = useState<TextQuizAttemptResult[]>([]);
  const [saveAllFeedback, setSaveAllFeedback] = useState<string | null>(null);

  // Total available evidence candidates
  const candidateCount = useMemo(() => {
    if (!analysis || !sourceText.trim()) return 0;
    const testSession = createQuizFromText(
      sourceText,
      analysis,
      { srsProgressMap, mistakeBank, wordLearningStats, vocabularyList },
      { maxQuestions: 50 }
    );
    return testSession.availableItemCount;
  }, [analysis, sourceText, srsProgressMap, mistakeBank, wordLearningStats, vocabularyList]);

  // Reset modal state on open
  useEffect(() => {
    if (isOpen) {
      setStep('config');
      setCurrentIdx(0);
      setSelectedOptionId(null);
      setIsAnswerSubmitted(false);
      setAttempts([]);
      setSaveAllFeedback(null);
    }
  }, [isOpen]);

  // Handle Start Quiz
  const handleStartQuiz = useCallback(() => {
    if (!analysis || !sourceText.trim()) return;

    const newSession = createQuizFromText(
      sourceText,
      analysis,
      { srsProgressMap, mistakeBank, wordLearningStats, vocabularyList },
      { maxQuestions: desiredCount }
    );

    setSession(newSession);
    setStep(newSession.questions.length > 0 ? 'playing' : 'config');
    setCurrentIdx(0);
    setSelectedOptionId(null);
    setIsAnswerSubmitted(false);
    setAttempts([]);
  }, [analysis, sourceText, srsProgressMap, mistakeBank, wordLearningStats, vocabularyList, desiredCount]);

  const currentQuestion: TextQuizQuestion | undefined = session?.questions[currentIdx];

  // Handle Option Selection
  const handleSelectOption = useCallback((optionId: string) => {
    if (isAnswerSubmitted) return;
    setSelectedOptionId(optionId);
  }, [isAnswerSubmitted]);

  // Handle Submit Answer
  const handleSubmitAnswer = useCallback(() => {
    if (!currentQuestion || !selectedOptionId || isAnswerSubmitted) return;

    const chosenOption = currentQuestion.options.find((o) => o.id === selectedOptionId);
    const isCorrect = Boolean(chosenOption?.isCorrect);

    setIsAnswerSubmitted(true);

    const attempt: TextQuizAttemptResult = {
      questionId: currentQuestion.id,
      targetItem: currentQuestion.targetItem,
      canonicalLemma: currentQuestion.canonicalLemma,
      type: currentQuestion.type,
      selectedOptionId,
      isCorrect,
      userAnswer: chosenOption?.text || '',
      expectedAnswer: currentQuestion.options.find((o) => o.isCorrect)?.text || '',
      contextSentence: currentQuestion.contextSentence,
    };

    setAttempts((prev) => [...prev, attempt]);

    // Integrate with learning system (Mistake Bank & XP)
    if (isCorrect) {
      gainXP(10);
      // If was previously in mistake bank, record resolution
      recordQuizMistakeResult(currentQuestion.canonicalLemma, true, {
        source: 'classic_quiz',
        type: currentQuestion.type === 'grammar_pattern' ? 'grammar' : (currentQuestion.type === 'collocation' ? 'collocation' : 'meaning'),
      });
    } else {
      // Record new mistake into mistake bank
      recordQuizMistakeResult(currentQuestion.canonicalLemma, false, {
        source: 'classic_quiz',
        type: currentQuestion.type === 'grammar_pattern' ? 'grammar' : (currentQuestion.type === 'collocation' ? 'collocation' : 'meaning'),
        userAnswer: attempt.userAnswer,
        expectedAnswer: attempt.expectedAnswer,
        context: currentQuestion.contextSentence,
        idempotencyKey: `idemp_mistake_textquiz_${session?.id || 'sess'}_${currentQuestion.id}`,
      });
    }
  }, [currentQuestion, selectedOptionId, isAnswerSubmitted, gainXP, recordQuizMistakeResult, session]);

  // Handle Next Question
  const handleNextQuestion = useCallback(() => {
    if (!session) return;

    if (currentIdx + 1 < session.questions.length) {
      setCurrentIdx((prev) => prev + 1);
      setSelectedOptionId(null);
      setIsAnswerSubmitted(false);
    } else {
      // Finished all questions!
      setStep('results');
      const correctCount = attempts.filter((a) => a.isCorrect).length;
      if (correctCount >= session.questions.length * 0.7) {
        triggerCelebration('completion', { particleCount: 50, spread: 60, origin: { y: 0.7 } });
      }

      // Record quiz completion with stable session id and idempotency
      const totalQuestions = session.questions.length;
      const score = Math.round((correctCount / (totalQuestions || 1)) * 100);
      const isPerfect = correctCount === totalQuestions;
      const mistakeCount = attempts.filter((a) => !a.isCorrect).length;
      recordQuizCompleted(0, isPerfect, {
        quizId: session.id,
        quizType: 'comprehension',
        totalQuestions,
        correctCount,
        score,
        mistakeCount,
      });
    }
  }, [session, currentIdx, attempts, recordQuizCompleted]);

  // Handle Save Missed Words to SRS
  const handleSaveMissedToSRS = useCallback(() => {
    const wrongAttempts = attempts.filter((a) => !a.isCorrect);
    if (wrongAttempts.length === 0) return;

    let savedCount = 0;
    for (const item of wrongAttempts) {
      const q = session?.questions.find((x) => x.id === item.questionId);
      if (!q) continue;

      if (q.category === 'word' || !q.targetItem.includes(' ')) {
        saveToSRS(q.canonicalLemma, {
          contextSentence: q.contextSentence,
          source: 'translator_quiz',
        });
        savedCount++;
      } else {
        saveCollocationToSRS({
          phrase: q.targetItem,
          meaning: q.explanation || 'Trích xuất từ Text Quiz',
          usageContext: q.contextSentence || '',
          exampleEn: q.contextSentence || '',
          exampleVi: '',
          source: 'translator_quiz',
          tags: [q.category, 'translator_quiz'],
        });
        savedCount++;
      }
    }

    setSaveAllFeedback(`Đã lưu ${savedCount} từ/cụm từ làm sai vào Flashcard SRS!`);
    triggerCelebration('micro');
  }, [attempts, session, saveToSRS, saveCollocationToSRS]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (step === 'playing' && currentQuestion) {
        if (!isAnswerSubmitted) {
          const num = parseInt(e.key, 10);
          if (num >= 1 && num <= currentQuestion.options.length) {
            handleSelectOption(currentQuestion.options[num - 1].id);
          } else if (e.key === 'Enter' && selectedOptionId) {
            handleSubmitAnswer();
          }
        } else if (e.key === 'Enter') {
          handleNextQuestion();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step, currentQuestion, isAnswerSubmitted, selectedOptionId, handleSelectOption, handleSubmitAnswer, handleNextQuestion, onClose]);

  if (!isOpen) return null;

  const correctAnswersCount = attempts.filter((a) => a.isCorrect).length;
  const scorePercent = session && session.questions.length > 0 ? Math.round((correctAnswersCount / session.questions.length) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn motion-reduce:animate-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-modal-title"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleIn motion-reduce:animate-none">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 id="quiz-modal-title" className="text-base sm:text-lg font-black text-white">
                Tạo Quiz Từ Văn Bản (Context Text Quiz)
              </h2>
              <p className="text-[11px] text-slate-400">
                Câu hỏi cá nhân hóa sinh từ bằng chứng ngôn ngữ trong đoạn văn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* STEP 1: CONFIGURATION */}
          {step === 'config' && (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/5">
                <Sparkles className="w-8 h-8" />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="text-lg font-bold text-white">
                  Sẵn Sàng Kiểm Tra Kiến Thức?
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Hệ thống AI đã phân tích đoạn văn và trích xuất{' '}
                  <span className="text-amber-300 font-bold">{candidateCount} mục kiến thức có bằng chứng thực tế</span>{' '}
                  (Từ vựng CEFR, Cụm động từ, Thành ngữ, Thuật ngữ IT và Mẫu ngữ pháp).
                </p>
              </div>

              {candidateCount === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 text-xs text-slate-400">
                  Chưa tìm thấy đủ từ vựng hoặc cụm từ đặc trưng trong đoạn văn này để tạo bài Quiz. Hãy thử với một đoạn văn tiếng Anh dài hơn!
                </div>
              ) : (
                <div className="space-y-4 max-w-sm mx-auto">
                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      Số lượng câu hỏi mong muốn:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {Array.from(new Set([5, 10, candidateCount])).filter((c) => c > 0).map((count) => {
                        const actualCapped = Math.min(count, candidateCount);
                        const label = count === candidateCount ? `Tất cả (${candidateCount})` : `${count} câu`;
                        const isSelected = desiredCount === count;

                        return (
                          <button
                            key={`count_opt_${count}`}
                            type="button"
                            onClick={() => setDesiredCount(actualCapped)}
                            className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/10'
                                : 'bg-slate-850 text-slate-300 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-[10px] text-slate-500 block">
                      * Số câu tối đa thực tế: {Math.min(desiredCount, candidateCount)} câu (giới hạn theo dữ liệu đoạn văn).
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartQuiz}
                    className="w-full py-3.5 px-6 rounded-2xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <Brain className="w-4 h-4" />
                    <span>Bắt Đầu Làm Quiz ({Math.min(desiredCount, candidateCount)} câu)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: ACTIVE PLAYING QUIZ */}
          {step === 'playing' && currentQuestion && (
            <div className="space-y-5">
              {/* Question Progress Bar & Metadata */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400">Câu {currentIdx + 1} / {session?.questions.length}</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                      {currentQuestion.type === 'cloze' && 'Điền từ ngữ cảnh'}
                      {currentQuestion.type === 'meaning' && 'Nghĩa từ vựng'}
                      {currentQuestion.type === 'phrasal_verb' && 'Cụm động từ'}
                      {currentQuestion.type === 'idiom' && 'Thành ngữ'}
                      {currentQuestion.type === 'collocation' && 'Thuật ngữ & Cụm từ'}
                      {currentQuestion.type === 'grammar_pattern' && 'Mẫu ngữ pháp'}
                    </span>
                    {currentQuestion.cefr && (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {currentQuestion.cefr}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <Award className="w-3.5 h-3.5" />
                    <span>+10 XP</span>
                  </div>
                </div>

                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${((currentIdx + 1) / (session?.questions.length || 1)) * 100}%` }}
                  />
                </div>
              </div>

              {/* Context Sentence Block */}
              {currentQuestion.contextSentence && (
                <div className="p-4 rounded-2xl bg-slate-850/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                      Ngữ cảnh từ đoạn văn:
                    </span>
                    <button
                      type="button"
                      onClick={() => speakWord(currentQuestion.targetItem, audioVoice, audioSpeed)}
                      title="Phát âm từ vựng"
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4 text-teal-400" />
                    </button>
                  </div>
                  <p className="text-sm text-slate-200 font-medium leading-relaxed italic">
                    {currentQuestion.contextSentence}
                  </p>
                </div>
              )}

              {/* Prompt */}
              <div className="space-y-1">
                <h4 className="text-sm sm:text-base font-black text-white">
                  {currentQuestion.prompt}
                </h4>
              </div>

              {/* Options Radio List */}
              <div
                className="space-y-2.5"
                role="radiogroup"
                aria-label="Các phương án trả lời"
              >
                {currentQuestion.options.map((opt, idx) => {
                  const isSelected = selectedOptionId === opt.id;
                  const isCorrect = opt.isCorrect;

                  let borderClass = 'border-slate-800 hover:border-slate-700 bg-slate-850/90 text-slate-200';
                  let icon = null;

                  if (isAnswerSubmitted) {
                    if (isCorrect) {
                      borderClass = 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200 shadow-md shadow-emerald-500/10';
                      icon = <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
                    } else if (isSelected && !isCorrect) {
                      borderClass = 'border-rose-500/60 bg-rose-500/15 text-rose-200 shadow-md shadow-rose-500/10';
                      icon = <XCircle className="w-4 h-4 text-rose-400 shrink-0" />;
                    } else {
                      borderClass = 'border-slate-850 bg-slate-900/60 text-slate-500 opacity-60';
                    }
                  } else if (isSelected) {
                    borderClass = 'border-amber-500/80 bg-amber-500/15 text-white shadow-md shadow-amber-500/10 ring-1 ring-amber-500/50';
                  }

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => handleSelectOption(opt.id)}
                      disabled={isAnswerSubmitted}
                      className={`w-full p-3 sm:p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${borderClass}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-slate-800/80 text-slate-400 font-bold text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-xs sm:text-sm font-semibold">
                          {opt.text}
                        </span>
                      </div>
                      {icon}
                    </button>
                  );
                })}
              </div>

              {/* Explanation Card (shows after answer submission) */}
              {isAnswerSubmitted && (
                <div className="p-4 rounded-2xl bg-slate-850 border border-slate-750 space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Giải thích & Ghi nhớ:</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {currentQuestion.explanation}
                  </p>
                </div>
              )}

              {/* Action Button: Check / Next */}
              <div className="pt-2 flex justify-end">
                {!isAnswerSubmitted ? (
                  <button
                    type="button"
                    onClick={handleSubmitAnswer}
                    disabled={!selectedOptionId}
                    className="py-2.5 px-6 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                  >
                    <span>Kiểm tra đáp án</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="py-2.5 px-6 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md transition-all cursor-pointer flex items-center gap-2"
                  >
                    <span>
                      {currentIdx + 1 < (session?.questions.length || 0) ? 'Câu tiếp theo' : 'Xem kết quả bài Quiz'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: RESULTS SUMMARY */}
          {step === 'results' && session && (
            <div className="space-y-6 text-center py-3">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500/20 to-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center mx-auto shadow-xl">
                <Trophy className="w-10 h-10 text-amber-400" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black text-white">
                  Hoàn Thành Bài Quiz!
                </h3>
                <p className="text-xs text-slate-400">
                  Bạn đã trả lời đúng{' '}
                  <span className="text-emerald-400 font-bold">{correctAnswersCount} / {session.questions.length} câu</span> ({scorePercent}%)
                </p>
              </div>

              {/* XP Summary Pill */}
              <div className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-extrabold text-xs">
                <Award className="w-4 h-4 text-emerald-400" />
                <span>Nhận được +{correctAnswersCount * 10} XP kỹ năng</span>
              </div>

              {/* Mistake Review & SRS Save */}
              {attempts.some((a) => !a.isCorrect) && (
                <div className="p-4 rounded-2xl bg-slate-850/80 border border-slate-800 text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" />
                      Các câu trả lời sai (đã ghi nhận vào Sổ bẫy lỗi):
                    </span>
                    <button
                      type="button"
                      onClick={handleSaveMissedToSRS}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <BookmarkPlus className="w-3 h-3" />
                      <span>Lưu từ sai vào SRS</span>
                    </button>
                  </div>

                  {saveAllFeedback && (
                    <div className="text-[11px] text-emerald-400 font-bold">
                      {saveAllFeedback}
                    </div>
                  )}

                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {attempts
                      .filter((a) => !a.isCorrect)
                      .map((att) => (
                        <div
                          key={att.questionId}
                          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center justify-between gap-2"
                        >
                          <div>
                            <strong className="text-white font-bold">{att.targetItem}</strong>
                            <p className="text-[11px] text-slate-400">
                              Bạn chọn: <span className="text-rose-400">{att.userAnswer}</span> • Đúng: <span className="text-emerald-400">{att.expectedAnswer}</span>
                            </p>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
                            {att.type}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep('config');
                    setAttempts([]);
                  }}
                  className="py-2.5 px-5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Làm lại bài khác</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-6 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer"
                >
                  <span>Hoàn thành & Đóng</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
