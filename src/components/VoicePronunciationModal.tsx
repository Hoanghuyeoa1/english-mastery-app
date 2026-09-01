import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  Sparkles, 
  X, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Award,
  Zap,
  Info
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAppStore } from '../store/useAppStore';
import { 
  createSpeechRecognizer, 
  speakWord, 
  assessPronunciation, 
  PronunciationAssessmentResult 
} from '../services/speechService';

interface VoicePronunciationModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetText: string;
  ipa?: string;
  meaning?: string;
  example?: string;
  onSuccess?: (score: number) => void;
}

export const VoicePronunciationModal: React.FC<VoicePronunciationModalProps> = ({
  isOpen,
  onClose,
  targetText,
  ipa,
  meaning,
  example,
  onSuccess,
}) => {
  const { audioVoice, audioSpeed, gainXP, recordMistake, recordMistakeCorrect } = useAppStore();

  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [assessmentResult, setAssessmentResult] = useState<PronunciationAssessmentResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognizerRef = useRef<any>(null);

  // Reset state when opening with new text
  useEffect(() => {
    if (isOpen) {
      setIsListening(false);
      setInterimTranscript('');
      setAssessmentResult(null);
      setErrorMessage(null);
    } else {
      if (recognizerRef.current) {
        recognizerRef.current.stop();
        recognizerRef.current = null;
      }
      setIsListening(false);
    }
  }, [isOpen, targetText]);

  // Clean up recognizer on unmount
  useEffect(() => {
    return () => {
      if (recognizerRef.current) {
        recognizerRef.current.stop();
      }
    };
  }, []);

  const handleStartListening = useCallback(() => {
    setErrorMessage(null);
    setAssessmentResult(null);
    setInterimTranscript('');

    if (recognizerRef.current) {
      recognizerRef.current.stop();
      recognizerRef.current = null;
    }

    const recognizer = createSpeechRecognizer(
      (transcript, isFinal) => {
        setInterimTranscript(transcript);

        if (isFinal) {
          setIsListening(false);
          const result = assessPronunciation(targetText, transcript);
          setAssessmentResult(result);

          if (result.score >= 85) {
            confetti({ particleCount: 70, spread: 75, origin: { y: 0.6 } });
            gainXP(result.xpEarned || 25);
            recordMistakeCorrect(targetText);
            onSuccess?.(result.score);
          } else if (result.score >= 60) {
            gainXP(result.xpEarned || 15);
            onSuccess?.(result.score);
          } else {
            // Điểm thấp -> Ghi nhận vào bẫy lỗi để nhắc ôn tập lại
            recordMistake({ word: targetText, meaning: meaning || '' }, 'pronunciation');
          }
        }
      },
      (err) => {
        setErrorMessage(err);
        setIsListening(false);
      },
      () => {
        setIsListening(false);
      }
    );

    if (recognizer) {
      recognizerRef.current = recognizer;
      setIsListening(true);
    }
  }, [targetText, meaning, gainXP, recordMistake, recordMistakeCorrect, onSuccess]);

  const handleStopListening = () => {
    if (recognizerRef.current) {
      recognizerRef.current.stop();
      recognizerRef.current = null;
    }
    setIsListening(false);
  };

  const handlePlaySample = () => {
    speakWord(targetText, audioVoice, audioSpeed);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-xl bg-slate-900 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden space-y-6"
      >
        
        {/* Ambient Glow */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 rounded-2xl">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>Chấm Điểm Phát Âm Micro</span>
                <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-bold">
                  AI Speech
                </span>
              </h3>
              <p className="text-xs text-slate-400">Đọc to từ/câu để AI phân tích ngữ âm & tính điểm chính xác</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Word Display Card */}
        <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-2xl text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {targetText}
            </h2>
            <button
              onClick={handlePlaySample}
              title="Nghe mẫu phát âm bản xứ"
              className="p-2 bg-slate-800 hover:bg-emerald-500 text-slate-300 hover:text-slate-950 rounded-xl transition-all shadow-sm"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>

          {ipa && ipa.trim().length > 0 && ipa !== '//' && (
            <span className="inline-block px-3 py-1 bg-slate-850 text-emerald-400 rounded-lg text-sm font-mono border border-slate-750">
              {ipa}
            </span>
          )}

          {meaning && (
            <p className="text-sm text-slate-300 font-medium pt-1">
              {meaning}
            </p>
          )}

          {example && (
            <p className="text-xs text-slate-400 italic pt-1 border-t border-slate-850 mt-2">
              "{example}"
            </p>
          )}
        </div>

        {/* Interactive Speech Recognition Arena */}
        <div className="flex flex-col items-center justify-center py-2 space-y-4">
          
          {/* Pulsing Mic Waveform Animation */}
          <div className="relative flex items-center justify-center">
            {isListening && (
              <>
                <span className="absolute w-28 h-28 rounded-full bg-emerald-500/20 animate-ping" />
                <span className="absolute w-24 h-24 rounded-full bg-teal-500/30 animate-pulse" />
              </>
            )}

            <button
              onClick={isListening ? handleStopListening : handleStartListening}
              className={`relative z-10 w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-xl transition-all transform hover:scale-105 active:scale-95 ${
                isListening
                  ? 'bg-gradient-to-tr from-rose-500 to-red-500 text-white shadow-rose-500/30 ring-4 ring-rose-500/40'
                  : 'bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 text-slate-950 shadow-emerald-500/30 ring-4 ring-emerald-500/20'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-8 h-8 animate-pulse" />
                </>
              ) : (
                <>
                  <Mic className="w-8 h-8" />
                </>
              )}
            </button>
          </div>

          <div className="text-center space-y-1">
            <span className={`text-xs sm:text-sm font-bold block ${isListening ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`}>
              {isListening ? '🎙️ Đang lắng nghe giọng đọc của bạn...' : 'Bấm vào Micro và đọc to câu trên'}
            </span>
            <span className="text-[11px] text-slate-500 block">
              {isListening ? 'Hệ thống sẽ tự động chấm điểm sau khi bạn ngừng nói' : 'Khuyến khích đọc rõ âm đuôi & ngữ điệu'}
            </span>
          </div>

          {/* Real-time recognized text preview */}
          {interimTranscript && (
            <div className="w-full p-3.5 bg-slate-850 border border-slate-750 rounded-xl text-center">
              <span className="text-[11px] text-slate-400 block uppercase font-bold tracking-wider mb-1">
                Giọng nói nhận diện:
              </span>
              <p className="text-sm font-mono text-cyan-300 font-semibold">
                "{interimTranscript}"
              </p>
            </div>
          )}

          {/* Error Message Notice */}
          {errorMessage && (
            <div className="w-full p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-2.5 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">{errorMessage}</p>
                <p className="text-rose-400/80 text-[11px]">
                  Mẹo: Hãy kiểm tra biểu tượng chiếc khóa trên thanh địa chỉ duyệt web và cấp quyền Micro.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Assessment Result Box */}
        <AnimatePresence>
          {assessmentResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={`p-5 rounded-2xl border space-y-3.5 ${
                assessmentResult.tier === 'excellent'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-lg shadow-emerald-500/10'
                  : assessmentResult.tier === 'good'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 shadow-lg shadow-amber-500/10'
                  : 'bg-rose-500/10 border-rose-500/40 text-rose-300 shadow-lg shadow-rose-500/10'
              }`}
            >
              {/* Score Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {assessmentResult.tier === 'excellent' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  ) : assessmentResult.tier === 'good' ? (
                    <Sparkles className="w-6 h-6 text-amber-400" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-rose-400" />
                  )}
                  <div>
                    <h4 className="font-extrabold text-sm sm:text-base text-white">
                      {assessmentResult.title}
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {assessmentResult.feedback}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-black font-mono">
                    {assessmentResult.score}%
                  </div>
                  {assessmentResult.xpEarned > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                      +{assessmentResult.xpEarned} XP
                    </span>
                  )}
                </div>
              </div>

              {/* Word-by-word Analysis Chips */}
              <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Phân tích từng từ:
                </span>
                <div className="flex flex-wrap gap-2">
                  {assessmentResult.words.map((w, idx) => (
                    <span
                      key={idx}
                      className={`px-3 py-1 rounded-xl text-xs font-bold font-mono border flex items-center gap-1 ${
                        w.status === 'perfect'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                          : w.status === 'near'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/50 line-through opacity-80'
                      }`}
                    >
                      <span>{w.word}</span>
                      <span className="text-[10px] opacity-75">({w.score}%)</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  onClick={handlePlaySample}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Nghe lại âm mẫu</span>
                </button>

                <button
                  onClick={handleStartListening}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Đọc lại</span>
                </button>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer info */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-850">
          <span className="flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Tiêu chuẩn giọng: <strong>{audioVoice}</strong></span>
          </span>
          <span>Web Speech API • Real-time Levenshtein</span>
        </div>

      </motion.div>
    </div>
  );
};
