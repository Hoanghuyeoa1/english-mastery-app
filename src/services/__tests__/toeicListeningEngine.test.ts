// src/services/__tests__/toeicListeningEngine.test.ts
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  ToeicListeningEngine,
  buildPart2TtsSequence,
} from '../toeicListeningEngine';
import { useToeicListeningEngine } from '../../hooks/useToeicListeningEngine';
import {
  NormalizedToeicListeningGroup,
  ListeningPlaybackPolicy,
  DEFAULT_LISTENING_POLICIES,
} from '../../types/toeicListening';

/**
 * Mock HTMLAudioElement to test native audio lifecycle in happy-dom
 */
class MockAudioElement {
  src: string;
  preload = 'metadata';
  playbackRate = 1.0;
  volume = 1.0;
  currentTime = 0;
  duration = 20;
  paused = true;
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
 * Mock SpeechSynthesisUtterance
 */
class MockSpeechSynthesisUtterance {
  text: string;
  lang = 'en-US';
  rate = 1.0;
  pitch = 1.0;
  volume = 1.0;
  onstart: ((ev: any) => void) | null = null;
  onend: ((ev: any) => void) | null = null;
  onerror: ((ev: any) => void) | null = null;

  constructor(text = '') {
    this.text = text;
  }
}

/**
 * Mock SpeechSynthesis
 */
const mockSpeechSynthesis = {
  speaking: false,
  pending: false,
  paused: false,
  speak: vi.fn((utterance: any) => {
    mockSpeechSynthesis.speaking = true;
    if (utterance && utterance.onstart) {
      utterance.onstart(new Event('start'));
    }
  }),
  cancel: vi.fn(() => {
    mockSpeechSynthesis.speaking = false;
  }),
  getVoices: vi.fn().mockReturnValue([]),
};

const mockRecordedGroup: NormalizedToeicListeningGroup = {
  id: 'grp_p1_sample',
  audioGroupId: 'audio_p1_sample',
  part: 'part1_photos',
  imageUrl: 'https://images.example.com/p1.jpg',
  audioSource: {
    sourceType: 'recorded',
    audioUrl: 'https://cdn.example.com/audio/p1_01.mp3',
    accent: 'en-US',
    format: 'mp3',
    durationMs: 20000,
    isFallback: false,
  },
  transcript: {
    fullText: 'A man is typing on a laptop computer.',
    hasTiming: true,
    segments: [
      { id: 'seg_0', text: 'A man is typing on a laptop computer.', startMs: 0, endMs: 20000 },
    ],
  },
  questionIds: ['q_p1_1'],
};

const mockTtsGroup: NormalizedToeicListeningGroup = {
  id: 'grp_p3_conv_sample',
  audioGroupId: 'audio_p3_conv_sample',
  part: 'part3_conv',
  audioSource: {
    sourceType: 'tts',
    audioScript: 'Man: Hello Sarah. Woman: Hi Mark, the reports are ready.',
    accent: 'en-US',
    isFallback: true,
  },
  transcript: {
    fullText: 'Man: Hello Sarah. Woman: Hi Mark, the reports are ready.',
    hasTiming: false,
    segments: [
      { id: 'seg_0', speaker: 'Man', text: 'Hello Sarah.' },
      { id: 'seg_1', speaker: 'Woman', text: 'Hi Mark, the reports are ready.' },
    ],
  },
  questionIds: ['q_p3_1', 'q_p3_2', 'q_p3_3'],
};

const mockPart2Group: NormalizedToeicListeningGroup = {
  id: 'grp_p2_sample',
  audioGroupId: 'audio_p2_sample',
  part: 'part2_qna',
  audioSource: {
    sourceType: 'tts',
    audioScript: 'Where is the annual meeting? (A) In room B. (B) Yes it was. (C) At 10 AM.',
    accent: 'en-US',
    isFallback: true,
  },
  transcript: {
    fullText: 'Where is the annual meeting? (A) In room B. (B) Yes it was. (C) At 10 AM.',
    hasTiming: false,
    segments: [],
  },
  questionIds: ['q_p2_1'],
};

describe('PHASE 3: Shared TOEIC Listening Engine & Lifecycle Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).Audio = MockAudioElement as any;
    Object.defineProperty(window, 'speechSynthesis', {
      value: mockSpeechSynthesis,
      writable: true,
      configurable: true,
    });
    (window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // 1. LIFECYCLE & STATE MACHINE (LOAD -> READY -> PLAY -> PAUSE -> ENDED)
  // ===========================================================================
  describe('1. Lifecycle & Playback State Transitions', () => {
    it('Khởi tạo engine ở trạng thái idle', () => {
      const engine = new ToeicListeningEngine();
      expect(engine.getState().status).toBe('idle');
      expect(engine.getState().currentGroupId).toBeNull();
      expect(engine.getState().currentTimeMs).toBe(0);
    });

    it('Nạp recorded group thành công, chuyển loading -> ready', () => {
      let createdAudio: MockAudioElement | null = null;
      const audioFactory = (src?: string) => {
        createdAudio = new MockAudioElement(src);
        return createdAudio as any;
      };

      const engine = new ToeicListeningEngine({ audioFactory });
      engine.loadGroup(mockRecordedGroup);

      expect(engine.getState().status).toBe('loading');
      expect(engine.getState().sourceType).toBe('recorded');
      expect(engine.getState().currentGroupId).toBe('grp_p1_sample');

      // Giả lập native audio canplay
      createdAudio!.emit('canplay');
      expect(engine.getState().status).toBe('ready');
    });

    it('Nạp TTS group chuyển ngay sang trạng thái ready', () => {
      const engine = new ToeicListeningEngine();
      engine.loadGroup(mockTtsGroup);

      expect(engine.getState().status).toBe('ready');
      expect(engine.getState().sourceType).toBe('tts');
      expect(engine.getState().currentGroupId).toBe('grp_p3_conv_sample');
    });

    it('Phát và tạm dừng recorded audio thành công', async () => {
      let createdAudio: MockAudioElement | null = null;
      const engine = new ToeicListeningEngine({
        audioFactory: (src) => {
          createdAudio = new MockAudioElement(src);
          return createdAudio as any;
        },
      });

      engine.loadGroup(mockRecordedGroup);
      createdAudio!.emit('canplay');

      await engine.play();
      expect(createdAudio!.play).toHaveBeenCalled();
      expect(engine.getState().status).toBe('playing');
      expect(engine.getState().hasPlayed).toBe(true);
      expect(engine.getState().playCount).toBe(1);

      engine.pause();
      expect(createdAudio!.pause).toHaveBeenCalled();
      expect(engine.getState().status).toBe('paused');
    });

    it('Kết thúc bài nghe chuyển status sang ended', () => {
      let createdAudio: MockAudioElement | null = null;
      const engine = new ToeicListeningEngine({
        audioFactory: (src) => {
          createdAudio = new MockAudioElement(src);
          return createdAudio as any;
        },
      });

      engine.loadGroup(mockRecordedGroup);
      createdAudio!.emit('canplay');
      engine.play();

      createdAudio!.emit('ended');
      expect(engine.getState().status).toBe('ended');
      expect(engine.getState().activeSegmentIndex).toBe(-1);
    });
  });

  // ===========================================================================
  // 2. GROUP LIFECYCLE GUARD & MUTEX (ZERO OVERLAP)
  // ===========================================================================
  describe('2. Group Lifecycle Guard & Zero Overlap Mutex', () => {
    it('Group Lifecycle Guard: Không reload/reset engine khi nạp lại cùng một group ID', () => {
      const engine = new ToeicListeningEngine();
      engine.loadGroup(mockTtsGroup);
      expect(engine.getState().playCount).toBe(0);

      engine.play();
      expect(engine.getState().playCount).toBe(1);

      // Thí sinh chuyển từ câu con #1 sang câu con #2 của Part 3 (cùng group):
      engine.loadGroup(mockTtsGroup);
      // Play count và state được bảo toàn, không bị nạp lại từ đầu
      expect(engine.getState().currentGroupId).toBe('grp_p3_conv_sample');
      expect(engine.getState().playCount).toBe(1);
    });

    it('Nạp group mới lập tức dừng và dọn dẹp group cũ', () => {
      const engine = new ToeicListeningEngine();
      engine.loadGroup(mockTtsGroup);
      engine.play();
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();

      // Nạp group khác
      engine.loadGroup(mockPart2Group);
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
      expect(engine.getState().currentGroupId).toBe('grp_p2_sample');
      expect(engine.getState().status).toBe('ready');
    });

    it('Zero Overlap Mutex: Khởi chạy engine mới tự động dập tắt engine cũ', async () => {
      const engineA = new ToeicListeningEngine();
      const engineB = new ToeicListeningEngine();

      engineA.loadGroup(mockTtsGroup);
      await engineA.play();
      expect(engineA.getState().status).toBe('playing');

      // Engine B bắt đầu phát
      engineB.loadGroup(mockPart2Group);
      await engineB.play();

      // Engine A tự động bị pause / stop
      expect(engineA.getState().status).toBe('paused');
      expect(engineB.getState().status).toBe('playing');
    });
  });

  // ===========================================================================
  // 3. PART 2 DETERMINISTIC SEQUENCE ENGINE
  // ===========================================================================
  describe('3. Part 2 Deterministic Sequence Engine', () => {
    it('Tách chính xác 4 bước Prompt -> A -> B -> C từ kịch bản Part 2', () => {
      const steps = buildPart2TtsSequence(mockPart2Group);
      expect(steps.length).toBe(4);
      expect(steps[0].step).toBe('prompt');
      expect(steps[0].text).toContain('Where is the annual meeting?');
      expect(steps[1].step).toBe('option_a');
      expect(steps[1].text).toContain('(A) In room B.');
      expect(steps[2].step).toBe('option_b');
      expect(steps[2].text).toContain('(B) Yes it was.');
      expect(steps[3].step).toBe('option_c');
      expect(steps[3].text).toContain('(C) At 10 AM.');
    });

    it('Phát chuỗi Part 2 tuần tự, cập nhật part2SequenceStep', async () => {
      const engine = new ToeicListeningEngine();
      engine.loadGroup(mockPart2Group);

      await engine.play();
      expect(engine.getState().part2SequenceStep).toBe('prompt');
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 4. BEHAVIORAL POLICY ENFORCEMENT
  // ===========================================================================
  describe('4. Central Playback Policy Enforcement', () => {
    it('Từ chối seek() khi policy allowSeek === false (Mock Exam)', () => {
      let createdAudio: MockAudioElement | null = null;
      const engine = new ToeicListeningEngine({
        audioFactory: (src) => {
          createdAudio = new MockAudioElement(src);
          return createdAudio as any;
        },
      });

      // Mock policy: cấm tua
      engine.loadGroup(mockRecordedGroup, DEFAULT_LISTENING_POLICIES.mock);
      createdAudio!.emit('canplay');

      engine.seek(10000);
      // Thời gian không bị thay đổi vì policy chặn
      expect(createdAudio!.currentTime).toBe(0);
      expect(engine.getState().currentTimeMs).toBe(0);
    });

    it('Cho phép seek() khi policy allowSeek === true (Practice Mode)', () => {
      let createdAudio: MockAudioElement | null = null;
      const engine = new ToeicListeningEngine({
        audioFactory: (src) => {
          createdAudio = new MockAudioElement(src);
          return createdAudio as any;
        },
      });

      engine.loadGroup(mockRecordedGroup, DEFAULT_LISTENING_POLICIES.practice);
      createdAudio!.emit('canplay');

      engine.seek(8000);
      expect(createdAudio!.currentTime).toBe(8);
      expect(engine.getState().currentTimeMs).toBe(8000);
    });

    it('Khóa phát lại (allowReplay === false) sau khi đã nghe 1 lần trong Mock Exam', async () => {
      const engine = new ToeicListeningEngine();
      engine.loadGroup(mockTtsGroup, DEFAULT_LISTENING_POLICIES.mock, 0);

      // Lần 1: Được phát
      await engine.play();
      expect(engine.getState().playCount).toBe(1);
      expect(engine.getState().isEligibleToPlay).toBe(false);

      // Thử phát lại lần 2
      mockSpeechSynthesis.speak.mockClear();
      await engine.play();
      // Bị reject, không gọi speak()
      expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled();
    });

    it('Từ chối pause() khi policy allowPause === false trong Mock mode', async () => {
      let createdAudio: MockAudioElement | null = null;
      const engine = new ToeicListeningEngine({
        audioFactory: (src) => {
          createdAudio = new MockAudioElement(src);
          return createdAudio as any;
        },
      });

      engine.loadGroup(mockRecordedGroup, DEFAULT_LISTENING_POLICIES.mock);
      createdAudio!.emit('canplay');

      await engine.play();
      expect(engine.getState().status).toBe('playing');

      engine.pause();
      // Vẫn giữ nguyên status playing, không pause được
      expect(engine.getState().status).toBe('playing');
    });

    it('Từ chối đổi tốc độ phát khi allowSpeedControl === false trong Mock mode', () => {
      const engine = new ToeicListeningEngine();
      engine.loadGroup(mockTtsGroup, DEFAULT_LISTENING_POLICIES.mock);

      engine.setPlaybackRate(1.25);
      expect(engine.getState().playbackRate).toBe(1.0); // Giữ nguyên 1.0x
    });
  });

  // ===========================================================================
  // 5. TRANSCRIPT SYNCHRONIZATION & DOM LEAKAGE PREVENTION
  // ===========================================================================
  describe('5. Transcript Synchronization & Leakage Prevention', () => {
    it('Đồng bộ hóa transcript segment trong Practice mode khi có highlight', () => {
      let createdAudio: MockAudioElement | null = null;
      const engine = new ToeicListeningEngine({
        audioFactory: (src) => {
          createdAudio = new MockAudioElement(src);
          return createdAudio as any;
        },
      });

      engine.loadGroup(mockRecordedGroup, DEFAULT_LISTENING_POLICIES.practice);
      createdAudio!.emit('canplay');

      // Bắn timeupdate 5000ms
      createdAudio!.currentTime = 5.0;
      createdAudio!.emit('timeupdate');

      expect(engine.getState().currentTimeMs).toBe(5000);
      expect(engine.getState().activeSegmentIndex).toBe(0);
      expect(engine.getState().activeSegment?.text).toContain('A man is typing');
    });

    it('Mock Exam Policy cấm highlight: activeSegment luôn là null để tránh DOM leak', () => {
      let createdAudio: MockAudioElement | null = null;
      const engine = new ToeicListeningEngine({
        audioFactory: (src) => {
          createdAudio = new MockAudioElement(src);
          return createdAudio as any;
        },
      });

      // Mock policy: cấm transcript & highlight
      engine.loadGroup(mockRecordedGroup, DEFAULT_LISTENING_POLICIES.mock);
      createdAudio!.emit('canplay');

      createdAudio!.currentTime = 5.0;
      createdAudio!.emit('timeupdate');

      expect(engine.getState().currentTimeMs).toBe(5000);
      // Giữ sạch hoàn toàn activeSegment để bảo toàn tính toàn vẹn phòng thi
      expect(engine.getState().activeSegment).toBeNull();
      expect(engine.getState().activeSegmentIndex).toBe(-1);
    });
  });

  // ===========================================================================
  // 6. ERROR HANDLING & DISPOSAL
  // ===========================================================================
  describe('6. Error Handling & Disposal Safety', () => {
    it('Dọn dẹp engine sạch sẽ khi gọi dispose()', () => {
      const engine = new ToeicListeningEngine();
      engine.loadGroup(mockTtsGroup);
      engine.play();

      engine.dispose();
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });

    it('An toàn khi trình duyệt không hỗ trợ Web Speech API', async () => {
      // Xóa speechSynthesis
      (window as any).speechSynthesis = undefined;

      const engine = new ToeicListeningEngine();
      engine.loadGroup(mockTtsGroup);
      await engine.play();

      expect(engine.getState().status).toBe('error');
      expect(engine.getState().errorMessage).toContain('không hỗ trợ');
    });
  });

  // ===========================================================================
  // 7. REACT HOOK: useToeicListeningEngine
  // ===========================================================================
  describe('7. React Hook useToeicListeningEngine', () => {
    it('Khởi tạo hook với state mặc định và tự nạp group ban đầu', () => {
      const { result } = renderHook(() =>
        useToeicListeningEngine(mockTtsGroup, {
          policy: DEFAULT_LISTENING_POLICIES.practice,
        })
      );

      expect(result.current.state.currentGroupId).toBe('grp_p3_conv_sample');
      expect(result.current.state.status).toBe('ready');
      expect(result.current.state.sourceType).toBe('tts');
      expect(typeof result.current.play).toBe('function');
      expect(typeof result.current.pause).toBe('function');
    });

    it('Hook play/pause cập nhật state phản ứng (reactive)', async () => {
      const { result } = renderHook(() =>
        useToeicListeningEngine(mockTtsGroup)
      );

      await act(async () => {
        await result.current.play();
      });

      expect(result.current.state.status).toBe('playing');
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();

      act(() => {
        result.current.pause();
      });

      expect(result.current.state.status).toBe('paused');
    });

    it('Hook tự dọn dẹp khi component unmount', () => {
      const { unmount } = renderHook(() =>
        useToeicListeningEngine(mockTtsGroup)
      );

      unmount();
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });
  });
});
