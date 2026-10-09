import { DomainEvent } from '../types/learningEvents';
import { LocalOutbox, localOutbox } from './localOutboxService';
import { cloudSyncApi } from './api/cloudSyncApi';


export type IngestEventStatus = 'applied' | 'already_processed' | 'rejected' | 'retryable_error';

export interface IngestEventItemResult {
  event_id: string;
  status: IngestEventStatus;
  code: string;
  message?: string;
}

export interface IngestLearningEventsResponse {
  success: boolean;
  code?: string;
  message?: string;
  received_count?: number;
  applied_count?: number;
  duplicate_count?: number;
  rejected_count?: number;
  server_now?: string;
  results?: IngestEventItemResult[];
}

export interface ProcessOutboxBatchResult {
  attemptedCount: number;
  acknowledgedCount: number;
  rejectedCount: number;
  retryableCount: number;
  acknowledgedEventIds: string[];
  rejectedEventIds: string[];
  retryableEventIds: string[];
  serverNow?: string;
  error?: string;
}

/**
 * ----------------------------------------------------------------------------
 * 1. FEATURE GATE CONFIGURATION
 * ----------------------------------------------------------------------------
 * Allows progressive rollout by business domain, runtime enable/disable,
 * and safe fallback to snapshot-only synchronization.
 */
export interface EventSyncFeatureConfig {
  enabled: boolean;
  batchSize: number;
  maxConsecutiveBatches: number;
  migratedDomains: {
    flashcardReview: boolean;
    learnWord: boolean;
    completeQuiz: boolean;
    mistakeCreated: boolean;
  };
}

export const DEFAULT_EVENT_SYNC_CONFIG: EventSyncFeatureConfig = {
  enabled: true,
  batchSize: 50,
  maxConsecutiveBatches: 3,
  migratedDomains: {
    flashcardReview: true, // Phase 5: Migrated domain 1 (review_card)
    learnWord: true, // Phase 6: Migrated domain 2 (learn_word)
    completeQuiz: true, // Phase 7: Migrated domain 3 (complete_quiz)
    mistakeCreated: true, // Phase 8: Migrated domain 4 (mistake_created)
  },
};

let currentFeatureConfig: EventSyncFeatureConfig = { ...DEFAULT_EVENT_SYNC_CONFIG };

export function getEventSyncConfig(): EventSyncFeatureConfig {
  return { ...currentFeatureConfig };
}

export type PartialEventSyncFeatureConfig = Partial<Omit<EventSyncFeatureConfig, 'migratedDomains'>> & {
  migratedDomains?: Partial<EventSyncFeatureConfig['migratedDomains']>;
};

export function setEventSyncConfig(partial: PartialEventSyncFeatureConfig): void {
  currentFeatureConfig = {
    ...currentFeatureConfig,
    ...partial,
    migratedDomains: {
      ...currentFeatureConfig.migratedDomains,
      ...(partial.migratedDomains || {}),
    },
  };
}

export function isEventSyncEnabled(): boolean {
  return currentFeatureConfig.enabled;
}

export function isDomainMigratedToEvents(domain: keyof EventSyncFeatureConfig['migratedDomains']): boolean {
  return currentFeatureConfig.enabled && Boolean(currentFeatureConfig.migratedDomains[domain]);
}

export function resetEventSyncConfigForTesting(): void {
  currentFeatureConfig = { ...DEFAULT_EVENT_SYNC_CONFIG };
}

/**
 * ----------------------------------------------------------------------------
 * 2. OBSERVABILITY TELEMETRY (DEVELOPER-SAFE)
 * ----------------------------------------------------------------------------
 * Exposes internal metrics without leaking user tokens, API keys, or payloads.
 */
export interface EventSyncTelemetry {
  pendingCount: number;
  totalOutboxCount: number;
  lastSyncSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  totalAckCount: number;
  totalRejectedCount: number;
  totalRetryCount: number;
  lastBatchAttemptedCount: number;
  lastBatchAckCount: number;
}

