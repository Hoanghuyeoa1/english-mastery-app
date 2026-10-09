// src/types/index.ts
import type {
  CompetencySkill,
  CompetencyEvidenceSource,
  CompetencyEvidence,
  CompetencyEvidenceInput,
  FourSkillsEvidenceStore,
} from './competencyEvidence';
import type { ResumableActivity, ResumableCheckpoint } from './learningContinuity';

export type {
  CompetencySkill,
  CompetencyEvidenceSource,
  CompetencyEvidence,
  CompetencyEvidenceInput,
  FourSkillsEvidenceStore,
};

import type { CEFRLevel } from './cefr';
import type { PracticeModuleId } from './sessionExperience';
import type {
  LevelCertificationStore,
  PersistedLevelCertification,
  CheckpointHistoryEntry,
  CertificationEvaluationResult,
} from './levelCertification';

export type {
  CEFRLevel,
  PracticeModuleId,
  LevelCertificationStore,
  PersistedLevelCertification,
  CheckpointHistoryEntry,
  CertificationEvaluationResult,
};

export * from './cefr';
export * from './fourSkills';
export * from './levelCertification';
export * from './checkpointAssessment';

export type SRSGrade = 0 | 1 | 2 | 3;
// 0: Again (Quên) | 1: Hard (Khó) | 2: Good (Tốt) | 3: Easy (Dễ)

export type SRSReviewRating = 'again' | 'hard' | 'good' | 'easy';
export type SRSCardState = 'new' | 'learning' | 'review' | 'relearning';

export type VocabTag = 'IELTS' | 'TOEIC' | 'Business' | 'Academic' | 'Daily' | 'Idioms' | 'Tech' | 'Travel' | 'Emotions';

export interface VocabWord {
  id: string;
  word: string;
  ipa: string;
  phonetic?: string;           // Phiên âm chuẩn IPA alias
  partOfSpeech: string;        // noun, verb, adjective, adverb, phrase, idiom
  pos?: string;                // Alias for partOfSpeech
  meaning: string;
  definitionEn?: string;
  example: string;
  exampleEn?: string;          // Câu ví dụ tiếng Anh
  example_en?: string;         // Alias for exampleEn
  exampleMeaning?: string;
  exampleVi?: string;          // Nghĩa tiếng Việt của câu ví dụ
  example_vi?: string;         // Alias for exampleVi
  category?: string;           // Danh mục chi tiết: 'IT / Tech', 'Academic / IELTS', 'Business / Workplace', 'TOEIC Core', 'Oxford Core'
  topic?: string;              // Chủ đề tiếng Việt: 'Công việc', 'Công nghệ', 'Giao tiếp hàng ngày', 'Du lịch', 'Học thuật', 'Cảm xúc'
  level?: string;              // Cấp độ CEFR: A1, A2, B1, B2, C1, C2
  cefr?: string;               // Alias for level
  collocations?: string[];
  synonyms?: string[];
  antonyms?: string[];
  tag: VocabTag;
  isFavorite?: boolean;        // Đánh dấu từ yêu thích / từ khó cần chú ý
  
  // SRS SM-2 Fields
  srsLevel: number;            // Số lần ôn tập thành công liên tiếp (repetition)
  nextReviewDate: string;      // ISO Date string: '2026-08-31T06:00:00.000Z'
  interval: number;            // Khoảng cách ngày đến lần ôn tiếp theo
  easeFactor: number;          // Hệ số dễ (Default: 2.5, min: 1.3)
  lastReviewedDate?: string;
  firstLearnedAt?: string;     // Mốc thời gian ĐẦU TIÊN học từ này (CHỈ GHI 1 LẦN DUY NHẤT)
  todayNewReviewedAt?: string; // Mốc thời gian hoàn thành ôn tập ở Chế độ 2 (Từ mới hôm nay)
  todayPoolReviewedAt?: string;// Mốc thời gian hoàn thành ôn tập ở Chế độ 3 (Toàn bộ kho)
  fsrs?: FSRSMemoryState;      // FSRS-4.5 Memory State (stability, difficulty, reps, etc.)
  againCount?: number;         // Bộ đếm số lần chọn Again (Lapse) trên từ này
  lapses?: number;             // Số lần quên (lapse)
  reviewCount?: number;        // Tổng số lượt ôn tập tích lũy suốt đời trên từ này
  sources?: string[];          // Lightweight multi-source provenance: ['reading', 'dictionary', ...]
}

export interface UserProfile {
  name: string;
  level: number;
  xp: number;
  streak: number;
  longestStreak?: number;
  lastActiveDate: string | null; // ISO Date YYYY-MM-DD
  lastStudyDate: string | null;  // ISO Date YYYY-MM-DD (dùng reset hạn mức ngày)
  hearts: number;               // Current hearts (0-5)
  maxHearts: number;
  avatarSeed: string;
  targetDailyWords: number;      // Tổng mục tiêu từ cần tương tác / ngày
  targetDailyNewWords: number;   // Mục tiêu từ mới mỗi ngày (mặc định: 15)
  extraNewWordsBonus: number;    // Số từ mới nạp thêm tạm thời trong ngày hôm nay
  isOnboarded?: boolean;         // Đã hoàn thành nhập tên lần đầu chưa
  targetGoal?: 'ielts' | 'toeic' | 'tech' | 'business' | 'daily';
  equippedTitle?: string;        // Danh hiệu đang trang bị (mặc định: Tân thủ)
  unlockedTitles?: string[];     // Danh sách ID các danh hiệu đã mở khóa
  equippedFrame?: string | null; // Khung avatar vinh danh đang trang bị (champion_frame, elite_frame, prestige_frame)
  unlockedFrames?: string[];     // Danh sách ID các khung avatar vinh danh đã mở khóa
  geminiApiKey?: string;
}

export interface DailyProgress {
  date: string;                  // YYYY-MM-DD
  wordsReviewed: number;         // Số lượt ôn từ cũ đến hạn
  newWordsLearned: number;       // Số từ mới bắt đầu học trong ngày
  quizzesCompleted: number;
  pronunciationsMastered: number;
  xpGained: number;
  againCount?: number;           // Số lượt bấm Again trong ngày
  hardCount?: number;            // Số lượt bấm Hard trong ngày
  goodCount?: number;            // Số lượt bấm Good trong ngày
  easyCount?: number;            // Số lượt bấm Easy trong ngày
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
  category: 'streak' | 'vocab' | 'xp' | 'quiz' | 'arcade';
  target: number;
  progress: number;
  xpReward?: number;
}

export type MistakeType =
  | 'meaning'
  | 'spelling'
  | 'listening'
  | 'pronunciation'
  | 'collocation'
  | 'grammar'
  | 'reading'
  | 'writing'
  | 'other';

export type CanonicalMistakeSource =
  | 'flashcard'
  | 'classic_quiz'
  | 'word_scramble'
  | 'dictation'
  | 'speed_match'
  | 'pronunciation'
  | 'listening'
  | 'reading'
  | 'writing'
  | 'collocation'
  | 'translator'
  | 'four_skills'
  | 'ai_tutor'
  | 'custom'
  | 'other';

