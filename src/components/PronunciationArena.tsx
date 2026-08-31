import React, { useState, useEffect } from 'react';
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
  Award
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAppStore } from '../store/useAppStore';
import { speakWord, createSpeechRecognizer, calculateAccuracy } from '../services/speechService';
import { VocabWord } from '../types';

type PronunciationSubTab = 'ai_speech' | 'shadowing' | 'dictation';

export const PronunciationArena: React.FC = () => {
  const { 
    vocabularyList, 
    gainXP, 
    consumeHeart, 
    recordPronunciationMastered,
    audioVoice, 
    audioSpeed 
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<PronunciationSubTab>('ai_speech');
  const [currentIdx, setCurrentIdx] = useState(0);

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

  const currentWord: VocabWord | undefined = vocabularyList[currentIdx % vocabularyList.length];

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
    setCurrentIdx((prev) => prev + 1);
  };

  // 1. Logic Luyện Nói AI (AI Speech)
  const handleStartAISpeech = () => {
    if (!currentWord) return;
    setMicError('');
    setAccuracyScore(null);
    setTranscript('');

    const handle = createSpeechRecognizer(
      (text, isFinal) => {
        setTranscript(text);
        if (isFinal) {
          setIsRecording(false);
          const acc = calculateAccuracy(currentWord.word, text);
          setAccuracyScore(acc);

          if (acc >= 75) {
            recordPronunciationMastered(20);
            confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
          } else {
            consumeHeart();
          }
        }
      },
      (err) => {
        setMicError(err);
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

          if (acc >= 70) {
            gainXP(25);
            confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
          }
        }
      },
      (err) => {
        setMicError(err);
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

    if (isMatch) {
      gainXP(20);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    } else {
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
              onClick={handleStartAISpeech}
              disabled={isRecording}
              className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl ${
                isRecording
                  ? 'bg-red-500 text-white shadow-red-500/40'
                  : 'bg-gradient-to-tr from-teal-500 to-emerald-400 hover:scale-105 text-slate-950 shadow-teal-500/30'
              }`}
            >
              {isRecording ? <MicOff className="w-8 h-8 animate-bounce" /> : <Mic className="w-8 h-8" />}
            </button>
          </div>

          <p className="text-xs text-slate-400">
            {isRecording 
              ? '🎙️ Đang lắng nghe bạn nói... hãy phát âm to và rõ ràng nhé!' 
              : 'Nhấn vào Micro và đọc to từ vựng tiếng Anh trên'}
          </p>

          {transcript && (
            <div className="bg-slate-850 border border-slate-750 p-4 rounded-2xl text-slate-300 text-sm">
              Trình duyệt nghe thấy: <strong className="text-white">"{transcript}"</strong>
            </div>
          )}

          {accuracyScore !== null && (
            <div className={`p-4 rounded-2xl flex items-center justify-between ${
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
              className="flex items-center gap-2 px-6 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black rounded-2xl shadow-lg shadow-teal-500/20 transition-all text-sm"
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
                  className="px-8 py-4 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black rounded-2xl shadow-xl shadow-teal-500/25 transition-all text-base flex items-center justify-center gap-3 mx-auto transform hover:scale-105"
                >
                  <Play className="w-5 h-5 fill-slate-950" />
                  <span>Nghe Mẫu & Bắt Đầu Shadowing</span>
                </button>
                <p className="text-xs text-slate-400">
                  Hệ thống sẽ phát câu mẫu $\rightarrow$ Đếm 3 giây $\rightarrow$ Bạn nói đè theo nhịp điệu!
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

    </div>
  );
};
