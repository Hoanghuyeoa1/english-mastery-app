// src/services/__tests__/sessionExperienceAdapter.test.ts
import { describe, it, expect } from 'vitest';
import {
  clampNumber,
  clampProgressPercent,
  calculateDiscreteRemaining,
  safeDivide,
  formatSessionDurationBucket,
  formatSessionTimeLeft,
  isDiscreteProgressMetric,
  isTargetWordsProgressMetric,
  isTimedProgressMetric,
  isOpenTurnsProgressMetric,
  isUnboundedProgressMetric,
  deriveFlashcardSessionModel,
  deriveReadingSessionModel,
  deriveListeningSessionModel,
  deriveSpeakingSessionModel,
  deriveWritingSessionModel,
  deriveToeicSessionModel,
  deriveQuizSessionModel,
  derivePronunciationSessionModel,
  deriveTutorSessionModel,
} from '../sessionExperienceAdapter';

describe('sessionExperienceAdapter - Math & Clamping Primitives', () => {
  it('clampNumber safely bounds values and handles NaN / Infinity / undefined', () => {
    expect(clampNumber(5, 0, 10)).toBe(5);
    expect(clampNumber(-3, 0, 10)).toBe(0);
    expect(clampNumber(15, 0, 10)).toBe(10);
    expect(clampNumber(NaN, 0, 10, 2)).toBe(2);
    expect(clampNumber(Infinity, 0, 10, 0)).toBe(0);
    expect(clampNumber(undefined, 0, 10, 0)).toBe(0);
  });

  it('clampProgressPercent correctly calculates integer 0-100% and guards against division by zero', () => {
    // Normal cases
    expect(clampProgressPercent(5, 10)).toBe(50);
    expect(clampProgressPercent(1, 3)).toBe(33);
    expect(clampProgressPercent(3, 3)).toBe(100);

    // Clamping over 100%
    expect(clampProgressPercent(15, 10)).toBe(100);

    // Negative current
    expect(clampProgressPercent(-5, 10)).toBe(0);

    // Zero / Empty / Missing total
    expect(clampProgressPercent(0, 0)).toBe(0);
    expect(clampProgressPercent(5, 0)).toBe(0);
    expect(clampProgressPercent(5, -10)).toBe(0);
    expect(clampProgressPercent(NaN, 10)).toBe(0);
    expect(clampProgressPercent(5, NaN)).toBe(0);
    expect(clampProgressPercent(Infinity, 10)).toBe(0);
  });

  it('calculateDiscreteRemaining computes safe remaining items count >= 0', () => {
    expect(calculateDiscreteRemaining(10, 4)).toBe(6);
    expect(calculateDiscreteRemaining(10, 10)).toBe(0);
    expect(calculateDiscreteRemaining(10, 15)).toBe(0);
    expect(calculateDiscreteRemaining(0, 0)).toBe(0);
    expect(calculateDiscreteRemaining(1, 0)).toBe(1);
    expect(calculateDiscreteRemaining(NaN, 0)).toBe(0);
  });

  it('safeDivide handles division by zero and non-finite values cleanly', () => {
    expect(safeDivide(10, 2)).toBe(5);
    expect(safeDivide(10, 0, 0)).toBe(0);
    expect(safeDivide(NaN, 5, 0)).toBe(0);
    expect(safeDivide(10, NaN, -1)).toBe(-1);
    expect(safeDivide(Infinity, 2, 0)).toBe(0);
  });
});

