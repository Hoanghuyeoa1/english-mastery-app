// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { supabase } from '../../lib/supabaseClient';
import {
  useCloudSyncStore,
  pushLocalToCloud,
  setActiveSyncedUserId,
} from '../cloudSyncService';
import {
  deriveLeaderboardLearningMetrics,
  syncDerivedLearningMetrics,
  savePronunciationAttempt,
  clearPronunciationAttemptsForTesting,
  type PronunciationEvidenceItem,
} from '../leaderboardLearningMetrics';
import {
  getAuthoritativeVietnamWeekId,
  getVietnamWeekStart,
  getVietnamWeekEnd,
} from '../leaderboardService';
import { useAppStore } from '../../store/useAppStore';

describe('PHASE 5 — Shared Quality-Metric Derivation & Cloud Synchronization Foundation', () => {
  const testUserId = '55555555-5555-4555-8555-555555555555';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearPronunciationAttemptsForTesting();
    setActiveSyncedUserId(null);
    useAppStore.getState().resetToDefault();
    useCloudSyncStore.setState({
      user: { id: testUserId, email: 'quality@example.com' } as any,
      userId: testUserId,
      userEmail: 'quality@example.com',
      session: null,
      isOnline: true,
      status: 'idle',
      errorMessage: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Fresh-State Derivation Engine', () => {
    it('deriveLeaderboardLearningMetrics tính toán chính xác cả 5 quality metrics từ domain state thật', () => {
      const today = new Date().toISOString().split('T')[0];

      // Setup state với các bằng chứng học tập cụ thể:
      useAppStore.setState((s) => ({
        ...s,
        srsProgressMap: {
          achieve: { srsLevel: 5, interval: 25, easeFactor: 2.5, nextReviewDate: today, reviewCount: 3, lastReviewedDate: today },
          resilient: { srsLevel: 4, interval: 22, easeFactor: 2.5, nextReviewDate: today, reviewCount: 3, lastReviewedDate: today },
        },
        dailyHistory: {
          [today]: {
            date: today,
            wordsReviewed: 2,
            newWordsLearned: 1,
            quizzesCompleted: 1,
            pronunciationsMastered: 1,
            xpGained: 40,
          },
        },
      }));

      const derived = deriveLeaderboardLearningMetrics(useAppStore.getState(), { userId: testUserId });

      expect(derived.weekId).toMatch(/^\d{4}-W\d{2}$/);
      expect(derived.weeklyXp).toBe(40);
      expect(derived.vocabMastered).toBe(2); // 2 từ có srsLevel >= 4 & interval >= 21
      expect(derived.eligibility.vocab).toBe(true);
      expect(derived.evidence).toBeDefined();
    });

    it('không dùng stale snapshot: cập nhật state ngay lập tức phản ánh trong derivation mới', () => {
      const state1 = useAppStore.getState();
      const derived1 = deriveLeaderboardLearningMetrics(state1);
      expect(derived1.weeklyXp).toBe(0);

      // Thêm hoạt động học tập mới vào store
      useAppStore.getState().gainXP(50);
      const state2 = useAppStore.getState();
      const derived2 = deriveLeaderboardLearningMetrics(state2);

      expect(derived2.weeklyXp).toBe(50);
      expect(derived2.weeklyXp).not.toBe(derived1.weeklyXp);
    });
  });

  describe('2. Eligibility Normalization (Preserving Null vs 0)', () => {
    it('khi metrics chưa đủ điều kiện xếp hạng, giữ giá trị null chứ không giả mạo thành 0', () => {
      // User chưa làm pronunciation, chưa thi TOEIC
      const derived = deriveLeaderboardLearningMetrics(useAppStore.getState());

      // Pronunciation: chưa có mẫu nào -> null, không phải 0
      expect(derived.pronunciationGain).toBeNull();
      expect(derived.eligibility.pronunciation).toBe(false);

      // TOEIC: chưa có bài thi nào -> null, không phải 0
      expect(derived.toeicGain).toBeNull();
      expect(derived.eligibility.toeic).toBe(false);

      // Review consistency: chưa có ngày ôn tập có lịch -> null
      expect(derived.reviewConsistency).toBeNull();
      expect(derived.eligibility.consistency).toBe(false);
    });

    it('khi đủ điều kiện mẫu hợp lệ, metrics trả về số điểm thật và eligibility: true', () => {
      const now = new Date();
      const day1 = new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString();
      const day2 = new Date(now.getTime() - 1 * 24 * 3600 * 1000).toISOString();

      // Giả lập 10 mẫu phát âm trên 2 ngày khác nhau
      const attempts: PronunciationEvidenceItem[] = [
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `att_baseline_${i}`,
          word: 'hello',
          score: 60,
          timestamp: day1,
          isTrusted: true,
          isFallback: false,
          recognizedText: 'hello',
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `att_recent_${i}`,
          word: 'world',
          score: 80,
          timestamp: day2,
          isTrusted: true,
          isFallback: false,
          recognizedText: 'world',
        })),
      ];

      // Giả lập 2 bài thi TOEIC hoàn chỉnh
      const toeicSessions = [
        {
          id: 'toeic_sess_1',
          title: 'ETS Test 1',
          date: day1,
          totalScore: 600,
          timeSpentSeconds: 300,
          experienceMode: 'mock',
          totalQuestions: 100,
          skillScope: '2skills',
        },
        {
          id: 'toeic_sess_2',
          title: 'ETS Test 2',
          date: day2,
          totalScore: 700,
          timeSpentSeconds: 300,
          experienceMode: 'mock',
          totalQuestions: 100,
          skillScope: '2skills',
        },
      ];

      const derived = deriveLeaderboardLearningMetrics(useAppStore.getState(), {
        pronunciationAttempts: attempts,
        toeicSessions,
      });

      expect(derived.eligibility.pronunciation).toBe(true);
      expect(derived.pronunciationGain).toBeGreaterThan(0); // baseline 60 -> recent 80 = +20

      expect(derived.eligibility.toeic).toBe(true);
      expect(derived.toeicGain).toBe(100); // 700 - 600 = +100
      expect(derived.evidence.toeic_attempts).toBe(2);
      expect(derived.evidence.pronunciation_samples).toBe(10);
    });
  });

  describe('3. First Weekly Row Creation & Update Existing Row', () => {
    it('syncDerivedLearningMetrics gọi RPC sync_weekly_learning_metrics với canonical week_id và toàn bộ 5 metrics', async () => {
      let rpcName = '';
      let rpcParams: any = null;

      vi.spyOn(supabase, 'rpc').mockImplementation(((name: string, params: any) => {
        rpcName = name;
        rpcParams = params;
        return Promise.resolve({
          data: {
            success: true,
            code: 'SYNCED_SUCCESS',
            week_id: params.p_week_id,
            weekly_xp: params.p_weekly_xp,
            vocab_mastered: params.p_vocab_mastered,
          },
          error: null,
        });
      }) as any);

      useAppStore.getState().gainXP(80);

      const res = await syncDerivedLearningMetrics(testUserId);

      expect(rpcName).toBe('sync_weekly_learning_metrics');
      expect(rpcParams.p_week_id).toBe(getAuthoritativeVietnamWeekId());
      expect(rpcParams.p_weekly_xp).toBe(80);
      expect(rpcParams.p_vocab_mastered).toBe(0);
      expect(rpcParams.p_evidence).toBeDefined();
      expect(res.success).toBe(true);
    });

    it('update existing row: cập nhật tiến độ tuần mới mà không bị crash hay sinh duplicate row', async () => {
      let callCount = 0;
      vi.spyOn(supabase, 'rpc').mockImplementation((() => {
        callCount++;
        return Promise.resolve({
          data: { success: true, code: 'SYNCED_SUCCESS' },
          error: null,
        });
      }) as any);

      await syncDerivedLearningMetrics(testUserId);
      expect(callCount).toBe(1);

      // Tiến trình học tiếp
      useAppStore.getState().gainXP(30);
      await syncDerivedLearningMetrics(testUserId);
      expect(callCount).toBe(2);
    });
  });

  describe('4. Local-First: Offline Resilience & Reconnect Reconciliation', () => {
    it('khi offline, syncDerivedLearningMetrics trả về mã OFFLINE không throw, giữ an toàn dữ liệu học', async () => {
      useCloudSyncStore.setState({ isOnline: false });

      const res = await syncDerivedLearningMetrics(testUserId);
      expect(res.success).toBe(false);
      expect(res.code).toBe('OFFLINE');
    });

    it('khi reconnect online, pushLocalToCloud tự động gọi syncDerivedLearningMetrics với dữ liệu mới nhất', async () => {
      useCloudSyncStore.setState({ isOnline: true });
      useAppStore.getState().gainXP(60);

      let rpcCalledWithXp = 0;
      vi.spyOn(supabase, 'rpc').mockImplementation(((name: string, params: any) => {
        if (name === 'sync_weekly_learning_metrics') {
          rpcCalledWithXp = params.p_weekly_xp;
          return Promise.resolve({ data: { success: true }, error: null });
        }
        if (name === 'sync_leaderboard_progress') {
          return Promise.resolve({ data: { success: true }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }) as any);

      vi.spyOn(supabase, 'from').mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      } as any);

      await pushLocalToCloud(testUserId);

      expect(rpcCalledWithXp).toBe(60);
    });
  });

  describe('5. Concurrency Coalescing & Unauthenticated Protection', () => {
    it('nhiều lời gọi syncDerivedLearningMetrics đồng thời được coalesced an toàn, không tạo xung đột network', async () => {
      let rpcInvocations = 0;
      vi.spyOn(supabase, 'rpc').mockImplementation((() => {
        rpcInvocations++;
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ data: { success: true, code: 'SYNCED_SUCCESS' }, error: null });
          }, 20);
        });
      }) as any);

      // Kích hoạt 4 lời gọi đồng thời
      const promises = [
        syncDerivedLearningMetrics(testUserId),
        syncDerivedLearningMetrics(testUserId),
        syncDerivedLearningMetrics(testUserId),
        syncDerivedLearningMetrics(testUserId),
      ];

      const results = await Promise.all(promises);

      // Toàn bộ 4 lời gọi đều thành công
      results.forEach((r) => expect(r.success).toBe(true));
      // Số lần invoke network được gộp (không bị nhân 4 lần)
      expect(rpcInvocations).toBeLessThanOrEqual(2);
    });

    it('từ chối đồng bộ khi người dùng chưa đăng nhập (UNAUTHORIZED)', async () => {
      useCloudSyncStore.setState({ user: null, userId: null });

      const res = await syncDerivedLearningMetrics(undefined);
      expect(res.success).toBe(false);
      expect(res.code).toBe('UNAUTHORIZED');
    });
  });
});
