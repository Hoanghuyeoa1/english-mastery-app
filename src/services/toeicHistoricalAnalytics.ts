// src/services/toeicHistoricalAnalytics.ts
import {
  ToeicSkill,
  ToeicPart,
  ToeicDifficulty,
  ToeicAttemptAnalytics,
  ToeicWeaknessProfile,
  ToeicWeaknessProfileConfig,
  ToeicHistoricalAggregates,
  ToeicEvidenceSummary,
  ToeicInsight,
  ToeicInsightType,
  ToeicConfidenceLevel,
  ToeicTrendDirection,
  ToeicPacingQuadrant,
  ToeicPacingArchetype,
  ToeicTimeAnalytics,
  ToeicAggregatedSkill,
  ToeicAggregatedOpenEndedSkill,
  ToeicAggregatedPart,
  ToeicAggregatedSubSkill,
  ToeicAggregatedDifficulty,
  ToeicInsightSourceBreakdown,
  ToeicEvidenceStrength,
  ToeicPerformanceStability,
  ToeicWeaknessLifecycle,
  ToeicStrengthLifecycle,
  ToeicWeaknessSeverity,
  ToeicRecentPerformanceSummary,
  ToeicArchivedSummary,
} from '../types/toeic';
import { generateToeicRecommendations } from './toeicRecommendationService';

/**
 * Cấu hình tập trung cho quy tắc phát hiện điểm mạnh / điểm yếu (Phase 2, 3 & Production Polish)
 * Tuyệt đối không rải rác magic numbers trong mã nguồn.
 */
export const DEFAULT_WEAKNESS_PROFILE_CONFIG: ToeicWeaknessProfileConfig = {
  minimumEvidence: 3, // Cần tối thiểu 3 câu hỏi để đưa ra bất kỳ kết luận nào
  minimumAttempts: 1, // Tối thiểu 1 bài thi hoàn thành
  weaknessAccuracyThreshold: 55, // Độ chính xác <= 55% bị coi là điểm yếu
  strengthAccuracyThreshold: 80, // Độ chính xác >= 80% được coi là điểm mạnh
  subSkillMinimumEvidence: 3, // Ngưỡng bằng chứng cho Sub-skill
  partMinimumEvidence: 3, // Ngưỡng bằng chứng cho Part
  skillMinimumEvidence: 4, // Ngưỡng bằng chứng cho Skill
  highConfidenceEvidenceMultiplier: 2.5, // 2.5x ngưỡng tối thiểu để đạt độ tin cậy 'high'
  easyFailureSeverityWeight: 1.3, // Làm sai câu dễ có trọng số nghiêm trọng cao hơn 1.3x

  // Cấu hình phân tầng bằng chứng (Evidence Tiers)
  evidenceTiers: {
    emergingMin: 3, // 3 - 4 câu: emerging signal (chớm nở, wording dè dặt)
    likelyMin: 5,   // 5 - 9 câu: likely weakness/strength
    establishedMin: 10, // 10+ câu: established vững chắc
  },

  // Ngưỡng phát hiện biến động (Stability / Volatility)
  maxVolatilityStdDev: 25, // Độ lệch chuẩn accuracy > 25% là volatile

  // Phase 3 Extensions: Recency, Mode Weighting, Trend & Priority
  minTrendPoints: 3, // Cần tối thiểu 3 attempts để tính xu hướng (trend)
  minTrendEvidence: 6, // Cần tối thiểu 6 câu hỏi tích lũy qua các points để khẳng định trend
  trendImprovementDelta: 12, // Độ chính xác tăng >= 12% là 'improving'
  trendDeclineDelta: -12, // Độ chính xác giảm <= -12% là 'declining'
  recencyWindowSize: 5, // Cửa sổ 5 bài thi gần nhất cho Recent Performance
  recencyDecayFactor: 0.85, // Hệ số suy giảm theo độ cũ (decay factor)
  modeWeights: {
    mock: 1.5, // Mock thi thử nghiêm ngặt có trọng số cao nhất
    diagnostic: 1.2, // Diagnostic khảo sát phân nhánh xếp nhì
    practice: 1.0, // Practice tự do xếp ba
  },
  maxPriorityItems: 5, // Top 3-5 ưu tiên can thiệp cao nhất
  pacingThresholdFastSeconds: 30, // < 30s/câu là nhanh
  pacingThresholdSlowSeconds: 55, // > 55s/câu là chậm
};

const PART_NAMES: Record<ToeicPart, string> = {
  part1_photos: 'Part 1: Photographs',
  part2_qna: 'Part 2: Question & Response',
  part3_conv: 'Part 3: Short Conversations',
  part4_talks: 'Part 4: Short Talks',
  part5_grammar: 'Part 5: Incomplete Sentences',
  part6_text: 'Part 6: Text Completion',
  part7_reading: 'Part 7: Reading Comprehension',
  speaking_read: 'Speaking: Aloud & Opinion',
  writing_email: 'Writing: Email Response',
};

const SKILL_NAMES: Record<ToeicSkill, string> = {
  listening: 'Kỹ Năng Nghe (Listening)',
  reading: 'Kỹ Năng Đọc (Reading)',
  speaking: 'Kỹ Năng Nói (Speaking)',
  writing: 'Kỹ Năng Viết (Writing)',
};

/**
 * Ánh xạ Sub-skill vào Part gốc phục vụ Deduplication phân cấp
 */
const SUB_SKILL_TO_PART_MAP: Record<string, ToeicPart> = {
  // Part 1
  photo_action: 'part1_photos',
  photo_object_placement: 'part1_photos',
  photo_scene_general: 'part1_photos',
  detail_action: 'part1_photos',
  object_placement: 'part1_photos',
  group_activity: 'part1_photos',
  // Part 2
  wh_question: 'part2_qna',
  yes_no_question: 'part2_qna',
  statement_response: 'part2_qna',
  offer_request: 'part2_qna',
  indirect_response: 'part2_qna',
  // Part 3
  speaker_intent: 'part3_conv',
  graphic_relation: 'part3_conv',
  next_action: 'part3_conv',
  // Part 4
  talk_purpose: 'part4_talks',
  announcement: 'part4_talks',
  telephone_message: 'part4_talks',
  // Part 5
  grammar_pos: 'part5_grammar',
  grammar_tense: 'part5_grammar',
  grammar_voice: 'part5_grammar',
  grammar_conjunction: 'part5_grammar',
  grammar_preposition: 'part5_grammar',
  grammar_subjunctive: 'part5_grammar',
  grammar_pronoun: 'part5_grammar',
  pronoun_reference: 'part5_grammar',
  subject_verb_agreement: 'part5_grammar',
  verb_tenses: 'part5_grammar',
  preposition_idioms: 'part5_grammar',
  vocab_meaning: 'part5_grammar',
  vocab_collocation: 'part5_grammar',
  // Part 6
  sentence_insertion: 'part6_text',
  text_completion: 'part6_text',
  context_clues: 'part6_text',
  // Part 7
  main_purpose: 'part7_reading',
  specific_detail: 'part7_reading',
  negative_fact: 'part7_reading',
  inference_author: 'part7_reading',
  inference: 'part7_reading',
  vocab_context: 'part7_reading',
  // Speaking & Writing
  pronunciation_intonation: 'speaking_read',
  opinion_argumentation: 'speaking_read',
  email_response: 'writing_email',
  opinion_essay: 'writing_email',
};

function getPartForSubSkill(subSkill: string): ToeicPart | undefined {
  const normalized = subSkill.toLowerCase().trim();
  if (SUB_SKILL_TO_PART_MAP[normalized]) {
    return SUB_SKILL_TO_PART_MAP[normalized];
  }
  if (normalized.startsWith('part1_')) return 'part1_photos';
  if (normalized.startsWith('part2_')) return 'part2_qna';
  if (normalized.startsWith('part3_')) return 'part3_conv';
  if (normalized.startsWith('part4_')) return 'part4_talks';
  if (normalized.startsWith('part5_') || normalized.startsWith('grammar_')) return 'part5_grammar';
  if (normalized.startsWith('part6_')) return 'part6_text';
  if (normalized.startsWith('part7_')) return 'part7_reading';
  if (normalized.startsWith('speaking_')) return 'speaking_read';
  if (normalized.startsWith('writing_')) return 'writing_email';
  return undefined;
}

/**
 * Phân tầng độ mạnh bằng chứng (Evidence Strength)
 * - insufficient: < 3 câu
 * - emerging: 3-4 câu (chớm nở, kết luận thận trọng)
 * - likely: 5-9 câu
 * - established: 10+ câu (vững chắc)
 */
