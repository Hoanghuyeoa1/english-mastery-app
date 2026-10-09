// src/services/__tests__/personalizedInsightService.test.ts
import { describe, it, expect } from 'vitest';
import {
  derivePersonalizedInsights,
  derivePersonalizedInsightsSummary,
  deduplicateInsights,
  balanceInsights,
  isLearnerNewUser,
  type PersonalizedInsightSource,
  type ConfusionInsight,
  type ForgettingRiskInsight,
  type LeechInsight,
  type WeakCollocationInsight,
  type SkillGapInsight,
  type UsageGapInsight,
  type RetentionInsight,
  type ImprovementInsight,
} from '../personalizedInsightService';
import type {
  SRSProgress,
  MistakeRecord,
  CollocationItem,
  FourSkillsEvidenceStore,
  WordLearningStatsMap,
  DailyProgress,
} from '../../types';

describe('Personalized Learning Insights Engine — Phase 1', () => {
  const baseTimestamp = 1700000000000;

  // -------------------------------------------------------------------------
  // 1. Type & Contract Validity
  // -------------------------------------------------------------------------
  it('1. verifies contract integrity and discriminated union properties', () => {
    const mockMistakeBank: Record<string, MistakeRecord> = {
      rec_1: {
        id: 'rec_1',
        word: 'accept',
        meaning: 'chấp nhận',
        mistakeCount: 3,
        lastMistakeAt: new Date(baseTimestamp).toISOString(),
        consecutiveCorrect: 0,
        resolved: false,
        primaryType: 'meaning',
        source: 'classic_quiz',
        lastUserAnswer: 'except',
      },
    };

    const insights = derivePersonalizedInsights({
      mistakeBank: mockMistakeBank,
      now: baseTimestamp,
    });

    expect(insights.length).toBeGreaterThan(0);
    const confusion = insights.find((i) => i.type === 'confusion') as ConfusionInsight | undefined;
    expect(confusion).toBeDefined();
    if (confusion) {
      expect(confusion.id).toMatch(/^insight_confusion_/);
      expect(confusion.severity).toBe('warning');
      expect(confusion.confidence).toBe('moderate'); // 1 pair occurrence -> moderate
      expect(confusion.targetWord).toBe('accept');
      expect(confusion.confusedWith).toBe('except');
      expect(confusion.confusionCount).toBe(1);
      expect(confusion.action?.targetTab).toBe('flashcards');
      expect(typeof confusion.createdAt).toBe('number');
    }
  });

  // -------------------------------------------------------------------------
  // 2. Insufficient Evidence -> No Insight
  // -------------------------------------------------------------------------
  it('2. yields zero insights when input state is empty or below evidence thresholds', () => {
    const emptySource: PersonalizedInsightSource = {
      srsProgressMap: {},
      mistakeBank: {},
      userCollocations: [],
      fourSkillsEvidence: { listening: [], reading: [], speaking: [], writing: [] },
      wordLearningStats: {},
      dailyHistory: {},
      now: baseTimestamp,
    };

    const insights = derivePersonalizedInsights(emptySource);
    expect(insights).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 3. SM-2 -> No Fake Retrievability
  // -------------------------------------------------------------------------
  it('3. strictly isolates SM-2 from FSRS and never computes fake retrievability', () => {
    const srsMap: Record<string, SRSProgress> = {
      card_sm2: {
        srsLevel: 1,
        nextReviewDate: new Date(baseTimestamp - 86400000).toISOString(),
        interval: 1,
        easeFactor: 2.5,
        lastReviewedDate: new Date(baseTimestamp - 86400000 * 5).toISOString(),
        // Note: card_sm2 has NO FSRS state, or even if legacy fsrs exists but algorithm is sm2
      },
    };

    const insightsSM2 = derivePersonalizedInsights({
      srsProgressMap: srsMap,
      srsAlgorithm: 'sm2',
      fsrsSettings: { desiredRetention: 0.90, maximumInterval: 36500, w: [] },
      now: baseTimestamp,
    });

    const forgettingRisk = insightsSM2.find((i) => i.type === 'forgetting_risk');
    expect(forgettingRisk).toBeUndefined();
  });

  it('3b. generates forgetting_risk only for FSRS cards with genuine low retrievability', () => {
    const srsMap: Record<string, SRSProgress> = {
      card_fsrs: {
        srsLevel: 2,
        nextReviewDate: new Date(baseTimestamp - 86400000).toISOString(),
        interval: 3,
        easeFactor: 2.5,
        lastReviewedDate: new Date(baseTimestamp - 86400000 * 20).toISOString(),
        fsrs: {
          stability: 2.0, // Low stability after 20 days -> R ~ 0.50
          difficulty: 7.0,
          state: 2,
          reps: 3,
          lapses: 1,
          lastReview: new Date(baseTimestamp - 86400000 * 20).toISOString(),
        },
      },
    };

    const insightsFSRS = derivePersonalizedInsights({
      srsProgressMap: srsMap,
      srsAlgorithm: 'fsrs',
      fsrsSettings: { desiredRetention: 0.90, maximumInterval: 36500, w: [] },
      now: baseTimestamp,
    });

    const forgettingRisk = insightsFSRS.find((i) => i.type === 'forgetting_risk') as ForgettingRiskInsight | undefined;
    expect(forgettingRisk).toBeDefined();
    expect(forgettingRisk?.lowestRetrievability).toBeLessThan(0.90);
    expect(forgettingRisk?.severity).toBe('critical'); // < 0.70 -> critical
    expect(forgettingRisk?.confidence).toBe('strong');
  });

  // -------------------------------------------------------------------------
  // 4. Resolved Mistake Excluded
  // -------------------------------------------------------------------------
  it('4. strictly excludes resolved mistakes from weakness insights and converts eligible to improvement', () => {
    const mistakeBank: Record<string, MistakeRecord> = {
      resolved_item: {
        id: 'resolved_item',
        word: 'conscientious',
        meaning: 'chu đáo, tận tâm',
        mistakeCount: 3,
        lastMistakeAt: new Date(baseTimestamp - 86400000 * 3).toISOString(),
        consecutiveCorrect: 2,
        resolved: true,
        resolvedDate: new Date(baseTimestamp - 86400000).toISOString(),
        primaryType: 'meaning',
        source: 'flashcard',
      },
    };

    const insights = derivePersonalizedInsights({
      mistakeBank,
      now: baseTimestamp,
    });

    // Must NOT be in mistake_pattern or pronunciation
    const pattern = insights.find((i) => i.type === 'mistake_pattern');
    expect(pattern).toBeUndefined();

    // Must be in improvement
    const improvement = insights.find((i) => i.type === 'improvement') as ImprovementInsight | undefined;
    expect(improvement).toBeDefined();
    expect(improvement?.resolvedWord).toBe('conscientious');
    expect(improvement?.consecutiveCorrect).toBe(2);
    expect(improvement?.previousMistakeCount).toBe(3);
    expect(improvement?.severity).toBe('success');
  });

  // -------------------------------------------------------------------------
  // 5. Weak Collocation Without Evidence -> Excluded
  // -------------------------------------------------------------------------
  it('5. strictly excludes collocations without personalized failure evidence', () => {
    const collocations: CollocationItem[] = [
      {
        id: 'colloc_1',
        phrase: 'take into account',
        meaning: 'xem xét, tính đến',
        exampleEn: 'We must take this into account.',
        exampleVi: 'Chúng ta phải tính đến điều này.',
        createdAt: new Date(baseTimestamp).toISOString(),
      },
    ];

    // Case A: No mistakes, no SRS failure -> EXCLUDED
    const insightsA = derivePersonalizedInsights({
      userCollocations: collocations,
      srsProgressMap: {},
      mistakeBank: {},
      now: baseTimestamp,
    });

    const weakCollocA = insightsA.find((i) => i.type === 'weak_collocation');
    expect(weakCollocA).toBeUndefined();

    // Case B: Unresolved mistake exists in Mistake Bank -> INCLUDED
    const insightsB = derivePersonalizedInsights({
      userCollocations: collocations,
      srsProgressMap: {},
      mistakeBank: {
        colloc_1: {
          id: 'colloc_1',
          word: 'take into account',
          meaning: 'xem xét, tính đến',
          mistakeCount: 2,
          lastMistakeAt: new Date(baseTimestamp).toISOString(),
          consecutiveCorrect: 0,
          resolved: false,
          primaryType: 'collocation',
          source: 'collocation',
        },
      },
      now: baseTimestamp,
    });

    const weakCollocB = insightsB.find((i) => i.type === 'weak_collocation') as WeakCollocationInsight | undefined;
    expect(weakCollocB).toBeDefined();
    expect(weakCollocB?.phrase).toBe('take into account');
    expect(weakCollocB?.mistakeCount).toBe(2);
    expect(weakCollocB?.confidence).toBe('strong');
  });

  // -------------------------------------------------------------------------
  // 6. Missing Skill Samples -> Non-Accusatory Wording
  // -------------------------------------------------------------------------
  it('6. forbids concluding "kỹ năng yếu" when skill samples are missing', () => {
    const evidenceStore: FourSkillsEvidenceStore = {
      listening: [], // Zero samples
      reading: [
        { id: 'ev_r1', skill: 'reading', score: 85, source: 'four-skills', createdAt: baseTimestamp },
        { id: 'ev_r2', skill: 'reading', score: 88, source: 'four-skills', createdAt: baseTimestamp },
        { id: 'ev_r3', skill: 'reading', score: 90, source: 'four-skills', createdAt: baseTimestamp },
      ],
      speaking: [
        { id: 'ev_s1', skill: 'speaking', score: 80, source: 'four-skills', createdAt: baseTimestamp },
        { id: 'ev_s2', skill: 'speaking', score: 82, source: 'four-skills', createdAt: baseTimestamp },
        { id: 'ev_s3', skill: 'speaking', score: 84, source: 'four-skills', createdAt: baseTimestamp },
      ],
      writing: [
        { id: 'ev_w1', skill: 'writing', score: 78, source: 'four-skills', createdAt: baseTimestamp },
        { id: 'ev_w2', skill: 'writing', score: 80, source: 'four-skills', createdAt: baseTimestamp },
        { id: 'ev_w3', skill: 'writing', score: 82, source: 'four-skills', createdAt: baseTimestamp },
      ],
    };

    const insights = derivePersonalizedInsights({
      fourSkillsEvidence: evidenceStore,
      now: baseTimestamp,
    });

    const missingListening = insights.find(
      (i) => i.type === 'skill_gap' && (i as SkillGapInsight).skill === 'listening'
    ) as SkillGapInsight | undefined;

    expect(missingListening).toBeDefined();
    expect(missingListening?.hasSufficientData).toBe(false);
    expect(missingListening?.severity).toBe('info');
    // STRICT REQUIREMENT: Must not say "Listening yếu", must use data-gap guidance
    expect(missingListening?.message).toContain('Bạn có ít dữ liệu');
    expect(missingListening?.message).not.toContain('thấp hơn đáng kể');
    expect(missingListening?.message).not.toContain('yếu');
  });

  it('6b. identifies genuine skill gap when samples are sufficient', () => {
    const evidenceStore: FourSkillsEvidenceStore = {
      listening: [
        { id: 'ev_l1', skill: 'listening', score: 40, source: 'four-skills', createdAt: baseTimestamp },
        { id: 'ev_l2', skill: 'listening', score: 42, source: 'four-skills', createdAt: baseTimestamp },
        { id: 'ev_l3', skill: 'listening', score: 45, source: 'four-skills', createdAt: baseTimestamp },
        { id: 'ev_l4', skill: 'listening', score: 44, source: 'four-skills', createdAt: baseTimestamp },
      ],
      reading: [
        { id: 'ev_r1', skill: 'reading', score: 90, source: 'four-skills', createdAt: baseTimestamp },
        { id: 'ev_r2', skill: 'reading', score: 92, source: 'four-skills', createdAt: baseTimestamp },
        { id: 'ev_r3', skill: 'reading', score: 95, source: 'four-skills', createdAt: baseTimestamp },
        { id: 'ev_r4', skill: 'reading', score: 94, source: 'four-skills', createdAt: baseTimestamp },
      ],
      speaking: [],
      writing: [],
    };

    const insights = derivePersonalizedInsights({
      fourSkillsEvidence: evidenceStore,
      now: baseTimestamp,
    });

    const gapListening = insights.find(
      (i) => i.type === 'skill_gap' && (i as SkillGapInsight).skill === 'listening' && (i as SkillGapInsight).hasSufficientData
    ) as SkillGapInsight | undefined;

    expect(gapListening).toBeDefined();
    expect(gapListening?.benchmarkSkill).toBe('reading');
    expect(gapListening?.message).toContain('thấp hơn đáng kể');
  });

  // -------------------------------------------------------------------------
  // 7. Usage Gap (Passive vs Active Vocabulary)
  // -------------------------------------------------------------------------
  it('7. detects passive vocabulary usage gap when reading encounters >= 3 and writing usages === 0', () => {
    const statsMap: WordLearningStatsMap = {
      ubiquitous: {
        readingEncounters: 6,
        lastReadingSeenAt: new Date(baseTimestamp).toISOString(),
        writingUsages: 0,
        lastWritingUsedAt: null,
      },
      the: {
        // functional word should not crash
        readingEncounters: 50,
        lastReadingSeenAt: new Date(baseTimestamp).toISOString(),
        writingUsages: 0,
        lastWritingUsedAt: null,
      },
    };

    const insights = derivePersonalizedInsights({
      wordLearningStats: statsMap,
      now: baseTimestamp,
    });

    const usageGap = insights.find((i) => i.type === 'usage_gap') as UsageGapInsight | undefined;
    expect(usageGap).toBeDefined();
    expect(usageGap?.word).toBe('ubiquitous');
    expect(usageGap?.readingEncounters).toBe(6);
    expect(usageGap?.writingUsages).toBe(0);
    expect(usageGap?.confidence).toBe('strong');
  });

  // -------------------------------------------------------------------------
  // 8. Leech Word Detection
  // -------------------------------------------------------------------------
  it('8. flags leech words using existing leech detector rules (score >= 50)', () => {
    const srsMap: Record<string, SRSProgress> = {
      card_leech: {
        srsLevel: 0,
        nextReviewDate: new Date(baseTimestamp).toISOString(),
        interval: 1,
        easeFactor: 1.5,
        reviewCount: 10,
        againCount: 5, // againRate = 50%
        fsrs: {
          stability: 1.2,
          difficulty: 9.0, // High difficulty
          state: 3,
          reps: 10,
          lapses: 5, // Lapses >= 4 (+40 pts) + Reps>=6 & againRate>=35% (+35 pts) + D>=8.5 (+25 pts) = 100 pts
          lastReview: new Date(baseTimestamp - 86400000).toISOString(),
        },
      },
    };

    const insights = derivePersonalizedInsights({
      srsProgressMap: srsMap,
      now: baseTimestamp,
    });

    const leech = insights.find((i) => i.type === 'leech') as LeechInsight | undefined;
    expect(leech).toBeDefined();
    expect(leech?.word).toBe('card_leech');
    expect(leech?.lapseCount).toBe(5);
    expect(leech?.leechScore).toBe(100);
    expect(leech?.severity).toBe('critical');
    expect(leech?.confidence).toBe('strong');
  });

  // -------------------------------------------------------------------------
  // 9. Retention History & Trend
  // -------------------------------------------------------------------------
  it('9. requires minimum 20 reviews before generating retention insights', () => {
    const dateKey = new Date(baseTimestamp).toISOString().split('T')[0];

    // Case A: 10 reviews (< 20) -> Discarded
    const dailyHistoryLow: Record<string, DailyProgress> = {
      [dateKey]: {
        date: dateKey,
        wordsReviewed: 10,
        newWordsLearned: 5,
        quizzesCompleted: 1,
        pronunciationsMastered: 0,
        xpGained: 50,
        againCount: 5,
        hardCount: 2,
        goodCount: 3,
        easyCount: 0,
      },
    };

    const insightsA = derivePersonalizedInsights({
      dailyHistory: dailyHistoryLow,
      srsAlgorithm: 'fsrs',
      fsrsSettings: { desiredRetention: 0.90, maximumInterval: 36500, w: [] },
      now: baseTimestamp,
    });

    expect(insightsA.find((i) => i.type === 'retention')).toBeUndefined();

    // Case B: 30 reviews with high lapses -> Generated
    const dailyHistorySufficient: Record<string, DailyProgress> = {
      [dateKey]: {
        date: dateKey,
        wordsReviewed: 30,
        newWordsLearned: 5,
        quizzesCompleted: 2,
        pronunciationsMastered: 1,
        xpGained: 150,
        againCount: 15,
        hardCount: 5,
        goodCount: 10,
        easyCount: 0,
      },
    };

    const insightsB = derivePersonalizedInsights({
      dailyHistory: dailyHistorySufficient,
      srsAlgorithm: 'fsrs',
      fsrsSettings: { desiredRetention: 0.90, maximumInterval: 36500, w: [] },
      now: baseTimestamp,
    });

    const retention = insightsB.find((i) => i.type === 'retention') as RetentionInsight | undefined;
    expect(retention).toBeDefined();
    expect(retention?.totalReviews).toBe(30);
    expect(retention?.actualRetention).toBe(0.5); // (5+10)/30 = 0.5
    expect(retention?.targetRetention).toBe(0.9);
  });

  // -------------------------------------------------------------------------
  // 10. Corrupted Telemetry Resilience (Zero Crash)
  // -------------------------------------------------------------------------
  it('10. handles null, undefined, NaN, and corrupted objects with zero crash', () => {
    const corruptedSource: PersonalizedInsightSource = {
      srsProgressMap: {
        corrupted_1: null as unknown as SRSProgress,
        corrupted_2: {
          srsLevel: NaN,
          interval: undefined as unknown as number,
          easeFactor: 'not-a-number' as unknown as number,
          nextReviewDate: 'invalid-date',
          fsrs: {
            stability: -5,
            difficulty: 15,
            state: 99 as unknown as any,
            reps: NaN,
            lapses: -1,
            lastReview: 'future-or-invalid',
          },
        } as unknown as SRSProgress,
      },
      mistakeBank: {
        bad_1: null as unknown as MistakeRecord,
        bad_2: {
          id: 'bad_2',
          word: '',
          mistakeCount: NaN,
          lastMistakeAt: 'invalid',
          consecutiveCorrect: -1,
          resolved: false,
        } as unknown as MistakeRecord,
      },
      userCollocations: [null as unknown as CollocationItem],
      fourSkillsScores: {
        listening: [NaN, -5, Infinity],
        reading: [],
        speaking: [],
        writing: [],
      },
      wordLearningStats: {
        bad_stats: {
          readingEncounters: NaN,
          lastReadingSeenAt: 'invalid',
          writingUsages: -1,
          lastWritingUsedAt: null,
        },
      },
      dailyHistory: {
        bad_day: {
          date: 'bad-date',
          wordsReviewed: NaN,
          newWordsLearned: 0,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
          xpGained: 0,
          againCount: NaN,
        },
      },
      now: NaN,
    };

    expect(() => derivePersonalizedInsights(corruptedSource)).not.toThrow();
    const insights = derivePersonalizedInsights(corruptedSource);
    expect(Array.isArray(insights)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 11. Deterministic Result & Immutability
  // -------------------------------------------------------------------------
  it('11. is strictly deterministic and never mutates input parameters', () => {
    const input: PersonalizedInsightSource = {
      mistakeBank: {
        m1: {
          id: 'm1',
          word: 'spelling_error_1',
          meaning: 'lỗi 1',
          mistakeCount: 3,
          lastMistakeAt: new Date(baseTimestamp).toISOString(),
          consecutiveCorrect: 0,
          resolved: false,
          primaryType: 'spelling',
          source: 'dictation',
        },
        m2: {
          id: 'm2',
          word: 'spelling_error_2',
          meaning: 'lỗi 2',
          mistakeCount: 2,
          lastMistakeAt: new Date(baseTimestamp).toISOString(),
          consecutiveCorrect: 0,
          resolved: false,
          primaryType: 'spelling',
          source: 'dictation',
        },
      },
      now: baseTimestamp,
    };

    // Deep freeze input to verify immutability
    const frozenInput = JSON.parse(JSON.stringify(input));
    Object.freeze(input);
    Object.freeze(input.mistakeBank);
    Object.freeze(input.mistakeBank!.m1);
    Object.freeze(input.mistakeBank!.m2);

    const run1 = derivePersonalizedInsights(input);
    const run2 = derivePersonalizedInsights(input);

    expect(run1).toEqual(run2);
    expect(input).toEqual(frozenInput);
  });
});

describe('Personalized Learning Insights Engine — Phase 2 Derivation & Dedup', () => {
  const baseTimestamp = 1700000000000;

  // -------------------------------------------------------------------------
  // 1. Target Deduplication (Same Word Collision)
  // -------------------------------------------------------------------------
  it('1. deduplicates redundant memory and single word cards on the same target', () => {
    // Word "maintain" is simultaneously a severe Leech, has low retrievability, and has high reading encounters
    const source: PersonalizedInsightSource = {
      srsAlgorithm: 'fsrs',
      fsrsSettings: { desiredRetention: 0.90, maximumInterval: 36500, w: [] },
      srsProgressMap: {
        maintain: {
          srsLevel: 0,
          nextReviewDate: new Date(baseTimestamp).toISOString(),
          interval: 1,
          easeFactor: 1.5,
          reviewCount: 12,
          againCount: 6,
          fsrs: {
            stability: 1.0,
            difficulty: 9.0,
            state: 3,
            reps: 12,
            lapses: 6, // Leech score 100
            lastReview: new Date(baseTimestamp - 86400000 * 20).toISOString(),
          },
        },
      },
      wordLearningStats: {
        maintain: {
          readingEncounters: 10,
          lastReadingSeenAt: new Date(baseTimestamp).toISOString(),
          writingUsages: 0,
          lastWritingUsedAt: null,
        },
      },
      now: baseTimestamp,
    };

    const insights = derivePersonalizedInsights(source);

    // There should be only ONE insight for "maintain", which is the critical Leech card
    const maintainCards = insights.filter((i) => {
      if (i.type === 'leech' && i.word === 'maintain') return true;
      if (i.type === 'usage_gap' && i.word === 'maintain') return true;
      if (i.type === 'forgetting_risk' && i.sampleWords.includes('maintain') && i.atRiskCount === 1) return true;
      return false;
    });

    expect(maintainCards.length).toBe(1);
    expect(maintainCards[0].type).toBe('leech');
    expect(maintainCards[0].severity).toBe('critical');
  });

  // -------------------------------------------------------------------------
  // 2. Collocation and Confusion Pair Deduplication
  // -------------------------------------------------------------------------
  it('2. deduplicates collocations and confusion pairs to prevent duplicate cards', () => {
    const collocations: CollocationItem[] = [
      {
        id: 'colloc_1',
        phrase: 'carry out',
        meaning: 'tiến hành',
        exampleEn: 'carry out research',
        exampleVi: 'tiến hành nghiên cứu',
        createdAt: new Date(baseTimestamp).toISOString(),
      },
      {
        id: 'colloc_2',
        phrase: 'carry out', // duplicate phrase in deck
        meaning: 'thực hiện',
        exampleEn: 'carry out a plan',
        exampleVi: 'thực hiện kế hoạch',
        createdAt: new Date(baseTimestamp).toISOString(),
      },
    ];

    const mistakeBank: Record<string, MistakeRecord> = {
      colloc_1: {
        id: 'colloc_1',
        word: 'carry out',
        meaning: 'tiến hành',
        mistakeCount: 2,
        lastMistakeAt: new Date(baseTimestamp).toISOString(),
        consecutiveCorrect: 0,
        resolved: false,
        primaryType: 'collocation',
        source: 'collocation',
      },
      colloc_2: {
        id: 'colloc_2',
        word: 'carry out',
        meaning: 'thực hiện',
        mistakeCount: 3,
        lastMistakeAt: new Date(baseTimestamp).toISOString(),
        consecutiveCorrect: 0,
        resolved: false,
        primaryType: 'collocation',
        source: 'collocation',
      },
    };

    const insights = derivePersonalizedInsights({
      userCollocations: collocations,
      mistakeBank,
      now: baseTimestamp,
    });

    const carryOutCards = insights.filter((i) => i.type === 'weak_collocation' && i.phrase === 'carry out');
    expect(carryOutCards.length).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 3. Positive / Attention Balance Policy (Max 2 Attention + Max 1 Positive)
  // -------------------------------------------------------------------------
  it('3. enforces the positive / attention balance policy (max 2 attention + max 1 positive = 3 total)', () => {
    // Generate multiple attention items + multiple positive items
    const source: PersonalizedInsightSource = {
      mistakeBank: {
        // Attention: spelling pattern (2 items)
        spell_1: {
          id: 'spell_1',
          word: 'necessary',
          meaning: 'cần thiết',
          mistakeCount: 3,
          lastMistakeAt: new Date(baseTimestamp).toISOString(),
          consecutiveCorrect: 0,
          resolved: false,
          primaryType: 'spelling',
          source: 'dictation',
        },
        spell_2: {
          id: 'spell_2',
          word: 'accommodate',
          meaning: 'chứa chấp',
          mistakeCount: 2,
          lastMistakeAt: new Date(baseTimestamp).toISOString(),
          consecutiveCorrect: 0,
          resolved: false,
          primaryType: 'spelling',
          source: 'dictation',
        },
        // Attention: confusion
        conf_1: {
          id: 'conf_1',
          word: 'affect',
          meaning: 'ảnh hưởng',
          mistakeCount: 2,
          lastMistakeAt: new Date(baseTimestamp).toISOString(),
          consecutiveCorrect: 0,
          resolved: false,
          primaryType: 'meaning',
          source: 'classic_quiz',
          lastUserAnswer: 'effect',
        },
        // Positive: resolved struggle 1
        pos_1: {
          id: 'pos_1',
          word: 'embarrass',
          meaning: 'lúng túng',
          mistakeCount: 4,
          lastMistakeAt: new Date(baseTimestamp - 86400000 * 2).toISOString(),
          consecutiveCorrect: 3,
          resolved: true,
          resolvedDate: new Date(baseTimestamp - 86400000).toISOString(),
          primaryType: 'spelling',
          source: 'dictation',
        },
        // Positive: resolved struggle 2
        pos_2: {
          id: 'pos_2',
          word: 'separate',
          meaning: 'tách rời',
          mistakeCount: 3,
          lastMistakeAt: new Date(baseTimestamp - 86400000 * 3).toISOString(),
          consecutiveCorrect: 2,
          resolved: true,
          resolvedDate: new Date(baseTimestamp - 86400000).toISOString(),
          primaryType: 'spelling',
          source: 'dictation',
        },
      },
      now: baseTimestamp,
    };

    const insights = derivePersonalizedInsights(source);

    // Verify bounded count
    expect(insights.length).toBeLessThanOrEqual(3);

    const attentionItems = insights.filter((i) => i.severity !== 'success' && i.type !== 'improvement');
    const positiveItems = insights.filter((i) => i.severity === 'success' || i.type === 'improvement');

    expect(attentionItems.length).toBeLessThanOrEqual(2);
    expect(positiveItems.length).toBeLessThanOrEqual(1);
    expect(positiveItems.length).toBe(1); // exactly 1 positive recognition rendered
  });

  // -------------------------------------------------------------------------
  // 4. Attention-Only & Positive-Only States
  // -------------------------------------------------------------------------
  it('4. returns only attention items when zero positive evidence exists without fabricating fake praise', () => {
    const source: PersonalizedInsightSource = {
      mistakeBank: {
        spell_1: {
          id: 'spell_1',
          word: 'necessary',
          meaning: 'cần thiết',
          mistakeCount: 3,
          lastMistakeAt: new Date(baseTimestamp).toISOString(),
          consecutiveCorrect: 0,
          resolved: false,
          primaryType: 'spelling',
          source: 'dictation',
        },
        spell_2: {
          id: 'spell_2',
          word: 'accommodate',
          meaning: 'chứa chấp',
          mistakeCount: 2,
          lastMistakeAt: new Date(baseTimestamp).toISOString(),
          consecutiveCorrect: 0,
          resolved: false,
          primaryType: 'spelling',
          source: 'dictation',
        },
      },
      now: baseTimestamp,
    };

    const insights = derivePersonalizedInsights(source);
    const positiveItems = insights.filter((i) => i.severity === 'success' || i.type === 'improvement');
    expect(positiveItems.length).toBe(0); // Zero fake positive praise!
  });

  // -------------------------------------------------------------------------
  // 5. New User Detection via isLearnerNewUser
  // -------------------------------------------------------------------------
  it('5. accurately identifies new users and produces empty clean state', () => {
    const newLearnerSource: PersonalizedInsightSource = {
      srsProgressMap: {},
      mistakeBank: {},
      userCollocations: [],
      fourSkillsEvidence: { listening: [], reading: [], speaking: [], writing: [] },
      dailyHistory: {},
      wordLearningStats: {},
      now: baseTimestamp,
    };

    expect(isLearnerNewUser(newLearnerSource)).toBe(true);

    const summary = derivePersonalizedInsightsSummary(newLearnerSource);
    expect(summary.isNewUser).toBe(true);
    expect(summary.hasInsights).toBe(false);
    expect(summary.insights).toEqual([]);
    expect(summary.attentionCount).toBe(0);
    expect(summary.positiveCount).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 6. Action Descriptors Validity
  // -------------------------------------------------------------------------
  it('6. verifies all action descriptors target existing application routes without mutating state', () => {
    const source: PersonalizedInsightSource = {
      mistakeBank: {
        m1: {
          id: 'm1',
          word: 'pronounce_well',
          meaning: 'nghĩa',
          mistakeCount: 2,
          lastMistakeAt: new Date(baseTimestamp).toISOString(),
          consecutiveCorrect: 0,
          resolved: false,
          primaryType: 'pronunciation',
          source: 'pronunciation',
        },
      },
      now: baseTimestamp,
    };

    const insights = derivePersonalizedInsights(source);
    expect(insights.length).toBeGreaterThan(0);

    const pronInsight = insights[0];
    expect(pronInsight.action).toBeDefined();
    expect(pronInsight.action?.targetTab).toBe('pronunciation');
    expect(pronInsight.action?.subTab).toBe('ai_speech');
    expect(pronInsight.action?.practiceModule).toBe('pronunciation');
    expect(pronInsight.action?.targetItemIds).toEqual(['m1']);
  });

  // -------------------------------------------------------------------------
  // 7. Regression Check: Zero Mutation Across Core Domains
  // -------------------------------------------------------------------------
  it('7. strictly preserves domain isolation and mutates zero state', () => {
    const srsProgressMap: Record<string, SRSProgress> = {
      word_1: {
        srsLevel: 2,
        nextReviewDate: new Date(baseTimestamp).toISOString(),
        interval: 3,
        easeFactor: 2.5,
        fsrs: {
          stability: 4.5,
          difficulty: 6.0,
          state: 2,
          reps: 2,
          lapses: 0,
          lastReview: new Date(baseTimestamp - 86400000).toISOString(),
        },
      },
    };

    const mistakeBank: Record<string, MistakeRecord> = {
      m_test: {
        id: 'm_test',
        word: 'test_word',
        meaning: 'nghĩa',
        mistakeCount: 1,
        lastMistakeAt: new Date(baseTimestamp).toISOString(),
        consecutiveCorrect: 0,
        resolved: false,
        primaryType: 'meaning',
        source: 'flashcard',
      },
    };

    const originalSrs = JSON.stringify(srsProgressMap);
    const originalMistakes = JSON.stringify(mistakeBank);

    derivePersonalizedInsights({
      srsProgressMap,
      mistakeBank,
      srsAlgorithm: 'fsrs',
      now: baseTimestamp,
    });

    expect(JSON.stringify(srsProgressMap)).toBe(originalSrs);
    expect(JSON.stringify(mistakeBank)).toBe(originalMistakes);
  });

  // -------------------------------------------------------------------------
  // 8. Direct Unit Tests for deduplicateInsights and balanceInsights
  // -------------------------------------------------------------------------
  it('8. directly verifies deduplicateInsights and balanceInsights unit functions', () => {
    const rawList = [
      {
        id: 'leech_word',
        type: 'leech' as const,
        severity: 'critical' as const,
        confidence: 'strong' as const,
        title: 'Leech',
        message: 'msg',
        reason: 'rs',
        word: 'persist',
        lapseCount: 5,
        leechScore: 80,
        reasons: ['reasons'],
        createdAt: baseTimestamp,
      },
      {
        id: 'usage_word',
        type: 'usage_gap' as const,
        severity: 'info' as const,
        confidence: 'moderate' as const,
        title: 'Usage',
        message: 'msg',
        reason: 'rs',
        word: 'persist', // duplicate word target
        readingEncounters: 4,
        writingUsages: 0,
        createdAt: baseTimestamp,
      },
      {
        id: 'pos_1',
        type: 'improvement' as const,
        severity: 'success' as const,
        confidence: 'strong' as const,
        title: 'Imp',
        message: 'msg',
        reason: 'rs',
        resolvedWord: 'resolve',
        consecutiveCorrect: 2,
        previousMistakeCount: 3,
        createdAt: baseTimestamp,
      },
    ];

    const deduped = deduplicateInsights(rawList);
    // usage_gap on "persist" should be dropped because "persist" is already a critical leech
    expect(deduped.length).toBe(2);
    expect(deduped.some((i) => i.type === 'usage_gap')).toBe(false);
    expect(deduped.some((i) => i.type === 'leech')).toBe(true);

    const balanced = balanceInsights(deduped, { maxAttention: 1, maxPositive: 1, maxTotal: 2 });
    expect(balanced.length).toBe(2);
    expect(balanced[0].severity).toBe('critical');
    expect(balanced[1].severity).toBe('success');
  });
});

