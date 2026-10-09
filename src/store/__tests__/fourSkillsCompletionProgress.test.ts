// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useAppStore,
  DEFAULT_FOUR_SKILLS_COMPLETION_PROGRESS,
  sanitizeFourSkillsCompletionProgress,
  mergeCompletionProgressIds,
  mergeFourSkillsCompletionProgress,
} from '../useAppStore';
import type { FourSkillsCompletionProgress } from '../../types';

describe('PHASE 2: Four Skills Completion Progress Foundation Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().resetToDefault();
    vi.clearAllMocks();
  });

  describe('1. Default State & Fresh User Safety', () => {
    it('initializes with empty arrays for reading, speaking, and writing', () => {
      const state = useAppStore.getState();
      expect(state.fourSkillsCompletionProgress).toBeDefined();
      expect(state.fourSkillsCompletionProgress.reading).toEqual([]);
      expect(state.fourSkillsCompletionProgress.speaking).toEqual([]);
      expect(state.fourSkillsCompletionProgress.writing).toEqual([]);
      expect(state.completedListeningLessonIds).toEqual([]);
    });

    it('resetToDefault resets fourSkillsCompletionProgress back to empty arrays', () => {
      useAppStore.getState().markFourSkillsLessonCompleted('reading', 'read_01');
      useAppStore.getState().markFourSkillsLessonCompleted('speaking', 'speak_01');
      useAppStore.getState().markFourSkillsLessonCompleted('writing', 'write_01');
      useAppStore.getState().markFourSkillsLessonCompleted('listening', 'listen_01');

      expect(useAppStore.getState().fourSkillsCompletionProgress.reading).toEqual(['read_01']);
      expect(useAppStore.getState().fourSkillsCompletionProgress.speaking).toEqual(['speak_01']);
      expect(useAppStore.getState().fourSkillsCompletionProgress.writing).toEqual(['write_01']);
      expect(useAppStore.getState().completedListeningLessonIds).toEqual(['listen_01']);

      useAppStore.getState().resetToDefault();

      expect(useAppStore.getState().fourSkillsCompletionProgress).toEqual({
        reading: [],
        speaking: [],
        writing: [],
      });
      expect(useAppStore.getState().completedListeningLessonIds).toEqual([]);
    });
  });

  describe('2. Valid Completion across Multiple Skills', () => {
    it('marks reading lesson as completed without affecting other skills', () => {
      useAppStore.getState().markFourSkillsLessonCompleted('reading', 'read_test_1');

      const progress = useAppStore.getState().fourSkillsCompletionProgress;
      expect(progress.reading).toEqual(['read_test_1']);
      expect(progress.speaking).toEqual([]);
      expect(progress.writing).toEqual([]);
      expect(useAppStore.getState().completedListeningLessonIds).toEqual([]);
    });

    it('marks speaking prompt as completed without affecting other skills', () => {
      useAppStore.getState().markFourSkillsLessonCompleted('speaking', 'speak_test_1');

      const progress = useAppStore.getState().fourSkillsCompletionProgress;
      expect(progress.speaking).toEqual(['speak_test_1']);
      expect(progress.reading).toEqual([]);
      expect(progress.writing).toEqual([]);
    });

    it('marks writing prompt as completed without affecting other skills', () => {
      useAppStore.getState().markFourSkillsLessonCompleted('writing', 'write_test_1');

      const progress = useAppStore.getState().fourSkillsCompletionProgress;
      expect(progress.writing).toEqual(['write_test_1']);
      expect(progress.reading).toEqual([]);
      expect(progress.speaking).toEqual([]);
    });

    it('delegates listening to completedListeningLessonIds seamlessly', () => {
      useAppStore.getState().markFourSkillsLessonCompleted('listening', 'listen_test_1');

      expect(useAppStore.getState().completedListeningLessonIds).toEqual(['listen_test_1']);
      // Four skills completion progress remains unmodified
      expect(useAppStore.getState().fourSkillsCompletionProgress).toEqual({
        reading: [],
        speaking: [],
        writing: [],
      });
    });

    it('handles multiple lessons across all skills independently', () => {
      useAppStore.getState().markFourSkillsLessonCompleted('reading', 'read_1');
      useAppStore.getState().markFourSkillsLessonCompleted('reading', 'read_2');
      useAppStore.getState().markFourSkillsLessonCompleted('speaking', 'speak_1');
      useAppStore.getState().markFourSkillsLessonCompleted('writing', 'write_1');
      useAppStore.getState().markFourSkillsLessonCompleted('listening', 'listen_1');

      const progress = useAppStore.getState().fourSkillsCompletionProgress;
      expect(progress.reading).toEqual(['read_1', 'read_2']);
      expect(progress.speaking).toEqual(['speak_1']);
      expect(progress.writing).toEqual(['write_1']);
      expect(useAppStore.getState().completedListeningLessonIds).toEqual(['listen_1']);
    });
  });

  describe('3. Idempotency & Duplicate Prevention', () => {
    it('does not duplicate ID when marking the same lesson multiple times', () => {
      useAppStore.getState().markFourSkillsLessonCompleted('reading', 'read_idempotent');
      useAppStore.getState().markFourSkillsLessonCompleted('reading', 'read_idempotent');
      useAppStore.getState().markFourSkillsLessonCompleted('reading', 'read_idempotent');

      expect(useAppStore.getState().fourSkillsCompletionProgress.reading).toEqual(['read_idempotent']);
    });

    it('returns the same state reference when an already completed ID is added (idempotent no-op)', () => {
      useAppStore.getState().markFourSkillsLessonCompleted('reading', 'read_same_ref');
      const stateBefore = useAppStore.getState();

      useAppStore.getState().markFourSkillsLessonCompleted('reading', 'read_same_ref');
      const stateAfter = useAppStore.getState();

      expect(stateAfter.fourSkillsCompletionProgress).toBe(stateBefore.fourSkillsCompletionProgress);
    });

    it('does not duplicate ID when lessonId has leading/trailing whitespace matching an existing ID', () => {
      useAppStore.getState().markFourSkillsLessonCompleted('speaking', 'speak_trimmed');
      useAppStore.getState().markFourSkillsLessonCompleted('speaking', '   speak_trimmed   ');

      expect(useAppStore.getState().fourSkillsCompletionProgress.speaking).toEqual(['speak_trimmed']);
    });
  });

  describe('4. Invalid ID & Edge Case Filtering', () => {
    it('ignores empty strings and whitespace-only strings', () => {
      useAppStore.getState().markFourSkillsLessonCompleted('reading', '');
      useAppStore.getState().markFourSkillsLessonCompleted('reading', '   ');
      useAppStore.getState().markFourSkillsLessonCompleted('speaking', '');
      useAppStore.getState().markFourSkillsLessonCompleted('writing', '   ');
      useAppStore.getState().markFourSkillsLessonCompleted('listening', '');

      expect(useAppStore.getState().fourSkillsCompletionProgress).toEqual({
        reading: [],
        speaking: [],
        writing: [],
      });
      expect(useAppStore.getState().completedListeningLessonIds).toEqual([]);
    });

    it('ignores null, undefined, numbers, and object types gracefully', () => {
      useAppStore.getState().markFourSkillsLessonCompleted('reading', (null as unknown) as string);
      useAppStore.getState().markFourSkillsLessonCompleted('speaking', (undefined as unknown) as string);
      useAppStore.getState().markFourSkillsLessonCompleted('writing', (12345 as unknown) as string);
      useAppStore.getState().markFourSkillsLessonCompleted('writing', ({ id: 'invalid' } as unknown) as string);

      expect(useAppStore.getState().fourSkillsCompletionProgress).toEqual({
        reading: [],
        speaking: [],
        writing: [],
      });
    });

    it('trims valid IDs before adding', () => {
      useAppStore.getState().markFourSkillsLessonCompleted('reading', '  read_padded  ');
      expect(useAppStore.getState().fourSkillsCompletionProgress.reading).toEqual(['read_padded']);
    });
  });

  describe('5. Immutability & Deterministic Ordering', () => {
    it('does not mutate the previous array reference when adding an item', () => {
      useAppStore.getState().markFourSkillsLessonCompleted('reading', 'read_first');
      const initialArray = useAppStore.getState().fourSkillsCompletionProgress.reading;

      useAppStore.getState().markFourSkillsLessonCompleted('reading', 'read_second');
      const updatedArray = useAppStore.getState().fourSkillsCompletionProgress.reading;

      expect(initialArray).toEqual(['read_first']);
      expect(updatedArray).toEqual(['read_first', 'read_second']);
      expect(updatedArray).not.toBe(initialArray);
    });

    it('maintains deterministic sequential insertion ordering', () => {
      const ids = ['read_alpha', 'read_beta', 'read_gamma', 'read_delta'];
      ids.forEach((id) => useAppStore.getState().markFourSkillsLessonCompleted('reading', id));

      expect(useAppStore.getState().fourSkillsCompletionProgress.reading).toEqual([
        'read_alpha',
        'read_beta',
        'read_gamma',
        'read_delta',
      ]);
    });
  });

  describe('6. Zero Regression on fourSkillsScores', () => {
    it('marking completion does not mutate or alter fourSkillsScores', () => {
      useAppStore.getState().setFourSkillsScores({
        listening: [80, 85],
        reading: [90],
        speaking: [75],
        writing: [88],
      });

      const scoresBefore = useAppStore.getState().fourSkillsScores;

      useAppStore.getState().markFourSkillsLessonCompleted('reading', 'read_100');
      useAppStore.getState().markFourSkillsLessonCompleted('speaking', 'speak_200');
      useAppStore.getState().markFourSkillsLessonCompleted('writing', 'write_300');
      useAppStore.getState().markFourSkillsLessonCompleted('listening', 'listen_400');

      const scoresAfter = useAppStore.getState().fourSkillsScores;

      expect(scoresAfter).toEqual(scoresBefore);
      expect(scoresAfter.reading).toEqual([90]);
      expect(scoresAfter.speaking).toEqual([75]);
      expect(scoresAfter.writing).toEqual([88]);
      expect(scoresAfter.listening).toEqual([80, 85]);
    });
  });

  describe('7. Validation & Normalization Helpers', () => {
    describe('sanitizeFourSkillsCompletionProgress', () => {
      it('returns empty arrays for null, undefined, or non-object values', () => {
        expect(sanitizeFourSkillsCompletionProgress(null)).toEqual({
          reading: [],
          speaking: [],
          writing: [],
        });
        expect(sanitizeFourSkillsCompletionProgress(undefined)).toEqual({
          reading: [],
          speaking: [],
          writing: [],
        });
        expect(sanitizeFourSkillsCompletionProgress('invalid')).toEqual({
          reading: [],
          speaking: [],
          writing: [],
        });
        expect(sanitizeFourSkillsCompletionProgress(123)).toEqual({
          reading: [],
          speaking: [],
          writing: [],
        });
      });

      it('sanitizes nested arrays, trims, dedupes, and filters invalid elements', () => {
        const corrupted = {
          reading: ['  read_1 ', '', null, 'read_2', 'read_1', 456],
          speaking: 'not-an-array',
          writing: ['write_1', '  ', 'write_2'],
        };

        const result = sanitizeFourSkillsCompletionProgress(corrupted);
        expect(result).toEqual({
          reading: ['read_1', 'read_2'],
          speaking: [],
          writing: ['write_1', 'write_2'],
        });
      });

      it('is non-destructive to historical IDs that might not be in the current static dataset', () => {
        const historicalPayload = {
          reading: ['legacy_archived_read_99', 'old_v1_lesson_42'],
          speaking: ['deprecated_prompt_x'],
          writing: ['custom_removed_prompt_z'],
        };

        const result = sanitizeFourSkillsCompletionProgress(historicalPayload);
        expect(result).toEqual(historicalPayload);
      });
    });

    describe('mergeCompletionProgressIds', () => {
      it('merges two arrays with deduplication and preserves deterministic base order', () => {
        const base = ['item_1', 'item_2'];
        const incoming = ['item_2', 'item_3', 'item_4'];

        const result = mergeCompletionProgressIds(base, incoming);
        expect(result).toEqual(['item_1', 'item_2', 'item_3', 'item_4']);
      });

      it('handles undefined or null gracefully', () => {
        expect(mergeCompletionProgressIds(undefined, ['item_1'])).toEqual(['item_1']);
        expect(mergeCompletionProgressIds(['item_1'], undefined)).toEqual(['item_1']);
        expect(mergeCompletionProgressIds(undefined, undefined)).toEqual([]);
      });

      it('does not mutate input arrays', () => {
        const base = ['a', 'b'];
        const incoming = ['b', 'c'];
        const baseCopy = [...base];
        const incomingCopy = [...incoming];

        mergeCompletionProgressIds(base, incoming);

        expect(base).toEqual(baseCopy);
        expect(incoming).toEqual(incomingCopy);
      });
    });

    describe('mergeFourSkillsCompletionProgress', () => {
      it('unions all skills monotonically and returns complete structure', () => {
        const local: FourSkillsCompletionProgress = {
          reading: ['read_local_1'],
          speaking: ['speak_shared'],
          writing: [],
        };
        const remote: Partial<FourSkillsCompletionProgress> = {
          reading: ['read_local_1', 'read_remote_2'],
          speaking: ['speak_shared', 'speak_remote_1'],
          writing: ['write_remote_1'],
        };

        const result = mergeFourSkillsCompletionProgress(local, remote);
        expect(result).toEqual({
          reading: ['read_local_1', 'read_remote_2'],
          speaking: ['speak_shared', 'speak_remote_1'],
          writing: ['write_remote_1'],
        });
      });

      it('handles empty or partial inputs safely', () => {
        expect(mergeFourSkillsCompletionProgress(null, null)).toEqual({
          reading: [],
          speaking: [],
          writing: [],
        });
        expect(mergeFourSkillsCompletionProgress({ reading: ['read_1'] }, {})).toEqual({
          reading: ['read_1'],
          speaking: [],
          writing: [],
        });
      });
    });
  });

  describe('8. setFourSkillsCompletionProgress Action', () => {
    it('sets partial progress and sanitizes inputs', () => {
      useAppStore.getState().setFourSkillsCompletionProgress({
        reading: ['  read_clean  ', 'read_clean', ''],
      });

      expect(useAppStore.getState().fourSkillsCompletionProgress.reading).toEqual(['read_clean']);
      expect(useAppStore.getState().fourSkillsCompletionProgress.speaking).toEqual([]);
      expect(useAppStore.getState().fourSkillsCompletionProgress.writing).toEqual([]);
    });

    it('preserves untouched skills when updating partial skills', () => {
      useAppStore.getState().markFourSkillsLessonCompleted('speaking', 'speak_preserve');

      useAppStore.getState().setFourSkillsCompletionProgress({
        reading: ['read_new'],
      });

      const progress = useAppStore.getState().fourSkillsCompletionProgress;
      expect(progress.reading).toEqual(['read_new']);
      expect(progress.speaking).toEqual(['speak_preserve']);
    });
  });
});
