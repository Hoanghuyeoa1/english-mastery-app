// @vitest-environment happy-dom
// src/services/__tests__/toeicPersistenceService.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MAX_PERSISTED_ATTEMPTS,
  sanitizeSessionForPersistence,
  deduplicateToeicSessions,
  loadToeicHistory,
  saveToeicAttempt,
  mergeToeicHistories,
  syncToeicCloudHistory,
  extractAttemptAnalyticsList,
  loadToeicArchivedSummary,
  saveToeicArchivedSummary,
  archiveDroppedSessions,
  clearToeicHistory,
} from '../toeicPersistenceService';
import {
  ToeicTestSession,
  ToeicAttemptAnalytics,
  STORAGE_KEY_HISTORY,
  STORAGE_KEY_ARCHIVED_SUMMARY,
} from '../../types/toeic';
import { buildToeicWeaknessProfile } from '../toeicHistoricalAnalytics';
import { useAppStore } from '../../store/useAppStore';

describe('TOEIC Persistence, Deduplication & Cloud Merge (Phase 5)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  const createDummySession = (
    id: string,
    timestamp: number = Date.now(),
    hasAnalytics: boolean = true
  ): ToeicTestSession => {
    const analytics: ToeicAttemptAnalytics | undefined = hasAnalytics
      ? {
          attemptId: id,
          experienceMode: 'mock',
          skillScope: '2-skills',
          completedAt: timestamp,
          overall: {
            totalItems: 10,
            objectiveCount: 10,
            openEndedCount: 0,
            attemptedCount: 10,
            unansweredCount: 0,
            correctCount: 8,
            incorrectCount: 2,
            accuracy: 80,
            listeningScore: 400,
            readingScore: 380,
            totalScore: 780,
            durationSeconds: 900,
            timeSpentSeconds: 750,
            completionRate: 100,
          },
          bySkill: {
            listening: {
              skill: 'listening',
              isObjective: true,
              questionsSeen: 5,
              attempted: 5,
              correct: 4,
              incorrect: 1,
              unanswered: 0,
              accuracy: 80,
              evidenceCount: 5,
            },
            reading: {
              skill: 'reading',
              isObjective: true,
              questionsSeen: 5,
              attempted: 5,
              correct: 4,
              incorrect: 1,
              unanswered: 0,
              accuracy: 80,
              evidenceCount: 5,
            },
            speaking: {
              skill: 'speaking',
              isObjective: false,
              questionsSeen: 0,
              hasEvidence: false,
              evidenceCount: 0,
              accuracy: null,
            },
            writing: {
              skill: 'writing',
              isObjective: false,
              questionsSeen: 0,
              hasEvidence: false,
              evidenceCount: 0,
              accuracy: null,
            },
          },
          byPart: {},
          bySubSkill: {
            grammar_tenses: {
              subSkill: 'grammar_tenses',
              skill: 'reading',
              isObjective: true,
              questionsSeen: 4,
              attempted: 4,
              correct: 3,
              incorrect: 1,
              unanswered: 0,
              accuracy: 75,
              evidenceCount: 4,
              questionTypes: ['grammar_pos'],
            },
          },
          byDifficulty: {
            easy: { difficulty: 'easy', difficultyLevel: 1, questionsSeen: 2, attempted: 2, correct: 2, incorrect: 0, unanswered: 0, accuracy: 100 },
            medium: { difficulty: 'medium', difficultyLevel: 2, questionsSeen: 5, attempted: 5, correct: 4, incorrect: 1, unanswered: 0, accuracy: 80 },
            hard: { difficulty: 'hard', difficultyLevel: 3, questionsSeen: 3, attempted: 3, correct: 2, incorrect: 1, unanswered: 0, accuracy: 66.7 },
          },
          experienceSemantics: {
            experienceMode: 'mock',
            evidenceSource: 'strict_exam',
            isFirstAttemptEvidence: true,
          },
        }
      : undefined;

    return {
      id,
      mode: '2skills_mini',
      experienceMode: 'mock',
      skillScope: '2-skills',
      title: `TOEIC Exam ${id}`,
      date: new Date(timestamp).toISOString(),
      totalQuestions: 10,
      durationMinutes: 15,
      userAnswers: { q1: 'A', q2: 'B' },
      firstAttemptAnswers: { q1: 'A', q2: 'B' },
      listeningScore: 400,
      readingScore: 380,
      totalScore: 780,
      cefrLevel: 'B2',
      analytics,
    };
  };

  describe('1. Persistence Model & Sanitization', () => {
    it('returns null for null, undefined, or empty ID sessions', () => {
      expect(sanitizeSessionForPersistence(null as any)).toBeNull();
      expect(sanitizeSessionForPersistence(undefined as any)).toBeNull();
      expect(sanitizeSessionForPersistence({} as any)).toBeNull();
      expect(sanitizeSessionForPersistence({ id: '   ' } as any)).toBeNull();
    });

    it('sanitizes session and prevents persisting static question objects / bloated bank', () => {
      const bloatedSession: any = {
        ...createDummySession('sess_bloat_1'),
        questions: [{ id: 'q1', text: 'Large question text', options: ['A', 'B', 'C', 'D'] }],
        rawQuestionBank: [{ id: 'q2', text: 'Unused bank question' }],
      };

      const sanitized = sanitizeSessionForPersistence(bloatedSession);
      expect(sanitized).not.toBeNull();
      expect(sanitized?.id).toBe('sess_bloat_1');
      // Questions array and rawQuestionBank must NOT be on sanitized object
      expect((sanitized as any).questions).toBeUndefined();
      expect((sanitized as any).rawQuestionBank).toBeUndefined();
      expect(sanitized?.analytics?.attemptId).toBe('sess_bloat_1');
    });

    it('falls back to safe default values when optional fields are missing', () => {
      const minimalSession: Partial<ToeicTestSession> = {
        id: 'min_1',
      };
      const sanitized = sanitizeSessionForPersistence(minimalSession);
      expect(sanitized).not.toBeNull();
      expect(sanitized?.id).toBe('min_1');
      expect(sanitized?.experienceMode).toBe('practice');
      expect(sanitized?.skillScope).toBe('2-skills');
      expect(sanitized?.totalQuestions).toBe(0);
      expect(sanitized?.analytics).toBeUndefined();
    });
  });

  describe('2. Attempt Deduplication Invariant', () => {
    it('deduplicates identical attempt IDs into a single entry', () => {
      const sess1 = createDummySession('att_dup_1', 1000);
      const sess2 = createDummySession('att_dup_1', 1000);
      const sess3 = createDummySession('att_dup_2', 2000);

      const deduplicated = deduplicateToeicSessions([sess1, sess2, sess3]);
      expect(deduplicated).toHaveLength(2);
      expect(deduplicated.map((s) => s.id)).toEqual(['att_dup_2', 'att_dup_1']);
    });

    it('prioritizes session record with analytics when duplicate ID is encountered', () => {
      const withoutAnalytics = createDummySession('att_dup_conflict', 1000, false);
      const withAnalytics = createDummySession('att_dup_conflict', 1000, true);

      // Regardless of order, record with analytics is preserved
      const res1 = deduplicateToeicSessions([withoutAnalytics, withAnalytics]);
      expect(res1).toHaveLength(1);
      expect(res1[0].analytics).toBeDefined();

      const res2 = deduplicateToeicSessions([withAnalytics, withoutAnalytics]);
      expect(res2).toHaveLength(1);
      expect(res2[0].analytics).toBeDefined();
    });

    it('sorts attempts newest first by timestamp', () => {
      const s1 = createDummySession('t1', 1000);
      const s2 = createDummySession('t2', 3000);
      const s3 = createDummySession('t3', 2000);

      const res = deduplicateToeicSessions([s1, s2, s3]);
      expect(res.map((s) => s.id)).toEqual(['t2', 't3', 't1']);
    });
  });

  describe('3. Storage Budget & Limit Enforcement', () => {
    it('strictly bounds persisted history to MAX_PERSISTED_ATTEMPTS (15)', () => {
      expect(MAX_PERSISTED_ATTEMPTS).toBe(15);

      const sessions: ToeicTestSession[] = [];
      for (let i = 1; i <= 20; i++) {
        sessions.push(createDummySession(`att_${i}`, i * 1000));
      }

      const bounded = deduplicateToeicSessions(sessions, MAX_PERSISTED_ATTEMPTS);
      expect(bounded).toHaveLength(15);
      // Newest sessions (att_20 down to att_6) must be preserved; att_1 to att_5 pruned
      expect(bounded[0].id).toBe('att_20');
      expect(bounded[14].id).toBe('att_6');
    });

    it('saveToeicAttempt enforces MAX_PERSISTED_ATTEMPTS in localStorage', () => {
      let history: ToeicTestSession[] = [];
      for (let i = 1; i <= 20; i++) {
        const sess = createDummySession(`sess_${i}`, i * 1000);
        history = saveToeicAttempt(sess, history);
      }

      expect(history).toHaveLength(15);
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
      expect(stored).toHaveLength(15);
      expect(stored[0].id).toBe('sess_20');
    });
  });

  describe('4. Zero-Crash Rehydration', () => {
    it('returns empty array when storage is empty, null, or blank string', () => {
      expect(loadToeicHistory()).toEqual([]);

      localStorage.setItem(STORAGE_KEY_HISTORY, '   ');
      expect(loadToeicHistory()).toEqual([]);
    });

    it('returns empty array without crashing when JSON is malformed syntax', () => {
      localStorage.setItem(STORAGE_KEY_HISTORY, '{"corrupted JSON string:::');
      expect(loadToeicHistory()).toEqual([]);
    });

    it('returns empty array without crashing when stored value is not a JSON array', () => {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify({ message: 'not an array' }));
      expect(loadToeicHistory()).toEqual([]);

      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(42));
      expect(loadToeicHistory()).toEqual([]);
    });

    it('safely filters out invalid entries in an array while preserving valid sessions', () => {
      const valid = createDummySession('valid_1', 1000);
      const corruptedArray = [
        null,
        undefined,
        {},
        { id: '' },
        'invalid item',
        valid,
      ];
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(corruptedArray));

      const loaded = loadToeicHistory();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('valid_1');
    });
  });

  describe('5. Practice Retry Invariant & First-Attempt Evidence Semantics', () => {
    it('retrying in the same practice session does not create duplicate attempts', () => {
      const practiceSession: ToeicTestSession = {
        ...createDummySession('practice_att_1', 5000),
        experienceMode: 'practice',
        // User retried q2 from incorrect 'C' to correct 'B'
        userAnswers: { q1: 'A', q2: 'B' },
        firstAttemptAnswers: { q1: 'A', q2: 'C' },
        practiceStats: {
          totalQuestions: 2,
          firstAttemptCorrect: 1,
          retryCorrect: 1,
          accuracy: 50,
        },
      };

      // Saving initial attempt
      let history = saveToeicAttempt(practiceSession, []);
      expect(history).toHaveLength(1);

      // Re-saving or reloading the same practice attempt ID
      history = saveToeicAttempt(practiceSession, history);
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('practice_att_1');
      expect(history[0].firstAttemptAnswers?.q2).toBe('C');
      expect(history[0].userAnswers.q2).toBe('B');
    });

    it('extractAttemptAnalyticsList preserves only first-attempt evidence for weakness profiling', () => {
      const practiceSession: ToeicTestSession = {
        ...createDummySession('practice_att_2', 5000),
        experienceMode: 'practice',
      };

      const analyticsList = extractAttemptAnalyticsList([practiceSession]);
      expect(analyticsList).toHaveLength(1);
      expect(analyticsList[0].experienceSemantics?.isFirstAttemptEvidence).toBe(true);

      // Generating weakness profile does not crash and accurately uses analytics
      const profile = buildToeicWeaknessProfile(analyticsList);
      expect(profile).toBeDefined();
      expect(profile.evidenceSummary.totalAttempts).toBe(1);
    });
  });

  describe('6. Deterministic Cloud Merge', () => {
    it('merges local and remote histories by unique attemptId without double-counting', () => {
      const localSess1 = createDummySession('cloud_att_1', 1000);
      const localSess2 = createDummySession('cloud_att_2', 2000);

      const remoteSess2 = createDummySession('cloud_att_2', 2000); // shared attempt
      const remoteSess3 = createDummySession('cloud_att_3', 3000); // unique to remote

      const merged = mergeToeicHistories([localSess1, localSess2], [remoteSess2, remoteSess3]);
      expect(merged).toHaveLength(3);
      expect(merged.map((s) => s.id)).toEqual(['cloud_att_3', 'cloud_att_2', 'cloud_att_1']);
    });

    it('cloud merge is commutative: merge(A, B) produces the same IDs as merge(B, A)', () => {
      const setA = [createDummySession('devA_1', 1000), createDummySession('shared_1', 2000)];
      const setB = [createDummySession('devB_1', 1500), createDummySession('shared_1', 2000)];

      const mergeAB = mergeToeicHistories(setA, setB);
      const mergeBA = mergeToeicHistories(setB, setA);

      expect(mergeAB.map((s) => s.id)).toEqual(mergeBA.map((s) => s.id));
    });

    it('syncToeicCloudHistory persists merged result into storage', () => {
      saveToeicAttempt(createDummySession('local_only', 1000));

      const remoteIncoming = [
        createDummySession('remote_1', 2000),
        createDummySession('local_only', 1000),
      ];

      const synced = syncToeicCloudHistory(remoteIncoming);
      expect(synced).toHaveLength(2);
      expect(synced.map((s) => s.id)).toEqual(['remote_1', 'local_only']);

      // Verified persisted in localStorage
      const inStorage = loadToeicHistory();
      expect(inStorage).toHaveLength(2);
      expect(inStorage.map((s) => s.id)).toEqual(['remote_1', 'local_only']);
    });
  });

  describe('7. Isolation from SRS / FSRS Engine', () => {
    it('invariant: generating and persisting TOEIC analytics never mutates FSRS cards or review events', () => {
      const store = useAppStore.getState();
      const initialSrsProgress = { ...store.srsProgressMap };
      const initialRecentEvents = [...store.recentReviewEvents];

      // Simulate saving and analyzing attempts
      const sess = createDummySession('srs_isolation_test', Date.now());
      saveToeicAttempt(sess);
      const analyticsList = extractAttemptAnalyticsList([sess]);
      buildToeicWeaknessProfile(analyticsList);

      const afterStore = useAppStore.getState();
      expect(afterStore.srsProgressMap).toEqual(initialSrsProgress);
      expect(afterStore.recentReviewEvents).toEqual(initialRecentEvents);
    });
  });

  describe('8. Long-Term Archiving Beyond MAX_PERSISTED_ATTEMPTS (15)', () => {
    it('khi lưu quá 15 attempts, các bài cũ nhất được tự động archive vào ToeicArchivedSummary', () => {
      // Tạo 17 attempts (vượt MAX_PERSISTED_ATTEMPTS = 15)
      let history: ToeicTestSession[] = [];
      for (let i = 1; i <= 17; i++) {
        const sess = createDummySession(`overflow_att_${i}`, 1000 + i * 100);
        history = saveToeicAttempt(sess, history);
      }

      // History chính chỉ giữ đúng 15 bài
      expect(history).toHaveLength(15);
      expect(history[0].id).toBe('overflow_att_17'); // Mới nhất

      // Archived summary phải tồn tại và ghi nhận 2 bài bị loại bỏ (att_1, att_2)
      const archived = loadToeicArchivedSummary();
      expect(archived).not.toBeNull();
      expect(archived?.totalArchivedAttempts).toBe(2);
      expect(archived?.totalQuestions).toBe(20); // mỗi bài dummy 10 câu
      expect(archived?.bySkill.listening.totalSeen).toBe(10); // 5 câu * 2
      expect(archived?.bySkill.listening.totalCorrect).toBe(8); // 4 câu * 2
    });

    it('archiveDroppedSessions tích lũy đúng số lượng bài thi và câu hỏi qua nhiều lần cắt tỉa', () => {
      const dropped1 = [createDummySession('drop_1', 100), createDummySession('drop_2', 200)];
      const summary1 = archiveDroppedSessions(dropped1);
      expect(summary1.totalArchivedAttempts).toBe(2);
      expect(summary1.totalQuestions).toBe(20);

      const dropped2 = [createDummySession('drop_3', 300)];
      const summary2 = archiveDroppedSessions(dropped2, summary1);
      expect(summary2.totalArchivedAttempts).toBe(3);
      expect(summary2.totalQuestions).toBe(30);
    });

    it('clearToeicHistory xóa sạch cả history và archived summary', () => {
      saveToeicAttempt(createDummySession('to_clear', 100));
      saveToeicArchivedSummary({
        totalArchivedAttempts: 1,
        totalQuestions: 10,
        bySkill: {},
        byPart: {},
        bySubSkill: {},
        lastUpdated: Date.now(),
      });

      expect(loadToeicHistory()).toHaveLength(1);
      expect(loadToeicArchivedSummary()).not.toBeNull();

      clearToeicHistory();
      expect(loadToeicHistory()).toHaveLength(0);
      expect(loadToeicArchivedSummary()).toBeNull();
    });
  });

  describe('9. Numeric Sanitization & Malformed Payload Hardening', () => {
    it('làm sạch NaN, số âm, accuracy > 100 và giữ an toàn tuyệt đối', () => {
      const malformed: any = {
        id: 'bad_nums_sess',
        experienceMode: 'invalid_mode_xyz', // invalid mode
        skillScope: 'unknown_scope_abc', // invalid scope
        totalQuestions: -50, // số âm
        durationMinutes: NaN, // NaN
        listeningScore: 9999, // vượt trần 495
        analytics: {
          attemptId: 'bad_nums_sess',
          overall: {
            accuracy: 999, // vượt 100
            completionRate: -20, // âm
            timeSpentSeconds: NaN,
            totalItems: -10,
          },
          bySkill: {
            speaking: {
              skill: 'speaking',
              accuracy: null, // speaking open-ended: accuracy must be null
              questionsSeen: 1,
            },
            listening: {
              skill: 'listening',
              accuracy: 150, // vượt 100 -> clamped to 100
              questionsSeen: 5,
            },
          },
        },
      };

      const clean = sanitizeSessionForPersistence(malformed);
      expect(clean).not.toBeNull();
      expect(clean?.experienceMode).toBe('practice'); // fallback
      expect(clean?.skillScope).toBe('2-skills'); // fallback
      expect(clean?.totalQuestions).toBe(0); // clamped min 0
      expect(clean?.durationMinutes).toBe(15); // fallback default
      expect(clean?.listeningScore).toBe(495); // clamped max 495
      expect(clean?.analytics?.overall.accuracy).toBe(100); // clamped max 100
      expect(clean?.analytics?.overall.completionRate).toBe(0); // clamped min 0
      expect(clean?.analytics?.overall.timeSpentSeconds).toBe(0); // NaN -> 0
      expect(clean?.analytics?.bySkill?.speaking.accuracy).toBeNull(); // speaking giữ nguyên null
      expect(clean?.analytics?.bySkill?.listening.accuracy).toBe(100); // clamped max 100
    });
  });
});
