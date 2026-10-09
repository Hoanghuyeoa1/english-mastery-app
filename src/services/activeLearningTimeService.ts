// src/services/activeLearningTimeService.ts
/**
 * Active Learning Time Foundation & Lightweight Session Tracker (Phase 3)
 * 
 * Tracks, bounds, and derives genuine Active Learning Minutes across verified learning modules.
 * 
 * Strict Guarantees:
 * 1. Module Whitelist Only: Tracks strictly 'flashcard' | 'four_skills' | 'toeic' | 'quiz' | 'pronunciation' | 'ai_tutor'.
 *    Never tracks Dashboard, settings, menus, static browsing, or loading states.
 * 2. Inactivity Cutoff (Anti-Idle): Automatically pauses if no user interaction occurs for >= 60 seconds.
 * 3. Visibility & Focus Discipline: Instantly pauses when document.visibilityState is 'hidden' or window is blurred.
 * 4. Bounded Continuous Chunk: Caps any continuous chunk at maximum 30 minutes (1800s);
 *    a single forgotten flashcard cannot generate 6 hours of learning time.
 * 5. Bounded Local Aggregation: Aggregates bounded chunks locally in ring buffer (max 100 sessions);
 *    never spams server backend with second-by-second telemetry.
 * 6. Idempotency & Reload Safety: Bounded session records have unique session IDs;
 *    processing duplicate sessions or reloading returns identical derived metrics.
 * 7. Vietnam Business Timezone: Day grouping strictly follows Asia/Ho_Chi_Minh (UTC+7).
 */

import { getVietnamDateString } from './leaderboardLearningMetrics';
import { getVietnamWeekStart, getVietnamWeekEnd } from './leaderboardService';
import { scheduleCloudSync } from './cloudSyncService';

export type ActiveLearningModule =
  | 'flashcard'
  | 'four_skills'
  | 'toeic'
  | 'quiz'
  | 'pronunciation'
  | 'ai_tutor';

export const WHITELISTED_LEARNING_MODULES: ReadonlySet<string> = new Set([
  'flashcard',
  'four_skills',
  'toeic',
  'quiz',
  'pronunciation',
  'ai_tutor',
]);

export function isWhitelistedModule(module: string): module is ActiveLearningModule {
  return WHITELISTED_LEARNING_MODULES.has(module);
}

/**
 * Maps application ActiveTab to a whitelisted ActiveLearningModule.
 * Non-learning tabs (dashboard, settings, vocabulary, etc.) strictly map to null.
 */
export function tabToActiveLearningModule(tab: string): ActiveLearningModule | null {
  switch (tab) {
    case 'flashcards':
      return 'flashcard';
    case 'four_skills':
      return 'four_skills';
    case 'toeic':
      return 'toeic';
    case 'quiz':
    case 'arcade':
      return 'quiz';
    case 'pronunciation':
      return 'pronunciation';
    case 'tutor':
      return 'ai_tutor';
    default:
      return null;
  }
}

export const INACTIVITY_TIMEOUT_MS = 60_000; // 60 seconds
export const MAX_CONTINUOUS_CHUNK_SECONDS = 1800; // 30 minutes
export const MINIMUM_ELIGIBLE_LEARNING_MINUTES = 15;
export const STORAGE_KEY_ACTIVE_SESSIONS = 'emh_active_learning_sessions';
export const MAX_STORED_ACTIVE_SESSIONS = 100;

export interface ActiveSessionRecord {
  sessionId: string;
  module: ActiveLearningModule;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  activeSeconds: number; // Bounded active seconds (0 .. 1800)
  interactionCount: number;
  date: string; // YYYY-MM-DD in Asia/Ho_Chi_Minh
}

export interface ActiveLearningMetricsResult {
  totalActiveMinutes: number;
  activeDays: number;
  sessionCount: number;
  longestSessionMinutes: number;
  byModule: Record<ActiveLearningModule, number>; // in minutes
  isEligible: boolean; // >= 15 mins across at least 1 active day
}

// In-Memory Live Tracker State
interface LiveSessionState {
  sessionId: string;
  module: ActiveLearningModule;
  startTimeMs: number;
  lastInteractionMs: number;
  accumulatedActiveMs: number;
  lastTickMs: number;
  lastCheckpointMs: number;
  isPaused: boolean;
  interactionCount: number;
}

let activeLiveSession: LiveSessionState | null = null;
let listenersInitialized = false;

