// src/services/learningContinuityService.ts
import {
  ResumableActivity,
  ResumableActivityType,
  ResumableCheckpoint,
  CONTINUITY_SCHEMA_VERSION,
} from '../types/learningContinuity';

export const MAX_RESUME_ACTIVITIES_COUNT = 25;
export const DEFAULT_STALE_ACTIVITY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const TOEIC_STALE_MS = 24 * 60 * 60 * 1000; // 24 hours for exams
export const FLASHCARD_STALE_MS = 24 * 60 * 60 * 1000; // 24 hours for daily flashcard queues
export const TUTOR_STALE_MS = 24 * 60 * 60 * 1000; // 24 hours for tutor sessions
export const CHECKPOINT_STALE_MS = 24 * 60 * 60 * 1000; // 24 hours for checkpoint assessments

const VALID_ACTIVITY_TYPES: Set<ResumableActivityType> = new Set([
  'reading',
  'writing',
  'speaking',
  'listening',
  'toeic',
  'flashcard',
  'tutor',
  'checkpoint',
]);

/**
 * Type guard & validator for a ResumableActivity.
 * Ensures the activity conforms strictly to the discriminated union without any arbitrary data leakage.
 */
export function validateResumeActivity(raw: unknown): ResumableActivity | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const obj = raw as Record<string, any>;

  // Base fields validation
  if (typeof obj.id !== 'string' || !obj.id.trim()) return null;
  if (typeof obj.type !== 'string' || !VALID_ACTIVITY_TYPES.has(obj.type as ResumableActivityType)) return null;
  if (typeof obj.title !== 'string' || !obj.title.trim()) return null;

  const startedAt = typeof obj.startedAt === 'number' && Number.isFinite(obj.startedAt) && obj.startedAt > 0
    ? obj.startedAt
    : Date.now();
  const lastActiveAt = typeof obj.lastActiveAt === 'number' && Number.isFinite(obj.lastActiveAt) && obj.lastActiveAt > 0
    ? obj.lastActiveAt
    : startedAt;

  const completed = Boolean(obj.completed);
  const completedAt = typeof obj.completedAt === 'number' && Number.isFinite(obj.completedAt)
    ? obj.completedAt
    : (completed ? lastActiveAt : undefined);

  const schemaVersion = typeof obj.schemaVersion === 'number' && Number.isFinite(obj.schemaVersion)
    ? obj.schemaVersion
    : CONTINUITY_SCHEMA_VERSION;

  const subtitle = typeof obj.subtitle === 'string' ? obj.subtitle.trim() : undefined;

  // Checkpoint validation per discriminated activity type
  const cp = obj.checkpoint;
  if (!cp || typeof cp !== 'object' || Array.isArray(cp)) return null;

  const type = obj.type as ResumableActivityType;

  switch (type) {
    case 'reading': {
      if (typeof cp.lessonId !== 'string' || !cp.lessonId.trim()) return null;
      const rawAnswers = cp.answers && typeof cp.answers === 'object' && !Array.isArray(cp.answers) ? cp.answers : {};
      const sanitizedAnswers: Record<string, number> = {};
      for (const [k, v] of Object.entries(rawAnswers)) {
        if (typeof k === 'string' && typeof v === 'number' && Number.isFinite(v)) {
          sanitizedAnswers[k] = v;
        }
      }
      const totalQuestions = typeof cp.totalQuestions === 'number' && Number.isFinite(cp.totalQuestions) && cp.totalQuestions >= 0
        ? cp.totalQuestions
        : 0;

      return {
        id: obj.id.trim(),
        type: 'reading',
        title: obj.title.trim(),
        subtitle,
        startedAt,
        lastActiveAt,
        completed,
        completedAt,
        schemaVersion,
        checkpoint: {
          lessonId: cp.lessonId.trim(),
          answers: sanitizedAnswers,
          totalQuestions,
          activeSection: cp.activeSection === 'quiz' ? 'quiz' : (cp.activeSection === 'passage' ? 'passage' : undefined),
          progressPercent: typeof cp.progressPercent === 'number' && Number.isFinite(cp.progressPercent) ? cp.progressPercent : undefined,
        },
      };
    }

    case 'writing': {
      if (typeof cp.promptId !== 'string' || !cp.promptId.trim()) return null;
      const draft = typeof cp.draft === 'string' ? cp.draft : '';
      const customTopic = typeof cp.customTopic === 'string' ? cp.customTopic.trim() : undefined;
      const wordCount = typeof cp.wordCount === 'number' && Number.isFinite(cp.wordCount) && cp.wordCount >= 0
        ? cp.wordCount
        : draft.trim().split(/\s+/).filter(Boolean).length;
      const progressPercent = typeof cp.progressPercent === 'number' && Number.isFinite(cp.progressPercent) ? cp.progressPercent : undefined;

      return {
        id: obj.id.trim(),
        type: 'writing',
        title: obj.title.trim(),
        subtitle,
        startedAt,
        lastActiveAt,
        completed,
        completedAt,
        schemaVersion,
        checkpoint: {
          promptId: cp.promptId.trim(),
          customTopic,
          draft,
          wordCount,
          progressPercent,
        },
      };
    }

    case 'speaking': {
      if (typeof cp.promptId !== 'string' || !cp.promptId.trim()) return null;
      const currentTurnIndex = typeof cp.currentTurnIndex === 'number' && Number.isFinite(cp.currentTurnIndex) && cp.currentTurnIndex >= 0
        ? cp.currentTurnIndex
        : 0;
      const totalTurns = typeof cp.totalTurns === 'number' && Number.isFinite(cp.totalTurns) && cp.totalTurns > 0
        ? cp.totalTurns
        : 1;
      const progressPercent = typeof cp.progressPercent === 'number' && Number.isFinite(cp.progressPercent) ? cp.progressPercent : undefined;

      return {
        id: obj.id.trim(),
        type: 'speaking',
        title: obj.title.trim(),
        subtitle,
        startedAt,
        lastActiveAt,
        completed,
        completedAt,
        schemaVersion,
        checkpoint: {
          promptId: cp.promptId.trim(),
          currentTurnIndex,
          totalTurns,
          progressPercent,
        },
      };
    }

    case 'listening': {
      if (typeof cp.lessonId !== 'string' || !cp.lessonId.trim()) return null;
      const rawAnswers = cp.answers && typeof cp.answers === 'object' && !Array.isArray(cp.answers) ? cp.answers : {};
      const sanitizedAnswers: Record<string, number> = {};
      for (const [k, v] of Object.entries(rawAnswers)) {
        if (typeof k === 'string' && typeof v === 'number' && Number.isFinite(v)) {
          sanitizedAnswers[k] = v;
        }
      }
      const totalQuestions = typeof cp.totalQuestions === 'number' && Number.isFinite(cp.totalQuestions) && cp.totalQuestions >= 0
        ? cp.totalQuestions
        : 0;
      const progressPercent = typeof cp.progressPercent === 'number' && Number.isFinite(cp.progressPercent) ? cp.progressPercent : undefined;

      return {
        id: obj.id.trim(),
        type: 'listening',
        title: obj.title.trim(),
        subtitle,
        startedAt,
        lastActiveAt,
        completed,
        completedAt,
        schemaVersion,
        checkpoint: {
          lessonId: cp.lessonId.trim(),
          answers: sanitizedAnswers,
          totalQuestions,
          progressPercent,
        },
      };
    }

    case 'toeic': {
      if (typeof cp.attemptId !== 'string' || !cp.attemptId.trim()) return null;
      const examMode = typeof cp.examMode === 'string' && cp.examMode.trim() ? cp.examMode.trim() : '2skills_mini';
      const experienceMode = typeof cp.experienceMode === 'string' ? cp.experienceMode : undefined;
      const skillScope = typeof cp.skillScope === 'string' ? cp.skillScope : undefined;
      const currentQuestionIdx = typeof cp.currentQuestionIdx === 'number' && Number.isFinite(cp.currentQuestionIdx) && cp.currentQuestionIdx >= 0
        ? cp.currentQuestionIdx
        : 0;
      const totalQuestions = typeof cp.totalQuestions === 'number' && Number.isFinite(cp.totalQuestions) && cp.totalQuestions >= 0
        ? cp.totalQuestions
        : 0;
      const answeredCount = typeof cp.answeredCount === 'number' && Number.isFinite(cp.answeredCount) && cp.answeredCount >= 0
        ? cp.answeredCount
        : 0;
      const timeLeftSeconds = typeof cp.timeLeftSeconds === 'number' && Number.isFinite(cp.timeLeftSeconds) && cp.timeLeftSeconds >= 0
        ? cp.timeLeftSeconds
        : 0;

      const rawUserAnswers = cp.userAnswers && typeof cp.userAnswers === 'object' && !Array.isArray(cp.userAnswers) ? cp.userAnswers : {};
      const sanitizedUserAnswers: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawUserAnswers)) {
        if (typeof k === 'string' && typeof v === 'string') {
          sanitizedUserAnswers[k] = v;
        }
      }

      const isPaused = Boolean(cp.isPaused);
      const deadline = typeof cp.deadline === 'number' && Number.isFinite(cp.deadline) ? cp.deadline : undefined;
      const savedAt = typeof cp.savedAt === 'number' && Number.isFinite(cp.savedAt) ? cp.savedAt : undefined;
      const progressPercent = typeof cp.progressPercent === 'number' && Number.isFinite(cp.progressPercent) ? cp.progressPercent : undefined;

      return {
        id: obj.id.trim(),
        type: 'toeic',
        title: obj.title.trim(),
        subtitle,
        startedAt,
        lastActiveAt,
        completed,
        completedAt,
        schemaVersion,
        checkpoint: {
          attemptId: cp.attemptId.trim(),
          examMode,
          experienceMode,
          skillScope,
          currentQuestionIdx,
          totalQuestions,
          answeredCount,
          timeLeftSeconds,
          userAnswers: sanitizedUserAnswers,
          isPaused,
          deadline,
          savedAt,
          progressPercent,
        },
      };
    }

    case 'flashcard': {
      const validModes = new Set(['DUE', 'NEW', 'LEARNED', 'ALL']);
      const queueMode = typeof cp.queueMode === 'string' && validModes.has(cp.queueMode)
        ? (cp.queueMode as 'DUE' | 'NEW' | 'LEARNED' | 'ALL')
        : 'DUE';
      const reviewedCount = typeof cp.reviewedCount === 'number' && Number.isFinite(cp.reviewedCount) && cp.reviewedCount >= 0
        ? cp.reviewedCount
        : 0;
      const filterTag = typeof cp.filterTag === 'string' ? cp.filterTag : undefined;
      const cardType = typeof cp.cardType === 'string' ? cp.cardType : undefined;
      const level = typeof cp.level === 'string' ? cp.level : undefined;
      const totalDue = typeof cp.totalDue === 'number' && Number.isFinite(cp.totalDue) ? cp.totalDue : undefined;
      const totalCards = typeof cp.totalCards === 'number' && Number.isFinite(cp.totalCards) ? cp.totalCards : undefined;
      const currentIndex = typeof cp.currentIndex === 'number' && Number.isFinite(cp.currentIndex) ? cp.currentIndex : undefined;
      const sessionId = typeof cp.sessionId === 'string' ? cp.sessionId : undefined;
      const progressPercent = typeof cp.progressPercent === 'number' && Number.isFinite(cp.progressPercent) ? cp.progressPercent : undefined;

      const orderedCardIds = Array.isArray(cp.orderedCardIds)
        ? cp.orderedCardIds.filter((x: any): x is string => typeof x === 'string' && x.trim().length > 0)
        : undefined;
      const reviewedCardIds = Array.isArray(cp.reviewedCardIds)
        ? cp.reviewedCardIds.filter((x: any): x is string => typeof x === 'string' && x.trim().length > 0)
        : undefined;

      return {
        id: obj.id.trim(),
        type: 'flashcard',
        title: obj.title.trim(),
        subtitle,
        startedAt,
        lastActiveAt,
        completed,
        completedAt,
        schemaVersion,
        checkpoint: {
          sessionId,
          queueMode,
          filterTag,
          cardType,
          level,
          orderedCardIds,
          currentIndex,
          reviewedCardIds,
          reviewedCount,
          totalDue,
          totalCards,
          progressPercent,
        },
      };
    }

    case 'tutor': {
      if (typeof cp.sessionId !== 'string' || !cp.sessionId.trim()) return null;
      if (typeof cp.scenarioId !== 'string' || !cp.scenarioId.trim()) return null;
      const turnCount = typeof cp.turnCount === 'number' && Number.isFinite(cp.turnCount) && cp.turnCount >= 0
        ? cp.turnCount
        : 0;
      const lastMessageSummary = typeof cp.lastMessageSummary === 'string' && cp.lastMessageSummary.trim()
        ? cp.lastMessageSummary.trim().slice(0, 100)
        : undefined;
      const progressPercent = typeof cp.progressPercent === 'number' && Number.isFinite(cp.progressPercent)
        ? cp.progressPercent
        : undefined;

      return {
        id: obj.id.trim(),
        type: 'tutor',
        title: obj.title.trim(),
        subtitle,
        startedAt,
        lastActiveAt,
        completed,
        completedAt,
        schemaVersion,
        checkpoint: {
          sessionId: cp.sessionId.trim(),
          scenarioId: cp.scenarioId.trim(),
          turnCount,
          lastMessageSummary,
          progressPercent,
        },
      };
    }

    case 'checkpoint': {
      if (typeof cp.attemptId !== 'string' || !cp.attemptId.trim()) return null;
      const validLevels = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
      if (typeof cp.level !== 'string' || !validLevels.has(cp.level)) return null;

      const validSkills = new Set(['listening', 'reading', 'speaking', 'writing']);
      if (typeof cp.currentSection !== 'string' || !validSkills.has(cp.currentSection)) return null;

      const rawCompleted = Array.isArray(cp.completedSections) ? cp.completedSections : [];
      const completedSections: Array<'listening' | 'reading' | 'speaking' | 'writing'> = [];
      for (const s of rawCompleted) {
        if (typeof s === 'string' && validSkills.has(s) && !completedSections.includes(s as any)) {
          completedSections.push(s as any);
        }
      }

      // listening answers
      const rawListening = cp.listeningAnswers && typeof cp.listeningAnswers === 'object' && !Array.isArray(cp.listeningAnswers) ? cp.listeningAnswers : {};
      const listeningAnswers: Record<string, number> = {};
      for (const [k, v] of Object.entries(rawListening)) {
        if (typeof k === 'string' && typeof v === 'number' && Number.isFinite(v)) {
          listeningAnswers[k] = v;
        }
      }

      // reading answers
      const rawReading = cp.readingAnswers && typeof cp.readingAnswers === 'object' && !Array.isArray(cp.readingAnswers) ? cp.readingAnswers : {};
      const readingAnswers: Record<string, number> = {};
      for (const [k, v] of Object.entries(rawReading)) {
        if (typeof k === 'string' && typeof v === 'number' && Number.isFinite(v)) {
          readingAnswers[k] = v;
        }
      }

      // speaking transcripts
      const rawSpeaking = cp.speakingTranscripts && typeof cp.speakingTranscripts === 'object' && !Array.isArray(cp.speakingTranscripts) ? cp.speakingTranscripts : {};
      const speakingTranscripts: Record<number, string> = {};
      for (const [k, v] of Object.entries(rawSpeaking)) {
        const turnIdx = Number(k);
        if (Number.isFinite(turnIdx) && typeof v === 'string') {
          speakingTranscripts[turnIdx] = v;
        }
      }

      // writing draft
      const writingDraft = typeof cp.writingDraft === 'string' ? cp.writingDraft : '';

      // section scores
      const rawScores = cp.sectionScores && typeof cp.sectionScores === 'object' && !Array.isArray(cp.sectionScores) ? cp.sectionScores : undefined;
      let sectionScores: Partial<Record<'listening' | 'reading' | 'speaking' | 'writing', number>> | undefined = undefined;
      if (rawScores) {
        sectionScores = {};
        for (const [k, v] of Object.entries(rawScores)) {
          if (typeof k === 'string' && validSkills.has(k) && typeof v === 'number' && Number.isFinite(v)) {
            sectionScores[k as 'listening' | 'reading' | 'speaking' | 'writing'] = Math.max(0, Math.min(100, Math.round(v)));
          }
        }
      }

      const timeLeftSeconds = typeof cp.timeLeftSeconds === 'number' && Number.isFinite(cp.timeLeftSeconds) && cp.timeLeftSeconds >= 0
        ? cp.timeLeftSeconds
        : undefined;

      const progressPercent = typeof cp.progressPercent === 'number' && Number.isFinite(cp.progressPercent)
        ? Math.max(0, Math.min(100, Math.round(cp.progressPercent)))
        : Math.round((completedSections.length / 4) * 100);

      const listeningAudioPlayCount = typeof cp.listeningAudioPlayCount === 'number' && Number.isFinite(cp.listeningAudioPlayCount) && cp.listeningAudioPlayCount >= 0
        ? Math.round(cp.listeningAudioPlayCount)
        : undefined;

      return {
        id: obj.id.trim(),
        type: 'checkpoint',
        title: obj.title.trim(),
        subtitle,
        startedAt,
        lastActiveAt,
        completed,
        completedAt,
        schemaVersion,
        checkpoint: {
          attemptId: cp.attemptId.trim(),
          level: cp.level,
          currentSection: cp.currentSection as 'listening' | 'reading' | 'speaking' | 'writing',
          completedSections,
          listeningAnswers,
          readingAnswers,
          speakingTranscripts,
          writingDraft,
          sectionScores,
          timeLeftSeconds,
          progressPercent,
          listeningAudioPlayCount,
        },
      };
    }

    default:
      return null;
  }
}

