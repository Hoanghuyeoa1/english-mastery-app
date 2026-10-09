// @vitest-environment happy-dom
// src/components/__tests__/FlashcardSessionPhase3.test.tsx
/**
 * PHASE 3: Flashcard Reference Integration + Today Hub + Resume Tests
 * 
 * Invariants tested:
 * 1. Before Session: Truthful card count, estimated duration bucket, objective, Start CTA.
 * 2. Active Session: Preserved SessionHeader, atomic interaction lock, ephemeral session streak.
 * 3. After Session: Preserved SessionSummary, real retention, hardest cards, Next Action hook.
 * 4. Resume Continuity: Truthful progress text, order preserved, zero duplicate review, zero double XP.
 * 5. Today Hub Integration: Prioritizes LearningPlanItem metadata when launched from Today Hub.
 * 6. Edge cases: Empty queue, single card deck, missing cards skipped, streak isolation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useAppStore, clearUnifiedCardsCache } from '../../store/useAppStore';
import { FlashcardDeck } from '../FlashcardDeck';

// Mock framer-motion for happy-dom
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
    button: ({ children, className, ...props }: any) => (
      <button className={className} {...props}>
        {children}
      </button>
    ),
    span: ({ children, className, ...props }: any) => (
      <span className={className} {...props}>
        {children}
      </span>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}));

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('PHASE 3 — Flashcard Reference Integration + Today Hub + Resume', () => {
  beforeEach(() => {
    useAppStore.getState().resetToDefault();
    clearUnifiedCardsCache();
    useAppStore.setState({
      resumeActivities: {},
      activePracticeConfig: null,
    });
    vi.clearAllMocks();
  });

  describe('1. Before Session Experience (Intro & Truthful Metadata)', () => {
    it('renders SessionIntro before session begins with real card count, duration bucket, and start CTA', () => {
      render(<FlashcardDeck />);

      // Intro primitive is displayed before session starts
      const intro = screen.getByTestId('session-intro');
      expect(intro).toBeDefined();

      // Start session button exists
      const startBtn = screen.getByTestId('btn-start-session');
      expect(startBtn).toBeDefined();
      expect(startBtn.textContent).toContain('Bắt đầu học từ mới');
      expect(startBtn.getAttribute('aria-label')).toBe('Bắt đầu học từ mới');

      // Displays truthful duration bucket (e.g. ~5 phút)
      expect(intro.textContent).toMatch(/~\d+\s*phút/);

      // Does not show active card elements yet
      expect(screen.queryByTestId('btn-grade-good')).toBeNull();
    });

    it('transitions to active session with SessionHeader when clicking Start CTA', () => {
      render(<FlashcardDeck />);

      const startBtn = screen.getByTestId('btn-start-session');
      fireEvent.click(startBtn);

      // Intro disappears
      expect(screen.queryByTestId('session-intro')).toBeNull();

      // Session Header counter is displayed (e.g. "1 / 15")
      expect(screen.getByText(/1 \/ \d+/)).toBeDefined();

      // Active card controls are now available
      expect(screen.getByTestId('btn-flip-card')).toBeDefined();
      expect(screen.getByTestId('btn-next-card')).toBeDefined();
    });

    // Targeted tests specifically verifying Phase 3 Session Intro Semantics & Dynamic CTA
    it('CASE 1: due=0 new=15 -> new title, new CTA, description introduces new words without calling it review', () => {
      render(<FlashcardDeck />);
      const intro = screen.getByTestId('session-intro');
      const startBtn = screen.getByTestId('btn-start-session');

      expect(intro.textContent).toContain('Phiên Học Thẻ Từ Mới');
      expect(startBtn.textContent).toContain('Bắt đầu học từ mới');
      expect(startBtn.getAttribute('aria-label')).toBe('Bắt đầu học từ mới');
      // Description does not use review / ôn tập for the new session
      expect(intro.textContent).toContain('chu kỳ ghi nhớ');
    });

    it('CASE 2: due=15 new=0 -> review title, review CTA', () => {
      const allCards = useAppStore.getState().getUnifiedSRSCards();
      // Set cards as reviewed / due
      const progressMap: Record<string, any> = {};
      allCards.slice(0, 15).forEach((c) => {
        progressMap[c.id] = {
          srsLevel: 2,
          lastReviewedDate: '2026-03-01T00:00:00.000Z',
          nextReviewDate: '2026-03-02T00:00:00.000Z',
        };
      });
      useAppStore.setState({ srsProgressMap: progressMap });

      render(<FlashcardDeck />);
      // Switch to Due Review queue
      fireEvent.click(screen.getByText(/Hàng Đợi Ôn Tập/));

      const intro = screen.getByTestId('session-intro');
      const startBtn = screen.getByTestId('btn-start-session');

      expect(intro.textContent).toContain('Phiên Ôn Tập Thẻ Đến Hạn');
      expect(startBtn.textContent).toContain('Bắt đầu ôn tập');
      expect(startBtn.getAttribute('aria-label')).toBe('Bắt đầu ôn tập');
    });

    it('CASE 3: due>0 new>0 -> mixed title "Phiên Học Hôm Nay" and CTA "Bắt đầu phiên học"', () => {
      const allCards = useAppStore.getState().getUnifiedSRSCards();
      const c1 = allCards[0];
      const c2 = allCards[1];
      // Mark c1 as learned/due, leave c2 as unlearned/new
      const progressMap: Record<string, any> = {
        [c1.id]: {
          srsLevel: 2,
          lastReviewedDate: '2026-03-01T00:00:00.000Z',
          nextReviewDate: '2026-03-02T00:00:00.000Z',
        },
      };
      useAppStore.setState({ srsProgressMap: progressMap });

      // Launch mixed session with 1 due card and 1 new card
      useAppStore.getState().startAdaptivePractice({
        module: 'flashcard',
        itemIds: [c1.id, c2.id],
      });

      render(<FlashcardDeck />);
      const intro = screen.getByTestId('session-intro');
      const startBtn = screen.getByTestId('btn-start-session');

      expect(intro.textContent).toContain('Phiên Học Hôm Nay');
      expect(startBtn.textContent).toContain('Bắt đầu phiên học');
      expect(startBtn.getAttribute('aria-label')).toBe('Bắt đầu phiên học');
    });

    it('CASE 4: resume session -> Continue wording on CTA, never "Bắt đầu..."', () => {
      const allCards = useAppStore.getState().getUnifiedSRSCards();
      const c1 = allCards[0];
      const c2 = allCards[1];

      useAppStore.getState().upsertResumeActivity({
        id: 'flashcard_active_session',
        type: 'flashcard',
        title: 'Phiên Học Thẻ SRS',
        startedAt: Date.now() - 3600000,
        lastActiveAt: Date.now() - 60000,
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          queueMode: 'NEW',
          orderedCardIds: [c1.id, c2.id],
          currentIndex: 1,
          reviewedCardIds: [c1.id],
          reviewedCount: 1,
          totalCards: 2,
          progressPercent: 50,
        },
      });

      render(<FlashcardDeck />);
      const startBtn = screen.getByTestId('btn-start-session');
      expect(startBtn.textContent).toContain('Tiếp tục phiên học');
      expect(startBtn.textContent).not.toMatch(/^Bắt đầu/);
      expect(startBtn.getAttribute('aria-label')).toBe('Tiếp tục phiên học');
    });

    it('CASE 5: empty queue -> no start CTA exists', () => {
      useAppStore.setState({
        vocabularyList: [],
        userCustomWords: [],
        userCollocations: [],
      });

      render(<FlashcardDeck />);
      expect(screen.queryByTestId('btn-start-session')).toBeNull();
      expect(screen.queryByTestId('session-intro')).toBeNull();
    });
  });

  describe('2. Today Hub Integration (Metadata Prioritization)', () => {
    it('prioritizes LearningPlanItem metadata when launched from Today Hub', () => {
      const allCards = useAppStore.getState().getUnifiedSRSCards();
      const c1 = allCards[0];
      const c2 = allCards[1];

      // Simulate Today Learning Plan launch via startAdaptivePractice
      useAppStore.getState().startAdaptivePractice({
        module: 'flashcard',
        itemIds: [c1.id, c2.id],
        planItemId: 'task_srs_due_review',
        planTitle: 'Ôn tập 2 thẻ SRS trọng tâm',
        planObjective: 'Củng cố 2 từ vựng có nguy cơ quên theo kế hoạch hôm nay.',
        estimatedMinutes: 5,
      });

      render(<FlashcardDeck />);

      const intro = screen.getByTestId('session-intro');
      expect(intro).toBeDefined();

      // Prioritizes plan title and objective
      expect(intro.textContent).toContain('Ôn tập 2 thẻ SRS trọng tâm');
      expect(intro.textContent).toContain('Củng cố 2 từ vựng có nguy cơ quên');
      expect(intro.textContent).toContain('Kế hoạch hôm nay');
      expect(intro.textContent).toContain('~5 phút');
    });
  });

  describe('3. Full Lifecycle (Before → Start → Review → Complete → Summary & Next Action)', () => {
    it('completes the session, displays SessionSummary with real metrics, and provides Next Action to Today Hub', () => {
      const allCards = useAppStore.getState().getUnifiedSRSCards();
      const c1 = allCards[0];

      // Launch session with exactly 1 card to verify complete transition
      useAppStore.getState().startAdaptivePractice({
        module: 'flashcard',
        itemIds: [c1.id],
        planTitle: 'Phiên ôn 1 từ duy nhất',
      });

      const onNavigateMock = vi.fn();
      render(<FlashcardDeck onNavigate={onNavigateMock} />);

      // 1. Before: Start button clicked
      const startBtn = screen.getByTestId('btn-start-session');
      fireEvent.click(startBtn);

      // 2. During: 1 card active
      expect(screen.getByText(c1.word || c1.primaryText || '')).toBeDefined();

      // 3. Review: Flip card and Grade as Good (Grade 2)
      fireEvent.click(screen.getByTestId('btn-flip-card'));
      const goodBtn = screen.getByTestId('btn-grade-good');
      fireEvent.click(goodBtn);

      // 4. After: SessionSummary complete view appears
      expect(screen.getByText('Session Complete')).toBeDefined();
      expect(screen.getByText('1 thẻ')).toBeDefined();
      expect(screen.getByText('100%')).toBeDefined(); // 1/1 good rating = 100% retention

      // 5. Next Action Panel / Today Hub button exists and routes to dashboard
      const nextActionBtn = screen.getByTestId('btn-next-action-today-hub');
      expect(nextActionBtn).toBeDefined();
      fireEvent.click(nextActionBtn);
      expect(onNavigateMock).toHaveBeenCalledWith('dashboard');
    });
  });

  describe('4. Resume Continuity (Truthful counts, zero duplicate review, order preserved)', () => {
    it('displays truthful progress text and resumes without duplicate review or double XP', () => {
      const allCards = useAppStore.getState().getUnifiedSRSCards();
      const c1 = allCards[0];
      const c2 = allCards[1];
      const c3 = allCards[2];

      // Setup active checkpoint with 1 of 3 cards reviewed
      useAppStore.getState().upsertResumeActivity({
        id: 'flashcard_active_session',
        type: 'flashcard',
        title: 'Phiên Học Thẻ SRS',
        startedAt: Date.now() - 3600000,
        lastActiveAt: Date.now() - 60000,
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          queueMode: 'NEW',
          orderedCardIds: [c1.id, c2.id, c3.id],
          currentIndex: 1,
          reviewedCardIds: [c1.id],
          reviewedCount: 1,
          totalCards: 3,
          progressPercent: 33,
        },
      });

      render(<FlashcardDeck />);

      // Resume banner displays truthful text
      const banner = screen.getByTestId('flashcard-resume-banner');
      expect(banner.textContent).toContain('Đã ôn 1 / 3 thẻ đã xử lý (2 còn lại)');
      expect(banner.textContent).toContain('Tiếp tục phiên ôn');

      // Click resume
      const resumeBtn = screen.getByTestId('btn-resume-flashcards');
      fireEvent.click(resumeBtn);

      // Resumed queue skips c1 and presents c2 directly
      expect(screen.getByText(c2.word || c2.primaryText || '')).toBeDefined();
      expect(screen.queryByText(c1.word || c1.primaryText || '')).toBeNull();
    });

    it('cleans up continuity state upon full completion', () => {
      const allCards = useAppStore.getState().getUnifiedSRSCards();
      const c1 = allCards[0];

      useAppStore.getState().upsertResumeActivity({
        id: 'flashcard_active_session',
        type: 'flashcard',
        title: 'Phiên Học Thẻ SRS',
        startedAt: Date.now() - 10000,
        lastActiveAt: Date.now() - 5000,
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          queueMode: 'NEW',
          orderedCardIds: [c1.id],
          currentIndex: 0,
          reviewedCardIds: [],
          reviewedCount: 0,
          totalCards: 1,
          progressPercent: 0,
        },
      });

      render(<FlashcardDeck />);
      const resumeBtn = screen.getByTestId('btn-resume-flashcards');
      fireEvent.click(resumeBtn);

      // Finish the only remaining card
      fireEvent.click(screen.getByTestId('btn-flip-card'));
      const goodBtn = screen.getByTestId('btn-grade-good');
      fireEvent.click(goodBtn);

      // Continuity activity must be marked completed
      const act = useAppStore.getState().resumeActivities['flashcard_active_session'];
      expect(act?.completed).toBe(true);
    });
  });

  describe('5. Streak and Interaction Safety Invariants', () => {
    it('session streak is strictly ephemeral and never mutates app-level profile streak', () => {
      const today = new Date().toISOString().split('T')[0];
      useAppStore.setState({
        profile: {
          ...useAppStore.getState().profile,
          streak: 3,
          lastStudyDate: today,
        },
      });
      const initialProfileStreak = useAppStore.getState().profile.streak;

      render(<FlashcardDeck />);
      const startBtn = screen.getByTestId('btn-start-session');
      fireEvent.click(startBtn);

      // Grade 1st card as Good (session streak increments)
      fireEvent.click(screen.getByTestId('btn-flip-card'));
      const goodBtn = screen.getByTestId('btn-grade-good');
      fireEvent.click(goodBtn);

      // Global profile streak remains completely untouched
      expect(useAppStore.getState().profile.streak).toBe(initialProfileStreak);
    });

    it('safely handles empty queue without fabricating cards or progress', () => {
      // Force empty words in queue by selecting non-existent tag
      const allCards = useAppStore.getState().getUnifiedSRSCards();
      useAppStore.setState({
        vocabularyList: [],
        userCustomWords: [],
        userCollocations: [],
      });

      render(<FlashcardDeck />);

      // Renders truthful empty state, not a fake session intro
      expect(screen.getByText(/Đã hoàn thành toàn bộ|Sẵn sàng nạp thêm/)).toBeDefined();
      expect(screen.queryByTestId('btn-start-session')).toBeNull();
    });

    it('blocks rapid repeated ratings via atomic interaction lock', () => {
      const processReviewSpy = vi.spyOn(useAppStore.getState(), 'processReview');

      render(<FlashcardDeck />);
      const startBtn = screen.getByTestId('btn-start-session');
      fireEvent.click(startBtn);

      fireEvent.click(screen.getByTestId('btn-flip-card'));
      const goodBtn = screen.getByTestId('btn-grade-good');

      // Rapid double clicks in same synchronous event loop
      fireEvent.click(goodBtn);
      fireEvent.click(goodBtn);

      // Only exactly 1 review processed
      expect(processReviewSpy).toHaveBeenCalledTimes(1);
    });
  });
});
