// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { supabase } from '../../lib/supabaseClient';
import {
  useCloudSyncStore,
  pushLocalToCloud,
  performFullSync,
  setActiveSyncedUserId,
} from '../cloudSyncService';
import {
  getVietnamDateString,
} from '../leaderboardLearningMetrics';
import {
  syncUserScoreToLeaderboard,
  getMyLeaderboardRank,
  fetchLeaderboardWithStatus,
  compareLeaderboardStreak,
} from '../leaderboardService';
import { useAppStore } from '../../store/useAppStore';
import { applyCloudDataMerge } from '../../store/cloudDataMerger';
import { partializeAppStore } from '../../store/storeRehydration';
import { resetDailyXpTrackingForTesting } from '../xpAntiSpamService';

describe('PHASE 4 — Fix Streak Leaderboard Pipeline End-to-End', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetDailyXpTrackingForTesting();
    setActiveSyncedUserId(null);
    useAppStore.getState().resetToDefault();
    useCloudSyncStore.setState({
      user: null,
      userId: null,
      userEmail: null,
      session: null,
      isOnline: true,
      status: 'idle',
      errorMessage: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. First Qualifying Study Day', () => {
    it('người dùng mới bắt đầu với streak = 0 và lastStudyDate = null', () => {
      const state = useAppStore.getState();
      expect(state.profile.streak).toBe(0);
      expect(state.profile.lastStudyDate).toBeNull();
    });

    it('hoàn thành hoạt động học tập đầu tiên (gainXP) thiết lập streak = 1 và lastStudyDate = today', () => {
      const today = getVietnamDateString();
      useAppStore.getState().gainXP(15, { source: 'flashcard' });

      const state = useAppStore.getState();
      expect(state.profile.streak).toBe(1);
      expect(state.profile.lastStudyDate).toBe(today);
      expect(state.profile.lastActiveDate).toBe(today);
    });

    it('mở ứng dụng (App mount / checkDailyReset) KHÔNG tự động tăng streak khi chưa học', () => {
      useAppStore.getState().checkDailyReset();

      const state = useAppStore.getState();
      expect(state.profile.streak).toBe(0);
      expect(state.profile.lastStudyDate).toBeNull();
      // lastActiveDate được cập nhật ngày truy cập nhưng không tính là ngày học
      expect(state.profile.lastActiveDate).toBe(getVietnamDateString());
    });
  });

  describe('2. Consecutive Days & Same Day Idempotency', () => {
    it('học ngày tiếp theo (diffDays = 1) tăng chuỗi streak = 2', () => {
      const today = getVietnamDateString();
      // Giả lập hôm qua người dùng đã học
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = yesterdayDate.toISOString().split('T')[0];

      useAppStore.setState((s) => ({
        profile: {
          ...s.profile,
          streak: 1,
          lastStudyDate: yesterday,
          lastActiveDate: yesterday,
        },
      }));

      // Hoàn thành hoạt động học ngày hôm nay
      useAppStore.getState().gainXP(20, { source: 'quiz' });

      const state = useAppStore.getState();
      expect(state.profile.streak).toBe(2);
      expect(state.profile.lastStudyDate).toBe(today);
    });

    it('nhiều hoạt động học tập trong cùng một ngày là bất biến (Idempotent: streak không tăng đúp)', () => {
      const today = getVietnamDateString();
      // Hoạt động 1
      useAppStore.getState().gainXP(10, { source: 'flashcard' });
      expect(useAppStore.getState().profile.streak).toBe(1);
      expect(useAppStore.getState().profile.lastStudyDate).toBe(today);

      // Hoạt động 2, 3, 4 trong cùng ngày
      useAppStore.getState().gainXP(20, { source: 'quiz' });
      useAppStore.getState().gainXP(15, { source: 'pronunciation' });
      useAppStore.getState().recordQuizCompleted(25, true);

      const state = useAppStore.getState();
      expect(state.profile.streak).toBe(1);
      expect(state.profile.lastStudyDate).toBe(today);
      expect(state.profile.xp).toBeGreaterThan(0);
    });
  });

  describe('3. Broken Streak Recovery (Missed Day)', () => {
    it('bỏ lỡ >= 2 ngày làm đứt chuỗi; khi học lại thiết lập streak về 1', () => {
      const today = getVietnamDateString();
      // Giả lập lần học cuối là 3 ngày trước
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 3);
      const lastStudyStr = oldDate.toISOString().split('T')[0];

      useAppStore.setState((s) => ({
        profile: {
          ...s.profile,
          streak: 5,
          lastStudyDate: lastStudyStr,
          lastActiveDate: lastStudyStr,
        },
      }));

      // Khi mở app vào ngày mới: checkDailyReset phát hiện đứt chuỗi
      useAppStore.getState().checkDailyReset();
      expect(useAppStore.getState().profile.streak).toBe(0);

      // Khi người dùng hoàn thành buổi học: streak khởi động lại tại mốc 1
      useAppStore.getState().gainXP(10, { source: 'flashcard' });
      expect(useAppStore.getState().profile.streak).toBe(1);
      expect(useAppStore.getState().profile.lastStudyDate).toBe(today);
    });

    it('nếu checkAndUpdateStreak được gọi trực tiếp sau 3 ngày bỏ lỡ, streak cũng đặt lại 1 an toàn', () => {
      const today = getVietnamDateString();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 3);
      const lastStudyStr = oldDate.toISOString().split('T')[0];

      useAppStore.setState((s) => ({
        profile: {
          ...s.profile,
          streak: 10,
          lastStudyDate: lastStudyStr,
          lastActiveDate: lastStudyStr,
        },
      }));

      useAppStore.getState().checkAndUpdateStreak();
      expect(useAppStore.getState().profile.streak).toBe(1);
      expect(useAppStore.getState().profile.lastStudyDate).toBe(today);
    });
  });

  describe('4. Mandatory Case: Local streak > 0, Cloud streak = 0 (No Rollback)', () => {
    it('Cloud streak 0 KHÔNG rollback streak cục bộ 5 khi merge dữ liệu', () => {
      const today = getVietnamDateString();
      useAppStore.setState((s) => ({
        profile: {
          ...s.profile,
          streak: 5,
          lastStudyDate: today,
          lastActiveDate: today,
        },
      }));

      // Cloud trả về streak = 0 (ví dụ profile mới tạo trên cloud hoặc chưa sync)
      const cloudPayload = {
        cloudProfile: {
          id: 'test-user-id',
          display_name: 'Test Learner',
          streak: 0,
          xp: 0,
          level: 1,
        },
      };

      const merged = applyCloudDataMerge(useAppStore.getState(), cloudPayload);
      expect(merged.profile?.streak).toBe(5);
      expect(merged.profile?.lastStudyDate).toBe(today);
    });

    it('sau khi sync, Cloud được cập nhật mốc streak = 5 theo evidence local', async () => {
      const testUserId = '22222222-2222-4222-8222-222222222222';
      const today = getVietnamDateString();
      useCloudSyncStore.setState({
        user: { id: testUserId, email: 'streaker@example.com' } as any,
        userId: testUserId,
        isOnline: true,
      });

      useAppStore.setState((s) => ({
        profile: {
          ...s.profile,
          name: 'Streak Master',
          streak: 5,
          lastStudyDate: today,
          lastActiveDate: today,
        },
      }));

      let rpcStreak: number | undefined;
      vi.spyOn(supabase, 'rpc').mockImplementation(((fn: string, args: any) => {
        if (fn === 'sync_leaderboard_progress') {
          rpcStreak = args.p_streak;
          return Promise.resolve({ data: { success: true }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }) as any);

      let tableProfilesStreak: number | undefined;
      vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
        if (table === 'profiles') {
          return {
            upsert: vi.fn().mockImplementation((payload: any) => {
              tableProfilesStreak = payload.streak;
              return Promise.resolve({ error: null });
            }),
          };
        }
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      }) as any);

      await pushLocalToCloud();

      // RPC sync_leaderboard_progress nhận đúng streak 5
      expect(rpcStreak).toBe(5);
      // profiles table upsert nhận đúng streak 5
      expect(tableProfilesStreak).toBe(5);
    });
  });

  describe('5. Leaderboard Query & Sticky Rank for Streak Category', () => {
    it('compareLeaderboardStreak sắp xếp đúng thứ tự: streak DESC -> weekly_xp DESC -> last_active_at ASC -> id ASC', () => {
      const profiles = [
        { id: 'user-1', display_name: 'A', streak: 3, weekly_xp: 100, last_active_at: '2026-10-07T10:00:00Z', level: 1 },
        { id: 'user-2', display_name: 'B', streak: 5, weekly_xp: 50, last_active_at: '2026-10-07T10:00:00Z', level: 1 },
        { id: 'user-3', display_name: 'C', streak: 5, weekly_xp: 200, last_active_at: '2026-10-07T10:00:00Z', level: 1 },
        { id: 'user-4', display_name: 'D', streak: 5, weekly_xp: 200, last_active_at: '2026-10-07T09:00:00Z', level: 1 },
      ];

      const sorted = [...profiles].sort(compareLeaderboardStreak as any);
      // Top 1: streak 5, weekly_xp 200, last_active sớm hơn (09:00) -> user-4
      expect(sorted[0].id).toBe('user-4');
      // Top 2: streak 5, weekly_xp 200, last_active 10:00 -> user-3
      expect(sorted[1].id).toBe('user-3');
      // Top 3: streak 5, weekly_xp 50 -> user-2
      expect(sorted[2].id).toBe('user-2');
      // Top 4: streak 3 -> user-1
      expect(sorted[3].id).toBe('user-1');
    });

    it('getMyLeaderboardRank cho streak fallback truy vấn leaderboard_profiles và trả về thứ hạng chính xác', async () => {
      const targetUserId = '33333333-3333-4333-8333-333333333333';

      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: null,
        error: { message: 'function not found' },
      } as any);

      vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
        if (table === 'leaderboard_profiles') {
          return {
            select: vi.fn().mockImplementation((fields: string, opts?: any) => {
              if (opts?.head) {
                // Đếm số người có streak > 7 -> giả sử có 2 người
                return {
                  gt: vi.fn().mockResolvedValue({ count: 2, error: null }),
                };
              }
              return {
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: targetUserId,
                      display_name: 'Streak Hero',
                      streak: 7,
                      weekly_xp: 150,
                      level: 2,
                    },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        return {} as any;
      }) as any);

      const rankEntry = await getMyLeaderboardRank('streak', targetUserId);
      expect(rankEntry).not.toBeNull();
      expect(rankEntry?.score).toBe(7); // Điểm chính là streak
      expect(rankEntry?.secondaryScore).toBe(150); // Điểm phụ là weekly_xp
      expect(rankEntry?.rank).toBe(3); // 2 người cao hơn + 1 = rank 3
    });
  });

  describe('6. Multi-Device Reconciliation & Persistence', () => {
    it('merge đa thiết bị: chọn mốc streak cao hơn và ngày học mới hơn', () => {
      useAppStore.setState((s) => ({
        profile: {
          ...s.profile,
          streak: 3,
          lastStudyDate: '2026-10-05',
          lastActiveDate: '2026-10-05',
        },
      }));

      const remotePayload = {
        cloudProfile: {
          streak: 4,
          last_study_date: '2026-10-06',
          last_active_date: '2026-10-06',
        },
      };

      const merged = applyCloudDataMerge(useAppStore.getState(), remotePayload);
      expect(merged.profile?.streak).toBe(4);
      expect(merged.profile?.lastStudyDate).toBe('2026-10-06');
    });

    it('partializeAppStore lưu đúng streak và lastStudyDate để sống sót qua reload (F5)', () => {
      const today = getVietnamDateString();
      useAppStore.setState((s) => ({
        profile: {
          ...s.profile,
          streak: 8,
          lastStudyDate: today,
          lastActiveDate: today,
        },
      }));

      const partial = partializeAppStore(useAppStore.getState());
      expect(partial.profile.streak).toBe(8);
      expect(partial.profile.lastStudyDate).toBe(today);
      expect(partial.profile.lastActiveDate).toBe(today);
    });

    it('resetToDefault xóa sạch streak khi chuyển tài khoản hoặc đăng xuất', () => {
      useAppStore.setState((s) => ({
        profile: {
          ...s.profile,
          streak: 9,
          lastStudyDate: '2026-10-07',
        },
      }));

      useAppStore.getState().resetToDefault();
      expect(useAppStore.getState().profile.streak).toBe(0);
      expect(useAppStore.getState().profile.lastStudyDate).toBeNull();
    });
  });
});
