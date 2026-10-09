// src/services/__tests__/nextActionResolver.test.ts
import { describe, it, expect, vi } from 'vitest';
import { resolveNextBestActions, SessionCompletionContext, NextActionDispatchContext } from '../nextActionResolver';
import type { TodayLearningPlan, LearningPlanItem } from '../../types';
import { READING_LESSONS } from '../../data/fourSkills/readingData';
import { LISTENING_LESSONS } from '../../data/fourSkills/listeningData';

describe('PHASE 8: Unified Next Best Action Resolver Test Suite', () => {
  const createMockDispatch = (): {
    context: NextActionDispatchContext;
    navSpy: ReturnType<typeof vi.fn>;
    adaptiveSpy: ReturnType<typeof vi.fn>;
    skillSpy: ReturnType<typeof vi.fn>;
    retrySpy: ReturnType<typeof vi.fn>;
    catalogSpy: ReturnType<typeof vi.fn>;
  } => {
    const navSpy = vi.fn();
    const adaptiveSpy = vi.fn();
    const skillSpy = vi.fn();
    const retrySpy = vi.fn();
    const catalogSpy = vi.fn();

    return {
      context: {
        navigateToTab: navSpy,
        startAdaptivePractice: adaptiveSpy,
        setActiveFourSkill: skillSpy,
        onCustomRetry: retrySpy,
        onCustomCatalog: catalogSpy,
      },
      navSpy,
      adaptiveSpy,
      skillSpy,
      retrySpy,
      catalogSpy,
    };
  };

  const createMockTodayPlan = (tasks: Array<Partial<LearningPlanItem>> = []): TodayLearningPlan => ({
    date: '2026-10-06',
    planState: 'normal',
    progress: 0,
    totalTasks: tasks.length,
    completedTasks: tasks.filter((t) => t.completed).length,
    totalEstimatedMinutes: 20,
    items: tasks.map((t, idx) => ({
      id: t.id || `task_${idx}`,
      type: t.type || 'srs_due',
      tier: t.tier || 'essential',
      title: t.title || `Nhiệm vụ ${idx + 1}`,
      description: t.description || 'Mô tả nhiệm vụ',
      reason: t.reason || 'Lý do nhiệm vụ',
      priority: idx + 1,
      estimatedMinutes: t.estimatedMinutes || 5,
      completed: Boolean(t.completed),
      action: t.action || { type: 'navigate_tab', tab: 'flashcards' },
    })),
  });

  // =========================================================================
  // 1. PRIORITY 1: EVIDENCE-BASED WEAKNESS ROUTING
  // =========================================================================
  describe('1. Evidence-Based Weakness Routing (Priority 1)', () => {
    it('routes Writing to collocation practice when trusted collocations are detected', () => {
      const { context, adaptiveSpy, navSpy } = createMockDispatch();
      const completion: SessionCompletionContext = {
        flowType: 'writing',
        writing: {
          promptId: 'w_b2_1',
          gradingResult: {
            overallScore: 78,
            overallCEFR: 'B2',
            wordCount: 150,
            criteria: {
              taskAchievement: { score: 80, cefrLevel: 'B2', feedback: '' },
              coherenceCohesion: { score: 75, cefrLevel: 'B2', feedback: '' },
              lexicalResource: { score: 70, cefrLevel: 'B1', feedback: '' },
              grammaticalAccuracy: { score: 85, cefrLevel: 'B2', feedback: '' },
            },
            strengths: ['Great structure'],
            improvements: ['Collocation accuracy'],
            diffSegments: [],
            fullRevisedEssay: 'Revised essay...',
            isFallback: false,
          },
          detectedCollocations: ['profound impact', 'spearhead development'],
          isFallback: false,
        },
      };

      const result = resolveNextBestActions(completion, context);

      expect(result.resolvedPriority).toBe(1);
      expect(result.primaryAction.id).toBe('next-action-weakness-collocations');
      expect(result.primaryAction.label).toContain('Luyện Cụm Từ Cần Cải Thiện');

      // Execute primary action
      result.primaryAction.onClick();
      expect(adaptiveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'flashcard',
          mistakeType: 'collocation',
          itemIds: ['profound impact', 'spearhead development'],
        })
      );
      expect(navSpy).toHaveBeenCalledWith('flashcards');

      // Optional secondary action routes to Today Hub
      expect(result.secondaryAction?.id).toBe('next-action-today-hub');
    });

    it('routes Pronunciation to retry word when valid speech recognition scored < 75%', () => {
      const { context, retrySpy } = createMockDispatch();
      const completion: SessionCompletionContext = {
        flowType: 'pronunciation',
        pronunciation: {
          word: 'ubiquitous',
          accuracyScore: 62,
          isSupported: true,
          isPermissionDenied: false,
        },
      };

      const result = resolveNextBestActions(completion, context);

      expect(result.resolvedPriority).toBe(1);
      expect(result.primaryAction.id).toBe('next-action-weakness-pronunciation');
      expect(result.primaryAction.label).toContain('ubiquitous');

      result.primaryAction.onClick();
      expect(retrySpy).toHaveBeenCalled();
    });

    it('routes Reading to review mistakes when there are incorrect quiz questions', () => {
      const { context, retrySpy } = createMockDispatch();
      const completion: SessionCompletionContext = {
        flowType: 'reading',
        reading: {
          lessonId: 'r_b1_1',
          incorrectQuestionCount: 2,
          scorePercent: 60,
        },
      };

      const result = resolveNextBestActions(completion, context);

      expect(result.resolvedPriority).toBe(1);
      expect(result.primaryAction.id).toBe('next-action-weakness-reading-mistakes');
      expect(result.primaryAction.label).toContain('Rà Soát Câu Hỏi Chưa Đúng');

      result.primaryAction.onClick();
      expect(retrySpy).toHaveBeenCalled();
    });

    it('routes TOEIC to reinforce weak section when section score < 70%', () => {
      const { context, navSpy } = createMockDispatch();
      const completion: SessionCompletionContext = {
        flowType: 'toeic',
        toeic: {
          examId: 'toeic_diagnostic',
          weakestPart: 7,
          weakestPartScorePct: 54,
        },
      };

      const result = resolveNextBestActions(completion, context);

      expect(result.resolvedPriority).toBe(1);
      expect(result.primaryAction.id).toBe('next-action-weakness-toeic-part');
      expect(result.primaryAction.label).toContain('Part 7');

      result.primaryAction.onClick();
      expect(navSpy).toHaveBeenCalledWith('toeic');
    });

    it('routes AI Tutor to review mistakes when mistakes were detected in conversation', () => {
      const { context, navSpy } = createMockDispatch();
      const completion: SessionCompletionContext = {
        flowType: 'tutor',
        tutor: {
          scenarioId: 'tech_interview',
          detectedMistakeCount: 3,
        },
      };

      const result = resolveNextBestActions(completion, context);

      expect(result.resolvedPriority).toBe(1);
      expect(result.primaryAction.id).toBe('next-action-weakness-tutor-mistakes');
      expect(result.primaryAction.label).toContain('Bẫy Lỗi');

      result.primaryAction.onClick();
      expect(navSpy).toHaveBeenCalledWith('mistakes');
    });
  });

  // =========================================================================
  // 2. UNTRUSTED WEAKNESS IGNORED (STRICT INTEGRITY)
  // =========================================================================
  describe('2. Untrusted Weakness Ignored', () => {
    it('ignores Writing weakness when grading is fallback (isFallback: true)', () => {
      const { context } = createMockDispatch();
      const completion: SessionCompletionContext = {
        flowType: 'writing',
        writing: {
          promptId: 'w_b1_1',
          gradingResult: {
            overallScore: 60,
            overallCEFR: 'B1',
            wordCount: 80,
            criteria: {
              taskAchievement: { score: 60, cefrLevel: 'B1', feedback: '' },
              coherenceCohesion: { score: 60, cefrLevel: 'B1', feedback: '' },
              lexicalResource: { score: 60, cefrLevel: 'B1', feedback: '' },
              grammaticalAccuracy: { score: 60, cefrLevel: 'B1', feedback: '' },
            },
            strengths: [],
            improvements: [],
            diffSegments: [],
            fullRevisedEssay: '',
            isFallback: true, // UNTRUSTED FALLBACK
          },
          detectedCollocations: ['fake collocation'],
          isFallback: true,
        },
      };

      const result = resolveNextBestActions(completion, context);

      // Must NOT be Priority 1
      expect(result.resolvedPriority).not.toBe(1);
    });

    it('ignores Pronunciation weakness when browser recognition is unsupported or denied', () => {
      const { context } = createMockDispatch();
      const completion: SessionCompletionContext = {
        flowType: 'pronunciation',
        pronunciation: {
          word: 'resilience',
          accuracyScore: null,
          isSupported: false, // Unsupported
          isPermissionDenied: true,
        },
      };

      const result = resolveNextBestActions(completion, context);

      expect(result.resolvedPriority).not.toBe(1);
    });
  });

  // =========================================================================
  // 3. PRIORITY 2: CURRICULUM FALLBACK
  // =========================================================================
  describe('3. Curriculum Continuation (Priority 2)', () => {
    it('routes Reading to next curriculum lesson when 100% correct (0 mistakes)', () => {
      const { context, skillSpy, adaptiveSpy, navSpy } = createMockDispatch();
      const currentLesson = READING_LESSONS[0];
      const nextLesson = READING_LESSONS[1];

      const completion: SessionCompletionContext = {
        flowType: 'reading',
        reading: {
          lessonId: currentLesson.id,
          incorrectQuestionCount: 0, // Perfect score
          scorePercent: 100,
        },
      };

      const result = resolveNextBestActions(completion, context);

      expect(result.resolvedPriority).toBe(2);
      expect(result.primaryAction.id).toBe('next-action-curriculum-reading');
      expect(result.primaryAction.label).toContain(nextLesson.title);

      result.primaryAction.onClick();
      expect(skillSpy).toHaveBeenCalledWith('reading');
      expect(adaptiveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'reading',
          itemIds: [nextLesson.id],
        })
      );
      expect(navSpy).toHaveBeenCalledWith('four_skills');
    });

    it('routes Listening to next curriculum lesson when 100% correct', () => {
      const { context, skillSpy, adaptiveSpy, navSpy } = createMockDispatch();
      const currentLesson = LISTENING_LESSONS[0];
      const nextLesson = LISTENING_LESSONS[1];

      const completion: SessionCompletionContext = {
        flowType: 'listening',
        listening: {
          lessonId: currentLesson.id,
          incorrectQuestionCount: 0,
          scorePercent: 100,
        },
      };

      const result = resolveNextBestActions(completion, context);

      expect(result.resolvedPriority).toBe(2);
      expect(result.primaryAction.id).toBe('next-action-curriculum-listening');
      expect(result.primaryAction.label).toContain(nextLesson.title);

      result.primaryAction.onClick();
      expect(skillSpy).toHaveBeenCalledWith('listening');
      expect(adaptiveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'listening',
          itemIds: [nextLesson.id],
        })
      );
      expect(navSpy).toHaveBeenCalledWith('four_skills');
    });
  });

  // =========================================================================
  // 4. PRIORITY 3: TODAY PLAN FALLBACK
  // =========================================================================
  describe('4. Next Today Plan Item (Priority 3)', () => {
    it('routes Flashcard completion (zero hard cards) to next item in Today Learning Plan', () => {
      const { context } = createMockDispatch();
      const todayPlan = createMockTodayPlan([
        { id: 'task_flashcard_done', title: 'Ôn tập thẻ quá hạn', completed: true },
        { id: 'task_reading_next', title: 'Đọc hiểu A2: City Guide', completed: false },
      ]);

      const completion: SessionCompletionContext = {
        flowType: 'flashcard',
        flashcard: {
          queueMode: 'DUE',
          hardestCardCount: 0,
        },
        currentPlanItemId: 'task_flashcard_done',
      };

      const result = resolveNextBestActions(completion, context, todayPlan);

      expect(result.resolvedPriority).toBe(3);
      expect(result.primaryAction.id).toBe('next-action-today-plan-task');
      expect(result.primaryAction.label).toContain('City Guide');
    });
  });

  // =========================================================================
  // 5. PRIORITY 4: TODAY HUB FALLBACK
  // =========================================================================
  describe('5. Fallback to Today Hub (Priority 4)', () => {
    it('falls back to Today Hub when all Today Plan tasks are completed and no weakness exists', () => {
      const { context, navSpy } = createMockDispatch();
      const todayPlan = createMockTodayPlan([
        { id: 't1', title: 'Task 1', completed: true },
        { id: 't2', title: 'Task 2', completed: true },
      ]);

      const completion: SessionCompletionContext = {
        flowType: 'flashcard',
        flashcard: {
          queueMode: 'DUE',
          hardestCardCount: 0,
        },
      };

      const result = resolveNextBestActions(completion, context, todayPlan);

      expect(result.resolvedPriority).toBe(4);
      expect(result.primaryAction.id).toBe('next-action-today-hub');
      expect(result.primaryAction.label).toContain('Tiếp tục Kế Hoạch Hôm Nay');

      result.primaryAction.onClick();
      expect(navSpy).toHaveBeenCalledWith('dashboard');
    });
  });

  // =========================================================================
  // 6. MAXIMUM 1 PRIMARY & 1 OPTIONAL SECONDARY ACTION INVARIANT
  // =========================================================================
  describe('6. Action Count & Invariants', () => {
    it('always returns at most 2 actions (1 primary, 1 optional secondary)', () => {
      const { context } = createMockDispatch();
      const completion: SessionCompletionContext = {
        flowType: 'reading',
        reading: {
          lessonId: READING_LESSONS[0].id,
          incorrectQuestionCount: 0,
        },
      };

      const result = resolveNextBestActions(completion, context);

      expect(result.primaryAction).toBeTruthy();
      expect(result.primaryAction.isPrimary).toBe(true);

      const totalActionCount = 1 + (result.secondaryAction ? 1 : 0);
      expect(totalActionCount).toBeLessThanOrEqual(2);
    });
  });
});
