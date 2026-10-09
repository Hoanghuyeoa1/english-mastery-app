import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  calculateSM2,
  isDueForReview,
  formatIntervalPreview,
  getDueReviewWords,
  getTodayLearnedWords,
  getAllLearnedWords,
  getSRSMasteryStatus,
  getSRSMasteryInfo,
} from '../srsAlgorithm';
import type { VocabWord } from '../../types';

describe('srsAlgorithm (SuperMemo 2 adapted)', () => {
  const fixedNow = new Date('2026-10-03T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. Rating thất bại (Grade 0: Again / Quên)', () => {
    it('reset srsLevel về 0 và interval về 1 ngày', () => {
      // Đang ở level cao, interval 30 ngày, EF 2.5
      const result = calculateSM2(0, 30, 4, 2.5);

      expect(result.srsLevel).toBe(0);
      expect(result.interval).toBe(1);
    });

    it('giảm Ease Factor khi thất bại (-0.32)', () => {
      // Grade 0: q = 2 -> delta = 0.1 - 3 * (0.08 + 3 * 0.02) = 0.1 - 0.42 = -0.32
      const result = calculateSM2(0, 10, 2, 2.5);
      expect(result.easeFactor).toBe(2.18);
    });

    it('tính nextReviewDate đúng 1 ngày kể từ thời điểm hiện tại', () => {
      const result = calculateSM2(0, 15, 3, 2.3);
      const expectedDate = new Date(fixedNow);
      expectedDate.setDate(expectedDate.getDate() + 1);

      expect(result.nextReviewDate).toBe(expectedDate.toISOString());
    });
  });

  describe('2. Rating thành công (Grade 1: Hard, Grade 2: Good, Grade 3: Easy)', () => {
    it('Repetition 1 (lần đầu học, currentRepetition = 0): interval luôn là 1 ngày, srsLevel = 1', () => {
      const goodResult = calculateSM2(2, 0, 0, 2.5);
      expect(goodResult.interval).toBe(1);
      expect(goodResult.srsLevel).toBe(1);

      const easyResult = calculateSM2(3, 0, 0, 2.5);
      expect(easyResult.interval).toBe(1);
      expect(easyResult.srsLevel).toBe(1);

      const hardResult = calculateSM2(1, 0, 0, 2.5);
      expect(hardResult.interval).toBe(1);
      expect(hardResult.srsLevel).toBe(1);
    });

    it('Repetition 2 (currentRepetition = 1): interval là 6 ngày cho Good/Easy, và 3 ngày cho Hard', () => {
      const goodResult = calculateSM2(2, 1, 1, 2.5);
      expect(goodResult.interval).toBe(6);
      expect(goodResult.srsLevel).toBe(2);

      const easyResult = calculateSM2(3, 1, 1, 2.5);
      expect(easyResult.interval).toBe(6);
      expect(easyResult.srsLevel).toBe(2);

      const hardResult = calculateSM2(1, 1, 1, 2.5);
      expect(hardResult.interval).toBe(3);
      expect(hardResult.srsLevel).toBe(2);
    });

    it('Repetition 3+ (currentRepetition = 2): tính theo interval_cũ * easeFactor * modifier', () => {
      // Grade 2 (Good): modifier = 1.0, EF giữ nguyên 2.5
      // interval = Math.round(6 * 2.5 * 1.0) = 15
      const goodResult = calculateSM2(2, 6, 2, 2.5);
      expect(goodResult.interval).toBe(15);
      expect(goodResult.srsLevel).toBe(3);

      // Grade 3 (Easy): modifier = 1.4, EF tăng lên 2.6
      // interval = Math.round(6 * 2.6 * 1.4) = Math.round(21.84) = 22
      const easyResult = calculateSM2(3, 6, 2, 2.5);
      expect(easyResult.interval).toBe(22);
      expect(easyResult.srsLevel).toBe(3);

      // Grade 1 (Hard): modifier = 1.2, EF giảm còn 2.36
      // interval = Math.round(6 * 2.36 * 1.2) = Math.round(16.992) = 17
      const hardResult = calculateSM2(1, 6, 2, 2.5);
      expect(hardResult.interval).toBe(17);
      expect(hardResult.srsLevel).toBe(3);
    });
  });

  describe('3. Ease Factor (EF) Dynamics & Ngưỡng sàn 1.3', () => {
    it('EF tăng khi đánh giá Easy (+0.10)', () => {
      const result = calculateSM2(3, 1, 1, 2.5);
      expect(result.easeFactor).toBe(2.6);
    });

    it('EF giữ nguyên khi đánh giá Good (+0.00)', () => {
      const result = calculateSM2(2, 1, 1, 2.5);
      expect(result.easeFactor).toBe(2.5);
    });

    it('EF giảm khi đánh giá Hard (-0.14)', () => {
      const result = calculateSM2(1, 1, 1, 2.5);
      expect(result.easeFactor).toBe(2.36);
    });

    it('ngưỡng sàn: EF không bao giờ giảm xuống dưới 1.3 dù thất bại nhiều lần liên tiếp', () => {
      let currentEF = 2.5;

      // Đánh giá thất bại liên tục 10 lần
      for (let i = 0; i < 10; i++) {
        const res = calculateSM2(0, 1, 0, currentEF);
        currentEF = res.easeFactor;
      }

      expect(currentEF).toBe(1.3);

      // Thêm một lần thất bại nữa từ sàn 1.3
      const floorTest = calculateSM2(0, 1, 0, 1.3);
      expect(floorTest.easeFactor).toBe(1.3);
    });
  });

  describe('4. Edge Cases & Data Integrity', () => {
    it('thẻ từ mới hoàn toàn với các giá trị khởi điểm 0 và EF mặc định 2.5', () => {
      const result = calculateSM2(2, 0, 0, 2.5);
      expect(result.srsLevel).toBe(1);
      expect(result.interval).toBe(1);
      expect(result.easeFactor).toBe(2.5);

      const expectedDate = new Date(fixedNow);
      expectedDate.setDate(expectedDate.getDate() + 1);
      expect(result.nextReviewDate).toBe(expectedDate.toISOString());
    });

    it('tính đúng offset ngày của nextReviewDate cho interval dài', () => {
      const intervalDays = 45;
      const result = calculateSM2(2, intervalDays, 4, 2.5);
      const expected = new Date(fixedNow);
      expected.setDate(expected.getDate() + result.interval);

      expect(result.nextReviewDate).toBe(expected.toISOString());
    });
  });

  describe('5. isDueForReview & formatIntervalPreview', () => {
    it('isDueForReview trả về true khi ngày review rỗng hoặc trong quá khứ', () => {
      expect(isDueForReview('')).toBe(true);

      const pastDate = new Date(fixedNow.getTime() - 1000 * 60).toISOString();
      expect(isDueForReview(pastDate)).toBe(true);

      const rightNow = fixedNow.toISOString();
      expect(isDueForReview(rightNow)).toBe(true);
    });

    it('isDueForReview trả về false khi ngày review ở tương lai', () => {
      const futureDate = new Date(fixedNow.getTime() + 1000 * 60 * 60 * 24).toISOString();
      expect(isDueForReview(futureDate)).toBe(false);
    });

    it('formatIntervalPreview định dạng chu kỳ xem trước trực quan', () => {
      expect(formatIntervalPreview(0, 10, 2, 2.5)).toBe('1 ngày');
      expect(formatIntervalPreview(2, 1, 1, 2.5)).toBe('6 ngày');
      expect(formatIntervalPreview(2, 30, 3, 2.5)).toBe('3 tháng');
    });
  });

  describe('6. getSRSMasteryStatus & getSRSMasteryInfo', () => {
    it('phân loại chính xác trạng thái learning, reviewing, mastered', () => {
      expect(getSRSMasteryStatus({ repetitions: 0, interval: 0 })).toBe('learning');
      expect(getSRSMasteryStatus({ repetitions: 1, interval: 1 })).toBe('learning');
      expect(getSRSMasteryStatus({ repetitions: 2, interval: 6 })).toBe('reviewing');
      expect(getSRSMasteryStatus({ repetitions: 4, interval: 18 })).toBe('reviewing');
      expect(getSRSMasteryStatus({ repetitions: 5, interval: 15 })).toBe('mastered');
      expect(getSRSMasteryStatus({ repetitions: 3, interval: 21 })).toBe('mastered');
    });

    it('getSRSMasteryInfo trả về nhãn và màu sắc tương ứng', () => {
      const mastered = getSRSMasteryInfo('mastered');
      expect(mastered.label).toBe('Đã khắc sâu');
      expect(mastered.emoji).toBe('🟢');

      const reviewing = getSRSMasteryInfo('reviewing');
      expect(reviewing.label).toBe('Nhớ tạm thời');
      expect(reviewing.emoji).toBe('🔵');

      const learning = getSRSMasteryInfo('learning');
      expect(learning.label).toBe('Đang học');
      expect(learning.emoji).toBe('🟡');
    });
  });

  describe('7. Filtering Words (getDueReviewWords, getTodayLearnedWords, getAllLearnedWords)', () => {
    const createTestWord = (overrides: Partial<VocabWord> & { id: string }): VocabWord => ({
      word: 'test',
      ipa: '/test/',
      partOfSpeech: 'noun',
      meaning: 'nghĩa',
      example: 'Example sentence.',
      tag: 'Daily',
      srsLevel: 0,
      interval: 0,
      easeFactor: 2.5,
      nextReviewDate: '2026-10-03T12:00:00.000Z',
      ...overrides,
    });

    const mockWords: VocabWord[] = [
      createTestWord({
        id: 'w1',
        word: 'apple',
        meaning: 'quả táo',
        srsLevel: 1,
        interval: 1,
        easeFactor: 2.5,
        lastReviewedDate: '2026-10-02T10:00:00.000Z',
        nextReviewDate: '2026-10-03T10:00:00.000Z', // due (trong quá khứ so với fixedNow 12:00)
      }),
      createTestWord({
        id: 'w2',
        word: 'banana',
        meaning: 'quả chuối',
        srsLevel: 2,
        interval: 6,
        easeFactor: 2.5,
        lastReviewedDate: '2026-10-03T09:00:00.000Z',
        nextReviewDate: '2026-10-09T09:00:00.000Z', // not due
      }),
      createTestWord({
        id: 'w3',
        word: 'cherry',
        meaning: 'quả anh đào',
        srsLevel: 0,
        interval: 0,
        easeFactor: 2.5,
        nextReviewDate: '2026-10-03T12:00:00.000Z',
        // Chưa từng học (không có srsLevel > 0, firstLearnedAt, lastReviewedDate)
      }),
      createTestWord({
        id: 'w4',
        word: 'dragonfruit',
        meaning: 'thanh long',
        srsLevel: 1,
        interval: 1,
        easeFactor: 2.5,
        firstLearnedAt: '2026-10-03T08:00:00.000Z',
        todayNewReviewedAt: undefined,
        todayPoolReviewedAt: undefined,
        nextReviewDate: '2026-10-03T08:00:00.000Z',
      }),
      createTestWord({
        id: 'w5',
        word: 'elderberry',
        meaning: 'quả cơm cháy',
        srsLevel: 1,
        interval: 1,
        easeFactor: 2.5,
        firstLearnedAt: '2026-10-03T07:00:00.000Z',
        todayNewReviewedAt: '2026-10-03T11:00:00.000Z', // Đã ôn củng cố hôm nay
        todayPoolReviewedAt: '2026-10-03T11:00:00.000Z', // Đã luyện tập kho hôm nay
        nextReviewDate: '2026-10-04T07:00:00.000Z',
      }),
    ];

    it('getDueReviewWords chỉ lấy từ đã từng học và đã đến hạn', () => {
      const dueWords = getDueReviewWords(mockWords);
      const ids = dueWords.map((w) => w.id);

      expect(ids).toContain('w1');
      expect(ids).toContain('w4');
      expect(ids).not.toContain('w2'); // not due
      expect(ids).not.toContain('w3'); // chưa từng học
      expect(ids).not.toContain('w5'); // not due
    });

    it('getTodayLearnedWords lấy từ học hôm nay nhưng chưa ôn củng cố hôm nay', () => {
      const todayWords = getTodayLearnedWords(mockWords, '2026-10-03');
      const ids = todayWords.map((w) => w.id);

      expect(ids).toContain('w4');
      expect(ids).not.toContain('w5'); // đã ôn củng cố (todayNewReviewedAt)
      expect(ids).not.toContain('w1'); // không phải học lần đầu hôm nay
    });

    it('getAllLearnedWords lấy từ đã từng học và chưa hoàn thành lượt pool hôm nay', () => {
      const poolWords = getAllLearnedWords(mockWords, '2026-10-03');
      const ids = poolWords.map((w) => w.id);

      expect(ids).toContain('w1');
      expect(ids).toContain('w2');
      expect(ids).toContain('w4');
      expect(ids).not.toContain('w3'); // chưa từng học
      expect(ids).not.toContain('w5'); // đã luyện tập kho hôm nay
    });
  });
});
