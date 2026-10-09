// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FourSkillsView } from '../FourSkillsView';
import { useAppStore, composeVocabularyList } from '../../store/useAppStore';
import { LISTENING_LESSONS } from '../../data/fourSkills/listeningData';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

class MockSpeechSynthesisUtterance {
  text: string;
  lang = 'en-US';
  rate = 1.0;
  volume = 1.0;
  pitch = 1.0;
  voice = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((err: any) => void) | null = null;
  onboundary: ((evt: any) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

describe('Listening Lab Seek Bar UI & Dragging Integration Suite', () => {
  let mockSpeak: ReturnType<typeof vi.fn>;
  let mockCancel: ReturnType<typeof vi.fn>;
  let lastUtterance: MockSpeechSynthesisUtterance | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    useAppStore.setState({
      srsProgressMap: {},
      userCustomWords: [],
      vocabularyList: composeVocabularyList({}, []),
      mistakeBank: {},
      dailyHistory: {},
      activePracticeConfig: null,
      fourSkillsScores: {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      },
      activeFourSkill: 'listening',
      userCollocations: [],
    });

    lastUtterance = null;
    mockSpeak = vi.fn().mockImplementation((utterance: MockSpeechSynthesisUtterance) => {
      lastUtterance = utterance;
      if (utterance.onstart) {
        utterance.onstart();
      }
    });
    mockCancel = vi.fn();

    (window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
    (window as any).speechSynthesis = {
      speak: mockSpeak,
      cancel: mockCancel,
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: vi.fn().mockReturnValue([]),
      speaking: false,
      paused: false,
      pending: false,
    };
  });

  it('renders seek bar inside Listening Lab with initial 00:00 time and duration', () => {
    render(<FourSkillsView />);

    const lessonCard = screen.getByText(LISTENING_LESSONS[0].title);
    fireEvent.click(lessonCard);

    const seekBar = screen.getByTestId('listening-seek-bar');
    expect(seekBar).toBeDefined();

    const slider = screen.getByLabelText('Thanh tua bài nghe') as HTMLInputElement;
    expect(slider).toBeDefined();
    expect(slider.value).toBe('0');

    const currentTimeEl = screen.getByTestId('seek-current-time');
    expect(currentTimeEl.textContent).toBe('00:00');

    const durationEl = screen.getByTestId('seek-duration');
    expect(durationEl.textContent).toMatch(/^\d{2}:\d{2}$/);
    expect(durationEl.textContent).not.toBe('00:00');
  });

  it('seeking while paused updates highlight position and does NOT auto-play', () => {
    render(<FourSkillsView />);

    const lessonCard = screen.getByText(LISTENING_LESSONS[0].title);
    fireEvent.click(lessonCard);

    const slider = screen.getByLabelText('Thanh tua bài nghe') as HTMLInputElement;
    expect(slider).toBeDefined();

    // User drags slider to 50% (500) and releases while paused
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '500' } });
    fireEvent.pointerUp(slider);

    // Should NOT start audio playback
    expect(mockSpeak).not.toHaveBeenCalled();

    // Play button still says "Nghe Bài Đọc", not "Dừng Nghe"
    expect(screen.getByText('Nghe Bài Đọc')).toBeDefined();
  });

  it('seeking while playing cancels previous speech and resumes playback with sliced text', () => {
    render(<FourSkillsView />);

    const lessonCard = screen.getByText(LISTENING_LESSONS[0].title);
    fireEvent.click(lessonCard);

    // 1. Start audio playback
    const playButton = screen.getByText('Nghe Bài Đọc');
    fireEvent.click(playButton);

    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(lastUtterance).not.toBeNull();
    const originalText = lastUtterance!.text;

    // 2. While playing, drag seek bar to 60% and release
    const slider = screen.getByLabelText('Thanh tua bài nghe') as HTMLInputElement;
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '600' } });
    fireEvent.pointerUp(slider);

    // Should have cancelled previous utterance
    expect(mockCancel).toHaveBeenCalled();

    // Should have started playing the sliced portion
    expect(mockSpeak).toHaveBeenCalledTimes(2);
    expect(lastUtterance).not.toBeNull();
    expect(lastUtterance!.text.length).toBeLessThan(originalText.length);

    // Audio remains playing ("Dừng Nghe" button visible)
    expect(screen.getByText('Dừng Nghe')).toBeDefined();
  });

  it('seeking preserves highlight mode and audio speed settings', () => {
    render(<FourSkillsView />);

    const lessonCard = screen.getByText(LISTENING_LESSONS[0].title);
    fireEvent.click(lessonCard);

    // Switch to Word highlight mode
    const wordModeButton = screen.getByRole('button', { name: /Từng từ \(Word\)/i });
    fireEvent.click(wordModeButton);
    expect(wordModeButton.getAttribute('aria-pressed')).toBe('true');

    // Seek to 40%
    const slider = screen.getByLabelText('Thanh tua bài nghe') as HTMLInputElement;
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '400' } });
    fireEvent.pointerUp(slider);

    // Word mode is preserved
    expect(wordModeButton.getAttribute('aria-pressed')).toBe('true');
  });

  it('auto-scroll is paused while dragging slider and does not throw', () => {
    render(<FourSkillsView />);

    const lessonCard = screen.getByText(LISTENING_LESSONS[0].title);
    fireEvent.click(lessonCard);

    const slider = screen.getByLabelText('Thanh tua bài nghe') as HTMLInputElement;

    // Dragging starts
    fireEvent.pointerDown(slider);

    // Rapid change events (simulating active dragging across slider track)
    fireEvent.change(slider, { target: { value: '100' } });
    fireEvent.change(slider, { target: { value: '200' } });
    fireEvent.change(slider, { target: { value: '300' } });

    // Ensure preview updates without throwing
    expect(slider.getAttribute('aria-valuenow')).toBe('30');

    // Release
    fireEvent.pointerUp(slider);
    expect(slider.getAttribute('aria-valuenow')).toBe('30');
  });
});
