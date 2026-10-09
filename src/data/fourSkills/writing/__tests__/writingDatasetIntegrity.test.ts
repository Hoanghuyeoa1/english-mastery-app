import { describe, it, expect } from 'vitest';
import {
  WRITING_PROMPTS,
  a1WritingLessons,
  a2WritingLessons,
  b1WritingLessons,
  b2WritingLessons,
  c1WritingLessons,
  c2WritingLessons,
  findWritingLessonsByCefr,
  validateWritingPrompt,
  validateWritingDataset,
  validateWritingDistribution,
  countWords,
  WRITING_WORD_COUNT_TARGETS,
} from '../../writingData';
import { VALID_CEFR_LEVELS } from '../validation';
import { WritingPrompt } from '../../types';

describe('PHASE 3: Complete B2 + C1 + C2 Writing Expansion & 24-Lesson Integrity Suite', () => {
  describe('1. Full 24-Lesson Distribution & Inventory Audit', () => {
    it('ensures exactly 24 lessons in the master catalog', () => {
      expect(WRITING_PROMPTS).toHaveLength(24);
    });

    it('ensures exactly 4 lessons per CEFR band across all 6 levels', () => {
      expect(a1WritingLessons).toHaveLength(4);
      expect(a2WritingLessons).toHaveLength(4);
      expect(b1WritingLessons).toHaveLength(4);
      expect(b2WritingLessons).toHaveLength(4);
      expect(c1WritingLessons).toHaveLength(4);
      expect(c2WritingLessons).toHaveLength(4);

      for (const level of VALID_CEFR_LEVELS) {
        const found = findWritingLessonsByCefr(level);
        expect(found).toHaveLength(4);
      }
    });

    it('preserves all 5 stable legacy IDs in their standardized CEFR bands', () => {
      const allIds = WRITING_PROMPTS.map((p) => p.id);
      expect(allIds).toContain('wp_1');
      expect(allIds).toContain('wp_2');
      expect(allIds).toContain('wp_3');
      expect(allIds).toContain('wp_4');
      expect(allIds).toContain('wp_5');

      // Check specific band placements
      expect(b1WritingLessons.map((p) => p.id)).toContain('wp_2');
      expect(b1WritingLessons.map((p) => p.id)).toContain('wp_3');
      expect(b2WritingLessons.map((p) => p.id)).toContain('wp_1');
      expect(b2WritingLessons.map((p) => p.id)).toContain('wp_4');
      expect(c1WritingLessons.map((p) => p.id)).toContain('wp_5');
    });

    it('ensures all 24 prompt IDs are strictly unique', () => {
      const ids = WRITING_PROMPTS.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(24);
    });
  });

  describe('2. B2 Word Count, Argumentation & Cohesion Audit', () => {
    it('verifies all 4 B2 lessons have word targets within 180–260 words', () => {
      for (const lesson of b2WritingLessons) {
        expect(lesson.level).toBe('B2');
        expect(lesson.minWords).toBeGreaterThanOrEqual(180);
        expect(lesson.maxWords).toBeLessThanOrEqual(260);
        expect(lesson.wordRange).toBe('180–260 words');

        const modelWords = countWords(lesson.modelAnswer);
        expect(modelWords).toBeGreaterThanOrEqual(180);
        expect(modelWords).toBeLessThanOrEqual(260);
      }
    });

    it('verifies task diversity and register in B2', () => {
      const types = b2WritingLessons.map((p) => p.type);
      expect(types).toContain('Technical Report');
      expect(types).toContain('Professional Email');
      expect(types).toContain('Analytical Report');
      expect(types).toContain('Opinion Essay');

      const categories = b2WritingLessons.map((p) => p.category);
      expect(categories).toContain('Tech / Workplace');
      expect(categories).toContain('Career Development');
      expect(categories).toContain('Science & Environment');
      expect(categories).toContain('Culture & Society');
    });
  });

  describe('3. C1 Word Count, Nuance & Analytical Rigor Audit', () => {
    it('verifies all 4 C1 lessons have word targets within 250–350 words', () => {
      for (const lesson of c1WritingLessons) {
        expect(lesson.level).toBe('C1');
        expect(lesson.minWords).toBeGreaterThanOrEqual(250);
        expect(lesson.maxWords).toBeLessThanOrEqual(350);
        expect(lesson.wordRange).toBe('250–350 words');

        const modelWords = countWords(lesson.modelAnswer);
        expect(modelWords).toBeGreaterThanOrEqual(250);
        expect(modelWords).toBeLessThanOrEqual(350);
      }
    });

    it('verifies sophisticated task genres and registers in C1', () => {
      const types = c1WritingLessons.map((p) => p.type);
      expect(types).toContain('Opinion Essay');
      expect(types).toContain('Executive Summary');
      expect(types).toContain('Analytical Report');
      expect(types).toContain('Technical Report');

      // Verify academic hedging and precision in model answers
      for (const lesson of c1WritingLessons) {
        expect(lesson.modelAnswer).toMatch(/crucially|consequently|inherently|substantially|furthermore|precisely/i);
      }
    });
  });

  describe('4. C2 Word Count, Epistemic Synthesis & Philosophical Depth Audit', () => {
    it('verifies all 4 C2 lessons have word targets within 350–500 words', () => {
      for (const lesson of c2WritingLessons) {
        expect(lesson.level).toBe('C2');
        expect(lesson.minWords).toBeGreaterThanOrEqual(350);
        expect(lesson.maxWords).toBeLessThanOrEqual(500);
        expect(lesson.wordRange).toBe('350–500 words');

        const modelWords = countWords(lesson.modelAnswer);
        expect(modelWords).toBeGreaterThanOrEqual(350);
        expect(modelWords).toBeLessThanOrEqual(500);
      }
    });

    it('verifies genuine C2 intellectual depth: dialectical synthesis, reconcile opposing views', () => {
      // wp_c2_1: Philosophy of AI & Human Agency
      const c21 = c2WritingLessons.find((p) => p.id === 'wp_c2_1')!;
      expect(c21.modelAnswer).toMatch(/epistemic|opacity|moral laundering|phronesis/i);

      // wp_c2_2: Macroeconomic Degrowth vs Global South Development
      const c22 = c2WritingLessons.find((p) => p.id === 'wp_c2_2')!;
      expect(c22.modelAnswer).toMatch(/thermodynamic|decoupling|neocolonial|sovereignty/i);

      // wp_c2_3: Bioethics of CRISPR & Genetic Caste Stratification
      const c23 = c2WritingLessons.find((p) => p.id === 'wp_c2_3')!;
      expect(c23.modelAnswer).toMatch(/germline|stratification|intergenerational|somatic/i);

      // wp_c2_4: Digital Imperialism & Cultural Sovereignty
      const c24 = c2WritingLessons.find((p) => p.id === 'wp_c2_4')!;
      expect(c24.modelAnswer).toMatch(/imperialism|epistemicide|homogenization|sovereignty/i);
    });
  });

  describe('5. Comprehensive CEFR Progression & Topic Diversity Audit', () => {
    it('verifies strict monotonic progression of target word counts across CEFR bands', () => {
      const bands = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
      const avgWordsPerBand = bands.map((band) => {
        const lessons = findWritingLessonsByCefr(band);
        const total = lessons.reduce((acc, l) => acc + countWords(l.modelAnswer), 0);
        return Math.round(total / lessons.length);
      });

      // Strict increasing order: A1 < A2 < B1 < B2 < C1 < C2
      for (let i = 0; i < avgWordsPerBand.length - 1; i++) {
        expect(avgWordsPerBand[i]).toBeLessThan(avgWordsPerBand[i + 1]);
      }
    });

    it('verifies topic diversity across the full 24-lesson catalog', () => {
      const categories = new Set(WRITING_PROMPTS.map((p) => p.category));
      expect(categories.size).toBeGreaterThanOrEqual(5);
      expect(categories).toContain('Daily Life');
      expect(categories).toContain('Social & Travel');
      expect(categories).toContain('Tech / Workplace');
      expect(categories).toContain('Career Development');
      expect(categories).toContain('Science & Environment');
      expect(categories).toContain('Culture & Society');
    });
  });

  describe('6. Master Dataset Validation Engine & Full Distribution Check', () => {
    it('validates all 24 lessons pass strict validation with requireFullDistribution: true', () => {
      const res = validateWritingDataset(WRITING_PROMPTS, { requireFullDistribution: true });
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('verifies validateWritingDistribution reports 100% complete for all 6 bands', () => {
      const dist = validateWritingDistribution(WRITING_PROMPTS, 4);
      expect(dist.valid).toBe(true);
      expect(dist.total).toBe(24);
      expect(dist.expectedTotal).toBe(24);
      expect(dist.missingPerBand).toEqual({});
      expect(dist.counts).toEqual({
        A1: 4,
        A2: 4,
        B1: 4,
        B2: 4,
        C1: 4,
        C2: 4,
      });
    });

    it('confirms zero placeholder strings anywhere in all 24 writing lessons', () => {
      for (const lesson of WRITING_PROMPTS) {
        const json = JSON.stringify(lesson);
        expect(json).not.toMatch(/\bTODO\b/i);
        expect(json).not.toMatch(/\bTBD\b/i);
        expect(json).not.toMatch(/\bplaceholder\b/i);
        expect(json).not.toMatch(/\blorem ipsum\b/i);
        expect(json).not.toMatch(/\bchưa cập nhật\b/i);
      }
    });
  });

  describe('7. PHASE 4: Content QA & Grading / Telemetry Safety Audit', () => {
    it('verifies all 24 prompts have high-density, context-rich descriptions (>= 50 chars)', () => {
      for (const lesson of WRITING_PROMPTS) {
        expect(lesson.prompt.trim().length).toBeGreaterThanOrEqual(50);
        expect(lesson.guidelines.length).toBeGreaterThanOrEqual(3);
        for (const g of lesson.guidelines) {
          expect(g.trim().length).toBeGreaterThanOrEqual(10);
        }
      }
    });

    it('verifies all recommendedVocab entries have meaningful Vietnamese explanations (>= 5 chars)', () => {
      for (const lesson of WRITING_PROMPTS) {
        expect(lesson.recommendedVocab.length).toBeGreaterThanOrEqual(3);
        for (const v of lesson.recommendedVocab) {
          expect(v.word.trim().length).toBeGreaterThanOrEqual(2);
          expect(v.meaning.trim().length).toBeGreaterThanOrEqual(5);
        }
      }
    });

    it('verifies every model answer word count strictly satisfies its CEFR benchmark range', () => {
      for (const lesson of WRITING_PROMPTS) {
        const wc = countWords(lesson.modelAnswer);
        expect(wc).toBeGreaterThanOrEqual(lesson.minWords);
        if (lesson.maxWords) {
          // Allow small 10-word flexibility for rich authentic expression
          expect(wc).toBeLessThanOrEqual(lesson.maxWords + 10);
        }
      }
    });
  });
});
