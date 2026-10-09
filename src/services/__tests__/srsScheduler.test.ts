import { describe, expect, it } from 'vitest';
import {
  normalizeRating,
  previewCardIntervals,
  processCardReview,
} from '../srsScheduler';
import { SRSReviewCard } from '../../types';

describe('SRS Scheduler Unified Adapter', () => {
  const mockCard: SRSReviewCard = {
    id: 'test_card_1',
    type: 'single_word',
    primaryText: 'Resilience',
    meaning: 'Khả năng phục hồi',
    exampleEn: 'Her resilience carried her through hard times.',
    srsLevel: 2,
    interval: 6,
    easeFactor: 2.5,
    nextReviewDate: '2026-10-04T00:00:00.000Z',
  };

  const baseDate = new Date('2026-10-04T07:00:00.000Z');

  describe('Rating Normalization: normalizeRating', () => {
    it('normalizes string ratings correctly', () => {
      expect(normalizeRating('again')).toEqual({ sm2Grade: 0, fsrsRating: 1, stringRating: 'again' });
      expect(normalizeRating('hard')).toEqual({ sm2Grade: 1, fsrsRating: 2, stringRating: 'hard' });
      expect(normalizeRating('good')).toEqual({ sm2Grade: 2, fsrsRating: 3, stringRating: 'good' });
      expect(normalizeRating('easy')).toEqual({ sm2Grade: 3, fsrsRating: 4, stringRating: 'easy' });
    });

    it('normalizes numeric grades correctly', () => {
      expect(normalizeRating(0)).toEqual({ sm2Grade: 0, fsrsRating: 1, stringRating: 'again' });
      expect(normalizeRating(1)).toEqual({ sm2Grade: 1, fsrsRating: 2, stringRating: 'hard' });
      expect(normalizeRating(2)).toEqual({ sm2Grade: 2, fsrsRating: 3, stringRating: 'good' });
      expect(normalizeRating(3)).toEqual({ sm2Grade: 3, fsrsRating: 4, stringRating: 'easy' });
    });
  });

  describe('SM-2 Scheduling Mode', () => {
    it('processes Good (grade 2) review with SM-2 formula', () => {
      const result = processCardReview(
        mockCard,
        'good',
        { algorithm: 'sm2', desiredRetention: 0.9 },
        baseDate
      );

      expect(result.algorithm).toBe('sm2');
      expect(result.updatedSm2Progress?.srsLevel).toBe(3); // 2 + 1
      expect(result.intervalDays).toBe(15); // Math.round(6 * 2.5 * 1.0) = 15
      expect(result.updatedSm2Progress?.easeFactor).toBe(2.5);
      expect(result.nextReview).toBeDefined();
    });

    it('processes Again (grade 0) review by resetting repetition in SM-2', () => {
      const result = processCardReview(
        mockCard,
        'again',
        { algorithm: 'sm2', desiredRetention: 0.9 },
        baseDate
      );

      expect(result.algorithm).toBe('sm2');
      expect(result.updatedSm2Progress?.srsLevel).toBe(0);
      expect(result.intervalDays).toBe(1);
    });
  });

  describe('FSRS-4.5 Scheduling Mode', () => {
    it('initializes a card under FSRS without previous FSRS memory state', () => {
      const newCard: SRSReviewCard = {
        ...mockCard,
        srsLevel: 0,
        interval: 0,
        fsrs: undefined,
      };

      const result = processCardReview(
        newCard,
        'good',
        { algorithm: 'fsrs', desiredRetention: 0.9 },
        baseDate
      );

      expect(result.algorithm).toBe('fsrs');
      expect(result.retrievability).toBe(1.0);
      expect(result.updatedFsrsState?.state).toBe(2); // Review state
      expect(result.updatedFsrsState?.reps).toBe(1);
      expect(result.updatedFsrsState?.stability).toBeCloseTo(3.7145, 2);
      expect(result.intervalDays).toBe(4);

      // Backwards compatible SM-2 progress synchronized
      expect(result.updatedSm2Progress?.interval).toBe(4);
      expect(result.updatedSm2Progress?.fsrs).toEqual(result.updatedFsrsState);
    });

    it('schedules subsequent review of existing FSRS card', () => {
      const cardWithFsrs: SRSReviewCard = {
        ...mockCard,
        fsrs: {
          stability: 5.0,
          difficulty: 4.8,
          state: 2,
          reps: 2,
          lapses: 0,
          lastReview: '2026-09-29T07:00:00.000Z', // 5 days ago -> R ≈ 0.90
        },
      };

      const result = processCardReview(
        cardWithFsrs,
        'easy',
        { algorithm: 'fsrs', desiredRetention: 0.9 },
        baseDate
      );

      expect(result.algorithm).toBe('fsrs');
      expect(result.updatedFsrsState?.reps).toBe(3);
      expect(result.updatedFsrsState?.stability).toBeGreaterThan(5.0);
      expect(result.intervalDays).toBeGreaterThan(5);
      expect(result.retrievability).toBeCloseTo(0.9, 1);
    });
  });

  describe('Interval Previews: previewCardIntervals', () => {
    it('generates previews for all 4 ratings simultaneously', () => {
      const previews = previewCardIntervals(
        mockCard,
        { algorithm: 'fsrs', desiredRetention: 0.9 },
        baseDate
      );

      expect(previews.again.intervalDays).toBeGreaterThanOrEqual(1);
      expect(previews.hard.intervalDays).toBeGreaterThanOrEqual(1);
      expect(previews.good.intervalDays).toBeGreaterThan(previews.hard.intervalDays);
      expect(previews.easy.intervalDays).toBeGreaterThan(previews.good.intervalDays);
    });
  });
});
