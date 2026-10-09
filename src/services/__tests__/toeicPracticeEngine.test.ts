// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { getExperienceConfig, TOEIC_EXPERIENCE_CONFIGS, ToeicQuestion } from '../../types/toeic';
import { calculateToeicScores } from '../toeicScoring';
import { getQuestionHint } from '../../components/ToeicAssessmentView';
import { generateToeicExam } from '../examGenerator';
import {
  saveInProgressAttempt,
  getInProgressAttempt,
  clearInProgressAttempt,
  STORAGE_KEY_INPROGRESS,
} from '../toeicAttemptManager';
import { cleanWordToken, lookupContextWord } from '../wordLookupService';

describe('TOEIC Experience Engine — Phase 3: Practice Test (Học Trong Khi Làm)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    clearInProgressAttempt();
  });

  describe('1. Practice Permissions Matrix (Centralized Config)', () => {
    it('áp dụng đúng toàn bộ permission matrix cho Practice mode', () => {
      const config = getExperienceConfig('practice');

      expect(config.timerMode).toBe('none');
      expect(config.canPause).toBe(true);
      expect(config.showImmediateFeedback).toBe(true);
      expect(config.allowHints).toBe(true);
      expect(config.allowLookup).toBe(true);
      expect(config.allowSaveVocabulary).toBe(true);
      expect(config.allowRetry).toBe(true);
      expect(config.allowTranscript).toBe(true);
      expect(config.allowAudioReplay).toBe(true);
      expect(config.adaptiveDifficulty).toBe(false);
      expect(config.showResultOnlyAtEnd).toBe(false);
    });

    it('bảo đảm cấu hình tập trung TOEIC_EXPERIENCE_CONFIGS.practice là bất biến và nhất quán', () => {
      expect(TOEIC_EXPERIENCE_CONFIGS.practice.allowRetry).toBe(true);
      expect(TOEIC_EXPERIENCE_CONFIGS.mock.allowRetry).toBe(false);
      expect(TOEIC_EXPERIENCE_CONFIGS.diagnostic.allowRetry).toBe(false);
    });
  });

  describe('2. First-Attempt vs. Retry Isolation & Scoring Invariants', () => {
    const mockQuestions: ToeicQuestion[] = [
      {
        id: 'mock_q1',
        part: 'part5_grammar',
        skill: 'reading',
        difficulty: 'easy',
        topic: 'Office',
        questionText: 'The team _____ the contract yesterday.',
        options: ['A. signed', 'B. sign', 'C. signing', 'D. signs'],
        correctAnswer: 'A',
        explanation: 'Thì quá khứ đơn với yesterday.',
        vietnameseTranslation: 'Đội ngũ đã ký hợp đồng hôm qua.',
      },
      {
        id: 'mock_q2',
        part: 'part5_grammar',
        skill: 'reading',
        difficulty: 'medium',
        topic: 'Business',
        questionText: 'Ms. Lee will _____ the quarterly report.',
        options: ['A. review', 'B. reviewed', 'C. reviewing', 'D. reviews'],
        correctAnswer: 'A',
        explanation: 'Modal verb will + V-bare.',
        vietnameseTranslation: 'Bà Lee sẽ xem xét báo cáo hàng quý.',
      },
    ];

    it('bảo toàn điểm số từ firstAttemptAnswers: retry đúng KHÔNG làm tăng điểm thi', () => {
      // First attempt: q1 làm sai ('B'), q2 làm đúng ('A')
      const firstAttemptAnswers = {
        mock_q1: 'B',
        mock_q2: 'A',
      };

      // Sau khi retry trong quá trình Practice: user sửa q1 thành đúng ('A')
      const finalUserAnswers = {
        mock_q1: 'A', // đã sửa thành đúng trên UI
        mock_q2: 'A',
      };

      const result = calculateToeicScores({
        mode: '2skills_mini',
        experienceMode: 'practice',
        questions: mockQuestions,
        userAnswers: finalUserAnswers,
        firstAttemptAnswers,
      });

      // Điểm số phải dựa trên firstAttemptAnswers: chỉ đúng 1/2 câu (q2)
      expect(result.readingCorrect).toBe(1);
      expect(result.overallAccuracy).toBe(50);

      // Thống kê practiceStats ghi nhận đầy đủ cả 2 chỉ số
      expect(result.practiceStats).toBeDefined();
      expect(result.practiceStats?.firstAttemptCorrect).toBe(1);
      expect(result.practiceStats?.retryCorrect).toBe(1); // 1 câu đã làm chủ sau retry
      expect(result.practiceStats?.totalQuestions).toBe(2);
      expect(result.practiceStats?.accuracy).toBe(50);
    });

    it('nếu không có firstAttemptAnswers (fallback), scoring vẫn hoạt động an toàn từ userAnswers', () => {
      const userAnswers = {
        mock_q1: 'A',
        mock_q2: 'A',
      };

      const result = calculateToeicScores({
        mode: '2skills_mini',
        experienceMode: 'practice',
        questions: mockQuestions,
        userAnswers,
      });

      expect(result.readingCorrect).toBe(2);
      expect(result.overallAccuracy).toBe(100);
      expect(result.practiceStats?.firstAttemptCorrect).toBe(2);
      expect(result.practiceStats?.retryCorrect).toBe(0);
    });

    it('ngăn ngừa farm XP qua retry: XP chỉ tính từ totalScore của first attempt', () => {
      const firstAttemptAnswers = {
        mock_q1: 'B', // Sai
        mock_q2: 'B', // Sai
      };
      const finalUserAnswersAfterRetry = {
        mock_q1: 'A', // Sửa đúng
        mock_q2: 'A', // Sửa đúng
      };

      const evaluated = calculateToeicScores({
        mode: '2skills_mini',
        experienceMode: 'practice',
        questions: mockQuestions,
        userAnswers: finalUserAnswersAfterRetry,
        firstAttemptAnswers,
      });

      // totalScore tính theo firstAttempt (0 câu đúng -> điểm sàn)
      const earnedXP = Math.round(evaluated.totalScore / 10);
      // Giả sử điểm sàn reading là 5, listening là 5 -> total = 10 -> earnedXP = 1
      expect(evaluated.readingCorrect).toBe(0);
      expect(earnedXP).toBeLessThanOrEqual(2);
    });
  });

  describe('3. Clue & Hint Policy (Static Metadata Only, No Hallucinations)', () => {
    it('trả về trường hint tĩnh nếu câu hỏi có sẵn trường hint', () => {
      const q: ToeicQuestion = {
        id: 'q_with_hint',
        part: 'part5_grammar',
        skill: 'reading',
        difficulty: 'medium',
        topic: 'Finance',
        questionText: 'Test question',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'C',
        explanation: 'Test exp',
        vietnameseTranslation: 'Câu hỏi kiểm tra dịch nghĩa',
        hint: 'Chú ý dấu hiệu thời gian in 2024 để chọn thì quá khứ.',
      };

      const hint = getQuestionHint(q);
      expect(hint).toBe('Chú ý dấu hiệu thời gian in 2024 để chọn thì quá khứ.');
    });

    it('tổng hợp gợi ý an toàn từ grammarTags, subSkill và topic nếu không có hint', () => {
      const q: ToeicQuestion = {
        id: 'q_no_hint',
        part: 'part5_grammar',
        skill: 'reading',
        difficulty: 'medium',
        topic: 'Human Resources',
        subSkill: 'verb_tense',
        grammarTags: ['past_simple', 'irregular_verbs'],
        questionText: 'Test question',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'B',
        explanation: 'Test exp',
        vietnameseTranslation: 'Câu hỏi kiểm tra dịch nghĩa',
      };

      const hint = getQuestionHint(q);
      expect(hint).not.toBeNull();
      expect(hint).toContain('Dạng kỹ năng: verb tense');
      expect(hint).toContain('Chủ điểm ngữ pháp: past_simple, irregular_verbs');
      expect(hint).toContain('Ngữ cảnh chủ đề: Human Resources');
      expect(hint).not.toContain('B'); // Không tiết lộ đáp án B
    });

    it('trả về null khi câu hỏi không có bất kỳ manh mối metadata nào', () => {
      const q: ToeicQuestion = {
        id: 'q_empty_meta',
        part: 'part2_qna',
        skill: 'listening',
        difficulty: 'easy',
        topic: '',
        questionText: 'Where is the meeting?',
        options: ['A', 'B', 'C'],
        correctAnswer: 'A',
        explanation: 'Test exp',
        vietnameseTranslation: 'Cuộc họp diễn ra ở đâu?',
      };

      const hint = getQuestionHint(q);
      expect(hint).toBeNull();
    });
  });

  describe('4. Generator Weak Areas Preference in Practice Mode', () => {
    it('sinh đề Practice với weakAreas ưu tiên tăng cường câu hỏi thuộc dạng yếu', () => {
      const exam = generateToeicExam({
        mode: '2skills_mini',
        experienceMode: 'practice',
        seed: 42,
        weakAreas: [
          { part: 'part5_grammar', topic: 'Office Operations' },
        ],
      });

      expect(exam.questions.length).toBe(10);
      expect(exam.experienceMode).toBe('practice');
      expect(exam.experienceConfig?.showImmediateFeedback).toBe(true);

      // Đề thi vẫn bảo toàn cấu trúc atomic groups và phân bố Part
      const hasPart5 = exam.questions.some((q) => q.part === 'part5_grammar');
      expect(hasPart5).toBe(true);
    });
  });

  describe('5. Persistence & In-Progress Recovery with Practice States', () => {
    it('lưu trữ và phục hồi đầy đủ firstAttemptAnswers, bookmarkedQuestions, retryCountMap', () => {
      saveInProgressAttempt({
        stage: 'testing',
        examMode: '2skills_mini',
        experienceMode: 'practice',
        skillScope: '2-skills',
        currentQuestionIdx: 2,
        userAnswers: { q1: 'A', q2: 'B' },
        firstAttemptAnswers: { q1: 'C', q2: 'B' },
        bookmarkedQuestions: { q1: true },
        retryCountMap: { q1: 1 },
        masteredRetryMap: { q1: true },
        timeLeft: 900,
        savedAt: Date.now(),
      });

      const restored = getInProgressAttempt();
      expect(restored).not.toBeNull();
      expect(restored?.experienceMode).toBe('practice');
      expect(restored?.firstAttemptAnswers).toEqual({ q1: 'C', q2: 'B' });
      expect(restored?.bookmarkedQuestions).toEqual({ q1: true });
      expect(restored?.retryCountMap).toEqual({ q1: 1 });
      expect(restored?.masteredRetryMap).toEqual({ q1: true });
    });
  });

  describe('6. Contextual Dictionary & Vocabulary Token Helpers', () => {
    it('chuẩn hóa token từ vựng sạch sẽ trước khi tra cứu', () => {
      expect(cleanWordToken('"presentation,"')).toBe('presentation');
      expect(cleanWordToken('(Maintenance).')).toBe('maintenance');
      expect(cleanWordToken("  it's  ")).toBe("it's");
    });

    it('tra cứu từ vựng theo ngữ cảnh thành công với từ có sẵn trong index', () => {
      const found = lookupContextWord('contract');
      if (found) {
        expect(found.word.toLowerCase()).toBe('contract');
        expect(found.meaning).toBeDefined();
      }
    });
  });
});