const initialTelemetryState: EventSyncTelemetry = {
  pendingCount: 0,
  totalOutboxCount: 0,
  lastSyncSuccessAt: null,
  lastFailureAt: null,
  lastFailureReason: null,
  totalAckCount: 0,
  totalRejectedCount: 0,
  totalRetryCount: 0,
  lastBatchAttemptedCount: 0,
  lastBatchAckCount: 0,
};

let telemetryState: EventSyncTelemetry = { ...initialTelemetryState };

export function getEventSyncTelemetry(outbox: LocalOutbox = localOutbox): EventSyncTelemetry {
  return {
    ...telemetryState,
    pendingCount: outbox.getPendingCount(),
    totalOutboxCount: outbox.getTotalCount(),
  };
}

export function resetEventSyncTelemetryForTesting(): void {
  telemetryState = { ...initialTelemetryState };
}

/**
 * ----------------------------------------------------------------------------
 * 3. SERVER INGESTION (SERVER-AUTHORITATIVE)
 * ----------------------------------------------------------------------------
 * Transmits a bounded batch of domain events to ASP.NET Core API via `/sync/events`.
 */
export async function ingestEventsOnServer(
  events: DomainEvent[]
): Promise<IngestLearningEventsResponse> {
  if (!events || events.length === 0) {
    return {
      success: true,
      received_count: 0,
      applied_count: 0,
      duplicate_count: 0,
      rejected_count: 0,
      results: [],
    };
  }

  try {
    return await cloudSyncApi.ingestEvents(events);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown network failure during event sync';
    console.warn('[CloudEventSync] Exception during ingestEventsOnServer:', message);
    return {
      success: false,
      code: 'NETWORK_EXCEPTION',
      message,
    };
  }
}


/**
 * ----------------------------------------------------------------------------
 * 4. SINGLE OUTBOX BATCH PROCESSOR
 * ----------------------------------------------------------------------------
 * Executes a single bounded transactional outbox processing cycle:
 * 1. Peeks ready-to-send entries (pending or lease expired).
 * 2. Marks selected entries as 'sending' with a crash recovery lease.
 * 3. Transmits batch to cloud RPC.
 * 4. Granularly acknowledges 'applied' and 'already_processed' events.
 * 5. Purges 'rejected' (non-retryable malformed) events from the outbox.
 * 6. Reverts 'retryable_error' or unreturned events back to 'pending'.
 */
export async function processOutboxBatch(
  outbox: LocalOutbox = localOutbox,
  batchSize = 50
): Promise<ProcessOutboxBatchResult> {
  const readyEntries = outbox.peekBatch(batchSize);

  if (readyEntries.length === 0) {
    return {
      attemptedCount: 0,
      acknowledgedCount: 0,
      rejectedCount: 0,
      retryableCount: 0,
      acknowledgedEventIds: [],
      rejectedEventIds: [],
      retryableEventIds: [],
    };
  }

  const eventsToTransmit = readyEntries.map((e) => e.event);
  const eventIds = eventsToTransmit.map((e) => e.eventId);

  // Transition to 'sending' with a 60-second lease
  outbox.markSending(eventIds, 60000);

  const response = await ingestEventsOnServer(eventsToTransmit);

  if (!response.success || !Array.isArray(response.results)) {
    // Whole batch failed (network error or unauthorized): revert all back to pending
    outbox.revertSending(eventIds);
    telemetryState.lastFailureAt = new Date().toISOString();
    telemetryState.lastFailureReason = response.message || 'Batch transmission failed';
    telemetryState.totalRetryCount += eventIds.length;

    return {
      attemptedCount: eventsToTransmit.length,
      acknowledgedCount: 0,
      rejectedCount: 0,
      retryableCount: eventsToTransmit.length,
      acknowledgedEventIds: [],
      rejectedEventIds: [],
      retryableEventIds: eventIds,
      error: response.message || 'Transmission failed',
    };
  }

  const acknowledgedIds: string[] = [];
  const rejectedIds: string[] = [];
  const retryableIds: string[] = [];
  const resultMap = new Map<string, IngestEventItemResult>();

  for (const item of response.results) {
    const id = item?.event_id || (item as any)?.eventId;
    if (id) {
      resultMap.set(id, item);
    }
  }


  for (const id of eventIds) {
    const res = resultMap.get(id);
    if (!res) {
      // Missing from response results -> treat as retryable
      retryableIds.push(id);
      continue;
    }

    if (res.status === 'applied' || res.status === 'already_processed') {
      acknowledgedIds.push(id);
    } else if (res.status === 'rejected') {
      // Non-retryable malformed event rejected by server -> discard from outbox
      rejectedIds.push(id);
    } else {
      // retryable_error
      retryableIds.push(id);
    }
  }

  // Remove applied and already_processed events from outbox
  if (acknowledgedIds.length > 0) {
    outbox.acknowledge(acknowledgedIds);
    telemetryState.totalAckCount += acknowledgedIds.length;
    telemetryState.lastSyncSuccessAt = new Date().toISOString();
  }

  // Also purge non-retryable rejected events so queue does not stall
  if (rejectedIds.length > 0) {
    outbox.acknowledge(rejectedIds);
    telemetryState.totalRejectedCount += rejectedIds.length;
  }

  // Revert retryable events back to pending
  if (retryableIds.length > 0) {
    outbox.revertSending(retryableIds);
    telemetryState.totalRetryCount += retryableIds.length;
  }

  telemetryState.lastBatchAttemptedCount = eventsToTransmit.length;
  telemetryState.lastBatchAckCount = acknowledgedIds.length;

  return {
    attemptedCount: eventsToTransmit.length,
    acknowledgedCount: acknowledgedIds.length,
    rejectedCount: rejectedIds.length,
    retryableCount: retryableIds.length,
    acknowledgedEventIds: acknowledgedIds,
    rejectedEventIds: rejectedIds,
    retryableEventIds: retryableIds,
    serverNow: response.server_now,
  };
}

