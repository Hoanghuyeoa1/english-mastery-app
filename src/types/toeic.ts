// src/types/toeic.ts

export type ToeicSkill = 'listening' | 'reading' | 'speaking' | 'writing';

export type ToeicPart =
  | 'part1_photos'
  | 'part2_qna'
  | 'part3_conv'
  | 'part4_talks'
  | 'part5_grammar'
  | 'part6_text'
  | 'part7_reading'
  | 'speaking_read'
  | 'writing_email';

export type ToeicDifficulty = 'easy' | 'medium' | 'hard';

export type ToeicQuestionType =
  // Part 1: Photographs
  | 'photo_action'
  | 'photo_object_placement'
  | 'photo_scene_general'
  // Part 2: Question & Response
  | 'wh_question'
  | 'yes_no_question'
  | 'statement_response'
  | 'offer_request'
  | 'indirect_response'
  // Part 3 & 4: Conversations & Talks
  | 'main_idea'
  | 'detail'
  | 'inference'
  | 'speaker_intent'
  | 'graphic_relation'
  | 'next_action'
  // Part 5 & 6: Incomplete Sentences & Text Completion
  | 'grammar_pos'
  | 'grammar_tense'
  | 'grammar_voice'
  | 'grammar_conjunction'
  | 'grammar_preposition'
  | 'grammar_subjunctive'
  | 'grammar_pronoun'
  | 'vocab_meaning'
  | 'vocab_collocation'
  | 'sentence_insertion'
  // Part 7: Reading Comprehension
  | 'main_purpose'
  | 'specific_detail'
  | 'negative_fact'
  | 'inference_author'
  | 'vocab_context'
  // Speaking & Writing
  | 'speaking_read_aloud'
  | 'speaking_describe_picture'
  | 'speaking_respond_questions'
  | 'speaking_respond_info'
  | 'speaking_express_opinion'
  | 'writing_write_sentence'
  | 'writing_email_response'
  | 'writing_short_response'
  | 'writing_opinion_essay'
  | 'writing_formal_response'
  // Fallback
  | 'general';

export interface ToeicVocabularyItem {
  word: string;
  ipa: string;
  meaning: string;
}

export interface ToeicEvaluationCriteria {
  pronunciationWeight?: number;
  fluencyWeight?: number;
  grammarWeight?: number;
  vocabularyWeight?: number;
  taskCompletionWeight?: number;
  targetLengthWords?: {
    min: number;
    max: number;
  };
  rubricNotes?: string;
}

/**
 * =============================================================================
 * TOEIC AUDIO METADATA & SYNCHRONIZATION CONTRACTS (PHASE 1)
 * =============================================================================
 */

export type ToeicAudioAccent = 'en-US' | 'en-GB' | 'en-AU' | 'en-CA';
export type ToeicAudioFormat = 'mp3' | 'aac' | 'wav' | 'ogg';
export type ToeicAmbientType = 'test_center' | 'office' | 'street' | 'cafe' | 'room' | 'custom';

export interface ToeicAudioTokenTiming {
  text: string;
  startMs: number;
  endMs: number;
}

export interface ToeicAudioTimingSegment {
  id?: string;
  speaker?: string;
  text: string;
  startMs: number;
  endMs: number;
  tokens?: ToeicAudioTokenTiming[];
}

export interface ToeicAmbientAudioConfig {
  enabled?: boolean;
  type?: ToeicAmbientType;
  url?: string;
  volume?: number; // 0.0 - 1.0 (clamped)
}

export interface ToeicAudioMetadata {
  /**
   * Đường dẫn file âm thanh cục bộ (e.g. '/audio/toeic/p1_01.mp3') hoặc URL từ xa (http/https/blob)
   */
  url: string;
  format?: ToeicAudioFormat;
  durationMs?: number;
  accent?: ToeicAudioAccent;
  segments?: ToeicAudioTimingSegment[];
  ambient?: ToeicAmbientAudioConfig;
  cueIntroMs?: number; // Độ trễ ban đầu trước khi phát (intro chime / pause)
  cueOutroMs?: number; // Độ trễ kết thúc sau khi bài nghe dừng
}

/**
 * Contract câu hỏi chuẩn hóa toàn hệ thống TOEIC.
 * Đảm bảo 100% backward compatibility với các thuộc tính hiện có.
 */
export interface ToeicQuestion {
  id: string;
  part: ToeicPart;
  skill: ToeicSkill;

  // Metadata chuẩn hóa
  difficulty?: ToeicDifficulty;
  topic?: string;
  subSkill?: string;
  questionType?: ToeicQuestionType | string;
  vocabularyTags?: string[];
  grammarTags?: string[];

  /**
   * Internal Heuristic Calibration (100 - 990).
   * QUAN TRỌNG: Đây KHÔNG PHẢI là điểm số TOEIC của câu hỏi hay chứng chỉ người dùng.
   * Trường này chỉ là chỉ số phỏng đoán nội bộ (internal selection heuristic) được engine
   * dùng để cân đối phổ độ khó (difficulty balancing) và phân tầng câu hỏi khi sinh đề ngẫu nhiên.
   * KHÔNG hiển thị giá trị này ra UI như là điểm số hay chuẩn năng lực của thí sinh.
   */
  estimatedDifficulty?: number;

