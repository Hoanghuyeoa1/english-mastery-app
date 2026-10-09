// @vitest-environment happy-dom
// src/store/__tests__/ContinuityPersistencePhase7.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAppStore } from '../useAppStore';
import {
  mergeResumeActivities,
  isActivityStale,
  validateResumeActivity,
  sanitizeResumeActivitiesMap,
} from '../../services/learningContinuityService';
import type { ResumableActivity } from '../../types/learningContinuity';

describe('PHASE 7: Continuity Persistence, Cloud Sync, Stale Recovery & Regression Gate', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useAppStore.getState().resetToDefault();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Backup Export & Import Roundtrip', () => {
    it('exports resumeActivities in backup JSON accurately', () => {
      const now = Date.now();
      const mockActivity: ResumableActivity = {
        id: 'reading_climate_change',
        type: 'reading',
        title: 'Climate Change Impact',
        subtitle: 'Reading B2',
        startedAt: now - 60000,
        lastActiveAt: now - 10000,
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          lessonId: 'climate_change',
          answers: { q1: 2, q2: 3 },
          totalQuestions: 5,
          activeSection: 'quiz',
          progressPercent: 40,
        },
      };

      useAppStore.getState().upsertResumeActivity(mockActivity);

      const exportedJson = useAppStore.getState().exportBackupData();
      expect(exportedJson).toBeDefined();

      const parsed = JSON.parse(exportedJson);
      expect(parsed.resumeActivities).toBeDefined();
      expect(parsed.resumeActivities['reading_climate_change']).toBeDefined();
      expect(parsed.resumeActivities['reading_climate_change'].title).toBe('Climate Change Impact');
      expect(parsed.resumeActivities['reading_climate_change'].checkpoint.answers).toEqual({ q1: 2, q2: 3 });
    });

    it('restores resumeActivities on importBackupData', () => {
      const now = Date.now();
      const backupPayload = {
        profile: {
          name: 'Learner A',
          level: 3,
          xp: 450,
        },
        resumeActivities: {
          flashcard_DUE: {
            id: 'flashcard_DUE',
            type: 'flashcard',
            title: 'Flashcard SRS Due',
            startedAt: now - 50000,
            lastActiveAt: now - 5000,
            completed: false,
            schemaVersion: 1,
            checkpoint: {
              sessionId: 'sess_due',
              queueMode: 'DUE',
              orderedCardIds: ['apple', 'banana', 'cherry'],
              currentIndex: 1,
              reviewedCardIds: ['apple'],
              reviewedCount: 1,
              totalCards: 3,
              progressPercent: 33,
            },
          },
        },
      };

      const result = useAppStore.getState().importBackupData(JSON.stringify(backupPayload));
      expect(result.success).toBe(true);

      const state = useAppStore.getState();
      expect(state.resumeActivities['flashcard_DUE']).toBeDefined();
      expect((state.resumeActivities['flashcard_DUE'] as any).checkpoint.reviewedCount).toBe(1);
    });

    it('safely handles legacy backup without resumeActivities without crashing', () => {
      const legacyBackup = {
        profile: {
          name: 'Legacy Learner',
          level: 2,
          xp: 200,
        },
        userCustomWords: [],
        srsProgressMap: {},
      };

      const result = useAppStore.getState().importBackupData(JSON.stringify(legacyBackup));
      expect(result.success).toBe(true);

      const state = useAppStore.getState();
      expect(state.resumeActivities).toEqual({});
    });

    it('safely handles corrupt resumeActivities in backup payload without crashing', () => {
      const corruptBackup = {
        profile: {
          name: 'Corrupt Learner',
          level: 1,
          xp: 50,
        },
        resumeActivities: 'NOT_AN_OBJECT_STRING',
      };

      const result = useAppStore.getState().importBackupData(JSON.stringify(corruptBackup));
      expect(result.success).toBe(true);
      expect(useAppStore.getState().resumeActivities).toEqual({});
    });
  });

  describe('2. Cross-Device Merge Invariants (mergeResumeActivities)', () => {
    it('enforces "Completed Always Wins" invariant: completed remote overrides uncompleted local', () => {
      const now = Date.now();
      const local: Record<string, ResumableActivity> = {
        reading_b2: {
          id: 'reading_b2',
          type: 'reading',
          title: 'Remote Work',
          startedAt: now - 30000,
          lastActiveAt: now - 10000,
          completed: false,
          schemaVersion: 1,
          checkpoint: { lessonId: 'b2_1', answers: {}, totalQuestions: 4, progressPercent: 50 },
        },
      };

      const remote: Record<string, ResumableActivity> = {
        reading_b2: {
          id: 'reading_b2',
          type: 'reading',
          title: 'Remote Work',
          startedAt: now - 30000,
          lastActiveAt: now - 5000,
          completed: true,
          completedAt: now - 5000,
          schemaVersion: 1,
          checkpoint: { lessonId: 'b2_1', answers: {}, totalQuestions: 4, progressPercent: 100 },
        },
      };

      const merged = mergeResumeActivities(local, remote, now);
      expect(merged['reading_b2'].completed).toBe(true);
      expect(merged['reading_b2'].completedAt).toBe(now - 5000);
    });

    it('enforces "Completed Always Wins" invariant: completed local overrides uncompleted remote', () => {
      const now = Date.now();
      const local: Record<string, ResumableActivity> = {
        writing_essay_1: {
          id: 'writing_essay_1',
          type: 'writing',
          title: 'Essay 1',
          startedAt: now - 50000,
          lastActiveAt: now - 20000,
          completed: true,
          completedAt: now - 20000,
          schemaVersion: 1,
          checkpoint: { promptId: 'p1', draft: 'Final draft', wordCount: 150 },
        },
      };

      const remote: Record<string, ResumableActivity> = {
        writing_essay_1: {
          id: 'writing_essay_1',
          type: 'writing',
          title: 'Essay 1',
          startedAt: now - 50000,
          lastActiveAt: now - 10000, // Remote active later but uncompleted!
          completed: false,
          schemaVersion: 1,
          checkpoint: { promptId: 'p1', draft: 'Draft in progress', wordCount: 100 },
        },
      };

      const merged = mergeResumeActivities(local, remote, now);
      expect(merged['writing_essay_1'].completed).toBe(true);
      expect(merged['writing_essay_1'].completedAt).toBe(now - 20000);
    });

    it('resolves uncompleted activity conflict by choosing latest lastActiveAt', () => {
      const now = Date.now();
      const local: Record<string, ResumableActivity> = {
        toeic_diag: {
          id: 'toeic_diag',
          type: 'toeic',
          title: 'Diagnostic Test',
          startedAt: now - 60000,
          lastActiveAt: now - 30000,
          completed: false,
          schemaVersion: 1,
          checkpoint: {
            attemptId: 'att_1',
            examMode: '2skills_mini',
            experienceMode: 'diagnostic',
            skillScope: '2-skills',
            currentQuestionIdx: 5,
            totalQuestions: 20,
            answeredCount: 5,
            timeLeftSeconds: 500,
            userAnswers: { q1: 'A' },
          },
        },
      };

      const remote: Record<string, ResumableActivity> = {
        toeic_diag: {
          id: 'toeic_diag',
          type: 'toeic',
          title: 'Diagnostic Test',
          startedAt: now - 60000,
          lastActiveAt: now - 10000, // Newer activity
          completed: false,
          schemaVersion: 1,
          checkpoint: {
            attemptId: 'att_1',
            examMode: '2skills_mini',
            experienceMode: 'diagnostic',
            skillScope: '2-skills',
            currentQuestionIdx: 10,
            totalQuestions: 20,
            answeredCount: 10,
            timeLeftSeconds: 300,
            userAnswers: { q1: 'A', q2: 'B' },
          },
        },
      };

      const merged = mergeResumeActivities(local, remote, now);
      const mergedToeic = merged['toeic_diag'] as any;
      expect(mergedToeic.checkpoint.currentQuestionIdx).toBe(10);
      expect(mergedToeic.checkpoint.answeredCount).toBe(10);
    });
  });

  describe('3. Stale Recovery & Expiry Invariants', () => {
    it('marks exam/tutor/flashcard activities as stale when older than 24 hours', () => {
      const now = Date.now();
      const flashcardAct: ResumableActivity = {
        id: 'flashcard_DUE',
        type: 'flashcard',
        title: 'Flashcards',
        startedAt: now - 25 * 3600 * 1000,
        lastActiveAt: now - 25 * 3600 * 1000, // 25 hours ago
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          sessionId: 'old_sess',
          queueMode: 'DUE',
          orderedCardIds: ['w1'],
          currentIndex: 0,
          reviewedCardIds: [],
          reviewedCount: 0,
          totalCards: 1,
        },
      };

      expect(isActivityStale(flashcardAct, now)).toBe(true);

      const tutorAct: ResumableActivity = {
        id: 'tutor_tech',
        type: 'tutor',
        title: 'Tutor',
        startedAt: now - 25 * 3600 * 1000,
        lastActiveAt: now - 25 * 3600 * 1000,
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          sessionId: 'tech',
          scenarioId: 'tech',
          turnCount: 3,
        },
      };

      expect(isActivityStale(tutorAct, now)).toBe(true);
    });

    it('marks Four Skills lessons as stale when older than 7 days, but not before', () => {
      const now = Date.now();
      const readingAct3DaysOld: ResumableActivity = {
        id: 'reading_1',
        type: 'reading',
        title: 'Reading',
        startedAt: now - 3 * 24 * 3600 * 1000,
        lastActiveAt: now - 3 * 24 * 3600 * 1000, // 3 days ago
        completed: false,
        schemaVersion: 1,
        checkpoint: { lessonId: 'r1', answers: {}, totalQuestions: 4 },
      };
      expect(isActivityStale(readingAct3DaysOld, now)).toBe(false);

      const readingAct8DaysOld: ResumableActivity = {
        id: 'reading_1',
        type: 'reading',
        title: 'Reading',
        startedAt: now - 8 * 24 * 3600 * 1000,
        lastActiveAt: now - 8 * 24 * 3600 * 1000, // 8 days ago
        completed: false,
        schemaVersion: 1,
        checkpoint: { lessonId: 'r1', answers: {}, totalQuestions: 4 },
      };
      expect(isActivityStale(readingAct8DaysOld, now)).toBe(true);
    });

    it('excludes stale activities during mergeResumeActivities', () => {
      const now = Date.now();
      const local: Record<string, ResumableActivity> = {};
      const remote: Record<string, ResumableActivity> = {
        stale_tutor: {
          id: 'stale_tutor',
          type: 'tutor',
          title: 'Old session',
          startedAt: now - 48 * 3600 * 1000,
          lastActiveAt: now - 48 * 3600 * 1000, // 48 hours ago
          completed: false,
          schemaVersion: 1,
          checkpoint: {
            sessionId: 'old',
            scenarioId: 'old',
            turnCount: 2,
          },
        },
      };

      const merged = mergeResumeActivities(local, remote, now);
      expect(merged['stale_tutor']).toBeUndefined();
    });
  });

  describe('4. Cloud Sync Edge Cases (mergeCloudData)', () => {
    it('merges cloudResumeActivities into local store properly', () => {
      const now = Date.now();
      useAppStore.setState({
        resumeActivities: {
          reading_r1: {
            id: 'reading_r1',
            type: 'reading',
            title: 'Local Reading',
            startedAt: now - 10000,
            lastActiveAt: now - 5000,
            completed: false,
            schemaVersion: 1,
            checkpoint: { lessonId: 'r1', answers: {}, totalQuestions: 4, progressPercent: 20 },
          },
        },
      });

      const cloudPayload = {
        cloudProfile: { name: 'Cloud User', xp: 500 },
        cloudResumeActivities: {
          tutor_standup: {
            id: 'tutor_standup',
            type: 'tutor',
            title: 'Daily Standup',
            startedAt: now - 8000,
            lastActiveAt: now - 2000,
            completed: false,
            schemaVersion: 1,
            checkpoint: { sessionId: 'standup', scenarioId: 'standup', turnCount: 3 },
          },
        },
      };

      useAppStore.getState().mergeCloudData(cloudPayload);

      const updated = useAppStore.getState().resumeActivities;
      expect(updated['reading_r1']).toBeDefined();
      expect(updated['tutor_standup']).toBeDefined();
    });

    it('populated local + empty cloud does not delete local activities', () => {
      const now = Date.now();
      const localAct: ResumableActivity = {
        id: 'reading_r1',
        type: 'reading',
        title: 'Local Reading',
        startedAt: now - 10000,
        lastActiveAt: now - 5000,
        completed: false,
        schemaVersion: 1,
        checkpoint: { lessonId: 'r1', answers: {}, totalQuestions: 4, progressPercent: 20 },
      };

      useAppStore.setState({
        resumeActivities: {
          reading_r1: localAct,
        },
      });

      // Cloud without resumeActivities field
      useAppStore.getState().mergeCloudData({
        cloudProfile: { name: 'Cloud User' },
      });

      expect(useAppStore.getState().resumeActivities['reading_r1']).toBeDefined();
    });

    it('empty local + populated cloud restores cloud activities', () => {
      const now = Date.now();
      useAppStore.setState({
        resumeActivities: {},
      });

      useAppStore.getState().mergeCloudData({
        cloudProfile: { name: 'Cloud User' },
        cloudResumeActivities: {
          tutor_standup: {
            id: 'tutor_standup',
            type: 'tutor',
            title: 'Daily Standup',
            startedAt: now - 8000,
            lastActiveAt: now - 2000,
            completed: false,
            schemaVersion: 1,
            checkpoint: { sessionId: 'standup', scenarioId: 'standup', turnCount: 3 },
          },
        },
      });

      expect(useAppStore.getState().resumeActivities['tutor_standup']).toBeDefined();
    });
  });

  describe('5. Architecture Invariant: Zero Mutation On Open / Resume / Leave', () => {
    it('opening and resuming an activity never mutates XP, SRS scheduler, or Mistake Bank', () => {
      const initialState = useAppStore.getState();
      const initialXP = initialState.profile.xp;
      const initialMistakesCount = Object.keys(initialState.mistakeBank).length;
      const initialSrsCount = Object.keys(initialState.srsProgressMap).length;

      // Upsert, fetch, and complete activity
      useAppStore.getState().upsertResumeActivity({
        id: 'reading_test',
        type: 'reading',
        title: 'Reading Test',
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        completed: false,
        schemaVersion: 1,
        checkpoint: { lessonId: 'r1', answers: {}, totalQuestions: 4 },
      });

      const mostRecent = useAppStore.getState().getLastResumableActivity();
      expect(mostRecent?.id).toBe('reading_test');

      useAppStore.getState().completeResumeActivity('reading_test');

      const afterState = useAppStore.getState();
      expect(afterState.profile.xp).toBe(initialXP);
      expect(Object.keys(afterState.mistakeBank).length).toBe(initialMistakesCount);
      expect(Object.keys(afterState.srsProgressMap).length).toBe(initialSrsCount);
    });
  });
});
