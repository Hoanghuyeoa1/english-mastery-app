// src/components/VocabularyMiningPanel.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { 
  Sparkles, 
  BookmarkPlus, 
  Check, 
  Search, 
  Filter, 
  Layers, 
  BookOpen, 
  ChevronDown, 
  ChevronUp,
  Cpu,
  GraduationCap,
  Brain
} from 'lucide-react';
import { triggerCelebration } from '../utils/confettiPolicy';
import type { CEFRLevel, VocabWord } from '../types';
import { useAppStore } from '../store/useAppStore';
import { 
  type TextAnalysisResult, 
  type TextToken, 
  type AnalyzedSpan, 
  type PhraseCategory 
} from '../services/textAnalysisService';
import { deriveLearnerSemantic } from '../services/learningDictionaryService';
import { extractSentenceContext, lookupContextWord, cleanWordToken } from '../services/wordLookupService';

export type MiningCategoryKey = 
  | 'all' 
  | 'unknown' 
  | 'phrasal_verbs' 
  | 'idioms' 
  | 'collocations' 
  | 'grammar' 
  | 'academic' 
  | 'it';

export type MiningFilterKey = 
  | 'all' 
  | 'unsaved_only' 
  | 'saved_only' 
  | 'b2_plus' 
  | 'c1_plus' 
  | 'unknown_only';

export interface VocabularyMiningItem {
  id: string;
  text: string;
  lemma: string;
  canonicalId?: string;
  category: PhraseCategory | 'word';
  categoryLabel: string;
  cefr?: CEFRLevel;
  meaning?: string;
  note?: string;
  patternType?: string;
  sentenceContext: string;
  isSaved: boolean;
  semantic: 'known' | 'learning' | 'unknown';
}

export interface VocabularyMiningPanelProps {
  sourceText: string;
  analysis: TextAnalysisResult;
  onLookupWord?: (word: string, rect: DOMRect) => void;
  onCreateQuiz?: () => void;
  className?: string;
}

const CEFR_LEVEL_RANK: Record<string, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

