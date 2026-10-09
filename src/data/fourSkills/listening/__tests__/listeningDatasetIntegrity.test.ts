import { describe, it, expect } from 'vitest';
import { LISTENING_LESSONS, findListeningLessonsByCefr } from '../index';
import { validateListeningDataset, assertListeningDatasetValid } from '../validation';
import { ListeningLesson } from '../../types';

describe('DATASET INTEGRITY & PEDAGOGICAL INVARIANTS: LISTENING LAB', () => {
  it('Production LISTENING_LESSONS dataset passes all integrity checks with 0 errors', () => {
    const result = validateListeningDataset(LISTENING_LESSONS);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(() => assertListeningDatasetValid(LISTENING_LESSONS)).not.toThrow();
  });

  it('Bảo toàn 100% 4 bài nghe gốc (listen_1..listen_4) với IDs không đổi', () => {
    const ids = LISTENING_LESSONS.map((l) => l.id);
    expect(ids).toContain('listen_1');
    expect(ids).toContain('listen_2');
    expect(ids).toContain('listen_3');
    expect(ids).toContain('listen_4');
  });

  it('Xác nhận chính xác phân bổ quy mô toàn diện Phase 5 (24 bài chuẩn A1–C2)', () => {
    expect(LISTENING_LESSONS.length).toBeGreaterThanOrEqual(24);

    const a1Lessons = findListeningLessonsByCefr('A1');
    const a2Lessons = findListeningLessonsByCefr('A2');
    const b1Lessons = findListeningLessonsByCefr('B1');
    const b2Lessons = findListeningLessonsByCefr('B2');
    const c1Lessons = findListeningLessonsByCefr('C1');
    const c2Lessons = findListeningLessonsByCefr('C2');

    expect(a1Lessons).toHaveLength(4);
    expect(a2Lessons).toHaveLength(4);
    expect(b1Lessons).toHaveLength(4);
    expect(b2Lessons).toHaveLength(4);
    expect(c1Lessons).toHaveLength(4);
    expect(c2Lessons).toHaveLength(4);

    expect(a1Lessons.map((l) => l.id)).toEqual([
      'listen_a1_1',
      'listen_a1_2',
      'listen_a1_3',
      'listen_a1_4',
    ]);

    expect(a2Lessons.map((l) => l.id)).toEqual([
      'listen_a2_1',
      'listen_a2_2',
      'listen_a2_3',
      'listen_a2_4',
    ]);

    expect(b1Lessons.map((l) => l.id)).toEqual([
      'listen_2',
      'listen_4',
      'listen_b1_1',
      'listen_b1_2',
    ]);

    expect(b2Lessons.map((l) => l.id)).toEqual([
      'listen_1',
      'listen_b2_1',
      'listen_b2_2',
      'listen_b2_3',
    ]);

    expect(c1Lessons.map((l) => l.id)).toEqual([
      'listen_3',
      'listen_c1_1',
      'listen_c1_2',
      'listen_c1_3',
    ]);

    expect(c2Lessons.map((l) => l.id)).toEqual([
      'listen_c2_1',
      'listen_c2_2',
      'listen_c2_3',
      'listen_c2_4',
    ]);

    // Tổng số câu hỏi toàn bộ ngân hàng bài nghe
    const totalQuestions = LISTENING_LESSONS.reduce((acc, l) => acc + l.questions.length, 0);
    expect(totalQuestions).toBeGreaterThanOrEqual(120);
  });

  describe('Anomaly Detection & Fail-Fast Guards', () => {
    const validBaseLesson: ListeningLesson = {
      id: 'test_lesson_1',
      title: 'Valid Lesson Title',
      category: 'Tech',
      level: 'B2',
      duration: '3:00',
      description: 'A valid test lesson description',
      audioText: 'Cloud infrastructure resilience requires automated failure isolation and monitoring.',
      sentences: [
        {
          en: 'Cloud infrastructure resilience requires automated failure isolation and monitoring.',
          vi: 'Khả năng phục hồi hạ tầng đám mây đòi hỏi cô lập lỗi tự động và giám sát.',
        },
      ],
      questions: [
        {
          id: 'test_q1',
          type: 'main_idea',
          question: 'What is the main topic of the recording?',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctIndex: 0,
          explanation: 'Option A covers cloud resilience.',
        },
      ],
    };

    it('bắt lỗi duplicate lesson IDs', () => {
      const corruptDataset: ListeningLesson[] = [
        { ...validBaseLesson, id: 'duplicate_id' },
        { ...validBaseLesson, id: 'duplicate_id' },
      ];
      const result = validateListeningDataset(corruptDataset);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'id' && e.message.includes('Trùng lặp ID bài nghe'))).toBe(true);
    });

    it('bắt lỗi duplicate question IDs', () => {
      const corruptDataset: ListeningLesson[] = [
        {
          ...validBaseLesson,
          id: 'lesson_a',
          questions: [{ ...validBaseLesson.questions[0], id: 'shared_q_id' }],
        },
        {
          ...validBaseLesson,
          id: 'lesson_b',
          questions: [{ ...validBaseLesson.questions[0], id: 'shared_q_id' }],
        },
      ];
      const result = validateListeningDataset(corruptDataset);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'questions.id' && e.message.includes('Trùng lặp ID câu hỏi'))).toBe(true);
    });

    it('bắt lỗi lesson không có questions', () => {
      const corruptDataset: ListeningLesson[] = [
        { ...validBaseLesson, questions: [] },
      ];
      const result = validateListeningDataset(corruptDataset);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'questions')).toBe(true);
    });

    it('bắt lỗi question không đủ options (< 2)', () => {
      const corruptDataset: ListeningLesson[] = [
        {
          ...validBaseLesson,
          questions: [
            {
              ...validBaseLesson.questions[0],
              options: ['Only one option'],
            },
          ],
        },
      ];
      const result = validateListeningDataset(corruptDataset);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'questions.options')).toBe(true);
    });

    it('bắt lỗi correctIndex ngoài phạm vi options', () => {
      const corruptDataset: ListeningLesson[] = [
        {
          ...validBaseLesson,
          questions: [
            {
              ...validBaseLesson.questions[0],
              options: ['A', 'B', 'C', 'D'],
              correctIndex: 4, // index 4 is out of bounds for 4 elements (0..3)
            },
          ],
        },
      ];
      const result = validateListeningDataset(corruptDataset);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'questions.correctIndex')).toBe(true);
    });

    it('bắt lỗi duplicate options trong cùng một câu hỏi', () => {
      const corruptDataset: ListeningLesson[] = [
        {
          ...validBaseLesson,
          questions: [
            {
              ...validBaseLesson.questions[0],
              options: ['Duplicated Answer', 'Duplicated Answer', 'Unique C', 'Unique D'],
              correctIndex: 0,
            },
          ],
        },
      ];
      const result = validateListeningDataset(corruptDataset);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'questions.options' && e.message.includes('trùng lặp'))).toBe(true);
    });

    it('bắt lỗi audioText rỗng', () => {
      const corruptDataset: ListeningLesson[] = [
        { ...validBaseLesson, audioText: '   ' },
      ];
      const result = validateListeningDataset(corruptDataset);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'audioText')).toBe(true);
    });

    it('bắt lỗi transcript sentences rỗng hoặc thiếu bản dịch', () => {
      const corruptDataset: ListeningLesson[] = [
        {
          ...validBaseLesson,
          sentences: [{ en: 'Valid English text.', vi: '   ' }],
        },
      ];
      const result = validateListeningDataset(corruptDataset);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field.includes('sentences'))).toBe(true);
    });

    it('bắt lỗi CEFR invalid', () => {
      const corruptDataset: any[] = [
        { ...validBaseLesson, level: 'Z9' },
      ];
      const result = validateListeningDataset(corruptDataset);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'level')).toBe(true);
    });

    it('bắt lỗi missing correct answer (đáp án đúng tại correctIndex bị rỗng)', () => {
      const corruptDataset: ListeningLesson[] = [
        {
          ...validBaseLesson,
          questions: [
            {
              ...validBaseLesson.questions[0],
              options: ['Option A', '   ', 'Option C', 'Option D'],
              correctIndex: 1, // Points to empty option
            },
          ],
        },
      ];
      const result = validateListeningDataset(corruptDataset);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'questions.correctIndex')).toBe(true);
    });

    it('bắt lỗi vocab_context có targetWord hoàn toàn không liên quan đến bài nghe', () => {
      const corruptDataset: ListeningLesson[] = [
        {
          ...validBaseLesson,
          questions: [
            {
              id: 'q_vocab_irrelevant',
              type: 'vocab_context',
              question: 'In the audio, what does the word "xylophone" mean?',
              options: ['A musical instrument', 'A computer virus', 'A cloud database', 'A protocol'],
              correctIndex: 0,
              explanation: 'A musical instrument.',
            },
          ],
        },
      ];
      const result = validateListeningDataset(corruptDataset);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'questions.targetWord')).toBe(true);
    });

    it('KHÔNG ép general comprehension question phải có targetWord (cho phép pass bình thường)', () => {
      const generalComprehensionLesson: ListeningLesson = {
        ...validBaseLesson,
        questions: [
          {
            id: 'q_general_1',
            type: 'inference',
            question: 'What can be inferred about the future of cloud computing according to the speaker?',
            options: ['Costs will rise', 'Scalability will improve', 'Hardware will vanish', 'No changes'],
            correctIndex: 1,
            explanation: 'The speaker highlights continuous architectural improvement.',
          },
        ],
      };
      const result = validateListeningDataset([generalComprehensionLesson]);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
