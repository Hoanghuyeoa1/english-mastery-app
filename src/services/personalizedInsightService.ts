// src/services/personalizedInsightService.ts
/**
 * Personalized Learning Insights Engine (Phase 2 Derivation Engine)
 * 
 * Pipeline:
 * Learning State
 * → Generate Candidates
 * → Validate Evidence
 * → Confidence (Strong / Moderate / Insufficient)
 * → Rank & Score
 * → Deduplicate (Same Word, Collocation, Confusion Pair, Skill)
 * → Positive / Attention Balance (Max 2 Attention + Max 1 Positive)
 * → Natural-language Insight & Action Descriptors
 * 
 * Architectural Invariants:
 * 1. Pure Derivation Layer: Only derives, explains, and routes.
 *    NEVER mutates, schedules, completes, or invents learning state.
 * 2. Strict Domain Isolation:
 *    - FSRS / SM-2 isolation: SM-2 cards NEVER compute or fake retrievability.
 *    - Leech detection: strictly uses existing `leechDetector` scoring rules.
 *    - Weak collocations: requires verified personalized failure evidence.
 *    - Mistake Bank: evidence-only; resolved mistakes strictly excluded from active weakness.
 *    - Skills competency: zero-sample skills only trigger missing-data guidance, never "weak skill" conclusions.
 *    - Usage gap: requires verified Reading vs Writing telemetry counters; ignores stop words.
 *    - Positive progress: only measurable, verified milestones (resolved repeated mistakes, high retention).
 * 3. Confidence Thresholds:
 *    - strong: high sample size / repeated evidence -> confident wording.
 *    - moderate: minimal acceptable evidence -> cautious, non-absolute wording.
 *    - insufficient: discarded, zero insight rendered.
 * 4. Deterministic Templates: 100% offline, pure TypeScript templates without external AI dependencies.
 * 5. Bounded Performance: Only inspects active learner state; never scans the 10,000+ static dictionary words.
 * 6. Deduplication & Balance: Eliminates redundant cards on the same target; balances attention vs positive recognition.
 */

import type {
  ActiveTab,
  CollocationItem,
  CompetencySkill,
  DailyProgress,
  FourSkillsEvidenceStore,
  FourSkillsScores,
  FSRSSettings,
  MistakeRecord,
  MistakeType,
  PracticeModuleId,
  SRSAlgorithmType,
  SRSProgress,
  SRSReviewEvent,
  UserProfile,
  VocabWord,
  WordLearningStatsMap,
  LearningDictionaryProfile,
} from '../types';

import { analyzeCardLeechStatus, LEECH_DETECTOR_RULES } from './leechDetector';
import { calculateRetrievability } from './fsrsAlgorithm';
import { computeRetentionMetricsFromDailyHistory } from './srsAnalytics';
import { RETENTION_RECOMMENDATION_RULES } from './retentionRecommendation';
import { evaluateSkillCompetencyV2, adaptLegacyScoresToEvidence } from './skillsCompetencyService';
import { derivePersonalizedConfusions } from './wordConfusionService';
import { getCardUnifiedState } from './srsScheduler';
import { cleanWordToken } from './wordLookupService';
import { toCanonicalType } from './adaptiveMistakeService';
import { FUNCTIONAL_STOP_WORDS } from './wordUsageTelemetry';
import type { CheckpointHistoryEntry, LevelCertificationStore } from '../types/levelCertification';
import { CENTRAL_CERTIFICATION_POLICY } from './levelCertificationService';

// =========================================================================
// 1. INSIGHT CONTRACT & DISCRIMINATED UNIONS
// =========================================================================

export type InsightType =
  | 'confusion'
  | 'forgetting_risk'
  | 'leech'
  | 'weak_collocation'
  | 'skill_gap'
  | 'usage_gap'
  | 'mistake_pattern'
  | 'retention'
  | 'pronunciation'
  | 'improvement';

export type InsightConfidence = 'strong' | 'moderate';
export type InsightSeverity = 'critical' | 'warning' | 'info' | 'success';

export interface InsightActionDescriptor {
  label: string;
  targetTab: ActiveTab;
  subTab?: string;
  practiceModule?: PracticeModuleId;
  targetItemIds?: string[];
  params?: Record<string, unknown>;
}

export interface BasePersonalizedInsight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  confidence: InsightConfidence;
  title: string;
  message: string;
  reason: string;
  action?: InsightActionDescriptor;
  createdAt: number;
}

export interface ConfusionInsight extends BasePersonalizedInsight {
  type: 'confusion';
  targetWord: string;
  confusedWith: string;
  confusionCount: number;
}

export interface ForgettingRiskInsight extends BasePersonalizedInsight {
  type: 'forgetting_risk';
  atRiskCount: number;
  sampleWords: string[];
  lowestRetrievability: number;
}

export interface LeechInsight extends BasePersonalizedInsight {
  type: 'leech';
  word: string;
  lapseCount: number;
  leechScore: number;
  reasons: string[];
}

export interface WeakCollocationInsight extends BasePersonalizedInsight {
  type: 'weak_collocation';
  phrase: string;
  mistakeCount: number;
  weaknessEvidence: 'mistake_bank' | 'srs_failure' | 'ai_tutor' | 'writing_correction';
}

export interface SkillGapInsight extends BasePersonalizedInsight {
  type: 'skill_gap';
  skill: CompetencySkill;
  hasSufficientData: boolean;
  score?: number;
  benchmarkSkill?: CompetencySkill;
  benchmarkScore?: number;
}

export interface UsageGapInsight extends BasePersonalizedInsight {
  type: 'usage_gap';
  word: string;
  readingEncounters: number;
  writingUsages: number;
}

export interface MistakePatternInsight extends BasePersonalizedInsight {
  type: 'mistake_pattern';
  mistakeCategory: MistakeType;
  unresolvedCount: number;
  sampleWords: string[];
}

export interface RetentionInsight extends BasePersonalizedInsight {
  type: 'retention';
  actualRetention: number;
  targetRetention?: number;
  totalReviews: number;
  algorithm: SRSAlgorithmType;
}

export interface PronunciationInsight extends BasePersonalizedInsight {
  type: 'pronunciation';
  word: string;
  mistakeCount: number;
}

export interface ImprovementInsight extends BasePersonalizedInsight {
  type: 'improvement';
  resolvedWord: string;
  consecutiveCorrect: number;
  previousMistakeCount: number;
}

export type PersonalizedInsight =
  | ConfusionInsight
  | ForgettingRiskInsight
  | LeechInsight
  | WeakCollocationInsight
  | SkillGapInsight
  | UsageGapInsight
  | MistakePatternInsight
  | RetentionInsight
  | PronunciationInsight
  | ImprovementInsight;

export interface PersonalizedInsightSource {
  srsProgressMap?: Record<string, SRSProgress> | null;
  mistakeBank?: Record<string, MistakeRecord> | null;
  userCollocations?: CollocationItem[] | null;
  userCustomWords?: VocabWord[] | null;
  vocabularyList?: VocabWord[] | null;
  fourSkillsScores?: FourSkillsScores | null;
  fourSkillsEvidence?: FourSkillsEvidenceStore | null;
  wordLearningStats?: WordLearningStatsMap | null;
  recentReviewEvents?: SRSReviewEvent[] | null;
  dailyHistory?: Record<string, DailyProgress> | null;
  srsAlgorithm?: SRSAlgorithmType | null;
  fsrsSettings?: FSRSSettings | null;
  profile?: UserProfile | null;
  now?: number;
  maxInsights?: number;
  maxAttention?: number;
  maxPositive?: number;
  checkpointHistory?: CheckpointHistoryEntry[] | null;
  levelCertifications?: LevelCertificationStore | null;
}