  // Group linking cho Part 3, 4, 6, 7
  groupId?: string;
  passageId?: string;
  audioGroupId?: string;

  // Nội dung và hiển thị
  imageUrl?: string;
  audioScript?: string;
  audioMetadata?: ToeicAudioMetadata;
  passage?: string;
  questionText: string;
  options?: string[]; // Thường là 4 phương án [A, B, C, D] (Part 2 có 3 phương án [A, B, C])
  correctAnswer?: string; // 'A' | 'B' | 'C' | 'D'
  explanation: string;
  vietnameseTranslation: string;
  keyVocabulary?: ToeicVocabularyItem[];
  hint?: string;

  // Tiêu chí chấm điểm Speaking / Writing
  evaluationCriteria?: ToeicEvaluationCriteria;
}

/**
 * Group contract cho các câu hỏi theo nhóm (Part 3 Conversations, Part 4 Talks, Part 6 Text, Part 7 Reading)
 */
export type ToeicGroupType =
  | 'audio_conversation'
  | 'audio_talk'
  | 'text_completion'
  | 'reading_single'
  | 'reading_double'
  | 'reading_triple';

export interface ToeicQuestionGroup {
  id: string; // groupId
  part: ToeicPart;
  skill: ToeicSkill;
  type: ToeicGroupType;
  title?: string;
  contextType?:
    | 'internal_memo'
    | 'email'
    | 'announcement'
    | 'advertisement'
    | 'article'
    | 'schedule'
    | 'form'
    | 'conversation'
    | 'talk'
    | 'other';
  passageId?: string;
  audioGroupId?: string;
  passageText?: string;
  audioScript?: string;
  audioMetadata?: ToeicAudioMetadata;
  imageUrl?: string;
  questionIds: string[]; // Danh sách ID câu hỏi thuộc nhóm này (thứ tự câu)
  topic?: string;
  difficulty?: ToeicDifficulty;
  vocabularyTags?: string[];
  grammarTags?: string[];
  estimatedDifficulty?: number;
  metadata?: Record<string, unknown>;
}

export interface ToeicTestSession {
  id: string;
  mode: '2skills_mini' | '2skills_full' | '4skills' | string;
  experienceMode?: ToeicExperienceMode;
  skillScope?: ToeicSkillScope;
  experienceConfig?: ExamExperienceConfig;
  adaptiveState?: ToeicAdaptiveState;
  diagnosticReport?: ToeicDiagnosticReport;
  title: string;
  date: string;
  totalQuestions: number;
  durationMinutes: number;
  userAnswers: Record<string, string>;
  speakingTranscript?: string;
  writingText?: string;
  firstAttemptAnswers?: Record<string, string>;
  practiceStats?: {
    firstAttemptCorrect: number;
    retryCorrect: number;
    totalQuestions: number;
    accuracy: number;
  };
  listeningScore: number;
  readingScore: number;
  speakingScore?: number;
  writingScore?: number;
  totalScore: number;
  cefrLevel: 'A1/A2' | 'B1' | 'B2' | 'C1';
  analytics?: ToeicAttemptAnalytics;
  timeSpentSeconds?: number;
}

/**
 * =============================================================================
 * TOEIC ATTEMPT ANALYTICS CONTRACT (PHASE 1)
 * =============================================================================
 * Snapshot phân tích năng lực chi tiết cho từng completed attempt.
 * Tuân thủ nghiêm ngặt:
 * - Không duplicate full question objects (chỉ lưu aggregate).
 * - Không fake accuracy/correct cho open-ended Speaking & Writing (để null).
 * - Phân định rõ ngữ nghĩa giữa Diagnostic (estimate), Practice (first-attempt), Mock (strict).
 * - Zero division guards (không bao giờ sinh NaN hoặc Infinity).
 */

export interface ToeicOverallAnalytics {
  totalItems: number;
  objectiveCount: number;
  openEndedCount: number;
  attemptedCount: number;
  unansweredCount: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number; // 0 - 100, tính thuần túy trên objective questions; 0 nếu 0 objective
  scaledScoreLR?: number; // 10 - 990
  scaledScoreSW?: number; // 0 - 400
  listeningScore?: number; // 5 - 495
  readingScore?: number; // 5 - 495
  speakingScore?: number; // 0 - 200
  writingScore?: number; // 0 - 200
  totalScore?: number;
  durationSeconds: number;
  timeSpentSeconds: number;
  completionRate: number; // 0 - 100
}

export interface ToeicSkillAnalyticsObjective {
  skill: 'listening' | 'reading';
  isObjective: true;
  questionsSeen: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number; // 0 - 100
  evidenceCount: number;
  scaledScore?: number;
}

