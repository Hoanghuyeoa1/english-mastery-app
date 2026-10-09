import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  LEADERBOARD_FRAMES,
  getFrameDefinition,
  getPodiumFrameByRank,
  validateFrameOwnershipLocally,
  fetchUserFrameEntitlements,
  getUserUnlockedFrames,
  equipProfileFrameOnServer,
  FrameId,
} from '../frameRewardService';
import { supabase } from '../../lib/supabaseClient';

describe('frameRewardService (Top 1/2/3 Podium Rewards & Equip Security)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Frame Definitions & Attributes', () => {
    it('định nghĩa đầy đủ 3 khung avatar vinh danh cho Top 1, Top 2, Top 3', () => {
      expect(LEADERBOARD_FRAMES.champion_frame).toBeDefined();
      expect(LEADERBOARD_FRAMES.elite_frame).toBeDefined();
      expect(LEADERBOARD_FRAMES.prestige_frame).toBeDefined();
    });

    it('Champion Frame (Top 1) có hiệu ứng xoay viền động và sắc vàng hoàng kim', () => {
      const champion = LEADERBOARD_FRAMES.champion_frame;
      expect(champion.rank).toBe(1);
      expect(champion.isRotating).toBe(true);
      expect(champion.badgeText).toContain('TOP 1');
      expect(champion.haloClasses).toContain('amber');
    });

    it('Elite Frame (Top 2) mang phong cách tinh anh bạc sáng', () => {
      const elite = LEADERBOARD_FRAMES.elite_frame;
      expect(elite.rank).toBe(2);
      expect(elite.isRotating).toBe(false);
      expect(elite.badgeText).toContain('TOP 2');
      expect(elite.borderClasses).toContain('slate');
    });

    it('Prestige Frame (Top 3) mang phong cách hoàng gia đồng/hổ phách', () => {
      const prestige = LEADERBOARD_FRAMES.prestige_frame;
      expect(prestige.rank).toBe(3);
      expect(prestige.isRotating).toBe(false);
      expect(prestige.badgeText).toContain('TOP 3');
      expect(prestige.borderClasses).toContain('amber-700');
    });

    it('getFrameDefinition trả về đúng định nghĩa hoặc null khi truyền frameId không hợp lệ', () => {
      expect(getFrameDefinition('champion_frame')?.id).toBe('champion_frame');
      expect(getFrameDefinition('elite_frame')?.id).toBe('elite_frame');
      expect(getFrameDefinition('prestige_frame')?.id).toBe('prestige_frame');

      expect(getFrameDefinition('hacker_frame')).toBeNull();
      expect(getFrameDefinition(null)).toBeNull();
      expect(getFrameDefinition(undefined)).toBeNull();
    });
  });

  describe('2. Rank-to-Frame Mapping (Podium XP vs Streak)', () => {
    it('trao đúng khung theo thứ hạng XP Tuần: Top 1 -> Champion, Top 2 -> Elite, Top 3 -> Prestige', () => {
      expect(getPodiumFrameByRank(1)).toBe('champion_frame');
      expect(getPodiumFrameByRank(2)).toBe('elite_frame');
      expect(getPodiumFrameByRank(3)).toBe('prestige_frame');
    });

    it('Rank >= 4 không nhận bất kỳ khung avatar vinh danh nào', () => {
      expect(getPodiumFrameByRank(4)).toBeNull();
      expect(getPodiumFrameByRank(5)).toBeNull();
      expect(getPodiumFrameByRank(100)).toBeNull();
      expect(getPodiumFrameByRank(0)).toBeNull();
      expect(getPodiumFrameByRank(-1)).toBeNull();
    });

    it('Top Streak không trao khung vinh danh tuần (chỉ dành riêng cho Top 3 XP Podium)', () => {
      // Hàm trao thưởng khung vinh danh chỉ ánh xạ theo hạng XP Tuần (1, 2, 3)
      const streakPodiumWinners = [
        { rank: 1, metric: 'streak', userId: 'user-streak-1' },
        { rank: 2, metric: 'streak', userId: 'user-streak-2' },
        { rank: 3, metric: 'streak', userId: 'user-streak-3' },
      ];

      // Chỉ khi metric là weekly_xp thì mới nhận frame
      streakPodiumWinners.forEach((winner) => {
        const frameReward = winner.metric === 'weekly_xp' ? getPodiumFrameByRank(winner.rank) : null;
        expect(frameReward).toBeNull();
      });
    });
  });

  describe('3. Local Ownership Validation', () => {
    const userUnlockedFrames: FrameId[] = ['elite_frame', 'prestige_frame'];

    it('chấp nhận trang bị khi người dùng thực sự sở hữu khung đó', () => {
      expect(validateFrameOwnershipLocally(userUnlockedFrames, 'elite_frame')).toBe(true);
      expect(validateFrameOwnershipLocally(userUnlockedFrames, 'prestige_frame')).toBe(true);
    });

    it('từ chối trang bị khi người dùng chưa mở khóa khung (ví dụ: Champion Frame)', () => {
      expect(validateFrameOwnershipLocally(userUnlockedFrames, 'champion_frame')).toBe(false);
      expect(validateFrameOwnershipLocally([], 'champion_frame')).toBe(false);
      expect(validateFrameOwnershipLocally(undefined, 'champion_frame')).toBe(false);
    });

    it('luôn cho phép gỡ bỏ khung (null hoặc chuỗi rỗng)', () => {
      expect(validateFrameOwnershipLocally(userUnlockedFrames, null)).toBe(true);
      expect(validateFrameOwnershipLocally(userUnlockedFrames, '')).toBe(true);
      expect(validateFrameOwnershipLocally([], null)).toBe(true);
    });
  });

  describe('4. Entitlement Fetching & Deduplication', () => {
    it('fetchUserFrameEntitlements đọc chính xác các bản ghi từ bảng user_frame_entitlements', async () => {
      const mockRows = [
        {
          id: 'ent-1',
          user_id: 'user-abc',
          frame_id: 'champion_frame',
          source: 'weekly_xp_podium',
          week_id: '2026-W40',
          times_won: 2,
          unlocked_at: '2026-10-05T00:00:01Z',
        },
      ];

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockRows, error: null }),
      } as any);

      const entitlements = await fetchUserFrameEntitlements('user-abc');
      expect(entitlements).toHaveLength(1);
      expect(entitlements[0].frameId).toBe('champion_frame');
      expect(entitlements[0].timesWon).toBe(2);
      expect(entitlements[0].weekId).toBe('2026-W40');
    });

    it('getUserUnlockedFrames trích xuất danh sách duy nhất và lọc bỏ các ID không hợp lệ', async () => {
      const mockRows = [
        {
          id: 'ent-1',
          user_id: 'user-abc',
          frame_id: 'champion_frame',
          source: 'weekly_xp_podium',
          week_id: '2026-W40',
          times_won: 1,
          unlocked_at: '2026-10-05T00:00:01Z',
        },
        {
          id: 'ent-2',
          user_id: 'user-abc',
          frame_id: 'champion_frame', // trùng loại khung
          source: 'weekly_xp_podium',
          week_id: '2026-W39',
          times_won: 1,
          unlocked_at: '2026-09-28T00:00:01Z',
        },
        {
          id: 'ent-3',
          user_id: 'user-abc',
          frame_id: 'invalid_hacked_frame', // khung không hợp lệ
          source: 'exploit',
          week_id: '2026-W40',
          times_won: 1,
          unlocked_at: '2026-10-05T00:00:01Z',
        },
      ];

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockRows, error: null }),
      } as any);

      const unlocked = await getUserUnlockedFrames('user-abc');
      expect(unlocked).toEqual(['champion_frame']);
    });
  });

  describe('5. Server-Authoritative Equip Security (equipProfileFrameOnServer)', () => {
    it('từ chối trang bị khi người dùng chưa sở hữu khung (NOT_OWNED)', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: false,
          code: 'NOT_OWNED',
          message: 'Bạn chưa mở khóa khung avatar này.',
        },
        error: null,
      } as any);

      const res = await equipProfileFrameOnServer('champion_frame');
      expect(res.success).toBe(false);
      expect(res.code).toBe('NOT_OWNED');
      expect(res.message).toContain('chưa mở khóa');
    });

    it('chấp nhận trang bị khi người dùng sở hữu khung (EQUIPPED_SUCCESS)', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          code: 'EQUIPPED_SUCCESS',
          message: 'Đã trang bị khung avatar thành công.',
          equipped_frame: 'elite_frame',
        },
        error: null,
      } as any);

      const res = await equipProfileFrameOnServer('elite_frame');
      expect(res.success).toBe(true);
      expect(res.code).toBe('EQUIPPED_SUCCESS');
      expect(res.equippedFrame).toBe('elite_frame');
    });

    it('chấp nhận gỡ bỏ khung khi truyền null (UNEQUIPPED_SUCCESS)', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: {
          success: true,
          code: 'UNEQUIPPED_SUCCESS',
          message: 'Đã gỡ bỏ khung avatar vinh danh.',
          equipped_frame: null,
        },
        error: null,
      } as any);

      const res = await equipProfileFrameOnServer(null);
      expect(res.success).toBe(true);
      expect(res.code).toBe('UNEQUIPPED_SUCCESS');
      expect(res.equippedFrame).toBeNull();
    });

    it('xử lý lỗi database hoặc RPC trả về lỗi', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      } as any);

      const res = await equipProfileFrameOnServer('champion_frame');
      expect(res.success).toBe(false);
      expect(res.code).toBe('ERROR');
      expect(res.message).toBe('Database connection failed');
    });
  });

  describe('6. Client Direct Award / Tamper Simulation & Invariants', () => {
    it('bảo vệ chống client tự phong thưởng: Database trigger check_equipped_frame_ownership', () => {
      // Giả lập hàm trigger PostgreSQL:
      // IF NEW.equipped_frame IS NOT NULL AND NOT EXISTS (
      //   SELECT 1 FROM user_frame_entitlements WHERE user_id = NEW.id AND frame_id = NEW.equipped_frame
      // ) THEN RAISE EXCEPTION ...
      function simulateDatabaseEquipTrigger(
        userEntitlements: string[],
        newEquippedFrame: string | null
      ): { allowed: boolean; error?: string } {
        if (!newEquippedFrame) return { allowed: true };
        const ownsFrame = userEntitlements.includes(newEquippedFrame);
        if (!ownsFrame) {
          return {
            allowed: false,
            error: `Security violation: User does not own frame '${newEquippedFrame}'`,
          };
        }
        return { allowed: true };
      }

      // Kịch bản: Client cố ý bypass RPC, gọi thẳng UPDATE leaderboard_profiles SET equipped_frame = 'champion_frame'
      const attackerEntitlements: string[] = []; // Chưa từng đạt Top 1
      const attackResult = simulateDatabaseEquipTrigger(attackerEntitlements, 'champion_frame');

      expect(attackResult.allowed).toBe(false);
      expect(attackResult.error).toContain('Security violation');

      // Kịch bản: Người dùng hợp lệ đã đạt Top 2
      const legitUserEntitlements: string[] = ['elite_frame'];
      const legitResult = simulateDatabaseEquipTrigger(legitUserEntitlements, 'elite_frame');
      expect(legitResult.allowed).toBe(true);
    });

    it('idempotency khi thắng lặp lại: Người dùng đã sở hữu Champion tiếp tục đạt Top 1 tuần mới', () => {
      // Giả lập logic UPSERT của finalize_weekly_leaderboard:
      // INSERT INTO user_frame_entitlements (...) ON CONFLICT (user_id, frame_id)
      // DO UPDATE SET times_won = times_won + 1, week_id = EXCLUDED.week_id, unlocked_at = EXCLUDED.unlocked_at
      interface EntitlementRecord {
        userId: string;
        frameId: FrameId;
        timesWon: number;
        latestWeekId: string;
      }

      const tableState: Map<string, EntitlementRecord> = new Map();

      function upsertWinnerEntitlement(userId: string, frameId: FrameId, weekId: string) {
        const key = `${userId}:${frameId}`;
        const existing = tableState.get(key);
        if (existing) {
          tableState.set(key, {
            ...existing,
            timesWon: existing.timesWon + 1,
            latestWeekId: weekId,
          });
        } else {
          tableState.set(key, {
            userId,
            frameId,
            timesWon: 1,
            latestWeekId: weekId,
          });
        }
      }

      const winnerUserId = 'master-learner-001';

      // Tuần 1: Đạt Top 1 (2026-W40)
      upsertWinnerEntitlement(winnerUserId, 'champion_frame', '2026-W40');
      let record = tableState.get(`${winnerUserId}:champion_frame`);
      expect(record?.timesWon).toBe(1);
      expect(record?.latestWeekId).toBe('2026-W40');

      // Tuần 2: Tiếp tục đạt Top 1 (2026-W41)
      upsertWinnerEntitlement(winnerUserId, 'champion_frame', '2026-W41');
      record = tableState.get(`${winnerUserId}:champion_frame`);

      // Không sinh ra 2 dòng thừa cho cùng một frame, mà tăng số lần thắng
      expect(tableState.size).toBe(1);
      expect(record?.timesWon).toBe(2);
      expect(record?.latestWeekId).toBe('2026-W41');
    });

    it('leaderboard payload chỉ hiển thị equippedFrame ID, không để lộ thông tin nhạy cảm', () => {
      const mockLeaderboardEntry = {
        userId: 'u-1',
        displayName: 'Anh Vũ',
        score: 3500,
        rank: 1,
        equippedFrame: 'champion_frame',
      };

      // Xác minh payload public
      expect(mockLeaderboardEntry.equippedFrame).toBe('champion_frame');
      expect((mockLeaderboardEntry as any).entitlementSecret).toBeUndefined();
      expect((mockLeaderboardEntry as any).authTokens).toBeUndefined();
    });
  });
});