export type MistakeSource =
  | CanonicalMistakeSource
  | 'speaking'
  | 'srs_again'
  | 'quiz'
  | 'scramble';

export interface MistakeCauseAnalysis {
  primaryType: MistakeType;
  canonicalSource: CanonicalMistakeSource;
  subReason:
    | 'minor_typo'
    | 'spelling_gap'
    | 'semantic_confusion'
    | 'phonetic_divergence'
    | 'collocation_mismatch'
    | 'grammar_error'
    | 'general_recall_failure';
  isTypo: boolean;
  levenshteinDistance?: number;
}

export interface MistakeEvent {
  id: string;
  itemId?: string;
  word?: string;
  phrase?: string;
  type: MistakeType;
  source: CanonicalMistakeSource;
  occurredAt: number; // Unix epoch ms
  userAnswer?: string;
  expectedAnswer?: string;
  context?: string;
  analysis?: MistakeCauseAnalysis;
}

export type MistakeRecurrenceLevel = 'chronic' | 'recurrent' | 'emerging' | 'stabilized';

export interface TypeResolutionState {
  mistakeCount: number;
  consecutiveCorrect: number;
  resolved: boolean;
  resolvedAt?: string;
  lastMistakeAt?: string;
  reopenCount: number;
}

export interface AdaptiveMistakeProfile {
  id: string;
  itemId?: string;
  word?: string;
  phrase?: string;
  totalMistakes: number;
  typeCounts: Partial<Record<MistakeType, number>>;
  sourceCounts: Partial<Record<MistakeSource, number>>;
  consecutiveCorrect: number;
  resolved: boolean;
  firstSeenAt: number; // Unix epoch ms
  lastMistakeAt: number; // Unix epoch ms
  lastCorrectAt?: number; // Unix epoch ms
  recurrenceCount?: number;
  primaryType?: MistakeType;
  adaptiveScore?: number;
  recurrenceLevel?: MistakeRecurrenceLevel;
  typeResolutionMap?: Partial<Record<MistakeType, TypeResolutionState>>;
}

export interface WeaknessSummary {
  totalMistakes: number;
  unresolvedCount: number;
  resolvedCount: number;
  typeBreakdown: Partial<Record<MistakeType, number>>;
  sourceBreakdown: Partial<Record<MistakeSource, number>>;
  primaryWeaknessType: MistakeType | null;
  recurrentMistakeCount: number;
  averageConsecutiveCorrect: number;
}

export interface TypeWeaknessDetail {
  type: MistakeType;
  totalCount: number;
  unresolvedCount: number;
  resolvedCount: number;
  chronicCount: number;
  recurrentCount: number;
  percentage: number; // 0 - 100
  dominantSource?: CanonicalMistakeSource;
}

export interface ItemWeaknessRank {
  id: string;
  word: string;
  totalMistakes: number;
  primaryType: MistakeType;
  recurrenceLevel: MistakeRecurrenceLevel;
  reopenCount: number;
  resolved: boolean;
  adaptiveScore: number;
  lastMistakeAt: string;
}

export interface WeaknessDiagnosticInsight {
  code: string;
  level: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  suggestedAction?: string;
}

export interface DetailedWeaknessReport {
  summary: WeaknessSummary;
  recurrenceCounts: {
    chronic: number;
    recurrent: number;
    emerging: number;
    stabilized: number;
  };
  dominantWeaknessType: MistakeType | null;
  dominantWeaknessPercentage: number;
  dominantErrorSource: CanonicalMistakeSource | null;
  typeDetails: TypeWeaknessDetail[];
  topStrugglingItems: ItemWeaknessRank[];
  insights: WeaknessDiagnosticInsight[];
  generatedAt: number; // Unix epoch ms
}

export interface AdaptivePracticeRecommendation {
  targetId: string;
  word?: string;
  mistakeType: MistakeType;
  recommendedModule: PracticeModuleId;
  priority: number;
  reason: string;
  secondaryModule?: PracticeModuleId;
  metadata?: {
    source?: CanonicalMistakeSource;
    subReason?: string;
    recurrenceLevel?: MistakeRecurrenceLevel;
    confidence?: 'high' | 'medium' | 'low';
    isTypo?: boolean;
    sampleCount?: number;
  };
}

export interface AdaptiveExercise {
  targetId: string;
  word: string;
  meaning?: string;
  mistakeType: MistakeType;
  recommendedModule: PracticeModuleId;
  priority: number;
  reason: string;
  estimatedMinutes?: number;
}

export interface AdaptiveLearningSession {
  id: string;
  title: string;
  estimatedMinutes: number;
  totalExercises: number;
  exercises: AdaptiveExercise[];
  focusWeakness: MistakeType | null;
  moduleDistribution: Partial<Record<PracticeModuleId, number>>;
  generatedAt: number;
  hasInsufficientData?: boolean;
}

// ==========================================
// Today Learning Plan Types (Phases 2 - 4)
// ==========================================
export type LearningPlanTaskType =
  | 'srs_review'
  | 'srs_due'
  | 'srs_overdue'
  | 'srs_relearning'
  | 'leech_recovery'
  | 'mistake_practice'
  | 'pronunciation_practice'
  | 'weak_skill_practice'
  | 'weak_collocation'
  | 'skill_lesson'
  | 'curriculum_lesson'
  | 'new_words'
  | 'daily_new_words'
  | 'checkpoint_reinforcement'
  | 'checkpoint_readiness';

export type TodayPlanState = 'normal' | 'new_user' | 'completed_day' | 'heavy_workload';

export type LearningPlanTier = 'essential' | 'recommended' | 'optional' | 'urgent' | 'core';

export interface LearningPlanAction {
  tab: ActiveTab;
  subTab?: string;
  arcadeMode?: 'speed_match' | 'word_scramble' | 'dictation' | 'classic_quiz';
  params?: Record<string, any>;
  description?: string;
}

export interface LearningPlanItem {
  id: string;
  type: LearningPlanTaskType;
  title: string;
  description: string;
  count?: number;
  estimatedMinutes: number;
  timeBucket?: string;
  priority: number;
  priorityScore?: number;
  tier: LearningPlanTier;
  reason: string;
  action: LearningPlanAction;
  completed: boolean;
  sessionChunkCount?: number;
  remainingDueCount?: number;
  totalDueCount?: number;
  metadata?: Record<string, any>;
  targetItemIds?: string[];
  targetLessonId?: string;
}

export interface TodayLearningPlan {
  date: string;
  items: LearningPlanItem[];
  totalEstimatedMinutes: number;
  totalTasks: number;
  completedTasks: number;
  progress: number;
  planState?: TodayPlanState;
  stateMessage?: string;
  isHeavyDay?: boolean;
  essentialTasksCount?: number;
  recommendedTasksCount?: number;
  optionalTasksCount?: number;
  totalDueCount?: number;
  remainingDueCount?: number;
  sessionChunkCount?: number;
  workloadBand?: 'light' | 'normal' | 'heavy';
}

