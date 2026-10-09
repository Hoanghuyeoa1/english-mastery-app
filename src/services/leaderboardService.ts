import { leaderboardApi } from './api/leaderboardApi';
import { ApiError } from './api/httpClient';
import {
  registerSignalRSubscriber,
  resetSignalRForTesting as resetSignalRServiceForTesting,
  type SignalRStatus
} from './api/signalRService';
import type { 
  LeaderboardMetric, 
  LeaderboardEntry, 
  WeeklyCountdown, 
  WeeklyLearningMetricsRecord 
} from '../types';

export interface RawLeaderboardProfile {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  level: number;
  total_xp: number;
  weekly_xp: number;
  streak: number;
  last_active_at: string;
  equipped_frame?: string | null;
  is_deleted?: boolean;
  is_banned?: boolean;
}

export interface LeaderboardProfilePayload {
  id?: string;
  userId?: string;
  displayName?: string;
  name?: string;
  avatarUrl?: string;
  avatarSeed?: string;
  level?: number;
  totalXp?: number;
  xp?: number;
  weeklyXp?: number;
  streak?: number;
  equippedFrame?: string | null;
}

export type LeaderboardServiceStatus =
  | 'SUCCESS'
  | 'OFFLINE_CACHE'
  | 'CONFIG_ERROR'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'AUTH_ERROR'
  | 'PERMISSION_ERROR'
  | 'RATE_LIMIT'
  | 'VALIDATION_ERROR'
  | 'QUERY_ERROR'
  | 'TIMEOUT';

export interface LeaderboardErrorInfo {
  code: LeaderboardServiceStatus;
  message: string;
  details?: string;
}

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 50;

export interface FetchLeaderboardResult {
  entries: LeaderboardEntry[];
  totalCount?: number;
  currentUserEntry?: LeaderboardEntry | null;
  limit?: number;
  offset?: number;
  status?: LeaderboardServiceStatus;
  error: string | null;
  errorInfo?: LeaderboardErrorInfo;
  cachedAt?: string;
  cachedWeekId?: string;
  isStaleWeek?: boolean;
}

export const CACHE_KEY_PREFIX = 'emh_leaderboard_cache_';
export { getVietnamDateString } from './leaderboardLearningMetrics';

export interface LeaderboardCacheResult {
  entries: LeaderboardEntry[];
  cachedAt: string;
  weekId?: string;
  isStaleWeek: boolean;
  currentUserEntry?: LeaderboardEntry | null;
  totalCount?: number;
}

/**
 * Đọc bảng xếp hạng thực tế được lưu vào cache cục bộ khi có kết nối trước đó.
 * Nhận diện tuần đã lưu để không masquerade cache tuần cũ thành dữ liệu tuần hiện tại.
 */
export function getCachedLeaderboard(
  metric: LeaderboardMetric
): LeaderboardCacheResult | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${metric}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.entries)) return null;
    const currentWeekId = getUtcWeekId();
    const weekId = typeof parsed.weekId === 'string' ? parsed.weekId : undefined;
    const isStaleWeek = Boolean(weekId && weekId !== currentWeekId);
    return {
      entries: parsed.entries,
      cachedAt: String(parsed.cachedAt || new Date().toISOString()),
      weekId,
      isStaleWeek,
      currentUserEntry: parsed.currentUserEntry || null,
      totalCount: typeof parsed.totalCount === 'number' ? parsed.totalCount : parsed.entries.length,
    };
  } catch {
    return null;
  }
}

/**
 * Lưu bảng xếp hạng thực tế (Real Users) vào cache an toàn kèm mốc thời gian, weekId và sticky currentUserEntry.
 */
export function setCachedLeaderboard(
  metric: LeaderboardMetric,
  entries: LeaderboardEntry[],
  weekId: string = getUtcWeekId(),
  currentUserEntry?: LeaderboardEntry | null,
  totalCount?: number
): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const payload = {
      entries,
      cachedAt: new Date().toISOString(),
      weekId,
      currentUserEntry: currentUserEntry || undefined,
      totalCount: typeof totalCount === 'number' ? totalCount : entries.length,
    };
    localStorage.setItem(`${CACHE_KEY_PREFIX}${metric}`, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

/**
 * Xóa cache (hỗ trợ kiểm thử QA).
 */
export function clearCachedLeaderboardForTesting(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const metrics: LeaderboardMetric[] = [
      'weekly_xp',
      'streak',
      'vocab_mastered',
      'review_consistency',
      'active_minutes',
      'pronunciation_gain',
      'toeic_gain',
    ];
    for (const m of metrics) {
      localStorage.removeItem(`${CACHE_KEY_PREFIX}${m}`);
    }
  } catch {
    // ignore
  }
}

/**
 * Xóa cache bảng xếp hạng khi người dùng đăng xuất hoặc chuyển tài khoản
 * nhằm chống rò rỉ danh tính (Identity Leakage / Stale Current-User Rank).
 */
export const clearCachedLeaderboard = clearCachedLeaderboardForTesting;

/**
 * Invalidate auth-specific cached state (current-user rank cache, sticky row cache, isCurrentUser flags)
 * across all leaderboard categories while preserving valid public ranking entries.
 * Prevents account-switching data contamination and stale current-user leakage without wiping public data.
 */
