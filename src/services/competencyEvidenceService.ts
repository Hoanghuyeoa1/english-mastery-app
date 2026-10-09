/**
 * Four Skills Competency Model v2 — Evidence Engine & Legacy Adapter
 * 
 * Provides pure validation, normalization, deduplication, bounded history,
 * and legacy adapter algorithms for atomic competency evidence.
 */

import type {
  CompetencyEvidence,
  CompetencyEvidenceInput,
  CompetencyEvidenceSource,
  CompetencySkill,
  CEFRLevel,
  FourSkillsEvidenceStore,
} from '../types/competencyEvidence';
import type { FourSkillsScores } from '../types';

export const VALID_COMPETENCY_SKILLS: ReadonlySet<CompetencySkill> = new Set([
  'listening',
  'reading',
  'speaking',
  'writing',
]);

export const VALID_EVIDENCE_SOURCES: ReadonlySet<CompetencyEvidenceSource> = new Set([
  'four-skills',
  'toeic',
  'shadowing',
  'writing-ai',
  'writing-offline',
  'legacy',
]);

export const VALID_CEFR_LEVELS: ReadonlySet<CEFRLevel> = new Set([
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
]);

export const DEFAULT_MAX_EVIDENCE_PER_SKILL = 50;
export const DEFAULT_MAX_FUTURE_DRIFT_MS = 60_000; // 1 minute allowed clock drift

export const EMPTY_FOUR_SKILLS_EVIDENCE: FourSkillsEvidenceStore = {
  listening: [],
  reading: [],
  speaking: [],
  writing: [],
};

export interface EvidenceValidationOptions {
  now?: number;
  maxFutureDriftMs?: number;
}

/**
 * Pure validator & normalizer for atomic Competency Evidence.
 * Returns null if the item is technically invalid (unrecoverable), or a sanitized CompetencyEvidence object.
 */
export function validateAndNormalizeEvidence(
  raw: unknown,
  options: EvidenceValidationOptions = {}
): CompetencyEvidence | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const obj = raw as Partial<CompetencyEvidence>;
  const now = options.now ?? Date.now();
  const maxFutureDrift = options.maxFutureDriftMs ?? DEFAULT_MAX_FUTURE_DRIFT_MS;

  // 1. Skill Validation
  if (!obj.skill || !VALID_COMPETENCY_SKILLS.has(obj.skill as CompetencySkill)) {
    return null;
  }
  const skill = obj.skill as CompetencySkill;

  // 2. Score Validation & Sanitization
  if (typeof obj.score !== 'number' || Number.isNaN(obj.score) || !Number.isFinite(obj.score)) {
    return null;
  }
  const score = Math.max(0, Math.min(100, Math.round(obj.score)));

  // 3. Source Validation
  if (!obj.source || !VALID_EVIDENCE_SOURCES.has(obj.source as CompetencyEvidenceSource)) {
    return null;
  }
  const source = obj.source as CompetencyEvidenceSource;

  // 4. CEFR Difficulty (Optional) — Normalizes invalid string to undefined without inventing false level
  let cefrDifficulty: CEFRLevel | undefined = undefined;
  if (obj.cefrDifficulty && VALID_CEFR_LEVELS.has(obj.cefrDifficulty as CEFRLevel)) {
    cefrDifficulty = obj.cefrDifficulty as CEFRLevel;
  }

  // 5. Timestamp (createdAt) Validation
  let createdAt: number;
  if (source === 'legacy' && obj.createdAt === 0) {
    createdAt = 0; // Preserves explicit 0 meaning "unknown legacy timestamp"
  } else if (
    typeof obj.createdAt !== 'number' ||
    Number.isNaN(obj.createdAt) ||
    !Number.isFinite(obj.createdAt) ||
    obj.createdAt < 0
  ) {
    createdAt = now;
  } else if (obj.createdAt > now + maxFutureDrift) {
    // Clock drift guard: Clamp future timestamp to current time
    createdAt = now;
  } else {
    createdAt = Math.round(obj.createdAt);
  }

  // 6. Quality / Confidence Weight Validation (0.0 - 1.0)
  let quality = 1.0;
  if (typeof obj.quality === 'number' && Number.isFinite(obj.quality) && !Number.isNaN(obj.quality)) {
    quality = Math.max(0, Math.min(1.0, Math.round(obj.quality * 100) / 100));
  }

  // 7. Deterministic ID Generation
  let id = typeof obj.id === 'string' && obj.id.trim().length > 0 ? obj.id.trim() : '';
  if (!id) {
    id = `ev_${skill}_${source}_${createdAt}_${score}`;
  }

  // 8. Metadata Sanitization
  let metadata: Record<string, unknown> | undefined = undefined;
  if (obj.metadata && typeof obj.metadata === 'object' && !Array.isArray(obj.metadata)) {
    metadata = { ...obj.metadata };
  }

  return {
    id,
    skill,
    score,
    source,
    cefrDifficulty,
    createdAt,
    quality,
    metadata,
  };
}

/**
 * Adapts a single legacy number score into a standard CompetencyEvidence object.
 * Preserves truth: source = 'legacy', cefrDifficulty = undefined, createdAt = 0 (unknown).
 */