export interface ToeicSkillAnalyticsOpenEnded {
  skill: 'speaking' | 'writing';
  isObjective: false;
  questionsSeen: number;
  hasEvidence: boolean;
  evidenceCount: number;
  score?: number; // 0 - 200
  wordCount?: number;
  rubricScores?: Record<string, number>;
  feedback?: string;
  accuracy: null; // Tuyệt đối không giả mạo accuracy cho câu hỏi tự luận mở
}

export type ToeicSkillAnalytics = ToeicSkillAnalyticsObjective | ToeicSkillAnalyticsOpenEnded;

export interface ToeicPartAnalytics {
  part: ToeicPart;
  partName: string;
  skill: ToeicSkill;
  isObjective: boolean;
  questionsSeen: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number | null; // null cho Speaking/Writing, 0-100 cho objective
  averageDifficultyLevel: number; // 1 (easy) - 3 (hard), 0 nếu 0 câu hỏi
  averageEstimatedDifficulty: number; // Heuristic 100 - 990 trung bình, 0 nếu không có
  difficultyDistribution: Record<ToeicDifficulty, number>;
}

export interface ToeicSubSkillAnalytics {
  subSkill: string;
  skill: ToeicSkill;
  isObjective: boolean;
  questionsSeen: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number | null; // null cho open-ended, 0-100 cho objective
  evidenceCount: number;
  questionTypes: string[];
}

export interface ToeicDifficultyAnalytics {
  difficulty: ToeicDifficulty;
  difficultyLevel: number; // 1=easy, 2=medium, 3=hard
  questionsSeen: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number; // 0 - 100 trên câu trắc nghiệm khách quan
}

export interface ToeicExperienceSemantics {
  experienceMode: ToeicExperienceMode;
  evidenceSource: 'estimate_adaptive' | 'first_attempt_learning' | 'strict_exam';
  isFirstAttemptEvidence: boolean;
  diagnosticConfidence?: 'Low' | 'Medium' | 'High';
  estimatedToeicRange?: { min: number; max: number; display: string };
  practiceRetriesPerformed?: number;
  practiceRetriesCorrect?: number;
}

export interface ToeicAttemptAnalytics {
  attemptId: string;
  experienceMode: ToeicExperienceMode;
  skillScope: ToeicSkillScope;
  completedAt: number;

  overall: ToeicOverallAnalytics;
  bySkill: {
    listening: ToeicSkillAnalyticsObjective;
    reading: ToeicSkillAnalyticsObjective;
    speaking: ToeicSkillAnalyticsOpenEnded;
    writing: ToeicSkillAnalyticsOpenEnded;
  };
  byPart: Partial<Record<ToeicPart, ToeicPartAnalytics>>;
  bySubSkill: Record<string, ToeicSubSkillAnalytics>;
  byDifficulty: Record<ToeicDifficulty, ToeicDifficultyAnalytics>;
  experienceSemantics: ToeicExperienceSemantics;
}

/**
 * =============================================================================
 * TOEIC HISTORICAL ANALYTICS & WEAKNESS PROFILE CONTRACT (PHASE 2)
 * =============================================================================
 * Hợp đồng tổng hợp lịch sử nhiều bài thi để nhận diện điểm mạnh, điểm yếu và mức ưu tiên.
 * Nguyên tắc:
 * 1. Dựa hoàn toàn trên bằng chứng thật (evidence-driven), không phỏng đoán khi thiếu dữ liệu.
 * 2. Phân định rạch ròi 3 nguồn: Diagnostic, Practice (first-attempt), Mock (strict).
 * 3. Ngưỡng bằng chứng tối thiểu (Minimum Evidence Rule) để tránh kết luận vội vàng từ 1-2 câu.
 * 4. Không can thiệp hoặc ghi đè thẻ SRS/Mistake Bank; chỉ phân tích đọc (read-only).
 */

export type ToeicInsightType = 'skill' | 'part' | 'subSkill';
export type ToeicConfidenceLevel = 'insufficient' | 'low' | 'medium' | 'high';
export type ToeicInsightClassification = 'weakness' | 'strength' | 'neutral' | 'insufficient_data';
export type ToeicTrendDirection = 'improving' | 'stable' | 'declining' | 'insufficient_data';

export type ToeicEvidenceStrength = 'insufficient' | 'emerging' | 'likely' | 'established';
export type ToeicPerformanceStability = 'stable' | 'volatile' | 'insufficient_data';
export type ToeicWeaknessLifecycle = 'emerging' | 'active' | 'improving' | 'resolved';
export type ToeicStrengthLifecycle = 'emerging_strength' | 'stable_strength' | 'declining_strength';
export type ToeicWeaknessSeverity = 'mild' | 'moderate' | 'critical';

export type ToeicPacingQuadrant = 'fast_correct' | 'fast_wrong' | 'slow_correct' | 'slow_wrong';

export interface ToeicPacingArchetype {
  quadrant: ToeicPacingQuadrant;
  description: string;
  questionCount: number;
  percentage: number;
}

export interface ToeicTimeAnalytics {
  isReliable: boolean;
  totalTimeSpentSeconds: number;
  averageSecondsPerQuestion: number;
  pacingDistribution?: Record<ToeicPacingQuadrant, ToeicPacingArchetype>;
  pacingObservation?: string;
}

