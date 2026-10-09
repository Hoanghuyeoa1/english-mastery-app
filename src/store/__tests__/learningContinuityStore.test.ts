import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../useAppStore';
import {
  ReadingResumableActivity,
  WritingResumableActivity,
  ToeicResumableActivity,
} from '../../types/learningContinuity';

describe('useAppStore — Learning Continuity Actions & Invariants', () => {
  beforeEach(() => {
    useAppStore.getState().resetToDefault();
  });

  it('1. upsertResumeActivity adds a new valid activity', () => {
    const readingActivity: ReadingResumableActivity = {
      id: 'reading_read_a1_01',
      type: 'reading',
      title: 'A Beautiful Morning',
      startedAt: 1000,
      lastActiveAt: 1050,
      completed: false,
      schemaVersion: 1,
      checkpoint: {
        lessonId: 'read_a1_01',
        answers: { q1: 1 },
        totalQuestions: 3,
      },
    };

    useAppStore.getState().upsertResumeActivity(readingActivity);

    const storeActivities = useAppStore.getState().resumeActivities;
    expect(storeActivities['reading_read_a1_01']).toBeDefined();
    expect(storeActivities['reading_read_a1_01'].title).toBe('A Beautiful Morning');
    expect(storeActivities['reading_read_a1_01'].completed).toBe(false);
  });

  it('2. upsertResumeActivity updates existing activity without duplicating and preserves earliest startedAt', () => {
    const initialActivity: WritingResumableActivity = {
      id: 'writing_wp_b1_1',
      type: 'writing',
      title: 'My Favorite Hobby',
      startedAt: 1000,
      lastActiveAt: 1500,
      completed: false,
      schemaVersion: 1,
      checkpoint: {
        promptId: 'wp_b1_1',
        draft: 'First draft sentence.',
        wordCount: 3,
      },
    };

    useAppStore.getState().upsertResumeActivity(initialActivity);

    // Later update with new draft and later timestamp
    const updatedActivity: WritingResumableActivity = {
      id: 'writing_wp_b1_1',
      type: 'writing',
      title: 'My Favorite Hobby',
      startedAt: 2000, // Should NOT overwrite earlier 1000
      lastActiveAt: 2500,
      completed: false,
      schemaVersion: 1,
      checkpoint: {
        promptId: 'wp_b1_1',
        draft: 'First draft sentence. Adding more thoughts.',
        wordCount: 6,
      },
    };

    useAppStore.getState().upsertResumeActivity(updatedActivity);

    const storeActivities = useAppStore.getState().resumeActivities;
    // Exactly 1 activity with this ID
    expect(Object.keys(storeActivities).length).toBe(1);
    const saved = storeActivities['writing_wp_b1_1'] as WritingResumableActivity;
    expect(saved.startedAt).toBe(1000);
    expect(saved.lastActiveAt).toBe(2500);
    expect(saved.checkpoint.wordCount).toBe(6);
  });

  it('3. updateResumeCheckpoint modifies checkpoint and updates lastActiveAt', () => {
    const toeicActivity: ToeicResumableActivity = {
      id: 'toeic_attempt_test_1',
      type: 'toeic',
      title: 'TOEIC Mini',
      startedAt: 1000,
      lastActiveAt: 1000,
      completed: false,
      schemaVersion: 1,
      checkpoint: {
        attemptId: 'test_1',
        examMode: '2skills_mini',
        currentQuestionIdx: 0,
        totalQuestions: 20,
        answeredCount: 0,
        timeLeftSeconds: 900,
      },
    };

    useAppStore.getState().upsertResumeActivity(toeicActivity);

    useAppStore.getState().updateResumeCheckpoint('toeic_attempt_test_1', {
      currentQuestionIdx: 4,
      answeredCount: 4,
      timeLeftSeconds: 780,
    });

    const saved = useAppStore.getState().resumeActivities['toeic_attempt_test_1'] as ToeicResumableActivity;
    expect(saved.checkpoint.currentQuestionIdx).toBe(4);
    expect(saved.checkpoint.answeredCount).toBe(4);
    expect(saved.checkpoint.timeLeftSeconds).toBe(780);
    expect(saved.lastActiveAt).toBeGreaterThanOrEqual(1000);
  });

  it('4. completeResumeActivity marks the activity as completed', () => {
    const readingActivity: ReadingResumableActivity = {
      id: 'reading_read_b2_01',
      type: 'reading',
      title: 'Climate Change Solutions',
      startedAt: 1000,
      lastActiveAt: 1200,
      completed: false,
      schemaVersion: 1,
      checkpoint: {
        lessonId: 'read_b2_01',
        answers: { q1: 0, q2: 1 },
        totalQuestions: 4,
      },
    };

    useAppStore.getState().upsertResumeActivity(readingActivity);
    useAppStore.getState().completeResumeActivity('reading_read_b2_01');

    const saved = useAppStore.getState().resumeActivities['reading_read_b2_01'];
    expect(saved.completed).toBe(true);
    expect(saved.completedAt).toBeDefined();

    // Completed activity should not be returned by getLastResumableActivity
    const latest = useAppStore.getState().getLastResumableActivity();
    expect(latest).toBeNull();
  });

  it('5. removeResumeActivity removes the activity entirely', () => {
    const readingActivity: ReadingResumableActivity = {
      id: 'reading_to_remove',
      type: 'reading',
      title: 'To Remove',
      startedAt: 1000,
      lastActiveAt: 1200,
      completed: false,
      schemaVersion: 1,
      checkpoint: {
        lessonId: 'rem_1',
        answers: {},
        totalQuestions: 2,
      },
    };

    useAppStore.getState().upsertResumeActivity(readingActivity);
    expect(useAppStore.getState().resumeActivities['reading_to_remove']).toBeDefined();

    useAppStore.getState().removeResumeActivity('reading_to_remove');
    expect(useAppStore.getState().resumeActivities['reading_to_remove']).toBeUndefined();
  });

  it('6. getLastResumableActivity returns the latest uncompleted active activity', () => {
    const act1: ReadingResumableActivity = {
      id: 'r_1',
      type: 'reading',
      title: 'Lesson 1',
      startedAt: Date.now() - 5000,
      lastActiveAt: Date.now() - 4000,
      completed: false,
      schemaVersion: 1,
      checkpoint: { lessonId: 'l1', answers: {}, totalQuestions: 3 },
    };

    const act2: WritingResumableActivity = {
      id: 'w_1',
      type: 'writing',
      title: 'Essay 1',
      startedAt: Date.now() - 3000,
      lastActiveAt: Date.now() - 1000, // newer
      completed: false,
      schemaVersion: 1,
      checkpoint: { promptId: 'p1', draft: 'Drafting...', wordCount: 2 },
    };

    useAppStore.getState().upsertResumeActivity(act1);
    useAppStore.getState().upsertResumeActivity(act2);

    const latest = useAppStore.getState().getLastResumableActivity();
    expect(latest).not.toBeNull();
    expect(latest?.id).toBe('w_1');
  });

  it('7. Invariant: continuity operations never mutate core learning business data', () => {
    const initialSrs = { ...useAppStore.getState().srsProgressMap };
    const initialMistakes = { ...useAppStore.getState().mistakeBank };
    const initialFourSkills = { ...useAppStore.getState().fourSkillsScores };
    const initialProfile = { ...useAppStore.getState().profile };

    const act: WritingResumableActivity = {
      id: 'w_inv',
      type: 'writing',
      title: 'Essay Invariant Test',
      startedAt: Date.now(),
      lastActiveAt: Date.now(),
      completed: false,
      schemaVersion: 1,
      checkpoint: { promptId: 'p_inv', draft: 'Safety test.', wordCount: 2 },
    };

    useAppStore.getState().upsertResumeActivity(act);
    useAppStore.getState().updateResumeCheckpoint('w_inv', { wordCount: 10 });
    useAppStore.getState().completeResumeActivity('w_inv');

    expect(useAppStore.getState().srsProgressMap).toEqual(initialSrs);
    expect(useAppStore.getState().mistakeBank).toEqual(initialMistakes);
    expect(useAppStore.getState().fourSkillsScores).toEqual(initialFourSkills);
    expect(useAppStore.getState().profile).toEqual(initialProfile);
  });
});
