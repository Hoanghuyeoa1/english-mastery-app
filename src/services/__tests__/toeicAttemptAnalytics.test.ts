// src/services/__tests__/toeicAttemptAnalytics.test.ts
import { describe, it, expect } from 'vitest';
import { buildToeicAttemptAnalytics } from '../toeicAttemptAnalytics';
import { ToeicQuestion, ToeicPart } from '../../types/toeic';
import { TOEIC_QUESTION_BANK } from '../../data/toeicQuestionsData';
import { calculateToeicScores } from '../toeicScoring';

describe('TOEIC Attempt Analytics Foundation (Phase 1)', () => {
  // Mock questions helper
  const createMockQuestion = (overrides: Partial<ToeicQuestion>): ToeicQuestion => ({
    id: 'mock_q_1',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'medium',
    subSkill: 'grammar_tense',
    questionType: 'grammar_pos',
    questionText: 'The project manager ____ the report yesterday.',
    options: ['A. submits', 'B. submitted', 'C. submitting', 'D. submit'],
    correctAnswer: 'B',
    explanation: 'Dùng quá khứ đơn vì có yesterday.',
    vietnameseTranslation: 'Quản lý dự án đã nộp báo cáo hôm qua.',
    ...overrides,
  });

  describe('1. Correct / Incorrect & Overall Aggregation', () => {
    it('tổng hợp chính xác số câu đúng, sai, chưa làm và accuracy cho câu hỏi trắc nghiệm', () => {
      const q1 = createMockQuestion({ id: 'q1', correctAnswer: 'A' });
      const q2 = createMockQuestion({ id: 'q2', correctAnswer: 'B' });
      const q3 = createMockQuestion({ id: 'q3', correctAnswer: 'C' });
      const q4 = createMockQuestion({ id: 'q4', correctAnswer: 'D' });

      // user làm: q1 đúng, q2 sai, q3 chưa làm, q4 đúng
      const userAnswers = {
        q1: 'A',
        q2: 'C',
        q4: 'D',
      };

      const analytics = buildToeicAttemptAnalytics({
        attemptId: 'attempt_101',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions: [q1, q2, q3, q4],
        userAnswers,
        durationMinutes: 15,
        timeSpentSeconds: 450,
      });

      expect(analytics.overall.totalItems).toBe(4);
      expect(analytics.overall.objectiveCount).toBe(4);
      expect(analytics.overall.openEndedCount).toBe(0);
      expect(analytics.overall.attemptedCount).toBe(3);
      expect(analytics.overall.unansweredCount).toBe(1);
      expect(analytics.overall.correctCount).toBe(2);
      expect(analytics.overall.incorrectCount).toBe(1);
      expect(analytics.overall.accuracy).toBe(50); // 2 / 4 = 50%
      expect(analytics.overall.completionRate).toBe(75); // 3 / 4 = 75%
      expect(analytics.overall.durationSeconds).toBe(900);
      expect(analytics.overall.timeSpentSeconds).toBe(450);
    });

    it('tính toán chính xác khi thí sinh bỏ qua (SKIPPED) câu hỏi', () => {
      const q1 = createMockQuestion({ id: 'q1', correctAnswer: 'A' });
      const userAnswers = { q1: 'SKIPPED' };

      const analytics = buildToeicAttemptAnalytics({
        attemptId: 'attempt_skip',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions: [q1],
        userAnswers,
      });

      expect(analytics.overall.attemptedCount).toBe(0);
      expect(analytics.overall.unansweredCount).toBe(1);
      expect(analytics.overall.correctCount).toBe(0);
      expect(analytics.overall.incorrectCount).toBe(0);
      expect(analytics.overall.accuracy).toBe(0);
    });
  });

  describe('2. Skill Breakdown (Objective vs Open-Ended Separation)', () => {
    it('phân tích chính xác kỹ năng Listening & Reading và tích hợp điểm scaled', () => {
      const l1 = createMockQuestion({ id: 'l1', skill: 'listening', part: 'part1_photos', correctAnswer: 'A' });
      const l2 = createMockQuestion({ id: 'l2', skill: 'listening', part: 'part2_qna', correctAnswer: 'B' });
      const r1 = createMockQuestion({ id: 'r1', skill: 'reading', part: 'part5_grammar', correctAnswer: 'C' });

      const analytics = buildToeicAttemptAnalytics({
        attemptId: 'attempt_lr',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions: [l1, l2, r1],
        userAnswers: { l1: 'A', l2: 'C', r1: 'C' },
        scoreEvaluation: {
          listeningScore: 250,
          readingScore: 300,
          totalScore: 550,
        } as any,
      });

      const listening = analytics.bySkill.listening;
      expect(listening.isObjective).toBe(true);
      expect(listening.questionsSeen).toBe(2);
      expect(listening.attempted).toBe(2);
      expect(listening.correct).toBe(1);
      expect(listening.incorrect).toBe(1);
      expect(listening.accuracy).toBe(50);
      expect(listening.evidenceCount).toBe(2);
      expect(listening.scaledScore).toBe(250);

      const reading = analytics.bySkill.reading;
      expect(reading.isObjective).toBe(true);
      expect(reading.questionsSeen).toBe(1);
      expect(reading.attempted).toBe(1);
      expect(reading.correct).toBe(1);
      expect(reading.incorrect).toBe(0);
      expect(reading.accuracy).toBe(100);
      expect(reading.scaledScore).toBe(300);
    });

    it('kỹ năng Speaking & Writing tự luận mở: TUYỆT ĐỐI không fake accuracy (accuracy là null) và lưu rubric thật', () => {
      const sp1 = createMockQuestion({
        id: 'sp1',
        skill: 'speaking',
        part: 'speaking_read',
        correctAnswer: undefined,
        evaluationCriteria: { targetLengthWords: { min: 30, max: 60 } },
      });
      const wr1 = createMockQuestion({
        id: 'wr1',
        skill: 'writing',
        part: 'writing_email',
        correctAnswer: undefined,
        evaluationCriteria: { targetLengthWords: { min: 50, max: 100 } },
      });

      const analytics = buildToeicAttemptAnalytics({
        attemptId: 'attempt_sw',
        experienceMode: 'mock',
        skillScope: '4-skills',
        questions: [sp1, wr1],
        speakingTranscript: 'Hello and welcome to the corporate meeting at our branch.',
        writingText: 'Dear Mr. Smith, I am writing to confirm our appointment next Tuesday morning.',
        scoreEvaluation: {
          speakingScore: 160,
          speakingFeedback: 'Phát âm tốt, mạch lạc.',
          speakingEvaluation: { pronunciationScore: 50, fluencyScore: 55, contentScore: 55 },
          writingScore: 170,
          writingFeedback: 'Bố cục email chuẩn.',
          writingEvaluation: { grammarScore: 55, organizationScore: 55, vocabularyScore: 60 },
          totalSWScore: 330,
        } as any,
      });

      const speaking = analytics.bySkill.speaking;
      expect(speaking.isObjective).toBe(false);
      expect(speaking.accuracy).toBeNull(); // Không được là number!
      expect(speaking.hasEvidence).toBe(true);
      expect(speaking.evidenceCount).toBe(1);
      expect(speaking.score).toBe(160);
      expect(speaking.wordCount).toBeGreaterThan(5);
      expect(speaking.rubricScores?.pronunciationScore).toBe(50);

      const writing = analytics.bySkill.writing;
      expect(writing.isObjective).toBe(false);
      expect(writing.accuracy).toBeNull(); // Không được là number!
      expect(writing.hasEvidence).toBe(true);
      expect(writing.evidenceCount).toBe(1);
      expect(writing.score).toBe(170);
      expect(writing.wordCount).toBeGreaterThan(5);
      expect(writing.rubricScores?.grammarScore).toBe(55);
    });
  });

  describe('3. Part Breakdown (Part 1 - 7 + Speaking/Writing)', () => {
    it('gom nhóm đúng từng Part, tính toán accuracy và phân phối độ khó', () => {
      const p1 = createMockQuestion({ id: 'p1_1', part: 'part1_photos', difficulty: 'easy', estimatedDifficulty: 300, correctAnswer: 'A' });
      const p1_b = createMockQuestion({ id: 'p1_2', part: 'part1_photos', difficulty: 'medium', estimatedDifficulty: 400, correctAnswer: 'B' });
      const p5 = createMockQuestion({ id: 'p5_1', part: 'part5_grammar', difficulty: 'hard', estimatedDifficulty: 700, correctAnswer: 'C' });

      const analytics = buildToeicAttemptAnalytics({
        attemptId: 'attempt_parts',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions: [p1, p1_b, p5],
        userAnswers: { p1_1: 'A', p1_2: 'C', p5_1: 'C' },
      });

      const part1 = analytics.byPart.part1_photos;
      expect(part1).toBeDefined();
      expect(part1?.questionsSeen).toBe(2);
      expect(part1?.attempted).toBe(2);
      expect(part1?.correct).toBe(1);
      expect(part1?.incorrect).toBe(1);
      expect(part1?.accuracy).toBe(50);
      expect(part1?.averageDifficultyLevel).toBe(1.5); // (1 + 2) / 2 = 1.5
      expect(part1?.averageEstimatedDifficulty).toBe(350); // (300 + 400) / 2
      expect(part1?.difficultyDistribution.easy).toBe(1);
      expect(part1?.difficultyDistribution.medium).toBe(1);
      expect(part1?.difficultyDistribution.hard).toBe(0);

      const part5 = analytics.byPart.part5_grammar;
      expect(part5).toBeDefined();
      expect(part5?.questionsSeen).toBe(1);
      expect(part5?.correct).toBe(1);
      expect(part5?.accuracy).toBe(100);
      expect(part5?.averageDifficultyLevel).toBe(3); // hard = 3
    });
  });

  describe('4. Sub-Skill Breakdown (Metadata-Driven)', () => {
    it('suy luận subSkill động trực tiếp từ Question Bank metadata', () => {
      const q1 = createMockQuestion({ id: 'q1', subSkill: 'pronoun_reference', questionType: 'grammar_pronoun', correctAnswer: 'A' });
      const q2 = createMockQuestion({ id: 'q2', subSkill: 'pronoun_reference', questionType: 'grammar_pronoun', correctAnswer: 'B' });
      const q3 = createMockQuestion({ id: 'q3', subSkill: 'verb_tenses', questionType: 'grammar_tense', correctAnswer: 'C' });

      const analytics = buildToeicAttemptAnalytics({
        attemptId: 'attempt_subskills',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions: [q1, q2, q3],
        userAnswers: { q1: 'A', q2: 'C', q3: 'C' },
      });

      expect(analytics.bySubSkill['pronoun_reference']).toBeDefined();
      const pronounSub = analytics.bySubSkill['pronoun_reference'];
      expect(pronounSub.questionsSeen).toBe(2);
      expect(pronounSub.attempted).toBe(2);
      expect(pronounSub.correct).toBe(1);
      expect(pronounSub.incorrect).toBe(1);
      expect(pronounSub.accuracy).toBe(50);
      expect(pronounSub.questionTypes).toContain('grammar_pronoun');

      expect(analytics.bySubSkill['verb_tenses']).toBeDefined();
      const tenseSub = analytics.bySubSkill['verb_tenses'];
      expect(tenseSub.questionsSeen).toBe(1);
      expect(tenseSub.correct).toBe(1);
      expect(tenseSub.accuracy).toBe(100);
      expect(tenseSub.questionTypes).toContain('grammar_tense');
    });
  });

  describe('5. Difficulty Breakdown (Easy, Medium, Hard)', () => {
    it('thống kê chính xác hiệu suất theo 3 phân tầng độ khó', () => {
      const qEasy = createMockQuestion({ id: 'qe', difficulty: 'easy', correctAnswer: 'A' });
      const qMed1 = createMockQuestion({ id: 'qm1', difficulty: 'medium', correctAnswer: 'B' });
      const qMed2 = createMockQuestion({ id: 'qm2', difficulty: 'medium', correctAnswer: 'C' });
      const qHard = createMockQuestion({ id: 'qh', difficulty: 'hard', correctAnswer: 'D' });

      const analytics = buildToeicAttemptAnalytics({
        attemptId: 'attempt_diff',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions: [qEasy, qMed1, qMed2, qHard],
        userAnswers: { qe: 'A', qm1: 'B', qm2: 'A', qh: 'B' },
      });

      expect(analytics.byDifficulty.easy.questionsSeen).toBe(1);
      expect(analytics.byDifficulty.easy.correct).toBe(1);
      expect(analytics.byDifficulty.easy.accuracy).toBe(100);

      expect(analytics.byDifficulty.medium.questionsSeen).toBe(2);
      expect(analytics.byDifficulty.medium.correct).toBe(1);
      expect(analytics.byDifficulty.medium.incorrect).toBe(1);
      expect(analytics.byDifficulty.medium.accuracy).toBe(50);

      expect(analytics.byDifficulty.hard.questionsSeen).toBe(1);
      expect(analytics.byDifficulty.hard.correct).toBe(0);
      expect(analytics.byDifficulty.hard.incorrect).toBe(1);
      expect(analytics.byDifficulty.hard.accuracy).toBe(0);
    });
  });

  describe('6. Zero Question & Missing Metadata Safety', () => {
    it('an toàn tuyệt đối khi mảng câu hỏi rỗng (0 questions): không có NaN hay Infinity', () => {
      const analytics = buildToeicAttemptAnalytics({
        attemptId: 'attempt_empty',
        experienceMode: 'practice',
        skillScope: '2-skills',
        questions: [],
        userAnswers: {},
      });

      expect(analytics.overall.totalItems).toBe(0);
      expect(analytics.overall.accuracy).toBe(0);
      expect(analytics.overall.completionRate).toBe(0);
      expect(Number.isNaN(analytics.overall.accuracy)).toBe(false);
      expect(Number.isNaN(analytics.bySkill.listening.accuracy)).toBe(false);
      expect(analytics.bySkill.speaking.accuracy).toBeNull();
      expect(Object.keys(analytics.byPart).length).toBe(0);
      expect(Object.keys(analytics.bySubSkill).length).toBe(0);
      expect(analytics.byDifficulty.easy.accuracy).toBe(0);
    });

    it('an toàn khi câu hỏi thiếu optional metadata (subSkill, difficulty, estimatedDifficulty)', () => {
      const qIncomplete = createMockQuestion({
        id: 'q_no_meta',
        subSkill: undefined,
        difficulty: undefined,
        estimatedDifficulty: undefined,
        questionType: undefined,
        correctAnswer: 'A',
      });

      const analytics = buildToeicAttemptAnalytics({
        attemptId: 'attempt_nometa',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions: [qIncomplete],
        userAnswers: { q_no_meta: 'A' },
      });

      expect(analytics.bySubSkill['general_comprehension']).toBeDefined();
      expect(analytics.byDifficulty.medium.questionsSeen).toBe(1); // Mặc định về medium
      expect(analytics.byPart.part5_grammar?.averageEstimatedDifficulty).toBe(0);
    });
  });

  describe('7. Experience Semantics: Diagnostic, Practice & Mock', () => {
    it('Practice: retry nhiều lần sửa đúng TUYỆT ĐỐI không thay đổi evidence ban đầu (firstAttemptAnswers)', () => {
      const q1 = createMockQuestion({ id: 'q1', correctAnswer: 'A' });
      const q2 = createMockQuestion({ id: 'q2', correctAnswer: 'B' });

      // Lần đầu làm: q1 sai, q2 đúng
      const firstAttemptAnswers = {
        q1: 'C', // Sai
        q2: 'B', // Đúng
      };

      // Người dùng retry trong Practice sửa q1 thành đúng
      const userAnswersAfterRetry = {
        q1: 'A', // Đã sửa đúng
        q2: 'B',
      };

      const analytics = buildToeicAttemptAnalytics({
        attemptId: 'attempt_practice_retry',
        experienceMode: 'practice',
        skillScope: '2-skills',
        questions: [q1, q2],
        userAnswers: userAnswersAfterRetry,
        firstAttemptAnswers,
      });

      // Evidence và accuracy vẫn phải lấy từ firstAttemptAnswers (1/2 = 50%)
      expect(analytics.overall.correctCount).toBe(1);
      expect(analytics.overall.incorrectCount).toBe(1);
      expect(analytics.overall.accuracy).toBe(50);
      expect(analytics.experienceSemantics.isFirstAttemptEvidence).toBe(true);
      expect(analytics.experienceSemantics.evidenceSource).toBe('first_attempt_learning');
      expect(analytics.experienceSemantics.practiceRetriesPerformed).toBe(1);
      expect(analytics.experienceSemantics.practiceRetriesCorrect).toBe(1);
    });

    it('Diagnostic: bảo toàn thông tin đánh giá ước lượng (diagnostic confidence & range)', () => {
      const questions = TOEIC_QUESTION_BANK.slice(0, 5);
      const analytics = buildToeicAttemptAnalytics({
        attemptId: 'attempt_diag',
        experienceMode: 'diagnostic',
        skillScope: '2-skills',
        questions,
        userAnswers: { [questions[0].id]: questions[0].correctAnswer || 'A' },
        scoreEvaluation: {
          diagnosticReport: {
            confidence: 'High',
            estimatedToeicRange: { min: 550, max: 680, display: '550 - 680' },
          },
        } as any,
      });

      expect(analytics.experienceSemantics.evidenceSource).toBe('estimate_adaptive');
      expect(analytics.experienceSemantics.diagnosticConfidence).toBe('High');
      expect(analytics.experienceSemantics.estimatedToeicRange?.display).toBe('550 - 680');
    });

    it('Mock: gắn nhãn evidenceSource là strict_exam', () => {
      const questions = TOEIC_QUESTION_BANK.slice(0, 3);
      const analytics = buildToeicAttemptAnalytics({
        attemptId: 'attempt_mock_strict',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions,
        userAnswers: {},
      });

      expect(analytics.experienceSemantics.evidenceSource).toBe('strict_exam');
      expect(analytics.experienceSemantics.isFirstAttemptEvidence).toBe(false);
    });
  });

  describe('8. Real Question Bank Integration & Idempotency', () => {
    it('tích hợp trơn tru với Question Bank thật và evaluateToeicScores', () => {
      const questions = TOEIC_QUESTION_BANK.slice(0, 10);
      const userAnswers: Record<string, string> = {};
      questions.forEach((q, idx) => {
        if (idx % 2 === 0 && q.correctAnswer) {
          userAnswers[q.id] = q.correctAnswer;
        } else {
          userAnswers[q.id] = 'WRONG';
        }
      });

      const evaluated = calculateToeicScores({
        mode: '2skills_mini',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions,
        userAnswers,
      });

      const completedAt = 1700000000000;
      const analytics = buildToeicAttemptAnalytics({
        attemptId: 'real_bank_attempt',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions,
        userAnswers,
        scoreEvaluation: evaluated,
        completedAt,
      });

      expect(analytics.overall.totalItems).toBe(10);
      expect(analytics.overall.scaledScoreLR).toBe(evaluated.totalScore);
      expect(analytics.overall.accuracy).toBe(evaluated.overallAccuracy);

      // Gọi lại lần 2 với cùng input phải cho kết quả giống hệt (Idempotency)
      const analytics2 = buildToeicAttemptAnalytics({
        attemptId: 'real_bank_attempt',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions,
        userAnswers,
        scoreEvaluation: evaluated,
        completedAt,
      });

      expect(analytics).toEqual(analytics2);
    });
  });
});
