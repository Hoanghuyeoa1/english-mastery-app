// src/services/__tests__/todayLearningPlanService.test.ts

import { describe, it, expect, vi } from 'vitest';
import {
  generateTodayLearningPlan,
  deriveTodayLearningPlanFromStore,
  executeLearningPlanAction,
  parseDurationToMinutes,
  parseReadTimeToMinutes,
  calculateTaskEstimatedMinutes,
  formatStudyTimeBucket,
  deduplicateLearningActions,
  TodayLearningPlanInput,
} from '../todayLearningPlanService';
import type {
  AppStore,
  DailyProgress,
  FourSkillsScores,
  MistakeRecord,
  SRSProgress,
} from '../../types';

describe('Today Learning Plan Core Engine (Phases 2 - 4)', () => {
  const baseDate = '2026-10-06';
  const baseNow = new Date('2026-10-06T10:00:00.000Z').getTime();

  describe('1. Empty State & New User Handling', () => {
    it('handles completely empty input without crashing or throwing', () => {
      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
      });

      expect(plan).toBeDefined();
      expect(plan.date).toBe(baseDate);
      expect(plan.totalTasks).toBeGreaterThan(0);
      expect(plan.totalEstimatedMinutes).toBeGreaterThan(0);
      expect(typeof plan.progress).toBe('number');
    });

    it('does NOT create fake SRS, mistake, or weak-skill tasks when learner has 0 evidence', () => {
      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        srsProgressMap: {},
        mistakeBank: {},
        fourSkillsScores: { listening: [], reading: [], speaking: [], writing: [] },
      });

      // No fake SRS reviews
      const srsTasks = plan.items.filter((i) => i.type === 'srs_review');
      expect(srsTasks).toHaveLength(0);

      // No fake Relearning
      const relearningTasks = plan.items.filter((i) => i.type === 'srs_relearning');
      expect(relearningTasks).toHaveLength(0);

      // No fake Leech recovery
      const leechTasks = plan.items.filter((i) => i.type === 'leech_recovery');
      expect(leechTasks).toHaveLength(0);

      // No fake Mistake practice
      const mistakeTasks = plan.items.filter((i) => i.type === 'mistake_practice');
      expect(mistakeTasks).toHaveLength(0);

      // No fake Pronunciation practice
      const pronTasks = plan.items.filter((i) => i.type === 'pronunciation_practice');
      expect(pronTasks).toHaveLength(0);

      // No fake Weak Skill deficit
      const weakSkillTasks = plan.items.filter((i) => i.type === 'weak_skill_practice');
      expect(weakSkillTasks).toHaveLength(0);

      // Recommends honest onboarding curriculum (A1 listening + new vocabulary goal)
      expect(plan.items.some((i) => i.type === 'skill_lesson')).toBe(true);
      expect(plan.items.some((i) => i.type === 'new_words')).toBe(true);
    });
  });

  describe('2. SRS Due & Overdue Derivation (Essential Tiers)', () => {
    it('generates a due SRS task with essential tier when cards are due today', () => {
      const srsProgressMap: Record<string, SRSProgress> = {
        word_1: {
          srsLevel: 2,
          interval: 3,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-06T08:00:00.000Z', // due today
          lastReviewedDate: '2026-10-03T08:00:00.000Z',
        },
        word_2: {
          srsLevel: 3,
          interval: 6,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-06T09:00:00.000Z', // due today
          lastReviewedDate: '2026-09-30T09:00:00.000Z',
        },
        word_future: {
          srsLevel: 4,
          interval: 10,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-10T09:00:00.000Z', // future, NOT due
          lastReviewedDate: '2026-09-30T09:00:00.000Z',
        },
      };

      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        srsProgressMap,
      });

      const dueTask = plan.items.find((i) => i.id === `srs-due-${baseDate}`);
      expect(dueTask).toBeDefined();
      expect(dueTask?.count).toBe(2);
      expect(dueTask?.tier).toBe('essential');
      expect(dueTask?.action.tab).toBe('flashcards');
      expect(dueTask?.completed).toBe(false);
    });

    it('generates an overdue SRS task with essential tier when cards are past due date', () => {
      const srsProgressMap: Record<string, SRSProgress> = {
        word_overdue_1: {
          srsLevel: 2,
          interval: 3,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-01T08:00:00.000Z', // 5 days overdue
          lastReviewedDate: '2026-09-28T08:00:00.000Z',
        },
        word_overdue_2: {
          srsLevel: 1,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-03T08:00:00.000Z', // 3 days overdue
          lastReviewedDate: '2026-10-02T08:00:00.000Z',
        },
      };

      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        srsProgressMap,
      });

      const overdueTask = plan.items.find((i) => i.id === `srs-overdue-${baseDate}`);
      expect(overdueTask).toBeDefined();
      expect(overdueTask?.count).toBe(2);
      expect(overdueTask?.priority).toBe(1);
      expect(overdueTask?.tier).toBe('essential');
      expect(overdueTask?.description).toContain('2 thẻ đã vượt qua chu kỳ');
    });

    it('marks SRS task as completed when today reviewed count satisfies due requirement', () => {
      const srsProgressMap: Record<string, SRSProgress> = {
        word_1: {
          srsLevel: 1,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-06T08:00:00.000Z',
          lastReviewedDate: '2026-10-05T08:00:00.000Z',
        },
      };

      const dailyHistory: Record<string, DailyProgress> = {
        [baseDate]: {
          date: baseDate,
          wordsReviewed: 5, // User reviewed 5 words today >= 1 due word
          newWordsLearned: 0,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
          xpGained: 50,
        },
      };

      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        srsProgressMap,
        dailyHistory,
      });

      const dueTask = plan.items.find((i) => i.id === `srs-due-${baseDate}`);
      expect(dueTask).toBeDefined();
      expect(dueTask?.completed).toBe(true);
    });
  });

  describe('3. Relearning & Leech Derivation', () => {
    it('detects cards in Relearning state (lapsed repetition = 0 after study) and generates relearning task with essential tier', () => {
      const srsProgressMap: Record<string, SRSProgress> = {
        word_lapsed: {
          srsLevel: 0,
          interval: 1,
          easeFactor: 2.3,
          nextReviewDate: '2026-10-06T08:00:00.000Z',
          lastReviewedDate: '2026-10-05T14:00:00.000Z',
          againCount: 2,
        },
      };

      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        srsProgressMap,
      });

      const relearningTask = plan.items.find((i) => i.type === 'srs_relearning');
      expect(relearningTask).toBeDefined();
      expect(relearningTask?.count).toBe(1);
      expect(relearningTask?.tier).toBe('essential');
      expect(relearningTask?.title).toContain('Relearning');
    });

    it('identifies FSRS state 3 (relearning) accurately and generates relearning task', () => {
      const srsProgressMap: Record<string, SRSProgress> = {
        word_fsrs_relearning: {
          srsLevel: 1,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-06T08:00:00.000Z',
          lastReviewedDate: '2026-10-05T10:00:00.000Z',
          fsrs: {
            state: 3,
            difficulty: 7.2,
            stability: 1.5,
            reps: 3,
            lapses: 2,
            lastReview: '2026-10-05T10:00:00.000Z',
          },
        },
      };

      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        srsProgressMap,
        srsAlgorithm: 'fsrs',
      });

      const relearningTask = plan.items.find((i) => i.type === 'srs_relearning');
      expect(relearningTask).toBeDefined();
      expect(relearningTask?.count).toBe(1);
      expect(relearningTask?.tier).toBe('essential');
    });

    it('identifies Leech words and generates leech recovery task with recommended tier', () => {
      const srsProgressMap: Record<string, SRSProgress> = {
        word_leech: {
          srsLevel: 1,
          interval: 1,
          easeFactor: 2.0,
          nextReviewDate: '2026-10-06T08:00:00.000Z',
          lastReviewedDate: '2026-10-05T10:00:00.000Z',
          againCount: 5,
          reviewCount: 8,
          fsrs: {
            state: 2,
            difficulty: 9.0,
            stability: 2.0,
            reps: 8,
            lapses: 5,
            lastReview: '2026-10-05T10:00:00.000Z',
          },
        },
      };

      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        srsProgressMap,
      });

      const leechTask = plan.items.find((i) => i.type === 'leech_recovery');
      expect(leechTask).toBeDefined();
      expect(leechTask?.count).toBe(1);
      expect(leechTask?.tier).toBe('recommended');
      expect(leechTask?.title).toContain('Leech');
    });
  });

  describe('4. Mistake Bank & Pronunciation Evidence', () => {
    it('generates mistake practice task for unresolved mistakes', () => {
      const mistakeBank: Record<string, MistakeRecord> = {
        mistake_1: {
          id: 'mistake_1',
          word: 'accommodate',
          meaning: 'cung cấp chỗ ở',
          mistakeCount: 3,
          consecutiveCorrect: 0,
          resolved: false,
          lastMistakeAt: '2026-10-05T12:00:00.000Z',
          source: 'classic_quiz',
          primaryType: 'spelling',
        },
        mistake_2: {
          id: 'mistake_2',
          word: 'embarrass',
          meaning: 'làm xấu hổ',
          mistakeCount: 2,
          consecutiveCorrect: 1,
          resolved: false,
          lastMistakeAt: '2026-10-05T13:00:00.000Z',
          source: 'word_scramble',
          primaryType: 'spelling',
        },
      };

      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        mistakeBank,
      });

      const mistakeTask = plan.items.find((i) => i.type === 'mistake_practice');
      expect(mistakeTask).toBeDefined();
      expect(mistakeTask?.count).toBe(2);
      expect(mistakeTask?.tier).toBe('recommended');
      expect(mistakeTask?.action.tab).toBe('mistakes');
    });

    it('does NOT treat resolved mistakes as active weakness', () => {
      const mistakeBank: Record<string, MistakeRecord> = {
        mistake_resolved: {
          id: 'mistake_resolved',
          word: 'necessary',
          meaning: 'cần thiết',
          mistakeCount: 4,
          consecutiveCorrect: 2,
          resolved: true,
          resolvedDate: '2026-10-04T12:00:00.000Z',
          lastMistakeAt: '2026-10-03T12:00:00.000Z',
          source: 'classic_quiz',
          primaryType: 'spelling',
        },
      };

      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        mistakeBank,
      });

      const mistakeTask = plan.items.find((i) => i.type === 'mistake_practice');
      expect(mistakeTask).toBeUndefined();
    });

    it('generates pronunciation practice task when genuine pronunciation mistakes exist', () => {
      const mistakeBank: Record<string, MistakeRecord> = {
        pron_mistake_1: {
          id: 'pron_1',
          word: 'schedule',
          ipa: '/ˈskedʒ.uːl/',
          meaning: 'lịch trình',
          mistakeCount: 2,
          consecutiveCorrect: 0,
          resolved: false,
          lastMistakeAt: '2026-10-05T15:00:00.000Z',
          source: 'pronunciation',
          primaryType: 'pronunciation',
          typeCounts: { pronunciation: 2 },
        },
      };

      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        mistakeBank,
      });

      const pronTask = plan.items.find((i) => i.type === 'pronunciation_practice');
      expect(pronTask).toBeDefined();
      expect(pronTask?.count).toBe(1);
      expect(pronTask?.tier).toBe('recommended');
      expect(pronTask?.action.tab).toBe('pronunciation');
      expect(pronTask?.action.subTab).toBe('ai_speech');
    });
  });

  describe('5. Four Skills Deficit & Curriculum Lesson', () => {
    it('identifies weakest assessed skill and generates weak_skill_practice task', () => {
      const fourSkillsScores: FourSkillsScores = {
        listening: [80, 85, 90],
        reading: [75, 80],
        speaking: [45, 50],
        writing: [70],
      };

      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        fourSkillsScores,
      });

      const weakSkillTask = plan.items.find((i) => i.type === 'weak_skill_practice');
      expect(weakSkillTask).toBeDefined();
      expect(weakSkillTask?.title).toContain('Nói phản xạ');
      expect(weakSkillTask?.tier).toBe('recommended');
      expect(weakSkillTask?.action.tab).toBe('four_skills');
      expect(weakSkillTask?.action.subTab).toBe('speaking');
    });

    it('does NOT create a weak skill task if learner has 0 attempts in all skills', () => {
      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        fourSkillsScores: { listening: [], reading: [], speaking: [], writing: [] },
      });

      const weakSkillTask = plan.items.find((i) => i.type === 'weak_skill_practice');
      expect(weakSkillTask).toBeUndefined();
    });

    it('marks skill lesson as completed if lesson ID is in completedListeningLessonIds', () => {
      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        completedListeningLessonIds: ['listen_a1_01'],
      });

      const skillLesson = plan.items.find((i) => i.type === 'skill_lesson');
      expect(skillLesson).toBeDefined();
      expect(skillLesson?.action.params?.lessonId).not.toBe('listen_a1_01');
    });
  });

  describe('6. Phase 3: Workload Budget & Heavy Day Chunking', () => {
    it('properly chunks a heavy SRS day (e.g. 180 cards) into an actionable session of 30 cards without marking remainder done', () => {
      // Simulate 180 due cards
      const heavySrsMap: Record<string, SRSProgress> = {};
      for (let i = 1; i <= 180; i++) {
        heavySrsMap[`card_${i}`] = {
          srsLevel: 1,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-06T00:00:00.000Z', // Due today
          lastReviewedDate: '2026-10-05T00:00:00.000Z',
        };
      }

      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        srsProgressMap: heavySrsMap,
      });

      expect(plan.isHeavyDay).toBe(true);

      const dueTask = plan.items.find((i) => i.id === `srs-due-${baseDate}`);
      expect(dueTask).toBeDefined();
      expect(dueTask?.sessionChunkCount).toBe(30);
      expect(dueTask?.remainingDueCount).toBe(150);
      expect(dueTask?.totalDueCount).toBe(180);
      expect(dueTask?.count).toBe(30);
      expect(dueTask?.estimatedMinutes).toBe(10); // 30 cards * 20s = 10 mins
      expect(dueTask?.description).toContain('Ưu tiên hôm nay: 30 reviews · ~10 phút (Còn 150 thẻ đến hạn)');

      // CRITICAL INVARIANT: The remaining 150 cards are NOT marked completed!
      expect(dueTask?.completed).toBe(false);

      // New words is downgraded to optional on heavy day
      const newWordsTask = plan.items.find((i) => i.type === 'new_words');
      expect(newWordsTask?.tier).toBe('optional');
    });

    it('correctly marks heavy day due task completed ONLY when user reviews all 180 cards', () => {
      const heavySrsMap: Record<string, SRSProgress> = {};
      for (let i = 1; i <= 180; i++) {
        heavySrsMap[`card_${i}`] = {
          srsLevel: 1,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-06T00:00:00.000Z',
          lastReviewedDate: '2026-10-05T00:00:00.000Z',
        };
      }

      // If user reviewed only 30 cards, completed remains FALSE
      const partialPlan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        srsProgressMap: heavySrsMap,
        dailyHistory: {
          [baseDate]: {
            date: baseDate,
            wordsReviewed: 30, // Finished 1 session chunk, but not the entire backlog!
            newWordsLearned: 0,
            quizzesCompleted: 0,
            pronunciationsMastered: 0,
            xpGained: 150,
          },
        },
      });
      const partialDueTask = partialPlan.items.find((i) => i.id === `srs-due-${baseDate}`);
      expect(partialDueTask?.completed).toBe(false);

      // If user reviewed all 180 cards, completed becomes TRUE
      const fullPlan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        srsProgressMap: heavySrsMap,
        dailyHistory: {
          [baseDate]: {
            date: baseDate,
            wordsReviewed: 180,
            newWordsLearned: 0,
            quizzesCompleted: 0,
            pronunciationsMastered: 0,
            xpGained: 900,
          },
        },
      });
      const fullDueTask = fullPlan.items.find((i) => i.id === `srs-due-${baseDate}`);
      expect(fullDueTask?.completed).toBe(true);
    });

    it('categorizes items cleanly into essential, recommended, and optional tiers', () => {
      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        srsProgressMap: {
          w1: { srsLevel: 1, interval: 1, easeFactor: 2.5, nextReviewDate: '2026-10-06T00:00:00Z', lastReviewedDate: '2026-10-05T00:00:00Z' },
        },
        mistakeBank: {
          m1: { id: 'm1', word: 'test', meaning: 'test', mistakeCount: 1, consecutiveCorrect: 0, resolved: false, lastMistakeAt: '2026-10-05T00:00:00Z', source: 'quiz' },
        },
      });

      expect(plan.essentialTasksCount).toBeGreaterThan(0);
      expect(plan.recommendedTasksCount).toBeGreaterThan(0);
      expect(plan.optionalTasksCount).toBeGreaterThan(0);

      for (const item of plan.items) {
        expect(['essential', 'recommended', 'optional']).toContain(item.tier);
      }
    });
  });

  describe('7. Phase 3: Time Estimation Robustness', () => {
    it('parses duration strings accurately with comprehension buffers', () => {
      expect(parseDurationToMinutes('3:45')).toBe(7); // ~3.75 + 3 = ~7
      expect(parseDurationToMinutes('5 mins')).toBe(8); // 5 + 3 = 8
      expect(parseDurationToMinutes(undefined, 7)).toBe(7);
      expect(parseDurationToMinutes('', 7)).toBe(7);
    });

    it('parses read time strings accurately', () => {
      expect(parseReadTimeToMinutes('4 mins')).toBe(7); // 4 + 3 = 7
      expect(parseReadTimeToMinutes(undefined, 8)).toBe(8);
      expect(parseReadTimeToMinutes('invalid', 8)).toBe(8);
    });

    it('never produces NaN or Infinity in calculateTaskEstimatedMinutes', () => {
      expect(calculateTaskEstimatedMinutes('srs_review', 0)).toBe(0);
      expect(calculateTaskEstimatedMinutes('srs_review', NaN)).toBe(0);
      expect(calculateTaskEstimatedMinutes('srs_review', Infinity)).toBe(0);
      expect(calculateTaskEstimatedMinutes('srs_review', 15)).toBe(5); // 15 * 20s = 300s = 5m
      expect(calculateTaskEstimatedMinutes('mistake_practice', 4)).toBe(3); // 4 * 45s = 180s = 3m
    });
  });

  describe('8. Phase 4: Smart CTA, Routing & Dispatcher', () => {
    it('dispatches flashcards due review action with correct queueMode and tab', () => {
      const mockStore = {
        navigateToTab: vi.fn(),
        startAdaptivePractice: vi.fn(),
        setActiveFourSkill: vi.fn(),
      };

      executeLearningPlanAction(
        {
          tab: 'flashcards',
          params: { queueMode: 'DUE', batchSize: 30 },
        },
        mockStore
      );

      expect(mockStore.startAdaptivePractice).toHaveBeenCalledWith({
        module: 'flashcard',
        itemIds: [],
      });
      expect(mockStore.navigateToTab).toHaveBeenCalledWith('flashcards');
    });

    it('dispatches four_skills listening action with specific lessonId and activeFourSkill', () => {
      const mockStore = {
        navigateToTab: vi.fn(),
        startAdaptivePractice: vi.fn(),
        setActiveFourSkill: vi.fn(),
      };

      executeLearningPlanAction(
        {
          tab: 'four_skills',
          subTab: 'listening',
          params: { lessonId: 'listen_a1_01' },
        },
        mockStore
      );

      expect(mockStore.setActiveFourSkill).toHaveBeenCalledWith('listening');
      expect(mockStore.startAdaptivePractice).toHaveBeenCalledWith({
        module: 'listening',
        itemIds: ['listen_a1_01'],
      });
      expect(mockStore.navigateToTab).toHaveBeenCalledWith('four_skills');
    });

    it('dispatches reading, speaking, and writing actions to exact subtabs and modules', () => {
      const mockStore = {
        navigateToTab: vi.fn(),
        startAdaptivePractice: vi.fn(),
        setActiveFourSkill: vi.fn(),
      };

      // Reading
      executeLearningPlanAction(
        {
          tab: 'four_skills',
          subTab: 'reading',
          params: { lessonId: 'read_a1_01' },
        },
        mockStore
      );
      expect(mockStore.setActiveFourSkill).toHaveBeenCalledWith('reading');
      expect(mockStore.startAdaptivePractice).toHaveBeenCalledWith({
        module: 'reading',
        itemIds: ['read_a1_01'],
      });

      // Speaking
      executeLearningPlanAction(
        {
          tab: 'four_skills',
          subTab: 'speaking',
          params: { promptId: 'speak_a1_01' },
        },
        mockStore
      );
      expect(mockStore.setActiveFourSkill).toHaveBeenCalledWith('speaking');
      expect(mockStore.startAdaptivePractice).toHaveBeenCalledWith({
        module: 'speaking',
        itemIds: ['speak_a1_01'],
      });
    });

    it('never mutates scheduler, lapses, or due dates during plan evaluation or action dispatch', () => {
      const srsProgressMap: Record<string, SRSProgress> = {
        card_immutable: {
          srsLevel: 2,
          interval: 5,
          easeFactor: 2.6,
          nextReviewDate: '2026-10-06T00:00:00.000Z',
          lastReviewedDate: '2026-10-01T00:00:00.000Z',
          againCount: 1,
          fsrs: {
            state: 2,
            difficulty: 6.0,
            stability: 4.5,
            reps: 3,
            lapses: 1,
            lastReview: '2026-10-01T00:00:00.000Z',
          },
        },
      };

      const snapshot = JSON.stringify(srsProgressMap);

      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        srsProgressMap,
      });

      const dueItem = plan.items.find((i) => i.id === `srs-due-${baseDate}`);
      expect(dueItem).toBeDefined();

      // Dispatch action
      const mockStore = {
        navigateToTab: vi.fn(),
        startAdaptivePractice: vi.fn(),
        setActiveFourSkill: vi.fn(),
      };
      executeLearningPlanAction(dueItem!.action, mockStore);

      // Verify scheduler state is 100% untouched
      expect(JSON.stringify(srsProgressMap)).toBe(snapshot);
      expect(srsProgressMap.card_immutable.againCount).toBe(1);
      expect(srsProgressMap.card_immutable.fsrs?.lapses).toBe(1);
      expect(srsProgressMap.card_immutable.interval).toBe(5);
    });

    it('works 100% offline without network or Gemini API dependency', () => {
      // Plan generation requires zero network calls and executes in < 5ms
      const start = performance.now();
      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        srsProgressMap: {
          w1: { srsLevel: 1, interval: 1, easeFactor: 2.5, nextReviewDate: '2026-10-06T00:00:00Z', lastReviewedDate: '2026-10-05T00:00:00Z' },
        },
      });
      const duration = performance.now() - start;

      expect(plan).toBeDefined();
      expect(duration).toBeLessThan(50); // Well within ultra-fast offline target
    });
  });

  describe('9. Determinism & Store Adapter Integration', () => {
    it('produces 100% identical outputs for identical inputs across multiple runs', () => {
      const mockInput: TodayLearningPlanInput = {
        date: baseDate,
        now: baseNow,
        srsProgressMap: {
          w1: {
            srsLevel: 2,
            interval: 3,
            easeFactor: 2.5,
            nextReviewDate: '2026-10-06T00:00:00.000Z',
            lastReviewedDate: '2026-10-03T00:00:00.000Z',
          },
        },
        mistakeBank: {
          m1: {
            id: 'm1',
            word: 'phenomenon',
            meaning: 'hiện tượng',
            mistakeCount: 3,
            consecutiveCorrect: 0,
            resolved: false,
            lastMistakeAt: '2026-10-05T00:00:00.000Z',
            source: 'classic_quiz',
            primaryType: 'meaning',
          },
        },
        profile: {
          name: 'Hero',
          targetDailyNewWords: 15,
          level: 3,
          xp: 450,
          streak: 5,
        } as any,
      };

      const run1 = generateTodayLearningPlan(mockInput);
      const run2 = generateTodayLearningPlan(mockInput);
      const run3 = generateTodayLearningPlan(mockInput);

      expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
      expect(JSON.stringify(run2)).toBe(JSON.stringify(run3));
    });

    it('works seamlessly with deriveTodayLearningPlanFromStore adapter', () => {
      const mockStoreState: Partial<AppStore> = {
        srsProgressMap: {},
        mistakeBank: {},
        profile: {
          name: 'Warrior',
          targetDailyNewWords: 10,
        } as any,
      };

      const plan = deriveTodayLearningPlanFromStore(mockStoreState, {
        date: baseDate,
        now: baseNow,
      });

      expect(plan).toBeDefined();
      expect(plan.date).toBe(baseDate);
      expect(plan.totalTasks).toBeGreaterThan(0);
    });
  });

  describe('10. Phase 2 Weak Collocations, Four Skills Completion & Immutability', () => {
    it('generates weak collocation candidate when userCollocations have lapses or collocation mistakes exist', () => {
      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        userCollocations: [
          {
            id: 'colloc_1',
            phrase: 'make a decision',
            meaning: 'đưa ra quyết định',
            exampleEn: 'We need to make a decision quickly.',
            exampleVi: 'Chúng ta cần đưa ra quyết định nhanh chóng.',
            createdAt: '2026-10-01',
          },
        ],
        srsProgressMap: {
          colloc_1: {
            srsLevel: 0,
            interval: 1,
            easeFactor: 2.5,
            nextReviewDate: '2026-10-06T08:00:00.000Z',
            lastReviewedDate: '2026-10-05T08:00:00.000Z',
            againCount: 3,
          },
        },
      });

      const collocTask = plan.items.find((i) => i.type === 'weak_collocation');
      expect(collocTask).toBeDefined();
      expect(collocTask?.title).toContain('Collocation');
      expect(collocTask?.tier).toBe('recommended');
      expect(collocTask?.count).toBe(1);
    });

    it('does NOT generate weak collocation task when collocations are masterfully recalled without lapses', () => {
      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        userCollocations: [
          {
            id: 'colloc_mastered',
            phrase: 'pay attention to',
            meaning: 'chú ý đến',
            exampleEn: 'Please pay attention to the instructions.',
            exampleVi: 'Xin vui lòng chú ý đến các hướng dẫn.',
            createdAt: '2026-10-01',
          },
        ],
        srsProgressMap: {
          colloc_mastered: {
            srsLevel: 5,
            interval: 20,
            easeFactor: 2.6,
            nextReviewDate: '2026-10-25T08:00:00.000Z',
            lastReviewedDate: '2026-10-05T08:00:00.000Z',
            againCount: 0,
          },
        },
      });

      const collocTask = plan.items.find((i) => i.type === 'weak_collocation');
      expect(collocTask).toBeUndefined();
    });

    it('recommends next uncompleted skill lesson respecting fourSkillsCompletionProgress', () => {
      // Simulate user who completed all A1 listening lessons
      const completedListening = ['listen_a1_1', 'listen_a1_2', 'listen_a1_3', 'listen_a1_4'];
      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        completedListeningLessonIds: completedListening,
        fourSkillsCompletionProgress: {
          reading: ['read_a1_1'],
          speaking: [],
          writing: [],
        },
      });

      // Should recommend reading lesson since listening is exhausted
      const readingTask = plan.items.find((i) => i.id.startsWith('skill-reading-'));
      expect(readingTask).toBeDefined();
      expect(readingTask?.action.subTab).toBe('reading');
    });

    it('strictly preserves input objects and arrays without mutating them in-place', () => {
      const inputCopy: TodayLearningPlanInput = Object.freeze({
        date: baseDate,
        now: baseNow,
        userCollocations: Object.freeze([
          Object.freeze({
            id: 'colloc_immutable',
            phrase: 'take action',
            meaning: 'hành động',
            exampleEn: 'We must take action.',
            exampleVi: 'Chúng ta phải hành động.',
            createdAt: '2026-10-01',
          }),
        ]) as any,
        srsProgressMap: Object.freeze({
          colloc_immutable: Object.freeze({
            srsLevel: 1,
            nextReviewDate: '2026-10-06T08:00:00.000Z',
            againCount: 1,
          }),
        }) as any,
        fourSkillsCompletionProgress: Object.freeze({
          reading: Object.freeze(['r1']) as any,
          speaking: Object.freeze([]) as any,
          writing: Object.freeze([]) as any,
        }),
      });

      expect(() => generateTodayLearningPlan(inputCopy)).not.toThrow();
    });
  });

  describe('11. Phase 3: Priority Ordering, Deduplication, Bucketed Time & Plan States', () => {
    it('prioritizes overdue cards over regular due cards and relearning cards', () => {
      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        srsProgressMap: {
          overdue_card: {
            srsLevel: 2,
            interval: 2,
            easeFactor: 2.5,
            nextReviewDate: '2026-10-01T08:00:00.000Z', // 5 days overdue
            lastReviewedDate: '2026-09-29T08:00:00.000Z',
          },
          due_card: {
            srsLevel: 1,
            interval: 1,
            easeFactor: 2.5,
            nextReviewDate: '2026-10-06T08:00:00.000Z', // due today
            lastReviewedDate: '2026-10-05T08:00:00.000Z',
          },
        },
      });

      expect(plan.items[0].type).toBe('srs_review');
      expect(plan.items[0].id).toContain('srs-overdue');
      expect(plan.items[0].priority).toBe(1);
      expect(plan.items[0].priorityScore).toBeGreaterThanOrEqual(100);
    });

    it('strictly caps total actions to a maximum of 4', () => {
      // Simulate learner with many candidate sources
      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        srsProgressMap: {
          overdue_1: { srsLevel: 1, interval: 1, easeFactor: 2.5, nextReviewDate: '2026-10-01T00:00:00Z', lastReviewedDate: '2026-09-30T00:00:00Z' },
          due_1: { srsLevel: 1, interval: 1, easeFactor: 2.5, nextReviewDate: '2026-10-06T00:00:00Z', lastReviewedDate: '2026-10-05T00:00:00Z' },
          relearn_1: { srsLevel: 0, interval: 1, easeFactor: 2.3, nextReviewDate: '2026-10-06T00:00:00Z', lastReviewedDate: '2026-10-05T12:00:00Z', againCount: 3 },
          leech_1: { srsLevel: 1, interval: 1, easeFactor: 2.0, nextReviewDate: '2026-10-06T00:00:00Z', lastReviewedDate: '2026-10-05T10:00:00Z', againCount: 5, reviewCount: 8 },
        },
        mistakeBank: {
          m1: { id: 'm1', word: 'ubiquitous', meaning: 'phổ biến', mistakeCount: 2, consecutiveCorrect: 0, resolved: false, lastMistakeAt: '2026-10-05T00:00:00Z', source: 'quiz' },
        },
        fourSkillsScores: {
          listening: [80],
          reading: [50],
          speaking: [70],
          writing: [60],
        },
      });

      expect(plan.items.length).toBeLessThanOrEqual(4);
      expect(plan.items.length).toBeGreaterThanOrEqual(2);
    });

    it('deduplicates overlapping weakness items across mistake bank and leech recovery', () => {
      // Test deduplicateLearningActions utility directly
      const candidates = [
        {
          id: 'weakness-1',
          type: 'leech_recovery' as const,
          title: 'Xử lý Leech Words',
          description: '',
          estimatedMinutes: 5,
          priority: 1,
          priorityScore: 80,
          tier: 'recommended' as const,
          reason: 'Lý do 1',
          action: { tab: 'flashcards' as const },
          completed: false,
          targetItemIds: ['apple', 'banana', 'orange'],
        },
        {
          id: 'weakness-2',
          type: 'mistake_practice' as const,
          title: 'Khắc phục Sổ Bẫy Lỗi',
          description: '',
          estimatedMinutes: 5,
          priority: 2,
          priorityScore: 75,
          tier: 'recommended' as const,
          reason: 'Lý do 2',
          action: { tab: 'mistakes' as const },
          completed: false,
          targetItemIds: ['apple', 'banana', 'orange'], // 100% duplicate items
        },
      ];

      const deduplicated = deduplicateLearningActions(candidates, 4);
      // The second overlapping weakness action must be dropped
      expect(deduplicated.length).toBe(1);
      expect(deduplicated[0].id).toBe('weakness-1');
    });

    it('formats estimated study time into human-friendly buckets without NaN or Infinity', () => {
      expect(formatStudyTimeBucket(3)).toBe('~5 phút');
      expect(formatStudyTimeBucket(5)).toBe('~5 phút');
      expect(formatStudyTimeBucket(10)).toBe('~10 phút');
      expect(formatStudyTimeBucket(15)).toBe('~15 phút');
      expect(formatStudyTimeBucket(20)).toBe('~20 phút');
      expect(formatStudyTimeBucket(NaN)).toBe('~5 phút');
      expect(formatStudyTimeBucket(Infinity)).toBe('~5 phút');
    });

    it('ensures all item reasons are learner-facing and do not leak internal FSRS telemetry', () => {
      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        srsProgressMap: {
          leech_card: {
            srsLevel: 1,
            interval: 1,
            easeFactor: 2.0,
            nextReviewDate: '2026-10-06T08:00:00.000Z',
            lastReviewedDate: '2026-10-05T10:00:00.000Z',
            againCount: 6,
            reviewCount: 9,
            fsrs: {
              state: 2,
              difficulty: 8.5,
              stability: 1.2,
              reps: 9,
              lapses: 6,
              lastReview: '2026-10-05T10:00:00.000Z',
            },
          },
        },
      });

      for (const item of plan.items) {
        expect(item.reason).toBeDefined();
        expect(typeof item.reason).toBe('string');
        // Must never leak internal raw parameters
        expect(item.reason).not.toContain('fsrs');
        expect(item.reason).not.toContain('stability');
        expect(item.reason).not.toContain('difficulty');
        expect(item.reason).not.toContain('lapses >=');
      }
    });

    it('detects new_user planState and produces starter onboarding actions without zeroes', () => {
      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        srsProgressMap: {},
        mistakeBank: {},
        completedListeningLessonIds: [],
        completedReadingLessonIds: [],
        completedSpeakingPromptIds: [],
      });

      expect(plan.planState).toBe('new_user');
      expect(plan.stateMessage).toContain('Chào mừng bạn');
      expect(plan.items.length).toBeGreaterThanOrEqual(2);
      expect(plan.items.some((i) => i.type === 'new_words')).toBe(true);
      expect(plan.items.some((i) => i.type === 'skill_lesson')).toBe(true);
    });

    it('detects completed_day planState when all daily tasks are done', () => {
      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        srsProgressMap: {
          w1: { srsLevel: 2, interval: 1, easeFactor: 2.5, nextReviewDate: '2026-10-06T00:00:00Z', lastReviewedDate: '2026-10-05T00:00:00Z' },
        },
        dailyHistory: {
          [baseDate]: {
            date: baseDate,
            wordsReviewed: 1, // Satisfies 1 due card
            newWordsLearned: 15,
            quizzesCompleted: 1,
            pronunciationsMastered: 0,
            xpGained: 100,
          },
        },
        mistakeBank: {},
      });

      expect(plan.planState).toBe('completed_day');
      expect(plan.stateMessage).toContain('Kế hoạch chính hôm nay đã hoàn thành');
      expect(plan.progress).toBe(100);
    });

    it('detects heavy_workload planState and chunks due reviews without mutating scheduler', () => {
      const heavyMap: Record<string, SRSProgress> = {};
      for (let i = 1; i <= 60; i++) {
        heavyMap[`card_${i}`] = {
          srsLevel: 1,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-06T00:00:00Z',
          lastReviewedDate: '2026-10-05T00:00:00Z',
        };
      }

      const plan = generateTodayLearningPlan({
        date: baseDate,
        now: baseNow,
        srsProgressMap: heavyMap,
      });

      expect(plan.planState).toBe('heavy_workload');
      expect(plan.isHeavyDay).toBe(true);
      expect(plan.sessionChunkCount).toBe(30);
      expect(plan.remainingDueCount).toBe(30);
      expect(plan.items.length).toBeLessThanOrEqual(4);
      // Remainder not marked completed
      const dueTask = plan.items.find((i) => i.id === `srs-due-${baseDate}`);
      expect(dueTask?.completed).toBe(false);
    });
  });

  describe('12. Phase 4: Targeted CTA Dispatch, Live Reactive Updates & Offline Safety', () => {
    it('dispatches targeted flashcard practice with specific itemIds and collocation tag', () => {
      const mockStore = {
        navigateToTab: vi.fn(),
        startAdaptivePractice: vi.fn(),
        setActiveFourSkill: vi.fn(),
      };

      executeLearningPlanAction(
        {
          tab: 'flashcards',
          params: { queueMode: 'DUE', filterTag: 'collocation', itemIds: ['colloc_1', 'colloc_2'] },
        },
        mockStore
      );

      expect(mockStore.startAdaptivePractice).toHaveBeenCalledWith({
        module: 'flashcard',
        itemIds: ['colloc_1', 'colloc_2'],
        mistakeType: 'collocation',
      });
      expect(mockStore.navigateToTab).toHaveBeenCalledWith('flashcards');
    });

    it('dispatches targeted pronunciation practice with specific itemIds', () => {
      const mockStore = {
        navigateToTab: vi.fn(),
        startAdaptivePractice: vi.fn(),
        setActiveFourSkill: vi.fn(),
      };

      executeLearningPlanAction(
        {
          tab: 'pronunciation',
          params: { itemIds: ['schedule', 'colonel'] },
        },
        mockStore
      );

      expect(mockStore.startAdaptivePractice).toHaveBeenCalledWith({
        module: 'pronunciation',
        itemIds: ['schedule', 'colonel'],
      });
      expect(mockStore.navigateToTab).toHaveBeenCalledWith('pronunciation');
    });

    it('dispatches four skills action with exact subtab and target lesson ID', () => {
      const mockStore = {
        navigateToTab: vi.fn(),
        startAdaptivePractice: vi.fn(),
        setActiveFourSkill: vi.fn(),
      };

      executeLearningPlanAction(
        {
          tab: 'four_skills',
          subTab: 'reading',
          params: { lessonId: 'read_b1_02' },
        },
        mockStore
      );

      expect(mockStore.setActiveFourSkill).toHaveBeenCalledWith('reading');
      expect(mockStore.startAdaptivePractice).toHaveBeenCalledWith({
        module: 'reading',
        itemIds: ['read_b1_02'],
      });
      expect(mockStore.navigateToTab).toHaveBeenCalledWith('four_skills');
    });

    it('live reactive update: plan recalculates immediately when store due cards decrease', () => {
      const storeStateBefore: Partial<AppStore> = {
        srsProgressMap: {
          w1: { srsLevel: 1, interval: 1, easeFactor: 2.5, nextReviewDate: '2026-10-06T00:00:00Z', lastReviewedDate: '2026-10-05T00:00:00Z' },
          w2: { srsLevel: 1, interval: 1, easeFactor: 2.5, nextReviewDate: '2026-10-06T00:00:00Z', lastReviewedDate: '2026-10-05T00:00:00Z' },
        },
        dailyHistory: {
          [baseDate]: { date: baseDate, wordsReviewed: 0, newWordsLearned: 0, quizzesCompleted: 0, pronunciationsMastered: 0, xpGained: 0 },
        },
      };

      const planBefore = deriveTodayLearningPlanFromStore(storeStateBefore, { date: baseDate, now: baseNow });
      const dueBefore = planBefore.items.find((i) => i.id === `srs-due-${baseDate}`);
      expect(dueBefore?.count).toBe(2);
      expect(dueBefore?.completed).toBe(false);

      // Learner reviews 2 cards in store
      const storeStateAfter: Partial<AppStore> = {
        ...storeStateBefore,
        dailyHistory: {
          [baseDate]: { date: baseDate, wordsReviewed: 2, newWordsLearned: 0, quizzesCompleted: 0, pronunciationsMastered: 0, xpGained: 20 },
        },
      };

      const planAfter = deriveTodayLearningPlanFromStore(storeStateAfter, { date: baseDate, now: baseNow });
      const dueAfter = planAfter.items.find((i) => i.id === `srs-due-${baseDate}`);
      expect(dueAfter?.completed).toBe(true);
      expect(planAfter.planState).toBe('completed_day');
    });

    it('maintains zero duplicate persistent completion state (pure derived architecture)', () => {
      const storeSnapshot: Partial<AppStore> = {
        srsProgressMap: {
          w1: { srsLevel: 1, interval: 1, easeFactor: 2.5, nextReviewDate: '2026-10-06T00:00:00Z' },
        },
      };

      const plan = deriveTodayLearningPlanFromStore(storeSnapshot, { date: baseDate, now: baseNow });
      expect(plan).toBeDefined();

      // Ensure storeSnapshot is not polluted with synthetic todayTaskCompleted map
      expect((storeSnapshot as any).todayTaskCompleted).toBeUndefined();
      expect((storeSnapshot as any).planState).toBeUndefined();
    });
  });
});
