import { VocabWord, VocabTag } from '../types';
import { VOCAB_10000_BANK } from '../data/defaultVocab';
import { EXTENDED_DICTIONARY_DATA } from '../data/fullDictionaryData';

export interface DictionarySearchResult {
  item: VocabWord;
  matchType: 'exact' | 'prefix' | 'contains' | 'meaning';
}

// Hợp nhất Siêu Từ Điển Toàn Diện 10.500+ từ
let _combinedDictionary: VocabWord[] = [];
const _wordMap = new Map<string, VocabWord>();
const _prefixIndex = new Map<string, number[]>(); // prefix -> array of indices in _combinedDictionary

function initializeDictionary() {
  if (_combinedDictionary.length > 0) return;

  const map = new Map<string, VocabWord>();

  // 1. Thêm bộ 10.000+ từ cốt lõi
  VOCAB_10000_BANK.forEach((w) => {
    map.set(w.word.toLowerCase().trim(), w);
  });

  // 2. Thêm bộ từ mở rộng toàn diện (Oxford 3000, IELTS, TOEIC, Tech, Daily)
  EXTENDED_DICTIONARY_DATA.forEach((w) => {
    const key = w.word.toLowerCase().trim();
    if (!map.has(key)) {
      map.set(key, w);
    }
  });

  _combinedDictionary = Array.from(map.values());

  // 3. Xây dựng Prefix Indexing siêu tốc (O(1) lookup)
  _combinedDictionary.forEach((w, idx) => {
    const key = w.word.toLowerCase().trim();
    _wordMap.set(key, w);

    // Index các tiền tố độ dài từ 1 đến 6
    const maxLen = Math.min(key.length, 6);
    for (let len = 1; len <= maxLen; len++) {
      const prefix = key.substring(0, len);
      let list = _prefixIndex.get(prefix);
      if (!list) {
        list = [];
        _prefixIndex.set(prefix, list);
      }
      list.push(idx);
    }
  });
}

/**
 * Tra cứu Siêu Từ Điển Offline với tốc độ < 5ms
 * @param query Từ khóa tiếng Anh hoặc tiếng Việt
 * @param tag Lọc theo chủ đề
 * @param limit Giới hạn số lượng kết quả trả về
 */
export function searchFullDictionary(
  query: string,
  tag?: VocabTag | 'ALL',
  limit: number = 30
): DictionarySearchResult[] {
  initializeDictionary();

  const cleanQuery = query.toLowerCase().trim();
  if (!cleanQuery) return [];

  const results: DictionarySearchResult[] = [];
  const addedIndices = new Set<number>();

  // 1. Tìm Exact Match tiếng Anh (Chính xác 100%)
  const exactMatch = _wordMap.get(cleanQuery);
  if (exactMatch) {
    if (!tag || tag === 'ALL' || exactMatch.tag === tag) {
      results.push({ item: exactMatch, matchType: 'exact' });
      // Tìm index của exactMatch để tránh trùng
      const idx = _combinedDictionary.findIndex((w) => w.word.toLowerCase() === cleanQuery);
      if (idx !== -1) addedIndices.add(idx);
    }
  }

  // 2. Tìm Prefix Match qua Trie Index (Khớp tiền tố tiếng Anh)
  const prefixKey = cleanQuery.substring(0, Math.min(cleanQuery.length, 6));
  const candidateIndices = _prefixIndex.get(prefixKey) || [];

  for (const idx of candidateIndices) {
    if (results.length >= limit) break;
    if (addedIndices.has(idx)) continue;

    const candidate = _combinedDictionary[idx];
    const candidateLower = candidate.word.toLowerCase();

    if (candidateLower.startsWith(cleanQuery)) {
      if (!tag || tag === 'ALL' || candidate.tag === tag) {
        results.push({ item: candidate, matchType: 'prefix' });
        addedIndices.add(idx);
      }
    }
  }

  // 3. Tìm Substring Match trong Tiếng Anh & Nghĩa Tiếng Việt
  if (results.length < limit) {
    for (let i = 0; i < _combinedDictionary.length; i++) {
      if (results.length >= limit) break;
      if (addedIndices.has(i)) continue;

      const item = _combinedDictionary[i];
      if (tag && tag !== 'ALL' && item.tag !== tag) continue;

      const wordLower = item.word.toLowerCase();
      const meaningLower = (item.meaning || '').toLowerCase();

      if (wordLower.includes(cleanQuery)) {
        results.push({ item, matchType: 'contains' });
        addedIndices.add(i);
      } else if (meaningLower.includes(cleanQuery)) {
        results.push({ item, matchType: 'meaning' });
        addedIndices.add(i);
      }
    }
  }

  return results;
}

/**
 * Lấy toàn bộ danh sách Siêu Từ Điển
 */
export function getFullDictionaryBank(): VocabWord[] {
  initializeDictionary();
  return _combinedDictionary;
}

/**
 * Lấy số lượng từ vựng hiện có trong Siêu Từ Điển
 */
export function getFullDictionaryCount(): number {
  initializeDictionary();
  return _combinedDictionary.length;
}
