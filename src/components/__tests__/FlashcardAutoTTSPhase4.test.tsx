// @vitest-environment happy-dom
// src/components/__tests__/FlashcardAutoTTSPhase4.test.tsx
/**
 * PHASE 4 & 5: Synchronize Auto Pronunciation & Auto-TTS Lifecycle Hardening
 * 
 * Verifies core invariants:
 * 1. CURRENT CARD RESOLVED -> CARD RENDERED / PRESENTED -> AUTO TTS ELIGIBLE.
 * 2. Zero arbitrary timeouts (no setTimeout guessing).
 * 3. Exact card identity: Card in DOM matches spoken card at the exact moment of TTS invocation.
 * 4. First card: Card #1 is rendered in DOM before auto-TTS speaks #1 (zero early speak on intro screen).
 * 5. Next card: Card B is rendered in DOM before auto-TTS speaks B (zero speaking B while UI still shows A).
 * 6. Setting: autoPlayAudio=false completely suppresses auto-TTS while manual TTS still works.
 * 7. Flip stability: Flipping card does not trigger duplicate auto-TTS.
 * 8. Cancel old speech: cancelSpeech is invoked on card transition, unmount, restart, and tab switch.
 * 9. React StrictMode: Exactly 1 auto-TTS trigger per card presentation cycle despite double-effect mounts.
 * 10. Rapid rating: Atomic interaction lock prevents double review and double pronunciation.
 * 11. Mid-session state change: Never speaks stale or undefined card when cards are cleared.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useAppStore, clearUnifiedCardsCache } from '../../store/useAppStore';
import { FlashcardDeck } from '../FlashcardDeck';

interface SpeakCallSnapshot {
  spokenText: string;
  cardBoundaryMounted: boolean;
  cardReadyAttr: string | null;
  displayedWordText: string | null;
  sessionIntroMounted: boolean;
  timestamp: number;
}

const speakHistory: SpeakCallSnapshot[] = [];
const cancelHistory: number[] = [];

// Mock speechService to capture exact DOM state at the instant of speakWord invocation
vi.mock('../../services/speechService', () => ({
  speakWord: vi.fn((text: string) => {
    const boundary = document.querySelector('[data-testid="flashcard-presentation-boundary"]');
    const frontWord = document.querySelector('[data-testid="flashcard-front-word"]');
    const intro = document.querySelector('[data-testid="session-intro"]');
    speakHistory.push({
      spokenText: text,
      cardBoundaryMounted: Boolean(boundary),
      cardReadyAttr: boundary?.getAttribute('data-card-ready') || null,
      displayedWordText: frontWord?.textContent?.trim() || null,
      sessionIntroMounted: Boolean(intro),
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

describe('PHASE 4 & 5 — Auto Pronunciation Lifecycle & Hardening', () => {
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
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Invariant 1: Intro Screen must NEVER trigger TTS
  it('1. NEVER triggers TTS while on Session Intro screen before user starts session', () => {
    render(<FlashcardDeck />);

    // Intro screen is active
    expect(screen.getByTestId('session-intro')).toBeDefined();
    expect(screen.queryByTestId('flashcard-presentation-boundary')).toBeNull();

    // Zero TTS calls on mount or while idling on intro
    expect(speakHistory.length).toBe(0);
  });

  // Invariant 2: Ordering on First Card (DOM rendered BEFORE speak invocation)
  it('2. FIRST CARD: Card #1 is rendered and visible in DOM BEFORE speakWord is invoked', () => {
    const allCards = useAppStore.getState().getUnifiedSRSCards();
    const firstCard = allCards[0];
    const expectedWord = firstCard.primaryText || firstCard.word || '';

    render(<FlashcardDeck />);
    expect(speakHistory.length).toBe(0);

    // Click Start CTA to enter session
    const startBtn = screen.getByTestId('btn-start-session');
    fireEvent.click(startBtn);

    // Intro is gone, card is active
    expect(screen.queryByTestId('session-intro')).toBeNull();
    const boundary = screen.getByTestId('flashcard-presentation-boundary');
    expect(boundary).toBeDefined();

    // Invariant proof: speakWord was invoked exactly once for card #1
    expect(speakHistory.length).toBe(1);
    const call = speakHistory[0];

    // AT THE EXACT TIME OF INVOCATION:
    // 1. Presentation boundary was already mounted in DOM
    expect(call.cardBoundaryMounted).toBe(true);
    // 2. Session intro was NOT in DOM
    expect(call.sessionIntroMounted).toBe(false);
    // 3. The card front text in DOM matched the card word
    expect(call.displayedWordText).toContain(expectedWord);
    // 4. The spoken text was strictly the card word
    expect(call.spokenText).toBe(expectedWord);
  });

  // Invariant 3: Ordering on Next Card & Cancel Old Speech
  it('3. NEXT CARD & CANCEL: Card B renders BEFORE speakWord B, and cancels speech from card A', () => {
    const allCards = useAppStore.getState().getUnifiedSRSCards();
    const cardA = allCards[0];
    const cardB = allCards[1];
    const wordA = cardA.primaryText || cardA.word || '';
    const wordB = cardB.primaryText || cardB.word || '';

    render(<FlashcardDeck />);
    fireEvent.click(screen.getByTestId('btn-start-session'));

    expect(speakHistory.length).toBe(1);
    expect(speakHistory[0].spokenText).toBe(wordA);
    const cancelCountBeforeGrade = cancelHistory.length;

    // Flip card A and Grade it (advancing to card B)
    fireEvent.click(screen.getByTestId('btn-flip-card'));
    const goodBtn = screen.getByTestId('btn-grade-good');
    fireEvent.click(goodBtn);

    // Cancel was invoked during transition to ensure card A speech does not bleed into card B
    expect(cancelHistory.length).toBeGreaterThan(cancelCountBeforeGrade);

    // Now card B has been presented
    expect(speakHistory.length).toBe(2);
    const callB = speakHistory[1];

    // AT THE EXACT MOMENT Card B TTS was invoked:
    // 1. Boundary was mounted with card B
    expect(callB.cardBoundaryMounted).toBe(true);
    // 2. DOM was ALREADY showing Card B's text (NEVER Card A!)
    expect(callB.displayedWordText).toContain(wordB);
    expect(callB.displayedWordText).not.toBe(wordA);
    // 3. Spoken text was Card B
    expect(callB.spokenText).toBe(wordB);
  });

  // Invariant 4: autoPlayAudio = false strictly suppresses auto TTS
  it('4. AUTO PRONOUNCE OFF: suppresses auto-TTS when setting is disabled, but manual TTS button still works', () => {
    useAppStore.setState({ autoPlayAudio: false });

    render(<FlashcardDeck />);
    fireEvent.click(screen.getByTestId('btn-start-session'));

    // Card #1 is displayed in DOM
    expect(screen.getByTestId('flashcard-presentation-boundary')).toBeDefined();
    expect(screen.getByTestId('flashcard-front-word')).toBeDefined();

    // Auto-TTS was NOT invoked
    expect(speakHistory.length).toBe(0);

    // Manual audio button ("Nghe mẫu" or Volume2) still works when user clicks it
    const manualListenBtn = screen.getByText(/Nghe mẫu/);
    fireEvent.click(manualListenBtn);

    expect(speakHistory.length).toBe(1);
  });

  // Invariant 5: Card flip does not trigger duplicate auto-TTS
  it('5. FLIP STABILITY: flipping card back and forth does NOT duplicate auto-TTS', () => {
    render(<FlashcardDeck />);
    fireEvent.click(screen.getByTestId('btn-start-session'));

    expect(speakHistory.length).toBe(1);

    // Flip card to back face
    fireEvent.click(screen.getByTestId('btn-flip-card'));
    expect(speakHistory.length).toBe(1);

    // Flip card back to front face
    fireEvent.click(screen.getByTestId('btn-flip-card'));
    expect(speakHistory.length).toBe(1);
  });

  // Invariant 6: Resumed session synchronizes with the first resumed card
  it('6. RESUME SESSION: auto-TTS synchronizes with resumed card after render', () => {
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
    // Before resuming, zero TTS
    expect(speakHistory.length).toBe(0);

    // Click resume button in banner
    const resumeBtn = screen.getByTestId('btn-resume-flashcards');
    fireEvent.click(resumeBtn);

    // Resumed card is c2, boundary is mounted
    expect(screen.getByTestId('flashcard-presentation-boundary')).toBeDefined();
    expect(speakHistory.length).toBe(1);

    const call = speakHistory[0];
    expect(call.spokenText).toBe(c2.primaryText || c2.word || '');
    expect(call.displayedWordText).toContain(c2.primaryText || c2.word || '');
  });

  // Invariant 7: React StrictMode Development Behavior
  it('7. STRICT MODE: exactly 1 automatic TTS trigger per card presentation cycle despite double effect runs', () => {
    render(
      <React.StrictMode>
        <FlashcardDeck />
      </React.StrictMode>
    );

    // On intro screen: zero TTS
    expect(speakHistory.length).toBe(0);

    // Start session in StrictMode
    const startBtn = screen.getByTestId('btn-start-session');
    fireEvent.click(startBtn);

    // Card #1 must have EXACTLY 1 auto-TTS trigger (never 2!)
    expect(speakHistory.length).toBe(1);

    // Advance to Card #2
    fireEvent.click(screen.getByTestId('btn-flip-card'));
    fireEvent.click(screen.getByTestId('btn-grade-good'));

    // Card #2 must have EXACTLY 1 auto-TTS trigger (total 2)
    expect(speakHistory.length).toBe(2);
  });

  // Invariant 8: Rapid Rating Atomic Interaction Protection
  it('8. RAPID RATING: blocks rapid double clicks, preventing double review and duplicate TTS', () => {
    const processReviewSpy = vi.spyOn(useAppStore.getState(), 'processReview');

    render(<FlashcardDeck />);
    fireEvent.click(screen.getByTestId('btn-start-session'));

    expect(speakHistory.length).toBe(1);

    fireEvent.click(screen.getByTestId('btn-flip-card'));
    const goodBtn = screen.getByTestId('btn-grade-good');

    // Rapid double click synchronously
    fireEvent.click(goodBtn);
    fireEvent.click(goodBtn);

    // Atomic lock prevents second review
    expect(processReviewSpy).toHaveBeenCalledTimes(1);

    // Advances to card #2 with exactly 1 new TTS call (total 2)
    expect(speakHistory.length).toBe(2);
  });

  // Invariant 9: Unmount and View Navigation Cleanup
  it('9. UNMOUNT CLEANUP: cancels ongoing speech when FlashcardDeck unmounts', () => {
    const { unmount } = render(<FlashcardDeck />);
    fireEvent.click(screen.getByTestId('btn-start-session'));

    const initialCancels = cancelHistory.length;
    unmount();

    // cancelSpeech was called on unmount
    expect(cancelHistory.length).toBeGreaterThan(initialCancels);
  });

  // Invariant 10: Tab Switching / Visibility Change
  it('10. TAB SWITCHING: cancels active speech when browser tab is hidden', () => {
    render(<FlashcardDeck />);
    fireEvent.click(screen.getByTestId('btn-start-session'));

    const cancelCountBeforeTabSwitch = cancelHistory.length;

    // Simulate tab switched / hidden
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // cancelSpeech was triggered
    expect(cancelHistory.length).toBeGreaterThan(cancelCountBeforeTabSwitch);

    // Reset document.hidden
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  // Invariant 11: Mid-Session State Change (Deleted/Empty Queue)
  it('11. MID-SESSION DELETED CARDS: never speaks undefined or stale card if session words are cleared', () => {
    render(<FlashcardDeck />);
    fireEvent.click(screen.getByTestId('btn-start-session'));

    expect(speakHistory.length).toBe(1);

    // Simulate all cards deleted/cleared mid-session
    act(() => {
      useAppStore.setState({
        vocabularyList: [],
        userCustomWords: [],
        userCollocations: [],
      });
    });

    // Does not invoke auto-TTS with undefined or garbage text
    const invalidCalls = speakHistory.filter((c) => !c.spokenText || c.spokenText.trim() === '' || c.spokenText === 'undefined');
    expect(invalidCalls.length).toBe(0);
  });
});
