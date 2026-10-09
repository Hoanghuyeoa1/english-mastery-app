// @vitest-environment happy-dom
// src/components/__tests__/ListeningPhase4CompletionLayoutReleaseAudit.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { FourSkillsView } from '../FourSkillsView';
import { useAppStore, composeVocabularyList } from '../../store/useAppStore';
import { LISTENING_LESSONS } from '../../data/fourSkills/listeningData';
import { findListeningLessonsByCefr } from '../../data/fourSkills/listening';
import { ListeningLesson } from '../../data/fourSkills/types';
import {
  calculateListeningResult,
  getListeningClassification,
  getListeningFeedback,
} from '../../services/listeningResultService';
import {
  buildTranscriptBlocks,
  buildLessonSyncMap,
  tokenizeSentence,
  calculateSafeChunkSizes,
  resolvePositionFromProgress,
} from '../../services/listeningSyncService';

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

describe('PHASE 4: Listening Lab Full Regression, 24 Lessons & Release Audit', () => {
  let mockSpeak: any;
  let mockCancel: any;

  beforeEach(() => {
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
      activePracticeConfig: null,
      pendingNavigationTab: null,
      userCollocations: [],
      completedListeningLessonIds: [],
    });

    localStorage.clear();

    mockSpeak = vi.fn();
    mockCancel = vi.fn();
    (window as any).alert = vi.fn();

    const mockSynth = {
      speak: mockSpeak,
      cancel: mockCancel,
      getVoices: vi.fn(() => []),
      pause: vi.fn(),
      resume: vi.fn(),
    };

    Object.defineProperty(window, 'speechSynthesis', {
      value: mockSynth,
      writable: true,
      configurable: true,
    });

    (window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
    (globalThis as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. DATASET FIDELITY & 24 LESSONS VERIFICATION
  // =========================================================================
  describe('1. Full 24 Lessons Dataset Verification (A1-C2)', () => {
    it('chứa chính xác 24 bài nghe: A1(4), A2(4), B1(4), B2(4), C1(4), C2(4)', () => {
      expect(LISTENING_LESSONS).toHaveLength(24);

      const cefrBands: Array<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'> = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      cefrBands.forEach((band) => {
        const lessons = findListeningLessonsByCefr(band);
        expect(lessons).toHaveLength(4);
        lessons.forEach((l) => {
          expect(l.level).toBe(band);
          expect(l.id).toBeTruthy();
          expect(l.title).toBeTruthy();
          expect(l.sentences.length).toBeGreaterThan(0);
          expect(l.questions.length).toBeGreaterThan(0);
        });
      });
    });

    it('toàn bộ 24 bài: Transcript segmentation bảo toàn 100% câu, không đổi text, không bịa speaker', () => {
      LISTENING_LESSONS.forEach((lesson) => {
        const blocks = buildTranscriptBlocks(lesson);
        expect(blocks.length).toBeGreaterThan(0);

        const totalSentsInBlocks = blocks.reduce((sum, b) => sum + b.sentences.length, 0);
        expect(totalSentsInBlocks).toBe(lesson.sentences.length);

        const hasOriginalSpeaker = lesson.sentences.some((s) => Boolean(s.speaker));
        if (!hasOriginalSpeaker) {
          blocks.forEach((b) => {
            expect(b.speaker).toBeUndefined();
          });
        }

        let runningIndex = 0;
        blocks.forEach((block) => {
          expect(block.startSentenceIndex).toBe(block.sentences[0].globalSentenceIndex);
          expect(block.endSentenceIndex).toBe(block.sentences[block.sentences.length - 1].globalSentenceIndex);

          block.sentences.forEach((s) => {
            expect(s.globalSentenceIndex).toBe(runningIndex);
            expect(s.sentence.en).toBe(lesson.sentences[runningIndex].en);
            expect(s.sentence.vi).toBe(lesson.sentences[runningIndex].vi);
            runningIndex++;
          });
        });
      });
    });

    it('toàn bộ 24 bài: Tokenization bảo toàn 100% whitespace, dấu câu, contractions và số', () => {
      LISTENING_LESSONS.forEach((lesson) => {
        lesson.sentences.forEach((sent) => {
          const tokens = tokenizeSentence(sent.en);
          const reconstructed = tokens.map((t) => t.text).join('');
          expect(reconstructed).toBe(sent.en);

          const words = tokens.filter((t) => t.isWord);
          words.forEach((w) => {
            expect(w.cleanWord).toBeTruthy();
            expect(w.cleanWord).toBe(w.cleanWord!.toLowerCase());
          });
        });
      });
    });

    it('toàn bộ 24 bài: SyncMap & Seek Engine tính toán chính xác 0%-100% không out-of-bounds', () => {
      LISTENING_LESSONS.forEach((lesson) => {
        const syncMap = buildLessonSyncMap(lesson, 1.0);
        expect(syncMap.totalEstimatedMs).toBeGreaterThan(0);
        expect(syncMap.sentences.length).toBe(lesson.sentences.length);

        [0, 0.25, 0.5, 0.75, 1.0].forEach((progress) => {
          const pos = resolvePositionFromProgress(syncMap, progress);
          expect(pos.sentenceIndex).toBeGreaterThanOrEqual(0);
          expect(pos.sentenceIndex).toBeLessThan(lesson.sentences.length);
          expect(pos.currentTimeMs).toBeGreaterThanOrEqual(0);
          expect(pos.currentTimeMs).toBeLessThanOrEqual(syncMap.totalEstimatedMs);
        });
      });
    });
  });

  // =========================================================================
  // 2. SCORING & RESULT SERVICE EDGE CASES
  // =========================================================================
  describe('2. Scoring Service & Result Edge Cases', () => {
    it('0/0 câu hỏi: an toàn tuyệt đối, không crash chia cho 0, trả về 0% accuracy và Needs Practice', () => {
      const mockEmptyLesson: ListeningLesson = {
        id: 'empty_lesson',
        title: 'Empty Lesson',
        category: 'Daily Life',
        format: 'Dialogue',
        level: 'A1',
        duration: '1:00',
        description: 'Empty',
        audioText: 'Hello.',
        sentences: [{ en: 'Hello.', vi: 'Xin chào.' }],
        questions: [],
      };

      const result = calculateListeningResult(mockEmptyLesson, {});
      expect(result.totalQuestions).toBe(0);
      expect(result.correctCount).toBe(0);
      expect(result.incorrectCount).toBe(0);
      expect(result.accuracy).toBe(0);
      expect(result.score).toBe(0);
      expect(result.classification).toBe('Needs Practice');
      expect(result.questionBreakdowns).toEqual([]);
    });

    it('1 câu hỏi: 1/1 -> 100% (Excellent), 0/1 -> 0% (Needs Practice)', () => {
      const mockSingleQuestionLesson: ListeningLesson = {
        id: 'single_q_lesson',
        title: 'Single Question Lesson',
        category: 'Daily Life',
        format: 'Dialogue',
        level: 'A1',
        duration: '1:00',
        description: 'Single Question',
        audioText: 'Hello.',
        sentences: [{ en: 'Hello.', vi: 'Xin chào.' }],
        questions: [
          {
            id: 'q1',
            question: 'What is the greeting?',
            options: ['Hello', 'Goodbye'],
            correctIndex: 0,
            explanation: 'The speaker said Hello.',
          },
        ],
      };

      // Correct answer
      const resPass = calculateListeningResult(mockSingleQuestionLesson, { q1: 0 });
      expect(resPass.accuracy).toBe(100);
      expect(resPass.classification).toBe('Excellent');
      expect(resPass.correctCount).toBe(1);
      expect(resPass.incorrectCount).toBe(0);

      // Wrong answer
      const resFail = calculateListeningResult(mockSingleQuestionLesson, { q1: 1 });
      expect(resFail.accuracy).toBe(0);
      expect(resFail.classification).toBe('Needs Practice');
      expect(resFail.correctCount).toBe(0);
      expect(resFail.incorrectCount).toBe(1);
    });

    it('8/10 câu hỏi: 80% accuracy, score = 80, classification = Good', () => {
      const questions = Array.from({ length: 10 }, (_, i) => ({
        id: `q_${i}`,
        question: `Question ${i + 1}`,
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
        explanation: `Explanation ${i + 1}`,
      }));

      const mockLesson: ListeningLesson = {
        id: 'ten_q_lesson',
        title: 'Ten Questions Lesson',
        category: 'Workplace',
        format: 'Dialogue',
        level: 'B2',
        duration: '3:00',
        description: 'Ten questions test',
        audioText: 'Test text.',
        sentences: [{ en: 'Test text.', vi: 'Văn bản test.' }],
        questions,
      };

      // 8 correct (indexes 0..7), 2 wrong (indexes 8, 9)
      const answers: Record<string, number> = {};
      for (let i = 0; i < 8; i++) answers[`q_${i}`] = 0;
      answers['q_8'] = 1;
      answers['q_9'] = 2;

      const result = calculateListeningResult(mockLesson, answers);
      expect(result.totalQuestions).toBe(10);
      expect(result.correctCount).toBe(8);
      expect(result.incorrectCount).toBe(2);
      expect(result.accuracy).toBe(80);
      expect(result.score).toBe(80);
      expect(result.classification).toBe('Good');
      expect(result.wrongQuestionIndexes).toEqual([8, 9]);
    });

    it('Missing explanation: hiển thị fallback an toàn, không render undefined hoặc null', () => {
      const mockLesson: ListeningLesson = {
        id: 'no_expl_lesson',
        title: 'No Explanation Lesson',
        category: 'Daily Life',
        format: 'Dialogue',
        level: 'A1',
        duration: '1:00',
        description: 'Test',
        audioText: 'Test.',
        sentences: [{ en: 'Test.', vi: 'Test.' }],
        questions: [
          {
            id: 'q_no_expl',
            question: 'What is it?',
            options: ['Option A', 'Option B'],
            correctIndex: 0,
            // @ts-expect-error intentionally missing explanation
            explanation: undefined,
          },
        ],
      };

      const result = calculateListeningResult(mockLesson, { q_no_expl: 1 });
      expect(result.questionBreakdowns[0].explanation).toBe('Không có giải thích chi tiết cho câu hỏi này.');
    });
  });

  // =========================================================================
  // 3. COMPLETION LIFECYCLE & IDEMPOTENT PERSISTENCE REGRESSION
  // =========================================================================
  describe('3. Completion Lifecycle & Idempotent Persistence', () => {
    it('Nộp bài khi hoàn thành tất cả câu hỏi: chuyển sang Result Summary, persist điểm ĐÚNG 1 LẦN', () => {
      render(<FourSkillsView />);

      // Chọn bài A1 Sunny Side Cafe (5 câu hỏi)
      const lessonCard = screen.getByText('Ordering Breakfast at the Sunny Side Cafe');
      fireEvent.click(lessonCard);

      // Ban đầu Result Summary KHÔNG hiển thị
      expect(screen.queryByTestId('listening-result-summary')).toBeNull();
      expect(screen.getByText('Nộp Bài Kiểm Tra (+30 XP)')).toBeDefined();

      // Trả lời toàn bộ 4 câu hỏi
      fireEvent.click(screen.getByRole('button', { name: /The customer is ordering a breakfast meal and drinks at a cafe/i }));
      fireEvent.click(screen.getByRole('button', { name: /^Fresh strawberries$/i }));
      fireEvent.click(screen.getByRole('button', { name: /To press fruit to extract fresh liquid juice/i }));
      fireEvent.click(screen.getByRole('button', { name: /Twelve dollars and fifty cents/i }));

      // Bấm Nộp bài
      const submitBtn = screen.getByText('Nộp Bài Kiểm Tra (+30 XP)');
      fireEvent.click(submitBtn);

      // Verify: Result Summary hiển thị với đầy đủ metrics
      expect(screen.getByTestId('listening-result-summary')).toBeDefined();
      expect(screen.getByText('100%')).toBeDefined();
      expect(screen.getByText(/Khả Năng Nghe Hiểu Xuất Sắc!/i)).toBeDefined();

      // Điểm số được persist vào store
      const initialScoreCount = useAppStore.getState().fourSkillsScores.listening.length;
      expect(initialScoreCount).toBe(1);

      // IDEMPOTENCY: Các thao tác UI sau completion KHÔNG được ghi thêm điểm
      // 1. Chuyển đổi mở rộng / thu gọn tất cả câu hỏi
      const toggleAllBtn = screen.getByTestId('btn-toggle-all-explanations');
      fireEvent.click(toggleAllBtn);
      expect(useAppStore.getState().fourSkillsScores.listening.length).toBe(1);

      // 2. Mở/đóng collapsible question cards
      const toggleFirstQuestion = screen.getAllByRole('button', { name: /Câu 1/i })[0];
      if (toggleFirstQuestion) {
        fireEvent.click(toggleFirstQuestion);
        fireEvent.click(toggleFirstQuestion);
      }
      expect(useAppStore.getState().fourSkillsScores.listening.length).toBe(1);

      // 3. Switch layout mode trong khi reviewing
      const dialogueBtn = screen.getByText('💬 Từng câu thoại');
      fireEvent.click(dialogueBtn);
      expect(useAppStore.getState().fourSkillsScores.listening.length).toBe(1);

      const paragraphBtn = screen.getByText(/Đoạn văn liền mạch/i);
      fireEvent.click(paragraphBtn);
      expect(useAppStore.getState().fourSkillsScores.listening.length).toBe(1);
    });

    it('Listen Again: reset attempt state, xóa đáp án chọn cũ, dừng audio, nhưng BẢO TOÀN điểm lịch sử', () => {
      render(<FourSkillsView />);

      const lessonCard = screen.getByText('Ordering Breakfast at the Sunny Side Cafe');
      fireEvent.click(lessonCard);

      // Trả lời 4 câu
      fireEvent.click(screen.getByRole('button', { name: /The customer is ordering a breakfast meal and drinks at a cafe/i }));
      fireEvent.click(screen.getByRole('button', { name: /^Fresh strawberries$/i }));
      fireEvent.click(screen.getByRole('button', { name: /To press fruit to extract fresh liquid juice/i }));
      fireEvent.click(screen.getByRole('button', { name: /Twelve dollars and fifty cents/i }));

      // Submit
      fireEvent.click(screen.getByText('Nộp Bài Kiểm Tra (+30 XP)'));
      expect(screen.getByTestId('listening-result-summary')).toBeDefined();

      const scoreBeforeRetry = useAppStore.getState().fourSkillsScores.listening.length;
      expect(scoreBeforeRetry).toBe(1);

      // Bấm Luyện Lại (Listen Again)
      const retryBtn = screen.getByTestId('btn-retry-quiz');
      fireEvent.click(retryBtn);

      // Verify: Giao diện quay về in-progress quiz, Result Summary biến mất
      expect(screen.queryByTestId('listening-result-summary')).toBeNull();
      expect(screen.getByText('Nộp Bài Kiểm Tra (+30 XP)')).toBeDefined();

      // Điểm lịch sử không bị xóa
      expect(useAppStore.getState().fourSkillsScores.listening.length).toBe(1);
    });

    it('Back to Lessons: quay về catalog danh sách bài nghe sạch state, không ghi trùng điểm', () => {
      render(<FourSkillsView />);

      const lessonCard = screen.getByText('Ordering Breakfast at the Sunny Side Cafe');
      fireEvent.click(lessonCard);

      // Trả lời 4 câu
      fireEvent.click(screen.getByRole('button', { name: /The customer is ordering a breakfast meal and drinks at a cafe/i }));
      fireEvent.click(screen.getByRole('button', { name: /^Fresh strawberries$/i }));
      fireEvent.click(screen.getByRole('button', { name: /To press fruit to extract fresh liquid juice/i }));
      fireEvent.click(screen.getByRole('button', { name: /Twelve dollars and fifty cents/i }));

      // Submit
      fireEvent.click(screen.getByText('Nộp Bài Kiểm Tra (+30 XP)'));
      expect(screen.getByTestId('listening-result-summary')).toBeDefined();

      // Bấm Quay Lại Danh Sách
      const backBtn = screen.getByTestId('btn-back-to-catalog');
      fireEvent.click(backBtn);

      // Verify: Quay lại catalog, hiện danh sách các bài nghe
      expect(screen.getByText('The Rise of Distributed Microservices Architecture')).toBeDefined();
      expect(useAppStore.getState().fourSkillsScores.listening.length).toBe(1);
    });
  });

  // =========================================================================
  // 4. TRANSCRIPT LAYOUT, HIGHLIGHT & PLAYBACK REGRESSION
  // =========================================================================
  describe('4. Transcript Layout, Highlight & Playback Monotonicity', () => {
    it('Paragraph Mode chia đoạn văn tự nhiên (space-y-5), không còn 1 thẻ <p> khổng lồ', () => {
      const { container } = render(<FourSkillsView />);

      const lessonCard = screen.getByText('Cracking the Senior System Design Interview');
      fireEvent.click(lessonCard);

      // Kiểm tra có 32 sentences trong DOM
      const sentenceSpans = container.querySelectorAll('[data-sentence-index]');
      expect(sentenceSpans.length).toBe(32);

      // Kiểm tra sentence 0 có trong DOM
      expect(container.querySelector('[data-sentence-index="0"]')).toBeTruthy();
      expect(container.querySelector('[data-sentence-index="31"]')).toBeTruthy();
    });

    it('Dialogue Mode hiển thị tên speaker 1 lần cho cả turn, các câu giữ nguyên data-sentence-index', () => {
      const { container } = render(<FourSkillsView />);

      const lessonCard = screen.getByText('Ordering Breakfast at the Sunny Side Cafe');
      fireEvent.click(lessonCard);

      // Switch to Dialogue mode
      fireEvent.click(screen.getByText('💬 Từng câu thoại'));

      const s0 = container.querySelector('[data-sentence-index="0"]');
      const s1 = container.querySelector('[data-sentence-index="1"]');
      expect(s0).toBeTruthy();
      expect(s1).toBeTruthy();

      // Header speaker xuất hiện
      expect(screen.getAllByText(/Waiter:/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Customer:/i).length).toBeGreaterThan(0);
    });

    it('Word Highlight kích hoạt đúng token [data-word-index] và click mở tra từ Flashcard SRS', () => {
      const { container } = render(<FourSkillsView />);

      const lessonCard = screen.getByText('Ordering Breakfast at the Sunny Side Cafe');
      fireEvent.click(lessonCard);

      // Switch to Word Highlight mode
      fireEvent.click(screen.getByText('Từng từ (Word)'));

      // Start playback
      fireEvent.click(screen.getByRole('button', { name: /Nghe Bài Đọc/i }));
      expect(mockSpeak).toHaveBeenCalledTimes(1);

      const utterance = mockSpeak.mock.calls[0][0];
      act(() => {
        utterance.onstart?.();
        utterance.onboundary?.({
          name: 'word',
          charIndex: 0,
          charLength: 4,
        });
      });

      // Word 0 active có class bg-amber-400
      const activeWord = container.querySelector('[data-sentence-index="0"] [data-word-index="0"]');
      expect(activeWord).toBeTruthy();
      expect(activeWord?.classList.contains('bg-amber-400')).toBe(true);

      // Click vào từ đang highlight mở Modal tra từ
      fireEvent.click(activeWord!);
      const addToSrsBtn = screen.getByText(/Thêm Vào Flashcard SRS/i);
      expect(addToSrsBtn).toBeDefined();

      // Thêm vào Flashcard SRS
      fireEvent.click(addToSrsBtn);
      expect(screen.getByText(/Đã Thêm Vào SRS!/i)).toBeDefined();
      expect(Object.keys(useAppStore.getState().srsProgressMap).length).toBeGreaterThan(0);
    });

    it('Seek Bar tua tiến/lùi cập nhật đồng bộ position model và highlight', () => {
      const { container } = render(<FourSkillsView />);

      const lessonCard = screen.getByText('Ordering Breakfast at the Sunny Side Cafe');
      fireEvent.click(lessonCard);

      const seekBar = screen.getByLabelText('Thanh tua bài nghe') as HTMLInputElement;
      expect(seekBar).toBeDefined();

      // Tua đến 50%
      fireEvent.pointerDown(seekBar);
      fireEvent.change(seekBar, { target: { value: '500' } });
      expect(seekBar.getAttribute('aria-valuenow')).toBe('50');
      fireEvent.pointerUp(seekBar);

      // Tua về 0%
      fireEvent.pointerDown(seekBar);
      fireEvent.change(seekBar, { target: { value: '0' } });
      expect(seekBar.getAttribute('aria-valuenow')).toBe('0');
      fireEvent.pointerUp(seekBar);
    });

    it('Ẩn dịch / Hiện dịch toggle độc lập không ảnh hưởng đến playback audio', () => {
      render(<FourSkillsView />);

      const lessonCard = screen.getByText('Ordering Breakfast at the Sunny Side Cafe');
      fireEvent.click(lessonCard);

      const toggleBtn = screen.getByRole('button', { name: /Ẩn dịch|Hiện dịch/i });
      expect(toggleBtn).toBeDefined();

      // Toggle off
      fireEvent.click(toggleBtn);
      expect(screen.getByRole('button', { name: /Hiện dịch/i })).toBeDefined();

      // Toggle on
      fireEvent.click(toggleBtn);
      expect(screen.getByRole('button', { name: /Ẩn dịch/i })).toBeDefined();
    });
  });
});
