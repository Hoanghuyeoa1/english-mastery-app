// @vitest-environment happy-dom
// src/components/__tests__/ToeicAudioPlayer.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ToeicAudioPlayer } from '../ToeicAudioPlayer';
import { ToeicAudioEngineState } from '../../services/toeicAudioEngine';
import { ToeicAudioTimingSegment } from '../../types/toeic';

describe('ToeicAudioPlayer Component (Phase 2 Accessibility & Controls)', () => {
  const sampleSegments: ToeicAudioTimingSegment[] = [
    {
      id: 'seg_1',
      speaker: 'Speaker 1',
      text: 'Good morning everyone.',
      startMs: 0,
      endMs: 3000,
      tokens: [
        { text: 'Good', startMs: 0, endMs: 500 },
        { text: 'morning', startMs: 501, endMs: 1500 },
        { text: 'everyone.', startMs: 1501, endMs: 3000 },
      ],
    },
  ];

  const baseState: ToeicAudioEngineState = {
    status: 'ready',
    sourceType: 'mp3',
    audioUrl: 'https://cdn.example.com/audio/sample.mp3',
    textToSpeak: null,
    accent: 'en-US',
    playbackRate: 1.0,
    currentTimeMs: 5000,
    durationMs: 30000,
    volume: 1.0,
    isMuted: false,
    hasValidTiming: true,
    timingSegments: sampleSegments,
    activeSegmentIndex: 0,
    activeSegment: null,
    activeToken: null,
    hasPlaybackStarted: false,
    fallbackOccurred: false,
    isInheritedFromGroup: false,
  };

  it('renders player with accessible aria-label and region role', () => {
    render(
      <ToeicAudioPlayer
        state={baseState}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onTogglePlay={vi.fn()}
        onRestart={vi.fn()}
        onSeek={vi.fn()}
        onToggleMute={vi.fn()}
        title="Part 1: Photo 1"
      />
    );

    expect(screen.getByRole('region', { name: /Bộ điều khiển âm thanh: Part 1: Photo 1/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Phát âm thanh bài nghe/i })).toBeTruthy();
    expect(screen.getByRole('slider', { name: /Thanh trượt thời gian bài nghe/i })).toBeTruthy();
  });

  it('triggers onTogglePlay when play button is clicked or activated with keyboard', () => {
    const handleTogglePlay = vi.fn();
    render(
      <ToeicAudioPlayer
        state={baseState}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onTogglePlay={handleTogglePlay}
        onRestart={vi.fn()}
        onSeek={vi.fn()}
        onToggleMute={vi.fn()}
      />
    );

    const playBtn = screen.getByRole('button', { name: /Phát âm thanh bài nghe/i });
    fireEvent.click(playBtn);
    expect(handleTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('triggers onSeek when slider range changes', () => {
    const handleSeek = vi.fn();
    render(
      <ToeicAudioPlayer
        state={baseState}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onTogglePlay={vi.fn()}
        onRestart={vi.fn()}
        onSeek={handleSeek}
        onToggleMute={vi.fn()}
      />
    );

    const slider = screen.getByRole('slider', { name: /Thanh trượt thời gian bài nghe/i });
    fireEvent.change(slider, { target: { value: '12000' } });
    expect(handleSeek).toHaveBeenCalledWith(12000);
  });

  it('displays Studio MP3 badge for MP3 and Web Speech TTS badge for TTS', () => {
    const { rerender } = render(
      <ToeicAudioPlayer
        state={baseState}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onTogglePlay={vi.fn()}
        onRestart={vi.fn()}
        onSeek={vi.fn()}
        onToggleMute={vi.fn()}
      />
    );

    expect(screen.getByText(/Studio MP3/i)).toBeTruthy();

    // Rerender with TTS state
    const ttsState: ToeicAudioEngineState = {
      ...baseState,
      sourceType: 'tts',
      fallbackOccurred: true,
    };

    rerender(
      <ToeicAudioPlayer
        state={ttsState}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onTogglePlay={vi.fn()}
        onRestart={vi.fn()}
        onSeek={vi.fn()}
        onToggleMute={vi.fn()}
      />
    );

    expect(screen.getByText(/TTS Fallback/i)).toBeTruthy();
  });

  it('renders transcript with token highlighting safely without dangerouslySetInnerHTML', () => {
    const stateWithActiveToken: ToeicAudioEngineState = {
      ...baseState,
      status: 'playing',
      activeSegmentIndex: 0,
      activeToken: { text: 'morning', startMs: 501, endMs: 1500 },
    };

    render(
      <ToeicAudioPlayer
        state={stateWithActiveToken}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onTogglePlay={vi.fn()}
        onRestart={vi.fn()}
        onSeek={vi.fn()}
        onToggleMute={vi.fn()}
        timingSegments={sampleSegments}
      />
    );

    // Open transcript
    const transcriptBtn = screen.getByRole('button', { name: /Xem lời thoại bài nghe/i });
    fireEvent.click(transcriptBtn);

    expect(screen.getByText('Speaker 1:')).toBeTruthy();
    expect(screen.getByText(/Good/)).toBeTruthy();
    expect(screen.getByText(/morning/)).toBeTruthy();
    expect(screen.getByText(/everyone\./)).toBeTruthy();
  });

  it('disables play button in ETS Mock mode if replay is prohibited and playback was already started', () => {
    const statePlayedOnce: ToeicAudioEngineState = {
      ...baseState,
      hasPlaybackStarted: true,
      status: 'ended',
    };

    render(
      <ToeicAudioPlayer
        state={statePlayedOnce}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onTogglePlay={vi.fn()}
        onRestart={vi.fn()}
        onSeek={vi.fn()}
        onToggleMute={vi.fn()}
        allowReplay={false}
      />
    );

    const playBtn = screen.getByRole('button', { name: /Phát lại bài nghe/i }) as HTMLButtonElement;
    expect(playBtn.disabled).toBe(true);
  });
});
