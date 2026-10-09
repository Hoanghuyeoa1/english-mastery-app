import type { FourSkillsScores, FourSkillsCompletionProgress } from '../types';
import type {
  CefrLevel,
  CefrSkill,
  LevelCertificationStore,
  PersistedLevelCertification,
  CheckpointHistoryEntry,
} from '../types/levelCertification';
import {
  CEFR_LEVELS_ORDER,
  CEFR_SKILLS_LIST,
} from '../types/levelCertification';
import type {
  ResumableActivity,
  CheckpointResumableActivity,
} from '../types/learningContinuity';

export const DEFAULT_FOUR_SKILLS_SCORES: FourSkillsScores = {
  listening: [],
  reading: [],
  speaking: [],
  writing: [],
};

export function sanitizeScoreArray(arr: any): number[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && !Number.isNaN(n))
    .map((n) => Math.max(0, Math.min(100, Math.round(n))))
    .slice(-50);
}

export function sanitizeFourSkillsScores(raw: any): FourSkillsScores {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_FOUR_SKILLS_SCORES };
  }
  return {
    listening: sanitizeScoreArray(raw.listening),
    reading: sanitizeScoreArray(raw.reading),
    speaking: sanitizeScoreArray(raw.speaking),
    writing: sanitizeScoreArray(raw.writing),
  };
}

export function sanitizeStringIds(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  const cleanList = arr
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
  return Array.from(new Set(cleanList));
}

export const DEFAULT_FOUR_SKILLS_COMPLETION_PROGRESS: FourSkillsCompletionProgress = Object.freeze({
  reading: [],
  speaking: [],
  writing: [],
});

export function sanitizeFourSkillsCompletionProgress(raw: unknown): FourSkillsCompletionProgress {
  if (!raw || typeof raw !== 'object') {
    return {
      reading: [],
      speaking: [],
      writing: [],
    };
  }
  const obj = raw as Record<string, unknown>;
  return {
    reading: sanitizeStringIds(obj.reading),
    speaking: sanitizeStringIds(obj.speaking),
    writing: sanitizeStringIds(obj.writing),
  };
}

export function mergeCompletionProgressIds(base?: string[], incoming?: string[]): string[] {
  const cleanBase = sanitizeStringIds(base);
  const cleanIncoming = sanitizeStringIds(incoming);
  return Array.from(new Set([...cleanBase, ...cleanIncoming]));
}

export function mergeFourSkillsCompletionProgress(
  local?: Partial<FourSkillsCompletionProgress> | null,
  remote?: Partial<FourSkillsCompletionProgress> | null
): FourSkillsCompletionProgress {
  return {
    reading: mergeCompletionProgressIds(local?.reading, remote?.reading),
    speaking: mergeCompletionProgressIds(local?.speaking, remote?.speaking),
    writing: mergeCompletionProgressIds(local?.writing, remote?.writing),
  };
}

export function mergeSkillScores(localRaw?: any, cloudRaw?: any): number[] {
  const cleanLocal = sanitizeScoreArray(localRaw);
  const cleanCloud = sanitizeScoreArray(cloudRaw);

  if (cleanCloud.length === 0) return cleanLocal;
  if (cleanLocal.length === 0) return cleanCloud;

  // 1. Identical check: avoid duplicating exact matching histories
  if (
    cleanLocal.length === cleanCloud.length &&
    cleanLocal.every((val, idx) => val === cleanCloud[idx])
  ) {
    return cleanLocal;
  }

  // 2. Cloud extends local (cloud starts with entire local array)
  if (
    cleanCloud.length > cleanLocal.length &&
    cleanLocal.every((val, idx) => val === cleanCloud[idx])
  ) {
    return cleanCloud.slice(-50);
  }

  // 3. Local extends cloud (local starts with entire cloud array)
  if (
    cleanLocal.length > cleanCloud.length &&
    cleanLocal.every((val, idx) => val === cleanCloud[idx])
  ) {
    return cleanLocal.slice(-50);
  }

  // 4. Overlap check: local ends with a prefix of cloud
  const maxOverlap = Math.min(cleanLocal.length, cleanCloud.length);
  for (let overlapLen = maxOverlap; overlapLen > 0; overlapLen--) {
    const localSlice = cleanLocal.slice(-overlapLen);
    const cloudSlice = cleanCloud.slice(0, overlapLen);
    if (localSlice.every((val, idx) => val === cloudSlice[idx])) {
      return [...cleanLocal, ...cleanCloud.slice(overlapLen)].slice(-50);
    }
  }

  // 5. Overlap check: cloud ends with a prefix of local
  for (let overlapLen = maxOverlap; overlapLen > 0; overlapLen--) {
    const cloudSlice = cleanCloud.slice(-overlapLen);
    const localSlice = cleanLocal.slice(0, overlapLen);
    if (cloudSlice.every((val, idx) => val === localSlice[idx])) {
      return [...cleanCloud, ...cleanLocal.slice(overlapLen)].slice(-50);
    }
  }

  // 6. Disjoint / non-overlapping: append cloud to local (preserves test scenario 8 behavior)
  return [...cleanLocal, ...cleanCloud].slice(-50);
}

