/**
 * src/store/dataOwnershipManager.ts
 *
 * Client-Side Learning Data Ownership & Session Slot Isolation Manager (Phase 5)
 *
 * Implements strict data isolation and zero-loss preservation across:
 * 1. Guest-owned learning data (session-scoped / guest slot)
 * 2. Authenticated user learning data (scoped by canonical internal userId)
 * 3. Legacy learning data (created before auth; unassigned ownership)
 * 4. Auth/session cache (isolated tokens and API session)
 *
 * INVARIANTS:
 * - Learning Data != Authentication Identity
 * - Learning Data != Guest Session
 * - Guest != Authenticated
 * - Zero destructive operations: never calls localStorage.clear(), never drops valid records.
 * - Account A's data is NEVER leaked to Guest or Account B.
 * - Legacy data without ownership is preserved intact and safely accessible to Guest.
 */

import type { AppStore } from '../types';

export const CANONICAL_STORAGE_KEY = 'english_mastery_storage_v2';
export const ACTIVE_USER_ID_KEY = 'english_mastery_active_user_id';
export const DATA_OWNER_KEY = 'emh_data_owner_id';
export const GUEST_SLOT_KEY = 'emh_guest_slot';
export const LEGACY_BACKUP_KEY = 'emh_legacy_unassigned_backup';
export const USER_SLOT_PREFIX = 'emh_user_slot_';

export type DataOwnerType = 'guest' | 'authenticated' | 'legacy' | 'empty';

export interface DataOwnershipInfo {
  type: DataOwnerType;
  ownerId: string | null;
  hasLegacyBackup: boolean;
  hasGuestSlot: boolean;
  hasUserSlot: boolean;
}

/**
 * Inspect the current ownership state of the local learning data.
 */
export function inspectDataOwnership(): DataOwnershipInfo {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return {
      type: 'empty',
      ownerId: null,
      hasLegacyBackup: false,
      hasGuestSlot: false,
      hasUserSlot: false,
    };
  }

  const explicitOwner = localStorage.getItem(DATA_OWNER_KEY);
  const activeUserId = localStorage.getItem(ACTIVE_USER_ID_KEY);
  const rawStorage = localStorage.getItem(CANONICAL_STORAGE_KEY);
  const hasLegacyBackup = Boolean(localStorage.getItem(LEGACY_BACKUP_KEY));
  const hasGuestSlot = Boolean(localStorage.getItem(GUEST_SLOT_KEY));

  const effectiveUserId = activeUserId || (explicitOwner && explicitOwner !== 'guest' && explicitOwner !== 'legacy' ? explicitOwner : null);
  const hasUserSlot = effectiveUserId ? Boolean(localStorage.getItem(`${USER_SLOT_PREFIX}${effectiveUserId}`)) : false;

  if (!rawStorage) {
    return {
      type: 'empty',
      ownerId: null,
      hasLegacyBackup,
      hasGuestSlot,
      hasUserSlot,
    };
  }

  if (effectiveUserId) {
    return {
      type: 'authenticated',
      ownerId: effectiveUserId,
      hasLegacyBackup,
      hasGuestSlot,
      hasUserSlot,
    };
  }

  if (explicitOwner === 'guest') {
    return {
      type: 'guest',
      ownerId: 'guest',
      hasLegacyBackup,
      hasGuestSlot,
      hasUserSlot,
    };
  }

  // If there is data in storage but no active user ID or guest owner tag, it is Legacy Unassigned
  return {
    type: 'legacy',
    ownerId: null,
    hasLegacyBackup,
    hasGuestSlot,
    hasUserSlot,
  };
}

/**
 * Safely archive the current active learning data to its appropriate slot.
 */
export function archiveCurrentDataSlot(currentOwner: string | 'guest' | 'legacy' | null): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

  try {
    const rawData = localStorage.getItem(CANONICAL_STORAGE_KEY);
    if (!rawData) return;

    if (currentOwner === 'guest') {
      localStorage.setItem(GUEST_SLOT_KEY, rawData);
    } else if (currentOwner === 'legacy' || !currentOwner) {
      // Create backup of legacy unassigned data if not already backed up
      if (!localStorage.getItem(LEGACY_BACKUP_KEY)) {
        localStorage.setItem(LEGACY_BACKUP_KEY, rawData);
      }
    } else {
      // Authenticated user ID slot
      localStorage.setItem(`${USER_SLOT_PREFIX}${currentOwner}`, rawData);
    }
  } catch (err) {
    console.warn('[DataOwnershipManager] Failed to archive current data slot:', err);
  }
}

/**
 * Prepares and switches local learning data slot for an explicit Guest session.
 * Protects against leaking Account A's data to Guest.
 */
