// src/services/__tests__/toeicAudioEngine.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToeicAudioEngine } from '../toeicAudioEngine';
import { ToeicQuestion, ToeicQuestionGroup } from '../../types/toeic';

/**
 * Mock HTMLAudioElement for testing native audio playback, events, and lifecycle.
 */
class MockAudioElement {
  src: string;
  preload = 'metadata';
  playbackRate = 1.0;
  volume = 1.0;
  currentTime = 0;
  duration = 30; // 30 seconds default
  loop = false;
  paused = true;
  error: any = null;

  private listeners: Record<string, Function[]> = {};

  constructor(src = '') {
    this.src = src;
  }

  addEventListener(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  removeEventListener(event: string, fn: Function) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((l) => l !== fn);
  }

  emit(event: string, data?: any) {
    const fns = [...(this.listeners[event] || [])];
    fns.forEach((fn) => fn(data || new Event(event)));
  }

  play = vi.fn().mockImplementation(() => {
    this.paused = false;
    this.emit('play');
    return Promise.resolve();
  });

  pause = vi.fn().mockImplementation(() => {
    this.paused = true;
    this.emit('pause');
  });

  load = vi.fn();
}

/**
 * Mock SpeechSynthesisUtterance for testing Web Speech API fallbacks
 */
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
  constructor(text: string) {
    this.text = text;
  }
}

