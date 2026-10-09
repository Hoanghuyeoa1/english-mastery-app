// src/services/__tests__/adaptiveMistakeService.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  inferMistakeType,
  normalizeMistakeSource,
  toCanonicalSource,
  toCanonicalType,
  calculateLevenshteinDistance,
  classifyMistakeCause,
  canonicalizeSourceCounts,
  createMistakeEvent,
  toAdaptiveProfile,
  calculateAdaptiveScore,
  calculateWeaknessSummary,
  getMistakeRecurrenceLevel,
  detectRecurrentMistakes,
  updateTypeResolutionOnMistake,
  updateTypeResolutionOnCorrect,
  generateDetailedWeaknessReport,
} from '../adaptiveMistakeService';
import { MistakeRecord, MistakeType } from '../../types';
import { useAppStore } from '../../store/useAppStore';

describe('Adaptive Mistake Service: Domain Model & Canonical Normalization (Phase 1 & 2)', () => {
  describe('1. Taxonomy & Mistake Type Inference', () => {
    it('infers correct default mistake type for each source', () => {
      expect(inferMistakeType('dictation')).toBe('spelling');
      expect(inferMistakeType('scramble')).toBe('spelling');
      expect(inferMistakeType('word_scramble')).toBe('spelling');
      expect(inferMistakeType('pronunciation')).toBe('pronunciation');
      expect(inferMistakeType('quiz')).toBe('meaning');
      expect(inferMistakeType('classic_quiz')).toBe('meaning');
      expect(inferMistakeType('srs_again')).toBe('meaning');
      expect(inferMistakeType('flashcard')).toBe('meaning');
      expect(inferMistakeType('speed_match')).toBe('meaning');
      expect(inferMistakeType('listening')).toBe('listening');
      expect(inferMistakeType('reading')).toBe('reading');
      expect(inferMistakeType('writing')).toBe('writing');
      expect(inferMistakeType('collocation')).toBe('collocation');
      expect(inferMistakeType('custom')).toBe('other');
      expect(inferMistakeType('other')).toBe('other');
      expect(inferMistakeType(undefined)).toBe('other');
    });

    it('respects explicit override over source default', () => {
      expect(inferMistakeType('dictation', 'grammar')).toBe('grammar');
      expect(inferMistakeType('quiz', 'collocation')).toBe('collocation');
      expect(inferMistakeType('flashcard', 'spelling')).toBe('spelling');
    });
  });

  describe('2. Phase 2 Canonical Normalization (Source & Type)', () => {
    it('canonicalizes all legacy and alias sources cleanly', () => {
      expect(toCanonicalSource('srs_again')).toBe('flashcard');
      expect(toCanonicalSource('flashcard')).toBe('flashcard');
      expect(toCanonicalSource('quiz')).toBe('classic_quiz');
      expect(toCanonicalSource('classic_quiz')).toBe('classic_quiz');
      expect(toCanonicalSource('scramble')).toBe('word_scramble');
      expect(toCanonicalSource('word_scramble')).toBe('word_scramble');
      expect(toCanonicalSource('dictation')).toBe('dictation');
      expect(toCanonicalSource('pronunciation')).toBe('pronunciation');
      expect(toCanonicalSource('speed_match')).toBe('speed_match');
      expect(toCanonicalSource('custom')).toBe('custom');
      expect(toCanonicalSource(undefined)).toBe('other');
      expect(toCanonicalSource('')).toBe('other');
    });

    it('canonicalizes mistake types and falls back gracefully', () => {
      expect(toCanonicalType('spelling')).toBe('spelling');
      expect(toCanonicalType('meaning')).toBe('meaning');
      expect(toCanonicalType('pronunciation')).toBe('pronunciation');
      expect(toCanonicalType(undefined, 'dictation')).toBe('spelling');
      expect(toCanonicalType('invalid_type', 'flashcard')).toBe('meaning');
    });

    it('canonicalizeSourceCounts merges legacy counters into canonical keys without bifurcating analytics', () => {
      const rawCounts = {
        srs_again: 3,
        flashcard: 2,
        quiz: 1,
        classic_quiz: 4,
        scramble: 2,
        word_scramble: 1,
        dictation: 5,
      };

      const canonical = canonicalizeSourceCounts(rawCounts);

      expect(canonical.flashcard).toBe(5); // 3 (srs_again) + 2 (flashcard)
      expect(canonical.classic_quiz).toBe(5); // 1 (quiz) + 4 (classic_quiz)
      expect(canonical.word_scramble).toBe(3); // 2 (scramble) + 1 (word_scramble)
      expect(canonical.dictation).toBe(5);
      expect((canonical as any).srs_again).toBeUndefined();
      expect((canonical as any).quiz).toBeUndefined();
    });
  });

  describe('3. Levenshtein Distance & Mistake Cause Classification', () => {
    it('calculates accurate edit distance between strings', () => {
      expect(calculateLevenshteinDistance('resilient', 'resilient')).toBe(0);
      expect(calculateLevenshteinDistance('resilient', 'resiliant')).toBe(1);
      expect(calculateLevenshteinDistance('accommodate', 'acomodate')).toBe(2);
      expect(calculateLevenshteinDistance('dog', 'cat')).toBe(3);
      expect(calculateLevenshteinDistance('', 'hello')).toBe(5);
    });

    it('classifies spelling typos when edit distance <= 2', () => {
      const analysis = classifyMistakeCause({
        source: 'dictation',
        type: 'spelling',
        userAnswer: 'resiliant',
        expectedAnswer: 'resilient',
      });

      expect(analysis.primaryType).toBe('spelling');
      expect(analysis.canonicalSource).toBe('dictation');
      expect(analysis.isTypo).toBe(true);
      expect(analysis.subReason).toBe('minor_typo');
      expect(analysis.levenshteinDistance).toBe(1);
    });

    it('classifies orthographic gap when edit distance > 2', () => {
      const analysis = classifyMistakeCause({
        source: 'dictation',
        type: 'spelling',
        userAnswer: 'resovle',
        expectedAnswer: 'resilient',
      });

      expect(analysis.primaryType).toBe('spelling');
      expect(analysis.isTypo).toBe(false);
      expect(analysis.subReason).toBe('spelling_gap');
      expect(analysis.levenshteinDistance).toBeGreaterThan(2);
    });

    it('classifies semantic confusion for multiple choice quiz errors', () => {
      const analysis = classifyMistakeCause({
        source: 'classic_quiz',
        type: 'meaning',
        userAnswer: 'từ bỏ',
        expectedAnswer: 'kiên cường, bền bỉ',
      });

      expect(analysis.primaryType).toBe('meaning');
      expect(analysis.canonicalSource).toBe('classic_quiz');
      expect(analysis.isTypo).toBe(false);
      expect(analysis.subReason).toBe('semantic_confusion');
    });

    it('classifies phonetic divergence for pronunciation errors', () => {
      const analysis = classifyMistakeCause({
        source: 'pronunciation',
        type: 'pronunciation',
        userAnswer: 'resilint',
        expectedAnswer: 'resilient',
      });

      expect(analysis.primaryType).toBe('pronunciation');
      expect(analysis.canonicalSource).toBe('pronunciation');
      expect(analysis.subReason).toBe('phonetic_divergence');
    });
  });

  describe('4. createMistakeEvent with Cause Analysis', () => {
    it('creates an event with normalized fields, timestamps, and attached cause analysis', () => {
      const ev = createMistakeEvent({
        word: 'benevolent',
        source: 'dictation',
        userAnswer: 'benevolant',
        expectedAnswer: 'benevolent',
        context: 'He was a benevolent ruler.',
      });

      expect(ev.id).toBeDefined();
      expect(ev.word).toBe('benevolent');
      expect(ev.type).toBe('spelling');
      expect(ev.source).toBe('dictation');
      expect(ev.userAnswer).toBe('benevolant');
      expect(ev.expectedAnswer).toBe('benevolent');
      expect(ev.context).toBe('He was a benevolent ruler.');
      expect(typeof ev.occurredAt).toBe('number');
      expect(ev.analysis?.isTypo).toBe(true);
      expect(ev.analysis?.subReason).toBe('minor_typo');
    });
  });

  describe('5. toAdaptiveProfile (Legacy Compatibility & Modern Conversion)', () => {
    it('converts a legacy MistakeRecord without throwing, canonicalizing missing metrics', () => {
      const legacyRecord: MistakeRecord = {
        id: 'legacy_01',
        word: 'ubiquitous',
        meaning: 'phổ biến',
        mistakeCount: 3,
        consecutiveCorrect: 1,
        resolved: false,
        lastMistakeAt: '2026-10-01T10:00:00.000Z',
        source: 'srs_again',
      };

      const profile = toAdaptiveProfile(legacyRecord);

      expect(profile.id).toBe('legacy_01');
      expect(profile.word).toBe('ubiquitous');
      expect(profile.totalMistakes).toBe(3);
      expect(profile.primaryType).toBe('meaning');
      expect(profile.typeCounts).toEqual({ meaning: 3 });
      expect(profile.sourceCounts).toEqual({ flashcard: 3 }); // Canonicalized from srs_again
      expect(profile.consecutiveCorrect).toBe(1);
      expect(profile.resolved).toBe(false);
      expect(profile.recurrenceCount).toBe(0);
      expect(typeof profile.adaptiveScore).toBe('number');
      expect(profile.adaptiveScore).toBeGreaterThan(0);
    });

    it('preserves existing rich fields if present in modern record and canonicalizes sources', () => {
      const modernRecord: MistakeRecord = {
        id: 'modern_01',
        word: 'accommodate',
        meaning: 'thích nghi',
        mistakeCount: 4,
        consecutiveCorrect: 0,
        resolved: false,
        lastMistakeAt: new Date().toISOString(),
        source: 'dictation',
        primaryType: 'spelling',
        typeCounts: { spelling: 3, meaning: 1 },
        sourceCounts: { dictation: 3, quiz: 1 },
        firstSeenAt: '2026-09-20T10:00:00.000Z',
        reopenCount: 2,
        lastUserAnswer: 'acommodate',
        lastExpectedAnswer: 'accommodate',
      };

      const profile = toAdaptiveProfile(modernRecord);

      expect(profile.id).toBe('modern_01');
      expect(profile.primaryType).toBe('spelling');
      expect(profile.typeCounts).toEqual({ spelling: 3, meaning: 1 });
      expect(profile.sourceCounts).toEqual({ dictation: 3, classic_quiz: 1 }); // quiz normalized to classic_quiz
      expect(profile.recurrenceCount).toBe(2);
    });
  });

  describe('6. calculateAdaptiveScore', () => {
    const fixedNow = 1790000000000;

    it('gives higher score to frequent unresolved mistakes than infrequent ones', () => {
      const highFreq: MistakeRecord = {
        id: '1',
        word: 'wordA',
        meaning: 'A',
        mistakeCount: 5,
        consecutiveCorrect: 0,
        resolved: false,
        lastMistakeAt: new Date(fixedNow - 1000 * 60 * 60).toISOString(), // 1h ago
      };

      const lowFreq: MistakeRecord = {
        id: '2',
        word: 'wordB',
        meaning: 'B',
        mistakeCount: 1,
        consecutiveCorrect: 0,
        resolved: false,
        lastMistakeAt: new Date(fixedNow - 1000 * 60 * 60).toISOString(), // 1h ago
      };

      const scoreHigh = calculateAdaptiveScore(highFreq, { now: fixedNow });
      const scoreLow = calculateAdaptiveScore(lowFreq, { now: fixedNow });

      expect(scoreHigh).toBeGreaterThan(scoreLow);
    });

    it('substantially discounts resolved mistakes compared to unresolved mistakes', () => {
      const unresolved: MistakeRecord = {
        id: '1',
        word: 'wordA',
        meaning: 'A',
        mistakeCount: 3,
        consecutiveCorrect: 0,
        resolved: false,
        lastMistakeAt: new Date(fixedNow).toISOString(),
      };

      const resolved: MistakeRecord = {
        id: '2',
        word: 'wordA',
        meaning: 'A',
        mistakeCount: 3,
        consecutiveCorrect: 2,
        resolved: true,
        lastMistakeAt: new Date(fixedNow).toISOString(),
      };

      const scoreUnresolved = calculateAdaptiveScore(unresolved, { now: fixedNow });
      const scoreResolved = calculateAdaptiveScore(resolved, { now: fixedNow });

      expect(scoreResolved).toBeLessThan(scoreUnresolved * 0.25);
    });

    it('penalizes reopened mistakes (reopenCount > 0)', () => {
      const standard: MistakeRecord = {
        id: '1',
        word: 'wordA',
        meaning: 'A',
        mistakeCount: 2,
        consecutiveCorrect: 0,
        resolved: false,
        reopenCount: 0,
        lastMistakeAt: new Date(fixedNow).toISOString(),
      };

      const reopened: MistakeRecord = {
        id: '2',
        word: 'wordB',
        meaning: 'B',
        mistakeCount: 2,
        consecutiveCorrect: 0,
        resolved: false,
        reopenCount: 2,
        lastMistakeAt: new Date(fixedNow).toISOString(),
      };

      const scoreStandard = calculateAdaptiveScore(standard, { now: fixedNow });
      const scoreReopened = calculateAdaptiveScore(reopened, { now: fixedNow });

      expect(scoreReopened).toBeGreaterThan(scoreStandard);
    });

    it('decays priority score for old mistakes compared to recent mistakes', () => {
      const recent: MistakeRecord = {
        id: '1',
        word: 'wordA',
        meaning: 'A',
        mistakeCount: 3,
        consecutiveCorrect: 0,
        resolved: false,
        lastMistakeAt: new Date(fixedNow - 1000 * 60 * 60).toISOString(), // 1h ago
      };

      const old: MistakeRecord = {
        id: '2',
        word: 'wordB',
        meaning: 'B',
        mistakeCount: 3,
        consecutiveCorrect: 0,
        resolved: false,
        lastMistakeAt: new Date(fixedNow - 1000 * 60 * 60 * 24 * 20).toISOString(), // 20 days ago
      };

      const scoreRecent = calculateAdaptiveScore(recent, { now: fixedNow });
      const scoreOld = calculateAdaptiveScore(old, { now: fixedNow });

      expect(scoreRecent).toBeGreaterThan(scoreOld);
    });
  });

  describe('7. calculateWeaknessSummary (Canonical Aggregation)', () => {
    it('aggregates mixed legacy and modern sources into canonical buckets', () => {
      const records: Record<string, MistakeRecord> = {
        w1: {
          id: '1',
          word: 'spelling1',
          meaning: 'm1',
          mistakeCount: 3,
          consecutiveCorrect: 0,
          resolved: false,
          lastMistakeAt: new Date().toISOString(),
          source: 'dictation',
          sourceCounts: { dictation: 3 },
          typeCounts: { spelling: 3 },
        },
        w2: {
          id: '2',
          word: 'spelling2',
          meaning: 'm2',
          mistakeCount: 2,
          consecutiveCorrect: 0,
          resolved: false,
          lastMistakeAt: new Date().toISOString(),
          source: 'scramble', // legacy alias
          sourceCounts: { scramble: 2 },
          typeCounts: { spelling: 2 },
        },
        w3: {
          id: '3',
          word: 'meaning1',
          meaning: 'm3',
          mistakeCount: 2,
          consecutiveCorrect: 2,
          resolved: true,
          lastMistakeAt: new Date().toISOString(),
          source: 'quiz', // legacy alias
          sourceCounts: { quiz: 2 },
          typeCounts: { meaning: 2 },
        },
      };

      const summary = calculateWeaknessSummary(records);

      expect(summary.totalMistakes).toBe(7);
      expect(summary.unresolvedCount).toBe(2);
      expect(summary.resolvedCount).toBe(1);
      expect(summary.typeBreakdown.spelling).toBe(5);
      expect(summary.typeBreakdown.meaning).toBe(2);
      expect(summary.sourceBreakdown.word_scramble).toBe(2); // Canonicalized!
      expect(summary.sourceBreakdown.classic_quiz).toBe(2); // Canonicalized!
      expect((summary.sourceBreakdown as any).quiz).toBeUndefined();
      expect((summary.sourceBreakdown as any).scramble).toBeUndefined();
      expect(summary.primaryWeaknessType).toBe('spelling');
    });

    it('safely handles empty records list without error', () => {
      const summary = calculateWeaknessSummary({});
      expect(summary.totalMistakes).toBe(0);
      expect(summary.unresolvedCount).toBe(0);
      expect(summary.resolvedCount).toBe(0);
      expect(summary.primaryWeaknessType).toBeNull();
    });
  });

  describe('8. Zustand Store Integration (Producer Instrumentation & Canonical Storage)', () => {
    beforeEach(() => {
      useAppStore.setState({
        mistakeBank: {},
      });
    });

    it('canonicalizes legacy source argument in recordMistake and stores canonical keys', () => {
      const store = useAppStore.getState();

      // Gọi với alias legacy 'srs_again'
      store.recordMistake(
        { id: 'w_test_srs', word: 'ephemeral', meaning: 'phù du' },
        'srs_again',
        { expectedAnswer: 'phù du', context: 'Ephemeral nature of fame' }
      );

      const record = useAppStore.getState().mistakeBank['w_test_srs'];
      expect(record).toBeDefined();
      expect(record.source).toBe('flashcard'); // Canonicalized from srs_again
      expect(record.primaryType).toBe('meaning');
      expect(record.sourceCounts?.flashcard).toBe(1);
      expect((record.sourceCounts as any)?.srs_again).toBeUndefined();
      expect((record as any).expectedAnswer).toBeUndefined(); // saved to lastExpectedAnswer
      expect(record.lastExpectedAnswer).toBe('phù du');
      expect(record.lastContext).toBe('Ephemeral nature of fame');
    });

    it('accumulates different canonical types across producers on the same word', () => {
      const store = useAppStore.getState();

      // 1. Lỗi chính tả từ dictation
      store.recordMistake(
        { id: 'w_multi', word: 'resilient', meaning: 'kiên cường' },
        'dictation',
        { userAnswer: 'resiliant', expectedAnswer: 'resilient' }
      );

      // 2. Lỗi trắc nghiệm nghĩa từ quiz
      store.recordMistake(
        { id: 'w_multi', word: 'resilient' },
        'classic_quiz',
        { type: 'meaning', userAnswer: 'nhát gan', expectedAnswer: 'kiên cường' }
      );

      const record = useAppStore.getState().mistakeBank['w_multi'];
      expect(record.mistakeCount).toBe(2);
      expect(record.typeCounts?.spelling).toBe(1);
      expect(record.typeCounts?.meaning).toBe(1);
      expect(record.sourceCounts?.dictation).toBe(1);
      expect(record.sourceCounts?.classic_quiz).toBe(1);
      expect(record.lastUserAnswer).toBe('nhát gan');
    });

    it('tracks reopenCount when an already resolved mistake is failed again', () => {
      const now = new Date().toISOString();
      useAppStore.setState({
        mistakeBank: {
          perspicacious: {
            id: 'm_persp',
            word: 'perspicacious',
            meaning: 'sáng suốt',
            mistakeCount: 2,
            consecutiveCorrect: 2,
            resolved: true,
            resolvedDate: now,
            lastMistakeAt: now,
            reopenCount: 0,
          },
        },
      });

      // Trả lời sai từ đã resolved trong Quiz -> Reopened!
      const ev = useAppStore.getState().recordQuizMistakeResult('perspicacious', false, {
        source: 'classic_quiz',
        type: 'meaning',
      });

      expect(ev.resolved).toBe(false);

      const record = useAppStore.getState().mistakeBank['perspicacious'];
      expect(record.resolved).toBe(false);
      expect(record.consecutiveCorrect).toBe(0);
      expect(record.mistakeCount).toBe(3);
      expect(record.reopenCount).toBe(1);
      expect(record.source).toBe('classic_quiz');
      expect(record.primaryType).toBe('meaning');
    });
  });

  describe('6. Phase 3: Recurrence Detection & Classification', () => {
    it('classifies recurrence level deterministically (emerging, recurrent, chronic, stabilized)', () => {
      // 1. Emerging: First mistake, unresolved
      expect(getMistakeRecurrenceLevel({
        id: '1',
        word: 'apple',
        meaning: 'táo',
        mistakeCount: 1,
        consecutiveCorrect: 0,
        resolved: false,
        lastMistakeAt: new Date().toISOString(),
      })).toBe('emerging');

      // 2. Recurrent: mistakeCount >= 2 or reopenCount >= 1
      expect(getMistakeRecurrenceLevel({
        id: '2',
        word: 'banana',
        meaning: 'chuối',
        mistakeCount: 2,
        consecutiveCorrect: 0,
        resolved: false,
        lastMistakeAt: new Date().toISOString(),
      })).toBe('recurrent');

      expect(getMistakeRecurrenceLevel({
        id: '3',
        word: 'cherry',
        meaning: 'anh đào',
        mistakeCount: 1,
        reopenCount: 1,
        consecutiveCorrect: 0,
        resolved: false,
        lastMistakeAt: new Date().toISOString(),
      })).toBe('recurrent');

      // 3. Chronic: mistakeCount >= 4 or reopenCount >= 2
      expect(getMistakeRecurrenceLevel({
        id: '4',
        word: 'date',
        meaning: 'chà là',
        mistakeCount: 4,
        consecutiveCorrect: 0,
        resolved: false,
        lastMistakeAt: new Date().toISOString(),
      })).toBe('chronic');

      expect(getMistakeRecurrenceLevel({
        id: '5',
        word: 'elderberry',
        meaning: 'cơm cháy',
        mistakeCount: 2,
        reopenCount: 2,
        consecutiveCorrect: 0,
        resolved: false,
        lastMistakeAt: new Date().toISOString(),
      })).toBe('chronic');

      // 4. Stabilized: resolved is true OR consecutiveCorrect >= 2
      expect(getMistakeRecurrenceLevel({
        id: '6',
        word: 'fig',
        meaning: 'sung',
        mistakeCount: 5,
        reopenCount: 3,
        consecutiveCorrect: 2,
        resolved: true,
        lastMistakeAt: new Date().toISOString(),
      })).toBe('stabilized');

      expect(getMistakeRecurrenceLevel({
        id: '7',
        word: 'grape',
        meaning: 'nho',
        mistakeCount: 3,
        consecutiveCorrect: 2,
        resolved: false,
        lastMistakeAt: new Date().toISOString(),
      })).toBe('stabilized');
    });

    it('detectRecurrentMistakes filters and sorts items by adaptive score', () => {
      const now = Date.now();
      const mistakes: Record<string, MistakeRecord> = {
        m1: {
          id: 'm1',
          word: 'accommodate',
          meaning: 'cung cấp nơi ở',
          mistakeCount: 5,
          reopenCount: 2,
          consecutiveCorrect: 0,
          resolved: false,
          lastMistakeAt: new Date(now).toISOString(),
        },
        m2: {
          id: 'm2',
          word: 'embarrass',
          meaning: 'làm lúng túng',
          mistakeCount: 2,
          reopenCount: 0,
          consecutiveCorrect: 0,
          resolved: false,
          lastMistakeAt: new Date(now).toISOString(),
        },
        m3: {
          id: 'm3',
          word: 'hello',
          meaning: 'xin chào',
          mistakeCount: 1,
          reopenCount: 0,
          consecutiveCorrect: 0,
          resolved: false,
          lastMistakeAt: new Date(now).toISOString(),
        },
        m4: {
          id: 'm4',
          word: 'resolved_word',
          meaning: 'đã giải quyết',
          mistakeCount: 6,
          consecutiveCorrect: 2,
          resolved: true,
          lastMistakeAt: new Date(now).toISOString(),
        },
      };

      const recurrent = detectRecurrentMistakes(mistakes, { now });
      expect(recurrent.length).toBe(2);
      expect(recurrent[0].word).toBe('accommodate'); // chronic has higher adaptive score
      expect(recurrent[1].word).toBe('embarrass'); // recurrent

      // Can filter strictly for chronic
      const chronicOnly = detectRecurrentMistakes(mistakes, { levels: ['chronic'], now });
      expect(chronicOnly.length).toBe(1);
      expect(chronicOnly[0].word).toBe('accommodate');
    });
  });

  describe('7. Phase 3: Pure Multi-Type Resolution Helpers', () => {
    it('updateTypeResolutionOnMistake records mistake count and detects reopened type', () => {
      const nowIso = new Date().toISOString();

      // First mistake for spelling
      const map1 = updateTypeResolutionOnMistake(undefined, 'spelling', nowIso);
      expect(map1.spelling?.mistakeCount).toBe(1);
      expect(map1.spelling?.consecutiveCorrect).toBe(0);
      expect(map1.spelling?.resolved).toBe(false);
      expect(map1.spelling?.reopenCount).toBe(0);

      // Suppose spelling was resolved
      map1.spelling = {
        mistakeCount: 1,
        consecutiveCorrect: 2,
        resolved: true,
        resolvedAt: nowIso,
        reopenCount: 0,
      };

      // Fails spelling again -> reopenCount increments!
      const map2 = updateTypeResolutionOnMistake(map1, 'spelling', nowIso);
      expect(map2.spelling?.mistakeCount).toBe(2);
      expect(map2.spelling?.consecutiveCorrect).toBe(0);
      expect(map2.spelling?.resolved).toBe(false);
      expect(map2.spelling?.reopenCount).toBe(1);
    });

    it('updateTypeResolutionOnCorrect advances consecutiveCorrect per type and detects allResolved', () => {
      const nowIso = new Date().toISOString();
      const initialMap = {
        spelling: {
          mistakeCount: 2,
          consecutiveCorrect: 0,
          resolved: false,
          reopenCount: 0,
        },
        meaning: {
          mistakeCount: 1,
          consecutiveCorrect: 0,
          resolved: false,
          reopenCount: 0,
        },
      };

      // Correctly review spelling once (threshold 2)
      const res1 = updateTypeResolutionOnCorrect(initialMap, 'spelling', { nowIso });
      expect(res1.updatedMap.spelling?.consecutiveCorrect).toBe(1);
      expect(res1.updatedMap.spelling?.resolved).toBe(false);
      expect(res1.allResolved).toBe(false);
      expect(res1.newlyResolvedTypes).toEqual([]);

      // Correctly review spelling second time -> spelling resolved, but meaning still unresolved!
      const res2 = updateTypeResolutionOnCorrect(res1.updatedMap, 'spelling', { nowIso });
      expect(res2.updatedMap.spelling?.consecutiveCorrect).toBe(2);
      expect(res2.updatedMap.spelling?.resolved).toBe(true);
      expect(res2.updatedMap.meaning?.resolved).toBe(false);
      expect(res2.allResolved).toBe(false);
      expect(res2.newlyResolvedTypes).toEqual(['spelling']);

      // Now review meaning twice -> allResolved becomes true!
      const res3 = updateTypeResolutionOnCorrect(res2.updatedMap, 'meaning', { nowIso });
      const res4 = updateTypeResolutionOnCorrect(res3.updatedMap, 'meaning', { nowIso });
      expect(res4.updatedMap.meaning?.resolved).toBe(true);
      expect(res4.allResolved).toBe(true);
      expect(res4.newlyResolvedTypes).toEqual(['meaning']);
    });

    it('updateTypeResolutionOnCorrect without type advances all active unresolved types simultaneously', () => {
      const initialMap = {
        spelling: {
          mistakeCount: 1,
          consecutiveCorrect: 1,
          resolved: false,
          reopenCount: 0,
        },
        pronunciation: {
          mistakeCount: 1,
          consecutiveCorrect: 1,
          resolved: false,
          reopenCount: 0,
        },
      };

      const result = updateTypeResolutionOnCorrect(initialMap, undefined);
      expect(result.updatedMap.spelling?.consecutiveCorrect).toBe(2);
      expect(result.updatedMap.spelling?.resolved).toBe(true);
      expect(result.updatedMap.pronunciation?.consecutiveCorrect).toBe(2);
      expect(result.updatedMap.pronunciation?.resolved).toBe(true);
      expect(result.allResolved).toBe(true);
      expect(result.newlyResolvedTypes).toEqual(['spelling', 'pronunciation']);
    });
  });

  describe('8. Phase 3: Detailed Weakness & Recurrence Reporting', () => {
    it('generates accurate detailed weakness report with ranking and insights', () => {
      const now = Date.now();
      const mockMistakes: Record<string, MistakeRecord> = {
        m1: {
          id: 'm1',
          word: 'necessary',
          meaning: 'cần thiết',
          mistakeCount: 5,
          reopenCount: 2,
          consecutiveCorrect: 0,
          resolved: false,
          source: 'dictation',
          primaryType: 'spelling',
          typeCounts: { spelling: 5 },
          sourceCounts: { dictation: 5 },
          lastMistakeAt: new Date(now).toISOString(),
        },
        m2: {
          id: 'm2',
          word: 'rhythm',
          meaning: 'nhịp điệu',
          mistakeCount: 4,
          reopenCount: 2,
          consecutiveCorrect: 0,
          resolved: false,
          source: 'word_scramble',
          primaryType: 'spelling',
          typeCounts: { spelling: 4 },
          sourceCounts: { word_scramble: 4 },
          lastMistakeAt: new Date(now).toISOString(),
        },
        m3: {
          id: 'm3',
          word: 'embarrass',
          meaning: 'lúng túng',
          mistakeCount: 4,
          reopenCount: 2,
          consecutiveCorrect: 0,
          resolved: false,
          source: 'dictation',
          primaryType: 'spelling',
          typeCounts: { spelling: 4 },
          sourceCounts: { dictation: 4 },
          lastMistakeAt: new Date(now).toISOString(),
        },
        m4: {
          id: 'm4',
          word: 'comfortable',
          meaning: 'thoải mái',
          mistakeCount: 2,
          consecutiveCorrect: 1,
          resolved: false,
          source: 'pronunciation',
          primaryType: 'pronunciation',
          typeCounts: { pronunciation: 2 },
          sourceCounts: { pronunciation: 2 },
          lastMistakeAt: new Date(now).toISOString(),
        },
        m5: {
          id: 'm5',
          word: 'resolved_apple',
          meaning: 'táo',
          mistakeCount: 1,
          consecutiveCorrect: 2,
          resolved: true,
          source: 'flashcard',
          primaryType: 'meaning',
          typeCounts: { meaning: 1 },
          sourceCounts: { flashcard: 1 },
          lastMistakeAt: new Date(now).toISOString(),
        },
      };

      const report = generateDetailedWeaknessReport(mockMistakes, { now });

      expect(report.summary.totalMistakes).toBe(16);
      expect(report.summary.unresolvedCount).toBe(4);
      expect(report.summary.resolvedCount).toBe(1);

      // Recurrence counts
      expect(report.recurrenceCounts.chronic).toBe(3); // necessary, rhythm, embarrass
      expect(report.recurrenceCounts.recurrent).toBe(1); // comfortable
      expect(report.recurrenceCounts.stabilized).toBe(1); // resolved_apple

      // Dominant weakness
      expect(report.dominantWeaknessType).toBe('spelling');
      expect(report.dominantWeaknessPercentage).toBeGreaterThanOrEqual(80);
      expect(report.dominantErrorSource).toBe('dictation');

      // Top struggling items
      expect(report.topStrugglingItems.length).toBe(4);
      expect(report.topStrugglingItems[0].recurrenceLevel).toBe('chronic');

      // Diagnostic insights
      expect(report.insights.some((i) => i.code === 'CHRONIC_MISTAKE_ALERT')).toBe(true);
      expect(report.insights.some((i) => i.code === 'SPELLING_VULNERABILITY')).toBe(true);
    });
  });

  describe('9. Phase 3: Store Integration with Multi-Type Resolution & Cloud Merge', () => {
    it('manages per-type resolution independently when word has both spelling and meaning mistakes', () => {
      const store = useAppStore.getState();

      // 1. Ghi nhận lỗi chính tả từ Dictation
      store.recordMistake(
        { id: 'w_hybrid', word: 'parliament', meaning: 'nghị viện' },
        'dictation',
        { type: 'spelling', userAnswer: 'parlament', expectedAnswer: 'parliament' }
      );

      // 2. Ghi nhận lỗi nghĩa từ Flashcard
      store.recordMistake(
        { id: 'w_hybrid', word: 'parliament', meaning: 'nghị viện' },
        'flashcard',
        { type: 'meaning' }
      );

      let record = useAppStore.getState().mistakeBank['w_hybrid'];
      expect(record.mistakeCount).toBe(2);
      expect(record.typeResolutionMap?.spelling?.resolved).toBe(false);
      expect(record.typeResolutionMap?.meaning?.resolved).toBe(false);
      expect(record.resolved).toBe(false);

      // 3. Người học luyện chính tả đúng 2 lần
      store.recordMistakeCorrect('w_hybrid', { type: 'spelling' });
      store.recordMistakeCorrect('w_hybrid', { type: 'spelling' });

      record = useAppStore.getState().mistakeBank['w_hybrid'];
      expect(record.typeResolutionMap?.spelling?.resolved).toBe(true);
      expect(record.typeResolutionMap?.meaning?.resolved).toBe(false);
      // Toàn bộ từ vẫn CHƯA resolved vì lỗi 'meaning' chưa được hóa giải!
      expect(record.resolved).toBe(false);

      // 4. Người học luyện nghĩa đúng 2 lần
      store.recordMistakeCorrect('w_hybrid', { type: 'meaning' });
      store.recordMistakeCorrect('w_hybrid', { type: 'meaning' });

      record = useAppStore.getState().mistakeBank['w_hybrid'];
      expect(record.typeResolutionMap?.spelling?.resolved).toBe(true);
      expect(record.typeResolutionMap?.meaning?.resolved).toBe(true);
      // Cả 2 loại lỗi đều resolved -> toàn bộ từ chính thức RESOLVED!
      expect(record.resolved).toBe(true);

      // 5. Nếu sau đó người học lại viết sai chính tả trong Dictation:
      // Lỗi 'spelling' bị reopened, trong khi 'meaning' vẫn giữ resolved: true!
      store.recordMistake(
        { id: 'w_hybrid', word: 'parliament' },
        'dictation',
        { type: 'spelling' }
      );

      record = useAppStore.getState().mistakeBank['w_hybrid'];
      expect(record.resolved).toBe(false);
      expect(record.typeResolutionMap?.spelling?.resolved).toBe(false);
      expect(record.typeResolutionMap?.spelling?.reopenCount).toBe(1);
      expect(record.typeResolutionMap?.meaning?.resolved).toBe(true);
    });

    it('mergeCloudData reconciles typeResolutionMap across devices', () => {
      const now = new Date().toISOString();
      useAppStore.setState({
        mistakeBank: {
          connoisseur: {
            id: 'm_connoisseur',
            word: 'connoisseur',
            meaning: 'người sành sỏi',
            mistakeCount: 2,
            consecutiveCorrect: 1,
            resolved: false,
            lastMistakeAt: now,
            typeResolutionMap: {
              meaning: {
                mistakeCount: 2,
                consecutiveCorrect: 2,
                resolved: true,
                reopenCount: 0,
              },
            },
          },
        },
      });

      // Cloud payload có lỗi spelling cho cùng từ đó đã được giải quyết trên thiết bị khác
      useAppStore.getState().mergeCloudData({
        cloudMistakeBank: [
          {
            id: 'm_connoisseur',
            word: 'connoisseur',
            meaning: 'người sành sỏi',
            mistakeCount: 3,
            consecutiveCorrect: 2,
            resolved: true,
            lastMistakeAt: now,
            typeResolutionMap: {
              spelling: {
                mistakeCount: 3,
                consecutiveCorrect: 2,
                resolved: true,
                reopenCount: 0,
              },
            },
          },
        ],
      });

      const merged = useAppStore.getState().mistakeBank['connoisseur'];
      expect(merged.resolved).toBe(true);
      expect(merged.typeResolutionMap?.meaning?.resolved).toBe(true);
      expect(merged.typeResolutionMap?.spelling?.resolved).toBe(true);
      expect(merged.mistakeCount).toBe(3);
    });
  });

  describe('10. Audit Bug Fixes (Phase 2 & 3 Remediation)', () => {
    it('Fix 1: single recording flow via recordQuizMistakeResult prevents double-counting', () => {
      useAppStore.setState({ mistakeBank: {} });
      const store = useAppStore.getState();

      // 1 lượt trả lời sai trong Classic Quiz
      const wrongEvent = store.recordQuizMistakeResult('quiz_word_1', false, {
        source: 'classic_quiz',
        type: 'meaning',
        userAnswer: 'sai',
        expectedAnswer: 'đúng',
      });

      let record = useAppStore.getState().mistakeBank['quiz_word_1'];
      expect(record).toBeDefined();
      expect(record.mistakeCount).toBe(1);
      expect(record.wrongCount).toBe(1);
      expect(record.consecutiveCorrect).toBe(0);
      expect(record.resolved).toBe(false);
      expect(wrongEvent.resolved).toBe(false);

      // 1 lượt trả lời đúng trong Classic Quiz
      const correctEvent = store.recordQuizMistakeResult('quiz_word_1', true, {
        source: 'classic_quiz',
        type: 'meaning',
      });

      record = useAppStore.getState().mistakeBank['quiz_word_1'];
      expect(record.mistakeCount).toBe(1); // Không bị tăng thêm
      expect(record.consecutiveCorrect).toBe(1); // Chỉ tăng đúng +1, không bị double lên +2
      expect(record.resolved).toBe(false);
      expect(correctEvent.consecutiveCorrect).toBe(1);

      // Thêm 1 lượt đúng nữa -> đạt consecutiveCorrect 2 -> resolved
      const secondCorrect = store.recordQuizMistakeResult('quiz_word_1', true, {
        source: 'classic_quiz',
        type: 'meaning',
      });

      record = useAppStore.getState().mistakeBank['quiz_word_1'];
      expect(record.consecutiveCorrect).toBe(2);
      expect(record.resolved).toBe(true);
      expect(secondCorrect.newlyResolved).toBe(true);
    });

    it('Fix 2: pronunciation threshold behavior contract (<60% mistake, 60-74% neutral, >=75% correct)', () => {
      useAppStore.setState({ mistakeBank: {} });
      const store = useAppStore.getState();

      const testWord = { id: 'pron_target', word: 'orchestra', meaning: 'dàn nhạc', ipa: '/ˈɔːkɪstrə/' };

      // Giả lập luồng chấm điểm đã đồng bộ:
      // Case A: score = 55% (< 60%) -> ghi nhận mistake
      const simulatePronunciationResult = (score: number, transcript: string) => {
        if (score >= 75) {
          store.recordMistakeCorrect(testWord.id, { type: 'pronunciation' });
        } else if (score >= 60) {
          // Neutral: không ghi mistake và không ghi correct
        } else {
          store.recordMistake(testWord, 'pronunciation', {
            type: 'pronunciation',
            userAnswer: transcript,
            expectedAnswer: testWord.word,
          });
        }
      };

      // 1. Lần 1: 55% (< 60%) -> ghi nhận lỗi
      simulatePronunciationResult(55, 'okestra');
      let rec = useAppStore.getState().mistakeBank['pron_target'];
      expect(rec.mistakeCount).toBe(1);
      expect(rec.consecutiveCorrect).toBe(0);

      // 2. Lần 2: 68% (60% đến < 75%) -> Neutral! Giữ nguyên, không tăng mistake, không tăng consecutiveCorrect
      simulatePronunciationResult(68, 'orckestra');
      rec = useAppStore.getState().mistakeBank['pron_target'];
      expect(rec.mistakeCount).toBe(1);
      expect(rec.consecutiveCorrect).toBe(0);

      // 3. Lần 3: 78% (>= 75%) -> Correct! Tăng consecutiveCorrect lên 1
      simulatePronunciationResult(78, 'orchestra');
      rec = useAppStore.getState().mistakeBank['pron_target'];
      expect(rec.mistakeCount).toBe(1);
      expect(rec.consecutiveCorrect).toBe(1);
    });

    it('Fix 3: short words (<= 3 chars) are never falsely classified as minor typos', () => {
      // Từ ngắn <= 3 ký tự phải là spelling_gap dù khoảng cách Levenshtein = 1
      const catCar = classifyMistakeCause({
        source: 'dictation',
        type: 'spelling',
        userAnswer: 'car',
        expectedAnswer: 'cat',
      });
      expect(catCar.levenshteinDistance).toBe(1);
      expect(catCar.isTypo).toBe(false);
      expect(catCar.subReason).toBe('spelling_gap');

      const itIs = classifyMistakeCause({
        source: 'dictation',
        type: 'spelling',
        userAnswer: 'is',
        expectedAnswer: 'it',
      });
      expect(itIs.levenshteinDistance).toBe(1);
      expect(itIs.isTypo).toBe(false);
      expect(itIs.subReason).toBe('spelling_gap');

      const toDo = classifyMistakeCause({
        source: 'word_scramble',
        type: 'spelling',
        userAnswer: 'do',
        expectedAnswer: 'to',
      });
      expect(toDo.levenshteinDistance).toBe(1);
      expect(toDo.isTypo).toBe(false);
      expect(toDo.subReason).toBe('spelling_gap');

      // Từ dài >= 4 ký tự có dist = 1 thì là minor_typo
      const bookBlok = classifyMistakeCause({
        source: 'dictation',
        type: 'spelling',
        userAnswer: 'blok',
        expectedAnswer: 'book',
      });
      expect(bookBlok.levenshteinDistance).toBe(1);
      expect(bookBlok.isTypo).toBe(true);
      expect(bookBlok.subReason).toBe('minor_typo');

      // Khoảng cách 2 đối với từ ngắn < 6 ký tự không coi là typo
      const tableTabel = classifyMistakeCause({
        source: 'dictation',
        type: 'spelling',
        userAnswer: 'tabel',
        expectedAnswer: 'table',
      });
      expect(tableTabel.levenshteinDistance).toBe(2);
      expect(tableTabel.isTypo).toBe(false);
      expect(tableTabel.subReason).toBe('spelling_gap');

      // Khoảng cách 2 đối với từ dài >= 6 ký tự là minor_typo
      const accommodate = classifyMistakeCause({
        source: 'dictation',
        type: 'spelling',
        userAnswer: 'acomodate',
        expectedAnswer: 'accommodate',
      });
      expect(accommodate.levenshteinDistance).toBe(2);
      expect(accommodate.isTypo).toBe(true);
      expect(accommodate.subReason).toBe('minor_typo');
    });

    it('Fix 4: minimum sample size gate (totalMistakes >= 5) prevents premature strong diagnostic insights', () => {
      // Trường hợp 1: Chỉ có 2 lỗi chính tả (mẫu quá nhỏ, totalMistakes < 5)
      const smallSampleMistakes: Record<string, MistakeRecord> = {
        m1: {
          id: 'm1',
          word: 'necessary',
          meaning: 'cần thiết',
          mistakeCount: 1,
          consecutiveCorrect: 0,
          resolved: false,
          primaryType: 'spelling',
          typeCounts: { spelling: 1 },
          source: 'dictation',
          sourceCounts: { dictation: 1 },
          lastMistakeAt: new Date().toISOString(),
        },
        m2: {
          id: 'm2',
          word: 'rhythm',
          meaning: 'nhịp điệu',
          mistakeCount: 1,
          consecutiveCorrect: 0,
          resolved: false,
          primaryType: 'spelling',
          typeCounts: { spelling: 1 },
          source: 'dictation',
          sourceCounts: { dictation: 1 },
          lastMistakeAt: new Date().toISOString(),
        },
      };

      const reportSmall = generateDetailedWeaknessReport(smallSampleMistakes);
      expect(reportSmall.summary.totalMistakes).toBe(2);
      expect(reportSmall.dominantWeaknessType).toBe('spelling');
      expect(reportSmall.dominantWeaknessPercentage).toBe(100);
      // Dù 100% lỗi chính tả nhưng cỡ mẫu < 5, không sinh cảnh báo SPELLING_VULNERABILITY
      expect(reportSmall.insights.some((i) => i.code === 'SPELLING_VULNERABILITY')).toBe(false);

      // Trường hợp 2: Có 5 lỗi (totalMistakes = 5 >= 5)
      const sufficientSampleMistakes: Record<string, MistakeRecord> = {
        ...smallSampleMistakes,
        m3: {
          id: 'm3',
          word: 'embarrass',
          meaning: 'làm bối rối',
          mistakeCount: 3,
          consecutiveCorrect: 0,
          resolved: false,
          primaryType: 'spelling',
          typeCounts: { spelling: 3 },
          source: 'dictation',
          sourceCounts: { dictation: 3 },
          lastMistakeAt: new Date().toISOString(),
        },
      };

      const reportSufficient = generateDetailedWeaknessReport(sufficientSampleMistakes);
      expect(reportSufficient.summary.totalMistakes).toBe(5);
      expect(reportSufficient.dominantWeaknessType).toBe('spelling');
      expect(reportSufficient.dominantWeaknessPercentage).toBe(100);
      // Cỡ mẫu >= 5 -> Đủ điều kiện sinh cảnh báo điểm yếu mạnh
      expect(reportSufficient.insights.some((i) => i.code === 'SPELLING_VULNERABILITY')).toBe(true);
    });
  });
});

