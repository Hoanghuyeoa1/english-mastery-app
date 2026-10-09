import type { SRSReviewCard, SRSProgress, VocabWord, VocabTag, VocabItemType } from '../types';
import { isDueForReview } from './srsAlgorithm';

export type QueueMode = 'DUE' | 'NEW';
export type CardTypeTab = 'ALL' | 'SINGLE_WORD' | 'COLLOCATION';
export type FilterTag = 'ALL' | 'FAVORITE' | 'MISTAKES' | 'SAVED_SENTENCES' | VocabTag;
export type FilterLevel = 'ALL' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

/**
 * Helper phân biệt từ vựng đơn/cụm ngắn vs câu dịch/đoạn văn dài
 */
export const isSentenceItem = (w: {
  word?: string;
  primaryText?: string;
  tag?: string;
  partOfSpeech?: string;
  type?: VocabItemType;
}): boolean => {
  if (w.type && w.type !== 'single_word') return false;
  const text = w.primaryText || w.word || '';
  if (!text) return false;
  const wordCount = text.trim().split(/\s+/).length;
  return (
    wordCount > 4 ||
    text.trim().length > 35 ||
    (w.tag as string) === 'Sentence' ||
    (w.partOfSpeech as string) === 'sentence'
  );
};

/**
 * Helper định dạng khoảng thời gian ôn tập cho FSRS
 */
export const formatFSRSIntervalPreview = (days: number): string => {
  if (days <= 0) return '< 10m';
  if (days === 1) return '1 ngày';
  if (days < 30) return `${days} ngày`;
  if (days < 365) return `${Math.round(days / 30)} tháng`;
  const years = (days / 365).toFixed(1).replace(/\.0$/, '');
  return `${years} năm`;
};

/**
 * Helper nạp chính xác danh sách từ cho phiên học (Exact Batch Slicing)
 */
export function buildSessionQueue(
  cards: SRSReviewCard[],
  mode: QueueMode,
  tag: FilterTag,
  level: FilterLevel = 'ALL',
  customBatchSize?: number,
  cardType: CardTypeTab = 'ALL',
  mistakeBank: Record<string, any> = {},
  srsProgressMap: Record<string, SRSProgress> = {},
  vocabularyList: VocabWord[] = [],
  targetDailyNewWords = 15
): SRSReviewCard[] {
  let filtered = cards;
  if (cardType === 'SINGLE_WORD') {
    filtered = filtered.filter((c) => c.type === 'single_word');
  } else if (cardType === 'COLLOCATION') {
    filtered = filtered.filter((c) => c.type !== 'single_word');
  }

  const targetLevel = level;

  if (tag === 'MISTAKES') {
    const weakRecords = Object.values(mistakeBank || {}).filter((m) => !m.resolved);
    return weakRecords.map((m) => {
      const found = filtered.find(
        (v) => v.id === m.id || (v.word || v.primaryText).toLowerCase() === m.word.toLowerCase()
      );
      if (found) return found;
      return {
        id: m.id || `mistake_${m.word.toLowerCase()}`,
        type: 'single_word' as const,
        primaryText: m.word,
        word: m.word,
        ipa: m.ipa || '',
        meaning: m.meaning || '',
        exampleEn: m.example || `Practice using the word "${m.word}" properly.`,
        example: m.example || `Practice using the word "${m.word}" properly.`,
        tag: m.tag || 'Daily',
        srsLevel: 0,
        nextReviewDate: new Date().toISOString(),
        interval: 0,
        easeFactor: 2.5,
      };
    });
  }

  if (mode === 'DUE') {
    return filtered.filter((w) => {
      const isDue = isDueForReview(w.nextReviewDate);
      const isAlreadyLearned =
        (w.srsLevel ?? 0) > 0 || !!(srsProgressMap[w.id] && srsProgressMap[w.id].lastReviewedDate);
      if (!isDue || !isAlreadyLearned) return false;

      const isSentence = isSentenceItem(w);
      if (tag === 'SAVED_SENTENCES') return isSentence;

      if (w.type === 'single_word') {
        const vocabMatch = vocabularyList.find((v) => v.id === w.id);
        const matchLevel = targetLevel === 'ALL' || vocabMatch?.level === targetLevel;
        if (!matchLevel) return false;

        if (tag === 'FAVORITE') return !isSentence && !!w.isFavorite;
        if (tag === 'ALL') return !isSentence;
        return !isSentence && vocabMatch?.tag === tag;
      }

      if (tag === 'FAVORITE') return !isSentence && !!w.isFavorite;
      return true;
    });
  }

  // Mode NEW: unlearned words
  const batchSize = customBatchSize || targetDailyNewWords || 15;
  const result: SRSReviewCard[] = [];

  for (let i = 0; i < filtered.length; i++) {
    if (result.length >= batchSize) break;
    const w = filtered[i];
    const isUnlearned =
      (w.srsLevel ?? 0) === 0 && !(srsProgressMap[w.id] && srsProgressMap[w.id].lastReviewedDate);
    if (!isUnlearned) continue;

    const isSentence = isSentenceItem(w);
    if (tag === 'SAVED_SENTENCES') {
      if (isSentence) result.push(w);
      continue;
    }

    if (w.type === 'single_word') {
      const vocabMatch = vocabularyList.find((v) => v.id === w.id);
      const matchLevel = targetLevel === 'ALL' || vocabMatch?.level === targetLevel;
      if (!matchLevel) continue;

      if (tag === 'FAVORITE') {
        if (!isSentence && !!w.isFavorite) result.push(w);
      } else if (tag === 'ALL') {
        if (!isSentence) result.push(w);
      } else if (!isSentence && vocabMatch?.tag === tag) {
        result.push(w);
      }
    } else {
      if (tag === 'FAVORITE') {
        if (!isSentence && !!w.isFavorite) result.push(w);
      } else {
        result.push(w);
      }
    }
  }
  return result;
}