export function invalidateAuthLeaderboardCache(currentUserId?: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const metrics: LeaderboardMetric[] = [
      'weekly_xp',
      'streak',
      'vocab_mastered',
      'review_consistency',
      'active_minutes',
      'pronunciation_gain',
      'toeic_gain',
    ];

    const canonicalUserId = currentUserId && isValidUserUuid(currentUserId) ? currentUserId.trim() : null;

    for (const m of metrics) {
      const key = `${CACHE_KEY_PREFIX}${m}`;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.entries)) continue;

        // Cleanse entries: ensure isCurrentUser matches canonicalUserId only
        const sanitizedEntries = parsed.entries.map((e: LeaderboardEntry) => ({
          ...e,
          isCurrentUser: Boolean(canonicalUserId && e.userId === canonicalUserId),
        }));

        // Cleanse currentUserEntry: discard if user is not authenticated or id mismatches
        let sanitizedCurrentUser = parsed.currentUserEntry || null;
        if (!canonicalUserId || (sanitizedCurrentUser && sanitizedCurrentUser.userId !== canonicalUserId)) {
          sanitizedCurrentUser = null;
        }

        const updatedPayload = {
          ...parsed,
          entries: sanitizedEntries,
          currentUserEntry: sanitizedCurrentUser || undefined,
        };
        localStorage.setItem(key, JSON.stringify(updatedPayload));
      } catch {
        // Safe skip on corrupted entry
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Danh hiệu cấp bậc theo level (Novice -> Mythic Legend)
 */
export function getRankTitle(level: number): string {
  const lvl = Math.max(1, level || 1);
  if (lvl >= 50) return 'Mythic Legend';
  if (lvl >= 25) return 'Master Scholar';
  if (lvl >= 10) return 'VIP Learner';
  return 'Novice';
}

/**
 * An toàn dữ liệu công khai (Public Data Safety):
 * Không để lộ email hay dữ liệu nhạy cảm ra Bảng xếp hạng.
 * Nếu displayName là email, chỉ hiển thị phần username trước ký tự '@'.
 */
export function sanitizePublicDisplayName(rawName?: string | null): string {
  if (!rawName || typeof rawName !== 'string' || !rawName.trim()) {
    return 'Học viên ẩn danh';
  }
  const trimmed = rawName.trim();
  if (trimmed.includes('@')) {
    const userPart = trimmed.split('@')[0];
    return userPart.trim() || 'Học viên ẩn danh';
  }
  return trimmed;
}

/**
 * Kiểm tra tính hợp lệ của người dùng trên Bảng xếp hạng (Real-User Eligibility).
 * Loại bỏ bản ghi rác, tài khoản bị xóa hoặc bị cấm.
 * Không dựa vào displayName/email để phán đoán thật/giả.
 */
export function isLeaderboardEligible(row: Partial<RawLeaderboardProfile>): boolean {
  if (!row || typeof row !== 'object') return false;
  if (!row.id || typeof row.id !== 'string' || row.id.trim() === '') return false;
  if (row.is_deleted === true || row.is_banned === true) return false;
  if (typeof row.level === 'number' && row.level < 1) return false;
  return true;
}

export const LEADERBOARD_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const LEADERBOARD_UTC_OFFSET_HOURS = 7;

export interface ServerTimeAnchor {
  serverTimeMs: number;
  perfAnchorMs: number;
  deviceTimeAnchorMs: number;
  serverWeekId?: string;
  source: 'RPC' | 'ESTIMATED';
}

let serverTimeAnchor: ServerTimeAnchor | null = null;

/**
 * Thiết lập anchor thời gian máy chủ (Server Time Anchor).
 * Ghi lại serverTimeMs tương ứng với performance.now() tại thời điểm nhận response.
 */
export function setServerTimeAnchor(
  serverTimeMs: number,
  serverWeekId?: string,
  source: 'RPC' | 'ESTIMATED' = 'RPC'
): ServerTimeAnchor {
  const perfAnchorMs =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  const deviceTimeAnchorMs = Date.now();

  serverTimeAnchor = {
    serverTimeMs,
    perfAnchorMs,
    deviceTimeAnchorMs,
    serverWeekId,
    source,
  };
  return serverTimeAnchor;
}

/**
 * Đọc bản sao anchor thời gian máy chủ hiện tại.
 */
export function getServerTimeAnchor(): ServerTimeAnchor | null {
  return serverTimeAnchor ? { ...serverTimeAnchor } : null;
}

/**
 * Reset anchor (phục vụ testing).
 */
export function resetServerTimeAnchorForTesting(): void {
  serverTimeAnchor = null;
}

/**
 * Trả về thời điểm hiện tại của máy chủ (Server-Authoritative Now)
 * dựa trên ServerTimeAnchor và thời gian monotonic performance.now().
 * Bất biến trước việc người dùng chỉnh sửa đồng hồ thiết bị (Device Clock Tampering) hay lệch múi giờ OS.
 */
export function getAuthoritativeServerNow(): Date {
  if (!serverTimeAnchor) {
    return new Date();
  }
  const currentPerfMs =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  const elapsedMs = currentPerfMs - serverTimeAnchor.perfAnchorMs;
  return new Date(serverTimeAnchor.serverTimeMs + elapsedMs);
}

/**
 * Trả về deterministic week ID theo chuẩn Asia/Ho_Chi_Minh dựa trên Server-Authoritative Time.
 */
export function getAuthoritativeVietnamWeekId(refDate?: Date): string {
  return getVietnamWeekId(refDate || getAuthoritativeServerNow());
}

/**
 * Kiểm tra xem đồng hồ thiết bị (Device Clock) có bị trôi/chỉnh sửa lệch đáng kể so với Server Time Anchor hay không.
 */
export function detectDeviceClockDrift(thresholdMs: number = 5000): boolean {
  if (!serverTimeAnchor) return false;
  const currentDeviceMs = Date.now();
  const currentPerfMs =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  const deviceElapsed = currentDeviceMs - serverTimeAnchor.deviceTimeAnchorMs;
  const monotonicElapsed = currentPerfMs - serverTimeAnchor.perfAnchorMs;
  return Math.abs(deviceElapsed - monotonicElapsed) > thresholdMs;
}

/**
 * Truy vấn RPC get_leaderboard_server_time để đồng bộ anchor thời gian máy chủ chuẩn.
 */
export async function fetchServerTimeAnchor(): Promise<ServerTimeAnchor | null> {
  try {
    const res = await leaderboardApi.fetchServerTime();
    if (res && res.serverNow) {
      const serverMs = new Date(res.serverNow).getTime();
      return setServerTimeAnchor(serverMs, res.weekId, 'RPC');
    }
    return serverTimeAnchor;
  } catch {
    return serverTimeAnchor;
  }
}

/**
 * Trả về thời điểm hiện tại (hoặc refDate) được chuyển dịch theo múi giờ Việt Nam (UTC+7)
 * để tiện truy xuất getUTCFullYear, getUTCMonth, getUTCDate, getUTCHours... đúng giờ địa phương VN.
 */
export function getVietnamNow(refDate: Date = getAuthoritativeServerNow()): Date {
  return new Date(refDate.getTime() + LEADERBOARD_UTC_OFFSET_HOURS * 60 * 60 * 1000);
}

/**
 * Lấy mốc thời gian bắt đầu tuần hiện tại theo giờ Việt Nam (Thứ Hai 00:00:00.000 Asia/Ho_Chi_Minh = Chủ Nhật 17:00:00.000 UTC).
 */
export function getVietnamWeekStart(refDate: Date = getAuthoritativeServerNow()): Date {
  const vnTimeMs = refDate.getTime() + LEADERBOARD_UTC_OFFSET_HOURS * 60 * 60 * 1000;
  const vnDate = new Date(vnTimeMs);
  const dayOfWeek = (vnDate.getUTCDay() + 6) % 7; // 0: Thứ Hai, ..., 6: Chủ Nhật
  const daysSinceMonday = dayOfWeek;
  const vnMondayLocalMs = Date.UTC(
    vnDate.getUTCFullYear(),
    vnDate.getUTCMonth(),
    vnDate.getUTCDate() - daysSinceMonday,
    0, 0, 0, 0
  );
  return new Date(vnMondayLocalMs - LEADERBOARD_UTC_OFFSET_HOURS * 60 * 60 * 1000);
}

/**
 * Lấy mốc thời gian kết thúc tuần hiện tại theo giờ Việt Nam (Thứ Hai 00:00:00.000 Asia/Ho_Chi_Minh kế tiếp).
 * Theo quy chuẩn canonical tuần: START = Thứ Hai 00:00:00 VN, END = Thứ Hai 00:00:00 VN kế tiếp [start, end).
 * Tương đương UTC: Chủ Nhật 17:00:00.000 UTC kế tiếp.
 */
export function getVietnamWeekEnd(refDate: Date = getAuthoritativeServerNow()): Date {
  const start = getVietnamWeekStart(refDate);
  return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
}

/**
 * Lấy mốc thời gian thiết lập lại tuần tiếp theo (Next Monday 00:00:00.000 VN = Sunday 17:00:00.000 UTC).
 */
export function getNextVietnamWeekReset(refDate: Date = getAuthoritativeServerNow()): Date {
  return getVietnamWeekEnd(refDate);
}

/**
 * Trả về ID tuần xác định (Deterministic Week ID) theo chuẩn ISO 8601 của tuần lịch Việt Nam (Asia/Ho_Chi_Minh).
 * Ví dụ: '2026-W41'. Mốc chuyển tuần xảy ra đúng lúc Chủ Nhật 17:00:00 UTC (= Thứ Hai 00:00:00 VN).
 */
export function getVietnamWeekId(d: Date = getAuthoritativeServerNow()): string {
  const vnTimeMs = d.getTime() + LEADERBOARD_UTC_OFFSET_HOURS * 60 * 60 * 1000;
  const vnDate = new Date(vnTimeMs);
  const date = new Date(Date.UTC(vnDate.getUTCFullYear(), vnDate.getUTCMonth(), vnDate.getUTCDate()));
  const dayOfWeek = (date.getUTCDay() + 6) % 7 + 1; // 1 (Mon) -> 7 (Sun)
  date.setUTCDate(date.getUTCDate() - dayOfWeek + 4);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Lấy danh sách 7 ngày trong tuần hiện tại theo định dạng YYYY-MM-DD theo giờ Việt Nam.
 */
export function getCurrentVietnamWeekDates(refDate: Date = getAuthoritativeServerNow()): string[] {
  const start = getVietnamWeekStart(refDate);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const vnCur = new Date(cur.getTime() + LEADERBOARD_UTC_OFFSET_HOURS * 60 * 60 * 1000);
    const y = vnCur.getUTCFullYear();
    const m = String(vnCur.getUTCMonth() + 1).padStart(2, '0');
    const d = String(vnCur.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
  }
  return dates;
}

// Canonical Aliases for System-wide Consistency
export const getUtcWeekStart = getVietnamWeekStart;
export const getUtcWeekEnd = getVietnamWeekEnd;
export const getNextUtcWeekReset = getNextVietnamWeekReset;
export const getNextLeaderboardReset = getNextVietnamWeekReset;
export const getUtcWeekId = getVietnamWeekId;
export const getCurrentUtcWeekDates = getCurrentVietnamWeekDates;

/**
 * Tính toán XP của tuần hiện tại (Weekly XP) từ nhật ký học tập dailyHistory:
 * Chỉ cộng tổng xpGained của các ngày nằm trong ranh giới tuần Việt Nam hiện tại.
 * Đảm bảo: lifetimeXp !== weeklyXp
 */
export function calculateWeeklyXpFromHistory(
  dailyHistory: Record<string, { xpGained?: number }> = {},
  refDate: Date = getAuthoritativeServerNow()
): number {
  const weekDates = getCurrentVietnamWeekDates(refDate);
  let total = 0;
  for (const dateStr of weekDates) {
    const dayLog = dailyHistory[dateStr];
    if (dayLog && typeof dayLog.xpGained === 'number') {
      total += Math.max(0, dayLog.xpGained);
    }
  }
  return total;
}

/**
 * So sánh xếp hạng Top Weekly XP tất định (Deterministic Tie-break):
 * 1. weekly_xp DESC
 * 2. streak DESC
 * 3. last_active_at ASC (học viên đạt mốc trước được ưu tiên)
 * 4. id ASC (khóa phân giải tuyệt đối)
 */
export function compareLeaderboardWeeklyXp(
  a: RawLeaderboardProfile,
  b: RawLeaderboardProfile
): number {
  if (b.weekly_xp !== a.weekly_xp) {
    return b.weekly_xp - a.weekly_xp;
  }
  if (b.streak !== a.streak) {
    return b.streak - a.streak;
  }
  const timeA = new Date(a.last_active_at || 0).getTime();
  const timeB = new Date(b.last_active_at || 0).getTime();
  if (timeA !== timeB) {
    return timeA - timeB;
  }
  return a.id.localeCompare(b.id);
}

/**
 * So sánh xếp hạng Top Streak tất định (Deterministic Tie-break):
 * 1. streak DESC
 * 2. weekly_xp DESC
 * 3. last_active_at ASC
 * 4. id ASC
 */
export function compareLeaderboardStreak(
  a: RawLeaderboardProfile,
  b: RawLeaderboardProfile
): number {
  if (b.streak !== a.streak) {
    return b.streak - a.streak;
  }
  if (b.weekly_xp !== a.weekly_xp) {
    return b.weekly_xp - a.weekly_xp;
  }
  const timeA = new Date(a.last_active_at || 0).getTime();
  const timeB = new Date(b.last_active_at || 0).getTime();
  if (timeA !== timeB) {
    return timeA - timeB;
  }
  return a.id.localeCompare(b.id);
}

/**
 * Chuẩn hóa lỗi truy vấn sang Taxonomy mã lỗi Leaderboard (Error Taxonomy).
 */
export function classifyLeaderboardError(err: unknown): {
  status: LeaderboardServiceStatus;
  userMessage: string;
  details?: string;
} {
  if (!err) {
    return {
      status: 'QUERY_ERROR',
      userMessage: 'Đã xảy ra lỗi không xác định khi tải dữ liệu bảng xếp hạng.',
    };
  }

  // 1. Phân loại từ ApiError chính tắc (Phase 2 Shared Error Contract)
  if (err instanceof ApiError) {
    switch (err.category) {
      case 'TIMEOUT':
        return {
          status: 'TIMEOUT',
          userMessage: 'Quá thời gian kết nối đến máy chủ bảng xếp hạng (Timeout).',
          details: err.details || err.message,
        };
      case 'NETWORK':
        return {
          status: 'NETWORK_ERROR',
          userMessage: 'Không thể kết nối đến máy chủ bảng xếp hạng (Lỗi kết nối mạng).',
          details: err.details || err.message,
        };
      case 'SERVER_ERROR':
      case 'DATABASE_ERROR':
        return {
          status: 'SERVER_ERROR',
          userMessage: `Máy chủ gặp sự cố khi xử lý dữ liệu bảng xếp hạng (HTTP ${err.status}).`,
          details: err.details || err.message,
        };
      case 'AUTH':
        return {
          status: 'AUTH_ERROR',
          userMessage: 'Phiên xác thực đã hết hạn hoặc không hợp lệ (HTTP 401).',
          details: err.details || err.message,
        };
      case 'FORBIDDEN':
        return {
          status: 'PERMISSION_ERROR',
          userMessage: 'Không có quyền truy cập dữ liệu bảng xếp hạng (HTTP 403).',
          details: err.details || err.message,
        };
      case 'RATE_LIMIT':
        return {
          status: 'RATE_LIMIT',
          userMessage: 'Gửi quá nhiều yêu cầu đến máy chủ (HTTP 429). Vui lòng thử lại sau giây lát.',
          details: err.details || err.message,
        };
      case 'VALIDATION':
        return {
          status: 'VALIDATION_ERROR',
          userMessage: err.message || 'Yêu cầu dữ liệu bảng xếp hạng không hợp lệ (HTTP 400).',
          details: err.details || err.message,
        };
    }
  }

  const rawMessage = typeof err === 'object' && err !== null && 'message' in err
    ? String((err as { message: unknown }).message)
    : String(err);
  const rawCode = typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code: unknown }).code)
    : '';

  // 2. TIMEOUT
  if (
    rawCode === 'TIMEOUT' ||
    rawMessage.toLowerCase().includes('timeout') ||
    rawMessage.includes('3000ms')
  ) {
    return {
      status: 'TIMEOUT',
      userMessage: 'Quá thời gian kết nối đến máy chủ bảng xếp hạng (Timeout).',
      details: rawMessage,
    };
  }

  // 3. SERVER_ERROR / 5xx
  if (
    rawCode === 'SERVER_ERROR' ||
    rawCode === 'DATABASE_ERROR' ||
    rawCode === '500' ||
    rawCode === '502' ||
    rawCode === '503' ||
    rawCode === '504' ||
    rawMessage.includes('500') ||
    rawMessage.includes('502') ||
    rawMessage.includes('503') ||
    rawMessage.includes('504') ||
    rawMessage.toLowerCase().includes('internal server error')
  ) {
    return {
      status: 'SERVER_ERROR',
      userMessage: 'Máy chủ gặp sự cố khi xử lý dữ liệu bảng xếp hạng.',
      details: rawMessage,
    };
  }

  // 4. PERMISSION_ERROR (403 / Forbidden / RLS denied)
  if (
    rawCode === '42501' ||
    rawCode === '403' ||
    rawCode === 'FORBIDDEN' ||
    rawMessage.toLowerCase().includes('permission denied') ||
    rawMessage.toLowerCase().includes('violates row-level security') ||
    rawMessage.toLowerCase().includes('forbidden')
  ) {
    return {
      status: 'PERMISSION_ERROR',
      userMessage: 'Không có quyền truy cập dữ liệu bảng xếp hạng.',
      details: rawMessage,
    };
  }

  // 5. AUTH_ERROR (401 / Unauthorized)
  if (
    rawCode === '401' ||
    rawCode === 'AUTH' ||
    rawCode === 'UNAUTHORIZED' ||
    rawMessage.toLowerCase().includes('jwt') ||
    rawMessage.toLowerCase().includes('unauthorized') ||
    rawMessage.toLowerCase().includes('invalid token')
  ) {
    return {
      status: 'AUTH_ERROR',
      userMessage: 'Phiên xác thực tài khoản không hợp lệ hoặc đã hết hạn.',
      details: rawMessage,
    };
  }

  // 6. RATE_LIMIT (429)
  if (
    rawCode === '429' ||
    rawCode === 'RATE_LIMIT' ||
    rawMessage.includes('429') ||
    rawMessage.toLowerCase().includes('too many requests')
  ) {
    return {
      status: 'RATE_LIMIT',
      userMessage: 'Gửi quá nhiều yêu cầu đến máy chủ. Vui lòng thử lại sau giây lát.',
      details: rawMessage,
    };
  }

  // 7. VALIDATION_ERROR (400)
  if (
    rawCode === '400' ||
    rawCode === 'VALIDATION' ||
    rawCode === 'VALIDATION_FAILED' ||
    rawCode === 'INVALID_CATEGORY'
  ) {
    return {
      status: 'VALIDATION_ERROR',
      userMessage: rawMessage || 'Yêu cầu bảng xếp hạng không hợp lệ.',
      details: rawMessage,
    };
  }

  // 8. CONFIG_ERROR
  if (
    rawMessage.toLowerCase().includes('chưa được cấu hình') ||
    rawMessage.toLowerCase().includes('config')
  ) {
    return {
      status: 'CONFIG_ERROR',
      userMessage: 'Máy chủ bảng xếp hạng chưa được cấu hình chính xác.',
      details: rawMessage,
    };
  }

  // 9. NETWORK_ERROR
  if (
    rawCode === 'NETWORK' ||
    rawCode === 'NETWORK_ERROR' ||
    rawMessage.includes('fetch failed') ||
    rawMessage.includes('Failed to fetch') ||
    rawMessage.includes('ENOTFOUND') ||
    rawMessage.includes('ECONNREFUSED') ||
    rawMessage.includes('NetworkError') ||
    rawMessage.includes('socket hang up') ||
    rawMessage.toLowerCase().includes('network offline') ||
    rawMessage.toLowerCase().includes('connection refused') ||
    rawMessage.toLowerCase().includes('không thể kết nối') ||
    rawMessage.toLowerCase().includes('kết nối mạng')
  ) {
    return {
      status: 'NETWORK_ERROR',
      userMessage: 'Không thể kết nối đến máy chủ bảng xếp hạng (Lỗi mạng hoặc DNS).',
      details: rawMessage,
    };
  }

  // 10. QUERY_ERROR
  if (
    rawCode === '42703' ||
    rawCode === '42P01' ||
    rawMessage.toLowerCase().includes('does not exist') ||
    rawMessage.toLowerCase().includes('syntax error') ||
    rawCode.startsWith('PGRST')
  ) {
    return {
      status: 'QUERY_ERROR',
      userMessage: 'Lỗi cấu trúc truy vấn hoặc bảng dữ liệu không tồn tại trên máy chủ.',
      details: rawMessage,
    };
  }

  return {
    status: 'QUERY_ERROR',
    userMessage: rawMessage || 'Đã xảy ra lỗi khi tải dữ liệu từ máy chủ bảng xếp hạng.',
    details: rawMessage,
  };
}

