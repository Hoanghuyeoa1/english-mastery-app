import type { VocabWord } from '../types';
import vocab1000Data from './vocab1000.json';
import vocab10000Data from './vocab10000.json';

// Siêu Kho Toàn Diện hàng ngàn từ vựng đa chủ đề (Tech, IELTS, TOEIC, Business, Academic, Daily, Idioms)
const rawCombined: VocabWord[] = [
  ...(vocab1000Data as VocabWord[]),
  ...(vocab10000Data as VocabWord[]),
];

const dedupMap = new Map<string, VocabWord>();
for (const item of rawCombined) {
  if (item && item.word) {
    const key = item.word.toLowerCase().trim();
    if (!dedupMap.has(key)) {
      dedupMap.set(key, item);
    }
  }
}

export const VOCAB_10000_BANK: VocabWord[] = Array.from(dedupMap.values());
export const VOCAB_5000_BANK: VocabWord[] = VOCAB_10000_BANK;
export const VOCAB_1000_BANK: VocabWord[] = (vocab1000Data as VocabWord[]);

// Kho từ vựng khởi tạo ban đầu cho lộ trình học SRS SM-2 cá nhân
export const INITIAL_VOCABULARY: VocabWord[] = VOCAB_10000_BANK.slice(0, 200);
