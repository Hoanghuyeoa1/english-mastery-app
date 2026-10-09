// src/components/__tests__/toeicListeningPart1And2.test.tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ToeicPart1View } from '../toeic/ToeicPart1View';
import { ToeicPart2View } from '../toeic/ToeicPart2View';
import { ToeicListeningBar } from '../toeic/ToeicListeningBar';
import {
  ToeicListeningEngineState,
  DEFAULT_LISTENING_POLICIES,
} from '../../types/toeicListening';
import { ToeicQuestion } from '../../types/toeic';

const mockPart1Question: ToeicQuestion = {
  id: 'test_p1_1',
  part: 'part1_photos',
  skill: 'listening',
  difficulty: 'easy',
  imageUrl: 'https://images.unsplash.com/photo-sample.jpg',
  audioScript: 'Look at the picture marked number 1. (A) The man is typing on a laptop. (B) The man is repairing a printer. (C) The man is drinking from a mug. (D) The man is presenting a chart.',
  questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
  options: [
    'A. The man is typing on a laptop.',
    'B. The man is repairing a printer.',
    'C. The man is drinking from a mug.',
    'D. The man is presenting a chart.',
  ],
  correctAnswer: 'A',
  explanation: 'Đáp án (A) mô tả chính xác hành động người đàn ông đang gõ máy tính.',
  vietnameseTranslation: 'Người đàn ông đang gõ máy tính xách tay.',
};

const mockPart2Question: ToeicQuestion = {
  id: 'test_p2_1',
  part: 'part2_qna',
  skill: 'listening',
  difficulty: 'easy',
  audioScript: 'Where is the annual shareholders meeting being held this year? (A) In Conference Room B on the second floor. (B) Yes, it was very productive. (C) At ten o’clock tomorrow morning.',
  questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
  options: [
    'A. In Conference Room B on the second floor.',
    'B. Yes, it was very productive.',
    'C. At ten o’clock tomorrow morning.',
  ],
  correctAnswer: 'A',
  explanation: 'Câu hỏi bắt đầu bằng "Where" hỏi địa điểm. Đáp án (A) trả lời chính xác.',
  vietnameseTranslation: 'Cuộc họp tổ chức ở đâu? (A) Tại phòng họp B tầng 2.',
};

const baseEngineState: ToeicListeningEngineState = {
  status: 'ready',
  currentGroupId: 'grp_test',
  currentAudioGroupId: 'audio_test',
  sourceType: 'recorded',
  audioUrl: 'https://cdn.example.com/audio.mp3',
  currentTimeMs: 0,
  durationMs: 15000,
  playbackRate: 1.0,
  volume: 1.0,
  isMuted: false,
  hasPlayed: false,
  playCount: 0,
  activeSegmentIndex: -1,
  activeSegment: null,
  isEligibleToPlay: true,
};

