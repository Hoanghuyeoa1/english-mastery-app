// src/services/wordUsageTelemetry.ts
/**
 * Word Usage & Encounter Telemetry Service
 * 
 * Provides robust tokenization, canonical normalization, deduplication, and
 * telemetry ingestion for Reading Encounters and Writing Usages.
 * 
 * Invariants:
 * 1. Zero Keystroke Counting: Only counts on explicit submission/completion.
 * 2. Deduplication: One encounter/usage per word per activity session.
 * 3. Canonical Normalization: Inflected forms ("maintaining", "maintained") resolve to base lemma ("maintain").
 * 4. Safe State: Never duplicates dictionary static entries; minimal memory and persistent footprint.
 * 5. Corrupted Data Safety: Sanitizes any malformed telemetry without crashing.
 */

import type {
  VocabWord,
  WordLearningStatsItem,
  WordLearningStatsMap,
  WordContextUsageTelemetry,
} from '../types';
import { cleanWordToken, lookupContextWord, resolveCanonicalVocab } from './wordLookupService';

// Activity session cooldown (5 minutes) to prevent accidental double-counting on quick re-submits
const DEFAULT_ACTIVITY_COOLDOWN_MS = 5 * 60 * 1000;

// ── In-memory short-term activity deduplication guard ─────────────────────────
// LIFECYCLE: in-memory only. Cleared on page reload or tab close.
//   - NOT a permanent learner history.
//   - NOT reload-safe: page refresh resets the guard, allowing re-increment.
//   - Purpose: block accidental double-submit (rapid re-click, React StrictMode
//     double-invoke, hot-reload) within a short cooldown window.
//   - Activity IDs must be attempt-scoped (callers include a timestamp/session
//     component) to allow legitimate repeat attempts of the same content.
// ──────────────────────────────────────────────────────────────────────────────
const processedActivities = new Map<string, number>();
const MAX_PROCESSED_ACTIVITIES = 200;

/**
 * Checks if an activity ID has already been recorded within the cooldown window.
 */
export function isActivityAlreadyRecorded(
  activityId?: string,
  cooldownMs: number = DEFAULT_ACTIVITY_COOLDOWN_MS
): boolean {
  if (!activityId) return false;
  const key = activityId.trim();
  if (!key) return false;

  const timestamp = processedActivities.get(key);
  if (!timestamp) return false;

  const now = Date.now();
  if (now - timestamp < cooldownMs) {
    return true;
  }

  // Cooldown expired
  processedActivities.delete(key);
  return false;
}

/**
 * Marks an activity ID as recorded.
 */
export function markActivityRecorded(activityId?: string): void {
  if (!activityId) return;
  const key = activityId.trim();
  if (!key) return;

  if (processedActivities.size >= MAX_PROCESSED_ACTIVITIES) {
    // Evict oldest entries
    const firstKey = processedActivities.keys().next().value;
    if (firstKey) processedActivities.delete(firstKey);
  }

  processedActivities.set(key, Date.now());
}

/**
 * Clears in-memory activity deduplication state (primarily for test isolation).
 */
export function clearActivityDeduplication(): void {
  processedActivities.clear();
}

/**
 * Computes a lightweight fast hash for raw text to prevent duplicate submission counting.
 */
export function computeTextHash(text: string): string {
  if (!text) return '';
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `hash_${Math.abs(hash)}`;
}

/**
 * Purely grammatical/structural words with no learning value for an English vocabulary system.
 *
 * AUDIT CONTRACT — words intentionally NOT in this list:
 *   Discourse connectors & conjunctions with learning value:
 *     although, despite, however, unless, while, since, because,
 *     therefore, thus, hence, yet, still, even, though, whereas,
 *     furthermore, moreover, nevertheless, consequently, accordingly
 *   These are valid learning targets that learners practice deliberately.
 *   Do NOT add them here without explicit review.
 *
 * This list is deliberately narrow: only zero-information-value function words
 * (articles, prepositions, pronouns, core auxiliaries) are included.
 */
export const FUNCTIONAL_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'nor', 'so',
  'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'about', 'into', 'through', 'during', 'before', 'after',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'it', 'its', 'he', 'him', 'his', 'she', 'her', 'hers', 'they', 'them', 'their', 'theirs', 'we', 'us', 'our', 'ours', 'you', 'your', 'yours', 'i', 'me', 'my', 'mine',
  'this', 'that', 'these', 'those', 'there', 'here',
]);

