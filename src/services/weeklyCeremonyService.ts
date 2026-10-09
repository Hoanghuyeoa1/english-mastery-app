import { fetchFinalizedWeeks, fetchWeeklySnapshots } from './weeklyFinalizationService';
import { getPodiumFrameByRank, FrameId } from './frameRewardService';
import { isValidUserUuid } from './leaderboardService';

export interface WeeklyCeremonyData {
  weekId: string;
  rank: 1 | 2 | 3;
  frameId: FrameId;
  score: number;
  displayName: string;
  finalizedAt: string;
}

const ACK_STORAGE_KEY = 'emh_acknowledged_weekly_ceremonies';

/**
 * Lấy danh sách weekId của các lễ trao giải đã được người dùng xem / xác nhận.
 */
export function getAcknowledgedCeremonies(): string[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(ACK_STORAGE_KEY) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Kiểm tra xem lễ trao giải của một tuần cụ thể đã được xác nhận chưa.
 */
export function isCeremonyAcknowledged(weekId: string): boolean {
  if (!weekId) return true;
  return getAcknowledgedCeremonies().includes(weekId.trim());
}

/**
 * Ghi nhận trạng thái đã xem lễ trao giải của một tuần (chống lặp lại khi refresh).
 */
export function acknowledgeCeremony(weekId: string): void {
  if (!weekId) return;
  try {
    const trimmed = weekId.trim();
    const existing = getAcknowledgedCeremonies();
    if (!existing.includes(trimmed)) {
      const updated = [...existing, trimmed];
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(updated));
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Xóa danh sách đã xác nhận (dùng cho testing/QA).
 */
export function clearAcknowledgedCeremoniesForTesting(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ACK_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

/**
 * Kiểm tra xem người dùng hiện tại có lễ trao giải tuần mới cần được vinh danh không:
 * - Dựa trên snapshot backend của tuần đã chốt gần nhất;
 * - Chỉ vinh danh Top 1, Top 2, Top 3 XP Tuần;
 * - Tuyệt đối không hiển thị lại nếu tuần đó đã được xác nhận (acknowledged).
 */
export async function checkPendingCeremony(
  userId?: string,
  _displayName?: string
): Promise<WeeklyCeremonyData | null> {
  // BẤT BIẾN CANONICAL: Chỉ trao thưởng lễ vinh danh cho tài khoản Cloud xác thực (UUID)
  // Tuyệt đối không đối soát qua displayName nhằm chống va chạm danh tính với Guest
  if (!userId || !isValidUserUuid(userId)) return null;

  try {
    // 1. Lấy tuần đã chốt gần nhất từ backend
    const finalizedWeeks = await fetchFinalizedWeeks(1);
    if (!finalizedWeeks || finalizedWeeks.length === 0) {
      return null;
    }

    const latestWeek = finalizedWeeks[0];
    if (!latestWeek.weekId || !latestWeek.isFinalized) {
      return null;
    }

    // 2. Chống lặp: Nếu đã xác nhận tuần này -> bỏ qua
    if (isCeremonyAcknowledged(latestWeek.weekId)) {
      return null;
    }

    // 3. Tải snapshot Top 3 XP của tuần đó
    const snapshots = await fetchWeeklySnapshots(latestWeek.weekId, 'weekly_xp');
    if (!snapshots || snapshots.length === 0) {
      return null;
    }

    // 4. Tìm kiếm người dùng hiện tại trong Top 3 CHỈ BẰNG canonical user_id
    const mySnapshot = snapshots.find((s) => {
      if (s.rank > 3) return false;
      return s.userId === userId;
    });

    if (!mySnapshot || mySnapshot.rank < 1 || mySnapshot.rank > 3) {
      return null;
    }

    const rank = mySnapshot.rank as 1 | 2 | 3;
    const frameId = getPodiumFrameByRank(rank);
    if (!frameId) return null;

    return {
      weekId: latestWeek.weekId,
      rank,
      frameId,
      score: mySnapshot.score,
      displayName: mySnapshot.displayName,
      finalizedAt: latestWeek.finalizedAt,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[WeeklyCeremonyService] Lỗi kiểm tra pending ceremony:', msg);
    return null;
  }
}
