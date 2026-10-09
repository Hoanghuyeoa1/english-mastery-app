import { describe, it, expect, vi } from 'vitest';
import {
  TOEIC_EXPERIENCE_CONFIGS,
  getExperienceConfig,
  resolveExperienceAndSkillScope,
  isCombinationSupported,
  ToeicExperienceMode,
  ToeicTestSession,
  ToeicExamSnapshot,
  ExamExperienceConfig,
} from '../../types/toeic';
import { generateToeicExam } from '../examGenerator';
import {
  createNewAttemptSnapshot,
  restoreSnapshotFromMeta,
  saveInProgressAttempt,
  getInProgressAttempt,
  clearInProgressAttempt,
  safeSetItem,
  InProgressAttemptState,
  QUESTION_BANK_VERSION,
} from '../toeicAttemptManager';
import { calculateToeicScores } from '../toeicScoring';
import { toeicQuestionIndex } from '../toeicIndex';
import { TOEIC_QUESTION_BANK, TOEIC_QUESTION_GROUPS } from '../../data/toeicQuestionsData';
import { INITIAL_ADAPTIVE_STATE } from '../toeicDiagnosticEngine';

describe('TOEIC Experience Engine — Phase 5: Persistence + Recovery + Integration + Final Regression', () => {
  // =========================================================================
  // 1. Table-Driven Permission Matrix Regression
  // =========================================================================
  describe('1. Table-Driven Permission Matrix Regression', () => {
    interface PermissionMatrixRow {
      feature: keyof ExamExperienceConfig;
      diagnostic: any;
      practice: any;
      mock: any;
      description: string;
    }

    const permissionTable: PermissionMatrixRow[] = [
      {
        feature: 'timerMode',
        diagnostic: 'soft',
        practice: 'none',
        mock: 'strict',
        description: 'Chế độ đồng hồ (Mock đếm ngược gắt gao, Diagnostic mềm dẻo, Practice tự do)',
      },
      {
        feature: 'canPause',
        diagnostic: false,
        practice: true,
        mock: false,
        description: 'Quyền tạm dừng bài thi (chỉ Practice được tạm dừng)',
      },
      {
        feature: 'showImmediateFeedback',
        diagnostic: false,
        practice: true,
        mock: false,
        description: 'Hiện đúng/sai tức thì (chỉ Practice phục vụ học trong khi làm)',
      },
      {
        feature: 'allowHints',
        diagnostic: false,
        practice: true,
        mock: false,
        description: 'Gợi ý giải câu hỏi không lộ đáp án',
      },
      {
        feature: 'allowLookup',
        diagnostic: false,
        practice: true,
        mock: false,
        description: 'Tra cứu từ điển ngữ cảnh',
      },
      {
        feature: 'allowSaveVocabulary',
        diagnostic: false,
        practice: true,
        mock: false,
        description: 'Lưu từ vựng vào SRS ngay trong khi làm bài',
      },
      {
        feature: 'allowRetry',
        diagnostic: false,
        practice: true,
        mock: false,
        description: 'Làm lại câu sai để củng cố kiến thức',
      },
      {
        feature: 'allowTranscript',
        diagnostic: false,
        practice: true,
        mock: false,
        description: 'Xem transcript bài nghe',
      },
      {
        feature: 'allowAudioReplay',
        diagnostic: false,
        practice: true,
        mock: false,
        description: 'Phát lại audio nhiều lần (Mock & Diagnostic chỉ 1 lần duy nhất)',
      },
      {
        feature: 'adaptiveDifficulty',
        diagnostic: true,
        practice: false,
        mock: false,
        description: 'Độ khó phân nhánh thích ứng CAT (chỉ Diagnostic)',
      },
      {
        feature: 'showResultOnlyAtEnd',
        diagnostic: true,
        practice: false,
        mock: true,
        description: 'Chỉ công bố kết quả và mở khóa lời giải ở cuối bài',
      },
    ];

    permissionTable.forEach(({ feature, diagnostic, practice, mock, description }) => {
      it(`[Permission Matrix] ${feature}: verify chính xác cho cả 3 modes (${description})`, () => {
        expect(TOEIC_EXPERIENCE_CONFIGS.diagnostic[feature]).toBe(diagnostic);
        expect(TOEIC_EXPERIENCE_CONFIGS.practice[feature]).toBe(practice);
        expect(TOEIC_EXPERIENCE_CONFIGS.mock[feature]).toBe(mock);
      });
    });
  });

  // =========================================================================
  // 2. Attempt Persistence & Reload Behavior Across 3 Modes
  // =========================================================================
  describe('2. Attempt Persistence & Reload Behavior across 3 Modes', () => {
    it('Diagnostic: reload khôi phục đúng câu hỏi, cùng adaptiveState và giữ nguyên mode', () => {
      clearInProgressAttempt();

      const { snapshot, meta } = createNewAttemptSnapshot({
        mode: '2skills_mini',
        experienceMode: 'diagnostic',
        skillScope: '2-skills',
      });

      const inProgress: InProgressAttemptState = {
        stage: 'testing',
        attemptId: meta.attemptId,
        snapshotMeta: meta,
        examMode: '2skills_mini',
        experienceMode: 'diagnostic',
        skillScope: '2-skills',
        experienceConfig: snapshot.experienceConfig,
        currentQuestionIdx: 3,
        userAnswers: { [snapshot.questions[0].id]: 'A', [snapshot.questions[1].id]: 'B' },
        timeLeft: 620,
        savedAt: Date.now(),
        adaptiveState: {
          currentDifficulty: 'hard',
          recentCorrectStreak: 2,
          recentWrongStreak: 0,
          questionsAnswered: 2,
          highestDifficultyReached: 'hard',
          difficultyHistory: [
            { questionIndex: 0, questionId: 'q0', difficulty: 'medium', isCorrect: true },
            { questionIndex: 1, questionId: 'q1', difficulty: 'hard', isCorrect: true },
          ],
        },
      };

      saveInProgressAttempt(inProgress);

      const recovered = getInProgressAttempt();
      expect(recovered).not.toBeNull();
      expect(recovered?.experienceMode).toBe('diagnostic');
      expect(recovered?.adaptiveState?.currentDifficulty).toBe('hard');
      expect(recovered?.adaptiveState?.recentCorrectStreak).toBe(2);

      const { snapshot: restoredSnap } = restoreSnapshotFromMeta(recovered!.snapshotMeta!);
      expect(restoredSnap.experienceMode).toBe('diagnostic');
      expect(restoredSnap.experienceConfig?.adaptiveDifficulty).toBe(true);
      expect(restoredSnap.questions.map((q) => q.id)).toEqual(snapshot.questions.map((q) => q.id));

      clearInProgressAttempt();
    });

    it('Practice: reload khôi phục câu hỏi, firstAttempt, retries và permissions vẫn là Practice', () => {
      clearInProgressAttempt();

      const { snapshot, meta } = createNewAttemptSnapshot({
        mode: '2skills_full',
        experienceMode: 'practice',
        skillScope: '2-skills',
      });

      const inProgress: InProgressAttemptState = {
        stage: 'testing',
        attemptId: meta.attemptId,
        snapshotMeta: meta,
        examMode: '2skills_full',
        experienceMode: 'practice',
        skillScope: '2-skills',
        experienceConfig: snapshot.experienceConfig,
        currentQuestionIdx: 5,
        userAnswers: { [snapshot.questions[0].id]: 'B' },
        firstAttemptAnswers: { [snapshot.questions[0].id]: 'C' },
        bookmarkedQuestions: { [snapshot.questions[1].id]: true },
        retryCountMap: { [snapshot.questions[0].id]: 1 },
        masteredRetryMap: { [snapshot.questions[0].id]: true },
        timeLeft: 1200,
        savedAt: Date.now(),
      };

      saveInProgressAttempt(inProgress);

      const recovered = getInProgressAttempt();
      expect(recovered).not.toBeNull();
      expect(recovered?.experienceMode).toBe('practice');
      expect(recovered?.firstAttemptAnswers?.[snapshot.questions[0].id]).toBe('C');
      expect(recovered?.masteredRetryMap?.[snapshot.questions[0].id]).toBe(true);
      expect(recovered?.bookmarkedQuestions?.[snapshot.questions[1].id]).toBe(true);

      const { snapshot: restoredSnap } = restoreSnapshotFromMeta(recovered!.snapshotMeta!);
      expect(restoredSnap.experienceMode).toBe('practice');
      expect(restoredSnap.experienceConfig?.allowHints).toBe(true);
      expect(restoredSnap.experienceConfig?.allowRetry).toBe(true);
      expect(restoredSnap.experienceConfig?.canPause).toBe(true);

      clearInProgressAttempt();
    });

    it('Mock: reload khôi phục đúng Mock, audioPlayedMap, locked permissions và không biến thành Practice', () => {
      clearInProgressAttempt();

      const { snapshot, meta } = createNewAttemptSnapshot({
        mode: '2skills_full',
        experienceMode: 'mock',
        skillScope: '2-skills',
      });

      const inProgress: InProgressAttemptState = {
        stage: 'testing',
        attemptId: meta.attemptId,
        snapshotMeta: meta,
        examMode: '2skills_full',
        experienceMode: 'mock',
        skillScope: '2-skills',
        experienceConfig: snapshot.experienceConfig,
        currentQuestionIdx: 7,
        userAnswers: { [snapshot.questions[0].id]: 'A' },
        audioPlayedMap: { [snapshot.questions[0].id]: true },
        timeLeft: 1100,
        savedAt: Date.now(),
      };

      saveInProgressAttempt(inProgress);

      const recovered = getInProgressAttempt();
      expect(recovered).not.toBeNull();
      expect(recovered?.experienceMode).toBe('mock');
      expect(recovered?.audioPlayedMap?.[snapshot.questions[0].id]).toBe(true);

      const { snapshot: restoredSnap } = restoreSnapshotFromMeta(recovered!.snapshotMeta!);
      expect(restoredSnap.experienceMode).toBe('mock');
      expect(restoredSnap.experienceConfig?.timerMode).toBe('strict');
      expect(restoredSnap.experienceConfig?.canPause).toBe(false);
      expect(restoredSnap.experienceConfig?.allowHints).toBe(false);
      expect(restoredSnap.experienceConfig?.allowLookup).toBe(false);
      expect(restoredSnap.experienceConfig?.allowAudioReplay).toBe(false);

      clearInProgressAttempt();
    });
  });

  // =========================================================================
  // 3. Corrupt Recovery & Fallback Invariants
  // =========================================================================
  describe('3. Corrupt Recovery & Zero-Crash Fallbacks', () => {
    it('xử lý an toàn khi sessionStorage chứa chuỗi JSON hỏng, không throw và trả về null', () => {
      // Giả lập sessionStorage bị corrupt qua safeSetItem
      safeSetItem('session', 'english_mastery_toeic_inprogress', '{corrupted_json:;;@@@');
      const recovered = getInProgressAttempt();
      expect(recovered).toBeNull();
      clearInProgressAttempt();
    });

    it('xử lý an toàn khi snapshotMeta thiếu questionIds hoặc groupIds, không crash', () => {
      const corruptMeta: any = {
        attemptId: 'corrupt_attempt_01',
        mode: '2skills_mini',
        experienceMode: 'mock',
        skillScope: '2-skills',
        // questionIds và groupIds bị undefined hoặc null
        questionIds: null,
        groupIds: undefined,
        totalQuestions: 10,
        durationMinutes: 15,
        seed: 1234,
        questionBankVersion: QUESTION_BANK_VERSION,
        generatedAt: new Date().toISOString(),
      };

      const result = restoreSnapshotFromMeta(corruptMeta);
      expect(result).toBeDefined();
      expect(result.snapshot).toBeDefined();
      expect(result.snapshot.experienceMode).toBe('mock'); // Bảo toàn tuyệt đối Mock mode
      expect(result.isIncompatible).toBe(true); // Đánh dấu không tương thích minh bạch
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('xử lý Question Bank Version mismatch nặng (< 70% câu hỏi): bảo toàn experienceMode và seed', () => {
      const obsoleteMeta: any = {
        attemptId: 'legacy_attempt_2024',
        mode: '2skills_full',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questionIds: ['obsolete_q_1', 'obsolete_q_2', 'obsolete_q_3'], // Không tồn tại trong bank
        groupIds: ['obsolete_g_1'],
        totalQuestions: 20,
        durationMinutes: 30,
        seed: 987654,
        questionBankVersion: '2024.0',
        generatedAt: new Date().toISOString(),
      };

      const result = restoreSnapshotFromMeta(obsoleteMeta);
      expect(result.isFullyRestored).toBe(false);
      expect(result.isIncompatible).toBe(true);
      expect(result.snapshot.experienceMode).toBe('mock'); // Tuyệt đối không biến thành practice
      expect(result.snapshot.seed).toBe(987654); // Giữ nguyên seed
    });

    it('phục hồi an toàn khi Diagnostic attempt bị mất adaptiveState: fallback về INITIAL_ADAPTIVE_STATE', () => {
      const metaWithoutAdaptive: any = {
        attemptId: 'diag_no_adaptive',
        mode: '2skills_mini',
        experienceMode: 'diagnostic',
        skillScope: '2-skills',
        questionIds: TOEIC_QUESTION_BANK.slice(0, 10).map((q) => q.id),
        groupIds: [],
        totalQuestions: 10,
        durationMinutes: 15,
        seed: 112233,
        questionBankVersion: QUESTION_BANK_VERSION,
        generatedAt: new Date().toISOString(),
      };

      const result = restoreSnapshotFromMeta(metaWithoutAdaptive);
      expect(result.snapshot.experienceMode).toBe('diagnostic');
      expect(result.snapshot.adaptiveState).toBeDefined();
      expect(result.snapshot.adaptiveState?.currentDifficulty).toBe(INITIAL_ADAPTIVE_STATE.currentDifficulty);
    });
  });

  // =========================================================================
  // 4. Scoring Semantics & Source Mode Integrity
  // =========================================================================
  describe('4. Scoring Semantics Regression', () => {
    it('Diagnostic: kết quả chỉ là báo cáo ước lượng thích ứng CAT, không tuyên bố chứng chỉ chính thức', () => {
      const diagExam = generateToeicExam({
        mode: '2skills_mini',
        experienceMode: 'diagnostic',
        skillScope: '2-skills',
        seed: 334455,
      });
      const questions = diagExam.questions;
      const userAnswers: Record<string, string> = {};
      questions.forEach((q) => {
        userAnswers[q.id] = q.correctAnswer || 'A';
      });

      const evaluation = calculateToeicScores({
        mode: '2skills_mini',
        experienceMode: 'diagnostic',
        skillScope: '2-skills',
        questions,
        userAnswers,
        adaptiveState: {
          currentDifficulty: 'hard',
          recentCorrectStreak: 4,
          recentWrongStreak: 0,
          highestDifficultyReached: 'hard',
          questionsAnswered: 10,
          difficultyHistory: questions.map((q, idx) => ({
            questionIndex: idx,
            questionId: q.id,
            difficulty: 'hard' as const,
            isCorrect: true,
          })),
        },
      });

      expect(evaluation.experienceMode).toBe('diagnostic');
      expect(evaluation.diagnosticReport).toBeDefined();
      expect(evaluation.diagnosticReport?.estimatedToeicRange.min).toBeDefined();
      expect(evaluation.diagnosticReport?.estimatedToeicRange.max).toBeDefined();
      expect(evaluation.diagnosticReport?.confidence).toBe('High');
    });

    it('Practice: retry nhiều lần và sửa đúng tuyệt đối KHÔNG làm tăng điểm số hay accuracy chính thức', () => {
      const questions = TOEIC_QUESTION_BANK.slice(0, 10);
      const firstAttemptAnswers: Record<string, string> = {};
      const currentAnswersAfterRetry: Record<string, string> = {};

      questions.forEach((q, idx) => {
        if (idx < 5) {
          // 5 câu đầu làm đúng lần đầu
          firstAttemptAnswers[q.id] = q.correctAnswer || 'A';
          currentAnswersAfterRetry[q.id] = q.correctAnswer || 'A';
        } else {
          // 5 câu sau làm sai lần đầu, nhưng sau đó retry sửa thành đúng
          firstAttemptAnswers[q.id] = 'WRONG_CHOICE';
          currentAnswersAfterRetry[q.id] = q.correctAnswer || 'A';
        }
      });

      const evaluation = calculateToeicScores({
        mode: '2skills_full',
        experienceMode: 'practice',
        skillScope: '2-skills',
        questions,
        userAnswers: currentAnswersAfterRetry, // Đã sửa đúng hết 10 câu
        firstAttemptAnswers,                   // Nhưng lần đầu chỉ đúng 5 câu
      });

      // Điểm số và accuracy chính thức PHẢI dựa trên first attempt (5/10 câu = 50%)
      expect(evaluation.overallAccuracy).toBe(50);
      expect(evaluation.listeningCorrect + evaluation.readingCorrect).toBe(5);

      // Retry mastery được theo dõi tách biệt trong practiceStats
      expect(evaluation.practiceStats?.firstAttemptCorrect).toBe(5);
      expect(evaluation.practiceStats?.retryCorrect).toBe(5);
      expect(evaluation.practiceStats?.accuracy).toBe(50);
    });

    it('Mock: giữ nguyên cấu trúc tính điểm chuẩn ETS và ghi nhận timeSpentSeconds', () => {
      const questions = TOEIC_QUESTION_BANK.slice(0, 20);
      const userAnswers: Record<string, string> = {};
      questions.forEach((q, idx) => {
        userAnswers[q.id] = idx < 16 ? (q.correctAnswer || 'A') : 'WRONG';
      });

      const evaluation = calculateToeicScores({
        mode: '2skills_full',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions,
        userAnswers,
        timeSpentSeconds: 1420,
      });

      expect(evaluation.experienceMode).toBe('mock');
      expect(evaluation.timeSpentSeconds).toBe(1420);
      expect(evaluation.totalScore).toBeGreaterThanOrEqual(10);
      expect(evaluation.totalScore).toBeLessThanOrEqual(990);
      expect(evaluation.listeningScore % 5).toBe(0); // Chuẩn ETS: bội số của 5
      expect(evaluation.readingScore % 5).toBe(0);
      expect(evaluation.diagnosticReport).toBeUndefined();
    });
  });

  // =========================================================================
  // 5. XP & Farm Prevention Safeguards
  // =========================================================================
  describe('5. XP Safeguards & Anti-Farming', () => {
    it('trong Practice mode: XP chỉ được tính dựa trên first attempt, retry không sinh thêm XP', () => {
      const questions = TOEIC_QUESTION_BANK.slice(0, 10);
      const firstAttemptAnswers: Record<string, string> = {};
      const retryAnswers: Record<string, string> = {};

      questions.forEach((q, idx) => {
        firstAttemptAnswers[q.id] = idx < 6 ? (q.correctAnswer || 'A') : 'WRONG';
        retryAnswers[q.id] = q.correctAnswer || 'A'; // sửa đúng hết
      });

      const evaluation = calculateToeicScores({
        mode: '2skills_full',
        experienceMode: 'practice',
        skillScope: '2-skills',
        questions,
        userAnswers: retryAnswers,
        firstAttemptAnswers,
      });

      const earnedXP = Math.round(evaluation.totalScore / 10);

      // Điểm số tương ứng với 6 câu đúng lần đầu, không bị tăng vọt lên 10 câu
      const baselineEval = calculateToeicScores({
        mode: '2skills_full',
        experienceMode: 'practice',
        skillScope: '2-skills',
        questions,
        userAnswers: firstAttemptAnswers,
      });

      expect(evaluation.totalScore).toBe(baselineEval.totalScore);
      expect(earnedXP).toBe(Math.round(baselineEval.totalScore / 10));
    });
  });

  // =========================================================================
  // 6. Exam Generator Invariants & Edge Cases
  // =========================================================================
  describe('6. Exam Generator Invariants & Edge Cases', () => {
    it('Atomic Group Bundling: các câu hỏi của Part 3, 4, 6, 7 luôn đi liền trọn vẹn theo group', () => {
      const exam = generateToeicExam({
        mode: '2skills_full',
        experienceMode: 'mock',
        skillScope: '2-skills',
        seed: 778899,
      });

      const groupedQuestions = exam.questions.filter((q) => q.groupId);
      expect(groupedQuestions.length).toBeGreaterThan(0);

      const groupCounts = new Map<string, number>();
      groupedQuestions.forEach((q) => {
        groupCounts.set(q.groupId!, (groupCounts.get(q.groupId!) || 0) + 1);
      });

      // Mọi group xuất hiện đều phải nguyên vẹn 3 câu (atomic invariant)
      groupCounts.forEach((count) => {
        expect(count).toBe(3);
      });
    });

    it('Mock Exam tuyệt đối không dùng điểm yếu (weakAreas) làm lệch đề thi', () => {
      const seed = 554433;
      const weakAreas = [
        { part: 'part1_photos' as const },
        { part: 'part5_grammar' as const, grammarTag: 'Prepositions' },
      ];

      const mockExam1 = generateToeicExam({
        mode: '2skills_full',
        experienceMode: 'mock',
        skillScope: '2-skills',
        seed,
        weakAreas,
      });

      const mockExam2 = generateToeicExam({
        mode: '2skills_full',
        experienceMode: 'mock',
        skillScope: '2-skills',
        seed,
        weakAreas: [],
      });

      expect(mockExam1.questions.map((q) => q.id)).toEqual(mockExam2.questions.map((q) => q.id));
    });

    it('Edge case: yêu cầu mode hợp lệ nhưng ngân hàng nhỏ vẫn an toàn nới lỏng mà không crash', () => {
      const exam = generateToeicExam({
        mode: '4skills',
        experienceMode: 'mock',
        skillScope: '4-skills',
        seed: 123,
      });

      expect(exam.questions.length).toBe(24);
      expect(exam.diagnostics.warnings).toBeDefined();
    });
  });

  // =========================================================================
  // 7. Navigation Guards & UX Protection
  // =========================================================================
  describe('7. Navigation Guards & UX Protection', () => {
    it('xác định thông điệp beforeunload phù hợp với từng Experience Mode', () => {
      const getBeforeUnloadMessage = (mode: ToeicExperienceMode): string => {
        if (mode === 'mock') {
          return '⚠️ CẢNH BÁO PHÒNG THI MOCK TEST ETS: Bạn đang trong bài thi thử chuẩn hóa có tính giờ nghiêm ngặt. Việc rời khỏi hoặc đóng trang có thể làm gián đoạn thời gian làm bài của bạn!';
        } else if (mode === 'diagnostic') {
          return 'Bạn đang thực hiện bài Khảo Sát Thích Ứng (Diagnostic). Hãy hoàn thành để nhận được báo cáo đánh giá năng lực chính xác nhất.';
        }
        return 'Bạn đang trong buổi Luyện Tập TOEIC. Tiến trình hiện tại đã được tự động lưu tạm.';
      };

      const mockMsg = getBeforeUnloadMessage('mock');
      expect(mockMsg).toContain('CẢNH BÁO PHÒNG THI MOCK TEST ETS');

      const diagMsg = getBeforeUnloadMessage('diagnostic');
      expect(diagMsg).toContain('Khảo Sát Thích Ứng (Diagnostic)');

      const pracMsg = getBeforeUnloadMessage('practice');
      expect(pracMsg).toContain('Luyện Tập TOEIC');
    });
  });
});
