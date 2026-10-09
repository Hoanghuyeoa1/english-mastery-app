import { describe, it, expect } from 'vitest';
import { MOTIVATIONAL_QUOTES } from '../../data/motivationalQuotes';
import {
  getVietnamDateString,
  getVietnamDateParts,
  getDayNumber,
  getCoprimeStride,
  getDailyQuoteIndex,
  getDailyQuote,
  getMillisecondsUntilNextVietnamMidnight,
  FALLBACK_QUOTE,
  VIETNAM_TIMEZONE
} from '../dailyQuoteService';
import { getDailyQuote as getDailyQuoteBackcompat, DAILY_QUOTES } from '../../data/dailyQuotes';

describe('dailyQuoteService & motivationalQuotes Bank', () => {
  describe('1. Quote Bank Integrity & Diversity', () => {
    it('contains at least 100 motivational quotes', () => {
      expect(MOTIVATIONAL_QUOTES.length).toBeGreaterThanOrEqual(100);
    });

    it('has unique IDs for every quote', () => {
      const ids = MOTIVATIONAL_QUOTES.map((q) => q.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(MOTIVATIONAL_QUOTES.length);
    });

    it('has unique English text for every quote (no duplicates)', () => {
      const texts = MOTIVATIONAL_QUOTES.map((q) => q.en.trim().toLowerCase());
      const uniqueTexts = new Set(texts);
      expect(uniqueTexts.size).toBe(MOTIVATIONAL_QUOTES.length);
    });

    it('ensures all quotes have valid non-empty English, Vietnamese, and Author fields', () => {
      MOTIVATIONAL_QUOTES.forEach((q, index) => {
        expect(q.en.trim().length, `Quote #${index + 1} has empty English text`).toBeGreaterThan(5);
        expect(q.vi.trim().length, `Quote #${index + 1} has empty Vietnamese text`).toBeGreaterThan(5);
        expect(q.author.trim().length, `Quote #${index + 1} has empty Author`).toBeGreaterThan(2);
      });
    });
  });

  describe('2. Vietnam Timezone (Asia/Ho_Chi_Minh) Formatting', () => {
    it('formats UTC time correctly into Vietnam YYYY-MM-DD', () => {
      // 2026-10-06 16:59:59 UTC = 2026-10-06 23:59:59 VN
      const beforeMidnightUtc = new Date('2026-10-06T16:59:59.000Z');
      expect(getVietnamDateString(beforeMidnightUtc)).toBe('2026-10-06');

      // 2026-10-06 17:00:00 UTC = 2026-10-07 00:00:00 VN
      const atMidnightUtc = new Date('2026-10-06T17:00:00.000Z');
      expect(getVietnamDateString(atMidnightUtc)).toBe('2026-10-07');
    });

    it('extracts date parts accurately in Vietnam timezone', () => {
      const date = new Date('2026-10-06T17:30:00.000Z'); // 00:30 Oct 7 VN
      const parts = getVietnamDateParts(date);
      expect(parts).toEqual({ year: 2026, month: 10, day: 7 });
    });

    it('handles direct YYYY-MM-DD string inputs as-is', () => {
      expect(getVietnamDateString('2026-12-31')).toBe('2026-12-31');
    });

    it('gracefully handles invalid Date or strings without crashing', () => {
      const invalidDate = new Date('invalid');
      const result = getVietnamDateString(invalidDate);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const invalidStrResult = getVietnamDateString('not-a-date');
      expect(invalidStrResult).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('3. Monotonic Day Number & Stride Math', () => {
    it('produces consecutive numbers across calendar days', () => {
      const d1 = getDayNumber('2026-10-06');
      const d2 = getDayNumber('2026-10-07');
      expect(d2 - d1).toBe(1);
    });

    it('handles year transitions monotonically', () => {
      const dec31 = getDayNumber('2026-12-31');
      const jan01 = getDayNumber('2027-01-01');
      expect(jan01 - dec31).toBe(1);
    });

    it('handles leap year transitions monotonically', () => {
      const feb28 = getDayNumber('2028-02-28');
      const feb29 = getDayNumber('2028-02-29');
      const mar01 = getDayNumber('2028-03-01');
      expect(feb29 - feb28).toBe(1);
      expect(mar01 - feb29).toBe(1);
    });

    it('produces a coprime stride that spans all items without collision', () => {
      const total = MOTIVATIONAL_QUOTES.length;
      const stride = getCoprimeStride(total);
      expect(stride).toBeGreaterThan(1);
      expect(stride).toBeLessThan(total);

      // Verify that multiplying stride over [0..total-1] covers all [0..total-1]
      const visited = new Set<number>();
      for (let i = 0; i < total; i++) {
        visited.add((i * stride) % total);
      }
      expect(visited.size).toBe(total);
    });
  });

  describe('4. Deterministic Quote Selection', () => {
    it('returns the exact same quote on 100 consecutive calls for the same date (no Math.random)', () => {
      const date = '2026-10-06';
      const quote1 = getDailyQuote(date);
      for (let i = 0; i < 100; i++) {
        const quoteN = getDailyQuote(date);
        expect(quoteN.id).toBe(quote1.id);
        expect(quoteN.en).toBe(quote1.en);
      }
    });

    it('ensures two distinct users/instances on the same date see the identical quote', () => {
      const userA = getDailyQuote('2026-05-15');
      const userB = getDailyQuote('2026-05-15');
      expect(userA).toEqual(userB);
    });

    it('guarantees that adjacent consecutive days NEVER repeat the same quote', () => {
      // Test over 400 continuous days (covering all seasons, year rollover, leap year)
      let currentMs = new Date('2026-01-01T00:00:00+07:00').getTime();
      let prevQuoteId = -1;

      for (let i = 0; i < 400; i++) {
        const dateStr = getVietnamDateString(new Date(currentMs));
        const quote = getDailyQuote(dateStr);
        expect(quote.id, `Adjacent day repeat detected at day ${i} (${dateStr})`).not.toBe(prevQuoteId);
        prevQuoteId = quote.id;
        currentMs += 24 * 60 * 60 * 1000;
      }
    });
  });

  describe('5. Midnight Countdown (Asia/Ho_Chi_Minh Rollover Timer)', () => {
    it('computes exact milliseconds remaining at 23:59:59 VN (1000 ms)', () => {
      const almostMidnight = new Date('2026-10-06T23:59:59.000+07:00');
      const ms = getMillisecondsUntilNextVietnamMidnight(almostMidnight);
      expect(ms).toBe(1000);
    });

    it('computes exact 24 hours (86,400,000 ms) at 00:00:00 VN', () => {
      const justMidnight = new Date('2026-10-07T00:00:00.000+07:00');
      const ms = getMillisecondsUntilNextVietnamMidnight(justMidnight);
      expect(ms).toBe(24 * 60 * 60 * 1000);
    });

    it('computes exact 12 hours (43,200,000 ms) at 12:00:00 noon VN', () => {
      const noon = new Date('2026-10-06T12:00:00.000+07:00');
      const ms = getMillisecondsUntilNextVietnamMidnight(noon);
      expect(ms).toBe(12 * 60 * 60 * 1000);
    });

    it('correctly handles countdown across year-end boundary (2026-12-31 23:59:59)', () => {
      const newYearsEve = new Date('2026-12-31T23:59:59.000+07:00');
      const ms = getMillisecondsUntilNextVietnamMidnight(newYearsEve);
      expect(ms).toBe(1000);
    });

    it('correctly handles countdown across leap year February 28 to 29 (2028-02-28 23:59:59)', () => {
      const leapEve = new Date('2028-02-28T23:59:59.000+07:00');
      const ms = getMillisecondsUntilNextVietnamMidnight(leapEve);
      expect(ms).toBe(1000);
    });
  });

  describe('6. Fallback & Edge Case Resilience', () => {
    it('returns FALLBACK_QUOTE gracefully if quote bank is empty', () => {
      const quote = getDailyQuote('2026-10-06', []);
      expect(quote).toEqual(FALLBACK_QUOTE);
      expect(quote.en).toBe(FALLBACK_QUOTE.en);
    });

    it('returns the sole quote if quote bank has only 1 item', () => {
      const singleBank = [{ id: 999, en: 'Only one', vi: 'Duy nhất một câu', author: 'Author' }];
      const quote = getDailyQuote('2026-10-06', singleBank);
      expect(quote.id).toBe(999);
      expect(quote.en).toBe('Only one');
    });

    it('handles invalid date input gracefully by defaulting to today', () => {
      const quoteFromInvalidDate = getDailyQuote(new Date('invalid-date'));
      expect(quoteFromInvalidDate).toBeDefined();
      expect(quoteFromInvalidDate.en.length).toBeGreaterThan(0);
    });
  });

  describe('7. Backward Compatibility with dailyQuotes.ts', () => {
    it('allows legacy imports from data/dailyQuotes to fetch valid quotes', () => {
      expect(DAILY_QUOTES.length).toBeGreaterThanOrEqual(100);
      const quote = getDailyQuoteBackcompat('2026-10-06');
      expect(quote).toBeDefined();
      expect(quote.en).toBeTruthy();
      expect(quote.vi).toBeTruthy();
      expect(quote.author).toBeTruthy();
    });
  });
});
