// src/services/localOutboxService.ts
import { DomainEvent, validateDomainEvent } from '../types/learningEvents';

export const OUTBOX_STORAGE_KEY = 'english_mastery_outbox_v1';
export const DEFAULT_MAX_OUTBOX_CAPACITY = 300;
export const DEFAULT_SENDING_LEASE_MS = 60000; // 60 seconds lease for crash recovery

export type OutboxStatus = 'pending' | 'sending';

export interface OutboxEntry {
  event: DomainEvent;
  status: OutboxStatus;
  enqueuedAt: string; // ISO 8601
  attempts: number;
  lastAttemptAt?: string; // ISO 8601
  sendingLeaseExpiresAt?: number; // epoch ms for in-flight crash recovery
}

export interface EnqueueResult {
  success: boolean;
  eventId?: string;
  enqueued: boolean;
  droppedOldest: boolean;
  queueLength: number;
  error?: string;
}

export interface AcknowledgeResult {
  removedCount: number;
  remainingCount: number;
}

/**
 * LocalOutbox provides an isolated, persistent, bounded FIFO queue
 * for domain events awaiting cloud synchronization.
 * 
 * Strict invariants:
 * 1. Isolated Storage: Uses OUTBOX_STORAGE_KEY, keeping it completely separated
 *    from the main store quota (1.5 MB safeStorage guard).
 * 2. Retention: Retains ONLY unacknowledged events. Removes events immediately upon ACK.
 * 3. Crash / Reload Resilience: Any in-flight 'sending' events are automatically
 *    reverted to 'pending' upon reload or when their lease expires.
 * 4. Zero Domain Side-Effects: Never mutates FSRS/SM-2, XP, Mistake Bank, or triggers cloud fetches.
 * 5. Failure Resilience: Local operations NEVER fail due to outbox or storage errors.
 */
export class LocalOutbox {
  private storage: Storage | null;
  private maxCapacity: number;
  private leaseMs: number;
  private entries: OutboxEntry[] = [];
  private isLoaded = false;

  constructor(
    customStorage?: Storage | null,
    maxCapacity = DEFAULT_MAX_OUTBOX_CAPACITY,
    leaseMs = DEFAULT_SENDING_LEASE_MS
  ) {
    if (customStorage !== undefined) {
      this.storage = customStorage;
    } else {
      this.storage = typeof window !== 'undefined' && typeof localStorage !== 'undefined' ? localStorage : null;
    }
    this.maxCapacity = Math.max(1, maxCapacity);
    this.leaseMs = Math.max(1000, leaseMs);
    this.loadFromStorage();
  }