export interface ToeicInsightSourceBreakdown {
  diagnostic: { attempts: number; evidenceCount: number; correct: number };
  practice: { attempts: number; evidenceCount: number; correct: number };
  mock: { attempts: number; evidenceCount: number; correct: number };
}

export interface ToeicInsight {
  type: ToeicInsightType;
  key: string;
  displayName: string;
  skill: ToeicSkill;
  classification: ToeicInsightClassification;
  severity: number; // 0 - 100 (độ nghiêm trọng của điểm yếu)
  severityLevel?: ToeicWeaknessSeverity;
  evidenceStrength?: ToeicEvidenceStrength; // 'insufficient' | 'emerging' | 'likely' | 'established'
  stability?: ToeicPerformanceStability; // 'stable' | 'volatile' | 'insufficient_data'
  weaknessLifecycle?: ToeicWeaknessLifecycle; // 'emerging' | 'active' | 'improving' | 'resolved'
  strengthLifecycle?: ToeicStrengthLifecycle; // 'emerging_strength' | 'stable_strength' | 'declining_strength'
  priorityScore: number; // 0 - 100 (điểm ưu tiên cần can thiệp cải thiện)
  accuracy: number | null; // null cho Speaking/Writing tự luận mở
  weightedAccuracy?: number | null; // Độ chính xác có tính trọng số Recency & Mode
  recentAccuracy?: number | null; // Độ chính xác trong cửa sổ recent 3-5 bài gần nhất
  score?: number; // Điểm trung bình thang 0 - 200 cho Speaking/Writing
  evidenceCount: number; // Tổng số câu hỏi/tác vụ đã gặp
  recentEvidenceCount?: number; // Số câu trong cửa sổ recent
  attemptsSeen: number; // Số lượt thi đã gặp câu hỏi dạng này
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  averageDifficultyLevel: number; // 1 (easy) - 3 (hard)
  confidence: ToeicConfidenceLevel;
  trend?: ToeicTrendDirection;
  trendHistory?: number[]; // Chuỗi lịch sử accuracy qua các attempts gần nhất
  recencyWeight?: number;
  timeAnalytics?: ToeicTimeAnalytics;
  recommendation?: string;
  sourceBreakdown: ToeicInsightSourceBreakdown;
}

export interface ToeicEvidenceSummary {
  totalAttempts: number;
  totalQuestionsEvaluated: number;
  objectiveEvaluated: number;
  openEndedEvaluated: number;
  modeBreakdown: Record<ToeicExperienceMode, number>;
  scopeBreakdown: Record<ToeicSkillScope, number>;
  firstAttemptAnswerGuaranteed: boolean;
  dateRange: {
    earliest: number;
    latest: number;
  };
}

export interface ToeicAggregatedSkill {
  skill: 'listening' | 'reading';
  isObjective: true;
  totalSeen: number;
  totalAttempted: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalUnanswered: number;
  accuracy: number;
  evidenceCount: number;
  attemptsCount: number;
  scaledScoreAvg?: number;
}

export interface ToeicAggregatedOpenEndedSkill {
  skill: 'speaking' | 'writing';
  isObjective: false;
  totalSeen: number;
  evidenceCount: number;
  attemptsCount: number;
  averageScore?: number;
  averageWordCount?: number;
  rubricAverages?: Record<string, number>;
  accuracy: null;
}

export interface ToeicAggregatedPart {
  part: ToeicPart;
  partName: string;
  skill: ToeicSkill;
  isObjective: boolean;
  totalSeen: number;
  totalAttempted: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalUnanswered: number;
  accuracy: number | null;
  evidenceCount: number;
  attemptsCount: number;
  averageDifficultyLevel: number;
  averageEstimatedDifficulty: number;
}

export interface ToeicAggregatedSubSkill {
  subSkill: string;
  skill: ToeicSkill;
  isObjective: boolean;
  totalSeen: number;
  totalAttempted: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalUnanswered: number;
  accuracy: number | null;
  evidenceCount: number;
  attemptsCount: number;
  questionTypes: string[];
}

export interface ToeicAggregatedDifficulty {
  difficulty: ToeicDifficulty;
  difficultyLevel: number;
  totalSeen: number;
  totalAttempted: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalUnanswered: number;
  accuracy: number;
  evidenceCount: number;
}

export interface ToeicHistoricalAggregates {
  bySkill: {
    listening: ToeicAggregatedSkill;
    reading: ToeicAggregatedSkill;
    speaking: ToeicAggregatedOpenEndedSkill;
    writing: ToeicAggregatedOpenEndedSkill;
  };
  byPart: Partial<Record<ToeicPart, ToeicAggregatedPart>>;
  bySubSkill: Record<string, ToeicAggregatedSubSkill>;
  byDifficulty: Record<ToeicDifficulty, ToeicAggregatedDifficulty>;
}

export interface ToeicWeaknessProfileConfig {
  minimumEvidence: number;
  minimumAttempts: number;
  weaknessAccuracyThreshold: number;
  strengthAccuracyThreshold: number;
  subSkillMinimumEvidence: number;
  partMinimumEvidence: number;
  skillMinimumEvidence: number;
  highConfidenceEvidenceMultiplier: number;
  easyFailureSeverityWeight: number;

