// src/services/learningJourneyService.ts
/**
 * Four Skills Learning Journey Service
 * Pure, type-safe derivation layer for the CEFR A1 -> C2 Learning Journey.
 *
 * Architectural Invariants:
 * - Pure derivation: ZERO direct mutation of Zustand store, datasets, or schedules.
 * - Single Source of Truth: Reads completion from `completedListeningLessonIds` and
 *   `fourSkillsCompletionProgress` ({ reading, speaking, writing }).
 * - Dynamic totals: Lesson counts are derived dynamically from current datasets, never hard-coded.
 * - Backward compatibility: Handles legacy or unknown IDs gracefully without inflating denominators.
 * - Status semantics: All levels are 'available' (no strict lock); 'in_progress' when active/partially done;
 *   'completed' only when 100% of dataset lessons in the CEFR band are completed.
 * - Zero fake mastery: 'mastered' is disabled in Phase 1 due to lack of per-level mastery evidence.
 */

import type {
  CEFRLevel,
  FourSkillsCompletionProgress,
  FourSkillsEvidenceStore,
  FourSkillsScores,
  SkillCompetency,
} from '../types';
import type {
  LevelCertificationStore,
  CheckpointHistoryEntry,
  PersistedLevelCertification,
} from '../types/levelCertification';
import {
  deriveHighestCertifiedLevel,
  evaluateLevelReadiness,
  canRetakeCheckpointLevel,
  getCheckpointHistoryForLevel,
} from './levelCertificationService';
import {
  LISTENING_LESSONS,
  READING_LESSONS,
  SPEAKING_PROMPTS,
  WRITING_PROMPTS,
  ListeningLesson,
  ReadingLesson,
  SpeakingPrompt,
  WritingPrompt,
} from '../data/fourSkillsData';
import type { ResumableActivity } from '../types/learningContinuity';
import { isActivityStale } from './learningContinuityService';
import { useAppStore } from '../store/useAppStore';

export type SkillType = 'listening' | 'reading' | 'speaking' | 'writing';

export const FOUR_SKILLS_LIST: readonly SkillType[] = [
  'listening',
  'reading',
  'speaking',
  'writing',
] as const;

export const CEFR_LEVELS_ORDER: readonly CEFRLevel[] = [
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
] as const;

export type JourneyLevelStatus = 'available' | 'in_progress' | 'completed';

export type JourneyCertificationStatus =
  | 'not_ready'
  | 'ready'
  | 'in_progress'
  | 'needs_reinforcement'
  | 'certified';

export interface JourneyActiveLessonInfo {
  skill: SkillType;
  id: string;
  title: string;
  progressPercent?: number;
  lastActiveAt?: number;
}

export interface JourneyLessonItem {
  id: string;
  title: string;
  skill: SkillType;
  level: CEFRLevel;
  isCompleted: boolean;
  isActive?: boolean;
}

export interface JourneySkillProgress {
  skill: SkillType;
  totalLessons: number;
  completedLessons: number;
  completedLessonIds: string[];
  progressPercent: number; // 0 - 100 integer
  isCompleted: boolean;
  activeLesson?: JourneyActiveLessonInfo | null;
  nextLesson?: JourneyLessonItem | null;
}

export interface JourneyLevelNode {
  level: CEFRLevel;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number; // 0 - 100 integer
  status: JourneyLevelStatus;
  isCompleted: boolean;
  isCurrentLevel: boolean;
  skills: Record<SkillType, JourneySkillProgress>;
  activeLesson?: JourneyActiveLessonInfo | null;
  nextRecommendedLesson?: JourneyLessonItem | null;

  // Phase 11 Additions:
  certificationStatus: JourneyCertificationStatus;
  isReadyForCheckpoint: boolean;
  isCertified: boolean;
  certificationRecord?: PersistedLevelCertification | null;
  latestAttempt?: CheckpointHistoryEntry | null;
}

export interface JourneyRecommendedAction {
  tab: 'four_skills';
  skill: SkillType;
  lessonId: string;
}

export interface LearningJourneySummary {
  totalLessons: number;
  completedLessons: number;
  overallProgressPercent: number; // 0 - 100 integer
  completedLevelsCount: number;
  currentLevel: CEFRLevel;
  currentlyLearningLevel: CEFRLevel;
  highestCertifiedLevel: CEFRLevel | null;
  isNewUser: boolean;
  activeResumeLesson?: (JourneyActiveLessonInfo & { level: CEFRLevel }) | null;
  nextRecommendedLesson?: (JourneyLessonItem & { action: JourneyRecommendedAction }) | null;
}

