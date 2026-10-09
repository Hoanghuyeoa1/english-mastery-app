import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  startActiveSession,
  recordInteraction,
  pauseActiveSession,
  resumeActiveSession,
  endActiveSession,
  getActiveSessionStatus,
  deriveActiveLearningMinutes,
  isWhitelistedModule,
  resetActiveSessionForTesting,
  MAX_CONTINUOUS_CHUNK_SECONDS,
  INACTIVITY_TIMEOUT_MS,
  type ActiveSessionRecord,
} from '../activeLearningTimeService';
import {
  derivePronunciationImprovement,
  deriveToeicGain,
  type PronunciationEvidenceItem,
  type ToeicGainInput,
} from '../leaderboardLearningMetrics';
import {
  evaluateXpAward,
  createEmptyDailyXpTracking,
  evaluateAndRecordXpAward,
  resetDailyXpTrackingForTesting,
  FLASHCARD_DAILY_MAX_XP,
  FLASHCARD_CRAMMING_XP,
  AI_TUTOR_DAILY_MAX_TURNS,
  AI_TUTOR_MIN_TEXT_LENGTH,
  QUIZ_MAX_DAILY_GAMES_PER_TYPE,
} from '../xpAntiSpamService';
import { useAppStore } from '../../store/useAppStore';

describe('Phase 3: Active Learning Time Foundation', () => {
  beforeEach(() => {
    resetActiveSessionForTesting();
  });

  it('whitelists only designated learning modules and rejects invalid ones', () => {
    expect(isWhitelistedModule('flashcard')).toBe(true);
    expect(isWhitelistedModule('four_skills')).toBe(true);
    expect(isWhitelistedModule('toeic')).toBe(true);
    expect(isWhitelistedModule('quiz')).toBe(true);
    expect(isWhitelistedModule('pronunciation')).toBe(true);
    expect(isWhitelistedModule('ai_tutor')).toBe(true);

    // Rejected non-learning contexts
    expect(isWhitelistedModule('dashboard')).toBe(false);
    expect(isWhitelistedModule('settings')).toBe(false);
    expect(isWhitelistedModule('menu')).toBe(false);
    expect(isWhitelistedModule('leaderboard')).toBe(false);

    // Starting a non-whitelisted module returns empty string and does not start session
    const invalidId = startActiveSession('dashboard' as any);
    expect(invalidId).toBe('');
    expect(getActiveSessionStatus().isActive).toBe(false);
  });

  it('tracks session duration and records user interactions', () => {
    const startTime = 1000000;
    const sessionId = startActiveSession('flashcard', 'test_session_1', startTime);
    expect(sessionId).toBe('test_session_1');

    // 20 seconds later with interaction
    recordInteraction(startTime + 20_000);
    const status = getActiveSessionStatus(startTime + 20_000);
    expect(status.isActive).toBe(true);
    expect(status.module).toBe('flashcard');
    expect(status.activeSeconds).toBe(20);
    expect(status.interactionCount).toBe(2); // Initial start (1) + recordInteraction (1)
  });

  it('pauses tracking after 60s of inactivity (anti-idle)', () => {
    const startTime = 1000000;
    startActiveSession('quiz', 'test_idle_session', startTime);

    // Advance 65s without interaction -> should pause
    const status = getActiveSessionStatus(startTime + 65_000);
    expect(status.isPaused).toBe(true);

    // Time accumulated is capped at the last active tick before inactivity cutoff
    expect(status.activeSeconds).toBeLessThanOrEqual(60);
  });

  it('handles pause and resume cleanly (visibility & blur)', () => {
    const startTime = 1000000;
    startActiveSession('ai_tutor', 'test_visibility', startTime);

    // Active for 30s
    recordInteraction(startTime + 30_000);

    // Tab blurred or switched to background
    pauseActiveSession(startTime + 30_000);
    expect(getActiveSessionStatus(startTime + 30_000).isPaused).toBe(true);

    // 10 minutes pass in background -> time must NOT accumulate
    const pausedStatus = getActiveSessionStatus(startTime + 630_000);
    expect(pausedStatus.activeSeconds).toBe(30);

    // User switches back to tab
    resumeActiveSession(startTime + 630_000);
    expect(getActiveSessionStatus(startTime + 630_000).isPaused).toBe(false);

    // Another 15 seconds active
    recordInteraction(startTime + 645_000);
    const resumedStatus = getActiveSessionStatus(startTime + 645_000);
    expect(resumedStatus.activeSeconds).toBe(45);
  });

  it('strictly bounds continuous chunk at maximum 30 minutes (1800s)', () => {
    const startTime = 1000000;
    startActiveSession('flashcard', 'test_chunk_bounding', startTime);

    // Simulate steady interaction every 30s for 4 hours (14,400s)
    let current = startTime;
    for (let i = 0; i < 480; i++) {
      current += 30_000;
      recordInteraction(current);
    }

    const record = endActiveSession(current);
    expect(record).not.toBeNull();
    expect(record!.activeSeconds).toBe(MAX_CONTINUOUS_CHUNK_SECONDS); // Clamped at 1800s
  });

  it('derives active learning minutes with module breakdown, eligibility, and deduplication', () => {
    const weekStart = new Date('2026-10-05T00:00:00.000Z');
    const weekEnd = new Date('2026-10-12T00:00:00.000Z');

    const sessions: ActiveSessionRecord[] = [
      {
        sessionId: 's1',
        module: 'flashcard',
        startTime: '2026-10-06T10:00:00.000Z',
        endTime: '2026-10-06T10:15:00.000Z',
        activeSeconds: 600, // 10 mins
        interactionCount: 20,
        date: '2026-10-06',
      },
      {
        sessionId: 's2',
        module: 'four_skills',
        startTime: '2026-10-07T14:00:00.000Z',
        endTime: '2026-10-07T14:20:00.000Z',
        activeSeconds: 900, // 15 mins
        interactionCount: 35,
        date: '2026-10-07',
      },
      // Duplicate sessionId: must be ignored
      {
        sessionId: 's1',
        module: 'flashcard',
        startTime: '2026-10-06T10:00:00.000Z',
        endTime: '2026-10-06T10:15:00.000Z',
        activeSeconds: 600,
        interactionCount: 20,
        date: '2026-10-06',
      },
      // Session outside week: must be ignored
      {
        sessionId: 's_old',
        module: 'toeic',
        startTime: '2026-09-01T10:00:00.000Z',
        endTime: '2026-09-01T10:30:00.000Z',
        activeSeconds: 1200,
        interactionCount: 50,
        date: '2026-09-01',
      },
    ];

    const result = deriveActiveLearningMinutes(sessions, weekStart, weekEnd);

    // Total = 600 + 900 = 1500s = 25 minutes
    expect(result.totalActiveMinutes).toBe(25);
    expect(result.activeDays).toBe(2);
    expect(result.sessionCount).toBe(2);
    expect(result.byModule.flashcard).toBe(10);
    expect(result.byModule.four_skills).toBe(15);
    expect(result.byModule.toeic).toBe(0);
    expect(result.isEligible).toBe(true);
  });
});