/**
 * ----------------------------------------------------------------------------
 * 5. COORDINATOR FLUSH DRIVER (BOUNDED CONSECUTIVE BATCHING)
 * ----------------------------------------------------------------------------
 * Flushes events from the outbox through the existing sync coordinator.
 * Drains up to `maxConsecutiveBatches` (default 3 batches of 50 = 150 events).
 * If any batch fails or returns fewer than batchSize, stops cleanly.
 */
export async function flushOutboxEventsThroughCoordinator(
  outbox: LocalOutbox = localOutbox
): Promise<ProcessOutboxBatchResult> {
  const config = getEventSyncConfig();
  if (!config.enabled) {
    return {
      attemptedCount: 0,
      acknowledgedCount: 0,
      rejectedCount: 0,
      retryableCount: 0,
      acknowledgedEventIds: [],
      rejectedEventIds: [],
      retryableEventIds: [],
    };
  }

  let totalAttempted = 0;
  let totalAcked = 0;
  let totalRejected = 0;
  let totalRetryable = 0;
  const allAckedIds: string[] = [];
  const allRejectedIds: string[] = [];
  const allRetryableIds: string[] = [];
  let batchCount = 0;
  let lastServerNow: string | undefined;

  while (outbox.getPendingCount() > 0 && batchCount < config.maxConsecutiveBatches) {
    batchCount++;
    const res = await processOutboxBatch(outbox, config.batchSize);

    totalAttempted += res.attemptedCount;
    totalAcked += res.acknowledgedCount;
    totalRejected += res.rejectedCount;
    totalRetryable += res.retryableCount;
    allAckedIds.push(...res.acknowledgedEventIds);
    allRejectedIds.push(...res.rejectedEventIds);
    allRetryableIds.push(...res.retryableEventIds);
    if (res.serverNow) lastServerNow = res.serverNow;

    if (res.error) {
      break; // Stop immediately on batch transport error
    }

    // If batch attempted was smaller than batchSize or zero acknowledged, done for this cycle
    if (res.attemptedCount < config.batchSize || res.acknowledgedCount === 0) {
      break;
    }
  }

  return {
    attemptedCount: totalAttempted,
    acknowledgedCount: totalAcked,
    rejectedCount: totalRejected,
    retryableCount: totalRetryable,
    acknowledgedEventIds: allAckedIds,
    rejectedEventIds: allRejectedIds,
    retryableEventIds: allRetryableIds,
    serverNow: lastServerNow,
  };
}
