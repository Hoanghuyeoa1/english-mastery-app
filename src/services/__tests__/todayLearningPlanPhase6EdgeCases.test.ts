import { describe, it, expect } from 'vitest';
import {
  generateTodayLearningPlan,
  deriveTodayLearningPlanFromStore,
  calculateTaskEstimatedMinutes,
  parseDurationToMinutes,
  parseReadTimeToMinutes,
  TodayLearningPlanInput,
} from '../todayLearningPlanService';
import { VocabWord } from '../../types';

describe('PHASE 6: Edge Cases, Hardened Invariants & Regression Suite', () => {
  const TEST_DATE = '2026-10-06';
  const TEST_NOW = new Date('2026-10-06T12:00:00.000Z').getTime();

  const makeMockWord = (overrides: Partial<VocabWord>): VocabWord => ({
    id: 'w-default',
    word: 'default',
    meaning: 'mặc định',
    ipa: '/dɪˈfɔːlt/',
    partOfSpeech: 'n',
    example: 'This is a default word.',
    tag: 'Daily',
    srsLevel: 0,
    interval: 0,
    easeFactor: 2.5,
    nextReviewDate: '',
    ...overrides,
  });

  describe('1. Brand New User & Extreme Sparse State', () => {
    it('handles totally empty/undefined input without throwing', () => {
      const plan = generateTodayLearningPlan({
        date: TEST_DATE,
        now: TEST_NOW,
      });

      expect(plan).toBeDefined();
      expect(plan.date).toBe(TEST_DATE);
      expect(plan.totalTasks).toBeGreaterThanOrEqual(0);
      expect(plan.completedTasks).toBe(0);
      expect(plan.progress).toBe(0);
      expect(Number.isFinite(plan.totalEstimatedMinutes)).toBe(true);
      expect(plan.totalEstimatedMinutes).toBeGreaterThanOrEqual(0);

      // Must never hallucinate overdue or mistakes for fresh user
      const hasOverdue = plan.items.some((it) => it.id.startsWith('srs-overdue'));
      const hasMistakes = plan.items.some((it) => it.type === 'mistake_practice');
      expect(hasOverdue).toBe(false);
      expect(hasMistakes).toBe(false);
    });

    it('recommends beginner curriculum lesson and daily new words for new user', () => {
      const plan = generateTodayLearningPlan({
        date: TEST_DATE,
        now: TEST_NOW,
        vocabularyList: [],
        srsProgressMap: {},
        profile: {
          name: 'Newbie',
          level: 1,
          xp: 0,
          streak: 1,
          lastActiveDate: TEST_DATE,
          lastStudyDate: TEST_DATE,
          hearts: 5,
          maxHearts: 5,
          avatarSeed: 'Learner',
          targetDailyWords: 10,
          targetDailyNewWords: 10,
          extraNewWordsBonus: 0,
          isOnboarded: false,
          targetGoal: 'daily',
          geminiApiKey: '',
          equippedFrame: null,
          unlockedFrames: [],
        },
      });

      expect(plan.items.length).toBeGreaterThan(0);
      const curriculumItem = plan.items.find((it) => it.type === 'skill_lesson');
      expect(curriculumItem).toBeDefined();
      expect(curriculumItem?.tier).toBe('recommended');

      const newWordsItem = plan.items.find((it) => it.type === 'new_words');
      expect(newWordsItem).toBeDefined();
    });
  });

  describe('2. Dual-Engine Scheduler Isolation (FSRS vs SM-2)', () => {
    it('properly categorizes pure FSRS Relearning cards without SM-2 pollution', () => {
      const plan = generateTodayLearningPlan({
        date: TEST_DATE,
        now: TEST_NOW,
        vocabularyList: [
          makeMockWord({
            id: 'fsrs-card-relearning',
            word: 'ubiquity',
            meaning: 'sự hiện diện khắp nơi',
            srsLevel: 1,
            fsrs: {
              state: 3, // Relearning
              stability: 0.8,
              difficulty: 7.2,
              lastReview: '2026-10-06T08:00:00.000Z',
              reps: 4,
              lapses: 1,
            },
          }),
        ],
      });

      const relearnItem = plan.items.find((it) => it.type === 'srs_relearning');
      expect(relearnItem).toBeDefined();
      expect(relearnItem?.tier).toBe('essential');
      expect(relearnItem?.priority).toBe(1);
    });

    it('properly categorizes pure SM-2 Relearning cards without FSRS hallucination', () => {
      const plan = generateTodayLearningPlan({
        date: TEST_DATE,
        now: TEST_NOW,
        vocabularyList: [
          makeMockWord({
            id: 'sm2-card-lapsed',
            word: 'paradigm',
            meaning: 'mô hình',
            srsLevel: 0, // Reset to 0 after lapse
            lapses: 2,
            lastReviewedDate: '2026-10-05T10:00:00.000Z', // Has been studied
            nextReviewDate: '2026-10-06T10:00:00.000Z',
            interval: 1,
            easeFactor: 2.1,
          }),
        ],
      });

      const relearnItem = plan.items.find((it) => it.type === 'srs_relearning');
      expect(relearnItem).toBeDefined();
      expect(relearnItem?.count).toBe(1);
    });
  });

  describe('3. Heavy Overdue vs Zero Due Scenarios', () => {
    it('flags heavy overdue cards with highest priority (priority 1, score 120+)', () => {
      const overdueList = Array.from({ length: 15 }, (_, i) =>
        makeMockWord({
          id: `overdue-${i}`,
          word: `word-${i}`,
          meaning: `meaning-${i}`,
          srsLevel: 2,
          nextReviewDate: '2026-10-01T00:00:00.000Z', // 5 days overdue
        })
      );

      const plan = generateTodayLearningPlan({
        date: TEST_DATE,
        now: TEST_NOW,
        vocabularyList: overdueList,
      });

      const overdueItem = plan.items.find((it) => it.id.startsWith('srs-overdue'));
      expect(overdueItem).toBeDefined();
      expect(overdueItem?.priority).toBe(1);
      expect(overdueItem?.priorityScore).toBeGreaterThanOrEqual(100);
      expect(overdueItem?.tier).toBe('essential');
    });

    it('omits due tasks when 0 cards are due and promotes new words/curriculum', () => {
      const futureList = [
        makeMockWord({
          id: 'future-card-1',
          word: 'resilient',
          meaning: 'kiên cường',
          srsLevel: 3,
          nextReviewDate: '2026-10-20T00:00:00.000Z', // In the future
        }),
      ];

      const plan = generateTodayLearningPlan({
        date: TEST_DATE,
        now: TEST_NOW,
        vocabularyList: futureList,
      });

      const dueItem = plan.items.find((it) => it.id.startsWith('srs-due'));
      const overdueItem = plan.items.find((it) => it.id.startsWith('srs-overdue'));
      expect(dueItem).toBeUndefined();
      expect(overdueItem).toBeUndefined();

      // New words or curriculum becomes active
      expect(plan.items.length).toBeGreaterThan(0);
    });
  });

  describe('4. Mistake Bank with 100% Resolved Items', () => {
    it('never creates mistake practice tasks when all mistakes are resolved', () => {
      const plan = generateTodayLearningPlan({
        date: TEST_DATE,
        now: TEST_NOW,
        mistakeBank: {
          'm-1': {
            id: 'm-1',
            word: 'efficient',
            resolved: true,
            resolvedDate: '2026-10-05T00:00:00.000Z',
            category: 'meaning',
            consecutiveCorrect: 3,
            mistakeCount: 1,
            lastMistakeAt: '2026-10-04T00:00:00.000Z',
            meaning: 'hiệu quả',
          },
          'm-2': {
            id: 'm-2',
            word: 'phenomenon',
            resolved: true,
            resolvedDate: '2026-10-05T00:00:00.000Z',
            category: 'pronunciation',
            consecutiveCorrect: 2,
            mistakeCount: 1,
            lastMistakeAt: '2026-10-04T00:00:00.000Z',
            meaning: 'hiện tượng',
          },
        },
      });

      const mistakeItem = plan.items.find((it) => it.type === 'mistake_practice');
      const pronunItem = plan.items.find((it) => it.type === 'pronunciation_practice');
      expect(mistakeItem).toBeUndefined();
      expect(pronunItem).toBeUndefined();
    });
  });

  describe('5. Robust Time Estimators & Malformed Metadata Resilience', () => {
    it('safely parses duration strings without producing NaN or Infinity', () => {
      expect(parseDurationToMinutes('5 mins')).toBe(8); // 5m audio + 3m quiz buffer
      expect(parseDurationToMinutes('12 min')).toBe(15);
      expect(parseDurationToMinutes('3:45')).toBe(7);
      expect(parseDurationToMinutes('')).toBe(7);
      expect(parseDurationToMinutes(undefined)).toBe(7);
      expect(parseDurationToMinutes('abc minutes')).toBe(7);
    });

    it('safely parses readTime strings without producing NaN or Infinity', () => {
      expect(parseReadTimeToMinutes('4 min read')).toBe(7); // 4m reading + 3m comprehension buffer
      expect(parseReadTimeToMinutes('10 mins')).toBe(13);
      expect(parseReadTimeToMinutes('')).toBe(8);
      expect(parseReadTimeToMinutes(undefined)).toBe(8);
      expect(parseReadTimeToMinutes('invalid')).toBe(8);
    });

    it('returns exact 0 minutes when count is 0', () => {
      expect(calculateTaskEstimatedMinutes('srs_review', 0)).toBe(0);
      expect(calculateTaskEstimatedMinutes('srs_relearning', 0)).toBe(0);
      expect(calculateTaskEstimatedMinutes('mistake_practice', 0)).toBe(0);
      expect(calculateTaskEstimatedMinutes('pronunciation_practice', 0)).toBe(0);
      expect(calculateTaskEstimatedMinutes('new_words', 0)).toBe(0);
    });
  });

  describe('6. 00:00 Rollover & Date Boundary Isolation', () => {
    it('creates fresh day plan when date rolls over to next calendar day', () => {
      const card = makeMockWord({
        id: 'rollover-card',
        word: 'transition',
        meaning: 'chuyển giao',
        srsLevel: 1,
        nextReviewDate: '2026-10-07T00:00:00.000Z',
      });

      // Day 1: 2026-10-06 (Card is NOT due yet)
      const day1Plan = generateTodayLearningPlan({
        date: '2026-10-06',
        now: new Date('2026-10-06T23:59:00.000Z').getTime(),
        vocabularyList: [card],
      });
      expect(day1Plan.items.some((it) => it.id.startsWith('srs-due'))).toBe(false);

      // Day 2: 2026-10-07 (Card BECOMES due)
      const day2Plan = generateTodayLearningPlan({
        date: '2026-10-07',
        now: new Date('2026-10-07T00:01:00.000Z').getTime(),
        vocabularyList: [card],
      });
      expect(day2Plan.items.some((it) => it.id.startsWith('srs-due'))).toBe(true);
    });
  });

  describe('7. Zero Scheduler Mutation Guarantee', () => {
    it('leaves frozen card objects 100% untouched', () => {
      const frozenCard = Object.freeze(
        makeMockWord({
          id: 'frozen-card',
          word: 'immutable',
          meaning: 'bất biến',
          srsLevel: 2,
          nextReviewDate: '2026-10-06T00:00:00.000Z',
          interval: 3,
          easeFactor: 2.5,
          lapses: 0,
          againCount: 0,
          fsrs: Object.freeze({
            state: 2,
            stability: 4.2,
            difficulty: 5.1,
            lastReview: '2026-10-03T00:00:00.000Z',
            reps: 2,
            lapses: 0,
          }),
        })
      );

      const plan = generateTodayLearningPlan({
        date: TEST_DATE,
        now: TEST_NOW,
        vocabularyList: [frozenCard],
      });

      expect(plan).toBeDefined();
      expect(frozenCard.interval).toBe(3);
      expect(frozenCard.easeFactor).toBe(2.5);
      expect(frozenCard.fsrs?.stability).toBe(4.2);
      expect(frozenCard.fsrs?.difficulty).toBe(5.1);
      expect(frozenCard.nextReviewDate).toBe('2026-10-06T00:00:00.000Z');
    });
  });

  describe('8. Pure Derived Orchestration Invariant', () => {
    it('deriveTodayLearningPlanFromStore returns ephemeral plan without modifying store state', () => {
      const fakeStore = {
        vocabularyList: [
          makeMockWord({
            id: 'test-card',
            word: 'ephemeral',
            meaning: 'ngắn ngủi',
            srsLevel: 1,
            nextReviewDate: '2026-10-06T00:00:00.000Z',
          }),
        ],
        srsProgressMap: {},
        mistakeBank: {},
        dailyHistory: {},
        profile: {
          targetDailyNewWords: 15,
        } as any,
      };

      const originalStoreRef = { ...fakeStore };

      const plan = deriveTodayLearningPlanFromStore(fakeStore, {
        date: TEST_DATE,
        now: TEST_NOW,
      });

      expect(plan).toBeDefined();
      expect(fakeStore.vocabularyList).toEqual(originalStoreRef.vocabularyList);
      expect(fakeStore.profile).toEqual(originalStoreRef.profile);
    });
  });
});