export function isCefrLevel(lvl: unknown): lvl is CefrLevel {
  return typeof lvl === 'string' && (CEFR_LEVELS_ORDER as readonly string[]).includes(lvl);
}

export function isCefrSkill(skill: unknown): skill is CefrSkill {
  return typeof skill === 'string' && (CEFR_SKILLS_LIST as readonly string[]).includes(skill);
}

export function sanitizePersistedLevelCertification(raw: unknown): PersistedLevelCertification | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  if (!isCefrLevel(obj.level)) return null;
  if (typeof obj.certificateId !== 'string' || !obj.certificateId.trim()) return null;
  if (typeof obj.certifiedAt !== 'number' || !Number.isFinite(obj.certifiedAt) || obj.certifiedAt <= 0) return null;
  if (typeof obj.overallScore !== 'number' || !Number.isFinite(obj.overallScore)) return null;
  if (typeof obj.attemptId !== 'string' || !obj.attemptId.trim()) return null;

  // skillScores must have listening, reading, speaking, writing
  if (!obj.skillScores || typeof obj.skillScores !== 'object' || Array.isArray(obj.skillScores)) return null;
  const rawSkills = obj.skillScores as Record<string, unknown>;
  const skillScores: Record<CefrSkill, number> = {
    listening: 0,
    reading: 0,
    speaking: 0,
    writing: 0,
  };
  for (const skill of CEFR_SKILLS_LIST) {
    const val = rawSkills[skill];
    if (typeof val !== 'number' || !Number.isFinite(val)) return null;
    skillScores[skill] = Math.max(0, Math.min(100, Math.round(val)));
  }

  // criteriaSummary validation
  if (!obj.criteriaSummary || typeof obj.criteriaSummary !== 'object' || Array.isArray(obj.criteriaSummary)) return null;
  const rawCrit = obj.criteriaSummary as Record<string, unknown>;
  if (
    typeof rawCrit.overallRequired !== 'number' ||
    typeof rawCrit.overallAchieved !== 'number' ||
    typeof rawCrit.floorRequired !== 'number' ||
    typeof rawCrit.minSkillAchieved !== 'number'
  ) {
    return null;
  }

  const verifiedVersion = typeof obj.verifiedVersion === 'string' && obj.verifiedVersion.trim()
    ? obj.verifiedVersion.trim()
    : '2026.1';

  return {
    level: obj.level,
    certificateId: obj.certificateId.trim(),
    certifiedAt: obj.certifiedAt,
    overallScore: Math.max(0, Math.min(100, Math.round(obj.overallScore))),
    skillScores,
    attemptId: obj.attemptId.trim(),
    verifiedVersion,
    criteriaSummary: {
      overallRequired: rawCrit.overallRequired,
      overallAchieved: rawCrit.overallAchieved,
      floorRequired: rawCrit.floorRequired,
      minSkillAchieved: rawCrit.minSkillAchieved,
      verifiedVersion: typeof rawCrit.verifiedVersion === 'string' ? rawCrit.verifiedVersion : verifiedVersion,
    },
  };
}

export function sanitizeLevelCertifications(raw: unknown): LevelCertificationStore {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const cleanStore: LevelCertificationStore = {};

  for (const level of CEFR_LEVELS_ORDER) {
    const item = obj[level];
    if (item) {
      const sanitized = sanitizePersistedLevelCertification(item);
      if (sanitized && sanitized.level === level) {
        cleanStore[level] = sanitized;
      }
    }
  }

  return cleanStore;
}

export function sanitizeCheckpointHistoryEntry(raw: unknown): CheckpointHistoryEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.attemptId !== 'string' || !obj.attemptId.trim()) return null;
  if (!isCefrLevel(obj.level)) return null;
  if (typeof obj.date !== 'number' || !Number.isFinite(obj.date) || obj.date <= 0) return null;

  const result = obj.result;
  if (result !== 'certified' && result !== 'needs_reinforcement') return null;
  const isPassed = Boolean(obj.isPassed);

  if (typeof obj.overallScore !== 'number' || !Number.isFinite(obj.overallScore)) return null;

  if (!obj.scores || typeof obj.scores !== 'object' || Array.isArray(obj.scores)) return null;
  const rawScores = obj.scores as Record<string, unknown>;
  const scores: Record<CefrSkill, number> = {
    listening: 0,
    reading: 0,
    speaking: 0,
    writing: 0,
  };
  for (const skill of CEFR_SKILLS_LIST) {
    const val = rawScores[skill];
    if (typeof val !== 'number' || !Number.isFinite(val)) return null;
    scores[skill] = Math.max(0, Math.min(100, Math.round(val)));
  }

  const policyVersion = typeof obj.policyVersion === 'string' && obj.policyVersion.trim()
    ? obj.policyVersion.trim()
    : '2026.1';
  const schemaVersion = typeof obj.schemaVersion === 'number' && Number.isFinite(obj.schemaVersion)
    ? obj.schemaVersion
    : 1;

  const certificateId = typeof obj.certificateId === 'string' && obj.certificateId.trim()
    ? obj.certificateId.trim()
    : undefined;

  return {
    attemptId: obj.attemptId.trim(),
    level: obj.level,
    date: obj.date,
    result,
    isPassed,
    overallScore: Math.max(0, Math.min(100, Math.round(obj.overallScore))),
    scores,
    policyVersion,
    schemaVersion,
    ...(certificateId ? { certificateId } : {}),
  };
}

