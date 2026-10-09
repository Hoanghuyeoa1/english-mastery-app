import type { VocabWord } from '../types';
import { getDictionaryWord } from './dictionaryIndex';
import { VOCAB_10000_BANK } from '../data/vocabularyData';

// Leading and trailing punctuation characters to be stripped
const LEADING_PUNCTUATION_REGEX = /^[.,!?;:"'()[\]{}«»“”‘’—–_/<\\>@#$%^&*~`|]+/;
const TRAILING_PUNCTUATION_REGEX = /[.,!?;:"'()[\]{}«»“”‘’—–_/<\\>@#$%^&*~`|]+$/;

/**
 * Làm sạch một từ/token trích xuất từ văn bản:
 * - Xóa sạch các dấu câu ở đầu và cuối: `.,!?;:"'()[]{}«»“”‘’—–_/\<>@#$%^&*~`|`
 * - Chuẩn hóa: trim và chuyển về chữ thường (lowercase)
 * - Giữ nguyên các ký tự bên trong từ (ví dụ: dấu nối, dấu nháy đơn trong it's/don't)
 */
export function cleanWordToken(rawWord: string): string {
  if (!rawWord || typeof rawWord !== 'string') return '';

  return rawWord
    .trim()
    .toLowerCase()
    .replace(LEADING_PUNCTUATION_REGEX, '')
    .replace(TRAILING_PUNCTUATION_REGEX, '')
    .trim();
}

/**
 * Sinh danh sách các từ gốc khả dĩ (Stem Candidates) dựa trên quy tắc hình thái học tiếng Anh:
 * 1. Số nhiều / Ngôi thứ 3 số ít: -ies -> y, -ves -> fe/f, -es, -s
 * 2. Quá khứ / Quá khứ phân từ: -ied -> y, -ed, -d, gấp đôi phụ âm
 * 3. Tiếp diễn / Danh động từ: -ing, -ing -> e, gấp đôi phụ âm, -ying -> ie
 * 4. Trạng từ: -ily -> y, -ly, -ply -> ple, -bly -> ble
 * 5. So sánh hơn / nhất: -ier -> y, -iest -> y, -er, -est
 */
export function getStemCandidates(word: string): string[] {
  const candidates: string[] = [];
  const added = new Set<string>();

  const add = (cand: string) => {
    if (cand && cand !== word && cand.length >= 2 && !added.has(cand)) {
      added.add(cand);
      candidates.push(cand);
    }
  };

  const len = word.length;

  // 1. Sở hữu cách ('s hoặc s')
  if (word.endsWith("'s") && len > 3) {
    add(word.slice(0, -2));
  } else if (word.endsWith("s'") && len > 3) {
    add(word.slice(0, -2));
    add(word.slice(0, -1));
  }

  // 2. Danh từ số nhiều / Động từ ngôi thứ 3 số ít
  // e.g. technologies -> technology, cities -> city
  if (word.endsWith('ies') && len > 4) {
    add(word.slice(0, -3) + 'y');
    add(word.slice(0, -1)); // e.g. pies -> pie, ties -> tie
  }

  // e.g. knives -> knife, leaves -> leaf
  if (word.endsWith('ves') && len > 4) {
    add(word.slice(0, -3) + 'fe');
    add(word.slice(0, -3) + 'f');
  }

  // e.g. boxes -> box, watches -> watch, devices -> device
  if (word.endsWith('es') && len > 3) {
    add(word.slice(0, -2)); // boxes -> box
    add(word.slice(0, -1)); // devices -> device, changes -> change
  }

  // e.g. books -> book, students -> student
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us') && len > 2) {
    add(word.slice(0, -1));
  }

  // 3. Động từ thì quá khứ / Phân từ (-ied, -ed, -d)
  // e.g. studied -> study, carried -> carry
  if (word.endsWith('ied') && len > 4) {
    add(word.slice(0, -3) + 'y');
    add(word.slice(0, -1)); // tied -> tie
  }

  if (word.endsWith('ed') && len > 3) {
    const baseWithoutEd = word.slice(0, -2);
    const baseLen = baseWithoutEd.length;

    // Gấp đôi phụ âm quy tắc CVC (stopped -> stop, planned -> plan, dropped -> drop)
    if (
      baseLen >= 3 &&
      baseWithoutEd[baseLen - 1] === baseWithoutEd[baseLen - 2] &&
      !['ss', 'll', 'ff', 'zz'].includes(baseWithoutEd.slice(-2))
    ) {
      add(baseWithoutEd.slice(0, -1));
    }

    add(baseWithoutEd);     // worked -> work, played -> play
    add(word.slice(0, -1)); // created -> create, liked -> like
  }

  // 4. Tiếp diễn / Danh động từ (-ing)
  if (word.endsWith('ing') && len > 4) {
    const baseWithoutIng = word.slice(0, -3);
    const baseLen = baseWithoutIng.length;

    // Gấp đôi phụ âm quy tắc CVC (running -> run, swimming -> swim, planning -> plan)
    if (
      baseLen >= 3 &&
      baseWithoutIng[baseLen - 1] === baseWithoutIng[baseLen - 2] &&
      !['ss', 'll', 'ff', 'zz'].includes(baseWithoutIng.slice(-2))
    ) {
      add(baseWithoutIng.slice(0, -1));
    }

    add(baseWithoutIng);       // playing -> play, working -> work
    add(baseWithoutIng + 'e');  // making -> make, creating -> create, writing -> write

    // e.g. dying -> die, lying -> lie
    if (word.endsWith('ying') && len >= 5) {
      add(word.slice(0, -4) + 'ie');
    }
  }

  // 5. Trạng từ đuôi -ly
  if (word.endsWith('ly') && len > 4) {
    if (word.endsWith('ily') && len > 5) {
      add(word.slice(0, -3) + 'y'); // happily -> happy, easily -> easy
    }
    add(word.slice(0, -2)); // quickly -> quick
    if (word.endsWith('ply')) {
      add(word.slice(0, -3) + 'ple'); // simply -> simple
    }
    if (word.endsWith('bly')) {
      add(word.slice(0, -3) + 'ble'); // probably -> probable
    }
  }

  // 6. Tính từ so sánh hơn / nhất (-er, -est, -ier, -iest)
  if (word.endsWith('ier') && len > 4) {
    add(word.slice(0, -3) + 'y'); // easier -> easy
  }
  if (word.endsWith('iest') && len > 5) {
    add(word.slice(0, -4) + 'y'); // easiest -> easy
  }
  if (word.endsWith('er') && len > 3) {
    const base = word.slice(0, -2);
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      add(base.slice(0, -1)); // bigger -> big
    }
    add(base);
    add(word.slice(0, -1)); // larger -> large
  }
  if (word.endsWith('est') && len > 4) {
    const base = word.slice(0, -3);
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      add(base.slice(0, -1)); // biggest -> big
    }
    add(base);
    add(word.slice(0, -2)); // largest -> large
  }

  return candidates;
}

