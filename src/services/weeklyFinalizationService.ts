import { 
  getVietnamWeekId, 
  LEADERBOARD_UTC_OFFSET_HOURS,
  getAuthoritativeServerNow,
  setServerTimeAnchor
} from './leaderboardService';
import {
  finalizeWeeklyLeaderboard as finalizeWeeklyLeaderboardApi,
  fetchWeeklySnapshots as fetchWeeklySnapshotsApi,
  fetchFinalizedWeeks as fetchFinalizedWeeksApi,
} from './api/weeklyFinalizationApi';
import type { 
  LeaderboardMetric, 
  WeeklyFinalizationRecord, 
  WeeklySnapshotEntry, 
  WeeklyFinalizationResponse 
} from '../types';

/**
 * Lấy Deterministic Week ID của tuần trước (tuần đã kết thúc gần nhất theo lịch Việt Nam).
 * Ví dụ: nếu tuần hiện tại là '2026-W41', tuần trước là '2026-W40'.
 */
export function getPreviousVietnamWeekId(refDate: Date = new Date()): string {
  const prevDate = new Date(refDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  return getVietnamWeekId(prevDate);
}

/**
 * Phân tích Deterministic Week ID ('YYYY-Www') thành mốc weekStart và weekEnd (theo lịch Việt Nam, trả về UTC timestamp).
 * weekStart: Thứ Hai 00:00:00.000 VN = Chủ Nhật 17:00:00.000 UTC
 * weekEnd:   Thứ Hai 00:00:00.000 VN kế tiếp = Chủ Nhật 17:00:00.000 UTC kế tiếp [start, end)
 */
export function getVietnamWeekRangeById(weekId: string): { weekStart: Date; weekEnd: Date } {
  const trimmed = weekId.trim();
  const match = trimmed.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    throw new Error(`Định dạng weekId không hợp lệ: "${weekId}". Kỳ vọng chuẩn ISO (ví dụ: "2026-W41").`);
  }

  const year = parseInt(match[1], 10);
  const weekNo = parseInt(match[2], 10);

  // Ngày 4 tháng 1 luôn nằm trong ISO Week 1 của năm đó
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7; // 0: Thứ Hai
  const week1MondayLocalMs = Date.UTC(year, 0, 4 - jan4Day, 0, 0, 0, 0);

  const targetMondayLocalMs = week1MondayLocalMs + (weekNo - 1) * 7 * 86400000;
  const nextMondayLocalMs = targetMondayLocalMs + 7 * 86400000;

  // Chuyển mốc thứ Hai 00:00:00 VN sang timestamp UTC (-7 giờ)
  const weekStart = new Date(targetMondayLocalMs - LEADERBOARD_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  const weekEnd = new Date(nextMondayLocalMs - LEADERBOARD_UTC_OFFSET_HOURS * 60 * 60 * 1000);

  return { weekStart, weekEnd };
}

// Canonical Aliases for System-wide Consistency
export const getPreviousUtcWeekId = getPreviousVietnamWeekId;
export const getUtcWeekRangeById = getVietnamWeekRangeById;

/**
 * Kiểm tra tính hợp lệ về mặt thời gian của server:
 * Chỉ cho phép chốt tuần khi thời gian máy chủ (serverTime) đã đạt hoặc vượt qua mốc kết thúc tuần (weekEnd).
 */
export function isWeekFinalizable(weekEnd: Date, serverTime: Date = getAuthoritativeServerNow()): boolean {
  return serverTime.getTime() >= weekEnd.getTime();
}

/**
 * Gọi ASP.NET Core API Server-Authoritative để chốt bảng xếp hạng tuần:
 * - Thực thi trong transaction duy nhất qua Execution Strategy;
 * - Idempotency bảo vệ chống chốt trùng;
 * - Snapshot Top 3 XP (champion_frame, elite_frame, prestige_frame) & Top 3 Streak;
 * - Trao giải UserFrameEntitlements cho Top 3 XP.
 */
export async function finalizeWeeklyLeaderboardOnServer(
  weekId?: string,
  topLimit = 3
): Promise<WeeklyFinalizationResponse> {
  try {
    const res = await finalizeWeeklyLeaderboardApi(weekId, topLimit);

    if (res.serverNow) {
      setServerTimeAnchor(
        new Date(res.serverNow).getTime(),
        res.weekId ? String(res.weekId) : undefined,
        'RPC'
      );
    }

    return {
      success: res.success,
      code: res.code as WeeklyFinalizationResponse['code'],
      message: res.message,
      weekId: res.weekId,
      weekStart: res.weekStart,
      weekEnd: res.weekEnd,
      finalizedAt: res.finalizedAt,
      totalParticipants: res.totalParticipants,
      isIdempotent: res.isIdempotent,
      serverNow: res.serverNow,
      snapshotsCreated: res.snapshotsCreated ? {
        weekly_xp: res.snapshotsCreated.filter((s) => s.category === 'weekly_xp').length,
        streak: res.snapshotsCreated.filter((s) => s.category === 'streak').length,
      } : undefined,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[WeeklyFinalization] Exception khi gọi finalizeWeeklyLeaderboardOnServer:', msg);
    return {
      success: false,
      code: 'ERROR',
      message: msg,
    };
  }
}

/**
 * Tải danh sách ảnh chụp kết quả tuần (Weekly Snapshots) từ ASP.NET Core API.
 */
export async function fetchWeeklySnapshots(
  weekId: string,
  category: LeaderboardMetric = 'weekly_xp'
): Promise<WeeklySnapshotEntry[]> {
  try {
    const dtos = await fetchWeeklySnapshotsApi(weekId, category);
    return dtos.map((s) => ({
      id: s.id,
      weekId: s.weekId,
      category: s.category as LeaderboardMetric,
      userId: s.userId,
      displayName: s.displayName || 'Học viên ẩn danh',
      avatarUrl: s.avatarUrl,
      level: s.level || 1,
      rank: s.rank || 1,
      score: Number(s.score) || 0,
      secondaryScore: Number(s.secondaryScore) || 0,
      finalizedAt: s.finalizedAt || '',
    }));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[WeeklyFinalization] Exception khi tải snapshots:', msg);
    return [];
  }
}

/**
 * Tải danh sách các tuần đã được chốt (Finalized Weeks History) từ ASP.NET Core API.
 */
export async function fetchFinalizedWeeks(limit = 10): Promise<WeeklyFinalizationRecord[]> {
  try {
    const dtos = await fetchFinalizedWeeksApi(limit);
    return dtos.map((w) => {
      let parsedMetadata: Record<string, unknown> | undefined;
      if (w.metadataJson) {
        try {
          parsedMetadata = JSON.parse(w.metadataJson);
        } catch {
          // ignore
        }
      }

      return {
        weekId: w.weekId,
        weekStart: w.weekStart,
        weekEnd: w.weekEnd,
        finalizedAt: w.finalizedAt,
        totalParticipants: w.totalParticipants || 0,
        isFinalized: Boolean(w.isFinalized),
        metadata: parsedMetadata,
      };
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[WeeklyFinalization] Exception khi tải danh sách tuần:', msg);
    return [];
  }
}
