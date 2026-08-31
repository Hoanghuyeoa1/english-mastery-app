/**
 * Tiện ích làm sạch văn bản & che từ vựng mục tiêu cho Dictation Mode
 */

export function cleanWordString(word: string): string {
  if (!word || typeof word !== 'string') return '';
  return word
    .replace(/\s*\((?:Set|Batch|Lesson|Unit|Pack)\s*\d+\)/gi, '')
    .replace(/\s*\[(?:Set|Batch|Lesson|Unit|Pack)\s*\d+\]/gi, '')
    .trim();
}

export function sanitizeExampleSentence(sentence: string, targetWord?: string): string {
  if (!sentence || typeof sentence !== 'string') {
    const cleanWord = targetWord ? cleanWordString(targetWord) : 'vocabulary';
    return `Consistent practice with ${cleanWord} enhances your English communication skills.`;
  }

  let clean = sentence
    .replace(/\s*\((?:Set|Batch|Lesson|Unit|Pack)\s*\d+\)/gi, '')
    .replace(/\s*\[(?:Set|Batch|Lesson|Unit|Pack)\s*\d+\]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim();

  // Đảm bảo có dấu kết câu
  if (clean && !/[.!?]$/.test(clean)) {
    clean += '.';
  }

  return clean;
}

export interface MaskedSentenceResult {
  maskedSentence: string;
  cleanFullSentence: string;
  targetWordClean: string;
}

/**
 * Ẩn từ mục tiêu (target word) trong câu hiển thị trên màn hình thành [ ________ ]
 * nhưng vẫn giữ nguyên câu hoàn chỉnh cleanFullSentence cho Web Speech API phát âm
 */
export function maskTargetWordInSentence(
  sentence: string,
  targetWord: string
): MaskedSentenceResult {
  const targetWordClean = cleanWordString(targetWord);
  let cleanFullSentence = sanitizeExampleSentence(sentence, targetWordClean);

  if (!targetWordClean) {
    return {
      maskedSentence: cleanFullSentence,
      cleanFullSentence,
      targetWordClean: '',
    };
  }

  // Escape special regex characters
  const escaped = targetWordClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Tìm từ mục tiêu và các biến thể hình thái học (plural, past tense, continuous, adverb)
  // Ví dụ: optimize, optimizes, optimized, optimizing
  const wordRegex = new RegExp(`\\b${escaped}(?:s|es|ed|d|ing|ly)?\\b`, 'gi');

  let maskedSentence = cleanFullSentence.replace(wordRegex, '[ ________ ]');

  // Nếu câu chưa chứa từ mục tiêu (ví dụ ví dụ không khớp từ), tạo câu chuẩn có chứa chỗ trống
  if (maskedSentence === cleanFullSentence) {
    maskedSentence = `Please listen and complete the sentence: "We need to [ ________ ] for optimal results."`;
    cleanFullSentence = `Please listen and complete the sentence: We need to ${targetWordClean} for optimal results.`;
  }

  return {
    maskedSentence,
    cleanFullSentence,
    targetWordClean,
  };
}
