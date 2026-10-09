// src/services/__tests__/checkpointSessionLifecycle.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCheckpointAttemptId,
  parseCheckpointAttemptId,
  createInitialCheckpointState,
  startCheckpointSession,
  saveSectionDraft,
  advanceToNextSection,
  finalizeCheckpointAttempt,
  isAttemptFinalized,
  resetFinalizedAttempts,
  checkpointStateToResumableActivity,
  restoreCheckpointStateFromActivity,
  findResumableCheckpointForLevel,
  buildCheckpointProgressMetric,
  buildCheckpointStagePipelineMetric,
} from '../checkpointSessionLifecycle';
import { validateResumeActivity } from '../learningContinuityService';
import type { CheckpointResumableActivity } from '../../types/learningContinuity';

describe('CEFR Checkpoint Session Lifecycle Engine (Phase 4)', () => {
  beforeEach(() => {
    resetFinalizedAttempts();
  });

  describe('1. Attempt Identity & Parsing', () => {
    it('creates stable unique attempt IDs with pattern cefr:<level>:chk_<timestamp>_<entropy>', () => {
      const id1 = createCheckpointAttemptId('B1', 1712345678000, 'x7k9');
      expect(id1).toBe('cefr:B1:chk_1712345678000_x7k9');

      const id2 = createCheckpointAttemptId('A2', 1712345678000);
      expect(id2).toMatch(/^cefr:A2:chk_1712345678000_[a-z0-9]+$/);
    });

    it('generates distinct IDs on successive calls without collision', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 50; i++) {
        ids.add(createCheckpointAttemptId('B2'));
      }
      expect(ids.size).toBe(50);
    });

    it('parses valid checkpoint attempt ID correctly', () => {
      const parsed = parseCheckpointAttemptId('cefr:B2:chk_1712345678000_abc123');
      expect(parsed).not.toBeNull();
      expect(parsed?.level).toBe('B2');
      expect(parsed?.timestamp).toBe(1712345678000);
    });

    it('rejects invalid or malformed attempt IDs gracefully', () => {
      expect(parseCheckpointAttemptId('')).toBeNull();
      expect(parseCheckpointAttemptId('invalid:id')).toBeNull();
      expect(parseCheckpointAttemptId('cefr:INVALID:chk_1712345678000_abc')).toBeNull();
      expect(parseCheckpointAttemptId('toeic:mini:chk_12345_abc')).toBeNull();
      expect(parseCheckpointAttemptId('cefr:A1:not_chk_12345_abc')).toBeNull();
      expect(parseCheckpointAttemptId('cefr:A1:chk_nan_abc')).toBeNull();
    });
  });

  describe('2. Pure Lifecycle State Transitions', () => {
    it('initializes clean state for a new checkpoint attempt', () => {
      const state = createInitialCheckpointState('A2', 1000);
      expect(state.level).toBe('A2');
      expect(state.stage).toBe('intro');
      expect(state.currentSection).toBe('listening');
      expect(state.completedSections).toEqual([]);
      expect(state.answers.listening).toEqual({});
      expect(state.answers.reading).toEqual({});
      expect(state.answers.speaking).toEqual({});
      expect(state.answers.writing).toBe('');
      expect(state.startedAt).toBe(1000);
      expect(state.lastActiveAt).toBe(1000);
    });

    it('starts checkpoint session transitioning from intro to listening', () => {
      const initial = createInitialCheckpointState('B1', 1000);
      const started = startCheckpointSession(initial, 2000);
      expect(started.stage).toBe('listening');
      expect(started.currentSection).toBe('listening');
      expect(started.lastActiveAt).toBe(2000);
    });

    it('saves section draft answers safely without touching unedited sections', () => {
      const initial = createInitialCheckpointState('A1', 1000);
      const withListen = saveSectionDraft(initial, { listening: { 'q1': 2 } }, 1500);
      expect(withListen.answers.listening).toEqual({ 'q1': 2 });
      expect(withListen.answers.reading).toEqual({});
      expect(withListen.lastActiveAt).toBe(1500);

      const withRead = saveSectionDraft(withListen, { reading: { 'rq1': 0 } }, 2000);
      expect(withRead.answers.listening).toEqual({ 'q1': 2 });
      expect(withRead.answers.reading).toEqual({ 'rq1': 0 });
    });

    it('advances sections in exact sequence: listening -> reading -> speaking -> writing -> evaluation', () => {
      let state = createInitialCheckpointState('A2', 1000);
      state = startCheckpointSession(state, 1100);
      expect(state.stage).toBe('listening');

      // 1. Complete listening
      state = advanceToNextSection(state, 85, 1200);
      expect(state.stage).toBe('reading');
      expect(state.currentSection).toBe('reading');
      expect(state.completedSections).toEqual(['listening']);
      expect(state.sectionScores.listening).toBe(85);

      // 2. Complete reading
      state = advanceToNextSection(state, 90, 1300);
      expect(state.stage).toBe('speaking');
      expect(state.currentSection).toBe('speaking');
      expect(state.completedSections).toEqual(['listening', 'reading']);
      expect(state.sectionScores.reading).toBe(90);

      // 3. Complete speaking
      state = advanceToNextSection(state, 75, 1400);
      expect(state.stage).toBe('writing');
      expect(state.currentSection).toBe('writing');
      expect(state.completedSections).toEqual(['listening', 'reading', 'speaking']);
      expect(state.sectionScores.speaking).toBe(75);

      // 4. Complete writing -> transitions to evaluation!
      state = advanceToNextSection(state, 80, 1500);
      expect(state.stage).toBe('evaluation');
      expect(state.completedSections).toEqual(['listening', 'reading', 'speaking', 'writing']);
      expect(state.sectionScores.writing).toBe(80);
    });
  });

  describe('3. Finalize & Idempotency Guard', () => {
    it('finalizes a passing attempt, generating official certificate and result stage', () => {
      let state = createInitialCheckpointState('A1', 1000);
      state = startCheckpointSession(state);
      state = advanceToNextSection(state, 85); // listening
      state = advanceToNextSection(state, 85); // reading
      state = advanceToNextSection(state, 80); // speaking
      state = advanceToNextSection(state, 80); // writing

      const result = finalizeCheckpointAttempt(state, undefined, 2000);
      expect(result.success).toBe(true);
      expect(result.alreadyFinalized).toBe(false);
      expect(result.evaluation.isPassed).toBe(true);
      expect(result.certificate).toBeDefined();
      expect(result.certificate?.level).toBe('A1');
      expect(result.certificate?.certificateId).toBeDefined();
      expect(result.state.stage).toBe('result');
      expect(isAttemptFinalized(state.attemptId)).toBe(true);
    });

    it('enforces floor requirement: fails attempt if one skill is below floor threshold', () => {
      let state = createInitialCheckpointState('A2', 1000);
      state = startCheckpointSession(state);
      // In A2: overallPassThreshold = 70, perSkillFloorThreshold = 55
      state = advanceToNextSection(state, 95); // listening (high)
      state = advanceToNextSection(state, 95); // reading (high)
      state = advanceToNextSection(state, 40); // speaking (below floor 55!)
      state = advanceToNextSection(state, 90); // writing (high)

      const result = finalizeCheckpointAttempt(state);
      expect(result.evaluation.isPassed).toBe(false);
      expect(result.certificate).toBeUndefined();
      if (!result.evaluation.isPassed) {
        expect(result.evaluation.failingReasons.length).toBeGreaterThan(0);
        expect(result.evaluation.failingReasons[0]).toContain('Nói');
        expect(result.evaluation.skillResults.speaking.passedFloor).toBe(false);
      }
    });

    it('guards against duplicate finalization (double-click / repeat callback idempotency)', () => {
      let state = createInitialCheckpointState('B1', 1000);
      state = startCheckpointSession(state);
      state = advanceToNextSection(state, 80);
      state = advanceToNextSection(state, 80);
      state = advanceToNextSection(state, 80);
      state = advanceToNextSection(state, 80);

      // First finalization
      const firstResult = finalizeCheckpointAttempt(state, undefined, 2000);
      expect(firstResult.alreadyFinalized).toBe(false);
      expect(firstResult.evaluation.isPassed).toBe(true);

      // Second finalization call on same attemptId (simulating rapid double-click)
      const secondResult = finalizeCheckpointAttempt(state, undefined, 2100);
      expect(secondResult.success).toBe(true);
      expect(secondResult.alreadyFinalized).toBe(true);
      expect(secondResult.evaluation).toEqual(firstResult.evaluation);
    });
  });

  describe('4. Continuity, Resume & "Completed Always Wins"', () => {
    it('converts in-progress state to a valid CheckpointResumableActivity', () => {
      let state = createInitialCheckpointState('A2', 1000);
      state = startCheckpointSession(state);
      state = saveSectionDraft(state, { listening: { 'q1': 1 } });
      state = advanceToNextSection(state, 85); // now at reading

      const resumable = checkpointStateToResumableActivity(state, 'CEFR A2 Exam', 1500);
      expect(resumable.type).toBe('checkpoint');
      expect(resumable.id).toBe(state.attemptId);
      expect(resumable.completed).toBe(false);
      expect(resumable.checkpoint.currentSection).toBe('reading');
      expect(resumable.checkpoint.completedSections).toEqual(['listening']);
      expect(resumable.checkpoint.listeningAnswers).toEqual({ 'q1': 1 });

      // Validates through learningContinuityService schema validator
      const validated = validateResumeActivity(resumable);
      expect(validated).not.toBeNull();
      expect(validated?.type).toBe('checkpoint');
    });

    it('restores in-progress state faithfully from CheckpointResumableActivity', () => {
      let state = createInitialCheckpointState('B1', 1000);
      state = startCheckpointSession(state);
      state = saveSectionDraft(state, {
        listening: { 'l_1': 2 },
        reading: { 'r_1': 0 },
      });
      state = advanceToNextSection(state, 80); // listening completed
      state = advanceToNextSection(state, 85); // reading completed, now at speaking

      const resumable = checkpointStateToResumableActivity(state, 'B1 Checkpoint', 1600);
      const restored = restoreCheckpointStateFromActivity(resumable, 1700);

      expect(restored).not.toBeNull();
      expect(restored?.attemptId).toBe(state.attemptId);
      expect(restored?.level).toBe('B1');
      expect(restored?.currentSection).toBe('speaking');
      expect(restored?.stage).toBe('speaking');
      expect(restored?.completedSections).toEqual(['listening', 'reading']);
      expect(restored?.answers.listening).toEqual({ 'l_1': 2 });
      expect(restored?.answers.reading).toEqual({ 'r_1': 0 });
    });

    it('enforces "Completed Always Wins": finalized attempt cannot be resumed', () => {
      let state = createInitialCheckpointState('C1', 1000);
      state = startCheckpointSession(state);
      state = advanceToNextSection(state, 85);
      state = advanceToNextSection(state, 85);
      state = advanceToNextSection(state, 85);
      state = advanceToNextSection(state, 85);

      const finalResult = finalizeCheckpointAttempt(state, undefined, 2000);
      expect(finalResult.evaluation.isPassed).toBe(true);

      const completedResumable = checkpointStateToResumableActivity(finalResult.state, 'C1 Checkpoint', 2000);
      expect(completedResumable.completed).toBe(true);

      // Attempting to restore a completed activity returns null
      const restored = restoreCheckpointStateFromActivity(completedResumable);
      expect(restored).toBeNull();
    });

    it('rejects stale checkpoint activities (> 24 hours)', () => {
      const now = 2000000000;
      const staleTime = now - (25 * 60 * 60 * 1000); // 25 hours ago

      const state = createInitialCheckpointState('A1', staleTime);
      const resumable = checkpointStateToResumableActivity(state, 'Old Checkpoint', staleTime);

      const restored = restoreCheckpointStateFromActivity(resumable, now);
      expect(restored).toBeNull();
    });

    it('finds active resumable checkpoint for a specific level', () => {
      const stateA1 = createInitialCheckpointState('A1', 1000);
      const stateB1 = createInitialCheckpointState('B1', 1000);

      const actA1 = checkpointStateToResumableActivity(stateA1);
      const actB1 = checkpointStateToResumableActivity(stateB1);

      const storeMap: Record<string, any> = {
        [actA1.id]: actA1,
        [actB1.id]: actB1,
      };

      const foundB1 = findResumableCheckpointForLevel(storeMap, 'B1');
      expect(foundB1).not.toBeNull();
      expect(foundB1?.checkpoint.level).toBe('B1');

      const foundC1 = findResumableCheckpointForLevel(storeMap, 'C1');
      expect(foundC1).toBeNull();
    });
  });

  describe('5. Error Handling & Backward Compatibility', () => {
    it('handles null, undefined, or old user without resume activities gracefully', () => {
      expect(findResumableCheckpointForLevel(undefined, 'A1')).toBeNull();
      expect(findResumableCheckpointForLevel({}, 'A1')).toBeNull();
      expect(restoreCheckpointStateFromActivity(null)).toBeNull();
      expect(restoreCheckpointStateFromActivity(undefined)).toBeNull();
    });

    it('rejects corrupted or malformed checkpoint activities safely', () => {
      const corruptActivity = {
        id: 'corrupt_1',
        type: 'checkpoint',
        title: 'Corrupted Checkpoint',
        startedAt: 1000,
        lastActiveAt: 1000,
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          attemptId: '',
          level: 'INVALID_LEVEL',
          currentSection: 'invalid_skill',
        },
      } as unknown as CheckpointResumableActivity;

      expect(validateResumeActivity(corruptActivity)).toBeNull();
      expect(restoreCheckpointStateFromActivity(corruptActivity)).toBeNull();
    });
  });

  describe('6. Truthful Progress Metrics', () => {
    it('derives truthful discrete metric (e.g. 2 / 4 sections completed)', () => {
      let state = createInitialCheckpointState('B2');
      state = advanceToNextSection(state, 80); // 1 completed
      state = advanceToNextSection(state, 85); // 2 completed

      const metric = buildCheckpointProgressMetric(state);
      expect(metric.kind).toBe('discrete_items');
      if (metric.kind === 'discrete_items') {
        expect(metric.answeredCount).toBe(2);
        expect(metric.totalItems).toBe(4);
        expect(metric.remainingCount).toBe(2);
        expect(metric.counterFormat).toBe('answered');
        expect(metric.progressPercent).toBe(50);
      }
    });

    it('derives stage pipeline metric correctly', () => {
      let state = createInitialCheckpointState('A2');
      state = advanceToNextSection(state, 80); // now at reading

      const pipeline = buildCheckpointStagePipelineMetric(state);
      expect(pipeline.kind).toBe('stage_pipeline');
      if (pipeline.kind === 'stage_pipeline') {
        expect(pipeline.currentStageId).toBe('reading');
        expect(pipeline.stages.length).toBe(4);
        expect(pipeline.progressPercent).toBe(25);
      }
    });
  });
});
