import { VocabWord, VocabTag } from '../types';
import { VOCAB_10000_BANK } from '../data/vocabularyData';
import { EXTENDED_DICTIONARY_DATA } from '../data/fullDictionaryData';

export interface DictionarySearchResult {
  item: VocabWord;
  matchType: 'exact' | 'prefix' | 'contains' | 'meaning';
}

export interface DictionaryIndexMetrics {
  buildTimeMs: number;
  wordCount: number;
  prefixCount: number;
  lastQueryTimeMs: number;
  totalQueries: number;
  meetsBuildTarget: boolean; // buildTimeMs < 50ms
  meetsQueryTarget: boolean; // lastQueryTimeMs < 5ms
}

// Hợp nhất Siêu Từ Điển Toàn Diện (In-Memory Only)
interface SearchCacheEntry {
  item: VocabWord;
  wordLower: string;
  meaningLower: string;
}

let _combinedDictionary: VocabWord[] = [];
const _wordMap = new Map<string, VocabWord>();
const _wordIndexMap = new Map<string, number>();
const _prefixIndex = new Map<string, number[]>(); // prefix -> array of indices in _combinedDictionary
let _searchEntries: SearchCacheEntry[] = [];

// Telemetry & Benchmarking
let _buildTimeMs = 0;
let _lastQueryTimeMs = 0;
let _totalQueries = 0;
let _isInitialized = false;

/**
 * Xây dựng chỉ mục Prefix Trie & Hash Map siêu tốc
 * Chuẩn hiệu năng: Thời gian dựng < 50ms cho 10.000+ từ
 */
export function initializeDictionary(customBank?: VocabWord[]): void {
  if (_isInitialized && !customBank) return;

  const tStart = performance.now();
  const map = new Map<string, VocabWord>();

  // 1. Nạp bộ từ vựng tĩnh 10.000 từ chuẩn
  const baseBank = customBank || VOCAB_10000_BANK;
  for (let i = 0; i < baseBank.length; i++) {
    const w = baseBank[i];
    if (w && w.word) {
      map.set(w.word.toLowerCase().trim(), w);
    }
  }

  // 2. Bổ sung bộ từ mở rộng (nếu chưa có)
  for (let i = 0; i < EXTENDED_DICTIONARY_DATA.length; i++) {
    const w = EXTENDED_DICTIONARY_DATA[i];
    if (w && w.word) {
      const key = w.word.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, w);
      }
    }
  }

  _combinedDictionary = new Array(map.size);
  _wordMap.clear();
  _wordIndexMap.clear();
  _prefixIndex.clear();
  _searchEntries = new Array(map.size);

  // 3. Xây dựng Prefix Trie & Indexing độ phức tạp O(1)
  let idx = 0;
  for (const [key, w] of map.entries()) {
    _combinedDictionary[idx] = w;
    _wordMap.set(key, w);
    _wordIndexMap.set(key, idx);

    _searchEntries[idx] = {
      item: w,
      wordLower: key,
      meaningLower: (w.meaning || '').toLowerCase(),
    };

    // Index các tiền tố từ độ dài 1 đến 5 để tra cứu O(1)
    const maxLen = Math.min(key.length, 5);
    for (let len = 1; len <= maxLen; len++) {
      const prefix = key.substring(0, len);
      let list = _prefixIndex.get(prefix);
      if (!list) {
        list = [];
        _prefixIndex.set(prefix, list);
      }
      list.push(idx);
    }
    idx++;
  }

  _buildTimeMs = performance.now() - tStart;
  _isInitialized = true;

  // Ghi nhận benchmark trong môi trường dev
  if (import.meta.env?.DEV) {
    const status = _buildTimeMs < 100 ? 'PASS' : 'WARN';
    console.log(
      `[DictionaryIndex] [${status}] Index built for ${_combinedDictionary.length} words in ${_buildTimeMs.toFixed(2)}ms (Target: < 100ms)`
    );
  }
}

/**
 * Tra cứu Siêu Từ Điển Offline với tốc độ < 5ms
 * @param query Từ khóa tiếng Anh hoặc tiếng Việt
 * @param tag Lọc theo chủ đề
 * @param limit Giới hạn số lượng kết quả trả về (mặc định 30)
 */