export interface PersonalizedInsightResult {
  insights: PersonalizedInsight[];
  attentionCount: number;
  positiveCount: number;
  totalCandidateCount: number;
  hasInsights: boolean;
  isNewUser: boolean;
  generatedAt: number;
}

export interface BalancePolicyConfig {
  maxAttention: number;
  maxPositive: number;
  maxTotal: number;
}

// =========================================================================
// 2. DOMAIN LABELS & HELPERS
// =========================================================================

const SKILL_LABELS: Record<CompetencySkill, string> = {
  listening: 'Nghe hiểu (Listening)',
  reading: 'Đọc hiểu (Reading)',
  speaking: 'Nói & Phát âm (Speaking)',
  writing: 'Viết luận (Writing)',
};

const MISTAKE_CATEGORY_LABELS: Record<MistakeType, string> = {
  meaning: 'Nghĩa từ vựng',
  spelling: 'Chính tả',
  listening: 'Nghe hiểu',
  pronunciation: 'Phát âm',
  collocation: 'Cụm từ đi liền (Collocation)',
  grammar: 'Ngữ pháp',
  reading: 'Đọc hiểu ngữ cảnh',
  writing: 'Diễn đạt viết',
  other: 'Khác',
};

// =========================================================================
// 3. GENERATORS PER DOMAIN (VALIDATION -> CONFIDENCE -> INSIGHT)
// =========================================================================

/**
 * 3.1 Confusion Insight Generator
 * Rule: Only verified personalized confusion evidence from mistakeBank.
 * Never treats synonyms as confusion.
 */
function deriveConfusionInsights(
  mistakeBank: Record<string, MistakeRecord>,
  now: number
): ConfusionInsight[] {
  const insights: ConfusionInsight[] = [];
  const processedPairs = new Set<string>();

  const records = Object.values(mistakeBank || {});
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    if (record.resolved) continue; // Exclude resolved mistakes

    const targetWord = record.word ? record.word.trim() : '';
    if (!targetWord) continue;

    const confusions = derivePersonalizedConfusions(targetWord, record.id, mistakeBank, 3);
    for (const conf of confusions) {
      const pairKey = [cleanWordToken(targetWord), cleanWordToken(conf.word)].sort().join(':::');
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      // Validation & Confidence Threshold:
      // count >= 2: strong
      // count === 1: moderate
      // count === 0: insufficient (discarded)
      if (conf.count < 1) continue;

      const isStrong = conf.count >= 2;
      const confidence: InsightConfidence = isStrong ? 'strong' : 'moderate';

      const title = isStrong
        ? `Thường xuyên nhầm lẫn từ: ${targetWord} ↔ ${conf.word}`
        : `Dấu hiệu nhầm lẫn từ: ${targetWord} ↔ ${conf.word}`;

      const message = isStrong
        ? `Bạn thường xuyên nhầm lẫn giữa "${targetWord}" và "${conf.word}" (${conf.count} lần). Hãy phân biệt rõ sự khác nhau về ngữ cảnh.`
        : `Bạn có dấu hiệu đang nhầm giữa "${targetWord}" và "${conf.word}" trong bài làm gần đây. Chú ý ngữ nghĩa khi sử dụng.`;

      const reason = `Ghi nhận ${conf.count} lần trả lời nhầm giữa "${targetWord}" và "${conf.word}" trong Mistake Bank (${conf.source}).`;

      insights.push({
        id: `insight_confusion_${cleanWordToken(targetWord)}_${cleanWordToken(conf.word)}`,
        type: 'confusion',
        severity: 'warning',
        confidence,
        title,
        message,
        reason,
        targetWord,
        confusedWith: conf.word,
        confusionCount: conf.count,
        action: {
          label: `Luyện phân biệt "${targetWord}"`,
          targetTab: 'flashcards',
          practiceModule: 'flashcard',
          targetItemIds: [record.id],
        },
        createdAt: now,
      });
    }
  }

  return insights;
}

/**
 * 3.2 Forgetting Risk Insight Generator (FSRS ONLY)
 * Invariant: SM-2 cards NEVER compute fake retrievability.
 */
function deriveForgettingRiskInsights(
  srsProgressMap: Record<string, SRSProgress>,
  algorithm: SRSAlgorithmType,
  fsrsSettings: FSRSSettings | null | undefined,
  now: number
): ForgettingRiskInsight[] {
  // STRICT RULE: Guard against SM-2. No fake retrievability.
  if (algorithm !== 'fsrs') {
    return [];
  }

  const desiredRetention = fsrsSettings?.desiredRetention ?? 0.90;
  const atRiskWords: Array<{ id: string; word: string; retrievability: number }> = [];

  for (const [cardId, prog] of Object.entries(srsProgressMap || {})) {
    if (!prog || !prog.fsrs) continue;

    const rawStability = prog.fsrs.stability;
    const lastReviewDateStr = prog.fsrs.lastReview || prog.lastReviewedDate;

    if (
      typeof rawStability === 'number' &&
      Number.isFinite(rawStability) &&
      rawStability > 0 &&
      lastReviewDateStr &&
      typeof lastReviewDateStr === 'string'
    ) {
      const lastReviewMs = Date.parse(lastReviewDateStr);
      if (!Number.isNaN(lastReviewMs) && lastReviewMs <= now) {
        const elapsedDays = (now - lastReviewMs) / (1000 * 60 * 60 * 24);
        if (elapsedDays >= 0 && Number.isFinite(elapsedDays)) {
          const r = calculateRetrievability(elapsedDays, rawStability);
          if (Number.isFinite(r) && r >= 0 && r < desiredRetention) {
            atRiskWords.push({
              id: cardId,
              word: cardId.replace(/^custom_/, ''),
              retrievability: Math.round(r * 100) / 100,
            });
          }
        }
      }
    }
  }

  if (atRiskWords.length === 0) {
    return [];
  }

  atRiskWords.sort((a, b) => a.retrievability - b.retrievability);
  const lowestR = atRiskWords[0].retrievability;
  const count = atRiskWords.length;
  const sampleWords = atRiskWords.slice(0, 3).map((w) => w.word);

  // Confidence & Severity:
  // lowestR < 0.70: strong (critical)
  // lowestR >= 0.70: moderate (warning)
  const isStrong = lowestR < 0.70 || count >= 5;
  const confidence: InsightConfidence = isStrong ? 'strong' : 'moderate';
  const severity: InsightSeverity = isStrong ? 'critical' : 'warning';

  const title = isStrong
    ? `Nguy cơ quên từ vựng FSRS (${count} từ)`
    : `Cảnh báo độ nhớ giảm dần (${count} từ)`;

  const message = isStrong
    ? `${count} từ vựng FSRS đang có nguy cơ quên cao (độ nhớ thấp nhất ${Math.round(lowestR * 100)}% < mục tiêu ${Math.round(desiredRetention * 100)}%). Hãy ôn tập ngay để tránh đứt mạch ghi nhớ.`
    : `${count} từ vựng FSRS đang gần ngưỡng quên. Nên ôn tập sớm để củng cố độ nhớ.`;

  const reason = `Phân tích FSRS-4.5: Có ${count} thẻ có Retrievability dưới mức mục tiêu (${Math.round(desiredRetention * 100)}%). Thẻ thấp nhất: ${sampleWords[0]} (${Math.round(lowestR * 100)}%).`;

  return [
    {
      id: 'insight_forgetting_risk_fsrs',
      type: 'forgetting_risk',
      severity,
      confidence,
      title,
      message,
      reason,
      atRiskCount: count,
      sampleWords,
      lowestRetrievability: lowestR,
      action: {
        label: 'Ôn tập thẻ nguy cơ quên ngay',
        targetTab: 'flashcards',
        practiceModule: 'flashcard',
        targetItemIds: atRiskWords.slice(0, 10).map((w) => w.id),
      },
      createdAt: now,
    },
  ];
}