/**
 * Normalizes and extracts unique canonical words from a raw text passage or list of tokens.
 * Deduplicates within the same text/activity so word repetition does not inflate counters.
 */
export function extractCanonicalTokensFromText(
  input: string | string[],
  vocabularyList: VocabWord[] = []
): string[] {
  if (!input) return [];

  let rawTokens: string[] = [];
  if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === 'string') {
        const parts = item.split(/[\s,.:;!?"'()[\]{}<>/\\–—_-]+/);
        rawTokens.push(...parts);
      }
    }
  } else if (typeof input === 'string') {
    rawTokens = input.split(/[\s,.:;!?"'()[\]{}<>/\\–—_-]+/);
  }

  const uniqueCanonicalKeys = new Set<string>();

  for (const raw of rawTokens) {
    const clean = cleanWordToken(raw);
    // Ignore pure numbers, single characters (e.g. 'a', 'i', 's'), or common grammatical particles
    if (!clean || clean.length < 2 || /^\d+$/.test(clean) || FUNCTIONAL_STOP_WORDS.has(clean)) {
      continue;
    }

    // Morphological lemma resolution
    const contextWord = lookupContextWord(clean);
    if (contextWord && contextWord.word) {
      const lemma = contextWord.word.toLowerCase().trim();
      if (!FUNCTIONAL_STOP_WORDS.has(lemma)) {
        uniqueCanonicalKeys.add(lemma);
      }
      continue;
    }

    const canonicalRes = resolveCanonicalVocab(clean, vocabularyList);
    if (canonicalRes && canonicalRes.canonicalWord?.word) {
      const lemma = canonicalRes.canonicalWord.word.toLowerCase().trim();
      if (!FUNCTIONAL_STOP_WORDS.has(lemma)) {
        uniqueCanonicalKeys.add(lemma);
      }
      continue;
    }

    // Fallback to cleaned token
    uniqueCanonicalKeys.add(clean);
  }

  return Array.from(uniqueCanonicalKeys);
}

/**
 * Sanitizes and validates arbitrary data into a strictly valid WordLearningStatsMap.
 * Guarantees zero crashes from malformed, null, or corrupt storage payloads.
 */
export function sanitizeWordLearningStats(raw: unknown): WordLearningStatsMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const result: WordLearningStatsMap = {};
  const entries = Object.entries(raw as Record<string, unknown>);

  for (const [key, val] of entries) {
    if (!key || typeof key !== 'string') continue;
    const cleanKey = key.trim().toLowerCase();
    if (!cleanKey || cleanKey.length > 50) continue;

    if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
    const v = val as Record<string, unknown>;

    // Canonical schema: readingEncounters, lastReadingSeenAt, writingUsages, lastWritingUsedAt
    // Backward-compatibility: normalize legacy readingCount / writingCount / lastReadingAt / lastWritingAt
    const rawReading = typeof v.readingEncounters === 'number' ? v.readingEncounters : v.readingCount;
    const readingEncounters =
      typeof rawReading === 'number' && Number.isFinite(rawReading) && rawReading >= 0
        ? Math.floor(rawReading)
        : 0;

    const rawWriting = typeof v.writingUsages === 'number' ? v.writingUsages : v.writingCount;
    const writingUsages =
      typeof rawWriting === 'number' && Number.isFinite(rawWriting) && rawWriting >= 0
        ? Math.floor(rawWriting)
        : 0;

    const rawReadingSeenAt = typeof v.lastReadingSeenAt === 'string' ? v.lastReadingSeenAt : v.lastReadingAt;
    let lastReadingSeenAt: string | null = null;
    if (typeof rawReadingSeenAt === 'string' && !Number.isNaN(Date.parse(rawReadingSeenAt))) {
      lastReadingSeenAt = rawReadingSeenAt;
    }

    const rawWritingUsedAt = typeof v.lastWritingUsedAt === 'string' ? v.lastWritingUsedAt : v.lastWritingAt;
    let lastWritingUsedAt: string | null = null;
    if (typeof rawWritingUsedAt === 'string' && !Number.isNaN(Date.parse(rawWritingUsedAt))) {
      lastWritingUsedAt = rawWritingUsedAt;
    }

    const rawLookups = typeof v.translatorLookups === 'number' ? v.translatorLookups : undefined;
    const translatorLookups =
      typeof rawLookups === 'number' && Number.isFinite(rawLookups) && rawLookups >= 0
        ? Math.min(Math.floor(rawLookups), 999)
        : undefined;

    const rawLastLookup = typeof v.lastTranslatorLookupAt === 'string' ? v.lastTranslatorLookupAt : undefined;
    let lastTranslatorLookupAt: string | null = null;
    if (typeof rawLastLookup === 'string' && !Number.isNaN(Date.parse(rawLastLookup))) {
      lastTranslatorLookupAt = rawLastLookup;
    }

    const rawEncounters = typeof v.translatorEncounters === 'number' ? v.translatorEncounters : undefined;
    const translatorEncounters =
      typeof rawEncounters === 'number' && Number.isFinite(rawEncounters) && rawEncounters >= 0
        ? Math.min(Math.floor(rawEncounters), 999)
        : undefined;

    const rawLastSeen = typeof v.lastTranslatorSeenAt === 'string' ? v.lastTranslatorSeenAt : undefined;
    let lastTranslatorSeenAt: string | null = null;
    if (typeof rawLastSeen === 'string' && !Number.isNaN(Date.parse(rawLastSeen))) {
      lastTranslatorSeenAt = rawLastSeen;
    }

    if (
      readingEncounters > 0 ||
      writingUsages > 0 ||
      (translatorLookups !== undefined && translatorLookups > 0) ||
      (translatorEncounters !== undefined && translatorEncounters > 0) ||
      lastReadingSeenAt ||
      lastWritingUsedAt ||
      lastTranslatorLookupAt ||
      lastTranslatorSeenAt
    ) {
      result[cleanKey] = {
        readingEncounters,
        lastReadingSeenAt,
        writingUsages,
        lastWritingUsedAt,
        ...(translatorLookups !== undefined ? { translatorLookups } : {}),
        ...(lastTranslatorLookupAt !== null || translatorLookups !== undefined || v.lastTranslatorLookupAt !== undefined
          ? { lastTranslatorLookupAt }
          : {}),
        ...(translatorEncounters !== undefined ? { translatorEncounters } : {}),
        ...(lastTranslatorSeenAt !== null || translatorEncounters !== undefined || v.lastTranslatorSeenAt !== undefined
          ? { lastTranslatorSeenAt }
          : {}),
      };
    }
  }

  return result;
}