export function deriveEvidenceStrength(
  evidenceCount: number,
  tiers = DEFAULT_WEAKNESS_PROFILE_CONFIG.evidenceTiers,
  isObjective: boolean = true,
  minEvidence?: number
): ToeicEvidenceStrength {
  if (!isObjective) {
    const min = minEvidence ?? 1;
    if (evidenceCount < min) return 'insufficient';
    if (evidenceCount < 2) return 'emerging';
    if (evidenceCount < 4) return 'likely';
    return 'established';
  }
  const emergingThreshold = minEvidence !== undefined ? Math.min(tiers.emergingMin, minEvidence) : tiers.emergingMin;
  if (evidenceCount < emergingThreshold) return 'insufficient';
  if (evidenceCount < tiers.likelyMin) return 'emerging';
  if (evidenceCount < tiers.establishedMin) return 'likely';
  return 'established';
}

/**
 * Phân cấp độ nghiêm trọng của điểm yếu (Weakness Severity Level)
 */
export function deriveWeaknessSeverityLevel(severityScore: number): ToeicWeaknessSeverity {
  if (severityScore >= 65) return 'critical';
  if (severityScore >= 45) return 'moderate';
  return 'mild';
}

/**
 * Phân tích độ ổn định phong độ (Performance Stability / Volatility)
 */
export function derivePerformanceStability(
  accuracies: number[],
  evidenceCount: number,
  maxStdDev: number = DEFAULT_WEAKNESS_PROFILE_CONFIG.maxVolatilityStdDev
): ToeicPerformanceStability {
  if (!accuracies || accuracies.length < 3 || evidenceCount < 5) {
    return 'insufficient_data';
  }
  const mean = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
  const variance = accuracies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / accuracies.length;
  const stdDev = Math.sqrt(variance);
  return stdDev > maxStdDev ? 'volatile' : 'stable';
}

/**
 * Xác định vòng đời Điểm Yếu (Weakness Lifecycle)
 * emerging -> active -> improving -> resolved
 */
export function deriveWeaknessLifecycle(
  classification: ToeicInsight['classification'],
  evidenceStrength: ToeicEvidenceStrength,
  trend: ToeicTrendDirection,
  recentAccuracy: number | null,
  recentEvidenceCount: number
): ToeicWeaknessLifecycle | undefined {
  if (classification !== 'weakness') return undefined;

  // Resolved: Trước đây là điểm yếu, nhưng trong cửa sổ recent đạt >= 75% với ít nhất 4 câu và phong độ ổn định/tiến bộ
  if (
    recentAccuracy !== null &&
    recentAccuracy >= 75 &&
    recentEvidenceCount >= 4 &&
    (trend === 'improving' || trend === 'stable')
  ) {
    return 'resolved';
  }

  // Improving: Đang có dấu hiệu tiến bộ rõ ràng
  if (trend === 'improving' || (recentAccuracy !== null && recentAccuracy >= 60 && recentEvidenceCount >= 3)) {
    return 'improving';
  }

  // Emerging: Mới phát hiện qua ít câu (3-4 câu)
  if (evidenceStrength === 'emerging') {
    return 'emerging';
  }

  // Active: Điểm yếu đang tồn tại rõ rệt
  return 'active';
}

/**
 * Xác định vòng đời Điểm Mạnh (Strength Lifecycle)
 * emerging_strength -> stable_strength -> declining_strength
 */
export function deriveStrengthLifecycle(
  classification: ToeicInsight['classification'],
  evidenceStrength: ToeicEvidenceStrength,
  trend: ToeicTrendDirection,
  stability: ToeicPerformanceStability,
  recentAccuracy: number | null
): ToeicStrengthLifecycle | undefined {
  if (classification !== 'strength') return undefined;

  // Declining: Phong độ gần đây sụt giảm
  if (trend === 'declining' || (recentAccuracy !== null && recentAccuracy < 70)) {
    return 'declining_strength';
  }

  // Emerging strength: Mới chớm ghi nhận (3-4 câu)
  if (evidenceStrength === 'emerging') {
    return 'emerging_strength';
  }

  // Stable strength
  return 'stable_strength';
}

/**
 * Pure function: Tính toán xu hướng (Trend) dựa trên chuỗi lịch sử độ chính xác và kiểm soát nhiễu
 */
export function computeTrend(
  accuracies: number[],
  minPoints: number = 3,
  improvementDelta: number = 12,
  declineDelta: number = -12,
  totalEvidenceCount?: number,
  minTrendEvidence: number = 6
): ToeicTrendDirection {
  if (!accuracies || accuracies.length < minPoints) {
    return 'insufficient_data';
  }

  // Chống nhiễu do mẫu câu quá nhỏ: cần tối thiểu số câu hỏi tích lũy
  if (totalEvidenceCount !== undefined && totalEvidenceCount < minTrendEvidence) {
    return 'insufficient_data';
  }

  const half = Math.max(1, Math.floor(accuracies.length / 2));
  const firstHalf = accuracies.slice(0, half);
  const secondHalf = accuracies.slice(-half);

  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const delta = avgSecond - avgFirst;

  if (delta >= improvementDelta) {
    return 'improving';
  }
  if (delta <= declineDelta) {
    return 'declining';
  }
  return 'stable';
}

/**
 * Pure function: Tính toán độ tin cậy (Confidence Level) dựa trên 5 yếu tố chặt chẽ
 */
function computeInsightConfidence(
  evidenceCount: number,
  attemptsSeen: number,
  accuracies: number[],
  minEvidence: number,
  highEvidenceMultiplier: number,
  stability: ToeicPerformanceStability = 'insufficient_data',
  hasMockEvidence: boolean = false
): ToeicConfidenceLevel {
  if (evidenceCount < minEvidence) {
    return 'insufficient';
  }

  // Nếu bằng chứng còn chớm nở (< 5 câu), confidence tối đa là 'low'
  if (evidenceCount < 5) {
    return 'low';
  }

  // Nếu phong độ bị biến động mạnh (volatile), hạ cấp confidence
  if (stability === 'volatile') {
    return evidenceCount >= 8 ? 'medium' : 'low';
  }

  // Đạt 'high' khi:
  // - Bằng chứng lớn (>= minEvidence * highEvidenceMultiplier hoặc >= 10 câu)
  // - Gặp trong >= 2 lần thi
  // - Phong độ ổn định
  // - Có bằng chứng từ Mock test hoặc Diagnostic
  if (
    evidenceCount >= Math.max(8, minEvidence * highEvidenceMultiplier) &&
    attemptsSeen >= 2 &&
    (stability === 'stable' || stability === 'insufficient_data') &&
    hasMockEvidence
  ) {
    return 'high';
  }

  if (evidenceCount >= minEvidence * 1.5 && attemptsSeen >= 1) {
    return 'medium';
  }

  return 'low';
}

function inferSkillForPart(p: ToeicPart): ToeicSkill {
  if (p === 'part1_photos' || p === 'part2_qna' || p === 'part3_conv' || p === 'part4_talks') return 'listening';
  if (p === 'part5_grammar' || p === 'part6_text' || p === 'part7_reading') return 'reading';
  if (p === 'speaking_read') return 'speaking';
  return 'writing';
}

function inferSkillForSubSkill(sub: string): ToeicSkill {
  const part = SUB_SKILL_TO_PART_MAP[sub];
  if (part) return inferSkillForPart(part);
  if (sub.startsWith('speaking_')) return 'speaking';
  if (sub.startsWith('writing_')) return 'writing';
  if (sub.startsWith('grammar_') || sub.startsWith('vocab_') || sub.startsWith('text_') || sub.startsWith('reading_')) return 'reading';
  return 'listening';
}

/**
 * Khởi tạo cấu trúc Aggregates rỗng an toàn
 */
