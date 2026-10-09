import { useMemo } from 'react';
import type { SyncStatus, LeaderboardEntry } from '../types';
import { useCloudSyncStore, hasPendingCloudSync } from './cloudSyncService';
import { isValidUserUuid } from './leaderboardService';

/**
 * Các trạng thái định danh chuẩn tắc của Leaderboard (Canonical Identity State):
 * - 'local_only': Người dùng chưa đăng nhập tài khoản Cloud (Guest). Chỉ có tiến trình học tập cục bộ.
 *                 Tuyệt đối KHÔNG có online current-user rank và KHÔNG match bất kỳ Cloud row nào.
 * - 'authenticated_syncing': Đã đăng nhập Cloud Auth (có UUID), dữ liệu cục bộ và Cloud đang hòa giải (reconcile).
 *                            Online row có thể chưa phản ánh số liệu mới nhất.
 * - 'authenticated_synced': Đã đăng nhập và hoàn tất hòa giải 2 chiều.
 *                           Online row được map chuẩn xác bằng canonical UUID.
 */
export type LeaderboardIdentityState =
  | 'local_only'
  | 'authenticated_syncing'
  | 'authenticated_synced';

export interface LeaderboardIdentityContext {
  state: LeaderboardIdentityState;
  userId: string | null;
  isLocalOnly: boolean;
  isAuthenticatedSyncing: boolean;
  isAuthenticatedSynced: boolean;
  canHaveCloudRank: boolean;
}

export interface DeriveLeaderboardIdentityInput {
  userId?: string | null;
  status?: SyncStatus;
  isSyncInProgress?: boolean;
  hasPendingSync?: boolean;
  lastSyncedAt?: string | null;
}

/**
 * Pure derivation function: Tính toán trạng thái danh tính của Leaderboard
 * dựa trên canonical auth state và sync lifecycle mà không lưu trữ duplicate state.
 */
export function deriveLeaderboardIdentity(
  input: DeriveLeaderboardIdentityInput = {}
): LeaderboardIdentityContext {
  const rawUserId = input.userId ? input.userId.trim() : null;
  const isAuth = Boolean(rawUserId && isValidUserUuid(rawUserId));

  if (!isAuth) {
    return {
      state: 'local_only',
      userId: null,
      isLocalOnly: true,
      isAuthenticatedSyncing: false,
      isAuthenticatedSynced: false,
      canHaveCloudRank: false,
    };
  }

  const canonicalUserId = rawUserId as string;
  const isSyncing =
    input.status === 'syncing' ||
    Boolean(input.isSyncInProgress) ||
    Boolean(input.hasPendingSync);

  // Đang đồng bộ, hoặc mới đăng nhập chưa từng đồng bộ thành công lần nào
  if (isSyncing || (input.status === 'idle' && !input.lastSyncedAt)) {
    return {
      state: 'authenticated_syncing',
      userId: canonicalUserId,
      isLocalOnly: false,
      isAuthenticatedSyncing: true,
      isAuthenticatedSynced: false,
      canHaveCloudRank: true,
    };
  }

  // Đã đồng bộ hoàn tất
  return {
    state: 'authenticated_synced',
    userId: canonicalUserId,
    isLocalOnly: false,
    isAuthenticatedSyncing: false,
    isAuthenticatedSynced: true,
    canHaveCloudRank: true,
  };
}

/**
 * React Hook: Đọc canonical auth state từ useCloudSyncStore và trả về
 * LeaderboardIdentityContext được ghi nhớ (memoized).
 * Không tạo thêm auth listener dư thừa nào.
 */
export function useLeaderboardIdentity(): LeaderboardIdentityContext {
  const { user, userId, status, lastSyncedAt } = useCloudSyncStore();
  const pendingSync = hasPendingCloudSync();

  const effectiveUserId = userId || user?.id || null;

  return useMemo(() => {
    return deriveLeaderboardIdentity({
      userId: effectiveUserId,
      status,
      hasPendingSync: pendingSync,
      lastSyncedAt,
    });
  }, [effectiveUserId, status, pendingSync, lastSyncedAt]);
}

/**
 * Trích xuất LeaderboardIdentityContext tức thời từ store hiện tại (ngoài React hook).
 */
