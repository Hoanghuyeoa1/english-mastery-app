/**
 * Guest Session Storage Lifecycle Manager
 * Ensures Guest mode is an explicit, session-scoped user choice.
 * Persists strictly within the active browser tab session (sessionStorage),
 * never in permanent localStorage or cloud accounts.
 */

export const GUEST_SESSION_STORAGE_KEY = 'emh_guest_session_active';

/**
 * Checks if an explicit Guest session is currently active in this browser tab.
 */
export function isGuestSessionActive(): boolean {
  try {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
      return false;
    }
    return sessionStorage.getItem(GUEST_SESSION_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Sets or clears the active Guest session flag in this browser tab.
 */
export function setGuestSessionActive(active: boolean): void {
  try {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
      return;
    }
    if (active) {
      sessionStorage.setItem(GUEST_SESSION_STORAGE_KEY, 'true');
    } else {
      sessionStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('[GuestSession] Failed to update sessionStorage:', err);
  }
}

/**
 * Clears the active Guest session flag in this browser tab.
 */
export function clearGuestSession(): void {
  setGuestSessionActive(false);
}