describe('PHASE 4: TOEIC Listening Part 1 & Part 2 Integration', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // ===========================================================================
  // 1. PART 1 — PHOTOGRAPHS
  // ===========================================================================
  describe('1. Part 1 — Photographs View & Policy', () => {
    it('Hiển thị ảnh và alt text chuẩn accessibility mà KHÔNG làm rò rỉ đáp án', () => {
      const onSelectAnswer = vi.fn();
      render(
        <ToeicPart1View
          question={mockPart1Question}
          questionNumber={1}
          onSelectAnswer={onSelectAnswer}
          policy={DEFAULT_LISTENING_POLICIES.mock}
          engineState={baseEngineState}
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

      // Ảnh hiển thị với alt text an toàn
      const img = screen.getByRole('img');
      expect(img).toBeDefined();
      expect(img.getAttribute('alt')).toContain('Hình ảnh câu hỏi số 1');
      // Invariant: Không chứa nội dung câu trả lời đúng
      expect(img.getAttribute('alt')).not.toContain('typing');
      expect(img.getAttribute('alt')).not.toContain('laptop');
    });

    it('Mock Mode: Chỉ hiển thị 4 nút (A), (B), (C), (D) không tiết lộ text câu nói (Pure Listening)', () => {
      render(
        <ToeicPart1View
          question={mockPart1Question}
          questionNumber={1}
          onSelectAnswer={vi.fn()}
          policy={DEFAULT_LISTENING_POLICIES.mock}
          engineState={baseEngineState}
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

      // 4 nút lựa chọn
      expect(screen.getByText('(A)')).toBeDefined();
      expect(screen.getByText('(B)')).toBeDefined();
      expect(screen.getByText('(C)')).toBeDefined();
      expect(screen.getByText('(D)')).toBeDefined();

      // KHÔNG hiển thị văn bản phương án
      expect(screen.queryByText(/The man is typing on a laptop/i)).toBeNull();
      expect(screen.queryByText(/repairing a printer/i)).toBeNull();
    });

    it('Practice Mode: Chỉ tiết lộ văn bản các câu nghe SAU KHI thí sinh đã chọn đáp án', () => {
      const { rerender } = render(
        <ToeicPart1View
          question={mockPart1Question}
          questionNumber={1}
          onSelectAnswer={vi.fn()}
          policy={DEFAULT_LISTENING_POLICIES.practice}
          engineState={baseEngineState}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          onRestart={vi.fn()}
          onSeek={vi.fn()}
          onSetSpeed={vi.fn()}
          hasAnswered={false} // Chưa trả lời
          revealedTranscript={false}
          onToggleTranscript={vi.fn()}
        />
      );

      // Trước khi trả lời: Text bị ẩn
      expect(screen.queryByText(/The man is typing on a laptop/i)).toBeNull();

      // Sau khi đã chọn đáp án (hasAnswered = true)
      rerender(
        <ToeicPart1View
          question={mockPart1Question}
          questionNumber={1}
          selectedAnswer="A"
          onSelectAnswer={vi.fn()}
          policy={DEFAULT_LISTENING_POLICIES.practice}
          engineState={baseEngineState}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          onRestart={vi.fn()}
          onSeek={vi.fn()}
          onSetSpeed={vi.fn()}
          hasAnswered={true} // Đã trả lời
          revealedTranscript={false}
          onToggleTranscript={vi.fn()}
        />
      );

      // Sau khi trả lời: Tiết lộ văn bản để đối chiếu học tập
      expect(screen.getByText(/The man is typing on a laptop/i)).toBeDefined();
      expect(screen.getByText(/The man is repairing a printer/i)).toBeDefined();
    });

    it('Click chọn phương án gọi onSelectAnswer đúng ký tự', () => {
      const onSelectAnswer = vi.fn();
      render(
        <ToeicPart1View
          question={mockPart1Question}
          questionNumber={1}
          onSelectAnswer={onSelectAnswer}
          policy={DEFAULT_LISTENING_POLICIES.practice}
          engineState={baseEngineState}
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

      fireEvent.click(screen.getByText('(B)'));
      expect(onSelectAnswer).toHaveBeenCalledWith('B');
    });
  });

  // ===========================================================================
  // 2. PART 2 — QUESTION & RESPONSE
  // ===========================================================================
  describe('2. Part 2 — Question & Response View & Policy', () => {
    it('Trước khi trả lời: KHÔNG hiển thị văn bản câu hỏi lẫn 3 câu phản hồi', () => {
      render(
        <ToeicPart2View
          question={mockPart2Question}
          questionNumber={2}
          onSelectAnswer={vi.fn()}
          policy={DEFAULT_LISTENING_POLICIES.mock}
          engineState={baseEngineState}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          onRestart={vi.fn()}
          onSetSpeed={vi.fn()}
          hasAnswered={false}
          revealedTranscript={false}
          onToggleTranscript={vi.fn()}
        />
      );

      // Chỉ có chính xác 3 phương án A, B, C
      expect(screen.getByText('(A)')).toBeDefined();
      expect(screen.getByText('(B)')).toBeDefined();
      expect(screen.getByText('(C)')).toBeDefined();
      expect(screen.queryByText('(D)')).toBeNull();

      // Giấu hoàn toàn văn bản câu hỏi nghe và các phương án
      expect(screen.queryByText(/Where is the annual shareholders meeting/i)).toBeNull();
      expect(screen.queryByText(/In Conference Room B/i)).toBeNull();
      expect(screen.queryByText(/Yes, it was very productive/i)).toBeNull();
    });

    it('Practice Mode: Tiết lộ văn bản câu hỏi và 3 câu phản hồi SAU KHI trả lời', () => {
      const { rerender } = render(
        <ToeicPart2View
          question={mockPart2Question}
          questionNumber={2}
          onSelectAnswer={vi.fn()}
          policy={DEFAULT_LISTENING_POLICIES.practice}
          engineState={baseEngineState}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          onRestart={vi.fn()}
          onSetSpeed={vi.fn()}
          hasAnswered={false}
          revealedTranscript={false}
          onToggleTranscript={vi.fn()}
        />
      );

      expect(screen.queryByText(/In Conference Room B/i)).toBeNull();

      rerender(
        <ToeicPart2View
          question={mockPart2Question}
          questionNumber={2}
          selectedAnswer="A"
          onSelectAnswer={vi.fn()}
          policy={DEFAULT_LISTENING_POLICIES.practice}
          engineState={baseEngineState}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          onRestart={vi.fn()}
          onSetSpeed={vi.fn()}
          hasAnswered={true}
          revealedTranscript={false}
          onToggleTranscript={vi.fn()}
        />
      );

      expect(screen.getByText(/In Conference Room B on the second floor/i)).toBeDefined();
      expect(screen.getByText(/Yes, it was very productive/i)).toBeDefined();
    });

    it('Hiển thị chỉ báo chuỗi Part 2 (part2SequenceStep) khi đang phát', () => {
      const stateWithStep: ToeicListeningEngineState = {
        ...baseEngineState,
        status: 'playing',
        part2SequenceStep: 'option_b',
      };

      render(
        <ToeicPart2View
          question={mockPart2Question}
          questionNumber={2}
          onSelectAnswer={vi.fn()}
          policy={DEFAULT_LISTENING_POLICIES.practice}
          engineState={stateWithStep}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          onRestart={vi.fn()}
          onSetSpeed={vi.fn()}
          hasAnswered={false}
          revealedTranscript={false}
          onToggleTranscript={vi.fn()}
        />
      );

      // Badge hiển thị bước đọc
      expect(screen.getByText(/Đang đọc: Phương án \(B\)/i)).toBeDefined();
    });
  });

  // ===========================================================================
  // 3. CENTRAL PLAYBACK POLICY & MOCK INTEGRITY
  // ===========================================================================
  describe('3. Central Playback Policy in ToeicListeningBar', () => {
    it('Mock Mode: Khóa nút phát sau 1 lần nghe duy nhất (playCount >= 1)', () => {
      const statePlayedOnce: ToeicListeningEngineState = {
        ...baseEngineState,
        hasPlayed: true,
        playCount: 1,
        status: 'ready',
      };

      const onPlay = vi.fn();
      render(
        <ToeicListeningBar
          engineState={statePlayedOnce}
          policy={DEFAULT_LISTENING_POLICIES.mock}
          onPlay={onPlay}
          onPause={vi.fn()}
          partLabel="Part 1: Photographs"
        />
      );

      const playButton = screen.getByRole('button', { name: /Đã phát \(1 lần\)/i });
      expect(playButton).toBeDefined();
      expect(playButton.hasAttribute('disabled')).toBe(true);

      fireEvent.click(playButton);
      expect(onPlay).not.toHaveBeenCalled();
    });

    it('Practice Mode: Cho phép nghe lại nhiều lần và hiển thị thanh tua thời gian', () => {
      const onRestart = vi.fn();
      const onSeek = vi.fn();

      render(
        <ToeicListeningBar
          engineState={baseEngineState}
          policy={DEFAULT_LISTENING_POLICIES.practice}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          onRestart={onRestart}
          onSeek={onSeek}
          onSetSpeed={vi.fn()}
          onToggleTranscript={vi.fn()}
          partLabel="Part 1: Photographs"
        />
      );

      // Nút replay có mặt
      const replayBtn = screen.getByLabelText(/Nghe lại từ đầu/i);
      expect(replayBtn).toBeDefined();
      fireEvent.click(replayBtn);
      expect(onRestart).toHaveBeenCalled();

      // Thanh tua có mặt
      const seekBar = screen.getByLabelText(/Thanh tua thời gian/i);
      expect(seekBar).toBeDefined();
      fireEvent.change(seekBar, { target: { value: 5000 } });
      expect(onSeek).toHaveBeenCalledWith(5000);
    });
  });
});