export interface ActiveTargetedPracticeConfig {
  module: PracticeModuleId;
  itemIds: string[];
  mistakeType?: MistakeType;
  startedAt: number;
  planItemId?: string;
  planTitle?: string;
  planObjective?: string;
  estimatedMinutes?: number;
}

export type ActivePracticeConfig = ActiveTargetedPracticeConfig;

export interface MistakeRecord {
  id: string; // ID hoặc normalized word
  word: string;
  ipa?: string;
  meaning: string;
  example?: string;
  tag?: VocabTag;
  mistakeCount: number;
  wrongCount?: number;
  lastMistakeAt: string; // ISO string
  consecutiveCorrect: number; // Đếm số lần ôn đúng liên tiếp (khi đạt 2 -> tự động resolved)
  resolved: boolean;
  resolvedDate?: string;
  source?: MistakeSource;

  // Adaptive Mistake Engine extensions
  category?: MistakeType;      // Alias for primaryType
  primaryType?: MistakeType;
  typeCounts?: Partial<Record<MistakeType, number>>;
  sourceCounts?: Partial<Record<MistakeSource, number>>;
  firstSeenAt?: string;
  lastCorrectAt?: string;
  reopenCount?: number;
  lastUserAnswer?: string;
  lastExpectedAnswer?: string;
  lastContext?: string;
  typeResolutionMap?: Partial<Record<MistakeType, TypeResolutionState>>;
}

export type QuizSourceMode = 'all_vocab' | 'mistake_bank' | 'favorites';

export interface QuizSessionConfig {
  sourceMode: QuizSourceMode;
  timeLimitSec?: number;
  questionCount?: number;
}

export interface MistakeResolutionEvent {
  wordId: string;
  word: string;
  resolved: boolean;
  consecutiveCorrect: number;
  newlyResolved: boolean;
}

export type ActiveTab = 
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

export type AppAccessState =
  | 'initializing'
  | 'welcome'
  | 'guest'
  | 'authenticated'
  | 'auth_unavailable';

export * from './toeic';
export * from './toeicListening';
export * from './learningContinuity';

export interface ChatFeedback {
  original: string;
  correction: string;
  explanation: string;
  betterPhrasing?: string;
  vocabularyTips?: string[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  feedback?: ChatFeedback;
  telemetry?: TutorLearningTelemetry;
  isFallback?: boolean;
}

export interface RoleplayScenario {
  id: string;
  title: string;
  role: string;
  aiRole: string;
  icon: string;
  badge: string;
  description: string;
  initialMessage: string;
  systemPrompt: string;
  suggestedPrompts?: string[];
  steps?: string[];
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface CloudSyncInfo {
  status: SyncStatus;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  userEmail: string | null;
  userId: string | null;
}

export interface CloudVocabulary {
  id: string;
  word: string;
  phonetic?: string;
  ipa?: string;
  part_of_speech?: string;
  meaning: string;
  example?: string;
  example_en?: string;
  example_vi?: string;
  category?: string;
  topic?: string;
  level?: string;
  created_at?: string;
}

export interface AdminUserProfile {
  id: string;
  display_name: string | null;
  level: number;
  xp: number;
  streak: number;
  updated_at: string | null;
}

export interface SRSProgress {
  srsLevel: number;
  nextReviewDate: string;
  interval: number;
  easeFactor: number;
  lastReviewedDate?: string;
  firstLearnedAt?: string;
  todayNewReviewedAt?: string;
  todayPoolReviewedAt?: string;
  isFavorite?: boolean;
  fsrs?: FSRSMemoryState;
  againCount?: number;         // Bộ đếm số lần chọn Again (Lapse) trên card này
  reviewCount?: number;        // Tổng số lượt ôn tập tích lũy suốt đời trên card này
  sources?: string[];          // Lightweight multi-source provenance: ['reading', 'dictionary', ...]
}

export interface FourSkillsScores {
  listening: number[];
  reading: number[];
  speaking: number[];
  writing: number[];
  completed_listening_lessons?: string[];
  four_skills_evidence?: FourSkillsEvidenceStore;
  four_skills_completion_progress?: FourSkillsCompletionProgress;
  completed_reading_lessons?: string[];
  completed_speaking_prompts?: string[];
  completed_writing_prompts?: string[];
}

export interface FourSkillsCompletionProgress {
  reading: string[];
  speaking: string[];
  writing: string[];
}

export interface SkillCompetency {
  score: number; // 0 - 100%
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  totalAttempts: number;
  isAssessed?: boolean; // false when totalAttempts === 0
  confidence?: 'high' | 'medium' | 'low';
  confidenceScore?: number; // 0.0 - 1.0
}

// ==========================================
// Collocation & Unified SRS Types
// ==========================================
export type VocabItemType = 'single_word' | 'collocation' | 'idiom' | 'phrasal_verb';

export interface CollocationItem {
  id: string; // 'colloc_' + timestamp
  phrase: string;
  meaning: string;
  usageContext?: string;
  exampleEn: string;
  exampleVi: string;
  sourceTranslationId?: string;
  tags?: string[];
  sources?: string[];
  source?: string;
  createdAt: string;
}

export interface SRSReviewCard {
  id: string;
  type: VocabItemType;
  primaryText: string;
  phonetic?: string;
  meaning: string;
  exampleEn: string;
  exampleVi?: string;
  contextTag?: string;
  srsLevel: number;
  nextReviewDate: string;
  interval?: number;
  easeFactor?: number;
  word?: string;
  ipa?: string;
  example?: string;
  tag?: string;
  isFavorite?: boolean;
  level?: string;
  topic?: string;
  partOfSpeech?: string;
  definitionEn?: string;
  exampleMeaning?: string;
  collocations?: string[];
  synonyms?: string[];
  lastReviewedDate?: string;
  fsrs?: FSRSMemoryState;
  againCount?: number;
  reviewCount?: number;
}

export interface AppStore {
  profile: UserProfile;
  userCustomWords: VocabWord[];
  userCollocations: CollocationItem[];
  srsProgressMap: Record<string, SRSProgress>;
  vocabularyList: VocabWord[]; // In-memory unified bank
  mistakeBank: Record<string, MistakeRecord>; // Sổ tay bẫy lỗi sai
  dailyHistory: Record<string, DailyProgress>;
  achievements: Achievement[];
  claimedAchievementIds: string[];
  audioVoice: 'en-US' | 'en-GB';
  audioSpeed: number;
  autoPlayAudio: boolean;
  isMaskExample: boolean;
  geminiApiKey: string;
  activeFourSkill: 'listening' | 'reading' | 'speaking' | 'writing';
  fourSkillsScores: FourSkillsScores;
  fourSkillsEvidence?: FourSkillsEvidenceStore;
  completedListeningLessonIds: string[];
  fourSkillsCompletionProgress: FourSkillsCompletionProgress;
  hasLearnedNightOwl: boolean;
  srsAlgorithm: SRSAlgorithmType;
  fsrsSettings: FSRSSettings;
  recentReviewEvents: SRSReviewEvent[];
  activePracticeConfig: ActiveTargetedPracticeConfig | null;
  pendingNavigationTab: ActiveTab | null;
  wordLearningStats: WordLearningStatsMap;
  adaptiveQuizTelemetry: AdaptiveQuizTelemetryState;
  resumeActivities: Record<string, ResumableActivity>;
  levelCertifications?: LevelCertificationStore;
  checkpointHistory?: CheckpointHistoryEntry[];
  isHydrated?: boolean;
  isGuestMode?: boolean;
  isLoggedOut?: boolean;
  processedXpKeys?: string[];
  completedQuizSessionIds?: string[];
  processedMistakeKeys?: string[];

