// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  calculateListeningResult,
  getListeningClassification,
  getListeningFeedback,
  ListeningResultModel,
} from '../../services/listeningResultService';
import { ListeningResultSummary } from '../ListeningResultSummary';
import { FourSkillsView } from '../FourSkillsView';
import { useAppStore, composeVocabularyList } from '../../store/useAppStore';
import type { ListeningLesson } from '../../data/fourSkills/types';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

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
  onboundary: ((evt: any) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

describe('PHASE 2: Complete Listening Result Summary & Question Review Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      srsProgressMap: {},
      userCustomWords: [],
      vocabularyList: composeVocabularyList({}, []),
      mistakeBank: {},
      dailyHistory: {},
      activeFourSkill: 'listening',
      fourSkillsScores: {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      },
      completedListeningLessonIds: [],
      activePracticeConfig: null,
    });

    (window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
    (window as any).speechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      speaking: false,
      paused: false,
    };
  });

  // =========================================================================
  // 1. Pure Calculation Service: Edge Cases & Rule-Based Feedback
  // =========================================================================
  describe('1. Pure Calculation Service & Feedback Logic', () => {
    const multiQuestionLesson: ListeningLesson = {
      id: 'test-lesson-1',
      title: 'Coffee Culture in Seattle',
      level: 'B1',
      category: 'Daily Life',
      duration: '1:30',
      description: 'Coffee culture in the Pacific Northwest',
      audioText: 'Some text about coffee culture.',
      sentences: [{ en: 'Some text', vi: 'Doan van' }],
      questions: [
        {
          id: 'q1',
          question: 'What is the topic?',
          options: ['Tea', 'Coffee', 'Water'],
          correctIndex: 1,
          explanation: 'It discusses coffee culture.',
          type: 'main_idea',
        },
        {
          id: 'q2',
          question: 'Which city was mentioned?',
          options: ['New York', 'Seattle', 'Chicago'],
          correctIndex: 1,
          explanation: 'Seattle is the emerald city.',
          type: 'detail',
        },
        {
          id: 'q3',
          question: 'What is popular?',
          options: ['Espresso', 'Tea', 'Juice'],
          correctIndex: 0,
          explanation: 'Espresso is popular.',
          type: 'vocab_context',
        },
        {
          id: 'q4',
          question: 'How do people feel?',
          options: ['Bored', 'Energized', 'Tired'],
          correctIndex: 1,
          explanation: '', // Empty explanation to test fallback
        },
      ],
    };

    it('100% correct: calculates accuracy 100%, Excellent classification, and deterministic feedback', () => {
      const answers = { q1: 1, q2: 1, q3: 0, q4: 1 };
      const res = calculateListeningResult(multiQuestionLesson, answers);

      expect(res.correctCount).toBe(4);
      expect(res.incorrectCount).toBe(0);
      expect(res.totalQuestions).toBe(4);
      expect(res.accuracy).toBe(100);
      expect(res.score).toBe(100);
      expect(res.classification).toBe('Excellent');
      expect(res.feedback.title).toContain('Xuất Sắc');
      expect(res.wrongQuestionIndexes).toEqual([]);
      expect(res.questionBreakdowns.length).toBe(4);
      expect(res.questionBreakdowns[0].selectedOptionText).toBe('Coffee');
      expect(res.questionBreakdowns[0].correctOptionText).toBe('Coffee');
      expect(res.questionBreakdowns[0].isCorrect).toBe(true);
    });

    it('0% correct: calculates accuracy 0%, Needs Practice classification, and all questions in wrongQuestionIndexes', () => {
      const answers = { q1: 0, q2: 0, q3: 1, q4: 0 }; // All wrong
      const res = calculateListeningResult(multiQuestionLesson, answers);

      expect(res.correctCount).toBe(0);
      expect(res.incorrectCount).toBe(4);
      expect(res.accuracy).toBe(0);
      expect(res.score).toBe(0);
      expect(res.classification).toBe('Needs Practice');
      expect(res.feedback.title).toContain('Cần Luyện Tập Thêm');
      expect(res.wrongQuestionIndexes).toEqual([0, 1, 2, 3]);
    });

    it('one-question lesson: handles 1/1 (100%) and 0/1 (0%) properly', () => {
      const singleLesson: ListeningLesson = {
        ...multiQuestionLesson,
        questions: [multiQuestionLesson.questions[0]],
      };

      const resCorrect = calculateListeningResult(singleLesson, { q1: 1 });
      expect(resCorrect.totalQuestions).toBe(1);
      expect(resCorrect.correctCount).toBe(1);
      expect(resCorrect.accuracy).toBe(100);
      expect(resCorrect.classification).toBe('Excellent');

      const resIncorrect = calculateListeningResult(singleLesson, { q1: 0 });
      expect(resIncorrect.totalQuestions).toBe(1);
      expect(resIncorrect.correctCount).toBe(0);
      expect(resIncorrect.accuracy).toBe(0);
      expect(resIncorrect.classification).toBe('Needs Practice');
    });

    it('zero-question lesson: safe fallback without crashing or NaN', () => {
      const emptyLesson: ListeningLesson = {
        ...multiQuestionLesson,
        questions: [],
      };
      const res = calculateListeningResult(emptyLesson, {});
      expect(res.totalQuestions).toBe(0);
      expect(res.correctCount).toBe(0);
      expect(res.accuracy).toBe(0);
      expect(res.score).toBe(0);
      expect(res.classification).toBe('Needs Practice');
      expect(res.feedback).toBeDefined();
    });

    it('missing explanation safely falls back to standard text (never undefined/null)', () => {
      const res = calculateListeningResult(multiQuestionLesson, { q1: 1, q2: 1, q3: 0, q4: 1 });
      const q4 = res.questionBreakdowns[3];
      expect(q4.explanation).toBe('Không có giải thích chi tiết cho câu hỏi này.');
      expect(q4.explanation).not.toBeNull();
      expect(q4.explanation).not.toBeUndefined();
    });

    it('rule-based feedback handles different thresholds deterministically without API calls', () => {
      const fb100 = getListeningFeedback(100);
      expect(fb100.title).toContain('Xuất Sắc');

      const fb80 = getListeningFeedback(80);
      expect(fb80.title).toContain('Rất Tốt');

      const fb60 = getListeningFeedback(60);
      expect(fb60.title).toContain('Cần Luyện Tập');

      const fbNaN = getListeningFeedback(NaN);
      expect(fbNaN.title).toContain('Cần Luyện Tập');
    });
  });

  // =========================================================================
  // 2. Component Rendering: Collapsible Review & Needs Review UI
  // =========================================================================
  describe('2. Component Rendering (ListeningResultSummary)', () => {
    const mockModel: ListeningResultModel = {
      correctCount: 2,
      incorrectCount: 1,
      totalQuestions: 3,
      accuracy: 67,
      score: 67,
      lessonTitle: 'Sprint Planning & Scope Negotiation in Agile Teams',
      cefrLevel: 'B2',
      classification: 'Needs Practice',
      feedback: {
        title: 'Cần Luyện Tập Thêm (Needs Practice)',
        message: 'Nội dung bài nghe có một số phân đoạn phức tạp khiến bạn chưa bắt kịp.',
        actionHint: 'Hãy nghe lại transcript và tập trung vào các câu hỏi sai.',
      },
      wrongQuestionIndexes: [1],
      questionBreakdowns: [
        {
          id: 'q1',
          questionIndex: 0,
          questionText: 'What is the main epic discussed?',
          type: 'gist',
          selectedOptionIndex: 1,
          selectedOptionText: 'Checkout modernization epic',
          correctOptionIndex: 1,
          correctOptionText: 'Checkout modernization epic',
          options: ['Legacy maintenance', 'Checkout modernization epic', 'Server upgrade'],
          isCorrect: true,
          explanation: 'Sprint planning explicitly covers the Q3 checkout modernization epic.',
        },
        {
          id: 'q2',
          questionIndex: 1,
          questionText: 'What was the infrastructure bottleneck?',
          type: 'detail',
          selectedOptionIndex: 0,
          selectedOptionText: 'Network latency spike',
          correctOptionIndex: 1,
          correctOptionText: 'Database connection pool reached 80%',
          options: ['Network latency spike', 'Database connection pool reached 80%', 'Disk full'],
          isCorrect: false,
          explanation: 'The connection pool reached nearly 80% utilization.',
        },
        {
          id: 'q3',
          questionIndex: 2,
          questionText: 'What does scoping down mean?',
          type: 'vocab_context',
          selectedOptionIndex: 1,
          selectedOptionText: 'Reducing or narrowing immediate release features',
          correctOptionIndex: 1,
          correctOptionText: 'Reducing or narrowing immediate release features',
          options: ['Expanding project staff', 'Reducing or narrowing immediate release features'],
          isCorrect: true,
          explanation: '', // empty to test UI fallback
        },
      ],
    };

    it('renders the complete 6-block layout with feedback, metrics, and actions', () => {
      const onReview = vi.fn();
      const onRetry = vi.fn();
      const onBack = vi.fn();
      const onReplay = vi.fn();

      render(
        <ListeningResultSummary
          result={mockModel}
          onReviewQuestions={onReview}
          onRetry={onRetry}
          onBackToCatalog={onBack}
          onReplayAudio={onReplay}
        />
      );

      // 1. Result & Rule-based feedback
      expect(screen.getByText('Đã hoàn thành kiểm tra độ hiểu bài!')).toBeTruthy();
      expect(screen.getByText('CEFR B2')).toBeTruthy();
      expect(screen.getByTestId('rule-based-feedback-banner')).toBeTruthy();
      expect(screen.getByText(/Nội dung bài nghe có một số phân đoạn phức tạp/i)).toBeTruthy();

      // 2. Metrics
      expect(screen.getByTestId('summary-accuracy').textContent).toBe('67%');
      expect(screen.getByTestId('summary-correct').textContent).toBe('2 / 3');
      expect(screen.getByTestId('summary-incorrect').textContent).toBe('1 / 3');

      // 3. Needs Review with mistakes
      const needsReview = screen.getByTestId('needs-review-section');
      expect(needsReview.textContent).toContain('1 câu chưa chính xác');
      expect(needsReview.textContent).toContain('Câu 2');

      // 4. Action buttons
      const reviewBtn = screen.getByTestId('btn-review-questions');
      fireEvent.click(reviewBtn);
      expect(onReview).toHaveBeenCalledTimes(1);

      const retryBtn = screen.getByTestId('btn-retry-quiz');
      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);

      const backBtn = screen.getByTestId('btn-back-to-catalog');
      fireEvent.click(backBtn);
      expect(onBack).toHaveBeenCalledTimes(1);

      const replayBtn = screen.getByTestId('btn-replay-audio');
      fireEvent.click(replayBtn);
      expect(onReplay).toHaveBeenCalledTimes(1);
    });

    it('toggles collapsible question review per question and globally', () => {
      render(
        <ListeningResultSummary
          result={mockModel}
          onReviewQuestions={vi.fn()}
          onRetry={vi.fn()}
        />
      );

      // Initially, collapsible details for q1 are collapsed
      const q1Card = screen.getByTestId('question-card-q1');
      const cardHeaderQ1 = q1Card.querySelector('button')!;
      expect(screen.queryByText(/Sprint planning explicitly covers/i)).toBeNull();

      // Click q1 card header -> expands detail
      fireEvent.click(cardHeaderQ1);
      expect(screen.getByText(/Sprint planning explicitly covers/i)).toBeTruthy();
      expect(screen.getAllByText(/Checkout modernization epic/i).length).toBeGreaterThanOrEqual(1);

      // Click q1 card header again -> collapses detail
      fireEvent.click(cardHeaderQ1);
      expect(screen.queryByText(/Sprint planning explicitly covers/i)).toBeNull();

      // Global toggle: "Mở rộng tất cả" expands all questions
      const toggleAllBtn = screen.getByTestId('btn-toggle-all-explanations');
      fireEvent.click(toggleAllBtn);

      expect(screen.getByText(/Sprint planning explicitly covers/i)).toBeTruthy();
      expect(screen.getByText(/The connection pool reached nearly 80%/i)).toBeTruthy();
      expect(screen.getByText(/Không có giải thích chi tiết cho câu hỏi này/i)).toBeTruthy();

      // Global toggle again: "Thu gọn tất cả" collapses all questions
      fireEvent.click(toggleAllBtn);
      expect(screen.queryByText(/Sprint planning explicitly covers/i)).toBeNull();
      expect(screen.queryByText(/The connection pool reached nearly 80%/i)).toBeNull();
    });

    it('accessible badges do not rely on color alone (includes text and icon)', () => {
      render(
        <ListeningResultSummary
          result={mockModel}
          onReviewQuestions={vi.fn()}
          onRetry={vi.fn()}
        />
      );

      const correctBadge = screen.getByTestId('badge-correct-q1');
      expect(correctBadge.textContent).toContain('Chính xác (Correct)');

      const incorrectBadge = screen.getByTestId('badge-incorrect-q2');
      expect(incorrectBadge.textContent).toContain('Chưa đúng (Incorrect)');
    });

    it('filter mistakes only button filters question review cards', () => {
      render(
        <ListeningResultSummary
          result={mockModel}
          onReviewQuestions={vi.fn()}
          onRetry={vi.fn()}
        />
      );

      // Initially all 3 question cards exist
      expect(screen.getByTestId('question-card-q1')).toBeTruthy();
      expect(screen.getByTestId('question-card-q2')).toBeTruthy();
      expect(screen.getByTestId('question-card-q3')).toBeTruthy();

      // Click "Chỉ xem câu sai"
      const filterMistakesBtn = screen.getByTestId('btn-filter-mistakes');
      fireEvent.click(filterMistakesBtn);

      // Only q2 (incorrect) should be visible
      expect(screen.queryByTestId('question-card-q1')).toBeNull();
      expect(screen.getByTestId('question-card-q2')).toBeTruthy();
      expect(screen.queryByTestId('question-card-q3')).toBeNull();

      // Click "Xem tất cả" to restore
      const showAllBtn = screen.getByText(/Xem tất cả/i);
      fireEvent.click(showAllBtn);
      expect(screen.getByTestId('question-card-q1')).toBeTruthy();
      expect(screen.getByTestId('question-card-q2')).toBeTruthy();
      expect(screen.getByTestId('question-card-q3')).toBeTruthy();
    });

    it('100% correct renders "Không có câu sai cần ôn tập!" state without broken HTML', () => {
      const perfectModel: ListeningResultModel = {
        ...mockModel,
        correctCount: 3,
        incorrectCount: 0,
        accuracy: 100,
        score: 100,
        classification: 'Excellent',
        wrongQuestionIndexes: [],
      };

      render(
        <ListeningResultSummary
          result={perfectModel}
          onReviewQuestions={vi.fn()}
          onRetry={vi.fn()}
        />
      );

      const needsReview = screen.getByTestId('needs-review-section');
      expect(needsReview.textContent).toContain('Không có câu sai cần ôn tập! (No mistakes to review)');
      expect(screen.queryByTestId('btn-filter-mistakes')).toBeNull();
    });
  });

  // =========================================================================
  // 3. Integration, Retry Flow & Data Preservation
  // =========================================================================
  describe('3. Integration, Retry Flow & Historical Data Preservation', () => {
    it('complete -> Listen Again resets UI attempt state while preserving historical scores and mistakes', () => {
      render(<FourSkillsView />);

      const lessonCard = screen.getByText('Sprint Planning & Scope Negotiation in Agile Teams');
      fireEvent.click(lessonCard);

      // Answer all 6 questions (5 correct, 1 wrong)
      fireEvent.click(screen.getByText(/Product proposed three major payment features/i));
      fireEvent.click(screen.getByText(/The database connection pool reached nearly 80% utilization/i));
      fireEvent.click(screen.getByText(/Biometric eye-retina scanning payments/i));
      fireEvent.click(screen.getByText(/Expanding the project to hire more personnel/i)); // Wrong
      fireEvent.click(screen.getByText(/It is a mandatory financial security standard/i));
      fireEvent.click(screen.getByText(/Standard credit card transactions, webhook idempotency/i));

      // Submit
      fireEvent.click(screen.getByText('Nộp Bài Kiểm Tra (+30 XP)'));
      expect(screen.getByTestId('listening-result-summary')).toBeTruthy();

      // Verify store recorded first attempt
      const storeAfterFirstSubmit = useAppStore.getState();
      expect(storeAfterFirstSubmit.fourSkillsScores.listening).toEqual([83]);
      expect(Object.keys(storeAfterFirstSubmit.mistakeBank).length).toBe(1);
      const initialXP = storeAfterFirstSubmit.profile.xp;

      // Click "Làm Lại Bài Kiểm Tra (Listen Again)"
      const retryBtn = screen.getByTestId('btn-retry-quiz');
      fireEvent.click(retryBtn);

      // 1. UI attempt state is cleanly reset
      expect(screen.queryByTestId('listening-result-summary')).toBeNull();
      expect(screen.getByText('Nộp Bài Kiểm Tra (+30 XP)')).toBeTruthy();

      // 2. Historical learning data strictly preserved (not wiped!)
      const storeAfterRetry = useAppStore.getState();
      expect(storeAfterRetry.fourSkillsScores.listening).toEqual([83]);
      expect(Object.keys(storeAfterRetry.mistakeBank).length).toBe(1);
      expect(storeAfterRetry.profile.xp).toBe(initialXP);

      // 3. Can complete new attempt and record new session score idempotently
      fireEvent.click(screen.getByText(/Product proposed three major payment features/i));
      fireEvent.click(screen.getByText(/The database connection pool reached nearly 80% utilization/i));
      fireEvent.click(screen.getByText(/Biometric eye-retina scanning payments/i));
      fireEvent.click(screen.getByText(/Reducing or narrowing the features included in the immediate release/i)); // Correct
      fireEvent.click(screen.getByText(/It is a mandatory financial security standard/i));
      fireEvent.click(screen.getByText(/Standard credit card transactions, webhook idempotency/i));

      fireEvent.click(screen.getByText('Nộp Bài Kiểm Tra (+30 XP)'));

      // Both attempts preserved in score history
      expect(useAppStore.getState().fourSkillsScores.listening).toEqual([83, 100]);
    }, 15000);

    it('back to lessons returns cleanly to catalog without duplicate score persistence', () => {
      render(<FourSkillsView />);

      const lessonCard = screen.getByText('Sprint Planning & Scope Negotiation in Agile Teams');
      fireEvent.click(lessonCard);

      // Answer and submit
      fireEvent.click(screen.getByText(/Product proposed three major payment features/i));
      fireEvent.click(screen.getByText(/The database connection pool reached nearly 80% utilization/i));
      fireEvent.click(screen.getByText(/Biometric eye-retina scanning payments/i));
      fireEvent.click(screen.getByText(/Expanding the project to hire more personnel/i));
      fireEvent.click(screen.getByText(/It is a mandatory financial security standard/i));
      fireEvent.click(screen.getByText(/Standard credit card transactions, webhook idempotency/i));

      fireEvent.click(screen.getByText('Nộp Bài Kiểm Tra (+30 XP)'));
      expect(screen.getByTestId('listening-result-summary')).toBeTruthy();

      // Click "Quay lại kho bài nghe"
      const backBtn = screen.getByTestId('btn-back-to-catalog');
      fireEvent.click(backBtn);

      // Clean catalog view is displayed
      expect(screen.queryByTestId('listening-result-summary')).toBeNull();
      expect(screen.getByText('Sprint Planning & Scope Negotiation in Agile Teams')).toBeTruthy();

      // No second score recorded
      expect(useAppStore.getState().fourSkillsScores.listening).toEqual([83]);
    }, 15000);
  });
});
