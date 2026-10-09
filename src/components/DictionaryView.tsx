import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, 
  Sparkles, 
  BookOpen, 
  Check, 
  X, 
  Database,
  Zap
} from 'lucide-react';
import { triggerCelebration } from '../utils/confettiPolicy';
import { useAppStore } from '../store/useAppStore';
import { speakWord } from '../services/speechService';
import { translateText } from '../services/translationService';
import { VocabWord, ActiveTab } from '../types';
import { VoicePronunciationModal } from './VoicePronunciationModal';
import { 
  searchFullDictionary, 
  getFullDictionaryCount,
  getDictionaryWord 
} from '../services/dictionaryIndex';
import { getLearningDictionaryProfile } from '../services/learningDictionaryService';
import { CefrCalibrationBadge } from './dictionary/CefrCalibrationBadge';
import { YourLearningSection } from './dictionary/YourLearningSection';
import { NeedsPracticeSection } from './dictionary/NeedsPracticeSection';
import { WordNetworkSection } from './dictionary/WordNetworkSection';
import { DictionaryQuickActions } from './dictionary/DictionaryQuickActions';
import { WordPersonalizedInsightBanner } from './dictionary/WordPersonalizedInsightBanner';

interface DatamuseResult {
  word: string;
  score?: number;
  tags?: string[];
  defs?: string[];
}

export interface DictionaryEntryData {
  word: string;
  vietnameseMeaning: string;
  partOfSpeech: string;
  englishDefinition: string;
  synonyms: string[];
  associations: string[];
  isLocal: boolean;
  localData?: VocabWord;
}

export interface DictionaryViewProps {
  onOpenAddWord?: (prefillWord?: string) => void;
  onNavigate?: (tab: ActiveTab) => void;
}

