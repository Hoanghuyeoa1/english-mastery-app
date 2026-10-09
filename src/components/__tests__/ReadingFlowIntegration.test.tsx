// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { FourSkillsView } from '../FourSkillsView';
import { useAppStore, composeVocabularyList } from '../../store/useAppStore';
import { READING_LESSONS } from '../../data/fourSkills/readingData';

// Mock framer-motion to avoid Happy-DOM animation cancellation warnings
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
    button: ({ children, className, ...props }: any) => (
      <button className={className} {...props}>
        {children}
      </button>
    ),
    span: ({ children, className, ...props }: any) => (
      <span className={className} {...props}>
        {children}
      </span>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock canvas-confetti to prevent happy-dom canvas errors
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('PHASE 1 INTEGRATION BASELINE: Reading Complete Flow', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      srsProgressMap: {},
      userCustomWords: [],
      vocabularyList: composeVocabularyList({}, []),
      mistakeBank: {},
      dailyHistory: {},
      activeFourSkill: 'reading',
      fourSkillsScores: {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      },
      wordLearningStats: {},
      completedListeningLessonIds: [],
    });

    (window as any).alert = vi.fn();
    window.scrollTo = vi.fn();
  });

  it('xác minh flow hoàn chỉnh: select Reading → select lesson → render passage → click word → answer questions → submit → scoring → explanation → telemetry', async () => {
    const recordReadingSpy = vi.spyOn(useAppStore.getState(), 'recordReadingEncounters');

    render(<FourSkillsView />);

    // 1. SELECT READING: Catalog hiển thị các bài đọc
    expect(screen.getByText(/Kho Bài Đọc Chuyên Sâu/i)).toBeDefined();
    const targetLesson = READING_LESSONS.find((l) => l.id === 'read_1')!;
    const read1Title = targetLesson.title;
    expect(screen.getByText(read1Title)).toBeDefined();

    // 2. SELECT LESSON: Click vào bài đọc read_1
    const lessonCard = screen.getByText(read1Title).closest('.group');
    expect(lessonCard).not.toBeNull();
    fireEvent.click(lessonCard!);

    // 3. RENDER PASSAGE: Chi tiết bài đọc được render đầy đủ
    expect(screen.getByText('⬅ Quay lại danh sách bài đọc')).toBeDefined();
    expect(screen.getByText(targetLesson.summary)).toBeDefined();
    expect(screen.getByText(/Chạm vào bất kỳ từ vựng nào để tra nghĩa tức thì/i)).toBeDefined();

    // 4. CLICK WORD: Bấm vào một từ trong đoạn văn để mở popup tra cứu
    // Tìm một token trong passage, ví dụ "intelligence"
    const wordTokens = screen.getAllByRole('button');
    const targetWordToken = wordTokens.find((btn) => btn.textContent?.toLowerCase().includes('intelligence'));
    expect(targetWordToken).toBeDefined();

    fireEvent.click(targetWordToken!);

    // Popover tra từ hiển thị
    const popoverDialog = await screen.findByRole('dialog', { name: /Chi tiết từ vựng/i });
    expect(popoverDialog).toBeDefined();

    // Lưu vào Flashcard SRS từ popup
    const saveSrsBtn = screen.getByTestId('save-to-srs-btn');
    fireEvent.click(saveSrsBtn);

    // Kiểm tra từ đã được lưu vào srsProgressMap và xuất hiện trong Unified SRS Cards
    const storeStateAfterSave = useAppStore.getState();
    expect(Object.keys(storeStateAfterSave.srsProgressMap).length).toBeGreaterThan(0);
    const hasSavedCard = storeStateAfterSave
      .getUnifiedSRSCards()
      .some((c) => (c.word || c.primaryText || '').toLowerCase().includes('intelligence'));
    expect(hasSavedCard).toBe(true);

    // 5. ANSWER QUESTIONS: Trả lời các câu hỏi đọc hiểu
    // Câu 1: correctIndex = 1
    const q1CorrectOption = targetLesson.questions[0].options[targetLesson.questions[0].correctIndex];
    const optButton1 = screen.getByText(q1CorrectOption);
    fireEvent.click(optButton1);

    // 6. SUBMIT: Bấm nút "Nộp Bài Đọc Hiểu (+30 XP)"
    const submitBtn = screen.getByRole('button', { name: /Nộp Bài Đọc Hiểu/i });
    fireEvent.click(submitBtn);

    // 7. SCORING:
    // Kiểm tra message hoàn thành xuất hiện
    expect(await screen.findByText(/Bạn đã hoàn thành bài tập đọc hiểu/i)).toBeDefined();

    // Kiểm tra XP được cộng
    const currentXP = useAppStore.getState().profile.xp;
    expect(currentXP).toBeGreaterThan(0);

    // Kiểm tra Zustand store lưu tiến trình hoàn thành bài đọc
    const completedReadIds = useAppStore.getState().fourSkillsCompletionProgress.reading;
    expect(completedReadIds).toContain(targetLesson.id);

    // 8. EXPLANATION: Lời giải thích hiển thị cho câu hỏi
    const q1Explanation = targetLesson.questions[0].explanation;
    expect(screen.getByText(new RegExp(q1Explanation.slice(0, 30), 'i'))).toBeDefined();

    // 9. TELEMETRY: recordReadingEncounters được gọi với nội dung bài đọc
    expect(recordReadingSpy).toHaveBeenCalled();
    const callArgs = recordReadingSpy.mock.calls[0];
    expect(callArgs[0]).toContain('artificial intelligence');
    expect(callArgs[1]).toContain(`reading_lesson_${targetLesson.id}`);

    // Kiểm tra wordLearningStats được ghi nhận
    const stats = useAppStore.getState().wordLearningStats;
    expect(Object.keys(stats).length).toBeGreaterThan(0);

    recordReadingSpy.mockRestore();
  });

  it('lọc danh sách bài đọc chính xác theo từng dải CEFR (A1, A2, B1, B2, C1, C2) và hiển thị đúng 4 bài mỗi level', async () => {
    render(<FourSkillsView />);

    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
    for (const lvl of levels) {
      // Tìm pill lọc theo level trong hàng filter CEFR
      const levelPill = screen.getByRole('button', { name: lvl });
      fireEvent.click(levelPill);

      // Header catalog cập nhật số bài: (4 bài)
      expect(screen.getByText(new RegExp(`Kho Bài Đọc Chuyên Sâu \\(4 bài\\)`, 'i'))).toBeDefined();

      // Kiểm tra tất cả 4 bài thuộc level này xuất hiện
      const expectedLessons = READING_LESSONS.filter((l) => l.level === lvl);
      expect(expectedLessons).toHaveLength(4);
      expectedLessons.forEach((l) => {
        expect(screen.getByText(l.title)).toBeDefined();
      });
    }

    // Bấm 'Tất cả' để khôi phục toàn bộ 24 bài
    const allPill = screen.getAllByRole('button', { name: /Tất cả/i })[1]; // CEFR 'Tất cả cấp độ'
    fireEvent.click(allPill);
    expect(screen.getByText(new RegExp(`Kho Bài Đọc Chuyên Sâu \\(24 bài\\)`, 'i'))).toBeDefined();
  });

  it('xử lý empty state và nút Đặt lại bộ lọc khi không có bài phù hợp', async () => {
    render(<FourSkillsView />);

    // Chọn level C2
    const c2Pill = screen.getByRole('button', { name: 'C2' });
    fireEvent.click(c2Pill);

    // Chọn category 'Daily Life' (C2 không có Daily Life)
    const dailyLifeBtn = screen.getByRole('button', { name: 'Daily Life' });
    fireEvent.click(dailyLifeBtn);

    // Empty state hiển thị
    expect(screen.getByText(/Không tìm thấy bài đọc nào phù hợp với bộ lọc hiện tại/i)).toBeDefined();

    // Bấm nút Đặt lại bộ lọc
    const resetBtn = screen.getByRole('button', { name: /Đặt lại bộ lọc/i });
    fireEvent.click(resetBtn);

    // Trở về 24 bài
    expect(screen.getByText(new RegExp(`Kho Bài Đọc Chuyên Sâu \\(24 bài\\)`, 'i'))).toBeDefined();
  });

  it('vận hành trơn tru bài đọc phức tạp C2 (read_c2_1) không lỗi runtime và lưu telemetry', async () => {
    const recordReadingSpy = vi.spyOn(useAppStore.getState(), 'recordReadingEncounters');
    render(<FourSkillsView />);

    // Lọc sang C2
    const c2Pill = screen.getByRole('button', { name: 'C2' });
    fireEvent.click(c2Pill);

    // Chọn bài read_c2_1
    const c2Lesson = READING_LESSONS.find((l) => l.id === 'read_c2_1')!;
    const card = screen.getByText(c2Lesson.title).closest('.group')!;
    fireEvent.click(card);

    // Bài đọc C2 render đầy đủ
    expect(screen.getByText(c2Lesson.title)).toBeDefined();
    expect(screen.getByText(/Khảo sát cuộc khủng hoảng tái lập/i)).toBeDefined();

    // Chọn đáp án câu 1 (correctIndex: 1)
    const opt = c2Lesson.questions[0].options[c2Lesson.questions[0].correctIndex];
    const optBtn = screen.getByText(opt);
    fireEvent.click(optBtn);

    // Nộp bài
    const submitBtn = screen.getByRole('button', { name: /Nộp Bài Đọc Hiểu/i });
    fireEvent.click(submitBtn);

    // Hiển thị kết quả hoàn thành và telemetry
    expect(await screen.findByText(/Bạn đã hoàn thành bài tập đọc hiểu/i)).toBeDefined();
    expect(recordReadingSpy).toHaveBeenCalled();
    expect(recordReadingSpy.mock.calls[0][0]).toContain('replication crisis');
    expect(recordReadingSpy.mock.calls[0][1]).toContain('reading_lesson_read_c2_1');

    // Nút quay lại catalog hoạt động mượt mà
    const backBtn = screen.getByText('⬅ Quay lại danh sách bài đọc');
    fireEvent.click(backBtn);
    expect(screen.getByText(/Kho Bài Đọc Chuyên Sâu/i)).toBeDefined();

    recordReadingSpy.mockRestore();
  }, 15000);
});
