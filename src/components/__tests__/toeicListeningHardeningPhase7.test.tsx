// src/components/__tests__/toeicListeningHardeningPhase7.test.tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ToeicListeningBar } from '../toeic/ToeicListeningBar';
import { ToeicPart1View } from '../toeic/ToeicPart1View';
import { ToeicPart2View } from '../toeic/ToeicPart2View';
import { ToeicListeningGroupView } from '../toeic/ToeicListeningGroupView';
import { ToeicListeningEngine } from '../../services/toeicListeningEngine';
import {
  DEFAULT_LISTENING_POLICIES,
  NormalizedToeicListeningGroup,
  ToeicListeningEngineState,
} from '../../types/toeicListening';
import { ToeicQuestion } from '../../types/toeic';

// Mock Web Speech API & HTMLAudioElement
class MockAudioElement {
  src = '';
  currentTime = 0;
  duration = 30;
  playbackRate = 1.0;
  volume = 1.0;
  paused = true;
  ended = false;
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
    this.listeners[event] = this.listeners[event].filter((cb) => cb !== fn);
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

class MockSpeechSynthesisUtterance {
  text: string;
  lang = 'en-US';
  rate = 1.0;
  pitch = 1.0;
  volume = 1.0;
  voice: any = null;
  onstart: ((ev: any) => void) | null = null;
  onend: ((ev: any) => void) | null = null;
  onerror: ((ev: any) => void) | null = null;

