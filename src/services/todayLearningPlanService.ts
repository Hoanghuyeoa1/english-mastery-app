// src/services/todayLearningPlanService.ts
/**
 * Today Learning Plan Core Engine (Phases 2 - 4)
 * 
 * Orchestration, Workload Budgeting, Priority Scoring & CTA Dispatcher.
 * 
 * Architectural Invariants:
 * 1. Pure Orchestration / Derived Layer: Never duplicates or caches copies of SRS state,
 *    Mistake Bank, Four Skills competency, or streak/XP.
 * 2. Zero State Mutation: Never mutates FSRS stability, difficulty, retrievability,
 *    SM-2 interval, ease factor, or next review dates. Navigation / CTA never triggers reviews.
 * 3. Scalable / No Bulk-Build: Never builds learning profiles for the full 10,000+ dictionary;
 *    only inspects active user state (srsProgressMap, userCollocations, mistakeBank, skills evidence).
 * 4. Deterministic Priority: Given the same date and learner state, always yields the exact same plan,
 *    scores, task ordering, and identifiers without unseeded randomness.
 * 5. Honest Evidence & No Fake Tasks: If no weaknesses or due cards exist, never fabricates
 *    artificial mistakes or due reviews.
 * 6. Workload Budget & Heavy Day Chunking: When review workload is heavy (e.g. 180 cards),
 *    chunks into actionable 30-card sessions (~10 mins) without marking remaining backlog as done.
 * 7. Zero React / Network Dependencies: 100% offline, testable in pure Node.js environments.
 */

import type {
  ActiveTab,
  AppStore,
  CollocationItem,
  DailyProgress,
  FourSkillsCompletionProgress,
  FourSkillsScores,
  FSRSSettings,
  LearningPlanAction,
  LearningPlanItem,
  LearningPlanTaskType,
  LearningPlanTier,
  MistakeRecord,
  PracticeModuleId,
  SRSAlgorithmType,
  SRSProgress,
  SRSReviewEvent,
  TodayLearningPlan,
  TodayPlanState,
  UserProfile,
  VocabWord,
} from '../types';
import type { FourSkillsEvidenceStore } from '../types/competencyEvidence';

import { getCardUnifiedState } from './srsScheduler';
import { isDueForReview } from './srsAlgorithm';
import { getCalendarDayDiff } from './srsWorkloadForecast';
import { analyzeCardLeechStatus } from './leechDetector';
import { getPronunciationPracticeQueue, PRONUNCIATION_FAIL_THRESHOLD } from './adaptiveMistakeService';
import { evaluateSkillCompetencyV2, adaptLegacyScoresToEvidence } from './skillsCompetencyService';
import { deriveLearnerCefrLevel } from './learningDictionaryService';
import { LISTENING_LESSONS } from '../data/fourSkills/listeningData';
import { READING_LESSONS } from '../data/fourSkills/readingData';
import { SPEAKING_PROMPTS } from '../data/fourSkills/speakingData';
import { WRITING_PROMPTS } from '../data/fourSkills/writingData';
import type { ResumableActivity, FlashcardResumableActivity, ReadingResumableActivity } from '../types/learningContinuity';
import { isActivityStale } from './learningContinuityService';
import type {
  CheckpointHistoryEntry,
  LevelCertificationStore,
  CefrSkill,
  CefrLevel,
} from '../types/levelCertification';
import { CEFR_LEVELS_ORDER } from '../types/levelCertification';
import { evaluateLevelReadiness } from './levelCertificationService';

export interface TodayLearningPlanInput {
  date?: string; // YYYY-MM-DD
  now?: number; // Unix epoch ms
  vocabularyList?: VocabWord[];
  userCollocations?: CollocationItem[];
  srsProgressMap?: Record<string, SRSProgress>;
  mistakeBank?: Record<string, MistakeRecord>;
  fourSkillsScores?: FourSkillsScores;
  fourSkillsEvidence?: FourSkillsEvidenceStore;
  completedListeningLessonIds?: string[];
  completedReadingLessonIds?: string[];
  completedSpeakingPromptIds?: string[];
  completedWritingPromptIds?: string[];
  fourSkillsCompletionProgress?: FourSkillsCompletionProgress;
  dailyHistory?: Record<string, DailyProgress>;
  recentReviewEvents?: SRSReviewEvent[];
  profile?: UserProfile;
  srsAlgorithm?: SRSAlgorithmType;
  fsrsSettings?: FSRSSettings;
  targetMinutes?: number;
  resumeActivities?: Record<string, ResumableActivity>;
  checkpointHistory?: CheckpointHistoryEntry[];
  levelCertifications?: LevelCertificationStore;
}

const DEFAULT_PROFILE_TARGET_NEW_WORDS = 15;
const HEAVY_WORKLOAD_SRS_THRESHOLD = 40;
const SESSION_SRS_CHUNK_SIZE = 30;

// =========================================================================
// TIME ESTIMATION UTILITIES (Robust, Non-NaN, Integer Minutes)
// =========================================================================

/**
 * Parses mm:ss or "X mins" string into clean total minutes (including ~3m quiz buffer).
 */
export function parseDurationToMinutes(durationStr?: string, fallback: number = 7): number {
  if (!durationStr || typeof durationStr !== 'string') return fallback;
  const clean = durationStr.trim().toLowerCase();

  // Match mm:ss (e.g. "3:45", "04:20")
  const mmss = clean.match(/^(\d+):(\d+)$/);
  if (mmss) {
    const mins = parseInt(mmss[1], 10);
    const secs = parseInt(mmss[2], 10);
    const total = mins + secs / 60;
    return Math.max(1, Math.round(total + 3));
  }

  // Match "X mins" or "X min"
  const xmins = clean.match(/(\d+)\s*(min|minute|phút)/);
  if (xmins) {
    return Math.max(1, Math.round(parseInt(xmins[1], 10) + 3));
  }

  return fallback;
}

/**
 * Parses read time string (e.g. "4 mins") into estimated total minutes (+3m comprehension).
 */
export function parseReadTimeToMinutes(readTimeStr?: string, fallback: number = 8): number {
  if (!readTimeStr || typeof readTimeStr !== 'string') return fallback;
  const match = readTimeStr.match(/(\d+)/);
  if (match) {
    return Math.max(1, Math.round(parseInt(match[1], 10) + 3));
  }
  return fallback;
}

/**
 * Formats estimated minutes into clean, human-friendly buckets (~5 phút, ~10 phút, ~20 phút)
 * without NaN / Infinity.
 */
export function formatStudyTimeBucket(minutes: number): string {
  const safe = Math.max(1, Math.round(Number.isFinite(minutes) ? minutes : 5));
  if (safe <= 7) return '~5 phút';
  if (safe <= 12) return '~10 phút';
  if (safe <= 17) return '~15 phút';
  if (safe <= 22) return '~20 phút';
  if (safe <= 27) return '~25 phút';
  return `~${Math.round(safe / 5) * 5} phút`;
}

/**
 * Calculates consistent estimated minutes for any task type without NaN / Infinity risk.
 */