export interface FourSkillsLearningJourney {
  levels: Record<CEFRLevel, JourneyLevelNode>;
  orderedLevels: JourneyLevelNode[];
  summary: LearningJourneySummary;
}

export interface LearningJourneyInput {
  listeningLessons?: readonly ListeningLesson[];
  readingLessons?: readonly ReadingLesson[];
  speakingPrompts?: readonly SpeakingPrompt[];
  writingPrompts?: readonly WritingPrompt[];

  completedListeningLessonIds?: readonly string[];
  fourSkillsCompletionProgress?: Partial<FourSkillsCompletionProgress> | null;

  resumeActivities?: Record<string, ResumableActivity> | null;
  competency?: Record<SkillType, SkillCompetency> | null;
  nowMs?: number;

  levelCertifications?: LevelCertificationStore | null;
  checkpointHistory?: CheckpointHistoryEntry[] | null;
  fourSkillsEvidence?: FourSkillsEvidenceStore | null;
  fourSkillsScores?: FourSkillsScores | Record<SkillType, number> | null;
}

/**
 * Normalizes any CEFR level representation (including legacy compound strings like 'A2-B1')
 * into a canonical CEFRLevel ('A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2').
 */
export function resolveLessonCefrLevel(level: string | null | undefined): CEFRLevel | null {
  if (!level) return null;
  const norm = level.trim().toUpperCase();
  if (CEFR_LEVELS_ORDER.includes(norm as CEFRLevel)) {
    return norm as CEFRLevel;
  }
  if (norm === 'A2-B1') return 'A2';
  if (norm === 'B1-B2') return 'B1';
  if (norm === 'B2-C1') return 'B2';
  return null;
}

/**
 * Helper to extract unique sanitized string IDs from an array.
 */
function toCleanSet(ids?: readonly string[] | null): Set<string> {
  const set = new Set<string>();
  if (!ids || !Array.isArray(ids)) return set;
  for (const id of ids) {
    if (typeof id === 'string' && id.trim().length > 0) {
      set.add(id.trim());
    }
  }
  return set;
}

/**
 * Pure derivation engine for Four Skills Learning Journey.
 */
type BankLesson = { id: string; title: string; skill: SkillType; level: CEFRLevel };

interface CachedLessonGroups {
  lessonsByLevelAndSkill: Record<CEFRLevel, Record<SkillType, BankLesson[]>>;
  lessonMetaMap: Map<string, { level: CEFRLevel; skill: SkillType; title: string }>;
}

let cachedDefaultLessonGroups: CachedLessonGroups | null = null;

function buildLessonGroups(
  listeningBank: readonly ListeningLesson[],
  readingBank: readonly ReadingLesson[],
  speakingBank: readonly SpeakingPrompt[],
  writingBank: readonly WritingPrompt[]
): CachedLessonGroups {
  const lessonsByLevelAndSkill: Record<CEFRLevel, Record<SkillType, BankLesson[]>> = {
    A1: { listening: [], reading: [], speaking: [], writing: [] },
    A2: { listening: [], reading: [], speaking: [], writing: [] },
    B1: { listening: [], reading: [], speaking: [], writing: [] },
    B2: { listening: [], reading: [], speaking: [], writing: [] },
    C1: { listening: [], reading: [], speaking: [], writing: [] },
    C2: { listening: [], reading: [], speaking: [], writing: [] },
  };

  const lessonMetaMap = new Map<string, { level: CEFRLevel; skill: SkillType; title: string }>();

  for (const l of listeningBank) {
    const lvl = resolveLessonCefrLevel(l.level);
    if (lvl && lessonsByLevelAndSkill[lvl]) {
      const item: BankLesson = { id: l.id, title: l.title, skill: 'listening', level: lvl };
      lessonsByLevelAndSkill[lvl].listening.push(item);
      lessonMetaMap.set(l.id, { level: lvl, skill: 'listening', title: l.title });
    }
  }

  for (const r of readingBank) {
    const lvl = resolveLessonCefrLevel(r.level);
    if (lvl && lessonsByLevelAndSkill[lvl]) {
      const item: BankLesson = { id: r.id, title: r.title, skill: 'reading', level: lvl };
      lessonsByLevelAndSkill[lvl].reading.push(item);
      lessonMetaMap.set(r.id, { level: lvl, skill: 'reading', title: r.title });
    }
  }

  for (const s of speakingBank) {
    const lvl = resolveLessonCefrLevel(s.level);
    if (lvl && lessonsByLevelAndSkill[lvl]) {
      const item: BankLesson = { id: s.id, title: s.title, skill: 'speaking', level: lvl };
      lessonsByLevelAndSkill[lvl].speaking.push(item);
      lessonMetaMap.set(s.id, { level: lvl, skill: 'speaking', title: s.title });
    }
  }

  for (const w of writingBank) {
    const lvl = resolveLessonCefrLevel(w.level);
    if (lvl && lessonsByLevelAndSkill[lvl]) {
      const item: BankLesson = { id: w.id, title: w.title, skill: 'writing', level: lvl };
      lessonsByLevelAndSkill[lvl].writing.push(item);
      lessonMetaMap.set(w.id, { level: lvl, skill: 'writing', title: w.title });
    }
  }

  return { lessonsByLevelAndSkill, lessonMetaMap };
}

