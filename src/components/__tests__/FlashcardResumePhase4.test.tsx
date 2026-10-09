// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore, clearUnifiedCardsCache } from '../../store/useAppStore';
import { FlashcardDeck } from '../FlashcardDeck';

// Mock framer-motion
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

describe('PHASE 4: Flashcard Session Resume Continuity Engine', () => {
  beforeEach(() => {
    useAppStore.getState().resetToDefault();
    clearUnifiedCardsCache();
    useAppStore.setState({
      resumeActivities: {},
    });
  });

  it('renders flashcard-resume-banner when an active in-progress session exists', () => {
    const allCards = useAppStore.getState().getUnifiedSRSCards();
    const c1 = allCards[0];
    const c2 = allCards[1];
    const c3 = allCards[2];

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

    const banner = screen.getByTestId('flashcard-resume-banner');
    expect(banner).toBeDefined();
    expect(banner.textContent).toContain('Đã ôn 1 / 3 thẻ');
  });

  it('resumes session by filtering out reviewed cards, preserving order, with zero double review', () => {
    const allCards = useAppStore.getState().getUnifiedSRSCards();
    const c1 = allCards[0];
    const c2 = allCards[1];
    const c3 = allCards[2];

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

    const resumeBtn = screen.getByTestId('btn-resume-flashcards');
    fireEvent.click(resumeBtn);

    // Banner should disappear
    expect(screen.queryByTestId('flashcard-resume-banner')).toBeNull();

    // The first card shown in resumed session must be c2 (c1 was reviewed and skipped!)
    expect(screen.getByText(c2.word || c2.primaryText || '')).toBeDefined();
    expect(screen.queryByText(c1.word || c1.primaryText || '')).toBeNull();
  });

  it('safely skips deleted/missing cards when resuming', () => {
    const allCards = useAppStore.getState().getUnifiedSRSCards();
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
        orderedCardIds: ['deleted_card_9999', c2.id],
        currentIndex: 0,
        reviewedCardIds: [],
        reviewedCount: 0,
        totalCards: 2,
        progressPercent: 0,
      },
    });

    render(<FlashcardDeck />);

    const resumeBtn = screen.getByTestId('btn-resume-flashcards');
    fireEvent.click(resumeBtn);

    // Missing card was safely skipped, c2 is presented
    expect(screen.getByText(c2.word || c2.primaryText || '')).toBeDefined();
  });

  it('dismisses session banner when clicking [Bắt đầu phiên mới]', () => {
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
        progressPercent: 0,
      },
    });

    render(<FlashcardDeck />);

    expect(screen.getByTestId('flashcard-resume-banner')).toBeDefined();

    const dismissBtn = screen.getByTestId('btn-dismiss-flashcards');
    fireEvent.click(dismissBtn);

    // Banner removed, activity cleared from store
    expect(screen.queryByTestId('flashcard-resume-banner')).toBeNull();
    expect(useAppStore.getState().resumeActivities['flashcard_active_session']).toBeUndefined();
  });

  it('does NOT show banner if the activity is marked completed or stale', () => {
    const allCards = useAppStore.getState().getUnifiedSRSCards();
    const c1 = allCards[0];

    // Activity is stale (> 24 hours for flashcards)
    useAppStore.getState().upsertResumeActivity({
      id: 'flashcard_active_session',
      type: 'flashcard',
      title: 'Phiên Học Thẻ SRS',
      startedAt: Date.now() - 30 * 3600000,
      lastActiveAt: Date.now() - 25 * 3600000,
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

    expect(screen.queryByTestId('flashcard-resume-banner')).toBeNull();
  });
});