describe('Phase 3: Pronunciation Improvement Metric Engine', () => {
  const weekStart = new Date('2026-10-05T00:00:00.000Z');
  const weekEnd = new Date('2026-10-12T00:00:00.000Z');

  it('calculates improvement correctly when samples and days criteria are satisfied', () => {
    const attempts: PronunciationEvidenceItem[] = [];

    // Baseline: Day 1 (5 attempts with avg score 70)
    for (let i = 0; i < 5; i++) {
      attempts.push({
        id: `att_d1_${i}`,
        word: `word_${i}`,
        score: 70,
        timestamp: `2026-10-06T08:0${i}:00.000Z`,
        isTrusted: true,
        isFallback: false,
        recognizedText: `word ${i}`,
      });
    }

    // Recent: Day 2 (5 attempts with avg score 85)
    for (let i = 0; i < 5; i++) {
      attempts.push({
        id: `att_d2_${i}`,
        word: `word_${i + 5}`,
        score: 85,
        timestamp: `2026-10-08T08:0${i}:00.000Z`,
        isTrusted: true,
        isFallback: false,
        recognizedText: `word ${i + 5}`,
      });
    }

    const result = derivePronunciationImprovement({
      attempts,
      weekStart,
      weekEnd,
    });

    expect(result.isEligible).toBe(true);
    expect(result.validSampleCount).toBe(10);
    expect(result.distinctDays).toBe(2);
    expect(result.baselineAvg).toBe(70);
    expect(result.recentAvg).toBe(85);
    expect(result.gainScore).toBe(15); // +15 points improvement
  });

  it('returns ineligible and null gainScore when total samples < 10', () => {
    const attempts: PronunciationEvidenceItem[] = [
      {
        id: 'att_1',
        word: 'apple',
        score: 60,
        timestamp: '2026-10-06T08:00:00.000Z',
        isTrusted: true,
        recognizedText: 'apple',
      },
      {
        id: 'att_2',
        word: 'banana',
        score: 80,
        timestamp: '2026-10-07T08:00:00.000Z',
        isTrusted: true,
        recognizedText: 'banana',
      },
    ];

    const result = derivePronunciationImprovement({
      attempts,
      weekStart,
      weekEnd,
    });

    expect(result.isEligible).toBe(false);
    expect(result.gainScore).toBeNull();
    expect(result.validSampleCount).toBe(2);
  });

  it('returns ineligible when all samples are crammed into a single day', () => {
    const attempts: PronunciationEvidenceItem[] = [];
    // 12 attempts all on the exact same day
    for (let i = 0; i < 12; i++) {
      attempts.push({
        id: `att_same_day_${i}`,
        word: `word_${i}`,
        score: 80,
        timestamp: `2026-10-06T08:${i < 10 ? '0' + i : i}:00.000Z`,
        isTrusted: true,
        recognizedText: 'word',
      });
    }

    const result = derivePronunciationImprovement({
      attempts,
      weekStart,
      weekEnd,
    });

    expect(result.isEligible).toBe(false);
    expect(result.distinctDays).toBe(1);
    expect(result.gainScore).toBeNull();
  });

  it('filters out untrusted speech, fallbacks, empty transcripts, and duplicates', () => {
    const attempts: PronunciationEvidenceItem[] = [
      // Untrusted
      {
        id: 'untrusted_1',
        word: 'cat',
        score: 95,
        timestamp: '2026-10-06T08:00:00.000Z',
        isTrusted: false,
        recognizedText: 'cat',
      },
      // Fallback
      {
        id: 'fallback_1',
        word: 'dog',
        score: 0,
        timestamp: '2026-10-06T08:01:00.000Z',
        isFallback: true,
        recognizedText: 'dog',
      },
      // Empty transcript
      {
        id: 'empty_1',
        word: 'fish',
        score: 80,
        timestamp: '2026-10-06T08:02:00.000Z',
        isTrusted: true,
        recognizedText: '   ',
      },
      // Valid attempt
      {
        id: 'valid_1',
        word: 'bird',
        score: 85,
        timestamp: '2026-10-06T08:03:00.000Z',
        isTrusted: true,
        recognizedText: 'bird',
      },
      // Duplicate of valid_1
      {
        id: 'valid_1',
        word: 'bird',
        score: 85,
        timestamp: '2026-10-06T08:03:00.000Z',
        isTrusted: true,
        recognizedText: 'bird',
      },
    ];

    const result = derivePronunciationImprovement({
      attempts,
      weekStart,
      weekEnd,
    });

    expect(result.validSampleCount).toBe(1);
  });
});

