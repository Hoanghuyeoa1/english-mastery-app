// @vitest-environment happy-dom
// src/services/__tests__/leaderboardReadPathPhase9.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { supabase } from '../../lib/supabaseClient';
import {
  fetchLeaderboardWithStatus,
  getMyLeaderboardRank,
  subscribeToLeaderboard,
  getAuthoritativeVietnamWeekId,
} from '../leaderboardService';
import {
  hasPendingCloudSync,
  flushPendingCloudSync,
  scheduleCloudSync,
  useCloudSyncStore,
} from '../cloudSyncService';
import { formatMetricScore, formatSecondaryScore } from '../../components/LeaderboardView';
import type { LeaderboardMetric } from '../../types';

describe('PHASE 9 — Leaderboard Read Path & Realtime Consistency', () => {
  const TEST_USER_ID = '11111111-1111-4111-8111-111111111111';
  const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
  const CURRENT_WEEK_ID = getAuthoritativeVietnamWeekId();

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();

    useCloudSyncStore.setState({
      isOnline: true,
      user: { id: TEST_USER_ID, email: 'hoang@example.com' } as any,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // ==========================================================================
  // SECTION 1: FIVE QUALITY CATEGORY RPC MAPPINGS
  // ==========================================================================
  describe('1. Quality Category RPC Mappings (get_leaderboard_category_rankings)', () => {
    it('vocab_mastered: map chính xác score, secondaryScore (vocab_transitions) và rank', async () => {
      const mockRpcResponse = {
        success: true,
        category: 'vocab_mastered',
        week_id: CURRENT_WEEK_ID,
        limit: 20,
        offset: 0,
        total_count: 2,
        top_entries: [
          {
            user_id: OTHER_USER_ID,
            display_name: 'Lan Anh',
            avatar_url: 'https://example.com/avatar1.png',
            level: 5,
            equipped_frame: 'champion_frame',
            score: 150,
            secondary_score: 25, // vocab_transitions
            updated_at: '2026-10-07T08:00:00Z',
            rank: 1,
          },
          {
            user_id: TEST_USER_ID,
            display_name: 'Huy Hoang',
            avatar_url: null,
            level: 3,
            equipped_frame: null,
            score: 80,
            secondary_score: 12,
            updated_at: '2026-10-07T09:00:00Z',
            rank: 2,
          },
        ],
        current_user_entry: {
          user_id: TEST_USER_ID,
          display_name: 'Huy Hoang',
          avatar_url: null,
          level: 3,
          equipped_frame: null,
          score: 80,
          secondary_score: 12,
          updated_at: '2026-10-07T09:00:00Z',
          rank: 2,
        },
      };

      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: mockRpcResponse,
        error: null,
      } as any);

      const result = await fetchLeaderboardWithStatus('vocab_mastered', TEST_USER_ID, 20, 0);

      expect(rpcSpy).toHaveBeenCalledWith('get_leaderboard_category_rankings', {
        p_category: 'vocab_mastered',
        p_week_id: CURRENT_WEEK_ID,
        p_limit: 20,
        p_current_user_id: TEST_USER_ID,
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.entries.length).toBe(2);
      expect(result.entries[0].score).toBe(150);
      expect(result.entries[0].secondaryScore).toBe(25);
      expect(result.entries[0].rank).toBe(1);
      expect(result.currentUserEntry).toBeDefined();
      expect(result.currentUserEntry?.rank).toBe(2);
      expect(result.currentUserEntry?.score).toBe(80);
      expect(result.currentUserEntry?.isCurrentUser).toBe(true);
    });

    it('review_consistency: map chính xác score (percentage) và secondaryScore (consistency_days)', async () => {
      const mockRpcResponse = {
        success: true,
        category: 'review_consistency',
        week_id: CURRENT_WEEK_ID,
        limit: 20,
        offset: 0,
        total_count: 1,
        top_entries: [
          {
            user_id: TEST_USER_ID,
            display_name: 'Huy Hoang',
            avatar_url: null,
            level: 4,
            score: 95.5,
            secondary_score: 5, // 5 ngày ôn tập
            updated_at: '2026-10-07T09:00:00Z',
            rank: 1,
          },
        ],
        current_user_entry: {
          user_id: TEST_USER_ID,
          display_name: 'Huy Hoang',
          score: 95.5,
          secondary_score: 5,
          level: 4,
          rank: 1,
        },
      };

      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: mockRpcResponse,
        error: null,
      } as any);

      const result = await fetchLeaderboardWithStatus('review_consistency', TEST_USER_ID);

      expect(result.entries[0].score).toBe(95.5);
      expect(result.entries[0].secondaryScore).toBe(5);
      expect(formatMetricScore(result.entries[0].score, 'review_consistency')).toBe('95.5%');
      expect(formatSecondaryScore(result.entries[0].secondaryScore, 'review_consistency')).toBe('5 ngày ôn');
    });

    it('active_minutes: map chính xác phút học và số phiên học', async () => {
      const mockRpcResponse = {
        success: true,
        category: 'active_minutes',
        week_id: CURRENT_WEEK_ID,
        limit: 20,
        offset: 0,
        total_count: 1,
        top_entries: [
          {
            user_id: TEST_USER_ID,
            display_name: 'Huy Hoang',
            level: 2,
            score: 120, // 120 phút
            secondary_score: 8, // 8 phiên
            rank: 1,
          },
        ],
        current_user_entry: null,
      };

      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: mockRpcResponse,
        error: null,
      } as any);

      const result = await fetchLeaderboardWithStatus('active_minutes', TEST_USER_ID);

      expect(result.entries[0].score).toBe(120);
      expect(result.entries[0].secondaryScore).toBe(8);
      expect(formatMetricScore(result.entries[0].score, 'active_minutes')).toBe('120 phút');
      expect(formatSecondaryScore(result.entries[0].secondaryScore, 'active_minutes')).toBe('8 phiên học');
    });

    it('pronunciation_gain: map chính xác điểm tiến bộ âm, 0 điểm và dương điểm', async () => {
      const mockRpcResponse = {
        success: true,
        category: 'pronunciation_gain',
        week_id: CURRENT_WEEK_ID,
        limit: 20,
        offset: 0,
        total_count: 2,
        top_entries: [
          {
            user_id: OTHER_USER_ID,
            display_name: 'Top Learner',
            level: 6,
            score: 14.5, // +14.5 điểm
            secondary_score: 15, // 15 lượt mẫu
            rank: 1,
          },
          {
            user_id: TEST_USER_ID,
            display_name: 'Steady Learner',
            level: 3,
            score: 0, // Điểm số 0 điểm hợp lệ (không đổi)
            secondary_score: 10,
            rank: 2,
          },
        ],
        current_user_entry: {
          user_id: TEST_USER_ID,
          display_name: 'Steady Learner',
          level: 3,
          score: 0,
          secondary_score: 10,
          rank: 2,
        },
      };

      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: mockRpcResponse,
        error: null,
      } as any);

      const result = await fetchLeaderboardWithStatus('pronunciation_gain', TEST_USER_ID);

      expect(result.entries[0].score).toBe(14.5);
      expect(result.entries[1].score).toBe(0);
      expect(result.currentUserEntry?.score).toBe(0);
      expect(formatMetricScore(result.entries[0].score, 'pronunciation_gain')).toBe('+14.5 điểm');
      expect(formatMetricScore(result.entries[1].score, 'pronunciation_gain')).toBe('0.0 điểm');
    });

    it('toeic_gain: map chính xác LR gain và số bài mock test', async () => {
      const mockRpcResponse = {
        success: true,
        category: 'toeic_gain',
        week_id: CURRENT_WEEK_ID,
        limit: 20,
        offset: 0,
        total_count: 1,
        top_entries: [
          {
            user_id: TEST_USER_ID,
            display_name: 'TOEIC Achiever',
            level: 5,
            score: 120, // +120 LR
            secondary_score: 3, // 3 bài mock
            rank: 1,
          },
        ],
        current_user_entry: {
          user_id: TEST_USER_ID,
          display_name: 'TOEIC Achiever',
          level: 5,
          score: 120,
          secondary_score: 3,
          rank: 1,
        },
      };

      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: mockRpcResponse,
        error: null,
      } as any);

      const result = await fetchLeaderboardWithStatus('toeic_gain', TEST_USER_ID);

      expect(result.entries[0].score).toBe(120);
      expect(result.entries[0].secondaryScore).toBe(3);
      expect(formatMetricScore(result.entries[0].score, 'toeic_gain')).toBe('+120 LR');
      expect(formatSecondaryScore(result.entries[0].secondaryScore, 'toeic_gain')).toBe('3 bài mock');
    });
  });

  // ==========================================================================
  // SECTION 2: LEGACY CATEGORIES READ PATH (weekly_xp & streak)
  // ==========================================================================
  describe('2. Legacy Categories Read Path (leaderboard_profiles)', () => {
    it('weekly_xp: truy vấn trực tiếp leaderboard_profiles với sắp xếp tất định', async () => {
      const mockProfiles = [
        {
          id: TEST_USER_ID,
          display_name: 'User 1',
          avatar_url: null,
          level: 2,
          total_xp: 500,
          weekly_xp: 250,
          streak: 5,
          last_active_at: new Date().toISOString(),
          equipped_frame: 'champion_frame',
        },
      ];

      const fromSpy = vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }),
        }),
      } as any);

      const result = await fetchLeaderboardWithStatus('weekly_xp', TEST_USER_ID, 20);

      expect(fromSpy).toHaveBeenCalledWith('leaderboard_profiles');
      expect(result.status).toBe('SUCCESS');
      expect(result.entries[0].score).toBe(250);
      expect(result.entries[0].userId).toBe(TEST_USER_ID);
      expect(result.entries[0].isCurrentUser).toBe(true);
    });

    it('streak: đọc đúng trường streak từ leaderboard_profiles', async () => {
      const mockProfiles = [
        {
          id: TEST_USER_ID,
          display_name: 'User 1',
          avatar_url: null,
          level: 2,
          total_xp: 500,
          weekly_xp: 250,
          streak: 15,
          last_active_at: new Date().toISOString(),
          equipped_frame: null,
        },
      ];

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }),
        }),
      } as any);

      const result = await fetchLeaderboardWithStatus('streak', TEST_USER_ID, 20);

      expect(result.entries[0].score).toBe(15);
      expect(formatMetricScore(result.entries[0].score, 'streak')).toBe('15 ngày');
    });
  });

  // ==========================================================================
  // SECTION 3: STICKY CURRENT USER RANK
  // ==========================================================================
  describe('3. Sticky Current User Rank (getMyLeaderboardRank)', () => {
    it('getMyLeaderboardRank trả về rank, score và secondary_score từ RPC get_my_leaderboard_rank', async () => {
      const mockRpcResponse = {
        success: true,
        found: true,
        category: 'toeic_gain',
        week_id: CURRENT_WEEK_ID,
        entry: {
          user_id: TEST_USER_ID,
          display_name: 'Huy Hoang',
          avatar_url: null,
          level: 4,
          equipped_frame: 'elite_frame',
          score: 80,
          secondary_score: 2,
          rank: 7,
          updated_at: '2026-10-07T10:00:00Z',
        },
      };

      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: mockRpcResponse,
        error: null,
      } as any);

      const rankEntry = await getMyLeaderboardRank('toeic_gain', TEST_USER_ID);

      expect(rpcSpy).toHaveBeenCalledWith('get_my_leaderboard_rank', {
        p_category: 'toeic_gain',
        p_week_id: CURRENT_WEEK_ID,
        p_user_id: TEST_USER_ID,
      });

      expect(rankEntry).toBeDefined();
      expect(rankEntry?.rank).toBe(7);
      expect(rankEntry?.score).toBe(80);
      expect(rankEntry?.secondaryScore).toBe(2);
      expect(rankEntry?.isCurrentUser).toBe(true);
      expect(rankEntry?.equippedFrame).toBe('elite_frame');
    });

    it('Học viên chưa đủ điều kiện (not found / ineligible): getMyLeaderboardRank trả về null', async () => {
      const mockRpcResponse = {
        success: true,
        found: false,
        category: 'pronunciation_gain',
        week_id: CURRENT_WEEK_ID,
        entry: null,
      };

      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: mockRpcResponse,
        error: null,
      } as any);

      const rankEntry = await getMyLeaderboardRank('pronunciation_gain', TEST_USER_ID);

      // Tuyệt đối là null, không trả về rank 0 hay fake điểm 0
      expect(rankEntry).toBeNull();
    });

    it('Học viên nằm ở trang 2 (ngoài top 20): current_user_entry vẫn hiển thị đúng thứ hạng cá nhân', async () => {
      const mockRpcResponse = {
        success: true,
        category: 'vocab_mastered',
        week_id: CURRENT_WEEK_ID,
        limit: 20,
        offset: 0,
        total_count: 50,
        // Danh sách chỉ gồm top 20 của người khác
        top_entries: Array.from({ length: 20 }, (_, i) => ({
          user_id: `other_${i}`,
          display_name: `Other ${i}`,
          level: 1,
          score: 200 - i,
          rank: i + 1,
        })),
        // Server trả về vị trí của user hiện tại dù nằm ở trang khác
        current_user_entry: {
          user_id: TEST_USER_ID,
          display_name: 'Huy Hoang',
          level: 2,
          score: 45,
          secondary_score: 5,
          rank: 38,
        },
      };

      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: mockRpcResponse,
        error: null,
      } as any);

      const result = await fetchLeaderboardWithStatus('vocab_mastered', TEST_USER_ID, 20, 0);

      expect(result.entries.length).toBe(20);
      expect(result.currentUserEntry).toBeDefined();
      expect(result.currentUserEntry?.rank).toBe(38); // Giữ sticky rank #38
      expect(result.currentUserEntry?.score).toBe(45);
    });
  });

  // ==========================================================================
  // SECTION 4: SERVER-SIDE PAGINATION & LIMIT BOUNDS
  // ==========================================================================
  describe('4. Server-Side Pagination & Limit Bounds', () => {
    it('Offset và Page 2: p_offset được truyền đúng sang RPC', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          top_entries: [],
          total_count: 45,
          current_user_entry: null,
        },
        error: null,
      } as any);

      await fetchLeaderboardWithStatus('active_minutes', TEST_USER_ID, 20, 20);

      expect(rpcSpy).toHaveBeenCalledWith('get_leaderboard_category_rankings', {
        p_category: 'active_minutes',
        p_week_id: CURRENT_WEEK_ID,
        p_limit: 20,
        p_offset: 20,
        p_current_user_id: TEST_USER_ID,
      });
    });

    it('Clamping limit: Giới hạn limit từ 1 đến 50', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: { success: true, top_entries: [] },
        error: null,
      } as any);

      // Yêu cầu 100 items -> clamp về tối đa 50
      await fetchLeaderboardWithStatus('vocab_mastered', TEST_USER_ID, 100, 0);

      expect(rpcSpy).toHaveBeenCalledWith(
        'get_leaderboard_category_rankings',
        expect.objectContaining({
          p_limit: 50,
        })
      );
    });
  });

  // ==========================================================================
  // SECTION 5: REALTIME SUBSCRIPTION
  // ==========================================================================
  describe('5. Realtime Subscription Coordination', () => {
    it('Tạo kênh realtime duy nhất đăng ký cả 2 bảng leaderboard_profiles và weekly_learning_metrics', () => {
      const onMock = vi.fn().mockReturnThis();
      const subscribeMock = vi.fn().mockReturnThis();

      vi.spyOn(supabase, 'channel').mockReturnValue({
        on: onMock,
        subscribe: subscribeMock,
      } as any);

      const unsubscribe = subscribeToLeaderboard(vi.fn());

      expect(supabase.channel).toHaveBeenCalledWith('public:leaderboard_profiles');
      // Đăng ký cả 2 bảng trên cùng 1 logical channel
      expect(onMock).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({ table: 'leaderboard_profiles' }),
        expect.any(Function)
      );
      expect(onMock).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({ table: 'weekly_learning_metrics' }),
        expect.any(Function)
      );

      unsubscribe();
    });

    it('Nhiều subscriber chia sẻ cùng channel mà không tạo duplicate WebSocket connection', () => {
      const channelSpy = vi.spyOn(supabase, 'channel').mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      } as any);

      const un緻1 = subscribeToLeaderboard(vi.fn());
      const un緻2 = subscribeToLeaderboard(vi.fn());

      // Chỉ tạo 1 channel
      expect(channelSpy).toHaveBeenCalledTimes(1);

      un緻1();
      un緻2();
    });
  });

  // ==========================================================================
  // SECTION 6: OPEN LEADERBOARD AFTER LEARNING
  // ==========================================================================
  describe('6. Open Leaderboard After Learning (Flush Pending Sync)', () => {
    it('Khi có sync debounce đang chờ: hasPendingCloudSync trả về true', () => {
      scheduleCloudSync(5000); // Học viên vừa làm bài xong
      expect(hasPendingCloudSync()).toBe(true);
    });

    it('flushPendingCloudSync huỷ timer hoãn và thực thi đồng bộ ngay lập tức', async () => {
      scheduleCloudSync(5000);
      expect(hasPendingCloudSync()).toBe(true);

      const res = await flushPendingCloudSync();
      // Timer đã bị xóa và sync hoàn thành
      expect(hasPendingCloudSync()).toBe(false);
      expect(res.success).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION 7: ERROR STATES (Không nuốt lỗi thành empty ranking)
  // ==========================================================================
  describe('7. Error Classification & Non-Swallowing', () => {
    it('Lỗi RPC trả về status NETWORK_ERROR hoặc PERMISSION_ERROR thay vì rỗng thành công', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: null,
        error: { code: 'PGRST301', message: 'permission denied for function' },
      } as any);

      const result = await fetchLeaderboardWithStatus('vocab_mastered', TEST_USER_ID);

      expect(result.status).not.toBe('SUCCESS');
      expect(result.error).toBeDefined();
      expect(result.errorInfo).toBeDefined();
    });

    it('Timeout truy vấn (quá 3000ms) trả về mã lỗi TIMEOUT rõ ràng', async () => {
      vi.spyOn(supabase, 'rpc').mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 5000)) as any
      );

      const result = await fetchLeaderboardWithStatus('vocab_mastered', TEST_USER_ID);

      expect(result.status).toBe('TIMEOUT');
      expect(result.errorInfo?.code).toBe('TIMEOUT');
    });
  });
});
