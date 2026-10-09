// src/services/tutorSessionStorage.ts
/**
 * Isolated Session Storage for AI Tutor Conversations (Phase 6)
 * 
 * Strict Invariants:
 * 1. Scope Isolation: Tutor conversation transcripts and transient session memory
 *    are stored at the Tutor session layer, completely decoupled from global resumeActivities.
 * 2. Zero State Mutation: Reading or loading a session never ingests turns into Mistake Bank,
 *    never grants XP, and never creates SRS review records.
 * 3. Bounded Footprint: Keeps at most the latest 30 messages to prevent storage bloat.
 * 4. Stale Expiry: Sessions older than 24 hours (TUTOR_STALE_MS) are automatically discarded.
 * 5. Safe Storage Fallback: If localStorage is blocked or throws, falls back gracefully to in-memory map.
 */

import type { ChatMessage, TutorSessionMemory } from '../types';
import { TUTOR_STALE_MS } from './learningContinuityService';

export const TUTOR_STORAGE_PREFIX = 'english_mastery_tutor_session_';
export const MAX_STORED_TUTOR_MESSAGES = 30;

export interface SavedTutorSessionData {
  scenarioId: string;
  messages: ChatMessage[];
  sessionMemory: TutorSessionMemory;
  savedAt: number;
}

// In-memory fallback map for environments where localStorage is unavailable/disabled
const inMemoryFallback = new Map<string, SavedTutorSessionData>();

function getStorageKey(scenarioId: string): string {
  return `${TUTOR_STORAGE_PREFIX}${scenarioId.trim().toLowerCase()}`;
}

/**
 * Saves a tutor conversation session with transient session memory.
 */
export function saveTutorSession(
  scenarioId: string,
  messages: ChatMessage[],
  sessionMemory: TutorSessionMemory,
  now: number = Date.now()
): void {
  if (!scenarioId || !scenarioId.trim()) return;

  const cleanScenarioId = scenarioId.trim().toLowerCase();
  const boundedMessages = (messages || []).slice(-MAX_STORED_TUTOR_MESSAGES);

  const payload: SavedTutorSessionData = {
    scenarioId: cleanScenarioId,
    messages: boundedMessages,
    sessionMemory,
    savedAt: now,
  };

  const key = getStorageKey(cleanScenarioId);

  // Update in-memory fallback
  inMemoryFallback.set(key, payload);

  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // LocalStorage quota or access blocked; fallback is already retained
    }
  }
}

/**
 * Loads a tutor conversation session if present and not stale (> 24h).
 */
export function loadTutorSession(
  scenarioId: string,
  now: number = Date.now()
): SavedTutorSessionData | null {
  if (!scenarioId || !scenarioId.trim()) return null;

  const cleanScenarioId = scenarioId.trim().toLowerCase();
  const key = getStorageKey(cleanScenarioId);

  let rawJson: string | null = null;
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      rawJson = window.localStorage.getItem(key);
    } catch {
      rawJson = null;
    }
  }

  let data: SavedTutorSessionData | null = null;

  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (
        parsed &&
        typeof parsed === 'object' &&
        parsed.scenarioId &&
        Array.isArray(parsed.messages) &&
        typeof parsed.savedAt === 'number'
      ) {
        data = parsed as SavedTutorSessionData;
      }
    } catch {
      data = null;
    }
  }

  // Fallback to in-memory if localStorage had no valid data
  if (!data) {
    data = inMemoryFallback.get(key) || null;
  }

  if (!data) return null;

  // Stale check (> 24h)
  if (now - data.savedAt > TUTOR_STALE_MS) {
    clearTutorSession(cleanScenarioId);
    return null;
  }

  return data;
}

/**
 * Clears saved tutor session from storage and in-memory map.
 */
export function clearTutorSession(scenarioId: string): void {
  if (!scenarioId || !scenarioId.trim()) return;

  const cleanScenarioId = scenarioId.trim().toLowerCase();
  const key = getStorageKey(cleanScenarioId);

  inMemoryFallback.delete(key);

  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

/**
 * Checks if an active non-stale session exists for a scenario.
 */
export function hasTutorSession(scenarioId: string, now: number = Date.now()): boolean {
  return loadTutorSession(scenarioId, now) !== null;
}

/**
 * Clears all saved tutor sessions from storage and in-memory fallback.
 */
export function clearAllTutorSessions(): void {
  inMemoryFallback.clear();
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(TUTOR_STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
  }
}
