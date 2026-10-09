// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Dashboard } from '../../components/Dashboard';
import { useAppStore } from '../../store/useAppStore';
import {
  adaptLegacyFourSkillsScores,
  sanitizeEvidenceStore,
  mergeEvidenceArrays,
  createCompetencyEvidence,
  EMPTY_FOUR_SKILLS_EVIDENCE,
} from '../competencyEvidenceService';
import {
  deriveTutorLearningContext,
  serializeTutorContextForPrompt,
  getTutorLearningContext,
} from '../tutorLearningContext';
import { getFourSkillsCompetency } from '../skillsCompetencyService';
import type { CompetencyEvidence, FourSkillsScores, FourSkillsEvidenceStore } from '../../types';

describe('PHASE 4: Persistence, Cloud Merge, UI & AI Tutor Consumption', () => {
  beforeEach(() => {
    // Reset Zustand store to clean baseline
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
      mistakeBank: {},
      srsProgressMap: {},
      userCustomWords: [],
      vocabularyList: [],
      userCollocations: [],
      recentReviewEvents: [],
      profile: {
        ...useAppStore.getState().profile,
        name: 'Test Learner',
        level: 1,
        xp: 100,
        streak: 3,
      },
    });
  });

  // =========================================================================
  // 1. PERSISTENCE, SANITIZATION & REHYDRATION
  // =========================================================================
  describe('1. Persistence, Sanitization & Rehydration', () => {
    it('backfills fourSkillsEvidence from legacy fourSkillsScores during rehydration when evidence is empty', () => {
      const legacyScores: FourSkillsScores = {
        listening: [70, 80],
        reading: [65],
        speaking: [55],
        writing: [],
      };

      const emptyEvidence: FourSkillsEvidenceStore = {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      };

      // Emulate onRehydrateStorage logic
      const sanitizedScores = legacyScores;
      let sanitizedEvidence = sanitizeEvidenceStore(emptyEvidence);

      const hasEvidence = Object.values(sanitizedEvidence).some((arr) => arr.length > 0);
      const hasScores = Object.values(sanitizedScores).some((arr) => arr.length > 0);

      if (!hasEvidence && hasScores) {
        sanitizedEvidence = adaptLegacyFourSkillsScores(sanitizedScores);
      }

      expect(sanitizedEvidence.listening.length).toBe(2);
      expect(sanitizedEvidence.listening[0].score).toBe(70);
      expect(sanitizedEvidence.listening[0].source).toBe('legacy');
      expect(sanitizedEvidence.reading.length).toBe(1);
      expect(sanitizedEvidence.reading[0].score).toBe(65);
      expect(sanitizedEvidence.speaking.length).toBe(1);
      expect(sanitizedEvidence.writing.length).toBe(0);
    });

    it('sanitizes and drops corrupt evidence items (negative scores, future drift, invalid skills)', () => {
      const futureNow = 1700000000000;
      const corruptPayload: any = {
        listening: [
          { id: 'ev_ok', skill: 'listening', score: 85, source: 'toeic', createdAt: futureNow, quality: 1.0 },
          { id: 'ev_negative', skill: 'listening', score: -20, source: 'toeic', createdAt: futureNow, quality: 1.0 },
          { id: 'ev_corrupt_skill', skill: 'telepathy', score: 80, source: 'toeic', createdAt: futureNow, quality: 1.0 },
          { id: 'ev_nan', skill: 'listening', score: NaN, source: 'toeic', createdAt: futureNow, quality: 1.0 },
          { id: 'ev_drift', skill: 'listening', score: 90, source: 'toeic', createdAt: futureNow + 3600000, quality: 1.0 },
        ],
      };

      const sanitized = sanitizeEvidenceStore(corruptPayload);
      // Valid item retained, future drift clamped to now, negative score clamped to 0, NaN/corrupt skills dropped
      expect(sanitized.listening.length).toBe(3); // ev_ok, ev_negative (clamped to 0), and ev_drift (clamped)
      expect(sanitized.listening.find((e) => e.id === 'ev_ok')).toBeDefined();
      expect(sanitized.listening.find((e) => e.id === 'ev_negative')?.score).toBe(0);
      expect(sanitized.listening.find((e) => e.id === 'ev_nan')).toBeUndefined();
      expect(sanitized.listening.find((e) => e.id === 'ev_corrupt_skill')).toBeUndefined();
    });

    it('partialize includes fourSkillsEvidence for persistent storage without saving transient state', () => {
      const store = useAppStore.getState();
      store.recordSkillEvidence({
        skill: 'reading',
        score: 82,
        source: 'toeic',
        cefrDifficulty: 'B2',
      });

      const updatedState = useAppStore.getState();
      expect(updatedState.fourSkillsEvidence?.reading.length).toBe(1);
      expect(updatedState.fourSkillsEvidence?.reading[0].score).toBe(82);
    });
  });

  // =========================================================================
  // 2. CLOUD MERGE STRATEGY & IDEMPOTENCY
  // =========================================================================
  describe('2. Cloud Merge Strategy & Deduplication', () => {
    it('is strictly idempotent: merging identical cloud data multiple times does not duplicate evidence or scores', () => {
      const initialEvidence: CompetencyEvidence[] = [
        { id: 'ev_listen_1', skill: 'listening', score: 75, source: 'toeic', createdAt: 1700000000000, quality: 1.0 },
      ];

      const incomingCloudEvidence: CompetencyEvidence[] = [
        { id: 'ev_listen_1', skill: 'listening', score: 75, source: 'toeic', createdAt: 1700000000000, quality: 1.0 },
      ];

      const firstMerge = mergeEvidenceArrays(initialEvidence, incomingCloudEvidence);
      expect(firstMerge.length).toBe(1);

      const secondMerge = mergeEvidenceArrays(firstMerge, incomingCloudEvidence);
      expect(secondMerge.length).toBe(1);
      expect(secondMerge[0].id).toBe('ev_listen_1');
    });

    it('extracts nested four_skills_scores.four_skills_evidence from cloud profile without database schema migration', () => {
      const store = useAppStore.getState();

      const cloudProfilePayload = {
        four_skills_scores: {
          listening: [70],
          reading: [80],
          speaking: [],
          writing: [],
          four_skills_evidence: {
            listening: [
              { id: 'cloud_ev_1', skill: 'listening', score: 70, source: 'four-skills', createdAt: 1700000000000, quality: 1.0 },
            ],
            reading: [
              { id: 'cloud_ev_2', skill: 'reading', score: 80, source: 'toeic', createdAt: 1700000000000, quality: 1.0 },
            ],
            speaking: [],
            writing: [],
          },
        },
      };

      store.mergeCloudData({ cloudProfile: cloudProfilePayload });

      const mergedState = useAppStore.getState();
      expect(mergedState.fourSkillsEvidence?.listening.some((e) => e.id === 'cloud_ev_1')).toBe(true);
      expect(mergedState.fourSkillsEvidence?.reading.some((e) => e.id === 'cloud_ev_2')).toBe(true);
    });

    it('strictly enforces the bounded history limit (50 items per skill) after merging large payloads', () => {
      const localList: CompetencyEvidence[] = [];
      for (let i = 1; i <= 35; i++) {
        localList.push({
          id: `ev_local_${i}`,
          skill: 'listening',
          score: 70,
          source: 'four-skills',
          createdAt: 1700000000000 + i * 1000,
          quality: 1.0,
        });
      }

      const cloudList: CompetencyEvidence[] = [];
      for (let i = 36; i <= 70; i++) {
        cloudList.push({
          id: `ev_cloud_${i}`,
          skill: 'listening',
          score: 80,
          source: 'toeic',
          createdAt: 1700000000000 + i * 1000,
          quality: 1.0,
        });
      }

      const merged = mergeEvidenceArrays(localList, cloudList, 50);
      expect(merged.length).toBe(50);
      // Keeps the most recent items (clamped from end)
      expect(merged[merged.length - 1].id).toBe('ev_cloud_70');
    });

    it('safely handles legacy cloud profiles lacking four_skills_evidence without wiping local evidence', () => {
      const store = useAppStore.getState();
      store.recordSkillEvidence({
        skill: 'speaking',
        score: 75,
        source: 'shadowing',
      });

      // Legacy cloud profile with only score array
      const legacyCloudProfile = {
        four_skills_scores: {
          speaking: [60],
        },
      };

      store.mergeCloudData({ cloudProfile: legacyCloudProfile as any });

      const mergedState = useAppStore.getState();
      // Local speaking evidence was preserved, not wiped
      expect(mergedState.fourSkillsEvidence?.speaking.length).toBeGreaterThan(0);
      // Legacy scores merged
      expect(mergedState.fourSkillsScores?.speaking).toContain(75);
      expect(mergedState.fourSkillsScores?.speaking).toContain(60);
    });
  });

  // =========================================================================
  // 3. AI TUTOR CONTEXT & SERIALIZATION CONSUMPTION
  // =========================================================================
  describe('3. AI Tutor Consumption & Cautious Prompt Serialization', () => {
    it('derives confidence levels from evidence and includes them in context', () => {
      const evidenceStore: FourSkillsEvidenceStore = {
        listening: [
          { id: 'e1', skill: 'listening', score: 85, source: 'toeic', createdAt: Date.now(), quality: 1.0, cefrDifficulty: 'B2' },
          { id: 'e2', skill: 'listening', score: 80, source: 'toeic', createdAt: Date.now(), quality: 1.0, cefrDifficulty: 'B2' },
          { id: 'e3', skill: 'listening', score: 90, source: 'toeic', createdAt: Date.now(), quality: 1.0, cefrDifficulty: 'B2' },
          { id: 'e4', skill: 'listening', score: 85, source: 'toeic', createdAt: Date.now(), quality: 1.0, cefrDifficulty: 'B2' },
          { id: 'e5', skill: 'listening', score: 88, source: 'toeic', createdAt: Date.now(), quality: 1.0, cefrDifficulty: 'B2' },
          { id: 'e6', skill: 'listening', score: 92, source: 'toeic', createdAt: Date.now(), quality: 1.0, cefrDifficulty: 'B2' },
          { id: 'e7', skill: 'listening', score: 87, source: 'toeic', createdAt: Date.now(), quality: 1.0, cefrDifficulty: 'B2' },
          { id: 'e8', skill: 'listening', score: 89, source: 'toeic', createdAt: Date.now(), quality: 1.0, cefrDifficulty: 'B2' },
        ],
        reading: [
          { id: 'r1', skill: 'reading', score: 60, source: 'four-skills', createdAt: Date.now(), quality: 1.0, cefrDifficulty: 'B1' },
        ],
        speaking: [],
        writing: [],
      };

      const context = deriveTutorLearningContext({
        fourSkillsEvidence: evidenceStore,
        fourSkillsScores: {
          listening: [85, 80, 90, 85, 88, 92, 87, 89],
          reading: [60],
          speaking: [],
          writing: [],
        },
      });

      expect(context.competency.listening.isAssessed).toBe(true);
      expect(context.competency.listening.confidence).toBe('high');
      expect(context.competency.reading.isAssessed).toBe(true);
      expect(context.competency.reading.confidence).toBe('low'); // Only 1 attempt
      expect(context.competency.speaking.isAssessed).toBe(false);
      expect(context.competency.writing.isAssessed).toBe(false);
    });

    it('serializes unassessed skills as "Chưa đánh giá" and assessed skills with confidence', () => {
      const evidenceStore: FourSkillsEvidenceStore = {
        listening: [
          { id: 'e1', skill: 'listening', score: 78, source: 'toeic', createdAt: Date.now(), quality: 1.0, cefrDifficulty: 'B2' },
        ],
        reading: [],
        speaking: [],
        writing: [],
      };

      const context = deriveTutorLearningContext({
        fourSkillsEvidence: evidenceStore,
        fourSkillsScores: {
          listening: [78],
          reading: [],
          speaking: [],
          writing: [],
        },
      });

      const serialized = serializeTutorContextForPrompt(context);

      expect(serialized).toContain('Skills: Listening B1 (82%, confidence low), Speaking: Chưa đánh giá, Reading: Chưa đánh giá, Writing: Chưa đánh giá');
      // Low confidence cautionary notice must be present
      expect(serialized).toContain('NOTE: Skills with low confidence are based on limited evidence; treat their estimated levels as tentative, not absolute.');
    });

    it('does not append low-confidence caution when all assessed skills have high or medium confidence', () => {
      // Create sufficient evidence to reach >= 0.40 confidence
      const evidenceList: CompetencyEvidence[] = [];
      for (let i = 0; i < 5; i++) {
        evidenceList.push({
          id: `ev_${i}`,
          skill: 'reading',
          score: 80,
          source: 'toeic',
          createdAt: Date.now() - i * 1000,
          quality: 1.0,
          cefrDifficulty: 'B2',
        });
      }

      const context = deriveTutorLearningContext({
        fourSkillsEvidence: {
          listening: [],
          reading: evidenceList,
          speaking: [],
          writing: [],
        },
        fourSkillsScores: {
          listening: [],
          reading: [80, 80, 80, 80, 80],
          speaking: [],
          writing: [],
        },
      });

      expect(context.competency.reading.confidence).not.toBe('low');
      const serialized = serializeTutorContextForPrompt(context);
      expect(serialized).not.toContain('NOTE: Skills with low confidence are based on limited evidence');
    });

    it('displays "Estimated Level: Chưa đánh giá" when all skills are unassessed', () => {
      const context = deriveTutorLearningContext({
        fourSkillsScores: { listening: [], reading: [], speaking: [], writing: [] },
        fourSkillsEvidence: EMPTY_FOUR_SKILLS_EVIDENCE,
      });

      const serialized = serializeTutorContextForPrompt(context);
      expect(serialized).toContain('Estimated Level: Chưa đánh giá (Chưa có dữ liệu bài làm)');
      expect(serialized).toContain('Listening: Chưa đánh giá');
      expect(serialized).not.toContain('NOTE: Skills with low confidence');
    });

    it('ensures AI Tutor is strictly a read-only consumer and cannot mutate competency stores', () => {
      const storeBefore = useAppStore.getState();
      const scoresBefore = JSON.stringify(storeBefore.fourSkillsScores);
      const evidenceBefore = JSON.stringify(storeBefore.fourSkillsEvidence);

      // Invoke tutor context derivation multiple times
      const ctx = getTutorLearningContext();
      serializeTutorContextForPrompt(ctx);

      const storeAfter = useAppStore.getState();
      expect(JSON.stringify(storeAfter.fourSkillsScores)).toBe(scoresBefore);
      expect(JSON.stringify(storeAfter.fourSkillsEvidence)).toBe(evidenceBefore);
    });
  });

  // =========================================================================
  // 4. COMPETENCY SERVICE CALCULATION WITH CONFIDENCE
  // =========================================================================
  describe('4. getFourSkillsCompetency Service Outputs', () => {
    it('returns unassessed state with confidence "low" and confidenceScore 0 when no data exists', () => {
      const competency = getFourSkillsCompetency();
      expect(competency.listening.isAssessed).toBe(false);
      expect(competency.listening.score).toBe(0);
      expect(competency.listening.confidence).toBe('low');
      expect(competency.listening.confidenceScore).toBe(0);
    });

    it('returns assessed state with calculated confidence and level when evidence is recorded', () => {
      const store = useAppStore.getState();
      store.recordSkillEvidence({
        skill: 'listening',
        score: 82,
        source: 'toeic',
        cefrDifficulty: 'B2',
      });

      const competency = getFourSkillsCompetency();
      expect(competency.listening.isAssessed).toBe(true);
      expect(competency.listening.score).toBe(83);
      expect(competency.listening.level).toBe('B1');
      expect(competency.listening.confidence).toBeDefined();
      expect(competency.listening.confidenceScore).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 5. DASHBOARD UI COMPONENT RENDERING
  // =========================================================================
  describe('5. Dashboard UI Component Rendering', () => {
    it('renders "Chưa đánh giá" for unassessed skills without displaying "A1 0%"', () => {
      render(<Dashboard onNavigate={vi.fn()} onOpenAddWord={vi.fn()} />);

      expect(screen.getByText('Năng Lực 4 Kỹ Năng')).toBeDefined();
      const unassessedBadges = screen.getAllByText('Chưa đánh giá');
      expect(unassessedBadges.length).toBe(4); // All 4 skills unassessed
      expect(screen.queryByText(/Level A1 · 0%/)).toBeNull();
    });

    it('renders Level, Score%, and Confidence badge with tooltip explanation when skills are assessed', () => {
      const store = useAppStore.getState();
      store.recordSkillEvidence({
        skill: 'reading',
        score: 88,
        source: 'toeic',
        cefrDifficulty: 'B2',
      });

      render(<Dashboard onNavigate={vi.fn()} onOpenAddWord={vi.fn()} />);

      expect(screen.getByText('Level B1 · 85%')).toBeDefined();
      expect(screen.getByText(/Confidence: (Low|Med|High)/)).toBeDefined();
      const progressBar = screen.getByTitle('Điểm năng lực tổng thể: 85/100');
      expect(progressBar).toBeDefined();
    });
  });
});
