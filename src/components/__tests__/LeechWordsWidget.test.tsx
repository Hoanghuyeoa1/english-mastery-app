// @vitest-environment happy-dom
// src/components/__tests__/LeechWordsWidget.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LeechWordsWidget } from '../LeechWordsWidget';
import { VocabWord } from '../../types';
import * as speechService from '../../services/speechService';

vi.mock('../../services/speechService', () => ({
  speakWord: vi.fn(),
}));

describe('PHASE 5: LeechWordsWidget UI Component', () => {
  const onNavigateMock = vi.fn();

  it('renders positive empty state when no leeches are detected in the deck', () => {
    const mockWords: VocabWord[] = [
      {
        id: 'w1',
        word: 'cat',
        ipa: 'kæt',
        partOfSpeech: 'n',
        meaning: 'con mèo',
        example: 'A cute cat',
        tag: 'Daily',
        srsLevel: 3,
        nextReviewDate: new Date().toISOString(),
        interval: 10,
        easeFactor: 2.5,
        reviewCount: 3,
        againCount: 0,
      },
    ];

    render(
      <LeechWordsWidget
        vocabularyList={mockWords}
        onNavigate={onNavigateMock}
      />
    );

    expect(screen.getByTestId('leech-widget-empty')).toBeDefined();
    expect(screen.getByText(/Trí nhớ vững vàng/i)).toBeDefined();
  });

  it('renders prominent alert widget and word details when leeches are detected', () => {
    const mockWords: VocabWord[] = [
      {
        id: 'leech_1',
        word: 'paradox',
        ipa: 'ˈpær.ə.dɒks',
        partOfSpeech: 'n',
        meaning: 'nghịch lý',
        example: 'It is a paradox.',
        tag: 'Academic',
        srsLevel: 1,
        nextReviewDate: new Date().toISOString(),
        interval: 1,
        easeFactor: 1.5,
        fsrs: {
          reps: 8,
          lapses: 4,
          difficulty: 9.0,
          stability: 1.0,
          state: 3,
          lastReview: new Date().toISOString(),
        },
      },
    ];

    render(
      <LeechWordsWidget
        vocabularyList={mockWords}
        onNavigate={onNavigateMock}
      />
    );

    expect(screen.getByTestId('leech-widget')).toBeDefined();
    expect(screen.getByText('paradox')).toBeDefined();
    expect(screen.getByText('/ˈpær.ə.dɒks/')).toBeDefined();
    expect(screen.getByText('nghịch lý')).toBeDefined();
    expect(screen.getByText(/Đã quên \(lapse\) 4 lần/i)).toBeDefined();
    expect(screen.getByText(/Độ khó FSRS cao \(9.0\/10\)/i)).toBeDefined();
  });

  it('triggers speech audio when speaker button is clicked', () => {
    const speakSpy = vi.spyOn(speechService, 'speakWord');
    const mockWords: VocabWord[] = [
      {
        id: 'leech_1',
        word: 'paradox',
        ipa: 'ˈpær.ə.dɒks',
        partOfSpeech: 'n',
        meaning: 'nghịch lý',
        example: 'It is a paradox.',
        tag: 'Academic',
        srsLevel: 1,
        nextReviewDate: new Date().toISOString(),
        interval: 1,
        easeFactor: 1.5,
        fsrs: {
          reps: 8,
          lapses: 4,
          difficulty: 9.0,
          stability: 1.0,
          state: 3,
          lastReview: new Date().toISOString(),
        },
      },
    ];

    render(
      <LeechWordsWidget
        vocabularyList={mockWords}
        onNavigate={onNavigateMock}
      />
    );

    const speakBtn = screen.getByTitle('Phát âm từ vựng');
    fireEvent.click(speakBtn);

    expect(speakSpy).toHaveBeenCalledWith('paradox');
  });

  it('triggers navigation when "Sổ Bẫy Lỗi" or "Ôn Tập Ngay" is clicked', () => {
    const mockWords: VocabWord[] = [
      {
        id: 'leech_1',
        word: 'paradox',
        ipa: 'ˈpær.ə.dɒks',
        partOfSpeech: 'n',
        meaning: 'nghịch lý',
        example: 'It is a paradox.',
        tag: 'Academic',
        srsLevel: 1,
        nextReviewDate: new Date().toISOString(),
        interval: 1,
        easeFactor: 1.5,
        fsrs: {
          reps: 8,
          lapses: 4,
          difficulty: 9.0,
          stability: 1.0,
          state: 3,
          lastReview: new Date().toISOString(),
        },
      },
    ];

    render(
      <LeechWordsWidget
        vocabularyList={mockWords}
        onNavigate={onNavigateMock}
      />
    );

    const mistakeBtn = screen.getByText('Sổ Bẫy Lỗi');
    fireEvent.click(mistakeBtn);
    expect(onNavigateMock).toHaveBeenCalledWith('mistakes');

    const reviewBtn = screen.getByText('Ôn Tập Ngay');
    fireEvent.click(reviewBtn);
    expect(onNavigateMock).toHaveBeenCalledWith('flashcards');
  });
});
