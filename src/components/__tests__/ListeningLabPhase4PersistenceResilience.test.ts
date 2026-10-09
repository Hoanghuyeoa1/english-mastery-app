// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useAppStore,
  mergeSkillScores,
  sanitizeScoreArray,
  sanitizeFourSkillsScores,
  sanitizeStringIds,
  DEFAULT_FOUR_SKILLS_SCORES,
} from '../../store/useAppStore';
import {
  getCefrLevelFromScore,
  getFourSkillsCompetency,
  clearAllSkillsData,
} from '../../services/skillsCompetencyService';
import { LISTENING_LESSONS } from '../../data/fourSkills/listeningData';

describe('PHASE 4: Listening Lab Persistence, Cloud, Offline & Resilience Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().resetToDefault();
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. INVARIANTS: SANITIZATION & BOUNDS
  // =========================================================================
  describe('1. Invariants: Score & String Sanitization', () => {
    it('rejects NaN, Infinity, -Infinity, strings, null, and objects', () => {
      const input = [80, NaN, Infinity, -Infinity, '100', null, undefined, { score: 90 }, 85];
      const result = sanitizeScoreArray(input);

      expect(result).toEqual([80, 85]);
      expect(result.every((n) => Number.isFinite(n) && !Number.isNaN(n))).toBe(true);
    });

    it('clamps scores outside [0, 100] and rounds floats', () => {
      const input = [-25, 0, 45.4, 45.6, 100, 150];
      const result = sanitizeScoreArray(input);

      expect(result).toEqual([0, 0, 45, 46, 100, 100]);
    });

    it('enforces maximum 50 elements and does not mutate input array', () => {
      const originalInput = Array.from({ length: 70 }, (_, i) => i + 1);
      const inputCopy = [...originalInput];

      const result = sanitizeScoreArray(originalInput);

      // Input must not be mutated
      expect(originalInput).toEqual(inputCopy);
      // Result must be strictly max 50 items (last 50)
      expect(result).toHaveLength(50);
      expect(result[0]).toBe(21);
      expect(result[49]).toBe(70);
    });

    it('sanitizeFourSkillsScores handles corrupted object, non-object, and missing keys', () => {
      expect(sanitizeFourSkillsScores(null)).toEqual(DEFAULT_FOUR_SKILLS_SCORES);
      expect(sanitizeFourSkillsScores('invalid' as any)).toEqual(DEFAULT_FOUR_SKILLS_SCORES);

      const partialCorrupted = {
        listening: [90, NaN, 110],
        reading: null,
        speaking: undefined,
        writing: [70],
      };

      const sanitized = sanitizeFourSkillsScores(partialCorrupted);
      expect(sanitized.listening).toEqual([90, 100]);
      expect(sanitized.reading).toEqual([]);
      expect(sanitized.speaking).toEqual([]);
      expect(sanitized.writing).toEqual([70]);
    });

    it('sanitizeStringIds trims, filters non-strings, dedupes, and does not mutate input', () => {
      const raw = [' listen_1 ', 'listen_2', '', '  ', null as any, 123 as any, 'listen_1', 'listen_3'];
      const rawCopy = [...raw];

      const result = sanitizeStringIds(raw);

      expect(raw).toEqual(rawCopy);
      expect(result).toEqual(['listen_1', 'listen_2', 'listen_3']);
    });
  });

  // =========================================================================
  // 2. CLOUD SYNC SEQUENCE RECONCILIATION & MERGE INTEGRITY
  // =========================================================================
  describe('2. Cloud Sync Sequence Reconciliation & Deduplication', () => {
    it('Scenario 1: Identical local and cloud score arrays do NOT duplicate', () => {
      const local = [75, 80, 85];
      const cloud = [75, 80, 85];

      const merged = mergeSkillScores(local, cloud);
      expect(merged).toEqual([75, 80, 85]);
      expect(merged).toHaveLength(3);
    });

    it('Scenario 2: Cloud extends local (cloud has new remote scores) -> updates to cloud', () => {
      const local = [75, 80];
      const cloud = [75, 80, 85, 90];

      const merged = mergeSkillScores(local, cloud);
      expect(merged).toEqual([75, 80, 85, 90]);
    });

    it('Scenario 3: Local extends cloud (local has new offline scores) -> preserves local', () => {
      const local = [75, 80, 85, 90];
      const cloud = [75, 80];

      const merged = mergeSkillScores(local, cloud);
      expect(merged).toEqual([75, 80, 85, 90]);
    });

    it('Scenario 4: Suffix-prefix overlap merges smoothly without duplicating overlap', () => {
      const local = [70, 75, 80];
      const cloud = [80, 85, 90];

      const merged = mergeSkillScores(local, cloud);
      expect(merged).toEqual([70, 75, 80, 85, 90]);
    });

    it('Scenario 5: Disjoint score histories combine local + cloud', () => {
      const local = [75, 80];
      const cloud = [85, 90];

      const merged = mergeSkillScores(local, cloud);
      expect(merged).toEqual([75, 80, 85, 90]);
    });

    it('Scenario 6: Malformed cloud data is sanitized before merge', () => {
      const local = [80];
      const corruptedCloud = [null, 'invalid', NaN, -20, 150, 95] as any;

      const merged = mergeSkillScores(local, corruptedCloud);
      expect(merged).toEqual([80, 0, 100, 95]);
    });

    it('Scenario 7: Recurring full sync does NOT multiply scores across sync passes', () => {
      useAppStore.setState({
        fourSkillsScores: {
          listening: [80, 85],
          reading: [90],
          speaking: [],
          writing: [],
        },
      });

      const cloudPayload = {
        cloudProfile: {
          id: 'test-user',
          four_skills_scores: {
            listening: [80, 85],
            reading: [90],
            speaking: [],
            writing: [],
          },
        },
      };

      // Run merge multiple times (simulating recurring syncs / page reloads)
      useAppStore.getState().mergeCloudData(cloudPayload);
      useAppStore.getState().mergeCloudData(cloudPayload);
      useAppStore.getState().mergeCloudData(cloudPayload);

      const state = useAppStore.getState();
      expect(state.fourSkillsScores.listening).toEqual([80, 85]);
      expect(state.fourSkillsScores.reading).toEqual([90]);
    });

    it('Scenario 8: Cloud completed listening lessons merge via monotonic union', () => {
      useAppStore.setState({
        completedListeningLessonIds: ['listen_1'],
      });

      const cloudPayload = {
        cloudProfile: {
          id: 'test-user',
          four_skills_scores: {
            listening: [85],
            reading: [],
            speaking: [],
            writing: [],
            completed_listening_lessons: ['listen_2', 'listen_1'],
          } as any,
        },
      };

      useAppStore.getState().mergeCloudData(cloudPayload);

      const state = useAppStore.getState();
      expect(state.completedListeningLessonIds).toEqual(['listen_1', 'listen_2']);
      expect(state.completedListeningLessonIds).toHaveLength(2);
    });
  });

  // =========================================================================
  // 3. COMPLETION PERSISTENCE & LEGACY MIGRATION
  // =========================================================================
  describe('3. Completion Persistence & Legacy Migration', () => {
    it('migrates valid legacy localStorage key into Zustand store and removes legacy key', async () => {
      localStorage.setItem('completed_listening_lessons', JSON.stringify(['listen_1', 'listen_2']));

      await useAppStore.persist.rehydrate();

      // Check migration result
      const state = useAppStore.getState();
      expect(state.completedListeningLessonIds).toContain('listen_1');
      expect(state.completedListeningLessonIds).toContain('listen_2');
      // Legacy key must be safely removed after migration
      expect(localStorage.getItem('completed_listening_lessons')).toBeNull();
    });

    it('deduplicates legacy items during migration', async () => {
      localStorage.setItem(
        'completed_listening_lessons',
        JSON.stringify(['listen_1', 'listen_2', 'listen_1', ' listen_2 '])
      );

      await useAppStore.persist.rehydrate();

      const state = useAppStore.getState();
      expect(state.completedListeningLessonIds).toEqual(['listen_1', 'listen_2']);
    });

    it('safely handles malformed JSON in legacy key without throwing', async () => {
      localStorage.setItem('completed_listening_lessons', '{ corrupted json ...');

      await expect(useAppStore.persist.rehydrate()).resolves.not.toThrow();

      // Corrupted key should be cleared and store remains safe empty array
      expect(localStorage.getItem('completed_listening_lessons')).toBeNull();
      expect(useAppStore.getState().completedListeningLessonIds).toEqual([]);
    });

    it('is idempotent: running rehydration multiple times does not duplicate IDs', async () => {
      useAppStore.setState({ completedListeningLessonIds: ['listen_1'] });
      localStorage.setItem('completed_listening_lessons', JSON.stringify(['listen_2']));

      await useAppStore.persist.rehydrate();
      expect(useAppStore.getState().completedListeningLessonIds).toEqual(['listen_1', 'listen_2']);

      // Rehydrate a second time
      await useAppStore.persist.rehydrate();
      expect(useAppStore.getState().completedListeningLessonIds).toEqual(['listen_1', 'listen_2']);
    });

    it('merges legacy key with existing store state (union)', async () => {
      useAppStore.setState({ completedListeningLessonIds: ['listen_1', 'listen_3'] });
      localStorage.setItem('completed_listening_lessons', JSON.stringify(['listen_2', 'listen_3']));

      await useAppStore.persist.rehydrate();

      const state = useAppStore.getState();
      expect(state.completedListeningLessonIds).toEqual(['listen_1', 'listen_3', 'listen_2']);
    });

    it('markListeningLessonCompleted updates store idempotently and trims whitespace', () => {
      useAppStore.getState().markListeningLessonCompleted(' listen_1 ');
      expect(useAppStore.getState().completedListeningLessonIds).toEqual(['listen_1']);

      // Call again: must not duplicate
      useAppStore.getState().markListeningLessonCompleted('listen_1');
      expect(useAppStore.getState().completedListeningLessonIds).toEqual(['listen_1']);

      // Call with invalid id: must be ignored
      useAppStore.getState().markListeningLessonCompleted('');
      useAppStore.getState().markListeningLessonCompleted(null as any);
      expect(useAppStore.getState().completedListeningLessonIds).toEqual(['listen_1']);
    });
  });

  // =========================================================================
  // 4. BACKUP / RESTORE RESILIENCE
  // =========================================================================
  describe('4. Backup / Restore Resilience', () => {
    it('exportBackupData includes completedListeningLessonIds and roundtrips cleanly', () => {
      useAppStore.getState().markListeningLessonCompleted('listen_1');
      useAppStore.getState().markListeningLessonCompleted('listen_3');
      useAppStore.getState().recordSkillScore('listening', 88);

      const exportedJson = useAppStore.getState().exportBackupData();
      const parsed = JSON.parse(exportedJson);

      expect(parsed.completedListeningLessonIds).toEqual(['listen_1', 'listen_3']);
      expect(parsed.fourSkillsScores.listening).toEqual([88]);

      // Reset store
      useAppStore.getState().resetToDefault();
      expect(useAppStore.getState().completedListeningLessonIds).toEqual([]);

      // Restore from backup
      const restoreRes = useAppStore.getState().importBackupData(exportedJson);
      expect(restoreRes.success).toBe(true);
      expect(useAppStore.getState().completedListeningLessonIds).toEqual(['listen_1', 'listen_3']);
    });

    it('old backup missing completedListeningLessonIds loads safely as empty array', () => {
      const oldBackupJson = JSON.stringify({
        profile: { name: 'Legacy Learner' },
        fourSkillsScores: { listening: [80] },
      });

      const restoreRes = useAppStore.getState().importBackupData(oldBackupJson);
      expect(restoreRes.success).toBe(true);
      expect(useAppStore.getState().completedListeningLessonIds).toEqual([]);
      expect(useAppStore.getState().fourSkillsScores.listening).toEqual([80]);
    });

    it('malformed completedListeningLessonIds field does not crash restore', () => {
      const badBackupJson = JSON.stringify({
        profile: { name: 'Learner' },
        completedListeningLessonIds: 'not an array',
        fourSkillsScores: { listening: [null, NaN, 95] },
      });

      const restoreRes = useAppStore.getState().importBackupData(badBackupJson);
      expect(restoreRes.success).toBe(true);
      expect(useAppStore.getState().completedListeningLessonIds).toEqual([]);
      expect(useAppStore.getState().fourSkillsScores.listening).toEqual([95]);
    });
  });

  // =========================================================================
  // 5. CEFR COMPUTATION SAFETY & CORRUPTED INPUTS
  // =========================================================================
  describe('5. CEFR Computation Safety', () => {
    it('getCefrLevelFromScore handles NaN, null, and non-numbers safely as A1, never C2', () => {
      expect(getCefrLevelFromScore(NaN)).toBe('A1');
      expect(getCefrLevelFromScore(null as any)).toBe('A1');
      expect(getCefrLevelFromScore(undefined as any)).toBe('A1');
      expect(getCefrLevelFromScore(-10)).toBe('A1');
      expect(getCefrLevelFromScore(0)).toBe('A1');
      expect(getCefrLevelFromScore(100)).toBe('C2');
    });

    it('getFourSkillsCompetency filters corrupted scores and returns valid CEFR', () => {
      useAppStore.setState({
        fourSkillsScores: {
          listening: [NaN as any, 'corrupted' as any],
          reading: [],
          speaking: [],
          writing: [],
        },
      });

      const competency = getFourSkillsCompetency({});
      expect(competency.listening.score).toBe(0);
      expect(competency.listening.level).toBe('A1');
      expect(competency.listening.totalAttempts).toBe(0);
    });
  });

  // =========================================================================
  // 6. RESET & CLEANUP INTEGRITY
  // =========================================================================
  describe('6. Reset & Cleanup Integrity', () => {
    it('resetToDefault clears completion state in store and legacy keys in localStorage', () => {
      useAppStore.getState().markListeningLessonCompleted('listen_1');
      localStorage.setItem('completed_listening_lessons', JSON.stringify(['legacy_1']));

      expect(useAppStore.getState().completedListeningLessonIds).toEqual(['listen_1']);

      useAppStore.getState().resetToDefault();

      expect(useAppStore.getState().completedListeningLessonIds).toEqual([]);
      expect(localStorage.getItem('completed_listening_lessons')).toBeNull();
      expect(useAppStore.getState().fourSkillsScores).toEqual(DEFAULT_FOUR_SKILLS_SCORES);
    });

    it('clearAllSkillsData resets completedListeningLessonIds and fourSkillsScores', () => {
      useAppStore.getState().markListeningLessonCompleted('listen_2');
      useAppStore.getState().recordSkillScore('listening', 80);

      clearAllSkillsData();

      expect(useAppStore.getState().completedListeningLessonIds).toEqual([]);
      expect(useAppStore.getState().fourSkillsScores.listening).toEqual([]);
      expect(localStorage.getItem('completed_listening_lessons')).toBeNull();
    });
  });

  // =========================================================================
  // 7. STORAGE DISCIPLINE & STATIC DATA BOUNDS
  // =========================================================================
  describe('7. Storage Discipline & Static Dataset Bounds', () => {
    it('listening static dataset is bundled, not duplicated in Zustand store', () => {
      const state = useAppStore.getState() as any;

      // Invariant: Zustand must never store the static LISTENING_LESSONS dataset
      expect(state.LISTENING_LESSONS).toBeUndefined();
      expect(state.listeningLessons).toBeUndefined();
      expect(state.listeningQuestions).toBeUndefined();

      // Ensure static dataset exists and is immutable
      expect(LISTENING_LESSONS.length).toBeGreaterThan(0);
      expect(LISTENING_LESSONS.some((l) => l.id === 'listen_1')).toBe(true);
    });

    it('fourSkillsScores strictly enforces a 50-item ring buffer cap', () => {
      for (let i = 1; i <= 65; i++) {
        useAppStore.getState().recordSkillScore('listening', i);
      }

      const scores = useAppStore.getState().fourSkillsScores.listening;
      expect(scores.length).toBe(50);
      // Oldest scores (1..15) must be evicted, newest (16..65) preserved
      expect(scores[0]).toBe(16);
      expect(scores[49]).toBe(65);
    });
  });
});