/**
 * Tra cứu từ vựng siêu tốc từ ngữ cảnh đọc hiểu:
 * - Bước 1: Exact match với từ đã làm sạch (O(1)).
 * - Bước 2: Thử các biến thể gốc từ (Morphological Stemming Heuristics).
 * - Bước 3: Trả về VocabWord hoặc null nếu không tồn tại.
 * - Thời gian thực thi: < 2ms trên RAM.
 */
export function lookupContextWord(rawWord: string): VocabWord | null {
  const clean = cleanWordToken(rawWord);
  if (!clean) return null;

  // Bước 1: Khớp chính xác 100% trong RAM Index - O(1)
  const exactMatch = getDictionaryWord(clean);
  if (exactMatch) {
    return exactMatch;
  }

  // Bước 2: Thử các biến thể gốc từ (Stemming Heuristics)
  const candidates = getStemCandidates(clean);
  for (let i = 0; i < candidates.length; i++) {
    const matchedWord = getDictionaryWord(candidates[i]);
    if (matchedWord) {
      return matchedWord;
    }
  }

  // Bước 3: Không tìm thấy từ trong từ điển (tên riêng, số, từ không có)
  return null;
}

/**
 * Trích xuất câu ngữ cảnh bao quanh từ/token trong văn bản đọc hiểu:
 * - Hỗ trợ cả content string lẫn tokens mảng
 * - Nhận diện điểm kết thúc câu: dấu chấm (.), chấm than (!), hỏi chấm (?)
 * - Bỏ qua các từ viết tắt phổ biến (Mr., Dr., etc.)
 * - Dừng tại ranh giới đoạn văn (xuống dòng \n) để ngữ cảnh không bị tràn qua đoạn khác
 * - Làm sạch và trả về câu hoàn chỉnh chứa từ
 */
