import type {
  AppStoreState,
  WordLearningStatsMap,
  AdaptiveQuizTelemetryItem,
} from '../../types';
import { recordAdaptiveQuizTelemetryEvent } from '../../services/adaptiveQuizTelemetryService';
import {
  extractCanonicalTokensFromText,
  isActivityAlreadyRecorded,
  markActivityRecorded,
  recordTranslatorWordLookup,
  recordTranslatorBatchEncounters,
} from '../../services/wordUsageTelemetry';

export interface TelemetrySlice {
  recordAdaptiveQuizEvent: (
    event: Omit<AdaptiveQuizTelemetryItem, 'id' | 'timestamp'> & { id?: string; timestamp?: number }
  ) => void;
  recordReadingEncounters: (tokensOrText: string[] | string, activityId?: string) => void;
  recordWritingUsages: (tokensOrText: string[] | string, activityId?: string) => void;
  recordTranslatorLookup: (wordOrToken: string) => void;
  recordTranslatorEncounters: (tokensOrText: string[] | string, activityId?: string) => void;
}

type SetState = (
  partial: Partial<AppStoreState> | ((state: AppStoreState) => Partial<AppStoreState>),
  replace?: boolean
) => void;
type GetState = () => AppStoreState;

export const createTelemetrySlice = (set: SetState, get: GetState): TelemetrySlice => ({
  recordAdaptiveQuizEvent: (event) => {
    set((state) => ({
      adaptiveQuizTelemetry: recordAdaptiveQuizTelemetryEvent(
        state.adaptiveQuizTelemetry,
        event
      ),
    }));
  },

  recordReadingEncounters: (tokensOrText: string[] | string, activityId?: string) => {
    if (!tokensOrText) return;
    if (activityId && isActivityAlreadyRecorded(activityId)) {
      return;
    }

    const tokens = extractCanonicalTokensFromText(tokensOrText, get().vocabularyList);
    if (tokens.length === 0) return;

    if (activityId) {
      markActivityRecorded(activityId);
    }

    const nowIso = new Date().toISOString();
    set((state) => {
      const nextStats: WordLearningStatsMap = { ...(state.wordLearningStats || {}) };
      for (const token of tokens) {
        const key = token.toLowerCase().trim();
        const existing = nextStats[key] || {
          readingEncounters: 0,
          lastReadingSeenAt: null,
          writingUsages: 0,
          lastWritingUsedAt: null,
        };

        nextStats[key] = {
          ...existing,
          readingEncounters: existing.readingEncounters + 1,
          lastReadingSeenAt: nowIso,
        };
      }

      return { wordLearningStats: nextStats };
    });
  },

  recordWritingUsages: (tokensOrText: string[] | string, activityId?: string) => {
    if (!tokensOrText) return;
    if (activityId && isActivityAlreadyRecorded(activityId)) {
      return;
    }

    const tokens = extractCanonicalTokensFromText(tokensOrText, get().vocabularyList);
    if (tokens.length === 0) return;

    if (activityId) {
      markActivityRecorded(activityId);
    }

    const nowIso = new Date().toISOString();
    set((state) => {
      const nextStats: WordLearningStatsMap = { ...(state.wordLearningStats || {}) };
      for (const token of tokens) {
        const key = token.toLowerCase().trim();
        const existing = nextStats[key] || {
          readingEncounters: 0,
          lastReadingSeenAt: null,
          writingUsages: 0,
          lastWritingUsedAt: null,
        };

        nextStats[key] = {
          ...existing,
          writingUsages: existing.writingUsages + 1,
          lastWritingUsedAt: nowIso,
        };
      }

      return { wordLearningStats: nextStats };
    });
  },

  recordTranslatorLookup: (wordOrToken: string) => {
    if (!wordOrToken) return;
    set((state) => ({
      wordLearningStats: recordTranslatorWordLookup(state.wordLearningStats || {}, wordOrToken),
    }));
  },

  recordTranslatorEncounters: (tokensOrText: string[] | string, activityId?: string) => {
    if (!tokensOrText) return;
    set((state) => ({
      wordLearningStats: recordTranslatorBatchEncounters(state.wordLearningStats || {}, tokensOrText, activityId),
    }));
  },
});
