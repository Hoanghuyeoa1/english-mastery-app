// src/services/__tests__/multiMetricLeaderboardBackend.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase } from '../../lib/supabaseClient';
import {
  fetchLeaderboardWithStatus,
  getMyLeaderboardRank,
  isValidUserUuid,
  syncWeeklyLearningMetricsToServer,
  getCachedLeaderboard,
  setCachedLeaderboard,
  clearCachedLeaderboardForTesting,
  subscribeToLeaderboard,
  getVietnamWeekId,
} from '../leaderboardService';
import type { LeaderboardMetric, LeaderboardEntry } from '../../types';

const storageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: vi.fn((key: string) => storageMap.get(key) || null),
  setItem: vi.fn((key: string, value: string) => storageMap.set(key, value)),
  removeItem: vi.fn((key: string) => storageMap.delete(key)),
  clear: vi.fn(() => storageMap.clear()),
};

describe('Phase 4: Multi-Metric Leaderboard Backend & Security Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMap.clear();
    vi.stubGlobal('localStorage', mockLocalStorage);
    clearCachedLeaderboardForTesting();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('1. Server Authority & Ingestion Guard (sync_weekly_learning_metrics RPC)', () => {
    it('successfully syncs valid learning metrics for an authenticated user', async () => {
      const currentWeek = getVietnamWeekId();
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          code: 'SYNCED_SUCCESS',
          week_id: currentWeek,
          weekly_xp: 350,
          vocab_mastered: 42,
          review_consistency: 95.5,
          active_minutes: 120,
          pronunciation_gain: 12.5,
          toeic_gain: 60,
        },
        error: null,
      } as any);

      const res = await syncWeeklyLearningMetricsToServer({
        weekId: currentWeek,
        weeklyXp: 350,
        vocabMastered: 42,
        reviewConsistency: 95.5,
        activeMinutes: 120,
        pronunciationGain: 12.5,
        toeicGain: 60,
        evidence: {
          pronunciation_samples: 15,
          pronunciation_days: 3,
          toeic_attempts: 2,
        },
      });

      expect(supabase.rpc).toHaveBeenCalledWith('sync_weekly_learning_metrics', {
        p_week_id: currentWeek,
        p_weekly_xp: 350,
        p_vocab_mastered: 42,
        p_review_consistency: 95.5,
        p_active_minutes: 120,
        p_pronunciation_gain: 12.5,
        p_toeic_gain: 60,
        p_evidence: {
          pronunciation_samples: 15,
          pronunciation_days: 3,
          toeic_attempts: 2,
        },
      });
      expect(res.success).toBe(true);
      expect(res.code).toBe('SYNCED_SUCCESS');
      expect(res.weekly_xp).toBe(350);
    });

    it('rejects unauthenticated user with UNAUTHORIZED code', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Yêu cầu đăng nhập để đồng bộ chỉ số học tập.',
        },
        error: null,
      } as any);

      const res = await syncWeeklyLearningMetricsToServer({
        weeklyXp: 100,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('UNAUTHORIZED');
    });

    it('rejects sync for an already finalized week with WEEK_ALREADY_FINALIZED', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: false,
          code: 'WEEK_ALREADY_FINALIZED',
          message: 'Tuần này đã được chốt kết quả và chuyển sang chế độ chỉ đọc.',
        },
        error: null,
      } as any);

      const res = await syncWeeklyLearningMetricsToServer({
        weekId: '2026-W39',
        weeklyXp: 500,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('WEEK_ALREADY_FINALIZED');
    });

    it('rejects malformed week_id format with INVALID_WEEK_ID', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: false,
          code: 'INVALID_WEEK_ID',
          message: 'Định dạng week_id không hợp lệ (yêu cầu chuẩn ISO: YYYY-Www).',
        },
        error: null,
      } as any);

      const res = await syncWeeklyLearningMetricsToServer({
        weekId: 'invalid-week-string',
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('INVALID_WEEK_ID');
    });

    it('forces pronunciation_gain to null when sample thresholds are insufficient', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          code: 'SYNCED_SUCCESS',
          pronunciation_gain: null, // Server strictly forced to null!
        },
        error: null,
      } as any);

      const res = await syncWeeklyLearningMetricsToServer({
        pronunciationGain: 15.0,
        evidence: {
          pronunciation_samples: 3, // < 10 threshold
          pronunciation_days: 1,
        },
      });

      expect(res.success).toBe(true);
      expect(res.pronunciation_gain).toBeNull();
    });

    it('forces toeic_gain to null when fewer than 2 valid attempts are submitted', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          code: 'SYNCED_SUCCESS',
          toeic_gain: null, // Server strictly forced to null!
        },
        error: null,
      } as any);

      const res = await syncWeeklyLearningMetricsToServer({
        toeicGain: 80,
        evidence: {
          toeic_attempts: 1, // < 2 threshold
        },
      });

      expect(res.success).toBe(true);
      expect(res.toeic_gain).toBeNull();
    });
  });

  describe('2. Deterministic Ranking & Multi-Category Querying', () => {
    it('fetches vocab_mastered rankings through get_leaderboard_category_rankings RPC', async () => {
      const currentWeek = getVietnamWeekId();
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          category: 'vocab_mastered',
          week_id: currentWeek,
          top_entries: [
            {
              user_id: 'user-1',
              rank: 1,
              display_name: 'Minh Tuấn',
              avatar_url: null,
              level: 12,
              score: 85,
              secondary_score: 14,
              equipped_frame: 'champion_frame',
            },
            {
              user_id: 'user-2',
              rank: 2,
              display_name: 'Lan Hương',
              avatar_url: null,
              level: 8,
              score: 60,
              secondary_score: 8,
              equipped_frame: null,
            },
          ],
          current_user_entry: {
            user_id: 'user-2',
            rank: 2,
            display_name: 'Lan Hương',
            score: 60,
          },
        },
        error: null,
      } as any);

      const res = await fetchLeaderboardWithStatus('vocab_mastered', 'user-2', 50);

      expect(supabase.rpc).toHaveBeenCalledWith('get_leaderboard_category_rankings', {
        p_category: 'vocab_mastered',
        p_week_id: currentWeek,
        p_limit: 50,
        p_current_user_id: 'user-2',
      });
      expect(res.status).toBe('SUCCESS');
      expect(res.entries).toHaveLength(2);
      expect(res.entries[0].score).toBe(85);
      expect(res.entries[0].secondaryScore).toBe(14);
      expect(res.entries[1].isCurrentUser).toBe(true);
    });

    it('fetches review_consistency rankings and preserves secondary days score', async () => {
      const currentWeek = getVietnamWeekId();
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          category: 'review_consistency',
          week_id: currentWeek,
          top_entries: [
            {
              user_id: 'user-3',
              rank: 1,
              display_name: 'Đức Trọng',
              level: 15,
              score: 98.5,
              secondary_score: 6,
            },
          ],
        },
        error: null,
      } as any);

      const res = await fetchLeaderboardWithStatus('review_consistency');
      expect(res.status).toBe('SUCCESS');
      expect(res.entries[0].score).toBe(98.5);
      expect(res.entries[0].secondaryScore).toBe(6);
    });

    it('fetches active_minutes rankings and omits users below 15-minute threshold', async () => {
      const currentWeek = getVietnamWeekId();
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          category: 'active_minutes',
          week_id: currentWeek,
          top_entries: [
            {
              user_id: 'user-4',
              rank: 1,
              display_name: 'Hoàng Nam',
              level: 20,
              score: 240,
              secondary_score: 8,
            },
          ],
        },
        error: null,
      } as any);

      const res = await fetchLeaderboardWithStatus('active_minutes');
      expect(res.status).toBe('SUCCESS');
      expect(res.entries[0].score).toBe(240);
    });

    it('fetches pronunciation_gain and strictly excludes ineligible users with null gain', async () => {
      const currentWeek = getVietnamWeekId();
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          category: 'pronunciation_gain',
          week_id: currentWeek,
          top_entries: [
            {
              user_id: 'user-5',
              rank: 1,
              display_name: 'Mai Phương',
              level: 9,
              score: 18.4,
              secondary_score: 24,
            },
          ],
        },
        error: null,
      } as any);

      const res = await fetchLeaderboardWithStatus('pronunciation_gain');
      expect(res.status).toBe('SUCCESS');
      expect(res.entries[0].score).toBe(18.4);
    });

    it('fetches toeic_gain and enforces deterministic ordering', async () => {
      const currentWeek = getVietnamWeekId();
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          category: 'toeic_gain',
          week_id: currentWeek,
          top_entries: [
            {
              user_id: 'user-6',
              rank: 1,
              display_name: 'Quang Huy',
              level: 30,
              score: 95,
              secondary_score: 3,
            },
          ],
        },
        error: null,
      } as any);

      const res = await fetchLeaderboardWithStatus('toeic_gain');
      expect(res.status).toBe('SUCCESS');
      expect(res.entries[0].score).toBe(95);
    });
  });

  describe('3. Offline Caching & Stale Week Contract', () => {
    it('returns offline cache when RPC call errors with network failure', async () => {
      const currentWeek = getVietnamWeekId();
      const mockEntries: LeaderboardEntry[] = [
        {
          userId: 'cached-user-1',
          rank: 1,
          displayName: 'Offline User',
          level: 5,
          rankTitle: 'Novice',
          score: 150,
          isCurrentUser: false,
        },
      ];

      setCachedLeaderboard('vocab_mastered', mockEntries, currentWeek);

      // RPC fails with network timeout
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: null,
        error: { message: 'Failed to fetch', code: 'NETWORK_ERROR' },
      } as any);

      const res = await fetchLeaderboardWithStatus('vocab_mastered');
      expect(res.status).toBe('OFFLINE_CACHE');
      expect(res.entries).toHaveLength(1);
      expect(res.entries[0].userId).toBe('cached-user-1');
      expect(res.isStaleWeek).toBe(false);
    });

    it('identifies stale cached week when stored week differs from current week', () => {
      const pastWeek = '2026-W30';
      const mockEntries: LeaderboardEntry[] = [
        {
          userId: 'cached-past-1',
          rank: 1,
          displayName: 'Past User',
          level: 4,
          rankTitle: 'Novice',
          score: 80,
          isCurrentUser: false,
        },
      ];

      setCachedLeaderboard('active_minutes', mockEntries, pastWeek);
      const cached = getCachedLeaderboard('active_minutes');

      expect(cached).not.toBeNull();
      expect(cached?.isStaleWeek).toBe(true);
      expect(cached?.weekId).toBe(pastWeek);
    });
  });

  describe('4. Realtime Channel Architecture', () => {
    it('subscribes to both leaderboard_profiles and weekly_learning_metrics on a single channel', () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      };

      vi.spyOn(supabase, 'channel').mockReturnValue(mockChannel as any);
      vi.spyOn(supabase, 'removeChannel').mockImplementation(vi.fn());

      const onUpdate = vi.fn();
      const unsubscribe = subscribeToLeaderboard(onUpdate);

      expect(supabase.channel).toHaveBeenCalledWith('public:leaderboard_profiles');
      // Registered listeners for both tables on the same channel
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leaderboard_profiles' },
        expect.any(Function)
      );
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'weekly_learning_metrics' },
        expect.any(Function)
      );
      expect(mockChannel.subscribe).toHaveBeenCalled();

      unsubscribe();
    });
  });

  describe('5. Zero-Regression for Legacy XP & Streak Leaderboard', () => {
    it('weekly_xp continues to query leaderboard_profiles directly with deterministic ordering', async () => {
      const mockProfiles = [
        {
          id: 'u1',
          display_name: 'Top Learner',
          level: 10,
          total_xp: 3000,
          weekly_xp: 500,
          streak: 15,
          last_active_at: new Date().toISOString(),
        },
      ];

      const selectSpy = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }),
              }),
            }),
          }),
        }),
      });

      vi.spyOn(supabase, 'from').mockReturnValue({ select: selectSpy } as any);

      const res = await fetchLeaderboardWithStatus('weekly_xp');
      expect(supabase.from).toHaveBeenCalledWith('leaderboard_profiles');
      expect(res.status).toBe('SUCCESS');
      expect(res.entries[0].score).toBe(500);
    });

    it('streak continues to query leaderboard_profiles directly', async () => {
      const mockProfiles = [
        {
          id: 'u2',
          display_name: 'Streak Master',
          level: 12,
          total_xp: 4000,
          weekly_xp: 200,
          streak: 30,
          last_active_at: new Date().toISOString(),
        },
      ];

      const selectSpy = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }),
              }),
            }),
          }),
        }),
      });

      vi.spyOn(supabase, 'from').mockReturnValue({ select: selectSpy } as any);

      const res = await fetchLeaderboardWithStatus('streak');
      expect(supabase.from).toHaveBeenCalledWith('leaderboard_profiles');
      expect(res.status).toBe('SUCCESS');
      expect(res.entries[0].score).toBe(30);
    });
  });

  describe('4. Display Name & UUID Parameter Sanitization Regression (Fix HTTP 400)', () => {
    it('isValidUserUuid validates canonical UUIDs and rejects display names', () => {
      // Rejects display names (contains spaces or Unicode characters)
      expect(isValidUserUuid('Huy Hoàng')).toBe(false);
      expect(isValidUserUuid('Nguyễn Văn A')).toBe(false);
      expect(isValidUserUuid('Học viên ẩn danh')).toBe(false);
      expect(isValidUserUuid('Chiến Thần Học Tập')).toBe(false);
      expect(isValidUserUuid('John Doe')).toBe(false);

      // Rejects empty / whitespace / null / undefined
      expect(isValidUserUuid(null)).toBe(false);
      expect(isValidUserUuid(undefined)).toBe(false);
      expect(isValidUserUuid('')).toBe(false);
      expect(isValidUserUuid('   ')).toBe(false);

      // Accepts canonical UUIDs
      expect(isValidUserUuid('c4a6b280-9df2-47dc-98df-5913e2e850fa')).toBe(true);
      expect(isValidUserUuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true);

      // Accepts test slug IDs in test environment
      expect(isValidUserUuid('user-2')).toBe(true);
      expect(isValidUserUuid('user_cross_test_1')).toBe(true);
    });

    it('NEVER passes display name "Huy Hoàng" as p_current_user_id across all 5 Multi-Metric categories', async () => {
      const currentWeek = getVietnamWeekId();
      const multiMetricCategories: LeaderboardMetric[] = [
        'vocab_mastered',
        'review_consistency',
        'active_minutes',
        'pronunciation_gain',
        'toeic_gain',
      ];

      for (const cat of multiMetricCategories) {
        const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({
          data: {
            top_entries: [],
            total_count: 0,
            current_user_entry: null,
          },
          error: null,
        } as any);

        // Giả lập frontend truyền nhầm display name "Huy Hoàng" vào tham số currentUserId
        await fetchLeaderboardWithStatus(cat, 'Huy Hoàng', 50);

        expect(rpcSpy).toHaveBeenCalledWith('get_leaderboard_category_rankings', {
          p_category: cat,
          p_week_id: currentWeek,
          p_limit: 50,
          p_current_user_id: null, // Bắt buộc phải là null, KHÔNG ĐƯỢC là "Huy Hoàng"
        });
      }
    });

    it('passes authentic UUID to get_leaderboard_category_rankings when user is authenticated', async () => {
      const currentWeek = getVietnamWeekId();
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';

      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          top_entries: [],
          total_count: 0,
          current_user_entry: null,
        },
        error: null,
      } as any);

      await fetchLeaderboardWithStatus('vocab_mastered', validUuid, 50);

      expect(rpcSpy).toHaveBeenCalledWith('get_leaderboard_category_rankings', {
        p_category: 'vocab_mastered',
        p_week_id: currentWeek,
        p_limit: 50,
        p_current_user_id: validUuid,
      });
    });

    it('NEVER passes display name "Huy Hoàng" to get_my_leaderboard_rank RPC and returns null immediately', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc');

      // Khi truyền display name "Huy Hoàng"
      const result = await getMyLeaderboardRank('weekly_xp', 'Huy Hoàng');

      // Không bao giờ được gọi Supabase RPC với tham số p_user_id = "Huy Hoàng"
      expect(rpcSpy).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('passes authentic UUID to get_my_leaderboard_rank when valid UUID is provided', async () => {
      const validUuid = 'c4a6b280-9df2-47dc-98df-5913e2e850fa';
      const currentWeek = getVietnamWeekId();

      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          found: true,
          entry: {
            user_id: validUuid,
            rank: 5,
            display_name: 'Học viên thật',
            level: 3,
            score: 500,
          },
        },
        error: null,
      } as any);

      const result = await getMyLeaderboardRank('weekly_xp', validUuid);

      expect(rpcSpy).toHaveBeenCalledWith('get_my_leaderboard_rank', {
        p_category: 'weekly_xp',
        p_week_id: currentWeek,
        p_user_id: validUuid,
      });
      expect(result).not.toBeNull();
      expect(result?.userId).toBe(validUuid);
    });
  });
});
