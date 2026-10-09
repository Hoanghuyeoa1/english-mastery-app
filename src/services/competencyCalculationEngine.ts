/**
 * Four Skills Competency Model v2 — Calculation Engine
 * 
 * Pure, deterministic evaluation engine:
 * 1. Difficulty-aware score interpretation (CEFR anchor calibration)
 * 2. Recency time-decay weighting (half-life with safety floor)
 * 3. Evidence source & quality weighting
 * 4. Sample-size & consistency stability confidence
 * 5. Conservative CEFR promotion gates
 * 6. Explainable debug diagnostics
 * 
 * Strict Invariants:
 * - Pure calculation (zero React/DOM/store dependencies)
 * - Deterministic (unit-testable with fixed timestamp)
 * - No external ML/statistics dependencies
 * - Zero crashes on empty, malformed, or boundary inputs
 */

import type {
  CompetencyEvidence,
  CompetencySkill,
  CEFRLevel,
  CompetencyEvidenceSource,
} from '../types/competencyEvidence';

/**
 * Quy đổi điểm % sang thang đo chuẩn CEFR
 */
export function getCefrLevelFromScore(score: number): 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' {
  if (typeof score !== 'number' || Number.isNaN(score) || !Number.isFinite(score)) return 'A1';
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  if (clamped < 30) return 'A1';
  if (clamped < 50) return 'A2';
  if (clamped < 70) return 'B1';
  if (clamped < 85) return 'B2';
  if (clamped < 95) return 'C1';
  return 'C2';
}

// =========================================================================
// 1. ENGINE PARAMETERS & CONFIGURATION
// =========================================================================

export const ENGINE_CONFIG = {
  // Recency Decay: 14 days half-life with 0.35 minimum weight floor
  recencyHalfLifeDays: 14,
  recencyMinFloor: 0.35,
  legacyNeutralAgeDays: 30,

  // Source Reliability Coefficients
  sourceWeights: {
    'toeic': 1.0,
    'four-skills': 1.0,
    'writing-ai': 1.0,
    'shadowing': 0.9,
    'writing-offline': 0.8,
    'legacy': 0.85,
  } as Record<CompetencyEvidenceSource, number>,

  // CEFR Task Difficulty Calibration Anchors [minCompetence, maxCompetence]
  difficultyAnchors: {
    'A1': { min: 0, max: 29 },
    'A2': { min: 20, max: 55 },
    'B1': { min: 40, max: 75 },
    'B2': { min: 60, max: 88 },
    'C1': { min: 75, max: 96 },
    'C2': { min: 85, max: 100 },
  } as Record<CEFRLevel, { min: number; max: number }>,

  // Conservative Promotion Requirements
  promotionGates: {
    B2: { minAttempts: 2, minConfidence: 0.30 },
    C1: { minAttempts: 3, minConfidence: 0.45, requiredEvidenceLevel: 'B2' as CEFRLevel },
    C2: { minAttempts: 5, minConfidence: 0.60, requiredEvidenceLevel: 'C1' as CEFRLevel },
  },

  // Sample Size Saturation
  sampleSizeFullConfidence: 12,
  recentWindowDays: 14,
} as const;

export interface CompetencyEvaluationV2 {
  skill: CompetencySkill;
  score: number; // 0 - 100 weighted competency score
  level: CEFRLevel;
  confidence: number; // 0.0 - 1.0
  evidenceCount: number;
  recentEvidenceCount: number;
  strongestEvidenceLevel?: CEFRLevel;
  stabilityScore: number; // 0.0 - 1.0
  isAssessed: boolean;
  debugExplanation: {
    rawAverage: number;
    weightedAverage: number;
    recencyFactor: number;
    sampleSizeFactor: number;
    standardDeviation: number;
    promotionCapped: boolean;
    promotionCapReason?: string;
  };
}

// =========================================================================
// 2. CORE TRANSFORMATION & INTERPRETATION HELPERS
// =========================================================================

const CEFR_ORDER: Record<CEFRLevel, number> = {
  'A1': 1,
  'A2': 2,
  'B1': 3,
  'B2': 4,
  'C1': 5,
  'C2': 6,
};

export function isCefrAtLeast(level: CEFRLevel | undefined, required: CEFRLevel): boolean {
  if (!level) return false;
  return CEFR_ORDER[level] >= CEFR_ORDER[required];
}

/**
 * Difficulty-aware interpretation:
 * Maps raw score (0-100) on a task of specific CEFR difficulty into an effective competence score.
 * If task difficulty is undefined (legacy / unrated), returns raw score.
 */
export function interpretEvidenceCompetency(evidence: CompetencyEvidence): number {
  const rawScore = Math.max(0, Math.min(100, Math.round(evidence.score)));
  if (!evidence.cefrDifficulty) {
    return rawScore; // Unrated / legacy retains neutral 1:1 score
  }

  const anchor = ENGINE_CONFIG.difficultyAnchors[evidence.cefrDifficulty];
  if (!anchor) {
    return rawScore;
  }

  // Linear interpolation within task competence interval
  const effective = anchor.min + (rawScore / 100) * (anchor.max - anchor.min);
  return Math.max(0, Math.min(100, Math.round(effective * 10) / 10));
}

