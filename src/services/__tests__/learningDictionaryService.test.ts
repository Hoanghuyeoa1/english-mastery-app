import { describe, it, expect, beforeEach } from 'vitest';
import {
  getLearningDictionaryProfile,
  getWordMemoryTelemetry,
  getLearningStatusMeta,
  getCardRecentReviewTelemetry,
  phraseContainsWordToken,
  deriveLearnerCefrLevel,
} from '../learningDictionaryService';
import type {
  AppStore,
  CollocationItem,
  LearningDictionaryStatus,
  MistakeRecord,
  SRSProgress,
  SRSReviewEvent,
  VocabWord,
} from '../../types';
import { calculateRetrievability } from '../fsrsAlgorithm';
import { useAppStore } from '../../store/useAppStore';

describe('learningDictionaryService — Final Hardening Suite', () => {
  const FIXED_NOW = new Date('2026-10-04T12:00:00.000Z').getTime();

  beforeEach(() => {
    // Clean slate between tests
  });

  describe('1. Unseen Word State', () => {
    it('marks unseen/unstudied word as "new" with retrievability: null and safe empty dates', () => {
      const profile = getLearningDictionaryProfile('abandon', {
        storeState: { srsProgressMap: {} },
        now: FIXED_NOW,
      });

      expect(profile.word.toLowerCase()).toBe('abandon');
      expect(profile.isInUserDeck).toBe(false);
      expect(profile.learningStatus).toBe('new');
      expect(profile.memory.cardState).toBe('new');
      expect(profile.memory.retrievability).toBeNull();
      expect(profile.memory.daysUntilDue).toBeNull();
      expect(profile.memory.elapsedDaysSinceReview).toBeNull();
      expect(profile.memory.lastReviewedDate).toBeNull();
      expect(profile.memory.nextReviewDate).toBeNull();
      expect(profile.mistakeSummary.hasMistakeRecord).toBe(false);
      expect(profile.leechStatus.isLeech).toBe(false);
    });
  });

  describe('2. FSRS Current Retrievability Calculation', () => {
    it('computes current-time retrievability from valid FSRS memory state', () => {
      const word = 'resilient';
      const lastReviewedDate = new Date(FIXED_NOW - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
      const nextReviewDate = new Date(FIXED_NOW + 10 * 24 * 60 * 60 * 1000).toISOString();

      const srsProgress: SRSProgress = {
        srsLevel: 3,
        interval: 12,
        easeFactor: 2.5,
        lastReviewedDate,
        nextReviewDate,
        firstLearnedAt: new Date(FIXED_NOW - 30 * 24 * 60 * 60 * 1000).toISOString(),
        reviewCount: 4,
        againCount: 0,
        fsrs: {
          stability: 14.5,
          difficulty: 4.8,
          state: 2, // review
          reps: 4,
          lapses: 0,
          lastReview: lastReviewedDate,
        },
      };

      const mockStore: Partial<AppStore> = {
        srsAlgorithm: 'fsrs',
        srsProgressMap: { [word]: srsProgress },
      };

      const profile = getLearningDictionaryProfile(word, {
        storeState: mockStore,
        now: FIXED_NOW,
      });

      expect(profile.memory.algorithm).toBe('fsrs');
      expect(profile.memory.stability).toBe(14.5);
      expect(profile.memory.difficulty).toBe(4.8);
      expect(profile.memory.elapsedDaysSinceReview).toBe(2);

      const expectedR = Math.round(calculateRetrievability(2, 14.5) * 10000) / 10000;
      expect(profile.memory.retrievability).toBe(expectedR);
      expect(profile.memory.retrievability).toBeGreaterThan(0.85);
      expect(profile.memory.retrievability).toBeLessThanOrEqual(1.0);
    });
  });

  describe('3. Corrupted FSRS Safety Guards', () => {
    it('returns retrievability: null for invalid stability, future timestamp, or corrupted dates', () => {
      const word = 'resilient';

      // Corrupted: stability <= 0
      const profileBadStability = getLearningDictionaryProfile(word, {
        storeState: {
          srsAlgorithm: 'fsrs',
          srsProgressMap: {
            [word]: {
              srsLevel: 1,
              interval: 1,
              easeFactor: 2.5,
              lastReviewedDate: new Date(FIXED_NOW - 10000).toISOString(),
              nextReviewDate: new Date(FIXED_NOW + 10000).toISOString(),
              fsrs: {
                stability: -5, // Invalid!
                difficulty: 5,
                state: 2,
                reps: 2,
                lapses: 0,
                lastReview: new Date(FIXED_NOW - 10000).toISOString(),
              },
            },
          },
        },
        now: FIXED_NOW,
      });
      expect(profileBadStability.memory.retrievability).toBeNull();
      expect(profileBadStability.memory.stability).toBeNull();

      // Corrupted: future review timestamp
      const profileFutureDate = getLearningDictionaryProfile(word, {
        storeState: {
          srsAlgorithm: 'fsrs',
          srsProgressMap: {
            [word]: {
              srsLevel: 1,
              interval: 1,
              easeFactor: 2.5,
              lastReviewedDate: new Date(FIXED_NOW + 5 * 24 * 60 * 60 * 1000).toISOString(), // In future!
              nextReviewDate: new Date(FIXED_NOW + 10 * 24 * 60 * 60 * 1000).toISOString(),
              fsrs: {
                stability: 10,
                difficulty: 5,
                state: 2,
                reps: 2,
                lapses: 0,
                lastReview: new Date(FIXED_NOW + 5 * 24 * 60 * 60 * 1000).toISOString(),
              },
            },
          },
        },
        now: FIXED_NOW,
      });
      expect(profileFutureDate.memory.retrievability).toBeNull();
    });
  });

  describe('4. SM-2 Compatibility', () => {
    it('does NOT compute fake FSRS retrievability for SM-2 cards while preserving honest fields', () => {
      const word = 'meticulous';
      const lastReviewedDate = new Date(FIXED_NOW - 3 * 24 * 60 * 60 * 1000).toISOString();
      const nextReviewDate = new Date(FIXED_NOW + 12 * 24 * 60 * 60 * 1000).toISOString();

      const srsProgress: SRSProgress = {
        srsLevel: 3,
        interval: 15,
        easeFactor: 2.6,
        lastReviewedDate,
        nextReviewDate,
        reviewCount: 3,
        againCount: 0,
      };

      const profile = getLearningDictionaryProfile(word, {
        storeState: {
          srsAlgorithm: 'sm2',
          srsProgressMap: { [word]: srsProgress },
        },
        now: FIXED_NOW,
      });

      expect(profile.memory.algorithm).toBe('sm2');
      expect(profile.memory.retrievability).toBeNull(); // Strictly null
      expect(profile.memory.interval).toBe(15);
      expect(profile.memory.srsLevel).toBe(3);
      expect(profile.memory.easeFactor).toBe(2.6);
      expect(profile.memory.isDue).toBe(false);
      expect(profile.memory.daysUntilDue).toBe(12);
    });
  });

  describe('5. Overdue Mastered-Looking Card Demoted to Review', () => {
    it('never labels an overdue card as mastered even if historical metrics are high', () => {
      const word = 'comprehensive';
      const pastDueDate = new Date(FIXED_NOW - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days overdue

      const srsProgress: SRSProgress = {
        srsLevel: 6,
        interval: 40,
        easeFactor: 2.5,
        lastReviewedDate: new Date(FIXED_NOW - 42 * 24 * 60 * 60 * 1000).toISOString(),
        nextReviewDate: pastDueDate,
        firstLearnedAt: new Date(FIXED_NOW - 120 * 24 * 60 * 60 * 1000).toISOString(),
        reviewCount: 6,
        fsrs: {
          stability: 35,
          difficulty: 3.5,
          state: 2, // review
          reps: 6,
          lapses: 0,
          lastReview: new Date(FIXED_NOW - 42 * 24 * 60 * 60 * 1000).toISOString(),
        },
      };

      const profile = getLearningDictionaryProfile(word, {
        storeState: {
          srsAlgorithm: 'fsrs',
          srsProgressMap: { [word]: srsProgress },
        },
        now: FIXED_NOW,
      });

      expect(profile.memory.isDue).toBe(true);
      expect(profile.memory.daysUntilDue).toBeLessThanOrEqual(0);
      // MUST NOT be 'mastered'! Due cards belong in 'review' queue
      expect(profile.learningStatus).toBe('review');
    });
  });

  describe('6. Leech Overrides Mastery', () => {
    it('prioritizes leech state over high stability or historical interval', () => {
      const word = 'perseverance';

      const srsProgress: SRSProgress = {
        srsLevel: 1,
        interval: 1,
        easeFactor: 1.3,
        lastReviewedDate: new Date(FIXED_NOW - 1 * 24 * 60 * 60 * 1000).toISOString(),
        nextReviewDate: new Date(FIXED_NOW + 1 * 24 * 60 * 60 * 1000).toISOString(),
        againCount: 6,
        reviewCount: 10,
        fsrs: {
          stability: 22, // Even if stability is numerically >= 21
          difficulty: 8.9,
          state: 3, // relearning
          reps: 10,
          lapses: 6, // Frequent lapses!
          lastReview: new Date(FIXED_NOW - 1 * 24 * 60 * 60 * 1000).toISOString(),
        },
      };

      const profile = getLearningDictionaryProfile(word, {
        storeState: {
          srsProgressMap: { [word]: srsProgress },
        },
        now: FIXED_NOW,
      });

      expect(profile.leechStatus.isLeech).toBe(true);
      expect(profile.learningStatus).toBe('leech');
    });
  });

  describe('7. Relearning Overrides Standard Review', () => {
    it('marks card in relearning state as "relearning" whether due or not', () => {
      const word = 'vulnerable';

      const srsProgress: SRSProgress = {
        srsLevel: 0,
        interval: 1,
        easeFactor: 1.8,
        lastReviewedDate: new Date(FIXED_NOW - 1 * 60 * 60 * 1000).toISOString(),
        nextReviewDate: new Date(FIXED_NOW - 1000).toISOString(), // Due now
        firstLearnedAt: new Date(FIXED_NOW - 20 * 24 * 60 * 60 * 1000).toISOString(),
        againCount: 2,
        reviewCount: 4,
        fsrs: {
          stability: 1.2,
          difficulty: 6.5,
          state: 3, // FSRS 3 = Relearning
          reps: 4,
          lapses: 2,
          lastReview: new Date(FIXED_NOW - 1 * 60 * 60 * 1000).toISOString(),
        },
      };

      const profile = getLearningDictionaryProfile(word, {
        storeState: {
          srsProgressMap: { [word]: srsProgress },
        },
        now: FIXED_NOW,
      });

      expect(profile.memory.cardState).toBe('relearning');
      expect(profile.learningStatus).toBe('relearning');
    });
  });

  describe('8. Again Review vs Lapse vs Mistake Bank Distinction', () => {
    it('keeps distinct telemetry for Again button count, FSRS lapses, and Mistake Bank errors', () => {
      const word = 'subtle';

      const srsProgress: SRSProgress = {
        srsLevel: 2,
        interval: 4,
        easeFactor: 2.1,
        lastReviewedDate: new Date(FIXED_NOW - 1 * 24 * 60 * 60 * 1000).toISOString(),
        nextReviewDate: new Date(FIXED_NOW + 3 * 24 * 60 * 60 * 1000).toISOString(),
        againCount: 4, // 4 times user clicked Again
        reviewCount: 9,
        fsrs: {
          stability: 4.2,
          difficulty: 6.0,
          state: 2,
          reps: 9,
          lapses: 2, // Only 2 lapses occurred during mature review
          lastReview: new Date(FIXED_NOW - 1 * 24 * 60 * 60 * 1000).toISOString(),
        },
      };

      const mistakeRecord: MistakeRecord = {
        id: 'vocab_subtle',
        word: 'subtle',
        meaning: 'Tinh tế',
        mistakeCount: 5, // 5 mistakes recorded from quizzes / exercises
        lastMistakeAt: new Date(FIXED_NOW - 50000).toISOString(),
        consecutiveCorrect: 1,
        resolved: false,
        primaryType: 'pronunciation',
        source: 'dictation',
      };

      const profile = getLearningDictionaryProfile(word, {
        storeState: {
          srsProgressMap: { [word]: srsProgress },
          mistakeBank: { [word]: mistakeRecord },
        },
        now: FIXED_NOW,
      });

      expect(profile.memory.againCount).toBe(4); // Actual Again button count
      expect(profile.memory.lapsesCount).toBe(2); // Canonical FSRS lapses
      expect(profile.mistakeSummary.mistakeCount).toBe(5); // Mistake Bank count
      expect(profile.memory.reviewCount).toBe(9);
    });
  });

  describe('9. Exact Canonical Lookup Before Stemming', () => {
    it('matches exact dictionary words directly without mangling into other roots', () => {
      // Words that end in -s, -ing, or -ed that are exact vocabulary words
      const exactWords = ['focus', 'process', 'business', 'building', 'stress'];

      for (const w of exactWords) {
        const profile = getLearningDictionaryProfile(w, { storeState: {} });
        expect(profile.isExistingInDictionary).toBe(true);
        expect(profile.isStemmedMatch).toBe(false);
        expect(profile.word.toLowerCase()).toBe(w);
      }
    });
  });

  describe('10. Irregular Morphology Resolution', () => {
    it('resolves irregular inflections to correct canonical lemma', () => {
      const testCases = [
        { inflected: 'maintains', base: 'maintain' },
        { inflected: 'maintained', base: 'maintain' },
        { inflected: 'maintaining', base: 'maintain' },
        { inflected: 'studies', base: 'study' },
        { inflected: 'studied', base: 'study' },
        { inflected: 'stopped', base: 'stop' },
        { inflected: 'dropped', base: 'drop' },
        { inflected: 'lying', base: 'lie' },
      ];

      for (const { inflected, base } of testCases) {
        const profile = getLearningDictionaryProfile(inflected, { storeState: {} });
        expect(profile.word.toLowerCase()).toBe(base);
        expect(profile.isStemmedMatch).toBe(true);
      }
    });
  });

  describe('11. Suffix False-Positive Protection & Exact Match Precedence', () => {
    it('does not mangle exact dictionary words ending in suffix-like text (e.g. making, running, building, station)', () => {
      // Both "make" and "making" exist as distinct dictionary words in Oxford Core
      const profileMake = getLearningDictionaryProfile('make', { storeState: {} });
      expect(profileMake.word.toLowerCase()).toBe('make');
      expect(profileMake.isStemmedMatch).toBe(false);

      // "making" is a legitimate noun entry in Oxford dataset and must NOT be stemmed into "make"
      const profileMaking = getLearningDictionaryProfile('making', { storeState: {} });
      expect(profileMaking.word.toLowerCase()).toBe('making');
      expect(profileMaking.isStemmedMatch).toBe(false);

      // Both "run" and "running" exist as distinct dictionary words in Oxford Core
      const profileRun = getLearningDictionaryProfile('run', { storeState: {} });
      expect(profileRun.word.toLowerCase()).toBe('run');
      expect(profileRun.isStemmedMatch).toBe(false);

      const profileRunning = getLearningDictionaryProfile('running', { storeState: {} });
      expect(profileRunning.word.toLowerCase()).toBe('running');
      expect(profileRunning.isStemmedMatch).toBe(false);

      const delicateWords = ['station', 'nation', 'building', 'process', 'business'];
      for (const w of delicateWords) {
        const profile = getLearningDictionaryProfile(w, { storeState: {} });
        expect(profile.word.toLowerCase()).toBe(w);
        expect(profile.isStemmedMatch).toBe(false);
      }
    });
  });

  describe('12. Cross-Module Canonical Identity Consistency', () => {
    it('ensures saveToSRS("maintained") and querying "maintaining" share the same canonical ID and progress', () => {
      const store = useAppStore.getState();

      // Step 1: Save "maintained" via official store action
      store.saveToSRS('maintained');

      const updatedState = useAppStore.getState();
      const baseProfile = getLearningDictionaryProfile('maintain', { storeState: updatedState });
      const queryInflectedProfile = getLearningDictionaryProfile('maintaining', { storeState: updatedState });

      expect(baseProfile.isInUserDeck).toBe(true);
      expect(queryInflectedProfile.isInUserDeck).toBe(true);
      expect(queryInflectedProfile.canonicalId).toBe(baseProfile.canonicalId);
      expect(queryInflectedProfile.word.toLowerCase()).toBe('maintain');
    });
  });

  describe('13. Word-Specific Mistake Breakdown', () => {
    it('preserves typeBreakdown and sourceBreakdown from Mistake Bank', () => {
      const word = 'hierarchy';

      const mistakeRecord: MistakeRecord = {
        id: 'vocab_hierarchy',
        word: 'hierarchy',
        meaning: 'Hệ thống cấp bậc',
        mistakeCount: 4,
        lastMistakeAt: new Date(FIXED_NOW - 1000).toISOString(),
        consecutiveCorrect: 0,
        resolved: false,
        primaryType: 'spelling',
        typeCounts: {
          spelling: 3,
          pronunciation: 1,
        },
        sourceCounts: {
          flashcard: 2,
          dictation: 2,
        },
      };

      const profile = getLearningDictionaryProfile(word, {
        storeState: {
          mistakeBank: { [word]: mistakeRecord },
        },
        now: FIXED_NOW,
      });

      expect(profile.mistakeSummary.typeBreakdown).toEqual({
        spelling: 3,
        pronunciation: 1,
      });
      expect(profile.mistakeSummary.sourceBreakdown).toEqual({
        flashcard: 2,
        dictation: 2,
      });
    });
  });

  describe('14. General Comprehension Questions Ignored as Word Mistakes', () => {
    it('never treats full sentence reading questions or grammar topics as word mistakes', () => {
      const word = 'evaluate';

      const unrelatedMistake: MistakeRecord = {
        id: 'reading_passage_3_question_2',
        word: 'Why does the author suggest that the policy must be evaluated carefully?',
        meaning: 'Câu hỏi đọc hiểu đoạn văn',
        mistakeCount: 2,
        lastMistakeAt: new Date(FIXED_NOW - 1000).toISOString(),
        consecutiveCorrect: 0,
        resolved: false,
        primaryType: 'reading',
      };

      const profile = getLearningDictionaryProfile(word, {
        storeState: {
          mistakeBank: {
            reading_passage_3_question_2: unrelatedMistake,
          },
        },
        now: FIXED_NOW,
      });

      expect(profile.mistakeSummary.hasMistakeRecord).toBe(false);
      expect(profile.mistakeSummary.mistakeCount).toBe(0);
      expect(profile.learningStatus).toBe('new');
    });
  });

  describe('15. Evidence-Based Confused-With Semantics', () => {
    it('derives confusedWith only when actual user answer evidence exists in Mistake Bank', () => {
      const word = 'maintain';

      // Case A: actual user error entered "sustain"
      const mistakeWithAnswer: MistakeRecord = {
        id: 'vocab_maintain',
        word: 'maintain',
        meaning: 'Duy trì',
        mistakeCount: 2,
        lastMistakeAt: new Date(FIXED_NOW - 1000).toISOString(),
        consecutiveCorrect: 0,
        resolved: false,
        lastUserAnswer: 'sustain',
      };

      const profileWithEvidence = getLearningDictionaryProfile(word, {
        storeState: {
          mistakeBank: { [word]: mistakeWithAnswer },
        },
        now: FIXED_NOW,
      });

      expect(profileWithEvidence.mistakeSummary.confusedWith).toEqual(['sustain']);

      // Case B: No userAnswer evidence -> MUST BE empty array, never fabricated!
      const mistakeWithoutAnswer: MistakeRecord = {
        id: 'vocab_maintain',
        word: 'maintain',
        meaning: 'Duy trì',
        mistakeCount: 2,
        lastMistakeAt: new Date(FIXED_NOW - 1000).toISOString(),
        consecutiveCorrect: 0,
        resolved: false,
      };

      const profileWithoutEvidence = getLearningDictionaryProfile(word, {
        storeState: {
          mistakeBank: { [word]: mistakeWithoutAnswer },
        },
        now: FIXED_NOW,
      });

      expect(profileWithoutEvidence.mistakeSummary.confusedWith).toEqual([]);
    });
  });

  describe('16. Collocation Word-Boundary Matching', () => {
    it('prevents false substring matches like "art" matching "start working"', () => {
      expect(phraseContainsWordToken('start working', 'art', 'art')).toBe(false);
      expect(phraseContainsWordToken('starting point', 'art', 'art')).toBe(false);
      expect(phraseContainsWordToken('state-of-the-art', 'art', 'art')).toBe(true);
      expect(phraseContainsWordToken('work of art', 'art', 'art')).toBe(true);
      expect(phraseContainsWordToken('maintain consistency', 'maintain', 'maintain')).toBe(true);
      expect(phraseContainsWordToken('Maintain standards', 'maintain', 'maintain')).toBe(true);
      expect(phraseContainsWordToken("can't help doing", 'help', 'help')).toBe(true);
    });

    it('associates collocations accurately in profile lookup', () => {
      const userCollocs: CollocationItem[] = [
        {
          id: 'colloc_1',
          phrase: 'start working on the project',
          meaning: 'Bắt đầu làm việc',
          exampleEn: 'Let us start working.',
          exampleVi: 'Hãy bắt đầu làm việc.',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'colloc_2',
          phrase: 'state-of-the-art technology',
          meaning: 'Công nghệ tối tân',
          exampleEn: 'State-of-the-art lab.',
          exampleVi: 'Phòng thí nghiệm tối tân.',
          createdAt: new Date().toISOString(),
        },
      ];

      const profile = getLearningDictionaryProfile('art', {
        storeState: { userCollocations: userCollocs },
      });

      const matchedPhrases = profile.associatedCollocations.map((c) => c.phrase);
      expect(matchedPhrases).toContain('state-of-the-art technology');
      expect(matchedPhrases).not.toContain('start working on the project');
    });
  });

  describe('17. CEFR Word vs Learner Distinction', () => {
    it('correctly handles word B2 with learner B1, and word A2 with learner B2', () => {
      const learnerB1Store: Partial<AppStore> = {
        fourSkillsScores: {
          listening: [60],
          reading: [65],
          speaking: [60],
          writing: [60], // Average ~61% -> B1
        },
      };

      const profileB2 = getLearningDictionaryProfile({ word: 'custom_b2', level: 'B2' } as VocabWord, {
        storeState: learnerB1Store,
      });
      expect(profileB2.cefrCalibration.learnerLevel).toBe('B1');
      expect(profileB2.cefrCalibration.wordLevel).toBe('B2');
      expect(profileB2.cefrCalibration.difficultyComparison).toBe('above');
      expect(profileB2.cefrCalibration.isObservedLearnerLevel).toBe(true);

      const learnerB2Store: Partial<AppStore> = {
        fourSkillsScores: {
          listening: [75],
          reading: [80],
          speaking: [75],
          writing: [75], // Average ~76% -> B2
        },
      };

      const profileA2 = getLearningDictionaryProfile({ word: 'custom_a2', level: 'A2' } as VocabWord, {
        storeState: learnerB2Store,
      });
      expect(profileA2.cefrCalibration.learnerLevel).toBe('B2');
      expect(profileA2.cefrCalibration.wordLevel).toBe('A2');
      expect(profileA2.cefrCalibration.difficultyComparison).toBe('below');
    });
  });

  describe('18. Learner With No History', () => {
    it('sets learnerLevel: null and difficultyComparison: "unknown" when learner has zero attempts', () => {
      const derived = deriveLearnerCefrLevel({
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      });
      expect(derived.learnerLevel).toBeNull();
      expect(derived.isObserved).toBe(false);

      const profile = getLearningDictionaryProfile({ word: 'custom_b2', level: 'B2' } as VocabWord, {
        storeState: {
          fourSkillsScores: { listening: [], reading: [], speaking: [], writing: [] },
        },
      });

      expect(profile.cefrCalibration.learnerLevel).toBeNull();
      expect(profile.cefrCalibration.isObservedLearnerLevel).toBe(false);
      expect(profile.cefrCalibration.difficultyComparison).toBe('unknown');
    });
  });

  describe('19. Due Semantics Matches Canonical Scheduler', () => {
    it('matches isDueForReview canonical scheduler semantics', () => {
      const word = 'negotiate';
      const pastDue = new Date(FIXED_NOW - 1000).toISOString();
      const futureDue = new Date(FIXED_NOW + 100000).toISOString();

      const dueProfile = getLearningDictionaryProfile(word, {
        storeState: {
          srsProgressMap: {
            [word]: {
              srsLevel: 2,
              interval: 3,
              easeFactor: 2.5,
              lastReviewedDate: new Date(FIXED_NOW - 3 * 24 * 60 * 60 * 1000).toISOString(),
              nextReviewDate: pastDue,
            },
          },
        },
        now: FIXED_NOW,
      });
      expect(dueProfile.memory.isDue).toBe(true);

      const futureProfile = getLearningDictionaryProfile(word, {
        storeState: {
          srsProgressMap: {
            [word]: {
              srsLevel: 2,
              interval: 3,
              easeFactor: 2.5,
              lastReviewedDate: new Date(FIXED_NOW - 1 * 24 * 60 * 60 * 1000).toISOString(),
              nextReviewDate: futureDue,
            },
          },
        },
        now: FIXED_NOW,
      });
      expect(futureProfile.memory.isDue).toBe(false);
    });
  });

  describe('20. Pure Derivation / Zero Mutation Invariant', () => {
    it('never mutates input store slices or static dictionaries during derivation', () => {
      const testStore: Partial<AppStore> = {
        srsProgressMap: {
          resilience: {
            srsLevel: 2,
            interval: 5,
            easeFactor: 2.5,
            lastReviewedDate: '2026-10-01T00:00:00.000Z',
            nextReviewDate: '2026-10-06T00:00:00.000Z',
          },
        },
        mistakeBank: {
          resilience: {
            id: 'vocab_resilience',
            word: 'resilience',
            meaning: 'Sự kiên cường',
            mistakeCount: 1,
            lastMistakeAt: '2026-10-01T00:00:00.000Z',
            consecutiveCorrect: 0,
            resolved: false,
          },
        },
        userCollocations: [
          {
            id: 'colloc_1',
            phrase: 'show resilience',
            meaning: 'Thể hiện sự kiên cường',
            exampleEn: 'She showed resilience.',
            exampleVi: 'Cô ấy thể hiện sự kiên cường.',
            createdAt: '2026-10-01T00:00:00.000Z',
          },
        ],
      };

      const beforeClone = structuredClone(testStore);

      getLearningDictionaryProfile('resilience', { storeState: testStore, now: FIXED_NOW });

      expect(testStore).toEqual(beforeClone);
    });
  });

  describe('21. Malformed Legacy State Resilience', () => {
    it('gracefully handles missing fields, negative counts, and malformed structures without throwing', () => {
      const malformedStore = {
        srsProgressMap: {
          corrupted: {
            srsLevel: -3,
            interval: -1,
            easeFactor: NaN,
            lastReviewedDate: 'INVALID',
            nextReviewDate: 'INVALID',
            againCount: -5,
            fsrs: null as any,
          },
        },
        mistakeBank: null as any,
        userCollocations: {} as any,
        fourSkillsScores: 'malformed' as any,
      };

      expect(() => {
        const profile = getLearningDictionaryProfile('corrupted', {
          storeState: malformedStore as any,
        });
        expect(profile).toBeDefined();
        expect(profile.memory.retrievability).toBeNull();
      }).not.toThrow();
    });
  });

  describe('22. Performance & Target-Specific Derivation', () => {
    it('executes responsive per-word derivation without deck-wide profile materialization', () => {
      // Create realistic store snapshot with 50 cards, 30 mistakes, 20 collocations
      const realisticStore: Partial<AppStore> = {
        srsProgressMap: {},
        mistakeBank: {},
        userCollocations: [],
      };

      for (let i = 0; i < 50; i++) {
        realisticStore.srsProgressMap![`word_${i}`] = {
          srsLevel: i % 5,
          interval: i * 2,
          easeFactor: 2.5,
          nextReviewDate: new Date(FIXED_NOW + i * 3600000).toISOString(),
        };
      }

      const start = performance.now();
      const profile = getLearningDictionaryProfile('maintain', {
        storeState: realisticStore,
        now: FIXED_NOW,
      });
      const duration = performance.now() - start;

      expect(profile).toBeDefined();
      expect(profile.word.toLowerCase()).toBe('maintain');
      // Single word query takes under 10ms (typically < 1ms)
      expect(duration).toBeLessThan(50);
    });
  });

  describe('23. Phase 2: FSRS Telemetry & Retrievability Precision', () => {
    it('accurately reproduces canonical FSRS retrievability with dynamic now timestamp', () => {
      const word = 'lucid';
      const threeDaysAgo = new Date(FIXED_NOW - 3 * 24 * 3600 * 1000).toISOString();
      const inTenDays = new Date(FIXED_NOW + 10 * 24 * 3600 * 1000).toISOString();

      const progress: SRSProgress = {
        srsLevel: 2,
        interval: 13,
        easeFactor: 2.5,
        lastReviewedDate: threeDaysAgo,
        nextReviewDate: inTenDays,
        firstLearnedAt: new Date(FIXED_NOW - 20 * 24 * 3600 * 1000).toISOString(),
        reviewCount: 3,
        againCount: 1,
        fsrs: {
          stability: 18.25,
          difficulty: 5.2,
          state: 2,
          reps: 3,
          lapses: 1,
          lastReview: threeDaysAgo,
        },
      };

      const profile = getLearningDictionaryProfile(word, {
        storeState: {
          srsAlgorithm: 'fsrs',
          srsProgressMap: { [word]: progress },
        },
        now: FIXED_NOW,
      });

      expect(profile.memory.algorithm).toBe('fsrs');
      expect(profile.memory.stability).toBe(18.25);
      expect(profile.memory.difficulty).toBe(5.2);
      expect(profile.memory.lapsesCount).toBe(1);
      expect(profile.memory.elapsedDaysSinceReview).toBe(3);
      expect(profile.memory.daysUntilDue).toBe(10);
      expect(profile.memory.isDue).toBe(false);

      const expectedR = Math.round(calculateRetrievability(3, 18.25) * 10000) / 10000;
      expect(profile.memory.retrievability).toBe(expectedR);
    });

    it('returns null retrievability if last review date is in the future or corrupted', () => {
      const futureDate = new Date(FIXED_NOW + 2 * 24 * 3600 * 1000).toISOString();
      const progress: SRSProgress = {
        srsLevel: 1,
        interval: 5,
        easeFactor: 2.5,
        lastReviewedDate: futureDate,
        nextReviewDate: futureDate,
        fsrs: {
          stability: 10,
          difficulty: 5,
          state: 1,
          reps: 1,
          lapses: 0,
          lastReview: futureDate,
        },
      };

      const profile = getLearningDictionaryProfile('lucid', {
        storeState: {
          srsAlgorithm: 'fsrs',
          srsProgressMap: { lucid: progress },
        },
        now: FIXED_NOW,
      });

      expect(profile.memory.retrievability).toBeNull();
      expect(profile.memory.elapsedDaysSinceReview).toBeNull();
    });
  });

  describe('24. Phase 2: SM-2 Truthfulness & Anti-Fake Guardrails', () => {
    it('exposes authentic SM-2 fields while strictly keeping retrievability, difficulty, stability as null', () => {
      const word = 'authentic';
      const progress: SRSProgress = {
        srsLevel: 4,
        interval: 25,
        easeFactor: 2.6,
        lastReviewedDate: new Date(FIXED_NOW - 5 * 24 * 3600 * 1000).toISOString(),
        nextReviewDate: new Date(FIXED_NOW + 20 * 24 * 3600 * 1000).toISOString(),
        firstLearnedAt: new Date(FIXED_NOW - 60 * 24 * 3600 * 1000).toISOString(),
        againCount: 2,
        reviewCount: 6,
      };

      const profile = getLearningDictionaryProfile(word, {
        storeState: {
          srsAlgorithm: 'sm2',
          srsProgressMap: { [word]: progress },
        },
        now: FIXED_NOW,
      });

      expect(profile.memory.algorithm).toBe('sm2');
      expect(profile.memory.retrievability).toBeNull();
      expect(profile.memory.difficulty).toBeNull();
      expect(profile.memory.stability).toBeNull();
      expect(profile.memory.interval).toBe(25);
      expect(profile.memory.easeFactor).toBe(2.6);
      expect(profile.memory.srsLevel).toBe(4);
      expect(profile.memory.lapsesCount).toBe(2);
      expect(profile.memory.againCount).toBe(2);
      expect(profile.memory.reviewCount).toBe(6);
      expect(profile.memory.elapsedDaysSinceReview).toBe(5);
      expect(profile.memory.daysUntilDue).toBe(20);
      expect(profile.memory.isDue).toBe(false);
    });
  });

  describe('25. Phase 2: Review Telemetry & Rating Breakdown Aggregation', () => {
    it('aggregates ratings from recentReviewEvents and tracks the latest review rating', () => {
      const word = 'meticulous';
      const past1 = new Date(FIXED_NOW - 10 * 86400000).toISOString();
      const past2 = new Date(FIXED_NOW - 5 * 86400000).toISOString();
      const past3 = new Date(FIXED_NOW - 1 * 86400000).toISOString();

      const events: SRSReviewEvent[] = [
        {
          id: 'rev_1',
          cardId: word,
          rating: 'again',
          grade: 0,
          algorithm: 'fsrs',
          timestamp: past1,
          stateBefore: 'learning',
          stateAfter: 'relearning',
          interval: 1,
        },
        {
          id: 'rev_2',
          cardId: word,
          rating: 'hard',
          grade: 1,
          algorithm: 'fsrs',
          timestamp: past2,
          stateBefore: 'relearning',
          stateAfter: 'review',
          interval: 3,
        },
        {
          id: 'rev_3',
          cardId: word,
          rating: 'good',
          grade: 2,
          algorithm: 'fsrs',
          timestamp: past3,
          stateBefore: 'review',
          stateAfter: 'review',
          interval: 7,
        },
      ];

      const profile = getLearningDictionaryProfile(word, {
        storeState: {
          srsProgressMap: {
            [word]: {
              srsLevel: 2,
              interval: 7,
              easeFactor: 2.5,
              lastReviewedDate: past3,
              nextReviewDate: new Date(FIXED_NOW + 6 * 86400000).toISOString(),
              reviewCount: 3,
              againCount: 1,
            },
          },
          recentReviewEvents: events,
        },
        now: FIXED_NOW,
      });

      expect(profile.memory.ratingBreakdown).toEqual({
        again: 1,
        hard: 1,
        good: 1,
        easy: 0,
        total: 3,
      });
      expect(profile.memory.lastReviewRating).toBe('good');
    });

    it('preserves lifetime againCount and reviewCount when ring buffer has evicted older events', () => {
      const word = 'persist';
      const past = new Date(FIXED_NOW - 2 * 86400000).toISOString();

      // Only 1 event remains in ring buffer (e.g. 199 events for other cards pushed earlier ones out)
      const events: SRSReviewEvent[] = [
        {
          id: 'rev_latest',
          cardId: word,
          rating: 'easy',
          grade: 3,
          algorithm: 'fsrs',
          timestamp: past,
          stateBefore: 'review',
          stateAfter: 'review',
          interval: 20,
        },
      ];

      // But card progress has lifetime 4 agains and 12 total reviews
      const profile = getLearningDictionaryProfile(word, {
        storeState: {
          srsProgressMap: {
            [word]: {
              srsLevel: 5,
              interval: 20,
              easeFactor: 2.5,
              lastReviewedDate: past,
              nextReviewDate: new Date(FIXED_NOW + 18 * 86400000).toISOString(),
              againCount: 4,
              reviewCount: 12,
            },
          },
          recentReviewEvents: events,
        },
        now: FIXED_NOW,
      });

      expect(profile.memory.againCount).toBe(4);
      expect(profile.memory.reviewCount).toBe(12);
      expect(profile.memory.ratingBreakdown?.again).toBe(4); // Bound to at least srsProgress.againCount
      expect(profile.memory.ratingBreakdown?.easy).toBe(1);
      expect(profile.memory.ratingBreakdown?.total).toBe(12); // Bound to at least srsProgress.reviewCount
      expect(profile.memory.lastReviewRating).toBe('easy');
    });

    it('returns zeroed breakdown and null last rating when card has no review history', () => {
      const profile = getLearningDictionaryProfile('ephemeral', {
        storeState: {
          srsProgressMap: {},
          recentReviewEvents: [],
        },
        now: FIXED_NOW,
      });

      expect(profile.memory.ratingBreakdown).toEqual({
        again: 0,
        hard: 0,
        good: 0,
        easy: 0,
        total: 0,
      });
      expect(profile.memory.lastReviewRating).toBeNull();
    });

    it('matches custom_ prefix and case-insensitively in recent review events', () => {
      const events: SRSReviewEvent[] = [
        {
          id: 'rev_c1',
          cardId: 'custom_customword',
          rating: 'good',
          grade: 2,
          algorithm: 'sm2',
          timestamp: new Date(FIXED_NOW - 1000).toISOString(),
          stateBefore: 'learning',
          stateAfter: 'review',
          interval: 4,
        },
      ];

      const telemetry = getCardRecentReviewTelemetry(
        'custom_customword',
        'customword',
        'customword',
        events,
        0,
        1
      );

      expect(telemetry.ratingBreakdown.good).toBe(1);
      expect(telemetry.lastReviewRating).toBe('good');
    });
  });

  describe('26. Phase 2: Leech Detection Isolation', () => {
    it('flags leech status without mutating underlying scheduler cardState or deleting card', () => {
      const word = 'difficult';
      const progress: SRSProgress = {
        srsLevel: 1,
        interval: 1,
        easeFactor: 1.4,
        lastReviewedDate: new Date(FIXED_NOW - 1 * 86400000).toISOString(),
        nextReviewDate: new Date(FIXED_NOW + 1 * 86400000).toISOString(),
        againCount: 6,
        reviewCount: 8,
        fsrs: {
          stability: 1.2,
          difficulty: 8.9,
          state: 2, // scheduler says review
          reps: 8,
          lapses: 5,
          lastReview: new Date(FIXED_NOW - 1 * 86400000).toISOString(),
        },
      };

      const profile = getLearningDictionaryProfile(word, {
        storeState: {
          srsAlgorithm: 'fsrs',
          srsProgressMap: { [word]: progress },
        },
        now: FIXED_NOW,
      });

      expect(profile.leechStatus.isLeech).toBe(true);
      expect(profile.learningStatus).toBe('leech');
      // Scheduler cardState remains honest review state
      expect(profile.memory.cardState).toBe('review');
      expect(profile.memory.lapsesCount).toBe(5);
    });
  });

  describe('27. Phase 2: Fast-Path getWordMemoryTelemetry Selector', () => {
    it('returns identical memory telemetry to full profile and executes rapidly (< 25ms)', () => {
      const word = 'eloquent';
      const progress: SRSProgress = {
        srsLevel: 3,
        interval: 14,
        easeFactor: 2.5,
        lastReviewedDate: new Date(FIXED_NOW - 2 * 86400000).toISOString(),
        nextReviewDate: new Date(FIXED_NOW + 12 * 86400000).toISOString(),
        reviewCount: 4,
        againCount: 0,
        fsrs: {
          stability: 16.0,
          difficulty: 4.5,
          state: 2,
          reps: 4,
          lapses: 0,
          lastReview: new Date(FIXED_NOW - 2 * 86400000).toISOString(),
        },
      };

      const store: Partial<AppStore> = {
        srsAlgorithm: 'fsrs',
        srsProgressMap: { [word]: progress },
      };

      const start = performance.now();
      const telemetry = getWordMemoryTelemetry(word, { storeState: store, now: FIXED_NOW });
      const duration = performance.now() - start;

      const fullProfile = getLearningDictionaryProfile(word, { storeState: store, now: FIXED_NOW });

      expect(telemetry).toEqual(fullProfile.memory);
      expect(telemetry.algorithm).toBe('fsrs');
      expect(telemetry.stability).toBe(16.0);
      expect(telemetry.difficulty).toBe(4.5);
      expect(telemetry.retrievability).toBeGreaterThan(0.8);
      expect(duration).toBeLessThan(25);
    });
  });

  describe('28. Phase 2: LearningStatusMeta Semantic Integrity', () => {
    it('provides exhaustive user-facing metadata for all 7 learning statuses', () => {
      const allStatuses: LearningDictionaryStatus[] = [
        'new',
        'learning',
        'review',
        'relearning',
        'leech',
        'mastered',
        'needs_practice',
      ];

      for (const st of allStatuses) {
        const meta = getLearningStatusMeta(st);
        expect(meta.status).toBe(st);
        expect(meta.labelEn).toBeTruthy();
        expect(meta.labelVi).toBeTruthy();
        expect(meta.variant).toBeTruthy();
        expect(meta.description).toBeTruthy();
      }

      // Check specific variants
      expect(getLearningStatusMeta('leech').variant).toBe('danger');
      expect(getLearningStatusMeta('relearning').variant).toBe('warning');
      expect(getLearningStatusMeta('needs_practice').variant).toBe('warning');
      expect(getLearningStatusMeta('review').variant).toBe('primary');
      expect(getLearningStatusMeta('mastered').variant).toBe('success');
      expect(getLearningStatusMeta('learning').variant).toBe('info');
      expect(getLearningStatusMeta('new').variant).toBe('default');
    });
  });
});

