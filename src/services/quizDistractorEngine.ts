// src/services/quizDistractorEngine.ts
import { VocabWord, MistakeRecord, CEFRLevel, AdaptiveDifficultyTier } from '../types';
import { cleanWordString, cleanMeaningForScramble } from './textSanitizer';
import { cleanWordToken } from './wordLookupService';
import { derivePersonalizedConfusions, getCommonlyConfusedWords } from './wordConfusionService';

export interface DistractorOptions {
  mistakeBank?: Record<string, MistakeRecord>;
  difficultyTier?: AdaptiveDifficultyTier;
  preferredPos?: string;
  learnerCefr?: CEFRLevel | null;
  seed?: number | string;
}

const CEFR_ORDER: Record<string, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

/**
 * Enhanced Distractor Engine (Phase 2):
 * Trích xuất n phương án sai (distractors) chất lượng cao, bảo đảm:
 * 1. Single-Correct Invariant: Không bao giờ trùng với nghĩa chuẩn của targetWord.
 * 2. Uniqueness Invariant: Tất cả các phương án đều riêng biệt.
 * 3. Personalized Confusion Priority: Ưu tiên các cặp từ learner thực sự từng nhầm lẫn trong Mistake Bank.
 * 4. Linguistic Fidelity: Ưu tiên từ cùng từ loại (Part of Speech) và cấp độ CEFR tương đồng khi ở mức Hard/Advanced.
 * 5. Fallback An Toàn: Nếu thiếu bằng chứng, tự động lấy từ primaryPool và secondaryPool.
 */
export const getDistractorMeanings = (
  targetWord: VocabWord,
  primaryPool: VocabWord[],
  secondaryPool: VocabWord[],
  count: number = 3,
  options?: DistractorOptions
): string[] => {
  if (!targetWord || !targetWord.word) {
    return [];
  }

  const targetMeaning = cleanMeaningForScramble(targetWord.meaning, targetWord.word);
  const targetWordClean = cleanWordString(targetWord.word).toLowerCase();
  const targetLemma = cleanWordToken(targetWord.word);
  const targetPos = (options?.preferredPos || targetWord.partOfSpeech || targetWord.pos || '').toLowerCase().trim();
  const targetCefr = (targetWord.level || targetWord.cefr || 'B1').toUpperCase().trim();
  const targetCefrRank = CEFR_ORDER[targetCefr] ?? 3;

  const difficultyTier = options?.difficultyTier || 'normal';
  const shouldPrioritizePos = difficultyTier === 'hard' || difficultyTier === 'advanced' || targetPos.length > 0;

  const distractors = new Set<string>();
  const usedWords = new Set<string>([targetWordClean, targetLemma]);

  // Hợp nhất một bản đồ tra cứu nhanh từ kho từ có sẵn
  const allAvailableWords = [...primaryPool, ...secondaryPool];
  const wordLookupMap = new Map<string, VocabWord>();
  for (const w of allAvailableWords) {
    if (w && w.word) {
      const cleanKey = cleanWordToken(w.word);
      if (!wordLookupMap.has(cleanKey)) {
        wordLookupMap.set(cleanKey, w);
      }
    }
  }

  // Helper an toàn để thêm một distractor
  const tryAddDistractor = (candidate?: VocabWord | null): boolean => {
    if (!candidate || !candidate.word || !candidate.meaning) return false;
    const candClean = cleanWordString(candidate.word).toLowerCase();
    const candLemma = cleanWordToken(candidate.word);

    if (usedWords.has(candClean) || usedWords.has(candLemma)) return false;

    const candMeaning = cleanMeaningForScramble(candidate.meaning, candidate.word);
    if (!candMeaning || candMeaning === targetMeaning || distractors.has(candMeaning)) {
      return false;
    }

    distractors.add(candMeaning);
    usedWords.add(candClean);
    usedWords.add(candLemma);
    return distractors.size >= count;
  };

  // 1. ƯU TIÊN SỐ 1: Bằng chứng nhầm lẫn cá nhân hóa từ Mistake Bank (Personalized Confusions)
  if (options?.mistakeBank) {
    const personalizedConfusions = derivePersonalizedConfusions(
      targetWord.word,
      targetWord.id,
      options.mistakeBank,
      5
    );

    for (const conf of personalizedConfusions) {
      const matchedWord = wordLookupMap.get(cleanWordToken(conf.word));
      if (matchedWord) {
        if (tryAddDistractor(matchedWord)) {
          return Array.from(distractors);
        }
      }
    }
  }

  // 2. ƯU TIÊN SỐ 2: Các cặp từ dễ gây nhầm lẫn chuẩn ngữ liệu (Static Commonly Confused)
  const staticConfused = getCommonlyConfusedWords(targetWord.word);
  for (const wordText of staticConfused) {
    const matchedWord = wordLookupMap.get(cleanWordToken(wordText));
    if (matchedWord) {
      if (tryAddDistractor(matchedWord)) {
        return Array.from(distractors);
      }
    }
  }

  // 3. ƯU TIÊN SỐ 3: Các từ cùng từ loại (Same POS) & CEFR tương đương
  if (shouldPrioritizePos) {
    const samePosCandidates = allAvailableWords.filter((w) => {
      if (!w || !w.word) return false;
      const wPos = (w.partOfSpeech || w.pos || '').toLowerCase().trim();
      return wPos === targetPos;
    });

    // Sắp xếp các từ cùng POS theo độ gần gũi CEFR nếu ở mức Hard/Advanced
    const sortedSamePos = [...samePosCandidates].sort((a, b) => {
      const aRank = CEFR_ORDER[(a.level || a.cefr || 'B1').toUpperCase().trim()] ?? 3;
      const bRank = CEFR_ORDER[(b.level || b.cefr || 'B1').toUpperCase().trim()] ?? 3;
      const diffA = Math.abs(aRank - targetCefrRank);
      const diffB = Math.abs(bRank - targetCefrRank);
      return diffA - diffB;
    });

    for (const item of sortedSamePos) {
      if (tryAddDistractor(item)) {
        return Array.from(distractors);
      }
    }
  }

  // 4. ƯU TIÊN SỐ 4: Lấy từ primaryPool (ví dụ: các từ bẫy lỗi khác)
  const shuffledPrimary = [...primaryPool].sort(() => 0.5 - Math.random());
  for (const item of shuffledPrimary) {
    if (tryAddDistractor(item)) {
      return Array.from(distractors);
    }
  }

  // 5. ƯU TIÊN SỐ 5: Fallback sang secondaryPool (kho tổng) nếu vẫn chưa đủ count
  if (distractors.size < count) {
    const shuffledSecondary = [...secondaryPool].sort(() => 0.5 - Math.random());
    for (const item of shuffledSecondary) {
      if (tryAddDistractor(item)) {
        return Array.from(distractors);
      }
    }
  }

  return Array.from(distractors);
};