describe('ToeicAudioEngine (Phase 2 Playback, Fallback & Synchronization)', () => {
  let createdMockAudios: MockAudioElement[] = [];
  let mockSpeechCancel: any;
  let mockSpeechSpeak: any;

  beforeEach(() => {
    createdMockAudios = [];
    mockSpeechCancel = vi.fn();
    mockSpeechSpeak = vi.fn((utterance: MockSpeechSynthesisUtterance) => {
      utterance.onstart?.();
    });

    (globalThis as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
    (globalThis as any).window = {
      navigator: { userAgent: 'test-agent' },
      SpeechSynthesisUtterance: MockSpeechSynthesisUtterance,
      speechSynthesis: {
        cancel: mockSpeechCancel,
        getVoices: () => [],
        speak: mockSpeechSpeak,
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createEngine = (initialVolume = 1.0) => {
    return new ToeicAudioEngine({
      audioFactory: (src?: string) => {
        const audio = new MockAudioElement(src);
        createdMockAudios.push(audio);
        return audio as any;
      },
      initialVolume,
    });
  };

  // =========================================================================
  // 1. MP3 PLAYBACK LIFECYCLE
  // =========================================================================
  describe('1. MP3 Play Path Lifecycle', () => {
    it('initializes in idle status and loads MP3 into loading/ready state', () => {
      const engine = createEngine();
      expect(engine.getState().status).toBe('idle');

      const question: Partial<ToeicQuestion> = {
        id: 'toeic_p1_01',
        part: 'part1_photos',
        skill: 'listening',
        audioMetadata: {
          url: 'https://cdn.example.com/audio/p1_01.mp3',
          format: 'mp3',
          durationMs: 15000,
        },
      };

      engine.load(question as ToeicQuestion);

      expect(engine.getState().status).toBe('loading');
      expect(engine.getState().sourceType).toBe('mp3');
      expect(createdMockAudios.length).toBe(1);

      // Trigger native loadedmetadata
      createdMockAudios[0].emit('loadedmetadata');
      createdMockAudios[0].emit('canplay');

      expect(engine.getState().status).toBe('ready');
      expect(engine.getState().durationMs).toBe(30000); // from mock audio duration
    });

    it('plays, pauses, and resumes MP3 keeping track of currentTime', async () => {
      const engine = createEngine();
      const question: Partial<ToeicQuestion> = {
        id: 'toeic_p1_02',
        audioMetadata: { url: '/audio/test.mp3', format: 'mp3' },
      };

      engine.load(question as ToeicQuestion);
      createdMockAudios[0].emit('canplay');

      // Play
      await engine.play();
      expect(engine.getState().status).toBe('playing');
      expect(createdMockAudios[0].play).toHaveBeenCalled();

      // Pause
      engine.pause();
      expect(engine.getState().status).toBe('paused');
      expect(createdMockAudios[0].pause).toHaveBeenCalled();

      // Resume
      await engine.play();
      expect(engine.getState().status).toBe('playing');
    });

    it('handles ended event and transitions to ended status', async () => {
      const engine = createEngine();
      engine.load({ audioMetadata: { url: '/audio/test.mp3' } });
      createdMockAudios[0].emit('canplay');
      await engine.play();

      createdMockAudios[0].emit('ended');
      expect(engine.getState().status).toBe('ended');
      expect(engine.getState().activeSegmentIndex).toBe(-1);
    });

    it('restart() seeks to 0 and starts playing', async () => {
      const engine = createEngine();
      engine.load({ audioMetadata: { url: '/audio/test.mp3' } });
      createdMockAudios[0].emit('canplay');

      engine.seek(12000);
      expect(createdMockAudios[0].currentTime).toBe(12);

      engine.restart();
      expect(createdMockAudios[0].currentTime).toBe(0);
      expect(createdMockAudios[0].play).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. SAFE MP3 -> TTS FALLBACK
  // =========================================================================
  describe('2. Safe MP3 -> TTS Fallback & Runtime Protection', () => {
    it('falls back to TTS when question has no MP3 (Legacy Question)', async () => {
      const engine = createEngine();
      const legacyQuestion: Partial<ToeicQuestion> = {
        id: 'toeic_legacy_1',
        audioScript: '(A) The workers are wearing hard hats.',
      };

      engine.load(legacyQuestion as ToeicQuestion);

      expect(engine.getState().sourceType).toBe('tts');
      expect(engine.getState().status).toBe('ready');
      expect(engine.getState().textToSpeak).toBe('(A) The workers are wearing hard hats.');

      await engine.play();
      expect(mockSpeechSpeak).toHaveBeenCalled();
      expect(engine.getState().status).toBe('playing');
    });

    it('falls back to TTS when MP3 encounters load error BEFORE playback starts', () => {
      const engine = createEngine();
      const brokenMp3Question: Partial<ToeicQuestion> = {
        id: 'toeic_broken_mp3',
        audioMetadata: { url: 'https://bad-domain.invalid/missing.mp3' },
        audioScript: 'Man: Hello, how can I help you?',
      };

      engine.load(brokenMp3Question as ToeicQuestion);
      expect(engine.getState().status).toBe('loading');
      expect(engine.getState().sourceType).toBe('mp3');

      // Trigger error event BEFORE playback began
      createdMockAudios[0].emit('error', new Event('error'));

      // Engine must gracefully fall back to TTS!
      expect(engine.getState().sourceType).toBe('tts');
      expect(engine.getState().status).toBe('ready');
      expect(engine.getState().textToSpeak).toBe('Man: Hello, how can I help you?');
      expect(engine.getState().fallbackOccurred).toBe(true);
      expect(engine.getState().fallbackReason).toBe('MP3_LOAD_FAILURE_FALLBACK_TTS');
    });

    it('CRITICAL: runtime error AFTER MP3 starts playing does NOT fallback to TTS or read from scratch', async () => {
      const engine = createEngine();
      const question: Partial<ToeicQuestion> = {
        id: 'toeic_runtime_err',
        audioMetadata: { url: '/audio/stream.mp3' },
        audioScript: 'Man: Do not read this again from scratch if stream broke halfway.',
      };

      engine.load(question as ToeicQuestion);
      createdMockAudios[0].emit('canplay');

      // Playback begins successfully
      await engine.play();
      expect(engine.getState().hasPlaybackStarted).toBe(true);

      // Now audio element encounters runtime error (e.g. network disconnect at second 15)
      createdMockAudios[0].currentTime = 15;
      createdMockAudios[0].emit('error', new Error('Network stream interrupted'));

      // Engine must stop safely and transition to error without reading TTS from scratch!
      expect(engine.getState().status).toBe('error');
      expect(engine.getState().sourceType).toBe('mp3'); // does NOT switch to TTS!
      expect(mockSpeechSpeak).not.toHaveBeenCalled(); // TTS is strictly NOT triggered!
    });
  });

  // =========================================================================
  // 3. MUTEX & SINGLE ACTIVE SOURCE INVARIANT
  // =========================================================================
  describe('3. Mutex & Single Active Source Invariant', () => {
    it('cancels any active TTS immediately when MP3 play() begins', async () => {
      const engine = createEngine();
      // First play TTS
      engine.load({ audioScript: 'First TTS prompt' });
      await engine.play();
      expect(engine.getState().sourceType).toBe('tts');

      // Now load and play MP3
      engine.load({ audioMetadata: { url: '/audio/test.mp3' } });
      createdMockAudios[0].emit('canplay');
      await engine.play();

      expect(mockSpeechCancel).toHaveBeenCalled();
    });

    it('pauses any other running ToeicAudioEngine instance when a new engine plays (Global Mutex)', async () => {
      const engine1 = createEngine();
      const engine2 = createEngine();

      engine1.load({ audioMetadata: { url: '/audio/1.mp3' } });
      createdMockAudios[0].emit('canplay');
      await engine1.play();
      expect(engine1.getState().status).toBe('playing');

      // Engine 2 plays
      engine2.load({ audioMetadata: { url: '/audio/2.mp3' } });
      createdMockAudios[1].emit('canplay');
      await engine2.play();

      expect(engine2.getState().status).toBe('playing');
      expect(engine1.getState().status).toBe('paused');
    });

    it('source change stops old audio, removes listeners, and resets currentTime', () => {
      const engine = createEngine();
      engine.load({ audioMetadata: { url: '/audio/first.mp3' } });
      const firstAudio = createdMockAudios[0];
      firstAudio.emit('canplay');
      firstAudio.currentTime = 14;

      // Load new question
      engine.load({ audioMetadata: { url: '/audio/second.mp3' } });

      expect(firstAudio.pause).toHaveBeenCalled();
      expect(firstAudio.currentTime).toBe(0);
      expect(engine.getState().currentTimeMs).toBe(0);
      expect(createdMockAudios.length).toBe(2);
    });

    it('dispose() tears down all listeners, stops audio, and cancels TTS', () => {
      const engine = createEngine();
      engine.load({ audioMetadata: { url: '/audio/first.mp3' } });
      const audio = createdMockAudios[0];

      engine.dispose();

      expect(audio.pause).toHaveBeenCalled();
      expect(mockSpeechCancel).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. TRANSCRIPT SYNCHRONIZATION
  // =========================================================================
  describe('4. Transcript & Token Synchronization', () => {
    it('updates active segment and active token as time progresses', () => {
      const engine = createEngine();
      const question: Partial<ToeicQuestion> = {
        id: 'toeic_p3_sync',
        audioMetadata: {
          url: '/audio/p3.mp3',
          durationMs: 20000,
          segments: [
            {
              id: 'seg_1',
              speaker: 'Man',
              text: 'Could you review the quarterly budget report?',
              startMs: 0,
              endMs: 4000,
              tokens: [
                { text: 'Could', startMs: 0, endMs: 500 },
                { text: 'you', startMs: 501, endMs: 800 },
                { text: 'review', startMs: 801, endMs: 1500 },
              ],
            },
            {
              id: 'seg_2',
              speaker: 'Woman',
              text: 'Certainly, I will check it right away.',
              startMs: 5000,
              endMs: 9000,
            },
          ],
        },
      };

      engine.load(question as ToeicQuestion);
      const audio = createdMockAudios[0];
      audio.emit('canplay');

      // Advance time to 1000ms: should be in seg_1, token "review"
      audio.currentTime = 1.0;
      audio.emit('timeupdate');

      expect(engine.getState().activeSegmentIndex).toBe(0);
      expect(engine.getState().activeSegment?.id).toBe('seg_1');
      expect(engine.getState().activeToken?.text).toBe('review');

      // Advance time to 4500ms (gap between speakers): should have null active segment
      audio.currentTime = 4.5;
      audio.emit('timeupdate');

      expect(engine.getState().activeSegmentIndex).toBe(-1);
      expect(engine.getState().activeSegment).toBeNull();

      // Advance time to 6000ms: in seg_2
      audio.currentTime = 6.0;
      audio.emit('timeupdate');

      expect(engine.getState().activeSegmentIndex).toBe(1);
      expect(engine.getState().activeSegment?.id).toBe('seg_2');
    });

    it('seek updates currentTime and immediately synchronizes transcript', () => {
      const engine = createEngine();
      const question: Partial<ToeicQuestion> = {
        id: 'toeic_seek_test',
        audioMetadata: {
          url: '/audio/p3.mp3',
          durationMs: 10000,
          segments: [
            { id: 'seg_0', text: 'Intro', startMs: 0, endMs: 3000 },
            { id: 'seg_1', text: 'Outro', startMs: 4000, endMs: 8000 },
          ],
        },
      };

      engine.load(question as ToeicQuestion);
      createdMockAudios[0].emit('canplay');

      // Seek directly to 5000ms
      engine.seek(5000);

      expect(createdMockAudios[0].currentTime).toBe(5);
      expect(engine.getState().activeSegmentIndex).toBe(1);
      expect(engine.getState().activeSegment?.id).toBe('seg_1');
    });

    it('handles missing timing metadata cleanly without crashing and keeps audio playable', () => {
      const engine = createEngine();
      const question: Partial<ToeicQuestion> = {
        id: 'toeic_no_timing',
        audioMetadata: {
          url: '/audio/no_timing.mp3',
          // no segments provided
        },
      };

      engine.load(question as ToeicQuestion);
      const audio = createdMockAudios[0];
      audio.emit('canplay');

      audio.currentTime = 5.0;
      audio.emit('timeupdate');

      expect(engine.getState().hasValidTiming).toBe(false);
      expect(engine.getState().activeSegmentIndex).toBe(-1);
      expect(engine.getState().currentTimeMs).toBe(5000);
    });

    it('handles corrupted timing metadata without crashing (graceful degradation)', () => {
      const engine = createEngine();
      const question: Partial<ToeicQuestion> = {
        id: 'toeic_corrupt_timing',
        audioMetadata: {
          url: '/audio/corrupt.mp3',
          segments: [{ text: 'Corrupted', startMs: 10000, endMs: 2000 }], // reversed
        },
      };

      engine.load(question as ToeicQuestion);
      expect(engine.getState().sourceType).toBe('mp3');
      expect(engine.getState().hasValidTiming).toBe(false); // timing safely disabled!

      const audio = createdMockAudios[0];
      audio.emit('canplay');
      audio.currentTime = 3.0;
      audio.emit('timeupdate');

      expect(engine.getState().activeSegmentIndex).toBe(-1);
    });
  });

  // =========================================================================
  // 5. AMBIENT INFRASTRUCTURE & ISOLATION
  // =========================================================================
  describe('5. Ambient Track Infrastructure & Failure Isolation', () => {
    it('initializes ambient audio when configured with low volume and loop', async () => {
      const engine = createEngine();
      const question: Partial<ToeicQuestion> = {
        id: 'toeic_ambient_test',
        audioMetadata: {
          url: '/audio/main.mp3',
          ambient: {
            enabled: true,
            type: 'test_center',
            url: '/audio/ambient/ets_room.mp3',
            volume: 0.12,
          },
        },
      };

      engine.load(question as ToeicQuestion);

      expect(createdMockAudios.length).toBe(2); // main audio + ambient audio
      const ambientAudio = createdMockAudios[1];
      expect(ambientAudio.loop).toBe(true);
      expect(ambientAudio.volume).toBe(0.12);

      createdMockAudios[0].emit('canplay');
      await engine.play();

      expect(ambientAudio.play).toHaveBeenCalled();

      engine.pause();
      expect(ambientAudio.pause).toHaveBeenCalled();
    });

    it('ambient failure does not interrupt or fail main audio playback', async () => {
      const engine = createEngine();
      const question: Partial<ToeicQuestion> = {
        id: 'toeic_ambient_fail',
        audioMetadata: {
          url: '/audio/main.mp3',
          ambient: {
            enabled: true,
            url: '/audio/broken_ambient.mp3',
          },
        },
      };

      engine.load(question as ToeicQuestion);
      const ambientAudio = createdMockAudios[1];

      // Ambient errors out
      ambientAudio.emit('error', new Event('error'));

      // Main audio continues playing without issues!
      createdMockAudios[0].emit('canplay');
      await engine.play();

      expect(engine.getState().status).toBe('playing');
      expect(createdMockAudios[0].play).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 6. VOLUME & PLAYBACK RATE CONTROLS
  // =========================================================================
  describe('6. Volume, Mute & Playback Rate Controls', () => {
    it('sets volume safely clamped to [0.0, 1.0]', () => {
      const engine = createEngine();
      engine.load({ audioMetadata: { url: '/audio/test.mp3' } });
      const audio = createdMockAudios[0];

      engine.setVolume(0.7);
      expect(engine.getState().volume).toBe(0.7);
      expect(audio.volume).toBe(0.7);

      engine.setVolume(2.5); // over 1.0
      expect(engine.getState().volume).toBe(1.0);

      engine.setVolume(-0.5); // below 0.0
      expect(engine.getState().volume).toBe(0.0);
    });

    it('toggleMute mutes audio and restores previous volume upon unmute', () => {
      const engine = createEngine();
      engine.load({ audioMetadata: { url: '/audio/test.mp3' } });
      const audio = createdMockAudios[0];

      engine.setVolume(0.8);
      expect(audio.volume).toBe(0.8);

      engine.toggleMute();
      expect(engine.getState().isMuted).toBe(true);
      expect(audio.volume).toBe(0);

      engine.toggleMute();
      expect(engine.getState().isMuted).toBe(false);
      expect(audio.volume).toBe(0.8);
    });

    it('setPlaybackRate clamps between 0.5x and 2.0x', () => {
      const engine = createEngine();
      engine.load({ audioMetadata: { url: '/audio/test.mp3' } });
      const audio = createdMockAudios[0];

      engine.setPlaybackRate(1.25);
      expect(engine.getState().playbackRate).toBe(1.25);
      expect(audio.playbackRate).toBe(1.25);

      engine.setPlaybackRate(5.0);
      expect(engine.getState().playbackRate).toBe(2.0);

      engine.setPlaybackRate(0.1);
      expect(engine.getState().playbackRate).toBe(0.5);
    });
  });
});