describe('sessionExperienceAdapter - Time Formatting', () => {
  it('formatSessionDurationBucket creates human-friendly buckets without NaN', () => {
    expect(formatSessionDurationBucket(3)).toBe('~5 phút');
    expect(formatSessionDurationBucket(7)).toBe('~5 phút');
    expect(formatSessionDurationBucket(8)).toBe('~10 phút');
    expect(formatSessionDurationBucket(12)).toBe('~10 phút');
    expect(formatSessionDurationBucket(15)).toBe('~15 phút');
    expect(formatSessionDurationBucket(20)).toBe('~20 phút');
    expect(formatSessionDurationBucket(25)).toBe('~25 phút');
    expect(formatSessionDurationBucket(30)).toBe('~30 phút');

    // Invalid / zero fallback
    expect(formatSessionDurationBucket(0)).toBe('~5 phút');
    expect(formatSessionDurationBucket(-10)).toBe('~5 phút');
    expect(formatSessionDurationBucket(NaN)).toBe('~5 phút');
    expect(formatSessionDurationBucket(undefined)).toBe('~5 phút');
  });

  it('formatSessionTimeLeft formats seconds into mm:ss strings', () => {
    expect(formatSessionTimeLeft(0)).toBe('00:00');
    expect(formatSessionTimeLeft(59)).toBe('00:59');
    expect(formatSessionTimeLeft(60)).toBe('01:00');
    expect(formatSessionTimeLeft(899)).toBe('14:59');
    expect(formatSessionTimeLeft(-10)).toBe('00:00');
    expect(formatSessionTimeLeft(NaN)).toBe('00:00');
  });
});

describe('sessionExperienceAdapter - Type Guards', () => {
  it('correctly discriminates all 5 session progress metric kinds', () => {
    const discrete = {
      kind: 'discrete_items' as const,
      currentIndex: 0,
      totalItems: 10,
      answeredCount: 0,
      remainingCount: 10,
      progressPercent: 0,
    };
    const words = {
      kind: 'target_words' as const,
      currentWordCount: 50,
      minWords: 150,
      progressPercent: 33,
    };
    const timer = {
      kind: 'timed_countdown' as const,
      timeLeftSeconds: 300,
      totalDurationSeconds: 600,
      isPaused: false,
      progressPercent: 50,
    };
    const turns = {
      kind: 'open_turns' as const,
      turnCount: 4,
    };
    const unbounded = {
      kind: 'unbounded' as const,
      completedCount: 12,
    };

    expect(isDiscreteProgressMetric(discrete)).toBe(true);
    expect(isDiscreteProgressMetric(words)).toBe(false);

    expect(isTargetWordsProgressMetric(words)).toBe(true);
    expect(isTargetWordsProgressMetric(discrete)).toBe(false);

    expect(isTimedProgressMetric(timer)).toBe(true);
    expect(isTimedProgressMetric(unbounded)).toBe(false);

    expect(isOpenTurnsProgressMetric(turns)).toBe(true);
    expect(isOpenTurnsProgressMetric(timer)).toBe(false);

    expect(isUnboundedProgressMetric(unbounded)).toBe(true);
    expect(isUnboundedProgressMetric(turns)).toBe(false);
  });
});