// Safe LocalStorage helpers
export function getStoredActiveSessions(): ActiveSessionRecord[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_SESSIONS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.slice(-MAX_STORED_ACTIVE_SESSIONS);
        }
      }
    }
  } catch {}
  return [];
}

const safeGetStoredSessions = getStoredActiveSessions;

function safeStoreSessions(sessions: ActiveSessionRecord[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const bounded = sessions.slice(-MAX_STORED_ACTIVE_SESSIONS);
      localStorage.setItem(STORAGE_KEY_ACTIVE_SESSIONS, JSON.stringify(bounded));
    }
  } catch {}
}

/**
 * Initializes DOM event listeners for visibility change, focus/blur, user interactions,
 * and page unload persistence. Safe for SSR / Node / test environments.
 */
function initDomListenersIfNeeded(): void {
  if (listenersInitialized || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  // 1. Visibility change listener (tab hidden/visible)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      pauseActiveSession();
    } else if (document.visibilityState === 'visible') {
      resumeActiveSession();
    }
  });

  // 2. Window focus and blur
  window.addEventListener('blur', () => {
    pauseActiveSession();
  });
  window.addEventListener('focus', () => {
    resumeActiveSession();
  });

  // 3. Page unload & hide: cleanly persist active session before tab closes
  window.addEventListener('beforeunload', () => {
    endActiveSession();
  });
  window.addEventListener('pagehide', () => {
    endActiveSession();
  });

  // 4. Activity heartbeat listeners
  const handleInteraction = () => {
    recordInteraction();
  };

  window.addEventListener('pointerdown', handleInteraction, { passive: true });
  window.addEventListener('keydown', handleInteraction, { passive: true });
  window.addEventListener('touchstart', handleInteraction, { passive: true });

  listenersInitialized = true;
}

// ============================================================================
// LIVE SESSION CONTROLS
// ============================================================================

/**
 * Starts an active learning session for a whitelisted module.
 * If another session was active, cleanly ends and persists it first.
 */
export function startActiveSession(
  module: ActiveLearningModule,
  customSessionId?: string,
  nowMs: number = Date.now()
): string {
  initDomListenersIfNeeded();

  if (!isWhitelistedModule(module)) {
    return '';
  }

  // If previous session is running, close it cleanly
  if (activeLiveSession) {
    endActiveSession(nowMs);
  }

  const sessionId = customSessionId || `als_${nowMs}_${module}_${Math.random().toString(36).substring(2, 7)}`;

  activeLiveSession = {
    sessionId,
    module,
    startTimeMs: nowMs,
    lastInteractionMs: nowMs,
    accumulatedActiveMs: 0,
    lastTickMs: nowMs,
    lastCheckpointMs: 0,
    isPaused: false,
    interactionCount: 1,
  };

  return sessionId;
}

/**
 * Checkpoints ongoing live session to local storage and schedules debounced sync
 * without ending the session. Allows incremental persistence during long sessions.
 */
export function checkpointActiveSession(nowMs: number = Date.now()): ActiveSessionRecord | null {
  if (!activeLiveSession) return null;

  tickSessionTime(nowMs);

  const rawActiveSeconds = Math.round(activeLiveSession.accumulatedActiveMs / 1000);
  const activeSeconds = Math.min(MAX_CONTINUOUS_CHUNK_SECONDS, Math.max(0, rawActiveSeconds));

  if (activeSeconds < 3) return null;

  activeLiveSession.lastCheckpointMs = activeLiveSession.accumulatedActiveMs;

  const record: ActiveSessionRecord = {
    sessionId: activeLiveSession.sessionId,
    module: activeLiveSession.module,
    startTime: new Date(activeLiveSession.startTimeMs).toISOString(),
    endTime: new Date(nowMs).toISOString(),
    activeSeconds,
    interactionCount: activeLiveSession.interactionCount,
    date: getVietnamDateString(activeLiveSession.startTimeMs),
  };

  const existing = safeGetStoredSessions();
  const filtered = existing.filter((s) => s.sessionId !== record.sessionId);
  safeStoreSessions([...filtered, record]);

  if (record.activeSeconds >= 10) {
    scheduleCloudSync(3000);
  }

  return record;
}

/**
 * Records a user interaction (click, keypress, audio response).
 * Resets inactivity watchdog and resumes timer if idle.
 */