/**
 * 3.3 Leech Insight Generator
 * Rule: Uses existing `leechDetector` scoring. Score >= 50.
 */
function deriveLeechInsights(
  srsProgressMap: Record<string, SRSProgress>,
  now: number
): LeechInsight[] {
  const insights: LeechInsight[] = [];

  for (const [cardId, prog] of Object.entries(srsProgressMap || {})) {
    if (!prog) continue;

    const rawReps = prog.fsrs?.reps ?? prog.reviewCount;
    const rawLapses = prog.fsrs?.lapses ?? prog.againCount;

    // Quick filter
    if (!rawReps && !rawLapses && !prog.againCount) continue;

    const analysis = analyzeCardLeechStatus({
      id: cardId,
      word: cardId.replace(/^custom_/, ''),
      reps: rawReps,
      lapses: rawLapses,
      difficulty: prog.fsrs?.difficulty,
      againCount: prog.againCount,
      reviewCount: prog.reviewCount,
      fsrs: prog.fsrs,
    });

    if (analysis.isLeech && analysis.score >= LEECH_DETECTOR_RULES.leechCutoffScore) {
      const word = cardId.replace(/^custom_/, '');
      const isStrong = analysis.score >= 70 || analysis.lapseCount >= 5;
      const confidence: InsightConfidence = isStrong ? 'strong' : 'moderate';
      const severity: InsightSeverity = isStrong ? 'critical' : 'warning';

      const title = isStrong
        ? `Từ khó gây cản trở (Leech): "${word}"`
        : `Dấu hiệu thẻ học khó ghi nhớ: "${word}"`;

      const message = isStrong
        ? `Từ "${word}" đã quên ${analysis.lapseCount} lần và có tỷ lệ bấm Again ${Math.round(analysis.againRate * 100)}%. Từ này đang làm tiêu hao thời gian ôn tập mà chưa vào trí nhớ dài hạn.`
        : `"${word}" đang có dấu hiệu khó ghi nhớ (${analysis.lapseCount} lần quên). Bạn nên đổi phương pháp học (tra ngữ cảnh hoặc liên tưởng).`;

      const reason = `Hệ thống Leech Detector chấm ${analysis.score}/100 điểm. Lý do: ${analysis.reasons.join('; ')}.`;

      insights.push({
        id: `insight_leech_${cleanWordToken(word)}`,
        type: 'leech',
        severity,
        confidence,
        title,
        message,
        reason,
        word,
        lapseCount: analysis.lapseCount,
        leechScore: analysis.score,
        reasons: analysis.reasons,
        action: {
          label: `Gỡ rối từ khó "${word}"`,
          targetTab: 'flashcards',
          practiceModule: 'flashcard',
          targetItemIds: [cardId],
        },
        createdAt: now,
      });
    }
  }

  // Sort descending by leech score, limit top 3
  insights.sort((a, b) => b.leechScore - a.leechScore);
  return insights.slice(0, 3);
}

/**
 * 3.4 Weak Collocation Insight Generator
 * Rule: Only personalized weakness evidence (unresolved mistake, SRS failure, lapse unrecovered).
 * Common collocations without failure evidence are strictly excluded.
 */
function deriveWeakCollocationInsights(
  userCollocations: CollocationItem[],
  srsProgressMap: Record<string, SRSProgress>,
  mistakeBank: Record<string, MistakeRecord>,
  now: number
): WeakCollocationInsight[] {
  const insights: WeakCollocationInsight[] = [];

  for (const item of userCollocations || []) {
    if (!item || !item.phrase) continue;
    const phrase = item.phrase.trim();
    const lowerPhrase = phrase.toLowerCase();
    const cleanKey = lowerPhrase.replace(/\s+/g, '_');

    const collocRecord =
      mistakeBank[item.id] ||
      mistakeBank[lowerPhrase] ||
      mistakeBank[`colloc_${cleanKey}`];

    const collocProgress =
      srsProgressMap[item.id] ||
      srsProgressMap[lowerPhrase] ||
      srsProgressMap[`colloc_${cleanKey}`];

    const isUnresolvedMistake = Boolean(
      collocRecord &&
      (collocRecord.mistakeCount || 0) > 0 &&
      !collocRecord.resolved
    );

    const isSrsRelearning = Boolean(
      collocProgress &&
      (getCardUnifiedState(collocProgress) === 'relearning' ||
        collocProgress.fsrs?.state === 3)
    );

    const isLapsedUnrecovered = Boolean(
      collocProgress &&
      collocProgress.srsLevel === 0 &&
      (collocProgress.reviewCount ?? 0) > 0 &&
      (!collocRecord || !collocRecord.resolved)
    );

    if (!isUnresolvedMistake && !isSrsRelearning && !isLapsedUnrecovered) {
      // INSUFFICIENT EVIDENCE: No weakness evidence -> Strictly exclude!
      continue;
    }

    let weaknessEvidence: 'mistake_bank' | 'srs_failure' | 'ai_tutor' | 'writing_correction' = 'mistake_bank';
    if (collocRecord?.source === 'ai_tutor') {
      weaknessEvidence = 'ai_tutor';
    } else if (collocRecord?.source === 'writing') {
      weaknessEvidence = 'writing_correction';
    } else if (isSrsRelearning || isLapsedUnrecovered) {
      weaknessEvidence = 'srs_failure';
    }

    const mistakeCount = collocRecord?.mistakeCount || (isSrsRelearning || isLapsedUnrecovered ? 1 : 0);
    const isStrong = mistakeCount >= 2 || (isUnresolvedMistake && isSrsRelearning);
    const confidence: InsightConfidence = isStrong ? 'strong' : 'moderate';

    const title = isStrong
      ? `Cụm từ dễ nhầm lẫn: "${phrase}"`
      : `Cần củng cố cụm từ: "${phrase}"`;

    const message = isStrong
      ? `Bạn vẫn gặp khó với cụm từ "${phrase}" (${mistakeCount} lần sai chưa khắc phục). Hãy ôn lại giới từ và cách kết hợp từ tự nhiên.`
      : `Cụm từ "${phrase}" cần được củng cố thêm trong các bài luyện tập tiếp theo.`;

    const reason = `Bằng chứng suy yếu: ${weaknessEvidence} (số lần sai: ${mistakeCount}).`;

    insights.push({
      id: `insight_weak_collocation_${cleanKey}`,
      type: 'weak_collocation',
      severity: isStrong ? 'warning' : 'info',
      confidence,
      title,
      message,
      reason,
      phrase,
      mistakeCount,
      weaknessEvidence,
      action: {
        label: `Luyện cụm từ "${phrase}"`,
        targetTab: 'flashcards',
        subTab: 'COLLOCATION',
        practiceModule: 'collocation',
        targetItemIds: [item.id],
      },
      createdAt: now,
    });
  }

  // Sort descending by mistake count, limit top 3
  insights.sort((a, b) => b.mistakeCount - a.mistakeCount);
  return insights.slice(0, 3);
}

/**
 * 3.5 Skill Gap Insight Generator
 * Rule: Missing data -> only "Bạn có ít dữ liệu {skill}..." wording, never "kỹ năng yếu".
 * Conclude gap only when samples are sufficient.
 */
