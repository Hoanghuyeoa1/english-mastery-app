import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeRating,
  getCardUnifiedState,
  calculateSm2NextState,
  fsrsStateToCardState,
  cardStateToFsrsState,
  processCardReview,
  getRatingCounters,
} from '../srsScheduler';
import { useAppStore } from '../../store/useAppStore';
import { DailyProgress, SRSReviewCard } from '../../types';

describe('PHASE 2: SRS Telemetry, Card State Machine & Rating Counters Audit', () => {
  beforeEach(() => {
    useAppStore.getState().resetToDefault();
  });

  // =========================================================================
  // 1. Rating Normalization
  // =========================================================================
  describe('Rating Normalization', () => {
    it('normalizes string and numeric grades with 100% equivalence', () => {
      expect(normalizeRating(0)).toEqual({ sm2Grade: 0, fsrsRating: 1, stringRating: 'again' });
      expect(normalizeRating('again')).toEqual({ sm2Grade: 0, fsrsRating: 1, stringRating: 'again' });

      expect(normalizeRating(1)).toEqual({ sm2Grade: 1, fsrsRating: 2, stringRating: 'hard' });
      expect(normalizeRating('hard')).toEqual({ sm2Grade: 1, fsrsRating: 2, stringRating: 'hard' });

      expect(normalizeRating(2)).toEqual({ sm2Grade: 2, fsrsRating: 3, stringRating: 'good' });
      expect(normalizeRating('good')).toEqual({ sm2Grade: 2, fsrsRating: 3, stringRating: 'good' });

      expect(normalizeRating(3)).toEqual({ sm2Grade: 3, fsrsRating: 4, stringRating: 'easy' });
      expect(normalizeRating('easy')).toEqual({ sm2Grade: 3, fsrsRating: 4, stringRating: 'easy' });
    });
  });

  // =========================================================================
  // 2. Legacy Card State Inference (Zero state duplication)
  // =========================================================================
  describe('Legacy Card State Inference', () => {
    it('infers legacy card without state as "new" if never studied', () => {
      const brandNewLegacyCard = {
        srsLevel: 0,
        interval: 0,
        lastReviewedDate: undefined,
        firstLearnedAt: undefined,
      };
      expect(getCardUnifiedState(brandNewLegacyCard)).toBe('new');
    });

    it('infers legacy card as "learning" if reps < 2 or interval < 3', () => {
      const learningCard = {
        srsLevel: 1,
        interval: 1,
        lastReviewedDate: '2026-10-01T00:00:00.000Z',
      };
      expect(getCardUnifiedState(learningCard)).toBe('learning');
    });

    it('infers legacy card as "review" if reps >= 2 and interval >= 3', () => {
      const reviewCard = {
        srsLevel: 3,
        interval: 14,
        lastReviewedDate: '2026-10-01T00:00:00.000Z',
      };
      expect(getCardUnifiedState(reviewCard)).toBe('review');
    });

    it('infers legacy card as "relearning" if it was studied but lapsed to reps=0', () => {
      const lapsedCard = {
        srsLevel: 0,
        interval: 1,
        lastReviewedDate: '2026-10-01T00:00:00.000Z',
      };
      expect(getCardUnifiedState(lapsedCard)).toBe('relearning');
    });

    it('maps FSRS numeric enum directly to unified card state', () => {
      expect(fsrsStateToCardState(0)).toBe('new');
      expect(fsrsStateToCardState(1)).toBe('learning');
      expect(fsrsStateToCardState(2)).toBe('review');
      expect(fsrsStateToCardState(3)).toBe('relearning');

      expect(cardStateToFsrsState('new')).toBe(0);
      expect(cardStateToFsrsState('learning')).toBe(1);
      expect(cardStateToFsrsState('review')).toBe(2);
      expect(cardStateToFsrsState('relearning')).toBe(3);
    });
  });

  // =========================================================================
  // 3. Card State Transitions (State Machine)
  // =========================================================================
  describe('Card State Transitions', () => {
    it('transitions New → Learning on Again rating (FSRS & SM-2)', () => {
      const newCard: SRSReviewCard = {
        id: 'new_card_1',
        type: 'single_word',
        primaryText: 'Genesis',
        meaning: 'Căn nguyên',
        exampleEn: 'The genesis of a project.',
        srsLevel: 0,
        interval: 0,
        nextReviewDate: '2026-10-04T00:00:00.000Z',
      };

      // FSRS
      const fsrsRes = processCardReview(newCard, 'again', { algorithm: 'fsrs', desiredRetention: 0.9 });
      expect(fsrsRes.stateBefore).toBe('new');
      expect(fsrsRes.stateAfter).toBe('learning');

      // SM-2
      const sm2Res = processCardReview(newCard, 'again', { algorithm: 'sm2', desiredRetention: 0.9 });
      expect(sm2Res.stateBefore).toBe('new');
      expect(sm2Res.stateAfter).toBe('learning');
    });

    it('transitions Learning → Review on Good rating (FSRS & SM-2)', () => {
      const learningCard: SRSReviewCard = {
        id: 'learning_card_1',
        type: 'single_word',
        primaryText: 'Nurture',
        meaning: 'Nuôi dưỡng',
        exampleEn: 'Nurture your skills.',
        srsLevel: 1,
        interval: 1,
        lastReviewedDate: '2026-10-01T00:00:00.000Z',
        nextReviewDate: '2026-10-04T00:00:00.000Z',
        fsrs: {
          stability: 1.4,
          difficulty: 5.0,
          state: 1, // Learning
          reps: 1,
          lapses: 0,
          lastReview: '2026-10-01T00:00:00.000Z',
        },
      };

      // FSRS
      const fsrsRes = processCardReview(learningCard, 'good', { algorithm: 'fsrs', desiredRetention: 0.9 });
      expect(fsrsRes.stateBefore).toBe('learning');
      expect(fsrsRes.stateAfter).toBe('review');

      // SM-2
      const learningSm2Card: SRSReviewCard = {
        ...learningCard,
        fsrs: undefined,
      };
      const sm2Res = processCardReview(learningSm2Card, 'good', { algorithm: 'sm2', desiredRetention: 0.9 });
      expect(sm2Res.stateBefore).toBe('learning');
      expect(sm2Res.stateAfter).toBe('review');
    });

    it('transitions Review → Relearning on Again rating (FSRS & SM-2)', () => {
      const reviewCard: SRSReviewCard = {
        id: 'review_card_1',
        type: 'single_word',
        primaryText: 'Resilience',
        meaning: 'Kiên cường',
        exampleEn: 'True resilience shines.',
        srsLevel: 3,
        interval: 14,
        lastReviewedDate: '2026-10-01T00:00:00.000Z',
        nextReviewDate: '2026-10-04T00:00:00.000Z',
        fsrs: {
          stability: 14.0,
          difficulty: 4.5,
          state: 2, // Review
          reps: 3,
          lapses: 0,
          lastReview: '2026-10-01T00:00:00.000Z',
        },
      };

      // FSRS
      const fsrsRes = processCardReview(reviewCard, 'again', { algorithm: 'fsrs', desiredRetention: 0.9 });
      expect(fsrsRes.stateBefore).toBe('review');
      expect(fsrsRes.stateAfter).toBe('relearning');

      // SM-2
      const reviewSm2Card: SRSReviewCard = {
        ...reviewCard,
        fsrs: undefined,
      };
      const sm2Res = processCardReview(reviewSm2Card, 'again', { algorithm: 'sm2', desiredRetention: 0.9 });
      expect(sm2Res.stateBefore).toBe('review');
      expect(sm2Res.stateAfter).toBe('relearning');
    });

    it('transitions Relearning → Review on Good rating (FSRS & SM-2)', () => {
      const relearningCard: SRSReviewCard = {
        id: 'relearn_card_1',
        type: 'single_word',
        primaryText: 'Tenacious',
        meaning: 'Kiên trì',
        exampleEn: 'A tenacious researcher.',
        srsLevel: 0,
        interval: 1,
        lastReviewedDate: '2026-10-01T00:00:00.000Z',
        nextReviewDate: '2026-10-04T00:00:00.000Z',
        fsrs: {
          stability: 0.5,
          difficulty: 7.0,
          state: 3, // Relearning
          reps: 4,
          lapses: 1,
          lastReview: '2026-10-01T00:00:00.000Z',
        },
      };

      // FSRS
      const fsrsRes = processCardReview(relearningCard, 'good', { algorithm: 'fsrs', desiredRetention: 0.9 });
      expect(fsrsRes.stateBefore).toBe('relearning');
      expect(fsrsRes.stateAfter).toBe('review');

      // SM-2
      const relearnSm2Card: SRSReviewCard = {
        ...relearningCard,
        fsrs: undefined,
      };
      const sm2Res = processCardReview(relearnSm2Card, 'good', { algorithm: 'sm2', desiredRetention: 0.9 });
      expect(sm2Res.stateBefore).toBe('relearning');
      expect(sm2Res.stateAfter).toBe('review');
    });
  });

  // =========================================================================
  // 4. Telemetry Recording in Zustand Store
  // =========================================================================
  describe('Zustand Store Review Telemetry', () => {
    it('records Again in recentReviewEvents and dailyHistory.againCount', () => {
      useAppStore.getState().addCustomWord({
        word: 'Pivotal',
        ipa: '/ˈpɪv.ə.təl/',
        partOfSpeech: 'adjective',
        meaning: 'Nòng cốt, then chốt',
        example: 'A pivotal role in the mission.',
        tag: 'Academic',
      });

      const word = useAppStore.getState().userCustomWords[0];
      useAppStore.getState().processReview(word.id, 0); // Again

      const store = useAppStore.getState();
      expect(store.recentReviewEvents.length).toBe(1);

      const event = store.recentReviewEvents[0];
      expect(event.cardId).toBe(word.id);
      expect(event.rating).toBe('again');
      expect(event.grade).toBe(0);
      expect(event.stateBefore).toBe('new');
      expect(event.stateAfter).toBe('learning');
      expect(event.interval).toBe(1);

      // Daily counters
      const today = new Date().toISOString().split('T')[0];
      const daily = store.dailyHistory[today];
      expect(daily.againCount).toBe(1);
      expect(daily.hardCount || 0).toBe(0);
      expect(daily.goodCount || 0).toBe(0);
      expect(daily.easyCount || 0).toBe(0);

      // Per-card leech counter increment
      expect(store.srsProgressMap[word.id]?.againCount).toBe(1);
    });

    it('records Hard in recentReviewEvents and dailyHistory.hardCount', () => {
      useAppStore.getState().addCustomWord({
        word: 'Lucid',
        ipa: '/ˈluː.sɪd/',
        partOfSpeech: 'adjective',
        meaning: 'Rõ ràng, minh bạch',
        example: 'A lucid explanation.',
        tag: 'Academic',
      });

      const word = useAppStore.getState().userCustomWords[0];
      useAppStore.getState().processReview(word.id, 1); // Hard

      const store = useAppStore.getState();
      expect(store.recentReviewEvents.length).toBe(1);

      const event = store.recentReviewEvents[0];
      expect(event.rating).toBe('hard');
      expect(event.grade).toBe(1);

      const today = new Date().toISOString().split('T')[0];
      expect(store.dailyHistory[today]?.hardCount).toBe(1);
    });

    it('records Good in recentReviewEvents and dailyHistory.goodCount', () => {
      useAppStore.getState().addCustomWord({
        word: 'Pragmatic',
        ipa: '/præɡˈmæt.ɪk/',
        partOfSpeech: 'adjective',
        meaning: 'Thực tế, thực dụng',
        example: 'A pragmatic solution.',
        tag: 'Business',
      });

      const word = useAppStore.getState().userCustomWords[0];
      useAppStore.getState().processReview(word.id, 2); // Good

      const store = useAppStore.getState();
      expect(store.recentReviewEvents.length).toBe(1);

      const event = store.recentReviewEvents[0];
      expect(event.rating).toBe('good');
      expect(event.grade).toBe(2);

      const today = new Date().toISOString().split('T')[0];
      expect(store.dailyHistory[today]?.goodCount).toBe(1);
    });

    it('records Easy in recentReviewEvents and dailyHistory.easyCount', () => {
      useAppStore.getState().addCustomWord({
        word: 'Serendipity',
        ipa: '/ˌser.ənˈdɪp.ə.ti/',
        partOfSpeech: 'noun',
        meaning: 'Sự may mắn bất ngờ',
        example: 'Finding this was pure serendipity.',
        tag: 'Daily',
      });

      const word = useAppStore.getState().userCustomWords[0];
      useAppStore.getState().processReview(word.id, 3); // Easy

      const store = useAppStore.getState();
      expect(store.recentReviewEvents.length).toBe(1);

      const event = store.recentReviewEvents[0];
      expect(event.rating).toBe('easy');
      expect(event.grade).toBe(3);

      const today = new Date().toISOString().split('T')[0];
      expect(store.dailyHistory[today]?.easyCount).toBe(1);
    });

    it('ensures failed review does not record event or increment counters', () => {
      const initialStore = useAppStore.getState();
      const initialEventsLength = initialStore.recentReviewEvents.length;

      // Call review with non-existent word ID
      useAppStore.getState().processReview('non_existent_card_9999', 2);

      const currentStore = useAppStore.getState();
      expect(currentStore.recentReviewEvents.length).toBe(initialEventsLength);
      expect(currentStore.srsProgressMap['non_existent_card_9999']).toBeUndefined();
    });

    it('preserves SM-2 functionality and records SM-2 telemetry event', () => {
      useAppStore.getState().setSRSAlgorithm('sm2');
      useAppStore.getState().addCustomWord({
        word: 'Profound',
        ipa: '/prəˈfaʊnd/',
        partOfSpeech: 'adjective',
        meaning: 'Sâu sắc, uyên thâm',
        example: 'A profound impact.',
        tag: 'Academic',
      });

      const word = useAppStore.getState().userCustomWords[0];
      useAppStore.getState().processReview(word.id, 2);

      const store = useAppStore.getState();
      const event = store.recentReviewEvents[0];
      expect(event.algorithm).toBe('sm2');
      expect(store.srsProgressMap[word.id]?.srsLevel).toBe(1);
      expect(store.srsProgressMap[word.id]?.interval).toBe(1);
    });

    it('preserves FSRS functionality and records FSRS telemetry event with stability and difficulty', () => {
      useAppStore.getState().setSRSAlgorithm('fsrs');
      useAppStore.getState().addCustomWord({
        word: 'Coherent',
        ipa: '/koʊˈhɪr.ənt/',
        partOfSpeech: 'adjective',
        meaning: 'Mạch lạc, chặt chẽ',
        example: 'A coherent argument.',
        tag: 'Academic',
      });

      const word = useAppStore.getState().userCustomWords[0];
      useAppStore.getState().processReview(word.id, 2);

      const store = useAppStore.getState();
      const event = store.recentReviewEvents[0];
      expect(event.algorithm).toBe('fsrs');
      expect(event.stability).toBeDefined();
      expect(event.difficulty).toBeDefined();
      expect(event.stability).toBeGreaterThan(0);
      expect(store.srsProgressMap[word.id]?.fsrs).toBeDefined();
    });

    it('safely handles legacy backup without recentReviewEvents', () => {
      const legacyBackupJson = JSON.stringify({
        app: 'EnglishMasteryHub',
        version: '1.0.0',
        profile: {
          name: 'Học viên cũ',
          level: 2,
          xp: 150,
          streak: 5,
        },
        userCustomWords: [],
        srsProgressMap: {
          legacy_1: {
            srsLevel: 3,
            interval: 10,
            easeFactor: 2.5,
            nextReviewDate: '2026-10-10T00:00:00.000Z',
          },
        },
      });

      const result = useAppStore.getState().importBackupData(legacyBackupJson);
      expect(result.success).toBe(true);

      const store = useAppStore.getState();
      expect(store.recentReviewEvents).toBeDefined();
      expect(Array.isArray(store.recentReviewEvents)).toBe(true);
      expect(store.recentReviewEvents.length).toBe(0);
    });
  });

  // =========================================================================
  // 5. Rating Counters Derivation (7 days, 30 days, all time)
  // =========================================================================
  describe('Rating Counters Derivation', () => {
    it('derives 7-day, 30-day, and all-time retention metrics accurately', () => {
      const mockHistory: Record<string, DailyProgress> = {
        '2026-10-04': {
          date: '2026-10-04',
          wordsReviewed: 10,
          newWordsLearned: 2,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
          xpGained: 50,
          againCount: 1,
          hardCount: 2,
          goodCount: 5,
          easyCount: 2,
        },
        '2026-10-01': {
          date: '2026-10-01',
          wordsReviewed: 5,
          newWordsLearned: 0,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
          xpGained: 25,
          againCount: 0,
          hardCount: 1,
          goodCount: 3,
          easyCount: 1,
        },
        '2026-09-15': {
          // 19 days ago -> Included in 30 days, excluded from 7 days
          date: '2026-09-15',
          wordsReviewed: 8,
          newWordsLearned: 0,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
          xpGained: 40,
          againCount: 2,
          hardCount: 2,
          goodCount: 4,
          easyCount: 0,
        },
        '2026-08-01': {
          // 64 days ago -> Excluded from 7 and 30 days, included in all time
          date: '2026-08-01',
          wordsReviewed: 4,
          newWordsLearned: 1,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
          xpGained: 20,
          againCount: 1,
          hardCount: 0,
          goodCount: 2,
          easyCount: 1,
        },
      };

      const now = new Date('2026-10-04T12:00:00.000Z');

      // 7 Days
      const stats7d = getRatingCounters(mockHistory, 7, now);
      expect(stats7d.again).toBe(1);
      expect(stats7d.hard).toBe(3); // 2 + 1
      expect(stats7d.good).toBe(8); // 5 + 3
      expect(stats7d.easy).toBe(3); // 2 + 1
      expect(stats7d.total).toBe(15);
      expect(stats7d.retentionRate).toBeCloseTo((3 + 8 + 3) / 15, 4);

      // 30 Days
      const stats30d = getRatingCounters(mockHistory, 30, now);
      expect(stats30d.again).toBe(3); // 1 + 0 + 2
      expect(stats30d.hard).toBe(5);  // 2 + 1 + 2
      expect(stats30d.good).toBe(12); // 5 + 3 + 4
      expect(stats30d.easy).toBe(3);  // 2 + 1 + 0
      expect(stats30d.total).toBe(23);

      // All Time
      const statsAll = getRatingCounters(mockHistory, 'all', now);
      expect(statsAll.again).toBe(4); // 1 + 0 + 2 + 1
      expect(statsAll.total).toBe(27);
    });

    it('integrates with useAppStore.getState().getRatingStats() dynamically', () => {
      useAppStore.getState().addCustomWord({
        word: 'Aura',
        ipa: '/ˈɔː.rə/',
        partOfSpeech: 'noun',
        meaning: 'Hào quang',
        example: 'An aura of success.',
        tag: 'Daily',
      });
      const word = useAppStore.getState().userCustomWords[0];

      useAppStore.getState().processReview(word.id, 2); // Good
      useAppStore.getState().processReview(word.id, 0); // Again
      useAppStore.getState().processReview(word.id, 3); // Easy

      const stats = useAppStore.getState().getRatingStats('all');
      expect(stats.again).toBe(1);
      expect(stats.good).toBe(1);
      expect(stats.easy).toBe(1);
      expect(stats.total).toBe(3);
      expect(stats.retentionRate).toBeCloseTo(2 / 3, 2);
    });

    it('ensures legacy dailyHistory without rating counters does not inflate retention denominator', () => {
      const mixedHistory: Record<string, DailyProgress> = {
        '2026-09-01': {
          date: '2026-09-01',
          wordsReviewed: 25,
          newWordsLearned: 5,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
          xpGained: 120,
          // Legacy day: againCount, hardCount, goodCount, easyCount are undefined!
        },
        '2026-09-02': {
          date: '2026-09-02',
          wordsReviewed: 30,
          newWordsLearned: 10,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
          xpGained: 150,
          // Legacy day: undefined rating counters!
        },
        '2026-10-03': {
          date: '2026-10-03',
          wordsReviewed: 5,
          newWordsLearned: 0,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
          xpGained: 25,
          againCount: 1,
          hardCount: 1,
          goodCount: 3,
          easyCount: 0,
        },
        '2026-10-04': {
          date: '2026-10-04',
          wordsReviewed: 5,
          newWordsLearned: 0,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
          xpGained: 25,
          againCount: 0,
          hardCount: 0,
          goodCount: 4,
          easyCount: 1,
        },
      };

      const now = new Date('2026-10-04T12:00:00.000Z');
      const stats = getRatingCounters(mixedHistory, 'all', now);

      // Denominator MUST be 10 (from the 2 recorded days), NOT inflated by the 55 legacy wordsReviewed
      expect(stats.total).toBe(10);
      expect(stats.again).toBe(1);
      expect(stats.hard).toBe(1);
      expect(stats.good).toBe(7);
      expect(stats.easy).toBe(1);
      expect(stats.retentionRate).toBe(0.9); // (1 + 7 + 1) / 10 = 0.90
      expect(stats.recordedDays).toBe(2);
      expect(stats.analyticsStartedAt).toBe('2026-10-03');
    });
  });

  // =========================================================================
  // 6. Advanced Telemetry Invariants (ReviewCount Survival & Ring Buffer Eviction)
  // =========================================================================
  describe('Advanced Telemetry Invariants', () => {
    it('ensures SM-2 total reviewCount survives Again/reset and tracks lifetime reviews', () => {
      useAppStore.getState().setSRSAlgorithm('sm2');
      useAppStore.getState().addCustomWord({
        word: 'Tenacity',
        ipa: '/təˈnæs.ə.ti/',
        partOfSpeech: 'noun',
        meaning: 'Sự kiên trì bền bỉ',
        example: 'He fought with tenacity.',
        tag: 'Academic',
      });
      const word = useAppStore.getState().userCustomWords[0];

      // Sequence: Good (1), Good (2), Good (3)
      useAppStore.getState().processReview(word.id, 2);
      useAppStore.getState().processReview(word.id, 2);
      useAppStore.getState().processReview(word.id, 2);

      let progress = useAppStore.getState().srsProgressMap[word.id];
      expect(progress.srsLevel).toBe(3);
      expect(progress.reviewCount).toBe(3);
      expect(progress.againCount || 0).toBe(0);

      // User forgets (Again -> resets srsLevel to 0)
      useAppStore.getState().processReview(word.id, 0); // Again
      progress = useAppStore.getState().srsProgressMap[word.id];
      expect(progress.srsLevel).toBe(0); // reset in SM-2
      expect(progress.reviewCount).toBe(4); // reviewCount survived!
      expect(progress.againCount).toBe(1);

      // Subsequent review (Good -> srsLevel becomes 1)
      useAppStore.getState().processReview(word.id, 2); // Good
      progress = useAppStore.getState().srsProgressMap[word.id];
      expect(progress.srsLevel).toBe(1);
      expect(progress.reviewCount).toBe(5); // Lifetime reviews = 5!
      expect(progress.againCount).toBe(1);

      // Leech calculation works accurately: againCount / reviewCount = 1 / 5 = 0.2
      const againRate = (progress.againCount || 0) / (progress.reviewCount || 1);
      expect(againRate).toBe(0.2);
    });

    it('evicts oldest event when ring buffer reaches 200 while preserving unbounded daily and per-card aggregates', () => {
      useAppStore.getState().addCustomWord({
        word: 'Persistence',
        ipa: '/pəˈsɪs.təns/',
        partOfSpeech: 'noun',
        meaning: 'Sự kiên định bền bỉ',
        example: 'Persistence leads to mastery.',
        tag: 'Academic',
      });
      const word = useAppStore.getState().userCustomWords[0];

      // Perform 201 reviews on this card
      for (let i = 1; i <= 201; i++) {
        useAppStore.getState().processReview(word.id, 2); // Good
      }

      const store = useAppStore.getState();

      // 1. Ring buffer is strictly capped at 200
      expect(store.recentReviewEvents.length).toBe(200);

      // 2. Newest event is at index 0
      expect(store.recentReviewEvents[0].cardId).toBe(word.id);

      // 3. Per-card lifetime reviewCount is completely preserved (unbounded)
      const progress = store.srsProgressMap[word.id];
      expect(progress.reviewCount).toBe(201);

      // 4. Daily aggregates are completely preserved (unbounded)
      const today = new Date().toISOString().split('T')[0];
      expect(store.dailyHistory[today]?.goodCount).toBe(201);
      expect(store.dailyHistory[today]?.newWordsLearned).toBe(1); // 1st interaction is new word
      expect(store.dailyHistory[today]?.wordsReviewed).toBe(200);  // 200 subsequent reviews
      expect(
        (store.dailyHistory[today]?.wordsReviewed || 0) + (store.dailyHistory[today]?.newWordsLearned || 0)
      ).toBe(201);
    });
  });
});