function getDefaultLessonGroups(): CachedLessonGroups {
  if (!cachedDefaultLessonGroups) {
    cachedDefaultLessonGroups = buildLessonGroups(
      LISTENING_LESSONS,
      READING_LESSONS,
      SPEAKING_PROMPTS,
      WRITING_PROMPTS
    );
  }
  return cachedDefaultLessonGroups;
}

export function deriveFourSkillsLearningJourney(
  input: LearningJourneyInput = {}
): FourSkillsLearningJourney {
  const now = input.nowMs ?? Date.now();

  const isCustomBanks = Boolean(
    input.listeningLessons ||
    input.readingLessons ||
    input.speakingPrompts ||
    input.writingPrompts
  );

  const { lessonsByLevelAndSkill, lessonMetaMap } = isCustomBanks
    ? buildLessonGroups(
        input.listeningLessons ?? LISTENING_LESSONS,
        input.readingLessons ?? READING_LESSONS,
        input.speakingPrompts ?? SPEAKING_PROMPTS,
        input.writingPrompts ?? WRITING_PROMPTS
      )
    : getDefaultLessonGroups();

  const completedListeningSet = toCleanSet(input.completedListeningLessonIds);
  const completedReadingSet = toCleanSet(input.fourSkillsCompletionProgress?.reading);
  const completedSpeakingSet = toCleanSet(input.fourSkillsCompletionProgress?.speaking);
  const completedWritingSet = toCleanSet(input.fourSkillsCompletionProgress?.writing);

  const completionSets: Record<SkillType, Set<string>> = {
    listening: completedListeningSet,
    reading: completedReadingSet,
    speaking: completedSpeakingSet,
    writing: completedWritingSet,
  };

  // 2. Discover active resumable Four Skills activities
  const candidateActivities: Array<{
    activity: ResumableActivity;
    skill: SkillType;
    lessonId: string;
    level?: CEFRLevel;
    title: string;
    progressPercent?: number;
  }> = [];

  if (input.resumeActivities && typeof input.resumeActivities === 'object') {
    for (const act of Object.values(input.resumeActivities)) {
      if (!act || act.completed || isActivityStale(act, now)) continue;

      let skill: SkillType | null = null;
      let lessonId: string | null = null;
      let progressPercent: number | undefined;

      if (act.type === 'listening' && act.checkpoint && 'lessonId' in act.checkpoint) {
        skill = 'listening';
        lessonId = act.checkpoint.lessonId;
        progressPercent = act.checkpoint.progressPercent;
      } else if (act.type === 'reading' && act.checkpoint && 'lessonId' in act.checkpoint) {
        skill = 'reading';
        lessonId = act.checkpoint.lessonId;
        progressPercent = act.checkpoint.progressPercent;
      } else if (act.type === 'speaking' && act.checkpoint && 'promptId' in act.checkpoint) {
        skill = 'speaking';
        lessonId = act.checkpoint.promptId;
        progressPercent = act.checkpoint.progressPercent;
      } else if (act.type === 'writing' && act.checkpoint && 'promptId' in act.checkpoint) {
        skill = 'writing';
        lessonId = act.checkpoint.promptId;
        progressPercent = act.checkpoint.progressPercent;
      }

      if (skill && lessonId) {
        // Edge case guard: If lesson is already completed, do not treat as active in-progress candidate
        if (completionSets[skill].has(lessonId)) {
          continue;
        }

        const meta = lessonMetaMap.get(lessonId);
        candidateActivities.push({
          activity: act,
          skill,
          lessonId,
          level: meta?.level,
          title: meta?.title || act.title,
          progressPercent,
        });
      }
    }
  }

  // Sort candidate activities by lastActiveAt descending
  candidateActivities.sort((a, b) => b.activity.lastActiveAt - a.activity.lastActiveAt);
  const primaryResumable = candidateActivities[0] ?? null;

  // Active lessons lookup by level and skill
  const activeLessonBySkillAndLevel = new Map<string, JourneyActiveLessonInfo>();
  for (const cand of candidateActivities) {
    if (cand.level) {
      const key = `${cand.level}_${cand.skill}`;
      if (!activeLessonBySkillAndLevel.has(key)) {
        activeLessonBySkillAndLevel.set(key, {
          skill: cand.skill,
          id: cand.lessonId,
          title: cand.title,
          progressPercent: cand.progressPercent,
          lastActiveAt: cand.activity.lastActiveAt,
        });
      }
    }
  }

  // 3. Build Level and Skill Nodes
  const levelsRecord: Record<CEFRLevel, JourneyLevelNode> = {} as any;
  const orderedLevelsList: JourneyLevelNode[] = [];

  let totalAllLessons = 0;
  let totalAllCompleted = 0;
  let totalCompletedLevels = 0;

  for (const level of CEFR_LEVELS_ORDER) {
    const skillProgressRecord: Record<SkillType, JourneySkillProgress> = {} as any;
    let levelTotalLessons = 0;
    let levelCompletedLessons = 0;
    let levelActiveLesson: JourneyActiveLessonInfo | null = null;
    let levelFirstUncompleted: JourneyLessonItem | null = null;

    for (const skill of FOUR_SKILLS_LIST) {
      const lessonsInSkill = lessonsByLevelAndSkill[level][skill];
      const completedSet = completionSets[skill];

      // Only count completed IDs that belong to the current dataset for this skill & level
      const completedIds: string[] = [];
      let skillFirstUncompleted: JourneyLessonItem | null = null;

      for (const lesson of lessonsInSkill) {
        const isDone = completedSet.has(lesson.id);
        if (isDone) {
          completedIds.push(lesson.id);
        } else if (!skillFirstUncompleted) {
          skillFirstUncompleted = {
            id: lesson.id,
            title: lesson.title,
            skill,
            level,
            isCompleted: false,
          };
        }
      }

      const totalSkillLessons = lessonsInSkill.length;
      const completedSkillCount = completedIds.length;
      const skillProgressPct =
        totalSkillLessons > 0 ? Math.round((completedSkillCount / totalSkillLessons) * 100) : 0;
      const isSkillDone = totalSkillLessons > 0 && completedSkillCount === totalSkillLessons;

      const activeLessonInfo = activeLessonBySkillAndLevel.get(`${level}_${skill}`) || null;
      if (activeLessonInfo && (!levelActiveLesson || (activeLessonInfo.lastActiveAt ?? 0) > (levelActiveLesson.lastActiveAt ?? 0))) {
        levelActiveLesson = activeLessonInfo;
      }

      if (!levelFirstUncompleted && skillFirstUncompleted) {
        levelFirstUncompleted = skillFirstUncompleted;
      }

      skillProgressRecord[skill] = {
        skill,
        totalLessons: totalSkillLessons,
        completedLessons: completedSkillCount,
        completedLessonIds: completedIds,
        progressPercent: skillProgressPct,
        isCompleted: isSkillDone,
        activeLesson: activeLessonInfo,
        nextLesson: skillFirstUncompleted,
      };

      levelTotalLessons += totalSkillLessons;
      levelCompletedLessons += completedSkillCount;
    }

    const levelProgressPct =
      levelTotalLessons > 0 ? Math.round((levelCompletedLessons / levelTotalLessons) * 100) : 0;
    const isLevelDone = levelTotalLessons > 0 && levelCompletedLessons === levelTotalLessons;

    // Status Semantics:
    // - completed: all lessons in the level from current dataset are complete
    // - in_progress: partially completed (completedLessons > 0) OR has an active resumable lesson
    // - available: accessible to the learner (no strict lock)
    let status: JourneyLevelStatus = 'available';
    if (isLevelDone) {
      status = 'completed';
      totalCompletedLevels++;
    } else if (levelCompletedLessons > 0 || levelActiveLesson !== null) {
      status = 'in_progress';
    }

    // Phase 11: Level Certification Derivation
    const certRecord = input.levelCertifications?.[level] ?? null;
    const isLevelCertified = Boolean(certRecord && certRecord.certificateId);

    // Get checkpoint attempts for this level (ordered latest first)
    const levelAttempts = getCheckpointHistoryForLevel(input.checkpointHistory || [], level);
    const latestAttempt = levelAttempts[0] ?? null;

    // Check for active checkpoint activity in resumeActivities
    const hasActiveCheckpoint = Boolean(
      input.resumeActivities &&
        Object.values(input.resumeActivities).some(
          (act) =>
            act &&
            !act.completed &&
            !isActivityStale(act, now) &&
            act.type === 'checkpoint' &&
            'level' in act.checkpoint &&
            act.checkpoint.level === level
        )
    );

    // Evaluate readiness pure function
    const readiness = evaluateLevelReadiness(
      level,
      {
        certifications: input.levelCertifications,
        competencyEvidenceStore: input.fourSkillsEvidence,
        completedLessonIdsBySkill: {
          listening: input.completedListeningLessonIds || [],
          reading: input.fourSkillsCompletionProgress?.reading || [],
          speaking: input.fourSkillsCompletionProgress?.speaking || [],
          writing: input.fourSkillsCompletionProgress?.writing || [],
        },
        skillCompetencies: input.competency,
        nowMs: now,
      }
    );

    let certificationStatus: JourneyCertificationStatus = 'not_ready';
    if (isLevelCertified) {
      certificationStatus = 'certified';
    } else if (hasActiveCheckpoint) {
      certificationStatus = 'in_progress';
    } else if (latestAttempt && !latestAttempt.isPassed) {
      const retakeStatus = canRetakeCheckpointLevel(level, input.checkpointHistory || [], now);
      if (retakeStatus.canRetake && readiness.isReadyForCheckpoint) {
        certificationStatus = 'ready';
      } else {
        certificationStatus = 'needs_reinforcement';
      }
    } else if (readiness.isReadyForCheckpoint) {
      certificationStatus = 'ready';
    } else {
      certificationStatus = 'not_ready';
    }

    const node: JourneyLevelNode = {
      level,
      totalLessons: levelTotalLessons,
      completedLessons: levelCompletedLessons,
      progressPercent: levelProgressPct,
      status,
      isCompleted: isLevelDone,
      isCurrentLevel: false, // will be resolved in step 4
      skills: skillProgressRecord,
      activeLesson: levelActiveLesson,
      nextRecommendedLesson: levelFirstUncompleted,
      certificationStatus,
      isReadyForCheckpoint: readiness.isReadyForCheckpoint,
      isCertified: isLevelCertified,
      certificationRecord: certRecord,
      latestAttempt,
    };

    levelsRecord[level] = node;
    orderedLevelsList.push(node);

    totalAllLessons += levelTotalLessons;
    totalAllCompleted += levelCompletedLessons;
  }

  // 4. Resolve currentLevel deterministically
  // Precedence:
  // 1. Level of the most recent active/resumable Four Skills lesson
  // 2. Incomplete level with the most recent active lesson
  // 3. Incomplete level with actual progress (in_progress), lowest CEFR band first
  // 4. Lowest incomplete level
  // 5. If all completed: C2
  let currentLevel: CEFRLevel = 'A1';

  if (primaryResumable?.level && levelsRecord[primaryResumable.level]) {
    currentLevel = primaryResumable.level;
  } else {
    // Find incomplete levels with recent activity
    const inProgressLevels = orderedLevelsList.filter(
      (lvl) => lvl.status === 'in_progress' && !lvl.isCompleted
    );

    if (inProgressLevels.length > 0) {
      // Pick the in-progress level with an active lesson if any, or the lowest CEFR level
      const withActive = inProgressLevels.find((lvl) => lvl.activeLesson !== null);
      if (withActive) {
        currentLevel = withActive.level;
      } else {
        currentLevel = inProgressLevels[0].level;
      }
    } else {
      // Find lowest incomplete level
      const firstIncomplete = orderedLevelsList.find((lvl) => !lvl.isCompleted);
      currentLevel = firstIncomplete ? firstIncomplete.level : 'C2';
    }
  }

  // Mark isCurrentLevel on the selected level
  for (const node of orderedLevelsList) {
    node.isCurrentLevel = node.level === currentLevel;
  }

  // 5. Next Recommended Lesson Derivation (Deterministic, no second recommendation engine)
  // Precedence:
  // 1. Active resumable Four Skills lesson
  // 2. First uncompleted lesson in currentLevel (balanced skill selection: pick skill with lowest progress)
  // 3. First uncompleted lesson in sequential levels
  // 4. Fallback: First lesson of A1
  let nextLessonItem: (JourneyLessonItem & { action: JourneyRecommendedAction }) | null = null;

  if (primaryResumable && primaryResumable.level) {
    nextLessonItem = {
      id: primaryResumable.lessonId,
      title: primaryResumable.title,
      skill: primaryResumable.skill,
      level: primaryResumable.level,
      isCompleted: false,
      isActive: true,
      action: {
        tab: 'four_skills',
        skill: primaryResumable.skill,
        lessonId: primaryResumable.lessonId,
      },
    };
  } else {
    const currentNode = levelsRecord[currentLevel];
    // Sort skills by completed count ascending to encourage balanced practice across skills
    const skillsByBalance = [...FOUR_SKILLS_LIST].sort((a, b) => {
      const aDone = currentNode.skills[a]?.completedLessons ?? 0;
      const bDone = currentNode.skills[b]?.completedLessons ?? 0;
      if (aDone !== bDone) return aDone - bDone;
      return FOUR_SKILLS_LIST.indexOf(a) - FOUR_SKILLS_LIST.indexOf(b);
    });

    let chosenCandidate: JourneyLessonItem | null = null;
    for (const sk of skillsByBalance) {
      const nextInSkill = currentNode.skills[sk]?.nextLesson;
      if (nextInSkill) {
        chosenCandidate = nextInSkill;
        break;
      }
    }

    // If current level is already complete, search sequentially through next levels
    if (!chosenCandidate) {
      for (const node of orderedLevelsList) {
        if (!node.isCompleted && node.nextRecommendedLesson) {
          chosenCandidate = node.nextRecommendedLesson;
          break;
        }
      }
    }

    if (chosenCandidate) {
      nextLessonItem = {
        ...chosenCandidate,
        action: {
          tab: 'four_skills',
          skill: chosenCandidate.skill,
          lessonId: chosenCandidate.id,
        },
      };
    } else {
      // Ultimate fallback: First lesson of A1 listening
      const a1FirstListening = lessonsByLevelAndSkill.A1.listening[0];
      if (a1FirstListening) {
        nextLessonItem = {
          id: a1FirstListening.id,
          title: a1FirstListening.title,
          skill: 'listening',
          level: 'A1',
          isCompleted: false,
          action: {
            tab: 'four_skills',
            skill: 'listening',
            lessonId: a1FirstListening.id,
          },
        };
      }
    }
  }

  // 6. Summary metrics
  const isNewUser = totalAllCompleted === 0 && primaryResumable === null;
  const overallProgressPct =
    totalAllLessons > 0 ? Math.round((totalAllCompleted / totalAllLessons) * 100) : 0;
  const highestCertifiedLevel = deriveHighestCertifiedLevel(input.levelCertifications);

  const summary: LearningJourneySummary = {
    totalLessons: totalAllLessons,
    completedLessons: totalAllCompleted,
    overallProgressPercent: overallProgressPct,
    completedLevelsCount: totalCompletedLevels,
    currentLevel,
    currentlyLearningLevel: currentLevel,
    highestCertifiedLevel,
    isNewUser,
    activeResumeLesson: primaryResumable
      ? {
          skill: primaryResumable.skill,
          id: primaryResumable.lessonId,
          title: primaryResumable.title,
          level: primaryResumable.level || currentLevel,
          progressPercent: primaryResumable.progressPercent,
          lastActiveAt: primaryResumable.activity.lastActiveAt,
        }
      : null,
    nextRecommendedLesson: nextLessonItem,
  };

  return {
    levels: levelsRecord,
    orderedLevels: orderedLevelsList,
    summary,
  };
}

/**
 * Convenient selector to derive Learning Journey directly from current Zustand store state.
 */
export function deriveFourSkillsLearningJourneyFromStore(
  state?: ReturnType<typeof useAppStore.getState>
): FourSkillsLearningJourney {
  const currentStore = state ?? useAppStore.getState();

  return deriveFourSkillsLearningJourney({
    completedListeningLessonIds: currentStore.completedListeningLessonIds,
    fourSkillsCompletionProgress: currentStore.fourSkillsCompletionProgress,
    resumeActivities: currentStore.resumeActivities,
    levelCertifications: currentStore.levelCertifications,
    checkpointHistory: currentStore.checkpointHistory,
    fourSkillsEvidence: currentStore.fourSkillsEvidence,
    fourSkillsScores: currentStore.fourSkillsScores,
  });
}
