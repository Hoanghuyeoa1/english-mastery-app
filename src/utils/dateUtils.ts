// src/utils/dateUtils.ts
/**
 * Vietnam Calendar & Timezone Date Engine (Asia/Ho_Chi_Minh = UTC+7)
 * 
 * Provides pure, deterministic date derivations and calendar day diffing
 * without daylight-saving shifts, browser local timezone interference,
 * or UTC midnight day-boundary drift.
 */

export const VIETNAM_UTC_OFFSET_HOURS = 7;

/**
 * Validates and converts any Date, ISO string, Unix epoch ms, or date string
 * to a canonical 'YYYY-MM-DD' date string in Vietnam Business Timezone (UTC+7).
 * Returns empty string '' if input is invalid or corrupt.
 */
export function getVietnamDateString(dateOrTimestamp?: Date | string | number | null): string {
  if (dateOrTimestamp === null || dateOrTimestamp === undefined || dateOrTimestamp === '') {
    if (dateOrTimestamp === undefined) {
      const now = new Date();
      const vnMs = now.getTime() + VIETNAM_UTC_OFFSET_HOURS * 3600 * 1000;
      const vnDate = new Date(vnMs);
      return `${vnDate.getUTCFullYear()}-${String(vnDate.getUTCMonth() + 1).padStart(2, '0')}-${String(vnDate.getUTCDate()).padStart(2, '0')}`;
    }
    return '';
  }

  if (typeof dateOrTimestamp === 'string') {
    const trimmed = dateOrTimestamp.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [yStr, mStr, dStr] = trimmed.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const d = parseInt(dStr, 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return trimmed;
      }
      return '';
    }
  }

  const ms = typeof dateOrTimestamp === 'number'
    ? dateOrTimestamp
    : typeof dateOrTimestamp === 'string'
      ? Date.parse(dateOrTimestamp)
      : dateOrTimestamp.getTime();

  if (Number.isNaN(ms) || !Number.isFinite(ms)) return '';

  const vnMs = ms + VIETNAM_UTC_OFFSET_HOURS * 3600 * 1000;
  const vnDate = new Date(vnMs);
  const y = vnDate.getUTCFullYear();
  const m = String(vnDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(vnDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculates the exact integer day difference between two calendar dates (dateStr1 - dateStr2).
 * Both inputs are resolved to Asia/Ho_Chi_Minh YYYY-MM-DD.
 * Returns:
 *   1  -> dateStr1 is exactly the next calendar day after dateStr2
 *   0  -> same calendar day
 *  >1  -> dateStr1 is 2 or more calendar days after dateStr2 (broken streak)
 *  <0  -> dateStr1 is before dateStr2 (clock rewind or past comparison)
 * null -> one or both inputs cannot be parsed as a valid calendar date
 */
export function getCalendarDayDiff(
  dateStr1: string | Date | number | null | undefined,
  dateStr2: string | Date | number | null | undefined
): number | null {
  if (dateStr1 === null || dateStr1 === undefined || dateStr2 === null || dateStr2 === undefined) {
    return null;
  }

  const d1 = getVietnamDateString(dateStr1);
  const d2 = getVietnamDateString(dateStr2);
  if (!d1 || !d2) return null;

  const [y1, m1, day1] = d1.split('-').map(Number);
  const [y2, m2, day2] = d2.split('-').map(Number);

  const utcMs1 = Date.UTC(y1, m1 - 1, day1);
  const utcMs2 = Date.UTC(y2, m2 - 1, day2);

  return Math.round((utcMs1 - utcMs2) / (1000 * 3600 * 24));
}

/**
 * Returns true if dateStr1 is exactly 1 calendar day after dateStr2.
 */
export function isConsecutiveVietnamDay(
  dateStr1: string | Date | number | null | undefined,
  dateStr2: string | Date | number | null | undefined
): boolean {
  return getCalendarDayDiff(dateStr1, dateStr2) === 1;
}

/**
 * Returns true if both dates resolve to the exact same calendar day in Vietnam timezone.
 */
export function isSameCalendarDay(
  dateStr1: string | Date | number | null | undefined,
  dateStr2: string | Date | number | null | undefined
): boolean {
  return getCalendarDayDiff(dateStr1, dateStr2) === 0;
}