function createInitialAggregates(): ToeicHistoricalAggregates {
  return {
    bySkill: {
      listening: {
        skill: 'listening',
        isObjective: true,
        totalSeen: 0,
        totalAttempted: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        totalUnanswered: 0,
        accuracy: 0,
        evidenceCount: 0,
        attemptsCount: 0,
        scaledScoreAvg: undefined,
      },
      reading: {
        skill: 'reading',
        isObjective: true,
        totalSeen: 0,
        totalAttempted: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        totalUnanswered: 0,
        accuracy: 0,
        evidenceCount: 0,
        attemptsCount: 0,
        scaledScoreAvg: undefined,
      },
      speaking: {
        skill: 'speaking',
        isObjective: false,
        totalSeen: 0,
        evidenceCount: 0,
        attemptsCount: 0,
        averageScore: undefined,
        averageWordCount: undefined,
        rubricAverages: undefined,
        accuracy: null,
      },
      writing: {
        skill: 'writing',
        isObjective: false,
        totalSeen: 0,
        evidenceCount: 0,
        attemptsCount: 0,
        averageScore: undefined,
        averageWordCount: undefined,
        rubricAverages: undefined,
        accuracy: null,
      },
    },
    byPart: {},
    bySubSkill: {},
    byDifficulty: {
      easy: {
        difficulty: 'easy',
        difficultyLevel: 1,
        totalSeen: 0,
        totalAttempted: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        totalUnanswered: 0,
        accuracy: 0,
        evidenceCount: 0,
      },
      medium: {
        difficulty: 'medium',
        difficultyLevel: 2,
        totalSeen: 0,
        totalAttempted: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        totalUnanswered: 0,
        accuracy: 0,
        evidenceCount: 0,
      },
      hard: {
        difficulty: 'hard',
        difficultyLevel: 3,
        totalSeen: 0,
        totalAttempted: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        totalUnanswered: 0,
        accuracy: 0,
        evidenceCount: 0,
      },
    },
  };
}

/**
 * Pure function: Tổng hợp các completed attempts thành dữ liệu lịch sử chuẩn hóa
 */
export function aggregateToeicAttempts(
  attempts: ToeicAttemptAnalytics[],
  archivedSummary?: ToeicArchivedSummary | null
): ToeicHistoricalAggregates {
  const aggregates = createInitialAggregates();

  // Tích hợp dữ liệu tóm tắt đã lưu trữ (Archived Summary) nếu có để bảo toàn lịch sử dài hạn
  if (archivedSummary) {
    if (archivedSummary.bySkill) {
      (['listening', 'reading'] as const).forEach((sk) => {
        const item = archivedSummary.bySkill[sk];
        if (item) {
          aggregates.bySkill[sk].totalSeen += item.totalSeen;
          aggregates.bySkill[sk].totalCorrect += item.totalCorrect;
          aggregates.bySkill[sk].totalAttempted += item.totalAttempted;
          aggregates.bySkill[sk].evidenceCount += item.totalSeen;
          aggregates.bySkill[sk].attemptsCount += archivedSummary.totalArchivedAttempts;
        }
      });
    }
    if (archivedSummary.byPart) {
      Object.entries(archivedSummary.byPart).forEach(([partKey, item]) => {
        const p = partKey as ToeicPart;
        if (!aggregates.byPart[p]) {
          aggregates.byPart[p] = {
            part: p,
            partName: PART_NAMES[p] || p,
            skill: inferSkillForPart(p),
            isObjective: p !== 'speaking_read' && p !== 'writing_email',
            totalSeen: 0,
            totalAttempted: 0,
            totalCorrect: 0,
            totalIncorrect: 0,
            totalUnanswered: 0,
            accuracy: null,
            evidenceCount: 0,
            attemptsCount: 0,
            averageDifficultyLevel: 2,
            averageEstimatedDifficulty: 0,
          };
        }
        const target = aggregates.byPart[p]!;
        target.totalSeen += item.totalSeen;
        target.totalCorrect += item.totalCorrect;
        target.totalAttempted += item.totalAttempted;
        target.evidenceCount += item.totalSeen;
        target.attemptsCount += archivedSummary.totalArchivedAttempts;
      });
    }
    if (archivedSummary.bySubSkill) {
      Object.entries(archivedSummary.bySubSkill).forEach(([subKey, item]) => {
        if (!aggregates.bySubSkill[subKey]) {
          aggregates.bySubSkill[subKey] = {
            subSkill: subKey,
            skill: inferSkillForSubSkill(subKey),
            isObjective: true,
            totalSeen: 0,
            totalAttempted: 0,
            totalCorrect: 0,
            totalIncorrect: 0,
            totalUnanswered: 0,
            accuracy: null,
            evidenceCount: 0,
            attemptsCount: 0,
            questionTypes: [],
          };
        }
        const target = aggregates.bySubSkill[subKey]!;
        target.totalSeen += item.totalSeen;
        target.totalCorrect += item.totalCorrect;
        target.totalAttempted += item.totalAttempted;
        target.evidenceCount += item.totalSeen;
        target.attemptsCount += archivedSummary.totalArchivedAttempts;
        if (item.questionTypes) {
          const set = new Set([...target.questionTypes, ...item.questionTypes]);
          target.questionTypes = Array.from(set);
        }
      });
    }
  }

  if (!attempts || attempts.length === 0) {
    return aggregates;
  }

  let listeningScoreSum = 0;
  let listeningScoreCount = 0;
  let readingScoreSum = 0;
  let readingScoreCount = 0;
  let speakingScoreSum = 0;
  let speakingWordCountSum = 0;
  let speakingCount = 0;
  let writingScoreSum = 0;
  let writingWordCountSum = 0;
  let writingCount = 0;

  const speakingRubrics: Record<string, number[]> = {};
  const writingRubrics: Record<string, number[]> = {};

  const partDiffSumMap = new Map<ToeicPart, number>();
  const partEstDiffSumMap = new Map<ToeicPart, { sum: number; count: number }>();

  attempts.forEach((attempt) => {
    // 1. Listening
    const l = attempt.bySkill.listening;
    if (l && l.questionsSeen > 0) {
      aggregates.bySkill.listening.totalSeen += l.questionsSeen;
      aggregates.bySkill.listening.totalAttempted += l.attempted;
      aggregates.bySkill.listening.totalCorrect += l.correct;
      aggregates.bySkill.listening.totalIncorrect += l.incorrect;
      aggregates.bySkill.listening.totalUnanswered += l.unanswered;
      aggregates.bySkill.listening.evidenceCount += l.evidenceCount;
      aggregates.bySkill.listening.attemptsCount++;
      if (typeof l.scaledScore === 'number') {
        listeningScoreSum += l.scaledScore;
        listeningScoreCount++;
      }
    }

    // 2. Reading
    const r = attempt.bySkill.reading;
    if (r && r.questionsSeen > 0) {
      aggregates.bySkill.reading.totalSeen += r.questionsSeen;
      aggregates.bySkill.reading.totalAttempted += r.attempted;
      aggregates.bySkill.reading.totalCorrect += r.correct;
      aggregates.bySkill.reading.totalIncorrect += r.incorrect;
      aggregates.bySkill.reading.totalUnanswered += r.unanswered;
      aggregates.bySkill.reading.evidenceCount += r.evidenceCount;
      aggregates.bySkill.reading.attemptsCount++;
      if (typeof r.scaledScore === 'number') {
        readingScoreSum += r.scaledScore;
        readingScoreCount++;
      }
    }

    // 3. Speaking
    const sp = attempt.bySkill.speaking;
    if (sp && sp.questionsSeen > 0) {
      aggregates.bySkill.speaking.totalSeen += sp.questionsSeen;
      aggregates.bySkill.speaking.evidenceCount += sp.evidenceCount;
      aggregates.bySkill.speaking.attemptsCount++;
      if (typeof sp.score === 'number') {
        speakingScoreSum += sp.score;
        speakingCount++;
      }
      if (typeof sp.wordCount === 'number') {
        speakingWordCountSum += sp.wordCount;
      }
      if (sp.rubricScores) {
        Object.entries(sp.rubricScores).forEach(([k, v]) => {
          if (!speakingRubrics[k]) speakingRubrics[k] = [];
          speakingRubrics[k].push(v);
        });
      }
    }

    // 4. Writing
    const wr = attempt.bySkill.writing;
    if (wr && wr.questionsSeen > 0) {
      aggregates.bySkill.writing.totalSeen += wr.questionsSeen;
      aggregates.bySkill.writing.evidenceCount += wr.evidenceCount;
      aggregates.bySkill.writing.attemptsCount++;
      if (typeof wr.score === 'number') {
        writingScoreSum += wr.score;
        writingCount++;
      }
      if (typeof wr.wordCount === 'number') {
        writingWordCountSum += wr.wordCount;
      }
      if (wr.rubricScores) {
        Object.entries(wr.rubricScores).forEach(([k, v]) => {
          if (!writingRubrics[k]) writingRubrics[k] = [];
          writingRubrics[k].push(v);
        });
      }
    }

    // 5. Parts
    if (attempt.byPart) {
      Object.entries(attempt.byPart).forEach(([partKey, partAnalytics]) => {
        const p = partKey as ToeicPart;
        if (!aggregates.byPart[p]) {
          aggregates.byPart[p] = {
            part: p,
            partName: partAnalytics.partName || PART_NAMES[p] || p,
            skill: partAnalytics.skill,
            isObjective: partAnalytics.isObjective,
            totalSeen: 0,
            totalAttempted: 0,
            totalCorrect: 0,
            totalIncorrect: 0,
            totalUnanswered: 0,
            accuracy: null,
            evidenceCount: 0,
            attemptsCount: 0,
            averageDifficultyLevel: 2,
            averageEstimatedDifficulty: 0,
          };
        }
        const item = aggregates.byPart[p]!;
        item.totalSeen += partAnalytics.questionsSeen;
        item.totalAttempted += partAnalytics.attempted;
        item.totalCorrect += partAnalytics.correct;
        item.totalIncorrect += partAnalytics.incorrect;
        item.totalUnanswered += partAnalytics.unanswered;
        item.evidenceCount += partAnalytics.questionsSeen;
        item.attemptsCount++;

        partDiffSumMap.set(p, (partDiffSumMap.get(p) || 0) + partAnalytics.averageDifficultyLevel * partAnalytics.questionsSeen);
        if (partAnalytics.averageEstimatedDifficulty > 0) {
          const prev = partEstDiffSumMap.get(p) || { sum: 0, count: 0 };
          prev.sum += partAnalytics.averageEstimatedDifficulty * partAnalytics.questionsSeen;
          prev.count += partAnalytics.questionsSeen;
          partEstDiffSumMap.set(p, prev);
        }
      });
    }

    // 6. SubSkills
    if (attempt.bySubSkill) {
      Object.entries(attempt.bySubSkill).forEach(([subKey, subAnalytics]) => {
        if (!aggregates.bySubSkill[subKey]) {
          aggregates.bySubSkill[subKey] = {
            subSkill: subKey,
            skill: subAnalytics.skill,
            isObjective: subAnalytics.isObjective,
            totalSeen: 0,
            totalAttempted: 0,
            totalCorrect: 0,
            totalIncorrect: 0,
            totalUnanswered: 0,
            accuracy: null,
            evidenceCount: 0,
            attemptsCount: 0,
            questionTypes: [],
          };
        }
        const item = aggregates.bySubSkill[subKey];
        item.totalSeen += subAnalytics.questionsSeen;
        item.totalAttempted += subAnalytics.attempted;
        item.totalCorrect += subAnalytics.correct;
        item.totalIncorrect += subAnalytics.incorrect;
        item.totalUnanswered += subAnalytics.unanswered;
        item.evidenceCount += subAnalytics.evidenceCount;
        item.attemptsCount++;

        const set = new Set([...item.questionTypes, ...(Array.isArray(subAnalytics.questionTypes) ? subAnalytics.questionTypes : [])]);
        item.questionTypes = Array.from(set);
      });
    }

    // 7. Difficulties
    if (attempt.byDifficulty) {
      (['easy', 'medium', 'hard'] as ToeicDifficulty[]).forEach((diff) => {
        const d = attempt.byDifficulty[diff];
        if (d) {
          const item = aggregates.byDifficulty[diff];
          item.totalSeen += d.questionsSeen;
          item.totalAttempted += d.attempted;
          item.totalCorrect += d.correct;
          item.totalIncorrect += d.incorrect;
          item.totalUnanswered += d.unanswered;
          item.evidenceCount += d.questionsSeen;
        }
      });
    }
  });

  // Calculate Averages & Accuracies
  const lAgg = aggregates.bySkill.listening;
  lAgg.accuracy = lAgg.totalSeen > 0 ? Math.round((lAgg.totalCorrect / lAgg.totalSeen) * 100) : 0;
  lAgg.scaledScoreAvg = listeningScoreCount > 0 ? Math.round(listeningScoreSum / listeningScoreCount) : undefined;

  const rAgg = aggregates.bySkill.reading;
  rAgg.accuracy = rAgg.totalSeen > 0 ? Math.round((rAgg.totalCorrect / rAgg.totalSeen) * 100) : 0;
  rAgg.scaledScoreAvg = readingScoreCount > 0 ? Math.round(readingScoreSum / readingScoreCount) : undefined;

  const spAgg = aggregates.bySkill.speaking;
  spAgg.averageScore = speakingCount > 0 ? Math.round(speakingScoreSum / speakingCount) : undefined;
  spAgg.averageWordCount = speakingCount > 0 ? Math.round(speakingWordCountSum / speakingCount) : undefined;
  if (Object.keys(speakingRubrics).length > 0) {
    const rubricsAvg: Record<string, number> = {};
    Object.entries(speakingRubrics).forEach(([k, vals]) => {
      rubricsAvg[k] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    });
    spAgg.rubricAverages = rubricsAvg;
  }

  const wrAgg = aggregates.bySkill.writing;
  wrAgg.averageScore = writingCount > 0 ? Math.round(writingScoreSum / writingCount) : undefined;
  wrAgg.averageWordCount = writingCount > 0 ? Math.round(writingWordCountSum / writingCount) : undefined;
  if (Object.keys(writingRubrics).length > 0) {
    const rubricsAvg: Record<string, number> = {};
    Object.entries(writingRubrics).forEach(([k, vals]) => {
      rubricsAvg[k] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    });
    wrAgg.rubricAverages = rubricsAvg;
  }

  Object.entries(aggregates.byPart).forEach(([partKey, item]) => {
    const p = partKey as ToeicPart;
    if (item.isObjective) {
      item.accuracy = item.totalSeen > 0 ? Math.round((item.totalCorrect / item.totalSeen) * 100) : 0;
    } else {
      item.accuracy = null;
    }
    const diffSum = partDiffSumMap.get(p) || 0;
    item.averageDifficultyLevel = item.totalSeen > 0 ? Number((diffSum / item.totalSeen).toFixed(2)) : 2;

    const estDiff = partEstDiffSumMap.get(p);
    item.averageEstimatedDifficulty = estDiff && estDiff.count > 0 ? Math.round(estDiff.sum / estDiff.count) : 0;
  });

  Object.values(aggregates.bySubSkill).forEach((item) => {
    if (item.isObjective) {
      item.accuracy = item.totalSeen > 0 ? Math.round((item.totalCorrect / item.totalSeen) * 100) : 0;
    } else {
      item.accuracy = null;
    }
  });

  (['easy', 'medium', 'hard'] as ToeicDifficulty[]).forEach((diff) => {
    const item = aggregates.byDifficulty[diff];
    item.accuracy = item.totalSeen > 0 ? Math.round((item.totalCorrect / item.totalSeen) * 100) : 0;
  });

  return aggregates;
}

