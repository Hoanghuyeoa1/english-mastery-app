// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ToeicAssessmentView } from '../ToeicAssessmentView';
import { getExamQuestionsByMode, TOEIC_QUESTION_BANK } from '../../data/toeicQuestionsData';

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

describe('ToeicAssessmentView (Khảo Sát Năng Lực TOEIC)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('1. Dataset Integrity & Question Distribution', () => {
    it('Tất cả câu hỏi trong TOEIC_QUESTION_BANK đều có part, skill, explanation, translation', () => {
      expect(TOEIC_QUESTION_BANK.length).toBeGreaterThanOrEqual(25);
      TOEIC_QUESTION_BANK.forEach((q) => {
        expect(q.id).toBeTruthy();
        expect(q.part).toBeTruthy();
        expect(q.skill).toMatch(/listening|reading|speaking|writing/);
        expect(q.questionText).toBeTruthy();
        expect(q.explanation).toBeTruthy();
        expect(q.vietnameseTranslation).toBeTruthy();
        if (q.skill === 'listening' || q.skill === 'reading') {
          expect(q.options?.length).toBeGreaterThanOrEqual(3);
          expect(q.correctAnswer).toMatch(/[A-D]/);
        }
      });
    });

    it('getExamQuestionsByMode chia đề thi chuẩn cân đối theo đúng cấu trúc', () => {
      const mini = getExamQuestionsByMode('2skills_mini');
      expect(mini).toHaveLength(10);
      // Đầy đủ cả 7 Part LR
      const partsMini = new Set(mini.map((q) => q.part));
      expect(partsMini.has('part1_photos')).toBe(true);
      expect(partsMini.has('part2_qna')).toBe(true);
      expect(partsMini.has('part3_conv')).toBe(true);
      expect(partsMini.has('part4_talks')).toBe(true);
      expect(partsMini.has('part5_grammar')).toBe(true);
      expect(partsMini.has('part6_text')).toBe(true);
      expect(partsMini.has('part7_reading')).toBe(true);

      const standard = getExamQuestionsByMode('2skills_full');
      expect(standard).toHaveLength(20);
      expect(standard.every((q) => q.skill === 'listening' || q.skill === 'reading')).toBe(true);

      const fourSkills = getExamQuestionsByMode('4skills');
      expect(fourSkills).toHaveLength(24);
      expect(fourSkills.filter((q) => q.skill === 'speaking')).toHaveLength(2);
      expect(fourSkills.filter((q) => q.skill === 'writing')).toHaveLength(2);
    });
  });

  describe('2. Màn hình Sảnh Chờ (Lobby) & Khôi Phục Tiến Độ', () => {
    it('Hiển thị tiêu đề, mô tả và các nút chọn chế độ thi', () => {
      render(<ToeicAssessmentView />);
      expect(screen.getByText(/Khảo Sát Năng Lực TOEIC 2 & 4 Kỹ Năng/i)).toBeTruthy();
      expect(screen.getByText(/Mini-Test/i)).toBeTruthy();
      expect(screen.getByText(/Standard/i)).toBeTruthy();
      expect(screen.getByText(/Bắt Đầu Thi 4 Kỹ Năng/i)).toBeTruthy();
    });

    it('Hiển thị banner khôi phục bài thi dở dang nếu có session trong sessionStorage', () => {
      sessionStorage.setItem(
        'english_mastery_toeic_inprogress',
        JSON.stringify({
          stage: 'testing',
          examMode: '2skills_mini',
          currentQuestionIdx: 2,
          timeLeft: 600,
          userAnswers: { toeic_p1_1: 'A' },
        })
      );

      render(<ToeicAssessmentView />);
      expect(screen.getByText(/Bạn có bài thi chưa hoàn thành/i)).toBeTruthy();
      expect(screen.getByText(/Tiếp Tục Làm Bài/i)).toBeTruthy();

      // Bấm Tiếp tục làm bài -> vào thẳng stage testing ở câu hỏi đã lưu
      fireEvent.click(screen.getByText(/Tiếp Tục Làm Bài/i));
      expect(screen.getAllByText(/Câu hỏi/i).length).toBeGreaterThan(0);
    });
  });

  describe('3. Luồng Làm Bài Thi (Testing Flow) & Điều Hướng', () => {
    it('Bắt đầu bài thi Mini-Test và chuyển câu mượt mà', () => {
      render(<ToeicAssessmentView />);
      const miniBtn = screen.getByText(/Mini-Test/i);
      fireEvent.click(miniBtn);

      // Màn hình thi hiện câu 1 / 10
      expect(screen.getAllByText(/Câu hỏi/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/15:00/)).toBeTruthy();

      // Bấm nút "Câu Tiếp"
      const nextBtn = screen.getByRole('button', { name: /Câu Tiếp/i });
      fireEvent.click(nextBtn);

      // Chuyển sang câu 2 / 10
      expect(screen.getAllByText(/Câu hỏi/i).length).toBeGreaterThan(0);

      // Bấm nút "Câu Trước"
      const prevBtn = screen.getByRole('button', { name: /Câu Trước/i });
      fireEvent.click(prevBtn);
    });

    it('Chọn đáp án và cập nhật trạng thái đã làm trên palette câu hỏi', () => {
      render(<ToeicAssessmentView />);
      fireEvent.click(screen.getByText(/Mini-Test/i));

      // Câu 1 là Part 1 Photos, có 4 nút A, B, C, D
      const choiceButtons = screen.getAllByRole('button');
      const choiceA = choiceButtons.find((b) => b.textContent?.includes('(A)'));
      expect(choiceA).toBeTruthy();

      if (choiceA) {
        fireEvent.click(choiceA);
        expect(choiceA.textContent).toContain('Đã Chọn');
      }
    });

    it('Mở modal xác nhận nộp bài kèm cảnh báo số câu chưa làm', () => {
      render(<ToeicAssessmentView />);
      fireEvent.click(screen.getByText(/Mini-Test/i));

      // Bấm nút Nộp Bài trên thanh điều khiển
      const submitTopBtn = screen.getByRole('button', { name: /Nộp Bài/i });
      fireEvent.click(submitTopBtn);

      // Modal xác nhận xuất hiện
      expect(screen.getByText(/Xác Nhận Nộp Bài Thi/i)).toBeTruthy();
      expect(screen.getByText(/chưa chọn phương án/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /Xem Lại Câu Chưa Làm/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Xác Nhận Nộp Bài/i })).toBeTruthy();

      // Bấm Xem lại câu chưa làm -> đóng modal và quay lại câu chưa trả lời
      fireEvent.click(screen.getByRole('button', { name: /Xem Lại Câu Chưa Làm/i }));
      expect(screen.queryByText(/Xác Nhận Nộp Bài Thi/i)).toBeNull();
    });
  });

  describe('4. Báo Cáo Kết Quả & Review Chi Tiết (Report Screen)', () => {
    it('Nộp bài thành công, hiển thị điểm số, độ chính xác, part breakdown và review filter', async () => {
      render(<ToeicAssessmentView />);
      fireEvent.click(screen.getByText(/Mini-Test/i));

      // Mở modal nộp bài
      const submitTopBtn = screen.getByRole('button', { name: /Nộp Bài/i });
      fireEvent.click(submitTopBtn);

      // Bấm xác nhận nộp
      const confirmSubmitBtn = screen.getByRole('button', { name: /Xác Nhận Nộp Bài/i });
      fireEvent.click(confirmSubmitBtn);

      // Chuyển sang màn hình Báo cáo kết quả
      await waitFor(() => {
        expect(screen.getByText(/Kết Quả Khảo Sát Năng Lực TOEIC/i)).toBeTruthy();
        expect(screen.getByText(/Listening \(Nghe Hiểu\)/i)).toBeTruthy();
        expect(screen.getByText(/Reading \(Đọc Hiểu\)/i)).toBeTruthy();
        expect(screen.getByText(/Phân Tích Chi Tiết Từng Phần/i)).toBeTruthy();
        expect(screen.getByText(/Điểm Mạnh Của Bạn/i)).toBeTruthy();
        expect(screen.getByText(/Điểm Cần Cải Thiện/i)).toBeTruthy();
        expect(screen.getByText(/Phân Tích Chi Tiết & Lời Giải Thích Từng Câu/i)).toBeTruthy();
      });

      // Kiểm tra các tabs filter review bằng getByRole button
      expect(screen.getByRole('button', { name: /^Tất cả/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Chỉ câu sai/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Câu đúng/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Chưa làm/i })).toBeTruthy();

      // Bấm filter "Chưa làm"
      fireEvent.click(screen.getByRole('button', { name: /Chưa làm/i }));

      // Bấm nút "Thi Bài Mới" quay về lobby
      const newExamBtn = screen.getByRole('button', { name: /Thi Bài Mới/i });
      fireEvent.click(newExamBtn);

      expect(screen.getByText(/Khảo Sát Năng Lực TOEIC 2 & 4 Kỹ Năng/i)).toBeTruthy();
    });
  });

  describe('5. Chế độ TOEIC 4 Kỹ Năng (Speaking & Writing Fallback)', () => {
    it('Làm bài thi 4 kỹ năng, hỗ trợ nhập text fallback cho Speaking và soạn thảo Writing', async () => {
      render(<ToeicAssessmentView />);
      const fourSkillsBtn = screen.getByText(/Bắt Đầu Thi 4 Kỹ Năng/i);
      fireEvent.click(fourSkillsBtn);

      // Đi tới câu hỏi Speaking (câu 21 trong bộ 24 câu)
      const q21Btn = screen.getByRole('button', { name: '21' });
      fireEvent.click(q21Btn);

      // Kiểm tra giao diện Speaking hiển thị
      expect(screen.getByText(/Nhấn Micro để thu âm/i)).toBeTruthy();
      const speakingInput = screen.getByPlaceholderText(/Gõ hoặc nói câu trả lời của bạn tại đây/i);
      expect(speakingInput).toBeTruthy();

      // Nhập text fallback cho Speaking
      fireEvent.change(speakingInput, { target: { value: 'In my opinion, remote work increases productivity.' } });
      expect((speakingInput as HTMLInputElement).value).toBe('In my opinion, remote work increases productivity.');

      // Đi tới câu hỏi Writing (câu 23)
      const q23Btn = screen.getByRole('button', { name: '23' });
      fireEvent.click(q23Btn);

      // Kiểm tra giao diện Writing hiển thị
      expect(screen.getByText(/Soạn thảo văn bản phản hồi/i)).toBeTruthy();
      const writingTextarea = screen.getByPlaceholderText(/Dear Mr. Davis/i);
      fireEvent.change(writingTextarea, {
        target: { value: 'Dear Sir, I am writing to express my appreciation for the prompt service provided by your company.' },
      });
      expect((writingTextarea as HTMLTextAreaElement).value).toContain('Dear Sir');

      // Nộp bài
      const submitTopBtn = screen.getByRole('button', { name: /Nộp Bài/i });
      fireEvent.click(submitTopBtn);

      const confirmSubmitBtn = screen.getByRole('button', { name: /Xác Nhận Nộp Bài/i });
      fireEvent.click(confirmSubmitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Kết Quả Khảo Sát Năng Lực TOEIC/i)).toBeTruthy();
        expect(screen.getByText(/Speaking & Writing/i)).toBeTruthy();
      });
    });

    it('Submit-once guard ngăn chặn nộp bài nhiều lần khi double-click', async () => {
      render(<ToeicAssessmentView />);
      fireEvent.click(screen.getByText(/Mini-Test/i));

      const submitTopBtn = screen.getByRole('button', { name: /Nộp Bài/i });
      fireEvent.click(submitTopBtn);

      const confirmSubmitBtn = screen.getByRole('button', { name: /Xác Nhận Nộp Bài/i });
      // Double click liên tiếp
      fireEvent.click(confirmSubmitBtn);
      fireEvent.click(confirmSubmitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Kết Quả Khảo Sát Năng Lực TOEIC/i)).toBeTruthy();
      });

      // Kiểm tra lịch sử chỉ ghi đúng 1 lần
      const history = JSON.parse(localStorage.getItem('english_mastery_toeic_history') || '[]');
      expect(history.length).toBe(1);
    });
  });

  describe('6. Phase 4 Lifecycle, Deterministic Snapshot, Rerender & Reload Invariants', () => {
    it('Bắt đầu bài thi -> Sinh snapshot một lần duy nhất và lưu snapshotMeta vào sessionStorage', () => {
      render(<ToeicAssessmentView />);
      fireEvent.click(screen.getByText(/Mini-Test/i));

      const raw = sessionStorage.getItem('english_mastery_toeic_inprogress');
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.snapshotMeta).toBeDefined();
      expect(parsed.snapshotMeta.questionIds).toHaveLength(10);
      expect(parsed.snapshotMeta.groupIds.length).toBeGreaterThan(0);
      expect(parsed.snapshotMeta.questionBankVersion).toBe('2026.1');
    });

    it('Rerender và chuyển câu liên tục bảo toàn nguyên vẹn snapshot và không gọi sinh đề lại', () => {
      const { rerender } = render(<ToeicAssessmentView />);
      fireEvent.click(screen.getByText(/Mini-Test/i));

      const rawInitial = sessionStorage.getItem('english_mastery_toeic_inprogress');
      const initialMeta = JSON.parse(rawInitial!).snapshotMeta;

      // Chuyển sang câu 2
      const nextBtn = screen.getByRole('button', { name: /Câu Tiếp/i });
      fireEvent.click(nextBtn);

      // Force rerender component
      rerender(<ToeicAssessmentView />);

      const rawAfter = sessionStorage.getItem('english_mastery_toeic_inprogress');
      const afterMeta = JSON.parse(rawAfter!).snapshotMeta;

      // Snapshot Meta và các Question IDs phải giữ nguyên tuyệt đối
      expect(afterMeta.attemptId).toBe(initialMeta.attemptId);
      expect(afterMeta.seed).toBe(initialMeta.seed);
      expect(afterMeta.questionIds).toEqual(initialMeta.questionIds);
    });

    it('Reload/F5 -> Khôi phục chính xác 100% snapshot câu hỏi và nhóm ban đầu', () => {
      // 1. Giả lập một session đang làm có snapshotMeta cụ thể trong sessionStorage
      const mockMeta = {
        attemptId: 'attempt_f5_recovery_test',
        mode: '2skills_mini',
        questionIds: [
          'toeic_p1_2',
          'toeic_p2_3',
          'toeic_p3_1',
          'toeic_p3_1_b',
          'toeic_p3_1_c',
          'toeic_p5_2',
          'toeic_p5_3',
          'toeic_p7_1',
          'toeic_p7_2',
          'toeic_p7_1_c',
        ],
        groupIds: ['toeic_grp_p3_1', 'toeic_grp_p7_1'],
        questionBankVersion: '2026.1',
        generatedAt: new Date().toISOString(),
        seed: 99999,
        totalQuestions: 10,
        durationMinutes: 15,
      };

      sessionStorage.setItem(
        'english_mastery_toeic_inprogress',
        JSON.stringify({
          stage: 'testing',
          attemptId: mockMeta.attemptId,
          snapshotMeta: mockMeta,
          examMode: '2skills_mini',
          currentQuestionIdx: 2,
          timeLeft: 750,
          userAnswers: { toeic_p1_2: 'B' },
          savedAt: Date.now(),
        })
      );

      // 2. Render ToeicAssessmentView (mô phỏng load lại trang sau F5)
      render(<ToeicAssessmentView />);

      expect(screen.getByText(/Bạn có bài thi chưa hoàn thành/i)).toBeTruthy();
      fireEvent.click(screen.getByText(/Tiếp Tục Làm Bài/i));

      // Màn hình thi được phục hồi ở câu 3
      expect(screen.getAllByText(/Câu hỏi/i).length).toBeGreaterThan(0);

      // Lưu lại tiến độ sau khi khôi phục
      const rawRestored = sessionStorage.getItem('english_mastery_toeic_inprogress');
      const restoredState = JSON.parse(rawRestored!);
      expect(restoredState.snapshotMeta.questionIds).toEqual(mockMeta.questionIds);
      expect(restoredState.snapshotMeta.groupIds).toEqual(mockMeta.groupIds);
    });
  });
});
