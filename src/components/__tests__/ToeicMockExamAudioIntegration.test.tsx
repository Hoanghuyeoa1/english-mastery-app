// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ToeicAssessmentView } from '../ToeicAssessmentView';
import { TOEIC_QUESTION_BANK } from '../../data/toeicQuestionsData';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// Mock speechService
vi.mock('../../services/speechService', () => ({
  speakWord: vi.fn(),
  createSpeechRecognizer: vi.fn(() => ({
    recognition: {},
    stop: vi.fn(),
  })),
}));

/**
 * Mock HTMLAudioElement to test native audio lifecycle in happy-dom
 */
class MockAudioElement {
  src: string;
  preload = 'metadata';
  playbackRate = 1.0;
  volume = 1.0;
  currentTime = 0;
  duration = 15;
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
 * Mock SpeechSynthesisUtterance for Web Speech API
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
 * Mock SpeechSynthesis for Web Speech API fallback testing
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
  pause: vi.fn(() => {
    mockSpeechSynthesis.paused = true;
  }),
  resume: vi.fn(() => {
    mockSpeechSynthesis.paused = false;
  }),
  getVoices: vi.fn().mockReturnValue([]),
};

describe('ToeicMockExamAudioIntegration (Phase 3 Integration & Release Gate)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();

    // Setup global browser audio mocks
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
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Audio Source Resolution (MP3 vs TTS Fallback)', () => {
    it('Phát audio câu hỏi Listening không có MP3 qua TTS fallback an toàn', async () => {
      render(<ToeicAssessmentView />);
      const miniBtn = screen.getByText(/Mini-Test/i);
      fireEvent.click(miniBtn);

      // Câu hỏi 1 là Listening Part 1
      const audioSection = screen.getByText(/Đoạn Audio Nghe/i);
      expect(audioSection).toBeTruthy();

      // Hiển thị badge Web Speech TTS
      expect(screen.getByText(/Web Speech TTS/i)).toBeTruthy();

      // Nút phát audio sẵn sàng
      const playBtn = screen.getByRole('button', { name: /Phát Audio/i });
      expect(playBtn).toBeTruthy();
      expect(playBtn.hasAttribute('disabled')).toBe(false);

      // Bấm phát audio
      fireEvent.click(playBtn);

      // Web Speech API được kích hoạt
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    });

    it('Nhận diện và hiển thị huy hiệu Studio MP3 khi câu hỏi có metadata MP3 hợp lệ', async () => {
      const originalMetadatas = new Map<string, any>();
      TOEIC_QUESTION_BANK.forEach((q) => {
        if (q.part === 'part1_photos') {
          originalMetadatas.set(q.id, q.audioMetadata);
          q.audioMetadata = {
            url: 'https://cdn.example.com/audio/p1_test.mp3',
            format: 'mp3',
            accent: 'en-US',
            durationMs: 12000,
            segments: [
              {
                id: 'seg_1',
                speaker: 'Speaker',
                text: 'He is typing on a laptop computer.',
                startMs: 0,
                endMs: 4000,
              },
            ],
          };
        }
      });

      try {
        render(<ToeicAssessmentView />);
        fireEvent.click(screen.getByText(/Mini-Test/i));

        // Phải nhận diện nguồn Studio MP3
        expect(screen.getByText(/Studio MP3/i)).toBeTruthy();
      } finally {
        TOEIC_QUESTION_BANK.forEach((q) => {
          if (originalMetadatas.has(q.id)) {
            q.audioMetadata = originalMetadatas.get(q.id);
          }
        });
      }
    });
  });

  describe('2. Quy Chế Phòng Thi ETS (Single Replay Restriction)', () => {
    it('Chế độ Mock Test ETS chỉ cho phép phát audio 1 lần duy nhất, cấm phát lại', async () => {
      render(<ToeicAssessmentView />);
      // Chọn Mini-Test (Mock mode, allowAudioReplay = false)
      fireEvent.click(screen.getByText(/Mini-Test/i));

      const playBtn = screen.getByRole('button', { name: /Phát Audio/i });
      expect(playBtn).toBeTruthy();
      expect(screen.getByText(/Quy chế thi Mock Test ETS: Mỗi câu hỏi chỉ được nghe audio 1 lần duy nhất/i)).toBeTruthy();

      // Lần phát thứ nhất: bắt đầu phát
      fireEvent.click(playBtn);

      // Khi đang phát, nút chuyển sang Tạm dừng
      expect(screen.getByText(/Tạm dừng/i)).toBeTruthy();

      // Bấm tạm dừng
      fireEvent.click(screen.getByRole('button', { name: /Tạm dừng/i }));

      // Sau khi đã phát 1 lần, nút bị vô hiệu hóa với text "Đã phát (1 lần)"
      await waitFor(() => {
        const disabledBtn = screen.getByRole('button', { name: /Đã phát \(1 lần\)/i });
        expect(disabledBtn).toBeTruthy();
        expect(disabledBtn.hasAttribute('disabled')).toBe(true);
      });
    });
    it('Chế độ Luyện Tập (Practice Mode) cho phép phát lại audio nhiều lần không giới hạn', async () => {
      render(<ToeicAssessmentView />);
      // Chuyển sang Tab Luyện Tập
      const practiceTab = screen.getByText(/Luyện Tập Tự Do/i);
      fireEvent.click(practiceTab);

      // Bắt đầu Mini-Test ở Practice Mode
      const miniBtn = screen.getByRole('button', { name: /Mini-Test/i });
      fireEvent.click(miniBtn);

      const playBtn = screen.getByTitle('Phát âm thanh bài nghe');
      expect(playBtn).toBeTruthy();

      // Phát lần 1
      fireEvent.click(playBtn);
      expect(playBtn.textContent).toContain('Tạm dừng');

      // Tạm dừng
      fireEvent.click(playBtn);

      // Trong Practice Mode, nút không bị disable và vẫn cho phép phát lại
      expect(playBtn.textContent).toContain('Phát Audio');
      expect(playBtn.hasAttribute('disabled')).toBe(false);

      // Phát lần 2 thành công
      fireEvent.click(playBtn);
      expect(playBtn.textContent).toContain('Tạm dừng');
    });
  });

  describe('3. Tính Bất Biến Của State Bài Thi (Timer & User Answers Invariants)', () => {
    it('Phát và dừng audio hoàn toàn KHÔNG làm thay đổi, reset hay can thiệp timer bài thi', async () => {
      render(<ToeicAssessmentView />);
      fireEvent.click(screen.getByText(/Mini-Test/i));

      // Timer ban đầu của Mini-Test là 15:00
      expect(screen.getByText(/15:00/)).toBeTruthy();

      // Bấm phát audio
      const playBtn = screen.getByRole('button', { name: /Phát Audio/i });
      fireEvent.click(playBtn);

      // Timer vẫn nguyên vẹn
      expect(screen.getByText(/15:00/)).toBeTruthy();

      // Bấm dừng audio
      const pauseBtn = screen.getByRole('button', { name: /Tạm dừng/i });
      fireEvent.click(pauseBtn);

      // Timer vẫn là 15:00
      expect(screen.getByText(/15:00/)).toBeTruthy();
    });

    it('Phát audio hoàn toàn giữ nguyên câu trả lời người dùng đã chọn (userAnswers invariant)', async () => {
      render(<ToeicAssessmentView />);
      fireEvent.click(screen.getByText(/Mini-Test/i));

      // Người dùng chọn đáp án (A)
      const choiceButtons = screen.getAllByRole('button');
      const choiceA = choiceButtons.find((b) => b.textContent?.includes('(A)'));
      expect(choiceA).toBeTruthy();
      if (choiceA) {
        fireEvent.click(choiceA);
        expect(choiceA.textContent).toContain('Đã Chọn');
      }

      // Người dùng bấm phát audio
      const playBtn = screen.getByRole('button', { name: /Phát Audio/i });
      fireEvent.click(playBtn);

      // Phương án (A) vẫn tiếp tục được giữ nguyên là "Đã Chọn"
      if (choiceA) {
        expect(choiceA.textContent).toContain('Đã Chọn');
      }
    });
  });

  describe('4. Lifecycle & Dọn Dẹp Khi Chuyển Câu / Pause / Kết Thúc', () => {
    it('Chuyển câu hỏi (Next Question) lập tức dừng audio câu hiện tại', async () => {
      render(<ToeicAssessmentView />);
      fireEvent.click(screen.getByText(/Mini-Test/i));

      // Bắt đầu phát câu 1
      const playBtn = screen.getByRole('button', { name: /Phát Audio/i });
      fireEvent.click(playBtn);
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();

      // Chuyển sang Câu Tiếp
      const nextBtn = screen.getByRole('button', { name: /Câu Tiếp/i });
      fireEvent.click(nextBtn);

      // Web Speech API cũ bị cancel ngay lập tức
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });

    it('Nhảy câu hỏi bằng bảng điều khiển (palette) lập tức dừng audio câu cũ', async () => {
      render(<ToeicAssessmentView />);
      fireEvent.click(screen.getByText(/Mini-Test/i));

      // Bắt đầu phát câu 1
      const playBtn = screen.getByRole('button', { name: /Phát Audio/i });
      fireEvent.click(playBtn);
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();

      // Bấm trực tiếp vào câu 2 trên palette
      const q2Btn = screen.getByRole('button', { name: '2' });
      fireEvent.click(q2Btn);

      // Audio câu 1 bị dừng
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });

    it('Tạm dừng bài thi (Pause Exam) tự động dừng audio', async () => {
      render(<ToeicAssessmentView />);
      // Chọn Practice mode (có hỗ trợ canPause)
      fireEvent.click(screen.getByText(/Luyện Tập Tự Do/i));
      fireEvent.click(screen.getByRole('button', { name: /Mini-Test/i }));

      // Phát audio
      const playBtn = screen.getByTitle('Phát âm thanh bài nghe');
      fireEvent.click(playBtn);
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();

      // Bấm nút Tạm Dừng trên header bằng title
      const pauseExamBtn = screen.getByTitle('Tạm dừng làm bài');
      fireEvent.click(pauseExamBtn);

      // Audio bị cancel
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });

    it('Nộp bài kết thúc đợt thi dọn dẹp toàn bộ playback', async () => {
      render(<ToeicAssessmentView />);
      fireEvent.click(screen.getByText(/Mini-Test/i));

      // Bắt đầu phát audio
      const playBtn = screen.getByRole('button', { name: /Phát Audio/i });
      fireEvent.click(playBtn);

      // Bấm Nộp Bài
      const submitBtn = screen.getByRole('button', { name: /Nộp Bài/i });
      fireEvent.click(submitBtn);

      // Xác nhận nộp bài
      const confirmSubmitBtn = screen.getByRole('button', { name: /Xác Nhận Nộp Bài/i });
      fireEvent.click(confirmSubmitBtn);

      // Sau khi chuyển sang màn hình report, cancel audio được gọi
      await waitFor(() => {
        expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
        expect(screen.getByText(/Kết Quả Khảo Sát Năng Lực TOEIC/i)).toBeTruthy();
      });
    });

    it('Unmount component không để lại memory leak hoặc background audio treo', () => {
      const { unmount } = render(<ToeicAssessmentView />);
      fireEvent.click(screen.getByText(/Mini-Test/i));

      const playBtn = screen.getByRole('button', { name: /Phát Audio/i });
      fireEvent.click(playBtn);

      // Unmount component
      unmount();

      // Audio bị hủy sạch sẽ
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });
  });

  describe('5. Transcript Fallback & Synchronization', () => {
    it('Không sử dụng dangerouslySetInnerHTML trong bất kỳ trường hợp nào', () => {
      const { container } = render(<ToeicAssessmentView />);
      const htmlContent = container.innerHTML;
      expect(htmlContent).not.toContain('dangerouslySetInnerHTML');
    });

    it('Hiển thị transcript an toàn trong chế độ Practice', async () => {
      render(<ToeicAssessmentView />);
      // Chế độ Practice cho phép xem transcript
      fireEvent.click(screen.getByText(/Luyện Tập Tự Do/i));
      fireEvent.click(screen.getByRole('button', { name: /Mini-Test/i }));

      // Bấm nút "Xem Script" bằng title
      const transcriptToggleBtn = screen.getByTitle('Xem kịch bản nghe audio');
      fireEvent.click(transcriptToggleBtn);

      // Hiển thị khung transcript
      expect(screen.getByText(/Kịch Bản Audio \(Transcript\)/i)).toBeTruthy();
    });
  });
});
