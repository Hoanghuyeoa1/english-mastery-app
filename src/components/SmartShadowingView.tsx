import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Mic, 
  Volume2, 
  Sparkles, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Flame, 
  Zap, 
  Radio, 
  Sliders
} from 'lucide-react';
import { triggerCelebration } from '../utils/confettiPolicy';
import { useAppStore } from '../store/useAppStore';
import { 
  isSpeechRecognitionSupported, 
  startShadowingSession, 
  stopShadowingSession, 
  playShadowingPrompt,
  ShadowingMode,
  ShadowingSessionHandle
} from '../services/speechService';
import type { ShadowingFeedback, CEFRLevel } from '../types';
import { recordSkillEvidence, VALID_CEFR_LEVELS } from '../services/skillsCompetencyService';

interface ShadowingSentenceItem {
  id: string;
  sentence: string;
  translation: string;
  level: 'A2' | 'B1' | 'B2' | 'C1';
  topic: string;
}

const PRESET_SENTENCES: ShadowingSentenceItem[] = [
  {
    id: 'sh_01',
    sentence: 'The quick brown fox jumps over the lazy dog.',
    translation: 'Chú cáo nâu nhanh nhẹn nhảy qua chú chó lười biếng.',
    level: 'A2',
    topic: 'Khởi động phát âm'
  },
  {
    id: 'sh_02',
    sentence: 'Consistency is the key to mastering any new language.',
    translation: 'Sự kiên trì là chìa khóa để thành thạo bất kỳ ngôn ngữ mới nào.',
    level: 'B1',
    topic: 'Động lực học tập'
  },
  {
    id: 'sh_03',
    sentence: 'Artificial intelligence is reshaping the future of communication.',
    translation: 'Trí tuệ nhân tạo đang định hình lại tương lai của giao tiếp.',
    level: 'B2',
    topic: 'Công nghệ & AI'
  },
  {
    id: 'sh_04',
    sentence: 'I would like to schedule a quick meeting to review our project progress.',
    translation: 'Tôi muốn lên lịch một cuộc họp ngắn để đánh giá tiến độ dự án.',
    level: 'B1',
    topic: 'Giao tiếp công sở'
  },
  {
    id: 'sh_05',
    sentence: 'Effective leadership requires both empathy and decisive strategic thinking.',
    translation: 'Lãnh đạo hiệu quả đòi hỏi cả sự thấu cảm lẫn tư duy chiến lược quyết đoán.',
    level: 'B2',
    topic: 'Quản trị & Lãnh đạo'
  },
  {
    id: 'sh_06',
    sentence: 'Practice speaking aloud every single day to build natural muscle memory.',
    translation: 'Hãy luyện nói to mỗi ngày để xây dựng phản xạ cơ bắp tự nhiên.',
    level: 'B1',
    topic: 'Phương pháp Shadowing'
  },
  {
    id: 'sh_07',
    sentence: 'Could you please elaborate on the technical specifications of this architecture?',
    translation: 'Bạn có thể làm rõ hơn về các thông số kỹ thuật của kiến trúc này không?',
    level: 'C1',
    topic: 'Kỹ thuật & Công nghệ'
  },
  {
    id: 'sh_08',
    sentence: 'Despite facing significant challenges, our dedicated team achieved remarkable results.',
    translation: 'Dù đối mặt nhiều thách thức, đội ngũ tâm huyết của chúng tôi đã gặt hái kết quả xuất sắc.',
    level: 'B2',
    topic: 'Thuyết trình & Đàm phán'
  }
];

export interface SmartShadowingViewProps {
  initialSentence?: string;
  initialTranslation?: string;
  onCompleted?: (score: number) => void;
}

type SessionState = 'idle' | 'playing_tts' | 'echo_countdown' | 'recording' | 'completed';

