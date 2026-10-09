import { useCloudSyncStore } from '../services/cloudSyncService';

/**
 * Kiểm tra xem người dùng có mang vai trò ADMIN hay không dựa trên RBAC claims từ backend.
 * Hoàn toàn không phụ thuộc vào email hardcode.
 */
export function isUserAdmin(target?: { roles?: string[] | null } | string[] | null): boolean {
  if (!target) return false;

  const roles = Array.isArray(target) ? target : target.roles;
  if (!roles || !Array.isArray(roles)) return false;

  return roles.some((role) => typeof role === 'string' && role.trim().toUpperCase() === 'ADMIN');
}

/**
 * Reactive React hook kiểm tra quyền ADMIN của người dùng hiện tại từ Zustand store
 */
export function useIsAdmin(): boolean {
  const user = useCloudSyncStore((state) => state.user);
  return isUserAdmin(user);
}
