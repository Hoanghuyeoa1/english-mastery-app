import { describe, it, expect } from 'vitest';
import {
  validateResumeActivity,
  isActivityStale,
  sanitizeResumeActivitiesMap,
  getMostRecentResumableActivity,
  MAX_RESUME_ACTIVITIES_COUNT,
  TOEIC_STALE_MS,
  FLASHCARD_STALE_MS,
  DEFAULT_STALE_ACTIVITY_MS,
} from '../learningContinuityService';
import {
  ResumableActivity,
  ReadingResumableActivity,
  WritingResumableActivity,
  SpeakingResumableActivity,
  ListeningResumableActivity,
  ToeicResumableActivity,
  FlashcardResumableActivity,
} from '../../types/learningContinuity';

describe('learningContinuityService — Validation & Business Logic', () => {
  describe('1. validateResumeActivity', () => {
    it('validates a correct Reading activity', () => {
      const validReading: ReadingResumableActivity = {
        id: 'reading_read_b1_01',
        type: 'reading',
        title: 'Artificial Intelligence in Healthcare',
        subtitle: 'B1 Comprehension',
        startedAt: 1000,
        lastActiveAt: 2000,
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          lessonId: 'read_b1_01',
          answers: { q1: 2, q2: 0 },
          totalQuestions: 4,
        },
      };

      const result = validateResumeActivity(validReading);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('reading');
      expect((result as ReadingResumableActivity).checkpoint.lessonId).toBe('read_b1_01');
      expect((result as ReadingResumableActivity).checkpoint.answers).toEqual({ q1: 2, q2: 0 });
    });

    it('validates a correct Writing activity', () => {
      const validWriting: WritingResumableActivity = {
        id: 'writing_wp_b2_1',
        type: 'writing',
        title: 'Technology and Modern Communication',
        startedAt: 1000,
        lastActiveAt: 2000,
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          promptId: 'wp_b2_1',
          draft: 'In recent years, technology has revolutionized communication...',
          wordCount: 8,
        },
      };

      const result = validateResumeActivity(validWriting);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('writing');
      expect((result as WritingResumableActivity).checkpoint.draft).toContain('revolutionized');
    });

    it('validates a correct Speaking activity', () => {
      const validSpeaking: SpeakingResumableActivity = {
        id: 'speaking_sp_a2_1',
        type: 'speaking',
        title: 'Ordering Food at a Restaurant',
        startedAt: 1000,
        lastActiveAt: 2000,
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          promptId: 'sp_a2_1',
          currentTurnIndex: 1,
          totalTurns: 3,
        },
      };

      const result = validateResumeActivity(validSpeaking);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('speaking');
      expect((result as SpeakingResumableActivity).checkpoint.currentTurnIndex).toBe(1);
    });

    it('validates a correct Listening activity', () => {
      const validListening: ListeningResumableActivity = {
        id: 'listening_lis_a1_01',
        type: 'listening',
        title: 'Daily Routine',
        startedAt: 1000,
        lastActiveAt: 2000,
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          lessonId: 'lis_a1_01',
          answers: { q1: 1 },
          totalQuestions: 3,
        },
      };

      const result = validateResumeActivity(validListening);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('listening');
      expect((result as ListeningResumableActivity).checkpoint.lessonId).toBe('lis_a1_01');
    });

    it('validates a correct TOEIC activity', () => {
      const validToeic: ToeicResumableActivity = {
        id: 'toeic_attempt_123',
        type: 'toeic',
        title: 'TOEIC Mini Test',
        startedAt: 1000,
        lastActiveAt: 2000,
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          attemptId: 'attempt_123',
          examMode: '2skills_mini',
          currentQuestionIdx: 5,
          totalQuestions: 20,
          answeredCount: 4,
          timeLeftSeconds: 600,
        },
      };

      const result = validateResumeActivity(validToeic);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('toeic');
      expect((result as ToeicResumableActivity).checkpoint.currentQuestionIdx).toBe(5);
    });

    it('validates a correct Flashcard activity', () => {
      const validFlashcard: FlashcardResumableActivity = {
        id: 'flashcard_due_session',
        type: 'flashcard',
        title: 'Ôn tập Flashcard đến hạn',
        startedAt: 1000,
        lastActiveAt: 2000,
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          queueMode: 'DUE',
          filterTag: 'IELTS',
          reviewedCount: 7,
          totalDue: 20,
        },
      };

      const result = validateResumeActivity(validFlashcard);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('flashcard');
      expect((result as FlashcardResumableActivity).checkpoint.queueMode).toBe('DUE');
      expect((result as FlashcardResumableActivity).checkpoint.reviewedCount).toBe(7);
    });

    it('rejects malformed payloads and invalid schemas', () => {
      expect(validateResumeActivity(null)).toBeNull();
      expect(validateResumeActivity(undefined)).toBeNull();
      expect(validateResumeActivity([])).toBeNull();
      expect(validateResumeActivity('not-an-object')).toBeNull();
      expect(validateResumeActivity({ id: '', type: 'reading' })).toBeNull();
      expect(validateResumeActivity({ id: '1', type: 'unknown_type' })).toBeNull();
      expect(validateResumeActivity({ id: '1', type: 'reading', title: 'test', checkpoint: null })).toBeNull();
      // Reading missing lessonId
      expect(validateResumeActivity({
        id: '1',
        type: 'reading',
        title: 'test',
        checkpoint: { answers: {} },
      })).toBeNull();
      // Writing missing promptId
      expect(validateResumeActivity({
        id: '2',
        type: 'writing',
        title: 'test',
        checkpoint: { draft: 'hi' },
      })).toBeNull();
    });
  });

  describe('2. isActivityStale', () => {
    const now = 1000000;

    it('identifies TOEIC activities as stale after 24 hours', () => {
      const activeToeic: ToeicResumableActivity = {
        id: 'toeic_1',
        type: 'toeic',
        title: 'TOEIC',
        startedAt: now - 3600000, // 1 hour ago
        lastActiveAt: now - 3600000,
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          attemptId: 'att_1',
          examMode: '2skills_mini',
          currentQuestionIdx: 1,
          totalQuestions: 20,
          answeredCount: 1,
          timeLeftSeconds: 500,
        },
      };
      expect(isActivityStale(activeToeic, now)).toBe(false);

      const staleToeic = { ...activeToeic, lastActiveAt: now - (TOEIC_STALE_MS + 1000) };
      expect(isActivityStale(staleToeic, now)).toBe(true);
    });

    it('identifies Flashcard activities as stale after 24 hours', () => {
      const activeCard: FlashcardResumableActivity = {
        id: 'fc_1',
        type: 'flashcard',
        title: 'Cards',
        startedAt: now - 3600000,
        lastActiveAt: now - 3600000,
        completed: false,
        schemaVersion: 1,
        checkpoint: { queueMode: 'DUE', reviewedCount: 5 },
      };
      expect(isActivityStale(activeCard, now)).toBe(false);

      const staleCard = { ...activeCard, lastActiveAt: now - (FLASHCARD_STALE_MS + 1000) };
      expect(isActivityStale(staleCard, now)).toBe(true);
    });

    it('identifies Four Skills activities as stale after 7 days', () => {
      const activeReading: ReadingResumableActivity = {
        id: 'r_1',
        type: 'reading',
        title: 'Reading',
        startedAt: now - 86400000, // 1 day ago
        lastActiveAt: now - 86400000,
        completed: false,
        schemaVersion: 1,
        checkpoint: { lessonId: 'l1', answers: {}, totalQuestions: 3 },
      };
      expect(isActivityStale(activeReading, now)).toBe(false);

      const staleReading = { ...activeReading, lastActiveAt: now - (DEFAULT_STALE_ACTIVITY_MS + 1000) };
      expect(isActivityStale(staleReading, now)).toBe(true);
    });
  });

  describe('3. sanitizeResumeActivitiesMap', () => {
    it('cleans corrupt entries and bounds capacity', () => {
      const rawMap: Record<string, any> = {
        corrupt_1: { id: 'bad' },
        corrupt_2: null,
      };

      for (let i = 0; i < 35; i++) {
        rawMap[`act_${i}`] = {
          id: `act_${i}`,
          type: 'reading',
          title: `Lesson ${i}`,
          startedAt: 1000 + i * 10,
          lastActiveAt: 2000 + i * 10,
          completed: false,
          schemaVersion: 1,
          checkpoint: { lessonId: `l_${i}`, answers: {}, totalQuestions: 3 },
        };
      }

      const sanitized = sanitizeResumeActivitiesMap(rawMap);
      const keys = Object.keys(sanitized);

      expect(keys.length).toBeLessThanOrEqual(MAX_RESUME_ACTIVITIES_COUNT);
      expect(sanitized['corrupt_1']).toBeUndefined();
      // Should have kept the most recent ones (higher index = higher lastActiveAt)
      expect(sanitized['act_34']).toBeDefined();
    });
  });

  describe('4. getMostRecentResumableActivity', () => {
    const now = 2000000;

    it('returns the most recently active non-completed, non-stale activity', () => {
      const activities: Record<string, ResumableActivity> = {
        act_old: {
          id: 'act_old',
          type: 'reading',
          title: 'Older lesson',
          startedAt: now - 50000,
          lastActiveAt: now - 40000,
          completed: false,
          schemaVersion: 1,
          checkpoint: { lessonId: 'old', answers: {}, totalQuestions: 3 },
        },
        act_completed: {
          id: 'act_completed',
          type: 'writing',
          title: 'Finished Essay',
          startedAt: now - 30000,
          lastActiveAt: now - 1000,
          completed: true,
          schemaVersion: 1,
          checkpoint: { promptId: 'wp1', draft: 'Done', wordCount: 1 },
        },
        act_recent: {
          id: 'act_recent',
          type: 'writing',
          title: 'Active Draft',
          startedAt: now - 20000,
          lastActiveAt: now - 5000, // most recent active
          completed: false,
          schemaVersion: 1,
          checkpoint: { promptId: 'wp2', draft: 'Working on this...', wordCount: 4 },
        },
      };

      const result = getMostRecentResumableActivity(activities, now);
      expect(result).not.toBeNull();
      expect(result?.id).toBe('act_recent');
      expect(result?.title).toBe('Active Draft');
    });

    it('returns null if all activities are completed or stale', () => {
      const activities: Record<string, ResumableActivity> = {
        act_done: {
          id: 'act_done',
          type: 'reading',
          title: 'Done',
          startedAt: 1000,
          lastActiveAt: 2000,
          completed: true,
          schemaVersion: 1,
          checkpoint: { lessonId: 'l1', answers: {}, totalQuestions: 3 },
        },
        act_stale: {
          id: 'act_stale',
          type: 'toeic',
          title: 'Old TOEIC',
          startedAt: now - (TOEIC_STALE_MS + 5000),
          lastActiveAt: now - (TOEIC_STALE_MS + 5000),
          completed: false,
          schemaVersion: 1,
          checkpoint: { attemptId: 'a1', examMode: '2skills_mini', currentQuestionIdx: 0, totalQuestions: 20, answeredCount: 0, timeLeftSeconds: 0 },
        },
      };

      const result = getMostRecentResumableActivity(activities, now);
      expect(result).toBeNull();
    });

    it('handles empty or undefined activities safely', () => {
      expect(getMostRecentResumableActivity(undefined)).toBeNull();
      expect(getMostRecentResumableActivity({})).toBeNull();
    });
  });
});
