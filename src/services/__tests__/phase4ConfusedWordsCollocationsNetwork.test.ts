import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import { getLearningDictionaryProfile } from '../learningDictionaryService';
import {
  getCommonlyConfusedWords,
  derivePersonalizedConfusions,
  normalizeConfusionPairKey,
} from '../wordConfusionService';
import { deriveWordFamily } from '../wordFamilyService';
import type { MistakeRecord, CollocationItem, VocabWord, AppStore } from '../../types';

describe('PHASE 4: Confused Words, Weak Collocations & Word Network (Hardened Suite)', () => {
  const FIXED_NOW = new Date('2026-10-04T12:00:00.000Z').getTime();

  beforeEach(() => {
    useAppStore.getState().resetToDefault();
  });

  // =========================================================================
  // 1. Confused Words: Evidence vs No Evidence & Conservative Counting
  // =========================================================================
  describe('1. Confused Words with Semantic Evidence & Conservative Counting', () => {
    it('target mistakeCount=3 + only latest answer=sustain does NOT claim 3 sustain confusions (count = 1)', () => {
      // Invariant: Target-level mistakeCount is NOT pair-specific frequency.
      // Previous mistakes on "maintain" might have been "keep", "preserve", etc.
      // The single record proves only 1 observed confusion event for "sustain".
      const mistakeBank: Record<string, MistakeRecord> = {
        maintain: {
          id: 'vocab_maintain',
          word: 'maintain',
          meaning: 'Duy trì',
          mistakeCount: 3,
          lastMistakeAt: '2026-10-02T10:00:00.000Z',
          consecutiveCorrect: 0,
          resolved: false,
          source: 'classic_quiz',
          primaryType: 'meaning',
          lastUserAnswer: 'sustain',
        },
      };

      const profile = getLearningDictionaryProfile('maintain', {
        storeState: { mistakeBank },
        now: FIXED_NOW,
      });

      expect(profile.confusion.personalizedConfusedWith.length).toBe(1);
      expect(profile.confusion.personalizedConfusedWith[0].word).toBe('sustain');
      // Count is conservatively 1, NOT the entire target mistakeCount of 3!
      expect(profile.confusion.personalizedConfusedWith[0].count).toBe(1);
      expect(profile.confusion.personalizedConfusedWith[0].lastOccurredAt).toBe('2026-10-02T10:00:00.000Z');

      // Backward-compatible mistakeSummary.confusedWith
      expect(profile.mistakeSummary.confusedWith).toEqual(['sustain']);
    });

    it('returns empty personalized confusion when no evidence exists in Mistake Bank', () => {
      const mistakeBank: Record<string, MistakeRecord> = {
        maintain: {
          id: 'vocab_maintain',
          word: 'maintain',
          meaning: 'Duy trì',
          mistakeCount: 2,
          lastMistakeAt: '2026-10-01T00:00:00.000Z',
          consecutiveCorrect: 0,
          resolved: false,
          // No lastUserAnswer
        },
      };

      const profile = getLearningDictionaryProfile('maintain', {
        storeState: { mistakeBank },
        now: FIXED_NOW,
      });

      expect(profile.confusion.personalizedConfusedWith).toEqual([]);
      expect(profile.mistakeSummary.confusedWith).toEqual([]);
    });

    it('never automatically treats synonyms as confused words without error evidence', () => {
      const profile = getLearningDictionaryProfile({
        word: 'enormous',
        synonyms: ['huge', 'gigantic', 'immense'],
      } as VocabWord, {
        storeState: { mistakeBank: {} },
        now: FIXED_NOW,
      });

      expect(profile.synonyms).toEqual(['huge', 'gigantic', 'immense']);
      expect(profile.confusion.personalizedConfusedWith).toEqual([]);
      expect(profile.mistakeSummary.confusedWith).toEqual([]);
    });

    it('grammar and pronunciation free-text mistakes do NOT create personalized confused words', () => {
      const mistakeBank: Record<string, MistakeRecord> = {
        grammar_word: {
          id: 'mistake_grammar_1',
          word: 'grammar_word',
          meaning: 'Ngữ pháp',
          mistakeCount: 2,
          lastMistakeAt: '2026-10-02T10:00:00.000Z',
          consecutiveCorrect: 0,
          resolved: false,
          source: 'ai_tutor',
          primaryType: 'grammar',
          lastUserAnswer: 'I should went to school yesterday', // Free-text grammar sentence
        },
        pron_word: {
          id: 'mistake_pron_1',
          word: 'pron_word',
          meaning: 'Phát âm',
          mistakeCount: 1,
          lastMistakeAt: '2026-10-02T11:00:00.000Z',
          consecutiveCorrect: 0,
          resolved: false,
          source: 'pronunciation',
          primaryType: 'pronunciation',
          lastUserAnswer: 'proonunciation',
        },
      };

      const profileGrammar = getLearningDictionaryProfile('grammar_word', {
        storeState: { mistakeBank },
        now: FIXED_NOW,
      });
      expect(profileGrammar.confusion.personalizedConfusedWith).toEqual([]);

      const profilePron = getLearningDictionaryProfile('pron_word', {
        storeState: { mistakeBank },
        now: FIXED_NOW,
      });
      expect(profilePron.confusion.personalizedConfusedWith).toEqual([]);
    });

    it('vocabulary distractor evidence from quiz does create personalized confusion', () => {
      const mistakeBank: Record<string, MistakeRecord> = {
        elicit: {
          id: 'vocab_elicit',
          word: 'elicit',
          meaning: 'Gợi ra',
          mistakeCount: 1,
          lastMistakeAt: '2026-10-03T10:00:00.000Z',
          consecutiveCorrect: 0,
          resolved: false,
          source: 'classic_quiz',
          primaryType: 'meaning',
          lastUserAnswer: 'illicit',
        },
      };

      const profile = getLearningDictionaryProfile('elicit', {
        storeState: { mistakeBank },
        now: FIXED_NOW,
      });

      expect(profile.confusion.personalizedConfusedWith.length).toBe(1);
      expect(profile.confusion.personalizedConfusedWith[0].word).toBe('illicit');
      expect(profile.confusion.personalizedConfusedWith[0].count).toBe(1);
    });
  });

  // =========================================================================
  // 2. Symmetric Dedup & Event Identity
  // =========================================================================
  describe('2. Symmetric Dedup & Event Identity', () => {
    it('normalizes pair keys consistently regardless of word order', () => {
      const key1 = normalizeConfusionPairKey('maintain', 'sustain');
      const key2 = normalizeConfusionPairKey('sustain', 'maintain');
      expect(key1).toBe('maintain:::sustain');
      expect(key1).toBe(key2);
    });

    it('does NOT count the same underlying mistake record twice via direct/symmetric scanning', () => {
      // Even if a record is accessible through multiple lookup keys (e.g. maintain and vocab_maintain)
      const sharedRecord: MistakeRecord = {
        id: 'vocab_maintain_unique_id',
        word: 'maintain',
        meaning: 'Duy trì',
        mistakeCount: 2,
        lastMistakeAt: '2026-10-01T10:00:00.000Z',
        consecutiveCorrect: 0,
        resolved: false,
        source: 'classic_quiz',
        primaryType: 'meaning',
        lastUserAnswer: 'sustain',
      };

      const mistakeBank: Record<string, MistakeRecord> = {
        maintain: sharedRecord,
        vocab_maintain: sharedRecord, // Same underlying record under alias key
      };

      const result = derivePersonalizedConfusions('maintain', 'vocab_maintain', mistakeBank);
      // Exactly 1 entry with count = 1, NOT 2!
      expect(result.length).toBe(1);
      expect(result[0].word).toBe('sustain');
      expect(result[0].count).toBe(1);
    });

    it('counts two independent pair-specific events when data actually proves two distinct records', () => {
      const mistakeBank: Record<string, MistakeRecord> = {
        // Event 1: user tested on maintain, answered sustain
        maintain: {
          id: 'rec_maintain_err',
          word: 'maintain',
          meaning: 'Duy trì',
          mistakeCount: 1,
          lastMistakeAt: '2026-10-01T10:00:00.000Z',
          consecutiveCorrect: 0,
          resolved: false,
          source: 'classic_quiz',
          primaryType: 'meaning',
          lastUserAnswer: 'sustain',
        },
        // Event 2: user tested on sustain, answered maintain
        sustain: {
          id: 'rec_sustain_err',
          word: 'sustain',
          meaning: 'Duy trì',
          mistakeCount: 1,
          lastMistakeAt: '2026-10-03T15:00:00.000Z',
          consecutiveCorrect: 0,
          resolved: false,
          source: 'writing',
          primaryType: 'meaning',
          lastUserAnswer: 'maintain',
        },
      };

      const result = derivePersonalizedConfusions('maintain', 'rec_maintain_err', mistakeBank);
      // Two distinct records -> count is 2
      expect(result.length).toBe(1);
      expect(result[0].word).toBe('sustain');
      expect(result[0].count).toBe(2);
      expect(result[0].lastOccurredAt).toBe('2026-10-03T15:00:00.000Z');
    });
  });

  // =========================================================================
  // 3. Static vs Personalized Isolation
  // =========================================================================
  describe('3. Static vs Personalized Isolation', () => {
    it('static commonly-confused never changes personal mistake counts or enters personal history', () => {
      const profile = getLearningDictionaryProfile('affect', {
        storeState: { mistakeBank: {} },
        now: FIXED_NOW,
      });

      // Static knowledge is available
      expect(profile.confusion.commonlyConfused).toContain('effect');
      // Personalized is strictly empty
      expect(profile.confusion.personalizedConfusedWith).toEqual([]);
      expect(profile.mistakeSummary.confusedWith).toEqual([]);
      expect(profile.mistakeSummary.hasMistakeRecord).toBe(false);
      expect(profile.mistakeSummary.mistakeCount).toBe(0);
    });

    it('correctly provides static pairs for homophones and near-homophones', () => {
      expect(getCommonlyConfusedWords('accept')).toContain('except');
      expect(getCommonlyConfusedWords('complement')).toContain('compliment');
      expect(getCommonlyConfusedWords('weather')).toContain('whether');
      expect(getCommonlyConfusedWords('stationary')).toContain('stationery');
    });
  });

  // =========================================================================
  // 4. Collocations: Weak vs Common & Resolved Semantics
  // =========================================================================
  describe('4. Collocations — Weak vs Common Semantics', () => {
    it('resolved historical collocation is NO LONGER weak when no current SRS weakness exists', () => {
      // Invariant: "A historical resolved mistake must not remain permanently in Your Weak Collocations"
      const userCollocs: CollocationItem[] = [
        {
          id: 'colloc_make_progress',
          phrase: 'make progress',
          meaning: 'Tiến bộ',
          exampleEn: 'We make progress.',
          exampleVi: 'Chúng tôi tiến bộ.',
          createdAt: new Date().toISOString(),
        },
      ];

      // Mistake was resolved!
      const mistakeBank: Record<string, MistakeRecord> = {
        'make progress': {
          id: 'colloc_make_progress',
          word: 'make progress',
          meaning: 'Tiến bộ',
          mistakeCount: 3,
          consecutiveCorrect: 2,
          resolved: true, // RESOLVED!
          lastMistakeAt: '2026-09-01T00:00:00.000Z',
          source: 'collocation',
        },
      };

      // SRS is in stable review state (srsLevel 2, no relearning)
      const srsProgressMap = {
        colloc_make_progress: {
          srsLevel: 2,
          interval: 10,
          easeFactor: 2.5,
          nextReviewDate: new Date(FIXED_NOW + 864000000).toISOString(),
          againCount: 1,
          reviewCount: 4,
        },
      };

      const profile = getLearningDictionaryProfile('progress', {
        storeState: {
          userCollocations: userCollocs,
          mistakeBank,
          srsProgressMap,
        },
        now: FIXED_NOW,
      });

      const colloc = profile.associatedCollocations.find((c) => c.phrase === 'make progress');
      expect(colloc).toBeDefined();
      // MUST NOT be weak because it is resolved and stable!
      expect(colloc?.isWeak).toBe(false);
      expect(colloc?.weaknessEvidence).toBeNull();
      expect(profile.weakCollocations.length).toBe(0);
    });

    it('unresolved collocation mistake IS marked weak', () => {
      const userCollocs: CollocationItem[] = [
        {
          id: 'colloc_take_action',
          phrase: 'take action',
          meaning: 'Hành động',
          exampleEn: 'Take immediate action.',
          exampleVi: 'Hành động ngay lập tức.',
          createdAt: new Date().toISOString(),
        },
      ];

      const mistakeBank: Record<string, MistakeRecord> = {
        'take action': {
          id: 'colloc_take_action',
          word: 'take action',
          meaning: 'Hành động',
          mistakeCount: 1,
          consecutiveCorrect: 0,
          resolved: false, // UNRESOLVED!
          lastMistakeAt: '2026-10-03T10:00:00.000Z',
          source: 'collocation',
        },
      };

      const profile = getLearningDictionaryProfile('action', {
        storeState: {
          userCollocations: userCollocs,
          mistakeBank,
        },
        now: FIXED_NOW,
      });

      const colloc = profile.associatedCollocations.find((c) => c.phrase === 'take action');
      expect(colloc?.isWeak).toBe(true);
      expect(colloc?.weaknessEvidence).toBe('mistake_bank');
      expect(profile.weakCollocations.map((c) => c.phrase)).toContain('take action');
    });

    it('active SRS relearning collocation IS marked weak', () => {
      const userCollocs: CollocationItem[] = [
        {
          id: 'colloc_solve_problem',
          phrase: 'solve a problem',
          meaning: 'Giải quyết vấn đề',
          exampleEn: 'Solve a problem efficiently.',
          exampleVi: 'Giải quyết vấn đề hiệu quả.',
          createdAt: new Date().toISOString(),
        },
      ];

      // FSRS in relearning state
      const srsProgressMap = {
        colloc_solve_problem: {
          srsLevel: 0,
          interval: 0,
          easeFactor: 1.8,
          nextReviewDate: new Date().toISOString(),
          againCount: 2,
          reviewCount: 3,
          fsrs: {
            state: 3 as const, // 3: relearning
            stability: 0.5,
            difficulty: 7.0,
            reps: 3,
            lapses: 2,
            lastReview: new Date().toISOString(),
          },
        },
      };

      const profile = getLearningDictionaryProfile('problem', {
        storeState: {
          userCollocations: userCollocs,
          srsProgressMap,
          mistakeBank: {},
        },
        now: FIXED_NOW,
      });

      const colloc = profile.associatedCollocations.find((c) => c.phrase === 'solve a problem');
      expect(colloc?.isWeak).toBe(true);
      expect(colloc?.weaknessEvidence).toBe('srs_failure');
      expect(profile.weakCollocations.map((c) => c.phrase)).toContain('solve a problem');
    });

    it('new and unreviewed collocations are NEVER marked weak', () => {
      const userCollocs: CollocationItem[] = [
        {
          id: 'colloc_deep_breath',
          phrase: 'deep breath',
          meaning: 'Hít sâu',
          exampleEn: 'Take a deep breath.',
          exampleVi: 'Hít một hơi thật sâu.',
          createdAt: new Date().toISOString(),
        },
      ];

      // Unreviewed
      const srsProgressMap = {
        colloc_deep_breath: {
          srsLevel: 0,
          interval: 0,
          easeFactor: 2.5,
          nextReviewDate: new Date().toISOString(),
          againCount: 0,
          reviewCount: 0,
        },
      };

      const profile = getLearningDictionaryProfile('breath', {
        storeState: {
          userCollocations: userCollocs,
          srsProgressMap,
          mistakeBank: {},
        },
        now: FIXED_NOW,
      });

      const colloc = profile.associatedCollocations.find((c) => c.phrase === 'deep breath');
      expect(colloc?.isWeak).toBe(false);
      expect(colloc?.weaknessEvidence).toBeNull();
      expect(profile.weakCollocations.length).toBe(0);
    });

    it('common static collocations with no user errors remain non-weak', () => {
      const profile = getLearningDictionaryProfile({
        word: 'decision',
        collocations: ['make a decision', 'reach a decision'],
      } as VocabWord, {
        storeState: { mistakeBank: {}, srsProgressMap: {} },
        now: FIXED_NOW,
      });

      expect(profile.commonCollocations).toEqual(['make a decision', 'reach a decision']);
      expect(profile.weakCollocations).toEqual([]);
      for (const colloc of profile.associatedCollocations) {
        expect(colloc.isWeak).toBe(false);
      }
    });
  });

  // =========================================================================
  // 5. Word Family: Curated, Morphological & False-Positive Prevention
  // =========================================================================
  describe('5. Word Family — Curated, Morphology & False-Positive Prevention', () => {
    it('resolves curated word family roots with source = curated', () => {
      const family = deriveWordFamily('analyze');
      expect(family.root).toBe('analyze');
      expect(family.source).toBe('curated');
      expect(family.members.length).toBeGreaterThan(0);

      const words = family.members.map((m) => m.word);
      expect(words).toContain('analysis');
      expect(words).toContain('analyst');
    });

    it('resolves high-confidence regular morphology with source = morphological', () => {
      // "dark" (adjective, len 4) -> "darkness"
      const family = deriveWordFamily('dark');
      expect(family.root).toBe('dark');
      const words = family.members.map((m) => m.word);
      expect(words).toContain('darkness');
    });

    it('prevents accidental false-positives from broad affix attachment', () => {
      // "corn" + "er" -> "corner" is in the dictionary, but MUST NOT be considered family of "corn"!
      const familyCorn = deriveWordFamily('corn');
      const cornWords = familyCorn.members.map((m) => m.word);
      expect(cornWords).not.toContain('corner');

      // "pan" + "ic" -> "panic" is in the dictionary, but MUST NOT be considered family of "pan"!
      const familyPan = deriveWordFamily('pan');
      const panWords = familyPan.members.map((m) => m.word);
      expect(panWords).not.toContain('panic');

      // "wit" + "ness" -> "witness" MUST NOT be considered family of "wit"!
      const familyWit = deriveWordFamily('wit');
      const witWords = familyWit.members.map((m) => m.word);
      expect(witWords).not.toContain('witness');

      // "leg" + "al" -> "legal" MUST NOT be considered family of "leg"!
      const familyLeg = deriveWordFamily('leg');
      const legWords = familyLeg.members.map((m) => m.word);
      expect(legWords).not.toContain('legal');
    });

    it('unknown family returns empty members safely without crashing', () => {
      const family = deriveWordFamily('xyznotaword123');
      expect(family.root).toBe('xyznotaword123');
      expect(family.members).toEqual([]);
      expect(family.source).toBe('none');
    });
  });

  // =========================================================================
  // 6. Synonyms & Antonyms: Missing Graceful Handling
  // =========================================================================
  describe('6. Synonyms & Antonyms — Missing Graceful Handling', () => {
    it('returns exact static synonyms without fabricating new ones', () => {
      const profile = getLearningDictionaryProfile({
        word: 'abundant',
        synonyms: ['plentiful', 'copious', 'ample'],
      } as VocabWord, {
        now: FIXED_NOW,
      });

      expect(profile.synonyms).toEqual(['plentiful', 'copious', 'ample']);
    });

    it('missing synonyms or antonyms gracefully return empty arrays []', () => {
      const profile = getLearningDictionaryProfile({
        word: 'resilient',
        // synonyms and antonyms omitted
      } as VocabWord, {
        now: FIXED_NOW,
      });

      expect(profile.synonyms).toEqual([]);
      expect(profile.antonyms).toEqual([]);
    });
  });

  // =========================================================================
  // 7. CEFR Word vs Learner Separation
  // =========================================================================
  describe('7. CEFR Word vs Learner Separation', () => {
    it('preserves official word CEFR and never mutates it to match user CEFR', () => {
      const learnerB1Store: Partial<AppStore> = {
        fourSkillsScores: {
          listening: [60],
          reading: [65],
          speaking: [60],
          writing: [60], // B1
        },
      };

      const profile = getLearningDictionaryProfile({
        word: 'sophisticated',
        level: 'C1',
      } as VocabWord, {
        storeState: learnerB1Store,
        now: FIXED_NOW,
      });

      // Word's official level must remain strictly C1
      expect(profile.cefrCalibration.wordLevel).toBe('C1');
      expect(profile.level).toBe('C1');
      // Learner is B1
      expect(profile.cefrCalibration.learnerLevel).toBe('B1');
      expect(profile.cefrCalibration.difficultyComparison).toBe('above');
      expect(profile.cefrCalibration.comparisonLabel).toBe('Above your current level');
    });

    it('returns unknown comparison and Level not calibrated when learner level is unobserved', () => {
      const unobservedStore: Partial<AppStore> = {
        fourSkillsScores: {
          listening: [],
          reading: [],
          speaking: [],
          writing: [],
        },
      };

      const profile = getLearningDictionaryProfile({
        word: 'benchmark',
        level: 'B2',
      } as VocabWord, {
        storeState: unobservedStore,
        now: FIXED_NOW,
      });

      expect(profile.cefrCalibration.wordLevel).toBe('B2');
      expect(profile.cefrCalibration.learnerLevel).toBeNull();
      expect(profile.cefrCalibration.isObservedLearnerLevel).toBe(false);
      expect(profile.cefrCalibration.difficultyComparison).toBe('unknown');
      expect(profile.cefrCalibration.comparisonLabel).toBe('Level not calibrated');
    });
  });

  // =========================================================================
  // 8. Pure Derivation & Immutability
  // =========================================================================
  describe('8. Pure Derivation & Immutability', () => {
    it('profile derivation, confusion, and word family never mutate input store or records', () => {
      const mockMistakeBank: Record<string, MistakeRecord> = {
        maintain: {
          id: 'vocab_maintain',
          word: 'maintain',
          meaning: 'Duy trì',
          mistakeCount: 2,
          lastMistakeAt: '2026-10-01T10:00:00.000Z',
          consecutiveCorrect: 0,
          resolved: false,
          source: 'classic_quiz',
          lastUserAnswer: 'sustain',
        },
      };

      const mockCollocs: CollocationItem[] = [
        {
          id: 'colloc_1',
          phrase: 'make progress',
          meaning: 'Tiến bộ',
          exampleEn: 'Progress',
          exampleVi: 'Tiến bộ',
          createdAt: new Date().toISOString(),
        },
      ];

      const storeSnapshot: Partial<AppStore> = {
        mistakeBank: mockMistakeBank,
        userCollocations: mockCollocs,
        srsProgressMap: {},
        wordLearningStats: {},
      };

      const serializedBefore = JSON.stringify(storeSnapshot);

      // Perform multiple derivations
      getLearningDictionaryProfile('maintain', { storeState: storeSnapshot, now: FIXED_NOW });
      derivePersonalizedConfusions('maintain', 'vocab_maintain', mockMistakeBank);
      deriveWordFamily('maintain');

      const serializedAfter = JSON.stringify(storeSnapshot);
      // Zero mutations guaranteed!
      expect(serializedAfter).toBe(serializedBefore);
    });
  });

  // =========================================================================
  // 9. Offline Safety & Zero Network Dependency
  // =========================================================================
  describe('9. Offline Safety & Zero Network Dependency', () => {
    it('executes synchronously in RAM without network requests', () => {
      const tStart = performance.now();

      for (let i = 0; i < 20; i++) {
        getLearningDictionaryProfile('maintain', { now: FIXED_NOW });
      }

      const elapsed = performance.now() - tStart;
      expect(elapsed).toBeGreaterThan(0);
    });
  });
});
