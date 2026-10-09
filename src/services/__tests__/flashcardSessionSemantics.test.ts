// src/services/__tests__/flashcardSessionSemantics.test.ts
import { describe, it, expect } from 'vitest';
import {
  deriveFlashcardSessionSemantics,
  FlashcardSessionKind,
} from '../flashcardQueueService';
import type { SRSReviewCard } from '../../types';

function createDummyCard(id: string, srsLevel: number, lastReviewedDate?: string): SRSReviewCard {
  return {
    id,
    type: 'single_word',
    primaryText: `word_${id}`,
    word: `word_${id}`,
    meaning: `meaning_${id}`,
    exampleEn: `example_${id}`,
    srsLevel,
    lastReviewedDate,
    nextReviewDate: new Date().toISOString(),
    interval: srsLevel > 0 ? 1 : 0,
    easeFactor: 2.5,
  };
}

describe('PHASE 2 — Flashcard Session Semantics Pure Derivation', () => {
  // Requirement 1: due=0, new>0 → new
  describe('1. due=0, new>0 → new session semantics', () => {
    it('derives kind="new", title="Phiên Học Thẻ Từ Mới", and CTA="Bắt đầu học từ mới" from counts', () => {
      const semantics = deriveFlashcardSessionSemantics({
        dueCount: 0,
        newCount: 15,
      });

      expect(semantics.kind).toBe('new');
      expect(semantics.sessionState).toBe('new');
      expect(semantics.canStart).toBe(true);
      expect(semantics.title).toBe('Phiên Học Thẻ Từ Mới');
      expect(semantics.actionLabel).toBe('Bắt đầu học từ mới');
      expect(semantics.isResume).toBe(false);
      expect(semantics.isHydrating).toBe(false);
      expect(semantics.totalCards).toBe(15);
    });

    it('derives kind="new" directly from queue with unlearned cards', () => {
      const unlearnedQueue = [
        createDummyCard('c1', 0),
        createDummyCard('c2', 0),
        createDummyCard('c3', 0),
      ];

      const semantics = deriveFlashcardSessionSemantics({
        queue: unlearnedQueue,
      });

      expect(semantics.kind).toBe('new');
      expect(semantics.dueCount).toBe(0);
      expect(semantics.newCount).toBe(3);
      expect(semantics.totalCards).toBe(3);
      expect(semantics.actionLabel).toBe('Bắt đầu học từ mới');
    });

    it('uses actual queue size when target=15 but queue only contains 10 cards', () => {
      const cards = Array.from({ length: 10 }, (_, i) => createDummyCard(`w_${i}`, 0));
      const semantics = deriveFlashcardSessionSemantics({
        queue: cards,
      });

      expect(semantics.kind).toBe('new');
      expect(semantics.newCount).toBe(10);
      expect(semantics.totalCards).toBe(10);
      expect(semantics.objective).toContain('10');
    });
  });

  // Requirement 2: due>0, new=0 → review
  describe('2. due>0, new=0 → review session semantics', () => {
    it('derives kind="review", title="Phiên Ôn Tập Thẻ Đến Hạn", and CTA="Bắt đầu ôn tập" from counts', () => {
      const semantics = deriveFlashcardSessionSemantics({
        dueCount: 12,
        newCount: 0,
      });

      expect(semantics.kind).toBe('review');
      expect(semantics.sessionState).toBe('review');
      expect(semantics.canStart).toBe(true);
      expect(semantics.title).toBe('Phiên Ôn Tập Thẻ Đến Hạn');
      expect(semantics.actionLabel).toBe('Bắt đầu ôn tập');
      expect(semantics.totalCards).toBe(12);
    });

    it('derives kind="review" directly from queue with learned/due cards', () => {
      const dueQueue = [
        createDummyCard('c1', 2, '2026-03-01'),
        createDummyCard('c2', 1, '2026-03-02'),
      ];

      const semantics = deriveFlashcardSessionSemantics({
        queue: dueQueue,
      });

      expect(semantics.kind).toBe('review');
      expect(semantics.dueCount).toBe(2);
      expect(semantics.newCount).toBe(0);
      expect(semantics.actionLabel).toBe('Bắt đầu ôn tập');
    });
  });

  // Requirement 3: due>0, new>0 → mixed
  describe('3. due>0, new>0 → mixed session semantics', () => {
    it('derives kind="mixed", title="Phiên Học Hôm Nay", and CTA="Bắt đầu phiên học" from counts', () => {
      const semantics = deriveFlashcardSessionSemantics({
        dueCount: 7,
        newCount: 8,
      });

      expect(semantics.kind).toBe('mixed');
      expect(semantics.sessionState).toBe('mixed');
      expect(semantics.canStart).toBe(true);
      expect(semantics.title).toBe('Phiên Học Hôm Nay');
      expect(semantics.actionLabel).toBe('Bắt đầu phiên học');
      expect(semantics.totalCards).toBe(15);
      expect(semantics.objective).toContain('8 từ mới');
      expect(semantics.objective).toContain('7 thẻ đến hạn');
    });

    it('derives kind="mixed" directly from queue with both new and learned cards', () => {
      const mixedQueue = [
        createDummyCard('c1', 0),
        createDummyCard('c2', 2, '2026-03-01'),
        createDummyCard('c3', 0),
      ];

      const semantics = deriveFlashcardSessionSemantics({
        queue: mixedQueue,
      });

      expect(semantics.kind).toBe('mixed');
      expect(semantics.dueCount).toBe(1);
      expect(semantics.newCount).toBe(2);
      expect(semantics.actionLabel).toBe('Bắt đầu phiên học');
    });
  });

  // Requirement 4: due=0, new=0 → empty
  describe('4. due=0, new=0 → empty queue semantics', () => {
    it('derives kind="empty", canStart=false, and empty actionLabel when counts are zero', () => {
      const semantics = deriveFlashcardSessionSemantics({
        dueCount: 0,
        newCount: 0,
      });

      expect(semantics.kind).toBe('empty');
      expect(semantics.sessionState).toBe('empty');
      expect(semantics.canStart).toBe(false);
      expect(semantics.totalCards).toBe(0);
      expect(semantics.actionLabel).toBe('');
      expect(semantics.title).toBe('Không có thẻ trong hàng đợi');
    });

    it('derives kind="empty" when queue is an empty array', () => {
      const semantics = deriveFlashcardSessionSemantics({
        queue: [],
      });

      expect(semantics.kind).toBe('empty');
      expect(semantics.canStart).toBe(false);
      expect(semantics.totalCards).toBe(0);
    });
  });

  // Requirement 5: resume session → continuation preserved
  describe('5. resume session → continuation preserved', () => {
    it('prioritizes resume CTA over standard start CTA for in-progress session', () => {
      const semantics = deriveFlashcardSessionSemantics({
        dueCount: 0,
        newCount: 10,
        hasResumeActivity: true,
      });

      expect(semantics.isResume).toBe(true);
      expect(semantics.kind).toBe('new');
      expect(semantics.actionLabel).toBe('Tiếp tục phiên học');
      expect(semantics.canStart).toBe(true);
    });

    it('prioritizes resume review CTA for in-progress review session', () => {
      const semantics = deriveFlashcardSessionSemantics({
        dueCount: 10,
        newCount: 0,
        hasResumeActivity: true,
      });

      expect(semantics.isResume).toBe(true);
      expect(semantics.kind).toBe('review');
      expect(semantics.actionLabel).toBe('Tiếp tục phiên học');
      expect(semantics.canStart).toBe(true);
    });
  });

  // Requirement 6: hydration not ready → no false session type
  describe('6. hydration not ready → no false session type', () => {
    it('returns isHydrating=true, kind=null, canStart=false when isHydrated=false', () => {
      const semantics = deriveFlashcardSessionSemantics({
        isHydrated: false,
        dueCount: 0,
        newCount: 0,
      });

      expect(semantics.isHydrating).toBe(true);
      expect(semantics.kind).toBeNull();
      expect(semantics.sessionState).toBe('hydrating');
      expect(semantics.canStart).toBe(false);
      expect(semantics.actionLabel).toBe('');
      expect(semantics.title).toBe('');
      // Invariant: MUST NOT falsely return 'empty', 'new', 'review', or 'mixed'
      expect(semantics.kind).not.toBe('empty');
      expect(semantics.kind).not.toBe('new');
      expect(semantics.kind).not.toBe('review');
      expect(semantics.kind).not.toBe('mixed');
    });

    it('does not flash false session type even if queue is passed before hydration', () => {
      const semantics = deriveFlashcardSessionSemantics({
        isHydrated: false,
        queue: [createDummyCard('c1', 0)],
      });

      expect(semantics.isHydrating).toBe(true);
      expect(semantics.kind).toBeNull();
      expect(semantics.canStart).toBe(false);
    });
  });

  // Today Plan metadata integration
  describe('7. Today Plan metadata prioritization', () => {
    it('preserves planTitle and planObjective when provided', () => {
      const semantics = deriveFlashcardSessionSemantics({
        dueCount: 5,
        newCount: 0,
        planTitle: 'Nhiệm vụ: Củng cố 5 từ khó hôm nay',
        planObjective: 'Mục tiêu hoàn thành bài tập theo lộ trình cá nhân hóa',
      });

      expect(semantics.kind).toBe('review');
      expect(semantics.title).toBe('Nhiệm vụ: Củng cố 5 từ khó hôm nay');
      expect(semantics.objective).toBe('Mục tiêu hoàn thành bài tập theo lộ trình cá nhân hóa');
    });
  });
});
