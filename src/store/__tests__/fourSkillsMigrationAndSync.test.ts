// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../useAppStore';
import type { FourSkillsCompletionProgress } from '../../types';

describe('PHASE 3 & PHASE 4: Legacy Migration, Partialize, Backup & Cloud Sync Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().resetToDefault();
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. ONE-TIME MIGRATION & REHYDRATION (PHASE 3)
  // =========================================================================
  describe('1. Legacy Storage Migration via onRehydrateStorage', () => {
    it('migrates all 3 legacy keys (reading, speaking, writing) into Zustand and removes legacy keys', async () => {
      localStorage.setItem('completed_reading_lessons', JSON.stringify(['read_1', 'read_2']));
      localStorage.setItem('completed_speaking_prompts', JSON.stringify(['speak_1']));
      localStorage.setItem('completed_writing_prompts', JSON.stringify(['write_1', 'write_2']));

      await useAppStore.persist.rehydrate();

      const state = useAppStore.getState();
      expect(state.fourSkillsCompletionProgress.reading).toEqual(['read_1', 'read_2']);
      expect(state.fourSkillsCompletionProgress.speaking).toEqual(['speak_1']);
      expect(state.fourSkillsCompletionProgress.writing).toEqual(['write_1', 'write_2']);

      // All 3 legacy keys must be removed after successful migration
      expect(localStorage.getItem('completed_reading_lessons')).toBeNull();
      expect(localStorage.getItem('completed_speaking_prompts')).toBeNull();
      expect(localStorage.getItem('completed_writing_prompts')).toBeNull();
    });

    it('deduplicates and trims legacy IDs during migration', async () => {
      localStorage.setItem(
        'completed_reading_lessons',
        JSON.stringify(['read_1', '  read_2  ', 'read_1', '', '   '])
      );

      await useAppStore.persist.rehydrate();

      const state = useAppStore.getState();
      expect(state.fourSkillsCompletionProgress.reading).toEqual(['read_1', 'read_2']);
      expect(localStorage.getItem('completed_reading_lessons')).toBeNull();
    });

    it('failed migration due to corrupted JSON does not crash and does NOT remove source key', async () => {
      const corruptedJson = '{ bad json syntax ...';
      localStorage.setItem('completed_reading_lessons', corruptedJson);
      localStorage.setItem('completed_speaking_prompts', JSON.stringify(['speak_valid']));

      await expect(useAppStore.persist.rehydrate()).resolves.not.toThrow();

      const state = useAppStore.getState();
      // Failed reading migration preserved the source corrupted key
      expect(localStorage.getItem('completed_reading_lessons')).toBe(corruptedJson);
      expect(state.fourSkillsCompletionProgress.reading).toEqual([]);

      // But valid speaking migration succeeded and cleaned up
      expect(state.fourSkillsCompletionProgress.speaking).toEqual(['speak_valid']);
      expect(localStorage.getItem('completed_speaking_prompts')).toBeNull();
    });

    it('failed migration due to non-array value does NOT remove source key', async () => {
      const nonArray = JSON.stringify({ lesson: 'read_1' });
      localStorage.setItem('completed_reading_lessons', nonArray);

      await useAppStore.persist.rehydrate();

      expect(localStorage.getItem('completed_reading_lessons')).toBe(nonArray);
      expect(useAppStore.getState().fourSkillsCompletionProgress.reading).toEqual([]);
    });

    it('unions legacy data with existing Zustand state monotonically without losing existing progress', async () => {
      useAppStore.setState({
        fourSkillsCompletionProgress: {
          reading: ['read_existing_1'],
          speaking: ['speak_existing_1'],
          writing: [],
        },
      });

      localStorage.setItem('completed_reading_lessons', JSON.stringify(['read_legacy_2', 'read_existing_1']));
      localStorage.setItem('completed_speaking_prompts', JSON.stringify(['speak_legacy_2']));

      await useAppStore.persist.rehydrate();

      const state = useAppStore.getState();
      expect(state.fourSkillsCompletionProgress.reading).toEqual(['read_existing_1', 'read_legacy_2']);
      expect(state.fourSkillsCompletionProgress.speaking).toEqual(['speak_existing_1', 'speak_legacy_2']);
      expect(localStorage.getItem('completed_reading_lessons')).toBeNull();
      expect(localStorage.getItem('completed_speaking_prompts')).toBeNull();
    });

    it('is idempotent: consecutive rehydrations do not duplicate or lose progress', async () => {
      localStorage.setItem('completed_reading_lessons', JSON.stringify(['read_1', 'read_2']));

      await useAppStore.persist.rehydrate();
      expect(useAppStore.getState().fourSkillsCompletionProgress.reading).toEqual(['read_1', 'read_2']);

      // Second rehydrate
      await useAppStore.persist.rehydrate();
      expect(useAppStore.getState().fourSkillsCompletionProgress.reading).toEqual(['read_1', 'read_2']);

      // Third rehydrate
      await useAppStore.persist.rehydrate();
      expect(useAppStore.getState().fourSkillsCompletionProgress.reading).toEqual(['read_1', 'read_2']);
    });

    it('fresh user with no legacy keys rehydrates safely with empty arrays', async () => {
      await useAppStore.persist.rehydrate();

      const state = useAppStore.getState();
      expect(state.fourSkillsCompletionProgress).toEqual({
        reading: [],
        speaking: [],
        writing: [],
      });
    });
  });

  // =========================================================================
  // 2. BACKUP EXPORT & IMPORT (PHASE 4)
  // =========================================================================
  describe('2. Backup Export & Import Multi-Skill Data Flow', () => {
    it('exportBackupData includes fourSkillsCompletionProgress in JSON output', () => {
      useAppStore.getState().markFourSkillsLessonCompleted('reading', 'read_export_1');
      useAppStore.getState().markFourSkillsLessonCompleted('speaking', 'speak_export_1');
      useAppStore.getState().markFourSkillsLessonCompleted('writing', 'write_export_1');

      const json = useAppStore.getState().exportBackupData();
      const parsed = JSON.parse(json);

      expect(parsed.fourSkillsCompletionProgress).toBeDefined();
      expect(parsed.fourSkillsCompletionProgress.reading).toEqual(['read_export_1']);
      expect(parsed.fourSkillsCompletionProgress.speaking).toEqual(['speak_export_1']);
      expect(parsed.fourSkillsCompletionProgress.writing).toEqual(['write_export_1']);
    });

    it('importBackupData restores modern backup with fourSkillsCompletionProgress losslessly', () => {
      const backupJson = JSON.stringify({
        profile: { name: 'Test User' },
        fourSkillsCompletionProgress: {
          reading: ['read_backup_1', 'read_backup_2'],
          speaking: ['speak_backup_1'],
          writing: ['write_backup_1'],
        },
      });

      const res = useAppStore.getState().importBackupData(backupJson);
      expect(res.success).toBe(true);

      const state = useAppStore.getState();
      expect(state.fourSkillsCompletionProgress.reading).toEqual(['read_backup_1', 'read_backup_2']);
      expect(state.fourSkillsCompletionProgress.speaking).toEqual(['speak_backup_1']);
      expect(state.fourSkillsCompletionProgress.writing).toEqual(['write_backup_1']);
    });

    it('importBackupData from legacy backup missing new field falls back gracefully to empty arrays', () => {
      const legacyBackupJson = JSON.stringify({
        profile: { name: 'Old User' },
        userCustomWords: [],
        // fourSkillsCompletionProgress missing
      });

      const res = useAppStore.getState().importBackupData(legacyBackupJson);
      expect(res.success).toBe(true);

      const state = useAppStore.getState();
      expect(state.fourSkillsCompletionProgress).toEqual({
        reading: [],
        speaking: [],
        writing: [],
      });
    });

    it('importBackupData backwards-compatible with top-level legacy keys in backup file', () => {
      const legacyNamedBackupJson = JSON.stringify({
        profile: { name: 'Legacy Key User' },
        completed_reading_lessons: ['read_legacy_1'],
        completed_speaking_prompts: ['speak_legacy_1'],
        completed_writing_prompts: ['write_legacy_1'],
      });

      const res = useAppStore.getState().importBackupData(legacyNamedBackupJson);
      expect(res.success).toBe(true);

      const state = useAppStore.getState();
      expect(state.fourSkillsCompletionProgress.reading).toEqual(['read_legacy_1']);
      expect(state.fourSkillsCompletionProgress.speaking).toEqual(['speak_legacy_1']);
      expect(state.fourSkillsCompletionProgress.writing).toEqual(['write_legacy_1']);
    });

    it('importBackupData tolerates malformed/corrupted fourSkillsCompletionProgress without crashing', () => {
      const corruptedBackupJson = JSON.stringify({
        profile: { name: 'Corrupted User' },
        fourSkillsCompletionProgress: 'not-an-object',
      });

      const res = useAppStore.getState().importBackupData(corruptedBackupJson);
      expect(res.success).toBe(true);
      expect(useAppStore.getState().fourSkillsCompletionProgress).toEqual({
        reading: [],
        speaking: [],
        writing: [],
      });
    });
  });

  // =========================================================================
  // 3. CLOUD SYNC & MULTI-DEVICE MERGE (PHASE 4)
  // =========================================================================
  describe('3. Cloud Sync & Multi-Device Monotonic Merge', () => {
    it('merges overlapping local and cloud completion into a deduplicated union', () => {
      useAppStore.setState({
        fourSkillsCompletionProgress: {
          reading: ['read_1', 'read_2'],
          speaking: ['speak_1'],
          writing: [],
        },
      });

      useAppStore.getState().mergeCloudData({
        cloudProfile: {
          four_skills_completion_progress: {
            reading: ['read_2', 'read_3'],
            speaking: ['speak_1', 'speak_2'],
            writing: ['write_1'],
          },
        },
      });

      const progress = useAppStore.getState().fourSkillsCompletionProgress;
      expect(progress.reading).toEqual(['read_1', 'read_2', 'read_3']);
      expect(progress.speaking).toEqual(['speak_1', 'speak_2']);
      expect(progress.writing).toEqual(['write_1']);
    });

    it('populated local + empty/missing cloud does NOT delete or regress local progress', () => {
      useAppStore.setState({
        fourSkillsCompletionProgress: {
          reading: ['read_local_preserve'],
          speaking: ['speak_local_preserve'],
          writing: ['write_local_preserve'],
        },
      });

      // Remote cloud has no completion info
      useAppStore.getState().mergeCloudData({
        cloudProfile: {
          id: 'remote_1',
          xp: 100,
        },
      });

      const progress = useAppStore.getState().fourSkillsCompletionProgress;
      expect(progress.reading).toEqual(['read_local_preserve']);
      expect(progress.speaking).toEqual(['speak_local_preserve']);
      expect(progress.writing).toEqual(['write_local_preserve']);
    });

    it('empty new device + populated cloud restores all cloud completed lessons', () => {
      expect(useAppStore.getState().fourSkillsCompletionProgress).toEqual({
        reading: [],
        speaking: [],
        writing: [],
      });

      useAppStore.getState().mergeCloudData({
        cloudProfile: {
          four_skills_completion_progress: {
            reading: ['read_c1', 'read_c2'],
            speaking: ['speak_c1'],
            writing: ['write_c1'],
          },
        },
      });

      const progress = useAppStore.getState().fourSkillsCompletionProgress;
      expect(progress.reading).toEqual(['read_c1', 'read_c2']);
      expect(progress.speaking).toEqual(['speak_c1']);
      expect(progress.writing).toEqual(['write_c1']);
    });

    it('supports cloud payloads formatted with legacy flat keys in four_skills_scores', () => {
      useAppStore.getState().mergeCloudData({
        cloudProfile: {
          four_skills_scores: {
            listening: [],
            reading: [],
            speaking: [],
            writing: [],
            completed_reading_lessons: ['read_legacy_cloud'],
            completed_speaking_prompts: ['speak_legacy_cloud'],
            completed_writing_prompts: ['write_legacy_cloud'],
          },
        },
      });

      const progress = useAppStore.getState().fourSkillsCompletionProgress;
      expect(progress.reading).toEqual(['read_legacy_cloud']);
      expect(progress.speaking).toEqual(['speak_legacy_cloud']);
      expect(progress.writing).toEqual(['write_legacy_cloud']);
    });

    it('safely tolerates malformed types in cloud completion payload without throwing', () => {
      useAppStore.getState().markFourSkillsLessonCompleted('reading', 'read_stay');

      expect(() => {
        useAppStore.getState().mergeCloudData({
          cloudProfile: {
            four_skills_completion_progress: {
              reading: 'not-an-array' as any,
              speaking: [123, null, undefined, 'speak_valid', '  '] as any,
              writing: { foo: 'bar' } as any,
            },
          },
        });
      }).not.toThrow();

      const progress = useAppStore.getState().fourSkillsCompletionProgress;
      expect(progress.reading).toEqual(['read_stay']);
      expect(progress.speaking).toEqual(['speak_valid']);
      expect(progress.writing).toEqual([]);
    });

    it('does not mutate input arrays or local state objects in place', () => {
      const localReading = ['read_1'];
      const cloudReading = ['read_2'];
      const localReadingCopy = [...localReading];
      const cloudReadingCopy = [...cloudReading];

      useAppStore.setState({
        fourSkillsCompletionProgress: {
          reading: localReading,
          speaking: [],
          writing: [],
        },
      });

      useAppStore.getState().mergeCloudData({
        cloudProfile: {
          four_skills_completion_progress: {
            reading: cloudReading,
            speaking: [],
            writing: [],
          },
        },
      });

      expect(localReading).toEqual(localReadingCopy);
      expect(cloudReading).toEqual(cloudReadingCopy);
    });
  });

  // =========================================================================
  // 4. CUTOVER VERIFICATION
  // =========================================================================
  describe('4. Cutover State Verification', () => {
    it('completed lessons update through markFourSkillsLessonCompleted and are accessible via Zustand', () => {
      const store = useAppStore.getState();

      store.markFourSkillsLessonCompleted('reading', 'read_cutover_1');
      store.markFourSkillsLessonCompleted('speaking', 'speak_cutover_1');
      store.markFourSkillsLessonCompleted('writing', 'write_cutover_1');

      const progress = useAppStore.getState().fourSkillsCompletionProgress;
      expect(progress.reading).toContain('read_cutover_1');
      expect(progress.speaking).toContain('speak_cutover_1');
      expect(progress.writing).toContain('write_cutover_1');

      // Verifies no legacy dual-write occurs to localStorage
      expect(localStorage.getItem('completed_reading_lessons')).toBeNull();
      expect(localStorage.getItem('completed_speaking_prompts')).toBeNull();
      expect(localStorage.getItem('completed_writing_prompts')).toBeNull();
    });
  });

  // =========================================================================
  // 5. PHASE 5 END-TO-END REGRESSION & EDGE CASES
  // =========================================================================
  describe('5. Phase 5 Full Lifecycle & Edge Cases Regression', () => {
    it('preserves historical IDs not present in current lesson datasets across all operations', () => {
      const historicalId = 'legacy_reading_lesson_archive_2023_v0';
      useAppStore.getState().markFourSkillsLessonCompleted('reading', historicalId);

      const exported = useAppStore.getState().exportBackupData();
      useAppStore.getState().resetToDefault();
      expect(useAppStore.getState().fourSkillsCompletionProgress.reading).toHaveLength(0);

      useAppStore.getState().importBackupData(exported);
      expect(useAppStore.getState().fourSkillsCompletionProgress.reading).toContain(historicalId);

      // Cloud merge also preserves it
      useAppStore.getState().mergeCloudData({
        cloudProfile: {
          four_skills_completion_progress: {
            reading: ['read_new_device'],
            speaking: [],
            writing: [],
          },
        },
      });

      const finalState = useAppStore.getState().fourSkillsCompletionProgress;
      expect(finalState.reading).toContain(historicalId);
      expect(finalState.reading).toContain('read_new_device');
    });

    it('executes full end-to-end lifecycle without state loss across devices', async () => {
      // 1. Device A completes lessons
      const storeA = useAppStore.getState();
      storeA.markFourSkillsLessonCompleted('reading', 'reading_lesson_101');
      storeA.markFourSkillsLessonCompleted('speaking', 'speaking_prompt_202');
      storeA.markFourSkillsLessonCompleted('writing', 'writing_prompt_303');

      // 2. Partialize & persist check
      await useAppStore.persist.rehydrate();
      const stateA = useAppStore.getState();
      expect(stateA.fourSkillsCompletionProgress.reading).toContain('reading_lesson_101');
      expect(stateA.fourSkillsCompletionProgress.speaking).toContain('speaking_prompt_202');
      expect(stateA.fourSkillsCompletionProgress.writing).toContain('writing_prompt_303');

      // 3. Backup export
      const backupJson = stateA.exportBackupData();

      // 4. Device B restores backup
      useAppStore.getState().resetToDefault();
      const importResult = useAppStore.getState().importBackupData(backupJson);
      expect(importResult.success).toBe(true);
      expect(useAppStore.getState().fourSkillsCompletionProgress.reading).toContain('reading_lesson_101');

      // 5. Device B marks an additional lesson
      useAppStore.getState().markFourSkillsLessonCompleted('reading', 'reading_lesson_device_b');

      // 6. Device A merges Device B's cloud payload
      const cloudPayloadFromB = {
        cloudProfile: {
          four_skills_completion_progress: useAppStore.getState().fourSkillsCompletionProgress,
        },
      };

      // Reset to simulate Device A's initial state
      useAppStore.setState({
        fourSkillsCompletionProgress: {
          reading: ['reading_lesson_101'],
          speaking: ['speaking_prompt_202'],
          writing: ['writing_prompt_303'],
        },
      });

      useAppStore.getState().mergeCloudData(cloudPayloadFromB);

      const mergedDeviceA = useAppStore.getState().fourSkillsCompletionProgress;
      expect(mergedDeviceA.reading).toEqual(['reading_lesson_101', 'reading_lesson_device_b']);
      expect(mergedDeviceA.speaking).toEqual(['speaking_prompt_202']);
      expect(mergedDeviceA.writing).toEqual(['writing_prompt_303']);
    });

    it('ensures fourSkillsScores and existing competency evidence are completely uncorrupted by completion actions', () => {
      const initialScores = {
        listening: [85, 90],
        reading: [75, 80],
        speaking: [70],
        writing: [65],
      };
      useAppStore.getState().setFourSkillsScores(initialScores);

      // Perform completion actions
      useAppStore.getState().markFourSkillsLessonCompleted('reading', 'read_lesson_perf');
      useAppStore.getState().markFourSkillsLessonCompleted('speaking', 'speak_prompt_perf');

      // Scores must remain identical
      expect(useAppStore.getState().fourSkillsScores).toEqual(initialScores);

      // Cloud merge completion only
      useAppStore.getState().mergeCloudData({
        cloudProfile: {
          four_skills_completion_progress: {
            reading: ['read_cloud_extra'],
            speaking: [],
            writing: [],
          },
        },
      });

      expect(useAppStore.getState().fourSkillsScores).toEqual(initialScores);
    });
  });
});