  constructor(text = '') {
    this.text = text;
  }
}

const mockSpeechSynthesis = {
  speaking: false,
  pending: false,
  paused: false,
  speak: vi.fn().mockImplementation((utterance: MockSpeechSynthesisUtterance) => {
    mockSpeechSynthesis.speaking = true;
    setTimeout(() => {
      if (utterance.onstart) utterance.onstart({} as any);
    }, 0);
  }),
  cancel: vi.fn().mockImplementation(() => {
    mockSpeechSynthesis.speaking = false;
  }),
  pause: vi.fn(),
  resume: vi.fn(),
  getVoices: vi.fn().mockReturnValue([
    { name: 'Google US English', lang: 'en-US', default: true },
  ]),
};

const mockSampleGroup: NormalizedToeicListeningGroup = {
  id: 'grp_phase7_p3',
  audioGroupId: 'audio_p3_harden',
  part: 'part3_conv',
  audioSource: {
    sourceType: 'recorded',
    audioUrl: 'https://cdn.example.com/audio_p3.mp3',
    accent: 'en-US',
    durationMs: 24000,
    isFallback: false,
  },
  transcript: {
    fullText: 'Man: Did you finish the quarterly report? Woman: Yes, I sent it this morning.',
    hasTiming: true,
    segments: [
      { id: 's1', speaker: 'Man', text: 'Did you finish the quarterly report?', startMs: 0, endMs: 4000 },
      { id: 's2', speaker: 'Woman', text: 'Yes, I sent it this morning.', startMs: 4200, endMs: 9000 },
    ],
  },
  questionIds: ['q_p3_1', 'q_p3_2'],
};

const mockQuestionP1: ToeicQuestion = {
  id: 'q_p1_test',
  part: 'part1_photos',
  skill: 'listening',
  questionText: 'Look at the picture and listen to the four statements.',
  options: [
    'A. The woman is typing on a laptop.',
    'B. The woman is writing on a whiteboard.',
    'C. The woman is drinking water.',
    'D. The woman is opening a door.',
  ],
  correctAnswer: 'A',
  explanation: 'Người phụ nữ đang gõ máy tính.',
  vietnameseTranslation: 'Người phụ nữ đang gõ máy tính.',
  imageUrl: 'https://cdn.example.com/photo.jpg',
  audioScript: '(A) The woman is typing on a laptop. (B) The woman is writing on a whiteboard.',
  difficulty: 'easy',
};

const mockQuestionP2: ToeicQuestion = {
  id: 'q_p2_test',
  part: 'part2_qna',
  skill: 'listening',
  questionText: 'When is the project deadline?',
  options: ['A. Next Friday.', 'B. In the conference room.', 'C. Yes, I do.'],
  correctAnswer: 'A',
  explanation: 'Hỏi when nên trả lời mốc thời gian.',
  vietnameseTranslation: 'Hạn chót dự án là khi nào?',
  audioScript: 'When is the project deadline? (A) Next Friday. (B) In the conference room. (C) Yes, I do.',
  difficulty: 'medium',
};

describe('PHASE 7: TOEIC Listening Engine Hardening Suite', () => {
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
    cleanup();
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // 1. ACCESSIBILITY & SCREEN READERS
  // ===========================================================================
  describe('1. Accessibility & Screen Reader Protection', () => {
    it('ToeicListeningBar có live region với role="status" và aria-live="polite"', () => {
      const state: ToeicListeningEngineState = {
        status: 'ready',
        currentGroupId: 'grp1',
        currentAudioGroupId: 'aud1',
        sourceType: 'recorded',
        audioUrl: 'https://cdn.example.com/test.mp3',
        currentTimeMs: 0,
        durationMs: 30000,
        playbackRate: 1.0,
        volume: 1.0,
        isMuted: false,
        hasPlayed: false,
        playCount: 0,
        activeSegmentIndex: -1,
        activeSegment: null,
        isEligibleToPlay: true,
      };

      render(
        <ToeicListeningBar
          engineState={state}
          policy={DEFAULT_LISTENING_POLICIES.practice}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          partLabel="Part 3: Conversations"
        />
      );

      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeTruthy();
      expect(liveRegion.getAttribute('aria-live')).toBe('polite');
      expect(liveRegion.textContent).toContain('Sẵn sàng phát âm thanh');
    });

    it('Nút Play có nhãn aria-label rõ ràng phản ánh đúng trạng thái', () => {
      const idleState: ToeicListeningEngineState = {
        status: 'ready',
        currentGroupId: 'grp1',
        currentAudioGroupId: 'aud1',
        sourceType: 'recorded',
        audioUrl: 'https://cdn.example.com/test.mp3',
        currentTimeMs: 0,
        durationMs: 30000,
        playbackRate: 1.0,
        volume: 1.0,
        isMuted: false,
        hasPlayed: false,
        playCount: 0,
        activeSegmentIndex: -1,
        activeSegment: null,
        isEligibleToPlay: true,
      };

      const { rerender } = render(
        <ToeicListeningBar
          engineState={idleState}
          policy={DEFAULT_LISTENING_POLICIES.practice}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          partLabel="Part 1: Photographs"
        />
      );

      const playBtn = screen.getByRole('button', { name: /Phát Audio/i });
      expect(playBtn).toBeTruthy();

      // Khi đang phát
      const playingState = { ...idleState, status: 'playing' as const };
      rerender(
        <ToeicListeningBar
          engineState={playingState}
          policy={DEFAULT_LISTENING_POLICIES.practice}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          partLabel="Part 1: Photographs"
        />
      );
      expect(screen.getByRole('button', { name: /Tạm dừng/i })).toBeTruthy();
    });

    it('Part 1 image alt text KHÔNG làm lộ kịch bản hay đáp án đúng cho Screen Reader', () => {
      const idleState: ToeicListeningEngineState = {
        status: 'ready',
        currentGroupId: 'grp1',
        currentAudioGroupId: 'aud1',
        sourceType: 'recorded',
        audioUrl: 'https://cdn.example.com/test.mp3',
        currentTimeMs: 0,
        durationMs: 30000,
        playbackRate: 1.0,
        volume: 1.0,
        isMuted: false,
        hasPlayed: false,
        playCount: 0,
        activeSegmentIndex: -1,
        activeSegment: null,
        isEligibleToPlay: true,
      };

      render(
        <ToeicPart1View
          question={mockQuestionP1}
          questionNumber={1}
          onSelectAnswer={vi.fn()}
          policy={DEFAULT_LISTENING_POLICIES.mock}
          engineState={idleState}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          onRestart={vi.fn()}
          onSeek={vi.fn()}
          onSetSpeed={vi.fn()}
          hasAnswered={false}
          revealedTranscript={false}
          onToggleTranscript={vi.fn()}
        />
      );

      const img = screen.getByRole('img');
      expect(img).toBeTruthy();
      expect(img.getAttribute('alt')).toBe('Hình ảnh câu hỏi số 1 phần thi TOEIC Part 1 Photographs');
      // Tuyệt đối không chứa text của đáp án A (typing on a laptop)
      expect(img.getAttribute('alt')).not.toContain('typing');
      expect(img.getAttribute('alt')).not.toContain('laptop');
    });
  });

  // ===========================================================================
  // 2. KEYBOARD CONTROLS & SECURITY
  // ===========================================================================
  describe('2. Keyboard Navigation & Exam Policy Compliance', () => {
    it('Phím Space trên ToeicListeningBar kích hoạt onPlay khi không bị khóa', () => {
      const onPlayMock = vi.fn();
      const state: ToeicListeningEngineState = {
        status: 'ready',
        currentGroupId: 'grp1',
        currentAudioGroupId: 'aud1',
        sourceType: 'recorded',
        audioUrl: 'https://cdn.example.com/test.mp3',
        currentTimeMs: 0,
        durationMs: 30000,
        playbackRate: 1.0,
        volume: 1.0,
        isMuted: false,
        hasPlayed: false,
        playCount: 0,
        activeSegmentIndex: -1,
        activeSegment: null,
        isEligibleToPlay: true,
      };

      render(
        <ToeicListeningBar
          engineState={state}
          policy={DEFAULT_LISTENING_POLICIES.practice}
          onPlay={onPlayMock}
          onPause={vi.fn()}
          partLabel="Part 1"
        />
      );

      const container = screen.getByRole('region', { name: /Khu vực điều khiển âm thanh bài nghe/i });
      fireEvent.keyDown(container, { key: ' ', code: 'Space' });

      expect(onPlayMock).toHaveBeenCalledTimes(1);
    });

    it('Phím Space TUYỆT ĐỐI KHÔNG kích hoạt phát lại khi Mock Exam đã nghe 1 lần (No Hidden Bypass)', () => {
      const onPlayMock = vi.fn();
      const lockedState: ToeicListeningEngineState = {
        status: 'ended',
        currentGroupId: 'grp1',
        currentAudioGroupId: 'aud1',
        sourceType: 'recorded',
        audioUrl: 'https://cdn.example.com/test.mp3',
        currentTimeMs: 30000,
        durationMs: 30000,
        playbackRate: 1.0,
        volume: 1.0,
        isMuted: false,
        hasPlayed: true,
        playCount: 1, // Đã nghe 1 lần
        activeSegmentIndex: -1,
        activeSegment: null,
        isEligibleToPlay: false,
      };

      render(
        <ToeicListeningBar
          engineState={lockedState}
          policy={DEFAULT_LISTENING_POLICIES.mock} // Cấm replay
          onPlay={onPlayMock}
          onPause={vi.fn()}
          partLabel="Part 1"
        />
      );

      const container = screen.getByRole('region', { name: /Khu vực điều khiển âm thanh bài nghe/i });
      fireEvent.keyDown(container, { key: ' ', code: 'Space' });

      // Không cho phép phát lại qua phím tắt
      expect(onPlayMock).not.toHaveBeenCalled();
    });

    it('Transcript segments hỗ trợ bàn phím: gõ Enter trên segment kích hoạt seek', () => {
      const onSeekMock = vi.fn();
      const state: ToeicListeningEngineState = {
        status: 'playing',
        currentGroupId: mockSampleGroup.id,
        currentAudioGroupId: mockSampleGroup.audioGroupId,
        sourceType: 'recorded',
        audioUrl: 'https://cdn.example.com/test.mp3',
        currentTimeMs: 1000,
        durationMs: 24000,
        playbackRate: 1.0,
        volume: 1.0,
        isMuted: false,
        hasPlayed: true,
        playCount: 1,
        activeSegmentIndex: 0,
        activeSegment: mockSampleGroup.transcript.segments![0],
        isEligibleToPlay: true,
      };

      render(
        <ToeicListeningGroupView
          group={mockSampleGroup}
          currentQuestion={{
            id: 'q_p3_1',
            part: 'part3_conv',
            skill: 'listening',
            questionText: 'What is the man asking about?',
            options: ['A. A report', 'B. A flight', 'C. A meeting', 'D. An invoice'],
            correctAnswer: 'A',
            explanation: 'Người đàn ông hỏi về báo cáo.',
            vietnameseTranslation: 'Người đàn ông đang hỏi về cái gì?',
          }}
          childQuestions={[]}
          questionIndexWithinGroup={0}
          globalQuestionNumber={31}
          totalExamQuestions={100}
          userAnswers={{}}
          onSelectAnswer={vi.fn()}
          onNavigateToChildQuestion={vi.fn()}
          policy={DEFAULT_LISTENING_POLICIES.practice} // Cho phép seek
          engineState={state}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          onSeek={onSeekMock}
          revealedTranscript={true}
          onToggleTranscript={vi.fn()}
        />
      );

      // Tìm các segments có title
      const segments = screen.getAllByTitle(/Nhấp hoặc nhấn Enter để nghe lại từ đoạn này/i);
      expect(segments.length).toBe(2);

      fireEvent.keyDown(segments[0], { key: 'Enter' });
      expect(onSeekMock).toHaveBeenCalledWith(0);
    });
  });

  // ===========================================================================
  // 3. MOBILE & RESPONSIVE TOUCH TARGETS
  // ===========================================================================
  describe('3. Mobile Touch Targets & Responsive Layout', () => {
    it('Part 1 ảnh minh họa sử dụng object-contain tránh bị cắt xén trên màn hình điện thoại', () => {
      const state: ToeicListeningEngineState = {
        status: 'ready',
        currentGroupId: 'grp1',
        currentAudioGroupId: 'aud1',
        sourceType: 'recorded',
        audioUrl: 'https://cdn.example.com/test.mp3',
        currentTimeMs: 0,
        durationMs: 30000,
        playbackRate: 1.0,
        volume: 1.0,
        isMuted: false,
        hasPlayed: false,
        playCount: 0,
        activeSegmentIndex: -1,
        activeSegment: null,
        isEligibleToPlay: true,
      };

      render(
        <ToeicPart1View
          question={mockQuestionP1}
          questionNumber={1}
          onSelectAnswer={vi.fn()}
          policy={DEFAULT_LISTENING_POLICIES.practice}
          engineState={state}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          onRestart={vi.fn()}
          onSeek={vi.fn()}
          onSetSpeed={vi.fn()}
          hasAnswered={false}
          revealedTranscript={false}
          onToggleTranscript={vi.fn()}
        />
      );

      const img = screen.getByRole('img');
      expect(img.className).toContain('object-contain');
    });

    it('Nút phát chính đạt chuẩn kích thước chạm tối thiểu min-h-[44px]', () => {
      const state: ToeicListeningEngineState = {
        status: 'ready',
        currentGroupId: 'grp1',
        currentAudioGroupId: 'aud1',
        sourceType: 'recorded',
        audioUrl: 'https://cdn.example.com/test.mp3',
        currentTimeMs: 0,
        durationMs: 30000,
        playbackRate: 1.0,
        volume: 1.0,
        isMuted: false,
        hasPlayed: false,
        playCount: 0,
        activeSegmentIndex: -1,
        activeSegment: null,
        isEligibleToPlay: true,
      };

      render(
        <ToeicListeningBar
          engineState={state}
          policy={DEFAULT_LISTENING_POLICIES.practice}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          partLabel="Part 2"
        />
      );

      const playBtn = screen.getByRole('button', { name: /Phát Audio/i });
      expect(playBtn.className).toContain('min-h-[44px]');
    });
  });

  // ===========================================================================
  // 4. PERFORMANCE & RENDER OPTIMIZATION
  // ===========================================================================
  describe('4. Performance & Throttling Optimization', () => {
    it('Mock Exam Mode: timeupdate KHÔNG spam thông báo subscribers mỗi 200ms để tiết kiệm CPU', () => {
      let createdAudio: MockAudioElement | null = null;
      const engine = new ToeicListeningEngine({
        audioFactory: (src) => {
          createdAudio = new MockAudioElement(src);
          return createdAudio as any;
        },
      });

      const subscriberSpy = vi.fn();
      engine.subscribe(subscriberSpy);
      subscriberSpy.mockClear(); // Xóa lần gọi ban đầu

      engine.loadGroup(mockSampleGroup, DEFAULT_LISTENING_POLICIES.mock);
      createdAudio!.emit('canplay');
      subscriberSpy.mockClear();

      // Giả lập phát liên tục nhiều frame timeupdate trong Mock mode
      createdAudio!.currentTime = 1.0;
      createdAudio!.emit('timeupdate');
      createdAudio!.currentTime = 1.5;
      createdAudio!.emit('timeupdate');
      createdAudio!.currentTime = 2.0;
      createdAudio!.emit('timeupdate');

      // Trong Mock mode (seek/transcript/highlight đều bị tắt),
      // KHÔNG CÓ subscriber update nào bị kích hoạt từ timeupdate!
      expect(subscriberSpy).not.toHaveBeenCalled();

      // Nhưng giá trị nội bộ vẫn được theo dõi chính xác
      expect(engine.getState().currentTimeMs).toBe(2000);

      engine.dispose();
    });

    it('Practice Mode: timeupdate throttle tối đa 200ms giữa các lần bắn cập nhật UI', () => {
      let createdAudio: MockAudioElement | null = null;
      const engine = new ToeicListeningEngine({
        audioFactory: (src) => {
          createdAudio = new MockAudioElement(src);
          return createdAudio as any;
        },
      });

      const subscriberSpy = vi.fn();
      engine.subscribe(subscriberSpy);
      subscriberSpy.mockClear();

      engine.loadGroup(mockSampleGroup, DEFAULT_LISTENING_POLICIES.practice);
      createdAudio!.emit('canplay');
      subscriberSpy.mockClear();

      // timeupdate lần 1: 500ms
      createdAudio!.currentTime = 0.5;
      createdAudio!.emit('timeupdate');
      expect(subscriberSpy).toHaveBeenCalledTimes(1);

      // timeupdate lần 2 chỉ sau 50ms (< 200ms throttle): BỊ BỎ QUA
      createdAudio!.currentTime = 0.55;
      createdAudio!.emit('timeupdate');
      expect(subscriberSpy).toHaveBeenCalledTimes(1);

      // timeupdate lần 3 sau 300ms (> 200ms throttle): ĐƯỢC CHẤP NHẬN
      createdAudio!.currentTime = 0.85;
      createdAudio!.emit('timeupdate');
      expect(subscriberSpy).toHaveBeenCalledTimes(2);

      engine.dispose();
    });
  });

  // ===========================================================================
  // 5. AUDIO LIFECYCLE, CONCURRENCY & RACE CONDITIONS
  // ===========================================================================
  describe('5. Audio Lifecycle & Concurrency Resilience', () => {
    it('Rapid Play: Gọi play() liên tiếp được bảo vệ an toàn bằng lock, không gọi duplicate play()', async () => {
      let createdAudio: MockAudioElement | null = null;
      const engine = new ToeicListeningEngine({
        audioFactory: (src) => {
          createdAudio = new MockAudioElement(src);
          return createdAudio as any;
        },
      });

      engine.loadGroup(mockSampleGroup, DEFAULT_LISTENING_POLICIES.practice);
      createdAudio!.emit('canplay');

      // Bấm play 3 lần liên tiếp rất nhanh
      const p1 = engine.play();
      const p2 = engine.play();
      const p3 = engine.play();

      await Promise.all([p1, p2, p3]);

      // Chỉ có 1 lệnh play được gọi trên audio element
      expect(createdAudio!.play).toHaveBeenCalledTimes(1);

      engine.dispose();
    });

    it('Pause sớm ngay sau Play (DOMException AbortError) được xử lý an toàn không crash', async () => {
      let createdAudio: MockAudioElement | null = null;
      const engine = new ToeicListeningEngine({
        audioFactory: (src) => {
          createdAudio = new MockAudioElement(src);
          createdAudio.play = vi.fn().mockImplementation(() => {
            const err: any = new Error('The play() request was interrupted by a call to pause()');
            err.name = 'AbortError';
            return Promise.reject(err);
          });
          return createdAudio as any;
        },
      });

      engine.loadGroup(mockSampleGroup, DEFAULT_LISTENING_POLICIES.practice);
      createdAudio!.emit('canplay');

      // Gọi play và không gây crash hay uncaught rejection
      await expect(engine.play()).resolves.toBeUndefined();

      // State không bị đưa về error vì AbortError là hành vi hủy hợp lệ
      expect(engine.getState().status).not.toBe('error');

      engine.dispose();
    });

    it('Chuyển đổi nhóm trong khi đang phát lập tức dừng toàn bộ audio và TTS cũ', async () => {
      const createdAudios: MockAudioElement[] = [];
      const engine = new ToeicListeningEngine({
        audioFactory: (src) => {
          const el = new MockAudioElement(src);
          createdAudios.push(el);
          return el as any;
        },
      });

      engine.loadGroup(mockSampleGroup, DEFAULT_LISTENING_POLICIES.practice);
      createdAudios[0].emit('canplay');
      await engine.play();

      expect(createdAudios[0].pause).not.toHaveBeenCalled();

      // Nạp một nhóm mới khác
      const nextGroup: NormalizedToeicListeningGroup = {
        ...mockSampleGroup,
        id: 'grp_phase7_next',
        audioGroupId: 'audio_next',
      };

      engine.loadGroup(nextGroup, DEFAULT_LISTENING_POLICIES.practice);

      // Audio cũ lập tức bị pause và dọn dẹp
      expect(createdAudios[0].pause).toHaveBeenCalled();
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();

      engine.dispose();
    });
  });

  // ===========================================================================
  // 6. BROWSER COMPATIBILITY & SPEECH SYNTHESIS RESILIENCE
  // ===========================================================================
  describe('6. Browser Compatibility & Fallback Resilience', () => {
    it('Khi window.speechSynthesis không tồn tại: nạp TTS không làm sập ứng dụng và báo lỗi rõ ràng', async () => {
      // Giả lập môi trường không có SpeechSynthesis
      Object.defineProperty(window, 'speechSynthesis', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const engine = new ToeicListeningEngine();
      const ttsGroup: NormalizedToeicListeningGroup = {
        id: 'grp_tts_only',
        audioGroupId: 'aud_tts',
        part: 'part2_qna',
        audioSource: {
          sourceType: 'tts',
          audioScript: 'Where is the meeting room?',
          accent: 'en-US',
          isFallback: true,
        },
        transcript: {
          fullText: 'Where is the meeting room?',
          segments: [],
          hasTiming: false,
        },
        questionIds: ['q1'],
      };

      engine.loadGroup(ttsGroup, DEFAULT_LISTENING_POLICIES.practice);
      await engine.play();

      expect(engine.getState().status).toBe('error');
      expect(engine.getState().errorMessage).toContain('không hỗ trợ Web Speech API');

      engine.dispose();
    });

    it('Khi speechSynthesis.speak ném Exception: chuyển trạng thái error an toàn', async () => {
      mockSpeechSynthesis.speak.mockImplementationOnce(() => {
        throw new Error('NotAllowedError: Speech synthesis blocked by browser policy');
      });

      const engine = new ToeicListeningEngine();
      const ttsGroup: NormalizedToeicListeningGroup = {
        id: 'grp_tts_error',
        audioGroupId: 'aud_tts_err',
        part: 'part2_qna',
        audioSource: {
          sourceType: 'tts',
          audioScript: 'Where is the meeting room?',
          accent: 'en-US',
          isFallback: true,
        },
        transcript: {
          fullText: 'Where is the meeting room?',
          segments: [],
          hasTiming: false,
        },
        questionIds: ['q1'],
      };

      engine.loadGroup(ttsGroup, DEFAULT_LISTENING_POLICIES.practice);
      await engine.play();

      expect(engine.getState().status).toBe('error');
      expect(engine.getState().errorMessage).toContain('NotAllowedError');

      engine.dispose();
    });
  });

  // ===========================================================================
  // 7. AUDIO ASSET FAILURE
  // ===========================================================================
  describe('7. Audio Asset Failure & Exam Policy Guard', () => {
    it('Practice Mode: Lỗi tải file recorded tự động chuyển fallback sang TTS nếu có script', () => {
      let createdAudio: MockAudioElement | null = null;
      const engine = new ToeicListeningEngine({
        audioFactory: (src) => {
          createdAudio = new MockAudioElement(src);
          return createdAudio as any;
        },
      });

      engine.loadGroup(mockSampleGroup, DEFAULT_LISTENING_POLICIES.practice);

      // Bắn sự kiện lỗi tải file audio
      createdAudio!.emit('error', new Event('error'));

      // Tự động fallback sang TTS để học viên tiếp tục luyện tập
      expect(engine.getState().sourceType).toBe('tts');
      expect(engine.getState().status).toBe('ready');

      engine.dispose();
    });

    it('Mock Mode: Lỗi tải audio báo lỗi rõ ràng và TUYỆT ĐỐI KHÔNG leak transcript vào DOM', () => {
      let createdAudio: MockAudioElement | null = null;
      const engine = new ToeicListeningEngine({
        audioFactory: (src) => {
          createdAudio = new MockAudioElement(src);
          return createdAudio as any;
        },
      });

      engine.loadGroup(mockSampleGroup, DEFAULT_LISTENING_POLICIES.mock);

      // Bắn sự kiện lỗi audio trong Mock Exam
      createdAudio!.emit('error', new Event('error'));

      // Chuyển sang status error với thông báo rõ ràng
      expect(engine.getState().status).toBe('error');
      expect(engine.getState().errorMessage).toContain('Không thể tải file âm thanh');

      // Transcript vẫn được giữ bí mật, không chuyển thành TTS
      expect(engine.getState().sourceType).toBe('recorded');

      engine.dispose();
    });
  });

  // ===========================================================================
  // 8. EDGE CASES: TIMING & MALFORMED DATA
  // ===========================================================================
  describe('8. Edge Cases: Malformed Data & Unknown Duration', () => {
    it('handleTimeUpdate bỏ qua các giá trị NaN, âm hoặc không hữu hạn mà không gây crash', () => {
      let createdAudio: MockAudioElement | null = null;
      const engine = new ToeicListeningEngine({
        audioFactory: (src) => {
          createdAudio = new MockAudioElement(src);
          return createdAudio as any;
        },
      });

      engine.loadGroup(mockSampleGroup, DEFAULT_LISTENING_POLICIES.practice);
      createdAudio!.emit('canplay');

      // Bắn currentTime là NaN
      createdAudio!.currentTime = NaN;
      createdAudio!.emit('timeupdate');
      expect(engine.getState().currentTimeMs).toBe(0);

      // Bắn currentTime âm
      createdAudio!.currentTime = -5;
      createdAudio!.emit('timeupdate');
      expect(engine.getState().currentTimeMs).toBe(0);

      engine.dispose();
    });

    it('File audio có durationMs = 0 hoặc unknown được hiển thị an toàn 00:00', () => {
      const state: ToeicListeningEngineState = {
        status: 'ready',
        currentGroupId: 'grp1',
        currentAudioGroupId: 'aud1',
        sourceType: 'recorded',
        audioUrl: 'https://cdn.example.com/test.mp3',
        currentTimeMs: 0,
        durationMs: 0, // duration chưa có
        playbackRate: 1.0,
        volume: 1.0,
        isMuted: false,
        hasPlayed: false,
        playCount: 0,
        activeSegmentIndex: -1,
        activeSegment: null,
        isEligibleToPlay: true,
      };

      render(
        <ToeicListeningBar
          engineState={state}
          policy={DEFAULT_LISTENING_POLICIES.practice}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          partLabel="Part 3"
        />
      );

      // Render không bị crash hay hiển thị NaN:NaN
      expect(screen.queryByText(/NaN/)).toBeNull();
    });
  });
});