export const DictionaryView: React.FC<DictionaryViewProps> = ({ 
  onOpenAddWord: _onOpenAddWord, 
  onNavigate 
}) => {
  const { 
    saveToSRS, 
    srsProgressMap, 
    vocabularyList, 
    userCollocations,
    mistakeBank,
    wordLearningStats,
    fourSkillsScores,
    srsAlgorithm,
    audioVoice, 
    audioSpeed,
    startAdaptivePractice
  } = useAppStore();

  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [entry, setEntry] = useState<DictionaryEntryData | null>(null);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([
    'resilience', 'meticulous', 'innovation', 'proactive', 'empathy', 'sustainable', 'microservices'
  ]);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [notFoundWord, setNotFoundWord] = useState<string | null>(null);

  // Live Offline Prefix Search Results (< 5ms) — lightweight, no profile computation
  const liveOfflineSuggestions = useMemo(() => {
    if (!query.trim() || query.trim().length < 1) return [];
    return searchFullDictionary(query.trim(), 'ALL', 8);
  }, [query]);

  const totalDictionaryCount = useMemo(() => {
    return getFullDictionaryCount();
  }, []);

  // Multi-tier Lookup Logic: Offline Index -> Local User Bank -> Translation Engine & Datamuse
  useEffect(() => {
    const cleanWord = searchTerm.trim().toLowerCase();
    if (!cleanWord) return;

    let isMounted = true;
    setLoading(true);
    setNotFoundWord(null);

    // 1. Kiểm tra trong kho người học hoặc siêu từ điển offline
    const userMatch = vocabularyList.find(
      (w) => w.word.trim().toLowerCase() === cleanWord
    );

    const offlineMatch = getDictionaryWord(cleanWord) || searchFullDictionary(cleanWord, 'ALL', 1).find(
      (r) => r.item.word.toLowerCase() === cleanWord
    )?.item;

    const matchedWord = userMatch || offlineMatch;

    if (matchedWord) {
      setEntry({
        word: matchedWord.word,
        vietnameseMeaning: matchedWord.meaning,
        partOfSpeech: matchedWord.partOfSpeech || 'noun',
        englishDefinition: matchedWord.definitionEn || matchedWord.meaning,
        synonyms: matchedWord.synonyms || [],
        associations: matchedWord.collocations || [],
        isLocal: true,
        localData: matchedWord,
      });
      setNotFoundWord(null);
      setLoading(false);
      
      setRecentSearches((prev) => {
        const filtered = prev.filter((w) => w.toLowerCase() !== cleanWord);
        return [cleanWord, ...filtered].slice(0, 8);
      });
      return;
    }

    // 2. Tra cứu trực tuyến nếu từ chưa có trong kho offline
    Promise.all([
      translateText(cleanWord, 'en', 'vi'),
      fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(cleanWord)}&md=dps&max=1`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(cleanWord)}&max=5`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch(`https://api.datamuse.com/words?rel_trg=${encodeURIComponent(cleanWord)}&max=5`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => [])
    ])
      .then(([vietTranslation, datamuseWords, synWords, trgWords]) => {
        if (!isMounted) return;

        let partOfSpeech = 'noun';
        let englishDefinition = '';

        if (Array.isArray(datamuseWords) && datamuseWords.length > 0) {
          const match = datamuseWords[0] as DatamuseResult;
          
          if (match.tags && match.tags.length > 0) {
            const posTag = match.tags.find((t) => ['n', 'v', 'adj', 'adv'].includes(t));
            if (posTag === 'n') partOfSpeech = 'noun';
            else if (posTag === 'v') partOfSpeech = 'verb';
            else if (posTag === 'adj') partOfSpeech = 'adjective';
            else if (posTag === 'adv') partOfSpeech = 'adverb';
          }

          if (match.defs && match.defs.length > 0) {
            englishDefinition = match.defs[0].replace(/^[a-z]+\t/, '');
          }
        }

        const synonyms = Array.isArray(synWords) ? synWords.map((s: { word: string }) => s.word) : [];
        const associations = Array.isArray(trgWords) ? trgWords.map((t: { word: string }) => t.word) : [];

        setEntry({
          word: searchTerm.trim(),
          vietnameseMeaning: vietTranslation || `Đang cập nhật nghĩa cho "${searchTerm}"`,
          partOfSpeech,
          englishDefinition: englishDefinition || `Definition and contextual usage for "${searchTerm}".`,
          synonyms,
          associations,
          isLocal: false,
        });
        setNotFoundWord(null);

        setRecentSearches((prev) => {
          const filtered = prev.filter((w) => w.toLowerCase() !== cleanWord);
          return [cleanWord, ...filtered].slice(0, 8);
        });
      })
      .catch((err) => {
        console.error('Lỗi tra từ trực tuyến:', err);
        if (isMounted) {
          setEntry(null);
          setNotFoundWord(searchTerm.trim());
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [searchTerm, vocabularyList]);

  // Derived Learning Dictionary Profile — HYDRATED ONLY WHEN A WORD IS SELECTED
  const learningProfile = useMemo(() => {
    if (!entry?.word) return null;
    return getLearningDictionaryProfile(entry.localData || entry.word, {
      storeState: {
        srsProgressMap,
        mistakeBank,
        userCollocations,
        wordLearningStats,
        fourSkillsScores,
        srsAlgorithm,
        vocabularyList,
      },
    });
  }, [
    entry,
    srsProgressMap,
    mistakeBank,
    userCollocations,
    wordLearningStats,
    fourSkillsScores,
    srsAlgorithm,
    vocabularyList,
  ]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const inputVal = e.currentTarget.querySelector('input')?.value?.trim() || query.trim();
    if (inputVal) {
      setQuery(inputVal);
      setSearchTerm(inputVal);
    }
  };

  const handleSelectWord = useCallback((word: string) => {
    const clean = word.trim();
    if (!clean) return;
    setQuery(clean);
    setSearchTerm(clean);
  }, []);

  const isWordInMyDeck = useMemo(() => {
    if (learningProfile) return learningProfile.isInUserDeck;
    if (!entry) return false;
    const clean = entry.word.toLowerCase().trim();
    return Boolean(
      (entry.localData?.id && srsProgressMap?.[entry.localData.id]) ||
      srsProgressMap?.[clean] ||
      vocabularyList.some((w) => w.word.toLowerCase().trim() === clean && (w.srsLevel > 0 || (srsProgressMap && srsProgressMap[w.id])))
    );
  }, [learningProfile, entry, srsProgressMap, vocabularyList]);

  // Save Word to SRS Deck (with canonical identity & zero duplicate invariant)
  const handleSaveToDeck = useCallback(() => {
    if (!entry) return;

    const canonicalWord = learningProfile?.word || entry.localData?.word || entry.word;
    const canonicalPayload = learningProfile?.staticEntry || entry.localData || canonicalWord;

    if (isWordInMyDeck) {
      setSavingStatus(`Từ "${canonicalWord}" đã có sẵn trong Flashcard SRS của bạn!`);
      setTimeout(() => setSavingStatus(null), 3000);
      return;
    }

    saveToSRS(canonicalPayload, {
      meaning: entry.vietnameseMeaning,
      contextSentence: entry.localData?.example || learningProfile?.example || `Learning and mastering the word "${canonicalWord}".`,
    });

    triggerCelebration('completion', {
      particleCount: 60,
      spread: 60,
      origin: { y: 0.6 },
    });

    setSavingStatus(`Đã lưu "${canonicalWord}" vào Flashcard SRS!`);
    setTimeout(() => setSavingStatus(null), 3500);
  }, [entry, learningProfile, isWordInMyDeck, saveToSRS]);

  // Due / Relearning actionable check for Review Now
  const isReviewableNow = useMemo(() => {
    if (!isWordInMyDeck || !learningProfile) return false;
    return Boolean(
      learningProfile.memory.isDue ||
      learningProfile.memory.cardState === 'relearning' ||
      learningProfile.learningStatus === 'relearning'
    );
  }, [isWordInMyDeck, learningProfile]);

  // Quick Action: Review Now
  const handleReviewNow = useCallback(() => {
    if (onNavigate) {
      onNavigate('flashcards');
    }
  }, [onNavigate]);

  // Quick Action: Practice Mistake
  const handlePracticeMistake = useCallback(() => {
    if (!entry) return;
    const targetId = learningProfile?.canonicalId || entry.localData?.id || entry.word;
    startAdaptivePractice({
      module: 'classic_quiz',
      itemIds: [targetId],
    });
    if (onNavigate) {
      onNavigate('quiz');
    }
  }, [entry, learningProfile, startAdaptivePractice, onNavigate]);

  // Quick Action: Practice Collocation
  const handlePracticeCollocation = useCallback((phrase?: string) => {
    const targetPhrase = phrase || learningProfile?.weakCollocations[0]?.phrase;
    if (!targetPhrase) return;
    startAdaptivePractice({
      module: 'collocation',
      itemIds: [targetPhrase],
    });
    if (onNavigate) {
      onNavigate('quiz');
    }
  }, [learningProfile, startAdaptivePractice, onNavigate]);

  // Quick Action: Copy Word & Definition (Sanitized against undefined/null/NaN)
  const handleCopy = useCallback(() => {
    if (!entry) return;
    const parts: string[] = [];
    const posPart = entry.partOfSpeech ? ` (${entry.partOfSpeech})` : '';
    const meaningPart = entry.vietnameseMeaning ? ` - ${entry.vietnameseMeaning}` : '';
    parts.push(`${entry.word}${posPart}${meaningPart}`);

    if (entry.englishDefinition && entry.englishDefinition.trim()) {
      parts.push(`Định nghĩa: ${entry.englishDefinition.trim()}`);
    }

    const exampleText = entry.localData?.example || learningProfile?.example || learningProfile?.exampleEn;
    if (exampleText && exampleText.trim()) {
      parts.push(`Ví dụ: ${exampleText.trim()}`);
    }

    const textToCopy = parts.join('\n');
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch(() => {});
  }, [entry, learningProfile]);

  // Audio Pronounce with safety
  const handleSpeak = useCallback(() => {
    if (!entry) return;
    try {
      speakWord(learningProfile?.word || entry.word, audioVoice, audioSpeed);
    } catch (err) {
      console.warn('Speech error:', err);
    }
  }, [entry, learningProfile, audioVoice, audioSpeed]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      
      {/* Search Bar & Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white">Từ Điển Học Tập (Learning Dictionary)</h2>
              <p className="text-xs text-slate-400">
                Kho từ điển <strong className="text-emerald-400">{totalDictionaryCount.toLocaleString()} từ</strong> • Tra cứu đa tầng &lt; 5ms • Tích hợp FSRS & Điểm yếu cá nhân
              </p>
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-stretch gap-3">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nhập từ tiếng Anh bất kỳ (vd: resilience, maintain, collaborate, sustain...)"
                className="w-full bg-slate-950 border-2 border-slate-800 focus:border-emerald-500 rounded-2xl pl-12 pr-12 py-4 text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none transition-colors"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                  title="Xóa nội dung tìm kiếm"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              className="px-7 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 shrink-0 transform hover:scale-[1.02]"
            >
              <Search className="w-4 h-4" />
              <span>Tra Cứu</span>
            </button>
          </form>

          {/* Live Offline Suggestions Dropdown (< 5ms) */}
          {liveOfflineSuggestions.length > 0 && query.trim() !== searchTerm && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900/95 backdrop-blur-xl border border-slate-750 rounded-2xl shadow-2xl overflow-hidden z-30 divide-y divide-slate-800">
              <div className="px-4 py-2 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                <span className="flex items-center gap-1 text-emerald-400">
                  <Database className="w-3.5 h-3.5" />
                  <span>Gợi ý từ Siêu Từ Điển Offline ({liveOfflineSuggestions.length} kết quả)</span>
                </span>
                <span>Tốc độ: &lt; 2ms</span>
              </div>

              {liveOfflineSuggestions.map((res, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectWord(res.item.word)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-800/80 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white text-sm group-hover:text-emerald-400 transition-colors">
                      {res.item.word}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {res.item.ipa}
                    </span>
                    <span className="text-xs text-slate-300 truncate max-w-xs sm:max-w-md">
                      — {res.item.meaning}
                    </span>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-400 rounded-md">
                    {res.item.tag || 'Vocab'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick History Tags */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 shrink-0">
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tra gần đây:</span>
          </span>
          {recentSearches.map((w) => (
            <button
              key={w}
              onClick={() => handleSelectWord(w)}
              className="px-3 py-1 bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl text-xs font-medium border border-slate-750 transition-all shrink-0"
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* Saving Notification Status */}
      {savingStatus && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 animate-fadeIn motion-reduce:animate-none"
        >
          <Check className="w-5 h-5 text-emerald-400" />
          <span>{savingStatus}</span>
        </div>
      )}

      {/* Empty / Not Found State */}
      {!entry && !loading && (
        notFoundWord ? (
          <div data-testid="dictionary-not-found" className="p-8 text-center text-slate-400 bg-slate-900/50 border border-slate-800 rounded-3xl space-y-2">
            <p className="text-rose-400 font-semibold">Không tìm thấy từ vựng "{notFoundWord}"</p>
            <p className="text-xs text-slate-500">Vui lòng kiểm tra lại chính tả hoặc kết nối mạng để tra cứu trực tuyến.</p>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 italic bg-slate-900/50 border border-slate-800 rounded-3xl">
            Nhập từ vựng hoặc chọn từ trong danh sách gợi ý để tra cứu thông tin chi tiết
          </div>
        )
      )}

      {/* Loading State */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3 shadow-xl">
          <Sparkles className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Đang tra cứu và tổng hợp ngữ nghĩa cho <strong>"{searchTerm}"</strong>...</p>
        </div>
      ) : entry ? (
        <div className="space-y-6">
          
          {/* 1. MAIN DICTIONARY ENTRY CARD */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            
            {/* Header: Word, Part of Speech, IPA, Quick Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">{entry.word}</h1>
                  <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold uppercase">
                    {entry.partOfSpeech}
                  </span>
                  {entry.localData?.tag && (
                    <span className="px-2.5 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg text-xs font-bold uppercase">
                      {entry.localData.tag}
                    </span>
                  )}
                </div>
                <p className="text-emerald-400 font-mono text-base">{entry.localData?.ipa || `/${entry.word.toLowerCase()}/`}</p>
              </div>

              {/* Quick Actions Bar */}
              <DictionaryQuickActions
                word={learningProfile?.word || entry.word}
                isInDeck={isWordInMyDeck}
                isDue={isReviewableNow}
                hasUnresolvedMistakes={Boolean(learningProfile?.mistakeSummary.unresolved)}
                hasWeakCollocations={Boolean(learningProfile && learningProfile.weakCollocations.length > 0)}
                onSaveToDeck={handleSaveToDeck}
                onReviewNow={handleReviewNow}
                onPracticeMistake={handlePracticeMistake}
                onPracticeCollocation={() => handlePracticeCollocation()}
                onSpeak={handleSpeak}
                onCheckVoice={() => setIsVoiceModalOpen(true)}
                onCopy={handleCopy}
                isCopied={isCopied}
              />
            </div>

            {/* CEFR Calibration (Word Level vs Your Level) */}
            {learningProfile && (
              <CefrCalibrationBadge
                wordLevel={learningProfile.cefrCalibration.wordLevel || entry.localData?.level}
                learnerLevel={learningProfile.cefrCalibration.learnerLevel}
                comparisonLabel={learningProfile.cefrCalibration.comparisonLabel}
                difficultyComparison={learningProfile.cefrCalibration.difficultyComparison}
              />
            )}

            {/* Core Vietnamese Meaning */}
            <div className="p-5 bg-slate-850/90 border border-slate-750 rounded-2xl space-y-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nghĩa Tiếng Việt Cốt Lõi:</span>
              <p className="text-xl sm:text-2xl font-black text-white leading-snug">{entry.vietnameseMeaning}</p>
            </div>

            {/* English Definition & Example */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 bg-slate-850/50 border border-slate-800 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">English Definition:</span>
                <p className="text-sm text-slate-200 leading-relaxed italic">
                  "{entry.englishDefinition}"
                </p>
              </div>

              <div className="p-5 bg-slate-850/50 border border-slate-800 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Câu Ví Dụ Ngữ Cảnh:</span>
                <p className="text-sm text-emerald-300 font-medium leading-relaxed">
                  "{entry.localData?.example || `She demonstrated great resilience during the crisis.`}"
                </p>
                {entry.localData?.exampleMeaning && (
                  <p className="text-xs text-slate-400">
                    → {entry.localData.exampleMeaning}
                  </p>
                )}
              </div>
            </div>

          </div>

          {/* 1.5 PERSONALIZED LEARNING INSIGHT (TẦNG DIỄN GIẢI PHÍA TRÊN ANALYTICS) */}
          {learningProfile && (
            <WordPersonalizedInsightBanner
              profile={learningProfile}
              onPracticeMistake={handlePracticeMistake}
              onPracticeCollocation={handlePracticeCollocation}
              onReviewNow={handleReviewNow}
            />
          )}

          {/* 2. YOUR LEARNING SECTION (Memory, FSRS, Counters) */}
          {learningProfile && (
            <YourLearningSection
              profile={learningProfile}
              onSaveToDeck={!isWordInMyDeck ? handleSaveToDeck : undefined}
            />
          )}

          {/* 3. NEEDS PRACTICE SECTION (Mistakes, Confusions, Weak Collocs, Leech) */}
          {learningProfile && (
            <NeedsPracticeSection
              profile={learningProfile}
              onSelectWord={handleSelectWord}
              onPracticeMistake={handlePracticeMistake}
              onPracticeCollocation={handlePracticeCollocation}
            />
          )}

          {/* 4. WORD NETWORK SECTION (Word Family, Synonyms, Antonyms, Common Collocs) */}
          {learningProfile && (
            <WordNetworkSection
              profile={learningProfile}
              onSelectWord={handleSelectWord}
            />
          )}

        </div>
      ) : null}

      {/* Voice Pronunciation Modal */}
      {entry && (
        <VoicePronunciationModal
          isOpen={isVoiceModalOpen}
          onClose={() => setIsVoiceModalOpen(false)}
          targetText={entry.word}
          ipa={entry.localData?.ipa}
          meaning={entry.vietnameseMeaning}
          example={entry.localData?.example}
        />
      )}

    </div>
  );
};
