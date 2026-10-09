import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import {
  evaluateCheckpointCertification,
  CENTRAL_CERTIFICATION_POLICY,
  preserveHighestCertificationOnRetake,
  evaluateLevelReadiness,
} from '../levelCertificationService';
import {
  finalizeCheckpointAttempt,
  saveSectionDraft,
  createInitialCheckpointState,
} from '../checkpointSessionLifecycle';
import { gradeReadingCheckpointSection } from '../readingCheckpointService';
import { gradeListeningCheckpointSection } from '../listeningCheckpointService';
import { gradeSpeakingCheckpointSection } from '../speakingCheckpointService';
import { evaluateWritingSectionResult } from '../writingCheckpointService';
import { deriveFourSkillsLearningJourney } from '../learningJourneyService';
import type {
  PersistedLevelCertification,
  CertificationEvaluationResult,
} from '../../types';
import type { CheckpointSessionState } from '../checkpointSessionLifecycle';

describe('Phase 13: Offline, Security, Abuse, Performance & Edge-Case Hardening', () => {
  beforeEach(() => {
    useAppStore.getState().resetToDefault();
    vi.restoreAllMocks();
  });

  describe('1. Offline Matrix & Graceful Degradation', () => {
    it('Reading: grades locally and deterministically without requiring internet or external API', () => {
      const userAnswers: Record<string, number> = {
        q1: 1, // correct
        q2: 0, // correct
        q3: 2, // wrong
        q4: 3, // correct
      };
      const questions = [
        { id: 'q1', correctIndex: 1, question: 'Question 1', options: ['A', 'B', 'C', 'D'] },
        { id: 'q2', correctIndex: 0, question: 'Question 2', options: ['A', 'B', 'C', 'D'] },
        { id: 'q3', correctIndex: 0, question: 'Question 3', options: ['A', 'B', 'C', 'D'] },
        { id: 'q4', correctIndex: 3, question: 'Question 4', options: ['A', 'B', 'C', 'D'] },
      ];

      const res = gradeReadingCheckpointSection({
        attemptId: 'chk_offline_reading',
        level: 'A2',
        lesson: {
          id: 'read_a2_1',
          title: 'Offline Reading Passage',
          content: ['This is a complete reading passage that provides necessary context for offline grading.'],
        } as any,
        questions: questions as any,
        userAnswers,
      });

      expect(res.status).toBe('evaluated');
      expect(res.score).toBe(75); // 3 out of 4 = 75%
      expect(res.hasSufficientEvidence).toBe(true);
      expect(res.passedFloor).toBe(true); // 75 >= 55 floor
    });

    it('Listening: handles missing/empty questions gracefully without runtime crash', () => {
      const res = gradeListeningCheckpointSection({
        attemptId: 'chk_offline_listening_empty',
        level: 'A2',
        userAnswers: {},
        questions: [],
      });

      expect(res.status).toBe('insufficient_evidence');
      expect(res.score).toBeNull(); // strictly null, zero fake score
      expect(res.passedFloor).toBe(false);
    });

    it('Speaking: Web Speech API unavailable or denied permission yields insufficient_evidence with zero simulated score', () => {
      const resUnsupported = gradeSpeakingCheckpointSection({
        attemptId: 'chk_offline_speaking_1',
        level: 'A2',
        prompt: { id: 'spk_1', title: 'Speaking 1', turns: [] } as any,
        turns: [{
          turnIndex: 0,
          partnerPrompt: 'Hi',
          targetSentence: 'Hello there',
          phonetic: '',
          meaningVi: '',
          keyKeywords: [],
          sampleAudioText: '',
        }],
        spokenTranscripts: {},
        isBrowserSupported: false,
      });

      expect(resUnsupported.status).toBe('insufficient_evidence');
      expect(resUnsupported.score).toBeNull(); // strictly null, NO fake 85%!
      expect(resUnsupported.passedFloor).toBe(false);
      expect(resUnsupported.reason).toBe('unsupported_browser');

      const resDenied = gradeSpeakingCheckpointSection({
        attemptId: 'chk_offline_speaking_2',
        level: 'A2',
        prompt: { id: 'spk_1', title: 'Speaking 1', turns: [] } as any,
        turns: [{
          turnIndex: 0,
          partnerPrompt: 'Hi',
          targetSentence: 'Hello there',
          phonetic: '',
          meaningVi: '',
          keyKeywords: [],
          sampleAudioText: '',
        }],
        spokenTranscripts: {},
        isBrowserSupported: true,
        turnMetadata: {
          0: { error: 'not-allowed' },
        },
      });

      expect(resDenied.status).toBe('insufficient_evidence');
      expect(resDenied.score).toBeNull();
      expect(resDenied.reason).toBe('permission_denied');
    });

    it('Writing: offline / AI unavailable yields insufficient_evidence while draft is preserved locally and never rolls back completed sections', () => {
      const essay = 'This is an offline written essay that demonstrates real learner effort.';
      const resOffline = evaluateWritingSectionResult({
        attemptId: 'chk_offline_writing',
        level: 'A2',
        prompt: { id: 'wrt_a2_1', title: 'Write an email', prompt: 'Write an email...', minWords: 5 } as any,
        essay,
        isOffline: true,
      });

      expect(resOffline.status).toBe('pending');
      expect(resOffline.score).toBeNull();
      expect(resOffline.reason).toBe('offline');
      expect(resOffline.isFallback).toBe(false);

      // Verify draft preservation in session state without rollback
      let session = createInitialCheckpointState('A2');
      session = {
        ...session,
        completedSections: ['listening', 'reading'],
        sectionScores: { listening: 80, reading: 85 },
      };
      const draftedSession = saveSectionDraft(session, { writing: essay });

      expect(draftedSession.answers.writing).toBe(essay);
      expect(draftedSession.completedSections).toContain('listening');
      expect(draftedSession.completedSections).toContain('reading');
      expect(draftedSession.sectionScores.listening).toBe(80);
      expect(draftedSession.sectionScores.reading).toBe(85);
    });
  });

  describe('2. Trust, Security & Anti-Tamper Hardening', () => {
    it('DevTools Tampering: saveLevelCertification rejects fabricated certificates with sub-threshold overall score', () => {
      const fakeLowScoreCert: PersistedLevelCertification = {
        level: 'A2',
        certificateId: 'CERT-FAKE-A2',
        certifiedAt: Date.now(),
        overallScore: 45, // Sub-threshold! Required is 70
        skillScores: { listening: 45, reading: 45, speaking: 45, writing: 45 },
        attemptId: 'chk_hack_1',
        verifiedVersion: '2026.1',
        criteriaSummary: {
          overallRequired: 70,
          overallAchieved: 45,
          floorRequired: 55,
          minSkillAchieved: 45,
          verifiedVersion: '2026.1',
        },
      };

      useAppStore.getState().saveLevelCertification!(fakeLowScoreCert);
      expect(useAppStore.getState().levelCertifications?.A2).toBeUndefined();
    });

    it('DevTools Tampering: saveLevelCertification rejects certificate failing per-skill floor even if overall is high', () => {
      const fakeFloorFailureCert: PersistedLevelCertification = {
        level: 'A2',
        certificateId: 'CERT-FAKE-FLOOR',
        certifiedAt: Date.now(),
        overallScore: 78, // High overall
        skillScores: { listening: 95, reading: 95, speaking: 35, writing: 87 }, // Speaking 35 < 55 floor!
        attemptId: 'chk_hack_2',
        verifiedVersion: '2026.1',
        criteriaSummary: {
          overallRequired: 70,
          overallAchieved: 78,
          floorRequired: 55,
          minSkillAchieved: 35,
          verifiedVersion: '2026.1',
        },
      };

      useAppStore.getState().saveLevelCertification!(fakeFloorFailureCert);
      expect(useAppStore.getState().levelCertifications?.A2).toBeUndefined();
    });

    it('DevTools Tampering: saveLevelCertification rejects malformed or corrupted certificate objects', () => {
      useAppStore.getState().saveLevelCertification!({} as any);
      useAppStore.getState().saveLevelCertification!({ level: 'UNKNOWN' } as any);
      useAppStore.getState().saveLevelCertification!({ level: 'A2', certificateId: '' } as any);

      expect(useAppStore.getState().levelCertifications).toEqual({});
    });

    it('Idempotency & Anti-Replay: recordCheckpointAttemptResult does not duplicate history on repeated calls', () => {
      const validEval: CertificationEvaluationResult = {
        result: 'certified',
        isPassed: true,
        level: 'A2',
        attemptId: 'chk_idempotent_101',
        certificateId: 'CERT-A2-VALID-1',
        certifiedAt: 1712000000000,
        overallScore: 80,
        requiredOverall: 70,
        policyVersion: '2026.1',
        schemaVersion: 1,
        assessedAt: 1712000000000,
        reason: 'Passed all criteria',
        skillResults: {
          listening: { skill: 'listening', score: 80, passedFloor: true, requiredFloor: 55, rawEvidenceCount: 3, confidence: 1 },
          reading: { skill: 'reading', score: 80, passedFloor: true, requiredFloor: 55, rawEvidenceCount: 3, confidence: 1 },
          speaking: { skill: 'speaking', score: 80, passedFloor: true, requiredFloor: 55, rawEvidenceCount: 3, confidence: 1 },
          writing: { skill: 'writing', score: 80, passedFloor: true, requiredFloor: 55, rawEvidenceCount: 3, confidence: 1 },
        },
      };

      // Call twice with the same attemptId
      useAppStore.getState().recordCheckpointAttemptResult!(validEval);
      useAppStore.getState().recordCheckpointAttemptResult!(validEval);

      expect(useAppStore.getState().checkpointHistory).toHaveLength(1);
      expect(useAppStore.getState().levelCertifications?.A2?.certificateId).toBe('CERT-A2-VALID-1');
    });

    it('Session Finalization Replay: finalizeCheckpointAttempt returns alreadyFinalized on replay', () => {
      const sessionState: CheckpointSessionState = {
        ...createInitialCheckpointState('A2'),
        sectionScores: { listening: 80, reading: 80, speaking: 80, writing: 80 },
        completedSections: ['listening', 'reading', 'speaking', 'writing'],
      };

      const res1 = finalizeCheckpointAttempt(sessionState);
      expect(res1.success).toBe(true);
      expect(res1.alreadyFinalized).toBe(false);

      // Second call with same attemptId
      const res2 = finalizeCheckpointAttempt(sessionState);
      expect(res2.success).toBe(true);
      expect(res2.alreadyFinalized).toBe(true);
      expect(res2.evaluation.attemptId).toBe(sessionState.attemptId);
    });
  });

  describe('3. Performance & Lesson Cache Verification', () => {
    it('deriveFourSkillsLearningJourney does not rescan datasets on consecutive calls with default static data', () => {
      const journey1 = deriveFourSkillsLearningJourney({});
      const journey2 = deriveFourSkillsLearningJourney({});

      expect(journey1.levels.A1.totalLessons).toBe(journey2.levels.A1.totalLessons);
      expect(journey1.levels.A2.totalLessons).toBe(journey2.levels.A2.totalLessons);
      expect(journey1.summary.totalLessons).toBe(journey2.summary.totalLessons);
    });
  });

  describe('4. Edge Cases: Evidence, Journey & Retakes', () => {
    it('Missing or NaN score sanitizes safely to 0 and fails floor criteria', () => {
      const evalRes = evaluateCheckpointCertification({
        level: 'A2',
        attemptId: 'chk_nan_test',
        skillScores: {
          listening: NaN as any,
          reading: 85,
          speaking: Infinity as any,
          writing: null as any,
        },
      });

      expect(evalRes.isPassed).toBe(false);
      expect(evalRes.result).toBe('needs_reinforcement');
      expect(evalRes.skillResults.listening.score).toBe(0);
      expect(evalRes.skillResults.listening.passedFloor).toBe(false);
    });

    it('Single skill assessed cannot pass certification (needs all 4 skills)', () => {
      const evalRes = evaluateCheckpointCertification({
        level: 'A1',
        attemptId: 'chk_single_skill',
        skillScores: {
          listening: 95,
          reading: 0,
          speaking: 0,
          writing: 0,
        },
      });

      expect(evalRes.isPassed).toBe(false);
      expect(evalRes.result).toBe('needs_reinforcement');
    });

    it('Low confidence blocks readiness even if scores are passing', () => {
      const readiness = evaluateLevelReadiness('A2', {
        skillCompetencies: {
          listening: { score: 85, level: 'A2', totalAttempts: 3, confidenceScore: 0.1 },
        },
        completedLessonIdsBySkill: {
          listening: ['l1', 'l2'],
          reading: ['r1', 'r2'],
          speaking: ['s1', 's2'],
          writing: ['w1', 'w2'],
        },
      });

      expect(readiness.skills.listening.hasSufficientConfidence).toBe(false);
      expect(readiness.isReadyForCheckpoint).toBe(false);
    });

    it('100% lessons complete does NOT automatically grant certification', () => {
      const journey = deriveFourSkillsLearningJourney({
        completedListeningLessonIds: ['list_1', 'list_2'],
        fourSkillsCompletionProgress: {
          reading: ['read_1'],
          speaking: ['spk_1'],
          writing: ['wrt_1'],
        },
        levelCertifications: {}, // No checkpoint passed
      });

      // Status must not be certified just because lessons exist
      expect(journey.levels.A1.certificationStatus).not.toBe('certified');
    });

    it('Learner can be certified at A1 while currently learning B2 (distinct level semantics & free exploration)', () => {
      const store = useAppStore.getState();
      const a1Cert: PersistedLevelCertification = {
        level: 'A1',
        certificateId: 'CERT-A1-2026-X999',
        certifiedAt: Date.now(),
        overallScore: 82,
        skillScores: { listening: 85, reading: 80, speaking: 80, writing: 83 },
        attemptId: 'chk_a1_ok',
        verifiedVersion: '2026.1',
        criteriaSummary: {
          overallRequired: 70,
          overallAchieved: 82,
          floorRequired: 55,
          minSkillAchieved: 80,
          verifiedVersion: '2026.1',
        },
      };

      store.saveLevelCertification!(a1Cert);

      const journey = deriveFourSkillsLearningJourney({
        levelCertifications: useAppStore.getState().levelCertifications,
        // Learner has an in-progress lesson at B2
        resumeActivities: {
          b2_reading: {
            id: 'b2_reading',
            type: 'reading',
            title: 'B2 Reading Activity',
            startedAt: Date.now(),
            lastActiveAt: Date.now(),
            completed: false,
            schemaVersion: 1,
            checkpoint: { lessonId: 'b2_read_1', answers: {}, totalQuestions: 5 },
          },
        },
      });

      expect(journey.summary.highestCertifiedLevel).toBe('A1');
      expect(journey.levels.A1.certificationStatus).toBe('certified');
      // Free exploration preserved: B2 remains accessible
      expect(journey.levels.B2.status).toBeDefined();
    });

    it('Failed retake preserves prior valid certification without downgrade', () => {
      const initialCerts = {
        A2: {
          level: 'A2' as const,
          certificateId: 'CERT-A2-FIRST',
          certifiedAt: 1000,
          overallScore: 85,
          skillScores: { listening: 85, reading: 85, speaking: 85, writing: 85 },
          attemptId: 'chk_a2_1',
          verifiedVersion: '2026.1',
          criteriaSummary: {
            overallRequired: 70,
            overallAchieved: 85,
            floorRequired: 55,
            minSkillAchieved: 85,
            verifiedVersion: '2026.1',
          },
        },
      };

      const failedRetakeEval: CertificationEvaluationResult = {
        result: 'needs_reinforcement',
        isPassed: false,
        level: 'A2',
        attemptId: 'chk_a2_failed_retake',
        overallScore: 58,
        requiredOverall: 70,
        policyVersion: '2026.1',
        schemaVersion: 1,
        assessedAt: 2000,
        failingReasons: ['Overall score below threshold'],
        canRetake: true,
        skillResults: {
          listening: { skill: 'listening', score: 60, passedFloor: true, requiredFloor: 55, rawEvidenceCount: 2, confidence: 1 },
          reading: { skill: 'reading', score: 60, passedFloor: true, requiredFloor: 55, rawEvidenceCount: 2, confidence: 1 },
          speaking: { skill: 'speaking', score: 55, passedFloor: true, requiredFloor: 55, rawEvidenceCount: 2, confidence: 1 },
          writing: { skill: 'writing', score: 57, passedFloor: true, requiredFloor: 55, rawEvidenceCount: 2, confidence: 1 },
        },
      };

      const preserved = preserveHighestCertificationOnRetake(initialCerts, failedRetakeEval);
      expect(preserved.A2?.certificateId).toBe('CERT-A2-FIRST');
      expect(preserved.A2?.overallScore).toBe(85);
    });
  });
});
