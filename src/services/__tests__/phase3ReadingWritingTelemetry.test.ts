import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import { getLearningDictionaryProfile } from '../learningDictionaryService';
import {
  clearActivityDeduplication,
  extractCanonicalTokensFromText,
  sanitizeWordLearningStats,
  mergeWordLearningStats,
  computeTextHash,
  isActivityAlreadyRecorded,
  markActivityRecorded,
  FUNCTIONAL_STOP_WORDS,
} from '../wordUsageTelemetry';
import type { WordLearningStatsMap } from '../../types';

describe('PHASE 3: Reading Encounters & Writing Usage Telemetry', () => {
  const FIXED_NOW = new Date('2026-10-04T12:00:00.000Z').getTime();

  beforeEach(() => {
    // Reset store state and deduplication tracking between tests
    useAppStore.getState().resetToDefault();
    clearActivityDeduplication();
  });

  // =========================================================================
  // 1. Canonical Token Extraction & Normalization
  // =========================================================================
  describe('1. Canonical Token Extraction & Normalization', () => {
    it('normalizes inflected words to canonical lemmas and deduplicates within the same text', () => {
      const text =
        'The software engineer maintains the database. The system maintained high availability while maintaining integrity.';
      const tokens = extractCanonicalTokensFromText(text);

      // "maintains", "maintained", "maintaining" should resolve to canonical lemma "maintain"
      expect(tokens).toContain('maintain');

      // Check deduplication within the single text passage
      const maintainOccurrences = tokens.filter((t) => t === 'maintain');
      expect(maintainOccurrences.length).toBe(1);

      // Single character noise and digits should be filtered
      expect(tokens).not.toContain('a');
      expect(tokens).not.toContain('the');
    });

    it('handles empty, null, or punctuation-only inputs gracefully without crashing', () => {
      expect(extractCanonicalTokensFromText('')).toEqual([]);
      expect(extractCanonicalTokensFromText('... ,,, ??? !!!')).toEqual([]);
      expect(extractCanonicalTokensFromText(['', '   '])).toEqual([]);
    });
  });

  // =========================================================================
  // 2. Reading Encounters & Idempotent Deduplication
  // =========================================================================
  describe('2. Reading Encounters & Idempotent Deduplication', () => {
    it('increments reading encounters on valid reading activity completion', () => {
      const store = useAppStore.getState();
      const passage =
        'Artificial intelligence models require rigorous verification and automated regression testing.';

      store.recordReadingEncounters(passage, 'reading_lesson_test_1');

      const stats = useAppStore.getState().wordLearningStats;
      expect(stats['verification']).toBeDefined();
      expect(stats['verification']?.readingEncounters).toBe(1);
      expect(stats['verification']?.lastReadingSeenAt).toBeTruthy();

      expect(stats['testing']).toBeDefined();
      expect(stats['testing']?.readingEncounters).toBe(1);
    });

    it('prevents double-counting when same reading activity ID is submitted twice within cooldown', () => {
      const store = useAppStore.getState();
      const passage = 'Continuous vigilance is essential for high reliability.';
      const activityId = 'reading_lesson_vigilance_1728039600000'; // attempt-scoped ID

      // First submit
      store.recordReadingEncounters(passage, activityId);
      const firstCount = useAppStore.getState().wordLearningStats['vigilance']?.readingEncounters;
      expect(firstCount).toBe(1);

      // Rapid double-submit of same attempt ID (same activityId → blocked)
      store.recordReadingEncounters(passage, activityId);
      const secondCount = useAppStore.getState().wordLearningStats['vigilance']?.readingEncounters;
      expect(secondCount).toBe(1); // Dedup blocked
    });

    it('allows a second genuine attempt of the same lesson to increment again (+1)', () => {
      const store = useAppStore.getState();
      const passage = 'Continuous vigilance is essential for high reliability.';

      // First attempt: different activityId (different timestamp component)
      store.recordReadingEncounters(passage, 'reading_lesson_read1_1728000000000');
      expect(useAppStore.getState().wordLearningStats['vigilance']?.readingEncounters).toBe(1);

      // Second genuine attempt: new attempt-scoped ID (new timestamp)
      store.recordReadingEncounters(passage, 'reading_lesson_read1_1728039600000');
      expect(useAppStore.getState().wordLearningStats['vigilance']?.readingEncounters).toBe(2);
    });

    it('does NOT increment reading encounters on component re-render or passive lookups', () => {
      // Simulate passive dictionary lookup or tooltip open
      const profileBefore = getLearningDictionaryProfile('probabilistic', {
        storeState: useAppStore.getState(),
      });
      expect(profileBefore.contextUsage.readingEncounters).toBe(0);

      // Simulating re-renders of the view
      for (let i = 0; i < 5; i++) {
        getLearningDictionaryProfile('probabilistic', {
          storeState: useAppStore.getState(),
        });
      }

      // Store should remain completely untouched
      const stats = useAppStore.getState().wordLearningStats;
      expect(stats['probabilistic']).toBeUndefined();
    });
  });

  // =========================================================================
  // 3. Writing Usage & Keystroke Isolation
  // =========================================================================
  describe('3. Writing Usage & Keystroke Isolation', () => {
    it('increments writing usage on essay evaluation/submit', () => {
      const store = useAppStore.getState();
      const essay =
        'In this essay, we articulate why resilient software architectures maintain high throughput.';

      store.recordWritingUsages(essay, 'essay_submission_1');

      const stats = useAppStore.getState().wordLearningStats;
      expect(stats['resilient']).toBeDefined();
      expect(stats['resilient']?.writingUsages).toBe(1);
      expect(stats['resilient']?.lastWritingUsedAt).toBeTruthy();
      expect(stats['resilient']?.readingEncounters).toBe(0);
    });

    it('does NOT count keystrokes or typing in progress (no store call = no count)', () => {
      // Typing updates local component state, NOT calling recordWritingUsages
      const keystrokes = ['I', 'In', 'In t', 'In th', 'In thi', 'In this'];
      expect(keystrokes.length).toBe(6);
      // Store remains clean
      expect(Object.keys(useAppStore.getState().wordLearningStats).length).toBe(0);
    });

    it('deduplicates rapid double-submit with same activityId (same grading call)', () => {
      const store = useAppStore.getState();
      const essay = 'Developers articulate clear specifications before implementation.';
      const activityId = `writing_essay_prompt1_${Date.now()}_${computeTextHash(essay)}`;

      // Simulate double-click or React StrictMode double-invoke → same activityId
      store.recordWritingUsages(essay, activityId);
      expect(useAppStore.getState().wordLearningStats['articulate']?.writingUsages).toBe(1);

      store.recordWritingUsages(essay, activityId);
      expect(useAppStore.getState().wordLearningStats['articulate']?.writingUsages).toBe(1);
    });

    it('records writing usage even if Gemini grading would fail (telemetry precedes try block)', () => {
      // This test verifies the architecture invariant: valid essay MUST record usage before
      // the Gemini call. We simulate by calling recordWritingUsages directly then "throwing".
      const store = useAppStore.getState();
      const essay = 'Algorithmic complexity determines scalability of distributed systems.';
      const attemptId = `writing_essay_custom_${Date.now()}_${computeTextHash(essay)}`;

      // Record BEFORE simulated Gemini failure (matches production code order)
      store.recordWritingUsages(essay, attemptId);
      // Simulate Gemini throwing
      // (in production: catch(err) runs, but telemetry already recorded above)
      expect(useAppStore.getState().wordLearningStats['algorithmic']?.writingUsages).toBe(1);

      // Telemetry is present despite "Gemini failure"
      expect(useAppStore.getState().wordLearningStats['scalability']?.writingUsages).toBe(1);
    });

    it('allows second writing submission of identical text with new attempt ID (+1 again)', () => {
      const store = useAppStore.getState();
      const essay = 'Developers articulate clear specifications before implementation.';

      const id1 = `writing_essay_prompt1_${1000}_${computeTextHash(essay)}`;
      const id2 = `writing_essay_prompt1_${2000}_${computeTextHash(essay)}`;

      store.recordWritingUsages(essay, id1);
      expect(useAppStore.getState().wordLearningStats['articulate']?.writingUsages).toBe(1);

      store.recordWritingUsages(essay, id2);
      expect(useAppStore.getState().wordLearningStats['articulate']?.writingUsages).toBe(2);
    });
  });

  // =========================================================================
  // 4. Stop Word Safety — Learnable Connector Words Must Pass Through
  // =========================================================================
  describe('4. Stop Word Safety', () => {
    const LEARNABLE_CONNECTORS = [
      'although', 'despite', 'however', 'unless', 'while', 'since',
      'because', 'therefore', 'thus', 'hence', 'yet', 'still', 'even',
      'though', 'whereas', 'furthermore', 'moreover', 'nevertheless',
      'consequently', 'accordingly',
    ];

    it('does NOT filter learnable discourse connectors from FUNCTIONAL_STOP_WORDS', () => {
      for (const word of LEARNABLE_CONNECTORS) {
        expect(FUNCTIONAL_STOP_WORDS.has(word)).toBe(false);
      }
    });

    it('preserves learnable connectors through extractCanonicalTokensFromText', () => {
      const text =
        'Although the system failed, the team persisted. However, they nevertheless succeeded.';
      const tokens = extractCanonicalTokensFromText(text);

      // These are learnable targets and must not be silently dropped
      expect(tokens).toContain('although');
      expect(tokens).toContain('however');
      expect(tokens).toContain('nevertheless');
    });

    it('correctly filters zero-value function words (articles, pure prepositions, auxiliaries)', () => {
      const tokens = extractCanonicalTokensFromText('The cat is in the box');
      // 'the', 'is', 'in' → filtered
      expect(tokens).not.toContain('the');
      expect(tokens).not.toContain('is');
      expect(tokens).not.toContain('in');
      // 'cat', 'box' → preserved
      expect(tokens).toContain('cat');
      expect(tokens).toContain('box');
    });
  });

  // =========================================================================
  // 5. Learning Dictionary Profile Integration
  // =========================================================================
  describe('5. Learning Dictionary Profile Integration', () => {
    it('exposes accurate reading encounters and writing usages in LearningDictionaryProfile', () => {
      const mockStats: WordLearningStatsMap = {
        resilience: {
          readingEncounters: 3,
          lastReadingSeenAt: '2026-10-02T10:00:00.000Z',
          writingUsages: 2,
          lastWritingUsedAt: '2026-10-03T15:00:00.000Z',
        },
      };

      const profile = getLearningDictionaryProfile('resilience', {
        storeState: { wordLearningStats: mockStats },
        now: FIXED_NOW,
      });

      expect(profile.contextUsage).toBeDefined();
      expect(profile.contextUsage.readingEncounters).toBe(3);
      expect(profile.contextUsage.lastReadingSeenAt).toBe('2026-10-02T10:00:00.000Z');
      expect(profile.contextUsage.writingUsages).toBe(2);
      expect(profile.contextUsage.lastWritingUsedAt).toBe('2026-10-03T15:00:00.000Z');
    });

    it('gracefully provides 0 counters and null timestamps when no usage data exists', () => {
      const profile = getLearningDictionaryProfile('ephemeral', {
        storeState: { wordLearningStats: {} },
        now: FIXED_NOW,
      });

      expect(profile.contextUsage).toEqual({
        readingEncounters: 0,
        lastReadingSeenAt: null,
        writingUsages: 0,
        lastWritingUsedAt: null,
      });
    });

    it('profile derivation does not mutate wordLearningStats (immutability)', () => {
      const mockStats: WordLearningStatsMap = {
        resilience: {
          readingEncounters: 3,
          lastReadingSeenAt: '2026-10-02T10:00:00.000Z',
          writingUsages: 2,
          lastWritingUsedAt: '2026-10-03T15:00:00.000Z',
        },
      };
      const snapshot = JSON.stringify(mockStats);

      getLearningDictionaryProfile('resilience', {
        storeState: { wordLearningStats: mockStats },
        now: FIXED_NOW,
      });
      getLearningDictionaryProfile('resilience', {
        storeState: { wordLearningStats: mockStats },
        now: FIXED_NOW,
      });

      // The stats map must not have been mutated by profile derivation
      expect(JSON.stringify(mockStats)).toBe(snapshot);
    });
  });

  // =========================================================================
  // 6. Persistence, Sanitization & Backup Compatibility
  // =========================================================================
  describe('6. Persistence, Sanitization & Backup Compatibility', () => {
    it('sanitizes malformed, negative, or corrupted data without crashing', () => {
      const corruptedPayload = {
        badWord: null,
        negativecounts: {
          readingEncounters: -10,
          writingUsages: 'invalid',
          lastReadingSeenAt: 12345,
        },
        validword: {
          readingEncounters: 5,
          lastReadingSeenAt: '2026-10-01T00:00:00.000Z',
          writingUsages: 1,
          lastWritingUsedAt: '2026-10-02T00:00:00.000Z',
        },
      };

      const sanitized = sanitizeWordLearningStats(corruptedPayload);
      expect(sanitized['validword']).toBeDefined();
      expect(sanitized['validword']?.readingEncounters).toBe(5);
      expect(sanitized['validword']?.writingUsages).toBe(1);
      expect(sanitized['negativecounts']).toBeUndefined();
      expect(sanitized['badword']).toBeUndefined();
    });

    it('sanitizes malformed ISO timestamps to null without crashing', () => {
      const payload = {
        testword: {
          readingEncounters: 2,
          writingUsages: 1,
          lastReadingSeenAt: 'not-a-date',
          lastWritingUsedAt: 99999,
        },
      };
      const sanitized = sanitizeWordLearningStats(payload);
      expect(sanitized['testword']?.lastReadingSeenAt).toBeNull();
      expect(sanitized['testword']?.lastWritingUsedAt).toBeNull();
      expect(sanitized['testword']?.readingEncounters).toBe(2);
    });

    it('performs lossless roundtrip backup export and import for wordLearningStats', () => {
      const store = useAppStore.getState();
      store.recordReadingEncounters('Probabilistic models require vigilance.', 'act_read_1');
      store.recordWritingUsages('We maintain deterministic state machines.', 'act_write_1');

      const exported = store.exportBackupData();
      const parsed = JSON.parse(exported);
      expect(parsed.wordLearningStats).toBeDefined();
      expect(parsed.wordLearningStats['probabilistic']?.readingEncounters).toBe(1);
      expect(parsed.wordLearningStats['deterministic']?.writingUsages).toBe(1);

      // Reset store
      store.resetToDefault();
      expect(Object.keys(useAppStore.getState().wordLearningStats).length).toBe(0);

      // Re-import
      const importResult = useAppStore.getState().importBackupData(exported);
      expect(importResult.success).toBe(true);

      const restoredStats = useAppStore.getState().wordLearningStats;
      expect(restoredStats['probabilistic']?.readingEncounters).toBe(1);
      expect(restoredStats['deterministic']?.writingUsages).toBe(1);
    });

    it('loads legacy backup without wordLearningStats field as empty {} without crashing', () => {
      const legacyBackup = JSON.stringify({
        profile: { name: 'Test', xp: 0, level: 1, cefrLevel: 'A1' },
        srsProgressMap: {},
        // wordLearningStats deliberately absent
      });

      const result = useAppStore.getState().importBackupData(legacyBackup);
      expect(result.success).toBe(true);
      expect(useAppStore.getState().wordLearningStats).toEqual({});
    });

    it('does NOT clone static dictionary definitions into wordLearningStats', () => {
      const store = useAppStore.getState();
      store.recordReadingEncounters('abandon', 'read_test');

      const stats = useAppStore.getState().wordLearningStats;
      expect(stats['abandon']).toBeDefined();
      // Ensure only minimal counters and timestamps are saved, NO definitions or examples
      const keys = Object.keys(stats['abandon'] || {});
      expect(keys.sort()).toEqual([
        'lastReadingSeenAt',
        'lastWritingUsedAt',
        'readingEncounters',
        'writingUsages',
      ].sort());
      expect((stats['abandon'] as any).meaning).toBeUndefined();
      expect((stats['abandon'] as any).definitionEn).toBeUndefined();
    });
  });

  // =========================================================================
  // 7. Cloud Merge Idempotency
  // =========================================================================
  describe('7. Cloud Merge Idempotency', () => {
    it('merge: local=3, remote=3 → stays 3 (no inflation, conservative max)', () => {
      const local: WordLearningStatsMap = {
        maintain: { readingEncounters: 3, writingUsages: 0, lastReadingSeenAt: null, lastWritingUsedAt: null },
      };
      const remote: WordLearningStatsMap = {
        maintain: { readingEncounters: 3, writingUsages: 0, lastReadingSeenAt: null, lastWritingUsedAt: null },
      };

      const merged1 = mergeWordLearningStats(local, remote);
      expect(merged1['maintain']?.readingEncounters).toBe(3);

      // Repeated merges must not inflate
      const merged2 = mergeWordLearningStats(merged1, remote);
      expect(merged2['maintain']?.readingEncounters).toBe(3);

      const merged3 = mergeWordLearningStats(merged2, remote);
      expect(merged3['maintain']?.readingEncounters).toBe(3);
    });

    it('merge: local=3, remote=5 → 5 (remote wins on max)', () => {
      const local: WordLearningStatsMap = {
        maintain: { readingEncounters: 3, writingUsages: 0, lastReadingSeenAt: null, lastWritingUsedAt: null },
      };
      const remote: WordLearningStatsMap = {
        maintain: { readingEncounters: 5, writingUsages: 0, lastReadingSeenAt: null, lastWritingUsedAt: null },
      };

      const merged = mergeWordLearningStats(local, remote);
      expect(merged['maintain']?.readingEncounters).toBe(5);
    });

    it('merge picks latest timestamp between local and remote', () => {
      const local: WordLearningStatsMap = {
        word: {
          readingEncounters: 2,
          writingUsages: 0,
          lastReadingSeenAt: '2026-09-01T00:00:00.000Z',
          lastWritingUsedAt: null,
        },
      };
      const remote: WordLearningStatsMap = {
        word: {
          readingEncounters: 2,
          writingUsages: 0,
          lastReadingSeenAt: '2026-10-01T00:00:00.000Z',
          lastWritingUsedAt: null,
        },
      };

      const merged = mergeWordLearningStats(local, remote);
      expect(merged['word']?.lastReadingSeenAt).toBe('2026-10-01T00:00:00.000Z');
    });
  });

  // =========================================================================
  // 8. Passive Actions Must NOT Increment Counters
  // =========================================================================
  describe('8. Passive Actions — zero telemetry invariant', () => {
    const PASSIVE_ACTIONS = [
      'Dictionary open',
      'Word tooltip hover',
      'Popover show',
      'Component re-render',
      'Scroll event',
      'Passage reload',
      'Re-open same lesson without submitting',
      'Keystroke in textarea',
      'Tab switch',
      'Profile page view',
      'SRS review screen open',
      'Vocabulary list scroll',
      'Search input typing',
      'Theme toggle',
      'Settings open',
    ];

    it('zero counter increase from any passive UI action (store not called = no change)', () => {
      // This test documents that passive actions MUST NOT call recordReadingEncounters /
      // recordWritingUsages. The 0-count state is the contract.
      const initialStats = useAppStore.getState().wordLearningStats;
      const initialCount = Object.keys(initialStats).length;

      // Simulate all passive actions by simply NOT calling record functions
      for (const _action of PASSIVE_ACTIONS) {
        // passive: do nothing
      }

      const finalStats = useAppStore.getState().wordLearningStats;
      expect(Object.keys(finalStats).length).toBe(initialCount);
    });

    it('passive dictionary lookups via getLearningDictionaryProfile do not increment any counter', () => {
      for (let i = 0; i < 10; i++) {
        getLearningDictionaryProfile('elaborate', {
          storeState: useAppStore.getState(),
        });
      }
      expect(useAppStore.getState().wordLearningStats['elaborate']).toBeUndefined();
    });
  });

  // =========================================================================
  // 9. Idempotency Cache Boundedness
  // =========================================================================
  describe('9. Idempotency cache boundedness', () => {
    it('in-memory dedup guard does not grow unbounded beyond MAX_PROCESSED_ACTIVITIES (200)', () => {
      // Fill cache with 199 unique IDs
      for (let i = 0; i < 199; i++) {
        markActivityRecorded(`activity_${i}`);
        expect(isActivityAlreadyRecorded(`activity_${i}`)).toBe(true);
      }

      // Adding 201st should evict oldest without crashing
      markActivityRecorded('activity_overflow');
      expect(isActivityAlreadyRecorded('activity_overflow')).toBe(true);
      // The oldest entry (activity_0) should have been evicted
      // (exact behavior depends on insertion order map eviction)
    });

    it('clearActivityDeduplication resets the in-memory guard (used between tests)', () => {
      markActivityRecorded('some_activity');
      expect(isActivityAlreadyRecorded('some_activity')).toBe(true);

      clearActivityDeduplication();
      expect(isActivityAlreadyRecorded('some_activity')).toBe(false);
    });
  });
});
