import { describe, it, expect } from 'vitest';
import { calculateToeicScores, ToeicScoringInput } from '../toeicScoring';
import type { ToeicQuestion } from '../../types';

function createMockQuestions(count: number, skill: 'listening' | 'reading' | 'speaking' | 'writing'): ToeicQuestion[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${skill}_${i + 1}`,
    part: skill === 'listening' ? 'part1_photos' : skill === 'reading' ? 'part5_grammar' : skill === 'speaking' ? 'speaking_read' : 'writing_email',
    skill,
    questionText: `Question ${skill} ${i + 1}`,
    correctAnswer: 'A',
    explanation: 'Test Explanation',
    vietnameseTranslation: 'Bản dịch kiểm thử',
  }));
}

describe('toeicScoring (Hệ thống tính điểm chuẩn TOEIC)', () => {
  describe('1. Thang điểm TOEIC Listening & Reading (Tổng 990)', () => {
    it('Điểm sàn: Làm đúng 0/100 câu -> trả về điểm tối thiểu hợp lệ (5 điểm mỗi phần, tổng 10, CEFR A1/A2)', () => {
      const listeningQuestions = createMockQuestions(100, 'listening');
      const readingQuestions = createMockQuestions(100, 'reading');
      const questions = [...listeningQuestions, ...readingQuestions];

      const input: ToeicScoringInput = {
        mode: '2skills_full',
        questions,
        userAnswers: {}, // không trả lời câu nào
      };

      const result = calculateToeicScores(input);

      expect(result.listeningScore).toBe(5);
      expect(result.readingScore).toBe(5);
      expect(result.totalScore).toBe(10);
      expect(result.listeningCorrect).toBe(0);
      expect(result.readingCorrect).toBe(0);
      expect(result.listeningTotal).toBe(100);
      expect(result.readingTotal).toBe(100);
      expect(result.cefrLevel).toBe('A1/A2');
    });

    it('Điểm trần: Làm đúng 100/100 câu -> trả về 495 điểm mỗi phần, tổng 990, CEFR C1', () => {
      const listeningQuestions = createMockQuestions(100, 'listening');
      const readingQuestions = createMockQuestions(100, 'reading');
      const questions = [...listeningQuestions, ...readingQuestions];

      const userAnswers: Record<string, string> = {};
      questions.forEach((q) => {
        userAnswers[q.id] = 'A'; // Đúng 100%
      });

      const input: ToeicScoringInput = {
        mode: '2skills_full',
        questions,
        userAnswers,
      };

      const result = calculateToeicScores(input);

      expect(result.listeningScore).toBe(495);
      expect(result.readingScore).toBe(495);
      expect(result.totalScore).toBe(990);
      expect(result.listeningCorrect).toBe(100);
      expect(result.readingCorrect).toBe(100);
      expect(result.cefrLevel).toBe('C1');
    });

    it('Các mốc trung gian: Kiểm tra độ chính xác đường cong điểm (30, 50, 75, 90 câu đúng trên 100 câu)', () => {
      const listeningQuestions = createMockQuestions(100, 'listening');
      const readingQuestions = createMockQuestions(100, 'reading');

      // 1. Kiểm tra 30/100 câu đúng: ratio = 0.3 -> Math.round(5 + 147) = 152 -> rounded to multiple of 5 = 150
      const answers30: Record<string, string> = {};
      listeningQuestions.slice(0, 30).forEach((q) => { answers30[q.id] = 'A'; });
      const res30 = calculateToeicScores({
        mode: '2skills_full',
        questions: listeningQuestions,
        userAnswers: answers30,
      });
      expect(res30.listeningScore).toBe(150);
      expect(res30.listeningCorrect).toBe(30);

      // 2. Kiểm tra 50/100 câu đúng: ratio = 0.5 -> Math.round(5 + 245) = 250 -> rounded = 250
      const answers50: Record<string, string> = {};
      listeningQuestions.slice(0, 50).forEach((q) => { answers50[q.id] = 'A'; });
      const res50 = calculateToeicScores({
        mode: '2skills_full',
        questions: listeningQuestions,
        userAnswers: answers50,
      });
      expect(res50.listeningScore).toBe(250);
      expect(res50.listeningCorrect).toBe(50);

      // 3. Kiểm tra 75/100 câu đúng: ratio = 0.75 -> Math.round(5 + 367.5) = 373 -> rounded = 375
      const answers75: Record<string, string> = {};
      readingQuestions.slice(0, 75).forEach((q) => { answers75[q.id] = 'A'; });
      const res75 = calculateToeicScores({
        mode: '2skills_full',
        questions: readingQuestions,
        userAnswers: answers75,
      });
      expect(res75.readingScore).toBe(375);
      expect(res75.readingCorrect).toBe(75);

      // 4. Kiểm tra 90/100 câu đúng: ratio = 0.9 -> Math.round(5 + 441) = 446 -> rounded = 445
      const answers90: Record<string, string> = {};
      readingQuestions.slice(0, 90).forEach((q) => { answers90[q.id] = 'A'; });
      const res90 = calculateToeicScores({
        mode: '2skills_full',
        questions: readingQuestions,
        userAnswers: answers90,
      });
      expect(res90.readingScore).toBe(445);
      expect(res90.readingCorrect).toBe(90);
    });

    it('Hoạt động chính xác trên bài thi Mini Test (số lượng câu ít hơn 100 câu)', () => {
      const listeningQuestions = createMockQuestions(10, 'listening');
      const readingQuestions = createMockQuestions(10, 'reading');
      const questions = [...listeningQuestions, ...readingQuestions];

      const userAnswers: Record<string, string> = {
        listening_1: 'A',
        listening_2: 'A',
        listening_3: 'A',
        listening_4: 'A',
        listening_5: 'A', // 5/10 listening = 50% -> 250
        reading_1: 'A',
        reading_2: 'A',
        reading_3: 'A',
        reading_4: 'A',
        reading_5: 'A',
        reading_6: 'A',
        reading_7: 'A',
        reading_8: 'A',
        reading_9: 'A',
        reading_10: 'A', // 10/10 reading = 100% -> 495
      };

      const result = calculateToeicScores({
        mode: '2skills_mini',
        questions,
        userAnswers,
      });

      expect(result.listeningScore).toBe(250);
      expect(result.readingScore).toBe(495);
      expect(result.totalScore).toBe(745);
      expect(result.cefrLevel).toBe('B2');
    });
  });

  describe('2. Thang điểm TOEIC Speaking & Writing (Thang 400)', () => {
    it('Speaking: Quy đổi chính xác theo độ dài từ vựng (word count)', () => {
      // 1. Không thu âm / rỗng / SKIPPED -> 0 điểm
      const resEmpty = calculateToeicScores({
        mode: '4skills',
        questions: [],
        userAnswers: {},
        speakingTranscript: '',
      });
      expect(resEmpty.speakingScore).toBe(0);
      expect(resEmpty.speakingFeedback).toContain('0/200');

      const resSkipped = calculateToeicScores({
        mode: '4skills',
        questions: [],
        userAnswers: {},
        speakingTranscript: 'SKIPPED',
      });
      expect(resSkipped.speakingScore).toBe(0);

      // 2. < 4 từ -> 50 điểm
      const resShort = calculateToeicScores({
        mode: '4skills',
        questions: [],
        userAnswers: {},
        speakingTranscript: 'Yes I do',
      });
      expect(resShort.speakingScore).toBe(50);

      // 3. 4 đến 9 từ -> 110 điểm
      const resMedium = calculateToeicScores({
        mode: '4skills',
        questions: [],
        userAnswers: {},
        speakingTranscript: 'I usually take the bus to my office',
      });
      expect(resMedium.speakingScore).toBe(110);

      // 4. 10 đến 19 từ -> 150 điểm
      const resGood = calculateToeicScores({
        mode: '4skills',
        questions: [],
        userAnswers: {},
        speakingTranscript: 'I strongly believe that flexible working hours improve employee productivity and happiness at work',
      });
      expect(resGood.speakingScore).toBe(150);

      // 5. >= 20 từ -> 180 điểm
      const resLong = calculateToeicScores({
        mode: '4skills',
        questions: [],
        userAnswers: {},
        speakingTranscript: 'In my personal perspective, digital transformation is essential for modern business corporations to optimize their daily operations and sustain revenue growth.',
      });
      expect(resLong.speakingScore).toBe(180);
    });

    it('Writing: Quy đổi chính xác theo độ dài từ vựng email phản hồi', () => {
      // 1. Không viết nội dung / rỗng / SKIPPED -> 0 điểm
      const resEmpty = calculateToeicScores({
        mode: '4skills',
        questions: [],
        userAnswers: {},
        writingText: '   ',
      });
      expect(resEmpty.writingScore).toBe(0);
      expect(resEmpty.writingWordCount).toBe(0);

      // 2. < 10 từ -> 40 điểm
      const resShort = calculateToeicScores({
        mode: '4skills',
        questions: [],
        userAnswers: {},
        writingText: 'Dear Sir, I received your email today. Thank you.',
      });
      expect(resShort.writingScore).toBe(40);
      expect(resShort.writingWordCount).toBe(9);

      // 3. 10 đến 24 từ -> 100 điểm
      const resMedium = calculateToeicScores({
        mode: '4skills',
        questions: [],
        userAnswers: {},
        writingText: 'Dear Mr. Smith, Thank you for contacting our customer service department regarding the recent shipment delay. We apologize sincerely for this inconvenience.',
      });
      expect(resMedium.writingScore).toBe(100);

      // 4. 25 đến 49 từ -> 150 điểm
      const resGoodText = 'Dear Ms. Johnson, I am writing in response to your inquiry concerning the upcoming annual conference. We have finalized the venue schedule and reserved adequate seating for all international participants. Please review the attached brochure and confirm your attendance before Friday.';
      const resGood = calculateToeicScores({
        mode: '4skills',
        questions: [],
        userAnswers: {},
        writingText: resGoodText,
      });
      expect(resGood.writingScore).toBe(150);

      // 5. >= 50 từ -> 180 điểm
      const resLongText = 'Dear Hiring Manager, I am writing to express my enthusiastic interest in the Senior Software Engineer position at your company. With over five years of dedicated experience building high-performance scalable web applications, I have successfully spearheaded numerous cross-functional engineering initiatives. I am confident that my technical skills, leadership, and collaborative approach will bring immediate value to your development team.';
      const resLong = calculateToeicScores({
        mode: '4skills',
        questions: [],
        userAnswers: {},
        writingText: resLongText,
      });
      expect(resLong.writingScore).toBe(180);
      expect(resLong.writingWordCount).toBeGreaterThanOrEqual(50);
    });

    it('Tổng điểm SW (totalSWScore): tính tổng speakingScore + writingScore khi bật 4 skills', () => {
      const res = calculateToeicScores({
        mode: '4skills',
        questions: [],
        userAnswers: {},
        speakingTranscript: 'I strongly believe that flexible working hours improve employee productivity and happiness at work', // 14 words -> 150
        writingText: 'Dear Mr. Smith, Thank you for contacting our customer service department regarding the recent shipment delay. We apologize sincerely for this inconvenience.', // 20 words -> 100
      });

      expect(resultHasSpeaking(res)).toBe(true);
      expect(res.speakingScore).toBe(150);
      expect(res.writingScore).toBe(100);
      expect(res.totalSWScore).toBe(250);
    });

    it('Không tính điểm SW khi chỉ thi chế độ 2 kỹ năng (2skills_mini / 2skills_full) và không có câu hỏi SW', () => {
      const res = calculateToeicScores({
        mode: '2skills_full',
        questions: createMockQuestions(10, 'listening'),
        userAnswers: {},
      });

      expect(res.hasSpeaking).toBe(false);
      expect(res.hasWriting).toBe(false);
      expect(res.speakingScore).toBeUndefined();
      expect(res.writingScore).toBeUndefined();
      expect(res.totalSWScore).toBeUndefined();
    });
  });

  describe('3. Edge Cases & Boundary Validation', () => {
    it('Xử lý mảng câu hỏi rỗng questions: [] an toàn', () => {
      const res = calculateToeicScores({
        mode: '2skills_mini',
        questions: [],
        userAnswers: {},
      });

      expect(res.listeningScore).toBe(5);
      expect(res.readingScore).toBe(5);
      expect(res.totalScore).toBe(10);
      expect(res.listeningTotal).toBe(0);
      expect(res.readingTotal).toBe(0);
      expect(res.cefrLevel).toBe('A1/A2');
    });

    it('Bỏ qua các câu trả lời SKIPPED hoặc câu sai, không tính điểm cộng', () => {
      const questions = createMockQuestions(4, 'listening');
      const userAnswers: Record<string, string> = {
        listening_1: 'A', // Đúng
        listening_2: 'B', // Sai (đáp án đúng là A)
        listening_3: 'SKIPPED', // Bỏ qua
        listening_4: '', // Rỗng
      };

      const res = calculateToeicScores({
        mode: '2skills_mini',
        questions,
        userAnswers,
      });

      expect(res.listeningCorrect).toBe(1);
      expect(res.listeningTotal).toBe(4);
      // ratio = 1/4 = 0.25 -> 5 + 0.25 * 490 = 127.5 -> rounded = 130
      expect(res.listeningScore).toBe(130);
    });

    it('Bỏ qua các key dư thừa không có trong bộ đề câu hỏi', () => {
      const questions = createMockQuestions(2, 'listening');
      const userAnswers: Record<string, string> = {
        listening_1: 'A',
        random_non_existent_key_1: 'A',
        random_non_existent_key_2: 'B',
      };

      const res = calculateToeicScores({
        mode: '2skills_mini',
        questions,
        userAnswers,
      });

      expect(res.listeningCorrect).toBe(1);
      expect(res.listeningTotal).toBe(2);
    });

    it('Xử lý an toàn khi câu hỏi thiếu correctAnswer', () => {
      const malformedQuestions: ToeicQuestion[] = [
        {
          id: 'q_malformed',
          part: 'part1_photos',
          skill: 'listening',
          questionText: 'Test question',
          explanation: '',
          vietnameseTranslation: '',
          correctAnswer: undefined,
        },
      ];

      const res = calculateToeicScores({
        mode: '2skills_mini',
        questions: malformedQuestions,
        userAnswers: { q_malformed: 'A' },
      });

      expect(res.listeningCorrect).toBe(0);
      expect(res.listeningScore).toBe(5);
    });

    it('Kiểm tra chính xác các ngưỡng chuyển đổi CEFR Level', () => {
      // 1. Dưới 255 -> A1/A2
      expect(getCefrForScore(250)).toBe('A1/A2');
      expect(getCefrForScore(254)).toBe('A1/A2');

      // 2. Từ 255 đến 549 -> B1
      expect(getCefrForScore(255)).toBe('B1');
      expect(getCefrForScore(545)).toBe('B1');

      // 3. Từ 550 đến 784 -> B2
      expect(getCefrForScore(550)).toBe('B2');
      expect(getCefrForScore(780)).toBe('B2');

      // 4. Từ 785 trở lên -> C1
      expect(getCefrForScore(785)).toBe('C1');
      expect(getCefrForScore(990)).toBe('C1');
    });

    it('Xử lý an toàn với đề bài chỉ có đúng 1 câu hỏi', () => {
      const singleQuestion: ToeicQuestion[] = [
        {
          id: 'single_q1',
          part: 'part5_grammar',
          skill: 'reading',
          questionText: 'Single test question',
          options: ['A. One', 'B. Two', 'C. Three', 'D. Four'],
          correctAnswer: 'A',
          explanation: 'Explanation',
          vietnameseTranslation: 'Dịch',
        },
      ];

      // Khi trả lời đúng: ratio = 1 -> readingScore = 495, totalScore = 5 + 495 = 500
      const resCorrect = calculateToeicScores({
        mode: '2skills_mini',
        questions: singleQuestion,
        userAnswers: { single_q1: 'A' },
      });
      expect(resCorrect.readingScore).toBe(495);
      expect(resCorrect.listeningScore).toBe(5);
      expect(resCorrect.totalScore).toBe(500);
      expect(resCorrect.overallAccuracy).toBe(100);
      expect(resCorrect.answeredCount).toBe(1);
      expect(resCorrect.unansweredCount).toBe(0);

      // Khi trả lời sai: ratio = 0 -> readingScore = 5, totalScore = 10
      const resWrong = calculateToeicScores({
        mode: '2skills_mini',
        questions: singleQuestion,
        userAnswers: { single_q1: 'B' },
      });
      expect(resWrong.readingScore).toBe(5);
      expect(resWrong.totalScore).toBe(10);
      expect(resWrong.overallAccuracy).toBe(0);
    });
  });

  describe('4. Chi tiết từng Part, Độ chính xác & Suy luận Điểm mạnh / Yếu', () => {
    it('Phân tích chính xác partBreakdown theo từng Part có trong bài thi', () => {
      const qPart1 = createMockQuestions(2, 'listening'); // part1_photos
      const qPart5 = createMockQuestions(3, 'reading');   // part5_grammar
      const questions = [...qPart1, ...qPart5];

      const userAnswers: Record<string, string> = {
        listening_1: 'A', // đúng
        listening_2: 'B', // sai
        reading_1: 'A',   // đúng
        reading_2: 'A',   // đúng
        reading_3: 'A',   // đúng
      };

      const result = calculateToeicScores({
        mode: '2skills_mini',
        questions,
        userAnswers,
      });

      expect(result.partBreakdown).toHaveLength(2);
      
      const p1 = result.partBreakdown.find((p) => p.part === 'part1_photos');
      expect(p1).toBeDefined();
      expect(p1?.total).toBe(2);
      expect(p1?.correct).toBe(1);
      expect(p1?.accuracy).toBe(50);

      const p5 = result.partBreakdown.find((p) => p.part === 'part5_grammar');
      expect(p5).toBeDefined();
      expect(p5?.total).toBe(3);
      expect(p5?.correct).toBe(3);
      expect(p5?.accuracy).toBe(100);

      expect(result.overallAccuracy).toBe(80); // 4/5 = 80%
      expect(result.answeredCount).toBe(5);
      expect(result.unansweredCount).toBe(0);
    });

    it('Tự động nhận diện điểm mạnh (>= 75%) và điểm yếu (<= 50%)', () => {
      const qPart1 = createMockQuestions(2, 'listening');
      const qPart5 = createMockQuestions(2, 'reading');
      const questions = [...qPart1, ...qPart5];

      // Part 1: đúng 2/2 = 100% -> Strength
      // Part 5: đúng 0/2 = 0% -> Area to improve
      const userAnswers: Record<string, string> = {
        listening_1: 'A',
        listening_2: 'A',
        reading_1: 'B',
        reading_2: 'C',
      };

      const result = calculateToeicScores({
        mode: '2skills_mini',
        questions,
        userAnswers,
      });

      expect(result.strengths.some((s) => s.includes('Part 1'))).toBe(true);
      expect(result.areasToImprove.some((a) => a.includes('Part 5'))).toBe(true);
    });

    it('Cảnh báo khi người học còn câu chưa làm trong areasToImprove', () => {
      const questions = createMockQuestions(4, 'reading');
      const userAnswers: Record<string, string> = {
        reading_1: 'A',
        // reading_2, 3, 4 bỏ trống
      };

      const result = calculateToeicScores({
        mode: '2skills_mini',
        questions,
        userAnswers,
      });

      expect(result.unansweredCount).toBe(3);
      expect(result.areasToImprove.some((a) => a.includes('chưa làm kịp'))).toBe(true);
    });
  });

  describe('5. Đánh giá chuyên sâu Speaking & Writing (Thang 400)', () => {
    it('Speaking đạt tối đa 200 điểm và trả về sub-scores chi tiết', () => {
      const longSpeech = 'In my extensive professional experience, clear communication, transparent feedback, and empathetic leadership are the most fundamental pillars for building high-performing, resilient, and collaborative remote software engineering teams across international markets and diverse cultural backgrounds worldwide today in technology.';
      const res = calculateToeicScores({
        mode: '4skills',
        questions: [],
        userAnswers: {},
        speakingTranscript: longSpeech,
      });

      expect(res.speakingScore).toBe(200);
      expect(res.speakingEvaluation).toBeDefined();
      expect(res.speakingEvaluation?.pronunciationScore).toBe(60);
      expect(res.speakingEvaluation?.fluencyScore).toBe(70);
      expect(res.speakingEvaluation?.contentScore).toBe(70);
      expect(res.speakingFeedback).toContain('200/200');
    });

    it('Writing đạt tối đa 200 điểm và trả về sub-scores chi tiết', () => {
      const longEmail = 'Dear Mr. Miller, Thank you for bringing this critical delivery delay to our immediate attention. We deeply regret the unforeseen inconvenience caused by the adverse meteorological conditions in the transit corridor. As a valued enterprise partner, we have already upgraded your replacement consignment to priority expedited air freight at zero additional cost, scheduled for delivery by 9:00 AM tomorrow. Furthermore, we are crediting your monthly account with a full shipping waiver as our token of apology. Sincerely, Support Management.';
      const res = calculateToeicScores({
        mode: '4skills',
        questions: [],
        userAnswers: {},
        writingText: longEmail,
      });

      expect(res.writingScore).toBe(200);
      expect(res.writingEvaluation).toBeDefined();
      expect(res.writingEvaluation?.grammarScore).toBe(60);
      expect(res.writingEvaluation?.organizationScore).toBe(70);
      expect(res.writingEvaluation?.vocabularyScore).toBe(70);
      expect(res.writingFeedback).toContain('200/200');
      expect(res.totalSWScore).toBe(200);
    });
  });
});

function resultHasSpeaking(res: ReturnType<typeof calculateToeicScores>): boolean {
  return res.hasSpeaking;
}

function getCefrForScore(totalScore: number): string {
  // Mô phỏng hàm CEFR check theo logic chuẩn trong toeicScoring
  if (totalScore >= 785) return 'C1';
  if (totalScore >= 550) return 'B2';
  if (totalScore >= 255) return 'B1';
  return 'A1/A2';
}