export function extractSentenceContext(
  contentOrTokens: string | string[],
  target: string | number
): string {
  let tokens: string[];
  let tokenIndex = -1;

  if (Array.isArray(contentOrTokens)) {
    tokens = contentOrTokens;
    if (typeof target === 'number') {
      tokenIndex = target;
    } else {
      const cleanTarget = cleanWordToken(target);
      tokenIndex = tokens.findIndex((t) => cleanWordToken(t) === cleanTarget);
    }
  } else if (typeof contentOrTokens === 'string') {
    tokens = contentOrTokens.split(/(\s+)/);
    if (typeof target === 'number') {
      tokenIndex = target;
    } else {
      const cleanTarget = cleanWordToken(target);
      tokenIndex = tokens.findIndex((t) => cleanWordToken(t) === cleanTarget);
    }
  } else {
    return '';
  }

  if (tokenIndex < 0 || tokenIndex >= tokens.length) {
    return '';
  }

  const isSentenceEndToken = (tok: string): boolean => {
    if (!tok) return false;
    if (tok.includes('\n\n') || tok.includes('\r\n\r\n')) return true;
    const trimmed = tok.trim();
    return /[.!?]$/.test(trimmed) && !/^(mr|mrs|ms|dr|prof|vs|etc|e\.g|i\.e)\.$/i.test(trimmed);
  };

  // Walk backward to find sentence start
  let start = tokenIndex;
  while (start > 0) {
    const prev = tokens[start - 1];
    if (isSentenceEndToken(prev)) {
      break;
    }
    start--;
  }

  // Walk forward to find sentence end
  let end = tokenIndex;
  while (end < tokens.length - 1) {
    const curr = tokens[end];
    if (isSentenceEndToken(curr)) {
      break;
    }
    end++;
  }

  return tokens.slice(start, end + 1).join('').trim();
}

export interface CanonicalVocabResolution {
  canonicalId: string;
  canonicalWord: VocabWord;
  isExistingInBank: boolean;
}

/**
 * Shared Canonical Vocabulary Resolver:
 * - Chuẩn hóa từ vựng (clean, lowercase, trim)
 * - Tra cứu xem từ đã có trong Từ điển chuẩn Oxford/CEFR (10.400+ từ) hoặc kho từ vựng hiện tại chưa
 * - Nếu từ trùng với từ điển tĩnh: Luôn gán và trả về Canonical System ID (vocab_..., ext_...), bất kể đầu vào có custom ID
 * - Nếu từ là từ cá nhân/custom thực sự: Dùng custom ID (custom_${cleanWord})
 * - Bảo đảm Invariant: Cùng 1 normalized English word không bao giờ có 2 identity khác nhau trong SRS.
 */