/**
 * Checks whether an activity is stale and should not be offered as resumable.
 */
export function isActivityStale(activity: ResumableActivity, now = Date.now()): boolean {
  const age = Math.max(0, now - activity.lastActiveAt);

  if (activity.type === 'toeic') {
    return age > TOEIC_STALE_MS;
  }
  if (activity.type === 'flashcard') {
    return age > FLASHCARD_STALE_MS;
  }
  if (activity.type === 'tutor') {
    return age > TUTOR_STALE_MS;
  }
  if (activity.type === 'checkpoint') {
    return age > CHECKPOINT_STALE_MS;
  }
  return age > DEFAULT_STALE_ACTIVITY_MS;
}

/**
 * Sanitizes and bounds the resumeActivities map from storage or memory.
 * Removes corrupt entries, keeps at most MAX_RESUME_ACTIVITIES_COUNT by lastActiveAt.
 */
export function sanitizeResumeActivitiesMap(raw: unknown, now?: number): Record<string, ResumableActivity> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const validList: ResumableActivity[] = [];

  for (const item of Object.values(raw as Record<string, unknown>)) {
    const valid = validateResumeActivity(item);
    if (valid) {
      if (typeof now === 'number' && !valid.completed && isActivityStale(valid, now)) {
        continue; // Discard stale uncompleted activity only when now is explicitly provided
      }
      validList.push(valid);
    }
  }

  // Sort by lastActiveAt descending
  validList.sort((a, b) => b.lastActiveAt - a.lastActiveAt);

  // Keep bounded count
  const bounded = validList.slice(0, MAX_RESUME_ACTIVITIES_COUNT);

  const result: Record<string, ResumableActivity> = {};
  for (const item of bounded) {
    result[item.id] = item;
  }

  return result;
}

