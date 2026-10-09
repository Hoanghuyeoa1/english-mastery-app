import type { VocabWord, CollocationItem, SRSProgress, SRSReviewCard, VocabItemType } from '../types';
import { VOCAB_10000_BANK } from '../data/vocabularyData';

// Hàm kết hợp RAM static bank 10.600 từ + custom words + srsProgressMap
export function composeVocabularyList(
  srsMap: Record<string, SRSProgress> = {},
  customWords: VocabWord[] = []
): VocabWord[] {
  const combined = [...customWords, ...VOCAB_10000_BANK];
  const uniqueMap = new Map<string, VocabWord>();

  for (let i = 0; i < combined.length; i++) {
    const w = combined[i];
    const key = w.word.toLowerCase().trim();
    if (!uniqueMap.has(key)) {
      const progress = srsMap[w.id] ?? (key ? srsMap[key] : undefined);
      if (progress) {
        uniqueMap.set(key, {
          ...w,
          srsLevel: progress.srsLevel ?? w.srsLevel ?? 0,
          nextReviewDate: progress.nextReviewDate || w.nextReviewDate || new Date().toISOString(),
          interval: progress.interval ?? w.interval ?? 0,
          easeFactor: progress.easeFactor ?? w.easeFactor ?? 2.5,
          lastReviewedDate: progress.lastReviewedDate || w.lastReviewedDate,
          firstLearnedAt: progress.firstLearnedAt || w.firstLearnedAt,
          todayNewReviewedAt: progress.todayNewReviewedAt || w.todayNewReviewedAt,
          todayPoolReviewedAt: progress.todayPoolReviewedAt || w.todayPoolReviewedAt,
          isFavorite: progress.isFavorite ?? w.isFavorite ?? false,
          fsrs: progress.fsrs ?? w.fsrs,
          againCount: progress.againCount ?? w.againCount,
          reviewCount: progress.reviewCount ?? w.reviewCount,
        });
      } else {
        uniqueMap.set(key, w);
      }
    }
  }

  return Array.from(uniqueMap.values());
}

let _cachedVocabList: VocabWord[] | null = null;
let _cachedCollocList: CollocationItem[] | null = null;
let _cachedSrsMap: Record<string, SRSProgress> | null = null;
let _cachedUnifiedCards: SRSReviewCard[] | null = null;

export function clearUnifiedCardsCache(): void {
  _cachedVocabList = null;
  _cachedCollocList = null;
  _cachedSrsMap = null;
  _cachedUnifiedCards = null;
}

export function buildUnifiedSRSCards(
  vocabList: VocabWord[],
  collocationList: CollocationItem[],
  srsMap: Record<string, SRSProgress>
): SRSReviewCard[] {
  if (
    _cachedUnifiedCards &&
    _cachedVocabList === vocabList &&
    _cachedCollocList === collocationList &&
    _cachedSrsMap === srsMap
  ) {
    return _cachedUnifiedCards;
  }

  const vocabCards: SRSReviewCard[] = vocabList.map((vocab) => {
    const srs = srsMap[vocab.id] || srsMap[vocab.word.toLowerCase().trim()];
    return {
      id: vocab.id,
      type: 'single_word' as const,
      primaryText: vocab.word,
      word: vocab.word,
      phonetic: vocab.phonetic || vocab.ipa,
      ipa: vocab.phonetic || vocab.ipa,
      meaning: vocab.meaning,
      exampleEn: vocab.exampleEn || vocab.example || '',
      example: vocab.exampleEn || vocab.example || '',
      exampleVi: vocab.exampleVi,
      contextTag: vocab.topic || vocab.category || vocab.tag,
      tag: vocab.tag,
      level: vocab.level,
      topic: vocab.topic,
      partOfSpeech: vocab.partOfSpeech || vocab.pos,
      definitionEn: vocab.definitionEn,
      exampleMeaning: vocab.exampleMeaning,
      collocations: vocab.collocations,
      synonyms: vocab.synonyms,
      srsLevel: srs?.srsLevel ?? vocab.srsLevel ?? 0,
      nextReviewDate: srs?.nextReviewDate ?? vocab.nextReviewDate ?? new Date(0).toISOString(),
      interval: srs?.interval ?? vocab.interval ?? 0,
      easeFactor: srs?.easeFactor ?? vocab.easeFactor ?? 2.5,
      isFavorite: srs?.isFavorite ?? vocab.isFavorite ?? false,
      lastReviewedDate: srs?.lastReviewedDate ?? vocab.lastReviewedDate,
      fsrs: srs?.fsrs,
      againCount: srs?.againCount ?? vocab.againCount,
      reviewCount: srs?.reviewCount ?? vocab.reviewCount,
    };
  });

  const collocationCards: SRSReviewCard[] = collocationList.map((colloc) => {
    const srs = srsMap[colloc.id];
    const hasIdiomTag = colloc.tags?.some((t) => t.toLowerCase().includes('idiom'));
    const hasPhrasalTag = colloc.tags?.some((t) => t.toLowerCase().includes('phrasal'));
    const type: VocabItemType = hasIdiomTag ? 'idiom' : hasPhrasalTag ? 'phrasal_verb' : 'collocation';

    return {
      id: colloc.id,
      type,
      primaryText: colloc.phrase,
      word: colloc.phrase,
      phonetic: undefined,
      ipa: '',
      meaning: colloc.meaning,
      exampleEn: colloc.exampleEn,
      example: colloc.exampleEn,
      exampleVi: colloc.exampleVi,
      contextTag: colloc.usageContext || colloc.tags?.[0],
      tag: type === 'idiom' ? 'Idioms' : 'Daily',
      srsLevel: srs?.srsLevel ?? 0,
      nextReviewDate: srs?.nextReviewDate ?? colloc.createdAt,
      interval: srs?.interval ?? 1,
      easeFactor: srs?.easeFactor ?? 2.5,
      isFavorite: srs?.isFavorite ?? false,
      lastReviewedDate: srs?.lastReviewedDate,
      fsrs: srs?.fsrs,
      againCount: srs?.againCount,
      reviewCount: srs?.reviewCount,
    };
  });

  _cachedVocabList = vocabList;
  _cachedCollocList = collocationList;
  _cachedSrsMap = srsMap;
  _cachedUnifiedCards = [...vocabCards, ...collocationCards];
  return _cachedUnifiedCards;
}