export function calculateTaskEstimatedMinutes(
  type: LearningPlanTaskType,
  count: number = 1,
  metadata?: { duration?: string; readTime?: string }
): number {
  const safeCount = Math.max(0, Number.isFinite(count) ? Math.floor(count) : 0);
  if (safeCount === 0) return 0;

  switch (type) {
    case 'srs_review':
      // 20 seconds per card -> 30 cards = 10 minutes
      return Math.max(1, Math.round((safeCount * 20) / 60));
    case 'srs_relearning':
      // 35 seconds per card (slower recall needed)
      return Math.max(2, Math.round((safeCount * 35) / 60));
    case 'leech_recovery':
      // 45 seconds per leech word (deep mnemonic review)
      return Math.max(2, Math.round((safeCount * 45) / 60));
    case 'mistake_practice':
      // 45 seconds per mistake exercise
      return Math.max(2, Math.round((safeCount * 45) / 60));
    case 'pronunciation_practice':
      // 35 seconds per pronunciation attempt
      return Math.max(2, Math.round((safeCount * 35) / 60));
    case 'weak_collocation':
      // 40 seconds per weak collocation exercise
      return Math.max(2, Math.round((safeCount * 40) / 60));
    case 'weak_skill_practice':
      return 8;
    case 'skill_lesson':
      if (metadata?.duration) {
        return parseDurationToMinutes(metadata.duration, 7);
      }
      if (metadata?.readTime) {
        return parseReadTimeToMinutes(metadata.readTime, 8);
      }
      return 7;
    case 'new_words':
      // 30 seconds per new word
      return Math.max(2, Math.round((safeCount * 30) / 60));
    case 'checkpoint_reinforcement':
      return 10;
    case 'checkpoint_readiness':
      return 20;
    default:
      return 5;
  }
}

function getSkillNameVi(skill: string): string {
  switch (skill) {
    case 'listening':
      return 'Nghe';
    case 'reading':
      return 'Đọc';
    case 'speaking':
      return 'Nói';
    case 'writing':
      return 'Viết';
    default:
      return skill;
  }
}

// =========================================================================
// ACTION DEDUPLICATION & RANKING
// =========================================================================

/**
 * Deduplicates candidate actions based on real targets and item IDs,
 * keeping the top 2–4 highest value actions.
 */