export function deriveSkillGapInsights(
  fourSkillsEvidence: FourSkillsEvidenceStore | null | undefined,
  fourSkillsScores: FourSkillsScores | null | undefined,
  now: number = Date.now()
): SkillGapInsight[] {
  const insights: SkillGapInsight[] = [];
  const skills: CompetencySkill[] = ['listening', 'reading', 'speaking', 'writing'];

  interface EvaluatedSkill {
    skill: CompetencySkill;
    score: number;
    attempts: number;
    isAssessed: boolean;
    confidence: 'high' | 'medium' | 'low';
  }

  const evaluated: EvaluatedSkill[] = [];

  for (const s of skills) {
    const evidenceList = fourSkillsEvidence?.[s] || [];
    const scoreList = fourSkillsScores?.[s] || [];

    if (evidenceList.length > 0) {
      const ev = evaluateSkillCompetencyV2(s, evidenceList);
      const conf: 'high' | 'medium' | 'low' =
        ev.confidence >= 0.70 ? 'high' : ev.confidence >= 0.40 ? 'medium' : 'low';
      evaluated.push({
        skill: s,
        score: ev.score,
        attempts: ev.evidenceCount,
        isAssessed: true,
        confidence: conf,
      });
    } else if (scoreList.length > 0) {
      const legacyEv = adaptLegacyScoresToEvidence(s, scoreList);
      const ev = evaluateSkillCompetencyV2(s, legacyEv);
      const conf: 'high' | 'medium' | 'low' =
        ev.confidence >= 0.70 ? 'high' : ev.confidence >= 0.40 ? 'medium' : 'low';
      evaluated.push({
        skill: s,
        score: ev.score,
        attempts: ev.evidenceCount,
        isAssessed: true,
        confidence: conf,
      });
    } else {
      evaluated.push({
        skill: s,
        score: 0,
        attempts: 0,
        isAssessed: false,
        confidence: 'low',
      });
    }
  }

  // Check 1: Missing Data Rule (Must not conclude weak skill)
  const unassessed = evaluated.filter((e) => !e.isAssessed || e.attempts === 0);
  const assessed = evaluated.filter((e) => e.isAssessed && e.attempts > 0);

  // If some skills are assessed but one or two have zero data
  if (assessed.length > 0 && unassessed.length > 0) {
    for (const missing of unassessed) {
      insights.push({
        id: `insight_skill_gap_missing_${missing.skill}`,
        type: 'skill_gap',
        severity: 'info',
        confidence: 'moderate',
        title: `Cần thêm dữ liệu: ${SKILL_LABELS[missing.skill]}`,
        message: `Bạn có ít dữ liệu ${SKILL_LABELS[missing.skill]} hơn các kỹ năng khác, hãy luyện tập thêm để hệ thống đánh giá chính xác.`,
        reason: `Kỹ năng ${missing.skill} có 0 lượt thực hành ghi nhận trong hệ thống.`,
        skill: missing.skill,
        hasSufficientData: false,
        action: {
          label: `Luyện tập kỹ năng ${missing.skill}`,
          targetTab: 'four_skills',
          subTab: missing.skill,
        },
        createdAt: now,
      });
    }
  }

  // Check 2: Actual gap between assessed skills with sufficient samples
  const solidAssessed = evaluated.filter((e) => e.isAssessed && e.attempts >= 3 && e.confidence !== 'low');
  if (solidAssessed.length >= 2) {
    solidAssessed.sort((a, b) => b.score - a.score);
    const benchmark = solidAssessed[0];
    const lowest = solidAssessed[solidAssessed.length - 1];
    const scoreDiff = benchmark.score - lowest.score;

    if (scoreDiff >= 20) {
      const isStrong = scoreDiff >= 25 && (lowest.confidence === 'high' || lowest.attempts >= 4);
      const confidence: InsightConfidence = isStrong ? 'strong' : 'moderate';
      const severity: InsightSeverity = isStrong ? 'warning' : 'info';

      const title = isStrong
        ? `Chênh lệch kỹ năng: ${SKILL_LABELS[lowest.skill]} thấp hơn đáng kể`
        : `Dấu hiệu lệch kỹ năng: ${SKILL_LABELS[lowest.skill]}`;

      const message = isStrong
        ? `Năng lực ${SKILL_LABELS[lowest.skill]} (${lowest.score}%) đang thấp hơn đáng kể so với ${SKILL_LABELS[benchmark.skill]} (${benchmark.score}%). Hãy cân bằng thời gian để phát triển toàn diện.`
        : `Năng lực ${SKILL_LABELS[lowest.skill]} (${lowest.score}%) có dấu hiệu chênh lệch so với ${SKILL_LABELS[benchmark.skill]} (${benchmark.score}%).`;

      const reason = `Chênh lệch ${scoreDiff} điểm giữa ${lowest.skill} (${lowest.score}%, ${lowest.attempts} lượt) và ${benchmark.skill} (${benchmark.score}%, ${benchmark.attempts} lượt).`;

      insights.push({
        id: `insight_skill_gap_gap_${lowest.skill}`,
        type: 'skill_gap',
        severity,
        confidence,
        title,
        message,
        reason,
        skill: lowest.skill,
        hasSufficientData: true,
        score: lowest.score,
        benchmarkSkill: benchmark.skill,
        benchmarkScore: benchmark.score,
        action: {
          label: `Cải thiện kỹ năng ${lowest.skill}`,
          targetTab: 'four_skills',
          subTab: lowest.skill,
        },
        createdAt: now,
      });
    }
  }

  return insights;
}

/**
 * 3.5b Checkpoint Certification Insight Generator
 * Invariant: Only generates insight when authentic checkpoint exam evidence exists.
 * Never mutates certification state.
 */
export function deriveCheckpointCertificationInsights(
  checkpointHistory: CheckpointHistoryEntry[] | null | undefined,
  levelCertifications: LevelCertificationStore | null | undefined,
  now: number = Date.now()
): SkillGapInsight[] {
  if (!checkpointHistory || !Array.isArray(checkpointHistory) || checkpointHistory.length === 0) {
    return [];
  }

  const latest = checkpointHistory[0];
  if (!latest) return [];

  const insights: SkillGapInsight[] = [];
  const level = latest.level;

  if (!latest.isPassed) {
    const scores = latest.scores;
    const skills: CompetencySkill[] = ['listening', 'reading', 'speaking', 'writing'];
    const sortedSkills = [...skills].sort((a, b) => (scores[a] ?? 0) - (scores[b] ?? 0));
    const lowestSkill = sortedSkills[0];
    const highestSkill = sortedSkills[sortedSkills.length - 1];

    const lowScore = scores[lowestSkill] ?? 0;
    const highScore = scores[highestSkill] ?? 0;

    const floor = CENTRAL_CERTIFICATION_POLICY.levels[level]?.perSkillFloorThreshold ?? 55;
    const lowestLabel = SKILL_LABELS[lowestSkill] || lowestSkill;
    const highestLabel = SKILL_LABELS[highestSkill] || highestSkill;

    insights.push({
      id: `insight_checkpoint_fail_${level}_${lowestSkill}_${latest.attemptId}`,
      type: 'skill_gap',
      severity: 'warning',
      confidence: 'strong',
      title: `${highestLabel} ${level} đạt chuẩn, ${lowestLabel} cần củng cố`,
      message: `Trong bài kiểm định CEFR ${level}, kỹ năng ${highestLabel} đạt ${highScore}%, nhưng ${lowestLabel} (${lowScore}%) chưa đạt ngưỡng sàn ${floor}%. Hãy củng cố ${lowestLabel} để sẵn sàng thi lại.`,
      reason: `Dựa trên kết quả bài kiểm định CEFR ${level} chính thức (${latest.attemptId}).`,
      skill: lowestSkill,
      hasSufficientData: true,
      score: lowScore,
      benchmarkSkill: highestSkill,
      benchmarkScore: highScore,
      action: {
        label: `Luyện tập ${lowestLabel} ${level}`,
        targetTab: 'four_skills',
        subTab: lowestSkill,
        params: { level },
      },
      createdAt: now,
    });
  }

  return insights;
}

/**
 * 3.6 Usage Gap Insight Generator (Passive vs Active Vocabulary)
 * Rule: readingEncounters >= 3 AND writingUsages === 0.
 */
