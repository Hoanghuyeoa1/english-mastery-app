import { describe, it, expect } from 'vitest';
import {
  validateToeicQuestion,
  validateToeicGroup,
  validateToeicDataset,
  enrichLegacyQuestion,
  resolveQuestionGroup,
  resolveGroupQuestions,
  calculateTokenJaccardSimilarity,
} from '../toeicValidator';
import {
  TOEIC_QUESTION_BANK,
  TOEIC_QUESTION_GROUPS,
} from '../../data/toeicQuestionsData';
import {
  EXAM_MODE_CONFIGS,
  ToeicQuestion,
  ToeicQuestionGroup,
} from '../../types/toeic';

describe('toeicValidator & Data Contract Foundation', () => {
  describe('1. Validation Đơn Lẻ Câu Hỏi (Question Validator)', () => {
    it('Phát hiện ID rỗng hoặc thiếu', () => {
      const q: any = {
        id: '',
        part: 'part5_grammar',
        skill: 'reading',
        questionText: 'Test question',
        options: ['A. one', 'B. two', 'C. three', 'D. four'],
        correctAnswer: 'A',
        explanation: 'Test expl',
        vietnameseTranslation: 'Test dịch',
      };
      const errors = validateToeicQuestion(q);
      expect(errors.some((e) => e.code === 'EMPTY_QUESTION_ID')).toBe(true);
    });

    it('Phát hiện Duplicate Question ID', () => {
      const q: ToeicQuestion = {
        id: 'dup_1',
        part: 'part5_grammar',
        skill: 'reading',
        questionText: 'Test',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'Expl',
        vietnameseTranslation: 'Dịch',
      };
      const seen = new Set<string>(['dup_1']);
      const errors = validateToeicQuestion(q, seen);
      expect(errors.some((e) => e.code === 'DUPLICATE_QUESTION_ID')).toBe(true);
    });

    it('Phát hiện Part hoặc Skill không hợp lệ hoặc không khớp nhau', () => {
      const qInvalidPart: any = {
        id: 'q_bad_part',
        part: 'part9_invalid',
        skill: 'reading',
        questionText: 'Test',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'Expl',
        vietnameseTranslation: 'Dịch',
      };
      expect(validateToeicQuestion(qInvalidPart).some((e) => e.code === 'INVALID_PART')).toBe(true);

      const qMismatch: ToeicQuestion = {
        id: 'q_mismatch',
        part: 'part1_photos',
        skill: 'reading', // Part 1 phải là listening
        imageUrl: 'http://example.com/img.jpg',
        questionText: 'Test',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'Expl',
        vietnameseTranslation: 'Dịch',
      };
      expect(validateToeicQuestion(qMismatch).some((e) => e.code === 'SKILL_PART_MISMATCH')).toBe(true);
    });

    it('Phát hiện Difficulty hoặc EstimatedDifficulty không hợp lệ', () => {
      const qBadDiff: any = {
        id: 'q_bad_diff',
        part: 'part5_grammar',
        skill: 'reading',
        difficulty: 'extreme_hard',
        estimatedDifficulty: 1500, // max là 990
        questionText: 'Test',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'Expl',
        vietnameseTranslation: 'Dịch',
      };
      const errors = validateToeicQuestion(qBadDiff);
      expect(errors.some((e) => e.code === 'INVALID_DIFFICULTY')).toBe(true);
      expect(errors.some((e) => e.code === 'INVALID_ESTIMATED_DIFFICULTY')).toBe(true);
    });

    it('Phát hiện nội dung rỗng: questionText, explanation, vietnameseTranslation', () => {
      const qEmptyContent: ToeicQuestion = {
        id: 'q_empty_content',
        part: 'part5_grammar',
        skill: 'reading',
        questionText: '   ',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: '',
        vietnameseTranslation: '   ',
      };
      const errors = validateToeicQuestion(qEmptyContent);
      expect(errors.some((e) => e.code === 'EMPTY_QUESTION_TEXT')).toBe(true);
      expect(errors.some((e) => e.code === 'EMPTY_EXPLANATION')).toBe(true);
      expect(errors.some((e) => e.code === 'EMPTY_TRANSLATION')).toBe(true);
    });

    it('Phát hiện lỗi Options: thiếu options, options rỗng, correctAnswer không nằm trong options', () => {
      const qNoOptions: any = {
        id: 'q_no_opts',
        part: 'part5_grammar',
        skill: 'reading',
        questionText: 'Test',
        options: ['A', 'B'], // ít hơn 3
        correctAnswer: 'A',
        explanation: 'Expl',
        vietnameseTranslation: 'Dịch',
      };
      expect(validateToeicQuestion(qNoNoOptions(qNoOptions)).some((e) => e.code === 'INSUFFICIENT_OPTIONS')).toBe(true);

      const qEmptyOpt: ToeicQuestion = {
        id: 'q_empty_opt',
        part: 'part5_grammar',
        skill: 'reading',
        questionText: 'Test',
        options: ['A. one', '', 'C. three', 'D. four'],
        correctAnswer: 'A',
        explanation: 'Expl',
        vietnameseTranslation: 'Dịch',
      };
      expect(validateToeicQuestion(qEmptyOpt).some((e) => e.code === 'EMPTY_OPTION_TEXT')).toBe(true);

      const qInvalidAns: ToeicQuestion = {
        id: 'q_invalid_ans',
        part: 'part5_grammar',
        skill: 'reading',
        questionText: 'Test',
        options: ['A. one', 'B. two', 'C. three', 'D. four'],
        correctAnswer: 'Z', // Z không tồn tại
        explanation: 'Expl',
        vietnameseTranslation: 'Dịch',
      };
      expect(validateToeicQuestion(qInvalidAns).some((e) => e.code === 'CORRECT_ANSWER_NOT_IN_OPTIONS')).toBe(true);
    });

    function qNoNoOptions(q: any) {
      return q;
    }

    it('Phát hiện lỗi đặc thù Part 2: không thể có đáp án D vì Part 2 chỉ có 3 lựa chọn A, B, C', () => {
      const qPart2D: ToeicQuestion = {
        id: 'q_p2_d',
        part: 'part2_qna',
        skill: 'listening',
        questionText: 'Where is it?',
        options: ['A. Here', 'B. There', 'C. Anywhere'],
        correctAnswer: 'D',
        explanation: 'Expl',
        vietnameseTranslation: 'Dịch',
      };
      const errors = validateToeicQuestion(qPart2D);
      expect(errors.some((e) => e.code === 'INVALID_ANSWER_FOR_PART2')).toBe(true);
    });

    it('Phát hiện Speaking / Writing thiếu đề bài passage', () => {
      const qSpeakingNoPassage: ToeicQuestion = {
        id: 'sp_no_passage',
        part: 'speaking_read',
        skill: 'speaking',
        questionText: 'Read the text',
        passage: '', // Thiếu đề bài
        explanation: 'Rubric',
        vietnameseTranslation: 'Dịch',
      };
      expect(validateToeicQuestion(qSpeakingNoPassage).some((e) => e.code === 'MISSING_TASK_PASSAGE')).toBe(true);
    });

    it('Phát hiện Part 1 thiếu hình ảnh imageUrl', () => {
      const qPart1NoImg: ToeicQuestion = {
        id: 'p1_no_img',
        part: 'part1_photos',
        skill: 'listening',
        questionText: 'Look at picture',
        imageUrl: '',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'Expl',
        vietnameseTranslation: 'Dịch',
      };
      expect(validateToeicQuestion(qPart1NoImg).some((e) => e.code === 'MISSING_PHOTO_IMAGE')).toBe(true);
    });
  });

  describe('2. Validation Nhóm Câu Hỏi (Group Integrity & Invariants)', () => {
    const mockQ1: ToeicQuestion = {
      id: 'q_grp_1',
      part: 'part7_reading',
      skill: 'reading',
      groupId: 'g_1',
      questionText: 'Q1',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      explanation: 'Exp',
      vietnameseTranslation: 'Dịch',
    };
    const mockQ2: ToeicQuestion = {
      id: 'q_grp_2',
      part: 'part7_reading',
      skill: 'reading',
      groupId: 'g_1',
      questionText: 'Q2',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'B',
      explanation: 'Exp',
      vietnameseTranslation: 'Dịch',
    };
    const qMap = new Map<string, ToeicQuestion>([
      [mockQ1.id, mockQ1],
      [mockQ2.id, mockQ2],
    ]);

    it('Phát hiện group rỗng không có câu hỏi (questionIds rỗng)', () => {
      const gEmpty: ToeicQuestionGroup = {
        id: 'g_empty',
        part: 'part7_reading',
        skill: 'reading',
        type: 'reading_single',
        passageText: 'Passage',
        questionIds: [],
      };
      const errors = validateToeicGroup(gEmpty, qMap);
      expect(errors.some((e) => e.code === 'GROUP_MISSING_QUESTIONS')).toBe(true);
    });

    it('Phát hiện Orphan Question trong group (ID không tồn tại trong ngân hàng câu hỏi)', () => {
      const gOrphan: ToeicQuestionGroup = {
        id: 'g_orphan',
        part: 'part7_reading',
        skill: 'reading',
        type: 'reading_single',
        passageText: 'Passage',
        questionIds: ['q_non_existent'],
      };
      const errors = validateToeicGroup(gOrphan, qMap);
      expect(errors.some((e) => e.code === 'ORPHAN_QUESTION_IN_GROUP')).toBe(true);
    });

    it('Phát hiện Duplicate Question trong cùng một group', () => {
      const gDupInternal: ToeicQuestionGroup = {
        id: 'g_dup',
        part: 'part7_reading',
        skill: 'reading',
        type: 'reading_single',
        passageText: 'Passage',
        questionIds: ['q_grp_1', 'q_grp_1'],
      };
      const errors = validateToeicGroup(gDupInternal, qMap);
      expect(errors.some((e) => e.code === 'DUPLICATE_QUESTION_IN_SAME_GROUP')).toBe(true);
    });

    it('Phát hiện Duplicate Group Membership: một câu hỏi nằm trong 2 nhóm khác nhau', () => {
      const seenGroupQuestions = new Map<string, string>();
      seenGroupQuestions.set('q_grp_1', 'g_original');

      const gSecond: ToeicQuestionGroup = {
        id: 'g_second',
        part: 'part7_reading',
        skill: 'reading',
        type: 'reading_single',
        passageText: 'Passage',
        questionIds: ['q_grp_1'],
      };

      const errors = validateToeicGroup(gSecond, qMap, new Set(), seenGroupQuestions);
      expect(errors.some((e) => e.code === 'DUPLICATE_GROUP_MEMBERSHIP')).toBe(true);
    });

    it('Phát hiện Reading group thiếu passageText', () => {
      const qNoPassageMap = new Map<string, ToeicQuestion>([
        [
          'q_no_pass',
          {
            id: 'q_no_pass',
            part: 'part7_reading',
            skill: 'reading',
            questionText: 'Test',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A',
            explanation: 'Exp',
            vietnameseTranslation: 'Dịch',
          },
        ],
      ]);
      const gNoPassage: ToeicQuestionGroup = {
        id: 'g_no_passage',
        part: 'part7_reading',
        skill: 'reading',
        type: 'reading_single',
        passageText: '',
        questionIds: ['q_no_pass'],
      };
      const errors = validateToeicGroup(gNoPassage, qNoPassageMap);
      expect(errors.some((e) => e.code === 'MISSING_GROUP_PASSAGE')).toBe(true);
    });

    it('Phát hiện câu hỏi chỉ định groupId không tồn tại (Orphan Group Pointer)', () => {
      const orphanQuestion: ToeicQuestion = {
        id: 'q_orphan_ptr',
        part: 'part7_reading',
        skill: 'reading',
        groupId: 'non_existent_group',
        questionText: 'Test',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'Exp',
        vietnameseTranslation: 'Dịch',
      };
      const res = validateToeicDataset([orphanQuestion], []);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.code === 'ORPHAN_GROUP_POINTER')).toBe(true);
    });
  });

  describe('3. Validation Dataset Dự Án Hiện Tại (Actual Dataset Integrity)', () => {
    it('Dataset hiện tại (28 câu hỏi + 8 groups) vượt qua toàn bộ validation với 0 lỗi', () => {
      const result = validateToeicDataset(TOEIC_QUESTION_BANK, TOEIC_QUESTION_GROUPS);

      if (result.errors.length > 0) {
        console.error('Validation errors found in TOEIC dataset:', result.errors);
      }

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('Số lượng câu hỏi khớp chính xác 240 câu và phân loại đúng từng Part', () => {
      const result = validateToeicDataset(TOEIC_QUESTION_BANK, TOEIC_QUESTION_GROUPS);
      const { stats } = result;

      expect(stats.totalQuestions).toBe(240);
      expect(stats.totalGroups).toBe(36);
      expect(stats.byPart.part1_photos).toBe(20);
      expect(stats.byPart.part2_qna).toBe(30);
      expect(stats.byPart.part3_conv).toBe(30);
      expect(stats.byPart.part4_talks).toBe(27);
      expect(stats.byPart.part5_grammar).toBe(42);
      expect(stats.byPart.part6_text).toBe(24);
      expect(stats.byPart.part7_reading).toBe(27);
      expect(stats.byPart.speaking_read).toBe(20);
      expect(stats.byPart.writing_email).toBe(20);

      // Kỹ năng
      expect(stats.bySkill.listening).toBe(107); // 20 + 30 + 30 + 27
      expect(stats.bySkill.reading).toBe(93);    // 42 + 24 + 27
      expect(stats.bySkill.speaking).toBe(20);
      expect(stats.bySkill.writing).toBe(20);

      // Phân bố độ khó
      expect(stats.byDifficulty.easy).toBeGreaterThan(0);
      expect(stats.byDifficulty.medium).toBeGreaterThan(0);
      expect(stats.byDifficulty.hard).toBeGreaterThan(0);
      expect(stats.byDifficulty.unspecified).toBe(0);
    });

    it('Tất cả 240 câu hỏi đều có metadata chuẩn hóa (difficulty, topic, subSkill, questionType, vocabularyTags, grammarTags, estimatedDifficulty)', () => {
      TOEIC_QUESTION_BANK.forEach((q) => {
        expect(q.difficulty).toMatch(/easy|medium|hard/);
        expect(q.topic).toBeTruthy();
        expect(q.subSkill).toBeTruthy();
        expect(q.questionType).toBeTruthy();
        expect(Array.isArray(q.vocabularyTags)).toBe(true);
        expect(q.vocabularyTags!.length).toBeGreaterThan(0);
        expect(Array.isArray(q.grammarTags)).toBe(true);
        expect(q.grammarTags!.length).toBeGreaterThan(0);
        expect(typeof q.estimatedDifficulty).toBe('number');
        expect(q.estimatedDifficulty).toBeGreaterThanOrEqual(100);
        expect(q.estimatedDifficulty).toBeLessThanOrEqual(990);
      });
    });

    it('Invariants của Group: resolve được 2 chiều question <-> group không bị orphan trên toàn bộ 36 groups', () => {
      // 1. Mọi question có groupId đều resolve được group chính xác
      const groupedQuestions = TOEIC_QUESTION_BANK.filter((q) => q.groupId);
      expect(groupedQuestions.length).toBe(30 + 27 + 24 + 27); // P3 (30) + P4 (27) + P6 (24) + P7 (27) = 108 câu

      groupedQuestions.forEach((q) => {
        const grp = resolveQuestionGroup(q.id, TOEIC_QUESTION_BANK, TOEIC_QUESTION_GROUPS);
        expect(grp).toBeDefined();
        expect(grp!.id).toBe(q.groupId);
        expect(grp!.questionIds).toContain(q.id);
      });

      // 2. Mọi group đều resolve được toàn bộ câu hỏi của nó
      TOEIC_QUESTION_GROUPS.forEach((grp) => {
        const qs = resolveGroupQuestions(grp.id, TOEIC_QUESTION_BANK, TOEIC_QUESTION_GROUPS);
        expect(qs).toHaveLength(grp.questionIds.length);
        qs.forEach((q) => {
          expect(grp.questionIds).toContain(q.id);
          expect(q.groupId).toBe(grp.id);
        });
      });
    });
  });

  describe('4. Backward-Compatible Adapter (enrichLegacyQuestion)', () => {
    it('Bổ sung metadata an toàn cho câu hỏi legacy thiếu trường', () => {
      const legacyQ: ToeicQuestion = {
        id: 'legacy_1',
        part: 'part1_photos',
        skill: 'listening',
        questionText: 'Look at the photo',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'Test',
        vietnameseTranslation: 'Dịch',
      };

      const enriched = enrichLegacyQuestion(legacyQ);
      expect(enriched.id).toBe('legacy_1');
      expect(enriched.difficulty).toBe('easy');
      expect(enriched.estimatedDifficulty).toBe(400);
      expect(enriched.questionType).toBe('photo_action');
    });
  });

  describe('5. Exam Mode Rules Foundation (EXAM_MODE_CONFIGS)', () => {
    it('Config cho 2skills_mini hợp lệ và bảo toàn cấu trúc 10 câu', () => {
      const cfg = EXAM_MODE_CONFIGS['2skills_mini'];
      expect(cfg.totalQuestions).toBe(10);
      expect(cfg.durationMinutes).toBe(15);
      expect(cfg.parts).toHaveLength(7);

      const sumPartCounts = Object.values(cfg.partCounts).reduce((a, b) => a + b, 0);
      expect(sumPartCounts).toBe(10);

      const sumSkillCounts =
        cfg.skillDistribution.listening +
        cfg.skillDistribution.reading +
        (cfg.skillDistribution.speaking || 0) +
        (cfg.skillDistribution.writing || 0);
      expect(sumSkillCounts).toBe(10);
    });

    it('Config cho 2skills_full hợp lệ và bảo toàn cấu trúc 20 câu', () => {
      const cfg = EXAM_MODE_CONFIGS['2skills_full'];
      expect(cfg.totalQuestions).toBe(20);
      expect(cfg.durationMinutes).toBe(30);

      const sumPartCounts = Object.values(cfg.partCounts).reduce((a, b) => a + b, 0);
      expect(sumPartCounts).toBe(20);

      const sumSkillCounts =
        cfg.skillDistribution.listening +
        cfg.skillDistribution.reading +
        (cfg.skillDistribution.speaking || 0) +
        (cfg.skillDistribution.writing || 0);
      expect(sumSkillCounts).toBe(20);
    });

    it('Config cho 4skills hợp lệ và bảo toàn cấu trúc 24 câu', () => {
      const cfg = EXAM_MODE_CONFIGS['4skills'];
      expect(cfg.totalQuestions).toBe(24);
      expect(cfg.durationMinutes).toBe(35);

      const sumPartCounts = Object.values(cfg.partCounts).reduce((a, b) => a + b, 0);
      expect(sumPartCounts).toBe(24);

      expect(cfg.skillDistribution.speaking).toBe(2);
      expect(cfg.skillDistribution.writing).toBe(2);
    });
  });

  describe('6. Index Foundation (toeicQuestionIndex O(1) Lookups)', () => {
    it('Tra cứu câu hỏi và nhóm theo ID tức thời', async () => {
      const { toeicQuestionIndex } = await import('../toeicIndex');

      const q = toeicQuestionIndex.getQuestionById('toeic_p1_1');
      expect(q).toBeDefined();
      expect(q?.part).toBe('part1_photos');

      const g = toeicQuestionIndex.getGroupById('toeic_grp_p3_1');
      expect(g).toBeDefined();
      expect(g?.part).toBe('part3_conv');
      expect(g?.questionIds).toContain('toeic_p3_1');
    });

    it('Tra cứu danh sách câu hỏi theo Part và theo Skill chính xác', async () => {
      const { toeicQuestionIndex } = await import('../toeicIndex');

      const p5Questions = toeicQuestionIndex.getQuestionsByPart('part5_grammar');
      expect(p5Questions).toHaveLength(42);

      const listeningQuestions = toeicQuestionIndex.getQuestionsBySkill('listening');
      expect(listeningQuestions).toHaveLength(107);

      const readingQuestions = toeicQuestionIndex.getQuestionsBySkill('reading');
      expect(readingQuestions).toHaveLength(93);
    });

    it('Tra cứu câu hỏi thuộc nhóm và nhóm của câu hỏi', async () => {
      const { toeicQuestionIndex } = await import('../toeicIndex');

      const groupP6 = toeicQuestionIndex.getGroupById('toeic_grp_p6_1');
      expect(groupP6).toBeDefined();

      const questionsOfGroup = toeicQuestionIndex.getQuestionsByGroupId('toeic_grp_p6_1');
      expect(questionsOfGroup).toHaveLength(3);
      expect(questionsOfGroup.map((item) => item.id)).toEqual(['toeic_p6_1', 'toeic_p6_2', 'toeic_p6_3']);

      const parentGroup = toeicQuestionIndex.getGroupByQuestionId('toeic_p6_2');
      expect(parentGroup).toBeDefined();
      expect(parentGroup?.id).toBe('toeic_grp_p6_1');
    });

    it('Query câu hỏi với bộ lọc kết hợp (Part + Difficulty + Topic)', async () => {
      const { toeicQuestionIndex } = await import('../toeicIndex');

      const easyP5 = toeicQuestionIndex.queryQuestions({
        part: 'part5_grammar',
        difficulty: 'easy',
      });
      expect(easyP5.length).toBeGreaterThan(0);
      expect(easyP5.every((item) => item.part === 'part5_grammar' && item.difficulty === 'easy')).toBe(true);

      const groupedP7 = toeicQuestionIndex.queryQuestions({
        part: 'part7_reading',
        hasGroup: true,
      });
      expect(groupedP7).toHaveLength(27);
    });

    it('Chỉ mục thống kê tổng quan (getStats) nhất quán với dataset', async () => {
      const { toeicQuestionIndex } = await import('../toeicIndex');
      const stats = toeicQuestionIndex.getStats();

      expect(stats.totalQuestions).toBe(240);
      expect(stats.totalGroups).toBe(36);
      expect(stats.partCounts.part1_photos).toBe(20);
      expect(stats.partCounts.part5_grammar).toBe(42);
      expect(stats.skillCounts.speaking).toBe(20);
      expect(stats.skillCounts.writing).toBe(20);
      expect(stats.groupPartCounts.part3_conv).toBe(10);
      expect(stats.groupPartCounts.part4_talks).toBe(9);
      expect(stats.groupPartCounts.part6_text).toBe(8);
      expect(stats.groupPartCounts.part7_reading).toBe(9);
    });
  });

  describe('7. Strict Metadata & Duplicate Detection Baseline (Phase 1)', () => {
    const validBaseQuestion: ToeicQuestion = {
      id: 'valid_q_1',
      part: 'part5_grammar',
      skill: 'reading',
      difficulty: 'medium',
      estimatedDifficulty: 650,
      topic: 'office_procedures',
      subSkill: 'grammar_conjunction',
      questionType: 'grammar_pos',
      vocabularyTags: ['procedure', 'office'],
      grammarTags: ['conjunctions'],
      questionText: 'The meeting was postponed due to inclement weather.',
      options: ['A. due to', 'B. because', 'C. although', 'D. despite of'],
      correctAnswer: 'A',
      explanation: 'Due to is followed by a noun phrase.',
      vietnameseTranslation: 'Cuộc họp bị hoãn do thời tiết khắc nghiệt.',
    };

    it('Phát hiện thiếu difficulty và thiếu estimatedDifficulty', () => {
      const qNoDiff: any = { ...validBaseQuestion, difficulty: undefined };
      const errDiff = validateToeicQuestion(qNoDiff);
      expect(errDiff.some((e) => e.code === 'MISSING_DIFFICULTY')).toBe(true);

      const qNoEstDiff: any = { ...validBaseQuestion, estimatedDifficulty: undefined };
      const errEst = validateToeicQuestion(qNoEstDiff);
      expect(errEst.some((e) => e.code === 'MISSING_ESTIMATED_DIFFICULTY')).toBe(true);
    });

    it('Phát hiện thiếu topic, subSkill hoặc questionType', () => {
      const qNoTopic: any = { ...validBaseQuestion, topic: '   ' };
      expect(validateToeicQuestion(qNoTopic).some((e) => e.code === 'EMPTY_TOPIC')).toBe(true);

      const qNoSubSkill: any = { ...validBaseQuestion, subSkill: '' };
      expect(validateToeicQuestion(qNoSubSkill).some((e) => e.code === 'EMPTY_SUB_SKILL')).toBe(true);

      const qNoType: any = { ...validBaseQuestion, questionType: '' };
      expect(validateToeicQuestion(qNoType).some((e) => e.code === 'EMPTY_QUESTION_TYPE')).toBe(true);
    });

    it('Phát hiện mảng vocabularyTags hoặc grammarTags rỗng / không hợp lệ', () => {
      const qNoVocab: any = { ...validBaseQuestion, vocabularyTags: [] };
      expect(validateToeicQuestion(qNoVocab).some((e) => e.code === 'MISSING_VOCABULARY_TAGS')).toBe(true);

      const qNoGrammar: any = { ...validBaseQuestion, grammarTags: [] };
      expect(validateToeicQuestion(qNoGrammar).some((e) => e.code === 'MISSING_GRAMMAR_TAGS')).toBe(true);
    });

    it('Phát hiện câu hỏi thuộc grouped parts (Part 3, 4, 6, 7) nhưng thiếu groupId', () => {
      const qPart3NoGroup: ToeicQuestion = {
        ...validBaseQuestion,
        id: 'q_p3_nogroup',
        part: 'part3_conv',
        skill: 'listening',
        groupId: undefined,
      };
      const errors = validateToeicQuestion(qPart3NoGroup);
      expect(errors.some((e) => e.code === 'MISSING_GROUP_ID')).toBe(true);
    });

    it('validateToeicDataset: Phát hiện trùng lặp exact duplicate questionText (ngoài Part 1 & 2)', () => {
      const q1: ToeicQuestion = {
        ...validBaseQuestion,
        id: 'dup_text_1',
        questionText: 'Employees must submit their expense reports by Friday.',
      };
      const q2: ToeicQuestion = {
        ...validBaseQuestion,
        id: 'dup_text_2',
        questionText: '  Employees must submit their expense reports by Friday.  ',
      };

      const result = validateToeicDataset([q1, q2], []);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'DUPLICATE_QUESTION_TEXT')).toBe(true);
    });

    it('validateToeicDataset: Cho phép Part 1 và Part 2 dùng cùng mẫu câu hỏi chuẩn nhưng phát hiện duplicate audioScript', () => {
      const p2_1: ToeicQuestion = {
        ...validBaseQuestion,
        id: 'p2_dup_1',
        part: 'part2_qna',
        skill: 'listening',
        questionText: 'Part 2: Nghe câu hỏi và chọn câu trả lời thích hợp nhất.',
        audioScript: 'Where is the conference room located?',
        options: ['A. On the second floor', 'B. At 2 PM', 'C. Yes, I did'],
      };
      const p2_2: ToeicQuestion = {
        ...validBaseQuestion,
        id: 'p2_dup_2',
        part: 'part2_qna',
        skill: 'listening',
        questionText: 'Part 2: Nghe câu hỏi và chọn câu trả lời thích hợp nhất.',
        audioScript: 'Where is the conference room located?',
        options: ['A. Turn right', 'B. Tomorrow', 'C. No, thank you'],
      };

      const result = validateToeicDataset([p2_1, p2_2], []);
      // Không báo lỗi duplicate questionText vì Part 2 dùng template chung
      expect(result.errors.some((e) => e.code === 'DUPLICATE_QUESTION_TEXT')).toBe(false);
      // Nhưng bắt buộc báo lỗi duplicate audioScript
      expect(result.errors.some((e) => e.code === 'DUPLICATE_AUDIO_SCRIPT')).toBe(true);
    });

    it('validateToeicDataset: Phát hiện trùng lặp passageText hoặc audioScript giữa các nhóm (Duplicate Group Content)', () => {
      const g1: ToeicQuestionGroup = {
        id: 'grp_dup_pass_1',
        part: 'part7_reading',
        skill: 'reading',
        type: 'reading_single',
        passageText: 'Dear Mr. Smith, Thank you for attending our workshop yesterday.',
        questionIds: ['q_dummy_1'],
      };
      const g2: ToeicQuestionGroup = {
        id: 'grp_dup_pass_2',
        part: 'part7_reading',
        skill: 'reading',
        type: 'reading_single',
        passageText: 'Dear Mr. Smith, Thank you for attending our workshop yesterday.',
        questionIds: ['q_dummy_2'],
      };

      const qDummy1 = { ...validBaseQuestion, id: 'q_dummy_1', part: 'part7_reading' as const, groupId: 'grp_dup_pass_1' };
      const qDummy2 = { ...validBaseQuestion, id: 'q_dummy_2', part: 'part7_reading' as const, groupId: 'grp_dup_pass_2' };

      const result = validateToeicDataset([qDummy1, qDummy2], [g1, g2]);
      expect(result.errors.some((e) => e.code === 'DUPLICATE_GROUP_PASSAGE')).toBe(true);
    });

    it('validateToeicDataset: Phát hiện cảnh báo near-duplicate heuristic khi độ tương đồng từ vựng >= 85%', () => {
      const qOrig: ToeicQuestion = {
        ...validBaseQuestion,
        id: 'q_near_orig',
        questionText: 'All employees are required to attend the mandatory safety training session on Monday morning.',
      };
      // Copy-paste chỉ thay 1 từ "Monday" thành "Tuesday"
      const qClone: ToeicQuestion = {
        ...validBaseQuestion,
        id: 'q_near_clone',
        questionText: 'All employees are required to attend the mandatory safety training session on Tuesday morning.',
      };

      const sim = calculateTokenJaccardSimilarity(qOrig.questionText, qClone.questionText);
      expect(sim).toBeGreaterThanOrEqual(0.85);

      const result = validateToeicDataset([qOrig, qClone], []);
      expect(result.warnings.some((w) => w.code === 'NEAR_DUPLICATE_QUESTION_TEXT')).toBe(true);
    });
  });
});
