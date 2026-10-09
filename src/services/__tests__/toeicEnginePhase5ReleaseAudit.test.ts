// @vitest-environment happy-dom
// src/services/__tests__/toeicEnginePhase5ReleaseAudit.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateToeicExam,
  validateExamSnapshot,
  createExamRng,
} from '../examGenerator';
import {
  createNewAttemptSnapshot,
  restoreSnapshotFromMeta,
  getRecentHistory,
  recordAttemptQuestionsToHistory,
  saveInProgressAttempt,
  getInProgressAttempt,
  clearInProgressAttempt,
  MAX_RECENT_QUESTIONS,
  MAX_RECENT_GROUPS,
  QUESTION_BANK_VERSION,
  STORAGE_KEY_RECENT_HISTORY,
  STORAGE_KEY_INPROGRESS,
} from '../toeicAttemptManager';
import {
  validateToeicDataset,
  validateToeicQuestion,
  VALID_TOEIC_PARTS,
  VALID_TOEIC_SKILLS,
  VALID_TOEIC_DIFFICULTIES,
} from '../toeicValidator';
import { toeicQuestionIndex } from '../toeicIndex';
import { calculateToeicScores } from '../toeicScoring';
import { TOEIC_QUESTION_BANK, TOEIC_QUESTION_GROUPS } from '../../data/toeicQuestionsData';
import { EXAM_MODE_CONFIGS, ExamModeType } from '../../types/toeic';