function deriveUsageGapInsights(
  statsMap: WordLearningStatsMap,
  now: number
): UsageGapInsight[] {
  const insights: UsageGapInsight[] = [];
  const entries = Object.entries(statsMap || {});

  for (const [key, item] of entries) {
    if (!item) continue;
    const reading = item.readingEncounters || 0;
    const writing = item.writingUsages || 0;

    // Threshold: readingEncounters >= 3 AND writingUsages === 0
    if (reading >= 3 && writing === 0) {
      const cleanWord = cleanWordToken(key);
      if (!cleanWord || cleanWord.length < 2 || FUNCTIONAL_STOP_WORDS.has(cleanWord)) continue;

      const isStrong = reading >= 5;
      const confidence: InsightConfidence = isStrong ? 'strong' : 'moderate';

      const title = isStrong
        ? `Khoảng cách từ vựng thụ động: "${cleanWord}"`
        : `Từ vựng tiềm năng chưa vận dụng: "${cleanWord}"`;

      const message = isStrong
        ? `Bạn đã gặp từ "${cleanWord}" ${reading} lần trong bài đọc nhưng chưa từng sử dụng khi viết. Hãy thử áp dụng từ này vào bài viết tiếp theo để biến nó thành từ vựng chủ động.`
        : `Từ "${cleanWord}" xuất hiện ${reading} lần khi đọc nhưng chưa được vận dụng trong kỹ năng viết.`;

      const reason = `Telemetry: ${reading} lần đọc gặp, 0 lần dùng viết.`;

      insights.push({
        id: `insight_usage_gap_${cleanWord}`,
        type: 'usage_gap',
        severity: 'info',
        confidence,
        title,
        message,
        reason,
        word: cleanWord,
        readingEncounters: reading,
        writingUsages: writing,
        action: {
          label: `Luyện viết với từ "${cleanWord}"`,
          targetTab: 'four_skills',
          subTab: 'writing',
          params: { targetWord: cleanWord },
        },
        createdAt: now,
      });
    }
  }

  // Sort descending by reading encounters, limit top 2
  insights.sort((a, b) => b.readingEncounters - a.readingEncounters);
  return insights.slice(0, 2);
}

/**
 * 3.7 Mistake Pattern Insight Generator
 * Rule: Repeated unresolved mistakes grouped by primaryType.
 */
function deriveMistakePatternInsights(
  mistakeBank: Record<string, MistakeRecord>,
  now: number
): MistakePatternInsight[] {
  const insights: MistakePatternInsight[] = [];
  const unresolvedRecords = Object.values(mistakeBank || {}).filter(
    (m) => Boolean(m && !m.resolved && (m.word || m.id))
  );

  const byCategory: Partial<Record<MistakeType, MistakeRecord[]>> = {};

  for (const m of unresolvedRecords) {
    const rawType = m.primaryType || m.category;
    const canonType = toCanonicalType(rawType, m.source);
    if (!byCategory[canonType]) {
      byCategory[canonType] = [];
    }
    byCategory[canonType]!.push(m);
  }

  for (const [category, items] of Object.entries(byCategory)) {
    const cat = category as MistakeType;
    const count = items ? items.length : 0;

    // Threshold: count >= 2 for pattern
    if (count < 2) continue;

    const isStrong = count >= 3;
    const confidence: InsightConfidence = isStrong ? 'strong' : 'moderate';
    const sampleWords = (items || []).slice(0, 3).map((i) => i.word);
    const catLabel = MISTAKE_CATEGORY_LABELS[cat] || cat;

    const title = isStrong
      ? `Cụm lỗi sai lặp lại: ${catLabel} (${count} lỗi)`
      : `Xu hướng lỗi cần lưu ý: ${catLabel} (${count} lỗi)`;

    const message = isStrong
      ? `Bạn đang có ${count} lỗi chưa khắc phục thuộc nhóm ${catLabel} (${sampleWords.join(', ')}...). Hãy dành phiên học chuyên đề để giải quyết triệt để.`
      : `Nhóm lỗi ${catLabel} xuất hiện lặp lại trong các bài luyện gần đây (${sampleWords.join(', ')}).`;

    const reason = `Mistake Bank ghi nhận ${count} bẫy lỗi đang mở thuộc danh mục ${cat}.`;

    insights.push({
      id: `insight_mistake_pattern_${cat}`,
      type: 'mistake_pattern',
      severity: isStrong ? 'warning' : 'info',
      confidence,
      title,
      message,
      reason,
      mistakeCategory: cat,
      unresolvedCount: count,
      sampleWords,
      action: {
        label: `Luyện tập chuyên đề ${catLabel}`,
        targetTab: 'mistakes',
        params: { filterCategory: cat },
      },
      createdAt: now,
    });
  }

  insights.sort((a, b) => b.unresolvedCount - a.unresolvedCount);
  return insights.slice(0, 2);
}

/**
 * 3.8 Retention Insight Generator
 * Rule: Requires minimum 20 reviews. SM-2 does not use desiredRetention.
 */
function deriveRetentionInsights(
  dailyHistory: Record<string, DailyProgress>,
  algorithm: SRSAlgorithmType,
  fsrsSettings: FSRSSettings | null | undefined,
  now: number
): RetentionInsight[] {
  const desiredRetention = fsrsSettings?.desiredRetention ?? 0.90;
  const metrics = computeRetentionMetricsFromDailyHistory(dailyHistory || {}, desiredRetention, 7, now);

  // Insufficient reviews check (rule: min 20 reviews)
  if (metrics.totalReviews < RETENTION_RECOMMENDATION_RULES.minReviews || metrics.actualRetention === null) {
    return [];
  }

  const actualR = metrics.actualRetention;
  const total = metrics.totalReviews;
  const isHighSample = total >= RETENTION_RECOMMENDATION_RULES.highConfidenceReviews;
  const confidence: InsightConfidence = isHighSample ? 'strong' : 'moderate';

  if (algorithm === 'fsrs') {
    const gap = actualR - desiredRetention;
    if (gap < -0.08) {
      return [
        {
          id: 'insight_retention_fsrs_under',
          type: 'retention',
          severity: 'warning',
          confidence,
          title: `Tỷ lệ ghi nhớ 7 ngày qua (${Math.round(actualR * 100)}%) thấp hơn mục tiêu`,
          message: `Tỷ lệ nhớ thực tế (${Math.round(actualR * 100)}%) đang chênh lệch ${Math.round(Math.abs(gap) * 100)}% so với mục tiêu (${Math.round(desiredRetention * 100)}%). Bạn nên chia nhỏ phiên ôn tập để giảm tải.`,
          reason: `Đánh giá trên ${total} lượt ôn tập trong 7 ngày. Tỷ lệ Again: ${metrics.ratingPercentages.again}%.`,
          actualRetention: actualR,
          targetRetention: desiredRetention,
          totalReviews: total,
          algorithm: 'fsrs',
          action: {
            label: 'Xem thống kê SRS chi tiết',
            targetTab: 'flashcards',
          },
          createdAt: now,
        },
      ];
    } else if (gap >= 0.05) {
      return [
        {
          id: 'insight_retention_fsrs_over',
          type: 'retention',
          severity: 'success',
          confidence,
          title: `Khả năng ghi nhớ vượt mục tiêu (${Math.round(actualR * 100)}%)`,
          message: `Khả năng ghi nhớ từ vựng thực tế của bạn rất tốt (${Math.round(actualR * 100)}%, vượt mục tiêu ${Math.round(desiredRetention * 100)}%). Nhịp học đang duy trì rất ổn định!`,
          reason: `Đánh giá trên ${total} lượt ôn tập trong 7 ngày. Tỷ lệ Good/Easy: ${metrics.ratingPercentages.good + metrics.ratingPercentages.easy}%.`,
          actualRetention: actualR,
          targetRetention: desiredRetention,
          totalReviews: total,
          algorithm: 'fsrs',
          action: {
            label: 'Tiếp tục duy trì nhịp học',
            targetTab: 'flashcards',
          },
          createdAt: now,
        },
      ];
    }
  } else {
    // SM-2: Strictly do not compare with desiredRetention
    if (actualR < 0.75) {
      return [
        {
          id: 'insight_retention_sm2_under',
          type: 'retention',
          severity: 'warning',
          confidence,
          title: `Tỷ lệ nhớ SM-2 cần chú ý (${Math.round(actualR * 100)}%)`,
          message: `Tỷ lệ nhớ trong ${total} lượt ôn tập SM-2 gần đây là ${Math.round(actualR * 100)}%. Bạn nên tăng tần suất ôn tập từ mới.`,
          reason: `SM-2 Telemetry: ${total} lượt ôn trong 7 ngày, tỷ lệ Again ${metrics.ratingPercentages.again}%.`,
          actualRetention: actualR,
          totalReviews: total,
          algorithm: 'sm2',
          action: {
            label: 'Ôn tập thẻ SM-2',
            targetTab: 'flashcards',
          },
          createdAt: now,
        },
      ];
    }
  }

  return [];
}

