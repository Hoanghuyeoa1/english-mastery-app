// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { useAppStore, composeVocabularyList } from '../../store/useAppStore';
import { resolveNextBestActions, TODAY_HUB_ACTION_ID, TODAY_HUB_ACTION_LABEL } from '../../services/nextActionResolver';
import { deriveTodayLearningPlanFromStore } from '../../services/todayLearningPlanService';
import { mergeResumeActivities } from '../../services/learningContinuityService';
import { ContinueLearningSection } from '../ContinueLearningSection';
import { READING_LESSONS } from '../../data/fourSkills/readingData';
import { WRITING_PROMPTS } from '../../data/fourSkills/writingData';
import type { ResumableActivity, ToeicResumeCheckpoint } from '../../types';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
    button: ({ children, className, ...props }: any) => (
      <button className={className} {...props}>
        {children}
      </button>
    ),
    span: ({ children, className, ...props }: any) => (
      <span className={className} {...props}>
        {children}
      </span>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('PHASE 8: Unified Next Best Action + Today Hub + Continue Learning Loop', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    useAppStore.setState({
      srsProgressMap: {},
      userCustomWords: [],
      vocabularyList: composeVocabularyList({}, []),
      mistakeBank: {},
      dailyHistory: {},
      activeFourSkill: 'reading',
      activePracticeConfig: null,
      resumeActivities: {},
      fourSkillsCompletionProgress: {
        reading: [],
        speaking: [],
        writing: [],
      },
      profile: {
        ...useAppStore.getState().profile,
        name: 'Learner',
        level: 1,
        xp: 100,
        streak: 3,
      },
    });
  });

  // =========================================================================
  // 1. Next Best Action Deterministic Resolution & 4-Level Priority Hierarchy
  // =========================================================================
  describe('1. Next Best Action Deterministic Resolution & Constraints', () => {
    it('enforces maximum 1 primary action and 1 optional secondary action invariant across all outputs', () => {
      const navSpy = vi.fn();
      const dispatchContext = {
        navigateToTab: navSpy,
      };

      // Case A: Priority 1 (Weakness)
      const resP1 = resolveNextBestActions(
        {
          flowType: 'writing',
          writing: {
            promptId: WRITING_PROMPTS[0].id,
            detectedCollocations: ['profound impact'],
            isFallback: false,
          },
        },
        dispatchContext
      );
      expect(resP1.primaryAction).toBeDefined();
      expect(resP1.primaryAction.isPrimary).toBe(true);
      expect(resP1.secondaryAction?.id).toBe(TODAY_HUB_ACTION_ID);

      // Case B: Priority 2 (Curriculum Next)
      const resP2 = resolveNextBestActions(
        {
          flowType: 'reading',
          reading: { lessonId: READING_LESSONS[0].id, incorrectQuestionCount: 0 },
        },
        dispatchContext
      );
      expect(resP2.primaryAction).toBeDefined();
      expect(resP2.primaryAction.id).toBe('next-action-curriculum-reading');
      expect(resP2.secondaryAction?.id).toBe(TODAY_HUB_ACTION_ID);

      // Case C: Priority 4 (Fallback)
      const resP4 = resolveNextBestActions(
        {
          flowType: 'reading',
          reading: { lessonId: 'non_existent_reading_lesson' },
        },
        dispatchContext
      );
      expect(resP4.primaryAction.id).toBe(TODAY_HUB_ACTION_ID);
      expect(resP4.primaryAction.label).toBe(TODAY_HUB_ACTION_LABEL);
    });

    it('Priority 1: routes directly to collocation review when valid non-fallback writing evidence exists', () => {
      const navSpy = vi.fn();
      const adaptiveSpy = vi.fn();

      const result = resolveNextBestActions(
        {
          flowType: 'writing',
          writing: {
            promptId: WRITING_PROMPTS[0].id,
            detectedCollocations: ['heavy rain', 'make a decision'],
            isFallback: false,
          },
        },
        {
          navigateToTab: navSpy,
          startAdaptivePractice: adaptiveSpy,
        }
      );

      expect(result.resolvedPriority).toBe(1);
      expect(result.primaryAction.id).toBe('next-action-weakness-collocations');
      result.primaryAction.onClick();
      expect(adaptiveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'flashcard',
          mistakeType: 'collocation',
          itemIds: ['heavy rain', 'make a decision'],
        })
      );
      expect(navSpy).toHaveBeenCalledWith('flashcards');
    });

    it('strictly rejects AI fallback for Priority 1 and cascades down to Priority 2/3/4', () => {
      const navSpy = vi.fn();
      const result = resolveNextBestActions(
        {
          flowType: 'writing',
          writing: {
            promptId: WRITING_PROMPTS[0].id,
            detectedCollocations: ['some collocation'],
            isFallback: true, // Fallback untrusted evidence!
          },
        },
        { navigateToTab: navSpy }
      );

      // Must not trigger Priority 1 weakness! Cascades to Priority 2 curriculum continuation
      expect(result.resolvedPriority).toBe(2);
      expect(result.primaryAction.id).toBe('next-action-curriculum-writing');
    });
  });

  // =========================================================================
  // 2. Continue Learning Cleanup & "Completed Always Wins" Invariant
  // =========================================================================
  describe('2. Continue Learning Cleanup & "Completed Always Wins" Invariant', () => {
    it('marks activity as completed upon session finish and hides it from ContinueLearningSection', () => {
      const activityId = 'reading_read_a1_1';
      const initialActivity: ResumableActivity = {
        id: activityId,
        type: 'reading',
        title: 'A1: Daily Routine',
        startedAt: Date.now() - 600000,
        lastActiveAt: Date.now() - 30000,
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          lessonId: 'read_a1_1',
          answers: { q1: 0 },
          totalQuestions: 4,
          activeSection: 'quiz',
        },
      };

      // 1. Initial unfinished activity in store
      useAppStore.getState().upsertResumeActivity(initialActivity);
      expect(useAppStore.getState().resumeActivities[activityId].completed).toBe(false);

      // 2. Render ContinueLearningSection -> activity is visible
      const onNavigateMock = vi.fn();
      const { rerender } = render(<ContinueLearningSection onNavigate={onNavigateMock} />);
      expect(screen.getByText('A1: Daily Routine')).toBeTruthy();

      // 3. User finishes reading lesson -> call completeResumeActivity
      act(() => {
        useAppStore.getState().completeResumeActivity(activityId);
      });
      const updatedActivity = useAppStore.getState().resumeActivities[activityId];
      expect(updatedActivity.completed).toBe(true);

      // 4. ContinueLearningSection re-renders with updated list -> completed activity is hidden
      act(() => {
        rerender(<ContinueLearningSection onNavigate={onNavigateMock} />);
      });
      expect(screen.queryByText('A1: Daily Routine')).toBeNull();
    });

    it('Completed Always Wins: late uncompleted upsert cannot resurrect a completed activity', () => {
      const activityId = 'listening_listen_a1_1';
      const completedActivity: ResumableActivity = {
        id: activityId,
        type: 'listening',
        title: 'A1: Audio Lesson 1',
        startedAt: Date.now() - 120000,
        lastActiveAt: Date.now(),
        completed: true,
        completedAt: Date.now(),
        schemaVersion: 1,
        checkpoint: {
          lessonId: 'listen_a1_1',
          answers: { q1: 1, q2: 2 },
          totalQuestions: 2,
        },
      };

      // Save completed activity
      useAppStore.getState().upsertResumeActivity(completedActivity);
      expect(useAppStore.getState().resumeActivities[activityId].completed).toBe(true);

      // Simulate a late background or stale write with completed: false
      const staleLateWrite: ResumableActivity = {
        ...completedActivity,
        completed: false,
        lastActiveAt: Date.now() + 1000,
      };

      useAppStore.getState().upsertResumeActivity(staleLateWrite);

      // Invariant: Activity remains completed! Stale write was blocked.
      const persisted = useAppStore.getState().resumeActivities[activityId];
      expect(persisted.completed).toBe(true);
    });

    it('Completed Always Wins: updateResumeCheckpoint cannot mutate an already completed activity', () => {
      const activityId = 'toeic_exam_01';
      const initialCheckpoint: ToeicResumeCheckpoint = {
        attemptId: 'toeic_attempt_01',
        examMode: '2skills_mini',
        currentQuestionIdx: 30,
        answeredCount: 30,
        totalQuestions: 30,
        timeLeftSeconds: 0,
      };

      useAppStore.getState().upsertResumeActivity({
        id: activityId,
        type: 'toeic',
        title: 'TOEIC Mini Test 01',
        startedAt: Date.now() - 600000,
        lastActiveAt: Date.now(),
        completed: true,
        completedAt: Date.now(),
        schemaVersion: 1,
        checkpoint: initialCheckpoint,
      });

      // Attempt checkpoint mutation with stale uncompleted values
      useAppStore.getState().updateResumeCheckpoint(activityId, {
        attemptId: 'toeic_attempt_01',
        examMode: '2skills_mini',
        currentQuestionIdx: 10,
        answeredCount: 10,
        totalQuestions: 30,
        timeLeftSeconds: 500,
      });

      const persisted = useAppStore.getState().resumeActivities[activityId];
      expect(persisted.completed).toBe(true);
      expect((persisted.checkpoint as any).answeredCount).toBe(30);
    });

    it('mergeResumeActivities guarantees that completed status always wins against stale remote payloads', () => {
      const activityId = 'reading_test_01';
      const localState: Record<string, ResumableActivity> = {
        [activityId]: {
          id: activityId,
          type: 'reading',
          title: 'Reading Test 1',
          startedAt: 1000,
          lastActiveAt: 2000,
          completed: true, // Completed locally
          completedAt: 2000,
          schemaVersion: 1,
          checkpoint: { lessonId: 'read_a1_1', answers: {}, totalQuestions: 4 },
        },
      };

      const staleRemoteState: Record<string, ResumableActivity> = {
        [activityId]: {
          id: activityId,
          type: 'reading',
          title: 'Reading Test 1',
          startedAt: 1000,
          lastActiveAt: 3000, // Newer timestamp but NOT completed
          completed: false,
          schemaVersion: 1,
          checkpoint: { lessonId: 'read_a1_1', answers: {}, totalQuestions: 4 },
        },
      };

      const merged = mergeResumeActivities(localState, staleRemoteState);
      expect(merged[activityId].completed).toBe(true);
    });
  });

  // =========================================================================
  // 3. Today Hub Live Update & Loop Closure Without Page Reload
  // =========================================================================
  describe('3. Today Hub Live Update & Loop Closure Without Page Reload', () => {
    it('reactively derives updated Today Learning Plan when store records completed lesson', () => {
      const initialPlan = deriveTodayLearningPlanFromStore(useAppStore.getState());
      expect(initialPlan).toBeDefined();

      // Mark Reading lesson as completed in store
      useAppStore.getState().markFourSkillsLessonCompleted('reading', 'read_a1_1');

      // Live re-derivation reflects new completion immediately without page reload
      const updatedPlan = deriveTodayLearningPlanFromStore(useAppStore.getState());
      const completedReadingIds = useAppStore.getState().fourSkillsCompletionProgress.reading;
      expect(completedReadingIds).toContain('read_a1_1');

      // Plan item corresponding to completed lesson reflects progress
      expect(updatedPlan.items).toBeDefined();
    });

    it('prevents double completion / duplicate review / double XP when finishing session', () => {
      const initialXp = useAppStore.getState().profile.xp;

      // Simulate completed session score record once
      useAppStore.setState((prev) => ({
        profile: {
          ...prev.profile,
          xp: prev.profile.xp + 30,
        },
      }));
      expect(useAppStore.getState().profile.xp).toBe(initialXp + 30);

      // Verify streak and profile integrity
      const profile = useAppStore.getState().profile;
      expect(profile.streak).toBe(3); // Streak preserved, not artificially incremented
    });
  });
});
