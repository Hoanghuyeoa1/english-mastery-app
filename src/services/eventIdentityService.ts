// src/services/eventIdentityService.ts
import {
  DomainEvent,
  DomainEventType,
  LEARNING_EVENT_SCHEMA_VERSION,
  ReviewCardPayload,
  LearnWordPayload,
  CompleteQuizPayload,
  MistakeCreatedPayload,
} from '../types/learningEvents';

export const DEVICE_ID_STORAGE_KEY = 'english_mastery_device_id_v1';

let cachedDeviceId: string | null = null;

/**
 * Retrieves or creates a persistent device ID.
 * Persists in localStorage across browser reload and tab restart.
 * 
 * NOTE: deviceId is used strictly for client outbox origin tracking
 * and multi-device idempotency resolution. It is NOT a security authority.
 */
export function getOrCreateDeviceId(customStorage?: Storage): string {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  const storage = customStorage || (typeof window !== 'undefined' && typeof localStorage !== 'undefined' ? localStorage : null);

  if (storage) {
    try {
      const existing = storage.getItem(DEVICE_ID_STORAGE_KEY);
      if (existing && existing.trim().length >= 8) {
        cachedDeviceId = existing.trim();
        return cachedDeviceId;
      }
    } catch {
      // In-memory fallback if storage throws SecurityError or is restricted
    }
  }

  // Generate a random stable device UUID
  const randomUUID =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;

  const generatedId = randomUUID.startsWith('dev_') ? randomUUID : `dev_${randomUUID}`;
  cachedDeviceId = generatedId;

  if (storage) {
    try {
      storage.setItem(DEVICE_ID_STORAGE_KEY, generatedId);
    } catch {
      // Ignore storage write errors (private mode / quota exceeded)
    }
  }

  return generatedId;
}

/**
 * Resets the cached device ID in memory (for testing purposes).
 */
export function resetCachedDeviceIdForTesting(): void {
  cachedDeviceId = null;
}

/**
 * Generates a stable, collision-resistant event ID.
 * Structure: evt_<eventType>_<time36>_<randomEntropy>_<sanitizedEntityId>
 */
export function generateEventId(eventType: DomainEventType, entityId: string): string {
  const timePart = Date.now().toString(36);
  const entropyPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 10);

  const cleanEntity = (entityId || 'anon')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 24);

  return `evt_${eventType}_${timePart}_${entropyPart}_${cleanEntity}`;
}

/**
 * Generates a deterministic or semi-deterministic idempotency key.
 * Guarantees duplicate mutations (such as re-submitting an already processed action)
 * can be identified and de-duplicated on client or server.
 */
export function generateIdempotencyKey(
  eventType: DomainEventType,
  entityId: string,
  qualifier?: string | number
): string {
  const cleanEntity = (entityId || 'anon')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 32);

  if (qualifier !== undefined && qualifier !== null && String(qualifier).trim()) {
    const cleanQualifier = String(qualifier).trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
    return `idemp_${eventType}_${cleanEntity}_${cleanQualifier}`;
  }

  const entropy =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  return `idemp_${eventType}_${cleanEntity}_${entropy}`;
}

/**
 * Polymorphic factory function for creating typed Domain Events.
 * Automatically decorates the event with stable IDs, timestamps, device provenance,
 * and the canonical schema version.
 */
export function createDomainEvent(
  params:
    | {
        eventType: 'review_card';
        entityType: 'card';
        entityId: string;
        userId?: string | null;
        deviceId?: string;
        idempotencyKey?: string;
        occurredAt?: string;
        payload: ReviewCardPayload;
      }
    | {
        eventType: 'learn_word';
        entityType: 'word';
        entityId: string;
        userId?: string | null;
        deviceId?: string;
        idempotencyKey?: string;
        occurredAt?: string;
        payload: LearnWordPayload;
      }
    | {
        eventType: 'complete_quiz';
        entityType: 'quiz';
        entityId: string;
        userId?: string | null;
        deviceId?: string;
        idempotencyKey?: string;
        occurredAt?: string;
        payload: CompleteQuizPayload;
      }
    | {
        eventType: 'mistake_created';
        entityType: 'mistake';
        entityId: string;
        userId?: string | null;
        deviceId?: string;
        idempotencyKey?: string;
        occurredAt?: string;
        payload: MistakeCreatedPayload;
      }
): DomainEvent {
  const occurredAt = params.occurredAt || new Date().toISOString();
  const deviceId = params.deviceId || getOrCreateDeviceId();
  const eventId = generateEventId(params.eventType, params.entityId);
  const idempotencyKey = params.idempotencyKey || generateIdempotencyKey(params.eventType, params.entityId, occurredAt);

  return {
    eventId,
    eventType: params.eventType,
    entityType: params.entityType,
    entityId: params.entityId,
    userId: params.userId !== undefined ? params.userId : null,
    deviceId,
    idempotencyKey,
    schemaVersion: LEARNING_EVENT_SCHEMA_VERSION,
    occurredAt,
    payload: params.payload,
  } as DomainEvent;
}
