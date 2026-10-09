// src/data/vocabularyData.ts

import type { VocabWord } from '../types';
import vocab1000Data from './vocab1000.json';
import vocab10000Data from './vocab10000.json';

/**
 * Chuẩn hóa một bản ghi từ vựng thô thành VocabWord hợp lệ
 */
export const normalizeVocabRecord = (raw: any, index: number): VocabWord => ({
  id: raw.id || `vocab_${index + 1}`,
  word: raw.word,
  ipa: raw.ipa || raw.phonetic || `/${String(raw.word || '').toLowerCase()}/`,
  phonetic: raw.phonetic || raw.ipa || `/${String(raw.word || '').toLowerCase()}/`,
  partOfSpeech: raw.partOfSpeech || 'noun',
  meaning: raw.meaning || '',
  definitionEn: raw.definitionEn || raw.example || '',
  example: raw.example || raw.exampleEn || `Example for ${raw.word}`,
  exampleEn: raw.exampleEn || raw.example || `Example for ${raw.word}`,
  exampleMeaning: raw.exampleMeaning || raw.exampleVi || '',
  exampleVi: raw.exampleVi || raw.exampleMeaning || '',
  tag: raw.tag || 'Daily',
  topic: raw.topic || 'Giao tiếp hàng ngày',
  level: raw.level || 'A1',
  category: raw.category || 'Oxford Core',
  collocations: Array.isArray(raw.collocations) ? raw.collocations : [],
  synonyms: Array.isArray(raw.synonyms) ? raw.synonyms : [],
  isFavorite: Boolean(raw.isFavorite),
  srsLevel: raw.srsLevel || 0,
  nextReviewDate: raw.nextReviewDate || new Date().toISOString(),
  interval: raw.interval || 0,
  easeFactor: raw.easeFactor || 2.5,
  lastReviewedDate: raw.lastReviewedDate,
  firstLearnedAt: raw.firstLearnedAt,
  todayNewReviewedAt: raw.todayNewReviewedAt,
  todayPoolReviewedAt: raw.todayPoolReviewedAt
});

// Hợp nhất dữ liệu tĩnh từ điển Oxford/CEFR
const rawCombined: any[] = [
  ...(vocab1000Data as any[]),
  ...(vocab10000Data as any[])
];

const dedupMap = new Map<string, VocabWord>();
let idx = 0;

for (const item of rawCombined) {
  if (item && item.word) {
    const key = String(item.word).toLowerCase().trim();
    if (!dedupMap.has(key)) {
      dedupMap.set(key, normalizeVocabRecord(item, idx++));
    }
  }
}

/**
 * Siêu Kho Toàn Diện hàng ngàn từ vựng chuẩn Oxford 3000 / 5000 / CEFR
 * Tồn tại hoàn toàn trên RAM tĩnh (In-Memory), không lưu trữ vào localStorage
 */
export const VOCAB_10000_BANK: VocabWord[] = Array.from(dedupMap.values());
export const VOCAB_5000_BANK: VocabWord[] = VOCAB_10000_BANK;
export const VOCAB_1000_BANK: VocabWord[] = (vocab1000Data as any[]).map((w, i) => normalizeVocabRecord(w, i));

// Kho từ vựng khởi tạo ban đầu cho lộ trình học SRS SM-2 cá nhân
export const INITIAL_VOCABULARY: VocabWord[] = VOCAB_10000_BANK.slice(0, 200);

/**
 * Dynamic Chunk Loader: Hỗ trợ nạp bất đồng bộ nếu muốn trì hoãn việc nạp dữ liệu
 */
export async function loadFullVocabularyChunk(): Promise<VocabWord[]> {
  return VOCAB_10000_BANK;
}
