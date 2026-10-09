// src/services/__tests__/readingCheckpointService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  gradeReadingCheckpointSection,
  submitReadingSection,
  isReadingAttemptSubmitted,
  getReadingAttemptResult,
  resetReadingAssessments,
  processReadingMistakes,
  type ReadingQuestion,
} from '../readingCheckpointService';
import type { ReadingLesson } from '../../data/fourSkillsData';
import type { VocabWord } from '../../types';
import {
  createInitialCheckpointState,
  startCheckpointSession,
  saveSectionDraft,
  advanceToNextSection,
  checkpointStateToResumableActivity,
  restoreCheckpointStateFromActivity,
  resetFinalizedAttempts,
} from '../checkpointSessionLifecycle';
import { DEFAULT_ASSESSMENT_POLICY } from '../../types/checkpointAssessment';

describe('Reading Checkpoint Service (Phase 6)', () => {
  const mockLesson: ReadingLesson = {
    id: 'lesson_reading_test',
    title: 'Modern Remote Work Culture',
    category: 'Workplace Culture',
    level: 'A1',
    readTime: '3 min',
    wordCount: 150,
    summary: 'A short passage about remote working habits.',
    content: [
      'Many companies now embrace remote work for flexibility and productivity.',
      'Employees can arrange their schedules and spend more time with family.',
    ],
    keyVocab: [
      { word: 'flexibility', ipa: '/ˌfleksəˈbɪləti/', meaning: 'sự linh hoạt' },
      { word: 'productivity', ipa: '/ˌprɒdʌkˈtɪvəti/', meaning: 'năng suất' },
    ],
    questions: [],
  };

  const mockQuestions: ReadingQuestion[] = [
    {
      id: 'rq1',
      question: 'What does the word "flexibility" refer to in the text?',
      options: ['Strict schedules', 'Freedom in planning work', 'Low salary', 'Commuting to office'],
      correctIndex: 1,
      type: 'vocab_context',
      explanation: 'Flexibility means freedom to arrange schedules.',
    },
    {
      id: 'rq2',
      question: 'Why do companies embrace remote work?',
      options: ['To cut all staff', 'For flexibility and productivity', 'To increase office rent', 'To avoid meetings'],
      correctIndex: 1,
      type: 'detail',
      explanation: 'The passage mentions flexibility and productivity.',
    },
    {
      id: 'rq3',
      question: 'What is the main topic of the passage?',
      options: ['Remote work culture', 'Cooking at home', 'Public transport', 'Sports habits'],
      correctIndex: 0,
      type: 'main_idea',
      explanation: 'The text discusses remote work culture.',
    },
    {
      id: 'rq4',
      question: 'Who can employees spend more time with?',
      options: ['Strangers', 'Clients only', 'Family', 'Competitors'],
      correctIndex: 2,
      type: 'detail',
      explanation: 'The text states employees spend more time with family.',
    },
  ];

  const mockVocabList: VocabWord[] = [
    {
      id: 'v_flexibility',
      word: 'flexibility',
      meaning: 'sự linh hoạt',
      partOfSpeech: 'noun',
      ipa: '/ˌfleksəˈbɪləti/',
      example: 'Work flexibility is important.',
      tag: 'Daily',
      srsLevel: 0,
      nextReviewDate: '2026-01-01T00:00:00.000Z',
      interval: 1,
      easeFactor: 2.5,
    },
    {
      id: 'v_productivity',
      word: 'productivity',
      meaning: 'năng suất',
      partOfSpeech: 'noun',
      ipa: '/ˌprɒdʌkˈtɪvəti/',
      example: 'Boost your productivity.',
      tag: 'Daily',
      srsLevel: 0,
      nextReviewDate: '2026-01-01T00:00:00.000Z',
      interval: 1,
      easeFactor: 2.5,
    },
  ];

  beforeEach(() => {
    resetReadingAssessments();
    resetFinalizedAttempts();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. DETERMINISTIC COMPREHENSION SCORING (SCORE ĐÚNG)
  // =========================================================================
  describe('Deterministic Comprehension Scoring (score đúng)', () => {
    it('calculates 100% score accurately when all questions are correct', () => {
      const result = gradeReadingCheckpointSection({
        attemptId: 'cefr:A1:att-read-1',
        level: 'A1',
        lesson: mockLesson,
        questions: mockQuestions,
        userAnswers: {
          rq1: 1,
          rq2: 1,
          rq3: 0,
          rq4: 2,
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

    it('calculates partial score deterministically (3/4 = 75% passes A1 floor 55%)', () => {
      const result = gradeReadingCheckpointSection({
        attemptId: 'cefr:A1:att-read-2',
        level: 'A1',
        lesson: mockLesson,
        questions: mockQuestions,
        userAnswers: {
          rq1: 1, // correct
          rq2: 1, // correct
          rq3: 0, // correct
          rq4: 0, // incorrect (correct is 2)
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
      const result = gradeReadingCheckpointSection({
        attemptId: 'cefr:A1:att-read-3',
        level: 'A1',
        lesson: mockLesson,
        questions: mockQuestions,
        userAnswers: {
          rq1: 0, // incorrect
          rq2: 0, // incorrect
          rq3: 0, // correct
          rq4: 0, // incorrect
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
  // 2. MALFORMED QUESTION & PASSAGE INTEGRITY (MALFORMED QUESTION)
  // =========================================================================
  describe('Malformed Question & Data Integrity', () => {
    it('returns insufficient_evidence if passage is missing or empty', () => {
      const result = gradeReadingCheckpointSection({
        attemptId: 'cefr:A1:att-err-1',
        level: 'A1',
        lesson: { ...mockLesson, content: [] },
        questions: mockQuestions,
        userAnswers: { rq1: 1 },
      });

      expect(result.status).toBe('insufficient_evidence');
      expect(result.score).toBeNull();
      expect(result.hasSufficientEvidence).toBe(false);
      expect(result.reason).toBe('missing_passage');
      expect(result.passedFloor).toBe(false);
    });

    it('returns insufficient_evidence if lesson is null or undefined', () => {
      const result = gradeReadingCheckpointSection({
        attemptId: 'cefr:A1:att-err-2',
        level: 'A1',
        lesson: null,
        questions: mockQuestions,
        userAnswers: { rq1: 1 },
      });

      expect(result.status).toBe('insufficient_evidence');
      expect(result.score).toBeNull();
      expect(result.reason).toBe('missing_passage');
    });

    it('returns insufficient_evidence if questions list is empty', () => {
      const result = gradeReadingCheckpointSection({
        attemptId: 'cefr:A1:att-err-3',
        level: 'A1',
        lesson: mockLesson,
        questions: [],
        userAnswers: { rq1: 1 },
      });

      expect(result.status).toBe('insufficient_evidence');
      expect(result.score).toBeNull();
      expect(result.reason).toBe('empty_questions');
    });

    it('filters out malformed questions and evaluates remaining valid questions', () => {
      const mixedQuestions = [
        { id: '', question: 'Broken missing ID', options: ['A', 'B'], correctIndex: 0 },
        { id: 'rq_broken_opts', question: 'Broken options', options: ['only one option'], correctIndex: 0 },
        { id: 'rq_broken_idx', question: 'Broken index', options: ['A', 'B'], correctIndex: 99 },
        mockQuestions[0], // Valid question
        mockQuestions[1], // Valid question
      ] as any;

      const result = gradeReadingCheckpointSection({
        attemptId: 'cefr:A1:att-mixed-1',
        level: 'A1',
        lesson: mockLesson,
        questions: mixedQuestions,
        userAnswers: {
          rq1: 1, // correct
          rq2: 1, // correct
        },
      });

      expect(result.status).toBe('evaluated');
      expect(result.totalQuestions).toBe(2); // Only 2 valid questions
      expect(result.correctCount).toBe(2);
      expect(result.score).toBe(100);
      expect(result.passedFloor).toBe(true);
    });

    it('returns insufficient_evidence if all questions are malformed', () => {
      const malformedQuestions = [
        { id: '', question: 'Broken', options: [], correctIndex: 0 } as any,
        { id: 'rq2', question: 'Broken options', options: ['only one'], correctIndex: 0 } as any,
        { id: 'rq3', question: 'Negative index', options: ['A', 'B'], correctIndex: -1 } as any,
      ];

      const result = gradeReadingCheckpointSection({
        attemptId: 'cefr:A1:att-err-4',
        level: 'A1',
        lesson: mockLesson,
        questions: malformedQuestions,
        userAnswers: { rq2: 0 },
      });

      expect(result.status).toBe('insufficient_evidence');
      expect(result.score).toBeNull();
      expect(result.reason).toBe('invalid_questions');
    });

    it('returns insufficient_evidence if user submitted 0 answers', () => {
      const result = gradeReadingCheckpointSection({
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
  // 3. IDEMPOTENT SUBMISSION (DUPLICATE SUBMIT SAFE)
  // =========================================================================
  describe('Duplicate Submit Protection (first valid submission wins)', () => {
    it('caches first submission and returns cached result on duplicate submission attempts', () => {
      const attemptId = 'cefr:B1:reading-idempotent';

      expect(isReadingAttemptSubmitted(attemptId)).toBe(false);

      // First submission: 100% correct
      const firstResult = submitReadingSection({
        attemptId,
        level: 'B1',
        lesson: mockLesson,
        questions: mockQuestions,
        userAnswers: {
          rq1: 1,
          rq2: 1,
          rq3: 0,
          rq4: 2,
        },
      });

      expect(firstResult.status).toBe('evaluated');
      expect(firstResult.score).toBe(100);
      expect(isReadingAttemptSubmitted(attemptId)).toBe(true);

      // Second submission attempt: changes answers to 0% correct
      const secondResult = submitReadingSection({
        attemptId,
        level: 'B1',
        lesson: mockLesson,
        questions: mockQuestions,
        userAnswers: {
          rq1: 0,
          rq2: 0,
          rq3: 1,
          rq4: 0,
        },
      });

      // INVARIANT: First submission must prevail!
      expect(secondResult.score).toBe(100);
      expect(secondResult.evaluatedAt).toBe(firstResult.evaluatedAt);

      // Retrieval helper returns same cached result
      const retrieved = getReadingAttemptResult(attemptId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.score).toBe(100);
    });

    it('does not cache insufficient_evidence attempts so learner can resubmit valid answers', () => {
      const attemptId = 'cefr:A2:reading-fixable-attempt';

      // 1. Initial attempt with 0 answers -> insufficient evidence
      const initial = submitReadingSection({
        attemptId,
        level: 'A2',
        lesson: mockLesson,
        questions: mockQuestions,
        userAnswers: {},
      });

      expect(initial.status).toBe('insufficient_evidence');
      expect(isReadingAttemptSubmitted(attemptId)).toBe(false);

      // 2. Subsequent submission with valid answers -> successfully evaluated and cached
      const validSubmission = submitReadingSection({
        attemptId,
        level: 'A2',
        lesson: mockLesson,
        questions: mockQuestions,
        userAnswers: {
          rq1: 1,
          rq2: 1,
          rq3: 0,
          rq4: 2,
        },
      });

      expect(validSubmission.status).toBe('evaluated');
      expect(validSubmission.score).toBe(100);
      expect(isReadingAttemptSubmitted(attemptId)).toBe(true);
    });
  });

  // =========================================================================
  // 4. ANSWER PERSISTENCE & RESUME SAFETY (ANSWER PERSISTENCE & RESUME)
  // =========================================================================
  describe('Answer Persistence & Resume Safety', () => {
    it('persists reading answers in session state draft updates', () => {
      let state = createInitialCheckpointState('A1');
      state = startCheckpointSession(state);

      // Advance from listening to reading
      state = advanceToNextSection(state, 90);
      expect(state.stage).toBe('reading');
      expect(state.currentSection).toBe('reading');

      // Save reading draft answers progressively
      state = saveSectionDraft(state, {
        reading: { rq1: 1 },
      });
      expect(state.answers.reading).toEqual({ rq1: 1 });

      state = saveSectionDraft(state, {
        reading: { rq2: 1, rq3: 0 },
      });
      expect(state.answers.reading).toEqual({ rq1: 1, rq2: 1, rq3: 0 });
    });

    it('converts to ResumableActivity and restores faithfully without losing reading answers', () => {
      let state = createInitialCheckpointState('B1');
      state = startCheckpointSession(state);
      state = advanceToNextSection(state, 85); // advance to reading

      state = saveSectionDraft(state, {
        reading: { rq1: 1, rq2: 1, rq3: 0, rq4: 2 },
      });

      // Convert to resumable activity
      const activity = checkpointStateToResumableActivity(state, 'CEFR B1 Checkpoint Exam');
      expect(activity.type).toBe('checkpoint');
      expect(activity.checkpoint.readingAnswers).toEqual({ rq1: 1, rq2: 1, rq3: 0, rq4: 2 });
      expect(activity.checkpoint.currentSection).toBe('reading');

      // Restore from activity
      const restored = restoreCheckpointStateFromActivity(activity);
      expect(restored).not.toBeNull();
      expect(restored?.level).toBe('B1');
      expect(restored?.stage).toBe('reading');
      expect(restored?.currentSection).toBe('reading');
      expect(restored?.answers.reading).toEqual({ rq1: 1, rq2: 1, rq3: 0, rq4: 2 });
      expect(restored?.sectionScores.listening).toBe(85);
    });
  });

  // =========================================================================
  // 5. ASSESSMENT ASSISTANCE RESTRICTIONS AUDIT
  // =========================================================================
  describe('Assessment Mode Assistance Restrictions Audit', () => {
    it('enforces rigorous assessment policy flags', () => {
      expect(DEFAULT_ASSESSMENT_POLICY.allowDictionaryLookup).toBe(false);
      expect(DEFAULT_ASSESSMENT_POLICY.allowHints).toBe(false);
      expect(DEFAULT_ASSESSMENT_POLICY.allowAnswerReveal).toBe(false);
      expect(DEFAULT_ASSESSMENT_POLICY.allowInSessionRetry).toBe(false);
      expect(DEFAULT_ASSESSMENT_POLICY.requireFirstSubmission).toBe(true);
    });

    it('gradeReadingCheckpointSection does not leak correct answers or reveal status before evaluation', () => {
      const result = gradeReadingCheckpointSection({
        attemptId: 'cefr:A1:att-audit-1',
        level: 'A1',
        lesson: mockLesson,
        questions: mockQuestions,
        userAnswers: { rq1: 1, rq2: 0 },
      });

      expect(result.status).toBe('evaluated');
      // Evaluations exist only in the evaluation result object returned on submit
      expect(result.questionEvaluations[0].isCorrect).toBe(true);
      expect(result.questionEvaluations[1].isCorrect).toBe(false);
    });
  });

  // =========================================================================
  // 6. READING ENCOUNTERS DOES NOT AFFECT CERTIFICATION RESULT
  // =========================================================================
  describe('readingEncounters Independence Invariant', () => {
    it('produces identical score regardless of readingEncounters (0 vs 500)', () => {
      const answers = { rq1: 1, rq2: 1, rq3: 0, rq4: 2 };

      const resultZeroEncounters = gradeReadingCheckpointSection({
        attemptId: 'cefr:A1:att-enc-0',
        level: 'A1',
        lesson: mockLesson,
        questions: mockQuestions,
        userAnswers: answers,
        readingEncounters: 0,
      });

      const resultHighEncounters = gradeReadingCheckpointSection({
        attemptId: 'cefr:A1:att-enc-500',
        level: 'A1',
        lesson: mockLesson,
        questions: mockQuestions,
        userAnswers: answers,
        readingEncounters: 500,
      });

      expect(resultZeroEncounters.score).toBe(100);
      expect(resultHighEncounters.score).toBe(100);
      expect(resultZeroEncounters.score).toBe(resultHighEncounters.score);
      expect(resultZeroEncounters.passedFloor).toBe(resultHighEncounters.passedFloor);
      expect(resultZeroEncounters.status).toBe(resultHighEncounters.status);
    });

    it('does not allow high readingEncounters to pass a checkpoint when answers are failing', () => {
      // Learner has 10,000 reading encounters but answers wrong
      const resultFailedComprehension = gradeReadingCheckpointSection({
        attemptId: 'cefr:A1:att-enc-fail',
        level: 'A1',
        lesson: mockLesson,
        questions: mockQuestions,
        userAnswers: {
          rq1: 0, // wrong
          rq2: 0, // wrong
          rq3: 1, // wrong
          rq4: 0, // wrong
        },
        readingEncounters: 10000,
      });

      // INVARIANT: readingEncounters cannot pass checkpoint!
      expect(resultFailedComprehension.score).toBe(0);
      expect(resultFailedComprehension.passedFloor).toBe(false);
      expect(resultFailedComprehension.status).toBe('evaluated');
      expect(resultFailedComprehension.correctCount).toBe(0);
    });
  });

  // =========================================================================
  // 7. MISTAKE BANK DEDUPLICATION PIPELINE (MISTAKE BANK)
  // =========================================================================
  describe('Mistake Bank Pipeline & Deduplication', () => {
    it('captures vocabulary mistake only for wrong answers and deduplicates on replay', () => {
      const mockRecordMistake = vi.fn();
      const attemptId = 'cefr:A1:reading-mistake-dedupe';

      const evalResult = gradeReadingCheckpointSection({
        attemptId,
        level: 'A1',
        lesson: mockLesson,
        questions: mockQuestions,
        userAnswers: {
          rq1: 0, // WRONG (targets 'flexibility' - vocab_context)
          rq2: 0, // WRONG (detail question - not a vocab target)
          rq3: 0, // CORRECT (main_idea)
          rq4: 2, // CORRECT (detail)
        },
      });

      expect(evalResult.status).toBe('evaluated');

      // 1. First mistake recording call
      const recordedCount1 = processReadingMistakes({
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
        expect.objectContaining({ word: expect.stringMatching(/flexibility/i) }),
        'reading',
        expect.objectContaining({
          type: 'reading',
          expectedAnswer: 'Freedom in planning work',
          userAnswer: 'Strict schedules',
        })
      );

      // 2. Second mistake recording call (simulating replay / remount)
      const recordedCount2 = processReadingMistakes({
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

    it('does not record mistakes if recordMistake callback is undefined', () => {
      const evalResult = gradeReadingCheckpointSection({
        attemptId: 'cefr:A1:att-no-record',
        level: 'A1',
        lesson: mockLesson,
        questions: mockQuestions,
        userAnswers: { rq1: 0 },
      });

      const recorded = processReadingMistakes({
        attemptId: 'cefr:A1:att-no-record',
        lessonTitle: mockLesson.title,
        evaluation: evalResult,
        questions: mockQuestions,
        vocabularyList: mockVocabList,
        recordMistake: undefined,
      });

      expect(recorded).toBe(0);
    });
  });
});
