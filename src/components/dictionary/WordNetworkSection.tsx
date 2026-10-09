import React, { useState } from 'react';
import { 
  Network, 
  GitFork, 
  ChevronDown, 
  ChevronUp, 
  BookmarkCheck,
  Split,
  Tag
} from 'lucide-react';
import { LearningDictionaryProfile, WordFamilyMember } from '../../types';

export interface WordNetworkSectionProps {
  profile: LearningDictionaryProfile;
  onSelectWord: (word: string) => void;
}

export const WordNetworkSection: React.FC<WordNetworkSectionProps> = ({
  profile,
  onSelectWord,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const { wordFamily, synonyms, antonyms, commonCollocations, collocations } = profile;

  // Use commonCollocations or fallback to collocations
  const activeCollocations = commonCollocations && commonCollocations.length > 0 
    ? commonCollocations 
    : collocations || [];

  const normalizedRoot = (wordFamily?.root || '').trim().toLowerCase();
  const deduplicatedMembers = React.useMemo(() => {
    if (!wordFamily?.members || !Array.isArray(wordFamily.members)) return [];
    const seen = new Set<string>();
    if (normalizedRoot) {
      seen.add(normalizedRoot);
    }
    const result: WordFamilyMember[] = [];
    for (let i = 0; i < wordFamily.members.length; i++) {
      const m = wordFamily.members[i];
      const key = (m.word || '').trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        result.push(m);
      }
    }
    return result;
  }, [wordFamily, normalizedRoot]);

  const hasWordFamily = Boolean(wordFamily && deduplicatedMembers.length > 0);
  const hasSynonyms = synonyms && synonyms.length > 0;
  const hasAntonyms = antonyms && antonyms.length > 0;
  const hasCollocations = activeCollocations && activeCollocations.length > 0;

  const hasAnyNetworkData = hasWordFamily || hasSynonyms || hasAntonyms || hasCollocations;

  if (!hasAnyNetworkData) {
    return null;
  }

  return (
    <div
      data-testid="word-network-section"
      className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>Mạng Lưới Từ Vựng</span>
              <span className="text-xs text-slate-400 font-normal hidden sm:inline">(Word Network • Static Base)</span>
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
          aria-label="Toggle Word Network details"
          aria-expanded={isExpanded}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <div className="pt-2 space-y-5">
          {/* 1. Word Family */}
          {hasWordFamily && (
            <div data-testid="word-family-block" className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <GitFork className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Gia Đình Từ Vựng (Word Family):</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  Gốc từ: <strong className="text-cyan-200 font-mono">"{wordFamily.root}"</strong>
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {deduplicatedMembers.map((member: WordFamilyMember) => (
                  <button
                    key={member.word}
                    type="button"
                    onClick={() => onSelectWord(member.word)}
                    className="group px-3 py-1.5 bg-slate-950/80 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/40 text-slate-200 hover:text-cyan-200 rounded-xl text-xs font-medium flex items-center gap-2 transition-all"
                    title={`Click để tra cứu "${member.word}"`}
                  >
                    <span className="font-bold group-hover:text-cyan-300 transition-colors">{member.word}</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 group-hover:bg-cyan-900/50 text-slate-400 group-hover:text-cyan-300 rounded font-mono">
                      {member.partOfSpeech}
                    </span>
                    {member.level && (
                      <span className="text-[10px] px-1 py-0.2 bg-violet-950/60 text-violet-300 rounded font-bold uppercase">
                        {member.level}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. Synonyms & Antonyms Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Synonyms */}
            {hasSynonyms && (
              <div data-testid="synonyms-block" className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Từ Đồng Nghĩa (Synonyms):</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {synonyms.map((syn: string) => (
                    <button
                      key={syn}
                      type="button"
                      onClick={() => onSelectWord(syn)}
                      className="px-2.5 py-1 bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/30 text-slate-300 hover:text-emerald-300 rounded-xl text-xs transition-colors"
                      title={`Tra từ "${syn}"`}
                    >
                      {syn}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Antonyms */}
            {hasAntonyms && (
              <div data-testid="antonyms-block" className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Split className="w-3.5 h-3.5 text-rose-400" />
                  <span>Từ Trái Nghĩa (Antonyms):</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {antonyms.map((ant: string) => (
                    <button
                      key={ant}
                      type="button"
                      onClick={() => onSelectWord(ant)}
                      className="px-2.5 py-1 bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/30 text-slate-300 hover:text-rose-300 rounded-xl text-xs transition-colors"
                      title={`Tra từ "${ant}"`}
                    >
                      {ant}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. Common Collocations (Static language base) */}
          {hasCollocations && (
            <div data-testid="common-collocations-block" className="space-y-2 pt-1 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Cụm Từ Đi Kèm Thông Dụng (Common Collocations):</span>
                </span>
                <span className="text-[10px] text-slate-400">Từ điển ngữ liệu chuẩn</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {activeCollocations.map((colloc: string, idx: number) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelectWord(colloc)}
                    className="px-3 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 rounded-xl text-xs font-medium transition-all"
                    title={`Tra cứu cụm từ "${colloc}"`}
                  >
                    {colloc}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
