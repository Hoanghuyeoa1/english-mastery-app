import type { VocabWord } from '../types';
import vocab10000Data from './vocab10000.json';

// Siêu Kho Toàn Diện 10.600+ từ vựng (Tra cứu Siêu Từ Điển Live & Arcade)
export const VOCAB_10000_BANK: VocabWord[] = (vocab10000Data as VocabWord[]);
export const VOCAB_5000_BANK: VocabWord[] = (vocab10000Data as VocabWord[]);
export const VOCAB_1000_BANK: VocabWord[] = (vocab10000Data as VocabWord[]);

// Kho từ vựng khởi tạo ban đầu cho lộ trình học SRS SM-2 cá nhân (120 từ cốt lõi chuẩn)
// Tránh việc lưu 10.600 từ (~10MB) vào LocalStorage làm vượt quá hạn ngạch 5MB của trình duyệt
export const INITIAL_VOCABULARY: VocabWord[] = (vocab10000Data as VocabWord[]).slice(0, 150);