  // Actions
  recordCheckpointAttemptResult?: (evaluation: CertificationEvaluationResult) => void;
  recordAdaptiveQuizEvent: (event: Omit<AdaptiveQuizTelemetryItem, 'id' | 'timestamp'> & { id?: string; timestamp?: number }) => void;
  recordReadingEncounters: (tokensOrText: string[] | string, activityId?: string) => void;
  recordWritingUsages: (tokensOrText: string[] | string, activityId?: string) => void;
  recordTranslatorLookup: (wordOrToken: string) => void;
  recordTranslatorEncounters: (tokensOrText: string[] | string, activityId?: string) => void;
  startAdaptivePractice: (config: {
    module: PracticeModuleId;
    itemIds: string[];
    mistakeType?: MistakeType;
    planItemId?: string;
    planTitle?: string;
    planObjective?: string;
    estimatedMinutes?: number;
  }) => void;
  clearAdaptivePractice: () => void;
  navigateToTab: (tab: ActiveTab) => void;
  clearPendingNavigation: () => void;
  setGuestMode?: (enabled: boolean) => void;
  setIsLoggedOut?: (loggedOut: boolean) => void;
  getRatingStats: (timeframe?: 7 | 30 | 'all') => RatingCountStats;
  setSRSAlgorithm: (algorithm: SRSAlgorithmType) => void;
  setFSRSSettings: (settings: Partial<FSRSSettings>) => void;
  saveCollocationToSRS: (item: Omit<CollocationItem, 'id' | 'createdAt'> & { source?: string; sources?: string[] }) => { success: boolean; id: string; isDuplicate?: boolean };
  deleteCollocation: (id: string) => void;
  getUnifiedSRSCards: () => SRSReviewCard[];
  setActiveFourSkill: (skill: 'listening' | 'reading' | 'speaking' | 'writing') => void;
  setProfileName: (name: string, targetGoal?: UserProfile['targetGoal']) => void;
  setEquippedFrame: (frameId: string | null) => void;
  setUnlockedFrames: (frameIds: string[]) => void;
  setAudioVoice: (voice: 'en-US' | 'en-GB') => void;
  setAudioSpeed: (speed: number) => void;
  setAutoPlayAudio: (enabled: boolean) => void;
  setIsMaskExample: (enabled: boolean) => void;
  setGeminiApiKey: (key: string) => void;
  toggleFavorite: (wordId: string) => void;
  saveToSRS: (
    wordOrId: VocabWord | string,
    options?: { contextSentence?: string; meaning?: string; source?: string; sources?: string[] }
  ) => void;
  gainXP: (
    amount: number,
    options?: {
      source?: 'flashcard' | 'ai_tutor' | 'pronunciation' | 'quiz' | 'toeic' | 'four_skills' | 'manual';
      idempotencyKey?: string;
      metadata?: {
        isDue?: boolean;
        isNew?: boolean;
        textLength?: number;
        wordId?: string;
        gameType?: string;
      };
    }
  ) => { leveledUp: boolean; newLevel: number };
  consumeHeart: () => boolean;
  refillHearts: () => void;
  checkAndUpdateStreak: () => void;
  reconcileStreakFromHistory: () => any;
  checkDailyReset: () => void;
  setDailyNewWordsLimit: (limit: number) => void;
  addExtraNewWords: (count: number) => void;
  processReview: (
    wordId: string, 
    grade: SRSGrade, 
    reviewMode?: 'due_today' | 'today_learned' | 'all_learned' | boolean
  ) => void;
  recordMistake: (
    word: Partial<VocabWord> & { word: string; meaning?: string },
    source?: MistakeSource,
    options?: {
      type?: MistakeType;
      userAnswer?: string;
      expectedAnswer?: string;
      context?: string;
      idempotencyKey?: string;
    }
  ) => void;
  recordMistakeCorrect: (wordIdOrText: string, options?: { type?: MistakeType }) => void;
  recordQuizMistakeResult: (
    wordId: string, 
    isCorrect: boolean,
    details?: {
      source?: MistakeSource;
      type?: MistakeType;
      userAnswer?: string;
      expectedAnswer?: string;
      context?: string;
      idempotencyKey?: string;
    }
  ) => MistakeResolutionEvent;
  getUnresolvedMistakeWords: () => VocabWord[];
  removeMistake: (wordIdOrText: string) => void;
  clearResolvedMistakes: () => void;
  clearAllMistakes: () => void;
  recordQuizCompleted: (
    xpEarned: number,
    isPerfect?: boolean,
    options?: {
      quizId?: string;
      quizType?: 'word_match' | 'dictation' | 'fill_blank' | 'word_scramble' | 'comprehension' | 'standard';
      totalQuestions?: number;
      correctCount?: number;
      score?: number;
      durationSeconds?: number;
      mistakeCount?: number;
    }
  ) => { alreadyCompleted: boolean; xpGranted: number };
  recordPronunciationMastered: (xpEarned: number) => void;
  recordSkillScore: (skill: 'listening' | 'reading' | 'speaking' | 'writing', score: number) => void;
  recordSkillEvidence: (input: CompetencyEvidenceInput) => void;
  setFourSkillsScores: (scores: FourSkillsScores) => void;
  setFourSkillsEvidence: (evidence: FourSkillsEvidenceStore) => void;
  markListeningLessonCompleted: (lessonId: string) => void;
  setCompletedListeningLessonIds: (ids: string[]) => void;
  markFourSkillsLessonCompleted: (skill: 'listening' | 'reading' | 'speaking' | 'writing', lessonId: string) => void;
  setFourSkillsCompletionProgress: (progress: Partial<FourSkillsCompletionProgress>) => void;
  setHasLearnedNightOwl: (learned: boolean) => void;
  addCustomWord: (word: Omit<VocabWord, 'id' | 'srsLevel' | 'interval' | 'easeFactor' | 'nextReviewDate'>) => void;
  addBatchWords: (words: Array<Omit<VocabWord, 'id' | 'srsLevel' | 'interval' | 'easeFactor' | 'nextReviewDate'>>) => number;
  deleteWord: (wordId: string) => void;
  updateWord: (word: VocabWord) => void;
  checkAchievements: () => void;
  exportBackupData: () => string;
  importBackupData: (jsonData: string) => { success: boolean; message: string };
  resetVocabularyProgress: () => void;
  resetToDefault: () => void;
  upsertResumeActivity: (activity: ResumableActivity) => void;
  updateResumeCheckpoint: (id: string, checkpoint: Partial<ResumableCheckpoint>) => void;
  completeResumeActivity: (id: string) => void;
  removeResumeActivity: (id: string) => void;
  saveLevelCertification?: (cert: PersistedLevelCertification) => void;
  getLastResumableActivity: () => ResumableActivity | null;
  getMostRecentResumableActivity?: () => ResumableActivity | null;
  mergeCloudData: (payload?: {
    cloudProfile?: {
      id?: string;
      display_name?: string;
      name?: string;
      level?: number;
      xp?: number;
      streak?: number;
      geminiApiKey?: string;
      gemini_api_key?: string;
      four_skills_scores?: FourSkillsScores | Record<string, any>;
      fourSkillsScores?: FourSkillsScores | Record<string, any>;
      four_skills_completion_progress?: FourSkillsCompletionProgress;
      fourSkillsCompletionProgress?: FourSkillsCompletionProgress;
      completed_reading_lessons?: string[];
      completed_speaking_prompts?: string[];
      completed_writing_prompts?: string[];
      has_learned_night_owl?: boolean;
      hasLearnedNightOwl?: boolean;
      updated_at?: string;
    } | null;
    fourSkillsCompletionProgress?: FourSkillsCompletionProgress;
    four_skills_completion_progress?: FourSkillsCompletionProgress;
    completed_reading_lessons?: string[];
    completed_speaking_prompts?: string[];
    completed_writing_prompts?: string[];
    cloudSrsList?: Array<{
      word_id?: string;
      wordId?: string;
      id?: string;
      repetition?: number;
      srsLevel?: number;
      interval?: number;
      ease_factor?: number;
      easeFactor?: number;
      next_review_date?: string;
      nextReviewDate?: string;
      last_reviewed_date?: string;
      lastReviewedDate?: string;
      is_favorite?: boolean;
      isFavorite?: boolean;
    }>;
    cloudDailyLogs?: Array<{
      date: string;
      words_learned?: number;
      xp_earned?: number;
      quizzes_completed?: number;
    }>;
    cloudCustomWords?: VocabWord[];
    userCustomWords?: VocabWord[];
    cloudCollocations?: CollocationItem[];
    userCollocations?: CollocationItem[];
    cloudMistakeBank?: Record<string, MistakeRecord> | MistakeRecord[];
    cloudMistakes?: Record<string, MistakeRecord> | MistakeRecord[];
    mistakeBank?: Record<string, MistakeRecord> | MistakeRecord[];
    [key: string]: any;
  } | null) => void;
}

export type AppStoreState = AppStore;

// ==========================================
// Shadowing & Word Alignment Types
// ==========================================
export type WordMatchStatus = 'correct' | 'mispronounced' | 'missing' | 'extra';

export interface ShadowingWordResult {
  word: string;
  expectedWord?: string;
  status: WordMatchStatus;
  confidence?: number;
}

export interface ShadowingFeedback {
  accuracyScore: number; // 0 - 100
  fluencyScore: number;  // 0 - 100
  completedWords: number;
  totalWords: number;
  wordResults: ShadowingWordResult[];
  transcript: string;
}

// ==========================================
// AI Essay Grading & Feedback Types
// ==========================================
export type DiffSegmentType = 'unchanged' | 'correction' | 'enhancement';

export interface DiffSegment {
  type: DiffSegmentType;
  originalText: string;
  revisedText?: string;
  explanation?: string;
  reasonVi?: string;
}

export interface CEFRCriteriaScore {
  score: number;        // 0 - 100
  cefrLevel: CEFRLevel; // 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  feedback: string;     // Lời nhận xét chuyên sâu bằng tiếng Việt
}

export interface EssayCriteriaBreakdown {
  taskAchievement: CEFRCriteriaScore;
  coherenceCohesion: CEFRCriteriaScore;
  lexicalResource: CEFRCriteriaScore;
  grammaticalAccuracy: CEFRCriteriaScore;
}

export interface EssayGradingResult {
  overallScore: number;
  overallCEFR: CEFRLevel;
  wordCount: number;
  criteria: EssayCriteriaBreakdown;
  strengths: string[];
  improvements: string[];
  diffSegments: DiffSegment[];
  fullRevisedEssay: string;
  isFallback: boolean;
}

export interface GradeEssayOptions {
  essay: string;
  topic?: string;
  targetLevel?: CEFRLevel;
  apiKey?: string;
}

// ==========================================
// Leaderboard & Realtime Ranking Types
// ==========================================
export type LeaderboardIdentityState =
  | 'local_only'
  | 'authenticated_syncing'
  | 'authenticated_synced';

export interface LeaderboardIdentityContext {
  state: LeaderboardIdentityState;
  userId: string | null;
  isLocalOnly: boolean;
  isAuthenticatedSyncing: boolean;
  isAuthenticatedSynced: boolean;
  canHaveCloudRank: boolean;
}

export type LeaderboardMetric = 
  | 'weekly_xp' 
  | 'streak' 
  | 'vocab_mastered' 
  | 'review_consistency' 
  | 'active_minutes' 
  | 'pronunciation_gain' 
  | 'toeic_gain';

export type LocalMetricEligibilityStatus =
  | 'eligible'
  | 'insufficient_evidence'
  | 'not_eligible';

export interface LocalLeaderboardMetricPreview {
  category: LeaderboardMetric;
  value: number | null;
  displayValue: string;
  secondaryScore?: number;
  secondaryDisplay?: string | null;
  status: LocalMetricEligibilityStatus;
  isEligible: boolean;
  ineligibleHint?: string;
  hasLocalActivity: boolean;
}

export type LocalLeaderboardPreviewMap = Record<
  LeaderboardMetric,
  LocalLeaderboardMetricPreview
>;

export interface LeaderboardEntry {
  userId: string;
  rank: number;
  displayName: string;
  avatarUrl?: string;
  level: number;
  rankTitle: string; // Novice, VIP Learner, Master Scholar, Mythic Legend
  score: number;     // Giá trị metric tương ứng (weekly_xp, vocab_mastered, consistency%, active_minutes, etc.)
  secondaryScore?: number; // Tiêu chí phụ phục vụ tie-break hoặc hiển thị (streak, transitions, sessions, etc.)
  isCurrentUser: boolean;
  isEligible?: boolean;    // false nếu user chưa đủ điều kiện tối thiểu (ví dụ <10 mẫu phát âm, <2 bài thi)
  lastActiveAt?: string;
  equippedFrame?: string | null; // Khung avatar vinh danh hiển thị công khai (champion_frame, elite_frame, prestige_frame)
}

export interface WeeklyLearningMetricsRecord {
  id?: string;
  userId: string;
  weekId: string;
  weeklyXp: number;
  vocabMastered: number;
  reviewConsistency: number | null;
  activeMinutes: number;
  pronunciationGain: number | null;
  toeicGain: number | null;
  supportingEvidence?: {
    vocabTransitions?: number;
    consistencyDays?: number;
    activeSessions?: number;
    pronunciationSamples?: number;
    toeicAttempts?: number;
    processedEventKeys?: string[];
  };
  updatedAt?: string;
  createdAt?: string;
}

export interface UserFrameEntitlement {
  id?: string;
  userId: string;
  frameId: 'champion_frame' | 'elite_frame' | 'prestige_frame';
  source: string;
  weekId: string;
  timesWon?: number;
  unlockedAt: string;
}

export interface EquipFrameResponse {
  success: boolean;
  code: 'EQUIPPED_SUCCESS' | 'UNEQUIPPED_SUCCESS' | 'NOT_OWNED' | 'UNAUTHORIZED' | 'INVALID_FRAME' | 'ERROR';
  message: string;
  equippedFrame?: string | null;
}

export interface WeeklyCountdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export interface WeeklyFinalizationRecord {
  weekId: string;
  weekStart: string;
  weekEnd: string;
  finalizedAt: string;
  totalParticipants: number;
  isFinalized: boolean;
  metadata?: Record<string, unknown>;
}

export interface WeeklySnapshotEntry {
  id?: string;
  weekId: string;
  category: LeaderboardMetric;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  level: number;
  rank: number;
  score: number;
  secondaryScore?: number;
  finalizedAt: string;
}

export interface WeeklyFinalizationResponse {
  success: boolean;
  code: 'FINALIZED_SUCCESS' | 'ALREADY_FINALIZED' | 'WEEK_STILL_ACTIVE' | 'PERMISSION_DENIED' | 'INVALID_TARGET_WEEK' | 'ERROR';
  message: string;
  weekId?: string;
  weekStart?: string;
  weekEnd?: string;
  finalizedAt?: string;
  totalParticipants?: number;
  isIdempotent?: boolean;
  serverNow?: string;
  snapshotsCreated?: {
    weekly_xp: number;
    streak: number;
  };
}

// ==========================================
// FSRS-4.5 (Free Spaced Repetition Scheduler) Types
// ==========================================
export type SRSAlgorithmType = 'sm2' | 'fsrs';
export type FSRSRating = 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy
export type FSRSState = 0 | 1 | 2 | 3;  // 0: New, 1: Learning, 2: Review, 3: Relearning

export interface FSRSMemoryState {
  stability: number;       // S (days)
  difficulty: number;      // D: [1.0, 10.0]
  state: FSRSState;
  reps: number;
  lapses: number;
  lastReview: string;      // ISO String
}

export interface FSRSSettings {
  desiredRetention: number; // Range: [0.70, 0.98], Default: 0.90
  maximumInterval: number;  // Default: 36500
  w: number[];              // 17 default parameters of FSRS-4.5
}

export interface FSRSCalculationResult {
  nextReview: string;       // ISO String
  intervalDays: number;
  memory: FSRSMemoryState;
  retrievability: number;   // [0.0, 1.0]
}

export interface SRSReviewEvent {
  id: string;                    // Unique event ID ('rev_' + timestamp + '_' + cardId)
  cardId: string;
  rating: SRSReviewRating;       // 'again' | 'hard' | 'good' | 'easy'
  grade: SRSGrade;               // 0 | 1 | 2 | 3
  algorithm: SRSAlgorithmType;   // 'sm2' | 'fsrs'
  timestamp: string;             // ISO 8601 String (Single Source of Truth)
  stateBefore: SRSCardState;     // Trạng thái vòng đời trước khi review
  stateAfter: SRSCardState;      // Trạng thái vòng đời sau khi review
  interval: number;              // Khoảng cách ngày kế tiếp
  stability?: number;            // Stability (FSRS)
  difficulty?: number;           // Difficulty (FSRS)
  retrievability?: number;       // Predicted retrievability at review time
  reviewMode?: 'due_today' | 'today_learned' | 'all_learned' | string;
  isReinforcement?: boolean;     // True nếu là bài ôn củng cố từ mới học
  isDrill?: boolean;             // True nếu là bài luyện toàn bộ kho từ / drill
}

export interface HistoricalRatingAggregates {
  again: number;
  hard: number;
  good: number;
  easy: number;
  totalReviews: number;
}

export interface RatingCountStats {
  again: number;
  hard: number;
  good: number;
  easy: number;
  total: number;
  retentionRate: number;         // Tỷ lệ nhớ lại (Hard + Good + Easy) / Total, [0.0, 1.0]
  recordedDays: number;          // Số ngày thực tế có ghi nhận rating counters
  analyticsStartedAt?: string;   // Ngày sớm nhất bắt đầu ghi nhận rating counters (YYYY-MM-DD)
}

// ==========================================
// Personalized AI Tutor Learning Context Types
// ==========================================
export type TutorPriorityDomain =
  | 'pronunciation'
  | 'listening'
  | 'grammar'
  | 'collocation'
  | 'vocabulary'
  | 'writing'
  | 'reading';

export interface TutorVocabItem {
  id: string;
  word: string;
  meaning: string;
  ipa?: string;
  reason: string;
  lapseCount: number;
  isLeech: boolean;
}

export interface TutorLeechItem {
  id: string;
  word: string;
  meaning: string;
  lapseCount: number;
  againRate: number;
  score: number;
  reasons: string[];
}

export interface TutorMistakeItem {
  id: string;
  wordOrPhrase: string;
  type: MistakeType;
  source: CanonicalMistakeSource;
  mistakeCount: number;
  lastMistakeAt: string;
  userAnswer?: string;
  expectedAnswer?: string;
  context?: string;
}

export interface TutorCollocationItem {
  id: string;
  phrase: string;
  meaning: string;
  context?: string;
  mistakeCount: number;
  isDue: boolean;
}

export interface TutorGrammarItem {
  id: string;
  patternOrTopic: string;
  errorCount: number;
  lastErrorAt: string;
  exampleContext?: string;
  correction?: string;
}

export interface TutorWritingIssue {
  id: string;
  originalText: string;
  revisedText?: string;
  explanation?: string;
  issueType: MistakeType;
  occurredAt: string;
}

export interface TutorSpeakingIssue {
  id: string;
  targetWord: string;
  transcript?: string;
  phonetic?: string;
  accuracyScore?: number;
  context?: string;
  mistakeCount: number;
}

export interface TutorLearningPriority {
  rank: number;
  domain: TutorPriorityDomain;
  title: string;
  reason: string;
  severity: 'critical' | 'high' | 'medium';
  targetItems: string[];
  score: number;
}

export interface TutorFourSkillsCompetency {
  overallScore: number;
  overallCefr: CEFRLevel;
  listening: SkillCompetency;
  reading: SkillCompetency;
  speaking: SkillCompetency;
  writing: SkillCompetency;
  accumulatedWords: number;
}

export interface TutorLearningContext {
  overallCefr: CEFRLevel;
  competency: TutorFourSkillsCompetency;
  weakVocabulary: TutorVocabItem[];
  leechWords: TutorLeechItem[];
  unresolvedMistakes: TutorMistakeItem[];
  weakCollocations: TutorCollocationItem[];
  grammarWeaknesses: TutorGrammarItem[];
  recentWritingIssues: TutorWritingIssue[];
  recentSpeakingIssues: TutorSpeakingIssue[];
  learningPriorities: TutorLearningPriority[];
  hasLearningHistory: boolean;
  metadata: {
    generatedAt: number;
    totalUnresolvedMistakes: number;
    totalDueCards: number;
    totalLeechWords: number;
  };
}

export interface TutorLearningContextSource {
  profile?: UserProfile | null;
  fourSkillsScores?: FourSkillsScores | null;
  fourSkillsEvidence?: FourSkillsEvidenceStore | null;
  srsProgressMap?: Record<string, SRSProgress> | null;
  userCustomWords?: VocabWord[] | null;
  vocabularyList?: VocabWord[] | null;
  userCollocations?: CollocationItem[] | null;
  mistakeBank?: Record<string, MistakeRecord> | null;
  recentReviewEvents?: SRSReviewEvent[] | null;
  now?: number;
}

// ==========================================
// Personalized AI Tutor Session & Adaptive Telemetry Types
// ==========================================
export interface DetectedMistakeDetail {
  target?: string;
  type?: MistakeType;
  userAnswer?: string;
  correction?: string;
  explanation?: string;
}

export interface TutorLearningTelemetry {
  practicedTargets?: string[];
  detectedMistakes?: DetectedMistakeDetail[];
  grammarFeedback?: string;
  vocabularyFeedback?: string;
  collocationFeedback?: string;
  pronunciationFeedback?: string;
  masteryDemonstrated?: boolean;
  isTrusted?: boolean; // false for synthetic/fallback, true for live model telemetry
}

export interface StructuredTutorResponse {
  reply: string;
  feedback?: ChatFeedback;
  telemetry?: TutorLearningTelemetry;
  isFallback: boolean;
}

export interface SessionMistakeRecord {
  target: string;
  mistakeType?: MistakeType;
  userAnswer?: string;
  correction?: string;
  explanation?: string;
  timestamp: number;
}

export interface SessionCorrectionRecord {
  target?: string;
  original: string;
  correction: string;
  explanation?: string;
}

export interface TutorSessionMemory {
  currentTarget?: string;
  targetPracticeCounts: Record<string, number>;
  masteredTargets: string[];
  recentMistakes: SessionMistakeRecord[];
  lastCorrection?: SessionCorrectionRecord;
  turnCount: number;
}

// ==========================================
// Learning Dictionary Types
// ==========================================
export type LearningDictionaryStatus =
  | 'new'
  | 'learning'
  | 'review'
  | 'relearning'
  | 'leech'
  | 'mastered'
  | 'needs_practice';

export interface WordMistakeSummary {
  hasMistakeRecord: boolean;
  mistakeCount: number;
  unresolved: boolean;
  resolved: boolean;
  consecutiveCorrect: number;
  lastMistakeAt: string | null;
  primaryType: MistakeType | null;
  source: MistakeSource | null;
  typeBreakdown: Partial<Record<MistakeType, number>>;
  sourceBreakdown: Partial<Record<MistakeSource, number>>;
  confusedWith: string[];
}

export interface WordLeechSummary {
  isLeech: boolean;
  score: number;
  reasons: string[];
  againRate: number;
  lapseCount: number;
}

export interface WordAssociatedCollocation {
  phrase: string;
  meaning: string;
  isUserSaved: boolean;
  isInDeck: boolean;
  hasMistakes: boolean;
  isWeak?: boolean;
  weaknessEvidence?: 'mistake_bank' | 'srs_failure' | 'ai_tutor' | 'writing_correction' | null;
  mistakeCount?: number;
  lapseCount?: number;
}

export interface WordCefrCalibration {
  wordLevel?: string;
  learnerLevel: CEFRLevel | null;
  isObservedLearnerLevel: boolean;
  difficultyComparison: 'below' | 'at_level' | 'above' | 'unknown';
  comparisonLabel?: string;
}

export interface PersonalizedConfusionItem {
  word: string;
  count: number;
  lastOccurredAt: string | null;
  source: string;
  evidenceReason?: string;
}

export interface WordConfusionTelemetry {
  commonlyConfused: string[];
  personalizedConfusedWith: PersonalizedConfusionItem[];
}

export interface WordFamilyMember {
  word: string;
  partOfSpeech: string;
  level?: string;
  meaning?: string;
}

export interface WordFamilyInfo {
  root: string;
  members: WordFamilyMember[];
}

export interface WordRatingBreakdown {
  again: number;
  hard: number;
  good: number;
  easy: number;
  total: number;
}

export interface LearningStatusMeta {
  status: LearningDictionaryStatus;
  labelEn: string;
  labelVi: string;
  variant: 'default' | 'primary' | 'warning' | 'danger' | 'success' | 'info';
  description: string;
}

export interface WordMemoryTelemetry {
  algorithm: SRSAlgorithmType;
  cardState: SRSCardState;
  srsLevel: number;
  interval: number;
  lapsesCount: number;
  againCount: number | null;
  reviewCount: number;
  easeFactor: number;
  stability: number | null;
  difficulty: number | null;
  retrievability: number | null;
  isDue: boolean;
  daysUntilDue: number | null;
  elapsedDaysSinceReview: number | null;
  lastReviewedDate: string | null;
  nextReviewDate: string | null;
  firstLearnedAt: string | null;
  fsrs?: FSRSMemoryState;
  ratingBreakdown?: WordRatingBreakdown;
  lastReviewRating?: SRSReviewRating | null;
}

export type WordLearnerSemantic = 'known' | 'learning' | 'unknown';

export interface WordLearningStatsItem {
  readingEncounters: number;
  lastReadingSeenAt: string | null;
  writingUsages: number;
  lastWritingUsedAt: string | null;
  translatorLookups?: number;
  lastTranslatorLookupAt?: string | null;
  translatorEncounters?: number;
  lastTranslatorSeenAt?: string | null;
}

export type WordLearningStatsMap = Record<string, WordLearningStatsItem>;

export interface WordContextUsageTelemetry {
  readingEncounters: number;
  lastReadingSeenAt: string | null;
  writingUsages: number;
  lastWritingUsedAt: string | null;
  translatorLookups?: number;
  lastTranslatorLookupAt?: string | null;
  translatorEncounters?: number;
  lastTranslatorSeenAt?: string | null;
}

export interface LearningDictionaryProfile {
  // Query & Canonical Identity
  queriedToken: string;
  canonicalId: string;
  word: string;
  normalizedKey: string;
  isExistingInDictionary: boolean;
  isStemmedMatch: boolean;