/**
 * Trợ thủ phân tích Pacing & Thời gian
 */
function computePacingAnalytics(
  attempts: ToeicAttemptAnalytics[],
  config: ToeicWeaknessProfileConfig
): ToeicTimeAnalytics | undefined {
  let totalTimeSpent = 0;
  let totalQuestions = 0;
  let reliableAttemptsCount = 0;

  attempts.forEach((a) => {
    if (a.overall.timeSpentSeconds && a.overall.timeSpentSeconds > 0) {
      totalTimeSpent += a.overall.timeSpentSeconds;
      totalQuestions += a.overall.totalItems;
      reliableAttemptsCount++;
    }
  });

  if (reliableAttemptsCount === 0 || totalQuestions === 0) {
    return {
      isReliable: false,
      totalTimeSpentSeconds: 0,
      averageSecondsPerQuestion: 0,
    };
  }

  const avgSeconds = Math.round(totalTimeSpent / totalQuestions);

  let observation = '';
  if (avgSeconds < config.pacingThresholdFastSeconds) {
    observation = 'Tốc độ làm bài nhanh vượt trội (< 30s/câu). Cần chú ý đọc kỹ câu hỏi ở các phần dài để tránh lỗi sai bất cẩn.';
  } else if (avgSeconds > config.pacingThresholdSlowSeconds) {
    observation = 'Thời gian xử lý câu hỏi trung bình còn chậm (> 55s/câu). Cần luyện phản xạ đọc lướt để tránh thiếu thời gian làm bài.';
  } else {
    observation = 'Tốc độ phân bổ thời gian hợp lý (30s - 55s/câu), cân đối tốt giữa độ chính xác và kiểm soát đồng hồ.';
  }

  const pacingDistribution: Record<ToeicPacingQuadrant, ToeicPacingArchetype> = {
    fast_correct: {
      quadrant: 'fast_correct',
      description: 'Làm nhanh và chính xác (Làm chủ kiến thức)',
      questionCount: 0,
      percentage: 0,
    },
    fast_wrong: {
      quadrant: 'fast_wrong',
      description: 'Làm nhanh nhưng làm sai (Cẩu thả / Đọc ẩu)',
      questionCount: 0,
      percentage: 0,
    },
    slow_correct: {
      quadrant: 'slow_correct',
      description: 'Mất nhiều thời gian nhưng làm đúng (Cần tăng phản xạ)',
      questionCount: 0,
      percentage: 0,
    },
    slow_wrong: {
      quadrant: 'slow_wrong',
      description: 'Mất nhiều thời gian và làm sai (Lỗ hổng kiến thức)',
      questionCount: 0,
      percentage: 0,
    },
  };

  return {
    isReliable: true,
    totalTimeSpentSeconds: totalTimeSpent,
    averageSecondsPerQuestion: avgSeconds,
    pacingDistribution,
    pacingObservation: observation,
  };
}