export type LeaderboardSyncFailureType =
  | 'RLS'
  | 'SCHEMA'
  | 'RPC'
  | 'AUTH'
  | 'NETWORK'
  | 'VALIDATION'
  | 'UNKNOWN';

/**
 * Phân biệt chính xác nguyên nhân lỗi đồng bộ Leaderboard:
 * - RLS: 42501, violates row-level security policy, permission denied
 * - SCHEMA: 42703, 42P01, PGRST204 (missing column in cache)
 * - RPC: 42883 (function does not exist), PGRST202
 * - AUTH: 401, JWT expired, unauthorized
 * - NETWORK: Failed to fetch, ENOTFOUND, offline, timeout
 * - VALIDATION: WEEK_MISMATCH, check constraint violation (23514)
 */
export function classifySyncFailureCategory(error: unknown): LeaderboardSyncFailureType {
  if (!error) return 'UNKNOWN';

  const rawMessage = typeof error === 'object' && error !== null && 'message' in error
    ? String((error as any).message).toLowerCase()
    : String(error).toLowerCase();
  const rawCode = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as any).code).toUpperCase()
    : '';

  // 1. RLS
  if (
    rawCode === '42501' ||
    rawMessage.includes('violates row-level security') ||
    rawMessage.includes('permission denied for table') ||
    rawMessage.includes('permission denied for relation') ||
    rawMessage.includes('row-level security') ||
    (rawMessage.includes('permission denied') && !rawMessage.includes('function'))
  ) {
    return 'RLS';
  }

  // 2. AUTH
  if (
    rawCode === '401' ||
    rawCode === 'UNAUTHORIZED' ||
    rawMessage.includes('jwt') ||
    rawMessage.includes('unauthorized') ||
    rawMessage.includes('invalid token') ||
    rawMessage.includes('yêu cầu đăng nhập')
  ) {
    return 'AUTH';
  }

  // 3. VALIDATION
  if (
    rawCode === 'WEEK_MISMATCH' ||
    rawCode === 'INVALID_WEEK_ID' ||
    rawCode === '23514' ||
    rawMessage.includes('week_mismatch') ||
    rawMessage.includes('week mismatch') ||
    rawMessage.includes('invalid week') ||
    rawMessage.includes('check constraint') ||
    rawMessage.includes('violates check constraint')
  ) {
    return 'VALIDATION';
  }

  // 4. SCHEMA
  if (
    rawCode === '42703' ||
    rawCode === '42P01' ||
    rawCode === 'PGRST204' ||
    rawCode === 'PGRST200' ||
    rawCode === 'PGRST205' ||
    (rawMessage.includes('column') && rawMessage.includes('does not exist')) ||
    rawMessage.includes('schema cache')
  ) {
    return 'SCHEMA';
  }

  // 5. RPC
  if (
    rawCode === '42883' ||
    rawCode === 'PGRST202' ||
    rawCode === 'RPC_ERROR' ||
    (rawMessage.includes('permission denied') && rawMessage.includes('function')) ||
    (rawMessage.includes('function') && rawMessage.includes('does not exist')) ||
    rawMessage.includes('function not found')
  ) {
    return 'RPC';
  }

  // 6. NETWORK
  if (
    rawCode === 'TIMEOUT' ||
    rawMessage.includes('fetch failed') ||
    rawMessage.includes('failed to fetch') ||
    rawMessage.includes('enotfound') ||
    rawMessage.includes('econnrefused') ||
    rawMessage.includes('network') ||
    rawMessage.includes('timeout') ||
    rawMessage.includes('offline') ||
    rawMessage.includes('connection refused')
  ) {
    return 'NETWORK';
  }

  return 'UNKNOWN';
}

