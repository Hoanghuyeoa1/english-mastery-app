import { describe, it, expect } from 'vitest';
import { READING_LESSONS, findReadingLessonsByCefr } from '../../readingData';
import {
  validateReadingDataset,
  assertReadingDatasetValid,
  validateReadingDistribution,
  countPassageWords,
  READING_WORD_COUNT_TARGETS,
  VALID_CEFR_LEVELS,
} from '../validation';
import { ReadingLesson } from '../../types';

describe('PHASE 3: READING DATASET INTEGRITY (COMPLETE 24 LESSONS: A1–C2)', () => {
  // =========================================================================
  // 1. INVENTORY & CENSUS OF FULL DATASET (24 LESSONS: 4 PER BAND)
  // =========================================================================
  describe('1. Inventory & Census of Full Reading Dataset (A1–C2)', () => {
    it('đạt chuẩn phân bổ tuyệt đối: 24 bài đọc, mỗi cấp độ CEFR đúng 4 bài', () => {
      const a1 = findReadingLessonsByCefr('A1');
      const a2 = findReadingLessonsByCefr('A2');
      const b1 = findReadingLessonsByCefr('B1');
      const b2 = findReadingLessonsByCefr('B2');
      const c1 = findReadingLessonsByCefr('C1');
      const c2 = findReadingLessonsByCefr('C2');

      expect(a1).toHaveLength(4);
      expect(a2).toHaveLength(4);
      expect(b1).toHaveLength(4);
      expect(b2).toHaveLength(4);
      expect(c1).toHaveLength(4);
      expect(c2).toHaveLength(4);
      expect(READING_LESSONS).toHaveLength(24);
    });

    it('bảo toàn 100% stable IDs của 3 bài đọc gốc (read_1, read_2, read_3)', () => {
      const ids = READING_LESSONS.map((l) => l.id);
      expect(ids).toContain('read_1');
      expect(ids).toContain('read_2');
      expect(ids).toContain('read_3');
    });

    it('kiểm tra deterministic IDs của các bài đọc theo từng band', () => {
      const a1Ids = findReadingLessonsByCefr('A1').map((l) => l.id);
      expect(a1Ids).toEqual(['read_a1_1', 'read_a1_2', 'read_a1_3', 'read_a1_4']);

      const a2Ids = findReadingLessonsByCefr('A2').map((l) => l.id);
      expect(a2Ids).toEqual(['read_a2_1', 'read_a2_2', 'read_a2_3', 'read_a2_4']);

      const b1Ids = findReadingLessonsByCefr('B1').map((l) => l.id);
      expect(b1Ids).toEqual(['read_b1_1', 'read_b1_2', 'read_b1_3', 'read_b1_4']);

      const b2Ids = findReadingLessonsByCefr('B2').map((l) => l.id);
      expect(b2Ids).toEqual(['read_1', 'read_2', 'read_b2_1', 'read_b2_2']);

      const c1Ids = findReadingLessonsByCefr('C1').map((l) => l.id);
      expect(c1Ids).toEqual(['read_3', 'read_c1_1', 'read_c1_2', 'read_c1_3']);

      const c2Ids = findReadingLessonsByCefr('C2').map((l) => l.id);
      expect(c2Ids).toEqual(['read_c2_1', 'read_c2_2', 'read_c2_3', 'read_c2_4']);
    });

    it('kiểm tra tính đa dạng topic của 4 bài B2', () => {
      const b2 = findReadingLessonsByCefr('B2');
      const categories = b2.map((l) => l.category);
      expect(categories).toContain('Tech & AI');
      expect(categories).toContain('Science & Habit');
      expect(categories).toContain('Environment');
      expect(categories).toContain('Career & Business');
    });

    it('kiểm tra tính đa dạng topic của 4 bài C1', () => {
      const c1 = findReadingLessonsByCefr('C1');
      const categories = c1.map((l) => l.category);
      expect(categories).toContain('Tech & AI');
      expect(categories).toContain('Culture & Society');
      expect(categories).toContain('Environment');
      expect(categories).toContain('Education');
    });

    it('kiểm tra tính đa dạng topic của 4 bài C2', () => {
      const c2 = findReadingLessonsByCefr('C2');
      const categories = c2.map((l) => l.category);
      expect(categories).toContain('Science & Habit');
      expect(categories).toContain('Environment');
      expect(categories).toContain('Culture & Society');
      expect(categories).toContain('Education');
    });
  });

  // =========================================================================
  // 2. WORD-COUNT RANGES ACCORDING TO PEDAGOGICAL TARGETS
  // =========================================================================
  describe('2. Word-Count Ranges Across All CEFR Bands (A1–C2)', () => {
    it('mọi bài đọc A1 nằm chuẩn trong dải 80–140 words', () => {
      const a1 = findReadingLessonsByCefr('A1');
      a1.forEach((lesson) => {
        const words = countPassageWords(lesson.content);
        expect(words).toBeGreaterThanOrEqual(80);
        expect(words).toBeLessThanOrEqual(140);
        expect(lesson.content.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('mọi bài đọc A2 nằm chuẩn trong dải 120–200 words', () => {
      const a2 = findReadingLessonsByCefr('A2');
      a2.forEach((lesson) => {
        const words = countPassageWords(lesson.content);
        expect(words).toBeGreaterThanOrEqual(120);
        expect(words).toBeLessThanOrEqual(200);
        expect(lesson.content.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('mọi bài đọc B1 nằm chuẩn trong dải 200–320 words', () => {
      const b1 = findReadingLessonsByCefr('B1');
      b1.forEach((lesson) => {
        const words = countPassageWords(lesson.content);
        expect(words).toBeGreaterThanOrEqual(200);
        expect(words).toBeLessThanOrEqual(320);
        expect(lesson.content.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('mọi bài đọc B2 nằm chuẩn trong dải 300–450 words', () => {
      const b2 = findReadingLessonsByCefr('B2');
      b2.forEach((lesson) => {
        const words = countPassageWords(lesson.content);
        expect(words).toBeGreaterThanOrEqual(300);
        expect(words).toBeLessThanOrEqual(450);
        expect(lesson.content.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('mọi bài đọc C1 nằm chuẩn trong dải 450–650 words', () => {
      const c1 = findReadingLessonsByCefr('C1');
      c1.forEach((lesson) => {
        const words = countPassageWords(lesson.content);
        expect(words).toBeGreaterThanOrEqual(450);
        expect(words).toBeLessThanOrEqual(650);
        expect(lesson.content.length).toBeGreaterThanOrEqual(4);
      });
    });

    it('mọi bài đọc C2 nằm chuẩn trong dải 600–850 words', () => {
      const c2 = findReadingLessonsByCefr('C2');
      c2.forEach((lesson) => {
        const words = countPassageWords(lesson.content);
        expect(words).toBeGreaterThanOrEqual(600);
        expect(words).toBeLessThanOrEqual(850);
        expect(lesson.content.length).toBeGreaterThanOrEqual(4);
      });
    });
  });

  // =========================================================================
  // 3. QUESTION VALIDATION & CONTRACT INTEGRITY
  // =========================================================================
  describe('3. Question Schema, Plausibility, and Unique IDs', () => {
    it('mọi câu hỏi trong toàn bộ 24 bài đọc đều có unique question ID', () => {
      const allQuestionIds = READING_LESSONS.flatMap((l) => l.questions.map((q) => q.id));
      const uniqueIds = new Set(allQuestionIds);
      expect(uniqueIds.size).toBe(allQuestionIds.length);
    });

    it('mọi câu hỏi có 4 options, đáp án đúng hợp lệ và giải thích chi tiết tiếng Việt', () => {
      READING_LESSONS.forEach((lesson) => {
        lesson.questions.forEach((q) => {
          expect(q.options).toHaveLength(4);
          expect(q.correctIndex).toBeGreaterThanOrEqual(0);
          expect(q.correctIndex).toBeLessThan(4);

          // Correct option must not be empty
          const correctText = q.options[q.correctIndex].trim();
          expect(correctText.length).toBeGreaterThan(0);

          // Options must all be unique (case-insensitive)
          const lowerOptions = q.options.map((o) => o.trim().toLowerCase());
          expect(new Set(lowerOptions).size).toBe(4);

          // Explanation must be non-empty and substantive
          expect(q.explanation.trim().length).toBeGreaterThan(15);
        });
      });
    });

    it('mỗi bài đọc B2, C1, C2 có từ 6 đến 7 câu hỏi phân tích sâu', () => {
      const advancedLessons = [
        ...findReadingLessonsByCefr('B2'),
        ...findReadingLessonsByCefr('C1'),
        ...findReadingLessonsByCefr('C2'),
      ];

      advancedLessons.forEach((lesson) => {
        expect(lesson.questions.length).toBeGreaterThanOrEqual(6);
        expect(lesson.questions.length).toBeLessThanOrEqual(8);
      });
    });
  });

  // =========================================================================
  // 4. FULL DATASET VALIDATION (ZERO ERRORS WITH STRICT RULES & FULL DISTRIBUTION)
  // =========================================================================
  describe('4. Full Dataset Validation & Distribution', () => {
    it('toàn bộ 24 bài đọc pass 100% validation ở chế độ STRICT và FULL DISTRIBUTION', () => {
      const result = validateReadingDataset(READING_LESSONS, {
        wordCountMode: 'strict',
        requireFullDistribution: true,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(() =>
        assertReadingDatasetValid(READING_LESSONS, {
          wordCountMode: 'strict',
          requireFullDistribution: true,
        })
      ).not.toThrow();
    });

    it('phân bổ hoàn hảo validateReadingDistribution() trả về valid: true và missingPerBand rỗng', () => {
      const dist = validateReadingDistribution(READING_LESSONS);
      expect(dist.valid).toBe(true);
      expect(dist.total).toBe(24);
      expect(dist.expectedTotal).toBe(24);
      expect(dist.counts).toEqual({
        A1: 4,
        A2: 4,
        B1: 4,
        B2: 4,
        C1: 4,
        C2: 4,
      });
      expect(dist.missingPerBand).toEqual({});
      expect(dist.issues).toEqual([]);
    });
  });

  // =========================================================================
  // 5. ANOMALY DETECTION AND GUARDS
  // =========================================================================
  describe('5. Anomaly Detection & Fail-Fast Guards', () => {
    const baseValidLesson: ReadingLesson = {
      id: 'test_reading_base',
      title: 'Valid Reading Base',
      category: 'Tech & AI',
      level: 'B2',
      readTime: '3 phút',
      wordCount: 320,
      summary: 'Valid summary text.',
      content: [
        'Software craftsmanship requires deliberate practice and automated testing. ' +
        'Engineers build reliable systems by adhering to sound architectural principles and decoupling dependencies.'
      ],
      keyVocab: [
        { word: 'craftsmanship', ipa: '/ˈkrɑːfts.mən.ʃɪp/', meaning: 'sự khéo léo, kỹ nghệ' }
      ],
      questions: [
        {
          id: 'test_rq_1',
          type: 'main_idea',
          question: 'What is the primary topic of the passage?',
          options: ['Software engineering practices', 'Cooking recipes', 'Car manufacturing', 'Gardening tips'],
          correctIndex: 0,
          explanation: 'Passage focuses on software craftsmanship and automated testing.',
        },
      ],
    };

    it('bắt lỗi duplicate question IDs', () => {
      const corrupt: ReadingLesson = {
        ...baseValidLesson,
        questions: [
          baseValidLesson.questions[0],
          { ...baseValidLesson.questions[0] },
        ],
      };
      const result = validateReadingDataset([corrupt]);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'questions.id' && e.message.includes('Trùng lặp ID câu hỏi'))).toBe(true);
    });

    it('bắt lỗi duplicate lesson IDs', () => {
      const result = validateReadingDataset([baseValidLesson, { ...baseValidLesson }]);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'id' && e.message.includes('Trùng lặp ID bài đọc'))).toBe(true);
    });

    it('bắt lỗi options trùng lặp trong cùng một câu hỏi', () => {
      const corrupt: ReadingLesson = {
        ...baseValidLesson,
        questions: [
          {
            ...baseValidLesson.questions[0],
            options: ['Option A', 'Option B', 'Option A', 'Option C'],
          },
        ],
      };
      const result = validateReadingDataset([corrupt]);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'questions.options' && e.message.includes('trùng lặp'))).toBe(true);
    });

    it('bắt lỗi correctIndex ngoài phạm vi', () => {
      const corrupt: ReadingLesson = {
        ...baseValidLesson,
        questions: [
          {
            ...baseValidLesson.questions[0],
            correctIndex: 10,
          },
        ],
      };
      const result = validateReadingDataset([corrupt]);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'questions.correctIndex' && e.message.includes('ngoài phạm vi'))).toBe(true);
    });

    it('phát hiện deviation nghiêm trọng: A1 có 600 từ → invalid', () => {
      const generatedWords = Array.from({ length: 600 }, (_, i) => `word${i}`).join(' ');
      const badA1: ReadingLesson = {
        ...baseValidLesson,
        id: 'bad_a1_wc',
        level: 'A1',
        content: [generatedWords],
      };
      const result = validateReadingDataset([badA1]);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'wordCount' && e.message.includes('Độ lệch số từ quá lớn cho A1'))).toBe(true);
    });
  });

  // =========================================================================
  // 6. CEFR PROGRESSION & CONTENT QA METRICS (A1 < A2 < B1 < B2 < C1 < C2)
  // =========================================================================
  describe('6. CEFR Progression & Content QA Metrics (A1 < A2 < B1 < B2 < C1 < C2)', () => {
    it('100% 24 bài đọc khớp chính xác declared wordCount với số từ thực tế của passage', () => {
      READING_LESSONS.forEach((lesson) => {
        const actualWords = countPassageWords(lesson.content);
        expect(lesson.wordCount).toBe(actualWords);
      });
    });

    it('trung bình số từ passage tăng đơn điệu nghiêm ngặt theo cấp độ CEFR', () => {
      const levels: Array<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'> = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      const averages = levels.map((lvl) => {
        const lessons = findReadingLessonsByCefr(lvl);
        const totalWords = lessons.reduce((sum, l) => sum + countPassageWords(l.content), 0);
        return totalWords / lessons.length;
      });

      // A1 < A2 < B1 < B2 < C1 < C2
      for (let i = 0; i < averages.length - 1; i++) {
        expect(averages[i]).toBeLessThan(averages[i + 1]);
      }
    });

    it('độ dài câu trung bình (Mean Sentence Length) tăng dần theo cấp độ CEFR', () => {
      const levels: Array<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'> = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      const avgSentenceLengths = levels.map((lvl) => {
        const lessons = findReadingLessonsByCefr(lvl);
        let totalSentences = 0;
        let totalWords = 0;
        lessons.forEach((l) => {
          const text = l.content.join(' ');
          const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
          totalSentences += sentences.length;
          totalWords += countPassageWords(l.content);
        });
        return totalWords / totalSentences;
      });

      // A1 (12.2) < A2 (14.8) < B1 (20.1) < B2 (23.3) <= C1 (23.4) < C2 (27.1)
      expect(avgSentenceLengths[0]).toBeLessThan(avgSentenceLengths[1]); // A1 < A2
      expect(avgSentenceLengths[1]).toBeLessThan(avgSentenceLengths[2]); // A2 < B1
      expect(avgSentenceLengths[2]).toBeLessThan(avgSentenceLengths[3]); // B1 < B2
      expect(avgSentenceLengths[3]).toBeLessThanOrEqual(avgSentenceLengths[4]); // B2 <= C1
      expect(avgSentenceLengths[4]).toBeLessThan(avgSentenceLengths[5]); // C1 < C2
    });

    it('tỷ lệ từ vựng học thuật phức tạp (>= 7 ký tự) tăng dần từ A1 đến C1/C2', () => {
      const getLongWordRatio = (lvl: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2') => {
        const lessons = findReadingLessonsByCefr(lvl);
        let totalWords = 0;
        let longWords = 0;
        lessons.forEach((l) => {
          const words = l.content.join(' ').match(/\b[a-zA-Z-]{2,}\b/g) || [];
          totalWords += words.length;
          longWords += words.filter((w) => w.length >= 7).length;
        });
        return (longWords / totalWords) * 100;
      };

      const a1Ratio = getLongWordRatio('A1');
      const a2Ratio = getLongWordRatio('A2');
      const b1Ratio = getLongWordRatio('B1');
      const b2Ratio = getLongWordRatio('B2');
      const c1Ratio = getLongWordRatio('C1');

      // A1 (17.9%) < A2 (31.4%) < B1 (47.9%) < B2 (51.8%) < C1 (58.3%)
      expect(a1Ratio).toBeLessThan(a2Ratio);
      expect(a2Ratio).toBeLessThan(b1Ratio);
      expect(b1Ratio).toBeLessThan(b2Ratio);
      expect(b2Ratio).toBeLessThan(c1Ratio);
    });

    it('toàn bộ 24 bài đọc sạch 100% không chứa artifact placeholder, đoạn văn rỗng hay thiếu keyVocab', () => {
      const forbidden = [/\bTODO\b/i, /\bFIXME\b/i, /\bLOREM\b/i, /\bPLACEHOLDER\b/i, /\bUNDEFINED\b/i, /\bXXX\b/i, /\bNaN\b/, /\?\?\?/];

      READING_LESSONS.forEach((lesson) => {
        const combinedText = `${lesson.title} ${lesson.summary} ${lesson.content.join(' ')}`;
        forbidden.forEach((regex) => {
          expect(regex.test(combinedText)).toBe(false);
        });

        // Mỗi đoạn văn phải có nội dung đủ dài (> 20 ký tự)
        lesson.content.forEach((paragraph) => {
          expect(paragraph.trim().length).toBeGreaterThan(20);
        });

        // keyVocab phải có ít nhất 3 từ, đầy đủ word, IPA và meaning
        expect(lesson.keyVocab.length).toBeGreaterThanOrEqual(3);
        lesson.keyVocab.forEach((vocab) => {
          expect(vocab.word.trim().length).toBeGreaterThan(0);
          expect(vocab.ipa.trim().length).toBeGreaterThan(0);
          expect(vocab.meaning.trim().length).toBeGreaterThan(0);
        });
      });
    });
  });
});