/**
 * Trích xuất phân tích nguồn (Source Breakdown)
 */
function extractSourceBreakdown(
  attempts: ToeicAttemptAnalytics[],
  filterFn: (attempt: ToeicAttemptAnalytics) => { evidenceCount: number; correct: number }
): ToeicInsightSourceBreakdown {
  const breakdown: ToeicInsightSourceBreakdown = {
    diagnostic: { attempts: 0, evidenceCount: 0, correct: 0 },
    practice: { attempts: 0, evidenceCount: 0, correct: 0 },
    mock: { attempts: 0, evidenceCount: 0, correct: 0 },
  };

  attempts.forEach((a) => {
    const res = filterFn(a);
    if (res.evidenceCount > 0) {
      const mode = a.experienceMode || 'practice';
      const target = breakdown[mode] || breakdown.practice;
      target.attempts++;
      target.evidenceCount += res.evidenceCount;
      target.correct += res.correct;
    }
  });

  return breakdown;
}

/**
 * Gợi ý sư phạm tự động theo từng dạng câu hỏi / Part / Skill
 */
function generateInsightRecommendation(
  type: ToeicInsightType,
  key: string,
  isWeakness: boolean
): string {
  if (!isWeakness) {
    return 'Phong độ xuất sắc! Tiếp tục duy trì phản xạ tự nhiên thông qua các bài luyện nâng cao.';
  }

  if (type === 'skill') {
    if (key === 'listening') return 'Tập trung luyện nghe bắt từ khóa (Keywords) và phân biệt nối âm/nuốt âm hàng ngày.';
    if (key === 'reading') return 'Rèn luyện kỹ thuật Skimming/Scanning và củng cố ngữ pháp cấu trúc câu cơ bản.';
    if (key === 'speaking') return 'Luyện tập phát âm to rõ, chú ý trọng âm từ và ngữ điệu câu.';
    if (key === 'writing') return 'Tập trung xây dựng câu hoàn chỉnh, tránh lỗi thì và mở rộng vốn từ nối.';
  }

  if (type === 'part') {
    switch (key) {
      case 'part1_photos':
        return 'Chú ý động từ thể bị động (passive voice) và giới từ chỉ vị trí không gian.';
      case 'part2_qna':
        return 'Tập trung nghe từ để hỏi đầu câu (Who, Where, When, Why, How) và tránh bẫy từ đồng âm.';
      case 'part3_conv':
        return 'Đọc trước 3 câu hỏi trước khi audio phát để định vị sẵn thông tin cần nghe.';
      case 'part4_talks':
        return 'Luyện nghe các bài nói độc thoại dài (thông báo sân bay, tin nhắn thoại, báo cáo công việc).';
      case 'part5_grammar':
        return 'Ôn tập phân loại từ (từ loại danh/tính/động/trạng) và sự hòa hợp giữa chủ ngữ và vị ngữ.';
      case 'part6_text':
        return 'Chú ý sự liên kết ngữ cảnh giữa các câu văn và đại từ thay thế.';
      case 'part7_reading':
        return 'Tăng tốc độ đọc hiểu bằng cách đọc câu hỏi trước và xác định từ khóa định vị trong đoạn văn.';
      case 'speaking_read':
        return 'Thu âm và so sánh phát âm với giọng bản xứ, chú ý ngắt nghỉ đúng cụm ngữ nghĩa.';
      case 'writing_email':
        return 'Tuân thủ bố cục thư tín văn phòng: Lời chào, mục đích viết, nội dung chi tiết và lời chào kết.';
    }
  }

  const cleanKey = key.replace(/_/g, ' ');
  return `Cần dành thời gian ôn luyện chuyên sâu mảng kiến thức "${cleanKey}" với tối thiểu 10 bài tập tình huống.`;
}

/**
 * Lọc và xếp hạng Top 3-5 ưu tiên can thiệp mà không bị trùng lặp phân cấp (Hierarchical Deduplication)
 * - Ngăn chặn 'Reading', 'Part 7', và 'Part 7 Inference' cùng chiếm cả 3 slot
 * - Loại bỏ các điểm yếu đã được khắc phục (resolved) hoặc không có priorityScore
 */
function deduplicatePriorities(
  weaknesses: ToeicInsight[],
  maxItems: number = 5
): ToeicInsight[] {
  const eligible = weaknesses.filter(
    (w) => w.priorityScore > 0 && w.weaknessLifecycle !== 'resolved'
  );
  const sorted = [...eligible].sort((a, b) => b.priorityScore - a.priorityScore);

  const selected: ToeicInsight[] = [];
  const coveredParts = new Set<string>();
  const coveredSkills = new Set<string>();

  for (const item of sorted) {
    if (selected.length >= maxItems) break;

    if (item.type === 'subSkill') {
      // Sub-skill cụ thể nhất -> Luôn ưu tiên chọn
      selected.push(item);
      const partKey = getPartForSubSkill(item.key);
      if (partKey) coveredParts.add(partKey);
      coveredSkills.add(item.skill);
    } else if (item.type === 'part') {
      // Nếu part này đã có subSkill đại diện -> Tạm bỏ qua generic part để nhường chỗ cho part/kỹ năng khác
      if (coveredParts.has(item.key)) {
        continue;
      }
      selected.push(item);
      coveredParts.add(item.key);
      coveredSkills.add(item.skill);
    } else if (item.type === 'skill') {
      // Nếu skill này đã có part hoặc subSkill đại diện -> Bỏ qua broad skill
      if (coveredSkills.has(item.key)) {
        continue;
      }
      selected.push(item);
      coveredSkills.add(item.key);
    }
  }

  // Backfill nếu còn chỗ trống và còn ứng viên chưa được đưa vào
  if (selected.length < Math.min(3, sorted.length)) {
    for (const item of sorted) {
      if (selected.length >= maxItems) break;
      if (!selected.includes(item)) {
        selected.push(item);
      }
    }
  }

  return selected;
}

/**
 * Pure function: Xây dựng ToeicWeaknessProfile toàn diện kết hợp:
 * - Evidence Thresholds (Emerging vs Likely vs Established)
 * - Tách bạch Severity, Evidence Strength, và Confidence
 * - Ổn định Trend chống nhiễu
 * - Performance Stability / Volatility
 * - Weakness & Strength Lifecycles
 * - Priority Ranking không thiên lệch mẫu nhỏ
 * - Recent Performance (3-5 bài) vs Long-term Profile
 * - Low-data State UX
 */
