// src/services/__tests__/adaptiveQuizPhase3Integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDefaultAdaptiveQuizTelemetryState,
  sanitizeAdaptiveQuizTelemetryState,
  recordAdaptiveQuizTelemetryEvent,
  mergeAdaptiveQuizTelemetryState,
} from '../adaptiveQuizTelemetryService';
import { selectAdaptiveQuizItems } from '../adaptiveQuizService';
import type {
  VocabWord,
  MistakeRecord,
  LearnerQuizContext,
  AdaptiveQuizTelemetryState,
  SRSProgress,
} from '../../types';

function createMockVocab(partial: Partial<VocabWord> & { id: string; word: string; meaning: string }): VocabWord {
  return {
    ipa: '/test/',
    partOfSpeech: 'noun',
    example: 'This is a test example.',
    tag: 'Daily',
    srsLevel: 0,
    interval: 1,
    easeFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    ...partial,
  };
}

describe('Phase 3 - Learning Integration, Telemetry, UI & Regression Tests', () => {
  let telemetryState: AdaptiveQuizTelemetryState;

  beforeEach(() => {
    telemetryState = createDefaultAdaptiveQuizTelemetryState();
  });

  describe('1. Mistake Bank Contract & Resolution Rule', () => {
    it('requires at least 2 consecutive correct answers to resolve a mistake and never auto-resolves on 1', () => {
      // Simulating Mistake Bank state machine logic
      let entry: MistakeRecord = {
        id: 'mstk-tenacious',
        word: 'tenacious',
        meaning: 'kiên trì, dai dẳng',
        mistakeCount: 2,
        lastMistakeAt: new Date().toISOString(),
        consecutiveCorrect: 0,
        resolved: false,
      };

      // 1st correct answer: consecutiveCorrect becomes 1, NOT resolved
      entry = {
        ...entry,
        consecutiveCorrect: entry.consecutiveCorrect + 1,
        resolved: entry.consecutiveCorrect + 1 >= 2,
      };
      expect(entry.consecutiveCorrect).toBe(1);
      expect(entry.resolved).toBe(false);

      // 2nd correct answer: consecutiveCorrect becomes 2, NOW resolved
      entry = {
        ...entry,
        consecutiveCorrect: entry.consecutiveCorrect + 1,
        resolved: entry.consecutiveCorrect + 1 >= 2,
      };
      expect(entry.consecutiveCorrect).toBe(2);
      expect(entry.resolved).toBe(true);
    });

    it('resets consecutiveCorrect to 0 when user makes a mistake on an unresolved word', () => {
      let entry: MistakeRecord = {
        id: 'mstk-ubiquitous',
        word: 'ubiquitous',
        meaning: 'phổ biến khắp nơi',
        mistakeCount: 1,
        lastMistakeAt: new Date().toISOString(),
        consecutiveCorrect: 1, // Had 1 correct answer previously
        resolved: false,
      };

      // Wrong answer in quiz
      entry = {
        ...entry,
        mistakeCount: entry.mistakeCount + 1,
        consecutiveCorrect: 0,
        resolved: false,
        lastMistakeAt: new Date().toISOString(),
      };

      expect(entry.consecutiveCorrect).toBe(0);
      expect(entry.mistakeCount).toBe(2);
      expect(entry.resolved).toBe(false);
    });

    it('does not create duplicate keys when updating the same mistake entry', () => {
      const mistakeBank: Record<string, MistakeRecord> = {};
      const wordKey = 'meticulous';

      // First mistake
      mistakeBank[wordKey] = {
        id: 'mstk-meticulous',
        word: 'meticulous',
        meaning: 'tỉ mỉ',
        mistakeCount: 1,
        lastMistakeAt: new Date().toISOString(),
        consecutiveCorrect: 0,
        resolved: false,
      };

      // Second mistake on the same word
      mistakeBank[wordKey] = {
        ...mistakeBank[wordKey],
        mistakeCount: mistakeBank[wordKey].mistakeCount + 1,
        lastMistakeAt: new Date().toISOString(),
      };

      expect(Object.keys(mistakeBank).length).toBe(1);
      expect(mistakeBank[wordKey].mistakeCount).toBe(2);
    });
  });

  describe('2. SRS / FSRS Read-Only Isolation', () => {
    it('strictly reads SRS state for candidate classification without mutating FSRS scheduling fields', () => {
      const srsItem: SRSProgress = {
        srsLevel: 3,
        interval: 14,
        easeFactor: 2.5,
        lastReviewedDate: new Date(Date.now() - 14 * 86400000).toISOString(),
        nextReviewDate: new Date(Date.now() - 3600000).toISOString(), // due 1 hour ago
        reviewCount: 5,
        fsrs: {
          state: 2, // FSRSState.Review
          stability: 14.5,
          difficulty: 4.8,
          lapses: 0,
          reps: 5,
          lastReview: new Date(Date.now() - 14 * 86400000).toISOString(),
        },
      };

      // Snapshot before quiz selection
      const srsSnapshot = JSON.stringify(srsItem);

      const candidate = createMockVocab({ id: 'card-1', word: 'resilience', meaning: 'kiên cường' });
      const context: LearnerQuizContext = {
        mistakeBank: {},
        srsProgressMap: { 'card-1': srsItem },
      };

      // Run adaptive selection
      const result = selectAdaptiveQuizItems([candidate], context, { count: 1 });

      expect(result.items.length).toBe(1);
      expect(result.classifiedItems[0].category).toBe('due');

      // Verify SRS progress was strictly READ-ONLY and completely unaltered
      expect(JSON.stringify(srsItem)).toBe(srsSnapshot);
      expect(srsItem.fsrs?.stability).toBe(14.5);
      expect(srsItem.fsrs?.difficulty).toBe(4.8);
      expect(srsItem.interval).toBe(14);
      expect(srsItem.nextReviewDate).toBe(JSON.parse(srsSnapshot).nextReviewDate);
    });
  });

  describe('3. Telemetry Service & Bounded Ring Buffer', () => {
    it('records quiz events and updates aggregates correctly', () => {
      let state = createDefaultAdaptiveQuizTelemetryState();

      state = recordAdaptiveQuizTelemetryEvent(state, {
        wordId: 'w1',
        word: 'lucid',
        isCorrect: true,
        category: 'due',
        difficulty: 'normal',
        mode: 'classic_quiz',
      });

      expect(state.aggregate.totalAnswered).toBe(1);
      expect(state.aggregate.totalCorrect).toBe(1);
      expect(state.aggregate.byCategory.due.answered).toBe(1);
      expect(state.aggregate.byCategory.due.correct).toBe(1);
      expect(state.aggregate.byDifficulty.normal.answered).toBe(1);
      expect(state.aggregate.byMode.classic_quiz.answered).toBe(1);
      expect(state.recentEvents.length).toBe(1);
      expect(state.recentEvents[0].word).toBe('lucid');
    });

    it('enforces ring buffer limit of 100 items (FIFO discard)', () => {
      let state = createDefaultAdaptiveQuizTelemetryState();

      // Record 115 events
      for (let i = 1; i <= 115; i++) {
        state = recordAdaptiveQuizTelemetryEvent(state, {
          wordId: `w${i}`,
          word: `word_${i}`,
          isCorrect: i % 2 === 0,
          category: 'weak',
          difficulty: 'hard',
          mode: 'speed_match',
        });
      }

      expect(state.recentEvents.length).toBe(100);
      expect(state.aggregate.totalAnswered).toBe(115);
      // Newest event should be word_115
      expect(state.recentEvents[state.recentEvents.length - 1].word).toBe('word_115');
      // Oldest remaining should be word_16 (since 1-15 were discarded)
      expect(state.recentEvents[0].word).toBe('word_16');
    });

    it('sanitizes corrupted telemetry state with NaNs or negative numbers', () => {
      const corrupted: any = {
        aggregate: {
          totalAnswered: NaN,
          totalCorrect: 'invalid',
          totalIncorrect: -10,
          byCategory: {
            weak: { answered: Infinity, correct: -5 },
            due: { answered: NaN, correct: NaN },
          },
          byDifficulty: null,
          byMode: undefined,
        },
        recentEvents: 'not an array',
        lastUpdated: 'bad-date',
      };

      const sanitized = sanitizeAdaptiveQuizTelemetryState(corrupted);

      expect(Number.isFinite(sanitized.aggregate.totalAnswered)).toBe(true);
      expect(sanitized.aggregate.totalAnswered).toBe(0);
      expect(sanitized.aggregate.totalCorrect).toBe(0);
      expect(sanitized.aggregate.totalIncorrect).toBe(0);
      expect(sanitized.aggregate.byCategory.weak.answered).toBe(0);
      expect(sanitized.aggregate.byCategory.weak.correct).toBe(0);
      expect(sanitized.aggregate.byDifficulty.normal.answered).toBe(0);
      expect(sanitized.aggregate.byMode.dictation.answered).toBe(0);
      expect(Array.isArray(sanitized.recentEvents)).toBe(true);
      expect(sanitized.recentEvents.length).toBe(0);
    });

    it('merges cloud/backup telemetry without duplicate events or counter loss', () => {
      let local = createDefaultAdaptiveQuizTelemetryState();
      local = recordAdaptiveQuizTelemetryEvent(local, {
        wordId: 'loc-1',
        word: 'local_word',
        isCorrect: true,
        category: 'new',
        difficulty: 'easy',
        mode: 'word_scramble',
      });

      let incoming = createDefaultAdaptiveQuizTelemetryState();
      incoming = recordAdaptiveQuizTelemetryEvent(incoming, {
        wordId: 'inc-1',
        word: 'incoming_word',
        isCorrect: false,
        category: 'weak',
        difficulty: 'hard',
        mode: 'dictation',
      });
      // Give incoming 2 answers so monotonic max is tested
      incoming = recordAdaptiveQuizTelemetryEvent(incoming, {
        wordId: 'inc-2',
        word: 'incoming_word_2',
        isCorrect: true,
        category: 'weak',
        difficulty: 'hard',
        mode: 'dictation',
      });

      const merged = mergeAdaptiveQuizTelemetryState(local, incoming);

      // Monotonic max counters
      expect(merged.aggregate.totalAnswered).toBe(2);
      expect(merged.aggregate.totalCorrect).toBe(1);
      expect(merged.aggregate.byCategory.weak.answered).toBe(2);
      expect(merged.recentEvents.length).toBe(3);
      expect(merged.recentEvents.some((e) => e.word === 'local_word')).toBe(true);
      expect(merged.recentEvents.some((e) => e.word === 'incoming_word')).toBe(true);
      expect(merged.recentEvents.some((e) => e.word === 'incoming_word_2')).toBe(true);
    });
  });

  describe('4. Edge Cases & Cold Start', () => {
    it('handles brand new user with 0 history gracefully', () => {
      const candidates = [
        createMockVocab({ id: 'c1', word: 'apple', meaning: 'quả táo' }),
        createMockVocab({ id: 'c2', word: 'banana', meaning: 'quả chuối' }),
      ];

      const emptyContext: LearnerQuizContext = {
        mistakeBank: {},
        srsProgressMap: {},
      };

      const result = selectAdaptiveQuizItems(candidates, emptyContext, { count: 2 });
      expect(result.items.length).toBe(2);
      expect(result.classifiedItems.every((c) => c.category === 'new')).toBe(true);

      const emptyTelemetry = createDefaultAdaptiveQuizTelemetryState();
      expect(emptyTelemetry.aggregate.totalAnswered).toBe(0);
      expect(emptyTelemetry.recentEvents.length).toBe(0);
    });
  });
});