/**
 * Calculates deterministic recency decay weight in [recencyMinFloor, 1.0].
 */
export function calculateRecencyWeight(
  createdAt: number,
  now: number = Date.now(),
  source: CompetencyEvidenceSource = 'four-skills'
): number {
  const { recencyHalfLifeDays, recencyMinFloor, legacyNeutralAgeDays } = ENGINE_CONFIG;

  let ageDays: number;
  if (source === 'legacy' || createdAt === 0) {
    ageDays = legacyNeutralAgeDays;
  } else {
    const diffMs = Math.max(0, now - createdAt);
    ageDays = diffMs / 86_400_000;
  }

  // Exponential decay: floor + (1 - floor) * 2^(-age / halfLife)
  const decayExponent = ageDays / recencyHalfLifeDays;
  const decayFactor = Math.pow(2, -decayExponent);
  const weight = recencyMinFloor + (1 - recencyMinFloor) * decayFactor;

  return Math.max(recencyMinFloor, Math.min(1.0, Math.round(weight * 1000) / 1000));
}

// =========================================================================
// 2. SKILL-SPECIFIC SOURCE WEIGHTS & TRANSFORMATION HELPERS
// =========================================================================

export const SKILL_SOURCE_WEIGHTS: Record<CompetencySkill, Partial<Record<CompetencyEvidenceSource, number>>> = {
  listening: {
    'four-skills': 1.0,
    'toeic': 1.0,
    'legacy': 0.85,
  },
  reading: {
    'four-skills': 1.0,
    'toeic': 1.0,
    'legacy': 0.85,
  },
  speaking: {
    'toeic': 1.0,
    'four-skills': 0.85, // Turn-based roleplay interaction
    'shadowing': 0.65, // Conservative: pronunciation repetition is partial evidence only
    'legacy': 0.80,
  },
  writing: {
    'writing-ai': 1.0, // Live Gemini AI 4-criteria rubric
    'toeic': 1.0, // Standardized writing exam
    'writing-offline': 0.65, // Offline heuristic fallback
    'legacy': 0.80,
  },
};

/**
 * Calculates source and item confidence weight, taking skill-specific reliability into account.
 */
export function calculateSourceQualityWeight(evidence: CompetencyEvidence): number {
  const skillSpecificWeights = SKILL_SOURCE_WEIGHTS[evidence.skill];
  const baseSourceWeight = skillSpecificWeights?.[evidence.source]
    ?? ENGINE_CONFIG.sourceWeights[evidence.source]
    ?? 0.85;

  const itemQuality = typeof evidence.quality === 'number' && Number.isFinite(evidence.quality)
    ? Math.max(0, Math.min(1.0, evidence.quality))
    : 1.0;

  return Math.max(0.1, Math.min(1.0, Math.round(baseSourceWeight * itemQuality * 1000) / 1000));
}

// =========================================================================
// 3. MAIN EVALUATION ENGINE
// =========================================================================

export interface EvaluateCompetencyOptions {
  now?: number;
}

/**
 * Evaluates competency for a single skill based on evidence history.
 */