export function buildToeicWeaknessProfile(
  attempts: ToeicAttemptAnalytics[],
  customConfig?: Partial<ToeicWeaknessProfileConfig>,
  archivedSummary?: ToeicArchivedSummary | null
): ToeicWeaknessProfile {
  const config: ToeicWeaknessProfileConfig = {
    ...DEFAULT_WEAKNESS_PROFILE_CONFIG,
    ...customConfig,
  };

  const aggregates = aggregateToeicAttempts(attempts, archivedSummary);

  // Sắp xếp attempts theo thời gian hoàn thành (cũ nhất -> mới nhất)
  const sortedAttempts = [...attempts].sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));

  // Giới hạn trong cửa sổ Recency
  const windowAttempts = sortedAttempts.slice(-config.recencyWindowSize);
  const recentAttempts = sortedAttempts.slice(-Math.min(5, config.recencyWindowSize));

  // Tính toán trọng số kết hợp (Recency Decay factor * Experience Mode weight)
  interface WeightedAttemptMeta {
    attempt: ToeicAttemptAnalytics;
    weight: number;
    recencyFactor: number;
    modeWeight: number;
    indexFromNewest: number;
  }

  const weightedAttempts: WeightedAttemptMeta[] = windowAttempts.map((att, idx) => {
    const indexFromNewest = windowAttempts.length - 1 - idx;
    const recencyFactor = Math.max(0.35, Math.pow(config.recencyDecayFactor, indexFromNewest));
    const mode = att.experienceMode || 'practice';
    const modeWeight = config.modeWeights[mode] || 1.0;
    const weight = Number((recencyFactor * modeWeight).toFixed(3));
    return {
      attempt: att,
      weight,
      recencyFactor,
      modeWeight,
      indexFromNewest,
    };
  });

  // 1. Evidence Summary
  let totalQuestionsEvaluated = 0;
  let objectiveEvaluated = 0;
  let openEndedEvaluated = 0;
  let earliest = Date.now();
  let latest = 0;

  const modeBreakdown: Record<string, number> = { diagnostic: 0, practice: 0, mock: 0 };
  const scopeBreakdown: Record<string, number> = { '2-skills': 0, '4-skills': 0 };

  attempts.forEach((a) => {
    totalQuestionsEvaluated += a.overall.totalItems;
    objectiveEvaluated += a.overall.objectiveCount;
    openEndedEvaluated += a.overall.openEndedCount;

    if (a.completedAt) {
      if (a.completedAt < earliest) earliest = a.completedAt;
      if (a.completedAt > latest) latest = a.completedAt;
    }

    if (a.experienceMode) {
      modeBreakdown[a.experienceMode] = (modeBreakdown[a.experienceMode] || 0) + 1;
    }
    if (a.skillScope) {
      scopeBreakdown[a.skillScope] = (scopeBreakdown[a.skillScope] || 0) + 1;
    }
  });

  if (archivedSummary) {
    totalQuestionsEvaluated += archivedSummary.totalQuestions;
  }

  const evidenceSummary: ToeicEvidenceSummary = {
    totalAttempts: attempts.length + (archivedSummary?.totalArchivedAttempts || 0),
    totalQuestionsEvaluated,
    objectiveEvaluated,
    openEndedEvaluated,
    modeBreakdown: modeBreakdown as ToeicEvidenceSummary['modeBreakdown'],
    scopeBreakdown: scopeBreakdown as ToeicEvidenceSummary['scopeBreakdown'],
    firstAttemptAnswerGuaranteed: true,
    dateRange: {
      earliest: attempts.length > 0 ? earliest : 0,
      latest: attempts.length > 0 ? latest : 0,
    },
  };

  // 2. Derive Insights tại 3 tầng (Skill, Part, SubSkill)
  const allInsights: ToeicInsight[] = [];

  // Tầng 1: Skills
  (['listening', 'reading', 'speaking', 'writing'] as ToeicSkill[]).forEach((skill) => {
    const isObj = skill === 'listening' || skill === 'reading';
    let rawEvidenceCount = 0;
    let rawAccuracy: number | null = null;
    let score: number | undefined;
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;
    let attemptsSeen = 0;

    if (isObj) {
      const sAgg = aggregates.bySkill[skill as 'listening' | 'reading'];
      rawEvidenceCount = sAgg.evidenceCount;
      rawAccuracy = sAgg.accuracy;
      correctCount = sAgg.totalCorrect;
      incorrectCount = sAgg.totalIncorrect;
      unansweredCount = sAgg.totalUnanswered;
      attemptsSeen = sAgg.attemptsCount;
    } else {
      const sAgg = aggregates.bySkill[skill as 'speaking' | 'writing'];
      rawEvidenceCount = sAgg.evidenceCount;
      rawAccuracy = null;
      score = sAgg.averageScore;
      attemptsSeen = sAgg.attemptsCount;
    }

    if (rawEvidenceCount === 0) return;

    // Tính weightedAccuracy & trendHistory qua các weighted attempts
    const trendHistory: number[] = [];
    let weightedCorrectSum = 0;
    let weightedTotalSum = 0;

    weightedAttempts.forEach(({ attempt, weight }) => {
      const target = attempt.bySkill[skill];
      if (target && target.questionsSeen > 0) {
        if (target.isObjective) {
          trendHistory.push(target.accuracy);
          weightedCorrectSum += target.correct * weight;
          weightedTotalSum += target.questionsSeen * weight;
        } else if (typeof target.score === 'number') {
          trendHistory.push(Math.round((target.score / 200) * 100));
        }
      }
    });

    // Recent performance across recentAttempts
    let recentCorrect = 0;
    let recentSeen = 0;
    recentAttempts.forEach((att) => {
      const target = att.bySkill[skill];
      if (target && target.questionsSeen > 0 && target.isObjective) {
        recentCorrect += target.correct;
        recentSeen += target.questionsSeen;
      }
    });
    const recentAccuracy = isObj && recentSeen > 0 ? Math.round((recentCorrect / recentSeen) * 100) : null;
    const recentEvidenceCount = recentSeen;

    const weightedAccuracy = isObj
      ? (weightedTotalSum > 0 ? Math.round((weightedCorrectSum / weightedTotalSum) * 100) : rawAccuracy)
      : null;

    const evidenceStrength = deriveEvidenceStrength(
      rawEvidenceCount,
      config.evidenceTiers,
      isObj,
      config.skillMinimumEvidence
    );
    const stability = derivePerformanceStability(trendHistory, rawEvidenceCount, config.maxVolatilityStdDev);
    const trend = computeTrend(
      trendHistory,
      config.minTrendPoints,
      config.trendImprovementDelta,
      config.trendDeclineDelta,
      rawEvidenceCount,
      config.minTrendEvidence
    );

    const sourceBreakdown = extractSourceBreakdown(attempts, (a) => {
      const target = a.bySkill[skill];
      if (target && target.questionsSeen > 0) {
        return {
          evidenceCount: target.evidenceCount,
          correct: target.isObjective ? target.correct : 0,
        };
      }
      return { evidenceCount: 0, correct: 0 };
    });

    const hasMockEvidence = sourceBreakdown.mock.evidenceCount > 0;
    const confidence = computeInsightConfidence(
      rawEvidenceCount,
      attemptsSeen,
      trendHistory,
      config.skillMinimumEvidence,
      config.highConfidenceEvidenceMultiplier,
      stability,
      hasMockEvidence
    );

    // Phân loại classification
    const effectiveAcc = weightedAccuracy !== null ? weightedAccuracy : rawAccuracy;
    let classification: ToeicInsight['classification'] = 'insufficient_data';
    if (confidence !== 'insufficient' && evidenceStrength !== 'insufficient') {
      if (isObj && effectiveAcc !== null) {
        if (effectiveAcc <= config.weaknessAccuracyThreshold) {
          classification = 'weakness';
        } else if (effectiveAcc >= config.strengthAccuracyThreshold) {
          classification = stability === 'volatile' ? 'neutral' : 'strength';
        } else {
          classification = 'neutral';
        }
      } else if (!isObj && score !== undefined) {
        if (score <= 110) {
          classification = 'weakness';
        } else if (score >= 160) {
          classification = 'strength';
        } else {
          classification = 'neutral';
        }
      }
    }

    // Severity
    let severity = 0;
    let severityLevel: ToeicWeaknessSeverity | undefined = undefined;
    if (classification === 'weakness') {
      if (isObj && effectiveAcc !== null) {
        let baseSev = 100 - effectiveAcc;
        if (trend === 'declining') baseSev += 6;
        if (trend === 'improving') baseSev -= 6;
        severity = Math.min(100, Math.max(0, baseSev));
      } else if (!isObj && score !== undefined) {
        let baseSev = Math.round(((200 - score) / 200) * 100);
        if (trend === 'declining') baseSev += 6;
        severity = Math.min(100, Math.max(0, baseSev));
      }
      severityLevel = deriveWeaknessSeverityLevel(severity);
    }

    const weaknessLifecycle = deriveWeaknessLifecycle(classification, evidenceStrength, trend, recentAccuracy, recentEvidenceCount);
    const strengthLifecycle = deriveStrengthLifecycle(classification, evidenceStrength, trend, stability, recentAccuracy);

    // Priority Score (Dampened by evidenceMultiplier: emerging gets 0.5x, established gets 1.2x)
    let priorityScore = 0;
    if (classification === 'weakness') {
      if (weaknessLifecycle === 'resolved') {
        priorityScore = 0;
      } else {
        const evidenceMultiplier = evidenceStrength === 'established' ? 1.2 : evidenceStrength === 'likely' ? 1.0 : 0.5;
        const confBonus = confidence === 'high' ? 12 : confidence === 'medium' ? 8 : 4;
        const trendBonus = trend === 'declining' ? 10 : trend === 'stable' ? 4 : -8;
        const stabilityBonus = stability === 'stable' ? 4 : 0;
        const baseScore = severity * 0.55 + confBonus + trendBonus + stabilityBonus;
        priorityScore = Math.min(100, Math.max(0, Math.round(baseScore * evidenceMultiplier)));
      }
    }

    allInsights.push({
      type: 'skill',
      key: skill,
      displayName: SKILL_NAMES[skill] || skill,
      skill,
      classification,
      severity,
      severityLevel,
      evidenceStrength,
      stability,
      weaknessLifecycle,
      strengthLifecycle,
      priorityScore,
      accuracy: rawAccuracy,
      weightedAccuracy,
      recentAccuracy,
      score,
      evidenceCount: rawEvidenceCount,
      recentEvidenceCount,
      attemptsSeen,
      correctCount,
      incorrectCount,
      unansweredCount,
      averageDifficultyLevel: 2,
      confidence,
      trend,
      trendHistory,
      recommendation: generateInsightRecommendation('skill', skill, classification === 'weakness'),
      sourceBreakdown,
    });
  });

  // Tầng 2: Parts (Part 1 - 7 + Speaking / Writing)
  Object.values(aggregates.byPart).forEach((partAgg) => {
    if (!partAgg || partAgg.totalSeen === 0) return;
    const rawEvidenceCount = partAgg.evidenceCount;

    const trendHistory: number[] = [];
    let weightedCorrectSum = 0;
    let weightedTotalSum = 0;

    weightedAttempts.forEach(({ attempt, weight }) => {
      const target = attempt.byPart[partAgg.part];
      if (target && target.questionsSeen > 0 && target.isObjective) {
        const acc = target.accuracy ?? 0;
        trendHistory.push(acc);
        weightedCorrectSum += target.correct * weight;
        weightedTotalSum += target.questionsSeen * weight;
      }
    });

    let recentCorrect = 0;
    let recentSeen = 0;
    recentAttempts.forEach((att) => {
      const target = att.byPart[partAgg.part];
      if (target && target.questionsSeen > 0 && target.isObjective) {
        recentCorrect += target.correct;
        recentSeen += target.questionsSeen;
      }
    });
    const recentAccuracy = partAgg.isObjective && recentSeen > 0 ? Math.round((recentCorrect / recentSeen) * 100) : null;
    const recentEvidenceCount = recentSeen;

    const weightedAccuracy = partAgg.isObjective
      ? (weightedTotalSum > 0 ? Math.round((weightedCorrectSum / weightedTotalSum) * 100) : partAgg.accuracy)
      : null;

    const evidenceStrength = deriveEvidenceStrength(
      rawEvidenceCount,
      config.evidenceTiers,
      partAgg.isObjective,
      config.partMinimumEvidence
    );
    const stability = derivePerformanceStability(trendHistory, rawEvidenceCount, config.maxVolatilityStdDev);
    const trend = computeTrend(
      trendHistory,
      config.minTrendPoints,
      config.trendImprovementDelta,
      config.trendDeclineDelta,
      rawEvidenceCount,
      config.minTrendEvidence
    );

    const sourceBreakdown = extractSourceBreakdown(attempts, (a) => {
      const target = a.byPart[partAgg.part];
      if (target && target.questionsSeen > 0) {
        return {
          evidenceCount: target.questionsSeen,
          correct: target.isObjective ? target.correct : 0,
        };
      }
      return { evidenceCount: 0, correct: 0 };
    });

    const hasMockEvidence = sourceBreakdown.mock.evidenceCount > 0;
    const confidence = computeInsightConfidence(
      rawEvidenceCount,
      partAgg.attemptsCount,
      trendHistory,
      config.partMinimumEvidence,
      config.highConfidenceEvidenceMultiplier,
      stability,
      hasMockEvidence
    );

    const effectiveAcc = weightedAccuracy !== null ? weightedAccuracy : partAgg.accuracy;
    let classification: ToeicInsight['classification'] = 'insufficient_data';
    if (confidence !== 'insufficient' && evidenceStrength !== 'insufficient') {
      if (partAgg.isObjective && effectiveAcc !== null) {
        if (effectiveAcc <= config.weaknessAccuracyThreshold) {
          classification = 'weakness';
        } else if (effectiveAcc >= config.strengthAccuracyThreshold) {
          classification = stability === 'volatile' ? 'neutral' : 'strength';
        } else {
          classification = 'neutral';
        }
      } else {
        classification = 'neutral';
      }
    }

    let severity = 0;
    let severityLevel: ToeicWeaknessSeverity | undefined = undefined;
    if (classification === 'weakness' && effectiveAcc !== null) {
      let baseSev = 100 - effectiveAcc;
      if (partAgg.averageDifficultyLevel < 1.8) {
        baseSev = Math.round(baseSev * config.easyFailureSeverityWeight);
      } else if (partAgg.averageDifficultyLevel > 2.5) {
        baseSev = Math.round(baseSev * 0.85);
      }
      if (trend === 'declining') baseSev += 6;
      if (trend === 'improving') baseSev -= 6;
      severity = Math.min(100, Math.max(0, baseSev));
      severityLevel = deriveWeaknessSeverityLevel(severity);
    }

    const weaknessLifecycle = deriveWeaknessLifecycle(classification, evidenceStrength, trend, recentAccuracy, recentEvidenceCount);
    const strengthLifecycle = deriveStrengthLifecycle(classification, evidenceStrength, trend, stability, recentAccuracy);

    let priorityScore = 0;
    if (classification === 'weakness') {
      if (weaknessLifecycle === 'resolved') {
        priorityScore = 0;
      } else {
        const evidenceMultiplier = evidenceStrength === 'established' ? 1.2 : evidenceStrength === 'likely' ? 1.0 : 0.5;
        const typeBonus = 10; // Part gets +10
        const confBonus = confidence === 'high' ? 12 : confidence === 'medium' ? 8 : 4;
        const trendBonus = trend === 'declining' ? 10 : trend === 'stable' ? 4 : -8;
        const stabilityBonus = stability === 'stable' ? 4 : 0;
        const baseScore = severity * 0.55 + typeBonus + confBonus + trendBonus + stabilityBonus;
        priorityScore = Math.min(100, Math.max(0, Math.round(baseScore * evidenceMultiplier)));
      }
    }

    allInsights.push({
      type: 'part',
      key: partAgg.part,
      displayName: partAgg.partName,
      skill: partAgg.skill,
      classification,
      severity,
      severityLevel,
      evidenceStrength,
      stability,
      weaknessLifecycle,
      strengthLifecycle,
      priorityScore,
      accuracy: partAgg.accuracy,
      weightedAccuracy,
      recentAccuracy,
      evidenceCount: rawEvidenceCount,
      recentEvidenceCount,
      attemptsSeen: partAgg.attemptsCount,
      correctCount: partAgg.totalCorrect,
      incorrectCount: partAgg.totalIncorrect,
      unansweredCount: partAgg.totalUnanswered,
      averageDifficultyLevel: partAgg.averageDifficultyLevel,
      confidence,
      trend,
      trendHistory,
      recommendation: generateInsightRecommendation('part', partAgg.part, classification === 'weakness'),
      sourceBreakdown,
    });
  });

  // Tầng 3: SubSkills (Động từ Question Bank metadata)
  Object.values(aggregates.bySubSkill).forEach((subAgg) => {
    if (!subAgg || subAgg.totalSeen === 0) return;
    const rawEvidenceCount = subAgg.evidenceCount;

    const trendHistory: number[] = [];
    let weightedCorrectSum = 0;
    let weightedTotalSum = 0;

    weightedAttempts.forEach(({ attempt, weight }) => {
      const target = attempt.bySubSkill[subAgg.subSkill];
      if (target && target.questionsSeen > 0 && target.isObjective) {
        const acc = target.accuracy ?? 0;
        trendHistory.push(acc);
        weightedCorrectSum += target.correct * weight;
        weightedTotalSum += target.questionsSeen * weight;
      }
    });

    let recentCorrect = 0;
    let recentSeen = 0;
    recentAttempts.forEach((att) => {
      const target = att.bySubSkill[subAgg.subSkill];
      if (target && target.questionsSeen > 0 && target.isObjective) {
        recentCorrect += target.correct;
        recentSeen += target.questionsSeen;
      }
    });
    const recentAccuracy = subAgg.isObjective && recentSeen > 0 ? Math.round((recentCorrect / recentSeen) * 100) : null;
    const recentEvidenceCount = recentSeen;

    const weightedAccuracy = subAgg.isObjective
      ? (weightedTotalSum > 0 ? Math.round((weightedCorrectSum / weightedTotalSum) * 100) : subAgg.accuracy)
      : null;

    const evidenceStrength = deriveEvidenceStrength(
      rawEvidenceCount,
      config.evidenceTiers,
      subAgg.isObjective,
      config.minimumEvidence
    );
    const stability = derivePerformanceStability(trendHistory, rawEvidenceCount, config.maxVolatilityStdDev);
    const trend = computeTrend(
      trendHistory,
      config.minTrendPoints,
      config.trendImprovementDelta,
      config.trendDeclineDelta,
      rawEvidenceCount,
      config.minTrendEvidence
    );

    const sourceBreakdown = extractSourceBreakdown(attempts, (a) => {
      const target = a.bySubSkill[subAgg.subSkill];
      if (target && target.questionsSeen > 0) {
        return {
          evidenceCount: target.questionsSeen,
          correct: target.isObjective ? target.correct : 0,
        };
      }
      return { evidenceCount: 0, correct: 0 };
    });

    const hasMockEvidence = sourceBreakdown.mock.evidenceCount > 0;
    const confidence = computeInsightConfidence(
      rawEvidenceCount,
      subAgg.attemptsCount,
      trendHistory,
      config.subSkillMinimumEvidence,
      config.highConfidenceEvidenceMultiplier,
      stability,
      hasMockEvidence
    );

    const effectiveAcc = weightedAccuracy !== null ? weightedAccuracy : subAgg.accuracy;
    let classification: ToeicInsight['classification'] = 'insufficient_data';
    if (confidence !== 'insufficient' && evidenceStrength !== 'insufficient') {
      if (subAgg.isObjective && effectiveAcc !== null) {
        if (effectiveAcc <= config.weaknessAccuracyThreshold) {
          classification = 'weakness';
        } else if (effectiveAcc >= config.strengthAccuracyThreshold) {
          classification = stability === 'volatile' ? 'neutral' : 'strength';
        } else {
          classification = 'neutral';
        }
      } else {
        classification = 'neutral';
      }
    }

    let severity = 0;
    let severityLevel: ToeicWeaknessSeverity | undefined = undefined;
    if (classification === 'weakness' && effectiveAcc !== null) {
      let baseSev = 100 - effectiveAcc;
      if (trend === 'declining') baseSev += 6;
      if (trend === 'improving') baseSev -= 6;
      severity = Math.min(100, Math.max(0, baseSev));
      severityLevel = deriveWeaknessSeverityLevel(severity);
    }

    const weaknessLifecycle = deriveWeaknessLifecycle(classification, evidenceStrength, trend, recentAccuracy, recentEvidenceCount);
    const strengthLifecycle = deriveStrengthLifecycle(classification, evidenceStrength, trend, stability, recentAccuracy);

    let priorityScore = 0;
    if (classification === 'weakness') {
      if (weaknessLifecycle === 'resolved') {
        priorityScore = 0;
      } else {
        const evidenceMultiplier = evidenceStrength === 'established' ? 1.2 : evidenceStrength === 'likely' ? 1.0 : 0.5;
        const typeBonus = 20; // SubSkill gets +20 (ưu tiên cao nhất do tính cụ thể hành động)
        const confBonus = confidence === 'high' ? 12 : confidence === 'medium' ? 8 : 4;
        const trendBonus = trend === 'declining' ? 10 : trend === 'stable' ? 4 : -8;
        const stabilityBonus = stability === 'stable' ? 4 : 0;
        const baseScore = severity * 0.55 + typeBonus + confBonus + trendBonus + stabilityBonus;
        priorityScore = Math.min(100, Math.max(0, Math.round(baseScore * evidenceMultiplier)));
      }
    }

    const formattedSubName = subAgg.subSkill.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    allInsights.push({
      type: 'subSkill',
      key: subAgg.subSkill,
      displayName: `Kỹ năng: ${formattedSubName}`,
      skill: subAgg.skill,
      classification,
      severity,
      severityLevel,
      evidenceStrength,
      stability,
      weaknessLifecycle,
      strengthLifecycle,
      priorityScore,
      accuracy: subAgg.accuracy,
      weightedAccuracy,
      recentAccuracy,
      evidenceCount: rawEvidenceCount,
      recentEvidenceCount,
      attemptsSeen: subAgg.attemptsCount,
      correctCount: subAgg.totalCorrect,
      incorrectCount: subAgg.totalIncorrect,
      unansweredCount: subAgg.totalUnanswered,
      averageDifficultyLevel: 2,
      confidence,
      trend,
      trendHistory,
      recommendation: generateInsightRecommendation('subSkill', subAgg.subSkill, classification === 'weakness'),
      sourceBreakdown,
    });
  });

  // 3. Phân loại và deduplicate Priorities (Hierarchical Non-Domination)
  const weaknesses = allInsights
    .filter((i) => i.classification === 'weakness')
    .sort((a, b) => b.severity - a.severity);

  const strengths = allInsights
    .filter((i) => i.classification === 'strength')
    .sort((a, b) => (b.weightedAccuracy ?? b.accuracy ?? 0) - (a.weightedAccuracy ?? a.accuracy ?? 0));

  const resolvedWeaknesses = allInsights.filter(
    (i) => i.classification === 'weakness' && i.weaknessLifecycle === 'resolved'
  );

  const priorities = deduplicatePriorities(weaknesses, config.maxPriorityItems);

  const recommendations = generateToeicRecommendations(priorities);

  const neutralOrInsufficient = allInsights.filter(
    (i) => i.classification === 'neutral' || i.classification === 'insufficient_data'
  );

  // 4. Time Analytics
  const timeAnalytics = computePacingAnalytics(attempts, config);

  // 5. Recent Performance Summary
  let recentPerformance: ToeicRecentPerformanceSummary | undefined = undefined;
  if (recentAttempts.length > 0) {
    let recTotal = 0;
    let recCorrect = 0;
    const recSkills: Partial<Record<ToeicSkill, { accuracy: number | null; count: number }>> = {};

    recentAttempts.forEach((a) => {
      recTotal += a.overall.totalItems;
      recCorrect += a.overall.correctCount;
    });

    const recTopStrengths = strengths.filter((s) => (s.recentEvidenceCount || 0) >= 2).slice(0, 3);
    const recTopWeaknesses = weaknesses.filter(
      (w) => w.weaknessLifecycle !== 'resolved' && (w.recentEvidenceCount || 0) >= 2
    ).slice(0, 3);

    const recAcc = recTotal > 0 ? Math.round((recCorrect / recTotal) * 100) : 0;
    const recentTrendAccs = recentAttempts
      .filter((a) => a.overall.totalItems > 0)
      .map((a) => a.overall.accuracy);

    const recentTrend = computeTrend(
      recentTrendAccs,
      config.minTrendPoints,
      config.trendImprovementDelta,
      config.trendDeclineDelta,
      recTotal,
      config.minTrendEvidence
    );

    recentPerformance = {
      attemptsCount: recentAttempts.length,
      attemptsConsidered: recentAttempts.length,
      totalQuestions: recTotal,
      accuracy: recAcc,
      averageAccuracy: recAcc,
      trend: recentTrend,
      skills: recSkills,
      topStrengths: recTopStrengths,
      topWeaknesses: recTopWeaknesses,
    };
  }

  // 6. Đánh giá tổng độ tin cậy của Profile & Low-data Check
  let profileConfidence: ToeicConfidenceLevel = 'insufficient';
  if (attempts.length === 0 || objectiveEvaluated < 5) {
    profileConfidence = 'insufficient';
  } else if (attempts.length >= 3 && objectiveEvaluated >= 25) {
    profileConfidence = 'high';
  } else if (attempts.length >= 2 && objectiveEvaluated >= 12) {
    profileConfidence = 'medium';
  } else {
    profileConfidence = 'low';
  }

  const isLowData = attempts.length < 2 || objectiveEvaluated < 15;
  const lowDataMessage = isLowData
    ? attempts.length === 0
      ? 'Chưa có dữ liệu bài thi. Hãy làm bài thi TOEIC đầu tiên để mở khóa hồ sơ năng lực.'
      : `Bạn cần thêm ít nhất ${Math.max(1, 2 - attempts.length)} bài TOEIC (hoặc ${Math.max(1, 15 - objectiveEvaluated)} câu hỏi) để hệ thống nhận diện điểm mạnh/yếu chính xác và ổn định hơn.`
    : undefined;

  return {
    profileId: `weakness_profile_${Date.now()}`,
    generatedAt: Date.now(),
    confidence: profileConfidence,
    evidenceSummary,
    aggregates,
    strengths,
    weaknesses,
    priorities,
    resolvedWeaknesses,
    recommendations,
    neutralOrInsufficient,
    recentPerformance,
    isLowData,
    lowDataMessage,
    timeAnalytics,
  };
}