/**
 * Merges two WordLearningStatsMaps conservatively (e.g. for cloud sync or import).
 */
export function mergeWordLearningStats(
  base: WordLearningStatsMap,
  incoming: WordLearningStatsMap
): WordLearningStatsMap {
  const merged: WordLearningStatsMap = { ...base };

  for (const [key, incItem] of Object.entries(incoming)) {
    const existing = merged[key];
    if (!existing) {
      merged[key] = { ...incItem };
      continue;
    }

    // Merge encounters and usages
    const readingEncounters = Math.max(existing.readingEncounters, incItem.readingEncounters);
    const writingUsages = Math.max(existing.writingUsages, incItem.writingUsages);
    const translatorLookups = Math.max(existing.translatorLookups || 0, incItem.translatorLookups || 0);
    const translatorEncounters = Math.max(existing.translatorEncounters || 0, incItem.translatorEncounters || 0);

    // Pick latest timestamp for reading
    let lastReadingSeenAt = existing.lastReadingSeenAt;
    if (incItem.lastReadingSeenAt) {
      if (!lastReadingSeenAt || Date.parse(incItem.lastReadingSeenAt) > Date.parse(lastReadingSeenAt)) {
        lastReadingSeenAt = incItem.lastReadingSeenAt;
      }
    }

    // Pick latest timestamp for writing
    let lastWritingUsedAt = existing.lastWritingUsedAt;
    if (incItem.lastWritingUsedAt) {
      if (!lastWritingUsedAt || Date.parse(incItem.lastWritingUsedAt) > Date.parse(lastWritingUsedAt)) {
        lastWritingUsedAt = incItem.lastWritingUsedAt;
      }
    }

    // Pick latest timestamp for translator lookup
    let lastTranslatorLookupAt = existing.lastTranslatorLookupAt;
    if (incItem.lastTranslatorLookupAt) {
      if (!lastTranslatorLookupAt || Date.parse(incItem.lastTranslatorLookupAt) > Date.parse(lastTranslatorLookupAt)) {
        lastTranslatorLookupAt = incItem.lastTranslatorLookupAt;
      }
    }

    // Pick latest timestamp for translator encounter
    let lastTranslatorSeenAt = existing.lastTranslatorSeenAt;
    if (incItem.lastTranslatorSeenAt) {
      if (!lastTranslatorSeenAt || Date.parse(incItem.lastTranslatorSeenAt) > Date.parse(lastTranslatorSeenAt)) {
        lastTranslatorSeenAt = incItem.lastTranslatorSeenAt;
      }
    }

    merged[key] = {
      readingEncounters,
      lastReadingSeenAt,
      writingUsages,
      lastWritingUsedAt,
      ...(translatorLookups > 0 ? { translatorLookups } : {}),
      ...(lastTranslatorLookupAt ? { lastTranslatorLookupAt } : {}),
      ...(translatorEncounters > 0 ? { translatorEncounters } : {}),
      ...(lastTranslatorSeenAt ? { lastTranslatorSeenAt } : {}),
    };
  }

  return merged;
}

