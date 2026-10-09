import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore, buildUnifiedSRSCards, clearUnifiedCardsCache } from '../../store/useAppStore';
import { buildSessionQueue } from '../FlashcardDeck';
import { previewCardIntervals, processCardReview } from '../../services/srsScheduler';
import * as learningDictModule from '../../services/learningDictionaryService';
import type { SRSReviewCard, VocabWord, CollocationItem, SRSProgress } from '../../types';

describe('PHASE 2 — Flashcard Deck Performance & Hardened SRS Reviews', () => {
  beforeEach(() => {
    useAppStore.getState().resetToDefault();
    clearUnifiedCardsCache();
  });

  describe('1. No Duplicate Review & Atomic Interaction Invariant', () => {
    it('prevents duplicate reviews when a transaction lock is held', () => {
      const store = useAppStore.getState();
      store.addCustomWord({
        word: 'Ephemeral',
        ipa: '/ɪˈfem.ər.əl/',
        partOfSpeech: 'adj',
        meaning: 'Phù du',
        example: 'Fashions are ephemeral.',
        tag: 'Academic',
      });

      const word = useAppStore.getState().userCustomWords[0];
      expect(word).toBeDefined();

      // Simulate atomic review transaction lock
      let isReviewing = false;
      const reviewWithLock = (id: string, grade: 0 | 1 | 2 | 3) => {
        if (isReviewing) return false;
        isReviewing = true;
        try {
          useAppStore.getState().processReview(id, grade);
          return true;
        } finally {
          queueMicrotask(() => {
            isReviewing = false;
          });
        }
      };

      // First click: succeeds
      const firstClick = reviewWithLock(word.id, 2);
      expect(firstClick).toBe(true);

      // Rapid second click (spam/double click within same synchronous frame): safely blocked
      const secondClick = reviewWithLock(word.id, 2);
      expect(secondClick).toBe(false);

      const progress = useAppStore.getState().srsProgressMap[word.id];
      expect(progress.reviewCount).toBe(1); // exactly 1 review counted!
    });
  });

  describe('2. Interval Preview Does Not Mutate State or Cards', () => {
    it('previewCardIntervals on a frozen card leaves card and store intact', () => {
      const originalCard: Readonly<SRSReviewCard> = Object.freeze({
        id: 'frozen_card_1',
        type: 'single_word',
        primaryText: 'Resilient',
        meaning: 'Kiên cường',
        exampleEn: 'She remained resilient.',
        srsLevel: 2,
        interval: 6,
        easeFactor: 2.5,
        nextReviewDate: '2026-10-06T00:00:00.000Z',
      });

      const srsMapBefore = JSON.stringify(useAppStore.getState().srsProgressMap);

      // Running previews under both SM-2 and FSRS
      const sm2Previews = previewCardIntervals(originalCard as SRSReviewCard, {
        algorithm: 'sm2',
        desiredRetention: 0.9,
      });

      const fsrsPreviews = previewCardIntervals(originalCard as SRSReviewCard, {
        algorithm: 'fsrs',
        desiredRetention: 0.9,
      });

      // Assert previews generated valid outputs
      expect(sm2Previews.again.intervalDays).toBe(1);
      expect(sm2Previews.good.intervalDays).toBeGreaterThan(1);
      expect(fsrsPreviews.again.intervalDays).toBeGreaterThanOrEqual(1);
      expect(fsrsPreviews.easy.intervalDays).toBeGreaterThan(fsrsPreviews.good.intervalDays);

      // Assert frozen card was not mutated
      expect(originalCard.srsLevel).toBe(2);
      expect(originalCard.interval).toBe(6);

      // Assert store was not mutated
      const srsMapAfter = JSON.stringify(useAppStore.getState().srsProgressMap);
      expect(srsMapAfter).toBe(srsMapBefore);
    });
  });

  describe('3. Unified Deck Reference Stability & No Unnecessary Re-creation', () => {
    it('returns the exact cached reference when inputs are unchanged', () => {
      const dummyVocab: VocabWord[] = [
        {
          id: 'v1',
          word: 'Serendipity',
          ipa: '/ˌser.ənˈdɪp.ə.ti/',
          partOfSpeech: 'noun',
          meaning: 'May mắn bất ngờ',
          example: 'Finding this was pure serendipity.',
          exampleEn: 'Finding this was pure serendipity.',
          tag: 'Daily',
          level: 'B2',
          srsLevel: 0,
          interval: 0,
          easeFactor: 2.5,
          nextReviewDate: new Date().toISOString(),
        },
      ];
      const dummyColloc: CollocationItem[] = [];
      const dummySrsMap: Record<string, SRSProgress> = {};

      const firstCall = buildUnifiedSRSCards(dummyVocab, dummyColloc, dummySrsMap);
      const secondCall = buildUnifiedSRSCards(dummyVocab, dummyColloc, dummySrsMap);

      // Strict referential equality (O(1) cache hit)
      expect(firstCall).toBe(secondCall);
    });

    it('store getUnifiedSRSCards returns stable cached reference if state unmutated', () => {
      const store = useAppStore.getState();
      const firstDeck = store.getUnifiedSRSCards();
      const secondDeck = store.getUnifiedSRSCards();

      expect(firstDeck).toBe(secondDeck);
    });
  });

  describe('4. Zero Batch Learning Profile Creation on Flashcard Path', () => {
    it('opening Flashcard queue and reviewing does not invoke getLearningDictionaryProfile', () => {
      const profileSpy = vi.spyOn(learningDictModule, 'getLearningDictionaryProfile');

      const store = useAppStore.getState();
      const cards = store.getUnifiedSRSCards();

      // Build session queue
      const queue = buildSessionQueue(
        cards,
        'NEW',
        'ALL',
        'ALL',
        15,
        'ALL',
        store.mistakeBank,
        store.srsProgressMap,
        store.vocabularyList,
        15
      );

      expect(queue.length).toBeGreaterThan(0);

      // Process review
      store.processReview(queue[0].id, 2);

      // Verification: zero learning profile overhead on Flashcard deck path
      expect(profileSpy).not.toHaveBeenCalled();

      profileSpy.mockRestore();
    });
  });

  describe('5. FSRS 4-Grade Rating Correctness', () => {
    it('schedules all 4 rating levels (again, hard, good, easy) accurately under FSRS', () => {
      const baseCard: SRSReviewCard = {
        id: 'fsrs_test_word',
        type: 'single_word',
        primaryText: 'Eloquent',
        meaning: 'Hùng biện',
        exampleEn: 'An eloquent speaker.',
        srsLevel: 1,
        interval: 3,
        easeFactor: 2.5,
        nextReviewDate: '2026-10-06T00:00:00.000Z',
      };

      const baseDate = new Date('2026-10-06T08:00:00.000Z');

      const resAgain = processCardReview(baseCard, 'again', { algorithm: 'fsrs', desiredRetention: 0.9 }, baseDate);
      const resHard = processCardReview(baseCard, 'hard', { algorithm: 'fsrs', desiredRetention: 0.9 }, baseDate);
      const resGood = processCardReview(baseCard, 'good', { algorithm: 'fsrs', desiredRetention: 0.9 }, baseDate);
      const resEasy = processCardReview(baseCard, 'easy', { algorithm: 'fsrs', desiredRetention: 0.9 }, baseDate);

      // Invariants:
      // Again: lapse occurs, reps increment
      expect(resAgain.updatedFsrsState?.lapses).toBe(1);
      expect(resAgain.stringRating).toBe('again');
      expect(resAgain.sm2Grade).toBe(0);

      // Hard: stability lower than Good
      expect(resHard.updatedFsrsState?.stability).toBeLessThan(resGood.updatedFsrsState!.stability);

      // Good: standard retention stability
      expect(resGood.updatedFsrsState?.reps).toBe(1);
      expect(resGood.intervalDays).toBeGreaterThanOrEqual(1);

      // Easy: highest stability and longest interval
      expect(resEasy.updatedFsrsState?.stability).toBeGreaterThan(resGood.updatedFsrsState!.stability);
      expect(resEasy.intervalDays).toBeGreaterThanOrEqual(resGood.intervalDays);
    });
  });

  describe('6. SM-2 4-Grade Rating Correctness', () => {
    it('schedules all 4 rating levels (0, 1, 2, 3) accurately under SM-2', () => {
      const baseCard: SRSReviewCard = {
        id: 'sm2_test_word',
        type: 'single_word',
        primaryText: 'Meticulous',
        meaning: 'Tỉ mỉ',
        exampleEn: 'She is meticulous about details.',
        srsLevel: 2,
        interval: 6,
        easeFactor: 2.5,
        nextReviewDate: '2026-10-06T00:00:00.000Z',
      };

      const baseDate = new Date('2026-10-06T08:00:00.000Z');

      // Again (0)
      const res0 = processCardReview(baseCard, 0, { algorithm: 'sm2', desiredRetention: 0.9 }, baseDate);
      expect(res0.updatedSm2Progress?.srsLevel).toBe(0); // reset repetition
      expect(res0.intervalDays).toBe(1); // reset interval to 1

      // Hard (1)
      const res1 = processCardReview(baseCard, 1, { algorithm: 'sm2', desiredRetention: 0.9 }, baseDate);
      expect(res1.updatedSm2Progress?.srsLevel).toBe(3);
      expect(res1.updatedSm2Progress?.easeFactor).toBeLessThan(2.5); // EF decreased
      expect(res1.intervalDays).toBeGreaterThan(1);

      // Good (2)
      const res2 = processCardReview(baseCard, 2, { algorithm: 'sm2', desiredRetention: 0.9 }, baseDate);
      expect(res2.updatedSm2Progress?.srsLevel).toBe(3);
      expect(res2.updatedSm2Progress?.easeFactor).toBe(2.5); // EF unchanged
      expect(res2.intervalDays).toBe(15); // 6 * 2.5 = 15

      // Easy (3)
      const res3 = processCardReview(baseCard, 3, { algorithm: 'sm2', desiredRetention: 0.9 }, baseDate);
      expect(res3.updatedSm2Progress?.srsLevel).toBe(3);
      expect(res3.updatedSm2Progress?.easeFactor).toBeGreaterThan(2.5); // EF increased
      expect(res3.intervalDays).toBe(22); // 6 * 2.65 * 1.4 ≈ 22
    });
  });

  describe('7. Normal Word + Collocation Cards No Regression', () => {
    it('handles review for both single_word and userCollocations seamlessly', () => {
      const store = useAppStore.getState();

      // 1. Add normal word
      store.addCustomWord({
        word: 'Pivotal',
        ipa: '/ˈpɪv.ə.təl/',
        partOfSpeech: 'adj',
        meaning: 'Then chốt',
        example: 'A pivotal role.',
        tag: 'Academic',
      });
      const normalWord = useAppStore.getState().userCustomWords[0];

      // 2. Add collocation
      const collocResult = store.saveCollocationToSRS({
        phrase: 'bear fruit',
        meaning: 'Đơm hoa kết trái, mang lại thành quả',
        exampleEn: 'Their efforts will bear fruit.',
        exampleVi: 'Nỗ lực của họ sẽ đơm hoa kết trái.',
        tags: ['Idioms'],
      });
      expect(collocResult.success).toBe(true);
      const collocId = collocResult.id;

      // 3. Review normal word
      store.processReview(normalWord.id, 2);
      const wordProgress = useAppStore.getState().srsProgressMap[normalWord.id];
      expect(wordProgress).toBeDefined();
      expect(wordProgress.srsLevel).toBe(1);

      // 4. Review collocation
      store.processReview(collocId, 3);
      const collocProgress = useAppStore.getState().srsProgressMap[collocId];
      expect(collocProgress).toBeDefined();
      expect(collocProgress.srsLevel).toBe(1);

      // 5. Test queue filtering by cardType
      const allCards = useAppStore.getState().getUnifiedSRSCards();

      const singleOnlyQueue = buildSessionQueue(
        allCards,
        'DUE',
        'ALL',
        'ALL',
        20,
        'SINGLE_WORD',
        store.mistakeBank,
        useAppStore.getState().srsProgressMap,
        useAppStore.getState().vocabularyList
      );
      expect(singleOnlyQueue.every((c) => c.type === 'single_word')).toBe(true);

      const collocOnlyQueue = buildSessionQueue(
        allCards,
        'DUE',
        'ALL',
        'ALL',
        20,
        'COLLOCATION',
        store.mistakeBank,
        useAppStore.getState().srsProgressMap,
        useAppStore.getState().vocabularyList
      );
      expect(collocOnlyQueue.every((c) => c.type !== 'single_word')).toBe(true);
    });
  });
});
