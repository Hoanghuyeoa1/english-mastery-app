// @vitest-environment happy-dom
// src/services/__tests__/toeicAttemptManager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
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
  ToeicAttemptSnapshotMeta,
  InProgressAttemptState,
} from '../toeicAttemptManager';
import { TOEIC_QUESTION_BANK, TOEIC_QUESTION_GROUPS } from '../../data/toeicQuestionsData';

describe('TOEIC Attempt Manager & Lifecycle Engine (Phase 4)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('1. Start Attempt -> Generate Once', () => {
    it('Khởi tạo attempt sinh đề đúng 1 lần và trả về snapshot khớp với snapshotMeta', () => {
      const { snapshot, meta } = createNewAttemptSnapshot('2skills_mini', 12345);

      expect(snapshot.totalQuestions).toBe(10);
      expect(meta.totalQuestions).toBe(10);
      expect(meta.attemptId).toContain('attempt_2skills_mini_');
      expect(meta.seed).toBe(12345);
      expect(meta.questionBankVersion).toBe(QUESTION_BANK_VERSION);

      // Question IDs và Group IDs phải khớp hoàn toàn
      expect(meta.questionIds).toEqual(snapshot.questions.map((q) => q.id));
      expect(meta.groupIds).toEqual(snapshot.groups.map((g) => g.id));
    });
  });

  describe('2. Reload / F5 Recovery (Same Snapshot & IDs)', () => {
    it('Khôi phục bài thi từ snapshotMeta tái lập 100% đúng câu hỏi, nhóm và thứ tự ban đầu', () => {
      // 1. Giả lập sinh đề ban đầu
      const { snapshot, meta } = createNewAttemptSnapshot('2skills_full', 778899);
      const originalQuestionIds = snapshot.questions.map((q) => q.id);
      const originalGroupIds = snapshot.groups.map((g) => g.id);

      // 2. Giả lập lưu tiến độ bài thi dở dang vào sessionStorage
      const inProgress: InProgressAttemptState = {
        stage: 'testing',
        attemptId: meta.attemptId,
        snapshotMeta: meta,
        examMode: '2skills_full',
        currentQuestionIdx: 5,
        userAnswers: { [originalQuestionIds[0]]: 'A', [originalQuestionIds[1]]: 'B' },
        timeLeft: 1200,
        savedAt: Date.now(),
      };
      saveInProgressAttempt(inProgress);

      // 3. Giả lập Reload/F5: Đọc lại sessionStorage
      const retrieved = getInProgressAttempt();
      expect(retrieved).not.toBeNull();
      expect(retrieved?.snapshotMeta).toBeDefined();

      // 4. Khôi phục snapshot từ meta
      const restoreResult = restoreSnapshotFromMeta(retrieved!.snapshotMeta!);
      expect(restoreResult.isFullyRestored).toBe(true);
      expect(restoreResult.warnings).toHaveLength(0);

      const restoredQuestions = restoreResult.snapshot.questions;
      expect(restoredQuestions.map((q) => q.id)).toEqual(originalQuestionIds);
      expect(restoreResult.snapshot.groups.map((g) => g.id)).toEqual(originalGroupIds);
      expect(restoreResult.snapshot.totalQuestions).toBe(20);
      expect(restoreResult.snapshot.seed).toBe(meta.seed);
    });

    it('clearInProgressAttempt dọn dẹp sạch sẽ sau khi hoàn thành hoặc hủy bài thi', () => {
      saveInProgressAttempt({
        stage: 'testing',
        examMode: '2skills_mini',
        currentQuestionIdx: 0,
        userAnswers: {},
        timeLeft: 900,
        savedAt: Date.now(),
      });

      expect(getInProgressAttempt()).not.toBeNull();
      clearInProgressAttempt();
      expect(getInProgressAttempt()).toBeNull();
      expect(sessionStorage.getItem(STORAGE_KEY_INPROGRESS)).toBeNull();
    });
  });

  describe('3. New Attempt -> Cho phép sinh snapshot mới', () => {
    it('Bắt đầu bài thi mới với seed khác nhau tạo ra các snapshot khác nhau', () => {
      const attempt1 = createNewAttemptSnapshot('2skills_mini', 101);
      const attempt2 = createNewAttemptSnapshot('2skills_mini', 202);

      expect(attempt1.meta.attemptId).not.toBe(attempt2.meta.attemptId);
      expect(attempt1.snapshot.seed).not.toBe(attempt2.snapshot.seed);
    });
  });

  describe('4. Recent History (Bounded & Persisted Correctly)', () => {
    it('Ghi nhận câu hỏi và nhóm vào history và giới hạn độ dài (Bounded FIFO)', () => {
      // Giả lập ghi nhận 80 câu hỏi (vượt quá MAX_RECENT_QUESTIONS = 60)
      const fakeQuestionIds = Array.from({ length: 80 }, (_, i) => `q_history_${i}`);
      const fakeGroupIds = Array.from({ length: 25 }, (_, i) => `g_history_${i}`);

      const history = recordAttemptQuestionsToHistory(fakeQuestionIds, fakeGroupIds);

      // Bounded kiểm tra
      expect(history.recentQuestionIds.length).toBe(MAX_RECENT_QUESTIONS);
      expect(history.recentGroupIds.length).toBe(MAX_RECENT_GROUPS);

      // Phải giữ lại các câu hỏi mới nhất (từ 20 đến 79)
      expect(history.recentQuestionIds[0]).toBe('q_history_20');
      expect(history.recentQuestionIds[MAX_RECENT_QUESTIONS - 1]).toBe('q_history_79');

      // Phải giữ lại các group mới nhất (từ 10 đến 24)
      expect(history.recentGroupIds[0]).toBe('g_history_10');
      expect(history.recentGroupIds[MAX_RECENT_GROUPS - 1]).toBe('g_history_24');

      // Đã lưu bền vững vào localStorage
      const rawStored = localStorage.getItem(STORAGE_KEY_RECENT_HISTORY);
      expect(rawStored).toBeTruthy();
      const parsed = JSON.parse(rawStored!);
      expect(parsed.recentQuestionIds.length).toBe(MAX_RECENT_QUESTIONS);
    });

    it('Không trùng lặp câu hỏi trong history khi ghi nhận lại (Deduplication)', () => {
      recordAttemptQuestionsToHistory(['q1', 'q2', 'q3'], ['g1']);
      const updated = recordAttemptQuestionsToHistory(['q2', 'q3', 'q4'], ['g1', 'g2']);

      expect(updated.recentQuestionIds).toEqual(['q1', 'q2', 'q3', 'q4']);
      expect(updated.recentGroupIds).toEqual(['g1', 'g2']);
    });
  });

  describe('5. Bank Version Safety & Graceful Recovery', () => {
    it('Snapshot tham chiếu câu hỏi bị xóa/thay đổi ID ở bank mới được cảnh báo và khôi phục an toàn', () => {
      // Tạo meta giả có 9 câu tồn tại và 1 câu ID lạ không tồn tại trong bank
      const validQuestions = TOEIC_QUESTION_BANK.slice(0, 9).map((q) => q.id);
      const metaWithMissingId: ToeicAttemptSnapshotMeta = {
        attemptId: 'attempt_mismatch_test_1',
        mode: '2skills_mini',
        questionIds: [...validQuestions, 'non_existent_deprecated_id_999'],
        groupIds: [],
        questionBankVersion: '2025.0', // version cũ
        generatedAt: new Date().toISOString(),
        seed: 444,
        totalQuestions: 10,
        durationMinutes: 15,
      };

      const result = restoreSnapshotFromMeta(metaWithMissingId);

      // Không crash
      expect(result.snapshot).toBeDefined();
      expect(result.isFullyRestored).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('non_existent_deprecated_id_999');

      // Khôi phục được 9 câu hợp lệ
      expect(result.snapshot.questions).toHaveLength(9);
    });

    it('Bank mismatch nghiêm trọng (thiếu quá 30% câu) tự động tái sinh snapshot với seed cũ an toàn', () => {
      // Tạo meta giả hoàn toàn toàn ID không tồn tại
      const metaSevereMismatch: ToeicAttemptSnapshotMeta = {
        attemptId: 'attempt_severe_mismatch',
        mode: '2skills_mini',
        questionIds: ['unknown_1', 'unknown_2', 'unknown_3', 'unknown_4', 'unknown_5'],
        groupIds: [],
        questionBankVersion: '2020.1',
        generatedAt: new Date().toISOString(),
        seed: 888,
        totalQuestions: 10,
        durationMinutes: 15,
      };

      const result = restoreSnapshotFromMeta(metaSevereMismatch);

      // Tự động tái sinh đề hợp lệ với đúng số câu của mode mà không crash
      expect(result.snapshot).toBeDefined();
      expect(result.snapshot.totalQuestions).toBe(10);
      expect(result.warnings.some((w) => w.includes('mismatch nghiêm trọng'))).toBe(true);
      expect(result.snapshot.seed).toBe(888);
    });
  });
});