export type FlashcardSessionKind = 'new' | 'review' | 'mixed';
export type FlashcardSessionState = FlashcardSessionKind | 'empty' | 'hydrating';

export interface DeriveFlashcardSessionInput {
  queue?: SRSReviewCard[];
  dueCount?: number;
  newCount?: number;
  isHydrated?: boolean;
  hasResumeActivity?: boolean;
  planTitle?: string;
  planObjective?: string;
  sourceContextTaskId?: string;
  srsProgressMap?: Record<string, SRSProgress>;
}

export interface FlashcardSessionSemantics {
  kind: FlashcardSessionKind | 'empty' | null;
  sessionState: FlashcardSessionState;
  dueCount: number;
  newCount: number;
  totalCards: number;
  canStart: boolean;
  isHydrating: boolean;
  isResume: boolean;
  title: string;
  actionLabel: string;
  objective: string;
}

/**
 * Pure derivation of flashcard session semantics from real queue/count state.
 * 
 * Invariants:
 * 1. Scheduler (SM-2 / FSRS) is decoupled from Session Semantics ('new' | 'review' | 'mixed').
 * 2. due=0, new>0 -> 'new'
 * 3. due>0, new=0 -> 'review'
 * 4. due>0, new>0 -> 'mixed'
 * 5. due=0, new=0 -> 'empty', canStart: false
 * 6. isHydrated=false -> isHydrating: true, kind: null, canStart: false (never falsely flashes 'empty' or wrong kind)
 * 7. hasResumeActivity=true -> isResume: true, actionLabel prioritizes resume continuation.
 */