  // Lexical & Dictionary Data
  ipa: string;
  partOfSpeech: string;
  meaning: string;
  definitionEn?: string;
  example?: string;
  exampleEn?: string;
  exampleVi?: string;
  category?: string;
  topic?: string;
  level?: string;
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  commonCollocations: string[];
  staticEntry: VocabWord | null;

  // Word Network & Relationships (Phase 4)
  confusion: WordConfusionTelemetry;
  wordFamily: WordFamilyInfo;

  // Deck & Learning State
  isInUserDeck: boolean;
  isCustomWord: boolean;
  isFavorite: boolean;

  // Core SRS & Memory Metrics
  memory: WordMemoryTelemetry;

  // Diagnostics & Subsystems
  mistakeSummary: WordMistakeSummary;
  leechStatus: WordLeechSummary;
  cefrCalibration: WordCefrCalibration;
  associatedCollocations: WordAssociatedCollocation[];
  weakCollocations: WordAssociatedCollocation[];
  contextUsage: WordContextUsageTelemetry;

  // Dynamic Overall Status
  learningStatus: LearningDictionaryStatus;
}

// ==========================================
// TRANSLATOR TEXT QUIZ TYPES (PHASE 3)
// ==========================================

export type TextQuizQuestionType =
  | 'cloze'             // Điền từ vào câu ngữ cảnh từ đoạn văn
  | 'meaning'           // Chọn nghĩa phù hợp của từ/cụm từ
  | 'phrasal_verb'      // Cụm động từ trong ngữ cảnh
  | 'collocation'       // Kết hợp từ / thuật ngữ IT
  | 'idiom'             // Thành ngữ
  | 'grammar_pattern';  // Mẫu ngữ pháp

export interface TextQuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
  explanation?: string;
}

export interface TextQuizQuestion {
  id: string;
  type: TextQuizQuestionType;
  prompt: string;
  contextSentence?: string;
  targetItem: string;
  canonicalLemma: string;
  category: string;
  options: TextQuizOption[];
  correctAnswerId: string;
  explanation: string;
  cefr?: CEFRLevel;
  semantic: WordLearnerSemantic;
  priorityScore?: number;
}

export interface TextQuizSession {
  id: string;
  sourceText: string;
  questions: TextQuizQuestion[];
  totalQuestions: number;
  availableItemCount: number;
  createdAt: string;
}

export interface TextQuizAttemptResult {
  questionId: string;
  targetItem: string;
  canonicalLemma: string;
  type: TextQuizQuestionType;
  selectedOptionId: string;
  isCorrect: boolean;
  userAnswer: string;
  expectedAnswer: string;
  contextSentence?: string;
}

// ==========================================
// ADAPTIVE QUIZ SELECTION TYPES (PHASE 1)
// ==========================================

export type AdaptiveQuizCategory = 'weak' | 'due' | 'new' | 'mastered';

export interface LearnerQuizContext {
  srsProgressMap?: Record<string, SRSProgress>;
  mistakeBank?: Record<string, MistakeRecord>;
  wordLearningStats?: WordLearningStatsMap;
  fourSkillsScores?: FourSkillsScores;
  learnerCefr?: CEFRLevel | null;
  recentWordIds?: string[];
  now?: number;
}

export interface AdaptiveCandidateEvidence {
  unresolvedMistake?: boolean;
  mistakeCount?: number;
  isLeech?: boolean;
  isDue?: boolean;
  daysUntilDue?: number | null;
  overdueDays?: number;
  retrievability?: number | null;
  lapsesCount?: number;
  againCount?: number | null;
  cefrMatch?: 'exact' | 'close' | 'distant' | 'unknown';
  isUnlearned?: boolean;
  isMastered?: boolean;
  recentPenaltyApplied?: boolean;
  rawScore?: number;
}

export interface ClassifiedAdaptiveCandidate {
  word: VocabWord;
  canonicalLemma: string;
  category: AdaptiveQuizCategory;
  priorityScore: number;
  evidence: AdaptiveCandidateEvidence;
}

export interface AdaptiveQuizSelectionOptions {
  count?: number;
  targetQuotas?: {
    weak?: number;
    due?: number;
    new?: number;
    mastered?: number;
  };
  seed?: number | string;
  excludeWordIds?: Set<string> | string[];
  tagFilter?: VocabTag | 'ALL';
  allowFallback?: boolean;
}

export interface AdaptiveQuizSelectionResult {
  items: VocabWord[];
  classifiedItems: ClassifiedAdaptiveCandidate[];
  quotaSummary: {
    requested: number;
    allocated: Record<AdaptiveQuizCategory, number>;
    actual: Record<AdaptiveQuizCategory, number>;
    shortfalls: Record<AdaptiveQuizCategory, number>;
    surplusRedistributed: number;
  };
  isNewUserFallback: boolean;
}

// ==========================================
// ADAPTIVE DIFFICULTY TYPES (PHASE 2)
// ==========================================

export type AdaptiveDifficultyTier = 'easy' | 'normal' | 'hard' | 'advanced';

export interface RecentAnswerRecord {
  isCorrect: boolean;
  timestamp?: number;
  wordId?: string;
}

export interface ModeDifficultyParams {
  classicQuiz: {
    distractorCount: number;
    prioritizeConfusion: boolean;
    prioritizeSamePos: boolean;
    maxSimilarityTarget: number;
    explanationDetail: 'concise' | 'detailed';
  };
  dictation: {
    maskHintType: 'first_letter_and_length' | 'word_length' | 'none';
    speechSpeed: number;
    allowSlowReplay: boolean;
  };
  wordScramble: {
    distractorLettersCount: number;
    revealFirstLetter: boolean;
    maxWordLengthCap?: number;
  };
  speedMatch: {
    timeLimitSeconds: number;
    pairCount: number;
  };
}

export interface AdaptiveDifficultyEvaluation {
  tier: AdaptiveDifficultyTier;
  numericScore: number;
  accuracyInWindow: number;
  windowSizeObserved: number;
  confidence: number;
  isTransitionApplied: boolean;
  transitionReason: string;
  modeParams: ModeDifficultyParams;
}

export interface DifficultyEngineInput {
  recentAnswers: RecentAnswerRecord[] | boolean[];
  learnerCefr?: CEFRLevel | null;
  currentTier?: AdaptiveDifficultyTier;
  consecutiveStreak?: number;
  mistakeCount?: number;
  avgRetrievability?: number | null;
  avgDifficulty?: number | null;
  windowSize?: number;
}

export type ArcadeMode = 'speed_match' | 'word_scramble' | 'dictation' | 'classic_quiz';

export interface AdaptiveQuizTelemetryItem {
  id: string;
  wordId: string;
  word: string;
  isCorrect: boolean;
  category: AdaptiveQuizCategory;
  difficulty: AdaptiveDifficultyTier;
  mode: ArcadeMode;
  timestamp: number;
}

export interface CategoryTelemetryBreakdown {
  answered: number;
  correct: number;
}

export interface DifficultyTelemetryBreakdown {
  answered: number;
  correct: number;
}

export interface ModeTelemetryBreakdown {
  answered: number;
  correct: number;
}

export interface AdaptiveQuizAggregateStats {
  totalAnswered: number;
  totalCorrect: number;
  totalIncorrect: number;
  byCategory: Record<AdaptiveQuizCategory, CategoryTelemetryBreakdown>;
  byDifficulty: Record<AdaptiveDifficultyTier, DifficultyTelemetryBreakdown>;
  byMode: Record<ArcadeMode, ModeTelemetryBreakdown>;
  lastSessionAt?: number;
}

export interface AdaptiveQuizTelemetryState {
  recentEvents: AdaptiveQuizTelemetryItem[];
  aggregate: AdaptiveQuizAggregateStats;
}

export * from './sessionExperience';
export * from './learningEvents';
