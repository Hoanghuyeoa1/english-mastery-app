import React, { useState, useEffect, useMemo } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  ArrowRight, 
  RotateCcw, 
  Headphones, 
  Play, 
  Activity,
  Award,
  AlertCircle
} from 'lucide-react';
import { triggerCelebration } from '../utils/confettiPolicy';
import { useAppStore } from '../store/useAppStore';
import { 
  speakWord, 
  createSpeechRecognizer, 
  calculateAccuracy,
  isSpeechRecognitionSupported,
  getSpeechBrowserSupport 
} from '../services/speechService';
import { SessionProgressHeader, NextActionPanel } from './session';
import { derivePronunciationSessionModel, clampProgressPercent } from '../services/sessionExperienceAdapter';
import type { SessionProgressMetric, SessionSourceContext } from '../types/sessionExperience';
import { VocabWord } from '../types';
import { savePronunciationAttempt } from '../services/leaderboardLearningMetrics';
import { scheduleCloudSync } from '../services/cloudSyncService';

type PronunciationSubTab = 'ai_speech' | 'shadowing' | 'dictation';

export const PronunciationArena: React.FC = () => {
  const { 
    vocabularyList, 
    gainXP, 
    consumeHeart, 
    recordPronunciationMastered,
    recordMistake,
    recordMistakeCorrect,
    audioVoice, 
    audioSpeed,
    activePracticeConfig,
    clearAdaptivePractice,
    mistakeBank,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<PronunciationSubTab>(() => {
    if (activePracticeConfig?.module === 'shadowing') return 'shadowing';
    return 'ai_speech';
  });
  const [currentIdx, setCurrentIdx] = useState(0);
  const [targetedWordOverride, setTargetedWordOverride] = useState<VocabWord | null>(null);

  // Nhảy trực tiếp tới từ mục tiêu từ phiên Adaptive Practice nếu có
  useEffect(() => {
    if (activePracticeConfig?.itemIds && activePracticeConfig.itemIds.length > 0) {
      if (activePracticeConfig.module === 'pronunciation' || activePracticeConfig.module === 'shadowing') {
        if (activePracticeConfig.module === 'shadowing') {
          setActiveTab('shadowing');
        } else {
          setActiveTab('ai_speech');
        }
        const targetId = activePracticeConfig.itemIds[0].trim().toLowerCase();
        // 1. Khớp chính xác theo ID trước để tránh va chạm từ cùng tên
        let foundIdx = vocabularyList.findIndex((w) => w.id?.toLowerCase() === targetId);
        // 2. Fallback sang khớp theo word
        if (foundIdx < 0) {
          foundIdx = vocabularyList.findIndex((w) => w.word.toLowerCase() === targetId);
        }

        if (foundIdx >= 0) {
          setCurrentIdx(foundIdx);
          setTargetedWordOverride(null);
        } else {
          // Nếu từ chỉ có trong sổ bẫy lỗi mà chưa có trong danh sách từ chuẩn
          const fromMistake = Object.values(mistakeBank || {}).find(
            (m) => m.id?.toLowerCase() === targetId
          ) || Object.values(mistakeBank || {}).find(
            (m) => m.word.toLowerCase() === targetId
          );
          if (fromMistake) {
            setTargetedWordOverride({
              id: fromMistake.id,
              word: fromMistake.word,
              ipa: fromMistake.ipa || '',
              meaning: fromMistake.meaning || '',
              partOfSpeech: 'noun',
              example: fromMistake.example || `Let's practice pronouncing ${fromMistake.word}.`,
              tag: fromMistake.tag || 'Daily',
              srsLevel: 0,
              interval: 1,
              easeFactor: 2.5,
              nextReviewDate: new Date().toISOString(),
            } as VocabWord);
          }
        }
        // Dọn dẹp ephemeral config ngay lập tức để không rò rỉ sang phiên bình thường
        clearAdaptivePractice();
      }
    }
  }, [activePracticeConfig, vocabularyList, mistakeBank, clearAdaptivePractice]);

  // Browser Speech Support Check
  const isSupported = isSpeechRecognitionSupported();
  const browserSupport = getSpeechBrowserSupport();
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);

  // 1. AI Speech State
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [accuracyScore, setAccuracyScore] = useState<number | null>(null);
  const [micError, setMicError] = useState('');

  // 2. Shadowing State
  const [shadowingStep, setShadowingStep] = useState<'listen' | 'countdown' | 'record' | 'result'>('listen');
  const [countdownNum, setCountdownNum] = useState(3);
  const [shadowTranscript, setShadowTranscript] = useState('');
  const [shadowScore, setShadowScore] = useState<number | null>(null);

  // 3. Dictation State
  const [dictationInput, setDictationInput] = useState('');
  const [dictationChecked, setDictationChecked] = useState(false);
  const [isDictationCorrect, setIsDictationCorrect] = useState(false);

  const currentWord: VocabWord | undefined = useMemo(() => {
    if (targetedWordOverride) return targetedWordOverride;
    return vocabularyList[currentIdx % vocabularyList.length];
  }, [targetedWordOverride, vocabularyList, currentIdx]);

  // Session Experience & Planned Items Tracking (Phase 7)
  const [totalPlannedItems] = useState<number>(() => {
    if (activePracticeConfig?.itemIds && (activePracticeConfig.module === 'pronunciation' || activePracticeConfig.module === 'shadowing')) {
      return activePracticeConfig.itemIds.length;
    }
    return 0;
  });
  const [completedPromptsCount, setCompletedPromptsCount] = useState(0);
  const [sessionCompletedCount, setSessionCompletedCount] = useState(0);
  const [sessionStreak, setSessionStreak] = useState(0);

  const [sourceContext] = useState<SessionSourceContext | undefined>(() => {
    if (!activePracticeConfig) return undefined;
    return {
      todayPlanTaskId: activePracticeConfig.planItemId,
      sourceModule: activePracticeConfig.module,
      targetItemIds: activePracticeConfig.itemIds,
      mistakeType: activePracticeConfig.mistakeType,
    };
  });

  const pronunciationMetric: SessionProgressMetric = useMemo(() => {
    if (totalPlannedItems > 0) {
      return {
        kind: 'discrete_items',
        currentIndex: completedPromptsCount,
        totalItems: totalPlannedItems,
        answeredCount: completedPromptsCount,
        remainingCount: Math.max(0, totalPlannedItems - completedPromptsCount),
        progressPercent: clampProgressPercent(completedPromptsCount, totalPlannedItems),
        counterFormat: 'answered',
      };
    }
    return {
      kind: 'unbounded',
      completedCount: sessionCompletedCount,
      streakCount: sessionStreak,
    };
  }, [totalPlannedItems, completedPromptsCount, sessionCompletedCount, sessionStreak]);

  // Reset states khi chuyển từ
  useEffect(() => {
    setIsRecording(false);
    setTranscript('');
    setAccuracyScore(null);
    setMicError('');

    setShadowingStep('listen');
    setShadowTranscript('');
    setShadowScore(null);

    setDictationInput('');
    setDictationChecked(false);
    setIsDictationCorrect(false);
  }, [currentIdx, activeTab]);

  const handleNextWord = () => {
    if (targetedWordOverride) {
      setTargetedWordOverride(null);
    }
    setCurrentIdx((prev) => prev + 1);
  };

  // 1. Logic Luyện Nói AI (AI Speech)
  const handleStartAISpeech = () => {
    if (!currentWord) return;
    setMicError('');
    setIsPermissionDenied(false);
    setAccuracyScore(null);
    setTranscript('');

    const handle = createSpeechRecognizer(
      (text, isFinal) => {
        setTranscript(text);
        if (isFinal) {
          setIsRecording(false);
          const acc = calculateAccuracy(currentWord.word, text);
          setAccuracyScore(acc);
          setSessionCompletedCount((prev) => prev + 1);
          if (totalPlannedItems > 0) {
            setCompletedPromptsCount((prev) => Math.min(totalPlannedItems, prev + 1));
          }

          if (text.trim()) {
            savePronunciationAttempt({
              id: `pron_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              word: currentWord.word,
              score: acc,
              timestamp: new Date().toISOString(),
              isTrusted: true,
              isFallback: false,
              recognizedText: text,
            });
            scheduleCloudSync(2000);
          }

          if (acc >= 75) {
            setSessionStreak((prev) => prev + 1);
            recordPronunciationMastered(20);
            recordMistakeCorrect(currentWord.id || currentWord.word, { type: 'pronunciation' });
            triggerCelebration('micro', { particleCount: 60, spread: 70, origin: { y: 0.6 } });
          } else if (acc >= 60) {
            // Neutral (60% đến < 75%): Không ghi mistake và không ghi correct
            gainXP(10);
          } else {
            // < 60%: Ghi mistake
            setSessionStreak(0);
            recordMistake(currentWord, 'pronunciation', {
              type: 'pronunciation',
              userAnswer: text,
              expectedAnswer: currentWord.word,
              context: `Pronunciation Arena accuracy: ${acc}%`,
            });
            consumeHeart();
          }
        }
      },
      (err, detail) => {
        setMicError(err);
        if (detail?.code === 'permission-denied') {
          setIsPermissionDenied(true);
        }
        setIsRecording(false);
      }
    );

    if (handle) {
      setIsRecording(true);
    }
  };

  // 2. Logic Shadowing (Nhại Theo Mẫu)
  const handleStartShadowingFlow = () => {
    if (!currentWord) return;
    setIsPermissionDenied(false);
    // Bước 1: Phát âm mẫu của người bản xứ
    speakWord(currentWord.example || currentWord.word, audioVoice, audioSpeed);
    
    // Bước 2: Đếm nhịp 3-2-1 sau khi nghe
    setTimeout(() => {
      setShadowingStep('countdown');
      setCountdownNum(3);

      const countInterval = setInterval(() => {
        setCountdownNum((prev) => {
          if (prev <= 1) {
            clearInterval(countInterval);
            // Bước 3: Bắt đầu thu âm
            setShadowingStep('record');
            startShadowingRecord();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, 1800);
  };

  const startShadowingRecord = () => {
    if (!currentWord) return;
    setShadowTranscript('');

    const targetText = currentWord.example || currentWord.word;
    const handle = createSpeechRecognizer(
      (text, isFinal) => {
        setShadowTranscript(text);
        if (isFinal) {
          setShadowingStep('result');
          const acc = calculateAccuracy(targetText, text);
          setShadowScore(acc);
          setSessionCompletedCount((prev) => prev + 1);
          if (totalPlannedItems > 0) {
            setCompletedPromptsCount((prev) => Math.min(totalPlannedItems, prev + 1));
          }

          if (text.trim()) {
            savePronunciationAttempt({
              id: `pron_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              word: currentWord.word,
              score: acc,
              timestamp: new Date().toISOString(),
              isTrusted: true,
              isFallback: false,
              recognizedText: text,
            });
            scheduleCloudSync(2000);
          }

          if (acc >= 70) {
            setSessionStreak((prev) => prev + 1);
            gainXP(25);
            triggerCelebration('micro', { particleCount: 70, spread: 70, origin: { y: 0.6 } });
          } else {
            setSessionStreak(0);
          }
        }
      },
      (err, detail) => {
        setMicError(err);
        if (detail?.code === 'permission-denied') {
          setIsPermissionDenied(true);
        }
        setShadowingStep('result');
      }
    );

    if (!handle) {
      setShadowingStep('listen');
    }
  };

  // 3. Logic Dictation (Nghe & Chép Chính Tả)
  const handleCheckDictation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWord || dictationChecked) return;

    const cleanUser = dictationInput.trim().toLowerCase();
    const cleanTarget = currentWord.word.trim().toLowerCase();
    const isMatch = cleanUser === cleanTarget;

    setDictationChecked(true);
    setIsDictationCorrect(isMatch);
    setSessionCompletedCount((prev) => prev + 1);
    if (totalPlannedItems > 0) {
      setCompletedPromptsCount((prev) => Math.min(totalPlannedItems, prev + 1));
    }

    if (isMatch) {
      setSessionStreak((prev) => prev + 1);
      gainXP(20);
      triggerCelebration('micro', { particleCount: 50, spread: 60, origin: { y: 0.6 } });
    } else {
      setSessionStreak(0);
      consumeHeart();
    }
  };

  if (!currentWord) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center max-w-lg mx-auto">
        <p className="text-slate-400">Chưa có từ vựng nào để luyện phát âm.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* SESSION PROGRESS HEADER (PHASE 7 DURING UX) */}
      <SessionProgressHeader
        title="Luyện Phát Âm & Ngữ Âm Bản Xứ"
        subtitle={`Từ vựng: ${currentWord.word} • ${
          activeTab === 'ai_speech' ? 'Luyện Nói AI' : activeTab === 'shadowing' ? 'Shadowing' : 'Chép Chính Tả'
        }`}
        badgeLabel="AI SPEECH"
        metric={pronunciationMetric}
        streakCount={sessionStreak}
        onExit={() => useAppStore.getState().navigateToTab('dashboard')}
      />
      
      {/* Browser Speech API Warning Banner */}
      {!isSupported && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 text-amber-300 text-xs sm:text-sm shadow-lg">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-left space-y-1">
            <p className="font-bold">Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói.</p>
            <p className="text-slate-300 leading-relaxed">
              Để luyện nói và chấm điểm phát âm chính xác, vui lòng mở ứng dụng trên <strong>Google Chrome</strong> hoặc <strong>Microsoft Edge</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Permission Denied Guide Banner */}
      {isPermissionDenied && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-2xl text-xs sm:text-sm text-left flex items-start gap-3 shadow-lg">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Quyền truy cập Microphone bị từ chối.</p>
            <p className="text-slate-300 leading-relaxed">
              Bấm vào <strong>biểu tượng ổ khóa 🔒 / quyền trang web</strong> trên thanh URL của trình duyệt để gạt bật lại Micro, sau đó tải lại trang hoặc bấm thử lại.
            </p>
          </div>
        </div>
      )}

      {/* Sub-Tabs Selector */}
      <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-2xl shadow-xl">
        <button
          onClick={() => setActiveTab('ai_speech')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
            activeTab === 'ai_speech'
              ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Mic className="w-4 h-4" />
          <span>Luyện Nói AI</span>
        </button>

        <button
          onClick={() => setActiveTab('shadowing')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
            activeTab === 'shadowing'
              ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Shadowing (Nhại Mẫu)</span>
        </button>

        <button
          onClick={() => setActiveTab('dictation')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
            activeTab === 'dictation'
              ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Headphones className="w-4 h-4" />
          <span>Chép Chính Tả</span>
        </button>
      </div>

      {/* SUB-TAB 1: LUYỆN NÓI AI (AI SPEECH SCORING) */}
      {activeTab === 'ai_speech' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
          
          <div className="flex justify-between items-center pb-4 border-b border-slate-800">
            <span className="text-xs font-black uppercase tracking-wider text-teal-400">
              Luyện Phát Âm Trực Tiếp Qua Mic
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => speakWord(currentWord.word, audioVoice, audioSpeed)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full flex items-center gap-1.5 text-xs"
                title="Nghe mẫu"
              >
                <Volume2 className="w-4 h-4 text-teal-400" />
                <span>Nghe mẫu</span>
              </button>
              <span className="text-xs font-semibold px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                +20 XP
              </span>
            </div>
          </div>

          <div className="space-y-2 py-2">
            <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">{currentWord.word}</h2>
            <div className="inline-block px-4 py-1.5 bg-slate-850 rounded-xl border border-slate-750">
              <span className="text-teal-400 font-mono text-lg">{currentWord.ipa}</span>
            </div>
            <p className="text-slate-400 text-sm italic">"{currentWord.meaning}"</p>
          </div>

          {/* Microphone Animated Button */}
          <div className="relative my-8 flex justify-center items-center">
            {isRecording && (
              <>
                <span className="absolute w-28 h-28 bg-red-500/20 rounded-full animate-ping" />
                <span className="absolute w-24 h-24 bg-red-500/30 rounded-full animate-pulse" />
              </>
            )}

            <button
              data-testid="pronunciation-mic-btn"
              aria-label="Thu âm phát âm"
              aria-busy={isRecording}
              onClick={handleStartAISpeech}
              disabled={isRecording || !isSupported}
              title={!isSupported ? 'Trình duyệt chưa hỗ trợ nhận diện giọng nói' : undefined}
              className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-150 shadow-xl active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                !isSupported
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50 shadow-none'
                  : isRecording
                  ? 'bg-red-500 text-white shadow-red-500/40 animate-pulse motion-reduce:animate-none'
                  : 'bg-gradient-to-tr from-teal-500 to-emerald-400 hover:scale-[1.02] text-slate-950 shadow-teal-500/30'
              }`}
            >
              {isRecording ? <MicOff className="w-8 h-8 animate-bounce motion-reduce:animate-none" /> : <Mic className="w-8 h-8" />}
            </button>
          </div>

          <p className="text-xs text-slate-400">
            {!isSupported
              ? '⚠️ Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói. Hãy mở trên Chrome hoặc Edge.'
              : isRecording 
              ? '🎙️ Đang lắng nghe bạn nói... hãy phát âm to và rõ ràng nhé!' 
              : 'Nhấn vào Micro và đọc to từ vựng tiếng Anh trên'}
          </p>

          {transcript && (
            <div className="bg-slate-850 border border-slate-750 p-4 rounded-2xl text-slate-300 text-sm">
              Trình duyệt nghe thấy: <strong className="text-white">"{transcript}"</strong>
            </div>
          )}

          {accuracyScore !== null && (
            <div className={`p-4 rounded-2xl flex items-center justify-between animate-fadeIn motion-reduce:animate-none ${
              accuracyScore >= 75 
                ? 'bg-teal-500/20 border border-teal-500/40 text-teal-300' 
                : 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
            }`}>
              <div className="flex items-center gap-2">
                {accuracyScore >= 75 ? <CheckCircle2 className="w-5 h-5 text-teal-400" /> : <XCircle className="w-5 h-5 text-amber-400" />}
                <span className="font-bold text-sm">
                  {accuracyScore >= 75 ? 'Phát âm chuẩn xác (+20 XP)!' : 'Cần phát âm tròn vành rõ chữ hơn (-1 ❤️)'}
                </span>
              </div>
              <span className="text-2xl font-black">{accuracyScore}%</span>
            </div>
          )}

          {micError && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
              {micError}
            </p>
          )}

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              onClick={handleNextWord}
              className="flex items-center gap-2 px-6 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black rounded-2xl shadow-lg shadow-teal-500/20 transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 text-sm"
            >
              <span>Từ tiếp theo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* SUB-TAB 2: SHADOWING (NHẠI THEO MẪU) */}
      {activeTab === 'shadowing' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          <div className="flex justify-between items-center pb-4 border-b border-slate-800">
            <span className="text-xs font-black uppercase tracking-wider text-teal-400">
              Kỹ Thuật Shadowing: Bắt Chước Ngữ Điệu Bản Xứ
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
              +25 XP
            </span>
          </div>

          {/* Context Sentence */}
          <div className="bg-slate-850 border border-slate-750 p-6 rounded-2xl space-y-3 text-center">
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Câu luyện tập:</span>
            <h3 className="text-xl sm:text-2xl font-bold text-white leading-relaxed">
              "{currentWord.example || currentWord.word}"
            </h3>
            <p className="text-xs sm:text-sm text-slate-400">
              → {currentWord.exampleMeaning || currentWord.meaning}
            </p>
          </div>

          {/* Shadowing Interactive Area */}
          <div className="py-6 text-center space-y-4">
            {shadowingStep === 'listen' && (
              <div className="space-y-4">
                <button
                  onClick={handleStartShadowingFlow}
                  disabled={!isSupported}
                  title={!isSupported ? 'Trình duyệt chưa hỗ trợ nhận diện giọng nói' : undefined}
                  className={`px-8 py-4 font-black rounded-2xl text-base flex items-center justify-center gap-3 mx-auto transition-all ${
                    !isSupported
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50 shadow-none'
                      : 'bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 shadow-xl shadow-teal-500/25 transform hover:scale-105'
                  }`}
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Nghe Mẫu & Bắt Đầu Shadowing</span>
                </button>
                <p className="text-xs text-slate-400">
                  {!isSupported 
                    ? '⚠️ Hãy mở trên Google Chrome hoặc Edge để sử dụng tính năng Shadowing.'
                    : 'Hệ thống sẽ phát câu mẫu → Đếm 3 giây → Bạn nói đè theo nhịp điệu!'}
                </p>
              </div>
            )}

            {shadowingStep === 'countdown' && (
              <div className="py-4 space-y-2">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 text-amber-300 text-3xl font-black flex items-center justify-center mx-auto animate-bounce">
                  {countdownNum}
                </div>
                <p className="text-xs font-semibold text-amber-300">Chuẩn bị nói nhại theo...</p>
              </div>
            )}

            {shadowingStep === 'record' && (
              <div className="py-4 space-y-3">
                <div className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-red-500/40 animate-pulse">
                  <Mic className="w-8 h-8" />
                </div>
                <p className="text-sm font-bold text-red-400">🎙️ Đang ghi âm... Hãy nói to theo câu mẫu!</p>
              </div>
            )}

            {shadowingStep === 'result' && (
              <div className="space-y-4">
                {shadowScore !== null ? (
                  <div className={`p-4 rounded-2xl flex items-center justify-between ${
                    shadowScore >= 70
                      ? 'bg-teal-500/20 border border-teal-500/40 text-teal-300'
                      : 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                  }`}>
                    <div className="text-left">
                      <p className="font-bold text-sm">
                        {shadowScore >= 70 ? 'Khớp ngữ điệu rất tốt (+25 XP)!' : 'Cần chú ý thêm ngữ điệu và phát âm'}
                      </p>
                      {shadowTranscript && (
                        <p className="text-xs opacity-80 mt-1">Đã nói: "{shadowTranscript}"</p>
                      )}
                    </div>
                    <span className="text-2xl font-black">{shadowScore}%</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Chưa bắt được giọng nói rõ ràng.</p>
                )}

                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={handleStartShadowingFlow}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 border border-slate-700"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Luyện lại câu này</span>
                  </button>

                  <button
                    onClick={handleNextWord}
                    className="px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-teal-500/20 flex items-center gap-2"
                  >
                    <span>Câu tiếp theo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* SUB-TAB 3: NGHE & CHÉP CHÍNH TẢ (DICTATION) */}
      {activeTab === 'dictation' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          <div className="flex justify-between items-center pb-4 border-b border-slate-800">
            <span className="text-xs font-black uppercase tracking-wider text-teal-400">
              Luyện Nghe & Gõ Lại Từ Vựng Chính Xác
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
              +20 XP
            </span>
          </div>

          {/* Audio Player Controls (Text is hidden!) */}
          <div className="p-8 bg-slate-850 border border-slate-750 rounded-2xl text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center mx-auto shadow-inner">
              <Headphones className="w-8 h-8" />
            </div>

            <p className="text-xs text-slate-400">
              Nhấn nút nghe để nghe phát âm, sau đó gõ lại từ vựng chính xác:
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => speakWord(currentWord.word, audioVoice, audioSpeed * 0.7)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl text-xs border border-slate-700 transition-all flex items-center gap-1.5"
              >
                <Volume2 className="w-4 h-4 text-teal-400" />
                <span>Nghe chậm (0.7x)</span>
              </button>

              <button
                onClick={() => speakWord(currentWord.word, audioVoice, audioSpeed)}
                className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-teal-500/20 transition-all flex items-center gap-1.5"
              >
                <Volume2 className="w-4 h-4" />
                <span>Nghe chuẩn (1.0x)</span>
              </button>
            </div>
          </div>

          {/* Dictation Input Form */}
          <form onSubmit={handleCheckDictation} className="space-y-4">
            <div>
              <input
                type="text"
                value={dictationInput}
                onChange={(e) => setDictationInput(e.target.value)}
                disabled={dictationChecked}
                placeholder="Gõ từ vựng tiếng Anh bạn vừa nghe được..."
                className="w-full bg-slate-950 border-2 border-slate-700 focus:border-teal-500 rounded-2xl px-5 py-4 text-lg text-white placeholder-slate-500 focus:outline-none transition-colors text-center font-bold tracking-wide"
                autoFocus
              />
            </div>

            {!dictationChecked ? (
              <button
                type="submit"
                disabled={!dictationInput.trim()}
                className="w-full py-3.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-black rounded-2xl transition-all shadow-lg shadow-teal-500/20 text-sm"
              >
                Kiểm tra đáp án
              </button>
            ) : (
              <div className="space-y-4">
                <div className={`p-4 rounded-2xl flex items-center justify-between ${
                  isDictationCorrect 
                    ? 'bg-teal-500/20 border border-teal-500/40 text-teal-300' 
                    : 'bg-red-500/20 border border-red-500/40 text-red-300'
                }`}>
                  <div className="flex items-center gap-2">
                    {isDictationCorrect ? <CheckCircle2 className="w-5 h-5 text-teal-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
                    <div>
                      <span className="font-bold block">
                        {isDictationCorrect ? 'Tuyệt vời! Chính xác (+20 XP)' : `Chưa đúng! Đáp án đúng: "${currentWord.word}"`}
                      </span>
                      <span className="text-xs opacity-80 font-mono">
                        {currentWord.ipa} • {currentWord.meaning}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleNextWord}
                  className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <span>Từ tiếp theo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </form>

        </div>
      )}

      {/* NEXT ACTION PANEL (PHASE 7 AFTER UX) */}
      <div className="pt-4 border-t border-slate-800">
        <NextActionPanel
          actions={[
            {
              id: 'next-action-today-hub',
              label: 'Về Kế Hoạch Hôm Nay',
              isPrimary: true,
              onClick: () => useAppStore.getState().navigateToTab('dashboard'),
            },
            {
              id: 'next-word',
              label: 'Từ Tiếp Theo',
              variant: 'secondary',
              onClick: handleNextWord,
            },
            {
              id: 'open-mistakes',
              label: '📖 Sổ Tay Bẫy Lỗi',
              variant: 'outline',
              onClick: () => useAppStore.getState().navigateToTab('mistakes'),
            },
          ]}
        />
      </div>

    </div>
  );
};
