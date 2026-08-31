import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Volume2, 
  PlusCircle, 
  Sparkles, 
  BookOpen, 
  Check, 
  X, 
  Database,
  Zap,
  ArrowRight,
  Layers,
  Star
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAppStore } from '../store/useAppStore';
import { speakWord } from '../services/speechService';
import { translateText } from '../services/translationService';
import { VocabWord } from '../types';
import { 
  searchFullDictionary, 
  getFullDictionaryCount, 
  DictionarySearchResult 
} from '../services/dictionaryIndex';

interface DatamuseResult {
  word: string;
  score?: number;
  tags?: string[];
  defs?: string[];
}

interface DictionaryEntryData {
  word: string;
  vietnameseMeaning: string;
  partOfSpeech: string;
  englishDefinition: string;
  synonyms: string[];
  associations: string[];
  isLocal: boolean;
  localData?: VocabWord;
}

interface DictionaryViewProps {
  onOpenAddWord?: (prefillWord?: string) => void;
}

export const DictionaryView: React.FC<DictionaryViewProps> = ({ onOpenAddWord }) => {
  const { addCustomWord, vocabularyList, audioVoice, audioSpeed } = useAppStore();

  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('resilience');
  const [loading, setLoading] = useState(false);
  const [entry, setEntry] = useState<DictionaryEntryData | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([
    'resilience', 'meticulous', 'innovation', 'proactive', 'empathy', 'sustainable', 'microservices'
  ]);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);

  // Live Offline Prefix Search Results (< 5ms)
  const liveOfflineSuggestions = useMemo(() => {
    if (!query.trim() || query.trim().length < 1) return [];
    return searchFullDictionary(query.trim(), 'ALL', 8);
  }, [query]);

  const totalDictionaryCount = useMemo(() => {
    return getFullDictionaryCount();
  }, []);

  // Logic tra cứu đa tầng: Siêu Từ Điển Offline -> Local User Bank -> Translation Engine & Datamuse
  useEffect(() => {
    const cleanWord = searchTerm.trim().toLowerCase();
    if (!cleanWord) return;

    let isMounted = true;
    setLoading(true);

    // 1. KIỂM TRA TRONG KHO HỌC CỦA USER HOẶC SIÊU TỪ ĐIỂN OFFLINE
    const userMatch = vocabularyList.find(
      (w) => w.word.trim().toLowerCase() === cleanWord
    );

    const offlineMatch = searchFullDictionary(cleanWord, 'ALL', 1).find(
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
      setLoading(false);
      
      setRecentSearches((prev) => {
        const filtered = prev.filter((w) => w.toLowerCase() !== cleanWord);
        return [cleanWord, ...filtered].slice(0, 8);
      });
      return;
    }

    // 2. NẾU CHƯA CÓ TRONG KHO -> GỌI ENGINE DỊCH & DATAMUSE METADATA
    Promise.all([
      // Tra nghĩa tiếng Việt
      translateText(cleanWord, 'en', 'vi'),

      // Tra metadata định nghĩa & từ loại qua Datamuse
      fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(cleanWord)}&md=dps&max=1`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),

      // Tra từ đồng nghĩa
      fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(cleanWord)}&max=5`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),

      // Tra từ liên kết ngữ cảnh
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

        setRecentSearches((prev) => {
          const filtered = prev.filter((w) => w.toLowerCase() !== cleanWord);
          return [cleanWord, ...filtered].slice(0, 8);
        });
      })
      .catch((err) => {
        console.error('Lỗi tra từ trực tuyến:', err);
        if (isMounted) {
          setEntry({
            word: searchTerm.trim(),
            vietnameseMeaning: 'Không thể kết nối máy chủ dịch thuật.',
            partOfSpeech: 'noun',
            englishDefinition: 'No definition available.',
            synonyms: [],
            associations: [],
            isLocal: false,
          });
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [searchTerm, vocabularyList]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchTerm(query.trim());
    }
  };

  const handleSelectWord = (word: string) => {
    setQuery(word);
    setSearchTerm(word);
  };

  // Lưu từ điển vào kho học SRS
  const handleSaveToDeck = () => {
    if (!entry) return;

    const isAlreadyExist = vocabularyList.some(
      (w) => w.word.toLowerCase() === entry.word.toLowerCase()
    );

    if (isAlreadyExist) {
      setSavingStatus(`Từ "${entry.word}" đã có sẵn trong Kho từ vựng của bạn!`);
      setTimeout(() => setSavingStatus(null), 3000);
      return;
    }

    addCustomWord({
      word: entry.word,
      ipa: entry.localData?.ipa || '/.../',
      partOfSpeech: entry.partOfSpeech,
      meaning: entry.vietnameseMeaning,
      definitionEn: entry.englishDefinition,
      example: entry.localData?.example || `Learning and mastering the word "${entry.word}".`,
      exampleMeaning: entry.localData?.exampleMeaning || `Học và thành thạo cách sử dụng từ "${entry.word}".`,
      tag: (entry.localData?.tag as any) || 'IELTS',
      synonyms: entry.synonyms.slice(0, 4),
      collocations: entry.associations.slice(0, 3),
    });

    confetti({
      particleCount: 60,
      spread: 60,
      origin: { y: 0.6 },
    });

    setSavingStatus(`Đã lưu "${entry.word}" vào Flashcard SRS (+15 XP)!`);
    setTimeout(() => setSavingStatus(null), 3500);
  };

  const isWordInMyDeck = entry ? vocabularyList.some((w) => w.word.toLowerCase() === entry.word.toLowerCase()) : false;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      
      {/* Header & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white">Siêu Từ Điển Nhanh (Full Dictionary Engine)</h2>
              <p className="text-xs text-slate-400">
                Kho offline <strong className="text-emerald-400">{totalDictionaryCount}+ từ vựng</strong> • Tra cứu Prefix siêu tốc &lt; 5ms • Phát âm Web Speech API
              </p>
            </div>
          </div>
        </div>

        {/* Search Input with perfect spacing between X button and Action Button */}
        <div className="relative">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-stretch gap-3">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nhập từ tiếng Anh bất kỳ (vd: resilience, microservices, leverage, paradigm...)"
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

          {/* Live Offline Prefix Search Dropdown Suggestions (< 5ms) */}
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
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 animate-bounce">
          <Check className="w-5 h-5 text-emerald-400" />
          <span>{savingStatus}</span>
        </div>
      )}

      {/* Main Entry Card */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3 shadow-xl">
          <Sparkles className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Đang tra cứu và tổng hợp ngữ nghĩa cho <strong>"{searchTerm}"</strong>...</p>
        </div>
      ) : entry ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          {/* Card Header: Word, Pronunciation, Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
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

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Voice Pronunciation */}
              <button
                onClick={() => speakWord(entry.word, audioVoice, audioSpeed)}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-xl border border-slate-700 text-xs font-bold transition-all"
                title="Phát âm tiếng Anh"
              >
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>Phát âm</span>
              </button>

              {/* 1-Click Save to SRS Deck Button */}
              {isWordInMyDeck ? (
                <div className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Đã có trong Flashcard</span>
                </div>
              ) : (
                <button
                  onClick={handleSaveToDeck}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all transform hover:scale-105"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Lưu vào Flashcard SRS (+15 XP)</span>
                </button>
              )}
            </div>
          </div>

          {/* Vietnamese Core Meaning */}
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

          {/* Synonyms & Collocations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Synonyms */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Từ Đồng Nghĩa (Synonyms):</span>
              <div className="flex flex-wrap gap-2">
                {entry.synonyms && entry.synonyms.length > 0 ? (
                  entry.synonyms.map((syn, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectWord(syn)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-emerald-400 rounded-xl text-xs border border-slate-700 font-medium transition-all"
                    >
                      {syn}
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-slate-500 italic">Chưa có dữ liệu từ đồng nghĩa</span>
                )}
              </div>
            </div>

            {/* Context Associations */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cụm Từ Liên Quan (Collocations):</span>
              <div className="flex flex-wrap gap-2">
                {entry.associations && entry.associations.length > 0 ? (
                  entry.associations.map((trg, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectWord(trg)}
                      className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 rounded-xl text-xs border border-cyan-500/20 font-medium transition-all"
                    >
                      {trg}
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-slate-500 italic">Chưa có dữ liệu cụm từ đi kèm</span>
                )}
              </div>
            </div>
          </div>

        </div>
      ) : null}

    </div>
  );
};
