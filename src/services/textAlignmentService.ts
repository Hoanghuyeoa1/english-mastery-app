import type {
  WordMatchStatus,
  ShadowingWordResult,
  ShadowingFeedback,
} from '../types';

/**
 * Danh sách các từ đệm/từ rác phổ biến trong hội thoại và nhận diện giọng nói
 */
export const FILLER_WORDS = new Set([
  'um',
  'uh',
  'er',
  'ah',
  'hmm',
  'like',
  'yeah',
  'yep',
  'actually',
  'well',
  'oh',
  'okay',
  'ok',
]);

/**
 * Ánh xạ chữ số sang dạng chữ để hỗ trợ so khớp nhận diện giọng nói
 */
const NUMBER_WORDS: Record<string, string> = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
  '10': 'ten',
};

// Scratch buffers for zero-allocation Levenshtein distance calculations
const LEV_ROW_A = new Int32Array(128);
const LEV_ROW_B = new Int32Array(128);

/**
 * Tính khoảng cách Levenshtein giữa 2 chuỗi từ với bộ đệm tái sử dụng
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  const aLen = a.length;
  const bLen = b.length;
  if (!aLen) return bLen;
  if (!bLen) return aLen;

  if (bLen >= 128) {
    let prev = new Int32Array(bLen + 1);
    let curr = new Int32Array(bLen + 1);
    for (let j = 0; j <= bLen; j++) prev[j] = j;
    for (let i = 1; i <= aLen; i++) {
      curr[0] = i;
      const aChar = a.charCodeAt(i - 1);
      for (let j = 1; j <= bLen; j++) {
        const cost = aChar === b.charCodeAt(j - 1) ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      }
      const t = prev;
      prev = curr;
      curr = t;
    }
    return prev[bLen];
  }

  let prev = LEV_ROW_A;
  let curr = LEV_ROW_B;

  for (let j = 0; j <= bLen; j++) prev[j] = j;

  for (let i = 1; i <= aLen; i++) {
    curr[0] = i;
    const aChar = a.charCodeAt(i - 1);
    for (let j = 1; j <= bLen; j++) {
      const bChar = b.charCodeAt(j - 1);
      const cost = aChar === bChar ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const temp = prev;
    prev = curr;
    curr = temp;
  }

  return prev[bLen];
}

/**
 * Tính độ tương đồng giữa 2 từ (0.0 đến 1.0)
 */