export function deduplicateLearningActions(
  candidates: LearningPlanItem[],
  maxActions: number = 4
): LearningPlanItem[] {
  // Deterministic sort:
  // 1. Priority score descending
  // 2. Priority ascending
  // 3. ID ascending (lexicographical tie-breaker)
  const sorted = [...candidates].sort((a, b) => {
    const scoreDiff = (b.priorityScore ?? 0) - (a.priorityScore ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    const prioDiff = a.priority - b.priority;
    if (prioDiff !== 0) return prioDiff;
    return a.id.localeCompare(b.id);
  });

  const selected: LearningPlanItem[] = [];
  const coveredWeaknessItemIds = new Set<string>();
  const coveredLessonIds = new Set<string>();

  const isWeaknessType = (t: LearningPlanTaskType) =>
    t === 'leech_recovery' || t === 'mistake_practice' || t === 'weak_collocation';

  for (const item of sorted) {
    if (selected.length >= maxActions) break;

    // Check duplicate lesson targets
    if (item.targetLessonId) {
      const cleanLesson = item.targetLessonId.trim().toLowerCase();
      if (coveredLessonIds.has(cleanLesson)) {
        continue;
      }
    }

    // Check duplicate weakness items overlap across weakness tasks (leech, mistakes, weak collocations)
    if (isWeaknessType(item.type) && item.targetItemIds && item.targetItemIds.length > 0) {
      const cleanIds = item.targetItemIds.map((id) => id.trim().toLowerCase());
      const totalCount = cleanIds.length;
      let overlapCount = 0;
      for (const id of cleanIds) {
        if (coveredWeaknessItemIds.has(id)) {
          overlapCount++;
        }
      }

      // If all items or >= 70% of items are already covered by higher priority weakness actions, skip
      if (totalCount > 0 && overlapCount / totalCount >= 0.7) {
        continue;
      }

      for (const id of cleanIds) {
        coveredWeaknessItemIds.add(id);
      }
    }

    if (item.targetLessonId) {
      coveredLessonIds.add(item.targetLessonId.trim().toLowerCase());
    }

    selected.push(item);
  }


  // Re-index priority linearly 1..N
  return selected.map((item, idx) => ({
    ...item,
    priority: idx + 1,
    timeBucket: formatStudyTimeBucket(item.estimatedMinutes),
  }));
}

// =========================================================================
// CORE ENGINE: GENERATE TODAY LEARNING PLAN
// =========================================================================

/**
 * Pure generator: Transforms learner state into a deterministic Today Learning Plan
 * with Workload Tiers (Essential, Recommended, Optional), Chunking, and Realistic Time Estimates.
 */
export function generateTodayLearningPlan(input: TodayLearningPlanInput): TodayLearningPlan {
  const nowMs = input.now ?? Date.now();
  const dateStr = input.date ?? new Date(nowMs).toISOString().split('T')[0];

  const todayProgress = input.dailyHistory?.[dateStr] ?? {
    date: dateStr,
    wordsReviewed: 0,
    newWordsLearned: 0,
    quizzesCompleted: 0,
    pronunciationsMastered: 0,
    xpGained: 0,
  };

  const srsMap = input.srsProgressMap ?? {};
  const mistakes = input.mistakeBank ?? {};
  const algorithm = input.srsAlgorithm ?? 'sm2';
  const targetNewWords = input.profile?.targetDailyNewWords ?? DEFAULT_PROFILE_TARGET_NEW_WORDS;

  const rawItems: LearningPlanItem[] = [];

  // =========================================================================
  // 1. SRS DUE & OVERDUE & RELEARNING
  // =========================================================================
  let overdueCount = 0;
  let dueTodayCount = 0;
  let maxOverdueDays = 0;
  let relearningCount = 0;

  const overdueIds: string[] = [];
  const dueTodayIds: string[] = [];
  const relearningIds: string[] = [];

  const inspectedIds = new Set<string>();

  // A. Inspect active user progress records in srsProgressMap
  for (const [id, progress] of Object.entries(srsMap)) {
    if (!progress) continue;
    inspectedIds.add(id);

    const hasBeenStudied =
      (progress.srsLevel && progress.srsLevel > 0) ||
      Boolean(progress.lastReviewedDate) ||
      Boolean(progress.firstLearnedAt);

    if (!hasBeenStudied) continue;

    // Check Relearning state (FSRS state 3 or SM-2 lapse with reps 0)
    const cardState = getCardUnifiedState(progress);
    if (cardState === 'relearning') {
      relearningCount++;
      relearningIds.push(id);
    }

    if (progress.nextReviewDate) {
      const dueMs = Date.parse(progress.nextReviewDate);
      if (!Number.isNaN(dueMs)) {
        if (isDueForReview(progress.nextReviewDate) || dueMs <= nowMs) {
          const diffDays = getCalendarDayDiff(dueMs, nowMs);
          if (diffDays < 0) {
            overdueCount++;
            overdueIds.push(id);
            maxOverdueDays = Math.max(maxOverdueDays, Math.abs(diffDays));
          } else {
            dueTodayCount++;
            dueTodayIds.push(id);
          }
        }
      }
    }
  }

  // B. Inspect words in vocabularyList if not already in srsProgressMap
  if (Array.isArray(input.vocabularyList)) {
    for (const w of input.vocabularyList) {
      if (!w || !w.id) continue;
      const key = w.id;
      if (inspectedIds.has(key)) continue;

      const hasBeenStudied =
        (w.srsLevel && w.srsLevel > 0) ||
        Boolean(w.lastReviewedDate) ||
        Boolean(w.firstLearnedAt);

      if (!hasBeenStudied) continue;

      const cardState = getCardUnifiedState(w);
      if (cardState === 'relearning') {
        relearningCount++;
        relearningIds.push(key);
      }

      if (w.nextReviewDate) {
        const dueMs = Date.parse(w.nextReviewDate);
        if (!Number.isNaN(dueMs)) {
          if (isDueForReview(w.nextReviewDate, nowMs)) {
            const diffDays = getCalendarDayDiff(dueMs, nowMs);
            if (diffDays < 0) {
              overdueCount++;
              overdueIds.push(key);
              maxOverdueDays = Math.max(maxOverdueDays, Math.abs(diffDays));
            } else {
              dueTodayCount++;
              dueTodayIds.push(key);
            }
          }
        }
      }
    }
  }

  const totalDueCount = overdueCount + dueTodayCount;
  const isHeavyWorkload = totalDueCount >= HEAVY_WORKLOAD_SRS_THRESHOLD;

  // Task: Overdue SRS Reviews
  if (overdueCount > 0) {
    const isCompleted = (todayProgress.wordsReviewed ?? 0) >= overdueCount;
    const estMins = calculateTaskEstimatedMinutes('srs_review', overdueCount);
    const overdueScore = 100 + Math.min(30, maxOverdueDays * 3);

    rawItems.push({
      id: `srs-overdue-${dateStr}`,
      type: 'srs_review',
      title: `Ôn tập ${overdueCount} thẻ SRS quá hạn`,
      description: `Có ${overdueCount} thẻ đã vượt qua chu kỳ trí nhớ tối ưu (trễ tới ${maxOverdueDays} ngày). Cần ôn lại ngay để ngăn suy giảm đường cong lãng quên.`,
      count: overdueCount,
      estimatedMinutes: estMins,
      timeBucket: formatStudyTimeBucket(estMins),
      priority: 1,
      priorityScore: overdueScore,
      tier: 'essential',
      reason: 'Các thẻ quá hạn có nguy cơ quên cao nhất — cần ôn lại ngay để giữ retention ổn định.',
      action: {
        tab: 'flashcards',
        subTab: 'all',
        params: { queueMode: 'DUE', filterTag: 'ALL', itemIds: overdueIds },
        description: 'Mở bộ thẻ ôn tập SRS quá hạn',
      },
      completed: isCompleted,
      totalDueCount: overdueCount,
      targetItemIds: overdueIds,
    });
  }

  // Inspect active flashcard resume activity if available
  const activeFlashcardResume = Object.values(input.resumeActivities || {}).find(
    (a): a is FlashcardResumableActivity =>
      Boolean(a && a.type === 'flashcard' && !a.completed && !isActivityStale(a, nowMs))
  );

  // Task: Due Today SRS Reviews (With Heavy Day Chunking and Continuity Deduplication)
  if (dueTodayCount > 0 || (activeFlashcardResume && overdueCount === 0)) {
    const isCompleted = (todayProgress.wordsReviewed ?? 0) >= totalDueCount && totalDueCount > 0;
    const algoLabel = algorithm === 'fsrs' ? 'FSRS-4.5' : 'SM-2';

    if (activeFlashcardResume) {
      const reviewedCount = activeFlashcardResume.checkpoint.reviewedCount || 0;
      const totalInSession = activeFlashcardResume.checkpoint.totalCards || (dueTodayCount > 0 ? dueTodayCount : 10);
      const remainingInSession = Math.max(1, totalInSession - reviewedCount);
      const estMins = calculateTaskEstimatedMinutes('srs_review', remainingInSession);

      rawItems.push({
        id: `srs-due-${dateStr}`,
        type: 'srs_review',
        title: `Tiếp tục phiên Flashcard (${reviewedCount}/${totalInSession} thẻ)`,
        description: `Bạn đang ôn tập dở phiên Flashcard (${reviewedCount}/${totalInSession} thẻ đã học). Tiếp tục để củng cố trí nhớ dài hạn.`,
        count: remainingInSession,
        estimatedMinutes: estMins,
        timeBucket: formatStudyTimeBucket(estMins),
        priority: overdueCount > 0 ? 2 : 1,
        priorityScore: 92,
        tier: 'essential',
        reason: 'Tiếp tục phiên học đang dở để củng cố trí nhớ tối ưu mà không bị gián đoạn.',
        action: {
          tab: 'flashcards',
          subTab: 'all',
          params: {
            queueMode: activeFlashcardResume.checkpoint.queueMode || 'DUE',
            filterTag: activeFlashcardResume.checkpoint.filterTag || 'ALL',
            itemIds: activeFlashcardResume.checkpoint.orderedCardIds || dueTodayIds,
          },
          description: 'Tiếp tục phiên ôn tập Flashcard',
        },
        completed: false,
        totalDueCount: totalInSession,
        targetItemIds: activeFlashcardResume.checkpoint.orderedCardIds || dueTodayIds,
      });
    } else if (isHeavyWorkload) {
      // Heavy Day Chunking: 30 reviews per session
      const chunkCount = Math.min(SESSION_SRS_CHUNK_SIZE, dueTodayCount);
      const remainingBacklog = dueTodayCount - chunkCount;
      const chunkEstMins = calculateTaskEstimatedMinutes('srs_review', chunkCount);
      const chunkItemIds = dueTodayIds.slice(0, chunkCount);

      rawItems.push({
        id: `srs-due-${dateStr}`,
        type: 'srs_review',
        title: `Ôn tập ${chunkCount} / ${dueTodayCount} thẻ Flashcard đến hạn`,
        description: `Ưu tiên hôm nay: ${chunkCount} reviews · ~${chunkEstMins} phút (Còn ${remainingBacklog} thẻ đến hạn).`,
        count: chunkCount,
        estimatedMinutes: chunkEstMins,
        timeBucket: formatStudyTimeBucket(chunkEstMins),
        priority: overdueCount > 0 ? 2 : 1,
        priorityScore: 90,
        tier: 'essential',
        reason: `Chia nhỏ phiên học ${chunkCount} thẻ để tập trung củng cố trí nhớ, tránh quá tải khi khối lượng ôn tập lớn.`,
        action: {
          tab: 'flashcards',
          subTab: 'all',
          params: { queueMode: 'DUE', batchSize: chunkCount, itemIds: chunkItemIds },
          description: `Bắt đầu phiên ôn tập ${chunkCount} thẻ`,
        },
        completed: isCompleted, // STRICT: Only true when total due reviews are actually done!
        sessionChunkCount: chunkCount,
        remainingDueCount: remainingBacklog,
        totalDueCount: dueTodayCount,
        targetItemIds: chunkItemIds,
      });
    } else {
      const estMins = calculateTaskEstimatedMinutes('srs_review', dueTodayCount);
      rawItems.push({
        id: `srs-due-${dateStr}`,
        type: 'srs_review',
        title: `Ôn tập ${dueTodayCount} thẻ Flashcard đến hạn`,
        description: `Thuật toán ${algoLabel} đã căn giờ tối ưu cho ${dueTodayCount} thẻ để củng cố trí nhớ dài hạn của bạn.`,
        count: dueTodayCount,
        estimatedMinutes: estMins,
        timeBucket: formatStudyTimeBucket(estMins),
        priority: overdueCount > 0 ? 2 : 1,
        priorityScore: 90,
        tier: 'essential',
        reason: `Đến hạn chu kỳ giãn cách ${algoLabel} trong ngày hôm nay để củng cố trí nhớ dài hạn.`,
        action: {
          tab: 'flashcards',
          subTab: 'all',
          params: { queueMode: 'DUE', itemIds: dueTodayIds },
          description: 'Bắt đầu phiên ôn tập đến hạn',
        },
        completed: isCompleted,
        totalDueCount: dueTodayCount,
        targetItemIds: dueTodayIds,
      });
    }
  }

  // Task: Relearning Items (Lapsed Cards)
  if (relearningCount > 0) {
    const isCompleted = (todayProgress.wordsReviewed ?? 0) >= relearningCount;
    const estMins = calculateTaskEstimatedMinutes('srs_relearning', relearningCount);

    rawItems.push({
      id: `srs-relearning-${dateStr}`,
      type: 'srs_relearning',
      title: `Củng cố ${relearningCount} từ vựng vừa quên (Relearning)`,
      description: `Các từ bị chọn "Again" trong các phiên gần đây cần được nạp lại tức thì trong ngày để kích hoạt lại trí nhớ.`,
      count: relearningCount,
      estimatedMinutes: estMins,
      timeBucket: formatStudyTimeBucket(estMins),
      priority: overdueCount > 0 ? 3 : 2,
      priorityScore: 95,
      tier: 'essential',
      reason: 'Bạn đã bấm "Again" gần đây — nạp lại ngay trong ngày để kích hoạt lại trí nhớ.',
      action: {
        tab: 'flashcards',
        subTab: 'all',
        params: { queueMode: 'DUE', itemIds: relearningIds },
        description: 'Ôn củng cố các từ vừa quên',
      },
      completed: isCompleted,
      targetItemIds: relearningIds,
    });
  }

  // =========================================================================
  // 2. LEECH DETECTION (Frequent Forgetters)
  // =========================================================================
  const leechIds: string[] = [];
  for (const [id, progress] of Object.entries(srsMap)) {
    if (!progress) continue;
    const againCount = progress.againCount ?? 0;
    const lapses = progress.fsrs?.lapses ?? 0;
    if (againCount < 2 && lapses < 2) continue;

    const analysis = analyzeCardLeechStatus({
      reps: progress.reviewCount ?? progress.fsrs?.reps,
      lapses,
      difficulty: progress.fsrs?.difficulty,
      againCount,
      reviewCount: progress.reviewCount,
      fsrs: progress.fsrs,
    });
    if (analysis.isLeech) {
      leechIds.push(id);
    }
  }

  const leechCount = leechIds.length;
  if (leechCount > 0) {
    const isCompleted = (todayProgress.wordsReviewed ?? 0) >= leechCount && totalDueCount === 0;
    const estMins = calculateTaskEstimatedMinutes('leech_recovery', leechCount);

    rawItems.push({
      id: `leech-recovery-${dateStr}`,
      type: 'leech_recovery',
      title: `Xử lý ${leechCount} từ vựng Leech (bẫy quên dai dẳng)`,
      description: `Có ${leechCount} từ vựng bị quên nhiều lần cần phương pháp củng cố chuyên sâu để nhớ lâu hơn.`,
      count: leechCount,
      estimatedMinutes: estMins,
      timeBucket: formatStudyTimeBucket(estMins),
      priority: 4,
      priorityScore: 80,
      tier: 'recommended',
      reason: 'Từ vựng bạn hay quên nhiều lần — củng cố chuyên sâu để vượt qua bẫy nhớ dai dẳng.',
      action: {
        tab: 'flashcards',
        subTab: 'all',
        params: { queueMode: 'DUE', itemIds: leechIds },
        description: 'Khắc phục các từ vựng Leech',
      },
      completed: isCompleted,
      targetItemIds: leechIds,
    });
  }

  // =========================================================================
  // 3. UNRESOLVED MISTAKE BANK (Trap Words)
  // =========================================================================
  const allUnresolvedMistakes = Object.values(mistakes).filter(
    (m) => m && !m.resolved && m.word && m.word.trim().length > 0
  );
  const generalUnresolvedMistakes = allUnresolvedMistakes.filter(
    (m) => m.primaryType !== 'pronunciation'
  );
  const mistakeWords = generalUnresolvedMistakes.map((m) => m.word.trim().toLowerCase());

  if (generalUnresolvedMistakes.length > 0) {
    const count = generalUnresolvedMistakes.length;
    const estMins = calculateTaskEstimatedMinutes('mistake_practice', count);
    const isCompleted = generalUnresolvedMistakes.length === 0;

    rawItems.push({
      id: `mistakes-${dateStr}`,
      type: 'mistake_practice',
      title: `Khắc phục ${count} lỗi sai trong Sổ Bẫy Lỗi`,
      description: `Ôn đúng 2 lần liên tiếp để xóa bỏ bẫy lỗi và lấy trọn điểm kinh nghiệm.`,
      count,
      estimatedMinutes: estMins,
      timeBucket: formatStudyTimeBucket(estMins),
      priority: 5,
      priorityScore: 75,
      tier: 'recommended',
      reason: 'Khắc phục bẫy lỗi vừa gặp để ghi nhớ chính xác và tránh lặp lại sai sót.',
      action: {
        tab: 'mistakes',
        description: 'Mở Sổ Bẫy Lỗi để luyện tập',
      },
      completed: isCompleted,
      targetItemIds: mistakeWords,
    });
  }

  // =========================================================================
  // 3b. WEAK COLLOCATIONS (Evidence-based collocation weakness)
  // =========================================================================
  const weakCollocSet = new Set<string>();

  // 1. From unresolved mistakeBank with primaryType or tag 'collocation'
  for (const m of allUnresolvedMistakes) {
    if (m.primaryType === 'collocation') {
      if (m.word && m.word.trim()) {
        weakCollocSet.add(m.word.trim().toLowerCase());
      }
    }
  }

  // 2. From userCollocations with lapses or reset srsLevel
  if (Array.isArray(input.userCollocations)) {
    for (const c of input.userCollocations) {
      if (!c || !c.phrase) continue;
      const key = c.phrase.trim().toLowerCase();
      const progress = srsMap[c.id] || srsMap[key];
      if (progress) {
        const lapses = (progress.againCount ?? 0) + (progress.fsrs?.lapses ?? 0);
        const isLapsed = progress.srsLevel === 0 && Boolean(progress.lastReviewedDate);
        if (lapses >= 2 || isLapsed) {
          weakCollocSet.add(key);
        }
      }
    }
  }

  const weakCollocArr = Array.from(weakCollocSet);
  const weakCollocCount = weakCollocArr.length;
  if (weakCollocCount > 0) {
    const estMins = calculateTaskEstimatedMinutes('weak_collocation', weakCollocCount);
    rawItems.push({
      id: `weak-collocation-${dateStr}`,
      type: 'weak_collocation',
      title: `Củng cố ${weakCollocCount} cụm từ Collocation yếu`,
      description: `Có ${weakCollocCount} cụm từ cần ôn tập do ghi nhận bẫy lỗi hoặc có lịch sử quên trong Flashcard.`,
      count: weakCollocCount,
      estimatedMinutes: estMins,
      timeBucket: formatStudyTimeBucket(estMins),
      priority: 6,
      priorityScore: 72,
      tier: 'recommended',
      reason: 'Rèn luyện các cụm từ dễ nhầm lẫn theo ngữ cảnh thực tế để tăng phản xạ tự nhiên.',
      action: {
        tab: 'flashcards',
        subTab: 'all',
        params: { queueMode: 'DUE', filterTag: 'collocation', itemIds: weakCollocArr },
        description: 'Ôn tập cụm từ yếu',
      },
      completed: false,
      targetItemIds: weakCollocArr,
    });
  }

  // =========================================================================
  // 4. PRONUNCIATION WEAKNESS QUEUE (Actual Evidence)
  // =========================================================================
  const pronQueue = getPronunciationPracticeQueue(mistakes, {
    vocabularyList: input.vocabularyList,
    now: nowMs,
  });

  if (pronQueue.length > 0) {
    const count = pronQueue.length;
    const isCompleted = (todayProgress.pronunciationsMastered ?? 0) >= count;
    const estMins = calculateTaskEstimatedMinutes('pronunciation_practice', count);
    const pronWords = pronQueue.map((w) => (w.word || w.id).trim().toLowerCase());

    rawItems.push({
      id: `pronunciation-${dateStr}`,
      type: 'pronunciation_practice',
      title: `Luyện phát âm ${count} từ chưa đạt chuẩn`,
      description: `Thực hành phát âm với AI cho các từ từng đạt dưới ${PRONUNCIATION_FAIL_THRESHOLD}% độ chính xác.`,
      count,
      estimatedMinutes: estMins,
      timeBucket: formatStudyTimeBucket(estMins),
      priority: 6,
      priorityScore: 70,
      tier: 'recommended',
      reason: 'Luyện phát âm với AI cho các từ từng chưa đạt chuẩn để nói tự tin và chuẩn bản xứ.',
      action: {
        tab: 'pronunciation',
        subTab: 'ai_speech',
        params: { itemIds: pronWords },
        description: 'Luyện phát âm AI chuẩn bản xứ',
      },
      completed: isCompleted,
      targetItemIds: pronWords,
    });
  }

  // =========================================================================
  // 5. FOUR SKILLS: SKILL DEFICIT (Weakest Assessed Skill)
  // =========================================================================
  const skillsList: Array<{ skill: 'listening' | 'reading' | 'speaking' | 'writing'; label: string }> = [
    { skill: 'listening', label: 'Nghe hiểu' },
    { skill: 'reading', label: 'Đọc hiểu' },
    { skill: 'speaking', label: 'Nói phản xạ' },
    { skill: 'writing', label: 'Viết luận' },
  ];

  const evaluatedSkills = skillsList.map((item) => {
    const evList = input.fourSkillsEvidence?.[item.skill] ?? [];
    if (evList.length > 0) {
      const v2 = evaluateSkillCompetencyV2(item.skill, evList, { now: nowMs });
      return {
        ...item,
        score: v2.score,
        level: v2.level,
        totalAttempts: v2.evidenceCount,
        isAssessed: true,
      };
    }
    const rawScores = input.fourSkillsScores?.[item.skill] ?? [];
    const validScores = Array.isArray(rawScores)
      ? rawScores.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0)
      : [];
    if (validScores.length > 0) {
      const legacyEv = adaptLegacyScoresToEvidence(item.skill, validScores);
      const v2 = evaluateSkillCompetencyV2(item.skill, legacyEv, { now: nowMs });
      return {
        ...item,
        score: v2.score,
        level: v2.level,
        totalAttempts: v2.evidenceCount,
        isAssessed: true,
      };
    }
    return {
      ...item,
      score: 0,
      level: 'A1' as const,
      totalAttempts: 0,
      isAssessed: false,
    };
  });

  const assessedSkills = evaluatedSkills.filter((item) => item.isAssessed && item.totalAttempts > 0);

  let weakSkillItem: (typeof assessedSkills)[number] | null = null;
  if (assessedSkills.length > 0) {
    assessedSkills.sort((a, b) => a.score - b.score);
    const lowest = assessedSkills[0];
    if (lowest.score < 70 || assessedSkills.length >= 2) {
      weakSkillItem = lowest;
    }
  }

  if (weakSkillItem) {
    const skillEvList = input.fourSkillsEvidence?.[weakSkillItem.skill] ?? [];
    const hasEvidenceToday = skillEvList.some((ev) => {
      if (!ev.createdAt) return false;
      const evDate = new Date(ev.createdAt).toISOString().split('T')[0];
      return evDate === dateStr;
    });

    rawItems.push({
      id: `weak-skill-${weakSkillItem.skill}-${dateStr}`,
      type: 'weak_skill_practice',
      title: `Cải thiện kỹ năng ${weakSkillItem.label} (Điểm: ${weakSkillItem.score}%)`,
      description: `Kỹ năng ${weakSkillItem.label} đang có điểm đánh giá thấp nhất (${weakSkillItem.score}%, cấp độ ${weakSkillItem.level}). Tập trung hoàn thành bài học để nâng band CEFR.`,
      estimatedMinutes: 8,
      timeBucket: formatStudyTimeBucket(8),
      priority: 7,
      priorityScore: 60,
      tier: 'recommended',
      reason: `Đây là kỹ năng cần ưu tiên cải thiện tiếp theo để phát triển cân bằng 4 kỹ năng.`,
      action: {
        tab: 'four_skills',
        subTab: weakSkillItem.skill,
        description: `Luyện tập kỹ năng ${weakSkillItem.label}`,
      },
      completed: hasEvidenceToday,
      targetLessonId: weakSkillItem.skill,
    });
  }

  // =========================================================================
  // 5b. CEFR CHECKPOINT TASKS (Reinforcement & Readiness - Phase 10)
  // =========================================================================
  const checkpointHistory = input.checkpointHistory || [];
  const levelCertifications = input.levelCertifications || {};

  // Case 1: Reinforcement after a failed checkpoint attempt
  if (checkpointHistory.length > 0) {
    const latestAttempt = checkpointHistory[0]; // Newest first
    if (!latestAttempt.isPassed) {
      const level = latestAttempt.level;
      const scores = latestAttempt.scores;
      const skills: CefrSkill[] = ['listening', 'reading', 'speaking', 'writing'];
      const sortedSkills = [...skills].sort((a, b) => (scores[a] ?? 0) - (scores[b] ?? 0));
      const weakestSkill = sortedSkills[0];
      const weakScore = scores[weakestSkill] ?? 0;

      // Completion SSOT: Learner passed retake or has new evidence for this skill since attempt date
      const isCompleted =
        Boolean(levelCertifications[level]) ||
        (input.fourSkillsEvidence?.[weakestSkill] ?? []).some(
          (ev) => (ev.createdAt ?? 0) > latestAttempt.date
        );

      rawItems.push({
        id: `checkpoint-reinforce-${level}-${weakestSkill}-${dateStr}`,
        type: 'checkpoint_reinforcement',
        title: `Củng cố ${getSkillNameVi(weakestSkill)} ${level} trước khi thử lại`,
        description: `Bài kiểm định CEFR ${level} gần nhất chưa đạt ở kỹ năng ${getSkillNameVi(weakestSkill)} (${weakScore}%). Ôn tập thêm để sẵn sàng thi lại.`,
        estimatedMinutes: 10,
        timeBucket: '~10 phút',
        priority: 6,
        priorityScore: 78,
        tier: 'essential',
        reason: `Kỹ năng ${getSkillNameVi(weakestSkill)} cần được củng cố dựa trên kết quả kiểm định CEFR ${level}.`,
        action: {
          tab: 'four_skills',
          subTab: weakestSkill,
          params: { cefrLevel: level },
          description: `Luyện tập kỹ năng ${getSkillNameVi(weakestSkill)} ${level}`,
        },
        completed: isCompleted,
      });
    }
  }

  // Case 2: Readiness for a new CEFR level checkpoint
  for (const lvl of CEFR_LEVELS_ORDER) {
    if (!levelCertifications[lvl]) {
      const readiness = evaluateLevelReadiness(lvl, {
        certifications: levelCertifications,
        competencyEvidenceStore: input.fourSkillsEvidence,
        completedLessonIdsBySkill: {
          listening: input.completedListeningLessonIds,
          reading: input.completedReadingLessonIds ?? input.fourSkillsCompletionProgress?.reading,
          speaking: input.completedSpeakingPromptIds ?? input.fourSkillsCompletionProgress?.speaking,
          writing: input.completedWritingPromptIds ?? input.fourSkillsCompletionProgress?.writing,
        },
        nowMs,
      });

      if (readiness.isReadyForCheckpoint) {
        rawItems.push({
          id: `checkpoint-ready-${lvl}-${dateStr}`,
          type: 'checkpoint_readiness',
          title: `Kiểm Định Năng Lực CEFR ${lvl}`,
          description: `Bạn đã tích luỹ đủ bằng chứng 4 kỹ năng cấp độ ${lvl}. Hãy thực hiện bài kiểm định chính thức để nhận chứng chỉ!`,
          estimatedMinutes: 20,
          timeBucket: '~20 phút',
          priority: 7,
          priorityScore: 72,
          tier: 'recommended',
          reason: `Đã đủ điều kiện làm bài kiểm định CEFR ${lvl}.`,
          action: {
            tab: 'four_skills',
            params: { openCheckpointLevel: lvl },
            description: `Bắt đầu bài kiểm định CEFR ${lvl}`,
          },
          completed: Boolean(levelCertifications[lvl]),
        });
        break; // Only suggest next ready level
      }
    }
  }

  // =========================================================================
  // 6. FOUR SKILLS: NEXT UNLEARNED CURRICULUM LESSON
  // =========================================================================
  const completedListenIds = input.completedListeningLessonIds ?? [];
  const completedReadIds = input.completedReadingLessonIds ?? input.fourSkillsCompletionProgress?.reading ?? [];
  const completedSpeakIds = input.completedSpeakingPromptIds ?? input.fourSkillsCompletionProgress?.speaking ?? [];
  const completedWriteIds = input.completedWritingPromptIds ?? input.fourSkillsCompletionProgress?.writing ?? [];

  // When workload is already very heavy, avoid packing extra full-length lessons
  if (!isHeavyWorkload || rawItems.length < 3) {
    const cefrInfo = deriveLearnerCefrLevel(input.fourSkillsScores);
    const targetCefr = cefrInfo.learnerLevel ?? 'A1';

    const candidateListeningLessons = LISTENING_LESSONS.filter(
      (l) => l.level === targetCefr || (targetCefr === 'A1' && l.level === 'A1')
    );
    const nextListeningLesson = candidateListeningLessons.find(
      (l) => !completedListenIds.includes(l.id)
    );

    const candidateReadingLessons = READING_LESSONS.filter(
      (r) => r.level === targetCefr || (targetCefr === 'A1' && r.level === 'A1')
    );
    const nextReadingLesson = candidateReadingLessons.find(
      (r) => !completedReadIds.includes(r.id)
    ) ?? READING_LESSONS.find((r) => !completedReadIds.includes(r.id));

    if (nextListeningLesson) {
      const isCompleted = completedListenIds.includes(nextListeningLesson.id);
      const estMins = calculateTaskEstimatedMinutes('skill_lesson', 1, { duration: nextListeningLesson.duration });

      rawItems.push({
        id: `skill-listening-${nextListeningLesson.id}-${dateStr}`,
        type: 'skill_lesson',
        title: `Bài Nghe ${nextListeningLesson.level}: ${nextListeningLesson.title}`,
        description: `Luyện nghe hiểu chủ đề ${nextListeningLesson.category} (${nextListeningLesson.duration}) để rèn phản xạ từ vựng ngữ cảnh.`,
        estimatedMinutes: estMins,
        timeBucket: formatStudyTimeBucket(estMins),
        priority: 8,
        priorityScore: 50,
        tier: 'recommended',
        reason: `Bài học tiếp theo trong lộ trình Four Skills phù hợp với trình độ của bạn.`,
        action: {
          tab: 'four_skills',
          subTab: 'listening',
          params: { lessonId: nextListeningLesson.id },
          description: `Mở bài nghe: ${nextListeningLesson.title}`,
        },
        completed: isCompleted,
        targetLessonId: nextListeningLesson.id,
      });
    } else {
      if (nextReadingLesson) {
        const isCompleted = completedReadIds.includes(nextReadingLesson.id);
        const estMins = calculateTaskEstimatedMinutes('skill_lesson', 1, { readTime: nextReadingLesson.readTime });

        const activeReadingResume = Object.values(input.resumeActivities || {}).find(
          (a): a is ReadingResumableActivity =>
            Boolean(a && a.type === 'reading' && !a.completed && !isActivityStale(a, nowMs))
        );
        const isResumeTarget = Boolean(activeReadingResume && activeReadingResume.checkpoint.lessonId === nextReadingLesson.id);
        const readTitle = isResumeTarget
          ? `Tiếp tục bài Đọc ${nextReadingLesson.level}: ${nextReadingLesson.title} (${activeReadingResume?.checkpoint.progressPercent || 0}%)`
          : `Bài Đọc ${nextReadingLesson.level}: ${nextReadingLesson.title}`;
        const readDesc = isResumeTarget
          ? `Bạn đang đọc dở bài này (${activeReadingResume?.checkpoint.progressPercent || 0}% hoàn thành). Tiếp tục để củng cố kỹ năng đọc hiểu.`
          : `Đọc hiểu tương tác chủ đề ${nextReadingLesson.category} (${nextReadingLesson.readTime}) và trích xuất từ vựng mới.`;
        const readPrioScore = isResumeTarget ? 55 : 50;

        rawItems.push({
          id: `skill-reading-${nextReadingLesson.id}-${dateStr}`,
          type: 'skill_lesson',
          title: readTitle,
          description: readDesc,
          estimatedMinutes: estMins,
          timeBucket: formatStudyTimeBucket(estMins),
          priority: 8,
          priorityScore: readPrioScore,
          tier: 'recommended',
          reason: isResumeTarget
            ? 'Tiếp tục bài đọc đang dở để hoàn thành bài học và củng cố phản xạ đọc hiểu.'
            : `Mở rộng khả năng đọc hiểu tương tác và trích xuất từ vựng mới.`,
          action: {
            tab: 'four_skills',
            subTab: 'reading',
            params: { lessonId: nextReadingLesson.id },
            description: `Mở bài đọc: ${nextReadingLesson.title}`,
          },
          completed: isCompleted,
          targetLessonId: nextReadingLesson.id,
        });
      } else {
        const nextSpeakingPrompt = SPEAKING_PROMPTS.find((s) => !completedSpeakIds.includes(s.id));
        if (nextSpeakingPrompt) {
          const isCompleted = completedSpeakIds.includes(nextSpeakingPrompt.id);
          rawItems.push({
            id: `skill-speaking-${nextSpeakingPrompt.id}-${dateStr}`,
            type: 'skill_lesson',
            title: `Luyện Nói ${nextSpeakingPrompt.level}: ${nextSpeakingPrompt.title}`,
            description: `Thực hành giao tiếp phản xạ chủ đề ${nextSpeakingPrompt.category} với trợ lý AI.`,
            estimatedMinutes: 6,
            timeBucket: formatStudyTimeBucket(6),
            priority: 8,
            priorityScore: 50,
            tier: 'recommended',
            reason: `Bài luyện nói kế tiếp trong lộ trình Four Skills phù hợp với trình độ của bạn.`,
            action: {
              tab: 'four_skills',
              subTab: 'speaking',
              params: { promptId: nextSpeakingPrompt.id },
              description: `Mở bài nói: ${nextSpeakingPrompt.title}`,
            },
            completed: isCompleted,
            targetLessonId: nextSpeakingPrompt.id,
          });
        }
      }
    }

    // General curriculum Speaking practice fallback if no priority tasks exist
    if (totalDueCount === 0 && allUnresolvedMistakes.length === 0 && leechCount === 0) {
      const candidateSpeakingPrompt = SPEAKING_PROMPTS.find(
        (s) => (s.level === targetCefr || s.level === 'A1') && !completedSpeakIds.includes(s.id)
      ) ?? SPEAKING_PROMPTS[0];

      if (candidateSpeakingPrompt && !rawItems.some((i) => i.id.startsWith('skill-speaking-'))) {
        const isCompleted = completedSpeakIds.includes(candidateSpeakingPrompt.id);
        rawItems.push({
          id: `speaking-fallback-${candidateSpeakingPrompt.id}-${dateStr}`,
          type: 'skill_lesson',
          title: `Luyện Nói phản xạ: ${candidateSpeakingPrompt.title}`,
          description: `Thực hành hội thoại nhập vai chủ đề ${candidateSpeakingPrompt.category} để duy trì phản xạ phát âm.`,
          estimatedMinutes: 5,
          timeBucket: formatStudyTimeBucket(5),
          priority: 9,
          priorityScore: 35,
          tier: 'optional',
          reason: 'Luyện tập giao tiếp theo giáo trình chuẩn CEFR (Đề xuất lộ trình tổng quát).',
          action: {
            tab: 'four_skills',
            subTab: 'speaking',
            params: { promptId: candidateSpeakingPrompt.id },
            description: `Mở bài nói: ${candidateSpeakingPrompt.title}`,
          },
          completed: isCompleted,
          targetLessonId: candidateSpeakingPrompt.id,
        });
      }
    }
  }

  // =========================================================================
  // 7. DAILY NEW WORDS GOAL (Workload Aware)
  // =========================================================================
  const learnedToday = todayProgress.newWordsLearned ?? 0;
  const isNewWordsCompleted = learnedToday >= targetNewWords;
  const remainingNewWords = Math.max(0, targetNewWords - learnedToday);

  if (targetNewWords > 0) {
    // If heavy review workload, tag as optional to prevent cognitive overload
    const newWordsTier: LearningPlanTier = isHeavyWorkload
      ? 'optional'
      : totalDueCount === 0
      ? 'essential'
      : 'optional';

    const estMins = calculateTaskEstimatedMinutes('new_words', isNewWordsCompleted ? targetNewWords : remainingNewWords);

    rawItems.push({
      id: `new-words-${dateStr}`,
      type: 'new_words',
      title: isNewWordsCompleted
        ? `Đã hoàn thành mục tiêu ${targetNewWords} từ mới hôm nay`
        : `Học ${remainingNewWords} từ mới theo mục tiêu ngày`,
      description: isNewWordsCompleted
        ? `Bạn đã nạp thành công ${learnedToday} từ mới vào hệ thống Spaced Repetition hôm nay.`
        : isHeavyWorkload
        ? `Tùy chọn: nạp thêm ${remainingNewWords} từ mới (ưu tiên hoàn thành ${totalDueCount} thẻ ôn tập trước).`
        : `Nạp thêm ${remainingNewWords} từ mới để mở rộng kho từ vựng cá nhân (Đã học: ${learnedToday}/${targetNewWords}).`,
      count: isNewWordsCompleted ? learnedToday : remainingNewWords,
      estimatedMinutes: estMins,
      timeBucket: formatStudyTimeBucket(estMins),
      priority: totalDueCount === 0 ? 2 : 9,
      priorityScore: 30,
      tier: newWordsTier,
      reason: 'Duy trì đà mở rộng vốn từ vựng theo mục tiêu học tập hàng ngày.',
      action: {
        tab: 'vocabulary',
        description: 'Mở kho từ vựng để học từ mới',
      },
      completed: isNewWordsCompleted,
    });
  }

  // =========================================================================
  // 8. PLAN STATES & DEDUPLICATION (TOP 2 - 4 ACTIONS)
  // =========================================================================
  const isNewUser =
    inspectedIds.size === 0 &&
    allUnresolvedMistakes.length === 0 &&
    completedListenIds.length === 0 &&
    completedReadIds.length === 0 &&
    completedSpeakIds.length === 0 &&
    (todayProgress.wordsReviewed ?? 0) === 0 &&
    (todayProgress.newWordsLearned ?? 0) === 0;

  const isCompletedDay =
    !isNewUser &&
    (totalDueCount === 0 || (todayProgress.wordsReviewed ?? 0) >= totalDueCount) &&
    allUnresolvedMistakes.length === 0 &&
    ((todayProgress.wordsReviewed ?? 0) > 0 ||
      (todayProgress.quizzesCompleted ?? 0) > 0 ||
      (todayProgress.newWordsLearned ?? 0) > 0 ||
      (todayProgress.pronunciationsMastered ?? 0) > 0 ||
      (rawItems.length > 0 && rawItems.every((i) => i.completed)));

  let planState: TodayPlanState = 'normal';
  let stateMessage: string | undefined;

  if (isNewUser) {
    planState = 'new_user';
    stateMessage = 'Chào mừng bạn! Hãy hoàn thành các nhiệm vụ khởi động bên dưới để bắt đầu lộ trình.';
  } else if (isCompletedDay) {
    planState = 'completed_day';
    stateMessage = 'Kế hoạch chính hôm nay đã hoàn thành 🎉';
  } else if (isHeavyWorkload) {
    planState = 'heavy_workload';
    stateMessage = 'Khối lượng ôn tập hôm nay lớn — hệ thống đã chia nhỏ phiên để bạn học hiệu quả mà không bị quá tải.';
  }

  // Deduplicate and cap to top 2-4 actions
  const items = deduplicateLearningActions(rawItems, 4);

  const totalTasks = items.length;
  const completedTasks = items.filter((item) => item.completed).length;
  const progress = isCompletedDay
    ? 100
    : totalTasks > 0
    ? Math.round((completedTasks / totalTasks) * 100)
    : 100;
  const totalEstimatedMinutes = items.reduce((sum, item) => sum + (item.estimatedMinutes || 0), 0);

  const essentialTasksCount = items.filter((i) => i.tier === 'essential' || i.tier === 'urgent').length;
  const recommendedTasksCount = items.filter((i) => i.tier === 'recommended' || i.tier === 'core').length;
  const optionalTasksCount = items.filter((i) => i.tier === 'optional').length;

  return {
    date: dateStr,
    items,
    totalEstimatedMinutes,
    totalTasks,
    completedTasks,
    progress,
    planState,
    stateMessage,
    isHeavyDay: isHeavyWorkload,
    essentialTasksCount,
    recommendedTasksCount,
    optionalTasksCount,
    totalDueCount: isHeavyWorkload ? totalDueCount : undefined,
    remainingDueCount: isHeavyWorkload ? totalDueCount - Math.min(SESSION_SRS_CHUNK_SIZE, dueTodayCount) : undefined,
    sessionChunkCount: isHeavyWorkload ? Math.min(SESSION_SRS_CHUNK_SIZE, dueTodayCount) : undefined,
    workloadBand: isHeavyWorkload ? 'heavy' : totalDueCount > 0 ? 'normal' : 'light',
  };
}