/**
 * 3.9 Pronunciation Insight Generator
 * Rule: Unresolved pronunciation mistakes in mistakeBank.
 */
function derivePronunciationInsights(
  mistakeBank: Record<string, MistakeRecord>,
  now: number
): PronunciationInsight[] {
  const insights: PronunciationInsight[] = [];
  const pronMistakes = Object.values(mistakeBank || {}).filter(
    (m) =>
      Boolean(
        m &&
        !m.resolved &&
        (m.primaryType === 'pronunciation' || m.category === 'pronunciation') &&
        m.word
      )
  );

  pronMistakes.sort((a, b) => (b.mistakeCount || 1) - (a.mistakeCount || 1));

  for (const m of pronMistakes.slice(0, 2)) {
    const word = m.word.trim();
    const count = m.mistakeCount || m.wrongCount || 1;
    const isStrong = count >= 2;
    const confidence: InsightConfidence = isStrong ? 'strong' : 'moderate';

    const title = isStrong
      ? `Phát âm cần chỉnh âm: "${word}"`
      : `Lưu ý phát âm từ: "${word}"`;

    const message = isStrong
      ? `Phát âm từ "${word}" chưa đạt chuẩn (${count} lần kiểm tra chưa đạt). Hãy luyện nghe và nhại giọng với Pronunciation Arena.`
      : `Từ "${word}" cần thêm lượt luyện phát âm để ổn định độ chính xác.`;

    const reason = `Mistake Bank ghi nhận ${count} lần phát âm dưới ngưỡng chuẩn (< 60%).`;

    insights.push({
      id: `insight_pronunciation_${cleanWordToken(word)}`,
      type: 'pronunciation',
      severity: isStrong ? 'warning' : 'info',
      confidence,
      title,
      message,
      reason,
      word,
      mistakeCount: count,
      action: {
        label: `Luyện phát âm "${word}"`,
        targetTab: 'pronunciation',
        subTab: 'ai_speech',
        practiceModule: 'pronunciation',
        targetItemIds: [m.id],
      },
      createdAt: now,
    });
  }

  return insights;
}

/**
 * 3.10 Improvement Insight Generator
 * Rule: Must have baseline struggle + verified resolution (resolved === true && consecutiveCorrect >= 2).
 * Strictly forbids empty generic praise.
 */
function deriveImprovementInsights(
  mistakeBank: Record<string, MistakeRecord>,
  now: number
): ImprovementInsight[] {
  const insights: ImprovementInsight[] = [];
  const resolvedStruggles = Object.values(mistakeBank || {}).filter(
    (m) =>
      Boolean(
        m &&
        m.resolved &&
        (m.consecutiveCorrect || 0) >= 2 &&
        (m.mistakeCount || m.wrongCount || 0) >= 2 &&
        m.word
      )
  );

  resolvedStruggles.sort((a, b) => {
    const timeA = mTime(a);
    const timeB = mTime(b);
    return timeB - timeA;
  });

  function mTime(r: MistakeRecord): number {
    const t = r.resolvedDate ? Date.parse(r.resolvedDate) : (r.lastMistakeAt ? Date.parse(r.lastMistakeAt) : 0);
    return Number.isNaN(t) ? 0 : t;
  }

  for (const m of resolvedStruggles.slice(0, 2)) {
    const word = m.word.trim();
    const mistakes = m.mistakeCount || m.wrongCount || 2;
    const consec = m.consecutiveCorrect || 2;
    const isStrong = mistakes >= 3;
    const confidence: InsightConfidence = isStrong ? 'strong' : 'moderate';

    const title = isStrong
      ? `Tiến bộ vượt trội: Đã khắc phục "${word}"`
      : `Ghi nhận tiến bộ: Khắc phục lỗi "${word}"`;

    const message = isStrong
      ? `Tiến bộ vượt trội: Bạn đã khắc phục thành công từ khó "${word}" sau chuỗi ${consec} lần trả lời đúng liên tiếp (từng sai ${mistakes} lần)!`
      : `Bạn đã vượt qua bẫy lỗi ở từ "${word}" với ${consec} lần làm đúng liên tiếp.`;

    const reason = `Đã giải quyết bẫy lỗi từ "${word}" (trước đó sai ${mistakes} lần, hiện đạt ${consec} lần đúng liên tiếp).`;

    insights.push({
      id: `insight_improvement_${cleanWordToken(word)}`,
      type: 'improvement',
      severity: 'success',
      confidence,
      title,
      message,
      reason,
      resolvedWord: word,
      consecutiveCorrect: consec,
      previousMistakeCount: mistakes,
      action: {
        label: 'Xem sổ tay bẫy lỗi đã giải quyết',
        targetTab: 'mistakes',
      },
      createdAt: now,
    });
  }

  return insights;
}

// =========================================================================
// 4. RANKING, DEDUPLICATION & BALANCE ENGINE
// =========================================================================

export const SEVERITY_WEIGHT: Record<InsightSeverity, number> = {
  critical: 400,
  warning: 300,
  info: 200,
  success: 100,
};

export const CONFIDENCE_WEIGHT: Record<InsightConfidence, number> = {
  strong: 50,
  moderate: 0,
};

export const TYPE_PRIORITY: Record<InsightType, number> = {
  forgetting_risk: 10,
  leech: 9,
  confusion: 8,
  weak_collocation: 7,
  mistake_pattern: 6,
  pronunciation: 5,
  skill_gap: 4,
  usage_gap: 3,
  retention: 2,
  improvement: 1,
};

/**
 * Calculates deterministic priority score for an insight.
 */
export function calculateInsightPriority(insight: PersonalizedInsight): number {
  return (
    SEVERITY_WEIGHT[insight.severity] +
    CONFIDENCE_WEIGHT[insight.confidence] +
    TYPE_PRIORITY[insight.type]
  );
}

/**
 * Deduplicates insights to ensure that the same target does not trigger multiple redundant cards.
 * 
 * Rules:
 * 1. Single word memory failure: If a word is already flagged as a Leech (severe memory failure),
 *    do not produce redundant individual alerts on that exact same word (e.g. usage_gap or pronunciation).
 * 2. If forgetting_risk contains multiple words and a leech word is among them, the aggregate card remains.
 *    If forgetting_risk contains ONLY that single leech word, suppress the duplicate forgetting_risk card.
 * 3. Collocations: max 1 card per phrase.
 * 4. Confusion: max 1 card per pair (wordA ↔ wordB).
 * 5. Skills: max 1 card per skill.
 * 6. Mistake Pattern: max 1 card per category.
 */
