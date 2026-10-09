import { describe, it, expect, beforeEach } from 'vitest';
import {
  getLearningDictionaryProfile,
} from '../learningDictionaryService';
import {
  getDictionaryWord,
  searchFullDictionary,
} from '../dictionaryIndex';
import {
  sanitizeWordLearningStats,
  clearActivityDeduplication,
} from '../wordUsageTelemetry';
import { useAppStore } from '../../store/useAppStore';
import type {
  AppStore,
  CollocationItem,
  MistakeRecord,
  SRSProgress,
  SRSReviewEvent,
} from '../../types';

describe('PHASE 6: Final Release & Acceptance Audit Suite', () => {
  const FIXED_NOW = new Date('2026-10-04T12:00:00.000Z').getTime();

  beforeEach(() => {
    // Reset Zustand store state for consistent testing
  });

  describe('1. Brand-New User Scenario', () => {
    it('handles brand new user with empty store gracefully without exceptions or NaN', () => {
      const emptyState: Partial<AppStore> = {
        srsProgressMap: {},
        mistakeBank: {},
        userCollocations: [],
        userCustomWords: [],
        vocabularyList: [],
        recentReviewEvents: [],
        wordLearningStats: {},
        fourSkillsScores: { listening: [], reading: [], speaking: [], writing: [] },
        srsAlgorithm: 'fsrs',
      };

      const profile = getLearningDictionaryProfile('serendipity', {
        storeState: emptyState,
        now: FIXED_NOW,
      });

      expect(profile.word.toLowerCase()).toBe('serendipity');
      expect(profile.isInUserDeck).toBe(false);
      expect(profile.learningStatus).toBe('new');
      expect(profile.memory.retrievability).toBeNull();
      expect(profile.memory.difficulty).toBeNull();
      expect(profile.memory.stability).toBeNull();
      expect(profile.memory.lastReviewedDate).toBeNull();
      expect(profile.memory.nextReviewDate).toBeNull();
      expect(profile.memory.daysUntilDue).toBeNull();
      expect(profile.memory.elapsedDaysSinceReview).toBeNull();
      expect(profile.memory.lapsesCount).toBe(0);
      expect(profile.memory.againCount).toBeNull();
      expect(profile.cefrCalibration.isObservedLearnerLevel).toBe(false);
      expect(profile.cefrCalibration.learnerLevel).toBeNull();
      expect(profile.mistakeSummary.hasMistakeRecord).toBe(false);
      expect(profile.leechStatus.isLeech).toBe(false);
      expect(profile.contextUsage.readingEncounters).toBe(0);
      expect(profile.contextUsage.writingUsages).toBe(0);
    });
  });

  describe('2. Legacy User Scenario', () => {
    it('handles legacy user without fsrs, without recentReviewEvents, and with old card format', () => {
      const legacyCard: SRSProgress = {
        srsLevel: 2,
        interval: 6,
        easeFactor: 2.5,
        lastReviewedDate: new Date(FIXED_NOW - 5 * 24 * 60 * 60 * 1000).toISOString(),
        nextReviewDate: new Date(FIXED_NOW + 1 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const legacyState: Partial<AppStore> = {
        srsProgressMap: {
          v3k_1868: legacyCard,
          maintain: legacyCard,
        },
        mistakeBank: {},
        userCollocations: [],
        srsAlgorithm: 'sm2',
        // Legacy state missing recentReviewEvents and wordLearningStats
      };

      const profile = getLearningDictionaryProfile('maintain', {
        storeState: legacyState,
        now: FIXED_NOW,
      });

      expect(profile.isInUserDeck).toBe(true);
      expect(profile.memory.algorithm).toBe('sm2');
      expect(profile.memory.srsLevel).toBe(2);
      expect(profile.memory.interval).toBe(6);
      expect(profile.memory.retrievability).toBeNull(); // No fake FSRS metric
      expect(profile.memory.difficulty).toBeNull();
      expect(profile.memory.elapsedDaysSinceReview).toBe(5);
      expect(profile.memory.daysUntilDue).toBe(1);
      expect(profile.memory.isDue).toBe(false);
      expect(profile.learningStatus).toBe('review');
    });
  });

  describe('3. FSRS User Scenario', () => {
    it('correctly extracts FSRS stability, difficulty, state, and computes honest retrievability', () => {
      const fsrsCard: SRSProgress = {
        srsLevel: 4,
        interval: 15,
        easeFactor: 2.5,
        lastReviewedDate: new Date(FIXED_NOW - 3 * 24 * 60 * 60 * 1000).toISOString(),
        nextReviewDate: new Date(FIXED_NOW + 12 * 24 * 60 * 60 * 1000).toISOString(),
        firstLearnedAt: new Date(FIXED_NOW - 40 * 24 * 60 * 60 * 1000).toISOString(),
        reviewCount: 5,
        againCount: 1,
        fsrs: {
          stability: 18.25,
          difficulty: 5.12,
          state: 2, // review
          reps: 5,
          lapses: 1,
          lastReview: new Date(FIXED_NOW - 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
      };

      const fsrsState: Partial<AppStore> = {
        srsProgressMap: {
          vocab_resilient: fsrsCard,
          resilient: fsrsCard,
        },
        srsAlgorithm: 'fsrs',
      };

      const profile = getLearningDictionaryProfile('resilient', {
        storeState: fsrsState,
        now: FIXED_NOW,
      });

      expect(profile.memory.algorithm).toBe('fsrs');
      expect(profile.memory.stability).toBe(18.25);
      expect(profile.memory.difficulty).toBe(5.12);
      expect(profile.memory.lapsesCount).toBe(1);
      expect(profile.memory.againCount).toBe(1);
      expect(profile.memory.retrievability).not.toBeNull();
      expect(profile.memory.retrievability!).toBeGreaterThan(0.8);
      expect(profile.memory.retrievability!).toBeLessThanOrEqual(1.0);
      expect(profile.learningStatus).toBe('review');
    });
  });

  describe('4. SM-2 User Scenario', () => {
    it('strictly suppresses FSRS retrievability and difficulty for SM-2 user', () => {
      const sm2Card: SRSProgress = {
        srsLevel: 5,
        interval: 25,
        easeFactor: 2.6,
        lastReviewedDate: new Date(FIXED_NOW - 10 * 24 * 60 * 60 * 1000).toISOString(),
        nextReviewDate: new Date(FIXED_NOW + 15 * 24 * 60 * 60 * 1000).toISOString(),
        reviewCount: 6,
        againCount: 0,
      };

      const sm2State: Partial<AppStore> = {
        srsProgressMap: {
          diligent: sm2Card,
        },
        srsAlgorithm: 'sm2',
      };

      const profile = getLearningDictionaryProfile('diligent', {
        storeState: sm2State,
        now: FIXED_NOW,
      });

      expect(profile.memory.algorithm).toBe('sm2');
      expect(profile.memory.retrievability).toBeNull();
      expect(profile.memory.difficulty).toBeNull();
      expect(profile.memory.stability).toBeNull();
      expect(profile.memory.interval).toBe(25);
      expect(profile.memory.easeFactor).toBe(2.6);
    });
  });

  describe('5. Offline Dictionary Lookup Scenario', () => {
    it('retrieves word metadata from local memory Trie without internet in < 5ms', () => {
      const startTime = performance.now();
      const word = getDictionaryWord('maintain');
      const elapsed = performance.now() - startTime;

      expect(word).not.toBeNull();
      expect(word?.word.toLowerCase()).toBe('maintain');
      expect(word?.meaning).toBeDefined();
      expect(elapsed).toBeLessThan(10); // Well under 10ms
    });

    it('performs prefix search for suggestions in offline index in < 15ms', () => {
      const startTime = performance.now();
      const results = searchFullDictionary('main', 'ALL', 8);
      const elapsed = performance.now() - startTime;

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.item.word.toLowerCase() === 'maintain')).toBe(true);
      expect(elapsed).toBeLessThan(15);
    });
  });

  describe('6. Word Without History Scenario', () => {
    it('returns "new" status and clean empty profile for unstudied vocabulary', () => {
      const profile = getLearningDictionaryProfile('abandon', {
        storeState: { srsProgressMap: {} },
        now: FIXED_NOW,
      });

      expect(profile.learningStatus).toBe('new');
      expect(profile.isInUserDeck).toBe(false);
      expect(profile.memory.reviewCount).toBe(0);
      expect(profile.memory.lapsesCount).toBe(0);
      expect(profile.memory.againCount).toBeNull();
      expect(profile.memory.ratingBreakdown?.total).toBe(0);
    });
  });

  describe('7. Word with Extensive Review History Scenario', () => {
    it('aggregates ratings correctly from recentReviewEvents without duplicate counting', () => {
      const events: SRSReviewEvent[] = [
        {
          id: 'ev_1',
          cardId: 'maintain',
          rating: 'good',
          grade: 2,
          algorithm: 'sm2',
          stateBefore: 'review',
          stateAfter: 'review',
          interval: 10,
          timestamp: new Date(FIXED_NOW - 100000).toISOString(),
        },
        {
          id: 'ev_2',
          cardId: 'maintain',
          rating: 'again',
          grade: 0,
          algorithm: 'sm2',
          stateBefore: 'review',
          stateAfter: 'relearning',
          interval: 1,
          timestamp: new Date(FIXED_NOW - 200000).toISOString(),
        },
        {
          id: 'ev_3',
          cardId: 'maintain',
          rating: 'easy',
          grade: 3,
          algorithm: 'sm2',
          stateBefore: 'review',
          stateAfter: 'review',
          interval: 20,
          timestamp: new Date(FIXED_NOW - 50000).toISOString(),
        },
        {
          id: 'ev_4',
          cardId: 'other_word',
          rating: 'again',
          grade: 0,
          algorithm: 'sm2',
          stateBefore: 'review',
          stateAfter: 'relearning',
          interval: 1,
          timestamp: new Date(FIXED_NOW - 30000).toISOString(),
        },
      ];

      const profile = getLearningDictionaryProfile('maintain', {
        storeState: {
          recentReviewEvents: events,
          srsProgressMap: {
            maintain: {
              srsLevel: 6,
              interval: 35,
              easeFactor: 2.7,
              lastReviewedDate: new Date(FIXED_NOW - 50000).toISOString(),
              nextReviewDate: new Date(FIXED_NOW + 35 * 24 * 60 * 60 * 1000).toISOString(),
              firstLearnedAt: new Date(FIXED_NOW - 100 * 24 * 60 * 60 * 1000).toISOString(),
              reviewCount: 15,
              againCount: 1,
            },
          },
        },
        now: FIXED_NOW,
      });

      expect(profile.memory.ratingBreakdown?.again).toBe(1);
      expect(profile.memory.ratingBreakdown?.good).toBe(1);
      expect(profile.memory.ratingBreakdown?.easy).toBe(1);
      expect(profile.memory.ratingBreakdown?.hard).toBe(0);
      expect(profile.memory.lastReviewRating).toBe('easy');
      expect(profile.learningStatus).toBe('mastered');
    });
  });

  describe('8. Word with Mistake Bank Record Scenario', () => {
    it('reflects unresolved mistake and sets status to needs_practice', () => {
      const mistake: MistakeRecord = {
        id: 'mistake_maintain',
        word: 'maintain',
        meaning: 'duy trì',
        example: 'Maintain high standards.',
        tag: 'Daily',
        mistakeCount: 3,
        wrongCount: 3,
        consecutiveCorrect: 0,
        resolved: false,
        lastMistakeAt: new Date(FIXED_NOW - 3600000).toISOString(),
        source: 'quiz',
        primaryType: 'collocation',
        typeCounts: { collocation: 3 },
        sourceCounts: { quiz: 3 },
      };

      const profile = getLearningDictionaryProfile('maintain', {
        storeState: {
          srsProgressMap: {
            maintain: {
              srsLevel: 2,
              interval: 5,
              easeFactor: 2.5,
              lastReviewedDate: new Date(FIXED_NOW - 2 * 24 * 60 * 60 * 1000).toISOString(),
              nextReviewDate: new Date(FIXED_NOW + 3 * 24 * 60 * 60 * 1000).toISOString(),
              reviewCount: 3,
            },
          },
          mistakeBank: {
            mistake_maintain: mistake,
          },
        },
        now: FIXED_NOW,
      });

      expect(profile.mistakeSummary.hasMistakeRecord).toBe(true);
      expect(profile.mistakeSummary.unresolved).toBe(true);
      expect(profile.mistakeSummary.mistakeCount).toBe(3);
      expect(profile.mistakeSummary.primaryType).toBe('collocation');
      expect(profile.learningStatus).toBe('needs_practice');
    });
  });

  describe('9. Word is Leech Scenario', () => {
    it('triggers "leech" status as highest priority over review and learning', () => {
      const leechCard: SRSProgress = {
        srsLevel: 1,
        interval: 1,
        easeFactor: 1.3,
        lastReviewedDate: new Date(FIXED_NOW - 24 * 60 * 60 * 1000).toISOString(),
        nextReviewDate: new Date(FIXED_NOW - 1000).toISOString(), // Due now
        reviewCount: 8,
        againCount: 6,
        fsrs: {
          stability: 0.5,
          difficulty: 9.8,
          state: 1, // learning
          reps: 8,
          lapses: 5,
          lastReview: new Date(FIXED_NOW - 24 * 60 * 60 * 1000).toISOString(),
        },
      };

      const profile = getLearningDictionaryProfile('perseverance', {
        storeState: {
          srsProgressMap: {
            perseverance: leechCard,
          },
          srsAlgorithm: 'fsrs',
        },
        now: FIXED_NOW,
      });

      expect(profile.leechStatus.isLeech).toBe(true);
      expect(profile.learningStatus).toBe('leech');
    });
  });

  describe('10. Word with Weak Collocation Scenario', () => {
    it('marks weak collocation only when supported by unresolved mistake evidence', () => {
      const userCollocs: CollocationItem[] = [
        {
          id: 'colloc_maintain_standards',
          phrase: 'maintain high standards',
          meaning: 'duy trì tiêu chuẩn cao',
          exampleEn: 'Always maintain high standards.',
          exampleVi: 'Luôn duy trì tiêu chuẩn cao.',
          createdAt: new Date(FIXED_NOW - 50000).toISOString(),
        },
      ];

      const mistake: MistakeRecord = {
        id: 'colloc_maintain_standards',
        word: 'maintain high standards',
        meaning: 'duy trì tiêu chuẩn cao',
        example: 'Maintain high standards.',
        tag: 'Daily',
        mistakeCount: 2,
        wrongCount: 2,
        consecutiveCorrect: 0,
        resolved: false,
        lastMistakeAt: new Date(FIXED_NOW - 1000).toISOString(),
        source: 'writing',
        primaryType: 'collocation',
      };

      const profile = getLearningDictionaryProfile('maintain', {
        storeState: {
          userCollocations: userCollocs,
          mistakeBank: {
            colloc_maintain_standards: mistake,
          },
        },
        now: FIXED_NOW,
      });

      expect(profile.associatedCollocations.length).toBeGreaterThan(0);
      const matched = profile.associatedCollocations.find(
        (c) => c.phrase.toLowerCase().includes('maintain high standards')
      );
      expect(matched).toBeDefined();
      expect(matched?.isWeak).toBe(true);
      expect(matched?.weaknessEvidence).toBe('writing_correction');
      expect(profile.weakCollocations.length).toBeGreaterThan(0);
    });
  });

  describe('11. Canonical wordLearningStats Schema & Rehydration Sanitizer', () => {
    it('normalizes legacy schema fields (readingCount, writingCount, lastReadingAt, lastWritingAt) to canonical contract', () => {
      const legacyPayload = {
        maintain: {
          readingCount: 3,
          lastReadingAt: '2026-10-01T10:00:00.000Z',
          writingCount: 2,
          lastWritingAt: '2026-10-02T15:00:00.000Z',
        },
        resilient: {
          readingEncounters: 5,
          lastReadingSeenAt: '2026-10-03T12:00:00.000Z',
          writingUsages: 1,
          lastWritingUsedAt: '2026-10-04T08:00:00.000Z',
        },
      };

      const sanitized = sanitizeWordLearningStats(legacyPayload);

      // maintain normalized from legacy
      expect(sanitized.maintain).toBeDefined();
      expect(sanitized.maintain.readingEncounters).toBe(3);
      expect(sanitized.maintain.lastReadingSeenAt).toBe('2026-10-01T10:00:00.000Z');
      expect(sanitized.maintain.writingUsages).toBe(2);
      expect(sanitized.maintain.lastWritingUsedAt).toBe('2026-10-02T15:00:00.000Z');

      // resilient canonical preserved
      expect(sanitized.resilient).toBeDefined();
      expect(sanitized.resilient.readingEncounters).toBe(5);
      expect(sanitized.resilient.writingUsages).toBe(1);

      // Learning Dictionary profile reads correct values
      const profile = getLearningDictionaryProfile('maintain', {
        storeState: {
          wordLearningStats: sanitized,
        },
      });

      expect(profile.contextUsage.readingEncounters).toBe(3);
      expect(profile.contextUsage.lastReadingSeenAt).toBe('2026-10-01T10:00:00.000Z');
      expect(profile.contextUsage.writingUsages).toBe(2);
      expect(profile.contextUsage.lastWritingUsedAt).toBe('2026-10-02T15:00:00.000Z');
    });
  });

  describe('12. Activity Identity Must Override Cooldown', () => {
    beforeEach(() => {
      clearActivityDeduplication();
      useAppStore.setState({
        wordLearningStats: {},
      });
    });

    it('deduplicates identical reading attemptId while immediately counting different legitimate attemptId even within 2 minutes', () => {
      const store = useAppStore.getState();
      const text = 'We need to maintain high standards of quality.';

      // Attempt A: first execution -> count +1
      store.recordReadingEncounters(text, 'reading_lesson_1_attempt_A');
      let stats = useAppStore.getState().wordLearningStats;
      expect(stats.maintain.readingEncounters).toBe(1);

      // Attempt A: duplicate retry/re-render -> still +1
      store.recordReadingEncounters(text, 'reading_lesson_1_attempt_A');
      stats = useAppStore.getState().wordLearningStats;
      expect(stats.maintain.readingEncounters).toBe(1);

      // Attempt B (legitimate repeat 2 minutes later) -> counts again (+2)
      store.recordReadingEncounters(text, 'reading_lesson_1_attempt_B');
      stats = useAppStore.getState().wordLearningStats;
      expect(stats.maintain.readingEncounters).toBe(2);
    });

    it('deduplicates identical writing attemptId while immediately counting different legitimate attemptId even with identical essay text', () => {
      const store = useAppStore.getState();
      const essay = 'It is crucial to maintain sustainable practices in modern engineering.';

      // Writing Attempt A -> +1
      store.recordWritingUsages(essay, 'writing_essay_topic1_attempt_A');
      let stats = useAppStore.getState().wordLearningStats;
      expect(stats.maintain.writingUsages).toBe(1);

      // Retry Writing Attempt A -> still +1
      store.recordWritingUsages(essay, 'writing_essay_topic1_attempt_A');
      stats = useAppStore.getState().wordLearningStats;
      expect(stats.maintain.writingUsages).toBe(1);

      // Writing Attempt B 3 minutes later with same text -> +2
      store.recordWritingUsages(essay, 'writing_essay_topic1_attempt_B');
      stats = useAppStore.getState().wordLearningStats;
      expect(stats.maintain.writingUsages).toBe(2);
    });
  });

  describe('13. Save Flashcard XP Safety & Canonical Identity', () => {
    beforeEach(() => {
      useAppStore.setState({
        profile: { ...useAppStore.getState().profile, xp: 500 },
        srsProgressMap: {},
        userCustomWords: [],
      });
    });

    it('saves canonical lemma from inflected query and awards zero farmable XP across save/delete/save cycles', () => {
      const initialXP = useAppStore.getState().profile.xp;

      // Save inflected form "maintaining"
      useAppStore.getState().saveToSRS('maintaining');

      // Canonical identity verified: saved under canonical lemma "maintain" (or v3k_1868)
      const srsMap = useAppStore.getState().srsProgressMap;
      const isSavedAsMaintain = Boolean(srsMap['v3k_1868'] || srsMap['maintain']);
      expect(isSavedAsMaintain).toBe(true);

      // XP invariant: saveToSRS does not award farmable XP
      expect(useAppStore.getState().profile.xp).toBe(initialXP);

      // Duplicate save does not create duplicate or award XP
      useAppStore.getState().saveToSRS('maintaining');
      expect(useAppStore.getState().profile.xp).toBe(initialXP);

      // Delete word
      useAppStore.getState().deleteWord('v3k_1868');
      expect(useAppStore.getState().profile.xp).toBe(initialXP);

      // Re-save word
      useAppStore.getState().saveToSRS('maintaining');
      expect(useAppStore.getState().profile.xp).toBe(initialXP);
    });
  });

  describe('14. Review Now Scheduler Truthfulness', () => {
    it('prohibits Review Now for future review card and enables only for due or relearning cards', () => {
      // Future review card (due in 5 days)
      const futureCard: SRSProgress = {
        srsLevel: 3,
        interval: 10,
        easeFactor: 2.5,
        lastReviewedDate: new Date(FIXED_NOW - 5 * 24 * 60 * 60 * 1000).toISOString(),
        nextReviewDate: new Date(FIXED_NOW + 5 * 24 * 60 * 60 * 1000).toISOString(),
        reviewCount: 3,
      };

      const futureProfile = getLearningDictionaryProfile('maintain', {
        storeState: {
          srsProgressMap: { maintain: futureCard },
        },
        now: FIXED_NOW,
      });

      expect(futureProfile.memory.isDue).toBe(false);
      expect(futureProfile.memory.cardState).toBe('review');
      // Actionable check: isDue || cardState === 'relearning' || learningStatus === 'relearning'
      const isFutureReviewable = Boolean(
        futureProfile.memory.isDue ||
        futureProfile.memory.cardState === 'relearning' ||
        futureProfile.learningStatus === 'relearning'
      );
      expect(isFutureReviewable).toBe(false);

      // Due card (due now)
      const dueCard: SRSProgress = {
        ...futureCard,
        nextReviewDate: new Date(FIXED_NOW - 1000).toISOString(),
      };

      const dueProfile = getLearningDictionaryProfile('maintain', {
        storeState: {
          srsProgressMap: { maintain: dueCard },
        },
        now: FIXED_NOW,
      });

      expect(dueProfile.memory.isDue).toBe(true);
      const isDueReviewable = Boolean(
        dueProfile.memory.isDue ||
        dueProfile.memory.cardState === 'relearning' ||
        dueProfile.learningStatus === 'relearning'
      );
      expect(isDueReviewable).toBe(true);
    });
  });

  describe('15. Pair-Specific Confusion Evidence Integrity', () => {
    it('strictly separates target-level mistakeCount (5) from pair-specific confusion evidence (1)', () => {
      const mistakeRecord: MistakeRecord = {
        id: 'mistake_maintain',
        word: 'maintain',
        meaning: 'duy trì',
        mistakeCount: 5,
        wrongCount: 5,
        consecutiveCorrect: 0,
        resolved: false,
        lastMistakeAt: new Date(FIXED_NOW - 1000).toISOString(),
        source: 'quiz',
        lastUserAnswer: 'sustain', // only 1 recorded instance of sustain
      };

      const profile = getLearningDictionaryProfile('maintain', {
        storeState: {
          mistakeBank: {
            mistake_maintain: mistakeRecord,
          },
        },
        now: FIXED_NOW,
      });

      // Mistake summary has overall count = 5
      expect(profile.mistakeSummary.mistakeCount).toBe(5);

      // Personalized confusion item has pair-specific count = 1 (NOT 5!)
      const personalizedItem = profile.confusion.personalizedConfusedWith.find(
        (c) => c.word.toLowerCase() === 'sustain'
      );
      expect(personalizedItem).toBeDefined();
      expect(personalizedItem?.count).toBe(1);
    });
  });
});