/**
 * Extracts WordContextUsageTelemetry for a target word from the store's wordLearningStats map.
 */
export function getWordContextUsageTelemetry(
  canonicalWord: string,
  canonicalId: string,
  cleanToken: string,
  statsMap: WordLearningStatsMap = {}
): WordContextUsageTelemetry {
  const key1 = canonicalWord.toLowerCase().trim();
  const key2 = canonicalId.toLowerCase().trim();
  const key3 = cleanToken.toLowerCase().trim();

  const item: WordLearningStatsItem | undefined =
    statsMap[key1] || statsMap[key2] || statsMap[key3];

  return {
    readingEncounters: item?.readingEncounters ?? 0,
    lastReadingSeenAt: item?.lastReadingSeenAt ?? null,
    writingUsages: item?.writingUsages ?? 0,
    lastWritingUsedAt: item?.lastWritingUsedAt ?? null,
    ...(item?.translatorLookups !== undefined ? { translatorLookups: item.translatorLookups } : {}),
    ...(item?.lastTranslatorLookupAt !== undefined ? { lastTranslatorLookupAt: item.lastTranslatorLookupAt } : {}),
    ...(item?.translatorEncounters !== undefined ? { translatorEncounters: item.translatorEncounters } : {}),
    ...(item?.lastTranslatorSeenAt !== undefined ? { lastTranslatorSeenAt: item.lastTranslatorSeenAt } : {}),
  };
}

/**
 * Records an explicit Translator word lookup in telemetry.
 * Strictly bounded and idempotent.
 */
export function recordTranslatorWordLookup(
  currentStats: WordLearningStatsMap,
  wordOrToken: string,
  nowIso: string = new Date().toISOString()
): WordLearningStatsMap {
  const clean = cleanWordToken(wordOrToken);
  if (!clean || clean.length < 2 || FUNCTIONAL_STOP_WORDS.has(clean)) {
    return currentStats;
  }
  const contextWord = lookupContextWord(clean);
  const key = (contextWord?.word || clean).toLowerCase().trim();

  const existing = currentStats[key] || {
    readingEncounters: 0,
    lastReadingSeenAt: null,
    writingUsages: 0,
    lastWritingUsedAt: null,
  };

  const newLookups = Math.min((existing.translatorLookups || 0) + 1, 999);

  return {
    ...currentStats,
    [key]: {
      ...existing,
      translatorLookups: newLookups,
      lastTranslatorLookupAt: nowIso,
    },
  };
}

/**
 * Records batch word encounters from translated source text.
 * Strictly bounded to unique canonical lemmas, ignores stop words.
 */
export function recordTranslatorBatchEncounters(
  currentStats: WordLearningStatsMap,
  textOrTokens: string | string[],
  activityId?: string,
  nowIso: string = new Date().toISOString()
): WordLearningStatsMap {
  if (activityId && isActivityAlreadyRecorded(activityId)) {
    return currentStats;
  }

  const tokens = extractCanonicalTokensFromText(textOrTokens);
  if (!tokens || tokens.length === 0) return currentStats;

  if (activityId) {
    markActivityRecorded(activityId);
  }

  const nextStats: WordLearningStatsMap = { ...currentStats };
  for (const key of tokens) {
    const existing = nextStats[key] || {
      readingEncounters: 0,
      lastReadingSeenAt: null,
      writingUsages: 0,
      lastWritingUsedAt: null,
    };
    nextStats[key] = {
      ...existing,
      translatorEncounters: Math.min((existing.translatorEncounters || 0) + 1, 999),
      lastTranslatorSeenAt: nowIso,
    };
  }
  return nextStats;
}
