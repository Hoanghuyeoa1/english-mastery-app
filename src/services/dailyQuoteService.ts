import { useState, useEffect } from 'react';
import { MOTIVATIONAL_QUOTES, MotivationalQuote } from '../data/motivationalQuotes';

export const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const VIETNAM_UTC_OFFSET_HOURS = 7;

export const FALLBACK_QUOTE: MotivationalQuote = {
  id: 0,
  en: "Every day is a new beginning for your learning journey.",
  vi: "Mỗi ngày là một khởi đầu mới cho hành trình học tập của bạn.",
  author: "English Mastery Hub",
  category: "mindset"
};

/**
 * Formats a Date or timestamp as 'YYYY-MM-DD' in Asia/Ho_Chi_Minh (UTC+7).
 */
export function getVietnamDateString(dateInput?: Date | string | number): string {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }

  let date: Date;
  if (!dateInput) {
    date = new Date();
  } else if (dateInput instanceof Date) {
    date = isNaN(dateInput.getTime()) ? new Date() : dateInput;
  } else {
    date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      date = new Date();
    }
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: VIETNAM_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date);
  } catch {
    // Arithmetic fallback: Vietnam is fixed UTC+7 with no DST
    const vnMs = date.getTime() + VIETNAM_UTC_OFFSET_HOURS * 60 * 60 * 1000;
    const vnDate = new Date(vnMs);
    const y = vnDate.getUTCFullYear();
    const m = String(vnDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(vnDate.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/**
 * Extracts year, month, and day in Vietnam timezone.
 */
export function getVietnamDateParts(dateInput?: Date | string | number): { year: number; month: number; day: number } {
  const dateStr = getVietnamDateString(dateInput);
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

/**
 * Converts a 'YYYY-MM-DD' date string into a continuous day number since UTC epoch.
 * Monotonically increases by 1 each day across months, years, and leap years.
 */
export function getDayNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  return Math.floor(utcMidnight / (24 * 60 * 60 * 1000));
}

/**
 * Greatest common divisor using Euclidean algorithm.
 */
export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

/**
 * Finds a golden-ratio coprime stride for modulo total.
 * Ensures that jumping by this stride creates a full-cycle permutation
 * and guarantees adjacent days never land on the same index.
 */
export function getCoprimeStride(total: number): number {
  if (total <= 1) return 1;
  let stride = Math.floor(total * 0.6180339887);
  if (stride < 1) stride = 1;
  while (gcd(stride, total) !== 1) {
    stride = (stride + 1) % total;
    if (stride === 0) stride = 1;
  }
  return stride;
}

/**
 * Deterministically computes the quote index for a given date in Vietnam.
 */
export function getDailyQuoteIndex(
  dateInput?: Date | string | number,
  totalQuotes: number = MOTIVATIONAL_QUOTES.length
): number {
  if (totalQuotes <= 1) return 0;

  const dateStr = getVietnamDateString(dateInput);
  const dayNumber = getDayNumber(dateStr);
  const stride = getCoprimeStride(totalQuotes);

  const rawIndex = (dayNumber * stride) % totalQuotes;
  return (rawIndex + totalQuotes) % totalQuotes;
}

/**
 * Deterministically retrieves the daily motivation quote for a given date in Vietnam.
 */
export function getDailyQuote(
  dateInput?: Date | string | number,
  quoteBank: MotivationalQuote[] = MOTIVATIONAL_QUOTES
): MotivationalQuote {
  if (!quoteBank || quoteBank.length === 0) {
    return FALLBACK_QUOTE;
  }
  if (quoteBank.length === 1) {
    return quoteBank[0];
  }

  const index = getDailyQuoteIndex(dateInput, quoteBank.length);
  return quoteBank[index] || FALLBACK_QUOTE;
}

/**
 * Calculates milliseconds remaining until the upcoming 00:00:00 in Vietnam (UTC+7).
 */
export function getMillisecondsUntilNextVietnamMidnight(nowInput?: Date | number): number {
  let now: Date;
  if (!nowInput) {
    now = new Date();
  } else if (nowInput instanceof Date) {
    now = isNaN(nowInput.getTime()) ? new Date() : nowInput;
  } else {
    now = new Date(nowInput);
    if (isNaN(now.getTime())) now = new Date();
  }

  const { year, month, day } = getVietnamDateParts(now);
  // Tomorrow's 00:00:00 in Vietnam converted to UTC milliseconds
  const nextMidnightUtcMs = Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0) - (VIETNAM_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  let diffMs = nextMidnightUtcMs - now.getTime();

  if (diffMs <= 0) {
    // If exact midnight or jitter, advance to the following midnight
    diffMs += 24 * 60 * 60 * 1000;
  }

  return diffMs;
}

/**
 * Custom React hook that returns the active daily motivation quote.
 * Automatically flips to the new quote at 00:00 Vietnam time without page reload,
 * and recovers seamlessly from tab background throttling / OS sleep via visibilitychange & focus.
 */
export function useDailyMotivationQuote(quoteBank: MotivationalQuote[] = MOTIVATIONAL_QUOTES): MotivationalQuote {
  const [currentQuote, setCurrentQuote] = useState<MotivationalQuote>(() => getDailyQuote(undefined, quoteBank));

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const syncQuote = () => {
      const nextQuote = getDailyQuote(undefined, quoteBank);
      setCurrentQuote((prev) => (prev.id !== nextQuote.id ? nextQuote : prev));
      scheduleNext();
    };

    const scheduleNext = () => {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      // Add 100ms safety buffer to ensure midnight in Vietnam has strictly ticked over
      const msUntilMidnight = getMillisecondsUntilNextVietnamMidnight() + 100;
      timerId = setTimeout(() => {
        syncQuote();
      }, msUntilMidnight);
    };

    const handleWakeOrFocus = () => {
      // If user wakes device from sleep or switches to this tab after midnight,
      // immediate sync handles the date transition before any delayed timer fires.
      syncQuote();
    };

    scheduleNext();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleWakeOrFocus);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleWakeOrFocus);
    }

    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleWakeOrFocus);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleWakeOrFocus);
      }
    };
  }, [quoteBank]);

  return currentQuote;
}
