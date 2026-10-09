// src/services/__tests__/checkpointAssessmentService.test.ts
import { describe, it, expect } from 'vitest';
import {
  CHECKPOINT_DEFINITIONS,
  resolveCheckpointAssessment,
  validateCheckpointIntegrity,
  validateAllCheckpointsIntegrity,
  getIndexedListeningLesson,
  getIndexedReadingLesson,
  getIndexedSpeakingPrompt,
  getIndexedWritingPrompt,
  AssessmentIntegrityError,
} from '../checkpointAssessmentService';
import type { CefrLevel } from '../../types/levelCertification';
import { CEFR_LEVELS_ORDER } from '../../types/levelCertification';
import type { CheckpointDefinition } from '../../types/checkpointAssessment';

describe('Checkpoint Assessment Service (Phase 3)', () => {
  const ALL_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  // =========================================================================
  // 1. ALL CEFR BANDS RESOLVE SUCCESSFULLY
  // =========================================================================
  describe('All CEFR Bands Resolution (A1 -> C2)', () => {
    it.each(ALL_LEVELS)('successfully resolves full checkpoint assessment for level %s', (level) => {
      const resolved = resolveCheckpointAssessment(level);

      expect(resolved).toBeDefined();
      expect(resolved.level).toBe(level);
      expect(resolved.definition.level).toBe(level);
      expect(resolved.definition.checkpointId).toBe(`checkpoint_${level.toLowerCase()}`);
      expect(resolved.totalQuestions).toBeGreaterThan(0);
      expect(resolved.allQuestionIds.length).toBe(resolved.totalQuestions);
    });

    it('passes integrity validation across all 6 canonical checkpoints without issues', () => {
      const allResults = validateAllCheckpointsIntegrity();

      for (const level of ALL_LEVELS) {
        const res = allResults[level];
        expect(res).toBeDefined();
        expect(res.level).toBe(level);
        if (!res.isValid) {
          console.error(`Validation failed for ${level}:`, res.issues);
        }
        expect(res.isValid).toBe(true);
        expect(res.issues).toHaveLength(0);
      }
    });
  });

  // =========================================================================
  // 2. COMPLETE 4-SKILL COVERAGE
  // =========================================================================
  describe('4 Skills Complete Coverage', () => {
    it.each(ALL_LEVELS)('ensures all 4 skills are non-empty and resolved for level %s', (level) => {
      const resolved = resolveCheckpointAssessment(level);

      // 1. Listening Section
      const lis = resolved.sections.listening;
      expect(lis).toBeDefined();
      expect(lis.lesson).toBeDefined();
      expect(lis.questions.length).toBeGreaterThanOrEqual(3);
      expect(lis.lesson.audioText.trim().length).toBeGreaterThan(0);

      // 2. Reading Section
      const read = resolved.sections.reading;
      expect(read).toBeDefined();
      expect(read.lesson).toBeDefined();
      expect(read.questions.length).toBeGreaterThanOrEqual(3);
      expect(read.lesson.content.length).toBeGreaterThan(0);

      // 3. Speaking Section
      const spk = resolved.sections.speaking;
      expect(spk).toBeDefined();
      expect(spk.prompt).toBeDefined();
      expect(spk.turns.length).toBeGreaterThanOrEqual(2);
      expect(spk.turns[0].targetSentence.trim().length).toBeGreaterThan(0);

      // 4. Writing Section
      const wri = resolved.sections.writing;
      expect(wri).toBeDefined();
      expect(wri.prompt).toBeDefined();
      expect(wri.definition.minWords).toBeGreaterThan(0);
      expect(wri.prompt.prompt.trim().length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 3. UNIQUE QUESTION IDS
  // =========================================================================
  describe('Unique Question & Item IDs', () => {
    it.each(ALL_LEVELS)('guarantees strictly unique item IDs across the checkpoint for level %s', (level) => {
      const resolved = resolveCheckpointAssessment(level);
      const seenIds = new Set<string>();

      // Check listening question IDs
      for (const q of resolved.sections.listening.questions) {
        expect(seenIds.has(q.id)).toBe(false);
        seenIds.add(q.id);
      }

      // Check reading question IDs
      for (const q of resolved.sections.reading.questions) {
        expect(seenIds.has(q.id)).toBe(false);
        seenIds.add(q.id);
      }

      expect(seenIds.size).toBe(resolved.totalQuestions);
    });
  });

  // =========================================================================
  // 4. VALID CEFR LEVEL MAPPING
  // =========================================================================
  describe('Valid CEFR Level Mapping', () => {
    it.each(ALL_LEVELS)('ensures all referenced items match the target CEFR level %s', (level) => {
      const resolved = resolveCheckpointAssessment(level);

      expect(resolved.sections.listening.lesson.level).toBe(level);
      expect(resolved.sections.reading.lesson.level).toBe(level);
      expect(resolved.sections.speaking.prompt.level).toBe(level);
      expect(resolved.sections.writing.prompt.level).toBe(level);
    });
  });

  // =========================================================================
  // 5. ASSESSMENT-MODE RESTRICTIONS POLICY
  // =========================================================================
  describe('Assessment-Mode Restrictions Policy', () => {
    it.each(ALL_LEVELS)('enforces strict assessment restrictions for level %s', (level) => {
      const def = CHECKPOINT_DEFINITIONS[level];
      const policy = def.policy;

      expect(policy.allowHints).toBe(false);
      expect(policy.allowAnswerReveal).toBe(false);
      expect(policy.allowInSessionRetry).toBe(false);
      expect(policy.allowDictionaryLookup).toBe(false);
      expect(policy.allowTranscript).toBe(false);
      expect(policy.requireFirstSubmission).toBe(true);
      expect(policy.maxAudioPlays).toBeGreaterThanOrEqual(1);
      expect(policy.timeLimitMinutes).toBeGreaterThanOrEqual(30);
    });

    it('enforces strict single-audio-play for C2 Proficiency', () => {
      const c2 = CHECKPOINT_DEFINITIONS.C2;
      expect(c2.policy.maxAudioPlays).toBe(1);
      expect(c2.sections.listening.maxAudioPlays).toBe(1);
    });
  });

  // =========================================================================
  // 6. MALFORMED REFERENCE & INTEGRITY REJECTION (FAIL-SAFE)
  // =========================================================================
  describe('Integrity Rejection & Fail-Safe Behavior', () => {
    it('rejects checkpoint when referenced lesson does not exist in dataset', () => {
      const malformedDef: CheckpointDefinition = {
        ...CHECKPOINT_DEFINITIONS.A1,
        sections: {
          ...CHECKPOINT_DEFINITIONS.A1.sections,
          listening: {
            ...CHECKPOINT_DEFINITIONS.A1.sections.listening,
            sourceLessonId: 'listen_non_existent_99999',
          },
        },
      };

      const validation = validateCheckpointIntegrity(malformedDef);
      expect(validation.isValid).toBe(false);
      expect(validation.issues.some((i) => i.code === 'MISSING_LESSON_REFERENCE')).toBe(true);
    });

    it('rejects checkpoint when referenced lesson has mismatched CEFR level', () => {
      const mismatchedDef: CheckpointDefinition = {
        ...CHECKPOINT_DEFINITIONS.A1,
        sections: {
          ...CHECKPOINT_DEFINITIONS.A1.sections,
          listening: {
            ...CHECKPOINT_DEFINITIONS.A1.sections.listening,
            sourceLessonId: 'listen_c2_1', // Referencing C2 in A1 checkpoint
          },
        },
      };

      const validation = validateCheckpointIntegrity(mismatchedDef);
      expect(validation.isValid).toBe(false);
      expect(validation.issues.some((i) => i.code === 'CEFR_LEVEL_MISMATCH')).toBe(true);
    });

    it('throws AssessmentIntegrityError instead of faking questions when resolving invalid level', () => {
      expect(() => {
        resolveCheckpointAssessment('INVALID_LEVEL' as any);
      }).toThrowError(AssessmentIntegrityError);
    });
  });

  // =========================================================================
  // 7. DETERMINISTIC RESOLUTION & STATIC INDEX LOOKUP
  // =========================================================================
  describe('Deterministic Resolution & O(1) Index Lookup', () => {
    it('deterministically returns identical question set and contents across multiple calls', () => {
      const call1 = resolveCheckpointAssessment('B1');
      const call2 = resolveCheckpointAssessment('B1');

      expect(call1.totalQuestions).toBe(call2.totalQuestions);
      expect(call1.allQuestionIds).toEqual(call2.allQuestionIds);
      expect(call1.sections.listening.lesson.id).toBe(call2.sections.listening.lesson.id);
      expect(call1.sections.reading.lesson.id).toBe(call2.sections.reading.lesson.id);
    });

    it('resolves items in O(1) time via static indexes without scanning full arrays', () => {
      const lesson = getIndexedListeningLesson('listen_a1_1');
      expect(lesson).toBeDefined();
      expect(lesson?.id).toBe('listen_a1_1');

      const reading = getIndexedReadingLesson('read_a1_1');
      expect(reading).toBeDefined();
      expect(reading?.id).toBe('read_a1_1');

      const speaking = getIndexedSpeakingPrompt('sp_a1_1');
      expect(speaking).toBeDefined();
      expect(speaking?.id).toBe('sp_a1_1');

      const writing = getIndexedWritingPrompt('wp_a1_1');
      expect(writing).toBeDefined();
      expect(writing?.id).toBe('wp_a1_1');

      expect(getIndexedListeningLesson('non_existent')).toBeUndefined();
    });
  });
});
