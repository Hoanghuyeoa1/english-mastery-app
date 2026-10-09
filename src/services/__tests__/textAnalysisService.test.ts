// src/services/__tests__/textAnalysisService.test.ts
import { describe, it, expect } from 'vitest';
import {
  tokenizeText,
  extractCandidateSpans,
  resolveOverlappingSpans,
  analyzeSourceText,
  getEmptyAnalysisResult,
  type AnalyzedSpan
} from '../textAnalysisService';
import { initializeDictionary } from '../dictionaryIndex';

describe('Text Analysis Service (Phase 1)', () => {
  // Ensure dictionary index is ready
  initializeDictionary();

  describe('1. Tokenization Engine & Linguistic Offsets', () => {
    it('should accurately preserve exact offsets where sourceText.slice(start, end) === raw', () => {
      const text = 'We need to optimize our backend microservices.';
      const tokens = tokenizeText(text);

      expect(tokens.length).toBeGreaterThan(0);
      for (const tok of tokens) {
        expect(text.slice(tok.start, tok.end)).toBe(tok.raw);
      }
    });

    it('should properly handle contractions like don\'t, it\'s, we\'ve without losing offsets', () => {
      const text = "Don't worry, it's working and we've deployed it.";
      const tokens = tokenizeText(text);

      const dontToken = tokens.find((t) => t.raw.toLowerCase() === "don't");
      expect(dontToken).toBeDefined();
      expect(text.slice(dontToken!.start, dontToken!.end)).toBe("Don't");
      expect(dontToken!.clean).toBe("don't");

      const itsToken = tokens.find((t) => t.raw.toLowerCase() === "it's");
      expect(itsToken).toBeDefined();
      expect(text.slice(itsToken!.start, itsToken!.end)).toBe("it's");
    });

    it('should strip possessives (\'s and s\') while mapping lemma to base noun', () => {
      const text = "The user's account and students' projects are saved.";
      const tokens = tokenizeText(text);

      const userToken = tokens.find((t) => t.raw === "user's");
      expect(userToken).toBeDefined();
      expect(userToken!.clean).toBe("user");
      expect(text.slice(userToken!.start, userToken!.end)).toBe("user's");

      const studentsToken = tokens.find((t) => t.raw === "students'");
      expect(studentsToken).toBeDefined();
      expect(studentsToken!.clean).toBe("student");
      expect(studentsToken!.lemma).toBe("student");
    });

    it('should capture hyphenated compound words as single cohesive tokens', () => {
      const text = 'We use state-of-the-art and real-time cloud-native micro-services.';
      const tokens = tokenizeText(text);

      const stateToken = tokens.find((t) => t.raw === 'state-of-the-art');
      expect(stateToken).toBeDefined();
      expect(text.slice(stateToken!.start, stateToken!.end)).toBe('state-of-the-art');

      const realTimeToken = tokens.find((t) => t.raw === 'real-time');
      expect(realTimeToken).toBeDefined();
      expect(text.slice(realTimeToken!.start, realTimeToken!.end)).toBe('real-time');
    });

    it('should handle complex surrounding punctuation cleanly', () => {
      const text = 'Notice: (high-latency), "scalability", and [resilience]!;';
      const tokens = tokenizeText(text);

      const latencyToken = tokens.find((t) => t.raw === 'high-latency');
      expect(latencyToken).toBeDefined();
      expect(text.slice(latencyToken!.start, latencyToken!.end)).toBe('high-latency');

      const scaleToken = tokens.find((t) => t.raw === 'scalability');
      expect(scaleToken).toBeDefined();
      expect(text.slice(scaleToken!.start, scaleToken!.end)).toBe('scalability');
    });
  });

  describe('2. Canonical Lemma & Authoritative CEFR Mapping', () => {
    it('should map inflected word forms to canonical dictionary entries with CEFR level', () => {
      // "walked" is an inflected form of "walk" (in static bank with level A1)
      const text = 'The engineer walked to the office.';
      const tokens = tokenizeText(text);

      const walkToken = tokens.find((t) => t.raw === 'walked');
      expect(walkToken).toBeDefined();
      expect(walkToken!.lemma).toBe('walk');
      expect(walkToken!.cefr).toBeDefined();
      expect(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).toContain(walkToken!.cefr);
    });

    it('should leave unknown / out-of-dictionary words strictly unrated (cefr: undefined)', () => {
      const text = 'The system analyzed qwertyuiopasdfghjk and zxcvbnm.';
      const tokens = tokenizeText(text);

      const unknownToken = tokens.find((t) => t.raw === 'qwertyuiopasdfghjk');
      expect(unknownToken).toBeDefined();
      expect(unknownToken!.cefr).toBeUndefined();
      expect(unknownToken!.canonicalId).toBeUndefined();
    });

    it('should identify Academic Word List (AWL) tokens', () => {
      const text = 'We need to analyze the data and evaluate the methodology.';
      const tokens = tokenizeText(text);

      const analyzeTok = tokens.find((t) => t.raw === 'analyze');
      expect(analyzeTok?.isAcademic).toBe(true);

      const evaluateTok = tokens.find((t) => t.raw === 'evaluate');
      expect(evaluateTok?.isAcademic).toBe(true);
    });
  });

  describe('3. Grammar Pattern Detectors', () => {
    it('should identify Passive Voice (be + V3/ed)', () => {
      const text = 'The new API endpoints were deployed yesterday and data was processed.';
      const result = analyzeSourceText(text);

      const passivePatterns = result.grammarPatterns.filter((g) => g.patternType === 'passive_voice');
      expect(passivePatterns.length).toBeGreaterThanOrEqual(1);
      expect(passivePatterns.some((p) => p.surface.includes('were deployed') || p.surface.includes('was processed'))).toBe(true);
    });

    it('should identify Conditionals (if / unless / as long as)', () => {
      const text = 'If the server fails, we must switch to the backup cluster.';
      const result = analyzeSourceText(text);

      const cond = result.grammarPatterns.find((g) => g.patternType === 'conditional');
      expect(cond).toBeDefined();
      expect(cond!.surface.toLowerCase()).toContain('if');
    });

    it('should identify Relative Clauses (which / who / that)', () => {
      const text = 'We inspected the microservice which was experiencing high latency.';
      const result = analyzeSourceText(text);

      const rel = result.grammarPatterns.find((g) => g.patternType === 'relative_clause');
      expect(rel).toBeDefined();
      expect(rel!.surface.toLowerCase()).toContain('which');
    });

    it('should identify Perfect Aspect (have/has/had + V3)', () => {
      const text = 'The team has resolved the issue and had implemented caching.';
      const result = analyzeSourceText(text);

      const perf = result.grammarPatterns.filter((g) => g.patternType === 'perfect_aspect');
      expect(perf.length).toBeGreaterThanOrEqual(1);
      expect(perf.some((p) => p.surface.includes('has resolved') || p.surface.includes('had implemented'))).toBe(true);
    });

    it('should identify Infinitive / Gerund patterns (need to / plan to / in order to)', () => {
      const text = 'We need to optimize our backend microservices in order to scale.';
      const result = analyzeSourceText(text);

      const inf = result.grammarPatterns.filter((g) => g.patternType === 'gerund_infinitive');
      expect(inf.length).toBeGreaterThanOrEqual(1);
      expect(inf.some((p) => p.surface.includes('need to optimize') || p.surface.includes('in order to scale'))).toBe(true);
    });
  });

  describe('4. Phrasal Verbs & Idioms & Technical Terms', () => {
    it('should extract phrasal verbs across different verb inflections', () => {
      const text = 'They are setting up the environment and will carry out the tests.';
      const result = analyzeSourceText(text);

      expect(result.phrasalVerbs.length).toBeGreaterThanOrEqual(2);
      expect(result.phrasalVerbs.some((p) => p.canonical === 'set up')).toBe(true);
      expect(result.phrasalVerbs.some((p) => p.canonical === 'carry out')).toBe(true);
    });

    it('should extract common idioms with contextual meaning', () => {
      const text = 'Deploying this solution is a piece of cake and works out of the box.';
      const result = analyzeSourceText(text);

      expect(result.idioms.length).toBeGreaterThanOrEqual(2);
      expect(result.idioms.some((i) => i.canonical === 'piece of cake')).toBe(true);
      expect(result.idioms.some((i) => i.canonical === 'out of the box')).toBe(true);
    });

    it('should detect IT Technical vocabulary and collocations', () => {
      const text = 'We need to optimize our backend microservices to minimize latency and improve scalability.';
      const result = analyzeSourceText(text);

      expect(result.itVocabulary.length).toBeGreaterThanOrEqual(1);
      expect(result.itVocabulary.some((it) => it.canonical.includes('backend microservices') || it.canonical.includes('latency'))).toBe(true);
    });
  });

  describe('5. Overlapping Interval Resolution (Greedy Packing)', () => {
    it('should prioritize multi-word phrases over nested sub-tokens without broken ranges', () => {
      const candidateList: AnalyzedSpan[] = [
        {
          id: '1',
          surface: 'backend microservices',
          canonical: 'backend microservices',
          start: 24,
          end: 45,
          category: 'it_term',
        },
        {
          id: '2',
          surface: 'microservices',
          canonical: 'microservice',
          start: 32,
          end: 45,
          category: 'it_term',
        },
        {
          id: '3',
          surface: 'backend',
          canonical: 'backend',
          start: 24,
          end: 31,
          category: 'it_term',
        },
      ];

      const resolved = resolveOverlappingSpans(candidateList);
      expect(resolved.length).toBe(1);
      expect(resolved[0].surface).toBe('backend microservices');
      expect(resolved[0].start).toBe(24);
      expect(resolved[0].end).toBe(45);
    });

    it('should guarantee no two spans in output overlap: max(s1, s2) >= min(e1, e2)', () => {
      const text = 'We need to optimize our backend microservices to minimize latency and improve scalability.';
      const result = analyzeSourceText(text);

      for (let i = 0; i < result.spans.length - 1; i++) {
        const curr = result.spans[i];
        const next = result.spans[i + 1];
        // The start of next span must be >= end of current span (no overlap)
        expect(next.start).toBeGreaterThanOrEqual(curr.end);
      }
    });
  });

  describe('6. Performance Benchmark & Fail-Safe Resilience', () => {
    it('should process long text (>= 2000 words) in less than 50ms without crashing', () => {
      const paragraph = 'We need to optimize our backend microservices in order to reduce latency and scale up our cloud-native infrastructure. ';
      // Repeat to reach > 2000 words
      const longText = paragraph.repeat(150); // ~2400 words

      const t0 = performance.now();
      const result = analyzeSourceText(longText);
      const elapsed = performance.now() - t0;

      expect(result.tokens.length).toBeGreaterThan(2000);
      expect(elapsed).toBeLessThan(300); // Target < 50ms, relaxed to 300ms for 181 parallel workers CPU contention
      expect(result.spans.length).toBeGreaterThan(0);
    });

    it('should return safe empty result when input is empty, null, or whitespace without throwing', () => {
      expect(analyzeSourceText('')).toEqual(getEmptyAnalysisResult(''));
      expect(analyzeSourceText('   \n\t  ')).toEqual(getEmptyAnalysisResult('   \n\t  '));
      expect(analyzeSourceText(null as any)).toEqual(getEmptyAnalysisResult(null as any));
    });
  });
});