  // Cấu hình phân tầng bằng chứng (Evidence Tiers)
  evidenceTiers: {
    emergingMin: number; // 3 - 4 câu
    likelyMin: number;   // 5 - 9 câu
    establishedMin: number; // 10+ câu
  };

  // Ngưỡng phát hiện biến động (Stability / Volatility)
  maxVolatilityStdDev: number; // Standard deviation > 25% là volatile

  // Phase 3 Extensions: Recency, Mode Weighting, Trend & Priority
  minTrendPoints: number;
  minTrendEvidence: number; // Tối thiểu tổng số câu hỏi trong trend window
  trendImprovementDelta: number;
  trendDeclineDelta: number;
  recencyWindowSize: number;
  recencyDecayFactor: number;
  modeWeights: {
    mock: number;
    diagnostic: number;
    practice: number;
  };
  maxPriorityItems: number;
  pacingThresholdFastSeconds: number;
  pacingThresholdSlowSeconds: number;
}

export type ToeicActionType =
  | 'practice_toeic_part'
  | 'review_grammar_mistakes'
  | 'review_vocabulary'
  | 'practice_four_skills'
  | 'practice_pronunciation'
  | 'review_mistakes';

export interface ToeicRecommendationAction {
  id: string;
  actionType: ToeicActionType;
  label: string;
  description: string;
  targetTab:
    | 'dashboard'
    | 'flashcards'
    | 'mistakes'
    | 'four_skills'
    | 'quiz'
    | 'arcade'
    | 'pronunciation'
    | 'toeic'
    | 'tutor'
    | 'vocabulary'
    | 'dictionary'
    | 'translator'
    | 'leaderboard'
    | 'admin';
  subTarget?: string;
  isAvailable: boolean;
}

export interface ToeicRecommendation {
  id: string;
  insightKey: string;
  insightType: ToeicInsightType;
  title: string;
  reason: string;
  priorityScore: number;
  primaryAction: ToeicRecommendationAction;
  secondaryAction?: ToeicRecommendationAction;
}

export interface ToeicRecentPerformanceSummary {
  attemptsCount: number;
  attemptsConsidered?: number;
  totalQuestions: number;
  accuracy: number;
  averageAccuracy?: number;
  trend?: ToeicTrendDirection;
  skills: Partial<Record<ToeicSkill, { accuracy: number | null; count: number }>>;
  topStrengths: ToeicInsight[];
  topWeaknesses: ToeicInsight[];
}

export interface ToeicArchivedSummary {
  totalArchivedAttempts: number;
  totalQuestions: number;
  bySkill: Record<string, { totalSeen: number; totalCorrect: number; totalAttempted: number }>;
  byPart: Record<string, { totalSeen: number; totalCorrect: number; totalAttempted: number }>;
  bySubSkill: Record<string, { totalSeen: number; totalCorrect: number; totalAttempted: number; questionTypes: string[] }>;
  lastUpdated: number;
}

export interface ToeicWeaknessProfile {
  profileId: string;
  generatedAt: number;
  confidence: ToeicConfidenceLevel;
  evidenceSummary: ToeicEvidenceSummary;
  aggregates: ToeicHistoricalAggregates;
  strengths: ToeicInsight[];
  weaknesses: ToeicInsight[];
  priorities: ToeicInsight[];
  resolvedWeaknesses?: ToeicInsight[];
  neutralOrInsufficient: ToeicInsight[];
  recentPerformance?: ToeicRecentPerformanceSummary;
  isLowData?: boolean;
  lowDataMessage?: string;
  recommendations?: ToeicRecommendation[];
  timeAnalytics?: ToeicTimeAnalytics;
}

/**
 * =============================================================================
 * TOEIC EXPERIENCE MODE ARCHITECTURE & PERMISSION MATRIX (PHASE 1)
 * =============================================================================
 */

/**
 * Chiều 1: Chế độ trải nghiệm (Experience Mode)
 * Phân định rõ mục đích học tập: Chẩn đoán nhanh, Luyện tập tự do, hoặc Thi thử chuẩn ETS.
 */
export type ToeicExperienceMode = 'diagnostic' | 'practice' | 'mock';

/**
 * Chiều 2: Phạm vi kỹ năng (Skill Scope)
 * Độc lập với Experience Mode.
 */
export type ToeicSkillScope = '2-skills' | '4-skills';

/**
 * Centralized Permission Matrix
 * Bảng điều khiển quyền năng tập trung cho từng chế độ trải nghiệm.
 * UI và Engine đều truy vấn từ đây thay vì hardcode rải rác `if (mode === ...)`.
 */
export interface ExamExperienceConfig {
  timerMode: 'none' | 'soft' | 'strict';
  canPause: boolean;
  showImmediateFeedback: boolean;
  allowHints: boolean;
  allowLookup: boolean;
  allowSaveVocabulary: boolean;
  allowRetry: boolean;
  allowTranscript: boolean;
  allowAudioReplay: boolean;
  adaptiveDifficulty: boolean;
  showResultOnlyAtEnd: boolean;
}

