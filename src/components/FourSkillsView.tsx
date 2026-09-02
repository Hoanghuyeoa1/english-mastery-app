import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Headphones, 
  BookOpen, 
  Mic, 
  PenTool, 
  Play, 
  Pause, 
  Volume2, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Award, 
  PlusCircle, 
  Check, 
  Flame, 
  Eye, 
  EyeOff, 
  FileText, 
  MessageSquare, 
  HelpCircle, 
  Layers, 
  RotateCcw,
  Trophy,
  X 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAppStore } from '../store/useAppStore';
import { speakWord } from '../services/speechService';
import { recordSkillScore } from '../services/skillsCompetencyService';
import { VOCAB_10000_BANK } from '../data/defaultVocab';
import { 
  LISTENING_LESSONS, 
  READING_LESSONS, 
  SPEAKING_PROMPTS, 
  WRITING_PROMPTS,
  ListeningLesson,
  ReadingLesson,
  SpeakingPrompt,
  SpeakingTurn,
  WritingPrompt
} from '../data/fourSkillsData';
import { ActiveTab } from '../types';

interface FourSkillsViewProps {
  onNavigate?: (tab: ActiveTab) => void;
  onOpenAddWord?: (word?: string) => void;
}

type SkillType = 'listening' | 'reading' | 'speaking' | 'writing';