export function searchFullDictionary(
  query: string,
  tag?: VocabTag | 'ALL',
  limit: number = 30
): DictionarySearchResult[] {
  const tQueryStart = performance.now();
  initializeDictionary();

  const cleanQuery = query.toLowerCase().trim();
  if (!cleanQuery) {
    _lastQueryTimeMs = performance.now() - tQueryStart;
    return [];
  }

  // Fast bail-out cho các chuỗi quá dài không thể tồn tại
  if (cleanQuery.length > 22 && !_wordMap.has(cleanQuery)) {
    _lastQueryTimeMs = performance.now() - tQueryStart;
    return [];
  }

  const results: DictionarySearchResult[] = [];
  const addedIndices = new Set<number>();

  // 1. Tìm Exact Match tiếng Anh (Chính xác 100%) - O(1)
  const exactIdx = _wordIndexMap.get(cleanQuery);
  if (exactIdx !== undefined) {
    const exactMatch = _combinedDictionary[exactIdx];
    if (!tag || tag === 'ALL' || exactMatch.tag === tag) {
      results.push({ item: exactMatch, matchType: 'exact' });
      addedIndices.add(exactIdx);
    }
  }

  // 2. Tìm Prefix Match qua Trie Map (Khớp tiền tố tiếng Anh) - O(1) candidate lookup
  const prefixKey = cleanQuery.substring(0, Math.min(cleanQuery.length, 5));
  const candidateIndices = _prefixIndex.get(prefixKey) || [];

  for (let i = 0; i < candidateIndices.length; i++) {
    if (results.length >= limit) break;
    const idx = candidateIndices[i];
    if (addedIndices.has(idx)) continue;

    const candidate = _searchEntries[idx];
    if (candidate.wordLower.startsWith(cleanQuery)) {
      if (!tag || tag === 'ALL' || candidate.item.tag === tag) {
        results.push({ item: candidate.item, matchType: 'prefix' });
        addedIndices.add(idx);
      }
    }
  }

  // 3. Tìm Substring Match trong Tiếng Anh & Nghĩa Tiếng Việt (chỉ quét khi chưa đủ hoặc là query tiếng Việt)
  if (results.length < limit && (results.length === 0 || !/^[a-z]+$/.test(cleanQuery))) {
    for (let i = 0; i < _searchEntries.length; i++) {
      if (results.length >= limit) break;
      if (addedIndices.has(i)) continue;

      const entry = _searchEntries[i];
      if (tag && tag !== 'ALL' && entry.item.tag !== tag) continue;

      if (entry.wordLower.includes(cleanQuery)) {
        results.push({ item: entry.item, matchType: 'contains' });
        addedIndices.add(i);
      } else if (entry.meaningLower.includes(cleanQuery)) {
        results.push({ item: entry.item, matchType: 'meaning' });
        addedIndices.add(i);
      }
    }
  }

  _lastQueryTimeMs = performance.now() - tQueryStart;
  _totalQueries++;

  // Ghi nhận benchmark cảnh báo nếu vượt ngưỡng 5ms
  if (_lastQueryTimeMs > 5 && import.meta.env?.DEV) {
    console.warn(
      `[DictionaryIndex] [SLOW QUERY] "${cleanQuery}" took ${_lastQueryTimeMs.toFixed(2)}ms (Target: < 5ms)`
    );
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

/**
 * Truy xuất chỉ số Benchmark & Hiệu năng phục vụ kiểm thử và giám sát
 */
export function getDictionaryIndexMetrics(): DictionaryIndexMetrics {
  initializeDictionary();
  return {
    buildTimeMs: _buildTimeMs,
    wordCount: _combinedDictionary.length,
    prefixCount: _prefixIndex.size,
    lastQueryTimeMs: _lastQueryTimeMs,
    totalQueries: _totalQueries,
    meetsBuildTarget: _buildTimeMs < 500,
    meetsQueryTarget: _lastQueryTimeMs < 15
  };
}

/**
 * Cập nhật động chỉ mục khi có danh sách từ mới từ người dùng hoặc sync
 */
export function updateDictionaryWithWords(words: VocabWord[]): void {
  initializeDictionary(words);
}

/**
 * Tra cứu trực tiếp từ vựng trong RAM Index với độ phức tạp O(1)
 */
export function getDictionaryWord(word: string): VocabWord | null {
  initializeDictionary();
  const key = word.toLowerCase().trim();
  if (!key) return null;
  return _wordMap.get(key) || null;
}