  /**
   * Loads entries from persistence and performs startup crash recovery.
   */
  public loadFromStorage(): void {
    this.entries = [];
    this.isLoaded = true;

    if (!this.storage) return;

    try {
      const raw = this.storage.getItem(OUTBOX_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        console.warn('[LocalOutbox] Corrupted outbox payload (not an array), resetting storage.');
        this.storage.removeItem(OUTBOX_STORAGE_KEY);
        return;
      }

      const validEntries: OutboxEntry[] = [];

      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;

        const eventValidation = validateDomainEvent(item.event);
        if (!eventValidation.valid || !eventValidation.event) {
          console.warn('[LocalOutbox] Dropping malformed or unsupported event during load:', eventValidation.error);
          continue;
        }

        // Crash Recovery Guard: If the app crashed or reloaded while sending,
        // revert the status back to 'pending' so it can be retried cleanly.
        const recoveredStatus: OutboxStatus = item.status === 'sending' ? 'pending' : (item.status || 'pending');

        validEntries.push({
          event: eventValidation.event,
          status: recoveredStatus,
          enqueuedAt: typeof item.enqueuedAt === 'string' ? item.enqueuedAt : new Date().toISOString(),
          attempts: typeof item.attempts === 'number' && Number.isFinite(item.attempts) ? item.attempts : 0,
          lastAttemptAt: typeof item.lastAttemptAt === 'string' ? item.lastAttemptAt : undefined,
          sendingLeaseExpiresAt: undefined, // Clear any stale in-flight lease
        });
      }

      // Bound to capacity if storage contained too many items
      if (validEntries.length > this.maxCapacity) {
        this.entries = validEntries.slice(-this.maxCapacity);
        this.saveToStorage();
      } else {
        this.entries = validEntries;
      }
    } catch (err) {
      console.warn('[LocalOutbox] Exception loading outbox from storage:', err);
      this.entries = [];
    }
  }

  /**
   * Persists current unacknowledged entries to storage.
   */
  private saveToStorage(): void {
    if (!this.storage) return;

    try {
      if (this.entries.length === 0) {
        this.storage.removeItem(OUTBOX_STORAGE_KEY);
        return;
      }
      const serialized = JSON.stringify(this.entries);
      this.storage.setItem(OUTBOX_STORAGE_KEY, serialized);
    } catch (err) {
      console.warn('[LocalOutbox] Storage write failed (quota exceeded or storage restricted):', err);
    }
  }

  /**
   * Enqueues a validated domain event into the local outbox.
   * If the queue reaches capacity, drops the oldest entry (FIFO drop) to protect memory.
   */
  public enqueue(event: DomainEvent): EnqueueResult {
    if (!this.isLoaded) {
      this.loadFromStorage();
    }

    const validation = validateDomainEvent(event);
    if (!validation.valid || !validation.event) {
      console.warn('[LocalOutbox] Rejected malformed event:', validation.error);
      return {
        success: false,
        enqueued: false,
        droppedOldest: false,
        queueLength: this.entries.length,
        error: validation.error,
      };
    }

    const validatedEvent = validation.event;

    // Idempotency check in local outbox: do not duplicate identical eventId or idempotencyKey
    const existingIndex = this.entries.findIndex(
      (e) =>
        e.event.eventId === validatedEvent.eventId ||
        (e.event.idempotencyKey && e.event.idempotencyKey === validatedEvent.idempotencyKey)
    );
    if (existingIndex !== -1) {
      return {
        success: true,
        eventId: validatedEvent.eventId,
        enqueued: false,
        droppedOldest: false,
        queueLength: this.entries.length,
      };
    }

    let droppedOldest = false;

    // Bounded capacity check
    if (this.entries.length >= this.maxCapacity) {
      this.entries.shift(); // Drop oldest FIFO
      droppedOldest = true;
      console.warn(`[LocalOutbox] Queue reached capacity (${this.maxCapacity}). Dropped oldest unacked event.`);
    }

    const newEntry: OutboxEntry = {
      event: validatedEvent,
      status: 'pending',
      enqueuedAt: new Date().toISOString(),
      attempts: 0,
    };

    this.entries.push(newEntry);
    this.saveToStorage();

    return {
      success: true,
      eventId: validatedEvent.eventId,
      enqueued: true,
      droppedOldest,
      queueLength: this.entries.length,
    };
  }

  /**
   * Retrieves up to `limit` entries eligible for transmission (pending or expired lease).
   * Does NOT mark them as sending (use markSending for transactional dispatch).
   */
  public peekBatch(limit = 50): OutboxEntry[] {
    const now = Date.now();
    const eligible: OutboxEntry[] = [];

    for (const entry of this.entries) {
      const isPending = entry.status === 'pending';
      const isLeaseExpired =
        entry.status === 'sending' &&
        entry.sendingLeaseExpiresAt !== undefined &&
        now > entry.sendingLeaseExpiresAt;

      if (isPending || isLeaseExpired) {
        eligible.push(entry);
        if (eligible.length >= limit) break;
      }
    }

    return eligible;
  }

  /**
   * Atomically transitions the specified event IDs to 'sending' with a recovery lease.
   */
  public markSending(eventIds: string[], customLeaseMs?: number): OutboxEntry[] {
    const now = Date.now();
    const leaseDuration = customLeaseMs !== undefined ? Math.max(1000, customLeaseMs) : this.leaseMs;
    const leaseExpiresAt = now + leaseDuration;
    const targetSet = new Set(eventIds);
    const markedEntries: OutboxEntry[] = [];

    for (const entry of this.entries) {
      if (targetSet.has(entry.event.eventId)) {
        entry.status = 'sending';
        entry.attempts += 1;
        entry.lastAttemptAt = new Date(now).toISOString();
        entry.sendingLeaseExpiresAt = leaseExpiresAt;
        markedEntries.push(entry);
      }
    }

    if (markedEntries.length > 0) {
      this.saveToStorage();
    }

    return markedEntries;
  }

  /**
   * Confirms successful server ingestion and removes the acknowledged events permanently.
   */
  public acknowledge(eventIds: string[]): AcknowledgeResult {
    if (!eventIds || eventIds.length === 0) {
      return { removedCount: 0, remainingCount: this.entries.length };
    }

    const targetSet = new Set(eventIds);
    const initialCount = this.entries.length;
    this.entries = this.entries.filter((e) => !targetSet.has(e.event.eventId));
    const removedCount = initialCount - this.entries.length;

    if (removedCount > 0) {
      this.saveToStorage();
    }

    return {
      removedCount,
      remainingCount: this.entries.length,
    };
  }

  /**
   * Reverts sending events back to 'pending'.
   * Called upon transport network errors or timeout.
   */
  public revertSending(eventIds?: string[]): { revertedCount: number } {
    let revertedCount = 0;
    const targetSet = eventIds ? new Set(eventIds) : null;

    for (const entry of this.entries) {
      if (entry.status === 'sending') {
        if (!targetSet || targetSet.has(entry.event.eventId)) {
          entry.status = 'pending';
          entry.sendingLeaseExpiresAt = undefined;
          revertedCount++;
        }
      }
    }

    if (revertedCount > 0) {
      this.saveToStorage();
    }

    return { revertedCount };
  }

  /**
   * Returns the count of pending (ready-to-send) events.
   */
  public getPendingCount(): number {
    return this.peekBatch(this.maxCapacity).length;
  }

  /**
   * Returns total entry count currently in the outbox.
   */
  public getTotalCount(): number {
    return this.entries.length;
  }

  /**
   * Returns a copy of all current entries in the outbox (for inspection/testing).
   */
  public getAllEntries(): OutboxEntry[] {
    return [...this.entries];
  }

  /**
   * Clears all entries from memory and storage (for testing).
   */
  public clear(): void {
    this.entries = [];
    if (this.storage) {
      try {
        this.storage.removeItem(OUTBOX_STORAGE_KEY);
      } catch {
        // Ignore
      }
    }
  }
}

/**
 * Singleton instance of LocalOutbox wired to standard browser localStorage.
 */
export const localOutbox = new LocalOutbox();

/**
 * Convenience helper to enqueue a domain event.
 */
export function enqueueDomainEvent(event: DomainEvent): EnqueueResult {
  return localOutbox.enqueue(event);
}

/**
 * Convenience helper to peek pending events.
 */
export function peekPendingEvents(limit?: number): OutboxEntry[] {
  return localOutbox.peekBatch(limit);
}

/**
 * Convenience helper to acknowledge events after successful server sync.
 */
export function acknowledgeDomainEvents(eventIds: string[]): AcknowledgeResult {
  return localOutbox.acknowledge(eventIds);
}