describe('Phase 3: TOEIC Gain Metric Engine', () => {
  const weekStart = new Date('2026-10-05T00:00:00.000Z');
  const weekEnd = new Date('2026-10-12T00:00:00.000Z');

  it('calculates LR Gain cleanly across valid full mock tests', () => {
    const sessions = [
      {
        id: 'toeic_lr_1',
        title: 'ETS 2024 Test 1',
        date: '2026-10-06T09:00:00.000Z',
        totalScore: 650,
        timeSpentSeconds: 7200,
        experienceMode: 'mock',
        skillScope: '2skills',
      },
      {
        id: 'toeic_lr_2',
        title: 'ETS 2024 Test 2',
        date: '2026-10-09T09:00:00.000Z',
        totalScore: 720,
        timeSpentSeconds: 7200,
        experienceMode: 'mock',
        skillScope: '2skills',
      },
    ];

    const result = deriveToeicGain({
      sessions,
      weekStart,
      weekEnd,
    });

    expect(result.isEligible).toBe(true);
    expect(result.lrGain).toBe(70); // 720 - 650 = +70
    expect(result.swGain).toBeNull();
    expect(result.totalValidAttempts).toBe(2);
    expect(result.normalizedGainPct).toBe(7.1); // 70 / 990 = 7.1%
  });

  it('excludes preview and abandoned tests with timeSpent < 60s', () => {
    const sessions = [
      {
        id: 'abandoned_1',
        title: 'ETS 2024 Test 1',
        date: '2026-10-06T09:00:00.000Z',
        totalScore: 500,
        timeSpentSeconds: 25, // Less than 60s
        experienceMode: 'mock',
      },
      {
        id: 'valid_1',
        title: 'ETS 2024 Test 2',
        date: '2026-10-08T09:00:00.000Z',
        totalScore: 600,
        timeSpentSeconds: 5000,
        experienceMode: 'mock',
      },
    ];

    const result = deriveToeicGain({
      sessions,
      weekStart,
      weekEnd,
    });

    expect(result.totalValidAttempts).toBe(1);
    expect(result.isEligible).toBe(false); // Only 1 valid attempt -> ineligible
    expect(result.lrGain).toBeNull();
  });

  it('excludes practice mode sessions from competitive gain', () => {
    const sessions = [
      {
        id: 'practice_1',
        title: 'ETS 2024 Test 1',
        date: '2026-10-06T09:00:00.000Z',
        totalScore: 800,
        timeSpentSeconds: 4000,
        mode: 'practice',
      },
      {
        id: 'practice_2',
        title: 'ETS 2024 Test 2',
        date: '2026-10-08T09:00:00.000Z',
        totalScore: 850,
        timeSpentSeconds: 4000,
        mode: 'practice',
      },
    ];

    const result = deriveToeicGain({
      sessions,
      weekStart,
      weekEnd,
    });

    expect(result.totalValidAttempts).toBe(0);
    expect(result.isEligible).toBe(false);
  });

  it('enforces 48-hour cooldown on repeated identical exams to prevent memorization farming', () => {
    const sessions = [
      {
        id: 'mock_exam_a1',
        title: 'ETS 2024 Test 1',
        date: '2026-10-06T09:00:00.000Z',
        totalScore: 600,
        timeSpentSeconds: 5400,
        experienceMode: 'mock',
        experienceConfig: { selectedExamId: 'ets_2024_01' },
      },
      // Retaking the exact same exam 5 hours later -> must be excluded
      {
        id: 'mock_exam_a2',
        title: 'ETS 2024 Test 1',
        date: '2026-10-06T14:00:00.000Z',
        totalScore: 900,
        timeSpentSeconds: 5400,
        experienceMode: 'mock',
        experienceConfig: { selectedExamId: 'ets_2024_01' },
      },
    ];

    const result = deriveToeicGain({
      sessions,
      weekStart,
      weekEnd,
    });

    expect(result.totalValidAttempts).toBe(1); // The duplicate within 48h was excluded
    expect(result.isEligible).toBe(false);
  });
});