export function resolveCanonicalVocab(
  wordOrInput: Partial<VocabWord> | string,
  vocabularyList: VocabWord[] = []
): CanonicalVocabResolution | null {
  const isString = typeof wordOrInput === 'string';
  let targetWord = isString ? wordOrInput : wordOrInput.word;
  let targetId = !isString ? wordOrInput.id : undefined;

  // Nếu input là ID string (ví dụ vocab_123, ext_tech_1, custom_abc), đối chiếu tìm từ trong kho tĩnh hoặc vocabularyList
  if (isString && (wordOrInput.startsWith('vocab_') || wordOrInput.startsWith('ext_') || wordOrInput.startsWith('custom_'))) {
    const itemById = VOCAB_10000_BANK.find((v) => v.id === wordOrInput) ||
                     vocabularyList.find((v) => v.id === wordOrInput);
    if (itemById) {
      targetId = itemById.id;
      targetWord = itemById.word;
    }
  }

  const cleanWord = cleanWordToken(targetWord || '');
  if (!cleanWord) return null;

  // 1. ƯU TIÊN SỐ 1: Kiểm tra từ điển chuẩn Oxford/CEFR (10.400+ từ) & Static Bank
  // Bất kể input có mang random/custom ID (ví dụ custom_99999), nếu từ trùng với từ điển tĩnh,
  // BẮT BUỘC phải ưu tiên Canonical System ID (vocab_..., ext_...)
  let staticWord = getDictionaryWord(cleanWord) || 
                   VOCAB_10000_BANK.find((v) => v.word.toLowerCase().trim() === cleanWord);

  // Thử giải quyết thông qua morphological stemming heuristics (e.g. "maintained", "maintaining" -> "maintain")
  if (!staticWord) {
    const stemmed = lookupContextWord(cleanWord);
    if (stemmed) {
      staticWord = stemmed;
    }
  }

  if (staticWord) {
    const merged: VocabWord = {
      ...staticWord,
      ...(!isString ? wordOrInput : {}),
      id: staticWord.id,
      word: staticWord.word || cleanWord,
    };
    return {
      canonicalId: staticWord.id,
      canonicalWord: merged,
      isExistingInBank: true,
    };
  }

  // 2. Kiểm tra trong vocabularyList RAM hiện tại (cho trường hợp từ custom đã từng được thêm trước đó)
  const existingCustom = vocabularyList.find(
    (v) => (targetId && v.id === targetId) || (v.word && v.word.toLowerCase().trim() === cleanWord)
  );

  if (existingCustom) {
    const merged: VocabWord = {
      ...existingCustom,
      ...(!isString ? wordOrInput : {}),
      id: existingCustom.id,
      word: existingCustom.word || cleanWord,
    };
    return {
      canonicalId: existingCustom.id,
      canonicalWord: merged,
      isExistingInBank: false,
    };
  }

  // 3. Từ custom thực sự chưa có trong bất kỳ từ điển nào
  const customId = (targetId && !targetId.startsWith('custom_undefined')) 
    ? targetId 
    : `custom_${cleanWord}`;
  const nowIso = new Date().toISOString();
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + 1);

  const newCustomWord: VocabWord = {
    ...(!isString ? wordOrInput : {}),
    id: customId,
    word: cleanWord,
    ipa: (!isString ? (wordOrInput.ipa || wordOrInput.phonetic) : undefined) || `/${cleanWord}/`,
    partOfSpeech: (!isString ? (wordOrInput.partOfSpeech || wordOrInput.pos) : undefined) || 'noun',
    meaning: (!isString ? wordOrInput.meaning : undefined) || 'Từ vựng cá nhân',
    example: (!isString ? (wordOrInput.example || wordOrInput.exampleEn) : undefined) || `Example with ${cleanWord}`,
    exampleEn: (!isString ? (wordOrInput.exampleEn || wordOrInput.example) : undefined) || `Example with ${cleanWord}`,
    tag: (!isString && wordOrInput.tag) || 'Daily',
    srsLevel: 0,
    interval: 1,
    easeFactor: 2.5,
    nextReviewDate: nextDate.toISOString(),
  };

  return {
    canonicalId: customId,
    canonicalWord: newCustomWord,
    isExistingInBank: false,
  };
}

