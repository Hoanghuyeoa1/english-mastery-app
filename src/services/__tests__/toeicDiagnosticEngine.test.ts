// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  INITIAL_ADAPTIVE_STATE,
  ADAPTIVE_STREAK_THRESHOLD,
  evaluateAdaptiveAnswer,
  selectDiagnosticItemOrGroup,
  adaptUpcomingDiagnosticSlots,
  generateDiagnosticReport,
  ToeicAdaptiveState,
} from '../toeicDiagnosticEngine';
import {
  createNewAttemptSnapshot,
  restoreSnapshotFromMeta,
  saveInProgressAttempt,
  getInProgressAttempt,
  clearInProgressAttempt,
  STORAGE_KEY_INPROGRESS,
} from '../toeicAttemptManager';
import { calculateToeicScores } from '../toeicScoring';
import { TOEIC_QUESTION_BANK, TOEIC_QUESTION_GROUPS } from '../../data/toeicQuestionsData';
import { ToeicQuestion, ToeicQuestionGroup } from '../../types/toeic';

describe('PHASE 2 — TOEIC DIAGNOSTIC ENGINE & ADAPTIVE CAT TEST SUITE', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  describe('1. Adaptive State Transitions (Deterministic CAT Rules)', () => {
    it('Khởi đầu trạng thái thích ứng luôn ở mức Medium', () => {
      const state = { ...INITIAL_ADAPTIVE_STATE };
      expect(state.currentDifficulty).toBe('medium');
      expect(state.recentCorrectStreak).toBe(0);
      expect(state.recentWrongStreak).toBe(0);
      expect(state.questionsAnswered).toBe(0);
      expect(state.highestDifficultyReached).toBe('medium');
      expect(state.difficultyHistory).toEqual([]);
    });

    it('N câu đúng liên tiếp (N=2) chuyển độ khó từ Medium lên Hard', () => {
      let state = { ...INITIAL_ADAPTIVE_STATE };

      // Câu 1 đúng: streak = 1, vẫn ở medium
      state = evaluateAdaptiveAnswer(state, true, 'q1', 0);
      expect(state.currentDifficulty).toBe('medium');
      expect(state.recentCorrectStreak).toBe(1);
      expect(state.recentWrongStreak).toBe(0);
      expect(state.questionsAnswered).toBe(1);

      // Câu 2 đúng: đạt ngưỡng N=2 -> tăng lên Hard, streak reset về 0
      state = evaluateAdaptiveAnswer(state, true, 'q2', 1);
      expect(state.currentDifficulty).toBe('hard');
      expect(state.recentCorrectStreak).toBe(0);
      expect(state.recentWrongStreak).toBe(0);
      expect(state.highestDifficultyReached).toBe('hard');
    });

    it('N câu sai liên tiếp (N=2) chuyển độ khó từ Medium xuống Easy', () => {
      let state = { ...INITIAL_ADAPTIVE_STATE };

      // Câu 1 sai: streak = 1, vẫn ở medium
      state = evaluateAdaptiveAnswer(state, false, 'q1', 0);
      expect(state.currentDifficulty).toBe('medium');
      expect(state.recentWrongStreak).toBe(1);

      // Câu 2 sai: đạt ngưỡng N=2 -> hạ xuống Easy, streak reset về 0
      state = evaluateAdaptiveAnswer(state, false, 'q2', 1);
      expect(state.currentDifficulty).toBe('easy');
      expect(state.recentWrongStreak).toBe(0);
    });

    it('Cận trên (Hard) + trả lời đúng tiếp -> vẫn giữ ở Hard (không tràn ngưỡng)', () => {
      let state: ToeicAdaptiveState = {
        currentDifficulty: 'hard',
        recentCorrectStreak: 0,
        recentWrongStreak: 0,
        questionsAnswered: 4,
        highestDifficultyReached: 'hard',
        difficultyHistory: [],
      };

      // Làm đúng 2 câu tiếp theo khi đang ở hard
      state = evaluateAdaptiveAnswer(state, true, 'q5', 4);
      state = evaluateAdaptiveAnswer(state, true, 'q6', 5);

      expect(state.currentDifficulty).toBe('hard');
      expect(state.highestDifficultyReached).toBe('hard');
    });

    it('Cận dưới (Easy) + trả lời sai tiếp -> vẫn giữ ở Easy (không tràn ngưỡng)', () => {
      let state: ToeicAdaptiveState = {
        currentDifficulty: 'easy',
        recentCorrectStreak: 0,
        recentWrongStreak: 0,
        questionsAnswered: 4,
        highestDifficultyReached: 'medium',
        difficultyHistory: [],
      };

      // Làm sai 2 câu tiếp theo khi đang ở easy
      state = evaluateAdaptiveAnswer(state, false, 'q5', 4);
      state = evaluateAdaptiveAnswer(state, false, 'q6', 5);

      expect(state.currentDifficulty).toBe('easy');
    });

    it('Đúng/sai xen kẽ (Mixed) -> reset streak và giữ nguyên difficulty', () => {
      let state = { ...INITIAL_ADAPTIVE_STATE }; // medium

      // Đúng câu 1 -> streak đúng = 1
      state = evaluateAdaptiveAnswer(state, true, 'q1', 0);
      expect(state.recentCorrectStreak).toBe(1);
      expect(state.currentDifficulty).toBe('medium');

      // Sai câu 2 -> reset streak đúng về 0, streak sai = 1, level giữ nguyên medium
      state = evaluateAdaptiveAnswer(state, false, 'q2', 1);
      expect(state.recentCorrectStreak).toBe(0);
      expect(state.recentWrongStreak).toBe(1);
      expect(state.currentDifficulty).toBe('medium');

      // Đúng câu 3 -> reset streak sai về 0, streak đúng = 1, level vẫn medium
      state = evaluateAdaptiveAnswer(state, true, 'q3', 2);
      expect(state.recentCorrectStreak).toBe(1);
      expect(state.recentWrongStreak).toBe(0);
      expect(state.currentDifficulty).toBe('medium');
    });

    it('Ghi nhận và bảo toàn highestDifficultyReached xuyên suốt tiến trình', () => {
      let state = { ...INITIAL_ADAPTIVE_STATE }; // medium
      // 2 câu đúng -> lên hard
      state = evaluateAdaptiveAnswer(state, true, 'q1', 0);
      state = evaluateAdaptiveAnswer(state, true, 'q2', 1);
      expect(state.currentDifficulty).toBe('hard');
      expect(state.highestDifficultyReached).toBe('hard');

      // Sau đó làm sai liên tiếp 4 câu -> tụt xuống medium rồi easy
      state = evaluateAdaptiveAnswer(state, false, 'q3', 2);
      state = evaluateAdaptiveAnswer(state, false, 'q4', 3);
      expect(state.currentDifficulty).toBe('medium');

      state = evaluateAdaptiveAnswer(state, false, 'q5', 4);
      state = evaluateAdaptiveAnswer(state, false, 'q6', 5);
      expect(state.currentDifficulty).toBe('easy');

      // highestDifficultyReached vẫn phải được lưu là hard
      expect(state.highestDifficultyReached).toBe('hard');
    });
  });

  describe('2. Group Integrity & Dynamic Slot Adaptation', () => {
    it('Đang làm dở một Group (Part 3/4/6/7) -> tuyệt đối không đổi câu hay độ khó của Group đang làm dở', () => {
      const group1 = TOEIC_QUESTION_GROUPS.find((g) => g.part === 'part3_conv')!;
      const groupQuestions = group1.questionIds
        .map((id) => TOEIC_QUESTION_BANK.find((q) => q.id === id)!)
        .filter(Boolean);

      const futureGroup = TOEIC_QUESTION_GROUPS.find((g) => g.part === 'part4_talks' && g.id !== group1.id)!;
      const futureGroupQuestions = futureGroup.questionIds
        .map((id) => TOEIC_QUESTION_BANK.find((q) => q.id === id)!)
        .filter(Boolean);

      const testQuestions = [...groupQuestions, ...futureGroupQuestions];
      const testGroups = [group1, futureGroup];

      // Giả sử user đang làm câu 0 thuộc group1
      const userAnswers: Record<string, string> = {
        [testQuestions[0].id]: 'A',
      };

      // Đổi mục tiêu độ khó sang 'hard'
      const adapted = adaptUpcomingDiagnosticSlots({
        currentQuestions: testQuestions,
        currentGroups: testGroups,
        userAnswers,
        activeQuestionIndex: 0,
        targetDifficulty: 'hard',
        seed: 42,
      });

      // Toàn bộ các câu thuộc group1 (câu 0, 1, 2) KHÔNG bị thay thế
      group1.questionIds.forEach((qId, idx) => {
        expect(adapted.questions[idx].id).toBe(qId);
      });
      // Group1 vẫn giữ nguyên
      expect(adapted.groups.some((g) => g.id === group1.id)).toBe(true);
    });

    it('Câu hỏi đã trả lời ở quá khứ không bao giờ bị thay thế retroactively', () => {
      const q1 = TOEIC_QUESTION_BANK.find((q) => q.part === 'part1_photos')!;
      const q2 = TOEIC_QUESTION_BANK.find((q) => q.part === 'part2_qna')!;
      const q5 = TOEIC_QUESTION_BANK.find((q) => q.part === 'part5_grammar')!;

      const initialQuestions = [q1, q2, q5];
      const userAnswers = {
        [q1.id]: 'A',
        [q2.id]: 'B',
      };

      const adapted = adaptUpcomingDiagnosticSlots({
        currentQuestions: initialQuestions,
        currentGroups: [],
        userAnswers,
        activeQuestionIndex: 1,
        targetDifficulty: 'hard',
        seed: 99,
      });

      // Câu 1 và câu 2 đã trả lời phải giữ nguyên 100%
      expect(adapted.questions[0].id).toBe(q1.id);
      expect(adapted.questions[1].id).toBe(q2.id);
    });

    it('Khi thay đổi độ khó một group chưa làm, thay thế trọn vẹn nhóm nguyên khối (Atomic Group Replacement)', () => {
      const p3Groups = TOEIC_QUESTION_GROUPS.filter((g) => g.part === 'part3_conv');
      if (p3Groups.length >= 2) {
        const initialGroup = p3Groups[0];
        const initialQuestions = initialGroup.questionIds
          .map((id) => TOEIC_QUESTION_BANK.find((q) => q.id === id)!)
          .filter(Boolean);

        const targetDiff = initialGroup.difficulty === 'hard' ? 'easy' : 'hard';

        const adapted = adaptUpcomingDiagnosticSlots({
          currentQuestions: initialQuestions,
          currentGroups: [initialGroup],
          userAnswers: {},
          activeQuestionIndex: -1,
          targetDifficulty: targetDiff,
          seed: 12345,
        });

        // Group mới phải có đúng số câu và có groupId đồng nhất
        expect(adapted.questions.length).toBe(initialQuestions.length);
        const newGroupId = adapted.questions[0].groupId;
        expect(newGroupId).toBeDefined();
        adapted.questions.forEach((q) => {
          expect(q.groupId).toBe(newGroupId);
        });
      }
    });
  });

  describe('3. Pool Fallback & Recency Scarcity Handling', () => {
    it('Lựa chọn item rơi về độ khó cận kề (fallback) mà không crash khi pool hiếm câu', () => {
      // Yêu cầu Part 1 với target 'hard', ngay cả khi Part 1 ít câu hard
      const result = selectDiagnosticItemOrGroup({
        part: 'part1_photos',
        targetDifficulty: 'hard',
        seed: 'test_seed_fallback',
        excludeQuestionIds: new Set(),
        excludeGroupIds: new Set(),
      });

      expect(result.questions.length).toBeGreaterThan(0);
      expect(result.questions[0].part).toBe('part1_photos');
    });

    it('Tôn trọng anti-repeat và loại trừ các ID đã sử dụng', () => {
      const qPart5 = TOEIC_QUESTION_BANK.filter((q) => q.part === 'part5_grammar' && !q.groupId);
      expect(qPart5.length).toBeGreaterThan(1);

      const excludeIds = new Set<string>([qPart5[0].id]);
      const result = selectDiagnosticItemOrGroup({
        part: 'part5_grammar',
        targetDifficulty: 'medium',
        seed: 777,
        excludeQuestionIds: excludeIds,
        excludeGroupIds: new Set(),
      });

      expect(result.questions[0].id).not.toBe(qPart5[0].id);
    });
  });

  describe('4. Reload Recovery & Attempt Persistence', () => {
    it('Tạo attempt Diagnostic mới khởi tạo đúng adaptiveState', () => {
      const { snapshot, meta } = createNewAttemptSnapshot({
        mode: '2skills_mini',
        experienceMode: 'diagnostic',
        skillScope: '2-skills',
      });

      expect(snapshot.adaptiveState).toBeDefined();
      expect(snapshot.adaptiveState?.currentDifficulty).toBe('medium');
      expect(meta.adaptiveState).toBeDefined();
      expect(meta.adaptiveState?.currentDifficulty).toBe('medium');
    });

    it('F5 / Reload khôi phục đúng currentDifficulty và streak của attempt', () => {
      const { snapshot, meta } = createNewAttemptSnapshot({
        mode: '2skills_mini',
        experienceMode: 'diagnostic',
        skillScope: '2-skills',
      });

      // Tiến triển state lên Hard
      const modifiedAdaptiveState: ToeicAdaptiveState = {
        currentDifficulty: 'hard',
        recentCorrectStreak: 1,
        recentWrongStreak: 0,
        questionsAnswered: 4,
        highestDifficultyReached: 'hard',
        difficultyHistory: [
          { questionIndex: 0, questionId: meta.questionIds[0], difficulty: 'medium', isCorrect: true },
          { questionIndex: 1, questionId: meta.questionIds[1], difficulty: 'medium', isCorrect: true },
        ],
      };

      meta.adaptiveState = modifiedAdaptiveState;

      // Lưu in-progress attempt vào sessionStorage
      saveInProgressAttempt({
        stage: 'testing',
        attemptId: meta.attemptId,
        snapshotMeta: meta,
        examMode: '2skills_mini',
        experienceMode: 'diagnostic',
        skillScope: '2-skills',
        currentQuestionIdx: 2,
        userAnswers: { [meta.questionIds[0]]: 'A', [meta.questionIds[1]]: 'B' },
        speakingTranscript: '',
        writingInput: '',
        timeLeft: 500,
        savedAt: Date.now(),
        adaptiveState: modifiedAdaptiveState,
      });

      // Giả lập phục hồi sau F5
      const saved = getInProgressAttempt();
      expect(saved).not.toBeNull();
      expect(saved?.adaptiveState?.currentDifficulty).toBe('hard');
      expect(saved?.adaptiveState?.highestDifficultyReached).toBe('hard');

      const restored = restoreSnapshotFromMeta(saved!.snapshotMeta!);
      expect(restored.snapshot.adaptiveState?.currentDifficulty).toBe('hard');
    });
  });

  describe('5. Diagnostic Proficiency Report & Evidence Validation', () => {
    it('Sinh báo cáo chẩn đoán với dải điểm ước lượng TOEIC (+/- 50 điểm)', () => {
      const questions = TOEIC_QUESTION_BANK.slice(0, 10);
      const userAnswers: Record<string, string> = {};
      questions.forEach((q, idx) => {
        // Đúng 7/10 câu
        userAnswers[q.id] = (idx < 7 ? q.correctAnswer : 'WRONG') || 'A';
      });

      const report = generateDiagnosticReport({
        questions,
        userAnswers,
        adaptiveState: {
          currentDifficulty: 'medium',
          recentCorrectStreak: 0,
          recentWrongStreak: 0,
          questionsAnswered: 10,
          highestDifficultyReached: 'medium',
          difficultyHistory: [],
        },
      });

      expect(report.isDiagnostic).toBe(true);
      expect(report.estimatedToeicRange.min).toBeLessThan(report.estimatedToeicRange.max);
      expect(report.estimatedToeicRange.display).toContain('–');
      expect(report.listeningStrength.rangeDisplay).toContain('–');
      expect(report.readingStrength.rangeDisplay).toContain('–');
    });

    it('Độ tin cậy trả về High khi hoàn thành đầy đủ cả 2 kỹ năng', () => {
      // 5 câu listening, 5 câu reading
      const lQuestions = TOEIC_QUESTION_BANK.filter((q) => q.skill === 'listening').slice(0, 5);
      const rQuestions = TOEIC_QUESTION_BANK.filter((q) => q.skill === 'reading').slice(0, 5);
      const questions = [...lQuestions, ...rQuestions];

      const userAnswers: Record<string, string> = {};
      questions.forEach((q) => {
        userAnswers[q.id] = q.correctAnswer || 'A';
      });

      const report = generateDiagnosticReport({
        questions,
        userAnswers,
        adaptiveState: INITIAL_ADAPTIVE_STATE,
      });

      expect(report.confidence).toBe('High');
      expect(report.confidenceReason).toContain('Hoàn thành trọn vẹn');
    });

    it('Độ tin cậy trả về Low và giải thích rõ khi bài thi bị ngắt ngang (< 6 câu)', () => {
      const questions = TOEIC_QUESTION_BANK.slice(0, 10);
      const userAnswers: Record<string, string> = {
        [questions[0].id]: 'A',
        [questions[1].id]: 'B',
        // Chỉ trả lời 2 câu
      };

      const report = generateDiagnosticReport({
        questions,
        userAnswers,
        adaptiveState: INITIAL_ADAPTIVE_STATE,
      });

      expect(report.confidence).toBe('Low');
      expect(report.confidenceReason).toContain('< 6 câu');
    });

    it('Grammar Weakness và Vocab Weakness KHÔNG BAO GIỜ bịa đặt tag giả lập', () => {
      const qWithTags = TOEIC_QUESTION_BANK.filter(
        (q) => q.grammarTags && q.grammarTags.length > 0 && q.vocabularyTags && q.vocabularyTags.length > 0
      ).slice(0, 6);

      // Kịch bản 1: User làm đúng 100% tất cả các câu
      const perfectAnswers: Record<string, string> = {};
      qWithTags.forEach((q) => {
        perfectAnswers[q.id] = q.correctAnswer || 'A';
      });

      const perfectReport = generateDiagnosticReport({
        questions: qWithTags,
        userAnswers: perfectAnswers,
        adaptiveState: INITIAL_ADAPTIVE_STATE,
      });

      // Tuyệt đối không được có tag weakness nào khi user không sai câu nào
      expect(perfectReport.grammarWeaknesses).toHaveLength(0);
      expect(perfectReport.vocabularyWeaknesses).toHaveLength(0);

      // Kịch bản 2: User sai 1 câu cụ thể
      const flawedAnswers = { ...perfectAnswers };
      const wrongTarget = qWithTags[0];
      const targetTag = wrongTarget.grammarTags![0];
      flawedAnswers[wrongTarget.id] = 'INCORRECT_ANSWER';

      const flawedReport = generateDiagnosticReport({
        questions: qWithTags,
        userAnswers: flawedAnswers,
        adaptiveState: INITIAL_ADAPTIVE_STATE,
      });

      // Phải có đúng tag của câu sai, errorCount = 1
      expect(flawedReport.grammarWeaknesses.length).toBeGreaterThan(0);
      const matched = flawedReport.grammarWeaknesses.find((w) => w.tag === targetTag);
      expect(matched).toBeDefined();
      expect(matched?.errorCount).toBe(1);
    });

    it('Tích hợp tính điểm calculateToeicScores tự động sinh diagnosticReport khi experienceMode = diagnostic', () => {
      const questions = TOEIC_QUESTION_BANK.slice(0, 10);
      const userAnswers: Record<string, string> = {};
      questions.forEach((q) => {
        userAnswers[q.id] = q.correctAnswer || 'A';
      });

      const evalResult = calculateToeicScores({
        mode: '2skills_mini',
        experienceMode: 'diagnostic',
        skillScope: '2-skills',
        questions,
        userAnswers,
        adaptiveState: {
          ...INITIAL_ADAPTIVE_STATE,
          highestDifficultyReached: 'hard',
        },
      });

      expect(evalResult.diagnosticReport).toBeDefined();
      expect(evalResult.diagnosticReport?.isDiagnostic).toBe(true);
      expect(evalResult.diagnosticReport?.adaptiveProgression.highestDifficultyReached).toBe('hard');
    });
  });
});
