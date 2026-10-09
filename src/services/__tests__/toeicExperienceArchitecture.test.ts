import { describe, it, expect } from 'vitest';
import {
  ToeicExperienceMode,
  ToeicSkillScope,
  TOEIC_EXPERIENCE_CONFIGS,
  getExperienceConfig,
  isCombinationSupported,
  resolveExperienceAndSkillScope,
  ExamExperienceConfig,
} from '../../types/toeic';
import { generateToeicExam } from '../examGenerator';
import {
  createNewAttemptSnapshot,
  restoreSnapshotFromMeta,
  ToeicAttemptSnapshotMeta,
  QUESTION_BANK_VERSION,
} from '../toeicAttemptManager';
import { calculateToeicScores } from '../toeicScoring';
import { TOEIC_QUESTION_BANK } from '../../data/toeicQuestionsData';

describe('PHASE 1 — TOEIC EXPERIENCE MODE ARCHITECTURE & PERMISSION MATRIX', () => {
  describe('1. Two-Dimensional Mode Separation & Resolution', () => {
    it('Phân giải chuẩn xác hai chiều độc lập: Experience Mode & Skill Scope', () => {
      // 1. Diagnostic + 2-skills
      const r1 = resolveExperienceAndSkillScope({
        experienceMode: 'diagnostic',
        skillScope: '2-skills',
      });
      expect(r1.experienceMode).toBe('diagnostic');
      expect(r1.skillScope).toBe('2-skills');
      expect(r1.resolvedExamMode).toBe('2skills_mini');
      expect(r1.experienceConfig.timerMode).toBe('soft');

      // 2. Practice + 4-skills
      const r2 = resolveExperienceAndSkillScope({
        experienceMode: 'practice',
        skillScope: '4-skills',
      });
      expect(r2.experienceMode).toBe('practice');
      expect(r2.skillScope).toBe('4-skills');
      expect(r2.resolvedExamMode).toBe('4skills');
      expect(r2.experienceConfig.canPause).toBe(true);

      // 3. Mock + 2-skills
      const r3 = resolveExperienceAndSkillScope({
        experienceMode: 'mock',
        skillScope: '2-skills',
      });
      expect(r3.experienceMode).toBe('mock');
      expect(r3.skillScope).toBe('2-skills');
      expect(r3.resolvedExamMode).toBe('2skills_full');
      expect(r3.experienceConfig.timerMode).toBe('strict');
    });

    it('Backward compatibility: Phân giải chính xác từ legacy mode string', () => {
      // Legacy 2skills_mini -> diagnostic + 2-skills
      const mini = resolveExperienceAndSkillScope('2skills_mini');
      expect(mini.experienceMode).toBe('diagnostic');
      expect(mini.skillScope).toBe('2-skills');
      expect(mini.resolvedExamMode).toBe('2skills_mini');

      // Legacy 2skills_full -> mock + 2-skills
      const full = resolveExperienceAndSkillScope('2skills_full');
      expect(full.experienceMode).toBe('mock');
      expect(full.skillScope).toBe('2-skills');
      expect(full.resolvedExamMode).toBe('2skills_full');

      // Legacy 4skills -> mock + 4-skills
      const fourSkills = resolveExperienceAndSkillScope('4skills');
      expect(fourSkills.experienceMode).toBe('mock');
      expect(fourSkills.skillScope).toBe('4-skills');
      expect(fourSkills.resolvedExamMode).toBe('4skills');
    });
  });

  describe('2. Centralized Permission Matrix & Presets', () => {
    it('Đảm bảo config của Diagnostic đúng contract định nghĩa', () => {
      const cfg = getExperienceConfig('diagnostic');
      expect(cfg.timerMode).toBe('soft');
      expect(cfg.canPause).toBe(false);
      expect(cfg.showImmediateFeedback).toBe(false);
      expect(cfg.allowHints).toBe(false);
      expect(cfg.allowLookup).toBe(false);
      expect(cfg.allowSaveVocabulary).toBe(false);
      expect(cfg.allowRetry).toBe(false);
      expect(cfg.adaptiveDifficulty).toBe(true);
      expect(cfg.showResultOnlyAtEnd).toBe(true);
    });

    it('Đảm bảo config của Practice đúng contract định nghĩa (cho phép pause, lookup, feedback)', () => {
      const cfg = getExperienceConfig('practice');
      expect(cfg.timerMode).toBe('none');
      expect(cfg.canPause).toBe(true);
      expect(cfg.showImmediateFeedback).toBe(true);
      expect(cfg.allowHints).toBe(true);
      expect(cfg.allowLookup).toBe(true);
      expect(cfg.allowSaveVocabulary).toBe(true);
      expect(cfg.allowRetry).toBe(true);
      expect(cfg.allowTranscript).toBe(true);
      expect(cfg.allowAudioReplay).toBe(true);
      expect(cfg.adaptiveDifficulty).toBe(false);
      expect(cfg.showResultOnlyAtEnd).toBe(false);
    });

    it('Đảm bảo config của Mock đúng contract định nghĩa (nghiêm ngặt chuẩn ETS)', () => {
      const cfg = getExperienceConfig('mock');
      expect(cfg.timerMode).toBe('strict');
      expect(cfg.canPause).toBe(false);
      expect(cfg.showImmediateFeedback).toBe(false);
      expect(cfg.allowHints).toBe(false);
      expect(cfg.allowLookup).toBe(false);
      expect(cfg.allowSaveVocabulary).toBe(false);
      expect(cfg.allowRetry).toBe(false);
      expect(cfg.adaptiveDifficulty).toBe(false);
      expect(cfg.showResultOnlyAtEnd).toBe(true);
    });

    it('Fallback an toàn về Practice nếu experience mode không xác định', () => {
      const fallback = getExperienceConfig('unknown_mode' as unknown as ToeicExperienceMode);
      expect(fallback).toEqual(TOEIC_EXPERIENCE_CONFIGS.practice);
    });
  });

  describe('3. Combination Support Matrix & Diagnostic 4-Skills Guard', () => {
    it('Hỗ trợ đầy đủ các tổ hợp hợp lệ', () => {
      expect(isCombinationSupported('diagnostic', '2-skills').supported).toBe(true);
      expect(isCombinationSupported('practice', '2-skills').supported).toBe(true);
      expect(isCombinationSupported('practice', '4-skills').supported).toBe(true);
      expect(isCombinationSupported('mock', '2-skills').supported).toBe(true);
      expect(isCombinationSupported('mock', '4-skills').supported).toBe(true);
    });

    it('Từ chối tổ hợp diagnostic + 4-skills với lý do minh bạch và gợi ý thay thế', () => {
      const res = isCombinationSupported('diagnostic', '4-skills');
      expect(res.supported).toBe(false);
      expect(res.reason).toContain('Speaking & Writing là tác vụ tự luận mở');
      expect(res.recommendedAlternative).toEqual({
        experienceMode: 'diagnostic',
        skillScope: '2-skills',
      });
    });
  });

  describe('4. Generator & Snapshot Integration', () => {
    it('Sinh đề thi snapshot lưu giữ đầy đủ experienceMode, skillScope và experienceConfig', () => {
      const snapshot = generateToeicExam({
        experienceMode: 'practice',
        skillScope: '2-skills',
        seed: 42,
      });

      expect(snapshot.experienceMode).toBe('practice');
      expect(snapshot.skillScope).toBe('2-skills');
      expect(snapshot.experienceConfig).toBeDefined();
      expect(snapshot.experienceConfig?.canPause).toBe(true);
      expect(snapshot.experienceConfig?.timerMode).toBe('none');
      expect(snapshot.totalQuestions).toBe(20);
      expect(snapshot.questions.length).toBe(20);
    });

    it('Ghi nhận warning nếu yêu cầu tổ hợp không khuyến nghị', () => {
      const snapshot = generateToeicExam({
        experienceMode: 'diagnostic',
        skillScope: '4-skills',
        seed: 99,
      });

      expect(snapshot.diagnostics.warnings.some((w) => w.includes('Tổ hợp không khuyến nghị'))).toBe(true);
    });
  });

  describe('5. Attempt Serialization, Snapshot Metadata & Recovery', () => {
    it('createNewAttemptSnapshot lưu đúng experience metadata trong snapshot và meta', () => {
      const { snapshot, meta } = createNewAttemptSnapshot({
        mode: '2skills_mini',
        experienceMode: 'diagnostic',
        skillScope: '2-skills',
      }, 12345);

      expect(snapshot.experienceMode).toBe('diagnostic');
      expect(snapshot.skillScope).toBe('2-skills');
      expect(meta.experienceMode).toBe('diagnostic');
      expect(meta.skillScope).toBe('2-skills');
      expect(meta.experienceConfig?.timerMode).toBe('soft');
    });

    it('restoreSnapshotFromMeta phục hồi chính xác snapshot và giữ nguyên experience metadata', () => {
      const { meta } = createNewAttemptSnapshot({
        mode: '2skills_full',
        experienceMode: 'mock',
        skillScope: '2-skills',
      }, 777);

      const restoreResult = restoreSnapshotFromMeta(meta);
      expect(restoreResult.isFullyRestored).toBe(true);
      expect(restoreResult.snapshot.experienceMode).toBe('mock');
      expect(restoreResult.snapshot.skillScope).toBe('2-skills');
      expect(restoreResult.snapshot.experienceConfig?.timerMode).toBe('strict');
      expect(restoreResult.snapshot.experienceConfig?.canPause).toBe(false);
    });

    it('Backward compatibility: Phục hồi an toàn legacy meta chưa có experienceMode / skillScope', () => {
      const legacyMeta: ToeicAttemptSnapshotMeta = {
        attemptId: 'legacy_attempt_001',
        mode: '2skills_mini',
        questionIds: TOEIC_QUESTION_BANK.slice(0, 10).map((q) => q.id),
        groupIds: [],
        questionBankVersion: QUESTION_BANK_VERSION,
        generatedAt: new Date().toISOString(),
        seed: 101,
        totalQuestions: 10,
        durationMinutes: 15,
      };

      const result = restoreSnapshotFromMeta(legacyMeta);
      expect(result.snapshot.experienceMode).toBe('diagnostic');
      expect(result.snapshot.skillScope).toBe('2-skills');
      expect(result.snapshot.experienceConfig?.timerMode).toBe('soft');
    });
  });

  describe('6. Scoring Foundation & Experience Metadata Binding', () => {
    it('calculateToeicScores gắn đúng experienceMode và skillScope vào kết quả đánh giá', () => {
      const sampleQuestions = TOEIC_QUESTION_BANK.slice(0, 10);
      const userAnswers: Record<string, string> = {};
      sampleQuestions.forEach((q) => {
        userAnswers[q.id] = q.correctAnswer || 'A';
      });

      const evaluation = calculateToeicScores({
        mode: '2skills_mini',
        experienceMode: 'diagnostic',
        skillScope: '2-skills',
        questions: sampleQuestions,
        userAnswers,
      });

      expect(evaluation.experienceMode).toBe('diagnostic');
      expect(evaluation.skillScope).toBe('2-skills');
      expect(evaluation.listeningScore).toBeGreaterThanOrEqual(5);
      expect(evaluation.readingScore).toBeGreaterThanOrEqual(5);
    });

    it('Tự động suy luận experienceMode và skillScope từ legacy mode nếu không truyền vào scoring', () => {
      const sampleQuestions = TOEIC_QUESTION_BANK.slice(0, 10);
      const evaluation = calculateToeicScores({
        mode: '4skills',
        questions: sampleQuestions,
        userAnswers: {},
      });

      expect(evaluation.experienceMode).toBe('mock');
      expect(evaluation.skillScope).toBe('4-skills');
    });
  });
});