// =========================================================================
// ACTION DISPATCHER & CROSS-MODULE ROUTING
// =========================================================================

export interface ActionDispatcherStore {
  navigateToTab?: (tab: ActiveTab) => void;
  startAdaptivePractice?: (config: {
    module: PracticeModuleId;
    itemIds: string[];
    mistakeType?: any;
    startedAt?: number;
    planItemId?: string;
    planTitle?: string;
    planObjective?: string;
    estimatedMinutes?: number;
  }) => void;
  setActiveFourSkill?: (skill: 'listening' | 'reading' | 'speaking' | 'writing') => void;
}

/**
 * Pure dispatcher: Executes cross-module CTA routing cleanly without side effects.
 * Never mutates scheduler, lapses, or due dates.
 */
export function executeLearningPlanAction(
  action: LearningPlanAction,
  store: ActionDispatcherStore
): void {
  if (!action || !action.tab) return;

  switch (action.tab) {
    case 'flashcards':
      if (action.params?.queueMode === 'DUE') {
        store.startAdaptivePractice?.({
          module: 'flashcard',
          itemIds: action.params?.itemIds ?? [],
          mistakeType: action.params?.filterTag === 'collocation' ? 'collocation' : undefined,
        });
      }
      store.navigateToTab?.('flashcards');
      break;

    case 'four_skills': {
      const subSkill = action.subTab as 'listening' | 'reading' | 'speaking' | 'writing' | undefined;
      if (subSkill) {
        store.setActiveFourSkill?.(subSkill);
      }

      if (action.params?.lessonId && subSkill) {
        store.startAdaptivePractice?.({
          module: subSkill as PracticeModuleId,
          itemIds: [action.params.lessonId],
        });
      } else if (action.params?.promptId && subSkill) {
        store.startAdaptivePractice?.({
          module: subSkill as PracticeModuleId,
          itemIds: [action.params.promptId],
        });
      }

      store.navigateToTab?.('four_skills');
      break;
    }

    case 'mistakes':
      store.navigateToTab?.('mistakes');
      break;

    case 'pronunciation':
      if (action.params?.itemIds && action.params.itemIds.length > 0) {
        store.startAdaptivePractice?.({
          module: 'pronunciation',
          itemIds: action.params.itemIds,
        });
      }
      store.navigateToTab?.('pronunciation');
      break;

    case 'vocabulary':
      store.navigateToTab?.('vocabulary');
      break;

    default:
      store.navigateToTab?.(action.tab);
      break;
  }
}

