// src/services/__tests__/checkpointReinforcementLoop.test.ts
/**
 * CEFR Checkpoint Reinforcement Loop Test Suite (Phase 10)
 *
 * Verifies:
 * 1. Needs Reinforcement: Actionable routes, weak skills, and explanations derived on failure.
 * 2. Next Best Action: Priority 1 routing to weak skills without disrupting other flows.
 * 3. Today Learning Plan: Derives checkpoint reinforcement & readiness tasks with SSOT completion.
 * 4. Personalized Insights: Authentic checkpoint evidence generates strong, explainable insight without mutation.
 * 5. Full Reinforcement Flow: checkpoint -> fail Speaking -> recommendation -> practice -> new evidence -> retake pass.
 *
 * Strict Constraints:
 * - Zero auto-completed lessons without actual user action.
 * - Zero mutated fake competency.
 * - Zero fake SRS scheduling.
 * - Zero full repository test runs.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CENTRAL_CERTIFICATION_POLICY,
  evaluateCheckpointCertification,
  createCheckpointHistoryEntry,
  appendCheckpointHistory,
  preserveHighestCertificationOnRetake,
  canRetakeCheckpointLevel,
  deriveCheckpointReinforcementRoutes,
} from '../levelCertificationService';
import {
  resolveNextBestActions,
  type SessionCompletionContext,
  type NextActionDispatchContext,
} from '../nextActionResolver';
import {
  generateTodayLearningPlan,
  type TodayLearningPlanInput,
} from '../todayLearningPlanService';
import {
  derivePersonalizedInsightsSummary,
  deriveCheckpointCertificationInsights,
} from '../personalizedInsightService';
import type {
  CheckpointHistoryEntry,
  LevelCertificationStore,
  CertificationEvaluationFailed,
} from '../../types/levelCertification';
import type { FourSkillsEvidenceStore, CompetencyEvidence } from '../../types/competencyEvidence';

describe('CEFR Checkpoint Reinforcement Loop (Phase 10)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. ACTIONABLE REINFORCEMENT ROUTE DERIVATION
  // =========================================================================
  describe('1. Actionable Reinforcement Route Derivation', () => {
    it('derives weak skill routes with concrete details when evaluation fails floor threshold', () => {
      // Level A2: overallPassThreshold = 70, perSkillFloorThreshold = 55
      const evalResult = evaluateCheckpointCertification({
        level: 'A2',
        skillScores: {
          listening: 85,
          reading: 85,
          writing: 80,
          speaking: 45, // Strictly below floor 55!
        },
        attemptId: 'cefr:A2:chk_reinforce_test_1',
      });

      expect(evalResult.isPassed).toBe(false);
      expect(evalResult.result).toBe('needs_reinforcement');

      const failed = evalResult as CertificationEvaluationFailed;
      expect(failed.reinforcementRoutes).toBeDefined();
      expect(failed.reinforcementRoutes?.length).toBeGreaterThan(0);

      const speakingRoute = failed.reinforcementRoutes?.find((r) => r.skill === 'speaking');
      expect(speakingRoute).toBeDefined();
      expect(speakingRoute?.level).toBe('A2');
      expect(speakingRoute?.routeTab).toBe('four_skills');
      expect(speakingRoute?.activeSkill).toBe('speaking');
      expect(speakingRoute?.currentScore).toBe(45);
      expect(speakingRoute?.requiredFloor).toBe(55);
      expect(speakingRoute?.title).toContain('Nói');
      expect(speakingRoute?.title).toContain('A2');
      expect(speakingRoute?.reason).toContain('45%');
      expect(speakingRoute?.sampleLessonOrPromptId).toBeDefined();
    });

    it('sorts multiple weak skills with the lowest scoring skill first', () => {
      // Level B1: overallPassThreshold = 75, perSkillFloorThreshold = 60
      const evalResult = evaluateCheckpointCertification({
        level: 'B1',
        skillScores: {
          listening: 80,
          reading: 80,
          speaking: 40, // Weakest (40 < 60)
          writing: 50,  // Second weak (50 < 60)
        },
        attemptId: 'cefr:B1:chk_multiple_weak',
      });

      expect(evalResult.isPassed).toBe(false);
      const failed = evalResult as CertificationEvaluationFailed;
      const routes = failed.reinforcementRoutes || [];

      expect(routes.length).toBe(2);
      expect(routes[0].skill).toBe('speaking');
      expect(routes[0].currentScore).toBe(40);
      expect(routes[1].skill).toBe('writing');
      expect(routes[1].currentScore).toBe(50);
    });
  });

  // =========================================================================
  // 2. NEXT BEST ACTION INTEGRATION
  // =========================================================================
  describe('2. Next Best Action Integration', () => {
    it('routes failed checkpoint session to Priority 1 weak skill practice', () => {
      const evalResult = evaluateCheckpointCertification({
        level: 'A2',
        skillScores: {
          listening: 80,
          reading: 85,
          writing: 75,
          speaking: 48, // Below floor 55
        },
        attemptId: 'cefr:A2:chk_nba_fail',
      });

      const navigateToTab = vi.fn();
      const setActiveFourSkill = vi.fn();
      const startAdaptivePractice = vi.fn();

      const dispatchContext: NextActionDispatchContext = {
        navigateToTab,
        setActiveFourSkill,
        startAdaptivePractice,
      };

      const completionContext: SessionCompletionContext = {
        flowType: 'checkpoint',
        checkpoint: {
          attemptId: 'cefr:A2:chk_nba_fail',
          level: 'A2',
          evaluation: evalResult,
        },
      };

      const resolved = resolveNextBestActions(completionContext, dispatchContext);

      expect(resolved.resolvedPriority).toBe(1);
      expect(resolved.primaryAction.id).toBe('next-action-reinforce-speaking');
      expect(resolved.primaryAction.label).toContain('Nói');
      expect(resolved.primaryAction.label).toContain('A2');
      expect(resolved.rationale).toContain('Nói');
      expect(resolved.rationale).toContain('48%');

      // Execute primary action
      resolved.primaryAction.onClick();
      expect(setActiveFourSkill).toHaveBeenCalledWith('speaking');
      expect(navigateToTab).toHaveBeenCalledWith('four_skills');
    });

    it('routes passed checkpoint session to Priority 2 certificate recognition', () => {
      const evalResult = evaluateCheckpointCertification({
        level: 'B1',
        skillScores: {
          listening: 85,
          reading: 85,
          writing: 85,
          speaking: 85,
        },
        attemptId: 'cefr:B1:chk_nba_pass',
      });

      const navigateToTab = vi.fn();
      const dispatchContext: NextActionDispatchContext = {
        navigateToTab,
      };

      const completionContext: SessionCompletionContext = {
        flowType: 'checkpoint',
        checkpoint: {
          attemptId: 'cefr:B1:chk_nba_pass',
          level: 'B1',
          evaluation: evalResult,
        },
      };

      const resolved = resolveNextBestActions(completionContext, dispatchContext);

      expect(resolved.resolvedPriority).toBe(2);
      expect(resolved.primaryAction.id).toBe('next-action-checkpoint-certified');
      expect(resolved.rationale).toContain('chứng chỉ CEFR B1');

      resolved.primaryAction.onClick();
      expect(navigateToTab).toHaveBeenCalledWith('four_skills');
    });

    it('does not alter existing priority hierarchy for non-checkpoint sessions', () => {
      const dispatchContext: NextActionDispatchContext = {
        navigateToTab: vi.fn(),
      };

      const readingCompletion: SessionCompletionContext = {
        flowType: 'reading',
        reading: {
          lessonId: 'read_1',
          incorrectQuestionCount: 2,
        },
      };

      const resolved = resolveNextBestActions(readingCompletion, dispatchContext);
      expect(resolved.resolvedPriority).toBe(1);
      expect(resolved.primaryAction.id).toBe('next-action-weakness-reading-mistakes');
    });
  });

  // =========================================================================
  // 3. TODAY LEARNING PLAN INTEGRATION
  // =========================================================================
  describe('3. Today Learning Plan Integration', () => {
    it('derives checkpoint reinforcement task when recent attempt failed', () => {
      const failedAttempt: CheckpointHistoryEntry = {
        attemptId: 'cefr:A2:chk_plan_fail',
        level: 'A2',
        date: 1000000,
        result: 'needs_reinforcement',
        isPassed: false,
        overallScore: 72,
        scores: { listening: 85, reading: 85, writing: 80, speaking: 40 }, // Speaking failed
        policyVersion: '2026.1',
        schemaVersion: 1,
      };

      const plan = generateTodayLearningPlan({
        checkpointHistory: [failedAttempt],
        levelCertifications: {},
        fourSkillsEvidence: { listening: [], reading: [], speaking: [], writing: [] },
      });

      const reinforcementTask = plan.items.find((item) => item.type === 'checkpoint_reinforcement');
      expect(reinforcementTask).toBeDefined();
      expect(reinforcementTask?.title).toContain('Củng cố Nói A2');
      expect(reinforcementTask?.tier).toBe('essential');
      expect(reinforcementTask?.action.tab).toBe('four_skills');
      expect(reinforcementTask?.action.subTab).toBe('speaking');
      expect(reinforcementTask?.completed).toBe(false); // Not completed yet
    });

    it('derives completed=true for reinforcement task purely from SSOT evidence or retake pass', () => {
      const failedAttemptTime = 1000000;
      const failedAttempt: CheckpointHistoryEntry = {
        attemptId: 'cefr:A2:chk_plan_fail_2',
        level: 'A2',
        date: failedAttemptTime,
        result: 'needs_reinforcement',
        isPassed: false,
        overallScore: 72,
        scores: { listening: 85, reading: 85, writing: 80, speaking: 40 },
        policyVersion: '2026.1',
        schemaVersion: 1,
      };

      // Case A: New authentic speaking evidence exists after attempt date
      const evidenceStore: FourSkillsEvidenceStore = {
        listening: [],
        reading: [],
        speaking: [
          {
            id: 'sp_ev_new',
            skill: 'speaking',
            score: 80,
            source: 'four-skills',
            createdAt: failedAttemptTime + 50000, // AFTER failed attempt!
          },
        ],
        writing: [],
      };

      const planWithEvidence = generateTodayLearningPlan({
        checkpointHistory: [failedAttempt],
        levelCertifications: {},
        fourSkillsEvidence: evidenceStore,
      });

      const taskA = planWithEvidence.items.find((item) => item.type === 'checkpoint_reinforcement');
      expect(taskA?.completed).toBe(true); // SSOT derived from new evidence

      // Case B: Certified at A2
      const planWithCert = generateTodayLearningPlan({
        checkpointHistory: [failedAttempt],
        levelCertifications: {
          A2: {
            level: 'A2',
            certificateId: 'CERT-A2-2026-X1Y2',
            certifiedAt: failedAttemptTime + 100000,
            overallScore: 82,
            skillScores: { listening: 85, reading: 85, speaking: 80, writing: 80 },
            attemptId: 'cefr:A2:chk_passed',
            verifiedVersion: '2026.1',
            criteriaSummary: {} as any,
          },
        },
      });

      const taskB = planWithCert.items.find((item) => item.type === 'checkpoint_reinforcement');
      expect(taskB?.completed).toBe(true); // SSOT derived from certificate
    });

    it('derives checkpoint readiness task when learner qualifies for level checkpoint', () => {
      // Mock evidence store with enough lessons and evidence for A1 readiness
      const mockEvidence: FourSkillsEvidenceStore = {
        listening: [
          { id: 'l1', skill: 'listening', score: 85, source: 'four-skills', cefrDifficulty: 'A1', createdAt: 1000 },
          { id: 'l2', skill: 'listening', score: 85, source: 'four-skills', cefrDifficulty: 'A1', createdAt: 2000 },
        ],
        reading: [
          { id: 'r1', skill: 'reading', score: 85, source: 'four-skills', cefrDifficulty: 'A1', createdAt: 1000 },
          { id: 'r2', skill: 'reading', score: 85, source: 'four-skills', cefrDifficulty: 'A1', createdAt: 2000 },
        ],
        speaking: [
          { id: 's1', skill: 'speaking', score: 85, source: 'four-skills', cefrDifficulty: 'A1', createdAt: 1000 },
          { id: 's2', skill: 'speaking', score: 85, source: 'four-skills', cefrDifficulty: 'A1', createdAt: 2000 },
        ],
        writing: [
          { id: 'w1', skill: 'writing', score: 85, source: 'writing-ai', cefrDifficulty: 'A1', createdAt: 1000 },
          { id: 'w2', skill: 'writing', score: 85, source: 'writing-ai', cefrDifficulty: 'A1', createdAt: 2000 },
        ],
      };

      const plan = generateTodayLearningPlan({
        fourSkillsEvidence: mockEvidence,
        completedListeningLessonIds: ['listen_1'],
        completedReadingLessonIds: ['read_1'],
        completedSpeakingPromptIds: ['sp_1'],
        completedWritingPromptIds: ['wr_1'],
        levelCertifications: {},
      });

      const readinessTask = plan.items.find((item) => item.type === 'checkpoint_readiness');
      expect(readinessTask).toBeDefined();
      expect(readinessTask?.title).toContain('Kiểm Định Năng Lực CEFR A1');
      expect(readinessTask?.action.tab).toBe('four_skills');
      expect(readinessTask?.action.params?.openCheckpointLevel).toBe('A1');
    });
  });

  // =========================================================================
  // 4. PERSONALIZED INSIGHTS INTEGRATION
  // =========================================================================
  describe('4. Personalized Insights Integration', () => {
    it('derives authentic insight from failed checkpoint evidence without mutating state', () => {
      const failedAttempt: CheckpointHistoryEntry = {
        attemptId: 'cefr:A2:chk_insight_test',
        level: 'A2',
        date: 1000000,
        result: 'needs_reinforcement',
        isPassed: false,
        overallScore: 73,
        scores: { listening: 85, reading: 90, writing: 75, speaking: 42 }, // Reading highest 90, Speaking lowest 42
        policyVersion: '2026.1',
        schemaVersion: 1,
      };

      const certsBefore: LevelCertificationStore = {};
      const insights = deriveCheckpointCertificationInsights([failedAttempt], certsBefore);

      expect(insights).toHaveLength(1);
      const insight = insights[0];

      expect(insight.type).toBe('skill_gap');
      expect(insight.severity).toBe('warning');
      expect(insight.confidence).toBe('strong');
      expect(insight.title).toContain('Đọc');
      expect(insight.title).toContain('A2');
      expect(insight.title).toContain('Nói');
      expect(insight.message).toContain('90%');
      expect(insight.message).toContain('42%');
      expect(insight.message).toContain('55%'); // Floor
      expect(insight.reason).toContain('cefr:A2:chk_insight_test');
      expect(insight.action?.targetTab).toBe('four_skills');
      expect(insight.action?.subTab).toBe('speaking');

      // INVARIANT: Pure derivation, zero mutation
      expect(certsBefore).toEqual({});
    });

    it('integrates checkpoint insight cleanly into summary pipeline with deduplication and balance', () => {
      const failedAttempt: CheckpointHistoryEntry = {
        attemptId: 'cefr:B1:chk_summary_test',
        level: 'B1',
        date: 1000000,
        result: 'needs_reinforcement',
        isPassed: false,
        overallScore: 74,
        scores: { listening: 85, reading: 85, writing: 85, speaking: 45 },
        policyVersion: '2026.1',
        schemaVersion: 1,
      };

      const summary = derivePersonalizedInsightsSummary({
        checkpointHistory: [failedAttempt],
        levelCertifications: {},
      });

      expect(summary.hasInsights).toBe(true);
      const checkpointInsight = summary.insights.find(
        (i) => i.id.startsWith('insight_checkpoint_fail_B1_speaking')
      );
      expect(checkpointInsight).toBeDefined();
      expect(checkpointInsight?.confidence).toBe('strong');
    });
  });

  // =========================================================================
  // 5. FULL REINFORCEMENT FLOW (END-TO-END)
  // =========================================================================
  describe('5. Full Reinforcement Flow (End-to-End)', () => {
    it('executes full loop: checkpoint -> fail Speaking -> recommendation -> practice -> new evidence -> retake available & pass', () => {
      let storeCerts: LevelCertificationStore = {};
      let storeHistory: CheckpointHistoryEntry[] = [];
      let storeEvidence: FourSkillsEvidenceStore = {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      };

      const startTime = 1712000000000;

      // STEP 1: Learner takes Checkpoint A2 and fails Speaking
      const attempt1Id = 'cefr:A2:chk_attempt_1';
      const eval1 = evaluateCheckpointCertification({
        level: 'A2',
        skillScores: { listening: 80, reading: 85, writing: 75, speaking: 45 }, // Speaking fails floor 55
        attemptId: attempt1Id,
        nowMs: startTime,
      });

      expect(eval1.isPassed).toBe(false);
      expect(eval1.result).toBe('needs_reinforcement');

      // Record in store history
      const entry1 = createCheckpointHistoryEntry(eval1);
      storeHistory = appendCheckpointHistory(storeHistory, entry1);
      storeCerts = preserveHighestCertificationOnRetake(storeCerts, eval1);

      expect(storeHistory).toHaveLength(1);
      expect(storeCerts.A2).toBeUndefined(); // Still uncertified

      // STEP 2: Recommendation Engine resolves Next Best Action
      const dispatchContext: NextActionDispatchContext = {
        navigateToTab: vi.fn(),
        setActiveFourSkill: vi.fn(),
        startAdaptivePractice: vi.fn(),
      };

      const nextAction = resolveNextBestActions(
        {
          flowType: 'checkpoint',
          checkpoint: { attemptId: attempt1Id, level: 'A2', evaluation: eval1 },
        },
        dispatchContext
      );

      expect(nextAction.resolvedPriority).toBe(1);
      expect(nextAction.primaryAction.id).toBe('next-action-reinforce-speaking');

      // STEP 3: Today Learning Plan reflects uncompleted reinforcement task
      const planBeforePractice = generateTodayLearningPlan({
        checkpointHistory: storeHistory,
        levelCertifications: storeCerts,
        fourSkillsEvidence: storeEvidence,
      });

      const taskBefore = planBeforePractice.items.find((it) => it.type === 'checkpoint_reinforcement');
      expect(taskBefore?.completed).toBe(false);

      // Verify cooldown prevents immediate retake
      const immediateRetakeCheck = canRetakeCheckpointLevel('A2', storeHistory, startTime + 1000);
      expect(immediateRetakeCheck.canRetake).toBe(false);
      expect(immediateRetakeCheck.remainingCooldownMs).toBeGreaterThan(0);

      // STEP 4: Learner performs authentic Speaking practice (Adds REAL evidence)
      // INVARIANT: No fake lesson auto-completion, no fake competency mutation!
      const practiceTime = startTime + 3600000; // 1 hour later
      const authenticSpeechEvidence: CompetencyEvidence = {
        id: 'sp_real_1',
        skill: 'speaking',
        score: 82, // Improved score!
        source: 'four-skills',
        cefrDifficulty: 'A2',
        createdAt: practiceTime,
        quality: 1.0,
      };
      storeEvidence.speaking.push(authenticSpeechEvidence);

      // Today Learning Plan now sees reinforcement task satisfied via SSOT!
      const planAfterPractice = generateTodayLearningPlan({
        checkpointHistory: storeHistory,
        levelCertifications: storeCerts,
        fourSkillsEvidence: storeEvidence,
      });
      const taskAfter = planAfterPractice.items.find((it) => it.type === 'checkpoint_reinforcement');
      expect(taskAfter?.completed).toBe(true);

      // STEP 5: Cooldown elapses (A2 cooldown is 12 hours)
      const a2Cooldown = CENTRAL_CERTIFICATION_POLICY.levels.A2.retakeCooldownMs;
      const retakeTime = startTime + a2Cooldown + 60000;

      const retakeCheck = canRetakeCheckpointLevel('A2', storeHistory, retakeTime);
      expect(retakeCheck.canRetake).toBe(true);
      expect(retakeCheck.remainingCooldownMs).toBe(0);

      // STEP 6: Learner takes fresh Attempt 2 and PASSES!
      const attempt2Id = 'cefr:A2:chk_attempt_2';
      const eval2 = evaluateCheckpointCertification({
        level: 'A2',
        skillScores: { listening: 85, reading: 85, writing: 80, speaking: 75 }, // All pass floor 55!
        attemptId: attempt2Id,
        nowMs: retakeTime,
      });

      expect(eval2.isPassed).toBe(true);
      expect(eval2.result).toBe('certified');

      // Record in store history & certs
      const entry2 = createCheckpointHistoryEntry(eval2);
      storeHistory = appendCheckpointHistory(storeHistory, entry2);
      storeCerts = preserveHighestCertificationOnRetake(storeCerts, eval2);

      // History has both attempts (attempt 2 newest, attempt 1 preserved)
      expect(storeHistory).toHaveLength(2);
      expect(storeHistory[0].attemptId).toBe(attempt2Id);
      expect(storeHistory[0].isPassed).toBe(true);
      expect(storeHistory[1].attemptId).toBe(attempt1Id);
      expect(storeHistory[1].isPassed).toBe(false);

      // Official certificate is now awarded!
      expect(storeCerts.A2).toBeDefined();
      expect(storeCerts.A2?.level).toBe('A2');
      expect(storeCerts.A2?.certificateId).toMatch(/^CERT-A2-\d{4}-/);
      expect(storeCerts.A2?.overallScore).toBe(81);
    });
  });
});