export function recordInteraction(nowMs: number = Date.now()): void {
  if (!activeLiveSession) return;

  // If paused due to inactivity (not visibility), resume on interaction
  if (activeLiveSession.isPaused) {
    const isDocVisible = typeof document === 'undefined' || document.visibilityState === 'visible';
    if (isDocVisible) {
      activeLiveSession.isPaused = false;
      activeLiveSession.lastTickMs = nowMs;
    }
  } else {
    // Tick active time
    tickSessionTime(nowMs);
  }

  activeLiveSession.lastInteractionMs = nowMs;
  activeLiveSession.interactionCount++;

  // Incremental checkpoint: if accumulated active time has advanced >= 2 minutes (120s) since last checkpoint
  if (activeLiveSession.accumulatedActiveMs - activeLiveSession.lastCheckpointMs >= 120_000) {
    checkpointActiveSession(nowMs);
  }
}

/**
 * Internal tick: increments accumulatedActiveMs while verifying inactivity threshold.
 */
function tickSessionTime(nowMs: number): void {
  if (!activeLiveSession || activeLiveSession.isPaused) return;

  const elapsedSinceLastTick = nowMs - activeLiveSession.lastTickMs;
  const elapsedSinceInteraction = nowMs - activeLiveSession.lastInteractionMs;

  // Inactivity guard: if inactive for >= 60s, pause timer
  if (elapsedSinceInteraction >= INACTIVITY_TIMEOUT_MS) {
    activeLiveSession.isPaused = true;
    activeLiveSession.lastTickMs = nowMs;
    return;
  }

  // Normal active progress
  if (elapsedSinceLastTick > 0) {
    // Prevent huge jumps if timer jumped
    const safeIncrement = Math.min(elapsedSinceLastTick, INACTIVITY_TIMEOUT_MS);
    activeLiveSession.accumulatedActiveMs += safeIncrement;
  }

  activeLiveSession.lastTickMs = nowMs;
}

/**
 * Pauses the current active session (e.g. background tab or blur).
 */
export function pauseActiveSession(nowMs: number = Date.now()): void {
  if (!activeLiveSession || activeLiveSession.isPaused) return;
  tickSessionTime(nowMs);
  activeLiveSession.isPaused = true;
}

/**
 * Resumes the current active session (e.g. tab returned to foreground).
 */
export function resumeActiveSession(nowMs: number = Date.now()): void {
  if (!activeLiveSession) return;
  activeLiveSession.lastTickMs = nowMs;
  activeLiveSession.lastInteractionMs = nowMs;
  activeLiveSession.isPaused = false;
}

/**
 * Ends the active learning session, bounds active time (max 30 mins),
 * persists to local ring buffer, and returns the final record.
 */
export function endActiveSession(nowMs: number = Date.now()): ActiveSessionRecord | null {
  if (!activeLiveSession) return null;

  tickSessionTime(nowMs);

  const rawActiveSeconds = Math.round(activeLiveSession.accumulatedActiveMs / 1000);
  // Bounded check: Single continuous chunk cannot exceed 30 minutes
  const activeSeconds = Math.min(MAX_CONTINUOUS_CHUNK_SECONDS, Math.max(0, rawActiveSeconds));

  const record: ActiveSessionRecord = {
    sessionId: activeLiveSession.sessionId,
    module: activeLiveSession.module,
    startTime: new Date(activeLiveSession.startTimeMs).toISOString(),
    endTime: new Date(nowMs).toISOString(),
    activeSeconds,
    interactionCount: activeLiveSession.interactionCount,
    date: getVietnamDateString(activeLiveSession.startTimeMs),
  };

  // Only persist meaningful sessions (active for at least 3 seconds)
  if (record.activeSeconds >= 3) {
    const existing = safeGetStoredSessions();
    // Idempotency: avoid duplicate sessionId
    const filtered = existing.filter((s) => s.sessionId !== record.sessionId);
    safeStoreSessions([...filtered, record]);

    // Bounded meaningful chunk: schedule debounced sync if >= 10s
    if (record.activeSeconds >= 10) {
      scheduleCloudSync(2000);
    }
  }

  activeLiveSession = null;
  return record;
}

/**
 * Retrieves all stored sessions combined with a live snapshot of any currently
 * ongoing active session. Guarantees live accuracy without waiting for session end.
 */
