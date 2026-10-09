import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../useAppStore';
import {
  sanitizeLevelCertifications,
  sanitizeCheckpointHistory,
  mergeLevelCertifications,
  mergeCheckpointHistory,
  pruneFinalizedCheckpointResumes,
  MAX_PERSISTED_CHECKPOINT_HISTORY,
} from '../fourSkillsSanitizers';
import type {
  PersistedLevelCertification,
  CheckpointHistoryEntry,
  LevelCertificationStore,
  ResumableActivity,
} from '../../types';

describe('Phase 12: Certification Persistence, Backup, and Deterministic Cloud Merge', () => {
  const sampleA2Cert: PersistedLevelCertification = {
    level: 'A2',
    certificateId: 'CERT-A2-2026-X7K9',
    certifiedAt: 1712000000000,
    overallScore: 82,
    skillScores: {
      listening: 85,
      reading: 80,
      speaking: 78,
      writing: 85,
    },
    attemptId: 'chk_a2_attempt_101',
    verifiedVersion: '2026.1',
    criteriaSummary: {
      overallRequired: 70,
      overallAchieved: 82,
      floorRequired: 55,
      minSkillAchieved: 78,
      verifiedVersion: '2026.1',
    },
  };

  const sampleA1Cert: PersistedLevelCertification = {
    level: 'A1',
    certificateId: 'CERT-A1-2026-A111',
    certifiedAt: 1711000000000,
    overallScore: 75,
    skillScores: {
      listening: 80,
      reading: 75,
      speaking: 72,
      writing: 73,
    },
    attemptId: 'chk_a1_attempt_001',
    verifiedVersion: '2026.1',
    criteriaSummary: {
      overallRequired: 70,
      overallAchieved: 75,
      floorRequired: 55,
      minSkillAchieved: 72,
      verifiedVersion: '2026.1',
    },
  };

  const sampleA2HistoryEntry: CheckpointHistoryEntry = {
    attemptId: 'chk_a2_attempt_101',
    level: 'A2',
    date: 1712000000000,
    result: 'certified',
    isPassed: true,
    overallScore: 82,
    scores: {
      listening: 85,
      reading: 80,
      speaking: 78,
      writing: 85,
    },
    policyVersion: '2026.1',
    schemaVersion: 1,
    certificateId: 'CERT-A2-2026-X7K9',
  };

  const sampleA2FailedHistoryEntry: CheckpointHistoryEntry = {
    attemptId: 'chk_a2_attempt_102',
    level: 'A2',
    date: 1712500000000,
    result: 'needs_reinforcement',
    isPassed: false,
    overallScore: 64,
    scores: {
      listening: 70,
      reading: 72,
      speaking: 50,
      writing: 64,
    },
    policyVersion: '2026.1',
    schemaVersion: 1,
  };

  beforeEach(() => {
    useAppStore.getState().resetToDefault();
    vi.restoreAllMocks();
  });

  describe('1. Sanitization & Safe Storage Guard', () => {
    it('sanitizes and preserves valid certifications while rejecting malformed/corrupted ones', () => {
      const validStore: LevelCertificationStore = {
        A2: sampleA2Cert,
      };
      const result = sanitizeLevelCertifications(validStore);
      expect(result.A2).toBeDefined();
      expect(result.A2?.certificateId).toBe('CERT-A2-2026-X7K9');
      expect(result.A2?.overallScore).toBe(82);

      // Rejects non-objects or invalid levels
      expect(sanitizeLevelCertifications(null)).toEqual({});
      expect(sanitizeLevelCertifications(undefined)).toEqual({});
      expect(sanitizeLevelCertifications('string')).toEqual({});

      // Rejects corrupted certificates missing required fields
      const corrupted = {
        A2: {
          level: 'A2',
          certificateId: '', // invalid empty ID
          overallScore: 90,
        },
        B1: {
          level: 'B1',
          certificateId: 'CERT-B1-FAKE',
          certifiedAt: -1, // invalid negative timestamp
          overallScore: 80,
          skillScores: { listening: 80, reading: 80, speaking: 80, writing: 80 },
          attemptId: 'chk_1',
          criteriaSummary: {
            overallRequired: 75,
            overallAchieved: 80,
            floorRequired: 60,
            minSkillAchieved: 80,
            verifiedVersion: '2026.1',
          },
        },
        INVALID_LEVEL: sampleA2Cert,
      };
      const sanitizedCorrupted = sanitizeLevelCertifications(corrupted);
      expect(sanitizedCorrupted.A2).toBeUndefined();
      expect(sanitizedCorrupted.B1).toBeUndefined();
      expect((sanitizedCorrupted as any).INVALID_LEVEL).toBeUndefined();
    });

    it('sanitizes checkpoint history, deduplicates attempts, and strictly bounds size to MAX_PERSISTED_CHECKPOINT_HISTORY', () => {
      const entries: CheckpointHistoryEntry[] = [];
      // Generate 70 entries (exceeding MAX_PERSISTED_CHECKPOINT_HISTORY = 50)
      for (let i = 0; i < 70; i++) {
        entries.push({
          attemptId: `chk_attempt_${i}`,
          level: 'A1',
          date: 1000000 + i * 1000,
          result: 'certified',
          isPassed: true,
          overallScore: 75,
          scores: { listening: 75, reading: 75, speaking: 75, writing: 75 },
          policyVersion: '2026.1',
          schemaVersion: 1,
        });
      }

      const sanitized = sanitizeCheckpointHistory(entries);
      expect(sanitized.length).toBe(MAX_PERSISTED_CHECKPOINT_HISTORY);
      // Verify descending sort by date
      expect(sanitized[0].date).toBeGreaterThan(sanitized[1].date);
      // Newest should be i = 69
      expect(sanitized[0].attemptId).toBe('chk_attempt_69');
    });
  });

  describe('2. Backup Export & Import with Backward Compatibility', () => {
    it('exports and restores certification evidence cleanly in roundtrip', () => {
      const store = useAppStore.getState();
      store.saveLevelCertification!(sampleA2Cert);
      useAppStore.setState({
        checkpointHistory: [sampleA2HistoryEntry],
      });

      const json = store.exportBackupData();
      const parsed = JSON.parse(json);

      expect(parsed.levelCertifications).toBeDefined();
      expect(parsed.levelCertifications.A2.certificateId).toBe('CERT-A2-2026-X7K9');
      expect(parsed.checkpointHistory).toBeDefined();
      expect(parsed.checkpointHistory).toHaveLength(1);
      expect(parsed.checkpointHistory[0].attemptId).toBe('chk_a2_attempt_101');

      // Reset store to pristine default
      store.resetToDefault();
      expect(useAppStore.getState().levelCertifications?.A2).toBeUndefined();
      expect(useAppStore.getState().checkpointHistory).toHaveLength(0);

      // Import restored backup
      const importRes = store.importBackupData(json);
      expect(importRes.success).toBe(true);

      const restoredState = useAppStore.getState();
      expect(restoredState.levelCertifications?.A2?.certificateId).toBe('CERT-A2-2026-X7K9');
      expect(restoredState.checkpointHistory).toHaveLength(1);
      expect(restoredState.checkpointHistory?.[0].attemptId).toBe('chk_a2_attempt_101');
    });

    it('gracefully handles legacy backup without certification fields without crashing', () => {
      const legacyBackup = {
        app: 'EnglishMasteryHub',
        owner: 'Cựu Học Viên',
        version: '1.9.0',
        profile: {
          name: 'Cựu Học Viên',
          streak: 5,
          xp: 300,
        },
      };

      const result = useAppStore.getState().importBackupData(JSON.stringify(legacyBackup));
      expect(result.success).toBe(true);

      const state = useAppStore.getState();
      expect(state.levelCertifications).toEqual({});
      expect(state.checkpointHistory).toEqual([]);
    });

    it('sanitizes and rejects fake/tampered certification payloads in backup import', () => {
      const tamperedBackup = {
        app: 'EnglishMasteryHub',
        profile: { name: 'Cheater' },
        levelCertifications: {
          C2: {
            level: 'C2',
            certificateId: '', // Invalid empty certificate ID
            overallScore: 100,
            skillScores: { listening: 100, reading: 100, speaking: 100, writing: 100 },
          },
        },
        checkpointHistory: [
          {
            attemptId: '', // Invalid empty attemptId
            level: 'C2',
            result: 'certified',
          },
        ],
      };

      const result = useAppStore.getState().importBackupData(JSON.stringify(tamperedBackup));
      expect(result.success).toBe(true);

      const state = useAppStore.getState();
      expect(state.levelCertifications?.C2).toBeUndefined();
      expect(state.checkpointHistory).toHaveLength(0);
    });
  });

  describe('3. Cloud Sync Deterministic Monotonic Merge', () => {
    it('Monotonic Invariant: Device A is A2 certified; reconnecting to stale Device B without A2 cert MUST NEVER erase A2 cert', () => {
      // Local state has valid A2 certification
      useAppStore.setState({
        profile: { ...useAppStore.getState().profile, name: 'Learner A' },
        levelCertifications: { A2: sampleA2Cert },
        checkpointHistory: [sampleA2HistoryEntry],
      });

      // Remote cloud payload from stale device B with NO certifications
      const staleCloudPayload = {
        cloudProfile: {
          display_name: 'Learner A',
          xp: 500,
          four_skills_scores: {
            listening: [70, 75],
            reading: [70, 75],
            speaking: [70, 75],
            writing: [70, 75],
            level_certifications: {}, // Stale: no certs!
            checkpoint_history: [],
          },
        },
      };

      useAppStore.getState().mergeCloudData(staleCloudPayload);

      const state = useAppStore.getState();
      // Certified status is preserved monotonically!
      expect(state.levelCertifications?.A2).toBeDefined();
      expect(state.levelCertifications?.A2?.certificateId).toBe('CERT-A2-2026-X7K9');
      expect(state.checkpointHistory).toHaveLength(1);
    });

    it('Fresh Install: Device B starts with empty store and seamlessly acquires cloud certifications from Device A', () => {
      // Device B starts pristine default
      expect(useAppStore.getState().levelCertifications?.A2).toBeUndefined();

      const cloudPayload = {
        cloudProfile: {
          display_name: 'Multi-Device Learner',
          xp: 1500,
          four_skills_scores: {
            listening: [85],
            level_certifications: {
              A1: sampleA1Cert,
              A2: sampleA2Cert,
            },
            checkpoint_history: [sampleA2HistoryEntry],
          },
        },
      };

      useAppStore.getState().mergeCloudData(cloudPayload);

      const state = useAppStore.getState();
      expect(state.levelCertifications?.A1?.certificateId).toBe('CERT-A1-2026-A111');
      expect(state.levelCertifications?.A2?.certificateId).toBe('CERT-A2-2026-X7K9');
      expect(state.checkpointHistory).toHaveLength(1);
      expect(state.checkpointHistory?.[0].attemptId).toBe('chk_a2_attempt_101');
    });

    it('Conflict Resolution: When both local and remote have a certificate for level L, the higher overallScore wins', () => {
      const lowerA2Cert: PersistedLevelCertification = {
        ...sampleA2Cert,
        certificateId: 'CERT-A2-LOWER',
        overallScore: 74,
      };
      const higherA2Cert: PersistedLevelCertification = {
        ...sampleA2Cert,
        certificateId: 'CERT-A2-HIGHER',
        overallScore: 88,
      };

      const merged = mergeLevelCertifications({ A2: lowerA2Cert }, { A2: higherA2Cert });
      expect(merged.A2?.certificateId).toBe('CERT-A2-HIGHER');
      expect(merged.A2?.overallScore).toBe(88);

      // Symmetrical test: local higher, remote lower
      const mergedReverse = mergeLevelCertifications({ A2: higherA2Cert }, { A2: lowerA2Cert });
      expect(mergedReverse.A2?.certificateId).toBe('CERT-A2-HIGHER');
      expect(mergedReverse.A2?.overallScore).toBe(88);
    });

    it('Tie-break: When overallScores are equal, earlier certifiedAt wins for stability', () => {
      const certEarlier: PersistedLevelCertification = {
        ...sampleA2Cert,
        certificateId: 'CERT-EARLIER',
        certifiedAt: 1000,
        overallScore: 80,
      };
      const certLater: PersistedLevelCertification = {
        ...sampleA2Cert,
        certificateId: 'CERT-LATER',
        certifiedAt: 2000,
        overallScore: 80,
      };

      const merged = mergeLevelCertifications({ A2: certLater }, { A2: certEarlier });
      expect(merged.A2?.certificateId).toBe('CERT-EARLIER');
    });
  });

  describe('4. Multi-Device History Replay & Deduplication', () => {
    it('idempotently deduplicates identical attempt delivered across multiple sync rounds', () => {
      const localHistory = [sampleA2HistoryEntry];
      const remoteHistory = [sampleA2HistoryEntry]; // exact duplicate replay

      const merged = mergeCheckpointHistory(localHistory, remoteHistory);
      expect(merged).toHaveLength(1);
      expect(merged[0].attemptId).toBe('chk_a2_attempt_101');
    });

    it('merges two different attempts from different devices sorted by date descending', () => {
      const localHistory = [sampleA2HistoryEntry]; // date: 1712000000000
      const remoteHistory = [sampleA2FailedHistoryEntry]; // date: 1712500000000 (newer)

      const merged = mergeCheckpointHistory(localHistory, remoteHistory);
      expect(merged).toHaveLength(2);
      expect(merged[0].attemptId).toBe('chk_a2_attempt_102'); // Newer failed attempt
      expect(merged[1].attemptId).toBe('chk_a2_attempt_101'); // Older passed attempt
    });
  });

  describe('5. Completed Always Wins (No Resurrecting Finalized Checkpoints)', () => {
    it('prunes/marks completed any in-progress checkpoint activity matching a finalized attemptId', () => {
      const activeCheckpointResume: ResumableActivity = {
        id: 'chk_resume_101',
        type: 'checkpoint',
        title: 'CEFR A2 Checkpoint Exam',
        startedAt: 1711990000000,
        lastActiveAt: 1711995000000,
        completed: false, // In-progress on Device B!
        schemaVersion: 1,
        checkpoint: {
          attemptId: 'chk_a2_attempt_101', // Finalized on Device A!
          level: 'A2',
          currentSection: 'reading',
          completedSections: ['listening'],
          listeningAnswers: { q1: 1 },
          readingAnswers: {},
          speakingTranscripts: {},
          writingDraft: '',
        },
      };

      const otherResume: ResumableActivity = {
        id: 'reading_lesson_1',
        type: 'reading',
        title: 'Technology Trends',
        startedAt: 1711990000000,
        lastActiveAt: 1711995000000,
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          lessonId: 'tech_1',
          answers: {},
          totalQuestions: 5,
        },
      };

      const resumeActivities = {
        chk_resume_101: activeCheckpointResume,
        reading_lesson_1: otherResume,
      };

      const pruned = pruneFinalizedCheckpointResumes(resumeActivities, [sampleA2HistoryEntry]);

      // Checkpoint resume MUST be marked completed
      expect(pruned.chk_resume_101.completed).toBe(true);
      expect(pruned.chk_resume_101.completedAt).toBeDefined();

      // Normal non-checkpoint resume remains in-progress
      expect(pruned.reading_lesson_1.completed).toBe(false);
    });

    it('mergeCloudData automatically prevents stale cloud resume from resurrecting completed checkpoint', () => {
      // Local has completed checkpoint attempt
      useAppStore.setState({
        checkpointHistory: [sampleA2HistoryEntry],
        levelCertifications: { A2: sampleA2Cert },
      });

      // Cloud payload brings stale resume activity with completed: false
      const now = Date.now();
      const cloudPayloadWithStaleResume = {
        cloudProfile: {
          display_name: 'Learner',
        },
        cloudResumeActivities: {
          act_checkpoint_a2: {
            id: 'act_checkpoint_a2',
            type: 'checkpoint',
            title: 'CEFR A2 Exam',
            startedAt: now - 10000,
            lastActiveAt: now - 5000,
            completed: false, // Stale!
            schemaVersion: 1,
            checkpoint: {
              attemptId: 'chk_a2_attempt_101', // Already finalized!
              level: 'A2',
              currentSection: 'speaking',
              completedSections: ['listening', 'reading'],
              listeningAnswers: {},
              readingAnswers: {},
              speakingTranscripts: {},
              writingDraft: '',
            },
          },
        },
      };

      useAppStore.getState().mergeCloudData(cloudPayloadWithStaleResume);

      const state = useAppStore.getState();
      const resume = state.resumeActivities?.act_checkpoint_a2;
      expect(resume).toBeDefined();
      // Completed Always Wins ensures it is marked completed: true
      expect(resume?.completed).toBe(true);
    });
  });

  describe('6. Reset to Default Integrity', () => {
    it('resetToDefault clears levelCertifications and checkpointHistory back to clean empty states', () => {
      useAppStore.setState({
        levelCertifications: { A2: sampleA2Cert },
        checkpointHistory: [sampleA2HistoryEntry],
      });

      expect(useAppStore.getState().levelCertifications?.A2).toBeDefined();
      expect(useAppStore.getState().checkpointHistory).toHaveLength(1);

      useAppStore.getState().resetToDefault();

      expect(useAppStore.getState().levelCertifications).toEqual({});
      expect(useAppStore.getState().checkpointHistory).toEqual([]);
    });
  });
});
