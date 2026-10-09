import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  scoreToCEFRLevel,
  calculateOverallScore,
  reconstructOriginalText,
  reconstructRevisedText,
  buildFallbackDiffSegments,
  generateFallbackGrading,
  gradeEssay,
} from '../essayGradingService';
import type { EssayCriteriaBreakdown, DiffSegment } from '../../types';

describe('essayGradingService (AI Essay Evaluation & Zero-Crash Resilient Engine)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('1. scoreToCEFRLevel & calculateOverallScore (CEFR Mapping Rules)', () => {
    it('ánh xạ chính xác các dải điểm số sang cấp bậc CEFR chuẩn', () => {
      // A1: < 40
      expect(scoreToCEFRLevel(0)).toBe('A1');
      expect(scoreToCEFRLevel(25)).toBe('A1');
      expect(scoreToCEFRLevel(39)).toBe('A1');

      // A2: 40 - 59
      expect(scoreToCEFRLevel(40)).toBe('A2');
      expect(scoreToCEFRLevel(50)).toBe('A2');
      expect(scoreToCEFRLevel(59)).toBe('A2');

      // B1: 60 - 74
      expect(scoreToCEFRLevel(60)).toBe('B1');
      expect(scoreToCEFRLevel(67)).toBe('B1');
      expect(scoreToCEFRLevel(74)).toBe('B1');

      // B2: 75 - 84
      expect(scoreToCEFRLevel(75)).toBe('B2');
      expect(scoreToCEFRLevel(80)).toBe('B2');
      expect(scoreToCEFRLevel(84)).toBe('B2');

      // C1: 85 - 94
      expect(scoreToCEFRLevel(85)).toBe('C1');
      expect(scoreToCEFRLevel(90)).toBe('C1');
      expect(scoreToCEFRLevel(94)).toBe('C1');

      // C2: 95+
      expect(scoreToCEFRLevel(95)).toBe('C2');
      expect(scoreToCEFRLevel(98)).toBe('C2');
      expect(scoreToCEFRLevel(100)).toBe('C2');
    });

    it('tính toán trung bình cộng 4 tiêu chí và quy đổi CEFR tổng quát chuẩn xác', () => {
      const mockCriteriaB2: EssayCriteriaBreakdown = {
        taskAchievement: { score: 75, cefrLevel: 'B2', feedback: 'Good content' },
        coherenceCohesion: { score: 80, cefrLevel: 'B2', feedback: 'Cohesive' },
        lexicalResource: { score: 78, cefrLevel: 'B2', feedback: 'Rich vocabulary' },
        grammaticalAccuracy: { score: 79, cefrLevel: 'B2', feedback: 'Accurate grammar' },
      };

      const resultB2 = calculateOverallScore(mockCriteriaB2);
      // (75 + 80 + 78 + 79) / 4 = 312 / 4 = 78
      expect(resultB2.overallScore).toBe(78);
      expect(resultB2.overallCEFR).toBe('B2');

      const mockCriteriaC1: EssayCriteriaBreakdown = {
        taskAchievement: { score: 90, cefrLevel: 'C1', feedback: 'Excellent' },
        coherenceCohesion: { score: 88, cefrLevel: 'C1', feedback: 'Fluid flow' },
        lexicalResource: { score: 92, cefrLevel: 'C1', feedback: 'Sophisticated' },
        grammaticalAccuracy: { score: 86, cefrLevel: 'C1', feedback: 'Precise' },
      };

      const resultC1 = calculateOverallScore(mockCriteriaC1);
      // (90 + 88 + 92 + 86) / 4 = 356 / 4 = 89
      expect(resultC1.overallScore).toBe(89);
      expect(resultC1.overallCEFR).toBe('C1');
    });
  });

  describe('2. Lossless Diff Segment Reconstruction', () => {
    it('mảng diffSegments khi nối lại bảo toàn 100% văn bản ban đầu, không mất từ hay dấu câu', () => {
      const essay = 'In modern society, people relies heavily on technology. It is very good for communication.';
      const segments = buildFallbackDiffSegments(essay);

      // Nối lại các originalText phải bằng chính xác 100% văn bản ban đầu
      const reconstructed = reconstructOriginalText(segments);
      expect(reconstructed).toBe(essay);
    });

    it('bảo toàn nguyên vẹn đoạn văn phức tạp nhiều đoạn, ký tự xuống dòng và khoảng trắng', () => {
      const complexEssay = `Artificial intelligence is changing the world.\n\nIn my opinion, it is a very important development.\nA lot of people relies on automated systems daily.`;
      const segments = buildFallbackDiffSegments(complexEssay);

      const reconstructed = reconstructOriginalText(segments);
      expect(reconstructed).toBe(complexEssay);

      // Bản sửa đổi đã được nâng cấp thay thế từ
      const revised = reconstructRevisedText(segments);
      expect(revised).toContain('from my perspective');
      expect(revised).toContain('of paramount importance');
      expect(revised).toContain('rely');
    });

    it('xử lý an toàn khi đầu vào rỗng hoặc chỉ có 1 từ', () => {
      const emptySegments = buildFallbackDiffSegments('');
      expect(reconstructOriginalText(emptySegments)).toBe('');

      const singleWord = 'Innovation';
      const singleSegments = buildFallbackDiffSegments(singleWord);
      expect(reconstructOriginalText(singleSegments)).toBe(singleWord);
    });

    it('reconstructRevisedText trả về văn bản đã sửa đổi khi có correction/enhancement', () => {
      const customSegments: DiffSegment[] = [
        { type: 'unchanged', originalText: 'He ' },
        { type: 'correction', originalText: 'go', revisedText: 'goes', explanation: 'Hòa hợp chủ vị' },
        { type: 'unchanged', originalText: ' to school.' },
      ];

      expect(reconstructOriginalText(customSegments)).toBe('He go to school.');
      expect(reconstructRevisedText(customSegments)).toBe('He goes to school.');
    });
  });

  describe('3. Fallback Mock Engine (Zero-Crash & Complete CEFR Feedback)', () => {
    it('trả về đầy đủ 4 tiêu chí CEFR, strengths, improvements và cờ isFallback === true khi không có API Key', async () => {
      const essay = 'Technology plays a very good role in our daily lives. In my opinion, it helps students a lot.';
      const result = await gradeEssay({
        essay,
        topic: 'The impact of technology on education',
      });

      // Kiểm tra cờ fallback
      expect(result.isFallback).toBe(true);

      // Kiểm tra đầy đủ 4 tiêu chí CEFR
      expect(result.criteria).toBeDefined();
      expect(result.criteria.taskAchievement).toBeDefined();
      expect(result.criteria.taskAchievement.score).toBeGreaterThan(0);
      expect(result.criteria.taskAchievement.cefrLevel).toBeDefined();
      expect(result.criteria.taskAchievement.feedback).toBeTruthy();

      expect(result.criteria.coherenceCohesion).toBeDefined();
      expect(result.criteria.coherenceCohesion.score).toBeGreaterThan(0);

      expect(result.criteria.lexicalResource).toBeDefined();
      expect(result.criteria.lexicalResource.score).toBeGreaterThan(0);

      expect(result.criteria.grammaticalAccuracy).toBeDefined();
      expect(result.criteria.grammaticalAccuracy.score).toBeGreaterThan(0);

      // Kiểm tra điểm tổng quan
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).toContain(result.overallCEFR);

      // Kiểm tra số từ
      expect(result.wordCount).toBe(18);

      // Kiểm tra strengths và improvements
      expect(Array.isArray(result.strengths)).toBe(true);
      expect(result.strengths.length).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(result.improvements)).toBe(true);
      expect(result.improvements.length).toBeGreaterThanOrEqual(2);

      // Kiểm tra tính toàn vẹn của diffSegments
      expect(Array.isArray(result.diffSegments)).toBe(true);
      expect(reconstructOriginalText(result.diffSegments)).toBe(essay);
      expect(result.fullRevisedEssay).toBeTruthy();
    });

    it('generateFallbackGrading hoạt động độc lập và sinh dữ liệu đúng chuẩn', () => {
      const sample = 'Learning foreign languages is very important for youth.';
      const result = generateFallbackGrading(sample, 'Language Learning');

      expect(result.isFallback).toBe(true);
      expect(result.wordCount).toBe(8);
      expect(result.overallCEFR).toBe('B2');
      expect(reconstructOriginalText(result.diffSegments)).toBe(sample);
    });
  });

  describe('4. Gemini API Integration & Resilience under Errors', () => {
    it('gọi API thành công và trả về dữ liệu chấm bài chính xác với isFallback === false', async () => {
      const sampleEssay = 'Education is the most powerful weapon which you can use to change the world.';

      const mockApiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    criteria: {
                      taskAchievement: { score: 92, cefrLevel: 'C1', feedback: 'Ý tưởng sắc bén và giàu sức thuyết phục.' },
                      coherenceCohesion: { score: 90, cefrLevel: 'C1', feedback: 'Bố cục chặt chẽ, dẫn chứng rõ ràng.' },
                      lexicalResource: { score: 88, cefrLevel: 'C1', feedback: 'Từ vựng học thuật trang trọng.' },
                      grammaticalAccuracy: { score: 90, cefrLevel: 'C1', feedback: 'Ngữ pháp tuyệt đối chính xác.' },
                    },
                    strengths: ['Dùng trích dẫn kinh điển rất ấn tượng.', 'Ngữ pháp hoàn hảo.'],
                    improvements: ['Có thể mở rộng thêm một ví dụ trong bối cảnh kỷ nguyên số.'],
                    diffSegments: [
                      { type: 'unchanged', originalText: sampleEssay },
                    ],
                    fullRevisedEssay: sampleEssay,
                  }),
                },
              ],
            },
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockApiResponse,
      } as any);

      const result = await gradeEssay({
        essay: sampleEssay,
        apiKey: 'AIzaSyFakeKeyValidFormat1234567890',
        topic: 'Importance of Education',
      });

      expect(result.isFallback).toBe(false);
      expect(result.overallScore).toBe(90);
      expect(result.overallCEFR).toBe('C1');
      expect(result.criteria.taskAchievement.score).toBe(92);
      expect(result.strengths).toContain('Ngữ pháp hoàn hảo.');
      expect(reconstructOriginalText(result.diffSegments)).toBe(sampleEssay);
    });

    it('xử lý an toàn khi API trả về mã lỗi HTTP 429 (Rate Limit), không crash và trả về fallback', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as any);

      const essay = 'Some essay content here.';
      const result = await gradeEssay({
        essay,
        apiKey: 'AIzaSyFakeKeyValidFormat1234567890',
      });

      expect(result.isFallback).toBe(true);
      expect(result.overallScore).toBeGreaterThan(0);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('xử lý an toàn khi mất kết nối mạng (Network Error / Exception), không throw exception', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline or DNS failure'));

      const essay = 'Another essay content.';
      const result = await gradeEssay({
        essay,
        apiKey: 'AIzaSyFakeKeyValidFormat1234567890',
      });

      expect(result.isFallback).toBe(true);
      expect(result.overallScore).toBeGreaterThan(0);
      expect(reconstructOriginalText(result.diffSegments)).toBe(essay);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('xử lý tự động chuẩn hóa diffSegments khi AI model trả về các đoạn bị lệch ký tự', async () => {
      const sampleEssay = 'Practice makes perfect.';

      const mockApiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    criteria: {
                      taskAchievement: { score: 80, cefrLevel: 'B2', feedback: 'Tốt' },
                      coherenceCohesion: { score: 80, cefrLevel: 'B2', feedback: 'Tốt' },
                      lexicalResource: { score: 80, cefrLevel: 'B2', feedback: 'Tốt' },
                      grammaticalAccuracy: { score: 80, cefrLevel: 'B2', feedback: 'Tốt' },
                    },
                    strengths: ['Ngắn gọn'],
                    improvements: ['Thêm chi tiết'],
                    // Cố tình trả về diffSegments bị thiếu khoảng trắng hoặc sai lệch
                    diffSegments: [
                      { type: 'unchanged', originalText: 'Practice makes' }, // Thiếu " perfect."
                    ],
                    fullRevisedEssay: 'Consistent practice yields perfection.',
                  }),
                },
              ],
            },
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockApiResponse,
      } as any);

      const result = await gradeEssay({
        essay: sampleEssay,
        apiKey: 'AIzaSyFakeKeyValidFormat1234567890',
      });

      expect(result.isFallback).toBe(false);
      // diffSegments đã được tự động chuẩn hóa để reconstructOriginalText khớp 100% với sampleEssay
      expect(reconstructOriginalText(result.diffSegments)).toBe(sampleEssay);
    });
  });
});
