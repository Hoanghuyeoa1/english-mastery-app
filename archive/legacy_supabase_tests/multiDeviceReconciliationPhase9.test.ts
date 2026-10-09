// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import { localOutbox } from '../localOutboxService';
import {
  setEventSyncConfig,
  resetEventSyncConfigForTesting,
  useCloudSyncStore,
  clearSyncCoordinatorForTesting,
  performFullSync,
} from '../cloudSyncService';
import { mergeResumeActivities } from '../learningContinuityService';
import { supabase } from '../../lib/supabaseClient';
import type { ResumableActivity, VocabWord } from '../../types';

describe('PHASE 9 — Multi-Device Conflict Handling, Reconciliation & Hybrid Snapshot Safety', () => {
  const testUserId = 'user_phase9_sync_matrix_uuid';
  const today = new Date().toISOString().split('T')[0];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    clearSyncCoordinatorForTesting();
    localOutbox.clear();
    resetEventSyncConfigForTesting();

    // Enable all 4 migrated domains
    setEventSyncConfig({
      enabled: true,
      batchSize: 50,
      maxConsecutiveBatches: 3,
      migratedDomains: {
        flashcardReview: true,
        learnWord: true,
        completeQuiz: true,
        mistakeCreated: true,
      },
    });

    // Cloud Sync Store setup
    useCloudSyncStore.setState({
      status: 'idle',
      lastSyncedAt: null,
      errorMessage: null,
      user: { id: testUserId, email: 'syncmatrix@example.com' } as any,
      userId: testUserId,
      userEmail: 'syncmatrix@example.com',
      isOnline: true,
    });

    // App Store reset
    useAppStore.getState().resetToDefault();
    useAppStore.setState({
      profile: {
        ...useAppStore.getState().profile,
        xp: 200,
        level: 2,
        streak: 3,
      },
      srsProgressMap: {},
      userCustomWords: [],
      userCollocations: [],
      mistakeBank: {},
      dailyHistory: {
        [today]: {
          date: today,
          wordsReviewed: 0,
          newWordsLearned: 0,
          quizzesCompleted: 0,
          pronunciationsMastered: 0,
          xpGained: 0,
        },
      },
      completedQuizSessionIds: [],
      processedXpKeys: [],
      processedMistakeKeys: [],
      resumeActivities: {},
      vocabularyList: [
        {
          id: 'card_resilient',
          word: 'resilient',
          meaning: 'kiên cường',
          tag: 'Daily',
          srsLevel: 1,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: today,
        } as any,
        {
          id: 'card_serendipity',
          word: 'serendipity',
          meaning: 'sự tình cờ may mắn',
          tag: 'Daily',
          srsLevel: 0,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: today,
        } as any,
      ],
    });
  });

  afterEach(() => {
    localOutbox.clear();
    resetEventSyncConfigForTesting();
    clearSyncCoordinatorForTesting();
  });

  // ==========================================================================
  // 1. PRIMARY SCENARIO: DEVICE A OFFLINE, DEVICE B ONLINE, A RECONNECTS
  // ==========================================================================
  describe('1. Primary Scenario: Device A Offline, Device B Online, Reconnect & Full Sync', () => {
    it('Device A offline tạo events, Device B online tạo events, Device A reconnect gộp state toàn vẹn không mất dữ liệu', async () => {
      // -------------------------------------------------------------
      // GIAI ĐOẠN 1: Device B Online (Học từ mới, ôn bài, hoàn thành quiz)
      // Giả lập trạng thái sau khi Device B sync lên Cloud Database
      // -------------------------------------------------------------
      const cloudDatabaseState = {
        srsProgress: [
          // B ôn card_resilient lên mức cao hơn: srsLevel 3, interval 6
          {
            word_id: 'card_resilient',
            repetition: 3,
            interval: 6,
            ease_factor: 2.6,
            next_review_date: '2026-10-15T00:00:00.000Z',
            last_reviewed_date: today,
          },
          // B học từ mới: meticulous
          {
            word_id: 'word_meticulous',
            repetition: 1,
            interval: 1,
            ease_factor: 2.5,
            next_review_date: '2026-10-08T00:00:00.000Z',
            last_reviewed_date: today,
          },
        ],
        dailyLog: {
          date: today,
          quizzes_completed: 1, // B làm xong 1 quiz
          words_learned: 1,
          xp_earned: 80,
        },
        profile: {
          id: testUserId,
          xp: 280,
          level: 2,
          streak: 3,
        },
      };

      // -------------------------------------------------------------
      // GIAI ĐOẠN 2: Device A Offline (Tạo mutations và events cục bộ)
      // -------------------------------------------------------------
      useCloudSyncStore.setState({ isOnline: false });

      // A ôn card_serendipity lên mức 2, interval 3
      useAppStore.getState().processReview('card_serendipity', 2);
      // A ôn card_resilient nhưng chỉ bấm Again (srsLevel 0)
      useAppStore.getState().processReview('card_resilient', 0);
      // A hoàn thành quiz A
      useAppStore.getState().recordQuizCompleted(20, true, {
        quizId: 'quiz_device_A_session',
        quizType: 'word_match',
        totalQuestions: 5,
        correctCount: 5,
        score: 100,
      });

      // Kiểm tra Device A Outbox chứa các events đang chờ flush
      expect(localOutbox.getPendingCount()).toBeGreaterThanOrEqual(3);
      const pendingEvents = localOutbox.getAllEntries().map((e) => e.event.eventType);
      expect(pendingEvents).toContain('review_card');
      expect(pendingEvents).toContain('complete_quiz');
      expect(pendingEvents).toContain('mistake_created'); // do grade 0 sinh mistake

      // -------------------------------------------------------------
      // GIAI ĐOẠN 3: Device A Reconnect (Có mạng trở lại & Sync)
      // -------------------------------------------------------------
      useCloudSyncStore.setState({ isOnline: true });

      // Giả lập Server RPC Ingestion chấp nhận các events từ Device A
      vi.spyOn(supabase, 'rpc').mockImplementation((rpcName: string, params: any) => {
        if (rpcName === 'ingest_learning_events') {
          const events = params.p_events || [];
          return Promise.resolve({
            data: {
              success: true,
              received_count: events.length,
              applied_count: events.length,
              duplicate_count: 0,
              rejected_count: 0,
              server_now: new Date().toISOString(),
              results: events.map((ev: any) => ({
                event_id: ev.eventId || ev.event_id,
                status: 'applied',
                code: 'EVENT_APPLIED',
              })),
            },
            error: null,
          }) as any;
        }
        return Promise.resolve({ data: null, error: null }) as any;
      });

      // Giả lập Mock query bảng Supabase khi Pull Snapshot
      vi.spyOn(supabase, 'from').mockImplementation((tableName: string) => {
        return {
          select: () => ({
            eq: () => {
              let resData: any = [];
              if (tableName === 'profiles') {
                resData = cloudDatabaseState.profile;
              } else if (tableName === 'user_srs_progress') {
                resData = cloudDatabaseState.srsProgress;
              } else if (tableName === 'daily_logs') {
                resData = [cloudDatabaseState.dailyLog];
              }
              const p = Promise.resolve({ data: resData, error: null });
              (p as any).maybeSingle = () => Promise.resolve({ data: cloudDatabaseState.profile, error: null });
              return p;
            },
            maybeSingle: () => Promise.resolve({ data: cloudDatabaseState.profile, error: null }),
          }),
          upsert: () => Promise.resolve({ data: null, error: null }),
        } as any;
      });

      // Chạy Full Sync tích hợp: Flush Outbox -> Pull Snapshot -> Merge Local
      const syncResult = await performFullSync();
      expect(syncResult.success).toBe(true);

      // 1. Outbox của Device A đã được ACK hoàn toàn và dọn sạch
      expect(localOutbox.getPendingCount()).toBe(0);

      // 2. Entity Conflict Resolution: Thẻ card_resilient
      // Device B có srsLevel 3, interval 6 (cao hơn Again srsLevel 0 của A)
      // Monotonic Rule: Tiến trình cao hơn của B THẮNG, không bị thụt lùi
      const resilientProg = useAppStore.getState().srsProgressMap['card_resilient'];
      expect(resilientProg.srsLevel).toBe(3);
      expect(resilientProg.interval).toBe(6);

      // 3. Commutative Card: Thẻ card_serendipity chỉ A ôn
      // Vẫn giữ nguyên tiến trình của A
      const serendipityProg = useAppStore.getState().srsProgressMap['card_serendipity'];
      expect(serendipityProg.srsLevel).toBeGreaterThan(0);

      // 4. Commutative Word: Từ word_meticulous do B học được nạp vào A qua snapshot
      const meticulousProg = useAppStore.getState().srsProgressMap['word_meticulous'];
      expect(meticulousProg).toBeDefined();
      expect(meticulousProg.srsLevel).toBe(1);

      // 5. Monotonic Quizzes Completed:
      // A làm 1 quiz, Cloud có 1 quiz từ B -> Math.max hoặc merge không bị trừ lùi
      expect(useAppStore.getState().dailyHistory[today]?.quizzesCompleted).toBeGreaterThanOrEqual(1);

      // 6. Monotonic XP: A đã được cộng 20 XP, Cloud có 280 -> Math.max(local, cloud) giữ mốc cao nhất
      expect(useAppStore.getState().profile.xp).toBeGreaterThanOrEqual(280);
    });
  });

  // ==========================================================================
  // 2. ENTITY-CONFLICTING POLICY: review_card ON MULTIPLE DEVICES
  // ==========================================================================
  describe('2. Entity-Conflicting Policy: Monotonic SRS Progress Win', () => {
    it('khi 2 thiết bị ôn cùng 1 thẻ, tiến trình cao hơn / tiến bộ hơn luôn thắng (không thụt lùi)', () => {
      // Local có thẻ ôn tập ở mức 3, interval 12
      useAppStore.setState({
        srsProgressMap: {
          card_resilient: {
            srsLevel: 3,
            interval: 12,
            easeFactor: 2.6,
            nextReviewDate: '2026-10-20T00:00:00.000Z',
            lastReviewedDate: today,
          },
        },
      });

      // Snapshot từ cloud đến mang bản ghi cũ hơn (srsLevel 1, interval 2) do thiết bị kia sync chậm
      useAppStore.getState().mergeCloudData({
        cloudSrsList: [
          {
            word_id: 'card_resilient',
            repetition: 1,
            interval: 2,
            ease_factor: 2.5,
            next_review_date: '2026-10-09T00:00:00.000Z',
          },
        ],
      });

      // Tiến trình cao hơn của local được bảo toàn
      const current = useAppStore.getState().srsProgressMap['card_resilient'];
      expect(current.srsLevel).toBe(3);
      expect(current.interval).toBe(12);
    });

    it('nếu cloud có tiến trình cao hơn (do ôn trên thiết bị khác tiến bộ hơn), local cập nhật theo cloud', () => {
      useAppStore.setState({
        srsProgressMap: {
          card_resilient: {
            srsLevel: 1,
            interval: 2,
            easeFactor: 2.5,
            nextReviewDate: '2026-10-09T00:00:00.000Z',
          },
        },
      });

      useAppStore.getState().mergeCloudData({
        cloudSrsList: [
          {
            word_id: 'card_resilient',
            repetition: 4,
            interval: 20,
            ease_factor: 2.7,
            next_review_date: '2026-11-01T00:00:00.000Z',
          },
        ],
      });

      const current = useAppStore.getState().srsProgressMap['card_resilient'];
      expect(current.srsLevel).toBe(4);
      expect(current.interval).toBe(20);
    });
  });

  // ==========================================================================
  // 3. COMMUTATIVE POLICY: learn_word MULTI-DEVICE UNION
  // ==========================================================================
  describe('3. Commutative Policy: learn_word Multi-Device Union', () => {
    it('hai thiết bị thêm từ khác nhau hoặc cùng thêm 1 từ từ nguồn khác nhau đều được kết hợp không mất dữ liệu', () => {
      // Local A đã lưu từ "epiphany" với nguồn reading
      useAppStore.getState().saveToSRS('epiphany', {
        contextSentence: 'A sudden epiphany struck him.',
        source: 'reading',
      });

      // Cloud Snapshot gửi về danh sách từ custom từ thiết bị B:
      // B đã lưu từ "meticulous" và cũng lưu từ "epiphany" từ nguồn dictionary
      useAppStore.getState().mergeCloudData({
        cloudCustomWords: [
          {
            id: 'word_meticulous',
            word: 'meticulous',
            meaning: 'tỉ mỉ',
            sources: ['dictionary'],
          } as VocabWord,
          {
            id: 'word_epiphany',
            word: 'epiphany',
            meaning: 'sự giác ngộ',
            sources: ['dictionary'],
          } as VocabWord,
        ],
      });

      // 1. Cả 2 từ đều có mặt trong danh sách từ vựng custom
      const customWords = useAppStore.getState().userCustomWords;
      const wordTexts = customWords.map((w) => w.word.toLowerCase());
      expect(wordTexts).toContain('epiphany');
      expect(wordTexts).toContain('meticulous');

      // 2. Nguồn của từ "epiphany" được gộp cả 2 nguồn: reading và dictionary
      const epiphanyWord = customWords.find((w) => w.word.toLowerCase() === 'epiphany');
      expect(epiphanyWord?.sources).toContain('reading');
      expect(epiphanyWord?.sources).toContain('dictionary');
    });
  });

  // ==========================================================================
  // 4. COMMUTATIVE & IDEMPOTENT: complete_quiz MULTI-DEVICE & REPLAY
  // ==========================================================================
  describe('4. Commutative & Idempotent: complete_quiz Multi-Device & Replay Guard', () => {
    it('mỗi quiz session có stable identity: hoàn thành quiz trên 2 thiết bị khác nhau được tích lũy đúng đắn', () => {
      // Device A hoàn thành quiz 1
      useAppStore.getState().recordQuizCompleted(15, true, {
        quizId: 'quiz_device_A_turn',
        quizType: 'word_match',
      });
      expect(useAppStore.getState().dailyHistory[today]?.quizzesCompleted).toBe(1);

      // Cloud gửi snapshot với quiz đã hoàn thành trên Device B (quizzes_completed = 2)
      useAppStore.getState().mergeCloudData({
        cloudDailyLogs: [
          {
            date: today,
            quizzes_completed: 2,
            words_learned: 3,
            xp_earned: 50,
          },
        ],
      });

      // Snapshot đối chiếu dùng Math.max: tổng số quiz thành 2
      expect(useAppStore.getState().dailyHistory[today]?.quizzesCompleted).toBe(2);

      // Thử submit lại quiz 1 của Device A (replay / double click)
      const replayRes = useAppStore.getState().recordQuizCompleted(15, true, {
        quizId: 'quiz_device_A_turn',
      });
      expect((replayRes as any).alreadyCompleted).toBe(true);

      // Không tăng lên 3
      expect(useAppStore.getState().dailyHistory[today]?.quizzesCompleted).toBe(2);
    });
  });

  // ==========================================================================
  // 5. EVIDENCE-BASED MISTAKE: MULTI-DEVICE MERGE & DEDUPLICATION
  // ==========================================================================
  describe('5. Evidence-Based Mistake: Multi-Device Merge & Deduplication', () => {
    it('hai thiết bị gặp lỗi khác nhau trên cùng một từ được gộp typeCounts và sourceCounts', () => {
      // Thiết bị A gặp lỗi nghĩa
      useAppStore.getState().recordMistake(
        { id: 'vocab_resilient', word: 'resilient', meaning: 'kiên cường' },
        'classic_quiz',
        { type: 'meaning' }
      );

      // Cloud Snapshot gửi về lỗi từ Thiết bị B gặp lỗi chính tả trên từ đó
      useAppStore.getState().mergeCloudData({
        cloudMistakes: [
          {
            id: 'vocab_resilient',
            word: 'resilient',
            meaning: 'kiên cường',
            mistakeCount: 1,
            wrongCount: 1,
            source: 'dictation',
            typeCounts: { spelling: 1 },
            sourceCounts: { dictation: 1 },
            resolved: false,
            lastMistakeAt: new Date().toISOString(),
            consecutiveCorrect: 0,
          },
        ],
      });

      const mistake = useAppStore.getState().mistakeBank['vocab_resilient'];
      expect(mistake).toBeDefined();
      expect(mistake.typeCounts?.meaning).toBe(1);
      expect(mistake.typeCounts?.spelling).toBe(1);
      expect(mistake.sourceCounts?.classic_quiz).toBe(1);
      expect(mistake.sourceCounts?.dictation).toBe(1);
    });
  });

  // ==========================================================================
  // 6. INVARIANT: COMPLETED ALWAYS WINS OVER STALE INCOMPLETE
  // ==========================================================================
  describe('6. Invariant: Completed Always Wins Over Stale Incomplete', () => {
    it('mergeResumeActivities bảo vệ bài học đã hoàn thành không bị snapshot cũ hồi sinh thành incomplete', () => {
      const now = Date.now();
      const past = now - 3600000;

      // Local: bài đọc lesson_1 đã hoàn thành
      const localActivities: Record<string, ResumableActivity> = {
        reading_lesson_1: {
          id: 'reading_lesson_1',
          type: 'reading',
          title: 'Advanced Microservices',
          startedAt: past,
          lastActiveAt: now,
          completed: true,
          completedAt: now,
          schemaVersion: 1,
          checkpoint: {
            lessonId: 'lesson_1',
            answers: { q1: 1, q2: 2 },
            totalQuestions: 2,
          },
        },
      };

      // Remote: snapshot cũ vẫn đang dở dang (incomplete)
      const remoteActivities: Record<string, ResumableActivity> = {
        reading_lesson_1: {
          id: 'reading_lesson_1',
          type: 'reading',
          title: 'Advanced Microservices',
          startedAt: past,
          lastActiveAt: past + 1000,
          completed: false, // Incomplete snapshot cũ
          schemaVersion: 1,
          checkpoint: {
            lessonId: 'lesson_1',
            answers: { q1: 1 },
            totalQuestions: 2,
          },
        },
      };

      const merged = mergeResumeActivities(localActivities, remoteActivities, now);

      // Invariant: Completed Wins!
      expect(merged['reading_lesson_1']).toBeDefined();
      expect(merged['reading_lesson_1'].completed).toBe(true);
      expect(merged['reading_lesson_1'].completedAt).toBe(now);
    });

    it('nếu remote đã completed và local còn dở dang, completed của remote thắng', () => {
      const now = Date.now();
      const past = now - 3600000;

      const localActivities: Record<string, ResumableActivity> = {
        writing_prompt_1: {
          id: 'writing_prompt_1',
          type: 'writing',
          title: 'Technology Essay',
          startedAt: past,
          lastActiveAt: past + 500,
          completed: false,
          schemaVersion: 1,
          checkpoint: {
            promptId: 'p1',
            draft: 'Initial essay draft...',
            wordCount: 150,
          },
        },
      };

      const remoteActivities: Record<string, ResumableActivity> = {
        writing_prompt_1: {
          id: 'writing_prompt_1',
          type: 'writing',
          title: 'Technology Essay',
          startedAt: past,
          lastActiveAt: now,
          completed: true,
          completedAt: now,
          schemaVersion: 1,
          checkpoint: {
            promptId: 'p1',
            draft: 'Completed essay final draft...',
            wordCount: 280,
          },
        },
      };

      const merged = mergeResumeActivities(localActivities, remoteActivities, now);
      expect(merged['writing_prompt_1'].completed).toBe(true);
      expect(merged['writing_prompt_1'].completedAt).toBe(now);
    });
  });

  // ==========================================================================
  // 7. RESOLVED MISTAKE DETERMINISTIC RECONCILIATION
  // ==========================================================================
  describe('7. Resolved Mistake Deterministic Protection', () => {
    it('lỗi đã resolved cục bộ không bị snapshot cloud chứa lỗi cũ hồi sinh', () => {
      const nowIso = new Date().toISOString();
      const earlierIso = new Date(Date.now() - 7200000).toISOString();

      useAppStore.setState({
        mistakeBank: {
          vocab_resilient: {
            id: 'vocab_resilient',
            word: 'resilient',
            meaning: 'kiên cường',
            mistakeCount: 2,
            wrongCount: 2,
            consecutiveCorrect: 2,
            resolved: true,
            resolvedDate: nowIso,
            lastMistakeAt: earlierIso,
            source: 'flashcard',
            primaryType: 'meaning',
            reopenCount: 0,
          } as any,
        },
      });

      // Snapshot từ cloud đến mang dữ liệu cũ (chưa giải quyết)
      useAppStore.getState().mergeCloudData({
        cloudMistakes: [
          {
            id: 'vocab_resilient',
            word: 'resilient',
            meaning: 'kiên cường',
            mistakeCount: 1,
            wrongCount: 1,
            resolved: false,
            lastMistakeAt: earlierIso,
            reopenCount: 0,
            consecutiveCorrect: 0,
          },
        ],
      });

      // Lỗi vẫn giữ resolved: true
      const mistake = useAppStore.getState().mistakeBank['vocab_resilient'];
      expect(mistake.resolved).toBe(true);
      expect(mistake.resolvedDate).toBe(nowIso);
    });
  });

  // ==========================================================================
  // 8. LEGACY USERS BOOTSTRAP & GRACEFUL PROGRESSION
  // ==========================================================================
  describe('8. Legacy Users Bootstrap & Graceful Upgrade', () => {
    it('người dùng cũ không có event history vẫn đăng nhập, nạp snapshot và học tập phát sinh event bình thường', async () => {
      // 1. Outbox hoàn toàn rỗng ban đầu (legacy user)
      expect(localOutbox.getTotalCount()).toBe(0);

      // 2. Giả lập nạp snapshot từ cloud khi người dùng cũ đăng nhập
      const legacyCloudData = {
        cloudProfile: {
          id: testUserId,
          display_name: 'Legacy Master',
          level: 5,
          xp: 1500,
          streak: 10,
        },
        cloudCustomWords: [
          {
            id: 'card_resilient',
            word: 'resilient',
            meaning: 'kiên cường',
            tag: 'Daily',
            srsLevel: 4,
            interval: 25,
            easeFactor: 2.7,
            nextReviewDate: '2026-11-01T00:00:00.000Z',
          } as VocabWord,
        ],
        cloudSrsList: [
          {
            word_id: 'card_resilient',
            repetition: 4,
            interval: 25,
            ease_factor: 2.7,
            next_review_date: '2026-11-01T00:00:00.000Z',
          },
        ],
        cloudDailyLogs: [
          {
            date: today,
            quizzes_completed: 3,
            words_learned: 10,
            xp_earned: 120,
          },
        ],
      };

      useAppStore.getState().mergeCloudData(legacyCloudData);

      // 3. Toàn bộ tiến trình cũ được khôi phục nguyên vẹn vào Zustand Store
      const state = useAppStore.getState();
      expect(state.profile.name).toBe('Legacy Master');
      expect(state.profile.level).toBe(7); // calculateLevelFromXp(1500) = 7
      expect(state.profile.xp).toBe(1500);
      expect(state.profile.streak).toBe(10);
      expect(state.srsProgressMap['card_resilient']?.srsLevel).toBe(4);
      expect(state.dailyHistory[today]?.quizzesCompleted).toBe(3);

      // 4. Khi người dùng cũ bắt đầu ôn bài mới -> hệ thống tạo event mượt mà mà không có lỗi
      useAppStore.getState().processReview('card_resilient', 3);

      // Outbox ghi nhận đúng 1 event đầu tiên cho người dùng
      expect(localOutbox.getPendingCount()).toBe(1);
      const firstEvent = localOutbox.getAllEntries()[0].event;
      expect(firstEvent.eventType).toBe('review_card');
      expect(firstEvent.entityId).toBe('card_resilient');
    });
  });
});