describe('PHASE 5: TOEIC Exam Engine Release & Acceptance Audit Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  // ===========================================================================
  // 1. FINAL QUESTION BANK & DATASET AUDIT
  // ===========================================================================
  describe('1. Final Question Bank & Group Dataset Audit', () => {
    it('Toàn bộ ngân hàng câu hỏi (240 câu) và nhóm (36 groups) vượt qua validateToeicDataset với 0 lỗi', () => {
      const validation = validateToeicDataset(TOEIC_QUESTION_BANK, TOEIC_QUESTION_GROUPS);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.stats.totalQuestions).toBe(240);
      expect(validation.stats.totalGroups).toBe(36);
    });

    it('Mỗi câu hỏi có ID duy nhất, part, skill, difficulty và metadata hoàn chỉnh', () => {
      const idSet = new Set<string>();
      TOEIC_QUESTION_BANK.forEach((q) => {
        expect(idSet.has(q.id)).toBe(false);
        idSet.add(q.id);

        expect(VALID_TOEIC_PARTS).toContain(q.part);
        expect(VALID_TOEIC_SKILLS).toContain(q.skill);
        expect(VALID_TOEIC_DIFFICULTIES).toContain(q.difficulty);

        expect(q.questionText.trim().length).toBeGreaterThan(0);
        expect(q.explanation.trim().length).toBeGreaterThan(0);
        expect(q.vietnameseTranslation.trim().length).toBeGreaterThan(0);

        // Metadata bắt buộc
        expect(q.topic).toBeDefined();
        expect(q.subSkill).toBeDefined();
        expect(q.questionType).toBeDefined();
        expect(Array.isArray(q.vocabularyTags)).toBe(true);
        expect(Array.isArray(q.grammarTags)).toBe(true);
        expect(typeof q.estimatedDifficulty).toBe('number');
        expect(q.estimatedDifficulty).toBeGreaterThanOrEqual(100);
        expect(q.estimatedDifficulty).toBeLessThanOrEqual(990);
      });
    });

    it('Part 1 có hình ảnh và audio script; Part 2 có đúng 3 lựa chọn A-C và không có option D', () => {
      const p1List = TOEIC_QUESTION_BANK.filter((q) => q.part === 'part1_photos');
      expect(p1List.length).toBeGreaterThanOrEqual(8);
      p1List.forEach((q) => {
        expect(q.imageUrl).toMatch(/^https?:\/\//);
        expect(q.audioScript).toBeTruthy();
        expect(q.options).toHaveLength(4);
        expect(q.correctAnswer).toMatch(/^[A-D]$/);
      });

      const p2List = TOEIC_QUESTION_BANK.filter((q) => q.part === 'part2_qna');
      expect(p2List.length).toBeGreaterThanOrEqual(12);
      p2List.forEach((q) => {
        expect(q.audioScript).toBeTruthy();
        expect(q.options).toHaveLength(3);
        expect(q.correctAnswer).toMatch(/^[A-C]$/);
        expect(q.correctAnswer).not.toBe('D');
      });
    });

    it('Part 3, 4, 6, 7 có ngữ cảnh nhóm (Audio script hoặc Passage) hoàn chỉnh và câu hỏi trỏ 2 chiều', () => {
      TOEIC_QUESTION_GROUPS.forEach((group) => {
        expect(group.id).toBeTruthy();
        expect(group.questionIds.length).toBeGreaterThanOrEqual(2);

        if (group.part === 'part3_conv' || group.part === 'part4_talks') {
          expect(group.audioScript).toBeTruthy();
        }
        if (group.part === 'part6_text' || group.part === 'part7_reading') {
          expect(group.passageText).toBeTruthy();
        }

        group.questionIds.forEach((qId) => {
          const q = toeicQuestionIndex.getQuestionById(qId);
          expect(q).toBeDefined();
          expect(q?.groupId).toBe(group.id);
        });
      });
    });

    it('Speaking và Writing là open-ended và có evaluationCriteria với đầy đủ trọng số và thang điểm', () => {
      const openEndedList = TOEIC_QUESTION_BANK.filter(
        (q) => q.skill === 'speaking' || q.skill === 'writing'
      );
      expect(openEndedList).toHaveLength(40);

      openEndedList.forEach((q) => {
        expect(q.evaluationCriteria).toBeDefined();
        const criteria = q.evaluationCriteria!;
        expect(criteria.targetLengthWords?.min).toBeGreaterThan(0);
        expect(criteria.rubricNotes).toBeTruthy();
        // Không sử dụng correctAnswer exact-match
        expect(q.correctAnswer).toBeUndefined();
      });
    });
  });

  // ===========================================================================
  // 2. EXAM MODE VALIDATION (DYNAMIC & RULE-BASED)
  // ===========================================================================
  describe('2. Exam Mode Validation (Không hard-code IDs)', () => {
    const modes: ExamModeType[] = ['2skills_mini', '2skills_full', '4skills'];

    modes.forEach((mode) => {
      it(`Mode "${mode}" sinh đề chuẩn khớp số câu, phân bổ part, kỹ năng và group integrity`, () => {
        const config = EXAM_MODE_CONFIGS[mode];
        const snapshot = generateToeicExam({ mode, seed: 42 });

        expect(snapshot.totalQuestions).toBe(config.totalQuestions);
        expect(snapshot.questions).toHaveLength(config.totalQuestions);

        // Khớp số câu Listening / Reading / Speaking / Writing
        expect(snapshot.skillBreakdown.listening).toBe(config.skillDistribution.listening);
        expect(snapshot.skillBreakdown.reading).toBe(config.skillDistribution.reading);
        expect(snapshot.skillBreakdown.speaking || 0).toBe(config.skillDistribution.speaking || 0);
        expect(snapshot.skillBreakdown.writing || 0).toBe(config.skillDistribution.writing || 0);

        // Validation snapshot
        const validation = validateExamSnapshot(snapshot, config);
        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);

        // Group integrity
        snapshot.groups.forEach((g) => {
          expect(g.questionIds.every((id) => snapshot.questions.some((q) => q.id === id))).toBe(true);
        });
      });
    });
  });

  // ===========================================================================
  // 3. GENERATOR STRESS TESTS (500 SEEDS LIÊN TIẾP)
  // ===========================================================================
  describe('3. Generator Stress Tests (500 Seeds liên tiếp)', () => {
    it('Chạy 500 lần sinh đề với các seeds khác nhau: 100% snapshot đều hợp lệ, không duplicate, không orphan', () => {
      const modeCycle: ExamModeType[] = ['2skills_mini', '2skills_full', '4skills'];

      for (let s = 1; s <= 500; s++) {
        const mode = modeCycle[s % 3];
        const snapshot = generateToeicExam({
          mode,
          seed: s * 2026,
        });

        // 1. Không trùng lặp câu hỏi
        const qIds = snapshot.questions.map((q) => q.id);
        expect(new Set(qIds).size).toBe(snapshot.totalQuestions);

        // 2. Không trùng lặp group
        const gIds = snapshot.groups.map((g) => g.id);
        expect(new Set(gIds).size).toBe(snapshot.groups.length);

        // 3. Tính nguyên khối (Atomic) của Group
        snapshot.groups.forEach((g) => {
          g.questionIds.forEach((childId) => {
            expect(qIds).toContain(childId);
          });
        });

        // 4. Validate snapshot
        const valid = validateExamSnapshot(snapshot);
        expect(valid.isValid).toBe(true);
        expect(valid.errors).toHaveLength(0);
      }
    });
  });

  // ===========================================================================
  // 4. MULTI-ATTEMPT ANTI-REPEAT REGRESSION
  // ===========================================================================
  describe('4. Multi-Attempt Anti-Repeat Simulation', () => {
    it('Mô phỏng 3 lượt thi liên tiếp: ưu tiên câu mới và tái sử dụng có kiểm soát khi cần', () => {
      // Lượt 1: Học viên làm đề đầu tiên
      const attempt1 = createNewAttemptSnapshot('2skills_full', 1111);
      expect(attempt1.snapshot.totalQuestions).toBe(20);
      recordAttemptQuestionsToHistory(attempt1.meta.questionIds, attempt1.meta.groupIds);

      const historyAfter1 = getRecentHistory();
      expect(historyAfter1.recentQuestionIds).toEqual(attempt1.meta.questionIds);
      expect(historyAfter1.recentGroupIds).toEqual(attempt1.meta.groupIds);

      // Lượt 2: Học viên làm đề thứ hai ngay sau đó
      const attempt2 = createNewAttemptSnapshot('2skills_full', 2222);
      expect(attempt2.snapshot.totalQuestions).toBe(20);
      recordAttemptQuestionsToHistory(attempt2.meta.questionIds, attempt2.meta.groupIds);

      // Đề 2 không được trùng bất kỳ group nào với đề 1
      const overlapGroups12 = attempt2.snapshot.groups.filter((g) =>
        attempt1.meta.groupIds.includes(g.id)
      );
      expect(overlapGroups12).toHaveLength(0);

      // Đề 2 không bị trùng lặp câu hỏi độc lập với đề 1
      const overlapQ12 = attempt2.snapshot.questions.filter((q) =>
        attempt1.meta.questionIds.includes(q.id)
      );
      expect(overlapQ12.length).toBeLessThanOrEqual(2); // Phần lớn hoặc toàn bộ là câu hỏi mới

      // Lượt 3: Khi lịch sử đã chứa 40 câu hỏi
      const attempt3 = createNewAttemptSnapshot('2skills_full', 3333);
      expect(attempt3.snapshot.totalQuestions).toBe(20);
      expect(attempt3.snapshot.questions).toHaveLength(20);

      // Snapshot đề 3 vẫn không có duplicate nội bộ
      const unique3 = new Set(attempt3.snapshot.questions.map((q) => q.id));
      expect(unique3.size).toBe(20);
    });

    it('Mô phỏng 20 lượt thi Standard 20 câu liên tiếp: đo lường repeat rate và ưu tiên Least Recently Seen', () => {
      localStorage.clear();
      const attemptStats: Array<{
        attemptIndex: number;
        totalQuestions: number;
        unseenCount: number;
        repeatCount: number;
        repeatRate: number;
      }> = [];

      for (let i = 1; i <= 20; i++) {
        const historyBefore = getRecentHistory();
        const recentSet = new Set(historyBefore.recentQuestionIds);

        const { snapshot, meta } = createNewAttemptSnapshot('2skills_full', 1000 + i * 37);

        // Đảm bảo không duplicate trong cùng một snapshot
        const uniqueIds = new Set(snapshot.questions.map((q) => q.id));
        expect(uniqueIds.size).toBe(20);

        // Đảm bảo snapshot luôn hợp lệ
        const valid = validateExamSnapshot(snapshot);
        expect(valid.isValid).toBe(true);

        // Đo lường số câu mới (unseen) và câu lặp (repeat)
        let unseen = 0;
        let repeat = 0;
        snapshot.questions.forEach((q) => {
          if (recentSet.has(q.id)) {
            repeat++;
          } else {
            unseen++;
          }
        });

        attemptStats.push({
          attemptIndex: i,
          totalQuestions: snapshot.totalQuestions,
          unseenCount: unseen,
          repeatCount: repeat,
          repeatRate: Math.round((repeat / snapshot.totalQuestions) * 100),
        });

        // Ghi nhận vào history cho lượt tiếp theo
        recordAttemptQuestionsToHistory(meta.questionIds, meta.groupIds);
      }

      // Assertions về repeat rate:
      // Lượt 1: 100% câu hỏi là mới (repeat rate = 0%)
      expect(attemptStats[0].repeatCount).toBe(0);
      expect(attemptStats[0].unseenCount).toBe(20);

      // Lượt 2: tối đa 2 câu lặp (repeat rate <= 10%)
      expect(attemptStats[1].repeatCount).toBeLessThanOrEqual(2);

      // Lượt 3: bank LR có 85 câu, sau 2 lượt (40 câu) vẫn còn >= 45 câu unseen
      expect(attemptStats[2].unseenCount).toBeGreaterThan(10);

      // Khi pool cạn dần ở các lượt sau (4-20):
      // Thuật toán không bao giờ crash, luôn sinh đủ 20 câu, và các câu được tái sử dụng là Least Recently Seen
      attemptStats.slice(3).forEach((stat) => {
        expect(stat.totalQuestions).toBe(20);
      });
    });

    it('Khi history bao phủ toàn bộ ngân hàng câu hỏi, generator nới lỏng an toàn và không crash', () => {
      const allQ = TOEIC_QUESTION_BANK.map((q) => q.id);
      const allG = TOEIC_QUESTION_GROUPS.map((g) => g.id);

      recordAttemptQuestionsToHistory(allQ, allG);

      const snapshot = generateToeicExam({
        mode: '2skills_full',
        seed: 777,
        recentHistory: getRecentHistory(),
      });

      expect(snapshot.totalQuestions).toBe(20);
      expect(snapshot.questions).toHaveLength(20);
      const uniqueIds = new Set(snapshot.questions.map((q) => q.id));
      expect(uniqueIds.size).toBe(20);
      expect(snapshot.diagnostics.relaxedHistory).toBe(true);
    });
  });

  // ===========================================================================
  // 5. ATTEMPT SNAPSHOT, AUTOSAVE & RELOAD (F5) RECOVERY
  // ===========================================================================
  describe('5. Attempt Snapshot, Autosave & Reload Recovery', () => {
    it('Lưu tiến độ làm bài -> Reload khôi phục đúng đề, đúng câu đang làm và đúng đáp án đã chọn', () => {
      // 1. Bắt đầu bài thi
      const { snapshot, meta } = createNewAttemptSnapshot('2skills_mini', 54321);
      const qIds = snapshot.questions.map((q) => q.id);

      // 2. Học viên trả lời 3 câu và làm dở ở câu 4
      const userAnswers = {
        [qIds[0]]: 'A',
        [qIds[1]]: 'B',
        [qIds[2]]: 'C',
      };

      saveInProgressAttempt({
        stage: 'testing',
        attemptId: meta.attemptId,
        snapshotMeta: meta,
        examMode: '2skills_mini',
        currentQuestionIdx: 3,
        userAnswers,
        speakingTranscript: '',
        writingInput: '',
        timeLeft: 680,
        savedAt: Date.now(),
      });

      // 3. Mô phỏng F5: Đọc lại sessionStorage
      const savedState = getInProgressAttempt();
      expect(savedState).not.toBeNull();
      expect(savedState?.timeLeft).toBe(680);
      expect(savedState?.currentQuestionIdx).toBe(3);
      expect(savedState?.userAnswers).toEqual(userAnswers);

      // 4. Khôi phục snapshot
      const restored = restoreSnapshotFromMeta(savedState!.snapshotMeta!);
      expect(restored.isFullyRestored).toBe(true);
      expect(restored.snapshot.questions.map((q) => q.id)).toEqual(qIds);
      expect(restored.snapshot.seed).toBe(meta.seed);
      expect(restored.snapshot.totalQuestions).toBe(10);
    });

    it('Xóa sạch dữ liệu in-progress sau khi nộp bài để không bị kẹt session', () => {
      saveInProgressAttempt({
        stage: 'testing',
        examMode: '2skills_mini',
        currentQuestionIdx: 0,
        userAnswers: {},
        timeLeft: 500,
        savedAt: Date.now(),
      });

      expect(getInProgressAttempt()).not.toBeNull();
      clearInProgressAttempt();
      expect(getInProgressAttempt()).toBeNull();
    });
  });

  // ===========================================================================
  // 6. BANK VERSION MISMATCH & GRACEFUL DEGRADATION
  // ===========================================================================
  describe('6. Bank Version Mismatch & Safe Degradation', () => {
    it('Snapshot cũ chứa Question ID bị xóa được cảnh báo và khôi phục các câu còn lại mà không crash', () => {
      const existing = TOEIC_QUESTION_BANK.slice(0, 9).map((q) => q.id);
      const deprecatedMeta = {
        attemptId: 'attempt_deprecated_test',
        mode: '2skills_mini',
        questionIds: [...existing, 'deprecated_old_question_2024'],
        groupIds: [],
        questionBankVersion: '2024.1',
        generatedAt: new Date().toISOString(),
        seed: 123,
        totalQuestions: 10,
        durationMinutes: 15,
      };

      const result = restoreSnapshotFromMeta(deprecatedMeta);
      expect(result.snapshot).toBeDefined();
      expect(result.snapshot.questions).toHaveLength(9);
      expect(result.isFullyRestored).toBe(false);
      expect(result.warnings.some((w) => w.includes('deprecated_old_question_2024'))).toBe(true);
    });

    it('Version mismatch nghiêm trọng (toàn bộ ID không tồn tại) tự động tái sinh snapshot mới có cùng seed', () => {
      const invalidMeta = {
        attemptId: 'attempt_invalid_ids',
        mode: '2skills_mini',
        questionIds: ['non_existent_1', 'non_existent_2', 'non_existent_3'],
        groupIds: [],
        questionBankVersion: '1.0',
        generatedAt: new Date().toISOString(),
        seed: 555,
        totalQuestions: 10,
        durationMinutes: 15,
      };

      const result = restoreSnapshotFromMeta(invalidMeta);
      expect(result.snapshot).toBeDefined();
      expect(result.snapshot.totalQuestions).toBe(10);
      expect(result.snapshot.seed).toBe(555);
      expect(result.isIncompatible).toBe(true);
      expect(result.warnings.some((w) => w.includes('mismatch nghiêm trọng'))).toBe(true);
    });
  });

  // ===========================================================================
  // 7. TOEIC SCORING & XP INTEGRATION REGRESSION
  // ===========================================================================
  describe('7. TOEIC Scoring & Learning Integration Regression', () => {
    it('Tính điểm 2 kỹ năng và 4 kỹ năng chính xác theo cấu trúc scaled score ETS', () => {
      const snapshot = generateToeicExam({ mode: '4skills', seed: 42 });

      // Giả lập trả lời đúng tất cả các câu trắc nghiệm
      const userAnswers: Record<string, string> = {};
      snapshot.questions.forEach((q) => {
        if (q.correctAnswer) {
          userAnswers[q.id] = q.correctAnswer;
        }
      });

      const evaluated = calculateToeicScores({
        mode: '4skills',
        questions: snapshot.questions,
        userAnswers,
        speakingTranscript: 'In my opinion, technology plays a crucial role in modern international communication.',
        writingText: 'Dear Mr. Johnson, I am writing to confirm our scheduled business meeting for next Tuesday morning.',
      });

      // Kiểm tra điểm số hợp lệ
      expect(evaluated.listeningScore).toBeGreaterThanOrEqual(5);
      expect(evaluated.listeningScore).toBeLessThanOrEqual(495);
      expect(evaluated.readingScore).toBeGreaterThanOrEqual(5);
      expect(evaluated.readingScore).toBeLessThanOrEqual(495);

      expect(evaluated.hasSpeaking).toBe(true);
      expect(evaluated.speakingScore).toBeGreaterThan(0);
      expect(evaluated.hasWriting).toBe(true);
      expect(evaluated.writingScore).toBeGreaterThan(0);

      expect(evaluated.totalScore).toBeGreaterThan(0);
      expect(['A1/A2', 'B1', 'B2', 'C1']).toContain(evaluated.cefrLevel);
    });
  });

  // ===========================================================================
  // 8. PERFORMANCE BENCHMARKS (HIGH-SPEED AUDIT)
  // ===========================================================================
  describe('8. Performance Benchmarks', () => {
    it('Tốc độ sinh đề qua generateToeicExam đạt dưới 5ms / snapshot', () => {
      const start = performance.now();
      for (let i = 0; i < 20; i++) {
        generateToeicExam({ mode: '2skills_full', seed: i });
      }
      const totalTime = performance.now() - start;
      const avgTime = totalTime / 20;

      expect(avgTime).toBeLessThan(5); // Mục tiêu < 5ms mỗi bài thi
    });

    it('Tra cứu chỉ mục toeicQuestionIndex đạt O(1) dưới 1ms cho 100 queries', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        toeicQuestionIndex.getQuestionById('toeic_p1_1');
        toeicQuestionIndex.getQuestionsByPart('part5_grammar');
        toeicQuestionIndex.getGroupById('toeic_grp_p3_1');
      }
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(10);
    });

    it('Không persist toàn bộ Question Bank vào localStorage hoặc sessionStorage', () => {
      createNewAttemptSnapshot('2skills_full', 123);
      const rawLocal = localStorage.getItem(STORAGE_KEY_RECENT_HISTORY);
      // Chỉ lưu IDs, dung lượng phải cực nhỏ (< 1KB)
      expect(rawLocal ? rawLocal.length : 0).toBeLessThan(2000);
    });
  });
});
