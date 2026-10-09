// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import {
  recordSkillEvidence,
  recordSkillScore,
  getSkillEvidence,
  getFourSkillsEvidenceStore,
  evaluateFourSkillsCompetencyV2,
  evaluateSkillCompetencyV2,
  clearAllSkillsData,
  EMPTY_FOUR_SKILLS_EVIDENCE,
} from '../skillsCompetencyService';
import type { CompetencyEvidence } from '../../types/competencyEvidence';

describe('PHASE 3 — Competency Integration, Evidence Sources & Semantics Suite', () => {
  const fixedNow = 1718000000000;

  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      fourSkillsScores: {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      },
      fourSkillsEvidence: {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      },
      completedListeningLessonIds: [],
      srsProgressMap: {},
      mistakeBank: {},
      wordLearningStats: {},
    });
  });

  // =========================================================================
  // 1. LISTENING EVIDENCE & CONTAMINATION GUARDS
  // =========================================================================
  describe('1. Listening Evidence & Contamination Guards', () => {
    it('records valid four-skills listening comprehension evidence with CEFR level', () => {
      recordSkillEvidence({
        skill: 'listening',
        score: 85,
        source: 'four-skills',
        cefrDifficulty: 'B2',
        quality: 1.0,
        createdAt: fixedNow,
        metadata: {
          lessonId: 'lis_b2_01',
          lessonTitle: 'Global Tech Conference Keynote',
          correctCount: 4,
          totalQuestions: 5,
        },
      });

      const listeningEvidence = getSkillEvidence('listening');
      expect(listeningEvidence).toHaveLength(1);
      expect(listeningEvidence[0].score).toBe(85);
      expect(listeningEvidence[0].source).toBe('four-skills');
      expect(listeningEvidence[0].cefrDifficulty).toBe('B2');
      expect(listeningEvidence[0].quality).toBe(1.0);

      // Dual-write check
      const legacyScores = useAppStore.getState().fourSkillsScores.listening;
      expect(legacyScores).toEqual([85]);
    });

    it('records TOEIC Listening exam evidence without inventing artificial CEFR difficulty', () => {
      recordSkillEvidence({
        skill: 'listening',
        score: 92,
        source: 'toeic',
        quality: 1.0,
        createdAt: fixedNow,
        metadata: {
          experienceMode: 'full_mock_2skills',
          listeningCorrect: 92,
          listeningTotal: 100,
        },
      });

      const listeningEvidence = getSkillEvidence('listening');
      expect(listeningEvidence).toHaveLength(1);
      expect(listeningEvidence[0].source).toBe('toeic');
      expect(listeningEvidence[0].cefrDifficulty).toBeUndefined(); // Honest: no fake difficulty invented
      expect(listeningEvidence[0].quality).toBe(1.0);
    });

    it('pronunciation mastery and speech practice NEVER increase or contaminate Listening competency', () => {
      // User masters 5 pronunciation words
      useAppStore.getState().recordPronunciationMastered(50);
      useAppStore.getState().recordPronunciationMastered(50);

      // Listening evidence and legacy scores must remain strictly empty
      const listeningEvidence = getSkillEvidence('listening');
      const legacyScores = useAppStore.getState().fourSkillsScores.listening;

      expect(listeningEvidence).toEqual([]);
      expect(legacyScores).toEqual([]);

      const evalResult = evaluateSkillCompetencyV2('listening', listeningEvidence);
      expect(evalResult.isAssessed).toBe(false);
      expect(evalResult.score).toBe(0);
    });
  });

  // =========================================================================
  // 2. READING EVIDENCE & CONTAMINATION GUARDS
  // =========================================================================
  describe('2. Reading Evidence & Contamination Guards', () => {
    it('records valid four-skills reading comprehension quiz evidence with CEFR difficulty', () => {
      recordSkillEvidence({
        skill: 'reading',
        score: 90,
        source: 'four-skills',
        cefrDifficulty: 'C1',
        quality: 1.0,
        createdAt: fixedNow,
        metadata: {
          lessonId: 'read_c1_02',
          lessonTitle: 'Economic Policy Analysis',
          correctCount: 9,
          totalQuestions: 10,
        },
      });

      const readingEvidence = getSkillEvidence('reading');
      expect(readingEvidence).toHaveLength(1);
      expect(readingEvidence[0].score).toBe(90);
      expect(readingEvidence[0].source).toBe('four-skills');
      expect(readingEvidence[0].cefrDifficulty).toBe('C1');
      expect(readingEvidence[0].quality).toBe(1.0);

      // Dual-write check
      const legacyScores = useAppStore.getState().fourSkillsScores.reading;
      expect(legacyScores).toEqual([90]);
    });

    it('records TOEIC Reading exam evidence with proper quality and source', () => {
      recordSkillEvidence({
        skill: 'reading',
        score: 88,
        source: 'toeic',
        quality: 1.0,
        createdAt: fixedNow,
        metadata: {
          experienceMode: 'full_mock_2skills',
          readingCorrect: 88,
          readingTotal: 100,
        },
      });

      const readingEvidence = getSkillEvidence('reading');
      expect(readingEvidence).toHaveLength(1);
      expect(readingEvidence[0].source).toBe('toeic');
      expect(readingEvidence[0].quality).toBe(1.0);
    });

    it('reading encounters, vocabulary lookups, and SRS reviews NEVER contaminate Reading competency', () => {
      // Simulate reading encounters (word telemetry)
      useAppStore.getState().recordReadingEncounters(['resilient', 'paradigm', 'comprehensive'], 'activity_reading_1');

      // Simulate flashcard review in SRS
      useAppStore.getState().recordQuizCompleted(100, true);

      // Reading competency evidence must remain 100% untouched
      const readingEvidence = getSkillEvidence('reading');
      const legacyScores = useAppStore.getState().fourSkillsScores.reading;

      expect(readingEvidence).toEqual([]);
      expect(legacyScores).toEqual([]);

      const evalResult = evaluateSkillCompetencyV2('reading', readingEvidence);
      expect(evalResult.isAssessed).toBe(false);
      expect(evalResult.score).toBe(0);
    });
  });

  // =========================================================================
  // 3. SPEAKING EVIDENCE, QUALITY & C2 SAFEGUARDS
  // =========================================================================
  describe('3. Speaking Evidence, Quality & C2 Safeguards', () => {
    it('records Smart Shadowing evidence with conservative 0.65 quality weighting', () => {
      recordSkillEvidence({
        skill: 'speaking',
        score: 95,
        source: 'shadowing',
        cefrDifficulty: 'B2',
        quality: 0.65, // Conservative quality weighting
        createdAt: fixedNow,
        metadata: {
          sentence: 'Despite facing significant challenges, our dedicated team achieved remarkable results.',
          fluencyScore: 90,
          transcript: 'Despite facing significant challenges our dedicated team achieved remarkable results',
        },
      });

      const speakingEvidence = getSkillEvidence('speaking');
      expect(speakingEvidence).toHaveLength(1);
      expect(speakingEvidence[0].source).toBe('shadowing');
      expect(speakingEvidence[0].quality).toBe(0.65);
      expect(speakingEvidence[0].score).toBe(95);

      // Dual-write check
      expect(useAppStore.getState().fourSkillsScores.speaking).toEqual([95]);
    });

    it('records Four Skills roleplay dialogue with 0.85 quality weighting', () => {
      recordSkillEvidence({
        skill: 'speaking',
        score: 82,
        source: 'four-skills',
        cefrDifficulty: 'B1',
        quality: 0.85,
        createdAt: fixedNow,
        metadata: {
          promptId: 'spk_b1_03',
          promptTitle: 'Hotel Check-in Dialogue',
          turnCount: 3,
        },
      });

      const speakingEvidence = getSkillEvidence('speaking');
      expect(speakingEvidence).toHaveLength(1);
      expect(speakingEvidence[0].source).toBe('four-skills');
      expect(speakingEvidence[0].quality).toBe(0.85);
    });

    it('SHADOWING-ONLY CANNOT PROMOTE TO C2 SPEAKING: 12 perfect scores on C1 sentences are capped at C1', () => {
      // User completed 12 perfect shadowing attempts on C1 sentences
      const shadowingOnlyHistory: CompetencyEvidence[] = Array.from({ length: 12 }, (_, i) => ({
        id: `sh_c1_${i}`,
        skill: 'speaking',
        score: 100,
        source: 'shadowing',
        cefrDifficulty: 'C1',
        quality: 0.65,
        createdAt: fixedNow - i * 86_400_000,
        metadata: { sentence: `Advanced C1 speech sentence ${i}` },
      }));

      const evaluation = evaluateSkillCompetencyV2('speaking', shadowingOnlyHistory, { now: fixedNow });

      // Invariant: User CANNOT reach C2 Speaking from shadowing alone
      expect(evaluation.level).not.toBe('C2');
      expect(evaluation.level).toBe('C1');
      expect(evaluation.debugExplanation.promotionCapped).toBe(true);
      expect(evaluation.debugExplanation.promotionCapReason).toContain('shadowing repetition alone is capped at C1');
    });

    it('unblocks C2 Speaking when standardized or interactive spoken evidence (TOEIC / roleplay) is demonstrated', () => {
      // 10 high-level shadowing attempts + 2 high-level TOEIC Speaking exams
      const mixedHistory: CompetencyEvidence[] = [
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `sh_c1_${i}`,
          skill: 'speaking' as const,
          score: 98,
          source: 'shadowing' as const,
          cefrDifficulty: 'C1' as const,
          quality: 0.65,
          createdAt: fixedNow - (i + 2) * 86_400_000,
        })),
        {
          id: 'spk_toeic_1',
          skill: 'speaking' as const,
          score: 98,
          source: 'toeic' as const,
          cefrDifficulty: 'C1' as const,
          quality: 1.0,
          createdAt: fixedNow - 86_400_000,
        },
        {
          id: 'spk_toeic_2',
          skill: 'speaking' as const,
          score: 98,
          source: 'toeic' as const,
          cefrDifficulty: 'C1' as const,
          quality: 1.0,
          createdAt: fixedNow,
        },
      ];

      const evaluation = evaluateSkillCompetencyV2('speaking', mixedHistory, { now: fixedNow });
      // With standardized TOEIC evidence present, C2 Speaking is permitted
      expect(evaluation.level).toBe('C2');
    });

    it('Web Speech technical failures / null recognition never create score 0 evidence', () => {
      // Attempting to record invalid technical errors should be rejected by validator
      recordSkillEvidence({
        skill: 'speaking',
        score: NaN,
        source: 'shadowing',
      });
      recordSkillEvidence({
        skill: 'speaking',
        score: null as any,
        source: 'shadowing',
      });

      const speakingEvidence = getSkillEvidence('speaking');
      expect(speakingEvidence).toHaveLength(0);
    });
  });

  // =========================================================================
  // 4. WRITING EVIDENCE: AI VS OFFLINE & DEDUPLICATION
  // =========================================================================
  describe('4. Writing Evidence: AI vs Offline & Deduplication', () => {
    it('records Gemini AI evaluation with source writing-ai and quality 1.0', () => {
      recordSkillEvidence({
        skill: 'writing',
        score: 86,
        source: 'writing-ai',
        cefrDifficulty: 'B2',
        quality: 1.0,
        createdAt: fixedNow,
        metadata: {
          wordCount: 185,
          isFallback: false,
          promptId: 'wrt_01',
        },
      });

      const writingEvidence = getSkillEvidence('writing');
      expect(writingEvidence).toHaveLength(1);
      expect(writingEvidence[0].source).toBe('writing-ai');
      expect(writingEvidence[0].quality).toBe(1.0);
      expect(writingEvidence[0].cefrDifficulty).toBe('B2');
    });

    it('records offline rule-based heuristic fallback with source writing-offline and quality 0.65', () => {
      recordSkillEvidence({
        skill: 'writing',
        score: 72,
        source: 'writing-offline',
        cefrDifficulty: 'B1',
        quality: 0.65, // Explicitly degraded quality weight for offline heuristic
        createdAt: fixedNow,
        metadata: {
          wordCount: 120,
          isFallback: true,
          promptId: 'wrt_02',
        },
      });

      const writingEvidence = getSkillEvidence('writing');
      expect(writingEvidence).toHaveLength(1);
      expect(writingEvidence[0].source).toBe('writing-offline');
      expect(writingEvidence[0].quality).toBe(0.65);
      expect(writingEvidence[0].cefrDifficulty).toBe('B1');
    });

    it('single essay submission does NOT double record duplicate evidence', () => {
      const evidencePayload = {
        id: 'wrt_submission_unique_001',
        skill: 'writing' as const,
        score: 80,
        source: 'writing-ai' as const,
        cefrDifficulty: 'B2' as const,
        quality: 1.0,
        createdAt: fixedNow,
        metadata: { wordCount: 150 },
      };

      // Call twice with the same deterministic submission ID (e.g. rapid double clicks)
      recordSkillEvidence(evidencePayload);
      recordSkillEvidence(evidencePayload);

      const writingEvidence = getSkillEvidence('writing');
      expect(writingEvidence).toHaveLength(1);
      expect(writingEvidence[0].id).toBe('wrt_submission_unique_001');
    });
  });

  // =========================================================================
  // 5. CROSS-SKILL ISOLATION & DUAL-WRITE
  // =========================================================================
  describe('5. Cross-Skill Isolation & Dual-Write', () => {
    it('recording evidence for one skill never modifies or contaminates other skills', () => {
      recordSkillEvidence({
        skill: 'listening',
        score: 85,
        source: 'four-skills',
        cefrDifficulty: 'B2',
      });

      const store = getFourSkillsEvidenceStore();
      expect(store.listening).toHaveLength(1);
      expect(store.reading).toHaveLength(0);
      expect(store.speaking).toHaveLength(0);
      expect(store.writing).toHaveLength(0);

      const legacyScores = useAppStore.getState().fourSkillsScores;
      expect(legacyScores.listening).toHaveLength(1);
      expect(legacyScores.reading).toHaveLength(0);
      expect(legacyScores.speaking).toHaveLength(0);
      expect(legacyScores.writing).toHaveLength(0);
    });

    it('legacy recordSkillScore creates a corresponding legacy evidence entry', () => {
      recordSkillScore('reading', 78);

      const readingEvidence = getSkillEvidence('reading');
      expect(readingEvidence).toHaveLength(1);
      expect(readingEvidence[0].score).toBe(78);
      expect(readingEvidence[0].source).toBe('legacy');

      const legacyScores = useAppStore.getState().fourSkillsScores.reading;
      expect(legacyScores).toEqual([78]);
    });

    it('clearAllSkillsData resets both legacy scores and evidence stores', () => {
      recordSkillEvidence({ skill: 'listening', score: 90, source: 'four-skills' });
      recordSkillEvidence({ skill: 'reading', score: 85, source: 'four-skills' });
      recordSkillEvidence({ skill: 'speaking', score: 80, source: 'shadowing', quality: 0.65 });
      recordSkillEvidence({ skill: 'writing', score: 75, source: 'writing-ai' });

      clearAllSkillsData();

      const store = getFourSkillsEvidenceStore();
      expect(store).toEqual(EMPTY_FOUR_SKILLS_EVIDENCE);

      const legacyScores = useAppStore.getState().fourSkillsScores;
      expect(legacyScores.listening).toHaveLength(0);
      expect(legacyScores.reading).toHaveLength(0);
      expect(legacyScores.speaking).toHaveLength(0);
      expect(legacyScores.writing).toHaveLength(0);
    });
  });

  // =========================================================================
  // 6. BACKUP & REHYDRATION COMPATIBILITY
  // =========================================================================
  describe('6. Backup & Rehydration Compatibility', () => {
    it('exportBackupData includes fourSkillsEvidence and importBackupData restores it', () => {
      recordSkillEvidence({
        id: 'ev_listen_backup',
        skill: 'listening',
        score: 88,
        source: 'four-skills',
        cefrDifficulty: 'B2',
      });
      recordSkillEvidence({
        id: 'ev_write_backup',
        skill: 'writing',
        score: 91,
        source: 'writing-ai',
        cefrDifficulty: 'C1',
      });

      const backupJson = useAppStore.getState().exportBackupData();
      expect(backupJson).toContain('fourSkillsEvidence');

      // Clear store
      clearAllSkillsData();
      expect(getSkillEvidence('listening')).toHaveLength(0);

      // Restore backup
      const importResult = useAppStore.getState().importBackupData(backupJson);
      expect(importResult.success).toBe(true);

      const restoredListening = getSkillEvidence('listening');
      const restoredWriting = getSkillEvidence('writing');

      expect(restoredListening).toHaveLength(1);
      expect(restoredListening[0].id).toBe('ev_listen_backup');
      expect(restoredListening[0].score).toBe(88);

      expect(restoredWriting).toHaveLength(1);
      expect(restoredWriting[0].id).toBe('ev_write_backup');
      expect(restoredWriting[0].score).toBe(91);
    });

    it('importBackupData from legacy backup (scores only, no evidence) backfills evidence safely', () => {
      const legacyBackupObj = {
        profile: { name: 'Legacy Learner', level: 2, xp: 200, streak: 3 },
        fourSkillsScores: {
          listening: [80, 85],
          reading: [90],
          speaking: [75],
          writing: [82],
        },
      };

      const res = useAppStore.getState().importBackupData(JSON.stringify(legacyBackupObj));
      expect(res.success).toBe(true);

      const store = getFourSkillsEvidenceStore();
      expect(store.listening).toHaveLength(2);
      expect(store.listening[0].source).toBe('legacy');
      expect(store.reading).toHaveLength(1);
      expect(store.speaking).toHaveLength(1);
      expect(store.writing).toHaveLength(1);
    });
  });

  // =========================================================================
  // 7. UNIFIED EVALUATION ENGINE V2 INTEGRATION
  // =========================================================================
  describe('7. Unified Evaluation Engine v2 Integration', () => {
    it('evaluates complete Four Skills Competency v2 across all 4 skills', () => {
      recordSkillEvidence({ skill: 'listening', score: 85, source: 'four-skills', cefrDifficulty: 'B2', quality: 1.0 });
      recordSkillEvidence({ skill: 'reading', score: 92, source: 'toeic', quality: 1.0 });
      recordSkillEvidence({ skill: 'speaking', score: 80, source: 'shadowing', quality: 0.65 });
      recordSkillEvidence({ skill: 'writing', score: 88, source: 'writing-ai', cefrDifficulty: 'B2', quality: 1.0 });

      const evaluation = evaluateFourSkillsCompetencyV2({
        word_1: { srsLevel: 2, interval: 4 },
        word_2: { srsLevel: 1, interval: 1 },
      });

      expect(evaluation.listening.isAssessed).toBe(true);
      expect(evaluation.reading.isAssessed).toBe(true);
      expect(evaluation.speaking.isAssessed).toBe(true);
      expect(evaluation.writing.isAssessed).toBe(true);
      expect(evaluation.accumulatedCoreWords).toBe(2);
    });

    it('handles empty state without crashes or false competencies', () => {
      const evaluation = evaluateFourSkillsCompetencyV2({});

      expect(evaluation.listening.isAssessed).toBe(false);
      expect(evaluation.listening.score).toBe(0);
      expect(evaluation.listening.level).toBe('A1');
      expect(evaluation.listening.confidence).toBe(0);

      expect(evaluation.reading.isAssessed).toBe(false);
      expect(evaluation.speaking.isAssessed).toBe(false);
      expect(evaluation.writing.isAssessed).toBe(false);
      expect(evaluation.accumulatedCoreWords).toBe(0);
    });
  });
});