export const MAX_PERSISTED_CHECKPOINT_HISTORY = 50;

export function sanitizeCheckpointHistory(
  raw: unknown,
  maxTotal = MAX_PERSISTED_CHECKPOINT_HISTORY
): CheckpointHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const validEntries: CheckpointHistoryEntry[] = [];
  const seenAttempts = new Set<string>();

  for (const item of raw) {
    const sanitized = sanitizeCheckpointHistoryEntry(item);
    if (sanitized && !seenAttempts.has(sanitized.attemptId)) {
      seenAttempts.add(sanitized.attemptId);
      validEntries.push(sanitized);
    }
  }

  return validEntries
    .sort((a, b) => b.date - a.date)
    .slice(0, maxTotal);
}

/**
 * Deterministic Monotonic Merge for Level Certifications.
 *
 * Invariant:
 * 1. A valid certification can NEVER be deleted by a stale empty or missing remote record.
 * 2. If both local and remote have a certificate for level L:
 *    - Higher overallScore wins.
 *    - If tied, earlier certifiedAt wins (stable first-achievement timestamp).
 */
export function mergeLevelCertifications(
  local?: LevelCertificationStore | null,
  remote?: LevelCertificationStore | null
): LevelCertificationStore {
  const cleanLocal = sanitizeLevelCertifications(local);
  const cleanRemote = sanitizeLevelCertifications(remote);

  const merged: LevelCertificationStore = { ...cleanLocal };

  for (const level of CEFR_LEVELS_ORDER) {
    const localCert = cleanLocal[level];
    const remoteCert = cleanRemote[level];

    if (!localCert && remoteCert) {
      merged[level] = remoteCert;
    } else if (localCert && remoteCert) {
      if (remoteCert.overallScore > localCert.overallScore) {
        merged[level] = remoteCert;
      } else if (remoteCert.overallScore === localCert.overallScore) {
        merged[level] = remoteCert.certifiedAt < localCert.certifiedAt ? remoteCert : localCert;
      } else {
        merged[level] = localCert;
      }
    }
  }

  return merged;
}

/**
 * Deterministic Deduplicated Merge for Checkpoint History.
 * Deduplicates by attemptId, sorts newest first, and bounds to maxTotal.
 */
export function mergeCheckpointHistory(
  local?: CheckpointHistoryEntry[] | null,
  remote?: CheckpointHistoryEntry[] | null,
  maxTotal = MAX_PERSISTED_CHECKPOINT_HISTORY
): CheckpointHistoryEntry[] {
  const cleanLocal = sanitizeCheckpointHistory(local, maxTotal);
  const cleanRemote = sanitizeCheckpointHistory(remote, maxTotal);

  if (cleanRemote.length === 0) return cleanLocal;
  if (cleanLocal.length === 0) return cleanRemote;

  const entryMap = new Map<string, CheckpointHistoryEntry>();

  for (const item of cleanLocal) {
    entryMap.set(item.attemptId, item);
  }

  for (const item of cleanRemote) {
    if (!entryMap.has(item.attemptId)) {
      entryMap.set(item.attemptId, item);
    }
  }

  return Array.from(entryMap.values())
    .sort((a, b) => b.date - a.date)
    .slice(0, maxTotal);
}

/**
 * Completed Always Wins Invariant:
 * Any in-progress checkpoint activity whose attemptId has already been finalized
 * in checkpointHistory must be marked completed to prevent stale resurrection.
 */
export function pruneFinalizedCheckpointResumes(
  resumeActivities?: Record<string, ResumableActivity> | null,
  checkpointHistory?: CheckpointHistoryEntry[] | null
): Record<string, ResumableActivity> {
  if (!resumeActivities || typeof resumeActivities !== 'object') return {};

  const finalizedAttemptIds = new Set<string>();
  if (Array.isArray(checkpointHistory)) {
    for (const h of checkpointHistory) {
      if (h?.attemptId) {
        finalizedAttemptIds.add(h.attemptId);
      }
    }
  }

  if (finalizedAttemptIds.size === 0) {
    return { ...resumeActivities };
  }

  const pruned: Record<string, ResumableActivity> = {};
  for (const [key, act] of Object.entries(resumeActivities)) {
    if (!act) continue;

    if (act.type === 'checkpoint') {
      const cpAttemptId = (act as CheckpointResumableActivity).checkpoint?.attemptId || act.id;
      if (finalizedAttemptIds.has(cpAttemptId)) {
        pruned[key] = {
          ...act,
          completed: true,
          completedAt: act.completedAt || Date.now(),
        };
        continue;
      }
    }
    pruned[key] = act;
  }

  return pruned;
}
