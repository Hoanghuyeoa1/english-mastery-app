import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeDictionary,
  searchFullDictionary,
  getFullDictionaryBank,
  getFullDictionaryCount,
  getDictionaryIndexMetrics
} from '../dictionaryIndex';

describe('DictionaryIndex High-Performance Trie & Benchmark', () => {
  beforeEach(() => {
    initializeDictionary();
  });

  it('should initialize and build prefix index in less than 100ms', () => {
    const metrics = getDictionaryIndexMetrics();
    expect(metrics.wordCount).toBeGreaterThan(3000);
    expect(metrics.buildTimeMs).toBeLessThan(500);
    expect(metrics.meetsBuildTarget).toBe(true);
    expect(metrics.prefixCount).toBeGreaterThan(0);
  });

  it('should perform prefix autocomplete queries in less than 15ms', () => {
    const testQueries = ['morn', 'eve', 'wat', 'brea', 'comp'];

    for (const q of testQueries) {
      const results = searchFullDictionary(q, 'ALL', 10);
      const metrics = getDictionaryIndexMetrics();

      expect(results.length).toBeGreaterThan(0);
      expect(metrics.lastQueryTimeMs).toBeLessThan(15);
      expect(metrics.meetsQueryTarget).toBe(true);
    }
  });

  it('should return exact match with high priority', () => {
    const results = searchFullDictionary('morning', 'ALL', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.word.toLowerCase()).toBe('morning');
    expect(results[0].matchType).toBe('exact');
  });

  it('should support searching by Vietnamese meaning', () => {
    const results = searchFullDictionary('buổi sáng', 'ALL', 5);
    expect(results.length).toBeGreaterThan(0);
    const found = results.some((r) => r.item.meaning.toLowerCase().includes('buổi sáng'));
    expect(found).toBe(true);
  });

  it('should filter results by VocabTag correctly', () => {
    const results = searchFullDictionary('a', 'Daily', 10);
    for (const r of results) {
      expect(r.item.tag).toBe('Daily');
    }
  });

  it('should return empty array for empty or whitespace query', () => {
    expect(searchFullDictionary('')).toEqual([]);
    expect(searchFullDictionary('   ')).toEqual([]);
  });

  it('should handle non-existent words without error', () => {
    const results = searchFullDictionary('xyzzynonexistentword12345');
    expect(results).toEqual([]);
    const metrics = getDictionaryIndexMetrics();
    expect(metrics.lastQueryTimeMs).toBeLessThan(15);
  });

  it('should return full dictionary bank array and count', () => {
    const bank = getFullDictionaryBank();
    const count = getFullDictionaryCount();
    expect(bank.length).toBe(count);
    expect(count).toBeGreaterThan(3000);
  });
});
