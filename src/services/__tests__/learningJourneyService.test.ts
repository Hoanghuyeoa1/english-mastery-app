import { describe, it, expect, beforeEach } from 'vitest';
import {
  deriveFourSkillsLearningJourney,
  deriveFourSkillsLearningJourneyFromStore,
  resolveLessonCefrLevel,
  CEFR_LEVELS_ORDER,
  FOUR_SKILLS_LIST,
} from '../learningJourneyService';
import {
  LISTENING_LESSONS,
  READING_LESSONS,
  SPEAKING_PROMPTS,
  WRITING_PROMPTS,
  ListeningLesson,
  ReadingLesson,
  SpeakingPrompt,
  WritingPrompt,
} from '../../data/fourSkillsData';
import { useAppStore } from '../../store/useAppStore';

describe('Four Skills Learning Journey Service (Phase 1)', () => {
  beforeEach(() => {
    useAppStore.setState({
      completedListeningLessonIds: [],
      fourSkillsCompletionProgress: {
        reading: [],
        speaking: [],
        writing: [],
      },
      resumeActivities: {},
    });
  });

  describe('1. CEFR Level Normalization & Resolvers', () => {
    it('normalizes standard CEFR levels correctly', () => {
      expect(resolveLessonCefrLevel('A1')).toBe('A1');
      expect(resolveLessonCefrLevel('a2')).toBe('A2');
      expect(resolveLessonCefrLevel('B1')).toBe('B1');
      expect(resolveLessonCefrLevel('b2')).toBe('B2');
      expect(resolveLessonCefrLevel('C1')).toBe('C1');
      expect(resolveLessonCefrLevel('c2')).toBe('C2');
    });

    it('gracefully handles legacy compound levels', () => {
      expect(resolveLessonCefrLevel('A2-B1')).toBe('A2');
      expect(resolveLessonCefrLevel('B1-B2')).toBe('B1');
      expect(resolveLessonCefrLevel('B2-C1')).toBe('B2');
    });

    it('returns null for null, undefined, or invalid levels', () => {
      expect(resolveLessonCefrLevel(null)).toBeNull();
      expect(resolveLessonCefrLevel(undefined)).toBeNull();
      expect(resolveLessonCefrLevel('')).toBeNull();
      expect(resolveLessonCefrLevel('invalid')).toBeNull();
    });
  });

  describe('2. Master Dataset Derivation & Dynamic Lesson Counts', () => {
    it('derives all 6 CEFR levels A1 -> C2 dynamically from current datasets', () => {
      const journey = deriveFourSkillsLearningJourney();

      expect(journey.orderedLevels).toHaveLength(6);
      expect(journey.orderedLevels.map((l) => l.level)).toEqual(CEFR_LEVELS_ORDER);

      // Verify overall totals match actual datasets
      const expectedTotal =
        LISTENING_LESSONS.length +
        READING_LESSONS.length +
        SPEAKING_PROMPTS.length +
        WRITING_PROMPTS.length;

      expect(journey.summary.totalLessons).toBe(expectedTotal);
      expect(journey.summary.totalLessons).toBe(96); // 24 * 4 = 96
    });

    it('derives accurate per-skill totals for each level', () => {
      const journey = deriveFourSkillsLearningJourney();

      for (const level of CEFR_LEVELS_ORDER) {
        const node = journey.levels[level];
        expect(node).toBeDefined();
        expect(node.level).toBe(level);

        for (const skill of FOUR_SKILLS_LIST) {
          const skillProgress = node.skills[skill];
          expect(skillProgress).toBeDefined();
          expect(skillProgress.skill).toBe(skill);
          expect(skillProgress.totalLessons).toBe(4); // 4 lessons per skill per level
          expect(skillProgress.completedLessons).toBe(0);
          expect(skillProgress.progressPercent).toBe(0);
        }

        expect(node.totalLessons).toBe(16); // 4 * 4 = 16
        expect(node.completedLessons).toBe(0);
        expect(node.status).toBe('available');
      }
    });

    it('adapts dynamically when dataset has fewer or more lessons (not hardcoded to 16)', () => {
      const customListening: ListeningLesson[] = [
        {
          id: 'custom_l1',
          title: 'Custom A1 L1',
          category: 'Daily Life',
          level: 'A1',
          duration: '2:00',
          description: 'test',
          audioText: 'test',
          sentences: [],
          questions: [],
        },
      ];
      const customReading: ReadingLesson[] = [
        {
          id: 'custom_r1',
          title: 'Custom A1 R1',
          category: 'Daily Life',
          level: 'A1',
          readTime: '2m',
          wordCount: 100,
          summary: 'test',
          content: [],
          keyVocab: [],
          questions: [],
        },
      ];

      const journey = deriveFourSkillsLearningJourney({
        listeningLessons: customListening,
        readingLessons: customReading,
        speakingPrompts: [],
        writingPrompts: [],
      });

      // A1 should have exactly 2 lessons, not 16!
      expect(journey.levels.A1.totalLessons).toBe(2);
      expect(journey.levels.A1.skills.listening.totalLessons).toBe(1);
      expect(journey.levels.A1.skills.reading.totalLessons).toBe(1);
      expect(journey.levels.A1.skills.speaking.totalLessons).toBe(0);
      expect(journey.levels.A1.skills.writing.totalLessons).toBe(0);
      expect(journey.summary.totalLessons).toBe(2);
    });
  });

  describe('3. Level Status & Completion Semantics', () => {
    it('marks level as in_progress when partial lessons are completed', () => {
      const journey = deriveFourSkillsLearningJourney({
        completedListeningLessonIds: ['listen_a1_1'],
        fourSkillsCompletionProgress: {
          reading: ['read_a1_1'],
          speaking: [],
          writing: [],
        },
      });

      const a1 = journey.levels.A1;
      expect(a1.completedLessons).toBe(2);
      expect(a1.status).toBe('in_progress');
      expect(a1.isCompleted).toBe(false);
      expect(a1.skills.listening.completedLessons).toBe(1);
      expect(a1.skills.reading.completedLessons).toBe(1);
      expect(a1.skills.speaking.completedLessons).toBe(0);
      expect(a1.skills.writing.completedLessons).toBe(0);

      // Other levels remain available
      expect(journey.levels.A2.status).toBe('available');
      expect(journey.levels.B1.status).toBe('available');
    });

    it('marks level as completed ONLY when all lessons of that level in dataset are done', () => {
      // Complete all 16 A1 lessons
      const a1ListeningIds = ['listen_a1_1', 'listen_a1_2', 'listen_a1_3', 'listen_a1_4'];
      const a1ReadingIds = ['read_a1_1', 'read_a1_2', 'read_a1_3', 'read_a1_4'];
      const a1SpeakingIds = ['sp_a1_1', 'sp_a1_2', 'sp_a1_3', 'sp_a1_4'];
      const a1WritingIds = ['wp_a1_1', 'wp_a1_2', 'wp_a1_3', 'wp_a1_4'];

      const journey = deriveFourSkillsLearningJourney({
        completedListeningLessonIds: a1ListeningIds,
        fourSkillsCompletionProgress: {
          reading: a1ReadingIds,
          speaking: a1SpeakingIds,
          writing: a1WritingIds,
        },
      });

      const a1 = journey.levels.A1;
      expect(a1.completedLessons).toBe(16);
      expect(a1.totalLessons).toBe(16);
      expect(a1.progressPercent).toBe(100);
      expect(a1.isCompleted).toBe(true);
      expect(a1.status).toBe('completed');

      expect(journey.summary.completedLevelsCount).toBe(1);
      // Next level becomes currentLevel
      expect(journey.summary.currentLevel).toBe('A2');
    });

    it('does NOT mark level as completed if 15 of 16 lessons are done', () => {
      const a1ListeningIds = ['listen_a1_1', 'listen_a1_2', 'listen_a1_3', 'listen_a1_4'];
      const a1ReadingIds = ['read_a1_1', 'read_a1_2', 'read_a1_3', 'read_a1_4'];
      const a1SpeakingIds = ['sp_a1_1', 'sp_a1_2', 'sp_a1_3', 'sp_a1_4'];
      // Only 3 of 4 writing lessons
      const a1WritingIds = ['wp_a1_1', 'wp_a1_2', 'wp_a1_3'];

      const journey = deriveFourSkillsLearningJourney({
        completedListeningLessonIds: a1ListeningIds,
        fourSkillsCompletionProgress: {
          reading: a1ReadingIds,
          speaking: a1SpeakingIds,
          writing: a1WritingIds,
        },
      });

      const a1 = journey.levels.A1;
      expect(a1.completedLessons).toBe(15);
      expect(a1.totalLessons).toBe(16);
      expect(a1.isCompleted).toBe(false);
      expect(a1.status).toBe('in_progress');
    });

    it('strictly does NOT use locked status (all accessible per product behavior)', () => {
      const journey = deriveFourSkillsLearningJourney();

      for (const node of journey.orderedLevels) {
        expect(node.status).not.toBe('locked');
        expect(['available', 'in_progress', 'completed']).toContain(node.status);
      }
    });

    it('strictly disables mastered status (no fake mastery in Phase 1)', () => {
      const journey = deriveFourSkillsLearningJourney({
        // Full completion
        completedListeningLessonIds: LISTENING_LESSONS.map((l) => l.id),
        fourSkillsCompletionProgress: {
          reading: READING_LESSONS.map((r) => r.id),
          speaking: SPEAKING_PROMPTS.map((s) => s.id),
          writing: WRITING_PROMPTS.map((w) => w.id),
        },
      });

      for (const node of journey.orderedLevels) {
        expect((node as any).status).not.toBe('mastered');
        expect(node.status).toBe('completed');
      }
    });
  });

  describe('4. Current Level Determination', () => {
    it('sets currentLevel to A1 for new users with zero progress', () => {
      const journey = deriveFourSkillsLearningJourney();
      expect(journey.summary.isNewUser).toBe(true);
      expect(journey.summary.currentLevel).toBe('A1');
      expect(journey.levels.A1.isCurrentLevel).toBe(true);
      expect(journey.levels.A2.isCurrentLevel).toBe(false);
    });

    it('prioritizes level of active resumable Four Skills activity', () => {
      const journey = deriveFourSkillsLearningJourney({
        completedListeningLessonIds: ['listen_a1_1'],
        resumeActivities: {
          reading_read_b2_1: {
            id: 'reading_read_b2_1',
            type: 'reading',
            title: 'Cloud Architecture & DevOps Culture',
            startedAt: Date.now() - 3600000,
            lastActiveAt: Date.now() - 60000,
            completed: false,
            schemaVersion: 1,
            checkpoint: {
              lessonId: 'read_b2_1',
              answers: { q1: 1 },
              totalQuestions: 5,
              progressPercent: 20,
            },
          },
        },
      });

      // B2 has active resumable reading lesson!
      expect(journey.summary.currentLevel).toBe('B2');
      expect(journey.levels.B2.isCurrentLevel).toBe(true);
      expect(journey.levels.B2.activeLesson?.id).toBe('read_b2_1');
      expect(journey.levels.B2.status).toBe('in_progress');
      expect(journey.summary.activeResumeLesson?.id).toBe('read_b2_1');
    });

    it('excludes stale or completed activities from currentLevel precedence', () => {
      const now = Date.now();
      const journey = deriveFourSkillsLearningJourney({
        completedListeningLessonIds: ['listen_a1_1'],
        nowMs: now,
        resumeActivities: {
          // Completed activity in B2 -> should be ignored
          completed_b2: {
            id: 'completed_b2',
            type: 'reading',
            title: 'Reading B2',
            startedAt: now - 3600000,
            lastActiveAt: now - 60000,
            completed: true,
            completedAt: now - 50000,
            schemaVersion: 1,
            checkpoint: {
              lessonId: 'read_b2_1',
              answers: {},
              totalQuestions: 5,
            },
          },
          // Stale activity (> 7 days) in C1 -> should be ignored
          stale_c1: {
            id: 'stale_c1',
            type: 'listening',
            title: 'Listening C1',
            startedAt: now - 10 * 24 * 3600000,
            lastActiveAt: now - 9 * 24 * 3600000,
            completed: false,
            schemaVersion: 1,
            checkpoint: {
              lessonId: 'listen_c1_1',
              answers: {},
              totalQuestions: 5,
            },
          },
        },
      });

      // Because B2 is completed and C1 is stale, neither counts!
      // A1 has completedLessons = 1, so A1 is in_progress and becomes currentLevel.
      expect(journey.summary.currentLevel).toBe('A1');
      expect(journey.summary.activeResumeLesson).toBeNull();
    });

    it('handles out-of-order learning faithfully without resetting higher levels', () => {
      // User jumped ahead and did 2 lessons in B2 while A2 has only 1 lesson
      const journey = deriveFourSkillsLearningJourney({
        completedListeningLessonIds: ['listen_a2_1', 'listen_b2_1', 'listen_b2_2'],
      });

      // B2 progress is preserved!
      expect(journey.levels.B2.completedLessons).toBe(2);
      expect(journey.levels.B2.status).toBe('in_progress');

      // A2 progress is preserved!
      expect(journey.levels.A2.completedLessons).toBe(1);
      expect(journey.levels.A2.status).toBe('in_progress');

      // A2 is the lowest incomplete in_progress level
      expect(journey.summary.currentLevel).toBe('A2');
    });

    it('advances currentLevel to C2 when all levels are completed', () => {
      const journey = deriveFourSkillsLearningJourney({
        completedListeningLessonIds: LISTENING_LESSONS.map((l) => l.id),
        fourSkillsCompletionProgress: {
          reading: READING_LESSONS.map((r) => r.id),
          speaking: SPEAKING_PROMPTS.map((s) => s.id),
          writing: WRITING_PROMPTS.map((w) => w.id),
        },
      });

      expect(journey.summary.completedLevelsCount).toBe(6);
      expect(journey.summary.currentLevel).toBe('C2');
      expect(journey.summary.overallProgressPercent).toBe(100);
    });
  });

  describe('5. Next Recommended Lesson Derivation', () => {
    it('recommends the active resumable lesson as first priority', () => {
      const journey = deriveFourSkillsLearningJourney({
        resumeActivities: {
          speaking_sp_a1_1: {
            id: 'speaking_sp_a1_1',
            type: 'speaking',
            title: 'Daily Greetings',
            startedAt: Date.now() - 10000,
            lastActiveAt: Date.now() - 500,
            completed: false,
            schemaVersion: 1,
            checkpoint: {
              promptId: 'sp_a1_1',
              currentTurnIndex: 1,
              totalTurns: 3,
            },
          },
        },
      });

      expect(journey.summary.nextRecommendedLesson).toBeDefined();
      expect(journey.summary.nextRecommendedLesson?.id).toBe('sp_a1_1');
      expect(journey.summary.nextRecommendedLesson?.skill).toBe('speaking');
      expect(journey.summary.nextRecommendedLesson?.isActive).toBe(true);
      expect(journey.summary.nextRecommendedLesson?.action).toEqual({
        tab: 'four_skills',
        skill: 'speaking',
        lessonId: 'sp_a1_1',
      });
    });

    it('selects balanced uncompleted lesson when no active session exists', () => {
      // User finished A1 listening 1 & 2
      const journey = deriveFourSkillsLearningJourney({
        completedListeningLessonIds: ['listen_a1_1', 'listen_a1_2'],
      });

      // Reading, speaking, writing have 0 completed lessons in A1.
      // Balanced algorithm checks skill with lowest progress (ties broken by ['listening', 'reading', 'speaking', 'writing']).
      // Lowest progress is reading/speaking/writing (0 vs 2). First among those is reading.
      expect(journey.summary.nextRecommendedLesson).toBeDefined();
      expect(journey.summary.nextRecommendedLesson?.skill).toBe('reading');
      expect(journey.summary.nextRecommendedLesson?.id).toBe('read_a1_1');
      expect(journey.summary.nextRecommendedLesson?.action).toEqual({
        tab: 'four_skills',
        skill: 'reading',
        lessonId: 'read_a1_1',
      });
    });

    it('provides clean onboarding Start Here recommendation for new users', () => {
      const journey = deriveFourSkillsLearningJourney();

      expect(journey.summary.isNewUser).toBe(true);
      expect(journey.summary.nextRecommendedLesson).toBeDefined();
      expect(journey.summary.nextRecommendedLesson?.id).toBe('listen_a1_1');
      expect(journey.summary.nextRecommendedLesson?.level).toBe('A1');
      expect(journey.summary.nextRecommendedLesson?.action.tab).toBe('four_skills');
    });
  });

  describe('6. Backward Compatibility & Anomaly Resilience', () => {
    it('handles legacy or deleted IDs gracefully without inflating denominators', () => {
      const journey = deriveFourSkillsLearningJourney({
        // Include non-existent / deleted IDs
        completedListeningLessonIds: ['listen_legacy_old_999', 'listen_a1_1'],
        fourSkillsCompletionProgress: {
          reading: ['deleted_reading_id', 'read_a1_1'],
          speaking: [],
          writing: [],
        },
      });

      // Total denominator must still be based strictly on existing dataset lessons!
      expect(journey.levels.A1.totalLessons).toBe(16);
      expect(journey.levels.A1.skills.listening.totalLessons).toBe(4);
      expect(journey.levels.A1.skills.reading.totalLessons).toBe(4);

      // Only valid matching IDs count towards completedLessons
      expect(journey.levels.A1.skills.listening.completedLessons).toBe(1);
      expect(journey.levels.A1.skills.reading.completedLessons).toBe(1);
      expect(journey.levels.A1.completedLessons).toBe(2);
    });

    it('handles null or undefined store collections without crashing', () => {
      expect(() =>
        deriveFourSkillsLearningJourney({
          completedListeningLessonIds: undefined,
          fourSkillsCompletionProgress: null,
          resumeActivities: null,
        })
      ).not.toThrow();
    });

    it('does not mutate input parameters (pure function invariant)', () => {
      const completedList = ['listen_a1_1'];
      const completionProgress = { reading: ['read_a1_1'], speaking: [], writing: [] };
      const resumeMap = {};

      const completedListSnapshot = [...completedList];
      const readingSnapshot = [...completionProgress.reading];

      deriveFourSkillsLearningJourney({
        completedListeningLessonIds: completedList,
        fourSkillsCompletionProgress: completionProgress,
        resumeActivities: resumeMap,
      });

      expect(completedList).toEqual(completedListSnapshot);
      expect(completionProgress.reading).toEqual(readingSnapshot);
    });

    it('produces deterministic output across multiple invocations', () => {
      const input = {
        completedListeningLessonIds: ['listen_a1_1', 'listen_a1_2'],
        fourSkillsCompletionProgress: {
          reading: ['read_a1_1'],
          speaking: ['sp_b1_1'],
          writing: [],
        },
      };

      const run1 = deriveFourSkillsLearningJourney(input);
      const run2 = deriveFourSkillsLearningJourney(input);

      expect(run1).toEqual(run2);
    });
  });

  describe('7. Store Integration via deriveFourSkillsLearningJourneyFromStore', () => {
    it('reads cleanly from Zustand store state', () => {
      useAppStore.setState({
        completedListeningLessonIds: ['listen_a1_1', 'listen_a1_2'],
        fourSkillsCompletionProgress: {
          reading: ['read_a1_1'],
          speaking: [],
          writing: [],
        },
      });

      const journey = deriveFourSkillsLearningJourneyFromStore();

      expect(journey.levels.A1.completedLessons).toBe(3);
      expect(journey.levels.A1.status).toBe('in_progress');
      expect(journey.summary.currentLevel).toBe('A1');
    });
  });

  describe('8. Phase 3 Hardening & Edge Cases', () => {
    it('ignores stale resume activity for an already completed lesson (no fake in-progress)', () => {
      const now = Date.now();
      const journey = deriveFourSkillsLearningJourney({
        nowMs: now,
        completedListeningLessonIds: ['listen_a1_1'],
        resumeActivities: {
          listening_listen_a1_1: {
            id: 'listening_listen_a1_1',
            type: 'listening',
            title: 'Meeting a Friend',
            startedAt: now - 60000,
            lastActiveAt: now - 10000,
            completed: false,
            schemaVersion: 1,
            checkpoint: {
              lessonId: 'listen_a1_1',
              answers: { 0: 1 },
              totalQuestions: 4,
              progressPercent: 50,
            },
          },
        },
      });

      // The stale resume activity should be ignored because listen_a1_1 is already completed
      expect(journey.summary.activeResumeLesson).toBeNull();
      expect(journey.levels.A1.activeLesson).toBeNull();
      // next recommended lesson should move on to next uncompleted lesson
      expect(journey.summary.nextRecommendedLesson?.id).not.toBe('listen_a1_1');
    });

    it('deterministically selects the most recently active lesson when multiple resume activities exist', () => {
      const now = Date.now();
      const journey = deriveFourSkillsLearningJourney({
        nowMs: now,
        resumeActivities: {
          reading_read_a1_1: {
            id: 'reading_read_a1_1',
            type: 'reading',
            title: 'A1 Reading',
            startedAt: now - 300000,
            lastActiveAt: now - 100000, // older
            completed: false,
            schemaVersion: 1,
            checkpoint: {
              lessonId: 'read_a1_1',
              answers: {},
              totalQuestions: 4,
              progressPercent: 25,
            },
          },
          writing_wp_1: {
            id: 'writing_wp_1',
            type: 'writing',
            title: 'Pull Request Description',
            startedAt: now - 200000,
            lastActiveAt: now - 10000, // newer!
            completed: false,
            schemaVersion: 1,
            checkpoint: {
              promptId: 'wp_1',
              draft: 'Hello world',
              wordCount: 50,
              progressPercent: 40,
            },
          },
        },
      });

      expect(journey.summary.activeResumeLesson).toBeDefined();
      expect(journey.summary.activeResumeLesson?.id).toBe('wp_1');
      expect(journey.summary.activeResumeLesson?.level).toBe('B2');
      expect(journey.summary.currentLevel).toBe('B2');
    });

    it('preserves completion invariant (completion != competency)', () => {
      // 100% of A1 completed
      const allA1Listening = ['listen_a1_1', 'listen_a1_2', 'listen_a1_3', 'listen_a1_4'];
      const allA1Reading = ['read_a1_1', 'read_a1_2', 'read_a1_3', 'read_a1_4'];
      const allA1Speaking = ['sp_a1_1', 'sp_a1_2', 'sp_a1_3', 'sp_a1_4'];
      const allA1Writing = ['wp_a1_1', 'wp_a1_2', 'wp_a1_3', 'wp_a1_4'];

      const journey = deriveFourSkillsLearningJourney({
        completedListeningLessonIds: allA1Listening,
        fourSkillsCompletionProgress: {
          reading: allA1Reading,
          speaking: allA1Speaking,
          writing: allA1Writing,
        },
        competency: null, // Zero competency data
      });

      const a1Node = journey.levels.A1;
      expect(a1Node.completedLessons).toBe(16);
      expect(a1Node.totalLessons).toBe(16);
      expect(a1Node.progressPercent).toBe(100);
      expect(a1Node.status).toBe('completed');
      expect(a1Node.isCompleted).toBe(true);

      // Current level moves on to A2
      expect(journey.summary.currentLevel).toBe('A2');
      expect(journey.summary.completedLevelsCount).toBe(1);
    });
  });
});