describe('sessionExperienceAdapter - Flow Model Derivations', () => {
  it('1. Flashcard: derives valid discrete items metric, streak, and handles single item & empty queue', () => {
    // Normal queue
    const model = deriveFlashcardSessionModel({
      queueMode: 'DUE',
      currentIndex: 4,
      totalWords: 15,
      reviewedCount: 5,
      sessionStreak: 3,
      ratingCounts: { again: 1, hard: 1, good: 2, easy: 1 },
      observedRetention: 0.6,
    });

    expect(model.flowType).toBe('flashcard');
    expect(model.phase).toBe('active');
    expect(model.progressMetric.totalItems).toBe(15);
    expect(model.progressMetric.answeredCount).toBe(5);
    expect(model.progressMetric.remainingCount).toBe(10);
    expect(model.progressMetric.progressPercent).toBe(33);
    expect(model.sessionStreak).toBe(3);
    expect(model.observedRetention).toBe(0.6);

    // Single item queue
    const singleModel = deriveFlashcardSessionModel({
      queueMode: 'NEW',
      currentIndex: 0,
      totalWords: 1,
      reviewedCount: 1,
    });
    expect(singleModel.progressMetric.totalItems).toBe(1);
    expect(singleModel.progressMetric.progressPercent).toBe(100);
    expect(singleModel.phase).toBe('completed');

    // Empty queue
    const emptyModel = deriveFlashcardSessionModel({
      queueMode: 'ALL',
      currentIndex: 0,
      totalWords: 0,
      reviewedCount: 0,
    });
    expect(emptyModel.progressMetric.totalItems).toBe(0);
    expect(emptyModel.progressMetric.progressPercent).toBe(0);
  });

  it('2. Reading: derives discrete question items and score without fake metrics', () => {
    const model = deriveReadingSessionModel({
      lessonId: 'read_b1_01',
      title: 'Global Warming Effects',
      cefrLevel: 'B1',
      category: 'Environment',
      readTimeStr: '4 mins',
      totalQuestions: 5,
      answeredCount: 3,
      correctCount: 2,
    });

    expect(model.flowType).toBe('reading');
    expect(model.lessonId).toBe('read_b1_01');
    expect(model.progressMetric.totalItems).toBe(5);
    expect(model.progressMetric.answeredCount).toBe(3);
    expect(model.progressMetric.remainingCount).toBe(2);
    expect(model.progressMetric.progressPercent).toBe(60);
    expect(model.scorePercent).toBe(40); // 2 / 5 = 40%
    expect(model.estimatedMinutes).toBe(7); // 4 + 3 buffer = 7
  });

  it('3. Listening: derives discrete items and handles mm:ss audio duration', () => {
    const model = deriveListeningSessionModel({
      lessonId: 'listen_a2_01',
      title: 'At the Airport',
      cefrLevel: 'A2',
      durationStr: '3:30',
      totalQuestions: 4,
      answeredCount: 4,
      correctCount: 3,
      playbackState: {
        isPlaying: true,
        activeSentenceIndex: 2,
        audioSpeed: 1.0,
      },
    });

    expect(model.flowType).toBe('listening');
    expect(model.progressMetric.progressPercent).toBe(100);
    expect(model.scorePercent).toBe(75);
    expect(model.estimatedMinutes).toBe(7); // 3.5 + 3 buffer = 6.5 -> 7
    expect(model.playbackState?.isPlaying).toBe(true);
  });

  it('4. Speaking: derives discrete turn items and turn accuracy', () => {
    const model = deriveSpeakingSessionModel({
      promptId: 'spk_01',
      title: 'Ordering Coffee',
      cefrLevel: 'A1',
      currentTurnIndex: 1,
      totalTurns: 3,
      currentTurnAccuracy: 85,
      averageAccuracy: 80,
    });

    expect(model.flowType).toBe('speaking');
    expect(model.progressMetric.currentIndex).toBe(1);
    expect(model.progressMetric.totalItems).toBe(3);
    expect(model.progressMetric.progressPercent).toBe(33);
    expect(model.currentTurnAccuracy).toBe(85);
  });

  it('5. Writing: derives target_words metric and NEVER fakes discrete items', () => {
    const model = deriveWritingSessionModel({
      isCustomTopic: false,
      promptId: 'wrt_b2_01',
      title: 'Technology in Education',
      cefrLevel: 'B2',
      currentWordCount: 80,
      minWords: 160,
      targetRange: '150 - 200 từ',
    });

    expect(model.flowType).toBe('writing');
    expect(model.progressMetric.kind).toBe('target_words');
    if (model.progressMetric.kind === 'target_words') {
      expect(model.progressMetric.currentWordCount).toBe(80);
      expect(model.progressMetric.minWords).toBe(160);
      expect(model.progressMetric.progressPercent).toBe(50);
      expect('totalItems' in model.progressMetric).toBe(false); // Invariant: No fake items!
    }
  });

  it('6. TOEIC: derives both discrete items and timer countdown, respects paused state', () => {
    const model = deriveToeicSessionModel({
      attemptId: 'toeic_attempt_123',
      examMode: '2skills_mini',
      experienceMode: 'mock',
      currentQuestionIndex: 5,
      totalQuestions: 10,
      answeredCount: 4,
      timeLeftSeconds: 600,
      totalDurationMinutes: 15,
      isPaused: true,
    });

    expect(model.flowType).toBe('toeic');
    expect(model.phase).toBe('paused');
    expect(model.isPaused).toBe(true);
    expect(model.itemsMetric.totalItems).toBe(10);
    expect(model.itemsMetric.answeredCount).toBe(4);
    expect(model.itemsMetric.progressPercent).toBe(40);
    expect(model.timerMetric?.timeLeftSeconds).toBe(600);
    expect(model.timerMetric?.isPaused).toBe(true);
  });

  it('7. Quiz: supports speed_match timer vs arcade unbounded without faking progress', () => {
    // Speed match (timed countdown)
    const speedMatch = deriveQuizSessionModel({
      arcadeMode: 'speed_match',
      sourceMode: 'all_vocab',
      streakCount: 5,
      totalXpSession: 150,
      timeLeftSeconds: 30,
    });

    expect(speedMatch.flowType).toBe('quiz');
    expect(speedMatch.progressMetric.kind).toBe('timed_countdown');
    if (speedMatch.progressMetric.kind === 'timed_countdown') {
      expect(speedMatch.progressMetric.timeLeftSeconds).toBe(30);
      expect(speedMatch.progressMetric.progressPercent).toBe(50); // 30s elapsed out of 60s
    }

    // Arcade classic quiz (unbounded)
    const arcadeQuiz = deriveQuizSessionModel({
      arcadeMode: 'classic_quiz',
      sourceMode: 'mistake_bank',
      streakCount: 4,
      totalXpSession: 80,
      completedAnswersCount: 8,
    });

    expect(arcadeQuiz.progressMetric.kind).toBe('unbounded');
    if (arcadeQuiz.progressMetric.kind === 'unbounded') {
      expect(arcadeQuiz.progressMetric.completedCount).toBe(8);
      expect(arcadeQuiz.progressMetric.streakCount).toBe(4);
      expect('progressPercent' in arcadeQuiz.progressMetric).toBe(false); // Invariant: No fake %!
    }
  });

  it('8. Pronunciation: supports unbounded vocabulary without fake percentage', () => {
    const model = derivePronunciationSessionModel({
      currentWord: 'comfortable',
      ipa: 'ˈkʌmftəbl',
      subMode: 'ai_speech',
      completedWordsCount: 7,
      lastAccuracyScore: 82,
    });

    expect(model.flowType).toBe('pronunciation');
    expect(model.progressMetric.kind).toBe('unbounded');
    if (model.progressMetric.kind === 'unbounded') {
      expect(model.progressMetric.completedCount).toBe(7);
      expect('progressPercent' in model.progressMetric).toBe(false); // Invariant: No fake %!
    }
    expect(model.lastAccuracyScore).toBe(82);
  });

  it('9. AI Tutor: strictly enforces open_turns metric and NEVER fakes total items or percentage', () => {
    const model = deriveTutorSessionModel({
      scenarioId: 'coffee_shop',
      scenarioTitle: 'Ordering Coffee in London',
      turnCount: 6,
      lastInteractionSummary: 'User requested a flat white with oat milk.',
    });

    expect(model.flowType).toBe('tutor');
    expect(model.progressMetric.kind).toBe('open_turns');
    expect(model.progressMetric.turnCount).toBe(6);
    expect(model.progressMetric.lastInteractionSummary).toContain('flat white');
    expect('progressPercent' in model.progressMetric).toBe(false); // Strict Invariant: No fake %!
    expect('totalItems' in model.progressMetric).toBe(false);       // Strict Invariant: No fake total!
  });
});
