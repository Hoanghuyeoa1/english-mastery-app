import { useCloudSyncStore } from '../services/cloudSyncService';

export const ADMIN_EMAILS = [
  'hoang2003eoe@gmail.com',
];

/**
 * Check whether a given email address belongs to an Admin
 */
export function isUserAdmin(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/**
 * Reactive React hook to check whether the currently logged-in Supabase user is an Admin
 */
export function useIsAdmin(): boolean {
  const userEmail = useCloudSyncStore((state) => state.userEmail);
  return isUserAdmin(userEmail);
}