export function getAllActiveSessions(nowMs: number = Date.now()): ActiveSessionRecord[] {
  const stored = safeGetStoredSessions();
  if (!activeLiveSession) {
    return stored;
  }

  tickSessionTime(nowMs);
  const rawActiveSeconds = Math.round(activeLiveSession.accumulatedActiveMs / 1000);
  const activeSeconds = Math.min(MAX_CONTINUOUS_CHUNK_SECONDS, Math.max(0, rawActiveSeconds));

  if (activeSeconds >= 3) {
    const liveRecord: ActiveSessionRecord = {
      sessionId: activeLiveSession.sessionId,
      module: activeLiveSession.module,
      startTime: new Date(activeLiveSession.startTimeMs).toISOString(),
      endTime: new Date(nowMs).toISOString(),
      activeSeconds,
      interactionCount: activeLiveSession.interactionCount,
      date: getVietnamDateString(activeLiveSession.startTimeMs),
    };

    const withoutCurrent = stored.filter((s) => s.sessionId !== liveRecord.sessionId);
    return [...withoutCurrent, liveRecord];
  }

  return stored;
}

/**
 * Retrieves live session status for UI or telemetry diagnostics.
 */
export function getActiveSessionStatus(nowMs: number = Date.now()): {
  isActive: boolean;
  module: ActiveLearningModule | null;
  activeSeconds: number;
  isPaused: boolean;
  interactionCount: number;
} {
  if (!activeLiveSession) {
    return {
      isActive: false,
      module: null,
      activeSeconds: 0,
      isPaused: false,
      interactionCount: 0,
    };
  }

  tickSessionTime(nowMs);
  const activeSeconds = Math.min(
    MAX_CONTINUOUS_CHUNK_SECONDS,
    Math.round(activeLiveSession.accumulatedActiveMs / 1000)
  );

  return {
    isActive: true,
    module: activeLiveSession.module,
    activeSeconds,
    isPaused: activeLiveSession.isPaused,
    interactionCount: activeLiveSession.interactionCount,
  };
}

// ============================================================================
// PURE METRIC DERIVATION
// ============================================================================

/**
 * Derives Active Learning Minutes for the target week:
 * - Filters sessions falling within [weekStart, weekEnd).
 * - Deduplicates by sessionId (100% idempotent).
 * - Converts bounded activeSeconds to minutes.
 * - Computes breakdown by module and active days.
 * - Returns structured ActiveLearningMetricsResult.
 */
export function deriveActiveLearningMinutes(
  sessions: ActiveSessionRecord[] = getAllActiveSessions(),
  weekStart: Date = getVietnamWeekStart(),
  weekEnd: Date = getVietnamWeekEnd()
): ActiveLearningMetricsResult {
  const weekStartMs = weekStart.getTime();
  const weekEndMs = weekEnd.getTime();

  const byModule: Record<ActiveLearningModule, number> = {
    flashcard: 0,
    four_skills: 0,
    toeic: 0,
    quiz: 0,
    pronunciation: 0,
    ai_tutor: 0,
  };

  const processedSessionIds = new Set<string>();
  const activeDates = new Set<string>();
  let totalActiveSeconds = 0;
  let longestSessionSeconds = 0;
  let sessionCount = 0;

  for (const session of sessions) {
    if (!session || !session.sessionId || processedSessionIds.has(session.sessionId)) {
      continue;
    }

    if (!isWhitelistedModule(session.module)) {
      continue;
    }

    const startMs = Date.parse(session.startTime);
    if (Number.isNaN(startMs) || startMs < weekStartMs || startMs >= weekEndMs) {
      continue;
    }

    processedSessionIds.add(session.sessionId);

    // Bounded continuous interval enforcement
    const boundedSeconds = Math.min(MAX_CONTINUOUS_CHUNK_SECONDS, Math.max(0, session.activeSeconds));
    totalActiveSeconds += boundedSeconds;
    longestSessionSeconds = Math.max(longestSessionSeconds, boundedSeconds);
    sessionCount++;

    const minutesForModule = Math.round((boundedSeconds / 60) * 10) / 10;
    byModule[session.module] = Math.round((byModule[session.module] + minutesForModule) * 10) / 10;

    const vnDate = session.date || getVietnamDateString(startMs);
    if (vnDate) {
      activeDates.add(vnDate);
    }
  }

  const totalActiveMinutes = Math.round(totalActiveSeconds / 60);
  const longestSessionMinutes = Math.round(longestSessionSeconds / 60);
  const activeDays = activeDates.size;
  const isEligible = totalActiveMinutes >= MINIMUM_ELIGIBLE_LEARNING_MINUTES && activeDays >= 1;

  return {
    totalActiveMinutes,
    activeDays,
    sessionCount,
    longestSessionMinutes,
    byModule,
    isEligible,
  };
}

/**
 * Resets in-memory live tracking state and stored sessions for unit testing.
 */
export function resetActiveSessionForTesting(): void {
  activeLiveSession = null;
  listenersInitialized = false;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_SESSIONS);
    }
  } catch {}
}