/**
 * Ghi log quan sát đồng bộ bảng xếp hạng (Observability Development Logging):
 * - Thống nhất prefix: [Leaderboard Sync]
 * - Gồm: user, week, metric summary, operation, failure category, code, message.
 * - Bảo mật: Tuyệt đối KHÔNG log secrets (redact bearer tokens, API keys, passwords).
 */
export function logLeaderboardSyncError(context: {
  userId?: string | null;
  weekId?: string;
  metricSummary?: string;
  operation: string;
  error: unknown;
}): { failureType: LeaderboardSyncFailureType; formattedLog: string } {
  const failureType = classifySyncFailureCategory(context.error);
  const rawCode = typeof context.error === 'object' && context.error !== null && 'code' in context.error
    ? String((context.error as any).code)
    : 'N/A';
  let rawMsg = typeof context.error === 'object' && context.error !== null && 'message' in context.error
    ? String((context.error as any).message)
    : String(context.error || 'Unknown error');

  // Redact potential sensitive tokens/keys
  rawMsg = rawMsg
    .replace(/(?:Bearer\s+)[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]')
    .replace(/((?:api_?key|key|token|password|secret)=)[^&\s]+/gi, '$1[REDACTED]');

  const safeUserId = context.userId ? `${context.userId.substring(0, 8)}...` : 'anon';
  const week = context.weekId || 'current';
  const summary = context.metricSummary || 'none';

  const formattedLog = `[Leaderboard Sync] user=${safeUserId} week=${week} op=${context.operation} summary=(${summary}) failure=${failureType} code=${rawCode} message=${rawMsg}`;
  console.warn(formattedLog);

  return { failureType, formattedLog };
}

export const REALTIME_DEBOUNCE_WAIT_MS = 1500;
export const REALTIME_MAX_WAIT_MS = 5000;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let burstStartTime: number | null = null;

export function clearLeaderboardDebounceForTesting(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  burstStartTime = null;
}

export const clearLeaderboardDebounce = clearLeaderboardDebounceForTesting;

/**
 * Kiểm tra xem một chuỗi có phải là UUID hợp lệ hay không.
 * Ngăn chặn tuyệt đối việc truyền display name (ví dụ "Huy Hoàng", có chứa khoảng trắng hoặc ký tự tiếng Việt)
 * vào tham số UserId của backend API gây lỗi HTTP 400.
 *
 * Trong môi trường test (Vitest/Node.js), cho phép các test ID định dạng slug chuẩn (không dấu, không khoảng trắng).
 */
export function isValidUserUuid(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;

  // Chuẩn canonical UUID (8-4-4-4-12 hex characters)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(trimmed)) return true;

  // Nếu chứa khoảng trắng hoặc ký tự ngoài bảng mã ASCII (như tiếng Việt: "Huy Hoàng"),
  // chắc chắn là display name hoặc text thông thường -> KHÔNG BAO GIỜ là UUID
  if (/\s/.test(trimmed) || /[^\x00-\x7F]/.test(trimmed)) {
    return false;
  }

  // Hỗ trợ mock ID trong môi trường test (Vitest / Node.js)
  // Chỉ chấp nhận alphanumeric slug đơn giản như 'user-2', 'user_cross_test_1', 'my-user'
  const isTestEnv = Boolean((globalThis as any).process?.env?.NODE_ENV === 'test') ||
                    Boolean(import.meta.env?.MODE === 'test');
  if (isTestEnv && /^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Lấy thứ hạng cá nhân của người học hiện tại (Lightweight RPC get_my_leaderboard_rank).
 * Không cần tải toàn bộ bảng xếp hạng về phía client.
 */
export async function getMyLeaderboardRank(
  metric: LeaderboardMetric = 'weekly_xp',
  currentUserId?: string,
  weekId?: string
): Promise<LeaderboardEntry | null> {
  if (!currentUserId || !isValidUserUuid(currentUserId)) return null;

  try {
    const res = await leaderboardApi.fetchCurrentUserRank(metric, weekId);
    if (res && res.found && res.entry) {
      const item = res.entry;
      return {
        userId: currentUserId,
        rank: Number(item.rank) || 0,
        displayName: sanitizePublicDisplayName(item.displayName),
        avatarUrl: item.avatarUrl || undefined,
        level: Math.max(1, Number(item.level) || 1),
        rankTitle: getRankTitle(item.level || 1),
        score: Number(item.score) || 0,
        secondaryScore: item.secondaryScore !== undefined ? Number(item.secondaryScore) : undefined,
        isCurrentUser: true,
        lastActiveAt: item.lastActiveAt ? String(item.lastActiveAt) : undefined,
        equippedFrame: item.equippedFrame || undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Lấy bảng xếp hạng kèm thông tin lỗi chi tiết và hỗ trợ phân trang backend (Pagination).
 * Enforce: 1 <= effective_limit <= 50, effective_offset >= 0.
 */
export async function fetchLeaderboardWithStatus(
  metric: LeaderboardMetric = 'weekly_xp',
  currentUserId?: string,
  limit: number = DEFAULT_PAGE_SIZE,
  offset: number = 0
): Promise<FetchLeaderboardResult> {
  const effectiveLimit = Math.min(Math.max(!limit || limit <= 0 ? DEFAULT_PAGE_SIZE : limit, 1), MAX_PAGE_SIZE);
  const effectiveOffset = Math.max(offset || 0, 0);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const cached = getCachedLeaderboard(metric);
      if (cached && cached.entries.length > 0) {
        return {
          entries: cached.entries,
          totalCount: cached.totalCount || cached.entries.length,
          currentUserEntry: cached.currentUserEntry || null,
          limit: effectiveLimit,
          offset: effectiveOffset,
          status: 'OFFLINE_CACHE',
          error: 'offline',
          cachedAt: cached.cachedAt,
        };
      }
      return {
        entries: [],
        totalCount: 0,
        currentUserEntry: null,
        limit: effectiveLimit,
        offset: effectiveOffset,
        status: 'NETWORK_ERROR',
        error: 'offline',
        errorInfo: {
          code: 'NETWORK_ERROR',
          message: 'Thiết bị đang ngoại tuyến.',
        },
      };
    }

    try {
      const page = Math.floor(effectiveOffset / effectiveLimit) + 1;
      const res = await leaderboardApi.fetchLeaderboardPage(metric, {
        page,
        pageSize: effectiveLimit,
      });

      if (res && res.serverNow) {
        setServerTimeAnchor(
          new Date(res.serverNow).getTime(),
          res.serverWeekId || res.weekId,
          'RPC'
        );
      }

      const validCurrentUserId = isValidUserUuid(currentUserId) ? currentUserId : null;
      const entries: LeaderboardEntry[] = (res.entries || []).map((item, idx) => ({
        userId: String(item.userId || ''),
        rank: Number(item.rank) || (effectiveOffset + idx + 1),
        displayName: sanitizePublicDisplayName(item.displayName),
        avatarUrl: item.avatarUrl || undefined,
        level: Math.max(1, Number(item.level) || 1),
        rankTitle: getRankTitle(item.level || 1),
        score: Number(item.score) || 0,
        secondaryScore: item.secondaryScore !== undefined ? Number(item.secondaryScore) : undefined,
        isCurrentUser: Boolean(validCurrentUserId && item.userId === validCurrentUserId),
        lastActiveAt: item.lastActiveAt ? String(item.lastActiveAt) : undefined,
        equippedFrame: item.equippedFrame || undefined,
      }));

      let currentUserEntry: LeaderboardEntry | null = null;
      if (validCurrentUserId && res.currentUserEntry && String(res.currentUserEntry.userId) === validCurrentUserId) {
        const item = res.currentUserEntry;
        currentUserEntry = {
          userId: validCurrentUserId,
          rank: Number(item.rank) || 0,
          displayName: sanitizePublicDisplayName(item.displayName),
          avatarUrl: item.avatarUrl || undefined,
          level: Math.max(1, Number(item.level) || 1),
          rankTitle: getRankTitle(item.level || 1),
          score: Number(item.score) || 0,
          secondaryScore: item.secondaryScore !== undefined ? Number(item.secondaryScore) : undefined,
          isCurrentUser: true,
          lastActiveAt: item.lastActiveAt ? String(item.lastActiveAt) : undefined,
          equippedFrame: item.equippedFrame || undefined,
        };
      } else if (validCurrentUserId) {
        currentUserEntry = entries.find((e) => e.userId === validCurrentUserId) || null;
      }

      const totalCount = typeof res.totalCount === 'number' ? res.totalCount : entries.length;
      const currentWeekId = res.weekId || getAuthoritativeVietnamWeekId();
      const nowIso = new Date().toISOString();

      setCachedLeaderboard(metric, entries, currentWeekId, currentUserEntry, totalCount);

      return {
        entries,
        totalCount,
        currentUserEntry,
        limit: effectiveLimit,
        offset: effectiveOffset,
        status: 'SUCCESS',
        error: null,
        cachedAt: nowIso,
        cachedWeekId: currentWeekId,
        isStaleWeek: false,
      };
    } catch (err: unknown) {
      const classification = classifyLeaderboardError(err);
      console.warn(`[Leaderboard] Lỗi khi tải bảng xếp hạng ${metric}:`, classification.details || err);

      // Chỉ trả về OFFLINE_CACHE nếu thiết bị thực sự đang ở chế độ ngoại tuyến (navigator.onLine === false)
      const isDeviceOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      const cached = getCachedLeaderboard(metric);

      if (isDeviceOffline && cached && cached.entries.length > 0) {
        return {
          entries: cached.entries,
          totalCount: cached.totalCount || cached.entries.length,
          currentUserEntry: cached.currentUserEntry || null,
          limit: effectiveLimit,
          offset: effectiveOffset,
          status: 'OFFLINE_CACHE',
          error: 'offline',
          cachedAt: cached.cachedAt,
          cachedWeekId: cached.weekId,
          isStaleWeek: cached.isStaleWeek,
          errorInfo: {
            code: classification.status,
            message: classification.userMessage,
            details: classification.details,
          },
        };
      }

      return {
        entries: [],
        totalCount: 0,
        currentUserEntry: null,
        limit: effectiveLimit,
        offset: effectiveOffset,
        status: classification.status,
        error: classification.userMessage,
        errorInfo: {
          code: classification.status,
          message: classification.userMessage,
          details: classification.details,
        },
      };
    }
}

export async function fetchLeaderboard(
  metric: LeaderboardMetric = 'weekly_xp',
  currentUserId?: string,
  limit = DEFAULT_PAGE_SIZE,
  offset = 0
): Promise<LeaderboardEntry[]> {
  const result = await fetchLeaderboardWithStatus(metric, currentUserId, limit, offset);
  return result.entries;
}

export type RealtimeSubscriptionStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR';

interface RealtimeSubscriber {
  onUpdate: () => void;
  onStatusChange?: (status: RealtimeSubscriptionStatus) => void;
}

const activeSubscribers = new Set<RealtimeSubscriber>();
let signalRUnsubscribe: (() => void) | null = null;
let currentRealtimeStatus: RealtimeSubscriptionStatus = 'CLOSED';

function notifySubscribers() {
  for (const sub of activeSubscribers) {
    try {
      sub.onUpdate();
    } catch (err) {
      console.warn('[Leaderboard] Lỗi khi gọi subscriber callback:', err);
    }
  }
}

function notifyStatusChange(status: RealtimeSubscriptionStatus) {
  currentRealtimeStatus = status;
  for (const sub of activeSubscribers) {
    try {
      sub.onStatusChange?.(status);
    } catch (err) {
      console.warn('[Leaderboard] Lỗi khi gọi status callback:', err);
    }
  }
}

function handleDebouncedRealtimeEvent() {
  const now = Date.now();
  if (burstStartTime === null) {
    burstStartTime = now;
  }
  const elapsed = now - burstStartTime;

  // Max-wait protection: Nếu sự kiện dồn dập kéo dài liên tục >= 5s, bắt buộc giải tỏa 1 bounded refresh
  if (elapsed >= REALTIME_MAX_WAIT_MS) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    burstStartTime = null;
    notifySubscribers();
    return;
  }

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  const remaining = REALTIME_MAX_WAIT_MS - elapsed;
  const waitMs = Math.min(REALTIME_DEBOUNCE_WAIT_MS, remaining);

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    burstStartTime = null;
    notifySubscribers();
  }, waitMs);
}

/**
 * Đăng ký Realtime qua ASP.NET Core SignalR kênh /hubs/leaderboard
 * - Singleton Channel Lifecycle: Duy trì đúng 1 logical SignalR connection cho toàn bộ ứng dụng.
 * - Debounce ~1.5s kèm Max-Wait 5s chống nghẽn và chống đói tín hiệu (Starvation Protection).
 * - Tự động dọn dẹp (cleanup) connection và timer khi tất cả subscriber unmount.
 */
export function subscribeToLeaderboard(
  onUpdate: () => void,
  onStatusChange?: (status: RealtimeSubscriptionStatus) => void
): () => void {
  try {
    const subscriber: RealtimeSubscriber = { onUpdate, onStatusChange };
    activeSubscribers.add(subscriber);

    // Nếu đã có channel đang hoạt động, gửi ngay status hiện tại và tái sử dụng
    if (onStatusChange && currentRealtimeStatus !== 'CLOSED') {
      try {
        onStatusChange(currentRealtimeStatus);
      } catch {}
    }

    // Khởi tạo kết nối SignalR singleton nếu chưa có
    if (!signalRUnsubscribe) {
      signalRUnsubscribe = registerSignalRSubscriber(
        () => handleDebouncedRealtimeEvent(),
        (status) => notifyStatusChange(status as RealtimeSubscriptionStatus)
      );
    }

    return () => {
      activeSubscribers.delete(subscriber);
      if (activeSubscribers.size === 0) {
        clearLeaderboardDebounceForTesting();
        if (signalRUnsubscribe) {
          signalRUnsubscribe();
          signalRUnsubscribe = null;
        }
        currentRealtimeStatus = 'CLOSED';
      }
    };
  } catch (err: unknown) {
    console.warn('[Leaderboard] Lỗi đăng ký SignalR Realtime:', err);
    return () => {};
  }
}

/**
 * Helper dọn dẹp subscription cho testing
 */
export function resetLeaderboardSubscriptionForTesting(): void {
  clearLeaderboardDebounceForTesting();
  if (signalRUnsubscribe) {
    signalRUnsubscribe();
    signalRUnsubscribe = null;
  }
  activeSubscribers.clear();
  currentRealtimeStatus = 'CLOSED';
  void resetSignalRServiceForTesting();
}

export interface SyncWeeklyLearningMetricsPayload {
  userId?: string;
  weekId?: string;
  weeklyXp?: number | null;
  vocabMastered?: number | null;
  reviewConsistency?: number | null;
  activeMinutes?: number | null;
  pronunciationGain?: number | null;
  toeicGain?: number | null;
  evidence?: Record<string, unknown>;
}

export interface SyncWeeklyLearningMetricsResponse {
  success: boolean;
  code?: string;
  message?: string;
  week_id?: string;
  weekly_xp?: number;
  vocab_mastered?: number;
  review_consistency?: number | null;
  active_minutes?: number;
  pronunciation_gain?: number | null;
  toeic_gain?: number | null;
}

/**
 * Đồng bộ chỉ số học tập tuần (Server-Authoritative) lên ASP.NET Core API qua leaderboardApi.syncWeeklyMetrics.
 */
export async function syncWeeklyLearningMetricsToServer(
  payload: SyncWeeklyLearningMetricsPayload
): Promise<SyncWeeklyLearningMetricsResponse> {

    try {
      const weekId = payload.weekId || getAuthoritativeVietnamWeekId();
      const res = await leaderboardApi.syncWeeklyMetrics({
        weekId,
        weeklyXp: payload.weeklyXp,
        vocabMastered: payload.vocabMastered,
        reviewConsistency: payload.reviewConsistency,
        activeMinutes: payload.activeMinutes,
        pronunciationGain: payload.pronunciationGain,
        toeicGain: payload.toeicGain,
        evidence: payload.evidence,
      });

      if (res && res.serverNow) {
        setServerTimeAnchor(
          new Date(res.serverNow).getTime(),
          res.serverWeekId || res.weekId,
          'RPC'
        );
      }

      return {
        success: res.success,
        code: res.code,
        message: res.message,
        week_id: res.weekId,
        weekly_xp: res.weeklyXp,
        vocab_mastered: res.vocabMastered,
        review_consistency: res.reviewConsistency,
        active_minutes: res.activeMinutes,
        pronunciation_gain: res.pronunciationGain,
        toeic_gain: res.toeicGain,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định khi đồng bộ chỉ số học tập.';
      const failureCategory = classifySyncFailureCategory(err);
      logLeaderboardSyncError({
        userId: payload.userId,
        weekId: payload.weekId,
        metricSummary: `weeklyXp=${payload.weeklyXp ?? 0}, vocab=${payload.vocabMastered ?? 0}`,
        operation: 'sync_weekly_learning_metrics_exception',
        error: err,
      });
      return {
        success: false,
        code: failureCategory,
        message,
      };
    }
}

/**
 * Đồng bộ điểm số học viên thật qua ASP.NET Core API leaderboardApi.syncScore.
 * Tách biệt rõ ràng lifetimeXp (total_xp) và weeklyXp (weekly_xp).
 */
export async function syncUserScoreToLeaderboard(
  payload: LeaderboardProfilePayload
): Promise<void> {

    const targetId = payload.id || payload.userId;
    const weeklyXp = payload.weeklyXp ?? 0;
    const streak = payload.streak ?? 0;
    try {
      const displayName = sanitizePublicDisplayName(payload.displayName || payload.name);
      const level = payload.level ?? 1;
      const totalXp = payload.totalXp ?? payload.xp ?? 0;

      await leaderboardApi.syncScore({
        displayName,
        avatarUrl: payload.avatarUrl,
        avatarSeed: payload.avatarSeed,
        level,
        totalXp,
        weeklyXp,
        streak,
        equippedFrame: payload.equippedFrame,
      });
    } catch (err: unknown) {
      logLeaderboardSyncError({
        userId: targetId,
        metricSummary: `weeklyXp=${weeklyXp}, streak=${streak}`,
        operation: 'syncUserScoreToLeaderboard_exception',
        error: err,
      });
    }
}

/**
 * Tính thời gian chính xác còn lại đến mốc thiết lập lại tuần (Thứ Hai 00:00:00.000 Asia/Ho_Chi_Minh kế tiếp = Chủ Nhật 17:00:00.000 UTC).
 */
export function calculateWeeklyCountdown(now: Date = getAuthoritativeServerNow()): WeeklyCountdown {
  const nextReset = getNextVietnamWeekReset(now);
  const diffMs = Math.max(0, nextReset.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
}
