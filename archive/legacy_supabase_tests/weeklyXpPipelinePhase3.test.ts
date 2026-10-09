// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { supabase } from '../../lib/supabaseClient';
import { useCloudSyncStore, pushLocalToCloud, performFullSync, signOutCloud, setActiveSyncedUserId } from '../cloudSyncService';
import {
  calculateWeeklyXpFromHistory,
  getAuthoritativeVietnamWeekId,
  syncUserScoreToLeaderboard,
  syncWeeklyLearningMetricsToServer,
  getMyLeaderboardRank,
  fetchLeaderboardWithStatus,
} from '../leaderboardService';
import { useAppStore } from '../../store/useAppStore';
import { applyCloudDataMerge } from '../../store/cloudDataMerger';
import { partializeAppStore } from '../../store/storeRehydration';

describe('PHASE 3 — Fix Weekly XP Leaderboard Pipeline End-to-End', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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

  describe('1. XP Award & Local Weekly XP Derivation', () => {
    it('gainXP cập nhật cả profile.xp (lifetime) và dailyHistory[today].xpGained (daily/weekly)', () => {
      const today = new Date().toISOString().split('T')[0];
      expect(useAppStore.getState().profile.xp).toBe(0);
      expect(useAppStore.getState().dailyHistory[today]).toBeUndefined();

      useAppStore.getState().gainXP(50);

      const state1 = useAppStore.getState();
      expect(state1.profile.xp).toBe(50);
      expect(state1.dailyHistory[today]?.xpGained).toBe(50);

      // Award additional XP
      useAppStore.getState().gainXP(100);

      const state2 = useAppStore.getState();
      expect(state2.profile.xp).toBe(150);
      expect(state2.dailyHistory[today]?.xpGained).toBe(150);

      // Derivation từ dailyHistory cho tuần hiện tại
      const weeklyXp = calculateWeeklyXpFromHistory(state2.dailyHistory);
      expect(weeklyXp).toBe(150);
    });

    it('idempotencyKey ngăn chặn cộng đúp XP lặp lại', () => {
      const { gainXP } = useAppStore.getState();
      gainXP(40, { idempotencyKey: 'quiz_session_abc' });
      expect(useAppStore.getState().profile.xp).toBe(40);

      // Lần 2 với cùng idempotencyKey -> bị từ chối
      gainXP(40, { idempotencyKey: 'quiz_session_abc' });
      expect(useAppStore.getState().profile.xp).toBe(40);
    });
  });

  describe('2. Cloud Write Pipeline: pushLocalToCloud syncs both tables', () => {
    it('pushLocalToCloud tự động gọi syncUserScoreToLeaderboard và syncWeeklyLearningMetricsToServer với weeklyXp chuẩn', async () => {
      const testUserId = '11111111-1111-4111-8111-111111111111';
      useCloudSyncStore.setState({
        user: { id: testUserId, email: 'learner@example.com' } as any,
        userId: testUserId,
        isOnline: true,
      });

      // User gains 150 XP
      useAppStore.getState().gainXP(150);
      const currentWeeklyXp = calculateWeeklyXpFromHistory(useAppStore.getState().dailyHistory);
      expect(currentWeeklyXp).toBe(150);

      // Mock Supabase calls
      const rpcCalls: { fn: string; args: any }[] = [];
      vi.spyOn(supabase, 'rpc').mockImplementation(((fn: string, args: any) => {
        rpcCalls.push({ fn, args });
        if (fn === 'sync_leaderboard_progress') {
          return Promise.resolve({ data: { success: true, weekly_xp: args.p_weekly_xp }, error: null });
        }
        if (fn === 'sync_weekly_learning_metrics') {
          return Promise.resolve({ data: { success: true, weekly_xp: args.p_weekly_xp }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }) as any);

      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      vi.spyOn(supabase, 'from').mockReturnValue({
        upsert: upsertMock,
      } as any);

      await pushLocalToCloud(testUserId);

      // Kiểm tra sync_leaderboard_progress đã được gọi với weeklyXp = 150
      const leaderRpc = rpcCalls.find((c) => c.fn === 'sync_leaderboard_progress');
      expect(leaderRpc).toBeDefined();
      expect(leaderRpc?.args.p_weekly_xp).toBe(150);
      expect(leaderRpc?.args.p_total_xp).toBe(150);

      // Kiểm tra sync_weekly_learning_metrics đã được gọi với weeklyXp = 150 và đúng canonical weekId
      const metricsRpc = rpcCalls.find((c) => c.fn === 'sync_weekly_learning_metrics');
      expect(metricsRpc).toBeDefined();
      expect(metricsRpc?.args.p_weekly_xp).toBe(150);
      expect(metricsRpc?.args.p_week_id).toBe(getAuthoritativeVietnamWeekId());
    });
  });

  describe('3. MANDATORY CASE: Local 150 XP vs Cloud 0 XP (No Rollback)', () => {
    it('khi local có weekly_xp = 150 và remote trả về 0, sync không được rollback local 150 và phải đẩy 150 lên cloud', async () => {
      const testUserId = '22222222-2222-4222-8222-222222222222';
      useCloudSyncStore.setState({
        user: { id: testUserId, email: 'offline_scholar@example.com' } as any,
        userId: testUserId,
        isOnline: true,
      });

      // User đã tích lũy 150 XP cục bộ
      useAppStore.getState().gainXP(150);
      expect(useAppStore.getState().profile.xp).toBe(150);

      // Remote Supabase chỉ có 0 XP (do tài khoản mới hoặc stale remote snapshot)
      const mockCloudProfile = { id: testUserId, xp: 0, level: 1, streak: 1 };
      const mockCloudLogs: any[] = []; // Chưa có log nào

      // Áp dụng mergeCloudData
      useAppStore.getState().mergeCloudData({
        cloudProfile: mockCloudProfile,
        cloudDailyLogs: mockCloudLogs,
      });

      // 1. Kiểm tra: Local XP KHÔNG bị rollback về 0
      const afterMergeState = useAppStore.getState();
      expect(afterMergeState.profile.xp).toBe(150);
      const afterMergeWeeklyXp = calculateWeeklyXpFromHistory(afterMergeState.dailyHistory);
      expect(afterMergeWeeklyXp).toBe(150);

      // 2. Khi pushLocalToCloud, Cloud nhận đúng 150 XP
      const rpcCalls: { fn: string; args: any }[] = [];
      vi.spyOn(supabase, 'rpc').mockImplementation(((fn: string, args: any) => {
        rpcCalls.push({ fn, args });
        return Promise.resolve({ data: { success: true }, error: null });
      }) as any);
      vi.spyOn(supabase, 'from').mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      } as any);

      await pushLocalToCloud(testUserId);

      const leaderRpc = rpcCalls.find((c) => c.fn === 'sync_leaderboard_progress');
      expect(leaderRpc?.args.p_weekly_xp).toBe(150);

      const metricsRpc = rpcCalls.find((c) => c.fn === 'sync_weekly_learning_metrics');
      expect(metricsRpc?.args.p_weekly_xp).toBe(150);
    });
  });

  describe('4. New User: First-row Creation in leaderboard_profiles & weekly_learning_metrics', () => {
    it('người dùng mới chưa có hàng nào được upsert/create an toàn theo đúng kiến trúc', async () => {
      const newUserId = '33333333-3333-4333-8333-333333333333';
      useCloudSyncStore.setState({
        user: { id: newUserId, email: 'newbie@example.com' } as any,
        userId: newUserId,
        isOnline: true,
      });

      useAppStore.getState().gainXP(25);

      let rpcExecuted = false;
      vi.spyOn(supabase, 'rpc').mockImplementation(((fn: string, args: any) => {
        if (fn === 'sync_leaderboard_progress') {
          rpcExecuted = true;
          // Mô phỏng RPC trả về INSERT thành công cho new user
          return Promise.resolve({
            data: {
              success: true,
              code: 'SYNCED_SUCCESS',
              total_xp: args.p_total_xp,
              weekly_xp: args.p_weekly_xp,
            },
            error: null,
          });
        }
        return Promise.resolve({ data: { success: true }, error: null });
      }) as any);

      vi.spyOn(supabase, 'from').mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      } as any);

      await pushLocalToCloud(newUserId);
      expect(rpcExecuted).toBe(true);
    });
  });

  describe('5. Reload (F5) Rehydration Consistency', () => {
    it('earn XP -> partialize/rehydrate -> open leaderboard giữ nguyên điểm số và thứ hạng', () => {
      // 1. Earn XP
      useAppStore.getState().gainXP(150);

      // 2. Simulate LocalStorage partialize
      const persistedState = partializeAppStore(useAppStore.getState());
      expect(persistedState.profile.xp).toBe(150);
      expect(Object.keys(persistedState.dailyHistory).length).toBeGreaterThan(0);

      // 3. Reset in-memory store (simulating browser reload start)
      useAppStore.getState().resetToDefault();
      expect(useAppStore.getState().profile.xp).toBe(0);

      // 4. Rehydrate from persisted state
      useAppStore.setState({
        profile: persistedState.profile,
        dailyHistory: persistedState.dailyHistory,
        isHydrated: true,
      });

      // 5. Weekly XP tính toán sau reload vẫn chính xác 150
      const weeklyXpAfterF5 = calculateWeeklyXpFromHistory(useAppStore.getState().dailyHistory);
      expect(weeklyXpAfterF5).toBe(150);
    });
  });

  describe('6. Sign-in & Account Switch: User A XP does not leak to User B', () => {
    it('User A có 200 XP -> logout -> User B login (có 30 XP cloud) không bị nhiễm XP của A', async () => {
      const userAId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const userBId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

      // 1. User A đăng nhập và học tập đạt 200 XP
      useCloudSyncStore.setState({
        user: { id: userAId, email: 'usera@example.com' } as any,
        userId: userAId,
        isOnline: true,
      });
      setActiveSyncedUserId(userAId);
      useAppStore.getState().gainXP(200);
      expect(useAppStore.getState().profile.xp).toBe(200);

      // 2. User A đăng xuất
      vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null } as any);
      await signOutCloud();

      // Kiểm tra store đã được dọn sạch về mặc định
      expect(useAppStore.getState().profile.xp).toBe(0);
      expect(Object.keys(useAppStore.getState().dailyHistory).length).toBe(0);

      // 3. User B đăng nhập trên cùng trình duyệt
      useCloudSyncStore.setState({
        user: { id: userBId, email: 'userb@example.com' } as any,
        userId: userBId,
        isOnline: true,
      });

      // Mock dữ liệu cloud của User B chỉ có 30 XP
      vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: userBId, xp: 30, level: 1, streak: 2, display_name: 'User B' },
                  error: null,
                }),
              }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      }) as any);

      vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: { success: true }, error: null } as any);

      await performFullSync();

      // User B chỉ có 30 XP, hoàn toàn KHÔNG bị leak 200 XP của User A!
      expect(useAppStore.getState().profile.xp).toBe(30);
    });

    it('Account switch tự động phát hiện và reset khi userId thay đổi mà chưa kịp gọi signOutCloud', async () => {
      const userAId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const userBId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

      // Giả lập trạng thái trước: User A đang lưu trong localStorage với 500 XP
      setActiveSyncedUserId(userAId);
      useAppStore.setState({
        profile: { ...useAppStore.getState().profile, xp: 500, name: 'User A' },
      });

      // User B đăng nhập vào hệ thống
      useCloudSyncStore.setState({
        user: { id: userBId, email: 'userb@example.com' } as any,
        userId: userBId,
        isOnline: true,
      });

      vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: userBId, xp: 50, level: 1, streak: 1, display_name: 'User B' },
                  error: null,
                }),
              }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      }) as any);

      vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: { success: true }, error: null } as any);

      // performFullSync phát hiện previousUserId !== currentUserId -> reset local store
      await performFullSync();

      expect(useAppStore.getState().profile.xp).toBe(50);
      expect(useAppStore.getState().profile.name).toBe('User B');
    });
  });

  describe('7. Sticky Rank Consistency (Users inside and outside Top 50)', () => {
    it('người dùng ngoài Top 50 được sticky rank lấy chính xác từ get_my_leaderboard_rank RPC', async () => {
      const outsideUserId = '55555555-5555-4555-8555-555555555555';

      vi.spyOn(supabase, 'rpc').mockImplementation(((fn: string, args: any) => {
        if (fn === 'get_my_leaderboard_rank') {
          return Promise.resolve({
            data: {
              success: true,
              found: true,
              entry: {
                user_id: outsideUserId,
                rank: 72,
                score: 180,
                display_name: 'Hardworking Student',
                level: 5,
                secondary_score: 3,
                updated_at: '2026-10-07T12:00:00Z',
              },
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }) as any);

      const myRank = await getMyLeaderboardRank('weekly_xp', outsideUserId);

      expect(myRank).not.toBeNull();
      expect(myRank?.userId).toBe(outsideUserId);
      expect(myRank?.rank).toBe(72);
      expect(myRank?.score).toBe(180);
      expect(myRank?.isCurrentUser).toBe(true);
    });

    it('nếu RPC trả về found=false cho weekly_xp, fallback đọc từ leaderboard_profiles để giữ sticky rank', async () => {
      const fallbackUserId = '66666666-6666-4666-8666-666666666666';

      // Mock RPC trả về found = false (do weekly_learning_metrics chưa kịp cập nhật)
      vi.spyOn(supabase, 'rpc').mockImplementation(((fn: string) => {
        if (fn === 'get_my_leaderboard_rank') {
          return Promise.resolve({
            data: { success: true, found: false, entry: null },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }) as any);

      // Mock fallback query vào leaderboard_profiles
      vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
        if (table === 'leaderboard_profiles') {
          return {
            select: vi.fn().mockImplementation((_fields: string, opts?: any) => {
              if (opts?.count === 'exact') {
                return {
                  gt: vi.fn().mockResolvedValue({ count: 54, error: null }),
                };
              }
              return {
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: fallbackUserId,
                      display_name: 'Resilient Student',
                      weekly_xp: 220,
                      streak: 4,
                      level: 6,
                    },
                    error: null,
                  }),
                }),
              };
            }),
          } as any;
        }
        return {} as any;
      }) as any);

      const myRank = await getMyLeaderboardRank('weekly_xp', fallbackUserId);

      expect(myRank).not.toBeNull();
      expect(myRank?.userId).toBe(fallbackUserId);
      expect(myRank?.score).toBe(220);
      expect(myRank?.rank).toBe(55); // count (54) + 1 = 55
      expect(myRank?.isCurrentUser).toBe(true);
    });
  });

  describe('8. Error Handling & Duplicate Sync Idempotency', () => {
    it('lỗi RLS hoặc network trong syncUserScoreToLeaderboard được ghi nhận an toàn không ném unhandled rejection', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'violates row-level security policy' },
      } as any);

      vi.spyOn(supabase, 'from').mockReturnValue({
        upsert: vi.fn().mockResolvedValue({
          error: { code: '42501', message: 'violates row-level security policy' },
        }),
      } as any);

      await expect(
        syncUserScoreToLeaderboard({
          userId: '77777777-7777-4777-8777-777777777777',
          weeklyXp: 100,
        })
      ).resolves.toBeUndefined();
    });

    it('đồng bộ lặp lại cùng một giá trị weeklyXp là idempotent', async () => {
      const userId = '88888888-8888-4888-8888-888888888888';
      let rpcCallCount = 0;

      vi.spyOn(supabase, 'rpc').mockImplementation(((fn: string, args: any) => {
        if (fn === 'sync_weekly_learning_metrics') {
          rpcCallCount++;
          return Promise.resolve({
            data: { success: true, weekly_xp: args.p_weekly_xp },
            error: null,
          });
        }
        return Promise.resolve({ data: { success: true }, error: null });
      }) as any);

      const res1 = await syncWeeklyLearningMetricsToServer({
        weekId: getAuthoritativeVietnamWeekId(),
        weeklyXp: 150,
      });
      const res2 = await syncWeeklyLearningMetricsToServer({
        weekId: getAuthoritativeVietnamWeekId(),
        weeklyXp: 150,
      });

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
      expect(rpcCallCount).toBe(2);
    });
  });
});