export const TOEIC_EXPERIENCE_CONFIGS: Record<ToeicExperienceMode, ExamExperienceConfig> = {
  diagnostic: {
    timerMode: 'soft',
    canPause: false,
    showImmediateFeedback: false,
    allowHints: false,
    allowLookup: false,
    allowSaveVocabulary: false,
    allowRetry: false,
    allowTranscript: false,
    allowAudioReplay: false,
    adaptiveDifficulty: true,
    showResultOnlyAtEnd: true,
  },
  practice: {
    timerMode: 'none',
    canPause: true,
    showImmediateFeedback: true,
    allowHints: true,
    allowLookup: true,
    allowSaveVocabulary: true,
    allowRetry: true,
    allowTranscript: true,
    allowAudioReplay: true,
    adaptiveDifficulty: false,
    showResultOnlyAtEnd: false,
  },
  mock: {
    timerMode: 'strict',
    canPause: false,
    showImmediateFeedback: false,
    allowHints: false,
    allowLookup: false,
    allowSaveVocabulary: false,
    allowRetry: false,
    allowTranscript: false,
    allowAudioReplay: false,
    adaptiveDifficulty: false,
    showResultOnlyAtEnd: true,
  },
};

export function getExperienceConfig(mode: ToeicExperienceMode): ExamExperienceConfig {
  return TOEIC_EXPERIENCE_CONFIGS[mode] || TOEIC_EXPERIENCE_CONFIGS.practice;
}

/**
 * Ma trận hỗ trợ tổ hợp giữa Experience Mode và Skill Scope
 */
export interface CombinationSupportResult {
  supported: boolean;
  reason?: string;
  recommendedAlternative?: {
    experienceMode: ToeicExperienceMode;
    skillScope: ToeicSkillScope;
  };
}

export function isCombinationSupported(
  experienceMode: ToeicExperienceMode,
  skillScope: ToeicSkillScope
): CombinationSupportResult {
  if (experienceMode === 'diagnostic' && skillScope === '4-skills') {
    return {
      supported: false,
      reason:
        'Chế độ Khảo sát Nhanh (Diagnostic) hiện chỉ hỗ trợ 2 kỹ năng (Listening & Reading). Speaking & Writing là tác vụ tự luận mở đòi hỏi chấm theo rubric chi tiết, không phù hợp cho bài khảo sát phân nhánh ngắn.',
      recommendedAlternative: {
        experienceMode: 'diagnostic',
        skillScope: '2-skills',
      },
    };
  }

  return { supported: true };
}

/**
 * Phân giải hai chiều experienceMode & skillScope từ legacy mode hoặc options
 */
export function resolveExperienceAndSkillScope(
  optionsOrMode?:
    | {
        experienceMode?: ToeicExperienceMode;
        skillScope?: ToeicSkillScope;
        mode?: ExamModeType | string;
      }
    | ExamModeType
    | string
): {
  experienceMode: ToeicExperienceMode;
  skillScope: ToeicSkillScope;
  resolvedExamMode: ExamModeType;
  experienceConfig: ExamExperienceConfig;
} {
  let expMode: ToeicExperienceMode | undefined;
  let scope: ToeicSkillScope | undefined;
  let rawMode: string | undefined;

  if (typeof optionsOrMode === 'string') {
    rawMode = optionsOrMode;
  } else if (optionsOrMode && typeof optionsOrMode === 'object') {
    expMode = optionsOrMode.experienceMode;
    scope = optionsOrMode.skillScope;
    rawMode = optionsOrMode.mode;
  }

  // 1. Phân giải skillScope
  if (!scope) {
    if (rawMode === '4skills') {
      scope = '4-skills';
    } else {
      scope = '2-skills';
    }
  }

  // 2. Phân giải experienceMode
  if (!expMode) {
    if (rawMode === '2skills_mini') {
      expMode = 'diagnostic';
    } else if (rawMode === '2skills_full' || rawMode === '4skills') {
      expMode = 'mock';
    } else {
      expMode = 'practice';
    }
  }

  // 3. Phân giải resolvedExamMode tương ứng
  let resolvedExamMode: ExamModeType;
  if (scope === '4-skills') {
    resolvedExamMode = '4skills';
  } else if (expMode === 'diagnostic') {
    resolvedExamMode = '2skills_mini';
  } else {
    resolvedExamMode = '2skills_full';
  }

  const experienceConfig = getExperienceConfig(expMode);

  return {
    experienceMode: expMode,
    skillScope: scope,
    resolvedExamMode,
    experienceConfig,
  };
}

/**
 * Trạng thái thích ứng của bài thi Chẩn đoán (Diagnostic Adaptive State)
 */
export interface ToeicAdaptiveState {
  currentDifficulty: ToeicDifficulty;
  recentCorrectStreak: number;
  recentWrongStreak: number;
  questionsAnswered: number;
  highestDifficultyReached: ToeicDifficulty;
  difficultyHistory?: Array<{
    questionIndex: number;
    questionId: string;
    difficulty: ToeicDifficulty;
    isCorrect: boolean;
  }>;
}

