import type {
  AppStoreState,
  ResumableActivity,
  ResumableCheckpoint,
} from '../../types';
import {
  validateResumeActivity,
  sanitizeResumeActivitiesMap,
  getMostRecentResumableActivity,
} from '../../services/learningContinuityService';

export interface ContinuitySlice {
  upsertResumeActivity: (activity: ResumableActivity) => void;
  updateResumeCheckpoint: (id: string, checkpoint: Partial<ResumableCheckpoint>) => void;
  completeResumeActivity: (id: string) => void;
  removeResumeActivity: (id: string) => void;
  getLastResumableActivity: () => ResumableActivity | null;
  getMostRecentResumableActivity: () => ResumableActivity | null;
}

type SetState = (
  partial: Partial<AppStoreState> | ((state: AppStoreState) => Partial<AppStoreState>),
  replace?: boolean
) => void;
type GetState = () => AppStoreState;

export const createContinuitySlice = (set: SetState, get: GetState): ContinuitySlice => ({
  upsertResumeActivity: (activity: ResumableActivity) => {
    const validated = validateResumeActivity(activity);
    if (!validated) return;

    set((state) => {
      const currentMap = state.resumeActivities || {};
      const existing = currentMap[validated.id];
      // Invariant: Completed Always Wins!
      // If existing activity was completed and incoming is not completed, do not resurrect it.
      if (existing?.completed && !validated.completed) {
        return state;
      }

      const merged: ResumableActivity = {
        ...validated,
        startedAt: existing ? Math.min(existing.startedAt, validated.startedAt) : validated.startedAt,
        lastActiveAt: Math.max(existing?.lastActiveAt || 0, validated.lastActiveAt),
      } as ResumableActivity;

      const nextMap = {
        ...currentMap,
        [validated.id]: merged,
      };

      return {
        resumeActivities: sanitizeResumeActivitiesMap(nextMap),
      };
    });
  },

  updateResumeCheckpoint: (id: string, checkpoint: Partial<ResumableCheckpoint>) => {
    if (!id || !checkpoint || typeof checkpoint !== 'object') return;

    set((state) => {
      const currentMap = state.resumeActivities || {};
      const existing = currentMap[id];
      if (!existing || existing.completed) return state; // Invariant: Never mutate an already completed activity

      const updatedCandidate = {
        ...existing,
        lastActiveAt: Date.now(),
        checkpoint: {
          ...existing.checkpoint,
          ...checkpoint,
        },
      };

      const revalidated = validateResumeActivity(updatedCandidate);
      if (!revalidated) return state;

      return {
        resumeActivities: {
          ...currentMap,
          [id]: revalidated,
        },
      };
    });
  },

  completeResumeActivity: (id: string) => {
    if (!id) return;
    set((state) => {
      const currentMap = state.resumeActivities || {};
      const existing = currentMap[id];
      if (!existing) return state;

      const now = Date.now();
      const completedActivity: ResumableActivity = {
        ...existing,
        completed: true,
        completedAt: now,
        lastActiveAt: now,
      };

      return {
        resumeActivities: {
          ...currentMap,
          [id]: completedActivity,
        },
      };
    });
  },

  removeResumeActivity: (id: string) => {
    if (!id) return;
    set((state) => {
      const currentMap = state.resumeActivities || {};
      if (!currentMap[id]) return state;

      const nextMap = { ...currentMap };
      delete nextMap[id];

      return {
        resumeActivities: nextMap,
      };
    });
  },

  getLastResumableActivity: () => {
    return getMostRecentResumableActivity(get().resumeActivities);
  },

  getMostRecentResumableActivity: () => {
    return getMostRecentResumableActivity(get().resumeActivities);
  },
});
