// src/services/__tests__/learningJourneyCertificationSemantics.test.ts
import { describe, it, expect } from 'vitest';
import {
  deriveFourSkillsLearningJourney,
  FourSkillsLearningJourney,
} from '../learningJourneyService';
import type {
  LevelCertificationStore,
  CheckpointHistoryEntry,
  PersistedLevelCertification,
} from '../../types/levelCertification';

describe('Phase 11: Learning Journey & Certification Semantics', () => {
  // Mock certified A2 record
  const mockA2Cert: PersistedLevelCertification = {
    level: 'A2',
    certificateId: 'CERT-A2-2026-TEST99',
    certifiedAt: 1712345678000,
    overallScore: 82,
    skillScores: { listening: 85, reading: 80, speaking: 78, writing: 85 },
    attemptId: 'chk_a2_1712345678',
    verifiedVersion: '2026.1',
    criteriaSummary: {
      overallRequired: 70,
      overallAchieved: 82,
      floorRequired: 55,
      minSkillAchieved: 78,
      verifiedVersion: '2026.1',
    },
  };

  it('maintains 100% lessons != certified invariant (lesson completion does not auto-certify)', () => {
    // Learner completed all 16 A1 listening lessons and other mock lessons
    const a1LessonIds = ['lis_a1_01', 'lis_a1_02', 'lis_a1_03', 'lis_a1_04'];

    const journey: FourSkillsLearningJourney = deriveFourSkillsLearningJourney({
      completedListeningLessonIds: a1LessonIds,
      fourSkillsCompletionProgress: {
        reading: ['rd_a1_01'],
        speaking: ['spk_a1_01'],
        writing: ['wri_a1_01'],
      },
      levelCertifications: {}, // No certification in store
      checkpointHistory: [],
    });

    const a1Node = journey.levels.A1;
    // Even if lessons are partially or fully completed
    expect(a1Node.isCertified).toBe(false);
    expect(a1Node.certificationStatus).not.toBe('certified');
    expect(journey.summary.highestCertifiedLevel).toBeNull();
  });

  it('separates currentlyLearningLevel from highestCertifiedLevel (e.g. Learning: B2, Highest Certified: A2)', () => {
    const certs: LevelCertificationStore = {
      A2: mockA2Cert,
    };

    // Learner is actively working on B2 lessons (listen_1 belongs to B2)
    const journey = deriveFourSkillsLearningJourney({
      completedListeningLessonIds: ['listen_1'],
      resumeActivities: {
        b2_active: {
          id: 'b2_active',
          type: 'listening',
          title: 'The Rise of Distributed Microservices Architecture',
          startedAt: Date.now() - 1000,
          lastActiveAt: Date.now(),
          completed: false,
          schemaVersion: 1,
          checkpoint: {
            lessonId: 'listen_1',
            answers: {},
            totalQuestions: 5,
            progressPercent: 30,
          },
        },
      },
      levelCertifications: certs,
      checkpointHistory: [],
    });

    expect(journey.summary.currentlyLearningLevel).toBe('B2');
    expect(journey.summary.currentLevel).toBe('B2');
    expect(journey.summary.highestCertifiedLevel).toBe('A2');
    expect(journey.levels.A2.isCertified).toBe(true);
    expect(journey.levels.A2.certificationStatus).toBe('certified');
    expect(journey.levels.B2.isCertified).toBe(false);
  });

  it('renders neutral state for brand new users (never failed, never score 0)', () => {
    const journey = deriveFourSkillsLearningJourney({
      completedListeningLessonIds: [],
      fourSkillsCompletionProgress: null,
      resumeActivities: null,
      levelCertifications: {},
      checkpointHistory: [],
    });

    expect(journey.summary.isNewUser).toBe(true);
    expect(journey.summary.currentLevel).toBe('A1');
    expect(journey.summary.highestCertifiedLevel).toBeNull();

    // A1 node must be neutral 'not_ready', never 'needs_reinforcement' or score 0
    const a1Node = journey.levels.A1;
    expect(a1Node.certificationStatus).toBe('not_ready');
    expect(a1Node.isCertified).toBe(false);
    expect(a1Node.latestAttempt).toBeNull();
  });

  it('handles returning users with completed lessons without retroactively auto-certifying', () => {
    const journey = deriveFourSkillsLearningJourney({
      completedListeningLessonIds: ['listen_a1_1', 'listen_a1_2'],
      fourSkillsCompletionProgress: {
        reading: ['read_a1_1', 'read_a1_2'],
      },
      levelCertifications: {}, // Empty store
      checkpointHistory: [], // Never took checkpoint
    });

    expect(journey.summary.isNewUser).toBe(false);
    expect(journey.summary.highestCertifiedLevel).toBeNull();

    const a1Node = journey.levels.A1;
    expect(a1Node.isCertified).toBe(false);
    expect(a1Node.certificationRecord).toBeNull();
    // Readiness is evaluated independently without fabricating certification
    expect(a1Node.certificationStatus).not.toBe('certified');
  });

  it('marks needs_reinforcement when latest attempt at a level failed and cooldown is active', () => {
    const failedAttempt: CheckpointHistoryEntry = {
      attemptId: 'chk_a1_failed_01',
      level: 'A1',
      date: Date.now() - 1000 * 60, // 1 minute ago (cooldown active: 12h)
      result: 'needs_reinforcement',
      isPassed: false,
      overallScore: 62,
      scores: { listening: 80, reading: 75, speaking: 45, writing: 60 },
      policyVersion: '2026.1',
      schemaVersion: 1,
    };

    const journey = deriveFourSkillsLearningJourney({
      levelCertifications: {},
      checkpointHistory: [failedAttempt],
    });

    const a1Node = journey.levels.A1;
    expect(a1Node.certificationStatus).toBe('needs_reinforcement');
    expect(a1Node.latestAttempt).toBeDefined();
    expect(a1Node.latestAttempt?.isPassed).toBe(false);
  });

  it('reflects active checkpoint session in progress', () => {
    const now = Date.now();
    const journey = deriveFourSkillsLearningJourney({
      levelCertifications: {},
      resumeActivities: {
        active_chk_b1: {
          id: 'chk_b1_session',
          type: 'checkpoint',
          title: 'B1 Checkpoint Exam',
          startedAt: now - 5000,
          lastActiveAt: now,
          completed: false,
          schemaVersion: 1,
          checkpoint: {
            attemptId: 'chk_b1_session',
            level: 'B1',
            currentSection: 'reading',
            completedSections: ['listening'],
            listeningAnswers: {},
            readingAnswers: {},
            speakingTranscripts: {},
            writingDraft: '',
          },
        },
      },
    });

    expect(journey.levels.B1.certificationStatus).toBe('in_progress');
  });
});