export function deduplicateInsights(rawInsights: PersonalizedInsight[]): PersonalizedInsight[] {
  const result: PersonalizedInsight[] = [];
  const severeLeechWords = new Set<string>();
  const seenWordTargets = new Set<string>();
  const seenCollocTargets = new Set<string>();
  const seenConfusionPairs = new Set<string>();
  const seenSkillTargets = new Set<string>();
  const seenCategories = new Set<string>();

  // Collect severe leech words first
  for (const i of rawInsights) {
    if (i.type === 'leech') {
      severeLeechWords.add(cleanWordToken(i.word));
    }
  }

  for (const insight of rawInsights) {
    if (insight.type === 'leech') {
      const clean = cleanWordToken(insight.word);
      if (seenWordTargets.has(clean)) continue;
      seenWordTargets.add(clean);
      result.push(insight);
    } else if (insight.type === 'forgetting_risk') {
      // If forgetting_risk is for a single word that is ALREADY a severe leech, drop the duplicate
      if (
        insight.atRiskCount === 1 &&
        insight.sampleWords.length === 1 &&
        severeLeechWords.has(cleanWordToken(insight.sampleWords[0]))
      ) {
        continue;
      }
      result.push(insight);
    } else if (insight.type === 'pronunciation') {
      const clean = cleanWordToken(insight.word);
      // If the word is already a severe memory leech, do not spam with pronunciation on same word
      if (severeLeechWords.has(clean) || seenWordTargets.has(clean)) continue;
      seenWordTargets.add(clean);
      result.push(insight);
    } else if (insight.type === 'usage_gap') {
      const clean = cleanWordToken(insight.word);
      // If the word is already a severe memory leech, do not suggest writing with it
      if (severeLeechWords.has(clean) || seenWordTargets.has(clean)) continue;
      seenWordTargets.add(clean);
      result.push(insight);
    } else if (insight.type === 'weak_collocation') {
      const clean = cleanWordToken(insight.phrase);
      if (seenCollocTargets.has(clean)) continue;
      seenCollocTargets.add(clean);
      result.push(insight);
    } else if (insight.type === 'confusion') {
      const pairKey = [cleanWordToken(insight.targetWord), cleanWordToken(insight.confusedWith)].sort().join(':::');
      if (seenConfusionPairs.has(pairKey)) continue;
      seenConfusionPairs.add(pairKey);
      result.push(insight);
    } else if (insight.type === 'skill_gap') {
      if (seenSkillTargets.has(insight.skill)) continue;
      seenSkillTargets.add(insight.skill);
      result.push(insight);
    } else if (insight.type === 'mistake_pattern') {
      if (seenCategories.has(insight.mistakeCategory)) continue;
      seenCategories.add(insight.mistakeCategory);
      result.push(insight);
    } else if (insight.type === 'improvement') {
      const clean = cleanWordToken(insight.resolvedWord);
      if (seenWordTargets.has(clean)) continue;
      seenWordTargets.add(clean);
      result.push(insight);
    } else {
      // retention & other aggregate insights
      result.push(insight);
    }
  }

  return result;
}

/**
 * Balances insights between attention areas and positive achievements.
 * 
 * Default Policy:
 * Max 2 attention insights (critical/warning/info) + Max 1 positive insight (success/improvement).
 * Total top 2–4 insights (default 3).
 * Never fabricates positive insights when no positive evidence exists.
 */
export function balanceInsights(
  dedupedInsights: PersonalizedInsight[],
  config?: Partial<BalancePolicyConfig>
): PersonalizedInsight[] {
  const maxAttention = config?.maxAttention ?? 2;
  const maxPositive = config?.maxPositive ?? 1;
  const maxTotal = config?.maxTotal ?? (maxAttention + maxPositive);

  const attentionList: PersonalizedInsight[] = [];
  const positiveList: PersonalizedInsight[] = [];

  for (const insight of dedupedInsights) {
    if (insight.severity === 'success' || insight.type === 'improvement') {
      positiveList.push(insight);
    } else {
      attentionList.push(insight);
    }
  }

  const selectedAttention = attentionList.slice(0, maxAttention);
  const selectedPositive = positiveList.slice(0, maxPositive);

  const combined = [...selectedAttention, ...selectedPositive];

  // Stable sort by priority score, tie-break by ID
  combined.sort((a, b) => {
    const scoreA = calculateInsightPriority(a);
    const scoreB = calculateInsightPriority(b);
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    return a.id.localeCompare(b.id);
  });

  return combined.slice(0, maxTotal);
}

/**
 * Pure predicate: Determines if a learner has zero learning history (New User).
 */
export function isLearnerNewUser(source: PersonalizedInsightSource = {}): boolean {
  const srsEntries = Object.values(source.srsProgressMap || {});
  const hasSRS = srsEntries.some(
    (p) => Boolean(p) && ((p.reviewCount ?? 0) > 0 || (p.srsLevel ?? 0) > 0 || Boolean(p.lastReviewedDate))
  );

  const mistakes = Object.values(source.mistakeBank || {});
  const hasMistakes = mistakes.length > 0;

  const evidence = source.fourSkillsEvidence;
  const hasEvidence = Boolean(
    evidence &&
    (evidence.listening.length > 0 ||
      evidence.reading.length > 0 ||
      evidence.speaking.length > 0 ||
      evidence.writing.length > 0)
  );

  const daily = Object.values(source.dailyHistory || {});
  const hasDaily = daily.some((d) => Boolean(d && (d.wordsReviewed > 0 || d.xpGained > 0)));

  return !hasSRS && !hasMistakes && !hasEvidence && !hasDaily;
}

// =========================================================================
// 5. MAIN ENTRY POINTS
// =========================================================================

/**
 * Derives personalized, actionable, evidence-backed learning insights.
 * 
 * Pipeline:
 * 1. Generate Candidates from all verified domain evidence
 * 2. Filter Insufficient Evidence (discarded)
 * 3. Priority Scoring (Severity + Confidence + Type)
 * 4. Deduplicate (Target Collision Resolution)
 * 5. Balance Policy (Max 2 Attention + Max 1 Positive)
 * 6. Stable Deterministic Sort & Top N
 * 
 * Pure, deterministic, side-effect free.
 */
export function derivePersonalizedInsights(
  source: PersonalizedInsightSource = {}
): PersonalizedInsight[] {
  const now = typeof source.now === 'number' && Number.isFinite(source.now) ? source.now : Date.now();

  const requestedMax = typeof source.maxInsights === 'number' && source.maxInsights > 0
    ? source.maxInsights
    : undefined;

  const maxAttention = typeof source.maxAttention === 'number' && source.maxAttention > 0
    ? source.maxAttention
    : (requestedMax !== undefined ? Math.max(2, requestedMax - (source.maxPositive ?? 1)) : 2);

  const maxPositive = typeof source.maxPositive === 'number' && source.maxPositive > 0
    ? source.maxPositive
    : 1;

  const maxTotal = requestedMax ?? (maxAttention + maxPositive);

  const srsProgressMap = source.srsProgressMap || {};
  const mistakeBank = source.mistakeBank || {};
  const userCollocations = Array.isArray(source.userCollocations) ? source.userCollocations : [];
  const fourSkillsEvidence = source.fourSkillsEvidence || null;
  const fourSkillsScores = source.fourSkillsScores || null;
  const wordLearningStats = source.wordLearningStats || {};
  const dailyHistory = source.dailyHistory || {};
  const srsAlgorithm: SRSAlgorithmType = source.srsAlgorithm === 'fsrs' ? 'fsrs' : 'sm2';
  const fsrsSettings = source.fsrsSettings || null;

  // 1. Candidate Generation across all domains
  const rawInsights: PersonalizedInsight[] = [
    ...deriveConfusionInsights(mistakeBank, now),
    ...deriveForgettingRiskInsights(srsProgressMap, srsAlgorithm, fsrsSettings, now),
    ...deriveLeechInsights(srsProgressMap, now),
    ...deriveWeakCollocationInsights(userCollocations, srsProgressMap, mistakeBank, now),
    ...deriveSkillGapInsights(fourSkillsEvidence, fourSkillsScores, now),
    ...deriveCheckpointCertificationInsights(source.checkpointHistory, source.levelCertifications, now),
    ...deriveUsageGapInsights(wordLearningStats, now),
    ...deriveMistakePatternInsights(mistakeBank, now),
    ...deriveRetentionInsights(dailyHistory, srsAlgorithm, fsrsSettings, now),
    ...derivePronunciationInsights(mistakeBank, now),
    ...deriveImprovementInsights(mistakeBank, now),
  ];

  // 2. Initial Ranking
  rawInsights.sort((a, b) => {
    const scoreA = calculateInsightPriority(a);
    const scoreB = calculateInsightPriority(b);
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    return a.id.localeCompare(b.id);
  });

  // 3. Deduplication (Same target collision resolution)
  const deduped = deduplicateInsights(rawInsights);

  // 4. Positive / Attention Balance Policy
  const balanced = balanceInsights(deduped, {
    maxAttention,
    maxPositive,
    maxTotal,
  });

  return balanced;
}

