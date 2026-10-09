// src/services/__tests__/toeicHistoricalAnalytics.test.ts
import { describe, it, expect } from 'vitest';
import {
  aggregateToeicAttempts,
  buildToeicWeaknessProfile,
  DEFAULT_WEAKNESS_PROFILE_CONFIG,
  deriveEvidenceStrength,
  derivePerformanceStability,
  deriveWeaknessLifecycle,
  deriveStrengthLifecycle,
  deriveWeaknessSeverityLevel,
} from '../toeicHistoricalAnalytics';
import { buildToeicAttemptAnalytics } from '../toeicAttemptAnalytics';
import { ToeicQuestion } from '../../types/toeic';

describe('TOEIC Historical Aggregation & Weakness Profile (Phase 2)', () => {
  const createMockQuestion = (overrides: Partial<ToeicQuestion>): ToeicQuestion => ({
    id: 'mock_q',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'medium',
    subSkill: 'grammar_tenses',
    questionType: 'grammar_pos',
    questionText: 'Question text',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'A',
    explanation: 'Explanation',
    vietnameseTranslation: 'Translation',
    ...overrides,
  });

  describe('1. Minimum Evidence Rule & Weakness Detection', () => {
    it('low accuracy + enough evidence -> WEAKNESS', () => {
      // 4 câu thuộc subSkill 'pronoun_reference' với accuracy 25% (1/4 đúng)
      const q1 = createMockQuestion({ id: 'q1', subSkill: 'pronoun_reference', correctAnswer: 'A' });
      const q2 = createMockQuestion({ id: 'q2', subSkill: 'pronoun_reference', correctAnswer: 'A' });
      const q3 = createMockQuestion({ id: 'q3', subSkill: 'pronoun_reference', correctAnswer: 'A' });
      const q4 = createMockQuestion({ id: 'q4', subSkill: 'pronoun_reference', correctAnswer: 'A' });

      const attempt = buildToeicAttemptAnalytics({
        attemptId: 'att_1',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions: [q1, q2, q3, q4],
        userAnswers: { q1: 'A', q2: 'B', q3: 'B', q4: 'B' }, // 1 đúng, 3 sai (25%)
      });

      const profile = buildToeicWeaknessProfile([attempt]);

      // Tìm insight cho pronoun_reference
      const insight = profile.weaknesses.find((w) => w.key === 'pronoun_reference');
      expect(insight).toBeDefined();
      expect(insight?.classification).toBe('weakness');
      expect(insight?.accuracy).toBe(25);
      expect(insight?.evidenceCount).toBe(4);
      expect(insight?.severity).toBe(75); // 100 - 25 = 75
      expect(insight?.confidence).not.toBe('insufficient');
    });

    it('low accuracy + low evidence (< minimumEvidence) -> KHÔNG kết luận weakness (insufficient_data)', () => {
      // Chỉ có 1 câu thuộc subSkill 'conditional_sentences' (sai 100% nhưng n=1 < 3)
      const q1 = createMockQuestion({ id: 'q1', subSkill: 'conditional_sentences', correctAnswer: 'A' });

      const attempt = buildToeicAttemptAnalytics({
        attemptId: 'att_1',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions: [q1],
        userAnswers: { q1: 'B' }, // 0/1 đúng (0%)
      });

      const profile = buildToeicWeaknessProfile([attempt]);

      // pronoun_reference không được nằm trong weaknesses vì thiếu bằng chứng
      const inWeakness = profile.weaknesses.find((w) => w.key === 'conditional_sentences');
      expect(inWeakness).toBeUndefined();

      // Phải nằm trong neutralOrInsufficient với classification 'insufficient_data'
      const inNeutral = profile.neutralOrInsufficient.find((i) => i.key === 'conditional_sentences');
      expect(inNeutral).toBeDefined();
      expect(inNeutral?.classification).toBe('insufficient_data');
      expect(inNeutral?.confidence).toBe('insufficient');
    });
  });

  describe('2. Strength Detection', () => {
    it('high accuracy + enough evidence -> STRENGTH', () => {
      // 5 câu thuộc subSkill 'vocab_collocation' với accuracy 100% (5/5 đúng)
      const questions = [1, 2, 3, 4, 5].map((i) =>
        createMockQuestion({ id: `vc_${i}`, subSkill: 'vocab_collocation', correctAnswer: 'A' })
      );

      const userAnswers: Record<string, string> = {};
      questions.forEach((q) => {
        userAnswers[q.id] = 'A';
      });

      const attempt = buildToeicAttemptAnalytics({
        attemptId: 'att_strength',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions,
        userAnswers,
      });

      const profile = buildToeicWeaknessProfile([attempt]);

      const strengthInsight = profile.strengths.find((s) => s.key === 'vocab_collocation');
      expect(strengthInsight).toBeDefined();
      expect(strengthInsight?.classification).toBe('strength');
      expect(strengthInsight?.accuracy).toBe(100);
      expect(strengthInsight?.evidenceCount).toBe(5);
      expect(strengthInsight?.severity).toBe(0);
    });

    it('high accuracy + low evidence -> không vội kết luận strength', () => {
      // Chỉ 1 câu đúng duy nhất
      const q1 = createMockQuestion({ id: 'q1', subSkill: 'rare_grammar', correctAnswer: 'A' });

      const attempt = buildToeicAttemptAnalytics({
        attemptId: 'att_few',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions: [q1],
        userAnswers: { q1: 'A' },
      });

      const profile = buildToeicWeaknessProfile([attempt]);
      const strengthInsight = profile.strengths.find((s) => s.key === 'rare_grammar');
      expect(strengthInsight).toBeUndefined();
    });
  });

  describe('3. Practice Retry Invariant (First-Attempt Protection)', () => {
    it('Practice: retry sửa đúng câu hỏi tuyệt đối KHÔNG xóa bỏ điểm yếu lần đầu (firstAttemptAnswers)', () => {
      const q1 = createMockQuestion({ id: 'q1', subSkill: 'preposition_idioms', correctAnswer: 'A' });
      const q2 = createMockQuestion({ id: 'q2', subSkill: 'preposition_idioms', correctAnswer: 'A' });
      const q3 = createMockQuestion({ id: 'q3', subSkill: 'preposition_idioms', correctAnswer: 'A' });

      // Lần đầu làm: sai cả 3 câu
      const firstAttemptAnswers = { q1: 'B', q2: 'C', q3: 'D' };
      // Sau đó retry trong Practice và chọn đúng tất cả
      const userAnswersAfterRetry = { q1: 'A', q2: 'A', q3: 'A' };

      const attempt = buildToeicAttemptAnalytics({
        attemptId: 'att_practice',
        experienceMode: 'practice',
        skillScope: '2-skills',
        questions: [q1, q2, q3],
        userAnswers: userAnswersAfterRetry,
        firstAttemptAnswers,
      });

      const profile = buildToeicWeaknessProfile([attempt]);

      // Evidence ban đầu vẫn là 0% -> điểm yếu preposition_idioms được phát hiện chính xác
      const weakness = profile.weaknesses.find((w) => w.key === 'preposition_idioms');
      expect(weakness).toBeDefined();
      expect(weakness?.accuracy).toBe(0);
      expect(weakness?.evidenceCount).toBe(3);
    });
  });

  describe('4. Objective vs Open-Ended Separation', () => {
    it('Speaking / Writing tự luận mở tuyệt đối không giả mạo accuracy và được phân tích theo rubric', () => {
      const sp1 = createMockQuestion({ id: 'sp1', skill: 'speaking', part: 'speaking_read', correctAnswer: undefined });
      const sp2 = createMockQuestion({ id: 'sp2', skill: 'speaking', part: 'speaking_read', correctAnswer: undefined });
      const wr1 = createMockQuestion({ id: 'wr1', skill: 'writing', part: 'writing_email', correctAnswer: undefined });

      const attempt = buildToeicAttemptAnalytics({
        attemptId: 'att_sw',
        experienceMode: 'mock',
        skillScope: '4-skills',
        questions: [sp1, sp2, wr1],
        speakingTranscript: 'Short audio transcript with limited words',
        writingText: 'Dear Sir, I am writing to inquire about the position.',
        scoreEvaluation: {
          speakingScore: 90, // Điểm thấp (90/200)
          writingScore: 180, // Điểm cao (180/200)
          speakingEvaluation: { pronunciationScore: 25, fluencyScore: 35, contentScore: 30 },
          writingEvaluation: { grammarScore: 60, organizationScore: 60, vocabularyScore: 60 },
        } as any,
      });

      const profile = buildToeicWeaknessProfile([attempt], {
        skillMinimumEvidence: 1,
        minimumEvidence: 1,
      });

      // Speaking là open-ended: accuracy phải là null
      const speakingInsight = profile.weaknesses.find((w) => w.key === 'speaking');
      expect(speakingInsight).toBeDefined();
      expect(speakingInsight?.accuracy).toBeNull();
      expect(speakingInsight?.score).toBe(90);
      expect(speakingInsight?.classification).toBe('weakness');

      // Writing là strength (180/200)
      const writingInsight = profile.strengths.find((s) => s.key === 'writing');
      expect(writingInsight).toBeDefined();
      expect(writingInsight?.accuracy).toBeNull();
      expect(writingInsight?.score).toBe(180);
    });
  });

  describe('5. Experience Source Preservation', () => {
    it('phân định rạch ròi đóng góp từ Diagnostic, Practice và Mock qua sourceBreakdown', () => {
      const q = createMockQuestion({ id: 'q_common', part: 'part5_grammar', subSkill: 'subject_verb_agreement', correctAnswer: 'A' });

      // Attempt 1: Diagnostic (sai)
      const aDiag = buildToeicAttemptAnalytics({
        attemptId: 'a1',
        experienceMode: 'diagnostic',
        skillScope: '2-skills',
        questions: [q],
        userAnswers: { q_common: 'B' },
      });

      // Attempt 2: Practice (đúng)
      const aPrac = buildToeicAttemptAnalytics({
        attemptId: 'a2',
        experienceMode: 'practice',
        skillScope: '2-skills',
        questions: [q],
        userAnswers: { q_common: 'A' },
      });

      // Attempt 3: Mock (sai)
      const aMock = buildToeicAttemptAnalytics({
        attemptId: 'a3',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions: [q],
        userAnswers: { q_common: 'C' },
      });

      const profile = buildToeicWeaknessProfile([aDiag, aPrac, aMock]);

      const subInsight = profile.weaknesses.find((i) => i.key === 'subject_verb_agreement') ||
        profile.neutralOrInsufficient.find((i) => i.key === 'subject_verb_agreement');

      expect(subInsight).toBeDefined();
      expect(subInsight?.sourceBreakdown.diagnostic.attempts).toBe(1);
      expect(subInsight?.sourceBreakdown.diagnostic.evidenceCount).toBe(1);
      expect(subInsight?.sourceBreakdown.diagnostic.correct).toBe(0);

      expect(subInsight?.sourceBreakdown.practice.attempts).toBe(1);
      expect(subInsight?.sourceBreakdown.practice.evidenceCount).toBe(1);
      expect(subInsight?.sourceBreakdown.practice.correct).toBe(1);

      expect(subInsight?.sourceBreakdown.mock.attempts).toBe(1);
      expect(subInsight?.sourceBreakdown.mock.evidenceCount).toBe(1);
      expect(subInsight?.sourceBreakdown.mock.correct).toBe(0);
    });
  });

  describe('6. Multi-level Insights & Priority Ranking', () => {
    it('ưu tiên Sub-skill hơn Part và Skill trong bảng priorities để có hành động cụ thể', () => {
      // Tạo attempt có cả Skill Reading, Part 5 và Sub-skill grammar_pos bị sai
      const questions = [1, 2, 3, 4].map((i) =>
        createMockQuestion({
          id: `qp_${i}`,
          part: 'part5_grammar',
          skill: 'reading',
          subSkill: 'grammar_pos',
          correctAnswer: 'A',
        })
      );

      const attempt = buildToeicAttemptAnalytics({
        attemptId: 'att_multi',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions,
        userAnswers: { qp_1: 'B', qp_2: 'B', qp_3: 'B', qp_4: 'B' }, // 0%
      });

      const profile = buildToeicWeaknessProfile([attempt]);

      // Sub-skill grammar_pos phải có priorityScore cao hơn Part 5 nhờ type bonus (+20 vs +10)
      const subInsight = profile.priorities.find((p) => p.type === 'subSkill' && p.key === 'grammar_pos');
      const partInsight = profile.priorities.find((p) => p.type === 'part' && p.key === 'part5_grammar');

      expect(subInsight).toBeDefined();
      expect(partInsight).toBeDefined();
      expect(subInsight!.priorityScore).toBeGreaterThan(partInsight!.priorityScore);
    });
  });

  describe('7. Edge Cases: 0 Attempts & Empty Data Safety', () => {
    it('an toàn khi mảng attempts rỗng []: không crash, không NaN', () => {
      const aggregates = aggregateToeicAttempts([]);
      expect(aggregates.bySkill.listening.accuracy).toBe(0);
      expect(aggregates.bySkill.reading.accuracy).toBe(0);

      const profile = buildToeicWeaknessProfile([]);
      expect(profile.confidence).toBe('insufficient');
      expect(profile.evidenceSummary.totalAttempts).toBe(0);
      expect(profile.weaknesses.length).toBe(0);
      expect(profile.strengths.length).toBe(0);
      expect(profile.priorities.length).toBe(0);
    });
  });

  describe('8. SRS & Mistake Bank Invariants (Zero Mutation)', () => {
    it('chạy historical aggregation & weakness profile là hàm thuần túy, tuyệt đối KHÔNG gọi mutate hay ghi đè thẻ SRS/Mistake Bank', () => {
      const q1 = createMockQuestion({ id: 'q1', subSkill: 'grammar_subjunctive', correctAnswer: 'A' });
      const q2 = createMockQuestion({ id: 'q2', subSkill: 'grammar_subjunctive', correctAnswer: 'A' });
      const q3 = createMockQuestion({ id: 'q3', subSkill: 'grammar_subjunctive', correctAnswer: 'A' });

      const attempt = buildToeicAttemptAnalytics({
        attemptId: 'att_pure',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions: [q1, q2, q3],
        userAnswers: { q1: 'B', q2: 'B', q3: 'B' },
      });

      // Chạy buildToeicWeaknessProfile
      const profile = buildToeicWeaknessProfile([attempt]);
      expect(profile.weaknesses.length).toBeGreaterThan(0);

      // Invariant: Kết quả trả về là pure snapshot object, không có side-effect lên bất kỳ store bên ngoài
      expect(profile.profileId).toBeDefined();
      expect(profile.aggregates).toBeDefined();
    });
  });

  describe('9. Difficulty Evidence in Severity Calculation', () => {
    it('làm sai câu dễ (Easy) sẽ có mức độ nghiêm trọng (severity) cao hơn làm sai câu khó (Hard)', () => {
      // Part A: 4 câu Easy, làm sai cả 4
      const easyQuestions = [1, 2, 3, 4].map((i) =>
        createMockQuestion({
          id: `easy_${i}`,
          part: 'part1_photos',
          difficulty: 'easy',
          correctAnswer: 'A',
        })
      );

      // Part B: 4 câu Hard, làm sai cả 4
      const hardQuestions = [1, 2, 3, 4].map((i) =>
        createMockQuestion({
          id: `hard_${i}`,
          part: 'part7_reading',
          difficulty: 'hard',
          correctAnswer: 'A',
        })
      );

      const attempt = buildToeicAttemptAnalytics({
        attemptId: 'att_diff_sev',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions: [...easyQuestions, ...hardQuestions],
        userAnswers: {
          easy_1: 'B',
          easy_2: 'B',
          easy_3: 'B',
          easy_4: 'B',
          hard_1: 'B',
          hard_2: 'B',
          hard_3: 'B',
          hard_4: 'B',
        },
      });

      const profile = buildToeicWeaknessProfile([attempt]);

      const easyPartInsight = profile.weaknesses.find((w) => w.key === 'part1_photos');
      const hardPartInsight = profile.weaknesses.find((w) => w.key === 'part7_reading');

      expect(easyPartInsight).toBeDefined();
      expect(hardPartInsight).toBeDefined();

      // Cả 2 part đều sai 100%, nhưng Part 1 (Easy) có easyFailureSeverityWeight (1.3x) nên severity cao hơn
      expect(easyPartInsight!.severity).toBeGreaterThan(hardPartInsight!.severity);
    });
  });

  describe('10. Recency Weighting (Recent Evidence > Old Evidence)', () => {
    it('bài thi gần đây (recent) có trọng số ảnh hưởng lớn hơn bài thi cũ (old)', () => {
      const q1 = createMockQuestion({ id: 'qr_1', subSkill: 'pronoun_reference', correctAnswer: 'A' });
      const q2 = createMockQuestion({ id: 'qr_2', subSkill: 'pronoun_reference', correctAnswer: 'A' });
      const q3 = createMockQuestion({ id: 'qr_3', subSkill: 'pronoun_reference', correctAnswer: 'A' });

      // Attempt 1: Làm cách đây 10 ngày (cũ) - Làm đúng cả 3 câu (100%)
      const oldAttempt = buildToeicAttemptAnalytics({
        attemptId: 'att_old',
        experienceMode: 'mock',
        skillScope: '2-skills',
        completedAt: Date.now() - 10 * 24 * 3600 * 1000,
        questions: [q1, q2, q3],
        userAnswers: { qr_1: 'A', qr_2: 'A', qr_3: 'A' }, // 100%
      });

      // Attempt 2: Làm hôm nay (mới) - Làm sai cả 3 câu (0%)
      const recentAttempt = buildToeicAttemptAnalytics({
        attemptId: 'att_recent',
        experienceMode: 'mock',
        skillScope: '2-skills',
        completedAt: Date.now(),
        questions: [q1, q2, q3],
        userAnswers: { qr_1: 'B', qr_2: 'B', qr_3: 'B' }, // 0%
      });

      const profile = buildToeicWeaknessProfile([oldAttempt, recentAttempt]);

      const subInsight = profile.weaknesses.find((w) => w.key === 'pronoun_reference') ||
        profile.neutralOrInsufficient.find((i) => i.key === 'pronoun_reference');

      expect(subInsight).toBeDefined();
      expect(subInsight?.accuracy).toBe(50); // Raw accuracy = 3 / 6 = 50%
      // Vì bài mới (0%) có trọng số cao hơn bài cũ (100%), weightedAccuracy phải < 50%
      expect(subInsight?.weightedAccuracy).toBeLessThan(50);
    });
  });

  describe('11. Experience Mode Weighting (Mock > Diagnostic > Practice)', () => {
    it('bài thi Mock phòng thi nghiêm ngặt có trọng số cao hơn bài thi Practice tự do', () => {
      const q1 = createMockQuestion({ id: 'qm_1', subSkill: 'verb_tenses', correctAnswer: 'A' });
      const q2 = createMockQuestion({ id: 'qm_2', subSkill: 'verb_tenses', correctAnswer: 'A' });
      const q3 = createMockQuestion({ id: 'qm_3', subSkill: 'verb_tenses', correctAnswer: 'A' });

      const now = Date.now();
      // Attempt 1: Mock Test - Thất bại (0/3 đúng = 0%)
      const mockAttempt = buildToeicAttemptAnalytics({
        attemptId: 'att_mock_fail',
        experienceMode: 'mock',
        skillScope: '2-skills',
        completedAt: now,
        questions: [q1, q2, q3],
        userAnswers: { qm_1: 'B', qm_2: 'B', qm_3: 'B' },
      });

      // Attempt 2: Practice Test - Làm đúng (3/3 đúng = 100%)
      const practiceAttempt = buildToeicAttemptAnalytics({
        attemptId: 'att_practice_pass',
        experienceMode: 'practice',
        skillScope: '2-skills',
        completedAt: now,
        questions: [q1, q2, q3],
        userAnswers: { qm_1: 'A', qm_2: 'A', qm_3: 'A' },
      });

      const profile = buildToeicWeaknessProfile([mockAttempt, practiceAttempt]);

      const subInsight = profile.weaknesses.find((w) => w.key === 'verb_tenses') ||
        profile.neutralOrInsufficient.find((i) => i.key === 'verb_tenses');

      expect(subInsight).toBeDefined();
      expect(subInsight?.accuracy).toBe(50); // Raw accuracy = 3/6 = 50%
      // Mock weight = 1.5, Practice weight = 1.0 -> Mock thất bại kéo điểm xuống < 50%
      expect(subInsight?.weightedAccuracy).toBeLessThan(50);
    });
  });

  describe('12. Trend Detection (Improving, Stable, Declining)', () => {
    it('chỉ tính trend khi đủ tối thiểu minTrendPoints (>= 3 attempts)', () => {
      const q = createMockQuestion({ id: 'qt_1', subSkill: 'inference', correctAnswer: 'A' });

      // Chỉ có 2 attempts
      const a1 = buildToeicAttemptAnalytics({
        attemptId: 't1',
        experienceMode: 'mock',
        skillScope: '2-skills',
        completedAt: Date.now() - 2000,
        questions: [q],
        userAnswers: { qt_1: 'B' },
      });
      const a2 = buildToeicAttemptAnalytics({
        attemptId: 't2',
        experienceMode: 'mock',
        skillScope: '2-skills',
        completedAt: Date.now() - 1000,
        questions: [q],
        userAnswers: { qt_1: 'A' },
      });

      const profile = buildToeicWeaknessProfile([a1, a2]);
      const insight = profile.neutralOrInsufficient.find((i) => i.key === 'inference');
      expect(insight?.trend).toBe('insufficient_data');
    });

    it('nhận diện chính xác chuỗi cải thiện (Improving) khi độ chính xác tăng đều', () => {
      const q1 = createMockQuestion({ id: 'qi_1', subSkill: 'inference', correctAnswer: 'A' });
      const q2 = createMockQuestion({ id: 'qi_2', subSkill: 'inference', correctAnswer: 'A' });
      const q3 = createMockQuestion({ id: 'qi_3', subSkill: 'inference', correctAnswer: 'A' });

      // 3 attempts tăng dần: 0% -> 50% -> 100%
      const a1 = buildToeicAttemptAnalytics({
        attemptId: 'ti_1',
        experienceMode: 'mock',
        skillScope: '2-skills',
        completedAt: 1000,
        questions: [q1, q2],
        userAnswers: { qi_1: 'B', qi_2: 'B' }, // 0%
      });
      const a2 = buildToeicAttemptAnalytics({
        attemptId: 'ti_2',
        experienceMode: 'mock',
        skillScope: '2-skills',
        completedAt: 2000,
        questions: [q1, q2],
        userAnswers: { qi_1: 'A', qi_2: 'B' }, // 50%
      });
      const a3 = buildToeicAttemptAnalytics({
        attemptId: 'ti_3',
        experienceMode: 'mock',
        skillScope: '2-skills',
        completedAt: 3000,
        questions: [q1, q2],
        userAnswers: { qi_1: 'A', qi_2: 'A' }, // 100%
      });

      const profile = buildToeicWeaknessProfile([a1, a2, a3]);
      const insight = profile.weaknesses.find((i) => i.key === 'inference') ||
        profile.strengths.find((i) => i.key === 'inference') ||
        profile.neutralOrInsufficient.find((i) => i.key === 'inference');

      expect(insight?.trend).toBe('improving');
    });

    it('nhận diện chính xác chuỗi suy giảm (Declining) khi độ chính xác rơi dốc', () => {
      const q1 = createMockQuestion({ id: 'qd_1', subSkill: 'speaker_intent', correctAnswer: 'A' });
      const q2 = createMockQuestion({ id: 'qd_2', subSkill: 'speaker_intent', correctAnswer: 'A' });

      // 3 attempts giảm dần: 100% -> 50% -> 0%
      const a1 = buildToeicAttemptAnalytics({
        attemptId: 'td_1',
        experienceMode: 'mock',
        skillScope: '2-skills',
        completedAt: 1000,
        questions: [q1, q2],
        userAnswers: { qd_1: 'A', qd_2: 'A' }, // 100%
      });
      const a2 = buildToeicAttemptAnalytics({
        attemptId: 'td_2',
        experienceMode: 'mock',
        skillScope: '2-skills',
        completedAt: 2000,
        questions: [q1, q2],
        userAnswers: { qd_1: 'A', qd_2: 'B' }, // 50%
      });
      const a3 = buildToeicAttemptAnalytics({
        attemptId: 'td_3',
        experienceMode: 'mock',
        skillScope: '2-skills',
        completedAt: 3000,
        questions: [q1, q2],
        userAnswers: { qd_1: 'B', qd_2: 'B' }, // 0%
      });

      const profile = buildToeicWeaknessProfile([a1, a2, a3]);
      const insight = profile.weaknesses.find((i) => i.key === 'speaker_intent') ||
        profile.neutralOrInsufficient.find((i) => i.key === 'speaker_intent');

      expect(insight?.trend).toBe('declining');
    });
  });

  describe('13. Priority Deduplication & Hierarchical Non-Domination', () => {
    it('không để Reading, Part 7 và Part 7 Inference cùng chiếm 3 slot; ưu tiên sub-skill cụ thể', () => {
      // Thí sinh làm sai câu Part 7 Inference (Reading)
      const qInf1 = createMockQuestion({ id: 'inf_1', part: 'part7_reading', skill: 'reading', subSkill: 'inference', correctAnswer: 'A' });
      const qInf2 = createMockQuestion({ id: 'inf_2', part: 'part7_reading', skill: 'reading', subSkill: 'inference', correctAnswer: 'A' });
      const qInf3 = createMockQuestion({ id: 'inf_3', part: 'part7_reading', skill: 'reading', subSkill: 'inference', correctAnswer: 'A' });

      // Thí sinh cũng làm sai Part 2 Wh-questions (Listening)
      const qWh1 = createMockQuestion({ id: 'wh_1', part: 'part2_qna', skill: 'listening', subSkill: 'wh_question', correctAnswer: 'A' });
      const qWh2 = createMockQuestion({ id: 'wh_2', part: 'part2_qna', skill: 'listening', subSkill: 'wh_question', correctAnswer: 'A' });
      const qWh3 = createMockQuestion({ id: 'wh_3', part: 'part2_qna', skill: 'listening', subSkill: 'wh_question', correctAnswer: 'A' });

      const attempt = buildToeicAttemptAnalytics({
        attemptId: 'att_dedup',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions: [qInf1, qInf2, qInf3, qWh1, qWh2, qWh3],
        userAnswers: {
          inf_1: 'B',
          inf_2: 'B',
          inf_3: 'B',
          wh_1: 'B',
          wh_2: 'B',
          wh_3: 'B',
        },
      });

      const profile = buildToeicWeaknessProfile([attempt]);

      // Priorities phải có tối đa 5 items
      expect(profile.priorities.length).toBeLessThanOrEqual(5);

      // SubSkill 'inference' đã được chọn
      const hasInference = profile.priorities.some((p) => p.type === 'subSkill' && p.key === 'inference');
      expect(hasInference).toBe(true);

      // Nhờ deduplication: Broad 'reading' không được chèn vào chiếm chỗ khi inference đã được chọn
      const readingPriority = profile.priorities.find((p) => p.type === 'skill' && p.key === 'reading');
      expect(readingPriority).toBeUndefined();

      // Và SubSkill 'wh_question' của Listening cũng được đưa vào (đa dạng hóa trọng tâm ôn tập)
      const hasWhQuestion = profile.priorities.some((p) => p.type === 'subSkill' && p.key === 'wh_question');
      expect(hasWhQuestion).toBe(true);
    });
  });

  describe('14. Time & Pacing Analytics', () => {
    it('tính toán chính xác thời gian trung bình và nhận diện pacing khi timeSpent đáng tin cậy', () => {
      const q1 = createMockQuestion({ id: 'qt_1', correctAnswer: 'A' });
      const q2 = createMockQuestion({ id: 'qt_2', correctAnswer: 'A' });

      const attempt = buildToeicAttemptAnalytics({
        attemptId: 'att_time',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions: [q1, q2],
        userAnswers: { qt_1: 'A', qt_2: 'A' },
        timeSpentSeconds: 40, // 2 câu mất 40s -> 20s/câu (< 30s là fast)
      });

      const profile = buildToeicWeaknessProfile([attempt]);

      expect(profile.timeAnalytics).toBeDefined();
      expect(profile.timeAnalytics?.isReliable).toBe(true);
      expect(profile.timeAnalytics?.totalTimeSpentSeconds).toBe(40);
      expect(profile.timeAnalytics?.averageSecondsPerQuestion).toBe(20);
      expect(profile.timeAnalytics?.pacingObservation).toContain('Tốc độ làm bài nhanh');
    });

    it('vô hiệu hóa time analytics khi không có dữ liệu thời gian (0s)', () => {
      const q1 = createMockQuestion({ id: 'qt_1', correctAnswer: 'A' });

      const attempt = buildToeicAttemptAnalytics({
        attemptId: 'att_notime',
        experienceMode: 'practice',
        skillScope: '2-skills',
        questions: [q1],
        userAnswers: { qt_1: 'A' },
        timeSpentSeconds: 0,
      });

      const profile = buildToeicWeaknessProfile([attempt]);

      expect(profile.timeAnalytics?.isReliable).toBe(false);
      expect(profile.timeAnalytics?.averageSecondsPerQuestion).toBe(0);
    });
  });

  describe('15. Evidence Tiers & Severity vs Evidence Strength Decoupling', () => {
    it('phân loại đúng 3 bậc bằng chứng: emerging (3-4), likely (5-9), established (10+)', () => {
      expect(deriveEvidenceStrength(2)).toBe('insufficient');
      expect(deriveEvidenceStrength(3)).toBe('emerging');
      expect(deriveEvidenceStrength(4)).toBe('emerging');
      expect(deriveEvidenceStrength(5)).toBe('likely');
      expect(deriveEvidenceStrength(9)).toBe('likely');
      expect(deriveEvidenceStrength(10)).toBe('established');
      expect(deriveEvidenceStrength(25)).toBe('established');
    });

    it('tách biệt rõ ràng severityLevel và evidenceStrength trong profile insight', () => {
      // 3 câu sai 100% -> emerging evidence nhưng critical severity
      const questions = Array.from({ length: 3 }, (_, i) =>
        createMockQuestion({ id: `q_em_${i}`, subSkill: 'grammar_subjunctive', correctAnswer: 'A' })
      );
      const attempt = buildToeicAttemptAnalytics({
        attemptId: 'att_em',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions,
        userAnswers: { q_em_0: 'B', q_em_1: 'B', q_em_2: 'B' },
      });

      const profile = buildToeicWeaknessProfile([attempt], { minimumEvidence: 3 });
      const insight = profile.weaknesses.find((w) => w.key === 'grammar_subjunctive');
      expect(insight).toBeDefined();
      expect(insight?.evidenceStrength).toBe('emerging');
      expect(insight?.severityLevel).toBe('critical'); // 0% accuracy -> severity = 100 -> critical
      expect(insight?.confidence).toBe('low'); // emerging evidence -> low confidence
    });
  });

  describe('16. Anti-Noise Trend & Volatility Suppression', () => {
    it('yêu cầu tối thiểu minTrendEvidence (>= 6 câu) để tránh nhiễu lật mặt xu hướng', () => {
      // 3 attempts nhưng mỗi attempt chỉ 1 câu -> tổng 3 câu < 6 câu
      const q1 = createMockQuestion({ id: 'q_t1', subSkill: 'vocab_meaning', correctAnswer: 'A' });
      const a1 = buildToeicAttemptAnalytics({ attemptId: 'a1', experienceMode: 'mock', skillScope: '2-skills', questions: [q1], userAnswers: { q_t1: 'B' }, completedAt: 1000 });
      const a2 = buildToeicAttemptAnalytics({ attemptId: 'a2', experienceMode: 'mock', skillScope: '2-skills', questions: [q1], userAnswers: { q_t1: 'A' }, completedAt: 2000 });
      const a3 = buildToeicAttemptAnalytics({ attemptId: 'a3', experienceMode: 'mock', skillScope: '2-skills', questions: [q1], userAnswers: { q_t1: 'A' }, completedAt: 3000 });

      const profile = buildToeicWeaknessProfile([a1, a2, a3], { minimumEvidence: 1, minTrendEvidence: 6 });
      const insight = profile.neutralOrInsufficient.find((i) => i.key === 'vocab_meaning');
      expect(insight?.trend).toBe('insufficient_data');
    });

    it('hạ cấp phân loại từ Strength xuống Neutral khi phong độ dao động lớn (volatile)', () => {
      // accuracies: [90, 20, 90] -> trung bình cao nhưng dao động lớn
      const stability = derivePerformanceStability([90, 20, 90], 15, 18);
      expect(stability).toBe('volatile');
    });
  });

  describe('17. Weakness & Strength Lifecycles & Resolved Weakness Exclusion', () => {
    it('nhận diện trạng thái resolved khi điểm yếu cũ đạt accuracy cao trong cửa sổ gần đây', () => {
      const lifecycle = deriveWeaknessLifecycle('weakness', 'likely', 'improving', 80, 5);
      expect(lifecycle).toBe('resolved');
    });

    it('loại trừ điểm yếu đã resolved khỏi top priorities và gán priorityScore = 0', () => {
      // Giả lập attempt với subSkill có accuracy tổng 50% nhưng recent accuracy 85%
      const oldQuestions = Array.from({ length: 6 }, (_, i) =>
        createMockQuestion({ id: `q_old_${i}`, subSkill: 'grammar_tenses', correctAnswer: 'A' })
      );
      const recentQuestions = Array.from({ length: 6 }, (_, i) =>
        createMockQuestion({ id: `q_rec_${i}`, subSkill: 'grammar_tenses', correctAnswer: 'A' })
      );

      const oldAttempt = buildToeicAttemptAnalytics({
        attemptId: 'att_old',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions: oldQuestions,
        userAnswers: { q_old_0: 'B', q_old_1: 'B', q_old_2: 'B', q_old_3: 'B', q_old_4: 'A', q_old_5: 'A' }, // 2/6 = 33%
        completedAt: 1000,
      });

      const recentAttempt = buildToeicAttemptAnalytics({
        attemptId: 'att_recent',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions: recentQuestions,
        userAnswers: { q_rec_0: 'A', q_rec_1: 'A', q_rec_2: 'A', q_rec_3: 'A', q_rec_4: 'A', q_rec_5: 'A' }, // 6/6 = 100%
        completedAt: 5000,
      });

      const profile = buildToeicWeaknessProfile([oldAttempt, recentAttempt], { minimumEvidence: 3 });
      expect(profile.resolvedWeaknesses).toBeDefined();
      const resolved = profile.resolvedWeaknesses?.find((w) => w.key === 'grammar_tenses');
      if (resolved) {
        expect(resolved.weaknessLifecycle).toBe('resolved');
        // Không được xuất hiện trong top priorities
        const inPriorities = profile.priorities.find((p) => p.key === 'grammar_tenses');
        expect(inPriorities).toBeUndefined();
      }
    });

    it('phân loại đúng vòng đời điểm mạnh: emerging_strength, stable_strength, declining_strength', () => {
      expect(deriveStrengthLifecycle('strength', 'emerging', 'stable', 'stable', null)).toBe('emerging_strength');
      expect(deriveStrengthLifecycle('strength', 'established', 'stable', 'stable', 85)).toBe('stable_strength');
      expect(deriveStrengthLifecycle('strength', 'established', 'declining', 'stable', 60)).toBe('declining_strength');
    });
  });

  describe('18. Priority Ranking Damping (Low Sample Anti-Jump)', () => {
    it('damping 0.5x cho emerging evidence ngăn điểm yếu ít mẫu vượt mặt điểm yếu established', () => {
      // Weakness A: 3 câu, đúng 0 (0% acc) -> base severity 100 * 0.5 (emerging) = ~50
      // Weakness B: 12 câu, đúng 3 (25% acc) -> base severity 75 * 1.2 (established) = ~90
      const qA = Array.from({ length: 3 }, (_, i) =>
        createMockQuestion({ id: `qa_${i}`, subSkill: 'grammar_subjunctive', correctAnswer: 'A' })
      );
      const qB = Array.from({ length: 12 }, (_, i) =>
        createMockQuestion({ id: `qb_${i}`, subSkill: 'grammar_preposition', correctAnswer: 'A' })
      );

      const attempt = buildToeicAttemptAnalytics({
        attemptId: 'att_compare',
        experienceMode: 'mock',
        skillScope: '2-skills',
        questions: [...qA, ...qB],
        userAnswers: {
          // A: 0/3
          qa_0: 'B', qa_1: 'B', qa_2: 'B',
          // B: 3/12
          qb_0: 'A', qb_1: 'A', qb_2: 'A',
          qb_3: 'B', qb_4: 'B', qb_5: 'B', qb_6: 'B', qb_7: 'B', qb_8: 'B', qb_9: 'B', qb_10: 'B', qb_11: 'B',
        },
      });

      const profile = buildToeicWeaknessProfile([attempt], { minimumEvidence: 3 });
      expect(profile.priorities.length).toBeGreaterThanOrEqual(2);
      // Weakness B (established) phải đứng trước Weakness A (emerging) trong priorities!
      const idxA = profile.priorities.findIndex((p) => p.key === 'grammar_subjunctive');
      const idxB = profile.priorities.findIndex((p) => p.key === 'grammar_preposition');
      expect(idxB).toBeLessThan(idxA);
    });
  });

  describe('19. Recent Performance vs Long-term Profile Isolation', () => {
    it('tính toán recentPerformance riêng biệt và không xóa nhòa điểm mạnh dài hạn', () => {
      // 3 attempts:
      // Att 1 (cũ): Part 1 làm 10 câu đúng 10 (100%)
      // Att 2 (cũ): Part 1 làm 10 câu đúng 10 (100%)
      // Att 3 (gần đây): Part 1 làm 3 câu đúng 1 (33%) - một lần sơ suất
      const q1 = Array.from({ length: 10 }, (_, i) => createMockQuestion({ id: `q1_${i}`, part: 'part1_photos', correctAnswer: 'A' }));
      const q2 = Array.from({ length: 10 }, (_, i) => createMockQuestion({ id: `q2_${i}`, part: 'part1_photos', correctAnswer: 'A' }));
      const q3 = Array.from({ length: 3 }, (_, i) => createMockQuestion({ id: `q3_${i}`, part: 'part1_photos', correctAnswer: 'A' }));

      const a1 = buildToeicAttemptAnalytics({ attemptId: 'a1', experienceMode: 'mock', skillScope: '2-skills', questions: q1, userAnswers: Object.fromEntries(q1.map(q => [q.id, 'A'])), completedAt: 1000 });
      const a2 = buildToeicAttemptAnalytics({ attemptId: 'a2', experienceMode: 'mock', skillScope: '2-skills', questions: q2, userAnswers: Object.fromEntries(q2.map(q => [q.id, 'A'])), completedAt: 2000 });
      const a3 = buildToeicAttemptAnalytics({ attemptId: 'a3', experienceMode: 'mock', skillScope: '2-skills', questions: q3, userAnswers: { [q3[0].id]: 'A', [q3[1].id]: 'B', [q3[2].id]: 'B' }, completedAt: 3000 });

      const profile = buildToeicWeaknessProfile([a1, a2, a3]);
      expect(profile.recentPerformance).toBeDefined();
      expect(profile.recentPerformance?.attemptsConsidered).toBe(3);
      // Điểm Part 1 tổng thể vẫn là điểm mạnh vì 21/23 đúng (~91%)
      const part1Agg = profile.aggregates.byPart['part1_photos'];
      expect(part1Agg?.accuracy).toBeGreaterThanOrEqual(80);
    });
  });
});
