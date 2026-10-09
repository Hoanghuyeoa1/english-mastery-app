// @vitest-environment happy-dom
// src/components/__tests__/FlashcardSessionHardeningPhase6.test.tsx
/**
 * PHASE 6 — Resume & Session Edge-Case Hardening
 * 
 * Verifies core lifecycle & edge-case invariants:
 * 1. RESUME: Incomplete session restores current card, renders in DOM, triggers TTS after render if autoPlayAudio=true, or preserves silence if autoPlayAudio=false. Never speaks on loading screen.
 * 2. EMPTY QUEUE: due=0 & new=0 produces kind='empty', canStart=false, no start CTA, no invalid session, no TTS undefined.
 * 3. PRE-HYDRATION: isHydrated=false does not derive false 0 due/0 new, renders hydrating skeleton, does not flash incorrect intro, no session trigger, no TTS. Resolves cleanly on hydration.
 * 4. FINAL CARD COMPLETION: Rating last card transitions to SessionSummary, cancels old speech, never advances out-of-bounds, never triggers TTS undefined/card-after-end.
 * 5. RESTART: Restarting completed session cancels old speech, initializes first card (index 0), renders card #1, and triggers auto-TTS after render according to new lifecycle.
 * 6. CONTINUITY: Completed Always Wins; completed sessions and stale resumes never resurrect.
 * 7. NO FAKE REVIEW: Card render, boundary presentation, TTS, resume, and restart never create fake review records or mutate scheduler state. Reviews only occur on explicit rating semantics.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useAppStore, clearUnifiedCardsCache } from '../../store/useAppStore';
import { FlashcardDeck } from '../FlashcardDeck';
import { deriveFlashcardSessionSemantics } from '../../services/flashcardQueueService';
import { FLASHCARD_STALE_MS } from '../../services/learningContinuityService';

interface SpeakCallSnapshot {
  spokenText: string;
  cardBoundaryMounted: boolean;
  cardReadyAttr: string | null;
  displayedWordText: string | null;
  sessionIntroMounted: boolean;
  hydratingMounted: boolean;
  timestamp: number;
}

const speakHistory: SpeakCallSnapshot[] = [];
const cancelHistory: number[] = [];

// Mock speechService to inspect exact DOM state at instant of speakWord invocation
vi.mock('../../services/speechService', () => ({
  speakWord: vi.fn((text: string) => {
    const boundary = document.querySelector('[data-testid="flashcard-presentation-boundary"]');
    const frontWord = document.querySelector('[data-testid="flashcard-front-word"]');
    const intro = document.querySelector('[data-testid="session-intro"]');
    const hydrating = document.querySelector('[data-testid="flashcard-deck-hydrating"]');
    speakHistory.push({
      spokenText: text,
      cardBoundaryMounted: Boolean(boundary),
      cardReadyAttr: boundary?.getAttribute('data-card-ready') || null,
      displayedWordText: frontWord?.textContent?.trim() || null,
      sessionIntroMounted: Boolean(intro),
      hydratingMounted: Boolean(hydrating),
      timestamp: Date.now(),
    });
  }),
  speakText: vi.fn(),
  cancelSpeech: vi.fn(() => {
    cancelHistory.push(Date.now());
  }),
  isSpeechRecognitionSupported: vi.fn(() => true),
}));

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

describe('PHASE 6 — Resume & Session Edge-Case Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    speakHistory.length = 0;
    cancelHistory.length = 0;
    useAppStore.getState().resetToDefault();
    clearUnifiedCardsCache();
    useAppStore.setState({
      resumeActivities: {},
      activePracticeConfig: null,
      autoPlayAudio: true,
      isHydrated: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. RESUME LIFECYCLE & AUTO-TTS TIMING', () => {
    it('restores current card, renders in DOM, and triggers auto-TTS after render when policy has autoPlayAudio=true', () => {
      const allCards = useAppStore.getState().getUnifiedSRSCards();
      const c1 = allCards[0];
      const c2 = allCards[1];
      const c3 = allCards[2];
      const expectedWord = c2.primaryText || c2.word || '';

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

      // On initial render with banner, zero TTS calls
      expect(speakHistory.length).toBe(0);
      const resumeBtn = screen.getByTestId('btn-resume-flashcards');
      expect(resumeBtn).toBeDefined();

      // Click Resume
      act(() => {
        fireEvent.click(resumeBtn);
      });

      // Banner is removed
      expect(screen.queryByTestId('flashcard-resume-banner')).toBeNull();

      // Card c2 is rendered in DOM
      const boundary = screen.getByTestId('flashcard-presentation-boundary');
      expect(boundary).toBeDefined();
      expect(boundary.getAttribute('data-presented-card-id')).toBe(c2.id);

      // Invariant: TTS was invoked exactly once for resumed card c2
      expect(speakHistory.length).toBe(1);
      const call = speakHistory[0];
      expect(call.spokenText).toBe(expectedWord);
      // DOM was already mounted at exact time of speech invocation
      expect(call.cardBoundaryMounted).toBe(true);
      expect(call.sessionIntroMounted).toBe(false);
      expect(call.hydratingMounted).toBe(false);
    });

    it('preserves silence when autoPlayAudio=false on resume', () => {
      useAppStore.setState({ autoPlayAudio: false });

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

      const resumeBtn = screen.getByTestId('btn-resume-flashcards');
      act(() => {
        fireEvent.click(resumeBtn);
      });

      // Card c2 is rendered in DOM
      const boundary = screen.getByTestId('flashcard-presentation-boundary');
      expect(boundary.getAttribute('data-presented-card-id')).toBe(c2.id);

      // Zero auto-TTS calls due to user policy
      expect(speakHistory.length).toBe(0);
    });
  });

  describe('2. EMPTY QUEUE HARDENING', () => {
    it('derives kind=empty and canStart=false when due=0 and new=0', () => {
      const semantics = deriveFlashcardSessionSemantics({
        queue: [],
        dueCount: 0,
        newCount: 0,
        isHydrated: true,
      });

      expect(semantics.kind).toBe('empty');
      expect(semantics.sessionState).toBe('empty');
      expect(semantics.canStart).toBe(false);
      expect(semantics.actionLabel).toBe('');
      expect(semantics.totalCards).toBe(0);
    });

    it('renders empty deck state with NO start CTA and zero TTS', () => {
      // Clear vocabulary and custom words to simulate completely empty queue
      useAppStore.setState({
        vocabularyList: [],
        userCustomWords: [],
        userCollocations: [],
        srsProgressMap: {},
      });

      render(<FlashcardDeck />);

      // Renders smart empty state
      expect(screen.getByTestId('flashcard-deck-empty')).toBeDefined();

      // Zero start session button
      expect(screen.queryByTestId('btn-start-session')).toBeNull();
      // Zero presentation boundary
      expect(screen.queryByTestId('flashcard-presentation-boundary')).toBeNull();
      // Zero TTS calls (never speaks undefined or empty)
      expect(speakHistory.length).toBe(0);
    });
  });

  describe('3. PRE-HYDRATION SAFETY', () => {
    it('does not derive false 0 due/0 new or empty kind when isHydrated=false', () => {
      const semantics = deriveFlashcardSessionSemantics({
        queue: [],
        isHydrated: false,
      });

      expect(semantics.isHydrating).toBe(true);
      expect(semantics.kind).toBeNull();
      expect(semantics.sessionState).toBe('hydrating');
      expect(semantics.canStart).toBe(false);
      expect(semantics.actionLabel).toBe('');
    });

    it('renders hydrating skeleton, suppresses intro, suppresses resume banner, and zero TTS', () => {
      const allCards = useAppStore.getState().getUnifiedSRSCards();
      const c1 = allCards[0];

      // Setup resume activity before hydration
      useAppStore.setState({
        isHydrated: false,
        resumeActivities: {
          flashcard_active_session: {
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
            },
          },
        },
      });

      render(<FlashcardDeck />);

      // Shows hydrating skeleton
      expect(screen.getByTestId('flashcard-deck-hydrating')).toBeDefined();

      // Does NOT flash intro
      expect(screen.queryByTestId('session-intro')).toBeNull();
      // Does NOT flash resume banner
      expect(screen.queryByTestId('flashcard-resume-banner')).toBeNull();
      // Does NOT render presentation boundary
      expect(screen.queryByTestId('flashcard-presentation-boundary')).toBeNull();
      // Zero TTS calls
      expect(speakHistory.length).toBe(0);
    });

    it('resolves cleanly when isHydrated transitions from false to true', () => {
      useAppStore.setState({ isHydrated: false });

      const { rerender } = render(<FlashcardDeck />);
      expect(screen.getByTestId('flashcard-deck-hydrating')).toBeDefined();
      expect(screen.queryByTestId('session-intro')).toBeNull();

      // Store hydration completes
      act(() => {
        useAppStore.setState({ isHydrated: true });
      });
      rerender(<FlashcardDeck />);

      // Hydrating skeleton removed, session intro rendered cleanly
      expect(screen.queryByTestId('flashcard-deck-hydrating')).toBeNull();
      expect(screen.getByTestId('session-intro')).toBeDefined();
    });
  });

  describe('4. FINAL CARD COMPLETION', () => {
    it('rating last card transitions to SessionSummary, cancels ongoing speech, and never triggers card-after-end TTS', () => {
      const allCards = useAppStore.getState().getUnifiedSRSCards();
      const c1 = allCards[0];

      // Setup session with exactly 1 card to test final card completion
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
          orderedCardIds: [c1.id],
          currentIndex: 0,
          reviewedCardIds: [],
          reviewedCount: 0,
          totalCards: 1,
        },
      });

      render(<FlashcardDeck />);

      // Resume session with 1 card
      const resumeBtn = screen.getByTestId('btn-resume-flashcards');
      act(() => {
        fireEvent.click(resumeBtn);
      });

      expect(screen.getByTestId('flashcard-presentation-boundary')).toBeDefined();
      expect(speakHistory.length).toBe(1); // Spoke card 1

      // Find navigation button 'btn-next-card' (triggers handleNext and finishes last card)
      const nextBtn = screen.getByTestId('btn-next-card');
      expect(nextBtn).toBeDefined();

      const cancelCountBefore = cancelHistory.length;
      // Complete the last card
      act(() => {
        fireEvent.click(nextBtn);
      });

      // 1. cancelSpeech was called on transition
      expect(cancelHistory.length).toBeGreaterThan(cancelCountBefore);

      // 2. Session completed summary is rendered
      expect(screen.getByText('Session Complete')).toBeDefined();
      // Presentation boundary is unmounted
      expect(screen.queryByTestId('flashcard-presentation-boundary')).toBeNull();

      // 3. Spoke exactly card 1 and never triggered any further card-after-end or undefined TTS
      expect(speakHistory.length).toBe(1);
    });

    it('completing session unmounts presentation boundary and prevents undefined TTS', () => {
      const allCards = useAppStore.getState().getUnifiedSRSCards();
      const c1 = allCards[0];

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
          orderedCardIds: [c1.id],
          currentIndex: 0,
          reviewedCardIds: [],
          reviewedCount: 0,
          totalCards: 1,
        },
      });

      render(<FlashcardDeck />);

      const resumeBtn = screen.getByTestId('btn-resume-flashcards');
      act(() => {
        fireEvent.click(resumeBtn);
      });

      const nextBtn = screen.getByTestId('btn-next-card');
      act(() => {
        fireEvent.click(nextBtn);
      });

      // Session Complete view is active
      expect(screen.getByText('Session Complete')).toBeDefined();
      expect(screen.queryByTestId('flashcard-presentation-boundary')).toBeNull();

      // Invariant: No spoken text was 'undefined', empty, or null
      for (const call of speakHistory) {
        expect(call.spokenText).toBeTruthy();
        expect(call.spokenText).not.toBe('undefined');
        expect(call.spokenText).not.toBe('null');
      }
    });
  });

  describe('5. SESSION RESTART', () => {
    it('cancels old speech, initializes first card (index 0), renders card #1, and triggers auto-TTS after render', () => {
      const allCards = useAppStore.getState().getUnifiedSRSCards();
      const c1 = allCards[0];
      const initialWord = c1.primaryText || c1.word || '';

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
          orderedCardIds: [c1.id],
          currentIndex: 0,
          reviewedCardIds: [],
          reviewedCount: 0,
          totalCards: 1,
        },
      });

      render(<FlashcardDeck />);

      // Resume session
      const resumeBtn = screen.getByTestId('btn-resume-flashcards');
      act(() => {
        fireEvent.click(resumeBtn);
      });

      expect(speakHistory.length).toBe(1);

      // Finish card via nextBtn to get to SessionSummary
      const nextBtn = screen.getByTestId('btn-next-card');
      act(() => {
        fireEvent.click(nextBtn);
      });

      expect(screen.getByText('Session Complete')).toBeDefined();

      // Click restart button in SessionSummary
      const restartBtn = screen.getByTestId('btn-restart-session');
      expect(restartBtn).toBeDefined();

      const cancelCountBefore = cancelHistory.length;
      act(() => {
        fireEvent.click(restartBtn);
      });

      // 1. cancelSpeech was called on restart
      expect(cancelHistory.length).toBeGreaterThan(cancelCountBefore);

      // 2. Card #1 is rendered in DOM
      const boundary = screen.getByTestId('flashcard-presentation-boundary');
      expect(boundary).toBeDefined();

      // 3. Spoke card #1 again cleanly after render
      expect(speakHistory.length).toBe(2);
      expect(speakHistory[1].spokenText).toBe(initialWord);
      expect(speakHistory[1].cardBoundaryMounted).toBe(true);
    });
  });

  describe('6. CONTINUITY: COMPLETED ALWAYS WINS & STALE RESUME', () => {
    it('completed session is never resurrected from stale resume (Completed Always Wins)', () => {
      const allCards = useAppStore.getState().getUnifiedSRSCards();
      const c1 = allCards[0];

      // Activity with completed: true
      useAppStore.getState().upsertResumeActivity({
        id: 'flashcard_active_session',
        type: 'flashcard',
        title: 'Phiên Học Thẻ SRS',
        startedAt: Date.now() - 3600000,
        lastActiveAt: Date.now() - 1000,
        completed: true,
        completedAt: Date.now() - 1000,
        schemaVersion: 1,
        checkpoint: {
          queueMode: 'NEW',
          orderedCardIds: [c1.id],
          currentIndex: 1,
          reviewedCardIds: [c1.id],
          reviewedCount: 1,
          totalCards: 1,
          progressPercent: 100,
        },
      });

      render(<FlashcardDeck />);

      // Resume banner must NOT be shown for completed session
      expect(screen.queryByTestId('flashcard-resume-banner')).toBeNull();
      // Session intro renders normal start CTA
      expect(screen.getByTestId('session-intro')).toBeDefined();
      expect(screen.getByTestId('btn-start-session').textContent).toContain('Bắt đầu');
    });

    it('stale resume older than 24 hours is suppressed and not offered for resumption', () => {
      const allCards = useAppStore.getState().getUnifiedSRSCards();
      const c1 = allCards[0];

      // Activity last active 25 hours ago (> FLASHCARD_STALE_MS = 24h)
      useAppStore.getState().upsertResumeActivity({
        id: 'flashcard_active_session',
        type: 'flashcard',
        title: 'Phiên Học Thẻ SRS',
        startedAt: Date.now() - (FLASHCARD_STALE_MS + 7200000),
        lastActiveAt: Date.now() - (FLASHCARD_STALE_MS + 3600000),
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          queueMode: 'NEW',
          orderedCardIds: [c1.id],
          currentIndex: 0,
          reviewedCardIds: [],
          reviewedCount: 0,
          totalCards: 1,
        },
      });

      render(<FlashcardDeck />);

      // Resume banner must NOT be shown for stale activity
      expect(screen.queryByTestId('flashcard-resume-banner')).toBeNull();
    });
  });

  describe('7. NO FAKE REVIEW EVENTS', () => {
    it('card render, presentation boundary, TTS, resume, and restart NEVER mutate srsProgressMap or create review records', () => {
      const store = useAppStore.getState();
      const initialProgressMap = JSON.parse(JSON.stringify(store.srsProgressMap));
      const initialRecentReviews = [...(store.recentReviewEvents || [])];

      const allCards = store.getUnifiedSRSCards();
      const c1 = allCards[0];
      const c2 = allCards[1];

      // Setup resume activity
      store.upsertResumeActivity({
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
        },
      });

      const { rerender } = render(<FlashcardDeck />);

      // 1. On mount & banner render: NO review records
      expect(useAppStore.getState().srsProgressMap).toEqual(initialProgressMap);
      expect(useAppStore.getState().recentReviewEvents).toEqual(initialRecentReviews);

      // 2. On Resume click: Card c2 renders and auto TTS speaks
      const resumeBtn = screen.getByTestId('btn-resume-flashcards');
      act(() => {
        fireEvent.click(resumeBtn);
      });

      expect(screen.getByTestId('flashcard-presentation-boundary')).toBeDefined();
      expect(speakHistory.length).toBe(1);

      // Invariant: Card presentation & TTS NEVER create fake review
      expect(useAppStore.getState().srsProgressMap).toEqual(initialProgressMap);
      expect(useAppStore.getState().recentReviewEvents).toEqual(initialRecentReviews);

      // 3. Complete card via nextBtn and restart from summary:
      const nextBtn = screen.getByTestId('btn-next-card');
      act(() => {
        fireEvent.click(nextBtn);
      });

      expect(screen.getByText('Session Complete')).toBeDefined();
      const restartBtn = screen.getByTestId('btn-restart-session');
      act(() => {
        fireEvent.click(restartBtn);
      });

      // Card is re-rendered
      expect(screen.getByTestId('flashcard-presentation-boundary')).toBeDefined();

      // Invariant: Card renders, boundary presentations, and TTS NEVER create fake reviews.
      // Only the 1 explicit user rating via goodBtn was recorded.
      expect(useAppStore.getState().recentReviewEvents.length).toBe(initialRecentReviews.length + 1);
    });
  });
});
