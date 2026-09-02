import type { VocabWord } from '../types';
import vocab1000Data from './vocab1000.json';
import vocab10000Data from './vocab10000.json';

const normalizeWord = (raw: any, index: number): VocabWord => ({
  id: raw.id || `vocab_${index + 1}`,
  word: raw.word,
  ipa: raw.ipa || raw.phonetic || '',
  phonetic: raw.phonetic || raw.ipa || '',
  partOfSpeech: raw.partOfSpeech || 'noun',
  meaning: raw.meaning || '',
  definitionEn: raw.definitionEn || '',
  example: raw.example || raw.exampleEn || `Example for ${raw.word}`,
  exampleEn: raw.exampleEn || raw.example || `Example for ${raw.word}`,
  exampleMeaning: raw.exampleMeaning || raw.exampleVi || '',
  exampleVi: raw.exampleVi || raw.exampleMeaning || '',
  tag: raw.tag || 'Daily',
  topic: raw.topic || 'Giao tiếp hàng ngày',
  level: raw.level || 'A1',
  category: raw.category,
  collocations: raw.collocations || [],
  synonyms: raw.synonyms || [],
  isFavorite: !!raw.isFavorite,
  srsLevel: raw.srsLevel || 0,
  nextReviewDate: raw.nextReviewDate || new Date().toISOString(),
  interval: raw.interval || 0,
  easeFactor: raw.easeFactor || 2.5,
  lastReviewedDate: raw.lastReviewedDate,
  firstLearnedAt: raw.firstLearnedAt
});

// Siêu Kho Toàn Diện hàng ngàn từ vựng chuẩn Oxford 3000 / CEFR
const rawCombined: any[] = [
  ...(vocab1000Data as any[]),
  ...(vocab10000Data as any[]),
];

const dedupMap = new Map<string, VocabWord>();
let idx = 0;
for (const item of rawCombined) {
  if (item && item.word) {
    const key = item.word.toLowerCase().trim();
    if (!dedupMap.has(key)) {
      dedupMap.set(key, normalizeWord(item, idx++));
    }
  }
}

export const VOCAB_10000_BANK: VocabWord[] = Array.from(dedupMap.values());
export const VOCAB_5000_BANK: VocabWord[] = VOCAB_10000_BANK;
export const VOCAB_1000_BANK: VocabWord[] = (vocab1000Data as any[]).map((w, i) => normalizeWord(w, i));

// Kho từ vựng khởi tạo ban đầu cho lộ trình học SRS SM-2 cá nhân
export const INITIAL_VOCABULARY: VocabWord[] = VOCAB_10000_BANK.slice(0, 200);
