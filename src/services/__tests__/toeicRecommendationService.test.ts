// src/services/__tests__/toeicRecommendationService.test.ts
import { describe, it, expect } from 'vitest';
import {
  getRecommendationForInsight,
  generateToeicRecommendations,
} from '../toeicRecommendationService';
import { ToeicInsight } from '../../types/toeic';

describe('TOEIC Phase 4 — Deterministic Recommendations Service', () => {
  const createMockInsight = (overrides: Partial<ToeicInsight>): ToeicInsight => ({
    type: 'subSkill',
    key: 'inference_author',
    displayName: 'Suy luận ý đồ tác giả',
    skill: 'reading',
    classification: 'weakness',
    severity: 65,
    priorityScore: 78,
    accuracy: 35,
    weightedAccuracy: 35,
    evidenceCount: 14,
    attemptsSeen: 2,
    correctCount: 5,
    incorrectCount: 9,
    unansweredCount: 0,
    averageDifficultyLevel: 2,
    confidence: 'high',
    trend: 'declining',
    recommendation: 'Cần dành thời gian ôn luyện kỹ năng suy luận',
    sourceBreakdown: {
      diagnostic: { attempts: 1, evidenceCount: 4, correct: 2 },
      practice: { attempts: 0, evidenceCount: 0, correct: 0 },
      mock: { attempts: 1, evidenceCount: 10, correct: 3 },
    },
    ...overrides,
  });

  describe('1. Sub-skill & Part Specific Action Mappings', () => {
    it('Part 3 / inference or listening conversation -> Practice TOEIC Part 3 & Four Skills Listening', () => {
      const insight = createMockInsight({
        type: 'subSkill',
        key: 'speaker_intent',
        displayName: 'Mục đích người nói',
        skill: 'listening',
      });

      const rec = getRecommendationForInsight(insight);

      expect(rec.title).toContain('Rèn luyện kỹ năng nghe');
      expect(rec.primaryAction.actionType).toBe('practice_toeic_part');
      expect(rec.primaryAction.targetTab).toBe('toeic');
      expect(rec.primaryAction.subTarget).toBe('part3_conv');
      expect(rec.primaryAction.isAvailable).toBe(true);

      expect(rec.secondaryAction?.actionType).toBe('practice_four_skills');
      expect(rec.secondaryAction?.targetTab).toBe('four_skills');
      expect(rec.secondaryAction?.subTarget).toBe('listening');
    });

    it('Part 5 / verb tense / grammar -> Review related grammar mistakes in Mistake Bank', () => {
      const insight = createMockInsight({
        type: 'subSkill',
        key: 'verb_tenses',
        displayName: 'Thì của động từ',
        skill: 'reading',
      });

      const rec = getRecommendationForInsight(insight);

      expect(rec.title).toContain('Khắc phục ngữ pháp');
      expect(rec.primaryAction.actionType).toBe('review_grammar_mistakes');
      expect(rec.primaryAction.targetTab).toBe('mistakes');
      expect(rec.primaryAction.subTarget).toBe('grammar');
      expect(rec.primaryAction.isAvailable).toBe(true);

      expect(rec.secondaryAction?.actionType).toBe('practice_toeic_part');
      expect(rec.secondaryAction?.targetTab).toBe('toeic');
      expect(rec.secondaryAction?.subTarget).toBe('part5_grammar');
    });

    it('Part 5 grammar prefix (grammar_pos) -> Review grammar mistakes', () => {
      const insight = createMockInsight({
        type: 'subSkill',
        key: 'grammar_pos',
        displayName: 'Từ loại (Part of Speech)',
        skill: 'reading',
      });

      const rec = getRecommendationForInsight(insight);

      expect(rec.primaryAction.actionType).toBe('review_grammar_mistakes');
      expect(rec.primaryAction.targetTab).toBe('mistakes');
    });

    it('Workplace vocabulary / vocab meaning -> Review & save related vocabulary in Flashcards', () => {
      const insight = createMockInsight({
        type: 'subSkill',
        key: 'vocab_meaning',
        displayName: 'Nghĩa từ vựng trong ngữ cảnh',
        skill: 'reading',
      });

      const rec = getRecommendationForInsight(insight);

      expect(rec.title).toContain('Củng cố vốn từ vựng');
      expect(rec.primaryAction.actionType).toBe('review_vocabulary');
      expect(rec.primaryAction.targetTab).toBe('flashcards');
      expect(rec.primaryAction.isAvailable).toBe(true);

      expect(rec.secondaryAction?.actionType).toBe('review_mistakes');
      expect(rec.secondaryAction?.targetTab).toBe('mistakes');
      expect(rec.secondaryAction?.subTarget).toBe('vocabulary');
    });

    it('Part 7 reading sub-skill -> Practice TOEIC Part 7 & Four Skills Reading', () => {
      const insight = createMockInsight({
        type: 'subSkill',
        key: 'main_purpose',
        displayName: 'Mục đích chính của đoạn văn',
        skill: 'reading',
      });

      const rec = getRecommendationForInsight(insight);

      expect(rec.title).toContain('Nâng cao kỹ năng đọc');
      expect(rec.primaryAction.actionType).toBe('practice_toeic_part');
      expect(rec.primaryAction.targetTab).toBe('toeic');
      expect(rec.primaryAction.subTarget).toBe('part7_reading');
    });
  });

  describe('2. Speaking & Writing Open-ended Mappings', () => {
    it('Speaking sub-skill -> Practice pronunciation with AI in Pronunciation Arena', () => {
      const insight = createMockInsight({
        type: 'subSkill',
        key: 'pronunciation_intonation',
        displayName: 'Phát âm và ngữ điệu',
        skill: 'speaking',
      });

      const rec = getRecommendationForInsight(insight);

      expect(rec.primaryAction.actionType).toBe('practice_pronunciation');
      expect(rec.primaryAction.targetTab).toBe('pronunciation');
      expect(rec.secondaryAction?.actionType).toBe('practice_four_skills');
      expect(rec.secondaryAction?.targetTab).toBe('four_skills');
      expect(rec.secondaryAction?.subTarget).toBe('speaking');
    });

    it('Writing part (writing_email) -> Practice writing in Four Skills', () => {
      const insight = createMockInsight({
        type: 'part',
        key: 'writing_email',
        displayName: 'Writing: Email Response',
        skill: 'writing',
      });

      const rec = getRecommendationForInsight(insight);

      expect(rec.primaryAction.actionType).toBe('practice_four_skills');
      expect(rec.primaryAction.targetTab).toBe('four_skills');
      expect(rec.primaryAction.subTarget).toBe('writing');
    });
  });

  describe('3. Safe Fallback for Unknown Weaknesses', () => {
    it('Unknown sub-skill key falls back safely to Review related mistakes in Mistake Bank', () => {
      const insight = createMockInsight({
        type: 'subSkill',
        key: 'unsupported_rare_skill_xyz',
        displayName: 'Kỹ Năng Chưa Phân Loại',
        skill: 'reading',
      });

      const rec = getRecommendationForInsight(insight);

      expect(rec.primaryAction.actionType).toBe('review_mistakes');
      expect(rec.primaryAction.label).toBe('Xem lại các lỗi sai liên quan');
      expect(rec.primaryAction.targetTab).toBe('mistakes');
      expect(rec.primaryAction.isAvailable).toBe(true);
      expect(rec.secondaryAction).toBeUndefined();
    });
  });

  describe('4. Reason Construction & Pure Function Determinism', () => {
    it('builds accurate reason text with accuracy, evidence, trend, and confidence', () => {
      const insight = createMockInsight({
        weightedAccuracy: 42,
        evidenceCount: 18,
        trend: 'declining',
        confidence: 'high',
      });

      const rec = getRecommendationForInsight(insight);

      expect(rec.reason).toContain('Độ chính xác 42%');
      expect(rec.reason).toContain('18 câu đã làm');
      expect(rec.reason).toContain('Xu hướng đang sụt giảm');
      expect(rec.reason).toContain('Độ tin cậy cao');
    });

    it('generateToeicRecommendations handles empty priority lists gracefully', () => {
      expect(generateToeicRecommendations([])).toEqual([]);
    });

    it('produces identical output given identical input (pure function)', () => {
      const insight = createMockInsight({ key: 'part3_conv', type: 'part', skill: 'listening' });
      const rec1 = getRecommendationForInsight(insight);
      const rec2 = getRecommendationForInsight(insight);

      expect(rec1).toEqual(rec2);
    });
  });
});
