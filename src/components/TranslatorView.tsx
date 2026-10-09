import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Languages, 
  ArrowLeftRight, 
  Volume2, 
  Copy, 
  Check, 
  PlusCircle, 
  Sparkles, 
  X, 
  Lightbulb, 
  History,
  BookmarkPlus,
  Brain
} from 'lucide-react';
import { triggerCelebration } from '../utils/confettiPolicy';
import { useAppStore } from '../store/useAppStore';
import { speakWord } from '../services/speechService';
import { 
  translateWithContext, 
  TranslationTone, 
  TranslationResult,
  TranslationHistoryItem 
} from '../services/aiTranslationService';
import { AIStatusBadge } from './AIStatusBadge';
import { GeminiKeyModal } from './GeminiKeyModal';
import { InteractiveSourceText } from './InteractiveSourceText';
import { VocabularyMiningPanel } from './VocabularyMiningPanel';
import { TextQuizModal } from './TextQuizModal';
import { analyzeSourceText, getEmptyAnalysisResult } from '../services/textAnalysisService';
import { computeTextHash } from '../services/wordUsageTelemetry';

export const TranslatorView: React.FC = () => {
  const { 
    saveToSRS, 
    audioVoice, 
    audioSpeed, 
    geminiApiKey,
    userCollocations,
    saveCollocationToSRS,
    recordTranslatorEncounters
  } = useAppStore();

  const [sourceLang, setSourceLang] = useState<'en' | 'vi'>('en');
  const [targetLang, setTargetLang] = useState<'en' | 'vi'>('vi');
  const [sourceText, setSourceText] = useState('We need to optimize our backend microservices to minimize latency and improve scalability.');
  const [selectedTone, setSelectedTone] = useState<TranslationTone>('tech');
  
  // Translation Results State
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [activeOutputTab, setActiveOutputTab] = useState<'standard' | 'formal' | 'casual'>('standard');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);

  // Interactive Source Text & CEFR State
  const [sourceViewMode, setSourceViewMode] = useState<'edit' | 'interactive'>('interactive');
  const [showCefrHighlight, setShowCefrHighlight] = useState(true);

  // Pure deterministic text analysis on English source text
  const textAnalysis = useMemo(() => {
    if (sourceLang === 'en' && sourceText.trim()) {
      try {
        return analyzeSourceText(sourceText);
      } catch (err) {
        console.warn('Lỗi phân tích văn bản nguồn:', err);
        return getEmptyAnalysisResult(sourceText);
      }
    }
    return getEmptyAnalysisResult(sourceText);
  }, [sourceText, sourceLang]);

  // History state
  const [historyList, setHistoryList] = useState<TranslationHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('english_mastery_translate_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Kích hoạt dịch thuật theo ngữ cảnh
  const handleExecuteTranslate = async (
    textToTranslate = sourceText, 
    tone = selectedTone,
    sLang = sourceLang,
    tLang = targetLang
  ) => {
    const clean = textToTranslate.trim();
    if (!clean) {
      setTranslationResult(null);
      return;
    }

    setLoading(true);
    try {
      const result = await translateWithContext(
        clean,
        sLang,
        tLang,
        tone,
        geminiApiKey
      );
      setTranslationResult(result);

      // Telemetry: Ghi nhận encounters có giới hạn và idempotent cho từ điển học tập
      if (sLang === 'en' && clean) {
        try {
          recordTranslatorEncounters?.(clean, `trans_${computeTextHash(clean)}`);
        } catch {
          // Telemetry must never crash translation
        }
      }

      // Thêm vào lịch sử nếu câu hợp lệ
      if (result.standard) {
        const item: TranslationHistoryItem = {
          id: `trans_${Date.now()}`,
          sourceText: clean,
          translatedText: result.standard,
          sourceLang: sLang,
          targetLang: tLang,
          tone,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setHistoryList((prev) => {
          const filtered = prev.filter((h) => h.sourceText !== item.sourceText);
          const updated = [item, ...filtered].slice(0, 6);
          try {
            localStorage.setItem('english_mastery_translate_history', JSON.stringify(updated));
          } catch (e) {
            console.warn('Lỗi lưu lịch sử dịch:', e);
          }
          return updated;
        });
      }
    } catch (err) {
      console.error('Lỗi dịch thuật:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper kiểm tra cụm từ đã lưu chưa
  const isCollocationSaved = useCallback((phraseText: string) => {
    const clean = phraseText.trim().toLowerCase();
    return (userCollocations || []).some((c) => c.phrase.trim().toLowerCase() === clean);
  }, [userCollocations]);

  // Danh sách cụm từ chưa lưu trong bản dịch hiện tại
  const unsavedCollocations = useMemo(() => {
    if (!translationResult?.collocations) return [];
    return translationResult.collocations.filter((item) => {
      const phrase = (item.phrase || item.term || '').trim();
      return phrase && !isCollocationSaved(phrase);
    });
  }, [translationResult?.collocations, isCollocationSaved]);

  // Lưu 1 cụm từ vào Flashcard SRS
  const handleSaveCollocation = (item: { phrase?: string; term?: string; meaning: string; note?: string }) => {
    const phrase = (item.phrase || item.term || '').trim();
    if (!phrase) return;

    const res = saveCollocationToSRS({
      phrase,
      meaning: item.meaning,
      usageContext: item.note || `Văn phong: ${selectedTone}`,
      exampleEn: sourceLang === 'en' ? sourceText : (translationResult?.standard || sourceText),
      exampleVi: sourceLang === 'vi' ? sourceText : (translationResult?.standard || ''),
      tags: [selectedTone, 'collocation'],
    });

    if (res.success) {
      triggerCelebration('micro');
      setSaveStatus(`+15 XP • Đã thêm "${phrase}" vào ôn tập Flashcard (SM-2)!`);
      setTimeout(() => setSaveStatus(null), 3500);
    }
  };

  // Lưu tất cả cụm từ chưa lưu vào Flashcard
  const handleSaveAllCollocations = () => {
    if (unsavedCollocations.length === 0) return;
    let savedCount = 0;
    unsavedCollocations.forEach((item) => {
      const phrase = (item.phrase || item.term || '').trim();
      if (!phrase) return;
      const res = saveCollocationToSRS({
        phrase,
        meaning: item.meaning,
        usageContext: item.note || `Văn phong: ${selectedTone}`,
        exampleEn: sourceLang === 'en' ? sourceText : (translationResult?.standard || sourceText),
        exampleVi: sourceLang === 'vi' ? sourceText : (translationResult?.standard || ''),
        tags: [selectedTone, 'collocation'],
      });
      if (res.success) savedCount++;
    });

    if (savedCount > 0) {
      triggerCelebration('completion');
      setSaveStatus(`+${savedCount * 15} XP • Đã lưu ${savedCount} cụm từ vào Flashcard (SM-2)!`);
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  // Tự động dịch sau khi dừng gõ (Debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (sourceText.trim()) {
        handleExecuteTranslate(sourceText, selectedTone, sourceLang, targetLang);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [sourceText, sourceLang, targetLang]);

  // Khi người dùng bấm chuyển đổi 1 trong 4 Ngữ Cảnh:
  const handleSelectTone = (tone: TranslationTone) => {
    setSelectedTone(tone);
    if (sourceText.trim()) {
      handleExecuteTranslate(sourceText, tone, sourceLang, targetLang);
    }
  };

  // Đổi chiều dịch
  const handleSwapLanguages = () => {
    const nextSource = targetLang;
    const nextTarget = sourceLang;
    setSourceLang(nextSource);
    setTargetLang(nextTarget);

    const currentTranslated = translationResult?.standard || '';
    if (currentTranslated) {
      setSourceText(currentTranslated);
      handleExecuteTranslate(currentTranslated, selectedTone, nextSource, nextTarget);
    }
  };

  // Xác định văn bản hiển thị theo tab văn phong
  const currentOutputText = useMemo(() => {
    if (!translationResult) return '';
    if (activeOutputTab === 'formal') return translationResult.formal || translationResult.standard;
    if (activeOutputTab === 'casual') return translationResult.casual || translationResult.standard;
    return translationResult.standard;
  }, [translationResult, activeOutputTab]);

  // Sao chép văn bản
  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Phát âm
  const handleSpeak = (text: string, lang: 'en' | 'vi') => {
    if (!text.trim()) return;
    if (lang === 'en') {
      speakWord(text, audioVoice, audioSpeed);
    } else {
      speakWord(text, 'vi-VN' as any, audioSpeed);
    }
  };

  // Lưu bản dịch vào Flashcard SRS
  const handleSaveFlashcard = () => {
    if (!sourceText.trim() || !currentOutputText.trim()) return;

    const englishWord = sourceLang === 'en' ? sourceText.trim() : currentOutputText.trim();
    const vietMeaning = sourceLang === 'en' ? currentOutputText.trim() : sourceText.trim();
    const isLong = englishWord.split(/\s+/).length > 6;

    saveToSRS(englishWord, {
      meaning: vietMeaning,
      contextSentence: isLong ? englishWord : `Mastering: "${englishWord}".`,
    });

    triggerCelebration('micro');

    setSaveStatus(`Đã lưu "${englishWord.slice(0, 30)}..." vào Flashcard SRS (+15 XP)!`);
    setTimeout(() => setSaveStatus(null), 3500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      
      {/* 1. Header & AI Translation Studio Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Trợ Lý Dịch Thuật AI Theo Ngữ Cảnh (Context AI Translator)
              </h2>
              <p className="text-xs text-slate-400">
                Tự động tối ưu văn phong chuyên ngành • Giữ nguyên thuật ngữ Tech/IT • Phân tích cụm từ đắt giá
              </p>
            </div>
          </div>

          {/* AI Status Badge Indicator */}
          <div className="flex items-center gap-2">
            <AIStatusBadge
              onOpenModal={() => setIsKeyModalOpen(true)}
              isFallback={Boolean(!geminiApiKey || translationResult?.isFallback)}
            />
          </div>
        </div>

        {/* 2. Thanh Chọn Ngữ Cảnh / Văn Phong Dịch (Context & Tone Selector) */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span>Ngữ cảnh & Văn phong dịch:</span>
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'business', label: '💼 Công Sở & Email', desc: 'Chuyên nghiệp, lịch sự' },
              { id: 'tech', label: '💻 Công Nghệ / IT', desc: 'Giữ chuẩn thuật ngữ IT' },
              { id: 'academic', label: '🎓 Học Thuật / IELTS', desc: 'Văn phong C1-C2' },
              { id: 'casual', label: '☕ Giao Tiếp Đời Thường', desc: 'Tự nhiên, ngắn gọn' },
            ].map((t) => {
              const isSelected = selectedTone === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectTone(t.id as TranslationTone)}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-teal-500/15 border-teal-400 text-teal-300 shadow-md shadow-teal-500/10 ring-1 ring-teal-400/40'
                      : 'bg-slate-850 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-extrabold block text-white">{t.label}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{t.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Language Direction Switcher */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 bg-slate-850 p-2 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-center px-4 py-2.5 bg-slate-900 rounded-xl text-xs sm:text-sm font-bold text-white border border-slate-750 text-center">
            <span>{sourceLang === 'en' ? '🇺🇸 Tiếng Anh (English)' : '🇻🇳 Tiếng Việt'}</span>
          </div>

          <button
            onClick={handleSwapLanguages}
            title="Đổi chiều ngôn ngữ"
            className="p-3 bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-slate-950 rounded-2xl transition-all border border-teal-500/20 hover:scale-105 shrink-0 shadow-sm"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>

          <div className="flex items-center justify-center px-4 py-2.5 bg-slate-900 rounded-xl text-xs sm:text-sm font-bold text-white border border-slate-750 text-center">
            <span>{targetLang === 'vi' ? '🇻🇳 Tiếng Việt' : '🇺🇸 Tiếng Anh (English)'}</span>
          </div>
        </div>

        {/* 3. Dual Translation Studio Box */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* SOURCE TEXT INPUT BOX */}
          <div className="bg-slate-950 border border-slate-800 focus-within:border-teal-500 rounded-3xl p-5 flex flex-col justify-between min-h-[280px] transition-colors">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-slate-500 pb-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-400">VĂN BẢN GỐC ({sourceLang.toUpperCase()})</span>
                  {sourceLang === 'en' && sourceText.trim() && (
                    <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5">
                      <button
                        type="button"
                        onClick={() => setSourceViewMode('edit')}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          sourceViewMode === 'edit'
                            ? 'bg-teal-500 text-slate-950 shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Soạn thảo
                      </button>
                      <button
                        type="button"
                        onClick={() => setSourceViewMode('interactive')}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          sourceViewMode === 'interactive'
                            ? 'bg-teal-500 text-slate-950 shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Tương tác
                      </button>
                    </div>
                  )}
                </div>

                {sourceText && (
                  <button
                    onClick={() => {
                      setSourceText('');
                      setTranslationResult(null);
                    }}
                    className="hover:text-white p-0.5 cursor-pointer"
                    title="Xóa nội dung"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {sourceLang === 'en' && sourceViewMode === 'interactive' && sourceText.trim() ? (
                <InteractiveSourceText
                  sourceText={sourceText}
                  analysis={textAnalysis}
                  showCefrHighlight={showCefrHighlight}
                  onToggleCefrHighlight={() => setShowCefrHighlight((prev) => !prev)}
                  onSavePhraseToSRS={(phrase, meaning, note) => {
                    handleSaveCollocation({
                      phrase,
                      meaning: meaning || `Cụm từ trong bản dịch: "${phrase}"`,
                      note: note || `Trích xuất từ bản gốc tiếng Anh`,
                    });
                  }}
                />
              ) : (
                <textarea
                  rows={7}
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="Nhập từ, câu văn bản hoặc đoạn văn cần dịch..."
                  className="w-full bg-transparent text-sm sm:text-base text-white placeholder-slate-600 focus:outline-none resize-none leading-relaxed"
                />
              )}
            </div>

            {/* Source Box Footer */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-900 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>{sourceText.length} ký tự</span>
                {sourceLang === 'en' && sourceText.trim() && (
                  <button
                    type="button"
                    onClick={() => setIsQuizModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl font-bold transition-all text-xs cursor-pointer active:scale-95"
                  >
                    <Brain className="w-3.5 h-3.5" />
                    <span>Tạo Quiz từ đoạn này</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => handleSpeak(sourceText, sourceLang)}
                title="Nghe phát âm bản gốc"
                className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-teal-400 rounded-xl transition-colors"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* TARGET TRANSLATION OUTPUT BOX */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between min-h-[280px]">
            <div className="space-y-3">
              
              {/* Output Multi-Tone Tabs */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-900">
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    onClick={() => setActiveOutputTab('standard')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      activeOutputTab === 'standard' 
                        ? 'bg-teal-500 text-slate-950 shadow-sm' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Chuẩn Ngữ Cảnh
                  </button>

                  <button
                    onClick={() => setActiveOutputTab('formal')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      activeOutputTab === 'formal' 
                        ? 'bg-teal-500 text-slate-950 shadow-sm' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🌟 Trang Trọng (C1/C2)
                  </button>

                  <button
                    onClick={() => setActiveOutputTab('casual')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      activeOutputTab === 'casual' 
                        ? 'bg-teal-500 text-slate-950 shadow-sm' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    💬 Giao Tiếp
                  </button>
                </div>

                {loading && (
                  <span className="text-teal-400 text-xs font-bold animate-pulse flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang dịch...</span>
                  </span>
                )}
              </div>

              {/* Translated Text Content */}
              <div className="text-sm sm:text-base text-slate-100 font-medium whitespace-pre-wrap leading-relaxed min-h-[120px]">
                {currentOutputText ? (
                  <span>{currentOutputText}</span>
                ) : (
                  <span className="text-slate-600 italic">Bản dịch sẽ hiển thị ở đây...</span>
                )}
              </div>

              {/* Fallback Notice Pill */}
              {translationResult?.isFallback && currentOutputText && (
                <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-amber-500/10 border border-amber-500/25 text-amber-300 rounded-2xl text-[11px] leading-snug shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Đang sử dụng kịch bản mẫu. Thêm Gemini API Key để phản hồi theo thời gian thực và mở rộng chủ đề tự do.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsKeyModalOpen(true)}
                    className="font-bold underline hover:text-amber-200 shrink-0 ml-1 cursor-pointer"
                  >
                    Cài đặt
                  </button>
                </div>
              )}
            </div>

            {/* Target Box Actions Footer */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-900 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSpeak(currentOutputText, targetLang)}
                  title="Nghe phát âm bản dịch"
                  disabled={!currentOutputText}
                  className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-teal-400 rounded-xl transition-colors disabled:opacity-30"
                >
                  <Volume2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleCopy(currentOutputText)}
                  title="Sao chép kết quả"
                  disabled={!currentOutputText}
                  className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-teal-400 rounded-xl transition-colors flex items-center gap-1 disabled:opacity-30"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <button
                onClick={handleSaveFlashcard}
                disabled={!sourceText.trim() || !currentOutputText}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/30 font-bold rounded-xl transition-all disabled:opacity-30 text-xs"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Lưu Flashcard SRS (+15 XP)</span>
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* 4. KHAI THÁC TỪ VỰNG & CỤM TỪ (Vocabulary Mining Panel) */}
      {sourceLang === 'en' && sourceText.trim() && (
        <VocabularyMiningPanel
          sourceText={sourceText}
          analysis={textAnalysis}
          onCreateQuiz={() => setIsQuizModalOpen(true)}
        />
      )}

      {/* 5. HỘP PHÂN TÍCH CỤM TỪ & NGỮ PHÁP (Insight & Collocation Breakdown) */}
      {translationResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-sm font-black text-amber-400">
            <Lightbulb className="w-5 h-5" />
            <span>Phân Tích Cụm Từ & Ghi Chú Ngữ Cảnh (AI Insight)</span>
          </div>

          {/* Context Note */}
          {translationResult.contextNote && (
            <div className="p-3.5 bg-slate-850 border border-slate-800 rounded-2xl text-xs text-slate-300">
              <span className="font-bold text-teal-400 block mb-0.5">💡 Giải thích lý do dịch:</span>
              <p className="leading-relaxed italic">{translationResult.contextNote}</p>
            </div>
          )}

          {/* Key Collocations */}
          {translationResult.collocations && translationResult.collocations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Cụm từ đắt giá trong câu (Key Collocations):
                </span>
                {unsavedCollocations.length >= 2 && (
                  <button
                    onClick={handleSaveAllCollocations}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Lưu tất cả cụm từ vào Flashcard ({unsavedCollocations.length})</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {translationResult.collocations.map((item, idx) => {
                  const phrase = (item.phrase || item.term || '').trim();
                  const saved = isCollocationSaved(phrase);

                  return (
                    <div key={idx} className="p-3.5 bg-slate-850/80 border border-slate-800 rounded-2xl space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <strong className="text-xs font-black text-emerald-400 block">{phrase}</strong>
                          <span className="text-[11px] text-slate-300">{item.meaning}</span>
                        </div>

                        {saved ? (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>✓ Đã trong Flashcard (SM-2)</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSaveCollocation(item)}
                            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 transition-all active:scale-95 shadow-sm cursor-pointer"
                            title="Lưu vào thẻ ghi nhớ SM-2 (+15 XP)"
                          >
                            <BookmarkPlus className="w-3.5 h-3.5 text-teal-400" />
                            <span>Lưu Flashcard</span>
                          </button>
                        )}
                      </div>

                      {item.note && (
                        <p className="text-[11px] text-slate-500 italic">→ {item.note}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save Notification Toast */}
      {saveStatus && (
        <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-2xl font-semibold text-xs sm:text-sm flex items-center justify-between shadow-xl animate-bounce">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{saveStatus}</span>
          </div>
        </div>
      )}

      {/* 5. LỊCH SỬ DỊCH GẦN NHẤT (Recent Translations History) */}
      {historyList.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <History className="w-4 h-4 text-teal-400" />
              <span>Lịch Sử Dịch Gần Nhất</span>
            </h3>
            <span className="text-[11px] text-slate-500">{historyList.length} bản dịch gần đây</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {historyList.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setSourceLang(item.sourceLang);
                  setTargetLang(item.targetLang);
                  setSelectedTone(item.tone);
                  setSourceText(item.sourceText);
                  handleExecuteTranslate(item.sourceText, item.tone, item.sourceLang, item.targetLang);
                }}
                className="p-3.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-2xl text-left transition-all space-y-1.5 group"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="px-2 py-0.5 bg-slate-800 text-teal-300 rounded-md font-bold uppercase">
                    {item.tone}
                  </span>
                  <span className="text-slate-500">{item.timestamp}</span>
                </div>
                <p className="text-xs text-slate-200 font-medium line-clamp-1 group-hover:text-teal-300 transition-colors">
                  "{item.sourceText}"
                </p>
                <p className="text-xs text-slate-400 line-clamp-1">
                  → {item.translatedText}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Gemini API Key Configuration Modal */}
      <GeminiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
      />

      {/* Interactive Text Quiz Modal (Phase 3) */}
      <TextQuizModal
        isOpen={isQuizModalOpen}
        onClose={() => setIsQuizModalOpen(false)}
        sourceText={sourceText}
        analysis={textAnalysis}
      />

    </div>
  );
};
