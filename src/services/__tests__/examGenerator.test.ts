// src/services/__tests__/examGenerator.test.ts
import { describe, it, expect } from 'vitest';
import {
  generateToeicExam,
  validateExamSnapshot,
  createExamRng,
} from '../examGenerator';
import { EXAM_MODE_CONFIGS, ExamModeConfig, ToeicQuestion, ToeicQuestionGroup } from '../../types/toeic';
import { TOEIC_QUESTION_BANK, TOEIC_QUESTION_GROUPS } from '../../data/toeicQuestionsData';

describe('TOEIC Exam Generator Engine (Phase 3)', () => {
  describe('1. Mode -> Đúng số câu và đúng Part distribution', () => {
    it('Mode 2skills_mini sinh đúng 10 câu với 5 Listening và 5 Reading', () => {
      const snapshot = generateToeicExam({
        mode: '2skills_mini',
        seed: 12345,
      });

      expect(snapshot.totalQuestions).toBe(10);
      expect(snapshot.questions).toHaveLength(10);
      expect(snapshot.skillBreakdown.listening).toBe(5);
      expect(snapshot.skillBreakdown.reading).toBe(5);
      expect(snapshot.skillBreakdown.speaking).toBe(0);
      expect(snapshot.skillBreakdown.writing).toBe(0);

      // Part distribution
      expect(snapshot.partCounts.part1_photos).toBe(1);
      expect(snapshot.partCounts.part2_qna).toBe(1);
      expect(snapshot.partCounts.part3_conv).toBe(3); // 1 group
      expect(snapshot.partCounts.part5_grammar).toBe(2);
      expect(snapshot.partCounts.part7_reading).toBe(3); // 1 group
    });

    it('Mode 2skills_full sinh đúng 20 câu chuẩn ETS với cả 7 Part LR', () => {
      const snapshot = generateToeicExam({
        mode: '2skills_full',
        seed: 99999,
      });

      expect(snapshot.totalQuestions).toBe(20);
      expect(snapshot.questions).toHaveLength(20);
      expect(snapshot.skillBreakdown.listening).toBe(11);
      expect(snapshot.skillBreakdown.reading).toBe(9);

      // Part distribution
      expect(snapshot.partCounts.part1_photos).toBe(2);
      expect(snapshot.partCounts.part2_qna).toBe(3);
      expect(snapshot.partCounts.part3_conv).toBe(3); // 1 group of 3
      expect(snapshot.partCounts.part4_talks).toBe(3); // 1 group of 3
      expect(snapshot.partCounts.part5_grammar).toBe(3);
      expect(snapshot.partCounts.part6_text).toBe(3); // 1 group of 3
      expect(snapshot.partCounts.part7_reading).toBe(3); // 1 group of 3

      // 4 groups total: P3, P4, P6, P7
      expect(snapshot.groups).toHaveLength(4);
    });

    it('Mode 4skills sinh đúng 24 câu gồm 20 câu LR + 2 Speaking + 2 Writing', () => {
      const snapshot = generateToeicExam({
        mode: '4skills',
        seed: 77777,
      });

      expect(snapshot.totalQuestions).toBe(24);
      expect(snapshot.questions).toHaveLength(24);
      expect(snapshot.skillBreakdown.listening).toBe(11);
      expect(snapshot.skillBreakdown.reading).toBe(9);
      expect(snapshot.skillBreakdown.speaking).toBe(2);
      expect(snapshot.skillBreakdown.writing).toBe(2);

      // Kiểm tra Speaking và Writing có evaluationCriteria
      const speakingQuestions = snapshot.questions.filter((q) => q.skill === 'speaking');
      const writingQuestions = snapshot.questions.filter((q) => q.skill === 'writing');

      expect(speakingQuestions).toHaveLength(2);
      expect(writingQuestions).toHaveLength(2);

      speakingQuestions.forEach((q) => {
        expect(q.evaluationCriteria).toBeDefined();
      });
      writingQuestions.forEach((q) => {
        expect(q.evaluationCriteria).toBeDefined();
      });
    });
  });

  describe('2. Difficulty Balancing', () => {
    it('Cân bằng tỷ lệ Easy/Medium/Hard theo rule config của từng mode', () => {
      const snapshot = generateToeicExam({
        mode: '2skills_full',
        seed: 42,
      });

      // Target cho 2skills_full: 25% Easy (5), 55% Medium (11), 20% Hard (4)
      expect(snapshot.difficultyBreakdown.easy).toBeGreaterThanOrEqual(3);
      expect(snapshot.difficultyBreakdown.easy).toBeLessThanOrEqual(7);

      expect(snapshot.difficultyBreakdown.medium).toBeGreaterThanOrEqual(8);
      expect(snapshot.difficultyBreakdown.medium).toBeLessThanOrEqual(14);

      expect(snapshot.difficultyBreakdown.hard).toBeGreaterThanOrEqual(2);
      expect(snapshot.difficultyBreakdown.hard).toBeLessThanOrEqual(6);

      // Tổng cộng phải khớp totalQuestions
      expect(
        snapshot.difficultyBreakdown.easy +
          snapshot.difficultyBreakdown.medium +
          snapshot.difficultyBreakdown.hard
      ).toBe(20);
    });

    it('Không bao giờ sinh đề toàn Easy hoặc toàn Hard', () => {
      for (let s = 1; s <= 10; s++) {
        const snapshot = generateToeicExam({
          mode: '2skills_full',
          seed: s * 100,
        });

        expect(snapshot.difficultyBreakdown.easy).toBeLessThan(snapshot.totalQuestions);
        expect(snapshot.difficultyBreakdown.hard).toBeLessThan(snapshot.totalQuestions);
        expect(snapshot.difficultyBreakdown.medium).toBeGreaterThan(0);
      }
    });
  });

  describe('3. Group Integrity (Atomic Invariant)', () => {
    it('Part 3, 4, 6, 7 luôn được chọn nguyên vẹn cả Group, không bao giờ cắt lẻ câu hỏi', () => {
      const snapshot = generateToeicExam({
        mode: '2skills_full',
        seed: 8888,
      });

      const examQuestionIds = new Set(snapshot.questions.map((q) => q.id));

      snapshot.groups.forEach((group) => {
        // Mọi câu hỏi trong group phải có mặt đầy đủ trong đề thi
        group.questionIds.forEach((qId) => {
          expect(examQuestionIds.has(qId)).toBe(true);
        });

        // Câu hỏi trong group phải liên kết ngược lại group
        group.questionIds.forEach((qId) => {
          const q = snapshot.questions.find((item) => item.id === qId);
          expect(q).toBeDefined();
          expect(q?.groupId).toBe(group.id);
        });
      });
    });

    it('Không bao giờ duplicate cùng một Group hoặc cùng một Passage trong cùng đề thi', () => {
      const snapshot = generateToeicExam({
        mode: '4skills',
        seed: 5555,
      });

      const groupIds = snapshot.groups.map((g) => g.id);
      const uniqueGroupIds = new Set(groupIds);
      expect(groupIds.length).toBe(uniqueGroupIds.size);

      // Kiểm tra passage/audioScript không bị lặp
      const passages = snapshot.groups
        .map((g) => g.passageText || g.audioScript)
        .filter(Boolean);
      const uniquePassages = new Set(passages);
      expect(passages.length).toBe(uniquePassages.size);
    });

    it('validateExamSnapshot xác nhận tính hợp lệ hoàn hảo', () => {
      const snapshot = generateToeicExam({
        mode: '2skills_full',
        seed: 3333,
      });

      const validation = validateExamSnapshot(snapshot);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('4. No Duplicate Questions', () => {
    it('Không có bất kỳ câu hỏi nào bị trùng lặp ID trong đề thi', () => {
      const snapshot = generateToeicExam({
        mode: '4skills',
        seed: 1234,
      });

      const questionIds = snapshot.questions.map((q) => q.id);
      const uniqueIds = new Set(questionIds);
      expect(questionIds.length).toBe(uniqueIds.size);
    });
  });

  describe('5. Anti-Repeat (Ưu tiên tránh câu hỏi/nhóm đã gặp gần đây)', () => {
    it('Ưu tiên tuyệt đối các câu hỏi và nhóm chưa từng xuất hiện (unseen)', () => {
      // Lấy 1 đề thi đầu tiên
      const exam1 = generateToeicExam({
        mode: '2skills_full',
        seed: 100,
      });

      const seenQuestionIds = exam1.questions.map((q) => q.id);
      const seenGroupIds = exam1.groups.map((g) => g.id);

      // Sinh đề thi thứ 2 với recentHistory là đề 1
      const exam2 = generateToeicExam({
        mode: '2skills_full',
        seed: 200,
        recentHistory: {
          recentQuestionIds: seenQuestionIds,
          recentGroupIds: seenGroupIds,
        },
      });

      // Ngân hàng có 93 câu và 16 groups, hoàn toàn đủ cho đề 2 không bị trùng đề 1
      const overlapQuestions = exam2.questions.filter((q) => seenQuestionIds.includes(q.id));
      const overlapGroups = exam2.groups.filter((g) => seenGroupIds.includes(g.id));

      // Không trùng group nào với đề trước
      expect(overlapGroups.length).toBe(0);
      // Mức độ trùng lặp câu hỏi độc lập cực thấp hoặc bằng 0
      expect(overlapQuestions.length).toBe(0);
    });

    it('Khi history quá lớn chứa toàn bộ ngân hàng, generator fallback có kiểm soát và không crash', () => {
      // Giả lập người dùng đã làm TẤT CẢ câu hỏi trong ngân hàng
      const allQuestionIds = TOEIC_QUESTION_BANK.map((q) => q.id);
      const allGroupIds = TOEIC_QUESTION_GROUPS.map((g) => g.id);

      const snapshot = generateToeicExam({
        mode: '2skills_full',
        seed: 300,
        recentHistory: {
          recentQuestionIds: allQuestionIds,
          recentGroupIds: allGroupIds,
        },
      });

      // Vẫn sinh đủ 20 câu, không crash
      expect(snapshot.totalQuestions).toBe(20);
      expect(snapshot.questions).toHaveLength(20);
      // Diagnostics ghi nhận đã nới lỏng history
      expect(snapshot.diagnostics.relaxedHistory).toBe(true);
      // Đề thi sinh ra vẫn hoàn toàn không bị trùng lặp nội bộ
      const uniqueIds = new Set(snapshot.questions.map((q) => q.id));
      expect(uniqueIds.size).toBe(20);
    });
  });

  describe('6. Seed Determinism & Reproducibility', () => {
    it('Cùng một seed và input cho ra snapshot hoàn toàn giống nhau (100% reproducible)', () => {
      const seed = 654321;
      const history = ['toeic_p1_1', 'toeic_p2_1'];

      const run1 = generateToeicExam({
        mode: '2skills_full',
        seed,
        recentHistory: history,
      });

      const run2 = generateToeicExam({
        mode: '2skills_full',
        seed,
        recentHistory: history,
      });

      expect(run1.questions.map((q) => q.id)).toEqual(run2.questions.map((q) => q.id));
      expect(run1.groups.map((g) => g.id)).toEqual(run2.groups.map((g) => g.id));
      expect(run1.difficultyBreakdown).toEqual(run2.difficultyBreakdown);
      expect(run1.seed).toBe(run2.seed);
    });

    it('Seed khác nhau sinh ra các đề thi khác nhau (variety)', () => {
      const runA = generateToeicExam({ mode: '2skills_full', seed: 1111 });
      const runB = generateToeicExam({ mode: '2skills_full', seed: 9999 });

      const idsA = runA.questions.map((q) => q.id).join(',');
      const idsB = runB.questions.map((q) => q.id).join(',');

      expect(idsA).not.toBe(idsB);
    });

    it('createExamRng với chuỗi string hash thành công và cho dãy số nhất quán', () => {
      const rng1 = createExamRng('my-test-seed-key');
      const rng2 = createExamRng('my-test-seed-key');

      for (let i = 0; i < 5; i++) {
        expect(rng1.next()).toBe(rng2.next());
      }
    });
  });

  describe('7. Safe Fallback khi Custom Config hoặc Thiếu Pool', () => {
    it('Custom config yêu cầu group không chia hết được làm tròn an toàn (ceiling invariant)', () => {
      // Custom config: Part 3 yêu cầu 1 câu, nhưng group có 3 câu
      const customConfig: ExamModeConfig = {
        ...EXAM_MODE_CONFIGS['2skills_full'],
        partCounts: {
          ...EXAM_MODE_CONFIGS['2skills_full'].partCounts,
          part3_conv: 1, // Không chia hết cho 3
        },
      };

      const snapshot = generateToeicExam({
        mode: '2skills_full',
        config: customConfig,
        seed: 456,
      });

      // Generator không cắt group thành 1 câu, mà bảo vệ atomic lấy đủ cả group 3 câu
      expect(snapshot.partCounts.part3_conv).toBe(3);
      expect(snapshot.diagnostics.warnings.length).toBeGreaterThan(0);
      expect(snapshot.diagnostics.warnings[0]).toContain('atomic invariant');
    });

    it('Ngân hàng mini nhân tạo thiếu câu hỏi vẫn sinh an toàn không crash', () => {
      // Chỉ truyền 5 câu Part 5 và 1 group Part 3
      const miniBank: ToeicQuestion[] = TOEIC_QUESTION_BANK.filter(
        (q) => q.part === 'part5_grammar'
      ).slice(0, 4);

      const miniGroup = TOEIC_QUESTION_GROUPS[0]; // Part 3 group (3 câu)
      const miniGroupQuestions = miniGroup.questionIds
        .map((id) => TOEIC_QUESTION_BANK.find((q) => q.id === id)!)
        .filter(Boolean);

      const combinedMiniBank = [...miniBank, ...miniGroupQuestions];

      const customConfig: ExamModeConfig = {
        mode: 'custom_drill',
        name: 'Custom Mini Drill',
        description: 'Test pool thiếu',
        durationMinutes: 10,
        totalQuestions: 6,
        parts: ['part3_conv', 'part5_grammar'],
        partCounts: {
          part1_photos: 0,
          part2_qna: 0,
          part3_conv: 3,
          part4_talks: 0,
          part5_grammar: 3,
          part6_text: 0,
          part7_reading: 0,
          speaking_read: 0,
          writing_email: 0,
        },
        groupCounts: {
          part3_conv: 1,
        },
        difficultyDistribution: { easy: 0.33, medium: 0.33, hard: 0.34 },
        skillDistribution: { listening: 3, reading: 3 },
      };

      const snapshot = generateToeicExam({
        mode: 'custom_drill',
        config: customConfig,
        questionBank: combinedMiniBank,
        questionGroups: [miniGroup],
        seed: 789,
      });

      expect(snapshot.questions.length).toBe(6);
      expect(snapshot.groups).toHaveLength(1);
      const validation = validateExamSnapshot(snapshot);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('8. Stress Test (50 Seeds liên tiếp)', () => {
    it('50 lần sinh đề ngẫu nhiên liên tiếp đều hợp lệ 100% không phát sinh lỗi cấu trúc', () => {
      for (let s = 1; s <= 50; s++) {
        const snapshot = generateToeicExam({
          mode: s % 3 === 0 ? '4skills' : s % 2 === 0 ? '2skills_full' : '2skills_mini',
          seed: s * 1337,
        });

        const validation = validateExamSnapshot(snapshot);
        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);

        // Đảm bảo không trùng ID
        const ids = snapshot.questions.map((q) => q.id);
        expect(new Set(ids).size).toBe(snapshot.questions.length);

        // Đảm bảo atomic group
        snapshot.groups.forEach((g) => {
          g.questionIds.forEach((qId) => {
            expect(ids).toContain(qId);
          });
        });
      }
    });
  });
});