/**
 * Rich summary entry point returning full metadata for UI components.
 */
export function derivePersonalizedInsightsSummary(
  source: PersonalizedInsightSource = {}
): PersonalizedInsightResult {
  const now = typeof source.now === 'number' && Number.isFinite(source.now) ? source.now : Date.now();
  const insights = derivePersonalizedInsights(source);
  const isNewUser = isLearnerNewUser(source);

  let attentionCount = 0;
  let positiveCount = 0;

  for (const i of insights) {
    if (i.severity === 'success' || i.type === 'improvement') {
      positiveCount++;
    } else {
      attentionCount++;
    }
  }

  return {
    insights,
    attentionCount,
    positiveCount,
    totalCandidateCount: insights.length,
    hasInsights: insights.length > 0,
    isNewUser,
    generatedAt: now,
  };
}

// =========================================================================
// 6. SINGLE-WORD PERSONALIZED INSIGHT (LEARNING DICTIONARY LAYER)
// =========================================================================

export interface WordPersonalizedInsight {
  word: string;
  headline: string;
  severity: InsightSeverity;
  bullets: string[];
  suggestedAction?: {
    type: 'mistake' | 'collocation' | 'review';
    label: string;
    targetWord?: string;
    targetPhrase?: string;
  };
}

/**
 * Derives personalized insight for a single selected word in the Learning Dictionary.
 * Strict invariants:
 * - Only evaluates the selected word's profile; never scans the entire dictionary.
 * - Does not fake retrievability for SM-2 cards.
 * - Never treats common collocations as weakness (only verified weak collocations).
 * - Returns null when no evidence exists (zero fake or synthetic bullets).
 */
export function deriveWordPersonalizedInsight(
  profile?: LearningDictionaryProfile | null
): WordPersonalizedInsight | null {
  if (!profile || !profile.word) return null;

  const bullets: string[] = [];
  let severity: InsightSeverity = 'info';

  // 1. Leech / Lapse evidence
  if (profile.leechStatus?.isLeech) {
    severity = 'critical';
    bullets.push('Từ khó (Leech) — Tỷ lệ quên lặp lại nhiều lần');
  } else if ((profile.memory?.lapsesCount ?? 0) >= 2) {
    severity = 'warning';
    bullets.push(`Đã từng quên ${profile.memory.lapsesCount} lần`);
  } else if ((profile.memory?.againCount ?? 0) >= 2) {
    severity = 'warning';
    bullets.push('Đã chọn Again nhiều lần trong các phiên ôn tập');
  }

  // 2. Confusion evidence
  const personalizedConfusions = profile.confusion?.personalizedConfusedWith || [];
  if (personalizedConfusions.length > 0) {
    const confusedNames = personalizedConfusions.slice(0, 2).map((c) => c.word).join(', ');
    bullets.push(`Hay nhầm với ${confusedNames}`);
    if (severity !== 'critical') severity = 'warning';
  } else if (profile.mistakeSummary?.confusedWith && profile.mistakeSummary.confusedWith.length > 0) {
    const confusedNames = profile.mistakeSummary.confusedWith.slice(0, 2).join(', ');
    bullets.push(`Hay nhầm với ${confusedNames}`);
    if (severity !== 'critical') severity = 'warning';
  }

  // 3. Weak collocations (Evidence-backed only, NEVER common collocations)
  if (Array.isArray(profile.weakCollocations) && profile.weakCollocations.length > 0) {
    const firstWeak = profile.weakCollocations[0];
    bullets.push(`Collocation cần củng cố: ${firstWeak.phrase}`);
    if (severity !== 'critical') severity = 'warning';
  }

  // 4. Unresolved mistakes / pronunciation
  if (profile.mistakeSummary?.unresolved) {
    const count = profile.mistakeSummary.mistakeCount || 1;
    bullets.push(`Có ${count} lỗi sai cần luyện lại`);
    if (severity !== 'critical') severity = 'warning';
  } else if (profile.mistakeSummary?.primaryType === 'pronunciation') {
    bullets.push('Từng gặp lỗi phát âm, cần chú ý khẩu hình');
  }

  // 5. FSRS Retrievability (Strictly isolated: NEVER for SM-2!)
  if (
    profile.memory?.algorithm === 'fsrs' &&
    typeof profile.memory?.retrievability === 'number' &&
    Number.isFinite(profile.memory.retrievability) &&
    profile.memory.retrievability < 0.75
  ) {
    const percent = Math.round(profile.memory.retrievability * 100);
    bullets.push(`Xác suất ghi nhớ đang giảm (còn ~${percent}%)`);
    if (severity !== 'critical') severity = 'warning';
  }

  // 6. Context usage gap (Reading encounters vs Writing usages)
  if (
    profile.contextUsage &&
    (profile.contextUsage.readingEncounters ?? 0) >= 3 &&
    (profile.contextUsage.writingUsages ?? 0) === 0
  ) {
    bullets.push(`Đã gặp ${profile.contextUsage.readingEncounters} lần khi Đọc nhưng chưa dùng trong Viết`);
  }

  // 7. Positive milestone (Mastered or high level with 0 mistakes)
  if (bullets.length === 0) {
    if (
      profile.learningStatus === 'mastered' ||
      ((profile.memory?.srsLevel ?? 0) >= 5 && !profile.mistakeSummary?.unresolved)
    ) {
      return {
        word: profile.word,
        headline: 'Từ vựng đã ghi nhớ vững vàng',
        severity: 'success',
        bullets: ['Ghi nhớ ổn định và không còn lỗi sai tồn đọng'],
      };
    }
    // No evidence at all -> clean null
    return null;
  }

  const headline = severity === 'critical'
    ? 'Bạn đang gặp khó khăn với từ này'
    : 'Lưu ý cá nhân khi học từ này';

  let suggestedAction: WordPersonalizedInsight['suggestedAction'];
  if (profile.mistakeSummary?.unresolved) {
    suggestedAction = {
      type: 'mistake',
      label: 'Luyện tập lỗi sai',
      targetWord: profile.word,
    };
  } else if (profile.weakCollocations && profile.weakCollocations.length > 0) {
    suggestedAction = {
      type: 'collocation',
      label: 'Củng cố cụm từ',
      targetPhrase: profile.weakCollocations[0].phrase,
    };
  } else if (profile.memory?.isDue) {
    suggestedAction = {
      type: 'review',
      label: 'Ôn tập ngay',
    };
  }

  return {
    word: profile.word,
    headline,
    severity,
    bullets,
    suggestedAction,
  };
}

