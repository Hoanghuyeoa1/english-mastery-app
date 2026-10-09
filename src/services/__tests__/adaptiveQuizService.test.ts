// src/services/__tests__/adaptiveQuizService.test.ts
import { describe, it, expect } from 'vitest';
import {
  selectAdaptiveQuizItems,
  classifyAdaptiveCandidate,
  calculateHareNiemeyerQuotas,
  createMulberry32,
  buildAdaptiveQuizPool,
} from '../adaptiveQuizService';
import type {
  VocabWord,
  LearnerQuizContext,
  SRSProgress,
  MistakeRecord,
} from '../../types';

describe('Adaptive Quiz Service (Phase 1)', () => {
  const fixedNow = new Date('2026-10-06T10:00:00.000Z').getTime();

  // Helper mock vocab generator
  const createMockWord = (id: string, word: string, level = 'B1', extra?: Partial<VocabWord>): VocabWord => ({
    id,
    word,
    ipa: '/test/',
    partOfSpeech: 'noun',
    meaning: `Nghĩa của ${word}`,
    example: `This is an example for ${word}.`,
    tag: 'Daily',
    level,
    srsLevel: 0,
    interval: 0,
    easeFactor: 2.5,
    nextReviewDate: '',
    ...extra,
  });

  const createMockMistake = (
    id: string,
    word: string,
    mistakeCount = 1,
    resolved = false,
    lastMistakeAt: number | string = fixedNow
  ): MistakeRecord => ({
    id,
    word,
    meaning: `Nghĩa của ${word}`,
    mistakeCount,
    resolved,
    consecutiveCorrect: resolved ? 3 : 0,
    lastMistakeAt: typeof lastMistakeAt === 'number' ? new Date(lastMistakeAt).toISOString() : lastMistakeAt,
    primaryType: 'meaning',
    source: 'classic_quiz',
  });

  describe('1. Hare-Niemeyer Quota Allocation & Rounding', () => {
    it('allocates 20 items into exact 12 weak / 4 due / 2 new / 2 mastered', () => {
      const quotas = calculateHareNiemeyerQuotas(20);
      expect(quotas).toEqual({
        weak: 12,
        due: 4,
        new: 2,
        mastered: 2,
      });
      const sum = quotas.weak + quotas.due + quotas.new + quotas.mastered;
      expect(sum).toBe(20);
    });

    it('allocates 10 items into exact 6 weak / 2 due / 1 new / 1 mastered', () => {
      const quotas = calculateHareNiemeyerQuotas(10);
      expect(quotas).toEqual({
        weak: 6,
        due: 2,
        new: 1,
        mastered: 1,
      });
      const sum = quotas.weak + quotas.due + quotas.new + quotas.mastered;
      expect(sum).toBe(10);
    });

    it('allocates 6 items with total summing exactly to 6', () => {
      const quotas = calculateHareNiemeyerQuotas(6);
      const sum = quotas.weak + quotas.due + quotas.new + quotas.mastered;
      expect(sum).toBe(6);
      expect(quotas.weak).toBeGreaterThanOrEqual(3);
    });

    it('handles 0 items gracefully', () => {
      const quotas = calculateHareNiemeyerQuotas(0);
      expect(quotas).toEqual({ weak: 0, due: 0, new: 0, mastered: 0 });
    });
  });

  describe('2. Mulberry32 Deterministic PRNG', () => {
    it('produces identical random stream given identical seeds', () => {
      const rng1 = createMulberry32(42);
      const rng2 = createMulberry32(42);

      const seq1 = [rng1(), rng1(), rng1(), rng1()];
      const seq2 = [rng2(), rng2(), rng2(), rng2()];

      expect(seq1).toEqual(seq2);
    });

    it('produces different streams for different seeds', () => {
      const rng1 = createMulberry32('seed_alpha');
      const rng2 = createMulberry32('seed_beta');

      expect(rng1()).not.toBe(rng2());
    });
  });

  describe('3. Candidate Classification Logic', () => {
    it('classifies item as Weak when it has an unresolved mistake in Mistake Bank', () => {
      const word = createMockWord('w1', 'struggle');
      const context: LearnerQuizContext = {
        mistakeBank: {
          w1: createMockMistake('w1', 'struggle', 3, false, fixedNow - 3600000),
        },
      };

      const classified = classifyAdaptiveCandidate(word, context, fixedNow);
      expect(classified.category).toBe('weak');
      expect(classified.evidence.unresolvedMistake).toBe(true);
      expect(classified.evidence.mistakeCount).toBe(3);
      expect(classified.priorityScore).toBeGreaterThanOrEqual(60);
    });

    it('classifies item as Weak when it exhibits Leech behavior or high lapses', () => {
      const word = createMockWord('w2', 'ambiguous');
      const context: LearnerQuizContext = {
        srsProgressMap: {
          w2: {
            srsLevel: 0,
            interval: 1,
            easeFactor: 1.5,
            nextReviewDate: new Date(fixedNow + 86400000).toISOString(),
            lastReviewedDate: new Date(fixedNow - 3600000).toISOString(),
            againCount: 4,
            reviewCount: 7,
          } as SRSProgress,
        },
      };

      const classified = classifyAdaptiveCandidate(word, context, fixedNow);
      expect(classified.category).toBe('weak');
      expect(classified.evidence.lapsesCount).toBe(4);
    });

    it('classifies item as Weak when FSRS retrievability is low (< 0.70)', () => {
      const word = createMockWord('w3', 'ephemeral');
      const context: LearnerQuizContext = {
        srsProgressMap: {
          w3: {
            srsLevel: 1,
            interval: 5,
            easeFactor: 2.5,
            lastReviewedDate: new Date(fixedNow - 10 * 86400000).toISOString(), // 10 days elapsed
            nextReviewDate: new Date(fixedNow - 5 * 86400000).toISOString(),
            fsrs: {
              stability: 2.0, // Low stability with 10 days elapsed -> R ~ 0.2
              difficulty: 6.0,
              reps: 2,
              lapses: 1,
              state: 2,
              lastReview: new Date(fixedNow - 10 * 86400000).toISOString(),
            },
          } as SRSProgress,
        },
      };

      const classified = classifyAdaptiveCandidate(word, context, fixedNow);
      expect(classified.category).toBe('weak');
      expect(classified.evidence.retrievability).toBeLessThan(0.70);
    });

    it('classifies item as Due Soon when overdue or due today', () => {
      const wordOverdue = createMockWord('w4', 'persist', 'B1', {
        srsLevel: 3,
        lastReviewedDate: new Date(fixedNow - 10 * 86400000).toISOString(),
        nextReviewDate: new Date(fixedNow - 2 * 86400000).toISOString(), // 2 days overdue
      });
      const context: LearnerQuizContext = {};

      const classified = classifyAdaptiveCandidate(wordOverdue, context, fixedNow);
      expect(classified.category).toBe('due');
      expect(classified.evidence.isDue).toBe(true);
      expect(classified.evidence.overdueDays).toBeGreaterThan(0);
    });

    it('classifies item as Mastered when memory is stable and mature', () => {
      const wordMastered = createMockWord('w5', 'comprehensive', 'C1', {
        srsLevel: 5,
        interval: 35,
        easeFactor: 2.6,
        lastReviewedDate: new Date(fixedNow - 7 * 86400000).toISOString(),
        nextReviewDate: new Date(fixedNow + 28 * 86400000).toISOString(), // not due for 28 days
        fsrs: {
          stability: 45.0,
          difficulty: 3.0,
          reps: 5,
          lapses: 0,
          state: 2,
          lastReview: new Date(fixedNow - 7 * 86400000).toISOString(),
        },
      });
      const context: LearnerQuizContext = {};

      const classified = classifyAdaptiveCandidate(wordMastered, context, fixedNow);
      expect(classified.category).toBe('mastered');
      expect(classified.evidence.isMastered).toBe(true);
    });

    it('classifies unstudied item as New', () => {
      const wordNew = createMockWord('w6', 'resilient', 'B2');
      const context: LearnerQuizContext = {};

      const classified = classifyAdaptiveCandidate(wordNew, context, fixedNow);
      expect(classified.category).toBe('new');
      expect(classified.evidence.isUnlearned).toBe(true);
    });
  });

  describe('4. Priority Scoring Invariants', () => {
    it('enforces Due priority invariant: overdue > due today > due soon', () => {
      const overdueWord = createMockWord('d1', 'overdue_word', 'B1', {
        srsLevel: 2,
        lastReviewedDate: new Date(fixedNow - 5 * 86400000).toISOString(),
        nextReviewDate: new Date(fixedNow - 3 * 86400000).toISOString(), // overdue 3 days
      });

      const dueTodayWord = createMockWord('d2', 'due_today_word', 'B1', {
        srsLevel: 2,
        lastReviewedDate: new Date(fixedNow - 3 * 86400000).toISOString(),
        nextReviewDate: new Date(fixedNow).toISOString(), // due right now
      });

      const dueSoonWord = createMockWord('d3', 'due_soon_word', 'B1', {
        srsLevel: 2,
        lastReviewedDate: new Date(fixedNow - 2 * 86400000).toISOString(),
        nextReviewDate: new Date(fixedNow + 1.5 * 86400000).toISOString(), // due in 1.5 days
      });

      const context: LearnerQuizContext = {};

      const scoreOverdue = classifyAdaptiveCandidate(overdueWord, context, fixedNow).priorityScore;
      const scoreDueToday = classifyAdaptiveCandidate(dueTodayWord, context, fixedNow).priorityScore;
      const scoreDueSoon = classifyAdaptiveCandidate(dueSoonWord, context, fixedNow).priorityScore;

      expect(scoreOverdue).toBeGreaterThan(scoreDueToday);
      expect(scoreDueToday).toBeGreaterThan(scoreDueSoon);
    });

    it('applies anti-repeat recency penalty (-25) for items seen in recent sessions', () => {
      const word1 = createMockWord('r1', 'recent_word');
      const word2 = createMockWord('r2', 'fresh_word');

      const contextWithRecent: LearnerQuizContext = {
        recentWordIds: ['r1'],
      };

      const c1 = classifyAdaptiveCandidate(word1, contextWithRecent, fixedNow);
      const c2 = classifyAdaptiveCandidate(word2, contextWithRecent, fixedNow);

      expect(c1.evidence.recentPenaltyApplied).toBe(true);
      expect(c2.evidence.recentPenaltyApplied).toBe(false);
      expect(c2.priorityScore).toBeGreaterThan(c1.priorityScore);
    });
  });

  describe('5. Full Session Selection & Quota Distribution', () => {
    // Generate full candidate population
    const buildCandidates = () => {
      const list: VocabWord[] = [];

      // 15 Weak words
      for (let i = 1; i <= 15; i++) {
        list.push(createMockWord(`weak_${i}`, `weak_word_${i}`, 'B1'));
      }
      // 10 Due words
      for (let i = 1; i <= 10; i++) {
        list.push(createMockWord(`due_${i}`, `due_word_${i}`, 'B1', {
          srsLevel: 2,
          lastReviewedDate: new Date(fixedNow - 4 * 86400000).toISOString(),
          nextReviewDate: new Date(fixedNow - i * 3600000).toISOString(),
        }));
      }
      // 10 Mastered words
      for (let i = 1; i <= 10; i++) {
        list.push(createMockWord(`master_${i}`, `mastered_word_${i}`, 'B1', {
          srsLevel: 5,
          interval: 30,
          easeFactor: 2.5,
          lastReviewedDate: new Date(fixedNow - 10 * 86400000).toISOString(),
          nextReviewDate: new Date(fixedNow + 20 * 86400000).toISOString(),
        }));
      }
      // 15 New words
      for (let i = 1; i <= 15; i++) {
        list.push(createMockWord(`new_${i}`, `new_word_${i}`, 'B1'));
      }

      return list;
    };

    it('selects exactly 12 weak, 4 due, 2 new, 2 mastered when all pools are full', () => {
      const candidates = buildCandidates();
      const mistakeBank: Record<string, MistakeRecord> = {};
      for (let i = 1; i <= 15; i++) {
        mistakeBank[`weak_${i}`] = createMockMistake(`weak_${i}`, `weak_word_${i}`, i, false, fixedNow);
      }

      const result = selectAdaptiveQuizItems(candidates, { mistakeBank, now: fixedNow }, { count: 20 });

      expect(result.items.length).toBe(20);
      expect(result.quotaSummary.actual.weak).toBe(12);
      expect(result.quotaSummary.actual.due).toBe(4);
      expect(result.quotaSummary.actual.new).toBe(2);
      expect(result.quotaSummary.actual.mastered).toBe(2);
      expect(result.isNewUserFallback).toBe(false);
    });

    it('cascades surplus from deficient Weak pool: Weak shortfall -> Due -> New -> Mastered', () => {
      const candidates = buildCandidates();
      // Only 3 weak items exist in mistake bank
      const mistakeBank: Record<string, MistakeRecord> = {
        weak_1: createMockMistake('weak_1', 'weak_word_1', 2, false, fixedNow),
        weak_2: createMockMistake('weak_2', 'weak_word_2', 2, false, fixedNow),
        weak_3: createMockMistake('weak_3', 'weak_word_3', 2, false, fixedNow),
      };

      const result = selectAdaptiveQuizItems(candidates, { mistakeBank, now: fixedNow }, { count: 20 });

      expect(result.items.length).toBe(20);
      // Weak quota was 12, but only 3 available -> took 3
      expect(result.quotaSummary.actual.weak).toBe(3);
      // Surplus of 9 was cascaded: Due had 10 available, took 4 (quota) + 6 (from surplus) = 10
      // Remaining surplus of 3 went to New: took 2 (quota) + 3 = 5
      expect(result.quotaSummary.actual.due).toBe(10);
      expect(result.quotaSummary.actual.new).toBe(5);
      expect(result.quotaSummary.actual.mastered).toBe(2);
      expect(result.quotaSummary.surplusRedistributed).toBe(9);
    });

    it('triggers honest New-User Fallback when SRS and Mistake Bank are empty', () => {
      // 20 purely unlearned words
      const candidates: VocabWord[] = [];
      for (let i = 1; i <= 20; i++) {
        candidates.push(createMockWord(`brand_new_${i}`, `brand_new_word_${i}`, 'B1'));
      }

      const result = selectAdaptiveQuizItems(candidates, { now: fixedNow }, { count: 10 });

      expect(result.isNewUserFallback).toBe(true);
      expect(result.items.length).toBe(10);
      // Zero fake weak or due items
      expect(result.quotaSummary.actual.weak).toBe(0);
      expect(result.quotaSummary.actual.due).toBe(0);
      expect(result.quotaSummary.actual.mastered).toBe(0);
      expect(result.quotaSummary.actual.new).toBe(10);
    });

    it('deduplicates canonical lemmas within a single session', () => {
      const candidates: VocabWord[] = [
        createMockWord('1', 'maintain'),
        createMockWord('2', 'Maintain'), // casing duplicate
        createMockWord('3', 'maintain!'), // punctuation duplicate
        createMockWord('4', 'develop'),
        createMockWord('5', 'acquire'),
      ];

      const result = selectAdaptiveQuizItems(candidates, { now: fixedNow }, { count: 5 });

      const uniqueLemmas = new Set(result.classifiedItems.map((c) => c.canonicalLemma));
      expect(uniqueLemmas.size).toBe(result.items.length);
      expect(result.items.length).toBe(3); // only maintain, develop, acquire
    });

    it('is completely deterministic when provided a PRNG seed', () => {
      const candidates = buildCandidates();
      const result1 = selectAdaptiveQuizItems(candidates, { now: fixedNow }, { count: 10, seed: 12345 });
      const result2 = selectAdaptiveQuizItems(candidates, { now: fixedNow }, { count: 10, seed: 12345 });

      expect(result1.items.map((w) => w.id)).toEqual(result2.items.map((w) => w.id));
    });

    it('helper buildAdaptiveQuizPool returns clean VocabWord array', () => {
      const candidates = buildCandidates();
      const pool = buildAdaptiveQuizPool(candidates, { now: fixedNow }, 6, { seed: 99 });
      expect(pool.length).toBe(6);
      expect(typeof pool[0].word).toBe('string');
    });
  });

  describe('6. Zero Mutation Invariant', () => {
    it('never mutates input candidates or store context during selection', () => {
      const originalCandidate = createMockWord('frozen_1', 'immutable', 'B2', {
        srsLevel: 2,
        interval: 5,
        easeFactor: 2.5,
      });
      const candidates = [Object.freeze({ ...originalCandidate })];
      const mistakeBank: Record<string, MistakeRecord> = {
        frozen_1: Object.freeze(createMockMistake('frozen_1', 'immutable', 2, false, fixedNow)),
      };

      expect(() => {
        selectAdaptiveQuizItems(candidates, { mistakeBank, now: fixedNow }, { count: 1 });
      }).not.toThrow();

      expect(candidates[0].srsLevel).toBe(2);
      expect(mistakeBank.frozen_1.mistakeCount).toBe(2);
    });
  });
});
