// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  validateAndNormalizeEvidence,
  adaptLegacyScoreToEvidence,
  adaptLegacyScoresToEvidence,
  adaptLegacyFourSkillsScores,
  deduplicateEvidence,
  boundEvidenceHistory,
  mergeEvidenceArrays,
  sanitizeEvidenceStore,
  createCompetencyEvidence,
  DEFAULT_MAX_EVIDENCE_PER_SKILL,
} from '../competencyEvidenceService';
import type { CompetencyEvidence } from '../../types/competencyEvidence';

describe('PHASE 1 — Four Skills Competency Model v2 Evidence Foundation Suite', () => {
  const fixedNow = 1700000000000;

  // =========================================================================
  // 1. LEGACY ADAPTER & CONVERSION TRUTH
  // =========================================================================
  describe('1. Legacy Adapter & Truth Preservation', () => {
    it('adapts single legacy score to CompetencyEvidence with neutral metadata and no fake CEFR', () => {
      const evidence = adaptLegacyScoreToEvidence('listening', 85, 0);

      expect(evidence).not.toBeNull();
      expect(evidence?.skill).toBe('listening');
      expect(evidence?.score).toBe(85);
      expect(evidence?.source).toBe('legacy');
      expect(evidence?.cefrDifficulty).toBeUndefined(); // MUST NOT invent fake CEFR level
      expect(evidence?.createdAt).toBe(0); // 0 explicitly represents unknown legacy timestamp
      expect(evidence?.quality).toBe(1.0); // Neutral standard weighting
      expect(evidence?.id).toBe('legacy_listening_0_85');
    });

    it('adapts legacy score array and filters out corrupted non-numeric items', () => {
      const rawScores = [70, NaN, 85, Infinity, -10, 110];
      const evidenceList = adaptLegacyScoresToEvidence('reading', rawScores as any);

      expect(evidenceList.length).toBe(4); // NaN and Infinity rejected
      expect(evidenceList[0].score).toBe(70);
      expect(evidenceList[1].score).toBe(85);
      expect(evidenceList[2].score).toBe(0); // -10 clamped to 0
      expect(evidenceList[3].score).toBe(100); // 110 clamped to 100
      expect(evidenceList.every((e) => e.source === 'legacy')).toBe(true);
      expect(evidenceList.every((e) => e.cefrDifficulty === undefined)).toBe(true);
    });

    it('adapts full legacy FourSkillsScores object safely', () => {
      const legacyScores = {
        listening: [80, 90],
        reading: [85],
        speaking: [],
        writing: [75],
      };

      const store = adaptLegacyFourSkillsScores(legacyScores);
      expect(store.listening.length).toBe(2);
      expect(store.reading.length).toBe(1);
      expect(store.speaking.length).toBe(0);
      expect(store.writing.length).toBe(1);
      expect(store.writing[0].score).toBe(75);
    });

    it('gracefully handles null or undefined legacy store without throwing', () => {
      const storeNull = adaptLegacyFourSkillsScores(null);
      expect(storeNull.listening).toEqual([]);
      expect(storeNull.reading).toEqual([]);
      expect(storeNull.speaking).toEqual([]);
      expect(storeNull.writing).toEqual([]);

      const storeUndefined = adaptLegacyFourSkillsScores(undefined);
      expect(storeUndefined.listening).toEqual([]);
    });
  });

  // =========================================================================
  // 2. EVIDENCE VALIDATION & NORMALIZATION
  // =========================================================================
  describe('2. Evidence Validation & Normalization Rules', () => {
    it('validates and normalizes well-formed evidence', () => {
      const raw = {
        id: 'test_123',
        skill: 'writing',
        score: 88.4,
        source: 'writing-ai',
        cefrDifficulty: 'B2',
        createdAt: fixedNow,
        quality: 0.95,
        metadata: { promptId: 'wp_b2_1', wordCount: 220 },
      };

      const normalized = validateAndNormalizeEvidence(raw, { now: fixedNow });
      expect(normalized).not.toBeNull();
      expect(normalized?.id).toBe('test_123');
      expect(normalized?.skill).toBe('writing');
      expect(normalized?.score).toBe(88); // Rounded
      expect(normalized?.source).toBe('writing-ai');
      expect(normalized?.cefrDifficulty).toBe('B2');
      expect(normalized?.createdAt).toBe(fixedNow);
      expect(normalized?.quality).toBe(0.95);
      expect(normalized?.metadata).toEqual({ promptId: 'wp_b2_1', wordCount: 220 });
    });

    it('rejects invalid or corrupted scores (NaN, Infinity, non-numeric)', () => {
      expect(validateAndNormalizeEvidence({ skill: 'listening', score: NaN, source: 'four-skills' })).toBeNull();
      expect(validateAndNormalizeEvidence({ skill: 'listening', score: Infinity, source: 'four-skills' })).toBeNull();
      expect(validateAndNormalizeEvidence({ skill: 'listening', score: '90', source: 'four-skills' })).toBeNull();
      expect(validateAndNormalizeEvidence({ skill: 'listening', score: null, source: 'four-skills' })).toBeNull();
      expect(validateAndNormalizeEvidence({ skill: 'listening', score: undefined, source: 'four-skills' })).toBeNull();
    });

    it('clamps scores below 0 or above 100', () => {
      const below = validateAndNormalizeEvidence(
        { skill: 'speaking', score: -30, source: 'shadowing' },
        { now: fixedNow }
      );
      expect(below?.score).toBe(0);

      const above = validateAndNormalizeEvidence(
        { skill: 'speaking', score: 150, source: 'shadowing' },
        { now: fixedNow }
      );
      expect(above?.score).toBe(100);
    });

    it('rejects invalid skill or unknown source', () => {
      // Invalid skill
      expect(validateAndNormalizeEvidence({ skill: 'math', score: 80, source: 'toeic' })).toBeNull();
      // Unknown source
      expect(validateAndNormalizeEvidence({ skill: 'reading', score: 80, source: 'unknown_source' })).toBeNull();
      // Empty input
      expect(validateAndNormalizeEvidence(null)).toBeNull();
      expect(validateAndNormalizeEvidence('not an object')).toBeNull();
    });

    it('normalizes invalid CEFR difficulty to undefined without inventing false level', () => {
      const itemWithGarbageCefr = validateAndNormalizeEvidence(
        { skill: 'listening', score: 80, source: 'four-skills', cefrDifficulty: 'B3_invalid' as any },
        { now: fixedNow }
      );
      expect(itemWithGarbageCefr?.cefrDifficulty).toBeUndefined();
    });

    it('clamps future timestamps beyond allowable drift to now', () => {
      const farFuture = fixedNow + 86400000; // 1 day into future
      const item = validateAndNormalizeEvidence(
        { skill: 'listening', score: 80, source: 'four-skills', createdAt: farFuture },
        { now: fixedNow, maxFutureDriftMs: 60000 }
      );
      expect(item?.createdAt).toBe(fixedNow);
    });

    it('handles negative or invalid createdAt by defaulting to now (except legacy 0)', () => {
      const itemNegative = validateAndNormalizeEvidence(
        { skill: 'reading', score: 75, source: 'four-skills', createdAt: -500 },
        { now: fixedNow }
      );
      expect(itemNegative?.createdAt).toBe(fixedNow);

      const legacyZero = validateAndNormalizeEvidence(
        { skill: 'reading', score: 75, source: 'legacy', createdAt: 0 },
        { now: fixedNow }
      );
      expect(legacyZero?.createdAt).toBe(0);
    });

    it('generates deterministic id when id is missing or blank', () => {
      const item = validateAndNormalizeEvidence(
        { skill: 'speaking', score: 85, source: 'toeic', createdAt: fixedNow },
        { now: fixedNow }
      );
      expect(item?.id).toBe(`ev_speaking_toeic_${fixedNow}_85`);
    });
  });

  // =========================================================================
  // 3. TECHNICAL FAILURE IMMUNITY
  // =========================================================================
  describe('3. Technical Failure Immunity', () => {
    it('technical failure or malformed payload does NOT create evidence', () => {
      // Technical failure simulation: Web Speech recognition failed, threw error, null result passed
      const failedPayload = null;
      expect(createCompetencyEvidence(failedPayload as any)).toBeNull();

      // Technical failure simulation: network error resulted in NaN
      const netErrorPayload = {
        skill: 'writing' as const,
        score: NaN,
        source: 'writing-ai' as const,
      };
      expect(createCompetencyEvidence(netErrorPayload)).toBeNull();
    });
  });

  // =========================================================================
  // 4. DEDUPLICATION & BOUNDED HISTORY
  // =========================================================================
  describe('4. Deduplication & Bounded History Rules', () => {
    it('deduplicateEvidence preserves unique IDs and discards duplicates', () => {
      const list: CompetencyEvidence[] = [
        { id: 'ev_1', skill: 'listening', score: 80, source: 'four-skills', createdAt: 100 },
        { id: 'ev_2', skill: 'listening', score: 85, source: 'four-skills', createdAt: 200 },
        { id: 'ev_1', skill: 'listening', score: 80, source: 'four-skills', createdAt: 100 }, // Duplicate
      ];

      const deduplicated = deduplicateEvidence(list);
      expect(deduplicated.length).toBe(2);
      expect(deduplicated.map((e) => e.id)).toEqual(['ev_1', 'ev_2']);
    });

    it('boundEvidenceHistory enforces sliding window of max 50 items', () => {
      const largeList: CompetencyEvidence[] = Array.from({ length: 65 }, (_, i) => ({
        id: `ev_${i}`,
        skill: 'reading',
        score: i,
        source: 'four-skills',
        createdAt: i * 1000,
      }));

      const bounded = boundEvidenceHistory(largeList, DEFAULT_MAX_EVIDENCE_PER_SKILL);
      expect(bounded.length).toBe(50);
      expect(bounded[0].id).toBe('ev_15'); // Oldest 15 dropped
      expect(bounded[49].id).toBe('ev_64'); // Newest retained
    });

    it('mergeEvidenceArrays combines existing and incoming cleanly with dedup and bounding', () => {
      const existing: CompetencyEvidence[] = [
        { id: 'ev_1', skill: 'writing', score: 70, source: 'legacy', createdAt: 0 },
        { id: 'ev_2', skill: 'writing', score: 80, source: 'writing-ai', createdAt: 1000 },
      ];

      const incoming: CompetencyEvidence[] = [
        { id: 'ev_2', skill: 'writing', score: 80, source: 'writing-ai', createdAt: 1000 }, // Duplicate
        { id: 'ev_3', skill: 'writing', score: 90, source: 'writing-ai', createdAt: 2000 },
      ];

      const merged = mergeEvidenceArrays(existing, incoming, 50);
      expect(merged.length).toBe(3);
      expect(merged.map((e) => e.id)).toEqual(['ev_1', 'ev_2', 'ev_3']);
    });
  });

  // =========================================================================
  // 5. STORE SANITIZATION RESILIENCE
  // =========================================================================
  describe('5. Store Sanitization Resilience', () => {
    it('sanitizeEvidenceStore cleanses corrupted, null, or malformed store data', () => {
      const corruptedStore = {
        listening: [
          { id: 'l1', skill: 'listening', score: 85, source: 'four-skills', createdAt: 100 },
          { id: 'l2', skill: 'listening', score: NaN, source: 'four-skills', createdAt: 200 }, // Corrupted
        ],
        reading: 'not_an_array',
        speaking: null,
        writing: [
          { id: 'w1', skill: 'writing', score: 92, source: 'writing-ai', createdAt: 300 },
          { id: 'w1', skill: 'writing', score: 92, source: 'writing-ai', createdAt: 300 }, // Duplicate
        ],
      };

      const clean = sanitizeEvidenceStore(corruptedStore);
      expect(clean.listening.length).toBe(1);
      expect(clean.listening[0].id).toBe('l1');
      expect(clean.reading).toEqual([]);
      expect(clean.speaking).toEqual([]);
      expect(clean.writing.length).toBe(1);
      expect(clean.writing[0].id).toBe('w1');
    });
  });
});
