// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ListeningSeekBar } from '../ListeningSeekBar';
import {
  ListeningSyncController,
  formatPlaybackTime,
} from '../../services/listeningSyncService';
import type { ListeningLesson } from '../../data/fourSkills/types';

describe('ListeningSeekBar Component and Time Formatting Suite', () => {
  const mockLesson: ListeningLesson = {
    id: 'test_lesson_seek',
    title: 'Test Audio Lesson',
    level: 'B1',
    category: 'Tech',
    duration: '1:50',
    description: 'Test lesson description for seek bar',
    audioText: 'Sentence one text here. Sentence two text here. Sentence three conclusion.',
    sentences: [
      { en: 'Sentence one text here.', vi: 'Câu một.' },
      { en: 'Sentence two text here.', vi: 'Câu hai.' },
      { en: 'Sentence three conclusion.', vi: 'Câu ba.' },
    ],
    questions: [],
  };

  let controller: ListeningSyncController;
  const onSeekMock = vi.fn<(progress: number) => void>();
  const onSeekingChangeMock = vi.fn<(isSeeking: boolean) => void>();

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new ListeningSyncController({
      onHighlightChange: vi.fn(),
      onPlaybackEnd: vi.fn(),
    });
    controller.setLesson(mockLesson, 1.0);
    onSeekMock.mockReset();
    onSeekingChangeMock.mockReset();
  });

  // =========================================================================
  // 1. TIME FORMATTER UTILITY
  // =========================================================================
  describe('formatPlaybackTime', () => {
    it('handles normal seconds with default padMinutes=false', () => {
      expect(formatPlaybackTime(0)).toBe('0:00');
      expect(formatPlaybackTime(5)).toBe('0:05');
      expect(formatPlaybackTime(65)).toBe('1:05');
      expect(formatPlaybackTime(767)).toBe('12:47');
    });

    it('handles normal seconds with padMinutes=true', () => {
      expect(formatPlaybackTime(34, true)).toBe('00:34');
      expect(formatPlaybackTime(138, true)).toBe('02:18');
    });

    it('handles durations >= 1 hour (3600s)', () => {
      expect(formatPlaybackTime(3600)).toBe('1:00:00');
      expect(formatPlaybackTime(3665)).toBe('1:01:05');
      expect(formatPlaybackTime(7325)).toBe('2:02:05');
    });

    it('safely handles NaN, Infinity, negative values, null and undefined', () => {
      expect(formatPlaybackTime(NaN)).toBe('0:00');
      expect(formatPlaybackTime(Infinity)).toBe('0:00');
      expect(formatPlaybackTime(-10)).toBe('0:00');
      expect(formatPlaybackTime(null)).toBe('0:00');
      expect(formatPlaybackTime(undefined)).toBe('0:00');

      expect(formatPlaybackTime(NaN, true)).toBe('00:00');
      expect(formatPlaybackTime(Infinity, true)).toBe('00:00');
      expect(formatPlaybackTime(-1, true)).toBe('00:00');
      expect(formatPlaybackTime(null, true)).toBe('00:00');
      expect(formatPlaybackTime(undefined, true)).toBe('00:00');
    });
  });

  // =========================================================================
  // 2. RENDERING AND ARIA ACCESSIBILITY
  // =========================================================================
  describe('Rendering and ARIA Accessibility', () => {
    it('renders seek bar container, slider input, and formatted time labels', () => {
      render(
        <ListeningSeekBar
          controller={controller}
          isPlaying={false}
          onSeek={onSeekMock}
          onSeekingChange={onSeekingChangeMock}
        />
      );

      expect(screen.getByTestId('listening-seek-bar')).toBeDefined();
      const slider = screen.getByLabelText('Thanh tua bài nghe') as HTMLInputElement;
      expect(slider).toBeDefined();
      expect(slider.type).toBe('range');
      expect(slider.min).toBe('0');
      expect(slider.max).toBe('1000');
      expect(slider.step).toBe('1');

      // Check ARIA properties
      expect(slider.getAttribute('aria-valuemin')).toBe('0');
      expect(slider.getAttribute('aria-valuemax')).toBe('100');
      expect(slider.getAttribute('aria-valuenow')).toBe('0');

      // Check time displays
      const currentTimeEl = screen.getByTestId('seek-current-time');
      const durationEl = screen.getByTestId('seek-duration');
      expect(currentTimeEl.textContent).toBe('00:00');
      // Duration from controller estimated time (around 10-15s for 3 short sentences)
      expect(durationEl.textContent).toMatch(/^\d{2}:\d{2}$/);
    });

    it('respects disabled prop and applies disabled styling and attributes', () => {
      render(
        <ListeningSeekBar
          controller={controller}
          isPlaying={false}
          onSeek={onSeekMock}
          onSeekingChange={onSeekingChangeMock}
          disabled={true}
        />
      );

      const slider = screen.getByLabelText('Thanh tua bài nghe') as HTMLInputElement;
      expect(slider.disabled).toBe(true);

      fireEvent.pointerDown(slider);
      expect(onSeekingChangeMock).not.toHaveBeenCalled();

      fireEvent.change(slider, { target: { value: '500' } });
      fireEvent.pointerUp(slider);
      expect(onSeekMock).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. DRAGGING INTERACTION AND PREVIEW UX
  // =========================================================================
  describe('Dragging Interaction and Preview UX', () => {
    it('updates preview time while dragging without spamming onSeek per change', () => {
      render(
        <ListeningSeekBar
          controller={controller}
          isPlaying={false}
          onSeek={onSeekMock}
          onSeekingChange={onSeekingChangeMock}
        />
      );

      const slider = screen.getByLabelText('Thanh tua bài nghe') as HTMLInputElement;

      // 1. User starts dragging
      fireEvent.pointerDown(slider);
      expect(onSeekingChangeMock).toHaveBeenCalledWith(true);

      // 2. User moves slider to 50% (value 500)
      fireEvent.change(slider, { target: { value: '500' } });

      // onSeek should NOT have been called during dragging
      expect(onSeekMock).not.toHaveBeenCalled();

      // But slider aria-valuenow reflects preview
      expect(slider.getAttribute('aria-valuenow')).toBe('50');

      // 3. User releases pointer on slider
      fireEvent.pointerUp(slider);

      // onSeekingChange(false) called
      expect(onSeekingChangeMock).toHaveBeenCalledWith(false);

      // onSeek is now called with target progress (0.5)
      expect(onSeekMock).toHaveBeenCalledWith(0.5);
    });

    it('commits seek cleanly when user drags and releases pointer outside the slider on window', () => {
      render(
        <ListeningSeekBar
          controller={controller}
          isPlaying={false}
          onSeek={onSeekMock}
          onSeekingChange={onSeekingChangeMock}
        />
      );

      const slider = screen.getByLabelText('Thanh tua bài nghe') as HTMLInputElement;

      // Pointer down and drag to 75%
      fireEvent.pointerDown(slider);
      expect(onSeekingChangeMock).toHaveBeenCalledWith(true);

      fireEvent.change(slider, { target: { value: '750' } });
      expect(onSeekMock).not.toHaveBeenCalled();

      // Release on window
      act(() => {
        window.dispatchEvent(new Event('pointerup'));
      });

      expect(onSeekingChangeMock).toHaveBeenCalledWith(false);
      expect(onSeekMock).toHaveBeenCalledWith(0.75);
    });

    it('supports mouse events fallback (mouseDown -> change -> mouseUp)', () => {
      render(
        <ListeningSeekBar
          controller={controller}
          isPlaying={false}
          onSeek={onSeekMock}
          onSeekingChange={onSeekingChangeMock}
        />
      );

      const slider = screen.getByLabelText('Thanh tua bài nghe') as HTMLInputElement;

      fireEvent.mouseDown(slider);
      expect(onSeekingChangeMock).toHaveBeenCalledWith(true);

      fireEvent.change(slider, { target: { value: '300' } });
      expect(onSeekMock).not.toHaveBeenCalled();

      fireEvent.mouseUp(slider);
      expect(onSeekingChangeMock).toHaveBeenCalledWith(false);
      expect(onSeekMock).toHaveBeenCalledWith(0.3);
    });
  });

  // =========================================================================
  // 4. KEYBOARD ACCESSIBILITY
  // =========================================================================
  describe('Keyboard Accessibility', () => {
    it('commits seek when using arrow keys, Home, or End', () => {
      render(
        <ListeningSeekBar
          controller={controller}
          isPlaying={false}
          onSeek={onSeekMock}
          onSeekingChange={onSeekingChangeMock}
        />
      );

      const slider = screen.getByLabelText('Thanh tua bài nghe') as HTMLInputElement;

      // Simulate key navigation
      slider.value = '400';
      fireEvent.keyUp(slider, { key: 'ArrowRight' });

      expect(onSeekMock).toHaveBeenCalledWith(0.4);

      slider.value = '0';
      fireEvent.keyUp(slider, { key: 'Home' });
      expect(onSeekMock).toHaveBeenCalledWith(0);

      slider.value = '1000';
      fireEvent.keyUp(slider, { key: 'End' });
      expect(onSeekMock).toHaveBeenCalledWith(1.0);
    });
  });

  // =========================================================================
  // 5. PLAYBACK POSITION SYNCING
  // =========================================================================
  describe('Playback Position Polling', () => {
    it('syncs position from controller when playing', () => {
      vi.useFakeTimers();

      render(
        <ListeningSeekBar
          controller={controller}
          isPlaying={true}
          onSeek={onSeekMock}
          onSeekingChange={onSeekingChangeMock}
        />
      );

      // Simulate boundary moving controller forward
      controller.start();
      controller.onBoundary(25, 'word');

      // Advance timer by 250ms (interval is 200ms)
      act(() => {
        vi.advanceTimersByTime(250);
      });

      const pos = controller.getCurrentPosition();
      expect(pos.progress).toBeGreaterThan(0);

      const slider = screen.getByLabelText('Thanh tua bài nghe') as HTMLInputElement;
      expect(parseInt(slider.value, 10)).toBeGreaterThan(0);

      vi.useRealTimers();
    });
  });
});