export const FourSkillsView: React.FC<FourSkillsViewProps> = ({ onNavigate }) => {
  const { gainXP, addCustomWord, profile, activeFourSkill, setActiveFourSkill } = useAppStore();
  const [activeSkill, setActiveSkill] = useState<SkillType>(activeFourSkill || 'listening');

  // Sync with global store activeFourSkill when changed from Navbar
  useEffect(() => {
    if (activeFourSkill && activeFourSkill !== activeSkill) {
      setActiveSkill(activeFourSkill);
    }
  }, [activeFourSkill]);

  const handleSwitchSkill = (skill: SkillType) => {
    setActiveSkill(skill);
    setActiveFourSkill(skill);
  };

  // Popup Click-to-Translate State
  const [lookupWord, setLookupWord] = useState<{
    word: string;
    ipa: string;
    partOfSpeech: string;
    meaning: string;
    example?: string;
  } | null>(null);
  const [addedSuccessWord, setAddedSuccessWord] = useState<string | null>(null);

  // Completed Lessons Tracking (LocalStorage Persistence)
  const [completedListenIds, setCompletedListenIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('completed_listening_lessons') || '[]');
    } catch {
      return [];
    }
  });

  const [completedReadIds, setCompletedReadIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('completed_reading_lessons') || '[]');
    } catch {
      return [];
    }
  });

  const [completedSpeakingIds, setCompletedSpeakingIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('completed_speaking_prompts') || '[]');
    } catch {
      return [];
    }
  });

  const [completedWritingIds, setCompletedWritingIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('completed_writing_prompts') || '[]');
    } catch {
      return [];
    }
  });

  // =========================================================================
  // 1. LISTENING LAB STATE & CATALOG
  // =========================================================================
  const [selectedListenLesson, setSelectedListenLesson] = useState<ListeningLesson | null>(null);
  const [listenCategoryFilter, setListenCategoryFilter] = useState<string>('ALL');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioSpeed, setAudioSpeed] = useState<number>(1.0);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number>(-1);
  const [showListenVi, setShowListenVi] = useState<boolean>(true);
  const [listenDisplayMode, setListenDisplayMode] = useState<'paragraph' | 'dialogue'>('paragraph');
  const [listeningQuizAnswers, setListeningQuizAnswers] = useState<Record<string, number>>({});
  const [listeningQuizSubmitted, setListeningQuizSubmitted] = useState<boolean>(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // =========================================================================
  // 2. READING COMPREHENSION STATE & CATALOG
  // =========================================================================
  const [selectedReadLesson, setSelectedReadLesson] = useState<ReadingLesson | null>(null);
  const [readCategoryFilter, setReadCategoryFilter] = useState<string>('ALL');
  const [readingQuizAnswers, setReadingQuizAnswers] = useState<Record<string, number>>({});
  const [readingQuizSubmitted, setReadingQuizSubmitted] = useState<boolean>(false);

  // =========================================================================
  // 3. MULTI-TURN SPEAKING STUDIO STATE & CATALOG
  // =========================================================================
  const [selectedSpeakingPrompt, setSelectedSpeakingPrompt] = useState<SpeakingPrompt | null>(null);
  const [speakingCategoryFilter, setSpeakingCategoryFilter] = useState<string>('ALL');
  const [currentSpeakingTurnIndex, setCurrentSpeakingTurnIndex] = useState<number>(0);
  const [speakingTurnScores, setSpeakingTurnScores] = useState<Record<number, { accuracy: number; transcript: string; feedback: string }>>({});
  const [isSpeakingFinished, setIsSpeakingFinished] = useState<boolean>(false);
  const [isRecordingSpeaking, setIsRecordingSpeaking] = useState<boolean>(false);
  const [speakingTranscript, setSpeakingTranscript] = useState<string>('');
  const [speakingScore, setSpeakingScore] = useState<number | null>(null);
  const [speakingFeedback, setSpeakingFeedback] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // =========================================================================
  // 4. WRITING STUDIO STATE & CATALOG
  // =========================================================================
  const [selectedWritingPrompt, setSelectedWritingPrompt] = useState<WritingPrompt | null>(null);
  const [writingCategoryFilter, setWritingCategoryFilter] = useState<string>('ALL');
  const [writingContent, setWritingContent] = useState<string>('');
  const [writingAnalysis, setWritingAnalysis] = useState<{
    score: number;
    wordCount: number;
    strengths: string[];
    suggestions: string[];
    upgrades: { original: string; better: string; explanation: string }[];
  } | null>(null);
  const [showModelAnswer, setShowModelAnswer] = useState<boolean>(false);

  // Confetti helper
  const fireSuccessConfetti = () => {
    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.7 },
      });
    } catch {
      // fallback
    }
  };

  // Click-to-Translate Helper: Look up word in unified bank
  const handleWordClick = (rawWord: string) => {
    const clean = rawWord.toLowerCase().replace(/[^a-z0-9'-]/gi, '').trim();
    if (!clean || clean.length < 2) return;

    const found = VOCAB_10000_BANK.find((w) => w.word.toLowerCase() === clean);
    if (found) {
      setLookupWord({
        word: found.word,
        ipa: found.ipa || '',
        partOfSpeech: found.partOfSpeech || 'noun',
        meaning: found.meaning || 'Từ vựng tiếng Anh',
        example: found.example,
      });
    } else {
      setLookupWord({
        word: rawWord.replace(/[^a-zA-Z]/g, ''),
        ipa: `/${clean}/`,
        partOfSpeech: 'word',
        meaning: `Đang tra cứu: "${rawWord.replace(/[^a-zA-Z]/g, '')}". Nhấp vào Thêm để đưa vào thẻ SRS!`,
        example: `Example with "${clean}".`,
      });
    }
  };

  const handleAddLookupToSRS = () => {
    if (!lookupWord) return;
    addCustomWord({
      word: lookupWord.word,
      ipa: lookupWord.ipa,
      partOfSpeech: lookupWord.partOfSpeech,
      meaning: lookupWord.meaning,
      example: lookupWord.example || `I am studying the word "${lookupWord.word}".`,
      tag: 'Daily',
    });
    setAddedSuccessWord(lookupWord.word);
    fireSuccessConfetti();
    setTimeout(() => {
      setAddedSuccessWord(null);
    }, 2500);
  };

  // Helper render Clickable Paragraph
  const renderClickableText = (text: string) => {
    const tokens = text.split(/(\s+)/);
    return tokens.map((token, idx) => {
      const isWord = /[a-zA-Z0-9]/.test(token);
      if (!isWord) return <span key={idx}>{token}</span>;

      return (
        <span
          key={idx}
          onClick={() => handleWordClick(token)}
          title="Nhấp để xem nghĩa tiếng Việt & Thêm vào Flashcard"
          className="hover:text-cyan-400 hover:underline hover:bg-cyan-500/15 rounded px-0.5 cursor-pointer transition-colors duration-150"
        >
          {token}
        </span>
      );
    });
  };

  // =========================================================================
  // AUDIO SYNTHESIS PLAYBACK ENGINE (LISTENING LAB)
  // =========================================================================
  const handlePlayListeningAudio = () => {
    if (!('speechSynthesis' in window)) {
      alert('Trình duyệt của bạn không hỗ trợ Web Speech API.');
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      setActiveSentenceIndex(-1);
      return;
    }

    if (!selectedListenLesson) return;

    window.speechSynthesis.cancel();
    const textToSpeak = selectedListenLesson.audioText;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'en-US';
    utterance.rate = audioSpeed;

    utterance.onstart = () => {
      setIsPlayingAudio(true);
      setActiveSentenceIndex(0);
    };

    utterance.onend = () => {
      setIsPlayingAudio(false);
      setActiveSentenceIndex(-1);
    };

    utterance.onerror = () => {
      setIsPlayingAudio(false);
      setActiveSentenceIndex(-1);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // Cleanup audio on unmount or lesson change
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [selectedListenLesson, activeSkill]);

  // Submit Listening Quiz
  const handleSubmitListeningQuiz = () => {
    if (!selectedListenLesson) return;
    setListeningQuizSubmitted(true);
    let correctCount = 0;
    selectedListenLesson.questions.forEach((q) => {
      if (listeningQuizAnswers[q.id] === q.correctIndex) {
        correctCount++;
      }
    });

    const totalQuestions = selectedListenLesson.questions.length || 1;
    const listeningPct = Math.round((correctCount / totalQuestions) * 100);
    recordSkillScore('listening', listeningPct);

    if (correctCount > 0) {
      gainXP(correctCount * 15);
      fireSuccessConfetti();

      // Mark completed
      if (!completedListenIds.includes(selectedListenLesson.id)) {
        const nextCompleted = [...completedListenIds, selectedListenLesson.id];
        setCompletedListenIds(nextCompleted);
        localStorage.setItem('completed_listening_lessons', JSON.stringify(nextCompleted));
      }
    }
  };

  // Submit Reading Quiz
  const handleSubmitReadingQuiz = () => {
    if (!selectedReadLesson) return;
    setReadingQuizSubmitted(true);
    let correctCount = 0;
    selectedReadLesson.questions.forEach((q) => {
      if (readingQuizAnswers[q.id] === q.correctIndex) {
        correctCount++;
      }
    });

    const totalQuestions = selectedReadLesson.questions.length || 1;
    const readingPct = Math.round((correctCount / totalQuestions) * 100);
    recordSkillScore('reading', readingPct);

    if (correctCount > 0) {
      gainXP(correctCount * 15);
      fireSuccessConfetti();

      // Mark completed
      if (!completedReadIds.includes(selectedReadLesson.id)) {
        const nextCompleted = [...completedReadIds, selectedReadLesson.id];
        setCompletedReadIds(nextCompleted);
        localStorage.setItem('completed_reading_lessons', JSON.stringify(nextCompleted));
      }
    }
  };

  // =========================================================================
  // MULTI-TURN SPEAKING ENGINE (WEB SPEECH RECOGNITION)
  // =========================================================================
  const handleSelectSpeakingPrompt = (prompt: SpeakingPrompt) => {
    setSelectedSpeakingPrompt(prompt);
    setCurrentSpeakingTurnIndex(0);
    setSpeakingTurnScores({});
    setIsSpeakingFinished(false);
    setSpeakingTranscript('');
    setSpeakingScore(null);
    setSpeakingFeedback(null);
  };

  const handleToggleSpeakingRecord = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Trình duyệt không hỗ trợ nhận diện giọng nói Web Speech API (khuyên dùng Google Chrome / Edge).');
      return;
    }

    if (isRecordingSpeaking) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecordingSpeaking(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsRecordingSpeaking(true);
        setSpeakingTranscript('');
        setSpeakingScore(null);
        setSpeakingFeedback(null);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setSpeakingTranscript(currentTranscript);
      };

      recognition.onerror = () => {
        setIsRecordingSpeaking(false);
      };

      recognition.onend = () => {
        setIsRecordingSpeaking(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsRecordingSpeaking(false);
    }
  };

  // Evaluate Current Speaking Turn
  useEffect(() => {
    if (!isRecordingSpeaking && speakingTranscript.trim().length > 0 && selectedSpeakingPrompt) {
      const currentTurn = selectedSpeakingPrompt.turns[currentSpeakingTurnIndex];
      if (!currentTurn) return;

      const target = currentTurn.targetSentence.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      const user = speakingTranscript.toLowerCase().replace(/[^a-z0-9\s]/g, '');

      const targetWords = target.split(/\s+/).filter(Boolean);
      const userWords = user.split(/\s+/).filter(Boolean);

      let matchedWords = 0;
      targetWords.forEach((tw) => {
        if (userWords.includes(tw)) matchedWords++;
      });

      const accuracy = Math.min(100, Math.round((matchedWords / Math.max(1, targetWords.length)) * 100));
      setSpeakingScore(accuracy);

      let feedbackMsg = '';
      if (accuracy >= 80) {
        feedbackMsg = '🎉 Phát âm rất chuẩn xác và tự nhiên!';
      } else if (accuracy >= 60) {
        feedbackMsg = '👍 Khá tốt! Cố gắng nhấn mạnh thêm các từ khóa chính.';
      } else {
        feedbackMsg = '💡 Cần luyện thêm. Hãy bấm nút Nghe Mẫu để bắt đúng nhịp điệu nhé!';
      }

      setSpeakingFeedback(feedbackMsg);

      // Record Turn Score
      setSpeakingTurnScores((prev) => ({
        ...prev,
        [currentSpeakingTurnIndex]: {
          accuracy,
          transcript: speakingTranscript,
          feedback: feedbackMsg,
        },
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecordingSpeaking, speakingTranscript]);

  const handleNextSpeakingTurn = () => {
    if (!selectedSpeakingPrompt) return;

    if (currentSpeakingTurnIndex < selectedSpeakingPrompt.turns.length - 1) {
      setCurrentSpeakingTurnIndex((prev) => prev + 1);
      setSpeakingTranscript('');
      setSpeakingScore(null);
      setSpeakingFeedback(null);
    } else {
      // Finished all turns!
      setIsSpeakingFinished(true);
      gainXP(40);
      fireSuccessConfetti();

      // Check average score
      const allScores = Object.values(speakingTurnScores).map((s) => s.accuracy);
      const avg = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 80;
      recordSkillScore('speaking', avg);

      if (avg >= 60 && !completedSpeakingIds.includes(selectedSpeakingPrompt.id)) {
        const nextCompleted = [...completedSpeakingIds, selectedSpeakingPrompt.id];
        setCompletedSpeakingIds(nextCompleted);
        localStorage.setItem('completed_speaking_prompts', JSON.stringify(nextCompleted));
      }
    }
  };

  // =========================================================================
  // WRITING STUDIO ASSESSMENT & HEURISTIC CHECKER
  // =========================================================================
  const handleAnalyzeWriting = () => {
    if (!selectedWritingPrompt) return;
    const trimmed = writingContent.trim();
    if (!trimmed) {
      alert('Vui lòng viết đoạn văn hoặc email trước khi chấm bài.');
      return;
    }

    const words = trimmed.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    const strengths: string[] = [];
    const suggestions: string[] = [];
    const upgrades: { original: string; better: string; explanation: string }[] = [];

    // Heuristics
    if (wordCount >= selectedWritingPrompt.minWords) {
      strengths.push(`Đạt độ dài yêu cầu (${wordCount}/${selectedWritingPrompt.minWords} từ).`);
    } else {
      suggestions.push(`Bài viết còn ngắn (${wordCount} từ). Hãy mở rộng thêm ý để đạt tối thiểu ${selectedWritingPrompt.minWords} từ.`);
    }

    const commonReplacements: Record<string, { better: string; explanation: string }> = {
      good: { better: 'exceptional / proficient', explanation: 'Dùng từ vựng C1 để nâng cao tính chuyên nghiệp' },
      bad: { better: 'suboptimal / adverse', explanation: 'Tránh từ sơ cấp trong báo cáo công việc' },
      big: { better: 'substantial / pivotal', explanation: 'Tăng trọng lượng cho luận điểm' },
      important: { better: 'crucial / indispensable', explanation: 'Nhấn mạnh tính cấp thiết' },
      make: { better: 'implement / generate', explanation: 'Từ hành động mang tính kỹ thuật' },
      problem: { better: 'bottleneck / impediment', explanation: 'Thuật ngữ tiêu chuẩn trong dự án' },
      help: { better: 'facilitate / expedite', explanation: 'Thể hiện năng lực hỗ trợ chuyên sâu' },
    };

    Object.entries(commonReplacements).forEach(([basicWord, repl]) => {
      const regex = new RegExp(`\\b${basicWord}\\b`, 'gi');
      if (regex.test(trimmed)) {
        upgrades.push({
          original: basicWord,
          better: repl.better,
          explanation: repl.explanation,
        });
      }
    });

    if (upgrades.length === 0) {
      strengths.push('Vốn từ vựng đa dạng, không bị lặp các từ ngữ sơ cấp thông thường.');
    }

    const sentenceCount = trimmed.split(/[.!?]+/).filter(Boolean).length;
    if (sentenceCount >= 3) {
      strengths.push(`Cấu trúc đoạn văn tốt gồm ${sentenceCount} câu mạch lạc.`);
    }

    let calculatedScore = 70;
    if (wordCount >= selectedWritingPrompt.minWords) calculatedScore += 15;
    if (sentenceCount >= 3) calculatedScore += 10;
    if (upgrades.length <= 2) calculatedScore += 5;
    calculatedScore = Math.min(98, calculatedScore);

    setWritingAnalysis({
      score: calculatedScore,
      wordCount,
      strengths,
      suggestions,
      upgrades,
    });

    gainXP(30);
    fireSuccessConfetti();
    recordSkillScore('writing', calculatedScore);

    // Mark completed
    if (calculatedScore >= 70 && !completedWritingIds.includes(selectedWritingPrompt.id)) {
      const nextCompleted = [...completedWritingIds, selectedWritingPrompt.id];
      setCompletedWritingIds(nextCompleted);
      localStorage.setItem('completed_writing_prompts', JSON.stringify(nextCompleted));
    }
  };

  // Filtered Lists
  const filteredListeningLessons = LISTENING_LESSONS.filter((l) => {
    if (listenCategoryFilter === 'ALL') return true;
    return l.category.toLowerCase().includes(listenCategoryFilter.toLowerCase());
  });

  const filteredReadingLessons = READING_LESSONS.filter((r) => {
    if (readCategoryFilter === 'ALL') return true;
    return r.category.toLowerCase().includes(readCategoryFilter.toLowerCase());
  });

  const filteredSpeakingPrompts = SPEAKING_PROMPTS.filter((s) => {
    if (speakingCategoryFilter === 'ALL') return true;
    return s.category.toLowerCase().includes(speakingCategoryFilter.toLowerCase());
  });

  const filteredWritingPrompts = WRITING_PROMPTS.filter((w) => {
    if (writingCategoryFilter === 'ALL') return true;
    return (
      w.type.toLowerCase().includes(writingCategoryFilter.toLowerCase()) ||
      w.category.toLowerCase().includes(writingCategoryFilter.toLowerCase())
    );
  });

  return (
    <div className="space-y-8 pb-16 animate-fadeIn select-none">
      
      {/* 1. TOP HERO HEADER & 4-SKILLS MASTER HUB DASHBOARD */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 rounded-full text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Phân Hệ Toàn Diện 4 Kỹ Năng</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              4-Skills Mastery Hub
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm max-w-xl leading-relaxed">
              Luyện trọn vẹn <strong className="text-cyan-300">Nghe • Đọc • Nói • Viết</strong> với tra từ 1-chạm, hội thoại đa lượt Roleplay AI và sửa bài viết thông minh.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 p-3 rounded-2xl">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-850 rounded-xl">
              <Flame className="w-4 h-4 text-orange-400 fill-orange-400" />
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Streak</span>
                <strong className="text-sm font-black text-white">{profile.streak || 1} ngày</strong>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-850 rounded-xl">
              <Award className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Level</span>
                <strong className="text-sm font-black text-amber-400">Lv.{profile.level}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* 4 INTERACTIVE SKILL TABS (ALWAYS VISIBLE AT TOP) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-6 relative z-10">
          
          {/* TAB 1: LISTENING */}
          <button
            onClick={() => handleSwitchSkill('listening')}
            className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between ${
              activeSkill === 'listening'
                ? 'bg-gradient-to-r from-teal-500/20 via-cyan-500/15 to-slate-900 border-cyan-400 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-400/50'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850 opacity-80 hover:opacity-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                activeSkill === 'listening' ? 'bg-cyan-400 text-slate-950 font-black' : 'bg-slate-800 text-cyan-400'
              }`}>
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-xs sm:text-sm text-white block">🎧 Luyện Nghe</span>
                <span className="text-[11px] text-slate-400">Listening Lab ({LISTENING_LESSONS.length} bài)</span>
              </div>
            </div>
            {activeSkill === 'listening' && <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />}
          </button>

          {/* TAB 2: READING */}
          <button
            onClick={() => handleSwitchSkill('reading')}
            className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between ${
              activeSkill === 'reading'
                ? 'bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-slate-900 border-emerald-400 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-400/50'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850 opacity-80 hover:opacity-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                activeSkill === 'reading' ? 'bg-emerald-400 text-slate-950 font-black' : 'bg-slate-800 text-emerald-400'
              }`}>
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-xs sm:text-sm text-white block">📖 Luyện Đọc</span>
                <span className="text-[11px] text-slate-400">Reading Studio ({READING_LESSONS.length} bài)</span>
              </div>
            </div>
            {activeSkill === 'reading' && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
          </button>

          {/* TAB 3: SPEAKING */}
          <button
            onClick={() => handleSwitchSkill('speaking')}
            className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between ${
              activeSkill === 'speaking'
                ? 'bg-gradient-to-r from-purple-500/20 via-pink-500/15 to-slate-900 border-purple-400 shadow-xl shadow-purple-500/10 ring-1 ring-purple-400/50'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850 opacity-80 hover:opacity-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                activeSkill === 'speaking' ? 'bg-purple-400 text-slate-950 font-black' : 'bg-slate-800 text-purple-400'
              }`}>
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-xs sm:text-sm text-white block">🗣️ Luyện Nói</span>
                <span className="text-[11px] text-slate-400">Roleplay AI ({SPEAKING_PROMPTS.length} chủ đề)</span>
              </div>
            </div>
            {activeSkill === 'speaking' && <div className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />}
          </button>

          {/* TAB 4: WRITING */}
          <button
            onClick={() => handleSwitchSkill('writing')}
            className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between ${
              activeSkill === 'writing'
                ? 'bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-slate-900 border-amber-400 shadow-xl shadow-amber-500/10 ring-1 ring-amber-400/50'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850 opacity-80 hover:opacity-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                activeSkill === 'writing' ? 'bg-amber-400 text-slate-950 font-black' : 'bg-slate-800 text-amber-400'
              }`}>
                <PenTool className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-xs sm:text-sm text-white block">✍️ Luyện Viết</span>
                <span className="text-[11px] text-slate-400">Writing Studio ({WRITING_PROMPTS.length} đề bài)</span>
              </div>
            </div>
            {activeSkill === 'writing' && <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
          </button>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CLICK-TO-TRANSLATE FLOATING MODAL                                      */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {lookupWord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border-2 border-cyan-500/50 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-black text-white">{lookupWord.word}</h3>
                    <button
                      onClick={() => speakWord(lookupWord.word)}
                      title="Phát âm từ này"
                      className="p-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-xl"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-xs font-mono text-cyan-400 block mt-0.5">{lookupWord.ipa}</span>
                </div>

                <button
                  onClick={() => setLookupWord(null)}
                  className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs sm:text-sm">
                <span className="px-2 py-0.5 bg-slate-850 text-slate-400 rounded-md text-[10px] font-bold uppercase inline-block mb-1">
                  {lookupWord.partOfSpeech}
                </span>
                <p className="text-emerald-300 font-bold leading-relaxed">{lookupWord.meaning}</p>
                {lookupWord.example && (
                  <p className="text-slate-400 italic text-xs pt-1 border-t border-slate-850">
                    "{lookupWord.example}"
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleAddLookupToSRS}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {addedSuccessWord === lookupWord.word ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Đã Thêm Vào SRS!</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      <span>+ Thêm Vào Flashcard SRS</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setLookupWord(null)}
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-2xl text-xs"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 3. SKILL CONTENT PANELS                                                   */}
      {/* ========================================================================= */}

      {/* --- PANEL A: LISTENING LAB (CATALOG GRID & DETAIL VIEW) --- */}
      {activeSkill === 'listening' && (
        <div className="space-y-6">
          
          {/* A1. LESSON CATALOG GRID (When no lesson is selected) */}
          {!selectedListenLesson ? (
            <div className="space-y-6 animate-fadeIn">
              {/* Filter Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-base sm:text-lg font-black text-white">
                    Kho Bài Nghe Thực Tế ({filteredListeningLessons.length} bài)
                  </h2>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  {['ALL', 'Tech', 'Workplace', 'Interview', 'Daily Life'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setListenCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                        listenCategoryFilter === cat
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-black'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat === 'ALL' ? 'Tất cả' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Catalog Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredListeningLessons.map((lesson) => {
                  const isCompleted = completedListenIds.includes(lesson.id);
                  return (
                    <div
                      key={lesson.id}
                      onClick={() => {
                        setSelectedListenLesson(lesson);
                        setListeningQuizAnswers({});
                        setListeningQuizSubmitted(false);
                      }}
                      className="group cursor-pointer bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/40 rounded-3xl p-5 sm:p-6 transition-all duration-300 flex flex-col justify-between shadow-xl relative overflow-hidden"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 rounded-md text-[11px] font-bold">
                              {lesson.category}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-800 rounded-md text-[10px] text-slate-300 font-mono font-bold">
                              {lesson.level}
                            </span>
                          </div>

                          {isCompleted ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Đã xong</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-500">
                              ⏱ {lesson.duration} • {lesson.questions.length} câu hỏi
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-extrabold text-white group-hover:text-cyan-300 transition-colors line-clamp-2">
                          {lesson.title}
                        </h3>

                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {lesson.description}
                        </p>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-850 flex items-center justify-between text-xs font-bold text-cyan-400">
                        <span>Luyện nghe ngay</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* A2. LESSON DETAIL VIEW */
            <div className="space-y-6 animate-fadeIn">
              
              {/* Back to Catalog Button */}
              <button
                onClick={() => {
                  setSelectedListenLesson(null);
                  if (isPlayingAudio) {
                    window.speechSynthesis.cancel();
                    setIsPlayingAudio(false);
                  }
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-2xl text-xs font-bold flex items-center gap-2 transition-all shadow-md group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform text-cyan-400" />
                <span>⬅ Quay lại danh sách bài nghe</span>
              </button>

              {/* Audio Player & Controller */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 rounded-md text-xs font-bold">
                        {selectedListenLesson.category}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-800 rounded-md text-[10px] text-slate-300 font-mono font-bold">
                        {selectedListenLesson.level}
                      </span>
                      <span className="text-xs text-slate-500">• Thời lượng: {selectedListenLesson.duration} ({selectedListenLesson.questions.length} câu hỏi)</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-white">{selectedListenLesson.title}</h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">{selectedListenLesson.description}</p>
                  </div>

                  {/* Audio Controls */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {[0.75, 1.0, 1.25].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setAudioSpeed(speed)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${
                          audioSpeed === speed
                            ? 'bg-cyan-400 text-slate-950 border-cyan-400 font-black'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}

                    <button
                      onClick={handlePlayListeningAudio}
                      className={`px-6 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all transform hover:scale-105 ${
                        isPlayingAudio
                          ? 'bg-rose-500 text-white shadow-rose-500/30 animate-pulse'
                          : 'bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 shadow-cyan-400/25'
                      }`}
                    >
                      {isPlayingAudio ? (
                        <>
                          <Pause className="w-4 h-4 fill-white" />
                          <span>Dừng Nghe</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-slate-950" />
                          <span>Nghe Bài Đọc</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Interactive Transcript with Click-to-Translate & Mode Switcher */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
                    <span className="font-bold uppercase tracking-wider text-slate-500">
                      💡 Nhấp vào bất kỳ từ nào để tra nghĩa & thêm vào Flashcard:
                    </span>
                    
                    <div className="flex items-center gap-3">
                      {/* Mode Switcher */}
                      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
                        <button
                          onClick={() => setListenDisplayMode('paragraph')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                            listenDisplayMode === 'paragraph'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          📄 Đoạn văn liền mạch
                        </button>
                        <button
                          onClick={() => setListenDisplayMode('dialogue')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                            listenDisplayMode === 'dialogue'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          💬 Từng câu thoại
                        </button>
                      </div>

                      <button
                        onClick={() => setShowListenVi(!showListenVi)}
                        className="flex items-center gap-1.5 text-cyan-400 hover:underline font-semibold"
                      >
                        {showListenVi ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-cyan-400" />}
                        <span>{showListenVi ? 'Ẩn dịch' : 'Hiện dịch'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Mode A: Standard Continuous Paragraph Layout */}
                  {listenDisplayMode === 'paragraph' ? (
                    <div className="p-6 sm:p-7 bg-slate-950/90 border border-slate-800 rounded-3xl space-y-5 shadow-inner">
                      <p className="text-base sm:text-lg text-slate-100 font-normal leading-loose tracking-wide select-text">
                        {selectedListenLesson.sentences.map((sent, sIdx) => {
                          const isCurrentActive = activeSentenceIndex === sIdx;
                          return (
                            <span
                              key={sIdx}
                              className={`transition-all duration-300 rounded px-1 py-0.5 mr-1.5 inline ${
                                isCurrentActive
                                  ? 'bg-cyan-500/25 text-cyan-200 font-semibold shadow-sm ring-1 ring-cyan-400/50'
                                  : 'text-slate-200'
                              }`}
                            >
                              {renderClickableText(sent.en)}
                            </span>
                          );
                        })}
                      </p>

                      {showListenVi && (
                        <div className="pt-4 border-t border-slate-850 space-y-2 animate-fadeIn">
                          <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">
                            🇻🇳 Bản Dịch Toàn Văn:
                          </span>
                          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-sans">
                            {selectedListenLesson.sentences.map((s) => s.vi).join(' ')}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Mode B: Dialogue Sentence-by-Sentence Layout */
                    <div className="space-y-3 p-5 bg-slate-950/80 border border-slate-800 rounded-2xl">
                      {selectedListenLesson.sentences.map((sent, idx) => (
                        <div 
                          key={idx} 
                          className={`p-3.5 rounded-xl transition-all ${
                            activeSentenceIndex === idx ? 'bg-cyan-500/15 border border-cyan-500/30' : 'bg-slate-900/50'
                          }`}
                        >
                          <p className="text-sm sm:text-base text-slate-100 font-medium leading-relaxed">
                            {renderClickableText(sent.en)}
                          </p>
                          {showListenVi && (
                            <p className="text-xs text-slate-400 pt-1.5 border-t border-slate-850 mt-1.5 font-sans">
                              {sent.vi}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Comprehension Quiz (4-5 Questions) */}
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-cyan-400" />
                    <span>Kiểm Tra Độ Hiểu Bài ({selectedListenLesson.questions.length} câu trắc nghiệm)</span>
                  </h3>

                  <div className="space-y-4">
                    {selectedListenLesson.questions.map((q, qIdx) => {
                      const selectedOpt = listeningQuizAnswers[q.id];
                      return (
                        <div key={q.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                          <p className="text-xs sm:text-sm font-bold text-white">
                            {qIdx + 1}. {q.question}
                          </p>

                          <div className="space-y-2">
                            {q.options.map((opt, optIdx) => {
                              const isPicked = selectedOpt === optIdx;
                              const isCorrect = q.correctIndex === optIdx;
                              return (
                                <button
                                  key={optIdx}
                                  disabled={listeningQuizSubmitted}
                                  onClick={() => {
                                    setListeningQuizAnswers((prev) => ({ ...prev, [q.id]: optIdx }));
                                  }}
                                  className={`w-full p-3 rounded-xl text-left text-xs font-semibold transition-all flex items-center justify-between border ${
                                    listeningQuizSubmitted
                                      ? isCorrect
                                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                                        : isPicked
                                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                                        : 'bg-slate-900 border-slate-800 text-slate-500'
                                      : isPicked
                                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                                  }`}
                                >
                                  <span>{opt}</span>
                                  {listeningQuizSubmitted && isCorrect && <Check className="w-4 h-4 text-emerald-400" />}
                                </button>
                              );
                            })}
                          </div>

                          {listeningQuizSubmitted && (
                            <p className="text-xs text-slate-400 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                              💡 <strong className="text-cyan-300">Giải thích:</strong> {q.explanation}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {!listeningQuizSubmitted ? (
                    <button
                      onClick={handleSubmitListeningQuiz}
                      className="px-6 py-3 bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-lg shadow-cyan-400/20 transition-all hover:scale-105"
                    >
                      Nộp Bài Kiểm Tra (+30 XP)
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Đã hoàn thành kiểm tra độ hiểu bài!</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- PANEL B: READING COMPREHENSION (CATALOG GRID & DETAIL VIEW) --- */}
      {activeSkill === 'reading' && (
        <div className="space-y-6">
          
          {/* B1. READING CATALOG GRID (When no article is selected) */}
          {!selectedReadLesson ? (
            <div className="space-y-6 animate-fadeIn">
              {/* Filter Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-base sm:text-lg font-black text-white">
                    Kho Bài Đọc Chuyên Sâu ({filteredReadingLessons.length} bài)
                  </h2>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  {['ALL', 'Tech & AI', 'Science & Habit', 'Workplace Culture', 'Career & Business'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setReadCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                        readCategoryFilter === cat
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-black'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat === 'ALL' ? 'Tất cả' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Catalog Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredReadingLessons.map((article) => {
                  const isCompleted = completedReadIds.includes(article.id);
                  return (
                    <div
                      key={article.id}
                      onClick={() => {
                        setSelectedReadLesson(article);
                        setReadingQuizAnswers({});
                        setReadingQuizSubmitted(false);
                      }}
                      className="group cursor-pointer bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-5 sm:p-6 transition-all duration-300 flex flex-col justify-between shadow-xl relative overflow-hidden"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-md text-[11px] font-bold">
                              {article.category}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-800 rounded-md text-[10px] text-slate-300 font-mono font-bold">
                              {article.level}
                            </span>
                          </div>

                          {isCompleted ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Đã xong</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-500">
                              📖 {article.readTime} • {article.questions.length} câu hỏi
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors line-clamp-2">
                          {article.title}
                        </h3>

                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {article.summary}
                        </p>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-850 flex items-center justify-between text-xs font-bold text-emerald-400">
                        <span>Đọc bài & Tra từ</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* B2. ARTICLE DETAIL VIEW */
            <div className="space-y-6 animate-fadeIn">
              
              {/* Back to Catalog Button */}
              <button
                onClick={() => setSelectedReadLesson(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-2xl text-xs font-bold flex items-center gap-2 transition-all shadow-md group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform text-emerald-400" />
                <span>⬅ Quay lại danh sách bài đọc</span>
              </button>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                <div className="border-b border-slate-800 pb-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-md text-xs font-bold">
                      {selectedReadLesson.category}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-800 rounded-md text-[10px] text-slate-300 font-mono font-bold">
                      {selectedReadLesson.level}
                    </span>
                    <span className="text-xs text-slate-500">• {selectedReadLesson.readTime} đọc ({selectedReadLesson.wordCount} từ • {selectedReadLesson.questions.length} câu hỏi)</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">{selectedReadLesson.title}</h2>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{selectedReadLesson.summary}</p>
                </div>

                {/* Reading Article Body: Fluid Standard Multi-Paragraph Layout */}
                <div className="p-6 sm:p-8 bg-slate-950/90 border border-slate-800 rounded-3xl shadow-inner text-slate-100 space-y-4">
                  <span className="text-[11px] font-bold text-slate-500 block mb-3 uppercase tracking-wider">
                    💡 Nhấp vào bất kỳ từ nào bên dưới để tra nghĩa & lưu vào Flashcard:
                  </span>
                  {selectedReadLesson.content.map((paragraph, pIdx) => (
                    <p key={pIdx} className="text-base sm:text-lg leading-loose tracking-wide text-slate-200 indent-4 sm:indent-6 mb-4 last:mb-0 text-justify select-text">
                      {renderClickableText(paragraph)}
                    </p>
                  ))}
                </div>

                {/* Key Vocabulary Highlights */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>Từ vựng trọng tâm trong bài:</span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedReadLesson.keyVocab.map((kv, idx) => (
                      <div 
                        key={idx}
                        onClick={() => handleWordClick(kv.word)}
                        className="p-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl cursor-pointer transition-all flex items-center justify-between"
                      >
                        <div>
                          <strong className="text-white text-xs block">{kv.word}</strong>
                          <span className="text-[11px] text-slate-400">{kv.meaning}</span>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-mono">{kv.ipa}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reading Quiz (4-5 Questions) */}
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-emerald-400" />
                    <span>Câu Hỏi Đọc Hiểu ({selectedReadLesson.questions.length} câu trắc nghiệm)</span>
                  </h3>

                  <div className="space-y-4">
                    {selectedReadLesson.questions.map((q, qIdx) => {
                      const selectedOpt = readingQuizAnswers[q.id];
                      return (
                        <div key={q.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                          <p className="text-xs sm:text-sm font-bold text-white">
                            {qIdx + 1}. {q.question}
                          </p>

                          <div className="space-y-2">
                            {q.options.map((opt, optIdx) => {
                              const isPicked = selectedOpt === optIdx;
                              const isCorrect = q.correctIndex === optIdx;
                              return (
                                <button
                                  key={optIdx}
                                  disabled={readingQuizSubmitted}
                                  onClick={() => {
                                    setReadingQuizAnswers((prev) => ({ ...prev, [q.id]: optIdx }));
                                  }}
                                  className={`w-full p-3 rounded-xl text-left text-xs font-semibold transition-all flex items-center justify-between border ${
                                    readingQuizSubmitted
                                      ? isCorrect
                                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                                        : isPicked
                                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                                        : 'bg-slate-900 border-slate-800 text-slate-500'
                                      : isPicked
                                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                                  }`}
                                >
                                  <span>{opt}</span>
                                  {readingQuizSubmitted && isCorrect && <Check className="w-4 h-4 text-emerald-400" />}
                                </button>
                              );
                            })}
                          </div>

                          {readingQuizSubmitted && (
                            <p className="text-xs text-slate-400 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                              💡 <strong className="text-emerald-300">Giải thích:</strong> {q.explanation}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {!readingQuizSubmitted ? (
                    <button
                      onClick={handleSubmitReadingQuiz}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-lg shadow-emerald-400/20 transition-all hover:scale-105"
                    >
                      Nộp Bài Đọc Hiểu (+30 XP)
                    </button>
                  ) : (
                    <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Bạn đã hoàn thành bài tập đọc hiểu xuất sắc!</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- PANEL C: MULTI-TURN SPEAKING STUDIO (CATALOG GRID, ROLEPLAY TURNS & SUMMARY) --- */}
      {activeSkill === 'speaking' && (
        <div className="space-y-6">
          
          {/* C1. SPEAKING TOPIC CATALOG GRID */}
          {!selectedSpeakingPrompt ? (
            <div className="space-y-6 animate-fadeIn">
              {/* Filter Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-purple-400" />
                  <h2 className="text-base sm:text-lg font-black text-white">
                    Kho Hội Thoại Đa Lượt Roleplay ({filteredSpeakingPrompts.length} chủ đề)
                  </h2>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  {['ALL', 'Job Interview', 'Agile Standup', 'Daily Conversation', 'Workplace Negotiation', 'Tech Support'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSpeakingCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                        speakingCategoryFilter === cat
                          ? 'bg-purple-500/20 border-purple-400 text-purple-300 font-black'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat === 'ALL' ? 'Tất cả' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Catalog Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSpeakingPrompts.map((prompt) => {
                  const isCompleted = completedSpeakingIds.includes(prompt.id);
                  return (
                    <div
                      key={prompt.id}
                      onClick={() => handleSelectSpeakingPrompt(prompt)}
                      className="group cursor-pointer bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-purple-500/40 rounded-3xl p-5 sm:p-6 transition-all duration-300 flex flex-col justify-between shadow-xl relative overflow-hidden"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 bg-purple-500/15 border border-purple-500/30 text-purple-400 rounded-md text-[11px] font-bold">
                              {prompt.category}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-800 rounded-md text-[10px] text-purple-300 font-mono font-bold">
                              {prompt.level}
                            </span>
                          </div>

                          {isCompleted ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Đã luyện</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                              💬 {prompt.turns.length} lượt đối thoại
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-extrabold text-white group-hover:text-purple-300 transition-colors line-clamp-2">
                          {prompt.title}
                        </h3>

                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {prompt.scenario}
                        </p>

                        <div className="p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-xl">
                          <span className="text-[10px] font-bold text-purple-400 uppercase block mb-0.5">Đối tác mở đầu:</span>
                          <p className="text-xs text-slate-300 italic line-clamp-1">"{prompt.turns[0]?.partnerPrompt}"</p>
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-850 flex items-center justify-between text-xs font-bold text-purple-400">
                        <span>Bắt đầu hội thoại</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* C2. MULTI-TURN SPEAKING PRACTICE / SUMMARY VIEW */
            <div className="space-y-6 animate-fadeIn">
              
              {/* Back to Catalog Button */}
              <button
                onClick={() => {
                  setSelectedSpeakingPrompt(null);
                  if (isRecordingSpeaking && recognitionRef.current) {
                    recognitionRef.current.stop();
                    setIsRecordingSpeaking(false);
                  }
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-2xl text-xs font-bold flex items-center gap-2 transition-all shadow-md group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform text-purple-400" />
                <span>⬅ Quay lại danh sách chủ đề nói</span>
              </button>

              {/* View 1: ACTIVE DIALOGUE TURN IN PROGRESS */}
              {!isSpeakingFinished ? (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                  
                  {/* Turn Progress Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 bg-purple-500/15 border border-purple-500/30 text-purple-400 rounded-md text-xs font-bold">
                          {selectedSpeakingPrompt.category}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-800 rounded-md text-[10px] text-purple-300 font-mono font-bold">
                          {selectedSpeakingPrompt.level}
                        </span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-white">{selectedSpeakingPrompt.title}</h2>
                      <p className="text-xs sm:text-sm text-slate-400">{selectedSpeakingPrompt.scenario}</p>
                    </div>

                    {/* Step Tracker Indicator */}
                    <div className="flex items-center gap-1.5 bg-slate-950 p-2 rounded-2xl border border-slate-800 shrink-0">
                      {selectedSpeakingPrompt.turns.map((t, idx) => {
                        const isDone = speakingTurnScores[idx] !== undefined;
                        const isCurrent = currentSpeakingTurnIndex === idx;
                        return (
                          <div
                            key={idx}
                            className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs transition-all ${
                              isCurrent
                                ? 'bg-purple-500 text-white shadow-md shadow-purple-500/40 ring-2 ring-purple-400'
                                : isDone
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : 'bg-slate-900 text-slate-500'
                            }`}
                          >
                            {idx + 1}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Partner Speech Bubble */}
                  {selectedSpeakingPrompt.turns[currentSpeakingTurnIndex] && (
                    <div className="p-4 sm:p-5 bg-slate-950 border border-slate-800 rounded-3xl flex items-start gap-3 shadow-inner">
                      <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[11px] font-black text-purple-400 uppercase tracking-wider">
                            Đối tác hội thoại (Partner) • Lượt {currentSpeakingTurnIndex + 1}/{selectedSpeakingPrompt.turns.length}:
                          </span>
                          <button
                            onClick={() => speakWord(selectedSpeakingPrompt.turns[currentSpeakingTurnIndex].partnerPrompt)}
                            title="Nghe đối tác nói"
                            className="p-1.5 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 rounded-xl transition-colors"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm sm:text-base font-semibold text-slate-100 leading-relaxed">
                          {selectedSpeakingPrompt.turns[currentSpeakingTurnIndex].partnerPrompt}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* User Target Response Box */}
                  {selectedSpeakingPrompt.turns[currentSpeakingTurnIndex] && (
                    <div className="p-6 bg-gradient-to-br from-purple-950/30 to-slate-950 border-2 border-purple-500/30 rounded-3xl space-y-3 text-center">
                      <span className="text-xs font-black text-purple-400 uppercase tracking-wider block">
                        🎯 Câu Bạn Cần Phản Hồi (Target Response):
                      </span>
                      <p className="text-base sm:text-xl font-black text-white leading-relaxed">
                        "{selectedSpeakingPrompt.turns[currentSpeakingTurnIndex].targetSentence}"
                      </p>
                      <p className="text-xs font-mono text-purple-300">
                        {selectedSpeakingPrompt.turns[currentSpeakingTurnIndex].phonetic}
                      </p>
                      <p className="text-xs text-slate-400 italic pt-1">
                        🇻🇳 Nghĩa: {selectedSpeakingPrompt.turns[currentSpeakingTurnIndex].meaningVi}
                      </p>

                      {/* Sample Audio Button */}
                      <div className="pt-2 flex justify-center">
                        <button
                          onClick={() => speakWord(selectedSpeakingPrompt.turns[currentSpeakingTurnIndex].sampleAudioText)}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                        >
                          <Volume2 className="w-4 h-4" />
                          <span>Nghe Phát Âm Mẫu</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Micro Recording Button & Feedback */}
                  <div className="pt-2 flex flex-col items-center gap-4 text-center">
                    <button
                      onClick={handleToggleSpeakingRecord}
                      className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all transform hover:scale-110 active:scale-95 ${
                        isRecordingSpeaking
                          ? 'bg-rose-500 text-white shadow-rose-500/50 animate-bounce'
                          : 'bg-gradient-to-tr from-purple-500 to-pink-500 text-white shadow-purple-500/30'
                      }`}
                    >
                      <Mic className="w-8 h-8" />
                    </button>

                    <span className="text-xs font-bold text-slate-400">
                      {isRecordingSpeaking ? '🔴 Đang nghe bạn nói... (Bấm lại để dừng)' : 'Bấm micro và đọc to câu phản hồi'}
                    </span>

                    {/* Live Transcript & Feedback */}
                    {speakingTranscript && (
                      <div className="w-full max-w-xl p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 animate-fadeIn text-left">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-400">Kết quả lượt này:</span>
                          {speakingScore !== null && (
                            <span className={`text-sm font-black px-3 py-1 rounded-full ${
                              speakingScore >= 80 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            }`}>
                              Độ chính xác: {speakingScore}%
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-medium text-white italic">
                          "{speakingTranscript}"
                        </p>

                        {speakingFeedback && (
                          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-xs text-purple-300 font-semibold">
                            {speakingFeedback}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Next Turn / Finish Button */}
                    {speakingTurnScores[currentSpeakingTurnIndex] !== undefined && (
                      <div className="pt-3 animate-fadeIn">
                        <button
                          onClick={handleNextSpeakingTurn}
                          className="px-8 py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-black rounded-2xl text-xs sm:text-sm shadow-xl shadow-purple-500/25 transition-all flex items-center gap-2 transform hover:scale-105"
                        >
                          {currentSpeakingTurnIndex < selectedSpeakingPrompt.turns.length - 1 ? (
                            <>
                              <span>Chuyển Sang Lượt Tiếp Theo</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          ) : (
                            <>
                              <Trophy className="w-4 h-4 text-amber-300" />
                              <span>Xem Bảng Tổng Kết Đánh Giá</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                /* View 2: OVERALL EVALUATION SUMMARY REPORT SCREEN */
                <div className="bg-slate-900 border-2 border-purple-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-fadeIn">
                  
                  {/* Top Trophy Banner */}
                  <div className="text-center space-y-2 border-b border-slate-800 pb-6">
                    <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-purple-500 to-pink-500 text-white flex items-center justify-center mx-auto shadow-xl shadow-purple-500/30">
                      <Trophy className="w-8 h-8 text-amber-200" />
                    </div>
                    <h3 className="text-2xl font-black text-white">Tổng Kết Phiên Hội Thoại Roleplay</h3>
                    <p className="text-xs sm:text-sm text-slate-400">
                      Chủ đề: <strong className="text-purple-300">{selectedSpeakingPrompt.title}</strong>
                    </p>

                    {/* Overall Score Badge */}
                    {(() => {
                      const allScores = Object.values(speakingTurnScores).map((s) => s.accuracy);
                      const avg = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 85;
                      return (
                        <div className="pt-2">
                          <span className={`inline-block px-5 py-2 rounded-2xl text-lg font-black border ${
                            avg >= 80 
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' 
                              : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          }`}>
                            Điểm Phát Âm Trung Bình: {avg}%
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Turn-by-Turn Breakdown List */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-purple-400 uppercase tracking-wider">
                      📋 Chi tiết từng lượt đối thoại:
                    </h4>

                    {selectedSpeakingPrompt.turns.map((turn, idx) => {
                      const turnScore = speakingTurnScores[idx];
                      return (
                        <div key={idx} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-400">
                              Lượt {idx + 1}:
                            </span>
                            {turnScore ? (
                              <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                                turnScore.accuracy >= 80
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}>
                                {turnScore.accuracy}%
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500">Chưa ghi nhận</span>
                            )}
                          </div>

                          <p className="text-xs text-slate-400 italic">
                            Đối tác: "{turn.partnerPrompt}"
                          </p>

                          <p className="text-xs font-bold text-white">
                            Mục tiêu: "{turn.targetSentence}"
                          </p>

                          {turnScore?.transcript && (
                            <p className="text-xs text-purple-300 font-mono pt-1 border-t border-slate-850">
                              Bạn đã nói: "{turnScore.transcript}"
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 border-t border-slate-800">
                    <button
                      onClick={() => handleSelectSpeakingPrompt(selectedSpeakingPrompt)}
                      className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-black rounded-2xl text-xs sm:text-sm shadow-xl shadow-purple-500/25 transition-all flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Luyện Lại Bài Này</span>
                    </button>

                    <button
                      onClick={() => setSelectedSpeakingPrompt(null)}
                      className="w-full sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-2xl text-xs sm:text-sm transition-all"
                    >
                      ⬅ Chọn Chủ Đề Khác
                    </button>
                  </div>

                </div>
              )}

            </div>
          )}
        </div>
      )}

      {/* --- PANEL D: WRITING STUDIO (CATALOG GRID & DETAIL VIEW) --- */}
      {activeSkill === 'writing' && (
        <div className="space-y-6">
          
          {/* D1. WRITING PROMPTS CATALOG GRID */}
          {!selectedWritingPrompt ? (
            <div className="space-y-6 animate-fadeIn">
              {/* Filter Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-400" />
                  <h2 className="text-base sm:text-lg font-black text-white">
                    Kho Đề Bài Luyện Viết & Chấm AI ({filteredWritingPrompts.length} đề bài)
                  </h2>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  {['ALL', 'Professional Email', 'Technical Report', 'Opinion Essay'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setWritingCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                        writingCategoryFilter === cat
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-black'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat === 'ALL' ? 'Tất cả' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Catalog Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredWritingPrompts.map((prompt) => {
                  const isCompleted = completedWritingIds.includes(prompt.id);
                  return (
                    <div
                      key={prompt.id}
                      onClick={() => {
                        setSelectedWritingPrompt(prompt);
                        setWritingContent('');
                        setWritingAnalysis(null);
                        setShowModelAnswer(false);
                      }}
                      className="group cursor-pointer bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 rounded-3xl p-5 sm:p-6 transition-all duration-300 flex flex-col justify-between shadow-xl relative overflow-hidden"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-md text-[11px] font-bold">
                              {prompt.type}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-800 rounded-md text-[10px] text-amber-300 font-mono font-bold">
                              {prompt.level}
                            </span>
                          </div>

                          {isCompleted ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Đã chấm</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-500">
                              🎯 ≥ {prompt.minWords} từ
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-extrabold text-white group-hover:text-amber-300 transition-colors line-clamp-2">
                          {prompt.title}
                        </h3>

                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {prompt.prompt}
                        </p>

                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-bold text-slate-500">Gợi ý từ vựng:</span>
                          <span className="px-2 py-0.5 bg-slate-950 rounded-md text-[10px] text-cyan-400 font-semibold border border-slate-800">
                            +{prompt.recommendedVocab.length} từ C1/C2
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-850 flex items-center justify-between text-xs font-bold text-amber-400">
                        <span>Viết bài & Chấm AI</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* D2. WRITING PRACTICE DETAIL VIEW */
            <div className="space-y-6 animate-fadeIn">
              
              {/* Back to Catalog Button */}
              <button
                onClick={() => setSelectedWritingPrompt(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-2xl text-xs font-bold flex items-center gap-2 transition-all shadow-md group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform text-amber-400" />
                <span>⬅ Quay lại danh sách đề bài viết</span>
              </button>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                <div className="border-b border-slate-800 pb-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-md text-xs font-bold">
                      {selectedWritingPrompt.type}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-800 rounded-md text-[10px] text-amber-300 font-mono font-bold">
                      {selectedWritingPrompt.level}
                    </span>
                    <span className="text-xs text-slate-500">• Mục tiêu tối thiểu: {selectedWritingPrompt.minWords} từ</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">{selectedWritingPrompt.title}</h2>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    📝 <strong className="text-amber-400">Đề bài:</strong> {selectedWritingPrompt.prompt}
                  </p>
                </div>

                {/* Recommended Vocabulary & Guidelines */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                    <span className="font-bold text-amber-400 uppercase tracking-wider block">
                      📌 Hướng dẫn lập dàn ý (Guidelines):
                    </span>
                    <ul className="space-y-1 text-slate-400 list-disc list-inside">
                      {selectedWritingPrompt.guidelines.map((g, idx) => (
                        <li key={idx}>{g}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                    <span className="font-bold text-cyan-400 uppercase tracking-wider block">
                      ✨ Từ vựng nâng cao nên dùng:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedWritingPrompt.recommendedVocab.map((rv, idx) => (
                        <span 
                          key={idx} 
                          title={rv.meaning}
                          className="px-2.5 py-1 bg-slate-900 border border-slate-700 text-cyan-300 rounded-lg text-xs font-semibold cursor-help"
                        >
                          {rv.word}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Live Text Area Editor */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-slate-400 px-1">
                    <span>Soạn thảo văn bản:</span>
                    <span className={`font-mono font-bold ${
                      writingContent.trim().split(/\s+/).filter(Boolean).length >= selectedWritingPrompt.minWords
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}>
                      Đã viết: {writingContent.trim().split(/\s+/).filter(Boolean).length} / {selectedWritingPrompt.minWords} từ
                    </span>
                  </div>

                  <textarea
                    value={writingContent}
                    onChange={(e) => setWritingContent(e.target.value)}
                    placeholder="Bắt đầu viết bài của bạn tại đây..."
                    rows={7}
                    className="w-full p-4 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl text-slate-100 text-sm focus:outline-none leading-relaxed transition-all resize-y"
                  />
                </div>

                {/* Submit & Analyze Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={handleAnalyzeWriting}
                    className="px-6 py-3.5 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-xl shadow-amber-500/20 transition-all flex items-center gap-2 transform hover:scale-105"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Phân Tích & Chấm Bài Viết (+30 XP)</span>
                  </button>

                  <button
                    onClick={() => setShowModelAnswer(!showModelAnswer)}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-bold rounded-2xl border border-slate-700 text-xs flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>{showModelAnswer ? 'Ẩn bản mẫu' : 'Xem Bản Mẫu Cao Cấp (Model Answer)'}</span>
                  </button>
                </div>

                {/* Model Answer Showcase */}
                {showModelAnswer && (
                  <div className="p-5 bg-gradient-to-br from-slate-950 to-slate-900 border border-amber-500/30 rounded-2xl space-y-2 animate-fadeIn">
                    <span className="text-xs font-black text-amber-400 uppercase tracking-wider block">
                      🌟 Bản Sửa Mẫu Chuyên Nghiệp (Model Answer):
                    </span>
                    <p className="text-xs sm:text-sm text-slate-200 whitespace-pre-line leading-relaxed font-sans">
                      {selectedWritingPrompt.modelAnswer}
                    </p>
                  </div>
                )}

                {/* AI Writing Assessment Feedback Report */}
                {writingAnalysis && (
                  <div className="p-6 bg-slate-950 border-2 border-amber-500/40 rounded-3xl space-y-4 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                        <Award className="w-5 h-5 text-amber-400" />
                        <span>Kết Quả Đánh Giá Bài Viết</span>
                      </h4>
                      <div className="px-4 py-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black rounded-xl text-sm">
                        Điểm số: {writingAnalysis.score} / 100
                      </div>
                    </div>

                    <div className="space-y-3 text-xs sm:text-sm">
                      {writingAnalysis.strengths.length > 0 && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1">
                          <strong className="text-emerald-400 block">✅ Điểm mạnh nổi bật:</strong>
                          <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                            {writingAnalysis.strengths.map((s, idx) => (
                              <li key={idx}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {writingAnalysis.upgrades.length > 0 && (
                        <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl space-y-2">
                          <strong className="text-cyan-400 block">🚀 Gợi ý nâng cấp từ vựng C1/C2:</strong>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {writingAnalysis.upgrades.map((u, idx) => (
                              <div key={idx} className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                                <span className="text-slate-400 line-through mr-1.5">{u.original}</span>
                                <span className="text-cyan-300 font-bold">➔ {u.better}</span>
                                <p className="text-[11px] text-slate-500 mt-0.5">{u.explanation}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