/**
 * Convenience store adapter: Derives the Today Learning Plan directly from Zustand store state.
 * Read-only, zero side-effects.
 */
export function deriveTodayLearningPlanFromStore(
  storeState: Partial<AppStore>,
  options?: { now?: number; date?: string; targetMinutes?: number }
): TodayLearningPlan {
  return generateTodayLearningPlan({
    date: options?.date,
    now: options?.now,
    vocabularyList: storeState.vocabularyList,
    userCollocations: storeState.userCollocations,
    srsProgressMap: storeState.srsProgressMap,
    mistakeBank: storeState.mistakeBank,
    fourSkillsScores: storeState.fourSkillsScores,
    fourSkillsEvidence: storeState.fourSkillsEvidence,
    completedListeningLessonIds: storeState.completedListeningLessonIds,
    fourSkillsCompletionProgress: storeState.fourSkillsCompletionProgress,
    completedReadingLessonIds: storeState.fourSkillsCompletionProgress?.reading,
    completedSpeakingPromptIds: storeState.fourSkillsCompletionProgress?.speaking,
    completedWritingPromptIds: storeState.fourSkillsCompletionProgress?.writing,
    dailyHistory: storeState.dailyHistory,
    recentReviewEvents: storeState.recentReviewEvents,
    profile: storeState.profile,
    srsAlgorithm: storeState.srsAlgorithm,
    fsrsSettings: storeState.fsrsSettings,
    targetMinutes: options?.targetMinutes,
  });
}
