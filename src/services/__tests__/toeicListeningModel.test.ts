// src/services/__tests__/toeicListeningModel.test.ts
import { describe, it, expect } from 'vitest';
import {
  normalizeToeicListeningDataset,
  getNormalizedListeningDataset,
  parseTranscriptSegments,
  resolveAudioSourceContract,
} from '../toeicListeningNormalizer';
import { validateToeicListeningDataset } from '../toeicListeningValidator';
import {
  extractListeningFromSnapshot,
  getAudioIdentityForQuestion,
} from '../toeicListeningSnapshotAdapter';
import { TOEIC_QUESTION_BANK, TOEIC_QUESTION_GROUPS } from '../../data/toeicQuestionsData';
import { ToeicQuestion, ToeicQuestionGroup, ToeicExamSnapshot } from '../../types/toeic';
import {
  NormalizedListeningDataset,
  ToeicListeningQuestion,
} from '../../types/toeicListening';

describe('PHASE 2: TOEIC Listening Data Model, Grouping & Validation Suite', () => {
  // ===========================================================================
  // 1. UNIT TESTS: TRANSCRIPT & AUDIO CONTRACT
  // ===========================================================================
  describe('1. Transcript & Audio Source Contracts', () => {
    it('Phân tích đối thoại có nhãn người nói (Man/Woman) thành các speaker segments', () => {
      const dialogue = 'Man: Hello Sarah, are you ready? Woman: Almost Mark, I need five more minutes.';
      const result = parseTranscriptSegments(dialogue);

      expect(result.fullText).toBe(dialogue);
      expect(result.segments.length).toBe(2);
      expect(result.segments[0].speaker).toBe('Man');
      expect(result.segments[0].text).toBe('Hello Sarah, are you ready?');
      expect(result.segments[1].speaker).toBe('Woman');
      expect(result.segments[1].text).toBe('Almost Mark, I need five more minutes.');
    });

    it('Phân tách độc thoại Part 4 không có speaker thành các sentence segments', () => {
      const talk = 'Good afternoon passengers. Flight 204 to Tokyo is now delayed by one hour. Please proceed to Gate 12.';
      const result = parseTranscriptSegments(talk);

      expect(result.segments.length).toBe(3);
      expect(result.segments[0].speaker).toBeUndefined();
      expect(result.segments[0].text).toBe('Good afternoon passengers.');
      expect(result.segments[1].text).toBe('Flight 204 to Tokyo is now delayed by one hour.');
      expect(result.segments[2].text).toBe('Please proceed to Gate 12.');
    });

    it('Phân định chính xác Recorded Audio vs TTS Fallback không giả mạo', () => {
      // Case 1: Có URL MP3 hợp lệ -> Recorded
      const recorded = resolveAudioSourceContract(
        { url: 'https://cdn.example.com/audio/p1_01.mp3', format: 'mp3', accent: 'en-US' },
        'Script text'
      );
      expect(recorded.sourceType).toBe('recorded');
      expect(recorded.audioUrl).toBe('https://cdn.example.com/audio/p1_01.mp3');
      expect(recorded.isFallback).toBe(false);

      // Case 2: Chỉ có audioScript, không có URL -> TTS Fallback
      const tts = resolveAudioSourceContract(undefined, 'Fallback text script');
      expect(tts.sourceType).toBe('tts');
      expect(tts.audioScript).toBe('Fallback text script');
      expect(tts.isFallback).toBe(true);
      expect(tts.fallbackReason).toContain('FALLBACK_TTS');

      // Case 3: Rỗng cả hai -> None
      const none = resolveAudioSourceContract(undefined, '');
      expect(none.sourceType).toBe('none');
      expect(none.isFallback).toBe(false);
    });
  });

  // ===========================================================================
  // 2. NORMALIZATION & INTEGRATION VỚI DATASET THỰC TẾ
  // ===========================================================================
  describe('2. Legacy Normalization on Actual Dataset', () => {
    it('Chuẩn hóa toàn bộ dataset thực tế mà không làm mất question IDs và options', () => {
      const dataset = getNormalizedListeningDataset();

      expect(dataset.groups.length).toBeGreaterThan(0);
      expect(dataset.questions.length).toBeGreaterThan(0);

      // Xác nhận các Part có mặt
      expect(dataset.stats.byPart.part1_photos.questionCount).toBeGreaterThan(0);
      expect(dataset.stats.byPart.part2_qna.questionCount).toBeGreaterThan(0);
      expect(dataset.stats.byPart.part3_conv.questionCount).toBeGreaterThan(0);

      // Mọi câu hỏi phải giữ nguyên ID từ ngân hàng đề ban đầu
      const originalListeningIds = TOEIC_QUESTION_BANK.filter(
        (q) =>
          q.part === 'part1_photos' ||
          q.part === 'part2_qna' ||
          q.part === 'part3_conv' ||
          q.part === 'part4_talks'
      ).map((q) => q.id);

      expect(dataset.questions.length).toBe(originalListeningIds.length);
      originalListeningIds.forEach((id) => {
        expect(dataset.questionById.has(id)).toBe(true);
        const q = dataset.questionById.get(id)!;
        expect(q.correctAnswer).toBeTruthy();
        expect(q.explanation).toBeTruthy();
        expect(q.vietnameseTranslation).toBeTruthy();
      });
    });

    it('Câu hỏi con sau khi normalize không còn chứa audio payload duplicate', () => {
      const dataset = getNormalizedListeningDataset();

      dataset.questions.forEach((q) => {
        // Thuộc tính audioScript không được nằm trực tiếp trên ToeicListeningQuestion
        expect((q as any).audioMetadata).toBeUndefined();
        // Nhóm cha mới là nơi lưu trữ audio payload
        expect(q.groupId).toBeTruthy();
        expect(q.audioGroupId).toBeTruthy();
        const parentGroup = dataset.groupById.get(q.groupId);
        expect(parentGroup).toBeDefined();
        expect(parentGroup!.audioSource).toBeDefined();
      });
    });
  });

  // ===========================================================================
  // 3. ANTI-DUPLICATE & GROUP INVARIANT ENFORCEMENT
  // ===========================================================================
  describe('3. Anti-duplicate & Group Invariant Rules', () => {
    it('Part 3 & Part 4: Tất cả câu hỏi trong cùng một nhóm phải chia sẻ DUY NHẤT một audio identity', () => {
      const dataset = getNormalizedListeningDataset();

      const p3Groups = dataset.groups.filter((g) => g.part === 'part3_conv');
      expect(p3Groups.length).toBeGreaterThan(0);

      p3Groups.forEach((group) => {
        const childQuestions = group.questionIds.map((id) => dataset.questionById.get(id)!);
        expect(childQuestions.length).toBe(3); // Chuẩn ETS

        // Invariant: Q1.groupId === Q2.groupId === Q3.groupId
        expect(childQuestions[0].groupId).toBe(group.id);
        expect(childQuestions[1].groupId).toBe(group.id);
        expect(childQuestions[2].groupId).toBe(group.id);

        // Invariant: Q1.audioGroupId === Q2.audioGroupId === Q3.audioGroupId === group.audioGroupId
        expect(childQuestions[0].audioGroupId).toBe(group.audioGroupId);
        expect(childQuestions[1].audioGroupId).toBe(group.audioGroupId);
        expect(childQuestions[2].audioGroupId).toBe(group.audioGroupId);

        // Không chấp nhận định danh dạng audio_q1, audio_q2 riêng lẻ
        expect(childQuestions[0].audioGroupId).not.toBe(`audio_${childQuestions[0].id}`);
      });
    });

    it('Một audio identity thuộc về DUY NHẤT một nhóm (One-to-One mapping)', () => {
      const dataset = getNormalizedListeningDataset();

      const audioIdsSeen = new Set<string>();
      dataset.groups.forEach((group) => {
        expect(audioIdsSeen.has(group.audioGroupId)).toBe(false);
        audioIdsSeen.add(group.audioGroupId);
      });
    });
  });

  // ===========================================================================
  // 4. DATASET VALIDATOR SUITE
  // ===========================================================================
  describe('4. TOEIC Listening Dataset Validation', () => {
    it('Dataset thực tế của ứng dụng vượt qua bài kiểm tra toàn vẹn hợp lệ', () => {
      const dataset = getNormalizedListeningDataset();
      const report = validateToeicListeningDataset(dataset);

      if (!report.isValid) {
        console.error('Validation errors found:', report.errors);
      }

      expect(report.isValid).toBe(true);
      expect(report.errors).toHaveLength(0);
      expect(report.stats.orphanedQuestions).toBe(0);
      expect(report.stats.totalGroups).toBeGreaterThan(0);
    });

    it('Validator từ chối Part 1 nếu thiếu ảnh imageUrl', () => {
      const mockQuestions: ToeicQuestion[] = [
        {
          id: 'mock_p1_no_img',
          part: 'part1_photos',
          skill: 'listening',
          questionText: 'Part 1: Listen and choose.',
          audioScript: 'Look at picture 1. (A) He is walking. (B) ... (C) ... (D) ...',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A',
          explanation: 'Exp',
          vietnameseTranslation: 'Trans',
          imageUrl: '', // Rỗng
        },
      ];

      const dataset = normalizeToeicListeningDataset(mockQuestions, []);
      const report = validateToeicListeningDataset(dataset);

      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.includes('imageUrl'))).toBe(true);
    });

    it('Validator từ chối Part 2 nếu có số phương án khác 3 hoặc đáp án ngoài A-C', () => {
      const mockQuestions: ToeicQuestion[] = [
        {
          id: 'mock_p2_invalid_choices',
          part: 'part2_qna',
          skill: 'listening',
          questionText: 'Part 2: Listen.',
          audioScript: 'Where is the meeting? (A) At 9. (B) Yes. (C) Room 1. (D) None.',
          options: ['A', 'B', 'C', 'D'], // 4 choices thay vì 3
          correctAnswer: 'D', // Không hợp lệ cho Part 2
          explanation: 'Exp',
          vietnameseTranslation: 'Trans',
        },
      ];

      const dataset = normalizeToeicListeningDataset(mockQuestions, []);
      const report = validateToeicListeningDataset(dataset);

      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.includes('Part 2') && e.includes('3 phương án'))).toBe(true);
      expect(report.errors.some((e) => e.includes('Part 2') && e.includes('đáp án'))).toBe(true);
    });

    it('Validator phát hiện và từ chối câu hỏi mồ côi (Orphan Questions)', () => {
      const invalidDataset: NormalizedListeningDataset = {
        groups: [],
        questions: [
          {
            id: 'orphan_q1',
            part: 'part3_conv',
            groupId: 'non_existent_group',
            audioGroupId: 'non_existent_audio',
            orderIndex: 0,
            questionText: 'Orphan question?',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A',
            explanation: '',
            vietnameseTranslation: '',
          },
        ],
        groupById: new Map(),
        questionById: new Map(),
        questionsByGroupId: new Map(),
        groupByAudioId: new Map(),
        stats: {
          totalGroups: 0,
          totalQuestions: 1,
          byPart: {
            part1_photos: { groupCount: 0, questionCount: 0 },
            part2_qna: { groupCount: 0, questionCount: 0 },
            part3_conv: { groupCount: 0, questionCount: 1 },
            part4_talks: { groupCount: 0, questionCount: 0 },
          },
        },
      };

      const report = validateToeicListeningDataset(invalidDataset);
      expect(report.isValid).toBe(false);
      expect(report.stats.orphanedQuestions).toBe(1);
      expect(report.errors.some((e) => e.includes('mồ côi'))).toBe(true);
    });

    it('Validator phát hiện và từ chối vi phạm một câu hỏi thuộc nhiều group (Duplicate Membership)', () => {
      const mockQuestions: ToeicQuestion[] = [
        {
          id: 'shared_q1',
          part: 'part3_conv',
          skill: 'listening',
          questionText: 'Shared Q',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A',
          explanation: '',
          vietnameseTranslation: '',
        },
        {
          id: 'q2',
          part: 'part3_conv',
          skill: 'listening',
          questionText: 'Q2',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'B',
          explanation: '',
          vietnameseTranslation: '',
        },
        {
          id: 'q3',
          part: 'part3_conv',
          skill: 'listening',
          questionText: 'Q3',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'C',
          explanation: '',
          vietnameseTranslation: '',
        },
        {
          id: 'q4',
          part: 'part3_conv',
          skill: 'listening',
          questionText: 'Q4',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'D',
          explanation: '',
          vietnameseTranslation: '',
        },
        {
          id: 'q5',
          part: 'part3_conv',
          skill: 'listening',
          questionText: 'Q5',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A',
          explanation: '',
          vietnameseTranslation: '',
        },
      ];

      const mockGroups: ToeicQuestionGroup[] = [
        {
          id: 'grp_A',
          part: 'part3_conv',
          skill: 'listening',
          type: 'audio_conversation',
          audioScript: 'Script A',
          questionIds: ['shared_q1', 'q2', 'q3'],
        },
        {
          id: 'grp_B',
          part: 'part3_conv',
          skill: 'listening',
          type: 'audio_conversation',
          audioScript: 'Script B',
          questionIds: ['shared_q1', 'q4', 'q5'], // shared_q1 xuất hiện ở cả 2 groups!
        },
      ];

      const dataset = normalizeToeicListeningDataset(mockQuestions, mockGroups);
      const report = validateToeicListeningDataset(dataset);

      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.includes('thuộc về nhiều hơn một nhóm'))).toBe(true);
    });
  });

  // ===========================================================================
  // 5. SNAPSHOT COMPATIBILITY & DETERMINISTIC IDENTITY
  // ===========================================================================
  describe('5. Snapshot Compatibility Foundation', () => {
    it('Trích xuất thành phần Listening từ Snapshot có tính tất định (Same attempt -> Same composition)', () => {
      const mockSnapshot: ToeicExamSnapshot = {
        id: 'attempt_mock_123',
        mode: '2skills_mini',
        title: 'Mini Test',
        seed: 42,
        totalQuestions: 5,
        durationMinutes: 15,
        questions: TOEIC_QUESTION_BANK.slice(0, 5),
        groups: TOEIC_QUESTION_GROUPS.slice(0, 1),
        partCounts: {
          part1_photos: 1,
          part2_qna: 1,
          part3_conv: 3,
          part4_talks: 0,
          part5_grammar: 0,
          part6_text: 0,
          part7_reading: 0,
          speaking_read: 0,
          writing_email: 0,
        },
        difficultyBreakdown: { easy: 3, medium: 2, hard: 0 },
        skillBreakdown: { listening: 5, reading: 0, speaking: 0, writing: 0 },
        diagnostics: {
          relaxedHistory: false,
          relaxedDifficulty: false,
          warnings: [],
          selectedGroupIds: [],
          selectedQuestionIds: [],
        },
        createdAt: '2026-10-07T00:00:00Z',
      };

      const comp1 = extractListeningFromSnapshot(mockSnapshot);
      const comp2 = extractListeningFromSnapshot(mockSnapshot);

      // Tính tất định: Số nhóm và ID âm thanh phải hoàn toàn giống nhau
      expect(comp1.attemptId).toBe(comp2.attemptId);
      expect(comp1.seed).toBe(comp2.seed);
      expect(comp1.listeningGroups.map((g) => g.id)).toEqual(comp2.listeningGroups.map((g) => g.id));
      expect(comp1.audioIdentities).toEqual(comp2.audioIdentities);

      // Tra cứu audio identity từ questionId
      const testQId = comp1.listeningQuestions[0].id;
      const audioId = getAudioIdentityForQuestion(testQId, comp1);
      expect(audioId).toBeTruthy();
      expect(getAudioIdentityForQuestion(testQId, comp2)).toBe(audioId);
    });
  });
});
