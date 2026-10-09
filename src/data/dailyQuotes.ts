import { MOTIVATIONAL_QUOTES, MotivationalQuote } from './motivationalQuotes';
import { getDailyQuote as getDailyQuoteFromService } from '../services/dailyQuoteService';

export type DailyQuote = MotivationalQuote;

export const DAILY_QUOTES: DailyQuote[] = MOTIVATIONAL_QUOTES;

/**
 * Backwards compatible getter using Vietnam timezone deterministic selection.
 */
export function getDailyQuote(dateStr?: string): DailyQuote {
  return getDailyQuoteFromService(dateStr, MOTIVATIONAL_QUOTES);
}

export { MOTIVATIONAL_QUOTES };