export function getLeaderboardIdentity(): LeaderboardIdentityContext {
  const syncState = useCloudSyncStore.getState();
  const pendingSync = hasPendingCloudSync();
  const effectiveUserId = syncState.userId || syncState.user?.id || null;

  return deriveLeaderboardIdentity({
    userId: effectiveUserId,
    status: syncState.status,
    hasPendingSync: pendingSync,
    lastSyncedAt: syncState.lastSyncedAt,
  });
}

/**
 * Kiểm tra xem một row / entry trên Leaderboard có phải là của người dùng hiện tại hay không.
 * BẤT BIẾN CANONICAL (Canonical Identity Invariant):
 * - Nếu identity là 'local_only': LUÔN trả về false. Guest KHÔNG BAO GIỜ match bất kỳ Cloud row nào.
 * - Nếu authenticated: CHỈ match khi entry.userId === canonicalUserId (UUID).
 * - TUYỆT ĐỐI KHÔNG match qua displayName, username, avatar hay bất kỳ trường nào khác.
 */
export function isCurrentLeaderboardUser(
  entry: { userId?: string | null; id?: string | null; displayName?: string } | null | undefined,
  identity: LeaderboardIdentityContext | string | null | undefined
): boolean {
  if (!entry) return false;

  const canonicalUserId =
    typeof identity === 'string'
      ? (isValidUserUuid(identity) ? identity.trim() : null)
      : identity?.state === 'local_only'
      ? null
      : identity?.userId?.trim() || null;

  if (!canonicalUserId) {
    // Local-only / Guest: Tuyệt đối không match bất kỳ row nào
    return false;
  }

  const rowUserId = (entry.userId || entry.id || '').trim();
  if (!rowUserId) return false;

  return rowUserId === canonicalUserId;
}

/**
 * Trích xuất canonical current user entry từ danh sách entries và apiCurrentUserEntry.
 * BẤT BIẾN CANONICAL:
 * - Nếu identity là 'local_only': LUÔN trả về null (Guest không có online rank).
 * - Nếu authenticated:
 *   1. Ưu tiên apiCurrentUserEntry NẾU apiCurrentUserEntry.userId === canonicalUserId.
 *   2. Sau đó tìm trong entries NẾU entry.userId === canonicalUserId.
 *   3. Nếu không tìm thấy -> trả về null (chưa xếp hạng / unranked).
 *   4. TUYỆT ĐỐI KHÔNG fallback sang displayName hay username.
 */
export function resolveCurrentUserEntry(
  entries: LeaderboardEntry[] = [],
  apiCurrentUserEntry: LeaderboardEntry | null | undefined,
  identity: LeaderboardIdentityContext | string | null | undefined
): LeaderboardEntry | null {
  const canonicalUserId =
    typeof identity === 'string'
      ? (isValidUserUuid(identity) ? identity.trim() : null)
      : identity?.state === 'local_only'
      ? null
      : identity?.userId?.trim() || null;

  if (!canonicalUserId) {
    return null;
  }

  // 1. Ưu tiên entry nằm trong main list entries hiện tại nếu user có mặt trên trang này.
  // Đảm bảo tuyệt đối tính đồng nhất: khi main list có điểm số/thứ hạng mới nhất, sticky row phản ánh chính xác 100%.
  const matched = entries.find((e) => e.userId === canonicalUserId);
  if (matched) {
    return {
      ...matched,
      isCurrentUser: true,
    };
  }

  // 2. Nếu user nằm ở trang khác (ngoài view phân trang hiện tại), dùng apiCurrentUserEntry từ server RPC
  if (apiCurrentUserEntry && apiCurrentUserEntry.userId === canonicalUserId) {
    return {
      ...apiCurrentUserEntry,
      isCurrentUser: true,
    };
  }

  return null;
}

/**
 * Khử nhiễm danh sách entries để đảm bảo cờ `isCurrentUser` luôn phản ánh đúng
 * danh tính canonical hiện tại, ngăn ngừa rò rỉ cờ `isCurrentUser: true` từ cache cũ.
 */
export function sanitizeEntriesForIdentity(
  entries: LeaderboardEntry[] = [],
  identity: LeaderboardIdentityContext | string | null | undefined
): LeaderboardEntry[] {
  const canonicalUserId =
    typeof identity === 'string'
      ? (isValidUserUuid(identity) ? identity.trim() : null)
      : identity?.state === 'local_only'
      ? null
      : identity?.userId?.trim() || null;

  return entries.map((entry) => ({
    ...entry,
    isCurrentUser: Boolean(canonicalUserId && entry.userId === canonicalUserId),
  }));
}
