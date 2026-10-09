// @vitest-environment happy-dom
// src/utils/__tests__/dateUtils.test.ts

import { describe, it, expect } from 'vitest';
import {
  getVietnamDateString,
  getCalendarDayDiff,
  isConsecutiveVietnamDay,
  isSameCalendarDay,
} from '../dateUtils';

describe('Vietnam Calendar & DateUtils Suite', () => {
  it('converts Date and ISO strings to Vietnam YYYY-MM-DD correctly', () => {
    // 18:00:00 UTC Oct 8 -> 01:00:00 VN Oct 9
    const utcIso = '2026-10-08T18:00:00.000Z';
    expect(getVietnamDateString(utcIso)).toBe('2026-10-09');

    // 16:59:59 UTC Oct 8 -> 23:59:59 VN Oct 8
    const utcIsoBefore = '2026-10-08T16:59:59.000Z';
    expect(getVietnamDateString(utcIsoBefore)).toBe('2026-10-08');

    // Pre-formatted valid string
    expect(getVietnamDateString('2026-10-09')).toBe('2026-10-09');

    // Invalid / corrupt strings
    expect(getVietnamDateString('INVALID')).toBe('');
    expect(getVietnamDateString(null)).toBe('');
    expect(getVietnamDateString('')).toBe('');
  });

  it('calculates calendar day diff across month and year boundaries', () => {
    // Regular consecutive days
    expect(getCalendarDayDiff('2026-10-09', '2026-10-08')).toBe(1);
    expect(getCalendarDayDiff('2026-10-08', '2026-10-09')).toBe(-1);
    expect(getCalendarDayDiff('2026-10-09', '2026-10-09')).toBe(0);

    // Month boundary: March 1 - Feb 28 (non-leap year)
    expect(getCalendarDayDiff('2026-03-01', '2026-02-28')).toBe(1);

    // Leap year: March 1, 2028 - Feb 29, 2028
    expect(getCalendarDayDiff('2028-03-01', '2028-02-29')).toBe(1);
    expect(getCalendarDayDiff('2028-03-01', '2028-02-28')).toBe(2);

    // Year boundary: Jan 1, 2027 - Dec 31, 2026
    expect(getCalendarDayDiff('2027-01-01', '2026-12-31')).toBe(1);

    // Invalid inputs
    expect(getCalendarDayDiff('invalid', '2026-10-09')).toBeNull();
    expect(getCalendarDayDiff(null, '2026-10-09')).toBeNull();
  });

  it('evaluates consecutive and same day booleans correctly', () => {
    expect(isConsecutiveVietnamDay('2026-10-09', '2026-10-08')).toBe(true);
    expect(isConsecutiveVietnamDay('2026-10-10', '2026-10-08')).toBe(false);

    expect(isSameCalendarDay('2026-10-09', '2026-10-09')).toBe(true);
    expect(isSameCalendarDay('2026-10-09', '2026-10-08')).toBe(false);
  });
});