export function evaluateSkillCompetencyV2(
  skill: CompetencySkill,
  evidenceList: CompetencyEvidence[],
  options: EvaluateCompetencyOptions = {}
): CompetencyEvaluationV2 {
  const now = options.now ?? Date.now();

  // 1. NO-DATA CHECK
  if (!Array.isArray(evidenceList) || evidenceList.length === 0) {
    return {
      skill,
      score: 0,
      level: 'A1',
      confidence: 0,
      evidenceCount: 0,
      recentEvidenceCount: 0,
      stabilityScore: 1.0,
      isAssessed: false,
      debugExplanation: {
        rawAverage: 0,
        weightedAverage: 0,
        recencyFactor: 0,
        sampleSizeFactor: 0,
        standardDeviation: 0,
        promotionCapped: false,
        promotionCapReason: 'No evidence available',
      },
    };
  }

  // 2. INTERPRET & WEIGHT EACH EVIDENCE ITEM
  let totalWeight = 0;
  let weightedSum = 0;
  let rawSum = 0;
  let recentCount = 0;
  let strongestDifficulty: CEFRLevel | undefined = undefined;

  const effectiveScores: number[] = [];
  const recencyWeights: number[] = [];
  const recentThresholdMs = now - ENGINE_CONFIG.recentWindowDays * 86_400_000;

  for (const item of evidenceList) {
    const effective = interpretEvidenceCompetency(item);
    effectiveScores.push(effective);
    rawSum += item.score;

    const recencyW = calculateRecencyWeight(item.createdAt, now, item.source);
    recencyWeights.push(recencyW);

    const sourceW = calculateSourceQualityWeight(item);
    const itemTotalWeight = recencyW * sourceW;

    weightedSum += effective * itemTotalWeight;
    totalWeight += itemTotalWeight;

    if (item.createdAt >= recentThresholdMs) {
      recentCount++;
    }

    if (item.cefrDifficulty) {
      if (!strongestDifficulty || isCefrAtLeast(item.cefrDifficulty, strongestDifficulty)) {
        strongestDifficulty = item.cefrDifficulty;
      }
    }
  }

  const N = evidenceList.length;
  const rawAverage = Math.round(rawSum / N);
  const weightedAverage = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : rawAverage;
  const finalScore = Math.max(0, Math.min(100, weightedAverage));

  // 3. STATISTICAL STABILITY (STANDARD DEVIATION)
  let standardDeviation = 0;
  if (N > 1) {
    const mean = effectiveScores.reduce((a, b) => a + b, 0) / N;
    const variance = effectiveScores.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / N;
    standardDeviation = Math.round(Math.sqrt(variance) * 10) / 10;
  }

  // Stability Factor: standard deviation of 0 -> 1.0, std dev >= 35 -> 0.2
  const stabilityScore = N <= 1
    ? 0.8
    : Math.max(0.2, Math.min(1.0, Math.round((1.0 - standardDeviation / 35) * 100) / 100));

  // 4. CONFIDENCE CALCULATION
  // Sample Size Factor: saturates towards 1.0 at sampleSizeFullConfidence (12 items)
  const sampleSizeFactor = Math.min(1.0, Math.round((Math.sqrt(N) / Math.sqrt(ENGINE_CONFIG.sampleSizeFullConfidence)) * 100) / 100);
  const avgRecency = recencyWeights.reduce((a, b) => a + b, 0) / N;

  const rawConfidence = sampleSizeFactor * (
    0.45 * stabilityScore +
    0.35 * avgRecency +
    0.20 * 0.95
  );
  const confidence = Math.max(0.05, Math.min(1.0, Math.round(rawConfidence * 100) / 100));

  // 5. CONSERVATIVE CEFR PROMOTION
  const unconstrainedCefr = getCefrLevelFromScore(finalScore);
  let finalCefr = unconstrainedCefr;
  let promotionCapped = false;
  let promotionCapReason: string | undefined = undefined;

  const gates = ENGINE_CONFIG.promotionGates;

  if (unconstrainedCefr === 'C2') {
    const gate = gates.C2;
    const hasDifficulty = strongestDifficulty ? isCefrAtLeast(strongestDifficulty, gate.requiredEvidenceLevel) : false;
    if (N < gate.minAttempts || confidence < gate.minConfidence || (!hasDifficulty && N < 10)) {
      finalCefr = 'C1';
      promotionCapped = true;
      promotionCapReason = `C2 promotion requires >= ${gate.minAttempts} attempts and confidence >= ${gate.minConfidence * 100}%, with C1+ task evidence`;
    }

    // Speaking Safeguard: Shadowing repetition alone cannot promote to C2 Speaking.
    // C2 Speaking requires interactive dialogue or standardized exam evidence (four-skills roleplay or toeic).
    if (skill === 'speaking' && finalCefr === 'C2') {
      const hasInteractiveOrStandardizedSpoken = evidenceList.some(
        (e) => e.source === 'toeic' || e.source === 'four-skills'
      );
      if (!hasInteractiveOrStandardizedSpoken) {
        finalCefr = 'C1';
        promotionCapped = true;
        promotionCapReason =
          'C2 Speaking requires interactive or standardized spoken evidence (Four Skills roleplay or TOEIC); shadowing repetition alone is capped at C1';
      }
    }
  }

  if (finalCefr === 'C1') {
    const gate = gates.C1;
    const hasDifficulty = strongestDifficulty ? isCefrAtLeast(strongestDifficulty, gate.requiredEvidenceLevel) : false;
    if (N < gate.minAttempts || confidence < gate.minConfidence || (!hasDifficulty && N < 6)) {
      finalCefr = 'B2';
      promotionCapped = true;
      promotionCapReason = `C1 promotion requires >= ${gate.minAttempts} attempts and confidence >= ${gate.minConfidence * 100}%, with B2+ task evidence`;
    }
  }

  if (finalCefr === 'B2') {
    const gate = gates.B2;
    if (N < gate.minAttempts || confidence < gate.minConfidence) {
      finalCefr = 'B1';
      promotionCapped = true;
      promotionCapReason = `B2 promotion requires >= ${gate.minAttempts} attempts and confidence >= ${gate.minConfidence * 100}%`;
    }
  }

  return {
    skill,
    score: finalScore,
    level: finalCefr,
    confidence,
    evidenceCount: N,
    recentEvidenceCount: recentCount,
    strongestEvidenceLevel: strongestDifficulty,
    stabilityScore,
    isAssessed: true,
    debugExplanation: {
      rawAverage,
      weightedAverage,
      recencyFactor: Math.round(avgRecency * 100) / 100,
      sampleSizeFactor,
      standardDeviation,
      promotionCapped,
      promotionCapReason,
    },
  };
}