export const SmartShadowingView: React.FC<SmartShadowingViewProps> = ({
  initialSentence,
  initialTranslation,
  onCompleted
}) => {
  const { gainXP, recordSkillScore } = useAppStore();

  // Browser Speech Support
  const isSpeechSupported = isSpeechRecognitionSupported();

  // Settings State
  const [accent, setAccent] = useState<'en-US' | 'en-GB'>('en-US');
  const [speed, setSpeed] = useState<number>(1.0);
  const [mode, setMode] = useState<ShadowingMode>('echo');

  // Sentence Selection State
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [customInputSentence, setCustomInputSentence] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);

  // Active Sentence Target
  const currentSentence = useMemo(() => {
    if (initialSentence) return initialSentence;
    if (isCustomMode && customInputSentence.trim()) return customInputSentence.trim();
    return PRESET_SENTENCES[selectedIdx]?.sentence || PRESET_SENTENCES[0].sentence;
  }, [initialSentence, isCustomMode, customInputSentence, selectedIdx]);

  const currentTranslation = useMemo(() => {
    if (initialTranslation) return initialTranslation;
    if (isCustomMode) return 'Câu tự nhập của học viên';
    return PRESET_SENTENCES[selectedIdx]?.translation || '';
  }, [initialTranslation, isCustomMode, selectedIdx]);

  const currentLevel = useMemo<CEFRLevel | undefined>(() => {
    if (isCustomMode || initialSentence) return undefined;
    const preset = PRESET_SENTENCES[selectedIdx];
    return preset?.level && VALID_CEFR_LEVELS.has(preset.level as CEFRLevel)
      ? (preset.level as CEFRLevel)
      : undefined;
  }, [isCustomMode, initialSentence, selectedIdx]);

  // Session & Feedback State
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [feedback, setFeedback] = useState<ShadowingFeedback | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const activeSessionRef = useRef<ShadowingSessionHandle | null>(null);

  // Stop session on unmount
  useEffect(() => {
    return () => {
      stopShadowingSession();
    };
  }, []);

  // Split sentence into words for visual teleprompter
  const words = useMemo(() => {
    return currentSentence.trim().split(/\s+/).filter(Boolean);
  }, [currentSentence]);

  // Compute focus index & status map for each word in the teleprompter
  const wordStatusMap = useMemo(() => {
    if (!feedback) return [];

    // Filter out extra spoken words so we only have target words
    const targetResults = feedback.wordResults.filter(w => w.status !== 'extra');

    // Find highest index of attempted words (correct or mispronounced)
    let lastAttemptedIndex = -1;
    for (let i = 0; i < targetResults.length; i++) {
      if (targetResults[i]?.status === 'correct' || targetResults[i]?.status === 'mispronounced') {
        lastAttemptedIndex = i;
      }
    }

    return words.map((_, idx) => {
      const result = targetResults[idx];
      if (!result) return { status: 'unspoken' as const, isFocus: false };

      if (sessionState === 'recording') {
        if (idx <= lastAttemptedIndex) {
          return { status: result.status, isFocus: false };
        } else if (idx === lastAttemptedIndex + 1) {
          return { status: 'unspoken' as const, isFocus: true };
        } else {
          return { status: 'unspoken' as const, isFocus: false };
        }
      }

      // If completed or idle
      return { status: result.status, isFocus: false };
    });
  }, [feedback, words, sessionState]);

  // Detected extra filler words
  const extraWords = useMemo(() => {
    if (!feedback) return [];
    return feedback.wordResults.filter(w => w.status === 'extra').map(w => w.word);
  }, [feedback]);

  // Start Shadowing Session
  const handleStartSession = useCallback(() => {
    setErrorMessage(null);
    setIsSaved(false);
    setFeedback(null);

    const handle = startShadowingSession({
      targetSentence: currentSentence,
      mode,
      accent,
      speed,
      onTTSStart: () => {
        setSessionState('playing_tts');
      },
      onTTSEnd: () => {
        if (mode === 'echo') {
          setSessionState('echo_countdown');
        }
      },
      onSTTStart: () => {
        setSessionState('recording');
      },
      onInterimFeedback: (interim) => {
        setFeedback(interim);
      },
      onFinalFeedback: (final) => {
        setFeedback(final);
      },
      onError: (msg) => {
        setErrorMessage(msg);
        setSessionState('idle');
      },
      onSessionEnd: () => {
        setSessionState(prev => prev === 'recording' ? 'completed' : 'idle');
      },
    });

    activeSessionRef.current = handle;
  }, [currentSentence, mode, accent, speed]);

  // Stop Session
  const handleStopSession = useCallback(() => {
    if (activeSessionRef.current) {
      activeSessionRef.current.stop();
      activeSessionRef.current = null;
    } else {
      stopShadowingSession();
    }
    setSessionState('completed');
  }, []);

  // Listen to Model TTS independently
  const handlePlayModelPrompt = useCallback(() => {
    stopShadowingSession();
    setSessionState('playing_tts');
    playShadowingPrompt({
      text: currentSentence,
      accent,
      speed,
      volume: 1.0,
      onEnd: () => {
        setSessionState('idle');
      },
      onError: (err) => {
        setErrorMessage(`Lỗi phát âm: ${err?.message || 'Không thể phát âm'}`);
        setSessionState('idle');
      }
    });
  }, [currentSentence, accent, speed]);

  // Reset Session
  const handleResetSession = useCallback(() => {
    stopShadowingSession();
    setSessionState('idle');
    setFeedback(null);
    setErrorMessage(null);
    setIsSaved(false);
  }, []);

  // Save Score & Gain XP
  const handleSaveResult = useCallback(() => {
    if (!feedback || isSaved) return;

    recordSkillEvidence({
      skill: 'speaking',
      score: feedback.accuracyScore,
      source: 'shadowing',
      cefrDifficulty: currentLevel,
      quality: 0.65, // Conservative quality weighting for shadowing repetition
      metadata: {
        sentence: currentSentence,
        fluencyScore: feedback.fluencyScore,
        transcript: feedback.transcript,
      },
    });
    const xpEarned = feedback.accuracyScore >= 85 ? 25 : feedback.accuracyScore >= 60 ? 15 : 5;
    gainXP(xpEarned);
    setIsSaved(true);

    if (feedback.accuracyScore >= 80) {
      triggerCelebration('micro');
    }

    onCompleted?.(feedback.accuracyScore);
  }, [feedback, isSaved, currentLevel, currentSentence, gainXP, onCompleted]);

  return (
    <div className="space-y-6 text-slate-100 animate-fadeIn">
      {/* 1. HEADER & CONTROL BAR */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-xl shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <span>Smart Shadowing Studio</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Real-time AI
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Luyện nói đuổi theo giọng bản xứ với Teleprompter phân tích từng từ theo thời gian thực
              </p>
            </div>
          </div>

          {/* Quick Stats Badges */}
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              <span>Chế độ: {mode === 'echo' ? 'Echo (Lặp lại)' : 'Simultaneous (Nói đuổi)'}</span>
            </span>
          </div>
        </div>

        {/* CONTROLS: Mode, Accent, Speed */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Mode Switcher */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Chế độ Shadowing
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => { setMode('echo'); handleResetSession(); }}
                disabled={sessionState !== 'idle'}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all ${
                  mode === 'echo'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                } disabled:opacity-50`}
              >
                Echo Mode
              </button>
              <button
                type="button"
                onClick={() => { setMode('simultaneous'); handleResetSession(); }}
                disabled={sessionState !== 'idle'}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all ${
                  mode === 'simultaneous'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                } disabled:opacity-50`}
              >
                Simultaneous
              </button>
            </div>
          </div>

          {/* Accent Switcher */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Giọng phát âm mẫu
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setAccent('en-US')}
                disabled={sessionState !== 'idle'}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  accent === 'en-US'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                } disabled:opacity-50`}
              >
                <span>🇺🇸 US Accent</span>
              </button>
              <button
                type="button"
                onClick={() => setAccent('en-GB')}
                disabled={sessionState !== 'idle'}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  accent === 'en-GB'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                } disabled:opacity-50`}
              >
                <span>🇬🇧 UK Accent</span>
              </button>
            </div>
          </div>

          {/* Speed Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Tốc độ mẫu
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setSpeed(0.75)}
                disabled={sessionState !== 'idle'}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all ${
                  speed === 0.75
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                } disabled:opacity-50`}
              >
                Chậm 0.75x
              </button>
              <button
                type="button"
                onClick={() => setSpeed(1.0)}
                disabled={sessionState !== 'idle'}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all ${
                  speed === 1.0
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                } disabled:opacity-50`}
              >
                Chuẩn 1.0x
              </button>
            </div>
          </div>
        </div>

        {/* SENTENCE PICKER CAROUSEL (IF NOT EMBEDDED WITH INITIAL SENTENCE) */}
        {!initialSentence && (
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
            <span className="text-xs font-bold text-slate-400 shrink-0">Chọn mẫu:</span>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {PRESET_SENTENCES.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedIdx(idx);
                    setIsCustomMode(false);
                    handleResetSession();
                  }}
                  disabled={sessionState !== 'idle'}
                  className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                    !isCustomMode && selectedIdx === idx
                      ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  #{idx + 1} {item.topic}
                </button>
              ))}
              <button
                onClick={() => {
                  setIsCustomMode(true);
                  handleResetSession();
                }}
                disabled={sessionState !== 'idle'}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                  isCustomMode
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                ✍️ Tự nhập câu
              </button>
            </div>
          </div>
        )}

        {/* Custom Input Field if in Custom Mode */}
        {isCustomMode && !initialSentence && (
          <div className="pt-2">
            <input
              type="text"
              value={customInputSentence}
              onChange={(e) => setCustomInputSentence(e.target.value)}
              placeholder="Nhập bất kỳ câu tiếng Anh nào bạn muốn luyện Shadowing..."
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-2xl text-sm text-white placeholder-slate-500 outline-none transition-all"
            />
          </div>
        )}
      </div>

      {/* 2. BROWSER SUPPORT WARNING (IF NOT SUPPORTED) */}
      {!isSpeechSupported && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-3xl flex items-start gap-3.5 text-amber-300 shadow-xl">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-left text-xs sm:text-sm">
            <p className="font-bold">Trình duyệt chưa hỗ trợ Web Speech API để ghi âm & so khớp giọng nói.</p>
            <p className="text-slate-300 leading-relaxed">
              Bạn vẫn có thể bấm nút <strong>Nghe lại mẫu</strong> để nghe phát âm. Để mở khóa toàn bộ tính năng tự động ghi âm và chấm điểm phát âm theo thời gian thực, vui lòng mở trang trên <strong>Google Chrome</strong> hoặc <strong>Microsoft Edge</strong>.
            </p>
          </div>
        </div>
      )}

      {/* 3. ERROR MESSAGE BANNER */}
      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-3xl flex items-center justify-between gap-3 text-rose-300 text-xs sm:text-sm shadow-xl">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-slate-400 hover:text-white text-xs underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* 4. MAIN VISUAL TELEPROMPTER VIEWPORT */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Background Ambient Glow */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* State Indicator Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2">
            {sessionState === 'playing_tts' && (
              <span className="flex items-center gap-2 text-xs font-bold text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/30 animate-pulse">
                <Volume2 className="w-3.5 h-3.5" />
                <span>Đang phát âm giọng đọc mẫu bản xứ...</span>
              </span>
            )}
            {sessionState === 'echo_countdown' && (
              <span className="flex items-center gap-2 text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30 animate-pulse">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Chuẩn bị nói trong 0.5s...</span>
              </span>
            )}
            {sessionState === 'recording' && (
              <span className="flex items-center gap-2 text-xs font-bold text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/30 animate-pulse">
                <Mic className="w-3.5 h-3.5 text-rose-400" />
                <span>Micro đang lắng nghe! Hãy đọc đuổi theo câu mẫu...</span>
              </span>
            )}
            {sessionState === 'completed' && (
              <span className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Hoàn thành bài tập Shadowing</span>
              </span>
            )}
            {sessionState === 'idle' && (
              <span className="text-xs font-bold text-slate-400">
                Sẵn sàng. Bấm nút Micro tròn bên dưới để bắt đầu.
              </span>
            )}
          </div>

          <div className="text-xs text-slate-400 font-mono">
            {words.length} từ
          </div>
        </div>

        {/* Visual Teleprompter Display */}
        <div className="p-6 sm:p-8 bg-slate-950/80 rounded-2xl border border-slate-800/90 text-center leading-loose">
          <div className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-wide flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 select-none">
            {words.map((word, idx) => {
              const info = wordStatusMap[idx];
              const status = info?.status || 'unspoken';
              const isFocus = info?.isFocus || false;

              let styleClasses = 'text-slate-400 dark:text-slate-500 transition-all duration-200';

              if (isFocus) {
                styleClasses = 'text-cyan-200 border border-cyan-400/80 bg-cyan-950/40 shadow-[0_0_15px_rgba(34,211,238,0.4)] rounded-xl px-2 py-0.5 animate-pulse';
              } else if (status === 'correct') {
                styleClasses = 'text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 rounded-xl px-2 py-0.5 font-black shadow-sm';
              } else if (status === 'mispronounced') {
                styleClasses = 'text-amber-400 bg-amber-950/50 border border-amber-500/30 rounded-xl px-2 py-0.5 font-bold shadow-sm';
              } else if (status === 'missing') {
                styleClasses = 'text-rose-400 underline decoration-rose-500 decoration-wavy decoration-2 px-1';
              }

              return (
                <span
                  key={`${word}_${idx}`}
                  className={`inline-block ${styleClasses}`}
                >
                  {word}
                </span>
              );
            })}
          </div>

          {/* Vietnamese Translation Guide */}
          {currentTranslation && (
            <p className="mt-5 text-xs sm:text-sm text-slate-400 italic">
              "{currentTranslation}"
            </p>
          )}
        </div>

        {/* Real-time Streaming Transcript & Filler Words Alert */}
        {feedback && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Bản nhận diện giọng nói thực tế:</span>
              {extraWords.length > 0 && (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <span>⚠️ Từ đệm thừa:</span>
                  {extraWords.map((ew, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-amber-500/20 text-[11px] font-mono">
                      "{ew}"
                    </span>
                  ))}
                </span>
              )}
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono italic">
              {feedback.transcript || '(Đang lắng nghe...)'}
            </div>
          </div>
        )}

        {/* 5. AUDIO INTERACTION CONTROLS */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
          
          {/* Re-listen Button */}
          <button
            type="button"
            onClick={handlePlayModelPrompt}
            disabled={sessionState === 'recording'}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all shadow-md disabled:opacity-50"
          >
            <Volume2 className="w-4 h-4 text-cyan-400" />
            <span>Nghe lại mẫu</span>
          </button>

          {/* MAIN CIRCULAR MICROPHONE BUTTON */}
          <div className="relative flex items-center justify-center">
            {/* Animated Pulsing Wave Rings when recording */}
            {sessionState === 'recording' && (
              <>
                <motion.div
                  className="absolute w-28 h-28 rounded-full bg-rose-500/20"
                  animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                />
                <motion.div
                  className="absolute w-24 h-24 rounded-full bg-purple-500/30"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.8, 0.2, 0.8] }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                />
              </>
            )}

            {sessionState === 'playing_tts' && (
              <motion.div
                className="absolute w-24 h-24 rounded-full bg-cyan-500/25"
                animate={{ scale: [1, 1.25, 1], opacity: [0.7, 0.1, 0.7] }}
                transition={{ repeat: Infinity, duration: 1.0, ease: 'easeInOut' }}
              />
            )}

            <button
              type="button"
              onClick={sessionState === 'recording' ? handleStopSession : handleStartSession}
              disabled={!isSpeechSupported}
              className={`relative z-10 w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl ${
                sessionState === 'recording'
                  ? 'bg-gradient-to-tr from-rose-600 to-red-500 text-white shadow-rose-500/40 hover:scale-105'
                  : sessionState === 'playing_tts'
                  ? 'bg-gradient-to-tr from-cyan-600 to-blue-500 text-white shadow-cyan-500/30'
                  : 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-purple-500/40 hover:scale-105 active:scale-95'
              } disabled:opacity-50 disabled:pointer-events-none`}
            >
              {sessionState === 'recording' ? (
                <div className="flex flex-col items-center">
                  <div className="w-5 h-5 rounded-md bg-white mb-1" />
                  <span className="text-[10px] font-black uppercase">Dừng</span>
                </div>
              ) : sessionState === 'playing_tts' ? (
                <Volume2 className="w-8 h-8 animate-pulse" />
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </button>
          </div>

          {/* Reset Button */}
          <button
            type="button"
            onClick={handleResetSession}
            disabled={sessionState === 'idle'}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all shadow-md disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4 text-purple-400" />
            <span>Làm lại</span>
          </button>
        </div>

        {/* 6. SCORE & SUMMARY CARD */}
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-5 sm:p-6 bg-slate-950 border border-slate-800 rounded-3xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">Kết Quả Đánh Giá Shadowing</h3>
              </div>
              <div className="text-xs font-bold text-slate-400">
                Khớp {feedback.completedWords} / {feedback.totalWords} từ chuẩn
              </div>
            </div>

            {/* Score Metric Bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Accuracy Bar */}
              <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-300">Độ chuẩn xác (Accuracy):</span>
                  <span className={`text-sm font-black ${
                    feedback.accuracyScore >= 80 ? 'text-emerald-400' : feedback.accuracyScore >= 60 ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {feedback.accuracyScore}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      feedback.accuracyScore >= 80 ? 'bg-emerald-500' : feedback.accuracyScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${feedback.accuracyScore}%` }}
                  />
                </div>
              </div>

              {/* Fluency Bar */}
              <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-300">Độ lưu loát (Fluency):</span>
                  <span className="text-sm font-black text-purple-400">
                    {feedback.fluencyScore}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all duration-500 rounded-full"
                    style={{ width: `${feedback.fluencyScore}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Action Bar: Save Result */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>
                  Phần thưởng:{' '}
                  <strong className="text-amber-400">
                    +{feedback.accuracyScore >= 85 ? 25 : feedback.accuracyScore >= 60 ? 15 : 5} XP
                  </strong>
                </span>
              </div>

              <button
                type="button"
                onClick={handleSaveResult}
                disabled={isSaved}
                className={`w-full sm:w-auto px-6 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg ${
                  isSaved
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white'
                }`}
              >
                {isSaved ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Đã lưu vào hồ sơ Speaking!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Lưu Kết Quả & Nhận XP</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