export function calculateWordSimilarity(expected: string, actual: string): number {
  if (expected === actual) return 1;
  const maxLen = Math.max(expected.length, actual.length);
  if (maxLen === 0) return 1;
  const dist = levenshteinDistance(expected, actual);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Kiểm tra xem từ có phải là từ đệm rác không
 */
export function isFillerWord(word: string): boolean {
  return FILLER_WORDS.has(word.toLowerCase());
}

/**
 * Chuẩn hóa chuỗi văn bản:
 * - Xóa sạch dấu câu (`.,!?;:"'—` và các ký tự đặc biệt)
 * - Xóa khoảng trắng thừa
 * - Chuyển về chữ thường
 * - Tách thành mảng token
 */
export function normalizeText(text: string): string[] {
  if (!text || typeof text !== 'string') return [];

  const cleaned = text
    .toLowerCase()
    .replace(/[—–_\/\\|()[\]{}<>@#$%^&*+=~`]/g, ' ')
    .replace(/[.,!?;:"“”]/g, ' ')
    .replace(/['’]/g, '')
    .trim();

  if (!cleaned) return [];
  return cleaned.split(/\s+/).filter(token => token.length > 0);
}

// DP Backtracking Actions
const ACTION_MATCH = 1;
const ACTION_SUB = 2;
const ACTION_DELETE = 3;
const ACTION_INSERT = 4;

/**
 * Thuật toán so khớp chuỗi từ vựng theo thời gian thực (Word-level Sequence Alignment)
 * Sử dụng Dynamic Programming (Needleman-Wunsch / Levenshtein alignment)
 *
 * @param targetSentence Câu gốc mẫu cần luyện đọc
 * @param spokenTranscript Bản ghi âm / nhận diện giọng nói thực tế từ người dùng
 * @returns ShadowingFeedback Chi tiết điểm số và trạng thái từng từ
 */
export function alignSpokenWords(targetSentence: string, spokenTranscript: string): ShadowingFeedback {
  const targetTokens = normalizeText(targetSentence);
  const spokenTokens = normalizeText(spokenTranscript);

  const N = targetTokens.length;
  const M = spokenTokens.length;

  // Trường hợp không có câu mẫu
  if (N === 0) {
    return {
      accuracyScore: 0,
      fluencyScore: 0,
      completedWords: 0,
      totalWords: 0,
      wordResults: spokenTokens.map(word => ({
        word,
        status: 'extra' as WordMatchStatus,
      })),
      transcript: spokenTranscript,
    };
  }

  // Trường hợp người dùng chưa nói gì
  if (M === 0) {
    return {
      accuracyScore: 0,
      fluencyScore: 0,
      completedWords: 0,
      totalWords: N,
      wordResults: targetTokens.map(word => ({
        word,
        expectedWord: word,
        status: 'missing' as WordMatchStatus,
        confidence: 0,
      })),
      transcript: spokenTranscript,
    };
  }

  const cols = M + 1;
  const dp = new Float32Array((N + 1) * cols);
  const action = new Uint8Array((N + 1) * cols);

  // Khởi tạo hàng 0 và cột 0
  dp[0] = 0;
  for (let i = 1; i <= N; i++) {
    dp[i * cols] = dp[(i - 1) * cols] + 1.0;
    action[i * cols] = ACTION_DELETE;
  }

  for (let j = 1; j <= M; j++) {
    const s = spokenTokens[j - 1];
    const insCost = isFillerWord(s) ? 0.8 : 1.0;
    dp[j] = dp[j - 1] + insCost;
    action[j] = ACTION_INSERT;
  }

  // Điền bảng quy hoạch động
  for (let i = 1; i <= N; i++) {
    const t = targetTokens[i - 1];
    const rowOffset = i * cols;
    const prevRowOffset = (i - 1) * cols;

    for (let j = 1; j <= M; j++) {
      const s = spokenTokens[j - 1];

      let diagCost: number;
      let diagAction: number;

      const isExactMatch = t === s || NUMBER_WORDS[t] === s || NUMBER_WORDS[s] === t;
      if (isExactMatch) {
        diagCost = dp[prevRowOffset + j - 1] + 0.0;
        diagAction = ACTION_MATCH;
      } else if (isFillerWord(s)) {
        // Từ đệm rác không bao giờ được thay thế cho từ chuẩn
        diagCost = dp[prevRowOffset + j - 1] + 2.5;
        diagAction = ACTION_SUB;
      } else {
        const sim = calculateWordSimilarity(t, s);
        // Từ gần âm (sim >= 0.5) có chi phí rẻ hơn thay thế hoàn toàn
        const subCost = sim >= 0.5 ? 0.4 + 0.5 * (1 - sim) : 1.2;
        diagCost = dp[prevRowOffset + j - 1] + subCost;
        diagAction = ACTION_SUB;
      }

      const delCost = dp[prevRowOffset + j] + 1.0;
      const insCost = dp[rowOffset + j - 1] + (isFillerWord(s) ? 0.8 : 1.0);

      let bestCost = diagCost;
      let bestAction = diagAction;

      if (delCost < bestCost) {
        bestCost = delCost;
        bestAction = ACTION_DELETE;
      }

      if (insCost < bestCost) {
        bestCost = insCost;
        bestAction = ACTION_INSERT;
      }

      dp[rowOffset + j] = bestCost;
      action[rowOffset + j] = bestAction;
    }
  }

  // Truy vết ngược (Backtracking) để tái tạo chuỗi kết quả
  const wordResults: ShadowingWordResult[] = [];
  let currI = N;
  let currJ = M;

  while (currI > 0 || currJ > 0) {
    const act = action[currI * cols + currJ];
    if (currI > 0 && currJ > 0 && (act === ACTION_MATCH || act === ACTION_SUB)) {
      const t = targetTokens[currI - 1];
      const s = spokenTokens[currJ - 1];
      if (act === ACTION_MATCH) {
        wordResults.push({
          word: s,
          expectedWord: t,
          status: 'correct',
          confidence: 1.0,
        });
      } else {
        const sim = calculateWordSimilarity(t, s);
        wordResults.push({
          word: s,
          expectedWord: t,
          status: 'mispronounced',
          confidence: Math.round(sim * 100) / 100,
        });
      }
      currI--;
      currJ--;
    } else if (currJ > 0 && (currI === 0 || act === ACTION_INSERT)) {
      const s = spokenTokens[currJ - 1];
      wordResults.push({
        word: s,
        status: 'extra',
      });
      currJ--;
    } else if (currI > 0 && (currJ === 0 || act === ACTION_DELETE)) {
      const t = targetTokens[currI - 1];
      wordResults.push({
        word: t,
        expectedWord: t,
        status: 'missing',
        confidence: 0,
      });
      currI--;
    } else {
      break;
    }
  }

  wordResults.reverse();

  const totalWords = N;
  const correctWords = wordResults.filter(r => r.status === 'correct').length;
  const extraWords = wordResults.filter(r => r.status === 'extra').length;

  // accuracyScore = Math.round((số từ correct / tổng số từ gốc) * 100)
  const accuracyScore = totalWords === 0 ? 0 : Math.round((correctWords / totalWords) * 100);

  // fluencyScore: điểm lưu loát tính theo accuracy và trừ điểm ngập ngừng / từ đệm thừa
  const extraPenalty = extraWords * 10;
  const fluencyScore = totalWords === 0 ? 0 : Math.max(0, Math.min(100, accuracyScore - extraPenalty));

  const completedWords = correctWords;

  return {
    accuracyScore,
    fluencyScore,
    completedWords,
    totalWords,
    wordResults,
    transcript: spokenTranscript,
  };
}