export function deriveFlashcardSessionSemantics(
  input: DeriveFlashcardSessionInput
): FlashcardSessionSemantics {
  // 1. Hydration Guard: prevent premature empty flash before storage rehydration
  if (input.isHydrated === false) {
    return {
      kind: null,
      sessionState: 'hydrating',
      dueCount: 0,
      newCount: 0,
      totalCards: 0,
      canStart: false,
      isHydrating: true,
      isResume: false,
      title: '',
      actionLabel: '',
      objective: '',
    };
  }

  // 2. Count derivation: from real queue or explicit inputs
  let dueCount = input.dueCount;
  let newCount = input.newCount;

  if (dueCount === undefined || newCount === undefined) {
    if (input.queue && input.queue.length > 0) {
      let d = 0;
      let n = 0;
      for (let i = 0; i < input.queue.length; i++) {
        const card = input.queue[i];
        const isLearned =
          (card.srsLevel ?? 0) > 0 ||
          Boolean(card.lastReviewedDate) ||
          Boolean(input.srsProgressMap && input.srsProgressMap[card.id]?.lastReviewedDate);
        if (isLearned) {
          d++;
        } else {
          n++;
        }
      }
      dueCount = dueCount ?? d;
      newCount = newCount ?? n;
    } else {
      dueCount = dueCount ?? 0;
      newCount = newCount ?? 0;
    }
  }

  const safeDue = Math.max(0, dueCount);
  const safeNew = Math.max(0, newCount);
  const totalCards = input.queue ? input.queue.length : safeDue + safeNew;

  // 3. Session Kind Derivation
  let kind: FlashcardSessionKind | 'empty';
  let sessionState: FlashcardSessionState;

  if (safeDue === 0 && safeNew === 0) {
    kind = 'empty';
    sessionState = 'empty';
  } else if (safeDue === 0 && safeNew > 0) {
    kind = 'new';
    sessionState = 'new';
  } else if (safeDue > 0 && safeNew === 0) {
    kind = 'review';
    sessionState = 'review';
  } else {
    kind = 'mixed';
    sessionState = 'mixed';
  }

  const canStart = kind !== 'empty' && totalCards > 0;
  const isResume = Boolean(input.hasResumeActivity);

  // 4. Truthful Title Derivation
  let title: string;
  if (input.planTitle) {
    title = input.planTitle;
  } else if (kind === 'new') {
    title = 'Phiên Học Thẻ Từ Mới';
  } else if (kind === 'review') {
    title = 'Phiên Ôn Tập Thẻ Đến Hạn';
  } else if (kind === 'mixed') {
    title = 'Phiên Học Hôm Nay';
  } else {
    title = 'Không có thẻ trong hàng đợi';
  }

  // 5. Action Label (CTA) Derivation: Resume takes highest priority
  let actionLabel = '';
  if (isResume) {
    actionLabel = 'Tiếp tục phiên học';
  } else if (kind === 'new') {
    actionLabel = 'Bắt đầu học từ mới';
  } else if (kind === 'review') {
    actionLabel = 'Bắt đầu ôn tập';
  } else if (kind === 'mixed') {
    actionLabel = 'Bắt đầu phiên học';
  }

  // 6. Objective Derivation
  let objective = '';
  if (input.planObjective) {
    objective = input.planObjective;
  } else if (input.sourceContextTaskId) {
    if (kind === 'new') {
      objective = `Học ${totalCards} từ mới theo nhiệm vụ Kế hoạch hôm nay.`;
    } else if (kind === 'review') {
      objective = `Ôn tập ${totalCards} thẻ đến hạn theo nhiệm vụ Kế hoạch hôm nay.`;
    } else if (kind === 'mixed') {
      objective = `Thực hiện ${totalCards} thẻ (học mới & ôn tập) theo nhiệm vụ Kế hoạch hôm nay.`;
    }
  } else {
    if (kind === 'new') {
      objective = `Nạp ${totalCards} từ vựng mới vào chu kỳ ghi nhớ não bộ theo mục tiêu ngày.`;
    } else if (kind === 'review') {
      objective = `Củng cố trí nhớ dài hạn cho ${totalCards} thẻ đến hạn theo chu kỳ lặp lại ngắt quãng khoa học.`;
    } else if (kind === 'mixed') {
      objective = `Kết hợp nạp ${safeNew} từ mới và củng cố ${safeDue} thẻ đến hạn theo chu kỳ lặp lại ngắt quãng khoa học.`;
    }
  }

  return {
    kind,
    sessionState,
    dueCount: safeDue,
    newCount: safeNew,
    totalCards,
    canStart,
    isHydrating: false,
    isResume,
    title,
    actionLabel,
    objective,
  };
}