export const VocabularyMiningPanel: React.FC<VocabularyMiningPanelProps> = ({
  sourceText,
  analysis,
  onLookupWord,
  onCreateQuiz,
  className = '',
}) => {
  const { 
    srsProgressMap, 
    userCollocations, 
    saveToSRS, 
    saveCollocationToSRS,
    recordTranslatorLookup
  } = useAppStore();

  const [isExpanded, setIsExpanded] = useState(true);
  const [activeCategory, setActiveCategory] = useState<MiningCategoryKey>('all');
  const [activeFilter, setActiveFilter] = useState<MiningFilterKey>('all');
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Helper check if collocation/phrase is saved
  const isPhraseSaved = useCallback((phrase: string) => {
    const clean = phrase.trim().toLowerCase();
    return (userCollocations || []).some(
      (c) => c.phrase.trim().toLowerCase() === clean
    );
  }, [userCollocations]);

  // Helper check if word is in SRS
  const isWordSaved = useCallback((wordOrId: string) => {
    const clean = wordOrId.trim().toLowerCase();
    return Boolean(srsProgressMap[clean] || srsProgressMap[`vocab_${clean}`]);
  }, [srsProgressMap]);

  // Transform TextAnalysisResult into unified VocabularyMiningItem list
  // Pure O(N) mapping, computed ONLY when analysis changes (NOT on filter switch!)
  const rawMiningItems = useMemo<VocabularyMiningItem[]>(() => {
    if (!analysis || !sourceText.trim()) return [];

    const items: VocabularyMiningItem[] = [];
    const seenTexts = new Set<string>();

    // 1. Multi-word Phrases & Grammar Patterns (from spans & allCandidates)
    const spansToMine = analysis.spans.length > 0 ? analysis.spans : analysis.allCandidates;

    for (const span of spansToMine) {
      const lower = span.canonical.toLowerCase().trim();
      if (!lower || seenTexts.has(lower)) continue;
      seenTexts.add(lower);

      const isSaved = isPhraseSaved(span.surface) || isPhraseSaved(span.canonical);
      const sentenceContext = extractSentenceContext(sourceText, span.surface);

      let categoryLabel = 'Cụm từ';
      if (span.category === 'phrasal_verb') categoryLabel = 'Cụm động từ';
      else if (span.category === 'idiom') categoryLabel = 'Thành ngữ';
      else if (span.category === 'it_term') categoryLabel = 'Công nghệ / IT';
      else if (span.category === 'academic') categoryLabel = 'Học thuật (AWL)';
      else if (span.category === 'grammar_pattern') categoryLabel = 'Mẫu ngữ pháp';

      items.push({
        id: span.id,
        text: span.surface,
        lemma: span.canonical,
        canonicalId: span.canonicalId,
        category: span.category,
        categoryLabel,
        cefr: span.cefr,
        meaning: span.meaning,
        note: span.note,
        patternType: span.patternType,
        sentenceContext,
        isSaved,
        semantic: isSaved ? 'learning' : 'unknown',
      });
    }

    // 2. High-Value Single Words (from tokens)
    for (const token of analysis.tokens) {
      if (token.isStopWord) continue;
      const lemmaLower = token.lemma.toLowerCase().trim();
      if (!lemmaLower || seenTexts.has(lemmaLower) || lemmaLower.length < 2) continue;
      seenTexts.add(lemmaLower);

      const isSaved = isWordSaved(token.lemma) || (token.canonicalId ? isWordSaved(token.canonicalId) : false);
      const srsEntry = srsProgressMap[token.canonicalId || ''] || srsProgressMap[lemmaLower];
      
      const semantic = srsEntry 
        ? deriveLearnerSemantic({ 
            learningStatus: (srsEntry.srsLevel ?? 0) >= 4 ? 'mastered' : 'learning', 
            isInUserDeck: true 
          })
        : 'unknown';

      const sentenceContext = extractSentenceContext(sourceText, token.raw);

      let categoryLabel = 'Từ vựng';
      let cat: PhraseCategory | 'word' = 'word';
      if (token.isIT) {
        cat = 'it_term';
        categoryLabel = 'Công nghệ / IT';
      } else if (token.isAcademic) {
        cat = 'academic';
        categoryLabel = 'Học thuật (AWL)';
      }

      items.push({
        id: `token_${token.index}_${lemmaLower}`,
        text: token.raw,
        lemma: token.lemma,
        canonicalId: token.canonicalId,
        category: cat,
        categoryLabel,
        cefr: token.cefr,
        meaning: token.category ? `${token.category} (${token.partOfSpeech || 'word'})` : undefined,
        note: token.partOfSpeech ? `Từ loại: ${token.partOfSpeech}` : undefined,
        sentenceContext,
        isSaved,
        semantic,
      });
    }

    return items;
  }, [analysis, sourceText, isPhraseSaved, isWordSaved, srsProgressMap]);

  // Compute category counts for tab headers
  const categoryCounts = useMemo(() => {
    return {
      all: rawMiningItems.length,
      unknown: rawMiningItems.filter((i) => i.semantic === 'unknown' || !i.isSaved).length,
      phrasal_verbs: rawMiningItems.filter((i) => i.category === 'phrasal_verb').length,
      idioms: rawMiningItems.filter((i) => i.category === 'idiom').length,
      collocations: rawMiningItems.filter((i) => i.category === 'collocation').length,
      grammar: rawMiningItems.filter((i) => i.category === 'grammar_pattern').length,
      academic: rawMiningItems.filter((i) => i.category === 'academic').length,
      it: rawMiningItems.filter((i) => i.category === 'it_term').length,
    };
  }, [rawMiningItems]);

  // Pure filtering on pre-computed items: Zero NLP / Regex recomputation!
  const filteredItems = useMemo<VocabularyMiningItem[]>(() => {
    let list = rawMiningItems;

    // 1. Filter by Category Tab
    if (activeCategory === 'unknown') {
      list = list.filter((i) => i.semantic === 'unknown' || !i.isSaved);
    } else if (activeCategory === 'phrasal_verbs') {
      list = list.filter((i) => i.category === 'phrasal_verb');
    } else if (activeCategory === 'idioms') {
      list = list.filter((i) => i.category === 'idiom');
    } else if (activeCategory === 'collocations') {
      list = list.filter((i) => i.category === 'collocation');
    } else if (activeCategory === 'grammar') {
      list = list.filter((i) => i.category === 'grammar_pattern');
    } else if (activeCategory === 'academic') {
      list = list.filter((i) => i.category === 'academic');
    } else if (activeCategory === 'it') {
      list = list.filter((i) => i.category === 'it_term');
    }

    // 2. Filter by Smart Criteria
    if (activeFilter === 'unsaved_only') {
      list = list.filter((i) => !i.isSaved);
    } else if (activeFilter === 'saved_only') {
      list = list.filter((i) => i.isSaved);
    } else if (activeFilter === 'unknown_only') {
      list = list.filter((i) => i.semantic === 'unknown');
    } else if (activeFilter === 'b2_plus') {
      list = list.filter((i) => i.cefr && (CEFR_LEVEL_RANK[i.cefr] || 0) >= 4);
    } else if (activeFilter === 'c1_plus') {
      list = list.filter((i) => i.cefr && (CEFR_LEVEL_RANK[i.cefr] || 0) >= 5);
    }

    return list;
  }, [rawMiningItems, activeCategory, activeFilter]);

  // Action: Save single word/phrase to SRS
  const handleSaveItem = useCallback((item: VocabularyMiningItem) => {
    if (item.isSaved) return;

    if (item.category === 'word' || !item.text.includes(' ')) {
      // Save single word via canonical saveToSRS
      saveToSRS(item.lemma, {
        contextSentence: item.sentenceContext || sourceText,
        meaning: item.meaning,
        source: 'translator',
        sources: ['translator'],
      });
    } else {
      // Save multi-word phrase via saveCollocationToSRS
      saveCollocationToSRS({
        phrase: item.text,
        meaning: item.meaning || `${item.categoryLabel}: ${item.lemma}`,
        usageContext: item.note || `Trích xuất từ bản dịch Context AI`,
        exampleEn: item.sentenceContext || sourceText,
        exampleVi: '',
        tags: [item.category, 'translator'],
        source: 'translator',
      });
    }

    triggerCelebration('micro');
    setSaveToast(`+15 XP • Đã lưu "${item.text}" vào Flashcard SRS (SM-2)!`);
    setTimeout(() => setSaveToast(null), 3000);
  }, [saveToSRS, saveCollocationToSRS, sourceText]);

  // Action: Batch Save all unsaved items currently in view
  const handleBatchSave = useCallback(() => {
    const unsaved = filteredItems.filter((i) => !i.isSaved);
    if (unsaved.length === 0) return;

    let savedCount = 0;
    for (const item of unsaved) {
      if (item.category === 'word' || !item.text.includes(' ')) {
        saveToSRS(item.lemma, {
          contextSentence: item.sentenceContext || sourceText,
          meaning: item.meaning,
          source: 'translator',
          sources: ['translator'],
        });
        savedCount++;
      } else {
        const res = saveCollocationToSRS({
          phrase: item.text,
          meaning: item.meaning || `${item.categoryLabel}: ${item.lemma}`,
          usageContext: item.note || `Trích xuất từ bản dịch Context AI`,
          exampleEn: item.sentenceContext || sourceText,
          exampleVi: '',
          tags: [item.category, 'translator'],
          source: 'translator',
        });
        if (res.success) savedCount++;
      }
    }

    if (savedCount > 0) {
      triggerCelebration('completion', { particleCount: 65, spread: 70, origin: { y: 0.8 } });
      setSaveToast(`+${savedCount * 15} XP • Đã lưu thành công ${savedCount} mục vào Flashcard SRS!`);
      setTimeout(() => setSaveToast(null), 3500);
    }
  }, [filteredItems, saveToSRS, saveCollocationToSRS, sourceText]);

  // Action: Trigger word lookup in dictionary
  const handleItemLookup = (item: VocabularyMiningItem, target: HTMLElement) => {
    recordTranslatorLookup(item.lemma || item.text);
    if (onLookupWord) {
      const rect = target.getBoundingClientRect();
      onLookupWord(item.lemma || item.text, rect);
    }
  };

  if (!sourceText.trim() || rawMiningItems.length === 0) {
    return null;
  }

  const unsavedCount = filteredItems.filter((i) => !i.isSaved).length;

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 ${className}`}>
      
      {/* 1. Header with Title & Expand Toggle */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-white">
                Khai Thác Từ Vựng & Cụm Từ (Vocabulary Mining)
              </h3>
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {rawMiningItems.length} mục
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Trích xuất tự động từ vựng đắt giá, thành ngữ, cụm động từ và thuật ngữ chuyên ngành
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onCreateQuiz && isExpanded && (
            <button
              type="button"
              onClick={onCreateQuiz}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <Brain className="w-3.5 h-3.5 text-amber-400" />
              <span>Tạo Quiz ({rawMiningItems.length})</span>
            </button>
          )}

          {unsavedCount > 1 && isExpanded && (
            <button
              type="button"
              onClick={handleBatchSave}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Lưu tất cả ({unsavedCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* 2. Category Selector Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
            {[
              { id: 'all', label: 'Tất cả', count: categoryCounts.all },
              { id: 'unknown', label: 'Chưa học', count: categoryCounts.unknown },
              { id: 'phrasal_verbs', label: 'Cụm ĐT', count: categoryCounts.phrasal_verbs },
              { id: 'idioms', label: 'Thành ngữ', count: categoryCounts.idioms },
              { id: 'academic', label: 'Học thuật (AWL)', count: categoryCounts.academic },
              { id: 'it', label: 'Công nghệ (IT)', count: categoryCounts.it },
              { id: 'grammar', label: 'Ngữ pháp', count: categoryCounts.grammar },
            ].map((cat) => {
              if (cat.count === 0 && cat.id !== 'all') return null;
              const isSelected = activeCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id as MiningCategoryKey)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    isSelected ? 'bg-black/20 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 3. Filter Criteria Row */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-2xl border border-slate-850">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>Bộ lọc:</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'unsaved_only', label: 'Chưa lưu' },
                { id: 'saved_only', label: 'Đã lưu' },
                { id: 'b2_plus', label: 'B2+' },
                { id: 'c1_plus', label: 'C1+' },
                { id: 'unknown_only', label: 'Chỉ từ mới' },
              ].map((f) => {
                const isSelected = activeFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveFilter(f.id as MiningFilterKey)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                        : 'text-slate-400 hover:text-white hover:bg-slate-850'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Mined Items Grid */}
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 italic">
              Không có từ vựng hoặc cụm từ nào khớp với bộ lọc đã chọn.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
              {filteredItems.map((item) => {
                return (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-850/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-750 rounded-2xl flex flex-col justify-between transition-all space-y-2 group"
                  >
                    <div className="space-y-1">
                      {/* Top Badges: Category & CEFR & Semantic */}
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                          {item.categoryLabel}
                        </span>

                        <div className="flex items-center gap-1">
                          {item.cefr && (
                            <span className="text-[10px] font-extrabold text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-1.5 py-0.2 rounded-md">
                              {item.cefr}
                            </span>
                          )}

                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                            item.semantic === 'known'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : item.semantic === 'learning'
                              ? 'bg-sky-500/15 text-sky-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {item.semantic === 'known' ? 'Đã thuộc' : item.semantic === 'learning' ? 'Đang học' : 'Từ mới'}
                          </span>
                        </div>
                      </div>

                      {/* Term Text & Lemma */}
                      <div>
                        <strong className="text-xs sm:text-sm font-black text-white block group-hover:text-amber-300 transition-colors">
                          {item.text}
                        </strong>
                        {item.lemma && item.lemma !== item.text && (
                          <span className="text-[10px] text-slate-500 font-mono block">
                            lemma: {item.lemma}
                          </span>
                        )}
                      </div>

                      {/* Meaning / Function */}
                      {item.meaning && (
                        <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                          {item.meaning}
                        </p>
                      )}
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                      <button
                        type="button"
                        onClick={(e) => handleItemLookup(item, e.currentTarget)}
                        className="text-[11px] font-bold text-slate-400 hover:text-teal-300 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Tra từ điển chi tiết"
                      >
                        <Search className="w-3 h-3" />
                        <span>Tra từ</span>
                      </button>

                      {item.isSaved ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Đã lưu (SM-2)</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSaveItem(item)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-xs"
                          title="Lưu vào thẻ ghi nhớ SM-2 (+15 XP)"
                        >
                          <BookmarkPlus className="w-3 h-3 text-teal-400" />
                          <span>Lưu (+15 XP)</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Save Notification Toast */}
      {saveToast && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl font-semibold text-xs flex items-center gap-2 shadow-lg animate-fade-in">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveToast}</span>
        </div>
      )}

    </div>
  );
};
