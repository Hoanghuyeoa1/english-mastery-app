import { describe, it, expect } from 'vitest';
import { formatFSRSIntervalPreview, isSentenceItem } from '../FlashcardDeck';

describe('FlashcardDeck Helpers', () => {
  describe('formatFSRSIntervalPreview', () => {
    it('should format 0 or sub-day interval as < 10m', () => {
      expect(formatFSRSIntervalPreview(0)).toBe('< 10m');
      expect(formatFSRSIntervalPreview(-1)).toBe('< 10m');
    });

    it('should format 1 day interval as 1 ngày', () => {
      expect(formatFSRSIntervalPreview(1)).toBe('1 ngày');
    });

    it('should format multi-day intervals under 30 days as X ngày', () => {
      expect(formatFSRSIntervalPreview(3)).toBe('3 ngày');
      expect(formatFSRSIntervalPreview(14)).toBe('14 ngày');
      expect(formatFSRSIntervalPreview(29)).toBe('29 ngày');
    });

    it('should format intervals between 30 and 364 days as X tháng', () => {
      expect(formatFSRSIntervalPreview(30)).toBe('1 tháng');
      expect(formatFSRSIntervalPreview(60)).toBe('2 tháng');
      expect(formatFSRSIntervalPreview(180)).toBe('6 tháng');
    });

    it('should format intervals >= 365 days as X năm', () => {
      expect(formatFSRSIntervalPreview(365)).toBe('1 năm');
      expect(formatFSRSIntervalPreview(730)).toBe('2 năm');
      expect(formatFSRSIntervalPreview(400)).toBe('1.1 năm');
    });
  });

  describe('isSentenceItem', () => {
    it('should identify short single words as not sentences', () => {
      expect(isSentenceItem({ word: 'serendipity', type: 'single_word' })).toBe(false);
      expect(isSentenceItem({ word: 'ephemeral', tag: 'Oxford 3000' })).toBe(false);
    });

    it('should identify long phrases (> 4 words) as sentences', () => {
      expect(isSentenceItem({ word: 'The quick brown fox jumps' })).toBe(true);
    });

    it('should identify items with Sentence tag or part of speech as sentences', () => {
      expect(isSentenceItem({ word: 'How are you?', tag: 'Sentence' })).toBe(true);
      expect(isSentenceItem({ word: 'Nice to meet you', partOfSpeech: 'sentence' })).toBe(true);
    });

    it('should not treat collocations or idioms as sentences even if long', () => {
      expect(isSentenceItem({ primaryText: 'break a leg and good luck', type: 'idiom' })).toBe(false);
      expect(isSentenceItem({ primaryText: 'heavy rain pouring down', type: 'collocation' })).toBe(false);
    });
  });
});
