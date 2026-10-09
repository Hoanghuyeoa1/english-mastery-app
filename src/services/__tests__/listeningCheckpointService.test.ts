// src/services/__tests__/listeningCheckpointService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  gradeListeningCheckpointSection,
  submitListeningSection,
  isListeningAttemptSubmitted,
  getListeningAttemptResult,
  resetListeningAssessments,
  processListeningMistakes,
  ListeningAudioController,
} from '../listeningCheckpointService';
import type { ListeningLesson, ListeningQuestion } from '../../data/fourSkillsData';
import type { VocabWord } from '../../types';

describe('Listening Checkpoint Service (Phase 5)', () => {
  const mockLesson: ListeningLesson = {
    id: 'lesson_listening_test',
    title: 'Daily Routine Dialogue',
    category: 'Daily Life',
    level: 'A1',
    description: 'Test listening dialogue description',
    audioText: 'Hi Sarah, what do you usually do in the morning? Well, I get up early and have breakfast.',
    duration: '2:00',
    sentences: [],
    questions: [],
  };

  const mockQuestions: ListeningQuestion[] = [
    {
      id: 'q1',
      question: 'What does the word "morning" mean in this dialogue?',
      options: ['She sleeps late', 'She gets up early', 'She goes swimming', 'She studies'],
      correctIndex: 1,
      type: 'vocab_context',
      explanation: 'She says: Well, I get up early.',
    },
    {
      id: 'q2',
      question: 'Does she have breakfast?',
      options: ['No, she skips it', 'Yes, she has breakfast', 'Only on weekends', 'She did not say'],
      correctIndex: 1,
      type: 'vocab_context',
      explanation: 'She mentions having breakfast.',
    },
    {
      id: 'q3',
      question: 'Who is talking to Sarah?',
      options: ['Alex', 'David', 'Her teacher', 'A friend'],
      correctIndex: 0,
      explanation: 'Alex starts the dialogue.',
    },
    {
      id: 'q4',
      question: 'Where is this conversation taking place?',
      options: ['At work', 'At school', 'Not specified', 'At the gym'],
      correctIndex: 2,
      explanation: 'The context is not explicitly specified.',
    },
  ];

  const mockVocabList: VocabWord[] = [
    {
      id: 'v1',
      word: 'morning',
      meaning: 'buổi sáng',
      partOfSpeech: 'noun',
      ipa: '/ˈmɔːrnɪŋ/',
      example: 'Good morning!',
      tag: 'Daily',
      srsLevel: 0,
      nextReviewDate: '2026-01-01T00:00:00.000Z',
      interval: 1,
      easeFactor: 2.5,
    },
    {
      id: 'v2',
      word: 'breakfast',
      meaning: 'bữa sáng',
      partOfSpeech: 'noun',
      ipa: '/ˈbrekfəst/',
      example: 'I eat breakfast at 7 AM.',
      tag: 'Daily',
      srsLevel: 0,
      nextReviewDate: '2026-01-01T00:00:00.000Z',
      interval: 1,
      easeFactor: 2.5,
    },
  ];

  beforeEach(() => {
    resetListeningAssessments();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. DETERMINISTIC GRADING ENGINE
  // =========================================================================
  describe('Deterministic Grading Engine', () => {
    it('calculates 100% score accurately when all questions are correct', () => {
      const result = gradeListeningCheckpointSection({
        attemptId: 'cefr:A1:att-1',
        level: 'A1',
        lesson: mockLesson,
        questions: mockQuestions,
        userAnswers: {
          q1: 1,
          q2: 1,
          q3: 0,
          q4: 2,
        },
      });

      expect(result.status).toBe('evaluated');
      expect(result.hasSufficientEvidence).toBe(true);
      expect(result.score).toBe(100);
      expect(result.correctCount).toBe(4);
      expect(result.totalQuestions).toBe(4);
      expect(result.answeredCount).toBe(4);
      expect(result.passedFloor).toBe(true);
      expect(result.questionEvaluations).toHaveLength(4);
      expect(result.questionEvaluations.every((qe) => qe.isCorrect)).toBe(true);
    });

    it('calculates partial score deterministically (3/4 = 75% passes A1 floor 55)', () => {
      const result = gradeListeningCheckpointSection({
        attemptId: 'cefr:A1:att-2',
        level: 'A1',
        lesson: mockLesson,
        questions: mockQuestions,
        userAnswers: {
          q1: 1, // correct
          q2: 1, // correct
          q3: 0, // correct
          q4: 1, // incorrect (correct is 2)
        },
      });

      expect(result.status).toBe('evaluated');
      expect(result.score).toBe(75);
      expect(result.correctCount).toBe(3);
      expect(result.totalQuestions).toBe(4);
      expect(result.answeredCount).toBe(4);
      expect(result.passedFloor).toBe(true); // A1 floor is 55, 75 >= 55
    });

    it('marks passedFloor as false when score is below required floor threshold', () => {
      const result = gradeListeningCheckpointSection({
        attemptId: 'cefr:A1:att-3',
        level: 'A1',
        lesson: mockLesson,
        questions: mockQuestions,
        userAnswers: {
          q1: 0, // incorrect
          q2: 0, // incorrect
          q3: 0, // correct
          q4: 0, // incorrect
        },
      });

      expect(result.status).toBe('evaluated');
      expect(result.score).toBe(25);
      expect(result.correctCount).toBe(1);
      expect(result.passedFloor).toBe(false);
      expect(result.requiredFloor).toBe(55);
    });
  });

  // =========================================================================
  // 2. EVIDENCE INTEGRITY & FAILURE HANDLING
  // =========================================================================
  describe('Evidence Integrity & Insufficient Evidence Handling', () => {
    it('returns insufficient_evidence if audioText is missing or empty', () => {
      const result = gradeListeningCheckpointSection({
        attemptId: 'cefr:A1:att-err-1',
        level: 'A1',
        lesson: { ...mockLesson, audioText: '' },
        questions: mockQuestions,
        userAnswers: { q1: 1 },
      });

      expect(result.status).toBe('insufficient_evidence');
      expect(result.score).toBeNull();
      expect(result.hasSufficientEvidence).toBe(false);
      expect(result.reason).toBe('missing_audio');
      expect(result.passedFloor).toBe(false);
    });

    it('returns insufficient_evidence if lesson is completely undefined', () => {
      const result = gradeListeningCheckpointSection({
        attemptId: 'cefr:A1:att-err-2',
        level: 'A1',
        lesson: null,
        questions: mockQuestions,
        userAnswers: { q1: 1 },
      });

      expect(result.status).toBe('insufficient_evidence');
      expect(result.score).toBeNull();
      expect(result.reason).toBe('missing_audio');
    });

    it('returns insufficient_evidence if questions list is empty', () => {
      const result = gradeListeningCheckpointSection({
        attemptId: 'cefr:A1:att-err-3',
        level: 'A1',
        lesson: mockLesson,
        questions: [],
        userAnswers: { q1: 1 },
      });

      expect(result.status).toBe('insufficient_evidence');
      expect(result.score).toBeNull();
      expect(result.reason).toBe('empty_questions');
    });

    it('returns insufficient_evidence if questions contain only malformed items', () => {
      const malformedQuestions = [
        { id: '', question: 'Broken', options: [], correctIndex: 0 } as any,
        { id: 'q2', question: 'Broken options', options: ['only one option'], correctIndex: 0 } as any,
        { id: 'q3', question: 'Invalid correct index', options: ['A', 'B'], correctIndex: 5 } as any,
      ];

      const result = gradeListeningCheckpointSection({
        attemptId: 'cefr:A1:att-err-4',
        level: 'A1',
        lesson: mockLesson,
        questions: malformedQuestions,
        userAnswers: { q1: 0 },
      });

      expect(result.status).toBe('insufficient_evidence');
      expect(result.score).toBeNull();
      expect(result.reason).toBe('invalid_questions');
    });

    it('returns insufficient_evidence if user submitted 0 answers', () => {
      const result = gradeListeningCheckpointSection({
        attemptId: 'cefr:A1:att-err-5',
        level: 'A1',
        lesson: mockLesson,
        questions: mockQuestions,
        userAnswers: {},
      });

      expect(result.status).toBe('insufficient_evidence');
      expect(result.score).toBeNull();
      expect(result.reason).toBe('no_answers_submitted');
      expect(result.answeredCount).toBe(0);
    });
  });

  // =========================================================================
  // 3. IDEMPOTENT SUBMISSION REGISTRY (FIRST SUBMISSION WINS)
  // =========================================================================
  describe('First Submission Wins Idempotence', () => {
    it('caches the first submission and ignores subsequent submissions with different answers', () => {
      const attemptId = 'cefr:B1:idempotent-test';

      expect(isListeningAttemptSubmitted(attemptId)).toBe(false);

      // First submission: 100% correct
      const firstResult = submitListeningSection({
        attemptId,
        level: 'B1',
        lesson: mockLesson,
        questions: mockQuestions,
        userAnswers: {
          q1: 1,
          q2: 1,
          q3: 0,
          q4: 2,
        },
      });

      expect(firstResult.status).toBe('evaluated');
      expect(firstResult.score).toBe(100);
      expect(isListeningAttemptSubmitted(attemptId)).toBe(true);

      // Second submission: attempts to change answers to wrong ones (0% correct)
      const secondResult = submitListeningSection({
        attemptId,
        level: 'B1',
        lesson: mockLesson,
        questions: mockQuestions,
        userAnswers: {
          q1: 0,
          q2: 0,
          q3: 1,
          q4: 0,
        },
      });

      // INVARIANT: First submission must prevail!
      expect(secondResult.score).toBe(100);
      expect(secondResult.evaluatedAt).toBe(firstResult.evaluatedAt);

      // Retrieval helper returns the same cached result
      const retrieved = getListeningAttemptResult(attemptId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.score).toBe(100);
    });

    it('does not cache insufficient_evidence attempts so learner can resubmit valid answers', () => {
      const attemptId = 'cefr:A2:fixable-attempt';

      // 1. Initial attempt with 0 answers -> insufficient evidence
      const initial = submitListeningSection({
        attemptId,
        level: 'A2',
        lesson: mockLesson,
        questions: mockQuestions,
        userAnswers: {},
      });

      expect(initial.status).toBe('insufficient_evidence');
      expect(isListeningAttemptSubmitted(attemptId)).toBe(false);

      // 2. Subsequent submission with valid answers -> successfully evaluated and cached
      const validSubmission = submitListeningSection({
        attemptId,
        level: 'A2',
        lesson: mockLesson,
        questions: mockQuestions,
        userAnswers: {
          q1: 1,
          q2: 1,
          q3: 0,
          q4: 2,
        },
      });

      expect(validSubmission.status).toBe('evaluated');
      expect(validSubmission.score).toBe(100);
      expect(isListeningAttemptSubmitted(attemptId)).toBe(true);
    });
  });

  // =========================================================================
  // 4. MISTAKE BANK DEDUPLICATION PIPELINE
  // =========================================================================
  describe('Mistake Bank Pipeline & Deduplication', () => {
    it('captures vocabulary mistake only for wrong answers and deduplicates on replay', () => {
      const mockRecordMistake = vi.fn();
      const attemptId = 'cefr:A2:mistake-dedupe-test';

      const evalResult = gradeListeningCheckpointSection({
        attemptId,
        level: 'A2',
        lesson: mockLesson,
        questions: mockQuestions,
        userAnswers: {
          q1: 0, // WRONG (targetVocab: 'morning')
          q2: 1, // CORRECT (targetVocab: 'breakfast' - should NOT be recorded)
          q3: 1, // WRONG (no targetVocab)
          q4: 2, // CORRECT
        },
      });

      expect(evalResult.status).toBe('evaluated');

      // 1. First mistake recording call
      const recordedCount1 = processListeningMistakes({
        attemptId,
        lessonTitle: mockLesson.title,
        evaluation: evalResult,
        questions: mockQuestions,
        vocabularyList: mockVocabList,
        recordMistake: mockRecordMistake,
      });

      expect(recordedCount1).toBe(1);
      expect(mockRecordMistake).toHaveBeenCalledTimes(1);
      expect(mockRecordMistake).toHaveBeenCalledWith(
        expect.objectContaining({ word: expect.stringMatching(/morning/i) }),
        'listening',
        expect.objectContaining({
          type: 'listening',
          expectedAnswer: 'She gets up early',
          userAnswer: 'She sleeps late',
        })
      );

      // 2. Second mistake recording call (simulating replay / remount)
      const recordedCount2 = processListeningMistakes({
        attemptId,
        lessonTitle: mockLesson.title,
        evaluation: evalResult,
        questions: mockQuestions,
        vocabularyList: mockVocabList,
        recordMistake: mockRecordMistake,
      });

      // Invariant: Deduplicated! Should NOT record again
      expect(recordedCount2).toBe(0);
      expect(mockRecordMistake).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 5. CLIENT-SIDE AUDIO CONTROLLER (ASSESSMENT PLAY LIMIT & LIFECYCLE)
  // =========================================================================
  describe('ListeningAudioController Lifecycle & Constraints', () => {
    it('enforces maximum audio play limit constraint', () => {
      const onPlayCountChange = vi.fn();
      const onStatusChange = vi.fn();

      // Mock window.speechSynthesis
      const speakMock = vi.fn();
      const cancelMock = vi.fn();

      const originalWindow = (globalThis as any).window;
      (globalThis as any).window = {
        speechSynthesis: {
          speak: speakMock,
          cancel: cancelMock,
        },
      };

      // Mock SpeechSynthesisUtterance constructor
      class MockSpeechSynthesisUtterance {
        text: string;
        lang = '';
        rate = 1;
        onend?: () => void;
        onerror?: () => void;
        constructor(text: string) {
          this.text = text;
        }
      }
      (globalThis as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

      const controller = new ListeningAudioController({
        text: 'Hello test speech',
        maxPlays: 2,
        initialPlayCount: 0,
        onPlayCountChange,
        onStatusChange,
      });

      expect(controller.getRemainingPlays()).toBe(2);
      expect(controller.canPlay()).toBe(true);

      // 1. Play first time
      const played1 = controller.play();
      expect(played1).toBe(true);
      expect(controller.getState().playCount).toBe(1);
      expect(controller.getRemainingPlays()).toBe(1);
      expect(onPlayCountChange).toHaveBeenCalledWith(1);

      // Simulate audio end
      controller.stop();

      // 2. Play second time
      const played2 = controller.play();
      expect(played2).toBe(true);
      expect(controller.getState().playCount).toBe(2);
      expect(controller.getRemainingPlays()).toBe(0);

      // Simulate audio end
      controller.stop();

      // 3. Play third time -> Exceeds maxPlays!
      expect(controller.canPlay()).toBe(false);
      const played3 = controller.play();
      expect(played3).toBe(false);
      expect(controller.getState().playCount).toBe(2); // Unchanged

      // Cleanup global mocks
      (globalThis as any).window = originalWindow;
    });

    it('returns error when SpeechSynthesis is not supported in window', () => {
      const originalWindow = (globalThis as any).window;
      (globalThis as any).window = {};

      const controller = new ListeningAudioController({
        text: 'Speech synthesis test',
        maxPlays: 2,
      });

      const played = controller.play();
      expect(played).toBe(false);
      expect(controller.getState().status).toBe('error');
      expect(controller.getState().errorMessage).toContain('Web Speech');

      (globalThis as any).window = originalWindow;
    });
  });
});