export const INITIAL_ADAPTIVE_STATE: ToeicAdaptiveState = {
  currentDifficulty: 'medium',
  recentCorrectStreak: 0,
  recentWrongStreak: 0,
  questionsAnswered: 0,
  highestDifficultyReached: 'medium',
  difficultyHistory: [],
};

export type DiagnosticConfidenceLevel = 'Low' | 'Medium' | 'High';

export interface ToeicDiagnosticReport {
  isDiagnostic: boolean;
  estimatedToeicRange: {
    min: number;
    max: number;
    display: string;
  };
  estimatedProficiency: string;
  confidence: DiagnosticConfidenceLevel;
  confidenceReason: string;

  listeningStrength: {
    scoreEstimate: number;
    rangeDisplay: string;
    correctCount: number;
    totalCount: number;
    accuracyPercent: number;
    level: string;
  };

  readingStrength: {
    scoreEstimate: number;
    rangeDisplay: string;
    correctCount: number;
    totalCount: number;
    accuracyPercent: number;
    level: string;
  };

  strongestParts: Array<{
    part: ToeicPart;
    name: string;
    accuracy: number;
    correct: number;
    total: number;
  }>;

  weakestParts: Array<{
    part: ToeicPart;
    name: string;
    accuracy: number;
    correct: number;
    total: number;
  }>;

  grammarWeaknesses: Array<{
    tag: string;
    errorCount: number;
    testedCount: number;
    accuracy: number;
    description: string;
  }>;

  vocabularyWeaknesses: Array<{
    tag: string;
    errorCount: number;
    testedCount: number;
    accuracy: number;
    description: string;
  }>;

  adaptiveProgression: {
    startDifficulty: ToeicDifficulty;
    finalDifficulty: ToeicDifficulty;
    highestDifficultyReached: ToeicDifficulty;
    questionsAnswered: number;
  };

  recommendedNextStep: string;
}

/**
 * Cấu hình chế độ thi chuẩn hóa (Exam Mode Rules Foundation)
 */
export type ExamModeType = '2skills_mini' | '2skills_full' | '4skills';
export type ExamMode = ExamModeType;

export interface DifficultyDistribution {
  easy: number;
  medium: number;
  hard: number;
}

export interface SkillDistribution {
  listening: number;
  reading: number;
  speaking?: number;
  writing?: number;
}

export interface ExamPartRule {
  part: ToeicPart;
  questionCount?: number;
  groupCount?: number;
  targetCount?: number;
}

export interface ExamModeConfig {
  mode: ExamModeType | string;
  name: string;
  description: string;
  durationMinutes: number;
  totalQuestions: number;
  parts: ToeicPart[];
  partCounts: Record<ToeicPart, number>;
  groupCounts?: Partial<Record<ToeicPart, number>>;
  difficultyDistribution: DifficultyDistribution;
  skillDistribution: SkillDistribution;
  groupRoundingStrategy?: 'ceiling' | 'nearest' | 'floor';
  groupConstraints?: Partial<
    Record<
      ToeicPart,
      {
        minQuestionsPerGroup?: number;
        maxQuestionsPerGroup?: number;
      }
    >
  >;
}

export interface ToeicExamSnapshot {
  id: string;
  mode: ExamModeType | string;
  experienceMode?: ToeicExperienceMode;
  skillScope?: ToeicSkillScope;
  experienceConfig?: ExamExperienceConfig;
  adaptiveState?: ToeicAdaptiveState;
  title: string;
  seed: number;
  totalQuestions: number;
  durationMinutes: number;
  questions: ToeicQuestion[];
  groups: ToeicQuestionGroup[];
  partCounts: Record<ToeicPart, number>;
  difficultyBreakdown: {
    easy: number;
    medium: number;
    hard: number;
  };
  skillBreakdown: {
    listening: number;
    reading: number;
    speaking: number;
    writing: number;
  };
  diagnostics: {
    relaxedHistory: boolean;
    relaxedDifficulty: boolean;
    warnings: string[];
    selectedGroupIds: string[];
    selectedQuestionIds: string[];
  };
  createdAt: string;
}

export interface RecentExamHistory {
  recentQuestionIds?: string[];
  recentGroupIds?: string[];
}

export interface GenerateExamOptions {
  mode?: ExamModeType | string;
  experienceMode?: ToeicExperienceMode;
  skillScope?: ToeicSkillScope;
  config?: ExamModeConfig;
  questionBank?: ToeicQuestion[];
  questionGroups?: ToeicQuestionGroup[];
  recentHistory?: RecentExamHistory | string[];
  seed?: number | string;
  allowRelaxation?: boolean;
  difficultyProfile?: Record<ToeicDifficulty, number>;
  adaptiveState?: ToeicAdaptiveState;
  weakAreas?: Array<{
    part?: ToeicPart;
    topic?: string;
    grammarTag?: string;
  }>;
}