export function adaptLegacyScoreToEvidence(
  skill: CompetencySkill,
  score: number,
  index: number = 0
): CompetencyEvidence | null {
  if (typeof score !== 'number' || Number.isNaN(score) || !Number.isFinite(score)) {
    return null;
  }
  const validScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    id: `legacy_${skill}_${index}_${validScore}`,
    skill,
    score: validScore,
    source: 'legacy',
    cefrDifficulty: undefined, // Do not invent fake CEFR
    createdAt: 0, // Explicitly represents unknown timestamp
    quality: 1.0, // Neutral standard weighting
  };
}

/**
 * Adapts an array of legacy number scores into CompetencyEvidence[].
 */
export function adaptLegacyScoresToEvidence(
  skill: CompetencySkill,
  scores: number[]
): CompetencyEvidence[] {
  if (!Array.isArray(scores)) return [];
  return scores
    .map((s, idx) => adaptLegacyScoreToEvidence(skill, s, idx))
    .filter((e): e is CompetencyEvidence => e !== null);
}

/**
 * Adapts an entire legacy FourSkillsScores store into a FourSkillsEvidenceStore.
 */
export function adaptLegacyFourSkillsScores(
  legacyScores?: Partial<FourSkillsScores> | null
): FourSkillsEvidenceStore {
  if (!legacyScores || typeof legacyScores !== 'object') {
    return { ...EMPTY_FOUR_SKILLS_EVIDENCE };
  }
  return {
    listening: adaptLegacyScoresToEvidence('listening', legacyScores.listening || []),
    reading: adaptLegacyScoresToEvidence('reading', legacyScores.reading || []),
    speaking: adaptLegacyScoresToEvidence('speaking', legacyScores.speaking || []),
    writing: adaptLegacyScoresToEvidence('writing', legacyScores.writing || []),
  };
}

/**
 * Deduplicates an array of CompetencyEvidence by deterministic ID, preserving insertion order.
 */
export function deduplicateEvidence(evidenceList: CompetencyEvidence[]): CompetencyEvidence[] {
  if (!Array.isArray(evidenceList)) return [];
  const seenIds = new Set<string>();
  const deduplicated: CompetencyEvidence[] = [];

  for (const item of evidenceList) {
    if (!item || !item.id) continue;
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      deduplicated.push(item);
    }
  }

  return deduplicated;
}

/**
 * Enforces a bounded sliding window of maximum N items per skill.
 * Preserves the most recent entries.
 */
export function boundEvidenceHistory(
  evidenceList: CompetencyEvidence[],
  maxLimit: number = DEFAULT_MAX_EVIDENCE_PER_SKILL
): CompetencyEvidence[] {
  if (!Array.isArray(evidenceList)) return [];
  if (evidenceList.length <= maxLimit) return evidenceList;
  return evidenceList.slice(-maxLimit);
}

/**
 * Merges local and incoming evidence arrays cleanly:
 * validates, deduplicates by ID, and clamps to max limit.
 */
export function mergeEvidenceArrays(
  existing: CompetencyEvidence[],
  incoming: CompetencyEvidence[],
  maxLimit: number = DEFAULT_MAX_EVIDENCE_PER_SKILL,
  options?: EvidenceValidationOptions
): CompetencyEvidence[] {
  const cleanExisting = (Array.isArray(existing) ? existing : [])
    .map((e) => validateAndNormalizeEvidence(e, options))
    .filter((e): e is CompetencyEvidence => e !== null);

  const cleanIncoming = (Array.isArray(incoming) ? incoming : [])
    .map((e) => validateAndNormalizeEvidence(e, options))
    .filter((e): e is CompetencyEvidence => e !== null);

  const combined = deduplicateEvidence([...cleanExisting, ...cleanIncoming]);
  return boundEvidenceHistory(combined, maxLimit);
}

/**
 * Sanitizes an entire raw FourSkillsEvidenceStore object from persisted storage.
 */
export function sanitizeEvidenceStore(
  raw: unknown,
  maxLimit: number = DEFAULT_MAX_EVIDENCE_PER_SKILL
): FourSkillsEvidenceStore {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_FOUR_SKILLS_EVIDENCE };
  }

  const obj = raw as Partial<FourSkillsEvidenceStore>;

  const cleanSkill = (skill: CompetencySkill): CompetencyEvidence[] => {
    const arr = obj[skill];
    if (!Array.isArray(arr)) return [];
    const valid = arr
      .map((item) => validateAndNormalizeEvidence(item))
      .filter((e): e is CompetencyEvidence => e !== null);
    return boundEvidenceHistory(deduplicateEvidence(valid), maxLimit);
  };

  return {
    listening: cleanSkill('listening'),
    reading: cleanSkill('reading'),
    speaking: cleanSkill('speaking'),
    writing: cleanSkill('writing'),
  };
}

/**
 * Fluent factory to create a single validated CompetencyEvidence item from input payload.
 */
export function createCompetencyEvidence(
  input: CompetencyEvidenceInput,
  options?: EvidenceValidationOptions
): CompetencyEvidence | null {
  return validateAndNormalizeEvidence(input, options);
}