describe('Phase 3: XP Anti-Spam & Economy Hardening Engine', () => {
  beforeEach(() => {
    resetDailyXpTrackingForTesting();
  });

  it('diminishes non-due flashcard cramming to 1 XP and enforces 300 XP daily cap', () => {
    let state = createEmptyDailyXpTracking('2026-10-06');

    // 1. Due flashcard: awards full raw XP (e.g. 10 XP)
    const dueResult = evaluateXpAward(
      {
        source: 'flashcard',
        rawAmount: 10,
        metadata: { isDue: true, isNew: false },
      },
      state
    );
    expect(dueResult.decision.allowed).toBe(true);
    expect(dueResult.decision.grantedXP).toBe(10);
    state = dueResult.nextState;

    // 2. Non-due cramming review: diminished to 1 XP
    const cramResult = evaluateXpAward(
      {
        source: 'flashcard',
        rawAmount: 15,
        metadata: { isDue: false, isNew: false },
      },
      state
    );
    expect(cramResult.decision.allowed).toBe(true);
    expect(cramResult.decision.grantedXP).toBe(FLASHCARD_CRAMMING_XP);
    state = cramResult.nextState;

    // 3. When daily flashcard XP hits 300 XP cap: awards 0 XP
    state.flashcardXpGained = FLASHCARD_DAILY_MAX_XP;
    const cappedResult = evaluateXpAward(
      {
        source: 'flashcard',
        rawAmount: 10,
        metadata: { isDue: true },
      },
      state
    );
    expect(cappedResult.decision.allowed).toBe(false);
    expect(cappedResult.decision.grantedXP).toBe(0);
  });

  it('validates AI Tutor utterances and caps daily rewarded turns at 20', () => {
    let state = createEmptyDailyXpTracking('2026-10-06');

    // Reject short text spam (< 3 characters)
    const shortResult = evaluateXpAward(
      {
        source: 'ai_tutor',
        rawAmount: 15,
        metadata: { textLength: 2 },
      },
      state
    );
    expect(shortResult.decision.allowed).toBe(false);
    expect(shortResult.decision.grantedXP).toBe(0);

    // Legitimate turn
    const legitResult = evaluateXpAward(
      {
        source: 'ai_tutor',
        rawAmount: 15,
        metadata: { textLength: 25 },
      },
      state
    );
    expect(legitResult.decision.allowed).toBe(true);
    expect(legitResult.decision.grantedXP).toBe(15);
    state = legitResult.nextState;

    // Cap at 20 turns
    state.tutorTurnsRewarded = AI_TUTOR_DAILY_MAX_TURNS;
    const cappedTurn = evaluateXpAward(
      {
        source: 'ai_tutor',
        rawAmount: 15,
        metadata: { textLength: 30 },
      },
      state
    );
    expect(cappedTurn.decision.allowed).toBe(false);
    expect(cappedTurn.decision.grantedXP).toBe(0);
  });

  it('rewards pronunciation pass once per word per day; retries grant 0 XP', () => {
    let state = createEmptyDailyXpTracking('2026-10-06');

    // First attempt on 'extraordinary'
    const firstPass = evaluateXpAward(
      {
        source: 'pronunciation',
        rawAmount: 10,
        metadata: { wordId: 'extraordinary' },
      },
      state
    );
    expect(firstPass.decision.allowed).toBe(true);
    expect(firstPass.decision.grantedXP).toBe(10);
    state = firstPass.nextState;

    // Same word retry on same day -> 0 XP
    const retryPass = evaluateXpAward(
      {
        source: 'pronunciation',
        rawAmount: 10,
        metadata: { wordId: 'extraordinary' },
      },
      state
    );
    expect(retryPass.decision.allowed).toBe(false);
    expect(retryPass.decision.grantedXP).toBe(0);

    // Different word -> granted
    const newWordPass = evaluateXpAward(
      {
        source: 'pronunciation',
        rawAmount: 10,
        metadata: { wordId: 'magnificent' },
      },
      state
    );
    expect(newWordPass.decision.allowed).toBe(true);
    expect(newWordPass.decision.grantedXP).toBe(10);
  });

  it('caps quiz minigames at 5 games per minigame type per day', () => {
    let state = createEmptyDailyXpTracking('2026-10-06');

    for (let i = 0; i < QUIZ_MAX_DAILY_GAMES_PER_TYPE; i++) {
      const res = evaluateXpAward(
        {
          source: 'quiz',
          rawAmount: 20,
          metadata: { gameType: 'speed_match' },
        },
        state
      );
      expect(res.decision.allowed).toBe(true);
      state = res.nextState;
    }

    // 6th game on speed_match: capped
    const sixthGame = evaluateXpAward(
      {
        source: 'quiz',
        rawAmount: 20,
        metadata: { gameType: 'speed_match' },
      },
      state
    );
    expect(sixthGame.decision.allowed).toBe(false);
    expect(sixthGame.decision.grantedXP).toBe(0);

    // Different game type: still allowed
    const otherGame = evaluateXpAward(
      {
        source: 'quiz',
        rawAmount: 20,
        metadata: { gameType: 'word_scramble' },
      },
      state
    );
    expect(otherGame.decision.allowed).toBe(true);
  });

  it('strictly enforces idempotency against duplicates (restart, F5, rerender)', () => {
    let state = createEmptyDailyXpTracking('2026-10-06');
    const idemKey = 'toeic_complete_session_999';

    // First award with key
    const firstCall = evaluateXpAward(
      {
        source: 'toeic',
        rawAmount: 50,
        idempotencyKey: idemKey,
      },
      state
    );
    expect(firstCall.decision.allowed).toBe(true);
    expect(firstCall.decision.grantedXP).toBe(50);
    state = firstCall.nextState;

    // Second call with same idempotency key -> denied
    const secondCall = evaluateXpAward(
      {
        source: 'toeic',
        rawAmount: 50,
        idempotencyKey: idemKey,
      },
      state
    );
    expect(secondCall.decision.allowed).toBe(false);
    expect(secondCall.decision.grantedXP).toBe(0);
  });

  it('integrates anti-spam and idempotency in useAppStore gainXP', () => {
    const store = useAppStore.getState();
    const initialXP = store.profile.xp;

    // Award with unique key
    const key1 = `idempotency_test_${Date.now()}_1`;
    store.gainXP(20, {
      source: 'manual',
      idempotencyKey: key1,
    });
    expect(useAppStore.getState().profile.xp).toBe(initialXP + 20);

    // Replay with identical key -> no XP gained
    store.gainXP(20, {
      source: 'manual',
      idempotencyKey: key1,
    });
    expect(useAppStore.getState().profile.xp).toBe(initialXP + 20);
  });
});