export const EXAM_MODE_CONFIGS: Record<ExamModeType, ExamModeConfig> = {
  '2skills_mini': {
    mode: '2skills_mini',
    name: 'TOEIC Mini-Test (10 câu)',
    description: 'Bài khảo sát nhanh năng lực Nghe & Đọc đại diện theo cụm chuẩn (1 conversation group, 1 reading group, 4 câu lẻ).',
    durationMinutes: 15,
    totalQuestions: 10,
    parts: [
      'part1_photos',
      'part2_qna',
      'part3_conv',
      'part4_talks',
      'part5_grammar',
      'part6_text',
      'part7_reading',
    ],
    partCounts: {
      part1_photos: 1,
      part2_qna: 1,
      part3_conv: 3,
      part4_talks: 0,
      part5_grammar: 2,
      part6_text: 0,
      part7_reading: 3,
      speaking_read: 0,
      writing_email: 0,
    },
    groupCounts: {
      part3_conv: 1,
      part7_reading: 1,
    },
    groupRoundingStrategy: 'ceiling',
    difficultyDistribution: {
      easy: 0.3,
      medium: 0.5,
      hard: 0.2,
    },
    skillDistribution: {
      listening: 5,
      reading: 5,
      speaking: 0,
      writing: 0,
    },
    groupConstraints: {
      part3_conv: { minQuestionsPerGroup: 3, maxQuestionsPerGroup: 3 },
      part7_reading: { minQuestionsPerGroup: 3, maxQuestionsPerGroup: 3 },
    },
  },
  '2skills_full': {
    mode: '2skills_full',
    name: 'TOEIC Standard Practice (20 câu)',
    description: 'Bài kiểm tra chuẩn hóa 2 kỹ năng Nghe & Đọc cân đối cấu trúc ETS với các group trọn vẹn.',
    durationMinutes: 30,
    totalQuestions: 20,
    parts: [
      'part1_photos',
      'part2_qna',
      'part3_conv',
      'part4_talks',
      'part5_grammar',
      'part6_text',
      'part7_reading',
    ],
    partCounts: {
      part1_photos: 2,
      part2_qna: 3,
      part3_conv: 3,
      part4_talks: 3,
      part5_grammar: 3,
      part6_text: 3,
      part7_reading: 3,
      speaking_read: 0,
      writing_email: 0,
    },
    groupCounts: {
      part3_conv: 1,
      part4_talks: 1,
      part6_text: 1,
      part7_reading: 1,
    },
    groupRoundingStrategy: 'ceiling',
    difficultyDistribution: {
      easy: 0.25,
      medium: 0.55,
      hard: 0.2,
    },
    skillDistribution: {
      listening: 11,
      reading: 9,
      speaking: 0,
      writing: 0,
    },
    groupConstraints: {
      part3_conv: { minQuestionsPerGroup: 3, maxQuestionsPerGroup: 3 },
      part4_talks: { minQuestionsPerGroup: 3, maxQuestionsPerGroup: 3 },
      part6_text: { minQuestionsPerGroup: 3, maxQuestionsPerGroup: 3 },
      part7_reading: { minQuestionsPerGroup: 3, maxQuestionsPerGroup: 3 },
    },
  },
  '4skills': {
    mode: '4skills',
    name: 'TOEIC 4 Kỹ Năng Toàn Diện (24 câu)',
    description: 'Khảo sát năng lực toàn diện gồm 20 câu Nghe - Đọc và 4 bài thực hành Nói - Viết.',
    durationMinutes: 35,
    totalQuestions: 24,
    parts: [
      'part1_photos',
      'part2_qna',
      'part3_conv',
      'part4_talks',
      'part5_grammar',
      'part6_text',
      'part7_reading',
      'speaking_read',
      'writing_email',
    ],
    partCounts: {
      part1_photos: 2,
      part2_qna: 3,
      part3_conv: 3,
      part4_talks: 3,
      part5_grammar: 3,
      part6_text: 3,
      part7_reading: 3,
      speaking_read: 2,
      writing_email: 2,
    },
    groupCounts: {
      part3_conv: 1,
      part4_talks: 1,
      part6_text: 1,
      part7_reading: 1,
    },
    groupRoundingStrategy: 'ceiling',
    difficultyDistribution: {
      easy: 0.25,
      medium: 0.5,
      hard: 0.25,
    },
    skillDistribution: {
      listening: 11,
      reading: 9,
      speaking: 2,
      writing: 2,
    },
    groupConstraints: {
      part3_conv: { minQuestionsPerGroup: 3, maxQuestionsPerGroup: 3 },
      part4_talks: { minQuestionsPerGroup: 3, maxQuestionsPerGroup: 3 },
      part6_text: { minQuestionsPerGroup: 3, maxQuestionsPerGroup: 3 },
      part7_reading: { minQuestionsPerGroup: 3, maxQuestionsPerGroup: 3 },
    },
  },
};

export const STORAGE_KEY_HISTORY = 'english_mastery_toeic_history';
export const STORAGE_KEY_ARCHIVED_SUMMARY = 'english_mastery_toeic_archived_summary';