export function prepareDataSlotForGuest(store: Partial<AppStore>): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

  const ownership = inspectDataOwnership();

  if (ownership.type === 'authenticated' && ownership.ownerId) {
    // Current data belongs to an authenticated user (Account A).
    // MUST NOT leak Account A's data to Guest!
    console.log(`[DataOwnershipManager] Archiving authenticated user (${ownership.ownerId}) data before switching to Guest.`);
    archiveCurrentDataSlot(ownership.ownerId);

    // Check if there is an existing Guest slot to restore
    const savedGuestData = localStorage.getItem(GUEST_SLOT_KEY);
    if (savedGuestData) {
      try {
        const parsed = JSON.parse(savedGuestData);
        if (parsed?.state) {
          localStorage.setItem(CANONICAL_STORAGE_KEY, savedGuestData);
          if (store && typeof store.importBackupData === 'function') {
            store.importBackupData(JSON.stringify(parsed.state));
          }
        }
      } catch (parseErr) {
        console.warn('[DataOwnershipManager] Error restoring guest slot, resetting to clean guest default:', parseErr);
        if (store?.resetToDefault) store.resetToDefault();
      }
    } else {
      // No prior guest data -> start with clean default state for Guest
      if (store?.resetToDefault) {
        store.resetToDefault();
      }
    }

    localStorage.setItem(DATA_OWNER_KEY, 'guest');
    localStorage.removeItem(ACTIVE_USER_ID_KEY);
    return;
  }

  if (ownership.type === 'legacy') {
    // Legacy data created before any authentication existed.
    // Safe for Guest to use: "Sau explicit Guest choice, chỉ hiển thị legacy learning data nếu ownership an toàn."
    archiveCurrentDataSlot('legacy');
    localStorage.setItem(DATA_OWNER_KEY, 'guest');
    localStorage.removeItem(ACTIVE_USER_ID_KEY);
    return;
  }

  // Already guest or empty
  localStorage.setItem(DATA_OWNER_KEY, 'guest');
  localStorage.removeItem(ACTIVE_USER_ID_KEY);
}

/**
 * Prepares and switches local learning data slot for an authenticated user.
 * Protects against leaking Guest or Account A data to Account B.
 */
export function prepareDataSlotForUser(newUserId: string, store: Partial<AppStore>): void {
  if (!newUserId || typeof window === 'undefined' || typeof localStorage === 'undefined') return;

  const ownership = inspectDataOwnership();
  const currentOwner = ownership.ownerId || ownership.type;

  if (currentOwner === newUserId) {
    // Already active user, ensure ownership tag is synchronized
    localStorage.setItem(DATA_OWNER_KEY, newUserId);
    localStorage.setItem(ACTIVE_USER_ID_KEY, newUserId);
    return;
  }

  // Archive current active data before switching identities
  if (ownership.type === 'authenticated' && ownership.ownerId) {
    console.log(`[DataOwnershipManager] Archiving previous user (${ownership.ownerId}) data before activating ${newUserId}.`);
    archiveCurrentDataSlot(ownership.ownerId);
  } else if (ownership.type === 'guest') {
    console.log(`[DataOwnershipManager] Archiving guest data before activating user ${newUserId}.`);
    archiveCurrentDataSlot('guest');
  } else if (ownership.type === 'legacy') {
    console.log(`[DataOwnershipManager] Archiving legacy unassigned data before activating user ${newUserId}.`);
    archiveCurrentDataSlot('legacy');
  }

  // Check if new user has a saved slot on this device
  const savedUserSlot = localStorage.getItem(`${USER_SLOT_PREFIX}${newUserId}`);
  if (savedUserSlot) {
    try {
      const parsed = JSON.parse(savedUserSlot);
      if (parsed?.state) {
        localStorage.setItem(CANONICAL_STORAGE_KEY, savedUserSlot);
        if (store && typeof store.importBackupData === 'function') {
          store.importBackupData(JSON.stringify(parsed.state));
        }
      }
    } catch (parseErr) {
      console.warn(`[DataOwnershipManager] Error restoring user slot for ${newUserId}:`, parseErr);
      if (store?.resetToDefault) store.resetToDefault();
    }
  } else {
    // New user without local slot -> reset store so cloud sync can populate it cleanly
    if (store?.resetToDefault) {
      store.resetToDefault();
    }
  }

  localStorage.setItem(DATA_OWNER_KEY, newUserId);
  localStorage.setItem(ACTIVE_USER_ID_KEY, newUserId);
}

/**
 * Retrieves the unassigned legacy backup if one exists.
 */
export function getLegacyBackupData(): string | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  return localStorage.getItem(LEGACY_BACKUP_KEY);
}
