// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore, composeVocabularyList } from '../../store/useAppStore';
import { FourSkillsView } from '../FourSkillsView';
import { LISTENING_LESSONS, findListeningLessonsByCefr } from '../../data/fourSkills/listening';
import { resolveListeningQuestionTarget } from '../../services/adaptiveMistakeService';
import { captureListeningMistake } from '../../services/fourSkillsLearningBridge';

// Mock canvas-confetti for happy-dom environment
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('PHASE 6: Listening Lab App Real Usage & Verification Suite', () => {
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
      completedListeningLessonIds: [],
    });
  });

  // =========================================================================
  // 1. FOUR SKILLS UI & CEFR / CATEGORY FILTERING
  // =========================================================================
  describe('1. Four Skills UI: Dynamic Count & Filter Verification', () => {
    it('render catalog với số lượng bài derive động từ LISTENING_LESSONS.length', () => {
      render(<FourSkillsView />);

      // Catalog header phải hiển thị số bài thực tế, không hardcode 4 hay 24
      expect(screen.getByText(`Kho Bài Nghe Thực Tế (${LISTENING_LESSONS.length} bài)`)).toBeDefined();
      expect(screen.getByText(new RegExp(`Listening Lab \\(${LISTENING_LESSONS.length} bài\\)`))).toBeDefined();
    });

    it('CEFR Filter buttons hiển thị đầy đủ và lọc chính xác A1, A2, B1, B2, C1, C2', () => {
      render(<FourSkillsView />);

      const levels: Array<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'> = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      levels.forEach((lvl) => {
        const btn = screen.getByRole('button', { name: lvl });
        expect(btn).toBeDefined();

        fireEvent.click(btn);
        const expectedCount = findListeningLessonsByCefr(lvl).length;
        expect(screen.getByText(`Kho Bài Nghe Thực Tế (${expectedCount} bài)`)).toBeDefined();
      });
    });

    it('Category Filter hỗ trợ đầy đủ các danh mục mới (Education, Culture, Environment, Science)', () => {
      render(<FourSkillsView />);

      const newCategories = ['Education', 'Culture', 'Environment', 'Science'];
      newCategories.forEach((cat) => {
        const catBtn = screen.getByRole('button', { name: cat });
        expect(catBtn).toBeDefined();

        fireEvent.click(catBtn);
        const expectedCount = LISTENING_LESSONS.filter((l) => l.category === cat).length;
        expect(expectedCount).toBeGreaterThan(0);
        expect(screen.getByText(`Kho Bài Nghe Thực Tế (${expectedCount} bài)`)).toBeDefined();
      });
    });

    it('Empty state hiển thị khi tổ hợp bộ lọc không tìm thấy kết quả và có nút đặt lại', () => {
      render(<FourSkillsView />);

      // Lọc Education + C2 (hiện tại Education chỉ có ở B1)
      const c2Btn = screen.getByRole('button', { name: 'C2' });
      fireEvent.click(c2Btn);

      const eduBtn = screen.getByRole('button', { name: 'Education' });
      fireEvent.click(eduBtn);

      expect(screen.getByText('Kho Bài Nghe Thực Tế (0 bài)')).toBeDefined();
      expect(screen.getByText('Không tìm thấy bài nghe nào phù hợp với bộ lọc hiện tại.')).toBeDefined();

      // Bấm nút Đặt lại bộ lọc
      const resetBtn = screen.getByRole('button', { name: 'Đặt lại bộ lọc' });
      fireEvent.click(resetBtn);

      expect(screen.getByText(`Kho Bài Nghe Thực Tế (${LISTENING_LESSONS.length} bài)`)).toBeDefined();
    });
  });

  // =========================================================================
  // 2. ADAPTIVE ROUTER INTEGRATION & CANDIDATE SELECTION
  // =========================================================================
  describe('2. Adaptive Router: CEFR Routing & Candidate Selection', () => {
    it('route theo CEFR A1 mở đúng bài nghe A1 và ưu tiên bài chưa hoàn thành', () => {
      // Đánh dấu bài A1 đầu tiên đã hoàn thành
      useAppStore.setState({
        completedListeningLessonIds: ['listen_a1_1'],
        activePracticeConfig: {
          module: 'listening',
          itemIds: ['a1'],
          startedAt: Date.now(),
        },
      });

      render(<FourSkillsView />);

      // Bài nghe được chọn phải là bài A1 chưa hoàn thành (listen_a1_2)
      expect(screen.getByText('Weekend Grocery Special Announcement')).toBeDefined();
    });

    it('route theo CEFR C2 mở đúng bài nghe C2 và ưu tiên bài chưa hoàn thành', () => {
      useAppStore.setState({
        completedListeningLessonIds: ['listen_c2_1'],
        activePracticeConfig: {
          module: 'listening',
          itemIds: ['c2'],
          startedAt: Date.now(),
        },
      });

      render(<FourSkillsView />);

      // Bài nghe được chọn phải là listen_c2_2 (The Great Divergence)
      expect(screen.getByText('The Great Divergence: Institutional Economics and Eurasian Trade Dynamics')).toBeDefined();
    });

    it('route theo question ID hoặc vocab target word tìm đúng bài nghe', () => {
      useAppStore.setState({
        activePracticeConfig: {
          module: 'listening',
          itemIds: ['incommensurability'],
          startedAt: Date.now(),
        },
      });

      render(<FourSkillsView />);

      expect(screen.getByText('Linguistic Relativity, Syntactic Recursion, and the Architecture of Mind')).toBeDefined();
    });
  });

  // =========================================================================
  // 3. COMPLETION COMPATIBILITY & PERSISTENCE
  // =========================================================================
  describe('3. Completion Compatibility: Legacy & New Lessons', () => {
    it('completedListeningLessonIds lưu trữ và đánh dấu chuẩn xác cả 4 bài cũ và bài mới', () => {
      useAppStore.getState().markListeningLessonCompleted('listen_1');
      useAppStore.getState().markListeningLessonCompleted('listen_2');
      useAppStore.getState().markListeningLessonCompleted('listen_c2_4');

      const completed = useAppStore.getState().completedListeningLessonIds;
      expect(completed).toContain('listen_1');
      expect(completed).toContain('listen_2');
      expect(completed).toContain('listen_c2_4');

      // Duplicate check: không thêm ID trùng lặp
      useAppStore.getState().markListeningLessonCompleted('listen_1');
      expect(useAppStore.getState().completedListeningLessonIds.filter((id) => id === 'listen_1')).toHaveLength(1);
    });

    it('UI hiển thị badge "Đã xong" chính xác cho các bài đã hoàn thành', () => {
      useAppStore.setState({
        completedListeningLessonIds: ['listen_a1_1', 'listen_c2_1'],
      });

      render(<FourSkillsView />);

      // Cả hai bài phải hiển thị Đã xong
      const doneBadges = screen.getAllByText('Đã xong');
      expect(doneBadges.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // 4. MISTAKE BANK DISCIPLINE: VOCAB TARGET VS GENERAL COMPREHENSION
  // =========================================================================
  describe('4. Mistake Bank Discipline: resolveListeningQuestionTarget', () => {
    it('chỉ câu hỏi vocab_context mới tạo vocabulary target và mistake evidence', () => {
      const mockRecordMistake = vi.fn();

      const generalQuestion = {
        id: 'q_gen_test',
        type: 'main_idea' as const,
        question: 'What is the main topic of the conversation?',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
        explanation: 'Main topic is A',
      };

      const res = resolveListeningQuestionTarget(generalQuestion, 'Sample Lesson');
      expect(res.isVocabTarget).toBe(false);

      // captureListeningMistake không được tạo vocabulary mistake cho câu hỏi đọc hiểu thông thường
      captureListeningMistake({
        question: generalQuestion,
        lessonTitle: 'Sample Lesson',
        selectedOptIdx: 1,
        vocabularyList: [],
        recordMistake: mockRecordMistake,
      });

      expect(mockRecordMistake).not.toHaveBeenCalled();
    });

    it('câu hỏi vocab_context tạo vocabulary mistake hợp lệ với targetWord chuẩn', () => {
      const mockRecordMistake = vi.fn();

      const vocabQuestion = {
        id: 'q_vocab_test',
        type: 'vocab_context' as const,
        question: 'What does the word "incommensurability" mean in the text?',
        options: ['Incompatible', 'Calculable', 'Measurable', 'Simple'],
        correctIndex: 0,
        explanation: 'Incommensurability means incompatible.',
      };

      const res = resolveListeningQuestionTarget(vocabQuestion, 'Philosophy Colloquium');
      expect(res.isVocabTarget).toBe(true);
      expect(res.targetWord).toBe('incommensurability');

      captureListeningMistake({
        question: vocabQuestion,
        lessonTitle: 'Philosophy Colloquium',
        selectedOptIdx: 1,
        vocabularyList: [],
        recordMistake: mockRecordMistake,
      });

      expect(mockRecordMistake).toHaveBeenCalledTimes(1);
      expect(mockRecordMistake).toHaveBeenCalledWith(
        expect.objectContaining({ word: 'incommensurability' }),
        'listening',
        expect.objectContaining({
          type: 'listening',
        })
      );
    });
  });

  // =========================================================================
  // 5. SRS / FSRS INVARIANT & PERSISTENCE INTEGRITY
  // =========================================================================
  describe('5. SRS / FSRS Invariant & Static Content Purity', () => {
    it('Listening Lab không chỉnh sửa trực tiếp scheduler parameters (interval, easeFactor, fsrs)', () => {
      const initialSrsProgress = { ...useAppStore.getState().srsProgressMap };

      // Chấm điểm và nộp bài nghe không được mutate srsProgressMap
      useAppStore.getState().recordSkillScore('listening', 85);
      useAppStore.getState().markListeningLessonCompleted('listen_b1_1');

      expect(useAppStore.getState().srsProgressMap).toEqual(initialSrsProgress);
      expect(useAppStore.getState().fourSkillsScores.listening).toContain(85);
    });

    it('chỉ có ID bài nghe được persist trong completedListeningLessonIds, không có static content payload', () => {
      useAppStore.getState().markListeningLessonCompleted('listen_b2_1');

      const savedIds = useAppStore.getState().completedListeningLessonIds;
      expect(savedIds).toEqual(['listen_b2_1']);

      // Kiểm tra không có text transcript hay sentences bị nhúng vào state
      expect((savedIds as any).audioText).toBeUndefined();
      expect((savedIds as any).sentences).toBeUndefined();
    });
  });
});