/**
 * Retrieves the most recent resumable activity that is active (not completed) and not stale.
 */
export function getMostRecentResumableActivity(
  activities: Record<string, ResumableActivity> | undefined,
  now = Date.now()
): ResumableActivity | null {
  if (!activities || typeof activities !== 'object') return null;

  const activeCandidates = Object.values(activities).filter(
    (a) => !a.completed && !isActivityStale(a, now)
  );

  if (activeCandidates.length === 0) return null;

  activeCandidates.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  return activeCandidates[0];
}

/**
 * Merges two maps of resume activities (e.g. from local storage and cloud sync).
 * Invariants:
 * 1. "Completed" always wins over active/stale resume state (completed wins).
 * 2. If neither is completed, the one with more recent `lastActiveAt` wins.
 * 3. Sanitizes and bounds the resulting map to MAX_RESUME_ACTIVITIES_COUNT.
 */
export function mergeResumeActivities(
  local?: Record<string, ResumableActivity>,
  remote?: Record<string, ResumableActivity>,
  now = Date.now()
): Record<string, ResumableActivity> {
  const localMap = sanitizeResumeActivitiesMap(local, now);
  const remoteMap = sanitizeResumeActivitiesMap(remote, now);

  const merged: Record<string, ResumableActivity> = { ...localMap };

  for (const [id, remoteAct] of Object.entries(remoteMap)) {
    const localAct = merged[id];
    if (!localAct) {
      merged[id] = remoteAct;
      continue;
    }

    // Invariant: Completed always wins!
    if (localAct.completed || remoteAct.completed) {
      merged[id] = {
        ...(localAct.completed ? localAct : remoteAct),
        completed: true,
        completedAt: Math.max(localAct.completedAt || 0, remoteAct.completedAt || 0) || now,
      };
      continue;
    }

    // Neither is completed: pick the one with later lastActiveAt
    if (remoteAct.lastActiveAt > localAct.lastActiveAt) {
      merged[id] = remoteAct;
    }
  }

  return sanitizeResumeActivitiesMap(merged, now);
}

/**
 * Returns up to `limit` most recent active (uncompleted, non-stale) resumable activities,
 * sorted descending by `lastActiveAt`.
 */
export function getRecentResumableActivities(
  activities: Record<string, ResumableActivity> | undefined,
  limit = 3,
  now = Date.now()
): ResumableActivity[] {
  if (!activities || typeof activities !== 'object') return [];

  const activeCandidates = Object.values(activities).filter(
    (a) => !a.completed && !isActivityStale(a, now)
  );

  activeCandidates.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  return activeCandidates.slice(0, limit);
}
