import React, { useState } from 'react';
import { 
  AlertTriangle, 
  HelpCircle, 
  ArrowRight, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Flame, 
  Compass 
} from 'lucide-react';
import { LearningDictionaryProfile, PersonalizedConfusionItem, WordAssociatedCollocation } from '../../types';

export interface NeedsPracticeSectionProps {
  profile: LearningDictionaryProfile;
  onSelectWord: (word: string) => void;
  onPracticeMistake?: () => void;
  onPracticeCollocation?: (phrase: string) => void;
}

export const NeedsPracticeSection: React.FC<NeedsPracticeSectionProps> = ({
  profile,
  onSelectWord,
  onPracticeMistake,
  onPracticeCollocation,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const { mistakeSummary, confusion, weakCollocations, leechStatus } = profile;

  const hasUnresolvedMistake = mistakeSummary.unresolved;
  const hasConfusedWords = confusion.personalizedConfusedWith.length > 0;
  const hasWeakCollocations = weakCollocations.length > 0;
  const isLeech = leechStatus.isLeech;

  const hasAnyWeakness = hasUnresolvedMistake || hasConfusedWords || hasWeakCollocations || isLeech;

  // Empty state if word has zero weaknesses
  if (!hasAnyWeakness) {
    return (
      <div
        data-testid="needs-practice-empty-state"
        className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-xs text-emerald-300"
      >
        <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>Từ này chưa có ghi nhận lỗi sai hoặc điểm yếu nào trong lịch sử học tập của bạn.</span>
      </div>
    );
  }

  const getEvidenceLabel = (colloc: WordAssociatedCollocation) => {
    switch (colloc.weaknessEvidence) {
      case 'srs_failure':
        return 'Thất bại trong SRS';
      case 'ai_tutor':
        return 'AI Tutor phát hiện';
      case 'writing_correction':
        return 'Sửa lỗi bài viết';
      case 'mistake_bank':
      default:
        return 'Lỗi trong Mistake Bank';
    }
  };

  return (
    <div
      data-testid="needs-practice-section"
      className="bg-amber-950/20 border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>Điểm Yếu Cần Chú Ý</span>
              <span className="text-xs text-amber-400 font-semibold hidden sm:inline">(Needs Practice)</span>
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
          aria-label="Toggle Needs Practice details"
          aria-expanded={isExpanded}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <div className="pt-2 space-y-4">
          {/* 1. Leech Warning Alert */}
          {isLeech && (
            <div
              data-testid="leech-alert-box"
              className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-2xl space-y-1.5"
            >
              <div className="flex items-center gap-2 text-rose-300 font-bold text-xs uppercase tracking-wider">
                <Flame className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Cảnh báo Thẻ Leech (Hay Quên Lặp Lại)</span>
              </div>
              <p className="text-xs text-rose-200 leading-relaxed">
                Từ này đã quên nhiều lần ({leechStatus.lapseCount} lần lapse). Hãy tập trung liên kết hình ảnh, tạo ví dụ ngữ cảnh cụ thể hoặc dùng kỹ thuật mnemonic để neo giữ trí nhớ.
              </p>
            </div>
          )}

          {/* 2. Unresolved Mistake Banner */}
          {hasUnresolvedMistake && (
            <div
              data-testid="unresolved-mistake-banner"
              className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Chưa khắc phục: Sai {mistakeSummary.mistakeCount} lần trong bài tập
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Dạng lỗi: <strong className="text-amber-200 uppercase">{mistakeSummary.primaryType || 'từ vựng'}</strong> • Chuỗi đúng hiện tại: {mistakeSummary.consecutiveCorrect}/3
                </p>
              </div>

              {onPracticeMistake && (
                <button
                  type="button"
                  onClick={onPracticeMistake}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow transition-all shrink-0"
                >
                  Luyện tập sửa lỗi
                </button>
              )}
            </div>
          )}

          {/* 3. Personalized Confused Words */}
          {hasConfusedWords && (
            <div data-testid="personalized-confused-words-section" className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  <span>Bạn Thường Nhầm Lẫn Với:</span>
                </span>
                <span className="text-[10px] text-amber-400 font-medium">Bằng chứng từ bài học cá nhân</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {confusion.personalizedConfusedWith.map((item: PersonalizedConfusionItem) => (
                  <button
                    key={item.word}
                    type="button"
                    onClick={() => onSelectWord(item.word)}
                    className="group px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                    title={`Nhầm ${item.count} lần • Click để tra cứu từ "${item.word}"`}
                  >
                    <span>{item.word}</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-amber-950/60 text-amber-300 rounded font-mono">
                      ×{item.count}
                    </span>
                    <ArrowRight className="w-3 h-3 text-amber-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. Weak Collocations */}
          {hasWeakCollocations && (
            <div data-testid="weak-collocations-section" className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Cụm Từ Liên Kết Yếu Của Bạn:</span>
                </span>
                <span className="text-[10px] text-rose-400 font-medium">{weakCollocations.length} cụm cần củng cố</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {weakCollocations.map((colloc: WordAssociatedCollocation) => (
                  <div
                    key={colloc.phrase}
                    className="p-3 bg-slate-950/60 border border-rose-500/30 rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-xs font-bold text-white truncate">{colloc.phrase}</p>
                      <p className="text-[11px] text-slate-400 truncate">{colloc.meaning}</p>
                      <span className="inline-block text-[10px] text-rose-300 font-medium">
                        Lý do: {getEvidenceLabel(colloc)}
                      </span>
                    </div>

                    {onPracticeCollocation && (
                      <button
                        type="button"
                        onClick={() => onPracticeCollocation(colloc.phrase)}
                        className="p-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl text-xs font-bold transition-all shrink-0"
                        title={`Luyện tập cụm "${colloc.phrase}"`}
                      >
                        Luyện
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
